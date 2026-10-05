import type { GameState } from './types';

/**
 * Identidades do motor: o identificador estável de uma entidade que nasce durante a partida
 * (herói, expedição, item, caravana, Mestre).
 *
 * - **Contador no estado:** `state.ids[kind]` guarda quantos identificadores daquele tipo já
 *   foram dados. O contador só sobe: um identificador nunca é reutilizado, nem depois de a
 *   entidade terminar. Como `rng`, `ids` é `{}` até o primeiro uso e é JSON puro: salvar e
 *   recarregar continua a mesma contagem.
 * - **Nunca relógio, UUID ou sorteio:** a mesma semente com as mesmas ordens nos mesmos
 *   instantes dá os mesmos identificadores, e criar uma entidade não gasta fluxo nenhum.
 * - **Quem cria:** só `applyCommand` e os eventos da linha do tempo, dentro de `advanceTo`.
 *   `deriveViewState`, `nextEventAt`, o estado inicial e a migração nunca: uma leitura não pode
 *   gastar um identificador (`purity.test.ts` barra a importação deste módulo neles).
 * - **Ordem:** quando duas entidades agem no mesmo instante, a ordem é a do identificador.
 *
 * O `instanceId` das cartas do Conselho não sai daqui: é o id da carta mais `stats.cardsDrawn`,
 * já publicado em recibos e eventos.
 */

/** Um tipo de entidade: letras, começando por minúscula (`hero`, `expedition`, `caravan`). */
const KIND = /^[a-z][A-Za-z]*$/;

/**
 * O próximo identificador do tipo `kind`: `<kind>-<n>`, com `n` a partir de 1. Altera
 * `draft.ids`. Um tipo fora da forma, ou um contador gravado que não é um inteiro a partir de
 * zero, lança erro: é defeito de código ou estado corrompido, não uma recusa de regra.
 */
export function nextId(draft: GameState, kind: string): string {
  if (!KIND.test(kind)) {
    throw new Error(`Tipo de entidade inválido: ${String(kind)}.`);
  }
  const used = Object.hasOwn(draft.ids, kind) ? draft.ids[kind] : 0;
  if (!Number.isSafeInteger(used) || (used as number) < 0) {
    // Recomeçar do um repetiria identificadores já dados: melhor parar.
    throw new Error(`Contador de identidades corrompido: ${kind}.`);
  }
  const next = (used as number) + 1;
  draft.ids[kind] = next;
  return `${kind}-${next}`;
}
