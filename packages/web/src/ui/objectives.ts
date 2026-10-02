import type { GameEvent, ViewState } from '@lotg/protocol';

import { isNewBuilding } from './format';
import { buildingWork, workTerms } from './threat';

/**
 * Os Objetivos do Senhor como texto (GDD §12.2): o tutorial vivo. Cada objetivo chega pronto do
 * servidor, com a ação (`title`), o porquê (`hint`), a recompensa, o progresso, o que falta agora
 * (`missing`) e onde ele se cumpre (`target`). O app não conhece objetivo nenhum pelo id, a
 * ordem da sequência, quantos ficam ativos nem quantos ainda vêm: mostra o que veio e escolhe,
 * pelo `target`, o comando que leva o jogador até lá.
 */

type Objective = ViewState['objectives'][number];
type ObjectivesView = Pick<
  ViewState,
  'objectives' | 'workers' | 'constructions' | 'population' | 'pendingDecisions'
>;

/**
 * O painel "Objetivos" da aba Feudo, como destino: o argumento de `lords.openPanel` que leva a
 * página e o foco até ele (o "Ver" do aviso de um objetivo cumprido) e a âncora do título.
 */
export const OBJECTIVES_SECTION = 'objectives';
export const OBJECTIVES_ANCHOR = 'objectives-title';
/** O painel "Construções", para onde vai quem quer ver por que uma obra ainda não pode começar. */
export const CONSTRUCTIONS_SECTION = 'constructions';
export const CONSTRUCTIONS_ANCHOR = 'constructions-title';

/** O alvo de quem ainda tem o que cumprir; o visto, de quem cumpriu. O texto diz o resto. */
export const OBJECTIVE_ICON = 'target';
export const OBJECTIVE_DONE_ICON = 'pass';

/** Os objetivos em aberto, na ordem da sequência (o servidor nunca manda mais de três). */
export function activeObjectives(view: Pick<ViewState, 'objectives'>): Objective[] {
  return view.objectives.filter((objective) => objective.status === 'active');
}

/** Os objetivos já cumpridos, na ordem da sequência. */
export function completedObjectives(view: Pick<ViewState, 'objectives'>): Objective[] {
  return view.objectives.filter((objective) => objective.status === 'completed');
}

/**
 * "1/3" para o objetivo que se cumpre aos poucos; `null` para o que se cumpre de uma vez (erguer
 * um edifício, responder a uma carta): "0/1" não diz nada que o título já não diga.
 */
export function objectiveProgress(objective: Pick<Objective, 'progress'>): string | null {
  const { current, target } = objective.progress;
  return target > 1 ? `${current}/${target}` : null;
}

/** "3 em aberto · 4 cumpridos": o que a linha "Objetivos" da árvore diz com o grupo recolhido. */
export function objectivesSummary(view: Pick<ViewState, 'objectives'>): string {
  const open = activeObjectives(view).length;
  const done = completedObjectives(view).length;
  const parts = [
    ...(open > 0 ? [`${open} em aberto`] : []),
    ...(done > 0 ? [done === 1 ? '1 cumprido' : `${done} cumpridos`] : []),
  ];
  return parts.length === 0 ? 'nenhum por agora' : parts.join(' · ');
}

/**
 * O que dizer quando não há objetivo em aberto. A visão não conta quantos objetivos a sequência
 * tem, e uma lista sem ativos é um estado normal (o fim da sequência, ou a leitura em que os
 * seguintes ainda não foram revelados): a frase vale para os dois e não promete nada.
 */
export function noActiveObjectives(view: Pick<ViewState, 'objectives'>): string {
  return completedObjectives(view).length === 0
    ? 'Nenhum objetivo por agora.'
    : 'Nenhum objetivo em aberto agora: o que havia a cumprir está cumprido.';
}

/** O botão de um objetivo: o comando que leva a cumpri-lo. */
export type ObjectiveAction = {
  /** Um comando de `palette/commands.ts`. */
  command: string;
  arg?: string;
  /** O nome por extenso: "Construir Torre de Vigia", "Alocar na Fazenda". */
  label: string;
  /** A palavra do botão na árvore, onde a linha é estreita: "Construir", "Alocar". */
  text: string;
  /** O custo e o prazo da obra que o botão ordena, para ficarem à vista antes do clique. */
  terms?: string;
};

/**
 * O que o botão de um objetivo em aberto faz, pelo lugar onde ele se cumpre (`target`):
 *
 * - **trabalhadores:** abre a alocação no edifício pedido, com a prévia do que rende;
 * - **edifício:** ordena a obra, quando ela pode começar agora (o custo e o prazo vão junto, em
 *   `terms`); travada, leva ao painel das construções, onde estão o custo e o botão de planejar;
 *   em obras ou sem obra a ordenar, não há botão: é só esperar, e a frase do servidor diz isso;
 * - **recrutamento:** abre o recrutamento, a menos que os que já estão a caminho bastem;
 * - **conselho:** leva à mesa do conselho, para decidir a carta que espera ou ver quando vem a
 *   próxima;
 * - **planejadas:** liga o início automático de uma obra já planejada ou, sem nenhuma à espera
 *   de ordem, abre a lista para planejar;
 * - **estação:** nada a ordenar; atravessar a estação é esperar, e "Antes de partir" cuida da lenha.
 *
 * `null` para o objetivo cumprido e para aquele em que não há o que fazer agora.
 */
export function objectiveAction(
  view: ObjectivesView,
  objective: Objective,
): ObjectiveAction | null {
  if (objective.status !== 'active') {
    return null;
  }
  const { target } = objective;
  switch (target.kind) {
    case 'workers': {
      const row = view.workers.find((entry) => entry.building === target.building);
      return row === undefined
        ? { command: 'lords.allocateWorkers', label: 'Alocar trabalhadores', text: 'Alocar' }
        : {
            command: 'lords.allocateWorkers',
            arg: row.building,
            label: `Alocar na ${row.label}`,
            text: 'Alocar',
          };
    }
    case 'building': {
      const work = buildingWork(view.constructions, target.building);
      if (work.kind !== 'available') {
        return null;
      }
      const { upgrade } = work;
      if (upgrade.blockedReason !== null) {
        return {
          command: 'lords.openPanel',
          arg: CONSTRUCTIONS_SECTION,
          label: 'Ver as obras',
          text: 'Ver',
        };
      }
      const verb = isNewBuilding(upgrade) ? 'Construir' : 'Melhorar';
      return {
        command: 'lords.build',
        arg: upgrade.building,
        label: `${verb} ${upgrade.label}`,
        text: verb,
        terms: workTerms(upgrade),
      };
    }
    case 'recruitment': {
      // Quem já está a caminho e basta para cumprir: chamar mais gente não é o que falta.
      const short = objective.progress.target - objective.progress.current;
      return view.population.inTraining >= short
        ? null
        : { command: 'lords.recruit', label: 'Recrutar aldeões', text: 'Recrutar' };
    }
    case 'council':
      return view.pendingDecisions.length > 0
        ? {
            command: 'lords.openPanel',
            arg: 'council',
            label: 'Decidir no Conselho',
            text: 'Decidir',
          }
        : { command: 'lords.openPanel', arg: 'council', label: 'Ver o Conselho', text: 'Ver' };
    case 'planned':
      return view.constructions.planned.some((plan) => !plan.autoStart)
        ? {
            command: 'lords.toggleAutoStart',
            label: 'Ligar o início automático',
            text: 'Marcar',
          }
        : { command: 'lords.planConstruction', label: 'Planejar obras', text: 'Planejar' };
    case 'season':
      return null;
  }
}

/** O botão só navega: continua valendo sem ligação, quando nenhuma ordem pode ser enviada. */
export function navigatesOnly(action: Pick<ObjectiveAction, 'command'>): boolean {
  return action.command === 'lords.openPanel';
}

/** O que a tela diz logo abaixo de um objetivo em aberto: o que falta, ou que nada falta. */
export type ObjectiveNote = {
  /** Só falta a ordem do jogador: a linha convida, em vez de explicar um impedimento. */
  ready: boolean;
  text: string;
};

/**
 * O que falta agora, na frase do servidor. Quando ela não vem, só falta uma ordem que o jogador
 * já pode dar: a linha diz isso e, se a ordem é uma obra, o custo e o prazo dela, para o preço
 * ficar ao lado da recompensa antes do clique.
 */
export function objectiveNote(view: ObjectivesView, objective: Objective): ObjectiveNote | null {
  if (objective.status !== 'active') {
    return null;
  }
  if (objective.missing !== null) {
    return { ready: false, text: objective.missing };
  }
  const terms = objectiveAction(view, objective)?.terms;
  return {
    ready: true,
    text: terms === undefined ? 'Só falta a sua ordem.' : `Pode começar agora: ${terms}.`,
  };
}

/**
 * A explicação de um objetivo na árvore, uma frase por linha: o porquê, a recompensa e o que
 * falta agora (ou que só falta a ordem, com o custo da obra).
 */
export function objectiveLines(view: ObjectivesView, objective: Objective): string[] {
  const note = objectiveNote(view, objective);
  return [
    objective.hint,
    `Recompensa: ${objective.reward}.`,
    ...(note === null ? [] : [note.text]),
  ];
}

/** O que a linha de um objetivo diz depois do título na árvore: "1/3 · +40 comida". */
export function objectiveTreeLine(objective: Objective): string {
  const progress = objectiveProgress(objective);
  return progress === null ? objective.reward : `${progress} · ${objective.reward}`;
}

/** O evento conta um objetivo cumprido. */
export function isObjectiveCompleted(event: Pick<GameEvent, 'type'>): boolean {
  return event.type === 'objectiveCompleted';
}

/**
 * Vários objetivos cumpridos de uma vez, ditos de uma vez (roadmap da v0.2, V2E-T4.4): o que o
 * feudo já tinha feito conta no instante em que o objetivo aparece, e concluir um revela o
 * seguinte, que pode já estar cumprido. Em vez de uma linha (ou de um aviso) por objetivo, sai o
 * título, "3 objetivos cumpridos", e uma frase para cada um, com a recompensa como a visão a
 * diz: "Construa a Torre de Vigia: +40 pedra". O objetivo é achado na visão pelo identificador
 * que o evento traz; o que a visão não tiver fica com a frase da Crônica, inteira. As frases
 * saem sem o ponto final: quem as mostra decide se são itens de uma lista ou uma frase só.
 *
 * `null` com um evento só, ou nenhum: aí vale a frase da Crônica, sem resumo.
 */
export function objectivesCompleted(
  events: readonly GameEvent[],
  view: Pick<ViewState, 'objectives'> | null,
): { title: string; lines: string[] } | null {
  const completed = events.filter(isObjectiveCompleted);
  if (completed.length < 2) {
    return null;
  }
  return {
    title: `${completed.length} objetivos cumpridos`,
    lines: completed.map((event) => {
      const objective = view?.objectives.find((entry) => entry.id === event.data.objective);
      return objective === undefined
        ? event.text.replace(/\.$/, '')
        : `${objective.title}: ${objective.reward}`;
    }),
  };
}

/** O resumo em uma frase só, para onde não cabe uma lista: o título e cada objetivo, com ponto. */
export function objectivesCompletedSentence(summary: { title: string; lines: string[] }): string {
  return [summary.title, ...summary.lines].map((line) => `${line}.`).join(' ');
}
