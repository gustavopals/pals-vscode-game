import type { BrowserContext, Locator, Page } from '@playwright/test';

import type { ViewState } from '../../packages/protocol/src/view';
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

// QA-15 do roadmap da v0.2 e ADR 0011: a produção joga no ritmo Rápido (3×). Quem converte o
// tempo de jogo em tempo real é o servidor, uma vez só; o app mostra os segundos e as taxas que
// recebe. Se o app convertesse de novo, ou se a API anunciasse um prazo e cumprisse outro, estes
// cenários cairiam. O feudo é fundado no Rápido pelas boas-vindas: por isso rodam com a suíte,
// no servidor de ritmo 1, e também com `GAME_TIME_SCALE=3`, que sobe o servidor como o da
// produção (`GAME_TIME_SCALE=3 pnpm test:e2e 03-retorno-e-conexao -g "ritmo"`).

/** Cada visão que a API entregou a este navegador, em leituras e em respostas de ordens. */
function watchViews(context: BrowserContext): { latest(): Promise<ViewState> } {
  const arrived: Array<Promise<ViewState | null>> = [];
  context.on('response', (response) => {
    const path = new URL(response.url()).pathname;
    if (response.status() === 200 && /^\/v1\/games\/[^/]+\/(view|commands)$/.test(path)) {
      arrived.push(
        response.json().then(
          (body: { view: ViewState }) => body.view,
          // A página fechou com a resposta a caminho: não há corpo para ler.
          () => null,
        ),
      );
    }
  });
  return {
    latest: async () => {
      const views = (await Promise.all(arrived)).filter((view) => view !== null);
      const last = views.at(-1);
      if (last === undefined) {
        throw new Error('A API ainda não entregou nenhuma visão a este navegador.');
      }
      return last;
    },
  };
}

/** "Jogar agora" no ritmo Rápido, o da produção, esteja ele marcado de saída ou não. */
async function playFast(page: Page) {
  await page
    .getByRole('tabpanel', { name: 'Boas-vindas' })
    .getByRole('radiogroup', { name: 'Ritmo' })
    .getByRole('radio', { name: /^Rápido/ })
    .check();
  await playNow(page);
}

/** "39:58" ou "1:07:30" em segundos. */
function countdownSeconds(text: string): number {
  const clock = /\d+(?::\d\d)+/.exec(text);
  if (clock === null) {
    throw new Error(`Sem contagem regressiva em "${text}".`);
  }
  return clock[0].split(':').reduce((total, part) => total * 60 + Number(part), 0);
}

/**
 * A contagem na tela parte do prazo que a API deu e só desce com o relógio: nunca passa do que a
 * API disse e nunca fica mais que uns segundos abaixo (o tempo que o teste leva para olhar).
 * Tenta de novo por um instante: a visão pode ter chegado e a tela ainda não ter sido redesenhada.
 */
async function expectCountdown(shown: Locator, apiSeconds: number) {
  await expect(async () => {
    const seconds = countdownSeconds(await shown.innerText());
    expect(seconds).toBeLessThanOrEqual(apiSeconds);
    expect(seconds).toBeGreaterThan(apiSeconds - 10);
  }).toPass({ timeout: 3_000 });
}

test.describe('no ritmo da produção', () => {
  test('ritmo Rápido: os prazos na tela são os da API, e a obra termina na hora anunciada, não antes', async ({
    context,
    world,
  }) => {
    const views = watchViews(context);
    const page = await world.open(context);
    await playFast(page);
    const view = await views.latest();
    expect(view.settlement.paceLabel).toBe('Rápido: um ano em 56 horas');

    // A API anuncia cada prazo em segundos reais, um terço dos tempos de jogo do GDD, e a tela
    // escreve esse mesmo número, sem dividir de novo.
    const housing = fief(page).getByRole('listitem').filter({ hasText: 'Habitações Nv1 → Nv2' });
    const announced = view.constructions.available.find((entry) => entry.building === 'housing');
    expect(announced?.durationSeconds).toBe(80);
    await expect(housing).toContainText('1 min 20 s');
    expect(view.recruitment.secondsPerVillager).toBe(400);
    await expect(fief(page).getByText(/leva 6 min 40 s/)).toBeVisible();
    // O dia de jogo dura 40 minutos de relógio.
    expect(view.calendar.secondsToNextDay).toBeGreaterThan(2390);
    expect(view.calendar.secondsToNextDay).toBeLessThanOrEqual(2400);
    await expectCountdown(page.getByText(/próximo dia em/), view.calendar.secondsToNextDay);

    await housing.getByRole('button', { name: 'Melhorar' }).click();
    const active = fief(page).locator('.active-construction');
    await expect(active).toContainText('Habitações → Nv2');
    const started = (await views.latest()).constructions.active;
    expect(started?.totalSeconds).toBe(80);
    expect(started?.secondsRemaining).toBeGreaterThan(70);
    await expectCountdown(active.getByLabel(/^Termina em/), started?.secondsRemaining ?? 0);

    // Um minuto de relógio depois, a obra continua, na API e na tela, com os 20 s que faltam.
    // Convertida duas vezes, já teria terminado (aos 27 s).
    await world.passTime(MINUTE, page);
    const later = (await views.latest()).constructions.active;
    expect(later?.secondsRemaining).toBeGreaterThan(10);
    expect(later?.secondsRemaining).toBeLessThanOrEqual(20);
    await expect(active).toContainText('Habitações → Nv2');
    await expectCountdown(active.getByLabel(/^Termina em/), later?.secondsRemaining ?? 0);
    await expect(fief(page).getByText('Habitações Nv2 → Nv3')).toHaveCount(0);

    // Passados os 80 s anunciados, terminou. Sem conversão nenhuma, levaria 4 minutos.
    await world.passTime(21_000, page);
    await expect(fief(page).getByText('Os pedreiros estão livres.')).toBeVisible();
    await expect(fief(page).getByText('Habitações Nv2 → Nv3')).toBeVisible();
    expect((await views.latest()).constructions.active).toBeNull();
  });

  test('ritmo Rápido: depois de 5 horas fora, o relatório conta horas de relógio e o ganho é a taxa anunciada, uma vez só', async ({
    context,
    world,
  }) => {
    const views = watchViews(context);
    const first = await world.open(context);
    await playFast(first);
    const plus = fief(first).getByRole('button', { name: 'Pôr mais um trabalhador em Fazenda' });
    await plus.click();
    await plus.click();
    await expect(fief(first).getByText('Trabalhadores (2/5)')).toBeVisible();

    // A taxa já chega por hora de relógio: 2 fazendeiros rendem 60/h e 5 aldeões comem 15/h,
    // três vezes o +15/h do mesmo feudo no ritmo Normal. A tela mostra o número como veio.
    const rate = (await views.latest()).resources.find((entry) => entry.id === 'food')?.perHour;
    expect(rate).toBe(45);
    await expect(resourceRow(first, 'Comida')).toContainText('+45');
    const foodBefore = await stock(first, 'Comida');
    await first.close();

    await world.passTime(5 * HOUR);
    const page = await world.open(context);

    // A ausência é contada no relógio do jogador; o mundo, em dias de jogo (de 40 minutos).
    const today = page.getByRole('tabpanel', { name: 'Hoje' });
    await expect(today.getByText('Você esteve fora por 5 horas.')).toBeVisible();
    await expect(today.getByText(/O mundo andou 7 dias de jogo/)).toBeVisible();
    // +45/h por 5 h de relógio: nem os +75 do ritmo Normal, nem os +675 de converter duas vezes.
    const food = today.getByRole('row', { name: /^Comida/ });
    await expect(food).toContainText(String(foodBefore));
    await expect(food).toContainText(String(foodBefore + 225));
    await expect(food).toContainText('+225');

    await today.getByRole('button', { name: 'Ir para o feudo' }).click();
    expect(await stock(page, 'Comida')).toBe(foodBefore + 225);
    await expect(resourceRow(page, 'Comida')).toContainText('+45');
    // Recarregar não soma de novo.
    await page.reload();
    await expect(page.getByRole('tab', { name: 'Feudo' })).toHaveAttribute('aria-selected', 'true');
    expect(await stock(page, 'Comida')).toBe(foodBefore + 225);
  });
});
