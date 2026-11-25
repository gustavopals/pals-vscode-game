import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';

import type { Page } from '@playwright/test';

import type { CurrentSeasonResponse, LeaderboardResponse } from '../../packages/protocol/src/api';
import {
  API,
  applyTheme,
  expect,
  HOUR,
  lowContrast,
  MINUTE,
  palette,
  playNow,
  session,
  test,
  THEMES,
} from './helpers';

const captureDir = process.env.LOTG_SEASON_CAPTURE_DIR;
const DAY = 24 * HOUR;
const nextMonday = () => {
  const now = new Date();
  const days = (8 - now.getUTCDay()) % 7 || 7;
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + days, 15);
};

async function capture(page: Page, name: string): Promise<void> {
  if (captureDir === undefined) return;
  await mkdir(captureDir, { recursive: true });
  await page.screenshot({ path: join(captureDir, name + '.png') });
}

const card = (page: Page) => page.getByRole('region', { name: 'Temporada', exact: true });
const selector = (page: Page) => page.getByRole('button', { name: /^Trocar de feudo/ });

test('inscreve outro feudo, guarda a escolha e publica ranking e Crônica no fecho', async ({
  world,
  context,
  request,
}) => {
  test.setTimeout(65_000);
  await world.jump(nextMonday() - Date.now());
  const page = await world.open(context);
  await page.setViewportSize({ width: 1366, height: 1000 });
  await playNow(page, 'Senhora das Pontes', 'Pedra Alta');
  const personal = await session(page);
  const currentResponse = await request.get(`${API}/v1/seasons/current`, {
    headers: personal.headers,
  });
  expect(currentResponse.ok()).toBe(true);
  const current = (await currentResponse.json()) as CurrentSeasonResponse;
  const before = await request.get(`${API}/v1/leaderboard?season=${current.season.id}`, {
    headers: personal.headers,
  });
  expect(await before.json()).toMatchObject({ published: false, entries: [] });

  await palette(page, 'Lords: Temporada');
  await expect(card(page).getByText(current.season.code)).toBeVisible();
  await expect(card(page).getByText('O ranking sai no fim da semana.')).toBeVisible();
  await expect(card(page).getByRole('table')).toHaveCount(0);
  await expect(selector(page)).toHaveCount(0);
  for (const theme of THEMES) {
    await applyTheme(page, theme);
    await expect(card(page).getByText('Senhor', { exact: true })).toBeVisible();
    await expect(card(page).getByText(/Rápido ·/)).toBeVisible();
    await expect.poll(() => lowContrast(page)).toEqual([]);
    if (theme !== 'high-contrast') await capture(page, `cartao-${theme}`);
  }

  await card(page).getByRole('button', { name: 'Entrar na Temporada' }).click();
  const confirmation = page.getByRole('dialog', { name: /Entrar na Temporada/ });
  await confirmation.getByRole('textbox').fill('Vigia da Lua');
  await confirmation.getByRole('button', { name: 'Entrar na Temporada' }).click();
  const seasonalHeading = page.getByRole('heading', { name: 'Vigia da Lua', level: 1 });
  const personalHeading = page.getByRole('heading', { name: 'Pedra Alta', level: 1 });
  await expect(seasonalHeading).toBeVisible();
  for (const theme of ['dark', 'light'] as const) {
    await applyTheme(page, theme);
    await expect(seasonalHeading).toBeVisible();
    const toggle = selector(page);
    await toggle.focus();
    await page.keyboard.press('Enter');
    const pick = page.getByRole('dialog', { name: 'Trocar de feudo' });
    await expect(pick.getByRole('option', { name: 'Temporada' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(pick.getByRole('option', { name: 'Meu feudo' })).toBeVisible();
    await capture(page, `seletor-${theme}`);
    await page.keyboard.press('Escape');
    await expect(toggle).toBeFocused();
  }

  // A paleta usa a mesma lista. O teclado escolhe o retorno ao feudo pessoal.
  await palette(page, 'Trocar de feudo');
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('Enter');
  await expect(personalHeading).toBeVisible();
  await expect(seasonalHeading).toHaveCount(0);
  await page.reload();
  await expect(personalHeading).toBeVisible();
  await selector(page).click();
  await page.getByRole('option', { name: 'Temporada' }).click();
  await expect(seasonalHeading).toBeVisible();
  await expect(personalHeading).toHaveCount(0);

  const polled: string[] = [];
  const record = (url: string) => {
    if (/\/v1\/games\/[^/]+\/(view|events)/.test(url)) polled.push(url);
  };
  page.on('request', (seen) => record(seen.url()));
  await world.passTime(MINUTE, page);
  expect(polled.length).toBeGreaterThanOrEqual(2);
  const personalPath = new URL(personal.url).pathname;
  expect(polled.every((url) => !new URL(url).pathname.startsWith(personalPath))).toBe(true);

  await palette(page, 'Lords: Temporada');
  const remaining = Date.parse(current.season.endsAt) - (Date.now() + world.offsetMs);
  await world.jump(remaining + 5_000, page);
  await expect(selector(page)).toHaveCount(0);
  expect(await world.control('jobs')).toMatchObject({
    closedSeasons: 1,
    archivedSeasonGames: 1,
    failed: 0,
  });
  await page.clock.fastForward(MINUTE);
  const ranking = card(page).getByRole('table', { name: /Ranking da Temporada/ });
  await expect(ranking.getByRole('row', { name: /Vigia da Lua/ })).toHaveAttribute(
    'aria-current',
    'true',
  );

  for (const theme of THEMES) {
    await applyTheme(page, theme);
    const read = ranking.getByRole('button', { name: 'Ler Crônica de Vigia da Lua' });
    await read.click();
    const chronicle = card(page).getByRole('region', { name: 'Crônica · Vigia da Lua' });
    await expect(
      chronicle.getByRole('heading', { name: /Crônica.*Vigia da Lua/, level: 4 }),
    ).toBeVisible();
    await expect(chronicle.getByRole('table').first()).toBeVisible();
    await expect.poll(() => lowContrast(page)).toEqual([]);
    await page.locator('.editor-content').evaluate((editor) => {
      editor.scrollTop = 0;
    });
    if (theme === 'high-contrast') {
      await page.setViewportSize({ width: 720, height: 900 });
      await expect(chronicle).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        720,
      );
    } else {
      await capture(page, `ranking-cronica-${theme}`);
    }
    await chronicle.getByRole('button', { name: 'Fechar Crônica' }).click();
    await expect(read).toBeFocused();
  }

  // A primeira leitura da nova semana ainda oferece o ranking publicado da antiga.
  await world.passTime(2 * MINUTE, page);
  await expect(card(page).getByText('O ranking sai no fim da semana.')).toBeVisible();
  await expect(
    card(page).getByRole('heading', { name: `Ranking · ${current.season.code}` }),
  ).toBeVisible();
  const refreshed = await session(page);
  const published = await request.get(`${API}/v1/leaderboard?season=${current.season.id}`, {
    headers: refreshed.headers,
  });
  expect((await published.json()) as LeaderboardResponse).toMatchObject({
    published: true,
    entries: [{ settlementName: 'Vigia da Lua', mine: true, chronicleAvailable: true }],
  });

  // Até a próxima quarta-feira, o Reino tem a oferta da nova semana.
  await expect(card(page).getByRole('button', { name: 'Entrar na Temporada' })).toBeVisible();
  await world.passTime(2 * DAY, page);
  await expect(card(page).getByText('Entrada encerrada')).toBeVisible();
  await expect(card(page).getByRole('button', { name: 'Entrar na Temporada' })).toHaveCount(0);
});
