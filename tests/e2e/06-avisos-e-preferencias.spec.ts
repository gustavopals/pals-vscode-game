import { type Page } from '@playwright/test';

import { expect, fief, HOUR, MINUTE, palette, playNow, statusBar, test, toasts } from './helpers';

// GDD §13.5: avisar o essencial, nunca incomodar. Avisos no canto, contador no título da aba,
// notificações do navegador só a pedido, e o modo discreto.

const settings = (page: Page) => page.getByRole('tabpanel', { name: 'Preferências' });

async function openSettings(page: Page) {
  await page.getByRole('button', { name: 'Preferências' }).click();
  await expect(settings(page).getByRole('heading', { name: 'Preferências' })).toBeVisible();
}

/** Começa a melhoria das Habitações e espera a ordem ser aceita. */
async function startHousing(page: Page) {
  await fief(page)
    .getByRole('listitem')
    .filter({ hasText: 'Habitações Nv1 → Nv2' })
    .getByRole('button', { name: 'Melhorar' })
    .click();
  await expect(fief(page).locator('.active-construction')).toContainText('Habitações → Nv2');
}

const hide = (page: Page, hidden: boolean) =>
  page.evaluate((value) => {
    Object.defineProperty(document, 'visibilityState', {
      value: value ? 'hidden' : 'visible',
      configurable: true,
    });
    Object.defineProperty(document, 'hidden', { value, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  }, hidden);

test.describe('avisos', () => {
  test('no nível padrão, obra concluída não incomoda; com "Todos", vira aviso com Ver e Silenciar 2h', async ({
    context,
    world,
  }) => {
    const page = await world.open(context);
    await playNow(page);
    await fief(page).getByRole('button', { name: 'Recrutar 1 aldeão' }).click();
    await expect(fief(page).getByText('A caminho 1')).toBeVisible();
    await world.passTime(21 * MINUTE, page);
    await expect(fief(page).getByText('Aldeões 6')).toBeVisible();
    await expect(toasts(page).getByRole('status')).toHaveCount(0);

    await openSettings(page);
    await settings(page).getByRole('radio', { name: /Todos/ }).check();
    await page.getByRole('tab', { name: 'Hoje' }).click();
    await palette(page, 'construir');
    await page.getByRole('dialog').getByRole('combobox').fill('habita');
    await page.keyboard.press('Enter');
    await expect(statusBar(page)).toContainText('Habitações Nv2 ·');
    await world.passTime(5 * MINUTE, page);

    const notice = toasts(page)
      .getByRole('status')
      .filter({ hasText: 'os pedreiros ergueram as Habitações' });
    await expect(notice).toBeVisible();
    await expect(notice.getByRole('button', { name: 'Ver' })).toBeVisible();
    await expect(notice.getByRole('button', { name: 'Silenciar 2h' })).toBeVisible();
    // "Ver" leva ao Feudo e dispensa o aviso.
    await notice.getByRole('button', { name: 'Ver' }).click();
    await expect(page.getByRole('tab', { name: 'Feudo' })).toHaveAttribute('aria-selected', 'true');
    await expect(notice).toHaveCount(0);
  });

  test('"Silenciar 2h" cala os avisos; o que chega vira contador e, passado o prazo, volta a avisar', async ({
    context,
    world,
  }) => {
    const page = await world.open(context);
    await playNow(page);
    await openSettings(page);
    await settings(page).getByRole('radio', { name: /Todos/ }).check();
    await page.getByRole('tab', { name: 'Feudo' }).click();
    await palette(page, 'silenciar');
    await expect(toasts(page)).toContainText('silenciadas por 2 horas');

    await fief(page).getByRole('button', { name: 'Recrutar 1 aldeão' }).click();
    await expect(fief(page).getByText('A caminho 1')).toBeVisible();
    await page.getByRole('tab', { name: 'Hoje' }).click();
    await world.passTime(21 * MINUTE, page);
    // O aldeão chegou, mas calado: só o contador conta.
    await expect(
      toasts(page)
        .getByRole('status')
        .filter({ hasText: /aldeão|aldeões/i }),
    ).toHaveCount(0);
    await expect(page).toHaveTitle('(1) Pedra Alta · Lords of the Guild');
    await expect(page.getByRole('button', { name: 'Feudo: 1 novidade' })).toBeVisible();
    await expect(statusBar(page)).toContainText('1');
    // Ir ao feudo é ver a novidade: o contador zera.
    await page.getByRole('tab', { name: 'Feudo' }).click();
    await expect(page).toHaveTitle('Pedra Alta · Lords of the Guild');

    await world.passTime(2 * HOUR, page);
    await fief(page).getByRole('button', { name: 'Recrutar 1 aldeão' }).click();
    await expect(fief(page).getByText('A caminho 1')).toBeVisible();
    await world.passTime(21 * MINUTE, page);
    await expect(toasts(page).getByRole('status').filter({ hasText: /alde/i })).toBeVisible();
  });

  test('a fome avisa mesmo no nível padrão, e toma a barra de status', async ({
    context,
    world,
  }) => {
    const page = await world.open(context);
    await playNow(page);
    // Sem ninguém na Fazenda, a comida acaba em 36 horas.
    await world.passTime(3 * HOUR, page);
    await expect(toasts(page).getByRole('status')).toHaveCount(0);
    await world.passTime(34 * HOUR, page);

    await expect(statusBar(page)).toContainText('Fome em Pedra Alta');
    await expect(fief(page).getByText('Fome em andamento.')).toBeVisible();
    // Menos de 4 horas desde a última leitura: é aviso avulso, não Relatório de Retorno…
    await expect(page.getByRole('tab', { name: 'Feudo' })).toHaveAttribute('aria-selected', 'true');
  });

  test('com a aba em segundo plano, o título conta as novidades; as do navegador só a pedido', async ({
    context,
    world,
  }) => {
    const page = await world.open(context);
    // Um navegador que registra o que o app pede ao sistema de notificações.
    await page.addInitScript(() => {
      const state = { permission: 'default', requests: 0, shown: [] as string[] };
      class FakeNotification {
        static get permission() {
          return state.permission;
        }
        static async requestPermission() {
          state.requests += 1;
          state.permission = 'granted';
          return 'granted';
        }
        constructor(title: string, options?: { body?: string }) {
          state.shown.push(`${title}: ${options?.body ?? ''}`);
        }
      }
      Object.assign(window, { Notification: FakeNotification, __notifications: state });
    });
    await page.reload();
    const system = () =>
      page.evaluate(
        () =>
          (window as unknown as { __notifications: { requests: number; shown: string[] } })
            .__notifications,
      );

    await playNow(page);
    await openSettings(page);
    await settings(page).getByRole('radio', { name: /Todos/ }).check();
    // Até aqui, nenhuma permissão foi pedida.
    expect((await system()).requests).toBe(0);
    await settings(page)
      .getByRole('checkbox', { name: /Avisar também pelo navegador/ })
      .check();
    await expect.poll(async () => (await system()).requests).toBe(1);
    await expect(
      settings(page).getByRole('checkbox', { name: /Avisar também pelo navegador/ }),
    ).toBeChecked();

    await page.getByRole('tab', { name: 'Feudo' }).click();
    await startHousing(page);
    // Começar a obra cumpre um objetivo: esse aviso chega com a aba à vista e não conta.
    await expect(
      toasts(page)
        .getByRole('status')
        .filter({ hasText: /objetivo/i }),
    ).toBeVisible();
    await expect(page).toHaveTitle('Pedra Alta · Lords of the Guild');
    await hide(page, true);
    await world.passTime(5 * MINUTE, page);
    await expect(page).toHaveTitle('(1) Pedra Alta · Lords of the Guild');
    expect((await system()).shown).toHaveLength(1);
    expect((await system()).shown[0]).toMatch(/^Pedra Alta: .*Habitações/);

    await hide(page, false);
    // O aviso esperou na página, com os botões.
    const waiting = toasts(page)
      .getByRole('status')
      .filter({ hasText: 'os pedreiros ergueram as Habitações' });
    await expect(waiting.getByRole('button', { name: 'Ver' })).toBeVisible();
    await expect(waiting.getByRole('button', { name: 'Silenciar 2h' })).toBeVisible();
  });
});

test.describe('modo discreto', () => {
  test('barra de status e título mostram só um contador, e nenhum aviso aparece', async ({
    context,
    world,
  }) => {
    const page = await world.open(context);
    await playNow(page);
    await openSettings(page);
    await settings(page).getByRole('radio', { name: /Todos/ }).check();
    await page.getByRole('tab', { name: 'Feudo' }).click();
    await startHousing(page);
    await expect(statusBar(page)).toContainText('Habitações Nv2');

    await palette(page, 'modo discreto');
    await expect(statusBar(page).getByRole('button').first()).toHaveText(/^0[0-9]:\d\d$/);
    await expect(statusBar(page)).not.toContainText('Habitações');
    await expect(statusBar(page)).not.toContainText('Pedra Alta');
    await expect(page).toHaveTitle(/^\d\d:\d\d$/);

    await world.passTime(5 * MINUTE, page);
    await expect(fief(page).getByText('Habitações Nv2 → Nv3')).toBeVisible();
    await expect(toasts(page).getByRole('status')).toHaveCount(0);
    await expect(page.locator('.activity-badge')).toHaveCount(0);
    await expect(page).toHaveTitle(/^\d\d:\d\d$/);

    // Discreto não é mudo para o que o próprio jogador faz: a recusa de uma ordem aparece.
    await palette(page, 'construir');
    await page.getByRole('dialog').getByRole('combobox').fill('salão');
    await page.keyboard.press('Enter');
    await expect(toasts(page).getByRole('status')).toContainText('Faltam');
    await toasts(page).getByRole('button', { name: 'Dispensar aviso' }).click();

    // A escolha fica lembrada ao recarregar, e pode ser desfeita nas preferências.
    await page.reload();
    await expect(page).toHaveTitle(/^\d\d:\d\d$/);
    await openSettings(page);
    await settings(page)
      .getByRole('checkbox', { name: /Mostrar só um contador/ })
      .uncheck();
    await expect(statusBar(page)).toContainText('Pedra Alta');
    await expect(page).toHaveTitle('Pedra Alta · Lords of the Guild');
  });
});

test.describe('preferências, sobre e privacidade', () => {
  test('a Hora da Vigília escolhida vai junto ao fundar o feudo, com o fuso do navegador', async ({
    context,
    world,
  }) => {
    let created: Record<string, unknown> = {};
    context.on('request', (request) => {
      if (request.method() === 'POST' && request.url().endsWith('/v1/games')) {
        created = request.postDataJSON() as Record<string, unknown>;
      }
    });
    const page = await world.open(context);
    await openSettings(page);
    await settings(page).getByLabel('Hora local em que você costuma jogar').selectOption('7');
    await page.getByRole('tab', { name: 'Boas-vindas' }).click();
    await playNow(page);
    expect(created).toEqual({
      settlementName: 'Pedra Alta',
      timezone: 'America/Sao_Paulo',
      vigilHourLocal: 7,
    });
    // As preferências não vão para o servidor: ficam só neste navegador.
    const saved = await page.evaluate(() => localStorage.getItem('lords.preferences'));
    expect(JSON.parse(saved ?? '{}')).toMatchObject({ vigilHour: 7 });
  });

  test('"Sobre" mostra as versões do app, do servidor e do conteúdo; "Privacidade" explica o que fica guardado', async ({
    context,
    world,
  }) => {
    const page = await world.open(context);
    await palette(page, 'sobre');
    const about = page.getByRole('tabpanel', { name: 'Sobre' });
    await expect(about.getByRole('heading', { name: 'Lords of the Guild' })).toBeVisible();
    await expect(about).toContainText(/App\s*0\.1\.0/);
    await expect(about).toContainText(/Servidor\s*0\.1\.0/);
    await expect(about).toContainText(/Conteúdo\s*[0-9a-f]{16}/);
    await expect(about).toContainText('Vínculo GitHub');
    await expect(page).toHaveURL(/#\/sobre$/);
    // O app tem cara de editor, mas não usa o nome de nenhum.
    await expect(page.getByText(/Visual Studio|VS ?Code/i)).toHaveCount(0);

    await about.getByRole('button', { name: 'Privacidade' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText('armazenamento local do site');
    await expect(dialog).toContainText('Limpar os dados de navegação os apaga');
    await expect(dialog).toContainText('não é guardado');
    await expect(dialog).toContainText('sete dias');
    await dialog.getByRole('button', { name: 'Entendi' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);

    await page.getByRole('button', { name: 'Fechar a aba Sobre' }).click();
    await expect(page.getByRole('tab', { name: 'Boas-vindas' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });
});
