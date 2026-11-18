import { mkdirSync } from 'node:fs';

import { expect, HOUR, MINUTE, palette, playNow, serverView, test, THEMES } from './helpers';

const CAPTURE_DIR = '/tmp/claude-1000/v5b-t4-capturas';

test.describe('17 · Capela e relíquias (V5B-T4)', () => {
  test('sem Capela mostra o que falta; ergue a Capela, ganha relíquia, coloca pela tela, vê "vale a partir de", passa o dia e vê ativa, retira e opera pela paleta', async ({
    context,
    request,
    world,
  }) => {
    const page = await world.open(context);
    await playNow(page);

    // Concede uma relíquia antes de erguer a Capela
    await world.relic('oakHeart');
    await world.passTime(MINUTE, page);
    await page.getByRole('tab', { name: /^Guilda/ }).click();

    const panel = page.getByRole('region', { name: 'Capela e relíquias' });
    await expect(panel).toBeVisible();
    await expect(panel).toContainText('Espaços na Capela: 0/0.');

    const initialServerView = await serverView(page, request);
    const chapelUpgrade = initialServerView.constructions.available.find(
      (entry) => entry.building === 'chapel',
    )!;
    const initialOak = initialServerView.relics.items.find(
      (entry) => entry.relicId === 'oakHeart',
    )!;

    // Sem Capela, mostra a linha curta do que falta vinda da visão e o bloqueio na relíquia
    await expect(panel).toContainText(chapelUpgrade.blockedReason!);
    await expect(panel).toContainText(initialOak.label);
    await expect(panel).toContainText(initialOak.effectText);
    await expect(panel).toContainText(initialOak.blockedReason!);
    await expect(panel.getByRole('button', { name: `Colocar ${initialOak.label}` })).toBeDisabled();
    await expect(panel.getByRole('button', { name: `Retirar ${initialOak.label}` })).toBeDisabled();

    // Ergue o Salão Nv5 e a Capela Nv1, e concede uma segunda relíquia para testar o limite de espaço
    await world.raise('townHall', 5);
    await world.raise('chapel', 1);
    await world.relic('wolfBone');
    await world.passTime(MINUTE, page);

    await expect(panel).toContainText('Espaços na Capela: 0/1.');
    const placeOakBtn = panel.getByRole('button', { name: `Colocar ${initialOak.label}` });
    await expect(placeOakBtn).toBeEnabled();

    // Coloca a relíquia pela tela
    await placeOakBtn.click();
    await expect(panel).toContainText('Espaços na Capela: 1/1.');

    const placedServerView = await serverView(page, request);
    const placedOak = placedServerView.relics.items.find((entry) => entry.relicId === 'oakHeart')!;
    const blockedWolf = placedServerView.relics.items.find(
      (entry) => entry.relicId === 'wolfBone',
    )!;

    // Vê "Vale a partir da próxima virada de dia de jogo: em …" e o bloqueio de espaço na outra relíquia
    expect(placedOak.placed).toBe(true);
    expect(placedOak.active).toBe(false);
    await expect(panel).toContainText('Vale a partir da próxima virada de dia de jogo:');
    await expect(panel).toContainText(blockedWolf.blockedReason!);
    await expect(
      panel.getByRole('button', { name: `Colocar ${blockedWolf.label}` }),
    ).toBeDisabled();

    // Passa o dia de jogo (6 h reais = 1 dia de jogo no ritmo Normal 1) e vê a relíquia ativa
    await world.passTime(6 * HOUR, page);

    const activeServerView = await serverView(page, request);
    const activeOak = activeServerView.relics.items.find((entry) => entry.relicId === 'oakHeart')!;
    expect(activeOak.active).toBe(true);
    await expect(panel).toContainText('1 ativa');
    await expect(panel).toContainText('Colocada · Ativa');
    await expect(panel).toContainText(activeOak.effectiveText!);

    // Capturas de tela do painel nos três temas para revisão visual
    mkdirSync(CAPTURE_DIR, { recursive: true });
    await panel.scrollIntoViewIfNeeded();
    for (const theme of THEMES) {
      await page.evaluate((t) => {
        document.documentElement.setAttribute('data-theme', t);
      }, theme);
      await page.screenshot({
        path: `${CAPTURE_DIR}/capela-${theme}.png`,
        fullPage: false,
      });
    }
    await page.evaluate(() => {
      document.documentElement.setAttribute('data-theme', 'dark');
    });

    // Retira a relíquia pela tela
    const removeOakBtn = panel.getByRole('button', { name: `Retirar ${initialOak.label}` });
    await expect(removeOakBtn).toBeEnabled();
    await removeOakBtn.click();
    await expect(panel).toContainText('Espaços na Capela: 0/1.');
    await expect(placeOakBtn).toBeEnabled();

    // Uma ordem pela paleta: colocar relíquia na Capela
    await palette(page, 'Colocar relíquia na Capela');
    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText(initialOak.label);
    await page.keyboard.press('Enter');
    await expect(panel).toContainText('Espaços na Capela: 1/1.');

    expect(world.problems).toEqual([]);
  });
});
