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
 * edifício, a resposta a uma carta, um candidato da Taverna, o caminho de uma expedição, o envio
 * a um destino, o espaço de equipamento de um herói), e a mais nova aposenta o "Tentar de novo"
 * da mais velha: reenviar a velha depois desfaria a nova, ou faria duas vezes o que o jogador
 * pediu uma.
 *
 * Só agrupa pelo alvo que vem na própria ordem: nenhuma regra de jogo.
 */
export function intentOf(type: CommandType, payload: Command['payload']): string {
  const fields = payload as Record<string, unknown>;
  // Equipar e desequipar mexem no equipamento de um herói: a ordem nova sobre ele aposenta a
  // retentativa da anterior, seja qual for o item ou o espaço.
  const family = CONSTRUCTION_ORDERS.has(type)
    ? 'construction'
    : type === 'equipItem' || type === 'unequipItem'
      ? 'equipment'
      : type;
  const target =
    fields.building ??
    fields.instanceId ??
    fields.offerId ??
    fields.expeditionId ??
    fields.modelId ??
    fields.heroId;
  return typeof target === 'string' ? `${family}:${target}` : family;
}

/**
 * Todas as disputas de uma ordem: a intenção dela e, no envio de uma expedição, cada herói da
 * equipe. Um herói só parte em uma jornada: `[Rolf → Floresta]` aposenta o "Tentar de novo" de
 * `[Rolf → Patrulha]`, que depois enviaria Rolf sem o jogador querer. Duas ordens disputam a
 * mesma coisa quando têm alguma destas chaves em comum. Como `intentOf`, só agrupa pelo que vem
 * na própria ordem: nenhuma regra de jogo.
 */
export function intentsOf(type: CommandType, payload: Command['payload']): string[] {
  const { heroIds } = payload as Record<string, unknown>;
  const heroes =
    type === 'sendExpedition' && Array.isArray(heroIds)
      ? heroIds.filter((heroId): heroId is string => typeof heroId === 'string')
      : [];
  return [intentOf(type, payload), ...heroes.map((heroId) => `${type}:hero:${heroId}`)];
}
