import type { Command, CommandType } from '@lotg/protocol';

/** As ordens que decidem a obra de um edifício: a nova de uma delas desfaz a espera das outras. */
const CONSTRUCTION_ORDERS: ReadonlySet<CommandType> = new Set([
  'startConstruction',
  'cancelConstruction',
  'planConstruction',
  'unplanConstruction',
  'setAutoStart',
]);

/**
 * A intenção de uma ordem: o que o jogador quis mexer, sem o valor que escolheu. Duas ordens com
 * a mesma intenção disputam a mesma coisa (os trabalhadores de um edifício, a obra de um
 * edifício, a resposta a uma carta, um candidato da Taverna), e a mais nova aposenta o "Tentar
 * de novo" da mais velha: reenviar a velha depois desfaria a nova, ou faria duas vezes o que o
 * jogador pediu uma.
 *
 * Só agrupa pelo alvo que vem na própria ordem: nenhuma regra de jogo.
 */
export function intentOf(type: CommandType, payload: Command['payload']): string {
  const fields = payload as Record<string, unknown>;
  const target = fields.building ?? fields.instanceId ?? fields.offerId ?? fields.heroId;
  const family = CONSTRUCTION_ORDERS.has(type) ? 'construction' : type;
  return typeof target === 'string' ? `${family}:${target}` : family;
}
