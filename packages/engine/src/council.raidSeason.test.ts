import { describe, expect, it } from 'vitest';

import { baseRaidComposition } from './raidArmy';
import { accept, AUTUMN, command, dealt, gameAt, HOUR, SUMMER, WINTER, YEAR } from './test-helpers';

describe('Saqueadores pedem passagem: estação da chegada', () => {
  it.each([SUMMER, AUTUMN, WINTER, YEAR + 6 * HOUR])(
    'a incursão que chega em %i usa a estação nova',
    (arrival) => {
      const state = gameAt(arrival - 6 * HOUR);
      const pending = dealt(state, 'raidersAskPassage').state;
      const instanceId = pending.council.pending.find(
        (card) => card.cardId === 'raidersAskPassage',
      )!.instanceId;
      const answered = accept(pending, command('answerCard', { instanceId, optionId: 'risk' }));
      const raid = answered.state.horde.scheduledRaids.find(
        (entry) => entry.id === `card:${instanceId}`,
      )!;
      const season =
        arrival === SUMMER
          ? 'summer'
          : arrival === AUTUMN
            ? 'autumn'
            : arrival === WINTER
              ? 'winter'
              : 'spring';
      expect(raid.atMs).toBe(arrival);
      expect(raid.composition).toEqual(baseRaidComposition('light', season));
    },
  );
});
