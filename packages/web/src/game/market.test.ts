import {
  type GameEvent,
  ReturnReportSchema,
  type ViewState,
  ViewStateSchema,
} from '@lotg/protocol';
import { describe, expect, it } from 'vitest';

import type { AccountState } from '../account/accountService';
import {
  decideNotifications,
  eventIcon,
  isEssential,
  isMarketEvent,
  isMasterArrival,
  type PolicyInput,
} from '../notifications/policy';
import {
  caravanEscortView,
  caravanView,
  initialView,
  marketDayView,
  marketOpeningView,
  masterWaitingView,
  mastersView,
} from '../test-helpers';
import { buildTree, type TreeNode } from '../ui/treeModel';
import { rowActions } from '../workbench/Tree';
import { beforeLeaving } from './beforeLeaving';
import { guildDeadlines } from './gameSession';
import { buildReturnReport } from './returnReport';

/**
 * O Mercado, as caravanas e os Mestres na árvore, nos avisos, no Relatório de Retorno e em "Antes
 * de partir" (roadmap da v0.3, V3E-T4.5). Os eventos são sintéticos, com a frase e os totais que o
 * motor mandaria; o que se confere é onde cada um cai, com que tom e com que botão. O tratamento
 * completo do relatório é a V3F-T3.
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

describe('o Mercado na árvore (V3E-T4.5)', () => {
  it('"Mercado" diz o preço de compra e a tendência de cada recurso, e o clique só navega', () => {
    const node = find(tree(marketDayView), 'market');
    expect(node).toMatchObject({
      label: 'Mercado',
      description: 'comida 1,515 ▲ · madeira 1,184 ▼ · pedra 2,13 ▲',
      command: { id: 'lords.openPanel', args: ['market'] },
    });
    // O botão "Negociar" é da linha; sem lugar na estrada, não há "Caravana".
    expect(node && rowActions(node).map((action) => action.command)).toEqual(['lords.trade']);
    expect(node?.tooltip).toContain('Cabem mais 50 hoje.');
  });

  it('uma linha por recurso, com os dois preços, a tendência por extenso e o que cabe', () => {
    const food = find(tree(marketDayView), 'price:food');
    expect(food?.description).toBe('compra 1,515 · venda 1,287 · subindo');
    expect(food?.tooltip).toContain(marketDayView.market.prices[0]?.breakdown);
  });

  it('as caravanas em trânsito têm linha, com o destino, a carga e a chegada, sem botão', () => {
    const road = tree(caravanEscortView);
    const first = find(road, 'caravan:caravan-1');
    expect(first).toMatchObject({
      label: 'Caravana a Porto do Rio',
      description: '200 de comida · chega em 57 min',
    });
    expect(first && rowActions(first)).toEqual([]);
    expect(find(road, 'caravan:caravan-2')?.description).toBe('120 de pedra · chega em 1 h');
    // A chegada desce com o relógio da página.
    expect(find(tree(caravanEscortView, 1800), 'caravan:caravan-1')?.description).toBe(
      '200 de comida · chega em 27 min',
    );
  });

  it('com lugar na estrada, a linha ganha "Caravana", com o risco na dica do botão', () => {
    const open = {
      ...caravanEscortView,
      market: {
        ...caravanEscortView.market,
        caravans: [],
        caravanOffer: { ...caravanEscortView.market.caravanOffer, available: true },
      },
    };
    const node = find(tree(open), 'market');
    expect(node && rowActions(node).map((action) => action.text)).toEqual(['Negociar', 'Caravana']);
    expect(node?.actionHints?.['lords.sendCaravan']).toBe(
      caravanEscortView.market.caravanOffer.riskText,
    );
  });

  it('sem o Mercado: "não erguido", sem botão, e a explicação é a frase do servidor', () => {
    const node = find(tree(initialView), 'market');
    expect(node).toMatchObject({ description: 'não erguido', tooltip: initialView.market.text });
    expect(node && rowActions(node)).toEqual([]);
    expect(find(tree(initialView), 'masters')).toBeUndefined();
  });

  it('os Mestres: quem trabalha onde e com que bônus, na frase do servidor; "Mover" em cada linha', () => {
    const masters = find(tree(mastersView), 'masters');
    expect(masters?.description).toBe('2');
    const odo = find(tree(mastersView), 'master:master-1');
    expect(odo).toMatchObject({ label: 'Mestre Odo', description: 'Pedreira · +15% na produção' });
    expect(odo && rowActions(odo)).toEqual([
      { label: 'Mover Mestre Odo', text: 'Mover', command: 'lords.assignMaster' },
    ]);
    expect(odo?.actionHints?.['lords.assignMaster']).toBe(mastersView.workersRules.masterText);
    // Quem ainda se adapta diz que está sem o bônus.
    expect(find(tree(mastersView), 'master:master-2')?.description).toContain('em adaptação');
  });

  it('o Mestre à porta tem a sua linha, com a frase do servidor', () => {
    const waiting = find(tree(masterWaitingView), 'masterWaiting:Mestre Gil');
    expect(waiting).toMatchObject({
      description: 'espera uma vaga nas casas',
      tooltip: 'Mestre Gil espera uma vaga nas casas: entra assim que houver uma.',
    });
    expect(find(tree(masterWaitingView), 'masters')?.description).toBe('1 · 1 à espera de vaga');
    expect(find(tree(masterWaitingView), 'master:master-1')?.description).toBe('Sem edifício');
  });
});

describe('os avisos (V3E-T4.5)', () => {
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

  it('a emboscada é essencial, com tom de alarme; a chegada sem emboscada só entra em "Todas"', () => {
    expect(shown('essential', ['caravanAmbushed'])).toEqual(['caravanAmbushed']);
    expect(isEssential(event('caravanAmbushed', 'x'))).toBe(true);
    expect(shown('essential', ['caravanArrived'])).toEqual([]);
    expect(shown('all', ['caravanArrived'])).toEqual(['caravanArrived']);
  });

  it('a negociação, a mudança de preço e a mudança de edifício do Mestre só entram em "Todas"', () => {
    for (const type of ['marketTraded', 'marketPriceSwing', 'masterAssigned'] as const) {
      expect(shown('essential', [type]), type).toEqual([]);
      expect(shown('all', [type]), type).toEqual([type]);
    }
    // O envio da caravana é ordem do próprio jogador: nunca avisa.
    expect(shown('all', ['caravanSent'])).toEqual([]);
  });

  it('o Mestre que chegou, com vaga ou à espera, é essencial e sem tom de alarme', () => {
    for (const type of ['masterArrived', 'masterWaiting'] as const) {
      expect(shown('essential', [type]), type).toEqual([type]);
      expect(isEssential(event(type, 'x'))).toBe(false);
      expect(isMasterArrival(event(type, 'x'))).toBe(true);
    }
    expect(shown('silent', ['masterArrived', 'caravanAmbushed'])).toEqual([]);
  });

  it('os eventos do Mercado levam à aba Mercado, e cada um tem o seu ícone', () => {
    for (const type of [
      'caravanArrived',
      'caravanAmbushed',
      'marketTraded',
      'marketPriceSwing',
    ] as const) {
      expect(isMarketEvent(event(type, 'x')), type).toBe(true);
      expect(eventIcon(event(type, 'x')), type).toBeDefined();
    }
    expect(isMarketEvent(event('masterArrived', 'x'))).toBe(false);
  });
});

describe('o Relatório de Retorno (V3E-T4.5)', () => {
  const report = (after: ViewState, events: GameEvent[], before: ViewState = after) =>
    buildReturnReport(before, after, events, 6 * 3_600_000);
  const stock = (built: ReturnType<typeof report>, id: string) =>
    built.resources.find((row) => row.id === id);

  it('a venda no Mercado é recebido, e o que foi vendido é gasto: nada vira "produção"', () => {
    const before = marketDayView;
    // Vendeu 150 de madeira por 195 de ouro; o saldo do ouro e o da madeira acompanham.
    const after: ViewState = {
      ...before,
      resources: before.resources.map((row) =>
        row.id === 'gold'
          ? { ...row, stock: row.stock + 195 }
          : row.id === 'wood'
            ? { ...row, stock: row.stock - 150 }
            : row,
      ),
    };
    const built = report(
      after,
      [event('marketTraded', 'Vendeu 150 de madeira.', { spent_wood: 150, gained_gold: 195 })],
      before,
    );
    expect(ReturnReportSchema.safeParse(built).success).toBe(true);
    expect(stock(built, 'gold')).toMatchObject({ received: 195, spent: 0, produced: 0 });
    expect(stock(built, 'wood')).toMatchObject({ received: 0, spent: 150, produced: 0 });
  });

  it('a compra: o recurso é recebido e o ouro é gasto', () => {
    const before = marketDayView;
    const after: ViewState = {
      ...before,
      resources: before.resources.map((row) =>
        row.id === 'gold'
          ? { ...row, stock: row.stock - 120 }
          : row.id === 'stone'
            ? { ...row, stock: row.stock + 60 }
            : row,
      ),
    };
    const built = report(
      after,
      [event('marketTraded', 'Comprou 60 de pedra.', { spent_gold: 120, gained_stone: 60 })],
      before,
    );
    expect(stock(built, 'gold')).toMatchObject({ spent: 120, received: 0, produced: 0 });
    expect(stock(built, 'stone')).toMatchObject({ received: 60, spent: 0, produced: 0 });
  });

  it('a caravana: a carga que partiu é gasto, o ouro que chegou é recebido, e a que chegou inteira é "prosperou"', () => {
    const sent = event('caravanSent', 'A caravana partiu.', { spent_wood: 300 });
    const arrived = event('caravanArrived', 'A caravana chegou a Porto do Rio.', {
      gained_gold: 428.4,
    });
    const built = report(caravanView, [sent, arrived]);
    expect(stock(built, 'wood')?.spent).toBe(300);
    expect(stock(built, 'gold')?.received).toBe(428.4);
    expect(built.blocks?.prospered.map((item) => item.text)).toEqual([
      'A caravana chegou a Porto do Rio.',
    ]);
    expect(built.blocks?.prospered[0]).toMatchObject({ topic: 'caravan' });
    // O envio e a negociação ficam na Crônica: não são desfecho.
    expect(built.blocks?.cost).toEqual([]);
  });

  it('a emboscada custa: "o que exigiu um preço", com o botão das caravanas; a carga perdida NÃO é corte de depósito', () => {
    const ambushed = event('caravanAmbushed', 'A caravana foi emboscada: perdeu 150 de madeira.', {
      gained_gold: 214.2,
      lost_wood: 150,
      lost: 150,
    });
    const built = report(caravanView, [
      event('caravanSent', 'A caravana partiu.', { spent_wood: 300 }),
      ambushed,
    ]);
    expect(built.blocks?.cost).toEqual([
      expect.objectContaining({
        text: 'A caravana foi emboscada: perdeu 150 de madeira.',
        topic: 'caravan',
        severity: 'warning',
        action: { command: 'lords.openPanel', arg: 'caravans', label: 'Ver as caravanas' },
      }),
    ]);
    // `lost_wood` da emboscada é carga que a estrada levou, e não recompensa cortada pelo
    // depósito: nada "foi ao chão", e a madeira não ganha parcela de corte.
    const wood = stock(built, 'wood');
    expect(wood?.cut).toBe(0);
    expect(wood?.wasted).toBe(0);
    expect(wood?.spent).toBe(300);
    expect(built.blocks?.cost.some((item) => (item.topic ?? '').startsWith('storage:'))).toBe(
      false,
    );
  });

  it('o Mestre que chegou é "o feudo prosperou"', () => {
    const built = report(mastersView, [event('masterArrived', 'Mestre Odo chegou ao feudo.')]);
    expect(built.blocks?.prospered).toEqual([
      { text: 'Mestre Odo chegou ao feudo.', topic: 'master' },
    ]);
    expect(built.blocks?.cost).toEqual([]);
  });
});

describe('"Antes de partir" (V3E-T4.5)', () => {
  const ids = (view: ViewState) => beforeLeaving(view).map((item) => item.id);

  it('o Mestre sem edifício é sugestão, com o botão que abre a alocação; com todos no ofício, nada', () => {
    const [item] = beforeLeaving(masterWaitingView).filter((entry) => entry.id === 'master');
    expect(item).toEqual({
      id: 'master',
      severity: 'info',
      text: 'Mestre Odo está sem edifício e não soma o bônus.',
      command: { id: 'lords.assignMaster', arg: 'master-1', label: 'Alocar Mestre' },
    });
    expect(ids(mastersView)).not.toContain('master');
  });

  it('o Mestre que espera uma vaga: a frase do servidor', () => {
    const waiting = beforeLeaving(masterWaitingView).find((entry) => entry.id === 'masterWaiting');
    expect(waiting?.text).toBe('Mestre Gil espera uma vaga nas casas: entra assim que houver uma.');
    expect(ids(mastersView)).not.toContain('masterWaiting');
  });

  it('a caravana sem escolta que chega dentro do horizonte avisa o risco da visão; com escolta, nada', () => {
    const [item] = beforeLeaving(caravanView).filter((entry) => entry.id === 'caravan');
    expect(item?.text).toBe(
      `A caravana com 300 de madeira chega em 1 h, sem escolta. ${caravanView.market.caravanOffer.riskText}`,
    );
    expect(item?.command).toEqual({
      id: 'lords.openPanel',
      arg: 'caravans',
      label: 'Ver as caravanas',
    });
    const [only] = caravanEscortView.market.caravans.filter((entry) => entry.escortName !== null);
    const escorted = {
      ...caravanEscortView,
      market: { ...caravanEscortView.market, caravans: only === undefined ? [] : [only] },
    };
    expect(ids(escorted)).not.toContain('caravan');
    expect(ids(marketOpeningView)).not.toContain('caravan');
  });
});

describe('a leitura antecipada e as visões do motor', () => {
  it('as visões novas do golden passam no esquema do protocolo', () => {
    for (const view of [
      marketOpeningView,
      marketDayView,
      caravanView,
      mastersView,
      masterWaitingView,
    ]) {
      expect(ViewStateSchema.safeParse(view).success).toBe(true);
    }
  });

  it('a Guilda não guarda os prazos do Mercado: a leitura vem pela lista própria', () => {
    expect(guildDeadlines(caravanView)).not.toContain(
      caravanView.market.caravans[0]?.arrivesInSeconds,
    );
  });
});
