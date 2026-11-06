import { balance, type DifficultyId } from '@lotg/content';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { advanceTo } from './advance';
import { applyCommand } from './commands';
import { DAY_MS, YEAR_MS } from './clock';
import { currentShape } from './migrations';
import { readySiege } from './siege.test-helpers';
import { DAY } from './test-helpers';
import type { GameEvent, GameState, SiegeCommand } from './types';
import { realToGameMs } from './units';

function divided(state: GameState, stops: number[]): { state: GameState; events: GameEvent[] } {
  const events: GameEvent[] = [];
  let current = state;
  for (const at of stops) {
    const step = advanceTo(current, at);
    current = step.state;
    events.push(...step.events);
  }
  return { state: current, events };
}

function configureArmy(state: GameState, strong: boolean): void {
  if (strong) return;
  state.army.units.shieldbearer = 2;
  state.army.units.archer = 0;
  state.army.formations[0]!.posts.left.front = { unit: 'shieldbearer', count: 1 };
  state.army.formations[0]!.posts.center.front = { unit: 'shieldbearer', count: 1 };
  state.army.formations[0]!.posts.right.front = null;
  state.army.formations[0]!.posts.left.back = null;
  state.army.formations[0]!.posts.center.back = null;
  state.army.formations[0]!.posts.right.back = null;
}

describe('propriedades do cerco: divisão de intervalo exata (V4G-T2.9)', () => {
  it('o cerco inteiro dentro do intervalo com cortes arbitrários entre ondas preserva estado, eventos e RNG', () => {
    fc.assert(
      fc.property(
        fc.constantFrom<DifficultyId>('peasant', 'lord', 'ironKing'),
        fc.constantFrom(0.5, 1, 3),
        fc.integer({ min: 1, max: 999999 }),
        fc.boolean(),
        fc.uniqueArray(fc.integer({ min: 1, max: 999 }), { minLength: 2, maxLength: 5 }),
        (difficulty, timeScale, seed, strong, randomCutFactors) => {
          const state = readySiege(difficulty, timeScale);
          state.seed = `prop-cerco-inteiro-${seed}`;
          configureArmy(state, strong);

          const wave1At = state.siege!.atMs;
          const interval = realToGameMs(balance.siege.waveIntervalRealMs, timeScale);
          const start = state.lastProcessedAt;
          const end = wave1At + 3 * interval + DAY;
          const totalDuration = end - start;

          const randomCuts = randomCutFactors.map(
            (f) => start + Math.floor((f / 1000) * totalDuration),
          );
          const cuts = [
            ...new Set([
              start + 10,
              wave1At,
              wave1At + Math.floor(interval / 2),
              wave1At + interval,
              wave1At + Math.floor((3 * interval) / 2),
              wave1At + 2 * interval,
              ...randomCuts,
              end,
            ]),
          ]
            .filter((t) => t > start && t <= end)
            .sort((a, b) => a - b);

          const direct = advanceTo(state, end);
          const split = divided(state, cuts);

          expect(split.state).toEqual(direct.state);
          expect(split.events).toEqual(direct.events);

          expect(direct.state.siege!.result).not.toBeNull();
          expect(currentShape(direct.state, '')).toBeNull();
          expect(Object.keys(direct.state.rng).some((k) => k.startsWith('battle:'))).toBe(false);
        },
      ),
      { numRuns: 25 },
    );
  });

  it('divisão de intervalo antes e depois da decisão siegeWave entre ondas (troca de formação ou reparo)', () => {
    fc.assert(
      fc.property(
        fc.constantFrom<DifficultyId>('peasant', 'lord', 'ironKing'),
        fc.constantFrom(0.5, 1, 3),
        fc.integer({ min: 1, max: 999999 }),
        fc.double({ min: 0.1, max: 0.9, noNaN: true }),
        fc.constantFrom<'swap' | 'repair' | 'none'>('swap', 'repair', 'none'),
        (difficulty, timeScale, seed, decisionFraction, action) => {
          const state = readySiege(difficulty, timeScale);
          state.seed = `prop-decisao-${seed}`;
          // No ano 1 a 1ª onda tem um terço do tamanho (9 inimigos em Camponês): os 20 arqueiros e
          // a Torre Nv5 podem liquidar a frente na fase de tiro antes do corpo a corpo e deixar a
          // muralha intacta (WALL_INTACT). Um ponto de dano prévio garante que emergencyRepair
          // seja aceito em toda dificuldade e semente, sem afrouxar a asserção de aceite.
          state.settlement.wall.hp.center -= 1;

          state.ids.formation = 2;
          state.army.formations.push({
            ...JSON.parse(JSON.stringify(state.army.formations[0]!)),
            id: 'formation-2',
            name: 'Alternativa',
          });

          const wave1At = state.siege!.atMs;
          const interval = realToGameMs(balance.siege.waveIntervalRealMs, timeScale);
          const start = state.lastProcessedAt;
          const decisionAt = wave1At + Math.floor(interval * decisionFraction);
          const end = wave1At + 3 * interval + DAY;

          // 1. Antes da decisão: avanço direto vs avanços cortados
          const directBefore = advanceTo(state, decisionAt);
          const cutsBefore = [
            start + Math.floor((wave1At - start) / 2),
            wave1At,
            wave1At + Math.floor((decisionAt - wave1At) / 2),
            decisionAt,
          ]
            .filter((t) => t > start && t <= decisionAt)
            .sort((a, b) => a - b);

          const splitBefore = divided(state, cutsBefore);
          expect(splitBefore.state).toEqual(directBefore.state);
          expect(splitBefore.events).toEqual(directBefore.events);
          expect(currentShape(directBefore.state, '')).toBeNull();

          // 2. Aplicação da decisão (ou ausência de comando)
          let commandToApply: SiegeCommand | null = null;
          if (action === 'swap') {
            commandToApply = {
              commandId: `cmd-swap-${seed}`,
              type: 'swapWaveFormation',
              payload: { wave: 2, formationId: 'formation-2' },
            };
          } else if (action === 'repair') {
            commandToApply = {
              commandId: `cmd-repair-${seed}`,
              type: 'emergencyRepair',
              payload: { wave: 2 },
            };
          }

          let stateAfterCmdDirect = directBefore.state;
          let stateAfterCmdSplit = splitBefore.state;

          if (commandToApply !== null) {
            const resDirect = applyCommand(directBefore.state, commandToApply, decisionAt);
            const resSplit = applyCommand(splitBefore.state, commandToApply, decisionAt);
            expect(resDirect.ok).toBe(true);
            expect(resSplit.ok).toBe(true);
            if (!resDirect.ok || !resSplit.ok) throw new Error('Falha no comando de decisão');
            stateAfterCmdDirect = resDirect.state;
            stateAfterCmdSplit = resSplit.state;
            expect(stateAfterCmdSplit).toEqual(stateAfterCmdDirect);
          }

          // 3. Depois da decisão: avanço direto vs avanços cortados até o fim
          const directAfter = advanceTo(stateAfterCmdDirect, end);
          const cutsAfter = [
            decisionAt + Math.floor((wave1At + interval - decisionAt) / 2),
            wave1At + interval,
            wave1At + interval + Math.floor(interval / 2),
            wave1At + 2 * interval,
            end,
          ]
            .filter((t) => t > decisionAt && t <= end)
            .sort((a, b) => a - b);

          const splitAfter = divided(stateAfterCmdSplit, cutsAfter);
          expect(splitAfter.state).toEqual(directAfter.state);
          expect(splitAfter.events).toEqual(directAfter.events);
          expect(directAfter.state.siege!.result).not.toBeNull();
          expect(currentShape(directAfter.state, '')).toBeNull();
          expect(Object.keys(directAfter.state.rng).some((k) => k.startsWith('battle:'))).toBe(
            false,
          );
        },
      ),
      { numRuns: 20 },
    );
  });

  it('o jogador ausente por 30 dias atravessa o cerco, rescaldo e virada de ano com estado e eventos idênticos', () => {
    fc.assert(
      fc.property(
        fc.constantFrom<DifficultyId>('peasant', 'lord', 'ironKing'),
        fc.constantFrom(0.5, 1, 3),
        fc.integer({ min: 1, max: 999999 }),
        fc.boolean(),
        fc.uniqueArray(fc.integer({ min: 1, max: 999 }), { minLength: 3, maxLength: 6 }),
        (difficulty, timeScale, seed, strong, randomCutFactors) => {
          const state = readySiege(difficulty, timeScale);
          state.seed = `prop-30-dias-${seed}`;
          configureArmy(state, strong);

          const start = state.lastProcessedAt;
          const end = start + 30 * DAY_MS;
          const totalDuration = end - start;
          const wave1At = state.siege!.atMs;
          const interval = realToGameMs(balance.siege.waveIntervalRealMs, timeScale);

          const randomCuts = randomCutFactors.map(
            (f) => start + Math.floor((f / 1000) * totalDuration),
          );
          const cuts = [
            ...new Set([
              wave1At,
              wave1At + interval,
              wave1At + 2 * interval,
              YEAR_MS,
              YEAR_MS + balance.siege.reconstruction.days * DAY_MS,
              ...randomCuts,
              end,
            ]),
          ]
            .filter((t) => t > start && t <= end)
            .sort((a, b) => a - b);

          const direct = advanceTo(state, end);
          const split = divided(state, cuts);

          expect(split.state).toEqual(direct.state);
          expect(split.events).toEqual(direct.events);

          expect(direct.state.siege!.result).not.toBeNull();
          expect(currentShape(direct.state, '')).toBeNull();
          expect(Object.keys(direct.state.rng).some((k) => k.startsWith('battle:'))).toBe(false);

          // Confere que eventos essenciais do cerco foram gerados
          const eventTypes = direct.events.map((e) => e.type);
          expect(eventTypes).toContain('siegeWaveFought');
          expect(
            eventTypes.some((t) => t === 'siegeWon' || t === 'siegeGlorious' || t === 'siegeFell'),
          ).toBe(true);
        },
      ),
      { numRuns: 20 },
    );
  });
});
