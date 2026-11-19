import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Locator, Page } from '@playwright/test';

import {
  expect,
  HOUR,
  lowContrast,
  MINUTE,
  overflow,
  palette,
  playNow,
  serverView,
  test,
  THEMES,
  toasts,
} from './helpers';

const captureDir = process.env.LOTG_CAPTURE_DIR?.trim() ?? '';

async function setThemeInPlace(page: Page, theme: (typeof THEMES)[number]): Promise<void> {
  await page.evaluate((chosen) => {
    document.documentElement.setAttribute('data-theme', chosen);
  }, theme);
  await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
}

async function captureIfRequested(target: Page | Locator, fileName: string): Promise<void> {
  if (captureDir === '') {
    return;
  }
  mkdirSync(captureDir, { recursive: true });
  await target.screenshot({ path: join(captureDir, fileName) });
}

test.describe('Votos e Ano 2 (V5C-T4)', () => {
  test('adianta até o rescaldo do Cerco e virada do Ano 2, escolhe Votos com conferência em duas etapas e reflete no relatório, em Hoje e na Crônica do Ano', async ({
    context,
    world,
    request,
  }) => {
    let page = await world.open(context);
    await playNow(page);

    // No Ano 1, firma um Voto pela aba Exército para que o fecho do Ano 1 traga Votos e Legado.
    await page.getByRole('tab', { name: 'Exército' }).click();
    const yearOnePanel = page.getByTestId('vows-panel');
    await expect(yearOnePanel).toBeVisible();
    await yearOnePanel.getByTestId('vow-check-scarceFood').check();
    await yearOnePanel.getByTestId('vows-review-open').click();
    await expect(yearOnePanel.getByTestId('vows-confirm-text')).toContainText(
      'irreversível no ano',
    );
    await yearOnePanel.getByTestId('vows-confirm-button').click();
    await expect(yearOnePanel.getByTestId('vows-closed')).toBeVisible();

    // Prepara o Cerco pela rota /__test existente, fecha a página e adianta 5 h até o rescaldo do Cerco.
    await world.stock('food', 50_000);
    await world.stock('wood', 50_000);
    await world.stock('gold', 10_000);
    await world.stock('stone', 10_000);
    await world.control('siege', { inMinutes: 2, opposition: 'small' });
    await page.close();
    await world.passTime(5 * HOUR);
    page = await world.open(context);

    await expect(page.getByRole('tab', { name: 'Hoje' })).toHaveAttribute('aria-selected', 'true');
    const viewAtAftermath = await serverView(page, request);
    expect(viewAtAftermath.siege?.result).not.toBeNull();
    expect(viewAtAftermath.vows.closesInSeconds).toBeGreaterThan(0);
    expect(viewAtAftermath.vows.offer.length).toBeGreaterThan(0);

    // "Você ainda pode decidir" no Relatório de Retorno inclui os Votos abertos e leva ao painel.
    const today = page.getByRole('tabpanel', { name: 'Hoje' });
    const pendingBlock = today.getByRole('region', { name: /Você ainda pode decidir/ });
    await expect(pendingBlock).toContainText('Votos do ano abertos');
    await expect(pendingBlock).toContainText('fecha em');
    const chooseBtn = pendingBlock.getByRole('button', { name: 'Escolher Votos' });
    await expect(chooseBtn).toBeVisible();
    await chooseBtn.click();

    const vowsPanel = today.getByTestId('vows-panel');
    await expect(vowsPanel).toBeVisible();
    await expect(vowsPanel.getByTestId('vows-deadline')).toContainText('fecha em');

    for (const vow of viewAtAftermath.vows.offer) {
      const item = vowsPanel.getByTestId(`vow-item-${vow.id}`);
      await expect(item).toContainText(vow.label);
      await expect(item).toContainText(`+${vow.legacyBonusPercent}% de Legado`);
      await expect(item).toContainText(vow.description);
    }

    // Uma ação por estado: antes de revisar não há botão de confirmar.
    await expect(vowsPanel.getByTestId('vows-review-open')).toBeVisible();
    await expect(vowsPanel.getByTestId('vows-confirm-button')).toHaveCount(0);

    // Conferência sem nenhum Voto marcado: governar sem Votos também é uma escolha irreversível.
    await vowsPanel.getByTestId('vows-review-open').click();
    await expect(vowsPanel.getByTestId('vows-review-open')).toHaveCount(0);
    await expect(vowsPanel.getByTestId('vows-confirm-text')).toContainText(
      'nenhum Voto marcado (governar o ano sem Votos)',
    );
    await expect(vowsPanel.getByTestId('vows-confirm-text')).toContainText('irreversível no ano');
    await vowsPanel.getByTestId('vows-back').click();
    await expect(vowsPanel.getByTestId('vows-review-open')).toBeVisible();

    // Marca dois Votos para o Ano 2 e abre a segunda etapa da conferência.
    const [firstVow, secondVow] = viewAtAftermath.vows.offer;
    expect(firstVow).toBeDefined();
    expect(secondVow).toBeDefined();
    await vowsPanel.getByTestId(`vow-check-${firstVow!.id}`).check();
    await vowsPanel.getByTestId(`vow-check-${secondVow!.id}`).check();
    await vowsPanel.getByTestId('vows-review-open').click();

    const confirmText = vowsPanel.getByTestId('vows-confirm-text');
    await expect(confirmText).toContainText(firstVow!.label);
    await expect(confirmText).toContainText(secondVow!.label);
    await expect(confirmText).toContainText('irreversível no ano');

    // Contraste, overflow e capturas nos três temas com a conferência aberta (molde do 17-capela).
    await vowsPanel.scrollIntoViewIfNeeded();
    await page.evaluate(() => {
      document.querySelector('.editor-content')?.scrollBy(0, -140);
    });
    for (const theme of THEMES) {
      await setThemeInPlace(page, theme);
      expect(await lowContrast(page), `contraste no tema ${theme}`).toEqual([]);
      expect(await overflow(page), `overflow no tema ${theme}`).toEqual({ page: 0, content: 0 });
      await captureIfRequested(vowsPanel, `votos-painel-${theme}.png`);
    }
    await setThemeInPlace(page, 'dark');

    // Confirma a ordem takeVows e verifica a escolha e a janela fechada em Hoje e no rescaldo do Cerco.
    await vowsPanel.getByTestId('vows-confirm-button').click();

    await expect(vowsPanel.getByTestId('vows-closed')).toContainText(
      'Votos firmados para o próximo ano (2)',
    );
    await expect(vowsPanel.getByTestId('vows-taken-list')).toContainText(firstVow!.label);
    await expect(vowsPanel.getByTestId('vows-taken-list')).toContainText(secondVow!.label);
    await expect(vowsPanel.getByTestId('vows-review-open')).toHaveCount(0);
    await expect(vowsPanel.getByTestId('vows-confirm-button')).toHaveCount(0);
    await expect(vowsPanel.locator('input[type="checkbox"]')).toHaveCount(0);
    await expect(pendingBlock).not.toContainText('Votos do ano abertos');

    // No rescaldo do Cerco (aba Exército), a escolha e a janela fechada também aparecem.
    await page.getByRole('tab', { name: 'Exército' }).click();
    const aftermath = page.getByTestId('siege-aftermath');
    await expect(aftermath).toBeVisible();
    await expect(aftermath.getByTestId('vows-closed')).toBeVisible();
    await expect(aftermath.getByTestId('vows-taken-list')).toContainText(firstVow!.label);
    await expect(aftermath.getByTestId('vows-taken-list')).toContainText(secondVow!.label);

    // Adianta estação a estação até a virada para o Ano 2, pelos prazos públicos da visão.
    let viewYearTwo = await serverView(page, request);
    while (viewYearTwo.calendar.year === 1) {
      await world.passTime(viewYearTwo.calendar.secondsToNextSeason * 1000 + MINUTE, page);
      viewYearTwo = await serverView(page, request);
    }
    expect(viewYearTwo.calendar.year).toBe(2);
    expect(viewYearTwo.vows.closesInSeconds).toBe(0);
    expect(viewYearTwo.vows.taken.map((vow) => vow.id)).toEqual([firstVow!.id, secondVow!.id]);

    const armyPanel = page.getByRole('tabpanel', { name: 'Exército' });
    const armyVows = armyPanel.getByTestId('vows-panel');
    await expect(armyVows.getByTestId('vows-closed')).toContainText('Votos ativos neste ano (2)');
    await expect(armyVows.getByTestId('vows-taken-list')).toContainText(firstVow!.label);
    await expect(armyVows.getByTestId('vows-taken-list')).toContainText(secondVow!.label);
    await expect(armyVows.getByTestId('vows-review-open')).toHaveCount(0);

    // Recolhe avisos de virada de estação antes das capturas para não cobrir o painel.
    await palette(page, 'Silenciar notificações');
    await armyVows.scrollIntoViewIfNeeded();
    await page.evaluate(() => {
      document.querySelector('.editor-content')?.scrollBy(0, -140);
    });
    for (const theme of THEMES) {
      await setThemeInPlace(page, theme);
      expect(await lowContrast(page), `contraste fechado no tema ${theme}`).toEqual([]);
      expect(await overflow(page), `overflow fechado no tema ${theme}`).toEqual({
        page: 0,
        content: 0,
      });
      await captureIfRequested(armyVows, `votos-fechados-ano2-${theme}.png`);
    }
    await setThemeInPlace(page, 'dark');

    // Na aba Hoje, a escolha permanece visível com a janela encerrada e sem repetir item aberto.
    await page.getByRole('tab', { name: 'Hoje' }).click();
    const todayYearTwo = page.getByRole('tabpanel', { name: 'Hoje' });
    await expect(todayYearTwo.getByTestId('vows-closed')).toBeVisible();
    await expect(todayYearTwo.getByTestId('vows-taken-list')).toContainText(firstVow!.label);
    await expect(todayYearTwo.getByTestId('vows-taken-list')).toContainText(secondVow!.label);

    // Pela paleta com a janela já fechada: avisa os Votos ativos sem enviar nova ordem.
    await palette(page, 'Firmar Votos');
    await expect(toasts(page)).toContainText('janela de Votos deste ano já fechou');
    await expect(toasts(page)).toContainText(firstVow!.label);

    // Abre a Crônica pela paleta e confere os Votos e o Legado do Ano 1 em YearChronicle.
    await palette(page, 'Abrir a Crônica');
    const chronicle = page.getByRole('tabpanel', { name: 'Crônica' });
    const legacyBox = chronicle.getByTestId('year-chronicle-legacy');
    await expect(legacyBox).toBeVisible();
    await expect(legacyBox.getByTestId('year-vows-1')).toContainText('Comida escassa');
    await expect(legacyBox.getByTestId('year-legacy-points-1')).toContainText(/pontos/);
    await chronicle.getByLabel('Ano', { exact: true }).selectOption('1');
    await expect(legacyBox.getByTestId('year-vows-1')).toContainText('Comida escassa');
    await expect(legacyBox.getByTestId('year-legacy-points-1')).toContainText(/pontos/);

    expect(world.problems).toEqual([]);
  });
});
