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
function allocateTo(view: ViewState, resource: Row['id']): LeavingItem['command'] {
  const producer = view.workers.find((row) => row.resource === resource);
  return producer === undefined
    ? { id: 'lords.allocateWorkers', label: 'Alocar trabalhadores' }
    : {
        id: 'lords.allocateWorkers',
        arg: producer.building,
        label: `Alocar na ${producer.label}`,
      };
}

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
    return {
      id: 'food',
      severity: 'danger',
      text: `A fome já dura ${formatApprox(view.famine.secondsElapsed)}: saldo de comida de ${formatRate(food.perHour)}.`,
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

/**
 * A lenha: o frio em andamento, a madeira que acaba no meio do inverno, ou o inverno que chega
 * em menos de um dia sem lenha que baste. Quanto falta é a conta do servidor (`firewood.missing`),
 * que já desconta o que a Serraria repõe.
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
      return {
        id: 'firewood',
        severity: 'danger',
        text: `O frio já dura ${formatApprox(winter.cold.secondsElapsed)}: a lareira pede ${hearth}${missing}.`,
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
      text: `A lenha acaba em ${formatApprox(runsOut)}: a lareira queima ${hearth}${missing}.`,
      command,
    };
  }
  const next = view.calendar.nextSeason;
  const ahead = next.firewood;
  if (ahead === null || ahead.missing <= 0 || next.secondsUntil >= LEAVING_HORIZON_SECONDS) {
    return null;
  }
  const { villagers } = view.population;
  return {
    id: 'firewood',
    severity: 'warning',
    text:
      `${next.label} em ${formatApprox(next.secondsUntil)}: ` +
      `${villagers} ${villagers === 1 ? 'habitante vai' : 'habitantes vão'} queimar ${formatNumber(ahead.perHour)} madeira/h, ` +
      `e faltam ${formatNumber(ahead.missing)} de madeira para a estação inteira.`,
    command,
  };
}

/**
 * Um item por depósito que está cheio e perdendo, ou a menos de uma ausência comum de encher.
 * A madeira e a pedra dividem o Armazém: um item, um botão. Com a obra do depósito em curso e
 * pronta antes de ele encher, o jogador já fez o que havia a fazer: nada a dizer.
 */
function storageItems(view: ViewState): LeavingItem[] {
  const groups = new Map<NonNullable<Row['storageBuilding']>, Row[]>();
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
    const upgrade =
      underway === undefined
        ? view.constructions.available.find((entry) => entry.building === building)
        : undefined;
    items.push({
      id: `storage:${building}`,
      severity: 'warning',
      text: sentences.join(' '),
      // Com a obra travada (falta recurso, falta o Salão) ou já em curso, o botão leva ao feudo:
      // é lá que o aviso do depósito traz o custo, o prazo e o motivo.
      command:
        upgrade !== undefined && upgrade.blockedReason === null
          ? {
              id: 'lords.build',
              arg: building,
              label: `${isNewBuilding(upgrade) ? 'Construir' : 'Ampliar'} ${upgrade.label}`,
            }
          : { id: 'lords.openPanel', arg: 'fief', label: 'Ver os depósitos' },
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
 * O que preparar antes de sair, em até cinco itens, nesta ordem: a comida, a lenha, os depósitos
 * que enchem, as obras que não começam sozinhas e os aldeões livres. Lista vazia: o feudo está
 * preparado para a ausência.
 */
export function beforeLeaving(view: ViewState): LeavingItem[] {
  return [
    foodItem(view),
    firewoodItem(view),
    ...storageItems(view),
    queueItem(view),
    idleItem(view),
  ]
    .filter((item) => item !== null)
    .slice(0, MAX_LEAVING_ITEMS);
}
