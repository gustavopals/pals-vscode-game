import { emit } from './chronicle';
import { plural } from './format';
import { missingResources, payResources } from './construction';
import { itemDefOf } from './heroes';
import { reject } from './rejections';
import {
  repairDurationMs,
  repairIronCost,
  repairPoints,
  smithyLevel,
  smithyRequired,
} from './smithy';
import type { GameEvent, GameState, Rejection } from './types';

/**
 * A ordem de reparo do Ferreiro (GDD §6.1 e §9.1; ADR 0019, decisão 5). **Não sorteia**: o item
 * volta no instante marcado (`settlement.forge.endsAtMs`), que `advanceTo` resolve, na mesma fila
 * da forja de armas.
 *
 * As recusas, na ordem:
 *
 * 1. sem Ferreiro (`SMITHY_REQUIRED`);
 * 2. a forja ocupada, com um lote ou com outro reparo (`FORGE_BUSY`);
 * 3. o item que não está no arsenal (`ITEM_NOT_FOUND`): o que um herói leva se devolve ao
 *    arsenal antes (`unequipItem`), e o conteúdo que já não tem o item o torna irreparável;
 * 4. o item inteiro (`ITEM_INTACT`);
 * 5. ferro que falta (`INSUFFICIENT_RESOURCES`).
 *
 * Aceita, cobra o ferro agora, tira o item do arsenal para a forja (onde ele continua ocupando o
 * lugar dele) e fixa o fim: `pontos que faltam × tempo por ponto`.
 */
export function repairItem(
  draft: GameState,
  itemId: unknown,
  nowMs: number,
  events: GameEvent[],
): Rejection | null {
  if (smithyLevel(draft) === 0) {
    return smithyRequired(draft);
  }
  if (draft.settlement.forge !== null) {
    return reject('FORGE_BUSY');
  }
  const { inventory } = draft.guild;
  const index = inventory.findIndex((entry) => entry.id === itemId);
  const item = inventory[index];
  const def = item === undefined ? null : itemDefOf(item);
  if (item === undefined || def === null) {
    const carried = draft.guild.heroes.some((hero) =>
      Object.values(hero.equipment).some((piece) => piece?.id === itemId),
    );
    return reject('ITEM_NOT_FOUND', {
      note: carried
        ? 'Se um herói o leva, devolva-o ao arsenal antes de mandar reparar.'
        : undefined,
    });
  }
  const points = repairPoints(item);
  if (points === 0) {
    return reject('ITEM_INTACT', { label: def.label });
  }
  const cost = { iron: repairIronCost(item, points) };
  const missing = missingResources(draft, cost);
  if (missing !== null) {
    return reject('INSUFFICIENT_RESOURCES', { missing });
  }
  payResources(draft, cost);
  inventory.splice(index, 1);
  draft.settlement.forge = {
    kind: 'repair',
    item,
    points,
    startedAtMs: nowMs,
    endsAtMs: nowMs + repairDurationMs(points),
  };
  emit(
    events,
    draft,
    nowMs,
    'repairStarted',
    { itemId: item.id, defId: item.defId, points, spent_iron: cost.iron },
    { item: def.label, pontos: plural(points, 'ponto', 'pontos') },
  );
  return null;
}
