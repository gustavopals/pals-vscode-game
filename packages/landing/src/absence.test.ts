import { describe, expect, it } from 'vitest';

import { absenceNote, formatAbsence, MIN_ABSENCE_MS } from './absence';

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;

describe('formatAbsence', () => {
  it('fala em segundos, minutos ou horas, arredondando para baixo', () => {
    expect(formatAbsence(10 * SECOND)).toBe('10 s');
    expect(formatAbsence(59_999)).toBe('59 s');
    expect(formatAbsence(MINUTE)).toBe('1 min');
    expect(formatAbsence(3 * MINUTE + 50 * SECOND)).toBe('3 min');
    expect(formatAbsence(59 * MINUTE + 59 * SECOND)).toBe('59 min');
    expect(formatAbsence(HOUR)).toBe('1 h');
    expect(formatAbsence(26 * HOUR + 30 * MINUTE)).toBe('26 h');
  });
});

describe('absenceNote', () => {
  it('uma espiada em outra aba não vira recado', () => {
    expect(absenceNote(0)).toBeNull();
    expect(absenceNote(MIN_ABSENCE_MS - 1)).toBeNull();
  });

  it('relógio que andou para trás ou valor sem sentido também não', () => {
    expect(absenceNote(-5 * MINUTE)).toBeNull();
    expect(absenceNote(Number.NaN)).toBeNull();
  });

  it('a partir de dez segundos, diz quanto tempo passou e não promete um feudo de verdade', () => {
    expect(absenceNote(MIN_ABSENCE_MS)).toBe(
      'Você saiu por 10 s. Pedra Alta teria seguido sem você.',
    );
    expect(absenceNote(3 * MINUTE)).toBe('Você saiu por 3 min. Pedra Alta teria seguido sem você.');
    expect(absenceNote(2 * HOUR)).toBe('Você saiu por 2 h. Pedra Alta teria seguido sem você.');
  });
});
