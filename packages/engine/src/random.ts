import type { Ratio } from '@lotg/content';

import type { GameState } from './types';

/**
 * Sorteios do motor: um gerador com semente, em inteiros, com um fluxo por assunto.
 *
 * - **Algoritmo:** xoshiro128** (Blackman e Vigna), com estado de quatro inteiros de 32 bits.
 * - **Semente de um fluxo:** FNV-1a de 32 bits sobre os bytes UTF-8 de `seed + ':' + nome`; o
 *   resultado alimenta um SplitMix32, e as quatro primeiras saídas dele são o estado inicial.
 * - **Sem ponto flutuante:** nenhum sorteio passa por um número entre 0 e 1. Um inteiro em
 *   `[0, max)` sai por rejeição, sem viés, e uma chance é a comparação de dois inteiros.
 *
 * Cada fluxo guarda o próprio estado em `state.rng[nome]` e nasce na primeira vez em que é
 * usado, então sortear em um não desloca os outros e o estado continua JSON puro: salvar e
 * recarregar segue a mesma sequência.
 *
 * Quem sorteia é `advanceTo`, em eventos com hora marcada na linha do tempo. `deriveViewState`,
 * `nextEventAt`, as recusas e os recibos nunca sorteiam, e o estado do gerador nunca sai no
 * `ViewState`: quem lê a tela não pode prever nem rerrolar o que vem.
 */

/**
 * Versão do algoritmo. Trocar o gerador, o hash da semente ou a redução a um intervalo muda o
 * futuro de toda partida em andamento: é uma mudança de regra, que sobe esta versão, regrava
 * de propósito os vetores de `random.test.ts` e passa por um passo de migração do estado.
 */
export const RNG_VERSION = 1;

/**
 * Fluxos da v0.2: as cartas do Conselho, as chegadas e partidas por moral e as incursões por
 * Ameaça. Um fluxo novo entra aqui junto com a primeira mecânica que sorteia nele.
 */
export const RNG_STREAMS = ['council', 'morale', 'horde'] as const;
export type RngStream = (typeof RNG_STREAMS)[number];

/** Estado de um fluxo: quatro inteiros sem sinal de 32 bits, nunca todos zero. */
export type StreamWords = [number, number, number, number];

/** Quantidade de valores de 32 bits: 2^32. */
const UINT32_RANGE = 0x1_0000_0000;

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

/**
 * SplitMix32: um contador que anda de 0x9e3779b9 em 0x9e3779b9, embaralhado pelo finalizador de
 * 32 bits do MurmurHash3. O finalizador é uma bijeção, então quatro saídas seguidas nunca são
 * todas zero, o único estado que o xoshiro não aceita.
 */
function splitMix32(seed: number): () => number {
  let counter = seed;
  return () => {
    counter = (counter + 0x9e3779b9) | 0;
    let mixed = counter;
    mixed = Math.imul(mixed ^ (mixed >>> 16), 0x85ebca6b);
    mixed = Math.imul(mixed ^ (mixed >>> 13), 0xc2b2ae35);
    return (mixed ^ (mixed >>> 16)) >>> 0;
  };
}

/** Estado inicial do fluxo `stream` de uma partida: depende só da semente e do nome. */
export function seedStream(seed: string, stream: string): StreamWords {
  const next = splitMix32(hashText(`${seed}:${stream}`));
  return [next(), next(), next(), next()];
}

function rotateLeft(value: number, bits: number): number {
  return (value << bits) | (value >>> (32 - bits));
}

/** Um passo do xoshiro128**: devolve um inteiro em `[0, 2^32)` e avança `words` no lugar. */
export function nextUint32(words: StreamWords): number {
  let [s0, s1, s2, s3] = words;
  const result = Math.imul(rotateLeft(Math.imul(s1, 5), 7), 9) >>> 0;
  const shifted = s1 << 9;
  s2 ^= s0;
  s3 ^= s1;
  s1 ^= s2;
  s0 ^= s3;
  s2 ^= shifted;
  s3 = rotateLeft(s3, 11);
  words[0] = s0 >>> 0;
  words[1] = s1 >>> 0;
  words[2] = s2 >>> 0;
  words[3] = s3 >>> 0;
  return result;
}

function isStreamWords(stored: number[]): stored is StreamWords {
  return (
    stored.length === 4 &&
    stored.every((word) => Number.isInteger(word) && word >= 0 && word < UINT32_RANGE) &&
    stored.some((word) => word !== 0)
  );
}

/** O estado do fluxo dentro do rascunho, criado a partir da semente na primeira vez. */
function wordsOf(draft: GameState, stream: RngStream): StreamWords {
  const stored = draft.rng[stream];
  if (stored === undefined) {
    const fresh = seedStream(draft.seed, stream);
    draft.rng[stream] = fresh;
    return fresh;
  }
  if (!isStreamWords(stored)) {
    // Recomeçar da semente repetiria sorteios já feitos: melhor parar do que rerrolar calado.
    throw new Error(`Fluxo de sorteio corrompido: ${stream}.`);
  }
  return stored;
}

/**
 * Sorteia um inteiro em `[0, maxExclusive)`, com a mesma chance para cada valor.
 *
 * Os valores de 32 bits que sobram depois do último múltiplo inteiro de `maxExclusive` são
 * descartados e o sorteio se repete (rejeição): sem isso os primeiros valores sairiam mais.
 * Toda chamada gasta o fluxo, mesmo com `maxExclusive` igual a 1. Altera `draft.rng`.
 */
export function nextInt(draft: GameState, stream: RngStream, maxExclusive: number): number {
  if (!Number.isInteger(maxExclusive) || maxExclusive < 1 || maxExclusive > UINT32_RANGE) {
    throw new Error(`Limite de sorteio inválido: ${String(maxExclusive)}.`);
  }
  const words = wordsOf(draft, stream);
  const limit = UINT32_RANGE - (UINT32_RANGE % maxExclusive);
  let value = nextUint32(words);
  while (value >= limit) {
    value = nextUint32(words);
  }
  return value % maxExclusive;
}

/**
 * Sorteia um acontecimento com chance `num / den`: tira um inteiro em `[0, den)` e o compara
 * com `num`. Zero nunca acontece e `num >= den` acontece sempre, mas os dois também gastam o
 * fluxo: quem não quer sortear uma certeza não chama. Altera `draft.rng`.
 */
export function chance(draft: GameState, stream: RngStream, ratio: Ratio): boolean {
  const { num, den } = ratio;
  if (!Number.isSafeInteger(num) || num < 0 || !Number.isSafeInteger(den) || den < 1) {
    throw new Error(`Chance inválida: ${String(num)}/${String(den)}.`);
  }
  return nextInt(draft, stream, den) < num;
}

/**
 * Sorteia um item com chance proporcional ao peso (inteiro a partir de zero). Itens de peso
 * zero nunca saem. Lista vazia ou só de pesos zero devolve `null` **sem gastar o fluxo**: não
 * havia o que sortear. Devolve o próprio item da lista, não uma cópia.
 *
 * A ordem da lista faz parte do sorteio: passe sempre na ordem do conteúdo, nunca na ordem de
 * chaves de um objeto montado em tempo de execução. Altera `draft.rng`.
 */
export function pickWeighted<T extends { readonly weight: number }>(
  draft: GameState,
  stream: RngStream,
  items: readonly T[],
): T | null {
  let total = 0;
  for (const item of items) {
    if (!Number.isSafeInteger(item.weight) || item.weight < 0) {
      throw new Error(`Peso de sorteio inválido: ${String(item.weight)}.`);
    }
    total += item.weight;
  }
  if (total === 0) {
    return null;
  }
  let roll = nextInt(draft, stream, total);
  for (const item of items) {
    if (roll < item.weight) {
      return item;
    }
    roll -= item.weight;
  }
  throw new Error('Sorteio ponderado sem resultado.');
}
