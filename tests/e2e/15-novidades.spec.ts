import {
  applyTheme,
  expect,
  lowContrast,
  overflow,
  palette,
  playNow,
  test,
  THEMES,
} from './helpers';

test('Novidades pela paleta e pelo teclado: leitura por conta, selo e três temas em 720 px', async ({
  context,
  world,
}) => {
  const page = await world.open(context);
  await playNow(page);
  await page.getByRole('button', { name: 'Conta', exact: true }).click();
  const newsItem = page.locator('[data-node="account:news"]');
  await expect(newsItem.locator('.chip')).toHaveText('novo');

  // A leitura feita nesta aba também apaga o selo na outra, sem trocar de conta.
  const other = await world.open(context);
  await other.getByRole('button', { name: 'Conta', exact: true }).click();
  const otherBadge = other.locator('[data-node="account:news"] .chip');
  await expect(otherBadge).toHaveText('novo');

  await page.bringToFront();
  await palette(page, 'Novidades');
  const heading = page.getByRole('heading', { name: 'Novidades', exact: true });
  await expect(heading).toBeVisible();
  await expect(heading).toBeFocused();
  await expect(page).toHaveURL(/#\/novidades$/);
  await expect(page.getByRole('tab', { name: 'Novidades', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await expect(newsItem.locator('.chip')).toHaveCount(0);
  await expect(otherBadge).toHaveCount(0);
  await other.close();
  const war = page.getByRole('article', { name: 'v0.4.0 · Guerra e Cerco', exact: true });
  await expect(war.locator('.muted')).toHaveText('Publicada em 17/11/2026');
  await expect(war.locator('.news-draft-note')).toHaveCount(0);

  // Fecha e abre pelo item do menu com Enter; o foco chega ao título da leitura.
  await page.getByRole('button', { name: 'Fechar a aba Novidades' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('tab', { name: 'Novidades', exact: true })).toHaveCount(0);
  await newsItem.focus();
  await page.keyboard.press('Enter');
  await expect(heading).toBeFocused();

  // O outro atalho da paleta e o acesso ao lado da Privacidade também funcionam por teclado.
  await page.keyboard.press('Control+k');
  await expect(page.getByRole('combobox', { name: 'Paleta de comandos' })).toBeFocused();
  await page.keyboard.type('Sobre');
  await page.keyboard.press('Enter');
  const about = page.getByRole('tabpanel', { name: 'Sobre', exact: true });
  await expect(about.getByRole('button', { name: 'Privacidade', exact: true })).toBeVisible();
  await about.getByRole('button', { name: 'Novidades', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(heading).toBeFocused();

  await page.setViewportSize({ width: 720, height: 800 });
  for (const theme of THEMES) {
    await applyTheme(page, theme);
    await expect(heading).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Novidades', exact: true })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(await overflow(page), theme).toEqual({ page: 0, content: 0 });
    expect(await lowContrast(page), theme).toEqual([]);
    expect(await page.locator('[style]').count()).toBe(0);
    await page.getByRole('button', { name: 'Conta', exact: true }).click();
    await expect(newsItem.locator('.chip')).toHaveCount(0);
    await page.getByRole('button', { name: 'Conta', exact: true }).click();
  }
  const marks = await page.evaluate(() =>
    Object.keys(localStorage)
      .filter((key) => key.startsWith('lords.newsSeen:'))
      .map((key) => JSON.parse(localStorage.getItem(key) ?? 'null') as unknown),
  );
  expect(marks).toEqual(['0.4.0']);
  expect(world.problems).toEqual([]);
});
