import type { GameEvent, ViewState } from '@lotg/protocol';

import type { AccountState } from '../account/accountService';
import type { Connection } from '../game/connection';
import {
  formatCost,
  formatDuration,
  formatNumber,
  formatRate,
  formatRemaining,
  remainingNow,
  truncate,
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
};

const DESCRIPTION_MAX = 60;

function resourcesNode(view: ViewState): TreeNode {
  return {
    id: 'resources',
    label: 'Recursos',
    icon: 'package',
    expanded: true,
    children: view.resources.map((row) => ({
      id: `resource:${row.id}`,
      label: row.label,
      description: `${formatNumber(row.stock)} (${formatRate(row.perHour)})`,
      tooltip: row.breakdown,
      command: { id: 'lords.openPanel', args: ['fief'] },
    })),
  };
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
      tooltip: `Em obras. Termina em ${remaining}. Cancelar devolve ${formatCost(active.refund)}.`,
      icon: 'tools',
      contextValue: 'lords.activeConstruction',
      command: { id: 'lords.openPanel', args: ['fief'] },
    });
  }
  for (const upgrade of available) {
    const terms = `${formatCost(upgrade.cost)} · ${formatDuration(upgrade.durationSeconds)}`;
    children.push({
      id: `construction:${upgrade.building}`,
      label: `${upgrade.label} Nv${upgrade.fromLevel} → Nv${upgrade.targetLevel}`,
      description: truncate(terms, DESCRIPTION_MAX),
      tooltip: upgrade.blockedReason === null ? terms : `${terms}\n${upgrade.blockedReason}`,
      icon: upgrade.blockedReason === null ? 'check' : 'lock',
      // O clique só navega: começar a obra é uma ação explícita, no botão do item.
      contextValue: upgrade.blockedReason === null ? 'lords.upgrade' : 'lords.blockedUpgrade',
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

function accountNode(account: AccountState): TreeNode {
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
  if (account.kind === 'anonymous') {
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
      accountNode(account),
      settings,
    ];
  }
  const { calendar, settlement } = view;
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
      description: `${calendar.seasonLabel}, dia ${calendar.dayOfSeason}${view.famine ? ' · fome' : ''}`,
      icon: view.famine ? 'warning' : 'shield',
      expanded: true,
      command: { id: 'lords.openPanel', args: ['fief'] },
      children: [
        resourcesNode(view),
        workersNode(view),
        constructionsNode(view, input.elapsedSeconds),
      ],
    },
    chronicleNode(input.chronicle),
    accountNode(account),
    settings,
  ];
}
