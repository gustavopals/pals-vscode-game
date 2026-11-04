import type { ViewState } from '@lotg/protocol';
import type { ComponentChild } from 'preact';
import { renderToString } from 'preact-render-to-string';
import { describe, expect, it } from 'vitest';

import { ArmyTab } from '../tabs/Army';
import { armyIdleView, armyTrainingView, initialView } from '../test-helpers';
import type { Actions } from './actions';
import { BarracksPanel } from './BarracksPanel';
import { BattleReports } from './BattleReport';
import { CampaignPanel } from './CampaignPanel';
import { FormationEditor } from './FormationEditor';
import { WarCouncilPanel } from './WarCouncilPanel';
import { emptyDraft } from '../ui/formation';

/**
 * O painel do Quartel (V4C-T3.2), desenhado com visões de exemplo. O app só dispõe o que veio:
 * o custo, o prazo, o que o cancelamento devolve e quem vence quem são da visão. O que depende
 * de clique (as duas etapas, o teclado) é provado em navegador, em `tests/e2e/12-exercito.spec.ts`.
 */

const noop = () => {};
const actions: Actions = { order: noop, run: noop, playNow: noop };
const NONE: ReadonlySet<string> = new Set();
const html = (node: ComponentChild) => renderToString(<>{node}</>);
const text = (markup: string) =>
  markup
    .replace(/<span class="sr-only">.*?<\/span>/g, '')
    .replace(/<\/(h1|h2|h3|p|li|button|div|td|th|tr)>/g, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&#39;/g, "'")
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();

const panel = (view: ViewState, online = true, busy: ReadonlySet<string> = NONE, elapsed = 0) =>
  html(
    <BarracksPanel
      view={view}
      elapsed={elapsed}
      disabled={!online}
      busy={busy}
      actions={actions}
    />,
  );

describe('o painel do Quartel (V4C-T3.2)', () => {
  it('sem o Quartel: a frase do servidor, a obra e as unidades; nenhum treino', () => {
    const markup = panel(initialView);
    expect(text(markup)).toContain(initialView.army.text);
    expect(markup).toContain('army-raise');
    expect(markup).not.toContain('train-form');
    expect(markup).not.toContain('disband-form');
    for (const unit of initialView.army.units) {
      expect(markup).toContain(`army-unit-${unit.id}`);
    }
  });

  it('as cinco unidades trazem custo, contra quem são fortes e a comida, tudo da visão', () => {
    const markup = text(panel(armyIdleView));
    for (const unit of armyIdleView.army.units) {
      expect(markup).toContain(unit.label);
      expect(markup).toContain(unit.costText);
      expect(markup).toContain(unit.counters);
      expect(markup).toContain(unit.foodPerHour);
    }
    expect(markup).toContain(armyIdleView.army.foodText);
    expect(markup).toContain('Soldados: 3 de 40');
  });

  it('com o Quartel de pé e o pátio livre: o treino em duas etapas, "Revisar" primeiro', () => {
    const markup = panel(armyIdleView);
    expect(markup).toContain('train-form');
    expect(markup).toContain('data-testid="train-review"');
    expect(markup).not.toContain('train-confirm');
    expect(markup).toContain('disband-form');
  });

  it('o lote em curso: o fim, o que o cancelamento devolve e o botão; sem o formulário', () => {
    const { training } = armyTrainingView.army;
    const markup = panel(armyTrainingView);
    expect(text(markup)).toContain(`Treinando ${training?.label}`);
    expect(text(markup)).toContain('termina em 10 min');
    expect(text(markup)).toContain(training?.cancelRefundText);
    expect(markup).toContain('data-testid="army-cancel"');
    expect(markup).not.toContain('train-form');
    const late = panel(armyTrainingView, true, NONE, 605);
    expect(text(late)).toContain('termina agora');
  });

  it('sem ligação, os botões ficam travados; com a ordem a caminho, ocupados', () => {
    expect(panel(armyTrainingView, false)).toMatch(
      /<button[^>]*data-testid="army-cancel"[^>]*disabled/,
    );
    expect(panel(armyTrainingView, true, new Set(['train']))).toMatch(
      /data-testid="army-running"[^>]*aria-busy="true"/,
    );
    expect(panel(armyIdleView, false)).toMatch(/<fieldset[^>]*disabled/);
  });

  it('a aba Exército traz o painel e, sem ligação, o aviso do último estado conhecido', () => {
    const tab = (online: boolean) =>
      html(
        <ArmyTab
          view={armyIdleView}
          elapsed={0}
          online={online}
          retryInSeconds={null}
          busy={NONE}
          actions={actions}
        />,
      );
    expect(tab(true)).toContain('army-units');
    expect(text(tab(false))).toContain('último estado conhecido');
  });
});

describe('o relatório de batalha (V4D-T4.3)', () => {
  const report: ViewState['army']['reports'][number] = {
    id: 'battle-1',
    mode: 'defense',
    modeLabel: 'Defesa do feudo',
    outcome: 'victory',
    outcomeLabel: 'Vitória',
    ending: 'rout',
    endingText: 'Um dos lados debandou.',
    roundsCount: 2,
    factors: [
      {
        factor: 'counter',
        owner: 'player',
        wing: null,
        wingLabel: null,
        round: 1,
        amount: 12,
        percent: null,
        text: 'A tropa certa contra o inimigo deu 12 de dano a mais.',
      },
    ],
    noFactorText: 'Nenhum fator se destacou.',
    rounds: [
      {
        round: 1,
        attacks: ['O feudo, centro, frente: 5 lanceiros atacam. Dano 10, 1 baixas.'],
        casualtiesPlayer: 0,
        casualtiesHorde: 1,
        moraleText: 'Moral: feudo 100, Horda 95.',
        wallText: null,
      },
    ],
    casualties: [
      {
        owner: 'player',
        wing: 'center',
        line: 'front',
        start: 5,
        lost: 1,
        text: 'O feudo, centro, frente: lanceiros, 1 de 5.',
      },
    ],
    wall: [],
    commanders: [],
    adjustFormationId: 'formation-1',
  };

  it('mostra os fatores, as baixas e as rodadas colapsáveis, sem conta no app', () => {
    const markup = html(<BattleReports reports={[report]} onAdjust={noop} />);
    const shown = text(markup);
    expect(shown).toContain('Defesa do feudo: Vitória');
    expect(shown).toContain('A tropa certa contra o inimigo deu 12 de dano a mais.');
    expect(shown).toContain('lanceiros, 1 de 5');
    expect(markup).toContain('<details');
    expect(markup).toContain('data-testid="battle-adjust"');
    expect(markup).toMatch(/<h4 id="battle-report-battle-1-title" tabindex="-1">/);
  });

  it('sem formação para ajustar não há botão; sem relatório não há seção', () => {
    const markup = html(
      <BattleReports reports={[{ ...report, adjustFormationId: null }]} onAdjust={noop} />,
    );
    expect(markup).not.toContain('battle-adjust');
    expect(html(<BattleReports reports={[]} onAdjust={noop} />)).toBe('');
  });
});

describe('a campanha e ataque ao acampamento (V4F-T3)', () => {
  const sampleCampaign = {
    formationId: 'formation-1',
    formationName: 'Vanguarda',
    tile: 'raiderCamp',
    destination: 'Acampamento de Saqueadores',
    phase: 'marching' as const,
    text: 'O exército segue para o Acampamento de Saqueadores.',
    battleInSeconds: 3600,
    returnsInSeconds: 7200,
    reportId: null,
  };

  it('CampaignPanel exibe marcha, prazos e aviso de tropas fora', () => {
    const markup = html(<CampaignPanel campaign={sampleCampaign} elapsed={0} actions={actions} />);
    const shown = text(markup);
    expect(shown).toContain('Campanha militar');
    expect(shown).toContain('O exército segue para o Acampamento de Saqueadores.');
    expect(shown).toContain('Acampamento de Saqueadores');
    expect(shown).toContain('Vanguarda');
    expect(shown).toContain('Batalha em');
    expect(shown).toContain('1 h');
    expect(shown).toContain('Retorno em');
    expect(shown).toContain('2 h');
    expect(shown).toContain(
      'Soldados e comandantes em marcha não defendem o feudo até retornarem.',
    );
  });

  it('CampaignPanel na volta exibe botão de ver relatório de batalha', () => {
    const returningCampaign = {
      ...sampleCampaign,
      phase: 'returning' as const,
      text: 'O exército tomou o caminho de volta ao feudo.',
      reportId: 'battle-1',
    };
    const markup = html(
      <CampaignPanel campaign={returningCampaign} elapsed={0} actions={actions} />,
    );
    const shown = text(markup);
    expect(shown).toContain('O exército tomou o caminho de volta ao feudo.');
    expect(markup).toContain('data-testid="campaign-see-report"');
  });

  it('Ver relatório envia o identificador da batalha, inclusive quando há outros relatórios', () => {
    const calls: Array<[string, unknown]> = [];
    const node = CampaignPanel({
      campaign: { ...sampleCampaign, phase: 'returning', reportId: 'battle-7' },
      elapsed: 0,
      actions: { ...actions, run: (id, arg) => calls.push([id, arg]) },
    });
    const walk = (child: unknown): void => {
      if (Array.isArray(child)) {
        child.forEach(walk);
      } else if (typeof child === 'object' && child !== null) {
        const props = (child as { props?: Record<string, unknown> }).props;
        if (props?.['data-testid'] === 'campaign-see-report') {
          (props.onClick as () => void)();
        }
        walk(props?.children);
      }
    };
    walk(node);
    expect(calls).toEqual([['lords.openBattleReport', 'battle-7']]);
  });

  it('WarCouncilPanel exibe botão de atacar o acampamento e aviso de campanha', () => {
    const armyWithAssault = {
      ...armyIdleView.army,
      warCouncilTitle: 'Prévia fornecida pelo feudo',
      campAssault: {
        text: 'O exército viaja até o Acampamento.',
        travelSeconds: 5400,
        totalSeconds: 10800,
        blockedReason: null,
        formations: [
          {
            formationId: 'formation-1',
            canAttack: true,
            blockedReason: null,
          },
        ],
      },
      formations: [
        {
          id: 'formation-1',
          name: 'Vanguarda',
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
        warning:
          'Os esquadrões e comandantes em campanha só voltam à Defesa quando chegam ao feudo.',
        runs: 200,
        winsPercent: 75,
        gloriousPercent: 20,
        lossesPercent: 25,
        riskText: 'Risco moderado.',
        expectedLosses: [],
        knownEnemy: [],
      },
    };

    const markup = html(
      <WarCouncilPanel
        army={armyWithAssault}
        formationId="formation-1"
        disabled={false}
        busy={NONE}
        actions={actions}
      />,
    );
    expect(markup).toContain('data-testid="war-attack-camp"');
    expect(markup).toContain('<h3 id="war-council-title">Prévia fornecida pelo feudo</h3>');
    expect(text(markup)).toContain('Simular defesa do feudo');
    expect(text(markup)).toContain('Prévia de defesa do feudo');
    expect(text(markup)).toContain('O ataque ao Acampamento ainda não tem prévia.');
    expect(markup).toContain('data-testid="war-preview-warning"');
    expect(text(markup)).toContain(
      'Os esquadrões e comandantes em campanha só voltam à Defesa quando chegam ao feudo.',
    );
  });

  it('FormationEditor exibe aviso quando editor.warning está presente', () => {
    const armyWithWarning = {
      ...armyIdleView.army,
      editor: {
        ...armyIdleView.army.editor,
        warning:
          'Os esquadrões e comandantes em campanha só voltam à Defesa quando chegam ao feudo.',
      },
    };
    const markup = html(
      <FormationEditor
        army={armyWithWarning}
        draft={emptyDraft()}
        onChange={noop}
        disabled={false}
        busy={false}
        actions={actions}
      />,
    );
    expect(markup).toContain('data-testid="formation-editor-warning"');
    expect(text(markup)).toContain(
      'Os esquadrões e comandantes em campanha só voltam à Defesa quando chegam ao feudo.',
    );
  });
});
