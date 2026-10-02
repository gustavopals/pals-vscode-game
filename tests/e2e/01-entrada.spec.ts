import { type BrowserContext, type Page } from '@playwright/test';

import { expect, fief, MINUTE, playNow, statusBar, stored, test, toasts, tree } from './helpers';

// Critério 1 (GDD §16.1): abrir o endereço, "Jogar agora" e o primeiro comando em menos de
// 30 segundos, sem instalar nada, sem e-mail, senha ou formulário.

test.describe('primeira abertura', () => {
  test('sem conta: bancada completa e vazia, com as boas-vindas', async ({ context, world }) => {
    const requests: string[] = [];
    context.on('request', (request) => requests.push(request.url()));
    const page = await world.open(context);

    await expect(page).toHaveTitle('Lords of the Guild');
    await expect(page.getByRole('navigation', { name: 'Barra de atividades' })).toBeVisible();
    await expect(page.getByRole('complementary', { name: /Barra lateral/ })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Boas-vindas' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(statusBar(page)).toContainText('Lords of the Guild');
    await expect(page).toHaveURL(/#\/boas-vindas$/);

    const welcome = page.getByRole('tabpanel', { name: 'Boas-vindas' });
    await expect(welcome.getByRole('textbox')).toHaveCount(2);
    await expect(welcome.getByLabel('Nome do feudo')).toHaveValue('Pedra Alta');
    await expect(welcome.getByText(/e-mail|senha/i)).toHaveCount(0);
    // A dificuldade e o ritmo chegam do servidor, já com uma opção marcada em cada grupo.
    await expect(welcome.getByRole('radiogroup')).toHaveCount(2);
    await expect(welcome.getByRole('radio', { checked: true })).toHaveCount(2);
    // Antes de o jogador agir, só o que é público é consultado (a versão do servidor e as opções
    // de nova partida): nenhuma conta é criada.
    const api = requests.filter((url) => url.includes('/v1/')).map((url) => new URL(url).pathname);
    expect(api.sort()).toEqual(['/v1/catalog', '/v1/version']);
    expect(await stored(page)).toEqual({});
  });

  test('nada vem de fora: todos os recursos são da própria origem e a CSP é estrita', async ({
    context,
    world,
  }) => {
    const origins = new Set<string>();
    context.on('request', (request) => origins.add(new URL(request.url()).origin));
    const page = await world.open(context);
    await playNow(page);
    expect([...origins]).toEqual([new URL(page.url()).origin]);

    const policy = await page
      .locator('meta[http-equiv="Content-Security-Policy"]')
      .getAttribute('content');
    expect(policy).toContain("default-src 'self'");
    expect(policy).not.toMatch(/unsafe-inline|unsafe-eval|https?:/);
    // A política vale de verdade: um script embutido é barrado pelo navegador.
    const ran = await page.evaluate(() => {
      const script = document.createElement('script');
      script.textContent = 'window.__inline = true';
      document.head.append(script);
      return (window as { __inline?: boolean }).__inline === true;
    });
    expect(ran).toBe(false);
    world.problems.length = 0; // a violação acima foi provocada de propósito
  });

  test('"Jogar agora": dois campos, um clique, e o primeiro comando em menos de 30 s', async ({
    context,
    world,
  }) => {
    const calls: string[] = [];
    context.on('request', (request) => {
      const url = new URL(request.url());
      if (url.pathname.startsWith('/v1/') && request.method() !== 'GET') {
        calls.push(`${request.method()} ${url.pathname.replace(/[0-9a-f-]{36}/, ':id')}`);
      }
    });
    const startedAt = Date.now();
    const page = await world.open(context);
    const welcome = page.getByRole('tabpanel', { name: 'Boas-vindas' });
    // O primeiro campo já está com o foco: é só digitar.
    await expect(welcome.getByLabel('Como devemos chamar quem governa?')).toBeFocused();
    await page.keyboard.type('Gustavo');
    await welcome.getByRole('button', { name: 'Jogar agora' }).click();

    await expect(page.getByRole('heading', { name: 'Pedra Alta', level: 1 })).toBeVisible();
    await expect(page).toHaveURL(/#\/feudo$/);
    await expect(page).toHaveTitle('Pedra Alta · Lords of the Guild');
    // Do clique ao painel: criar a conta e fundar o feudo, nada mais.
    expect(calls).toEqual(['POST /v1/auth/anonymous', 'POST /v1/games']);

    await fief(page).getByRole('button', { name: 'Pôr mais um trabalhador em Fazenda' }).click();
    await expect(fief(page).getByText('Trabalhadores (1/5)')).toBeVisible();
    const elapsedSeconds = (Date.now() - startedAt) / 1000;
    expect(elapsedSeconds).toBeLessThan(30);
    test.info().annotations.push({
      type: 'tempo até o primeiro comando',
      description: `${elapsedSeconds.toFixed(1)} s (automatizado; o limite do critério é 30 s)`,
    });

    await expect(tree(page).getByRole('treeitem', { name: /Feudo: Pedra Alta/ })).toBeVisible();
    await expect(statusBar(page)).toContainText('Pedra Alta');
  });

  test('recarregar a página mantém a sessão e a aba; "voltar" anda entre as abas', async ({
    context,
    world,
  }) => {
    const page = await world.open(context);
    await playNow(page);
    await page.getByRole('tab', { name: 'Hoje' }).click();
    await expect(page).toHaveURL(/#\/hoje$/);
    await expect(page.getByRole('heading', { name: 'Relatório de Retorno' })).toBeVisible();

    await page.reload();
    await expect(page.getByRole('tab', { name: 'Hoje' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('heading', { name: 'Pedra Alta', level: 1 })).toBeVisible();

    await page.getByRole('tab', { name: 'Feudo' }).click();
    await expect(page).toHaveURL(/#\/feudo$/);
    await page.goBack();
    await expect(page.getByRole('tab', { name: 'Hoje' })).toHaveAttribute('aria-selected', 'true');
    await page.goForward();
    await expect(page.getByRole('tab', { name: 'Feudo' })).toHaveAttribute('aria-selected', 'true');
  });

  test('o botão "voltar" sai do app: endereço sem aba e redirecionamentos não prendem', async ({
    context,
    world,
  }) => {
    const page = await world.open(context, '/#/sobre');
    await expect(page.getByRole('tab', { name: 'Sobre' })).toHaveAttribute('aria-selected', 'true');
    // Entrar pelo endereço puro: o app põe a aba no endereço sem criar entrada no histórico.
    await page.goto('about:blank');
    await page.goto('/');
    await expect(page).toHaveURL(/#\/boas-vindas$/);
    await page.goBack();
    await expect(page).toHaveURL('about:blank');

    // Com feudo, voltar para as boas-vindas redireciona, e o voltar seguinte continua andando.
    await page.goto('/');
    await playNow(page);
    await page.getByRole('tab', { name: 'Hoje' }).click();
    await expect(page).toHaveURL(/#\/hoje$/);
    await page.goBack();
    await expect(page).toHaveURL(/#\/feudo$/);
    await page.goBack();
    // A entrada das boas-vindas vira o Feudo, sem empilhar outra.
    await expect(page).toHaveURL(/#\/feudo$/);
    await page.goBack();
    await expect(page).toHaveURL('about:blank');
  });

  test('as credenciais e o cache ficam só no armazenamento do site, com o prefixo lords.', async ({
    context,
    world,
  }) => {
    const page = await world.open(context);
    await playNow(page);
    const data = await stored(page);
    const keys = Object.keys(data).sort();
    expect(keys.some((key) => key === 'lords.tokens')).toBe(true);
    expect(keys.some((key) => key === 'lords.account:self')).toBe(true);
    expect(keys.some((key) => key.startsWith('lords.cache:self:'))).toBe(true);
    expect(await page.evaluate(() => document.cookie)).toBe('');
    expect(await page.evaluate(() => sessionStorage.length)).toBe(0);
  });

  test('um endereço de aba que não existe para quem não tem feudo leva às boas-vindas', async ({
    context,
    world,
  }) => {
    const page = await world.open(context, '/#/feudo');
    await expect(page.getByRole('tab', { name: 'Boas-vindas' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(page).toHaveURL(/#\/boas-vindas$/);
  });
});

// Critério 6 da v0.2 (GDD §16.2 e §13.9): dificuldade e ritmo são escolhidos ao fundar o feudo,
// ficam gravados e não mudam durante o ano. O servidor de teste roda no ritmo Normal: é ele que
// vem marcado, embora o recomendado seja o Rápido.

const welcomeTab = (page: Page) => page.getByRole('tabpanel', { name: 'Boas-vindas' });
const difficulty = (page: Page) =>
  welcomeTab(page).getByRole('radiogroup', { name: 'Dificuldade' });
const pace = (page: Page) => welcomeTab(page).getByRole('radiogroup', { name: 'Ritmo' });
const settings = (page: Page) => page.getByRole('tabpanel', { name: 'Preferências' });

/** Os corpos de `POST /v1/games` que saírem deste contexto. */
function watchNewGames(context: BrowserContext): Array<Record<string, unknown>> {
  const bodies: Array<Record<string, unknown>> = [];
  context.on('request', (request) => {
    if (request.method() === 'POST' && new URL(request.url()).pathname === '/v1/games') {
      bodies.push(request.postDataJSON() as Record<string, unknown>);
    }
  });
  return bodies;
}

async function openSettings(page: Page) {
  await page.getByRole('button', { name: 'Preferências' }).click();
  await expect(settings(page).getByRole('heading', { name: 'Preferências' })).toBeVisible();
}

/** Manda melhorar as Habitações e espera a obra aparecer. */
async function startHousing(page: Page) {
  await fief(page)
    .getByRole('listitem')
    .filter({ hasText: 'Habitações Nv1 → Nv2' })
    .getByRole('button', { name: 'Melhorar' })
    .click();
  await expect(fief(page).locator('.active-construction')).toContainText('Habitações → Nv2');
}

test.describe('dificuldade e ritmo ao fundar o feudo', () => {
  test('as boas-vindas trazem as duas escolhas do servidor, com o padrão marcado e uma frase por opção', async ({
    context,
    world,
  }) => {
    const page = await world.open(context);

    await expect(difficulty(page).getByRole('radio')).toHaveCount(3);
    await expect(difficulty(page).getByRole('radio', { name: 'Camponês' })).not.toBeChecked();
    await expect(
      difficulty(page).getByRole('radio', { name: 'Senhor (recomendado)' }),
    ).toBeChecked();
    await expect(difficulty(page).getByRole('radio', { name: 'Rei de Ferro' })).not.toBeChecked();

    await expect(pace(page).getByRole('radio')).toHaveCount(3);
    // O recomendado continua dito na tela; o marcado é o padrão deste servidor.
    await expect(
      pace(page).getByRole('radio', { name: 'Rápido: um ano em 56 horas (recomendado)' }),
    ).not.toBeChecked();
    await expect(pace(page).getByRole('radio', { name: 'Normal: um ano em 7 dias' })).toBeChecked();
    await expect(
      pace(page).getByRole('radio', { name: 'Tranquilo: um ano em 14 dias' }),
    ).not.toBeChecked();

    // Cada opção tem a sua frase, à vista e lida junto com a opção.
    for (const radio of await welcomeTab(page).getByRole('radio').all()) {
      await expect(radio).toHaveAccessibleDescription(/\S.{20,}/);
    }
    await expect(
      difficulty(page).getByRole('radio', { name: 'Camponês' }),
    ).toHaveAccessibleDescription(/ninguém deserta por fome/);
    await expect(
      pace(page).getByRole('radio', { name: 'Tranquilo: um ano em 14 dias' }),
    ).toHaveAccessibleDescription(/uma vez por dia/);
    await expect(welcomeTab(page).getByText(/uma vez por dia/)).toBeVisible();
    await expect(welcomeTab(page).getByText(/não mudam durante o ano/)).toBeVisible();
  });

  test('"Jogar agora" continua a um clique e funda o feudo com o que estava marcado', async ({
    context,
    world,
  }) => {
    const created = watchNewGames(context);
    const page = await world.open(context);
    await expect(pace(page)).toBeVisible();
    await welcomeTab(page).getByLabel('Como devemos chamar quem governa?').fill('Gustavo');
    await welcomeTab(page).getByRole('button', { name: 'Jogar agora' }).click();
    await expect(page.getByRole('heading', { name: 'Pedra Alta', level: 1 })).toBeVisible();
    // O corpo leva o que a tela mostrava marcado, sem o jogador ter mexido em nada.
    expect(created).toEqual([
      {
        settlementName: 'Pedra Alta',
        timezone: 'America/Sao_Paulo',
        vigilHourLocal: 20,
        difficulty: 'lord',
        timeScale: 1,
      },
    ]);

    await openSettings(page);
    await expect(settings(page)).toContainText(
      'Dificuldade: Senhor · Ritmo: Normal: um ano em 7 dias (não mudam durante o ano)',
    );
  });

  test('só com o teclado: Tab chega a cada grupo, as setas trocam a opção e Enter funda o feudo', async ({
    context,
    world,
  }) => {
    const created = watchNewGames(context);
    const page = await world.open(context);
    await expect(pace(page)).toBeVisible();
    await expect(welcomeTab(page).getByLabel('Como devemos chamar quem governa?')).toBeFocused();
    await page.keyboard.type('Urraca');
    await page.keyboard.press('Tab');
    await expect(welcomeTab(page).getByLabel('Nome do feudo')).toBeFocused();

    // Cada grupo é uma parada só do Tab, na opção marcada.
    await page.keyboard.press('Tab');
    await expect(
      difficulty(page).getByRole('radio', { name: 'Senhor (recomendado)' }),
    ).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(difficulty(page).getByRole('radio', { name: 'Rei de Ferro' })).toBeChecked();
    await expect(difficulty(page).getByRole('radio', { name: 'Rei de Ferro' })).toBeFocused();

    await page.keyboard.press('Tab');
    await expect(pace(page).getByRole('radio', { name: 'Normal: um ano em 7 dias' })).toBeFocused();
    await page.keyboard.press('ArrowUp');
    const fast = pace(page).getByRole('radio', {
      name: 'Rápido: um ano em 56 horas (recomendado)',
    });
    await expect(fast).toBeChecked();
    // O foco do teclado é visível na opção.
    expect(await fast.evaluate((element) => element.matches(':focus-visible'))).toBe(true);

    await page.keyboard.press('Tab');
    await expect(welcomeTab(page).getByRole('button', { name: 'Jogar agora' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { name: 'Pedra Alta', level: 1 })).toBeVisible();
    expect(created).toEqual([
      {
        settlementName: 'Pedra Alta',
        timezone: 'America/Sao_Paulo',
        vigilHourLocal: 20,
        difficulty: 'ironKing',
        timeScale: 3,
      },
    ]);

    // As Preferências mostram os dois, e o que a dificuldade muda, sem campo para editar.
    await openSettings(page);
    const game = settings(page).getByRole('group', { name: 'Esta partida' });
    await expect(game).toContainText(
      'Dificuldade: Rei de Ferro · Ritmo: Rápido: um ano em 56 horas (não mudam durante o ano)',
    );
    await expect(game).toContainText(/escolhe o pior caminho/);
    await expect(game.getByRole('radio')).toHaveCount(0);
    await expect(game.getByRole('button', { name: 'Nova partida…' })).toBeVisible();
  });

  test('duas partidas com ritmos diferentes mostram prazos diferentes, em tempo real', async ({
    browser,
    context,
    world,
  }) => {
    // Um feudo no ritmo Normal (o marcado) e outro, em outro navegador, no Rápido.
    const normal = await world.open(context);
    await expect(pace(normal)).toBeVisible();
    await playNow(normal, 'Gustavo', 'Vale Lento');

    const otherContext = await browser.newContext({
      locale: 'pt-BR',
      timezoneId: 'America/Sao_Paulo',
    });
    try {
      const fast = await world.open(otherContext);
      await pace(fast)
        .getByRole('radio', { name: /^Rápido/ })
        .check();
      await playNow(fast, 'Urraca', 'Vale Ligeiro');

      const housing = (page: Page) =>
        fief(page).getByRole('listitem').filter({ hasText: 'Habitações Nv1 → Nv2' });
      // A mesma obra, com o mesmo custo, leva tempos diferentes: a visão já vem em tempo real.
      await expect(housing(normal)).toContainText('4 min');
      await expect(housing(fast)).toContainText('1 min 20 s');
      await expect(fief(normal).getByText(/leva 20 min/)).toBeVisible();
      await expect(fief(fast).getByText(/leva 6 min 40 s/)).toBeVisible();

      await startHousing(normal);
      await startHousing(fast);
      await expect(fief(normal).locator('.active-construction')).toContainText(/0[34]:\d\d/);
      await expect(fief(fast).locator('.active-construction')).toContainText(/0[01]:\d\d/);

      // Um minuto e meio de relógio: a obra do feudo rápido terminou, a do outro continua.
      await world.passTime(MINUTE + 30_000, normal, fast);
      await expect(fief(fast).getByText('Habitações Nv2 → Nv3')).toBeVisible();
      await expect(fief(fast).getByText('Os pedreiros estão livres.')).toBeVisible();
      await expect(fief(normal).locator('.active-construction')).toContainText('Habitações → Nv2');

      await openSettings(fast);
      await expect(settings(fast)).toContainText('Ritmo: Rápido: um ano em 56 horas');
      await openSettings(normal);
      await expect(settings(normal)).toContainText('Ritmo: Normal: um ano em 7 dias');
    } finally {
      await otherContext.close();
    }
  });

  test('sem as opções (servidor de uma versão anterior), as boas-vindas funcionam como antes', async ({
    context,
    world,
  }) => {
    await context.route('**/v1/catalog', (route) =>
      route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ code: 'NOT_FOUND', message: 'Recurso não encontrado.' }),
      }),
    );
    const created = watchNewGames(context);
    const answered = context.waitForEvent('response', (response) =>
      response.url().endsWith('/v1/catalog'),
    );
    const page = await world.open(context);
    await answered;
    await expect(welcomeTab(page).getByRole('radiogroup')).toHaveCount(0);
    await expect(welcomeTab(page).getByText(/Dificuldade|Ritmo/)).toHaveCount(0);
    // Não é assunto do jogador: nenhum aviso.
    await expect(toasts(page).getByRole('status')).toHaveCount(0);
    await expect(toasts(page).getByRole('alert')).toHaveCount(0);

    await playNow(page);
    // Sem dificuldade nem ritmo no corpo: o feudo nasce com os padrões do servidor.
    expect(created).toEqual([
      { settlementName: 'Pedra Alta', timezone: 'America/Sao_Paulo', vigilHourLocal: 20 },
    ]);
    await openSettings(page);
    await expect(settings(page)).toContainText(
      'Dificuldade: Senhor · Ritmo: Normal: um ano em 7 dias (não mudam durante o ano)',
    );
  });
});
