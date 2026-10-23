import type { Page } from '@playwright/test';

import {
  applyTheme,
  expect,
  lowContrast,
  MINUTE,
  overflow,
  playNow,
  serverView,
  statusBar,
  test,
  THEMES,
  tree,
  type World,
} from './helpers';

// V4C-T3.3 (GDD §13.4; ADR 0019, decisões 8 e 9): o editor de formação da aba Exército. A grade de
// três alas por duas linhas, o seletor de cada posto (Enter), o comandante de cada ala e "Salvar".
// O que está marcado é estado da tela; a ordem nasce em "Salvar". Tudo pelo teclado.

const armyTab = (page: Page) => page.getByRole('tab', { name: 'Exército' });
const editor = (page: Page) => page.getByTestId('formation-editor');
const saveButton = (page: Page) => page.getByTestId('formation-save');
/** As ordens (`POST …/commands`) que a página mandar daqui em diante. */
function commandPosts(page: Page): Array<{ type: string; payload: unknown }> {
  const sent: Array<{ type: string; payload: unknown }> = [];
  page.on('request', (outgoing) => {
    if (outgoing.method() === 'POST' && outgoing.url().endsWith('/commands')) {
      sent.push(outgoing.postDataJSON() as (typeof sent)[number]);
    }
  });
  return sent;
}
const post = (page: Page, wing: string, line: string) => page.getByTestId(`post-${wing}-${line}`);

/** Funda o feudo, ergue o Quartel, põe tropa e abre a aba Exército. */
async function openEditor(world: World, page: Page) {
  await playNow(page);
  await world.raise('housing', 6);
  await world.raise('barracks', 4);
  await world.soldiers({ spearman: 8, shieldbearer: 6, archer: 6, knight: 0 });
  await world.passTime(MINUTE, page);
  await armyTab(page).click();
  await expect(editor(page)).toBeVisible();
}

/** Põe uma unidade em um posto só pelo teclado: Enter abre, escolhe, digita, Enter aplica. */
async function fillPost(page: Page, wing: string, line: string, unit: string, amount: string) {
  await post(page, wing, line).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('post-dialog')).toBeVisible();
  await expect(page.getByTestId('post-unit')).toBeFocused();
  await page.getByTestId('post-unit').selectOption(unit);
  await page.getByTestId('post-amount').fill(amount);
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('post-dialog')).toHaveCount(0);
}

test.describe('o editor de formação (V4C-T3.3)', () => {
  test('setas andam entre os postos, Enter abre o seletor com foco, Esc volta ao posto', async ({
    context,
    world,
  }) => {
    const page = await world.open(context);
    await openEditor(world, page);
    await post(page, 'left', 'front').focus();
    await page.keyboard.press('ArrowRight');
    await expect(post(page, 'center', 'front')).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(post(page, 'center', 'back')).toBeFocused();
    await page.keyboard.press('ArrowLeft');
    await expect(post(page, 'left', 'back')).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('post-unit')).toBeFocused();
    // Só as unidades da linha (retaguarda): o Arqueiro, e não o Lanceiro.
    await expect(page.getByTestId('post-unit').locator('option')).toHaveCount(1);
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('post-dialog')).toHaveCount(0);
    await expect(post(page, 'left', 'back')).toBeFocused();
  });

  test('montar e salvar só pelo teclado: a ordem nasce em Salvar, e a ativa vira a Defesa', async ({
    context,
    request,
    world,
  }) => {
    const page = await world.open(context);
    await openEditor(world, page);
    const posts = commandPosts(page);
    await expect(saveButton(page)).toBeDisabled();
    await page.getByTestId('formation-name').fill('Muralha Firme');
    await fillPost(page, 'center', 'front', 'spearman', '5');
    await fillPost(page, 'center', 'back', 'archer', '3');
    // Montar não manda nada.
    expect(posts).toEqual([]);
    await saveButton(page).focus();
    await page.keyboard.press('Enter');
    await expect.poll(() => posts.length).toBe(1);
    expect(posts[0]).toMatchObject({
      type: 'saveFormation',
      payload: {
        id: null,
        name: 'Muralha Firme',
        posts: {
          center: { front: { unit: 'spearman', count: 5 }, back: { unit: 'archer', count: 3 } },
        },
      },
    });
    const view = await serverView(page, request);
    expect(view.army.formations).toHaveLength(1);
    const saved = view.army.formations[0];
    // A lista a mostra, e o editor adotou a salva: um segundo "Salvar" edita, não duplica.
    await expect(page.getByTestId(`formation-${saved?.id}`)).toContainText('Muralha Firme');
    await expect(page.getByTestId('formation-activate')).toBeVisible();
    await page.getByTestId('formation-activate').click();
    await expect(page.getByTestId('formation-active')).toBeVisible();
    expect((await serverView(page, request)).army.formations[0]?.isActive).toBe(true);
    await expect
      .poll(() => posts.map((entry) => entry.type))
      .toEqual(['saveFormation', 'setActiveFormation']);
  });

  test('apagar pede confirmação, e o comandante da Defesa ativa não parte', async ({
    context,
    request,
    world,
  }) => {
    const page = await world.open(context);
    await playNow(page);
    await world.raise('housing', 6);
    await world.raise('barracks', 4);
    await world.raise('guild', 1);
    await world.soldiers({ spearman: 6 });
    await world.hero('Aldo');
    await world.passTime(MINUTE, page);
    await armyTab(page).click();
    await page.getByTestId('formation-name').fill('Defesa de Aldo');
    await fillPost(page, 'center', 'front', 'spearman', '4');
    await expect(page.getByTestId('commander-center')).toContainText('Aldo');
    const before = await serverView(page, request);
    const aldoId = before.guild.heroes.find((hero) => hero.name === 'Aldo')?.id ?? '';
    await page.getByTestId('commander-center').selectOption(aldoId);
    await saveButton(page).click();
    await expect(page.getByTestId('formation-activate')).toBeVisible();
    await page.getByTestId('formation-activate').click();
    await expect(page.getByTestId('formation-active')).toBeVisible();

    const view = await serverView(page, request);
    const aldo = view.guild.heroes.find((hero) => hero.name === 'Aldo');
    expect(aldo?.commanding?.isActive).toBe(true);
    // Nenhum destino o aceita na equipe enquanto ele comanda a Defesa.
    for (const destination of view.guild.available) {
      expect(destination.eligibleHeroIds).not.toContain(aldo?.id);
    }

    // A árvore e a ficha do herói dizem o mesmo que a visão: a Defesa ativa e o comandante.
    await expect(tree(page).getByRole('treeitem', { name: /Exército/ })).toContainText(
      'Defesa: Defesa de Aldo',
    );
    await page.getByRole('tab', { name: 'Guilda' }).click();
    await expect(page.getByTestId('hero-commanding')).toContainText('Não parte em expedição');
    // A ficha também diz o que o herói faz como comandante, na frase da visão (V4D-T4.3).
    await expect(page.getByTestId('hero-commander-text')).toHaveText(
      new RegExp(aldo?.commanderText.replace(/[+%]/g, '\\$&') ?? ''),
    );
    await armyTab(page).click();

    // Tirar a Defesa ativa manda `setActiveFormation` com `id: null`; depois, o aviso na barra.
    const unset = commandPosts(page);
    await page.getByTestId('formation-unset-active').click();
    await expect.poll(() => unset.map((entry) => entry.type)).toEqual(['setActiveFormation']);
    expect(unset[0]?.payload).toMatchObject({ id: null });
    await expect(page.getByTestId('formation-active')).toHaveCount(0);
    await expect(statusBar(page)).toContainText('Sem Defesa ativa');
    // Reativar pela lista das salvas (o editor voltou vazio depois da troca de aba).
    await page.getByTestId('formation-set-active').first().click();
    await expect(page.getByTestId('formation-active')).toBeVisible();

    // A Defesa ativa não se apaga; uma reserva sim.
    await expect(page.getByTestId('formation-delete').first()).toBeDisabled();
    await page.getByTestId('formation-new').click();
    await page.getByTestId('formation-name').fill('Reserva');
    await fillPost(page, 'left', 'front', 'spearman', '2');
    await saveButton(page).click();
    await expect(page.getByTestId('formation-delete')).toHaveCount(2);

    // Apagar confirma na paleta antes de enviar.
    const posts = commandPosts(page);
    await page.getByTestId('formation-delete').nth(1).click();
    await expect(page.getByRole('dialog')).toContainText('Apagar a formação');
    expect(posts).toEqual([]);
    await page.getByRole('dialog').getByRole('button', { name: 'Apagar' }).click();
    await expect.poll(() => posts.map((entry) => entry.type)).toEqual(['deleteFormation']);
    await expect(page.getByTestId('formation-delete')).toHaveCount(1);
    await expect(page.getByTestId('formation-list')).not.toContainText('Reserva');
  });
});

test.describe('a aba Exército nos temas e em janela estreita (V4C-T3.5)', () => {
  test('três temas: contraste, e 720 px sem rolagem horizontal', async ({ browser, world }) => {
    const context = await browser.newContext({
      viewport: { width: 720, height: 900 },
      locale: 'pt-BR',
    });
    try {
      const page = await world.open(context);
      await openEditor(world, page);
      for (const theme of THEMES) {
        await applyTheme(page, theme);
        await page.getByTestId('formation-name').fill(`Muralha ${theme}`);
        await fillPost(page, 'center', 'front', 'spearman', '4');
        await saveButton(page).focus();
        await page.keyboard.press('Enter');
        await expect(page.getByTestId('formation-list')).toContainText(`Muralha ${theme}`);
        await expect(page.getByTestId('formation-activate')).toBeEnabled();
        await page.getByTestId('formation-activate').focus();
        await page.keyboard.press('Enter');
        await expect(page.getByTestId('formation-active')).toBeVisible();
        await expect(page.getByTestId('formation-list')).toBeVisible();
        expect(await lowContrast(page), `contraste no Exército, tema ${theme}`).toEqual([]);
        expect(await overflow(page), `rolagem a 720 px, tema ${theme}`).toEqual({
          page: 0,
          content: 0,
        });
        await page.screenshot({ path: test.info().outputPath(`exercito-${theme}-720.png`) });
        // A próxima montagem também começa vazia, e é salva e ativada naquele tema.
        await page.getByTestId('formation-new').focus();
        await page.keyboard.press('Enter');
      }
    } finally {
      await context.close();
    }
  });
});

test.describe('o Conselho de Guerra no editor (V4D-T4)', () => {
  test('simular pelo teclado mostra a prévia e a linha inimiga; mudar a formação a desatualiza', async ({
    context,
    request,
    world,
  }) => {
    const page = await world.open(context);
    await openEditor(world, page);
    await applyTheme(page, 'dark');
    await armyTab(page).click();
    // Sem formação salva, o Conselho pede que se salve.
    await expect(page.getByTestId('war-council-unsaved')).toBeVisible();
    await page.getByTestId('formation-name').fill('Muralha de Três');
    await fillPost(page, 'center', 'front', 'spearman', '5');
    await fillPost(page, 'left', 'front', 'shieldbearer', '4');
    await fillPost(page, 'center', 'back', 'archer', '3');
    await saveButton(page).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('war-simulate')).toBeEnabled();
    await expect(page.getByTestId('war-council-empty')).toBeVisible();
    const posts = commandPosts(page);
    await page.getByTestId('war-simulate').focus();
    await page.keyboard.press('Enter');
    await expect.poll(() => posts.map((entry) => entry.type)).toEqual(['simulateBattle']);
    await expect(page.getByTestId('war-preview')).toBeVisible();
    const view = await serverView(page, request);
    const preview = view.army.preview;
    expect(preview).not.toBeNull();
    await expect(page.getByTestId('war-wins')).toHaveText(
      new RegExp(`^${preview?.winsPercent}\\s*%`),
    );
    await expect(page.getByTestId('war-risk')).toHaveText(preview?.riskText ?? '');
    await expect(page.getByTestId('war-stale')).toHaveCount(0);
    // A linha "Inimigo (prev.)": uma célula por posto, com o texto da visão.
    for (const entry of preview?.knownEnemy ?? []) {
      await expect(page.getByTestId(`enemy-${entry.wing}-${entry.line}`)).toHaveText(entry.text);
    }
    expect(await lowContrast(page)).toEqual([]);
    await page.setViewportSize({ width: 1280, height: 1300 });
    await page.screenshot({
      path: '/tmp/claude-1000/-opt-pals-vscode-game/220c2719-684e-4dfc-93f2-404687422251/scratchpad/conselho-previa.png',
    });
    // Mexer na formação e salvar de novo deixa a prévia marcada como desatualizada.
    await fillPost(page, 'right', 'front', 'spearman', '2');
    await saveButton(page).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('war-stale')).toBeVisible();
  });
});
