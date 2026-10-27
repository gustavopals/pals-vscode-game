import type { Page } from '@playwright/test';

import { expect, fief, MINUTE, playNow, serverView, test, type World } from './helpers';

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
    // "Voltar" fecha a conferência sem ordem.
    await page.getByTestId('wall-back').click();
    await expect(page.getByTestId('wall-review')).toHaveCount(0);
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
});
