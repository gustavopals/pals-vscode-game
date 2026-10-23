import type { LineId, WingId } from './ids';

/**
 * Os nomes e as frases das formações salvas (GDD §10.1 e §10.8; ADR 0019, decisões 8 e 9). Os
 * números (o teto de formações, os soldados por posto) estão em `balance.army`.
 */

/** Os nomes das alas. */
export const wingLabels: Record<WingId, string> = {
  left: 'Ala esquerda',
  center: 'Centro',
  right: 'Ala direita',
};

/** As alas no meio de uma frase, com artigo: "a ala esquerda", "o centro". */
export const wingPhrases: Record<WingId, string> = {
  left: 'a ala esquerda',
  center: 'o centro',
  right: 'a ala direita',
};

/** Os nomes das linhas de cada ala. */
export const lineLabels: Record<LineId, string> = {
  front: 'Frente',
  back: 'Retaguarda',
};

export const formationTexts = {
  nameLength: 'O nome da formação tem de ter de {min} a {max} letras.',
  shape:
    'A formação tem de trazer os seis postos (três alas, frente e retaguarda) e um comandante por ala.',
  empty: 'A formação precisa de ao menos um posto com soldados.',
  count: 'Cada posto leva de 1 a {max} soldados.',
  unit: 'Esse posto pede uma unidade que o Quartel não treina.',
  line: '{unidade} só combate na linha {linha}: o posto "{posto}" não a recebe.',
  commanderTwice: '{heroi} não comanda duas alas da mesma formação.',
  commanderUnknown: 'Esse comandante não é um herói do feudo.',
  /** Por que o herói da Defesa ativa não parte. */
  commanderBusy:
    '{heroi} comanda a Defesa ativa ({formacao}) e fica no feudo: troque ou desmarque a formação para ele partir.',
  /** O motivo que o editor mostra de quem não pode ser nomeado. */
  heroAway: 'está fora do feudo',
  heroInjured: 'ainda se recupera de um ferimento',
  heroCaptive: 'está em cativeiro',
  heroEscort: 'escolta uma caravana',
  shortfall: 'Faltam {tropa} para preencher todos os postos.',
  noShortfall: 'O feudo tem soldados para todos os postos.',
} as const;

/** "Na ala esquerda", "No centro": o começo da frase do risco do Conselho de Guerra. */
export const wingLocatives: Record<WingId, string> = {
  left: 'Na ala esquerda',
  center: 'No centro',
  right: 'Na ala direita',
};

/**
 * As frases do Conselho de Guerra (GDD §10.5; V4D-T2.4). O motor escolhe a do fator que mais
 * dano fez à formação e preenche `{ala}` (ver `wingLocatives`); o app só mostra o resultado.
 */
export const warCouncilTexts = {
  /** O motivo por fator da batalha (`battleReport.ts`); `{ala}` só nos fatores que têm ala. */
  risk: {
    wallAbsorbed: '{ala}, o peso da Horda cai sobre a muralha, que cede primeiro.',
    counter: '{ala}, as armas da Horda vencem as suas pelo ciclo de contra-ataques.',
    exposedRear: '{ala}, a Frente cai e a Horda alcança a Retaguarda desprotegida.',
    flank: '{ala}, a Horda entra pelo flanco onde a ala vizinha está vazia.',
    tower: 'As torres do inimigo castigam a formação.',
    aura: 'O chefe da Horda levanta o ânimo dela com a sua aura.',
  },
  riskPrefix: 'Risco principal: ',
  /** Quando nenhuma simulação trouxe dano da Horda que valha uma frase. */
  noRisk: 'Nenhum fator da Horda se destacou nas simulações.',
  /** Quando a formação não tem soldado nenhum para lutar. */
  noTroops: 'A formação não tem soldado nenhum no feudo: sem tropa, a Horda vence sem lutar.',
} as const;
