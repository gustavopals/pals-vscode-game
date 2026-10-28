import { describe, expect, it } from 'vitest';
import source from '../../../docs/content-v0.4.md?raw';

import { councilCards } from './cards';
import type { CouncilCard } from './council';

const ids = ['passingRecruiter', 'gamblingDebt', 'squareDuel', 'wanderingHealer'] as const;
const card = (id: string): CouncilCard => councilCards.find((entry) => entry.id === id)!;

describe('as quatro fichas avulsas aprovadas (§§7.3–7.5 e 8.1)', () => {
  it('golden do conteúdo aprovado, incluindo todos os números e condições', async () => {
    await expect(`${JSON.stringify(ids.map(card), null, 1)}\n`).toMatchFileSnapshot(
      './__golden__/council-avulsas.json',
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
    if (id === 'gamblingDebt' || id === 'squareDuel') {
      const riskOption = id === 'gamblingDebt' ? entry.options[1]! : entry.options[0]!;
      const risk = riskOption.effects.find((effect) => effect.type === 'rollEffect')!;
      expect(risk?.type).toBe('rollEffect');
      if (risk?.type === 'rollEffect') {
        expect(risk.onHit.chronicle).toBe(
          chronicles.find((part) => part[1]!.startsWith('desfecho ruim'))?.[2],
        );
        expect(risk.onMiss.chronicle).toBe(
          chronicles.find((part) => part[1]!.startsWith('desfecho bom'))?.[2],
        );
      }
    }
  });

  it('conserva requisitos, pesos, autoaplicações, custos e efeitos das quatro fichas', () => {
    for (const id of ids) {
      expect(card(id).weight).toBe(2);
      expect(card(id).recurring).toBeUndefined();
    }
    expect(card('passingRecruiter')).toMatchObject({
      requires: { buildings: { tavern: 1 } },
      autoResolve: { peasant: 'refuse', lord: 'refuse', ironKing: 'refuse' },
    });
    expect(card('passingRecruiter').options[0]).toMatchObject({
      id: 'pay',
      cost: { gold: 100 },
      effects: [{ type: 'tavernExtraOffer' }],
    });
    expect(card('gamblingDebt')).toMatchObject({
      requires: { buildings: { tavern: 1 }, heroPresent: 1 },
      autoResolve: { peasant: 'leave', lord: 'leave', ironKing: 'leave' },
    });
    expect(card('gamblingDebt').options[0]).toMatchObject({
      id: 'cover',
      cost: { gold: 90 },
      effects: [{ type: 'morale', amount: 5, durationDays: 2 }],
    });
    expect(card('gamblingDebt').options[1]?.effects[0]).toMatchObject({
      type: 'rollEffect',
      chance: { num: 1, den: 2 },
      onHit: {
        effects: [
          { type: 'injureHero', kind: 'light' },
          { type: 'morale', amount: -5, durationDays: 3 },
        ],
      },
      onMiss: {
        effects: [{ type: 'morale', amount: 5, durationDays: 2 }],
      },
    });
    expect(card('squareDuel')).toMatchObject({
      requires: { seasons: ['spring', 'summer', 'autumn'], heroPresent: 2 },
      autoResolve: { peasant: 'forbid', lord: 'forbid', ironKing: 'forbid' },
    });
    expect(card('squareDuel').options[0]?.effects).toMatchObject([
      { type: 'morale', amount: 10, durationDays: 2 },
      {
        type: 'rollEffect',
        chance: { num: 1, den: 3 },
        onHit: { effects: [{ type: 'injureHero', kind: 'light' }] },
        onMiss: { effects: [] },
      },
    ]);
    expect(card('squareDuel').options[1]).toMatchObject({
      id: 'train',
      cost: { gold: 30 },
      effects: [{ type: 'morale', amount: 5, durationDays: 2 }],
    });
    expect(card('squareDuel').options[2]).toMatchObject({
      id: 'forbid',
      effects: [{ type: 'morale', amount: -5, durationDays: 2 }],
    });
    expect(card('wanderingHealer')).toMatchObject({
      requires: { injuredHero: true },
      autoResolve: { peasant: 'wait', lord: 'wait', ironKing: 'wait' },
    });
    expect(card('wanderingHealer').options[0]).toMatchObject({
      id: 'pay',
      cost: { gold: 60 },
      effects: [{ type: 'healHero', mode: 'full' }],
    });
    expect(card('wanderingHealer').options[1]).toMatchObject({
      id: 'herbs',
      cost: { food: 30 },
      effects: [{ type: 'healHero', mode: 'half' }],
    });
  });
});
