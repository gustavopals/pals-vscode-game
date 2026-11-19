import type { VowId } from './ids';

/** D-16/D-17. Bônus somados antes de multiplicar os pontos anuais. */
export const vows = {
  noWalls: {
    label: 'Sem muralhas',
    description:
      'A Paliçada não repele incursões e as muralhas não protegem nas batalhas. As torres continuam defendendo; edifício e vida da muralha são preservados. Novos reparos ficam suspensos até a virada do ano.',
    legacyBonusPercent: 40,
  },
  cunningHorde: {
    label: 'Horda astuta',
    description: 'A Horda aprende com astúcia 0,8, tanto nas incursões quanto nas ondas do Cerco.',
    legacyBonusPercent: 25,
    cunning: { num: 4, den: 5 },
  },
  scarceFood: {
    label: 'Comida escassa',
    description:
      'A produção de comida é multiplicada por 0,8. O consumo e os ganhos de comida por outras fontes conservam suas regras.',
    legacyBonusPercent: 20,
    productionMultiplier: { num: 4, den: 5 },
  },
  mortalHeroes: {
    label: 'Heróis mortais',
    description:
      'Heróis podem morrer nas batalhas e nos Desastres de expedição que causariam morte em Rei de Ferro. Os demais ferimentos conservam suas regras.',
    legacyBonusPercent: 35,
  },
} as const satisfies Record<
  VowId,
  {
    label: string;
    description: string;
    legacyBonusPercent: number;
    cunning?: { num: number; den: number };
    productionMultiplier?: { num: number; den: number };
  }
>;

export const vowRules = { choiceWindowRealMs: 24 * 60 * 60 * 1000 } as const;
export const vowTexts = {
  closed: 'A escolha de Votos já foi encerrada para este ano.',
  unavailable: 'Escolha somente Votos oferecidos para esta dificuldade, sem repetir.',
  noWallsDefense:
    'Pelo Voto Sem muralhas, a Paliçada não repele incursões e as muralhas não defendem neste ano. As torres continuam ativas.',
  noWallsRepair:
    'O Voto Sem muralhas impede novos reparos neste ano; a estrutura existente fica preservada.',
  forYear: 'Para o Ano {ano}: {efeito}',
  none: 'nenhum Voto',
} as const;
