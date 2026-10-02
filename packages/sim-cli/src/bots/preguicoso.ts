import {
  ampliarEstoque,
  comidaPrimeiro,
  guardarLenha,
  obraMaisBarata,
  ocuparLivres,
  planejarAutomaticas,
  recrutar,
} from './policies';
import { botOf, type Policy } from './types';

/**
 * Bot preguiçoso: o jogador que passa pelo feudo uma vez por dia e decide o mínimo (GDD §15.2).
 * Recruta se couber, inicia a obra mais barata, amplia o depósito que está cheio ou perto de
 * encher se a fila continua livre, acode a comida só pela fazenda e manda quem está sem ofício,
 * todo mundo junto, para um lugar só. Só reequilibra quem já trabalha por necessidade: a comida que falta e, com o
 * inverno à vista, a lenha que falta.
 */
export const preguicosoPolicies: readonly Policy[] = [
  obraMaisBarata,
  ampliarEstoque,
  planejarAutomaticas,
  recrutar,
  comidaPrimeiro,
  ocuparLivres,
  guardarLenha,
];

export const preguicoso = botOf(preguicosoPolicies);
