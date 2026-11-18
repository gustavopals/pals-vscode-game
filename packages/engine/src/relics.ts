import { RELIC_IDS, relics, type RelicId, type Ratio } from '@lotg/content';
import { emit } from './chronicle';
import type { GameEvent, GameState } from './types';

export function relicIsActive(
  state: GameState,
  id: RelicId,
  atMs = state.lastProcessedAt,
): boolean {
  return state.settlement.relics.some(
    (entry) =>
      entry.defId === id &&
      entry.placed &&
      entry.effectiveFromMs !== null &&
      entry.effectiveFromMs <= atMs,
  );
}

/** Concessão interna para recompensas de eventos; não é uma ordem do jogador. */
export function grantRelic(
  draft: GameState,
  id: RelicId,
  atMs: number,
  events: GameEvent[],
): boolean {
  if (!RELIC_IDS.includes(id)) throw new Error('Relíquia desconhecida no conteúdo.');
  if (draft.settlement.relics.some((entry) => entry.defId === id)) return false;
  draft.settlement.relics.push({ defId: id, placed: false, effectiveFromMs: null });
  emit(events, draft, atMs, 'relicFound', { relicId: id }, { reliquia: relics[id].label });
  return true;
}

/** Modificadores públicos: a batalha real e a prévia recebem os mesmos termos. */
export function battleRelicModifiers(state: GameState): {
  armyMoraleBonus?: number;
  wolfAttackFactor?: Ratio;
} {
  return {
    ...(relicIsActive(state, 'ancestralHorn')
      ? { armyMoraleBonus: relics.ancestralHorn.battleMorale }
      : {}),
    ...(relicIsActive(state, 'wolfBone') ? { wolfAttackFactor: relics.wolfBone.wolfAttack } : {}),
  };
}

/** Só o restante da viagem muda; tempo já percorrido e espera de encruzilhada não mudam. */
export function rescaleExpeditionRemainders(draft: GameState, atMs: number, factor: Ratio): void {
  for (const expedition of draft.guild.expeditions) {
    const end = expedition.nodeEndsAtMs;
    if (end !== null && end > atMs)
      expedition.nodeEndsAtMs =
        atMs + Math.max(1, Math.ceil(((end - atMs) * factor.num) / factor.den));
  }
}

/** A ativação já coincide com uma virada que existe na linha do tempo; não sorteia. */
export function activateRelics(draft: GameState, atMs: number): void {
  const lamp = draft.settlement.relics.find((entry) => entry.defId === 'hermitsLamp');
  if (lamp?.placed && lamp.effectiveFromMs === atMs)
    rescaleExpeditionRemainders(draft, atMs, relics.hermitsLamp.duration);
}

/** D-10: só as duas cartas nomeadas reduzem o ouro solicitado. */
export function crownGoldFactor(
  state: GameState,
  cardId: string | undefined,
  atMs = state.lastProcessedAt,
): Ratio | null {
  return (cardId === 'kingsTax' || cardId === 'kingsCollector') &&
    relicIsActive(state, 'ancientKingsSeal', atMs)
    ? relics.ancientKingsSeal.crownGold
    : null;
}
