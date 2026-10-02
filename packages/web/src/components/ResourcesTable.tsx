import type { ViewState } from '@lotg/protocol';

import {
  capExplanation,
  fillsSoon,
  formatCost,
  isNewBuilding,
  isWasting,
  runsOutIn,
  runsOutWhy,
  storageNotice,
} from '../ui/format';
import type { Actions } from './actions';
import { formatApprox, formatDuration, formatNumber, formatSigned } from './format';
import { Explained, Icon } from './shared';

type Row = ViewState['resources'][number];
type Upgrade = ViewState['constructions']['available'][number];

/**
 * Para onde o estoque vai, por extenso: a cor só reforça o que o texto já diz. O que acaba passa
 * na frente do que enche; o depósito cheio, ou a menos de uma ausência de encher, leva o sinal
 * de alerta ao lado do texto.
 */
function Trend(props: { view: ViewState; row: Row }) {
  const { view, row } = props;
  const runsOut = runsOutIn(view, row);
  if (runsOut !== null) {
    // Quando o prazo é do outro lado da virada de estação, a conta do servidor o explica: a
    // taxa da linha, a de agora, pode até ser positiva.
    const why = runsOutWhy(view, row);
    const deadline = `acaba em ${formatApprox(runsOut)}`;
    return (
      <span class="warning">
        {why === null ? deadline : <Explained why={why}>{deadline}</Explained>}
      </span>
    );
  }
  if (isWasting(row)) {
    return (
      <span class="warning">
        <Icon name="warning" /> cheio: a produção está se perdendo
      </span>
    );
  }
  if (row.full) {
    // No limite sem nada a entrar, ou acima dele (partida que veio de antes dos limites): a
    // frase do servidor, quando há, diz por que nada entra.
    return (
      <span class="muted">
        {row.fullNote === null ? 'cheio' : <Explained why={row.fullNote}>cheio</Explained>}
      </span>
    );
  }
  if (row.fullInSeconds !== null) {
    return fillsSoon(row) ? (
      <span class="warning">
        <Icon name="warning" /> cheio em {formatApprox(row.fullInSeconds)}
      </span>
    ) : (
      <span class="muted">cheio em {formatApprox(row.fullInSeconds)}</span>
    );
  }
  if (row.perHour > 0) {
    // Subindo sem previsão de encher: a taxa muda antes, e o servidor diz o quê.
    return (
      <span class="muted">
        {row.fullNote === null ? 'crescendo' : <Explained why={row.fullNote}>crescendo</Explained>}
      </span>
    );
  }
  if (row.perHour < 0) {
    // Caindo sem prazo para acabar: ou já acabou (fome, frio), ou a queda para antes do fim
    // (a lareira apaga quando a estação vira).
    return row.stock === 0 ? (
      <span class="warning">em falta</span>
    ) : (
      <span class="muted">caindo</span>
    );
  }
  return <span class="muted">estável</span>;
}

/**
 * Os depósitos que pedem atenção, logo abaixo da tabela, cada um com a saída ao lado: o botão
 * que ergue ou amplia o Celeiro ou o Armazém, com o custo, o prazo e o que a obra muda. Um
 * limite sem a ação à vista seria só punição (GDD §15.1). A madeira e a pedra dividem o
 * Armazém: as duas frases ficam no mesmo aviso, com um botão só.
 */
function StorageNotes(props: { view: ViewState; disabled: boolean; actions: Actions }) {
  const { view, disabled, actions } = props;
  const groups = new Map<string, { lines: string[]; upgrade: Upgrade | null }>();
  for (const row of view.resources) {
    const line = storageNotice(row);
    if (line === null || row.storageBuilding === null) {
      continue;
    }
    const group = groups.get(row.storageBuilding) ?? {
      lines: [],
      upgrade:
        view.constructions.available.find((entry) => entry.building === row.storageBuilding) ??
        null,
    };
    group.lines.push(line);
    groups.set(row.storageBuilding, group);
  }
  if (groups.size === 0) {
    return null;
  }
  return (
    <ul class="storage-notes">
      {[...groups].map(([building, { lines, upgrade }]) => {
        const verb = upgrade !== null && isNewBuilding(upgrade) ? 'Construir' : 'Ampliar';
        // A frase do servidor às vezes já diz o que trava a obra (o Salão): não se repete.
        const reason =
          upgrade?.blockedReason != null &&
          !lines.some((line) => line.includes(upgrade.blockedReason ?? ''))
            ? upgrade.blockedReason
            : null;
        return (
          <li key={building} class="banner banner-warning storage-note">
            <div>
              {lines.map((line) => (
                <p key={line}>
                  <Icon name="warning" /> {line}
                </p>
              ))}
              {upgrade !== null ? (
                <p class="muted storage-terms">
                  {formatCost(upgrade.cost)} · {formatDuration(upgrade.durationSeconds)}
                  {upgrade.effect !== null ? ` · ${upgrade.effect}` : ''}
                  {reason !== null ? ` ${reason}` : ''}
                </p>
              ) : null}
            </div>
            {upgrade !== null ? (
              <button
                type="button"
                disabled={disabled || upgrade.blockedReason !== null}
                onClick={() => actions.run('lords.build', upgrade.building)}
              >
                {verb} {upgrade.label}
              </button>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

export function ResourcesTable(props: { view: ViewState; disabled: boolean; actions: Actions }) {
  const { view } = props;
  return (
    <section aria-labelledby="resources-title">
      <h2 id="resources-title">Recursos</h2>
      {/* Leitores de tela anunciam as mudanças sem interromper o que estão lendo. */}
      <table class="resources" aria-live="polite">
        <thead>
          <tr>
            <th scope="col">Recurso</th>
            <th scope="col" class="num">
              Estoque
            </th>
            <th scope="col" class="num">
              Cap
            </th>
            <th scope="col" class="num">
              Por hora
            </th>
            <th scope="col">Tendência</th>
          </tr>
        </thead>
        <tbody>
          {view.resources.map((row) => {
            const why = capExplanation(row);
            return (
              <tr key={row.id}>
                <th scope="row">{row.label}</th>
                <td class="num">{formatNumber(row.stock)}</td>
                <td class="num">
                  {row.cap === null ? (
                    '—'
                  ) : why === null ? (
                    formatNumber(row.cap)
                  ) : (
                    <Explained why={why}>{formatNumber(row.cap)}</Explained>
                  )}
                </td>
                <td class={`num ${row.perHour < 0 ? 'negative' : ''}`}>
                  <Explained why={row.breakdown}>{formatSigned(row.perHour)}</Explained>
                </td>
                <td>
                  <Trend view={view} row={row} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <StorageNotes view={view} disabled={props.disabled} actions={props.actions} />
    </section>
  );
}
