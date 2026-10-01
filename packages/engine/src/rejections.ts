import { balance, type ResourceAmounts } from '@lotg/content';

import type { Rejection, RejectionCode } from './types';
import { positiveEntries } from './units';

type RejectionParams = {
  label?: string;
  level?: number;
  count?: number;
  missing?: ResourceAmounts;
};

function joinList(items: string[]): string {
  if (items.length <= 1) {
    return items.join('');
  }
  return `${items.slice(0, -1).join(', ')} e ${items[items.length - 1]}`;
}

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
  GATE_LOCKED: ({ level }) => `Melhore antes o Salão do Senhor para o nível ${level}.`,
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
