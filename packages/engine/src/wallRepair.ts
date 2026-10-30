import { balance, WING_IDS, wingPhrases, type Ratio, type WingId } from '@lotg/content';

import type { BattleReport } from './battleReport';
import { emit } from './chronicle';
import { seasonAt } from './clock';
import { missingResources, payResources } from './construction';
import { joinList } from './format';
import { reject } from './rejections';
import type { GameEvent, GameState, Rejection } from './types';
import { wallFullHp, wallHpPerWing, wallRepairQuote, type WallRepairQuote } from './wall';

/**
 * A muralha no estado (GDD §6.1 a §6.3; V4E-T1.2 e T1.3): a vida de cada ala
 * (`settlement.wall.hp`), o dano de uma batalha, o reparo (`settlement.wallRepair`, a ordem
 * `repairWall`) e a vida que a obra da Paliçada acrescenta. Nada aqui sorteia nem cria
 * entidade. As contas puras (vida por nível, custo e prazo do reparo) estão em `wall.ts`.
 *
 * **O reparo entra na frente da fila de obras**: no instante da ordem, toda obra em curso
 * espera o prazo do reparo (o fim dela anda o mesmo tanto), e a obra que começa durante o
 * reparo só corre depois dele (`repairDelayMs`). Termina **junto das obras**, logo antes
 * delas, na ordem do instante (`finishWallRepair`, em `processEventsAt`).
 */

/** O que falta à muralha, somadas as alas, no nível de hoje da Paliçada. */
export function wallMissingHp(state: GameState): number {
  const full = wallHpPerWing(state.settlement.buildings.palisade);
  return WING_IDS.reduce(
    (sum, wing) => sum + Math.max(0, full - state.settlement.wall.hp[wing]),
    0,
  );
}

/** O reparo de tudo o que falta hoje: o custo e o prazo (`wallRepairQuote`). */
export function currentRepairQuote(state: GameState): WallRepairQuote {
  const quote = wallRepairQuote(state.settlement.buildings.palisade, wallMissingHp(state));
  if (
    state.siege !== null &&
    state.siege.endedAtMs !== null &&
    state.siege.aftermathUntilMs !== null &&
    state.lastProcessedAt < state.siege.aftermathUntilMs &&
    seasonAt(state.lastProcessedAt).id === 'winter'
  ) {
    const base = balance.siege.aftermathRepairFactor;
    const bonus = state.council.bonuses.repairDiscount;
    const points = bonus !== null && bonus.untilMs > state.lastProcessedAt ? bonus.points : 0;
    const den = base.den * 100;
    const num = Math.max(0, base.num * 100 - points * base.den);
    return {
      stone: Math.floor((quote.stone * num) / den),
      gold: Math.floor((quote.gold * num) / den),
      durationMs: quote.durationMs,
    };
  }
  return quote;
}

/** Por que a ordem `repairWall` seria recusada agora (sem contar o recurso), ou `null`. */
export function wallRepairBlocked(state: GameState): Rejection | null {
  if (state.settlement.buildings.palisade <= 0) {
    return reject('WALL_REQUIRED');
  }
  if (state.settlement.wallRepair !== null) {
    return reject('WALL_REPAIRING');
  }
  if (wallMissingHp(state) === 0) {
    return reject('WALL_INTACT');
  }
  return null;
}

/** "a ala esquerda (40 de 200) e o centro (120 de 200)": as alas pedidas, com a vida de cada. */
export function wingsText(
  hp: Record<WingId, number>,
  full: number,
  wings: readonly WingId[],
): string {
  return joinList(
    wings.map((wing) => `${wingPhrases[wing]} (${String(hp[wing])} de ${String(full)})`),
  );
}

/** As alas com vida abaixo da cheia, na ordem das alas. */
function damagedWings(state: GameState): WingId[] {
  const full = wallHpPerWing(state.settlement.buildings.palisade);
  return WING_IDS.filter((wing) => state.settlement.wall.hp[wing] < full);
}

/**
 * A ordem `repairWall`: custa a pedra e o ouro de `wallRepairQuote` para tudo o que falta,
 * cobrados na hora; leva cada ala à vida cheia do nível ao fim do prazo. As recusas, nesta
 * ordem: sem Paliçada (`WALL_REQUIRED`), com reparo em curso (`WALL_REPAIRING`), sem nada a
 * reparar (`WALL_INTACT`) e o recurso que falta (`INSUFFICIENT_RESOURCES`). Não há cancelamento.
 */
export function repairWall(
  draft: GameState,
  nowMs: number,
  events: GameEvent[],
  costFactor: Ratio = { num: 1, den: 1 },
): Rejection | null {
  const blocked = wallRepairBlocked(draft);
  if (blocked !== null) {
    return blocked;
  }
  const quote = currentRepairQuote(draft);
  const cost = {
    stone: Math.floor((quote.stone * costFactor.num) / costFactor.den),
    gold: Math.floor((quote.gold * costFactor.num) / costFactor.den),
  };
  const missing = missingResources(draft, cost);
  if (missing !== null) {
    return reject('INSUFFICIENT_RESOURCES', { missing });
  }
  const { settlement } = draft;
  const level = settlement.buildings.palisade;
  const wings = damagedWings(draft);
  const alas = wingsText(settlement.wall.hp, wallHpPerWing(level), wings);
  payResources(draft, cost);
  settlement.wallRepair = { untilMs: nowMs + quote.durationMs, toHp: wallFullHp(level) };
  // A obra em curso espera: o reparo vem na frente.
  for (const slot of settlement.constructionQueues) {
    if (slot !== null) {
      slot.finishesAtMs += quote.durationMs;
    }
  }
  emit(
    events,
    draft,
    nowMs,
    'wallRepairStarted',
    {
      spent_stone: cost.stone,
      spent_gold: cost.gold,
      durationMs: quote.durationMs,
      untilMs: nowMs + quote.durationMs,
      missingHp: wallMissingHp(draft),
    },
    { alas },
  );
  return null;
}

/**
 * Quanto uma obra que começa em `nowMs` espera pelo reparo em curso: o que falta para ele
 * terminar, ou zero.
 */
export function repairDelayMs(state: GameState, nowMs: number): number {
  const repair = state.settlement.wallRepair;
  return repair === null ? 0 : Math.max(0, repair.untilMs - nowMs);
}

/** O instante em que o reparo em curso termina, ou `null`: um candidato de `nextEventAt`. */
export function nextWallRepairAt(state: GameState): number | null {
  return state.settlement.wallRepair?.untilMs ?? null;
}

/** Conclui o reparo que vence até `atMs`: cada ala fica com a vida marcada, e sai `wallRepaired`. */
export function finishWallRepair(draft: GameState, atMs: number, events: GameEvent[]): void {
  const { settlement } = draft;
  const repair = settlement.wallRepair;
  if (repair === null || repair.untilMs > atMs) {
    return;
  }
  for (const wing of WING_IDS) {
    settlement.wall.hp[wing] = Math.max(settlement.wall.hp[wing], repair.toHp[wing]);
  }
  settlement.wallRepair = null;
  emit(events, draft, atMs, 'wallRepaired', { palisadeLevel: settlement.buildings.palisade });
}

/**
 * A obra da Paliçada que sobe do nível `from` ao `to` soma a cada ala a vida que o nível novo
 * dá a mais (o dano de antes continua), e também ao alvo do reparo em curso.
 */
export function raiseWall(draft: GameState, from: number, to: number): void {
  const gained = wallHpPerWing(to) - wallHpPerWing(from);
  if (gained <= 0) {
    return;
  }
  const { settlement } = draft;
  for (const wing of WING_IDS) {
    settlement.wall.hp[wing] += gained;
    if (settlement.wallRepair !== null) {
      settlement.wallRepair.toHp[wing] += gained;
    }
  }
}

/**
 * Aplica à muralha o dano de uma batalha de defesa (o fim de cada ala no relatório): a vida de
 * cada ala passa a ser a do fim da batalha, nunca acima da de agora, e sai `wallDamaged` quando
 * alguma ala perdeu vida. Quem a chama é a incursão (`fightRaid`, V4E-T2.3). O reparo em curso, se
 * houver, continua e termina com o alvo que tinha.
 */
export function applyWallDamage(
  draft: GameState,
  report: Pick<BattleReport, 'wall'>,
  atMs: number,
  events: GameEvent[],
): void {
  const { settlement } = draft;
  const hit: WingId[] = [];
  for (const entry of report.wall) {
    const before = settlement.wall.hp[entry.wing];
    const after = Math.max(0, Math.min(before, entry.end));
    if (after < before) {
      settlement.wall.hp[entry.wing] = after;
      hit.push(entry.wing);
    }
  }
  if (hit.length === 0) {
    return;
  }
  const full = wallHpPerWing(settlement.buildings.palisade);
  const data: Record<string, number> = {};
  for (const wing of WING_IDS) {
    data[`hp_${wing}`] = settlement.wall.hp[wing];
  }
  emit(events, draft, atMs, 'wallDamaged', data, {
    alas: wingsText(settlement.wall.hp, full, hit),
  });
}

/** A muralha que a batalha de defesa recebe: a vida de cada ala com vida (sem Paliçada, nenhuma). */
export function wallForBattle(state: GameState): Partial<Record<WingId, number>> {
  const wall: Partial<Record<WingId, number>> = {};
  for (const wing of WING_IDS) {
    const hp = state.settlement.wall.hp[wing];
    if (hp > 0) {
      wall[wing] = hp;
    }
  }
  return wall;
}
