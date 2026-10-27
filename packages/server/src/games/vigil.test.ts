import { readFileSync } from 'node:fs';

import type { GameRow } from '../db/schema';
import { loadGame } from './repository';
import { describe, expect, it } from 'vitest';

import { resolveVigilTimezone } from './vigil';

describe('offset da Vigília no servidor', () => {
  it.each([
    ['America/Sao_Paulo', -180],
    ['UTC', 0],
    ['Asia/Tokyo', 540],
    ['Asia/Kathmandu', 345],
  ] as const)('%s', (zone, offset) => {
    expect(resolveVigilTimezone(zone, new Date('2026-10-27T13:00:00Z'))).toEqual({
      utcOffsetMinutes: offset,
      timezoneResolved: true,
    });
  });
  it('usa UTC e registra a falha se o fuso antigo não existe no ICU atual', () => {
    expect(resolveVigilTimezone('Marte/Olimpo', new Date('2026-10-27T13:00:00Z'))).toEqual({
      utcOffsetMinutes: 0,
      timezoneResolved: false,
    });
  });
  it('resolve no instante recebido, sem usar o relógio do sistema', () => {
    expect(
      resolveVigilTimezone('America/New_York', new Date('2026-01-01T00:00:00Z')).utcOffsetMinutes,
    ).toBe(-300);
    expect(
      resolveVigilTimezone('America/New_York', new Date('2026-07-01T00:00:00Z')).utcOffsetMinutes,
    ).toBe(-240);
  });
});

describe('contexto civil da linha ao migrar', () => {
  it('usa created_at e o fuso da linha sem alterar a incursão do retrato', () => {
    const raw = JSON.parse(
      readFileSync(
        new URL('../../../engine/src/__fixtures__/state-v34-fresh.json', import.meta.url),
        'utf8',
      ),
    ) as GameRow['state'];
    const createdAt = new Date('2026-10-27T13:17:42.333Z');
    const row: GameRow = {
      id: 'game-test',
      accountId: 'account-test',
      status: 'active',
      seed: 'fixture-fresh',
      difficulty: 'lord',
      timeScale: '1',
      timezone: 'America/Sao_Paulo',
      vigilHour: 20,
      schemaVersion: 34,
      state: raw,
      stateVersion: 1,
      createdAt,
      updatedAt: createdAt,
      lastProcessedAt: createdAt,
    };
    const migrated = loadGame(row);
    expect(migrated.migratedFrom).toBe(34);
    expect(migrated.state.settings.realOriginMs).toBe(createdAt.getTime());
    expect(migrated.state.settings.vigil).toEqual({
      hourLocal: 20,
      utcOffsetMinutes: -180,
      timezoneResolved: true,
    });
    expect(migrated.state.horde.scheduledRaids).toEqual(
      (raw as unknown as { horde: { scheduledRaids: unknown } }).horde.scheduledRaids,
    );
    expect(loadGame({ ...row, state: migrated.state, schemaVersion: 35 }).migratedFrom).toBeNull();
  });
});
