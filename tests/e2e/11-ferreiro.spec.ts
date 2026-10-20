import type { APIRequestContext, Page } from '@playwright/test';

import {
  applyTheme,
  expect,
  HOUR,
  lowContrast,
  MINUTE,
  overflow,
  palette,
  playNow,
  serverView,
  test,
  THEMES,
  tree,
  type World,
} from './helpers';

// V4B-T4 (GDD §6.1 e §13.1 a §13.6; ADR 0019, decisão 4): o Ferreiro na interface. O painel da aba
// Feudo mostra a obra quando ele não existe e, de pé, a forja em duas etapas ("Revisar a forja" e
// "Confirmar"); com um lote na forja, quando termina e "Cancelar (devolve N%)". Tudo é conferido
// pelo teclado, e o que a tela diz do custo e do prazo é o que o servidor mandou na visão.
//
// O Ferreiro é posto de pé e o ferro é posto no estoque pelas rotas de teste (`world.raise`,
// `world.stock`); daí em diante a cobrança, o prazo, o cancelamento e a chegada das armas são
// os do motor.

const fiefPanel = (page: Page) => page.getByRole('tabpanel', { name: 'Feudo' });
const smithy = (page: Page) => fiefPanel(page).getByRole('region', { name: 'Ferreiro' });
const form = (page: Page) => smithy(page).getByRole('form', { name: 'Forjar armas' });
const amount = (page: Page) => form(page).getByTestId('forge-amount');
const running = (page: Page) => smithy(page).getByTestId('smithy-running');

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

/** O estoque de um recurso, lido do servidor, em unidades. */
async function stockOf(page: Page, request: APIRequestContext, id: string): Promise<number> {
  const view = await serverView(page, request);
  return view.resources.find((entry) => entry.id === id)?.stock ?? 0;
}

/** Funda o feudo e o põe de pé com o Ferreiro e o ferro e a madeira postos. */
async function openSmithy(world: World, page: Page, { iron = 100, wood = 700 } = {}) {
  await playNow(page);
  await world.raise('smithy', 1);
  await world.stock('iron', iron);
  await world.stock('wood', wood);
  await world.passTime(MINUTE, page);
  await expect(form(page)).toBeVisible();
}

test.describe('o painel do Ferreiro (V4B-T4.3)', () => {
  test('sem o Ferreiro o painel diz como erguê-lo: a frase e a obra do servidor, com o botão travado', async ({
    context,
    request,
    world,
  }) => {
    const page = await world.open(context);
    await playNow(page);
    const view = await serverView(page, request);
    await expect(smithy(page)).toContainText(view.smithy.text);
    await expect(form(page)).toHaveCount(0);
    // O Salão ainda não chegou ao nível que a obra pede: a frase do servidor diz por quê.
    const work = view.constructions.available.find((entry) => entry.building === 'smithy');
    expect(work?.blockedReason).not.toBeNull();
    await expect(smithy(page)).toContainText(work?.blockedReason ?? '');
    await expect(smithy(page).getByRole('button', { name: /Construir Ferreiro/ })).toBeDisabled();
  });

  test('forjar pelo teclado: a quantidade, Enter revisa com o custo e o prazo, Enter confirma; o servidor cobra o que a tela disse', async ({
    context,
    request,
    world,
  }) => {
    const page = await world.open(context);
    await openSmithy(world, page);
    const posts = commandPosts(page);
    const before = await serverView(page, request);
    const option = before.smithy.offer.options[2];
    expect(option?.amount).toBe(3);

    await amount(page).focus();
    await page.keyboard.type('3');
    // O total da conferência é a frase do servidor para um lote de 3.
    await expect(form(page).getByTestId('forge-total')).toContainText('Forjar 3 armas');
    await expect(form(page).getByTestId('forge-total')).toContainText(option?.costText ?? '?');
    await page.keyboard.press('Enter');
    await expect(form(page).getByTestId('forge-confirm')).toBeVisible();
    // Nada foi enviado ainda, e o foco foi para "Confirmar".
    expect(posts).toEqual([]);
    await expect(form(page).getByTestId('forge-confirm-button')).toBeFocused();
    await page.keyboard.press('Enter');
    await expect.poll(() => posts.length).toBe(1);
    expect(posts[0]).toMatchObject({ type: 'forgeWeapons', payload: { amount: 3 } });

    // A forja mostra o lote, quando termina e o botão de cancelar com o que devolve.
    await expect(running(page)).toBeVisible();
    await expect(running(page)).toContainText('Forjando 3');
    await expect(running(page).getByTestId('smithy-ends')).toContainText('termina em');
    const after = await serverView(page, request);
    expect(after.smithy.forge?.amount).toBe(3);
    await expect(running(page)).toContainText(after.smithy.forge?.refundText ?? '?');
    await expect(running(page).getByTestId('smithy-cancel')).toHaveText(
      after.smithy.forge?.cancelLabel ?? '?',
    );
    // O ferro que o servidor cobrou é o da frase que a tela mostrou.
    const iron = Number(/(\d+) de ferro/.exec(option?.costText ?? '')?.[1]);
    expect(before.resources.find((row) => row.id === 'iron')?.stock).toBe(100);
    expect(await stockOf(page, request, 'iron')).toBe(100 - iron);
    // Um lote por vez: a forma de forjar saiu da tela.
    await expect(form(page)).toHaveCount(0);

    // No fim do prazo as armas entram, e a forja fica livre.
    await world.passTime(2 * HOUR, page);
    const done = await serverView(page, request);
    expect(done.smithy.forge).toBeNull();
    expect(done.smithy.weapons).toBe(3);
    await expect(smithy(page).getByTestId('smithy-weapons')).toContainText('3');
    await expect(form(page)).toBeVisible();
  });

  test('cancelar o lote devolve o que a visão disse, e a forja fica livre', async ({
    context,
    request,
    world,
  }) => {
    const page = await world.open(context);
    await openSmithy(world, page);
    const posts = commandPosts(page);
    await amount(page).fill('4');
    await form(page).getByTestId('forge-review').click();
    await form(page).getByTestId('forge-confirm-button').click();
    await expect(running(page)).toBeVisible();
    const forging = await serverView(page, request);
    const ironWhile = forging.resources.find((row) => row.id === 'iron')?.stock ?? 0;
    const refundText = forging.smithy.forge?.refundText ?? '';
    const refundedIron = Number(/(\d+) de ferro/.exec(refundText)?.[1]);

    await running(page).getByTestId('smithy-cancel').focus();
    await page.keyboard.press('Enter');
    await expect.poll(() => posts.filter((post) => post.type === 'cancelForge').length).toBe(1);
    await expect(running(page)).toHaveCount(0);
    await expect(form(page)).toBeVisible();
    const after = await serverView(page, request);
    expect(after.smithy.forge).toBeNull();
    expect(after.smithy.weapons).toBe(0);
    // O ferro voltou na parte que a frase prometia.
    expect((after.resources.find((row) => row.id === 'iron')?.stock ?? 0) - ironWhile).toBe(
      refundedIron,
    );
  });

  test('"O máximo que o estoque paga" preenche a quantidade; com o estoque pobre a tela trava a revisão', async ({
    context,
    request,
    world,
  }) => {
    const page = await world.open(context);
    await openSmithy(world, page, { iron: 7, wood: 700 });
    const view = await serverView(page, request);
    // 7 de ferro pagam 3 armas (2 por arma).
    expect(view.smithy.offer.maxAmount).toBe(3);
    await form(page).getByTestId('forge-max').click();
    await expect(amount(page)).toHaveValue('3');
    await amount(page).fill('4');
    await expect(form(page)).toContainText('O estoque não paga este lote.');
    await expect(form(page).getByTestId('forge-review')).toBeDisabled();
  });

  test('a paleta e a árvore chegam à mesma forja, sem o mouse: lista de lotes, confirmação, ordem', async ({
    context,
    request,
    world,
  }) => {
    const page = await world.open(context);
    await openSmithy(world, page);
    const posts = commandPosts(page);
    // A árvore tem a linha do Ferreiro, com o botão "Forjar" e o custo na dica.
    await expect(tree(page).getByRole('treeitem', { name: /^Ferreiro/ })).toContainText('Nv1');

    await palette(page, 'Forjar armas');
    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText('Forjar armas');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await expect(page.getByRole('dialog')).toContainText('Forjar 2 armas');
    // A confirmação começa no botão que desiste: Tab leva ao que forja.
    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');
    await expect.poll(() => posts.length).toBe(1);
    expect(posts[0]).toMatchObject({ type: 'forgeWeapons', payload: { amount: 2 } });
    await expect(running(page)).toBeVisible();
    await expect(tree(page).getByRole('treeitem', { name: /^Ferreiro/ })).toContainText(
      'forjando 2',
    );

    // Cancelar pela paleta: confirma com o que devolve.
    await palette(page, 'Cancelar a forja');
    await expect(page.getByRole('dialog')).toContainText('Cancelar devolve');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');
    await expect.poll(() => posts.filter((post) => post.type === 'cancelForge').length).toBe(1);
    await expect(form(page)).toBeVisible();
    expect((await serverView(page, request)).smithy.forge).toBeNull();
  });

  test('o fim do lote aparece sem recarregar: a leitura espera o prazo, e "Antes de partir" lembra a forja parada', async ({
    context,
    request,
    world,
  }) => {
    const page = await world.open(context);
    await openSmithy(world, page);
    await amount(page).fill('1');
    await form(page).getByTestId('forge-review').click();
    await form(page).getByTestId('forge-confirm-button').click();
    await expect(running(page)).toBeVisible();
    await world.passTime(HOUR, page);
    await expect(running(page)).toHaveCount(0);
    expect((await serverView(page, request)).smithy.weapons).toBe(1);
    // Com ferro no estoque e o lote entregue, a aba Hoje lembra da forja parada.
    await page.getByRole('tab', { name: 'Hoje' }).click();
    await expect(page.getByRole('tabpanel', { name: 'Hoje' })).toContainText(
      'O Ferreiro está parado',
    );
  });

  test('o painel se lê nos três temas, sem rolagem lateral e sem contraste baixo, e em 720 px', async ({
    context,
    world,
  }) => {
    const page = await world.open(context);
    await openSmithy(world, page);
    for (const theme of THEMES) {
      await applyTheme(page, theme);
      await amount(page).fill('2');
      await form(page).getByTestId('forge-review').click();
      await expect(form(page).getByTestId('forge-confirm')).toBeVisible();
      expect(await lowContrast(page), `contraste no tema ${theme}`).toEqual([]);
      expect(await overflow(page)).toEqual({ page: 0, content: 0 });
    }
    await page.setViewportSize({ width: 720, height: 900 });
    await expect(smithy(page)).toBeVisible();
    expect(await overflow(page)).toEqual({ page: 0, content: 0 });
    expect(await lowContrast(page)).toEqual([]);
    await page.setViewportSize({ width: 1280, height: 720 });
  });

  test('sem ligação o painel é leitura: os botões ficam desabilitados', async ({
    context,
    world,
  }) => {
    const page = await world.open(context);
    await openSmithy(world, page);
    await context.setOffline(true);
    await world.jump(31_000, page);
    await expect(form(page).getByTestId('forge-max')).toBeDisabled();
    await expect(form(page).getByTestId('forge-review')).toBeDisabled();
    await context.setOffline(false);
  });
});

test.describe('no ritmo da produção', () => {
  // Roda no servidor de ritmo 1 e também com `GAME_TIME_SCALE=3 pnpm test:e2e 11-ferreiro -g
  // "ritmo"`, que sobe o servidor como o da produção; o feudo nasce no Rápido nos dois casos.
  test('ritmo Rápido: o prazo do lote na tela é o da API, em tempo de relógio, e as armas chegam na hora anunciada', async ({
    context,
    request,
    world,
  }) => {
    const page = await world.open(context);
    await page
      .getByRole('tabpanel', { name: 'Boas-vindas' })
      .getByRole('radiogroup', { name: 'Ritmo' })
      .getByRole('radio', { name: /^Rápido/ })
      .check();
    await openSmithy(world, page);
    const before = await serverView(page, request);
    expect(before.settlement.paceLabel).toBe('Rápido: um ano em 56 horas');
    // Uma arma leva 6 min de jogo no Ferreiro Nv1: no Rápido, 2 min de relógio. A visão já vem
    // em tempo real, e a tela não converte de novo.
    expect(before.smithy.perWeaponSeconds).toBe(120);

    await amount(page).fill('1');
    await form(page).getByTestId('forge-review').click();
    await form(page).getByTestId('forge-confirm-button').click();
    await expect(running(page)).toContainText('Forjando 1');
    const started = (await serverView(page, request)).smithy.forge;
    expect(started?.endsInSeconds).toBeGreaterThan(100);
    expect(started?.endsInSeconds).toBeLessThanOrEqual(120);

    // Um minuto de relógio depois, o lote continua. Convertido duas vezes, já teria acabado.
    await world.passTime(MINUTE, page);
    const later = (await serverView(page, request)).smithy.forge;
    expect(later?.endsInSeconds).toBeGreaterThan(40);
    expect(later?.endsInSeconds).toBeLessThanOrEqual(60);
    await expect(running(page)).toContainText('Forjando 1');

    // Passados os 2 min anunciados, a arma chegou. Sem conversão nenhuma, levaria 6 min.
    await world.passTime(MINUTE + 1_000, page);
    const done = await serverView(page, request);
    expect(done.smithy.forge).toBeNull();
    expect(done.smithy.weapons).toBe(1);
    await expect(smithy(page).getByTestId('smithy-weapons')).toContainText('1');
  });
});
