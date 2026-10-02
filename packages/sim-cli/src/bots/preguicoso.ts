import {
  ampliarEstoque,
  comidaPrimeiro,
  erguerPalicada,
  erguerTorre,
  guardarLenha,
  obraMaisBarata,
  ocuparLivres,
  planejarAutomaticas,
  recrutar,
  responderCartasSemGastar,
  seguirObjetivos,
} from './policies';
import { botOf, type Policy } from './types';

/**
 * Bot preguiçoso: o jogador que passa pelo feudo uma vez por dia e decide o mínimo (GDD §15.2).
 * Ergue a Paliçada quando os vigias dizem que há risco de incursão, dá o passo que cada
 * Objetivo do Senhor ativo pede (até o preguiçoso lê a lista do painel) e melhora a Torre de
 * Vigia quando o estoque paga o dobro do custo; senão inicia a obra mais
 * barata e amplia o depósito que está cheio ou perto de encher se a fila continua livre;
 * recruta se couber, responde às cartas do Conselho sem gastar (a primeira
 * opção sem custo, a que não arrisca), acode a comida só pela fazenda e manda quem está sem
 * ofício, todo mundo junto, para um lugar só. Só reequilibra quem já trabalha por necessidade:
 * a comida que falta e, com o inverno à vista, a lenha que falta.
 */
export const preguicosoPolicies: readonly Policy[] = [
  erguerPalicada,
  seguirObjetivos,
  erguerTorre,
  obraMaisBarata,
  ampliarEstoque,
  planejarAutomaticas,
  recrutar,
  responderCartasSemGastar,
  comidaPrimeiro,
  ocuparLivres,
  guardarLenha,
];

export const preguicoso = botOf(preguicosoPolicies);
