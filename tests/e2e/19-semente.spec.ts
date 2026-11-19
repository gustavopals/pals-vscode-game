import { type Page } from '@playwright/test';

import { expect, serverView, test } from './helpers';

const settings = (page: Page) => page.getByRole('tabpanel', { name: 'Preferências' });

async function openSettings(page: Page) {
  await page.getByRole('button', { name: 'Preferências', exact: true }).click();
  await expect(settings(page).getByRole('heading', { name: 'Preferências' })).toBeVisible();
}

test.describe('19 · Semente visível e escolhida (V5D-T1)', () => {
  test('link #/nova?seed=… preenche a criação, Preferências exibe a semente e "Nova partida com esta semente" a reaproveita', async ({
    context,
    request,
    world,
  }) => {
    const seed = 'semente-v5d-42';
    const page = await world.open(context, `/#/nova?seed=${seed}`);

    const welcome = page.getByRole('tabpanel', { name: 'Boas-vindas' });
    await expect(welcome.getByLabel('Semente (opcional)')).toHaveValue(seed);
    await welcome.getByLabel('Como devemos chamar quem governa?').fill('Gustavo');
    await welcome.getByRole('button', { name: 'Jogar agora' }).click();

    await expect(page.getByRole('heading', { name: 'Pedra Alta', level: 1 })).toBeVisible();
    expect((await serverView(page, request)).seed).toBe(seed);

    await openSettings(page);
    const gameSection = settings(page).locator('.settings-game');
    await expect(gameSection).toContainText(`Semente: ${seed}`);
    await expect(gameSection.getByRole('link', { name: 'Link desta semente' })).toHaveAttribute(
      'href',
      `#/nova?seed=${seed}`,
    );

    // "Nova partida com esta semente" arquiva a atual e funda outra com a mesma semente.
    await gameSection.getByRole('button', { name: 'Nova partida com esta semente' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText('Nova partida: dificuldade');
    await page.keyboard.press('Enter');
    await expect(dialog).toContainText('Nova partida: ritmo');
    await page.keyboard.press('Enter');
    await expect(dialog).toContainText('Começar uma nova partida?');
    await expect(dialog).toContainText(`Semente: ${seed}.`);
    await dialog.getByRole('button', { name: 'Começar outro feudo' }).click();
    await expect(dialog).toContainText('Nome do feudo');
    await dialog.getByRole('textbox').fill('Vale Novo');
    await dialog.getByRole('button', { name: 'Fundar o feudo' }).click();

    await expect(page.getByRole('heading', { name: 'Vale Novo', level: 1 })).toBeVisible();
    expect((await serverView(page, request)).seed).toBe(seed);

    await openSettings(page);
    await expect(settings(page).locator('.settings-game')).toContainText(`Semente: ${seed}`);

    // Abrir #/nova?seed=… já com partida ativa abre a criação com a semente preenchida.
    await page.goto('/#/nova?seed=semente-outra');
    await expect(dialog).toContainText('Nova partida: semente');
    await expect(dialog.getByRole('textbox')).toHaveValue('semente-outra');
    await page.keyboard.press('Escape');
  });
});
