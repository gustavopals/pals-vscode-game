import { economicoPolicies, preparedFor } from './economico';
import {
  alocarPorDemanda,
  contratar,
  darFestival,
  enviarExpedicoes,
  equiparMelhor,
  erguerGuilda,
  escolherCaminho,
  obraMaisBarata,
} from './policies';
import { botOf, type Bot, type Policy } from './types';

/**
 * Bot explorador: o perfil do GDD §15.3 que cuida do feudo como o econômico e, além disso, usa a
 * Guilda. As políticas dele são as do `economico`, na mesma ordem, **mais** as que cada mecânica
 * da v0.3 traz (roadmap da v0.3, §0.5). Hoje, as da Taverna (V3C-T2), as das expedições
 * (V3D-T1) e as dos desfechos (V3D-T2):
 *
 * - **erguer a Guilda**: quando há um herói a quem enviar; e melhorá-la quando há mais gente
 *   livre do que lugares. Só o explorador a ergue: nos outros bots ela fica fora da corrida das
 *   obras, porque a quem não envia expedições ela não serve de nada;
 * - **contratar**: enquanto o ouro pagar o preço de um candidato e 24 horas reais de soldo da
 *   equipe já com ele;
 * - **dar festival**: um por estação, quando o estoque paga três vezes o custo;
 * - **escolher o caminho**: na encruzilhada que encontra, a opção que a Postura tomaria;
 * - **equipar o melhor item**: o que soma mais vai para o herói mais forte que ganha com ele
 *   (V3D-T2);
 * - **enviar expedições**: o destino mais difícil que a equipe passa com folga (as Ruínas, o
 *   Resgate quando há um cativo, o Covil dos Lobos com dois heróis) e, sem nenhum, o primeiro
 *   aberto; quem está ferido não vai.
 *
 * As próximas (vender no Mercado, mandar caravanas) entram com a Fase E.
 *
 * A Guilda entra logo antes de `obra mais barata`: com uma fila só, é a obra que dá trabalho a
 * quem já recebe soldo. As outras entram depois das obras, do recrutamento e das cartas, e antes da alocação: o bot
 * gasta com a Guilda o que sobrou da visita, e reparte os aldeões já sabendo o soldo que passou
 * a dever (a visão mostra o saldo do ouro com ele). **A obra da Taverna não tem política
 * própria**: ela está na lista de obras como qualquer outro edifício, e `obra mais barata` a
 * ergue e a melhora, neste bot e nos outros dois.
 *
 * O `economico` continua sendo o jogador que cuida do feudo e não contrata: é a comparação que
 * diz o que a contratação e as expedições mudam. Em um feudo sem herói e sem Taverna (antes da
 * carta da estrangeira e do Salão no nível 3) as políticas da Guilda não têm o que fazer, e a
 * partida do explorador é a do econômico, ordem por ordem: um teste confere
 * (`explorador.test.ts`).
 *
 * Como toda política, as novas só leem o `ViewState` ("Bot honesto", §0.7).
 */
export const exploradorPolicies: readonly Policy[] = economicoPolicies.flatMap((policy) =>
  policy === obraMaisBarata
    ? [erguerGuilda, policy]
    : policy === alocarPorDemanda
      ? [contratar, darFestival, escolherCaminho, equiparMelhor, enviarExpedicoes, policy]
      : [policy],
);

export const explorador = botOf(exploradorPolicies);

/** O explorador de quem volta em `awayHours` horas reais: como o econômico, sabe quando volta. */
export function exploradorFor(awayHours: number): Bot {
  return botOf(preparedFor(exploradorPolicies, awayHours));
}
