import { describe, expect, it } from 'vitest';

import { goldenView, threatWatchedView } from '../test-helpers';
import {
  activeThreatSites,
  axialToPixel,
  defaultHexKey,
  FOG_LABELS,
  FOG_STATES,
  HEX_DRAW_RADIUS,
  HEX_SIZE,
  hexAccessibleLabel,
  hexDistance,
  hexFog,
  hexIcon,
  hexKey,
  hexPointsAttr,
  hexTerrain,
  hexTitle,
  hexVertices,
  isExploredHex,
  isHomeHex,
  isSightedHex,
  mapBounds,
  mapSummary,
  mapTreeLine,
  mapTreeTooltip,
  TERRAIN_ICONS,
  visibleLegendTerrains,
  type ExploredMapHex,
  type MapHex,
  type SightedMapHex,
} from './hexmap';

describe('geometria axial → SVG (ui/hexmap.ts)', () => {
  it('converte (0, 0) na origem e alinha linhas horizontais com r constante', () => {
    expect(axialToPixel(0, 0, 10)).toEqual({ x: 0, y: 0 });
    const east = axialToPixel(1, 0, 10);
    const west = axialToPixel(-1, 0, 10);
    expect(east.y).toBe(0);
    expect(west.y).toBe(0);
    expect(east.x).toBeCloseTo(10 * Math.sqrt(3), 2);
    expect(west.x).toBeCloseTo(-10 * Math.sqrt(3), 2);
  });

  it('coloca a borda norte (r = -5, onde nasce a Fortaleza em 2,-5) no topo do mapa', () => {
    const north = [0, 1, 2, 3, 4, 5].map((q) => axialToPixel(q, -5, HEX_SIZE));
    const minY = Math.min(...goldenView.map.hexes.map((hex) => axialToPixel(hex.q, hex.r).y));
    for (const point of north) {
      expect(point.y).toBe(minY);
    }
    const fortress = axialToPixel(2, -5, HEX_SIZE);
    const home = axialToPixel(0, 0, HEX_SIZE);
    expect(fortress.y).toBeLessThan(home.y);
    expect(Math.abs(fortress.x)).toBeLessThan(HEX_SIZE);
  });

  it('gera seis vértices regulares de ponta para cima no sentido horário', () => {
    const vertices = hexVertices({ x: 0, y: 0 }, 20);
    expect(vertices).toHaveLength(6);
    // Topo e base estão sobre o eixo vertical.
    expect(vertices[0]).toEqual({ x: 0, y: -20 });
    expect(vertices[3]).toEqual({ x: 0, y: 20 });
    for (const vertex of vertices) {
      const dist = Math.hypot(vertex.x, vertex.y);
      expect(dist).toBeCloseTo(20, 1);
    }
  });

  it('hexágonos adjacentes encostam com precisão quando desenhados com o mesmo raio da grade', () => {
    const a = hexVertices(axialToPixel(0, 0, 20), 20);
    const b = hexVertices(axialToPixel(1, 0, 20), 20);
    // Aresta direita de (0,0) = vértices 1 e 2; aresta esquerda de (1,0) = vértices 5 e 4.
    expect(a[1]?.x).toBeCloseTo(b[5]?.x ?? 0, 1);
    expect(a[1]?.y).toBeCloseTo(b[5]?.y ?? 0, 1);
    expect(a[2]?.x).toBeCloseTo(b[4]?.x ?? 0, 1);
    expect(a[2]?.y).toBeCloseTo(b[4]?.y ?? 0, 1);
  });

  it('formata o atributo points com seis pares x,y e sem valores inválidos', () => {
    const points = hexPointsAttr({ x: 10, y: -5 }, HEX_DRAW_RADIUS);
    const pairs = points.split(' ');
    expect(pairs).toHaveLength(6);
    for (const pair of pairs) {
      expect(pair).toMatch(/^-?\d+(\.\d+)?,-?\d+(\.\d+)?$/);
    }
  });

  it('calcula um viewBox que engloba todos os 91 hexágonos do golden com margem', () => {
    const bounds = mapBounds(goldenView.map.hexes, HEX_SIZE, 10);
    expect(bounds.viewBox).toBe(`${bounds.minX} ${bounds.minY} ${bounds.width} ${bounds.height}`);
    expect(bounds.width).toBeGreaterThan(0);
    expect(bounds.height).toBeGreaterThan(0);
    for (const hex of goldenView.map.hexes) {
      for (const vertex of hexVertices(axialToPixel(hex.q, hex.r, HEX_SIZE), HEX_SIZE)) {
        expect(vertex.x).toBeGreaterThanOrEqual(bounds.minX + 9.9);
        expect(vertex.x).toBeLessThanOrEqual(bounds.minX + bounds.width - 9.9);
        expect(vertex.y).toBeGreaterThanOrEqual(bounds.minY + 9.9);
        expect(vertex.y).toBeLessThanOrEqual(bounds.minY + bounds.height - 9.9);
      }
    }
  });

  it('trata grade vazia sem erro no mapBounds', () => {
    const empty = mapBounds([], 20, 5);
    expect(empty.width).toBe(50);
    expect(empty.height).toBe(50);
    expect(empty.viewBox).toBe('-25 -25 50 50');
  });

  it('calcula distância axial e chave de coordenada', () => {
    expect(hexKey(2, -5)).toBe('2,-5');
    expect(hexDistance(0, 0)).toBe(0);
    expect(hexDistance(1, 0)).toBe(1);
    expect(hexDistance(2, -5)).toBe(5);
    expect(hexDistance(-3, 2)).toBe(3);
  });
});

describe('apresentação da grade e respeito à névoa (ui/hexmap.ts)', () => {
  const unknownHex: MapHex = { q: 4, r: -4 };
  const sightedHex: SightedMapHex = {
    q: 1,
    r: -1,
    fog: 'sighted',
    terrain: 'forest',
    terrainLabel: 'Floresta',
  };
  const homeHex: ExploredMapHex = {
    q: 0,
    r: 0,
    fog: 'explored',
    terrain: 'fields',
    terrainLabel: 'Campos',
    site: null,
    label: 'Pedra Alta',
    detail: 'A planície se abre entre os caminhos do feudo.',
    actions: [],
  };
  const patrolHex: ExploredMapHex = {
    q: 1,
    r: 0,
    fog: 'explored',
    terrain: 'fields',
    terrainLabel: 'Campos',
    site: 'patrol',
    label: 'Patrulha nos Arredores',
    detail: 'A planície se abre entre os caminhos do feudo.',
    actions: [{ type: 'sendExpedition', modelId: 'patrol' }],
  };
  const campHex: ExploredMapHex = {
    q: 3,
    r: -4,
    fog: 'explored',
    terrain: 'hills',
    terrainLabel: 'Colinas',
    site: 'raiderCamp',
    label: 'Acampamento de Saqueadores',
    detail: 'Elevações de pedra se erguem sobre os campos.',
    actions: [{ type: 'attackCamp' }],
  };
  const claimedHex: ExploredMapHex = {
    q: -3,
    r: 0,
    fog: 'claimed',
    terrain: 'ironVein',
    terrainLabel: 'Veio de Ferro',
    site: null,
    label: 'Veio de Ferro',
    detail: 'O ferro aflora entre as rochas.',
    actions: [],
  };

  it('distingue os quatro estados de névoa e nunca vaza dado do Desconhecido', () => {
    expect(FOG_STATES).toEqual(['unknown', 'sighted', 'explored', 'claimed']);
    expect(Object.keys(FOG_LABELS).sort()).toEqual([...FOG_STATES].sort());
    expect(hexFog(unknownHex)).toBe('unknown');
    expect(hexTerrain(unknownHex)).toBeNull();
    expect(hexIcon(unknownHex)).toBeNull();
    expect(hexTitle(unknownHex)).toBe('Território desconhecido');
    expect(hexAccessibleLabel(unknownHex)).toBe('Hexágono (4, -4): Desconhecido');
    expect(isSightedHex(unknownHex)).toBe(false);
    expect(isExploredHex(unknownHex)).toBe(false);
  });

  it('no Avistado, mostra apenas o terreno e o estado', () => {
    expect(isSightedHex(sightedHex)).toBe(true);
    expect(isExploredHex(sightedHex)).toBe(false);
    expect(hexTerrain(sightedHex)).toBe('forest');
    expect(hexIcon(sightedHex)).toBe(TERRAIN_ICONS.forest);
    expect(hexTitle(sightedHex)).toBe('Floresta');
    expect(hexAccessibleLabel(sightedHex)).toBe('Hexágono (1, -1): Floresta, Avistado');
  });

  it('no Explorado e Reivindicado, escolhe ícone de sede, ação, ameaça, marco ou terreno', () => {
    expect(isHomeHex(homeHex)).toBe(true);
    expect(hexIcon(homeHex)).toBe('home');
    expect(hexAccessibleLabel(homeHex)).toBe('Pedra Alta (Campos), Explorado (0, 0)');
    expect(hexIcon(patrolHex)).toBe('compass');
    expect(hexIcon(campHex)).toBe('target');
    expect(hexIcon(claimedHex)).toBe('flag');
    expect(hexAccessibleLabel(claimedHex)).toBe('Veio de Ferro, Reivindicado (-3, 0)');

    const threats = activeThreatSites(threatWatchedView);
    expect(threats.has('wolfDen')).toBe(true);
    const denWithoutAction: ExploredMapHex = {
      ...campHex,
      site: 'wolfDen',
      label: 'Covil de Lobos',
      actions: [],
    };
    expect(hexIcon(denWithoutAction, threats)).toBe('warning');
    expect(hexIcon(denWithoutAction, new Set())).toBe('location');
  });

  it('resume o mapa do golden para a árvore e a legenda sem inventar terrenos escondidos', () => {
    expect(defaultHexKey(goldenView.map.hexes)).toBe('0,0');
    expect(defaultHexKey([])).toBeNull();
    expect(mapSummary(goldenView.map)).toEqual({
      explored: 1,
      claimed: 0,
      sighted: 36,
      unknown: 54,
      total: 91,
    });
    expect(mapTreeLine(goldenView.map)).toBe('1 explorado · 36 avistados');
    expect(mapTreeLine({ radius: 0, hexes: [] })).toBe('indisponível');
    expect(mapTreeTooltip(goldenView.map)).toBe('Explorado: 1 · Avistado: 36 · Desconhecido: 54');
    expect(
      mapTreeTooltip({
        radius: 1,
        hexes: [homeHex, patrolHex, unknownHex],
      }),
    ).toContain('Ações no mapa: Patrulha nos Arredores.');

    // A legenda só lista terrenos que aparecem nos hexágonos visíveis (nunca do Desconhecido).
    const legend = visibleLegendTerrains([unknownHex, sightedHex, homeHex]);
    expect(legend.map((entry) => entry.terrain)).toEqual(['forest', 'fields']);
    expect(legend.map((entry) => entry.label)).toEqual(['Floresta', 'Campos']);
  });
});
