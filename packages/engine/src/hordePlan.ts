import {
  balance,
  hordeTiles,
  hordeUnits,
  hordeWaves,
  HORDE_UNIT_IDS,
  LINE_IDS,
  omenTexts,
  UNIT_IDS,
  WING_IDS,
  warRaids,
  type HordeUnitId,
  type HordeWaveDef,
} from '@lotg/content';

import { emit } from './chronicle';
import { dayIndex, seasonAt, yearOf } from './clock';
import {
  compositionWeights,
  omenChancePercent,
  omenClarity,
  omenText,
  summarizeFormation,
  type SeenPost,
} from './hordeMind';
import { chance, nextInt } from './random';
import { watchtowerLevel } from './threat';
import type { GameEvent, GameState, ScheduledRaid } from './types';

type Post = NonNullable<ScheduledRaid['composition']>[number];
type Wave = NonNullable<GameState['horde']['wavePlan']>['waves'][number];

/** Um sorteio por posto, em ordem fixa; a contagem exata é repartida sem perder resto. */
function generateWave(draft: GameState, def: HordeWaveDef): Wave {
  const weights = compositionWeights(
    'autumn',
    draft.settings.difficulty,
    draft.horde.lastFormationSeen,
    def.mix,
  ).weights;
  const { num, den } = balance.difficulties[draft.settings.difficulty].siegeFactor;
  const count = Math.floor((def.baseCount * num) / den);
  const remaining = count - def.fixed.filter((p) => !p.extra).reduce((sum, p) => sum + p.count, 0);
  const hasBack = HORDE_UNIT_IDS.some(
    (unit) => hordeUnits[unit].line === 'back' && (weights[unit] ?? 0) > 0,
  );
  const slots = WING_IDS.flatMap((wing) =>
    LINE_IDS.flatMap((line) => {
      const fixed = def.fixed.some((p) => p.wing === wing && p.line === line);
      const share =
        line === 'back' && !hasBack
          ? 0
          : warRaids.postShares[wing][line] +
            (line === 'front' && !hasBack ? warRaids.postShares[wing].back : 0);
      return !fixed && share > 0 ? [{ wing, line, share }] : [];
    }),
  );
  const totalShare = slots.reduce((sum, p) => sum + p.share, 0);
  const amounts = slots.map((slot) => Math.floor((remaining * slot.share) / totalShare));
  let rest = remaining - amounts.reduce((sum, amount) => sum + amount, 0);
  const remainderOrder = slots
    .map((slot, index) => ({ index, remainder: (remaining * slot.share) % totalShare }))
    .sort((a, b) => b.remainder - a.remainder || a.index - b.index);
  for (const { index } of remainderOrder) {
    if (rest-- <= 0) break;
    amounts[index] = (amounts[index] ?? 0) + 1;
  }
  const posts: Post[] = def.fixed.map(({ wing, line, unit, count: fixedCount }) => ({
    wing,
    line,
    unit,
    count: fixedCount,
  }));
  for (const [index, slot] of slots.entries()) {
    const amount = amounts[index] ?? 0;
    if (amount <= 0) continue;
    const candidates = HORDE_UNIT_IDS.filter(
      (unit) => hordeUnits[unit].line === slot.line && (weights[unit] ?? 0) > 0,
    );
    const sum = candidates.reduce((total, unit) => total + (weights[unit] ?? 0), 0);
    let roll = nextInt(draft, 'horde', sum);
    let unit = candidates[candidates.length - 1]!;
    for (const candidate of candidates) {
      if (roll < (weights[candidate] ?? 0)) {
        unit = candidate;
        break;
      }
      roll -= weights[candidate] ?? 0;
    }
    posts.push({ wing: slot.wing, line: slot.line, unit, count: amount });
  }
  posts.sort(
    (a, b) =>
      WING_IDS.indexOf(a.wing) - WING_IDS.indexOf(b.wing) ||
      LINE_IDS.indexOf(a.line) - LINE_IDS.indexOf(b.line),
  );
  return { number: def.number, composition: posts };
}

/** Só é chamada na linha do tempo: as ondas reais, ainda sem agendar o Cerco. */
function prepareWaves(draft: GameState, atMs: number): void {
  const previousWaves = draft.horde.wavePlan?.waves;
  const revision = (draft.horde.wavePlan?.revision ?? 0) + 1;
  const waves = hordeWaves.map((def) => generateWave(draft, def));

  // Preserva reduções de sabotagens anteriores ao regerar as ondas
  if (previousWaves !== undefined) {
    for (const wave of waves) {
      const prev = previousWaves.find((w) => w.number === wave.number);
      if (prev?.reductionPercent !== undefined && prev.reductionPercent > 0) {
        wave.reductionPercent = prev.reductionPercent;
        for (const post of wave.composition) {
          post.count = Math.max(1, Math.floor((post.count * (100 - prev.reductionPercent)) / 100));
        }
      }
    }
  }

  // Aplica alerta se a Horda já foi alertada por sabotagem desastrada
  if (draft.horde.sabotages?.alerted) {
    const wave1 = waves.find((w) => w.number === 1);
    if (wave1 !== undefined) {
      const { num, den } = balance.horde.sabotage.alertIncrease;
      for (const post of wave1.composition) {
        post.count = Math.floor((post.count * (den + num)) / den);
      }
    }
  }

  draft.horde.wavePlan = {
    year: yearOf(atMs),
    revision,
    generatedAtMs: atMs,
    waves,
  };
  // Um presságio antigo é um fato da Crônica. No painel só fica a informação da versão atual.
  draft.horde.omens = [];
}

/** Observa os efetivos que entraram na batalha, antes de baixas, sem nomes ou comandantes. */
export function observeFormation(draft: GameState, posts: readonly SeenPost[], atMs: number): void {
  const seen = summarizeFormation(posts);
  // Nada visto (sem Defesa ativa, só a milícia sem posto): a Horda não aprende nem esquece, e as
  // ondas ficam como estavam (revisão da V4E-T3, pendência D-45c).
  if (seen === null) return;
  const before = draft.horde.lastFormationSeen;
  const changed = UNIT_IDS.some((unit) => (seen.byUnit[unit] ?? 0) !== (before?.byUnit[unit] ?? 0));
  draft.horde.lastFormationSeen = seen;
  if (changed && draft.horde.wavePlan !== null && seasonAt(atMs).id === hordeTiles.fortressSeason)
    prepareWaves(draft, atMs);
}

/** Reinício anual da memória, antes de observar qualquer batalha do ano que começa. */
export function resetHordeYear(draft: GameState): void {
  draft.horde.lastFormationSeen = null;
  draft.horde.wavePlan = null;
  draft.horde.omens = [];
  draft.horde.sabotages = { attempts: 0, successes: 0, alerted: false };
}

/** Alerta a Fortaleza da Horda após um Desastre com alarme: +10% na primeira onda. */
export function alertHordeFortress(
  draft: GameState,
  atMs: number,
  events: GameEvent[],
  expeditionId: string,
): void {
  if (draft.horde.sabotages.alerted) return;
  draft.horde.sabotages.alerted = true;
  if (draft.horde.wavePlan !== null) {
    const wave1 = draft.horde.wavePlan.waves.find((w) => w.number === 1);
    if (wave1 !== undefined) {
      const { num, den } = balance.horde.sabotage.alertIncrease;
      for (const post of wave1.composition) {
        post.count = Math.floor((post.count * (den + num)) / den);
      }
    }
  }
  emit(events, draft, atMs, 'hordeAlerted', { expeditionId, modelId: 'sabotage' });
}

const WAVE_CHRONICLE_LABELS: Record<number, string> = {
  1: 'a primeira onda',
  2: 'a segunda onda',
  3: 'a terceira onda',
};

/** Aplica a redução da sabotagem à onda correspondente (-15%). */
export function applyWaveSabotage(
  draft: GameState,
  waveNumber: 1 | 2 | 3,
  atMs: number,
  events: GameEvent[],
  expeditionId: string,
): void {
  draft.horde.sabotages.successes += 1;
  if (draft.horde.wavePlan !== null) {
    const wave = draft.horde.wavePlan.waves.find((w) => w.number === waveNumber);
    if (wave !== undefined) {
      const { num, den } = balance.horde.sabotage.waveReduction;
      const percent = Math.round((num * 100) / den);
      wave.reductionPercent = (wave.reductionPercent ?? 0) + percent;
      for (const post of wave.composition) {
        post.count = Math.max(1, Math.floor((post.count * (den - num)) / den));
      }
    }
  }
  emit(
    events,
    draft,
    atMs,
    'hordeSabotaged',
    { expeditionId, wave: waveNumber },
    { onda: WAVE_CHRONICLE_LABELS[waveNumber] ?? `${waveNumber}ª onda` },
  );
}

/** Revela a composição exata da terceira onda após derrotar o Xamã. */
export function revealWaveThree(draft: GameState, atMs: number, events: GameEvent[]): void {
  if (draft.horde.wavePlan === null) return;
  const wave3 = draft.horde.wavePlan.waves.find((w) => w.number === 3);
  if (wave3 === undefined) return;
  const parts = wave3.composition.map((post) =>
    omenTexts.post
      .replace('{contagem}', String(post.count))
      .replace(
        '{inimigo}',
        post.count === 1
          ? hordeUnits[post.unit].label.toLowerCase()
          : hordeUnits[post.unit].pluralLabel,
      )
      .replace('{linha}', omenTexts.lines[post.line])
      .replace('{ala}', omenTexts.wings[post.wing]),
  );
  const text = omenTexts.exact
    .replace('{onda}', omenTexts.waves[3])
    .replace('{composicao}', parts.join('; '));

  draft.horde.omens.push({
    atMs,
    revision: draft.horde.wavePlan.revision,
    clarity: 'exact',
    wave: 3,
    text,
    reveals: wave3.composition.map((post) => ({ ...post })),
  });
  draft.horde.omens = draft.horde.omens.slice(-balance.omens.kept);
  draft.stats.omens = (draft.stats.omens ?? 0) + 1;
  emit(events, draft, atMs, 'omenSeen', { wave: 3, clarity: 'exact' }, { pressagio: text });
}

/** Datas conferidas só nas viradas, também para quem acabou de migrar depois delas. */
export function settleHordeTiles(draft: GameState, atMs: number, events: GameEvent[]): void {
  if (dayIndex(atMs) + 1 >= hordeTiles.campAtGameDay && draft.map.tiles.raiderCamp === undefined) {
    draft.map.tiles.raiderCamp = { type: 'raiderCamp', threatActive: true };
    if (watchtowerLevel(draft) > 0) emit(events, draft, atMs, 'campAppeared');
    draft.stats.campAppearedAtDay = dayIndex(atMs) + 1;
  }
  const season = seasonAt(atMs).id;
  if ((season === 'autumn' || season === 'winter') && draft.horde.wavePlan === null) {
    draft.map.tiles.hordeFortress = { type: 'hordeFortress', threatActive: true };
    prepareWaves(draft, atMs);
    if (watchtowerLevel(draft) > 0) emit(events, draft, atMs, 'fortressAppeared');
    draft.stats.fortressAppearedAtDay = dayIndex(atMs) + 1;
  }
}

/** Um presságio lê a preparação atual. Sem Torre ou fora da preparação, não sorteia. */
export function turnOmens(draft: GameState, atMs: number, events: GameEvent[]): void {
  const plan = draft.horde.wavePlan;
  const tower = watchtowerLevel(draft);
  const season = seasonAt(atMs).id;
  if (tower === 0 || plan === null || (season !== 'autumn' && season !== 'winter')) return;
  if (!chance(draft, 'horde', { num: omenChancePercent(tower), den: 100 })) return;
  const wave = plan.waves[nextInt(draft, 'horde', plan.waves.length)]!;
  const clarity = omenClarity(tower);
  const composition: Partial<Record<HordeUnitId, number>> = {};
  for (const post of wave.composition)
    composition[post.unit] = (composition[post.unit] ?? 0) + post.count;
  const main = wave.composition.reduce((best, post) => (post.count > best.count ? post : best));
  // O parcial conta o posto que identifica, e não a soma da unidade espalhada por outras alas.
  const described = clarity === 'partial' ? { [main.unit]: main.count } : composition;
  let text = omenText(
    { number: wave.number, mainWing: main.wing, composition: described },
    clarity,
  )!;
  if (clarity === 'exact') {
    const parts = wave.composition.map((post) =>
      omenTexts.post
        .replace('{contagem}', String(post.count))
        .replace(
          '{inimigo}',
          post.count === 1
            ? hordeUnits[post.unit].label.toLowerCase()
            : hordeUnits[post.unit].pluralLabel,
        )
        .replace('{linha}', omenTexts.lines[post.line])
        .replace('{ala}', omenTexts.wings[post.wing]),
    );
    text = omenTexts.exact
      .replace('{onda}', omenTexts.waves[wave.number])
      .replace('{composicao}', parts.join('; '));
  }
  draft.horde.omens.push({
    atMs,
    revision: plan.revision,
    clarity,
    wave: wave.number,
    text,
    reveals:
      clarity === 'exact'
        ? wave.composition.map((post) => ({ ...post }))
        : clarity === 'partial'
          ? [
              {
                ...main,
                count: Math.max(
                  balance.omens.roundTo,
                  Math.round(main.count / balance.omens.roundTo) * balance.omens.roundTo,
                ),
              },
            ]
          : [],
  });
  draft.horde.omens = draft.horde.omens.slice(-balance.omens.kept);
  draft.stats.omens = (draft.stats.omens ?? 0) + 1;
  // O evento sai em `GET /events`: o vago não diz a onda, como na visão (os dados de evento não
  // levam `null`; a chave fica de fora).
  emit(
    events,
    draft,
    atMs,
    'omenSeen',
    clarity === 'vague' ? { clarity } : { wave: wave.number, clarity },
    { pressagio: text },
  );
}
