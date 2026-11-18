import {
  ARCHETYPE_COUNTERS,
  balance,
  heroClasses,
  hordeUnits,
  LINE_IDS,
  militiaUnit,
  units,
  WING_IDS,
  type Archetype,
  type HeroAura,
  type HeroCaptureRuleId,
  type HeroClassId,
  type HordeUnitDef,
  type HordeUnitId,
  type LineId,
  type Ratio,
  type UnitId,
  type WingId,
} from '@lotg/content';

/**
 * A resolução de uma batalha (GDD §10.1 a §10.4; ADR 0019, decisões 10 e 11; leituras do autor
 * de 2026-10-23, D-1 a D-4). Função pura, em inteiros e frações: o único arredondamento é o
 * piso do dano efetivo (e o do golpe na muralha, que é dano também). A sorte vem de fora
 * (`LuckSource`): o teste injeta 100, a batalha do jogo tira do fluxo `battle:<id>`
 * (`battleTurn.ts`), e a prévia (V4D-T2) das suas sementes.
 *
 * O que a função **não** faz: ler o estado, sortear, criar entidade, emitir evento. Quem a chama
 * monta a entrada (a formação, a onda, a muralha, a Torre) e decide o que fazer com o resultado.
 * Desde a V4E-T2.3, a incursão a chama por `fightBattle`.
 */

/** O lado do campo: `D` defende, `A` ataca (as siglas de `docs/content-v0.4.md`, seção 2.0). */
export type BattleSide = 'D' | 'A';

export type BattlePosts<U extends string> = Record<
  WingId,
  Record<LineId, { readonly unit: U; readonly count: number } | null>
>;

export type BattleCommanderInput = { readonly heroId: string; readonly heroClass: HeroClassId };

export type BattleInput = {
  /** `defense`: a Horda ataca o feudo (muralha e torres valem); `attack`: o jogador ataca. */
  readonly armyMoraleBonus?: number;
  readonly wolfAttackFactor?: Ratio;
  readonly mode: 'defense' | 'attack';
  readonly player: {
    readonly posts: BattlePosts<UnitId | 'militia'>;
    readonly commanders: Record<WingId, BattleCommanderInput | null>;
  };
  readonly horde: { readonly posts: BattlePosts<HordeUnitId> };
  /** A vida da muralha do defensor em cada ala (do Acampamento em ataque). */
  readonly wall: Partial<Record<WingId, number>>;
  /** O nível da Torre de Vigia (as torres atiram a partir de `balance.battle.towers.fromLevel`). */
  readonly watchtowerLevel: number;
  /** A regra da dificuldade para o herói que cai (`difficulties[].heroCapture`). */
  readonly heroCapture: HeroCaptureRuleId;
};

/** A sorte de um ataque: um inteiro de `luck.min` a `luck.max`, pedido uma vez por ataque. */
export type LuckSource = () => number;

/** Um posto do campo: lado, ala e linha. */
export type BattlePost = {
  readonly side: BattleSide;
  readonly wing: WingId;
  readonly line: LineId;
};

export type BattleFactorKind = 'counter' | 'aura' | 'flank' | 'cover';

/** Um golpe em um esquadrão, com as frações da conta (para o golden e para a atribuição). */
export type BattleHit = {
  readonly target: BattlePost;
  readonly targetUnit: UnitId | HordeUnitId | 'militia';
  readonly targetCount: number;
  /** O dano que chega ao esquadrão antes da defesa. */
  readonly raw: Ratio;
  /** O que a defesa absorve, ou `null` no dano fixo (torre, Mago). */
  readonly absorbed: Ratio | null;
  /** O fator da aura do Guerreiro na defesa do alvo, se houve. */
  readonly defenseAura: Ratio | null;
  readonly effective: number;
  readonly residualBefore: number;
  readonly casualties: number;
  readonly left: number;
  readonly residualAfter: number;
  /** Se o golpe foi à Retaguarda com a Frente da ala ainda de pé (por cima dela). */
  readonly overFront: boolean;
  /** Se o golpe foi à Retaguarda depois de a Frente da ala cair. */
  readonly exposedRear: boolean;
};

export type BattleNote =
  | { readonly kind: 'squadDestroyed'; readonly post: BattlePost; readonly morale: number }
  | {
      readonly kind: 'wingFell';
      readonly side: BattleSide;
      readonly wing: WingId;
      readonly morale: number;
    }
  | {
      readonly kind: 'commanderFell';
      readonly wing: WingId;
      readonly heroId: string;
      readonly morale: number;
    }
  | { readonly kind: 'chiefFell'; readonly post: BattlePost };

export type BattleAction =
  | {
      readonly kind: 'attack';
      readonly actor: BattlePost;
      readonly unit: UnitId | HordeUnitId | 'militia';
      readonly count: number;
      readonly attack: number;
      /** O esquadrão que o ataque mirou (antes da muralha e dos Escudeiros). */
      readonly target: BattlePost;
      readonly targetUnit: UnitId | HordeUnitId | 'militia';
      readonly targetCount: number;
      readonly luck: number;
      readonly factors: ReadonlyArray<{ readonly kind: BattleFactorKind; readonly value: Ratio }>;
      readonly flank: boolean;
      /** O dano bruto inteiro do ataque. */
      readonly raw: Ratio;
      /** O que o golpe deixou na muralha da ala do alvo, se bateu nela. */
      readonly wall: {
        readonly wing: WingId;
        readonly share: Ratio;
        readonly damage: number;
        readonly before: number;
        readonly after: number;
      } | null;
      readonly hits: readonly BattleHit[];
      readonly notes: readonly BattleNote[];
    }
  | {
      readonly kind: 'tower' | 'mage' | 'cleric';
      readonly wing: WingId;
      readonly heroId: string | null;
      readonly hits: readonly BattleHit[];
      /** Na cura da Clériga: os soldados que voltaram e o dano residual que saiu. */
      readonly healed: {
        readonly post: BattlePost;
        readonly soldiers: number;
        readonly residual: number;
      } | null;
      readonly notes: readonly BattleNote[];
    };

export type BattleSquadState = {
  readonly post: BattlePost;
  readonly unit: UnitId | HordeUnitId | 'militia';
  readonly count: number;
  readonly residual: number;
};

export type BattleRound = {
  readonly round: number;
  readonly actions: readonly BattleAction[];
  readonly morale: Record<BattleSide, number>;
  readonly squads: readonly BattleSquadState[];
  readonly wall: Partial<Record<WingId, number>>;
  /** O lado que debandou no fim desta rodada. */
  readonly routed: BattleSide | null;
};

export type BattleEnding = 'annihilation' | 'rout' | 'chiefFell' | 'rounds';

/** O desfecho do ponto de vista do jogador. */
export type BattleOutcome = 'victory' | 'held' | 'defeat' | 'withdrew';

export type BattleResolution = {
  readonly input: BattleInput;
  readonly playerSide: BattleSide;
  readonly winner: BattleSide;
  readonly ending: BattleEnding;
  readonly outcome: BattleOutcome;
  readonly rounds: readonly BattleRound[];
  readonly initial: readonly BattleSquadState[];
  readonly startMorale: Record<BattleSide, number>;
  readonly wallStart: Partial<Record<WingId, number>>;
  /** Os comandantes do jogador, com o que lhes aconteceu. */
  readonly commanders: ReadonlyArray<{
    readonly wing: WingId;
    readonly heroId: string;
    readonly heroClass: HeroClassId;
    readonly fell: boolean;
    readonly fellInRound: number | null;
    /**
     * O que aconteceu a quem caiu: ferido, ou morto em Rei de Ferro (`heroCapture: 'death'`).
     * Nunca morre em outra dificuldade, e a batalha não captura (GDD §10.4).
     */
    readonly fate: 'wounded' | 'died' | null;
  }>;
};

// ——— Frações exatas ———————————————————————————————————————————————————————————————

function gcd(a: number, b: number): number {
  let [x, y] = [Math.abs(a), Math.abs(b)];
  while (y !== 0) {
    [x, y] = [y, x % y];
  }
  return x;
}

function frac(num: number, den = 1): Ratio {
  if (!Number.isSafeInteger(num) || !Number.isSafeInteger(den) || den === 0) {
    throw new Error(`Fração inválida na batalha: ${String(num)}/${String(den)}.`);
  }
  const sign = den < 0 ? -1 : 1;
  const divisor = gcd(num, den) || 1;
  return { num: (sign * num) / divisor, den: (sign * den) / divisor };
}

const mul = (a: Ratio, b: Ratio): Ratio => {
  const g1 = gcd(a.num, b.den) || 1;
  const g2 = gcd(b.num, a.den) || 1;
  return frac((a.num / g1) * (b.num / g2), (a.den / g2) * (b.den / g1));
};
const sub = (a: Ratio, b: Ratio): Ratio => frac(a.num * b.den - b.num * a.den, a.den * b.den);
const less = (a: Ratio, b: Ratio): boolean => a.num * b.den < b.num * a.den;
const maxOf = (a: Ratio, b: Ratio): Ratio => (less(a, b) ? b : a);
/** O piso de uma fração (inteiro; para negativos, o inteiro abaixo). */
const floorOf = (a: Ratio): number => Math.floor(a.num / a.den);
const ONE: Ratio = { num: 1, den: 1 };

// ——— Esquadrões ——————————————————————————————————————————————————————————————————

type Stats = {
  readonly attack: number;
  readonly defense: number;
  readonly health: number;
  readonly initiative: number;
  readonly line: LineId;
  readonly archetype: Archetype;
  readonly horde: HordeUnitDef | null;
};

type Squad = {
  readonly side: BattleSide;
  readonly owner: 'player' | 'horde';
  readonly wing: WingId;
  readonly line: LineId;
  readonly unit: UnitId | HordeUnitId | 'militia';
  readonly stats: Stats;
  readonly initial: number;
  count: number;
  residual: number;
};

function statsOf(owner: 'player' | 'horde', unit: string): Stats {
  if (owner === 'player') {
    if (unit === 'militia') {
      return {
        ...pick(militiaUnit),
        line: 'front',
        archetype: 'none',
        horde: null,
      };
    }
    const def = units[unit as UnitId];
    if (def === undefined) {
      throw new Error(`Unidade desconhecida na batalha: ${unit}.`);
    }
    return { ...pick(def), archetype: unit as UnitId, horde: null };
  }
  const def = hordeUnits[unit as HordeUnitId];
  if (def === undefined) {
    throw new Error(`Inimigo desconhecido na batalha: ${unit}.`);
  }
  return { ...pick(def), archetype: def.archetype, horde: def };
}

function pick(def: {
  attack: number;
  defense: number;
  health: number;
  initiative: number;
  line: LineId;
}) {
  return {
    attack: def.attack,
    defense: def.defense,
    health: def.health,
    initiative: def.initiative,
    line: def.line,
  };
}

const other = (side: BattleSide): BattleSide => (side === 'D' ? 'A' : 'D');
const postOf = (squad: Squad): BattlePost => ({
  side: squad.side,
  wing: squad.wing,
  line: squad.line,
});

/** Quem bate à distância: a Retaguarda. */
const isRanged = (squad: Squad): boolean => squad.stats.line === 'back';

/**
 * Resolve a batalha. Lança erro só para entrada fora da forma (defeito de quem chama): posto
 * com quantidade que não é inteiro positivo, unidade na linha errada, sorte fora do intervalo.
 */
export function resolveBattle(input: BattleInput, luck: LuckSource): BattleResolution {
  const rules = balance.battle;
  const playerSide: BattleSide = input.mode === 'defense' ? 'D' : 'A';
  const hordeSide = other(playerSide);
  const squads: Squad[] = [];
  const add = (side: BattleSide, owner: 'player' | 'horde', posts: BattlePosts<string>) => {
    for (const wing of WING_IDS) {
      for (const line of LINE_IDS) {
        const post = posts[wing][line];
        if (post === null) {
          continue;
        }
        if (!Number.isSafeInteger(post.count) || post.count < 1) {
          throw new Error(`Posto com quantidade inválida na batalha: ${wing}/${line}.`);
        }
        const stats = statsOf(owner, post.unit);
        if (stats.line !== line) {
          throw new Error(`Unidade na linha errada na batalha: ${post.unit} em ${wing}/${line}.`);
        }
        squads.push({
          side,
          owner,
          wing,
          line,
          unit: post.unit as UnitId | HordeUnitId | 'militia',
          stats,
          initial: post.count,
          count: post.count,
          residual: 0,
        });
      }
    }
  };
  // A ordem da lista é a dos lados (D, A) e, dentro, a da ala e da linha: é a ordem de desempate.
  if (playerSide === 'D') {
    add('D', 'player', input.player.posts);
    add('A', 'horde', input.horde.posts);
  } else {
    add('D', 'horde', input.horde.posts);
    add('A', 'player', input.player.posts);
  }
  const initial = squads.map(snapshot);
  // Um lado sem ninguém no campo perde sem luta: nenhuma rodada, nenhuma sorte gasta.
  const emptyAtStart = (['D', 'A'] as const).find(
    (side) => !squads.some((squad) => squad.side === side),
  );

  const defense = input.mode === 'defense';
  const wall: Partial<Record<WingId, number>> = {};
  for (const wing of WING_IDS) {
    const hp = input.wall[wing];
    if (hp !== undefined) {
      if (!Number.isSafeInteger(hp) || hp < 0) {
        throw new Error(`Muralha com vida inválida na batalha: ${wing}.`);
      }
      wall[wing] = hp;
    }
  }
  const wallStart = { ...wall };

  const commanders = WING_IDS.flatMap((wing) => {
    const commander = input.player.commanders[wing];
    // O comandante só entra se a ala dele tem soldados no começo (resposta do autor, D-5): numa
    // ala vazia ele não dá aura nem moral, e também não corre risco.
    const posts = input.player.posts[wing];
    const manned = (posts.front?.count ?? 0) > 0 || (posts.back?.count ?? 0) > 0;
    return commander === null || !manned
      ? []
      : [
          {
            wing,
            heroId: commander.heroId,
            heroClass: commander.heroClass,
            fell: false,
            fellInRound: null as number | null,
          },
        ];
  });
  const commanderOf = (wing: WingId) =>
    commanders.find((entry) => entry.wing === wing && !entry.fell) ?? null;
  /** A aura do comandante de pé na ala, se for do tipo pedido (`heroClasses[].aura`). */
  const auraOf = <K extends HeroAura['kind']>(
    wing: WingId,
    kind: K,
  ): Extract<HeroAura, { kind: K }> | null => {
    const commander = commanderOf(wing);
    const aura = commander === null ? null : heroClasses[commander.heroClass].aura;
    return aura !== null && aura.kind === kind ? (aura as Extract<HeroAura, { kind: K }>) : null;
  };

  const morale: Record<BattleSide, number> = { D: rules.morale.start, A: rules.morale.start };
  for (const entry of commanders) {
    const aura = heroClasses[entry.heroClass].aura;
    if (aura.kind === 'heal') {
      morale[playerSide] += aura.morale;
    }
  }
  morale[playerSide] += input.armyMoraleBonus ?? 0;
  const startMorale = { ...morale };

  const alive = (squad: Squad) => squad.count > 0;
  const sideAlive = (side: BattleSide) =>
    squads.some((squad) => squad.side === side && alive(squad));
  const wingSquads = (side: BattleSide, wing: WingId) =>
    squads.filter((squad) => squad.side === side && squad.wing === wing && alive(squad));
  const at = (side: BattleSide, wing: WingId, line: LineId) =>
    squads.find(
      (squad) => squad.side === side && squad.wing === wing && squad.line === line && alive(squad),
    ) ?? null;

  let ended: { ending: BattleEnding; winner: BattleSide } | null =
    emptyAtStart === undefined ? null : { ending: 'annihilation', winner: other(emptyAtStart) };

  /** Aplica um golpe (parte do dano) a um esquadrão e anota as baixas e a moral. */
  const hit = (
    target: Squad,
    raw: Ratio,
    absorbs: boolean,
    notes: BattleNote[],
    flags: { overFront: boolean; exposedRear: boolean },
  ): BattleHit => {
    const targetCount = target.count;
    let absorbed: Ratio | null = null;
    let defenseAura: Ratio | null = null;
    let effective: number;
    if (absorbs) {
      absorbed = mul(frac(target.stats.defense * target.count), rules.absorb);
      const aura = target.owner === 'player' ? auraOf(target.wing, 'defense') : null;
      if (aura !== null) {
        defenseAura = aura.ratio;
        absorbed = mul(absorbed, defenseAura);
      }
      effective = floorOf(maxOf(sub(raw, absorbed), mul(raw, rules.minDamage)));
    } else {
      effective = floorOf(raw);
    }
    if (target.unit === balance.army.militia.unit) {
      effective = floorOf(mul(frac(effective), balance.army.militia.takesDamage));
    }
    const residualBefore = target.residual;
    const pool = effective + residualBefore;
    const casualties = Math.min(target.count, Math.floor(pool / target.stats.health));
    target.count -= casualties;
    target.residual = target.count === 0 ? 0 : pool - casualties * target.stats.health;
    if (target.count === 0) {
      fall(target, notes);
    }
    return {
      target: postOf(target),
      targetUnit: target.unit,
      targetCount,
      raw,
      absorbed,
      defenseAura,
      effective,
      residualBefore,
      casualties,
      left: target.count,
      residualAfter: target.residual,
      ...flags,
    };
  };

  const fall = (squad: Squad, notes: BattleNote[]) => {
    morale[squad.side] -= rules.morale.perSquad;
    notes.push({ kind: 'squadDestroyed', post: postOf(squad), morale: morale[squad.side] });
    if (wingSquads(squad.side, squad.wing).length === 0) {
      morale[squad.side] -= rules.morale.perWing;
      notes.push({
        kind: 'wingFell',
        side: squad.side,
        wing: squad.wing,
        morale: morale[squad.side],
      });
    }
    if (squad.stats.horde?.endsWaveOnDeath === true && ended === null) {
      notes.push({ kind: 'chiefFell', post: postOf(squad) });
      ended = { ending: 'chiefFell', winner: other(squad.side) };
    }
    if (ended === null && !sideAlive(squad.side)) {
      ended = { ending: 'annihilation', winner: other(squad.side) };
    }
  };

  /** O comandante cai quando um golpe inimigo chega à ala dele sem a Frente de pé. */
  const exposeCommander = (wing: WingId, round: number, notes: BattleNote[]) => {
    const commander = commanderOf(wing);
    if (commander === null) {
      return;
    }
    commander.fell = true;
    commander.fellInRound = round;
    morale[playerSide] -= rules.morale.perCommander;
    notes.push({
      kind: 'commanderFell',
      wing,
      heroId: commander.heroId,
      morale: morale[playerSide],
    });
  };

  /** A ala que o esquadrão ataca e se é pelo flanco, ou `null` se não há a quem atacar. */
  const targetWing = (squad: Squad): { wing: WingId; flank: boolean } | null => {
    const foe = other(squad.side);
    const has = (wing: WingId) => wingSquads(foe, wing).length > 0;
    if (squad.stats.horde?.alwaysLateral === true && squad.wing === 'center') {
      // O Lobo do Centro escolhe uma ala lateral (D-4): a esquerda, senão a direita.
      for (const wing of ['left', 'right'] as const) {
        if (has(wing)) {
          return { wing, flank: false };
        }
      }
      return has('center') ? { wing: 'center', flank: true } : null;
    }
    if (has(squad.wing)) {
      return { wing: squad.wing, flank: false };
    }
    const order: readonly WingId[] =
      squad.wing === 'center' ? ['left', 'right'] : ['center', 'left', 'right'];
    const wing = order.find(has);
    return wing === undefined ? null : { wing, flank: true };
  };

  const attack = (squad: Squad, round: number): BattleAction | null => {
    const aim = targetWing(squad);
    if (aim === null) {
      return null;
    }
    const roll = luck();
    if (!Number.isSafeInteger(roll) || roll < rules.luck.min || roll > rules.luck.max) {
      throw new Error(`Sorte fora do intervalo na batalha: ${String(roll)}.`);
    }
    const foe = other(squad.side);
    const front = at(foe, aim.wing, 'front');
    const back = at(foe, aim.wing, 'back');
    // O arqueiro da Horda mira a Retaguarda por cima da Frente (D-3); os outros, a Frente.
    const overFront =
      squad.owner === 'horde' &&
      squad.stats.archetype === 'archer' &&
      back !== null &&
      front !== null;
    const target = overFront ? back : (front ?? back);
    if (target === null) {
      return null;
    }
    const targetCount = target.count;
    const factors: Array<{ kind: BattleFactorKind; value: Ratio }> = [];
    const counter = counterOf(squad, target);
    if (counter !== null) {
      factors.push({ kind: 'counter', value: counter });
    }
    for (const aura of aurasOf(squad)) {
      factors.push({ kind: 'aura', value: aura });
    }
    if (aim.flank) {
      factors.push({ kind: 'flank', value: rules.flank });
    }
    const wallHp = wall[aim.wing];
    if (isRanged(squad)) {
      if (squad.side === 'D') {
        const own = wall[squad.wing];
        if (own !== undefined && own > 0) {
          factors.push({ kind: 'cover', value: rules.wall.coverFactor });
        }
      } else if (wallHp !== undefined && wallHp > 0) {
        factors.push({ kind: 'cover', value: rules.wall.enemyRangedFactor });
      }
    }
    let raw = frac(squad.stats.attack * squad.count);
    if (squad.side !== playerSide && squad.unit === 'wolf' && input.wolfAttackFactor !== undefined)
      raw = mul(raw, input.wolfAttackFactor);
    for (const factor of factors) {
      raw = mul(raw, factor.value);
    }
    raw = mul(raw, frac(roll, 100));

    const notes: BattleNote[] = [];
    const hits: BattleHit[] = [];
    let wallHit: Extract<BattleAction, { kind: 'attack' }>['wall'] = null;
    let toTroops = raw;
    if (squad.side === 'A' && !isRanged(squad) && wallHp !== undefined && wallHp > 0) {
      const share = squad.stats.horde?.ignoresWallHalf === true ? rules.wall.ignoresHalfShare : ONE;
      const damage = floorOf(mul(raw, share));
      const after = Math.max(0, wallHp - damage);
      wall[aim.wing] = after;
      wallHit = { wing: aim.wing, share, damage, before: wallHp, after };
      toTroops = sub(raw, mul(raw, share));
    }
    if (toTroops.num > 0) {
      const exposed = target.line === 'back' && !overFront;
      if (squad.owner === 'horde' && front === null) {
        exposeCommander(aim.wing, round, notes);
      }
      const shield =
        target.line === 'back' && front !== null && front.unit === 'shieldbearer' ? front : null;
      if (shield !== null) {
        const part = mul(toTroops, rules.shieldbearerShare);
        hits.push(hit(shield, part, true, notes, { overFront: false, exposedRear: false }));
        if (alive(target) && ended === null) {
          hits.push(
            hit(target, sub(toTroops, part), true, notes, { overFront, exposedRear: exposed }),
          );
        }
      } else {
        hits.push(hit(target, toTroops, true, notes, { overFront, exposedRear: exposed }));
      }
    }
    return {
      kind: 'attack',
      actor: postOf(squad),
      unit: squad.unit,
      count: squad.count,
      attack: squad.stats.attack,
      target: postOf(target),
      targetUnit: target.unit,
      targetCount,
      luck: roll,
      factors,
      flank: aim.flank,
      raw,
      wall: wallHit,
      hits,
      notes,
    };
  };

  const counterOf = (squad: Squad, target: Squad): Ratio | null => {
    if (ARCHETYPE_COUNTERS[squad.stats.archetype] === target.stats.archetype) {
      return rules.counter;
    }
    // Os casos fora do ciclo (§10.3): o Ogro sofre ×3/2 de Lanceiros; o Lobo, ×3/2 contra o
    // Arqueiro (que o ciclo já dá: não se somam).
    const taken = target.stats.horde?.takesBonusFrom?.[squad.unit as UnitId];
    if (taken !== undefined) {
      return taken;
    }
    const dealt = squad.stats.horde?.bonusAgainst?.[target.unit as UnitId];
    return dealt ?? null;
  };

  const aurasOf = (squad: Squad): Ratio[] => {
    const found: Ratio[] = [];
    if (squad.owner === 'horde') {
      for (const ally of squads) {
        if (ally.side === squad.side && alive(ally) && ally.stats.horde?.auraArmy !== undefined) {
          found.push(ally.stats.horde.auraArmy);
        }
      }
      for (const ally of squads) {
        if (
          ally.side === squad.side &&
          ally.wing === squad.wing &&
          alive(ally) &&
          ally.stats.horde?.auraWing !== undefined
        ) {
          found.push(ally.stats.horde.auraWing);
        }
      }
    } else if (isRanged(squad)) {
      const aura = auraOf(squad.wing, 'ranged');
      if (aura !== null) {
        found.push(aura.ratio);
      }
    }
    return found;
  };

  /** Torres, Mago e Clériga, no fim de cada rodada, ala por ala. */
  const roundEffects = (round: number, actions: BattleAction[]) => {
    const towerDamage =
      defense && input.watchtowerLevel >= rules.towers.fromLevel
        ? rules.towers.damagePerLevel * (input.watchtowerLevel - rules.towers.fromLevel + 1)
        : 0;
    if (towerDamage > 0) {
      for (const wing of WING_IDS) {
        if (ended !== null) {
          return;
        }
        const target = at(hordeSide, wing, 'front') ?? at(hordeSide, wing, 'back');
        if (target === null) {
          continue;
        }
        const notes: BattleNote[] = [];
        const hits = [
          hit(target, frac(towerDamage), false, notes, { overFront: false, exposedRear: false }),
        ];
        actions.push({ kind: 'tower', wing, heroId: null, hits, healed: null, notes });
      }
    }
    for (const wing of WING_IDS) {
      if (ended !== null) {
        return;
      }
      const mage = commanderOf(wing);
      const area = auraOf(wing, 'area');
      if (mage !== null && area !== null && round % area.everyRounds === 0) {
        const notes: BattleNote[] = [];
        const hits: BattleHit[] = [];
        for (const target of wingSquads(hordeSide, wing)) {
          const double = target.stats.horde?.takesDoubleFrom?.includes('mage') === true;
          const damage = mul(frac(area.damage), double ? rules.undeadFactor : ONE);
          if (ended === null) {
            hits.push(hit(target, damage, false, notes, { overFront: false, exposedRear: false }));
          }
        }
        if (hits.length > 0) {
          actions.push({ kind: 'mage', wing, heroId: mage.heroId, hits, healed: null, notes });
        }
      }
      const cleric = commanderOf(wing);
      const care = auraOf(wing, 'heal');
      const front = at(playerSide, wing, 'front');
      if (cleric !== null && care !== null && front !== null && round % care.everyRounds === 0) {
        let heal = floorOf(mul(frac(front.initial * front.stats.health), care.heal));
        const residual = Math.min(heal, front.residual);
        front.residual -= residual;
        heal -= residual;
        const soldiers = Math.min(
          Math.floor(heal / front.stats.health),
          front.initial - front.count,
        );
        front.count += soldiers;
        actions.push({
          kind: 'cleric',
          wing,
          heroId: cleric.heroId,
          hits: [],
          healed: { post: postOf(front), soldiers, residual },
          notes: [],
        });
      }
    }
  };

  const rounds: BattleRound[] = [];
  for (let round = 1; round <= rules.maxRounds && ended === null; round += 1) {
    const order = squads
      .map((squad, index) => ({ squad, index }))
      .filter(({ squad }) => alive(squad))
      .sort((a, b) => b.squad.stats.initiative - a.squad.stats.initiative || a.index - b.index)
      .map(({ squad }) => squad);
    const actions: BattleAction[] = [];
    for (const squad of order) {
      if (ended !== null) {
        break;
      }
      if (!alive(squad)) {
        continue;
      }
      const action = attack(squad, round);
      if (action !== null) {
        actions.push(action);
      }
    }
    if (ended === null) {
      roundEffects(round, actions);
    }
    let routed: BattleSide | null = null;
    if (ended === null) {
      // A debandada, no fim da rodada; quem não tem moral (os mortos-vivos, o chefe) não foge, e
      // o lado só debanda se tiver quem fuja. Se os dois lados debandam, o atacante foge primeiro.
      for (const side of ['A', 'D'] as const) {
        const canFlee = squads.some(
          (squad) => squad.side === side && alive(squad) && squad.stats.horde?.noMorale !== true,
        );
        if (routed === null && canFlee && morale[side] <= rules.morale.routAtOrBelow) {
          routed = side;
        }
      }
      if (routed !== null) {
        ended = { ending: 'rout', winner: other(routed) };
      }
    }
    rounds.push({
      round,
      actions,
      morale: { ...morale },
      squads: squads.filter(alive).map(snapshot),
      wall: { ...wall },
      routed,
    });
  }
  const result: { ending: BattleEnding; winner: BattleSide } = ended ?? {
    ending: 'rounds',
    winner: 'D',
  };
  const won = result.winner === playerSide;
  const outcome: BattleOutcome = won
    ? result.ending === 'rounds'
      ? 'held'
      : 'victory'
    : result.ending === 'rounds'
      ? 'withdrew'
      : 'defeat';
  return {
    input,
    playerSide,
    winner: result.winner,
    ending: result.ending,
    outcome,
    rounds,
    initial,
    startMorale,
    wallStart,
    commanders: commanders.map((entry) => ({
      ...entry,
      fate: entry.fell ? (input.heroCapture === 'death' ? 'died' : 'wounded') : null,
    })),
  };
}

function snapshot(squad: Squad): BattleSquadState {
  return {
    post: postOf(squad),
    unit: squad.unit,
    count: squad.count,
    residual: squad.residual,
  };
}

/** A sorte fixa em 100: a dos goldens escritos à mão (`docs/content-v0.4.md`, seção 2.0). */
export const EVEN_LUCK: LuckSource = () => 100;
