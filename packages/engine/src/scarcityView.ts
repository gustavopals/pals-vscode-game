import { balance, craftGuilds } from '@lotg/content';

import { buildingWithArticle } from './construction';
import type { CraftOutlook } from './craftProjection';
import { producerOf } from './economy';
import { famineDurationAt } from './famine';
import { durationText, sentenceCase } from './format';
import type { GameState, ViewState } from './types';
import { realSecondsCeil, SECOND_MS } from './units';

/**
 * A fome e o frio que acabam sozinhos (GDD §5.4, §5.6 e §4.1). Entre a ordem certa e o fim da
 * adaptação, quem acabou de chegar ao ofício rende metade: o saldo continua negativo, e uma tela
 * que só olhasse as taxas de agora mandaria pôr mais gente onde já há gente que basta. A projeção
 * do ofício sabe quando a fome e o frio acabam sem ninguém mexer em nada (`CraftOutlook`); aqui
 * isso vira frase, com o prazo no relógio de quem joga.
 */

/** O que acaba: a fome, pela comida, ou o frio, pela madeira. */
type Scarcity = 'famine' | 'cold';

const RESOURCE_OF = { famine: 'food', cold: 'wood' } as const;

/**
 * O fim da escassez cai no instante em que uma leva do edifício que produz o recurso termina a
 * adaptação: é ela que vira o saldo. Fora disso, o que o vira é a virada do dia (a moral ou a
 * experiência do ofício) ou o fim da outra escassez, que segurava a produção.
 */
function adaptationEndsIt(state: GameState, scarcity: Scarcity, endsInMs: number): boolean {
  const producer = producerOf(RESOURCE_OF[scarcity]);
  const at = state.lastProcessedAt + endsInMs;
  return state.settlement.adaptation.some(
    (cohort) => cohort.building === producer && cohort.untilMs === at,
  );
}

/**
 * Por que a fome (ou o frio) acaba sem ninguém mexer em nada, e em quanto tempo de relógio:
 * "Os lavradores ainda se adaptam: em 2 h rendem inteiro, a comida volta a sobrar e a fome
 * acaba. Não é preciso mexer neles."
 */
export function reliefSentence(
  state: GameState,
  scarcity: Scarcity,
  endsInMs: number,
  timeScale: number,
): string {
  const resource = RESOURCE_OF[scarcity];
  const producer = producerOf(resource);
  const within = durationText(realSecondsCeil(endsInMs, timeScale));
  const name = balance.resources[resource].label.toLowerCase();
  if (adaptationEndsIt(state, scarcity, endsInMs)) {
    const artisans = sentenceCase(craftGuilds[producer].artisans);
    const outcome =
      scarcity === 'famine' ? `a ${name} volta a sobrar e a fome acaba` : 'o frio passa';
    const joiner = scarcity === 'famine' ? ', ' : ' e ';
    return `${artisans} ainda se adaptam: em ${within} rendem inteiro${joiner}${outcome}. Não é preciso mexer neles.`;
  }
  return scarcity === 'famine'
    ? `Sem mexer em nada, a ${name} volta a sobrar em ${within}, e a fome acaba.`
    : `Sem mexer em nada, ${buildingWithArticle(producer)} passa a cobrir a lareira em ${within}, e o frio passa.`;
}

/** Segundos reais até o fim previsto de uma escassez; `null` quando ela não acaba sozinha. */
export function endsInSeconds(endsInMs: number | null, timeScale: number): number | null {
  return endsInMs === null ? null : realSecondsCeil(endsInMs, timeScale);
}

/**
 * A fome na visão: há quanto tempo dura, o que ela custa e, quando ela acaba sozinha, em quanto
 * tempo e por quê. `null` sem fome.
 *
 * `secondsElapsed` é a duração que a moral e a deserção contam: na fome que reabriu dentro da
 * janela (GDD §5.6), inclui o que ela já tinha durado antes. `sinceMs` é o instante em que ela
 * abriu, ou reabriu.
 */
export function famineView(
  state: GameState,
  timeScale: number,
  outlook: CraftOutlook,
): ViewState['famine'] {
  const { famine } = state.settlement;
  if (famine === null) {
    return null;
  }
  const { num, den } = balance.famine.productionMultiplier;
  const cost = `Fome: a produção cai para ${Math.round((num * 100) / den)}% e ninguém se junta ao feudo até a comida voltar.`;
  const { famineEndsIn } = outlook;
  return {
    sinceMs: famine.sinceMs,
    secondsElapsed: Math.floor(
      famineDurationAt(state, state.lastProcessedAt) / timeScale / SECOND_MS,
    ),
    endsInSeconds: endsInSeconds(famineEndsIn, timeScale),
    text:
      famineEndsIn === null
        ? cost
        : `${cost} ${reliefSentence(state, 'famine', famineEndsIn, timeScale)}`,
  };
}
