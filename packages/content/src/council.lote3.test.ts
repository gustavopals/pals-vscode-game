import { describe, expect, it } from 'vitest';
import source from '../../../docs/content-v0.4.md?raw';

import { councilCards } from './cards';
import type { CouncilCard } from './council';

const ids = ['smithsDaughter', 'temperingSecret', 'lordsSword', 'passingMercenaries', 'smuggledIron', 'northernCrows', 'hordeDeserter', 'hordeSpy', 'raidersAskPassage', 'crackedWall', 'warCouncil', 'afterTheStorm', 'siegeEve'] as const;
const card = (id: string): CouncilCard => councilCards.find((entry) => entry.id === id)!;

describe('as treze fichas aprovadas do lote 3 (§§9–11)', () => {
  it('golden do conteúdo aprovado, incluindo todos os números e condições', async () => {
    await expect(`${JSON.stringify(ids.map(card), null, 1)}\n`).toMatchFileSnapshot(
      './__golden__/council-lote3.json',
    );
  });

  it.each(ids)('%s: título, texto, opções, pistas e crônicas iguais à ficha', (id) => {
    const entry = card(id);
    const match = source.match(
      new RegExp(
        '^### (\\d+\\.\\d+) ([^\\n]+?) \\(`' + id + '`[^\\n]*\\n(.*?)(?=\\n### |\\n## )',
        'ms',
      ),
    )!;
    const section = match[3]!;
    expect(entry.title).toBe(match[2]);
    expect(entry.text).toBe(section.match(/^\| Texto \| "([^"]+)" \|$/m)?.[1]);
    expect(entry.variants).toBeUndefined();
    const rows = [
      ...section.matchAll(/^\| `(\w+)` "([^"]+)" \| (.*?) \| "([^"]+)" \|\s*(.*?)\|$/gm),
    ];
    expect(entry.options.map((option) => [option.id, option.label, option.hint])).toEqual(
      rows.map((row) => [row[1], row[2], row[4]]),
    );
    const chronicles = [
      ...section.matchAll(/Crônica \(([^)]+)\): "([^"]+)"(?: Prazo vencido: "([^"]+)")?/g),
    ];
    for (const option of entry.options) {
      const original = chronicles.find(
        (part) => part[1]!.replaceAll('`', '').split(',')[0] === option.id,
      )!;
      expect(option.chronicle).toBe(original[2]);
      expect(option.expiredChronicle).toBe(original[3]);
    }
    if (id === 'smuggledIron') {
      const risk = entry.options[0]!.effects[0]!;
      expect(risk.type).toBe('rollEffect');
      if (risk.type === 'rollEffect') {
        expect(risk.onHit.chronicle).toBe(chronicles.find((part) => part[1]!.startsWith('desfecho bom'))?.[2]);
        expect(risk.onMiss.chronicle).toBe(chronicles.find((part) => part[1]!.startsWith('desfecho ruim'))?.[2]);
      }
    }
  });

  it('conserva custos, prazos, números e condições aprovados', () => {
    const option = (id: string, optionId: string) => card(id).options.find((entry) => entry.id === optionId)!;
    expect(card('smithsDaughter').requires).toEqual({ seasons: ['summer'], buildings: { smithy: 1 }, notFlags: ['smithsDaughter.learning', 'smithsDaughter.tradition'] });
    expect(option('smithsDaughter', 'teach')).toMatchObject({ cost: { iron: 40 }, effects: [
      { type: 'smithySpeed', factor: { num: 6, den: 5 }, durationDays: 12 },
      { type: 'morale', amount: -5, durationDays: 2 },
      { type: 'setFlag', flag: 'smithsDaughter.learning' },
      { type: 'scheduleCard', cardId: 'temperingSecret', afterDays: 6 },
    ] });
    expect(option('temperingSecret', 'pay')).toMatchObject({ cost: { iron: 60 }, effects: [
      { type: 'smithyBatch', extra: 1, durationDays: 15 },
      { type: 'setFlag', flag: 'smithsDaughter.tempered' },
      { type: 'scheduleCard', cardId: 'lordsSword', afterDays: 6 },
    ] });
    expect(option('lordsSword', 'blade').effects[0]).toEqual({ type: 'addItem', itemId: 'lordsSword' });
    expect(option('lordsSword', 'arms').effects[0]).toEqual({ type: 'addWeapons', amount: 8 });
    expect(card('passingMercenaries').requires).toEqual({ seasons: ['spring', 'summer', 'autumn'], buildings: { barracks: 1 }, armyRoom: 5 });
    expect(option('passingMercenaries', 'hire')).toMatchObject({ cost: { gold: 120 }, weaponsCost: 5, requires: { armyRoom: 5 }, effects: [{ type: 'addSoldiers', unit: 'swordsman', amount: 5, fromPopulation: false }, { type: 'morale', amount: -5, durationDays: 2 }] });
    expect(option('passingMercenaries', 'train')).toMatchObject({ cost: { food: 40 }, requires: { training: true }, effects: [{ type: 'morale', amount: 5, durationDays: 2 }, { type: 'trainBoost', factor: { num: 1, den: 2 } }] });
    expect(option('smuggledIron', 'buy')).toMatchObject({ cost: { gold: 260 }, effects: [{ type: 'rollEffect', chance: { num: 2, den: 3 }, onHit: { effects: [{ type: 'resources', amounts: { iron: 60 } }] }, onMiss: { effects: [{ type: 'morale', amount: -5, durationDays: 2 }] } }] });
    expect(option('smuggledIron', 'half')).toMatchObject({ cost: { gold: 130 }, requires: { building: 'smithy' }, effects: [{ type: 'resources', amounts: { iron: 30 } }] });
    expect(card('northernCrows').scripted).toEqual({ atSeasonStart: 'autumn', year: 1 });
    expect(option('northernCrows', 'raise').effects).toEqual([{ type: 'startBuilding', building: 'watchtower', level: 3, discount: { num: 1, den: 4 } }]);
    expect(option('northernCrows', 'ask')).toMatchObject({ cost: { gold: 60 }, effects: [{ type: 'omen', clarity: 1 }] });
    expect(card('hordeDeserter').scripted).toEqual({ atSeasonEnd: 'autumn', year: 1 });
    expect(card('hordeDeserter').requires).toEqual({ tile: 'hordeFortress' });
    expect(option('hordeDeserter', 'buy')).toMatchObject({ cost: { gold: 60 }, effects: [{ type: 'omen', wave: 2, clarity: 5 }] });
    expect(option('hordeDeserter', 'question').effects).toEqual([{ type: 'omen', wave: 1, clarity: 3 }, { type: 'morale', amount: -5, durationDays: 2 }]);
    expect(card('hordeSpy').requires).toEqual({ seasons: ['autumn'], tile: 'hordeFortress', buildings: { watchtower: 1 } });
    expect(option('hordeSpy', 'interrogate')).toMatchObject({ cost: { food: 30 }, effects: [{ type: 'omen', clarity: 3 }, { type: 'morale', amount: -5, durationDays: 2 }] });
    expect(card('raidersAskPassage').requires).toEqual({ seasons: ['spring', 'summer', 'autumn'], tile: 'raiderCamp', buildings: { watchtower: 1 } });
    expect(option('raidersAskPassage', 'pay')).toMatchObject({ cost: { food: 40 }, effects: [{ type: 'threat', delta: -10 }] });
    expect(option('raidersAskPassage', 'risk').effects).toEqual([{ type: 'scheduleRaid', kind: 'weak', afterMs: 6 * 3_600_000 }, { type: 'morale', amount: 5, durationDays: 2 }]);
    expect(card('crackedWall').requires).toEqual({ buildings: { palisade: 3 }, wallDamaged: true });
    expect(option('crackedWall', 'repair').effects).toEqual([{ type: 'repairWall', discount: { num: 1, den: 5 } }]);
    expect(option('crackedWall', 'patch')).toMatchObject({ cost: { stone: 60 }, effects: [{ type: 'healWall', fraction: { num: 1, den: 4 } }] });
    expect(card('warCouncil').requires).toEqual({ seasons: ['spring', 'summer', 'autumn'], activeRaid: true });
    expect(option('warCouncil', 'listen')).toMatchObject({ requires: { commanderTrait: 'prudent' }, effects: [{ type: 'revealRaid' }] });
    expect(option('warCouncil', 'hear')).toMatchObject({ cost: { gold: 50 }, effects: [{ type: 'revealRaid' }] });
    expect(card('afterTheStorm').requires).toEqual({ phase: 'aftermath' });
    expect(option('afterTheStorm', 'mourn')).toMatchObject({ requires: { siegeCasualties: true }, cost: { stone: 80 }, effects: [{ type: 'morale', amount: 10, durationDays: 3 }] });
    expect(option('afterTheStorm', 'feast')).toMatchObject({ requires: { siegeWon: true }, cost: { food: 100, gold: 50 }, effects: [{ type: 'morale', amount: 10, durationDays: 2 }] });
    expect(option('afterTheStorm', 'rebuild').effects).toEqual([{ type: 'repairDiscount', points: 10 }, { type: 'morale', amount: -5, durationDays: 2 }]);
    expect(card('siegeEve')).toMatchObject({ scripted: { beforeSiege: true }, recurring: true, requires: { seasons: ['winter'] } });
    expect(option('siegeEve', 'feast')).toMatchObject({ cost: { food: 60, gold: 30 }, effects: [{ type: 'morale', amount: 10, durationDays: 2 }] });
    // Aprovação no começo da §11: a vigília antecipa a milícia normal da decisão 21.
    expect(option('siegeEve', 'vigil').effects).toEqual([{ type: 'militiaReady' }, { type: 'morale', amount: -5, durationDays: 1 }]);
    for (const id of ids) expect(card(id).weight).toBe(['temperingSecret', 'lordsSword', 'northernCrows', 'hordeDeserter', 'siegeEve'].includes(id) ? 0 : 2);
  });
});
