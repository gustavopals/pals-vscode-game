import type { StatsResponse } from '@lotg/protocol';
import type { ComponentChild } from 'preact';
import { renderToString } from 'preact-render-to-string';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { Controller, Loadable } from '../app/controller';
import type { Actions } from '../components/actions';
import { DEFAULT_PREFERENCES } from '../services/preferences';
import { makeController, statsFixture } from '../test-helpers';
import {
  fiefFacts,
  gapBefore,
  kingdomTiles,
  ordinal,
  positionText,
  updatedText,
  whole,
} from '../ui/kingdom';
import { KingdomTab } from './Kingdom';
import { SettingsTab } from './Settings';

// A aba Reino e a saída do ranking (ADR 0021): o que a tela diz, e quando o app lê `/stats`.

const noop = () => {};
const actions: Actions = { order: noop, run: noop, playNow: noop };
const html = (node: ComponentChild) => renderToString(<>{node}</>);
const ready = (value: StatsResponse): Loadable<StatsResponse> => ({ status: 'ready', value });

describe('apresentação do Reino (ui/kingdom)', () => {
  it('escreve os números com separador de milhar e a posição como ordinal', () => {
    expect(whole(1_254_300)).toBe('1.254.300');
    expect(whole(12)).toBe('12');
    expect(ordinal(1)).toBe('1º');
    expect(ordinal(1234)).toBe('1.234º');
  });

  it('os totais saem como cartões, na ordem, com o número formatado', () => {
    const tiles = kingdomTiles(statsFixture().kingdom);
    expect(tiles.map((tile) => [tile.label, tile.value])).toEqual([
      ['Contas', '1.284'],
      ['Ativos na semana', '312'],
      ['Feudos', '1.093'],
      ['Ouro no reino', '1.254.300'],
      ['Aldeões', '18.402'],
      ['Incursões repelidas', '947'],
      ['Expedições', '3.120'],
    ]);
    expect(tiles.find((tile) => tile.id === 'raids')?.hint).toBe('215 sofridas');
  });

  it('a posição do jogador: no ranking, fora dele e sem feudo', () => {
    const stats = statsFixture();
    expect(positionText(stats)).toBe('em ouro, entre 3 feudos do ranking.');
    expect(positionText({ ...stats, me: { ...stats.me, listed: false } })).toBe(
      'Seu feudo está fora do ranking. Nele, seria o 2º em ouro.',
    );
    expect(positionText({ ...stats, me: { ...stats.me, position: null, fief: null } })).toMatch(
      /funde um/,
    );
  });

  it('as estatísticas do feudo do jogador', () => {
    const facts = fiefFacts(statsFixture().me.fief!);
    expect(Object.fromEntries(facts.map((fact) => [fact.label, fact.value]))).toEqual({
      Ouro: '9.870',
      Aldeões: '24',
      Soldados: '12',
      Heróis: '3',
      'Incursões repelidas': '4',
      'Incursões sofridas': '1',
      'Expedições enviadas': '9',
      'Obras começadas': '17',
      Reinado: '12 dias',
    });
    expect(fiefFacts({ ...statsFixture().me.fief!, daysReigning: 0 }).at(-1)?.value).toBe(
      'desde hoje',
    );
  });

  it('marca o salto antes da linha do jogador fora dos 10 primeiros', () => {
    const stats = statsFixture();
    stats.ranking = [
      { position: 1, settlementName: 'A', gold: 10, mine: false },
      { position: 2, settlementName: 'B', gold: 9, mine: false },
      { position: 14, settlementName: 'Pedra Alta', gold: 1, mine: true },
    ];
    expect([0, 1, 2].map((index) => gapBefore(stats, index))).toEqual([false, false, true]);
  });

  it('diz a hora da consulta do servidor', () => {
    expect(updatedText('2026-10-30T15:05:00.000Z', 'UTC')).toBe('Atualizado às 15:05.');
  });
});

describe('aba Reino', () => {
  it('mostra os totais, o ranking com a linha do jogador destacada e as estatísticas dele', () => {
    const markup = html(<KingdomTab stats={ready(statsFixture())} signedIn actions={actions} />);
    expect(markup).toContain('<table class="ranking" aria-label="Ranking de ouro">');
    expect(markup).toContain('Monte Frio');
    expect(markup).toContain('12.450');
    // A linha do jogador não é dita só pela cor.
    expect(markup).toMatch(
      /<tr class="ranking-mine" aria-current="true">.*Pedra Alta.*\(seu feudo\)/,
    );
    expect(markup).toContain('1.254.300');
    expect(markup).toContain('Minhas estatísticas');
    expect(markup).toMatch(
      /kingdom-position-badge">2º<\/span><span>em ouro, entre 3 feudos do ranking\./,
    );
    expect(markup).toContain('até\n1 hora atrás'.replace('\n', ' '));
    // Nenhum estilo embutido (CSP) e nenhum identificador de conta.
    expect(markup).not.toContain('style=');
  });

  it('mostra o Legado acumulado na conta mesmo sem feudo ativo', () => {
    const stats = statsFixture();
    const zero = { ...stats, me: { ...stats.me, legacy: 0 } };
    const noFief = { ...stats, me: { ...stats.me, position: null, fief: null } };
    expect(html(<KingdomTab stats={ready(zero)} signedIn actions={actions} />)).toMatch(
      /Legado da conta.*<strong>0 pontos<\/strong>/,
    );
    expect(html(<KingdomTab stats={ready(noFief)} signedIn actions={actions} />)).toMatch(
      /Legado da conta.*<strong>1\.234 pontos<\/strong>/,
    );
  });

  it('sem conta, sem resposta ainda e com erro', () => {
    expect(
      html(<KingdomTab stats={{ status: 'idle' }} signedIn={false} actions={actions} />),
    ).toContain('Entre no jogo');
    expect(html(<KingdomTab stats={{ status: 'loading' }} signedIn actions={actions} />)).toContain(
      'role="status"',
    );
    const failed = html(
      <KingdomTab
        stats={{ status: 'error', message: 'Sem ligação.' }}
        signedIn
        actions={actions}
      />,
    );
    expect(failed).toContain('role="alert"');
    expect(failed).toContain('Tentar de novo');
  });

  it('os botões levam às Preferências e à atualização', () => {
    const ran: string[] = [];
    const recording: Actions = { ...actions, run: (id) => ran.push(id) };
    const tree = KingdomTab({ stats: ready(statsFixture()), signedIn: true, actions: recording });
    const click = (node: unknown): void => {
      if (node === null || typeof node !== 'object') {
        return;
      }
      const { props } = node as { props?: Record<string, unknown> };
      if (props === undefined) {
        return;
      }
      if (typeof props.onClick === 'function') {
        (props.onClick as () => void)();
      }
      const children = props.children;
      for (const child of Array.isArray(children) ? children.flat(3) : [children]) {
        click(child);
      }
      if (typeof (node as { type?: unknown }).type === 'function') {
        click((node as { type: (p: unknown) => unknown }).type(props));
      }
    };
    click(tree);
    expect(ran).toEqual(['lords.openSettings', 'lords.refreshKingdom']);
  });
});

describe('Preferências: o ranking', () => {
  const render = (ranking: { listed: boolean | null; saving: boolean } | null) =>
    html(
      <SettingsTab
        preferences={DEFAULT_PREFERENCES}
        theme="dark"
        browserNotificationsSupported
        game={null}
        ranking={ranking}
        onChange={noop}
        onBrowserNotifications={noop}
        onNewGame={noop}
      />,
    );

  it('diz o que fica público e reflete a escolha', () => {
    const markup = render({ listed: true, saving: false });
    expect(markup).toContain('Mostrar meu feudo no ranking');
    expect(markup).toContain('o nome do seu feudo e o ouro dele');
    expect(markup).toMatch(/<input[^>]*name="rankingListed"[^>]*checked/);
    expect(render({ listed: false, saving: false })).not.toMatch(
      /<input[^>]*name="rankingListed"[^>]*checked/,
    );
    expect(render({ listed: null, saving: false })).toMatch(
      /<input[^>]*name="rankingListed"[^>]*disabled/,
    );
    expect(render(null)).not.toContain('rankingListed');
  });
});

describe('quando o app lê /stats', () => {
  const created: Controller[] = [];
  afterEach(() => {
    for (const controller of created.splice(0)) {
      controller.dispose();
    }
    vi.useRealTimers();
  });

  async function started() {
    vi.useFakeTimers();
    const made = makeController({ signedIn: true });
    created.push(made.controller);
    made.controller.setVisible(true);
    await made.controller.start();
    await vi.advanceTimersByTimeAsync(0);
    return made;
  }
  const statsReads = (made: Awaited<ReturnType<typeof started>>) =>
    made.api.state.requests.filter((request) => request === 'GET /stats').length;

  it('só com a aba Reino aberta e à vista, no máximo uma vez por minuto', async () => {
    const made = await started();
    await vi.advanceTimersByTimeAsync(2 * 60_000);
    expect(statsReads(made)).toBe(0);

    made.controller.navigate('kingdom');
    await vi.advanceTimersByTimeAsync(0);
    expect(statsReads(made)).toBe(1);
    expect(made.controller.stats.status).toBe('ready');
    expect(made.controller.tabs).toContain('kingdom');

    // As leituras do feudo seguem de 30 em 30 s; a de /stats, de minuto em minuto.
    await vi.advanceTimersByTimeAsync(2 * 60_000 + 1000);
    expect(statsReads(made)).toBeGreaterThanOrEqual(2);
    expect(statsReads(made)).toBeLessThanOrEqual(3);

    // Fora de vista, ou em outra aba, nada.
    const before = statsReads(made);
    made.controller.navigate('fief');
    await vi.advanceTimersByTimeAsync(5 * 60_000);
    expect(statsReads(made)).toBe(before);
  });

  it('sair do ranking pelas Preferências muda a conta e relê o Reino', async () => {
    const made = await started();
    made.controller.navigate('settings');
    await vi.advanceTimersByTimeAsync(0);
    expect(made.api.state.requests).toContain('GET /me/ranking');
    expect(made.controller.rankingListed).toBe(true);

    made.controller.navigate('kingdom');
    await vi.advanceTimersByTimeAsync(0);
    await made.controller.setRankingListed(false);
    expect(made.api.state.requests).toContain('PUT /me/ranking');
    expect(made.api.state.rankingListed).toBe(false);
    expect(made.controller.rankingListed).toBe(false);
    expect(statsReads(made)).toBe(2);
    expect(made.controller.stats.status === 'ready' && made.controller.stats.value.me.listed).toBe(
      false,
    );
    expect(made.controller.toasts.at(-1)?.text).toMatch(/saiu do ranking/);
  });

  it('uma falha ao mudar devolve a escolha anterior e avisa', async () => {
    const made = await started();
    made.controller.navigate('settings');
    await vi.advanceTimersByTimeAsync(0);
    made.api.state.failNext.set('/me/ranking', {
      status: 503,
      body: { code: 'SERVICE_UNAVAILABLE', message: 'O reino está fechado.' },
    });
    await made.controller.setRankingListed(false);
    expect(made.controller.rankingListed).toBe(true);
    expect(made.controller.toasts.at(-1)?.kind).toBe('error');
  });
});
