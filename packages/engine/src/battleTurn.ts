import { battleRelicModifiers } from './relics';
import { balance } from '@lotg/content';

import { resolveBattle, type BattleInput, type BattleResolution } from './battle';
import { nextId } from './ids';
import { dropStream, entityStream, nextInt } from './random';
import type { GameState } from './types';

/**
 * Uma batalha do jogo (V4D-T1.4; ADR 0019, decisão 11): dá à batalha o identificador
 * `battle-<n>` (`nextId`), abre o fluxo `battle:battle-<n>`, tira dele a sorte de cada ataque, um
 * inteiro de `luck.min` a `luck.max`, na ordem em que `resolveBattle` a pede (a ordem dos ataques
 * de cada rodada), e apaga o fluxo no fim: a batalha é instantânea, e o fluxo nasce e morre no
 * mesmo instante, sem nunca ser gravado. Altera `draft.ids` (e, de passagem, `draft.rng`).
 *
 * Só um evento da linha do tempo, dentro de `advanceTo`, pode chamar esta função (é ela que
 * sorteia e cria a entidade); várias batalhas no mesmo instante vão na ordem do identificador,
 * porque cada uma pede o seu a `nextId` na hora de lutar. Desde a V4E-T2.3 quem a chama é a incursão (`fightRaid`, em `raids.ts`): a
 * batalha entra na linha do tempo na Fase E (V4E-T2).
 */
export function fightBattle(
  draft: GameState,
  input: BattleInput,
): { id: string; resolution: BattleResolution } {
  const id = nextId(draft, 'battle');
  const stream = entityStream('battle', id);
  const { min, max } = balance.battle.luck;
  const resolution = resolveBattle(
    { ...input, ...battleRelicModifiers(draft) },
    () => min + nextInt(draft, stream, max - min + 1),
  );
  dropStream(draft, stream);
  return { id, resolution };
}
