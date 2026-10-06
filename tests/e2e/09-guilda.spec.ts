import { randomUUID } from 'node:crypto';

import type { APIRequestContext, Page } from '@playwright/test';

import {
  applyTheme,
  cutTreeRows,
  expect,
  fief,
  gameEvents,
  HOUR,
  lowContrast,
  MINUTE,
  overflow,
  palette,
  playNow,
  resourceRow,
  serverView,
  session,
  statusBar,
  test,
  THEMES,
  toasts,
  tree,
  type World,
} from './helpers';

// V3C-T2 e V3C-T4 (GDD §6.1, §9.1 e §13.1 a §13.6; ADR 0017, decisões 3 a 6 e 10): a Guilda e a
// Taverna na interface. Critério 1 do GDD §16.2 em navegador: o primeiro herói chega pela carta
// da estrangeira, respondida na aba Conselho, e aparece na aba Guilda com o soldo correndo.
//
// Os candidatos da Taverna saem do sorteio, que depende da semente: os testes não citam nome
// nem preço. Leem do servidor quem está à mesa e conferem que a tela mostra o que ele mandou.
// A Taverna é posta de pé e o ouro é posto no cofre pelas rotas de teste (`world.raise`,
// `world.stock`); daí em diante a rotação, o preço, o soldo e o atraso são os do motor.

const guildTab = (page: Page) => page.getByRole('tab', { name: 'Guilda' });
const guild = (page: Page) => page.getByRole('tabpanel', { name: 'Guilda' });
const heroes = (page: Page) => guild(page).getByRole('region', { name: /^Heróis/ });
const tavern = (page: Page) => guild(page).getByRole('region', { name: 'Taverna' });
const team = (page: Page) => heroes(page).getByRole('list', { name: 'A equipe' });
const candidates = (page: Page) => tavern(page).getByRole('list', { name: 'Candidatos' });

/** As ordens (`POST …/commands`) que a página mandar daqui em diante, na ordem em que saem. */
function commandPosts(page: Page): Array<{ type: string; commandId: string }> {
  const sent: Array<{ type: string; commandId: string }> = [];
  page.on('request', (outgoing) => {
    if (outgoing.method() === 'POST' && outgoing.url().endsWith('/commands')) {
      sent.push(outgoing.postDataJSON() as { type: string; commandId: string });
    }
  });
  return sent;
}

/** Os eventos de um tipo, na ordem em que aconteceram. */
async function eventsOf(page: Page, request: APIRequestContext, type: string) {
  return (await gameEvents(page, request)).filter((event) => event.type === type);
}

/**
 * Funda o feudo e põe a Taverna de pé no nível pedido, com ouro no cofre: os candidatos chegam
 * na leitura seguinte, sorteados pelo motor. Devolve a visão do servidor, já com eles.
 */
async function openTavern(
  world: World,
  page: Page,
  request: APIRequestContext,
  { level = 1, gold = 900 }: { level?: number; gold?: number } = {},
) {
  await playNow(page);
  await world.raise('townHall', 3);
  await world.raise('tavern', level);
  await world.stock('gold', gold);
  await world.passTime(MINUTE, page);
  const view = await serverView(page, request);
  expect(view.tavern.level).toBe(level);
  expect(view.tavern.offers.length).toBeGreaterThan(0);
  return view;
}

/** O ouro do cofre, lido do servidor, em unidades inteiras. */
async function gold(page: Page, request: APIRequestContext): Promise<number> {
  const view = await serverView(page, request);
  return view.resources.find((row) => row.id === 'gold')?.stock ?? 0;
}

test.describe('a Taverna no servidor de teste', () => {
  test('a obra aparece presa ao Salão; posta de pé, a Taverna tem candidatos, e contratar pela API põe o herói na visão', async ({
    context,
    world,
    request,
  }) => {
    const page = await world.open(context);
    await playNow(page);
    // A obra da Taverna está na lista desde o começo, com o que a libera.
    const listed = fief(page)
      .getByRole('region', { name: 'Construções' })
      .getByRole('listitem')
      .filter({ hasText: 'Taverna' });
    await expect(listed).toContainText('Melhore antes o Salão do Senhor para o nível 3.');
    const before = await serverView(page, request);
    expect(before.tavern).toMatchObject({ level: 0, offers: [], nextRotationInSeconds: null });
    expect(before.guild.heroLimit).toBe(1);

    await world.raise('townHall', 3);
    await world.raise('tavern', 1);
    await world.stock('gold', 900);
    await world.passTime(MINUTE, page);
    const open = await serverView(page, request);
    expect(open.tavern.level).toBe(1);
    expect(open.tavern.offers).toHaveLength(2);
    expect(open.tavern.nextRotationInSeconds).toBeGreaterThan(0);
    expect(open.guild.heroLimit).toBe(2);
    const [offer] = open.tavern.offers;
    if (offer === undefined) {
      throw new Error('O cenário esperava um candidato.');
    }
    expect(offer.blockedReason).toBeNull();

    const { url, headers } = await session(page);
    const command = {
      commandId: randomUUID(),
      type: 'hireHero',
      payload: { offerId: offer.offerId },
    };
    const hired = await request.post(`${url}/commands`, { headers, data: command });
    expect(hired.status()).toBe(200);
    // O duplo envio devolve o recibo: um herói só.
    const again = await request.post(`${url}/commands`, { headers, data: command });
    expect(again.status()).toBe(200);
    expect(again.headers()['x-lords-replayed']).toBe('true');
    await world.passTime(MINUTE, page);
    const after = await serverView(page, request);
    expect(after.guild.heroes.map((hero) => hero.name)).toEqual([offer.name]);
    expect(after.tavern.offers).toHaveLength(1);
    // O herói contratado por fora (outro navegador, a API) aparece na aba Guilda.
    await guildTab(page).click();
    await expect(team(page).getByRole('listitem')).toContainText([offer.name]);
    expect(world.problems).toEqual([]);
  });
});

test.describe('a Guilda na interface', () => {
  test('critério 1: a estrangeira ferida, respondida na aba Conselho, põe o herói na aba Guilda, com o soldo na linha do ouro', async ({
    context,
    request,
    world,
  }) => {
    const page = await world.open(context);
    await playNow(page);
    // Sem herói e sem Taverna: a aba diz como o primeiro chega, na frase do servidor, sem data.
    const before = await serverView(page, request);
    await guildTab(page).click();
    await expect(page).toHaveURL(/#\/guilda$/);
    await expect(heroes(page).getByRole('heading', { level: 2 })).toHaveText('Heróis');
    await expect(heroes(page)).toContainText(before.guild.text);
    await expect(tavern(page)).toContainText(before.tavern.text);
    await expect(tavern(page).getByRole('button', { name: 'Construir Taverna' })).toBeDisabled();
    await expect(tree(page).locator('[data-node="guild"]')).toContainText('nenhum herói');

    // A carta roteirizada vai à mesa (no jogo, ela sai no 13º dia; aqui o teste a põe).
    await world.control('council-deal', { cardId: 'woundedStranger' });
    await world.passTime(MINUTE, page);
    await page.getByRole('tab', { name: 'Conselho' }).click();
    const letter = page
      .getByRole('tabpanel', { name: 'Conselho' })
      .getByRole('article', { name: 'Estrangeira ferida' });
    await letter.getByRole('button', { name: 'Acolher a estrangeira', exact: true }).click();
    await expect(letter).toHaveCount(0);

    // O herói está no feudo, e a aba Guilda o mostra como o servidor o manda.
    const after = await serverView(page, request);
    expect(after.guild.heroes).toHaveLength(1);
    const [hero] = after.guild.heroes;
    if (hero === undefined) {
      throw new Error('O cenário esperava um herói.');
    }
    await guildTab(page).click();
    const sheet = team(page).getByRole('listitem');
    await expect(sheet).toHaveCount(1);
    await expect(sheet).toContainText(`${hero.name} · ${hero.classLabel} · Nv${hero.level}`);
    for (const trait of hero.traits) {
      await expect(sheet).toContainText(trait.label);
      await expect(sheet).toContainText(trait.text);
    }
    await expect(sheet).toContainText(hero.powerBreakdown);
    await expect(sheet).toContainText(hero.statusText);
    await expect(heroes(page)).toContainText('Heróis · 1 herói');
    await expect(heroes(page)).toContainText(after.guild.text);
    await expect(heroes(page)).toContainText('Soldo da equipe:');
    await expect(heroes(page)).toContainText('O ouro paga a equipe por mais');
    // Em toda a bancada: o cabeçalho, a árvore e a linha do ouro, com a conta do servidor.
    await expect(guild(page).locator('.population')).toContainText('Heróis 1');
    await expect(tree(page).locator('[data-node="guild"]')).toContainText('1 herói');
    await expect(tree(page).locator(`[data-node="hero:${hero.id}"]`)).toContainText(hero.name);
    await page.getByRole('tab', { name: 'Feudo' }).click();
    await expect(resourceRow(page, 'Ouro')).toContainText('soldo de 1 herói');
    expect(await cutTreeRows(page)).toEqual([]);
  });

  test('contratar pelo painel com duplo clique contrata uma vez e cobra uma vez (QA-05)', async ({
    context,
    request,
    world,
  }) => {
    const page = await world.open(context);
    const view = await openTavern(world, page, request);
    const [offer] = view.tavern.offers;
    if (offer === undefined) {
      throw new Error('O cenário esperava um candidato.');
    }
    await guildTab(page).click();
    // O candidato na tela é o do servidor: a ficha, o preço e o soldo, e quando a lista troca.
    // A linha é a que traz o nome **sozinho** (o da ficha e o do botão), e não qualquer linha em
    // que ele apareça: contratado um Carismático, o preço do candidato que sobra passa a dizer
    // "menos 20% por <nome>", e um filtro pelo texto continuaria achando uma linha.
    const row = candidates(page)
      .getByRole('listitem')
      .filter({ has: page.getByText(offer.name, { exact: true }) });
    await expect(row).toContainText(`${offer.name} · ${offer.classLabel} · Nv${offer.level}`);
    await expect(row).toContainText(offer.priceText);
    await expect(row).toContainText(`soldo de ${offer.wagePerHour}/h`);
    await expect(tavern(page)).toContainText(/A lista de candidatos troca em \d+ h/);
    const before = await gold(page, request);
    // As ordens que saem do navegador: o duplo clique tem de virar uma só. Sem a trava do
    // cliente sairiam duas, e o servidor recusaria a segunda (o resultado final seria o mesmo,
    // com um aviso de recusa na tela).
    const orders = commandPosts(page);

    await row.getByRole('button', { name: `Contratar ${offer.name}` }).dblclick();
    await expect(team(page).getByRole('listitem')).toHaveCount(1);
    await expect(team(page)).toContainText(offer.name);
    await expect(row).toHaveCount(0);
    expect(orders.map((order) => order.type)).toEqual(['hireHero']);
    await expect(toasts(page).getByRole('status')).toHaveCount(0);
    await expect(toasts(page).getByRole('alert')).toHaveCount(0);
    await expect(candidates(page).getByRole('listitem')).toHaveCount(view.tavern.offers.length - 1);
    // Uma contratação e uma cobrança: o ouro desceu o preço, uma vez.
    expect(await eventsOf(page, request, 'heroHired')).toHaveLength(1);
    const after = await serverView(page, request);
    expect(after.guild.heroes.map((hero) => hero.name)).toEqual([offer.name]);
    const spent = before - (await gold(page, request));
    expect(spent).toBeGreaterThanOrEqual(offer.price);
    expect(spent).toBeLessThan(offer.price + 2);
    // A árvore mostra a equipe e o candidato que sobrou, sem cortar nada.
    await expect(tree(page).locator('[data-node="guild"]')).toContainText('1 herói');
    await expect(tree(page).locator('[data-node="tavern"]')).toContainText('1 candidato');
    expect(await cutTreeRows(page)).toEqual([]);
  });

  test('pela paleta e só com o teclado, nos três temas: contratar, e a aba com contraste (QA-15)', async ({
    context,
    request,
    world,
  }) => {
    const page = await world.open(context);
    // Taverna Nv3: três candidatos, um para cada tema.
    const view = await openTavern(world, page, request, { level: 3, gold: 2000 });
    expect(view.tavern.offers.length).toBeGreaterThanOrEqual(THEMES.length);
    for (const [index, theme] of THEMES.entries()) {
      await applyTheme(page, theme);
      const offered = (await serverView(page, request)).tavern.offers;
      const [first] = offered;
      if (first === undefined) {
        throw new Error('O cenário esperava um candidato.');
      }
      // F1, o nome do comando, Enter: a lista dos candidatos; Enter contrata o primeiro.
      await palette(page, 'Contratar herói');
      const dialog = page.getByRole('dialog');
      await expect(dialog).toContainText('Contratar herói');
      for (const offer of offered) {
        await expect(dialog).toContainText(offer.name);
        await expect(dialog).toContainText(offer.priceText);
      }
      await page.keyboard.press('Enter');
      await expect(dialog).toHaveCount(0);
      // Pelo teclado até a aba: a paleta leva à Guilda.
      await palette(page, 'Ir para a Guilda');
      await expect(team(page).getByRole('listitem')).toHaveCount(index + 1);
      await expect(team(page)).toContainText(first.name);
      expect(await lowContrast(page), `contraste no tema ${theme}`).toEqual([]);
      expect(await overflow(page)).toEqual({ page: 0, content: 0 });
    }
    expect(await eventsOf(page, request, 'heroHired')).toHaveLength(THEMES.length);

    // Dispensar, também só com o teclado: a lista, a confirmação (o foco começa em "Manter") e
    // a frase do servidor que diz que não há devolução.
    const { guild: team3 } = await serverView(page, request);
    const [leaving] = team3.heroes;
    if (leaving === undefined) {
      throw new Error('O cenário esperava um herói.');
    }
    await palette(page, 'Dispensar herói');
    await expect(page.getByRole('dialog')).toContainText('Dispensar herói');
    await page.keyboard.press('Enter');
    const confirm = page.getByRole('dialog');
    await expect(confirm).toContainText(`Dispensar ${leaving.name}?`);
    await expect(confirm).toContainText(team3.dismissText);
    await expect(confirm.getByRole('button', { name: `Manter ${leaving.name}` })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(confirm.getByRole('button', { name: `Dispensar ${leaving.name}` })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(team(page).getByRole('listitem')).toHaveCount(THEMES.length - 1);
    await expect(team(page)).not.toContainText(leaving.name);
    expect(await eventsOf(page, request, 'heroDismissed')).toHaveLength(1);
  });

  test('duas abas contratam o mesmo candidato uma vez: a segunda é recusada com a frase do servidor (QA-05)', async ({
    context,
    request,
    world,
  }) => {
    const first = await world.open(context);
    const view = await openTavern(world, first, request);
    const second = await world.open(context);
    await expect(second.getByRole('heading', { name: 'Pedra Alta', level: 1 })).toBeVisible();
    const [offer] = view.tavern.offers;
    if (offer === undefined) {
      throw new Error('O cenário esperava um candidato.');
    }
    const hire = (page: Page) =>
      candidates(page).getByRole('button', { name: `Contratar ${offer.name}` });
    for (const page of [first, second]) {
      await guildTab(page).click();
      await expect(hire(page)).toBeEnabled();
    }
    await hire(first).click();
    await expect(team(first)).toContainText(offer.name);
    // A segunda aba ainda mostra o candidato e clica: o servidor recusa, com a frase dele, e a
    // visão que vem na recusa toma a tela.
    const refusal = second.waitForResponse(
      (response) => response.url().endsWith('/commands') && response.request().method() === 'POST',
    );
    await hire(second).click();
    const refused = await refusal;
    expect(refused.status()).toBe(422);
    const { message } = (await refused.json()) as { message: string };
    expect(message.length).toBeGreaterThan(10);
    // O aviso é a frase do servidor, palavra por palavra: o app não escreve a recusa.
    await expect(toasts(second).getByRole('status')).toHaveCount(1);
    await expect(toasts(second).getByRole('status')).toHaveText(message);
    await expect(hire(second)).toHaveCount(0);
    await expect(team(second).getByRole('listitem')).toHaveCount(1);
    expect(await eventsOf(first, request, 'heroHired')).toHaveLength(1);
    expect((await serverView(first, request)).guild.heroes).toHaveLength(1);
  });

  test('dispensar pelo painel e pela árvore pede confirmação; o festival sai do painel, uma vez por estação', async ({
    context,
    request,
    world,
  }) => {
    const page = await world.open(context);
    const view = await openTavern(world, page, request);
    await world.stock('food', 400);
    await world.passTime(MINUTE, page);
    const [offer] = view.tavern.offers;
    if (offer === undefined) {
      throw new Error('O cenário esperava um candidato.');
    }
    // Contratar pelo botão da linha da árvore: o preço está na dica dele.
    const offerRow = tree(page).locator(`[data-node="offer:${offer.offerId}"]`);
    await offerRow.hover();
    const hireButton = offerRow.getByRole('button', { name: `Contratar ${offer.name}` });
    await expect(hireButton).toHaveAttribute('title', new RegExp(offer.priceText));
    await hireButton.click();
    await guildTab(page).click();
    await expect(team(page)).toContainText(offer.name);
    const { guild: now } = await serverView(page, request);

    // Dispensar pelo painel: a confirmação diz o que se perde, na frase do servidor. "Manter"
    // não envia nada.
    await team(page)
      .getByRole('button', { name: `Dispensar ${offer.name}` })
      .click();
    const confirm = page.getByRole('dialog');
    await expect(confirm).toContainText(now.dismissText);
    await confirm.getByRole('button', { name: `Manter ${offer.name}` }).click();
    await expect(team(page)).toContainText(offer.name);
    expect(await eventsOf(page, request, 'heroDismissed')).toHaveLength(0);
    // Pela árvore, a mesma confirmação; confirmada, o herói sai.
    const heroRow = tree(page).locator(`[data-node="hero:${now.heroes[0]?.id}"]`);
    await heroRow.hover();
    await heroRow.getByRole('button', { name: `Dispensar ${offer.name}` }).click();
    await page
      .getByRole('dialog')
      .getByRole('button', { name: `Dispensar ${offer.name}` })
      .click();
    await expect(heroes(page).getByRole('heading', { level: 2 })).toHaveText('Heróis');
    await expect(team(page)).toHaveCount(0);
    expect(await eventsOf(page, request, 'heroDismissed')).toHaveLength(1);

    // O festival: custo e efeito ao lado do botão; dado, o servidor diz que a estação já teve o seu.
    const { tavern: open } = await serverView(page, request);
    expect(open.festival.available).toBe(true);
    await expect(tavern(page)).toContainText(open.festival.effectText);
    await tavern(page).getByRole('button', { name: 'Dar um festival' }).dblclick();
    await expect(tavern(page).getByRole('button', { name: 'Dar um festival' })).toBeDisabled();
    const { tavern: held } = await serverView(page, request);
    expect(held.festival.available).toBe(false);
    await expect(tavern(page)).toContainText(held.festival.blockedReason ?? '—');
    expect(await eventsOf(page, request, 'festivalHeld')).toHaveLength(1);
    // Pela paleta, bloqueado, a resposta é o motivo do servidor, sem pergunta.
    await palette(page, 'Dar um festival na Taverna');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(toasts(page)).toContainText(held.festival.blockedReason ?? '—');
  });

  test('o soldo em atraso aparece com o relógio adiantado: "Antes de partir" avisa antes; depois, o aviso, a barra, a árvore e a aba', async ({
    context,
    request,
    world,
  }) => {
    const page = await world.open(context);
    const view = await openTavern(world, page, request);
    const [offer] = view.tavern.offers;
    if (offer === undefined) {
      throw new Error('O cenário esperava um candidato.');
    }
    await guildTab(page).click();
    await candidates(page)
      .getByRole('button', { name: `Contratar ${offer.name}` })
      .click();
    await expect(team(page)).toContainText(offer.name);
    // O cofre fica com ouro para pouco mais de uma hora de soldo, e ninguém na Mina.
    await world.stock('gold', Math.ceil(offer.wagePerHour * 1.5));
    await world.passTime(MINUTE, page);
    await expect(heroes(page)).toContainText('O ouro paga a equipe por mais 1 h.');
    // "Antes de partir" não diz que o feudo está pronto: o soldo vai atrasar.
    await page.getByRole('tab', { name: 'Hoje' }).click();
    const leaving = page
      .getByRole('tabpanel', { name: 'Hoje' })
      .getByRole('region', { name: 'Antes de partir' });
    await expect(leaving).toContainText(
      'O ouro paga a equipe por mais 1 h: depois disso o soldo atrasa.',
    );
    await expect(leaving.getByRole('button', { name: 'Alocar na Mina de Ouro' })).toBeVisible();

    // Duas horas depois, o cofre secou: o atraso abriu.
    await world.passTime(2 * HOUR, page);
    const [started] = await eventsOf(page, request, 'wageArrearsStarted');
    expect(started).toBeDefined();
    const late = await serverView(page, request);
    const arrears = late.guild.wage.arrears;
    expect(arrears).not.toBeNull();
    const notice = toasts(page)
      .getByRole('status')
      .filter({ hasText: started?.text ?? '—' });
    await expect(notice).toBeVisible();
    // O aviso leva os prazos que a visão trouxer (um herói Leal não tem nenhum).
    if (arrears?.discontentInSeconds != null) {
      await expect(notice).toContainText('Descontentes em');
    }
    if (arrears?.nextDepartureInSeconds != null) {
      await expect(notice).toContainText('Um herói parte em');
    }
    await expect(statusBar(page)).toContainText('Soldo em atraso');
    await expect(page).toHaveTitle(/Soldo em atraso em Pedra Alta/);
    await expect(tree(page).locator('[data-node="guild"]')).toContainText('soldo em atraso');
    await expect(leaving).toContainText('Soldo em atraso há');
    // "Ver" leva à aba Guilda, onde o atraso está por extenso, com a frase do servidor.
    await notice.getByRole('button', { name: 'Ver' }).click();
    await expect(guildTab(page)).toHaveAttribute('aria-selected', 'true');
    await expect(heroes(page)).toContainText('Soldo em atraso há');
    await expect(heroes(page)).toContainText(arrears?.text ?? '—');
    await expect(guild(page).locator('.population')).toContainText('soldo em atraso');
    // A barra de status também leva à Guilda.
    await page.getByRole('tab', { name: 'Feudo' }).click();
    await statusBar(page).locator('.status-main').click();
    await expect(guildTab(page)).toHaveAttribute('aria-selected', 'true');
    expect(await lowContrast(page)).toEqual([]);
  });

  test('em 720 px a aba cabe sem rolagem lateral, com equipe, candidatos e festival; sem ligação, modo leitura', async ({
    context,
    request,
    world,
  }) => {
    const page = await world.open(context);
    const view = await openTavern(world, page, request, { level: 3, gold: 2000 });
    const [offer] = view.tavern.offers;
    if (offer === undefined) {
      throw new Error('O cenário esperava um candidato.');
    }
    await guildTab(page).click();
    await candidates(page)
      .getByRole('button', { name: `Contratar ${offer.name}` })
      .click();
    await expect(team(page)).toContainText(offer.name);
    await page.setViewportSize({ width: 720, height: 900 });
    await expect(page.locator('#sidebar')).toBeHidden();
    await expect(guildTab(page)).toBeVisible();
    expect(await overflow(page)).toEqual({ page: 0, content: 0 });
    expect(await lowContrast(page)).toEqual([]);
    // Nenhum botão de ordem passa da largura da aba.
    const inside = await guild(page)
      .getByRole('button')
      .evaluateAll((buttons) =>
        buttons.map((button) => button.getBoundingClientRect().right <= window.innerWidth),
      );
    expect(inside.length).toBeGreaterThanOrEqual(3);
    expect(inside.every(Boolean)).toBe(true);
    // A lista da paleta também cabe.
    await palette(page, 'Contratar herói');
    await expect(page.getByRole('dialog')).toContainText('Contratar herói');
    expect(await overflow(page)).toEqual({ page: 0, content: 0 });
    await page.keyboard.press('Escape');

    // A API cai: a equipe e os candidatos se leem, e nenhuma ordem sai.
    await page.setViewportSize({ width: 1280, height: 720 });
    await context.route('**/v1/**', (route) => route.abort('connectionrefused'));
    await page.clock.fastForward(31_000);
    await expect(guild(page)).toContainText(
      'Sem ligação com o reino: a equipe, as expedições, os candidatos e os prazos são os do último estado conhecido do feudo.',
    );
    await expect(team(page)).toContainText(offer.name);
    for (const button of await guild(page)
      .getByRole('button', { name: /^(Contratar|Dispensar|Dar um festival|Construir)/ })
      .all()) {
      await expect(button).toBeDisabled();
    }
    await expect(statusBar(page)).toContainText('Sem ligação com o reino');
    await context.unroute('**/v1/**');
    await guild(page).getByRole('button', { name: 'Tentar agora' }).click();
    await expect(guild(page)).not.toContainText('Sem ligação com o reino');
  });

  test('a encruzilhada de uma expedição é anunciada na aba Hoje e na barra de status e, sem resposta, a Postura decide no prazo (V3D-T1)', async ({
    context,
    request,
    world,
  }) => {
    // O protocolo 3 não quebra o app, e a decisão à espera aparece, com o prazo; a escolha do
    // caminho e o envio são dos cenários de "as expedições na interface", abaixo.
    const page = await world.open(context);
    await playNow(page);
    await world.control('council-deal', { cardId: 'woundedStranger' });
    await world.passTime(MINUTE, page);
    await page.getByRole('tab', { name: 'Conselho' }).click();
    const letter = page
      .getByRole('tabpanel', { name: 'Conselho' })
      .getByRole('article', { name: 'Estrangeira ferida' });
    await letter.getByRole('button', { name: 'Acolher a estrangeira', exact: true }).click();
    await expect(letter).toHaveCount(0);

    // A equipe é posta na encruzilhada da Floresta Antiga, com a Postura Cautelosa e 12 h de prazo.
    await world.crossroads('cautious');
    await world.passTime(MINUTE, page);
    const waiting = await serverView(page, request);
    expect(waiting.guild.built).toBe(true);
    expect(waiting.pendingDecisions).toHaveLength(1);
    const [decision] = waiting.pendingDecisions;
    if (decision === undefined) {
      throw new Error('O cenário esperava a encruzilhada entre as decisões pendentes.');
    }
    // O título é o do servidor: o cenário não escreve frase do conteúdo.
    expect(decision.kind).toBe('crossroads');
    expect(waiting.guild.heroes.map((hero) => hero.atHome)).toEqual([false]);
    expect(waiting.guild.expeditions[0]?.crossroads?.postureLabel).toBe('Cautelosa');

    await page.getByRole('tab', { name: 'Hoje' }).click();
    const decisions = page.getByRole('region', { name: 'Decisões pendentes (1)' });
    await expect(decisions).toContainText(`Guilda: “${decision.title}”`);
    await expect(decisions).toContainText('expira em');
    // O que a Postura fará sem resposta está ao lado do prazo, na frase do servidor.
    await expect(decisions).toContainText(
      waiting.guild.expeditions[0]?.crossroads?.postureText ?? 'sem a frase da Postura',
    );
    await expect(
      decisions.getByRole('button', { name: `Escolher caminho: ${decision.title}` }),
    ).toBeVisible();
    // A barra de status conta a encruzilhada como decisão pendente, e o clique leva à Guilda.
    await expect(statusBar(page)).toContainText('1 decisão pendente');
    await statusBar(page).locator('.status-main').click();
    await expect(page).toHaveURL(/#\/guilda$/);
    // A ficha diz onde ela está, na frase do servidor.
    await expect(team(page).getByRole('listitem')).toContainText('Em expedição');

    // Doze horas e um minuto depois ninguém respondeu: a Postura decidiu, e a decisão saiu.
    await world.passTime(12 * HOUR + MINUTE, page);
    const decided = await serverView(page, request);
    expect(decided.pendingDecisions).toEqual([]);
    const types = (await gameEvents(page, request)).map((event) => event.type);
    expect(types).toContain('expeditionPostureDecided');
    await page.getByRole('tab', { name: 'Hoje' }).click();
    await expect(page.getByRole('tabpanel', { name: 'Hoje' })).not.toContainText('Guilda: “');
    // Meia hora depois a equipe voltou: o relatório está na visão, e a heroína, no feudo.
    await world.passTime(30 * MINUTE, page);
    const home = await serverView(page, request);
    expect(home.guild.expeditions).toEqual([]);
    expect(home.guild.reports).toHaveLength(1);
    expect(home.guild.heroes.map((hero) => hero.atHome)).toEqual([true]);
  });
});

// V3D-T4 (GDD §9.2 a §9.4 e §13.2 a §13.6; critérios 2 e 3 do §16.2): as expedições na
// interface. A equipe é posta no feudo pela rota de teste (`world.hero`), com nome escolhido
// aqui, e não pelo sorteio da Taverna: os cenários não dependem de quem a semente ofereceu.
// A variante do grafo de uma expedição enviada pela tela sai de uma conta sobre a semente: os
// cenários leem do servidor o que a tela tem de mostrar, em vez de citar um nó. Em parte dos
// cenários a encruzilhada é posta pela rota de teste (`world.crossroads`), sempre a da primeira
// variante da Floresta Antiga; daí em diante a escolha, o prazo, o nó seguinte e a volta são os
// do motor. Os cenários de "a jornada inteira", mais abaixo, chegam à encruzilhada por um envio
// de verdade, feito pela tela.

const expeditions = (page: Page) => guild(page).getByRole('region', { name: 'Expedições' });
const reports = (page: Page) => guild(page).getByRole('region', { name: 'Relatórios' });
const arsenal = (page: Page) => guild(page).getByRole('region', { name: 'Arsenal' });
const destinations = (page: Page) => expeditions(page).getByRole('list', { name: 'Destinos' });
const away = (page: Page) => expeditions(page).getByRole('list', { name: 'Fora do feudo' });
/**
 * A folha de uma encruzilhada e a linha de um destino, achadas pelo que o servidor chama de
 * identificador (`data-crossroads`, `data-destination`), e não por uma frase do conteúdo escrita
 * aqui: trocar o título de um nó ou o nome de um destino não quebra cenário nenhum (revisão da
 * Fase D, A22).
 */
const crossroadsCard = (page: Page) => guild(page).locator('article[data-crossroads]');
const destinationRow = (page: Page, modelId: string) =>
  destinations(page).locator(`[data-destination="${modelId}"]`);

/** Funda o feudo com a Guilda dos Aventureiros de pé e a equipe pedida no feudo. */
async function openGuild(
  world: World,
  page: Page,
  names: string[],
  { level = 1 }: { level?: number } = {},
) {
  await playNow(page);
  await world.raise('townHall', 3);
  await world.raise('guild', level);
  for (const name of names) {
    await world.hero(name);
  }
  await world.passTime(MINUTE, page);
}

test.describe('as expedições na interface (V3D-T4)', () => {
  test('enviar pelo painel com duplo clique envia uma vez; a equipe aparece fora do feudo e, na volta, o relatório nó a nó (critério 3)', async ({
    context,
    request,
    world,
  }) => {
    const page = await world.open(context);
    await openGuild(world, page, ['Aldo']);
    const before = await serverView(page, request);
    const patrol = before.guild.available.find((entry) => entry.modelId === 'patrol');
    if (patrol === undefined) {
      throw new Error('O cenário esperava a Patrulha na lista da Guilda.');
    }
    expect(patrol.locked).toBe(false);
    await guildTab(page).click();
    // O destino mostra o que o servidor mandou: o risco, o que a equipe precisa, o primeiro
    // trecho e a régua dele. O que vem depois não está na tela.
    const row = destinationRow(page, patrol.modelId);
    await expect(row).toContainText(`Risco: ${patrol.riskText.toLowerCase()}`);
    await expect(row).toContainText(patrol.requirementsText);
    await expect(row).toContainText(patrol.firstStretchText);
    await expect(row).toContainText(patrol.fit?.text ?? '');
    // A montagem: quem vai e a Postura, cada uma com o que faz, na frase do servidor.
    await row.getByText('Montar a equipe').click();
    await expect(row.getByRole('checkbox', { name: /^Aldo · / })).toBeChecked();
    for (const posture of before.guild.postures) {
      await expect(row.getByRole('radio', { name: posture.label })).toHaveAccessibleDescription(
        posture.text,
      );
    }
    await expect(row.getByRole('radio', { name: 'Equilibrada' })).toBeChecked();
    await row.getByRole('radio', { name: 'Cautelosa' }).check();
    await expect(row).toContainText(/A equipe marcada vale [\d,.]+ contra o primeiro trecho/);

    // As ordens que saem do navegador: o duplo clique tem de virar uma só.
    const orders = commandPosts(page);
    await row.getByRole('button', { name: /^Enviar/ }).dblclick();
    await expect(away(page).getByRole('listitem')).toHaveCount(1);
    await expect(away(page)).toContainText(`${patrol.label} · Aldo · Postura Cautelosa`);
    expect(orders.map((order) => order.type)).toEqual(['sendExpedition']);
    expect(await eventsOf(page, request, 'expeditionSent')).toHaveLength(1);
    await expect(toasts(page).getByRole('alert')).toHaveCount(0);
    // A equipe está fora: a ficha diz, a árvore conta, e o único lugar da Guilda está ocupado.
    const sent = await serverView(page, request);
    expect(sent.guild.expeditions).toHaveLength(1);
    await expect(team(page).getByRole('listitem')).toContainText('Em expedição');
    await expect(tree(page).locator('[data-node="guild"]')).toContainText(
      '1 herói · 1 expedição em viagem',
    );
    await expect(row).toContainText(sent.guild.available[0]?.lockedReason ?? 'sem motivo');
    await expect(row.getByRole('button', { name: /^Enviar/ })).toHaveCount(0);
    expect(await cutTreeRows(page)).toEqual([]);

    // Vinte minutos depois a Patrulha voltou: o relatório está na aba, nó a nó.
    await world.passTime(20 * MINUTE, page);
    const home = await serverView(page, request);
    expect(home.guild.expeditions).toEqual([]);
    const [report] = home.guild.reports;
    if (report === undefined) {
      throw new Error('O cenário esperava o relatório da Patrulha.');
    }
    await expect(away(page)).toHaveCount(0);
    const sheet = reports(page).getByRole('listitem').first();
    await expect(sheet).toContainText(`${report.label} · Aldo · Postura Cautelosa`);
    const steps = sheet.getByRole('list', { name: `O percurso de ${report.label}` });
    await expect(steps.getByRole('listitem')).toHaveCount(report.log.length);
    for (const [index, step] of report.log.entries()) {
      const line = steps.getByRole('listitem').nth(index);
      await expect(line).toContainText(step.title);
      // O desfecho em palavra e em ícone: nada é dito só pela cor.
      await expect(line.locator('.report-outcome')).toHaveText(step.outcomeLabel);
      await expect(line.locator('.report-outcome .codicon')).toHaveCount(1);
      if (step.standoutName !== null) {
        await expect(line).toContainText(`Destaque: ${step.standoutName}`);
      }
      if (step.lessonText !== null) {
        await expect(line).toContainText(`Lição: ${step.lessonText}`);
      }
    }
    // No fim, o que trouxe e o que custou, nas frases do servidor.
    await expect(sheet).toContainText(report.lootText);
    await expect(sheet).toContainText(report.lossesText);
    expect(await overflow(page)).toEqual({ page: 0, content: 0 });

    // A linha da Crônica liga ao relatório enquanto ele está guardado.
    const [returned] = [
      ...(await eventsOf(page, request, 'expeditionReturned')),
      ...(await eventsOf(page, request, 'expeditionLost')),
    ];
    if (returned === undefined) {
      throw new Error('O cenário esperava a linha da volta na Crônica.');
    }
    await page.getByRole('tab', { name: 'Feudo' }).click();
    const recent = fief(page).getByRole('region', { name: 'Crônica' });
    const line = recent.getByRole('listitem').filter({ hasText: returned.text });
    await line.getByRole('button', { name: 'Ver o relatório' }).click();
    await expect(page).toHaveURL(/#\/guilda$/);
    await expect(sheet.getByRole('list', { name: `O percurso de ${report.label}` })).toBeVisible();
    // E na aba Crônica, a mesma linha tem o mesmo botão.
    await page.getByRole('tab', { name: 'Feudo' }).click();
    await fief(page).getByRole('button', { name: 'Abrir a Crônica' }).click();
    const chronicle = page.getByRole('tabpanel', { name: 'Crônica' });
    await expect(
      chronicle
        .getByRole('listitem')
        .filter({ hasText: returned.text })
        .getByRole('button', { name: 'Ver o relatório' }),
    ).toBeVisible();
  });

  test('escolher o caminho pelo painel: todas as superfícies mostram a decisão; em duas abas, uma escolhe e a outra é recusada e vê a encruzilhada sumir', async ({
    context,
    request,
    world,
  }) => {
    const first = await world.open(context);
    await playNow(first);
    await world.hero('Aldo');
    await world.crossroads('balanced');
    await world.passTime(MINUTE, first);
    const second = await world.open(context);
    await expect(second.getByRole('heading', { name: 'Pedra Alta', level: 1 })).toBeVisible();
    const view = await serverView(first, request);
    const [expedition] = view.guild.expeditions;
    const crossroads = expedition?.crossroads;
    if (expedition === undefined || crossroads === null || crossroads === undefined) {
      throw new Error('O cenário esperava a equipe na encruzilhada.');
    }
    const hoursLeft = `${Math.floor(crossroads.decidesInSeconds / 3600)} h`;

    // A barra de status, o título da aba do navegador, a árvore e a aba Hoje anunciam a decisão.
    await expect(statusBar(first)).toContainText(`1 decisão pendente · expira em ${hoursLeft}`);
    await expect(first).toHaveTitle(/^\(1\) Pedra Alta/);
    await expect(tree(first).locator('[data-node="guild"]')).toContainText(
      '1 herói · 1 expedição na encruzilhada',
    );
    const treeRow = tree(first).locator(`[data-node="expedition:${expedition.id}"]`);
    await expect(treeRow).toContainText('na encruzilhada');
    await first.getByRole('tab', { name: 'Hoje' }).click();
    const decisions = first.getByRole('region', { name: 'Decisões pendentes (1)' });
    await expect(decisions).toContainText(crossroads.postureText);
    await expect(decisions.getByRole('button', { name: /^Escolher caminho/ })).toBeVisible();
    await expect(first.getByRole('region', { name: 'Antes de partir' })).toContainText(
      'espera na encruzilhada',
    );

    // A folha da encruzilhada: o título, a situação, cada caminho com a pista, o prazo real e
    // o que a Postura fará sem resposta.
    for (const page of [first, second]) {
      await guildTab(page).click();
      const card = crossroadsCard(page);
      await expect(card).toContainText(`Encruzilhada · ${expedition.label}`);
      await expect(card).toContainText(`A espera acaba em ${hoursLeft}`);
      await expect(card).toContainText(crossroads.text);
      await expect(card).toContainText(crossroads.postureText);
      for (const option of crossroads.options) {
        await expect(card.getByRole('button', { name: option.label })).toBeEnabled();
        await expect(card).toContainText(option.hint);
      }
      await expect(card).toContainText(
        `Sem resposta, é este o caminho da Postura ${crossroads.postureLabel}.`,
      );
    }

    // A primeira aba escolhe, com um clique e uma ordem.
    const [stream, other] = [
      crossroads.options.find((option) => option.id === crossroads.postureOptionId),
      crossroads.options.find((option) => option.id !== crossroads.postureOptionId),
    ];
    if (stream === undefined || other === undefined) {
      throw new Error('O cenário esperava dois caminhos.');
    }
    const orders = commandPosts(first);
    await crossroadsCard(first).getByRole('button', { name: other.label }).click();
    await expect(crossroadsCard(first)).toHaveCount(0);
    expect(orders.map((order) => order.type)).toEqual(['chooseExpeditionPath']);
    await expect(statusBar(first)).not.toContainText('decisão pendente');
    await expect(away(first).getByRole('listitem')).toHaveCount(1);

    // A segunda aba ainda mostra a encruzilhada e clica: o servidor recusa, com a frase dele, e
    // a visão que vem na recusa toma a tela: a encruzilhada some.
    const refusal = second.waitForResponse(
      (response) => response.url().endsWith('/commands') && response.request().method() === 'POST',
    );
    await crossroadsCard(second).getByRole('button', { name: stream.label }).click();
    const refused = await refusal;
    expect(refused.status()).toBe(422);
    const body = (await refused.json()) as { message: string; details: { code: string } };
    expect(body.details.code).toBe('CROSSROADS_DECIDED');
    await expect(toasts(second).getByRole('status')).toHaveText(body.message);
    await expect(crossroadsCard(second)).toHaveCount(0);
    await second.getByRole('tab', { name: 'Hoje' }).click();
    await expect(second.getByRole('tabpanel', { name: 'Hoje' })).not.toContainText('Guilda: “');
    // Uma escolha só valeu, e a Crônica a conta.
    const chosen = await eventsOf(first, request, 'expeditionPathChosen');
    expect(chosen).toHaveLength(1);
    expect((await serverView(first, request)).pendingDecisions).toEqual([]);
  });

  test('pela paleta e só com o teclado, nos três temas: escolher o caminho, e a encruzilhada com contraste (QA-15)', async ({
    context,
    request,
    world,
  }) => {
    const page = await world.open(context);
    // Três heróis e três lugares na Guilda: uma encruzilhada para cada tema.
    await openGuild(world, page, ['Aldo', 'Berta', 'Caio'], { level: 4 });
    for (const [index, theme] of THEMES.entries()) {
      await applyTheme(page, theme);
      await world.crossroads('balanced');
      await world.passTime(MINUTE, page);
      const waiting = (await serverView(page, request)).guild.expeditions.find(
        (entry) => entry.crossroads !== null,
      );
      const crossroads = waiting?.crossroads;
      if (waiting === undefined || crossroads === null || crossroads === undefined) {
        throw new Error('O cenário esperava a equipe na encruzilhada.');
      }
      // Pelo teclado até a aba: a folha da encruzilhada no tema, com contraste e sem transbordar.
      await palette(page, 'Ir para a Guilda');
      await expect(crossroadsCard(page)).toBeVisible();
      expect(await lowContrast(page), `contraste no tema ${theme}`).toEqual([]);
      expect(await overflow(page)).toEqual({ page: 0, content: 0 });
      // F1, o nome do comando, Enter: a lista dos caminhos, com a situação, o prazo, o que a
      // Postura fará e a pista de cada um. A opção da Postura já vem marcada.
      await palette(page, 'Escolher caminho da expedição');
      const dialog = page.getByRole('dialog');
      await expect(dialog).toContainText(`Encruzilhada: ${waiting.label}`);
      await expect(dialog).toContainText(crossroads.text);
      await expect(dialog).toContainText(crossroads.postureText);
      for (const option of crossroads.options) {
        await expect(dialog).toContainText(option.label);
        await expect(dialog).toContainText(option.hint);
      }
      await expect(dialog.getByRole('option', { selected: true })).toContainText(
        crossroads.postureOptionLabel,
      );
      // Uma seta para baixo e Enter: o caminho seguinte ao da Postura.
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('Enter');
      await expect(dialog).toHaveCount(0);
      await expect(crossroadsCard(page)).toHaveCount(0);
      expect(await eventsOf(page, request, 'expeditionPathChosen')).toHaveLength(index + 1);
    }
    expect(await eventsOf(page, request, 'expeditionPostureDecided')).toHaveLength(0);
  });

  test('o prazo vence com a lista aberta: ela fecha sem enviar, e a Crônica conta que a Postura decidiu (critério 2)', async ({
    context,
    request,
    world,
  }) => {
    const page = await world.open(context);
    await playNow(page);
    await world.hero('Aldo');
    // Duas horas de prazo, com a Postura Cautelosa.
    await world.crossroads('cautious', 2 * HOUR);
    await world.passTime(MINUTE, page);
    const view = await serverView(page, request);
    const [expedition] = view.guild.expeditions;
    const crossroads = expedition?.crossroads;
    if (expedition === undefined || crossroads === null || crossroads === undefined) {
      throw new Error('O cenário esperava a equipe na encruzilhada.');
    }
    expect(crossroads.postureLabel).toBe('Cautelosa');
    await guildTab(page).click();
    await expect(crossroadsCard(page)).toContainText(crossroads.postureText);
    const orders = commandPosts(page);
    // Pela árvore: o botão da linha da expedição abre a lista dos caminhos.
    const treeRow = tree(page).locator(`[data-node="expedition:${expedition.id}"]`);
    await treeRow.hover();
    await treeRow.getByRole('button', { name: /^Escolher caminho/ }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText(`Encruzilhada: ${expedition.label}`);
    await expect(dialog).toContainText(crossroads.postureText);

    // O relógio passa do prazo com a lista aberta: ela fecha sozinha, a tela avisa e nada sai.
    await world.passTime(2 * HOUR + MINUTE, page);
    await expect(dialog).toHaveCount(0);
    await expect(toasts(page)).toContainText(
      `O prazo da encruzilhada de "${expedition.label}" acabou antes da sua palavra, e a Postura Cautelosa decidiu.`,
    );
    expect(orders).toEqual([]);
    await expect(crossroadsCard(page)).toHaveCount(0);
    await expect(statusBar(page)).not.toContainText('decisão pendente');

    // Quem decidiu foi a Postura, e a Crônica diz isso com a frase do servidor.
    const [decided] = await eventsOf(page, request, 'expeditionPostureDecided');
    if (decided === undefined) {
      throw new Error('O cenário esperava a linha da Postura na Crônica.');
    }
    // A Postura é dita com a palavra que a visão mandou, no meio da frase.
    expect(decided.text).toContain(crossroads.postureLabel.toLowerCase());
    expect(await eventsOf(page, request, 'expeditionPathChosen')).toHaveLength(0);
    await page.getByRole('tab', { name: 'Feudo' }).click();
    await expect(fief(page).getByRole('region', { name: 'Crônica' })).toContainText(decided.text);
  });

  test('equipar pelo arsenal e desequipar pela ficha: o item muda de lugar, o poder acompanha, e cada clique é uma ordem', async ({
    context,
    request,
    world,
  }) => {
    const page = await world.open(context);
    await openGuild(world, page, ['Aldo']);
    await world.item('huntingSpear');
    await world.passTime(MINUTE, page);
    const before = await serverView(page, request);
    const [item] = before.guild.inventory;
    const [hero] = before.guild.heroes;
    if (item === undefined || hero === undefined) {
      throw new Error('O cenário esperava um item no arsenal e um herói no feudo.');
    }
    await guildTab(page).click();
    // O arsenal diz o que o item é e o que soma, nas frases do servidor.
    await expect(arsenal(page)).toContainText(before.guild.inventoryText);
    await expect(arsenal(page)).toContainText(
      `${item.label} · ${item.slotLabel} · ${item.rarityLabel}`,
    );
    await expect(arsenal(page)).toContainText(item.bonusText);
    const orders = commandPosts(page);
    // Um herói só no feudo: "Equipar" vai direto a ele.
    await arsenal(page)
      .getByRole('button', { name: `Equipar ${item.label}` })
      .click();
    await expect(arsenal(page).getByRole('listitem')).toHaveCount(0);
    const armed = await serverView(page, request);
    expect(armed.guild.inventory).toEqual([]);
    expect(armed.guild.heroes[0]?.power).toBeGreaterThan(hero.power);
    // A ficha mostra os três espaços, com o item e o que ele soma.
    const sheet = team(page).getByRole('listitem').first();
    await sheet.getByText('Equipamento: 1 de 3').click();
    const gear = sheet.getByRole('list', { name: `Equipamento de ${hero.name}` });
    await expect(gear.getByRole('listitem')).toHaveCount(3);
    await expect(gear).toContainText(`${item.slotLabel}: ${item.label} (${item.bonusText})`);
    // O número é o do servidor, escrito à moda daqui (vírgula decimal).
    await expect(sheet).toContainText(
      `Poder ${String(armed.guild.heroes[0]?.power).replace('.', ',')}`,
    );
    // Desequipar devolve o item ao arsenal.
    await gear.getByRole('button', { name: `Desequipar ${item.label}` }).click();
    await expect(arsenal(page).getByRole('listitem')).toHaveCount(1);
    expect(orders.map((order) => order.type)).toEqual(['equipItem', 'unequipItem']);
    const after = await serverView(page, request);
    expect(after.guild.inventory.map((entry) => entry.label)).toEqual([item.label]);
    expect(after.guild.heroes[0]?.power).toBe(hero.power);
    expect(await overflow(page)).toEqual({ page: 0, content: 0 });
  });

  test('ritmo Rápido: o prazo da encruzilhada na tela é o da API, em horas de relógio, e a Postura decide na hora anunciada', async ({
    context,
    request,
    world,
  }) => {
    const page = await world.open(context);
    // O feudo é fundado no Rápido pelas boas-vindas: o cenário roda com a suíte e também com
    // `GAME_TIME_SCALE=3 pnpm test:e2e 09-guilda -g "ritmo"`, que sobe o servidor como o da produção.
    await page
      .getByRole('tabpanel', { name: 'Boas-vindas' })
      .getByRole('radiogroup', { name: 'Ritmo' })
      .getByRole('radio', { name: /^Rápido/ })
      .check();
    await playNow(page);
    expect((await serverView(page, request)).settlement.paceLabel).toMatch(/^Rápido/);
    await world.hero('Aldo');
    // O prazo de uma encruzilhada é de 12 horas de relógio em qualquer ritmo.
    await world.crossroads('balanced');
    await world.passTime(MINUTE, page);
    const hours = async () => {
      const view = await serverView(page, request);
      const seconds = view.guild.expeditions[0]?.crossroads?.decidesInSeconds;
      if (seconds === undefined) {
        throw new Error('O cenário esperava a equipe na encruzilhada.');
      }
      return { seconds, text: `${Math.floor(seconds / 3600)} h` };
    };
    const start = await hours();
    // Doze horas menos o minuto que passou: a API não dividiu o prazo pelo ritmo.
    expect(start.seconds).toBeGreaterThan(12 * 3600 - 120);
    expect(start.seconds).toBeLessThanOrEqual(12 * 3600);
    await guildTab(page).click();
    // A tela escreve o prazo que a API deu, sem converter de novo.
    await expect(crossroadsCard(page)).toContainText(`A espera acaba em ${start.text}`);
    await expect(statusBar(page)).toContainText(`expira em ${start.text}`);

    // Seis horas de relógio depois, faltam seis: na API e na tela.
    await world.passTime(6 * HOUR, page);
    const middle = await hours();
    expect(middle.seconds).toBeGreaterThan(6 * 3600 - 180);
    expect(middle.seconds).toBeLessThanOrEqual(6 * 3600);
    await expect(crossroadsCard(page)).toContainText(`A espera acaba em ${middle.text}`);
    expect((await eventsOf(page, request, 'expeditionPostureDecided')).length).toBe(0);

    // Passadas as doze horas anunciadas, a Postura decidiu: nem antes, nem três vezes depois.
    await world.passTime(6 * HOUR + MINUTE, page);
    expect((await serverView(page, request)).pendingDecisions).toEqual([]);
    expect(await eventsOf(page, request, 'expeditionPostureDecided')).toHaveLength(1);
    await expect(crossroadsCard(page)).toHaveCount(0);
  });
});

// Revisão independente da Fase D (achados A17 a A20 e A2): a jornada inteira pela tela. Aqui
// nada é posto no meio do caminho: a equipe é enviada pela tela, e é o motor que a leva à
// encruzilhada, ao nó seguinte e de volta. Os heróis são de nível alto (`world.hero`, que é a
// única coisa posta de fora): a variante do grafo e a sorte de cada prova saem da semente, e
// uma equipe forte chega à encruzilhada e volta em qualquer uma. Os cenários não citam nó,
// opção nem frase do conteúdo: leem do servidor o que a tela tem de mostrar.

type ServerView = Awaited<ReturnType<typeof serverView>>;

/** Funda o feudo com a Guilda no nível pedido e os heróis pedidos, cada um com classe e nível. */
async function openGuildWith(
  world: World,
  page: Page,
  team: Array<{ name: string; classId?: 'warrior' | 'archer' | 'mage' | 'cleric'; level?: number }>,
  { level = 1 }: { level?: number } = {},
) {
  await playNow(page);
  await world.raise('townHall', 3);
  await world.raise('guild', level);
  for (const { name, ...options } of team) {
    await world.hero(name, options);
  }
  await world.passTime(MINUTE, page);
}

/**
 * Adianta o relógio aos poucos até o servidor mostrar o que o cenário espera, e devolve essa
 * visão. Os passos são curtos para a página ver cada instante: a chegada à encruzilhada é um
 * evento, e é dele que o aviso nasce.
 */
async function until(
  world: World,
  page: Page,
  request: APIRequestContext,
  what: string,
  done: (view: ServerView) => boolean,
  { stepMs = 5 * MINUTE, steps = 60 }: { stepMs?: number; steps?: number } = {},
): Promise<ServerView> {
  for (let step = 0; step < steps; step += 1) {
    const view = await serverView(page, request);
    if (done(view)) {
      return view;
    }
    await world.passTime(stepMs, page);
  }
  throw new Error(`O cenário esperava ${what}, e o relógio andou ${steps} passos sem isso.`);
}

/** A equipe que espera na encruzilhada, na visão do servidor. */
function waitingIn(view: ServerView) {
  const expedition = view.guild.expeditions.find((entry) => entry.crossroads !== null);
  const crossroads = expedition?.crossroads;
  if (expedition === undefined || crossroads === null || crossroads === undefined) {
    throw new Error('O cenário esperava a equipe na encruzilhada.');
  }
  return { expedition, crossroads };
}

/** Os heróis marcados na montagem de um destino, pelo identificador. */
const marked = (row: ReturnType<typeof destinationRow>) =>
  row
    .locator('input[data-hero]:checked')
    .evaluateAll((boxes) => boxes.map((box) => box.getAttribute('data-hero') ?? ''));

/** As ordens de envio que saíram, com o que cada uma mandou. */
const sendsIn = (orders: Array<{ type: string }>) =>
  (orders as Array<{ type: string; payload: { modelId: string; heroIds: string[] } }>)
    .filter((order) => order.type === 'sendExpedition')
    .map((order) => ({
      modelId: order.payload.modelId,
      heroIds: [...order.payload.heroIds].sort(),
    }));

test.describe('a jornada inteira pela tela (revisão da Fase D)', () => {
  test('equipes de três e de dois montadas pelas caixas de marcação e enviadas; o destino que pede uma classe diz o motivo do servidor até ela chegar ao feudo (A17)', async ({
    context,
    request,
    world,
  }) => {
    const page = await world.open(context);
    // Três heróis, nenhum Mago, e a Guilda no nível que o Pântano pede.
    await openGuildWith(world, page, [{ name: 'Aldo' }, { name: 'Berta' }, { name: 'Caio' }], {
      level: 3,
    });
    await world.reveal('swamp');
    await world.passTime(MINUTE, page);
    const without = await serverView(page, request);
    const blocked = without.guild.available.find((entry) => entry.modelId === 'swamp');
    if (blocked === undefined) {
      throw new Error('O cenário esperava o destino que pede uma classe na lista da Guilda.');
    }
    // Há gente bastante, no nível pedido: pela contagem a equipe serviria. Quem diz que não é o
    // servidor, com o motivo.
    expect(blocked.locked).toBe(false);
    expect(blocked.eligibleHeroIds.length).toBeGreaterThanOrEqual(blocked.teamMin);
    expect(blocked.canSend).toBe(false);
    expect(blocked.suggestedTeam).toEqual([]);
    if (blocked.sendBlockedReason === null) {
      throw new Error('O cenário esperava o motivo do servidor.');
    }
    await guildTab(page).click();
    const classy = destinationRow(page, blocked.modelId);
    await expect(classy).toContainText(blocked.sendBlockedReason);
    await expect(classy.locator('input[data-hero]')).toHaveCount(0);
    await expect(classy.getByRole('button', { name: /^Enviar/ })).toHaveCount(0);
    // A paleta também não monta equipe nenhuma para ele: diz o mesmo motivo.
    const orders = commandPosts(page);
    await palette(page, 'Enviar expedição');
    const list = page.getByRole('dialog');
    await list.getByRole('option').filter({ hasText: blocked.label }).click();
    await expect(list).toHaveCount(0);
    await expect(toasts(page)).toContainText(blocked.sendBlockedReason);
    expect(orders).toEqual([]);

    // Chegam uma Maga e mais um braço: agora há equipe, e a tela a traz marcada.
    await world.hero('Dora', { classId: 'mage' });
    await world.hero('Enzo');
    await world.passTime(MINUTE, page);
    const ready = await serverView(page, request);
    const open = ready.guild.available.find((entry) => entry.modelId === blocked.modelId);
    const mage = ready.guild.heroes.find((hero) => hero.name === 'Dora');
    if (open === undefined || mage === undefined) {
      throw new Error('O cenário esperava o destino e a Maga na visão.');
    }
    expect(open.canSend).toBe(true);
    expect(open.sendBlockedReason).toBeNull();
    expect(open.teamMin).toBe(3);
    expect(open.suggestedTeam).toHaveLength(3);
    expect(open.suggestedTeam).toContain(mage.id);
    await classy.getByText('Montar a equipe').click();
    // As caixas: uma por herói que o servidor lista, e marcadas as da equipe que ele sugere.
    await expect(classy.locator('input[data-hero]')).toHaveCount(open.eligibleHeroIds.length);
    expect((await marked(classy)).sort()).toEqual([...open.suggestedTeam].sort());
    // O jogador troca um: tira um dos sugeridos (não a Maga) e põe quem tinha ficado de fora.
    const out = open.suggestedTeam.find((heroId) => heroId !== mage.id);
    const into = open.eligibleHeroIds.find((heroId) => !open.suggestedTeam.includes(heroId));
    if (out === undefined || into === undefined) {
      throw new Error('O cenário esperava ter quem trocar na equipe.');
    }
    const send = classy.getByRole('button', { name: /^Enviar/ });
    await classy.locator(`input[data-hero="${out}"]`).uncheck();
    // Com dois marcados a equipe não tem o tamanho que o destino pede: nada se envia.
    await expect(send).toBeDisabled();
    await classy.locator(`input[data-hero="${into}"]`).check();
    await expect(send).toBeEnabled();
    const three = [...open.suggestedTeam.filter((heroId) => heroId !== out), into].sort();
    expect((await marked(classy)).sort()).toEqual(three);
    await send.click();
    await expect(away(page).locator('[data-expedition]')).toHaveCount(1);
    expect(sendsIn(orders)).toEqual([{ modelId: open.modelId, heroIds: three }]);
    const first = await serverView(page, request);
    const nameOf = (heroId: string) =>
      ready.guild.heroes.find((hero) => hero.id === heroId)?.name ?? heroId;
    expect([...(first.guild.expeditions[0]?.teamNames ?? [])].sort()).toEqual(
      three.map(nameOf).sort(),
    );

    // Os dois que ficaram formam a equipe do destino de dois: já vêm marcados, e partem. (A
    // montagem desse destino existia desde o começo, com outra sugestão: a que vale é a de agora.)
    const pair = first.guild.available.find(
      (entry) => entry.canSend && entry.teamMin === 2 && entry.teamMax === 2,
    );
    if (pair === undefined) {
      throw new Error('O cenário esperava um destino de dois heróis que pudesse partir.');
    }
    expect(pair.suggestedTeam).toHaveLength(2);
    const duo = destinationRow(page, pair.modelId);
    await duo.getByText('Montar a equipe').click();
    expect((await marked(duo)).sort()).toEqual([...pair.suggestedTeam].sort());
    await duo.getByRole('button', { name: /^Enviar/ }).click();
    await expect(away(page).locator('[data-expedition]')).toHaveCount(2);
    expect(sendsIn(orders)).toEqual([
      { modelId: open.modelId, heroIds: three },
      { modelId: pair.modelId, heroIds: [...pair.suggestedTeam].sort() },
    ]);
    const both = await serverView(page, request);
    expect(both.guild.expeditions.map((entry) => entry.teamNames.length).sort()).toEqual([2, 3]);
    expect(await eventsOf(page, request, 'expeditionSent')).toHaveLength(2);
    await expect(toasts(page).getByRole('alert')).toHaveCount(0);
    expect(await overflow(page)).toEqual({ page: 0, content: 0 });
  });

  test('critério 2 inteiro: enviar pela tela, a equipe chega à encruzilhada, o aviso "Escolher caminho" abre a escolha, e o relatório traz o passo escolhido (A18 e A19)', async ({
    context,
    request,
    world,
  }) => {
    const page = await world.open(context);
    await openGuildWith(world, page, [{ name: 'Aldo', level: 10 }]);
    const start = await serverView(page, request);
    // O destino de um herói só que tem encruzilhada: o que leva de um a dois.
    const journey = start.guild.available.find(
      (entry) => entry.canSend && entry.teamMin === 1 && entry.teamMax === 2,
    );
    if (journey === undefined) {
      throw new Error('O cenário esperava um destino de um herói com encruzilhada.');
    }
    await guildTab(page).click();
    const row = destinationRow(page, journey.modelId);
    await row.getByText('Montar a equipe').click();
    const orders = commandPosts(page);
    await row.getByRole('button', { name: /^Enviar/ }).click();
    await expect(away(page).locator('[data-expedition]')).toHaveCount(1);
    expect((await serverView(page, request)).pendingDecisions).toEqual([]);

    // O jogador vai cuidar do feudo; a equipe anda sozinha até a encruzilhada.
    await page.getByRole('tab', { name: 'Feudo' }).click();
    const arrived = await until(world, page, request, 'a equipe na encruzilhada', (view) =>
      view.guild.expeditions.some((entry) => entry.crossroads !== null),
    );
    const { expedition, crossroads } = waitingIn(arrived);
    expect(await eventsOf(page, request, 'expeditionAtCrossroads')).toHaveLength(1);
    // O aviso chega com o prazo, o que a Postura fará e o botão que abre a escolha.
    const notice = toasts(page).getByRole('status').filter({ hasText: crossroads.title });
    await expect(notice).toContainText(expedition.label);
    await expect(notice).toContainText(crossroads.postureText);
    await notice.getByRole('button', { name: 'Escolher caminho' }).click();
    await expect(page).toHaveURL(/#\/guilda$/);
    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText(crossroads.text);
    await expect(dialog).toContainText(crossroads.postureText);
    // O jogador escolhe um caminho que não é o da Postura (o primeiro que a equipe pode tomar).
    const chosen =
      crossroads.options.find(
        (option) => !option.locked && option.id !== crossroads.postureOptionId,
      ) ?? crossroads.options.find((option) => !option.locked);
    if (chosen === undefined) {
      throw new Error('O cenário esperava um caminho que a equipe pudesse tomar.');
    }
    await dialog.getByRole('option').filter({ hasText: chosen.label }).click();
    await expect(dialog).toHaveCount(0);
    await expect(crossroadsCard(page)).toHaveCount(0);
    expect(orders.map((order) => order.type)).toEqual(['sendExpedition', 'chooseExpeditionPath']);
    expect(await eventsOf(page, request, 'expeditionPathChosen')).toHaveLength(1);

    // A equipe segue pelo caminho escolhido e volta: o relatório o traz, passo a passo.
    const home = await until(
      world,
      page,
      request,
      'a equipe de volta',
      (view) => view.guild.expeditions.length === 0,
    );
    const report = home.guild.reports.find((entry) => entry.expeditionId === expedition.id);
    if (report === undefined) {
      throw new Error('O cenário esperava o relatório da jornada.');
    }
    const step = report.log.find((entry) => entry.outcome === 'chosen');
    expect(step?.title).toBe(crossroads.title);
    expect(step?.text).toContain(chosen.label);
    expect(await eventsOf(page, request, 'expeditionPostureDecided')).toHaveLength(0);
    await guildTab(page).click();
    const sheet = reports(page).locator(`[data-report="${expedition.id}"]`);
    const steps = sheet.getByRole('list', { name: `O percurso de ${report.label}` });
    await expect(steps.getByRole('listitem')).toHaveCount(report.log.length);
    await expect(steps).toContainText(step?.text ?? 'sem o passo escolhido');
    // O que veio depois da encruzilhada também está lá: o nó do caminho escolhido.
    const after = report.log.slice(report.log.findIndex((entry) => entry.outcome === 'chosen') + 1);
    expect(after.length).toBeGreaterThan(0);
    for (const entry of after) {
      await expect(steps).toContainText(entry.title);
    }
    await expect(sheet).toContainText(report.lootText);
  });

  test('critério 2, sem resposta: a equipe enviada pela tela espera o prazo inteiro, a Postura decide, e o relatório e a Crônica contam isso (A18)', async ({
    context,
    request,
    world,
  }) => {
    const page = await world.open(context);
    await openGuildWith(world, page, [{ name: 'Aldo', level: 10 }]);
    const start = await serverView(page, request);
    const journey = start.guild.available.find(
      (entry) => entry.canSend && entry.teamMin === 1 && entry.teamMax === 2,
    );
    const [safest] = start.guild.postures;
    if (journey === undefined || safest === undefined) {
      throw new Error('O cenário esperava um destino de um herói e as Posturas na visão.');
    }
    await guildTab(page).click();
    const row = destinationRow(page, journey.modelId);
    await row.getByText('Montar a equipe').click();
    // A primeira Postura da lista, marcada pela tela: é ela que vai decidir.
    await row.locator(`input[data-posture="${safest.id}"]`).check();
    await row.getByRole('button', { name: /^Enviar/ }).click();
    await expect(away(page).locator('[data-expedition]')).toHaveCount(1);

    const arrived = await until(world, page, request, 'a equipe na encruzilhada', (view) =>
      view.guild.expeditions.some((entry) => entry.crossroads !== null),
    );
    const { expedition, crossroads } = waitingIn(arrived);
    expect(crossroads.postureLabel).toBe(safest.label);
    await expect(crossroadsCard(page)).toContainText(crossroads.postureText);
    const orders = commandPosts(page);
    // Ninguém responde. Um pouco antes do prazo a equipe ainda espera; passado ele, não mais.
    await world.passTime((crossroads.decidesInSeconds - 120) * 1000, page);
    expect((await serverView(page, request)).pendingDecisions).toHaveLength(1);
    await world.passTime(4 * MINUTE, page);
    expect((await serverView(page, request)).pendingDecisions).toEqual([]);
    const [decided] = await eventsOf(page, request, 'expeditionPostureDecided');
    if (decided === undefined) {
      throw new Error('O cenário esperava a linha da Postura na Crônica.');
    }
    // No meio da frase o caminho vem em minúscula: o que se confere é o nome dele.
    expect(decided.text.toLowerCase()).toContain(crossroads.postureOptionLabel.toLowerCase());
    expect(await eventsOf(page, request, 'expeditionPathChosen')).toHaveLength(0);
    expect(orders).toEqual([]);

    const home = await until(
      world,
      page,
      request,
      'a equipe de volta',
      (view) => view.guild.expeditions.length === 0,
    );
    const report = home.guild.reports.find((entry) => entry.expeditionId === expedition.id);
    const step = report?.log.find((entry) => entry.outcome === 'chosen');
    if (report === undefined || step === undefined) {
      throw new Error('O cenário esperava o relatório com o passo da encruzilhada.');
    }
    // O relatório diz que foi a Postura, e qual caminho ela tomou.
    expect(step.text).toContain(crossroads.postureOptionLabel);
    expect(step.text).toContain(crossroads.postureLabel);
    await guildTab(page).click();
    const sheet = reports(page).locator(`[data-report="${expedition.id}"]`);
    await expect(sheet.getByRole('list', { name: `O percurso de ${report.label}` })).toContainText(
      step.text,
    );
    // E a Crônica do feudo conta a decisão com a frase do servidor.
    await page.getByRole('tab', { name: 'Feudo' }).click();
    await fief(page).getByRole('button', { name: 'Abrir a Crônica' }).click();
    await expect(page.getByRole('tabpanel', { name: 'Crônica' })).toContainText(decided.text);
  });

  test('"Enviar o Resgate" na ficha de quem está em cativeiro monta a equipe, e o herói volta ao feudo (A20)', async ({
    context,
    request,
    world,
  }) => {
    const page = await world.open(context);
    await openGuildWith(world, page, [
      { name: 'Aldo' },
      { name: 'Berta', level: 10 },
      { name: 'Caio', level: 10 },
    ]);
    await world.captive('Aldo');
    await world.passTime(MINUTE, page);
    const held = await serverView(page, request);
    const captive = held.guild.heroes.find((hero) => hero.captive);
    const rescue = held.guild.available.find((entry) => entry.rescue);
    if (captive === undefined || rescue === undefined) {
      throw new Error('O cenário esperava um cativo e o Resgate na lista da Guilda.');
    }
    expect(held.guild.rescueTargetName).toBe(captive.name);
    expect(captive.nextRescued).toBe(true);
    expect(rescue.canSend).toBe(true);
    await guildTab(page).click();
    // O botão está na ficha do cativo, e só nela; a frase do cativeiro é a do servidor.
    await expect(heroes(page)).toContainText(held.guild.captiveText ?? 'sem a frase do cativeiro');
    await expect(heroes(page).locator('[data-rescue]')).toHaveCount(1);
    const button = heroes(page).locator(`[data-hero="${captive.id}"] [data-rescue]`);
    await expect(button).toHaveAccessibleName(`Enviar o Resgate de ${captive.name}`);
    const orders = commandPosts(page);
    await button.click();
    // A lista pergunta a equipe, um herói por vez, e depois a Postura.
    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText(rescue.label);
    await expect(dialog.getByRole('option')).toHaveCount(2);
    await page.keyboard.press('Enter');
    await expect(dialog.getByRole('option')).toHaveCount(1);
    await page.keyboard.press('Enter');
    await expect(dialog.getByRole('option')).toHaveCount(held.guild.postures.length);
    await page.keyboard.press('Enter');
    await expect(dialog).toHaveCount(0);
    await expect(away(page).locator('[data-expedition]')).toHaveCount(1);
    expect(sendsIn(orders)).toEqual([
      { modelId: rescue.modelId, heroIds: [...rescue.eligibleHeroIds].sort() },
    ]);
    // Com a equipe a caminho, o Resgate desse cativo não parte de novo: o botão sai da ficha.
    await expect(heroes(page).locator('[data-rescue]')).toHaveCount(0);

    // Na encruzilhada, o jogador escolhe o caminho da Postura pela folha; depois, a volta.
    const arrived = await until(world, page, request, 'a equipe na encruzilhada', (view) =>
      view.guild.expeditions.some((entry) => entry.crossroads !== null),
    );
    const { crossroads } = waitingIn(arrived);
    await crossroadsCard(page).locator(`[data-path="${crossroads.postureOptionId}"]`).click();
    await expect(crossroadsCard(page)).toHaveCount(0);
    const home = await until(
      world,
      page,
      request,
      'a equipe de volta',
      (view) => view.guild.expeditions.length === 0,
    );
    // O herói está de volta: no feudo, fora do cativeiro, e a Guilda já não oferece o Resgate.
    const freed = home.guild.heroes.find((hero) => hero.id === captive.id);
    expect(freed).toMatchObject({ captive: false, atHome: true });
    expect(home.guild.rescueTargetName).toBeNull();
    expect(home.guild.available.some((entry) => entry.rescue)).toBe(false);
    expect(await eventsOf(page, request, 'heroRescued')).toHaveLength(1);
    await expect(heroes(page).locator('[data-rescue]')).toHaveCount(0);
    await expect(heroes(page).locator(`[data-hero="${captive.id}"]`)).toContainText(
      freed?.statusText ?? 'sem a situação do herói',
    );
  });

  test('duas Patrulhas do mesmo herói: cada linha da Crônica abre o relatório da sua jornada, pelo identificador (A2)', async ({
    context,
    request,
    world,
  }) => {
    const page = await world.open(context);
    await openGuildWith(world, page, [{ name: 'Aldo', level: 10 }]);
    const start = await serverView(page, request);
    // O destino de um herói só, sem encruzilhada: o mais curto da lista.
    const short = start.guild.available.find(
      (entry) => entry.canSend && entry.teamMin === 1 && entry.teamMax === 1,
    );
    if (short === undefined) {
      throw new Error('O cenário esperava um destino de um herói só.');
    }
    await guildTab(page).click();
    const row = destinationRow(page, short.modelId);
    for (const journeys of [1, 2]) {
      await row.getByText('Montar a equipe').click();
      await row.getByRole('button', { name: /^Enviar/ }).click();
      await expect(away(page).locator('[data-expedition]')).toHaveCount(1);
      await until(
        world,
        page,
        request,
        'a equipe de volta',
        (view) => view.guild.expeditions.length === 0 && view.guild.reports.length === journeys,
      );
      await expect(reports(page).locator('[data-report]')).toHaveCount(journeys);
    }
    const returned = await eventsOf(page, request, 'expeditionReturned');
    expect(returned).toHaveLength(2);
    const ids = returned.map((event) => String(event.data.expeditionId));
    expect(new Set(ids).size).toBe(2);

    // Na aba Crônica, a linha da volta de cada jornada abre o relatório dela, e não o mais novo.
    const chronicle = page.getByRole('tabpanel', { name: 'Crônica' });
    const opened = (expeditionId: string) =>
      reports(page).locator(`[data-report="${expeditionId}"] details`);
    for (const [index, event] of returned.entries()) {
      await page.getByRole('tab', { name: 'Feudo' }).click();
      await fief(page).getByRole('button', { name: 'Abrir a Crônica' }).click();
      const lines = chronicle.getByRole('listitem').filter({ hasText: event.text });
      // Com as duas linhas iguais, palavra por palavra, a ordem delas é a das jornadas.
      const same = returned.filter((other) => other.text === event.text);
      await expect(lines).toHaveCount(same.length);
      await lines.nth(same.indexOf(event)).getByRole('button', { name: 'Ver o relatório' }).click();
      await expect(page).toHaveURL(/#\/guilda$/);
      const mine = ids[index] ?? '';
      const other = ids[1 - index] ?? '';
      await expect(opened(mine)).toHaveAttribute('open', '');
      await expect(opened(other)).not.toHaveAttribute('open', '');
    }
    // O documento que o jogador baixa não leva a marca que faz a ligação.
    const { url, headers } = await session(page);
    const clean = await request.get(`${url}/chronicle.md`, { headers });
    expect(await clean.text()).not.toContain('<!--');
    const linked = await request.get(`${url}/chronicle.md?links=1`, { headers });
    for (const expeditionId of ids) {
      expect(await linked.text()).toContain(`<!-- ${expeditionId} -->`);
    }
  });
});
