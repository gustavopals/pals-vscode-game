import { createHmac, randomBytes } from 'node:crypto';

// 32 símbolos sem ambiguidades (sem 0/O nem 1/I): 5 bits cada, 100 bits em 20 caracteres.
export const RECOVERY_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const RECOVERY_CODE_LENGTH = 20;
const GROUP_SIZE = 4;

/** Gera um Código do Reino já normalizado, com distribuição uniforme sobre o alfabeto. */
export function generateRecoveryCode(): string {
  // 256 é múltiplo de 32: o resto da divisão de um byte aleatório não tem viés.
  const bytes = randomBytes(RECOVERY_CODE_LENGTH);
  let code = '';
  for (const byte of bytes) {
    code += RECOVERY_ALPHABET[byte % RECOVERY_ALPHABET.length];
  }
  return code;
}

/** XXXX-XXXX-XXXX-XXXX-XXXX, a forma em que o código é exibido uma única vez. */
export function formatRecoveryCode(normalized: string): string {
  return normalized.match(new RegExp(`.{${GROUP_SIZE}}`, 'g'))?.join('-') ?? normalized;
}

/**
 * Normaliza o que o jogador digitou: remove espaços das pontas e hífens e põe em maiúsculas.
 * Devolve `null` se o resultado não tiver exatamente 20 caracteres do alfabeto.
 */
export function normalizeRecoveryCode(input: string): string | null {
  const normalized = input.trim().replace(/-/g, '').toUpperCase();
  if (normalized.length !== RECOVERY_CODE_LENGTH) {
    return null;
  }
  for (const char of normalized) {
    if (!RECOVERY_ALPHABET.includes(char)) {
      return null;
    }
  }
  return normalized;
}

/** HMAC-SHA256 hexadecimal do código normalizado, com a chave própria de recuperação (ADR 0003). */
export function hashRecoveryCode(secret: Uint8Array, normalized: string): string {
  return createHmac('sha256', secret).update(normalized).digest('hex');
}
