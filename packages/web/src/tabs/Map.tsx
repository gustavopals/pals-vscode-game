import type { ViewState } from '@lotg/protocol';
import { useRef, useState } from 'preact/hooks';

import type { Actions } from '../components/actions';
import { OfflineBanner } from '../components/Banners';
import { Cost } from '../components/ConstructionsPanel';
import { Header } from '../components/Header';
import { HexMap } from '../components/HexMap';
import { Icon } from '../components/shared';
import { blockedReason, durationLine } from '../ui/expeditions';
import {
  activeThreatSites,
  defaultHexKey,
  FOG_LABELS,
  FOG_STATES,
  hexActions,
  hexFog,
  hexIcon,
  hexKey,
  hexTitle,
  isExploredHex,
  isHomeHex,
  isSightedHex,
  MAP_ICON,
  OUTPOST_STATUS_ICONS,
  OUTPOST_STATUS_LABELS,
  OUTPOST_STATUSES,
  outpostSheetLine,
  outpostsOf,
  TERRAIN_ICONS,
  visibleLegendTerrains,
  type ExploredMapHex,
  type MapAction,
  type MapHex,
} from '../ui/hexmap';

function OutpostRepairAction(props: {
  outpostId: string;
  blockedReason: string | null;
  disabled: boolean;
  busy: ReadonlySet<string>;
  actions: Actions;
}) {
  const blocked = props.blockedReason !== null && props.blockedReason !== '';
  const blockedId = `map-repair-blocked-${props.outpostId}`;
  return (
    <div class="map-action-item">
      <button
        type="button"
        data-map-action="repairOutpost"
        data-outpost-id={props.outpostId}
        disabled={props.disabled || blocked || props.busy.has(`repairOutpost:${props.outpostId}`)}
        aria-describedby={blocked ? blockedId : undefined}
        onClick={() => props.actions.run('lords.repairOutpost', props.outpostId)}
      >
        <Icon name="tools" /> Reparar posto
      </button>
      {blocked ? (
        <p class="blocked map-sheet-note" id={blockedId} data-testid="hex-outpost-repair-blocked">
          <Icon name="lock" /> {props.blockedReason}
        </p>
      ) : null}
    </div>
  );
}

function HexActionButton(props: {
  action: MapAction;
  hex: ExploredMapHex;
  view: ViewState;
  repairBlockedReason: string | null;
  disabled: boolean;
  busy: ReadonlySet<string>;
  actions: Actions;
}) {
  const { action, hex, view } = props;
  if (action.type === 'sendExpedition') {
    const offer = view.guild.available.find((entry) => entry.modelId === action.modelId);
    const label = offer?.label ?? hex.label;
    return (
      <div class="map-action-item">
        {offer === undefined ? null : (
          <p class="muted map-action-meta">
            Risco: {offer.riskText.toLowerCase()} · <span class="num">{durationLine(offer)}</span>
          </p>
        )}
        <button
          type="button"
          data-map-action={`sendExpedition:${action.modelId}`}
          disabled={props.disabled || props.busy.has(`send:${action.modelId}`)}
          onClick={() => props.actions.run('lords.sendExpedition', action.modelId)}
        >
          <Icon name="compass" /> Enviar expedição: {label}
        </button>
      </div>
    );
  }
  if (action.type === 'claimOutpost') {
    return (
      <div class="map-action-item">
        <button
          type="button"
          data-map-action="claimOutpost"
          data-outpost-hex={action.hex}
          disabled={props.disabled || props.busy.has(`claimOutpost:${action.hex}`)}
          onClick={() => props.actions.run('lords.claimOutpost', action.hex)}
        >
          <Icon name="flag" /> Reivindicar posto
        </button>
      </div>
    );
  }
  if (action.type === 'repairOutpost') {
    return (
      <OutpostRepairAction
        outpostId={action.outpostId}
        blockedReason={props.repairBlockedReason}
        disabled={props.disabled}
        busy={props.busy}
        actions={props.actions}
      />
    );
  }
  return (
    <div class="map-action-item">
      {view.army.campAssault.text === '' ? null : (
        <p class="muted map-action-meta">{view.army.campAssault.text}</p>
      )}
      <button
        type="button"
        data-map-action="attackCamp"
        disabled={props.disabled || props.busy.has('campaign')}
        onClick={() => props.actions.run('lords.attackCamp')}
      >
        <Icon name="target" /> Atacar o Acampamento
      </button>
    </div>
  );
}

/**
 * Ficha do hexágono selecionado ao lado do mapa (ou abaixo, em largura de celular).
 * Desconhecido mostra só a posição vazia; Avistado mostra o terreno; Explorado mostra nome,
 * detalhe e as ações entregues pela visão.
 */
export function HexSheet(props: {
  hex: MapHex;
  view: ViewState;
  elapsed?: number;
  activeThreats: ReadonlySet<string>;
  disabled: boolean;
  busy: ReadonlySet<string>;
  actions: Actions;
  titleRef: { current: HTMLHeadingElement | null };
}) {
  const { hex, view } = props;
  const elapsed = props.elapsed ?? 0;
  const fog = hexFog(hex);
  const icon = hexIcon(hex, props.activeThreats);

  const outpost = isExploredHex(hex) ? hex.outpost : undefined;
  const repairBlockedReason =
    outpost?.status === 'damaged' &&
    typeof outpost.repairBlockedReason === 'string' &&
    outpost.repairBlockedReason !== ''
      ? outpost.repairBlockedReason
      : null;
  const hasRepairAction =
    isExploredHex(hex) && hexActions(hex).some((action) => action.type === 'repairOutpost');
  const blockedRepairId =
    !hasRepairAction && repairBlockedReason !== null && outpost !== undefined ? outpost.id : null;

  let siteHint: string | null = null;
  if (
    isExploredHex(hex) &&
    hexActions(hex).length === 0 &&
    blockedRepairId === null &&
    hex.site !== null &&
    !isHomeHex(hex)
  ) {
    const offer = view.guild.available.find(
      (entry) => entry.modelId === hex.site || entry.label === hex.label,
    );
    if (offer !== undefined && !offer.canSend) {
      siteHint = blockedReason(offer);
    } else if (
      view.army.campaign !== null &&
      (view.army.campaign.tile === hex.site || view.army.campaign.destination === hex.label)
    ) {
      siteHint = view.army.campaign.text;
    } else if (view.army.campAssault.blockedReason !== null && hex.site === 'raiderCamp') {
      siteHint = view.army.campAssault.blockedReason;
    }
  }

  return (
    <aside class="map-sheet" aria-labelledby="hex-sheet-title" data-testid="hex-sheet">
      <div class="map-sheet-head">
        <h2 id="hex-sheet-title" ref={props.titleRef} tabIndex={-1}>
          {icon === null ? null : (
            <>
              <Icon name={icon} />{' '}
            </>
          )}
          {hexTitle(hex)}
        </h2>
        <div class="map-sheet-meta">
          <span class={`map-fog-badge map-fog-${fog}`}>{FOG_LABELS[fog]}</span>
          <span class="muted num" data-testid="hex-coords">
            ({hex.q}, {hex.r})
          </span>
        </div>
      </div>

      {!('fog' in hex) ? (
        <p class="muted map-sheet-note">
          Terras ainda encobertas pela névoa. Apenas a posição no mapa é conhecida.
        </p>
      ) : isSightedHex(hex) ? (
        <div class="map-sheet-body">
          <p class="map-terrain-line">
            <span class={`map-swatch hex-terrain-${hex.terrain}`} aria-hidden="true">
              <Icon name={TERRAIN_ICONS[hex.terrain]} />
            </span>
            <span>Terreno: {hex.terrainLabel}</span>
          </p>
          <p class="muted map-sheet-note">
            Avistado à distância. Explore a região para conhecer detalhes e ações.
          </p>
        </div>
      ) : (
        <div class="map-sheet-body">
          <p class="map-terrain-line">
            <span class={`map-swatch hex-terrain-${hex.terrain}`} aria-hidden="true">
              <Icon name={TERRAIN_ICONS[hex.terrain]} />
            </span>
            <span>Terreno: {hex.terrainLabel}</span>
          </p>
          {hex.detail !== '' && hex.detail !== hex.outpost?.detail ? (
            <p class="map-sheet-detail">{hex.detail}</p>
          ) : null}
          {isHomeHex(hex) ? (
            <p class="muted map-sheet-note">
              Sede do feudo · Salão Nv{view.settlement.townHallLevel}.
            </p>
          ) : null}
          {hex.outpost === undefined ? null : (
            <div
              class={`map-outpost-status map-outpost-${hex.outpost.status}`}
              data-testid="hex-outpost-status"
              data-outpost-status={hex.outpost.status}
            >
              <div class="map-outpost-status-head">
                <span class={`map-outpost-badge map-outpost-badge-${hex.outpost.status}`}>
                  <Icon name={OUTPOST_STATUS_ICONS[hex.outpost.status]} />{' '}
                  {OUTPOST_STATUS_LABELS[hex.outpost.status]}
                </span>
                <span class="num">{outpostSheetLine(hex.outpost, elapsed)}</span>
              </div>
              {hex.outpost.detail !== undefined && hex.outpost.detail !== '' ? (
                <p class="map-outpost-detail" data-testid="hex-outpost-detail">
                  {hex.outpost.detail}
                </p>
              ) : null}
              {hex.outpost.repairCost !== undefined && hex.outpost.repairCost.length > 0 ? (
                <div class="map-outpost-cost" data-testid="hex-outpost-repair-cost">
                  <span class="muted">Custo do reparo:</span> <Cost cost={hex.outpost.repairCost} />
                </div>
              ) : null}
            </div>
          )}
          {hexActions(hex).length > 0 || blockedRepairId !== null ? (
            <div class="map-sheet-actions" role="group" aria-label="Ações neste hexágono">
              {hexActions(hex).map((action) => (
                <HexActionButton
                  key={
                    action.type === 'sendExpedition'
                      ? `send:${action.modelId}`
                      : action.type === 'claimOutpost'
                        ? `claim:${action.hex}`
                        : action.type === 'repairOutpost'
                          ? `repair:${action.outpostId}`
                          : action.type
                  }
                  action={action}
                  hex={hex}
                  view={view}
                  repairBlockedReason={repairBlockedReason}
                  disabled={props.disabled}
                  busy={props.busy}
                  actions={props.actions}
                />
              ))}
              {blockedRepairId === null ? null : (
                <OutpostRepairAction
                  outpostId={blockedRepairId}
                  blockedReason={repairBlockedReason}
                  disabled={props.disabled}
                  busy={props.busy}
                  actions={props.actions}
                />
              )}
            </div>
          ) : siteHint !== null ? (
            <p class="blocked map-sheet-note">
              <Icon name="lock" /> {siteHint}
            </p>
          ) : !isHomeHex(hex) ? (
            <p class="muted map-sheet-note">Nenhuma ação disponível neste hexágono.</p>
          ) : null}
        </div>
      )}
    </aside>
  );
}

/** Legenda compacta da névoa, dos postos avançados e dos terrenos visíveis na grade atual. */
function MapLegend(props: { hexes: readonly MapHex[] }) {
  const terrains = visibleLegendTerrains(props.hexes);
  const hasOutposts = outpostsOf({ hexes: [...props.hexes] }).length > 0;
  return (
    <section class="map-legend" aria-label="Legenda do mapa">
      <div class="map-legend-group">
        <span class="map-legend-heading">Névoa</span>
        <ul class="map-legend-list">
          {FOG_STATES.map((fog) => (
            <li key={fog} class="map-legend-item">
              <span class={`map-fog-badge map-fog-${fog}`}>{FOG_LABELS[fog]}</span>
            </li>
          ))}
        </ul>
      </div>
      {!hasOutposts ? null : (
        <div class="map-legend-group">
          <span class="map-legend-heading">Postos avançados</span>
          <ul class="map-legend-list">
            {OUTPOST_STATUSES.map((status) => (
              <li key={status} class="map-legend-item">
                <span class={`map-outpost-badge map-outpost-badge-${status}`}>
                  <Icon name={OUTPOST_STATUS_ICONS[status]} /> {OUTPOST_STATUS_LABELS[status]}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {terrains.length === 0 ? null : (
        <div class="map-legend-group">
          <span class="map-legend-heading">Terrenos visíveis</span>
          <ul class="map-legend-list">
            {terrains.map((item) => (
              <li key={item.terrain} class="map-legend-item">
                <span class={`map-swatch hex-terrain-${item.terrain}`} aria-hidden="true">
                  <Icon name={item.icon} />
                </span>
                <span>{item.label}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

/**
 * Aba Mapa (`#/mapa`, V5E-T3): grade hexagonal em SVG com foco itinerante por setas, ficha do
 * hexágono ao lado (abaixo em telas estreitas) e legenda. Só exibe `ViewState.map`.
 */
export function MapTab(props: {
  view: ViewState;
  elapsed: number;
  online: boolean;
  retryInSeconds: number | null;
  busy: ReadonlySet<string>;
  actions: Actions;
}) {
  const { view, elapsed, actions } = props;
  const { map } = view;
  const disabled = !props.online;
  const [selectedKey, setSelectedKey] = useState<string | null>(() => defaultHexKey(map.hexes));
  const sheetTitleRef = useRef<HTMLHeadingElement>(null);

  const activeKey =
    selectedKey !== null && map.hexes.some((hex) => hexKey(hex.q, hex.r) === selectedKey)
      ? selectedKey
      : defaultHexKey(map.hexes);
  const selectedHex =
    activeKey === null ? undefined : map.hexes.find((hex) => hexKey(hex.q, hex.r) === activeKey);
  const threats = activeThreatSites(view);

  return (
    <div class="panel map-panel">
      <Header view={view} elapsed={elapsed} />
      <OfflineBanner
        online={props.online}
        retryInSeconds={props.retryInSeconds}
        actions={actions}
      />
      {props.online ? null : (
        <p class="council-stale">
          <Icon name="debug-disconnect" /> Sem ligação com o reino: o mapa mostra o último estado
          conhecido do feudo. Dá para ler; para enviar expedições ou atacar, é preciso a ligação.
        </p>
      )}
      <section class="map-section" aria-labelledby="map-heading">
        <div class="map-head">
          <h2 id="map-heading" tabIndex={-1}>
            <Icon name={MAP_ICON} /> Mapa do reino
          </h2>
          <p class="muted map-hint">
            Use as setas para percorrer os hexágonos e Enter para abrir a ficha.
          </p>
        </div>
        {map.hexes.length === 0 ? (
          <p class="muted">O mapa do feudo ainda não está disponível nesta visão.</p>
        ) : (
          <>
            <div class="map-layout">
              <HexMap
                map={map}
                selectedKey={activeKey}
                activeThreats={threats}
                onSelect={setSelectedKey}
                onActivate={(key) => {
                  setSelectedKey(key);
                  sheetTitleRef.current?.focus();
                }}
              />
              {selectedHex === undefined ? null : (
                <HexSheet
                  hex={selectedHex}
                  view={view}
                  elapsed={elapsed}
                  activeThreats={threats}
                  disabled={disabled}
                  busy={props.busy}
                  actions={actions}
                  titleRef={sheetTitleRef}
                />
              )}
            </div>
            <MapLegend hexes={map.hexes} />
          </>
        )}
      </section>
    </div>
  );
}
