import {
  alocarPorDemanda,
  ampliarEstoque,
  guardarLenha,
  obraMaisBarata,
  planejarAutomaticas,
  recrutar,
} from './policies';
import { botOf, type Policy } from './types';

/**
 * Bot econômico: a cada sessão recruta quando há vaga e comida de sobra, inicia a melhoria mais
 * barata disponível, amplia o depósito que está cheio ou perto de encher se a fila continua
 * livre, realoca todos os aldeões para o que as próximas obras pedem e, com o inverno à vista,
 * reforça a Serraria até a conta da lenha fechar.
 */
export const economicoPolicies: readonly Policy[] = [
  obraMaisBarata,
  ampliarEstoque,
  planejarAutomaticas,
  recrutar,
  alocarPorDemanda,
  guardarLenha,
];

export const economico = botOf(economicoPolicies);
