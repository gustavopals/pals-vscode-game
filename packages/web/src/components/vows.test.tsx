import type { GameEvent, ViewState } from '@lotg/protocol';
import { type ComponentChild, options } from 'preact';
import { renderToString } from 'preact-render-to-string';
import { afterEach, describe, expect, it } from 'vitest';

import type { Controller } from '../app/controller';
import { beforeLeaving } from '../game/beforeLeaving';
import { intentOf } from '../game/intent';
import { buildReturnReport, pendingItems } from '../game/returnReport';
import { bindCommands, type CommandEnv, createCommands } from '../palette/commands';
import { ArmyTab } from '../tabs/Army';
import {
  armyIdleView,
  gameEvent,
  initialView,
  makeController,
  scriptedDialogs,
  settle,
  siegeWaveView,
} from '../test-helpers';
import { emptyDraft } from '../ui/formation';
import type { Actions } from './actions';
import { FormationEditor } from './FormationEditor';
import { SiegePanel } from './SiegePanel';
import { Today } from './Today';
import { VowsPanel } from './VowsPanel';
import { WarCouncilPanel } from './WarCouncilPanel';
import { YearChronicle } from './YearChronicle';

const noop = () => {};
const actions: Actions = { order: noop, run: noop, playNow: noop };
const NONE: ReadonlySet<string> = new Set();
const html = (node: ComponentChild) => renderToString(<>{node}</>);
const text = (markup: string) =>
  markup
    .replace(/<span class="sr-only">.*?<\/span>/g, '')
    .replace(/<\/(h1|h2|h3|h4|p|li|button|div|label|dt|dd)>/g, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();

function clickTestId(node: ComponentChild, testId: string): void {
  const previous = options.vnode;
  let handler: (() => void) | undefined;
  options.vnode = (vnode) => {
    previous?.(vnode);
    const props = vnode.props as Record<string, unknown> | null | undefined;
    if (props?.['data-testid'] === testId && typeof props.onClick === 'function') {
      handler = props.onClick as () => void;
    }
  };
  try {
    renderToString(<>{node}</>);
  } finally {
    if (previous === undefined) {
      delete options.vnode;
    } else {
      options.vnode = previous;
    }
  }
  handler?.();
}

const sampleOffer: ViewState['vows']['offer'] = [
  {
    id: 'noWalls',
    label: 'Sem muralhas',
    legacyBonusPercent: 40,
    description: 'Para o Ano 2: A Paliçada não repele incursões e as muralhas não protegem.',
  },
  {
    id: 'cunningHorde',
    label: 'Horda astuta',
    legacyBonusPercent: 25,
    description: 'Para o Ano 2: A Horda aprende com astúcia 0,8.',
  },
  {
    id: 'scarceFood',
    label: 'Comida escassa',
    legacyBonusPercent: 20,
    description: 'Para o Ano 2: A produção de comida é multiplicada por 0,8.',
  },
  {
    id: 'mortalHeroes',
    label: 'Heróis mortais',
    legacyBonusPercent: 35,
    description: 'Para o Ano 2: Heróis podem morrer nas batalhas e nos Desastres.',
  },
];

function yearTwoOpenView(closesInSeconds = 86400): ViewState {
  return {
    ...initialView,
    calendar: { ...initialView.calendar, year: 2 },
    vows: {
      offer: sampleOffer,
      taken: [],
      closesInSeconds,
    },
  };
}

function siegeAftermathVowsView(closesInSeconds = 86400): ViewState {
  return {
    ...siegeWaveView,
    pendingDecisions: [],
    siege: {
      ...siegeWaveView.siege!,
      current: 3,
      nextWaveInSeconds: null,
      result: 'victory',
      resultText: 'Vitória',
    },
    vows: {
      offer: sampleOffer,
      taken: [],
      closesInSeconds,
    },
  };
}

function yearTwoTakenView(takenIds: Array<ViewState['vows']['offer'][number]['id']>): ViewState {
  return {
    ...initialView,
    calendar: { ...initialView.calendar, year: 2 },
    vows: {
      offer: [],
      taken: sampleOffer.filter((vow) => takenIds.includes(vow.id)),
      closesInSeconds: 0,
    },
  };
}

const controllers: Controller[] = [];
afterEach(() => {
  for (const controller of controllers.splice(0)) {
    controller.dispose();
  }
});

describe('Painel dos Votos e Ano 2 (V5C-T4)', () => {
  it('mostra os Votos oferecidos com nome, descrição, bônus de Legado e prazo da janela', () => {
    const view = yearTwoOpenView(7200);
    const markup = html(<VowsPanel view={view} elapsed={0} disabled={false} actions={actions} />);
    const plain = text(markup);

    expect(markup).toContain('data-testid="vows-panel"');
    expect(plain).toContain('Votos do Ano');
    expect(plain).toContain('fecha em 2 h');
    for (const vow of sampleOffer) {
      expect(plain).toContain(vow.label);
      expect(plain).toContain(`+${vow.legacyBonusPercent}% de Legado`);
      expect(plain).toContain(vow.description);
      expect(markup).toContain(`data-testid="vow-check-${vow.id}"`);
    }
    // Uma ação por estado: na etapa 1 só aparece "Firmar Votos…", sem o botão de confirmação final.
    expect(markup).toContain('data-testid="vows-review-open"');
    expect(markup).not.toContain('data-testid="vows-confirm-button"');
    expect(markup).not.toContain('data-testid="vows-back"');
  });

  it('faz a conferência em duas etapas com aviso de irreversibilidade, listando marcados ou nenhum', () => {
    const view = yearTwoOpenView(3600);
    const withTwo = html(
      <VowsPanel
        view={view}
        elapsed={0}
        disabled={false}
        initialSelected={['noWalls', 'scarceFood']}
        initialReviewing={true}
        actions={actions}
      />,
    );
    const plainTwo = text(withTwo);
    expect(withTwo).toContain('data-testid="vows-confirm"');
    expect(withTwo).toContain('data-testid="vows-confirm-button"');
    expect(withTwo).toContain('data-testid="vows-back"');
    // Uma ação por estado: durante a conferência, o botão de abrir a revisão não aparece.
    expect(withTwo).not.toContain('data-testid="vows-review-open"');
    expect(plainTwo).toContain('Sem muralhas (+40% de Legado), Comida escassa (+20% de Legado)');
    expect(plainTwo).toContain('irreversível no ano');

    // Escolher nenhum também é uma escolha válida na conferência.
    const withNone = html(
      <VowsPanel
        view={view}
        elapsed={0}
        disabled={false}
        initialSelected={[]}
        initialReviewing={true}
        actions={actions}
      />,
    );
    expect(text(withNone)).toContain('nenhum Voto marcado (governar o ano sem Votos)');
    expect(text(withNone)).toContain('irreversível no ano');

    // Confirmar dispara lords.takeVows com os Votos marcados (ou lista vazia).
    const calls: Array<[string, unknown]> = [];
    const recording: Actions = { ...actions, run: (id, arg) => calls.push([id, arg]) };
    clickTestId(
      <VowsPanel
        view={view}
        elapsed={0}
        disabled={false}
        initialSelected={['noWalls']}
        initialReviewing={true}
        actions={recording}
      />,
      'vows-confirm-button',
    );
    clickTestId(
      <VowsPanel
        view={view}
        elapsed={0}
        disabled={false}
        initialSelected={[]}
        initialReviewing={true}
        actions={recording}
      />,
      'vows-confirm-button',
    );
    expect(calls).toEqual([
      ['lords.takeVows', { vows: ['noWalls'], confirmed: true }],
      ['lords.takeVows', { vows: [], confirmed: true }],
    ]);
  });

  it('com a janela fechada, mostra os Votos ativos no ano (ou nenhum) e esconde caixas e botões', () => {
    const takenView = yearTwoTakenView(['noWalls', 'mortalHeroes']);
    const takenMarkup = html(
      <VowsPanel view={takenView} elapsed={0} disabled={false} actions={actions} />,
    );
    expect(takenMarkup).toContain('data-testid="vows-closed"');
    expect(takenMarkup).toContain('data-testid="vows-taken-list"');
    expect(takenMarkup).not.toContain('type="checkbox"');
    expect(takenMarkup).not.toContain('data-testid="vows-review-open"');
    expect(takenMarkup).not.toContain('data-testid="vows-confirm-button"');
    expect(text(takenMarkup)).toContain('Votos ativos neste ano (2)');
    expect(text(takenMarkup)).toContain('Sem muralhas');
    expect(text(takenMarkup)).toContain('Heróis mortais');

    const emptyClosedView = yearTwoTakenView([]);
    const emptyMarkup = html(
      <VowsPanel view={emptyClosedView} elapsed={0} disabled={false} actions={actions} />,
    );
    expect(text(emptyMarkup)).toContain('Janela de Votos encerrada: nenhum Voto ativo neste ano.');
    expect(emptyMarkup).not.toContain('type="checkbox"');
    expect(emptyMarkup).not.toContain('data-testid="vows-review-open"');

    // No rescaldo do Cerco do ano corrente, os Votos firmados valem para o próximo ano; no Ano 2,
    // mesmo que o rescaldo do Ano 1 ainda conste na visão, passam a "Votos ativos neste ano".
    const aftermathClosedView: ViewState = {
      ...siegeAftermathVowsView(0),
      vows: { offer: [], taken: [sampleOffer[0]!], closesInSeconds: 0 },
    };
    const aftermathMarkup = html(
      <VowsPanel view={aftermathClosedView} elapsed={0} disabled={false} actions={actions} />,
    );
    expect(text(aftermathMarkup)).toContain('Votos firmados para o próximo ano (1)');
    expect(aftermathMarkup).not.toContain('type="checkbox"');

    const yearTwoWithOldSiege: ViewState = {
      ...aftermathClosedView,
      calendar: { ...aftermathClosedView.calendar, year: 2 },
    };
    expect(
      text(
        html(
          <VowsPanel view={yearTwoWithOldSiege} elapsed={0} disabled={false} actions={actions} />,
        ),
      ),
    ).toContain('Votos ativos neste ano (1)');

    // Prazo vencido localmente ou sem ligação: respeita uma ação por estado e modo leitura.
    const expiredLocally = html(
      <VowsPanel view={yearTwoOpenView(10)} elapsed={20} disabled={false} actions={actions} />,
    );
    expect(text(expiredLocally)).toContain('prazo encerrado');
    expect(expiredLocally).not.toContain('data-testid="vows-review-open"');
    expect(expiredLocally).not.toContain('data-testid="vows-confirm-button"');

    const offline = html(
      <VowsPanel view={yearTwoOpenView(3600)} elapsed={0} disabled={true} actions={actions} />,
    );
    expect(offline).toContain('data-testid="vows-offline"');
    expect(offline).toContain('Sem ligação com o reino');
  });

  it('aparece no rescaldo do Cerco, na aba Hoje, na aba Exército e em "Você ainda pode decidir"', () => {
    const aftermath = siegeAftermathVowsView(5400);
    const siegeHtml = html(
      <SiegePanel view={aftermath} elapsed={0} disabled={false} busy={NONE} actions={actions} />,
    );
    expect(siegeHtml).toContain('data-testid="siege-aftermath"');
    expect(siegeHtml).toContain('data-testid="vows-panel"');

    const todayHtml = html(<Today report={null} view={aftermath} actions={actions} />);
    expect(todayHtml).toContain('data-testid="vows-panel"');

    const leaving = beforeLeaving(aftermath, [], 0);
    expect(leaving).toContainEqual(
      expect.objectContaining({
        id: 'vows',
        command: { id: 'lords.openPanel', arg: 'vows', label: 'Escolher Votos' },
      }),
    );

    const pending = pendingItems(aftermath, 0);
    expect(pending).toContainEqual(
      expect.objectContaining({
        topic: 'vows',
        action: { command: 'lords.openPanel', arg: 'vows', label: 'Escolher Votos' },
      }),
    );

    // Depois que os Votos são tomados e a janela fecha, saem de "Você ainda pode decidir" e
    // continuam visíveis como Votos ativos na aba Hoje e na aba Exército durante o ano corrente.
    const chosen = yearTwoTakenView(['cunningHorde']);
    expect(beforeLeaving(chosen, [], 0).some((item) => item.id === 'vows')).toBe(false);
    expect(pendingItems(chosen, 0).some((item) => item.topic === 'vows')).toBe(false);

    const todayAfter = html(<Today report={null} view={chosen} actions={actions} />);
    expect(todayAfter).toContain('data-testid="vows-taken-list"');
    expect(text(todayAfter)).toContain('Horda astuta');

    const armyAfter = html(
      <ArmyTab
        view={chosen}
        elapsed={0}
        online={true}
        retryInSeconds={null}
        busy={NONE}
        actions={actions}
      />,
    );
    expect(armyAfter).toContain('data-testid="vows-taken-list"');
    expect(text(armyAfter)).toContain('Horda astuta');

    // O evento vowsTaken entra em "O feudo prosperou" no Relatório de Retorno.
    const report = buildReturnReport(
      aftermath,
      chosen,
      [
        {
          ...gameEvent(
            1,
            'vowsTaken',
            'Para o Ano 2, o senhor de Pedra Alta firmou os Votos: Horda astuta.',
          ),
          data: { year: 2, vows: 'cunningHorde' },
        },
      ],
      6 * 3600_000,
    );
    expect(report.blocks?.prospered).toContainEqual(
      expect.objectContaining({
        topic: 'vows',
        text: 'Para o Ano 2, o senhor de Pedra Alta firmou os Votos: Horda astuta.',
      }),
    );
  });

  it('YearChronicle mostra os Votos do ano e os pontos de Legado quando yearEnded os traz', () => {
    const vowsTakenYearOne: GameEvent = {
      ...gameEvent(
        2,
        'vowsTaken',
        'Pedra Alta firmou para o Ano 1: Sem muralhas e Comida escassa.',
      ),
      data: { year: 1, vows: 'noWalls,scarceFood' },
    };
    const yearEndedWithVows: GameEvent = {
      ...gameEvent(
        10,
        'yearEnded',
        'Encerra-se o ano 1 da Casa de Pedra Alta. Os escribas registram 230 pontos e os Feitos do ano.',
      ),
      data: {
        year: 1,
        score: 230,
        feats: 'firstWinter',
        vows: 'noWalls,scarceFood',
        legacy: 368,
      },
    };
    const withLegacy = html(
      <YearChronicle
        completedYears={[1]}
        selected={1}
        loading={false}
        events={[vowsTakenYearOne, yearEndedWithVows]}
        actions={actions}
      />,
    );
    expect(withLegacy).toContain('data-testid="year-chronicle-legacy"');
    expect(text(withLegacy)).toContain('Sem muralhas e Comida escassa');
    expect(text(withLegacy)).toContain('368 pontos');

    // Mesmo sem o evento vowsTaken no trecho em memória, o mapa de rótulos da visão resolve os nomes.
    const withCachedLabels = html(
      <YearChronicle
        completedYears={[1]}
        selected={1}
        loading={false}
        events={[yearEndedWithVows]}
        vowLabels={
          new Map([
            ['noWalls', 'Sem muralhas'],
            ['scarceFood', 'Comida escassa'],
          ])
        }
        actions={actions}
      />,
    );
    expect(text(withCachedLabels)).toContain('Sem muralhas, Comida escassa');
    expect(text(withCachedLabels)).toContain('368 pontos');

    const yearEndedPlain: GameEvent = {
      ...gameEvent(
        11,
        'yearEnded',
        'Encerra-se o ano 1 da Casa de Pedra Alta. Os escribas registram 230 pontos e os Feitos do ano.',
      ),
      data: { year: 1, score: 230, feats: 'firstWinter' },
    };
    const withoutLegacy = html(
      <YearChronicle
        completedYears={[1]}
        selected={1}
        loading={false}
        events={[yearEndedPlain]}
        actions={actions}
      />,
    );
    expect(withoutLegacy).not.toContain('data-testid="year-chronicle-legacy"');
  });

  it('prévia do Conselho de Guerra e editor mostram o nome "Troll" vindo da visão', () => {
    const armyWithTroll: ViewState['army'] = {
      ...armyIdleView.army,
      formations: [
        {
          id: 'formation-1',
          name: 'Guarda',
          isActive: true,
          previewStale: false,
          posts: [],
          commanders: [],
          total: 0,
          shortfall: [],
          shortfallText: '',
          canDelete: true,
        },
      ],
      preview: {
        formationId: 'formation-1',
        siegeWave: null,
        warning: null,
        runs: 200,
        winsPercent: 60,
        gloriousPercent: 15,
        lossesPercent: 40,
        riskText: 'Os Trolls pressionam o centro.',
        expectedLosses: [],
        knownEnemy: [
          {
            wing: 'center',
            wingLabel: 'Centro',
            line: 'front',
            lineLabel: 'Frente',
            known: true,
            unitLabel: 'Trolls',
            count: 3,
            text: 'Trolls 3',
          },
        ],
      },
    };
    const councilHtml = html(
      <WarCouncilPanel
        army={armyWithTroll}
        formationId="formation-1"
        disabled={false}
        busy={NONE}
        actions={actions}
      />,
    );
    expect(councilHtml).toContain('data-testid="war-known-enemy"');
    expect(text(councilHtml)).toContain('Trolls 3');

    const editorHtml = html(
      <FormationEditor
        army={armyWithTroll}
        draft={{ ...emptyDraft(), id: 'formation-1', name: 'Guarda' }}
        onChange={noop}
        disabled={false}
        busy={false}
        actions={actions}
      />,
    );
    expect(editorHtml).toContain('data-testid="enemy-center-front"');
    expect(text(editorHtml)).toContain('Trolls 3');
  });

  it('lords.takeVows segue o molde de intenção, trava vows e releitura após diálogo na paleta', async () => {
    expect(intentOf('takeVows', { vows: ['noWalls'] })).toBe('vows');
    expect(intentOf('takeVows', { vows: [] })).toBe('vows');

    const openView = yearTwoOpenView(86400);
    const closedView = yearTwoTakenView(['noWalls']);

    const made = makeController({ signedIn: true });
    controllers.push(made.controller);
    made.api.state.view = openView;
    const scripted = scriptedDialogs();
    const env: CommandEnv = {
      download: () => {},
      reload: () => {},
      sleep: async () => {},
      currentTheme: () => 'dark',
      openPalette: () => {},
      reveal: () => {},
    };
    const commands = createCommands(made.controller, scripted.dialogs, env);
    bindCommands(made.controller, commands);
    await made.controller.start();
    await settle(made.controller);

    // Pela paleta: marca o 1º Voto (índice 1), avança para a conferência (índice 0) e confirma (true).
    scripted.answers.push(1, 0, true);
    await commands.find((command) => command.id === 'lords.takeVows')?.run();
    await settle(made.controller);

    expect(
      made.api.state.commands.map((command) => ({
        type: command.type,
        payload: command.payload,
      })),
    ).toEqual([{ type: 'takeVows', payload: { vows: ['noWalls'] } }]);

    // Se a janela fechar enquanto o diálogo de confirmação está aberto, a releitura aborta o envio.
    made.api.state.view = openView;
    made.api.state.stateVersion += 1;
    await made.controller.session.syncNow();
    scripted.answers.push(0, async () => {
      made.api.state.view = closedView;
      made.api.state.stateVersion += 1;
      await made.controller.session.syncNow();
      return true;
    });
    await commands.find((command) => command.id === 'lords.takeVows')?.run();
    await settle(made.controller);

    expect(made.api.state.commands).toHaveLength(1);
    expect(made.controller.toasts.at(-1)?.text).toContain('janela de Votos fechou');
  });

  it('controlador preserva yearEvents e vowLabels além das 20 linhas da Crônica recente e trava retry vencido', async () => {
    const made = makeController({ signedIn: true });
    controllers.push(made.controller);
    made.api.state.view = yearTwoOpenView(86400);
    await made.controller.start();
    await settle(made.controller);

    // A visão recebida guarda os rótulos dos Votos oferecidos.
    expect(made.controller.vowLabels.get('scarceFood')).toBe('Comida escassa');
    expect(made.controller.vowLabels.get('noWalls')).toBe('Sem muralhas');

    // Mesmo após 25 eventos subsequentes, yearEnded e vowsTaken permanecem em yearEvents.
    const takenEvent: GameEvent = {
      ...gameEvent(1, 'vowsTaken', 'Pedra Alta firmou para o Ano 1: Comida escassa.'),
      data: { year: 1, vows: 'scarceFood' },
    };
    const endedEvent: GameEvent = {
      ...gameEvent(
        2,
        'yearEnded',
        'Encerra-se o ano 1 da Casa de Pedra Alta. Os escribas registram 100 pontos e os Feitos do ano.',
      ),
      data: { year: 1, score: 100, feats: '', vows: 'scarceFood', legacy: 120 },
    };
    const filler = Array.from({ length: 25 }, (_, i) =>
      gameEvent(3 + i, 'constructionFinished', `Obra ${i + 1} concluída.`),
    );
    made.api.state.events.push(takenEvent, endedEvent, ...filler);
    made.api.state.stateVersion += 1;
    await made.controller.session.syncNow();
    await settle(made.controller);

    expect(made.controller.chronicle).toHaveLength(20);
    expect(made.controller.chronicle.some((e) => e.type === 'yearEnded')).toBe(false);
    expect(made.controller.yearEvents.map((e) => e.type)).toEqual(['vowsTaken', 'yearEnded']);

    // Falha de rede ao firmar Votos gera retentativa, que recusa reenviar se a janela fechar antes.
    made.api.state.online = false;
    await made.controller.takeVows(['noWalls']);
    await settle(made.controller);
    const retryAction = made.controller.toasts
      .flatMap((toast) => toast.actions)
      .find((entry) => entry.label === 'Tentar de novo');
    expect(retryAction).toBeDefined();

    made.api.state.online = true;
    made.api.state.view = yearTwoTakenView([]);
    made.api.state.stateVersion += 1;
    await made.controller.session.syncNow();
    await settle(made.controller);

    retryAction?.run();
    await settle(made.controller);
    expect(made.api.state.commands).toEqual([]);
    expect(made.controller.toasts.at(-1)?.text).toContain('não foi reenviada');
  });
});
