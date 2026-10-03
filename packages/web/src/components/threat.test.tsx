import type { GameEvent, ViewState } from '@lotg/protocol';
import type { ComponentChild } from 'preact';
import { renderToString } from 'preact-render-to-string';
import { describe, expect, it } from 'vitest';

import golden from '../../../engine/src/__golden__/view-seed-pedra-alta.json';
import { buildReturnReport } from '../game/returnReport';
import { FiefTab } from '../tabs/Fief';
import {
  activeConstruction,
  craftsView,
  initialView,
  palisadeRaisedView,
  raidAftermathView,
  threatIncomingView,
  threatWatchedView,
  unlockedView,
  withPlanned,
  withQueues,
  withResource,
} from '../test-helpers';
import { formatApprox } from '../ui/format';
import type { WatchedThreat } from '../ui/threat';
import type { Actions } from './actions';
import { ConstructionsPanel } from './ConstructionsPanel';
import { Header } from './Header';
import { ThreatPanel } from './ThreatPanel';
import { Today } from './Today';
import { WorkersPanel } from './WorkersPanel';

const noop = () => {};
const actions: Actions = { order: noop, run: noop, playNow: noop };
const html = (node: ComponentChild) => renderToString(<>{node}</>);

/** O texto sem as marcas; cada título, parágrafo, item e botão é um trecho à parte. */
const text = (markup: string) =>
  markup
    .replace(/<\/(h2|h3|p|li|button)>/g, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
const buttons = (markup: string) =>
  [...markup.matchAll(/<button([^>]*)>(.*?)<\/button>/g)].map((match) => ({
    label: (match[2] ?? '').replace(/<[^>]+>/g, ''),
    disabled: /\sdisabled/.test(match[1] ?? ''),
  }));
const icons = (markup: string) =>
  [...markup.matchAll(/codicon codicon-([a-z-]+)/g)].map((match) => match[1]);

const panel = (
  view: ViewState,
  overrides: Partial<{ elapsed: number; disabled: boolean; actions: Actions }> = {},
) =>
  html(<ThreatPanel view={view} elapsed={0} disabled={false} actions={actions} {...overrides} />);

type VNodeLike = { type?: unknown; props?: Record<string, unknown> };

/** O texto de um elemento, juntando os pedaços de `{verbo} {nome}`. */
const labelOf = (children: unknown): string =>
  Array.isArray(children)
    ? children.map(labelOf).join('')
    : typeof children === 'string'
      ? children
      : '';

/** Aciona o botão com este texto, percorrendo a árvore de elementos sem um navegador. */
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

function watched(view: ViewState): WatchedThreat {
  if (!view.threat.known) {
    throw new Error('O golden deixou de trazer a Ameaça à vista.');
  }
  return view.threat;
}
const withThreat = (view: ViewState, patch: Partial<WatchedThreat>): ViewState => ({
  ...view,
  threat: { ...watched(view), ...patch },
});

/** A caixa da Torre e a da defesa, cada uma com o seu texto e o seu botão. */
const box = (markup: string, name: 'tower' | 'defense') =>
  new RegExp(`<div class="banner threat-${name}">.*?</div>(?:<button.*?</button>)?</div>`).exec(
    markup,
  )?.[0] ?? '';

/** A mesma visão sem a obra da Paliçada na lista: é o que a visão traz no teto desta versão. */
const withoutPalisadeWork = (view: ViewState): ViewState => ({
  ...view,
  constructions: {
    ...view.constructions,
    available: view.constructions.available.filter((upgrade) => upgrade.building !== 'palisade'),
  },
});

const towerUnderway = withQueues(initialView, [
  activeConstruction({
    building: 'watchtower',
    label: 'Torre de Vigia',
    targetLevel: 1,
    secondsRemaining: 500,
    totalSeconds: 720,
  }),
]);

describe('painel "Ameaça": sem a Torre de Vigia, a névoa e a saída ao lado', () => {
  it('diz que ninguém sabe, o que a Torre daria, quanto custa, e a defesa com a obra dela ao lado', () => {
    const markup = panel(craftsView);
    expect(markup).toContain('<section aria-labelledby="threat-title">');
    // O título recebe o foco quando "Ver a defesa" traz o jogador até o painel.
    expect(markup).toContain('<h2 id="threat-title" tabindex="-1">Ameaça</h2>');
    expect(text(markup)).toBe(
      [
        'Ameaça',
        'Sem uma Torre de Vigia, ninguém sabe o que ronda o feudo.',
        'Torre de Vigia Nv1: mostra a Ameaça com a explicação e avisa de uma incursão com 1 h de antecedência.',
        '120 madeira, 120 pedra, 50 ouro · 12 min',
        'Construir Torre de Vigia',
        // A defesa é conhecida com ou sem Torre: o que protege hoje, o que a obra passa a
        // segurar e quanto ela custa.
        'Sem Paliçada, nada segura um ataque.',
        'Paliçada Nv1: segura ataques leves, sem perda nem ferido; os médios passam, mas com metade do estrago.',
        '200 madeira, 50 pedra · 20 min',
        'Construir Paliçada',
      ].join(' '),
    );
    // O olho fechado para a névoa e o escudo para a defesa: o texto ao lado é quem fala.
    expect(icons(markup)).toEqual(['eye-closed', 'shield']);
    expect(buttons(markup)).toEqual([
      { label: 'Construir Torre de Vigia', disabled: false },
      { label: 'Construir Paliçada', disabled: false },
    ]);
    // Cada botão é descrito pelo que a obra dá e pelo custo: quem não vê a caixa ouve os dois.
    expect(markup).toContain('<button type="button" aria-describedby="threat-tower-terms">');
    expect(markup).toContain('<div id="threat-tower-terms"><p>Torre de Vigia Nv1: mostra');
    expect(markup).toContain('<button type="button" aria-describedby="threat-defense-terms">');
    expect(markup).toContain(
      '<div id="threat-defense-terms"><p><span class="codicon codicon-shield" aria-hidden="true"></span> Sem Paliçada',
    );
  });

  it('não mostra número, barra, tendência, origem, tile, chance nem estrago: nada disso veio do servidor', () => {
    for (const view of [initialView, craftsView, unlockedView, towerUnderway]) {
      const markup = panel(view);
      expect(markup).not.toContain('<progress');
      expect(text(markup)).not.toMatch(/Ameaça \d/);
      expect(markup).not.toContain('Covil');
      expect(markup).not.toContain('/dia');
      expect(markup).not.toContain('O que ronda o feudo:');
      expect(markup).not.toContain('incursão agora');
      expect(markup).not.toContain('chance');
      expect(markup).not.toContain('threat-costs');
      expect(markup).not.toContain('threat-incoming');
    }
  });

  it('o botão ordena a obra da Torre pelo comando de construir, com o edifício que a visão diz', () => {
    const ran: Array<[string, unknown]> = [];
    click(
      <ThreatPanel
        view={craftsView}
        elapsed={0}
        disabled={false}
        actions={{ ...actions, run: (id, arg) => ran.push([id, arg]) }}
      />,
      'Construir Torre de Vigia',
    );
    expect(ran).toEqual([['lords.build', 'watchtower']]);
  });

  it('com a obra travada, o botão fica desabilitado e o motivo do servidor vem escrito', () => {
    // Antes do Salão Nv2: a Torre espera o nível 2, e a Paliçada, o nível 3.
    const gated = panel(initialView);
    expect(buttons(gated)).toEqual([
      { label: 'Construir Torre de Vigia', disabled: true },
      { label: 'Construir Paliçada', disabled: true },
    ]);
    expect(text(gated)).toContain(
      '120 madeira, 120 pedra, 50 ouro · 12 min Melhore antes o Salão do Senhor para o nível 2.',
    );
    expect(text(gated)).toContain(
      '200 madeira, 50 pedra · 20 min Melhore antes o Salão do Senhor para o nível 3.',
    );
    // O motivo tem a sua linha, com o cadeado ao lado do texto.
    expect(gated).toContain(
      '<p class="blocked"><span class="codicon codicon-lock" aria-hidden="true"></span> Melhore antes o Salão do Senhor para o nível 2.</p>',
    );
    expect(gated).toContain(
      '<p class="blocked"><span class="codicon codicon-lock" aria-hidden="true"></span> Melhore antes o Salão do Senhor para o nível 3.</p>',
    );
    expect(icons(gated)).toEqual(['eye-closed', 'lock', 'shield', 'lock']);
    // Com o Salão no nível 2 e sem recursos.
    const poor = panel(unlockedView);
    expect(buttons(box(poor, 'tower'))).toEqual([
      { label: 'Construir Torre de Vigia', disabled: true },
    ]);
    expect(text(box(poor, 'tower'))).toContain('Faltam 99 madeira e 112 pedra.');
  });

  it('sem ligação, os botões não dão ordem nenhuma', () => {
    expect(buttons(panel(craftsView, { disabled: true }))).toEqual([
      { label: 'Construir Torre de Vigia', disabled: true },
      { label: 'Construir Paliçada', disabled: true },
    ]);
  });

  it('com a Torre em obras: a contagem no lugar do botão, e a névoa continua até ela ficar pronta', () => {
    const markup = panel(towerUnderway);
    expect(buttons(box(markup, 'tower'))).toEqual([]);
    expect(text(markup)).toContain('Sem uma Torre de Vigia, ninguém sabe o que ronda o feudo.');
    expect(text(markup)).toContain(
      'Torre de Vigia → Nv1 em obras: termina em 08:20. Até lá, ninguém vê.',
    );
    // A contagem desce com o relógio da página e não fica em uma região viva.
    expect(text(panel(towerUnderway, { elapsed: 200 }))).toContain('termina em 05:00.');
    expect(markup).not.toContain('role="status"');
    expect(icons(markup)).toEqual(['eye-closed', 'tools', 'shield', 'lock']);
  });

  it('sem nada a dizer da Torre além da névoa, a caixa dela não fica vazia na tela', () => {
    const bare: ViewState = {
      ...initialView,
      threat: {
        ...initialView.threat,
        watchtower: { ...initialView.threat.watchtower, next: null },
      },
      constructions: {
        ...initialView.constructions,
        available: initialView.constructions.available.filter(
          (upgrade) => upgrade.building !== 'watchtower',
        ),
      },
    };
    const markup = panel(withoutPalisadeWork(bare));
    expect(markup).not.toContain('threat-tower');
    expect(text(markup)).toBe(
      'Ameaça Sem uma Torre de Vigia, ninguém sabe o que ronda o feudo. Sem Paliçada, nada segura um ataque. Paliçada Nv1: segura ataques leves, sem perda nem ferido; os médios passam, mas com metade do estrago.',
    );
  });

  it('planejada, a espera do servidor fica ao lado do custo, e o botão continua lá', () => {
    const planned = withPlanned(unlockedView, [
      {
        building: 'watchtower',
        autoStart: true,
        waiting: { reason: 'resources', text: 'espera 99 de madeira', etaSeconds: 5400 },
      },
    ]);
    const markup = box(panel(planned), 'tower');
    expect(text(markup)).toContain(
      '120 madeira, 120 pedra, 50 ouro · 12 min Planejada, com início automático · espera 99 de madeira: em 1 h 30 min. Faltam 99 madeira e 112 pedra.',
    );
    expect(buttons(markup)).toEqual([{ label: 'Construir Torre de Vigia', disabled: true }]);
  });
});

describe('painel "Ameaça": com a Torre de Vigia, o que os vigias veem', () => {
  it('o número com a barra, a tendência, as origens, o que ronda, a chance de um ataque, a defesa e a Torre', () => {
    const markup = panel(threatWatchedView);
    const threat = watched(threatWatchedView);
    expect(text(markup)).toBe(
      [
        'Ameaça',
        'Ameaça 46 de 100.',
        'Sobe 5 a cada dia de jogo (40 min): na próxima virada, vai de 46 para 51. Faltam 35:40.',
        '+2/dia: Covil de Lobos',
        '+3/dia: outono',
        'O que ronda o feudo: Covil de Lobos (ativo).',
        'Os vigias não avistam nenhuma incursão agora.',
        // A regra das incursões, na frase do servidor: a chance, o prazo, o tamanho, a queda.
        'Se não houver outra a caminho, a próxima virada do dia tem 11% de chance de marcar uma incursão (a chance é o que a Ameaça passa de 40, em %); ela chega 2 h depois. Com a Ameaça abaixo de 70, o ataque é dos leves; a partir daí, dos médios. Toda incursão, repelida ou sofrida, baixa a Ameaça em 35.',
        // A defesa vem antes da Torre: é o que muda o desfecho de um ataque. O preço de não a
        // ter fica ao lado do preço da obra.
        'Sem Paliçada, nada segura um ataque.',
        'Paliçada Nv1: segura ataques leves, sem perda nem ferido; os médios passam, mas com metade do estrago.',
        'Ataques leves: levam 10% do estoque de comida e madeira e ferem 1 aldeão.',
        'Ataques médios: levam 15% do estoque de comida e madeira e ferem 2 aldeões.',
        'Quem se fere fica 40 min sem trabalhar e volta ao ofício sozinho. Um ataque com perdas tira 10 da moral por 2 dias de jogo (1 h 20 min).',
        '200 madeira, 50 pedra · 6 min 40 s',
        'Melhore antes o Salão do Senhor para o nível 3.',
        'Construir Paliçada',
        'Torre de Vigia Nv1: mostra a Ameaça com a explicação e avisa de uma incursão com 20 min de antecedência.',
        'Torre de Vigia Nv2: avisa com 40 min de antecedência (em vez de 20 min) e passa a dizer o tamanho da incursão.',
        '192 madeira, 192 pedra, 80 ouro · 6 min',
        'Melhorar Torre de Vigia',
      ].join(' '),
    );
    // As frases da regra e do estrago são as da visão: o app não escreve nenhum desses números.
    expect(text(markup)).toContain(threat.raidRisk);
    expect(threat.raidCosts.every((line) => text(markup).includes(line))).toBe(true);
    // A barra é a da visão, do zero ao máximo que o servidor mandou, com nome para quem não a vê.
    expect(markup).toContain('<progress max="100" value="46" aria-label="Ameaça: 46 de 100">');
    expect(markup).toContain('aria-label="De onde vem a subida da Ameaça"');
    expect(markup).toContain('aria-label="O que um ataque custa a um feudo sem defesa"');
    // A subida tem seta e verbo; a cor só reforça.
    expect(markup).toContain(
      '<span class="warning"><span class="codicon codicon-arrow-up" aria-hidden="true">',
    );
    expect(icons(markup)).toEqual(['eye', 'arrow-up', 'shield', 'lock', 'eye']);
    expect(buttons(markup)).toEqual([
      { label: 'Construir Paliçada', disabled: true },
      { label: 'Melhorar Torre de Vigia', disabled: false },
    ]);
  });

  it('o prazo da próxima virada desce com o relógio da página', () => {
    expect(text(panel(threatWatchedView, { elapsed: 140 }))).toContain('Faltam 33:20.');
    expect(text(panel(threatWatchedView, { elapsed: 99_999 }))).toContain('Faltam 00:00.');
  });

  it('"Melhorar" ordena a mesma obra, a da Torre', () => {
    const ran: Array<[string, unknown]> = [];
    click(
      <ThreatPanel
        view={threatWatchedView}
        elapsed={0}
        disabled={false}
        actions={{ ...actions, run: (id, arg) => ran.push([id, arg]) }}
      />,
      'Melhorar Torre de Vigia',
    );
    expect(ran).toEqual([['lords.build', 'watchtower']]);
  });

  it('com uma incursão à vista: o aviso com ícone e texto, o que ela custa, o que a defesa faz a ela e a contagem', () => {
    const markup = panel(threatIncomingView);
    const incoming = watched(threatIncomingView).incoming;
    expect(text(markup)).toContain(
      [
        'Lobos a caminho. Os vigias contam uma matilha grande. Chegada em 15:40.',
        // O custo deste ataque ao lado do que a Paliçada faz a ele, nas frases do servidor.
        'Sem defesa, uma matilha grande leva 15% do estoque de comida e madeira (hoje, 75 de comida e 65,9 de madeira) e fere 2 aldeões, que ficam 40 min sem trabalhar.',
        'Sem Paliçada, nada segura este ataque.',
        'Há uma incursão a caminho, e só há uma por vez: nenhuma outra é marcada até ela chegar. Toda incursão, repelida ou sofrida, baixa a Ameaça em 35.',
        // Logo abaixo do aviso, a defesa com a obra: é o que se pode fazer a respeito.
        'Sem Paliçada, nada segura um ataque.',
      ].join(' '),
    );
    expect(incoming).not.toBeNull();
    expect(text(markup)).toContain(incoming?.costText ?? 'falta o custo');
    expect(text(markup)).toContain(incoming?.defenseText ?? 'falta a defesa');
    expect(text(markup)).not.toContain('não avistam');
    // O custo deste ataque toma o lugar da lista do que cada tamanho custa.
    expect(markup).not.toContain('threat-costs');
    expect(markup).toContain('class="banner banner-warning threat-incoming"');
    // O que a defesa faz ao ataque leva o escudo ao lado do texto.
    expect(markup).toContain(
      '<p class="threat-holds"><span class="codicon codicon-shield" aria-hidden="true"></span> Sem Paliçada, nada segura este ataque.</p>',
    );
    // Só a frase é região viva: a contagem muda a cada segundo e fica fora dela.
    expect(markup).toContain(
      '<span role="status"><span class="codicon codicon-megaphone" aria-hidden="true"></span> <strong>Lobos a caminho. Os vigias contam uma matilha grande.</strong></span>',
    );
    expect(text(panel(threatIncomingView, { elapsed: 340 }))).toContain('Chegada em 10:00.');
    // No nível 1 os vigias ainda não distinguem o tamanho: a frase é a do servidor.
    const unsized = withThreat(threatIncomingView, {
      incoming:
        incoming === null
          ? null
          : {
              ...incoming,
              sizeText: null,
              text: 'Lobos a caminho. Daqui os vigias ainda não distinguem quantos são.',
            },
    });
    expect(text(panel(unsized))).toContain(
      'Lobos a caminho. Daqui os vigias ainda não distinguem quantos são. Chegada em 15:40.',
    );
  });

  it('com a Torre no teto desta versão não há obra a ordenar, e a frase do servidor diz por quê', () => {
    const markup = box(panel(threatIncomingView), 'tower');
    expect(buttons(markup)).toEqual([]);
    expect(text(markup)).toBe(
      'Torre de Vigia Nv2: mostra a Ameaça com a explicação, avisa de uma incursão com 40 min de antecedência e diz o tamanho dela. Os níveis seguintes chegam em versões futuras do jogo.',
    );
  });

  it('com a Ameaça no máximo: sem prazo e sem seta de subida, só a frase do servidor', () => {
    const top = withThreat(threatWatchedView, {
      level: 100,
      nextLevel: 100,
      risePerDay: 0,
      text: 'Ameaça 100 de 100.',
      trend: 'Está no máximo: não sobe mais.',
      sources: [],
    });
    const markup = panel(top);
    expect(text(markup)).toContain('Ameaça 100 de 100. Está no máximo: não sobe mais. O que ronda');
    expect(text(markup)).not.toContain('Faltam');
    expect(icons(markup)).not.toContain('arrow-up');
    expect(markup).not.toContain('threat-sources');
    expect(markup).toContain('<progress max="100" value="100"');
  });

  it('com a melhoria da Torre em obras, a contagem toma o lugar do botão e os vigias continuam vendo', () => {
    const upgrading = withQueues(threatWatchedView, [
      activeConstruction({
        building: 'watchtower',
        label: 'Torre de Vigia',
        targetLevel: 2,
        secondsRemaining: 90,
        totalSeconds: 360,
      }),
    ]);
    const markup = panel(upgrading);
    expect(buttons(box(markup, 'tower'))).toEqual([]);
    expect(text(markup)).toContain('Ameaça 46 de 100.');
    expect(text(markup)).toContain('Torre de Vigia → Nv2 em obras: termina em 01:30.');
    expect(text(markup)).not.toContain('ninguém vê');
  });
});

describe('painel "Ameaça": a Paliçada, com a obra ao lado (GDD §8.2 e §12.3)', () => {
  it('"Construir Paliçada" ordena a obra pelo comando de construir, com o edifício que a visão diz', () => {
    const ran: Array<[string, unknown]> = [];
    click(
      <ThreatPanel
        view={craftsView}
        elapsed={0}
        disabled={false}
        actions={{ ...actions, run: (id, arg) => ran.push([id, arg]) }}
      />,
      'Construir Paliçada',
    );
    expect(ran).toEqual([['lords.build', 'palisade']]);
  });

  it('erguida: o que o nível segura, o que o próximo passa a segurar, o custo e "Melhorar"', () => {
    const markup = box(panel(palisadeRaisedView), 'defense');
    expect(text(markup)).toBe(
      [
        'Paliçada Nv1: segura ataques leves, sem perda nem ferido; os médios passam, mas com metade do estrago.',
        'Paliçada Nv2: passa a segurar também os ataques médios, sem perda nem ferido.',
        '320 madeira, 80 pedra · 10 min',
        // Com um ataque à vista, o prazo da obra fica ao lado do prazo dele.
        'A obra leva 10 min; o ataque chega em 15:40.',
        'Melhorar Paliçada',
      ].join(' '),
    );
    expect(buttons(markup)).toEqual([{ label: 'Melhorar Paliçada', disabled: false }]);
    // O prazo do ataque desce com o relógio da página.
    expect(text(box(panel(palisadeRaisedView, { elapsed: 340 }), 'defense'))).toContain(
      'A obra leva 10 min; o ataque chega em 10:00.',
    );
    const ran: Array<[string, unknown]> = [];
    click(
      <ThreatPanel
        view={palisadeRaisedView}
        elapsed={0}
        disabled={false}
        actions={{ ...actions, run: (id, arg) => ran.push([id, arg]) }}
      />,
      'Melhorar Paliçada',
    );
    expect(ran).toEqual([['lords.build', 'palisade']]);
  });

  it('com o ataque à vista, o aviso diz o que a Paliçada de hoje faz a ele', () => {
    expect(text(panel(palisadeRaisedView))).toContain(
      'A Paliçada Nv1 não segura um ataque deste tamanho: ele passa, mas com metade do estrago.',
    );
  });

  it('travada, a corrida com o ataque não aparece: o que importa é o motivo', () => {
    const markup = box(panel(threatIncomingView), 'defense');
    expect(text(markup)).toBe(
      [
        'Sem Paliçada, nada segura um ataque.',
        'Paliçada Nv1: segura ataques leves, sem perda nem ferido; os médios passam, mas com metade do estrago.',
        '200 madeira, 50 pedra · 6 min 40 s',
        'Melhore antes o Salão do Senhor para o nível 3.',
        'Construir Paliçada',
      ].join(' '),
    );
    expect(buttons(markup)).toEqual([{ label: 'Construir Paliçada', disabled: true }]);
  });

  it('em obras: a contagem no lugar do botão; se fica pronta a tempo, quem diz é o servidor', () => {
    const underway = withQueues(palisadeRaisedView, [
      activeConstruction({
        building: 'palisade',
        label: 'Paliçada',
        targetLevel: 2,
        secondsRemaining: 500,
        totalSeconds: 600,
      }),
    ]);
    const incoming = watched(underway).incoming;
    const inTime = withThreat(underway, {
      incoming:
        incoming === null
          ? null
          : {
              ...incoming,
              defenseText:
                'A Paliçada Nv2, que fica pronta a tempo, segura este ataque: sem perda nem ferido.',
            },
    });
    const markup = panel(inTime);
    expect(buttons(box(markup, 'defense'))).toEqual([]);
    expect(text(box(markup, 'defense'))).toContain('Paliçada → Nv2 em obras: termina em 08:20.');
    expect(text(box(markup, 'defense'))).not.toContain('A obra leva');
    expect(text(markup)).toContain(
      'A Paliçada Nv2, que fica pronta a tempo, segura este ataque: sem perda nem ferido.',
    );
  });

  it('no teto desta versão não há obra, e o motivo do limite é a frase do servidor', () => {
    const ceiling = withoutPalisadeWork({
      ...threatWatchedView,
      threat: {
        ...watched(threatWatchedView),
        defense: {
          building: 'palisade',
          palisadeLevel: 2,
          text: 'Paliçada Nv2: segura ataques leves e médios, sem perda nem ferido. A Muralha de Pedra chega em uma versão futura.',
          next: null,
        },
      },
    });
    const markup = box(panel(ceiling), 'defense');
    expect(buttons(markup)).toEqual([]);
    expect(text(markup)).toContain('A Muralha de Pedra chega em uma versão futura.');
    expect(text(markup)).not.toContain('madeira,');
  });

  it('planejada, a espera do servidor fica ao lado do custo', () => {
    const planned = withPlanned(threatWatchedView, [
      {
        building: 'palisade',
        autoStart: true,
        waiting: { reason: 'gate', text: 'espera o Salão do Senhor Nv3', etaSeconds: null },
      },
    ]);
    expect(text(box(panel(planned), 'defense'))).toContain(
      '200 madeira, 50 pedra · 6 min 40 s Planejada, com início automático · espera o Salão do Senhor Nv3. Melhore antes',
    );
  });
});

describe('os feridos de uma incursão (GDD §8.2)', () => {
  const header = (view: ViewState, elapsed = 0) => html(<Header view={view} elapsed={elapsed} />);
  const workers = (view: ViewState) =>
    html(
      <WorkersPanel
        workers={view.workers}
        rules={view.workersRules}
        population={view.population}
        elapsed={0}
        disabled={false}
        actions={actions}
      />,
    );

  it('no cabeçalho: quantos são, com ícone e palavra, a frase do servidor e a contagem do próximo a sarar', () => {
    const markup = header(raidAftermathView);
    const population = /<p class="population">.*?<\/p>/.exec(markup)?.[0] ?? '';
    expect(population).toContain(
      '<span class="population-injured"> · <span class="codicon codicon-pulse" aria-hidden="true"></span> ',
    );
    // A explicação é a frase do servidor: não trabalham até sarar, e voltam ao ofício sozinhos.
    expect(population).toContain(
      'data-tip="2 aldeões feridos na incursão: não trabalham até sarar. Saram em 20 min; quem tinha ofício volta a ele sozinho."',
    );
    expect(text(population.replace(/<span class="sr-only">.*?<\/span>/g, ''))).toBe(
      'Aldeões 12 · Habitação 12/20 · Livres 0 · Feridos 2 (o próximo sara em 20:00)',
    );
    // A contagem desce com o relógio da página.
    expect(header(raidAftermathView, 90)).toContain('(o próximo sara em 18:30)');
    // A moral diz por que vai cair: o termo da incursão está na conta do servidor.
    expect(markup).toContain('− 10 (incursão sofrida)');
  });

  it('sem feridos o cabeçalho não fala deles', () => {
    for (const view of [initialView, threatWatchedView, threatIncomingView]) {
      expect(header(view)).not.toContain('Feridos');
      expect(header(view)).not.toContain('codicon-pulse');
    }
  });

  it('no painel dos trabalhadores: fora da conta dos alocados, com a frase do servidor e a marca em cada ofício', () => {
    const markup = workers(raidAftermathView);
    // Doze aldeões, dez com ofício: os dois feridos não trabalham nem estão livres.
    expect(markup).toContain('<h2 id="workers-title">Trabalhadores (10/12)</h2>');
    expect(text(markup)).toContain('Quem pode trabalhar tem ofício. Use + e − no teclado.');
    expect(markup).toContain(
      '<p class="injured-note"><span class="codicon codicon-pulse" aria-hidden="true"></span> 2 aldeões feridos na incursão: não trabalham até sarar. Saram em 20 min; quem tinha ofício volta a ele sozinho.</p>',
    );
    const rows = markup.match(/<li class="worker".*?<\/li>/g) ?? [];
    expect(rows).toHaveLength(4);
    // A Fazenda e a Serraria perderam um braço cada; a Pedreira e a Mina, nenhum.
    expect(rows.map((row) => row.includes('worker-injured'))).toEqual([true, true, false, false]);
    expect(rows[0]).toContain(
      '<span class="worker-injured"><span class="codicon codicon-pulse" aria-hidden="true"></span> 1 ferido: volta a este ofício quando sarar.</span>',
    );
    // Quem usa leitor de tela ouve o mesmo ao chegar à linha.
    expect(rows[0]).toContain(
      'aria-label="Fazenda nível 2: 3 trabalhadores, 152,7 por hora; 1 ferido; experiência 12 de 100, subindo"',
    );
    // Com todos os sãos alocados não há quem pôr: o "+" fica desabilitado.
    expect(rows[0]).toContain('aria-describedby="worker-gain-farm" disabled');
  });

  it('dois feridos do mesmo ofício: a marca diz os dois', () => {
    const both: ViewState = {
      ...raidAftermathView,
      workers: raidAftermathView.workers.map((row) =>
        row.building === 'farm'
          ? { ...row, injured: 2 }
          : row.building === 'lumberMill'
            ? { ...row, injured: 0 }
            : row,
      ),
    };
    expect(text(workers(both))).toContain('2 feridos: voltam a este ofício quando sararem.');
  });

  it('sem feridos o painel fica como sempre foi', () => {
    const markup = workers(threatWatchedView);
    expect(markup).toContain('<h2 id="workers-title">Trabalhadores (12/12)</h2>');
    expect(text(markup)).toContain('Todos têm ofício.');
    expect(markup).not.toContain('injured');
    expect(markup).not.toContain('codicon-pulse');
  });
});

describe('a incursão na aba Hoje (GDD §2.3, §8.2 e critério 4 da §16.2)', () => {
  const HOUR = 3_600_000;
  const SUFFERED =
    'No 6º dia do Outono, os lobos que os vigias tinham avistado chegaram a Pedra Alta. Nada os deteve: o ataque custou 30 de comida, 12,5 de madeira e 2 aldeões feridos. Uma paliçada no nível 2 os teria detido.';
  const REPELLED =
    'No 6º dia do Outono, os lobos que os vigias tinham avistado chegaram a Pedra Alta. Recuaram diante da paliçada: nada se perdeu e ninguém se feriu.';
  let seq = 0;
  const event = (
    type: GameEvent['type'],
    eventText: string,
    data: GameEvent['data'],
  ): GameEvent => ({
    seq: (seq += 1),
    type,
    at: '2026-10-02T12:00:00.000Z',
    atMs: seq * 1000,
    text: eventText,
    data,
  });
  const RAID = { raidId: 'threat-5', enemy: 'wolves', size: 'medium', warning: 'warned' };
  const suffered = () =>
    event('raidSuffered', SUFFERED, {
      ...RAID,
      palisadeLevel: 0,
      injured: 2,
      raided_food: 30,
      raided_wood: 12.5,
      palisadeLevelNeeded: 2,
    });
  const today = (
    report: ReturnType<typeof buildReturnReport> | null,
    view: ViewState,
    run: Actions['run'] = noop,
  ) => <Today report={report} view={view} actions={{ ...actions, run }} />;
  const block = (markup: string, id: string) =>
    new RegExp(`<section class="report-block report-${id}".*?</section>`).exec(markup)?.[0] ?? '';
  const cells = (markup: string, label: string) =>
    [
      ...(
        new RegExp(`<tr><th scope="row">${label}</th>(.*?)</tr>`).exec(markup)?.[1] ?? ''
      ).matchAll(/<td[^>]*>([^<]*)<\/td>/g),
    ].map((match) => match[1]);

  /** Antes da ausência: 300 de comida e 125 de madeira. Na volta, o feudo logo depois do ataque. */
  const before = withResource(withResource(threatWatchedView, 'food', { stock: 300 }), 'wood', {
    stock: 125,
  });
  const after = withResource(withResource(raidAftermathView, 'food', { stock: 330 }), 'wood', {
    stock: 132.5,
  });
  const report = buildReturnReport(before, after, [suffered()], 6 * HOUR);
  const page = html(today(report, after));

  it('a incursão sofrida está em "O que exigiu um preço", com a frase do ataque e o botão da defesa', () => {
    const cost = block(page, 'cost');
    expect(text(cost)).toContain('O que exigiu um preço (1)');
    // A frase da Crônica conta como o bando chegou, o que levou, quem se feriu e o que o teria
    // detido; a urgência tem ícone e palavra.
    expect(text(cost)).toContain(`Atenção: ${SUFFERED}`);
    // A Paliçada ainda espera o Salão Nv3: o botão é a obra que faz o próximo ataque ser visto
    // antes, e é descrito pela frase da perda.
    expect(buttons(cost)).toEqual([{ label: 'Melhorar Torre de Vigia', disabled: false }]);
    expect(cost).toContain('aria-describedby="cost-item-0"');
    const ran: Array<[string, unknown]> = [];
    click(
      today(report, after, (id, arg) => ran.push([id, arg])),
      'Melhorar Torre de Vigia',
    );
    // O mesmo botão está também em "Antes de partir": o relatório conta o ataque que passou, e
    // a seção, o que pode vir na ausência seguinte (a Ameaça segue acima de 40, sem Paliçada).
    expect(ran).toEqual([
      ['lords.build', 'watchtower'],
      ['lords.build', 'watchtower'],
    ]);
    if (!after.threat.known) {
      throw new Error('O golden deixou de trazer a Ameaça à vista depois do ataque.');
    }
    expect(text(page)).toContain(
      `${after.threat.text} A próxima virada do dia, em ${formatApprox(after.threat.nextRiseInSeconds)}, tem ${after.threat.raidChancePercent}% de chance de marcar uma incursão. ${after.threat.defense.text}`,
    );
  });

  it('com a Paliçada ao alcance, o botão da mesma perda passa a ser a obra dela', () => {
    const cost = block(html(today(report, palisadeRaisedView)), 'cost');
    expect(buttons(cost)).toEqual([{ label: 'Melhorar Paliçada', disabled: false }]);
  });

  it('a conta dos estoques ganha a parcela "Levado", e continua fechando', () => {
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
      'Levado',
      'Agora',
    ]);
    // 60 de comida produzidas, 30 levadas: o estoque subiu 30. Os lobos não levam o que o feudo
    // produziu sem que a tabela mostre as duas coisas.
    expect(cells(page, 'Comida')).toEqual(['300', '+60', '—', '—', '—', '−30', '330']);
    expect(cells(page, 'Madeira')).toEqual(['125', '+20', '—', '—', '—', '−12,5', '132,5']);
    // A pedra e o ouro ficaram: um traço, e não um zero a ser lido.
    expect(cells(page, 'Pedra')[5]).toBe('—');
    expect(cells(page, 'Ouro')[5]).toBe('—');
    expect(text(page)).toContain('Levado é o que as incursões tiraram do estoque.');
    // A perda é dita com o tom de aviso e com o sinal: nunca só pela cor.
    expect(page).toContain('<td class="num warning">−30</td>');
  });

  it('sem incursão com perdas a coluna não existe', () => {
    const quiet = html(today(buildReturnReport(before, before, [], 6 * HOUR), before));
    expect(quiet).not.toContain('Levado');
    const held = buildReturnReport(
      before,
      before,
      [event('raidRepelled', REPELLED, { ...RAID, palisadeLevel: 2 })],
      6 * HOUR,
    );
    const calm = html(today(held, before));
    expect(calm).not.toContain('Levado');
    // A incursão que a paliçada deteve é boa notícia: sem botão, em "O feudo prosperou".
    expect(text(block(calm, 'prospered'))).toContain(`O feudo prosperou (1) ${REPELLED}`);
    expect(buttons(block(calm, 'prospered'))).toEqual([]);
    expect(text(block(calm, 'cost'))).toContain('Nada: a sua ausência não custou nada ao feudo.');
  });

  it('a moral do relatório aponta o termo da incursão, na frase do servidor', () => {
    expect(text(page).replaceAll('&quot;', '"')).toContain(
      'O que mais pesa é "Incursão sofrida" (−10): passa sozinho em 1 h 40 min. Ver a moral',
    );
  });

  it('"Antes de partir" abre com a incursão à vista, com o botão da defesa', () => {
    const markup = html(today(null, palisadeRaisedView));
    const leaving =
      /<section aria-labelledby="leaving-title">.*?<\/section>/.exec(markup)?.[0] ?? '';
    const first = /<li.*?<\/li>/.exec(leaving)?.[0] ?? '';
    expect(text(first)).toBe(
      'Atenção: Lobos a caminho. Os vigias contam uma matilha grande. Chegada em 16 min. A Paliçada Nv1 não segura um ataque deste tamanho: ele passa, mas com metade do estrago. Melhorar Paliçada',
    );
    const ran: Array<[string, unknown]> = [];
    click(
      today(null, palisadeRaisedView, (id, arg) => ran.push([id, arg])),
      'Melhorar Paliçada',
    );
    expect(ran).toEqual([['lords.build', 'palisade']]);
  });
});

describe('a Ameaça na aba Feudo', () => {
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

  it('o painel fica logo depois das Construções, onde a obra da Torre está', () => {
    const markup = fief(craftsView);
    const constructions = markup.indexOf('id="constructions-title"');
    const threat = markup.indexOf('id="threat-title"');
    const objectives = markup.indexOf('id="objectives-title"');
    expect(constructions).toBeGreaterThan(-1);
    expect(threat).toBeGreaterThan(constructions);
    expect(objectives).toBeGreaterThan(threat);
  });

  it('sem ligação o painel fica em modo leitura', () => {
    const markup = fief(craftsView, false);
    const section = /<section aria-labelledby="threat-title">.*?<\/section>/.exec(markup)?.[0];
    expect(buttons(section ?? '')).toEqual([
      { label: 'Construir Torre de Vigia', disabled: true },
      { label: 'Construir Paliçada', disabled: true },
    ]);
  });

  it('todas as visões do golden desenham o painel, com ou sem a Torre', () => {
    for (const [name, view] of Object.entries(golden as unknown as Record<string, ViewState>)) {
      const markup = fief(view);
      expect(markup, name).toContain('id="threat-title"');
      // A barra só existe com a Torre, e é a do número que a visão trouxe.
      const level = view.threat.known ? view.threat.level : null;
      expect(/<progress max="100" value="(\d+)" aria-label="Ameaça:/.exec(markup)?.[1], name).toBe(
        level === null ? undefined : String(level),
      );
      // A defesa aparece nos dois casos, na frase do servidor.
      expect(markup, name).toContain(view.threat.defense.text);
      // Os feridos, quando há: no cabeçalho e no painel dos trabalhadores.
      expect(markup.includes('Feridos'), name).toBe(view.population.injured > 0);
      expect(markup.includes('injured-note'), name).toBe(view.population.injured > 0);
    }
  });
});

describe('a Torre de Vigia na lista de obras', () => {
  const constructions = (view: ViewState) =>
    html(
      <ConstructionsPanel
        constructions={view.constructions}
        elapsed={0}
        disabled={false}
        actions={actions}
      />,
    );
  const item = (markup: string) =>
    (markup.match(/<li class="upgrade">.*?<\/li>/g) ?? []).find((entry) =>
      entry.includes('Construir Torre de Vigia'),
    ) ?? '';

  it('entra em "Construir", com o que a obra dá ao lado do custo; antes do Salão Nv2, travada com o motivo', () => {
    const gated = constructions(initialView);
    expect(gated.indexOf('<h3>Construir</h3>')).toBeLessThan(gated.indexOf('Torre de Vigia'));
    expect(text(item(gated))).toBe(
      'Torre de Vigia · 12 min120 madeira120 pedra (faltam 55)50 ouroMostra a Ameaça com a explicação e avisa de uma incursão com 1 h de antecedência.Construir Planejar Melhore antes o Salão do Senhor para o nível 2.',
    );
    expect(item(gated)).toContain('disabled aria-label="Construir Torre de Vigia"');
    // O nome nunca fala em "Nv0".
    expect(item(gated)).not.toContain('Nv0');
  });

  it('com o Salão no nível 2 e o estoque pago, o botão se oferece', () => {
    const open = item(constructions(craftsView));
    expect(open).toContain('<button type="button" aria-label="Construir Torre de Vigia">');
    expect(open).not.toContain('Melhore antes');
  });

  it('erguida, passa para "Melhorar" com o que o nível 2 acrescenta; no teto, sai da lista', () => {
    const built = constructions(threatWatchedView);
    expect(text(built)).toContain('Torre de Vigia Nv1 → Nv2 · 6 min');
    expect(text(built)).toContain(
      'Aviso de incursão: de 20 min para 40 min de antecedência. Os vigias passam a dizer o tamanho dela.',
    );
    expect(built.indexOf('Torre de Vigia Nv1 → Nv2')).toBeLessThan(
      built.indexOf('<h3>Construir</h3>'),
    );
    expect(constructions(threatIncomingView)).not.toContain('Torre de Vigia');
  });
});

describe('a Paliçada na lista de obras', () => {
  const constructions = (view: ViewState) =>
    html(
      <ConstructionsPanel
        constructions={view.constructions}
        elapsed={0}
        disabled={false}
        actions={actions}
      />,
    );
  const item = (markup: string, label: string) =>
    (markup.match(/<li class="upgrade">.*?<\/li>/g) ?? []).find((entry) => entry.includes(label)) ??
    '';

  it('entra em "Construir" com o que ela segura ao lado do custo; antes do Salão Nv3, travada com o motivo', () => {
    const gated = constructions(initialView);
    expect(gated.indexOf('<h3>Construir</h3>')).toBeLessThan(gated.indexOf('Paliçada'));
    expect(text(item(gated, 'Construir Paliçada'))).toBe(
      'Paliçada · 20 min200 madeira (faltam 80)50 pedraSegura ataques leves, sem perda nem ferido; os médios passam, mas com metade do estrago.Construir Planejar Melhore antes o Salão do Senhor para o nível 3.',
    );
    expect(item(gated, 'Construir Paliçada')).toContain('disabled aria-label="Construir Paliçada"');
    expect(item(gated, 'Construir Paliçada')).not.toContain('Nv0');
  });

  it('com o Salão no nível 3 e o estoque pago, o botão se oferece', () => {
    const open = item(constructions(craftsView), 'Construir Paliçada');
    expect(open).toContain('<button type="button" aria-label="Construir Paliçada">');
    expect(open).not.toContain('Melhore antes');
  });

  it('erguida, passa para "Melhorar" com o que o nível 2 acrescenta; no teto, sai da lista', () => {
    const built = constructions(palisadeRaisedView);
    expect(text(built)).toContain('Paliçada Nv1 → Nv2 · 10 min');
    expect(text(built)).toContain(
      'Passa a segurar também os ataques médios, sem perda nem ferido.',
    );
    expect(built.indexOf('Paliçada Nv1 → Nv2')).toBeLessThan(built.indexOf('<h3>Construir</h3>'));
    expect(constructions(withoutPalisadeWork(palisadeRaisedView))).not.toContain('Paliçada');
  });
});
