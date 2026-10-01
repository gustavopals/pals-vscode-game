import { expect, type Page, test } from '@playwright/test';

import { DEFAULT_SITE } from '../../packages/landing/src/site';

/**
 * A página de apresentação compilada, em um navegador de verdade. O que só um navegador prova:
 * a política de conteúdo valendo, as letras carregadas, o interruptor que é só CSS, o teclado,
 * o contraste do que foi desenhado e a página em larguras de celular.
 */

const GAME = DEFAULT_SITE.gameUrl;

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
/** A partir de 68rem os rótulos ficam presos à captura e há o interruptor. */
const PINNED_FROM = 1088;

test.describe('primeira visita', () => {
  test('abre limpa: tudo desta origem, nada barrado, as duas letras carregadas', async ({
    page,
    baseURL,
  }) => {
    const { problems, origins } = watch(page);
    await page.goto('/');
    await scrollThrough(page);
    await page.evaluate(() => document.fonts.ready);

    expect([...origins]).toEqual([new URL(baseURL ?? '').origin]);
    expect(problems).toEqual([]);

    const loaded = await page.evaluate(() =>
      [...document.fonts].filter((font) => font.status === 'loaded').map((font) => font.family),
    );
    expect(loaded.map((family) => family.replace(/['"]/g, '')).sort()).toEqual([
      'Alegreya',
      'Grenze Gotisch',
    ]);

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

  test('o título fala em duas vozes: a do escritório e a do feudo', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready);
    await expect(page).toHaveTitle('Lords of the Guild: parece trabalho, é um feudo');
    const title = page.getByRole('heading', { level: 1 });
    await expect(title).toHaveText(/Parece trabalho\.\s*É um feudo\./);
    const family = (selector: string) =>
      title.locator(selector).evaluate((element) => getComputedStyle(element).fontFamily);
    expect(await family('.voice-fief')).toContain('Grenze Gotisch');
    expect(await family('.voice-office')).toMatch(/monospace/);
  });

  test('"Jogar agora" está na primeira tela e leva ao jogo', async ({ page }) => {
    await page.goto('/');
    const play = page.getByRole('link', { name: 'Jogar agora' });
    await expect(play).toHaveCount(3);
    for (const link of await play.all()) await expect(link).toHaveAttribute('href', GAME);

    const viewport = page.viewportSize();
    const first = await play.first().boundingBox();
    expect(first).not.toBeNull();
    expect((first?.y ?? 0) + (first?.height ?? 0)).toBeLessThanOrEqual(viewport?.height ?? 0);

    // A barra de status acompanha a rolagem, com o mesmo botão.
    const bar = page.getByRole('complementary', { name: 'Atalho para o jogo' });
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await expect(bar.getByRole('link', { name: 'Jogar agora' })).toBeInViewport();
    const box = await bar.boundingBox();
    expect((box?.y ?? 0) + (box?.height ?? 0)).toBe(viewport?.height);
  });
});

test.describe('a mesma tela, duas leituras', () => {
  const passerby = [
    'uma árvore de arquivos',
    'uma tabela qualquer',
    'uns contadores',
    'uma barra de progresso',
    'uma barra de status',
  ];
  const ruler = [
    'o feudo, de cima a baixo',
    'as despensas',
    'quem trabalha onde',
    'os pedreiros na obra',
    'o que pede atenção agora',
  ];
  // O texto visível de cada rótulo, sem o prefixo que só os leitores de tela recebem.
  const shown = (page: Page, tag: 'dt' | 'dd') =>
    page.locator(`.labels ${tag}`).evaluateAll((items) =>
      items
        .filter((item) => item.getClientRects().length > 0)
        .map((item) => {
          const copy = item.cloneNode(true) as HTMLElement;
          copy.querySelector('.sr-only')?.remove();
          return (copy.textContent ?? '').trim();
        }),
    );

  test('no computador o interruptor troca os rótulos: com clique e com as setas', async ({
    page,
  }) => {
    test.skip(isPhone(page), 'no celular não há interruptor');
    await page.goto('/');
    const group = page.getByRole('radiogroup', { name: 'A mesma tela:' });
    const passing = group.getByRole('radio', { name: 'Quem passa vê' });
    const governing = group.getByRole('radio', { name: 'Quem governa vê' });

    await expect(passing).toBeChecked();
    expect(await shown(page, 'dt')).toEqual(passerby);
    expect(await shown(page, 'dd')).toEqual([]);

    await page.locator('label[for="reading-ruler"]').click();
    await expect(governing).toBeChecked();
    expect(await shown(page, 'dt')).toEqual([]);
    expect(await shown(page, 'dd')).toEqual(ruler);

    // Pelo teclado: o grupo é uma parada do Tab, e as setas trocam a leitura.
    await governing.focus();
    await page.keyboard.press('ArrowLeft');
    await expect(passing).toBeChecked();
    await expect(passing).toBeFocused();
    expect(await shown(page, 'dt')).toEqual(passerby);
    await page.keyboard.press('ArrowRight');
    await expect(governing).toBeChecked();
    expect(await shown(page, 'dd')).toEqual(ruler);
  });

  for (const width of [PINNED_FROM, 1120, 1280, 1920]) {
    test(`a ${width} px os rótulos ficam dentro da captura e não se cobrem`, async ({ page }) => {
      test.skip(isPhone(page), 'no celular os rótulos não ficam sobre a captura');
      await page.setViewportSize({ width, height: 800 });
      await page.goto('/');
      await page.evaluate(() => document.fonts.ready);
      for (const reading of ['reading-passerby', 'reading-ruler']) {
        await page.locator(`label[for="${reading}"]`).click();
        const boxes = await page.evaluate(() => {
          const stage = document.querySelector('.stage')?.getBoundingClientRect();
          const labels = [...document.querySelectorAll('.labels dt, .labels dd')]
            .map((item) => item.getBoundingClientRect())
            .filter((box) => box.width > 0);
          return {
            stage: stage && {
              left: stage.left,
              right: stage.right,
              top: stage.top,
              bottom: stage.bottom,
            },
            labels: labels.map((box) => ({
              left: box.left,
              right: box.right,
              top: box.top,
              bottom: box.bottom,
            })),
          };
        });
        expect(boxes.labels).toHaveLength(5);
        for (const box of boxes.labels) {
          expect(box.left).toBeGreaterThanOrEqual(boxes.stage?.left ?? 0);
          expect(box.right).toBeLessThanOrEqual(boxes.stage?.right ?? 0);
          expect(box.top).toBeGreaterThanOrEqual(boxes.stage?.top ?? 0);
          expect(box.bottom).toBeLessThanOrEqual(boxes.stage?.bottom ?? 0);
        }
        for (const [index, a] of boxes.labels.entries()) {
          for (const b of boxes.labels.slice(index + 1)) {
            const apart =
              a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top;
            expect(apart, `${reading}: dois rótulos se cobrem`).toBe(true);
          }
        }
      }
    });
  }

  test('no celular as duas leituras ficam lado a lado, sem interruptor', async ({ page }) => {
    test.skip(!isPhone(page), 'no computador há o interruptor');
    await page.goto('/');
    await expect(page.getByRole('radio')).toHaveCount(0);
    // A captura estreita não mostra a árvore nem a obra: as linhas delas saem.
    expect(await shown(page, 'dt')).toEqual([passerby[1], passerby[2], passerby[4]]);
    expect(await shown(page, 'dd')).toEqual([ruler[1], ruler[2], ruler[4]]);
    await expect(page.locator('.reading-heads')).toHaveText(/Quem passa vê\s*Quem governa vê/);
    const capture = page.getByRole('img', { name: /Captura real do jogo/ });
    expect(await capture.evaluate((image: HTMLImageElement) => image.currentSrc)).toContain(
      'jogo-feudo-estreito',
    );
  });

  test('sem JavaScript a página é a mesma, e o interruptor continua trocando', async ({
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
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/É um feudo\./);
    await expect(page.getByRole('link', { name: 'Jogar agora' }).first()).toHaveAttribute(
      'href',
      GAME,
    );
    if (!isPhone(page)) {
      await page.locator('label[for="reading-ruler"]').click();
      await expect(page.locator('.label-table dd')).toBeVisible();
      await expect(page.locator('.label-table dt')).toBeHidden();
    }
    await context.close();
  });
});

test.describe('em qualquer tela', () => {
  test('nenhuma largura, de 320 a 1920 px, faz a página rolar de lado', async ({ page }) => {
    test.skip(isPhone(page), 'as larguras são trocadas no projeto de computador');
    for (const width of [320, 360, 412, 480, 600, 768, 959, 960, 1024, 1280, 1440, 1920]) {
      await page.setViewportSize({ width, height: 800 });
      await page.goto('/');
      await page.evaluate(() => document.fonts.ready);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
      expect(overflow, `sobra horizontal a ${width} px`).toBe(0);
      // O título cabe inteiro, sem cortar a gótica.
      const cut = await page.evaluate(() => {
        const title = document.querySelector('h1 .voice-fief');
        return title ? title.scrollWidth - title.clientWidth : 0;
      });
      expect(cut, `título cortado a ${width} px`).toBe(0);
    }
  });

  test('a pintura cabe inteira no computador e passa de lado no celular', async ({ page }) => {
    await page.goto('/');
    const scroller = page.locator('.panorama-scroll');
    await scroller.scrollIntoViewIfNeeded();
    const extra = await scroller.evaluate((element) => element.scrollWidth - element.clientWidth);
    if (isPhone(page)) {
      expect(extra).toBeGreaterThan(400);
      await expect(page.locator('.swipe-hint')).toBeVisible();
    } else {
      expect(extra).toBe(0);
      await expect(page.locator('.swipe-hint')).toBeHidden();
    }
    await expect(page.locator('.season-names li')).toHaveText([
      'Primavera',
      'Verão',
      'Outono',
      'Inverno',
    ]);
  });

  test('tudo o que se lê tem contraste de leitura', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready);
    const readings = isPhone(page) ? [null] : ['reading-passerby', 'reading-ruler'];
    for (const reading of readings) {
      if (reading) await page.locator(`label[for="${reading}"]`).click();
      expect(await lowContrast(page), `contraste (${reading ?? 'celular'})`).toEqual([]);
    }
  });

  test('pelo teclado: foco sempre visível e nunca escondido atrás da barra de status', async ({
    page,
  }) => {
    await page.goto('/');
    const stops: string[] = [];
    for (let index = 0; index < 20; index += 1) {
      await page.keyboard.press('Tab');
      const stop = await page.evaluate(() => {
        const element = document.activeElement;
        // O Tab deu a volta: saiu da página ou chegou a um elemento já visitado.
        if (!element || element === document.body || element.hasAttribute('data-visited')) {
          return null;
        }
        element.setAttribute('data-visited', '');
        // O anel de um botão de opção é desenhado no rótulo dele.
        const ring =
          element instanceof HTMLInputElement
            ? (document.querySelector(`label[for="${element.id}"]`) ?? element)
            : element;
        const style = getComputedStyle(ring);
        const box = ring.getBoundingClientRect();
        const bar = document.querySelector('.statusbar')?.getBoundingClientRect();
        return {
          name:
            element.getAttribute('aria-label') ??
            ((element.textContent ?? '').trim() || element.id),
          visible: element.matches(':focus-visible'),
          outline: `${style.outlineStyle} ${style.outlineWidth}`,
          underBar: !element.closest('.statusbar') && bar !== undefined && box.bottom > bar.top,
        };
      });
      if (stop === null) break;
      stops.push(stop.name);
      expect(stop.visible, `${stop.name}: foco visível`).toBe(true);
      expect(stop.outline, `${stop.name}: anel de foco`).toMatch(/^solid [3-9]px$/);
      expect(stop.underBar, `${stop.name}: escondido atrás da barra de status`).toBe(false);
    }
    // No computador: pular, botão do herói, interruptor, botão do fecho, licenças, barra.
    // No celular sai o interruptor e entra a faixa da pintura, que rola de lado.
    expect(stops).toEqual(
      isPhone(page)
        ? [
            'Pular para o conteúdo',
            'Jogar agora',
            'Pedra Alta nas quatro estações',
            'Jogar agora',
            'licenças',
            'Jogar agora',
          ]
        : [
            'Pular para o conteúdo',
            'Jogar agora',
            'reading-passerby',
            'Jogar agora',
            'licenças',
            'Jogar agora',
          ],
    );
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

test.describe('quem troca de aba e volta', () => {
  const setVisibility = (page: Page, state: 'hidden' | 'visible') =>
    page.evaluate((value) => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => value });
      document.dispatchEvent(new Event('visibilitychange'));
    }, state);

  test('lê na barra de status quanto tempo ficou fora', async ({ page }) => {
    await page.clock.install();
    await page.goto('/');
    const note = page.getByRole('status');
    await expect(note).toBeEmpty();

    // Uma espiada em outra aba não vira recado.
    await setVisibility(page, 'hidden');
    await page.clock.fastForward(4_000);
    await setVisibility(page, 'visible');
    await expect(note).toBeEmpty();

    await setVisibility(page, 'hidden');
    await page.clock.fastForward('03:20');
    await setVisibility(page, 'visible');
    await expect(note).toHaveText('Você saiu por 3 min. Pedra Alta teria seguido sem você.');
  });
});

test.describe('com menos movimento', () => {
  test.use({ reducedMotion: 'reduce' });

  test('o botão não tem transição', async ({ page }) => {
    await page.goto('/');
    const duration = await page
      .locator('.cta')
      .first()
      .evaluate((element) => getComputedStyle(element).transitionDuration);
    expect(duration).toMatch(/^0s(, 0s)*$/);
  });
});

test.describe('o resto do site', () => {
  test('a página de caminho errado oferece a volta e o jogo', async ({ page }) => {
    const { problems } = watch(page);
    await page.goto('/404.html');
    await expect(page).toHaveTitle(/este caminho não leva a Pedra Alta/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      /Erro 404\.\s*Este caminho não leva a Pedra Alta\./,
    );
    await expect(page.getByRole('link', { name: 'Jogar agora' })).toHaveAttribute('href', GAME);
    await page.getByRole('link', { name: 'Voltar ao começo' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/É um feudo\./);
    expect(problems).toEqual([]);
  });

  test('a prévia do link aponta para uma imagem de 1200 × 630 que existe', async ({
    page,
    request,
  }) => {
    await page.goto('/');
    const meta = (property: string) =>
      page.locator(`meta[property="${property}"]`).getAttribute('content');
    expect(await meta('og:title')).toBe('Parece trabalho. É um feudo.');
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
    expect(text).toContain('The Grenze Gotisch Project Authors');
    expect(text).toContain('The Alegreya Project Authors');
  });

  test('capturas da página inteira, para olhos humanos', async ({ page }, testInfo) => {
    await page.goto('/');
    await scrollThrough(page);
    await page.evaluate(() => document.fonts.ready);
    // A barra presa embaixo apareceria no meio da captura da página inteira.
    await page.locator('.statusbar').evaluate((bar) => bar.setAttribute('hidden', ''));
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
