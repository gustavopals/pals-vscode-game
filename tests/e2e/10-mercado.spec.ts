import type { APIRequestContext, BrowserContext, Page } from '@playwright/test';

import {
  applyTheme,
  expect,
  gameEvents,
  HOUR,
  lowContrast,
  MINUTE,
  overflow,
  palette,
  playNow,
  serverView,
  test,
  THEMES,
  toasts,
  tree,
  type World,
} from './helpers';

// V3E-T4 (GDD §5.4, §5.9 e §13.1 a §13.6; ADR 0018, decisões 16 a 18): o Mercado, as caravanas e
// os Mestres na interface. Critério 4 do GDD §16.2 em navegador (o Mercado respeita o volume
// diário: vender até o limite e ver a recusa com a frase do servidor) e critério 5 (uma caravana
// pode ser emboscada: o cenário de semente fixa da V3E-T2, agora pela tela).
//
// Os preços saem do sorteio do dia, que depende da semente: os testes não citam preço. Leem do
// servidor o que ele mostra e conferem que a tela mostra o mesmo, e que o total que a tela diz
// antes de confirmar é o ouro que o servidor de fato move. O Mercado e o estoque são postos pelas
// rotas de teste (`world.raise`, `world.stock`); o Mestre, por `world.master`; a semente da
// emboscada, por `world.seed`. Daí em diante a negociação, a viagem, o sorteio e a conta da
// produção são os do motor.

const marketTab = (page: Page) => page.getByRole('tab', { name: 'Mercado' });
const market = (page: Page) => page.getByRole('tabpanel', { name: 'Mercado' });
const prices = (page: Page) =>
  market(page).getByRole('table', { name: 'Preços de hoje no Mercado' });
const row = (page: Page, resource: string) =>
  prices(page).locator(`tr[data-resource="${resource}"]`);
const form = (page: Page) => market(page).getByRole('form', { name: 'Negociar no Mercado' });
const amount = (page: Page) => form(page).getByTestId('trade-amount');
const caravans = (page: Page) => market(page).getByRole('region', { name: 'Caravanas' });
const caravanForm = (page: Page) =>
  caravans(page).getByRole('form', { name: 'Mandar uma caravana' });

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

/** O ouro do cofre, lido do servidor, em unidades. */
async function gold(page: Page, request: APIRequestContext): Promise<number> {
  const view = await serverView(page, request);
  return view.resources.find((entry) => entry.id === 'gold')?.stock ?? 0;
}

/** Funda o feudo e o põe de pé com o Mercado no nível pedido e o cofre e os depósitos postos. */
async function openMarket(
  world: World,
  page: Page,
  {
    level = 1,
    wood = 700,
    gold: coins = 1000,
  }: { level?: number; wood?: number; gold?: number } = {},
) {
  await playNow(page);
  await world.raise('market', level);
  await world.stock('wood', wood);
  await world.stock('stone', 500);
  await world.stock('gold', coins);
  await world.passTime(MINUTE, page);
  await marketTab(page).click();
  await expect(prices(page)).toBeVisible();
}

/** Vende pelo painel: a quantidade, "Revisar a ordem" e "Confirmar". */
async function sell(
  page: Page,
  resource: string,
  units: number,
  side: 'Vender' | 'Comprar' = 'Vender',
) {
  await row(page, resource)
    .getByRole('button', { name: new RegExp(`^${side}`) })
    .click();
  await expect(amount(page)).toBeFocused();
  await amount(page).fill(String(units));
  await form(page).getByTestId('trade-review').click();
  await form(page).getByTestId('trade-confirm-button').click();
}

test.describe('a tabela de preços (V3E-T4.1)', () => {
  test('sem o Mercado a aba diz como erguê-lo; com ele, a tabela traz compra, venda, base, tendência e o que cabe', async ({
    context,
    request,
    world,
  }) => {
    const page = await world.open(context);
    await playNow(page);
    await marketTab(page).click();
    const before = await serverView(page, request);
    await expect(market(page)).toContainText(before.market.text);
    await expect(prices(page)).toHaveCount(0);
    // O Salão ainda não chegou: a obra diz por quê, e o botão fica travado.
    await expect(market(page).getByRole('button', { name: /Construir Mercado/ })).toBeDisabled();
    await expect(market(page)).toContainText('Melhore antes o Salão do Senhor para o nível 3.');

    await world.raise('market', 1);
    await world.passTime(MINUTE, page);
    const view = await serverView(page, request);
    expect(view.market.level).toBe(1);
    await expect(prices(page)).toBeVisible();
    for (const price of view.market.prices) {
      const line = row(page, price.resource);
      await expect(line).toContainText(price.label);
      await expect(line).toContainText(price.buyText);
      await expect(line).toContainText(price.sellText);
      await expect(line).toContainText(price.baseText);
      // A tendência é dita em palavra, nunca só pela cor.
      await expect(line).toContainText(/estável|subindo|descendo/);
      await expect(line).toContainText(`Cabem mais ${price.remainingToday} hoje.`);
    }
    // A explicação do preço é a do servidor, dita também para quem não passa o mouse.
    await expect(row(page, 'food')).toContainText(view.market.prices[0]?.breakdown ?? '');
    // As caravanas pedem o Mercado no nível 2: a frase do servidor diz onde ele está.
    await expect(caravans(page)).toContainText(view.market.caravanOffer.blockedReason ?? '');
    // A árvore diz o preço de compra e a tendência de cada recurso.
    await expect(tree(page).getByRole('treeitem', { name: /^Mercado/ })).toContainText(
      view.market.prices[0]?.buyText ?? '',
    );
  });
});

test.describe('negociar (V3E-T4.2; critério 4)', () => {
  test('o total aparece antes de confirmar e é o ouro que o servidor move; vender até o limite fecha o volume, e mais que isso é recusado com a frase do servidor', async ({
    context,
    request,
    world,
  }) => {
    const page = await world.open(context);
    await openMarket(world, page);
    const posts = commandPosts(page);
    const view = await serverView(page, request);
    const wood = view.market.prices.find((entry) => entry.resource === 'wood');
    if (wood === undefined) {
      throw new Error('O cenário esperava a madeira à venda.');
    }
    const goldBefore = await gold(page, request);

    await row(page, 'wood')
      .getByRole('button', { name: /^Vender/ })
      .click();
    await expect(amount(page)).toBeFocused();
    // O botão do máximo traz o do servidor, e a quantidade sai dele.
    await form(page).getByTestId('trade-max').click();
    await expect(amount(page)).toHaveValue(String(wood.maxSellable));
    const units = wood.maxSellable;
    const total = form(page).getByTestId('trade-total');
    await expect(total).toContainText(`Vender ${units} de madeira por`);
    await expect(total).toContainText('Total:');
    // Nada foi enviado ainda: a ordem nasce na confirmação.
    await form(page).getByTestId('trade-review').click();
    const review = form(page).getByTestId('trade-confirm');
    await expect(review).toContainText(`Vender ${units} de madeira por`);
    expect(posts).toEqual([]);
    await form(page).getByTestId('trade-confirm-button').click();
    await expect.poll(() => posts.length).toBe(1);
    expect(posts[0]).toMatchObject({
      type: 'trade',
      payload: {
        resource: 'wood',
        direction: 'sell',
        amount: units,
        quoteDay: view.market.quoteDay,
      },
    });

    // O ouro que o servidor moveu é a quantidade vezes o preço de venda de hoje, exato.
    await expect
      .poll(async () => (await gold(page, request)) - goldBefore, { intervals: [100, 200, 500] })
      .toBeGreaterThan(0);
    const after = await serverView(page, request);
    const earned = (await gold(page, request)) - goldBefore;
    expect(Math.abs(earned - (units * wood.sell) / 1000)).toBeLessThan(2);
    // O volume de hoje da madeira acabou, e a tela diz com a frase do servidor, com cadeado.
    const spent = after.market.prices.find((entry) => entry.resource === 'wood');
    expect(spent?.remainingToday).toBe(0);
    await expect(row(page, 'wood')).toContainText('Hoje não cabe mais nada.');
    await expect(form(page)).toContainText(spent?.sellBlockedReason ?? 'Hoje não cabe');

    // Mais do que cabe: a ordem segue, e quem recusa é o servidor, com a frase dele.
    await amount(page).fill('10');
    await form(page).getByTestId('trade-review').click();
    await form(page).getByTestId('trade-confirm-button').click();
    await expect(toasts(page)).toContainText('negocia', { timeout: 10_000 });
    await expect(toasts(page)).toContainText('de madeira por dia, entre compras e vendas');
    await expect.poll(() => posts.length).toBe(2);
    // A recusa não gastou nada: o ouro é o mesmo.
    expect((await gold(page, request)) - goldBefore).toBe(earned);
  });

  test('a virada do dia libera o volume', async ({ context, request, world }) => {
    const page = await world.open(context);
    await openMarket(world, page);
    const wood = (await serverView(page, request)).market.prices[1];
    await sell(page, 'wood', wood?.maxSellable ?? 1);
    await expect(row(page, 'wood')).toContainText('Hoje não cabe mais nada.');
    const day = (await serverView(page, request)).market.quoteDay;
    await world.passTime(26 * HOUR, page);
    const next = await serverView(page, request);
    expect(next.market.quoteDay).toBeGreaterThan(day);
    const freed = next.market.prices.find((entry) => entry.resource === 'wood');
    expect(freed?.remainingToday).toBeGreaterThan(0);
    await expect(row(page, 'wood')).toContainText(`Cabem mais ${freed?.remainingToday} hoje.`);
    await expect(row(page, 'wood')).toContainText(freed?.sellText ?? '');
  });

  test('o dia virou com a conferência aberta: o servidor recusa com PRICE_CHANGED, a tela mostra o preço novo e pede nova confirmação, sem reenviar sozinha', async ({
    context,
    request,
    world,
  }) => {
    const page = await world.open(context);
    await openMarket(world, page);
    const posts = commandPosts(page);
    const before = await serverView(page, request);
    await row(page, 'stone')
      .getByRole('button', { name: /^Vender/ })
      .click();
    await amount(page).fill('20');
    await form(page).getByTestId('trade-review').click();
    await expect(form(page).getByTestId('trade-confirm')).toBeVisible();

    // O dia vira no servidor, e a página (com o relógio parado) ainda não leu: a tela é a de ontem.
    await world.control('advance', { ms: 26 * HOUR });
    world.offsetMs += 26 * HOUR;
    await form(page).getByTestId('trade-confirm-button').click();
    await expect(toasts(page)).toContainText('O dia virou e o preço do Mercado mudou');
    // O token venceu com o salto do relógio do servidor: o cliente o renova e repete a MESMA
    // ordem (o mesmo commandId), e isso não é uma ordem nova.
    const orders = () => new Set(posts.map((post) => post.commandId)).size;
    await expect.poll(orders).toBe(1);
    expect(posts[0]).toMatchObject({
      type: 'trade',
      payload: { quoteDay: before.market.quoteDay, amount: 20 },
    });

    // A visão nova tomou a tela: o dia é o de hoje, e a ordem recomeça na conferência.
    const today = await serverView(page, request);
    expect(today.market.quoteDay).toBeGreaterThan(before.market.quoteDay);
    const stone = today.market.prices.find((entry) => entry.resource === 'stone');
    await expect(row(page, 'stone')).toContainText(stone?.sellText ?? '');
    await expect(form(page).getByTestId('trade-confirm')).toHaveCount(0);
    await expect(form(page).getByTestId('trade-review')).toBeEnabled();
    // Nada foi reenviado sozinho: continua uma ordem só, mesmo depois de a página reler.
    await page.waitForTimeout(500);
    expect(orders()).toBe(1);

    // O jogador confere de novo, vê o preço novo e confirma: agora vale, com o dia de hoje.
    await form(page).getByTestId('trade-review').click();
    await form(page).getByTestId('trade-confirm-button').click();
    await expect.poll(orders).toBe(2);
    const second = posts.at(-1);
    expect(second).toMatchObject({
      type: 'trade',
      payload: { quoteDay: today.market.quoteDay, amount: 20 },
    });
    expect(second?.commandId).not.toBe(posts[0]?.commandId);
    await expect
      .poll(async () => (await gameEvents(page, request)).filter((e) => e.type === 'marketTraded'))
      .toHaveLength(1);
  });

  test('o dia vira com a conferência aberta e a página lê: o preço novo aparece ao lado do que foi conferido, e a confirmação é pedida de novo', async ({
    context,
    request,
    world,
  }) => {
    const page = await world.open(context);
    await openMarket(world, page);
    const posts = commandPosts(page);
    await row(page, 'stone')
      .getByRole('button', { name: /^Vender/ })
      .click();
    await amount(page).fill('20');
    await form(page).getByTestId('trade-review').click();
    await expect(form(page).getByTestId('trade-confirm-button')).toBeVisible();
    // A página lê o dia novo com a conferência aberta.
    await world.passTime(26 * HOUR, page);
    await expect(form(page).getByTestId('trade-reconfirm')).toBeVisible();
    await expect(form(page).getByTestId('trade-confirm')).toContainText(
      'O preço mudou enquanto você conferia',
    );
    await expect(form(page).getByTestId('trade-confirm-button')).toHaveCount(0);
    expect(posts).toEqual([]);
    await form(page).getByTestId('trade-reconfirm').click();
    await form(page).getByTestId('trade-confirm-button').click();
    await expect.poll(() => posts.length).toBe(1);
    const view = await serverView(page, request);
    expect(posts[0]).toMatchObject({ payload: { quoteDay: view.market.quoteDay } });
  });

  test('o duplo clique em "Confirmar" vende uma vez', async ({ context, world }) => {
    const page = await world.open(context);
    await openMarket(world, page);
    const posts = commandPosts(page);
    await row(page, 'wood')
      .getByRole('button', { name: /^Vender/ })
      .click();
    await amount(page).fill('30');
    await form(page).getByTestId('trade-review').click();
    // Dois cliques no mesmo instante, antes de a página redesenhar: uma ordem só.
    await form(page)
      .getByTestId('trade-confirm-button')
      .evaluate((button: HTMLButtonElement) => {
        button.click();
        button.click();
      });
    await expect.poll(() => posts.length).toBe(1);
    await page.waitForTimeout(500);
    expect(posts).toHaveLength(1);
    // E o duplo clique de verdade, em outra venda: também uma ordem.
    await amount(page).fill('20');
    await form(page).getByTestId('trade-review').click();
    await form(page).getByTestId('trade-confirm-button').dblclick();
    await page.waitForTimeout(500);
    expect(posts).toHaveLength(2);
  });
});

test.describe('as caravanas (V3E-T4.3; critério 5)', () => {
  /** O Mercado no nível 2, com carga no depósito e a semente do desfecho. */
  async function roadOpen(world: World, context: BrowserContext, seed: string, tower = 0) {
    world.seed(seed);
    const fresh = await world.open(context);
    await openMarket(world, fresh, { level: 2 });
    if (tower > 0) {
      await world.raise('watchtower', tower);
    }
    await world.stock('wood', 800);
    await world.stock('food', 400);
    await world.passTime(MINUTE, fresh);
    return fresh;
  }

  test('sem escolta: o preço fixado, a viagem e o risco com a conta aparecem antes de confirmar; ela fica na estrada e chega inteira', async ({
    context,
    request,
    world,
  }) => {
    const page = await roadOpen(world, context, 'estrada-e2e', 1);
    const view = await serverView(page, request);
    const offer = view.market.caravanOffer;
    expect(offer.available).toBe(true);
    const cargo = offer.resources.find((entry) => entry.resource === 'wood');
    if (cargo === undefined) {
      throw new Error('O cenário esperava a madeira.');
    }
    const posts = commandPosts(page);
    const send = caravanForm(page);
    await expect(send).toContainText(offer.priceRatioText);
    await expect(send).toContainText(offer.riskText);
    await expect(send).toContainText(offer.lossText);
    await expect(send.locator('[data-tip]').filter({ hasText: offer.riskText })).toHaveAttribute(
      'data-tip',
      offer.riskBreakdown,
    );
    await send.locator('input[data-resource="wood"]').check();
    await send.getByTestId('caravan-amount').fill('240');
    await expect(send.getByTestId('caravan-total')).toContainText('Rende');
    await expect(send.getByTestId('caravan-total')).toContainText('se chegar inteira');
    await send.getByTestId('caravan-review').click();
    await expect(send.getByTestId('caravan-confirm')).toContainText(
      `Mandar 240 de madeira a ${offer.destination}`,
    );
    await expect(send.getByTestId('caravan-confirm')).toContainText(
      `${cargo.unitPriceText} de ouro a unidade`,
    );
    expect(posts).toEqual([]);
    await send.getByTestId('caravan-confirm-button').click();
    await expect.poll(() => posts.length).toBe(1);
    expect(posts[0]).toMatchObject({
      type: 'sendCaravan',
      payload: {
        resource: 'wood',
        amount: 240,
        escortHeroId: null,
        quoteDay: view.market.quoteDay,
      },
    });

    // Em trânsito: a linha da estrada, com o destino, a carga e a chegada; a estrada cheia diz por quê.
    const line = caravans(page).locator('[data-caravan="caravan-1"]');
    await expect(line).toContainText(`Caravana a ${offer.destination} · 240 de madeira · chega em`);
    await expect(caravans(page).getByTestId('caravan-blocked')).toBeVisible();
    await expect(tree(page).getByRole('treeitem', { name: /Caravana a/ })).toContainText(
      '240 de madeira',
    );
    const road = await serverView(page, request);
    const sent = road.market.caravans[0];
    expect(sent?.cargoText).toBe('240 de madeira');
    // O desfecho não está na visão nem nos eventos antes da chegada: só o risco, que é o de agora.
    expect(JSON.stringify(road.market.caravans)).not.toMatch(/ambush|emboscad|lost|perd/i);
    const early = (await gameEvents(page, request)).map((event) => event.type);
    expect(early).toContain('caravanSent');
    expect(early).not.toContain('caravanArrived');
    expect(early).not.toContain('caravanAmbushed');

    await world.passTime(5 * HOUR, page);
    const arrived = (await gameEvents(page, request)).filter((e) => e.type === 'caravanArrived');
    expect(arrived).toHaveLength(1);
    await expect(caravans(page).locator('[data-caravan]')).toHaveCount(0);
    await expect(toasts(page)).not.toContainText('emboscada');
  });

  test('com escolta: o herói escolhido sai do feudo até a chegada, e a caravana chega inteira', async ({
    context,
    request,
    world,
  }) => {
    world.seed('qa-10-32');
    const page = await world.open(context);
    await openMarket(world, page, { level: 2 });
    await world.hero('Edda');
    await world.stock('wood', 800);
    await world.passTime(MINUTE, page);
    const view = await serverView(page, request);
    expect(view.market.caravanOffer.eligibleEscortIds).toHaveLength(1);
    const posts = commandPosts(page);
    const send = caravanForm(page);
    // Só quem a visão lista aparece como escolta, e "Sem escolta" vem marcado.
    await expect(send.locator('input[data-escort="none"]')).toBeChecked();
    await send.locator('input[data-escort]:not([data-escort="none"])').check();
    await send.locator('input[data-resource="wood"]').check();
    await send.getByTestId('caravan-amount').fill('251');
    await send.getByTestId('caravan-review').click();
    await expect(send.getByTestId('caravan-confirm')).toContainText('Escolta: Edda');
    await send.getByTestId('caravan-confirm-button').click();
    await expect.poll(() => posts.length).toBe(1);
    expect(posts[0]).toMatchObject({
      payload: { amount: 251, escortHeroId: view.market.caravanOffer.eligibleEscortIds[0] },
    });
    // A semente que emboscaria a caravana sem escolta: com Edda, ela chega inteira.
    await expect(caravans(page).locator('[data-caravan="caravan-1"]')).toContainText(
      'Escolta: Edda',
    );
    await world.passTime(5 * HOUR, page);
    const events = await gameEvents(page, request);
    expect(events.filter((e) => e.type === 'caravanAmbushed')).toEqual([]);
    expect(events.filter((e) => e.type === 'caravanArrived')).toHaveLength(1);
  });

  test('uma emboscada: sem escolta, a semente fixa perde metade da carga; o aviso é essencial e a Crônica e o retorno contam', async ({
    context,
    request,
    world,
  }) => {
    world.seed('qa-10-32');
    const page = await world.open(context);
    await openMarket(world, page, { level: 2 });
    await world.stock('wood', 800);
    await world.passTime(MINUTE, page);
    const send = caravanForm(page);
    await send.locator('input[data-resource="wood"]').check();
    await send.getByTestId('caravan-amount').fill('251');
    await send.getByTestId('caravan-review').click();
    await send.getByTestId('caravan-confirm-button').click();
    await expect(caravans(page).locator('[data-caravan="caravan-1"]')).toBeVisible();
    await world.passTime(5 * HOUR, page);

    const events = await gameEvents(page, request);
    const [hit] = events.filter((e) => e.type === 'caravanAmbushed');
    expect(events.filter((e) => e.type === 'caravanArrived')).toEqual([]);
    expect(hit?.data).toMatchObject({ amount: 251, lost: 125, sold: 126 });
    // A emboscada é aviso essencial, com a frase da Crônica, e o botão leva à aba Mercado.
    await expect(toasts(page)).toContainText('caiu em uma emboscada');
    await expect(toasts(page)).toContainText('levaram 125 de madeira');
    // A estrada ficou livre, e a tela diz o que o motor disse.
    await expect(caravans(page).locator('[data-caravan]')).toHaveCount(0);
    await expect(caravanForm(page)).toBeVisible();
  });
});

test.describe('o Relatório de Retorno depois da estrada (V3E-T4.5)', () => {
  test('a emboscada custou: está em "O que exigiu um preço" com o botão das caravanas, e o ouro da venda é recebido, não produção', async ({
    context,
    request,
    world,
  }) => {
    world.seed('qa-10-32');
    const first = await world.open(context);
    await openMarket(world, first, { level: 2 });
    await world.stock('wood', 800);
    await world.passTime(MINUTE, first);
    // Uma venda direta, para o ouro dela também ser recebido, e a caravana sem escolta.
    await sell(first, 'stone', 100);
    await expect
      .poll(
        async () =>
          (await gameEvents(first, request)).filter((e) => e.type === 'marketTraded').length,
      )
      .toBe(1);
    const send = caravanForm(first);
    await send.locator('input[data-resource="wood"]').check();
    await send.getByTestId('caravan-amount').fill('251');
    await send.getByTestId('caravan-review').click();
    await send.getByTestId('caravan-confirm-button').click();
    await expect(caravans(first).locator('[data-caravan="caravan-1"]')).toBeVisible();
    await first.close();

    await world.passTime(6 * HOUR);
    const page = await world.open(context);
    const today = page.getByRole('tabpanel', { name: 'Hoje' });
    await expect(today.getByText(/Você esteve fora por 6 horas/)).toBeVisible();
    const cost = today.getByRole('region', { name: /^O que exigiu um preço/ });
    await expect(cost).toContainText('caiu em uma emboscada');
    await expect(cost).toContainText('levaram 125 de madeira');
    await cost.getByRole('button', { name: 'Ver as caravanas' }).click();
    await expect(page.getByRole('tab', { name: 'Mercado' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(caravans(page)).toBeVisible();

    // A tabela de estoques da ausência: o ouro da caravana que chegou é "Recebido", e a carga
    // (que saiu antes da ausência) não aparece como produção nem como perda da madeira.
    await page.getByRole('tab', { name: 'Hoje' }).click();
    const table = today.getByRole('table', { name: /O saldo dos estoques/ });
    const goldCells = table.getByRole('row', { name: /^Ouro/ }).getByRole('cell');
    await expect(goldCells.nth(3)).toContainText('+179,9');
    await expect(goldCells.nth(1)).not.toContainText('179');
    const woodCells = table.getByRole('row', { name: /^Madeira/ }).getByRole('cell');
    await expect(woodCells.nth(1)).toHaveText('0');
    await expect(woodCells.nth(4)).toHaveText('—');
  });
});

test.describe('os Mestres (V3E-T4.4)', () => {
  test('mover um Mestre mostra o que muda antes de confirmar; ele se adapta, e depois a conta da produção traz o bônus', async ({
    context,
    request,
    world,
  }) => {
    const page = await world.open(context);
    await playNow(page);
    await world.master('odo');
    await world.passTime(MINUTE, page);
    const view = await serverView(page, request);
    expect(view.masters).toHaveLength(1);
    const odo = view.masters[0];
    if (odo === undefined) {
      throw new Error('O cenário esperava um Mestre.');
    }
    // O Mestre livre aparece no painel dos trabalhadores, com as regras do servidor à vista.
    const fief = page.getByRole('tabpanel', { name: 'Feudo' });
    const workers = fief.getByRole('region', { name: /^Trabalhadores/ });
    await expect(workers).toContainText(view.workersRules.masterText);
    await expect(workers).toContainText(`${odo.name}: ${odo.buildingLabel.toLowerCase()}.`);
    const posts = commandPosts(page);
    await workers.getByRole('button', { name: /^Alocar Mestre/ }).click();
    // A lista dos edifícios diz o que cada um renderia, durante a adaptação e depois dela.
    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText(`Mover ${odo.name}`);
    const farm = odo.options.find((option) => option.building === 'farm');
    await expect(dialog).toContainText(`Fazenda Nv1: +`);
    await expect(dialog).toContainText(
      `+${farm?.gainPerHour.toString().replace('.', ',').slice(0, 2)}`,
    );
    await dialog.getByText('Fazenda', { exact: true }).first().click();
    // A confirmação repete as regras do Mestre: o bônus e a adaptação.
    await expect(page.getByRole('dialog')).toContainText(`Mover ${odo.name} para Fazenda?`);
    await expect(page.getByRole('dialog')).toContainText(view.workersRules.masterText);
    expect(posts).toEqual([]);
    await page.getByRole('dialog').getByRole('button', { name: 'Mover' }).click();
    await expect.poll(() => posts.length).toBe(1);
    expect(posts[0]).toMatchObject({
      type: 'assignMaster',
      payload: { masterId: odo.id, building: 'farm' },
    });
    // Na Fazenda, em adaptação: a linha diz que ainda não dá o bônus.
    await expect(workers.locator(`[data-master="${odo.id}"]`)).toContainText('em adaptação');
    await expect(workers.locator(`[data-master="${odo.id}"]`)).toContainText('ainda sem o bônus');

    // Passada a adaptação, o bônus vale e a conta da produção o diz, termo a termo.
    await world.passTime(26 * HOUR, page);
    await expect(workers.locator(`[data-master="${odo.id}"]`)).toContainText('+15% na produção');
    const farmRate = workers
      .locator('li.worker')
      .filter({ hasText: 'Fazenda' })
      .locator('[data-tip]')
      .first();
    await expect(farmRate).toHaveAttribute('data-tip', new RegExp(odo.name));
    // O Mestre sai da lista dos livres e a árvore o diz.
    await expect(tree(page).getByRole('treeitem', { name: new RegExp(odo.name) })).toContainText(
      'Fazenda',
    );
    const moved = await gameEvents(page, request);
    expect(moved.filter((e) => e.type === 'masterAssigned')).toHaveLength(1);
  });
});

test.describe('o atalho "Vender" (IDEIA-11)', () => {
  test('o depósito que enche leva a saída ao lado: "Vender até N", com o que cabe no volume de hoje', async ({
    context,
    request,
    world,
  }) => {
    const page = await world.open(context);
    await openMarket(world, page, { level: 1 });
    // A madeira perto do limite do depósito, e a Serraria produzindo: "cheio em ...".
    const start = await serverView(page, request);
    const wood = start.resources.find((entry) => entry.id === 'wood');
    await page.getByRole('tab', { name: 'Feudo' }).click();
    // Dois aldeões na Serraria: a madeira cresce, e o depósito enche em poucas horas.
    const more = page.getByRole('button', { name: 'Pôr mais um trabalhador em Serraria' });
    await more.click();
    await more.click();
    await world.stock('wood', (wood?.cap ?? 1000) - 20);
    await world.passTime(MINUTE, page);
    const view = await serverView(page, request);
    const price = view.market.prices.find((entry) => entry.resource === 'wood');
    const shortcut = page.getByRole('tabpanel', { name: 'Feudo' }).locator('[data-sell="wood"]');
    await expect(shortcut).toContainText(`Vender até ${price?.maxSellable}`);
    const posts = commandPosts(page);
    await shortcut.click();
    // Pede só a confirmação, com o total; nada sai antes dela.
    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText(`Vender ${price?.maxSellable} de madeira por`);
    expect(posts).toEqual([]);
    await dialog.getByRole('button', { name: 'Vender' }).click();
    await expect.poll(() => posts.length).toBe(1);
  });
});

test.describe('só com o teclado, nos três temas e em 720 px (V3E-T4.6; QA-15)', () => {
  test('a negociação inteira pelo teclado: aba, linha, quantidade, revisão e confirmação', async ({
    context,
    request,
    world,
  }) => {
    const page = await world.open(context);
    await openMarket(world, page);
    const posts = commandPosts(page);
    const wood = row(page, 'wood').getByRole('button', { name: /^Vender/ });
    await wood.focus();
    await page.keyboard.press('Enter');
    await expect(amount(page)).toBeFocused();
    await page.keyboard.type('15');
    await expect(form(page).getByTestId('trade-total')).toContainText('Vender 15 de madeira por');
    await page.keyboard.press('Enter');
    await expect(form(page).getByTestId('trade-confirm')).toBeVisible();
    // O foco segue pelos botões da conferência: Tab até "Confirmar", Enter.
    await form(page).getByTestId('trade-confirm-button').focus();
    await page.keyboard.press('Enter');
    await expect.poll(() => posts.length).toBe(1);
    expect(await gold(page, request)).toBeGreaterThan(1000);

    // A paleta chega ao mesmo fluxo, sem o mouse: recurso, sentido, quantidade e confirmação.
    await palette(page, 'Comprar ou vender no Mercado');
    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText('Comprar ou vender no Mercado');
    await page.keyboard.press('Enter');
    await expect(dialog).toContainText('Comprar ou vender');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await expect(page.getByRole('dialog')).toContainText('Total:');
    await page.keyboard.press('Enter');
    await expect(page.getByRole('dialog')).toContainText('de ouro?');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');
    await expect.poll(() => posts.length).toBe(2);
  });

  test('o Mercado e as caravanas se leem nos três temas, sem rolagem lateral e sem contraste baixo, e em 720 px', async ({
    context,
    request,
    world,
  }) => {
    world.seed('estrada-e2e');
    const page = await world.open(context);
    await openMarket(world, page, { level: 2 });
    await world.hero('Edda');
    await world.stock('wood', 800);
    await world.passTime(MINUTE, page);
    expect((await serverView(page, request)).market.caravanOffer.available).toBe(true);
    for (const theme of THEMES) {
      await applyTheme(page, theme);
      await expect(prices(page)).toBeVisible();
      // O formulário aberto: o total e a conferência também passam no contraste.
      await row(page, 'food')
        .getByRole('button', { name: /^Comprar/ })
        .click();
      await amount(page).fill('5');
      await form(page).getByTestId('trade-review').click();
      await expect(form(page).getByTestId('trade-confirm')).toBeVisible();
      expect(await lowContrast(page), `contraste no tema ${theme}`).toEqual([]);
      expect(await overflow(page)).toEqual({ page: 0, content: 0 });
    }
    await page.setViewportSize({ width: 720, height: 900 });
    await expect(prices(page)).toBeVisible();
    expect(await overflow(page)).toEqual({ page: 0, content: 0 });
    expect(await lowContrast(page)).toEqual([]);
    await page.setViewportSize({ width: 1280, height: 720 });
  });

  test('sem ligação, o Mercado é leitura: os botões ficam desabilitados e a tela diz por quê', async ({
    context,
    world,
  }) => {
    const page = await world.open(context);
    await openMarket(world, page);
    await context.setOffline(true);
    await world.jump(31_000, page);
    await expect(market(page)).toContainText('Sem ligação com o reino');
    await expect(row(page, 'wood').getByRole('button', { name: /^Vender/ })).toBeDisabled();
    await context.setOffline(false);
  });
});
