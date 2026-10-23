import {
  balance,
  WING_IDS,
  type HeroClassId,
  type HordeUnitId,
  type LineId,
  type Ratio,
  type UnitId,
  type WingId,
} from '@lotg/content';

import type {
  BattleEnding,
  BattleOutcome,
  BattlePost,
  BattleResolution,
  BattleSide,
} from './battle';

/**
 * O relatório de uma batalha (GDD §10.7; V4D-T1.5): o que fica guardado em `army.reports` e o
 * que a visão (Fase E) transforma em frase. Só inteiros e identificadores, do ponto de vista do
 * jogador (`player`, `horde`), sem a conta em frações nem a sorte: quem quer a conta inteira lê
 * a resolução (`battle.ts`).
 */

export type BattleOwner = 'player' | 'horde';

export type BattleReportPost = {
  readonly owner: BattleOwner;
  readonly wing: WingId;
  readonly line: LineId;
};

/**
 * Um fator decisivo, por atribuição de dano: quanto dano (inteiro, o piso) o fator trouxe ou
 * evitou, a favor de quem (`owner`), onde (a ala, quando é de uma ala só) e em que rodada
 * apareceu pela primeira vez.
 *
 * - `wallAbsorbed`: o dano inimigo que a muralha tomou; `percent` é a parte do dano bruto da
 *   Horda.
 * - `counter`, `flank`, `aura`: o dano a mais que o contra-ataque, o flanco e as auras deram.
 * - `exposedRear`: o dano efetivo que a Horda fez na Retaguarda do jogador depois de a Frente
 *   da ala cair.
 * - `tower`: o dano das torres.
 */
export type BattleFactorId =
  'wallAbsorbed' | 'counter' | 'exposedRear' | 'flank' | 'tower' | 'aura';

/** A ordem de desempate dos fatores (a do roadmap, V4D-T1.5). */
export const BATTLE_FACTOR_IDS: readonly BattleFactorId[] = [
  'wallAbsorbed',
  'counter',
  'exposedRear',
  'flank',
  'tower',
  'aura',
];

export type BattleFactor = {
  readonly factor: BattleFactorId;
  readonly owner: BattleOwner;
  readonly amount: number;
  readonly wing: WingId | null;
  readonly round: number;
  readonly percent: number | null;
};

export type BattleReportRound = {
  readonly round: number;
  readonly attacks: ReadonlyArray<{
    readonly actor: BattleReportPost;
    readonly unit: UnitId | HordeUnitId;
    readonly count: number;
    readonly target: BattleReportPost;
    readonly wall: number;
    readonly damage: number;
    readonly casualties: number;
  }>;
  readonly casualties: { readonly player: number; readonly horde: number };
  readonly morale: { readonly player: number; readonly horde: number };
  readonly wall: Partial<Record<WingId, number>>;
};

export type BattleReport = {
  readonly id: string;
  readonly foughtAtMs: number;
  readonly mode: 'defense' | 'attack';
  readonly outcome: BattleOutcome;
  readonly ending: BattleEnding;
  readonly rounds: number;
  /** Até três, do maior ao menor. */
  readonly decisive: readonly BattleFactor[];
  readonly casualties: ReadonlyArray<{
    readonly owner: BattleOwner;
    readonly wing: WingId;
    readonly line: LineId;
    readonly unit: UnitId | HordeUnitId;
    readonly start: number;
    readonly lost: number;
  }>;
  readonly wall: ReadonlyArray<{
    readonly wing: WingId;
    readonly start: number;
    readonly end: number;
  }>;
  readonly commanders: ReadonlyArray<{
    readonly heroId: string;
    readonly wing: WingId;
    readonly heroClass: HeroClassId;
    readonly fate: 'wounded' | 'died' | null;
    readonly xp: number;
  }>;
  readonly log: readonly BattleReportRound[];
};

const floorOf = (value: Ratio): number => Math.floor(value.num / value.den);

/** O dano a mais que um fator `factor` deu a um dano bruto `raw`: `raw × (1 − 1/fator)`. */
function extraOf(raw: Ratio, factor: Ratio): number {
  return floorOf({ num: raw.num * (factor.num - factor.den), den: raw.den * factor.num });
}

export function buildBattleReport(
  id: string,
  foughtAtMs: number,
  resolution: BattleResolution,
): BattleReport {
  const rules = balance.battle;
  const ownerOf = (side: BattleSide): BattleOwner =>
    side === resolution.playerSide ? 'player' : 'horde';
  const postOf = (post: BattlePost): BattleReportPost => ({
    owner: ownerOf(post.side),
    wing: post.wing,
    line: post.line,
  });

  const factors = new Map<
    string,
    {
      factor: BattleFactorId;
      owner: BattleOwner;
      amount: number;
      wing: WingId | null;
      round: number;
      wings: Set<WingId>;
    }
  >();
  const credit = (
    factor: BattleFactorId,
    owner: BattleOwner,
    amount: number,
    wing: WingId | null,
    round: number,
  ) => {
    if (amount <= 0) {
      return;
    }
    const key = `${factor}:${owner}`;
    const entry = factors.get(key);
    if (entry === undefined) {
      factors.set(key, {
        factor,
        owner,
        amount,
        wing,
        round,
        wings: new Set(wing === null ? [] : [wing]),
      });
      return;
    }
    entry.amount += amount;
    if (wing !== null) {
      entry.wings.add(wing);
    }
  };

  let hordeRaw = 0;
  let wallTaken = 0;
  const log: BattleReportRound[] = resolution.rounds.map((round) => {
    const attacks: Array<BattleReportRound['attacks'][number]> = [];
    const lost = { player: 0, horde: 0 };
    for (const action of round.actions) {
      for (const hit of action.hits) {
        lost[ownerOf(hit.target.side)] += hit.casualties;
      }
      if (action.kind !== 'attack') {
        if (action.kind === 'tower') {
          credit(
            'tower',
            'player',
            action.hits.reduce((sum, hit) => sum + hit.effective, 0),
            action.wing,
            round.round,
          );
        }
        continue;
      }
      const owner = ownerOf(action.actor.side);
      if (owner === 'horde') {
        hordeRaw += floorOf(action.raw);
      }
      for (const factor of action.factors) {
        if (factor.kind !== 'cover') {
          credit(
            factor.kind,
            owner,
            extraOf(action.raw, factor.value),
            action.actor.wing,
            round.round,
          );
        }
      }
      const wall = action.wall === null ? 0 : action.wall.before - action.wall.after;
      if (wall > 0) {
        wallTaken += wall;
        credit('wallAbsorbed', 'player', wall, action.wall?.wing ?? null, round.round);
      }
      if (owner === 'horde') {
        credit(
          'exposedRear',
          'horde',
          action.hits.filter((hit) => hit.exposedRear).reduce((sum, hit) => sum + hit.effective, 0),
          action.target.wing,
          round.round,
        );
      }
      attacks.push({
        actor: postOf(action.actor),
        unit: action.unit,
        count: action.count,
        target: postOf(action.target),
        wall,
        damage: action.hits.reduce((sum, hit) => sum + hit.effective, 0),
        casualties: action.hits.reduce((sum, hit) => sum + hit.casualties, 0),
      });
    }
    return {
      round: round.round,
      attacks,
      casualties: lost,
      morale: {
        player: round.morale[resolution.playerSide],
        horde: round.morale[resolution.playerSide === 'D' ? 'A' : 'D'],
      },
      wall: { ...round.wall },
    };
  });

  const decisive = [...factors.values()]
    .sort(
      (a, b) =>
        b.amount - a.amount ||
        BATTLE_FACTOR_IDS.indexOf(a.factor) - BATTLE_FACTOR_IDS.indexOf(b.factor) ||
        (a.owner === b.owner ? 0 : a.owner === 'player' ? -1 : 1),
    )
    .slice(0, 3)
    .map((entry) => ({
      factor: entry.factor,
      owner: entry.owner,
      amount: entry.amount,
      wing: entry.wings.size === 1 ? entry.wing : null,
      round: entry.round,
      percent:
        entry.factor === 'wallAbsorbed' && hordeRaw > 0
          ? Math.floor((100 * wallTaken) / hordeRaw)
          : null,
    }));

  const last = resolution.rounds.at(-1);
  const casualties = resolution.initial.map((squad) => {
    const end = last?.squads.find(
      (entry) =>
        entry.post.side === squad.post.side &&
        entry.post.wing === squad.post.wing &&
        entry.post.line === squad.post.line,
    );
    return {
      owner: ownerOf(squad.post.side),
      wing: squad.post.wing,
      line: squad.post.line,
      unit: squad.unit,
      start: squad.count,
      lost: last === undefined ? 0 : squad.count - (end?.count ?? 0),
    };
  });

  const won = resolution.winner === resolution.playerSide;
  const share = won ? rules.commanderXpShare.won : rules.commanderXpShare.lost;
  return {
    id,
    foughtAtMs,
    mode: resolution.input.mode,
    outcome: resolution.outcome,
    ending: resolution.ending,
    rounds: resolution.rounds.length,
    decisive,
    casualties,
    wall: WING_IDS.flatMap((wing) => {
      const start = resolution.wallStart[wing];
      return start === undefined ? [] : [{ wing, start, end: last?.wall[wing] ?? start }];
    }),
    commanders: resolution.commanders.map((commander) => ({
      heroId: commander.heroId,
      wing: commander.wing,
      heroClass: commander.heroClass,
      fate: commander.fate,
      xp:
        commander.fate === 'died'
          ? 0
          : floorOf({ num: rules.commanderXp * share.num, den: share.den }),
    })),
    log,
  };
}
