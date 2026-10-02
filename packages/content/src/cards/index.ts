import type { CouncilCard } from '../council';
import { commonGranaryOutcome, commonGranaryPlanks, commonGranaryShare } from './commonGranary';
import {
  palisadePromiseDeadline,
  palisadePromisePlea,
  palisadePromiseReckoning,
} from './palisadePromise';
import {
  apprenticesTable,
  collapsedWell,
  dampFirewood,
  fullGranary,
  harvestFeast,
  masonsMeal,
  moreMouths,
  neighborsWatch,
  roofBeforeCold,
  sawmillRest,
  springNews,
  springSeeds,
} from './standalone';
import { thawBridgeCrossing, thawBridgePlea, thawBridgeSlab } from './thawBridge';

/**
 * O catálogo do Conselho, na ordem do conteúdo: uma cadeia por arquivo e as avulsas em
 * `standalone.ts`. **A ordem faz parte do sorteio** (o motor sorteia por peso nesta lista):
 * carta nova entra no fim da cadeia dela, e cadeia nova, antes das avulsas ou depois delas, mas
 * nunca no meio de outra.
 *
 * São as 21 cartas do primeiro lote (docs/content-v0.2.md): as três cadeias e as doze avulsas.
 * A terceira cadeia, "A Promessa da Paliçada", entrou com o edifício dela (roadmap da v0.2,
 * V2E-T2), antes das avulsas: só sai com o Salão no nível 3, que é o que libera a Paliçada.
 *
 * A lista é escrita carta a carta, sem espalhamento (`...`): assim o build do app, que só usa
 * as listas de identificadores do conteúdo, descarta as cartas inteiras.
 */
export const councilCards: readonly CouncilCard[] = [
  commonGranaryPlanks,
  commonGranaryShare,
  commonGranaryOutcome,
  thawBridgePlea,
  thawBridgeSlab,
  thawBridgeCrossing,
  palisadePromisePlea,
  palisadePromiseDeadline,
  palisadePromiseReckoning,
  collapsedWell,
  masonsMeal,
  sawmillRest,
  neighborsWatch,
  moreMouths,
  springSeeds,
  springNews,
  apprenticesTable,
  fullGranary,
  dampFirewood,
  roofBeforeCold,
  harvestFeast,
];
