import type { ViewState } from '@lotg/protocol';
import type { ComponentChild } from 'preact';
import { renderToString } from 'preact-render-to-string';
import { afterEach, describe, expect, it } from 'vitest';

import type { AccountState } from '../account/accountService';
import type { Controller } from '../app/controller';
import type { Route } from '../app/router';
import type { Actions } from '../components/actions';
import type { Connection } from '../game/connection';
import { gameEvent, goldenView, makeController, settle } from '../test-helpers';
import { statusBar, type StatusBarInput } from '../ui/format';
import { buildTree, type TreeNode } from '../ui/treeModel';
import { type Activity, ActivityBar } from './ActivityBar';
import { EditorTabs } from './EditorTabs';
import { nodesFor, SideBar } from './SideBar';
import { StatusBar } from './StatusBar';
import { rowActions, Tree } from './Tree';
import { flattenTree, treeKey } from './treeNav';
import { Workbench } from './Workbench';

const building: ViewState = {
  ...goldenView,
  constructions: {
    ...goldenView.constructions,
    active: {
      building: 'lumberMill',
      label: 'Serraria',
      targetLevel: 2,
      secondsRemaining: 2520,
      totalSeconds: 3000,
      progressPercent: 16,
      refund: [
        { resource: 'wood', label: 'Madeira', amount: 80 },
        { resource: 'stone', label: 'Pedra', amount: 40 },
      ],
    },
  },
};
const starving: ViewState = {
  ...goldenView,
  famine: { sinceMs: 0, secondsElapsed: 60, text: 'Fome: a produção cai para 75%.' },
};

const signedOut: AccountState = { kind: 'signedOut' };
const anonymous: AccountState = {
  kind: 'anonymous',
  accountId: 'conta-1',
  displayName: 'Gustavo',
  hasRecoveryCode: false,
  gameId: 'partida-1',
};
const online: Connection = { kind: 'online' };
const offline: Connection = { kind: 'offline', retryInMs: 5000, attempt: 1 };

const tree = (
  overrides: Partial<{
    view: ViewState | null;
    account: AccountState;
    connection: Connection;
    unseen: number;
    events: number;
  }> = {},
) =>
  buildTree({
    view: 'view' in overrides ? (overrides.view ?? null) : goldenView,
    account: overrides.account ?? anonymous,
    connection: overrides.connection ?? online,
    chronicle: Array.from({ length: overrides.events ?? 0 }, (_, index) =>
      gameEvent(index + 1, 'constructionFinished'),
    ),
    unseen: overrides.unseen ?? 0,
    elapsedSeconds: 0,
  });

const html = (node: ComponentChild) => renderToString(<>{node}</>);
const noop = () => {};
const actions: Actions = { order: noop, run: noop, playNow: noop };

/** As tags de abertura que casam com o padrão, na ordem do documento. */
const tags = (markup: string, pattern: RegExp): string[] => markup.match(pattern) ?? [];
const treeItems = (markup: string) => tags(markup, /<div[^>]*role="treeitem"[^>]*>/g);
const buttons = (markup: string) => tags(markup, /<button[^>]*>/g);
const attribute = (tag: string, name: string) =>
  new RegExp(`\\s${name}="([^"]*)"`).exec(tag)?.[1] ?? null;
const hasAttribute = (tag: string, name: string) => new RegExp(`\\s${name}(=|\\s|>|/)`).test(tag);

/** Todos os nós, em profundidade, estejam à vista ou não. */
const everyNode = (nodes: TreeNode[]): TreeNode[] =>
  nodes.flatMap((node) => [node, ...everyNode(node.children ?? [])]);
const nodeById = (nodes: TreeNode[], id: string): TreeNode => {
  const found = everyNode(nodes).find((node) => node.id === id);
  if (found === undefined) {
    throw new Error(`Nó ${id} não existe na árvore.`);
  }
  return found;
};
const ids = (rows: ReturnType<typeof flattenTree>) => rows.map((row) => row.node.id);

describe('árvore como lista de linhas (flattenTree)', () => {
  it('abre os ramos que o nó pede e dá a profundidade de cada linha', () => {
    const rows = flattenTree(tree(), {});
    expect(ids(rows)).toEqual([
      'today',
      'fief',
      'resources',
      'resource:food',
      'resource:wood',
      'resource:stone',
      'resource:gold',
      'workers',
      'worker:farm',
      'worker:lumberMill',
      'worker:quarry',
      'worker:goldMine',
      'constructions',
      'chronicle',
      'account',
      'settings',
    ]);
    const byId = new Map(rows.map((row) => [row.node.id, row]));
    expect(byId.get('today')).toMatchObject({ depth: 0, parentId: null, expandable: false });
    expect(byId.get('fief')).toMatchObject({ depth: 0, expandable: true, expanded: true });
    expect(byId.get('resources')).toMatchObject({ depth: 1, parentId: 'fief', expanded: true });
    expect(byId.get('resource:food')).toMatchObject({ depth: 2, parentId: 'resources' });
    // Construções e Conta têm filhos, mas começam fechadas.
    expect(byId.get('constructions')).toMatchObject({ expandable: true, expanded: false });
    expect(byId.get('account')).toMatchObject({ expandable: true, expanded: false });
    // Sem linhas na Crônica não há o que abrir.
    expect(byId.get('chronicle')).toMatchObject({ expandable: false, expanded: false });
  });

  it('diz a posição entre os irmãos e quantos eles são, para leitores de tela', () => {
    const rows = flattenTree(tree(), {});
    const byId = new Map(rows.map((row) => [row.node.id, row]));
    expect(byId.get('today')).toMatchObject({ position: 1, setSize: 5 });
    expect(byId.get('settings')).toMatchObject({ position: 5, setSize: 5 });
    expect(byId.get('workers')).toMatchObject({ position: 2, setSize: 3 });
    expect(byId.get('resource:gold')).toMatchObject({ position: 4, setSize: 4 });
  });

  it('o que o jogador abriu ou fechou vale mais que o padrão do nó', () => {
    const closed = flattenTree(tree(), { fief: false });
    expect(ids(closed)).toEqual(['today', 'fief', 'chronicle', 'account', 'settings']);
    expect(closed[1]).toMatchObject({ expandable: true, expanded: false });

    const opened = flattenTree(tree(), { constructions: true });
    const upgrades = opened.filter((row) => row.parentId === 'constructions');
    expect(upgrades).toHaveLength(goldenView.constructions.available.length);
    expect(upgrades.every((row) => row.depth === 2)).toBe(true);
  });

  it('um nó sem filhos nunca fica "aberto", nem a pedido', () => {
    const rows = flattenTree(tree(), { settings: true, today: true });
    expect(rows.find((row) => row.node.id === 'settings')).toMatchObject({
      expandable: false,
      expanded: false,
    });
    expect(rows).toHaveLength(flattenTree(tree(), {}).length);
  });

  it('árvore vazia (sem conta) não tem linhas', () => {
    expect(flattenTree(tree({ account: signedOut }), {})).toEqual([]);
  });
});

describe('teclado da árvore no padrão ARIA (treeKey)', () => {
  const rows = flattenTree(tree(), {});
  const first = 'today';
  const last = 'settings';

  it('seta para baixo e para cima andam uma linha à vista e param nas pontas', () => {
    expect(treeKey(rows, 'today', 'ArrowDown')).toEqual({ focus: 'fief' });
    expect(treeKey(rows, 'fief', 'ArrowDown')).toEqual({ focus: 'resources' });
    expect(treeKey(rows, 'resources', 'ArrowUp')).toEqual({ focus: 'fief' });
    // Do último filho de um ramo para o próximo ramo, sem pular nada.
    expect(treeKey(rows, 'resource:gold', 'ArrowDown')).toEqual({ focus: 'workers' });
    expect(treeKey(rows, last, 'ArrowDown')).toEqual({ focus: last });
    expect(treeKey(rows, first, 'ArrowUp')).toEqual({ focus: first });
  });

  it('seta para baixo percorre todas as linhas à vista, na ordem', () => {
    const visited = [first];
    for (let step = 0; step < rows.length + 3; step += 1) {
      const next = treeKey(rows, visited[visited.length - 1] ?? null, 'ArrowDown')?.focus;
      if (next === undefined || next === visited[visited.length - 1]) {
        break;
      }
      visited.push(next);
    }
    expect(visited).toEqual(ids(rows));
  });

  it('Home e End vão à primeira e à última linha', () => {
    expect(treeKey(rows, 'worker:farm', 'Home')).toEqual({ focus: first });
    expect(treeKey(rows, 'worker:farm', 'End')).toEqual({ focus: last });
  });

  it('seta para a direita abre um ramo fechado e, já aberto, entra nele', () => {
    expect(treeKey(rows, 'constructions', 'ArrowRight')).toEqual({ expand: 'constructions' });
    const opened = flattenTree(tree(), { constructions: true });
    expect(treeKey(opened, 'constructions', 'ArrowRight')).toEqual({
      focus: 'construction:townHall',
    });
    // Em uma folha não há o que abrir: a tecla é consumida e nada muda.
    expect(treeKey(rows, 'resource:food', 'ArrowRight')).toEqual({});
  });

  it('seta para a esquerda fecha um ramo aberto; fechado ou folha, sobe ao pai', () => {
    expect(treeKey(rows, 'fief', 'ArrowLeft')).toEqual({ collapse: 'fief' });
    expect(treeKey(rows, 'resource:food', 'ArrowLeft')).toEqual({ focus: 'resources' });
    expect(treeKey(rows, 'constructions', 'ArrowLeft')).toEqual({ focus: 'fief' });
    // Na raiz, fechado, não há para onde subir.
    expect(treeKey(rows, 'today', 'ArrowLeft')).toEqual({});
    expect(treeKey(rows, 'account', 'ArrowLeft')).toEqual({});
  });

  it('Enter e espaço acionam a linha em foco', () => {
    expect(treeKey(rows, 'worker:farm', 'Enter')).toEqual({ activate: 'worker:farm' });
    expect(treeKey(rows, 'worker:farm', ' ')).toEqual({ activate: 'worker:farm' });
  });

  it('as outras teclas não são da árvore: devolve null para o navegador cuidar delas', () => {
    for (const key of ['Tab', 'a', 'Escape', 'F1', 'PageDown', 'Shift']) {
      expect(treeKey(rows, 'fief', key)).toBeNull();
    }
  });

  it('árvore vazia não reage a tecla nenhuma', () => {
    for (const key of ['ArrowDown', 'ArrowUp', 'Home', 'End', 'ArrowRight', 'ArrowLeft', 'Enter']) {
      expect(treeKey([], null, key)).toBeNull();
    }
  });

  it('sem linha em foco, as setas levam à primeira linha e nada é acionado', () => {
    expect(treeKey(rows, null, 'ArrowDown')).toEqual({ focus: first });
    expect(treeKey(rows, 'linha-que-sumiu', 'ArrowUp')).toEqual({ focus: first });
    expect(treeKey(rows, null, 'Enter')).toEqual({});
    expect(treeKey(rows, null, 'ArrowRight')).toEqual({});
    expect(treeKey(rows, null, 'ArrowLeft')).toEqual({});
  });
});

describe('ações das linhas (rowActions)', () => {
  const nodes = tree({ view: building, events: 3 });

  it('trabalhadores têm − e +, com rótulo para leitores de tela', () => {
    const found = rowActions(nodeById(nodes, 'worker:farm'));
    expect(found.map((action) => [action.text, action.command])).toEqual([
      ['−', 'lords.workersDecrease'],
      ['+', 'lords.workersIncrease'],
    ]);
    expect(found[0]?.label).toContain('Fazenda');
    expect(found[1]?.label).toContain('Fazenda');
    expect(found[0]?.label).not.toBe(found[1]?.label);
  });

  it('melhoria disponível tem "Melhorar"; a bloqueada não tem botão', () => {
    expect(rowActions(nodeById(nodes, 'construction:farm'))).toMatchObject([
      { text: 'Melhorar', command: 'lords.build' },
    ]);
    // O Salão do Senhor está bloqueado por falta de recursos no golden.
    expect(rowActions(nodeById(nodes, 'construction:townHall'))).toEqual([]);
    expect(rowActions(nodeById(nodes, 'construction:goldMine'))).toEqual([]);
  });

  it('a obra em andamento tem "Cancelar"', () => {
    expect(rowActions(nodeById(nodes, 'construction:active'))).toMatchObject([
      { text: 'Cancelar', command: 'lords.cancelConstruction' },
    ]);
  });

  it('nenhuma outra linha dá ordens: clicar só navega', () => {
    const withActions = everyNode(nodes)
      .filter((node) => rowActions(node).length > 0)
      .map((node) => node.id);
    const allowed = (id: string) =>
      id.startsWith('worker:') ||
      id === 'construction:active' ||
      building.constructions.available.some(
        (upgrade) => upgrade.blockedReason === null && id === `construction:${upgrade.building}`,
      );
    expect(withActions.length).toBeGreaterThan(0);
    expect(withActions.filter((id) => !allowed(id))).toEqual([]);
    for (const id of ['today', 'fief', 'resources', 'resource:food', 'chronicle', 'settings']) {
      expect(rowActions(nodeById(nodes, id))).toEqual([]);
    }
    expect(rowActions(nodeById(nodes, 'account:delete'))).toEqual([]);
  });

  it('o comando do clique de uma linha nunca é uma ordem ao feudo', () => {
    const orders = [
      'lords.workersIncrease',
      'lords.workersDecrease',
      'lords.build',
      'lords.cancelConstruction',
      'lords.recruit',
      'lords.allocateWorkers',
    ];
    const clicks = everyNode(nodes)
      .filter((node) => node.id.startsWith('worker:') || node.id.startsWith('construction:'))
      .map((node) => node.command?.id);
    expect(clicks.length).toBeGreaterThan(0);
    expect(clicks.filter((id) => id !== undefined && orders.includes(id))).toEqual([]);
  });
});

describe('Tree', () => {
  const render = (nodes: TreeNode[], readOnly = false) =>
    html(<Tree nodes={nodes} label="Feudo" readOnly={readOnly} onCommand={noop} />);

  it('é uma árvore ARIA: uma linha por nó à vista, com nível, posição e expansão', () => {
    const nodes = tree();
    const markup = render(nodes);
    expect(markup).toMatch(/<div[^>]*role="tree"[^>]*aria-label="Feudo"/);
    const items = treeItems(markup);
    const rows = flattenTree(nodes, {});
    expect(items).toHaveLength(rows.length);
    items.forEach((item, index) => {
      const row = rows[index];
      expect(attribute(item, 'data-node')).toBe(row?.node.id);
      expect(attribute(item, 'aria-level')).toBe(String((row?.depth ?? 0) + 1));
      expect(attribute(item, 'aria-posinset')).toBe(String(row?.position));
      expect(attribute(item, 'aria-setsize')).toBe(String(row?.setSize));
      // Só quem tem filhos diz se está aberto ou fechado.
      expect(attribute(item, 'aria-expanded')).toBe(row?.expandable ? String(row.expanded) : null);
    });
    const byNode = new Map(items.map((item) => [attribute(item, 'data-node'), item]));
    expect(attribute(byNode.get('fief') ?? '', 'aria-expanded')).toBe('true');
    expect(attribute(byNode.get('constructions') ?? '', 'aria-expanded')).toBe('false');
    expect(attribute(byNode.get('worker:farm') ?? '', 'aria-level')).toBe('3');
  });

  it('só uma linha entra na ordem do Tab; as outras se alcançam pelas setas', () => {
    const items = treeItems(render(tree()));
    expect(items.filter((item) => attribute(item, 'tabindex') === '0')).toHaveLength(1);
    expect(attribute(items[0] ?? '', 'tabindex')).toBe('0');
    expect(items.slice(1).every((item) => attribute(item, 'tabindex') === '-1')).toBe(true);
  });

  it('mostra rótulo, descrição, ícone e o porquê do número como dica', () => {
    const markup = render(tree());
    expect(markup).toContain('Hoje em Pedra Alta');
    expect(markup).toContain('Feudo: Pedra Alta');
    expect(markup).toContain('Primavera, dia 1');
    expect(markup).toContain('180 (+19/h)');
    expect(markup).toContain('2/5 alocados · 3 livres');
    expect(markup).toContain('codicon codicon-shield');
    expect(markup).toContain('codicon codicon-chevron-down');
    expect(markup).toContain('codicon codicon-chevron-right');
    const food = treeItems(markup).find((item) => attribute(item, 'data-node') === 'resource:food');
    expect(attribute(food ?? '', 'title')).toBe(goldenView.resources[0]?.breakdown);
  });

  it('as ordens saem de botões rotulados dentro das linhas', () => {
    const markup = render(tree());
    const found = buttons(markup);
    // Quatro edifícios com − e +; Construções começa fechada.
    expect(found).toHaveLength(goldenView.workers.length * 2);
    expect(found.map((button) => attribute(button, 'aria-label'))).toContain(
      'Pôr mais um trabalhador em Fazenda Nv1',
    );
    expect(found.every((button) => attribute(button, 'type') === 'button')).toBe(true);
    expect(found.some((button) => hasAttribute(button, 'disabled'))).toBe(false);
    // Os botões das linhas fora de foco não entram na ordem do Tab.
    expect(found.every((button) => attribute(button, 'tabindex') === '-1')).toBe(true);
  });

  it('sem ligação (readOnly), todo botão de ordem fica desabilitado', () => {
    const found = buttons(render(tree({ connection: offline }), true));
    expect(found.length).toBeGreaterThan(0);
    expect(found.every((button) => hasAttribute(button, 'disabled'))).toBe(true);
  });

  it('com fome, o feudo avisa com ícone e texto, não só com cor', () => {
    const markup = render(tree({ view: starving }));
    expect(markup).toContain('Primavera, dia 1 · fome');
    expect(markup).toContain('codicon codicon-warning');
  });

  it('sem ligação, a linha Hoje diz isso', () => {
    const markup = render(tree({ connection: offline }), true);
    expect(markup).toContain('sem ligação com o reino');
    expect(markup).toContain('codicon codicon-debug-disconnect');
  });

  it('lista vazia desenha uma árvore sem linhas', () => {
    const markup = render([]);
    expect(markup).toContain('role="tree"');
    expect(treeItems(markup)).toEqual([]);
  });
});

describe('SideBar', () => {
  const render = (
    overrides: Partial<{
      open: boolean;
      activity: Activity;
      nodes: TreeNode[];
      signedIn: boolean;
      readOnly: boolean;
    }> = {},
  ) =>
    html(
      <SideBar
        open={true}
        activity="fief"
        nodes={tree()}
        signedIn={true}
        readOnly={false}
        onCommand={noop}
        {...overrides}
      />,
    );

  it('cada atividade mostra a sua parte da árvore', () => {
    const nodes = tree({ events: 2 });
    expect(nodesFor('fief', nodes).map((node) => node.id)).toEqual(['today', 'fief']);
    expect(nodesFor('chronicle', nodes).map((node) => node.id)).toEqual(['chronicle']);
    expect(nodesFor('account', nodes).map((node) => node.id)).toEqual(['account', 'settings']);
    // Todo item do topo aparece em alguma atividade.
    const shown = (['fief', 'chronicle', 'account'] as const).flatMap((activity) =>
      nodesFor(activity, nodes).map((node) => node.id),
    );
    expect([...shown].sort()).toEqual(nodes.map((node) => node.id).sort());
  });

  it('a seção única da Crônica e da Conta já abre expandida', () => {
    const nodes = tree({ events: 2 });
    expect(nodesFor('chronicle', nodes)[0]?.expanded).toBe(true);
    expect(nodesFor('account', nodes)[0]?.expanded).toBe(true);
    // Sem mexer na árvore original.
    expect(nodeById(nodes, 'account').expanded).toBeUndefined();
    const markup = render({ activity: 'account', nodes });
    expect(markup).toContain('Sair desta máquina');
    expect(markup).toContain('Excluir conta…');
    expect(markup).toContain('Configurações');
    expect(markup).not.toContain('Hoje em Pedra Alta');
  });

  it('com feudo, a atividade Feudo mostra a árvore com o título da seção', () => {
    const markup = render();
    expect(markup).toMatch(/<aside[^>]*aria-label="Barra lateral: Feudo"/);
    expect(markup).toMatch(/<h2[^>]*>Feudo<\/h2>/);
    expect(markup).toContain('role="tree"');
    expect(markup).not.toContain('Jogar agora');
    expect(tags(markup, /<aside[^>]*>/g).some((tag) => hasAttribute(tag, 'hidden'))).toBe(false);
  });

  it('a atividade Crônica mostra as últimas linhas, da mais nova para a mais antiga', () => {
    const markup = render({ activity: 'chronicle', nodes: tree({ events: 3 }) });
    expect(markup).toMatch(/<h2[^>]*>Crônica<\/h2>/);
    expect(markup.indexOf('Evento 3.')).toBeGreaterThan(-1);
    expect(markup.indexOf('Evento 3.')).toBeLessThan(markup.indexOf('Evento 1.'));
  });

  it('sem conta, cada atividade convida a jogar em vez de mostrar uma árvore', () => {
    const empty = tree({ account: signedOut });
    for (const activity of ['fief', 'chronicle', 'account'] as const) {
      const markup = render({ activity, nodes: empty, signedIn: false });
      expect(markup).not.toContain('role="tree"');
      expect(markup).toMatch(/<button[^>]*>Jogar agora<\/button>/);
    }
    expect(render({ nodes: empty, signedIn: false })).toContain(
      'Ninguém governa neste navegador ainda.',
    );
    expect(render({ activity: 'account', nodes: empty, signedIn: false })).toContain(
      'Nenhuma conta neste navegador.',
    );
  });

  it('com conta e nada a mostrar, não convida a criar outra conta', () => {
    const markup = render({ nodes: [], signedIn: true });
    expect(markup).not.toContain('Jogar agora');
    expect(markup).toContain('Nada a mostrar aqui por enquanto.');
  });

  it('conta sem feudo carregado oferece abrir o feudo', () => {
    const markup = render({ nodes: tree({ view: null }) });
    expect(markup).toContain('Abrir o feudo');
    expect(treeItems(markup)).toHaveLength(1);
  });

  it('recolhida, fica escondida também para leitores de tela', () => {
    const aside = tags(render({ open: false }), /<aside[^>]*>/g)[0] ?? '';
    expect(hasAttribute(aside, 'hidden')).toBe(true);
    expect(attribute(aside, 'id')).toBe('sidebar');
  });

  it('sem ligação, os botões de ordem da árvore ficam desabilitados', () => {
    const found = buttons(render({ readOnly: true }));
    expect(found.length).toBeGreaterThan(0);
    expect(found.every((button) => hasAttribute(button, 'disabled'))).toBe(true);
  });
});

describe('ActivityBar', () => {
  const render = (
    overrides: Partial<{ active: Activity; sidebarOpen: boolean; unseen: number }> = {},
  ) =>
    html(
      <ActivityBar
        active="fief"
        sidebarOpen={true}
        unseen={0}
        onSelect={noop}
        onCommand={noop}
        {...overrides}
      />,
    );
  const labels = (markup: string) => buttons(markup).map((tag) => attribute(tag, 'aria-label'));

  it('tem Feudo, Crônica e Conta, nesta ordem, e as Preferências no fim', () => {
    const markup = render();
    expect(markup).toMatch(/<nav[^>]*aria-label="Barra de atividades"/);
    expect(labels(markup)).toEqual(['Feudo', 'Crônica', 'Conta', 'Preferências']);
    // Os ícones são decoração: quem fala é o rótulo do botão.
    expect(tags(markup, /<span[^>]*codicon[^>]*>/g)).toHaveLength(4);
    expect(
      tags(markup, /<span[^>]*codicon[^>]*>/g).every(
        (tag) => attribute(tag, 'aria-hidden') === 'true',
      ),
    ).toBe(true);
  });

  it('a atividade ativa aparece pressionada; com a barra lateral recolhida, nenhuma', () => {
    const pressed = (markup: string) =>
      buttons(markup).map((tag) => attribute(tag, 'aria-pressed'));
    expect(pressed(render({ active: 'chronicle' }))).toEqual(['false', 'true', 'false', null]);
    expect(pressed(render({ active: 'account' }))).toEqual(['false', 'false', 'true', null]);
    expect(pressed(render({ sidebarOpen: false }))).toEqual(['false', 'false', 'false', null]);
  });

  it('o badge do Feudo conta as novidades e o rótulo as diz por extenso', () => {
    const two = render({ unseen: 2 });
    expect(labels(two)[0]).toBe('Feudo: 2 novidades');
    expect(two).toMatch(/<span[^>]*class="activity-badge"[^>]*aria-hidden="true"[^>]*>2<\/span>/);
    expect(labels(render({ unseen: 1 }))[0]).toBe('Feudo: 1 novidade');
    // As outras atividades não ganham badge.
    expect(labels(two).slice(1)).toEqual(['Crônica', 'Conta', 'Preferências']);
    expect(tags(two, /class="activity-badge"/g)).toHaveLength(1);
  });

  it('sem novidades não há badge; acima de 99 o badge encurta e o rótulo diz o total', () => {
    expect(render()).not.toContain('activity-badge');
    const many = render({ unseen: 150 });
    expect(many).toMatch(/class="activity-badge"[^>]*>99\+<\/span>/);
    expect(labels(many)[0]).toBe('Feudo: 150 novidades');
  });
});

describe('EditorTabs', () => {
  const render = (overrides: Partial<{ tabs: Route[]; active: Route; hasNews: boolean }> = {}) =>
    html(
      <EditorTabs
        tabs={['today', 'fief', 'chronicle', 'settings']}
        active="fief"
        hasNews={false}
        onSelect={noop}
        onClose={noop}
        {...overrides}
      />,
    );
  const tabButtons = (markup: string) => tags(markup, /<button[^>]*role="tab"[^>]*>/g);

  it('é uma lista de abas ARIA, com a aba ativa selecionada', () => {
    const markup = render();
    expect(markup).toMatch(/<div[^>]*role="tablist"/);
    const found = tabButtons(markup);
    expect(found.map((tab) => attribute(tab, 'id'))).toEqual([
      'tab-today',
      'tab-fief',
      'tab-chronicle',
      'tab-settings',
    ]);
    expect(found.map((tab) => attribute(tab, 'aria-selected'))).toEqual([
      'false',
      'true',
      'false',
      'false',
    ]);
    expect(found.every((tab) => attribute(tab, 'aria-controls') === 'tabpanel')).toBe(true);
    for (const label of ['Hoje', 'Feudo', 'Crônica', 'Preferências']) {
      expect(markup).toContain(label);
    }
  });

  it('só a aba ativa entra na ordem do Tab', () => {
    expect(tabButtons(render()).map((tab) => attribute(tab, 'tabindex'))).toEqual([
      '-1',
      '0',
      '-1',
      '-1',
    ]);
    expect(
      tabButtons(render({ active: 'chronicle' })).map((tab) => attribute(tab, 'tabindex')),
    ).toEqual(['-1', '-1', '0', '-1']);
  });

  it('só as abas que o jogador abriu têm botão de fechar', () => {
    const closers = (markup: string) =>
      buttons(markup)
        .filter((tag) => attribute(tag, 'role') !== 'tab')
        .map((tag) => attribute(tag, 'aria-label'));
    expect(closers(render())).toEqual(['Fechar a aba Crônica', 'Fechar a aba Preferências']);
    expect(closers(render({ tabs: ['today', 'fief'] }))).toEqual([]);
    expect(closers(render({ tabs: ['welcome', 'about'], active: 'welcome' }))).toEqual([
      'Fechar a aba Sobre',
    ]);
  });

  it('com novidades, a aba Hoje ganha um ponto com texto para leitores de tela', () => {
    expect(render()).not.toContain('class="dot"');
    const markup = render({ hasNews: true });
    expect(tags(markup, /<span[^>]*class="dot"[^>]*>/g)).toHaveLength(1);
    expect(markup).toMatch(/<span[^>]*class="dot"[^>]*aria-label="há novidades"/);
    // O ponto fica dentro da aba Hoje, antes da aba Feudo.
    expect(markup.indexOf('class="dot"')).toBeGreaterThan(markup.indexOf('id="tab-today"'));
    expect(markup.indexOf('class="dot"')).toBeLessThan(markup.indexOf('id="tab-fief"'));
  });

  it('sem a aba Hoje (sem conta), as novidades não desenham ponto nenhum', () => {
    expect(render({ tabs: ['welcome'], active: 'welcome', hasNews: true })).not.toContain(
      'class="dot"',
    );
  });
});

describe('StatusBar', () => {
  const input = (overrides: Partial<StatusBarInput> = {}): StatusBarInput => ({
    view: goldenView,
    connection: online,
    discreetMode: false,
    signedIn: true,
    elapsedSeconds: 0,
    pending: 0,
    ...overrides,
  });
  const render = (overrides: Partial<StatusBarInput> = {}, muted = false) =>
    html(<StatusBar input={input(overrides)} muted={muted} onCommand={noop} />);
  const main = (markup: string) =>
    buttons(markup).find((tag) => (attribute(tag, 'class') ?? '').includes('status-main')) ?? '';
  /** O texto à vista do item principal, sem as marcações. */
  const mainText = (markup: string) =>
    (/<button[^>]*status-main[^>]*>(.*?)<\/button>/.exec(markup)?.[1] ?? '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  it('desenha o texto de statusBar() com codicons no lugar de $(ícone)', () => {
    for (const overrides of [
      {},
      { view: building },
      { view: starving },
      { connection: offline },
      { signedIn: false, view: null },
      { discreetMode: true },
      { pending: 2 },
    ]) {
      const status = statusBar(input(overrides));
      const markup = render(overrides);
      expect(markup).not.toContain('$(');
      const icons = [...status.text.matchAll(/\$\(([a-z0-9-]+)\)/g)].map((match) => match[1]);
      expect(icons.length).toBeGreaterThan(0);
      for (const icon of icons) {
        expect(markup).toContain(`codicon codicon-${icon}`);
      }
      const words = status.text
        .replace(/\$\([a-z0-9-]+\)/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      expect(mainText(markup)).toBe(words);
      expect(attribute(main(markup), 'title')).toBe(status.tooltip);
    }
  });

  it('é um rodapé rotulado, com o feudo e a comida por hora no estado normal', () => {
    const markup = render();
    expect(markup).toMatch(/<footer[^>]*aria-label="Barra de status"/);
    expect(mainText(markup)).toBe('Pedra Alta · +19 comida/h');
    expect(attribute(main(markup), 'class')).toBe('status-main');
  });

  it('obra em andamento mostra a contagem regressiva local', () => {
    expect(mainText(render({ view: building }))).toBe('Serraria Nv2 · 00:42');
    expect(mainText(render({ view: building, elapsedSeconds: 120 }))).toBe('Serraria Nv2 · 00:40');
  });

  it('a fome ganha destaque de aviso, com ícone e texto além da cor', () => {
    const markup = render({ view: starving });
    expect(attribute(main(markup), 'class')).toContain('status-warning');
    expect(mainText(markup)).toBe('Fome em Pedra Alta');
    expect(markup).toContain('codicon codicon-warning');
  });

  it('sem ligação passa na frente da fome e ganha o seu próprio destaque', () => {
    const markup = render({ view: starving, connection: offline });
    expect(attribute(main(markup), 'class')).toContain('status-offline');
    expect(attribute(main(markup), 'class')).not.toContain('status-warning');
    expect(mainText(markup)).toBe('Sem ligação com o reino');
  });

  it('sem conta, convida a jogar, sem destaque nenhum', () => {
    const markup = render({ signedIn: false, view: null, connection: offline });
    expect(mainText(markup)).toBe('Lords of the Guild');
    expect(attribute(main(markup), 'class')).toBe('status-main');
    expect(attribute(main(markup), 'title')).toBe('Jogar agora');
  });

  it('modo discreto: só um contador, sem nome do feudo, sem fome e sem destaque', () => {
    for (const overrides of [
      { view: starving },
      { view: starving, connection: offline },
      { view: building, pending: 3 },
    ]) {
      const markup = render({ ...overrides, discreetMode: true }, true);
      expect(attribute(main(markup), 'class')).toBe('status-main');
      expect(mainText(markup)).toMatch(/^\d{2}:\d{2}$/);
      expect(markup).not.toContain('Pedra Alta');
      expect(markup).not.toContain('Fome');
      expect(markup).not.toContain('silenciadas');
    }
  });

  it('avisos silenciados são ditos a leitores de tela', () => {
    expect(render({}, true)).toMatch(
      /<span[^>]*role="status"[^>]*>Notificações silenciadas<\/span>/,
    );
    expect(render({}, false)).not.toContain('Notificações silenciadas');
  });

  it('tem o botão da paleta, com rótulo e os atalhos que o navegador deixa usar', () => {
    const markup = render();
    const palette = buttons(markup).find(
      (tag) => attribute(tag, 'aria-label') === 'Abrir a paleta de comandos',
    );
    expect(palette).toBeDefined();
    expect(attribute(palette ?? '', 'title')).toContain('F1');
    expect(attribute(palette ?? '', 'title')).toContain('Ctrl+K');
    expect(markup).not.toContain('Ctrl+Shift+P');
  });
});

describe('Workbench', () => {
  const controllers: Controller[] = [];
  afterEach(() => {
    for (const controller of controllers.splice(0)) {
      controller.dispose();
    }
  });

  const open = async (options: Parameters<typeof makeController>[0] = {}) => {
    const made = makeController(options);
    controllers.push(made.controller);
    await made.controller.start();
    await settle(made.controller);
    return made;
  };
  const render = (controller: Controller, narrow = false) =>
    html(
      <Workbench
        controller={controller}
        actions={actions}
        theme="dark"
        narrow={narrow}
        browserNotificationsSupported={false}
      />,
    );
  /** A marcação de dentro do painel da aba. */
  const panel = (markup: string) => {
    const start = markup.indexOf('id="tabpanel"');
    const end = markup.indexOf('<footer');
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    return markup.slice(start, end);
  };
  const sidebar = (markup: string) =>
    markup.slice(markup.indexOf('<aside'), markup.indexOf('</aside>'));

  /** Barra de atividades → barra lateral → abas → barra de status: é também a ordem do Tab. */
  const expectOrder = (markup: string) => {
    const positions = [
      markup.indexOf('class="activitybar"'),
      markup.indexOf('id="sidebar"'),
      markup.indexOf('role="tablist"'),
      markup.indexOf('role="tabpanel"'),
      markup.indexOf('class="statusbar"'),
    ];
    expect(positions.every((position) => position >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  };

  it('sem conta: a bancada completa e vazia, com as boas-vindas na área central', async () => {
    const { controller } = await open();
    const markup = render(controller);
    expectOrder(markup);
    // A barra lateral convida a jogar; não há árvore.
    expect(sidebar(markup)).toContain('Ninguém governa neste navegador ainda.');
    expect(markup).not.toContain('role="tree"');
    // Uma aba só, a de boas-vindas, e o painel é rotulado por ela.
    const tabs = tags(markup, /<button[^>]*role="tab"[^>]*>/g);
    expect(tabs.map((tab) => attribute(tab, 'id'))).toEqual(['tab-welcome']);
    expect(attribute(tabs[0] ?? '', 'aria-selected')).toBe('true');
    expect(markup).toMatch(
      /<div[^>]*id="tabpanel"[^>]*role="tabpanel"[^>]*aria-labelledby="tab-welcome"/,
    );
    const content = panel(markup);
    expect(content).toContain('Como devemos chamar quem governa?');
    expect(content).toContain('Nome do feudo');
    expect(content).toMatch(/<button[^>]*type="submit"[^>]*>Jogar agora<\/button>/);
    // A barra de status também convida.
    expect(markup).toMatch(/<button[^>]*status-main[^>]*title="Jogar agora"/);
    expect(markup).not.toContain('activity-badge');
  });

  it('com feudo: árvore, abas Hoje e Feudo, painel do Feudo e barra de status', async () => {
    const { controller } = await open({ signedIn: true });
    const markup = render(controller);
    expectOrder(markup);
    expect(sidebar(markup)).toContain('role="tree"');
    expect(sidebar(markup)).toContain('Feudo: Pedra Alta');
    const tabs = tags(markup, /<button[^>]*role="tab"[^>]*>/g);
    expect(tabs.map((tab) => attribute(tab, 'id'))).toEqual(['tab-today', 'tab-fief']);
    // O painel é rotulado pela aba ativa, e só ela está selecionada.
    const labelledBy = /role="tabpanel"[^>]*aria-labelledby="([^"]+)"/.exec(markup)?.[1];
    expect(labelledBy).toBe('tab-fief');
    const selected = tabs.filter((tab) => attribute(tab, 'aria-selected') === 'true');
    expect(selected.map((tab) => attribute(tab, 'id'))).toEqual([labelledBy]);
    const content = panel(markup);
    expect(content).toContain('Pedra Alta');
    expect(content).not.toContain('Sem ligação com o reino.');
    expect(content).not.toContain('Fome em andamento.');
    // Com ligação, as ordens estão liberadas na árvore.
    const orders = buttons(sidebar(markup));
    expect(orders.length).toBeGreaterThan(0);
    expect(orders.some((button) => hasAttribute(button, 'disabled'))).toBe(false);
    expect(markup).toMatch(/<button[^>]*class="status-main"[^>]*>/);
    expect(markup).toContain('+19 comida/h');
  });

  it('a aba ativa muda o painel e quem o rotula', async () => {
    const { controller } = await open({ signedIn: true });
    controller.navigate('today');
    expect(render(controller)).toMatch(/role="tabpanel"[^>]*aria-labelledby="tab-today"/);
    controller.navigate('settings');
    const markup = render(controller);
    expect(markup).toMatch(/role="tabpanel"[^>]*aria-labelledby="tab-settings"/);
    expect(markup).toContain('id="tab-settings"');
    expect(panel(markup)).toContain('Valem só neste navegador.');
    controller.navigate('about');
    expect(panel(render(controller))).toContain('Um feudo medieval');
  });

  it('sem ligação, com o último estado guardado: aviso, modo leitura e ordens desabilitadas', async () => {
    // Primeira visita com ligação: o estado fica guardado no navegador.
    const first = await open({ signedIn: true });
    first.controller.dispose();
    first.api.state.online = false;
    // Segunda visita, sem rede, com o mesmo armazenamento.
    const { controller } = await open({
      api: first.api,
      signedIn: true,
      overrides: { store: first.store, tokenStore: first.tokenStore },
    });
    expect(controller.connection.kind).toBe('offline');
    expect(controller.view).not.toBeNull();

    const markup = render(controller);
    expectOrder(markup);
    const content = panel(markup);
    expect(content).toContain('Sem ligação com o reino.');
    expect(content).toContain('banner-offline');
    // O feudo guardado continua à vista.
    expect(content).toContain('Pedra Alta');
    expect(sidebar(markup)).toContain('Feudo: Pedra Alta');
    // Nenhuma ordem pode ser dada: nem pela árvore, nem pelo painel.
    const treeOrders = buttons(sidebar(markup));
    expect(treeOrders.length).toBeGreaterThan(0);
    expect(treeOrders.every((button) => hasAttribute(button, 'disabled'))).toBe(true);
    const panelOrders = buttons(content).filter((button) =>
      /trabalhador/i.test(attribute(button, 'aria-label') ?? ''),
    );
    expect(panelOrders.length).toBeGreaterThan(0);
    expect(panelOrders.every((button) => hasAttribute(button, 'disabled'))).toBe(true);
    for (const label of ['Melhorar', 'Planejar', 'Recrutar[^<]*']) {
      const found = tags(content, new RegExp(`<button[^>]*>${label}</button>`, 'g'));
      expect(found.length).toBeGreaterThan(0);
      expect(found.every((button) => hasAttribute(button, 'disabled'))).toBe(true);
    }
    // "Tentar agora" continua valendo: não é uma ordem ao feudo.
    const retry = tags(content, /<button[^>]*>Tentar agora<\/button>/g);
    expect(retry).toHaveLength(1);
    expect(hasAttribute(retry[0] ?? '', 'disabled')).toBe(false);
    expect(markup).toMatch(/<button[^>]*class="status-main status-offline"/);
  });

  it('sem ligação e sem estado guardado, diz isso em vez de mostrar um feudo vazio', async () => {
    const made = makeController({ signedIn: true });
    controllers.push(made.controller);
    made.api.state.online = false;
    await made.controller.start();
    await settle(made.controller);
    const markup = render(made.controller);
    expectOrder(markup);
    expect(panel(markup)).toContain('Ainda não há um estado guardado neste navegador.');
    expect(panel(markup)).toContain('Sem ligação com o reino.');
    expect(sidebar(markup)).toContain('Abrir o feudo');
  });

  it('com fome: aviso no painel, na árvore e na barra de status', async () => {
    const made = makeController({ signedIn: true });
    controllers.push(made.controller);
    made.api.state.view = starving;
    await made.controller.start();
    await settle(made.controller);
    const markup = render(made.controller);
    expect(panel(markup)).toContain('Fome em andamento.');
    expect(panel(markup)).toContain('banner-warning');
    expect(sidebar(markup)).toContain('· fome');
    expect(markup).toMatch(/<button[^>]*class="status-main status-warning"/);
    expect(markup).toContain('Fome em Pedra Alta');
  });

  it('em tela estreita a barra lateral começa recolhida e nenhuma atividade fica pressionada', async () => {
    const { controller } = await open({ signedIn: true });
    const wide = render(controller);
    expect(hasAttribute(tags(wide, /<aside[^>]*>/g)[0] ?? '', 'hidden')).toBe(false);
    expect(wide).toMatch(/<button[^>]*aria-pressed="true"[^>]*aria-label="Feudo"/);
    const narrow = render(controller, true);
    expect(hasAttribute(tags(narrow, /<aside[^>]*>/g)[0] ?? '', 'hidden')).toBe(true);
    expect(narrow).not.toContain('aria-pressed="true"');
    expectOrder(narrow);
  });

  it('as novidades aparecem no badge do Feudo; no modo discreto, não', async () => {
    const { controller } = await open({ signedIn: true });
    controller.unseen = 2;
    expect(render(controller)).toMatch(/aria-label="Feudo: 2 novidades"/);
    await controller.setPreferences({ discreetMode: true });
    const discreet = render(controller);
    expect(discreet).not.toContain('activity-badge');
    expect(discreet).not.toContain('novidades"');
  });

  it('em nenhum estado a bancada usa o nome do Visual Studio Code', async () => {
    const out = await open();
    const fief = await open({ signedIn: true });
    fief.controller.navigate('about');
    for (const markup of [render(out.controller), render(fief.controller)]) {
      expect(markup).not.toMatch(/Visual Studio Code|VS ?Code/i);
    }
  });
});
