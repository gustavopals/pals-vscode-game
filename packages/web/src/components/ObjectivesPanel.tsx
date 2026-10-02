import type { ViewState } from '@lotg/protocol';

import {
  activeObjectives,
  completedObjectives,
  navigatesOnly,
  noActiveObjectives,
  OBJECTIVES_ANCHOR,
  OBJECTIVES_SECTION,
  objectiveAction,
  objectiveNote,
  objectiveProgress,
} from '../ui/objectives';
import type { Actions } from './actions';
import { Icon } from './shared';

/**
 * Os Objetivos do Senhor (GDD §12.2): o tutorial vivo. Primeiro os que estão em aberto (o
 * servidor nunca manda mais de três), cada um com a ação, o porquê, a recompensa, o que falta
 * agora e o botão que leva até lá; depois os cumpridos, recolhidos. Tudo vem pronto na visão: o
 * app não conhece objetivo nenhum pelo id nem sabe quantos ainda vêm.
 *
 * O custo fica ao lado do prêmio: quando o botão ordena uma obra, a linha de baixo diz o custo
 * e o prazo dela antes do clique. O botão é descrito pelo objetivo inteiro, para quem usa leitor
 * de tela: pode haver dois "Ver as obras" na mesma lista. Sem ligação, os botões que dão ordens
 * ficam desabilitados, como no resto do feudo; os que só navegam continuam.
 *
 * Na aba Hoje (`brief`) a lista é só a do que há a cumprir: os cumpridos viram uma contagem, com
 * o caminho para a lista inteira, que fica na aba Feudo.
 */
export function ObjectivesPanel(props: {
  view: ViewState;
  online: boolean;
  actions: Actions;
  brief?: boolean;
}) {
  const { view, online, actions } = props;
  const active = activeObjectives(view);
  const done = completedObjectives(view);
  return (
    <section aria-labelledby={OBJECTIVES_ANCHOR}>
      <h2 id={OBJECTIVES_ANCHOR} tabIndex={-1}>
        Objetivos
      </h2>
      {active.length === 0 ? (
        <p class="muted">{noActiveObjectives(view)}</p>
      ) : (
        <ul class="objectives">
          {active.map((objective) => {
            const action = objectiveAction(view, objective);
            const note = objectiveNote(view, objective);
            const progress = objectiveProgress(objective);
            const line = `objective-${objective.id}`;
            return (
              <li key={objective.id} class="objective">
                <div class="objective-text" id={line}>
                  <p>
                    <span aria-hidden="true">☐ </span>
                    <span class="sr-only">Em aberto: </span>
                    <strong>{objective.title}</strong>
                    {progress === null ? null : <span class="muted"> ({progress})</span>}
                  </p>
                  <p class="objective-why">
                    {objective.hint} Recompensa: {objective.reward}.
                  </p>
                  {note === null ? null : (
                    // O que falta leva o relógio de quem espera; o que só espera a ordem, a seta.
                    <p class={note.ready ? 'objective-note objective-ready' : 'objective-note'}>
                      <Icon name={note.ready ? 'arrow-right' : 'watch'} /> {note.text}
                    </p>
                  )}
                </div>
                {action === null ? null : (
                  <button
                    type="button"
                    class="secondary"
                    aria-describedby={line}
                    disabled={!online && !navigatesOnly(action)}
                    onClick={() => actions.run(action.command, action.arg)}
                  >
                    {action.label}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {done.length === 0 ? null : props.brief ? (
        <p class="muted hint objectives-count">
          {done.length === 1 ? '1 já cumprido.' : `${done.length} já cumpridos.`}{' '}
          <button
            type="button"
            class="link"
            onClick={() => actions.run('lords.openPanel', OBJECTIVES_SECTION)}
          >
            Ver todos
          </button>
        </p>
      ) : (
        <details class="objectives-done">
          <summary>Cumpridos ({done.length})</summary>
          <ul>
            {done.map((objective) => (
              <li key={objective.id}>
                <p>
                  <span aria-hidden="true">☑ </span>
                  <span class="sr-only">Cumprido: </span>
                  {objective.title}
                </p>
                <p class="objective-why">
                  {objective.hint} Recompensa: {objective.reward}.
                </p>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
