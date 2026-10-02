import {
  CHRONICLE_HIDDEN_EVENT_TYPES,
  type GameEvent,
  type ReturnReport,
  type ReturnReportItem,
  type ViewState,
} from '@lotg/protocol';

import { cardDeadline, expiresSoon } from '../ui/council';
import { formatNumber, joinList } from '../ui/format';
import { peopleMoved } from '../ui/morale';
import { allocateTo, type LeavingItem, leavingItems, storageCommand } from './beforeLeaving';

/** O Relatório de Retorno aparece depois de 4 horas ou mais de ausência (GDD §2.3). */
export const RETURN_REPORT_AFTER_MS = 4 * 60 * 60 * 1000;

export function shouldShowReturnReport(lastSeenAt: number | null, now: number): boolean {
  return lastSeenAt !== null && now - lastSeenAt >= RETURN_REPORT_AFTER_MS;
}

/** O evento conta para a Crônica; os outros só servem de número ao relatório (ADRs 0007 e 0015). */
export function isChronicleEvent(event: GameEvent): boolean {
  return !(CHRONICLE_HIDDEN_EVENT_TYPES as readonly string[]).includes(event.type);
}

/** Uma casa decimal: as somas de totais fracionários não mostram ruído de ponto flutuante. */
const tidy = (value: number) => Math.round(value * 10) / 10;

/**
 * A soma de um total que os eventos trazem em `data`, em unidades: `spent_wood`, `gained_food`,
 * `wasted_stone`. Quem calcula é o motor; aqui só se soma o que veio.
 */
function total(events: GameEvent[], key: string): number {
  return tidy(
    events.reduce((sum, event) => {
      const value = event.data[key];
      return typeof value === 'number' ? sum + value : sum;
    }, 0),
  );
}

/** O número e a faixa da moral de uma visão, como o relatório os guarda. */
function moraleLevel(view: ViewState) {
  const { value, band, bandLabel } = view.morale;
  return { value, band, bandLabel };
}

type Counts = ReturnReport['counts'];
type ResourceRow = ViewState['resources'][number];
type StorageBuilding = NonNullable<ResourceRow['storageBuilding']>;

/** Os três blocos do Relatório de Retorno (roadmap da v0.2, V2D-T4). */
export type ReportBlocks = NonNullable<ReturnReport['blocks']>;

/** O botão de um item do relatório, a partir do comando de um item de "Antes de partir". */
const toAction = (command: LeavingItem['command']): NonNullable<ReturnReportItem['action']> => ({
  command: command.id,
  ...(command.arg === undefined ? {} : { arg: command.arg }),
  label: command.label,
});

/**
 * A próxima ação de uma perda, pelo assunto dela e com a visão de agora (V2D-T4.2). Reaproveita
 * "Antes de partir": se o assunto ainda pede preparo (a fome continua, o depósito segue cheio), o
 * botão é o mesmo de lá. Se já não pede, vale o caminho que evita a próxima: a Fazenda, a
 * Serraria, a obra do depósito, a conta da moral, a mesa do conselho.
 */
export function costAction(
  view: ViewState,
  topic: string,
): NonNullable<ReturnReportItem['action']> {
  const leaving = leavingItems(view).find((item) => item.id === topic);
  if (leaving !== undefined) {
    return toAction(leaving.command);
  }
  if (topic === 'food') {
    return toAction(allocateTo(view, 'food'));
  }
  if (topic === 'firewood') {
    return toAction(allocateTo(view, 'wood'));
  }
  if (topic.startsWith('storage:')) {
    const building = topic.slice('storage:'.length);
    const known = view.resources.some((row) => row.storageBuilding === building);
    if (known) {
      return toAction(storageCommand(view, building as StorageBuilding));
    }
    return { command: 'lords.openPanel', arg: 'fief', label: 'Ver os depósitos' };
  }
  if (topic === 'council') {
    // A carta que expirou já foi decidida; o que se pode fazer é não deixar a próxima expirar.
    const waiting = view.pendingDecisions.length;
    return {
      command: 'lords.openPanel',
      arg: 'council',
      label:
        waiting === 0
          ? 'Ver o Conselho'
          : waiting === 1
            ? 'Decidir a carta à espera'
            : 'Decidir as cartas à espera',
    };
  }
  return { command: 'lords.openPanel', arg: 'fief', label: 'Ver a moral' };
}

/**
 * "Você ainda pode decidir", com a visão de agora: as cartas do Conselho à espera, da que vence
 * primeiro à última (a ordem da visão), cada uma com o prazo em tempo real e, quando é a
 * continuação de outra, a frase do servidor que lembra a escolha; depois as obras que não
 * começam sozinhas e os aldeões livres, nas frases e com os botões de "Antes de partir".
 */
export function pendingItems(view: ViewState, elapsedSeconds = 0): ReturnReportItem[] {
  const cards = view.pendingDecisions.map((decision): ReturnReportItem => {
    const follows = view.council.pending.find((card) => card.instanceId === decision.id)
      ?.followsFrom?.text;
    return {
      text:
        `Conselho: “${decision.title}” · ${cardDeadline(decision, elapsedSeconds)}.` +
        (follows === undefined ? '' : ` ${follows}`),
      topic: `card:${decision.id}`,
      // O prazo que acaba antes de uma ausência comum ganha o sinal de aviso; os outros não
      // têm urgência a dizer.
      ...(expiresSoon(decision, elapsedSeconds) ? { severity: 'warning' as const } : {}),
      action: { command: 'lords.openPanel', arg: 'council', label: 'Decidir' },
    };
  });
  const works = leavingItems(view)
    .filter((item) => item.id === 'queue' || item.id === 'idle')
    .map((item): ReturnReportItem => ({
      text: item.text,
      topic: item.id,
      severity: item.severity,
      action: toAction(item.command),
    }));
  return [...cards, ...works];
}

/** O efeito escondido de uma carta tirou algo do feudo: estoque, um ganho cortado, moral. */
function tookSomething(event: GameEvent): boolean {
  return Object.entries(event.data).some(
    ([key, value]) =>
      typeof value === 'number' &&
      ((value > 0 && (key.startsWith('spent_') || key.startsWith('lost_'))) ||
        (key === 'morale' && value < 0)),
  );
}

/** A faixa da moral mudou para pior: o evento traz a moral de antes e a de depois. */
function moraleFell(event: GameEvent): boolean {
  const { morale, previousMorale } = event.data;
  return (
    typeof morale === 'number' && typeof previousMorale === 'number' && morale < previousMorale
  );
}

/** Em que bloco um evento cai, e com que assunto; `null` para o que não é desfecho. */
function placeOf(event: GameEvent): { block: 'prospered' | 'cost'; topic: string } | null {
  switch (event.type) {
    // A obra concluída, o edifício erguido e a planejada que começou sozinha: o feudo trabalhou
    // sem o senhor.
    case 'constructionFinished':
    case 'buildingFounded':
    case 'constructionAutoStarted':
      return { block: 'prospered', topic: 'construction' };
    case 'craftMastered':
      return { block: 'prospered', topic: 'craft' };
    case 'objectiveCompleted':
      return { block: 'prospered', topic: 'objective' };
    case 'famineEnded':
      return { block: 'prospered', topic: 'food' };
    case 'coldEnded':
      return { block: 'prospered', topic: 'firewood' };
    case 'famineStarted':
      return { block: 'cost', topic: 'food' };
    case 'coldStarted':
      return { block: 'cost', topic: 'firewood' };
    case 'moraleBandChanged':
      return { block: moraleFell(event) ? 'cost' : 'prospered', topic: 'morale' };
    // O conselho decidiu sozinho: a frase diz o que ele fez. O preço é a decisão que se perdeu.
    case 'cardExpired':
      return { block: 'cost', topic: 'council' };
    // O que uma escolha antiga escondia: bom ou ruim, pelo que o evento diz que ela mexeu.
    case 'cardEffectApplied':
      return { block: tookSomething(event) ? 'cost' : 'prospered', topic: 'council' };
    default:
      // Viradas de estação e de ano, ordens dadas em outro navegador e cartas que chegaram não
      // são desfechos: ficam na Crônica da ausência. Gente e depósitos entram somados, abaixo.
      return null;
  }
}

const positive = (value: unknown): boolean => typeof value === 'number' && value > 0;

/** Um item com a posição dele na ausência: a sequência do primeiro evento que o conta. */
type Placed = { at: number; item: ReturnReportItem };

const byTime = (entries: Placed[]): ReturnReportItem[] =>
  [...entries].sort((a, b) => a.at - b.at).map((entry) => entry.item);

/** A sequência do primeiro evento de um destes tipos; depois de todos, se não houve nenhum. */
function firstSeq(events: GameEvent[], matches: (event: GameEvent) => boolean): number {
  return events.find(matches)?.seq ?? Number.MAX_SAFE_INTEGER;
}

/**
 * O que foi ao chão por falta de espaço, uma linha por depósito (a madeira e a pedra dividem o
 * Pátio e o Armazém), com o total de cada recurso e o nome que o lugar tem hoje. Os números são
 * os da tabela de estoques: os fechos diários do servidor somados, nunca uma linha por dia.
 */
function wasteItems(view: ViewState, wasted: Map<string, number>, events: GameEvent[]): Placed[] {
  const groups = new Map<StorageBuilding, ResourceRow[]>();
  for (const row of view.resources) {
    if (row.storageBuilding !== null && (wasted.get(row.id) ?? 0) > 0) {
      groups.set(row.storageBuilding, [...(groups.get(row.storageBuilding) ?? []), row]);
    }
  }
  return [...groups].map(([building, rows]) => {
    const place = rows[0]?.storageLabel ?? 'Depósito';
    const lost = rows.map(
      (row) => `${formatNumber(wasted.get(row.id) ?? 0)} de ${row.label.toLowerCase()}`,
    );
    const one = rows.length === 1 && wasted.get(rows[0]?.id ?? '') === 1;
    const ids = rows.map((row) => row.id);
    return {
      // Logo depois do evento em que a perda começou: a frase dele, se tiver uma, vem antes.
      at:
        firstSeq(
          events,
          (event) =>
            (event.type === 'storageFilled' && event.data.building === building) ||
            // O fecho diário do que a produção perdeu, ou a recompensa que o depósito cortou.
            ids.some(
              (id) => positive(event.data[`wasted_${id}`]) || positive(event.data[`lost_${id}`]),
            ),
        ) + 0.5,
      item: {
        text: `${place} sem espaço: ${joinList(lost)} ${one ? 'foi' : 'foram'} ao chão.`,
        topic: `storage:${building}`,
        severity: 'warning',
        action: costAction(view, `storage:${building}`),
      },
    };
  });
}

/**
 * Separa a ausência nos três blocos (V2D-T4.1). Só agrupa o que o servidor mandou:
 *
 * - **O feudo prosperou:** obras concluídas e edifícios erguidos, planejadas que começaram
 *   sozinhas, recrutas e colonos que chegaram (somados, uma linha cada), ofícios dominados,
 *   objetivos cumpridos, a fome e o frio que acabaram, a moral que subiu de faixa e o efeito
 *   escondido de uma carta, quando ele não tirou nada.
 * - **O que exigiu um preço:** a fome e o frio que começaram, quem desertou e quem partiu
 *   (somados), a moral que desceu de faixa, as cartas que o conselho decidiu sozinho, o efeito
 *   escondido que cobrou algo, e o que foi ao chão por falta de espaço, uma linha por depósito.
 *   Cada item traz a próxima ação (`costAction`). A fome e o frio que já vinham de antes e não
 *   pararam ganham uma linha cada, sem número: o de agora está no aviso do alto da aba e em
 *   "Antes de partir".
 * - **Você ainda pode decidir:** `pendingItems`, com a visão de agora.
 *
 * As frases dos eventos são as da Crônica. Dentro de cada bloco a ordem é a dos acontecimentos;
 * o que é soma fica onde aconteceu o primeiro.
 */
export function buildBlocks(
  after: ViewState,
  events: GameEvent[],
  counts: Counts,
  wasted: Map<string, number>,
): ReportBlocks {
  const prospered: Placed[] = [];
  const cost: Placed[] = [];
  const price = (at: number, text: string, topic: string) =>
    cost.push({
      at,
      item: { text, topic, severity: 'warning', action: costAction(after, topic) },
    });

  const waste = wasteItems(after, wasted, events);
  const wasting = new Set(waste.map((entry) => entry.item.topic));
  cost.push(...waste);

  for (const event of events) {
    const place = placeOf(event);
    if (place?.block === 'prospered') {
      prospered.push({ at: event.seq, item: { text: event.text, topic: place.topic } });
    } else if (place?.block === 'cost') {
      price(event.seq, event.text, place.topic);
    } else if (event.type === 'storageFilled') {
      // O depósito encheu e nada se perdeu ainda: a frase da Crônica avisa. Com perda, a linha
      // do depósito, acima, já diz mais.
      const topic = `storage:${String(event.data.building)}`;
      if (!wasting.has(topic)) {
        price(event.seq, event.text, topic);
      }
    }
  }

  // A gente que chegou e que se foi: uma linha por motivo, com a soma.
  const people = peopleMoved(counts);
  const seqOf = (type: GameEvent['type']) => firstSeq(events, (event) => event.type === type);
  if (people.recruits !== null) {
    prospered.push({
      at: seqOf('recruitmentFinished'),
      item: { text: people.recruits, topic: 'people' },
    });
  }
  if (people.settlers !== null) {
    prospered.push({
      at: seqOf('villagerArrived'),
      item: { text: people.settlers, topic: 'people' },
    });
  }
  if (people.deserted !== null) {
    price(seqOf('villagerDeserted'), people.deserted, 'food');
  }
  if (people.left !== null) {
    price(seqOf('villagerLeft'), people.left, 'morale');
  }

  // A fome e o frio que já vinham de antes da saída e não pararam: nenhum evento da ausência os
  // conta, e sem esta linha o bloco diria que nada se perdeu. O número de agora (há quanto
  // tempo, com que saldo) fica com o aviso do alto da aba e com "Antes de partir".
  const started = (type: GameEvent['type']) => events.some((event) => event.type === type);
  if (after.famine !== null && !started('famineStarted')) {
    price(0, 'A fome continuou durante toda a sua ausência.', 'food');
  }
  if (after.winter !== null && after.winter.cold !== null && !started('coldStarted')) {
    price(0, 'O frio continuou durante toda a sua ausência.', 'firewood');
  }

  return { prospered: byTime(prospered), cost: byTime(cost), pending: pendingItems(after) };
}

/**
 * Os blocos como a aba Hoje os mostra agora. O que prosperou e o que custou são da ausência e
 * não mudam; as ações e o que ainda espera decisão são refeitos com a visão de agora: a carta já
 * respondida sai da lista, e o botão de uma perda acompanha o feudo (a obra do depósito que já
 * começou vira "Ver os depósitos"). Um relatório sem blocos (montado por quem não os preenche)
 * fica só com o que a visão diz.
 */
export function currentBlocks(
  report: ReturnReport,
  view: ViewState,
  elapsedSeconds = 0,
): ReportBlocks {
  return {
    prospered: report.blocks?.prospered ?? [],
    cost: (report.blocks?.cost ?? []).map((item) =>
      item.topic === undefined ? item : { ...item, action: costAction(view, item.topic) },
    ),
    pending: pendingItems(view, elapsedSeconds),
  };
}

/**
 * Os assuntos de "Antes de partir" que o relatório já traz, com a mesma frase e o mesmo botão,
 * em "Você ainda pode decidir": a seção, logo abaixo, não os repete. O que custou não entra
 * aqui: o relatório conta o que se perdeu na ausência, e "Antes de partir", o que está
 * acontecendo agora (o depósito que segue cheio, a comida que vai acabar).
 */
export function coveredTopics(blocks: ReportBlocks): string[] {
  return blocks.pending.flatMap((item) => (item.topic === undefined ? [] : [item.topic]));
}

/**
 * Resume o que aconteceu na ausência: quanto cada estoque mudou entre a última visita e agora
 * e o que os eventos contam. Só soma e conta o que o servidor mandou; nenhuma regra de jogo.
 *
 * A variação de estoque não é produção: obras e recrutamento gastam, recompensas e devoluções
 * entram, e o que não coube no depósito nunca chegou ao estoque. Cada linha separa essas partes
 * pelos totais dos eventos da ausência:
 *
 * - `spent`: o que foi pago (`spent_<recurso>`);
 * - `received`: o que entrou por recompensa e devolução (`gained_<recurso>`);
 * - `cut`: o que essas recompensas e devoluções perderam por não caber no depósito
 *   (`lost_<recurso>`, no evento do próprio ganho). Quem mostra o relatório soma `cut` a
 *   `received` para dizer a recompensa inteira, e o tira do perdido para saber quanto dele foi
 *   produção que não coube;
 * - `wasted`: o que foi ao chão. Os fechos diários (`storageWasted`, um por dia de jogo, com
 *   unidades inteiras) mais o que a visão de agora ainda não relatou (`wastedToday`), menos o
 *   que a visão de antes já contava como perdido: o primeiro fecho da ausência inclui essa
 *   parte. Nunca menos que `cut`: os fechos contam unidades inteiras, e o corte vem com a fração;
 * - `produced`: o saldo da produção e do consumo, que é a variação mais o gasto menos o recebido.
 *
 * A população que a moral e a fome moveram é contada pelos eventos, e a moral é a das duas
 * visões: o relatório diz a faixa em que o feudo está e de onde ela veio.
 *
 * Sem a visão da última visita (`before` nula: o cache era de outra versão do app), o relatório
 * sai sem as linhas de estoque. Repetir o estoque de agora como "antes" diria que nada mudou.
 *
 * Os mesmos eventos saem agrupados em três blocos (`buildBlocks`), para a ausência ser lida de
 * uma vez.
 */
export function buildReturnReport(
  before: ViewState | null,
  after: ViewState,
  events: GameEvent[],
  awayMs: number,
): ReturnReport {
  const count = (...types: GameEvent['type'][]) =>
    events.filter((event) => types.includes(event.type)).length;
  const started = count('famineStarted') > 0;
  const ended = count('famineEnded') > 0;
  let famine: ReturnReport['famine'] = 'none';
  if (after.famine !== null) {
    famine = started ? 'started' : 'ongoing';
  } else if (ended) {
    famine = 'ended';
  }
  const resources: ReturnReport['resources'] =
    before === null
      ? []
      : after.resources.map((row) => {
          const previous = before.resources.find((entry) => entry.id === row.id);
          const stockBefore = previous?.stock ?? row.stock;
          const delta = row.stock - stockBefore;
          const spent = total(events, `spent_${row.id}`);
          const received = total(events, `gained_${row.id}`);
          const cut = total(events, `lost_${row.id}`);
          const wasted = Math.max(
            cut,
            tidy(
              total(events, `wasted_${row.id}`) + row.wastedToday - (previous?.wastedToday ?? 0),
            ),
          );
          return {
            id: row.id,
            label: row.label,
            before: stockBefore,
            after: row.stock,
            delta,
            spent,
            received,
            cut,
            wasted,
            produced: tidy(delta + spent - received),
          };
        });
  const counts: Counts = {
    daysPassed: count('dayStarted'),
    // Um edifício erguido do zero sai como `buildingFounded`, no lugar de `constructionFinished`.
    constructionsFinished: count('constructionFinished', 'buildingFounded'),
    villagersArrived: count('recruitmentFinished'),
    objectivesCompleted: count('objectiveCompleted'),
    // A gente que a moral e a fome moveram (GDD §5.6 e §5.7), separada dos recrutados: o
    // colono que veio sozinho, o aldeão que partiu e o que desertou.
    settlersArrived: count('villagerArrived'),
    villagersLeft: count('villagerLeft'),
    villagersDeserted: count('villagerDeserted'),
  };
  // O que foi ao chão, por recurso: o número da tabela. Sem a visão da última visita não há
  // tabela, e vale a soma dos fechos diários (o contador de hoje pode ser de antes da saída).
  const wasted = new Map<string, number>(
    before === null
      ? after.resources.map((row) => [row.id, total(events, `wasted_${row.id}`)])
      : resources.map((row) => [row.id, row.wasted ?? 0]),
  );
  return {
    awaySeconds: Math.max(0, Math.floor(awayMs / 1000)),
    resources,
    counts,
    // A moral na volta e a da última visita, quando há a visão guardada para comparar.
    morale: {
      ...moraleLevel(after),
      ...(before === null ? {} : { before: moraleLevel(before) }),
    },
    famine,
    // A lista é do que vale a pena ler: a virada de dia entra só como número, e o fecho diário
    // do desperdício, como total na linha de cada recurso (nunca uma linha por dia perdido).
    highlights: events.filter(isChronicleEvent).map((event) => event.text),
    blocks: buildBlocks(after, events, counts, wasted),
  };
}
