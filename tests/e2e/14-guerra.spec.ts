import type { Page } from '@playwright/test';

import {
  expect,
  fief,
  HOUR,
  MINUTE,
  playNow,
  serverView,
  statusBar,
  test,
  type World,
} from './helpers';

// V4E-T4.4 (GDD §6.3, §8.2 e §10.6): a muralha danificada e o reparo em duas etapas no painel da
// Ameaça, e o presságio da Horda na aba Exército. A muralha danificada e o presságio são postos
// pelas rotas de teste (`/__test/wall`, `/__test/omen`); daí em diante a vida, o custo, o prazo e
// o texto são os do motor, e a tela é conferida contra o que o servidor mandou na visão.

const wallPanel = (page: Page) => fief(page).getByTestId('wall-panel');

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

/** Funda o feudo, põe a Paliçada de pé com a muralha pela metade e o estoque que o reparo pede. */
async function damagedWall(world: World, page: Page) {
  await playNow(page);
  await world.raise('palisade', 1);
  await world.stock('stone', 900);
  await world.stock('gold', 900);
  await world.control('wall', { percent: 40 });
  await world.passTime(MINUTE, page);
  await expect(wallPanel(page)).toBeVisible();
}

test.describe('a muralha (V4E-T4)', () => {
  test('mostra a vida de cada ala e o reparo só é enviado depois da conferência', async ({
    context,
    request,
    world,
  }) => {
    const page = await world.open(context);
    const posts = commandPosts(page);
    await damagedWall(world, page);
    const wall = (await serverView(page, request)).threat.defense.wall;
    for (const text of Object.values(wall.hpText)) {
      await expect(wallPanel(page)).toContainText(text);
    }
    await expect(wallPanel(page)).toContainText(wall.repairOffer.text);

    // Primeira etapa: a conferência mostra o custo e o prazo, e nada vai ao servidor.
    await page.getByTestId('wall-review-open').click();
    await expect(page.getByTestId('wall-review')).toContainText(wall.repairOffer.text);
    expect(posts).toEqual([]);
    // "Voltar" fecha a conferência sem ordem e devolve o foco ao botão de abrir.
    await page.getByTestId('wall-back').click();
    await expect(page.getByTestId('wall-review')).toHaveCount(0);
    await expect(page.getByTestId('wall-review-open')).toBeFocused();
    expect(posts).toEqual([]);

    // Se o custo muda durante a conferência, aparece wall-changed e a ordem exige nova revisão.
    await page.getByTestId('wall-review-open').click();
    await expect(page.getByTestId('wall-review')).toBeVisible();
    await world.control('wall', { percent: 20 });
    await world.passTime(MINUTE, page);
    await expect(page.getByTestId('wall-review')).toHaveCount(0);
    await expect(page.getByTestId('wall-changed')).toBeVisible();
    expect(posts).toEqual([]);

    // Segunda etapa, pelo teclado: o foco vai ao "Confirmar o reparo" e o Enter manda a ordem.
    await page.getByTestId('wall-review-open').click();
    await expect(page.getByTestId('wall-confirm')).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('wall-repairing')).toBeVisible();
    expect(posts.map((post) => post.type)).toEqual(['repairWall']);
    const after = (await serverView(page, request)).threat.defense.wall.repairOffer;
    expect(after.repairingInSeconds).not.toBeNull();
    // Com o reparo em curso não há botão para repetir a ordem.
    await expect(page.getByTestId('wall-review-open')).toHaveCount(0);
  });

  test('o reparo termina e a muralha volta inteira', async ({ context, request, world }) => {
    const page = await world.open(context);
    await damagedWall(world, page);
    await page.getByTestId('wall-review-open').click();
    await page.getByTestId('wall-confirm').click();
    await expect(page.getByTestId('wall-repairing')).toBeVisible();
    const seconds = (await serverView(page, request)).threat.defense.wall.repairOffer
      .repairingInSeconds;
    await world.passTime((seconds ?? 0) * 1000 + MINUTE, page);
    await expect(page.getByTestId('wall-repairing')).toHaveCount(0);
    const wall = (await serverView(page, request)).threat.defense.wall;
    expect(wall.repairOffer.repairingInSeconds).toBeNull();
    await expect(wallPanel(page)).toContainText(wall.hpText.center);
  });
});

test.describe('os presságios (V4E-T4)', () => {
  test('a aba Exército lista o que os vigias leram, na frase do servidor', async ({
    context,
    request,
    world,
  }) => {
    const page = await world.open(context);
    await playNow(page);
    await world.raise('barracks', 1);
    await world.control('omen');
    await world.passTime(MINUTE, page);
    await page.getByRole('tab', { name: 'Exército' }).click();
    const view = await serverView(page, request);
    expect(view.army.omens.length).toBeGreaterThan(0);
    const omens = page.getByTestId('omens');
    await expect(omens).toBeVisible();
    for (const omen of view.army.omens) {
      await expect(omens).toContainText(omen.text);
    }
  });

  test('a incursão com world.wolvesRoam() e Defesa ativa mostra a barra de status e deixa relatório de batalha', async ({
    context,
    request,
    world,
  }) => {
    world.wolvesRoam();
    const page = await world.open(context);
    await playNow(page);
    await world.raise('watchtower', 1);
    await world.raise('barracks', 4);
    await world.soldiers({ spearman: 10, archer: 6 });
    await world.passTime(MINUTE, page);

    await page.getByRole('tab', { name: 'Exército' }).click();
    await page.getByTestId('formation-name').fill('Guarda do Feudo');
    await page.getByTestId('post-center-front').focus();
    await page.keyboard.press('Enter');
    await page.getByTestId('post-unit').selectOption('spearman');
    await page.getByTestId('post-amount').fill('6');
    await page.keyboard.press('Enter');
    await page.getByTestId('formation-save').click();
    await expect(page.getByTestId('formation-activate')).toBeVisible();
    await page.getByTestId('formation-activate').click();
    await expect(page.getByTestId('formation-active')).toBeVisible();

    // Na hora 29 os vigias anunciam os lobos: a barra de status mostra a incursão a caminho.
    await world.passTime(29 * HOUR, page);
    await expect(statusBar(page)).toContainText(/Lobos em \d+ min/);

    // Na hora 30 a incursão luta contra a Defesa ativa e gera o relatório de batalha.
    await world.passTime(HOUR + MINUTE, page);
    await expect(statusBar(page)).not.toContainText('Lobos');
    const after = await serverView(page, request);
    expect(after.army.reports.length).toBeGreaterThan(0);
    const report = page.getByTestId('battle-report').first();
    await expect(report).toBeVisible();
    await expect(report).toContainText(after.army.reports[0]?.outcomeLabel ?? '?');
  });
});
