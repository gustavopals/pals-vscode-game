import type { ViewState } from '@lotg/protocol';

import type { Actions } from '../components/actions';
import { ArsenalPanel } from '../components/ArsenalPanel';
import { OfflineBanner } from '../components/Banners';
import { ExpeditionsPanel, ReportsPanel } from '../components/ExpeditionsPanel';
import { Header } from '../components/Header';
import { HeroesPanel } from '../components/HeroesPanel';
import { Icon } from '../components/shared';
import { TavernPanel } from '../components/TavernPanel';

/**
 * A aba Guilda (GDD §13.1): de um lado, as expedições (as equipes fora do feudo, com a
 * encruzilhada que espera resposta no alto, e os destinos, cada um com o envio recolhido) e os
 * relatórios das que voltaram; do outro, a equipe com o soldo e o equipamento, o arsenal e a
 * Taverna. O que é longo fica recolhido em uma linha (a montagem do envio, o percurso, cada
 * relatório, o equipamento de cada herói): a aba se lê de uma vez e abre onde o jogador quer.
 * Recebe o `ViewState` pronto e só o exibe. Sem ligação fica em modo leitura: tudo é o do
 * último estado conhecido, e nenhuma ordem é enviada nem guardada.
 */
export function GuildTab(props: {
  view: ViewState;
  elapsed: number;
  online: boolean;
  retryInSeconds: number | null;
  /** As ordens da Guilda a caminho do servidor (`controller.guildOrders`). */
  busy: ReadonlySet<string>;
  /** O relatório que o jogador pediu para ver (`controller.reportInFocus`); `null` sem pedido. */
  focusedReport?: string | null;
  actions: Actions;
}) {
  const { view, elapsed, actions } = props;
  const disabled = !props.online;
  const expeditions = (
    <>
      <ExpeditionsPanel
        view={view}
        elapsed={elapsed}
        disabled={disabled}
        busy={props.busy}
        actions={actions}
      />
      <ReportsPanel view={view} focused={props.focusedReport ?? null} />
    </>
  );
  const team = (
    <>
      <HeroesPanel
        view={view}
        elapsed={elapsed}
        disabled={disabled}
        busy={props.busy}
        actions={actions}
      />
      <ArsenalPanel view={view} disabled={disabled} actions={actions} />
      <TavernPanel
        view={view}
        elapsed={elapsed}
        disabled={disabled}
        busy={props.busy}
        actions={actions}
      />
    </>
  );
  return (
    <div class="panel">
      <Header view={view} elapsed={elapsed} />
      <OfflineBanner
        online={props.online}
        retryInSeconds={props.retryInSeconds}
        actions={actions}
      />
      {props.online ? null : (
        <p class="council-stale">
          <Icon name="debug-disconnect" /> Sem ligação com o reino: a equipe, as expedições, os
          candidatos e os prazos são os do último estado conhecido do feudo. Dá para ler; para
          enviar, escolher um caminho, equipar, contratar, dispensar ou dar um festival, é preciso a
          ligação.
        </p>
      )}
      {/*
        Com a Guilda dos Aventureiros de pé, as expedições vêm primeiro (em tela estreita, no
        alto): é onde a encruzilhada espera. Antes dela, a equipe vem primeiro, com a frase que
        diz como o primeiro herói chega.
      */}
      <div class="fief guild">
        {view.guild.built ? (
          <>
            <div class="column">{expeditions}</div>
            <div class="column">{team}</div>
          </>
        ) : (
          <>
            <div class="column">{team}</div>
            <div class="column">{expeditions}</div>
          </>
        )}
      </div>
    </div>
  );
}
