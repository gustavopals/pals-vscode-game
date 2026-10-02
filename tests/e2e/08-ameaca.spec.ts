import type { Page } from '@playwright/test';

import {
  applyTheme,
  expect,
  fief,
  gameEvents,
  HOUR,
  lowContrast,
  MINUTE,
  overflow,
  playNow,
  type ServerEvent,
  serverThreat,
  serverView,
  statusBar,
  test,
  THEMES,
  toasts,
  tree,
  type World,
} from './helpers';

// V2E-T1 (GDD §8.2, critério 4 da §16.2 em preparação): a Ameaça existe para todo feudo, mas só
// quem tem a Torre de Vigia a vê. Sem a Torre o painel diz que ninguém sabe o que ronda o feudo e
// põe a obra ao lado; com ela, mostra o número, de onde ele vem e para onde vai.
//
// O que a tela mostra com a Torre é conferido contra o que o servidor mandou, sem citar números de
// regra: quanto a Ameaça sobe por dia e em que marcas a Crônica fala são do conteúdo, que muda.

const threatPanel = (page: Page) => fief(page).getByRole('region', { name: 'Ameaça' });
const threatRow = (page: Page) => tree(page).locator('[data-node="threat"]');
const todayTab = (page: Page) => page.getByRole('tabpanel', { name: 'Hoje' });
/** Um bloco do Relatório de Retorno na aba Hoje, pelo título dele (o título leva a contagem). */
const reportBlock = (page: Page, title: 'O feudo prosperou' | 'O que exigiu um preço') =>
  todayTab(page).getByRole('region', { name: new RegExp(`^${title}`) });
/** A linha de um recurso na conta dos estoques do Relatório de Retorno. */
const stockCells = (page: Page, resource: string) =>
  todayTab(page)
    .getByRole('table', { name: 'O saldo dos estoques' })
    .getByRole('row', { name: new RegExp(`^${resource}`) })
    .getByRole('cell');

/** Um número como o app o escreve: pt-BR, com uma casa decimal no máximo. */
const written = (value: number) =>
  new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(Math.round(value * 10) / 10);

/** O único evento deste tipo na partida; o teste falha se houver outro número deles. */
function only(events: ServerEvent[], type: string): ServerEvent {
  const found = events.filter((event) => event.type === type);
  expect(found, `eventos ${type}`).toHaveLength(1);
  return found[0] as ServerEvent;
}

/** Os cinco aldeões do feudo novo com ofício: dois na Fazenda, dois na Serraria, um na Pedreira. */
async function employEveryone(page: Page): Promise<void> {
  const step = async (building: string, free: number) => {
    await fief(page)
      .getByRole('button', { name: `Pôr mais um trabalhador em ${building}` })
      .click();
    await expect(fief(page).getByText(`Livres ${free}`)).toBeVisible();
  };
  await step('Fazenda', 4);
  await step('Fazenda', 3);
  await step('Serraria', 2);
  await step('Serraria', 1);
  await step('Pedreira', 0);
}

/**
 * Treze horas de Serraria e de Pedreira pagam o Salão do Senhor Nv2 e ainda deixam a Torre paga;
 * onze minutos depois o Salão está de pé e a obra da Torre, liberada.
 */
async function raiseTownHall(page: Page, world: World): Promise<void> {
  const step = async (label: string, free: number) => {
    await fief(page).getByRole('button', { name: label }).click();
    await expect(fief(page).getByText(`Livres ${free}`)).toBeVisible();
  };
  for (const free of [4, 3]) {
    await step('Pôr mais um trabalhador em Serraria', free);
  }
  for (const free of [2, 1, 0]) {
    await step('Pôr mais um trabalhador em Pedreira', free);
  }
  await world.passTime(13 * HOUR, page);
  await fief(page)
    .getByRole('listitem')
    .filter({ hasText: 'Salão do Senhor Nv1 → Nv2' })
    .getByRole('button', { name: 'Melhorar' })
    .click();
  await expect(fief(page).locator('.active-construction')).toContainText('Salão do Senhor → Nv2');
  await world.passTime(11 * MINUTE, page);
  await expect(fief(page).getByText(/Salão Nv2 ·/)).toBeVisible();
}

test.describe('a Ameaça e a Torre de Vigia', () => {
  test('sem a Torre ninguém sabe o que ronda o feudo; erguida, o painel mostra o número, de onde ele vem e para onde vai', async ({
    context,
    world,
    request,
  }) => {
    test.setTimeout(90_000);
    const page = await world.open(context);
    await playNow(page);
    const panel = threatPanel(page);
    const row = threatRow(page);
    const build = panel.getByRole('button', { name: 'Construir Torre de Vigia' });
    const listed = fief(page)
      .getByRole('region', { name: 'Construções' })
      .getByRole('listitem')
      .filter({ has: page.getByRole('button', { name: 'Construir Torre de Vigia' }) });

    // A névoa: a frase, o que a Torre daria, o custo da saída ao lado e o que protege o feudo.
    await expect(panel).toContainText('Sem uma Torre de Vigia, ninguém sabe o que ronda o feudo.');
    await expect(panel.locator('.codicon-eye-closed')).toBeVisible();
    await expect(panel).toContainText(
      'Torre de Vigia Nv1: mostra a Ameaça com a explicação e avisa de uma incursão com 1 h de antecedência.',
    );
    await expect(panel).toContainText('120 madeira, 120 pedra, 50 ouro · 12 min');
    await expect(panel).toContainText('Sem Paliçada, nada segura um ataque.');
    // A obra ainda espera o Salão: o botão não se oferece, e o motivo vem escrito.
    await expect(panel).toContainText('Melhore antes o Salão do Senhor para o nível 2.');
    await expect(build).toBeDisabled();
    // Nenhum número, nenhuma barra, nenhuma origem: nada disso está na tela…
    await expect(panel.getByRole('progressbar')).toHaveCount(0);
    await expect(panel).not.toContainText(/Ameaça \d/);
    await expect(panel).not.toContainText('Covil');
    await expect(row).toContainText('Ameaça');
    await expect(row).toContainText('desconhecida · sem Torre de Vigia');
    await expect(row.locator('.codicon-eye-closed')).toBeVisible();
    // (Os botões de uma linha só aparecem com ela em foco: aqui se conta o que existe.)
    await expect(row.locator('button')).toHaveCount(0);
    // …porque nada disso saiu do servidor: a resposta sem Torre só tem a névoa, a Torre e a defesa.
    const fog = await serverThreat(page, request);
    expect(Object.keys(fog).sort()).toEqual(['defense', 'incoming', 'known', 'text', 'watchtower']);
    expect(fog.known).toBe(false);
    // A Torre já está em "Construir", com o que ela dá ao lado do custo, esperando o Salão.
    await expect(listed).toContainText(
      'Mostra a Ameaça com a explicação e avisa de uma incursão com 1 h de antecedência.',
    );
    await expect(listed).toContainText('Melhore antes o Salão do Senhor para o nível 2.');

    // Com o Salão no nível 2 a obra se oferece, no painel, na lista e na linha da árvore.
    await raiseTownHall(page, world);
    await expect(panel).not.toContainText('Melhore antes o Salão do Senhor para o nível 2.');
    // A Paliçada, logo abaixo, continua à espera do Salão Nv3, com o motivo escrito.
    await expect(panel).toContainText('Melhore antes o Salão do Senhor para o nível 3.');
    await expect(panel.getByRole('button', { name: 'Construir Paliçada' })).toBeDisabled();
    await expect(build).toBeEnabled();
    await expect(listed.getByRole('button', { name: 'Construir Torre de Vigia' })).toBeEnabled();
    await expect(row.locator('button[aria-label="Construir: Torre de Vigia"]')).toHaveCount(1);
    // O Salão não tira a névoa: a Ameaça subiu calada nessas horas todas, e ninguém viu.
    await expect(panel).toContainText('Sem uma Torre de Vigia, ninguém sabe o que ronda o feudo.');
    await expect(panel).not.toContainText(/Ameaça \d/);

    // A ordem sai do painel, pelo teclado.
    await build.focus();
    await page.keyboard.press('Enter');
    await expect(fief(page).locator('.active-construction')).toContainText('Torre de Vigia → Nv1');
    // Em obras a Torre ainda não vê: a contagem toma o lugar do botão, e a névoa continua.
    await expect(build).toHaveCount(0);
    await expect(panel).toContainText(/Torre de Vigia → Nv1 em obras: termina em 1[12]:\d\d\./);
    await expect(panel).toContainText('Até lá, ninguém vê.');
    await expect(panel).toContainText('Sem uma Torre de Vigia, ninguém sabe o que ronda o feudo.');
    await expect(panel.getByRole('progressbar')).toHaveCount(0);
    await expect(row).toContainText('desconhecida · Torre de Vigia em obras');
    expect((await serverThreat(page, request)).known).toBe(false);

    // A Torre de pé: os vigias veem no mesmo instante. A tela mostra o que o servidor mandou.
    await world.passTime(13 * MINUTE, page);
    await expect(fief(page).getByText('Os pedreiros estão livres.')).toBeVisible();
    const seen = await serverThreat(page, request);
    expect(seen.known).toBe(true);
    const level = seen.level ?? -1;
    const max = seen.max ?? -1;
    // Subiu sem ninguém ver, desde o primeiro dia, e ainda sobe.
    expect(level).toBeGreaterThan(0);
    expect(seen.nextLevel).toBe(level + (seen.risePerDay ?? 0));
    expect(seen.risePerDay).toBeGreaterThan(0);
    await expect(panel).not.toContainText('ninguém sabe o que ronda o feudo');
    await expect(panel.locator('.codicon-eye-closed')).toHaveCount(0);
    await expect(panel.locator('.codicon-eye').first()).toBeVisible();
    await expect(panel).toContainText(seen.text);
    expect(seen.text).toBe(`Ameaça ${level} de ${max}.`);
    const bar = panel.getByRole('progressbar', { name: `Ameaça: ${level} de ${max}` });
    await expect(bar).toHaveAttribute('value', String(level));
    await expect(bar).toHaveAttribute('max', String(max));
    // Para onde vai, com seta, verbo e o prazo da próxima virada do dia.
    await expect(panel).toContainText(seen.trend ?? 'falta a tendência');
    await expect(panel.locator('.codicon-arrow-up')).toBeVisible();
    await expect(panel).toContainText(/Faltam \d+:\d\d(:\d\d)?\./);
    // De onde vem, termo a termo, e o que ronda o feudo: a pergunta da névoa agora tem resposta.
    expect(seen.sources?.length).toBeGreaterThan(0);
    await expect(
      panel.getByRole('list', { name: 'De onde vem a subida da Ameaça' }).getByRole('listitem'),
    ).toHaveText(seen.sources ?? []);
    const tiles = seen.tiles ?? [];
    expect(tiles.length).toBeGreaterThan(0);
    await expect(panel).toContainText(
      `O que ronda o feudo: ${tiles.map((tile) => `${tile.label} (${tile.active ? 'ativo' : 'inativo'})`).join('; ')}.`,
    );
    await expect(panel).toContainText('Os vigias não avistam nenhuma incursão agora.');
    // O que a Torre faz, o que o nível seguinte acrescenta e a obra dele, com o custo ao lado.
    await expect(panel).toContainText(seen.watchtower.text);
    await expect(panel).toContainText(seen.watchtower.next ?? 'falta o próximo nível');
    await expect(panel.getByRole('button', { name: 'Melhorar Torre de Vigia' })).toBeVisible();
    await expect(panel).toContainText(seen.defense.text);
    // A árvore: o número e os tiles ativos, com o olho aberto; a linha só navega.
    const active = tiles.filter((tile) => tile.active).map((tile) => tile.label);
    await expect(row).toContainText(`${level} · ${active.join(', ')}`);
    await expect(row.locator('.codicon-eye')).toBeVisible();
    await expect(row.locator('button')).toHaveCount(0);
    // A Crônica conta a obra; a Torre erguida passa de "Construir" para "Melhorar".
    const founded = (await gameEvents(page, request)).filter(
      (event) => event.type === 'buildingFounded',
    );
    expect(founded).toHaveLength(1);
    await expect(fief(page).getByText(founded[0]?.text ?? 'falta a linha da obra')).toBeVisible();
    await expect(fief(page).getByText('Torre de Vigia Nv1 → Nv2')).toBeVisible();

    // Na virada do dia a Ameaça vai para onde a tendência disse.
    await world.passTime(2 * HOUR, page);
    await expect(panel).toContainText(`Ameaça ${seen.nextLevel} de ${max}.`);
    await expect(row).toContainText(`${seen.nextLevel} · ${active.join(', ')}`);

    // Mais uma virada e a Ameaça cruza a primeira marca: os vigias contam, e quem tem a Torre é
    // avisado no nível padrão, sem alarme, com a frase da Crônica.
    await world.passTime(2 * HOUR, page);
    const rose = (await gameEvents(page, request)).filter((event) => event.type === 'threatRose');
    expect(rose).toHaveLength(1);
    const told = rose[0]?.text ?? 'falta a linha dos vigias';
    const notice = toasts(page).getByRole('status').filter({ hasText: told });
    await expect(notice).toBeVisible();
    await expect(notice.locator('.codicon-eye')).toBeVisible();
    await expect(fief(page).getByRole('region', { name: 'Crônica' })).toContainText(told);
    const now = await serverThreat(page, request);
    expect(now.level).toBe(rose[0]?.data.threat);
    await expect(panel).toContainText(now.text);

    // Em 720 px o painel cabe, com o botão, sem rolagem horizontal.
    await page.setViewportSize({ width: 720, height: 900 });
    // A bancada se redesenha para a tela estreita, com a barra lateral recolhida.
    await expect(page.locator('#sidebar')).toBeHidden();
    expect(await overflow(page)).toEqual({ page: 0, content: 0 });
    await expect(panel.getByRole('button', { name: 'Melhorar Torre de Vigia' })).toBeVisible();
    await expect(panel).toContainText(now.text);
    await page.setViewportSize({ width: 1280, height: 720 });
    await expect(page.locator('#sidebar')).toBeVisible();

    // Nos três temas o painel com a Torre tem contraste de leitura.
    for (const theme of THEMES) {
      await applyTheme(page, theme);
      await expect(threatPanel(page)).toContainText(now.text);
      expect(await lowContrast(page), `contraste com a Torre, tema ${theme}`).toEqual([]);
    }
  });

  test('na árvore, o botão da linha "Ameaça" ergue a Torre pelo teclado; clicar na linha só navega', async ({
    context,
    world,
  }) => {
    test.setTimeout(60_000);
    const page = await world.open(context);
    await playNow(page);
    await raiseTownHall(page, world);
    const row = threatRow(page);
    // Os botões de uma linha só aparecem com ela em foco ou sob o mouse.
    const order = row.locator('button[aria-label="Construir: Torre de Vigia"]');

    // O custo está à vista antes do clique, na dica do botão.
    await expect(order).toHaveAttribute(
      'title',
      'Construir: Torre de Vigia (120 madeira, 120 pedra, 50 ouro · 12 min)',
    );
    // A explicação da linha é a do painel: a névoa, o que a Torre daria e o que protege o feudo.
    await expect(row).toHaveAttribute(
      'title',
      /Sem uma Torre de Vigia, ninguém sabe o que ronda o feudo\.\nTorre de Vigia Nv1: .*\n120 madeira, 120 pedra, 50 ouro · 12 min\.\nSem Paliçada, nada segura um ataque\./,
    );

    // Clicar na linha só navega: de outra aba, leva ao Feudo e não ordena nada.
    await page.getByRole('tab', { name: 'Hoje' }).click();
    await expect(page.getByRole('tab', { name: 'Hoje' })).toHaveAttribute('aria-selected', 'true');
    await row.click();
    await expect(page.getByRole('tab', { name: 'Feudo' })).toHaveAttribute('aria-selected', 'true');
    await expect(fief(page).getByText('Os pedreiros estão livres.')).toBeVisible();

    // Pelo teclado: da linha em foco, Tab chega ao botão dela, e Enter dá a ordem.
    await row.focus();
    await page.keyboard.press('Tab');
    await expect(order).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(fief(page).locator('.active-construction')).toContainText('Torre de Vigia → Nv1');
    // Com a obra em curso a linha não tem mais o que ordenar.
    await expect(row).toContainText('desconhecida · Torre de Vigia em obras');
    await expect(row.locator('button')).toHaveCount(0);
    await expect(threatPanel(page)).toContainText('Até lá, ninguém vê.');
  });
});

// V2E-T2 e V2E-T3 (GDD §8.2 e §12.3; critério 4 da §16.2): a incursão de lobos do roteiro
// acontece com o senhor fora, resolve-se sozinha e aparece no Relatório de Retorno. A Paliçada
// muda o desfecho, a Torre avisa antes, e depois da primeira incursão o jogador sabe o que teria
// mudado o resultado.
//
// No ritmo Normal os uivos soam na hora 18 de jogo e os lobos chegam na hora 30. Os outros
// cenários da suíte rodam com a Horda calada; estes soltam os lobos (`world.wolvesRoam()`). O que
// a tela mostra é conferido contra o que o servidor mandou: as frases e os números do estrago
// são do conteúdo, que muda.
test.describe('a incursão de lobos', () => {
  test('sem Torre e sem Paliçada: os uivos avisam sem dizer nada; depois do salto, o Relatório conta o que os lobos levaram, quem se feriu e o que os teria detido', async ({
    context,
    world,
    request,
  }) => {
    test.setTimeout(90_000);
    world.wolvesRoam();
    const first = await world.open(context);
    await playNow(first);
    await employEveryone(first);

    // Os uivos: um prenúncio, no nível padrão, sem alarme e sem informação. Quem não tem
    // Torre lê que falta quem vigie; nenhum prazo, nenhum número.
    await world.passTime(18 * HOUR + MINUTE, first);
    const howl = only(await gameEvents(first, request), 'wolvesHowl');
    expect(howl.data.watched).toBe(0);
    const heard = toasts(first).getByRole('status').filter({ hasText: howl.text });
    await expect(heard).toBeVisible();
    await expect(heard.locator('.codicon-eye-closed')).toBeVisible();
    await expect(heard.getByRole('listitem')).toHaveCount(0);
    await expect(fief(first).getByRole('region', { name: 'Crônica' })).toContainText(howl.text);
    // A névoa continua: o painel não ganhou número, chance nem incursão.
    await expect(threatPanel(first)).toContainText(
      'Sem uma Torre de Vigia, ninguém sabe o que ronda o feudo.',
    );
    await expect(threatPanel(first)).not.toContainText('chance');
    await first.close();

    // O senhor sai. Os lobos chegam na hora 30, sem ninguém para ver, e o feudo resolve sozinho.
    await world.passTime(13 * HOUR);
    const page = await world.open(context);
    await expect(page.getByRole('tab', { name: 'Hoje' })).toHaveAttribute('aria-selected', 'true');
    await expect(todayTab(page).getByText('Você esteve fora por 13 horas.')).toBeVisible();

    const events = await gameEvents(page, request);
    const raid = only(events, 'raidSuffered');
    const hurt = only(events, 'villagerInjured');
    expect(raid.data).toMatchObject({ warning: 'unwarned', palisadeLevel: 0, injured: 1 });
    // Sem Torre o evento não leva a Ameaça: o número não sai do servidor.
    expect(raid.data.threat).toBeUndefined();
    const raidedFood = Number(raid.data.raided_food);
    const raidedWood = Number(raid.data.raided_wood);
    expect(raidedFood).toBeGreaterThan(0);
    expect(raidedWood).toBeGreaterThan(0);

    // "O que exigiu um preço": a frase do ataque, com o que foi levado, quem se feriu e o que o
    // teria detido, e a próxima ação ao lado.
    const cost = reportBlock(page, 'O que exigiu um preço');
    const item = cost.getByRole('listitem').filter({ hasText: raid.text });
    await expect(item).toBeVisible();
    expect(raid.text).toContain('sem que ninguém os visse vir');
    expect(raid.text).toContain(`${written(raidedFood)} de comida`);
    expect(raid.text).toContain(`${written(raidedWood)} de madeira`);
    expect(raid.text).toContain('um aldeão ferido');
    expect(raid.text).toContain('Uma paliçada os teria detido.');
    // Com o Salão no nível 1 nenhuma das duas obras pode começar: o botão leva ao painel, que
    // diz o motivo.
    const see = item.getByRole('button', { name: 'Ver a defesa' });
    await expect(see).toBeVisible();
    // Os uivos e o ferido não são desfechos: ficam na Crônica da ausência.
    await expect(cost).not.toContainText(hurt.text);
    await expect(reportBlock(page, 'O feudo prosperou')).not.toContainText('lobos');

    // A conta dos estoques ganha a parcela dos lobos, com os números do evento, e fecha.
    await expect(
      todayTab(page).getByRole('table', { name: 'O saldo dos estoques' }).getByRole('columnheader'),
    ).toHaveText([
      'Recurso',
      'Antes',
      'Produção',
      'Gasto',
      'Recebido',
      'Perdido',
      'Levado',
      'Agora',
    ]);
    await expect(stockCells(page, 'Comida').nth(5)).toHaveText(`−${written(raidedFood)}`);
    await expect(stockCells(page, 'Madeira').nth(5)).toHaveText(`−${written(raidedWood)}`);
    await expect(stockCells(page, 'Pedra').nth(5)).toHaveText('—');
    await expect(stockCells(page, 'Ouro').nth(5)).toHaveText('—');
    await expect(todayTab(page)).toContainText('Levado é o que as incursões tiraram do estoque.');
    const number = (text: string) =>
      text === '—'
        ? 0
        : Number(text.replace(/\./g, '').replace('−', '-').replace('+', '').replace(',', '.'));
    for (const resource of ['Comida', 'Madeira', 'Pedra', 'Ouro']) {
      const [before, ...rest] = (await stockCells(page, resource).allInnerTexts()).map(number);
      const after = rest.pop() ?? 0;
      // Antes + produção − gasto + recebido − perdido − levado = agora, a menos do arredondamento.
      expect(
        Math.abs((before ?? 0) + rest.reduce((sum, value) => sum + value, 0) - after),
        `a conta de ${resource}`,
      ).toBeLessThan(1.05);
    }

    // O ferido: no cabeçalho, com a contagem do tempo até sarar e a frase do servidor.
    const view = await serverView(page, request);
    expect(view.population.injured).toBe(1);
    const note = view.population.injuredNote ?? 'falta a frase dos feridos';
    const header = todayTab(page).locator('.header');
    await expect(header.locator('.population-injured')).toContainText(
      /Feridos 1.*\(o próximo sara em \d\d:\d\d\)/,
    );
    await expect(header.locator('.population-injured .codicon-pulse')).toBeVisible();

    // Em 720 px o relatório, com a tabela de oito colunas, cabe sem rolagem horizontal.
    await page.setViewportSize({ width: 720, height: 900 });
    await expect(page.locator('#sidebar')).toBeHidden();
    expect(await overflow(page)).toEqual({ page: 0, content: 0 });
    await expect(see).toBeVisible();
    expect(await lowContrast(page), 'contraste do relatório com a incursão').toEqual([]);
    await page.setViewportSize({ width: 1280, height: 720 });
    await expect(page.locator('#sidebar')).toBeVisible();

    // O botão, pelo teclado, leva ao feudo: a defesa com a obra ao lado, e o porquê de ela
    // ainda não poder começar.
    await see.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('tab', { name: 'Feudo' })).toHaveAttribute('aria-selected', 'true');
    const panel = threatPanel(page);
    // O painel da Ameaça fica abaixo da dobra: a página e o foco vão até ele.
    await expect(panel.getByRole('heading', { name: 'Ameaça' })).toBeFocused();
    await expect(panel.getByRole('heading', { name: 'Ameaça' })).toBeInViewport();
    await expect(panel).toContainText(view.threat.defense.text);
    await expect(panel).toContainText(view.threat.defense.next ?? 'falta o próximo nível');
    await expect(panel).toContainText('Melhore antes o Salão do Senhor para o nível 3.');
    await expect(panel.getByRole('button', { name: 'Construir Paliçada' })).toBeDisabled();
    // A Paliçada está em "Construir", com o que ela segura ao lado do custo, esperando o Salão.
    const listed = fief(page)
      .getByRole('region', { name: 'Construções' })
      .getByRole('listitem')
      .filter({ has: page.getByRole('button', { name: 'Construir Paliçada' }) });
    await expect(listed).toContainText('Melhore antes o Salão do Senhor para o nível 3.');
    const offered = view.constructions.available.find((entry) => entry.building === 'palisade');
    await expect(listed).toContainText(offered?.effect ?? 'falta o efeito da obra');

    // Os trabalhadores: o ferido fora da conta, a frase do servidor e a marca no ofício dele.
    const workers = fief(page).getByRole('region', { name: /^Trabalhadores/ });
    await expect(workers.getByRole('heading', { name: 'Trabalhadores (4/5)' })).toBeVisible();
    await expect(workers).toContainText(note);
    await expect(workers.locator('.worker-injured')).toHaveText([
      '1 ferido: volta a este ofício quando sarar.',
    ]);
    await expect(tree(page).locator('[data-node="workers"]')).toContainText(
      '4/5 alocados · 0 livres · 1 ferido',
    );
    // A moral vai pagar o ataque: o termo está na conta da próxima virada, na frase do servidor.
    expect(view.morale.effects.map((effect) => effect.label)).toHaveLength(1);
    await expect(fief(page).getByRole('region', { name: 'Moral' })).toContainText(
      view.morale.effects[0]?.label ?? 'falta o efeito da incursão',
    );
    // A Crônica recente conta o ataque e o ferido.
    const chronicle = fief(page).getByRole('region', { name: 'Crônica' });
    await expect(chronicle).toContainText(raid.text);
    await expect(chronicle).toContainText(hurt.text);

    // Nos três temas, o feudo com o ferido e a defesa tem contraste de leitura.
    for (const theme of THEMES) {
      await applyTheme(page, theme);
      await expect(fief(page).locator('.population-injured')).toContainText('Feridos 1');
      expect(await lowContrast(page), `contraste com o ferido, tema ${theme}`).toEqual([]);
    }

    // Um dia de jogo depois o ferido sara e volta sozinho ao ofício: nada a refazer.
    await world.passTime(HOUR, page);
    const healed = only(await gameEvents(page, request), 'villagerRecovered');
    await expect(fief(page).locator('.population-injured')).toHaveCount(0);
    await expect(fief(page).getByRole('heading', { name: 'Trabalhadores (5/5)' })).toBeVisible();
    await expect(fief(page).locator('.worker-injured')).toHaveCount(0);
    await expect(fief(page).getByRole('region', { name: 'Crônica' })).toContainText(healed.text);
  });

  test('com a Paliçada: os lobos recuam, e o Relatório conta em "O feudo prosperou", sem perda nem ferido', async ({
    context,
    world,
    request,
  }) => {
    test.setTimeout(60_000);
    world.wolvesRoam();
    const first = await world.open(context);
    await playNow(first);
    await employEveryone(first);
    await world.raise('palisade', 1);
    // A defesa aparece no painel na leitura seguinte, com o que o nível segura.
    await world.passTime(MINUTE, first);
    const raised = await serverThreat(first, request);
    expect(raised.defense.palisadeLevel).toBe(1);
    await expect(threatPanel(first)).toContainText(raised.defense.text);
    await first.close();

    // O mesmo salto do feudo sem defesa: os lobos chegam com o senhor fora.
    await world.passTime(31 * HOUR);
    const page = await world.open(context);
    await expect(page.getByRole('tab', { name: 'Hoje' })).toHaveAttribute('aria-selected', 'true');
    const events = await gameEvents(page, request);
    const raid = only(events, 'raidRepelled');
    expect(events.some((event) => event.type === 'raidSuffered')).toBe(false);
    expect(events.some((event) => event.type === 'villagerInjured')).toBe(false);
    expect(raid.data).toMatchObject({ warning: 'unwarned', palisadeLevel: 1 });
    expect(raid.text).toContain('Recuaram diante da paliçada: nada se perdeu e ninguém se feriu.');

    // É boa notícia: está em "O feudo prosperou", sem botão.
    const prospered = reportBlock(page, 'O feudo prosperou');
    const item = prospered.getByRole('listitem').filter({ hasText: raid.text });
    await expect(item).toBeVisible();
    await expect(item.getByRole('button')).toHaveCount(0);
    await expect(reportBlock(page, 'O que exigiu um preço')).not.toContainText('lobos');
    // Nada foi levado: a conta dos estoques não tem a parcela dos lobos.
    const table = todayTab(page).getByRole('table', { name: 'O saldo dos estoques' });
    await expect(table.getByRole('columnheader', { name: 'Perdido' })).toBeVisible();
    await expect(table.getByRole('columnheader', { name: 'Levado' })).toHaveCount(0);
    // Ninguém se feriu, e a moral não paga nada.
    const view = await serverView(page, request);
    expect(view.population.injured).toBe(0);
    expect(view.morale.effects).toEqual([]);
    await expect(todayTab(page).locator('.population-injured')).toHaveCount(0);

    // No feudo, a defesa diz o que segurou o ataque e o que o nível seguinte acrescenta.
    await page.getByRole('tab', { name: 'Feudo' }).click();
    const panel = threatPanel(page);
    await expect(panel).toContainText(view.threat.defense.text);
    await expect(panel).toContainText(view.threat.defense.next ?? 'falta o próximo nível');
    await expect(fief(page).getByRole('heading', { name: 'Trabalhadores (5/5)' })).toBeVisible();
    await expect(fief(page).getByRole('region', { name: 'Crônica' })).toContainText(raid.text);
  });

  test('com a Torre: os vigias dão o alarme antes; o aviso, o painel, a barra de status e a árvore dizem quando os lobos chegam e o que a defesa faz', async ({
    context,
    world,
    request,
  }) => {
    test.setTimeout(90_000);
    world.wolvesRoam();
    const page = await world.open(context);
    await playNow(page);
    await employEveryone(page);
    await world.raise('watchtower', 1);

    // Os uivos, para quem tem vigias: o olho aberto, e ainda nenhum número de incursão.
    await world.passTime(20 * HOUR, page);
    const howl = only(await gameEvents(page, request), 'wolvesHowl');
    expect(howl.data.watched).toBe(1);
    const heard = toasts(page).getByRole('status').filter({ hasText: howl.text });
    await expect(heard).toBeVisible();
    await expect(heard.locator('.codicon-eye')).toBeVisible();
    const panel = threatPanel(page);
    await expect(panel).toContainText('Os vigias não avistam nenhuma incursão agora.');
    const calm = await serverView(page, request);
    if (!calm.threat.known) {
      throw new Error('A Torre de Vigia devia estar de pé.');
    }
    // A regra das incursões e o que cada tamanho custa, nas frases do servidor.
    await expect(panel).toContainText(calm.threat.raidRisk);
    await expect(
      panel
        .getByRole('list', { name: 'O que um ataque custa a um feudo sem defesa' })
        .getByRole('listitem'),
    ).toHaveText(calm.threat.raidCosts);
    await expect(statusBar(page)).not.toContainText('Lobos');

    // Uma hora antes dos lobos (o que a Torre no nível 1 dá), os vigias dão o alarme.
    await world.passTime(9 * HOUR + MINUTE, page);
    const alarm = only(await gameEvents(page, request), 'raidAnnounced');
    expect(alarm.data.warning).toBe('warned');
    const view = await serverView(page, request);
    const incoming = view.threat.incoming;
    if (incoming === null) {
      throw new Error('Os vigias deviam ter a incursão à vista.');
    }
    expect(incoming.inSeconds).toBeGreaterThan(50 * 60);
    expect(incoming.inSeconds).toBeLessThanOrEqual(60 * 60);
    // O aviso: alarme, com o ícone da incursão, a hora em que ela chega, o que custa e o que a
    // defesa faz a ela.
    const notice = toasts(page).getByRole('status').filter({ hasText: alarm.text });
    await expect(notice).toBeVisible();
    await expect(notice.locator('.codicon-megaphone')).toBeVisible();
    await expect(notice.getByRole('listitem')).toHaveText([
      /^Chegada em \d+ min, às \d\d:\d\d\.$/,
      incoming.costText,
      incoming.defenseText,
    ]);
    // O painel: o aviso com destaque, a contagem, o custo ao lado da defesa e a obra logo abaixo.
    const banner = panel.locator('.threat-incoming');
    await expect(banner.getByRole('status')).toHaveText(incoming.text);
    await expect(banner).toContainText(/Chegada em \d\d:\d\d\./);
    await expect(banner).toContainText(incoming.costText);
    await expect(banner).toContainText(incoming.defenseText);
    await expect(panel).not.toContainText('Os vigias não avistam');
    await expect(panel.getByRole('button', { name: 'Construir Paliçada' })).toBeDisabled();
    // A barra de status e o título da aba: os lobos passam na frente; a árvore diz o mesmo.
    await expect(statusBar(page)).toContainText(/Lobos em \d+ min/);
    await expect(statusBar(page).locator('.codicon-megaphone')).toBeVisible();
    await expect(page).toHaveTitle(/Lobos em \d+ min · Pedra Alta/);
    await expect(threatRow(page)).toContainText(/⚠ Lobos em \d+ min/);
    await expect(tree(page).locator('[data-node="fief"]')).toContainText('incursão a caminho');
    // "Antes de partir" abre com o ataque, com o botão da defesa.
    await page.getByRole('tab', { name: 'Hoje' }).click();
    const leaving = todayTab(page).getByRole('region', { name: 'Antes de partir' });
    await expect(leaving.getByRole('listitem').first()).toContainText(incoming.text);
    await expect(leaving.getByRole('listitem').first()).toContainText(incoming.defenseText);
    // Pelo teclado: os avisos do canto podem estar por cima do botão, e o foco não depende disso.
    await leaving
      .getByRole('listitem')
      .first()
      .getByRole('button', { name: 'Ver a defesa' })
      .focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('tab', { name: 'Feudo' })).toHaveAttribute('aria-selected', 'true');
    await expect(panel.getByRole('heading', { name: 'Ameaça' })).toBeFocused();
    // O clique na barra de status leva ao mesmo lugar, de qualquer aba.
    await page.getByRole('tab', { name: 'Conselho' }).click();
    await statusBar(page)
      .getByRole('button', { name: /Lobos em/ })
      .click();
    await expect(page.getByRole('tab', { name: 'Feudo' })).toHaveAttribute('aria-selected', 'true');
    await expect(panel.getByRole('heading', { name: 'Ameaça' })).toBeInViewport();
    await expect(banner).toBeInViewport();

    // Em 720 px o aviso do painel cabe, sem rolagem horizontal, e nos três temas se lê.
    await page.setViewportSize({ width: 720, height: 900 });
    await expect(page.locator('#sidebar')).toBeHidden();
    expect(await overflow(page)).toEqual({ page: 0, content: 0 });
    await expect(banner).toContainText(incoming.defenseText);
    await page.setViewportSize({ width: 1280, height: 720 });
    await expect(page.locator('#sidebar')).toBeVisible();
    for (const theme of THEMES) {
      await applyTheme(page, theme);
      await expect(threatPanel(page).locator('.threat-incoming')).toContainText(incoming.text);
      expect(await lowContrast(page), `contraste com a incursão à vista, tema ${theme}`).toEqual(
        [],
      );
    }

    // Os lobos chegam: o alarme sai de cena, e o desfecho conta que os vigias os tinham visto.
    await world.passTime(HOUR, page);
    const raid = only(await gameEvents(page, request), 'raidSuffered');
    expect(raid.data.warning).toBe('warned');
    // Com a Torre o evento leva a Ameaça antes e depois: ela cai.
    expect(Number(raid.data.threat)).toBeLessThan(Number(raid.data.previousThreat));
    const outcome = toasts(page).getByRole('status').filter({ hasText: raid.text });
    await expect(outcome).toBeVisible();
    await expect(toasts(page).getByText(alarm.text)).toHaveCount(0);
    const after = await serverView(page, request);
    await expect(outcome.getByRole('listitem')).toHaveText([
      after.population.injuredNote ?? 'falta a frase dos feridos',
    ]);
    await expect(threatPanel(page)).toContainText('Os vigias não avistam nenhuma incursão agora.');
    await expect(threatPanel(page)).toContainText(after.threat.text);
    await expect(statusBar(page)).not.toContainText('Lobos');
    await expect(fief(page).locator('.population-injured')).toContainText('Feridos 1');
    // A aba que ficou aberta recebe a linha da Crônica, sem relatório: ninguém saiu.
    await expect(fief(page).getByRole('region', { name: 'Crônica' })).toContainText(raid.text);
  });
});
