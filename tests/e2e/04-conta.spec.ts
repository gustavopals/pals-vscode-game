import { type Page } from '@playwright/test';

import {
  API,
  expect,
  fief,
  HOUR,
  MINUTE,
  palette,
  playNow,
  statusBar,
  stock,
  stored,
  test,
  toasts,
  tree,
} from './helpers';

// Critérios 10 e 12 (GDD §16.1): o Código do Reino ou o GitHub em outro navegador mostram o
// mesmo feudo; excluir a conta bloqueia na hora e limpa o cache em todas as abas.

const welcomeTab = (page: Page) => page.getByRole('tab', { name: 'Boas-vindas' });

/** Gera o Código do Reino pela paleta e devolve o código mostrado. */
async function generateCode(page: Page): Promise<string> {
  await palette(page, 'gerar código');
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('Ele aparece só desta vez');
  const code = (await dialog.locator('code').innerText()).trim();
  await dialog.getByRole('button', { name: 'Já guardei' }).click();
  return code;
}

test.describe('Código do Reino', () => {
  test('gerar em um navegador e entrar em outro mostra o mesmo feudo', async ({
    browser,
    context,
    world,
  }) => {
    const page = await world.open(context);
    await playNow(page, 'Gustavo', 'Vale Sereno');
    await fief(page).getByRole('button', { name: 'Pôr mais um trabalhador em Pedreira' }).click();
    await expect(fief(page).getByText('Trabalhadores (1/5)')).toBeVisible();

    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await palette(page, 'gerar código');
    const dialog = page.getByRole('dialog');
    const code = (await dialog.locator('code').innerText()).trim();
    expect(code).toMatch(/^[A-HJ-NP-Z2-9]{4}(-[A-HJ-NP-Z2-9]{4}){4}$/);
    // Um clique fora não fecha o diálogo: o código só aparece esta vez.
    await page.mouse.click(5, 5);
    await expect(dialog.locator('code')).toBeVisible();
    await dialog.getByRole('button', { name: 'Copiar' }).click();
    await expect(dialog.getByRole('button', { name: 'Copiado' })).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(code);
    await dialog.getByRole('button', { name: 'Já guardei' }).click();
    // O código não fica guardado em lugar nenhum do navegador.
    expect(JSON.stringify(await stored(page))).not.toContain(code);
    expect(JSON.stringify(await stored(page))).not.toContain(code.replace(/-/g, ''));

    // Outro navegador: nada guardado, nenhuma sessão.
    const other = await browser.newContext({ locale: 'pt-BR' });
    try {
      const second = await world.open(other);
      await second.getByRole('button', { name: 'Usar Código do Reino' }).click();
      const input = second.getByRole('dialog');
      // Um código malformado é barrado antes de gastar uma tentativa no servidor.
      await input.getByRole('textbox').fill('PEDR-0000');
      await expect(input.getByText(/não aparece em nenhum código/)).toBeVisible();
      await expect(input.getByRole('button', { name: 'Entrar' })).toBeDisabled();
      await input.getByRole('textbox').fill(code.toLowerCase());
      await second.keyboard.press('Enter');

      await expect(second.getByRole('heading', { name: 'Vale Sereno', level: 1 })).toBeVisible();
      await expect(fief(second).getByText('Trabalhadores (1/5)')).toBeVisible();
      await expect(second.getByRole('tab', { name: 'Feudo' })).toHaveAttribute(
        'aria-selected',
        'true',
      );

      // Os dois navegadores governam o mesmo feudo: o que um faz, o outro vê ao sincronizar.
      await fief(second)
        .getByRole('button', { name: 'Pôr mais um trabalhador em Fazenda' })
        .click();
      await expect(fief(second).getByText('Trabalhadores (2/5)')).toBeVisible();
      await world.passTime(MINUTE, page, second);
      await expect(fief(page).getByText('Trabalhadores (2/5)')).toBeVisible();
    } finally {
      await other.close();
    }
  });

  test('um código errado é recusado com o motivo; o lembrete de ter um código some da conta', async ({
    context,
    world,
  }) => {
    const page = await world.open(context);
    await page.getByRole('button', { name: 'Usar Código do Reino' }).click();
    await page.getByRole('dialog').getByRole('textbox').fill('AAAA-BBBB-CCCC-DDDD-EEEE');
    await page.keyboard.press('Enter');
    await expect(toasts(page).getByRole('alert')).toBeVisible();
    await expect(welcomeTab(page)).toHaveAttribute('aria-selected', 'true');

    await playNow(page);
    await page.getByRole('button', { name: 'Conta', exact: true }).click();
    await expect(tree(page).getByRole('treeitem', { name: 'Gerar Código do Reino' })).toBeVisible();
    await generateCode(page);
    await expect(
      tree(page).getByRole('treeitem', { name: 'Trocar o Código do Reino' }),
    ).toBeVisible();
    // Gerar outro avisa que o anterior deixa de valer.
    await tree(page).getByRole('treeitem', { name: 'Trocar o Código do Reino' }).click();
    await expect(page.getByRole('dialog')).toContainText('Gerar outro invalida o anterior.');
    await page.keyboard.press('Escape');
  });
});

test.describe('várias abas', () => {
  test('duas abas por mais de 15 minutos: a sessão é renovada uma vez e nenhuma cai', async ({
    context,
    world,
  }) => {
    const refreshes: number[] = [];
    context.on('response', (response) => {
      if (response.url().endsWith('/auth/refresh')) {
        refreshes.push(response.status());
      }
    });
    const first = await world.open(context);
    await playNow(first);
    const second = await world.open(context);
    await expect(second.getByRole('heading', { name: 'Pedra Alta', level: 1 })).toBeVisible();

    // O access token vale 15 minutos. A cada 20, as duas abas precisam de um novo ao mesmo
    // tempo, e o refresh token só pode ser usado uma vez: uma renova, a outra reaproveita.
    for (let turn = 1; turn <= 4; turn += 1) {
      await world.passTime(20 * MINUTE, first, second);
      // Uma renovação por rodada, nunca duas: a segunda seria lida pelo servidor como reuso
      // do refresh token e encerraria a sessão das duas abas.
      expect(refreshes).toEqual(Array.from({ length: turn }, () => 200));
      await expect(first.getByRole('heading', { name: 'Pedra Alta', level: 1 })).toBeVisible();
      await expect(second.getByRole('heading', { name: 'Pedra Alta', level: 1 })).toBeVisible();
    }

    // Depois de 80 minutos, as duas abas ainda dão ordens ao mesmo feudo.
    await fief(first).getByRole('button', { name: 'Pôr mais um trabalhador em Fazenda' }).click();
    await expect(fief(first).getByText('Trabalhadores (1/5)')).toBeVisible();
    await fief(second).getByRole('button', { name: 'Pôr mais um trabalhador em Serraria' }).click();
    await expect(fief(second).getByText('Trabalhadores (2/5)')).toBeVisible();
    await expect(welcomeTab(first)).toHaveCount(0);
    await expect(welcomeTab(second)).toHaveCount(0);
    await expect(toasts(first).getByText(/sessão/i)).toHaveCount(0);
    await expect(toasts(second).getByText(/sessão/i)).toHaveCount(0);
  });

  test('"Jogar agora" em uma aba aparece na outra; sair em uma leva as duas às boas-vindas', async ({
    context,
    world,
  }) => {
    const first = await world.open(context);
    const second = await world.open(context);
    await playNow(first);
    await expect(second.getByRole('heading', { name: 'Pedra Alta', level: 1 })).toBeVisible();

    await first.getByRole('button', { name: 'Conta', exact: true }).click();
    await tree(first).getByRole('treeitem', { name: 'Sair desta máquina' }).click();
    const dialog = first.getByRole('dialog');
    // Conta anônima sem código: sair é perder o feudo, e o aviso diz isso.
    await expect(dialog).toContainText('você não poderá mais voltar a este feudo');
    await dialog.getByRole('button', { name: 'Sair desta máquina' }).click();

    await expect(welcomeTab(first)).toHaveAttribute('aria-selected', 'true');
    await expect(welcomeTab(second)).toHaveAttribute('aria-selected', 'true');
    await expect(statusBar(second)).toContainText('Lords of the Guild');
    // Nada da conta fica no navegador, nem credenciais nem cache.
    const left = Object.keys(await stored(second)).filter((key) => key !== 'lords.preferences');
    expect(left).toEqual([]);
    // Quem pediu para sair não recebe aviso de "sessão terminou".
    await expect(toasts(first).getByText(/sessão/i)).toHaveCount(0);
    await expect(toasts(second).getByText(/sessão/i)).toHaveCount(0);
  });

  test('sessão encerrada no servidor: volta às boas-vindas com aviso, sem parecer falta de rede', async ({
    context,
    world,
  }) => {
    const page = await world.open(context);
    await playNow(page);
    await world.control('revoke-sessions');
    await world.jump(20 * MINUTE, page);

    await expect(welcomeTab(page)).toHaveAttribute('aria-selected', 'true');
    await expect(toasts(page)).toContainText('A sessão neste navegador terminou.');
    await expect(page.getByText('Sem ligação com o reino')).toHaveCount(0);
    expect(Object.keys(await stored(page)).filter((key) => key.includes('cache'))).toEqual([]);
    expect(Object.keys(await stored(page))).not.toContain('lords.tokens');
  });
});

test.describe('excluir a conta', () => {
  test('pede confirmação e o nome do feudo, explica os prazos, bloqueia na hora e limpa as abas', async ({
    context,
    request,
    world,
  }) => {
    const first = await world.open(context);
    await playNow(first);
    const code = await generateCode(first);
    const second = await world.open(context);
    await expect(second.getByRole('heading', { name: 'Pedra Alta', level: 1 })).toBeVisible();
    const tokens = JSON.parse((await stored(first))['lords.tokens'] ?? '{}') as {
      accessToken: string;
      refreshToken: string;
    };

    await palette(first, 'excluir conta');
    const confirm = first.getByRole('dialog');
    await expect(confirm).toContainText('A conta é bloqueada na hora e não pode ser recuperada.');
    await expect(confirm).toContainText('depois de sete dias');
    await expect(confirm).toContainText('até 14 dias');
    await expect(confirm.getByRole('button', { name: /desfazer/i })).toHaveCount(0);
    // O texto dos prazos é a descrição do diálogo: leitores de tela o leem com o título.
    await expect(confirm).toHaveAccessibleDescription(/bloqueada na hora.*sete dias/);
    await confirm.getByRole('button', { name: 'Excluir a conta' }).click();

    const typed = first.getByRole('dialog');
    await typed.getByRole('textbox').fill('Pedra Baixa');
    await expect(typed.getByText('O nome não confere com o do feudo.')).toBeVisible();
    await expect(typed.getByRole('button', { name: 'Excluir para sempre' })).toBeDisabled();
    await typed.getByRole('textbox').fill('Pedra Alta');
    await typed.getByRole('button', { name: 'Excluir para sempre' }).click();

    await expect(welcomeTab(first)).toHaveAttribute('aria-selected', 'true');
    await expect(toasts(first)).toContainText('Conta excluída.');
    // A outra aba percebe e também limpa tudo.
    await expect(welcomeTab(second)).toHaveAttribute('aria-selected', 'true');
    for (const page of [first, second]) {
      const left = Object.keys(await stored(page)).filter((key) => key !== 'lords.preferences');
      expect(left).toEqual([]);
    }

    // Bloqueio imediato: nem o JWT, nem o refresh, nem o Código do Reino abrem mais nada.
    const me = await request.get(`${API}/v1/me`, {
      headers: { authorization: `Bearer ${tokens.accessToken}` },
    });
    expect(me.status()).toBe(401);
    const refresh = await request.post(`${API}/v1/auth/refresh`, {
      data: { refreshToken: tokens.refreshToken },
    });
    expect(refresh.status()).toBe(401);
    const recover = await request.post(`${API}/v1/auth/recover`, { data: { code } });
    expect(recover.status()).toBe(401);

    // E o navegador pode começar outro reino do zero.
    await playNow(first, 'Outra Pessoa');
    expect(await stock(first, 'Madeira')).toBe(120);
  });
});

test.describe('GitHub pelo navegador (device flow, com o GitHub simulado)', () => {
  /** Clica no botão dado, lê o código do diálogo e o confirma no GitHub de mentira. */
  async function authorize(
    world: { github: (action: string, data?: Record<string, unknown>) => Promise<unknown> },
    page: Page,
    githubId: number,
  ) {
    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText('Aguardando a confirmação no GitHub…');
    const userCode = (await dialog.locator('code').innerText()).trim();
    const link = dialog.getByRole('link', { name: 'Abrir github.test' });
    await expect(link).toHaveAttribute('href', 'https://github.test/login/device');
    await expect(link).toHaveAttribute('target', '_blank');
    await expect(link).toHaveAttribute('rel', /noopener/);
    await world.github('approve', { userCode, githubId });
    // O app consulta no intervalo que o GitHub pediu (5 s).
    await page.clock.fastForward(5_000);
    return userCode;
  }

  test('vincular a conta e, em outro navegador, entrar com o mesmo GitHub mostra o mesmo feudo', async ({
    browser,
    context,
    world,
  }) => {
    const page = await world.open(context);
    await playNow(page, 'Gustavo', 'Monte Claro');
    await fief(page).getByRole('button', { name: 'Pôr mais um trabalhador em Fazenda' }).click();
    await page.getByRole('button', { name: 'Conta', exact: true }).click();
    await expect(tree(page).getByRole('treeitem', { name: /Conta: Gustavo/ })).toContainText(
      'anônima',
    );
    await tree(page).getByRole('treeitem', { name: 'Vincular ao GitHub' }).click();
    await authorize(world, page, 4242);

    await expect(toasts(page)).toContainText('Conta de Gustavo vinculada ao GitHub.');
    await expect(tree(page).getByRole('treeitem', { name: /Conta: Gustavo/ })).toContainText(
      'GitHub',
    );
    await expect(tree(page).getByRole('treeitem', { name: 'Vincular ao GitHub' })).toHaveCount(0);
    // O token do GitHub não fica no navegador.
    expect(JSON.stringify(await stored(page))).not.toContain('gho_');

    const other = await browser.newContext({ locale: 'pt-BR' });
    try {
      const second = await world.open(other);
      await second.getByRole('button', { name: 'Entrar com GitHub' }).click();
      await authorize(world, second, 4242);
      await expect(second.getByRole('heading', { name: 'Monte Claro', level: 1 })).toBeVisible();
      await expect(fief(second).getByText('Trabalhadores (1/5)')).toBeVisible();
      await expect(toasts(second)).toContainText('Bem-vindo de volta, Gustavo.');
    } finally {
      await other.close();
    }
  });

  test('num conflito, pergunta qual feudo manter; desistir não muda nada', async ({
    browser,
    context,
    world,
  }) => {
    const page = await world.open(context);
    await playNow(page, 'Antiga', 'Feudo Velho');
    await palette(page, 'vincular ao github');
    await authorize(world, page, 777);
    await expect(toasts(page)).toContainText('vinculada ao GitHub');

    const other = await browser.newContext({ locale: 'pt-BR' });
    try {
      const second = await world.open(other);
      await playNow(second, 'Nova', 'Feudo Novo');
      await fief(second)
        .getByRole('button', { name: 'Pôr mais um trabalhador em Fazenda' })
        .click();
      await expect(fief(second).getByText('Trabalhadores (1/5)')).toBeVisible();
      await palette(second, 'vincular ao github');
      await authorize(world, second, 777);

      const choice = second.getByRole('dialog');
      await expect(choice).toContainText('Este GitHub já está vinculado a outro feudo');
      await expect(choice.getByRole('option')).toHaveCount(2);
      await expect(choice).toContainText('Usar o feudo de Antiga');
      await expect(choice).toContainText('será excluído');
      await second.keyboard.press('Escape');
      await expect(second.getByRole('heading', { name: 'Feudo Novo', level: 1 })).toBeVisible();

      // De novo, agora escolhendo o feudo que já estava vinculado.
      await palette(second, 'vincular ao github');
      await authorize(world, second, 777);
      await second.getByRole('dialog').getByRole('option').first().click();
      await expect(second.getByRole('heading', { name: 'Feudo Velho', level: 1 })).toBeVisible();
      await expect(fief(second).getByText('Trabalhadores (0/5)')).toBeVisible();
    } finally {
      await other.close();
    }
  });

  test('recusa, código vencido e desistência não mudam a conta', async ({ context, world }) => {
    const polls: string[] = [];
    context.on('request', (request) => {
      if (request.url().endsWith('/device/poll')) {
        polls.push(request.url());
      }
    });
    const page = await world.open(context);
    const start = page.getByRole('button', { name: 'Entrar com GitHub' });

    await start.click();
    let dialog = page.getByRole('dialog');
    let userCode = (await dialog.locator('code').innerText()).trim();
    await world.github('deny', { userCode });
    await page.clock.fastForward(5_000);
    await expect(toasts(page)).toContainText('a autorização foi recusada');
    await expect(page.getByRole('dialog')).toHaveCount(0);

    await start.click();
    dialog = page.getByRole('dialog');
    userCode = (await dialog.locator('code').innerText()).trim();
    // "Devagar": o GitHub pede mais intervalo, e o app obedece.
    await world.github('slowDown', { userCode });
    await page.clock.fastForward(5_000);
    await expect.poll(() => polls.length).toBe(2);
    await page.clock.fastForward(5_000);
    expect(polls).toHaveLength(2);
    await world.github('expire', { userCode });
    await page.clock.fastForward(5_000);
    await expect(toasts(page)).toContainText('O código do GitHub venceu');

    await start.click();
    await expect(page.getByRole('dialog')).toContainText('Aguardando a confirmação');
    const before = polls.length;
    await page.getByRole('dialog').getByRole('button', { name: 'Cancelar' }).click();
    await page.clock.fastForward(30_000);
    expect(polls.length).toBe(before);
    await expect(welcomeTab(page)).toHaveAttribute('aria-selected', 'true');
    expect(Object.keys(await stored(page))).not.toContain('lords.tokens');
  });
});

test('o lembrete do dia 3 aparece uma vez para a conta anônima sem código', async ({
  context,
  world,
}) => {
  const page = await world.open(context);
  await playNow(page);
  // Mantém o feudo alimentado: sem fazendeiros, três dias reais acabam em fome.
  for (let count = 0; count < 3; count += 1) {
    await fief(page).getByRole('button', { name: 'Pôr mais um trabalhador em Fazenda' }).click();
  }
  await expect(fief(page).getByText('Trabalhadores (3/5)')).toBeVisible();
  await page.close();

  await world.passTime(49 * HOUR);
  const later = await world.open(context);
  const reminder = toasts(later).getByRole('status').filter({ hasText: 'Proteja seu reino' });
  await expect(reminder).toContainText('limpar os dados de navegação apaga o acesso');
  await expect(reminder.getByRole('button', { name: 'Gerar Código do Reino' })).toBeVisible();
  await expect(reminder.getByRole('button', { name: 'Vincular ao GitHub' })).toBeVisible();
  await reminder.getByRole('button', { name: 'Não lembrar mais' }).click();
  await expect(reminder).toHaveCount(0);

  await later.reload();
  await expect(later.getByRole('heading', { name: 'Pedra Alta', level: 1 })).toBeVisible();
  await expect(toasts(later).getByText('Proteja seu reino')).toHaveCount(0);
});
