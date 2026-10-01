import {
  expect,
  fief,
  HOUR,
  MINUTE,
  playNow,
  resourceRow,
  statusBar,
  stock,
  stored,
  test,
  toasts,
  tree,
} from './helpers';

// Critérios 5 e 11 (GDD §16.1): reabrir depois de horas mostra o intervalo simulado pelo
// servidor, sem duplicar progresso; sem conexão, o app mostra o último estado, explica a
// situação e volta sozinho.

test.describe('fechar e reabrir', () => {
  test('depois de 5 horas: abre em Hoje, com o Relatório de Retorno e o que mudou', async ({
    context,
    world,
  }) => {
    const first = await world.open(context);
    await playNow(first);
    const plus = fief(first).getByRole('button', { name: 'Pôr mais um trabalhador em Fazenda' });
    await plus.click();
    await plus.click();
    await expect(fief(first).getByText('Trabalhadores (2/5)')).toBeVisible();
    await fief(first)
      .getByRole('listitem')
      .filter({ hasText: 'Habitações Nv1 → Nv2' })
      .getByRole('button', { name: 'Melhorar' })
      .click();
    await expect(fief(first).locator('.active-construction')).toBeVisible();
    const foodBefore = await stock(first, 'Comida');
    const goldBefore = await stock(first, 'Ouro');
    await first.close();

    await world.passTime(5 * HOUR);
    const page = await world.open(context);

    // O app abre na aba Hoje, sem o jogador pedir.
    await expect(page.getByRole('tab', { name: 'Hoje' })).toHaveAttribute('aria-selected', 'true');
    await expect(page).toHaveURL(/#\/hoje$/);
    const today = page.getByRole('tabpanel', { name: 'Hoje' });
    await expect(today.getByText('Você esteve fora por 5 horas.')).toBeVisible();
    await expect(today.getByText(/O mundo andou 2 dias de jogo/)).toBeVisible();
    await expect(today.getByText('Obras concluídas: 1')).toBeVisible();
    // 2 fazendeiros rendem 20/h e 5 aldeões comem 5/h: +15/h por 5 h, exatamente uma vez.
    const food = today.getByRole('row', { name: /^Comida/ });
    await expect(food).toContainText(String(foodBefore));
    await expect(food).toContainText(String(foodBefore + 75));
    await expect(food).toContainText('+75');
    await expect(today.getByRole('row', { name: /^Ouro/ })).toContainText(String(goldBefore));
    await expect(today.getByRole('listitem').filter({ hasText: /Habitações/ })).toBeVisible();

    // As novidades da ausência não viram avisos avulsos: ficam no relatório e no contador.
    await expect(toasts(page).getByRole('status')).toHaveCount(0);
    await expect(page).toHaveTitle(/^\(\d+\) Pedra Alta · Lords of the Guild$/);
    await expect(page.getByRole('tab', { name: 'Hoje' }).getByLabel('há novidades')).toBeVisible();

    await today.getByRole('button', { name: 'Marcar como lido' }).click();
    await expect(today.getByText('Nada de novo desde a sua última visita.')).toBeVisible();
    await expect(page).toHaveTitle('Pedra Alta · Lords of the Guild');

    await today.getByRole('button', { name: 'Ir para o feudo' }).click();
    expect(await stock(page, 'Comida')).toBe(foodBefore + 75);
    await expect(fief(page).getByText('Habitações Nv2 → Nv3')).toBeVisible();

    // Recarregar de novo não soma nada: o progresso não se duplica.
    await page.reload();
    await expect(page.getByRole('tab', { name: 'Feudo' })).toHaveAttribute('aria-selected', 'true');
    expect(await stock(page, 'Comida')).toBe(foodBefore + 75);
  });

  test('reabrir depois de pouco tempo não gera relatório e abre no Feudo', async ({
    context,
    world,
  }) => {
    const first = await world.open(context);
    await playNow(first);
    await first.close();
    await world.passTime(30 * MINUTE);
    const page = await world.open(context);
    await expect(page.getByRole('tab', { name: 'Feudo' })).toHaveAttribute('aria-selected', 'true');
    await page.getByRole('tab', { name: 'Hoje' }).click();
    await expect(
      page.getByRole('tabpanel', { name: 'Hoje' }).getByText('Nada de novo desde a sua última'),
    ).toBeVisible();
  });

  test('o ciclo de atualização traz sozinho o que mudou: 30 s à vista, 2 min em segundo plano', async ({
    context,
    world,
  }) => {
    const reads: number[] = [];
    const page = await world.open(context);
    await playNow(page);
    await fief(page).getByRole('button', { name: 'Pôr mais um trabalhador em Serraria' }).click();
    await expect(resourceRow(page, 'Madeira')).toContainText('crescendo');
    // Leituras concluídas: uma leitura com o token vencido são duas requisições (401 e 200).
    context.on('response', (response) => {
      if (response.url().endsWith('/view') && [200, 304].includes(response.status())) {
        reads.push(Date.now());
      }
    });
    expect(await stock(page, 'Madeira')).toBe(120);

    // 29 s não bastam; aos 30 s o app lê o servidor de novo, sem o jogador agir.
    await page.clock.fastForward(29_000);
    expect(reads).toHaveLength(0);
    await world.passTime(HOUR, page);
    await expect.poll(() => reads.length).toBe(1);
    await expect.poll(() => stock(page, 'Madeira')).toBe(128); // um lenhador rende 8/h

    // Em segundo plano a cadência cai para 2 minutos…
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
      Object.defineProperty(document, 'hidden', { value: true, configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await page.clock.fastForward(119_000);
    expect(reads).toHaveLength(1);
    await page.clock.fastForward(2_000);
    await expect.poll(() => reads.length).toBe(2);

    // …e voltar a olhar para a aba sincroniza na hora.
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
      Object.defineProperty(document, 'hidden', { value: false, configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await expect.poll(() => reads.length).toBe(3);
  });
});

test.describe('sem conexão', () => {
  test('mostra o último estado, explica, não envia nem guarda ordens e volta sozinho', async ({
    context,
    world,
  }) => {
    const page = await world.open(context);
    await playNow(page);
    await fief(page).getByRole('button', { name: 'Pôr mais um trabalhador em Serraria' }).click();
    await expect(fief(page).getByText('Trabalhadores (1/5)')).toBeVisible();

    const commands: string[] = [];
    context.on('request', (request) => {
      if (request.url().endsWith('/commands')) {
        commands.push(request.url());
      }
    });
    // A API cai: toda chamada falha na rede.
    await context.route('**/v1/**', (route) => route.abort('connectionrefused'));
    await page.clock.fastForward(31_000);

    const banner = fief(page).getByRole('status').filter({ hasText: 'Sem ligação com o reino.' });
    await expect(banner).toBeVisible();
    await expect(banner).toContainText('O mundo continua andando.');
    await expect(statusBar(page)).toContainText('Sem ligação com o reino');
    // O último estado continua à vista, em modo leitura.
    await expect(page.getByRole('heading', { name: 'Pedra Alta', level: 1 })).toBeVisible();
    expect(await stock(page, 'Madeira')).toBe(120);
    await expect(
      fief(page).getByRole('button', { name: 'Pôr mais um trabalhador em Serraria' }),
    ).toBeDisabled();
    await expect(fief(page).getByRole('button', { name: 'Recrutar 1 aldeão' })).toBeDisabled();
    for (const button of await fief(page).getByRole('button', { name: 'Melhorar' }).all()) {
      await expect(button).toBeDisabled();
    }
    const farm = tree(page).locator('[data-node="worker:farm"]');
    await farm.hover();
    await expect(farm.getByRole('button').first()).toBeDisabled();

    // Pela paleta a ordem é recusada na hora, com a explicação, e nada fica em fila.
    await page.keyboard.press('F1');
    await page.getByRole('combobox').fill('recrutar');
    await page.keyboard.press('Enter');
    await page.getByRole('dialog').getByRole('textbox').fill('1');
    await page.keyboard.press('Enter');
    await expect(toasts(page).getByRole('alert')).toContainText('Sua ordem não foi enviada');
    expect(commands).toEqual([]);

    // Recarregar sem rede… o app precisa da rede para carregar a página, mas o estado guardado
    // continua lá para a próxima abertura.
    const cached = Object.keys(await stored(page)).filter((key) => key.startsWith('lords.cache:'));
    expect(cached).toHaveLength(1);

    // A API volta. O app tenta de novo por conta própria (recuo de 5 s, 10 s, 20 s…).
    await context.unroute('**/v1/**');
    await world.passTime(HOUR, page);
    await expect(banner).toHaveCount(0);
    await expect(statusBar(page)).not.toContainText('Sem ligação');
    await expect.poll(() => stock(page, 'Madeira')).toBe(128); // um lenhador rende 8/h
    await expect(
      fief(page).getByRole('button', { name: 'Pôr mais um trabalhador em Serraria' }),
    ).toBeEnabled();
    // Nenhuma ordem "guardada" foi enviada na volta.
    expect(commands).toEqual([]);
    await expect(fief(page).getByText('A caminho')).toHaveCount(0);
  });

  test('"Tentar agora" e o aviso do navegador de que a rede voltou sincronizam na hora', async ({
    context,
    world,
  }) => {
    const page = await world.open(context);
    await playNow(page);
    await context.route('**/v1/**', (route) => route.abort('connectionrefused'));
    await page.clock.fastForward(31_000);
    const banner = fief(page).getByRole('status').filter({ hasText: 'Sem ligação com o reino.' });
    await expect(banner).toBeVisible();

    await banner.getByRole('button', { name: 'Tentar agora' }).click();
    await expect(banner).toBeVisible();

    await context.unroute('**/v1/**');
    // Sem esperar o recuo: o evento `online` do navegador basta.
    await page.evaluate(() => window.dispatchEvent(new Event('online')));
    await expect(banner).toHaveCount(0);
  });

  test('abrir a página com o servidor fora mostra o estado guardado, com a explicação', async ({
    context,
    world,
  }) => {
    const first = await world.open(context);
    await playNow(first);
    await fief(first).getByRole('button', { name: 'Pôr mais um trabalhador em Fazenda' }).click();
    await expect(fief(first).getByText('Trabalhadores (1/5)')).toBeVisible();
    await first.close();

    await context.route('**/v1/**', (route) => route.abort('connectionrefused'));
    const page = await world.open(context);
    await expect(page.getByRole('heading', { name: 'Pedra Alta', level: 1 })).toBeVisible();
    await expect(fief(page).getByText('Trabalhadores (1/5)')).toBeVisible();
    await expect(fief(page).getByText('Sem ligação com o reino.')).toBeVisible();

    await context.unroute('**/v1/**');
    await page.evaluate(() => window.dispatchEvent(new Event('online')));
    await expect(fief(page).getByText('Sem ligação com o reino.')).toHaveCount(0);
  });
});
