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
  // `label` é o título da carta.
  INVALID_OPTION: ({ label }) =>
    label === undefined
      ? 'Essa carta não tem essa opção.'
      : `A carta "${label}" não tem essa opção.`,
  // `remedy` é o que a opção exige, sem ponto: "requer o Celeiro".
  OPTION_LOCKED: ({ remedy = 'falta o que ela exige' }) =>
    `Essa opção ainda está fora do alcance do feudo: ${remedy}.`,
};

export function reject(code: RejectionCode, params: RejectionParams = {}): Rejection {
  return { code, message: messages[code](params) };
}
