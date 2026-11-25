import { useLayoutEffect, useRef } from 'preact/hooks';

import {
  axialToPixel,
  defaultHexKey,
  HEX_DRAW_RADIUS,
  HEX_ICON_SIZE,
  HEX_OUTPOST_CREST_RADIUS,
  hexAccessibleLabel,
  hexActions,
  hexFog,
  hexIcon,
  hexKey,
  hexOutpost,
  hexPointsAttr,
  hexTerrain,
  isExploredHex,
  isHomeHex,
  mapBounds,
  type MapHex,
  type MapView,
} from '../ui/hexmap';
import { hexKeyNav } from '../workbench/hexNav';

const ICON_HALF = HEX_ICON_SIZE / 2;
const ACTION_DOT_OFFSET_X = 11;
const ACTION_DOT_OFFSET_Y = -11;
const ACTION_DOT_RADIUS = 3.5;

function hexClasses(hex: MapHex, selected: boolean): string {
  const fog = hexFog(hex);
  const terrain = hexTerrain(hex);
  const outpost = hexOutpost(hex);
  const classes = ['hex-cell', `hex-fog-${fog}`];
  if (terrain !== null) {
    classes.push(`hex-terrain-${terrain}`);
  }
  if (isHomeHex(hex)) {
    classes.push('hex-home');
  }
  if (outpost !== null) {
    classes.push('hex-outpost', `hex-outpost-${outpost.status}`);
  }
  if (isExploredHex(hex) && hexActions(hex).length > 0) {
    classes.push('hex-actionable');
  }
  if (selected) {
    classes.push('hex-selected');
  }
  return classes.join(' ');
}

/**
 * Grade hexagonal em SVG (D-20, D-21): nenhuma regra de negócio nem estilo embutido (`style`).
 * Cores vêm só das classes e variáveis `--vscode-*` em `theme/themes.css`; ícones são Codicons.
 * O teclado usa foco itinerante (um único `tabIndex={0}` no SVG inteiro) com setas e `Home`.
 */
export function HexMap(props: {
  map: MapView;
  selectedKey: string | null;
  activeThreats?: ReadonlySet<string>;
  onSelect: (key: string) => void;
  onActivate: (key: string) => void;
}) {
  const { map, activeThreats } = props;
  const svgRef = useRef<SVGSVGElement>(null);
  const moveFocus = useRef(false);

  const byKey = new Map<string, MapHex>();
  for (const hex of map.hexes) {
    byKey.set(hexKey(hex.q, hex.r), hex);
  }
  const activeKey =
    props.selectedKey !== null && byKey.has(props.selectedKey)
      ? props.selectedKey
      : defaultHexKey(map.hexes);
  const keys = new Set(byKey.keys());
  const bounds = mapBounds(map.hexes);

  useLayoutEffect(() => {
    if (moveFocus.current) {
      moveFocus.current = false;
      svgRef.current?.querySelector<SVGElement>('[tabindex="0"]')?.focus();
    }
  });

  const onKeyDown = (hex: MapHex) => (event: KeyboardEvent) => {
    const result = hexKeyNav(keys, { q: hex.q, r: hex.r }, event.key);
    if (result === null) {
      return;
    }
    event.preventDefault();
    if (result.focus !== undefined) {
      moveFocus.current = true;
      props.onSelect(result.focus);
    }
    if (result.activate !== undefined) {
      props.onActivate(result.activate);
    }
  };

  const selectedHex = activeKey === null ? undefined : byKey.get(activeKey);
  const selectedCenter =
    selectedHex === undefined ? null : axialToPixel(selectedHex.q, selectedHex.r);

  return (
    <div class="hex-map-stage">
      <div class="hex-map-compass" aria-hidden="true">
        <span class="codicon codicon-arrow-small-up" /> Norte
      </div>
      <svg
        ref={svgRef}
        class="hex-map-svg"
        viewBox={bounds.viewBox}
        role="group"
        aria-label="Mapa hexagonal do reino"
      >
        {map.hexes.map((hex) => {
          const key = hexKey(hex.q, hex.r);
          const selected = key === activeKey;
          const fog = hexFog(hex);
          const terrain = hexTerrain(hex);
          const outpost = hexOutpost(hex);
          const center = axialToPixel(hex.q, hex.r);
          const icon = hexIcon(hex, activeThreats);
          const hasActions = isExploredHex(hex) && hexActions(hex).length > 0;
          return (
            <g
              key={key}
              class={hexClasses(hex, selected)}
              role="button"
              tabindex={selected ? 0 : -1}
              aria-label={hexAccessibleLabel(hex)}
              aria-pressed={selected}
              data-hex={key}
              data-fog={fog}
              data-terrain={terrain ?? undefined}
              data-outpost={outpost?.status}
              onClick={(event) => {
                props.onSelect(key);
                (event.currentTarget as SVGGElement).focus();
              }}
              onFocus={() => {
                if (!selected) {
                  props.onSelect(key);
                }
              }}
              onKeyDown={onKeyDown(hex)}
            >
              <polygon class="hex-poly" points={hexPointsAttr(center, HEX_DRAW_RADIUS)} />
              {outpost === null ? null : (
                <polygon
                  class={`hex-outpost-crest hex-outpost-crest-${outpost.status}`}
                  points={hexPointsAttr(center, HEX_OUTPOST_CREST_RADIUS)}
                  data-outpost-mark={outpost.status}
                  aria-hidden="true"
                />
              )}
              {icon === null ? null : (
                <foreignObject
                  class="hex-icon-box"
                  x={center.x - ICON_HALF}
                  y={center.y - ICON_HALF}
                  width={HEX_ICON_SIZE}
                  height={HEX_ICON_SIZE}
                  aria-hidden="true"
                >
                  <div class="hex-icon-wrap">
                    <span class={`codicon codicon-${icon}`} aria-hidden="true" />
                  </div>
                </foreignObject>
              )}
              {hasActions ? (
                <circle
                  class="hex-action-dot"
                  cx={center.x + ACTION_DOT_OFFSET_X}
                  cy={center.y + ACTION_DOT_OFFSET_Y}
                  r={ACTION_DOT_RADIUS}
                  aria-hidden="true"
                />
              ) : null}
            </g>
          );
        })}
        {selectedCenter === null ? null : (
          <g class="hex-selection-layer" aria-hidden="true">
            <polygon
              class="hex-selected-ring"
              points={hexPointsAttr(selectedCenter, HEX_DRAW_RADIUS)}
            />
          </g>
        )}
      </svg>
    </div>
  );
}
