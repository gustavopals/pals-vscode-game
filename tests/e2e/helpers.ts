import { type BrowserContext, expect, type Page, test as base } from '@playwright/test';

export const API = 'http://127.0.0.1:3100';
export const HOUR = 3_600_000;
export const MINUTE = 60_000;

/**
 * O "mundo" de um teste: o servidor zerado, o relógio do servidor e o das páginas andando
 * juntos, e a lista do que deu errado no navegador.
 */
export type World = {
  /** Quanto o relógio já foi adiantado, em ms. */
  offsetMs: number;
  /** Erros de script e violações da política de conteúdo vistos em qualquer página. */
  problems: string[];
  /** Abre uma página com o relógio controlado, no instante atual do mundo. */
  open(context: BrowserContext, path?: string): Promise<Page>;
  /**
   * Adianta o servidor e as páginas dadas, e espera cada página terminar o ciclo de atualização
   * que o salto dispara. Sem essa espera, um segundo salto pegaria a leitura ainda em voo, o
   * que no tempo de verdade não acontece.
   */
  passTime(ms: number, ...pages: Page[]): Promise<void>;
  /** Como `passTime`, sem esperar o ciclo: para páginas sem sessão ou sem rede. */
  jump(ms: number, ...pages: Page[]): Promise<void>;
  /** Comanda o GitHub de mentira do servidor de teste. */
  github(action: string, data?: Record<string, unknown>): Promise<unknown>;
  control(path: string, data?: Record<string, unknown>): Promise<unknown>;
};

export const test = base.extend<{ world: World }>({
  world: [
    async ({ request }, use) => {
      const control = async (path: string, data: Record<string, unknown> = {}) => {
        const response = await request.post(`${API}/__test/${path}`, { data });
        expect(response.ok(), `controle ${path}`).toBe(true);
        return response.json() as Promise<unknown>;
      };
      await control('reset');
      const world: World = {
        offsetMs: 0,
        problems: [],
        control,
        github: (action, data = {}) => control('github', { action, ...data }),
        open: async (context, path = '/') => {
          const page = await context.newPage();
          watch(page, world.problems);
          await page.clock.install({ time: new Date(Date.now() + world.offsetMs) });
          await page.goto(path);
          return page;
        },
        jump: async (ms, ...pages) => {
          await control('advance', { ms });
          world.offsetMs += ms;
          await Promise.all(pages.map((page) => page.clock.fastForward(ms)));
        },
        passTime: async (ms, ...pages) => {
          // Todo ciclo termina lendo os eventos novos.
          const synced = pages.map((page) =>
            page.waitForResponse(
              (response) => /\/games\/[^/]+\/events/.test(response.url()) && response.ok(),
            ),
          );
          await world.jump(ms, ...pages);
          await Promise.all(synced);
        },
      };
      await use(world);
      // Nenhum teste termina com erro de script nem com recurso barrado pela política.
      expect(world.problems, 'erros no navegador').toEqual([]);
    },
    { auto: true },
  ],
});

/** Registra exceções não tratadas e violações de CSP. Respostas 4xx e rede caída são esperadas. */
function watch(page: Page, problems: string[]): void {
  page.on('pageerror', (error) => problems.push(`exceção: ${error.message}`));
  page.on('console', (message) => {
    const text = message.text();
    if (message.type() === 'error' && /Content Security Policy|Refused to/i.test(text)) {
      problems.push(`CSP: ${text}`);
    }
  });
}

export { expect };

/** "Jogar agora" pela aba de boas-vindas: dois campos e um clique. */
export async function playNow(page: Page, name = 'Gustavo', settlement = 'Pedra Alta') {
  const welcome = page.getByRole('tabpanel', { name: 'Boas-vindas' });
  await welcome.getByLabel('Como devemos chamar quem governa?').fill(name);
  if (settlement !== 'Pedra Alta') {
    await welcome.getByLabel('Nome do feudo').fill(settlement);
  }
  await welcome.getByRole('button', { name: 'Jogar agora' }).click();
  await expect(page.getByRole('heading', { name: settlement, level: 1 })).toBeVisible();
}

/** Abre a paleta com F1, digita e escolhe o primeiro resultado com Enter. */
export async function palette(page: Page, text: string) {
  await page.keyboard.press('F1');
  const box = page.getByRole('combobox');
  await expect(box).toBeFocused();
  await box.fill(text);
  await page.keyboard.press('Enter');
}

export const toasts = (page: Page) => page.getByRole('region', { name: 'Avisos' });
export const fief = (page: Page) => page.getByRole('tabpanel', { name: 'Feudo' });
export const tree = (page: Page) => page.getByRole('tree');
export const statusBar = (page: Page) => page.getByRole('contentinfo', { name: 'Barra de status' });

/** A linha de um recurso na tabela da aba Feudo. */
export const resourceRow = (page: Page, name: string) =>
  fief(page)
    .getByRole('table')
    .first()
    .getByRole('row', { name: new RegExp(`^${name}`) });

/** O estoque (número inteiro) de um recurso, lido da tabela. */
export async function stock(page: Page, name: string): Promise<number> {
  const text = await resourceRow(page, name).getByRole('cell').first().innerText();
  return Number(text.replace(/\./g, '').replace(',', '.'));
}

/** O que o navegador guardou do app. */
export const stored = (page: Page) =>
  page.evaluate(() =>
    Object.fromEntries(
      Object.keys(localStorage)
        .filter((key) => key.startsWith('lords.'))
        .map((key) => [key, localStorage.getItem(key)]),
    ),
  );

/** Os três temas do app (GDD §13.7). */
export const THEMES = ['dark', 'light', 'high-contrast'] as const;

/** Troca o tema pela preferência guardada e recarrega a página, como quem volta com outro tema. */
export async function applyTheme(page: Page, theme: (typeof THEMES)[number]) {
  await page.evaluate((chosen) => {
    const saved = JSON.parse(localStorage.getItem('lords.preferences') ?? '{}') as object;
    localStorage.setItem('lords.preferences', JSON.stringify({ ...saved, theme: chosen }));
  }, theme);
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
}

/** Contraste de todo texto visível contra o fundo que ele realmente tem (WCAG 2.x). */
export const lowContrast = (page: Page) =>
  page.evaluate(() => {
    type Rgb = [number, number, number, number];
    const parse = (value: string): Rgb => {
      const parts = value.match(/[\d.]+/g)?.map(Number) ?? [0, 0, 0, 0];
      return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0, parts[3] ?? 1];
    };
    const over = (top: Rgb, bottom: Rgb): Rgb => [
      top[0] * top[3] + bottom[0] * (1 - top[3]),
      top[1] * top[3] + bottom[1] * (1 - top[3]),
      top[2] * top[3] + bottom[2] * (1 - top[3]),
      1,
    ];
    const luminance = ([r, g, b]: Rgb) => {
      const channel = (value: number) => {
        const unit = value / 255;
        return unit <= 0.03928 ? unit / 12.92 : ((unit + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
    };
    const background = (element: Element): Rgb => {
      const layers: Rgb[] = [];
      for (let node: Element | null = element; node !== null; node = node.parentElement) {
        const color = parse(getComputedStyle(node).backgroundColor);
        if (color[3] > 0) {
          layers.push(color);
          if (color[3] === 1) {
            break;
          }
        }
      }
      return layers.reduceRight<Rgb>((below, layer) => over(layer, below), [255, 255, 255, 1]);
    };
    const failures: string[] = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
      const element = node.parentElement;
      const text = node.textContent?.trim() ?? '';
      if (element === null || text === '') {
        continue;
      }
      const style = getComputedStyle(element);
      const box = element.getBoundingClientRect();
      const disabled = element.closest(':disabled') !== null;
      if (
        disabled ||
        element.closest('.sr-only') !== null ||
        box.width === 0 ||
        box.height === 0 ||
        style.visibility === 'hidden'
      ) {
        continue;
      }
      const back = background(element);
      const fore = over(parse(style.color), back);
      const [light, dark] = [luminance(fore), luminance(back)].sort((a, b) => b - a) as [
        number,
        number,
      ];
      const ratio = (light + 0.05) / (dark + 0.05);
      if (ratio < 4.5) {
        failures.push(`${ratio.toFixed(2)} "${text.slice(0, 30)}" <${element.className}>`);
      }
    }
    return [...new Set(failures)];
  });

/** Quanto a página e o conteúdo da aba passam da largura da janela: zero é não transbordar. */
export const overflow = (page: Page) =>
  page.evaluate(() => {
    const content = document.querySelector('.editor-content');
    return {
      page: document.documentElement.scrollWidth - window.innerWidth,
      content: content === null ? 0 : content.scrollWidth - content.clientWidth,
    };
  });
