import { hexKey } from '../ui/hexmap';

export type HexCoord = { readonly q: number; readonly r: number };

export type HexNavResult = {
  /** Chave `"q,r"` do hexágono que recebe o foco. */
  focus?: string;
  /** Chave `"q,r"` acionada (`Enter` ou espaço): leva o foco à ficha ao lado. */
  activate?: string;
};

function firstAvailable(keys: ReadonlySet<string>): string | undefined {
  if (keys.has('0,0')) {
    return '0,0';
  }
  for (const key of keys) {
    return key;
  }
  return undefined;
}

function pickFirst(
  keys: ReadonlySet<string>,
  candidates: ReadonlyArray<readonly [number, number]>,
): HexNavResult {
  for (const [q, r] of candidates) {
    const key = hexKey(q, r);
    if (keys.has(key)) {
      return { focus: key };
    }
  }
  return {};
}

/**
 * Teclado da grade hexagonal (foco itinerante / roving tabindex):
 * - `ArrowLeft` / `ArrowRight` caminham na mesma linha (`r` constante);
 * - `ArrowUp` / `ArrowDown` alternam o deslocamento conforme a paridade de `r` para manter o
 *   trajeto vertical sem derivar para a diagonal, usando o outro vizinho superior/inferior como
 *   saída junto às bordas;
 * - `Home` volta ao centro `(0, 0)` (a sede do feudo);
 * - `Enter` e espaço acionam o hexágono em foco para abrir/focar a ficha ao lado.
 *
 * Devolve `null` para as outras teclas (`Tab`, `F1`, `Escape`, etc.) para o navegador cuidar delas.
 */
export function hexKeyNav(
  keys: ReadonlySet<string>,
  current: HexCoord | null,
  key: string,
): HexNavResult | null {
  if (keys.size === 0) {
    return null;
  }
  const currentKey = current === null ? null : hexKey(current.q, current.r);
  const valid = current !== null && currentKey !== null && keys.has(currentKey);
  if (!valid) {
    switch (key) {
      case 'ArrowLeft':
      case 'ArrowRight':
      case 'ArrowUp':
      case 'ArrowDown':
      case 'Home': {
        const fallback = firstAvailable(keys);
        return fallback === undefined ? {} : { focus: fallback };
      }
      case 'Enter':
      case ' ':
        return {};
      default:
        return null;
    }
  }
  const { q, r } = current;
  const evenRow = (r & 1) === 0;
  switch (key) {
    case 'ArrowRight':
      return pickFirst(keys, [[q + 1, r]]);
    case 'ArrowLeft':
      return pickFirst(keys, [[q - 1, r]]);
    case 'ArrowUp':
      return pickFirst(
        keys,
        evenRow
          ? [
              [q, r - 1],
              [q + 1, r - 1],
            ]
          : [
              [q + 1, r - 1],
              [q, r - 1],
            ],
      );
    case 'ArrowDown':
      return pickFirst(
        keys,
        evenRow
          ? [
              [q - 1, r + 1],
              [q, r + 1],
            ]
          : [
              [q, r + 1],
              [q - 1, r + 1],
            ],
      );
    case 'Home': {
      const target = firstAvailable(keys);
      return target === undefined ? {} : { focus: target };
    }
    case 'Enter':
    case ' ':
      return { activate: currentKey };
    default:
      return null;
  }
}
