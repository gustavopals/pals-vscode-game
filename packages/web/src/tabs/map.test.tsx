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

  it('exibe estado do posto avançado, crista no SVG e botões Reivindicar posto / Reparar posto (V5F-T3)', () => {
    const calls: Array<[string, unknown]> = [];
    const recording: Actions = {
      ...actions,
      run: (id, arg) => calls.push([id, arg]),
    };

    const claimableHex: MapHex = {
      q: -3,
      r: 0,
      fog: 'explored',
      terrain: 'ironVein',
      terrainLabel: 'Veio de Ferro',
      site: 'abandonedMine',
      label: 'Mina Abandonada',
      detail: 'Veios de ferro afloram na rocha.',
      actions: [{ type: 'claimOutpost', hex: '-3,0' }],
    };
    const buildingHex: MapHex = {
      ...claimableHex,
      outpost: { id: 'outpost-1', status: 'building', readyInSeconds: 1800 },
      actions: [],
    };
    const activeHex: MapHex = {
      ...claimableHex,
      q: 1,
      r: 0,
      fog: 'claimed',
      terrain: 'fields',
      terrainLabel: 'Campos',
      site: 'patrol',
      label: 'Patrulha nos Arredores',
      outpost: { id: 'outpost-2', status: 'active', readyInSeconds: 0 },
      actions: [],
    };
    const damagedDetail =
      'Posto avançado danificado: a produção está parada até o reparo (125 madeira e 75 pedra).';
    const damagedHex: MapHex = {
      ...claimableHex,
      q: -2,
      r: 1,
      fog: 'claimed',
      terrain: 'forest',
      terrainLabel: 'Floresta',
      site: 'oldForest',
      label: 'Floresta Antiga',
      detail: damagedDetail,
      outpost: {
        id: 'outpost-3',
        status: 'damaged',
        readyInSeconds: null,
        detail: damagedDetail,
        repairCost: [
          { resource: 'wood', label: 'Madeira', amount: 125, missing: 0 },
          { resource: 'stone', label: 'Pedra', amount: 75, missing: 0 },
        ],
        repairBlockedReason: null,
      },
      actions: [{ type: 'repairOutpost', outpostId: 'outpost-3' }],
    };

    // 1. Hexágono elegível para reivindicar posto avançado.
    const claimMarkup = html(
      <MapTab
        view={withHexes(goldenView, [claimableHex])}
        elapsed={0}
        online={true}
        retryInSeconds={null}
        busy={new Set()}
        actions={recording}
      />,
    );
    expect(claimMarkup).not.toMatch(/\sstyle=/i);
    expect(claimMarkup).toContain('data-map-action="claimOutpost"');
    expect(claimMarkup).toContain('Reivindicar posto');
    expect(claimMarkup).not.toContain('data-testid="hex-outpost-status"');

    // 2. Grade com postos em obra, ativo e danificado: cristas no SVG e selos na legenda.
    const outpostsMarkup = html(
      <MapTab
        view={withHexes(goldenView, [buildingHex, activeHex, damagedHex])}
        elapsed={300}
        online={true}
        retryInSeconds={null}
        busy={new Set()}
        actions={recording}
      />,
    );
    expect(outpostsMarkup).not.toMatch(/\sstyle=/i);
    expect(outpostsMarkup).toContain('data-outpost="building"');
    expect(outpostsMarkup).toContain('data-outpost="active"');
    expect(outpostsMarkup).toContain('data-outpost="damaged"');
    expect(outpostsMarkup).toContain('hex-outpost-crest-building');
    expect(outpostsMarkup).toContain('hex-outpost-crest-active');
    expect(outpostsMarkup).toContain('hex-outpost-crest-damaged');
    expect(outpostsMarkup).toContain('Posto avançado: em obra · conclui em 00:25');
    expect(outpostsMarkup).toContain('Postos avançados');

    // 3. Ficha do posto ativo e do posto danificado com ação de reparo.
    const activeSheetMarkup = html(
      <HexSheet
        hex={activeHex}
        view={goldenView}
        elapsed={0}
        activeThreats={new Set()}
        disabled={false}
        busy={new Set()}
        actions={recording}
        titleRef={{ current: null }}
      />,
    );
    expect(activeSheetMarkup).toContain('Posto avançado: ativo');
    expect(activeSheetMarkup).not.toContain('data-map-action=');

    const damagedSheetMarkup = html(
      <HexSheet
        hex={damagedHex}
        view={goldenView}
        elapsed={0}
        activeThreats={new Set()}
        disabled={false}
        busy={new Set()}
        actions={recording}
        titleRef={{ current: null }}
      />,
    );
    expect(damagedSheetMarkup).toContain('Posto avançado: danificado');
    expect(damagedSheetMarkup).toContain('data-testid="hex-outpost-detail"');
    expect(damagedSheetMarkup).toContain(damagedDetail);
    // Sem duplicar a mesma frase de detalhe na ficha quando hex.detail e outpost.detail coincidem.
    expect(damagedSheetMarkup.split(damagedDetail)).toHaveLength(2);
    expect(damagedSheetMarkup).toContain('data-testid="hex-outpost-repair-cost"');
    expect(damagedSheetMarkup).toContain('125 madeira');
    expect(damagedSheetMarkup).toContain('75 pedra');
    expect(damagedSheetMarkup).not.toContain('chip-missing');
    expect(damagedSheetMarkup).not.toContain('data-testid="hex-outpost-repair-blocked"');
    expect(damagedSheetMarkup).toContain('data-map-action="repairOutpost"');
    expect(damagedSheetMarkup).toContain('Reparar posto');

    // 3b. Posto danificado bloqueado por falta de recursos: chips com o que falta, botão desabilitado e motivo.
    const blockedReason = 'Falta madeira para isso: precisa de 125, há 80.';
    const blockedDamagedHex: MapHex = {
      ...damagedHex,
      outpost: {
        ...damagedHex.outpost!,
        repairCost: [
          { resource: 'wood', label: 'Madeira', amount: 125, missing: 45 },
          { resource: 'stone', label: 'Pedra', amount: 75, missing: 0 },
        ],
        repairBlockedReason: blockedReason,
      },
      actions: [],
    };
    const blockedSheetMarkup = html(
      <HexSheet
        hex={blockedDamagedHex}
        view={goldenView}
        elapsed={0}
        activeThreats={new Set()}
        disabled={false}
        busy={new Set()}
        actions={recording}
        titleRef={{ current: null }}
      />,
    );
    expect(blockedSheetMarkup).not.toMatch(/\sstyle=/i);
    expect(blockedSheetMarkup).toContain('data-testid="hex-outpost-detail"');
    expect(blockedSheetMarkup).toContain('chip chip-missing');
    expect(blockedSheetMarkup).toContain('125 madeira (faltam 45)');
    expect(blockedSheetMarkup).toContain('75 pedra');
    expect(blockedSheetMarkup).toContain('data-testid="hex-outpost-repair-blocked"');
    expect(blockedSheetMarkup).toContain(blockedReason);
    expect(blockedSheetMarkup).toMatch(
      /<button[^>]*data-map-action="repairOutpost"[^>]*disabled[^>]*aria-describedby="map-repair-blocked-outpost-3"/,
    );
    expect(blockedSheetMarkup).not.toContain('Nenhuma ação disponível neste hexágono.');

    // 4. Clique nos botões de Reivindicar e Reparar dispara os comandos da paleta.
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

    clickButtons(
      HexSheet({
        hex: claimableHex,
        view: goldenView,
        elapsed: 0,
        activeThreats: new Set(),
        disabled: false,
        busy: new Set(),
        actions: recording,
        titleRef: { current: null },
      }),
    );
    clickButtons(
      HexSheet({
        hex: damagedHex,
        view: goldenView,
        elapsed: 0,
        activeThreats: new Set(),
        disabled: false,
        busy: new Set(),
        actions: recording,
        titleRef: { current: null },
      }),
    );
    expect(calls).toEqual([
      ['lords.claimOutpost', '-3,0'],
      ['lords.repairOutpost', 'outpost-3'],
    ]);

    // 5. Trava de ordem em voo desabilita o botão correspondente.
    const busyClaimMarkup = html(
      <HexSheet
        hex={claimableHex}
        view={goldenView}
        elapsed={0}
        activeThreats={new Set()}
        disabled={false}
        busy={new Set(['claimOutpost:-3,0'])}
        actions={recording}
        titleRef={{ current: null }}
      />,
    );
    expect(busyClaimMarkup).toMatch(/<button[^>]*data-map-action="claimOutpost"[^>]*disabled/);

    const busyRepairMarkup = html(
      <HexSheet
        hex={damagedHex}
        view={goldenView}
        elapsed={0}
        activeThreats={new Set()}
        disabled={false}
        busy={new Set(['repairOutpost:outpost-3'])}
        actions={recording}
        titleRef={{ current: null }}
      />,
    );
    expect(busyRepairMarkup).toMatch(/<button[^>]*data-map-action="repairOutpost"[^>]*disabled/);
  });
});
