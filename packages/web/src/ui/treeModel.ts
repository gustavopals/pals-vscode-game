import type { GameEvent, ViewState } from '@lotg/protocol';

import type { AccountState } from '../account/accountService';
import type { Connection } from '../game/connection';
import {
  capExplanation,
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
  refundSentence,
  remainingNow,
  runsOutIn,
  storageAlert,
  truncate,
  upgradeName,
} from './format';

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
      // A conta da taxa, de onde vem o limite e, se houver, o que o servidor diz do depósito.
      tooltip: [row.breakdown, capExplanation(row), row.fullNote]
        .filter((line) => line !== null)
        .join('\n'),
      command: { id: 'lords.openPanel', args: ['fief'] },
    })),
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

function workersNode(view: ViewState): TreeNode {
  const { villagers, free } = view.population;
  return {
    id: 'workers',
    label: 'Trabalhadores',
    description: `${villagers - free}/${villagers} alocados · ${free} ${free === 1 ? 'livre' : 'livres'}`,
    icon: 'organization',
    expanded: true,
    children: view.workers.map((row) => ({
      id: `worker:${row.building}`,
      label: `${row.label} Nv${row.level}`,
      description: `${row.assigned} · ${formatNumber(row.grossPerHour)}/h`,
      tooltip: row.breakdown,
      contextValue: 'lords.worker',
      command: { id: 'lords.openPanel', args: ['fief'] },
    })),
  };
}

function constructionsNode(view: ViewState, elapsedSeconds: number): TreeNode {
  const { active, available } = view.constructions;
  const children: TreeNode[] = [];
  if (active !== null) {
    const remaining = formatRemaining(remainingNow(active.secondsRemaining, elapsedSeconds));
    children.push({
      id: 'construction:active',
      label: `${active.label} → Nv${active.targetLevel}`,
      description: remaining,
      tooltip: `Em obras. Termina em ${remaining}. ${refundSentence(active.refund, 'Cancelar devolve')}`,
      icon: 'tools',
      contextValue: 'lords.activeConstruction',
      command: { id: 'lords.openPanel', args: ['fief'] },
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
  return {
    id: 'constructions',
    label: 'Construções',
    description:
      active === null
        ? 'nenhuma obra em andamento'
        : `${active.label} · ${formatRemaining(remainingNow(active.secondsRemaining, elapsedSeconds))}`,
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
  return [
    {
      id: 'today',
      label: `Hoje em ${settlement.name}`,
      description:
        input.unseen > 0
          ? `● ${input.unseen} ${input.unseen === 1 ? 'novidade' : 'novidades'}`
          : offline
            ? 'sem ligação com o reino'
            : '',
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
        ...hearthNode(view),
      ],
    },
    chronicleNode(input.chronicle),
    accountNode(account, input.githubAvailable ?? true),
    settings,
  ];
}
