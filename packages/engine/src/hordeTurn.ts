import { balance } from '@lotg/content';

import { soundHowls } from './raids';
import { chance } from './random';
import { prowlingEnemy, raidChancePercent, raidSizeAt, turnThreat } from './threat';
import type { GameEvent, GameState } from './types';

/**
 * A Ameaça e a Horda na virada do dia de jogo (GDD §8.2; ADR 0014, decisões 10 e 11), depois do
 * Conselho, em ordem fixa:
 *
 * 1. **A subida** da Ameaça (`turnThreat`), com a linha da Crônica de quem tem a Torre.
 * 2. **Os uivos** do roteiro do ano 1, no dia deles (`soundHowls`).
 * 3. **O sorteio da incursão**, no fluxo `horde`, com a Ameaça recém-somada: a chance é o que
 *    ela passa de `raidChanceAbove`, em %. A incursão sorteada fica marcada para `raidLeadMs`
 *    depois (outra virada de dia), do tamanho que a Ameaça dá, e é do inimigo que ronda o feudo.
 *
 * **Só se sorteia o que pode acontecer**: com uma incursão já marcada (a do roteiro conta), com
 * a Ameaça no limiar ou abaixo dele, ou sem tile ativo, o fluxo não anda. Há, portanto, no
 * máximo uma incursão marcada por vez, e a primeira de toda partida nova é a do roteiro.
 *
 * O sorteio não vira evento nem linha: a incursão marcada só aparece quando os vigias da Torre
 * a avistam (`announceRaids`), e, sem Torre, quando chega.
 *
 * É o único ponto da Ameaça que sorteia, e só `advanceTo` chega aqui. A virada do dia é um
 * instante da linha do tempo, e a regra só olha o estado daquele instante: avançar de uma vez
 * ou aos pedaços marca as mesmas incursões e gasta o gerador igual.
 */
export function turnHorde(draft: GameState, atMs: number, events: GameEvent[]): void {
  turnThreat(draft, atMs, events);
  soundHowls(draft, atMs, events);
  drawRaid(draft, atMs);
}

function drawRaid(draft: GameState, atMs: number): void {
  const { horde, stats } = draft;
  const percent = raidChancePercent(draft.map.threat);
  const enemy = prowlingEnemy(draft);
  if (horde.scheduledRaids.length > 0 || percent <= 0 || enemy === null) {
    return;
  }
  if (!chance(draft, 'horde', { num: percent, den: 100 })) {
    return;
  }
  // Uma incursão por vez: a ordem dela na partida é o que já foi resolvido, mais um.
  const order = (stats.raids_suffered ?? 0) + (stats.raids_repelled ?? 0) + 1;
  horde.scheduledRaids.push({
    id: `threat-${order}`,
    atMs: atMs + balance.threat.raidLeadMs,
    kind: 'threat',
    enemy,
    size: raidSizeAt(draft.map.threat),
    announcedAtMs: null,
  });
}
