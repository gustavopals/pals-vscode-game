import { describe, expect, it } from 'vitest';
import source from '../../../docs/content-v0.4.md?raw';
import { councilCards } from './cards';
import type { CouncilCard } from './council';

const ids = ['whitePaws', 'whiteWolf', 'forestReturns'];
const card = (id: string): CouncilCard => councilCards.find((entry) => entry.id === id)!;

describe('as três fichas aprovadas do Lobo Branco (§§6.4, 6.5 e 7.1)', () => {
  it('golden do conteúdo aprovado, incluindo todos os números e condições', async () => {
    await expect(`${JSON.stringify(ids.map(card), null, 1)}\n`).toMatchFileSnapshot(
      './__golden__/council-white-wolf.json',
    );
  });
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
  });

  it('conserva os requisitos, custos, flags, efeitos e prazos aprovados', () => {
    expect(card('whitePaws')).toMatchObject({
      weight: 2,
      requires: {
        seasons: ['autumn'],
        clearedTiles: ['wolfDen'],
        notFlags: ['whiteWolf.hunt', 'whiteWolf.offer', 'whiteWolf.ignored'],
      },
      autoResolve: { peasant: 'ignore', lord: 'ignore', ironKing: 'ignore' },
    });
    expect(card('whitePaws').recurring).toBeUndefined();
    expect(
      card('whitePaws').options.map(({ id, cost, effects }) => ({ id, cost, effects })),
    ).toEqual([
      {
        id: 'hunt',
        cost: { food: 40 },
        effects: [
          { type: 'setFlag', flag: 'whiteWolf.hunt' },
          { type: 'scheduleCard', cardId: 'whiteWolf', afterDays: 3 },
        ],
      },
      {
        id: 'offer',
        cost: { food: 80 },
        effects: [
          { type: 'morale', amount: 5, durationDays: 2 },
          { type: 'setFlag', flag: 'whiteWolf.offer' },
          { type: 'scheduleCard', cardId: 'whiteWolf', afterDays: 3 },
        ],
      },
      {
        id: 'ignore',
        cost: undefined,
        effects: [
          { type: 'resources', amounts: { food: -30 } },
          { type: 'setFlag', flag: 'whiteWolf.ignored' },
          { type: 'scheduleCard', cardId: 'whiteWolf', afterDays: 6 },
        ],
      },
    ]);
    expect(card('whiteWolf')).toMatchObject({
      weight: 0,
      autoResolve: { peasant: 'withdraw', lord: 'withdraw', ironKing: 'withdraw' },
    });
    expect(card('whiteWolf').options[0]).toMatchObject({
      id: 'hunt',
      requires: { buildings: { guild: 1 }, heroPresent: 1 },
    });
    expect(card('whiteWolf').options[0]?.cost).toBeUndefined();
    const cleared = ['whiteWolf.hunt', 'whiteWolf.offer', 'whiteWolf.ignored'].map((flag) => ({
      type: 'clearFlag',
      flag,
    }));
    expect(card('whiteWolf').options[0]?.effects).toEqual([
      { type: 'unlockExpedition', modelId: 'whiteWolfHunt', forDays: 6 },
      ...cleared,
      { type: 'setFlag', flag: 'whiteWolf.hunt' },
      { type: 'scheduleCard', cardId: 'forestReturns', afterDays: 5 },
    ]);
    expect(card('whiteWolf').options[1]).toMatchObject({ id: 'feed', cost: { food: 60 } });
    expect(card('whiteWolf').options[1]?.effects).toEqual([
      { type: 'morale', amount: 5, durationDays: 3 },
      ...cleared,
      { type: 'setFlag', flag: 'whiteWolf.offer' },
      { type: 'scheduleCard', cardId: 'forestReturns', afterDays: 5 },
    ]);
    expect(card('whiteWolf').options[2]?.effects).toEqual(cleared);
    expect(card('forestReturns')).toMatchObject({
      weight: 0,
      autoResolve: { peasant: 'claim', lord: 'claim', ironKing: 'claim' },
    });
    expect(
      card('forestReturns').options.map(({ id, cost, effects }) => ({ id, cost, effects })),
    ).toEqual([
      {
        id: 'claim',
        cost: undefined,
        effects: [
          { type: 'resources', amounts: { gold: 70, food: 40 } },
          { type: 'morale', amount: 5, durationDays: 3 },
          ...cleared,
        ],
      },
      {
        id: 'honor',
        cost: { stone: 40 },
        effects: [{ type: 'morale', amount: 10, durationDays: 3 }, ...cleared],
      },
      {
        id: 'sell',
        cost: undefined,
        effects: [
          { type: 'resources', amounts: { gold: 120 } },
          { type: 'morale', amount: -5, durationDays: 2 },
          ...cleared,
        ],
      },
    ]);
  });
});
