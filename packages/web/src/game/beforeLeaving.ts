import type { ViewState } from '@lotg/protocol';

import {
  busyQueues,
  capitalize,
  fillsSoon,
  firewoodRunsOutIn,
  formatApprox,
  formatNumber,
  formatRate,
  FULL_SOON_SECONDS,
  isNewBuilding,
  isWasting,
  joinList,
  runsOutIn,
  runsOutWhy,
  soonestConstruction,
  upgradeName,
} from '../ui/format';
import { palisadeWork, THREAT_SECTION, watchtowerWork } from '../ui/threat';

/**
 * "Antes de partir" (GDD §2.3, passo 4): o que vale resolver antes de fechar a aba, do mais
 * urgente ao menos. Não há regra de jogo aqui: cada frase é montada com prazos, taxas e estoques
 * que o servidor já mandou no `ViewState`, e cada item aponta o comando que resolve.
 */

export type LeavingSeverity = 'danger' | 'warning' | 'info';

export type LeavingItem = {
  /** Estável: um item por assunto (`storage:<edifício>` para cada depósito). */
  id: string;
  severity: LeavingSeverity;
  /** Uma frase curta, com o número e o prazo. */
  text: string;
  /** O que o botão do item faz: um comando de `palette/commands.ts`, com o seu rótulo. */
  command: { id: string; arg?: string; label: string };
};

/** A lista nunca passa disto: é para caber em uma olhada. */
export const MAX_LEAVING_ITEMS = 5;

/**
 * Até onde a lista olha: um dia de relógio. É escolha de apresentação, como o destaque de
 * "cheio em": quem joga uma vez por dia sai sabendo o que acaba antes de voltar. Os prazos já
 * vêm do servidor em tempo real, em qualquer ritmo.
 */
export const LEAVING_HORIZON_SECONDS = 24 * 3600;

type Row = ViewState['resources'][number];

/** O que acaba antes de uma ausência comum é urgente; o que acaba mais tarde, um alerta. */
const urgency = (seconds: number): LeavingSeverity =>
  seconds < FULL_SOON_SECONDS ? 'danger' : 'warning';

/** O comando que leva ao edifício que produz `resource`: "Alocar na Fazenda". */
export function allocateTo(view: ViewState, resource: Row['id']): LeavingItem['command'] {
  const producer = view.workers.find((row) => row.resource === resource);
  return producer === undefined
    ? { id: 'lords.allocateWorkers', label: 'Alocar trabalhadores' }
    : {
        id: 'lords.allocateWorkers',
        arg: producer.building,
        label: `Alocar na ${producer.label}`,
      };
}

/** "na Fazenda", "na Serraria": onde trabalha quem produz `resource`. */
function atProducer(view: ViewState, resource: Row['id']): string {
  const producer = view.workers.find((row) => row.resource === resource);
  return producer === undefined ? 'nos trabalhadores' : `na ${producer.label}`;
}

/**
 * Para a fome e o frio que o servidor já prevê acabarem sozinhos: não há ordem a dar, e o botão
 * leva ao feudo, onde o aviso diz o porquê e o painel mostra quem ainda se adapta.
 */
const SEE_WORKERS: LeavingItem['command'] = {
  id: 'lords.openPanel',
  arg: 'fief',
  label: 'Ver os trabalhadores',
};

/**
 * A fome em andamento, ou a comida que acaba antes de um dia. O prazo atravessa a virada de
 * estação (`runsOutIn`): a comida que cresce no outono e acaba no começo do inverno entra aqui,
 * com a estação que vem, o saldo que ela traz e o prazo, todos da previsão do servidor.
 */
function foodItem(view: ViewState): LeavingItem | null {
  const food = view.resources.find((row) => row.id === 'food');
  if (food === undefined) {
    return null;
  }
  const command = allocateTo(view, 'food');
  if (view.famine !== null) {
    const lasts = `A fome já dura ${formatApprox(view.famine.secondsElapsed)}`;
    if (view.famine.endsInSeconds !== null) {
      // O servidor já prevê o fim: quem chegou à Fazenda ainda se adapta. Pedir mais gente
      // agora só abriria outra adaptação; o item avisa e leva a quem está trabalhando.
      return {
        id: 'food',
        severity: 'warning',
        text: `${lasts}, mas acaba sozinha em ${formatApprox(view.famine.endsInSeconds)}. Não é preciso mexer ${atProducer(view, 'food')}.`,
        command: SEE_WORKERS,
      };
    }
    return {
      id: 'food',
      severity: 'danger',
      text: `${lasts}: saldo de comida de ${formatRate(food.perHour)}.`,
      command,
    };
  }
  const runsOut = runsOutIn(view, food);
  if (runsOut === null || runsOut >= LEAVING_HORIZON_SECONDS) {
    return null;
  }
  const next = view.calendar.nextSeason;
  if (next.food !== null && runsOutWhy(view, food) !== null) {
    return {
      id: 'food',
      severity: urgency(runsOut),
      text:
        `${next.label} em ${formatApprox(next.secondsUntil)}: ` +
        `o saldo de comida passa a ${formatRate(next.food.perHour)}, e ela acaba em ${formatApprox(runsOut)}.`,
      command,
    };
  }
  return {
    id: 'food',
    severity: urgency(runsOut),
    text: `A comida acaba em ${formatApprox(runsOut)}: saldo de ${formatRate(food.perHour)}.`,
    command,
  };
}

type Firewood = NonNullable<ViewState['winter']>['firewood'];
type FirewoodSeason = NonNullable<ViewState['calendar']['nextFirewoodSeason']>;

/**
 * A estação que queima lenha, quando chega antes de uma ausência de um dia e a conta do servidor
 * diz que a madeira não basta; `null` nos outros casos. Vale para a próxima estação e para a que
 * vem depois dela: o prazo e a conta já chegam prontos em `calendar.nextFirewoodSeason`.
 */
export function firewoodSeasonSoon(view: ViewState): FirewoodSeason | null {
  const season = view.calendar.nextFirewoodSeason;
  return season !== null &&
    season.firewood.missing > 0 &&
    season.secondsUntil < LEAVING_HORIZON_SECONDS
    ? season
    : null;
}

/**
 * Por que a conta da lenha não fecha com a madeira que há: o que as obras planejadas que começam
 * sozinhas vão levar do estoque (`firewood.reserved`, da conta do servidor). Vazia sem nenhuma.
 */
function takenByWorks(firewood: Firewood): string {
  return firewood.reserved > 0
    ? ` As obras que começam sozinhas levam ${formatNumber(firewood.reserved)} do estoque.`
    : '';
}

/**
 * A lenha: o frio em andamento, a madeira que acaba no meio do inverno, ou o inverno que chega
 * em menos de um dia sem lenha que baste. Quanto falta é a conta do servidor (`firewood.missing`),
 * que já desconta o que a Serraria repõe e o que as obras automáticas levam.
 */
function firewoodItem(view: ViewState): LeavingItem | null {
  const command = allocateTo(view, 'wood');
  const { winter } = view;
  if (winter !== null) {
    const hearth = `${formatNumber(winter.firewoodPerHour)} madeira/h`;
    const missing =
      winter.firewood.missing > 0
        ? ` e faltam ${formatNumber(winter.firewood.missing)} de madeira para o resto da estação`
        : '';
    if (winter.cold !== null) {
      const lasts = `O frio já dura ${formatApprox(winter.cold.secondsElapsed)}`;
      if (winter.cold.endsInSeconds !== null) {
        return {
          id: 'firewood',
          severity: 'warning',
          text: `${lasts}, mas passa sozinho em ${formatApprox(winter.cold.endsInSeconds)}. Não é preciso mexer ${atProducer(view, 'wood')}.`,
          command: SEE_WORKERS,
        };
      }
      return {
        id: 'firewood',
        severity: 'danger',
        text: `${lasts}: a lareira pede ${hearth}${missing}.`,
        command,
      };
    }
    const runsOut = firewoodRunsOutIn(view);
    if (runsOut === null || runsOut >= LEAVING_HORIZON_SECONDS) {
      return null;
    }
    return {
      id: 'firewood',
      severity: urgency(runsOut),
      text: `A lenha acaba em ${formatApprox(runsOut)}: a lareira queima ${hearth}${missing}.${takenByWorks(winter.firewood)}`,
      command,
    };
  }
  // A estação da lenha pode não ser a próxima: no ritmo Rápido o outono dura menos de um dia de
  // relógio, e quem sai no fim do verão volta com o inverno pela metade.
  const season = firewoodSeasonSoon(view);
  if (season === null) {
    return null;
  }
  const ahead = season.firewood;
  const { villagers } = view.population;
  return {
    id: 'firewood',
    severity: 'warning',
    text:
      `${season.label} em ${formatApprox(season.secondsUntil)}: ` +
      `${villagers} ${villagers === 1 ? 'habitante vai' : 'habitantes vão'} queimar ${formatNumber(ahead.perHour)} madeira/h, ` +
      `e faltam ${formatNumber(ahead.missing)} de madeira para a estação inteira.${takenByWorks(ahead)}`,
    command,
  };
}

type StorageBuilding = NonNullable<Row['storageBuilding']>;

/**
 * O que o botão de um depósito faz: erguer ou ampliar o edifício, quando a obra é oferecida e
 * nada a trava. Com a obra travada (falta recurso, falta o Salão) ou já em curso, o botão leva ao
 * feudo: é lá que o aviso do depósito traz o custo, o prazo e o motivo.
 */
export function storageCommand(view: ViewState, building: StorageBuilding): LeavingItem['command'] {
  const underway = busyQueues(view.constructions).some((queue) => queue.building === building);
  const upgrade = underway
    ? undefined
    : view.constructions.available.find((entry) => entry.building === building);
  return upgrade !== undefined && upgrade.blockedReason === null
    ? {
        id: 'lords.build',
        arg: building,
        label: `${isNewBuilding(upgrade) ? 'Construir' : 'Ampliar'} ${upgrade.label}`,
      }
    : { id: 'lords.openPanel', arg: 'fief', label: 'Ver os depósitos' };
}

/**
 * Um item por depósito que está cheio e perdendo, ou a menos de uma ausência comum de encher.
 * A madeira e a pedra dividem o Armazém: um item, um botão. Com a obra do depósito em curso e
 * pronta antes de ele encher, o jogador já fez o que havia a fazer: nada a dizer.
 */
function storageItems(view: ViewState): LeavingItem[] {
  const groups = new Map<StorageBuilding, Row[]>();
  for (const row of view.resources) {
    if (row.storageBuilding !== null && (isWasting(row) || fillsSoon(row))) {
      groups.set(row.storageBuilding, [...(groups.get(row.storageBuilding) ?? []), row]);
    }
  }
  const items: LeavingItem[] = [];
  for (const [building, rows] of groups) {
    const place = rows[0]?.storageLabel ?? 'Depósito';
    const wasting = rows.filter(isWasting);
    const filling = rows.filter((row) => !isWasting(row));
    const underway = busyQueues(view.constructions).find((queue) => queue.building === building);
    const soonestFill = Math.min(...filling.map((row) => row.fullInSeconds ?? 0));
    if (underway !== undefined && wasting.length === 0 && underway.secondsRemaining < soonestFill) {
      continue;
    }
    const sentences: string[] = [];
    if (wasting.length > 0) {
      const lost = wasting.map(
        (row) => `${formatNumber(row.wastingPerHour)}/h de ${row.label.toLowerCase()}`,
      );
      sentences.push(`${place} no limite: ${joinList(lost)} vão ao chão.`);
    }
    if (filling.length > 0) {
      const soon = joinList(
        filling.map(
          (row) =>
            `${row.label.toLowerCase()} no limite em ${formatApprox(row.fullInSeconds ?? 0)}`,
        ),
      );
      sentences.push(
        `${wasting.length > 0 ? capitalize(soon) : `${place}: ${soon}`}. O que passar disso vai ao chão.`,
      );
    }
    if (underway !== undefined) {
      sentences.push(
        `A obra de ${underway.label} termina em ${formatApprox(underway.secondsRemaining)}.`,
      );
    }
    items.push({
      id: `storage:${building}`,
      severity: 'warning',
      text: sentences.join(' '),
      command: storageCommand(view, building),
    });
  }
  return items;
}

/**
 * Os pedreiros na ausência: uma fila livre, ou prestes a ficar livre, sem nenhuma planejada que
 * comece sozinha. Uma automática que espera algo que chega (recurso, fila, outra obra) é o feudo
 * preparado; uma que espera o que esperar não resolve (não cabe no depósito, falta o Salão) não
 * vai começar, e o item diz o que a trava.
 */
function queueItem(view: ViewState): LeavingItem | null {
  const { constructions } = view;
  const autos = constructions.planned.filter((plan) => plan.autoStart);
  if (autos.some((plan) => plan.waiting === null || plan.waiting.etaSeconds !== null)) {
    return null;
  }
  const stuck = autos[0];
  if (stuck !== undefined && stuck.waiting !== null) {
    return {
      id: 'queue',
      severity: 'info',
      text: `${upgradeName(stuck)} não começa sozinha (${stuck.waiting.text}).`,
      command: { id: 'lords.openPanel', arg: 'fief', label: 'Ver as planejadas' },
    };
  }
  const manual = constructions.planned.length;
  const offered = constructions.available.some((upgrade) => !upgrade.planned);
  if (manual === 0 && !offered) {
    // Nada planejado e nada a planejar: não há ação possível.
    return null;
  }
  const command: LeavingItem['command'] =
    manual > 0
      ? { id: 'lords.toggleAutoStart', label: 'Ligar o início automático' }
      : { id: 'lords.planConstruction', label: 'Planejar obras' };
  const none =
    manual === 0
      ? 'nenhuma obra começa sozinha'
      : manual === 1
        ? 'a obra planejada não começa sozinha'
        : `nenhuma das ${manual} obras planejadas começa sozinha`;
  const busy = busyQueues(constructions);
  if (busy.length < constructions.queues.length) {
    return {
      id: 'queue',
      severity: 'info',
      text:
        busy.length === 0
          ? `Os pedreiros estão livres e ${none}.`
          : `Há uma fila de obras livre e ${none}.`,
      command,
    };
  }
  const soonest = soonestConstruction(constructions);
  if (soonest === null || soonest.secondsRemaining >= FULL_SOON_SECONDS) {
    return null;
  }
  return {
    id: 'queue',
    severity: 'info',
    text: `A obra de ${soonest.label} termina em ${formatApprox(soonest.secondsRemaining)} e ${
      manual === 0 ? 'nenhuma começa depois dela' : none
    }.`,
    command,
  };
}

/**
 * O que fazer a respeito de um ataque, pelo que a visão diz das duas obras da Ameaça (GDD §8.2 e
 * §12.3): a Paliçada, quando a obra dela pode começar agora, porque é ela que muda o desfecho;
 * sem isso, a Torre de Vigia, que faz o próximo ataque ser visto antes; e, se nenhuma das duas
 * pode ser ordenada (em curso, travada, no teto desta versão), o caminho para o painel da Ameaça,
 * onde estão o custo e o motivo: o botão leva a página e o foco até ele. É o botão do item de
 * "Antes de partir" e o da incursão sofrida no Relatório de Retorno.
 */
export function defenseCommand(view: ViewState): LeavingItem['command'] {
  const fence = palisadeWork(view);
  // Com a Paliçada em obras, o que havia a fazer está feito: resta ver se ela fica pronta a tempo.
  const works = fence.kind === 'underway' ? [] : [fence, watchtowerWork(view)];
  for (const work of works) {
    if (work.kind === 'available' && work.upgrade.blockedReason === null) {
      const { upgrade } = work;
      return {
        id: 'lords.build',
        arg: upgrade.building,
        label: `${isNewBuilding(upgrade) ? 'Construir' : 'Melhorar'} ${upgrade.label}`,
      };
    }
  }
  return { id: 'lords.openPanel', arg: THREAT_SECTION, label: 'Ver a defesa' };
}

/**
 * A incursão que os vigias avistaram: chega antes de qualquer ausência, e por isso abre a lista.
 * A frase é a do servidor (o aviso e o que a Paliçada faz a este ataque), com o prazo; o botão é
 * o da defesa. Só existe para quem tem a Torre de Vigia: sem ela a visão não traz incursão
 * nenhuma, e a lista não inventa uma.
 */
function raidItem(view: ViewState): LeavingItem | null {
  const { incoming } = view.threat;
  if (incoming === null) {
    return null;
  }
  return {
    id: 'raid',
    severity: 'warning',
    text: `${incoming.text} Chegada em ${formatApprox(incoming.inSeconds)}. ${incoming.defenseText}`,
    command: defenseCommand(view),
  };
}

/** Quem está sem ofício não produz nada enquanto o jogador está longe. */
function idleItem(view: ViewState): LeavingItem | null {
  const { free } = view.population;
  if (free <= 0) {
    return null;
  }
  return {
    id: 'idle',
    severity: 'info',
    text: `${free} ${free === 1 ? 'aldeão livre' : 'aldeões livres'}, sem ofício.`,
    command: { id: 'lords.allocateWorkers', label: 'Alocar trabalhadores' },
  };
}

/**
 * Tudo o que há a preparar, sem o limite de linhas, nesta ordem: a incursão à vista, a comida, a
 * lenha, os depósitos que enchem, as obras que não começam sozinhas e os aldeões livres. O
 * Relatório de Retorno tira daqui a próxima ação de cada perda e o que ainda espera uma decisão.
 */
export function leavingItems(view: ViewState): LeavingItem[] {
  return [
    raidItem(view),
    foodItem(view),
    firewoodItem(view),
    ...storageItems(view),
    queueItem(view),
    idleItem(view),
  ].filter((item) => item !== null);
}

/**
 * O que preparar antes de sair, em até cinco itens, na ordem de `leavingItems`. Lista vazia: o
 * feudo está preparado para a ausência. `skip` são os assuntos que o Relatório de Retorno, logo
 * acima, já trouxe com o mesmo botão: a aba não diz duas vezes a mesma coisa.
 */
export function beforeLeaving(view: ViewState, skip: readonly string[] = []): LeavingItem[] {
  return leavingItems(view)
    .filter((item) => !skip.includes(item.id))
    .slice(0, MAX_LEAVING_ITEMS);
}
