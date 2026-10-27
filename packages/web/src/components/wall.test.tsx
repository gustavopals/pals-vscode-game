import type { ViewState } from '@lotg/protocol';
import type { ComponentChild } from 'preact';
import { renderToString } from 'preact-render-to-string';
import { describe, expect, it } from 'vitest';

import { armyIdleView, palisadeRaisedView, threatIncomingView } from '../test-helpers';
import type { Actions } from './actions';
import { OmensPanel } from './OmensPanel';
import { ThreatPanel } from './ThreatPanel';
import { WallPanel, wallSignature } from './WallPanel';

/**
 * A muralha no painel da Ameaça e os presságios na aba Exército (V4E-T4). As frases, os custos e
 * os prazos são os da visão; o app só os dispõe. A conferência de duas etapas depende de estado
 * da tela e é provada em navegador (`tests/e2e/08-ameaca.spec.ts`).
 */
const actions: Actions = { order: () => {}, run: () => {}, playNow: () => {} };
const html = (node: ComponentChild) => renderToString(<>{node}</>);
const panel = (view: ViewState) =>
  html(<ThreatPanel view={view} elapsed={0} disabled={false} actions={actions} />);

type Defense = ViewState['threat']['defense'];
const withDefense = (
  view: ViewState,
  patch: { wall?: Partial<Defense['wall']>; tower?: Partial<Defense['tower']> },
): ViewState => ({
  ...view,
  threat: {
    ...view.threat,
    defense: {
      ...view.threat.defense,
      wall: { ...view.threat.defense.wall, ...patch.wall },
      tower: { ...view.threat.defense.tower, ...patch.tower },
    },
  },
});

describe('a muralha', () => {
  it('sem Paliçada não há caixa da muralha', () => {
    expect(panel(threatIncomingView)).not.toContain('wall-panel');
  });

  it('mostra o nível, a vida de cada ala e o botão que abre a conferência', () => {
    const markup = panel(palisadeRaisedView);
    const { wall } = palisadeRaisedView.threat.defense;
    expect(markup).toContain('wall-panel');
    expect(markup).toContain(wall.levelLabel);
    for (const text of Object.values(wall.hpText)) {
      expect(markup).toContain(text);
    }
    expect(markup).toContain(wall.repairOffer.text);
    expect(markup).toContain('Reparar a muralha…');
    // A ordem não nasce antes da conferência: o botão de confirmar não existe ainda.
    expect(markup).not.toContain('Confirmar o reparo');
  });

  it('sem recurso, o botão não aparece e o motivo vem escrito', () => {
    const view = withDefense(palisadeRaisedView, {
      wall: {
        repairOffer: {
          ...palisadeRaisedView.threat.defense.wall.repairOffer,
          canRepair: false,
          blockedText: 'Faltam 10 de pedra.',
        },
      },
    });
    const markup = panel(view);
    expect(markup).toContain('Faltam 10 de pedra.');
    expect(markup).not.toContain('Reparar a muralha…');
  });

  it('com o reparo em curso, a contagem toma o lugar do botão', () => {
    const view = withDefense(palisadeRaisedView, {
      wall: {
        repairOffer: {
          ...palisadeRaisedView.threat.defense.wall.repairOffer,
          canRepair: false,
          repairingInSeconds: 600,
          blockedText: 'Os pedreiros já estão na muralha.',
        },
      },
    });
    const markup = panel(view);
    expect(markup).toContain('wall-repairing');
    expect(markup).not.toContain('Reparar a muralha…');
  });

  it('invalida a conferência se canRepair cai (com mesmo custo ou custo alterado)', () => {
    const initialOffer = palisadeRaisedView.threat.defense.wall.repairOffer;
    const reviewed = wallSignature(initialOffer);

    // 1. Mesmo custo, mas faltou recurso durante a conferência: fecha a revisão, sem Confirmar.
    const sameCostBlocked = withDefense(palisadeRaisedView, {
      wall: {
        repairOffer: {
          ...initialOffer,
          canRepair: false,
          blockedText: 'Faltam 10 de pedra.',
        },
      },
    });
    const markupSame = html(
      <WallPanel
        defense={sameCostBlocked.threat.defense}
        elapsed={0}
        disabled={false}
        reviewed={reviewed}
        actions={actions}
      />,
    );
    expect(markupSame).toContain('wall-blocked');
    expect(markupSame).not.toContain('wall-review');
    expect(markupSame).not.toContain('wall-confirm');

    // 2. Custo mudou e também faltou estoque: não prende wall-changed nem botão desabilitado na tela.
    const changedCostBlocked = withDefense(palisadeRaisedView, {
      wall: {
        repairOffer: {
          ...initialOffer,
          stone: initialOffer.stone + 20,
          canRepair: false,
          blockedText: 'Faltam 30 de pedra.',
        },
      },
    });
    const markupChanged = html(
      <WallPanel
        defense={changedCostBlocked.threat.defense}
        elapsed={0}
        disabled={false}
        reviewed={reviewed}
        actions={actions}
      />,
    );
    expect(markupChanged).toContain('wall-blocked');
    expect(markupChanged).not.toContain('wall-changed');
    expect(markupChanged).not.toContain('wall-review-open');
  });

  it('a Torre que dispara e a composição que os vigias leem vêm da visão', () => {
    const view = withDefense(palisadeRaisedView, {
      tower: { damageText: 'A Torre Nv3 dispara a cada rodada.' },
    });
    expect(panel(view)).toContain('A Torre Nv3 dispara a cada rodada.');
    const { threat } = palisadeRaisedView;
    if (!threat.known || threat.incoming === null) {
      throw new Error('o golden perdeu a incursão à vista');
    }
    const withComposition: ViewState = {
      ...palisadeRaisedView,
      threat: {
        ...threat,
        incoming: { ...threat.incoming, compositionText: 'Os vigias contam uns doze lobos.' },
      },
    };
    expect(panel(withComposition)).toContain('Os vigias contam uns doze lobos.');
  });
});

describe('os presságios', () => {
  it('sem presságio, a lista não existe', () => {
    expect(html(<OmensPanel army={{ ...armyIdleView.army, omens: [] }} />)).toBe('');
  });

  it('lista a frase de cada presságio, com a onda quando ela é conhecida', () => {
    const markup = html(
      <OmensPanel
        army={{ ...armyIdleView.army, omens: [{ text: 'A terra treme ao anoitecer.', wave: 2 }] }}
      />,
    );
    expect(markup).toContain('A terra treme ao anoitecer.');
    expect(markup).toContain('Onda 2');
  });

  it('tolera o presságio vago, com a onda nula', () => {
    const vague = [
      { text: 'Algo se move na mata.', wave: null },
    ] as unknown as ViewState['army']['omens'];
    const markup = html(<OmensPanel army={{ ...armyIdleView.army, omens: vague }} />);
    expect(markup).toContain('Algo se move na mata.');
    expect(markup).not.toContain('Onda');
  });
});
