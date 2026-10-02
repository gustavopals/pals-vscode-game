import type { GameEvent, ViewState } from '@lotg/protocol';

import type { AccountState } from '../account/accountService';
import { beforeLeaving } from '../game/beforeLeaving';
import type { Connection } from '../game/connection';
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
import { experienceSummary, nextWorkerGain } from './workers';

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

/** "655/900" para o que tem limite, "318" para o ouro. */
const stockOverCap = (row: ResourceRow) =>
  row.cap === null
    ? formatNumber(row.stock)
    : `${formatNumber(row.stock)}/${formatNumber(row.cap)}`;

/**
 * O que a linha de um recurso diz depois do nome (GDD §13.2). Em regra, o estoque sobre o limite
 * e a taxa: "412/1.500 (+29/h)". Com o depósito cheio e perdendo produção, ou a menos de uma
 * ausência de encher, o alerta toma o lugar da taxa, para caber na barra lateral: "655/900 ⚠
 * cheio em 4 h". A previsão distante fica na tabela do painel; a árvore só fala do que é urgente.
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
  const { villagers, free } = view.population;
  const rules = view.workersRules;
  return {
    id: 'workers',
    label: 'Trabalhadores',
    description: `${villagers - free}/${villagers} alocados · ${free} ${free === 1 ? 'livre' : 'livres'}`,
    tooltip: [rules.adaptationText, rules.removalText, rules.experienceText].join('\n'),
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
  const offline = input.connection.kind === 'offline';
  // O que "Antes de partir" tem a dizer, para quem está em outra aba: quantos itens e, se algum
  // é mais que sugestão, o sinal de alerta. O clique leva à aba Hoje, onde estão os botões.
  const leaving = beforeLeaving(view);
  const pressing = leaving.some((item) => item.severity !== 'info');
  return [
    {
      id: 'today',
      label: `Hoje em ${settlement.name}`,
      description:
        input.unseen > 0
          ? `● ${input.unseen} ${input.unseen === 1 ? 'novidade' : 'novidades'}`
          : offline
            ? 'sem ligação com o reino'
            : leaving.length === 0
              ? 'pronto para a ausência'
              : `${pressing ? '⚠ ' : ''}${leaving.length} a preparar`,
      tooltip:
        leaving.length === 0
          ? 'O feudo está preparado para a sua ausência.'
          : ['Antes de partir:', ...leaving.map((item) => item.text)].join('\n'),
      icon: offline ? 'debug-disconnect' : 'home',
      command: { id: 'lords.openPanel', args: ['today'] },
    },
    {
      id: 'fief',
      label: `Feudo: ${settlement.name}`,
      // A fome e o frio aparecem por extenso e com ícone próprio: nada é dito só pela cor.
      description:
        `${calendar.seasonLabel}, dia ${calendar.dayOfSeason}` +
        (view.famine ? ' · fome' : '') +
        (cold ? ' · frio' : ''),
      tooltip: [calendar.seasonEffects, view.famine?.text, cold?.text]
        .filter((line) => line !== undefined)
        .join('\n'),
      icon: view.famine ? 'warning' : cold ? 'flame' : 'shield',
      expanded: true,
      command: { id: 'lords.openPanel', args: ['fief'] },
      children: [
        resourcesNode(view),
        workersNode(view),
        constructionsNode(view, input.elapsedSeconds),
        moraleNode(view, input.elapsedSeconds),
        ...hearthNode(view),
      ],
    },
    chronicleNode(input.chronicle),
    accountNode(account, input.githubAvailable ?? true),
    settings,
  ];
}
