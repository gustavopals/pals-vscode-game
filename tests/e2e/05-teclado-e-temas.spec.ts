import { type Page } from '@playwright/test';

import {
  applyTheme,
  expect,
  fief,
  HOUR,
  lowContrast,
  MINUTE,
  playNow,
  statusBar,
  test,
  THEMES,
  toasts,
  tree,
} from './helpers';

// Critério 9 (GDD §16.1): temas claro, escuro e de alto contraste; navegável por teclado,
// inclusive a paleta de comandos.

/** Onde está o foco: a região da bancada e o que identifica o elemento. */
const focusInfo = (page: Page) =>
  page.evaluate(() => {
    const element = document.activeElement as HTMLElement | null;
    if (element === null || element === document.body) {
      return { zone: 'body', label: '', visible: false };
    }
    const zone =
      (['.activitybar', '.sidebar', '.editor-tabs', '.editor-content', '.statusbar'] as const).find(
        (selector) => element.closest(selector) !== null,
      ) ?? 'outro';
    const style = getComputedStyle(element);
    return {
      zone,
      label: (element.getAttribute('aria-label') ?? element.textContent ?? '').trim().slice(0, 40),
      // Foco visível: o contorno do tema, desenhado só para quem usa o teclado.
      visible: element.matches(':focus-visible') && style.outlineStyle !== 'none',
    };
  });

/** Escolhe um comando pela paleta, só com o teclado. */
async function command(page: Page, text: string) {
  await page.keyboard.press('F1');
  await expect(page.getByRole('combobox')).toBeFocused();
  await page.keyboard.type(text);
  await page.keyboard.press('Enter');
}

test.describe('teclado', () => {
  test('Tab percorre barra de atividades, árvore, abas e barra de status, com foco visível', async ({
    context,
    world,
  }) => {
    const page = await world.open(context);
    await playNow(page);
    // Página recém-carregada: o Tab começa do topo do documento.
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Pedra Alta', level: 1 })).toBeVisible();

    const zones: string[] = [];
    for (let step = 0; step < 60; step += 1) {
      await page.keyboard.press('Tab');
      const focus = await focusInfo(page);
      if (focus.zone === 'body') {
        break;
      }
      expect(focus.visible, `foco visível em "${focus.label}" (${focus.zone})`).toBe(true);
      zones.push(focus.zone);
      if (focus.zone === '.statusbar' && focus.label.includes('paleta')) {
        break;
      }
    }
    const order = zones.filter((zone, index) => zones[index - 1] !== zone);
    expect(order).toEqual([
      '.activitybar',
      '.sidebar',
      '.editor-tabs',
      '.editor-content',
      '.statusbar',
    ]);
    // A árvore e as abas são uma parada só cada (foco itinerante), não uma por item.
    expect(zones.filter((zone) => zone === '.editor-tabs')).toHaveLength(1);
    expect(zones.filter((zone) => zone === '.sidebar').length).toBeLessThanOrEqual(3);
  });

  test('a árvore segue o padrão ARIA: setas, Home, End, Enter, e + e − nos trabalhadores', async ({
    context,
    world,
  }) => {
    const page = await world.open(context);
    await playNow(page);
    const focused = () =>
      page.evaluate(() => (document.activeElement as HTMLElement).dataset.node ?? '');

    await tree(page).getByRole('treeitem').first().focus();
    expect(await focused()).toBe('today');
    await page.keyboard.press('ArrowDown');
    expect(await focused()).toBe('fief');
    await page.keyboard.press('ArrowDown');
    expect(await focused()).toBe('resources');
    // Seta para a esquerda fecha o ramo; de novo, sobe ao pai.
    await page.keyboard.press('ArrowLeft');
    await expect(tree(page).locator('[data-node="resources"]')).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    await expect(tree(page).locator('[data-node="resource:food"]')).toHaveCount(0);
    await page.keyboard.press('ArrowLeft');
    expect(await focused()).toBe('fief');
    await page.keyboard.press('End');
    expect(await focused()).toBe('morale');
    // A moral é uma folha, a última linha do feudo: a seta para cima volta às Construções.
    await page.keyboard.press('ArrowUp');
    expect(await focused()).toBe('constructions');
    // Seta para a direita abre o ramo e, de novo, entra nele.
    await page.keyboard.press('ArrowRight');
    await expect(tree(page).locator('[data-node="constructions"]')).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    await page.keyboard.press('ArrowRight');
    expect(await focused()).toBe('construction:townHall');
    await page.keyboard.press('Home');
    expect(await focused()).toBe('today');
    // Uma única linha da árvore fica na ordem do Tab.
    await expect(tree(page).locator('[role="treeitem"][tabindex="0"]')).toHaveCount(1);

    // Enter navega: em "Hoje", abre a aba Hoje.
    await page.keyboard.press('Enter');
    await expect(page.getByRole('tab', { name: 'Hoje' })).toHaveAttribute('aria-selected', 'true');

    // + e − em um edifício dão a ordem sem sair do teclado.
    await tree(page).locator('[data-node="worker:farm"]').focus();
    await page.keyboard.press('+');
    await expect(tree(page).locator('[data-node="worker:farm"]')).toContainText('1 ·');
    await page.keyboard.press('+');
    await expect(tree(page).locator('[data-node="worker:farm"]')).toContainText('2 ·');
    await page.keyboard.press('-');
    await expect(tree(page).locator('[data-node="worker:farm"]')).toContainText('1 ·');
    // O foco continua na mesma linha depois de cada ordem.
    expect(await focused()).toBe('worker:farm');
  });

  test('abas: setas trocam de aba; a paleta abre com F1 e Ctrl+K, filtra, e Esc devolve o foco', async ({
    context,
    world,
  }) => {
    const page = await world.open(context);
    await playNow(page);
    await page.getByRole('tab', { name: 'Feudo' }).focus();
    await page.keyboard.press('ArrowLeft');
    await expect(page.getByRole('tab', { name: 'Hoje' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('tab', { name: 'Hoje' })).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('tab', { name: 'Feudo' })).toBeFocused();

    await page.keyboard.press('Control+k');
    const dialog = page.getByRole('dialog');
    await expect(dialog).toHaveAttribute('aria-modal', 'true');
    const box = dialog.getByRole('combobox');
    await expect(box).toBeFocused();
    const all = await dialog.getByRole('option').count();
    expect(all).toBeGreaterThanOrEqual(20);
    for (const label of await dialog.getByRole('option').allInnerTexts()) {
      expect(label).toMatch(/^Lords: /);
    }
    // Busca sem acento e sem maiúsculas.
    await page.keyboard.type('cronica');
    await expect(dialog.getByRole('option')).toHaveCount(2);
    await expect(dialog.getByRole('option').first()).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('ArrowDown');
    await expect(dialog.getByRole('option').nth(1)).toHaveAttribute('aria-selected', 'true');
    await expect(box).toHaveAttribute('aria-activedescendant', 'quickpick-1');
    // Foco preso: Tab não sai do diálogo.
    await page.keyboard.press('Tab');
    await expect(box).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    // O foco volta para onde estava.
    await expect(page.getByRole('tab', { name: 'Feudo' })).toBeFocused();

    await page.keyboard.press('F1');
    await page.keyboard.type('zzzz');
    await expect(page.getByRole('dialog').getByText('Nada encontrado.')).toBeVisible();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
  });

  test('F1 no instante em que a página abre já mostra a paleta, e o que se digita vai para ela', async ({
    context,
    world,
  }) => {
    const page = await context.newPage();
    page.on('pageerror', (error) => world.problems.push(`exceção: ${error.message}`));
    // Relógio parado: nada do que o app agenda para "depois do próximo quadro" roda. A bancada
    // tem de ouvir os diálogos e o controlador desde o primeiro desenho; se só passasse a ouvir
    // um quadro depois, a paleta aberta nesse intervalo ficaria invisível e o texto digitado
    // cairia no campo das boas-vindas.
    await page.clock.install({ time: new Date() });
    await page.clock.pauseAt(new Date(Date.now() + 60_000));
    await page.goto('/');

    await page.keyboard.press('F1');
    const box = page.getByRole('dialog').getByRole('combobox');
    await expect(box).toBeFocused();
    await page.keyboard.type('sobre');
    await page.keyboard.press('Enter');
    const about = page.getByRole('tabpanel', { name: 'Sobre' });
    // A resposta do servidor também chega com o relógio parado, e a aba a mostra.
    await expect(about).toContainText(/Servidor\s*\d+\.\d+\.\d+/);
    await expect(page.getByLabel('Como devemos chamar quem governa?')).toHaveCount(0);
  });

  test('uma partida inteira dos objetivos 1 a 4 só com o teclado', async ({ context, world }) => {
    const page = await world.open(context);
    // Boas-vindas: o campo do nome já tem o foco; Enter envia o formulário.
    await expect(page.getByLabel('Como devemos chamar quem governa?')).toBeFocused();
    await page.keyboard.type('Gustavo');
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { name: 'Pedra Alta', level: 1 })).toBeVisible();
    const objectives = fief(page).getByRole('region', { name: 'Objetivos' });

    // 1. Aloque 2 aldeões na Fazenda.
    await command(page, 'alocar');
    await page.keyboard.type('fazenda');
    await page.keyboard.press('Enter');
    await page.keyboard.type('2');
    await page.keyboard.press('Enter');
    await expect(objectives.getByText('Cumprido: Aloque 2 aldeões na Fazenda')).toBeAttached();

    // 2. Inicie a melhoria das Habitações.
    await command(page, 'construir');
    await page.keyboard.type('habita');
    await page.keyboard.press('Enter');
    await expect(objectives.getByText('Cumprido: Inicie a melhoria das Habitações')).toBeAttached();

    // 3. Recrute 3 aldeões (16 minutos cada, na primavera).
    await command(page, 'recrutar');
    await page.keyboard.type('3');
    await page.keyboard.press('Enter');
    await expect(fief(page).getByText('A caminho 3')).toBeVisible();
    await world.passTime(61 * MINUTE, page);
    await expect(objectives.getByText('Cumprido: Recrute 3 aldeões')).toBeAttached();
    await expect(fief(page).getByText('Aldeões 8')).toBeVisible();

    // 4. Alcance o Salão do Senhor Nv2: junta madeira e pedra, depois ergue o Salão.
    for (const [building, count] of [
      ['serraria', '3'],
      ['pedreira', '3'],
    ] as const) {
      await command(page, 'alocar');
      await page.keyboard.type(building);
      await page.keyboard.press('Enter');
      await page.keyboard.type(count);
      await page.keyboard.press('Enter');
      await expect(page.getByRole('dialog')).toHaveCount(0);
    }
    await expect(fief(page).getByText('Trabalhadores (8/8)')).toBeVisible();
    await world.passTime(6 * HOUR, page);
    await command(page, 'construir');
    await page.keyboard.type('salao');
    await page.keyboard.press('Enter');
    await expect(statusBar(page)).toContainText('Salão do Senhor Nv2 ·');
    await world.passTime(11 * MINUTE, page);
    await expect(fief(page).getByText('Salão Nv2')).toBeVisible();
    await expect(objectives.getByText('Cumprido: Alcance o Salão do Senhor Nv2')).toBeAttached();
    // Nenhuma ordem foi recusada no caminho.
    await expect(toasts(page).getByRole('alert')).toHaveCount(0);
  });
});

test.describe('temas', () => {
  /** Todo controle tem nome acessível. */
  const unnamed = (page: Page) =>
    page.evaluate(() => {
      const name = (element: Element) =>
        (
          element.getAttribute('aria-label') ??
          (element.getAttribute('aria-labelledby') ?? '')
            .split(' ')
            .map((id) => document.getElementById(id)?.textContent ?? '')
            .join(' ') ??
          ''
        ).trim() ||
        (element.textContent ?? '').trim() ||
        (element.closest('label')?.textContent ?? '').trim();
      return [...document.querySelectorAll('button, input, select, a[href], [role="treeitem"]')]
        .filter((element) => name(element) === '')
        .map((element) => element.outerHTML.slice(0, 80));
    });

  test('escuro, claro e alto contraste: capturas, contraste e rótulos nas telas principais', async ({
    context,
    world,
  }, testInfo) => {
    const page = await world.open(context);
    const shoot = async (theme: string, screen: string) => {
      // A captura mostra a tela parada, sem o cursor de texto piscando.
      // Em test-results/temas/, para olhos humanos; na CI, sobem como artefato.
      const image = await page.screenshot({
        caret: 'hide',
        animations: 'disabled',
        path: `test-results/temas/${theme}-${screen}.png`,
      });
      await testInfo.attach(`${theme}-${screen}.png`, { body: image, contentType: 'image/png' });
    };
    for (const theme of THEMES) {
      await applyTheme(page, theme);
      await expect(page.getByRole('tabpanel', { name: 'Boas-vindas' })).toBeVisible();
      // Com as opções de dificuldade e ritmo já na tela: é com elas que o contraste é medido.
      await expect(page.getByRole('radiogroup', { name: 'Ritmo' })).toBeVisible();
      expect(await lowContrast(page), `contraste nas boas-vindas, tema ${theme}`).toEqual([]);
      expect(await unnamed(page), `rótulos nas boas-vindas, tema ${theme}`).toEqual([]);
      await shoot(theme, 'boas-vindas');
    }

    await playNow(page);
    await fief(page).getByRole('button', { name: 'Pôr mais um trabalhador em Fazenda' }).click();
    await fief(page)
      .getByRole('listitem')
      .filter({ hasText: 'Habitações Nv1 → Nv2' })
      .getByRole('button', { name: 'Melhorar' })
      .click();
    await expect(fief(page).locator('.active-construction')).toBeVisible();

    for (const theme of THEMES) {
      await applyTheme(page, theme);
      await expect(fief(page).locator('.active-construction')).toBeVisible();
      expect(await lowContrast(page), `contraste no Feudo, tema ${theme}`).toEqual([]);
      expect(await unnamed(page), `rótulos no Feudo, tema ${theme}`).toEqual([]);
      await shoot(theme, 'feudo');

      await page.keyboard.press('F1');
      await expect(page.getByRole('combobox')).toBeFocused();
      expect(await lowContrast(page), `contraste na paleta, tema ${theme}`).toEqual([]);
      await shoot(theme, 'paleta');
      await page.keyboard.press('Escape');

      await page.getByRole('tab', { name: 'Hoje' }).click();
      expect(await lowContrast(page), `contraste em Hoje, tema ${theme}`).toEqual([]);
      await page.getByRole('button', { name: 'Preferências' }).click();
      await expect(page.getByRole('tabpanel', { name: 'Preferências' })).toBeVisible();
      // A seção da partida, com a frase da dificuldade que vem do servidor.
      await expect(page.getByRole('group', { name: 'Esta partida' })).toContainText(
        'O feudo como foi pensado',
      );
      expect(await lowContrast(page), `contraste nas preferências, tema ${theme}`).toEqual([]);
      expect(await unnamed(page), `rótulos nas preferências, tema ${theme}`).toEqual([]);
      await shoot(theme, 'preferencias');
      await page.getByRole('tab', { name: 'Feudo' }).click();
    }
  });

  test('na primeira visita vale a preferência do sistema; a escolha fica lembrada', async ({
    browser,
    world,
  }) => {
    for (const [scheme, expected] of [
      ['dark', 'dark'],
      ['light', 'light'],
    ] as const) {
      const context = await browser.newContext({ colorScheme: scheme, locale: 'pt-BR' });
      const page = await world.open(context);
      await expect(page.locator('html')).toHaveAttribute('data-theme', expected);
      await context.close();
    }
    const context = await browser.newContext({ colorScheme: 'light', locale: 'pt-BR' });
    try {
      const page = await world.open(context);
      // "Trocar tema" pela paleta: claro → alto contraste → escuro.
      await page.keyboard.press('F1');
      await page.keyboard.type('trocar tema');
      await page.keyboard.press('Enter');
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'high-contrast');
      await expect(toasts(page)).toContainText('Tema: Alto contraste.');
      await page.reload();
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'high-contrast');

      // Pela aba de preferências, e a outra aba do navegador acompanha.
      const other = await world.open(context);
      await page.getByRole('button', { name: 'Preferências' }).click();
      await page.getByRole('radio', { name: 'Escuro' }).check();
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
      await expect(other.locator('html')).toHaveAttribute('data-theme', 'dark');
    } finally {
      await context.close();
    }
  });
});

test.describe('telas estreitas', () => {
  for (const width of [480, 720]) {
    test(`a ${width} px: barra lateral recolhida, sem rolagem horizontal, e o feudo é jogável`, async ({
      browser,
      world,
    }) => {
      const context = await browser.newContext({
        viewport: { width, height: 800 },
        locale: 'pt-BR',
      });
      try {
        const page = await world.open(context);
        const overflow = () =>
          page.evaluate(() => {
            const content = document.querySelector('.editor-content');
            return {
              page: document.documentElement.scrollWidth - window.innerWidth,
              content: content === null ? 0 : content.scrollWidth - content.clientWidth,
            };
          });
        const sidebar = page.locator('#sidebar');
        await expect(sidebar).toBeHidden();
        expect(await overflow()).toEqual({ page: 0, content: 0 });

        await playNow(page);
        expect(await overflow()).toEqual({ page: 0, content: 0 });
        await fief(page)
          .getByRole('button', { name: 'Pôr mais um trabalhador em Fazenda' })
          .click();
        await expect(fief(page).getByText('Trabalhadores (1/5)')).toBeVisible();
        await fief(page)
          .getByRole('listitem')
          .filter({ hasText: 'Habitações Nv1 → Nv2' })
          .getByRole('button', { name: 'Melhorar' })
          .click();
        await expect(fief(page).locator('.active-construction')).toBeVisible();
        expect(await overflow()).toEqual({ page: 0, content: 0 });

        // A barra lateral abre por cima do conteúdo e sai da frente depois de navegar.
        await page.getByRole('button', { name: 'Feudo', exact: true }).click();
        await expect(sidebar).toBeVisible();
        const editorLeft = await page
          .locator('.editor')
          .evaluate((el) => el.getBoundingClientRect().left);
        expect(editorLeft).toBe(48);
        expect(await overflow()).toEqual({ page: 0, content: 0 });
        await tree(page)
          .getByRole('treeitem', { name: /Hoje em Pedra Alta/ })
          .click();
        await expect(sidebar).toBeHidden();
        await expect(page.getByRole('tab', { name: 'Hoje' })).toHaveAttribute(
          'aria-selected',
          'true',
        );
        expect(await overflow()).toEqual({ page: 0, content: 0 });

        await page.keyboard.press('F1');
        await expect(page.getByRole('combobox')).toBeVisible();
        expect(await overflow()).toEqual({ page: 0, content: 0 });
      } finally {
        await context.close();
      }
    });
  }
});
