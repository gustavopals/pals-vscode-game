import type { GameEvent, ViewState } from '@lotg/protocol';
import { describe, expect, it } from 'vitest';

import type { AccountState } from '../account/accountService';
import {
  decideNotifications,
  eventIcon,
  isEssential,
  isGuildEvent,
  isMarketEvent,
  isSmithyEvent,
  type PolicyInput,
} from '../notifications/policy';
import { initialView, marketDayView, smithyForgingView, smithyIdleView } from '../test-helpers';
import { forgeDeadline, smithyTreeLine } from '../ui/smithy';
import { buildTree, type TreeNode } from '../ui/treeModel';
import { rowActions } from '../workbench/Tree';
import { beforeLeaving, leavingItems } from './beforeLeaving';
import { guildDeadlines } from './gameSession';
import { buildReturnReport } from './returnReport';

/**
 * O Ferreiro na árvore, nos avisos, no Relatório de Retorno e em "Antes de partir" (roadmap da
 * v0.4, V4B-T4.4). As visões são as do golden do motor (`smithyIdle` e `smithyForging`); o evento
 * é sintético, com a frase e os totais que o motor mandaria. Nada aqui confere um número de regra:
 * o que se confere é onde cada coisa cai, com que tom e com que botão.
 */

const account: AccountState = {
  kind: 'anonymous',
  accountId: 'a',
  displayName: 'Gustavo',
  hasRecoveryCode: false,
  gameId: 'g',
};

let seq = 0;
const event = (type: GameEvent['type'], text: string, data: GameEvent['data'] = {}): GameEvent => ({
  seq: (seq += 1),
  type,
  at: '2026-10-01T12:00:00.000Z',
  atMs: seq * 1000,
  text,
  data,
});

const tree = (view: ViewState, elapsedSeconds = 0) =>
  buildTree({
    view,
    account,
    connection: { kind: 'online' },
    chronicle: [],
    unseen: 0,
    elapsedSeconds,
  });
const find = (nodes: TreeNode[], id: string): TreeNode | undefined => {
  for (const node of nodes) {
    if (node.id === id) {
      return node;
    }
    const inner = find(node.children ?? [], id);
    if (inner) {
      return inner;
    }
  }
  return undefined;
};

const forged = event('weaponsForged', 'O Ferreiro forjou 4 armas.', { amount: 4, weapons: 4 });

describe('o Ferreiro na árvore (V4B-T4.4)', () => {
  it('a linha "Ferreiro" fica sob o Feudo, depois do Mercado', () => {
    const fief = find(tree(smithyIdleView), 'fief');
    const ids = (fief?.children ?? []).map((node) => node.id);
    expect(ids.indexOf('smithy')).toBe(ids.indexOf('market') + 1);
  });

  it('sem o edifício a linha diz que não foi erguido, com a frase do servidor, e sem botão', () => {
    const node = find(tree(initialView), 'smithy');
    expect(node).toMatchObject({
      label: 'Ferreiro',
      description: 'não erguido',
      tooltip: initialView.smithy.text,
      command: { id: 'lords.openPanel', args: ['smithy'] },
    });
    expect(node && rowActions(node)).toEqual([]);
  });

  it('de pé e livre: o nível e as armas, e o botão "Forjar" com o custo na dica', () => {
    const node = find(tree(smithyIdleView), 'smithy');
    expect(node?.description).toBe('Nv1 · 0 armas');
    expect(node && rowActions(node).map((action) => action.command)).toEqual([
      'lords.forgeWeapons',
    ]);
    expect(node?.actionHints).toEqual({
      'lords.forgeWeapons': smithyIdleView.smithy.offer.costText,
    });
  });

  it('com lote na forja: diz quando termina, desce com o relógio e o botão é "Cancelar"', () => {
    const { forge } = smithyForgingView.smithy;
    expect(forge).not.toBeNull();
    const node = find(tree(smithyForgingView), 'smithy');
    expect(node?.description).toMatch(/^Nv1 · forjando 4 · termina em /);
    expect(node && rowActions(node).map((action) => action.command)).toEqual(['lords.cancelForge']);
    expect(node?.tooltip).toContain(forge?.refundText);
    expect(node?.actionHints).toEqual({ 'lords.cancelForge': forge?.refundText });
    const later = smithyTreeLine(smithyForgingView.smithy, (forge?.endsInSeconds ?? 0) + 1);
    expect(later).toContain('termina agora');
  });
});

describe('os avisos do Ferreiro (V4B-T4.4)', () => {
  const now = Date.parse('2026-10-01T12:00:00.000Z');
  const input = (overrides: Partial<PolicyInput>): PolicyInput => ({
    events: [],
    level: 'essential',
    discreetMode: false,
    mutedUntil: null,
    now,
    history: [],
    ...overrides,
  });
  const shown = (level: PolicyInput['level'], types: GameEvent['type'][]) =>
    decideNotifications(
      input({ level, events: types.map((type) => event(type, `${type}.`)) }),
    ).show.map((entry) => entry.type);

  it('`weaponsForged` só entra em "Todas"; o envio e o cancelamento são ordens do jogador e nunca avisam', () => {
    expect(shown('essential', ['weaponsForged'])).toEqual([]);
    expect(shown('all', ['weaponsForged'])).toEqual(['weaponsForged']);
    expect(isEssential(forged)).toBe(false);
    for (const type of ['forgeStarted', 'forgeCancelled'] as const) {
      expect(shown('all', [type]), type).toEqual([]);
    }
  });

  it('leva ao painel do Ferreiro (aba Feudo) e tem ícone próprio', () => {
    expect(isSmithyEvent(forged)).toBe(true);
    expect(isGuildEvent(forged)).toBe(false);
    expect(isMarketEvent(forged)).toBe(false);
    expect(eventIcon(forged)).toBe('zap');
  });
});

describe('o Relatório de Retorno e o Ferreiro (V4B-T4.4)', () => {
  it('o lote que ficou pronto é "o feudo prosperou"', () => {
    const built = buildReturnReport(smithyIdleView, smithyIdleView, [forged], 6 * 3_600_000);
    expect(built.blocks?.prospered.map((item) => item.text)).toEqual([
      'O Ferreiro forjou 4 armas.',
    ]);
    expect(built.blocks?.prospered[0]).toMatchObject({ topic: 'smithy' });
    expect(built.blocks?.cost).toEqual([]);
  });
});

describe('"Antes de partir" e o Ferreiro (V4B-T4.4)', () => {
  /** A visão com o ferro e a forja postos à mão: o que o golden não traz. */
  const withIron = (view: ViewState, stock: number): ViewState => ({
    ...view,
    resources: view.resources.map((row) => (row.id === 'iron' ? { ...row, stock } : row)),
  });
  const item = (view: ViewState, id: string) => leavingItems(view).find((entry) => entry.id === id);

  it('forja parada com ferro para forjar: o botão é "Forjar…", com a conta da visão', () => {
    const idle = item(smithyIdleView, 'forge');
    expect(idle).toMatchObject({
      severity: 'info',
      command: { id: 'lords.forgeWeapons', label: 'Forjar…' },
    });
    expect(idle?.text).toContain(`${smithyIdleView.smithy.offer.maxAmount} armas`);
    expect(beforeLeaving(smithyIdleView).map((entry) => entry.id)).toContain('forge');
  });

  it('com lote na forja, ou sem ferro que pague uma arma, a forja não é lembrada', () => {
    expect(item(smithyForgingView, 'forge')).toBeUndefined();
    const broke: ViewState = {
      ...smithyIdleView,
      smithy: { ...smithyIdleView.smithy, offer: { ...smithyIdleView.smithy.offer, maxAmount: 0 } },
    };
    expect(item(broke, 'forge')).toBeUndefined();
  });

  it('ferro parado sem Ferreiro de pé: "Vender…", que leva ao balcão do Mercado', () => {
    // O ferro e o excedente vendável são da visão: aqui postos à mão.
    const parked: ViewState = {
      ...marketDayView,
      market: {
        ...marketDayView.market,
        prices: marketDayView.market.prices.map((row) =>
          row.resource === 'iron' ? { ...row, surplusSellable: 40 } : row,
        ),
      },
    };
    const sale = item(withIron(parked, 100), 'iron');
    expect(sale).toMatchObject({
      severity: 'info',
      command: { id: 'lords.openPanel', arg: 'market', label: 'Vender…' },
    });
    expect(sale?.text).toContain('40 de ferro parado');
    // Com o Ferreiro de pé o ferro tem o que o gaste: não é "parado".
    const smithyUp: ViewState = { ...parked, smithy: smithyIdleView.smithy };
    expect(item(withIron(smithyUp, 100), 'iron')).toBeUndefined();
  });

  it('sem excedente vendável (o volume de hoje acabou, a reserva) não há "Vender…"', () => {
    expect(item(initialView, 'iron')).toBeUndefined();
  });
});

describe('o ciclo de leitura e o fim da forja (V4B-T4.3)', () => {
  it('o fim do lote é um prazo que a leitura espera; sem lote, nenhum', () => {
    const { forge } = smithyForgingView.smithy;
    expect(forgeDeadline(smithyForgingView.smithy)).toBe(forge?.endsInSeconds);
    expect(guildDeadlines(smithyForgingView)).toContain(forge?.endsInSeconds);
    expect(forgeDeadline(smithyIdleView.smithy)).toBeNull();
    expect(guildDeadlines(smithyIdleView)).not.toContain(null);
  });
});
