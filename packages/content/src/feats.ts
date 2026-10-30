/** Os seis Feitos anuais da v0.4 (GDD, Apêndice E). Sem Legado ou bônus de poder. */
export const feats = [
  { id: 'firstWinter', label: 'Primeiro Inverno', description: 'Sobreviver ao Cerco do Inverno.' },
  { id: 'intactWall', label: 'Muralha Intacta', description: 'Conquistar uma Vitória Gloriosa.' },
  {
    id: 'hordeKingslayer',
    label: 'Regicida da Horda',
    description: 'Derrotar o Senhor da Guerra.',
  },
  {
    id: 'feint',
    label: 'A Finta',
    description: 'Vencer o cerco após mudar mais de 60% da formação do ensaio do dia 6.',
  },
  { id: 'saboteur', label: 'Sabotador', description: 'Enviar três sabotagens no mesmo ano.' },
  { id: 'rescue', label: 'Resgate', description: 'Recuperar um herói capturado.' },
] as const;

export type FeatId = (typeof feats)[number]['id'];

export const featRules = {
  feintChangedShare: { num: 3, den: 5 },
  sabotagesPerYear: 3,
} as const;

/** Apresentação do documento anual; as frases dos acontecimentos vêm dos próprios eventos. */
export const yearChronicleTexts = {
  title: 'Crônica do Ano {ano} — {feudo}',
  siege: 'O Cerco do Inverno',
  statistics: 'O ano em números',
  score: 'Pontuação',
  feats: 'Feitos do ano',
  emptySeason: 'Os escribas não registraram acontecimentos nesta estação.',
  noFeats: 'Nenhum Feito foi conquistado neste ano.',
  metric: 'Estatística',
  value: 'Total',
  points: '{pontos} pontos.',
  metrics: {
    populationMax: 'População máxima',
    battles: 'Batalhas travadas',
    battlesWon: 'Batalhas vencidas ou resistidas',
    expeditions: 'Expedições enviadas',
    cards: 'Cartas resolvidas',
  },
  siegeResults: {
    none: 'Não houve cerco concluído neste ano.',
    victory: 'Vitória — o feudo resistiu, apesar das brechas.',
    glorious: 'Vitória Gloriosa — nenhuma ala foi rompida.',
    fall: 'Queda — o feudo sobrevive em ruínas; haverá outra primavera.',
  },
} as const;
