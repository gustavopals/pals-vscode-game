import type { ViewState } from '@lotg/protocol';
import { useLayoutEffect, useRef, useState } from 'preact/hooks';

import type { Actions } from '../components/actions';
import { OfflineBanner } from '../components/Banners';
import { BattleReports } from '../components/BattleReport';
import { BarracksPanel } from '../components/BarracksPanel';
import { FormationEditor } from '../components/FormationEditor';
import { FormationList } from '../components/FormationList';
import { Header } from '../components/Header';
import { WarCouncilPanel } from '../components/WarCouncilPanel';
import { OmensPanel } from '../components/OmensPanel';
import { Icon } from '../components/shared';
import { SiegePanel } from '../components/SiegePanel';
import { type Draft, draftOf, emptyDraft } from '../ui/formation';

/**
 * As formações: a lista e o editor dividem o rascunho, que é estado da tela. Salvar uma formação
 * nova faz o editor adotar a salva (a última da lista) assim que a visão a traz, para um segundo
 * "Salvar" não criar outra.
 */
function Formations(props: {
  view: ViewState;
  disabled: boolean;
  busy: ReadonlySet<string>;
  actions: Actions;
}) {
  const { army } = props.view;
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const savedCount = useRef<number | null>(null);
  const savingNew = props.busy.has('formation:new');
  const wasSaving = useRef(false);
  useLayoutEffect(() => {
    // O salvamento de um rascunho novo terminou sem formação nova (recusado, falha de rede):
    // esquece a contagem, para uma formação criada depois em outra aba não ser adotada.
    if (wasSaving.current && !savingNew && savedCount.current !== null) {
      if (army.formations.length <= savedCount.current) {
        savedCount.current = null;
      }
    }
    wasSaving.current = savingNew;
    // Uma formação nova apareceu na lista depois de "Salvar" de um rascunho novo: adota-a.
    if (savedCount.current !== null && army.formations.length > savedCount.current) {
      const latest = army.formations[army.formations.length - 1];
      savedCount.current = null;
      if (latest !== undefined && draft.id === null) {
        setDraft({ ...draft, id: latest.id });
      }
    }
  }, [army.formations, draft, savingNew]);
  const actions: Actions = {
    ...props.actions,
    run: (id, arg) => {
      if (id === 'lords.saveFormation' && draft.id === null) {
        savedCount.current = army.formations.length;
      }
      props.actions.run(id, arg);
    },
  };
  return (
    <div class="formations-layout">
      <FormationList
        army={army}
        editingId={draft.id}
        disabled={props.disabled}
        busy={props.busy}
        actions={props.actions}
        onEdit={(id) => {
          const saved = army.formations.find((entry) => entry.id === id);
          setDraft(saved === undefined ? emptyDraft() : draftOf(saved));
        }}
      />
      <div class="formation-main">
        <FormationEditor
          army={army}
          draft={draft}
          onChange={setDraft}
          disabled={props.disabled}
          busy={props.busy.has(`formation:${draft.id ?? 'new'}`)}
          actions={actions}
        />
        <WarCouncilPanel
          army={army}
          formationId={draft.id}
          disabled={props.disabled}
          busy={props.busy}
          actions={props.actions}
        />
        <BattleReports
          reports={army.reports}
          onAdjust={(id) => {
            const saved = army.formations.find((entry) => entry.id === id);
            if (saved !== undefined) {
              setDraft(draftOf(saved));
            }
          }}
        />
      </div>
    </div>
  );
}

/**
 * A aba Exército (GDD §10.2): o Quartel, os soldados e o treino. Sem o Quartel, a obra e a frase
 * do servidor que diz para que ele serve. Recebe o `ViewState` pronto e só o exibe. Sem ligação
 * fica em modo leitura: os soldados e os prazos são os do último estado conhecido, e nenhuma
 * ordem é enviada. As formações (lista e editor) ficam ao lado.
 */
export function ArmyTab(props: {
  view: ViewState;
  elapsed: number;
  online: boolean;
  retryInSeconds: number | null;
  /** As ordens a caminho do servidor (`controller.guildOrders`). */
  busy: ReadonlySet<string>;
  actions: Actions;
}) {
  const { view, elapsed, actions } = props;
  const disabled = !props.online;
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
          <Icon name="debug-disconnect" /> Sem ligação com o reino: os soldados e o treino são os do
          último estado conhecido do feudo. Dá para ler; para treinar, cancelar ou dispensar, é
          preciso a ligação.
        </p>
      )}
      <SiegePanel
        view={view}
        elapsed={elapsed}
        disabled={disabled}
        busy={props.busy}
        actions={actions}
      />
      <div class="fief army">
        <div class="column">
          <BarracksPanel
            view={view}
            elapsed={elapsed}
            disabled={disabled}
            busy={props.busy}
            actions={actions}
          />
        </div>
      </div>
      {view.army.built ? (
        <div class="army-formations">
          <OmensPanel army={view.army} />
          <Formations view={view} disabled={disabled} busy={props.busy} actions={actions} />
        </div>
      ) : null}
    </div>
  );
}
