/**
 * JSON canônico: chaves de objetos ordenadas recursivamente, ordem dos arrays preservada.
 * É a base do `request_hash` dos comandos e do ETag de `/view` (GDD §14.8): o mesmo valor
 * produz sempre o mesmo texto, não importa a ordem em que as chaves foram escritas.
 */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortKeys);
  }
  if (value !== null && typeof value === 'object') {
    const source = value as Record<string, unknown>;
    return Object.fromEntries(
      Object.keys(source)
        .sort()
        .map((key) => [key, sortKeys(source[key])]),
    );
  }
  return value;
}
