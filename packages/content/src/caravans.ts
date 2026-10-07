/**
 * As frases das caravanas na tela (GDD §5.9; ADR 0018, decisão 17), com lacunas que o motor
 * preenche. **Nenhum número de regra é escrito aqui**: o que a frase conta vem de
 * `balance.market.caravan`. As linhas da Crônica estão em `chronicle.ts`. Rascunho que o autor
 * não leu.
 */
export const caravanTexts = {
  /** Para onde toda caravana vai: é só narrativa. */
  destination: 'Porto do Rio',
  /** O que o Mercado ganha com as caravanas, para o meio de uma frase: `{caravanas}` é "1 caravana". */
  gives: 'mantém {caravanas} na estrada para {destino}',
  /** A carga, para o meio de uma frase: "300 de madeira". */
  cargo: '{quantidade} de {recurso}',
  /** De onde vem o preço: `{fator}` é a fração do conteúdo, como número. */
  priceRatio: 'O preço de venda do dia × {fator}, fixado no envio.',
  /** Os termos do risco, na ordem em que entram na frase. */
  riskBase: '{base}% na estrada',
  riskTower: '−{corte} pela {torre} Nv{nivel}',
  riskNoTower: 'cada nível da {torre} tira {corte}',
  riskFloor: 'nunca menos de {piso}%',
  riskEscort: 'com escolta, nenhum',
  /** O risco de agora, em uma frase. */
  risk: '{risco}% de chance de emboscada sem escolta; com escolta, nenhuma. Conta a {torre} que o feudo tiver na chegada.',
  /** O que a emboscada leva: `{parte}` é a fração do conteúdo, em pontos percentuais. */
  loss: 'A emboscada leva {parte}% da carga, arredondada para baixo; o resto é vendido pelo preço fixado.',
  /** A caravana na estrada. */
  onTheRoad: 'A caminho de {destino} com {carga}, a {preco} de ouro a unidade.',
  escortedBy: 'Escolta: {heroi}.',
  unescorted: 'Sem escolta.',
  /** Por que um herói não pode partir: já está com uma caravana. */
  heroEscorting: 'já escolta uma caravana',
  /** O estado de quem escolta: `{prazo}` é o tempo real até a chegada. */
  escorting: 'Escolta a caravana: volta em {prazo}',
  /** O que não é uma carga: a ordem pede um recurso que o Mercado negocia e uma quantidade. */
  cargoOnly: 'Uma caravana leva um recurso só: comida, madeira ou pedra.',
  cargoRange: 'Uma caravana leva de uma a {maximo} unidades, em número inteiro.',
} as const;
