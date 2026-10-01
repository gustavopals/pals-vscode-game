import { describe, expect, it } from 'vitest';

import {
  formatRecoveryCode,
  generateRecoveryCode,
  hashRecoveryCode,
  normalizeRecoveryCode,
  RECOVERY_ALPHABET,
} from './recovery';

const secret = new Uint8Array(Buffer.alloc(48, 3));

describe('Código do Reino', () => {
  it('o alfabeto tem 32 símbolos, sem 0, O, 1 nem I', () => {
    expect(RECOVERY_ALPHABET).toHaveLength(32);
    expect(new Set(RECOVERY_ALPHABET).size).toBe(32);
    expect(RECOVERY_ALPHABET).not.toMatch(/[01OI]/);
  });

  it('gera 20 caracteres do alfabeto, diferentes a cada vez', () => {
    const codes = Array.from({ length: 200 }, generateRecoveryCode);
    for (const code of codes) {
      expect(code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{20}$/);
    }
    expect(new Set(codes).size).toBe(200);
    // Todos os símbolos aparecem: a distribuição cobre o alfabeto inteiro.
    expect(new Set(codes.join('')).size).toBe(32);
  });

  it('exibe em cinco grupos de quatro', () => {
    expect(formatRecoveryCode('PEDR7F3AK9QDM2XW4HTB')).toBe('PEDR-7F3A-K9QD-M2XW-4HTB');
  });

  it('normaliza espaços, hífens e minúsculas', () => {
    expect(normalizeRecoveryCode('  pedr-7f3a-k9qd-m2xw-4htb \n')).toBe('PEDR7F3AK9QDM2XW4HTB');
    expect(normalizeRecoveryCode('PEDR7F3AK9QDM2XW4HTB')).toBe('PEDR7F3AK9QDM2XW4HTB');
  });

  it.each([
    ['curto demais', 'PEDR-7F3A-K9QD-M2XW'],
    ['longo demais', 'PEDR-7F3A-K9QD-M2XW-4HTB-AAAA'],
    ['com 0 no lugar de O', 'PEDR-7F3A-K9QD-M2XW-4HT0'],
    ['com I', 'PEDR-7F3A-K9QD-M2XW-4HTI'],
    ['com espaço no meio', 'PEDR 7F3A K9QD M2XW 4HTB'],
    ['vazio', ''],
  ])('recusa um código %s', (_, input) => {
    expect(normalizeRecoveryCode(input)).toBeNull();
  });

  it('o hash é HMAC-SHA256 hexadecimal, estável e dependente da chave', () => {
    const hash = hashRecoveryCode(secret, 'PEDR7F3AK9QDM2XW4HTB');
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hashRecoveryCode(secret, 'PEDR7F3AK9QDM2XW4HTB')).toBe(hash);
    expect(hashRecoveryCode(secret, 'PEDR7F3AK9QDM2XW4HTC')).not.toBe(hash);
    const otherKey = new Uint8Array(Buffer.alloc(48, 4));
    expect(hashRecoveryCode(otherKey, 'PEDR7F3AK9QDM2XW4HTB')).not.toBe(hash);
  });
});
