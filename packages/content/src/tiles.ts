import type { EnemyId, RaidSizeId, TileTypeId } from './ids';

/**
 * Um tipo de tile do mapa (GDD §8.1). O mapa gráfico é da v0.5; até lá os tiles existem só como
 * dados e aparecem em lista. Na v0.2 só há tiles de ameaça: cada um abriga um inimigo e, ativo,
 * faz a Ameaça subir a cada dia de jogo (`balance.threat.perActiveTilePerDay`).
 */
export type TileTypeDef = {
  readonly label: string;
  /** Artigo para montar "o Covil de Lobos" nas frases. */
  readonly article: 'o' | 'a';
  /** Quem sai do tile para rondar o feudo. */
  readonly enemy: EnemyId;
  /**
   * Quanto o tile ativo soma à Ameaça a cada dia de jogo. Sem o campo, vale o número comum
   * (`balance.threat.perActiveTilePerDay`); com 0, o tile não soma nada e não aparece entre os
   * termos da subida.
   */
  readonly threatPerDay?: number;
};

// GDD §8.2: na v0.2 o único tile de ameaça é o Covil de Lobos.
export const tileTypes: Record<TileTypeId, TileTypeDef> = {
  wolfDen: { label: 'Covil de Lobos', article: 'o', enemy: 'wolves' },
  raiderCamp: { label: 'Acampamento de Saqueadores', article: 'o', enemy: 'raiders' },
  // A Fortaleza não soma Ameaça até o Cerco existir (Fase G da v0.4), que é o que a descarregaria:
  // aparece no outono e manda presságios, mas sem o +2 por dia (resposta do autor de 2026-10-27,
  // pendência D-43; docs/balance-v0.4.md, seção 13).
  hordeFortress: { label: 'Fortaleza da Horda', article: 'a', enemy: 'horde', threatPerDay: 0 },
};

/**
 * Quem ronda o feudo quando há mais de um tile de ameaça ativo: o inimigo do primeiro tipo desta
 * lista que estiver ativo. Com o Covil de Lobos ativo são sempre os lobos (a composição das
 * incursões comuns é a da matilha, `balance.raids.hordeBaseMix`); sem ele, os saqueadores do
 * Acampamento e, por último, as tropas da Fortaleza. Decisão provisória da revisão da V4E-T3
 * (pendência D-45a): antes dela a escolha seguia a ordem alfabética da chave do tile.
 */
export const prowlingTileOrder: readonly TileTypeId[] = ['wolfDen', 'raiderCamp', 'hordeFortress'];

/**
 * Os tiles com que todo feudo nasce: o Covil de Lobos, ativo desde o dia 1 (ADR 0014, decisão
 * 11). `id` é a chave do tile no estado. Uma expedição pode limpar um tile de ameaça
 * (`rewards.clearsTile`), e na virada do ano os que nascem ativos voltam a ficar (ADR 0018,
 * decisão 14).
 */
export const startingTiles: ReadonlyArray<{
  readonly id: string;
  readonly type: TileTypeId;
  readonly threatActive: boolean;
}> = [{ id: 'wolfDen', type: 'wolfDen', threatActive: true }];

/** Um inimigo, como as frases o chamam. Tudo entra no meio de outra frase: minúscula, sem ponto. */
export type EnemyDef = {
  /** "lobos": entra em "lobos a caminho". */
  readonly label: string;
  /** O que os vigias dizem de cada tamanho de incursão: entra depois de "os vigias contam". */
  readonly sizes: Record<RaidSizeId, string>;
};

export const enemies: Record<EnemyId, EnemyDef> = {
  wolves: {
    label: 'lobos',
    sizes: { light: 'uma matilha pequena', medium: 'uma matilha grande' },
  },
  raiders: {
    label: 'saqueadores',
    sizes: { light: 'um punhado de saqueadores', medium: 'um bando de saqueadores' },
  },
  horde: {
    label: 'tropas da Horda',
    sizes: {
      light: 'uma pequena tropa de saqueadores',
      medium: 'uma tropa numerosa, de armas variadas',
    },
  },
};

/**
 * Como as frases chamam cada tamanho de incursão quando falam de ataques em geral, sem dizer de
 * quem: "segura ataques leves", "os médios ainda custam metade". O que os vigias dizem de um
 * bando que avistaram é de cada inimigo (`enemies`).
 */
export type RaidSizeDef = {
  /** No plural e em minúscula, para depois de "ataques": "leves". */
  readonly plural: string;
};

export const raidSizes: Record<RaidSizeId, RaidSizeDef> = {
  light: { plural: 'leves' },
  medium: { plural: 'médios' },
};
