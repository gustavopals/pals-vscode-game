import type { ViewState } from '@lotg/protocol';
import type { ComponentChild } from 'preact';
import { renderToString } from 'preact-render-to-string';
import { describe, expect, it } from 'vitest';

import { FiefTab } from '../tabs/Fief';
import {
  autumnView,
  initialView,
  lateObjectivesView,
  mealCard,
  proudView,
  unlockedView,
  withCards,
  withObjective,
  withUpgrade,
} from '../test-helpers';
import type { Actions } from './actions';
import { ObjectivesPanel } from './ObjectivesPanel';
import { MoralePanel } from './Panels';
import { Today } from './Today';

// Os Objetivos do Senhor na tela (GDD §12.2; roadmap da v0.2, V2E-T4): até três em aberto, cada
// um com a ação, o porquê, a recompensa, o que falta e o botão que leva até lá. As frases são
// as do servidor; aqui se confere que a tela as mostra, na ordem, e o que cada botão faz.

const noop = () => {};
const actions: Actions = { order: noop, run: noop, playNow: noop };
const html = (node: ComponentChild) => renderToString(<>{node}</>);

/** O texto sem as marcas; cada título, parágrafo, item, resumo e botão é um trecho à parte. */
const text = (markup: string) =>
  markup
    .replace(/<\/(h2|p|li|summary|button|span)>/g, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
const buttons = (markup: string) =>
  [...markup.matchAll(/<button([^>]*)>(.*?)<\/button>/g)].map((match) => ({
    label: (match[2] ?? '').replace(/<[^>]+>/g, ''),
    disabled: /\sdisabled/.test(match[1] ?? ''),
  }));
/** Os objetivos em aberto, um trecho de texto por item. */
const openItems = (markup: string) =>
  (markup.match(/<li class="objective">.*?<\/li>/g) ?? []).map(text);

const panel = (view: ViewState, overrides: Partial<{ online: boolean; brief: boolean }> = {}) =>
  html(<ObjectivesPanel view={view} online actions={actions} {...overrides} />);

type VNodeLike = { type?: unknown; props?: Record<string, unknown> };

const labelOf = (children: unknown): string =>
  Array.isArray(children)
    ? children.map(labelOf).join('')
    : typeof children === 'string'
      ? children
      : '';

/** Aciona os botões com este texto, percorrendo a árvore de elementos sem um navegador. */
function click(node: unknown, label: string): void {
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
  if (type === 'button' && labelOf(props?.children) === label && props?.disabled !== true) {
    (props?.onClick as () => void)();
  }
  click(props?.children, label);
}

/** O que os botões com este texto mandam executar. */
function ran(view: ViewState, label: string, brief = false): unknown[][] {
  const calls: unknown[][] = [];
  const spy: Actions = { ...actions, run: (id, arg) => calls.push([id, arg]) };
  click(<ObjectivesPanel view={view} online actions={spy} brief={brief} />, label);
  return calls;
}

describe('painel dos objetivos', () => {
  it('no começo: os três em aberto, com a ação, o porquê, a recompensa, o que falta e o botão', () => {
    const markup = panel(initialView);
    expect(markup).toContain('<section aria-labelledby="objectives-title">');
    // O título recebe o foco de quem chega pelo "Ver" de um aviso.
    expect(markup).toContain('<h2 id="objectives-title" tabindex="-1">Objetivos</h2>');
    expect(openItems(markup)).toEqual([
      '☐ Em aberto: Aloque 2 aldeões na Fazenda (0/2) Comida é o que mantém todo o resto. ' +
        'Recompensa: +20 ouro. Faltam 2 aldeões na Fazenda. Alocar na Fazenda',
      // Só falta a ordem: o custo e o prazo da obra ficam ao lado da recompensa.
      '☐ Em aberto: Inicie a melhoria das Habitações Sem teto, ninguém vem morar no feudo. ' +
        'Recompensa: +30 madeira. Pode começar agora: 80 madeira, 20 pedra · 4 min. ' +
        'Melhorar Habitações',
      '☐ Em aberto: Recrute 3 aldeões (0/3) Mais braços, mais colheita, mais madeira. ' +
        'Recompensa: +40 comida. Falta recrutar 3 aldeões. Recrutar aldeões',
    ]);
    // Nada cumprido ainda: a lista dos cumpridos nem aparece.
    expect(markup).not.toContain('<details');
  });

  it('os objetivos da v0.2: a Torre, a primeira carta e o depósito, com o que falta de cada um', () => {
    const markup = panel(unlockedView);
    expect(openItems(markup)).toEqual([
      '☐ Em aberto: Construa a Torre de Vigia Ver o inimigo é metade da batalha. ' +
        'Recompensa: +40 pedra. Faltam 99 madeira e 112 pedra. Ver as obras',
      // A recompensa de moral, com o prazo em dias de jogo e no relógio de quem joga.
      '☐ Em aberto: Responda à primeira carta do Conselho ' +
        'Quem se cala deixa o conselho decidir em seu lugar. ' +
        'Recompensa: +10 de moral por 1 dia de jogo (2 h). ' +
        'Nenhuma carta espera resposta: vale a próxima que o Conselho trouxer. Ver o Conselho',
      '☐ Em aberto: Construa o Celeiro ou o Armazém ' +
        'Amplie o estoque antes que a produção vá para o chão. ' +
        'Recompensa: +60 madeira. Faltam 139 madeira e 72 pedra. Ver as obras',
    ]);
    // "0/1" não aparece: o título já diz o que há a fazer.
    expect(markup).not.toContain('(0/1)');
    // Os cumpridos ficam recolhidos, com a contagem à vista e a lista inteira dentro.
    const done = /<details class="objectives-done">.*?<\/details>/.exec(markup)?.[0] ?? '';
    expect(done).not.toContain('<details class="objectives-done" open');
    expect(text(done)).toBe(
      'Cumpridos (4) ' +
        '☑ Cumprido: Aloque 2 aldeões na Fazenda Comida é o que mantém todo o resto. Recompensa: +20 ouro. ' +
        '☑ Cumprido: Inicie a melhoria das Habitações Sem teto, ninguém vem morar no feudo. Recompensa: +30 madeira. ' +
        '☑ Cumprido: Recrute 3 aldeões Mais braços, mais colheita, mais madeira. Recompensa: +40 comida. ' +
        '☑ Cumprido: Alcance o Salão do Senhor Nv2 O Salão dita até onde os outros edifícios podem crescer. ' +
        'Recompensa: desbloqueia o Celeiro, o Armazém e a Torre de Vigia.',
    );
  });

  it('os três últimos: a obra marcada, a Paliçada travada e o inverno, que não tem botão', () => {
    const markup = panel(lateObjectivesView);
    expect(openItems(markup)).toEqual([
      '☐ Em aberto: Deixe uma obra marcada para começar sozinha ' +
        'A obra marcada começa assim que houver recursos, mesmo com o Senhor longe. ' +
        'Recompensa: +30 ouro. Só falta a sua ordem. Planejar obras',
      '☐ Em aberto: Construa a Paliçada Estaca firme faz o lobo recuar de barriga vazia. ' +
        'Recompensa: +100 madeira. Melhore antes o Salão do Senhor para o nível 3. Ver as obras',
      '☐ Em aberto: Atravesse o inverno sem passar frio ' +
        'A lareira queima madeira o inverno inteiro: guarde lenha no outono. ' +
        'Recompensa: +15 de moral por 1 dia de jogo (2 h). Falta o Inverno chegar e passar sem frio.',
    ]);
    expect(text(markup)).toContain('Cumpridos (7)');
  });

  it('o que falta e o que só espera a ordem têm ícones diferentes, e a frase ao lado', () => {
    const markup = panel(initialView);
    // O relógio de quem espera, ao lado do que falta; a seta, ao lado do que já pode ser feito.
    expect(markup).toContain(
      '<p class="objective-note"><span class="codicon codicon-watch" aria-hidden="true"></span> Faltam 2 aldeões na Fazenda.</p>',
    );
    expect(markup).toContain(
      '<p class="objective-note objective-ready"><span class="codicon codicon-arrow-right" aria-hidden="true"></span> Pode começar agora: 80 madeira, 20 pedra · 4 min.</p>',
    );
  });

  it('cada botão é descrito pelo objetivo dele: há dois "Ver as obras" na mesma lista', () => {
    const markup = panel(unlockedView);
    expect(markup).toContain('<div class="objective-text" id="objective-buildWatchtower">');
    expect(markup).toContain(
      '<button type="button" class="secondary" aria-describedby="objective-buildWatchtower">Ver as obras</button>',
    );
    expect(markup).toContain(
      '<button type="button" class="secondary" aria-describedby="objective-buildGranaryOrWarehouse">Ver as obras</button>',
    );
  });

  it('os botões levam ao comando de cada objetivo, com o argumento certo', () => {
    expect(ran(initialView, 'Alocar na Fazenda')).toEqual([['lords.allocateWorkers', 'farm']]);
    expect(ran(initialView, 'Melhorar Habitações')).toEqual([['lords.build', 'housing']]);
    expect(ran(initialView, 'Recrutar aldeões')).toEqual([['lords.recruit', undefined]]);
    expect(ran(unlockedView, 'Ver o Conselho')).toEqual([['lords.openPanel', 'council']]);
    // Os dois objetivos de obra travada levam ao mesmo painel.
    expect(ran(unlockedView, 'Ver as obras')).toEqual([
      ['lords.openPanel', 'constructions'],
      ['lords.openPanel', 'constructions'],
    ]);
    expect(ran(lateObjectivesView, 'Planejar obras')).toEqual([
      ['lords.planConstruction', undefined],
    ]);
    // Com a obra liberada, o botão a ordena pelo nome que a visão dá.
    const freed = withObjective(
      withUpgrade(unlockedView, 'watchtower', { blockedReason: null }),
      'buildWatchtower',
      { missing: null },
    );
    expect(ran(freed, 'Construir Torre de Vigia')).toEqual([['lords.build', 'watchtower']]);
    // Com carta na mesa, o botão leva a decidir.
    const waiting = withObjective(withCards(unlockedView, [mealCard]), 'answerFirstCard', {
      missing: null,
    });
    expect(ran(waiting, 'Decidir no Conselho')).toEqual([['lords.openPanel', 'council']]);
  });

  it('sem ligação, os botões que dão ordens ficam desabilitados; os que só navegam continuam', () => {
    expect(buttons(panel(initialView, { online: false }))).toEqual([
      { label: 'Alocar na Fazenda', disabled: true },
      { label: 'Melhorar Habitações', disabled: true },
      { label: 'Recrutar aldeões', disabled: true },
    ]);
    expect(buttons(panel(unlockedView, { online: false }))).toEqual([
      { label: 'Ver as obras', disabled: false },
      { label: 'Ver o Conselho', disabled: false },
      { label: 'Ver as obras', disabled: false },
    ]);
    expect(buttons(panel(lateObjectivesView, { online: false }))).toEqual([
      { label: 'Planejar obras', disabled: true },
      { label: 'Ver as obras', disabled: false },
    ]);
  });

  it('todos cumpridos, ou os seguintes ainda por revelar: uma frase que vale para os dois', () => {
    const markup = panel(autumnView);
    expect(openItems(markup)).toEqual([]);
    expect(text(markup)).toContain(
      'Nenhum objetivo em aberto agora: o que havia a cumprir está cumprido.',
    );
    expect(text(markup)).toContain('Cumpridos (10)');
    expect(buttons(markup)).toEqual([]);
    // A partida que acaba de chegar de uma versão anterior pode vir uma leitura sem os ativos:
    // é um estado normal, com a mesma frase, e não um erro.
    const between: ViewState = {
      ...unlockedView,
      objectives: unlockedView.objectives.filter((objective) => objective.status === 'completed'),
    };
    expect(text(panel(between))).toBe(
      'Objetivos Nenhum objetivo em aberto agora: o que havia a cumprir está cumprido. ' +
        text(/<details.*<\/details>/.exec(panel(between))?.[0] ?? ''),
    );
    expect(text(panel({ ...initialView, objectives: [] }))).toBe(
      'Objetivos Nenhum objetivo por agora.',
    );
  });

  it('nenhum estilo embutido, e nenhuma cor fora das classes', () => {
    for (const view of [initialView, unlockedView, lateObjectivesView, autumnView]) {
      expect(panel(view)).not.toMatch(/style=/);
      expect(panel(view, { brief: true })).not.toMatch(/style=/);
    }
  });
});

describe('os objetivos na aba Feudo', () => {
  const fief = (view: ViewState, online = true) =>
    html(
      <FiefTab
        view={view}
        elapsed={0}
        online={online}
        retryInSeconds={null}
        chronicle={[]}
        actions={actions}
      />,
    );

  it('o painel fica depois da Ameaça e antes da Crônica, com os cumpridos recolhidos', () => {
    const markup = fief(unlockedView);
    const threat = markup.indexOf('id="threat-title"');
    const objectives = markup.indexOf('id="objectives-title"');
    const chronicle = markup.indexOf('id="chronicle-title"');
    expect(objectives).toBeGreaterThan(threat);
    expect(chronicle).toBeGreaterThan(objectives);
    expect(markup).toContain('<details class="objectives-done">');
    expect(markup).toContain('Construa a Torre de Vigia');
  });

  it('o título das Construções recebe o foco de quem chega por "Ver as obras"', () => {
    expect(fief(unlockedView)).toContain(
      '<h2 id="constructions-title" tabindex="-1">Construções</h2>',
    );
  });

  it('o prêmio em moral aparece no painel da Moral, com o nome que o servidor deu e o prazo', () => {
    // Depois de responder à primeira carta: o efeito passageiro do objetivo, como a visão o traz.
    const rewarded: ViewState = {
      ...proudView,
      morale: {
        ...proudView.morale,
        effects: [{ label: 'O Senhor ouviu o Conselho', amount: 10, endsInSeconds: 2400 }],
      },
    };
    expect(text(html(<MoralePanel morale={rewarded.morale} elapsed={0} />))).toContain(
      'Passageiro: O Senhor ouviu o Conselho (+10), por mais 40 min.',
    );
  });
});

describe('os objetivos na aba Hoje', () => {
  const today = (view: ViewState, online = true) =>
    html(<Today report={null} view={view} online={online} actions={actions} />);
  const section = (markup: string) =>
    /<section aria-labelledby="objectives-title">.*?<\/section>/.exec(markup)?.[0] ?? '';

  it('até três em aberto, com o mesmo desenho do painel; os cumpridos viram contagem', () => {
    const markup = section(today(unlockedView));
    expect(openItems(markup)).toEqual(openItems(panel(unlockedView)));
    expect(openItems(markup)).toHaveLength(3);
    expect(markup).not.toContain('<details');
    expect(text(markup)).toContain('4 já cumpridos. Ver todos');
    // "Ver todos" leva à lista inteira, no feudo.
    expect(ran(unlockedView, 'Ver todos', true)).toEqual([['lords.openPanel', 'objectives']]);
  });

  it('no começo não há contagem: nada foi cumprido ainda', () => {
    const markup = section(today(initialView));
    expect(openItems(markup)).toHaveLength(3);
    expect(text(markup)).not.toContain('cumprido');
  });

  it('um cumprido só: a contagem no singular', () => {
    const one: ViewState = {
      ...unlockedView,
      objectives: unlockedView.objectives.filter(
        (objective) => objective.status === 'active' || objective.id === 'allocateFarmers',
      ),
    };
    expect(text(section(today(one)))).toContain('1 já cumprido. Ver todos');
  });

  it('com tudo cumprido, a seção diz isso em uma linha, com o caminho para a lista', () => {
    expect(text(section(today(autumnView)))).toBe(
      'Objetivos Nenhum objetivo em aberto agora: o que havia a cumprir está cumprido. ' +
        '10 já cumpridos. Ver todos',
    );
  });

  it('sem ligação, só o que navega continua valendo', () => {
    expect(buttons(section(today(initialView, false))).every((button) => button.disabled)).toBe(
      true,
    );
    expect(buttons(section(today(unlockedView, false)))).toEqual([
      { label: 'Ver as obras', disabled: false },
      { label: 'Ver o Conselho', disabled: false },
      { label: 'Ver as obras', disabled: false },
      { label: 'Ver todos', disabled: false },
    ]);
  });
});
