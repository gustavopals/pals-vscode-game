import {
  CHRONICLE_HIDDEN_EVENT_TYPES,
  type GameEvent,
  type ReturnReport,
  type ReturnReportItem,
  type ViewState,
} from '@lotg/protocol';

import { cardDeadline, cardDecisions, crossroadsDecisions, expiresSoon } from '../ui/council';
import { canSend, rescueDestination } from '../ui/expeditions';
import { formatNumber, joinList } from '../ui/format';
import { TAVERN_SECTION } from '../ui/guild';
import { CARAVANS_SECTION } from '../ui/market';
import { peopleMoved } from '../ui/morale';
import {
  isObjectiveCompleted,
  objectivesCompleted,
  objectivesCompletedSentence,
} from '../ui/objectives';
import { recoveredLine } from '../ui/workers';
import {
  allocateTo,
  defenseCommand,
  type LeavingItem,
  leavingItems,
  storageCommand,
} from './beforeLeaving';

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

/**
 * O que o depósito cortou de uma recompensa ou devolução (`lost_<recurso>`). A carga que uma
 * emboscada leva de uma caravana tem nome próprio no evento (`ambushed_<recurso>`; pendência
 * E-44, corrigida no motor) e não entra aqui: não é corte nem vai ao chão. Ela já saiu do
 * estoque no envio (`spent_`), e o ouro da parte vendida entra como `gained_gold`; a perda está
 * na frase do evento, em "custou".
 */
function cutOf(events: GameEvent[], id: string): number {
  return total(events, `lost_${id}`);
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
 * Serraria, a obra do depósito, a conta da moral, a mesa do conselho e, depois de uma incursão,
 * a Paliçada (ou a Torre de Vigia, quando a obra da Paliçada ainda não pode começar).
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
  if (topic === 'raid' || topic === 'threat') {
    // O ataque já passou, ou o lugar limpo voltou a ser ocupado: o que se pode fazer é mudar o
    // desfecho do próximo ataque.
    return toAction(defenseCommand(view));
  }
  if (topic === 'hero:captured') {
    // Quem ficou em cativeiro só volta com um Resgate: se a Guilda o oferece e alguma equipe
    // pode ir agora, é o botão, com o nome de quem ele solta (o que a visão diz, não o do evento).
    const rescue = rescueDestination(view.guild);
    const target = view.guild.rescueTargetName;
    return rescue === null || !canSend(rescue)
      ? { command: 'lords.openPanel', arg: 'guild', label: 'Ver a Guilda' }
      : {
          command: 'lords.sendExpedition',
          arg: rescue.modelId,
          label: target === null ? 'Enviar o Resgate' : `Enviar o Resgate de ${target}`,
        };
  }
  if (topic === 'hero:died') {
    // Quem morreu não volta: o que há a fazer é ver quem a Taverna oferece.
    return { command: 'lords.openPanel', arg: TAVERN_SECTION, label: 'Ver a Taverna' };
  }
  if (topic === 'hero:injured' || topic === 'expedition:lost') {
    // O ferido se recupera sozinho, e a equipe perdida não volta: a Guilda diz quem pode partir.
    return { command: 'lords.openPanel', arg: 'guild', label: 'Ver a Guilda' };
  }
  if (topic === 'caravan') {
    // A estrada: quem foi emboscado sem escolta aprende com a próxima; quem chegou inteiro vê as
    // caravanas para mandar outra.
    return { command: 'lords.openPanel', arg: CARAVANS_SECTION, label: 'Ver as caravanas' };
  }
  if (topic === 'wage') {
    // O atraso já fechou, ou quem partiu já partiu: o que há a ver é a equipe e o soldo dela.
    return { command: 'lords.openPanel', arg: 'guild', label: 'Ver a Guilda' };
  }
  if (topic === 'council') {
    // A carta que expirou já foi decidida; o que se pode fazer é não deixar a próxima expirar.
    const waiting = cardDecisions(view).length;
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
 * "Você ainda pode decidir", com a visão de agora: no topo, as equipes paradas em uma
 * encruzilhada, com o prazo real e o que a Postura fará; depois as cartas do Conselho à espera,
 * da que vence primeiro à última (a ordem da visão), cada uma com o prazo em tempo real e,
 * quando é a continuação de outra, a frase do servidor que lembra a escolha; depois as obras
 * que não começam sozinhas, os aldeões livres e os heróis sem jornada, nas frases e com os
 * botões de "Antes de partir".
 */
export function pendingItems(view: ViewState, elapsedSeconds = 0): ReturnReportItem[] {
  const cards = cardDecisions(view).map((decision): ReturnReportItem => {
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
  // A equipe parada em uma encruzilhada vem primeiro: é a decisão de prazo mais curto que o
  // jogo tem, e sem resposta a Postura decide por ele. A linha diz o prazo real e o que a
  // Postura fará, na frase do servidor; o botão abre a lista dos caminhos.
  const crossroads = crossroadsDecisions(view).map((decision): ReturnReportItem => {
    const posture = view.guild.expeditions.find((expedition) => expedition.id === decision.id)
      ?.crossroads?.postureText;
    return {
      text:
        `Guilda: “${decision.title}” · ${cardDeadline(decision, elapsedSeconds)}.` +
        (posture === undefined ? '' : ` ${posture}`),
      topic: `crossroads:${decision.id}`,
      ...(expiresSoon(decision, elapsedSeconds) ? { severity: 'warning' as const } : {}),
      action: {
        command: 'lords.chooseExpeditionPath',
        arg: decision.id,
        label: 'Escolher caminho',
      },
    };
  });
  // O volume do Mercado de hoje sem uso com o depósito perto do limite: o item de "Antes de
  // partir" que oferece a venda (`Vender: cabem N hoje`) é uma decisão, e não uma perda.
  const works = leavingItems(view)
    .filter(
      (item) =>
        item.id === 'queue' ||
        item.id === 'idle' ||
        item.id === 'expedition' ||
        (item.id.startsWith('storage:') && item.command.label.startsWith('Vender')),
    )
    .map((item): ReturnReportItem => ({
      text: item.text,
      topic: item.id,
      severity: item.severity,
      action: toAction(item.command),
    }));
  return [...crossroads, ...cards, ...works];
}

/**
 * O efeito escondido de uma carta tirou algo do feudo: estoque (`spent_`) ou moral. A parte de um
 * ganho que o depósito cortou (`lost_`) não conta: a boa notícia continua boa, e o corte já sai
 * na linha do depósito, com o botão que resolve. Com a Despensa no limite, que é o estado comum
 * do feudo, contar o corte mandaria toda colheita de carta para "O que exigiu um preço".
 */
function tookSomething(event: GameEvent): boolean {
  return Object.entries(event.data).some(
    ([key, value]) =>
      typeof value === 'number' &&
      ((value > 0 && key.startsWith('spent_')) || (key === 'morale' && value < 0)),
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
    // A incursão (GDD §8.2 e §12.3): a que a paliçada deteve é o feudo se defendendo sozinho; a
    // que passou custou o que a frase da Crônica diz, com os números do evento (o que foi
    // levado, quem se feriu) e o que a teria detido.
    case 'raidRepelled':
      return { block: 'prospered', topic: 'raid' };
    case 'raidSuffered':
      return { block: 'cost', topic: 'raid' };
    // A equipe (GDD §9.1): o herói que uma carta prometeu e o que a Taverna trouxe são o feudo
    // crescendo; o festival dado, o povo em festa. O soldo em atraso, o herói que ficou
    // descontente e o que partiu são o preço de o ouro ter acabado; o atraso que fechou, alívio.
    // O herói dispensado e o fim do festival ficam na Crônica: não são ganho nem perda.
    case 'heroJoined':
    case 'heroHired':
      return { block: 'prospered', topic: 'guild' };
    case 'festivalHeld':
      return { block: 'prospered', topic: 'morale' };
    case 'wageArrearsEnded':
      return { block: 'prospered', topic: 'wage' };
    case 'wageArrearsStarted':
    case 'heroDiscontent':
    case 'heroLeft':
      return { block: 'cost', topic: 'wage' };
    // As expedições (GDD §9.2 a §9.4). A equipe que voltou é o feudo trabalhando sem o senhor: a
    // frase da Crônica diz o que ela trouxe, com os totais do evento (o saque entra na tabela
    // como "recebido", nunca como produção). O herói resgatado, o que sarou, o que subiu de
    // nível, o item achado, o destino revelado e o Covil limpo são ganhos. Quem se feriu, quem
    // ficou em cativeiro, quem morreu e a equipe que não voltou são o preço, cada um com a
    // próxima ação. A partida, a chegada à encruzilhada, quem decidiu e o nó que deu errado
    // ficam na Crônica da ausência e no relatório da expedição: aqui seriam a mesma história
    // contada duas vezes (o tratamento completo é da V3F-T3).
    case 'expeditionReturned':
    case 'heroRescued':
    case 'heroRecovered':
    case 'heroLeveledUp':
    case 'itemFound':
    case 'itemSold':
    case 'destinationRevealed':
    case 'threatTileCleared':
      return { block: 'prospered', topic: 'expedition' };
    // (`itemSold` é o item que não coube no arsenal e foi vendido: a frase diz que ele virou
    // ouro; sem ela, "achou um item" ficaria sozinho, e o item não está em lugar nenhum. O ouro
    // entra na tabela como recebido, pelo total do evento.)
    // O lugar limpo que voltou a ser ocupado na virada do ano: é da Ameaça, e a próxima ação é
    // a da defesa.
    case 'threatTileRestored':
      return { block: 'cost', topic: 'threat' };
    // O Mercado e a estrada (GDD §5.9; o tratamento completo é da V3F-T3). A caravana que chegou
    // é o feudo vendendo longe sem o senhor; a emboscada é o preço, e a próxima ação é a estrada
    // (a escolta, a Torre de Vigia). O ouro que ela trouxe entra na tabela como "recebido", e a
    // carga que partiu, como "gasto": pelos totais do evento, nunca como produção. A negociação
    // (`marketTraded`), o envio (`caravanSent`) e a mudança de preço ficam na Crônica: o ouro
    // que ganharam ou gastaram já está na tabela, e a frase de cada um não é desfecho.
    case 'caravanArrived':
      return { block: 'prospered', topic: 'caravan' };
    case 'caravanAmbushed':
      return { block: 'cost', topic: 'caravan' };
    // Quem chegou pela porta com vaga trabalha; o que espera uma vaga está em "Antes de partir".
    case 'masterArrived':
      return { block: 'prospered', topic: 'master' };
    // Venda feita no balcão (só pode ter saído de uma ordem dada em outro navegador): somada em
    // uma linha, em `buildBlocks`; a compra não é desfecho e fica na Crônica.
    case 'heroInjured':
      return { block: 'cost', topic: 'hero:injured' };
    case 'heroCaptured':
      return { block: 'cost', topic: 'hero:captured' };
    case 'heroDied':
      return { block: 'cost', topic: 'hero:died' };
    case 'expeditionLost':
      return { block: 'cost', topic: 'expedition:lost' };
    default:
      // Viradas de estação e de ano, ordens dadas em outro navegador e cartas que chegaram não
      // são desfechos: ficam na Crônica da ausência. Gente e depósitos entram somados, abaixo.
      return null;
  }
}

/** A marca de uma expedição cujo caminho a Postura escolheu sem o jogador (V3F-T3.2). */
export const POSTURE_MARK = 'Decidido pela Postura.';

/** O identificador da expedição de um evento, quando ele a traz. */
const expeditionOf = (event: GameEvent): string | null =>
  typeof event.data.expeditionId === 'string' ? event.data.expeditionId : null;

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
 *   objetivos cumpridos (um, com a frase da Crônica; vários, em uma linha só, com a recompensa
 *   de cada um), a fome e o frio que acabaram, a moral que subiu de faixa, o efeito
 *   escondido de uma carta, quando ele não tirou nada, as incursões que a paliçada deteve e os
 *   feridos que sararam (somados).
 * - **O que exigiu um preço:** a fome e o frio que começaram, quem desertou e quem partiu
 *   (somados), a moral que desceu de faixa, as cartas que o conselho decidiu sozinho, o efeito
 *   escondido que cobrou algo, as incursões sofridas (a frase diz o que foi levado, quem se
 *   feriu e o que as teria detido), e o que foi ao chão por falta de espaço, uma linha por
 *   depósito. Cada item traz a próxima ação (`costAction`). A fome e o frio que já vinham de
 *   antes e não pararam ganham uma linha cada, sem número: o de agora está no aviso do alto da
 *   aba e em "Antes de partir".
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

  // Vários objetivos cumpridos na ausência saem em uma linha só, com a recompensa de cada um
  // (V2E-T4.4): o que o feudo já tinha feito conta de uma vez quando o objetivo aparece, e uma
  // linha por objetivo enterraria o resto do bloco. Um só fica com a frase da Crônica.
  const objectives = objectivesCompleted(events, after);
  if (objectives !== null) {
    prospered.push({
      at: firstSeq(events, isObjectiveCompleted),
      item: { text: objectivesCompletedSentence(objectives), topic: 'objective' },
    });
  }

  // Uma expedição, um item: a volta, o saque, o herói que subiu de nível e o item achado de uma
  // mesma equipe saem em uma linha só, no bloco do desfecho dela. Quem decidiu o caminho é dito
  // (`expeditionPostureDecided`): o jogador que volta precisa saber que não foi ele.
  const decidedByPosture = new Set(
    events.flatMap((event) => {
      const id = expeditionOf(event);
      return event.type === 'expeditionPostureDecided' && id !== null ? [id] : [];
    }),
  );
  const journeys = new Map<string, GameEvent[]>();
  const sold = events.filter(
    (event) => event.type === 'marketTraded' && event.data.direction === 'sell',
  );

  for (const event of events) {
    if (objectives !== null && isObjectiveCompleted(event)) {
      continue;
    }
    const place = placeOf(event);
    const journey = expeditionOf(event);
    if (place?.block === 'prospered' && place.topic === 'expedition' && journey !== null) {
      journeys.set(journey, [...(journeys.get(journey) ?? []), event]);
    } else if (place?.block === 'prospered') {
      prospered.push({ at: event.seq, item: { text: event.text, topic: place.topic } });
    } else if (place?.block === 'cost' && event.type === 'expeditionLost' && journey !== null) {
      price(
        event.seq,
        decidedByPosture.has(journey) ? `${event.text} ${POSTURE_MARK}` : event.text,
        place.topic,
      );
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

  for (const [journey, group] of journeys) {
    const texts = group.map((event) => event.text);
    prospered.push({
      at: group[0]?.seq ?? Number.MAX_SAFE_INTEGER,
      item: {
        text: (decidedByPosture.has(journey) ? [...texts, POSTURE_MARK] : texts).join(' '),
        topic: 'expedition',
      },
    });
  }

  // O que se vendeu no balcão do Mercado (GDD §5.9): o ouro que as ordens renderam, somado. A
  // frase de cada venda fica na Crônica; o total é o da tabela de "Recebido".
  if (sold.length > 0) {
    const gold = total(sold, 'gained_gold');
    prospered.push({
      at: sold[0]?.seq ?? Number.MAX_SAFE_INTEGER,
      item: {
        text: `Vendas no Mercado: ${sold.length} ${sold.length === 1 ? 'ordem' : 'ordens'}, ${formatNumber(gold)} de ouro recebidos.`,
        topic: 'market',
      },
    });
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
  // Os feridos que sararam: quem se feriu está na frase de cada incursão, em "custou".
  const recovered = recoveredLine(counts.villagersRecovered ?? 0);
  if (recovered !== null) {
    prospered.push({
      at: seqOf('villagerRecovered'),
      item: { text: recovered, topic: 'people' },
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

  if (after.guild.wage.arrears !== null && !started('wageArrearsStarted')) {
    price(0, 'O soldo dos heróis continuou em atraso durante toda a sua ausência.', 'wage');
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
 * - `raided`: o que as incursões levaram (`raided_<recurso>`, do evento `raidSuffered`). Saiu do
 *   estoque sem ser consumo nem gasto;
 * - `produced`: o saldo da produção e do consumo, que é a variação mais o gasto menos o recebido
 *   mais o que as incursões levaram.
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
          const cut = cutOf(events, row.id);
          const raided = total(events, `raided_${row.id}`);
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
            raided,
            produced: tidy(delta + spent - received + raided),
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
    // As incursões da ausência (GDD §8.2): as sofridas, as que a paliçada deteve, quem saiu
    // ferido e quem já sarou.
    raidsSuffered: count('raidSuffered'),
    raidsRepelled: count('raidRepelled'),
    villagersInjured: count('villagerInjured'),
    villagersRecovered: count('villagerRecovered'),
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
