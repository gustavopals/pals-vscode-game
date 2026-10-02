import {
  DisplayNameSchema,
  type GameEvent,
  type ReturnReport,
  type ViewState,
} from '@lotg/protocol';
import type { ComponentChild } from 'preact';
import { renderToString } from 'preact-render-to-string';
import { describe, expect, it } from 'vitest';

import golden from '../../../engine/src/__golden__/view-seed-pedra-alta.json';
import type { NewGameOptions } from '../game/newGame';
import { FiefTab } from '../tabs/Fief';
import { TodayTab } from '../tabs/Today';
import {
  activeConstruction,
  autumnView,
  catalogFixture,
  coldView,
  initialView,
  queuesView,
  unlockedView,
  winterWith,
  withPlanned,
  withQueues,
  withResource,
  withUpgrade,
} from '../test-helpers';
import type { Actions } from './actions';
import { ConstructionsPanel } from './ConstructionsPanel';
import {
  formatApprox,
  formatAway,
  formatCountdown,
  formatDuration,
  formatNumber,
  formatSigned,
  remaining,
} from './format';
import { ResourcesTable } from './ResourcesTable';
import { Today } from './Today';
import { Welcome } from './Welcome';

// O CSS é lido como texto pelo Vitest, sem tocar o sistema de arquivos.
const sheets = import.meta.glob<string>('../**/*.css', {
  query: '?inline',
  import: 'default',
  eager: true,
});
const THEMES_FILE = '../theme/themes.css';

const view = golden.afterFirstAllocation as unknown as ViewState;
const actions: Actions = { order: () => {}, run: () => {}, playNow: () => {} };
const html = (node: ComponentChild) => renderToString(<>{node}</>);

const fief = (
  overrides: Partial<{
    view: ViewState;
    elapsed: number;
    online: boolean;
    retryInSeconds: number | null;
    chronicle: GameEvent[];
  }> = {},
) =>
  html(
    <FiefTab
      view={view}
      elapsed={0}
      online={true}
      retryInSeconds={null}
      chronicle={[]}
      actions={actions}
      {...overrides}
    />,
  );

const welcome = (
  overrides: Partial<{
    account: { displayName: string } | null;
    busy: boolean;
    online: boolean;
    githubAvailable: boolean;
    options: NewGameOptions | null;
  }> = {},
) =>
  html(
    <Welcome
      account={null}
      busy={false}
      online={true}
      githubAvailable={true}
      options={null}
      actions={actions}
      {...overrides}
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

describe('boas-vindas', () => {
  it('primeira abertura: dois campos e "Jogar agora", mais as duas entradas de outro navegador', () => {
    const page = welcome();
    expect(page.match(/<input /g)).toHaveLength(2);
    expect(page).toContain('Como devemos chamar quem governa?');
    expect(page).toContain('value="Pedra Alta"');
    expect(page).toContain('Jogar agora');
    expect(page).toContain('Entrar com GitHub');
    expect(page).toContain('Usar Código do Reino');
    // Sem as opções do servidor a tela é a da v0.1: nada de dificuldade nem de ritmo.
    expect(page).not.toMatch(/Dificuldade|Ritmo|e-mail|senha/i);
    expect(page).not.toContain('type="radio"');
  });

  it('servidor sem o vínculo GitHub ligado: o botão não aparece', () => {
    const page = welcome({ githubAvailable: false });
    expect(page).not.toContain('Entrar com GitHub');
    expect(page).toContain('Usar Código do Reino');
  });

  it('conta já existente sem feudo só pede o nome do feudo', () => {
    const page = welcome({ account: { displayName: 'Gustavo' } });
    expect(page.match(/<input /g)).toHaveLength(1);
    expect(page).toContain('Fundar o feudo');
    expect(page).toContain('Bem-vindo de volta, <strong>Gustavo</strong>');
    expect(page).not.toContain('Entrar com GitHub');
  });

  it('enquanto a conta é criada, os botões ficam desabilitados', () => {
    const page = welcome({ busy: true });
    expect(page).toContain('Abrindo os portões…');
    expect(page.match(/disabled/g)?.length).toBeGreaterThanOrEqual(3);
  });

  it('sem ligação, explica e não deixa enviar', () => {
    const page = welcome({ online: false });
    expect(page).toContain('Sem ligação com o reino.');
    expect(page).toMatch(/<button type="submit"[^>]*disabled/);
  });
});

describe('boas-vindas: dificuldade e ritmo (GDD §13.9)', () => {
  const options = catalogFixture().newGame;
  const tags = (page: string, pattern: RegExp) => page.match(pattern) ?? [];
  const attribute = (tag: string, name: string) =>
    new RegExp(`\\s${name}="([^"]*)"`).exec(tag)?.[1] ?? null;
  const radios = (page: string, name: string) =>
    tags(page, /<input[^>]*type="radio"[^>]*>/g).filter((tag) => attribute(tag, 'name') === name);
  const checked = (page: string, name: string) =>
    radios(page, name)
      .filter((tag) => /\schecked(=|\s|>|\/)/.test(tag))
      .map((tag) => attribute(tag, 'value'));
  /** O texto do elemento com este id. */
  const textOf = (page: string, id: string) =>
    new RegExp(`id="${id}"[^>]*>([^<]*)<`).exec(page)?.[1] ?? null;

  it('dois grupos de opções, na ordem do servidor, cada um com nome para leitores de tela', () => {
    const page = welcome({ options });
    const groups = tags(page, /<fieldset[^>]*>/g);
    expect(groups).toHaveLength(2);
    expect(groups.every((tag) => attribute(tag, 'role') === 'radiogroup')).toBe(true);
    expect(groups.map((tag) => textOf(page, attribute(tag, 'aria-labelledby') ?? ''))).toEqual([
      'Dificuldade',
      'Ritmo',
    ]);
    expect(radios(page, 'difficulty').map((tag) => attribute(tag, 'value'))).toEqual([
      'peasant',
      'lord',
      'ironKing',
    ]);
    expect(radios(page, 'pace').map((tag) => attribute(tag, 'value'))).toEqual(['3', '1', '0.5']);
  });

  it('cada opção tem a linha curta como nome e uma frase como descrição, as duas à vista', () => {
    const page = welcome({ options });
    const named = (name: string) =>
      radios(page, name).map((tag) => ({
        line: textOf(page, attribute(tag, 'aria-labelledby') ?? ''),
        about: textOf(page, attribute(tag, 'aria-describedby') ?? ''),
      }));
    expect(named('difficulty')).toEqual([
      { line: 'Camponês', about: options.difficulties[0]?.description },
      { line: 'Senhor (recomendado)', about: options.difficulties[1]?.description },
      { line: 'Rei de Ferro', about: options.difficulties[2]?.description },
    ]);
    expect(named('pace')).toEqual([
      { line: 'Rápido: um ano em 56 horas (recomendado)', about: options.paces[0]?.hint },
      { line: 'Normal: um ano em 7 dias', about: options.paces[1]?.hint },
      { line: 'Tranquilo: um ano em 14 dias', about: options.paces[2]?.hint },
    ]);
    // Nenhuma frase fica escondida atrás de um clique ou do mouse.
    expect(page).not.toMatch(/hidden|title="/);
  });

  it('vem marcado o que o servidor manda marcar, e diz que os dois não mudam durante o ano', () => {
    const page = welcome({ options });
    expect(checked(page, 'difficulty')).toEqual(['lord']);
    expect(checked(page, 'pace')).toEqual(['3']);
    expect(page).toContain('não mudam durante o ano');
  });

  it('o marcado é o padrão do servidor, mesmo quando o recomendado é outro', () => {
    const testServer = catalogFixture({ difficulty: 'ironKing', timeScale: 1 }).newGame;
    const page = welcome({ options: testServer });
    expect(checked(page, 'difficulty')).toEqual(['ironKing']);
    expect(checked(page, 'pace')).toEqual(['1']);
    // A marca de recomendado continua onde o servidor a pôs.
    expect(page).toContain('Rápido: um ano em 56 horas (recomendado)');
    expect(page).toContain('Senhor (recomendado)');
  });

  it('os textos são os do servidor: o app não escreve rótulo nem frase de opção', () => {
    const other: NewGameOptions = {
      difficulties: [
        {
          id: 'lord',
          label: 'Alcaide',
          description: 'Frase que só o servidor conhece.',
          recommended: false,
        },
      ],
      paces: [
        {
          timeScale: 1,
          label: 'Passo de boi',
          description: 'um ano em 9 luas',
          hint: 'Para quem ara devagar.',
          recommended: false,
        },
      ],
      defaults: { difficulty: 'lord', timeScale: 1 },
    };
    const page = welcome({ options: other });
    expect(page).toContain('Alcaide');
    expect(page).toContain('Frase que só o servidor conhece.');
    expect(page).toContain('Passo de boi: um ano em 9 luas');
    expect(page).toContain('Para quem ara devagar.');
    expect(page).not.toMatch(/Senhor|Camponês|Rei de Ferro|Rápido|Tranquilo|recomendado/);
  });

  it('escolher é opcional: com os nomes válidos, "Jogar agora" já pode ser clicado', () => {
    const page = welcome({ options, account: { displayName: 'Gustavo' } });
    expect(/<button type="submit"[^>]*>/.exec(page)?.[0]).not.toContain('disabled');
    // E continua sendo um botão só, depois das opções.
    expect(page.match(/<button type="submit"/g)).toHaveLength(1);
    expect(page.indexOf('type="submit"')).toBeGreaterThan(page.lastIndexOf('type="radio"'));
  });

  it('enquanto o feudo é fundado, as opções ficam travadas junto com o botão', () => {
    const page = welcome({ options, busy: true });
    expect(tags(page, /<fieldset[^>]*>/g).every((tag) => /\sdisabled/.test(tag))).toBe(true);
  });

  it('quem já tem conta e ainda não tem feudo também escolhe', () => {
    const page = welcome({ options, account: { displayName: 'Gustavo' } });
    expect(radios(page, 'difficulty')).toHaveLength(3);
    expect(radios(page, 'pace')).toHaveLength(3);
  });
});

describe('boas-vindas: texto e regra dos nomes', () => {
  const submit = (page: string) => /<button type="submit"[^>]*>/.exec(page)?.[0] ?? '';
  // Sem DOM nos testes, o nome de quem governa entra pela conta já existente; o do feudo
  // começa em "Pedra Alta", que é válido.
  const submitFor = (displayName: string) => submit(welcome({ account: { displayName } }));

  it('não promete que "cada semana é um ano" (o ritmo é do servidor, ADR 0011)', () => {
    for (const page of [welcome(), welcome({ account: { displayName: 'Gustavo' } })]) {
      expect(page).not.toMatch(/cada semana/i);
      expect(page).not.toMatch(/semana[^.]*\bano\b/i);
    }
    expect(welcome()).toContain('o mundo continua andando com a aba fechada');
  });

  it('diz a regra dos nomes e limita os campos a 24 caracteres', () => {
    const page = welcome();
    expect(page).toContain('De 2 a 24 caracteres.');
    expect(page.match(/<input [^>]*>/g)?.every((tag) => /maxlength="24"/i.test(tag))).toBe(true);
  });

  it('sem nome de quem governa, não deixa enviar', () => {
    expect(submit(welcome())).toContain('disabled');
  });

  it('nome com 1 caractere, com 25 ou só de espaços não deixa enviar', () => {
    for (const name of ['a', ' a ', 'x'.repeat(25), '   ']) {
      expect(submitFor(name), JSON.stringify(name)).toContain('disabled');
    }
  });

  it('nomes com 2 e com 24 caracteres deixam enviar', () => {
    for (const name of ['ab', 'x'.repeat(24), `  ${'x'.repeat(24)}  `]) {
      expect(submitFor(name), JSON.stringify(name)).not.toContain('disabled');
    }
  });

  it('aceita exatamente os nomes que o protocolo aceita', () => {
    for (const name of ['', 'a', 'ab', 'Dona Urraca', 'x'.repeat(24), 'x'.repeat(25), 'a\u0000b']) {
      expect(!submitFor(name).includes('disabled'), JSON.stringify(name)).toBe(
        DisplayNameSchema.safeParse(name).success,
      );
    }
  });
});

describe('aba Feudo', () => {
  const page = fief();

  it('a habitação e o "a caminho" são os números da visão, sem conta no app', () => {
    // Números que não fecham entre si de propósito: pela conta antiga (aldeões + a caminho)
    // a habitação seria 7/10.
    const odd = fief({
      view: {
        ...view,
        population: { ...view.population, villagers: 5, inTraining: 2, housed: 9, vacancies: 1 },
      },
    });
    expect(odd).toContain('Habitação 9/10');
    expect(odd).not.toContain('Habitação 7/10');
    expect(odd).toContain('A caminho 2');
  });

  it('com gente a caminho, a habitação conta quem ainda não chegou', () => {
    const training = fief({
      view: {
        ...view,
        population: { ...view.population, inTraining: 2, housed: 7, vacancies: 3 },
      },
    });
    expect(training).toContain('Aldeões 5');
    expect(training).toContain('Habitação 7/10');
    expect(training).toContain('A caminho 2');
  });

  it('com aldeões a caminho, mostra quanto falta para o próximo chegar', () => {
    const waiting = (inTraining: number, secondsToNextRecruit: number | null, elapsed = 0) =>
      html(
        <FiefTab
          view={{
            ...view,
            population: { ...view.population, inTraining, secondsToNextRecruit },
          }}
          elapsed={elapsed}
          online={true}
          retryInSeconds={null}
          chronicle={[]}
          actions={actions}
        />,
      );
    const one = waiting(1, 400);
    expect(one).toContain('1 a caminho.');
    expect(one).toMatch(/Chega em <strong class="num">06:40<\/strong>/);
    expect(one).toContain('(próximo em 06:40)');
    // A contagem desce com o tempo desde que a visão chegou, sem falar com o servidor.
    expect(waiting(3, 400, 100)).toMatch(/O próximo chega em <strong class="num">05:00<\/strong>/);
    // Sem prazo com gente a caminho: a fila está parada pela fome.
    const frozen = waiting(2, null);
    expect(frozen).toContain('A chegada está parada enquanto durar a fome.');
    expect(frozen).not.toContain('próximo em');
    // Ninguém a caminho: nada disso aparece.
    expect(page).not.toContain('a caminho.');
  });

  it('cabeçalho com nome, Salão, calendário e população', () => {
    expect(page).toContain('<h1>Pedra Alta</h1>');
    expect(page).toContain('Salão Nv1 · Primavera, dia 1 do Ano 1');
    expect(page).toContain('Aldeões 5');
    expect(page).toContain('Habitação 5/10');
    expect(page).toContain('Livres 3');
  });

  it('tabela de recursos com o limite ("—" para o ouro), taxa com sinal e a explicação do número', () => {
    expect(page).toContain('aria-live="polite"');
    // O limite é um número com explicação: onde o recurso fica e de onde vem a capacidade.
    expect(page).toContain(
      '<th scope="row">Comida</th><td class="num">180</td><td class="num">' +
        '<span class="explained" tabindex="0" data-tip="Despensa: 500 iniciais">500',
    );
    expect(page).toMatch(
      /<th scope="row">Ouro<\/th><td class="num">270<\/td><td class="num">—<\/td>/,
    );
    expect(page).toContain('+19');
    expect(page).toContain(
      'data-tip="Fazenda: 2 trabalhadores × 10 × 1 (Nv1) × 1,2 (primavera) = 24/h; consumo 5 × 1 = 5/h"',
    );
    // Para leitores de tela, a explicação acompanha o número em vez de substituí-lo.
    expect(page).toContain('+19<span class="sr-only"> (Fazenda: 2 trabalhadores');
  });

  it('trabalhadores com − e +, rotulados para leitores de tela', () => {
    expect(page).toContain('Trabalhadores (2/5)');
    expect(page).toContain('aria-label="Pôr mais um trabalhador em Fazenda"');
    expect(page).toContain('aria-label="Tirar um trabalhador de Serraria"');
    expect(page).toContain('aria-label="Fazenda nível 1: 2 trabalhadores, 24 por hora"');
  });

  it('construções com custos em chips e o que falta em texto, não só em cor', () => {
    expect(page).toContain('Os pedreiros estão livres.');
    expect(page).toContain('Salão do Senhor Nv1 → Nv2');
    expect(page).toContain('150 madeira (faltam 30)');
    expect(page).toContain('Faltam 30 madeira e 35 pedra.');
    expect(page).toContain('80 madeira');
  });

  it('obra ativa mostra contagem regressiva, progresso e Cancelar', () => {
    const building = withQueues(view, [
      activeConstruction({
        building: 'farm',
        label: 'Fazenda',
        secondsRemaining: 180,
        totalSeconds: 300,
        progressPercent: 40,
        refund: [
          { resource: 'wood', label: 'Madeira', amount: 64, lost: 0 },
          { resource: 'gold', label: 'Ouro', amount: 32, lost: 0 },
        ],
      }),
    ]);
    const active = fief({ view: building });
    expect(active).toContain('Fazenda → Nv2');
    expect(active).toContain('03:00');
    expect(active).toContain('aria-label="Obra de Fazenda: 40% concluída"');
    expect(active).toContain('aria-label="Cancelar a obra: Fazenda"');
    expect(active).not.toContain('Os pedreiros estão livres.');
    // O que volta ao cancelar vem do servidor; o app não conhece a regra dos 80%.
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
    const withChronicle = fief({ chronicle: [line] });
    expect(withChronicle).toContain('Inicie a melhoria das Habitações');
    expect(withChronicle).toContain('Recompensa: +30 madeira.');
    expect(withChronicle).toContain('Cumpriu-se um objetivo.');
    expect(page).toContain('Ainda não há nada a contar.');
  });

  it('a fome aparece como aviso, com papel para leitores de tela', () => {
    const starving = fief({
      view: {
        ...view,
        famine: { sinceMs: 0, secondsElapsed: 10, text: 'Fome: a produção cai para 75%.' },
      },
    });
    expect(starving).toContain('Fome em andamento.');
    expect(starving).toContain('role="status"');
    expect(starving).toContain('Fome: a produção cai para 75%.');
  });

  it('sem ligação: último estado em modo leitura, com todas as ordens desabilitadas', () => {
    const offline = fief({ online: false, retryInSeconds: 5 });
    expect(offline).toContain('Sem ligação com o reino.');
    expect(offline).toContain(
      'O mundo continua andando. Seus comandos voltam quando a ligação voltar.',
    );
    expect(offline).toContain('Nova tentativa em 5 s.');
    expect(offline).toContain('<h1>Pedra Alta</h1>');
    // Só "Tentar agora" e a abertura da Crônica seguem ativos.
    const labels = [...offline.matchAll(/<button(?![^>]*disabled)[^>]*>([^<]*)/g)].map(
      (match) => match[1],
    );
    expect(labels.sort()).toEqual(['Abrir a Crônica', 'Tentar agora']);
  });

  it('os botões dão ordens novas, com o tipo e o conteúdo certos', () => {
    // As ordens saem de `actions.order`; aqui só se confere que o painel não tem outro caminho.
    expect(page).not.toMatch(/<a /);
    expect(page).not.toContain('<form');
  });
});

describe('aba Feudo: estações, lenha e frio', () => {
  /** O texto de uma página sem as marcas, para conferir frases que atravessam elementos. */
  const text = (page: string) =>
    page
      .replace(/<[^>]+>/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  /** O bloco de aviso (`.banner`) que contém o trecho. */
  const banner = (page: string, fragment: string) =>
    (page.match(/<div class="banner[^"]*" role="[a-z]+">.*?<\/div><\/div>/g) ?? []).find((block) =>
      block.includes(fragment),
    );
  /** A linha de um recurso na tabela. */
  const row = (page: string, label: string) =>
    new RegExp(`<tr><th scope="row">${label}</th>.*?</tr>`).exec(page)?.[0] ?? '';

  const autumn = fief({ view: autumnView });
  const cold = fief({ view: coldView });
  const lit = fief({ view: winterWith({ stock: 90, missing: 59, depletesInSeconds: 36_000 }) });
  const stocked = fief({
    view: winterWith({ stock: 900, missing: 0, depletesInSeconds: 360_000 }),
  });

  it('o cabeçalho diz, por extenso, o que a estação muda', () => {
    expect(fief()).toContain(
      '<p class="season muted">Primavera: comida × 1,2; recrutamento com prazo × 0,8.</p>',
    );
    expect(autumn).toContain('Salão Nv3 · Outono, dia 23 do Ano 1');
    expect(autumn).toContain('<p class="season muted">Outono: comida × 1,3; ouro × 1,1.</p>');
    expect(cold).toContain(
      'Inverno: comida × 0,4; madeira e pedra × 0,8; obras iniciadas com prazo × 1,5; a lareira queima 0,5 de madeira por habitante por hora.',
    );
    // A frase é a do servidor: o app não escreve fator nenhum.
    const other = fief({
      view: {
        ...view,
        calendar: { ...view.calendar, seasonEffects: 'Frase que só o servidor sabe.' },
      },
    });
    expect(other).toContain('<p class="season muted">Frase que só o servidor sabe.</p>');
    expect(other).not.toContain('comida × 1,2; recrutamento');
  });

  it('a explicação de cada taxa aparece inteira, com o fator da estação', () => {
    for (const why of [
      'Fazenda: 10 trabalhadores × 10 × 1,2 (Nv2) × 1,3 (outono) = 156/h; consumo 18 × 1 = 18/h',
      'Mina de Ouro: 3 trabalhadores × 4 × 1 (Nv1) × 1,1 (outono) = 13,2/h',
      // No painel de trabalhadores, a produção bruta de cada edifício.
      '10 trabalhadores × 10 × 1,2 (Nv2) × 1,3 (outono) = 156/h',
    ]) {
      expect(autumn).toContain(`data-tip="${why}"`);
      // E vai junto do número para leitores de tela, sem cortes.
      expect(autumn).toContain(`<span class="sr-only"> (${why})</span>`);
    }
    expect(autumn).toContain('+138');
    expect(autumn).toContain('+13,2');
    expect(autumn).toContain('156/h');
  });

  it('no frio, a explicação traz o inverno, o frio e a lenha, termo a termo', () => {
    const wood =
      'Serraria: 0 trabalhadores × 8 × 1 (Nv1) × 0,8 (inverno) × 0,8 (frio) = 0/h; −9/h (lenha de 18 habitantes)';
    expect(cold).toContain(`data-tip="${wood}"`);
    expect(cold).toContain(
      'data-tip="10 trabalhadores × 10 × 1,2 (Nv2) × 0,4 (inverno) × 0,8 (frio) = 38,4/h"',
    );
    expect(row(cold, 'Madeira')).toContain('−9<span class="sr-only">');
    expect(row(cold, 'Madeira')).toContain('class="num negative"');
  });

  it('no outono, a conta da lenha do inverno fica à vista, com o que falta guardar', () => {
    const note = banner(autumn, 'vai queimar') ?? '';
    expect(text(note)).toBe(
      'Inverno em 4 h. O Inverno vai queimar 216 de madeira com 18 habitantes. A Serraria repõe 0 e há 60 em estoque: faltam 156 de madeira.',
    );
    // Faltando lenha, o aviso ganha o destaque; é nota, não região viva: os números mudam a
    // cada leitura e um leitor de tela não deve repeti-los sozinho.
    expect(note).toContain('class="banner banner-warning" role="note"');
    expect(note).toContain('codicon-flame');
    // No outono ainda não há lareira nem frio.
    expect(autumn).not.toContain('class="hearth"');
    expect(autumn).not.toContain('Frio em andamento.');
  });

  it('com lenha guardada para o inverno inteiro, a conta sossega', () => {
    const { nextSeason } = autumnView.calendar;
    if (nextSeason.firewood === null) {
      throw new Error('O golden do outono deixou de trazer a conta da lenha.');
    }
    const ready = fief({
      view: {
        ...autumnView,
        calendar: {
          ...autumnView.calendar,
          nextSeason: {
            ...nextSeason,
            firewood: {
              ...nextSeason.firewood,
              stock: 300,
              missing: 0,
              text: 'O Inverno vai queimar 216 de madeira com 18 habitantes. O estoque e a Serraria dão conta.',
            },
          },
        },
      },
    });
    const note = banner(ready, 'vai queimar') ?? '';
    expect(text(note)).toContain('O estoque e a Serraria dão conta.');
    expect(note).toContain('class="banner" role="note"');
  });

  it('fora do outono e do inverno não há conta de lenha', () => {
    const spring = fief();
    expect(spring).not.toContain('role="note"');
    expect(spring).not.toContain('Lareira');
    expect(spring).not.toContain('codicon-flame');
  });

  it('no inverno, o cabeçalho mostra a lenha por hora e em quanto tempo a madeira acaba', () => {
    expect(text(lit)).toContain('Lareira: 9 de madeira por hora · madeira acaba em 10 h');
    expect(lit).toContain('<p class="hearth">');
    // A tabela diz o mesmo prazo na linha da madeira: os dois saem do mesmo número, e nenhum
    // desce sozinho com o relógio local (um diria "9 h" enquanto o outro ainda diz "10 h").
    expect(row(lit, 'Madeira')).toContain('<span class="warning">acaba em 10 h</span>');
    expect(
      text(
        fief({
          view: winterWith({ stock: 90, missing: 59, depletesInSeconds: 36_000 }),
          elapsed: 20,
        }),
      ),
    ).toContain('· madeira acaba em 10 h');
    // A conta inteira fica à vista, sem o tom de frio.
    const note = banner(lit, 'Lareira acesa.') ?? '';
    expect(text(note)).toBe(
      'Lareira acesa. Até a Primavera a lareira ainda queima 149 de madeira. A Serraria repõe 0 e há 90 em estoque: faltam 59 de madeira.',
    );
    expect(note).toContain('class="banner banner-warning" role="note"');
    expect(lit).not.toContain('Frio em andamento.');
  });

  it('em outro ritmo, a lareira e os prazos são os que a visão traz: o app não converte nada', () => {
    // A visão já vem em tempo real: no ritmo Rápido a lareira queima três vezes mais por hora
    // de relógio e os prazos são um terço. A tela escreve os números como vieram.
    const base = winterWith({ stock: 90, missing: 59, depletesInSeconds: 12_000 });
    const fast = fief({
      view: {
        ...base,
        winter: base.winter === null ? null : { ...base.winter, firewoodPerHour: 27 },
        resources: base.resources.map((entry) =>
          entry.id === 'wood' ? { ...entry, perHour: -27 } : entry,
        ),
      },
    });
    expect(text(fast)).toContain('Lareira: 27 de madeira por hora · madeira acaba em 3 h');
    expect(row(fast, 'Madeira')).toContain('−27<span class="sr-only">');
    expect(row(fast, 'Madeira')).toContain('<span class="warning">acaba em 3 h</span>');
  });

  it('com lenha para o resto do inverno, ninguém anuncia que a madeira acaba', () => {
    expect(text(stocked)).toContain('Lareira: 9 de madeira por hora');
    expect(stocked).not.toContain('madeira acaba em');
    expect(row(stocked, 'Madeira')).not.toContain('acaba em');
    // A madeira cai, mas não acaba: a lareira apaga antes.
    expect(row(stocked, 'Madeira')).toContain('<span class="muted">caindo</span>');
    const note = banner(stocked, 'Lareira acesa.') ?? '';
    expect(text(note)).toContain('O estoque e a Serraria dão conta.');
    expect(note).toContain('class="banner" role="note"');
  });

  it('o frio é um aviso próprio, com ícone, o que custa, a conta e a saída', () => {
    const warning = banner(cold, 'Frio em andamento.') ?? '';
    expect(warning).toContain('class="banner banner-warning" role="status"');
    expect(warning).toContain('codicon-flame');
    expect(text(warning)).toBe(
      'Frio em andamento. Frio: sem lenha, a produção de todo o feudo cai para 80%. A lareira pede 9/h e a Serraria entrega 0/h: o frio passa quando sobrar madeira, ou na Primavera. Faltam 149 de madeira para atravessar o resto do Inverno. Ponha aldeões na Serraria.',
    );
    // O texto é o do servidor.
    const other = fief({
      view: {
        ...coldView,
        winter:
          coldView.winter === null
            ? null
            : { ...coldView.winter, cold: { secondsElapsed: 60, text: 'Frase do servidor.' } },
      },
    });
    expect(text(banner(other, 'Frio em andamento.') ?? '')).toBe(
      'Frio em andamento. Frase do servidor. Ponha aldeões na Serraria.',
    );
    // No frio, quem traz a conta da lenha é o aviso: a nota da lareira acesa sai.
    expect(cold).not.toContain('Lareira acesa.');
    expect(cold).not.toContain('Fome em andamento.');
  });

  it('no frio, o cabeçalho diz há quanto tempo, e a madeira aparece em falta', () => {
    expect(text(cold)).toContain('· sem lenha, frio há 50 min');
    expect(cold).not.toContain('madeira acaba em');
    expect(row(cold, 'Madeira')).toContain('<span class="warning">em falta</span>');
  });

  it('a fome e o frio juntos são dois avisos, cada um com o seu ícone e o seu texto', () => {
    const both = fief({
      view: {
        ...coldView,
        famine: { sinceMs: 0, secondsElapsed: 10, text: 'Fome: a produção cai para 75%.' },
      },
    });
    const famine = banner(both, 'Fome em andamento.') ?? '';
    const chill = banner(both, 'Frio em andamento.') ?? '';
    expect(famine).not.toBe(chill);
    expect(famine).toContain('codicon-warning');
    expect(famine).not.toContain('codicon-flame');
    expect(chill).toContain('codicon-flame');
    expect(chill).not.toContain('codicon-warning');
    expect(text(famine)).toContain('Ponha aldeões na Fazenda.');
    expect(text(chill)).toContain('Ponha aldeões na Serraria.');
  });

  it('as obras dizem, uma vez só, por que o prazo é maior no inverno', () => {
    const note = 'No Inverno, o prazo de uma obra iniciada agora é × 1,5.';
    expect(cold.split(note)).toHaveLength(2);
    expect(cold).toContain(`<p class="muted hint construction-note">${note}</p>`);
    // O prazo já é o de quem começa agora: 675 s, e não os 450 s do outono.
    expect(cold).toContain('Fazenda Nv2 → Nv3<span class="muted"> · 12 min</span>');
    expect(autumn).toContain('Fazenda Nv2 → Nv3<span class="muted"> · 7 min 30 s</span>');
    expect(autumn).not.toContain('o prazo de uma obra');
  });

  it('o recrutamento diz por que o prazo é menor na primavera', () => {
    const spring = fief();
    expect(text(spring)).toContain(
      'Cada aldeão custa 50 comida e 10 ouro e leva 16 min. Na Primavera, o prazo de um recrutamento ordenado agora é × 0,8.',
    );
    expect(text(autumn)).toContain('Cada aldeão custa 50 comida e 10 ouro e leva 20 min.');
    expect(autumn).not.toContain('o prazo de um recrutamento');
  });

  it('a aba Hoje também avisa do frio', () => {
    const page = html(
      <TodayTab
        view={coldView}
        elapsed={0}
        online={true}
        retryInSeconds={null}
        report={null}
        actions={actions}
      />,
    );
    expect(page).toContain('Frio em andamento.');
    expect(page).toContain('Faltam 149 de madeira');
    expect(page).toContain('Inverno: comida × 0,4');
  });
});

describe('aba Feudo: armazenamento (GDD §5.5)', () => {
  const text = (page: string) =>
    page
      .replace(/<[^>]+>/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  const row = (page: string, label: string) =>
    new RegExp(`<tr><th scope="row">${label}</th>.*?</tr>`).exec(page)?.[0] ?? '';
  /** Os avisos de depósito, logo abaixo da tabela: um por edifício. */
  const notes = (page: string) =>
    /<ul class="storage-notes">(.*?)<\/ul>/.exec(page)?.[1]?.match(/<li .*?<\/li>/g) ?? [];
  const buttons = (markup: string) => markup.match(/<button[^>]*>[^<]*<\/button>/g) ?? [];

  /** A comida a quatro horas de encher a Despensa, antes de o Salão liberar o Celeiro. */
  const soon = withResource(view, 'food', { stock: 412, perHour: 22, fullInSeconds: 14_400 });
  /** O Pátio cheio de madeira e de pedra, com o Armazém pronto para ser erguido. */
  const affordable = withUpgrade(unlockedView, 'warehouse', {
    affordable: true,
    blockedCode: null,
    blockedReason: null,
    cost: [
      { resource: 'wood', label: 'Madeira', amount: 160, missing: 0 },
      { resource: 'stone', label: 'Pedra', amount: 80, missing: 0 },
    ],
  });
  const woodFull = withResource(affordable, 'wood', {
    stock: 500,
    perHour: 72,
    full: true,
    fullInSeconds: null,
    fullNote: 'Pátio cheio: 72/h de madeira indo ao chão. Construa o Armazém ou gaste madeira.',
    wastingPerHour: 72,
    wastedToday: 24,
  });
  const bothFull = withResource(woodFull, 'stone', {
    stock: 500,
    perHour: 15,
    full: true,
    fullInSeconds: null,
    fullNote: 'Pátio cheio: 15/h de pedra indo ao chão. Construa o Armazém ou gaste pedra.',
    wastingPerHour: 15,
    wastedToday: 0,
  });

  it('longe de encher, a tendência diz "cheio em" sem alarme e sem aviso', () => {
    const page = fief();
    // 60.632 s no golden: quase 17 horas.
    expect(row(page, 'Comida')).toContain('<span class="muted">cheio em 16 h</span>');
    expect(row(page, 'Comida')).not.toContain('codicon-warning');
    expect(page).not.toContain('storage-notes');
  });

  it('a menos de 8 h de encher, o destaque é ícone e texto, e a saída fica ao lado', () => {
    const page = fief({ view: soon });
    expect(row(page, 'Comida')).toContain(
      '<span class="warning"><span class="codicon codicon-warning" aria-hidden="true"></span> cheio em 4 h</span>',
    );
    const [note, ...others] = notes(page);
    expect(others).toEqual([]);
    expect(text(note ?? '')).toContain('Despensa: comida no limite de 500 em 4 h.');
    // Custo e benefício lado a lado: o que a obra pede, quanto leva e o que ela muda.
    expect(text(note ?? '')).toContain(
      '160 madeira, 80 pedra · 10 min · Capacidade de comida: 500 → 900.',
    );
    // O Celeiro ainda espera o Salão: o botão está lá, desabilitado, com o motivo do servidor.
    expect(text(note ?? '')).toContain('Melhore antes o Salão do Senhor para o nível 2.');
    expect(buttons(note ?? '')).toEqual([
      '<button type="button" disabled>Construir Celeiro</button>',
    ]);
    // Exatamente 8 horas não é "antes de uma ausência acabar": sem destaque.
    const calm = fief({ view: withResource(view, 'food', { fullInSeconds: 8 * 3600 }) });
    expect(row(calm, 'Comida')).toContain('<span class="muted">cheio em 8 h</span>');
    expect(calm).not.toContain('storage-notes');
  });

  it('cheio: diz que a produção está se perdendo, quanto, o que fazer, e põe o botão ao lado', () => {
    const page = fief({ view: woodFull });
    expect(text(row(page, 'Madeira'))).toContain('cheio: a produção está se perdendo');
    expect(row(page, 'Madeira')).toContain('codicon-warning');
    // A taxa continua sendo o saldo da produção; o que se perde vem na frase do servidor.
    expect(row(page, 'Madeira')).toContain('+72');
    const [note] = notes(page);
    expect(text(note ?? '')).toContain(
      'Pátio cheio: 72/h de madeira indo ao chão. Construa o Armazém ou gaste madeira. Hoje já se perderam 24.',
    );
    expect(text(note ?? '')).toContain(
      '160 madeira, 80 pedra · 10 min · Capacidade de madeira e de pedra: 500 → 900 cada.',
    );
    expect(buttons(note ?? '')).toEqual(['<button type="button">Construir Armazém</button>']);
  });

  it('a madeira e a pedra dividem o Armazém: um aviso, as duas frases, um botão', () => {
    const page = fief({ view: bothFull });
    const found = notes(page);
    expect(found).toHaveLength(1);
    expect(text(found[0] ?? '')).toContain('72/h de madeira indo ao chão');
    expect(text(found[0] ?? '')).toContain('15/h de pedra indo ao chão');
    expect(buttons(found[0] ?? '')).toHaveLength(1);
    // Sem perda anotada no dia, a frase do servidor vai sozinha.
    expect(text(found[0] ?? '')).not.toContain('Hoje já se perderam 0');
  });

  it('o botão do aviso pede a obra pelo comando de construir, com o edifício do recurso', () => {
    const ran: Array<[string, unknown]> = [];
    const recording: Actions = { ...actions, run: (id, arg) => ran.push([id, arg]) };
    type VNodeLike = { type?: unknown; props?: Record<string, unknown> };
    // Percorre a árvore de componentes (sem ganchos) e clica em todos os botões habilitados.
    const click = (node: unknown): void => {
      if (Array.isArray(node)) {
        node.forEach(click);
        return;
      }
      if (typeof node !== 'object' || node === null) {
        return;
      }
      const { type, props } = node as VNodeLike;
      if (typeof type === 'function') {
        click((type as (props: unknown) => unknown)(props));
        return;
      }
      if (type === 'button' && typeof props?.onClick === 'function' && props.disabled !== true) {
        (props.onClick as () => void)();
      }
      click(props?.children);
    };
    click(<ResourcesTable view={bothFull} disabled={false} actions={recording} />);
    expect(ran).toEqual([['lords.build', 'warehouse']]);
    // Sem ligação, nem esse botão manda nada.
    ran.length = 0;
    click(<ResourcesTable view={bothFull} disabled={true} actions={recording} />);
    expect(ran).toEqual([]);
    expect(buttons(notes(fief({ view: bothFull, online: false }))[0] ?? '')).toEqual([
      '<button type="button" disabled>Construir Armazém</button>',
    ]);
  });

  it('com o depósito já erguido, o botão é "Ampliar"; sem recursos, diz o que falta', () => {
    const built = withResource(
      withUpgrade(unlockedView, 'granary', { fromLevel: 1, targetLevel: 2 }),
      'food',
      {
        stock: 900,
        cap: 900,
        capBreakdown: 'Celeiro Nv1: 900',
        storageLabel: 'Celeiro',
        perHour: 31,
        full: true,
        fullInSeconds: null,
        fullNote: 'Celeiro cheio: 31/h de comida indo ao chão. Amplie o Celeiro ou gaste comida.',
        wastingPerHour: 31,
      },
    );
    const page = fief({ view: built });
    // O nome do lugar não se repete na explicação do limite.
    expect(row(page, 'Comida')).toContain('data-tip="Celeiro Nv1: 900"');
    const [note] = notes(page);
    expect(buttons(note ?? '')).toEqual([
      '<button type="button" disabled>Ampliar Celeiro</button>',
    ]);
    expect(text(note ?? '')).toContain('Faltam 116 madeira e 58 pedra.');
  });

  it('com a obra do depósito em andamento, o aviso fica e o botão some', () => {
    const building: ViewState = {
      ...withResource(woodFull, 'wood', {
        fullNote:
          'Pátio cheio: 72/h de madeira indo ao chão. A obra do Armazém já vai abrir espaço.',
      }),
      constructions: {
        ...woodFull.constructions,
        available: woodFull.constructions.available.filter(
          (upgrade) => upgrade.building !== 'warehouse',
        ),
      },
    };
    const [note] = notes(fief({ view: building }));
    expect(text(note ?? '')).toContain('A obra do Armazém já vai abrir espaço.');
    expect(buttons(note ?? '')).toEqual([]);
  });

  it('antes do Salão Nv2, a frase do servidor já diz o que trava: o motivo não se repete', () => {
    const locked = withResource(view, 'wood', {
      stock: 500,
      perHour: 24,
      full: true,
      fullNote:
        'Pátio cheio: 24/h de madeira indo ao chão. Melhore antes o Salão do Senhor para o nível 2. Até lá, gaste madeira.',
      wastingPerHour: 24,
    });
    const [note] = notes(fief({ view: locked }));
    expect(text(note ?? '').split('Melhore antes o Salão do Senhor para o nível 2.')).toHaveLength(
      2,
    );
    expect(buttons(note ?? '')).toEqual([
      '<button type="button" disabled>Construir Armazém</button>',
    ]);
  });

  it('estoque herdado acima do limite: "cheio", com a explicação de por que nada entra', () => {
    const inherited = withResource(view, 'wood', {
      stock: 640,
      perHour: 0,
      full: true,
      fullNote:
        'Pátio cheio: há mais madeira do que cabe, e nada entra até o estoque baixar de 500.',
    });
    const page = fief({ view: inherited });
    expect(row(page, 'Madeira')).toContain(
      'data-tip="Pátio cheio: há mais madeira do que cabe, e nada entra até o estoque baixar de 500."',
    );
    expect(text(row(page, 'Madeira'))).not.toContain('a produção está se perdendo');
    expect(text(notes(page)[0] ?? '')).toContain('nada entra até o estoque baixar de 500');
    // No limite exato e sem nada a entrar não há frase: só "cheio".
    const still = fief({ view: withResource(view, 'wood', { stock: 500, full: true }) });
    expect(row(still, 'Madeira')).toContain('<span class="muted">cheio</span>');
    expect(still).not.toContain('storage-notes');
  });

  it('subindo sem previsão de encher, "crescendo" explica por quê', () => {
    const autumn = fief({ view: autumnView });
    expect(row(autumn, 'Comida')).toContain(
      'data-tip="Não enche antes da virada para o Inverno.">crescendo',
    );
    expect(row(autumn, 'Comida')).toContain('data-tip="Celeiro Nv3: 2.100">2.100');
    expect(autumn).not.toContain('storage-notes');
    // O ouro não tem limite: cresce, e não há o que explicar.
    expect(row(autumn, 'Ouro')).toContain('<span class="muted">crescendo</span>');
  });

  it('o que acaba passa na frente do que enche', () => {
    const page = fief({
      view: withResource(initialView, 'food', { full: true, fullNote: null }),
    });
    expect(text(row(page, 'Comida'))).toContain('acaba em 36 h');
    expect(text(row(page, 'Comida'))).not.toContain('cheio');
  });

  it('o Celeiro e o Armazém aparecem em "Construir", com o que mudam e o motivo do bloqueio', () => {
    const construct = (page: string) => page.split('<h3>Construir</h3>')[1] ?? '';
    const locked = fief();
    expect(locked).toContain('<h3>Melhorar</h3>');
    const lockedList = text(construct(locked));
    expect(lockedList).toContain('Celeiro · 10 min');
    expect(lockedList).toContain('Capacidade de comida: 500 → 900.');
    expect(lockedList).toContain('Capacidade de madeira e de pedra: 500 → 900 cada.');
    expect(lockedList).toContain('Melhore antes o Salão do Senhor para o nível 2.');
    // Nada de "Nv0": o que não existe se constrói.
    expect(locked).not.toContain('Nv0');
    expect(construct(locked)).toContain(
      'disabled aria-label="Construir Celeiro">Construir</button>',
    );
    expect(construct(locked)).toContain('aria-label="Planejar Armazém"');
    // Os edifícios que já existem continuam em "Melhorar", e os novos não entram lá.
    const improve = locked.split('<h3>Melhorar</h3>')[1]?.split('<h3>Construir</h3>')[0] ?? '';
    expect(improve).toContain('aria-label="Melhorar Fazenda"');
    expect(improve).not.toContain('Celeiro');

    // Liberado e pago: o botão se oferece.
    const open = construct(fief({ view: affordable }));
    expect(open).toMatch(
      /<button type="button" aria-label="Construir Armazém">Construir<\/button>/,
    );
    // Liberado e sem recursos: o que falta, em texto.
    expect(text(construct(fief({ view: unlockedView })))).toContain(
      'Faltam 116 madeira e 58 pedra.',
    );
  });

  it('um custo que não cabe no depósito mostra o motivo que veio do servidor', () => {
    const reason =
      'A obra pede 875 de madeira e o Pátio só guarda 500: construa o Armazém primeiro.';
    const page = fief({
      view: withUpgrade(view, 'townHall', {
        blockedCode: 'EXCEEDS_STORAGE',
        blockedReason: reason,
      }),
    });
    expect(page).toContain(`<span class="blocked">${reason}</span>`);
    expect(page).toContain('disabled aria-label="Melhorar Salão do Senhor"');
  });

  it('uma obra planejada do que ainda não existe também não fala em "Nv0"', () => {
    const page = fief({ view: withPlanned(unlockedView, [{ building: 'granary' }]) });
    expect(page).toContain('<span class="upgrade-name">Construir: Celeiro<span class="muted">');
    expect(page).not.toContain('Nv0');
  });

  it('cancelar perto do limite: diz o que volta e o que se perderia', () => {
    const active = (refund: NonNullable<ViewState['constructions']['active']>['refund']) =>
      fief({
        view: withQueues(view, [
          activeConstruction({
            secondsRemaining: 180,
            totalSeconds: 300,
            progressPercent: 40,
            refund,
          }),
        ]),
      });
    const tight = active([
      { resource: 'wood', label: 'Madeira', amount: 30, lost: 34 },
      { resource: 'stone', label: 'Pedra', amount: 16, lost: 0 },
    ]);
    expect(tight).toContain(
      'Cancelar devolve 30 madeira e 16 pedra. Não cabem no depósito e se perderiam: 34 madeira.',
    );
    expect(tight).toContain(
      'title="Devolve 30 madeira e 16 pedra. Não cabem no depósito e se perderiam: 34 madeira."',
    );
    // Depósito cheio: nada entra, e a tela diz isso em vez de "devolve 0".
    const none = active([{ resource: 'wood', label: 'Madeira', amount: 0, lost: 64 }]);
    expect(none).toContain(
      'Nada volta ao estoque. Não cabem no depósito e se perderiam: 64 madeira.',
    );
  });

  it('o objetivo do Salão diz o que ele libera', () => {
    expect(fief({ view: unlockedView })).toContain(
      'Recompensa: desbloqueia o Celeiro e o Armazém.',
    );
  });
});

describe('aba Feudo: filas de obras e planejadas (GDD §6.3)', () => {
  const text = (markup: string) =>
    markup
      .replace(/<[^>]+>/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  /** As linhas da lista de filas, uma por fila aberta e, se houver, a da fila ainda fechada. */
  const queues = (page: string) =>
    /<ul class="queues"[^>]*>(.*?)<\/ul>/.exec(page)?.[1]?.match(/<li .*?<\/li>/g) ?? [];
  /** As planejadas, na ordem em que a página as mostra. */
  const plans = (page: string) =>
    /<ol class="upgrades"[^>]*>(.*?)<\/ol>/.exec(page)?.[1]?.match(/<li .*?<\/li>/g) ?? [];
  const mark = (plan: string) => /<input[^>]*>/.exec(plan)?.[0] ?? '';

  type VNodeLike = { type?: unknown; props?: Record<string, unknown> };
  /**
   * Aciona, sem navegador, o controle com este nome: percorre a árvore de componentes (nenhum
   * deles usa ganchos) e chama o `onClick` de quem tem o `aria-label`, se não estiver desabilitado.
   */
  const press = (node: unknown, label: string): boolean => {
    if (Array.isArray(node)) {
      return node.some((child) => press(child, label));
    }
    if (typeof node !== 'object' || node === null) {
      return false;
    }
    const { type, props } = node as VNodeLike;
    if (typeof type === 'function') {
      return press((type as (props: unknown) => unknown)(props), label);
    }
    if (props?.['aria-label'] === label && typeof props.onClick === 'function') {
      if (props.disabled !== true) {
        (props.onClick as (event: { preventDefault(): void }) => void)({ preventDefault() {} });
      }
      return true;
    }
    return press(props?.children, label);
  };
  const ordering = (shown: ViewState, disabled = false) => {
    const orders: Array<[string, unknown]> = [];
    const recording: Actions = {
      ...actions,
      order: (type, payload) => orders.push([type, payload]),
    };
    const panel = (
      <ConstructionsPanel
        constructions={shown.constructions}
        elapsed={0}
        disabled={disabled}
        actions={recording}
      />
    );
    return { orders, press: (label: string) => press(panel, label) };
  };

  it('uma fila só: os pedreiros livres e, logo abaixo, o que abre a segunda, sem botão morto', () => {
    const [free, locked, ...rest] = queues(fief({ view: initialView }));
    expect(rest).toEqual([]);
    expect(text(free ?? '')).toBe('Os pedreiros estão livres.');
    // A frase é a do servidor; o cadeado acompanha o texto, não o substitui.
    expect(text(locked ?? '')).toBe('A segunda fila abre com o Salão do Senhor Nv4.');
    expect(locked).toContain('codicon-lock');
    expect(locked).not.toContain('<button');
    // Com uma fila só, ninguém precisa de número de fila.
    expect(free).not.toContain('Fila 1');
  });

  it('uma fila só, ocupada: a obra e o motivo da segunda fila continuam lado a lado', () => {
    const [busy, locked] = queues(fief({ view: withQueues(view, [activeConstruction()]) }));
    expect(text(busy ?? '')).toContain('Serraria → Nv2');
    expect(text(busy ?? '')).not.toContain('Fila');
    expect(text(locked ?? '')).toBe('A segunda fila abre com o Salão do Senhor Nv4.');
  });

  it('duas filas abertas: uma linha por fila, cada uma com número, prazo, progresso e Cancelar', () => {
    const page = fief({ view: queuesView });
    const [first, second, ...rest] = queues(page);
    expect(rest).toEqual([]);
    expect(text(first ?? '')).toContain('Fila 1Serraria → Nv203:00Cancelar');
    expect(text(second ?? '')).toContain('Fila 2Mina de Ouro → Nv206:00Cancelar');
    expect(first).toContain('aria-label="Cancelar a obra: Serraria"');
    expect(second).toContain('aria-label="Cancelar a obra: Mina de Ouro"');
    expect(first).toContain('aria-label="Obra de Serraria: 40% concluída"');
    expect(second).toContain('aria-label="Obra de Mina de Ouro: 25% concluída"');
    expect(second).toContain('Cancelar devolve 96 madeira e 64 pedra.');
    // Com as duas abertas, não há fila fechada a explicar.
    expect(page).not.toContain('queue-locked');
    expect(page).not.toContain('A segunda fila abre');
  });

  it('duas filas, uma livre: a linha da fila livre diz de quem são os pedreiros parados', () => {
    const [first, second] = queues(
      fief({ view: withQueues(queuesView, [null, activeConstruction()]) }),
    );
    expect(text(first ?? '')).toBe('Fila 1Os pedreiros estão livres.');
    expect(text(second ?? '')).toContain('Fila 2Serraria → Nv2');
  });

  it('cada fila desconta o seu prazo com o relógio da página', () => {
    const [first, second] = queues(fief({ view: queuesView, elapsed: 90 }));
    expect(text(first ?? '')).toContain('01:30');
    expect(text(second ?? '')).toContain('04:30');
  });

  it('cancelar manda a obra da linha em que o botão está', () => {
    const { orders, press } = ordering(queuesView);
    expect(press('Cancelar a obra: Mina de Ouro')).toBe(true);
    expect(orders).toEqual([['cancelConstruction', { building: 'goldMine' }]]);
  });

  it('as planejadas vêm na ordem da lista, com a marca, o custo, o prazo e o que cada uma espera', () => {
    const page = fief({ view: queuesView });
    expect(page).toContain(
      'As marcadas começam sozinhas, na ordem da lista, assim que houver recursos e pedreiros livres.',
    );
    const rows = plans(page);
    expect(rows.map((row) => /class="upgrade-name">([^<]*)</.exec(row)?.[1])).toEqual([
      'Serraria Nv2 → Nv3',
      'Habitações Nv1 → Nv2',
      'Fazenda Nv1 → Nv2',
      'Salão do Senhor Nv4 → Nv5',
      'Pedreira Nv5 → Nv6',
    ]);
    // A frase é a do servidor, com maiúscula e ponto; o prazo entra só quando há um.
    expect(
      rows.map((row) => text(/class="plan-waiting">(.*?)<\/span><\/li>/.exec(row)?.[1] ?? '')),
    ).toEqual([
      'Espera a obra da Serraria terminar: em 3 min.',
      'Espera os pedreiros terminarem outra obra: em 3 min.',
      'Espera 15 de ouro: em 1 h 51 min.',
      'Não cabe no Pátio: construa o Armazém.',
      'Espera o Salão do Senhor chegar ao nível 5: melhore-o.',
    ]);
    // A marca é uma caixa de seleção com nome próprio; só a das Habitações está desligada.
    expect(rows.map((row) => /aria-label="([^"]*)"/.exec(mark(row))?.[1])).toEqual([
      'Iniciar quando houver recursos: Serraria',
      'Iniciar quando houver recursos: Habitações',
      'Iniciar quando houver recursos: Fazenda',
      'Iniciar quando houver recursos: Salão do Senhor',
      'Iniciar quando houver recursos: Pedreira',
    ]);
    expect(rows.map((row) => /\bchecked\b/.test(mark(row)))).toEqual([
      true,
      false,
      true,
      true,
      true,
    ]);
    expect(rows.every((row) => text(row).includes('Iniciar quando houver recursos'))).toBe(true);
    // O custo fica na linha, com o que falta por extenso, e o prazo da obra ao lado do nome.
    expect(text(rows[2] ?? '')).toContain('Fazenda Nv1 → Nv2 · 5 min');
    expect(text(rows[2] ?? '')).toContain('40 ouro (faltam 15)');
    // Nenhuma delas pode começar agora: não há "Iniciar agora" para oferecer.
    expect(page).not.toContain('Iniciar agora');
  });

  it('o prazo da espera desce com o relógio da página', () => {
    const [first, , third] = plans(fief({ view: queuesView, elapsed: 60 }));
    expect(text(first ?? '')).toContain('Espera a obra da Serraria terminar: em 2 min.');
    expect(text(third ?? '')).toContain('Espera 15 de ouro: em 1 h 50 min.');
  });

  it('uma manual que já pode começar diz isso e traz "Iniciar agora"', () => {
    const ready = withPlanned(view, [{ building: 'farm' }]);
    const [row, ...rest] = plans(fief({ view: ready }));
    expect(rest).toEqual([]);
    expect(text(row ?? '')).toContain('Pode começar agora.');
    expect(row).toContain('aria-label="Iniciar agora: Fazenda"');
    expect(/\bchecked\b/.test(mark(row ?? ''))).toBe(false);
    const { orders, press } = ordering(ready);
    expect(press('Iniciar agora: Fazenda')).toBe(true);
    expect(orders).toEqual([['startConstruction', { building: 'farm' }]]);
  });

  it('um clique na marca manda a ordem de ligar; outro, na marcada, a de desligar', () => {
    const { orders, press } = ordering(queuesView);
    expect(press('Iniciar quando houver recursos: Habitações')).toBe(true);
    expect(press('Iniciar quando houver recursos: Fazenda')).toBe(true);
    expect(press('Tirar da lista: Pedreira')).toBe(true);
    expect(orders).toEqual([
      ['setAutoStart', { building: 'housing', autoStart: true }],
      ['setAutoStart', { building: 'farm', autoStart: false }],
      ['unplanConstruction', { building: 'quarry' }],
    ]);
  });

  it('sem ligação, a marca e os botões da lista ficam travados e nada é enviado', () => {
    const offline = plans(fief({ view: queuesView, online: false }));
    expect(offline.every((row) => /\bdisabled\b/.test(mark(row)))).toBe(true);
    const { orders, press } = ordering(queuesView, true);
    expect(press('Iniciar quando houver recursos: Habitações')).toBe(true);
    expect(press('Cancelar a obra: Serraria')).toBe(true);
    expect(orders).toEqual([]);
  });

  it('sem planejadas, a lista e a explicação dela não aparecem', () => {
    const page = fief({ view });
    expect(page).not.toContain('Planejadas');
    expect(page).not.toContain('As marcadas começam sozinhas');
  });

  it('a obra já planejada não oferece "Planejar" de novo; as outras, sim', () => {
    const page = fief({ view: withPlanned(view, [{ building: 'farm', autoStart: true }]) });
    expect(page).not.toContain('aria-label="Planejar Fazenda"');
    expect(page).toContain('aria-label="Planejar Serraria"');
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
  const today = (shown: ReturnReport | null, online = true) =>
    html(
      <TodayTab
        view={view}
        elapsed={0}
        online={online}
        retryInSeconds={null}
        report={shown}
        actions={actions}
      />,
    );

  it('mostra o Relatório de Retorno e explica as decisões pendentes da v0.1', () => {
    const page = today(report);
    expect(page).toContain('Você esteve fora por <strong>5 horas</strong>');
    expect(page).toContain('+75');
    expect(page).toContain('Obras concluídas: 1');
    expect(page).toContain('os pedreiros ergueram as Habitações');
    expect(page).toContain('Nenhuma por agora.');
    expect(page).toContain('Marcar como lido');
    expect(page).toContain('Ir para o feudo');
  });

  it('sem estoques a comparar, diz por quê e mostra o resto do relatório', () => {
    const page = today({ ...report, resources: [] });
    expect(page).toContain('Você esteve fora por <strong>5 horas</strong>');
    expect(page).toContain('O jogo foi atualizado desde a sua última visita');
    expect(page).not.toContain('<table');
    expect(page).toContain('Obras concluídas: 1');
    expect(page).toContain('os pedreiros ergueram as Habitações');
    // Com estoques, a frase não aparece.
    expect(today(report)).not.toContain('O jogo foi atualizado');
    expect(today(report)).toContain('<table');
  });

  describe('produção, gasto e perda', () => {
    const text = (page: string) =>
      page
        .replace(/<[^>]+>/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    const cells = (page: string, label: string) =>
      [
        ...(
          new RegExp(`<tr><th scope="row">${label}</th>(.*?)</tr>`).exec(page)?.[1] ?? ''
        ).matchAll(/<td[^>]*>([^<]*)<\/td>/g),
      ].map((match) => match[1]);
    const ledger: ReturnReport = {
      ...report,
      resources: [
        {
          id: 'food',
          label: 'Comida',
          before: 180,
          after: 255,
          delta: 75,
          spent: 150,
          received: 14.8,
          wasted: 120,
          produced: 210.2,
        },
        {
          id: 'wood',
          label: 'Madeira',
          before: 320,
          after: 500,
          delta: 180,
          spent: 240,
          received: 30,
          wasted: 76,
          produced: 390,
        },
        {
          id: 'stone',
          label: 'Pedra',
          before: 200,
          after: 164,
          delta: -36,
          spent: 80,
          received: 0,
          wasted: 0,
          produced: 44,
        },
        {
          id: 'gold',
          label: 'Ouro',
          before: 270,
          after: 262,
          delta: -8,
          spent: 0,
          received: 0,
          wasted: 0,
          produced: -8,
        },
      ],
    };
    const page = today(ledger);

    it('a tabela abre a conta: antes, produção, gasto, recebido, perdido e agora', () => {
      const headers = [...page.matchAll(/<th scope="col"[^>]*>([^<]*)<\/th>/g)].map(
        (match) => match[1],
      );
      expect(headers).toEqual([
        'Recurso',
        'Antes',
        'Produção',
        'Gasto',
        'Recebido',
        'Perdido',
        'Agora',
      ]);
      // A produção é o que o feudo rendeu: o que entrou no estoque (390) mais o que não coube
      // (76). A perda aparece como perda, com sinal, e a conta fecha na linha.
      expect(cells(page, 'Madeira')).toEqual(['320', '+466', '−240', '+30', '−76', '500']);
      expect(cells(page, 'Comida')).toEqual(['180', '+330,2', '−150', '+14,8', '−120', '255']);
      // O que não houve fica como traço, e não como zero a ser lido.
      expect(cells(page, 'Pedra')).toEqual(['200', '+44', '−80', '—', '—', '164']);
      expect(cells(page, 'Ouro')).toEqual(['270', '−8', '—', '—', '—', '262']);
      expect(text(page)).toContain('Perdido é o que não coube no depósito e foi ao chão.');
      // Antes + produção − gasto + recebido − perdido = agora, em toda linha.
      const number = (cell: string | undefined) =>
        cell === '—'
          ? 0
          : Number((cell ?? '').replace('−', '-').replace('+', '').replace(',', '.'));
      for (const label of ['Comida', 'Madeira', 'Pedra', 'Ouro']) {
        const [before, ...rest] = cells(page, label).map(number);
        const after = rest.pop() ?? 0;
        expect((before ?? 0) + rest.reduce((sum, value) => sum + value, 0)).toBeCloseTo(after, 6);
      }
    });

    it('a linha de desperdício: o total de cada recurso, onde ele fica e o caminho para resolver', () => {
      const line = /<p class="waste" role="status">.*?<\/p>/.exec(page)?.[0] ?? '';
      // Os nomes dos lugares são os da visão de agora (Despensa e Pátio, sem os edifícios).
      expect(text(line)).toBe(
        'Foram ao chão, por falta de espaço: 120 de comida (Despensa) e 76 de madeira (Pátio). ' +
          'Ampliar o depósito ou gastar o que sobra estanca a perda. Ver os depósitos',
      );
      // Ícone e texto: a perda não é dita só pela cor.
      expect(line).toContain('codicon-warning');
      expect(page.match(/class="waste"/g)).toHaveLength(1);
    });

    it('um recurso só perdido: a frase não ganha "e"', () => {
      const one = today({
        ...ledger,
        resources: ledger.resources.map((row) => (row.id === 'food' ? { ...row, wasted: 0 } : row)),
      });
      expect(text(one)).toContain('Foram ao chão, por falta de espaço: 76 de madeira (Pátio).');
    });

    it('sem desperdício, a linha não aparece', () => {
      const none = today({
        ...ledger,
        resources: ledger.resources.map((row) => ({ ...row, wasted: 0 })),
      });
      expect(none).not.toContain('class="waste"');
      expect(none).not.toContain('Foram ao chão');
      // Um relatório sem as parcelas (montado por uma versão anterior) mostra a variação.
      expect(cells(today(report), 'Comida')).toEqual(['180', '+75', '—', '—', '—', '255']);
    });

    it('"Ver os depósitos" leva ao feudo, onde o aviso do depósito tem o botão', () => {
      const ran: Array<[string, unknown]> = [];
      const recording: Actions = { ...actions, run: (id, arg) => ran.push([id, arg]) };
      type VNodeLike = { type?: unknown; props?: Record<string, unknown> };
      const click = (node: unknown, label: string): void => {
        if (Array.isArray(node)) {
          node.forEach((child) => click(child, label));
          return;
        }
        if (typeof node !== 'object' || node === null) {
          return;
        }
        const { type, props } = node as VNodeLike;
        if (typeof type === 'function') {
          click((type as (props: unknown) => unknown)(props), label);
          return;
        }
        if (type === 'button' && props?.children === label) {
          (props.onClick as () => void)();
        }
        click(props?.children, label);
      };
      click(<Today report={ledger} view={view} actions={recording} />, 'Ver os depósitos');
      expect(ran).toEqual([['lords.openPanel', 'fief']]);
    });
  });

  it('sem relatório, diz quando ele aparece; com fome, avisa', () => {
    expect(today(null)).toContain('Nada de novo desde a sua última visita.');
    expect(today({ ...report, famine: 'started' })).toContain('a fome começou');
    expect(today(null, false)).toContain('Sem ligação com o reino.');
  });
});

describe('cores', () => {
  const names = Object.keys(sheets);
  const component = names.filter((name) => name !== THEMES_FILE);

  it('nenhuma cor fixa fora de theme/themes.css: só variáveis --vscode-*', () => {
    expect(names).toContain(THEMES_FILE);
    expect(component.sort()).toEqual(['../styles.css', '../workbench/workbench.css']);
    for (const name of component) {
      const styles = sheets[name] ?? '';
      expect(styles.length, name).toBeGreaterThan(1000);
      expect(styles, name).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
      expect(styles, name).not.toMatch(/\b(rgb|rgba|hsl|hsla|oklch|color-mix)\(/);
      const named = /:\s*(white|black|red|green|blue|gray|grey|yellow|orange)\s*[;!]/i;
      expect(styles, name).not.toMatch(named);
    }
    const styles = sheets['../styles.css'] ?? '';
    expect(styles).toContain('var(--vscode-foreground)');
    expect(styles).toContain('prefers-reduced-motion');
    expect(styles).toContain(':focus-visible');
  });

  it('toda variável usada tem valor nos três temas', () => {
    const themes = sheets[THEMES_FILE] ?? '';
    const blocks = {
      dark: themes.slice(
        themes.indexOf(":root[data-theme='dark']"),
        themes.indexOf(":root[data-theme='light']"),
      ),
      light: themes.slice(
        themes.indexOf(":root[data-theme='light']"),
        themes.indexOf(":root[data-theme='high-contrast']"),
      ),
      contrast: themes.slice(themes.indexOf(":root[data-theme='high-contrast']")),
    };
    const base = themes.slice(0, themes.indexOf(":root[data-theme='dark']"));
    const used = new Set<string>();
    for (const name of component) {
      // Uma variável com valor reserva (`var(--x, …)`) também precisa existir nos temas.
      for (const match of (sheets[name] ?? '').matchAll(/var\((--vscode-[A-Za-z-]+)/g)) {
        used.add(match[1] ?? '');
      }
    }
    expect(used.size).toBeGreaterThan(40);
    for (const variable of used) {
      for (const [theme, block] of Object.entries(blocks)) {
        const defined = block.includes(`${variable}:`) || base.includes(`${variable}:`);
        expect(defined, `${variable} no tema ${theme}`).toBe(true);
      }
    }
  });
});
