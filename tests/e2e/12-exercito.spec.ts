import type { Page } from '@playwright/test';

import { expect, MINUTE, palette, playNow, serverView, test, tree, type World } from './helpers';

// V4C-T3.2 (GDD §6.1 e §10.2; ADR 0019, decisão 7): o Quartel na aba Exército. Sem o Quartel, a
// aba diz como erguê-lo; de pé, o treino é em duas etapas ("Revisar o treino" e "Confirmar"); com
// um lote no pátio, quando termina e "Cancelar o treino"; com soldados, "Dispensar" também
// confirma. Tudo pelo teclado, e o que a tela diz do custo e do prazo é o que o servidor mandou
// na visão. O editor de formação é da V4C-T3.3 e não está aqui.
//
// O Quartel é posto de pé e o estoque é posto pelas rotas de teste (`world.raise`, `world.stock`);
// daí em diante a cobrança, o prazo, o cancelamento e a chegada dos soldados são os do motor.

const armyTab = (page: Page) => page.getByRole('tab', { name: 'Exército' });
const armyPanel = (page: Page) => page.getByRole('tabpanel', { name: 'Exército' });
const barracks = (page: Page) => armyPanel(page).getByRole('region', { name: 'Quartel' });
const trainForm = (page: Page) => barracks(page).getByRole('form', { name: 'Treinar soldados' });
const disbandForm = (page: Page) =>
  barracks(page).getByRole('form', { name: 'Dispensar soldados' });
const running = (page: Page) => barracks(page).getByTestId('army-running');

/** As ordens (`POST …/commands`) que a página mandar daqui em diante, na ordem em que saem. */
function commandPosts(page: Page): Array<{ type: string; commandId: string; payload: unknown }> {
  const sent: Array<{ type: string; commandId: string; payload: unknown }> = [];
  page.on('request', (outgoing) => {
    if (outgoing.method() === 'POST' && outgoing.url().endsWith('/commands')) {
      sent.push(outgoing.postDataJSON() as (typeof sent)[number]);
    }
  });
  return sent;
}

/** Funda o feudo, põe o Quartel de pé com o estoque e abre a aba Exército. */
async function openBarracks(world: World, page: Page) {
  await playNow(page);
  await world.raise('barracks', 1);
  await world.stock('food', 900);
  await world.stock('gold', 900);
  await world.stock('wood', 700);
  await world.passTime(MINUTE, page);
  await armyTab(page).click();
  await expect(trainForm(page)).toBeVisible();
}

test.describe('a aba Exército (V4C-T3.2)', () => {
  test('é fixa depois do Mercado, tem endereço próprio e, sem o Quartel, diz como erguê-lo', async ({
    context,
    request,
    world,
  }) => {
    const page = await world.open(context);
    await playNow(page);
    const tabs = await page.getByRole('tab').allTextContents();
    expect(tabs.findIndex((name) => name.includes('Exército'))).toBe(
      tabs.findIndex((name) => name.includes('Mercado')) + 1,
    );
    await armyTab(page).click();
    await expect(page).toHaveURL(/#\/exercito$/);
    const view = await serverView(page, request);
    await expect(barracks(page)).toContainText(view.army.text);
    await expect(trainForm(page)).toHaveCount(0);
    // As unidades aparecem com o custo da visão, mesmo antes do Quartel.
    for (const unit of view.army.units) {
      await expect(barracks(page).getByTestId(`army-unit-${unit.id}`)).toContainText(unit.costText);
    }
  });

  test('treinar pelo teclado: Enter revisa com o custo da visão, Enter confirma; o lote aparece com o fim e o que o cancelamento devolve', async ({
    context,
    request,
    world,
  }) => {
    const page = await world.open(context);
    await openBarracks(world, page);
    const posts = commandPosts(page);
    const view = await serverView(page, request);
    const spearman = view.army.units.find((unit) => unit.id === 'spearman');

    await barracks(page).getByTestId('train-amount').focus();
    await page.keyboard.type('2');
    await expect(trainForm(page).getByTestId('train-total')).toContainText('Treinar Lanceiro × 2');
    await expect(trainForm(page).getByTestId('train-total')).toContainText(
      spearman?.costText ?? '?',
    );
    await page.keyboard.press('Enter');
    await expect(trainForm(page).getByTestId('train-confirm')).toBeVisible();
    // Nada foi enviado ainda, e o foco foi para "Confirmar".
    expect(posts).toEqual([]);
    await expect(trainForm(page).getByTestId('train-confirm-button')).toBeFocused();
    await page.keyboard.press('Enter');
    await expect.poll(() => posts.length).toBe(1);
    expect(posts[0]).toMatchObject({
      type: 'trainSoldiers',
      payload: { unit: 'spearman', amount: 2 },
    });

    await expect(running(page)).toBeVisible();
    await expect(running(page)).toContainText('Treinando 2');
    await expect(running(page).getByTestId('army-ends')).toContainText('termina em');
    const after = await serverView(page, request);
    await expect(running(page)).toContainText(after.army.training?.cancelRefundText ?? '?');
    // Um lote por vez: a forma de treinar saiu da tela.
    await expect(trainForm(page)).toHaveCount(0);

    // No fim do prazo os soldados entram e o pátio fica livre.
    await world.passTime(((after.army.training?.totalSeconds ?? 0) + 60) * 1000, page);
    const done = await serverView(page, request);
    expect(done.army.training).toBeNull();
    expect(done.army.total).toBe(2);
    await expect(barracks(page).getByTestId('army-count-spearman')).toHaveText('2');
    await expect(trainForm(page)).toBeVisible();
  });

  test('cancelar o treino devolve o que a visão disse, e o pátio fica livre', async ({
    context,
    request,
    world,
  }) => {
    const page = await world.open(context);
    await openBarracks(world, page);
    const posts = commandPosts(page);
    await barracks(page).getByTestId('train-amount').fill('3');
    await trainForm(page).getByTestId('train-review').click();
    await trainForm(page).getByTestId('train-confirm-button').click();
    await expect(running(page)).toBeVisible();

    await running(page).getByTestId('army-cancel').focus();
    await page.keyboard.press('Enter');
    await expect.poll(() => posts.filter((post) => post.type === 'cancelTraining').length).toBe(1);
    await expect(running(page)).toHaveCount(0);
    await expect(trainForm(page)).toBeVisible();
    const after = await serverView(page, request);
    expect(after.army.training).toBeNull();
    expect(after.army.total).toBe(0);
  });

  test('dispensar confirma antes de enviar, e os soldados saem do exército', async ({
    context,
    request,
    world,
  }) => {
    const page = await world.open(context);
    await openBarracks(world, page);
    await barracks(page).getByTestId('train-amount').fill('2');
    await trainForm(page).getByTestId('train-review').click();
    await trainForm(page).getByTestId('train-confirm-button').click();
    const started = await serverView(page, request);
    await world.passTime(((started.army.training?.totalSeconds ?? 0) + 60) * 1000, page);
    await expect(barracks(page).getByTestId('army-count-spearman')).toHaveText('2');

    const posts = commandPosts(page);
    await disbandForm(page).getByTestId('disband-amount').fill('1');
    await disbandForm(page).getByTestId('disband-review').click();
    await expect(disbandForm(page).getByTestId('disband-confirm')).toContainText(
      'Dispensar Lanceiro × 1',
    );
    expect(posts).toEqual([]);
    await expect(disbandForm(page).getByTestId('disband-confirm-button')).toBeFocused();
    await page.keyboard.press('Enter');
    await expect.poll(() => posts.length).toBe(1);
    expect(posts[0]).toMatchObject({
      type: 'disbandSoldiers',
      payload: { unit: 'spearman', amount: 1 },
    });
    await expect(barracks(page).getByTestId('army-count-spearman')).toHaveText('1');
    expect((await serverView(page, request)).army.total).toBe(1);
  });

  test('a paleta e a árvore chegam ao mesmo treino, sem o mouse', async ({
    context,
    request,
    world,
  }) => {
    const page = await world.open(context);
    await openBarracks(world, page);
    const posts = commandPosts(page);
    await expect(tree(page).getByRole('treeitem', { name: /^Exército/ })).toContainText('Nv1');

    await palette(page, 'Treinar soldados');
    await expect(page.getByRole('dialog')).toContainText('Treinar soldados');
    // O Lanceiro é o primeiro da lista; Enter o escolhe e a lista de lotes abre.
    await page.keyboard.press('Enter');
    await expect(page.getByRole('dialog')).toContainText('Treinar Lanceiro');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await expect(page.getByRole('dialog')).toContainText('Treinar Lanceiro × 2');
    // A confirmação começa no botão que desiste: Tab leva ao que treina.
    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');
    await expect.poll(() => posts.length).toBe(1);
    expect(posts[0]).toMatchObject({
      type: 'trainSoldiers',
      payload: { unit: 'spearman', amount: 2 },
    });
    expect((await serverView(page, request)).army.training?.amount).toBe(2);
  });
});
