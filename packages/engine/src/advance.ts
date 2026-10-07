import { settleHeroArrivals } from './arrivals';
import { settleCaravans } from './caravanTurn';
import { emit } from './chronicle';
import {
  calendarAt,
  isDayBoundary,
  isSeasonBoundary,
  isYearBoundary,
  nextDayBoundary,
  seasonWithArticle,
  yearOf,
} from './clock';
import { finishConstructions } from './construction';
import { CATALOG, type Catalog, settleCouncil, turnCouncilYear } from './council';
import { drawCard } from './councilTurn';
import { finishAdaptations, tallyCraftExperience } from './craft';
import { applyContinuous } from './economy';
import { recallStranded, settleExpeditions } from './expeditionTurn';
import { turnHorde } from './hordeTurn';
import { turnMarket } from './marketTurn';
import { settleMasterArrivals } from './masterTurn';
import { turnMorale } from './moraleTurn';
import { hasUnsettledObjectives } from './objectives';
import { recoverHeroes, restoreTiles } from './outcomes';
import { hasStartablePlan, settlePlanned } from './planned';
import { finishRecruitments } from './population';
import { announceRaids, recoverInjured, settleRaids } from './raids';
import { settleScarcity } from './scarcity';
import { turnSeasonWatch } from './seasonWatch';
import { cloneState } from './state';
import { settleTavern } from './tavernTurn';
import { announceFilled, fullStores, isStorageFull, reportWaste } from './storage';
import { nextEventAt } from './timeline';
import { turnWages } from './wages';
import type { GameEvent, GameState } from './types';

function processCalendar(
  draft: GameState,
  atMs: number,
  events: GameEvent[],
  catalog: Catalog,
): void {
  if (!isDayBoundary(atMs)) {
    return;
  }
  // O fecho do dia que acabou vem antes de o novo amanhecer.
  reportWaste(draft, atMs, events);
  const date = calendarAt(atMs);
  if (isYearBoundary(atMs)) {
    draft.clock.year = yearOf(atMs);
    draft.clock.yearStartMs = atMs;
    emit(events, draft, atMs, 'yearStarted', { year: date.year });
    // O Conselho esquece as cartas vistas no ano que acabou; o resto da história continua.
    turnCouncilYear(draft, atMs);
    // Os lobos voltam ao Covil que uma expedição limpou (ADR 0018, decisão 14): antes de a
    // Ameaça subir nesta virada, que já conta o tile.
    restoreTiles(draft, atMs, events);
  }
  if (isSeasonBoundary(atMs)) {
    // A estação que acabou entra na conta das atravessadas sem frio, e a nova começa a dela.
    turnSeasonWatch(draft, atMs);
    emit(
      events,
      draft,
      atMs,
      'seasonChanged',
      { season: date.season.id },
      { aEstacao: seasonWithArticle(date.season) },
    );
  }
  emit(events, draft, atMs, 'dayStarted', { dayOfYear: date.dayOfYear });
  // O dia virou: cada ofício conta a experiência com quem está no edifício agora.
  tallyCraftExperience(draft, atMs, events);
  // Depois a moral: o recálculo, os sorteios de chegada e de partida e a deserção por fome.
  turnMorale(draft, atMs, events);
  // Logo depois da deserção por fome, a outra cobrança de prazo real: o soldo em atraso deixa
  // os heróis Descontentes e, mais adiante, os faz partir. Vem antes do sorteio do Conselho
  // porque quem partiu já não está no feudo para a carta que perguntar por ele.
  turnWages(draft, atMs, events);
  // O Mercado: o preço de cada recurso anda, com o sorteio dele, e o volume do dia volta. Só
  // com o Mercado de pé (a obra que o ergue neste instante já terminou, lá em cima). Depois da
  // moral e das duas cobranças, que não dependem dele; antes do sorteio do Conselho, para a
  // carta que sair nesta virada já encontrar o preço e o volume de hoje (as cartas que mexem no
  // preço e as que pedem o Mercado são da V3F-T1).
  turnMarket(draft, atMs, events);
  // E, com a moral do dia já calculada (ela é um dos requisitos das cartas), o sorteio do Conselho.
  drawCard(draft, atMs, events, catalog);
  // Por último a Ameaça: sobe com os tiles ativos e com a estação do dia que acabou e, já
  // somada, pode marcar uma incursão. Os uivos do roteiro soam aqui, no dia deles.
  turnHorde(draft, atMs, events);
}

/** Processa, sobre o rascunho, os eventos discretos de um instante. */
export type EventProcessor = (draft: GameState, atMs: number, events: GameEvent[]) => void;

/**
 * Eventos discretos cujo instante é exatamente `atMs`, em ordem fixa: obras concluídas, aldeões
 * que chegam (os recrutas e os feridos que saram), os Mestres que esperavam à porta e agora têm
 * vaga (`settleMasterArrivals`, que roda de novo logo depois da virada do dia, para a vaga que
 * um aldeão deixou ao partir nela), heróis feridos que saram (`recoverHeroes`),
 * virada do dia (o desperdício do dia que
 * acabou, o ano, a estação, o dia, a experiência do ofício, a moral: recálculo, sorteios e
 * deserção, a cobrança do soldo em atraso, o preço e o volume do Mercado, o sorteio do Conselho, a subida da Ameaça, os uivos
 * do roteiro e o sorteio da incursão), as cartas do Conselho que expiram, os efeitos escondidos que acontecem e as
 * continuações que chegam (`settleCouncil`), os heróis prometidos que chegam (`settleHeroArrivals`), fim de adaptação de quem trocou de ofício (os aldeões e os Mestres), as
 * incursões (`settleRaids`: o aviso da Torre e a resolução das que chegaram), a Taverna
 * (`settleTavern`: o festival que acabou e a troca dos candidatos), as expedições
 * (`settleExpeditions`: os nós que terminam, os prazos de encruzilhada e as equipes que voltam,
 * na ordem do identificador), as caravanas que chegam (`settleCaravans`, também na ordem do
 * identificador), início automático
 * das planejadas, objetivos (`settlePlanned`, que repete os dois enquanto um der motivo ao
 * outro) e, por fim, fome, frio e soldo em atraso (`settleScarcity`). Os estoques que encheram são registrados depois de tudo, por
 * `advanceWith` e por `applyCommand` (`announceFilled`).
 *
 * A incursão vem depois das obras (a Paliçada que termina no instante do ataque já conta) e
 * depois da virada do dia (a moral daquele instante é a de antes do ataque). O ferido que sara
 * vem antes da virada: ele ficou fora o dia inteiro, e a contagem da experiência do ofício já o
 * encontra de volta. O herói ferido que sara vem logo depois dele, pela mesma razão do lado das
 * expedições: quem sara em um instante já pode partir na ordem dada nesse instante, e nada do
 * que vem depois na ordem (a virada, as cartas, as expedições) o encontra ainda ferido.
 *
 * `catalog` são as cartas do Conselho: o jogo usa as do conteúdo; outro catálogo só existe em
 * teste (`processEventsWith`).
 */
export function processEventsAt(
  draft: GameState,
  atMs: number,
  events: GameEvent[],
  catalog: Catalog = CATALOG,
): void {
  finishConstructions(draft, atMs, events);
  finishRecruitments(draft, atMs, events);
  recoverInjured(draft, atMs, events);
  // Os Mestres que esperavam à porta entram com os aldeões que chegam: a obra que ampliou as
  // casas neste instante já terminou, e o recruta (que tinha a casa reservada) já entrou. Antes
  // da virada do dia: a moral e a experiência do ofício daquela virada já os encontram no feudo.
  settleMasterArrivals(draft, atMs, events);
  recoverHeroes(draft, atMs, events);
  processCalendar(draft, atMs, events, catalog);
  // De novo depois da virada do dia: o aldeão que partiu ou desertou nela abriu uma vaga, e o
  // Mestre à espera entra neste mesmo instante, e não no próximo que alguém processar. A vaga
  // que o colono da moral alta poderia tomar não está em disputa: com Mestre à porta não havia
  // vaga antes da virada, e o sorteio do colono só acontece havendo.
  settleMasterArrivals(draft, atMs, events);
  settleCouncil(draft, atMs, events, catalog);
  // Os heróis prometidos cujo instante chegou, e o que uma carta que expirou agora acabou de
  // dar. Depois da virada do dia: a cobrança do soldo em atraso daquela virada não alcança quem
  // chega nela, e o lugar que um herói deixou ao partir já está aberto. Antes dos objetivos e
  // da conta do ouro, que já encontram o herói e o soldo dele.
  settleHeroArrivals(draft, atMs, events);
  finishAdaptations(draft, atMs);
  settleRaids(draft, atMs, events);
  // A Taverna: o festival que acabou e a troca dos candidatos, com o sorteio dela. Depois de
  // tudo o que muda quem está no feudo neste instante (a obra que a ergue ou a amplia, o herói
  // que parte sem soldo, o que chega por carta): a lista nasce com o número de candidatos do
  // nível de agora e sem repetir o nome de ninguém que acabou de chegar. Antes das planejadas e
  // dos objetivos, que já a encontram trocada.
  settleTavern(draft, atMs, events);
  // As expedições: os nós que terminam, os prazos de encruzilhada e as equipes que voltam, na
  // ordem do identificador. Depois da virada do dia (o poder da equipe é o deste instante, já
  // com o Descontente que a virada marcou, e quem volta agora não é cobrado pelo soldo em atraso
  // desta virada: estava fora) e depois das incursões e da Taverna, que não dependem delas.
  // Antes das planejadas, dos objetivos e da conta do ouro: o saque que entra agora já paga a
  // obra que esperava recurso e o soldo, e o atraso que abriria neste instante nem abre.
  settleExpeditions(draft, atMs, events);
  // As caravanas que chegam, na ordem do identificador, com a emboscada de quem foi sem escolta
  // sorteada no fluxo de cada uma. Depois das obras (a Torre de Vigia que fica pronta neste
  // instante já baixa o risco) e da virada do dia (o preço que andou agora não muda o da
  // caravana, fixado no envio). Depois das expedições, que não dependem delas: a equipe que
  // volta e a caravana que chega no mesmo instante não se cruzam, porque um herói faz uma coisa
  // por vez. Antes das planejadas, dos objetivos e da conta do ouro: o ouro da venda já paga a
  // obra que esperava recurso e o soldo, e o atraso que abriria neste instante nem abre.
  settleCaravans(draft, atMs, events);
  settlePlanned(draft, atMs, events);
  settleScarcity(draft, atMs, events);
}

/**
 * Um instante que nenhuma partida alcança: é para quando as previsões da visão empurram a
 * rotação da Taverna, que elas não podem sortear.
 */
const NEVER_MS = Number.MAX_SAFE_INTEGER;

/** O processador de eventos do jogo com outro catálogo de cartas: só para os testes do Conselho. */
export function processEventsWith(catalog: Catalog): EventProcessor {
  return (draft, atMs, events) => processEventsAt(draft, atMs, events, catalog);
}

/**
 * O estado como a moral da próxima virada do dia vai encontrá-lo, se nenhuma ordem chegar
 * antes: tudo o que acontece até lá e, na própria virada, o que vem antes da moral na ordem do
 * instante e mexe na conta dela (as obras que terminam e os aldeões que chegam). É o que a
 * visão usa para dizer, termo a termo, para onde a moral vai.
 *
 * Não sorteia nada: os sorteios são da virada, e ela não é processada aqui. O resultado só
 * serve à visão; o calendário dele não foi virado.
 *
 * **As incursões marcadas ficam de fora.** A previsão é o que o jogador pode saber, e uma
 * incursão marcada é segredo até os vigias a avistarem (e, sem Torre, até ela chegar): a cópia
 * avança sem nenhuma. No jogo toda incursão chega em uma virada de dia, que não é processada
 * aqui; tirar as marcadas garante que nem um estado fora desse padrão conte, pela conta da
 * moral, o que a névoa esconde.
 *
 * **A Taverna não troca os candidatos.** A rotação é um sorteio fora da virada do dia, e uma
 * previsão não sorteia: na cópia a próxima rotação fica para nunca, e uma Taverna que termine
 * de ser erguida no caminho também não ganha lista (a inauguração só sorteia sem rotação
 * marcada). Quem ela oferece não entra na conta da moral; o nível dela e o festival, que
 * entram, não dependem da rotação.
 *
 * **As expedições em curso ficam de fora.** O fim de um nó sorteia a sorte e o saque, e uma
 * previsão não sorteia: a cópia avança sem expedição nenhuma. Quem está fora continua fora na
 * cópia, e o saque não entra: a previsão da moral não conta com a volta de um herói Devoto nem
 * com a comida que uma equipe traria antes da virada. É o preço de a visão nunca resolver um nó
 * antes da hora, nem deixar o desfecho transparecer por uma conta.
 *
 * **As caravanas na estrada ficam de fora**, pela mesma razão: a chegada de uma sem escolta
 * sorteia a emboscada. Na cópia nenhuma chega, o ouro delas não entra e quem escolta continua
 * fora: a previsão da moral não conta com a volta de um herói Devoto antes da virada.
 */
export function stateAtNextMoraleTurn(state: GameState): GameState {
  const turn = nextDayBoundary(state.lastProcessedAt);
  const blind: GameState = {
    ...state,
    horde: { ...state.horde, scheduledRaids: [] },
    guild: {
      ...state.guild,
      tavern: { ...state.guild.tavern, nextRotationAtMs: NEVER_MS },
      expeditions: [],
    },
    market: { ...state.market, caravans: [] },
  };
  // Um milissegundo antes da virada o estado está em repouso e o próximo evento é ela mesma:
  // o último milissegundo é um trecho de taxas constantes, como em `advanceWith`.
  const draft = cloneState(advanceTo(blind, turn - 1).state);
  applyContinuous(draft, turn - draft.lastProcessedAt);
  draft.lastProcessedAt = turn;
  draft.clock.gameTimeMs = turn;
  const unused: GameEvent[] = [];
  finishConstructions(draft, turn, unused);
  finishRecruitments(draft, turn, unused);
  // O Mestre à porta que entra com a obra das casas pronta: as casas cheias são conta da moral.
  settleMasterArrivals(draft, turn, unused);
  return draft;
}

/**
 * O laço de `advanceTo`, com o processador de eventos por parâmetro. O jogo só usa
 * `processEventsAt`; outro processador só existe em teste (`test-helpers.ts`), para provar a
 * divisão de intervalo com eventos que nenhuma regra tem ainda.
 */
export function advanceWith(
  state: GameState,
  gameTimeMs: number,
  processEvents: EventProcessor,
): { state: GameState; events: GameEvent[] } {
  if (gameTimeMs <= state.lastProcessedAt) {
    return { state, events: [] };
  }
  const draft = cloneState(state);
  const events: GameEvent[] = [];
  // Um estado em repouso já passou por aqui e nada muda. Um estado que acabou de ser migrado
  // pode não estar em repouso pelas regras novas (inverno sem madeira, por exemplo): a fome e o
  // frio abrem ou fecham na fronteira, com a linha na Crônica, antes de o tempo andar. Sem isto
  // o próximo evento seria "agora" e o mesmo instante seria processado duas vezes. O mesmo vale
  // para uma planejada automática que já pode começar (um custo que o conteúdo baixou, por
  // exemplo): ela começa aqui, e não no primeiro instante em que alguém olhar.
  // E para o aviso da Torre: uma partida migrada com a incursão do roteiro já dentro da
  // antecedência da Torre recebe o alarme aqui, na fronteira, e não em um instante repetido.
  // E para os objetivos: quando a lista do conteúdo cresce, a partida que já tinha cumprido
  // todos recebe os novos aqui, e o que ela já fez (a Torre erguida, a carta respondida) conta
  // neste instante, com a recompensa e a linha na Crônica.
  // E para a Taverna: no jogo ela só fica de pé pelo fim de uma obra, que é um instante
  // processado, e a rotação marcada é sempre futura. Um estado que chega com a Taverna erguida
  // e sem rotação marcada, ou com a rotação vencida (só existe posto à mão, em teste), ganha a
  // lista de candidatos aqui, ancorada neste instante: assim o resultado não depende de quando
  // alguém olhou depois.
  // E para as expedições: a equipe cujo destino, trecho ou encruzilhada o conteúdo deixou de
  // ter (o catálogo mudou entre duas publicações) volta para casa aqui, com o que juntou, antes
  // das planejadas e da conta do ouro, que já contam com o saque (`recallStranded`).
  announceRaids(draft, draft.lastProcessedAt, events);
  settleTavern(draft, draft.lastProcessedAt, events);
  recallStranded(draft, draft.lastProcessedAt, events);
  if (hasStartablePlan(draft) || hasUnsettledObjectives(draft)) {
    settlePlanned(draft, draft.lastProcessedAt, events);
  }
  settleScarcity(draft, draft.lastProcessedAt, events);
  while (draft.lastProcessedAt < gameTimeMs) {
    const next = Math.min(nextEventAt(draft) ?? gameTimeMs, gameTimeMs);
    // Cheio antes do trecho e ainda cheio depois dele: o episódio é o mesmo (`announceFilled`).
    const wasFull = fullStores(draft);
    applyContinuous(draft, next - draft.lastProcessedAt);
    const stillFull = wasFull.filter((resource) => isStorageFull(draft, resource));
    draft.lastProcessedAt = next;
    draft.clock.gameTimeMs = next;
    processEvents(draft, next, events);
    announceFilled(draft, next, events, stillFull);
  }
  return { state: draft, events };
}

/**
 * Avança o estado até `gameTimeMs`, trecho a trecho entre eventos discretos. Dentro de cada
 * trecho as taxas são constantes, então avançar de uma vez dá exatamente o mesmo estado e os
 * mesmos eventos que avançar em qualquer número de passos. Não muta a entrada.
 */
export function advanceTo(
  state: GameState,
  gameTimeMs: number,
): { state: GameState; events: GameEvent[] } {
  return advanceWith(state, gameTimeMs, processEventsAt);
}
