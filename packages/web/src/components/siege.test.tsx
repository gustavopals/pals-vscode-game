import { ViewStateSchema } from '@lotg/protocol';
import { renderToString } from 'preact-render-to-string';
import { describe, expect, it } from 'vitest';

import { buildReturnReport, pendingItems } from '../game/returnReport';
import { initialView, siegeWaveView } from '../test-helpers';
import { cardDecisions, crossroadsDecisions, documentTitle, statusBar } from '../ui/format';
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
});
