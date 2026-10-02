import { balance, type DifficultyId, RESOURCE_IDS } from '@lotg/content';

import type { StrategyName } from './bots';
import { type Band, bandFor, type CellKey, cellKey, checkBand } from './bands';
import { IDENTITY, identityLine } from './identity';
import {
  formatDecimal,
  refusedByCode,
  runMechanicColumns,
  summarize,
  type Summary,
  SURPLUS_RESOURCES,
  type SurplusResource,
  WASTE_RESOURCES,
  type WasteResource,
} from './report';
import { simulate } from './simulate';

const HOUR_MS = 3_600_000;
const WEEK_REAL_HOURS = 7 * 24;

/** As 50 sementes fixas da matriz (GDD §15.3): `pedra-alta-001` a `pedra-alta-050`. */
export const MATRIX_SEEDS: readonly string[] = Array.from(
  { length: 50 },
  (_, index) => `pedra-alta-${String(index + 1).padStart(3, '0')}`,
);

export type Profile = {
  readonly id: 'preguicoso' | 'regular' | 'dedicado';
  readonly label: string;
  /** Visitas por dia real, a intervalos iguais, a primeira na criação da partida. */
  readonly sessionsPerDay: number;
  readonly strategy: StrategyName;
};

/** Os perfis de visita do GDD §15.2, cada um com o bot que joga as suas sessões. */
export const PROFILES: readonly Profile[] = [
  { id: 'preguicoso', label: 'Preguiçoso', sessionsPerDay: 1, strategy: 'preguicoso' },
  { id: 'regular', label: 'Regular', sessionsPerDay: 2, strategy: 'economico' },
  { id: 'dedicado', label: 'Dedicado', sessionsPerDay: 4, strategy: 'economico' },
];
export type ProfileId = Profile['id'];

/**
 * As duas janelas de medida. Não se comparam entre si: em 7 dias reais o ritmo 3 atravessa três
 * anos de jogo e o 0,5, meio ano; em um ano de jogo, o ritmo 3 dura 56 h reais e o 0,5, 14 dias.
 */
export const WINDOWS = [
  { id: 'week', label: '7 dias reais' },
  { id: 'year', label: 'Um ano de jogo' },
] as const;
export type WindowId = (typeof WINDOWS)[number]['id'];

/** Horas de jogo de um ano, pelo calendário do conteúdo. */
export const YEAR_GAME_HOURS =
  (balance.calendar.dayMs *
    balance.calendar.seasons.reduce((sum, season) => sum + season.days, 0)) /
  HOUR_MS;

/** Horas reais de uma janela em um ritmo. */
export function windowRealHours(window: WindowId, timeScale: number): number {
  if (window === 'week') {
    return WEEK_REAL_HOURS;
  }
  const hours = YEAR_GAME_HOURS / timeScale;
  if (!Number.isInteger(hours)) {
    throw new Error(
      `No ritmo ${formatDecimal(timeScale)}× um ano de jogo dura ${formatDecimal(hours)} h reais; o simulador anda em horas inteiras.`,
    );
  }
  return hours;
}

/** Anos de jogo atravessados em `realHours` horas reais. */
export function gameYearsIn(realHours: number, timeScale: number): number {
  return (realHours * timeScale) / YEAR_GAME_HOURS;
}

export type MatrixRun = {
  window: WindowId;
  timeScale: number;
  profile: Profile;
  seed: string;
  realHours: number;
  summary: Summary;
};

export type Range = { min: number; max: number };

/** O que as sementes de uma célula (janela, ritmo, perfil) mediram: o menor e o maior valor. */
export type CellMeasure = {
  villagers: Range;
  townHall: Range;
  famineHours: Range;
  coldHours: Range;
  /** A menor moral de cada partida, e as horas com ela nas faixas de baixo. */
  moraleMin: Range;
  lowMoraleHours: Range;
  /** Aldeões que foram embora (partidas e deserções), por partida. */
  villagersLost: Range;
  queueIdleHours: Range;
  plannedIdleHours: Range;
  freeVillagerHours: Range;
  commandsRefused: Range;
  surplus: Record<SurplusResource, Range>;
  wasted: Record<WasteResource, Range>;
  wasteHours: Range;
};

export type MatrixCell = {
  key: CellKey;
  window: WindowId;
  timeScale: number;
  paceLabel: string;
  profile: Profile;
  realHours: number;
  gameYears: number;
  seeds: number;
  measure: CellMeasure;
  /** `null` quando não há faixa para a célula (outra dificuldade, ritmo fora do conteúdo). */
  band: Band | null;
  /** Uma frase por problema, com quantas sementes o tiveram; vazio quando a célula está dentro. */
  violations: string[];
};

export type MatrixOptions = {
  /** Sementes da rodada; o padrão são as 50 fixas. */
  seeds?: readonly string[];
  /** Dificuldade das partidas; o padrão, e a única com faixas, é `lord`. */
  difficulty?: DifficultyId;
  /** Ritmos da rodada; o padrão são os que o conteúdo oferece. */
  timeScales?: readonly number[];
};

export type MatrixResult = {
  identity: typeof IDENTITY;
  difficulty: DifficultyId;
  difficultyLabel: string;
  seeds: readonly string[];
  runs: MatrixRun[];
  cells: MatrixCell[];
};

function rangeOf(values: number[]): Range {
  return { min: Math.min(...values), max: Math.max(...values) };
}

function measureOf(summaries: Summary[]): CellMeasure {
  const range = (pick: (summary: Summary) => number) => rangeOf(summaries.map(pick));
  return {
    villagers: range((summary) => summary.villagers),
    townHall: range((summary) => summary.townHall),
    famineHours: range((summary) => summary.famineHours),
    coldHours: range((summary) => summary.coldHours),
    moraleMin: range((summary) => summary.moraleMin),
    lowMoraleHours: range((summary) => summary.lowMoraleHours),
    villagersLost: range((summary) => summary.villagersLeft + summary.villagersDeserted),
    queueIdleHours: range((summary) => summary.queueIdleHours),
    plannedIdleHours: range((summary) => summary.plannedIdleHours),
    freeVillagerHours: range((summary) => summary.freeVillagerHours),
    commandsRefused: range((summary) => summary.commandsRefused),
    surplus: Object.fromEntries(
      SURPLUS_RESOURCES.map((id) => [id, range((summary) => summary.surplus[id])]),
    ) as Record<SurplusResource, Range>,
    wasted: Object.fromEntries(
      WASTE_RESOURCES.map((id) => [id, range((summary) => summary.wasted[id])]),
    ) as Record<WasteResource, Range>,
    wasteHours: range((summary) => summary.wasteHours),
  };
}

/**
 * Os problemas de uma célula, um por frase: o mesmo problema em várias sementes sai uma vez só,
 * com a contagem e a primeira semente em que apareceu.
 */
export function violationsOf(
  key: CellKey,
  band: Band,
  summaries: Summary[],
  seeds: readonly string[],
): string[] {
  const seedsByProblem = new Map<string, string[]>();
  summaries.forEach((summary, index) => {
    for (const problem of checkBand(band, summary)) {
      seedsByProblem.set(problem, [...(seedsByProblem.get(problem) ?? []), seeds[index] ?? '?']);
    }
  });
  return [...seedsByProblem].map(
    ([problem, found]) =>
      `${key}: ${problem} (${found.length} de ${seeds.length} sementes, a primeira ${found[0]})`,
  );
}

function paceLabelOf(timeScale: number): string {
  const pace = balance.paces.find((entry) => entry.timeScale === timeScale);
  return `${pace?.label ?? 'Ritmo'} ${formatDecimal(timeScale)}×`;
}

/**
 * Joga a matriz de balanceamento (roadmap da v0.2, §7.3): cada janela × cada ritmo × cada
 * perfil × cada semente, na dificuldade pedida, e confere cada partida contra a faixa da sua
 * célula. Uma partida que serve a duas janelas (no ritmo 1, 7 dias reais são um ano de jogo) é
 * jogada uma vez só.
 */
export async function runMatrix(options: MatrixOptions = {}): Promise<MatrixResult> {
  const seeds = options.seeds ?? MATRIX_SEEDS;
  const difficulty = options.difficulty ?? 'lord';
  const timeScales = options.timeScales ?? balance.paces.map((pace) => pace.timeScale);
  const played = new Map<string, Summary>();
  const runs: MatrixRun[] = [];
  const cells: MatrixCell[] = [];

  for (const window of WINDOWS) {
    for (const timeScale of timeScales) {
      const realHours = windowRealHours(window.id, timeScale);
      for (const profile of PROFILES) {
        const summaries: Summary[] = [];
        for (const seed of seeds) {
          const id = `${timeScale}/${profile.id}/${realHours}/${seed}`;
          let summary = played.get(id);
          if (summary === undefined) {
            summary = summarize(
              await simulate({
                seed,
                days: Math.ceil(realHours / 24),
                hours: realHours,
                strategy: profile.strategy,
                sessionsPerDay: profile.sessionsPerDay,
                timeScale,
                difficulty,
              }),
            );
            played.set(id, summary);
          }
          summaries.push(summary);
          runs.push({ window: window.id, timeScale, profile, seed, realHours, summary });
        }
        const key = cellKey(window.id, timeScale, profile.id);
        const band = bandFor(key, difficulty);
        cells.push({
          key,
          window: window.id,
          timeScale,
          paceLabel: paceLabelOf(timeScale),
          profile,
          realHours,
          gameYears: gameYearsIn(realHours, timeScale),
          seeds: seeds.length,
          measure: measureOf(summaries),
          band,
          violations: band === null ? [] : violationsOf(key, band, summaries, seeds),
        });
      }
    }
  }

  return {
    identity: IDENTITY,
    difficulty,
    difficultyLabel: balance.difficulties[difficulty].label,
    seeds,
    runs,
    cells,
  };
}

/** Milhar com ponto, como no resto dos documentos: `40.872`. */
function formatInt(value: number): string {
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function formatRange({ min, max }: Range): string {
  return min === max ? formatInt(min) : `${formatInt(min)} a ${formatInt(max)}`;
}

function table(header: string[], rows: string[][]): string {
  const line = (cells: string[]) => `| ${cells.join(' | ')} |`;
  return [line(header), line(header.map(() => '---')), ...rows.map(line)].join('\n');
}

/** Título da coluna de excedente parado de um material: "Excedente de madeira". */
function surplusTitle(id: SurplusResource): string {
  return `Excedente de ${balance.resources[id].label.toLowerCase()}`;
}

/** Título da coluna de desperdício de um recurso: "Desperdício de comida". */
function wasteTitle(id: WasteResource): string {
  return `Desperdício de ${balance.resources[id].label.toLowerCase()}`;
}

/**
 * As linhas da tabela `MEASURED` de `src/bands.ts` com o que esta rodada mediu. Servem para
 * atualizar a linha de base de propósito, depois de conferir o que mudou; nada as grava sozinho.
 */
function baselineLines(cells: MatrixCell[]): string {
  return cells
    .map(({ key, measure }) => {
      const { villagers, townHall, famineHours, coldHours, surplus } = measure;
      const values = [
        `[${villagers.min}, ${villagers.max}]`,
        townHall.min,
        famineHours.max,
        coldHours.max,
        ...SURPLUS_RESOURCES.map((id) => surplus[id].max),
      ];
      return `  '${key}': measured(${values.join(', ')}),`;
    })
    .join('\n');
}

function seedsLine(seeds: readonly string[]): string {
  const [first] = seeds;
  const last = seeds[seeds.length - 1];
  return seeds.length === 1
    ? `1 semente (${first})`
    : `${seeds.length} sementes (${first} a ${last})`;
}

/**
 * O relatório da matriz, em Markdown, pronto para colar em `docs/balance-v0.2.md`: a
 * identificação da rodada, uma tabela de medidas e uma de faixas por janela, e o veredito.
 */
export function formatMatrix(result: MatrixResult): string {
  const violations = result.cells.flatMap((cell) => cell.violations);
  const unbanded = result.cells.filter((cell) => cell.band === null).length;
  const sections = WINDOWS.map((window) => {
    const cells = result.cells.filter((cell) => cell.window === window.id);
    // O que varia com o ritmo em cada janela: os anos atravessados, ou as horas que o ano dura.
    const span =
      window.id === 'week'
        ? { title: 'Anos de jogo', of: (cell: MatrixCell) => formatDecimal(cell.gameYears) }
        : { title: 'Horas reais', of: (cell: MatrixCell) => formatInt(cell.realHours) };
    const measures = table(
      [
        'Ritmo',
        'Perfil',
        span.title,
        'População',
        'Salão',
        'Fome (h)',
        'Frio (h)',
        'Moral mínima',
        'Moral baixa (h)',
        'Foram embora',
        'Fila ociosa (h)',
        'Sem ofício (aldeão-h)',
        ...SURPLUS_RESOURCES.map(surplusTitle),
        ...WASTE_RESOURCES.map(wasteTitle),
        'Desperdiçando (h)',
        'Recusas',
        'Faixa',
      ],
      cells.map((cell) => [
        cell.paceLabel,
        `${cell.profile.label} (${cell.profile.sessionsPerDay}/dia, ${cell.profile.strategy})`,
        span.of(cell),
        formatRange(cell.measure.villagers),
        formatRange(cell.measure.townHall),
        formatRange(cell.measure.famineHours),
        formatRange(cell.measure.coldHours),
        formatRange(cell.measure.moraleMin),
        formatRange(cell.measure.lowMoraleHours),
        formatRange(cell.measure.villagersLost),
        formatRange(cell.measure.queueIdleHours),
        formatRange(cell.measure.freeVillagerHours),
        ...SURPLUS_RESOURCES.map((id) => formatRange(cell.measure.surplus[id])),
        ...WASTE_RESOURCES.map((id) => formatRange(cell.measure.wasted[id])),
        formatRange(cell.measure.wasteHours),
        formatRange(cell.measure.commandsRefused),
        cell.band === null ? 'sem faixa' : cell.violations.length === 0 ? 'dentro' : '**fora**',
      ]),
    );
    const banded = cells.filter((cell) => cell.band !== null);
    const bands =
      banded.length === 0
        ? ''
        : `\n\nFaixas cobradas:\n\n${table(
            [
              'Ritmo',
              'Perfil',
              'População',
              'Salão',
              'Fome (h)',
              'Frio (h)',
              ...SURPLUS_RESOURCES.map(surplusTitle),
              'Recusas',
            ],
            banded.flatMap(({ band, paceLabel, profile }) =>
              band === null
                ? []
                : [
                    [
                      paceLabel,
                      profile.label,
                      `${band.villagers.min} a ${band.villagers.max}`,
                      `≥ ${band.townHallMin}`,
                      `≤ ${formatInt(band.famineHoursMax)}`,
                      `≤ ${formatInt(band.coldHoursMax)}`,
                      ...SURPLUS_RESOURCES.map((id) => `≤ ${formatInt(band.surplusMax[id])}`),
                      '0',
                    ],
                  ],
            ),
          )}`;
    return `## ${window.label}\n\n${measures}${bands}`;
  });

  const verdict =
    violations.length === 0
      ? unbanded === result.cells.length
        ? 'Nenhuma faixa definida para esta rodada.'
        : 'Todas as partidas dentro das faixas.'
      : [
          '**Fora da faixa:**',
          '',
          ...violations.map((text) => `- ${text}`),
          '',
          'Se a mudança não era para mexer na economia, é uma regressão: o ajuste é nos números de `@lotg/content`, nunca no bot. Se era, confira o que mudou, copie a linha de base abaixo para `MEASURED` e registre a rodada em `docs/balance-v0.2.md`.',
        ].join('\n');

  return [
    '# Matriz de balanceamento',
    '',
    `${identityLine()} · dificuldade ${result.difficultyLabel} (${result.difficulty}) · ${seedsLine(result.seeds)}`,
    '',
    'Cada célula traz o menor e o maior valor entre as sementes (um número só quando são iguais). Horas são reais, amostradas ao fim de cada hora; estoques e desperdício em unidades, cada recurso por si. O desperdício é o que não coube no depósito na partida inteira; "Desperdiçando" são as horas com ao menos um depósito cheio e perdendo produção. "Moral mínima" é a menor moral de cada partida; "Moral baixa", as horas com o povo inquieto ou desesperado; "Foram embora", os aldeões que partiram ou desertaram.',
    '',
    sections.join('\n\n'),
    '',
    verdict,
    '',
    '## Linha de base medida nesta rodada',
    '',
    'No formato da tabela `MEASURED` de `packages/sim-cli/src/bands.ts`:',
    '',
    '```ts',
    baselineLines(result.cells),
    '```',
    '',
  ].join('\n');
}

const runColumns: Array<[string, (run: MatrixRun, difficulty: DifficultyId) => string | number]> = [
  ['window', (run) => run.window],
  ['time_scale', (run) => run.timeScale],
  ['profile', (run) => run.profile.id],
  ['strategy', (run) => run.profile.strategy],
  ['sessions_per_day', (run) => run.profile.sessionsPerDay],
  ['difficulty', (_, difficulty) => difficulty],
  ['seed', (run) => run.seed],
  ['real_hours', (run) => run.realHours],
  ['game_years', (run) => gameYearsIn(run.realHours, run.timeScale)],
  ['villagers', (run) => run.summary.villagers],
  ['capacity', (run) => run.summary.capacity],
  ['town_hall', (run) => run.summary.townHall],
  ['famine_hours', (run) => run.summary.famineHours],
  ['queue_idle_hours', (run) => run.summary.queueIdleHours],
  ['planned_idle_hours', (run) => run.summary.plannedIdleHours],
  ['free_villager_hours', (run) => run.summary.freeVillagerHours],
  ...RESOURCE_IDS.map((id): [string, (run: MatrixRun) => number] => [
    id,
    (run) => run.summary.stock[id],
  ]),
  ['commands_accepted', (run) => run.summary.commandsAccepted],
  ['commands_refused', (run) => run.summary.commandsRefused],
  ['refused_by_code', (run) => refusedByCode(run.summary.refusedByCode)],
  ...runMechanicColumns.map(([name, pick]): [string, (run: MatrixRun) => string | number] => [
    name,
    (run) => pick(run.summary),
  ]),
];

/** CSV da matriz: uma linha por partida (janela, ritmo, perfil, semente), com os valores finais. */
export function matrixCsv(result: MatrixResult): string {
  const header = runColumns.map(([name]) => name).join(',');
  const lines = result.runs.map((run) =>
    runColumns.map(([, pick]) => pick(run, result.difficulty)).join(','),
  );
  return `${[header, ...lines].join('\n')}\n`;
}
