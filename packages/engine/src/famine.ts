import { balance } from '@lotg/content';

import { foodCoversConsumption, foodRunsOutIn } from './economy';
import type { GameState } from './types';
import { realToGameMs } from './units';

const { morale: rules } = balance;

/**
 * A janela da fome que reabre, em ms de jogo: as 2 h reais do conteúdo no ritmo desta partida
 * (GDD §5.6; ADR 0016, item 3).
 */
export function famineResumeWindowMs(state: GameState): number {
  return realToGameMs(rules.famineResumeWithinRealMs, state.settings.timeScale);
}

/**
 * Há quanto tempo de jogo a fome aberta dura em `atMs`, contando o que ela já tinha durado
 * antes de reabrir; zero sem fome. É a duração que a moral e a deserção leem.
 */
export function famineDurationAt(state: GameState, atMs: number): number {
  const { famine } = state.settlement;
  return famine === null ? 0 : Math.max(0, atMs - famine.sinceMs) + famine.carriedMs;
}

/**
 * Um passo da fome no instante `atMs`: abre ou encerra, conforme o estado de agora, e diz se
 * mexeu. Só toca nos indicadores e no estoque; a Crônica e a fila de recrutamento ficam com
 * `settleScarcity`, que só registra a mudança que sobrar no fim do instante.
 *
 * Começa no instante exato em que a comida não cobre nem mais um milissegundo de consumo.
 * Termina no primeiro instante em que volta a haver comida: o saldo, já com as penalidades de
 * produção, é positivo, ou o estoque voltou a cobrir o consumo (um ganho discreto: recompensa,
 * carta). Como no frio com a madeira, a comida que chega é comida: a fome fecha enquanto ela
 * durar e reabre no instante exato em que acabar. O saldo e o estoque de uma fome aberta só
 * mudam em comandos e eventos, então basta conferir neles.
 *
 * **A fome que reabre logo é a mesma** (ADR 0016, item 3). Quando acaba, a fome deixa em
 * `lastFamine` o instante, a duração e os desertores que tinha. A que abre antes de a janela
 * passar continua de onde aquela parou: o tempo sem fome não conta, e o que já tinha contado
 * não se perde. No fim exato da janela, ou depois, a fome é nova e conta do zero.
 */
export function stepFamine(draft: GameState, atMs: number): boolean {
  const { settlement } = draft;
  const { famine, lastFamine } = settlement;
  if (famine !== null) {
    if (foodCoversConsumption(draft)) {
      settlement.lastFamine = {
        endedAtMs: atMs,
        lastedMs: famineDurationAt(draft, atMs),
        deserted: famine.deserted,
      };
      settlement.famine = null;
      return true;
    }
    return false;
  }
  if (foodRunsOutIn(draft) === 0) {
    // O que sobra é menos de um milissegundo de consumo: zera para a fome ter um estado único.
    settlement.resources.food = 0;
    settlement.accumulators.food = 0;
    const resumes =
      lastFamine !== null && atMs - lastFamine.endedAtMs < famineResumeWindowMs(draft);
    settlement.famine = resumes
      ? { sinceMs: atMs, carriedMs: lastFamine.lastedMs, deserted: lastFamine.deserted }
      : { sinceMs: atMs, carriedMs: 0, deserted: 0 };
    settlement.lastFamine = null;
    return true;
  }
  return false;
}
