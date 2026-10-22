import {
  exactObject,
  listOf,
  literal,
  natural,
  nullable,
  oneOf,
  positive,
  text,
  type Shape,
} from './shape';
import { rngShape, rngWithinIds, RNG_STREAM_FAMILIES_V13 } from './v13';
import { guildWithinState } from './v14';
import { tavernWithinState } from './v16';
import { expeditionsWithinState } from './v17';
import { outcomesWithinState } from './v18';
import { freedWithinState } from './v20';
import { marketWithinState, RNG_FIXED_STREAMS_V21 } from './v21';
import { caravansWithinState } from './v22';
import { mastersWithinState } from './v23';
import { marketLimitsWithinState, workedWithinState } from './v24';
import { ironMarketWithinState } from './v25';
import { forgeWithinStateV27 } from './v27';
import { armyWithinState, stateV28Fields, UNIT_IDS_V28 } from './v28';

// Como nas outras versões, os identificadores e os números ficam escritos aqui. O teste confere
// que hoje coincidem com o conteúdo (`WING_IDS`, `LINE_IDS`, `units`, `balance.army`).
/** As alas da versão 29, da esquerda para a direita (`WING_IDS`). */
export const WING_IDS_V29: readonly string[] = ['left', 'center', 'right'];
/** As linhas de cada ala (`LINE_IDS`). */
export const LINE_IDS_V29: readonly string[] = ['front', 'back'];
/** A linha de cada unidade (`units[id].line`): o Arqueiro só combate atrás. */
export const UNIT_LINE_V29: Readonly<Record<string, string>> = {
  spearman: 'front',
  swordsman: 'front',
  archer: 'back',
  knight: 'front',
  shieldbearer: 'front',
};
/** Quantas formações o estado guarda (`balance.army.formationsCap`). */
export const FORMATIONS_CAP_V29 = 5;
/** O maior posto possível, com o Quartel no nível 5 ou acima (`balance.army.postMaxFromLevel.max`). */
export const POST_MAX_V29 = 30;
/** O maior nome de formação (`balance.army.formationNameMaxLength`). */
export const FORMATION_NAME_MAX_V29 = 30;

const eachWing = (shape: Shape) =>
  exactObject(Object.fromEntries(WING_IDS_V29.map((wing) => [wing, shape])));
const eachLine = (shape: Shape) =>
  exactObject(Object.fromEntries(LINE_IDS_V29.map((line) => [line, shape])));

/**
 * O `GameState` da versão 29: o da versão 28 com as formações salvas e a Defesa ativa (V4C-T2;
 * ADR 0019, decisões 8 e 9).
 *
 * - `army.formations`: até 5, cada uma com `id` (`formation-<n>`, de `ids.formation`), `name`,
 *   `posts` (3 alas × 2 linhas, cada posto `null` ou `{ unit, count }`) e `commanders` (por ala,
 *   o `id` de um herói ou `null`).
 * - `army.activeFormationId`: o `id` de uma delas, ou `null`.
 * - `rng` e `ids` não mudam de forma: salvar uma formação não sorteia e só dá identificador.
 *
 * Quem subir `schemaVersion` para 30 acrescenta em `v29.ts` o passo `v29ToV30`.
 */
export const armyV29: Shape = exactObject({
  ...armyV28Fields(),
  formations: listOf(
    exactObject({
      id: text,
      name: text,
      posts: eachWing(
        eachLine(nullable(exactObject({ unit: oneOf(UNIT_IDS_V28), count: positive }))),
      ),
      commanders: eachWing(nullable(text)),
    }),
  ),
  activeFormationId: nullable(text),
});

/** Os campos de `army` da versão 28, reaproveitados (o `armyV28` é um `Shape` fechado). */
function armyV28Fields(): Record<string, Shape> {
  return {
    units: exactObject(Object.fromEntries(UNIT_IDS_V28.map((key) => [key, natural]))),
    training: nullable(
      exactObject({
        unit: oneOf(UNIT_IDS_V28),
        amount: positive,
        startedAtMs: natural,
        endsAtMs: natural,
      }),
    ),
  };
}

export const stateV29Fields: Readonly<Record<string, Shape>> = {
  ...stateV28Fields,
  schemaVersion: literal(29),
  army: armyV29,
  rng: rngShape(RNG_FIXED_STREAMS_V21, RNG_STREAM_FAMILIES_V13),
};

type FormationV29 = {
  id: string;
  name: string;
  posts: Record<string, Record<string, { unit: string; count: number } | null>>;
  commanders: Record<string, string | null>;
};

type FormationsWithin = {
  ids: Record<string, number>;
  guild: { heroes: Array<{ id: string; status: string }> };
  army: { formations: FormationV29[]; activeFormationId: string | null };
};

/**
 * A conferência das formações com o resto do estado, que uma guarda de campo não alcança: no
 * máximo 5; cada `id` é `formation-<n>` com `n` dentro de `ids.formation`, sem repetição; o
 * nome aparado cabe em 30; cada posto leva de 1 a 30 e a unidade certa para a linha; todo
 * comandante é um herói do feudo que não está em cativeiro, e nenhum comanda duas alas da
 * mesma formação; a Defesa ativa é uma formação que existe. (O teto por posto de 20 ou 30
 * depende do nível do Quartel; a guarda confere o maior.)
 */
export const formationsWithinState: Shape = (value, path) => {
  const { ids, guild, army } = value as FormationsWithin;
  const at = path === '' ? 'army' : `${path}.army`;
  if (army.formations.length > FORMATIONS_CAP_V29) {
    return `${at}.formations: mais formações que o teto`;
  }
  const issued = Object.hasOwn(ids, 'formation') ? (ids.formation as number) : 0;
  const seen = new Set<string>();
  for (const [index, formation] of army.formations.entries()) {
    const here = `${at}.formations.${index}`;
    if (
      !/^formation-[1-9][0-9]*$/.test(formation.id) ||
      Number(formation.id.slice(10)) > issued ||
      seen.has(formation.id)
    ) {
      return `${here}.id: identificador fora do contador de ids.formation ou repetido`;
    }
    seen.add(formation.id);
    if (formation.name.trim() !== formation.name || formation.name.length < 1) {
      return `${here}.name: nome vazio ou não aparado`;
    }
    if (formation.name.length > FORMATION_NAME_MAX_V29) {
      return `${here}.name: nome acima do máximo`;
    }
    let filled = 0;
    for (const wing of WING_IDS_V29) {
      for (const line of LINE_IDS_V29) {
        const post = formation.posts[wing]?.[line];
        if (post === null || post === undefined) {
          continue;
        }
        filled += 1;
        if (post.count > POST_MAX_V29) {
          return `${here}.posts.${wing}.${line}.count: posto acima do máximo`;
        }
        if (UNIT_LINE_V29[post.unit] !== line) {
          return `${here}.posts.${wing}.${line}.unit: unidade na linha errada`;
        }
      }
    }
    if (filled === 0) {
      return `${here}.posts: formação sem nenhum posto`;
    }
    const named = new Set<string>();
    for (const wing of WING_IDS_V29) {
      const heroId = formation.commanders[wing];
      if (heroId === null || heroId === undefined) {
        continue;
      }
      const hero = guild.heroes.find((entry) => entry.id === heroId);
      if (hero === undefined) {
        return `${here}.commanders.${wing}: comandante que não é herói do feudo`;
      }
      if (hero.status === 'captured') {
        return `${here}.commanders.${wing}: comandante em cativeiro`;
      }
      if (named.has(heroId)) {
        return `${here}.commanders.${wing}: o mesmo herói comanda duas alas`;
      }
      named.add(heroId);
    }
  }
  if (army.activeFormationId !== null && !seen.has(army.activeFormationId)) {
    return `${at}.activeFormationId: Defesa ativa que não é uma formação salva`;
  }
  return null;
};

const stateV29Form: Shape = exactObject(stateV29Fields);
const stateV29Streams: Shape = rngWithinIds(RNG_STREAM_FAMILIES_V13);

export const stateV29: Shape = (value, path) =>
  stateV29Form(value, path) ??
  stateV29Streams(value, path) ??
  guildWithinState(value, path) ??
  tavernWithinState(value, path) ??
  expeditionsWithinState(value, path) ??
  outcomesWithinState(value, path) ??
  freedWithinState(value, path) ??
  marketWithinState(value, path) ??
  ironMarketWithinState(value, path) ??
  caravansWithinState(value, path) ??
  mastersWithinState(value, path) ??
  workedWithinState(value, path) ??
  marketLimitsWithinState(value, path) ??
  forgeWithinStateV27(value, path) ??
  armyWithinState(value, path) ??
  formationsWithinState(value, path);
