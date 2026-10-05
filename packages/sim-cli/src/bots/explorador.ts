import { economicoPolicies, preparedFor } from './economico';
import { botOf, type Bot, type Policy } from './types';

/**
 * Bot explorador: o perfil do GDD §15.3 que cuida do feudo como o econômico e, além disso, usa a
 * Guilda. As políticas dele são as do `economico`, na mesma ordem, **mais** as que cada mecânica
 * da v0.3 trouxer (roadmap da v0.3, §0.5): contratar na Taverna, enviar expedições, escolher o
 * caminho na encruzilhada, vender no Mercado, mandar caravanas.
 *
 * Hoje nenhuma dessas mecânicas existe, e a lista é **igual** à do econômico: as partidas dos
 * dois são idênticas, e um teste confere isso (`bots.test.ts`). A lista é uma cópia, e não a
 * mesma referência, para a primeira política da Guilda entrar aqui sem tocar no `economico`,
 * que continua sendo a régua das faixas da v0.2. Quando a primeira política nova entrar, aquele
 * teste deixa de valer por inteiro e passa a conferir só o começo da lista.
 *
 * Como toda política, as novas só leem o `ViewState` ("Bot honesto", §0.7).
 */
export const exploradorPolicies: readonly Policy[] = [...economicoPolicies];

export const explorador = botOf(exploradorPolicies);

/** O explorador de quem volta em `awayHours` horas reais: como o econômico, sabe quando volta. */
export function exploradorFor(awayHours: number): Bot {
  return botOf(preparedFor(exploradorPolicies, awayHours));
}
