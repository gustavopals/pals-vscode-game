import type { ViewState } from '@lotg/protocol';

export type MapView = ViewState['map'];
export type MapHex = MapView['hexes'][number];
export type SightedMapHex = Extract<MapHex, { fog: 'sighted' }>;
export type ExploredMapHex = Extract<MapHex, { fog: 'explored' | 'claimed' }>;
export type MapAction = ExploredMapHex['actions'][number];
export type MapTerrain = SightedMapHex['terrain'];
export type FogState = 'unknown' | 'sighted' | 'explored' | 'claimed';

export type Point = { readonly x: number; readonly y: number };
export type HexBounds = {
  readonly minX: number;
  readonly minY: number;
  readonly width: number;
  readonly height: number;
  readonly viewBox: string;
};

/** Raio de espaçamento entre centros na grade axial (hexágonos de ponta para cima). */
export const HEX_SIZE = 32;
/** Raio do polígono desenhado: pequena folga para manter as bordas nítidas entre vizinhos. */
export const HEX_DRAW_RADIUS = 30.5;
/** Margem do `viewBox` ao redor dos vértices externos para o foco não cortar. */
export const HEX_PADDING = 14;
/** Caixa do ícone Codicon no centro do hexágono. */
export const HEX_ICON_SIZE = 22;

export const MAP_ICON = 'map';

export const FOG_STATES: readonly FogState[] = ['unknown', 'sighted', 'explored', 'claimed'];

export const FOG_LABELS: Readonly<Record<FogState, string>> = {
  unknown: 'Desconhecido',
  sighted: 'Avistado',
  explored: 'Explorado',
  claimed: 'Reivindicado',
};

/** Ícone Codicon por terreno, usado na ficha, na legenda e nos hexágonos sem marcador próprio. */
export const TERRAIN_ICONS: Readonly<Record<MapTerrain, string>> = {
  forest: 'chevron-up',
  hills: 'triangle-up',
  fields: 'dash',
  lake: 'pulse',
  swamp: 'cloud',
  ruins: 'library',
  ironVein: 'ruby',
  sanctuary: 'sparkle',
};

const SQRT3 = Math.sqrt(3);

function round(value: number): number {
  const rounded = Math.round(value * 100) / 100;
  return Object.is(rounded, -0) ? 0 : rounded;
}

/** Chave estável de um hexágono em coordenadas axiais (`"q,r"`). */
export function hexKey(q: number, r: number): string {
  return `${q},${r}`;
}

/** Distância axial a partir da sede do feudo `(0, 0)`. */
export function hexDistance(q: number, r: number): number {
  return Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r));
}

export function isHomeHex(hex: Pick<MapHex, 'q' | 'r'>): boolean {
  return hex.q === 0 && hex.r === 0;
}

export function hexFog(hex: MapHex): FogState {
  return 'fog' in hex ? hex.fog : 'unknown';
}

export function hexTerrain(hex: MapHex): MapTerrain | null {
  return 'terrain' in hex ? hex.terrain : null;
}

export function isSightedHex(hex: MapHex): hex is SightedMapHex {
  return 'fog' in hex && hex.fog === 'sighted';
}

export function isExploredHex(hex: MapHex): hex is ExploredMapHex {
  return 'fog' in hex && (hex.fog === 'explored' || hex.fog === 'claimed');
}

/**
 * Converte coordenadas axiais `(q, r)` para o centro `(x, y)` no plano do SVG, com hexágonos de
 * ponta para cima: linhas horizontais têm `r` constante e a borda norte (`r = -5`) fica no alto.
 */
export function axialToPixel(q: number, r: number, size: number = HEX_SIZE): Point {
  return {
    x: round(size * SQRT3 * (q + r / 2)),
    y: round(size * 1.5 * r),
  };
}

/** Os seis vértices de um hexágono de ponta para cima, do topo no sentido horário. */
export function hexVertices(center: Point, radius: number = HEX_DRAW_RADIUS): readonly Point[] {
  const vertices: Point[] = [];
  for (let index = 0; index < 6; index += 1) {
    const angle = ((60 * index - 90) * Math.PI) / 180;
    vertices.push({
      x: round(center.x + radius * Math.cos(angle)),
      y: round(center.y + radius * Math.sin(angle)),
    });
  }
  return vertices;
}

/** Valor do atributo `points` de um `<polygon>` SVG para um hexágono centrado em `center`. */
export function hexPointsAttr(center: Point, radius: number = HEX_DRAW_RADIUS): string {
  return hexVertices(center, radius)
    .map((vertex) => `${vertex.x},${vertex.y}`)
    .join(' ');
}

/** Enquadramento (`viewBox`) que envolve todos os hexágonos da grade com margem uniforme. */
export function mapBounds(
  hexes: readonly Pick<MapHex, 'q' | 'r'>[],
  size: number = HEX_SIZE,
  padding: number = HEX_PADDING,
): HexBounds {
  if (hexes.length === 0) {
    const span = round((size + padding) * 2);
    const min = round(-(size + padding));
    return {
      minX: min,
      minY: min,
      width: span,
      height: span,
      viewBox: `${min} ${min} ${span} ${span}`,
    };
  }
  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  const halfWidth = (size * SQRT3) / 2;
  for (const hex of hexes) {
    const center = axialToPixel(hex.q, hex.r, size);
    if (center.x - halfWidth < minX) minX = center.x - halfWidth;
    if (center.x + halfWidth > maxX) maxX = center.x + halfWidth;
    if (center.y - size < minY) minY = center.y - size;
    if (center.y + size > maxY) maxY = center.y + size;
  }
  const left = round(minX - padding);
  const top = round(minY - padding);
  const width = round(maxX - minX + padding * 2);
  const height = round(maxY - minY + padding * 2);
  return {
    minX: left,
    minY: top,
    width,
    height,
    viewBox: `${left} ${top} ${width} ${height}`,
  };
}

/** Identificadores de tiles de ameaça atualmente ativos segundo a visão (com Torre de Vigia). */
export function activeThreatSites(view: ViewState): ReadonlySet<string> {
  if (!view.threat.known) {
    return new Set();
  }
  return new Set(view.threat.tiles.filter((tile) => tile.active).map((tile) => tile.id));
}

/**
 * Ícone Codicon exibido dentro de um hexágono. Desconhecido não traz ícone (só a casa vazia);
 * Avistado traz o do terreno; Explorado destaca a sede, ações disponíveis, ameaças e marcos.
 */
export function hexIcon(hex: MapHex, activeThreats?: ReadonlySet<string>): string | null {
  if (!('fog' in hex)) {
    return null;
  }
  if (isSightedHex(hex)) {
    return TERRAIN_ICONS[hex.terrain];
  }
  if (hex.fog === 'claimed') {
    return 'flag';
  }
  if (isHomeHex(hex)) {
    return 'home';
  }
  if (hex.actions.some((action) => action.type === 'attackCamp')) {
    return 'target';
  }
  if (hex.actions.some((action) => action.type === 'sendExpedition')) {
    return 'compass';
  }
  if (hex.site !== null && activeThreats?.has(hex.site) === true) {
    return 'warning';
  }
  if (hex.site !== null) {
    return 'location';
  }
  return TERRAIN_ICONS[hex.terrain];
}

/** Título principal exibido na ficha do hexágono, respeitando estritamente a névoa. */
export function hexTitle(hex: MapHex): string {
  if (!('fog' in hex)) {
    return 'Território desconhecido';
  }
  if (hex.fog === 'sighted') {
    return hex.terrainLabel;
  }
  return hex.label;
}

/** Nome acessível do hexágono no SVG: nunca revela dado além do estado de névoa. */
export function hexAccessibleLabel(hex: MapHex): string {
  const coords = `(${hex.q}, ${hex.r})`;
  if (!('fog' in hex)) {
    return `Hexágono ${coords}: ${FOG_LABELS.unknown}`;
  }
  if (hex.fog === 'sighted') {
    return `Hexágono ${coords}: ${hex.terrainLabel}, ${FOG_LABELS.sighted}`;
  }
  const fogLabel = FOG_LABELS[hex.fog];
  if (hex.label !== hex.terrainLabel) {
    return `${hex.label} (${hex.terrainLabel}), ${fogLabel} ${coords}`;
  }
  return `${hex.label}, ${fogLabel} ${coords}`;
}

/** Hexágono focado inicialmente ao abrir a aba: o feudo `(0, 0)` quando presente. */
export function defaultHexKey(hexes: readonly MapHex[]): string | null {
  if (hexes.length === 0) {
    return null;
  }
  const home = hexes.find(isHomeHex);
  const first = home ?? hexes[0];
  return first === undefined ? null : hexKey(first.q, first.r);
}

export type MapSummary = {
  readonly explored: number;
  readonly claimed: number;
  readonly sighted: number;
  readonly unknown: number;
  readonly total: number;
};

/** Contagens por estado de névoa diretamente a partir da grade recebida na visão. */
export function mapSummary(map: MapView): MapSummary {
  let explored = 0;
  let claimed = 0;
  let sighted = 0;
  let unknown = 0;
  for (const hex of map.hexes) {
    switch (hexFog(hex)) {
      case 'explored':
        explored += 1;
        break;
      case 'claimed':
        claimed += 1;
        break;
      case 'sighted':
        sighted += 1;
        break;
      case 'unknown':
        unknown += 1;
        break;
    }
  }
  return { explored, claimed, sighted, unknown, total: map.hexes.length };
}

/** Descrição curta da entrada "Mapa" na árvore lateral. */
export function mapTreeLine(map: MapView): string {
  if (map.hexes.length === 0) {
    return 'indisponível';
  }
  const counts = mapSummary(map);
  const revealed = counts.explored + counts.claimed;
  const parts = [
    `${revealed} ${revealed === 1 ? 'explorado' : 'explorados'}`,
    `${counts.sighted} ${counts.sighted === 1 ? 'avistado' : 'avistados'}`,
  ];
  return parts.join(' · ');
}

/** Dica da entrada "Mapa" na árvore lateral. */
export function mapTreeTooltip(map: MapView): string {
  if (map.hexes.length === 0) {
    return 'Mapa do reino ainda indisponível.';
  }
  const counts = mapSummary(map);
  const lines = [
    [
      `${FOG_LABELS.explored}: ${counts.explored}`,
      ...(counts.claimed > 0 ? [`${FOG_LABELS.claimed}: ${counts.claimed}`] : []),
      `${FOG_LABELS.sighted}: ${counts.sighted}`,
      `${FOG_LABELS.unknown}: ${counts.unknown}`,
    ].join(' · '),
  ];
  const actionable = map.hexes.filter((hex) => isExploredHex(hex) && hex.actions.length > 0);
  if (actionable.length > 0) {
    lines.push(
      `Ações no mapa: ${actionable.map((hex) => (isExploredHex(hex) ? hex.label : '')).join(', ')}.`,
    );
  }
  return lines.join('\n');
}

export type LegendTerrain = {
  readonly terrain: MapTerrain;
  readonly label: string;
  readonly icon: string;
};

/**
 * Terrenos atualmente visíveis na grade (Avistados, Explorados ou Reivindicados), usando os
 * rótulos entregues pela visão: não antecipa terrenos escondidos pela névoa nem escreve nomes fixos.
 */
export function visibleLegendTerrains(hexes: readonly MapHex[]): LegendTerrain[] {
  const seen = new Map<MapTerrain, string>();
  for (const hex of hexes) {
    if ('terrain' in hex && !seen.has(hex.terrain)) {
      seen.set(hex.terrain, hex.terrainLabel);
    }
  }
  return [...seen.entries()].map(([terrain, label]) => ({
    terrain,
    label,
    icon: TERRAIN_ICONS[terrain],
  }));
}
