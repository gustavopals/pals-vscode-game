import {
  listOf,
  natural,
  oneOf,
  exactObject,
  keyedRecordOf,
  literal,
  nullable,
  positive,
  type Shape,
} from './shape';
import type { MigrationStep, StoredState } from './step';
import { UNIT_IDS_V28 } from './v28';
import { stateV43 } from './v43';

const object = (value: unknown): value is StoredState =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const memoryShape = nullable(
  exactObject({
    total: positive,
    byUnit: keyedRecordOf((key) => UNIT_IDS_V28.includes(key), 'unidade da formação', positive),
  }),
);

const VOW_IDS_V44 = ['noWalls', 'cunningHorde', 'scarceFood', 'mortalHeroes'];
const vowList = listOf(oneOf(VOW_IDS_V44));
const vowsShape = exactObject({
  year: positive,
  taken: vowList,
  closesAtMs: natural,
  nextTaken: nullable(vowList),
});
const YEAR_MS_V44 = 604_800_000;
const WINDOW_REAL_MS_V44 = 86_400_000;

/** Estado da Fase C. Números congelados; nenhum conteúdo vivo entra na migração. */
export const stateV44: Shape = (value, path) => {
  const at = (key: string) => (path === '' ? key : `${path}.${key}`);
  if (!object(value) || !object(value.horde)) return `${at('horde')}: Horda ausente`;
  const version = literal(44)(value.schemaVersion, at('schemaVersion'));
  if (version !== null) return version;
  const { vows: vowEntry, ...legacyState } = value;
  const vowError = vowsShape(vowEntry, at('vows'));
  if (vowError !== null) return vowError;
  const choice = vowEntry as {
    year: number;
    taken: string[];
    closesAtMs: number;
    nextTaken: string[] | null;
  };
  if (
    object(value.clock) &&
    positive(value.clock.year, '') === null &&
    choice.year !== value.clock.year
  )
    return `${at('vows.year')}: ano diferente do calendário`;
  for (const list of [choice.taken, choice.nextTaken ?? []]) {
    if (new Set(list).size !== list.length) return `${at('vows')}: Votos repetidos`;
    if (
      object(value.settings) &&
      value.settings.difficulty === 'ironKing' &&
      list.some((id) => id === 'cunningHorde' || id === 'mortalHeroes')
    )
      return `${at('vows')}: desafio já imposto pela dificuldade`;
  }
  if (
    choice.nextTaken !== null &&
    (!object(value.siege) ||
      value.siege.year !== choice.year ||
      value.siege.result === null ||
      choice.closesAtMs > (value.lastProcessedAt as number))
  )
    return `${at('vows.nextTaken')}: escolha antecipada fora do rescaldo ou sem fechar a janela`;
  const { previousYearFormation, ...horde } = value.horde;
  const error = memoryShape(previousYearFormation, at('horde.previousYearFormation'));
  if (error !== null) return error;
  if (previousYearFormation !== null) {
    const memory = previousYearFormation as { total: number; byUnit: Record<string, number> };
    if (
      memory.total > 180 ||
      Object.values(memory.byUnit).reduce((a, b) => a + b, 0) !== memory.total
    )
      return `${at('horde.previousYearFormation')}: total inválido para seis postos`;
  }

  // A v43 limita ondas a 105. Conferimos os efetivos originais, depois reduzimos
  // somente a fachada entregue à guarda congelada, conservando postos/referências.
  const plans = [horde.wavePlan, value.siege];
  let needsProjection = false;
  for (const plan of plans) {
    if (!object(plan) || !Array.isArray(plan.waves)) continue;
    const yearError = positive(plan.year, at('horde.year'));
    if (yearError !== null) return yearError;
    const max = Math.max(105, Math.ceil((105 * (10 + (plan.year as number) - 1)) / 10));
    for (const wave of plan.waves) {
      if (!object(wave) || !Array.isArray(wave.composition)) continue;
      let total = 0;
      for (const post of wave.composition) {
        if (!object(post)) continue;
        const invalid = positive(post.count, at('horde.waves.count'));
        if (invalid !== null) return invalid;
        if (post.unit === 'troll' && (plan.year as number) < 2)
          return `${at('horde.waves')}: Troll só a partir do Ano 2`;
        total += post.count as number;
      }
      if (!Number.isSafeInteger(total) || total > max)
        return `${at('horde.waves')}: onda acima do tamanho máximo do ano`;
      needsProjection ||= total > 105;
    }
  }
  if (object(horde.wavePlan) && Array.isArray(horde.wavePlan.waves) && Array.isArray(horde.omens)) {
    for (const omen of horde.omens) {
      if (!object(omen) || !Array.isArray(omen.reveals)) continue;
      const wave = horde.wavePlan.waves.find((w) => object(w) && w.number === omen.wave);
      if (!object(wave) || !Array.isArray(wave.composition)) continue;
      for (const post of omen.reveals) {
        if (!object(post)) continue;
        const actual = wave.composition.find(
          (p) => object(p) && p.wing === post.wing && p.line === post.line && p.unit === post.unit,
        );
        if (omen.clarity === 'exact' || omen.clarity === 'partial') {
          if (!object(actual)) return `${at('horde.omens')}: posto difere da onda`;
          const expected =
            omen.clarity === 'exact'
              ? actual.count
              : Math.max(5, Math.round((actual.count as number) / 5) * 5);
          if (post.count !== expected) return `${at('horde.omens')}: contagem difere da onda`;
        }
      }
    }
  }
  // A nova unidade é validada como Ogro na fachada histórica: mesmas posições
  // possíveis, sem alterar o JSON persistido ou as enumerações da v43.
  if (!needsProjection && stateV43({ ...legacyState, schemaVersion: 43, horde }, path) === null)
    return null;
  const inherited = JSON.parse(
    JSON.stringify({ ...legacyState, schemaVersion: 43, horde }),
  ) as StoredState;
  const capPosts = (entry: unknown): void => {
    if (Array.isArray(entry)) entry.forEach(capPosts);
    else if (object(entry)) {
      if ('wing' in entry && 'line' in entry && 'unit' in entry && typeof entry.count === 'number')
        entry.count = Math.min(entry.count, 10);
      Object.values(entry).forEach(capPosts);
    }
  };
  const oldHorde = inherited.horde as StoredState;
  capPosts(oldHorde.wavePlan);
  capPosts(oldHorde.omens);
  capPosts(inherited.siege);
  const projectTrolls = (entry: unknown): void => {
    if (Array.isArray(entry)) entry.forEach(projectTrolls);
    else if (object(entry)) {
      if (entry.unit === 'troll') entry.unit = 'ogre';
      Object.values(entry).forEach(projectTrolls);
    }
  };
  projectTrolls(inherited);
  return stateV43(inherited, path);
};

/** D-4: um passo 43→44, completado nesta mesma versão pelas tarefas da Fase C. */
export const v43ToV44: MigrationStep = {
  from: 43,
  summary: 'Acrescenta memória anterior e janela de Votos sem escolhas nem efeitos retroativos.',
  shape: stateV43,
  migrate: (state, context) => {
    const year = Math.floor(context.boundaryMs / YEAR_MS_V44) + 1;
    const window = Math.max(
      1,
      Math.round(WINDOW_REAL_MS_V44 * ((state.settings as StoredState).timeScale as number)),
    );
    const siege = state.siege as StoredState | null;
    const inAftermath =
      siege !== null &&
      siege.year === year &&
      siege.result !== null &&
      (siege.endedAtMs as number) <= context.boundaryMs;
    return {
      ...state,
      schemaVersion: 44,
      vows: {
        year,
        taken: [],
        nextTaken: null,
        closesAtMs: (inAftermath ? year : year - 1) * YEAR_MS_V44 + window,
      },
      horde: { ...(state.horde as StoredState), previousYearFormation: null },
    };
  },
};
