const BROWSERS: Array<[RegExp, string]> = [
  [/Edg\//, 'Edge'],
  [/OPR\//, 'Opera'],
  [/Firefox\//, 'Firefox'],
  [/Chrome\//, 'Chrome'],
  [/Safari\//, 'Safari'],
];

const SYSTEMS: Array<[RegExp, string]> = [
  [/Android/, 'Android'],
  [/iPhone|iPad|iPod/, 'iOS'],
  [/Windows/, 'Windows'],
  [/Mac OS X|Macintosh/, 'macOS'],
  [/CrOS/, 'ChromeOS'],
  [/Linux/, 'Linux'],
];

/**
 * O rótulo desta sessão no servidor ("Firefox em Linux"), tirado do `User-Agent`. Serve para o
 * jogador reconhecer de onde entrou; não identifica a máquina.
 */
export function deviceLabel(userAgent: string): string {
  const browser = BROWSERS.find(([pattern]) => pattern.test(userAgent))?.[1] ?? 'Navegador';
  const system = SYSTEMS.find(([pattern]) => pattern.test(userAgent))?.[1];
  return system === undefined ? browser : `${browser} em ${system}`;
}
