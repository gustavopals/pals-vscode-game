import { mkdirSync } from 'node:fs';

import type { APIRequestContext, Page } from '@playwright/test';

import {
  API,
  applyTheme,
  expect,
  lowContrast,
  overflow,
  palette,
  playNow,
  test,
  THEMES,
  toasts,
  tree,
} from './helpers';

// A aba Reino (ADR 0021): os totais do reino, o ranking de ouro pelo nome do feudo e as
// estatísticas do jogador; a saída do ranking nas Preferências.

/** Onde as capturas da aba ficam, para quem revisa a tela (fora do repositório). */
const SHOTS = process.env.KINGDOM_SHOTS_DIR;

/** Um feudo de outra conta, fundado pela API, sem navegador. */
async function rival(request: APIRequestContext, displayName: string, settlementName: string) {
  const auth = await request.post(`${API}/v1/auth/anonymous`, {
    data: { displayName, deviceLabel: 'e2e' },
  });
  expect(auth.status()).toBe(201);
  const { accessToken } = (await auth.json()) as { accessToken: string };
  const game = await request.post(`${API}/v1/games`, {
    headers: { authorization: `Bearer ${accessToken}` },
    data: { settlementName, timezone: 'America/Sao_Paulo', vigilHourLocal: 20 },
  });
  expect(game.status()).toBe(201);
}

const kingdom = (page: Page) => page.getByRole('tabpanel', { name: 'Reino' });
const ranking = (page: Page) => kingdom(page).getByRole('table', { name: 'Ranking de ouro' });

test.describe('Reino', () => {
  test('abre pelo teclado e pela paleta, mostra o ranking e sai dele pelas Preferências', async ({
    context,
    request,
    world,
  }) => {
    // Monte Frio fica com o cofre cheio; Vau Raso nasce depois, com o ouro do começo.
    await rival(request, 'Conta Um', 'Monte Frio');
    await world.stock('gold', 12_450);
    await rival(request, 'Conta Dois', 'Vau Raso');

    const page = await world.open(context);
    await playNow(page, 'Gustavo Pals', 'Pedra Alta');

    // Pelo teclado: a atividade Conta (Enter), a linha da conta na árvore, a seta até "Reino"
    // e Enter.
    await page.getByRole('button', { name: 'Conta', exact: true }).focus();
    await page.keyboard.press('Enter');
    const account = tree(page).locator('[data-node="account"]');
    await account.focus();
    if ((await account.getAttribute('aria-expanded')) !== 'true') {
      await page.keyboard.press('ArrowRight');
    }
    for (let step = 0; step < 6; step += 1) {
      const node = await page.evaluate(
        () => (document.activeElement as HTMLElement).dataset.node ?? '',
      );
      if (node === 'account:kingdom') {
        break;
      }
      await page.keyboard.press('ArrowDown');
    }
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/#\/reino$/);
    await expect(kingdom(page).getByRole('heading', { name: 'Reino', level: 1 })).toBeVisible();

    const rows = ranking(page).locator('tbody tr');
    await expect(rows).toHaveCount(3);
    await expect(rows.nth(0)).toContainText('Monte Frio');
    await expect(rows.nth(0)).toContainText('12.450');
    await expect(ranking(page).locator('tr[aria-current="true"]')).toContainText(
      'Pedra Alta (seu feudo)',
    );
    // Nada pessoal na tela: nem o nome de quem governa nem o das outras contas.
    await expect(kingdom(page)).not.toContainText('Gustavo Pals');
    await expect(kingdom(page)).not.toContainText('Conta Um');
    await expect(kingdom(page).getByRole('list', { name: 'Totais do reino' })).toContainText(
      'Feudos3',
    );
    await expect(kingdom(page)).toContainText('Minhas estatísticas');
    await expect(kingdom(page)).toContainText('entre 3 feudos do ranking');

    // Pela paleta: fecha a aba e a reabre.
    await page.getByRole('button', { name: 'Fechar a aba Reino' }).click();
    await expect(page.getByRole('tab', { name: 'Reino', exact: true })).toHaveCount(0);
    await palette(page, 'Reino: estatísticas');
    await expect(ranking(page)).toBeVisible();

    // Sai do ranking pelas Preferências.
    await palette(page, 'Preferências');
    const listed = page.getByRole('checkbox', { name: 'Mostrar meu feudo no ranking' });
    await expect(listed).toBeChecked();
    await expect(page.getByRole('tabpanel', { name: 'Preferências' })).toContainText(
      'o nome do seu feudo e o ouro dele',
    );
    await listed.uncheck();
    await expect(toasts(page)).toContainText('Seu feudo saiu do ranking de ouro');
    await expect(listed).not.toBeChecked();

    await page.getByRole('tab', { name: 'Reino', exact: true }).click();
    await expect(ranking(page).locator('tbody tr')).toHaveCount(2);
    await expect(ranking(page)).not.toContainText('Pedra Alta');
    await expect(kingdom(page)).toContainText('Seu feudo está fora do ranking');

    // A outra conta também já não vê o feudo.
    const other = await request.post(`${API}/v1/auth/anonymous`, {
      data: { displayName: 'Conta Três', deviceLabel: 'e2e' },
    });
    const { accessToken } = (await other.json()) as { accessToken: string };
    const seen = await request.get(`${API}/v1/stats`, {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    const body = JSON.stringify(await seen.json());
    expect(body).not.toContain('Pedra Alta');
    expect(body).not.toContain('Gustavo Pals');

    // E volta.
    await palette(page, 'Preferências');
    await listed.check();
    await expect(toasts(page)).toContainText('Seu feudo voltou ao ranking de ouro');
    expect(world.problems).toEqual([]);
  });

  test('a aba fica legível nos três temas e em 720 px, sem transbordar', async ({
    context,
    request,
    world,
  }) => {
    await rival(request, 'Conta Um', 'Monte Frio');
    await world.stock('gold', 12_450);
    await rival(request, 'Conta Dois', 'Vau Raso das Três Pontes');
    const page = await world.open(context);
    await playNow(page);
    await palette(page, 'Reino: estatísticas');
    await expect(ranking(page)).toBeVisible();
    if (SHOTS !== undefined) {
      mkdirSync(SHOTS, { recursive: true });
    }

    for (const width of [1280, 720]) {
      await page.setViewportSize({ width, height: 900 });
      for (const theme of THEMES) {
        await applyTheme(page, theme);
        await expect(ranking(page)).toBeVisible();
        await expect(kingdom(page)).toContainText('Minhas estatísticas');
        expect(await lowContrast(page), `contraste no tema ${theme}, ${width} px`).toEqual([]);
        expect(await overflow(page), `transbordo no tema ${theme}, ${width} px`).toEqual({
          page: 0,
          content: 0,
        });
        if (SHOTS !== undefined) {
          await page.screenshot({ path: `${SHOTS}/reino-${theme}-${width}.png`, fullPage: true });
        }
      }
    }
    expect(world.problems).toEqual([]);
  });
});
