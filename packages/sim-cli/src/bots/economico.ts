import { alocarPorDemanda, obraMaisBarata, recrutar } from './policies';
import { botOf, type Policy } from './types';

/**
 * Bot econômico: a cada sessão recruta quando há vaga e comida de sobra, inicia a melhoria mais
 * barata disponível e realoca todos os aldeões para o que as próximas obras pedem.
 */
export const economicoPolicies: readonly Policy[] = [recrutar, obraMaisBarata, alocarPorDemanda];

export const economico = botOf(economicoPolicies);
