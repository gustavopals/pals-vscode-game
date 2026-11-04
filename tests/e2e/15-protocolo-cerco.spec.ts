import { advanceTo, deriveViewState } from '../../packages/engine/src/index';
import { readySiege } from '../../packages/engine/src/siege.test-helpers';
import type { ViewResponse } from '../../packages/protocol/src/index';
import { expect, fief, playNow, stored, test, toasts } from './helpers';

// V4G-T2.7: compatibilidade de leitura, cache e 426. Escritos, mas não executados em
// 2026-10-30: PostgreSQL fora do ar por instrução do autor. A tela do Cerco é da V4G-T4.
const views = '**/v1/games/*/view';

test('o app envia protocolo 4 e lê siegeWave em Hoje sem tratá-la como carta', async ({
  context,
  world,
}) => {
  const page = await world.open(context);
  await playNow(page);
  const ready = readySiege();
  const state = advanceTo(ready, ready.siege!.atMs).state;
  const siege = deriveViewState(state, state.lastProcessedAt);
  const protocols: string[] = [];
  // Só a leitura recebe a visão pública de um cerco real do motor. Nenhuma ordem é
  // simulada; integração cobre a persistência e a troca entre ondas no servidor.
  await page.route(views, async (route) => {
    const headers = { ...route.request().headers() };
    protocols.push(headers['x-lords-protocol'] ?? 'ausente');
    delete headers['if-none-match'];
    const response = await route.fetch({ headers });
    const body = (await response.json()) as ViewResponse;
    await route.fulfill({
      response,
      headers: { ...response.headers(), etag: 'W/"protocolo-4-cerco"' },
      json: {
        ...body,
        view: { ...body.view, siege: siege.siege, pendingDecisions: siege.pendingDecisions },
      },
    });
  });
  await page.clock.fastForward(31_000);
  await expect(page.locator('.status-main')).toContainText('1 decisão pendente');
  await page.locator('.status-main').click();
  // Com a tela do Cerco integrada, a barra leva à decisão no Exército. Hoje continua
  // mostrando a mesma decisão como Cerco, sem abrir diálogos de carta ou encruzilhada.
  await expect(page).toHaveURL(/#\/exercito$/);
  await expect(page.getByRole('heading', { name: 'Cerco do Inverno', exact: true })).toBeFocused();
  await page.getByRole('tab', { name: 'Hoje', exact: true }).click();
  const today = page.getByRole('tabpanel', { name: 'Hoje' });
  const decision = siege.pendingDecisions.find((entry) => entry.kind === 'siegeWave')!;
  await expect(today.getByText(`Cerco: “${decision.title}”`, { exact: false })).toBeVisible();
  await expect(today.getByRole('button', { name: `Decidir: ${decision.title}` })).toHaveCount(0);
  await expect(
    today.getByRole('button', { name: `Escolher caminho: ${decision.title}` }),
  ).toHaveCount(0);
  expect(protocols.length).toBeGreaterThan(0);
  expect(protocols.every((value) => value === '4')).toBe(true);
});

test('o cache 3.2 é descartado e o cursor dos eventos sobrevive ao recarregamento', async ({
  context,
  world,
}) => {
  const page = await world.open(context);
  await playNow(page);
  const saved = await stored(page);
  const key = Object.keys(saved).find((entry) => entry.startsWith('lords.cache:'))!;
  const cache = JSON.parse(saved[key]!) as {
    version: string;
    lastSeq: number;
    view: { settlement: { name: string } };
  };
  cache.version = '3.2';
  cache.view.settlement.name = 'Visão antiga que deve ser descartada';
  await page.evaluate(({ key, cache }) => localStorage.setItem(key, JSON.stringify(cache)), {
    key,
    cache,
  });
  await page.route(views, (route) => route.abort('failed'));
  await page.reload();
  await expect(
    page.getByText('Visão antiga que deve ser descartada', { exact: false }),
  ).toHaveCount(0);

  const cursors: string[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.pathname.endsWith('/events')) cursors.push(url.searchParams.get('after') ?? 'ausente');
  });
  await page.unroute(views);
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await expect(fief(page)).toBeVisible();
  await expect.poll(() => cursors).toContain(String(cache.lastSeq));
  await expect
    .poll(async () => (JSON.parse((await stored(page))[key]!) as { version: string }).version)
    .toBe('4.2');
});

test('uma aba com protocolo 3 recebe 426 e pede para recarregar uma única vez', async ({
  context,
  world,
}) => {
  const page = await world.open(context);
  await playNow(page);
  const tokens = (await stored(page))['lords.tokens'];
  await page.route(views, (route) =>
    route.continue({
      headers: { ...route.request().headers(), 'x-lords-protocol': '3' },
    }),
  );
  const rejected = page.waitForResponse(
    (response) => response.url().endsWith('/view') && response.status() === 426,
  );
  await page.clock.fastForward(31_000);
  expect((await rejected).status()).toBe(426);
  await expect(toasts(page).getByRole('button', { name: 'Recarregar', exact: true })).toHaveCount(
    1,
  );
  await page.clock.fastForward(31_000);
  await expect(toasts(page).getByRole('button', { name: 'Recarregar', exact: true })).toHaveCount(
    1,
  );
  expect((await stored(page))['lords.tokens']).toBe(tokens);
});
