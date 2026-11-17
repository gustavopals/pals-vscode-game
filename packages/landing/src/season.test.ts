import { describe, expect, it } from 'vitest';

import { seasonAt } from './season';

const spans = [
  { season: 'spring', top: 900, bottom: 2100 },
  { season: 'summer', top: 2100, bottom: 4000 },
  { season: 'winter', top: 4400, bottom: 5000 },
];

describe('seasonAt', () => {
  it('antes da primeira estação e depois da última, nenhuma', () => {
    expect(seasonAt(spans, 0)).toBeNull();
    expect(seasonAt(spans, 899)).toBeNull();
    expect(seasonAt(spans, 5000)).toBeNull();
    expect(seasonAt([], 100)).toBeNull();
  });

  it('a estação começa no alto do trecho dela e acaba onde começa a seguinte', () => {
    expect(seasonAt(spans, 900)).toBe('spring');
    expect(seasonAt(spans, 2099)).toBe('spring');
    expect(seasonAt(spans, 2100)).toBe('summer');
    expect(seasonAt(spans, 4999)).toBe('winter');
  });

  it('no vão entre dois trechos, nenhuma', () => {
    expect(seasonAt(spans, 4200)).toBeNull();
  });

  it('medida sem sentido não escolhe estação', () => {
    expect(seasonAt(spans, Number.NaN)).toBeNull();
  });
});
