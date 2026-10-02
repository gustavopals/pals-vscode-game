import {
  alocarPorDemanda,
  alocarPorDemandaFor,
  ampliarEstoque,
  erguerTorre,
  guardarLenha,
  obraMaisBarata,
  planejarAutomaticas,
  recrutar,
  responderCartas,
} from './policies';
import { type Bot, botOf, type Policy } from './types';

/**
 * Bot econômico: a cada sessão ergue (ou melhora) a Torre de Vigia se o estoque paga o dobro do
 * custo, inicia a melhoria mais barata disponível, amplia o depósito que está cheio ou perto de
 * encher, deixa planejadas as obras que não puderam começar, recruta
 * quando há vaga e comida de sobra, responde às cartas do Conselho que encontra na mesa (paga a
 * opção mais cara que cabe com folga no que sobrou; sem folga, fica com a que não custa nem
 * arrisca), reparte os aldeões pelo que as próximas obras pedem (sem deixar ninguém produzindo
 * para o chão) e, com o inverno à vista, reforça a Serraria até a conta da lenha fechar. A
 * lista é a de quem joga duas vezes por dia, o perfil que o bot imita por padrão.
 *
 * A Torre vem na frente das outras obras porque só começa com folga: nas visitas em que o
 * estoque não paga o dobro, a fila é da obra mais barata, como sempre. Com uma fila só, a obra
 * que ficou para trás entra na lista das automáticas e começa quando a Torre terminar.
 *
 * As cartas vêm depois das obras e do recrutamento: o que o bot gasta com o Conselho é o que
 * sobra da visita, nunca a comida de um recruta nem o material de uma obra que podia começar.
 */
export const economicoPolicies: readonly Policy[] = [
  erguerTorre,
  obraMaisBarata,
  ampliarEstoque,
  planejarAutomaticas,
  recrutar,
  responderCartas,
  alocarPorDemanda,
  guardarLenha,
];

export const economico = botOf(economicoPolicies);

/**
 * O bot econômico de quem volta em `awayHours` horas reais: as mesmas políticas, com a alocação
 * arrumando o feudo para esse prazo (um jogador sabe quando volta).
 */
export function economicoFor(awayHours: number): Bot {
  return botOf(
    economicoPolicies.map((policy) =>
      policy === alocarPorDemanda ? alocarPorDemandaFor(awayHours) : policy,
    ),
  );
}
