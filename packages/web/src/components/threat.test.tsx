import type { ViewState } from '@lotg/protocol';
import type { ComponentChild } from 'preact';
import { renderToString } from 'preact-render-to-string';
import { describe, expect, it } from 'vitest';

import golden from '../../../engine/src/__golden__/view-seed-pedra-alta.json';
import { FiefTab } from '../tabs/Fief';
import {
  activeConstruction,
  craftsView,
  initialView,
  threatIncomingView,
  threatWatchedView,
  unlockedView,
  withPlanned,
  withQueues,
} from '../test-helpers';
import type { WatchedThreat } from '../ui/threat';
import type { Actions } from './actions';
import { ConstructionsPanel } from './ConstructionsPanel';
import { ThreatPanel } from './ThreatPanel';

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
  it('diz que ninguém sabe, o que a Torre daria, quanto custa e o que protege o feudo', () => {
    const markup = panel(craftsView);
    expect(markup).toContain('<section aria-labelledby="threat-title">');
    expect(markup).toContain('<h2 id="threat-title">Ameaça</h2>');
    expect(text(markup)).toBe(
      [
        'Ameaça',
        'Sem uma Torre de Vigia, ninguém sabe o que ronda o feudo.',
        'Torre de Vigia Nv1: mostra a Ameaça com a explicação e avisa de uma incursão com 1 h de antecedência.',
        '120 madeira, 120 pedra, 50 ouro · 12 min',
        'Construir Torre de Vigia',
        'Sem Paliçada, nada segura um ataque.',
      ].join(' '),
    );
    // O olho fechado para a névoa e o escudo para a defesa: o texto ao lado é quem fala.
    expect(icons(markup)).toEqual(['eye-closed', 'shield']);
    expect(buttons(markup)).toEqual([{ label: 'Construir Torre de Vigia', disabled: false }]);
    // O botão é descrito pelo que a obra dá e pelo custo: quem não vê a caixa ouve os dois.
    expect(markup).toContain('<button type="button" aria-describedby="threat-tower-terms">');
    expect(markup).toContain('<div id="threat-tower-terms"><p>Torre de Vigia Nv1: mostra');
  });

  it('não mostra número, barra, tendência, origem nem tile: nada disso veio do servidor', () => {
    for (const view of [initialView, craftsView, unlockedView, towerUnderway]) {
      const markup = panel(view);
      expect(markup).not.toContain('<progress');
      expect(text(markup)).not.toMatch(/Ameaça \d/);
      expect(markup).not.toContain('Covil');
      expect(markup).not.toContain('/dia');
      expect(markup).not.toContain('O que ronda o feudo:');
      expect(markup).not.toContain('incursão agora');
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
    // Antes do Salão Nv2.
    const gated = panel(initialView);
    expect(buttons(gated)).toEqual([{ label: 'Construir Torre de Vigia', disabled: true }]);
    expect(text(gated)).toContain(
      '120 madeira, 120 pedra, 50 ouro · 12 min Melhore antes o Salão do Senhor para o nível 2.',
    );
    // O motivo tem a sua linha, com o cadeado ao lado do texto.
    expect(gated).toContain(
      '<p class="blocked"><span class="codicon codicon-lock" aria-hidden="true"></span> Melhore antes o Salão do Senhor para o nível 2.</p>',
    );
    expect(icons(gated)).toEqual(['eye-closed', 'lock', 'shield']);
    // Com o Salão no nível 2 e sem recursos.
    const poor = panel(unlockedView);
    expect(buttons(poor)).toEqual([{ label: 'Construir Torre de Vigia', disabled: true }]);
    expect(text(poor)).toContain('Faltam 99 madeira e 112 pedra.');
  });

  it('sem ligação, o botão não dá ordem nenhuma', () => {
    expect(buttons(panel(craftsView, { disabled: true }))).toEqual([
      { label: 'Construir Torre de Vigia', disabled: true },
    ]);
  });

  it('com a Torre em obras: a contagem no lugar do botão, e a névoa continua até ela ficar pronta', () => {
    const markup = panel(towerUnderway);
    expect(buttons(markup)).toEqual([]);
    expect(text(markup)).toContain('Sem uma Torre de Vigia, ninguém sabe o que ronda o feudo.');
    expect(text(markup)).toContain(
      'Torre de Vigia → Nv1 em obras: termina em 08:20. Até lá, ninguém vê.',
    );
    // A contagem desce com o relógio da página e não fica em uma região viva.
    expect(text(panel(towerUnderway, { elapsed: 200 }))).toContain('termina em 05:00.');
    expect(markup).not.toContain('role="status"');
    expect(icons(markup)).toEqual(['eye-closed', 'tools', 'shield']);
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
    const markup = panel(bare);
    expect(markup).not.toContain('threat-tower');
    expect(text(markup)).toBe(
      'Ameaça Sem uma Torre de Vigia, ninguém sabe o que ronda o feudo. Sem Paliçada, nada segura um ataque.',
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
    const markup = panel(planned);
    expect(text(markup)).toContain(
      '120 madeira, 120 pedra, 50 ouro · 12 min Planejada, com início automático · espera 99 de madeira: em 1 h 30 min. Faltam 99 madeira e 112 pedra.',
    );
    expect(buttons(markup)).toEqual([{ label: 'Construir Torre de Vigia', disabled: true }]);
  });
});

describe('painel "Ameaça": com a Torre de Vigia, o que os vigias veem', () => {
  it('o número com a barra, a tendência com o prazo, as origens, o que ronda e a obra seguinte', () => {
    const markup = panel(threatWatchedView);
    expect(text(markup)).toBe(
      [
        'Ameaça',
        'Ameaça 46 de 100.',
        'Sobe 8 a cada dia de jogo (40 min): na próxima virada, vai de 46 para 54. Faltam 35:40.',
        '+5/dia: Covil de Lobos',
        '+3/dia: outono',
        'O que ronda o feudo: Covil de Lobos (ativo).',
        'Os vigias não avistam nenhuma incursão agora.',
        'Torre de Vigia Nv1: mostra a Ameaça com a explicação e avisa de uma incursão com 20 min de antecedência.',
        'Torre de Vigia Nv2: avisa com 40 min de antecedência (em vez de 20 min) e passa a dizer o tamanho da incursão.',
        '192 madeira, 192 pedra, 80 ouro · 6 min',
        'Melhorar Torre de Vigia',
        'Sem Paliçada, nada segura um ataque.',
      ].join(' '),
    );
    // A barra é a da visão, do zero ao máximo que o servidor mandou, com nome para quem não a vê.
    expect(markup).toContain('<progress max="100" value="46" aria-label="Ameaça: 46 de 100">');
    expect(markup).toContain('aria-label="De onde vem a subida da Ameaça"');
    // A subida tem seta e verbo; a cor só reforça.
    expect(markup).toContain(
      '<span class="warning"><span class="codicon codicon-arrow-up" aria-hidden="true">',
    );
    expect(icons(markup)).toEqual(['eye', 'arrow-up', 'eye', 'shield']);
    expect(buttons(markup)).toEqual([{ label: 'Melhorar Torre de Vigia', disabled: false }]);
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

  it('com uma incursão à vista: o aviso com ícone e texto, o tamanho que os vigias contam e a contagem', () => {
    const markup = panel(threatIncomingView);
    expect(text(markup)).toContain(
      'Lobos a caminho. Os vigias contam uma matilha grande. Chegada em 15:40.',
    );
    expect(text(markup)).not.toContain('não avistam');
    expect(markup).toContain('class="banner banner-warning threat-incoming"');
    // Só a frase é região viva: a contagem muda a cada segundo e fica fora dela.
    expect(markup).toContain(
      '<span role="status"><span class="codicon codicon-megaphone" aria-hidden="true"></span> <strong>Lobos a caminho. Os vigias contam uma matilha grande.</strong></span>',
    );
    expect(text(panel(threatIncomingView, { elapsed: 340 }))).toContain('Chegada em 10:00.');
    // No nível 1 os vigias ainda não distinguem o tamanho: a frase é a do servidor.
    const incoming = watched(threatIncomingView).incoming;
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
    const markup = panel(threatIncomingView);
    expect(buttons(markup)).toEqual([]);
    expect(text(markup)).toContain(
      'Torre de Vigia Nv2: mostra a Ameaça com a explicação, avisa de uma incursão com 40 min de antecedência e diz o tamanho dela. Os níveis seguintes chegam em versões futuras do jogo.',
    );
    expect(text(markup)).not.toContain('madeira');
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
    expect(buttons(markup)).toEqual([]);
    expect(text(markup)).toContain('Ameaça 46 de 100.');
    expect(text(markup)).toContain('Torre de Vigia → Nv2 em obras: termina em 01:30.');
    expect(text(markup)).not.toContain('ninguém vê');
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
    expect(buttons(section ?? '')).toEqual([{ label: 'Construir Torre de Vigia', disabled: true }]);
  });

  it('todas as visões do golden desenham o painel, com ou sem a Torre', () => {
    for (const [name, view] of Object.entries(golden as unknown as Record<string, ViewState>)) {
      const markup = fief(view);
      expect(markup, name).toContain('id="threat-title"');
      expect(markup.includes('<progress max="100" value="46"'), name).toBe(view.threat.known);
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
