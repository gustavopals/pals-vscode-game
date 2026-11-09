/** Textos do motor do Cerco; rascunho ainda não lido pelo autor. */
export const siegeTexts = {
  waves: { 1: 'Os Saqueadores', 2: 'As Feras', 3: 'A Longa Noite' },
  decision: 'Preparar a próxima onda do Cerco',
  defaultFormation: 'Usar a Defesa ativa',
  scheduledWithoutTower: 'No {dia}º dia {daEstacao}, {feudo} marcou a Vigília do Cerco do Inverno.',
  result: { glorious: 'Vitória Gloriosa', victory: 'Vitória', fall: 'Queda' },
  notScheduled: 'O Cerco ainda não está marcado.',
  started: 'O Cerco já começou. Troque a formação na decisão entre ondas.',
  noDecision: 'Não há decisão entre ondas aberta. O Plano salvo será usado no prazo.',
  invalidWave: 'Escolha uma das três ondas do Cerco.',
  planSet: 'O Plano de Batalha foi salvo.',
  militiaNotAllowed:
    'A milícia só pode ser convocada para uma incursão forte ou onda do Cerco dentro da antecedência da Torre de Vigia.',
  militiaActive: 'A milícia já está convocada para uma batalha.',
  militiaTerms:
    'Os convocados ficam indisponíveis para o trabalho até a batalha. Os sobreviventes ficam livres para trabalhar; as baixas são permanentes.',
  militiaAmount: 'Convoque até metade dos aldeões em condição de lutar.',
  militiaUnavailable: 'Nenhum aldeão disponível para convocar a milícia.',
  militiaNoSlot: 'A formação que vai lutar não tem posto livre para a milícia.',
  aftermath: {
    summary: 'Ondas enfrentadas: {ondas}. Mortos no feudo: {mortos}.',
    mourning: 'O feudo guarda luto pelos que tombaram.',
    feast: 'O feudo celebra a Vitória Gloriosa.',
    repair: 'O reparo da muralha custa menos até o fim deste inverno.',
  },
  reconstruction: 'A Primavera da Reconstrução reduz o custo das novas obras. O feudo sobrevive.',
} as const;
