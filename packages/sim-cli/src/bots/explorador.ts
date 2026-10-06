import { economicoPolicies, preparedFor } from './economico';
import { alocarPorDemanda, contratar, darFestival } from './policies';
import { botOf, type Bot, type Policy } from './types';

/**
 * Bot explorador: o perfil do GDD §15.3 que cuida do feudo como o econômico e, além disso, usa a
 * Guilda. As políticas dele são as do `economico`, na mesma ordem, **mais** as que cada mecânica
 * da v0.3 traz (roadmap da v0.3, §0.5). Hoje, as da Taverna (V3C-T2):
 *
 * - **contratar**: enquanto o ouro pagar o preço de um candidato e 24 horas reais de soldo da
 *   equipe já com ele;
 * - **dar festival**: um por estação, quando o estoque paga três vezes o custo.
 *
 * As próximas (enviar expedições, escolher o caminho na encruzilhada, vender no Mercado, mandar
 * caravanas) entram com as Fases D e E.
 *
 * As duas entram depois das obras, do recrutamento e das cartas, e antes da alocação: o bot
 * gasta com a Guilda o que sobrou da visita, e reparte os aldeões já sabendo o soldo que passou
 * a dever (a visão mostra o saldo do ouro com ele). **A obra da Taverna não tem política
 * própria**: ela está na lista de obras como qualquer outro edifício, e `obra mais barata` a
 * ergue e a melhora, neste bot e nos outros dois.
 *
 * O `economico` continua sendo o jogador que cuida do feudo e não contrata: é a comparação que
 * diz o que a contratação muda. Em um feudo sem Taverna (antes do Salão no nível 3) as duas
 * políticas não têm o que fazer, e a partida do explorador é a do econômico, ordem por ordem:
 * um teste confere (`explorador.test.ts`).
 *
 * Como toda política, as novas só leem o `ViewState` ("Bot honesto", §0.7).
 */
export const exploradorPolicies: readonly Policy[] = economicoPolicies.flatMap((policy) =>
  policy === alocarPorDemanda ? [contratar, darFestival, policy] : [policy],
);

export const explorador = botOf(exploradorPolicies);

/** O explorador de quem volta em `awayHours` horas reais: como o econômico, sabe quando volta. */
export function exploradorFor(awayHours: number): Bot {
  return botOf(preparedFor(exploradorPolicies, awayHours));
}
