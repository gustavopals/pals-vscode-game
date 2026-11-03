import { balance, siegeTexts, vigilRules, type UnitId, WING_IDS } from '@lotg/content';

import { availableUnits } from './campaign';
import { applyBattleOutcome } from './battleOutcome';
import { buildBattleReport } from './battleReport';
import { fightBattle } from './battleTurn';
import { emit } from './chronicle';
import { seasonAt, yearOf, YEAR_MS } from './clock';
import { nominationReason } from './formations';
import { observeFormation } from './hordePlan';
import { releaseExcessWorkers } from './population';
import { buildDefender, toHordePosts } from './raidArmy';
import { finishSiege } from './siegeOutcome';
import { preparedSiegeWaves, winterStartsAt } from './siege';
import { watchtowerLevel, watchtowerPerks, watchtowerWarningMs } from './threat';
import { realToGameMs } from './units';
import { vigilAt } from './vigil';
import { applyWallDamage, wallForBattle } from './wallRepair';
import type { GameEvent, GameState, SiegeWaveNumber } from './types';
import { recordYearFeint } from './yearStats';

/** A primeira virada após a migração marca, sem cobrar uma Vigília já passada. */
export function scheduleSiege(draft: GameState, atMs: number, events: GameEvent[]): void {
  const year = yearOf(atMs);
  const season = seasonAt(atMs).id;
  if (
    (season !== 'autumn' && season !== 'winter') ||
    draft.horde.wavePlan?.year !== year ||
    draft.siege?.year === year
  )
    return;
  const intended = vigilAt(draft.settings, winterStartsAt(year));
  const perks = watchtowerPerks(watchtowerLevel(draft));
  const lead = perks === null ? vigilRules.minimumDelayMs : watchtowerWarningMs(draft, perks);
  const scheduled = intended > atMs ? intended : atMs + lead;
  if (scheduled >= year * YEAR_MS) return;
  draft.siege = {
    year,
    atMs: scheduled,
    waves: preparedSiegeWaves(draft),
    current: 0,
    nextWaveAtMs: scheduled,
    plan: { 1: null, 2: null, 3: null },
    result: null,
    breached: false,
    deaths: 0,
    endedAtMs: null,
    aftermathUntilMs: null,
  };
  emit(events, draft, atMs, 'siegeScheduled', { year, atMs: scheduled });
}

/** Uma onda por instante; o intervalo real nasce no fim da anterior. */
export function settleSiege(draft: GameState, atMs: number, events: GameEvent[]): void {
  const siege = draft.siege;
  if (
    siege === null ||
    siege.result !== null ||
    siege.nextWaveAtMs === null ||
    siege.nextWaveAtMs > atMs
  )
    return;
  const number = (siege.current + 1) as SiegeWaveNumber;
  const wave = siege.waves.find((w) => w.number === number)!;
  const formationId = siege.plan[number] ?? draft.army.activeFormationId;
  const formation = draft.army.formations.find((f) => f.id === formationId) ?? null;
  const defender = buildDefender(
    formation,
    availableUnits(draft),
    (heroId) => {
      const hero = draft.guild.heroes.find((h) => h.id === heroId);
      return hero === undefined || nominationReason(hero) !== null ? null : hero.classId;
    },
    draft.settlement.militia?.count ?? 0,
  );
  if (number === 1) recordYearFeint(draft, defender.posts);
  const { id, resolution } = fightBattle(draft, {
    mode: 'defense',
    player: defender,
    horde: { posts: toHordePosts(wave.composition) },
    wall: wallForBattle(draft),
    watchtowerLevel: watchtowerLevel(draft),
    heroCapture: balance.difficulties[draft.settings.difficulty].heroCapture,
  });
  const report = buildBattleReport(id, atMs, resolution, formation?.id ?? null);
  applyWallDamage(draft, report, atMs, events);
  for (const casualty of report.casualties) {
    if (casualty.owner !== 'player') continue;
    if (casualty.unit === 'militia') {
      const lost = Math.min(
        casualty.lost,
        Math.max(0, draft.settlement.population.villagers - balance.morale.populationFloor),
      );
      draft.settlement.population.villagers -= lost;
      releaseExcessWorkers(draft);
      siege.deaths += lost;
      continue;
    }
    const unit = casualty.unit as keyof typeof draft.army.units;
    draft.army.units[unit] = Math.max(0, draft.army.units[unit] - casualty.lost);
    siege.deaths += casualty.lost;
  }
  siege.deaths += report.commanders.filter((c) => c.fate === 'died').length;
  const wingFellInBattle = resolution.rounds.some((r) =>
    r.actions.some(
      (a) =>
        a.kind === 'attack' &&
        a.notes.some((n) => n.kind === 'wingFell' && n.side === resolution.playerSide),
    ),
  );
  const frontMissing = WING_IDS.some((wing) => defender.posts[wing].front === null);
  const frontBreached = report.casualties.some(
    (c) => c.owner === 'player' && c.line === 'front' && c.lost >= c.start,
  );
  siege.breached ||= frontMissing || frontBreached || wingFellInBattle;
  applyBattleOutcome(draft, report, atMs, events);
  draft.army.reports = [...draft.army.reports, report].slice(-balance.army.reportsKept);
  observeFormation(
    draft,
    Object.values(defender.posts).flatMap((lines) =>
      Object.values(lines).filter(
        (p): p is { unit: UnitId; count: number } => p !== null && p.unit !== 'militia',
      ),
    ),
    atMs,
  );
  if (draft.settlement.militia !== null) {
    draft.settlement.militia = null;
    releaseExcessWorkers(draft);
    emit(events, draft, atMs, 'militiaDisbanded');
  }
  if (number === 3 && report.ending === 'chiefFell') {
    draft.stats.warlordsSlain = (draft.stats.warlordsSlain ?? 0) + 1;
    emit(events, draft, atMs, 'warlordSlain', {
      year: siege.year,
      battleId: report.id,
      wave: number,
    });
  }
  siege.current = number;
  draft.stats.siegeWavesFought = (draft.stats.siegeWavesFought ?? 0) + 1;
  emit(
    events,
    draft,
    atMs,
    'siegeWaveFought',
    {
      year: siege.year,
      wave: number,
      battleId: id,
      outcome: report.outcome,
      formationId: formation?.id ?? '',
    },
    {
      onda: siegeTexts.waves[number],
      desfecho: report.outcome === 'defeat' ? siegeTexts.result.fall : siegeTexts.result.victory,
    },
  );
  if (report.outcome !== 'defeat') draft.stats.siegeWavesWon = (draft.stats.siegeWavesWon ?? 0) + 1;
  if (report.outcome === 'defeat' || number === 3) {
    siege.result = report.outcome === 'defeat' ? 'fall' : siege.breached ? 'victory' : 'glorious';
    siege.nextWaveAtMs = null;
    siege.endedAtMs = atMs;
    siege.aftermathUntilMs = siege.year * YEAR_MS;
    finishSiege(draft, atMs, events);
  } else
    siege.nextWaveAtMs =
      atMs + realToGameMs(balance.siege.waveIntervalRealMs, draft.settings.timeScale);
}
