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
};

// GDD §8.2: na v0.2 o único tile de ameaça é o Covil de Lobos.
export const tileTypes: Record<TileTypeId, TileTypeDef> = {
  wolfDen: { label: 'Covil de Lobos', article: 'o', enemy: 'wolves' },
};

/**
 * Os tiles com que todo feudo nasce: o Covil de Lobos, ativo desde o dia 1 (ADR 0014, decisão
 * 11). `id` é a chave do tile no estado; não há como limpar um tile nesta versão.
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
