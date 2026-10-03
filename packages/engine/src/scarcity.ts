import { coldReliefs } from '@lotg/content';

import { emit } from './chronicle';
import { burnsFirewood, stepCold } from './cold';
import { stepFamine } from './famine';
import { noteColdStarted } from './seasonWatch';
import type { GameEvent, GameState } from './types';

/**
 * Quantas vezes, no máximo, fome e frio são conferidos em um instante. Cada um mexe na taxa do
 * outro (a fome corta a madeira que a Serraria entrega; o frio corta a comida da Fazenda), mas
 * sempre no mesmo sentido: começar um só pode fazer o outro começar, e terminar um só pode
 * fazer o outro terminar. Por isso o par (fome, frio) nunca volta a um estado em que já esteve
 * no mesmo instante, e quatro estados se esgotam em três mudanças. O limite é folgado; chegar
 * a ele é defeito de conteúdo (uma penalidade que aumenta a produção), não de jogada.
 */
const MAX_PASSES = 8;

/**
 * A conferência de `settleScarcity` sem a Crônica e sem a fila de recrutamento: só os
 * indicadores e o estoque. A ordem é fixa, fome e depois frio, e a conferência se repete até
 * nada mais mudar: o estado que sai daqui está em repouso, e por isso o próximo evento da linha
 * do tempo é sempre depois de agora. Se a fome terminou e recomeçou na mesma conferência (o frio
 * abriu logo depois e cortou a Fazenda), ela simplesmente continua, com a data em que começou:
 * não há oscilação no mesmo instante. O mesmo vale para o frio.
 *
 * É também o que a projeção do ofício faz na cópia quando a pergunta é o fim da fome ou do frio
 * (`craftProjection.ts`): só toca no que a cópia separa do estado.
 */
export function settleIndicators(draft: GameState, atMs: number): void {
  const { settlement } = draft;
  const famineBefore = settlement.famine;
  const coldBefore = settlement.cold;

  for (let pass = 0; ; pass += 1) {
    if (pass === MAX_PASSES) {
      throw new Error(`Fome e frio não se acomodaram no instante ${atMs}.`);
    }
    const famineMoved = stepFamine(draft, atMs);
    const coldMoved = stepCold(draft, atMs);
    if (!famineMoved && !coldMoved) {
      break;
    }
  }

  if (famineBefore !== null && settlement.famine !== null) {
    settlement.famine = famineBefore;
  }
  if (coldBefore !== null && settlement.cold !== null) {
    settlement.cold = coldBefore;
  }
}

/**
 * Abre ou encerra a fome e o frio no instante `atMs`, depois de qualquer mudança no estado:
 * todo comando e todo instante com eventos terminam aqui. A conferência é `settleIndicators`;
 * a Crônica só registra o que mudou **entre o começo e o fim do instante**, e a fome que
 * terminou e recomeçou na mesma conferência continua sem linha nenhuma.
 */
export function settleScarcity(draft: GameState, atMs: number, events: GameEvent[]): void {
  const { settlement } = draft;
  const famineBefore = settlement.famine;
  const coldBefore = settlement.cold;

  settleIndicators(draft, atMs);

  if (famineBefore !== null) {
    if (settlement.famine === null) {
      // A fila de recrutamento ficou congelada durante a fome: retoma de onde parou.
      const frozenFor = atMs - famineBefore.sinceMs;
      for (const recruit of settlement.recruitmentQueue) {
        recruit.finishesAtMs += frozenFor;
      }
      emit(events, draft, atMs, 'famineEnded');
    }
  } else if (settlement.famine !== null) {
    emit(events, draft, atMs, 'famineStarted');
  }

  if (coldBefore !== null) {
    if (settlement.cold === null) {
      const reason = burnsFirewood(draft) ? 'firewood' : 'thaw';
      emit(
        events,
        draft,
        atMs,
        'coldEnded',
        { reason, sinceMs: coldBefore.sinceMs },
        { alivio: coldReliefs[reason] },
      );
    }
  } else if (settlement.cold !== null) {
    // É o frio que a Crônica conta que tira da estação o "sem passar frio" (GDD §12.2).
    noteColdStarted(draft);
    emit(events, draft, atMs, 'coldStarted');
  }
}
