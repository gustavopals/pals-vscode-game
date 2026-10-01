import { describe, expect, it } from 'vitest';

import base from './styles/base.css?raw';
import fonts from './styles/fonts.css?raw';
import main from './styles/main.css?raw';
import page from './styles/page.css?raw';
import tokens from './styles/tokens.css?raw';

/**
 * As folhas de estilo lidas como texto, como no app web: cor só em tokens.css, toda variável
 * usada existe, e cada par de texto e fundo da página tem contraste de leitura.
 */

const sheets = { 'base.css': base, 'fonts.css': fonts, 'main.css': main, 'page.css': page };
const withoutComments = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '');

const variables = new Map(
  [...withoutComments(tokens).matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map(
    (match) => [match[1] ?? '', (match[2] ?? '').trim()] as const,
  ),
);
const color = (name: string): string => {
  const value = variables.get(`--${name}`);
  if (value === undefined) throw new Error(`tokens.css não define --${name}.`);
  return value;
};

/** Luminância relativa de uma cor `#rrggbb` (WCAG 2.x). */
function luminance(hex: string): number {
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (match === null) throw new Error(`Cor fora do formato #rrggbb: "${hex}".`);
  const [red, green, blue] = [match[1], match[2], match[3]].map((channel) => {
    const value = parseInt(channel ?? '0', 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * (red ?? 0) + 0.7152 * (green ?? 0) + 0.0722 * (blue ?? 0);
}

/** Razão de contraste WCAG entre duas cores, de 1 a 21. */
function contrast(a: string, b: string): number {
  const [lighter, darker] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return ((lighter ?? 0) + 0.05) / ((darker ?? 0) + 0.05);
}

describe('cores', () => {
  it('a medida de contraste confere com os valores de referência', () => {
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrast('#767676', '#ffffff')).toBeGreaterThanOrEqual(4.5);
    expect(contrast('#777777', '#ffffff')).toBeLessThan(4.5);
  });

  it.each(Object.entries(sheets))('%s não tem cor escrita: só variáveis', (_name, css) => {
    const rules = withoutComments(css);
    expect(rules).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(rules).not.toMatch(/\b(rgb|rgba|hsl|hsla|oklch|oklab|color-mix)\(/);
    expect(rules).not.toMatch(
      /:\s*(white|black|red|green|blue|gray|grey|yellow|orange|gold|navy)\s*[;!]/i,
    );
  });

  it('toda variável usada nas folhas está definida em tokens.css', () => {
    const used = new Set(
      Object.values(sheets)
        .concat(tokens)
        .flatMap((css) => [...withoutComments(css).matchAll(/var\((--[\w-]+)/g)])
        .map((match) => match[1] ?? ''),
    );
    expect(used.size).toBeGreaterThan(10);
    for (const name of used) expect(variables.has(name), name).toBe(true);
  });

  it('as cores são todas #rrggbb, o formato que o teste de contraste sabe medir', () => {
    const colors = [...variables].filter(([, value]) => value.startsWith('#'));
    expect(colors.length).toBeGreaterThanOrEqual(10);
    for (const [name, value] of colors) expect(value, name).toMatch(/^#[0-9a-f]{6}$/);
  });

  // Texto sobre fundo, como a página usa. 4,5 para texto corrido; 3 para letra grande.
  const TEXT: ReadonlyArray<readonly [text: string, background: string]> = [
    ['ivory', 'blue'],
    ['margin', 'blue'],
    ['ivory', 'night'],
    ['margin', 'night'],
    ['gold', 'night'],
    ['night', 'gold'],
    ['night', 'office'],
    ['office-ink', 'office'],
    ['night', 'ivory'],
    ['white', 'status'],
    // O ouro sobre o azul fica só em títulos, na marca e nos nomes das estações.
    ['gold', 'blue'],
  ];

  it.each(TEXT)('%s sobre %s tem contraste de leitura (4,5:1)', (text, background) => {
    expect(contrast(color(text), color(background))).toBeGreaterThanOrEqual(4.5);
  });

  // O que não é texto: a moldura da captura, o fio dos rótulos, o anel de foco, o filete da barra.
  const MARKS: ReadonlyArray<readonly [mark: string, background: string]> = [
    ['ivory', 'blue'],
    ['gold', 'blue'],
    ['ivory', 'night'],
    ['status', 'office'],
    ['night', 'gold'],
    ['gold', 'status'],
  ];

  it.each(MARKS)('%s sobre %s se distingue como contorno (3:1)', (mark, background) => {
    expect(contrast(color(mark), color(background))).toBeGreaterThanOrEqual(3);
  });
});

describe('letras', () => {
  it('as duas famílias são arquivos desta página, com troca visível enquanto carregam', () => {
    const faces = withoutComments(fonts).match(/@font-face\s*\{[^}]*\}/g) ?? [];
    expect(faces).toHaveLength(2);
    for (const face of faces) {
      expect(face).toMatch(/src: url\('\.\.\/fonts\/[\w-]+\.woff2'\) format\('woff2'\);/);
      expect(face).toContain('font-display: swap;');
    }
  });

  it('nada de negrito ou itálico sintético: cada família tem um arquivo só', () => {
    expect(base).toContain('font-synthesis: none;');
  });
});

describe('acesso', () => {
  it('quem pediu menos movimento não vê transição nem animação', () => {
    const reduced = /@media \(prefers-reduced-motion: reduce\)\s*\{([\s\S]*?)\n\}/.exec(base)?.[1];
    expect(reduced).toContain('animation: none !important;');
    expect(reduced).toContain('transition: none !important;');
  });

  it('o foco do teclado é sempre visível', () => {
    expect(base).toMatch(/:focus-visible\s*\{[^}]*outline: 3px solid var\(--ivory\)/);
    expect(withoutComments(base + page)).not.toMatch(/outline:\s*(none|0)\b/);
  });

  it('a página não se mexe sozinha: nenhuma animação declarada', () => {
    expect(withoutComments(base + page)).not.toMatch(/@keyframes|animation(-name)?\s*:(?!\s*none)/);
  });
});

describe('main.css', () => {
  it('importa as folhas na ordem: cores e letras, base, página', () => {
    const imports = [...main.matchAll(/@import '\.\/([\w-]+\.css)';/g)].map((match) => match[1]);
    expect(imports).toEqual(['tokens.css', 'fonts.css', 'base.css', 'page.css']);
  });
});
