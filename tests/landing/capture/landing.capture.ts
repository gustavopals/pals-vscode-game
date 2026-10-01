import { resolve } from 'node:path';

import { type Browser, type BrowserContext, expect, type Page, test } from '@playwright/test';

/**
 * As imagens que a página de apresentação mostra do jogo são capturas de verdade, feitas aqui:
 * uma partida curta jogada no app compilado, contra a API no ritmo de produção, com o relógio
 * adiantado entre uma visita e outra. Como rodar e o que fazer com os arquivos:
 * packages/landing/README.md, seção "Capturas do jogo".
 */

const ROOT = resolve(import.meta.dirname, '../../..');
const OUT = resolve(ROOT, 'packages/landing/test-results/capture');
const API = 'http://127.0.0.1:3190';
const LANDING = 'http://localhost:4174';
const MINUTE = 60_000;

// A janela larga do herói e a estreita dos celulares, em pixels de CSS; as capturas saem em 2×.
const WIDE = { width: 1040, height: 480 };
const NARROW = { width: 480, height: 520 };

/**
 * Onde ficam, em % da captura larga, os cinco pedaços da tela que a página rotula. As posições
 * dos rótulos em packages/landing/src/styles/page.css foram escolhidas para esta disposição: se
 * a tela do jogo mudar, esta conferência falha e as posições precisam ser revistas.
 */
const REGIONS = {
  tree: { x: 4.6, y: 7.2, w: 28.7, h: 62.1 },
  table: { x: 35, y: 30.1, w: 30.2, h: 27 },
  steppers: { x: 35, y: 70.9, w: 30.2, h: 24.6 },
  work: { x: 68.3, y: 30.1, w: 30.2, h: 17.4 },
  status: { x: 0, y: 94.8, w: 100, h: 5.2 },
} as const;
const TOLERANCE = 1.5;

const fief = (page: Page) => page.getByRole('tabpanel', { name: 'Feudo' });
const addWorker = (page: Page, building: string) =>
  fief(page).getByRole('button', { name: `Pôr mais um trabalhador em ${building}` });
const upgrade = (page: Page, work: string) =>
  fief(page).getByRole('listitem').filter({ hasText: work }).getByRole('button', {
    name: 'Melhorar',
  });
const recruit = (page: Page) => fief(page).getByRole('button', { name: 'Recrutar 1 aldeão' });

test.describe.configure({ mode: 'serial' });

test('jogo: a aba Feudo, larga e estreita, e a barra de status no modo discreto', async ({
  browser,
  request,
}) => {
  let offsetMs = 0;
  const control = async (path: string, data: Record<string, unknown> = {}) => {
    const response = await request.post(`${API}/__test/${path}`, { data });
    expect(response.ok(), `controle ${path}`).toBe(true);
  };
  const open = async (context: BrowserContext, path = '/') => {
    const page = await context.newPage();
    await page.clock.install({ time: new Date(Date.now() + offsetMs) });
    await page.goto(path);
    return page;
  };
  /** Adianta o servidor e a página e espera o ciclo de atualização que o salto dispara. */
  const passTime = async (ms: number, page: Page) => {
    await control('advance', { ms });
    offsetMs += ms;
    // Só conta a leitura de eventos que o salto dispara, não uma que já estava em voo.
    const synced = page.waitForResponse(
      (response) => /\/games\/[^/]+\/events/.test(response.url()) && response.ok(),
    );
    await page.clock.fastForward(ms);
    await synced;
  };
  /** A captura mostra o topo do painel, sem cursor de texto nem ponteiro sobre um botão. */
  const shoot = async (page: Page, name: string) => {
    await page.evaluate(() => {
      for (const element of document.querySelectorAll('*')) {
        if (element.scrollTop > 0) element.scrollTop = 0;
      }
    });
    await page.mouse.move(8, 8);
    await page.screenshot({
      path: resolve(OUT, `${name}.png`),
      caret: 'hide',
      animations: 'disabled',
    });
  };

  await control('reset');
  const context = await newContext(browser, WIDE);
  const page = await open(context);

  // Primeira visita: dois campos, um clique; comida, madeira e pedra; casas; gente nova.
  const welcome = page.getByRole('tabpanel', { name: 'Boas-vindas' });
  await welcome.getByLabel('Como devemos chamar quem governa?').fill('Lia');
  await welcome.getByRole('button', { name: 'Jogar agora' }).click();
  await expect(page.getByRole('heading', { name: 'Pedra Alta', level: 1 })).toBeVisible();
  for (const building of ['Fazenda', 'Fazenda', 'Serraria', 'Serraria', 'Pedreira']) {
    await addWorker(page, building).click();
  }
  await expect(fief(page).getByRole('heading', { name: 'Trabalhadores (5/5)' })).toBeVisible();
  await upgrade(page, 'Habitações Nv1 → Nv2').click();
  await expect(fief(page).locator('.active-construction')).toBeVisible();
  await recruit(page).click();
  await expect(fief(page).getByText('A caminho 1')).toBeVisible();
  await recruit(page).click();
  // Saltar no tempo com uma ordem ainda em voo cria uma corrida que o tempo de verdade não tem.
  await expect(fief(page).getByText('A caminho 2')).toBeVisible();

  // Segunda visita, quarenta minutos depois: os recém-chegados ganham ofício.
  await passTime(40 * MINUTE, page);
  await expect(fief(page).getByRole('heading', { name: 'Trabalhadores (5/7)' })).toBeVisible();
  await addWorker(page, 'Pedreira').click();
  await addWorker(page, 'Serraria').click();
  await expect(fief(page).getByRole('heading', { name: 'Trabalhadores (7/7)' })).toBeVisible();

  // Terceira visita, uma hora depois: a Serraria entra em obras e a captura pega a obra no meio.
  await passTime(60 * MINUTE, page);
  await upgrade(page, 'Serraria Nv1 → Nv2').click();
  await expect(fief(page).locator('.active-construction')).toContainText('Serraria');
  await passTime(40_000, page);
  await recruit(page).click();
  await expect(fief(page).getByText('A caminho 1')).toBeVisible();

  await shoot(page, 'jogo-feudo');

  // As cinco regiões rotuladas continuam onde a folha de estilos da página espera?
  const box = async (selector: string) => {
    const rect = await page.locator(selector).first().boundingBox();
    if (rect === null) throw new Error(`A captura não tem ${selector}.`);
    const percent = (value: number, total: number) => Math.round((value / total) * 1000) / 10;
    return {
      x: percent(rect.x, WIDE.width),
      y: percent(rect.y, WIDE.height),
      w: percent(rect.width, WIDE.width),
      h: percent(rect.height, WIDE.height),
    };
  };
  const measured = {
    tree: await box('[role="tree"]'),
    table: await box('[role="tabpanel"] table'),
    steppers: await box('.workers'),
    work: await box('.active-construction'),
    status: await box('footer[aria-label="Barra de status"]'),
  };
  for (const [name, expected] of Object.entries(REGIONS)) {
    const found = measured[name as keyof typeof REGIONS];
    for (const side of ['x', 'y', 'w', 'h'] as const) {
      expect(
        Math.abs(found[side] - expected[side]),
        `a disposição da tela mudou (${name}.${side}: ${found[side]}%, era ${expected[side]}%): reveja os rótulos em packages/landing/src/styles/page.css`,
      ).toBeLessThanOrEqual(TOLERANCE);
    }
  }

  // A mesma conta em uma janela estreita, como em um celular.
  const narrow = await newContext(browser, NARROW, await context.storageState());
  const small = await open(narrow, '/#/feudo');
  await expect(small.getByRole('heading', { name: 'Pedra Alta', level: 1 })).toBeVisible();
  await expect(fief(small).getByRole('heading', { name: 'Trabalhadores (7/7)' })).toBeVisible();
  await shoot(small, 'jogo-feudo-estreito');
  await narrow.close();

  // Modo discreto: a barra de status vira um contador.
  await page.setViewportSize({ width: 1280, height: WIDE.height });
  await page.keyboard.press('F1');
  await page.getByRole('combobox').fill('modo discreto');
  await page.keyboard.press('Enter');
  const status = page.getByRole('contentinfo', { name: 'Barra de status' });
  await expect(status).toHaveText(/^\s*\d\d:\d\d\s*Comandos\s*F1\s*$/);
  await page.mouse.move(8, 8);
  await status.screenshot({ path: resolve(OUT, 'jogo-discreto-barra.png') });
  await context.close();
});

test('prévia do link: o título em duas vozes sobre a captura do jogo, em 1200 × 630', async ({
  browser,
}) => {
  // A política de conteúdo da página barra estilos injetados; só aqui ela é contornada, para
  // compor a imagem com as letras, as cores e a captura que a página já tem.
  const context = await browser.newContext({
    viewport: { width: 1200, height: 630 },
    deviceScaleFactor: 1,
    bypassCSP: true,
    locale: 'pt-BR',
  });
  const page = await context.newPage();
  await page.goto(LANDING);
  await page.evaluate(() => document.fonts.ready);
  await page.addStyleTag({
    content: `
      .skip-link, .statusbar, .pitch, .readings-title, .readings > label, .readings > input,
      .labels, .reading-heads, .reading-figure figcaption, .seasons, .fief, .alibi, .vacancy,
      .colophon { display: none !important; }
      body { overflow: hidden; }
      .masthead { padding: 44px 64px 0 !important; }
      .hero { padding: 26px 64px 0 !important; }
      .hero h1 .voice-office { font-size: 40px !important; }
      .hero h1 .voice-fief { font-size: 208px !important; line-height: 0.86 !important; }
      .readings { margin-top: 44px !important; }
      .reading-figure { margin: 0 !important; }
    `,
  });
  await expect(page.getByRole('img', { name: /Captura real do jogo/ })).toBeVisible();
  await page.screenshot({
    path: resolve(ROOT, 'packages/landing/public/og.png'),
    clip: { x: 0, y: 0, width: 1200, height: 630 },
  });
  await context.close();
});

function newContext(
  browser: Browser,
  viewport: { width: number; height: number },
  storageState?: Awaited<ReturnType<BrowserContext['storageState']>>,
) {
  return browser.newContext({
    viewport,
    deviceScaleFactor: 2,
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    colorScheme: 'dark',
    baseURL: 'http://localhost:4190',
    ...(storageState ? { storageState } : {}),
  });
}
