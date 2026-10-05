import { type Page } from '@playwright/test';

import {
  expect,
  fief,
  HOUR,
  lowContrast,
  MINUTE,
  palette,
  playNow,
  statusBar,
  test,
  THEMES,
  toasts,
  tree,
} from './helpers';

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

  // V2E-T4 (GDD §12.2): o que o feudo já fez conta no instante em que o objetivo aparece. Com o
  // Salão já no nível 2, cumprir o primeiro objetivo revela o do Salão, que se cumpre na mesma
  // hora: são dois acontecimentos na resposta de uma ordem, e um aviso só.
  test('com "Todos", os objetivos cumpridos de uma vez viram um aviso só, e "Ver" leva à lista deles', async ({
    context,
    world,
  }) => {
    const page = await world.open(context);
    await playNow(page);
    await world.raise('townHall', 2);
    await openSettings(page);
    await settings(page).getByRole('radio', { name: /Todos/ }).check();
    await page.getByRole('tab', { name: 'Hoje' }).click();
    await palette(page, 'alocar');
    await page.keyboard.type('fazenda');
    await page.keyboard.press('Enter');
    await page.keyboard.type('2');
    await page.keyboard.press('Enter');

    const notices = toasts(page)
      .getByRole('status')
      .filter({ hasText: /objetivo/i });
    await expect(notices).toHaveCount(1);
    await expect(notices).toContainText('2 objetivos cumpridos.');
    // Uma linha para cada um, com a recompensa como a lista dos objetivos a diz.
    await expect(notices.getByRole('listitem')).toHaveText([
      'Aloque 2 aldeões na Fazenda: +20 ouro.',
      'Alcance o Salão do Senhor Nv2: +50 ouro e desbloqueia o Celeiro, o Armazém e a Torre de Vigia.',
    ]);
    // "Ver" leva à lista dos objetivos, no feudo, onde os seguintes acabaram de aparecer.
    await notices.getByRole('button', { name: 'Ver' }).click();
    await expect(page.getByRole('tab', { name: 'Feudo' })).toHaveAttribute('aria-selected', 'true');
    const objectives = fief(page).getByRole('region', { name: 'Objetivos' });
    await expect(objectives.getByRole('heading', { name: 'Objetivos' })).toBeFocused();
    await expect(objectives.getByRole('heading', { name: 'Objetivos' })).toBeInViewport();
    await expect(objectives.getByText('Cumpridos (2)')).toBeVisible();
    await expect(objectives.locator('li.objective')).toHaveCount(3);
    await expect(notices).toHaveCount(0);
  });

  test('a fome avisa mesmo no nível padrão, e toma a barra de status e o título; a carta do Conselho que chega não a tira de lá', async ({
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
    await expect(page).toHaveTitle(/^(\(\d+\) )?Fome em Pedra Alta · Lords of the Guild$/);

    // ADR 0016, item 8: com cartas chegando o tempo todo, quem não responde na hora tem quase
    // sempre uma decisão à espera. A carta entra no contador do título, no ícone do Feudo e na
    // linha "Hoje" da árvore, mas a barra e o título continuam dizendo a fome, com o alarme.
    await world.control('council-deal', { cardId: 'masonsMeal' });
    await world.passTime(MINUTE, page);
    await expect(page.getByRole('button', { name: /^Feudo: 1 decisão pendente/ })).toBeVisible();
    await expect(tree(page).locator('[data-node="today"]')).toContainText('1 decisão pendente');
    const line = statusBar(page).locator('.status-main');
    await expect(line).toContainText('Fome em Pedra Alta');
    await expect(line).not.toContainText('decisão pendente');
    await expect(line).toHaveClass(/status-warning/);
    await expect(line.locator('.codicon-warning')).toBeVisible();
    await expect(page).toHaveTitle(/^\(\d+\) Fome em Pedra Alta · Lords of the Guild$/);
    // A carta não se perdeu: a árvore continua mostrando que ela espera no Conselho.
    await expect(tree(page).locator('[data-node="council"]')).toContainText('1 carta pendente');
  });

  // V2C-T6 (GDD §13.5): a virada de estação muda a produção e os prazos do feudo inteiro. O aviso
  // chega uma hora de relógio antes, com o que muda, e de novo na virada, com as mesmas frases.
  test('a mudança de estação avisa uma hora antes e de novo na virada, com o que muda; a barra e o título seguem a prioridade', async ({
    context,
    world,
  }) => {
    const page = await world.open(context);
    await playNow(page);
    // Todos na Fazenda: a comida não falta, e nenhum outro aviso disputa a vez.
    const plus = fief(page).getByRole('button', { name: 'Pôr mais um trabalhador em Fazenda' });
    for (const free of [4, 3, 2, 1, 0]) {
      await plus.click();
      await expect(fief(page).getByText(`Livres ${free}`)).toBeVisible();
    }
    const ahead = toasts(page).getByRole('status').filter({ hasText: 'à vista' });
    const changes = [
      'A produção de comida passa de × 1,2 para × 1.',
      'A produção de madeira e pedra passa de × 1 para × 1,15.',
      'O recrutamento volta ao prazo de sempre.',
    ];

    // A primavera dura 48 horas no ritmo dos testes. A uma hora e meia da virada, nenhum aviso.
    await world.passTime(46 * HOUR + 30 * MINUTE, page);
    await expect(fief(page).getByText(/Primavera, dia 24 do Ano 1/)).toBeVisible();
    await expect(toasts(page).getByRole('status')).toHaveCount(0);
    // A Despensa encheu nesse meio-tempo: sem fome nem frio, é ela que toma a barra de status e
    // o título da aba, e o clique leva ao feudo, onde o aviso do depósito tem a saída.
    await expect(statusBar(page)).toContainText(/Comida: cheio, perde [\d,]+\/h/);
    await expect(statusBar(page).locator('.codicon-archive')).toBeVisible();
    await expect(page).toHaveTitle(
      /^Comida: cheio, perde [\d,]+\/h · Pedra Alta · Lords of the Guild$/,
    );
    await page.getByRole('tab', { name: 'Hoje' }).click();
    await statusBar(page).getByRole('button').first().click();
    await expect(page.getByRole('tab', { name: 'Feudo' })).toHaveAttribute('aria-selected', 'true');

    // A menos de uma hora da virada, o aviso chega, no nível padrão: a estação, o prazo em
    // tempo de relógio e uma frase para cada coisa que muda.
    await world.passTime(31 * MINUTE, page);
    // O prazo vem com a hora do relógio em que a estação vira: o aviso fica na tela até ser
    // dispensado, e a hora não envelhece.
    await expect(ahead).toContainText(/Verão à vista: chega em 5[89] min, às \d\d:\d\d\./);
    await expect(ahead.locator('.codicon-calendar')).toBeVisible();
    await expect(ahead.getByRole('listitem')).toHaveText(changes);
    await expect(ahead.getByRole('button', { name: 'Silenciar 2h' })).toBeVisible();
    // Não prevê sorteio nem promete proteção.
    await expect(ahead).not.toContainText(/sorte|chance|proteg|garant/i);

    // Legível nos três temas, com o aviso à vista: "Trocar tema" passa por todos.
    const seen: Array<string | null> = [];
    for (let turn = 1; turn <= THEMES.length; turn += 1) {
      await palette(page, 'trocar tema');
      await expect(toasts(page).getByText(/^Tema: /)).toHaveCount(turn);
      const theme = await page.locator('html').getAttribute('data-theme');
      seen.push(theme);
      expect(await lowContrast(page), `contraste com o aviso de estação, tema ${theme}`).toEqual(
        [],
      );
    }
    expect([...seen].sort()).toEqual([...THEMES].sort());

    // Um por virada: na leitura seguinte ele não se repete, e o que está à vista não muda.
    await world.passTime(MINUTE, page);
    await expect(ahead).toHaveCount(1);
    await expect(ahead).toContainText(/chega em 5[89] min/);

    // Pelo teclado: depois da barra de status vêm os avisos. O primeiro botão dispensa, o
    // segundo é "Ver", que leva à aba Hoje, onde "Antes de partir" diz o que preparar.
    await statusBar(page).getByRole('button', { name: 'Abrir a paleta de comandos' }).focus();
    await page.keyboard.press('Tab');
    await expect(ahead.getByRole('button', { name: 'Dispensar aviso' })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(ahead.getByRole('button', { name: 'Ver' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('tab', { name: 'Hoje' })).toHaveAttribute('aria-selected', 'true');
    await expect(ahead).toHaveCount(0);
    await expect(
      page.getByRole('tabpanel', { name: 'Hoje' }).getByRole('region', { name: 'Antes de partir' }),
    ).toBeVisible();

    // Recarregar a página dentro da mesma hora não traz o aviso de volta.
    const synced = page.waitForResponse(
      (response) => /\/games\/[^/]+\/events/.test(response.url()) && response.ok(),
    );
    await page.reload();
    await synced;
    await expect(page.getByRole('heading', { name: 'Pedra Alta', level: 1 })).toBeVisible();
    await expect(ahead).toHaveCount(0);

    // Na virada, a frase da Crônica vira aviso, com as mesmas frases do que muda.
    await world.passTime(HOUR, page);
    const arrived = toasts(page).getByRole('status').filter({ hasText: 'Chega o Verão' });
    await expect(arrived).toContainText('Chega o Verão a Pedra Alta.');
    await expect(arrived.locator('.codicon-calendar')).toBeVisible();
    await expect(arrived.getByRole('listitem')).toHaveText(changes);
    await arrived.getByRole('button', { name: 'Ver' }).click();
    await expect(page.getByRole('tab', { name: 'Feudo' })).toHaveAttribute('aria-selected', 'true');
    await expect(fief(page).getByText(/Verão, dia 1 do Ano 1/)).toBeVisible();
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
    // Com a aba à vista ou ao fundo, o título repete o assunto da barra: a obra e o prazo dela.
    await expect(page).toHaveTitle(/^Habitações Nv2 · 00:0[45] · Pedra Alta · Lords of the Guild$/);
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
    // Com as opções de nova partida à vista, o corpo leva também o que está marcado nelas.
    await expect(page.getByRole('radiogroup', { name: 'Ritmo' })).toBeVisible();
    await playNow(page);
    expect(created).toEqual({
      settlementName: 'Pedra Alta',
      timezone: 'America/Sao_Paulo',
      vigilHourLocal: 7,
      difficulty: 'lord',
      timeScale: 1,
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
    await expect(about).toContainText(/App\s*0\.2\.0/);
    await expect(about).toContainText(/Servidor\s*0\.2\.0/);
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
