import { describe, expect, it } from 'vitest';

import { narrate } from './chronicle';
import { DAY_MS } from './clock';
import { newGame, objectivesScenario } from './test-helpers';

describe('Crônica', () => {
  it('monta a frase com o calendário do instante do evento', () => {
    const state = newGame();
    expect(
      narrate('constructionFinished', state, 2 * DAY_MS, { edificio: 'a Serraria', nivel: 2 }),
    ).toBe('No 3º dia da Primavera, os pedreiros ergueram a Serraria ao 2º nível.');
    expect(narrate('famineStarted', state, 30 * DAY_MS)).toBe(
      'No 7º dia do Verão, as despensas de Pedra Alta ficaram vazias. A fome começou.',
    );
    expect(narrate('seasonChanged', state, 72 * DAY_MS)).toBe('Chega o Inverno a Pedra Alta.');
  });

  it('deixa visível um marcador sem valor, em vez de escondê-lo', () => {
    expect(narrate('constructionFinished', newGame(), 0)).toBe(
      'No 1º dia da Primavera, os pedreiros ergueram {edificio} ao {nivel}º nível.',
    );
  });

  it('o motor emite a frase no evento e não a guarda no estado', () => {
    const { state, events } = objectivesScenario();
    expect(events.every((event) => event.text.length > 0)).toBe(true);
    expect(JSON.stringify(state)).not.toContain('pedreiros');
  });

  it('as frases do cenário dos objetivos são determinísticas', async () => {
    const lines = objectivesScenario().events.map((event) => `${event.atMs}\t${event.text}`);
    expect(objectivesScenario().events.map((event) => event.text)).toEqual(
      lines.map((line) => line.split('\t')[1]),
    );
    await expect(`${lines.join('\n')}\n`).toMatchFileSnapshot(
      './__golden__/chronicle-objectives.txt',
    );
  });
});
