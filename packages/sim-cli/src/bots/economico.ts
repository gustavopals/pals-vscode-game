import { alocarPorDemanda, guardarLenha, obraMaisBarata, recrutar } from './policies';
import { botOf, type Policy } from './types';

/**
 * Bot econômico: a cada sessão recruta quando há vaga e comida de sobra, inicia a melhoria mais
 * barata disponível, realoca todos os aldeões para o que as próximas obras pedem e, com o
 * inverno à vista, reforça a Serraria até a conta da lenha fechar.
 */
export const economicoPolicies: readonly Policy[] = [
  recrutar,
  obraMaisBarata,
  alocarPorDemanda,
  guardarLenha,
];

export const economico = botOf(economicoPolicies);
