import type { CouncilCard } from '../council';
import { commonGranaryOutcome, commonGranaryPlanks, commonGranaryShare } from './commonGranary';
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
 * São 18 das 21 cartas do primeiro lote (docs/content-v0.2.md): as duas cadeias que só pedem o
 * que a v0.2 já tem e as doze avulsas. A terceira cadeia, "A Promessa da Paliçada", está escrita
 * no inventário e entra aqui com o edifício dela (roadmap da v0.2, V2E-T2), antes das avulsas.
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
