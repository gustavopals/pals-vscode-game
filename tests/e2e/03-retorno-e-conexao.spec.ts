import type { BrowserContext, Locator, Page } from '@playwright/test';

import type { ViewState } from '../../packages/protocol/src/view';
import {
  applyTheme,
  expect,
  fief,
  gameEvents,
  HOUR,
  lowContrast,
  MINUTE,
  overflow,
  palette,
  pendingCards,
  playNow,
  resourceRow,
  session,
  statusBar,
  stock,
  stored,
  test,
  THEMES,
  toasts,
  tree,
} from './helpers';

/** Um bloco do Relatório de Retorno na aba Hoje, pelo título dele (o título leva a contagem). */
const reportBlock = (
  page: Page,
  title: 'O feudo prosperou' | 'O que exigiu um preço' | 'Você ainda pode decidir',
) =>
  page
    .getByRole('tabpanel', { name: 'Hoje' })
    .getByRole('region', { name: new RegExp(`^${title}`) });

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
    // A obra concluída está em "O feudo prosperou", com a frase da Crônica.
    await expect(
      reportBlock(page, 'O feudo prosperou')
        .getByRole('listitem')
        .filter({ hasText: /Habitações/ }),
    ).toHaveText(/os pedreiros ergueram as Habitações ao 2º nível\.$/);
    // Nada se perdeu: o bloco do preço diz isso, em vez de sumir.
    await expect(reportBlock(page, 'O que exigiu um preço')).toContainText(
      'Nada: a sua ausência não custou nada ao feudo.',
    );
    // Na primavera, 2 fazendeiros rendem 24/h e 5 aldeões comem 5/h. Nas duas primeiras horas os
    // dois ainda se adaptam e rendem metade (+7/h). Na primeira virada do dia a moral sobe a 60,
    // pela comida guardada, e a produção ganha 5%: +20,5/h, e um pouco mais a cada dia de
    // experiência do ofício. 14 + 41 + 20,8 = +75, exatamente uma vez.
    const food = today.getByRole('row', { name: /^Comida/ });
    await expect(food).toContainText(String(foodBefore));
    await expect(food).toContainText(String(foodBefore + 75));
    await expect(food).toContainText('+75');
    // O relatório diz a moral de agora e de onde ela veio; sem perda nem peso, não há conselho.
    const morale = today.locator('.morale-report');
    await expect(morale).toContainText('Moral 60 (Contente): subiu de 50 (Contente).');
    await expect(morale.getByRole('status')).toHaveCount(0);
    await expect(morale.getByRole('button', { name: 'Ver a moral' })).toHaveCount(0);
    await expect(today.getByRole('row', { name: /^Ouro/ })).toContainText(String(goldBefore));
    // As linhas da Crônica da ausência ficam recolhidas, para quem quiser ler tudo.
    const lines = today.getByRole('group').filter({ hasText: 'A Crônica da ausência' });
    await expect(lines.getByRole('listitem')).toHaveCount(0);
    await lines.getByText(/A Crônica da ausência \(\d+ linhas?\)/).click();
    await expect(lines.getByRole('listitem').filter({ hasText: /Habitações/ })).toBeVisible();

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

  // V2D-T4 (GDD §2.3 e §15.1, item 5): quem volta lê a ausência em três blocos e encontra uma
  // ação em cada perda. O conselho está em recesso, e as duas cartas são postas na mesa pelo
  // teste: o que acontece com elas (a resposta, a expiração, a continuação) é o motor de verdade.
  test('três blocos: o que prosperou, o que custou com a próxima ação e o que ainda se pode decidir; na Crônica, a escolha que voltou', async ({
    context,
    request,
    world,
  }) => {
    test.setTimeout(90_000);
    const first = await world.open(context);
    await playNow(first);
    // Quatro na Fazenda e um na Serraria: a comida enche a Despensa e a madeira paga as obras.
    const farm = fief(first).getByRole('button', { name: 'Pôr mais um trabalhador em Fazenda' });
    for (const free of [4, 3, 2, 1]) {
      await farm.click();
      await expect(fief(first).getByText(`Livres ${free}`)).toBeVisible();
    }
    await fief(first).getByRole('button', { name: 'Pôr mais um trabalhador em Serraria' }).click();
    await expect(fief(first).getByText('Livres 0')).toBeVisible();
    // Sete horas com a aba à vista: a Despensa chega perto do limite, sem nada ir ao chão ainda.
    await world.passTime(7 * HOUR, first);
    expect(await stock(first, 'Comida')).toBeLessThan(500);
    expect(await stock(first, 'Comida')).toBeGreaterThan(400);

    // Duas cartas na mesa: uma com um dia de prazo, outra que vence em uma hora.
    await world.control('council-deal', { cardId: 'commonGranaryPlanks' });
    await world.control('council-deal', { cardId: 'masonsMeal', expiresInMs: HOUR });
    await world.passTime(MINUTE, first);
    const dealt = await pendingCards(first, request);
    const planks = dealt.find((card) => card.instanceId.startsWith('commonGranaryPlanks-'));
    const meal = dealt.find((card) => card.instanceId.startsWith('masonsMeal-'));
    if (planks === undefined || meal === undefined) {
      throw new Error('As duas cartas não chegaram à mesa.');
    }
    // A primeira é respondida antes de sair, com a opção que faz o conselho voltar ao assunto.
    const paid = planks.options.find((option) => option.id === 'pay');
    await first.getByRole('tab', { name: /^Conselho/ }).click();
    await first
      .getByRole('tabpanel', { name: 'Conselho' })
      .getByRole('article', { name: planks.title })
      .getByRole('button', { name: paid?.label ?? '', exact: true })
      .click();
    await expect(
      first
        .getByRole('tabpanel', { name: 'Conselho' })
        .getByRole('article', { name: planks.title }),
    ).toHaveCount(0);

    // As Habitações em obra, e a Fazenda planejada para começar sozinha quando os pedreiros
    // ficarem livres.
    await first.getByRole('tab', { name: 'Feudo' }).click();
    await fief(first)
      .getByRole('listitem')
      .filter({ hasText: 'Habitações Nv1 → Nv2' })
      .getByRole('button', { name: 'Melhorar' })
      .click();
    await expect(fief(first).locator('.active-construction')).toContainText('Habitações → Nv2');
    await palette(first, 'planejar obras');
    const dialog = first.getByRole('dialog');
    await dialog.getByRole('combobox').fill('fazenda');
    await first.keyboard.press('Enter');
    await expect(dialog.getByRole('option').first()).toContainText(
      'Iniciar quando houver recursos',
    );
    await expect(dialog.getByRole('option').first()).toHaveAttribute('aria-selected', 'true');
    await first.keyboard.press('Enter');
    await expect(
      fief(first).getByRole('list', { name: 'Planejadas' }).locator('> li'),
    ).toContainText(['Fazenda']);
    await first.close();

    // Seis horas fora. As Habitações ficam prontas, a Fazenda começa sozinha e termina, a carta
    // sem resposta expira, a Despensa enche e a produção vai ao chão, e a escolha feita antes de
    // sair volta como outra carta.
    await world.passTime(6 * HOUR);
    const page = await world.open(context);
    const today = page.getByRole('tabpanel', { name: 'Hoje' });
    await expect(page.getByRole('tab', { name: 'Hoje' })).toHaveAttribute('aria-selected', 'true');
    await expect(today.getByText('Você esteve fora por 6 horas.')).toBeVisible();
    await expect(today.getByText(/O mundo andou 3 dias de jogo/)).toBeVisible();

    // O que o servidor conta da partida: é com as frases dele que a tela é conferida.
    const events = await gameEvents(page, request);
    const one = (type: string, matches: (data: Record<string, string | number>) => boolean) => {
      const found = events.filter((event) => event.type === type && matches(event.data));
      expect(found, type).toHaveLength(1);
      return found[0] as (typeof events)[number];
    };
    const answered = one('cardAnswered', (data) => data.instanceId === planks.instanceId);
    const expired = one('cardExpired', (data) => data.instanceId === meal.instanceId);
    const returned = one('cardDrawn', (data) => data.previousInstanceId === planks.instanceId);
    expect(returned.data).toMatchObject({
      source: 'continuation',
      previousCardId: 'commonGranaryPlanks',
      previousOptionId: 'pay',
    });
    const [share] = await pendingCards(page, request);
    expect(share?.instanceId).toBe(returned.data.instanceId);
    expect(share?.followsFrom?.title).toBe(planks.title);

    // Os três blocos, nesta ordem, antes da conta dos estoques.
    await expect(today.getByRole('heading', { level: 3 })).toHaveText([
      /O feudo prosperou \(\d+\)$/,
      /O que exigiu um preço \(2\)$/,
      /Você ainda pode decidir \(\d+\)$/,
      'O saldo dos estoques',
    ]);

    // 1. O feudo prosperou: as obras, com a planejada que começou sozinha, na ordem em que
    // aconteceram. Boa notícia não tem botão.
    const prospered = reportBlock(page, 'O feudo prosperou');
    await expect(prospered.getByRole('listitem').filter({ hasText: /pedreiros/ })).toHaveText([
      /os pedreiros ergueram as Habitações ao 2º nível\.$/,
      /os pedreiros começaram sozinhos a erguer a Fazenda ao 2º nível\.$/,
      /os pedreiros ergueram a Fazenda ao 2º nível\.$/,
    ]);
    await expect(prospered.getByRole('button')).toHaveCount(0);

    // 2. O que exigiu um preço: a carta que o conselho decidiu sozinho, com o que ele fez, e o
    // que foi ao chão, somado. Cada perda com o botão da próxima ação.
    const cost = reportBlock(page, 'O que exigiu um preço');
    await expect(cost.getByRole('listitem')).toHaveCount(2);
    const lostCard = cost.getByRole('listitem').filter({ hasText: expired.text });
    await expect(lostCard).toContainText('Atenção:');
    await expect(lostCard.locator('.codicon-warning')).toBeVisible();
    await expect(lostCard.getByRole('button', { name: 'Decidir a carta à espera' })).toBeVisible();
    const waste = cost.getByRole('listitem').filter({ hasText: 'Despensa sem espaço' });
    await expect(waste).toContainText(/Despensa sem espaço: \d+ de comida foram ao chão\./);
    // O número é o da coluna Perdido da tabela, logo abaixo: uma conta só.
    const wasted = /: (\d+) de comida/.exec(await waste.innerText())?.[1] ?? '';
    expect(Number(wasted)).toBeGreaterThan(100);
    await expect(
      today
        .getByRole('row', { name: /^Comida/ })
        .getByRole('cell')
        .nth(4),
    ).toHaveText(`−${wasted}`);
    // O fecho diário do desperdício dá o número e não vira linha.
    await expect(today.getByText(/não coube nos depósitos/)).toHaveCount(0);
    // O Celeiro ainda pede o Salão no nível 2: o botão leva ao aviso do depósito, que explica.
    const deposits = waste.getByRole('button', { name: 'Ver os depósitos' });
    await expect(deposits).toHaveAccessibleDescription(/Despensa sem espaço/);

    // 3. Você ainda pode decidir: a carta que a escolha trouxe de volta, com o prazo e a frase
    // do servidor que lembra a decisão. Ela chegou há duas horas: restam 22 das 24.
    const pending = reportBlock(page, 'Você ainda pode decidir');
    const back = pending.getByRole('listitem').filter({ hasText: share?.title ?? '' });
    await expect(back).toContainText(/Conselho: “.+” · expira em 2[12] h\./);
    await expect(back).toContainText(share?.followsFrom?.text ?? '');
    await expect(back.getByRole('button', { name: 'Decidir' })).toHaveAccessibleDescription(
      new RegExp(share?.title ?? ''),
    );
    // Com o relatório à vista, as cartas estão nele: a seção à parte não se repete. "Antes de
    // partir" fica com o que está acontecendo agora (a Despensa segue cheia) e não diz de novo o
    // que o terceiro bloco já trouxe com botão.
    await expect(today.getByRole('heading', { level: 2 })).toHaveText([
      'Relatório de Retorno',
      'Antes de partir',
    ]);
    const leaving = today.getByRole('region', { name: 'Antes de partir' });
    await expect(leaving.getByRole('listitem')).toHaveText([
      /Despensa no limite: [\d,]+\/h de comida vão ao chão\./,
    ]);
    await expect(pending.getByText('nenhuma obra começa sozinha')).toHaveCount(1);
    await expect(today.getByText('nenhuma obra começa sozinha')).toHaveCount(1);

    // As novidades não viraram avisos avulsos, nem a carta que voltou.
    await expect(toasts(page).getByRole('status')).toHaveCount(0);

    // Legível nos três temas, sem recarregar (recarregar leva o relatório), e em 720 px.
    for (let turn = 1; turn <= THEMES.length; turn += 1) {
      await palette(page, 'trocar tema');
      await expect(toasts(page).getByText(/^Tema: /)).toHaveCount(turn);
      const theme = await page.locator('html').getAttribute('data-theme');
      await expect(cost.getByRole('listitem')).toHaveCount(2);
      expect(await lowContrast(page), `contraste nos três blocos, tema ${theme}`).toEqual([]);
    }
    await page.setViewportSize({ width: 720, height: 800 });
    await expect(page.locator('#sidebar')).toBeHidden();
    expect(await overflow(page)).toEqual({ page: 0, content: 0 });
    await page.setViewportSize({ width: 1280, height: 720 });

    // Outra leitura do servidor não duplica nada: os eventos são entregues uma vez, pelo cursor.
    await world.passTime(MINUTE, page);
    await expect(cost.getByRole('listitem')).toHaveCount(2);
    await expect(prospered.getByRole('listitem').filter({ hasText: /pedreiros/ })).toHaveCount(3);

    // Pelo teclado: "Decidir" leva à carta, e a resposta sai dali.
    await back.getByRole('button', { name: 'Decidir' }).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('tab', { name: /^Conselho/ })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    const letter = page
      .getByRole('tabpanel', { name: 'Conselho' })
      .getByRole('article', { name: share?.title ?? '' });
    await expect(letter).toContainText(share?.followsFrom?.text ?? '');
    await letter
      .getByRole('button', { name: share?.defaultOptionLabel ?? '', exact: true })
      .click();
    await expect(letter).toHaveCount(0);
    // De volta à aba Hoje: a carta respondida saiu do bloco, o que aconteceu na ausência
    // continua lá, e o botão da carta perdida acompanha o feudo de agora.
    await page.getByRole('tab', { name: 'Hoje' }).click();
    await expect(pending.getByRole('listitem').filter({ hasText: share?.title ?? '' })).toHaveCount(
      0,
    );
    await expect(lostCard.getByRole('button', { name: 'Ver o Conselho' })).toBeVisible();
    await expect(cost.getByRole('listitem')).toHaveCount(2);

    // "Ver os depósitos" leva ao feudo, onde o aviso do depósito diz o que fazer.
    await deposits.click();
    await expect(page.getByRole('tab', { name: 'Feudo' })).toHaveAttribute('aria-selected', 'true');
    await expect(fief(page).locator('.storage-notes')).toContainText('Despensa cheia:');

    // Na Crônica, a linha da continuação cita a escolha que a trouxe, e o botão leva à linha
    // dela, sem reler as dezenas de entradas do meio.
    await palette(page, 'abrir crônica');
    const chronicle = page.getByRole('tabpanel', { name: 'Crônica' });
    const continuation = chronicle.getByRole('listitem').filter({ hasText: returned.text });
    await expect(continuation).toHaveText(
      `${returned.text} Sua escolha voltou: “${answered.text}”`,
    );
    const choice = chronicle.getByRole('listitem').filter({ hasText: answered.text }).first();
    await expect(choice).toHaveText(answered.text);
    await expect(choice).not.toBeFocused();
    await continuation.getByRole('button', { name: 'Sua escolha voltou' }).focus();
    await page.keyboard.press('Enter');
    await expect(choice).toBeFocused();
    await expect(choice).toBeInViewport();
    // A linha em que a página parou fica marcada, também para quem veio pelo teclado.
    expect(await choice.evaluate((line) => getComputedStyle(line).outlineStyle)).not.toBe('none');
    for (const theme of THEMES) {
      await applyTheme(page, theme);
      await expect(continuation).toBeVisible();
      expect(await lowContrast(page), `contraste na Crônica, tema ${theme}`).toEqual([]);
    }
    await page.setViewportSize({ width: 720, height: 800 });
    expect(await overflow(page)).toEqual({ page: 0, content: 0 });
    await page.setViewportSize({ width: 1280, height: 720 });

    // O Markdown, que é o que se baixa, mantém a ligação em texto: a nota recuada sob a linha.
    const { url, headers } = await session(page);
    const markdown = await (await request.get(`${url}/chronicle.md`, { headers })).text();
    expect(markdown).toContain(
      `\n- ${returned.text}\n  - Sua escolha voltou: “${answered.text}”\n`,
    );
    // E continua sendo uma linha por evento da Crônica: a nota não é um item da lista.
    expect(markdown.split('\n').filter((line) => line === `- ${answered.text}`)).toHaveLength(1);

    // Recarregar não traz o relatório de volta nem soma nada de novo.
    await page.getByRole('tab', { name: 'Hoje' }).click();
    await page.reload();
    await expect(
      page.getByRole('tabpanel', { name: 'Hoje' }).getByText('Nada de novo desde a sua última'),
    ).toBeVisible();
  });

  // V2D-T4.4: quem deixa a aba aberta em segundo plano e volta horas depois também lê a
  // ausência em blocos. O app não troca de aba debaixo do cursor: avisa, e o relatório espera
  // na aba Hoje. (A aba que ficou à vista o tempo todo não tem como saber que o jogador saiu.)
  test('a aba deixada aberta em segundo plano por horas: na volta, um aviso leva ao relatório, com os blocos, na aba Hoje', async ({
    context,
    world,
  }) => {
    const hide = (target: Page, hidden: boolean) =>
      target.evaluate((value) => {
        Object.defineProperty(document, 'visibilityState', {
          value: value ? 'hidden' : 'visible',
          configurable: true,
        });
        Object.defineProperty(document, 'hidden', { value, configurable: true });
        document.dispatchEvent(new Event('visibilitychange'));
      }, hidden);
    const page = await world.open(context);
    await playNow(page);
    await fief(page)
      .getByRole('listitem')
      .filter({ hasText: 'Habitações Nv1 → Nv2' })
      .getByRole('button', { name: 'Melhorar' })
      .click();
    await expect(fief(page).locator('.active-construction')).toContainText('Habitações → Nv2');

    // Menos de quatro horas fora de vista: a volta não traz relatório nenhum.
    await hide(page, true);
    await world.passTime(3 * HOUR, page);
    await hide(page, false);
    await expect(fief(page).getByText('Habitações Nv2 → Nv3')).toBeVisible();
    await page.getByRole('tab', { name: 'Hoje' }).click();
    const today = page.getByRole('tabpanel', { name: 'Hoje' });
    await expect(today.getByText('Nada de novo desde a sua última visita.')).toBeVisible();
    await page.getByRole('tab', { name: 'Feudo' }).click();

    // Cinco horas fora de vista. Na volta, a aba continua sendo a do Feudo, e um aviso diz
    // que o relatório existe.
    await fief(page).getByRole('button', { name: 'Recrutar 1 aldeão' }).click();
    await expect(fief(page).getByText(/a caminho\. Chega em/)).toBeVisible();
    await hide(page, true);
    await world.passTime(5 * HOUR, page);
    await hide(page, false);
    const pointer = toasts(page).getByRole('status').filter({ hasText: 'Relatório de Retorno' });
    await expect(pointer).toHaveText(
      /Você esteve fora por 5 horas\. O Relatório de Retorno espera na aba Hoje\./,
    );
    await expect(page.getByRole('tab', { name: 'Feudo' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('tab', { name: 'Hoje' }).getByLabel('há novidades')).toBeVisible();
    await pointer.getByRole('button', { name: 'Ver' }).click();
    await expect(page.getByRole('tab', { name: 'Hoje' })).toHaveAttribute('aria-selected', 'true');
    await expect(today.getByText('Você esteve fora por 5 horas.')).toBeVisible();
    // O aldeão que chegou em segundo plano está no bloco, uma vez só.
    await expect(
      reportBlock(page, 'O feudo prosperou')
        .getByRole('listitem')
        .filter({ hasText: /recruta/ }),
    ).toHaveText('Chegou 1 recruta que o Salão mandou chamar.');
    await expect(reportBlock(page, 'O que exigiu um preço')).toBeVisible();
    await expect(reportBlock(page, 'Você ainda pode decidir')).toBeVisible();
    await today.getByRole('button', { name: 'Marcar como lido' }).click();
    await expect(today.getByText('Nada de novo desde a sua última visita.')).toBeVisible();

    // A aba descartada pelo navegador em segundo plano e recarregada na volta: a ausência conta
    // desde que ela saiu de vista, e não desde a última leitura que fez sozinha.
    await hide(page, true);
    await world.passTime(6 * HOUR, page);
    await page.reload();
    await expect(page.getByRole('tab', { name: 'Hoje' })).toHaveAttribute('aria-selected', 'true');
    await expect(
      page.getByRole('tabpanel', { name: 'Hoje' }).getByText('Você esteve fora por 6 horas.'),
    ).toBeVisible();
    // Recarregar de novo não a traz de volta (o endereço ainda é o da aba Hoje).
    await page.reload();
    await expect(
      page.getByRole('tabpanel', { name: 'Hoje' }).getByText('Nada de novo desde a sua última'),
    ).toBeVisible();
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
    // Um lenhador rende 8/h; o que acabou de chegar, a metade, enquanto se adapta.
    await expect.poll(() => stock(page, 'Madeira')).toBe(124);

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
    // Um lenhador rende 8/h; o que acabou de chegar, a metade, enquanto se adapta.
    await expect.poll(() => stock(page, 'Madeira')).toBe(124);
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

// V2C-T6 (GDD §2.3, passo 4, e §15.1): antes de sair, a aba Hoje diz em até cinco linhas o que
// preparar para a ausência, cada linha com o botão que resolve. Os prazos e as taxas das frases
// são os que o servidor mandou; o app só escolhe o que mostrar.

test.describe('antes de partir', () => {
  const today = (page: Page) => page.getByRole('tabpanel', { name: 'Hoje' });
  const leaving = (page: Page) => today(page).getByRole('region', { name: 'Antes de partir' });
  const items = (page: Page) => leaving(page).getByRole('listitem');

  test('Antes de partir: sem relatório, abre a aba Hoje; cada botão resolve o seu item, pelo teclado também, até o feudo ficar pronto', async ({
    context,
    world,
  }) => {
    const page = await world.open(context);
    await playNow(page);
    await page.getByRole('tab', { name: 'Hoje' }).click();

    // Sem relatório, a seção é a primeira da aba.
    await expect(today(page).getByRole('heading', { level: 2 })).toHaveText([
      'Antes de partir',
      'Relatório de Retorno',
      'Decisões pendentes',
    ]);
    await expect(items(page)).toHaveCount(2);
    await expect(items(page).nth(0)).toContainText(
      'Os pedreiros estão livres e nenhuma obra começa sozinha.',
    );
    await expect(items(page).nth(1)).toContainText('5 aldeões livres, sem ofício.');
    // A comida dura 36 horas: ainda não é assunto.
    await expect(leaving(page)).not.toContainText('comida');
    // De qualquer aba, a árvore diz quantos itens esperam, e o clique nela traz para cá.
    const todayNode = tree(page).getByRole('treeitem', { name: /Hoje em Pedra Alta/ });
    await expect(todayNode).toContainText('2 a preparar');

    // Pelo teclado: do primeiro botão, Tab chega ao segundo, e Enter abre a lista de alocação.
    await items(page).nth(0).getByRole('button', { name: 'Planejar obras' }).focus();
    await page.keyboard.press('Tab');
    await expect(
      items(page).nth(1).getByRole('button', { name: 'Alocar trabalhadores' }),
    ).toBeFocused();
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('combobox').fill('fazenda');
    await page.keyboard.press('Enter');
    await dialog.getByRole('textbox').fill('2');
    await page.keyboard.press('Enter');
    await expect(items(page).nth(1)).toContainText('3 aldeões livres, sem ofício.');

    // Os outros três vão para a Serraria: o item some.
    await items(page).nth(1).getByRole('button', { name: 'Alocar trabalhadores' }).click();
    await dialog.getByRole('combobox').fill('serraria');
    await page.keyboard.press('Enter');
    await dialog.getByRole('textbox').fill('3');
    await page.keyboard.press('Enter');
    await expect(items(page)).toHaveCount(1);
    await expect(leaving(page)).not.toContainText('sem ofício');

    // "Planejar obras": as Habitações como automática começam agora mesmo. Com os pedreiros
    // ocupados, o item passa a dizer quando a obra termina e que nada vem depois dela.
    await items(page).first().getByRole('button', { name: 'Planejar obras' }).click();
    await dialog.getByRole('combobox').fill('habita');
    await page.keyboard.press('Enter');
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('Enter');
    await expect(items(page).first()).toContainText(
      /A obra de Habitações termina em \d+ min e nenhuma começa depois dela\./,
    );
    await expect(statusBar(page)).toContainText('Habitações Nv2 ·');

    // Mais uma planejada automática, à espera da fila: era o que faltava.
    await items(page).first().getByRole('button', { name: 'Planejar obras' }).click();
    await dialog.getByRole('combobox').fill('fazenda');
    await page.keyboard.press('Enter');
    await expect(dialog.getByRole('option').first()).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('Enter');
    await expect(leaving(page)).toContainText('O feudo está preparado para a sua ausência.');
    await expect(items(page)).toHaveCount(0);
    await expect(leaving(page).getByRole('button')).toHaveCount(0);
    await expect(todayNode).toContainText('pronto para a ausência');

    // A API cai: a visão à vista passa a ser a guardada, e a seção deixa de garantir. Vazio e
    // sem ligação são estados diferentes, com frases diferentes.
    await context.route('**/v1/**', (route) => route.abort('connectionrefused'));
    await page.clock.fastForward(31_000);
    await expect(leaving(page)).toContainText(
      'Sem ligação com o reino: este é o último estado conhecido do feudo.',
    );
    await expect(leaving(page)).not.toContainText('O feudo está preparado para a sua ausência.');
    await expect(todayNode).toContainText('sem ligação com o reino');
    await context.unroute('**/v1/**');
    await page.evaluate(() => window.dispatchEvent(new Event('online')));
    await expect(leaving(page)).toContainText('O feudo está preparado para a sua ausência.');

    // Seis minutos depois as Habitações ficaram prontas. A Fazenda ainda espera a madeira que a
    // Serraria está cortando: continua preparado, porque essa espera tem prazo.
    await world.passTime(6 * MINUTE, page);
    await expect(statusBar(page)).not.toContainText('Habitações');
    await expect(leaving(page)).toContainText('O feudo está preparado para a sua ausência.');
    // E estava mesmo: uma hora depois a Fazenda já começou sozinha e ficou pronta. Agora os
    // pedreiros estão parados de novo, e a lista volta a dizer isso.
    await world.passTime(HOUR, page);
    await expect(tree(page).locator('[data-node="worker:farm"]')).toContainText('Fazenda Nv2');
    await expect(items(page)).toHaveCount(1);
    await expect(items(page).first()).toContainText(
      'Os pedreiros estão livres e nenhuma obra começa sozinha.',
    );
  });

  test('Antes de partir: a comida que acaba é o item mais urgente, com o botão da Fazenda; nos três temas, em 720 px e abaixo do Relatório de Retorno', async ({
    context,
    world,
  }) => {
    const page = await world.open(context);
    await playNow(page);
    await page.getByRole('tab', { name: 'Hoje' }).click();
    // Ninguém na Fazenda: a comida cai 5 por hora e dura 36 horas. Treze horas depois, falta
    // menos de um dia: é o primeiro item, como alerta.
    await world.passTime(13 * HOUR, page);
    const food = items(page).first();
    await expect(food).toContainText(/A comida acaba em 2[23] h: saldo de −5\/h\./);
    await expect(food).toContainText('Atenção:');
    await expect(food.locator('.codicon-warning')).toBeVisible();
    await expect(items(page)).toHaveCount(3);

    // A menos de uma ausência comum do fim, é urgente: outro ícone e outra palavra, não só a cor.
    await world.passTime(17 * HOUR, page);
    await expect(food).toContainText(/A comida acaba em [56] h: saldo de −5\/h\./);
    await expect(food).toContainText('Urgente:');
    await expect(food.locator('.codicon-error')).toBeVisible();
    await expect(food.getByRole('button', { name: 'Alocar na Fazenda' })).toBeVisible();
    // Na árvore, o sinal de alerta acompanha o número.
    await expect(tree(page).getByRole('treeitem', { name: /Hoje em Pedra Alta/ })).toContainText(
      '⚠ 3 a preparar',
    );

    // Legível nos três temas, e em 720 px nada transborda.
    for (const theme of THEMES) {
      await applyTheme(page, theme);
      await expect(page.getByRole('tab', { name: 'Hoje' })).toHaveAttribute(
        'aria-selected',
        'true',
      );
      await expect(items(page)).toHaveCount(3);
      expect(await lowContrast(page), `contraste em "Antes de partir", tema ${theme}`).toEqual([]);
    }
    await page.setViewportSize({ width: 720, height: 800 });
    await expect(page.locator('#sidebar')).toBeHidden();
    expect(await overflow(page)).toEqual({ page: 0, content: 0 });
    await page.setViewportSize({ width: 1280, height: 720 });

    // O botão do item leva direto à Fazenda: sem lista de edifícios, só o número.
    await food.getByRole('button', { name: 'Alocar na Fazenda' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText('Fazenda Nv1');
    await dialog.getByRole('textbox').fill('5');
    await page.keyboard.press('Enter');
    await expect(leaving(page)).not.toContainText('A comida acaba');
    await expect(leaving(page)).not.toContainText('sem ofício');
    await expect(items(page)).toHaveCount(1);

    // Quem volta de uma ausência lê primeiro o que aconteceu, depois o que espera uma decisão
    // (GDD §2.3): a seção vem abaixo do relatório e das decisões pendentes.
    await page.close();
    await world.passTime(5 * HOUR);
    const back = await world.open(context);
    await expect(back.getByRole('tab', { name: 'Hoje' })).toHaveAttribute('aria-selected', 'true');
    await expect(today(back).getByRole('heading', { level: 2 })).toHaveText([
      'Relatório de Retorno',
      'Antes de partir',
    ]);
    // O que espera decisão é o terceiro bloco do relatório, acima de "Antes de partir".
    await expect(today(back).getByRole('heading', { level: 3 })).toHaveText([
      /O feudo prosperou/,
      /O que exigiu um preço/,
      /Você ainda pode decidir/,
      'O saldo dos estoques',
    ]);
    await expect(today(back).getByText('Você esteve fora por 5 horas.')).toBeVisible();
    // Cinco lavradores por cinco horas: agora é a Despensa que está para encher, e o item do
    // depósito passa na frente das obras que não começam sozinhas.
    await expect(items(back).first()).toContainText(
      /Despensa: comida no limite em \d+ h\. O que passar disso vai ao chão\./,
    );
    await expect(
      items(back).first().getByRole('button', { name: 'Ver os depósitos' }),
    ).toBeVisible();
    // As obras que não começam sozinhas estão em "Você ainda pode decidir", uma vez só na aba:
    // "Antes de partir" não repete o que o relatório já trouxe com o botão.
    await expect(
      reportBlock(back, 'Você ainda pode decidir')
        .getByRole('listitem')
        .filter({ hasText: 'nenhuma obra começa sozinha' })
        .getByRole('button', { name: 'Planejar obras' }),
    ).toBeVisible();
    await expect(items(back).filter({ hasText: 'nenhuma obra começa sozinha' })).toHaveCount(0);
    await expect(today(back).getByText('nenhuma obra começa sozinha')).toHaveCount(1);
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
    // O recrutamento da primavera: 16 min de jogo, 5 min 20 s de relógio.
    expect(view.recruitment.secondsPerVillager).toBe(320);
    await expect(fief(page).getByText(/leva 5 min 20 s/)).toBeVisible();
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

  test('ritmo Rápido: depois de 5 horas fora, o relatório conta horas de relógio e o ganho é o das taxas anunciadas, uma vez só', async ({
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

    // A taxa já chega por hora de relógio: na primavera, 2 fazendeiros que acabaram de chegar
    // rendem 36/h (a metade dos 72/h de depois da adaptação) e 5 aldeões comem 15/h, três vezes o
    // +7/h do mesmo feudo no ritmo Normal. A tela mostra o número como veio.
    const arrived = await views.latest();
    expect(arrived.resources.find((entry) => entry.id === 'food')?.perHour).toBe(21);
    await expect(resourceRow(first, 'Comida')).toContainText('+21');
    // A adaptação também é anunciada em relógio: 40 minutos, e não as 2 horas de jogo.
    expect(arrived.workersRules.adaptationSeconds).toBe(2400);
    await expect(
      fief(first).getByText(/Quem troca de ofício produz metade por 40 min\./),
    ).toBeVisible();
    await expect(
      fief(first)
        .getByRole('region', { name: /^Trabalhadores/ })
        .getByRole('listitem')
        .filter({ hasText: 'Fazenda' }),
    ).toContainText('+1 aqui: +18/h agora, +36/h depois de 40 min');
    const foodBefore = await stock(first, 'Comida');
    await first.close();

    await world.passTime(5 * HOUR);
    const page = await world.open(context);

    // A ausência é contada no relógio do jogador; o mundo, em dias de jogo (de 40 minutos).
    const today = page.getByRole('tabpanel', { name: 'Hoje' });
    await expect(today.getByText('Você esteve fora por 5 horas.')).toBeVisible();
    await expect(today.getByText(/O mundo andou 7 dias de jogo/)).toBeVisible();
    // 40 min de relógio a +21/h (a adaptação) e, depois, de +61,5/h a +66,9/h, um degrau a cada dia
    // de experiência, já com a moral em 60 desde a primeira virada: nem os +75 do ritmo Normal,
    // nem o triplo disso de converter duas vezes.
    const food = today.getByRole('row', { name: /^Comida/ });
    await expect(food).toContainText(String(foodBefore));
    await expect(food).toContainText(String(foodBefore + 291));
    await expect(food).toContainText('+291');

    await today.getByRole('button', { name: 'Ir para o feudo' }).click();
    expect(await stock(page, 'Comida')).toBe(foodBefore + 291);
    await expect(resourceRow(page, 'Comida')).toContainText('+66,9');
    // A moral também fala em relógio: a comida guardada é a de 8 horas (as 24 h de jogo), e a
    // virada do dia que a recalcula vem em menos de 40 minutos. São os números da API.
    const morale = fief(page).getByRole('region', { name: 'Moral' });
    const served = (await views.latest()).morale;
    expect(served.nextUpdateInSeconds).toBeLessThanOrEqual(2400);
    expect(served.terms.map((term) => term.label)).toContain('Comida guardada para 8 h');
    await expect(morale).toContainText('Comida guardada para 8 h');
    await expect(morale).toContainText(/Faltam [0-3]\d:\d\d\./);
    // Recarregar não soma de novo.
    await page.reload();
    await expect(page.getByRole('tab', { name: 'Feudo' })).toHaveAttribute('aria-selected', 'true');
    expect(await stock(page, 'Comida')).toBe(foodBefore + 291);
  });

  test('ritmo Rápido: a lareira do inverno queima por hora de relógio, e a tela escreve o número da API', async ({
    context,
    world,
  }) => {
    const views = watchViews(context);
    const page = await world.open(context);
    await playFast(page);
    // Todos na Fazenda, e a melhoria dela leva 80 das 120 de madeira.
    const plus = fief(page).getByRole('button', { name: 'Pôr mais um trabalhador em Fazenda' });
    for (const free of [4, 3, 2, 1, 0]) {
      await plus.click();
      await expect(fief(page).getByText(`Livres ${free}`)).toBeVisible();
    }
    await fief(page)
      .getByRole('listitem')
      .filter({ hasText: 'Fazenda Nv1 → Nv2' })
      .getByRole('button', { name: 'Melhorar' })
      .click();
    await expect(fief(page).locator('.active-construction')).toContainText('Fazenda → Nv2');

    // O inverno chega em 48 horas de relógio (144 de jogo); vinte minutos depois, a lareira arde.
    await world.passTime(48 * HOUR + 20 * MINUTE, page);
    await expect(fief(page).getByText(/Inverno, dia 1 do Ano 1/)).toBeVisible();
    const view = await views.latest();
    // 0,5 de madeira por habitante por hora de jogo são 1,5 por hora de relógio: 7,5/h com 5.
    expect(view.winter?.firewoodPerHour).toBe(7.5);
    expect(view.calendar.seasonEffects).toContain(
      'a lareira queima 1,5 de madeira por habitante por hora',
    );
    await expect(fief(page).getByText(view.calendar.seasonEffects)).toBeVisible();
    await expect(fief(page).locator('.hearth')).toContainText('Lareira: 7,5 de madeira por hora');
    await expect(resourceRow(page, 'Madeira')).toContainText('−7,5');
    // O prazo até a madeira acabar também vem em relógio: as 37 de madeira duram perto de 5 h,
    // e não as 15 h que seriam sem a conversão do servidor.
    const wood = view.resources.find((entry) => entry.id === 'wood');
    expect(wood?.depletesInSeconds).toBeGreaterThan(4 * 3600);
    expect(wood?.depletesInSeconds).toBeLessThan(5.5 * 3600);
    await expect(fief(page).locator('.hearth')).toContainText(/madeira acaba em [45] h/);
    // A obra iniciada no inverno: 5 min de jogo × 1,5, um terço disso em relógio.
    const sawmill = view.constructions.available.find((entry) => entry.building === 'lumberMill');
    expect(sawmill?.durationSeconds).toBe(150);
    expect(sawmill?.durationNote).toBe('No Inverno, o prazo de uma obra iniciada agora é × 1,5.');
    await expect(
      fief(page).getByRole('listitem').filter({ hasText: 'Serraria Nv1 → Nv2' }),
    ).toContainText('2 min 30 s');
  });

  test('ritmo Rápido: no fim do verão, com o outono no meio, a aba Hoje e o feudo já avisam que falta lenha para o inverno', async ({
    context,
    world,
  }) => {
    const views = watchViews(context);
    const page = await world.open(context);
    await playFast(page);
    // Todos na Fazenda, e a melhoria dela leva 80 das 120 de madeira: sobram 40.
    const plus = fief(page).getByRole('button', { name: 'Pôr mais um trabalhador em Fazenda' });
    for (const free of [4, 3, 2, 1, 0]) {
      await plus.click();
      await expect(fief(page).getByText(`Livres ${free}`)).toBeVisible();
    }
    await fief(page)
      .getByRole('listitem')
      .filter({ hasText: 'Fazenda Nv1 → Nv2' })
      .getByRole('button', { name: 'Melhorar' })
      .click();
    await expect(fief(page).locator('.active-construction')).toContainText('Fazenda → Nv2');

    // Trinta horas de relógio e uns minutos: fim do verão. O outono dura 16 h, e o inverno
    // chega em menos de 18.
    await world.passTime(30 * HOUR + 20 * MINUTE, page);
    const view = await views.latest();
    expect(view.calendar.season).toBe('summer');
    expect(view.calendar.nextSeason).toMatchObject({ id: 'autumn', firewood: null });
    const ahead = view.calendar.nextFirewoodSeason;
    expect(ahead).toMatchObject({
      id: 'winter',
      firewood: { perHour: 7.5, winterTotal: 60, stock: 40, gathered: 0, missing: 20 },
    });
    expect(ahead?.secondsUntil).toBeLessThan(18 * 3600);
    expect(ahead?.secondsUntil).toBeGreaterThan(17 * 3600);

    // Na aba Hoje, o item da lenha, com o botão da Serraria.
    await page.getByRole('tab', { name: 'Hoje' }).click();
    const firewood = page
      .getByRole('tabpanel', { name: 'Hoje' })
      .getByRole('region', { name: 'Antes de partir' })
      .getByRole('listitem')
      .filter({ hasText: 'Inverno em' });
    await expect(firewood).toContainText(
      'Inverno em 17 h: 5 habitantes vão queimar 7,5 madeira/h, e faltam 20 de madeira para a estação inteira.',
    );
    await expect(firewood.getByRole('button', { name: 'Alocar na Serraria' })).toBeVisible();
    // No feudo, a conta inteira, por extenso.
    await page.getByRole('tab', { name: 'Feudo' }).click();
    await expect(fief(page).getByRole('note')).toContainText(
      'Inverno em 17 h. O Inverno vai queimar 60 de madeira com 5 habitantes. A Serraria repõe 0 e há 40 em estoque: faltam 20 de madeira.',
    );
  });
});
