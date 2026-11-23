import { mkdirSync } from 'node:fs';

import {
  expect,
  lowContrast,
  MINUTE,
  overflow,
  playNow,
  serverView,
  test,
  THEMES,
  tree,
} from './helpers';

// Capturas para revisão visual: LOTG_CAPTURE_DIR=<pasta> pnpm test:e2e 20-mapa
const CAPTURE_DIR = process.env.LOTG_CAPTURE_DIR;

test.describe('20 · Aba Mapa (V5E-T3)', () => {
  test('abre pela árvore e por #/mapa, navega pelas setas, abre a ficha, envia expedição pelo mapa, passa contraste nos três temas e funciona no celular', async ({
    context,
    request,
    world,
  }) => {
    world.seed('mapa-v5e-t3');
    const page = await world.open(context);
    await playNow(page);

    // Prepara Guilda, herói e alguns hexágonos explorados para exercitar os três estados e uma ação real.
    await world.raise('guild', 1);
    await world.hero('Alda', { classId: 'warrior', level: 3 });
    await world.mapFog({
      '1,0': 'explored',
      '-1,-1': 'explored',
      '-2,1': 'explored',
    });
    await world.passTime(MINUTE, page);

    // Abre a aba Mapa pela entrada "Mapa" da árvore lateral.
    const mapTreeRow = tree(page).locator('[data-node="map"]');
    await expect(mapTreeRow).toContainText('Mapa');
    await mapTreeRow.click();

    await expect(page.getByRole('tab', { name: 'Mapa' })).toHaveAttribute('aria-selected', 'true');
    await expect.poll(() => new URL(page.url()).hash).toBe('#/mapa');

    const mapSvg = page.locator('svg.hex-map-svg');
    await expect(mapSvg).toBeVisible();
    await expect(mapSvg.locator('g[data-hex]')).toHaveCount(91);
    // CSP: nenhum atributo style dentro do SVG.
    await expect(mapSvg.locator('[style]')).toHaveCount(0);
    // Roving tabindex: exatamente um hexágono entra na ordem do Tab.
    await expect(mapSvg.locator('g[data-hex][tabindex="0"]')).toHaveCount(1);

    const sheet = page.getByTestId('hex-sheet');
    const sheetTitle = sheet.locator('#hex-sheet-title');
    await expect(sheetTitle).toContainText('Pedra Alta');
    await expect(sheet).toContainText('Explorado');
    await expect(sheet.getByTestId('hex-coords')).toHaveText('(0, 0)');

    const view = await serverView(page, request);
    const sightedNorth = view.map.hexes.find((hex) => hex.q === 0 && hex.r === -1);
    expect(sightedNorth && 'terrainLabel' in sightedNorth).toBe(true);

    // Navegação por setas: (0,0) -> cima (0,-1, Avistado) -> 4× cima até a borda norte (Desconhecido) -> Home -> direita (1,0, Explorado com ação).
    await mapSvg.locator('g[data-hex="0,0"]').focus();
    await expect(mapSvg.locator('g[data-hex="0,0"]')).toBeFocused();

    await page.keyboard.press('ArrowUp');
    await expect(mapSvg.locator('g[data-hex="0,-1"]')).toBeFocused();
    await expect(mapSvg.locator('g[data-hex][tabindex="0"]')).toHaveCount(1);
    await expect(sheet).toContainText('Avistado');
    if (sightedNorth && 'terrainLabel' in sightedNorth) {
      await expect(sheetTitle).toContainText(sightedNorth.terrainLabel);
    }
    await expect(sheet.locator('[data-map-action]')).toHaveCount(0);

    for (let step = 0; step < 4; step += 1) {
      await page.keyboard.press('ArrowUp');
    }
    await expect(mapSvg.locator('g[data-hex="2,-5"]')).toBeFocused();
    await expect(mapSvg.locator('g[data-hex="2,-5"]')).toHaveAttribute('data-fog', 'unknown');
    // Desconhecido: só a casa vazia, sem ícone no hexágono nem terreno na ficha.
    await expect(mapSvg.locator('g[data-hex="2,-5"] .hex-icon-box')).toHaveCount(0);
    await expect(sheetTitle).toContainText('Território desconhecido');
    await expect(sheet).toContainText('Desconhecido');
    await expect(sheet).not.toContainText('Terreno:');

    // Home volta para (0,0); ArrowRight vai para (1,0), onde Patrulha está explorada e com ação.
    await page.keyboard.press('Home');
    await expect(mapSvg.locator('g[data-hex="0,0"]')).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await expect(mapSvg.locator('g[data-hex="1,0"]')).toBeFocused();
    await expect(sheetTitle).toContainText('Patrulha dos Arredores');
    await expect(sheet).toContainText('Explorado');
    await expect(sheet.getByTestId('hex-coords')).toHaveText('(1, 0)');

    // Enter abre/leva o foco diretamente à ficha do hexágono.
    await page.keyboard.press('Enter');
    await expect(sheetTitle).toBeFocused();

    // Contraste nos três temas e capturas opcionais (LOTG_CAPTURE_DIR).
    if (CAPTURE_DIR !== undefined) {
      mkdirSync(CAPTURE_DIR, { recursive: true });
      await page.locator('.editor-content').evaluate((el) => el.scrollTo(0, 0));
    }
    for (const theme of THEMES) {
      await page.evaluate((chosen) => {
        document.documentElement.setAttribute('data-theme', chosen);
      }, theme);
      expect(await lowContrast(page), `contraste no Mapa (${theme})`).toEqual([]);
      expect(await overflow(page), `transbordo no Mapa (${theme})`).toEqual({
        page: 0,
        content: 0,
      });
      if (CAPTURE_DIR !== undefined) {
        await page.screenshot({
          path: `${CAPTURE_DIR}/mapa-${theme}.png`,
          caret: 'hide',
          animations: 'disabled',
        });
      }
    }
    await page.evaluate(() => {
      document.documentElement.setAttribute('data-theme', 'dark');
    });

    // Largura de celular: o mapa encolhe dentro da tela, sem rolagem horizontal, e a ficha vai para baixo.
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.locator('#sidebar')).toBeHidden();
    // A bancada remonta ao cruzar 720 px: seleciona (1,0) no celular para mostrar a ficha com ação abaixo do mapa.
    await mapSvg.locator('g[data-hex="1,0"]').click();
    await expect(sheetTitle).toContainText('Patrulha dos Arredores');
    await expect(async () => {
      const mapBox = await mapSvg.boundingBox();
      const sheetBox = await sheet.boundingBox();
      expect(mapBox).not.toBeNull();
      expect(sheetBox).not.toBeNull();
      expect(mapBox!.width).toBeLessThanOrEqual(390);
      expect(mapBox!.x + mapBox!.width).toBeLessThanOrEqual(390);
      expect(sheetBox!.y).toBeGreaterThanOrEqual(mapBox!.y + mapBox!.height - 1);
      expect(await overflow(page)).toEqual({ page: 0, content: 0 });
    }).toPass({ timeout: 3_000 });
    expect(await lowContrast(page), 'contraste no Mapa (celular)').toEqual([]);
    if (CAPTURE_DIR !== undefined) {
      await page.screenshot({
        path: `${CAPTURE_DIR}/mapa-celular.png`,
        caret: 'hide',
        animations: 'disabled',
        fullPage: false,
      });
    }

    // Volta à largura de mesa, navega até (1,0) e executa uma ação real pelo mapa (enviar expedição).
    await page.setViewportSize({ width: 1280, height: 720 });
    await expect(page.locator('#sidebar')).toBeVisible();
    await mapSvg.locator('g[data-hex="0,0"]').focus();
    await page.keyboard.press('ArrowRight');
    await expect(sheetTitle).toContainText('Patrulha dos Arredores');
    const sendButton = sheet.locator('[data-map-action="sendExpedition:patrol"]');
    await expect(sendButton).toBeVisible();
    await expect(sendButton).toBeEnabled();
    await sendButton.click();

    // O comando lords.sendExpedition pergunta a equipe e a Postura com padrões prontos.
    const teamDialog = page.getByRole('dialog');
    await expect(teamDialog).toContainText('Alda');
    await page.keyboard.press('Enter');
    const postureDialog = page.getByRole('dialog');
    await expect(postureDialog).toContainText('Equilibrada');
    await page.keyboard.press('Enter');
    await expect(page.getByRole('dialog')).toHaveCount(0);

    // A expedição partiu de verdade no servidor e o botão de envio saiu da ficha.
    await expect
      .poll(async () => (await serverView(page, request)).guild.expeditions.length)
      .toBe(1);
    const afterView = await serverView(page, request);
    expect(afterView.guild.expeditions[0]?.label).toBe('Patrulha dos Arredores');
    await expect(sendButton).toHaveCount(0);
    expect(world.problems).toEqual([]);
  });
});
