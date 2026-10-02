import { type Locator, type Page } from '@playwright/test';

import {
  applyTheme,
  expect,
  fief,
  HOUR,
  lowContrast,
  MINUTE,
  overflow,
  playNow,
  serverView,
  statusBar,
  stock,
  test,
  THEMES,
  toasts,
  tree,
} from './helpers';

// Critério 9 (GDD §16.1): temas claro, escuro e de alto contraste; navegável por teclado,
// inclusive a paleta de comandos.

/** Onde está o foco: a região da bancada e o que identifica o elemento. */
const focusInfo = (page: Page) =>
  page.evaluate(() => {
    const element = document.activeElement as HTMLElement | null;
    if (element === null || element === document.body) {
      return { zone: 'body', label: '', visible: false };
    }
    const zone =
      (['.activitybar', '.sidebar', '.editor-tabs', '.editor-content', '.statusbar'] as const).find(
        (selector) => element.closest(selector) !== null,
      ) ?? 'outro';
    const style = getComputedStyle(element);
    return {
      zone,
      label: (element.getAttribute('aria-label') ?? element.textContent ?? '').trim().slice(0, 40),
      // Foco visível: o contorno do tema, desenhado só para quem usa o teclado.
      visible: element.matches(':focus-visible') && style.outlineStyle !== 'none',
    };
  });

/** Escolhe um comando pela paleta, só com o teclado. */
async function command(page: Page, text: string) {
  await page.keyboard.press('F1');
  await expect(page.getByRole('combobox')).toBeFocused();
  await page.keyboard.type(text);
  await page.keyboard.press('Enter');
}

test.describe('teclado', () => {
  test('Tab percorre barra de atividades, árvore, abas e barra de status, com foco visível', async ({
    context,
    world,
  }) => {
    const page = await world.open(context);
    await playNow(page);
    // Página recém-carregada: o Tab começa do topo do documento.
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Pedra Alta', level: 1 })).toBeVisible();

    const zones: string[] = [];
    for (let step = 0; step < 60; step += 1) {
      await page.keyboard.press('Tab');
      const focus = await focusInfo(page);
      if (focus.zone === 'body') {
        break;
      }
      expect(focus.visible, `foco visível em "${focus.label}" (${focus.zone})`).toBe(true);
      zones.push(focus.zone);
      if (focus.zone === '.statusbar' && focus.label.includes('paleta')) {
        break;
      }
    }
    const order = zones.filter((zone, index) => zones[index - 1] !== zone);
    expect(order).toEqual([
      '.activitybar',
      '.sidebar',
      '.editor-tabs',
      '.editor-content',
      '.statusbar',
    ]);
    // A árvore e as abas são uma parada só cada (foco itinerante), não uma por item.
    expect(zones.filter((zone) => zone === '.editor-tabs')).toHaveLength(1);
    expect(zones.filter((zone) => zone === '.sidebar').length).toBeLessThanOrEqual(3);
  });

  test('a árvore segue o padrão ARIA: setas, Home, End, Enter, e + e − nos trabalhadores', async ({
    context,
    world,
  }) => {
    const page = await world.open(context);
    await playNow(page);
    const focused = () =>
      page.evaluate(() => (document.activeElement as HTMLElement).dataset.node ?? '');

    await tree(page).getByRole('treeitem').first().focus();
    expect(await focused()).toBe('today');
    await page.keyboard.press('ArrowDown');
    expect(await focused()).toBe('fief');
    await page.keyboard.press('ArrowDown');
    expect(await focused()).toBe('resources');
    // Seta para a esquerda fecha o ramo; de novo, sobe ao pai.
    await page.keyboard.press('ArrowLeft');
    await expect(tree(page).locator('[data-node="resources"]')).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    await expect(tree(page).locator('[data-node="resource:food"]')).toHaveCount(0);
    await page.keyboard.press('ArrowLeft');
    expect(await focused()).toBe('fief');
    await page.keyboard.press('End');
    // A última linha do feudo é o último objetivo em aberto: a seta para cima passa pelos três,
    // pela linha "Objetivos", pela Ameaça, pela Moral e pelo Conselho, e volta às Construções.
    expect(await focused()).toBe('objective:recruitVillagers');
    await page.keyboard.press('ArrowUp');
    expect(await focused()).toBe('objective:upgradeHousing');
    await page.keyboard.press('ArrowUp');
    expect(await focused()).toBe('objective:allocateFarmers');
    await page.keyboard.press('ArrowUp');
    expect(await focused()).toBe('objectives');
    await page.keyboard.press('ArrowUp');
    expect(await focused()).toBe('threat');
    await page.keyboard.press('ArrowUp');
    expect(await focused()).toBe('morale');
    await page.keyboard.press('ArrowUp');
    expect(await focused()).toBe('council');
    await page.keyboard.press('ArrowUp');
    expect(await focused()).toBe('constructions');
    // Seta para a direita abre o ramo e, de novo, entra nele.
    await page.keyboard.press('ArrowRight');
    await expect(tree(page).locator('[data-node="constructions"]')).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    await page.keyboard.press('ArrowRight');
    expect(await focused()).toBe('construction:townHall');
    await page.keyboard.press('Home');
    expect(await focused()).toBe('today');
    // Uma única linha da árvore fica na ordem do Tab.
    await expect(tree(page).locator('[role="treeitem"][tabindex="0"]')).toHaveCount(1);

    // Enter navega: em "Hoje", abre a aba Hoje.
    await page.keyboard.press('Enter');
    await expect(page.getByRole('tab', { name: 'Hoje' })).toHaveAttribute('aria-selected', 'true');

    // + e − em um edifício dão a ordem sem sair do teclado.
    await tree(page).locator('[data-node="worker:farm"]').focus();
    await page.keyboard.press('+');
    await expect(tree(page).locator('[data-node="worker:farm"]')).toContainText('1 ·');
    await page.keyboard.press('+');
    await expect(tree(page).locator('[data-node="worker:farm"]')).toContainText('2 ·');
    await page.keyboard.press('-');
    await expect(tree(page).locator('[data-node="worker:farm"]')).toContainText('1 ·');
    // O foco continua na mesma linha depois de cada ordem.
    expect(await focused()).toBe('worker:farm');
  });

  test('abas: setas trocam de aba; a paleta abre com F1 e Ctrl+K, filtra, e Esc devolve o foco', async ({
    context,
    world,
  }) => {
    const page = await world.open(context);
    await playNow(page);
    await page.getByRole('tab', { name: 'Feudo' }).focus();
    await page.keyboard.press('ArrowLeft');
    await expect(page.getByRole('tab', { name: 'Hoje' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('tab', { name: 'Hoje' })).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('tab', { name: 'Feudo' })).toBeFocused();

    await page.keyboard.press('Control+k');
    const dialog = page.getByRole('dialog');
    await expect(dialog).toHaveAttribute('aria-modal', 'true');
    const box = dialog.getByRole('combobox');
    await expect(box).toBeFocused();
    const all = await dialog.getByRole('option').count();
    expect(all).toBeGreaterThanOrEqual(20);
    for (const label of await dialog.getByRole('option').allInnerTexts()) {
      expect(label).toMatch(/^Lords: /);
    }
    // Busca sem acento e sem maiúsculas.
    await page.keyboard.type('cronica');
    await expect(dialog.getByRole('option')).toHaveCount(2);
    await expect(dialog.getByRole('option').first()).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('ArrowDown');
    await expect(dialog.getByRole('option').nth(1)).toHaveAttribute('aria-selected', 'true');
    await expect(box).toHaveAttribute('aria-activedescendant', 'quickpick-1');
    // Foco preso: Tab não sai do diálogo.
    await page.keyboard.press('Tab');
    await expect(box).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    // O foco volta para onde estava.
    await expect(page.getByRole('tab', { name: 'Feudo' })).toBeFocused();

    await page.keyboard.press('F1');
    await page.keyboard.type('zzzz');
    await expect(page.getByRole('dialog').getByText('Nada encontrado.')).toBeVisible();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
  });

  test('F1 no instante em que a página abre já mostra a paleta, e o que se digita vai para ela', async ({
    context,
    world,
  }) => {
    const page = await context.newPage();
    page.on('pageerror', (error) => world.problems.push(`exceção: ${error.message}`));
    // Relógio parado: nada do que o app agenda para "depois do próximo quadro" roda. A bancada
    // tem de ouvir os diálogos e o controlador desde o primeiro desenho; se só passasse a ouvir
    // um quadro depois, a paleta aberta nesse intervalo ficaria invisível e o texto digitado
    // cairia no campo das boas-vindas.
    await page.clock.install({ time: new Date() });
    await page.clock.pauseAt(new Date(Date.now() + 60_000));
    await page.goto('/');

    await page.keyboard.press('F1');
    const box = page.getByRole('dialog').getByRole('combobox');
    await expect(box).toBeFocused();
    await page.keyboard.type('sobre');
    await page.keyboard.press('Enter');
    const about = page.getByRole('tabpanel', { name: 'Sobre' });
    // A resposta do servidor também chega com o relógio parado, e a aba a mostra.
    await expect(about).toContainText(/Servidor\s*\d+\.\d+\.\d+/);
    await expect(page.getByLabel('Como devemos chamar quem governa?')).toHaveCount(0);
  });

  test('uma partida inteira dos objetivos 1 a 4 só com o teclado', async ({ context, world }) => {
    const page = await world.open(context);
    // Boas-vindas: o campo do nome já tem o foco; Enter envia o formulário.
    await expect(page.getByLabel('Como devemos chamar quem governa?')).toBeFocused();
    await page.keyboard.type('Gustavo');
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { name: 'Pedra Alta', level: 1 })).toBeVisible();
    const objectives = fief(page).getByRole('region', { name: 'Objetivos' });

    // 1. Aloque 2 aldeões na Fazenda.
    await command(page, 'alocar');
    await page.keyboard.type('fazenda');
    await page.keyboard.press('Enter');
    await page.keyboard.type('2');
    await page.keyboard.press('Enter');
    await expect(objectives.getByText('Cumprido: Aloque 2 aldeões na Fazenda')).toBeAttached();

    // 2. Inicie a melhoria das Habitações.
    await command(page, 'construir');
    await page.keyboard.type('habita');
    await page.keyboard.press('Enter');
    await expect(objectives.getByText('Cumprido: Inicie a melhoria das Habitações')).toBeAttached();

    // 3. Recrute 3 aldeões (16 minutos cada, na primavera).
    await command(page, 'recrutar');
    await page.keyboard.type('3');
    await page.keyboard.press('Enter');
    await expect(fief(page).getByText('A caminho 3')).toBeVisible();
    await world.passTime(61 * MINUTE, page);
    await expect(objectives.getByText('Cumprido: Recrute 3 aldeões')).toBeAttached();
    await expect(fief(page).getByText('Aldeões 8')).toBeVisible();

    // 4. Alcance o Salão do Senhor Nv2: junta madeira e pedra, depois ergue o Salão.
    for (const [building, count] of [
      ['serraria', '3'],
      ['pedreira', '3'],
    ] as const) {
      await command(page, 'alocar');
      await page.keyboard.type(building);
      await page.keyboard.press('Enter');
      await page.keyboard.type(count);
      await page.keyboard.press('Enter');
      await expect(page.getByRole('dialog')).toHaveCount(0);
    }
    await expect(fief(page).getByText('Trabalhadores (8/8)')).toBeVisible();
    await world.passTime(6 * HOUR, page);
    await command(page, 'construir');
    await page.keyboard.type('salao');
    await page.keyboard.press('Enter');
    await expect(statusBar(page)).toContainText('Salão do Senhor Nv2 ·');
    await world.passTime(11 * MINUTE, page);
    await expect(fief(page).getByText('Salão Nv2')).toBeVisible();
    await expect(objectives.getByText('Cumprido: Alcance o Salão do Senhor Nv2')).toBeAttached();
    // Nenhuma ordem foi recusada no caminho.
    await expect(toasts(page).getByRole('alert')).toHaveCount(0);
  });

  // Roadmap da v0.2, V2E-T4 (GDD §12.2): os dez objetivos, do primeiro ao último, sem mouse e
  // pelos três lugares em que eles aparecem: a árvore, o painel do feudo e a aba Hoje. O jogo é
  // o de verdade; só o Salão no nível 3, que levaria dezenas de horas, é posto pelo teste.
  test('os objetivos 1 a 10 só com o teclado: pela árvore, pelo painel e pela aba Hoje, com o Relatório no meio do caminho', async ({
    context,
    request,
    world,
  }) => {
    test.setTimeout(90_000);
    let page = await world.open(context);
    await expect(page.getByLabel('Como devemos chamar quem governa?')).toBeFocused();
    await page.keyboard.type('Gustavo');
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { name: 'Pedra Alta', level: 1 })).toBeVisible();

    const panel = () => fief(page).getByRole('region', { name: 'Objetivos' });
    /** Os objetivos em aberto do painel à vista (o do feudo ou o da aba Hoje). */
    const open = (region: Locator) => region.locator('li.objective');
    /** O Tab leva ao botão; Enter o aciona. */
    const press = async (button: Locator) => {
      await button.focus();
      await expect(button).toBeFocused();
      await page.keyboard.press('Enter');
    };
    /** Na árvore: as setas levam à linha do objetivo, o Tab ao botão dela, Enter o aciona. */
    const pressInTree = async (objective: string, name: RegExp) => {
      const row = tree(page).locator(`[data-node="objective:${objective}"]`);
      await row.focus();
      await page.keyboard.press('Tab');
      await expect(row.getByRole('button', { name })).toBeFocused();
      await page.keyboard.press('Enter');
    };
    /** O que o servidor diz dos objetivos agora: a tela mostra os mesmos, na mesma ordem. */
    const sameAsServer = async (region: Locator) => {
      const view = await serverView(page, request);
      const active = view.objectives.filter((objective) => objective.status === 'active');
      expect(active.length).toBeLessThanOrEqual(3);
      await expect(open(region)).toHaveCount(active.length);
      for (const [index, objective] of active.entries()) {
        const item = open(region).nth(index);
        await expect(item).toContainText(objective.title);
        await expect(item).toContainText(objective.hint);
        await expect(item).toContainText(`Recompensa: ${objective.reward}.`);
        if (objective.missing !== null) {
          await expect(item).toContainText(objective.missing);
        }
      }
      return view.objectives;
    };

    // No começo: três em aberto, na árvore e no painel, e nenhum cumprido.
    await expect(tree(page).locator('[data-node="objectives"]')).toContainText('3 em aberto');
    await sameAsServer(panel());
    await expect(panel().getByText(/^Cumpridos/)).toHaveCount(0);

    // 1. Aloque 2 aldeões na Fazenda: pelo botão da linha do objetivo, na árvore.
    await pressInTree('allocateFarmers', /^Alocar na Fazenda/);
    await expect(page.getByRole('dialog')).toContainText('Fazenda Nv1');
    await page.keyboard.type('2');
    await page.keyboard.press('Enter');
    await expect(panel().getByText('Cumprido: Aloque 2 aldeões na Fazenda')).toBeAttached();
    // Concluir um revela o próximo: continuam três em aberto, agora com o do Salão.
    await expect(panel().getByText('Cumpridos (1)')).toBeVisible();
    await expect(open(panel()).last()).toContainText('Alcance o Salão do Senhor Nv2');
    await sameAsServer(panel());

    // 2. Inicie a melhoria das Habitações: pelo botão do painel, com o custo ao lado do prêmio.
    const housing = open(panel()).filter({ hasText: 'Inicie a melhoria das Habitações' });
    await expect(housing).toContainText('Recompensa: +30 madeira.');
    await expect(housing).toContainText('Pode começar agora: 80 madeira, 20 pedra · 4 min.');
    await press(housing.getByRole('button', { name: 'Melhorar Habitações' }));
    await expect(panel().getByText('Cumpridos (2)')).toBeVisible();
    expect(await stock(page, 'Madeira')).toBe(120 - 80 + 30);

    // 3. Recrute 3 aldeões: pela aba Hoje, onde os objetivos vêm depois de "Antes de partir".
    await command(page, 'Ir para Hoje');
    const today = page.getByRole('tabpanel', { name: 'Hoje' });
    const todayObjectives = today.getByRole('region', { name: 'Objetivos' });
    await sameAsServer(todayObjectives);
    await expect(todayObjectives).toContainText('2 já cumpridos.');
    await press(todayObjectives.getByRole('button', { name: 'Recrutar aldeões' }));
    await page.keyboard.type('3');
    await page.keyboard.press('Enter');
    // Com os três a caminho, não há mais o que ordenar: o botão sai, e a frase diz por quê.
    const recruit = open(todayObjectives).filter({ hasText: 'Recrute 3 aldeões' });
    await expect(recruit).toContainText('Os 3 aldeões que faltam já estão a caminho.');
    await expect(recruit.getByRole('button')).toHaveCount(0);
    await world.passTime(61 * MINUTE, page);
    await expect(todayObjectives).toContainText('3 já cumpridos.');
    // "Ver todos" leva à lista inteira, no feudo, com o foco no título dela.
    await press(todayObjectives.getByRole('button', { name: 'Ver todos' }));
    await expect(page.getByRole('tab', { name: 'Feudo' })).toHaveAttribute('aria-selected', 'true');
    await expect(panel().getByRole('heading', { name: 'Objetivos' })).toBeFocused();

    // 4. Alcance o Salão do Senhor Nv2. Ainda faltam recursos: o botão leva às construções.
    const hall = open(panel()).filter({ hasText: 'Alcance o Salão do Senhor Nv2' });
    await expect(hall).toContainText(/Faltam \d+ madeira e \d+ pedra\./);
    await press(hall.getByRole('button', { name: 'Ver as obras' }));
    await expect(fief(page).getByRole('heading', { name: 'Construções' })).toBeFocused();
    // Madeira e pedra: três na Serraria e três na Pedreira, pelo "+" da árvore.
    for (const building of ['lumberMill', 'quarry']) {
      const row = tree(page).locator(`[data-node="worker:${building}"]`);
      await row.focus();
      for (const count of [1, 2, 3]) {
        await page.keyboard.press('+');
        await expect(row).toContainText(`${count} ·`);
      }
    }
    await expect(fief(page).getByText('Trabalhadores (8/8)')).toBeVisible();
    await world.passTime(6 * HOUR, page);
    // Agora a obra pode começar: o botão da linha passa a ordená-la, com o custo na dica.
    // (O botão só fica à vista com a linha em foco: aqui se lê o que ele vai dizer.)
    const hallRow = tree(page).locator('[data-node="objective:townHallLevel2"]');
    await expect(hallRow.locator('button')).toHaveAttribute(
      'title',
      /^Melhorar Salão do Senhor: Alcance o Salão do Senhor Nv2 \(150 madeira, 100 pedra, 100 ouro · 10 min\)$/,
    );
    await pressInTree('townHallLevel2', /^Melhorar Salão do Senhor/);
    await expect(statusBar(page)).toContainText('Salão do Senhor Nv2 ·');
    await expect(hall).toContainText(
      'A obra do Salão do Senhor já começou: o objetivo se cumpre quando ela terminar.',
    );
    await expect(hall.getByRole('button')).toHaveCount(0);
    await world.passTime(11 * MINUTE, page);
    await expect(panel().getByText('Cumpridos (4)')).toBeVisible();

    // Os objetivos da v0.2: a Torre, a primeira carta e o depósito.
    const objectives = await sameAsServer(panel());
    expect(objectives.filter((objective) => objective.status === 'active')).toHaveLength(3);
    await expect(tree(page).locator('[data-node="objectives"]')).toContainText(
      '3 em aberto · 4 cumpridos',
    );
    // A recompensa de moral diz o prazo em dias de jogo e no relógio de quem joga.
    const card = open(panel()).filter({ hasText: 'Responda à primeira carta do Conselho' });
    await expect(card).toContainText('Recompensa: +10 de moral por 1 dia de jogo (2 h).');
    await expect(card).toContainText(
      'Nenhuma carta espera resposta: vale a próxima que o Conselho trouxer.',
    );

    // 6. Responda à primeira carta do Conselho. A carta chega; o botão do objetivo leva a ela.
    await world.control('council-deal', { cardId: 'masonsMeal' });
    await world.passTime(MINUTE, page);
    await expect(card).toContainText('Só falta a sua ordem.');
    await press(card.getByRole('button', { name: 'Decidir no Conselho' }));
    await expect(page.getByRole('tab', { name: /^Conselho/ })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await command(page, 'Decidir carta');
    await expect(page.getByRole('dialog')).toContainText('A refeição dos pedreiros');
    // A opção que já vem marcada é a que o conselho aplicaria sozinho: não custa nada.
    await page.keyboard.press('Enter');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await command(page, 'Ir para o Feudo');
    await expect(panel().getByText('Cumpridos (5)')).toBeVisible();
    await expect(
      panel().getByText('Cumprido: Responda à primeira carta do Conselho'),
    ).toBeAttached();
    // O prêmio é um efeito passageiro na conta da moral, com o nome que o servidor deu: entra
    // na próxima virada do dia e vale até a seguinte.
    const morale = fief(page).getByRole('region', { name: 'Moral' });
    await expect(
      morale.getByRole('listitem').filter({ hasText: 'O Senhor ouviu o Conselho' }).first(),
    ).toHaveText(/^\+10\s*O Senhor ouviu o Conselho$/);
    await expect(morale).toContainText(
      /Passageiro: O Senhor ouviu o Conselho \(\+10\), por mais \d+ h( \d+ min)?\./,
    );
    // 8. Deixe uma obra marcada para começar sozinha: o objetivo acaba de aparecer, e só falta
    // a ordem. O botão dele abre a lista das obras; a Torre fica planejada, com a marca ligada.
    const marked = open(panel()).filter({ hasText: 'Deixe uma obra marcada para começar sozinha' });
    await expect(marked).toContainText('Só falta a sua ordem.');
    await press(marked.getByRole('button', { name: 'Planejar obras' }));
    await page.keyboard.type('Planejar: Torre de Vigia');
    await page.keyboard.press('Enter');
    // "Iniciar quando houver recursos" já vem marcada para a obra que ainda não pode começar.
    await expect(page.getByRole('dialog')).toContainText('Iniciar quando houver recursos');
    await page.keyboard.press('Enter');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(panel().getByText('Cumpridos (6)')).toBeVisible();
    // A Paliçada entrou na lista, travada pelo Salão: o motivo é o do servidor.
    await expect(open(panel()).filter({ hasText: 'Construa a Paliçada' })).toContainText(
      'Melhore antes o Salão do Senhor para o nível 3.',
    );

    // 5 e 7. O Celeiro também fica planejado, para começar sozinho, e o senhor sai.
    await command(page, 'Planejar obras');
    await page.keyboard.type('Planejar: Celeiro');
    await page.keyboard.press('Enter');
    await expect(page.getByRole('dialog')).toContainText('Iniciar quando houver recursos');
    await page.keyboard.press('Enter');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(
      fief(page).getByRole('checkbox', { name: /^Iniciar quando houver recursos/, checked: true }),
    ).toHaveCount(2);
    await sameAsServer(panel());
    await page.close();
    await world.passTime(14 * HOUR);
    page = await world.open(context);

    // De volta: o Relatório conta os dois objetivos cumpridos em uma linha só, e não em duas.
    await expect(page.getByRole('tab', { name: 'Hoje' })).toHaveAttribute('aria-selected', 'true');
    const back = page.getByRole('tabpanel', { name: 'Hoje' });
    const prospered = back.getByRole('region', { name: /^O feudo prosperou/ });
    const completed = prospered.getByRole('listitem').filter({ hasText: /objetivo/i });
    await expect(completed).toHaveCount(1);
    // Na ordem em que aconteceram: a pedra do Celeiro chega antes da da Torre, e a planejada
    // que ainda não pode começar não segura a seguinte.
    await expect(completed).toHaveText(
      '2 objetivos cumpridos. Construa o Celeiro ou o Armazém: +60 madeira. ' +
        'Construa a Torre de Vigia: +40 pedra.',
    );
    // A Crônica da ausência continua com uma linha para cada um.
    const lines = back.getByRole('group').filter({ hasText: 'A Crônica da ausência' });
    await press(lines.locator('summary'));
    await expect(
      lines.getByRole('listitem').filter({ hasText: 'cumpriu-se um objetivo' }),
    ).toHaveCount(2);
    // Nenhum aviso avulso: quem conta a ausência é o relatório.
    await expect(toasts(page).getByRole('status')).toHaveCount(0);
    // Logo abaixo, os dois que restam, e quantos já foram.
    const after = back.getByRole('region', { name: 'Objetivos' });
    await sameAsServer(after);
    await expect(open(after)).toHaveCount(2);
    await expect(after).toContainText('8 já cumpridos.');
    const winter = open(after).filter({ hasText: 'Atravesse o inverno sem passar frio' });
    await expect(winter).toContainText('Recompensa: +15 de moral por 1 dia de jogo (2 h).');
    await expect(winter).toContainText('Falta o Inverno chegar e passar sem frio.');
    // Atravessar o inverno é esperar: não há botão.
    await expect(winter.getByRole('button')).toHaveCount(0);

    // 9. Construa a Paliçada. Com o Salão no nível 3, o botão da árvore ergue a obra.
    await world.raise('townHall', 3);
    await world.passTime(2 * HOUR, page);
    await pressInTree('buildPalisade', /^Construir Paliçada/);
    await expect(statusBar(page)).toContainText('Paliçada Nv1 ·');
    await world.passTime(21 * MINUTE, page);
    await expect(after).toContainText('9 já cumpridos.');
    await expect(open(after)).toHaveCount(1);
    await expect(tree(page).locator('[data-node="objectives"]')).toContainText(
      '1 em aberto · 9 cumpridos',
    );

    // 10. Atravesse o inverno sem passar frio. A lenha dá: a Serraria repõe o que a lareira queima.
    const untilWinter = (await serverView(page, request)).calendar.nextFirewoodSeason;
    expect(untilWinter).not.toBeNull();
    await world.passTime(((untilWinter?.secondsUntil ?? 0) + 2 * 3600) * 1000, page);
    await expect(winter).toContainText(
      'Ninguém passou frio até aqui: falta o Inverno terminar assim.',
    );
    const untilSpring = (await serverView(page, request)).calendar.nextSeason;
    await world.passTime((untilSpring.secondsUntil + 60) * 1000, page);
    await expect(after).toContainText(
      'Nenhum objetivo em aberto agora: o que havia a cumprir está cumprido.',
    );
    await expect(after).toContainText('10 já cumpridos.');
    await expect(tree(page).locator('[data-node="objectives"]')).toContainText('10 cumpridos');

    // A lista inteira, no feudo: os dez cumpridos, recolhidos até o jogador abrir.
    await press(after.getByRole('button', { name: 'Ver todos' }));
    await expect(panel().getByRole('heading', { name: 'Objetivos' })).toBeFocused();
    const done = panel().getByRole('group');
    await expect(done.getByRole('listitem').first()).toBeHidden();
    await press(done.locator('summary'));
    await expect(done.getByRole('listitem')).toHaveCount(10);
    await expect(done.getByRole('listitem').last()).toContainText(
      'Cumprido: Atravesse o inverno sem passar frio',
    );
    // O prêmio do inverno está na conta da moral.
    await expect(fief(page).getByRole('region', { name: 'Moral' })).toContainText(
      'Inverno sem frio (+15)',
    );
    // Nenhuma ordem foi recusada no caminho.
    await expect(toasts(page).getByRole('alert')).toHaveCount(0);
  });
});

test.describe('temas', () => {
  /** Todo controle tem nome acessível. */
  const unnamed = (page: Page) =>
    page.evaluate(() => {
      const name = (element: Element) =>
        (
          element.getAttribute('aria-label') ??
          (element.getAttribute('aria-labelledby') ?? '')
            .split(' ')
            .map((id) => document.getElementById(id)?.textContent ?? '')
            .join(' ') ??
          ''
        ).trim() ||
        (element.textContent ?? '').trim() ||
        (element.closest('label')?.textContent ?? '').trim();
      return [...document.querySelectorAll('button, input, select, a[href], [role="treeitem"]')]
        .filter((element) => name(element) === '')
        .map((element) => element.outerHTML.slice(0, 80));
    });

  test('escuro, claro e alto contraste: capturas, contraste e rótulos nas telas principais', async ({
    context,
    world,
  }, testInfo) => {
    const page = await world.open(context);
    const shoot = async (theme: string, screen: string) => {
      // A captura mostra a tela parada, sem o cursor de texto piscando.
      // Em test-results/temas/, para olhos humanos; na CI, sobem como artefato.
      const image = await page.screenshot({
        caret: 'hide',
        animations: 'disabled',
        path: `test-results/temas/${theme}-${screen}.png`,
      });
      await testInfo.attach(`${theme}-${screen}.png`, { body: image, contentType: 'image/png' });
    };
    for (const theme of THEMES) {
      await applyTheme(page, theme);
      await expect(page.getByRole('tabpanel', { name: 'Boas-vindas' })).toBeVisible();
      // Com as opções de dificuldade e ritmo já na tela: é com elas que o contraste é medido.
      await expect(page.getByRole('radiogroup', { name: 'Ritmo' })).toBeVisible();
      expect(await lowContrast(page), `contraste nas boas-vindas, tema ${theme}`).toEqual([]);
      expect(await unnamed(page), `rótulos nas boas-vindas, tema ${theme}`).toEqual([]);
      await shoot(theme, 'boas-vindas');
    }

    await playNow(page);
    await fief(page).getByRole('button', { name: 'Pôr mais um trabalhador em Fazenda' }).click();
    await fief(page)
      .getByRole('listitem')
      .filter({ hasText: 'Habitações Nv1 → Nv2' })
      .getByRole('button', { name: 'Melhorar' })
      .click();
    await expect(fief(page).locator('.active-construction')).toBeVisible();

    for (const theme of THEMES) {
      await applyTheme(page, theme);
      await expect(fief(page).locator('.active-construction')).toBeVisible();
      expect(await lowContrast(page), `contraste no Feudo, tema ${theme}`).toEqual([]);
      expect(await unnamed(page), `rótulos no Feudo, tema ${theme}`).toEqual([]);
      await shoot(theme, 'feudo');

      await page.keyboard.press('F1');
      await expect(page.getByRole('combobox')).toBeFocused();
      expect(await lowContrast(page), `contraste na paleta, tema ${theme}`).toEqual([]);
      await shoot(theme, 'paleta');
      await page.keyboard.press('Escape');

      await page.getByRole('tab', { name: 'Hoje' }).click();
      expect(await lowContrast(page), `contraste em Hoje, tema ${theme}`).toEqual([]);
      await page.getByRole('button', { name: 'Preferências' }).click();
      await expect(page.getByRole('tabpanel', { name: 'Preferências' })).toBeVisible();
      // A seção da partida, com a frase da dificuldade que vem do servidor.
      await expect(page.getByRole('group', { name: 'Esta partida' })).toContainText(
        'O feudo como foi pensado',
      );
      expect(await lowContrast(page), `contraste nas preferências, tema ${theme}`).toEqual([]);
      expect(await unnamed(page), `rótulos nas preferências, tema ${theme}`).toEqual([]);
      await shoot(theme, 'preferencias');
      await page.getByRole('tab', { name: 'Feudo' }).click();
    }
  });

  test('na primeira visita vale a preferência do sistema; a escolha fica lembrada', async ({
    browser,
    world,
  }) => {
    for (const [scheme, expected] of [
      ['dark', 'dark'],
      ['light', 'light'],
    ] as const) {
      const context = await browser.newContext({ colorScheme: scheme, locale: 'pt-BR' });
      const page = await world.open(context);
      await expect(page.locator('html')).toHaveAttribute('data-theme', expected);
      await context.close();
    }
    const context = await browser.newContext({ colorScheme: 'light', locale: 'pt-BR' });
    try {
      const page = await world.open(context);
      // "Trocar tema" pela paleta: claro → alto contraste → escuro.
      await page.keyboard.press('F1');
      await page.keyboard.type('trocar tema');
      await page.keyboard.press('Enter');
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'high-contrast');
      await expect(toasts(page)).toContainText('Tema: Alto contraste.');
      await page.reload();
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'high-contrast');

      // Pela aba de preferências, e a outra aba do navegador acompanha.
      const other = await world.open(context);
      await page.getByRole('button', { name: 'Preferências' }).click();
      await page.getByRole('radio', { name: 'Escuro' }).check();
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
      await expect(other.locator('html')).toHaveAttribute('data-theme', 'dark');
    } finally {
      await context.close();
    }
  });
});

test.describe('telas estreitas', () => {
  /**
   * O cabeçalho da aba Feudo fica preso no alto enquanto o painel rola. No inverno, com o frio e
   * a moral em queda, ele tem todas as linhas que pode ter; em janela baixa ou estreita, preso,
   * tomaria um terço da área da aba. A medida: preso, nunca passa de um quarto dela; onde
   * passaria, ele rola com o conteúdo.
   */
  test('no inverno e com a moral em queda, o cabeçalho preso não toma mais de um quarto da aba; em janela baixa ou estreita, ele rola com o conteúdo', async ({
    context,
    world,
  }) => {
    const page = await world.open(context);
    await playNow(page);
    const plus = fief(page).getByRole('button', { name: 'Pôr mais um trabalhador em Fazenda' });
    for (const free of [4, 3, 2, 1, 0]) {
      await plus.click();
      await expect(fief(page).getByText(`Livres ${free}`)).toBeVisible();
    }
    // A melhoria da Fazenda leva 80 das 120 de madeira: as 40 que sobram queimam em 16 h.
    await fief(page)
      .getByRole('listitem')
      .filter({ hasText: 'Fazenda Nv1 → Nv2' })
      .getByRole('button', { name: 'Melhorar' })
      .click();
    await expect(fief(page).locator('.active-construction')).toBeVisible();
    // 144 h até o inverno e mais 17: o frio abriu há uma hora, e a próxima virada leva a moral.
    await world.passTime(161 * HOUR, page);
    await page.getByRole('tab', { name: 'Feudo' }).click();
    const header = fief(page).locator('.header');
    await expect(header).toContainText(/Inverno, dia \d+ do Ano 1/);
    await expect(header.locator('.hearth')).toContainText('sem lenha, frio há');
    await expect(header.locator('.morale')).toContainText('na virada do dia, cai para');

    const content = page.locator('.editor-content');
    const measure = () =>
      page.evaluate(() => {
        const head = document.querySelector('.header');
        const area = document.querySelector('.editor-content');
        if (head === null || area === null) {
          throw new Error('A aba Feudo não tem cabeçalho.');
        }
        return {
          sticky: getComputedStyle(head).position === 'sticky',
          header: head.getBoundingClientRect().height,
          content: area.clientHeight,
          top: head.getBoundingClientRect().top - area.getBoundingClientRect().top,
        };
      });
    for (const viewport of [
      { width: 480, height: 800, sticky: false },
      { width: 720, height: 480, sticky: false },
      { width: 720, height: 700, sticky: true },
      { width: 1000, height: 700, sticky: true },
      { width: 1280, height: 560, sticky: false },
      { width: 1280, height: 720, sticky: true },
    ]) {
      const size = `${viewport.width} × ${viewport.height}`;
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      // Ao mudar de tamanho a bancada se redesenha (nos 720 px a barra lateral recolhe ou
      // volta), e por um instante a área da aba não tem medida nem rola: as medidas são
      // tentadas de novo até a tela assentar.
      await expect(async () => {
        await content.evaluate((el) => el.scrollTo(0, 0));
        const atTop = await measure();
        expect(atTop.sticky, size).toBe(viewport.sticky);
        if (atTop.sticky) {
          expect(atTop.header / atTop.content, size).toBeLessThanOrEqual(0.25);
        }
        // Rolando o painel até o fim: preso, o cabeçalho continua no alto; solto, saiu da frente.
        await content.evaluate((el) => el.scrollTo(0, el.scrollHeight));
        const atBottom = await measure();
        if (viewport.sticky) {
          expect(atBottom.top, size).toBe(0);
        } else {
          expect(atBottom.top + atBottom.header, size).toBeLessThanOrEqual(0);
        }
      }).toPass({ timeout: 3_000 });
      expect(await overflow(page), size).toEqual({ page: 0, content: 0 });
    }
  });

  for (const width of [480, 720]) {
    test(`a ${width} px: barra lateral recolhida, sem rolagem horizontal, e o feudo é jogável`, async ({
      browser,
      world,
    }) => {
      const context = await browser.newContext({
        viewport: { width, height: 800 },
        locale: 'pt-BR',
      });
      try {
        const page = await world.open(context);
        const overflow = () =>
          page.evaluate(() => {
            const content = document.querySelector('.editor-content');
            return {
              page: document.documentElement.scrollWidth - window.innerWidth,
              content: content === null ? 0 : content.scrollWidth - content.clientWidth,
            };
          });
        const sidebar = page.locator('#sidebar');
        await expect(sidebar).toBeHidden();
        expect(await overflow()).toEqual({ page: 0, content: 0 });

        await playNow(page);
        expect(await overflow()).toEqual({ page: 0, content: 0 });
        await fief(page)
          .getByRole('button', { name: 'Pôr mais um trabalhador em Fazenda' })
          .click();
        await expect(fief(page).getByText('Trabalhadores (1/5)')).toBeVisible();
        await fief(page)
          .getByRole('listitem')
          .filter({ hasText: 'Habitações Nv1 → Nv2' })
          .getByRole('button', { name: 'Melhorar' })
          .click();
        await expect(fief(page).locator('.active-construction')).toBeVisible();
        expect(await overflow()).toEqual({ page: 0, content: 0 });

        // A barra lateral abre por cima do conteúdo e sai da frente depois de navegar.
        await page.getByRole('button', { name: 'Feudo', exact: true }).click();
        await expect(sidebar).toBeVisible();
        const editorLeft = await page
          .locator('.editor')
          .evaluate((el) => el.getBoundingClientRect().left);
        expect(editorLeft).toBe(48);
        expect(await overflow()).toEqual({ page: 0, content: 0 });
        await tree(page)
          .getByRole('treeitem', { name: /Hoje em Pedra Alta/ })
          .click();
        await expect(sidebar).toBeHidden();
        await expect(page.getByRole('tab', { name: 'Hoje' })).toHaveAttribute(
          'aria-selected',
          'true',
        );
        expect(await overflow()).toEqual({ page: 0, content: 0 });

        await page.keyboard.press('F1');
        await expect(page.getByRole('combobox')).toBeVisible();
        expect(await overflow()).toEqual({ page: 0, content: 0 });
      } finally {
        await context.close();
      }
    });
  }
});
