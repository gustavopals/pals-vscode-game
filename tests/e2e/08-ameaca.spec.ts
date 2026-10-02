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
  serverThreat,
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
    await expect(panel).not.toContainText('Melhore antes');
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
