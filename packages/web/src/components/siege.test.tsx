import { ViewStateSchema } from '@lotg/protocol';
import { renderToString } from 'preact-render-to-string';
import { describe, expect, it } from 'vitest';

import { buildReturnReport, pendingItems } from '../game/returnReport';
import {
  initialView,
  siegeWaveView,
  armyIdleView,
  gameEvent,
  palisadeRaisedView,
} from '../test-helpers';
import { cardDecisions, crossroadsDecisions, documentTitle, statusBar } from '../ui/format';
import { buildTree } from '../ui/treeModel';
import { Today } from './Today';
import { SiegePanel } from './SiegePanel';
import { beforeLeaving } from '../game/beforeLeaving';
import { siegeDeadlines } from '../ui/siege';
import { decideNotifications, siegeNotice } from '../notifications/policy';

const noop = () => {};
const actions = { order: noop, run: noop, playNow: noop };
const input = {
  view: siegeWaveView,
  connection: { kind: 'online' as const },
  discreetMode: false,
  signedIn: true,
  elapsedSeconds: 60,
  pending: 0,
};

describe('o Cerco na bancada com o protocolo 4', () => {
  it('lê siegeWave e mostra título, prazo e formação pública na aba Hoje', () => {
    expect(ViewStateSchema.parse(siegeWaveView)).toEqual(siegeWaveView);
    for (const online of [true, false]) {
      const html = renderToString(
        <Today report={null} view={siegeWaveView} elapsed={60} actions={actions} online={online} />,
      );
      expect(html).toContain('Decisões pendentes (1)');
      expect(html).toContain('Cerco: “Entre ondas”');
      expect(html).toContain('A onda seguinte chega em 59 min');
      expect(html).toContain('Defesa ativa');
      expect(html).toContain('aria-label="Exército: Entre ondas"');
      expect(html).toContain('>Exército</button>');
      expect(html).not.toContain('Conselho: “Entre ondas”');
      expect(html).not.toContain('Escolher caminho');
      expect(html).not.toContain('aria-label="Decidir: Entre ondas"');
    }
  });

  it('conta a onda na barra e no título e leva ao painel do Cerco', () => {
    expect(statusBar(input)).toMatchObject({
      text: '$(shield) 1 decisão pendente · onda 2 em 59 min',
      target: 'siege',
    });
    expect(statusBar(input).tooltip).toContain('A decisão entre ondas está na aba Exército.');
    expect(statusBar(input).tooltip).not.toContain('encruzilhada');
    expect(documentTitle(input)).toBe(
      '(1) Cerco · onda 2 em 59 min · Pedra Alta · Lords of the Guild',
    );
    expect(cardDecisions(siegeWaveView)).toEqual([]);
    expect(crossroadsDecisions(siegeWaveView)).toEqual([]);
  });

  it('mostra a expiração iminente da onda na barra sob frio ou fome', () => {
    const coldSiege: typeof siegeWaveView = {
      ...siegeWaveView,
      winter: {
        cold: { text: 'Frio extremo no feudo.' },
      } as unknown as typeof siegeWaveView.winter,
    };
    const bar = statusBar({
      ...input,
      view: coldSiege,
      elapsedSeconds: 300,
    });
    expect(bar.text).toMatch(/^\$\(flame\) Frio em .* · \$\(shield\) onda 2: 55 min$/);
    expect(bar.alarm).toBe(true);
    expect(bar.target).toBe('siege');
    expect(bar.tooltip).toContain('Frio extremo no feudo.');
    expect(bar.tooltip).toContain('"Entre ondas"');
    expect(bar.tooltip).toContain('A decisão entre ondas está na aba Exército.');
  });

  it('mantém a onda entre as decisões do Relatório de Retorno', () => {
    expect(pendingItems(siegeWaveView, 60)).toContainEqual({
      topic: 'siegeWave:siege-1-2',
      text: 'Cerco: “Entre ondas” · A onda seguinte chega em 59 min. Sem nova ordem, vale Defesa ativa.',
      severity: 'danger',
      action: { command: 'lords.openPanel', arg: 'siege', label: 'Ver a próxima onda' },
    });
  });

  it('também desenha a decisão quando a volta abre o relatório em Hoje', () => {
    const report = buildReturnReport(initialView, siegeWaveView, [], 5 * 3_600_000);
    const html = renderToString(
      <Today report={report} view={siegeWaveView} actions={actions} elapsed={60} />,
    );
    expect(html).toContain('Cerco: “Entre ondas”');
    expect(html).toContain('A onda seguinte chega em 59 min');
  });

  it('reflete siegeWave no nó Hoje da árvore de navegação', () => {
    const account = {
      kind: 'anonymous' as const,
      accountId: 'acc-1',
      displayName: 'Gustavo',
      hasRecoveryCode: false,
      gameId: 'game-1',
    };
    const online = { kind: 'online' as const };
    const offline = { kind: 'offline' as const, retryInMs: 5000, attempt: 1 };
    const tree = buildTree({
      view: siegeWaveView,
      account,
      connection: online,
      chronicle: [],
      unseen: 0,
      elapsedSeconds: 60,
    });
    const today = tree.find((node) => node.id === 'today');
    expect(today).toBeDefined();
    expect(today?.description).toBe('● 1 decisão pendente');
    expect(today?.command).toEqual({ id: 'lords.openPanel', args: ['today'] });

    const offlineTree = buildTree({
      view: siegeWaveView,
      account,
      connection: offline,
      chronicle: [],
      unseen: 0,
      elapsedSeconds: 60,
    });
    const offlineToday = offlineTree.find((node) => node.id === 'today');
    expect(offlineToday?.description).not.toContain('decisão');

    const multipleView: typeof siegeWaveView = {
      ...siegeWaveView,
      pendingDecisions: [
        ...siegeWaveView.pendingDecisions,
        { kind: 'card', id: 'card-1', title: 'Carta', expiresInSeconds: 3600 },
      ],
    };
    const multiTree = buildTree({
      view: multipleView,
      account,
      connection: online,
      chronicle: [],
      unseen: 0,
      elapsedSeconds: 60,
    });
    expect(multiTree.find((node) => node.id === 'today')?.description).toBe(
      '● 2 decisões pendentes',
    );
  });
});

const noopActions = { order: noop, run: noop, playNow: noop };
const planned = {
  ...siegeWaveView,
  army: {
    ...armyIdleView.army,
    formations: [
      {
        id: 'formation-1',
        name: 'Muralha Firme',
        isActive: true,
        posts: [],
        commanders: [],
        total: 3,
        shortfall: [],
        shortfallText: 'Tropa completa.',
        canDelete: false,
        previewStale: false,
      },
    ],
  },
  pendingDecisions: [],
  siege: { ...siegeWaveView.siege!, current: 0, scheduledInSeconds: 3900, nextWaveInSeconds: 3900 },
};
const panel = (
  view: typeof siegeWaveView,
  elapsed = 0,
  disabled = false,
  busy: ReadonlySet<string> = new Set(),
) =>
  renderToString(
    <SiegePanel
      view={view}
      elapsed={elapsed}
      disabled={disabled}
      busy={busy}
      actions={noopActions}
    />,
  );

describe('o Plano, as ondas e o rescaldo', () => {
  it('sem Cerco não há painel; plano usa a Defesa ativa em cada onda e mantém a névoa', () => {
    expect(panel(initialView)).toBe('');
    expect(ViewStateSchema.parse(planned)).toEqual(planned);
    const html = panel(planned, 60);
    expect(html).toContain('Cerco do Inverno');
    expect(html).toContain('1:04:00');
    expect(html.match(/Defesa ativa · Muralha Firme/g)).toHaveLength(6);
    expect(html).toContain('O plano vale também durante a sua ausência.');
    expect(html).not.toContain('Milícia');
    expect(html).not.toContain('Xamã');
    expect(html).toContain('id="siege-title" tabindex="-1"');
  });
  it('as ondas usam formação própria, o presságio público e o progresso atual', () => {
    const view = {
      ...planned,
      siege: { ...planned.siege, plan: { 1: 'formation-1', 2: null, 3: null }, current: 1 },
      pendingDecisions: siegeWaveView.pendingDecisions,
    };
    const html = panel(view);
    expect(html).toContain('Enfrentada');
    expect(html).toContain('aria-current="step"');
    expect(html).toContain('Próxima onda');
    expect(html).toContain('Plano: Muralha Firme');
    expect(html).toContain('Trocar formação…');
    expect(html).not.toContain('Salvar onda');
  });
  it('decisão vencida e modo sem ligação desabilitam ordens; não oferecem reparo comum entre ondas', () => {
    for (const [elapsed, offline] of [
      [3600, false],
      [0, true],
    ] as const) {
      const html = panel(siegeWaveView, elapsed, offline);
      expect(html).toMatch(/<button[^>]*disabled[^>]*><span[^>]*git-compare/);
      expect(html).not.toContain('data-testid="wall-review-open"');
    }
    expect(panel(siegeWaveView, 3600)).toContain('O prazo acabou.');
    expect(panel(siegeWaveView, 0, false, new Set(['siege:swap']))).toContain('Trocando…');
  });
  it('os três resultados usam a palavra da visão e preservam as ondas que não ocorreram', () => {
    for (const [result, resultText] of [
      ['glorious', 'Vitória Gloriosa'],
      ['victory', 'Vitória'],
      ['fall', 'Queda'],
    ] as const) {
      const view = {
        ...planned,
        siege: {
          ...planned.siege,
          current: result === 'fall' ? 1 : 3,
          result,
          resultText,
          nextWaveInSeconds: null,
        },
      };
      const html = panel(view);
      expect(html).toContain(`${resultText} · Rescaldo`);
      expect(html).toContain('O feudo segue.');
      expect(html).toContain('Ver as obras');
      expect(html).not.toContain('Salvar onda');
      expect(html).not.toContain('Trocar formação');
      if (result === 'fall') expect(html).toContain('Não ocorreu');
    }
  });
  it('o orçamento público e os efeitos atuais da moral acompanham o rescaldo', () => {
    const view = {
      ...planned,
      threat: palisadeRaisedView.threat,
      morale: {
        ...planned.morale,
        effects: [{ label: 'Luto pelo Cerco', amount: -10, endsInSeconds: 7200 }],
      },
      siege: {
        ...planned.siege,
        current: 1,
        result: 'fall' as const,
        resultText: 'Queda',
        nextWaveInSeconds: null,
      },
    };
    const html = panel(view, 3600);
    expect(html).toContain('Luto pelo Cerco: -10 · termina em 1 h');
    expect(html).toContain(palisadeRaisedView.threat.defense.wall.repairOffer.text);
  });
  it('Antes de partir põe a onda no topo com o prazo atual e não a duplica no Retorno', () => {
    expect(beforeLeaving(siegeWaveView, [], 60)[0]).toMatchObject({
      id: 'siegeWave:siege-1-2',
      severity: 'danger',
      text: expect.stringContaining('59 min'),
    });
    expect(beforeLeaving(siegeWaveView, ['siegeWave:siege-1-2'])).not.toContainEqual(
      expect.objectContaining({ id: 'siegeWave:siege-1-2' }),
    );
    expect(beforeLeaving(planned)).toContainEqual(expect.objectContaining({ id: 'siege:plan' }));
    expect(
      beforeLeaving({
        ...planned,
        siege: { ...planned.siege, plan: { 1: 'formation-1', 2: 'formation-1', 3: 'formation-1' } },
      }),
    ).not.toContainEqual(expect.objectContaining({ id: 'siege:plan' }));
  });
  it('o Cerco marcado entra na barra e no título; sem ligação e no discreto não sai informação de jogo', () => {
    expect(statusBar({ ...input, view: planned })).toMatchObject({
      text: '$(shield) Cerco em 01:04',
      target: 'siege',
    });
    expect(documentTitle({ ...input, view: planned })).toContain('Cerco em 01:04');
    expect(documentTitle({ ...input, discreetMode: true })).not.toContain('Cerco');
    expect(
      statusBar({ ...input, connection: { kind: 'offline', retryInMs: 1000, attempt: 1 } }).text,
    ).not.toContain('onda');
  });
  it('os prazos incluem marcação, próxima onda e decisão, ignorando o zero persistente', () => {
    expect(siegeDeadlines(planned)).toEqual([3900, 3900]);
    expect(siegeDeadlines(siegeWaveView)).toEqual([3600, 3600]);
    expect(
      siegeDeadlines({
        ...siegeWaveView,
        pendingDecisions: [],
        siege: { ...siegeWaveView.siege!, nextWaveInSeconds: null },
      }),
    ).toEqual([]);
  });
});

describe('a Queda no Retorno e os avisos essenciais', () => {
  it('recursos perdidos na Queda entram em Levado, sem inventar desperdício ou produção negativa', () => {
    const before = {
      ...planned,
      resources: planned.resources.map((row) => ({ ...row, stock: 100, wastedToday: 0 })),
    };
    const after = {
      ...before,
      resources: before.resources.map((row) => ({
        ...row,
        stock: row.id === 'wood' ? 70 : row.stock,
      })),
    };
    const event = {
      ...gameEvent(1, 'siegeFell', 'O feudo sobrevive em ruínas.'),
      data: { year: 1, lost_wood: 30 },
    };
    const report = buildReturnReport(before, after, [event], 5 * 3600_000);
    expect(report.resources.find((row) => row.id === 'wood')).toMatchObject({
      raided: 30,
      cut: 0,
      wasted: 0,
      produced: 0,
    });
    expect(report.blocks?.cost).toContainEqual(
      expect.objectContaining({
        topic: 'siege',
        text: event.text,
        action: { command: 'lords.openPanel', arg: 'siege', label: 'Ver o rescaldo' },
      }),
    );
    expect(report.blocks?.cost.some((item) => item.text.includes('foram ao chão'))).toBe(false);
  });
  it('resultado e reconstrução entram no bloco de prosperidade com as frases dos eventos', () => {
    for (const type of [
      'siegeGlorious',
      'siegeWon',
      'warlordSlain',
      'reconstructionStarted',
    ] as const) {
      const event = gameEvent(1, type);
      expect(
        buildReturnReport(planned, planned, [event], 5 * 3600_000).blocks?.prospered,
      ).toContainEqual(expect.objectContaining({ text: event.text, topic: 'siege' }));
    }
  });
  it('a onda anuncia a próxima decisão e o plano, sem informar composição', () => {
    const event = { ...gameEvent(1, 'siegeWaveFought'), data: { year: 1, wave: 1 } };
    expect(siegeNotice(event, siegeWaveView, 0, 'UTC')).toMatchObject({
      details: [
        expect.stringContaining('A onda seguinte chega em 1 h'),
        expect.stringContaining('Defesa ativa'),
      ],
    });
    expect(siegeNotice({ ...event, data: { year: 1, wave: 2 } }, siegeWaveView, 0)).toBeNull();
    const events = [event, gameEvent(2, 'siegeWon')];
    const options = {
      events,
      level: 'essential' as const,
      discreetMode: false,
      mutedUntil: null,
      now: 0,
      history: [],
    };
    expect(decideNotifications(options).show).toEqual(events);
    expect(decideNotifications({ ...options, discreetMode: true }).show).toEqual([]);
    expect(decideNotifications({ ...options, level: 'silent' }).show).toEqual([]);
  });
});
