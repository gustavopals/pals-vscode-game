import { describe, expect, it } from 'vitest';

import {
  BRASILIA_UTC_OFFSET_MINUTES,
  SEASON_DIFFICULTY,
  SEASON_SCENARIO,
  SEASON_TIME_SCALE,
  SEASON_TIMEZONE,
  seasonWindowAt,
} from './calendar';

describe('calendário das Temporadas (Brasília fixo UTC−3, D-26)', () => {
  it('fixa Brasília UTC−3, Senhor, 3× e cenário padrão', () => {
    expect(SEASON_TIMEZONE).toBe('America/Sao_Paulo');
    expect(BRASILIA_UTC_OFFSET_MINUTES).toBe(-180);
    expect(SEASON_DIFFICULTY).toBe('lord');
    expect(SEASON_TIME_SCALE).toBe(3);
    expect(SEASON_SCENARIO).toBe('standard');
  });

  it('abre segunda 00:00 BRT, aceita até fim de terça (quarta 00:00 BRT) e fecha domingo 23:59 BRT', () => {
    // Segunda 2026-11-23 00:00:00 BRT = 2026-11-23T03:00:00.000Z
    const mondayStart = new Date('2026-11-23T03:00:00.000Z');
    const window = seasonWindowAt(mondayStart);
    expect(window.code).toBe('2026-W48');
    expect(window.startsAt.toISOString()).toBe('2026-11-23T03:00:00.000Z');
    // Quarta 2026-11-25 00:00:00 BRT = 2026-11-25T03:00:00.000Z
    expect(window.joinEndsAt.toISOString()).toBe('2026-11-25T03:00:00.000Z');
    // Domingo 2026-11-29 23:59:00 BRT = 2026-11-30T02:59:00.000Z
    expect(window.endsAt.toISOString()).toBe('2026-11-30T02:59:00.000Z');

    // Qualquer instante da mesma semana — inclusive domingo 23:59:59.999 BRT — cai na mesma janela.
    for (const instant of [
      '2026-11-24T02:59:59.999Z', // segunda 23:59:59.999 BRT
      '2026-11-25T02:59:59.999Z', // terça 23:59:59.999 BRT
      '2026-11-25T03:00:00.000Z', // quarta 00:00:00.000 BRT
      '2026-11-30T02:58:59.999Z', // domingo 23:58:59.999 BRT
      '2026-11-30T02:59:00.000Z', // domingo 23:59:00.000 BRT (ranking publicado)
      '2026-11-30T02:59:59.999Z', // domingo 23:59:59.999 BRT
    ]) {
      expect(seasonWindowAt(new Date(instant)), instant).toEqual(window);
    }

    // Um milissegundo antes de segunda 00:00 BRT ainda é a semana anterior (W47).
    const prev = seasonWindowAt(new Date('2026-11-23T02:59:59.999Z'));
    expect(prev.code).toBe('2026-W47');
    expect(prev.startsAt.toISOString()).toBe('2026-11-16T03:00:00.000Z');

    // Segunda seguinte 00:00:00.000 BRT abre a W49.
    const next = seasonWindowAt(new Date('2026-11-30T03:00:00.000Z'));
    expect(next.code).toBe('2026-W49');
    expect(next.startsAt.toISOString()).toBe('2026-11-30T03:00:00.000Z');
  });

  it('mantém UTC−3 fixo em meses que já tiveram horário de verão e calcula viradas de ano ISO', () => {
    // Novembro e fevereiro (antigo verão): deslocamento continua fixo em 03:00Z.
    expect(seasonWindowAt(new Date('2026-02-16T03:00:00.000Z')).startsAt.toISOString()).toBe(
      '2026-02-16T03:00:00.000Z',
    );
    // 2025-12-29 (segunda) tem quinta-feira em 2026-01-01 -> 2026-W01.
    expect(seasonWindowAt(new Date('2025-12-29T03:00:00.000Z')).code).toBe('2026-W01');
    // 2026-12-28 (segunda) tem quinta-feira em 2026-12-31 -> 2026-W53.
    expect(seasonWindowAt(new Date('2026-12-28T03:00:00.000Z')).code).toBe('2026-W53');
    // 2027-01-04 (segunda) -> 2027-W01.
    expect(seasonWindowAt(new Date('2027-01-04T03:00:00.000Z')).code).toBe('2027-W01');
  });
});
