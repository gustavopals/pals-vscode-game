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
    // A pedra passa a subir 15 por hora: a tendência já diz em quanto tempo o Pátio enche.
    await expect(resourceRow(page, 'Pedra')).toContainText('+15');
    await expect(resourceRow(page, 'Pedra')).toContainText('cheio em 29 h');
  });

  test('recusas do servidor aparecem com o motivo em português', async ({ context, world }) => {
    const page = await world.open(context);
    await playNow(page);
    // O Salão está bloqueado por falta de recursos: o botão do painel nem se oferece…
    const townHall = fief(page)
      .getByRole('listitem')
      .filter({ hasText: 'Salão do Senhor Nv1 → Nv2' });
    await expect(townHall.getByRole('button', { name: 'Melhorar' })).toBeDisabled();
    await expect(townHall).toContainText('Faltam 30 madeira e 35 pedra.');
    await expect(townHall).toContainText('150 madeira (faltam 30)');

    // …e pela paleta a ordem segue, e é o servidor que recusa, com o motivo atual.
    await palette(page, 'construir');
    const list = page.getByRole('dialog');
    await expect(
      list.getByRole('option').filter({ hasText: 'Salão do Senhor Nv1 → Nv2' }),
    ).toContainText('Faltam 30 madeira e 35 pedra.');
    // O Celeiro entra na lista como obra nova, com o que muda e o que o libera.
    await expect(list.getByRole('option').filter({ hasText: 'Construir: Celeiro' })).toContainText(
      'Capacidade de comida: 500 → 900. Melhore antes o Salão do Senhor para o nível 2.',
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
    // A taxa é a terceira célula da linha; o limite, na segunda, tem a sua própria explicação.
    const foodRate = resourceRow(page, 'Comida').getByRole('cell').nth(2).locator('.explained');
    const woodRate = resourceRow(page, 'Madeira').getByRole('cell').nth(2).locator('.explained');

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

// V2C-T2 (GDD §5.5, critério 1 da §16.2): o estoque para no limite, o painel diz "cheio em" com
// a saída ao lado, e o que não coube é desperdício contado, que o Relatório de Retorno soma.

test.describe('armazenamento', () => {
  test('a Despensa enche: "cheio em" aparece com o alerta e a obra ao lado, e some ao construir o Celeiro; cheio, diz o que se perde e o relatório soma', async ({
    context,
    world,
  }) => {
    test.setTimeout(60_000);
    const page = await world.open(context);
    await playNow(page);
    const step = async (label: string, free: number) => {
      await fief(page).getByRole('button', { name: label }).click();
      await expect(fief(page).getByText(`Livres ${free}`)).toBeVisible();
    };
    const food = resourceRow(page, 'Comida');
    const notes = fief(page).locator('.storage-notes').getByRole('listitem');
    const construct = fief(page)
      .getByRole('listitem')
      .filter({ has: page.getByRole('button', { name: 'Construir Celeiro' }) });

    // O Celeiro já está na lista, em "Construir", esperando o Salão: o motivo vem escrito.
    await expect(fief(page).getByRole('heading', { name: 'Construir', level: 3 })).toBeVisible();
    await expect(construct).toContainText('Capacidade de comida: 500 → 900.');
    await expect(construct).toContainText('Melhore antes o Salão do Senhor para o nível 2.');
    await expect(construct.getByRole('button', { name: 'Construir Celeiro' })).toBeDisabled();
    // O limite de cada recurso tem explicação; o ouro não tem limite.
    await expect(food.getByRole('cell').nth(1)).toHaveText(/^500/);
    expect((await explanation(food.locator('.explained').first())).text).toBe(
      'Despensa: 500 iniciais',
    );
    await expect(resourceRow(page, 'Ouro').getByRole('cell').nth(1)).toHaveText('—');

    // Doze horas de Serraria e de Pedreira pagam o Salão e ainda deixam o Celeiro pago.
    for (const free of [4, 3]) {
      await step('Pôr mais um trabalhador em Serraria', free);
    }
    for (const free of [2, 1, 0]) {
      await step('Pôr mais um trabalhador em Pedreira', free);
    }
    // Longe de encher, a previsão aparece sem alarme e sem aviso.
    await expect(resourceRow(page, 'Madeira')).toContainText('cheio em 23 h');
    await expect(resourceRow(page, 'Madeira').locator('.codicon-warning')).toHaveCount(0);
    await expect(notes).toHaveCount(0);
    await world.passTime(12 * HOUR, page);
    await fief(page)
      .getByRole('listitem')
      .filter({ hasText: 'Salão do Senhor Nv1 → Nv2' })
      .getByRole('button', { name: 'Melhorar' })
      .click();
    await expect(fief(page).locator('.active-construction')).toContainText('Salão do Senhor → Nv2');
    await world.passTime(11 * MINUTE, page);
    await expect(fief(page).getByText(/Salão Nv2 ·/)).toBeVisible();
    await expect(construct.getByRole('button', { name: 'Construir Celeiro' })).toBeEnabled();
    await expect(construct).not.toContainText('Melhore antes');

    // Todos para a Fazenda: a comida passa a subir 55 por hora, e a Despensa enche em menos de
    // uma ausência. O alerta é ícone e texto, na tabela e na árvore, com a saída ao lado.
    for (const free of [1, 2]) {
      await step('Tirar um trabalhador de Serraria', free);
    }
    for (const free of [3, 4, 5]) {
      await step('Tirar um trabalhador de Pedreira', free);
    }
    for (const free of [4, 3, 2, 1, 0]) {
      await step('Pôr mais um trabalhador em Fazenda', free);
    }
    await expect(food).toContainText('+55');
    await expect(food).toContainText('cheio em 6 h');
    await expect(food.locator('.codicon-warning')).toBeVisible();
    await expect(tree(page).locator('[data-node="resource:food"]')).toContainText(
      /\d+\/500 ⚠ cheio em 6 h/,
    );
    await expect(tree(page).locator('[data-node="resources"]')).toContainText(
      'comida ⚠ cheio em 6 h',
    );
    await expect(notes).toHaveCount(1);
    await expect(notes).toContainText('Despensa: comida no limite de 500 em 6 h.');
    // Custo e benefício lado a lado, e o botão que ordena a obra.
    await expect(notes).toContainText(
      '160 madeira, 80 pedra · 10 min · Capacidade de comida: 500 → 900.',
    );
    await notes.getByRole('button', { name: 'Construir Celeiro' }).click();

    // A obra começou: "cheio em" some na hora, e a tendência explica por quê.
    await expect(fief(page).locator('.active-construction')).toContainText('Celeiro → Nv1');
    await expect(food).not.toContainText('cheio em');
    await expect(food).toContainText('crescendo');
    await expect(notes).toHaveCount(0);
    expect((await explanation(food.locator('.explained').last())).text).toBe(
      'Não enche antes do fim da obra do Celeiro.',
    );
    await expect(tree(page).locator('[data-node="resource:food"]')).not.toContainText('cheio');

    // O Celeiro de pé: o limite sobe para 900, e a previsão volta sem alarme.
    await world.passTime(11 * MINUTE, page);
    await expect(fief(page).getByText('Os pedreiros estão livres.')).toBeVisible();
    await expect(food.getByRole('cell').nth(1)).toHaveText(/^900/);
    expect((await explanation(food.locator('.explained').first())).text).toBe('Celeiro Nv1: 900');
    await expect(food).toContainText(/cheio em 1[34] h/);
    await expect(food.locator('.codicon-warning')).toHaveCount(0);
    await expect(notes).toHaveCount(0);
    await expect(fief(page).getByText(/ergueu-se o Celeiro em Pedra Alta/)).toBeVisible();
    // O edifício erguido sai da lista "Construir" e passa a ser melhoria.
    await expect(fief(page).getByText('Celeiro Nv1 → Nv2')).toBeVisible();

    // Quinze horas depois o Celeiro encheu: a tela diz quanto vai ao chão e o que fazer.
    await world.passTime(15 * HOUR, page);
    expect(await stock(page, 'Comida')).toBe(900);
    await expect(food).toContainText('cheio: a produção está se perdendo');
    await expect(food.locator('.codicon-warning')).toBeVisible();
    // A taxa continua sendo o saldo da produção; o estoque é que não sobe mais.
    await expect(food).toContainText('+55');
    await expect(notes).toHaveCount(1);
    await expect(notes).toContainText(
      'Celeiro cheio: 55/h de comida indo ao chão. Amplie o Celeiro ou gaste comida.',
    );
    await expect(notes).toContainText('Capacidade de comida: 900 → 1.500.');
    // A ampliação custa mais do que há: o botão espera, com o que falta escrito.
    await expect(notes.getByRole('button', { name: 'Ampliar Celeiro' })).toBeDisabled();
    await expect(notes).toContainText(/Faltam \d+ madeira e \d+ pedra\./);
    await expect(tree(page).locator('[data-node="resource:food"]')).toContainText(
      '900/900 ⚠ cheio, perde 55/h',
    );
    await expect(fief(page).getByText(/o Celeiro de Pedra Alta encheu/)).toBeVisible();
    // O fecho diário do desperdício não é linha da Crônica.
    await expect(fief(page).getByText(/foi ao chão/)).toHaveCount(0);

    // Em 720 px o aviso e o botão cabem, sem rolagem horizontal.
    await page.setViewportSize({ width: 720, height: 800 });
    await expect(page.locator('#sidebar')).toBeHidden();
    expect(await overflow(page)).toEqual({ page: 0, content: 0 });
    await expect(notes.getByRole('button', { name: 'Ampliar Celeiro' })).toBeVisible();
    await page.setViewportSize({ width: 1280, height: 720 });

    // Cinco horas fora com o Celeiro cheio: o relatório soma o que foi ao chão em uma linha só.
    await page.close();
    await world.passTime(5 * HOUR);
    const back = await world.open(context);
    const today = back.getByRole('tabpanel', { name: 'Hoje' });
    await expect(today.getByText('Você esteve fora por 5 horas.')).toBeVisible();
    const row = today.getByRole('row', { name: /^Comida/ });
    // O estoque não saiu de 900: o que a Fazenda rendeu em cinco horas, 55 por hora, não coube.
    await expect(row.getByRole('cell')).toHaveText([
      '900',
      /^\+27[4-6]$/,
      '—',
      '—',
      /^−27[4-6]$/,
      '900',
    ]);
    const waste = today.locator('.waste');
    await expect(waste).toHaveCount(1);
    await expect(waste).toContainText(
      /Foram ao chão, por falta de espaço: 27[4-6] de comida \(Celeiro\)\./,
    );
    await expect(today.getByRole('listitem').filter({ hasText: /foi ao chão/ })).toHaveCount(0);
    await waste.getByRole('button', { name: 'Ver os depósitos' }).click();
    await expect(back.getByRole('tab', { name: 'Feudo' })).toHaveAttribute('aria-selected', 'true');
    await expect(fief(back).locator('.storage-notes')).toContainText('Celeiro cheio:');
  });
});

// V2C-T5 (GDD §6.3): a fila que ainda não abriu diz o que a abre, e as planejadas marcadas
// "iniciar quando houver recursos" começam sem o jogador, na ordem da lista e pulando a que não
// pode: o alívio de quem visita o feudo uma vez por dia.

test.describe('filas de obras e planejadas', () => {
  test('duas planejadas automáticas começam sozinhas na ausência, e a Crônica e o Relatório contam', async ({
    context,
    world,
  }) => {
    test.setTimeout(60_000);
    const commands: Array<{ type: string; payload: unknown }> = [];
    context.on('request', (request) => {
      if (request.url().endsWith('/commands')) {
        const body = request.postDataJSON() as { type: string; payload: unknown };
        commands.push({ type: body.type, payload: body.payload });
      }
    });
    const page = await world.open(context);
    await playNow(page);
    const step = async (label: string, free: number) => {
      await fief(page).getByRole('button', { name: label }).click();
      await expect(fief(page).getByText(`Livres ${free}`)).toBeVisible();
    };
    // Três na Serraria e dois na Pedreira: a madeira e a pedra sobem enquanto o feudo fica só.
    for (const free of [4, 3, 2]) {
      await step('Pôr mais um trabalhador em Serraria', free);
    }
    for (const free of [1, 0]) {
      await step('Pôr mais um trabalhador em Pedreira', free);
    }

    // Uma fila aberta; a segunda aparece com o motivo, e não como um botão que não faz nada.
    const queues = fief(page).getByRole('list', { name: 'Filas de obras' }).locator('> li');
    await expect(queues).toHaveText([
      'Os pedreiros estão livres.',
      'A segunda fila abre com o Salão do Senhor Nv4.',
    ]);
    await expect(queues.nth(1).getByRole('button')).toHaveCount(0);
    await expect(tree(page).locator('[data-node="constructions"]')).toHaveAttribute(
      'title',
      'A segunda fila abre com o Salão do Senhor Nv4.',
    );

    // Os pedreiros ocupados com as Habitações: o que for planejado agora tem de esperar.
    await fief(page)
      .getByRole('listitem')
      .filter({ hasText: 'Habitações Nv1 → Nv2' })
      .getByRole('button', { name: 'Melhorar' })
      .click();
    await expect(queues.first()).toContainText('Habitações → Nv2');
    await expect(queues.nth(1)).toHaveText('A segunda fila abre com o Salão do Senhor Nv4.');
    expect(await stock(page, 'Madeira')).toBe(70);

    // Pelo painel, a obra entra na lista como manual, com o que espera e em quanto tempo.
    await fief(page)
      .getByRole('listitem')
      .filter({ hasText: 'Serraria Nv1 → Nv2' })
      .getByRole('button', { name: 'Planejar' })
      .click();
    const planned = fief(page).getByRole('list', { name: 'Planejadas' }).locator('> li');
    await expect(planned).toHaveCount(1);
    const lumberMark = planned
      .first()
      .getByRole('checkbox', { name: 'Iniciar quando houver recursos: Serraria' });
    await expect(lumberMark).not.toBeChecked();
    await expect(planned.first()).toContainText(
      'Espera 30 de madeira e 5 de pedra: em 1 h 15 min.',
    );
    // A marca é um clique, e só muda na tela quando o servidor confirma.
    await lumberMark.click();
    await expect(lumberMark).toBeChecked();
    expect(commands.at(-1)).toEqual({
      type: 'setAutoStart',
      payload: { building: 'lumberMill', autoStart: true },
    });

    // Pela paleta, "Planejar obras" pergunta se a obra começa sozinha; Enter aceita a marca.
    await palette(page, 'planejar obras');
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('combobox').fill('fazenda');
    await page.keyboard.press('Enter');
    await expect(dialog).toContainText('Planejar: Fazenda Nv1 → Nv2');
    const options = dialog.getByRole('option');
    await expect(options).toHaveCount(2);
    await expect(options.first()).toHaveAttribute('aria-selected', 'true');
    await expect(options.first()).toContainText('Iniciar quando houver recursos');
    await expect(options.first()).toContainText('Os pedreiros começam sozinhos');
    await expect(options.last()).toContainText('Só deixar na lista');
    await page.keyboard.press('Enter');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(planned).toHaveCount(2);
    expect(commands.at(-1)).toEqual({
      type: 'planConstruction',
      payload: { building: 'farm', autoStart: true },
    });
    await expect(
      planned.nth(1).getByRole('checkbox', { name: 'Iniciar quando houver recursos: Fazenda' }),
    ).toBeChecked();
    await expect(planned.nth(1)).toContainText('Espera 10 de madeira: em 25 min.');
    // Planejar e marcar não gastam nada.
    expect(await stock(page, 'Madeira')).toBe(70);
    expect(await stock(page, 'Ouro')).toBe(250);

    // Na árvore, cada planejada diz a marca por extenso e tem o botão que a troca.
    await tree(page).locator('[data-node="constructions"]').click();
    await expect(tree(page).locator('[data-node="constructions"]')).toContainText('2 planejadas');
    const lumberRow = tree(page).locator('[data-node="planned:lumberMill"]');
    await expect(tree(page).locator('[data-node="planned"]')).toContainText(
      'Planejadas2 automáticas',
    );
    await expect(lumberRow).toContainText('Serraria → Nv2');
    await expect(lumberRow).toContainText('automática · espera 30 de madeira e 5 de pedra');
    await lumberRow.hover();
    await lumberRow.getByRole('button', { name: 'Esperar a sua ordem: Serraria → Nv2' }).click();
    await expect(lumberRow).toContainText('manual ·');
    await expect(lumberMark).not.toBeChecked();
    await lumberRow
      .getByRole('button', { name: 'Iniciar quando houver recursos: Serraria → Nv2' })
      .click();
    await expect(lumberRow).toContainText('automática ·');
    await expect(lumberMark).toBeChecked();
    // Pelo teclado, a barra de espaço troca a marca como o clique.
    await lumberMark.focus();
    await page.keyboard.press('Space');
    await expect(lumberMark).not.toBeChecked();
    await page.keyboard.press('Space');
    await expect(lumberMark).toBeChecked();
    await expect(lumberMark).toBeFocused();
    // O clique na linha só navega: nenhuma ordem a mais saiu.
    const sent = commands.length;
    await lumberRow.click();
    expect(commands).toHaveLength(sent);

    // Em 720 px a lista de planejadas cabe, com a marca e a espera, sem rolagem horizontal.
    await page.setViewportSize({ width: 720, height: 800 });
    await expect(page.locator('#sidebar')).toBeHidden();
    expect(await overflow(page)).toEqual({ page: 0, content: 0 });
    await expect(lumberMark).toBeVisible();
    await page.setViewportSize({ width: 1280, height: 720 });

    // Seis horas fora. A Fazenda, mais barata, começa primeiro (a Serraria, à frente dela na
    // lista, ainda não podia e não a segura); a Serraria começa quando a madeira junta de novo.
    await page.close();
    await world.passTime(6 * HOUR);
    const back = await world.open(context);
    const today = back.getByRole('tabpanel', { name: 'Hoje' });
    await expect(today.getByText('Você esteve fora por 6 horas.')).toBeVisible();
    const started = today.getByRole('listitem').filter({ hasText: 'começaram sozinhos' });
    await expect(started).toHaveText([
      /com as reservas cheias, os pedreiros começaram sozinhos a erguer a Fazenda ao 2º nível\.$/,
      /com as reservas cheias, os pedreiros começaram sozinhos a erguer a Serraria ao 2º nível\.$/,
    ]);
    // O que as duas obras custaram aparece como gasto, não como produção que não houve.
    const spent = (name: string) =>
      today
        .getByRole('row', { name: new RegExp(`^${name}`) })
        .getByRole('cell')
        .nth(2);
    await expect(spent('Madeira')).toHaveText('−180');
    await expect(spent('Pedra')).toHaveText('−50');
    await expect(spent('Ouro')).toHaveText('−40');
    await expect(today.getByText(/Obras concluídas: 3/)).toBeVisible();

    // No feudo: a lista de planejadas esvaziou, os edifícios subiram e a Crônica conta as duas.
    await today.getByRole('button', { name: 'Ir para o feudo' }).click();
    await expect(fief(back).getByRole('heading', { name: 'Planejadas' })).toHaveCount(0);
    await expect(fief(back).getByText('Os pedreiros estão livres.')).toBeVisible();
    await expect(fief(back).getByText('Fazenda Nv2 → Nv3')).toBeVisible();
    await expect(fief(back).getByText('Serraria Nv2 → Nv3')).toBeVisible();
    const recent = fief(back)
      .getByRole('region', { name: 'Crônica' })
      .getByRole('listitem')
      .filter({ hasText: 'começaram sozinhos' });
    await expect(recent).toHaveCount(2);
    await fief(back).getByRole('button', { name: 'Abrir a Crônica' }).click();
    const chronicle = back.getByRole('tabpanel', { name: 'Crônica' });
    await expect(chronicle.getByText(/começaram sozinhos a erguer a Fazenda/)).toBeVisible();
    await expect(chronicle.getByText(/começaram sozinhos a erguer a Serraria/)).toBeVisible();
  });

  test('planejar como automática o que já pode começar inicia a obra na mesma hora, sozinha', async ({
    context,
    world,
  }) => {
    const page = await world.open(context);
    await playNow(page);
    // A Fazenda cabe no estoque e os pedreiros estão livres: a opção diz que começa agora.
    await palette(page, 'planejar obras');
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('combobox').fill('fazenda');
    await page.keyboard.press('Enter');
    const options = dialog.getByRole('option');
    await expect(options.first()).toContainText(
      'Há recursos e pedreiros livres: a obra começa agora mesmo.',
    );
    // Começar agora gasta agora: o que vem marcado é só deixar na lista. A escolha é do jogador.
    await expect(options.last()).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('ArrowUp');
    await expect(options.first()).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('Enter');
    const queues = fief(page).getByRole('list', { name: 'Filas de obras' }).locator('> li');
    await expect(queues.first()).toContainText('Fazenda → Nv2');
    // Começou e saiu da lista: foi paga uma vez, e a Crônica diz que os pedreiros agiram sós.
    await expect(fief(page).getByRole('heading', { name: 'Planejadas' })).toHaveCount(0);
    expect(await stock(page, 'Madeira')).toBe(40);
    await expect(
      fief(page).getByText(/os pedreiros começaram sozinhos a erguer a Fazenda ao 2º nível/),
    ).toBeVisible();

    // A outra opção só deixa a obra na lista, à espera da ordem, e "Iniciar agora" a começa
    // quando o jogador quiser. Aqui a fila está ocupada: a espera diz isso, com o prazo.
    await palette(page, 'planejar obras');
    await page.getByRole('dialog').getByRole('combobox').fill('pedreira');
    await page.keyboard.press('Enter');
    // A Pedreira ainda não pode começar: aqui a automática é que vem marcada.
    await expect(page.getByRole('dialog').getByRole('option').first()).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    const planned = fief(page).getByRole('list', { name: 'Planejadas' }).locator('> li');
    await expect(planned).toHaveCount(1);
    await expect(planned.first().getByRole('checkbox')).not.toBeChecked();
    await expect(planned.first()).toContainText(/Espera/);
    await expect(planned.first().getByRole('button', { name: /Iniciar agora/ })).toHaveCount(0);
  });
});
