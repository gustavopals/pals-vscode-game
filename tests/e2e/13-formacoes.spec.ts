import type { Page } from '@playwright/test';

import { expect, MINUTE, playNow, serverView, test, type World } from './helpers';

// V4C-T3.3 (GDD §13.4; ADR 0019, decisões 8 e 9): o editor de formação da aba Exército. A grade de
// três alas por duas linhas, o seletor de cada posto (Enter), o comandante de cada ala e "Salvar".
// O que está marcado é estado da tela; a ordem nasce em "Salvar". Tudo pelo teclado.

const armyTab = (page: Page) => page.getByRole('tab', { name: 'Exército' });
const editor = (page: Page) => page.getByTestId('formation-editor');
const post = (page: Page, wing: string, line: string) => page.getByTestId(`post-${wing}-${line}`);

/** Funda o feudo, ergue o Quartel, põe tropa e abre a aba Exército. */
async function openEditor(world: World, page: Page) {
  await playNow(page);
  await world.raise('housing', 6);
  await world.raise('barracks', 4);
  await world.soldiers({ spearman: 8, shieldbearer: 6, archer: 6, knight: 0 });
  await world.passTime(MINUTE, page);
  await armyTab(page).click();
  await expect(editor(page)).toBeVisible();
}

/** Põe uma unidade em um posto só pelo teclado: Enter abre, escolhe, digita, Enter aplica. */
async function fillPost(page: Page, wing: string, line: string, unit: string, amount: string) {
  await post(page, wing, line).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('post-dialog')).toBeVisible();
  await expect(page.getByTestId('post-unit')).toBeFocused();
  await page.getByTestId('post-unit').selectOption(unit);
  await page.getByTestId('post-amount').fill(amount);
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('post-dialog')).toHaveCount(0);
}

test.describe('o editor de formação (V4C-T3.3)', () => {
  test('captura: formação de três postos', async ({ context, world }) => {
    const page = await world.open(context);
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await openEditor(world, page);
    await editor(page).getByTestId('formation-name').fill('Muralha Firme');
    await fillPost(page, 'center', 'front', 'spearman', '5');
    await fillPost(page, 'left', 'front', 'shieldbearer', '4');
    await fillPost(page, 'center', 'back', 'archer', '6');
    await expect(post(page, 'center', 'front')).toContainText('Lanceiro × 5');
    await editor(page).scrollIntoViewIfNeeded();
    await editor(page).screenshot({
      path: '/tmp/claude-1000/-opt-pals-vscode-game/220c2719-684e-4dfc-93f2-404687422251/scratchpad/editor-3-postos.png',
    });
    void serverView;
  });
});
