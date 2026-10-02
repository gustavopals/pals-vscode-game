import { balance, buildings, type ResourceAmounts } from '@lotg/content';

import { joinList, thousands } from './format';
import type { Rejection, RejectionCode } from './types';
import { positiveEntries } from './units';

type RejectionParams = {
  label?: string;
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
};

/** "40 madeira e 10 pedra". */
export function describeAmounts(amounts: ResourceAmounts): string {
  return joinList(
    positiveEntries(amounts).map(
      ([id, amount]) => `${amount} ${balance.resources[id].label.toLowerCase()}`,
    ),
  );
}

const { nameMinLength, nameMaxLength } = balance.settlement;
const { maxPerOrder, maxQueue } = balance.recruitment;
const { townHall } = buildings;

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
  ALREADY_UPGRADING: ({ label }) => `${label} já está em obras.`,
  QUEUE_BUSY: () => 'Os pedreiros já estão ocupados com outra obra.',
  MAX_LEVEL: ({ label }) => `${label} já está no nível máximo.`,
  // `label` é o edifício que falta melhorar, com artigo; quase sempre, o Salão.
  GATE_LOCKED: ({ label = `${townHall.article} ${townHall.label}`, level }) =>
    `Melhore antes ${label} para o nível ${level}.`,
  // `label` é o depósito, com artigo: "o Armazém", ou "o Pátio" antes de ele existir.
  EXCEEDS_STORAGE: ({ amount = 0, resource, label, capacity = 0, remedy }) =>
    `A obra pede ${thousands(amount)} de ${resource} e ${label} só guarda ${thousands(capacity)}: ${
      remedy ?? 'não há como juntar tanto'
    }.`,
  INSUFFICIENT_RESOURCES: ({ missing = {} }) => `Faltam ${describeAmounts(missing)}.`,
  NOT_IN_CONSTRUCTION: ({ label }) => `${label} não está em obras.`,
  ALREADY_PLANNED: ({ label }) => `${label} já está na lista de obras planejadas.`,
  NOT_PLANNED: ({ label }) => `${label} não está na lista de obras planejadas.`,
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
};

export function reject(code: RejectionCode, params: RejectionParams = {}): Rejection {
  return { code, message: messages[code](params) };
}
