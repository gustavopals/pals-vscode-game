import type { ViewState } from '@lotg/protocol';
import type { ComponentChild } from 'preact';
import { renderToString } from 'preact-render-to-string';
import { describe, expect, it } from 'vitest';

import { FiefTab } from '../tabs/Fief';
import { initialView, smithyForgingView, smithyIdleView } from '../test-helpers';
import type { Actions } from './actions';
import { SmithyPanel } from './SmithyPanel';

/**
 * O painel do Ferreiro (roadmap da v0.4, V4B-T4.3), desenhado com as visões do golden do motor. O
 * app só dispõe o que veio: o custo e o prazo de cada lote, o que o cancelamento devolve e o
 * rótulo do botão são da visão. O que depende de clique (as duas etapas, o teclado) é provado em
 * navegador, em `tests/e2e/11-ferreiro.spec.ts`.
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
    .replace(/\s+/g, ' ')
    .trim();

const panel = (view: ViewState, online = true, busy: ReadonlySet<string> = NONE, elapsed = 0) =>
  html(
    <SmithyPanel view={view} elapsed={elapsed} disabled={!online} busy={busy} actions={actions} />,
  );

describe('o painel do Ferreiro (V4B-T4.3)', () => {
  it('sem o Ferreiro: a frase do servidor e nenhuma forja', () => {
    const markup = panel(initialView);
    expect(text(markup)).toContain(initialView.smithy.text);
    expect(markup).not.toContain('forge-form');
    expect(markup).not.toContain('smithy-running');
  });

  it('a obra: o custo, o prazo, o que a impede (frase do servidor) e o botão, travado enquanto impedida', () => {
    const upgrade = initialView.constructions.available.find(
      (entry) => entry.building === initialView.smithy.building,
    );
    if (upgrade === undefined || upgrade.blockedReason === null) {
      throw new Error('O golden deixou de oferecer a obra do Ferreiro, trancada pelo Salão.');
    }
    const markup = panel(initialView);
    expect(text(markup)).toContain(`Construir ${upgrade.label}`);
    expect(text(markup)).toContain(upgrade.blockedReason);
    expect(markup).toMatch(/<button[^>]*disabled[^>]*>Construir Ferreiro/);
  });

  it('de pé e livre: a receita e o prazo da arma, a quantidade, o máximo e "Revisar a forja"', () => {
    const { smithy } = smithyIdleView;
    const markup = panel(smithyIdleView);
    const flat = text(markup);
    expect(flat).toContain(smithy.text);
    expect(flat).toContain(smithy.offer.costText);
    expect(flat).toContain(`Armas: ${smithy.weapons}`);
    expect(flat).toContain(`O máximo que o estoque paga (${smithy.offer.maxAmount})`);
    expect(flat).toContain('Digite quantas armas, de 1 a 10.');
    expect(markup).toContain('data-testid="forge-amount"');
    // Sem quantidade, "Revisar a forja" fica travado; "Confirmar" ainda nem existe.
    expect(markup).toMatch(/<button[^>]*data-testid="forge-review"[^>]*disabled/);
    expect(markup).not.toContain('forge-confirm-button');
  });

  it('com lote: "termina em…", o que o cancelamento devolve e o botão com o rótulo da visão', () => {
    const { forge } = smithyForgingView.smithy;
    if (forge === null) {
      throw new Error('O golden deixou de ter o lote na forja.');
    }
    const markup = panel(smithyForgingView);
    const flat = text(markup);
    expect(flat).toContain('Forjando 4');
    expect(flat).toMatch(/termina em \d/);
    expect(flat).toContain(forge.refundText);
    expect(flat).toContain(forge.cancelLabel);
    // Um lote por vez: a forma de forjar some enquanto há lote.
    expect(markup).not.toContain('forge-amount');
  });

  it('o prazo desce com o relógio da página', () => {
    const { forge } = smithyForgingView.smithy;
    const late = panel(smithyForgingView, true, NONE, (forge?.endsInSeconds ?? 0) + 5);
    expect(text(late)).toContain('termina agora');
  });

  it('sem ligação ou com a ordem a caminho, os botões ficam travados', () => {
    expect(panel(smithyForgingView, false)).toMatch(
      /<button[^>]*data-testid="smithy-cancel"[^>]*disabled/,
    );
    expect(panel(smithyForgingView, true, new Set(['forge']))).toMatch(
      /<button[^>]*data-testid="smithy-cancel"[^>]*disabled/,
    );
    expect(panel(smithyIdleView, false)).toContain('<fieldset disabled');
  });

  it('a aba Feudo traz o painel "Ferreiro"', () => {
    const page = html(
      <FiefTab
        view={smithyForgingView}
        elapsed={0}
        online
        retryInSeconds={null}
        chronicle={[]}
        busy={NONE}
        actions={actions}
      />,
    );
    expect(page).toContain('id="smithy-title"');
    expect(text(page)).toContain('Forjando 4');
  });
});
