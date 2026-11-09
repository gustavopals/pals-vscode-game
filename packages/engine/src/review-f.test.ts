import { expeditionModels } from '@lotg/content';
import { describe, expect, it } from 'vitest';

import { advanceTo } from './advance';
import { availableUnits } from './campaign';
import { settleHordeTiles } from './hordePlan';
import { currentShape } from './migrations';
import { cloneState } from './state';
import { accept, addHero, AUTUMN, campaignYard, command, HOUR, refuse, send } from './test-helpers';
import type { GameState } from './types';
import { deriveViewState } from './view';

function sabotageYard(): GameState {
  const state = campaignYard(AUTUMN);
  state.settlement.buildings.guild = 2;
  state.settlement.buildings.tavern = 2;
  for (const name of ['Rolf', 'Isolda']) addHero(state, { name, level: 10 });
  state.guild.heroes[0]!.level = 10;
  settleHordeTiles(state, AUTUMN, []);
  return accept(state, command('setActiveFormation', { id: null })).state;
}

function completeTrip(start: GameState): GameState {
  let state = send(start, 'sabotage', ['hero-1', 'hero-2', 'hero-3'], 'balanced', 0).state;
  const model = expeditionModels.find((entry) => entry.id === 'sabotage')!;
  for (let step = 0; step < 10 && state.guild.expeditions.length > 0; step += 1) {
    const trip = state.guild.expeditions[0]!;
    if (trip.crossroads === null) state = advanceTo(state, trip.nodeEndsAtMs!).state;
    else {
      const node = model.variants[trip.variant]!.nodes[trip.nodeId]!;
      if (node.kind !== 'crossroads') throw new Error('Encruzilhada esperada.');
      state = accept(
        state,
        command('chooseExpeditionPath', {
          expeditionId: trip.id,
          optionId: node.posture.balanced,
        }),
      ).state;
    }
  }
  expect(state.guild.expeditions).toEqual([]);
  expect(currentShape(state, '')).toBeNull();
  return state;
}

describe('V4F-T4.1 · ataques adversariais às ordens', () => {
  it('dois heróis não gastam tentativa, identidade ou RNG, nem deixam reserva', () => {
    const state = sabotageYard();
    const before = cloneState(state);
    expect(
      refuse(
        state,
        command('sendExpedition', {
          modelId: 'sabotage',
          heroIds: ['hero-1', 'hero-2'],
          posture: 'balanced',
        }),
      ).code,
    ).toBe('TEAM_SIZE');
    expect(state).toEqual(before);
    expect(currentShape(state, '')).toBeNull();
  });

  it('a quarta sabotagem após três viagens reais continua recusada sem efeitos', () => {
    let state = sabotageYard();
    for (let attempt = 0; attempt < 3; attempt += 1) state = completeTrip(state);
    expect(state.horde.sabotages.attempts).toBe(3);
    expect(state.guild.reports).toHaveLength(3);
    expect(state.lastProcessedAt).toBe(AUTUMN + 18 * HOUR);
    const before = cloneState(state);
    expect(
      refuse(
        state,
        command('sendExpedition', {
          modelId: 'sabotage',
          heroIds: ['hero-1', 'hero-2', 'hero-3'],
          posture: 'balanced',
        }),
      ).code,
    ).toBe('SABOTAGE_LIMIT');
    expect(
      deriveViewState(state, state.lastProcessedAt).guild.available.find(
        (offer) => offer.modelId === 'sabotage',
      ),
    ).toMatchObject({ canSend: false, sabotage: { attemptsLeft: 0 } });
    expect(state).toEqual(before);
  });

  it('o comandante da Defesa ativa não sabota; desativar libera a partida', () => {
    const state = accept(
      sabotageYard(),
      command('setActiveFormation', { id: 'formation-1' }),
    ).state;
    const order = command('sendExpedition', {
      modelId: 'sabotage',
      heroIds: ['hero-1', 'hero-2', 'hero-3'],
      posture: 'balanced',
    });
    const before = cloneState(state);
    expect(refuse(state, order).code).toBe('HERO_BUSY');
    expect(state).toEqual(before);
    const freed = accept(state, command('setActiveFormation', { id: null })).state;
    expect(accept(freed, order).state.guild.heroes[0]!.status).toBe('expedition');
  });

  it('trocar a Defesa não permite apagar a formação enviada nem defender com sua reserva', () => {
    const start = campaignYard();
    const sent = accept(start, command('attackCamp', { formationId: 'formation-1' })).state;
    expect(refuse(sent, command('deleteFormation', { id: 'formation-1' })).code).toBe(
      'FORMATION_ACTIVE',
    );
    const inactive = accept(sent, command('setActiveFormation', { id: null })).state;
    expect(refuse(inactive, command('deleteFormation', { id: 'formation-1' })).code).toBe(
      'FORMATION_IN_CAMPAIGN',
    );
    expect(deriveViewState(inactive, 0).army.formations[0]!.canDelete).toBe(false);
    const defending = accept(inactive, command('setActiveFormation', { id: 'formation-1' })).state;
    expect(Object.values(availableUnits(defending)).every((count) => count === 0)).toBe(true);
    defending.horde.scheduledRaids.push({
      id: 'review-f-raid',
      kind: 'threat',
      atMs: HOUR,
      enemy: 'raiders',
      size: 'light',
      announcedAtMs: null,
      composition: [{ wing: 'center', line: 'front', unit: 'raider', count: 6 }],
    });
    const invaded = advanceTo(defending, HOUR);
    const report = invaded.state.army.reports.find((entry) => entry.mode === 'defense')!;
    expect(report).toBeDefined();
    expect(report.casualties.filter((entry) => entry.owner === 'player')).toEqual([]);
    expect(report.commanders).toEqual([]);
    expect(invaded.state.army.campaign).not.toBeNull();
    expect(currentShape(invaded.state, '')).toBeNull();
  });

  it('o Acampamento vencido não paga saque nem reduz Ameaça pela segunda vez no ano', () => {
    const sent = accept(
      campaignYard(),
      command('attackCamp', { formationId: 'formation-1' }),
    ).state;
    const returned = advanceTo(sent, sent.army.campaign!.returnsAtMs);
    expect(returned.state.army.reports.at(-1)!.outcome).toBe('victory');
    expect(returned.events.filter((entry) => entry.type === 'threatTileCleared')).toHaveLength(1);
    expect(returned.state.map.tiles.raiderCamp!.threatActive).toBe(false);
    const before = cloneState(returned.state);
    expect(refuse(returned.state, command('attackCamp', { formationId: 'formation-1' })).code).toBe(
      'CAMP_NOT_FOUND',
    );
    expect(returned.state).toEqual(before);
    expect(currentShape(returned.state, '')).toBeNull();
  });
});
