import { comidaPrimeiro, obraMaisBarata, ocuparLivres, recrutar } from './policies';
import { botOf, type Policy } from './types';

/**
 * Bot preguiçoso: o jogador que passa pelo feudo uma vez por dia e decide o mínimo (GDD §15.2).
 * Recruta se couber, inicia a obra mais barata, acode a comida só pela fazenda e manda quem
 * está sem ofício, todo mundo junto, para um lugar só. Nunca reequilibra quem já trabalha.
 */
export const preguicosoPolicies: readonly Policy[] = [
  recrutar,
  obraMaisBarata,
  comidaPrimeiro,
  ocuparLivres,
];

export const preguicoso = botOf(preguicosoPolicies);
