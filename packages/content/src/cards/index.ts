import type { CouncilCard } from '../council';
import { commonGranaryOutcome, commonGranaryPlanks, commonGranaryShare } from './commonGranary';
import { collapsedWell, masonsMeal } from './standalone';

/**
 * O catálogo do Conselho, na ordem do conteúdo: uma cadeia por arquivo e as avulsas em
 * `standalone.ts`. **A ordem faz parte do sorteio** (o motor sorteia por peso nesta lista):
 * carta nova entra no fim da cadeia dela, e cadeia nova, antes das avulsas ou depois delas, mas
 * nunca no meio de outra.
 *
 * A lista é escrita carta a carta, sem espalhamento (`...`): assim o build do app, que só usa
 * as listas de identificadores do conteúdo, descarta as cartas inteiras.
 */
export const councilCards: readonly CouncilCard[] = [
  commonGranaryPlanks,
  commonGranaryShare,
  commonGranaryOutcome,
  collapsedWell,
  masonsMeal,
];
