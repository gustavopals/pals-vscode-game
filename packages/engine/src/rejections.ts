import { balance, buildings, type ResourceAmounts } from '@lotg/content';

import { joinList, thousands } from './format';
import type { Rejection, RejectionCode } from './types';
import { positiveEntries } from './units';

type RejectionParams = {
  label?: string;
  /** O sujeito de `label` é plural ("As Habitações"): o verbo da recusa o acompanha. */
  plural?: boolean;
  level?: number;
  count?: number;
  missing?: ResourceAmounts;
  /** O recurso de que a recusa fala, em minúscula: "madeira". */
  resource?: string;
  /** Quanto a obra pede desse recurso e quanto o depósito guarda, em unidades. */
  amount?: number;
  capacity?: number;
  /** O que fazer para a recusa deixar de valer, sem ponto final. */
  remedy?: string;
  /** Uma frase inteira a mais, depois da recusa: o porquê de um teto que é só desta versão. */
  note?: string | undefined;
  /** A recusa fala de uma encruzilhada de expedição, e não de uma carta do Conselho. */
  crossroads?: boolean;
};

/** "40 madeira e 10 pedra". */
export function describeAmounts(amounts: ResourceAmounts): string {
  return joinList(
    positiveEntries(amounts).map(
      ([id, amount]) => `${amount} ${balance.resources[id].label.toLowerCase()}`,
    ),
  );
}

/** "está" ou "estão": o verbo das recusas cujo sujeito é um edifício. */
const is = (plural = false): string => (plural ? 'estão' : 'está');

const { nameMinLength, nameMaxLength } = balance.settlement;
const { maxPerOrder, maxQueue } = balance.recruitment;
const { townHall } = buildings;

/** "A segunda fila abre com o Salão do Senhor Nv4.": o que destrava a fila que falta. */
export const SECOND_QUEUE_OPENS = `A segunda fila abre com ${townHall.article} ${townHall.label} Nv${balance.construction.secondQueueTownHallLevel}.`;

// Motivos de recusa em pt-BR: chegam à interface exatamente como estão aqui.
const messages: Record<RejectionCode, (params: RejectionParams) => string> = {
  UNKNOWN_COMMAND: () => 'O feudo não conhece essa ordem.',
  INVALID_BUILDING: () => 'Esse edifício não existe no feudo.',
  INVALID_WORKERS: () =>
    'Só edifícios produtivos recebem trabalhadores, em número inteiro e não negativo.',
  NOT_ENOUGH_VILLAGERS: ({ count = 0 }) =>
    count === 1
      ? 'Só há 1 aldeão livre para esse ofício.'
      : `Só há ${count} aldeões livres para esse ofício.`,
  ALREADY_UPGRADING: ({ label, plural }) => `${label} já ${is(plural)} em obras.`,
  // Todas as filas abertas têm obra, e não há mais fila para abrir.
  QUEUE_BUSY: () => 'Os pedreiros já estão ocupados: não há fila de obras livre.',
  // A fila que existe está ocupada e a segunda ainda não abriu: a frase diz o que a abre.
  QUEUE_LOCKED: () => `Os pedreiros já estão ocupados com outra obra. ${SECOND_QUEUE_OPENS}`,
  // `note` é a frase do conteúdo para o teto que é só desta versão do jogo (a Torre de Vigia).
  MAX_LEVEL: ({ label, plural, note }) =>
    `${label} já ${is(plural)} no nível máximo.${note === undefined ? '' : ` ${note}`}`,
  // `label` é o edifício que falta melhorar, com artigo; quase sempre, o Salão.
  GATE_LOCKED: ({ label = `${townHall.article} ${townHall.label}`, level }) =>
    `Melhore antes ${label} para o nível ${level}.`,
  // `label` é o depósito, com artigo: "o Armazém", ou "o Pátio" antes de ele existir.
  EXCEEDS_STORAGE: ({ amount = 0, resource, label, capacity = 0, remedy }) =>
    `A obra pede ${thousands(amount)} de ${resource} e ${label} só guarda ${thousands(capacity)}: ${
      remedy ?? 'não há como juntar tanto'
    }.`,
  INSUFFICIENT_RESOURCES: ({ missing = {} }) => `Faltam ${describeAmounts(missing)}.`,
  NOT_IN_CONSTRUCTION: ({ label, plural }) => `${label} não ${is(plural)} em obras.`,
  ALREADY_PLANNED: ({ label, plural }) => `${label} já ${is(plural)} na lista de obras planejadas.`,
  NOT_PLANNED: ({ label, plural }) => `${label} não ${is(plural)} na lista de obras planejadas.`,
  // A ordem dizia um nível e a obra da vez já é outra (a tela estava atrasada, ou outra aba
  // passou na frente). `label` é o edifício com "de": "das Habitações"; `level`, o nível de agora.
  STALE_LEVEL: ({ label = 'desse edifício', level }) =>
    `Essa ordem ficou para trás: a obra ${label} agora é ${
      level === undefined ? 'a de outro nível' : `a do nível ${level}`
    }. Confira a lista e peça de novo.`,
  INVALID_QUANTITY: () => `Recrute de 1 a ${maxPerOrder} aldeões por ordem.`,
  FAMINE: () => 'Ninguém se junta a um feudo com fome. Ponha comida na mesa primeiro.',
  RECRUIT_QUEUE_FULL: ({ count = 0 }) =>
    count === 0
      ? `Já há ${maxQueue} aldeões a caminho. Espere algum chegar.`
      : `Só cabem mais ${count} na fila de recrutamento.`,
  HOUSING_FULL: ({ count = 0 }) =>
    count === 0
      ? 'Não há vaga nas Habitações. Melhore as Habitações ou o Salão.'
      : `Só há vaga para mais ${count} nas Habitações.`,
  INVALID_NAME: () => `O nome do feudo deve ter de ${nameMinLength} a ${nameMaxLength} caracteres.`,
  // O Conselho (GDD §7.1). A carta saiu da mesa: foi respondida (em outra aba, por exemplo).
  CARD_NOT_PENDING: () =>
    'Essa carta já saiu da mesa do conselho: a decisão sobre ela já foi tomada.',
  // O prazo acabou e o conselho aplicou a opção da dificuldade: a Crônica diz qual.
  CARD_EXPIRED: () =>
    'O prazo dessa carta acabou e o conselho decidiu sozinho. A Crônica conta o que foi feito.',
  // `label` é o título da carta, ou o da encruzilhada.
  INVALID_OPTION: ({ label, crossroads }) =>
    crossroads === true
      ? `A encruzilhada "${label}" não tem esse caminho.`
      : label === undefined
        ? 'Essa carta não tem essa opção.'
        : `A carta "${label}" não tem essa opção.`,
  // `remedy` é o que a opção exige, sem ponto: "requer o Celeiro", "requer um Guerreiro na equipe".
  OPTION_LOCKED: ({ remedy = 'falta o que ela exige', crossroads }) =>
    crossroads === true
      ? `Esse caminho está fora do alcance da equipe: ${remedy}.`
      : `Essa opção ainda está fora do alcance do feudo: ${remedy}.`,
  // Os heróis (GDD §9.1). O herói da ordem já não serve ao feudo: partiu sem soldo, ou foi
  // dispensado em outra aba.
  HERO_NOT_FOUND: () => 'Esse herói já não está a serviço do feudo.',
  // A Taverna (GDD §6.1 e §9.1). `label` é o edifício com artigo; `remedy`, o que o abre.
  TAVERN_REQUIRED: ({ label = 'a Taverna', remedy }) =>
    `Erga ${label} primeiro${remedy === undefined ? '' : `: ${remedy}`}.`,
  // O candidato saiu na troca da lista, ou já foi contratado (em outra aba, por exemplo).
  OFFER_GONE: () =>
    'Esse candidato já não está na Taverna: a lista trocou, ou ele já foi contratado.',
  // `label` é a Taverna com o nível ("Taverna Nv1"); `count`, quantos heróis ela abriga.
  HERO_LIMIT: ({ label = 'Taverna', count = 0, remedy }) =>
    `A ${label} abriga ${count === 1 ? '1 herói' : `${count} heróis`}, e o feudo já os tem${
      remedy === undefined ? '' : `: ${remedy}`
    }.`,
  // `label` é a estação de agora, com "em": "no Verão".
  FESTIVAL_ALREADY_HELD: ({ label }) =>
    `Um festival por estação: ${label ?? 'nesta'} o feudo já festejou.`,
  // As expedições (GDD §9.2). `label` é o nome do herói que está fora do feudo.
  // `remedy` é o que espera por ele: a dispensa, por padrão; o arsenal, em uma ordem de equipar.
  HERO_BUSY: ({ label = 'Esse herói', remedy = 'a dispensa espera a volta' }) =>
    `${label} está fora do feudo: ${remedy}.`,
  // `label` é o edifício com artigo; `remedy`, o que o abre.
  GUILD_REQUIRED: ({ label = 'a Guilda dos Aventureiros', remedy }) =>
    `Erga ${label} primeiro${remedy === undefined ? '' : `: ${remedy}`}.`,
  // `label` é a Guilda com o nível ("Guilda dos Aventureiros Nv1"); `count`, quantas ela sustenta.
  EXPEDITION_LIMIT: ({ label = 'Guilda dos Aventureiros', count = 0, remedy }) =>
    `A ${label} sustenta ${count === 1 ? '1 expedição' : `${count} expedições`} por vez${
      remedy === undefined ? '' : `: ${remedy}`
    }.`,
  // `remedy` é o que abre o destino, sem ponto: "pede a Guilda dos Aventureiros no nível 3".
  EXPEDITION_LOCKED: ({ remedy = 'a Guilda não conhece esse caminho' }) =>
    `Esse destino ainda não está ao alcance do feudo: ${remedy}.`,
  // `label` é o nome do herói; `remedy`, o motivo: "já está em expedição".
  HERO_UNAVAILABLE: ({ label = 'Esse herói', remedy = 'está fora do feudo' }) =>
    `${label} não pode partir agora: ${remedy}.`,
  // `label` é o destino; `remedy`, o que falta: "vai 1 herói", "falta um Mago".
  TEAM_INVALID: ({ label, remedy = 'escolha quem vai' }) =>
    `Essa equipe não serve${label === undefined ? '' : ` para ${label}`}: ${remedy}.`,
  // A expedição já voltou, ou nunca parou em uma encruzilhada.
  EXPEDITION_NOT_WAITING: () => 'Essa expedição não espera ordem em uma encruzilhada.',
  // O prazo acabou e a Postura decidiu, ou a ordem já tinha sido dada (em outra aba, por exemplo).
  CROSSROADS_DECIDED: () =>
    'Essa encruzilhada já foi decidida, e a equipe seguiu caminho. A Crônica conta por onde.',
  // O equipamento (GDD §9.1; ADR 0018, decisão 15).
  ITEM_NOT_FOUND: () => 'Esse item já não está no arsenal do feudo.',
  // `label` é o nome do herói.
  WRONG_SLOT: ({ label = 'Esse herói' }) => `${label} não leva nada nesse espaço.`,
  // `count` é o teto do arsenal.
  INVENTORY_FULL: ({ count = 0 }) =>
    `O arsenal guarda ${count} itens e está cheio: equipe outro herói com o que sobra antes de devolver mais um.`,
  // O Mercado (GDD §5.9; ADR 0018, decisão 16). `label` é o edifício com artigo; `remedy`, o
  // que o abre.
  MARKET_REQUIRED: ({ label = 'o Mercado', remedy }) =>
    `Erga ${label} primeiro${remedy === undefined ? '' : `: ${remedy}`}.`,
  // `note` é a frase inteira de quando o que está errado não é a quantidade (o recurso que o
  // Mercado não negocia, o sentido que não é compra nem venda).
  INVALID_AMOUNT: ({ note }) => note ?? 'Negocie um número inteiro de unidades, a partir de 1.',
  // O dia de jogo virou entre a tela e a ordem: a visão que vem junto traz o preço de hoje.
  PRICE_CHANGED: () =>
    'O dia virou e o preço do Mercado mudou: confira o preço de hoje e peça de novo.',
  // `label` é o Mercado com o nível ("Mercado Nv1"); `count`, o volume do dia por recurso;
  // `amount`, o que ainda cabe hoje; `resource`, o recurso em minúscula.
  DAILY_VOLUME_EXCEEDED: ({ label = 'Mercado', count = 0, amount = 0, resource = 'recurso' }) =>
    `O ${label} negocia ${thousands(count)} de ${resource} por dia, entre compras e vendas: ${
      amount === 0
        ? 'hoje não cabe mais nada. O volume volta na virada do dia'
        : `hoje ${amount === 1 ? 'ainda cabe 1 unidade' : `ainda cabem ${thousands(amount)}`}`
    }.`,
  // `label` é o depósito, com artigo: "o Armazém"; `capacity`, o que ele guarda; `amount`, o
  // que ainda cabe. A compra que não cabe é recusada inteira.
  STORAGE_FULL: ({ label = 'o depósito', capacity = 0, amount = 0, resource = 'recurso' }) =>
    `A compra não cabe: ${label} guarda ${thousands(capacity)} de ${resource}, e ${
      amount === 0
        ? 'está cheio'
        : `só ${amount === 1 ? 'cabe mais 1 unidade' : `cabem mais ${thousands(amount)}`}`
    }.`,
};

export function reject(code: RejectionCode, params: RejectionParams = {}): Rejection {
  return { code, message: messages[code](params) };
}
