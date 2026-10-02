import { balance, type DifficultyId, RESOURCE_IDS } from '@lotg/content';

import type { StrategyName } from './bots';
import { type Band, bandFor, type CellKey, cellKey, checkBand } from './bands';
import { IDENTITY, identityLine } from './identity';
import {
  formatDecimal,
  MILESTONES,
  refusedByCode,
  runMechanicColumns,
  summarize,
  type Summary,
  SURPLUS_RESOURCES,
  type SurplusResource,
  WASTE_RESOURCES,
  WASTE_STREAK_GOAL,
  type WasteResource,
  worstWasteStreak,
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

/**
 * O menor e o maior valor de uma medida que pode não existir (a hora de um marco a que nem toda
 * partida chega, um percentual sem produção). `null` no `max` diz que ao menos uma semente ficou
 * sem a medida; no `min`, que nenhuma a teve.
 */
export type OptionalRange = { min: number | null; max: number | null };

/** O que as sementes de uma célula (janela, ritmo, perfil) mediram: o menor e o maior valor. */
export type CellMeasure = {
  villagers: Range;
  /** A menor população de cada partida: cai quando alguém parte ou deserta. */
  villagersMin: Range;
  townHall: Range;
  /** A hora real de cada marco de `MILESTONES`, pelo `id`. */
  milestones: Record<string, OptionalRange>;
  /** A hora real em que as obras acabaram de vez; sem valor quando ainda havia o que construir. */
  exhaustedAtHour: OptionalRange;
  /** Obras que começaram sozinhas, entre as visitas. */
  autoStarted: Range;
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
  /** Quanto da produção bruta de cada recurso foi ao chão, em por cento. */
  wastedPercent: Record<WasteResource, OptionalRange>;
  /** A maior sequência desperdiçando cada recurso, em horas de jogo. */
  wasteStreak: Record<WasteResource, Range>;
  /** A do pior recurso de cada partida: é a que a faixa e a meta do GDD §15.2 olham. */
  wasteStreakWorst: Range;
  /**
   * As incursões de cada partida (GDD §8.2): as sofridas, as repelidas, as que a Torre anunciou,
   * os feridos, a comida e a madeira que os lobos levaram, e a Ameaça no fim.
   */
  raids: {
    suffered: Range;
    repelled: Range;
    announced: Range;
    injured: Range;
    lostFood: Range;
    lostWood: Range;
    threatFinal: Range;
  };
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

/** O menor e o maior valor entre as sementes que têm a medida; `null` no `max` se alguma não tem. */
function optionalRangeOf(values: Array<number | null>): OptionalRange {
  const present = values.filter((value): value is number => value !== null);
  return {
    min: present.length === 0 ? null : Math.min(...present),
    max: present.length < values.length ? null : Math.max(...present),
  };
}

function measureOf(summaries: Summary[]): CellMeasure {
  const range = (pick: (summary: Summary) => number) => rangeOf(summaries.map(pick));
  const optional = (pick: (summary: Summary) => number | null) =>
    optionalRangeOf(summaries.map(pick));
  return {
    villagers: range((summary) => summary.villagers),
    villagersMin: range((summary) => summary.villagersMin),
    townHall: range((summary) => summary.townHall),
    milestones: Object.fromEntries(
      MILESTONES.map(({ id }) => [id, optional((summary) => summary.milestones[id] ?? null)]),
    ),
    exhaustedAtHour: optional((summary) => summary.exhaustedAtHour),
    autoStarted: range((summary) => summary.autoStarted),
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
    wastedPercent: Object.fromEntries(
      WASTE_RESOURCES.map((id) => [id, optional((summary) => summary.wastedPercent[id])]),
    ) as Record<WasteResource, OptionalRange>,
    wasteStreak: Object.fromEntries(
      WASTE_RESOURCES.map((id) => [id, range((summary) => summary.wasteStreakGameHours[id])]),
    ) as Record<WasteResource, Range>,
    wasteStreakWorst: range((summary) => worstWasteStreak(summary).gameHours),
    raids: {
      suffered: range((summary) => summary.raids.suffered),
      repelled: range((summary) => summary.raids.repelled),
      announced: range((summary) => summary.raids.announced),
      injured: range((summary) => summary.raids.injured),
      lostFood: range((summary) => summary.raids.lost.food),
      lostWood: range((summary) => summary.raids.lost.wood),
      threatFinal: range((summary) => summary.threat.final),
    },
  };
}

/**
 * As células que a meta de desperdício cobra (`WASTE_STREAK_GOAL`: o perfil de 2 sessões por
 * dia) e o que cada uma mediu: a maior sequência desperdiçando um recurso, em horas de jogo, e
 * se ela cabe na meta.
 */
export function wasteGoalCells(
  cells: readonly MatrixCell[],
): Array<{ cell: MatrixCell; gameHours: number; met: boolean }> {
  return cells
    .filter((cell) => cell.profile.sessionsPerDay === WASTE_STREAK_GOAL.sessionsPerDay)
    .map((cell) => {
      const gameHours = cell.measure.wasteStreakWorst.max;
      return { cell, gameHours, met: gameHours <= WASTE_STREAK_GOAL.gameHours };
    });
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

/** Horas de jogo, que no ritmo 0,5 saem com meia hora: `165`, `1,5`, `0 a 1,5`. */
function formatHoursRange({ min, max }: Range): string {
  return min === max ? formatDecimal(min) : `${formatDecimal(min)} a ${formatDecimal(max)}`;
}

/**
 * Uma medida que pode faltar: `—` quando nenhuma semente a tem, e "12 a —" quando só algumas
 * (um marco a que nem toda partida chegou).
 */
function formatOptional({ min, max }: OptionalRange, suffix = ''): string {
  if (min === null) {
    return '—';
  }
  if (max === null) {
    return `${formatInt(min)}${suffix} a —`;
  }
  return min === max
    ? `${formatInt(min)}${suffix}`
    : `${formatInt(min)}${suffix} a ${formatInt(max)}${suffix}`;
}

const STREAK_TITLE = 'Maior sequência desperdiçando (h de jogo)';

function table(header: string[], rows: string[][]): string {
  const line = (cells: string[]) => `| ${cells.join(' | ')} |`;
  return [line(header), line(header.map(() => '---')), ...rows.map(line)].join('\n');
}

/** Título da coluna de excedente parado de um material: "Excedente de madeira". */
function surplusTitle(id: SurplusResource): string {
  return `Excedente de ${balance.resources[id].label.toLowerCase()}`;
}

/** Título da coluna da sequência desperdiçando um recurso: "Comida (h de jogo)". */
function streakTitle(id: WasteResource): string {
  return `${balance.resources[id].label} (h de jogo)`;
}

/** Título da coluna da parte da produção perdida: "Comida perdida (% da produção)". */
function wasteShareTitle(id: WasteResource): string {
  return `${balance.resources[id].label} perdida (% da produção)`;
}

/** Um marco a que nenhuma semente chegou. */
const NEVER: OptionalRange = { min: null, max: null };

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
      const { villagers, townHall, famineHours, coldHours, surplus, wasteStreakWorst } = measure;
      const values = [
        `[${villagers.min}, ${villagers.max}]`,
        townHall.min,
        famineHours.max,
        coldHours.max,
        ...SURPLUS_RESOURCES.map((id) => surplus[id].max),
        wasteStreakWorst.max,
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
        STREAK_TITLE,
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
        formatHoursRange(cell.measure.wasteStreakWorst),
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
              STREAK_TITLE,
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
                      `≤ ${formatInt(band.wasteStreakMax)}`,
                      '0',
                    ],
                  ],
            ),
          )}`;
    const profileOf = (cell: MatrixCell) => cell.profile.label;
    const progress = table(
      [
        'Ritmo',
        'Perfil',
        ...MILESTONES.map(({ label }) => `${label} (h)`),
        'Fim das obras (h)',
        'Obras que começaram sozinhas',
        'População mínima',
      ],
      cells.map((cell) => [
        cell.paceLabel,
        profileOf(cell),
        ...MILESTONES.map(({ id }) => formatOptional(cell.measure.milestones[id] ?? NEVER)),
        formatOptional(cell.measure.exhaustedAtHour),
        formatRange(cell.measure.autoStarted),
        formatRange(cell.measure.villagersMin),
      ]),
    );
    const waste = table(
      [
        'Ritmo',
        'Perfil',
        ...WASTE_RESOURCES.map(wasteShareTitle),
        ...WASTE_RESOURCES.map(streakTitle),
      ],
      cells.map((cell) => [
        cell.paceLabel,
        profileOf(cell),
        ...WASTE_RESOURCES.map((id) => formatOptional(cell.measure.wastedPercent[id], '%')),
        ...WASTE_RESOURCES.map((id) => formatHoursRange(cell.measure.wasteStreak[id])),
      ]),
    );
    const raids = table(
      [
        'Ritmo',
        'Perfil',
        'Incursões sofridas',
        'Incursões repelidas',
        'Anunciadas pela Torre',
        'Feridos',
        'Comida levada',
        'Madeira levada',
        'Ameaça no fim',
      ],
      cells.map((cell) => [
        cell.paceLabel,
        profileOf(cell),
        formatRange(cell.measure.raids.suffered),
        formatRange(cell.measure.raids.repelled),
        formatRange(cell.measure.raids.announced),
        formatRange(cell.measure.raids.injured),
        formatRange(cell.measure.raids.lostFood),
        formatRange(cell.measure.raids.lostWood),
        formatRange(cell.measure.raids.threatFinal),
      ]),
    );
    return [
      `## ${window.label}\n\n${measures}${bands}`,
      `### Progresso: ${window.label.toLowerCase()}\n\n${progress}`,
      `### Desperdício por recurso: ${window.label.toLowerCase()}\n\n${waste}`,
      `### Lobos: ${window.label.toLowerCase()}\n\n${raids}`,
    ].join('\n\n');
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

  const goal = wasteGoalCells(result.cells);
  const windowLabel = (id: WindowId) => WINDOWS.find((window) => window.id === id)?.label ?? id;
  const goalSection = [
    '## Meta de desperdício',
    '',
    `GDD §15.2, na leitura do ADR 0013 (decisão 17): com ${WASTE_STREAK_GOAL.sessionsPerDay} sessões por dia, nenhum recurso passa de ${WASTE_STREAK_GOAL.gameHours} h de jogo seguidas indo ao chão. A medida é a maior sequência de horas reais em que o desperdício acumulado do recurso subiu, vezes o ritmo; cada hora conta inteira. É uma meta, não uma faixa: uma célula acima dela não reprova a rodada, e fica aqui à vista até o balanceamento a trazer para dentro.`,
    '',
    table(
      ['Janela', 'Ritmo', 'Perfil', ...WASTE_RESOURCES.map(streakTitle), 'Meta', 'Veredito'],
      goal.map(({ cell, met }) => [
        windowLabel(cell.window),
        cell.paceLabel,
        cell.profile.label,
        ...WASTE_RESOURCES.map((id) => formatHoursRange(cell.measure.wasteStreak[id])),
        `≤ ${WASTE_STREAK_GOAL.gameHours}`,
        met ? 'dentro' : '**acima**',
      ]),
    ),
  ].join('\n');

  return [
    '# Matriz de balanceamento',
    '',
    `${identityLine()} · dificuldade ${result.difficultyLabel} (${result.difficulty}) · ${seedsLine(result.seeds)}`,
    '',
    'Cada célula traz o menor e o maior valor entre as sementes (um número só quando são iguais). Horas são reais, amostradas ao fim de cada hora; estoques e desperdício em unidades, cada recurso por si. O desperdício é o que não coube no depósito na partida inteira; "Desperdiçando" são as horas com ao menos um depósito cheio e perdendo produção; "Maior sequência desperdiçando" é, do pior recurso de cada partida, a maior sequência de horas seguidas indo ao chão, em horas de jogo. "Moral mínima" é a menor moral de cada partida; "Moral baixa", as horas com o povo inquieto ou desesperado; "Foram embora", os aldeões que partiram ou desertaram.',
    '',
    'Nas tabelas de progresso, cada marco traz a hora real, desde a fundação, em que o edifício chegou ao nível (— é "não chegou na partida"); "Fim das obras" é a hora em que o feudo ficou sem nada em obras e sem nada que ainda possa construir, até o fim da partida (— é "ainda havia o que construir"). Nas de desperdício por recurso, a parte perdida é o desperdício sobre a produção bruta do mesmo recurso (— sem produção), e a sequência é a maior de cada recurso, em horas de jogo.',
    '',
    sections.join('\n\n'),
    '',
    verdict,
    '',
    goalSection,
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
  // A maior sequência desperdiçando um recurso (o pior deles), em horas de jogo.
  ['waste_streak_game_hours', (run) => worstWasteStreak(run.summary).gameHours],
  // A de cada recurso, e a parte da produção bruta dele que foi ao chão (vazio sem produção).
  ...WASTE_RESOURCES.map((id): [string, (run: MatrixRun) => string | number] => [
    `waste_streak_${id}`,
    (run) => run.summary.wasteStreakGameHours[id],
  ]),
  ...WASTE_RESOURCES.map((id): [string, (run: MatrixRun) => string | number] => [
    `wasted_${id}_percent`,
    (run) => run.summary.wastedPercent[id] ?? '',
  ]),
  // Progresso: a menor população, a hora real de cada marco e a do fim das obras (vazio é "não
  // chegou"), e as obras que começaram sozinhas.
  ['villagers_min', (run) => run.summary.villagersMin],
  ...MILESTONES.map(({ id, column }): [string, (run: MatrixRun) => string | number] => [
    column,
    (run) => run.summary.milestones[id] ?? '',
  ]),
  ['exhausted_hour', (run) => run.summary.exhaustedAtHour ?? ''],
  ['auto_started', (run) => run.summary.autoStarted],
  ['villagers_lost', (run) => run.summary.villagersLeft + run.summary.villagersDeserted],
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
