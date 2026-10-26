import { describe, expect, it } from 'vitest';

import {
  balance,
  HORDE_UNIT_IDS,
  hordeBaseMix,
  hordeUnits,
  RAID_SIZE_IDS,
  SEASON_IDS,
  WAR_RAID_SIZE_IDS,
  warRaids,
} from './index';
import { WarRaidsSchema } from './schemas';

describe('Incursões como batalha (V4E-T2.1; ADR 0019, decisão 14; ADR 0020)', () => {
  it('vale pelo schema', () => {
    expect(WarRaidsSchema.safeParse(warRaids).error).toBeUndefined();
  });

  it('os tamanhos: leve, média e forte; o conteúdo de hoje continua com dois', () => {
    expect(WAR_RAID_SIZE_IDS).toEqual(['light', 'medium', 'strong']);
    expect(RAID_SIZE_IDS).toEqual(['light', 'medium']);
    expect(warRaids.sizeBudget).toEqual({ light: 24, medium: 40, strong: 64 });
    // Os dois primeiros tamanhos repetem os da prévia do Conselho de Guerra.
    expect(warRaids.sizeBudget.light).toBe(balance.battle.previewEnemy.units.light);
    expect(warRaids.sizeBudget.medium).toBe(balance.battle.previewEnemy.units.medium);
  });

  it('a média começa onde a v0.2 a deixa (70) em toda estação, e o forte vem depois', () => {
    for (const season of SEASON_IDS) {
      expect(warRaids.thresholds[season].medium).toBe(balance.threat.mediumRaidAbove);
      expect(warRaids.thresholds[season].strong).toBeGreaterThan(70);
    }
    // A primavera é calma: a Ameaça máxima (100) não traz o forte.
    expect(warRaids.thresholds.spring.strong).toBeGreaterThan(balance.threat.max);
  });

  it('o forte vem mais cedo conforme a estação esquenta', () => {
    const strong = SEASON_IDS.map((season) => warRaids.thresholds[season].strong);
    expect(strong).toEqual([...strong].sort((a, b) => b - a));
  });

  it('a composição por estação são os pesos do Apêndice A, e cada tipo tem custo', () => {
    for (const season of SEASON_IDS) {
      const mix = hordeBaseMix[season];
      expect(Object.values(mix).reduce((sum, weight) => sum + (weight ?? 0), 0)).toBe(100);
    }
    expect(Object.keys(warRaids.unitCost)).toEqual([...HORDE_UNIT_IDS]);
  });

  it('as partes dos postos somam 100 e coincidem com a prévia', () => {
    expect(warRaids.postShares).toEqual(balance.battle.previewEnemy.shares);
  });

  it('as roteirizadas: dias de jogo 25, 37 e 61; as duas primeiras leves e sem ferido (D-39), a última forte e o ensaio do cerco', () => {
    expect(
      warRaids.scripted.map(({ atGameDay, size, rehearsal, injures }) => [
        atGameDay,
        size,
        rehearsal,
        injures,
      ]),
    ).toEqual([
      [25, 'light', false, false],
      [37, 'light', false, false],
      [61, 'strong', true, true],
    ]);
    // Nenhuma colide com a incursão dos lobos nem entre si (uma incursão marcada por vez).
    const days = [
      ...balance.raids.scripted.map((raid) => raid.atGameDay),
      ...warRaids.scripted.map((raid) => raid.atGameDay),
    ];
    expect(new Set(days).size).toBe(days.length);
    const ids = [
      ...balance.raids.scripted.map((raid) => raid.id),
      ...warRaids.scripted.map((raid) => raid.id),
    ];
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('o que custa perder: a regra da v0.2 nos dois primeiros tamanhos, e o forte cobra mais', () => {
    expect(warRaids.losses.light).toEqual(balance.raids.damage.wolves.light);
    expect(warRaids.losses.medium).toEqual(balance.raids.damage.wolves.medium);
    const ratio = (size: 'light' | 'medium' | 'strong') =>
      warRaids.losses[size].lossRatio.num / warRaids.losses[size].lossRatio.den;
    expect(ratio('strong')).toBeGreaterThan(ratio('medium'));
    expect(warRaids.losses.strong.injuries).toBeGreaterThan(warRaids.losses.medium.injuries);
  });

  it('as frases dos bandos são distintas por tamanho', () => {
    for (const phrases of Object.values(warRaids.bandSizes)) {
      expect(new Set(Object.values(phrases)).size).toBe(WAR_RAID_SIZE_IDS.length);
    }
  });

  it('os tipos das composições existem na Horda e o custo dos fortes é maior', () => {
    for (const season of SEASON_IDS) {
      for (const unit of Object.keys(hordeBaseMix[season])) {
        expect(hordeUnits).toHaveProperty(unit);
      }
    }
    expect(warRaids.unitCost.ogre).toBeGreaterThan(warRaids.unitCost.raider);
  });
});
