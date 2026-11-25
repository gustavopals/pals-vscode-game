import { mkdirSync } from 'node:fs';

import {
  cutTreeRows,
  expect,
  lowContrast,
  MINUTE,
  overflow,
  palette,
  playNow,
  serverView,
  test,
  THEMES,
  tree,
} from './helpers';

// Capturas para revisão visual: LOTG_CAPTURE_DIR=<pasta> pnpm test:e2e 21-postos
const CAPTURE_DIR = process.env.LOTG_CAPTURE_DIR;

test.describe('21 · Postos Avançados no Mapa (V5F-T3)', () => {
  test('reivindica posto avançado pela ficha do mapa e pela paleta, vê a obra terminar e o posto ficar ativo nos três temas e no celular', async ({
    context,
    request,
    world,
  }) => {
    world.seed('postos-v5f-t3');
    const page = await world.open(context);
    await playNow(page);

    // Salão Nv5 libera os postos avançados (D-23); garante estoque para duas obras e explora três hexágonos produtivos.
    await world.raise('townHall', 5);
    await world.raise('warehouse', 1);
    await world.stock('wood', 700);
    await world.stock('stone', 500);
    await world.stock('gold', 400);
    await world.mapFog({
      '-3,0': 'explored',
      '1,0': 'explored',
      '-2,1': 'explored',
    });
    await world.passTime(MINUTE, page);

    // Abre a aba Mapa pela árvore lateral.
    const mapTreeRow = tree(page).locator('[data-node="map"]');
    await expect(mapTreeRow).toContainText('Mapa');
    await mapTreeRow.click();
    await expect(page.getByRole('tab', { name: 'Mapa' })).toHaveAttribute('aria-selected', 'true');
    await expect.poll(() => new URL(page.url()).hash).toBe('#/mapa');

    const mapSvg = page.locator('svg.hex-map-svg');
    const sheet = page.getByTestId('hex-sheet');
    const sheetTitle = sheet.locator('#hex-sheet-title');

    // 1. Reivindica o primeiro posto avançado (-3, 0 · Mina Abandonada) pelo botão da ficha do hexágono.
    const mineHex = mapSvg.locator('g[data-hex="-3,0"]');
    await mineHex.click();
    await expect(sheetTitle).toContainText('Mina Abandonada');
    await expect(sheet.getByTestId('hex-coords')).toHaveText('(-3, 0)');

    const claimButton = sheet.locator('[data-map-action="claimOutpost"]');
    await expect(claimButton).toBeVisible();
    await expect(claimButton).toContainText('Reivindicar posto');
    await claimButton.click();

    await expect(claimButton).toHaveCount(0);
    await expect(sheet.getByTestId('hex-outpost-status')).toContainText('Posto avançado: em obra');
    await expect(mineHex).toHaveAttribute('data-outpost', 'building');
    await expect(mineHex.locator('[data-outpost-mark="building"]')).toHaveCount(1);

    // A árvore mostra o posto em obra sob Mapa, sem texto cortado.
    const firstOutpostRow = tree(page).locator('[data-node="outpost:outpost-1"]');
    await expect(firstOutpostRow).toContainText('Mina Abandonada (-3, 0)');
    await expect(firstOutpostRow).toContainText('em obra');

    // 2. Reivindica o segundo posto avançado (1, 0 · Patrulha dos Arredores) pela Paleta de Comandos.
    await palette(page, 'Reivindicar posto');
    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText('Reivindicar posto avançado');
    await expect(dialog).toContainText('Patrulha dos Arredores (1, 0)');
    await dialog.getByRole('option', { name: /Patrulha dos Arredores \(1, 0\)/ }).click();
    await expect(dialog).toHaveCount(0);

    const patrolHex = mapSvg.locator('g[data-hex="1,0"]');
    await expect(patrolHex).toHaveAttribute('data-outpost', 'building');
    await expect(tree(page).locator('[data-node="outpost:outpost-2"]')).toContainText('em obra');

    // 3. Avança os 45 minutos da obra: o primeiro posto fica ativo e o segundo conclui a seguir.
    await world.passTime(45 * MINUTE, page);

    await expect(mineHex).toHaveAttribute('data-outpost', 'active');
    await expect(mineHex).toHaveAttribute('data-fog', 'claimed');
    await expect(mineHex.locator('[data-outpost-mark="active"]')).toHaveCount(1);
    await expect(patrolHex).toHaveAttribute('data-outpost', 'active');
    await expect(patrolHex).toHaveAttribute('data-fog', 'claimed');

    await mineHex.click();
    await expect(sheet.getByTestId('hex-outpost-status')).toContainText('Posto avançado: ativo');
    await expect(sheet).toContainText('Reivindicado');
    await expect(firstOutpostRow).toContainText('ativo');
    await expect(mapTreeRow).toContainText('2 postos');
    expect(await cutTreeRows(page)).toEqual([]);

    const afterView = await serverView(page, request);
    const mineView = afterView.map.hexes.find((hex) => hex.q === -3 && hex.r === 0);
    expect(mineView && 'outpost' in mineView ? mineView.outpost?.status : null).toBe('active');

    // CSP: nenhum atributo style dentro do SVG.
    await expect(mapSvg.locator('[style]')).toHaveCount(0);

    // 4. Contraste nos três temas e capturas opcionais (LOTG_CAPTURE_DIR).
    if (CAPTURE_DIR !== undefined) {
      mkdirSync(CAPTURE_DIR, { recursive: true });
      await page.locator('.editor-content').evaluate((el) => el.scrollTo(0, 0));
    }
    for (const theme of THEMES) {
      await page.evaluate((chosen) => {
        document.documentElement.setAttribute('data-theme', chosen);
      }, theme);
      expect(await lowContrast(page), `contraste nos Postos (${theme})`).toEqual([]);
      expect(await overflow(page), `transbordo nos Postos (${theme})`).toEqual({
        page: 0,
        content: 0,
      });
      if (CAPTURE_DIR !== undefined) {
        await page.screenshot({
          path: `${CAPTURE_DIR}/postos-${theme}.png`,
          caret: 'hide',
          animations: 'disabled',
        });
      }
    }
    await page.evaluate(() => {
      document.documentElement.setAttribute('data-theme', 'dark');
    });

    // 5. Largura de celular (390×844): mapa e ficha com posto ativo sem rolagem horizontal.
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.locator('#sidebar')).toBeHidden();
    await mapSvg.locator('g[data-hex="-3,0"]').click();
    await expect(sheetTitle).toContainText('Mina Abandonada');
    await expect(sheet.getByTestId('hex-outpost-status')).toContainText('Posto avançado: ativo');
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
    expect(await lowContrast(page), 'contraste nos Postos (celular)').toEqual([]);
    if (CAPTURE_DIR !== undefined) {
      await page.screenshot({
        path: `${CAPTURE_DIR}/postos-celular.png`,
        caret: 'hide',
        animations: 'disabled',
        fullPage: false,
      });
    }

    expect(world.problems).toEqual([]);
  });

  test.fixme('repara posto avançado danificado pela ficha do mapa e pela paleta — depende da V5F-T2', async ({
    context,
    world,
  }) => {
    world.seed('postos-reparo-v5f-t3');
    const page = await world.open(context);
    await playNow(page);
    // O coordenador liga este teste após juntar a V5F-T2 (comando repairOutpost e dano em incursão).
  });
});
