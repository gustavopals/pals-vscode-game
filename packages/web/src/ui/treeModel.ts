import type { GameEvent, ViewState } from '@lotg/protocol';

import type { AccountState } from '../account/accountService';
import { beforeLeaving } from '../game/beforeLeaving';
import type { Connection } from '../game/connection';
import {
  COUNCIL_ICON,
  councilSummary,
  deadlineAlert,
  nextAudience,
  pendingDecisionsLabel,
} from './council';
import {
  busyQueues,
  capExplanation,
  capitalize,
  fillsSoon,
  firewoodRunsOutIn,
  formatApprox,
  formatCost,
  formatDuration,
  formatNumber,
  formatRate,
  formatRemaining,
  isNewBuilding,
  isWasting,
  planWaiting,
  refundSentence,
  remainingNow,
  runsOutIn,
  runsOutWhy,
  storageAlert,
  truncate,
  upgradeName,
} from './format';
import { moraleIcon, moraleLines, moraleTreeLine } from './morale';
import {
  activeObjectives,
  completedObjectives,
  noActiveObjectives,
  OBJECTIVE_DONE_ICON,
  OBJECTIVE_ICON,
  objectiveAction,
  objectiveLines,
  objectivesSummary,
  objectiveTreeLine,
} from './objectives';
import { threatIcon, threatLines, threatRowWork, threatTreeLine, workTerms } from './threat';
import { employed, experienceSummary, injuredCount, nextWorkerGain } from './workers';

/** Um item da árvore lateral, como dado: `workbench/Tree.tsx` só o desenha. */
export type TreeNode = {
  id: string;
  label: string;
  description?: string;
  tooltip?: string;
  /** Nome de um codicon. */
  icon?: string;
  contextValue?: string;
  command?: { id: string; args?: unknown[] };
  /**
   * O que o botão de uma ordem da linha custa ou rende, por id do comando: acompanha o nome do
   * botão na dica dele, para o custo estar à vista antes do clique.
   */
  actionHints?: Record<string, string>;
  /**
   * O nome do botão de uma ordem, por id do comando, quando ele não sai do rótulo da linha: o
   * botão da linha "Ameaça" ergue a Torre de Vigia, e é isso que ele diz.
   */
  actionLabels?: Record<string, string>;
  /**
   * O botão da linha, quando a ordem não sai do tipo dela (`contextValue`): cada objetivo leva o
   * comando que o cumpre, com o argumento, o nome por extenso e a palavra curta do botão.
   */
  action?: { command: string; arg?: string; label: string; text: string };
  children?: TreeNode[];
  expanded?: boolean;
};

export type TreeInput = {
  view: ViewState | null;
  account: AccountState;
  connection: Connection;
  /** Últimas linhas da Crônica, da mais antiga para a mais nova. */
  chronicle: GameEvent[];
  /** Novidades ainda não vistas (Relatório de Retorno e notificações que viraram badge). */
  unseen: number;
  elapsedSeconds: number;
  /** O servidor tem o vínculo GitHub ligado. Sem isto, "Vincular ao GitHub" não aparece. */
  githubAvailable?: boolean;
};

const DESCRIPTION_MAX = 60;

type ResourceRow = ViewState['resources'][number];

/** "655/1.000" para o que tem limite, "318" para o ouro. */
const stockOverCap = (row: ResourceRow) =>
  row.cap === null
    ? formatNumber(row.stock)
    : `${formatNumber(row.stock)}/${formatNumber(row.cap)}`;

/**
 * O que a linha de um recurso diz depois do nome (GDD §13.2). Em regra, o estoque sobre o limite
 * e a taxa: "412/1.600 (+29/h)". Com o depósito cheio e perdendo produção, ou a menos de uma
 * ausência de encher, o alerta toma o lugar da taxa, para caber na barra lateral: "655/1.000 ⚠
 * cheio em 6 h". A previsão distante fica na tabela do painel; a árvore só fala do que é urgente.
 */
function resourceLine(view: ViewState, row: ResourceRow): string {
  if (isWasting(row) || fillsSoon(row)) {
    return `${stockOverCap(row)} ${storageAlert(row) ?? ''}`;
  }
  const runsOut = runsOutIn(view, row);
  return (
    `${stockOverCap(row)} (${formatRate(row.perHour)})` +
    (runsOut === null ? '' : ` · acaba em ${formatApprox(runsOut)}`) +
    (row.full ? ' · cheio' : '')
  );
}

/**
 * Os recursos. O depósito que pede atenção repete o alerta na linha "Recursos", que assim
 * continua dizendo o que importa com o grupo recolhido: "madeira ⚠ cheio em 4 h".
 */
function resourcesNode(view: ViewState): TreeNode {
  const alerts = view.resources
    .filter((row) => isWasting(row) || fillsSoon(row))
    .map((row) => `${row.label.toLowerCase()} ${storageAlert(row) ?? ''}`);
  return {
    id: 'resources',
    label: 'Recursos',
    ...(alerts.length > 0 ? { description: alerts.join(' · ') } : {}),
    icon: 'package',
    expanded: true,
    children: view.resources.map((row) => ({
      id: `resource:${row.id}`,
      label: row.label,
      description: resourceLine(view, row),
      // A conta da taxa, de onde vem o limite e, se houver, o que o servidor diz do depósito e
      // do prazo que só vence depois da virada de estação.
      tooltip: [row.breakdown, capExplanation(row), row.fullNote, runsOutWhy(view, row)]
        .filter((line) => line !== null)
        .join('\n'),
      command: { id: 'lords.openPanel', args: ['fief'] },
    })),
  };
}

/**
 * A moral (GDD §5.7): o número e a faixa, com o ícone da faixa, e para onde a próxima virada do
 * dia a leva. A explicação é a do servidor: o que ela faz agora, a conta da virada, o conselho e
 * o que as viradas fazem com o povo.
 */
function moraleNode(view: ViewState, elapsedSeconds: number): TreeNode {
  const { morale } = view;
  return {
    id: 'morale',
    label: 'Moral',
    description: moraleTreeLine(morale),
    tooltip: [...moraleLines(morale, elapsedSeconds), ...morale.notes].join('\n'),
    icon: moraleIcon(morale.band),
    command: { id: 'lords.openPanel', args: ['fief'] },
  };
}

/**
 * A Ameaça (GDD §8.2 e §13.2): "46 · Covil de Lobos" para quem tem a Torre de Vigia; sem ela,
 * "desconhecida", porque o número nem chega do servidor. A explicação é a do painel, frase a
 * frase. O clique só navega, e o foco fica na árvore, como nas outras linhas: quem anda por ela
 * com as setas não é levado embora. Quando uma das duas obras da Ameaça pode começar agora, a
 * linha ganha o botão que a ordena, com o custo na dica: sem a Torre, a Torre (a saída da névoa
 * fica ao lado dela); com ela, a Paliçada, que é o que muda o desfecho do próximo ataque.
 */
function threatNode(view: ViewState, elapsedSeconds: number): TreeNode {
  const { threat } = view;
  const work = threatRowWork(view);
  return {
    id: 'threat',
    label: 'Ameaça',
    description: threatTreeLine(view, elapsedSeconds),
    tooltip: threatLines(view, elapsedSeconds).join('\n'),
    icon: threatIcon(threat),
    ...(work === null
      ? {}
      : {
          contextValue: isNewBuilding(work) ? 'lords.threatBuild' : 'lords.threatUpgrade',
          // "Construir: Paliçada" para o que ainda não existe; "Melhorar: Paliçada Nv1 → Nv2".
          actionLabels: {
            'lords.build': isNewBuilding(work)
              ? upgradeName(work)
              : `Melhorar: ${upgradeName(work)}`,
          },
          actionHints: { 'lords.build': workTerms(work) },
        }),
    command: { id: 'lords.openPanel', args: ['fief'] },
  };
}

/**
 * A lareira, só no inverno: quanto queima por hora e em quanto tempo a lenha acaba; no frio, há
 * quanto tempo ele dura. A explicação é a conta da lenha (ou a do frio), como veio do servidor.
 */
function hearthNode(view: ViewState): TreeNode[] {
  const { winter } = view;
  if (winter === null) {
    return [];
  }
  const wood = view.resources.find((row) => row.id === 'wood')?.label.toLowerCase() ?? 'lenha';
  const runsOut = firewoodRunsOutIn(view);
  return [
    {
      id: 'hearth',
      label: 'Lareira',
      description:
        winter.cold !== null
          ? `sem lenha · frio há ${formatApprox(winter.cold.secondsElapsed)}`
          : `${formatNumber(winter.firewoodPerHour)}/h de ${wood}` +
            (runsOut === null ? '' : ` · acaba em ${formatApprox(runsOut)}`),
      tooltip: winter.cold?.text ?? winter.firewood.text,
      icon: 'flame',
      command: { id: 'lords.openPanel', args: ['fief'] },
    },
  ];
}

/**
 * Os trabalhadores (GDD §5.3 e §5.4). Cada edifício diz quantos trabalham e quanto rendem, quem
 * ainda se adapta e, se o ofício está se perdendo, isso também. A explicação traz a conta da
 * taxa, a experiência com o seu porquê e o que um trabalhador a mais rende: o custo da troca fica
 * à vista antes do "+", que o repete na própria dica.
 */
function workersNode(view: ViewState): TreeNode {
  const { villagers, free, injured, injuredNote } = view.population;
  const rules = view.workersRules;
  return {
    id: 'workers',
    label: 'Trabalhadores',
    // Os feridos de uma incursão não trabalham nem estão livres: têm a sua parcela, por extenso.
    description:
      `${employed(view.population)}/${villagers} alocados · ${free} ${free === 1 ? 'livre' : 'livres'}` +
      (injured > 0 ? ` · ${injuredCount(injured)}` : ''),
    tooltip: [
      ...(injuredNote === null ? [] : [injuredNote]),
      rules.adaptationText,
      rules.removalText,
      rules.experienceText,
    ].join('\n'),
    icon: 'organization',
    expanded: true,
    children: view.workers.map((row) => {
      const gain = nextWorkerGain(row, rules);
      return {
        id: `worker:${row.building}`,
        label: `${row.label} Nv${row.level}`,
        description: [
          `${row.assigned} · ${formatNumber(row.grossPerHour)}/h`,
          row.adapting > 0 ? `${row.adapting} em adaptação` : null,
          row.injured > 0 ? injuredCount(row.injured) : null,
          row.experienceTrend === 'falling' ? '⚠ o ofício se perde' : null,
        ]
          .filter((part) => part !== null)
          .join(' · '),
        tooltip: [
          row.breakdown,
          `${experienceSummary(row, rules)}. ${row.experienceNote}`,
          `+1 aqui: ${gain}. ${rules.adaptationText}`,
        ].join('\n'),
        contextValue: 'lords.worker',
        command: { id: 'lords.openPanel', args: ['fief'] },
        actionHints: { 'lords.workersIncrease': gain },
      };
    }),
  };
}

/**
 * As construções (GDD §6.3): uma linha por obra em curso (até duas, com a segunda fila aberta),
 * as planejadas na ordem da lista, com o que cada uma espera, e as obras que podem ser ordenadas.
 */
function constructionsNode(view: ViewState, elapsedSeconds: number): TreeNode {
  const { constructions } = view;
  const { available, planned, queuesUnlocked, queuesNote } = constructions;
  const busy = busyQueues(constructions);
  const left = (seconds: number) => formatRemaining(remainingNow(seconds, elapsedSeconds));
  const children: TreeNode[] = [];
  for (const active of busy) {
    const remaining = left(active.secondsRemaining);
    children.push({
      // O edifício vai no id: com duas obras em curso, "Cancelar" sabe de qual linha veio.
      id: `active:${active.building}`,
      label: `${active.label} → Nv${active.targetLevel}`,
      description: remaining,
      tooltip: `Em obras. Termina em ${remaining}. ${refundSentence(active.refund, 'Cancelar devolve')}`,
      icon: 'tools',
      contextValue: 'lords.activeConstruction',
      command: { id: 'lords.openPanel', args: ['fief'] },
    });
  }
  if (planned.length > 0) {
    // As planejadas têm o seu grupo, na ordem da lista (é a ordem em que as automáticas são
    // tentadas). A barra lateral é estreita: o nome vai curto, e a marca vem por extenso antes
    // da espera, para nada ser dito só pelo ícone.
    const automatic = planned.filter((plan) => plan.autoStart).length;
    const manual = planned.length - automatic;
    children.push({
      id: 'planned',
      label: 'Planejadas',
      description: [
        ...(automatic > 0 ? [automatic === 1 ? '1 automática' : `${automatic} automáticas`] : []),
        ...(manual > 0 ? [manual === 1 ? '1 manual' : `${manual} manuais`] : []),
      ].join(', '),
      tooltip:
        'As automáticas começam sozinhas, na ordem da lista, quando houver recursos e fila livre.',
      icon: 'checklist',
      expanded: true,
      children: planned.map((plan) => {
        const waiting = planWaiting(plan, elapsedSeconds);
        return {
          id: `planned:${plan.building}`,
          // "Serraria → Nv3", como a obra em curso; o que ainda não existe é "Construir: Celeiro".
          label: isNewBuilding(plan) ? upgradeName(plan) : `${plan.label} → Nv${plan.targetLevel}`,
          description: `${plan.autoStart ? 'automática' : 'manual'} · ${waiting}`,
          tooltip: [
            plan.autoStart
              ? 'Planejada, com início automático: os pedreiros começam sozinhos quando puderem.'
              : 'Planejada: espera a sua ordem para começar.',
            `${upgradeName(plan)} · ${formatCost(plan.cost)} · ${formatDuration(plan.durationSeconds)}`,
            `${capitalize(waiting)}.`,
          ].join('\n'),
          icon: plan.autoStart ? 'play-circle' : 'bookmark',
          contextValue: plan.autoStart ? 'lords.plannedAuto' : 'lords.plannedManual',
          // O clique só navega: a marca muda no botão da linha.
          command: { id: 'lords.openPanel', args: ['fief'] },
        };
      }),
    });
  }
  for (const upgrade of available) {
    const terms = `${formatCost(upgrade.cost)} · ${formatDuration(upgrade.durationSeconds)}`;
    children.push({
      id: `construction:${upgrade.building}`,
      label: upgradeName(upgrade),
      description: truncate(terms, DESCRIPTION_MAX),
      // O custo e o prazo, o que a obra muda, por que o prazo é esse nesta estação e, se houver,
      // o que impede a obra.
      tooltip: [terms, upgrade.effect, upgrade.durationNote, upgrade.blockedReason]
        .filter((line) => line !== null)
        .join('\n'),
      icon: upgrade.blockedReason === null ? 'check' : 'lock',
      // O clique só navega: começar a obra é uma ação explícita, no botão do item.
      contextValue:
        upgrade.blockedReason !== null
          ? 'lords.blockedUpgrade'
          : isNewBuilding(upgrade)
            ? 'lords.newBuilding'
            : 'lords.upgrade',
      command: { id: 'lords.openPanel', args: ['fief'] },
    });
  }
  // Com o grupo recolhido, a linha ainda diz o que importa: as obras em curso, a fila que sobra
  // e quantas planejadas esperam.
  const free = queuesUnlocked - busy.length;
  const summary = [
    busy.length === 0
      ? 'nenhuma obra em andamento'
      : busy.map((active) => `${active.label} · ${left(active.secondsRemaining)}`).join(', '),
    ...(busy.length > 0 && free > 0 ? [free === 1 ? '1 fila livre' : `${free} filas livres`] : []),
    ...(planned.length > 0
      ? [planned.length === 1 ? '1 planejada' : `${planned.length} planejadas`]
      : []),
  ];
  return {
    id: 'constructions',
    label: 'Construções',
    description: summary.join(' · '),
    // O que abre a segunda fila, enquanto ela está fechada: a frase é a do servidor.
    ...(queuesNote === null ? {} : { tooltip: queuesNote }),
    icon: 'tools',
    children,
  };
}

/**
 * O Conselho (GDD §13.2): "1 carta pendente (expira em 14 h)" e uma linha por carta à espera,
 * com o prazo de cada uma. A explicação da linha é a regra em uma frase e quando vem a próxima
 * audiência, nas frases do servidor; a de cada carta, a situação e o que o conselho faz sozinho.
 * O clique leva à aba do Conselho, onde a carta se lê inteira; a resposta sai do botão da linha.
 */
function councilNode(view: ViewState, elapsedSeconds: number): TreeNode {
  const { council } = view;
  return {
    id: 'council',
    label: 'Conselho',
    description: councilSummary(view, elapsedSeconds),
    tooltip: [council.rulesText, nextAudience(council, elapsedSeconds)].join('\n'),
    icon: COUNCIL_ICON,
    expanded: true,
    command: { id: 'lords.openPanel', args: ['council'] },
    children: council.pending.map((card) => ({
      // A ocorrência vai no id: "Decidir" sabe de qual linha veio.
      id: `card:${card.instanceId}`,
      label: card.title,
      description: deadlineAlert(card, elapsedSeconds),
      tooltip: [card.text, card.expiryNote].join('\n'),
      icon: 'mail',
      contextValue: 'lords.card',
      command: { id: 'lords.openPanel', args: ['council'] },
    })),
  };
}

/**
 * Os Objetivos do Senhor (GDD §12.2): "3 em aberto · 4 cumpridos" e uma linha por objetivo em
 * aberto, com o progresso e a recompensa. A explicação de cada linha é o porquê, a recompensa e o
 * que falta agora, nas frases do servidor. O clique só navega; o botão da linha é o comando que
 * leva a cumprir o objetivo (alocar, construir, recrutar, decidir, planejar), com o custo da obra
 * na dica. Os cumpridos não ganham linha, só a contagem e os títulos na explicação do grupo: a
 * barra lateral é estreita, e a lista inteira está no painel.
 */
function objectivesNode(view: ViewState): TreeNode {
  const active = activeObjectives(view);
  const done = completedObjectives(view);
  return {
    id: 'objectives',
    label: 'Objetivos',
    description: objectivesSummary(view),
    tooltip: [
      ...(active.length === 0 ? [noActiveObjectives(view)] : []),
      ...(done.length === 0
        ? []
        : [`Cumpridos: ${done.map((objective) => objective.title).join('; ')}.`]),
    ].join('\n'),
    icon: active.length === 0 ? OBJECTIVE_DONE_ICON : OBJECTIVE_ICON,
    expanded: true,
    command: { id: 'lords.openPanel', args: ['fief'] },
    children: active.map((objective) => {
      const action = objectiveAction(view, objective);
      return {
        id: `objective:${objective.id}`,
        label: objective.title,
        description: objectiveTreeLine(objective),
        tooltip: objectiveLines(view, objective).join('\n'),
        icon: OBJECTIVE_ICON,
        // O clique só navega: a ordem sai do botão da linha.
        command: { id: 'lords.openPanel', args: ['fief'] },
        ...(action === null
          ? {}
          : {
              action: {
                command: action.command,
                ...(action.arg === undefined ? {} : { arg: action.arg }),
                label: `${action.label}: ${objective.title}`,
                text: action.text,
              },
              ...(action.terms === undefined
                ? {}
                : { actionHints: { [action.command]: action.terms } }),
            }),
      };
    }),
  };
}

function chronicleNode(chronicle: GameEvent[]): TreeNode {
  const last = chronicle.slice(-5).reverse();
  return {
    id: 'chronicle',
    label: 'Crônica',
    description:
      last[0] === undefined ? 'nada a contar ainda' : truncate(last[0].text, DESCRIPTION_MAX),
    icon: 'book',
    children: last.map((event) => ({
      id: `chronicle:${event.seq}`,
      label: truncate(event.text, 90),
      tooltip: event.text,
      command: { id: 'lords.openChronicle' },
    })),
  };
}

function accountNode(account: AccountState, githubAvailable: boolean): TreeNode {
  if (account.kind === 'signedOut') {
    return {
      id: 'account',
      label: 'Conta',
      description: 'ninguém governa neste navegador',
      icon: 'account',
    };
  }
  const action = (id: string, label: string, command: string, icon: string): TreeNode => ({
    id: `account:${id}`,
    label,
    icon,
    command: { id: command },
  });
  const children: TreeNode[] = [];
  if (account.kind === 'anonymous' && githubAvailable) {
    children.push(action('github', 'Vincular ao GitHub', 'lords.linkGithub', 'github'));
  }
  children.push(
    action(
      'code',
      account.hasRecoveryCode ? 'Trocar o Código do Reino' : 'Gerar Código do Reino',
      'lords.generateRecoveryCode',
      'key',
    ),
    action('privacy', 'Privacidade', 'lords.privacy', 'lock'),
    action('signOut', 'Sair desta máquina', 'lords.signOut', 'sign-out'),
    action('delete', 'Excluir conta…', 'lords.deleteAccount', 'trash'),
  );
  return {
    id: 'account',
    label: `Conta: ${account.displayName}`,
    description: account.kind === 'linked' ? 'GitHub' : 'anônima',
    icon: 'account',
    children,
  };
}

/**
 * A árvore lateral da v0.1 (GDD §13.2). Com a conta fora, devolve uma lista vazia: a barra
 * lateral mostra então um convite para "Jogar agora".
 */
export function buildTree(input: TreeInput): TreeNode[] {
  const { view, account } = input;
  if (account.kind === 'signedOut') {
    return [];
  }
  const settings: TreeNode = {
    id: 'settings',
    label: 'Configurações',
    icon: 'gear',
    command: { id: 'lords.openSettings' },
  };
  if (view === null) {
    return [
      {
        id: 'today',
        label: account.gameId === null ? 'Fundar um feudo' : 'Abrir o feudo',
        description: input.connection.kind === 'offline' ? 'sem ligação com o reino' : '',
        icon: 'home',
        command: { id: 'lords.openPanel' },
      },
      accountNode(account, input.githubAvailable ?? true),
      settings,
    ];
  }
  const { calendar, settlement } = view;
  const cold = view.winter?.cold ?? null;
  const { incoming } = view.threat;
  const offline = input.connection.kind === 'offline';
  // O que "Antes de partir" tem a dizer, para quem está em outra aba: quantos itens e, se algum
  // é mais que sugestão, o sinal de alerta. O clique leva à aba Hoje, onde estão os botões.
  const leaving = beforeLeaving(view);
  const pressing = leaving.some((item) => item.severity !== 'info');
  // As decisões pendentes passam na frente (GDD §13.2: "● 2 decisões"), com as novidades ao lado.
  // Sem ligação a visão é a guardada, e a carta dela pode já ter saído da mesa: não é anunciada.
  const waiting = [
    ...(view.pendingDecisions.length > 0 && !offline
      ? [pendingDecisionsLabel(view.pendingDecisions.length)]
      : []),
    ...(input.unseen > 0
      ? [`${input.unseen} ${input.unseen === 1 ? 'novidade' : 'novidades'}`]
      : []),
  ];
  return [
    {
      id: 'today',
      label: `Hoje em ${settlement.name}`,
      description:
        waiting.length > 0
          ? `● ${waiting.join(' · ')}`
          : offline
            ? 'sem ligação com o reino'
            : leaving.length === 0
              ? 'pronto para a ausência'
              : `${pressing ? '⚠ ' : ''}${leaving.length} a preparar`,
      // Sem ligação a visão é a guardada: a explicação diz isso, e não garante nada.
      tooltip:
        leaving.length === 0
          ? offline
            ? 'Sem ligação com o reino: este é o último estado conhecido do feudo. Nele não havia nada a preparar.'
            : 'O feudo está preparado para a sua ausência.'
          : [
              offline
                ? 'Antes de partir, pelo último estado conhecido (sem ligação com o reino):'
                : 'Antes de partir:',
              ...leaving.map((item) => item.text),
            ].join('\n'),
      icon: offline ? 'debug-disconnect' : 'home',
      command: { id: 'lords.openPanel', args: ['today'] },
    },
    {
      id: 'fief',
      label: `Feudo: ${settlement.name}`,
      // A fome, o frio e a incursão que os vigias avistaram aparecem por extenso: nada é dito
      // só pela cor, e a linha continua dizendo o que importa com o feudo recolhido.
      description:
        `${calendar.seasonLabel}, dia ${calendar.dayOfSeason}` +
        (view.famine ? ' · fome' : '') +
        (cold ? ' · frio' : '') +
        (incoming ? ' · incursão a caminho' : ''),
      tooltip: [calendar.seasonEffects, view.famine?.text, cold?.text, incoming?.text]
        .filter((line) => line !== undefined)
        .join('\n'),
      icon: view.famine ? 'warning' : cold ? 'flame' : 'shield',
      expanded: true,
      command: { id: 'lords.openPanel', args: ['fief'] },
      children: [
        resourcesNode(view),
        workersNode(view),
        constructionsNode(view, input.elapsedSeconds),
        councilNode(view, input.elapsedSeconds),
        moraleNode(view, input.elapsedSeconds),
        threatNode(view, input.elapsedSeconds),
        ...hearthNode(view),
        objectivesNode(view),
      ],
    },
    chronicleNode(input.chronicle),
    accountNode(account, input.githubAvailable ?? true),
    settings,
  ];
}
