import type { GameEvent } from '@lotg/protocol';
import { describe, expect, it } from 'vitest';

import type { AccountState } from '../account/accountService';
import {
  decideNotifications,
  eventIcon,
  isArmyEvent,
  isEssential,
  isGuildEvent,
  isMarketEvent,
  isSmithyEvent,
  type PolicyInput,
} from '../notifications/policy';
import { armyIdleView, armyTrainingView, initialView } from '../test-helpers';
import { buildTree, type TreeNode } from '../ui/treeModel';
import { rowActions } from '../workbench/Tree';
import { guildDeadlines } from './gameSession';
import { buildReturnReport } from './returnReport';

/**
 * O Exército na árvore, nos avisos, no ciclo de leitura e no Relatório de Retorno (V4C-T3.2 e a
 * parte da T3.4 que é só do Quartel). As visões têm o `army` posto à mão; o evento é sintético,
 * com a frase que o motor mandaria. Nada aqui confere um número de regra: o que se confere é onde
 * cada coisa cai, com que tom e com que botão.
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

const tree = (view: typeof armyIdleView, elapsedSeconds = 0) =>
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
const commandsOf = (node: TreeNode | undefined) =>
  node === undefined ? [] : rowActions(node).map((action) => action.command);

const trained = event('soldiersTrained', 'Terminou o treino de 4 arqueiros.', { amount: 4 });

describe('o Exército na árvore (V4C-T3.2)', () => {
  it('a linha "Exército" fica sob o Feudo, depois do Ferreiro', () => {
    const ids = (find(tree(armyIdleView), 'fief')?.children ?? []).map((node) => node.id);
    expect(ids.indexOf('army')).toBe(ids.indexOf('smithy') + 1);
  });

  it('sem o Quartel a linha diz que não foi erguido, com a frase do servidor, e sem botão', () => {
    const node = find(tree(initialView), 'army');
    expect(node).toMatchObject({
      label: 'Exército',
      description: 'não erguido',
      tooltip: initialView.army.text,
      command: { id: 'lords.openPanel', args: ['army'] },
    });
    expect(commandsOf(node)).toEqual([]);
  });

  it('de pé, com soldados e pátio livre: "Treinar" e "Dispensar"', () => {
    const node = find(tree(armyIdleView), 'army');
    expect(node?.description).toBe('Nv2 · 3/40 soldados');
    expect(commandsOf(node)).toEqual(['lords.trainSoldiers', 'lords.disbandSoldiers']);
  });

  it('de pé e sem soldados: só "Treinar"', () => {
    const empty = {
      ...armyIdleView,
      army: { ...armyIdleView.army, total: 0 },
    };
    expect(commandsOf(find(tree(empty), 'army'))).toEqual(['lords.trainSoldiers']);
  });

  it('com lote no pátio: diz quando termina, desce com o relógio e o botão é "Cancelar"', () => {
    const { training } = armyTrainingView.army;
    const node = find(tree(armyTrainingView), 'army');
    expect(node?.description).toMatch(
      /^Nv2 · 3\/40 soldados · treinando 4 arqueiros · termina em /,
    );
    expect(commandsOf(node)).toEqual(['lords.cancelTraining', 'lords.disbandSoldiers']);
    expect(node?.tooltip).toContain(training?.cancelRefundText);
    expect(node?.actionHints).toEqual({ 'lords.cancelTraining': training?.cancelRefundText });
    expect(find(tree(armyTrainingView, 601), 'army')?.description).toContain('termina agora');
  });
});

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

describe('os avisos do Quartel (V4C-T3.2)', () => {
  it('`soldiersTrained` só entra em "Todas"; início, cancelamento e dispensa são ordens do jogador', () => {
    expect(shown('essential', ['soldiersTrained'])).toEqual([]);
    expect(shown('all', ['soldiersTrained'])).toEqual(['soldiersTrained']);
    expect(isEssential(trained)).toBe(false);
    for (const type of ['trainingStarted', 'trainingCancelled', 'soldiersDisbanded'] as const) {
      expect(shown('all', [type]), type).toEqual([]);
    }
  });

  it('leva à aba Exército e tem ícone próprio', () => {
    expect(isArmyEvent(trained)).toBe(true);
    expect(isGuildEvent(trained)).toBe(false);
    expect(isMarketEvent(trained)).toBe(false);
    expect(isSmithyEvent(trained)).toBe(false);
    expect(eventIcon(trained)).toBe('organization');
  });
});

describe('o Relatório de Retorno e o Exército (V4C-T3.2)', () => {
  it('o lote que saiu do pátio é "o feudo prosperou"', () => {
    const built = buildReturnReport(armyIdleView, armyIdleView, [trained], 6 * 3_600_000);
    expect(built.blocks?.prospered.map((item) => item.text)).toEqual([
      'Terminou o treino de 4 arqueiros.',
    ]);
    expect(built.blocks?.prospered[0]).toMatchObject({ topic: 'army' });
    expect(built.blocks?.cost).toEqual([]);
  });
});

describe('o ciclo de leitura e o fim do treino (V4C-T3.2)', () => {
  it('o fim do lote é um prazo que a leitura espera; sem lote, nenhum', () => {
    const { training } = armyTrainingView.army;
    expect(guildDeadlines(armyTrainingView)).toContain(training?.endsInSeconds);
    expect(guildDeadlines(armyIdleView)).not.toContain(null);
  });
});
