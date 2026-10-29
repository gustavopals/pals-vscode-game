import type { GameEvent, ViewState } from '@lotg/protocol';
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
import {
  armyIdleView,
  armyCampaignView,
  armyTrainingView,
  coldView,
  expeditionCrossroadsView,
  guildArrearsView,
  initialView,
  threatIncomingView,
} from '../test-helpers';
import { buildTree, type TreeNode } from '../ui/treeModel';
import { rowActions } from '../workbench/Tree';
import { beforeLeaving, leavingItems } from './beforeLeaving';
import { guildDeadlines } from './gameSession';
import { statusBar } from '../ui/format';
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
    expect(node?.description).toBe('Nv2 · 3/40 soldados · sem Defesa ativa');
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
      /^Nv2 · 3\/40 soldados · sem Defesa ativa · treinando 4 arqueiros · termina em /,
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

  it('a campanha espera a batalha na marcha e o retorno na volta; ignora o zero já resolvido', () => {
    const campaign = armyCampaignView.army.campaign!;
    const marching = guildDeadlines(armyCampaignView);
    expect(marching).toContain(campaign.battleInSeconds);
    expect(marching).not.toContain(campaign.returnsInSeconds);
    const returning: ViewState = {
      ...armyCampaignView,
      army: {
        ...armyCampaignView.army,
        campaign: { ...campaign, phase: 'returning', battleInSeconds: 0, returnsInSeconds: 5 },
      },
    };
    expect(guildDeadlines(returning)).toContain(5);
    expect(guildDeadlines(returning)).not.toContain(0);
    expect(guildDeadlines(armyIdleView)).not.toContain(campaign.battleInSeconds);
  });
});

describe('a campanha em Antes de partir (V4F-T3, revisão 2)', () => {
  const campaign = armyCampaignView.army.campaign!;
  const threat = threatIncomingView.threat;
  if (!threat.known || threat.incoming === null) {
    throw new Error('O cenário precisa de uma incursão conhecida na visão.');
  }
  const withRaid = (inSeconds: number, phase = campaign.phase): ViewState => ({
    ...armyCampaignView,
    army: { ...armyCampaignView.army, campaign: { ...campaign, phase } },
    threat: {
      ...threat,
      incoming: { ...threat.incoming!, inSeconds },
    },
  });

  it.each(['marching', 'returning'] as const)(
    'a incursão antes do retorno é perigo, mesmo com Defesa ativa e campanha %s',
    (phase) => {
      const raid = beforeLeaving(withRaid(3600, phase))[0];
      expect(raid).toMatchObject({
        id: 'raid',
        severity: 'danger',
        command: { id: 'lords.openPanel', arg: 'army', label: 'Ver o Exército' },
      });
      expect(raid?.text).toContain(campaign.text);
      expect(raid?.text).toContain('Retorno em 2 h');
      expect(raid?.text).toContain('Soldados e comandantes em campanha não defendem o feudo');
      expect(raid?.text).not.toContain('Nenhuma formação guarda o feudo');
      expect(leavingItems(withRaid(3600)).some((item) => item.id === 'army-campaign')).toBe(false);
    },
  );

  it('a incursão no mesmo instante do retorno ainda encontra os esquadrões fora', () => {
    expect(beforeLeaving(withRaid(7200))[0]?.severity).toBe('danger');
    const after = leavingItems(withRaid(7201)).find((item) => item.id === 'raid');
    expect(after?.severity).toBe('warning');
    expect(after?.text).not.toContain(campaign.text);
    expect(after?.command.arg).toBe('threat');
  });

  it('sem incursão conhecida, lembra a ausência sem inventar ataque ou falta de Defesa ativa', () => {
    const items = leavingItems(armyCampaignView);
    const away = items.find((item) => item.id === 'army-campaign');
    expect(away).toMatchObject({
      severity: 'warning',
      command: { id: 'lords.openPanel', arg: 'army' },
    });
    expect(away?.text).toContain(campaign.text);
    expect(away?.text).toContain('Retorno em 2 h');
    expect(items.map((item) => item.id)).not.toContain('raid');
    expect(items.map((item) => item.id)).not.toContain('army-defense');
    expect(leavingItems(armyIdleView).map((item) => item.id)).not.toContain('army-campaign');
  });
});

describe('o exército sem Defesa ativa (V4C-T3.4)', () => {
  const input = {
    connection: { kind: 'online' as const },
    discreetMode: false,
    signedIn: true,
    elapsedSeconds: 0,
    pending: 0,
  };

  it.each([coldView, expeditionCrossroadsView, guildArrearsView, threatIncomingView])(
    'não encobre urgências nem decisões que já tomavam a barra',
    (view) => {
      const before = statusBar({ ...input, view });
      const withArmy = { ...view, army: armyIdleView.army };
      expect(statusBar({ ...input, view: withArmy })).toEqual(before);
    },
  );

  it('mantém o modo discreto e o aviso de falta de conexão', () => {
    const view = armyIdleView;
    expect(statusBar({ ...input, view, discreetMode: true }).text).not.toContain('Defesa');
    expect(
      statusBar({
        ...input,
        view,
        connection: { kind: 'offline', retryInMs: 5000, attempt: 1 },
      }).text,
    ).toContain('Sem ligação');
  });

  it('"Antes de partir": um aviso que leva ao Exército; sem soldados, nada', () => {
    const item = beforeLeaving(armyIdleView).find((entry) => entry.id === 'army-defense');
    expect(item?.severity).toBe('warning');
    expect(item?.command).toEqual({
      id: 'lords.openPanel',
      arg: 'army',
      label: 'Ativar uma formação',
    });
    const none = { ...armyIdleView, army: { ...armyIdleView.army, total: 0 } };
    expect(beforeLeaving(none).some((entry) => entry.id === 'army-defense')).toBe(false);
  });

  it('a barra de status: aviso sem alarme, e não é decisão pendente', () => {
    const bar = statusBar({
      view: armyIdleView,
      connection: { kind: 'online' },
      discreetMode: false,
      signedIn: true,
      elapsedSeconds: 0,
      pending: 0,
    });
    expect(bar.text).toContain('Sem Defesa ativa');
    expect(bar.target).toBe('army');
    expect(bar.alarm).toBeUndefined();
    expect(armyIdleView.pendingDecisions).toEqual([]);
  });
});
