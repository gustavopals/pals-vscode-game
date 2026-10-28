import { describe, expect, it } from 'vitest';
import source from '../../../docs/content-v0.4.md?raw';

import { councilCards } from './cards';
import type { CouncilCard } from './council';

const ids = [
  'fieldBlight',
  'mysteriousMerchant',
  'merchantLead',
  'merchantFinalOffer',
  'merchantBoycott',
  'royalCaravan',
  'kingsTax',
  'kingsCollector',
  'kingsAnswer',
];
const card = (id: string): CouncilCard => councilCards.find((entry) => entry.id === id)!;

describe('as nove fichas aprovadas: Mercado, praga e Coroa', () => {
  it.each(ids)('%s: título, texto, variantes, opções, pistas e crônicas iguais à ficha', (id) => {
    const entry = card(id);
    const match = source.match(
      new RegExp(
        '^### (\\d+\\.\\d+) ([^\\n]+?) \\(`' + id + '`[^\\n]*\\n(.*?)(?=\\n### |\\n## )',
        'ms',
      ),
    )!;
    const section = match[3]!;
    expect(entry.title).toBe(match[2]);
    const variants = [...section.matchAll(/^Texto \(`([^`]+)`\): "([^"]+)"/gm)].map((part) => ({
      flag: part[1],
      text: part[2],
    }));
    const text = variants[0]?.text ?? section.match(/^\| Texto \| "([^"]+)" \|$/m)?.[1];
    expect(entry.text).toBe(text);
    expect(entry.variants ?? []).toEqual(variants);
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
    if (id === 'fieldBlight') {
      const risk = entry.options[1]!.effects[0]!;
      expect(risk.type).toBe('rollEffect');
      if (risk.type === 'rollEffect') {
        expect(risk.onHit.chronicle).toBe(
          chronicles.find((part) => part[1]!.startsWith('desfecho ruim'))?.[2],
        );
        expect(risk.onMiss.chronicle).toBe(
          chronicles.find((part) => part[1]!.startsWith('desfecho bom'))?.[2],
        );
      }
    }
  });

  it('conserva os percentuais de estoque e o risco de metade do alimento', () => {
    expect(card('fieldBlight').options[0]?.effects[0]).toEqual({
      type: 'resourcesPercent',
      resource: 'food',
      ratio: { num: -30, den: 100 },
    });
    const risk = card('fieldBlight').options[1]?.effects[0];
    expect(risk).toMatchObject({
      type: 'rollEffect',
      chance: { num: 1, den: 2 },
      withHeroClass: { heroClass: 'cleric', chance: { num: 1, den: 5 } },
      onHit: {
        effects: [{ type: 'resourcesPercent', resource: 'food', ratio: { num: -50, den: 100 } }],
      },
      onMiss: { effects: [{ type: 'morale', amount: 5, durationDays: 2 }] },
    });
    for (const [id, option, loss] of [
      ['kingsTax', 'pay', 15],
      ['kingsTax', 'negotiate', 7],
      ['kingsCollector', 'fine', 30],
      ['kingsAnswer', 'tribute', 20],
    ] as const) {
      expect(card(id).options.find((entry) => entry.id === option)?.effects[0]).toEqual({
        type: 'resourcesPercent',
        resource: 'gold',
        ratio: { num: -loss, den: 100 },
      });
    }
  });

  it('os choques de preço têm os fatores, recursos e durações aprovados', () => {
    for (const [id, option, num, den, days, iron] of [
      ['mysteriousMerchant', 'imprison', 6, 5, 2, true],
      ['merchantBoycott', 'resist', 6, 5, 3, true],
      ['merchantBoycott', 'route', 11, 10, 2, true],
      ['royalCaravan', 'sellNow', 5, 4, 1, false],
      ['royalCaravan', 'hospitality', 11, 10, 3, false],
    ] as const) {
      expect(
        card(id)
          .options.find((entry) => entry.id === option)
          ?.effects.find((effect) => effect.type === 'marketPrice'),
      ).toEqual({
        type: 'marketPrice',
        resources: iron ? ['food', 'wood', 'stone', 'iron'] : ['food', 'wood', 'stone'],
        factor: { num, den },
        durationDays: days,
      });
    }
  });

  it('mantém as duas descobertas e as condições de negociação, paz e soldados', () => {
    expect(card('mysteriousMerchant').requires).toEqual({
      seasons: ['summer'],
      buildings: { market: 1, guild: 1 },
      undiscovered: 'ruins',
      notFlags: ['merchant.map', 'merchant.hostile'],
    });
    expect(card('mysteriousMerchant').options[0]).toMatchObject({
      requires: { resources: { gold: 80 } },
      cost: { gold: 80 },
      effects: [
        { type: 'revealDestination', modelId: 'ruins' },
        { type: 'setFlag', flag: 'merchant.map' },
        { type: 'scheduleCard', cardId: 'merchantLead', afterDays: 4 },
      ],
    });
    expect(card('merchantFinalOffer').options[1]).toMatchObject({
      requires: { buildings: { guild: 2 }, undiscovered: 'abandonedMine' },
      cost: { gold: 50 },
    });
    expect(card('merchantFinalOffer').options[2]).toMatchObject({
      requires: { flags: ['merchant.hostile'] },
      cost: { gold: 60 },
    });
    expect(card('kingsTax').options[1]?.requires).toEqual({ heroTrait: 'charismatic' });
    expect(card('kingsCollector').options[1]?.requires).toEqual({ minSoldiers: 10 });
  });
});
