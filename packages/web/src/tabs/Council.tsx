import type { ViewState } from '@lotg/protocol';

import type { Actions } from '../components/actions';
import { OfflineBanner } from '../components/Banners';
import { CouncilCard } from '../components/CouncilCard';
import { Header } from '../components/Header';
import { Icon } from '../components/shared';
import {
  type CouncilLog,
  councilRecord,
  councilRecordEmpty,
  nextAudience,
  pendingCards,
  stockLine,
} from '../ui/council';

/**
 * A aba do Conselho (GDD §7 e §13.1): as cartas à espera, uma embaixo da outra, cada uma com as
 * suas opções; quando vem a próxima audiência; a regra em uma frase; e o que o conselho já
 * registrou na Crônica, que é onde a resposta dada há um instante aparece contada.
 *
 * Cada estado tem a sua frase: sem cartas, com a mesa cheia (a frase é a do servidor: o conselho
 * espera uma resposta antes de trazer outra), sem ligação (modo leitura, pelo último estado
 * conhecido) e sem assunto para o feudo como ele está. O registro também: vazio, fora do trecho
 * da Crônica que foi lido e leitura que falhou (`councilRecordEmpty`). Recebe o `ViewState`
 * pronto e só o exibe.
 */
export function CouncilTab(props: {
  view: ViewState;
  elapsed: number;
  online: boolean;
  retryInSeconds: number | null;
  /** As cartas com resposta a caminho do servidor, pelo `instanceId`. */
  answering: ReadonlySet<string>;
  /** O que o conselho registrou na Crônica (`controller.councilLog`). */
  record: CouncilLog;
  actions: Actions;
}) {
  const { view, elapsed, actions } = props;
  const { council } = view;
  const count = council.pending.length;
  const record = councilRecord(props.record.lines);
  const empty = record.length === 0 ? councilRecordEmpty(props.record, props.online) : null;
  const openChronicle = (
    <button type="button" class="link" onClick={() => actions.run('lords.openChronicle')}>
      Abrir a Crônica inteira
    </button>
  );
  return (
    <div class="panel">
      <Header view={view} elapsed={elapsed} />
      <OfflineBanner
        online={props.online}
        retryInSeconds={props.retryInSeconds}
        actions={actions}
      />
      <div class="council">
        <section aria-labelledby="council-title">
          <h2 id="council-title">
            Conselho do Feudo{count === 0 ? '' : ` · ${pendingCards(count)}`}
          </h2>
          {props.online ? null : (
            <p class="council-stale">
              <Icon name="debug-disconnect" /> Sem ligação com o reino: as cartas e os prazos são os
              do último estado conhecido do feudo. Dá para ler; para responder, é preciso a ligação.
            </p>
          )}
          {count === 0 ? (
            <p class="council-empty">
              <Icon name="law" />{' '}
              {props.online
                ? 'O conselho não tem nada a tratar agora.'
                : 'No último estado conhecido, o conselho não tinha nada a tratar.'}
            </p>
          ) : (
            <>
              {/* O estoque ao lado dos custos: ninguém escolhe sem saber o que tem. */}
              <p class="muted hint">Em estoque: {stockLine(view)}.</p>
              {council.pending.map((card) => (
                <CouncilCard
                  key={card.instanceId}
                  card={card}
                  elapsed={elapsed}
                  readOnly={!props.online}
                  answering={props.answering.has(card.instanceId)}
                  actions={actions}
                />
              ))}
            </>
          )}
          {/* Não é região viva: o prazo muda a cada segundo. */}
          <p class="council-next">
            <Icon name="watch" /> {nextAudience(council, elapsed)}
          </p>
          <p class="muted hint">{council.rulesText}</p>
        </section>
        <section aria-labelledby="council-record-title">
          <h2 id="council-record-title">O que o conselho registrou</h2>
          {empty !== null ? (
            <>
              <p class="muted">{empty.text}</p>
              {empty.chronicle ? openChronicle : null}
            </>
          ) : (
            <>
              {/* A linha nova (a resposta que acabou de ser dada) é lida por leitores de tela. */}
              <ul class="chronicle" aria-live="polite">
                {record.map((event) => (
                  <li key={event.seq}>{event.text}</li>
                ))}
              </ul>
              {openChronicle}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
