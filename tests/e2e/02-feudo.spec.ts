import type { Locator, Page } from '@playwright/test';

import {
  expect,
  fief,
  HOUR,
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
    // O painel diz quanto falta para o aldeão chegar: 16 min, o prazo da primavera no ritmo dos
    // testes, e diz por que o prazo é esse.
    await expect(fief(page).getByText(/Chega em (16:00|15:5\d)/)).toBeVisible();
    await expect(
      fief(page).getByText(
        /leva 16 min\. Na Primavera, o prazo de um recrutamento ordenado agora é × 0,8\./,
      ),
    ).toBeVisible();

    await palette(page, 'recrutar');
    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText('Vagas: 4 de 10.');
    await dialog.getByRole('textbox').fill('0');
    await expect(dialog.getByText('Digite quantos aldeões recrutar.')).toBeVisible();
    await dialog.getByRole('textbox').fill('2');
    await page.keyboard.press('Enter');
    await expect(fief(page).getByText('A caminho 3')).toBeVisible();

    // Os aldeões chegam com o tempo, um a cada 16 minutos.
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

  test('"Nova partida" pergunta dificuldade e ritmo, pede confirmação, arquiva o feudo e começa outro', async ({
    context,
    world,
  }) => {
    const page = await world.open(context);
    await playNow(page);
    await fief(page).getByRole('button', { name: 'Pôr mais um trabalhador em Fazenda' }).click();
    await expect(fief(page).getByText('Livres 4')).toBeVisible();
    const housing = fief(page).getByRole('listitem').filter({ hasText: 'Habitações Nv1 → Nv2' });
    await expect(housing).toContainText('4 min');

    // Enter, Enter: as duas listas já trazem o padrão marcado.
    await palette(page, 'nova partida');
    const difficulty = page.getByRole('dialog', { name: 'Nova partida: dificuldade' });
    await expect(difficulty.getByRole('option')).toHaveCount(3);
    await expect(difficulty.getByRole('option', { selected: true })).toContainText(
      'Senhor (recomendado)',
    );
    await expect(difficulty.getByRole('option', { selected: true })).toContainText(
      'O feudo como foi pensado',
    );
    await page.keyboard.press('Enter');
    const pace = page.getByRole('dialog', { name: 'Nova partida: ritmo' });
    await expect(pace.getByRole('option')).toHaveCount(3);
    // O marcado é o padrão deste servidor (Normal), não o recomendado.
    await expect(pace.getByRole('option', { selected: true })).toContainText(
      'Normal: um ano em 7 dias',
    );
    await page.keyboard.press('Enter');
    const confirm = page.getByRole('dialog', { name: 'Começar uma nova partida?' });
    await expect(confirm).toContainText('O feudo atual é arquivado');
    await expect(confirm).toContainText('Senhor · Normal: um ano em 7 dias');
    await page.keyboard.press('Escape');
    await expect(fief(page).getByText('Livres 4')).toBeVisible();

    // Desistir em uma das listas também não muda nada.
    await palette(page, 'nova partida');
    await expect(difficulty).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(fief(page).getByText('Livres 4')).toBeVisible();

    // Outra dificuldade e outro ritmo, só com o teclado.
    await palette(page, 'nova partida');
    await difficulty.getByRole('combobox').fill('ferro');
    await page.keyboard.press('Enter');
    await expect(pace.getByRole('option', { selected: true })).toContainText('Normal');
    await page.keyboard.press('ArrowDown');
    await expect(pace.getByRole('option', { selected: true })).toContainText(
      'Tranquilo: um ano em 14 dias',
    );
    await page.keyboard.press('Enter');
    await expect(confirm).toContainText('Rei de Ferro · Tranquilo: um ano em 14 dias');
    await confirm.getByRole('button', { name: 'Começar outro feudo' }).click();
    await page.getByRole('dialog').getByRole('textbox').fill('Monte Claro');
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { name: 'Monte Claro', level: 1 })).toBeVisible();
    await expect(fief(page).getByText('Livres 5')).toBeVisible();
    // O feudo novo anda no ritmo escolhido: a mesma obra leva o dobro do tempo real.
    await expect(housing).toContainText('8 min');

    await page.getByRole('button', { name: 'Preferências' }).click();
    await expect(page.getByRole('tabpanel', { name: 'Preferências' })).toContainText(
      'Dificuldade: Rei de Ferro · Ritmo: Tranquilo: um ano em 14 dias (não mudam durante o ano)',
    );
  });
});

// V2C-T1 (GDD §4.1): as estações mudam a produção e os prazos, o inverno queima lenha, e sem
// madeira vem o frio. A tela explica cada taxa com o fator da estação, faz a conta da lenha
// antes de o inverno chegar e avisa do frio com ícone e texto próprios.

/**
 * A explicação de um número como o navegador a desenha quando ele recebe o foco: o texto e a
 * caixa. É um pseudo-elemento, por isso se lê pelo estilo calculado.
 */
async function explanation(target: Locator) {
  await target.focus();
  return target.evaluate((element) => {
    const box = getComputedStyle(element, '::after');
    const height = parseFloat(box.height);
    const width = parseFloat(box.width);
    const bottom = parseFloat(box.bottom);
    // Um ponto perto da ponta direita da faixa, onde os avisos do canto também ficam.
    const x = parseFloat(box.left) + width - 60;
    const y = window.innerHeight - bottom - height / 2;
    return {
      text: box.content.replace(/^"|"$/g, '').replace(/\\"/g, '"'),
      // Fixa no rodapé e com quebra de linha: nenhuma borda corta o texto.
      position: box.position,
      wraps: box.whiteSpace === 'normal',
      // Quanto sobra entre o topo da caixa e o topo da janela; negativo é texto cortado.
      roomAbove: window.innerHeight - bottom - height,
      width,
      // Nada na frente dela: quem está nesse ponto é a própria explicação.
      onTop: document.elementFromPoint(x, y) === element,
    };
  });
}

const overflow = (page: Page) =>
  page.evaluate(() => {
    const content = document.querySelector('.editor-content');
    return {
      page: document.documentElement.scrollWidth - window.innerWidth,
      content: content === null ? 0 : content.scrollWidth - content.clientWidth,
    };
  });

test.describe('estações, lenha e frio', () => {
  test('o ano passa: o fator da estação nas explicações, a conta da lenha no outono e, sem madeira no inverno, o frio', async ({
    context,
    world,
  }) => {
    const page = await world.open(context);
    await playNow(page);
    // Todos na Fazenda: a comida não falta até o inverno, e ninguém corta lenha.
    const plus = fief(page).getByRole('button', { name: 'Pôr mais um trabalhador em Fazenda' });
    for (const free of [4, 3, 2, 1, 0]) {
      await plus.click();
      await expect(fief(page).getByText(`Livres ${free}`)).toBeVisible();
    }
    const foodRate = resourceRow(page, 'Comida').locator('.explained');
    const woodRate = resourceRow(page, 'Madeira').locator('.explained');

    // Primavera: o cabeçalho diz o que a estação muda e a explicação da taxa traz o fator.
    await expect(
      fief(page).getByText('Primavera: comida × 1,2; recrutamento com prazo × 0,8.'),
    ).toBeVisible();
    await expect(resourceRow(page, 'Comida')).toContainText('+55');
    expect((await explanation(foodRate)).text).toBe(
      'Fazenda: 5 trabalhadores × 10 × 1 (Nv1) × 1,2 (primavera) = 60/h; consumo 5 × 1 = 5/h',
    );

    // A melhoria da Fazenda leva 80 das 120 de madeira: sobram 40, que não dão para o inverno.
    await fief(page)
      .getByRole('listitem')
      .filter({ hasText: 'Fazenda Nv1 → Nv2' })
      .getByRole('button', { name: 'Melhorar' })
      .click();
    await expect(fief(page).locator('.active-construction')).toContainText('Fazenda → Nv2');
    expect(await stock(page, 'Madeira')).toBe(40);

    // Duas estações depois (96 h no ritmo dos testes), o outono.
    await world.passTime(97 * HOUR, page);
    await expect(fief(page).getByText(/Outono, dia 1 do Ano 1/)).toBeVisible();
    await expect(fief(page).getByText('Outono: comida × 1,3; ouro × 1,1.')).toBeVisible();
    const autumn = await explanation(foodRate);
    expect(autumn.text).toBe(
      'Fazenda: 5 trabalhadores × 10 × 1,2 (Nv2) × 1,3 (outono) = 78/h; consumo 5 × 1 = 5/h',
    );
    expect(autumn).toMatchObject({ position: 'fixed', wraps: true });
    expect(autumn.roomAbove).toBeGreaterThan(0);
    // No painel de trabalhadores, a produção bruta do edifício, com o mesmo fator.
    const farmRate = fief(page)
      .getByRole('listitem')
      .filter({ hasText: 'Fazenda Nv2' })
      .locator('.explained');
    expect((await explanation(farmRate)).text).toBe(
      '5 trabalhadores × 10 × 1,2 (Nv2) × 1,3 (outono) = 78/h',
    );
    // A árvore conta a mesma história.
    await expect(tree(page).getByRole('treeitem', { name: /Feudo: Pedra Alta/ })).toContainText(
      'Outono, dia 1',
    );
    await expect(tree(page).locator('[data-node="fief"]')).toHaveAttribute(
      'title',
      'Outono: comida × 1,3; ouro × 1,1.',
    );
    // Antes de o inverno chegar, a conta da lenha: quanto ele queima, o que há e o que falta.
    const firewood = fief(page).getByRole('note');
    await expect(firewood).toContainText(/Inverno em (46|47) h\./);
    await expect(firewood).toContainText(
      'O Inverno vai queimar 60 de madeira com 5 habitantes. A Serraria repõe 0 e há 40 em estoque: faltam 20 de madeira.',
    );
    await expect(statusBar(page)).not.toContainText('Frio');

    // O inverno: a lareira queima lenha, as obras demoram mais, e a madeira tem prazo para acabar.
    await world.passTime(48 * HOUR, page);
    await expect(fief(page).getByText(/Inverno, dia 1 do Ano 1/)).toBeVisible();
    await expect(
      fief(page).getByText(/^Inverno: comida × 0,4; madeira e pedra × 0,8;/),
    ).toBeVisible();
    const hearth = fief(page).locator('.hearth');
    await expect(hearth).toContainText('Lareira: 2,5 de madeira por hora');
    await expect(hearth).toContainText(/madeira acaba em 1[45] h/);
    await expect(resourceRow(page, 'Madeira')).toContainText('−2,5');
    await expect(resourceRow(page, 'Madeira')).toContainText(/acaba em 1[45] h/);
    expect((await explanation(woodRate)).text).toBe(
      'Serraria: 0 trabalhadores × 8 × 1 (Nv1) × 0,8 (inverno) = 0/h; −2,5/h (lenha de 5 habitantes)',
    );
    await expect(firewood).toContainText('Lareira acesa.');
    await expect(firewood).toContainText(/faltam \d+ de madeira\./);
    await expect(
      fief(page).getByText('No Inverno, o prazo de uma obra iniciada agora é × 1,5.'),
    ).toHaveCount(1);
    const lit = tree(page).locator('[data-node="hearth"]');
    await expect(lit).toContainText('Lareira');
    await expect(lit).toContainText(/2,5\/h de madeira · acaba em 1[45] h/);
    await expect(statusBar(page)).not.toContainText('Frio');
    await expect(toasts(page).getByRole('status').filter({ hasText: /frio/i })).toHaveCount(0);

    // Dezesseis horas depois a última acha queimou: o frio.
    await world.passTime(16 * HOUR, page);
    await expect(statusBar(page)).toContainText('Frio em Pedra Alta');
    await expect(statusBar(page)).not.toContainText('Fome');
    await expect(statusBar(page).locator('.codicon-flame')).toBeVisible();
    const cold = fief(page).getByRole('status').filter({ hasText: 'Frio em andamento.' });
    await expect(cold).toContainText('sem lenha, a produção de todo o feudo cai para 80%');
    await expect(cold).toContainText('A lareira pede 2,5/h e a Serraria entrega 0/h');
    await expect(cold).toContainText(/Faltam \d+ de madeira para atravessar o resto do Inverno\./);
    await expect(fief(page).getByText('Fome em andamento.')).toHaveCount(0);
    await expect(hearth).toContainText(/sem lenha, frio há \d+ (min|h)/);
    await expect(resourceRow(page, 'Madeira')).toContainText('em falta');
    await expect(tree(page).getByRole('treeitem', { name: /Feudo: Pedra Alta/ })).toContainText(
      '· frio',
    );
    await expect(lit).toContainText(/sem lenha · frio há/);
    // O aviso é a frase da Crônica, com o ícone do frio, e chega no nível padrão de avisos.
    const alarm = toasts(page).getByRole('status').filter({ hasText: 'O frio entrou nas casas.' });
    await expect(alarm).toContainText('queimou-se a última acha de lenha em Pedra Alta');
    await expect(alarm.locator('.codicon-flame')).toBeVisible();
    // A explicação de cada taxa diz o que o frio custa, termo a termo.
    const chilled = await explanation(woodRate);
    expect(chilled.text).toBe(
      'Serraria: 0 trabalhadores × 8 × 1 (Nv1) × 0,8 (inverno) × 0,8 (frio) = 0/h; −2,5/h (lenha de 5 habitantes)',
    );
    expect(chilled.roomAbove).toBeGreaterThan(0);

    // Em 720 px nada transborda, e a explicação mais longa da tela cabe inteira na janela.
    await page.setViewportSize({ width: 720, height: 800 });
    // A bancada se redesenha para a tela estreita, com a barra lateral recolhida.
    await expect(page.locator('#sidebar')).toBeHidden();
    expect(await overflow(page)).toEqual({ page: 0, content: 0 });
    const narrow = await explanation(woodRate);
    // O aviso de frio não some sozinho e fica no mesmo canto: a explicação passa por cima dele.
    await expect(alarm).toBeVisible();
    expect(narrow).toMatchObject({ position: 'fixed', wraps: true, onTop: true });
    expect(narrow.width).toBeLessThanOrEqual(720 - 32);
    expect(narrow.roomAbove).toBeGreaterThan(0);
    await page.setViewportSize({ width: 1280, height: 720 });
    await expect(page.locator('#sidebar')).toBeVisible();

    // A saída está na tela: um aldeão na Serraria e as lareiras voltam a arder, na hora.
    await fief(page).getByRole('button', { name: 'Tirar um trabalhador de Fazenda' }).click();
    await fief(page).getByRole('button', { name: 'Pôr mais um trabalhador em Serraria' }).click();
    await expect(statusBar(page)).not.toContainText('Frio');
    await expect(fief(page).getByText('Frio em andamento.')).toHaveCount(0);
    const relief = toasts(page)
      .getByRole('status')
      .filter({ hasText: 'as lareiras voltaram a arder em Pedra Alta. O frio passou.' });
    await expect(relief).toBeVisible();
    await expect(tree(page).getByRole('treeitem', { name: /Feudo: Pedra Alta/ })).not.toContainText(
      'frio',
    );
    await expect(hearth).toContainText('Lareira: 2,5 de madeira por hora');
    await expect(resourceRow(page, 'Madeira')).toContainText('crescendo');
  });
});
