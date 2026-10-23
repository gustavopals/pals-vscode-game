import {
  exactObject,
  integer,
  keyedRecordOf,
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
import { armyWithinState, UNIT_IDS_V28 } from './v28';
import { armyV29, formationsWithinState, LINE_IDS_V29, stateV29Fields, WING_IDS_V29 } from './v29';

// Como nas outras versões, os identificadores e os números ficam escritos aqui. O teste confere
// que hoje coincidem com o conteúdo (`balance.army.reportsKept`, `HORDE_UNIT_IDS`,
// `HERO_CLASS_IDS`, os desfechos e os fatores de `battleReport.ts`).
/** Quantos relatórios de batalha o estado guarda (`balance.army.reportsKept`). */
export const BATTLE_REPORTS_CAP_V30 = 3;
/** Os inimigos da versão 30 (`HORDE_UNIT_IDS`). */
export const HORDE_UNIT_IDS_V30: readonly string[] = [
  'wolf',
  'raider',
  'banditArcher',
  'blackKnight',
  'ogre',
  'skeleton',
  'shaman',
  'warlord',
];
/** As classes de herói (`HERO_CLASS_IDS`). */
export const HERO_CLASS_IDS_V30: readonly string[] = ['warrior', 'archer', 'mage', 'cleric'];
export const BATTLE_OUTCOMES_V30: readonly string[] = ['victory', 'held', 'defeat', 'withdrew'];
export const BATTLE_ENDINGS_V30: readonly string[] = [
  'annihilation',
  'rout',
  'chiefFell',
  'rounds',
];
export const BATTLE_FACTORS_V30: readonly string[] = [
  'wallAbsorbed',
  'counter',
  'exposedRear',
  'flank',
  'tower',
  'aura',
];
/**
 * Os fluxos de entidade que podem estar **gravados**: os da versão 13. O fluxo `battle:<id>`
 * (V4D-T1.4) nasce e é apagado dentro do instante da batalha, e um estado com ele é corrupção.
 */
export const STORED_RNG_FAMILIES_V30: readonly string[] = RNG_STREAM_FAMILIES_V13;

const owner = oneOf(['player', 'horde']);
const wing = oneOf(WING_IDS_V29);
const unit = oneOf([...UNIT_IDS_V28, ...HORDE_UNIT_IDS_V30]);
const post = exactObject({ owner, wing, line: oneOf(LINE_IDS_V29) });
const wallByWing = keyedRecordOf((key) => WING_IDS_V29.includes(key), 'uma ala', natural);

/**
 * Um relatório de batalha (`battleReport.ts`): só inteiros, textos e nulos. A moral é inteira e
 * pode ficar abaixo de zero numa rodada de muitas baixas.
 */
export const battleReportV30: Shape = exactObject({
  id: text,
  foughtAtMs: natural,
  mode: oneOf(['defense', 'attack']),
  outcome: oneOf(BATTLE_OUTCOMES_V30),
  ending: oneOf(BATTLE_ENDINGS_V30),
  rounds: natural,
  decisive: listOf(
    exactObject({
      factor: oneOf(BATTLE_FACTORS_V30),
      owner,
      amount: positive,
      wing: nullable(wing),
      round: positive,
      percent: nullable(natural),
    }),
  ),
  casualties: listOf(
    exactObject({
      owner,
      wing,
      line: oneOf(LINE_IDS_V29),
      unit,
      start: positive,
      lost: integer,
    }),
  ),
  wall: listOf(exactObject({ wing, start: natural, end: natural })),
  commanders: listOf(
    exactObject({
      heroId: text,
      wing,
      heroClass: oneOf(HERO_CLASS_IDS_V30),
      fate: nullable(oneOf(['wounded', 'died'])),
      xp: natural,
    }),
  ),
  log: listOf(
    exactObject({
      round: positive,
      attacks: listOf(
        exactObject({
          actor: post,
          unit,
          count: positive,
          target: post,
          wall: natural,
          damage: natural,
          casualties: natural,
        }),
      ),
      casualties: exactObject({ player: natural, horde: natural }),
      morale: exactObject({ player: integer, horde: integer }),
      wall: wallByWing,
    }),
  ),
});

/**
 * O `GameState` da versão 30: o da versão 29 com `army.reports` (V4D-T1.6), os relatórios das
 * batalhas mais recentes, até 3. `rng` e `ids` não mudam de forma: o contador `battle` entra em
 * `ids` como qualquer outro, e nenhum fluxo `battle:<id>` fica gravado.
 *
 * Quem subir `schemaVersion` para 31 acrescenta em `v30.ts` o passo `v30ToV31`.
 */
export const stateV30Fields: Readonly<Record<string, Shape>> = {
  ...stateV29Fields,
  schemaVersion: literal(30),
  army: (value, path) => {
    // O exército da versão 29 mais `reports`: a forma fechada da 29 recusaria a chave nova.
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
      return armyV29(value, path);
    }
    const { reports, ...rest } = value as Record<string, unknown>;
    const at = path === '' ? 'reports' : `${path}.reports`;
    if (reports === undefined) {
      return `${at}: campo ausente`;
    }
    return armyV29(rest, path) ?? listOf(battleReportV30)(reports, at);
  },
  rng: rngShape(RNG_FIXED_STREAMS_V21, STORED_RNG_FAMILIES_V30),
};

type ReportsWithin = { ids: Record<string, number>; army: { reports: Array<{ id: string }> } };

/**
 * A conferência dos relatórios com o resto do estado: no máximo 3, cada `id` é `battle-<n>` com
 * `n` dentro de `ids.battle`, sem repetição, em ordem crescente (do mais antigo ao mais novo).
 */
export const battleReportsWithinState: Shape = (value, path) => {
  const { ids, army } = value as ReportsWithin;
  const at = path === '' ? 'army.reports' : `${path}.army.reports`;
  if (army.reports.length > BATTLE_REPORTS_CAP_V30) {
    return `${at}: mais relatórios que o teto`;
  }
  const issued = Object.hasOwn(ids, 'battle') ? (ids.battle as number) : 0;
  let previous = 0;
  for (const [index, report] of army.reports.entries()) {
    const number = /^battle-[1-9][0-9]*$/.test(report.id) ? Number(report.id.slice(7)) : NaN;
    if (!(number > previous) || number > issued) {
      return `${at}.${String(index)}.id: identificador fora do contador de ids.battle, repetido ou fora de ordem`;
    }
    previous = number;
  }
  return null;
};

const stateV30Form: Shape = exactObject(stateV30Fields);
const stateV30Streams: Shape = rngWithinIds(STORED_RNG_FAMILIES_V30);

export const stateV30: Shape = (value, path) =>
  stateV30Form(value, path) ??
  stateV30Streams(value, path) ??
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
  formationsWithinState(value, path) ??
  battleReportsWithinState(value, path);
