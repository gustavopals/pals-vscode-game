import { economicoPolicies, preparedFor } from './economico';
import {
  alocarPorDemanda,
  contratar,
  darFestival,
  enviarExpedicoes,
  equiparMelhor,
  erguerGuilda,
  escolherCaminho,
  responderCartas,
} from './policies';
import { botOf, type Bot, type Policy } from './types';

/**
 * Bot explorador: o perfil do GDD §15.3 que cuida do feudo como o econômico e, além disso, usa a
 * Guilda. As políticas dele são as do `economico`, na mesma ordem, **mais** as que cada mecânica
 * da v0.3 traz (roadmap da v0.3, §0.5). Hoje, as da Taverna (V3C-T2), as das expedições
 * (V3D-T1), as dos desfechos (V3D-T2) e as do catálogo (V3D-T3):
 *
 * - **erguer a Guilda**: quando há um herói a quem enviar, ou um prometido a caminho; e melhorá-la quando há mais gente
 *   livre do que lugares. Só o explorador a ergue: nos outros bots ela fica fora da corrida das
 *   obras, porque a quem não envia expedições ela não serve de nada;
 * - **contratar**: enquanto o ouro pagar o preço de um candidato e 24 horas reais de soldo da
 *   equipe já com ele;
 * - **dar festival**: um por estação, quando o estoque paga três vezes o custo;
 * - **escolher o caminho**: responde a metade das encruzilhadas que encontra (o caminho do meio,
 *   às vezes o mais ambicioso, o seguro com alguém ferido) e deixa a outra metade para a
 *   Postura, que decide no fim do prazo (V3D-T3);
 * - **equipar o melhor item**: o que soma mais vai para o herói mais forte que ganha com ele
 *   (V3D-T2);
 * - **enviar expedições**: a de maior recompensa que a equipe passa com folga, pelo que a tela
 *   diz do primeiro trecho (o poder de cada herói contra a prova e o poder que dá folga); sem
 *   nenhuma, o primeiro destino aberto; quem está ferido não vai (V3D-T3).
 *
 * Do Mercado (V3E-T1) ele tem as duas políticas que o `economico` já traz na lista: vender o
 * excedente e comprar lenha. A próxima (mandar caravanas) entra com a V3E-T2.
 *
 * A Guilda entra **na frente de todas as obras** (revisão da Fase D, M-R1): com uma fila só, é a
 * obra que dá trabalho a quem já recebe soldo, e antes ela esperava a Paliçada, os objetivos e
 * a Torre. As outras entram depois das obras, do recrutamento e das cartas, e antes da alocação: o bot
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
export const exploradorPolicies: readonly Policy[] = guildPolicies(
  escolherCaminho,
  enviarExpedicoes,
);

/**
 * As políticas de um bot da Guilda: as do econômico, com a Guilda na frente de todas as obras
 * e, antes da alocação, as da Taverna, a resposta às encruzilhadas, o equipamento e o envio. O
 * que muda de um bot da Guilda para outro é como ele responde e como ele envia.
 */
export function guildPolicies(choosePath: Policy, send: Policy): readonly Policy[] {
  return [
    erguerGuilda,
    ...economicoPolicies.flatMap((policy) =>
      policy === alocarPorDemanda
        ? [contratar, darFestival, choosePath, equiparMelhor, send, policy]
        : policy === responderCartas
          ? // De novo depois das cartas: a que promete um herói acabou de ser respondida, e a
            // Guilda fica planejada nesta visita, não na seguinte.
            [policy, erguerGuilda]
          : [policy],
    ),
  ];
}

export const explorador = botOf(exploradorPolicies);

/** O explorador de quem volta em `awayHours` horas reais: como o econômico, sabe quando volta. */
export function exploradorFor(awayHours: number): Bot {
  return botOf(preparedFor(exploradorPolicies, awayHours));
}
