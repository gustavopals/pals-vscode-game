const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const LENGTH = 20;

/** Tira espaços das pontas e hífens e põe em maiúsculas, como o servidor faz. */
export function normalizeRecoveryCode(input: string): string {
  return input.trim().replace(/-/g, '').toUpperCase();
}

/**
 * Confere a forma do Código do Reino antes de mandá-lo ao servidor, que aceita só 5 tentativas
 * por hora. Devolve a mensagem de erro para o campo, ou `null` se a forma está certa.
 */
export function validateRecoveryCode(input: string): string | null {
  const code = normalizeRecoveryCode(input);
  if (code.length === 0) {
    return 'Digite o código de 20 caracteres, como PEDR-7F3A-K9QD-M2XW-4HTB.';
  }
  const invalid = [...code].find((char) => !ALPHABET.includes(char));
  if (invalid !== undefined) {
    return `"${invalid}" não aparece em nenhum código. Os códigos não usam 0, O, 1 nem I.`;
  }
  if (code.length !== LENGTH) {
    return `O código tem ${LENGTH} caracteres; você digitou ${code.length}.`;
  }
  return null;
}
