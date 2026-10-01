import {
  expect,
  fief,
  MINUTE,
  palette,
  playNow,
  resourceRow,
  statusBar,
  stock,
  test,
  toasts,
  tree,
} from './helpers';

// Critérios 2, 3 e 4 (GDD §16.1): alocar muda a taxa na hora; recusas com o motivo à vista;
// uma melhoria desconta uma vez, ocupa a fila e conclui no tempo configurado.

test.describe('governar o feudo', () => {
  test('+ na Serraria pelo painel muda a taxa de madeira e reduz os livres em menos de 1 s', async ({
    context,
    world,
  }) => {
    const page = await world.open(context);
    await playNow(page);
    const wood = resourceRow(page, 'Madeira');
    await expect(wood).toContainText('estável');
    await expect(fief(page).getByText('Livres 5')).toBeVisible();

    const clickedAt = Date.now();
    await fief(page).getByRole('button', { name: 'Pôr mais um trabalhador em Serraria' }).click();
    await expect(wood).toContainText('crescendo');
    await expect(fief(page).getByText('Livres 4')).toBeVisible();
    expect(Date.now() - clickedAt).toBeLessThan(1000);
    await expect(fief(page).getByText('Trabalhadores (1/5)')).toBeVisible();
    // A árvore e a barra lateral contam a mesma história que o painel.
    await expect(tree(page).getByRole('treeitem', { name: /Trabalhadores/ })).toContainText(
      '1/5 alocados · 4 livres',
    );
  });

  test('+ e − na árvore dão ordens; clicar na linha só navega', async ({ context, world }) => {
    const commands: string[] = [];
    context.on('request', (request) => {
      if (request.url().endsWith('/commands')) {
        commands.push(String(request.postDataJSON()?.type));
      }
    });
    const page = await world.open(context);
    await playNow(page);
    const farm = tree(page).locator('[data-node="worker:farm"]');

    await farm.hover();
    await farm.getByRole('button', { name: 'Pôr mais um trabalhador em Fazenda Nv1' }).click();
    await expect(farm).toContainText('1 ·');
    await farm.getByRole('button', { name: 'Pôr mais um trabalhador em Fazenda Nv1' }).click();
    await expect(farm).toContainText('2 ·');
    await farm.getByRole('button', { name: 'Tirar um trabalhador de Fazenda Nv1' }).click();
    await expect(farm).toContainText('1 ·');
    expect(commands).toEqual(['setWorkers', 'setWorkers', 'setWorkers']);

    // Clicar em qualquer linha (inclusive em uma melhoria disponível) nunca dá uma ordem.
    await tree(page)
      .getByRole('treeitem', { name: /Construções/ })
      .click();
    await tree(page)
      .getByRole('treeitem', { name: /Habitações Nv1 → Nv2/ })
      .click();
    await tree(page)
      .getByRole('treeitem', { name: /Comida/ })
      .click();
    await farm.click();
    expect(commands).toHaveLength(3);
    await expect(fief(page).getByText('Os pedreiros estão livres.')).toBeVisible();
  });

  test('alocar pela paleta mostra a taxa resultante e barra o que passa da população', async ({
    context,
    world,
  }) => {
    const page = await world.open(context);
    await playNow(page);
    await palette(page, 'alocar');
    const list = page.getByRole('dialog');
    await expect(list.getByRole('option')).toHaveCount(4);
    await list.getByRole('combobox').fill('pedreira');
    await page.keyboard.press('Enter');

    const dialog = page.getByRole('dialog');
    const field = dialog.getByRole('textbox');
    await expect(field).toBeFocused();
    await field.fill('9');
    await expect(dialog.getByText(/Só há 5 disponíveis para Pedreira/)).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Alocar' })).toBeDisabled();
    await field.fill('3');
    await expect(dialog.getByText(/^3 × .* = .*\/h$/)).toBeVisible();
    await page.keyboard.press('Enter');

    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(fief(page).getByText('Trabalhadores (3/5)')).toBeVisible();
    await expect(resourceRow(page, 'Pedra')).toContainText('crescendo');
  });

  test('recusas do servidor aparecem com o motivo em português', async ({ context, world }) => {
    const page = await world.open(context);
    await playNow(page);
    // O Salão está bloqueado por falta de recursos: o botão do painel nem se oferece…
    const townHall = fief(page).getByRole('listitem').filter({ hasText: 'Salão do Senhor' });
    await expect(townHall.getByRole('button', { name: 'Melhorar' })).toBeDisabled();
    await expect(townHall).toContainText('Faltam 30 madeira e 35 pedra.');
    await expect(townHall).toContainText('150 madeira (faltam 30)');

    // …e pela paleta a ordem segue, e é o servidor que recusa, com o motivo atual.
    await palette(page, 'construir');
    const list = page.getByRole('dialog');
    await expect(list.getByRole('option').filter({ hasText: 'Salão do Senhor' })).toContainText(
      'Faltam 30 madeira e 35 pedra.',
    );
    await list.getByRole('combobox').fill('salão');
    await page.keyboard.press('Enter');
    await expect(toasts(page).getByRole('status')).toContainText('Faltam 30 madeira e 35 pedra.');
    await expect(fief(page).getByText('Os pedreiros estão livres.')).toBeVisible();
    expect(await stock(page, 'Madeira')).toBe(120);
  });

  test('uma melhoria desconta uma vez, ocupa a fila e termina sozinha no tempo certo', async ({
    context,
    world,
  }) => {
    const page = await world.open(context);
    await playNow(page);
    const housing = fief(page).getByRole('listitem').filter({ hasText: 'Habitações Nv1 → Nv2' });
    await housing.getByRole('button', { name: 'Melhorar' }).click();

    const active = fief(page).locator('.active-construction');
    await expect(active).toContainText('Habitações → Nv2');
    await expect(active).toContainText(/0[34]:\d\d/);
    expect(await stock(page, 'Madeira')).toBe(120 - 80 + 30); // custo, mais o prêmio do objetivo
    expect(await stock(page, 'Pedra')).toBe(65 - 20);
    await expect(statusBar(page)).toContainText('Habitações Nv2 ·');
    await expect(tree(page).getByRole('treeitem', { name: /Construções/ })).toContainText(
      'Habitações',
    );

    // A fila está ocupada: outra obra é recusada, com o motivo.
    await palette(page, 'construir');
    await page.getByRole('dialog').getByRole('combobox').fill('fazenda');
    await page.keyboard.press('Enter');
    await expect(toasts(page).getByRole('status').last()).toContainText(/obra|pedreiros|fila/i);
    expect(await stock(page, 'Madeira')).toBe(70);

    // Meio caminho andado: a contagem regressiva local acompanha, sem falar com o servidor.
    await world.passTime(2 * MINUTE, page);
    await expect(active).toContainText('Habitações → Nv2');

    // Passado o prazo, a obra conclui sem o jogador agir.
    await world.passTime(2 * MINUTE + 30_000, page);
    await expect(fief(page).getByText('Os pedreiros estão livres.')).toBeVisible();
    await expect(fief(page).getByText('Habitações Nv2 → Nv3')).toBeVisible();
    await expect(fief(page).getByText(/Habitação 5\/15/)).toBeVisible();
    await expect(statusBar(page)).not.toContainText('Habitações Nv2 ·');
    expect(await stock(page, 'Madeira')).toBe(70);
    expect(await stock(page, 'Pedra')).toBe(45);
  });

  test('cancelar pela paleta pede confirmação e devolve o que o servidor informa', async ({
    context,
    world,
  }) => {
    const page = await world.open(context);
    await playNow(page);
    await palette(page, 'cancelar a obra');
    await expect(toasts(page)).toContainText('Não há obra em andamento.');

    await fief(page)
      .getByRole('listitem')
      .filter({ hasText: 'Fazenda Nv1 → Nv2' })
      .getByRole('button', { name: 'Melhorar' })
      .click();
    await expect(fief(page).locator('.active-construction')).toContainText('Fazenda → Nv2');
    expect(await stock(page, 'Madeira')).toBe(40);

    await palette(page, 'cancelar a obra');
    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText('Cancelar a obra de Fazenda?');
    await expect(dialog).toContainText('Voltam 64 madeira, 32 ouro.');
    // O foco começa no botão que não destrói nada.
    await expect(dialog.getByRole('button', { name: 'Manter a obra' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(fief(page).locator('.active-construction')).toBeVisible();

    await palette(page, 'cancelar a obra');
    await page.getByRole('dialog').getByRole('button', { name: 'Cancelar a obra' }).click();
    await expect(fief(page).getByText('Os pedreiros estão livres.')).toBeVisible();
    expect(await stock(page, 'Madeira')).toBe(40 + 64);
  });

  test('recrutar pelo painel e pela paleta respeita vagas e custo', async ({ context, world }) => {
    const page = await world.open(context);
    await playNow(page);
    await fief(page).getByRole('button', { name: 'Recrutar 1 aldeão' }).click();
    await expect(fief(page).getByText('A caminho 1')).toBeVisible();
    expect(await stock(page, 'Comida')).toBe(130);
    // O painel diz quanto falta para o aldeão chegar (20 min no ritmo dos testes).
    await expect(fief(page).getByText(/Chega em (20:00|19:5\d)/)).toBeVisible();

    await palette(page, 'recrutar');
    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText('Vagas: 4 de 10.');
    await dialog.getByRole('textbox').fill('0');
    await expect(dialog.getByText('Digite quantos aldeões recrutar.')).toBeVisible();
    await dialog.getByRole('textbox').fill('2');
    await page.keyboard.press('Enter');
    await expect(fief(page).getByText('A caminho 3')).toBeVisible();

    // Os aldeões chegam com o tempo, um a cada 20 minutos.
    await world.passTime(61 * MINUTE, page);
    await expect(fief(page).getByText('Aldeões 8')).toBeVisible();
    await expect(fief(page).getByText('Livres 8')).toBeVisible();
  });

  test('planejar não gasta nada; renomear o feudo muda o título, a árvore e a barra', async ({
    context,
    world,
  }) => {
    const page = await world.open(context);
    await playNow(page);
    await fief(page)
      .getByRole('listitem')
      .filter({ hasText: 'Serraria Nv1 → Nv2' })
      .getByRole('button', { name: 'Planejar' })
      .click();
    await expect(fief(page).getByRole('heading', { name: 'Planejadas' })).toBeVisible();
    expect(await stock(page, 'Madeira')).toBe(120);
    await fief(page).getByRole('button', { name: 'Tirar da lista' }).click();
    await expect(fief(page).getByRole('heading', { name: 'Planejadas' })).toHaveCount(0);

    await palette(page, 'renomear');
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('textbox').fill('X');
    await expect(dialog.getByRole('button', { name: 'Renomear' })).toBeDisabled();
    await dialog.getByRole('textbox').fill('Vale Sereno');
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { name: 'Vale Sereno', level: 1 })).toBeVisible();
    await expect(page).toHaveTitle('Vale Sereno · Lords of the Guild');
    await expect(statusBar(page)).toContainText('Vale Sereno');
    await expect(tree(page).getByRole('treeitem', { name: /Feudo: Vale Sereno/ })).toBeVisible();
  });

  test('a Crônica abre em uma aba, como texto, e pode ser baixada em Markdown', async ({
    context,
    world,
  }) => {
    const page = await world.open(context);
    await playNow(page);
    await fief(page).getByRole('button', { name: 'Pôr mais um trabalhador em Fazenda' }).click();
    await fief(page).getByRole('button', { name: 'Pôr mais um trabalhador em Fazenda' }).click();
    await expect(fief(page).getByText('☑')).toBeVisible();

    await fief(page).getByRole('button', { name: 'Abrir a Crônica' }).click();
    await expect(page).toHaveURL(/#\/cronica$/);
    const chronicle = page.getByRole('tabpanel', { name: 'Crônica' });
    await expect(chronicle.getByRole('heading', { level: 1 })).toHaveText('Crônica de Pedra Alta');
    await expect(chronicle.getByRole('heading', { name: 'Ano 1' })).toBeVisible();
    await expect(chronicle.getByRole('listitem').first()).toBeVisible();

    const download = page.waitForEvent('download');
    await chronicle.getByRole('button', { name: 'Baixar Crônica (Markdown)' }).click();
    const file = await download;
    expect(file.suggestedFilename()).toBe('cronica-pedra-alta.md');

    // A aba Crônica fecha; Hoje e Feudo, não.
    await page.getByRole('button', { name: 'Fechar a aba Crônica' }).click();
    await expect(page.getByRole('tab', { name: 'Crônica' })).toHaveCount(0);
    await expect(page.getByRole('tab', { name: 'Feudo' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('button', { name: /Fechar a aba Feudo/ })).toHaveCount(0);
  });

  test('"Nova partida" pede confirmação, arquiva o feudo e começa outro', async ({
    context,
    world,
  }) => {
    const page = await world.open(context);
    await playNow(page);
    await fief(page).getByRole('button', { name: 'Pôr mais um trabalhador em Fazenda' }).click();
    await expect(fief(page).getByText('Livres 4')).toBeVisible();

    await palette(page, 'nova partida');
    const confirm = page.getByRole('dialog');
    await expect(confirm).toContainText('O feudo atual é arquivado');
    await page.keyboard.press('Escape');
    await expect(fief(page).getByText('Livres 4')).toBeVisible();

    await palette(page, 'nova partida');
    await page.getByRole('dialog').getByRole('button', { name: 'Começar outro feudo' }).click();
    await page.getByRole('dialog').getByRole('textbox').fill('Monte Claro');
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { name: 'Monte Claro', level: 1 })).toBeVisible();
    await expect(fief(page).getByText('Livres 5')).toBeVisible();
  });
});
