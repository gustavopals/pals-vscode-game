import {
  balance,
  buildings,
  equipmentTexts,
  guildTexts,
  heroAttributes,
  heroClasses,
  heroStatuses,
  heroTraits,
  injurySeverities,
  ITEM_SLOT_IDS,
  itemRarities,
  itemSlots,
  type Ratio,
  wageArrearsTexts,
} from '@lotg/content';

import { buildingWithArticle } from './construction';
import { type ExpeditionsView, expeditionsView, guildReadyText } from './expeditionsView';
import { expeditionLabel, guildLevel } from './expeditions';
import type { CraftOutlook } from './craftProjection';
import { netRates, producerOf, productionRate, stockBalance } from './economy';
import { storageCapacity } from './storage';
import { decimal, durationText, fillText, plural } from './format';
import {
  canDepart,
  captives,
  classLabel,
  heroFactors,
  heroLimit,
  heroPower,
  isAtHome,
  isBeyondArrears,
  isCaptive,
  itemDefOf,
  namedHeroOf,
  paidHeroes,
  rosterHasRoom,
  servingSinceMs,
  traitLabel,
  wageRate,
} from './heroes';
import type {
  ArrivingHeroView,
  GameState,
  GuildView,
  Hero,
  HeroView,
  Item,
  ItemView,
  WageArrearsView,
} from './types';
import { HOUR_MS, MILLI, realSecondsCeil, SECOND_MS } from './units';
import {
  dismissBlock,
  lingeringDeparture,
  nextDiscontentAt,
  nextWageDepartureAt,
  wageArrearsDurationAt,
} from './wages';

/**
 * Os heróis e o soldo na visão (GDD §9.1; ADR 0017, decisões 3, 5 e 7). Só lê o estado: não
 * sorteia, não dá identificador e não anda o tempo. Tudo o que é prazo ou taxa sai em tempo
 * real, no ritmo `timeScale`.
 */

const { heroes: rules } = balance;

function realSecondsFloor(gameMs: number, timeScale: number): number {
  return Math.max(0, Math.floor(gameMs / timeScale / SECOND_MS));
}

/** " ÷ 10", " × 3", " × 3 ÷ 2", ou nada para o peso inteiro: como o peso entra na conta escrita. */
function weightText({ num, den }: Ratio): string {
  return `${num === 1 ? '' : ` × ${num}`}${den === 1 ? '' : ` ÷ ${den}`}`;
}

/**
 * "(14 de ataque + 16 de defesa + 120 de vida ÷ 10) × 1,08 (Nv2) × 0,8 (descontente) = 36,288":
 * os atributos que o conteúdo pesa, com o peso de cada um, e um termo para cada fator da conta
 * de `heroPower`. O nível aparece sempre; o Descontente, só quando vale.
 */
function powerBreakdown(hero: Hero): string {
  const { attributes } = heroClasses[hero.classId];
  const base = Object.entries(rules.power)
    .map(
      ([attribute, weight]) =>
        `${attributes[attribute as keyof typeof attributes]} de ${
          heroAttributes[attribute as keyof typeof attributes].label
        }${weightText(weight)}`,
    )
    .join(' + ');
  const factors = heroFactors(hero)
    .map(({ ratio, label }) => ` × ${decimal(ratio.num / ratio.den, 3)} (${label})`)
    .join('');
  return `(${base})${factors} = ${decimal(heroPower(hero) / MILLI, 3)}`;
}

/**
 * Um item como a tela o mostra; `null` para o que o conteúdo já não tem. `bonusText` é o ganho
 * de poder em pontos percentuais, o mesmo fator que entra na conta do poder de quem o leva.
 */
function itemView(item: Item): ItemView | null {
  const def = itemDefOf(item);
  if (def === null) {
    return null;
  }
  const { num, den } = def.power;
  return {
    id: item.id,
    label: def.label,
    text: def.text,
    slot: def.slot,
    slotLabel: itemSlots[def.slot].label,
    rarityLabel: itemRarities[def.rarity].label,
    bonusText: fillText(equipmentTexts.bonus, { percentual: decimal(((num - den) * 100) / den) }),
    bonusPercent: ((num - den) * 100) / den,
  };
}

/** "Em recuperação: volta a poder partir em 1 h 10 min", "Em cativeiro desde …", ou o rótulo do estado. */
function statusText(state: GameState, hero: Hero, timeScale: number): string {
  if (hero.status === 'injured' && hero.injury !== null) {
    return fillText(guildTexts.injured, {
      prazo: durationText(realSecondsCeil(hero.injury.untilMs - state.lastProcessedAt, timeScale)),
    });
  }
  if (hero.status === 'captured' && hero.captivity !== null) {
    return fillText(guildTexts.captured, { expedicao: expeditionLabel(hero.captivity.modelId) });
  }
  if (hero.status === 'expedition' && hero.injury !== null) {
    return guildTexts.injuredAway;
  }
  return heroStatuses[hero.status].label;
}

function heroView(state: GameState, hero: Hero, timeScale: number): HeroView {
  const dismissal = dismissBlock(state, hero);
  return {
    id: hero.id,
    name: hero.name,
    classLabel: classLabel(hero),
    level: hero.level,
    xp: hero.xp,
    xpToNext: rules.xpToNext[hero.level - 1] ?? null,
    traits: hero.traits.map((trait) => ({
      label: traitLabel(trait, hero.gender),
      text: heroTraits[trait].text,
    })),
    statusText: statusText(state, hero, timeScale),
    atHome: isAtHome(hero),
    canDepart: canDepart(hero),
    injury:
      hero.injury === null
        ? null
        : {
            severityLabel: injurySeverities[hero.injury.severity].label,
            recoversInSeconds: realSecondsCeil(
              hero.injury.untilMs - state.lastProcessedAt,
              timeScale,
            ),
          },
    captive: isCaptive(hero),
    canDismiss: dismissal === null,
    dismissText:
      dismissal !== null
        ? dismissal.message
        : isCaptive(hero)
          ? guildTexts.dismissCaptive
          : guildTexts.dismiss,
    equipment: ITEM_SLOT_IDS.map((slot) => {
      const item = hero.equipment[slot];
      return {
        slot,
        slotLabel: itemSlots[slot].label,
        item: item === null ? null : itemView(item),
      };
    }),
    power: heroPower(hero) / MILLI,
    powerBreakdown: powerBreakdown(hero),
    // O cativo não recebe soldo (ADR 0017, decisão 3).
    wagePerHour: isCaptive(hero) ? 0 : rules.wagePerHour * timeScale,
    discontent: hero.discontent,
  };
}

/** Um prazo de tempo real do conteúdo, por extenso: "12 h". */
const realText = (realMs: number): string => durationText(realMs / SECOND_MS);

/**
 * O atraso em frases: o que ele é, o que os prazos cobram (em tempo real, como o conteúdo os
 * dá, iguais em qualquer ritmo), quem fica e o que fecha a conta. Os prazos que andam
 * (`discontentInSeconds`, `nextDepartureInSeconds`) ficam fora da frase: a tela os conta.
 *
 * As frases são as de `wageArrearsTexts`, no conteúdo: aqui só se escolhe qual vale e se
 * preenchem as lacunas. A primeira diz a verdade sobre a Mina: com ela parada ninguém recebe;
 * com ela entregando menos do que o soldo, paga-se em parte.
 */
function arrearsText(state: GameState): string {
  const { heroes, wageArrears } = state.guild;
  const { arrears } = rules;
  const texts = wageArrearsTexts;
  const paid = paidHeroes(state);
  const { num, den } = arrears.discontentFactor;
  const values = {
    quantidade: paid,
    herois: plural(paid, 'herói', 'heróis'),
    mina: buildingWithArticle(producerOf('gold')),
    descontente: realText(arrears.discontentAfterRealMs),
    partida: realText(arrears.leaveAfterRealMs),
    passo: realText(arrears.leaveEveryRealMs),
    corte: decimal(((den - num) * 100) / den),
  };
  const mined = productionRate(state, producerOf('gold')) > 0;
  const sentences: string[] = [
    mined ? texts.partlyPaid : paid === 1 ? texts.unpaidOne : texts.unpaidMany,
  ];
  if (heroes.every(isBeyondArrears)) {
    const women = heroes.every((hero) => hero.gender === 'f');
    if (heroes.length === 1) {
      sentences.push(women ? texts.loyalShe : texts.loyalHe);
    } else {
      sentences.push(women ? texts.loyalAllShe : texts.loyalAllHe);
    }
  } else {
    sentences.push(texts.deadlines);
    const started = wageArrears === null ? 0 : wageArrears.sinceMs - wageArrears.carriedMs;
    if (heroes.some((hero) => !isBeyondArrears(hero) && servingSinceMs(hero) > started)) {
      sentences.push(texts.latecomers);
    }
  }
  sentences.push(texts.remedy);
  return fillText(sentences.join(' '), values);
}

function arrearsView(state: GameState, timeScale: number): WageArrearsView | null {
  if (state.guild.wageArrears === null) {
    return null;
  }
  const now = state.lastProcessedAt;
  const until = (atMs: number | null) =>
    atMs === null ? null : realSecondsCeil(atMs - now, timeScale);
  return {
    secondsElapsed: realSecondsFloor(wageArrearsDurationAt(state, now), timeScale),
    text: arrearsText(state),
    discontentInSeconds: until(nextDiscontentAt(state)),
    nextDepartureInSeconds: until(nextWageDepartureAt(state)),
  };
}

/**
 * Por quanto tempo real o ouro ainda paga a equipe: o instante em que o atraso abriria, na
 * projeção do ofício (`CraftOutlook.goldRunsOutIn`). Zero com o atraso aberto; `null` sem herói
 * e quando o ouro não acaba.
 */
function coveredForSeconds(
  state: GameState,
  timeScale: number,
  outlook: CraftOutlook,
): number | null {
  if (state.guild.wageArrears !== null) {
    return 0;
  }
  const { goldRunsOutIn } = outlook;
  return goldRunsOutIn === null ? null : realSecondsFloor(goldRunsOutIn, timeScale);
}

/** O atraso fechado que ainda cobra uma partida na próxima virada (`lingeringDeparture`). */
function lingeringView(state: GameState, timeScale: number): GuildView['wage']['lingering'] {
  const due = lingeringDeparture(state);
  if (due === null) {
    return null;
  }
  return {
    text: fillText(wageArrearsTexts.lingering, { heroi: due.hero.name }),
    departureInSeconds: realSecondsCeil(due.atMs - state.lastProcessedAt, timeScale),
  };
}

/**
 * O soldo depois de chegarem os prometidos que têm instante marcado (`wage.afterArrivals`):
 * quanto a equipe passa a custar e por quanto tempo real o ouro a paga, somando o soldo de cada
 * um a partir do instante em que chega. A conta é pelo **saldo de agora** (o que a Mina entrega
 * hoje), trecho a trecho, em inteiros; se a projeção do ofício já diz que o ouro acaba antes da
 * primeira chegada, vale o prazo dela, o mesmo de `coveredForSeconds`. Quem espera lugar à
 * porta não entra na conta: não tem instante. `null` sem ninguém a caminho.
 */
function afterArrivals(
  state: GameState,
  timeScale: number,
  outlook: CraftOutlook,
): GuildView['wage']['afterArrivals'] {
  const now = state.lastProcessedAt;
  const coming = state.guild.arriving.filter(
    (entry) => entry.atMs > now && namedHeroOf(entry.namedHeroId) !== null,
  );
  if (coming.length === 0) {
    return null;
  }
  const wage = rules.wagePerHour * MILLI;
  const perHour = ((wageRate(state) + coming.length * wage) * timeScale) / MILLI;
  if (state.guild.wageArrears !== null) {
    return { perHour, coveredForSeconds: 0 };
  }
  const first = coming[0]?.atMs ?? now;
  if (outlook.goldRunsOutIn !== null && now + outlook.goldRunsOutIn <= first) {
    return { perHour, coveredForSeconds: realSecondsFloor(outlook.goldRunsOutIn, timeScale) };
  }
  const cap = (storageCapacity(state, 'gold') ?? Infinity) * HOUR_MS;
  let balance = stockBalance(state, 'gold');
  let rate = netRates(state).gold;
  let at = now;
  const runsOutAt = () => (rate < 0 ? at + Math.max(0, Math.floor(balance / -rate)) : Infinity);
  for (const entry of coming) {
    if (runsOutAt() <= entry.atMs) {
      break;
    }
    balance = Math.min(Math.max(balance, cap), balance + rate * (entry.atMs - at));
    rate -= wage;
    at = entry.atMs;
  }
  const out = runsOutAt();
  return {
    perHour,
    coveredForSeconds: out === Infinity ? null : realSecondsFloor(out - now, timeScale),
  };
}

/**
 * Os heróis prometidos, na ordem em que chegam: a promessa de uma carta não é segredo. Quem tem
 * o prazo vencido espera lugar na lista, que está no teto, e a frase diz o que abre o lugar. O
 * que o conteúdo já não tem não aparece: sai da lista sem chegar.
 */
function arrivingView(state: GameState, timeScale: number): ArrivingHeroView[] {
  const now = state.lastProcessedAt;
  const views: ArrivingHeroView[] = [];
  for (const entry of state.guild.arriving) {
    const named = namedHeroOf(entry.namedHeroId);
    if (named === null) {
      continue;
    }
    const waiting = entry.atMs <= now;
    views.push({
      name: named.name,
      classLabel: classLabel(named),
      traits: named.traits.map((trait) => ({
        label: traitLabel(trait, named.gender),
        text: heroTraits[trait].text,
      })),
      arrivesInSeconds: waiting ? 0 : realSecondsCeil(entry.atMs - now, timeScale),
      blockedReason:
        waiting && !rosterHasRoom(state)
          ? fillText(wageArrearsTexts.waitingAtDoor, {
              herois: plural(state.guild.heroes.length, 'herói', 'heróis'),
              heroi: named.name,
            })
          : null,
    });
  }
  return views;
}

/**
 * A frase do alto da aba Guilda, pela equipe: sem herói, como o primeiro chega (ou que há um
 * prometido a caminho); com herói e sem a Guilda dos Aventureiros, o que a abre (o nível do
 * Salão, ou a obra); com ela, quantas expedições sustenta e o que falta para enviar. Só escolhe
 * entre as frases do conteúdo e preenche as lacunas.
 */
function guildText(state: GameState, arriving: ArrivingHeroView[]): string {
  if (state.guild.heroes.length === 0) {
    return arriving.length > 0 ? guildTexts.awaited : guildTexts.noHeroes;
  }
  if (guildLevel(state) > 0) {
    return guildReadyText(state);
  }
  const townHall = buildings.guild.requires.townHall;
  return townHall !== undefined && state.settlement.buildings.townHall < townHall
    ? fillText(guildTexts.guildLocked, { nivel: townHall })
    : guildTexts.guildUnbuilt;
}

/** "Arsenal: 3 de 30 itens.", ou o que acontece com ele vazio ou cheio. */
function inventoryText(state: GameState): string {
  const count = state.guild.inventory.length;
  const cap = balance.equipment.inventoryCap;
  if (count === 0) {
    return equipmentTexts.inventoryEmpty;
  }
  const summary = fillText(equipmentTexts.inventory, { quantidade: count, teto: cap });
  return count >= cap ? `${summary} ${equipmentTexts.inventoryFull}` : summary;
}

/** A visão da Guilda e as decisões que as expedições deixam à espera do jogador. */
export function guildView(
  state: GameState,
  timeScale: number,
  outlook: CraftOutlook,
): { guild: GuildView; pendingDecisions: ExpeditionsView['pendingDecisions'] } {
  const arriving = arrivingView(state, timeScale);
  const { pendingDecisions, ...expeditions } = expeditionsView(state, timeScale);
  const guild: GuildView = {
    text: guildText(state, arriving),
    ...expeditions,
    dismissText: guildTexts.dismiss,
    heroLimit: heroLimit(state),
    heroes: state.guild.heroes.map((hero) => heroView(state, hero, timeScale)),
    arriving,
    inventory: state.guild.inventory.flatMap((item) => itemView(item) ?? []),
    inventoryCap: balance.equipment.inventoryCap,
    inventoryText: inventoryText(state),
    captiveText: captives(state).length > 0 ? guildTexts.captiveNote : null,
    wage: {
      perHour: (wageRate(state) * timeScale) / MILLI,
      coveredForSeconds: coveredForSeconds(state, timeScale, outlook),
      afterArrivals: afterArrivals(state, timeScale, outlook),
      arrears: arrearsView(state, timeScale),
      lingering: lingeringView(state, timeScale),
    },
  };
  return { guild, pendingDecisions };
}
