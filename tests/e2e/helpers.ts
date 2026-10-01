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
