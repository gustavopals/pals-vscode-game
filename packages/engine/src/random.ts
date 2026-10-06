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
 * Há fluxos **fixos**, um por assunto (`RNG_STREAMS`), e fluxos **de entidade**, um por entidade
 * que nasce e morre durante a partida (`RNG_STREAM_FAMILIES`): `expedition:expedition-<n>`,
 * `caravan:caravan-<n>`, sempre de um identificador já dado (`1 ≤ n ≤ state.ids[família]`). O fluxo de uma entidade é apagado quando ela termina (`dropStream`), e o
 * identificador dela nunca é reutilizado (`ids.ts`), então um fluxo apagado não renasce.
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
 * Fluxos fixos: os da v0.2 (as cartas do Conselho, as chegadas e partidas por moral e as
 * incursões por Ameaça) e, da v0.3, os candidatos da Taverna (`tavern`, V3C-T2). Um fluxo novo
 * entra aqui junto com a primeira mecânica que sorteia nele.
 */
export const RNG_STREAMS = ['council', 'morale', 'horde', 'tavern'] as const;
export type FixedRngStream = (typeof RNG_STREAMS)[number];

/**
 * Famílias de fluxo de entidade (GDD §14.3; ADR 0017, decisão 9): cada expedição e cada
 * caravana sorteia no próprio fluxo, `<família>:<id>`, com o `id` que `nextId` deu a ela (o
 * tipo da entidade é o nome da família: `expedition:expedition-3`). Duas
 * entidades nunca dividem um fluxo, então a ordem em que são processadas e a existência de
 * uma não mudam a sorte da outra.
 */
export const RNG_STREAM_FAMILIES = ['expedition', 'caravan'] as const;
export type RngStreamFamily = (typeof RNG_STREAM_FAMILIES)[number];
export type EntityRngStream = `${RngStreamFamily}:${string}`;

/** O nome de um fluxo: um dos fixos, ou o de uma entidade de uma família conhecida. */
export type RngStream = FixedRngStream | EntityRngStream;

/** O número de um identificador de `nextId`: a partir de 1, sem zeros à esquerda. */
const ENTITY_NUMBER = /^[1-9][0-9]*$/;

const isFixedStream = (name: string): name is FixedRngStream =>
  (RNG_STREAMS as readonly string[]).includes(name);

/**
 * As partes do nome de um fluxo de entidade, ou `null` se o nome não é um: `<família>:<id>`,
 * em que o `id` é o que `nextId` dá **ao tipo de mesmo nome da família** (`expedition-3` na
 * família `expedition`) e o número é um inteiro seguro. Amarrar o tipo à família é o que deixa
 * a guarda de forma conferir cada fluxo contra o contador dele em `state.ids`.
 */
function entityStreamParts(name: string): { family: RngStreamFamily; number: number } | null {
  const colon = name.indexOf(':');
  if (colon <= 0) {
    return null;
  }
  const family = name.slice(0, colon);
  if (!(RNG_STREAM_FAMILIES as readonly string[]).includes(family)) {
    return null;
  }
  const id = name.slice(colon + 1);
  if (!id.startsWith(`${family}-`)) {
    return null;
  }
  const digits = id.slice(family.length + 1);
  const number = Number(digits);
  if (!ENTITY_NUMBER.test(digits) || !Number.isSafeInteger(number)) {
    return null;
  }
  return { family: family as RngStreamFamily, number };
}

const isEntityStream = (name: string): name is EntityRngStream => entityStreamParts(name) !== null;

/**
 * Confere que a entidade do fluxo já recebeu o identificador: o número do nome vai de 1 ao
 * contador da família em `state.ids`. Um fluxo de uma entidade que `nextId` ainda não criou é
 * defeito de código (um nome montado à mão), e abri-lo gastaria a sorte de uma entidade futura.
 */
function assertIssued(draft: GameState, stream: EntityRngStream): void {
  const parts = entityStreamParts(stream);
  const issued =
    parts !== null && Object.hasOwn(draft.ids, parts.family) ? draft.ids[parts.family] : 0;
  if (parts === null || !Number.isSafeInteger(issued) || parts.number > (issued as number)) {
    throw new Error(`Fluxo de sorteio de uma entidade que não existe: ${String(stream)}.`);
  }
}

/**
 * O nome do fluxo da entidade `id` na família `family`. O `id` é o que `nextId` deu ao tipo
 * de mesmo nome: o tipo da entidade é a família. Outro tipo (`hero-1` em `expedition`) ou um
 * número fora da forma lança erro.
 */
export function entityStream(family: RngStreamFamily, id: string): EntityRngStream {
  const name = `${family}:${id}`;
  if (!isEntityStream(name)) {
    throw new Error(`Fluxo de sorteio desconhecido: ${name}.`);
  }
  return name;
}

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
  if (!isFixedStream(stream) && !isEntityStream(stream)) {
    // Um nome fora da lista e das famílias é defeito de código: o tipo já o barra, e um nome
    // montado em tempo de execução não pode abrir um fluxo que ninguém conhece.
    throw new Error(`Fluxo de sorteio desconhecido: ${String(stream)}.`);
  }
  if (!isFixedStream(stream)) {
    assertIssued(draft, stream);
  }
  const stored = Object.hasOwn(draft.rng, stream) ? draft.rng[stream] : undefined;
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
 * Apaga o fluxo de uma entidade que terminou (a expedição que voltou, a caravana que chegou):
 * o estado não cresce com as que já não existem. Só fluxos de família; apagar um fluxo fixo, ou
 * um nome desconhecido, ou o de uma entidade que `nextId` ainda não criou, lança erro. Apagar o
 * fluxo de uma entidade que nunca sorteou não faz nada. Altera `draft.rng`.
 *
 * Um fluxo apagado e usado de novo recomeçaria da semente e repetiria a mesma sequência. Isso
 * nunca acontece porque o identificador da entidade não volta: o contador de `ids.ts` só sobe.
 */
export function dropStream(draft: GameState, stream: EntityRngStream): void {
  if (!isEntityStream(stream)) {
    throw new Error(
      isFixedStream(stream)
        ? `O fluxo de sorteio ${String(stream)} é fixo e não pode ser apagado.`
        : `Fluxo de sorteio desconhecido: ${String(stream)}.`,
    );
  }
  assertIssued(draft, stream);
  if (Object.hasOwn(draft.rng, stream)) {
    delete draft.rng[stream];
  }
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
