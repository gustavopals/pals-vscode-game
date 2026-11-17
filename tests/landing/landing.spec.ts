import { expect, type Page, test } from '@playwright/test';

import { DEFAULT_SITE } from '../../packages/landing/src/site';

/**
 * A página de apresentação compilada, em um navegador de verdade. O que só um navegador prova:
 * a política de conteúdo valendo, as letras carregadas, a faixa do alto que acompanha a estação,
 * o teclado, o contraste do que foi desenhado e a página em larguras de celular.
 */

const GAME = DEFAULT_SITE.gameUrl;
const SEASONS = [
  { id: 'primavera', season: 'spring', name: 'Primavera' },
  { id: 'verao', season: 'summer', name: 'Verão' },
  { id: 'outono', season: 'autumn', name: 'Outono' },
  { id: 'inverno', season: 'winter', name: 'Inverno' },
] as const;

/** Erros de script, recursos barrados pela política e pedidos a outras origens. */
function watch(page: Page) {
  const problems: string[] = [];
  const origins = new Set<string>();
  page.on('pageerror', (error) => problems.push(`exceção: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') problems.push(`console: ${message.text()}`);
  });
  page.on('requestfailed', (request) => problems.push(`falhou: ${request.url()}`));
  page.on('request', (request) => origins.add(new URL(request.url()).origin));
  return { problems, origins };
}

/** Passa pela página inteira para as imagens de carregamento tardio entrarem. */
async function scrollThrough(page: Page) {
  await page.evaluate(async () => {
    for (let y = 0; y < document.documentElement.scrollHeight; y += 300) {
      window.scrollTo(0, y);
      await new Promise((resolve) => setTimeout(resolve, 30));
    }
    window.scrollTo(0, 0);
  });
}

const isPhone = (page: Page) => (page.viewportSize()?.width ?? 0) < 768;

/** Põe o alto de uma estação logo abaixo da faixa presa e espera a faixa vestir a cor dela. */
async function goToSeason(page: Page, entry: (typeof SEASONS)[number]) {
  await page.evaluate((id) => {
    const section = document.getElementById(id);
    const bar = document.querySelector('.topbar');
    if (!section || !bar) throw new Error(`A página não tem #${id}.`);
    const top = section.getBoundingClientRect().top + window.scrollY;
    window.scrollTo(0, top - bar.getBoundingClientRect().height + 40);
  }, entry.id);
  await expect(page.locator('html')).toHaveAttribute('data-season', entry.season);
}

test.describe('primeira visita', () => {
  test('abre limpa: tudo desta origem, nada barrado, as letras carregadas', async ({
    page,
    baseURL,
  }) => {
    const { problems, origins } = watch(page);
    await page.goto('/');
    await scrollThrough(page);
    await page.evaluate(() => document.fonts.ready);

    expect([...origins]).toEqual([new URL(baseURL ?? '').origin]);
    expect(problems).toEqual([]);

    // Fraunces em pé e em itálico, e Instrument Sans.
    const loaded = await page.evaluate(() =>
      [...document.fonts]
        .filter((font) => font.status === 'loaded')
        .map((font) => `${font.family.replace(/['"]/g, '')} ${font.style}`),
    );
    expect(loaded.sort()).toEqual(['Fraunces italic', 'Fraunces normal', 'Instrument Sans normal']);

    const broken = await page.evaluate(() =>
      [...document.images].filter((image) => image.naturalWidth === 0).map((image) => image.src),
    );
    expect(broken).toEqual([]);
  });

  test('a política de conteúdo é estrita e barra o que for embutido', async ({ page }) => {
    await page.goto('/');
    const policy = await page
      .locator('meta[http-equiv="Content-Security-Policy"]')
      .getAttribute('content');
    expect(policy).toContain("default-src 'none'");
    expect(policy).not.toMatch(/unsafe-inline|unsafe-eval|https?:|data:/);

    const ran = await page.evaluate(() => {
      const script = document.createElement('script');
      script.textContent = 'window.__embutido = true';
      document.head.append(script);
      const tag = document.createElement('style');
      tag.textContent = 'body { outline: 7px solid }';
      document.head.append(tag);
      return {
        script: '__embutido' in window,
        style: getComputedStyle(document.body).outlineWidth,
      };
    });
    expect(ran.script).toBe(false);
    expect(ran.style).not.toBe('7px');
  });

  test('o título diz o que o jogo é, na letra dos títulos, com o inverno em itálico', async ({
    page,
  }) => {
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready);
    await expect(page).toHaveTitle('Lords of the Guild: um ano inteiro para preparar um inverno');
    const title = page.getByRole('heading', { level: 1 });
    await expect(title).toHaveText('Um ano inteiro para preparar um inverno.');
    expect(await title.evaluate((element) => getComputedStyle(element).fontFamily)).toContain(
      'Fraunces',
    );
    const winter = title.locator('em');
    await expect(winter).toHaveText('um inverno.');
    expect(await winter.evaluate((element) => getComputedStyle(element).fontStyle)).toBe('italic');
    // O texto corrido é da outra família.
    expect(
      await page.locator('.lede').evaluate((element) => getComputedStyle(element).fontFamily),
    ).toContain('Instrument Sans');
  });

  test('"Jogar agora" está na primeira tela e leva ao jogo', async ({ page }) => {
    await page.goto('/');
    const play = page.getByRole('link', { name: 'Jogar agora' });
    await expect(play).toHaveCount(3);
    for (const link of await play.all()) await expect(link).toHaveAttribute('href', GAME);

    // O da faixa do alto e o da abertura cabem na primeira tela.
    const viewport = page.viewportSize();
    for (const link of [play.nth(0), play.nth(1)]) {
      const box = await link.boundingBox();
      expect(box).not.toBeNull();
      expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(viewport?.height ?? 0);
    }

    // A faixa do alto acompanha a rolagem, com o mesmo botão.
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    const bar = page.getByRole('banner');
    await expect(bar.getByRole('link', { name: 'Jogar agora' })).toBeInViewport();
    expect((await bar.boundingBox())?.y).toBe(0);
  });

  test('a página abre com uma captura real do jogo: larga no computador, estreita no celular', async ({
    page,
  }) => {
    await page.goto('/');
    const capture = page.getByRole('img', { name: /Captura real do jogo, na aba Feudo/ });
    await expect(capture).toBeInViewport();
    expect(await capture.evaluate((image: HTMLImageElement) => image.currentSrc)).toContain(
      isPhone(page) ? 'jogo-feudo-estreito' : 'jogo-feudo-',
    );
    if (!isPhone(page)) {
      expect(await capture.evaluate((image: HTMLImageElement) => image.currentSrc)).not.toContain(
        'estreito',
      );
    }
  });
});

test.describe('o ano em quatro estações', () => {
  test('o índice leva a cada estação, e o título dela não some atrás da faixa', async ({
    page,
  }) => {
    await page.goto('/');
    const calendar = page.getByRole('navigation', { name: 'O ano em quatro estações' });
    await expect(calendar.getByRole('link')).toHaveCount(4);
    const columns = await calendar
      .locator('ol')
      .evaluate((grid) => getComputedStyle(grid).gridTemplateColumns.split(' ').length);
    expect(columns).toBe(isPhone(page) ? 2 : 4);

    for (const entry of SEASONS) {
      await calendar.getByRole('link', { name: new RegExp(entry.name) }).click();
      await expect(page).toHaveURL(new RegExp(`#${entry.id}$`));
      const section = page.locator(`#${entry.id}`);
      await expect(section.getByRole('heading', { level: 2 })).toBeInViewport();
      const [top, bar] = await Promise.all([
        section.evaluate((element) => element.getBoundingClientRect().top),
        page.locator('.topbar').evaluate((element) => element.getBoundingClientRect().bottom),
      ]);
      expect(top).toBeGreaterThanOrEqual(bar);
      await page.evaluate(() => window.scrollTo(0, 0));
    }
  });

  test('a faixa do alto veste a estação que está sob ela, e volta ao papel fora delas', async ({
    page,
  }) => {
    await page.goto('/');
    const root = page.locator('html');
    const bar = page.locator('.topbar');
    const ground = () => bar.evaluate((element) => getComputedStyle(element).backgroundColor);
    await expect(root).not.toHaveAttribute('data-season');
    const paper = await ground();

    const seen = new Set([paper]);
    for (const entry of SEASONS) {
      await goToSeason(page, entry);
      // A cor da faixa é a do chão da estação; a transição acaba antes da medida.
      const expected = await page
        .locator(`#${entry.id}`)
        .evaluate((element) => getComputedStyle(element).backgroundColor);
      await expect.poll(ground).toBe(expected);
      seen.add(expected);
      if (!isPhone(page)) {
        const current = page.locator('.year-nav a[aria-current]');
        await expect(current).toHaveCount(1);
        await expect(current).toHaveText(entry.name);
      }
      expect(await lowContrast(page), `contraste com a faixa no ${entry.name}`).toEqual([]);
    }
    // Cinco chãos diferentes: o papel e as quatro estações.
    expect(seen.size).toBe(5);

    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await expect(root).not.toHaveAttribute('data-season');
    await expect.poll(ground).toBe(paper);
  });

  test('no celular a faixa do alto não traz o índice; no computador, traz as quatro', async ({
    page,
  }) => {
    await page.goto('/');
    const links = page.getByRole('navigation', { name: 'As estações do ano' }).getByRole('link');
    if (isPhone(page)) {
      await expect(links).toHaveCount(0);
    } else {
      await expect(links).toHaveText(SEASONS.map((entry) => entry.name));
    }
  });

  test('cada estação tem a sua janela da pintura, com a legenda de arte conceitual', async ({
    page,
  }) => {
    await page.goto('/');
    await scrollThrough(page);
    const arches = page.locator('.arch');
    await expect(arches).toHaveCount(4);
    await expect(arches.locator('figcaption')).toHaveText(
      SEASONS.map(() => 'Arte conceitual, gerada por IA.'),
    );
    // A mesma pintura, quatro fatias diferentes, da esquerda para a direita.
    const slices = await arches
      .locator('img')
      .evaluateAll((images) =>
        images.map((image) => parseFloat(getComputedStyle(image).objectPosition)),
      );
    expect(slices).toHaveLength(4);
    expect([...slices].sort((a, b) => a - b)).toEqual(slices);
    expect(new Set(slices).size).toBe(4);
    const loaded = await arches.locator('img').evaluateAll((images) =>
      images.map((image) => ({
        source: (image as HTMLImageElement).currentSrc,
        width: (image as HTMLImageElement).naturalWidth,
      })),
    );
    for (const image of loaded) {
      expect(image.source).toContain('pedra-alta-estacoes-');
      expect(image.width).toBeGreaterThan(0);
    }
  });

  test('as capturas da encruzilhada e do Cerco carregam, e nenhuma passa do tamanho do jogo', async ({
    page,
  }) => {
    await page.goto('/');
    await scrollThrough(page);
    const crossroads = page.getByRole('img', { name: /Captura real do jogo, na aba Guilda/ });
    const siege = page.getByRole('img', { name: /Captura real do jogo, na aba Exército/ });
    const size = (image: typeof crossroads) =>
      image.evaluate((element: HTMLImageElement) => ({
        natural: element.naturalWidth,
        shown: element.getBoundingClientRect().width,
        source: element.currentSrc,
      }));
    const fork = await size(crossroads);
    expect(fork.natural).toBe(628);
    expect(fork.shown).toBeLessThanOrEqual(314);
    const plan = await size(siege);
    expect(plan.source).toContain(isPhone(page) ? 'jogo-cerco-estreito' : 'jogo-cerco-');
    expect(plan.natural).toBe(isPhone(page) ? 824 : 1320);
    // As capturas saem em 2×: desenhadas maiores que a metade, ficariam borradas.
    expect(plan.shown).toBeLessThanOrEqual(plan.natural / 2);
    // A carta do Conselho, as fichas, as tropas, as alas e as ondas estão lá.
    await expect(page.locator('.card-title')).toHaveText('Estrangeira ferida');
    await expect(page.locator('.sheet')).toHaveCount(2);
    await expect(page.locator('.units li')).toHaveCount(5);
    await expect(page.locator('.wings > li')).toHaveCount(3);
    await expect(page.locator('.waves li')).toHaveCount(3);
    await expect(page.locator('.masters li')).toHaveCount(4);
  });

  test('sem JavaScript a página é a mesma, com a faixa do alto sempre em papel', async ({
    browser,
    baseURL,
  }, testInfo) => {
    const context = await browser.newContext({
      ...testInfo.project.use,
      baseURL,
      javaScriptEnabled: false,
    });
    const page = await context.newPage();
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Um ano inteiro para preparar um inverno.',
    );
    await expect(page.getByRole('link', { name: 'Jogar agora' }).first()).toHaveAttribute(
      'href',
      GAME,
    );
    await page.goto('/#inverno');
    await expect(page.locator('#inverno').getByRole('heading', { level: 2 })).toBeInViewport();
    await expect(page.locator('html')).not.toHaveAttribute('data-season');
    await context.close();
  });
});

test.describe('em qualquer tela', () => {
  test('nenhuma largura, de 320 a 1920 px, faz a página rolar de lado', async ({ page }) => {
    test.skip(isPhone(page), 'as larguras são trocadas no projeto de computador');
    for (const width of [320, 360, 412, 480, 600, 767, 768, 832, 1023, 1024, 1280, 1440, 1920]) {
      await page.setViewportSize({ width, height: 800 });
      await page.goto('/');
      await page.evaluate(() => document.fonts.ready);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
      expect(overflow, `sobra horizontal a ${width} px`).toBe(0);
      // Nada desenhado passa da borda: nem título, nem tira de citação, nem captura.
      const wide = await page.evaluate(() =>
        [...document.querySelectorAll('main *, .topbar *')]
          .filter((element) => {
            const box = element.getBoundingClientRect();
            return box.width > 0 && (box.right > window.innerWidth + 0.5 || box.left < -0.5);
          })
          // A pintura é maior que a janela em arco de propósito: o arco a corta.
          .filter((element) => !element.closest('.arch picture'))
          .map((element) => `${element.tagName}.${element.className}`),
      );
      expect(wide, `passa da borda a ${width} px`).toEqual([]);
      // A faixa do alto cabe em uma linha, com a marca e o botão inteiros.
      const bar = await page.evaluate(() => {
        const brand = document.querySelector('.brand')?.getBoundingClientRect();
        const play = document.querySelector('.topbar-cta')?.getBoundingClientRect();
        return { gap: (play?.left ?? 0) - (brand?.right ?? 0), height: play?.height ?? 0 };
      });
      expect(bar.gap, `marca e botão se cobrem a ${width} px`).toBeGreaterThan(0);
      expect(bar.height, `botão quebrado em duas linhas a ${width} px`).toBeLessThan(44);
    }
  });

  test('tudo o que se lê tem contraste de leitura', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready);
    expect(await lowContrast(page)).toEqual([]);
  });

  test('pelo teclado: foco sempre visível e nunca escondido atrás da faixa do alto', async ({
    page,
  }) => {
    await page.goto('/');
    const stops: string[] = [];
    for (let index = 0; index < 30; index += 1) {
      await page.keyboard.press('Tab');
      // A rolagem até o elemento com foco termina antes da medida.
      await page.waitForTimeout(50);
      const stop = await page.evaluate(() => {
        const element = document.activeElement;
        // O Tab deu a volta: saiu da página ou chegou a um elemento já visitado.
        if (!element || element === document.body || element.hasAttribute('data-visited')) {
          return null;
        }
        element.setAttribute('data-visited', '');
        const style = getComputedStyle(element);
        const box = element.getBoundingClientRect();
        const bar = document.querySelector('.topbar')?.getBoundingClientRect();
        return {
          name: (element.textContent ?? '').replace(/\s+/g, ' ').trim(),
          visible: element.matches(':focus-visible'),
          outline: `${style.outlineStyle} ${style.outlineWidth}`,
          underBar:
            !element.closest('.topbar') &&
            !element.classList.contains('skip-link') &&
            bar !== undefined &&
            box.top < bar.bottom,
        };
      });
      if (stop === null) break;
      stops.push(stop.name);
      expect(stop.visible, `${stop.name}: foco visível`).toBe(true);
      expect(stop.outline, `${stop.name}: anel de foco`).toMatch(/^solid [3-9]px$/);
      expect(stop.underBar, `${stop.name}: escondido atrás da faixa do alto`).toBe(false);
    }
    const calendar = [
      'I Primavera Plantar, erguer, decidir.',
      'II Verão Heróis, estrada e balcão.',
      'III Outono Ferro, pátio e presságio.',
      'IV Inverno Três ondas contra a muralha.',
    ];
    // No computador a faixa do alto traz as quatro estações; no celular, só o botão.
    expect(stops).toEqual([
      'Pular para o conteúdo',
      ...(isPhone(page) ? [] : SEASONS.map((entry) => entry.name)),
      'Jogar agora',
      'Jogar agora',
      ...calendar,
      'Jogar agora',
      'licenças',
    ]);
  });

  test('"Pular para o conteúdo" aparece com o foco e leva ao conteúdo', async ({ page }) => {
    await page.goto('/');
    const skip = page.getByRole('link', { name: 'Pular para o conteúdo' });
    await expect(skip).not.toBeInViewport();
    await page.keyboard.press('Tab');
    await expect(skip).toBeFocused();
    await expect(skip).toBeInViewport();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/#conteudo$/);
  });
});

test.describe('com menos movimento', () => {
  test.use({ reducedMotion: 'reduce' });

  test('nem o botão nem a faixa do alto têm transição', async ({ page }) => {
    await page.goto('/');
    for (const selector of ['.cta', '.topbar']) {
      const duration = await page
        .locator(selector)
        .first()
        .evaluate((element) => getComputedStyle(element).transitionDuration);
      expect(duration, selector).toMatch(/^0s(, 0s)*$/);
    }
  });
});

test.describe('o resto do site', () => {
  test('a página de caminho errado oferece a volta e o jogo', async ({ page }) => {
    const { problems } = watch(page);
    await page.goto('/404.html');
    await expect(page).toHaveTitle(/esta página não consta do almanaque/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Esta página não consta do almanaque.',
    );
    await expect(page.getByRole('link', { name: 'Jogar agora' })).toHaveAttribute('href', GAME);
    expect(await lowContrast(page)).toEqual([]);
    await page.getByRole('link', { name: 'Voltar ao começo' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Um ano inteiro para preparar um inverno.',
    );
    expect(problems).toEqual([]);
  });

  test('a prévia do link aponta para uma imagem de 1200 × 630 que existe', async ({
    page,
    request,
  }) => {
    await page.goto('/');
    const meta = (property: string) =>
      page.locator(`meta[property="${property}"]`).getAttribute('content');
    expect(await meta('og:title')).toBe('Um ano inteiro para preparar um inverno.');
    expect(await meta('og:url')).toBe(`${DEFAULT_SITE.siteUrl}/`);
    expect(await meta('og:image')).toBe(`${DEFAULT_SITE.siteUrl}/og.png`);

    const image = await request.get('/og.png');
    expect(image.ok()).toBe(true);
    expect(image.headers()['content-type']).toBe('image/png');
    // Largura e altura ficam no cabeçalho IHDR do PNG, nos bytes 16 a 23.
    const bytes = await image.body();
    expect([bytes.readUInt32BE(16), bytes.readUInt32BE(20)]).toEqual([1200, 630]);
  });

  test('robots.txt e as licenças das letras são servidos', async ({ request }) => {
    const robots = await request.get('/robots.txt');
    expect(await robots.text()).toBe('User-agent: *\nAllow: /\n');
    const licenses = await request.get('/licencas.txt');
    const text = await licenses.text();
    expect(text).toContain('SIL OPEN FONT LICENSE Version 1.1');
    expect(text).toContain('The Fraunces Project Authors');
    expect(text).toContain('The Instrument Sans Project Authors');
  });

  test('capturas da página inteira, para olhos humanos', async ({ page }, testInfo) => {
    await page.goto('/');
    await scrollThrough(page);
    await page.evaluate(() => document.fonts.ready);
    // A faixa presa no alto e as colunas presas das estações apareceriam no meio da captura
    // da página inteira: sem a marca de estação a faixa fica em papel, no alto.
    await page.evaluate(() => {
      document.documentElement.removeAttribute('data-season');
      document.querySelector('.topbar')?.setAttribute('hidden', '');
    });
    const image = await page.screenshot({
      fullPage: true,
      animations: 'disabled',
      path: testInfo.outputPath(`pagina-${testInfo.project.name}.png`),
    });
    await testInfo.attach(`pagina-${testInfo.project.name}.png`, {
      body: image,
      contentType: 'image/png',
    });
  });
});

/**
 * Todo texto visível com contraste abaixo do mínimo contra o fundo que está de fato atrás
 * dele: 4,5:1, ou 3:1 para letra grande (24 px, ou 18,66 px em negrito). Fundos com
 * transparência são compostos subindo pelos ancestrais.
 */
function lowContrast(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    type Rgba = [number, number, number, number];
    const parse = (value: string): Rgba => {
      const parts = value.match(/[\d.]+/g)?.map(Number) ?? [0, 0, 0, 0];
      return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0, parts[3] ?? 1];
    };
    const over = (top: Rgba, bottom: Rgba): Rgba => {
      const alpha = top[3] + bottom[3] * (1 - top[3]);
      if (alpha === 0) return [0, 0, 0, 0];
      const mix = (index: 0 | 1 | 2) =>
        (top[index] * top[3] + bottom[index] * bottom[3] * (1 - top[3])) / alpha;
      return [mix(0), mix(1), mix(2), alpha];
    };
    const luminance = ([red, green, blue]: Rgba) => {
      const channel = (value: number) => {
        const unit = value / 255;
        return unit <= 0.03928 ? unit / 12.92 : ((unit + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * channel(red) + 0.7152 * channel(green) + 0.0722 * channel(blue);
    };
    const background = (element: Element): Rgba => {
      let color: Rgba = [0, 0, 0, 0];
      for (let node: Element | null = element; node && color[3] < 1; node = node.parentElement) {
        color = over(color, parse(getComputedStyle(node).backgroundColor));
      }
      return over(color, [255, 255, 255, 1]);
    };

    const failures: string[] = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const element = node.parentElement;
      const content = (node.textContent ?? '').trim();
      if (!element || content === '' || element.closest('.sr-only')) continue;
      const style = getComputedStyle(element);
      if (style.visibility === 'hidden' || element.getClientRects().length === 0) continue;
      const text = over(parse(style.color), background(element));
      const [lighter, darker] = [luminance(text), luminance(background(element))].sort(
        (a, b) => b - a,
      );
      const ratio = ((lighter ?? 0) + 0.05) / ((darker ?? 0) + 0.05);
      const size = parseFloat(style.fontSize);
      const large = size >= 24 || (size >= 18.66 && Number(style.fontWeight) >= 700);
      if (ratio < (large ? 3 : 4.5)) {
        failures.push(`${ratio.toFixed(2)}:1 em "${content.slice(0, 40)}"`);
      }
    }
    return failures;
  });
}
