import type { ViewState } from '@lotg/protocol';
import type { ComponentChild } from 'preact';
import { renderToString } from 'preact-render-to-string';
import { describe, expect, it } from 'vitest';

import type { Actions } from '../components/actions';
import { HexMap } from '../components/HexMap';
import { goldenView, heroInjuredView } from '../test-helpers';
import type { MapHex } from '../ui/hexmap';
import { HexSheet, MapTab } from './Map';

const noop = () => {};
const actions: Actions = { order: noop, run: noop, playNow: noop };
const html = (node: ComponentChild) => renderToString(<>{node}</>);

const tags = (markup: string, pattern: RegExp): string[] => markup.match(pattern) ?? [];
const attribute = (tag: string, name: string) =>
  new RegExp(`\\s${name}="([^"]*)"`).exec(tag)?.[1] ?? null;

function withHexes(base: ViewState, hexes: MapHex[]): ViewState {
  return { ...base, map: { radius: base.map.radius, hexes } };
}

describe('aba Mapa (V5E-T3)', () => {
  it('desenha os 91 hexágonos do golden em SVG sem atributo style e com foco único (roving tabindex)', () => {
    const markup = html(
      <MapTab
        view={goldenView}
        elapsed={0}
        online={true}
        retryInSeconds={null}
        busy={new Set()}
        actions={actions}
      />,
    );
    // CSP: nenhum style embutido em lugar nenhum do SVG ou da aba.
    expect(markup).not.toMatch(/\sstyle=/i);
    expect(markup).toContain('<svg ');
    expect(markup).toContain('aria-label="Mapa hexagonal do reino"');

    const cells = tags(markup, /<g[^>]*data-hex="[^"]*"[^>]*>/g);
    expect(cells).toHaveLength(91);
    const focusable = cells.filter((tag) => attribute(tag, 'tabindex') === '0');
    expect(focusable).toHaveLength(1);
    expect(attribute(focusable[0] ?? '', 'data-hex')).toBe('0,0');
    expect(cells.filter((tag) => attribute(tag, 'tabindex') === '-1')).toHaveLength(90);

    // A sede (0,0) começa selecionada na ficha ao lado, com ícone Codicon e detalhes da visão.
    expect(markup).toContain('id="hex-sheet-title"');
    expect(markup).toContain('Pedra Alta');
    expect(markup).toContain('codicon-home');
    expect(markup).toContain('A planície se abre entre os caminhos do feudo.');
    expect(markup).toContain('Explorado');
    expect(markup).toContain('Legenda do mapa');
  });

  it('respeita a névoa: Desconhecido mostra casa vazia, Avistado só terreno, Explorado nome/detalhe/ações', () => {
    const unknownHex: MapHex = { q: 4, r: -4 };
    const sightedHex: MapHex = {
      q: 1,
      r: -1,
      fog: 'sighted',
      terrain: 'forest',
      terrainLabel: 'Floresta',
    };
    const exploredHex: MapHex = {
      q: 1,
      r: 0,
      fog: 'explored',
      terrain: 'fields',
      terrainLabel: 'Campos',
      site: 'patrol',
      label: 'Patrulha nos Arredores',
      detail: 'A planície se abre entre os caminhos do feudo.',
      actions: [{ type: 'sendExpedition', modelId: 'patrol' }],
    };
    const claimedHex: MapHex = {
      q: -3,
      r: 0,
      fog: 'claimed',
      terrain: 'ironVein',
      terrainLabel: 'Veio de Ferro',
      site: null,
      label: 'Veio de Ferro',
      detail: 'O ferro aflora entre as rochas.',
      actions: [],
    };

    // Desconhecido como único hexágono: só a casa vazia, sem ícone nem terreno.
    const unknownMarkup = html(
      <MapTab
        view={withHexes(goldenView, [unknownHex])}
        elapsed={0}
        online={true}
        retryInSeconds={null}
        busy={new Set()}
        actions={actions}
      />,
    );
    expect(unknownMarkup).toContain('Território desconhecido');
    expect(unknownMarkup).toContain('hex-fog-unknown');
    expect(unknownMarkup).not.toContain('hex-icon-box');
    expect(unknownMarkup).not.toContain('Terreno:');
    expect(unknownMarkup).not.toContain('Terrenos visíveis');

    // Avistado: mostra o terreno e o ícone dele, sem detalhe nem ação.
    const sightedMarkup = html(
      <MapTab
        view={withHexes(goldenView, [sightedHex])}
        elapsed={0}
        online={true}
        retryInSeconds={null}
        busy={new Set()}
        actions={actions}
      />,
    );
    expect(sightedMarkup).toContain('Floresta');
    expect(sightedMarkup).toContain('Avistado');
    expect(sightedMarkup).toContain('hex-terrain-forest');
    expect(sightedMarkup).toContain('hex-fog-sighted');
    expect(sightedMarkup).not.toContain('data-map-action=');

    // Explorado com ação de expedição: nome, detalhe, ponto de ação e botão.
    const exploredMarkup = html(
      <MapTab
        view={withHexes(heroInjuredView, [exploredHex])}
        elapsed={0}
        online={true}
        retryInSeconds={null}
        busy={new Set()}
        actions={actions}
      />,
    );
    expect(exploredMarkup).toContain('Patrulha nos Arredores');
    expect(exploredMarkup).toContain('A planície se abre entre os caminhos do feudo.');
    expect(exploredMarkup).toContain('data-map-action="sendExpedition:patrol"');
    expect(exploredMarkup).toContain('hex-action-dot');

    // Reivindicado: selo próprio e ícone de bandeira.
    const claimedMarkup = html(
      <MapTab
        view={withHexes(goldenView, [claimedHex])}
        elapsed={0}
        online={true}
        retryInSeconds={null}
        busy={new Set()}
        actions={actions}
      />,
    );
    expect(claimedMarkup).toContain('Reivindicado');
    expect(claimedMarkup).toContain('hex-fog-claimed');
    expect(claimedMarkup).toContain('codicon-flag');
  });

  it('aciona lords.sendExpedition e lords.attackCamp a partir das ações da visão', () => {
    const calls: Array<[string, unknown]> = [];
    const recording: Actions = {
      ...actions,
      run: (id, arg) => calls.push([id, arg]),
    };

    const actionHex: MapHex = {
      q: 3,
      r: -4,
      fog: 'explored',
      terrain: 'hills',
      terrainLabel: 'Colinas',
      site: 'raiderCamp',
      label: 'Acampamento de Saqueadores',
      detail: 'Elevações de pedra se erguem sobre os campos.',
      actions: [{ type: 'sendExpedition', modelId: 'patrol' }, { type: 'attackCamp' }],
    };

    type VNodeLike = { type?: unknown; props?: Record<string, unknown> };
    const clickButtons = (node: unknown): void => {
      if (Array.isArray(node)) {
        node.forEach(clickButtons);
        return;
      }
      if (typeof node !== 'object' || node === null) {
        return;
      }
      const { type, props } = node as VNodeLike;
      if (typeof type === 'function') {
        clickButtons((type as (props: unknown) => unknown)(props));
        return;
      }
      if (type === 'button' && typeof props?.onClick === 'function') {
        (props.onClick as () => void)();
      }
      clickButtons(props?.children);
    };

    // Verifica que ambos os botões são desenhados e disparam exatamente os comandos existentes.
    const markup = html(
      <MapTab
        view={withHexes(heroInjuredView, [actionHex])}
        elapsed={0}
        online={true}
        retryInSeconds={null}
        busy={new Set()}
        actions={recording}
      />,
    );
    expect(markup).toContain('data-map-action="sendExpedition:patrol"');
    expect(markup).toContain('Enviar expedição: Patrulha dos Arredores');
    expect(markup).toContain('data-map-action="attackCamp"');
    expect(markup).toContain('Atacar o Acampamento');

    clickButtons(
      HexSheet({
        hex: actionHex,
        view: heroInjuredView,
        activeThreats: new Set(),
        disabled: false,
        busy: new Set(),
        actions: recording,
        titleRef: { current: null },
      }),
    );
    expect(calls).toEqual([
      ['lords.sendExpedition', 'patrol'],
      ['lords.attackCamp', undefined],
    ]);

    // Sem ligação, desabilita os botões de ação e mostra o aviso de modo leitura.
    const offlineMarkup = html(
      <MapTab
        view={withHexes(heroInjuredView, [actionHex])}
        elapsed={0}
        online={false}
        retryInSeconds={12}
        busy={new Set()}
        actions={recording}
      />,
    );
    expect(offlineMarkup).toContain('Sem ligação com o reino');
    const actionButtons = tags(offlineMarkup, /<button[^>]*data-map-action="[^"]*"[^>]*>/g);
    expect(actionButtons).toHaveLength(2);
    for (const button of actionButtons) {
      expect(button).toMatch(/\sdisabled(=|\s|>)/);
    }

    // Trava de ordem em voo desabilita apenas a ação correspondente.
    const busyMarkup = html(
      <MapTab
        view={withHexes(heroInjuredView, [actionHex])}
        elapsed={0}
        online={true}
        retryInSeconds={null}
        busy={new Set(['send:patrol'])}
        actions={recording}
      />,
    );
    const sendButton =
      tags(busyMarkup, /<button[^>]*data-map-action="sendExpedition:patrol"[^>]*>/g)[0] ?? '';
    const campButton = tags(busyMarkup, /<button[^>]*data-map-action="attackCamp"[^>]*>/g)[0] ?? '';
    expect(sendButton).toMatch(/\sdisabled(=|\s|>)/);
    expect(campButton).not.toMatch(/\sdisabled(=|\s|>)/);
  });

  it('trata grade vazia sem quebrar', () => {
    const markup = html(
      <MapTab
        view={withHexes(goldenView, [])}
        elapsed={0}
        online={true}
        retryInSeconds={null}
        busy={new Set()}
        actions={actions}
      />,
    );
    expect(markup).toContain('O mapa do feudo ainda não está disponível nesta visão.');
    expect(markup).not.toContain('<svg');
  });

  it('HexMap seleciona o hexágono pedido e desenha o anel de seleção por cima', () => {
    const markup = html(
      <HexMap map={goldenView.map} selectedKey="1,0" onSelect={noop} onActivate={noop} />,
    );
    expect(markup).not.toMatch(/\sstyle=/i);
    const selected = tags(markup, /<g[^>]*data-hex="1,0"[^>]*>/g)[0] ?? '';
    expect(attribute(selected, 'tabindex')).toBe('0');
    expect(attribute(selected, 'aria-pressed')).toBe('true');
    expect(markup).toContain('class="hex-selection-layer"');
    expect(markup).toContain('class="hex-selected-ring"');
  });
});
