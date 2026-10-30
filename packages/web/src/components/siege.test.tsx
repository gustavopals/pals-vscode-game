import { ViewStateSchema } from '@lotg/protocol';
import { renderToString } from 'preact-render-to-string';
import { describe, expect, it } from 'vitest';

import { buildReturnReport, pendingItems } from '../game/returnReport';
import { initialView, siegeWaveView } from '../test-helpers';
import { cardDecisions, crossroadsDecisions, documentTitle, statusBar } from '../ui/format';
import { buildTree } from '../ui/treeModel';
import { Today } from './Today';

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

describe('compatibilidade mínima do Cerco com o protocolo 4', () => {
  it('lê siegeWave e mostra título, prazo e formação pública na aba Hoje', () => {
    expect(ViewStateSchema.parse(siegeWaveView)).toEqual(siegeWaveView);
    for (const online of [true, false]) {
      const html = renderToString(
        <Today report={null} view={siegeWaveView} elapsed={60} actions={actions} online={online} />,
      );
      expect(html).toContain('Decisões pendentes (1)');
      expect(html).toContain('Cerco: “Entre ondas”');
      expect(html).toContain('expira em 59 min');
      expect(html).toContain('Defesa ativa');
      expect(html).toContain('aria-label="Exército: Entre ondas"');
      expect(html).toContain('>Exército</button>');
      expect(html).not.toContain('Conselho: “Entre ondas”');
      expect(html).not.toContain('Escolher caminho');
      expect(html).not.toContain('aria-label="Decidir: Entre ondas"');
    }
  });

  it('conta a onda na barra e no título e leva à aba Hoje', () => {
    expect(statusBar(input)).toMatchObject({
      text: '$(shield) 1 decisão pendente · expira em 59 min',
      target: 'today',
    });
    expect(statusBar(input).tooltip).toContain('A decisão entre ondas está na aba Hoje.');
    expect(statusBar(input).tooltip).not.toContain('encruzilhada');
    expect(documentTitle(input)).toBe('(1) Pedra Alta · Lords of the Guild');
    expect(cardDecisions(siegeWaveView)).toEqual([]);
    expect(crossroadsDecisions(siegeWaveView)).toEqual([]);
  });

  it('mostra a expiração iminente da onda na barra sob frio ou fome', () => {
    const coldSiege: typeof siegeWaveView = {
      ...siegeWaveView,
      winter: { cold: { text: 'Frio extremo no feudo.' } } as unknown as typeof siegeWaveView.winter,
    };
    const bar = statusBar({
      ...input,
      view: coldSiege,
      elapsedSeconds: 300,
    });
    expect(bar.text).toMatch(/^\$\(flame\) Frio em .* · \$\(shield\) onda 2: 55 min$/);
    expect(bar.alarm).toBe(true);
    expect(bar.target).toBe('today');
    expect(bar.tooltip).toContain('Frio extremo no feudo.');
    expect(bar.tooltip).toContain('"Entre ondas"');
    expect(bar.tooltip).toContain('A decisão entre ondas está na aba Hoje.');
  });

  it('mantém a onda entre as decisões do Relatório de Retorno', () => {
    expect(pendingItems(siegeWaveView, 60)).toContainEqual({
      topic: 'siegeWave:siege-1-2',
      text: 'Cerco: “Entre ondas” · expira em 59 min.',
      severity: 'warning',
      action: { command: 'lords.openPanel', arg: 'army', label: 'Exército' },
    });
  });

  it('também desenha a decisão quando a volta abre o relatório em Hoje', () => {
    const report = buildReturnReport(initialView, siegeWaveView, [], 5 * 3_600_000);
    const html = renderToString(
      <Today report={report} view={siegeWaveView} actions={actions} elapsed={60} />,
    );
    expect(html).toContain('Cerco: “Entre ondas”');
    expect(html).toContain('expira em 59 min');
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
    expect(multiTree.find((node) => node.id === 'today')?.description).toBe('● 2 decisões pendentes');
  });
});
