import type { APIRequestContext, Page } from '@playwright/test';

import {
  applyTheme,
  type Card,
  expect,
  fief,
  gameEvents,
  HOUR,
  lowContrast,
  MINUTE,
  overflow,
  palette,
  pendingCards,
  playNow,
  type ServerEvent,
  statusBar,
  test,
  THEMES,
  toasts,
  tree,
  type World,
} from './helpers';

// Roadmap da v0.2, V2D-T3: o Conselho na interface (GDD §7, §13.2 a §13.6). Critério 2 da §16.2:
// uma carta chega a cada 4 dias de jogo (8 h reais no ritmo Normal, o do servidor de teste) e
// expira em 24 h reais, com a opção automática da dificuldade.
//
// Qual carta o sorteio tira depende do catálogo, que cresce: os testes não citam carta nenhuma.
// Leem do servidor a carta que está na mesa e conferem que a tela mostra exatamente o que ele
// mandou. A opção automática nunca tem custo nem requisito, e é a que os testes escolhem quando
// precisam de uma resposta que sempre pode ser dada.

/**
 * O prazo de uma carta recém-chegada: 24 horas de relógio. A tela arredonda para baixo, e a
 * leitura acontece instantes depois da audiência: "24 h" no mesmo segundo, "23 h" logo depois.
 */
const DAY_LEFT = 'expira em 2[34] h';

const councilTab = (page: Page) => page.getByRole('tab', { name: 'Conselho' });
const council = (page: Page) => page.getByRole('tabpanel', { name: 'Conselho' });
/** A folha de uma carta na aba do Conselho. */
const sheet = (page: Page, card: Card) => council(page).getByRole('article', { name: card.title });
const record = (page: Page) =>
  council(page).getByRole('region', { name: 'O que o conselho registrou' });
const newCardNotice = (page: Page, card: Card) =>
  toasts(page)
    .getByRole('status')
    .filter({ hasText: `Nova carta do Conselho: ${card.title}` });

/**
 * Funda o feudo com o conselho convocado e põe dois aldeões na Fazenda: o feudo não passa fome
 * enquanto o teste espera as audiências, e a barra de status fica livre para o Conselho.
 */
async function found(page: Page) {
  await playNow(page);
  const more = fief(page).getByRole('button', { name: 'Pôr mais um trabalhador em Fazenda' });
  await more.click();
  await expect(fief(page).getByText('Trabalhadores (1/5)')).toBeVisible();
  await more.click();
  await expect(fief(page).getByText('Trabalhadores (2/5)')).toBeVisible();
}

/** Adianta o relógio até a próxima audiência (8 h no ritmo Normal) e devolve a carta que chegou. */
async function nextAudience(
  world: World,
  request: APIRequestContext,
  pages: Page[],
  known: Card[] = [],
): Promise<Card> {
  await world.passTime(8 * HOUR, ...pages);
  const [first] = pages;
  if (first === undefined) {
    throw new Error('Nenhuma página aberta.');
  }
  const seen = new Set(known.map((card) => card.instanceId));
  const fresh = (await pendingCards(first, request)).filter((card) => !seen.has(card.instanceId));
  expect(fresh.length, 'a audiência trouxe uma carta').toBeGreaterThan(0);
  return fresh[0] as Card;
}

/** Leva o foco, só com `Tab`, ao botão de opção com este rótulo; falha se ele não for alcançado. */
async function tabTo(page: Page, label: string) {
  for (let step = 0; step < 80; step += 1) {
    await page.keyboard.press('Tab');
    const focused = await page.evaluate(() => {
      const element = document.activeElement as HTMLElement | null;
      return {
        choice: element?.classList.contains('card-choice') === true,
        text: element?.textContent?.trim() ?? '',
        // Foco visível: o contorno do tema, desenhado só para quem usa o teclado.
        visible:
          element !== null &&
          element.matches(':focus-visible') &&
          getComputedStyle(element).outlineStyle !== 'none',
      };
    });
    if (focused.choice && focused.text === label) {
      expect(focused.visible, `foco visível em "${label}"`).toBe(true);
      return;
    }
  }
  throw new Error(`O Tab não chegou ao botão "${label}".`);
}

test.describe('conselho', () => {
  test.beforeEach(({ world }) => {
    world.conveneCouncil();
  });

  test('a carta chega na audiência, aparece em toda a bancada e é respondida pelo painel', async ({
    context,
    request,
    world,
  }) => {
    const page = await world.open(context);
    await found(page);

    // Antes da primeira audiência: a mesa vazia, com a hora da próxima reunião.
    await councilTab(page).click();
    await expect(page).toHaveURL(/#\/conselho$/);
    await expect(council(page)).toContainText('O conselho não tem nada a tratar agora.');
    await expect(council(page)).toContainText(/Próxima audiência em (8 h|7 h 5\d min)\./);
    await expect(record(page)).toContainText('Nada ainda.');
    await expect(tree(page).locator('[data-node="council"]')).toContainText(
      /próxima audiência em [78] h/,
    );
    await expect(statusBar(page)).not.toContainText('decis');
    await page.getByRole('tab', { name: 'Feudo' }).click();

    const card = await nextAudience(world, request, [page]);

    // O aviso, com o que o conselho faz sozinho e o botão que leva à carta.
    const notice = newCardNotice(page, card);
    await expect(notice).toBeVisible();
    await expect(notice).toContainText(card.expiryNote);
    await expect(notice.getByRole('button', { name: 'Decidir' })).toBeVisible();
    await expect(notice.getByRole('button', { name: 'Silenciar 2h' })).toBeVisible();
    // A barra de status, o título, o ícone do Feudo, a aba e a árvore.
    await expect(statusBar(page)).toContainText(new RegExp(`1 decisão pendente · ${DAY_LEFT}`));
    await expect(page).toHaveTitle('(1) Pedra Alta · Lords of the Guild');
    await expect(page.getByRole('button', { name: 'Feudo: 1 decisão pendente' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Conselho 1 carta pendente' })).toBeVisible();
    await expect(tree(page).locator('[data-node="today"]')).toContainText('● 1 decisão pendente');
    await expect(tree(page).locator('[data-node="council"]')).toContainText(
      new RegExp(`1 carta pendente \\(${DAY_LEFT}\\)`),
    );
    const row = tree(page).locator(`[data-node="card:${card.instanceId}"]`);
    await expect(row).toContainText(card.title);
    await expect(row).toContainText(new RegExp(DAY_LEFT));

    // A aba Hoje lista a decisão, e "Decidir" leva à aba do Conselho.
    await page.getByRole('tab', { name: 'Hoje' }).click();
    const decisions = page.getByRole('region', { name: 'Decisões pendentes (1)' });
    await expect(decisions).toContainText(
      new RegExp(`Conselho: “${escape(card.title)}” · ${DAY_LEFT}`),
    );
    await decisions.getByRole('button', { name: `Decidir: ${card.title}` }).click();
    await expect(councilTab(page)).toHaveAttribute('aria-selected', 'true');

    // A carta inteira, como o servidor a mandou: texto, opções com custo, consequência e pista,
    // o prazo em tempo real e o que acontece sem resposta.
    const letter = sheet(page, card);
    await expect(letter).toContainText(card.text);
    await expect(letter).toContainText(new RegExp(DAY_LEFT, 'i'));
    await expect(letter).toContainText(card.expiryNote);
    expect(card.options.length).toBeGreaterThanOrEqual(2);
    for (const option of card.options) {
      const choice = letter.getByRole('button', { name: option.label, exact: true });
      await expect(choice).toBeVisible();
      // O botão é descrito pelo custo e pela consequência: é o que o leitor de tela lê com ele.
      await expect(choice).toHaveAccessibleDescription(new RegExp(escape(option.effectsText)));
      await expect(letter).toContainText(option.hint);
      if (option.locked || !option.affordable) {
        await expect(choice).toBeDisabled();
      } else {
        await expect(choice).toBeEnabled();
      }
    }
    const automatic = letter
      .getByRole('listitem')
      .filter({ hasText: 'Sem resposta, é isto que o conselho faz.' });
    await expect(automatic).toHaveCount(1);
    await expect(
      automatic.getByRole('button', { name: card.defaultOptionLabel, exact: true }),
    ).toBeEnabled();
    await expect(council(page)).toContainText('Em estoque:');
    expect(await lowContrast(page)).toEqual([]);
    expect(await overflow(page)).toEqual({ page: 0, content: 0 });

    // Responde. A carta some, a mesa esvazia, e o registro conta a decisão com a frase da Crônica.
    await letter.getByRole('button', { name: card.defaultOptionLabel, exact: true }).click();
    await expect(letter).toHaveCount(0);
    await expect(council(page)).toContainText('O conselho não tem nada a tratar agora.');
    const answered = (await gameEvents(page, request)).filter(
      (event) => event.type === 'cardAnswered' && event.data.instanceId === card.instanceId,
    );
    expect(answered).toHaveLength(1);
    expect(answered[0]?.data.optionId).toBe(card.defaultOptionId);
    await expect(record(page).getByRole('listitem').first()).toHaveText(answered[0]?.text ?? '');
    // O desfecho aparece na hora, com a frase que a escolha escreveu na Crônica.
    await expect(
      toasts(page)
        .getByRole('status')
        .filter({ hasText: answered[0]?.text ?? '' }),
    ).toBeVisible();
    await expect(record(page).getByRole('listitem')).toHaveCount(2);
    // Nada mais anuncia a carta.
    await expect(notice).toHaveCount(0);
    await expect(statusBar(page)).not.toContainText('decis');
    await expect(page).toHaveTitle('Pedra Alta · Lords of the Guild');
    await expect(page.getByRole('button', { name: 'Feudo', exact: true })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Conselho', exact: true })).toBeVisible();
    await expect(tree(page).locator(`[data-node="card:${card.instanceId}"]`)).toHaveCount(0);
    expect(await pendingCards(page, request)).toEqual([]);
  });

  test('pelo aviso, pela árvore e pela paleta: o mesmo caminho, uma resposta por carta', async ({
    context,
    request,
    world,
  }) => {
    const page = await world.open(context);
    await found(page);
    const orders: Array<{ type: string; payload: unknown; commandId: string }> = [];
    context.on('request', (sent) => {
      if (sent.url().endsWith('/commands')) {
        orders.push(sent.postDataJSON() as (typeof orders)[number]);
      }
    });
    const first = await nextAudience(world, request, [page]);

    // "Decidir" no aviso leva à aba do Conselho, e o aviso sai de cena.
    await newCardNotice(page, first).getByRole('button', { name: 'Decidir' }).click();
    await expect(councilTab(page)).toHaveAttribute('aria-selected', 'true');
    await expect(sheet(page, first)).toBeVisible();

    // Clicar na linha da carta só navega: nenhuma ordem sai.
    await page.getByRole('tab', { name: 'Feudo' }).click();
    const row = tree(page).locator(`[data-node="card:${first.instanceId}"]`);
    await row.click();
    await expect(councilTab(page)).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(orders.filter((order) => order.type === 'answerCard')).toEqual([]);

    // O botão da linha abre a lista das opções, com o texto da carta no alto.
    await row.hover();
    await row.getByRole('button', { name: `Decidir: ${first.title}` }).click();
    const list = page.getByRole('dialog');
    await expect(list).toContainText(first.title);
    await expect(list).toContainText(first.text);
    await expect(list).toContainText(first.expiryNote);
    await expect(list).toHaveAccessibleDescription(new RegExp(escape(first.text)));
    for (const option of first.options) {
      const item = list.getByRole('option').filter({ hasText: option.label });
      await expect(item).toContainText(option.effectsText);
      await expect(item).toContainText(option.hint);
    }
    // O que já vem marcado é a opção automática: Enter sem ler não gasta nada.
    await expect(list.getByRole('option', { selected: true })).toContainText(
      first.defaultOptionLabel,
    );
    // Esc desiste: nada é enviado e a carta continua na mesa.
    await page.keyboard.press('Escape');
    await expect(list).toHaveCount(0);
    expect(orders.filter((order) => order.type === 'answerCard')).toEqual([]);
    await expect(sheet(page, first)).toBeVisible();

    // De novo, e agora escolhe com o mouse.
    await row.hover();
    await row.getByRole('button', { name: `Decidir: ${first.title}` }).click();
    await page
      .getByRole('dialog')
      .getByRole('option')
      .filter({ hasText: first.defaultOptionLabel })
      .click();
    await expect(sheet(page, first)).toHaveCount(0);

    // A audiência seguinte traz outra carta, respondida pela paleta de comandos.
    const second = await nextAudience(world, request, [page], [first]);
    expect(second.instanceId).not.toBe(first.instanceId);
    await expect(sheet(page, second)).toBeVisible();
    await palette(page, 'Decidir carta do Conselho');
    const pending = await pendingCards(page, request);
    if (pending.length > 1) {
      // Com mais de uma carta na mesa, a paleta pergunta qual.
      await page.getByRole('dialog').getByRole('option').filter({ hasText: second.title }).click();
    }
    await expect(page.getByRole('dialog')).toContainText(second.text);
    await page.keyboard.press('Enter');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(sheet(page, second)).toHaveCount(0);

    // Uma ordem por carta, cada uma com o seu identificador, e as duas com a opção escolhida.
    const answers = orders.filter((order) => order.type === 'answerCard');
    expect(answers.map((order) => order.payload)).toEqual([
      { instanceId: first.instanceId, optionId: first.defaultOptionId },
      { instanceId: second.instanceId, optionId: second.defaultOptionId },
    ]);
    expect(new Set(answers.map((order) => order.commandId)).size).toBe(2);
    await expect(toasts(page).getByRole('alert')).toHaveCount(0);
  });

  for (const theme of THEMES) {
    test(`só com o teclado, no tema ${theme}: pelo painel e pela paleta, com foco e contraste`, async ({
      context,
      request,
      world,
    }) => {
      const page = await world.open(context);
      await found(page);
      await applyTheme(page, theme);
      const first = await nextAudience(world, request, [page]);

      // Pelo painel: a paleta leva à aba, o Tab leva ao botão da opção, Enter responde.
      await palette(page, 'Ir para o Conselho');
      await expect(councilTab(page)).toHaveAttribute('aria-selected', 'true');
      await expect(sheet(page, first)).toBeVisible();
      expect(await lowContrast(page), `contraste da carta no tema ${theme}`).toEqual([]);
      await tabTo(page, first.defaultOptionLabel);
      await page.keyboard.press('Enter');
      await expect(sheet(page, first)).toHaveCount(0);
      await expect(record(page).getByRole('listitem')).toHaveCount(2);

      // Pela paleta: a lista das opções, com o texto da carta, e Enter na opção marcada.
      const second = await nextAudience(world, request, [page], [first]);
      await page.keyboard.press('F1');
      await expect(page.getByRole('combobox')).toBeFocused();
      await page.keyboard.type('Decidir carta');
      await page.keyboard.press('Enter');
      if ((await pendingCards(page, request)).length > 1) {
        await page.keyboard.type(second.title);
        await page.keyboard.press('Enter');
      }
      const list = page.getByRole('dialog');
      await expect(list).toContainText(second.text);
      await expect(page.getByRole('combobox')).toBeFocused();
      expect(await lowContrast(page), `contraste da lista no tema ${theme}`).toEqual([]);
      // As setas andam pelas opções; a volta completa termina na que veio marcada.
      for (let step = 0; step < second.options.length; step += 1) {
        await page.keyboard.press('ArrowDown');
      }
      await expect(list.getByRole('option', { selected: true })).toContainText(
        second.defaultOptionLabel,
      );
      await page.keyboard.press('Enter');
      await expect(list).toHaveCount(0);
      await expect(sheet(page, second)).toHaveCount(0);
      const answered = (await gameEvents(page, request)).filter(
        (event) => event.type === 'cardAnswered',
      );
      expect(answered.map((event) => [event.data.instanceId, event.data.optionId])).toEqual([
        [first.instanceId, first.defaultOptionId],
        [second.instanceId, second.defaultOptionId],
      ]);
    });
  }

  test('com a rede lenta, a resposta a uma carta não atropela a audiência seguinte', async ({
    context,
    request,
    world,
  }) => {
    const page = await world.open(context);
    await found(page);
    const first = await nextAudience(world, request, [page]);
    await councilTab(page).click();

    // A leitura dos eventos que segue toda ordem chega devagar, e a renovação da sessão, mais
    // devagar ainda. A resposta aparece na tela antes de essa leitura terminar; oito horas
    // depois o access token já venceu, e a página só o troca no ciclo que o salto dispara.
    await context.route('**/v1/games/*/events*', async (route) => {
      const response = await route.fetch();
      await new Promise((resolve) => setTimeout(resolve, 150));
      await route.fulfill({ response });
    });
    await context.route('**/v1/auth/refresh', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 400));
      await route.continue();
    });
    await sheet(page, first)
      .getByRole('button', { name: first.defaultOptionLabel, exact: true })
      .click();
    await expect(sheet(page, first)).toHaveCount(0);

    // O salto espera a leitura em voo e o ciclo inteiro: a sessão renovada, a visão e os eventos.
    // A carta nova está na mesa, na tela e no servidor, e a resposta dada foi contada uma vez só.
    const second = await nextAudience(world, request, [page], [first]);
    expect(second.instanceId).not.toBe(first.instanceId);
    await expect(sheet(page, second)).toBeVisible();
    await expect(statusBar(page)).toContainText('1 decisão pendente');
    const answered = (await gameEvents(page, request)).filter(
      (event) => event.type === 'cardAnswered',
    );
    expect(answered.map((event) => event.data.instanceId)).toEqual([first.instanceId]);
    await expect(
      record(page)
        .getByRole('listitem')
        .filter({ hasText: answered[0]?.text ?? '' }),
    ).toHaveCount(1);
    await expect(toasts(page).getByRole('alert')).toHaveCount(0);
  });

  test('em 720 px a carta cabe: as opções descem uma embaixo da outra, sem rolagem lateral', async ({
    context,
    request,
    world,
  }) => {
    const page = await world.open(context);
    await playNow(page);
    const card = await nextAudience(world, request, [page]);
    await councilTab(page).click();
    await page.setViewportSize({ width: 720, height: 900 });
    // A bancada se redesenha para a tela estreita, com a barra lateral recolhida.
    await expect(page.locator('#sidebar')).toBeHidden();
    await expect(sheet(page, card)).toBeVisible();
    expect(await overflow(page)).toEqual({ page: 0, content: 0 });
    expect(await lowContrast(page)).toEqual([]);
    // Nenhum botão de opção passa da largura da folha.
    const widths = await sheet(page, card)
      .locator('.card-choice')
      .evaluateAll((buttons) =>
        buttons.map((button) => {
          const article = button.closest('article') as HTMLElement;
          return button.getBoundingClientRect().right <= article.getBoundingClientRect().right;
        }),
      );
    expect(widths.length).toBeGreaterThanOrEqual(2);
    expect(widths.every(Boolean)).toBe(true);
    // A lista das opções, pela paleta, também cabe.
    await palette(page, 'Decidir carta do Conselho');
    await expect(page.getByRole('dialog')).toContainText(card.text);
    expect(await overflow(page)).toEqual({ page: 0, content: 0 });
    await page.keyboard.press('Escape');
  });

  test('sem resposta, a carta expira em 24 horas de relógio e a Crônica conta a opção automática (critério 2)', async ({
    context,
    request,
    world,
  }) => {
    const page = await world.open(context);
    await found(page);
    const card = await nextAudience(world, request, [page]);
    await councilTab(page).click();
    const letter = sheet(page, card);
    await expect(letter).toContainText(new RegExp(DAY_LEFT, 'i'));
    // O prazo é de relógio: 24 horas a contar da audiência.
    expect(card.expiresInSeconds).toBeGreaterThan(23 * 3600);
    expect(card.expiresInSeconds).toBeLessThanOrEqual(24 * 3600);

    // Dezesseis horas depois faltam menos de oito: o prazo ganha o sinal de aviso, na carta e na
    // aba Hoje, e nada foi decidido ainda.
    await world.passTime(16 * HOUR + MINUTE, page);
    await expect(letter.locator('.card-deadline.warning')).toContainText('Expira em 7 h');
    await expect(letter.locator('.card-deadline .codicon-warning')).toBeVisible();
    await expect(tree(page).locator(`[data-node="card:${card.instanceId}"]`)).toContainText(
      '⚠ expira em 7 h',
    );
    await page.getByRole('tab', { name: 'Hoje' }).click();
    await expect(
      page
        .getByRole('region', { name: /^Decisões pendentes/ })
        .getByRole('listitem')
        .filter({ hasText: card.title }),
    ).toContainText('Atenção:');
    await councilTab(page).click();

    // Com a lista das opções aberta, o prazo acaba: a tela avisa e fecha sem enviar nada.
    const orders: string[] = [];
    context.on('request', (sent) => {
      if (sent.url().endsWith('/commands')) {
        orders.push(sent.postData() ?? '');
      }
    });
    const row = tree(page).locator(`[data-node="card:${card.instanceId}"]`);
    await row.hover();
    await row.getByRole('button', { name: `Decidir: ${card.title}` }).click();
    await expect(page.getByRole('dialog')).toContainText(card.text);
    await world.passTime(8 * HOUR, page);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(toasts(page)).toContainText(
      `O prazo de "${card.title}" acabou antes da sua resposta, e o conselho decidiu sozinho.`,
    );
    expect(orders).toEqual([]);
    await expect(letter).toHaveCount(0);
    await expect(tree(page).locator(`[data-node="card:${card.instanceId}"]`)).toHaveCount(0);

    // O servidor aplicou a opção automática da dificuldade, e ninguém respondeu por fora.
    const events = await gameEvents(page, request);
    const mine = events.filter((event) => event.data.instanceId === card.instanceId);
    expect(mine.map((event) => event.type)).toEqual(['cardDrawn', 'cardExpired']);
    const [drawn, expired] = mine as [ServerEvent, ServerEvent];
    expect(expired.data.optionId).toBe(card.defaultOptionId);
    // 24 horas de relógio entre a chegada e a expiração (no ritmo Normal, 24 horas de jogo).
    expect(expired.atMs - drawn.atMs).toBe(24 * HOUR);

    // A Crônica conta o que o conselho fez: no registro da aba, na árvore e na aba Crônica.
    await expect(record(page).getByRole('listitem').filter({ hasText: expired.text })).toHaveCount(
      1,
    );
    await palette(page, 'Abrir a Crônica');
    await expect(page.getByRole('tabpanel', { name: 'Crônica' })).toContainText(expired.text);
  });

  test('duas abas: uma responde e a outra vê a carta sumir; a resposta atrasada é recusada com a frase do servidor', async ({
    context,
    request,
    world,
  }) => {
    const first = await world.open(context);
    await found(first);
    const second = await world.open(context);
    await expect(second.getByRole('heading', { name: 'Pedra Alta', level: 1 })).toBeVisible();

    const card = await nextAudience(world, request, [first, second]);
    // As duas abas recebem o aviso. A primeira vai ao Conselho; a segunda fica no feudo, com o
    // aviso à vista e a carta na árvore.
    const secondRow = tree(second).locator(`[data-node="card:${card.instanceId}"]`);
    for (const page of [first, second]) {
      await expect(newCardNotice(page, card)).toBeVisible();
    }
    await expect(secondRow).toBeVisible();
    await councilTab(first).click();
    // Na aba do Conselho a carta está à vista: o aviso dela sai da frente.
    await expect(newCardNotice(first, card)).toHaveCount(0);

    // A primeira aba responde. Na leitura seguinte, a carta some da segunda, com o aviso dela.
    await sheet(first, card)
      .getByRole('button', { name: card.defaultOptionLabel, exact: true })
      .click();
    await expect(sheet(first, card)).toHaveCount(0);
    await expect(newCardNotice(second, card)).toBeVisible();
    await world.passTime(31_000, second);
    await expect(newCardNotice(second, card)).toHaveCount(0);
    await expect(secondRow).toHaveCount(0);
    await expect(statusBar(second)).not.toContainText('decis');
    await expect(second).toHaveTitle('Pedra Alta · Lords of the Guild');
    await councilTab(second).click();
    await expect(sheet(second, card)).toHaveCount(0);
    await expect(record(second).getByRole('listitem')).toHaveCount(2);

    // Outra carta. Desta vez a segunda aba clica antes de ler de novo: o servidor recusa com a
    // frase dele, a visão que vem na recusa toma a tela e a carta some. Nada é pago duas vezes.
    const other = await nextAudience(world, request, [first, second], [card]);
    await expect(sheet(second, other)).toBeVisible();
    await sheet(first, other)
      .getByRole('button', { name: other.defaultOptionLabel, exact: true })
      .click();
    await expect(sheet(first, other)).toHaveCount(0);
    await sheet(second, other)
      .getByRole('button', { name: other.defaultOptionLabel, exact: true })
      .click();
    await expect(sheet(second, other)).toHaveCount(0);
    const refusal = toasts(second).getByRole('status').filter({ hasText: /carta/i });
    await expect(refusal).toBeVisible();
    await expect(refusal).not.toContainText('Nova carta');
    const answers = (await gameEvents(first, request)).filter(
      (event) => event.type === 'cardAnswered',
    );
    expect(answers.map((event) => event.data.instanceId)).toEqual([
      card.instanceId,
      other.instanceId,
    ]);
  });

  test('modo discreto: a carta chega sem aviso, e a barra e o título ficam só com o contador', async ({
    context,
    request,
    world,
  }) => {
    const page = await world.open(context);
    await found(page);
    await palette(page, 'modo discreto');
    await expect(statusBar(page)).toContainText(/^\d{2}:\d{2}/);
    const card = await nextAudience(world, request, [page]);

    await expect(toasts(page).getByRole('status')).toHaveCount(0);
    await expect(statusBar(page)).not.toContainText('decis');
    await expect(statusBar(page)).not.toContainText(card.title);
    await expect(page).toHaveTitle(/^\d{2}:\d{2}$/);
    await expect(page.getByRole('button', { name: 'Feudo', exact: true })).toBeVisible();
    // Dentro da bancada a carta continua lá para quem for olhar.
    await expect(tree(page).locator('[data-node="council"]')).toContainText('1 carta pendente');
    await councilTab(page).click();
    await expect(sheet(page, card)).toBeVisible();

    // Desligado o modo discreto, a decisão volta à barra, ao título e ao ícone do Feudo.
    await palette(page, 'modo discreto');
    await expect(statusBar(page)).toContainText('1 decisão pendente');
    await expect(page).toHaveTitle('(1) Pedra Alta · Lords of the Guild');
    await expect(page.getByRole('button', { name: 'Feudo: 1 decisão pendente' })).toBeVisible();
  });

  test('sem ligação a carta se lê, mas não se responde; com a ligação de volta, a resposta segue', async ({
    context,
    request,
    world,
  }) => {
    const page = await world.open(context);
    await found(page);
    const card = await nextAudience(world, request, [page]);
    await councilTab(page).click();
    const letter = sheet(page, card);
    await expect(letter).toBeVisible();

    // A API cai: toda chamada falha na rede.
    await context.route('**/v1/**', (route) => route.abort('connectionrefused'));
    await page.clock.fastForward(31_000);
    await expect(council(page)).toContainText(
      'Sem ligação com o reino: as cartas e os prazos são os do último estado conhecido do feudo.',
    );
    await expect(letter).toContainText(card.text);
    for (const choice of await letter.locator('.card-choice').all()) {
      await expect(choice).toBeDisabled();
    }
    const row = tree(page).locator(`[data-node="card:${card.instanceId}"]`);
    await row.hover();
    await expect(row.getByRole('button', { name: `Decidir: ${card.title}` })).toBeDisabled();
    // O estado guardado pode estar velho: nada anuncia a carta fora da bancada.
    await expect(page).toHaveTitle('Pedra Alta · Lords of the Guild');
    await expect(statusBar(page)).toContainText('Sem ligação com o reino');

    // A API volta, e a carta aceita resposta de novo.
    await context.unroute('**/v1/**');
    await council(page).getByRole('button', { name: 'Tentar agora' }).click();
    await expect(council(page)).not.toContainText('Sem ligação com o reino');
    await letter.getByRole('button', { name: card.defaultOptionLabel, exact: true }).click();
    await expect(letter).toHaveCount(0);
  });

  test('servidor de outra versão (426): pede para recarregar a página, com a frase do protocolo novo', async ({
    context,
    world,
  }) => {
    const page = await world.open(context);
    await found(page);
    // O servidor foi atualizado e passou a recusar o protocolo desta página.
    await context.route('**/v1/games/*/view', (route) =>
      route.fulfill({
        status: 426,
        contentType: 'application/json',
        body: JSON.stringify({
          code: 'UPGRADE_REQUIRED',
          message: 'Há uma versão nova do jogo. Recarregue a página.',
          details: { protocol: 99 },
        }),
      }),
    );
    await page.clock.fastForward(31_000);
    const notice = toasts(page)
      .getByRole('status')
      .filter({ hasText: 'Há uma versão nova do jogo. Recarregue a página.' });
    await expect(notice).toBeVisible();
    // Um aviso só, por mais ciclos que passem.
    await page.clock.fastForward(31_000);
    await expect(notice).toHaveCount(1);
    // O feudo continua à vista: não é perda de sessão nem falta de rede.
    await expect(page.getByRole('heading', { name: 'Pedra Alta', level: 1 })).toBeVisible();
    await expect(statusBar(page)).not.toContainText('Sem ligação');

    // "Recarregar" recarrega; com o servidor de volta ao protocolo da página, o feudo abre.
    await context.unroute('**/v1/games/*/view');
    await notice.getByRole('button', { name: 'Recarregar' }).click();
    await expect(page.getByRole('heading', { name: 'Pedra Alta', level: 1 })).toBeVisible();
    await expect(toasts(page).getByText('Há uma versão nova do jogo')).toHaveCount(0);
  });
});

/** Um texto literal como expressão regular. */
function escape(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
