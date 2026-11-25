import { mkdirSync } from 'node:fs';

import {
  cutTreeRows,
  expect,
  fief,
  lowContrast,
  MINUTE,
  overflow,
  palette,
  playNow,
  serverView,
  test,
  THEMES,
  toasts,
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

  test('incursão real rompe a defesa, avisa o risco, aparece no relatório de batalha, recusa reparo sem recursos e repara pela ficha e pela paleta', async ({
    context,
    request,
    world,
  }) => {
    world.seed('postos-reparo-v5f-t3');
    const page = await world.open(context);
    await playNow(page);

    // Salão Nv5 libera os postos; Torre Nv2 revela a incursão à vista; Quartel exibe o relatório de batalha.
    // Sem Paliçada e sem soldados, a incursão real rompe a defesa e danifica o posto ativo mais distante.
    await world.raise('townHall', 5);
    await world.raise('warehouse', 1);
    await world.raise('watchtower', 2);
    await world.raise('barracks', 1);
    await world.stock('wood', 700);
    await world.stock('stone', 500);
    await world.stock('gold', 400);
    await world.mapFog({
      '-3,0': 'explored',
      '1,0': 'explored',
    });
    await world.passTime(MINUTE, page);

    // 1. Reivindica dois postos (-3,0 distância 3 e 1,0 distância 1) e conclui as obras.
    await tree(page).locator('[data-node="map"]').click();
    const mapSvg = page.locator('svg.hex-map-svg');
    const sheet = page.getByTestId('hex-sheet');
    const mineHex = mapSvg.locator('g[data-hex="-3,0"]');
    const patrolHex = mapSvg.locator('g[data-hex="1,0"]');

    await mineHex.click();
    await sheet.locator('[data-map-action="claimOutpost"]').click();
    await expect(mineHex).toHaveAttribute('data-outpost', 'building');

    await patrolHex.click();
    await sheet.locator('[data-map-action="claimOutpost"]').click();
    await expect(patrolHex).toHaveAttribute('data-outpost', 'building');

    await world.passTime(45 * MINUTE, page);
    await expect(mineHex).toHaveAttribute('data-outpost', 'active');
    await expect(patrolHex).toHaveAttribute('data-outpost', 'active');

    // 2. Agenda uma incursão real: Ameaça e Hoje mostram `outpostRiskText` apontando para o posto mais distante.
    await world.control('raid-in', { inSeconds: 300 });
    await world.passTime(MINUTE, page);

    const beforeRaid = await serverView(page, request);
    const riskText = beforeRaid.threat.incoming?.outpostRiskText;
    expect(riskText).toBeTruthy();

    await page.getByRole('tab', { name: 'Feudo' }).click();
    const riskLine = fief(page).getByTestId('raid-outpost-risk');
    await expect(riskLine).toBeVisible();
    await expect(riskLine).toContainText(riskText!);

    await page.getByRole('tab', { name: 'Hoje' }).click();
    const leaving = page
      .getByRole('tabpanel', { name: 'Hoje' })
      .getByRole('region', { name: 'Antes de partir' });
    await expect(leaving.getByRole('listitem').first()).toContainText(riskText!);

    // 3. A incursão chega, rompe a defesa, danifica -3,0 e registra `damagedOutpost.text` no relatório de batalha.
    await world.passTime(5 * MINUTE, page);

    const afterRaid = await serverView(page, request);
    const damagedMine = afterRaid.map.hexes.find((hex) => hex.q === -3 && hex.r === 0);
    const intactPatrol = afterRaid.map.hexes.find((hex) => hex.q === 1 && hex.r === 0);
    expect(damagedMine && 'outpost' in damagedMine ? damagedMine.outpost?.status : null).toBe(
      'damaged',
    );
    expect(intactPatrol && 'outpost' in intactPatrol ? intactPatrol.outpost?.status : null).toBe(
      'active',
    );
    const battleDamagedText = afterRaid.army.reports[0]?.damagedOutpost?.text;
    expect(battleDamagedText).toBeTruthy();

    await page.getByRole('tab', { name: 'Exército' }).click();
    const battleDamaged = page.getByTestId('battle-damaged-outpost').first();
    await expect(battleDamaged).toBeVisible();
    await expect(battleDamaged).toContainText(battleDamagedText!);

    // 4. Na aba Mapa, confere estado danificado, detalhe, custo de reparo e recusa real por falta de recursos.
    await world.stock('wood', 300);
    await world.stock('stone', 200);
    await world.passTime(MINUTE, page);

    // Dispensa os avisos da incursão no canto inferior direito antes de clicar nos botões da ficha.
    const dismissToasts = async () => {
      const closeButtons = toasts(page).getByRole('button', { name: 'Dispensar aviso' });
      while ((await closeButtons.count()) > 0) {
        await closeButtons.first().click();
      }
    };
    await dismissToasts();

    await page.getByRole('tab', { name: 'Mapa' }).click();
    await mineHex.click();
    await expect(mineHex).toHaveAttribute('data-outpost', 'damaged');
    await expect(mineHex.locator('[data-outpost-mark="damaged"]')).toHaveCount(1);
    await expect(sheet.getByTestId('hex-outpost-status')).toContainText(
      'Posto avançado: danificado',
    );

    const readyView = await serverView(page, request);
    const readyHex = readyView.map.hexes.find((hex) => hex.q === -3 && hex.r === 0);
    const readyOutpost = readyHex && 'outpost' in readyHex ? readyHex.outpost : undefined;
    expect(readyOutpost?.detail).toBeTruthy();
    expect(readyOutpost?.repairCost?.length).toBeGreaterThan(0);

    await expect(sheet.getByTestId('hex-outpost-detail')).toHaveText(readyOutpost!.detail!);
    const costBox = sheet.getByTestId('hex-outpost-repair-cost');
    for (const entry of readyOutpost!.repairCost!) {
      await expect(costBox).toContainText(`${entry.amount} ${entry.label.toLowerCase()}`);
    }
    const repairButton = sheet.locator('[data-map-action="repairOutpost"]');
    await expect(repairButton).toBeEnabled();

    // Baixa a madeira no servidor sem atualizar a tela: o clique envia `repairOutpost`, recebe 422
    // por falta de recursos, exibe o aviso e atualiza a ficha com o chip faltante e o botão travado.
    await world.stock('wood', 20);
    await repairButton.click();

    const blockedView = await serverView(page, request);
    const blockedHex = blockedView.map.hexes.find((hex) => hex.q === -3 && hex.r === 0);
    const blockedOutpost = blockedHex && 'outpost' in blockedHex ? blockedHex.outpost : undefined;
    const blockedReason = blockedOutpost?.repairBlockedReason;
    expect(blockedReason).toBeTruthy();

    await expect(toasts(page)).toContainText(blockedReason!);
    await expect(sheet.getByTestId('hex-outpost-repair-blocked')).toContainText(blockedReason!);
    await expect(costBox.locator('.chip-missing')).toContainText('faltam');
    await expect(repairButton).toBeDisabled();
    await expect(mineHex).toHaveAttribute('data-outpost', 'damaged');
    await expect(tree(page).locator('[data-node="outpost:outpost-1"]')).toContainText(
      '⚠ danificado',
    );

    // Pela paleta, sem recursos para o posto danificado, não abre diálogo e informa o motivo do servidor.
    await dismissToasts();
    await palette(page, 'Reparar posto');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(toasts(page)).toContainText(blockedReason!);

    // Fecha os avisos antes das capturas para a ficha do posto danificado ficar desimpedida.
    await dismissToasts();

    // Contraste, transbordo e capturas do posto danificado nos três temas (via LOTG_CAPTURE_DIR).
    if (CAPTURE_DIR !== undefined) {
      mkdirSync(CAPTURE_DIR, { recursive: true });
      await page.locator('.editor-content').evaluate((el) => el.scrollTo(0, 0));
    }
    for (const theme of THEMES) {
      await page.evaluate((chosen) => {
        document.documentElement.setAttribute('data-theme', chosen);
      }, theme);
      expect(await lowContrast(page), `contraste posto danificado (${theme})`).toEqual([]);
      expect(await overflow(page), `transbordo posto danificado (${theme})`).toEqual({
        page: 0,
        content: 0,
      });
      if (CAPTURE_DIR !== undefined) {
        await page.screenshot({
          path: `${CAPTURE_DIR}/postos-danificado-${theme}.png`,
          caret: 'hide',
          animations: 'disabled',
        });
      }
    }
    await page.evaluate(() => {
      document.documentElement.setAttribute('data-theme', 'dark');
    });

    // 5. Repõe madeira e pedra e repara pela ficha do mapa: desconta custo e volta a "ativo".
    await world.stock('wood', 400);
    await world.stock('stone', 300);
    await world.passTime(MINUTE, page);

    await expect(sheet.getByTestId('hex-outpost-repair-blocked')).toHaveCount(0);
    await expect(costBox.locator('.chip-missing')).toHaveCount(0);
    await expect(repairButton).toBeEnabled();
    expect(await lowContrast(page), 'contraste posto pronto para reparo (dark)').toEqual([]);

    const stockBefore = await serverView(page, request);
    const woodBefore = stockBefore.resources.find((row) => row.id === 'wood')!.stock;
    const stoneBefore = stockBefore.resources.find((row) => row.id === 'stone')!.stock;

    await repairButton.click();

    await expect(mineHex).toHaveAttribute('data-outpost', 'active');
    await expect(mineHex).toHaveAttribute('data-fog', 'claimed');
    await expect(mineHex.locator('[data-outpost-mark="active"]')).toHaveCount(1);
    await expect(sheet.getByTestId('hex-outpost-status')).toContainText('Posto avançado: ativo');
    await expect(sheet.getByTestId('hex-outpost-repair-cost')).toHaveCount(0);
    await expect(repairButton).toHaveCount(0);
    await expect(tree(page).locator('[data-node="outpost:outpost-1"]')).toContainText('ativo');

    const afterSheetRepair = await serverView(page, request);
    const repairedHex = afterSheetRepair.map.hexes.find((hex) => hex.q === -3 && hex.r === 0);
    expect(repairedHex && 'outpost' in repairedHex ? repairedHex.outpost?.status : null).toBe(
      'active',
    );
    const woodCost = readyOutpost!.repairCost!.find((entry) => entry.resource === 'wood')!.amount;
    const stoneCost = readyOutpost!.repairCost!.find((entry) => entry.resource === 'stone')!.amount;
    expect(afterSheetRepair.resources.find((row) => row.id === 'wood')!.stock).toBeLessThanOrEqual(
      woodBefore - woodCost + 1,
    );
    expect(afterSheetRepair.resources.find((row) => row.id === 'stone')!.stock).toBeLessThanOrEqual(
      stoneBefore - stoneCost + 1,
    );

    // 6. Segunda incursão real danifica o posto novamente; repara pela Paleta de Comandos e volta a "ativo".
    await world.control('raid-in', { inSeconds: 120 });
    await world.passTime(3 * MINUTE, page);
    await expect(mineHex).toHaveAttribute('data-outpost', 'damaged');

    await world.stock('wood', 400);
    await world.stock('stone', 300);
    await world.passTime(MINUTE, page);

    await palette(page, 'Reparar posto');
    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText('Reparar posto avançado');
    await expect(dialog).toContainText('Mina Abandonada (-3, 0)');
    await expect(dialog).toContainText(`${woodCost} madeira, ${stoneCost} pedra`);
    await dialog.getByRole('option', { name: /Mina Abandonada \(-3, 0\)/ }).click();
    await expect(dialog).toHaveCount(0);

    await expect(mineHex).toHaveAttribute('data-outpost', 'active');
    await expect(sheet.getByTestId('hex-outpost-status')).toContainText('Posto avançado: ativo');
    await expect(tree(page).locator('[data-node="outpost:outpost-1"]')).toContainText('ativo');
    expect(await cutTreeRows(page)).toEqual([]);
    await expect(mapSvg.locator('[style]')).toHaveCount(0);

    const finalView = await serverView(page, request);
    const finalHex = finalView.map.hexes.find((hex) => hex.q === -3 && hex.r === 0);
    expect(finalHex && 'outpost' in finalHex ? finalHex.outpost?.status : null).toBe('active');
    expect(world.problems).toEqual([]);
  });
});
