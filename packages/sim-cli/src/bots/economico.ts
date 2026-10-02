import {
  alocarPorDemanda,
  alocarPorDemandaFor,
  ampliarEstoque,
  guardarLenha,
  obraMaisBarata,
  planejarAutomaticas,
  recrutar,
  responderCartas,
} from './policies';
import { type Bot, botOf, type Policy } from './types';

/**
 * Bot econômico: a cada sessão responde às cartas do Conselho que encontra na mesa (com a opção
 * mais barata que pode pagar), inicia a melhoria mais barata disponível, amplia o depósito que
 * está cheio ou perto de encher, deixa planejadas as obras que não puderam começar, recruta
 * quando há vaga e comida de sobra, reparte os aldeões pelo que as próximas obras pedem (sem
 * deixar ninguém produzindo para o chão) e, com o inverno à vista, reforça a Serraria até a
 * conta da lenha fechar. A lista é a de quem joga duas vezes por dia, o perfil que o bot imita
 * por padrão.
 */
export const economicoPolicies: readonly Policy[] = [
  responderCartas,
  obraMaisBarata,
  ampliarEstoque,
  planejarAutomaticas,
  recrutar,
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
