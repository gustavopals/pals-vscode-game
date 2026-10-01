import { expect, fief, playNow, statusBar, stored, test, tree } from './helpers';

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
    await expect(welcome.getByText(/e-mail|senha|dificuldade|ritmo/i)).toHaveCount(0);
    // Antes de o jogador agir, só a versão do servidor é consultada: nenhuma conta é criada.
    const api = requests.filter((url) => url.includes('/v1/')).map((url) => new URL(url).pathname);
    expect(api).toEqual(['/v1/version']);
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
