import {
  balance,
  craftGuilds,
  warRaids,
  type WarRaidSizeId,
  enemies,
  type EnemyId,
  idleVillager,
  injuredLoss,
  injuryTemplates,
  type RaidSizeId,
  raidTemplates,
  type Ratio,
  type ScriptedRaidDef,
  vigilRules,
} from '@lotg/content';

import { applyBattleOutcome } from './battleOutcome';
import { buildBattleReport } from './battleReport';
import { fightBattle } from './battleTurn';
import { emit } from './chronicle';
import { DAY_MS, seasonAt } from './clock';
import { nominationReason } from './formations';
import { observeFormation } from './hordePlan';
import { baseRaidComposition, buildDefender, scaledLoss, toHordePosts } from './raidArmy';
import { applyWallDamage, wallForBattle } from './wallRepair';
import { decimal, joinList } from './format';
import { addMoraleEffect } from './morale';
import { ableVillagers, releaseExcessWorkers } from './population';
import {
  isThreatWatched,
  palisadeAgainst,
  palisadeLevel,
  watchtowerLevel,
  watchtowerPerks,
  watchtowerWarningMs,
} from './threat';
import type {
  GameEvent,
  GameState,
  InjuredVillager,
  ProductionBuildingId,
  ResourceId,
  ScheduledRaid,
} from './types';
import { MILLI } from './units';
import { vigilAt } from './vigil';

/**
 * As incursões (GDD §8.2 e §12.3; ADR 0014, decisões 10, 11 e 20): a do roteiro do ano 1, o
 * aviso da Torre de Vigia, a resolução no instante marcado, os feridos e a volta deles.
 *
 * Quem marca uma incursão por Ameaça (e sorteia a composição dela) é a virada do dia
 * (`hordeTurn.ts`); este módulo só cumpre o que está marcado. **O único sorteio daqui é o da
 * batalha** (V4E-T2.3), no fluxo `battle:<id>`, que nasce e morre no instante da incursão
 * (`fightBattle`). As previsões da visão não chegam à resolução e por isso não sorteiam. A regra do que a Paliçada segura é `palisadeAgainst` (`threat.ts`).
 *
 * Uma incursão conta três coisas na Crônica: como chegou (o aviso), o que a defesa fez (e o que
 * o ataque custou) e o que teria mudado o desfecho. Os eventos levam os números: é deles que o
 * Relatório de Retorno tira o que mostrar.
 */

const { raids: rules, threat: threatRules } = balance;

const scriptedAtMs = (def: { atGameDay: number }) => (def.atGameDay - 1) * DAY_MS;
const howlAtMs = (def: ScriptedRaidDef) => (def.howlAtGameDay - 1) * DAY_MS;

/**
 * As incursões do roteiro que uma partida ainda vai receber, em ordem de chegada: as que caem
 * **depois** de `boundaryMs`. Uma partida nova as recebe todas; uma partida que a migração
 * encontra depois do instante de uma delas não a recebe (ADR 0013, decisão 4).
 */
export function scriptedRaidsAfter(boundaryMs: number): ScheduledRaid[] {
  return rules.scripted
    .map((def): ScheduledRaid => ({
      id: def.id,
      atMs: scriptedAtMs(def),
      kind: 'scripted',
      enemy: def.enemy,
      size: def.size,
      announcedAtMs: null,
      composition: null,
    }))
    .filter((raid) => raid.atMs > boundaryMs)
    .sort((a, b) => a.atMs - b.atMs);
}

/** Uma incursão-batalha do roteiro do ano 1, marcada (sem composição: a da estação, sem sorteio). */
function warScriptedRaid(def: (typeof warRaids.scripted)[number], state: GameState): ScheduledRaid {
  return {
    id: def.id,
    atMs: def.rehearsal ? vigilAt(state.settings, scriptedAtMs(def)) : scriptedAtMs(def),
    kind: 'scripted',
    enemy: def.rehearsal ? 'horde' : 'raiders',
    size: def.size,
    announcedAtMs: null,
    composition: null,
  };
}

/**
 * As incursões-batalha do roteiro do ano 1 (V4E-T2.4; ADR 0020, D-11: dias 25, 37 e 61) são
 * marcadas **na virada do dia que fica `threat.raidLeadMs` antes delas**, como uma sorteada, e
 * não na criação: até lá a Ameaça sorteia como sempre. Assim só as recebe a partida que ainda não
 * passou daquele instante (a que a migração encontra dentro da antecedência, o passo 32 → 33
 * marca). As primeiras vêm do Acampamento; o ensaio vem da Horda. O exército é a composição-base da estação.
 * Nada aqui sorteia. A lista fica em ordem de chegada.
 */
export function markScriptedWarRaids(draft: GameState, atMs: number): void {
  const { scheduledRaids } = draft.horde;
  for (const def of warRaids.scripted) {
    if (def.rehearsal && !rehearsalUnmarked(draft, def)) continue;
    const raid = warScriptedRaid(def, draft);
    if (raid.atMs - threatRules.raidLeadMs !== atMs) continue;
    // A tentativa é única, inclusive sem vaga (D-33). Mudar a preferência não repete o ensaio.
    if (def.rehearsal) draft.stats.vigilRehearsalMarked = 1;
    // Uma marcada por vez, como as sorteadas (D-33): com outra incursão marcada, a do roteiro
    // não é marcada e não volta (a partida segue com a que já vinha).
    // O Acampamento tem data própria (V4E-T3): limpar o Covil não impede saqueadores.
    if (scheduledRaids.length === 0) {
      scheduledRaids.push(raid);
    }
  }
  scheduledRaids.sort((a, b) => a.atMs - b.atMs);
}

/**
 * A ordem `setVigilHour` (V4G-T1.4; pendência G-5): se o ensaio ainda não foi marcado e a nova
 * Vigília já deixou a marcação para trás, ele é marcado agora. Uma Vigília que já passou não
 * apaga o ensaio: ele chega com a antecedência de sempre, `raidLeadMs` depois da ordem. Só o
 * ensaio: as outras incursões do roteiro não dependem da Vigília e não são remarcadas aqui.
 */
export function markRehearsalAfterVigilChange(draft: GameState, atMs: number): void {
  const def = warRaids.scripted.find((entry) => entry.rehearsal);
  if (def === undefined || !rehearsalUnmarked(draft, def)) return;
  if (atMs >= scriptedAtMs(def) + vigilRules.windowMs) return;
  const raid = warScriptedRaid(def, draft);
  if (atMs < raid.atMs - threatRules.raidLeadMs) return;
  if (raid.atMs <= atMs) raid.atMs = atMs + threatRules.raidLeadMs;
  draft.stats.vigilRehearsalMarked = 1;
  if (draft.horde.scheduledRaids.length === 0) {
    draft.horde.scheduledRaids.push(raid);
    draft.horde.scheduledRaids.sort((a, b) => a.atMs - b.atMs);
  }
}

/**
 * O ensaio ainda espera a marcação. Quem migrou do estado 34 depois do instante em que a versão
 * antiga o marcaria já teve a tentativa (o passo 34 → 35 grava `stats.vigilRehearsalMarked`).
 */
function rehearsalUnmarked(state: GameState, def: (typeof warRaids.scripted)[number]): boolean {
  return (
    state.stats.vigilRehearsalMarked !== 1 &&
    !state.horde.scheduledRaids.some((raid) => raid.id === def.id)
  );
}

/** A marcação do ensaio pode cair entre viradas de dia; é um instante próprio da linha. */
export function nextRehearsalMarkAt(state: GameState): number | null {
  const def = warRaids.scripted.find((entry) => entry.rehearsal);
  if (def === undefined || !rehearsalUnmarked(state, def)) return null;
  const at = vigilAt(state.settings, scriptedAtMs(def)) - threatRules.raidLeadMs;
  return at > state.lastProcessedAt ? at : null;
}

/**
 * Se a incursão fere aldeões quando passa. Só as do roteiro da guerra podem não ferir
 * (`warRaids.scripted[].injures`; as dos dias 25 e 37, resposta do autor à D-39): o resto fere.
 * A regra é lida pelo id gravado na marcada, sem campo novo no estado.
 */
export function raidInjures(raid: Pick<ScheduledRaid, 'id' | 'kind'>): boolean {
  if (raid.kind !== 'scripted') {
    return true;
  }
  return warRaids.scripted.find((def) => def.id === raid.id)?.injures ?? true;
}

/**
 * O tamanho da v0.2 que serve às frases, à Paliçada e às tabelas antigas: a forte (que a v0.2
 * não tinha) usa as da média, e a perda dela vem de `warRaids.losses.strong`.
 */
export function legacySize(size: WarRaidSizeId): RaidSizeId {
  return size === 'strong' ? 'medium' : size;
}

/** Como os vigias contam um bando deste tamanho. */
export function bandText(enemy: EnemyId, size: WarRaidSizeId): string {
  return size === 'strong'
    ? warRaids.bandSizes[enemy === 'wolves' ? 'wolf' : 'mixed'].strong
    : enemies[enemy].sizes[size];
}

/**
 * O prenúncio das incursões do roteiro: no início do dia marcado, uivos na mata, sem informação
 * nenhuma (nem número, nem tamanho, nem prazo). Só soa para quem ainda vai receber a incursão.
 * A frase muda com a Torre: sem vigias, diz que falta quem vigie.
 */
export function soundHowls(draft: GameState, atMs: number, events: GameEvent[]): void {
  for (const def of rules.scripted) {
    if (howlAtMs(def) !== atMs || !draft.horde.scheduledRaids.some((raid) => raid.id === def.id)) {
      continue;
    }
    const watched = isThreatWatched(draft);
    const { howl } = raidTemplates[def.enemy];
    emit(
      events,
      draft,
      atMs,
      'wolvesHowl',
      { enemy: def.enemy, watched: watched ? 1 : 0 },
      { inimigo: enemies[def.enemy].label },
      watched ? howl.watched : howl.unwatched,
    );
  }
}

/** Como a incursão chega à Crônica: sem ninguém a ver, avistada, ou contada pelos vigias. */
type Warning = 'unwarned' | 'warned' | 'sized';

/** O instante em que a Torre do nível de agora avisa de `raid`; `null` sem Torre. */
function announcementAt(state: GameState, raid: ScheduledRaid): number | null {
  const perks = watchtowerPerks(watchtowerLevel(state));
  return perks === null ? null : raid.atMs - watchtowerWarningMs(state, perks);
}

/**
 * O aviso da Torre de Vigia (GDD §8.2): no instante em que uma incursão marcada entra na
 * antecedência do nível que a Torre tem **agora**, os vigias dão o alarme, uma vez. A Torre
 * que fica pronta (ou sobe de nível) com a incursão já dentro da antecedência avisa nesse
 * mesmo instante, se ainda houver tempo: no instante exato da incursão já não há o que avisar.
 * Sem Torre não há aviso, e a incursão chega sem que ninguém a veja.
 *
 * A antecedência é **tempo real**, a mesma em qualquer ritmo (ADR 0016, item 4), convertida com
 * o ritmo da partida. Quem já foi anunciada (`announcedAtMs`) não é anunciada de novo, mesmo
 * que a antecedência mude: uma partida gravada com a antecedência de antes recebe o alarme que
 * ainda faltava no primeiro instante processado, e nenhum em dobro.
 *
 * O tamanho só sai no evento se a Torre o distingue: é o que os vigias viram.
 */
export function announceRaids(draft: GameState, atMs: number, events: GameEvent[]): void {
  const perks = watchtowerPerks(watchtowerLevel(draft));
  if (perks === null) {
    return;
  }
  const warningMs = watchtowerWarningMs(draft, perks);
  for (const raid of draft.horde.scheduledRaids) {
    if (raid.announcedAtMs !== null || atMs >= raid.atMs || atMs < raid.atMs - warningMs) {
      continue;
    }
    raid.announcedAtMs = atMs;
    const enemy = enemies[raid.enemy];
    const { announced } = raidTemplates[raid.enemy];
    emit(
      events,
      draft,
      atMs,
      'raidAnnounced',
      {
        raidId: raid.id,
        enemy: raid.enemy,
        warning: perks.revealsRaidSize ? 'sized' : 'warned',
        ...(perks.revealsRaidSize ? { size: raid.size } : {}),
      },
      { inimigo: enemy.label, bando: bandText(raid.enemy, raid.size) },
      perks.revealsRaidSize ? announced.sized : announced.warned,
    );
  }
}

/**
 * O próximo instante das incursões na linha do tempo: a chegada da primeira marcada, ou o aviso
 * da Torre para uma que ninguém anunciou ainda. Um aviso que já devia ter saído não entra: quem
 * o dá é o próprio instante em que ele se tornou devido (a obra da Torre que termina, ou o
 * primeiro avanço de uma partida migrada), nunca um instante repetido.
 */
export function nextRaidEventAt(state: GameState): number | null {
  const now = state.lastProcessedAt;
  let soonest: number | null = null;
  const consider = (atMs: number | null) => {
    if (atMs !== null && atMs > now && (soonest === null || atMs < soonest)) {
      soonest = atMs;
    }
  };
  for (const raid of state.horde.scheduledRaids) {
    consider(raid.atMs);
    if (raid.announcedAtMs === null) {
      consider(announcementAt(state, raid));
    }
  }
  return soonest;
}

/**
 * O instante em que o próximo ferido sara; `null` sem feridos. Como o das incursões, só vale
 * se ainda está por vir: um prazo que já passou é cumprido no próximo instante da linha do
 * tempo, nunca em um instante repetido.
 */
export function nextRecoveryAt(state: GameState): number | null {
  const untilMs = state.settlement.injured[0]?.untilMs;
  return untilMs === undefined || untilMs <= state.lastProcessedAt ? null : untilMs;
}

/**
 * Os feridos cujo prazo venceu até `atMs` saram: quem tinha ofício volta ao edifício de onde
 * saiu, já adaptado (o ofício era o dele), e a taxa do edifício muda nesse instante. Um evento
 * por aldeão. A soma dos trabalhadores continua valendo: quem sara volta a contar como braço
 * no mesmo passo em que volta ao ofício.
 */
export function recoverInjured(draft: GameState, atMs: number, events: GameEvent[]): void {
  const { settlement } = draft;
  for (;;) {
    const [healed] = settlement.injured;
    if (healed === undefined || healed.untilMs > atMs) {
      return;
    }
    settlement.injured.shift();
    const { building } = healed;
    if (building !== null) {
      settlement.workers[building] += 1;
    }
    emit(
      events,
      draft,
      atMs,
      'villagerRecovered',
      { injured: settlement.injured.length, ...(building === null ? {} : { building }) },
      { aldeao: villagerName(building) },
      injuryTemplates.villagerRecovered[building === null ? 'idle' : 'worker'],
    );
  }
}

/** "um lenhador", ou "um aldeão sem ofício". */
function villagerName(building: ProductionBuildingId | null): string {
  return building === null ? idleVillager : craftGuilds[building].artisan;
}

/**
 * Fere um aldeão até `untilMs`. Quem está sem ofício é ferido primeiro; se todos trabalham, sai
 * do edifício com mais gente, a começar por quem ainda se adapta (`releaseExcessWorkers`, a
 * mesma regra de quem parte). O ferido guarda o edifício de onde saiu: é para lá que volta.
 */
function injureVillager(draft: GameState, untilMs: number): InjuredVillager {
  const hurt: InjuredVillager = { untilMs, building: null };
  draft.settlement.injured.push(hurt);
  const released = releaseExcessWorkers(draft);
  const [building] = Object.keys(released) as ProductionBuildingId[];
  hurt.building = building ?? null;
  return hurt;
}

/** A parte `ratio × share` de `value`, para baixo: uma conta só, em inteiros. */
function partOf(value: number, ratio: Ratio, share: Ratio): number {
  return Math.floor((value * ratio.num * share.num) / (ratio.den * share.den));
}

const WHOLE: Ratio = { num: 1, den: 1 };

/** O primeiro nível da Paliçada que segura inteira uma incursão deste tamanho; `null` se nenhum. */
function holdingLevel(size: RaidSizeId): number | null {
  const level = threatRules.palisadeLevels.findIndex(
    (_, index) => palisadeAgainst(index + 1, size).kind === 'held',
  );
  return level === -1 ? null : level + 1;
}

/** "18,3 de comida": o que o ataque levou de um recurso, em unidades, com até uma casa. */
function lootText(resource: ResourceId, milli: number): string | null {
  const units = decimal(milli / MILLI, 1);
  return units === '0' ? null : `${units} de ${balance.resources[resource].label.toLowerCase()}`;
}

/** "um aldeão ferido", "2 aldeões feridos". */
function injuredText(count: number): string | null {
  if (count === 0) {
    return null;
  }
  return count === 1 ? injuredLoss.one : injuredLoss.many.replace('{quantidade}', String(count));
}

/** `a < b`, em frações exatas. */
function lessThan(a: Ratio, b: Ratio): boolean {
  return a.num * b.den < b.num * a.den;
}

/**
 * A batalha de uma incursão (V4E-T2.3; GDD §8.2 e §10; ADR 0019, decisão 14): o atacante é a
 * composição marcada (a composição-base da estação, sem sorteio, na incursão que já estava
 * marcada antes do estado 33 e nas do roteiro); o defensor é a Defesa ativa, preenchida com o
 * que o exército tem (`buildDefender`), e, sem formação ativa, só a muralha e as torres. A
 * batalha sorteia no fluxo `battle:<id>` (`fightBattle`), e depois, em ordem: o dano à muralha
 * (`applyWallDamage`), as baixas ao exército, o que a batalha faz aos comandantes
 * (`applyBattleOutcome`: a linha da batalha, ferimentos, experiência, desgaste) e o relatório
 * em `army.reports`, com a formação que lutou.
 *
 * Devolve **a parte da força inimiga que passou**: zero se a defesa venceu ou segurou; na
 * derrota, os pontos de tropa (`warRaids.unitCost`) dos inimigos que sobraram sobre os do
 * começo.
 */
function fightRaid(
  draft: GameState,
  raid: ScheduledRaid,
  atMs: number,
  events: GameEvent[],
): Ratio {
  const composition = raid.composition ?? baseRaidComposition(raid.size, seasonAt(raid.atMs).id);
  const { army } = draft;
  const formation = army.formations.find((entry) => entry.id === army.activeFormationId) ?? null;
  const defender = buildDefender(formation, army.units, (heroId) => {
    const hero = draft.guild.heroes.find((entry) => entry.id === heroId);
    return hero === undefined || nominationReason(hero) !== null ? null : hero.classId;
  });
  const { id, resolution } = fightBattle(draft, {
    mode: 'defense',
    player: defender,
    horde: { posts: toHordePosts(composition) },
    wall: wallForBattle(draft),
    watchtowerLevel: watchtowerLevel(draft),
    heroCapture: balance.difficulties[draft.settings.difficulty].heroCapture,
  });
  const report = buildBattleReport(id, atMs, resolution, formation?.id ?? null);
  applyWallDamage(draft, report, atMs, events);
  let start = 0;
  let left = 0;
  for (const casualty of report.casualties) {
    if (casualty.owner === 'player') {
      const unit = casualty.unit as keyof typeof army.units;
      army.units[unit] = Math.max(0, army.units[unit] - casualty.lost);
      continue;
    }
    const cost = warRaids.unitCost[casualty.unit as keyof typeof warRaids.unitCost];
    start += casualty.start * cost;
    left += Math.max(0, casualty.start - casualty.lost) * cost;
  }
  applyBattleOutcome(draft, report, atMs, events);
  army.reports = [...army.reports, report].slice(-balance.army.reportsKept);
  observeFormation(
    draft,
    Object.values(defender.posts).flatMap((lines) =>
      Object.values(lines).filter((post) => post !== null),
    ),
    atMs,
  );
  if (report.outcome !== 'defeat' || start <= 0 || left <= 0) {
    return { num: 0, den: 1 };
  }
  return { num: left, den: start };
}

/**
 * Resolve uma incursão, uma vez, no instante dela (GDD §8.2). Roda **depois** das obras
 * concluídas do mesmo instante: a Paliçada que fica pronta na hora do ataque já conta.
 *
 * - A Ameaça cai `raidDrop`, repelida a incursão ou sofrida.
 * - **Paliçada que segura** (`held`): `raidRepelled`, sem perda nem ferido.
 * - **Senão**: de cada recurso da lista do conteúdo sai a parte `lossRatio` do estoque, em
 *   milésimos exatos e para baixo; com a Paliçada pequena demais (`breached`), só a parte dela
 *   (`palisadeBreach`) desse estrago, nos recursos e nos feridos. Os feridos largam o ofício por
 *   `injuryMs`. Havendo perda, a moral leva o termo temporário da incursão. `raidSuffered` leva
 *   os totais (`raided_<recurso>`, em unidades, e `injured`), e a frase diz o que teria detido
 *   o ataque.
 *
 * O estoque nunca fica negativo (sai uma parte do que há) e nunca se fere mais gente do que a
 * que pode trabalhar.
 */
function resolveRaid(
  draft: GameState,
  raid: ScheduledRaid,
  atMs: number,
  events: GameEvent[],
): void {
  const { settlement, stats } = draft;
  const level = palisadeLevel(draft);
  const outcome = palisadeAgainst(level, legacySize(raid.size));
  const enemy = enemies[raid.enemy];
  const phrases = raidTemplates[raid.enemy];
  const warning: Warning =
    raid.announcedAtMs === null
      ? 'unwarned'
      : watchtowerPerks(watchtowerLevel(draft))?.revealsRaidSize === true
        ? 'sized'
        : 'warned';

  const previousThreat = draft.map.threat;
  draft.map.threat = Math.max(0, previousThreat - threatRules.raidDrop);

  const data: Record<string, string | number> = {
    raidId: raid.id,
    enemy: raid.enemy,
    size: raid.size,
    warning,
    palisadeLevel: level,
    // A Ameaça só sai em evento para quem tem vigias: sem a Torre ela não sai do servidor.
    ...(isThreatWatched(draft) ? { threat: draft.map.threat, previousThreat } : {}),
  };
  const params = { inimigo: enemy.label, bando: bandText(raid.enemy, raid.size) };

  const passed = fightRaid(draft, raid, atMs, events);
  data.battleId = draft.army.reports[draft.army.reports.length - 1]?.id ?? '';
  if (outcome.kind === 'held' || passed.num === 0) {
    stats.raids_repelled = (stats.raids_repelled ?? 0) + 1;
    emit(
      events,
      draft,
      atMs,
      'raidRepelled',
      data,
      params,
      `${phrases.arrival[warning]} ${phrases.outcome.held}`,
    );
    return;
  }

  const share = outcome.kind === 'breached' ? outcome.share : WHOLE;
  const damage =
    raid.size === 'strong' ? warRaids.losses.strong : rules.damage[raid.enemy][raid.size];
  // A batalha só pode aliviar a regra da v0.2 (ADR 0019, decisão 14): a perda é a do que passou
  // pela defesa, nunca maior que a que a Paliçada deixava passar.
  const battleShare = passed !== null && lessThan(passed, share) ? passed : null;
  const losses: string[] = [];
  let lost = false;
  const scaled = battleShare === null ? null : scaledLoss(raid.size, battleShare);
  for (const resource of damage.resources) {
    const taken =
      scaled === null
        ? partOf(settlement.resources[resource], damage.lossRatio, share)
        : partOf(settlement.resources[resource], scaled.lossRatio, WHOLE);
    if (taken <= 0) {
      continue;
    }
    settlement.resources[resource] -= taken;
    data[`raided_${resource}`] = taken / MILLI;
    lost = true;
    const text = lootText(resource, taken);
    if (text !== null) {
      losses.push(text);
    }
  }
  const injuries = raidInjures(raid)
    ? Math.min(
        scaled === null ? partOf(damage.injuries, WHOLE, share) : scaled.injuries,
        ableVillagers(draft),
      )
    : 0;
  const hurt: InjuredVillager[] = [];
  for (let index = 0; index < injuries; index += 1) {
    hurt.push(injureVillager(draft, atMs + rules.injuryMs));
  }
  data.injured = injuries;
  const injured = injuredText(injuries);
  if (injured !== null) {
    losses.push(injured);
  }
  if (lost || injuries > 0) {
    // Um termo só, com o mesmo id: uma incursão que viesse antes de o anterior vencer o trocaria.
    addMoraleEffect(draft, {
      id: 'raid',
      label: rules.moraleLabel,
      amount: rules.moraleOnLosses,
      untilMs: atMs + rules.moraleLossDays * DAY_MS,
    });
  }
  stats.raids_suffered = (stats.raids_suffered ?? 0) + 1;

  const needed = raid.size === 'strong' ? null : holdingLevel(raid.size);
  if (needed !== null) {
    data.palisadeLevelNeeded = needed;
  }
  const sentences = [
    phrases.arrival[warning],
    losses.length === 0
      ? phrases.outcome.emptyHanded
      : outcome.kind === 'breached'
        ? phrases.outcome.breached
        : phrases.outcome.open,
  ];
  if (needed !== null) {
    sentences.push(needed <= 1 ? phrases.advice.build : phrases.advice.upgrade);
  }
  emit(
    events,
    draft,
    atMs,
    'raidSuffered',
    data,
    { ...params, perda: joinList(losses), ...(needed === null ? {} : { nivel: needed }) },
    sentences.join(' '),
  );
  for (const { building } of hurt) {
    emit(
      events,
      draft,
      atMs,
      'villagerInjured',
      {
        raidId: raid.id,
        injured: settlement.injured.length,
        ...(building === null ? {} : { building }),
      },
      { aldeao: villagerName(building) },
      injuryTemplates.villagerInjured[building === null ? 'idle' : 'worker'],
    );
  }
}

/**
 * As incursões marcadas no instante `atMs`: primeiro o aviso da Torre para as que entraram na
 * antecedência (ou que a Torre recém-concluída passou a ver), depois a resolução das que
 * chegaram, em ordem. Cada incursão é resolvida uma vez e sai da lista.
 */
export function settleRaids(draft: GameState, atMs: number, events: GameEvent[]): void {
  // Depois das obras e da virada do dia, antes do aviso da Torre: a recém-marcada já é visível.
  markScriptedWarRaids(draft, atMs);
  announceRaids(draft, atMs, events);
  const { scheduledRaids } = draft.horde;
  for (;;) {
    const [raid] = scheduledRaids;
    if (raid === undefined || raid.atMs > atMs) {
      return;
    }
    scheduledRaids.shift();
    if (warRaids.scripted.some((def) => def.rehearsal && def.id === raid.id))
      draft.stats.vigilRehearsalMarked = 1;
    resolveRaid(draft, raid, atMs, events);
  }
}
