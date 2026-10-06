/**
 * O hash de um texto, sem estado: é a semente de cada fluxo de sorteio (`random.ts`) e a conta
 * que escolhe a variante de uma expedição sem sortear (`expeditions.ts`; ADR 0017, decisão 9).
 * Fica fora de `random.ts` para quem só lê poder usá-lo sem importar o gerador: `purity.test.ts`
 * barra a importação de `random.ts` em quem mostra, agenda ou cumpre ordens.
 *
 * Trocar o hash é mudar uma regra, como trocar o gerador (`RNG_VERSION`): os vetores de
 * `random.test.ts` o congelam.
 */

/**
 * Bytes UTF-8 de um texto, escritos à mão: o motor não depende de `TextEncoder`, que é do
 * ambiente. Um substituto solto (metade de um par) é codificado como veio, em três bytes.
 */
export function utf8Bytes(text: string): number[] {
  const bytes: number[] = [];
  for (const symbol of text) {
    const code = symbol.codePointAt(0) ?? 0;
    if (code < 0x80) {
      bytes.push(code);
    } else if (code < 0x800) {
      bytes.push(0xc0 | (code >>> 6), 0x80 | (code & 0x3f));
    } else if (code < 0x10000) {
      bytes.push(0xe0 | (code >>> 12), 0x80 | ((code >>> 6) & 0x3f), 0x80 | (code & 0x3f));
    } else {
      bytes.push(
        0xf0 | (code >>> 18),
        0x80 | ((code >>> 12) & 0x3f),
        0x80 | ((code >>> 6) & 0x3f),
        0x80 | (code & 0x3f),
      );
    }
  }
  return bytes;
}

/** FNV-1a de 32 bits sobre os bytes UTF-8 do texto. */
export function hashText(text: string): number {
  let hash = 0x811c9dc5;
  for (const byte of utf8Bytes(text)) {
    hash = Math.imul(hash ^ byte, 0x01000193);
  }
  return hash >>> 0;
}
