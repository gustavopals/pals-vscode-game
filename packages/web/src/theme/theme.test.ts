import { describe, expect, it } from 'vitest';

import { THEMES, type ThemeId } from '../services/preferences';
import { applyTheme, nextTheme, resolveTheme, systemTheme, THEME_LABELS } from './theme';

// O CSS é lido como texto pelo Vitest, sem tocar o sistema de arquivos.
const sheets = import.meta.glob<string>('./themes.css', {
  query: '?inline',
  import: 'default',
  eager: true,
});
const css = (sheets['./themes.css'] ?? '').replace(/\/\*[\s\S]*?\*\//g, '');

type Block = { selector: string; declarations: Map<string, string> };

/** Os blocos de regras da folha, com as declarações de cada um. */
function parseBlocks(source: string): Block[] {
  return [...source.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((match) => ({
    selector: (match[1] ?? '').replace(/\s+/g, ' ').trim(),
    declarations: new Map(
      [...(match[2] ?? '').matchAll(/([\w-]+)\s*:\s*([^;]+);/g)].map(
        (declaration) => [declaration[1] ?? '', (declaration[2] ?? '').trim()] as const,
      ),
    ),
  }));
}

const blocks = parseBlocks(css);
const themeBlock = (theme: ThemeId): Block => {
  const found = blocks.find((block) => block.selector.includes(`[data-theme='${theme}']`));
  if (found === undefined) {
    throw new Error(`themes.css não tem o tema ${theme}.`);
  }
  return found;
};
const variables = (theme: ThemeId) =>
  [...themeBlock(theme).declarations.keys()].filter((name) => name.startsWith('--vscode-')).sort();

/** Luminância relativa de uma cor `#rrggbb` (WCAG 2.x). */
function luminance(hex: string): number {
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (match === null) {
    throw new Error(`Cor de texto ou fundo fora do formato #rrggbb: "${hex}".`);
  }
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

describe('escolha do tema', () => {
  const system = (prefersLight: boolean, prefersMoreContrast: boolean) => ({
    prefersLight,
    prefersMoreContrast,
  });

  it('a escolha do jogador vale mais que qualquer preferência do sistema', () => {
    for (const chosen of THEMES) {
      for (const light of [true, false]) {
        for (const moreContrast of [true, false]) {
          expect(resolveTheme(chosen, system(light, moreContrast))).toBe(chosen);
        }
      }
    }
  });

  it('na primeira visita, prefers-contrast vale mais que prefers-color-scheme', () => {
    expect(resolveTheme(null, system(true, true))).toBe('high-contrast');
    expect(resolveTheme(null, system(false, true))).toBe('high-contrast');
  });

  it('na primeira visita, sem pedido de contraste, vale prefers-color-scheme; o padrão é o escuro', () => {
    expect(resolveTheme(null, system(true, false))).toBe('light');
    expect(resolveTheme(null, system(false, false))).toBe('dark');
  });

  it('"Trocar tema" anda em ciclo: escuro → claro → alto contraste → escuro', () => {
    expect(nextTheme('dark')).toBe('light');
    expect(nextTheme('light')).toBe('high-contrast');
    expect(nextTheme('high-contrast')).toBe('dark');
    // O ciclo passa por todos os temas e volta ao começo.
    let theme: ThemeId = 'dark';
    const seen: ThemeId[] = [];
    for (let step = 0; step < THEMES.length; step += 1) {
      seen.push(theme);
      theme = nextTheme(theme);
    }
    expect([...seen].sort()).toEqual([...THEMES].sort());
    expect(theme).toBe('dark');
  });

  it('cada tema tem um nome em português', () => {
    expect(THEME_LABELS).toEqual({
      dark: 'Escuro',
      light: 'Claro',
      'high-contrast': 'Alto contraste',
    });
  });
});

describe('preferência do sistema (systemTheme)', () => {
  const media = (matching: string[]) => {
    const asked: string[] = [];
    const matchMedia = (query: string) => {
      asked.push(query);
      return { matches: matching.includes(query) };
    };
    return { matchMedia, asked };
  };

  it('pergunta ao navegador por esquema claro e por mais contraste', () => {
    const { matchMedia, asked } = media([]);
    expect(systemTheme(matchMedia)).toEqual({ prefersLight: false, prefersMoreContrast: false });
    expect([...asked].sort()).toEqual([
      '(prefers-color-scheme: light)',
      '(prefers-contrast: more)',
    ]);
  });

  it('reflete cada resposta do navegador', () => {
    expect(systemTheme(media(['(prefers-color-scheme: light)']).matchMedia)).toEqual({
      prefersLight: true,
      prefersMoreContrast: false,
    });
    expect(systemTheme(media(['(prefers-contrast: more)']).matchMedia)).toEqual({
      prefersLight: false,
      prefersMoreContrast: true,
    });
    expect(
      systemTheme(media(['(prefers-color-scheme: light)', '(prefers-contrast: more)']).matchMedia),
    ).toEqual({ prefersLight: true, prefersMoreContrast: true });
  });

  it('sem matchMedia (navegador antigo, teste), não prefere nada: vale o tema escuro', () => {
    const system = systemTheme(undefined);
    expect(system).toEqual({ prefersLight: false, prefersMoreContrast: false });
    expect(resolveTheme(null, system)).toBe('dark');
  });

  it('do sistema ao tema: claro, escuro e alto contraste', () => {
    expect(
      resolveTheme(null, systemTheme(media(['(prefers-color-scheme: light)']).matchMedia)),
    ).toBe('light');
    expect(resolveTheme(null, systemTheme(media([]).matchMedia))).toBe('dark');
    expect(
      resolveTheme(
        null,
        systemTheme(
          media(['(prefers-color-scheme: light)', '(prefers-contrast: more)']).matchMedia,
        ),
      ),
    ).toBe('high-contrast');
  });
});

describe('applyTheme', () => {
  it('marca o tema em data-theme, que é o que themes.css lê', () => {
    const root = { dataset: {} as Record<string, string | undefined> };
    applyTheme(root, 'light');
    expect(root.dataset.theme).toBe('light');
    applyTheme(root, 'high-contrast');
    expect(root.dataset.theme).toBe('high-contrast');
    // Todo valor que applyTheme pode gravar tem um bloco na folha de temas.
    for (const theme of THEMES) {
      applyTheme(root, theme);
      expect(css).toContain(`[data-theme='${root.dataset.theme}']`);
    }
  });

  it('não mexe em outros dados do elemento', () => {
    const root = { dataset: { outro: 'valor' } as Record<string, string | undefined> };
    applyTheme(root, 'dark');
    expect(root.dataset).toEqual({ outro: 'valor', theme: 'dark' });
  });
});

describe('themes.css', () => {
  it('a folha foi lida e tem um bloco para cada tema', () => {
    expect(css.length).toBeGreaterThan(1000);
    for (const theme of THEMES) {
      expect(variables(theme).length).toBeGreaterThan(40);
    }
    // Nenhum bloco de tema além dos três.
    const declared = [...css.matchAll(/\[data-theme='([a-z-]+)'\]/g)].map((match) => match[1]);
    expect([...new Set(declared)].sort()).toEqual([...THEMES].sort());
  });

  it('os três temas definem exatamente o mesmo conjunto de variáveis --vscode-*', () => {
    const dark = variables('dark');
    for (const theme of ['light', 'high-contrast'] as const) {
      const other = variables(theme);
      expect(other.filter((name) => !dark.includes(name))).toEqual([]);
      expect(dark.filter((name) => !other.includes(name))).toEqual([]);
    }
  });

  it('nenhum tema define a mesma variável duas vezes', () => {
    for (const theme of THEMES) {
      const selector = themeBlock(theme).selector;
      const body = new RegExp(
        `${selector.replace(/[[\]'.*+?^$()|\\]/g, '\\$&')}\\s*\\{([^}]*)\\}`,
      ).exec(css.replace(/\s+/g, ' '))?.[1];
      const names = [...(body ?? '').matchAll(/(--vscode-[\w-]+)\s*:/g)].map((match) => match[1]);
      expect(names.length).toBe(variables(theme).length);
    }
  });

  it('sem data-theme (antes do script rodar), vale o tema escuro', () => {
    const selectors = themeBlock('dark')
      .selector.split(',')
      .map((selector) => selector.trim());
    expect(selectors).toContain(':root');
    for (const theme of ['light', 'high-contrast'] as const) {
      expect(themeBlock(theme).selector).toBe(`:root[data-theme='${theme}']`);
    }
  });

  it('cada tema diz ao navegador se é claro ou escuro (color-scheme)', () => {
    expect(themeBlock('dark').declarations.get('color-scheme')).toBe('dark');
    expect(themeBlock('light').declarations.get('color-scheme')).toBe('light');
    expect(themeBlock('high-contrast').declarations.get('color-scheme')).toBe('dark');
  });

  it('o tema claro tem fundo claro; os outros, escuro', () => {
    const background = (theme: ThemeId) =>
      luminance(themeBlock(theme).declarations.get('--vscode-editor-background') ?? '');
    expect(background('light')).toBeGreaterThan(0.8);
    expect(background('dark')).toBeLessThan(0.1);
    expect(background('high-contrast')).toBe(0);
  });

  it('a conta do contraste confere com os valores de referência da WCAG', () => {
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrast('#ffffff', '#000000')).toBeCloseTo(21, 5);
    expect(contrast('#777777', '#777777')).toBe(1);
    // #767676 sobre branco é o cinza clássico que passa por pouco em 4,5:1; #777777 não passa.
    expect(contrast('#767676', '#ffffff')).toBeGreaterThanOrEqual(4.5);
    expect(contrast('#777777', '#ffffff')).toBeLessThan(4.5);
  });

  /**
   * Os pares de texto e fundo que as folhas de estilo de fato combinam (`styles.css` e
   * `workbench.css`): [o que é, variável do texto, variável do fundo].
   */
  const PAIRS: ReadonlyArray<readonly [string, string, string]> = [
    ['texto no editor', 'foreground', 'editor-background'],
    ['descrição no editor', 'descriptionForeground', 'editor-background'],
    ['descrição na barra lateral', 'descriptionForeground', 'sideBar-background'],
    ['descrição em avisos e cartões', 'descriptionForeground', 'editorWidget-background'],
    ['descrição na linha sob o mouse', 'descriptionForeground', 'list-hoverBackground'],
    ['texto da barra lateral', 'sideBar-foreground', 'sideBar-background'],
    ['texto da barra lateral sob o mouse', 'sideBar-foreground', 'list-hoverBackground'],
    ['título da barra lateral', 'sideBarTitle-foreground', 'sideBar-background'],
    ['botão', 'button-foreground', 'button-background'],
    ['botão sob o mouse', 'button-foreground', 'button-hoverBackground'],
    ['botão secundário', 'button-secondaryForeground', 'button-secondaryBackground'],
    [
      'botão secundário sob o mouse',
      'button-secondaryForeground',
      'button-secondaryHoverBackground',
    ],
    ['barra de status', 'statusBar-foreground', 'statusBar-background'],
    ['barra de status sob o mouse', 'statusBar-foreground', 'statusBarItem-hoverBackground'],
    [
      'barra de status com fome',
      'statusBarItem-warningForeground',
      'statusBarItem-warningBackground',
    ],
    ['barra de status sem ligação', 'statusBar-foreground', 'statusBarItem-offlineBackground'],
    ['aba ativa', 'tab-activeForeground', 'tab-activeBackground'],
    ['aba inativa', 'tab-inactiveForeground', 'tab-inactiveBackground'],
    ['ícone ativo da barra de atividades', 'activityBar-foreground', 'activityBar-background'],
    [
      'ícone inativo da barra de atividades',
      'activityBar-inactiveForeground',
      'activityBar-background',
    ],
    ['badge da barra de atividades', 'activityBarBadge-foreground', 'activityBarBadge-background'],
    ['badge', 'badge-foreground', 'badge-background'],
    [
      'linha selecionada da árvore',
      'list-activeSelectionForeground',
      'list-activeSelectionBackground',
    ],
    ['item em foco na paleta', 'quickInputList-focusForeground', 'quickInputList-focusBackground'],
    ['texto da paleta', 'quickInput-foreground', 'quickInput-background'],
    ['descrição na paleta', 'descriptionForeground', 'quickInput-background'],
    ['link no editor', 'textLink-foreground', 'editor-background'],
    ['link em avisos e cartões', 'textLink-foreground', 'editorWidget-background'],
    ['texto de aviso no editor', 'editorWarning-foreground', 'editor-background'],
    ['texto de aviso em cartões', 'editorWarning-foreground', 'editorWidget-background'],
    ['texto de erro no editor', 'editorError-foreground', 'editor-background'],
    ['campo de texto', 'input-foreground', 'input-background'],
    ['texto de exemplo do campo', 'input-placeholderForeground', 'input-background'],
    ['campo com validação de erro', 'input-foreground', 'inputValidation-errorBackground'],
    ['campo com validação informativa', 'input-foreground', 'inputValidation-infoBackground'],
    ['notificação', 'notifications-foreground', 'notifications-background'],
    [
      'ícone de informação da notificação',
      'notificationsInfoIcon-foreground',
      'notifications-background',
    ],
    ['ícone de aviso da notificação', 'editorWarning-foreground', 'notifications-background'],
    ['ícone de erro da notificação', 'editorError-foreground', 'notifications-background'],
    ['dica ao passar o mouse', 'editorHoverWidget-foreground', 'editorHoverWidget-background'],
  ];

  const cases = THEMES.flatMap((theme) =>
    PAIRS.map(([what, foreground, background]) => ({ theme, what, foreground, background })),
  );

  it.each(cases)(
    '$theme: $what tem contraste de pelo menos 4,5:1 ($foreground sobre $background)',
    ({ theme, foreground, background }) => {
      const declarations = themeBlock(theme).declarations;
      const text = declarations.get(`--vscode-${foreground}`);
      const surface = declarations.get(`--vscode-${background}`);
      expect(text, `--vscode-${foreground} no tema ${theme}`).toBeDefined();
      expect(surface, `--vscode-${background} no tema ${theme}`).toBeDefined();
      const ratio = contrast(text ?? '', surface ?? '');
      expect(
        ratio,
        `${text} sobre ${surface} dá ${ratio.toFixed(2)}:1 no tema ${theme}`,
      ).toBeGreaterThanOrEqual(4.5);
    },
  );

  it('o indicador de foco se destaca do fundo em todos os temas (3:1)', () => {
    for (const theme of THEMES) {
      const declarations = themeBlock(theme).declarations;
      const focus = declarations.get('--vscode-focusBorder') ?? '';
      for (const background of [
        'editor-background',
        'sideBar-background',
        'activityBar-background',
      ]) {
        expect(
          contrast(focus, declarations.get(`--vscode-${background}`) ?? ''),
          `foco sobre ${background} no tema ${theme}`,
        ).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it('o alto contraste usa texto branco sobre preto e bordas à vista', () => {
    const declarations = themeBlock('high-contrast').declarations;
    expect(
      contrast(
        declarations.get('--vscode-foreground') ?? '',
        declarations.get('--vscode-editor-background') ?? '',
      ),
    ).toBeCloseTo(21, 5);
    expect(declarations.get('--vscode-contrastBorder')).not.toBe('transparent');
    expect(declarations.get('--vscode-button-border')).not.toBe('transparent');
  });
});
