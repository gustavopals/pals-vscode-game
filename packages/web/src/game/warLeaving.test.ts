import type { ViewState } from '@lotg/protocol';
import { describe, expect, it } from 'vitest';

import {
  armyIdleView,
  expeditionCrossroadsView,
  guildArrearsView,
  impoverishedView,
  palisadeRaisedView,
  siegeWaveView,
  smithyForgingView,
  smithyIdleView,
  unlockedView,
  withPlanned,
} from '../test-helpers';
import { beforeLeaving, leavingItems } from './beforeLeaving';

const HOUR = 3600;
const prepared = withPlanned(unlockedView, [
  {
    building: 'farm',
    autoStart: true,
    waiting: { reason: 'resources', text: 'aguarda madeira', etaSeconds: HOUR },
  },
]);
const blockedReason = 'A forja pede 7 de ferro e 3 de madeira; o estoque não paga o lote.';
const noMaterials: ViewState['smithy'] = {
  ...smithyIdleView.smithy,
  offer: { ...smithyIdleView.smithy.offer, maxAmount: 0, blockedReason },
};
const scheduled: ViewState['siege'] = {
  ...siegeWaveView.siege!,
  current: 0,
  scheduledInSeconds: 2 * HOUR,
};
const crowded: ViewState = {
  ...prepared,
  population: { ...prepared.population, free: 2 },
  resources: prepared.resources.map((row) =>
    row.id === 'wood' ? { ...row, full: true, wastingPerHour: 5 } : row,
  ),
  famine: impoverishedView.famine,
  winter: impoverishedView.winter,
  guild: { ...expeditionCrossroadsView.guild, wage: guildArrearsView.guild.wage },
  threat: palisadeRaisedView.threat,
  army: armyIdleView.army,
  siege: scheduled,
  pendingDecisions: [],
  smithy: noMaterials,
};
const ids = (view: ViewState) => leavingItems(view).map((item) => item.id);

describe('a ordem da guerra em Antes de partir (V4H-T4.1, F-6 da v0.3)', () => {
  it('conserva incursão, Plano, muralha, comida, lenha, soldo, encruzilhada, depósitos, braços e forja', () => {
    const expected = [
      'raid',
      'siege:plan',
      'wall',
      'food',
      'firewood',
      'wage',
      'crossroads',
      'storage:warehouse',
      'idle',
      'forge',
    ];
    expect(ids(crowded).filter((id) => expected.includes(id))).toEqual(expected);
    // A incursão já explica a falta da Defesa ativa, sem repeti-la em outra linha.
    expect(ids(crowded)).not.toContain('army-defense');
    expect(beforeLeaving(crowded).map((item) => item.id)).toEqual([
      'raid',
      'siege:plan',
      'food',
      'firewood',
      'wage',
    ]);
  });

  it('a decisão entre ondas abre a lista; o corte escolhe os cinco perigos e conserva sua ordem', () => {
    const between = {
      ...crowded,
      siege: siegeWaveView.siege,
      pendingDecisions: siegeWaveView.pendingDecisions,
    };
    expect(ids(between)[0]).toBe('siegeWave:siege-1-2');
    expect(ids(between)).not.toContain('siege:plan');
    expect(beforeLeaving(between).map((item) => item.id)).toEqual([
      'siegeWave:siege-1-2',
      'raid',
      'food',
      'firewood',
      'wage',
    ]);
    expect(beforeLeaving(between, ['siegeWave:siege-1-2']).map((item) => item.id)).not.toContain(
      'siegeWave:siege-1-2',
    );
  });

  it('sem incursão conhecida, lembra a Defesa ativa antes das encruzilhadas e dos depósitos', () => {
    const quiet = { ...crowded, threat: { ...crowded.threat, incoming: null } };
    const order = ids(quiet);
    expect(order).toContain('army-defense');
    expect(order.indexOf('wage')).toBeLessThan(order.indexOf('army-defense'));
    expect(order.indexOf('army-defense')).toBeLessThan(order.indexOf('crossroads'));
    expect(order.indexOf('crossroads')).toBeLessThan(order.indexOf('storage:warehouse'));
  });

  it('o ferro para a forja usa o motivo da oferta e leva ao painel, sem enviar lote recusado', () => {
    const item = leavingItems({ ...prepared, smithy: noMaterials }).find(
      (item) => item.id === 'forge',
    );
    expect(item).toMatchObject({
      severity: 'warning',
      command: { id: 'lords.openPanel', arg: 'smithy', label: 'Ver o Ferreiro' },
    });
    expect(item?.text).toContain(blockedReason);
  });

  it('não inventa falta de ferro sem motivo público, com forja ocupada ou Ferreiro ausente', () => {
    const forge = (smithy: ViewState['smithy']) =>
      leavingItems({ ...prepared, smithy }).find((item) => item.id === 'forge');
    expect(
      forge({ ...noMaterials, offer: { ...noMaterials.offer, blockedReason: null } }),
    ).toBeUndefined();
    expect(forge({ ...noMaterials, forge: smithyForgingView.smithy.forge })).toBeUndefined();
    expect(forge({ ...noMaterials, built: false })).toBeUndefined();
    expect(forge(smithyIdleView.smithy)?.command.id).toBe('lords.forgeWeapons');
  });

  it('Plano completo, Cerco iniciado ou encerrado não repetem o preparo padrão', () => {
    for (const siege of [
      { ...scheduled!, plan: { 1: 'formation-1', 2: 'formation-1', 3: 'formation-1' } },
      { ...scheduled!, current: 1 },
      { ...scheduled!, result: 'victory' as const },
      null,
    ])
      expect(ids({ ...prepared, siege })).not.toContain('siege:plan');
  });
});
