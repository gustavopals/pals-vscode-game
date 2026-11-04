import type { Page } from '@playwright/test';

import {
  applyTheme,
  expect,
  HOUR,
  lowContrast,
  MINUTE,
  overflow,
  playNow,
  serverView,
  statusBar,
  test,
  THEMES,
  tree,
  type World,
} from './helpers';

// V4G-T4: cenários escritos sem execução nesta trilha. A rota só prepara o Cerco;
// a tela envia as ordens e o motor resolve as ondas. Milícia e Markdown anual dependem
// dos campos/rotas registrados em G-15–G-17, sem expectativa inventada aqui.
const panel = (page: Page) => page.getByTestId('siege-panel');

async function openSiege(
  world: World,
  page: Page,
  opposition: 'small' | 'overwhelming' = 'small',
  inMinutes = 2,
) {
  await playNow(page);
  await world.stock('food', 10_000);
  await world.stock('gold', 10_000);
  await world.stock('stone', 10_000);
  await world.control('siege', { inMinutes, opposition });
  await world.passTime(MINUTE, page);
  await page.getByRole('tab', { name: 'Exército' }).click();
  await expect(panel(page)).toBeVisible();
}

test.describe('o Cerco do Inverno (V4G-T4)', () => {
  test('plano por onda, troca pelo teclado e três ondas até o resultado', async ({
    context,
    world,
    request,
  }) => {
    const page = await world.open(context);
    await openSiege(world, page);
    const sent: Array<{ type: string; payload: unknown }> = [];
    page.on('request', (outgoing) => {
      if (outgoing.method() === 'POST' && outgoing.url().endsWith('/commands')) {
        const order = outgoing.postDataJSON() as { type: string; payload: unknown };
        sent.push({ type: order.type, payload: order.payload });
      }
    });
    const view = await serverView(page, request);
    const other = view.army.formations[1]!;
    for (const wave of [1, 2, 3])
      await expect(page.getByTestId(`siege-plan-${wave}`)).toHaveValue('');
    await page.getByTestId('siege-plan-2').selectOption(other.id);
    expect(sent).toEqual([]);
    await panel(page).getByRole('button', { name: 'Salvar onda 2' }).focus();
    await page.keyboard.press('Enter');
    await expect(panel(page).getByRole('button', { name: 'Salvar onda 2' })).toBeDisabled();
    expect(sent).toContainEqual({
      type: 'setBattlePlan',
      payload: { wave: 2, formationId: other.id },
    });
    await world.passTime(2 * MINUTE, page);
    await expect(page.getByTestId('siege-decision')).toContainText('onda 2');
    await expect(panel(page)).toContainText('Enfrentada');
    await expect(statusBar(page)).toContainText('onda 2');
    await expect(page).toHaveTitle(/Cerco · onda 2/);
    await panel(page).getByRole('button', { name: 'Trocar formação…' }).focus();
    await page.keyboard.press('Enter');
    const picker = page.getByRole('dialog');
    await expect(picker.getByRole('combobox')).toBeFocused();
    await picker.getByRole('option', { name: /Usar a Defesa ativa/ }).click();
    await expect(picker).toHaveCount(0);
    await expect(page.getByTestId('siege-decision')).toContainText(
      'Formação marcada: Defesa ativa',
    );
    expect(sent).toContainEqual({ type: 'swapWaveFormation', payload: { formationId: null } });
    await world.passTime(HOUR, page);
    await expect(page.getByTestId('siege-decision')).toContainText('onda 3');
    await world.passTime(HOUR, page);
    const after = await serverView(page, request);
    expect(after.siege?.current).toBe(3);
    expect(after.siege?.result).not.toBeNull();
    await expect(page.getByTestId('siege-aftermath')).toContainText(after.siege!.resultText!);
    await expect(page.getByTestId('siege-decision')).toHaveCount(0);
    await expect(panel(page).getByText('Enfrentada', { exact: true })).toHaveCount(3);
  });

  test('reparo exige conferência de custo e o prazo fecha uma troca aberta sem enviar', async ({
    context,
    world,
  }) => {
    const page = await world.open(context);
    await openSiege(world, page);
    await world.passTime(2 * MINUTE, page);
    const repair = panel(page).getByRole('button', { name: 'Reparar agora…' });
    await expect(repair).toBeEnabled();
    await repair.focus();
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText(/de pedra e .* de ouro/);
    await dialog.getByRole('button', { name: 'Confirmar o reparo' }).click();
    await expect(dialog).toHaveCount(0);
    await expect(repair).toBeDisabled();
    await panel(page).getByRole('button', { name: 'Trocar formação…' }).click();
    await expect(dialog).toBeVisible();
    await world.passTime(HOUR, page);
    await expect(dialog).toHaveCount(0);
    await expect(page.getByTestId('siege-decision')).toContainText('onda 3');
    await expect(page.getByRole('region', { name: 'Avisos' })).toContainText(
      'O Cerco mudou ou o prazo acabou',
    );
  });

  test('Queda durante a ausência aparece no Retorno e deixa o feudo jogável', async ({
    context,
    world,
    request,
  }) => {
    const page = await world.open(context);
    await openSiege(world, page, 'overwhelming', 300);
    await page.close();
    await world.jump(6 * HOUR);
    const returned = await world.open(context);
    await expect(returned.getByRole('heading', { name: 'Relatório de Retorno' })).toBeVisible();
    await expect(returned.getByText('O que exigiu um preço', { exact: false })).toBeVisible();
    await returned.getByRole('button', { name: 'Ver o rescaldo', exact: true }).click();
    const view = await serverView(returned, request);
    expect(view.siege?.result).toBe('fall');
    await expect(returned.getByTestId('siege-aftermath')).toContainText('Queda');
    await expect(panel(returned)).toContainText('O feudo segue.');
    await panel(returned).getByRole('button', { name: 'Ver as obras' }).click();
    await expect(returned.getByRole('heading', { name: 'Construções', exact: true })).toBeFocused();
  });

  test('no ritmo da produção o prazo entre ondas continua sendo de uma hora real', async ({
    context,
    world,
    request,
  }) => {
    const page = await world.open(context);
    // A opção é escolhida antes de fundar: o servidor confirma o ritmo na visão.
    await expect(page.getByRole('radio', { name: /Rápido/ })).toBeVisible();
    await page.getByRole('radio', { name: /Rápido/ }).check();
    await openSiege(world, page);
    await world.passTime(2 * MINUTE, page);
    const view = await serverView(page, request);
    expect(view.settlement.paceLabel).toContain('Rápido');
    const decision = view.pendingDecisions.find((entry) => entry.kind === 'siegeWave');
    expect(decision?.expiresInSeconds).toBeGreaterThan(3500);
    expect(decision?.expiresInSeconds).toBeLessThanOrEqual(3600);
    await world.passTime(50 * MINUTE, page);
    await expect(page.getByTestId('siege-decision')).toContainText('onda 2');
    await world.passTime(10 * MINUTE, page);
    await expect(page.getByTestId('siege-decision')).toContainText('onda 3');
  });

  test('o modo discreto esconde o assunto na barra e no título e preserva a decisão na árvore', async ({
    context,
    world,
  }) => {
    const page = await world.open(context);
    await openSiege(world, page);
    await page.evaluate(() => {
      const saved = JSON.parse(localStorage.getItem('lords.preferences') ?? '{}') as object;
      localStorage.setItem('lords.preferences', JSON.stringify({ ...saved, discreetMode: true }));
    });
    await page.reload();
    await expect(panel(page)).toBeVisible();
    await world.passTime(2 * MINUTE, page);
    await expect(page.getByTestId('siege-decision')).toContainText('onda 2');
    await expect(statusBar(page)).not.toContainText('Cerco');
    await expect(page).not.toHaveTitle(/Cerco/);
    await expect(tree(page).locator('[data-node="siege"]')).toContainText('Cerco do Inverno');
    await expect(page.getByRole('region', { name: 'Avisos' })).not.toContainText('onda');
  });

  for (const theme of THEMES) {
    test(`${theme}: plano e decisão em 720 px, contraste, árvore e foco de retorno`, async ({
      context,
      world,
    }) => {
      const page = await world.open(context);
      await page.setViewportSize({ width: 720, height: 900 });
      await openSiege(world, page);
      await applyTheme(page, theme);
      await expect.poll(() => overflow(page)).toEqual({ page: 0, content: 0 });
      expect(await lowContrast(page)).toEqual([]);
      await world.passTime(2 * MINUTE, page);
      await page
        .locator('.activitybar')
        .getByRole('button', { name: /^Feudo/ })
        .click();
      await expect(page.locator('#sidebar')).toBeVisible();
      await tree(page)
        .locator('[data-node="siege"]')
        .getByText('Cerco do Inverno', { exact: true })
        .click();
      await expect(page.locator('#sidebar')).toBeHidden();
      await expect(
        page.getByRole('heading', { name: 'Cerco do Inverno', exact: true }),
      ).toBeFocused();
      const swap = panel(page).getByRole('button', { name: 'Trocar formação…' });
      await swap.focus();
      await page.keyboard.press('Enter');
      await expect(page.getByRole('dialog').getByRole('combobox')).toBeFocused();
      await page.keyboard.press('Escape');
      await expect(swap).toBeFocused();
      await expect.poll(() => overflow(page)).toEqual({ page: 0, content: 0 });
      expect(await lowContrast(page)).toEqual([]);
    });
  }
});
