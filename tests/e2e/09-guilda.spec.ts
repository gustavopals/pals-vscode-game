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
      'Sem ligação com o reino: a equipe, os candidatos e os prazos são os do último estado conhecido do feudo.',
    );
    await expect(team(page)).toContainText(offer.name);
    for (const button of await guild(page)
      .getByRole('button', { name: /^(Contratar|Dispensar|Dar um festival)/ })
      .all()) {
      await expect(button).toBeDisabled();
    }
    await expect(statusBar(page)).toContainText('Sem ligação com o reino');
    await context.unroute('**/v1/**');
    await guild(page).getByRole('button', { name: 'Tentar agora' }).click();
    await expect(guild(page)).not.toContainText('Sem ligação com o reino');
  });

  test('a encruzilhada de uma expedição é anunciada na aba Hoje, leva à aba Guilda e, sem resposta, a Postura decide no prazo (V3D-T1)', async ({
    context,
    request,
    world,
  }) => {
    // O app ainda não envia expedição nem escolhe caminho (a interface é da V3D-T4): o que se
    // prova aqui é que o protocolo 3 não o quebra e que a decisão à espera aparece, com o prazo.
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

    // A equipe é posta na encruzilhada da Floresta Antiga, com a Postura Cautelosa e 6 h de prazo.
    await world.crossroads('cautious');
    await world.passTime(MINUTE, page);
    const waiting = await serverView(page, request);
    expect(waiting.guild.built).toBe(true);
    expect(waiting.pendingDecisions).toHaveLength(1);
    const [decision] = waiting.pendingDecisions;
    expect(decision).toMatchObject({
      kind: 'crossroads',
      title: 'Floresta Antiga: A trilha se divide',
    });
    expect(waiting.guild.heroes.map((hero) => hero.atHome)).toEqual([false]);
    expect(waiting.guild.expeditions[0]?.crossroads?.postureLabel).toBe('Cautelosa');

    await page.getByRole('tab', { name: 'Hoje' }).click();
    const decisions = page.getByRole('region', { name: 'Decisões pendentes (1)' });
    await expect(decisions).toContainText('Guilda: “Floresta Antiga: A trilha se divide”');
    await expect(decisions).toContainText('expira em');
    await decisions
      .getByRole('button', { name: 'Ver a Guilda: Floresta Antiga: A trilha se divide' })
      .click();
    await expect(page).toHaveURL(/#\/guilda$/);
    // A ficha diz onde ela está, na frase do servidor, e a dispensa de quem está fora é recusada
    // pelo motor, não oferecida às cegas.
    await expect(team(page).getByRole('listitem')).toContainText('Em expedição');
    // A barra de status não anuncia a encruzilhada como carta do Conselho.
    await expect(statusBar(page)).not.toContainText('decisão pendente');

    // Seis horas e um minuto depois ninguém respondeu: a Postura decidiu, e a decisão saiu.
    await world.passTime(6 * HOUR + MINUTE, page);
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
