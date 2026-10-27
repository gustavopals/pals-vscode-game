import { describe, expect, it } from 'vitest';

import { toCsv } from '../report';
import { simulate, type SimulationResult } from '../simulate';
import { economicoPolicies } from './economico';
import { militarPolicies } from './militar';

/** O fim da semana pode não ter sobreviventes: cada baixa tem de estar nos eventos da batalha. */
function expectArmyLedger(result: SimulationResult): void {
  const trained = result.events
    .filter((event) => event.type === 'soldiersTrained')
    .reduce((sum, event) => sum + Number(event.data.amount), 0);
  const lost = result.events
    .filter((event) => event.type === 'battleFought')
    .reduce((sum, event) => sum + Number(event.data.playerLost), 0);
  const disbanded = result.events
    .filter((event) => event.type === 'soldiersDisbanded')
    .reduce((sum, event) => sum + Number(event.data.amount), 0);
  expect(trained).toBeGreaterThan(0);
  expect(result.rows.some((row) => row.soldiers > 0 && row.armyFood > 0)).toBe(true);
  expect(result.rows.at(-1)?.soldiers).toBe(trained - lost - disbanded);
}

/**
 * A guerra no simulador (V4C-T1.8; decisão 25 do ADR 0019): a política mínima do econômico e o
 * bot `militar`.
 */
describe('os bots na guerra (V4C-T1.8)', () => {
  it('o econômico ergue o Quartel e treina Lanceiros e Arqueiros sem pôr o feudo com fome', async () => {
    const result = await simulate({
      seed: 'pedra-alta-001',
      days: 7,
      timeScale: 3,
      strategy: 'economico',
      sessionsPerDay: 2,
    });
    const last = result.rows.at(-1);
    expect(result.finalState.settlement.buildings.barracks).toBe(1);
    expectArmyLedger(result);
    expect(last?.soldiersByUnit.swordsman).toBeUndefined();
    expect(last?.trainingBatches).toBeGreaterThan(0);
    expect(result.rows.some((row) => row.famine)).toBe(false);
    // Nem o Ferreiro, que é do militar.
    expect(result.finalState.settlement.buildings.smithy).toBe(0);
  });

  it('o CSV traz as colunas do exército', async () => {
    const result = await simulate({
      seed: 'pedra-alta-001',
      days: 1,
      timeScale: 3,
      strategy: 'militar',
      sessionsPerDay: 2,
    });
    const header = toCsv(result.rows).split('\n')[0]?.split(',') ?? [];
    for (const name of ['soldiers', 'soldiers_by_unit', 'training_batches', 'army_food']) {
      expect(header).toContain(name);
    }
  });

  it('o militar é o econômico com o Ferreiro, a forja e a formação', async () => {
    const names = militarPolicies.map((policy) => policy.name);
    expect(names.slice(0, 2)).toEqual(['erguer o Ferreiro', 'forjar armas']);
    // Desde a V4E-T2.7 (decisão 25) a formação é do econômico, logo depois do treino; o militar
    // a herda dele e só acrescenta o Ferreiro e a forja.
    expect(names).toContain('fintar a Horda');
    expect(names).toHaveLength(economicoPolicies.length + 2);
    const result = await simulate({
      seed: 'pedra-alta-001',
      days: 7,
      timeScale: 3,
      strategy: 'militar',
      sessionsPerDay: 2,
    });
    expect(result.finalState.settlement.buildings.smithy).toBeGreaterThan(0);
    expectArmyLedger(result);
    // A formação do bot: monta com o que tem e a ativa, sem comandante (V4C-T2).
    const { formations, activeFormationId } = result.finalState.army;
    // Uma, ou duas se a prévia da primeira deu menos de 50% e o bot tentou a outra (V4D-T2.5).
    expect(formations.length).toBeGreaterThanOrEqual(1);
    expect(formations.length).toBeLessThanOrEqual(3);
    expect(formations.map((entry) => entry.id)).toContain(activeFormationId);
    expect(
      formations.every((entry) => Object.values(entry.commanders).every((id) => id === null)),
    ).toBe(true);
  });

  it('o militar simula a formação antes de ativá-la e só guarda a de melhor prévia (V4D-T2.5)', async () => {
    const result = await simulate({
      seed: 'pedra-alta-001',
      days: 7,
      timeScale: 3,
      strategy: 'militar',
      sessionsPerDay: 2,
    });
    const { army, stats } = result.finalState;
    expect(stats.battlesSimulated).toBeGreaterThan(0);
    expect(army.preview).not.toBeNull();
    const active = army.formations.find((entry) => entry.id === army.activeFormationId);
    expect(active).toBeDefined();
    // A ativa é uma das duas do bot, e a prévia guardada é de uma delas.
    expect(['Defesa do bot', 'Defesa do bot B']).toContain(active?.name);
    expect(army.formations.some((entry) => entry.id === army.preview?.formationId)).toBe(true);
  });

  // Desde a V4E-T2.7 (ADR 0019, decisão 25) o econômico também mantém a Defesa ativa: toda
  // incursão é batalha. Ele monta a formação com os Lanceiros e Arqueiros do treino mínimo,
  // simula e a ativa, sem comandante.
  it('o econômico monta e ativa a formação com o que treina, e simula antes (V4E-T2.7)', async () => {
    const result = await simulate({
      seed: 'pedra-alta-001',
      days: 7,
      timeScale: 3,
      strategy: 'economico',
      sessionsPerDay: 2,
    });
    const { army, stats } = result.finalState;
    expect(army.formations.length).toBeGreaterThanOrEqual(1);
    expect(army.formations.map((entry) => entry.id)).toContain(army.activeFormationId);
    expect(stats.battlesSimulated).toBeGreaterThan(0);
  });
});
