import type { CouncilCard } from '../council';
import { commonGranaryOutcome, commonGranaryPlanks, commonGranaryShare } from './commonGranary';
import {
  palisadePromiseDeadline,
  palisadePromisePlea,
  palisadePromiseReckoning,
} from './palisadePromise';
import {
  firstRecruit,
  itinerantMerchant,
  tavernBard,
  tornMap,
  veteranCaptain,
  fieldBlight,
  merchantBoycott,
  royalCaravan,
} from './lote2';
import { mysteriousMerchant, merchantLead, merchantFinalOffer } from './mysteriousMerchant';
import { kingsTax, kingsCollector, kingsAnswer } from './kingsCollector';
import { refugeesAtGates, refugeesCraft, refugeesReturn } from './refugees';
import { woundedStranger } from './scripted';
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
 * A carta roteirizada "Estrangeira ferida" (docs/content-v0.3.md; roadmap da v0.3, V3C-T3) fica no
 * fim: não tem peso e nunca entra no sorteio por peso, então a posição dela não muda a chance de
 * nenhuma outra. O que ela muda é a audiência em que chega: vai na frente das sorteadas, e
 * naquela audiência o gerador não anda.
 *
 * O lote 2 do Conselho (docs/content-v0.4.md, seções 4 a 8; roadmap da v0.4, V4H-T1) entra **no
 * fim**, depois da roteirizada, cadeia a cadeia e carta a carta: ele não muda a ordem de quem já
 * estava. A cadeia "Os Refugiados" é a primeira dele.
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
  woundedStranger,
  refugeesAtGates,
  refugeesReturn,
  refugeesCraft,
  tavernBard,
  tornMap,
  itinerantMerchant,
  firstRecruit,
  veteranCaptain,
  fieldBlight,
  mysteriousMerchant,
  merchantLead,
  merchantFinalOffer,
  merchantBoycott,
  royalCaravan,
  kingsTax,
  kingsCollector,
  kingsAnswer,
];
