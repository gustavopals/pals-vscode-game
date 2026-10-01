import type {
  ExtensionToWebview,
  GameEvent,
  ReturnReport,
  ViewState,
  WebviewToExtension,
} from '@lotg/protocol';
import { renderToString } from 'preact-render-to-string';
import { describe, expect, it } from 'vitest';

import golden from '../../engine/src/__golden__/view-seed-pedra-alta.json';
import { App } from './app';
import {
  formatApprox,
  formatAway,
  formatCountdown,
  formatDuration,
  formatNumber,
  formatSigned,
  remaining,
} from './format';
import { type AppState, initialState, reduce } from './state';

// O CSS é lido como texto pelo Vitest, sem tocar o sistema de arquivos.
const sheets = import.meta.glob<string>('./styles.css', {
  query: '?inline',
  import: 'default',
  eager: true,
});
const styles = sheets['./styles.css'] ?? '';

const view = golden.afterFirstAllocation as unknown as ViewState;
const session = {
  account: { displayName: 'Gustavo', kind: 'anonymous' as const },
  hasGame: true,
  defaults: { displayName: 'Gustavo', settlementName: 'Pedra Alta' },
  busy: false,
};
const playing: AppState = { ...initialState, route: 'fief', view, viewReceivedAt: 0, session };

const html = (state: AppState, sent: WebviewToExtension[] = []) =>
  renderToString(
    <App
      state={state}
      send={(message) => sent.push(message)}
      onRoute={() => undefined}
      onDismissError={() => undefined}
    />,
  );

describe('formatação', () => {
  it('números e taxas em pt-BR', () => {
    expect(formatNumber(1024)).toBe('1.024');
    expect(formatNumber(7.5)).toBe('7,5');
    expect(formatSigned(15)).toBe('+15');
    expect(formatSigned(-5)).toBe('−5');
    expect(formatSigned(0)).toBe('0');
  });

  it('contagem regressiva por segundo', () => {
    expect(formatCountdown(299)).toBe('04:59');
    expect(formatCountdown(0)).toBe('00:00');
    expect(formatCountdown(4050)).toBe('1:07:30');
    expect(formatCountdown(-3)).toBe('00:00');
    expect(remaining(300, 1.9)).toBe(299);
    expect(remaining(300, 999)).toBe(0);
  });

  it('durações e ausências por extenso', () => {
    expect(formatDuration(300)).toBe('5 min');
    expect(formatDuration(4080)).toBe('1 h 08 min');
    expect(formatDuration(7200)).toBe('2 h');
    expect(formatApprox(133_200)).toBe('37 h');
    expect(formatApprox(1500)).toBe('25 min');
    expect(formatApprox(3 * 86_400)).toBe('3 dias');
    expect(formatAway(5 * 3600)).toBe('5 horas');
    expect(formatAway(3600)).toBe('1 hora');
    expect(formatAway(51 * 3600)).toBe('2 dias e 3 horas');
    expect(formatAway(24 * 3600)).toBe('1 dia');
  });
});

describe('estado do painel', () => {
  const at = (message: ExtensionToWebview, state = initialState) =>
    reduce(state, { type: 'message', message, now: 1000 });

  it('guarda a visão e o instante em que chegou', () => {
    expect(at({ type: 'view', view })).toMatchObject({ view, viewReceivedAt: 1000 });
  });

  it('a ligação que volta apaga o aviso de rede, mas não o de regra', () => {
    const network = { ...initialState, online: false, error: { code: 'NETWORK', message: 'fora' } };
    expect(at({ type: 'connection', online: true }, network)).toMatchObject({
      online: true,
      error: null,
    });
    const rule = { ...initialState, error: { code: 'GAME_RULE', message: 'Faltam 15 pedra.' } };
    expect(at({ type: 'connection', online: true }, rule).error).toEqual(rule.error);
    expect(at({ type: 'connection', online: false, retryInSeconds: 5 })).toMatchObject({
      online: false,
      retryInSeconds: 5,
    });
  });

  it('sem feudo, volta às boas-vindas e esquece a visão', () => {
    const next = at(
      { type: 'session', session: { ...session, account: null, hasGame: false } },
      playing,
    );
    expect(next).toMatchObject({ route: 'welcome', view: null });
    expect(at({ type: 'session', session }, playing).route).toBe('fief');
    // Entrou em um feudo por outra via (GitHub, Código do Reino): as boas-vindas saem de cena.
    const onWelcome = { ...initialState, route: 'welcome' as const };
    expect(at({ type: 'session', session }, onWelcome).route).toBe('fief');
    expect(at({ type: 'session', session }, { ...playing, route: 'today' }).route).toBe('today');
  });

  it('navega, guarda Crônica, relatório e erros', () => {
    expect(at({ type: 'navigate', route: 'today' }).route).toBe('today');
    expect(at({ type: 'chronicle', entries: [] }).chronicle).toEqual([]);
    expect(at({ type: 'report', report: null }).report).toBeNull();
    expect(at({ type: 'error', code: 'GAME_RULE', message: 'Faltam 15 pedra.' }).error).toEqual({
      code: 'GAME_RULE',
      message: 'Faltam 15 pedra.',
    });
    expect(reduce(playing, { type: 'route', route: 'today' }).route).toBe('today');
    const failed = { ...playing, error: { code: 'X', message: 'y' } };
    expect(reduce(failed, { type: 'dismissError' }).error).toBeNull();
  });
});

describe('boas-vindas', () => {
  it('primeira abertura: dois campos e "Jogar agora", mais as duas entradas de outra máquina', () => {
    const page = html({
      ...initialState,
      session: {
        ...session,
        account: null,
        hasGame: false,
        defaults: { displayName: '', settlementName: 'Pedra Alta' },
      },
    });
    expect(page.match(/<input /g)).toHaveLength(2);
    expect(page).toContain('Como devemos chamar quem governa?');
    expect(page).toContain('value="Pedra Alta"');
    expect(page).toContain('Jogar agora');
    expect(page).toContain('Entrar com GitHub');
    expect(page).toContain('Usar Código do Reino');
    // Nada de dificuldade nem ritmo na v0.1.
    expect(page).not.toMatch(/Dificuldade|Ritmo|e-mail|senha/i);
  });

  it('conta já existente sem feudo só pede o nome do feudo', () => {
    const page = html({ ...initialState, session: { ...session, hasGame: false } });
    expect(page.match(/<input /g)).toHaveLength(1);
    expect(page).toContain('Fundar o feudo');
    expect(page).not.toContain('Entrar com GitHub');
  });

  it('enquanto a conta é criada, os botões ficam desabilitados', () => {
    const page = html({
      ...initialState,
      session: { ...session, account: null, hasGame: false, busy: true },
    });
    expect(page).toContain('Abrindo os portões…');
    expect(page.match(/disabled/g)?.length).toBeGreaterThanOrEqual(3);
  });
});

describe('aba Feudo', () => {
  const page = html(playing);

  it('cabeçalho com nome, Salão, calendário e população', () => {
    expect(page).toContain('<h1>Pedra Alta</h1>');
    expect(page).toContain('Salão Nv1 · Primavera, dia 1 do Ano 1');
    expect(page).toContain('Aldeões 5');
    expect(page).toContain('Habitação 5/10');
    expect(page).toContain('Livres 3');
  });

  it('tabela de recursos com cap "—", taxa com sinal e a explicação do número', () => {
    expect(page).toContain('aria-live="polite"');
    expect(page).toMatch(
      /<th scope="row">Comida<\/th><td class="num">180<\/td><td class="num">—<\/td>/,
    );
    expect(page).toContain('+15');
    expect(page).toContain(
      'data-tip="Fazenda: 2 trabalhadores × 10 × 1 (Nv1) = 20/h; consumo 5 × 1 = 5/h"',
    );
    // Para leitores de tela, a explicação acompanha o número em vez de substituí-lo.
    expect(page).toContain('+15<span class="sr-only"> (Fazenda: 2 trabalhadores');
    expect(page).toContain('role="tabpanel"');
    expect(page).toContain('aria-controls="tabpanel"');
  });

  it('trabalhadores com − e +, rotulados para leitores de tela', () => {
    expect(page).toContain('Trabalhadores (2/5)');
    expect(page).toContain('aria-label="Pôr mais um trabalhador em Fazenda"');
    expect(page).toContain('aria-label="Tirar um trabalhador de Serraria"');
    expect(page).toContain('aria-label="Fazenda nível 1: 2 trabalhadores, 20 por hora"');
  });

  it('construções com custos em chips e o que falta em texto, não só em cor', () => {
    expect(page).toContain('Os pedreiros estão livres.');
    expect(page).toContain('Salão do Senhor Nv1 → Nv2');
    expect(page).toContain('150 madeira (faltam 30)');
    expect(page).toContain('Faltam 30 madeira e 35 pedra.');
    expect(page).toContain('80 madeira');
  });

  it('obra ativa mostra contagem regressiva, progresso e Cancelar', () => {
    const building: ViewState = {
      ...view,
      constructions: {
        ...view.constructions,
        active: {
          building: 'farm',
          label: 'Fazenda',
          targetLevel: 2,
          secondsRemaining: 180,
          totalSeconds: 300,
          progressPercent: 40,
          refund: [
            { resource: 'wood', label: 'Madeira', amount: 64 },
            { resource: 'gold', label: 'Ouro', amount: 32 },
          ],
        },
      },
    };
    const active = html({ ...playing, view: building });
    expect(active).toContain('Fazenda → Nv2');
    expect(active).toContain('03:00');
    expect(active).toContain('aria-label="Obra 40% concluída"');
    expect(active).toContain('Cancelar');
    // O que volta ao cancelar vem do servidor; o painel não conhece a regra dos 80%.
    expect(active).toContain('Cancelar devolve 64 madeira e 32 ouro.');
  });

  it('objetivos com o porquê e a recompensa; Crônica com as últimas linhas', () => {
    const line: GameEvent = {
      seq: 1,
      type: 'objectiveCompleted',
      at: '2026-10-01T12:00:00.000Z',
      atMs: 0,
      text: 'Cumpriu-se um objetivo.',
      data: {},
    };
    const withChronicle = html({ ...playing, chronicle: [line] });
    expect(withChronicle).toContain('Inicie a melhoria das Habitações');
    expect(withChronicle).toContain('Recompensa: +30 madeira.');
    expect(withChronicle).toContain('Cumpriu-se um objetivo.');
    expect(page).toContain('Ainda não há nada a contar.');
  });

  it('fome e erro aparecem como avisos, com papel para leitores de tela', () => {
    const starving = html({
      ...playing,
      view: {
        ...view,
        famine: { sinceMs: 0, secondsElapsed: 10, text: 'Fome: a produção cai para 75%.' },
      },
      error: { code: 'GAME_RULE', message: 'Faltam 15 pedra.' },
    });
    expect(starving).toContain('Fome em andamento.');
    expect(starving).toContain('role="alert"');
    expect(starving).toContain('Faltam 15 pedra.');
  });

  it('sem ligação: último estado em modo leitura, com todos os comandos desabilitados', () => {
    const offline = html({ ...playing, online: false, retryInSeconds: 5 });
    expect(offline).toContain('Sem ligação com o reino.');
    expect(offline).toContain(
      'O mundo continua andando. Seus comandos voltam quando a ligação voltar.',
    );
    expect(offline).toContain('Nova tentativa em 5 s.');
    expect(offline).toContain('<h1>Pedra Alta</h1>');
    // Só "Tentar agora", as abas e a exportação seguem ativos.
    const enabled = [...offline.matchAll(/<button[^>]*>/g)].filter(
      (tag) => !tag[0].includes('disabled'),
    );
    const labels = [...offline.matchAll(/<button(?![^>]*disabled)[^>]*>([^<]*)/g)].map(
      (match) => match[1],
    );
    expect(labels.sort()).toEqual(['Abrir em Markdown', 'Feudo', 'Hoje', 'Tentar agora']);
    expect(enabled).toHaveLength(4);
  });
});

describe('aba Hoje', () => {
  const report: ReturnReport = {
    awaySeconds: 5 * 3600,
    resources: [{ id: 'food', label: 'Comida', before: 180, after: 255, delta: 75 }],
    counts: {
      daysPassed: 2,
      constructionsFinished: 1,
      villagersArrived: 3,
      objectivesCompleted: 1,
    },
    famine: 'none',
    highlights: ['No 1º dia da Primavera, os pedreiros ergueram as Habitações ao 2º nível.'],
  };

  it('mostra o Relatório de Retorno e explica as decisões pendentes da v0.1', () => {
    const page = html({ ...playing, route: 'today', report });
    expect(page).toContain('Você esteve fora por <strong>5 horas</strong>');
    expect(page).toContain('+75');
    expect(page).toContain('Obras concluídas: 1');
    expect(page).toContain('os pedreiros ergueram as Habitações');
    expect(page).toContain('Nenhuma por agora.');
    expect(page).toContain('aria-label="há novidades"');
  });

  it('sem relatório, diz quando ele aparece; com fome, avisa', () => {
    expect(html({ ...playing, route: 'today' })).toContain(
      'Nada de novo desde a sua última visita.',
    );
    const hungry = html({ ...playing, route: 'today', report: { ...report, famine: 'started' } });
    expect(hungry).toContain('a fome começou');
  });
});

describe('carregamento', () => {
  it('sem visão ainda, avisa que está abrindo; sem conexão e sem cache, explica', () => {
    expect(html({ ...playing, view: null })).toContain('Abrindo os portões de Pedra Alta…');
    expect(html({ ...playing, view: null, online: false })).toContain(
      'Ainda não há um estado guardado nesta máquina.',
    );
  });
});

describe('tema', () => {
  it('nenhuma cor fixa: só variáveis do VS Code', () => {
    expect(styles.length).toBeGreaterThan(1000);
    expect(styles).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(styles).not.toMatch(/\b(rgb|rgba|hsl|hsla)\(/);
    const named = /:\s*(white|black|red|green|blue|gray|grey|yellow|orange)\s*[;!]/i;
    expect(styles).not.toMatch(named);
    expect(styles).toContain('var(--vscode-foreground)');
    expect(styles).toContain('prefers-reduced-motion');
    expect(styles).toContain(':focus-visible');
  });
});
