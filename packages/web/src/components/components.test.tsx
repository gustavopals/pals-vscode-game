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
import { autumnView, catalogFixture, coldView, winterWith } from '../test-helpers';
import type { Actions } from './actions';
import {
  formatApprox,
  formatAway,
  formatCountdown,
  formatDuration,
  formatNumber,
  formatSigned,
  remaining,
} from './format';
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

  it('tabela de recursos com cap "—", taxa com sinal e a explicação do número', () => {
    expect(page).toContain('aria-live="polite"');
    expect(page).toMatch(
      /<th scope="row">Comida<\/th><td class="num">180<\/td><td class="num">—<\/td>/,
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
    const active = fief({ view: building });
    expect(active).toContain('Fazenda → Nv2');
    expect(active).toContain('03:00');
    expect(active).toContain('aria-label="Obra 40% concluída"');
    expect(active).toContain('Cancelar');
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
    expect(cold).toContain(`<p class="muted hint">${note}</p>`);
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
