import type { ViewState } from '@lotg/protocol';
import type { ComponentChild } from 'preact';
import { renderToString } from 'preact-render-to-string';
import { describe, expect, it } from 'vitest';

import { ChronicleTab } from '../tabs/Chronicle';
import { GuildTab } from '../tabs/Guild';
import {
  CLASS_MISSING_REASON,
  denClearedView,
  expeditionCrossroadsView,
  expeditionReturningView,
  expeditionTravelingView,
  gameEvent,
  guildPaidView,
  heroCapturedView,
  heroInjuredView,
  initialView,
  tavernOpenView,
  withoutTheClass,
} from '../test-helpers';
import { defaultPosture, defaultTeam, keptReports, sendArg } from '../ui/expeditions';
import type { Actions } from './actions';
import { ArsenalPanel } from './ArsenalPanel';
import { CrossroadsCard } from './CrossroadsCard';
import { ExpeditionReport } from './ExpeditionReport';
import { ExpeditionsPanel, ReportsPanel } from './ExpeditionsPanel';
import { HeroesPanel } from './HeroesPanel';
import { ChroniclePanel } from './Panels';
import { Today } from './Today';

/**
 * As expedições na aba Guilda (roadmap da v0.3, V3D-T4): os destinos, o envio, a equipe fora do
 * feudo, a encruzilhada, o relatório, o equipamento e o arsenal, desenhados com as visões do
 * golden do motor. O app só dispõe o que veio: cada prazo, risco, pista e motivo conferido aqui
 * é o da visão.
 */

const noop = () => {};
const actions: Actions = { order: noop, run: noop, playNow: noop };
const html = (node: ComponentChild) => renderToString(<>{node}</>);
const text = (markup: string) =>
  markup
    .replace(/<\/(h1|h2|h3|p|li|button|div|summary|legend|label)>/g, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
const buttons = (markup: string) =>
  [...markup.matchAll(/<button([^>]*)>(.*?)<\/button>/g)].map((match) => ({
    label: (match[2] ?? '').replace(/<[^>]+>/g, ''),
    disabled: /\sdisabled/.test(match[1] ?? ''),
    describedBy: /aria-describedby="([^"]+)"/.exec(match[1] ?? '')?.[1] ?? null,
  }));
const NONE: ReadonlySet<string> = new Set();

/** As ordens que um clique manda: o comando e o argumento, na ordem. */
function recording() {
  const calls: Array<[string, unknown]> = [];
  const recorded: Actions = {
    order: noop,
    playNow: noop,
    run: (id, arg) => {
      calls.push([id, arg]);
    },
  };
  return { calls, actions: recorded };
}

const panel = (
  view: ViewState,
  overrides: Partial<{ disabled: boolean; busy: ReadonlySet<string>; elapsed: number }> = {},
) =>
  html(
    <ExpeditionsPanel
      view={view}
      elapsed={0}
      disabled={false}
      busy={NONE}
      actions={actions}
      {...overrides}
    />,
  );
const tab = (view: ViewState, online = true, focusedReport: string | null = null) =>
  html(
    <GuildTab
      view={view}
      elapsed={0}
      online={online}
      retryInSeconds={online ? null : 30}
      busy={NONE}
      focusedReport={focusedReport}
      actions={actions}
    />,
  );
const waiting = (view: ViewState) => {
  const expedition = view.guild.expeditions.find((entry) => entry.crossroads !== null);
  if (expedition === undefined || expedition.crossroads === null) {
    throw new Error('Sem equipe na encruzilhada.');
  }
  return { expedition, crossroads: expedition.crossroads };
};
const card = (
  view: ViewState,
  overrides: Partial<{ elapsed: number; readOnly: boolean; choosing: boolean }> = {},
) =>
  html(
    <CrossroadsCard
      expedition={waiting(view).expedition}
      elapsed={0}
      readOnly={false}
      choosing={false}
      actions={actions}
      {...overrides}
    />,
  );

describe('a encruzilhada (V3D-T4.1 e T4.3; GDD §9.2)', () => {
  it('mostra o título, a situação, cada caminho com a pista, o prazo real e o que a Postura fará', () => {
    const markup = card(expeditionCrossroadsView);
    const { crossroads } = waiting(expeditionCrossroadsView);
    const shown = text(markup);
    expect(shown).toContain('Encruzilhada · Floresta Antiga');
    expect(shown).toContain('Expira em 5 h');
    expect(shown).toContain('A trilha se divide');
    expect(shown).toContain('Edda e Rolf · Postura Equilibrada');
    expect(shown).toContain(crossroads.text);
    for (const option of crossroads.options) {
      expect(shown).toContain(option.label);
      expect(shown).toContain(option.hint);
    }
    // A opção que a Postura toma sozinha é dita por extenso, e a frase do pé é a do servidor.
    expect(shown).toContain('Sem resposta, é este o caminho da Postura Equilibrada.');
    expect(shown).toContain('Sem resposta, a Postura Equilibrada escolhe: Seguir o riacho.');
    // Um botão por caminho, cada um apontando para a pista dele.
    const paths = buttons(markup);
    expect(paths.map((button) => button.label)).toEqual(
      crossroads.options.map((option) => option.label),
    );
    expect(paths.every((button) => !button.disabled && button.describedBy !== null)).toBe(true);
    expect(markup).toContain('<article');
  });

  it('o botão manda a expedição e a opção pelo comando da escolha, o mesmo da paleta', () => {
    const { calls, actions: recorded } = recording();
    const { expedition, crossroads } = waiting(expeditionCrossroadsView);
    const [option] = crossroads.options;
    const rendered = (
      <CrossroadsCard
        expedition={expedition}
        elapsed={0}
        readOnly={false}
        choosing={false}
        actions={recorded}
      />
    );
    // Sem DOM: o clique é o `onClick` do primeiro botão da folha.
    const first = findButton(rendered);
    first?.();
    expect(calls).toEqual([
      ['lords.chooseExpeditionPath', { expeditionId: expedition.id, optionId: option?.id }],
    ]);
  });

  it('a opção bloqueada mostra o requisito, com cadeado, e não tem como ser escolhida', () => {
    const { expedition, crossroads } = waiting(expeditionCrossroadsView);
    const locked = {
      ...expedition,
      crossroads: {
        ...crossroads,
        options: crossroads.options.map((option, index) =>
          index === 0
            ? { ...option, locked: true, lockedReason: 'Requer um Guerreiro na equipe.' }
            : option,
        ),
      },
    };
    const markup = html(
      <CrossroadsCard
        expedition={locked}
        elapsed={0}
        readOnly={false}
        choosing={false}
        actions={actions}
      />,
    );
    expect(text(markup)).toContain('Requer um Guerreiro na equipe.');
    expect(markup).toContain('codicon-lock');
    expect(buttons(markup).map((button) => button.disabled)).toEqual([true, false, false]);
  });

  it('com o prazo vencido no relógio da página, avisa e não deixa enviar', () => {
    const { crossroads } = waiting(expeditionCrossroadsView);
    const markup = card(expeditionCrossroadsView, { elapsed: crossroads.decidesInSeconds + 1 });
    expect(text(markup)).toContain('Prazo encerrado');
    expect(text(markup)).toContain(
      'O prazo acabou: a Postura Equilibrada está decidindo, e a Crônica conta o caminho. Nada mais é enviado daqui.',
    );
    expect(buttons(markup).every((button) => button.disabled)).toBe(true);
    expect(markup).toContain('role="status"');
  });

  it('com a escolha a caminho, ou sem ligação, os botões ficam desabilitados', () => {
    const choosing = card(expeditionCrossroadsView, { choosing: true });
    expect(text(choosing)).toContain('Levando a sua palavra à equipe…');
    expect(buttons(choosing).every((button) => button.disabled)).toBe(true);
    expect(choosing).toContain('aria-busy="true"');
    expect(
      buttons(card(expeditionCrossroadsView, { readOnly: true })).every(
        (button) => button.disabled,
      ),
    ).toBe(true);
  });

  it('o prazo curto ganha ícone e palavra de aviso; nada é dito só pela cor', () => {
    const markup = card(expeditionCrossroadsView);
    expect(markup).toMatch(/card-deadline warning[^>]*>\s*<span class="codicon codicon-warning"/);
  });
});

/** O `onClick` do primeiro botão de uma árvore de componentes, sem DOM. */
function findButton(node: ComponentChild): (() => void) | undefined {
  const seen: Array<() => void> = [];
  const visit = (child: ComponentChild): void => {
    if (Array.isArray(child)) {
      child.forEach(visit);
      return;
    }
    if (typeof child !== 'object' || child === null || !('type' in child)) {
      return;
    }
    const vnode = child as {
      type: unknown;
      props: Record<string, unknown> & { children?: ComponentChild };
    };
    if (typeof vnode.type === 'function') {
      visit((vnode.type as (props: unknown) => ComponentChild)(vnode.props));
      return;
    }
    if (vnode.type === 'button' && typeof vnode.props.onClick === 'function') {
      seen.push(vnode.props.onClick as () => void);
    }
    visit(vnode.props.children);
  };
  visit(node);
  return seen[0];
}

describe('o painel Expedições (V3D-T4.2 e T4.6)', () => {
  it('sem a Guilda dos Aventureiros: a obra dela, com o custo e o que a impede', () => {
    const markup = panel(tavernOpenView);
    expect(text(markup)).toContain('Expedições');
    expect(buttons(markup).map((button) => button.label)).toEqual([
      'Construir Guilda dos Aventureiros',
    ]);
    // A frase da equipe está no painel dos heróis: aqui ela não se repete.
    expect(text(markup)).not.toContain(tavernOpenView.guild.text);
    // No feudo recém-fundado a obra está presa ao Salão, e o motivo é o do servidor.
    const early = panel(initialView);
    expect(text(early)).toContain('Melhore antes o Salão do Senhor para o nível 3.');
    expect(buttons(early)).toEqual([expect.objectContaining({ disabled: true })]);
  });

  it('cada destino mostra o risco, a duração real, o que a equipe precisa, o primeiro trecho e a régua', () => {
    const markup = panel(heroInjuredView);
    const shown = text(markup);
    expect(shown).toContain(heroInjuredView.guild.text);
    for (const destination of heroInjuredView.guild.available) {
      expect(shown).toContain(destination.label);
      expect(shown).toContain(`Risco: ${destination.riskText.toLowerCase()}`);
      expect(shown).toContain(destination.requirementsText);
      expect(shown).toContain(destination.firstStretchText);
      if (destination.fit !== null) {
        expect(shown).toContain(destination.fit.text);
      }
    }
    // O destino que a visão não traz (ainda não descoberto) não aparece.
    expect(shown).not.toContain("Ruínas de Vel'Thar");
    expect(shown).not.toContain('Resgate');
  });

  it('o envio: a equipe mínima e a Postura do meio já vêm marcadas, cada Postura diz o que faz, e o botão manda os três', () => {
    const markup = panel(heroInjuredView);
    const shown = text(markup);
    expect(shown).toContain('Montar a equipe');
    expect(shown).toContain('Quem vai (1 herói)');
    for (const posture of heroInjuredView.guild.postures) {
      expect(shown).toContain(posture.label);
      expect(shown).toContain(posture.text);
    }
    // Rolf é o único que pode partir: já vem marcado na Patrulha, com o que vale contra ela.
    expect(markup).toMatch(/type="checkbox" checked/);
    expect(shown).toMatch(/Rolf · Arqueiro Nv1 · Prudente\s?Vale [\d,]+ contra o primeiro trecho/);
    // A régua da equipe marcada vem com ícone e palavra.
    expect(shown).toMatch(/(Com folga|No limite|Arriscado)\. A equipe marcada vale [\d,]+/);
    // O que o botão manda ao comando: o destino, a equipe marcada e a Postura marcada. (O
    // clique em si é dos testes em navegador: a montagem guarda o que está marcado.)
    const { guild } = heroInjuredView;
    const [patrol] = guild.available;
    if (patrol === undefined) {
      throw new Error('Sem a Patrulha.');
    }
    expect(defaultTeam(patrol)).toEqual(['hero-2']);
    expect(defaultPosture(guild.postures)).toBe('balanced');
    expect(sendArg(patrol, defaultTeam(patrol), defaultPosture(guild.postures))).toEqual({
      modelId: 'patrol',
      heroIds: ['hero-2'],
      posture: 'balanced',
    });
    // A equipe marcada é a que a visão sugere, não os primeiros da lista: na Patrulha de quem
    // tem Rolf e Brann prontos, vem Brann.
    const marked = [
      ...panel(heroCapturedView).matchAll(
        /type="checkbox"( checked)? aria-labelledby="send-patrol-(hero-\d)-line"/g,
      ),
    ].map((match) => [match[2], match[1] !== undefined]);
    expect(marked).toEqual([
      ['hero-2', false],
      ['hero-3', true],
    ]);
  });

  it('o destino que pede uma classe que o feudo não tem diz o motivo do servidor e não oferece o envio (revisão, A1)', () => {
    // Dois heróis prontos e uma jornada de 1 a 2: pela contagem a tela abriria a montagem.
    const view = withoutTheClass(denClearedView, 'oldForest');
    const shown = text(panel(view));
    expect(shown).toContain(CLASS_MISSING_REASON);
    expect(panel(view)).not.toContain('id="send-oldForest-posture"');
    // Só a Patrulha continua com envio; o Covil, limpo, e a Floresta dizem cada um o seu motivo.
    expect(buttons(panel(view)).filter((button) => button.label.startsWith('Enviar'))).toHaveLength(
      1,
    );
  });

  it('sem gente bastante para um destino, a linha diz o motivo do servidor em vez de oferecer o envio', () => {
    // O Covil pede dois, e só Rolf pode partir.
    const den = heroInjuredView.guild.available.find((entry) => entry.modelId === 'wolfDen');
    expect(den?.sendBlockedReason).not.toBeNull();
    expect(text(panel(heroInjuredView))).toContain(den?.sendBlockedReason ?? '');
    const sends = buttons(panel(heroInjuredView)).filter((button) =>
      button.label.startsWith('Enviar'),
    );
    expect(sends).toHaveLength(2);
  });

  it('todos os lugares ocupados: cada destino traz o motivo do servidor, com cadeado, e nenhum envio', () => {
    const markup = panel(expeditionTravelingView);
    const [first] = expeditionTravelingView.guild.available;
    expect(text(markup)).toContain(first?.lockedReason ?? '');
    expect(buttons(markup).filter((button) => button.label.startsWith('Enviar'))).toEqual([]);
    expect(markup).toContain('codicon-lock');
  });

  it('a equipe fora do feudo: quem foi, a Postura, onde está e quanto falta', () => {
    const shown = text(panel(expeditionTravelingView));
    const [expedition] = expeditionTravelingView.guild.expeditions;
    expect(shown).toContain(`${expedition?.label} · Edda · Postura Ousada`);
    expect(shown).toContain(expedition?.statusText ?? '');
    expect(shown).toMatch(/O trecho de agora termina em \d/);
    // Duas de uma vez: uma linha por expedição.
    expect(
      expeditionReturningView.guild.expeditions.every((entry) =>
        text(panel(expeditionReturningView)).includes(entry.statusText),
      ),
    ).toBe(true);
  });

  it('a equipe na encruzilhada traz a folha da escolha e o que já aconteceu, recolhido', () => {
    const markup = panel(expeditionCrossroadsView);
    expect(text(markup)).toContain('O que já aconteceu (1)');
    expect(text(markup)).toContain('A trilha sob os carvalhos');
    expect(text(markup)).toContain('Encruzilhada · Floresta Antiga');
    expect(buttons(markup).map((button) => button.label)).toEqual([
      'Abrir caminho pela mata fechada',
      'Seguir o riacho',
      'Voltar com o que já têm',
    ]);
    // A escolha a caminho trava a folha dela.
    const busy = panel(expeditionCrossroadsView, { busy: new Set(['path:expedition-2']) });
    expect(buttons(busy).every((button) => button.disabled)).toBe(true);
  });

  it('sem ligação, nada se envia: os botões de ordem ficam desabilitados', () => {
    expect(
      buttons(panel(heroInjuredView, { disabled: true })).every((button) => button.disabled),
    ).toBe(true);
    expect(
      buttons(panel(expeditionCrossroadsView, { disabled: true })).every(
        (button) => button.disabled,
      ),
    ).toBe(true);
  });
});

describe('o relatório nó a nó (V3D-T4.4; critério 3 do GDD §16.2)', () => {
  it('cada passo traz o nó, o desfecho em palavra e ícone, a frase, quem se destacou, a lição e os fatos', () => {
    const [report] = heroInjuredView.guild.reports;
    if (report === undefined) {
      throw new Error('Sem relatório.');
    }
    const markup = html(<ExpeditionReport report={report} open />);
    const shown = text(markup);
    expect(shown).toContain('Floresta Antiga · Edda · Postura Ousada');
    for (const step of report.log) {
      expect(shown).toContain(step.title);
      expect(shown).toContain(step.outcomeLabel);
      expect(shown).toContain(step.text.replace(/\s+/g, ' '));
      for (const note of step.notes) {
        expect(shown).toContain(note);
      }
    }
    const setback = report.log.find((step) => step.outcome === 'setback');
    expect(setback?.standoutName).toBe('Edda');
    expect(shown).toContain('Destaque: Edda');
    expect(shown).toContain(`Lição: ${setback?.lessonText ?? ''}`);
    // O Revés tem ícone e palavra, além do tom de aviso.
    expect(markup).toMatch(
      /report-outcome warning[^>]*>\s*<span class="codicon codicon-warning"[^>]*><\/span> Revés/,
    );
    // No fim, o que trouxe e o que custou, nas frases do servidor.
    expect(shown).toContain(report.lootText);
    expect(shown).toContain(report.lossesText);
    expect(markup).toContain('<details open');
  });

  it('o Sucesso Pleno e o Desastre também têm cada um o seu ícone ao lado da palavra', () => {
    const [cleared] = denClearedView.guild.reports;
    const [captured] = heroCapturedView.guild.reports;
    if (cleared === undefined || captured === undefined) {
      throw new Error('Sem relatório.');
    }
    const won = html(<ExpeditionReport report={cleared} open />);
    expect(won).toMatch(/codicon-star-full"[^>]*><\/span> Sucesso pleno/);
    expect(text(won)).toContain(cleared.deedsText ?? '');
    const lost = html(<ExpeditionReport report={captured} open />);
    expect(lost).toMatch(/codicon-error"[^>]*><\/span> Desastre/);
    expect(text(lost)).toContain('O preço: Edda, em cativeiro.');
  });

  it('o painel mostra o mais novo aberto; o que o jogador pediu para ver abre no lugar dele', () => {
    const two: ViewState = {
      ...heroInjuredView,
      guild: {
        ...heroInjuredView.guild,
        reports: [...heroInjuredView.guild.reports, ...denClearedView.guild.reports].map(
          (report, index) => ({ ...report, expeditionId: `expedition-${index + 1}` }),
        ),
      },
    };
    const opened = (markup: string) =>
      [...markup.matchAll(/<details( open)?[^>]*><summary id="([^"]+)"/g)].map((match) => [
        match[2],
        match[1] !== undefined,
      ]);
    expect(opened(html(<ReportsPanel view={two} focused={null} />))).toEqual([
      ['report-expedition-1', true],
      ['report-expedition-2', false],
    ]);
    expect(opened(html(<ReportsPanel view={two} focused="expedition-2" />))).toEqual([
      ['report-expedition-1', false],
      ['report-expedition-2', true],
    ]);
    // Um pedido por um relatório que já saiu da lista não fecha os outros.
    expect(opened(html(<ReportsPanel view={two} focused="expedition-9" />))).toEqual([
      ['report-expedition-1', true],
      ['report-expedition-2', false],
    ]);
    // Sem relatório, o painel não aparece.
    expect(html(<ReportsPanel view={guildPaidView} focused={null} />)).toBe('');
  });
});

describe('a linha da Crônica liga ao relatório enquanto ele está guardado (V3D-T4.4)', () => {
  const [report] = heroInjuredView.guild.reports;
  const returned = {
    ...gameEvent(7, 'expeditionReturned', 'No 31º dia, a expedição voltou com madeira.'),
    data: { expeditionId: report?.expeditionId ?? '' },
  };
  const gone = {
    ...gameEvent(3, 'expeditionReturned', 'No 12º dia, uma expedição antiga voltou.'),
    data: { expeditionId: 'expedition-0' },
  };

  it('na Crônica recente do feudo', () => {
    const { calls, actions: recorded } = recording();
    const markup = html(
      <ChroniclePanel
        chronicle={[gone, returned]}
        guild={heroInjuredView.guild}
        actions={recorded}
      />,
    );
    const links = buttons(markup).filter((button) => button.label === 'Ver o relatório');
    expect(links).toHaveLength(1);
    // A linha antiga continua legível sozinha, sem botão.
    expect(text(markup)).toContain('No 12º dia, uma expedição antiga voltou.');
    expect(markup).toMatch(/a expedição voltou com madeira\.\s*<button/);
    expect(calls).toEqual([]);
  });

  it('na aba Crônica, pelo identificador que o documento traz em cada linha de expedição', () => {
    const document = {
      status: 'ready' as const,
      value: [
        '# Crônica de Pedra Alta',
        '',
        '## Ano 1',
        '',
        `- ${gone.text} <!-- expedition-99 -->`,
        `- ${returned.text} <!-- ${report?.expeditionId} -->`,
        '',
      ].join('\n'),
    };
    const { calls, actions: recorded } = recording();
    const node = (
      <ChronicleTab
        document={document}
        reports={keptReports(heroInjuredView.guild)}
        actions={recorded}
      />
    );
    const markup = html(node);
    expect(buttons(markup).filter((button) => button.label === 'Ver o relatório')).toHaveLength(1);
    // A marca não aparece no texto: é só a ligação.
    expect(markup).not.toContain('expedition-99');
    expect(text(markup)).toContain(`${gone.text} ${returned.text} Ver o relatório`);
    // Sem as ligações (o relatório já saiu da lista), a linha é só o texto.
    const plain = html(<ChronicleTab document={document} actions={actions} />);
    expect(buttons(plain).filter((button) => button.label === 'Ver o relatório')).toEqual([]);
    expect(text(plain)).toContain(returned.text);
    expect(plain).not.toContain('<!--');
    expect(calls).toEqual([]);
  });

  it('duas jornadas com a mesma frase ligam cada uma ao seu relatório, e a que não tem relatório fica sem botão (revisão, A2)', () => {
    // Duas Patrulhas do mesmo herói no mesmo dia: as linhas são iguais, palavra por palavra.
    const same = 'No 31º dia, Rolf voltou da Patrulha dos Arredores.';
    const [first] = heroInjuredView.guild.reports;
    if (first === undefined) {
      throw new Error('Sem relatório guardado.');
    }
    const guild = {
      ...heroInjuredView.guild,
      reports: [
        { ...first, expeditionId: 'expedition-8' },
        { ...first, expeditionId: 'expedition-7' },
      ],
    };
    const document = {
      status: 'ready' as const,
      value: [
        '## Ano 1',
        '',
        `- ${same} <!-- expedition-3 -->`,
        `- ${same} <!-- expedition-7 -->`,
        `- ${same} <!-- expedition-8 -->`,
      ].join('\n'),
    };
    const { calls, actions: recorded } = recording();
    const node = (
      <ChronicleTab document={document} reports={keptReports(guild)} actions={recorded} />
    );
    for (const { label, click } of allButtons(node)) {
      if (label === 'Ver o relatório') {
        click();
      }
    }
    // A primeira linha é de uma jornada cujo relatório já saiu: sem botão. As outras duas levam
    // cada uma ao seu, não as duas ao mais novo.
    expect(calls).toEqual([
      ['lords.openReport', 'expedition-7'],
      ['lords.openReport', 'expedition-8'],
    ]);
  });
});

describe('o equipamento na ficha e o arsenal (V3D-T4.5)', () => {
  const heroes = (view: ViewState, busy: ReadonlySet<string> = NONE, disabled = false) =>
    html(<HeroesPanel view={view} elapsed={0} disabled={disabled} busy={busy} actions={actions} />);

  it('três espaços por herói, com o que cada item soma, na frase do servidor', () => {
    const markup = heroes(heroInjuredView);
    const shown = text(markup);
    const rolf = heroInjuredView.guild.heroes.find((hero) => hero.name === 'Rolf');
    const bow = rolf?.equipment.find((entry) => entry.slot === 'weapon')?.item;
    expect(shown).toContain('Equipamento: 1 de 3');
    expect(shown).toContain(`Arma: Arco de freixo (${bow?.bonusText ?? ''})`);
    expect(shown).toContain('Armadura: vazio');
    expect(shown).toContain('Acessório: vazio');
    // O espaço ocupado tem "Desequipar"; o vazio só tem "Equipar" se o arsenal tem item para ele.
    const labels = buttons(markup).map((button) => button.label);
    expect(labels.filter((label) => label === 'Desequipar Arco de freixo')).toHaveLength(1);
    // O amuleto do arsenal é um acessório: os dois heróis no feudo podem levá-lo.
    expect(labels.filter((label) => label === 'Equipar acessório')).toHaveLength(2);
    expect(labels.filter((label) => label === 'Equipar armadura')).toEqual([]);
  });

  it('a troca a caminho trava a ficha daquele herói', () => {
    const markup = heroes(heroInjuredView, new Set(['equipment:hero-2']));
    const gear = buttons(markup).filter((button) => /^(Des)?[Ee]quipar/.test(button.label));
    // Os botões de Rolf (desequipar o arco e equipar o acessório) ficam desabilitados; o de Edda, não.
    expect(gear.map((button) => [button.label, button.disabled])).toEqual([
      ['Equipar acessório', false],
      ['Desequipar Arco de freixo', true],
      ['Equipar acessório', true],
    ]);
  });

  it('quem está fora do feudo só mostra o que leva; a heroína em recuperação diz o prazo', () => {
    const captive = heroes(heroCapturedView);
    expect(text(captive)).toContain('Em cativeiro desde "Ruínas de Vel\'Thar"');
    expect(text(captive)).toContain('Arma: Lança de caça');
    expect(
      buttons(captive).filter((button) => button.label.startsWith('Desequipar Lança')),
    ).toEqual([]);
    expect(text(heroes(heroInjuredView))).toContain(
      'Em recuperação: volta a poder partir em 30 min',
    );
  });

  it('com dois cativos, o botão do Resgate fica só na ficha de quem ele vai soltar, com o nome que a visão diz (revisão, A8)', () => {
    // Rolf também caiu em cativeiro, depois de Edda: o próximo Resgate solta Edda.
    const two: ViewState = {
      ...heroCapturedView,
      guild: {
        ...heroCapturedView.guild,
        heroes: heroCapturedView.guild.heroes.map((hero) =>
          hero.name === 'Rolf'
            ? { ...hero, captive: true, atHome: false, canDepart: false, nextRescued: false }
            : hero,
        ),
      },
    };
    expect(two.guild.rescueTargetName).toBe('Edda');
    const rescues = buttons(heroes(two)).filter((button) =>
      button.label.startsWith('Enviar o Resgate'),
    );
    expect(rescues.map((button) => button.label)).toEqual(['Enviar o Resgate de Edda']);
    // O botão está na ficha de Edda: é ela que ele descreve.
    expect(rescues[0]?.describedBy).toBe('hero-hero-1-about');
    // Quem a visão marca é quem manda, não a ordem da ficha: marcado Rolf, o botão é o dele.
    const swapped: ViewState = {
      ...two,
      guild: {
        ...two.guild,
        rescueTargetName: 'Rolf',
        heroes: two.guild.heroes.map((hero) => ({ ...hero, nextRescued: hero.name === 'Rolf' })),
      },
    };
    expect(
      buttons(heroes(swapped))
        .filter((button) => button.label.startsWith('Enviar o Resgate'))
        .map((button) => [button.label, button.describedBy]),
    ).toEqual([['Enviar o Resgate de Rolf', 'hero-hero-2-about']]);
  });

  it('o Resgate que não pode partir agora diz o motivo do servidor no lugar do botão', () => {
    const blocked = withoutTheClass(heroCapturedView, 'rescue');
    const markup = heroes(blocked);
    expect(buttons(markup).filter((button) => button.label.startsWith('Enviar o Resgate'))).toEqual(
      [],
    );
    expect(text(markup)).toContain(CLASS_MISSING_REASON);
  });

  it('com alguém em cativeiro, a ficha oferece "Enviar o Resgate" e diz o que vale para o cativo', () => {
    const { calls, actions: recorded } = recording();
    const markup = heroes(heroCapturedView);
    expect(text(markup)).toContain(heroCapturedView.guild.captiveText ?? '');
    expect(buttons(markup).map((button) => button.label)).toContain('Enviar o Resgate de Edda');
    const rendered = (
      <HeroesPanel
        view={heroCapturedView}
        elapsed={0}
        disabled={false}
        busy={NONE}
        actions={recorded}
      />
    );
    // O botão do Resgate manda o destino que a visão marca como Resgate.
    const clicks = allButtons(rendered);
    clicks.find((entry) => entry.label.startsWith('Enviar o Resgate'))?.click();
    expect(calls).toEqual([['lords.sendExpedition', 'rescue']]);
    // Sem cativo, nada disso aparece.
    expect(text(heroes(heroInjuredView))).not.toContain('Enviar o Resgate');
  });

  it('o arsenal lista os itens sem dono, com o que somam, e "Equipar" pergunta quem leva', () => {
    const { calls, actions: recorded } = recording();
    const markup = html(<ArsenalPanel view={heroInjuredView} disabled={false} actions={actions} />);
    const [item] = heroInjuredView.guild.inventory;
    expect(text(markup)).toContain(heroInjuredView.guild.inventoryText);
    expect(text(markup)).toContain(`${item?.label} · ${item?.slotLabel} · ${item?.rarityLabel}`);
    expect(text(markup)).toContain(item?.bonusText ?? '');
    findButton(<ArsenalPanel view={heroInjuredView} disabled={false} actions={recorded} />)?.();
    expect(calls).toEqual([['lords.equipItem', { itemId: item?.id }]]);
    // Vazio, diz de onde os itens vêm; sem a Guilda dos Aventureiros, o painel não aparece.
    expect(
      text(html(<ArsenalPanel view={denClearedView} disabled={false} actions={actions} />)),
    ).toContain('O arsenal está vazio: os itens vêm das expedições.');
    expect(html(<ArsenalPanel view={guildPaidView} disabled={false} actions={actions} />)).toBe('');
  });
});

/** Todos os botões de uma árvore de componentes, com o texto e o clique, sem DOM. */
function allButtons(node: ComponentChild): Array<{ label: string; click: () => void }> {
  const found: Array<{ label: string; click: () => void }> = [];
  const label = (child: ComponentChild): string => {
    if (Array.isArray(child)) {
      return child.map(label).join('');
    }
    if (typeof child === 'string' || typeof child === 'number') {
      return String(child);
    }
    if (typeof child !== 'object' || child === null || !('props' in child)) {
      return '';
    }
    return label((child as { props: { children?: ComponentChild } }).props.children);
  };
  const visit = (child: ComponentChild): void => {
    if (Array.isArray(child)) {
      child.forEach(visit);
      return;
    }
    if (typeof child !== 'object' || child === null || !('type' in child)) {
      return;
    }
    const vnode = child as {
      type: unknown;
      props: Record<string, unknown> & { children?: ComponentChild };
    };
    if (typeof vnode.type === 'function') {
      visit((vnode.type as (props: unknown) => ComponentChild)(vnode.props));
      return;
    }
    if (vnode.type === 'button' && typeof vnode.props.onClick === 'function') {
      found.push({ label: label(vnode.props.children), click: vnode.props.onClick as () => void });
    }
    visit(vnode.props.children);
  };
  visit(node);
  return found;
}

describe('a aba Guilda inteira (V3D-T4.6)', () => {
  it('com a Guilda de pé, as expedições vêm antes da equipe; sem ela, a equipe vem antes', () => {
    const built = text(tab(heroInjuredView));
    expect(built.indexOf('Expedições')).toBeLessThan(built.indexOf('Heróis · 2 heróis'));
    const unbuilt = text(tab(tavernOpenView));
    expect(unbuilt.indexOf('Heróis · 1 herói')).toBeLessThan(unbuilt.indexOf('Expedições'));
  });

  it('a frase da guilda aparece uma vez só no corpo da aba', () => {
    for (const view of [tavernOpenView, heroInjuredView, expeditionCrossroadsView, initialView]) {
      const shown = text(tab(view));
      // O cabeçalho do feudo a traz dentro da explicação de "Heróis N"; o corpo começa depois.
      const first = shown.indexOf('Expedições');
      const body = shown.slice(Math.min(first, shown.indexOf('Heróis', shown.indexOf('Moral'))));
      expect(body.split(view.guild.text).length - 1, view.guild.text).toBe(1);
    }
  });

  it('sem ligação: modo leitura, com todas as ordens das expedições desabilitadas', () => {
    const markup = tab(expeditionCrossroadsView, false);
    expect(text(markup)).toContain('Sem ligação com o reino: a equipe, as expedições');
    const orders = buttons(markup).filter(
      (button) => !/Tentar agora/.test(button.label) && button.label !== '',
    );
    expect(orders.length).toBeGreaterThan(3);
    expect(orders.every((button) => button.disabled)).toBe(true);
  });

  it('nenhum estilo embutido: a política de conteúdo do app não deixa', () => {
    for (const view of [
      expeditionTravelingView,
      expeditionCrossroadsView,
      expeditionReturningView,
      heroInjuredView,
      heroCapturedView,
      denClearedView,
    ]) {
      expect(tab(view)).not.toMatch(/\sstyle=/);
    }
  });
});

describe('a aba Hoje: a encruzilhada é uma decisão pendente (V3D-T4.3)', () => {
  const today = (view: ViewState, online = true) =>
    html(<Today view={view} elapsed={0} report={null} online={online} actions={actions} />);

  it('mostra o prazo, o que a Postura fará e o botão "Escolher caminho"', () => {
    const markup = today(expeditionCrossroadsView);
    const shown = text(markup);
    expect(shown).toContain('Decisões pendentes (1)');
    expect(shown).toContain('Guilda: “Floresta Antiga: A trilha se divide” · expira em 5 h');
    expect(shown).toContain('Sem resposta, a Postura Equilibrada escolhe: Seguir o riacho.');
    expect(buttons(markup).map((button) => button.label)).toContain('Escolher caminho');
  });
});
