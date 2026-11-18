import { describe, expect, it } from 'vitest';
import { RELIC_IDS } from './ids';
import { relics } from './relics';
import { RelicsSchema } from './schemas';

describe('relíquias — ids publicados', () => {
  it('fixa os oito ids e a ordem, sem reutilizar identificadores de item', () => {
    expect(RELIC_IDS).toEqual([
      'ancestralHorn',
      'oakHeart',
      'watchersEye',
      'ancientKingsSeal',
      'wolfBone',
      'hermitsLamp',
      'saltStone',
      'wintersCloak',
    ]);
    expect(Object.keys(relics)).toEqual([...RELIC_IDS]);
    expect(RelicsSchema.safeParse(relics).success).toBe(true);
    expect(RelicsSchema.safeParse({ ...relics, unknown: relics.oakHeart }).success).toBe(false);
  });
});
