import type { APIRequestContext, Page } from '@playwright/test';
import type { ViewState } from '../../packages/protocol/src/view';

import {
  applyTheme,
  expect,
  gameEvents,
  HOUR,
  lowContrast,
  MINUTE,
  overflow,
  playNow,
  serverView,
  test,
  THEMES,
  toasts,
  type World,
} from './helpers';

// V4F-T3: interações que os testes em Node não provam. Os cenários usam a API real; os prazos
// vêm da visão. Só o cenário do alerta injeta esse campo na resposta, para testar a apresentação
// independentemente de sortear um Desastre. Esta revisão escreveu os cenários sem executá-los.

const armyTab = (page: Page) => page.getByRole('tab', { name: 'Exército' });
const guildTab = (page: Page) => page.getByRole('tab', { name: 'Guilda' });
const destination = (page: Page) => page.locator('[data-destination="sabotage"]');

function commandPosts(page: Page): Array<{ type: string; payload: unknown }> {
  const sent: Array<{ type: string; payload: unknown }> = [];
  page.on('request', (outgoing) => {
    if (outgoing.method() === 'POST' && outgoing.url().endsWith('/commands')) {
      sent.push(outgoing.postDataJSON() as (typeof sent)[number]);
    }
  });
  return sent;
}

/** Chega ao outono pelos prazos do calendário; as tropas e heróis são postos depois da espera. */
async function autumnSite(world: World, page: Page, request: APIRequestContext) {
  world.seed('fase-f-tela-e2e');
  await playNow(page);
  await world.raise('watchtower', 3);
  for (let turn = 0; turn < 4; turn += 1) {
    const view = await serverView(page, request);
    if (view.calendar.season === 'autumn') {
      break;
    }
    await world.passTime((view.calendar.nextSeason.secondsUntil + 1) * 1000, page);
  }
  expect((await serverView(page, request)).calendar.season).toBe('autumn');
  await world.control('raise', { building: 'housing', level: 6 });
  await world.raise('barracks', 4);
  await world.raise('guild', 4);
  await world.stock('food', 900);
  await world.stock('gold', 900);
  await world.stock('wood', 900);
  await world.soldiers({ spearman: 6 });
  await world.hero('Alda', { classId: 'warrior', level: 10 });
  await world.hero('Bela', { classId: 'mage', level: 10 });
  await world.hero('Ciro', { classId: 'cleric', level: 10 });
  await world.passTime(MINUTE, page);
}

async function fillFront(page: Page, amount: string) {
  await page.getByTestId('post-center-front').focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('post-unit')).toBeFocused();
  await page.getByTestId('post-unit').selectOption('spearman');
  await page.getByTestId('post-amount').fill(amount);
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('post-dialog')).toHaveCount(0);
}

/** Salva e ativa a formação pela tela, com todos os soldados e um comandante. */
async function readyAssault(world: World, page: Page, request: APIRequestContext) {
  await autumnSite(world, page, request);
  await armyTab(page).click();
  await page.getByTestId('formation-name').fill('Vanguarda do Acampamento');
  await fillFront(page, '6');
  const view = await serverView(page, request);
  const hero = view.guild.heroes.find((entry) => entry.name === 'Alda');
  expect(hero).toBeDefined();
  await page.getByTestId('commander-center').selectOption(hero!.id);
  await page.getByTestId('formation-save').click();
  await expect(page.getByTestId('formation-activate')).toBeEnabled();
  await page.getByTestId('formation-activate').click();
  await expect(page.getByTestId('formation-active')).toBeVisible();
  await expect(page.getByTestId('war-attack-camp')).toBeEnabled();
}

async function march(page: Page) {
  await page.getByTestId('war-attack-camp').focus();
  await page.keyboard.press('Enter');
  const confirm = page.getByRole('dialog', { name: 'Atacar o Acampamento?' });
  await expect(confirm).toBeVisible();
  await confirm.getByRole('button', { name: 'Atacar o Acampamento', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('campaign-panel')).toBeVisible();
}

test.describe('sabotagem e Acampamento na interface (V4F-T3)', () => {
  test('a sabotagem mostra os contadores da visão, exige três heróis e envia uma equipe pelo teclado', async ({
    context,
    request,
    world,
  }) => {
    const page = await world.open(context);
    await autumnSite(world, page, request);
    await guildTab(page).click();
    const before = await serverView(page, request);
    const offer = before.guild.available.find((entry) => entry.modelId === 'sabotage');
    expect(offer).toBeDefined();
    expect(offer?.sabotage).not.toBeNull();
    const status = destination(page).getByTestId('sabotage-status');
    await expect(status).toContainText(`${offer?.sabotage?.attemptsLeft} tentativas restantes`);
    await expect(status).toContainText('Nenhuma onda enfraquecida ainda.');
    await destination(page).getByText('Montar a equipe', { exact: true }).click();
    const team = destination(page).getByRole('checkbox');
    await expect(team).toHaveCount(3);
    for (const hero of await team.all()) {
      await hero.check();
    }
    await team.last().uncheck();
    await expect(destination(page).getByRole('button', { name: /^Enviar/ })).toBeDisabled();
    await team.last().check();
    const posts = commandPosts(page);
    await destination(page)
      .getByRole('button', { name: /^Enviar/ })
      .focus();
    await page.keyboard.press('Enter');
    await expect.poll(() => posts.map((entry) => entry.type)).toEqual(['sendExpedition']);
    expect(posts[0]?.payload).toMatchObject({ modelId: 'sabotage', heroIds: expect.any(Array) });
    const sent = await serverView(page, request);
    const journey = sent.guild.expeditions.find((entry) => entry.label === offer!.label);
    expect(journey).toBeDefined();
    expect(
      sent.guild.available.find((entry) => entry.modelId === 'sabotage')?.sabotage?.attemptsLeft,
    ).toBe((offer?.sabotage?.attemptsLeft ?? 0) - 1);
    await expect(page.getByRole('region', { name: 'Expedições' })).toContainText(journey!.label);
    // Percorre os prazos que o servidor trouxe, escolhendo só caminhos já revelados.
    for (let step = 0; step < 20; step += 1) {
      const current = await serverView(page, request);
      const active = current.guild.expeditions.find((entry) => entry.id === journey!.id);
      if (active === undefined) {
        break;
      }
      if (active.crossroads !== null) {
        const choice = active.crossroads.options.find((entry) => !entry.locked);
        expect(choice).toBeDefined();
        const card = page.locator(`[data-crossroads="${active.id}"]`);
        await card.getByRole('button', { name: choice!.label, exact: true }).click();
        await expect(card).toHaveCount(0);
      } else {
        expect(active.nodeEndsInSeconds).not.toBeNull();
        await world.passTime((active.nodeEndsInSeconds! + 1) * 1000, page);
      }
    }
    const home = await serverView(page, request);
    expect(home.guild.expeditions).toHaveLength(0);
    const report = home.guild.reports.find((entry) => entry.expeditionId === journey!.id);
    expect(report).toBeDefined();
    const sheet = page.getByRole('region', { name: 'Relatórios' });
    await expect(sheet).toContainText(report!.lossesText);
    if (report!.deedsText !== null) {
      await expect(sheet).toContainText(report!.deedsText!);
    }
    const after = home.guild.available.find((entry) => entry.modelId === 'sabotage')!.sabotage!;
    await expect(status).toContainText(`${after.attemptsLeft} tentativas restantes`);
    for (const wave of after.wavesWeakened) {
      await expect(status).toContainText(`onda ${wave}`);
    }
  });

  test('o alerta entregue na visão aparece em palavra e ícone, junto dos contadores', async ({
    context,
    request,
    world,
  }) => {
    const page = await world.open(context);
    await autumnSite(world, page, request);
    await page.route('**/v1/games/*/view', async (route) => {
      const response = await route.fetch({
        headers: { ...route.request().headers(), 'if-none-match': '' },
      });
      const body = (await response.json()) as { view: ViewState };
      const offer = body.view.guild.available.find((entry) => entry.modelId === 'sabotage');
      expect(offer?.sabotage).not.toBeNull();
      if (offer?.sabotage !== null && offer?.sabotage !== undefined) {
        offer.sabotage = { attemptsLeft: 1, wavesWeakened: [2], alerted: true };
      }
      await route.fulfill({
        response,
        json: body,
        headers: { ...response.headers(), etag: 'W/"alerta-tela"' },
      });
    });
    await world.passTime(MINUTE, page);
    await guildTab(page).click();
    const status = destination(page).getByTestId('sabotage-status');
    await expect(status).toContainText('1 tentativa restante este ano.');
    await expect(status).toContainText('Ondas enfraquecidas: onda 2.');
    await expect(status.getByTestId('sabotage-alert')).toContainText('A Horda está em alerta');
    await expect(status.getByTestId('sabotage-alert').locator('.codicon-warning')).toHaveCount(1);
  });

  test('a simulação é identificada como defesa; a campanha muda nos prazos e Ver relatório foca a batalha correta', async ({
    context,
    request,
    world,
  }) => {
    const page = await world.open(context);
    await readyAssault(world, page, request);
    await expect(page.getByTestId('war-simulate')).toContainText('Simular defesa do feudo');
    await expect(page.getByTestId('war-preview-scope')).toContainText(
      'O ataque ao Acampamento ainda não tem prévia.',
    );
    await page.getByTestId('war-simulate').focus();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('war-preview')).toBeVisible();
    const posts = commandPosts(page);
    await page.getByTestId('war-attack-camp').click();
    const confirm = page.getByRole('dialog', { name: 'Atacar o Acampamento?' });
    await expect(confirm).toContainText('O feudo fica sem estes esquadrões por');
    await confirm.getByRole('button', { name: 'Desistir', exact: true }).click();
    expect(posts).toEqual([]);
    await march(page);
    expect(posts.map((entry) => entry.type)).toEqual(['attackCamp']);
    const marching = (await serverView(page, request)).army.campaign!;
    await expect(page.getByTestId('campaign-text')).toHaveText(marching.text);
    // Atualiza a cinco segundos da fronteira; a leitura seguinte precisa vir antes dos 30 s.
    await world.passTime((marching.battleInSeconds - 5) * 1000, page);
    await world.passTime(6000, page);
    const returning = (await serverView(page, request)).army.campaign!;
    expect(returning.phase).toBe('returning');
    expect(returning.reportId).not.toBeNull();
    await page.getByTestId('campaign-see-report').focus();
    await page.keyboard.press('Enter');
    const title = page.locator(`#battle-report-${returning.reportId}-title`);
    await expect(title).toBeFocused();
    await expect(title).toBeInViewport();
    const actual = (await serverView(page, request)).army.reports.find(
      (entry) => entry.id === returning.reportId,
    )!;
    await expect(title).toContainText(`${actual.modeLabel}: ${actual.outcomeLabel}`);
    await world.passTime((returning.returnsInSeconds - 5) * 1000, page);
    await world.passTime(6000, page);
    await expect(page.getByTestId('campaign-panel')).toHaveCount(0);
    expect((await serverView(page, request)).army.campaign).toBeNull();
  });

  test('uma incursão antes da volta ganha perigo em Antes de partir, mesmo com Defesa ativa', async ({
    context,
    request,
    world,
  }) => {
    const page = await world.open(context);
    await readyAssault(world, page, request);
    await march(page);
    const campaign = (await serverView(page, request)).army.campaign!;
    await world.control('raid-in', { inSeconds: Math.floor(campaign.returnsInSeconds / 2) });
    await world.passTime(MINUTE, page);
    const view = await serverView(page, request);
    expect(view.army.formations.some((entry) => entry.isActive)).toBe(true);
    expect(view.threat.incoming).not.toBeNull();
    await page.getByRole('tab', { name: 'Hoje' }).click();
    const first = page
      .getByRole('region', { name: 'Antes de partir' })
      .getByRole('listitem')
      .first();
    await expect(first).toHaveClass(/leaving-danger/);
    await expect(first).toContainText(view.threat.incoming!.text);
    await expect(first).toContainText(view.army.campaign!.text);
    await expect(first).toContainText('Retorno em');
    await first.getByRole('button', { name: 'Ver o Exército' }).focus();
    await page.keyboard.press('Enter');
    await expect(armyTab(page)).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#army-title')).toBeFocused();
  });

  test('outra aba muda os postos com a confirmação aberta: o ataque precisa de nova conferência', async ({
    context,
    request,
    world,
  }) => {
    const first = await world.open(context);
    await readyAssault(world, first, request);
    const second = await world.open(context, '/#/exercito');
    await expect(second.getByTestId('formation-list')).toBeVisible();
    const posts = commandPosts(first);
    await first.getByTestId('war-attack-camp').click();
    const confirm = first.getByRole('dialog', { name: 'Atacar o Acampamento?' });
    await expect(confirm).toBeVisible();
    await second.getByTestId('formation-edit').click();
    await fillFront(second, '5');
    await second.getByTestId('formation-save').click();
    await expect(second.getByTestId('formation-shortfall')).toContainText('Nada falta.');
    await expect
      .poll(async () => (await serverView(second, request)).army.formations[0]?.total)
      .toBe(5);
    // A outra página pode estar em segundo plano, cujo ciclo é de dois minutos.
    await world.passTime(2 * MINUTE, first, second);
    await confirm.getByRole('button', { name: 'Atacar o Acampamento', exact: true }).click();
    expect(posts.filter((entry) => entry.type === 'attackCamp')).toEqual([]);
    await expect(toasts(first)).toContainText('Nada foi enviado: confira o ataque de novo.');
    expect((await serverView(first, request)).army.campaign).toBeNull();
  });

  test('ao reabrir depois da campanha, Retorno conta uma batalha e a volta em linhas próprias', async ({
    context,
    request,
    world,
  }) => {
    const page = await world.open(context);
    await readyAssault(world, page, request);
    await march(page);
    await world.passTime(MINUTE, page);
    await page.close();
    await world.jump(4 * HOUR);
    const returned = await world.open(context);
    await expect(returned.getByRole('tab', { name: 'Hoje' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    const events = await gameEvents(returned, request);
    const battle = events.find((entry) => entry.type === 'battleFought')!;
    const assault = events.find((entry) => entry.type === 'campAssaulted')!;
    const home = events.find((entry) => entry.type === 'armyReturned')!;
    await expect(returned.locator('.report-cost')).toContainText(battle.text);
    await expect(returned.locator('.report-cost')).not.toContainText(assault.text);
    await expect(returned.locator('.report-prospered')).toContainText(home.text);
    await returned
      .locator('.report-prospered')
      .getByRole('listitem')
      .filter({ hasText: home.text })
      .getByRole('button', { name: 'Ver o Exército' })
      .click();
    await expect(armyTab(returned)).toHaveAttribute('aria-selected', 'true');
  });

  for (const theme of THEMES) {
    test(`campanha em 720 px e no tema ${theme}: teclado, foco e contraste`, async ({
      context,
      request,
      world,
    }) => {
      const page = await world.open(context);
      await readyAssault(world, page, request);
      await applyTheme(page, theme);
      await page.getByTestId('formation-edit').click();
      await page.setViewportSize({ width: 720, height: 1100 });
      await march(page);
      await expect(page.getByTestId('campaign-warning')).toBeVisible();
      expect(await overflow(page)).toEqual({ page: 0, content: 0 });
      expect(await lowContrast(page)).toEqual([]);
    });
  }
});
