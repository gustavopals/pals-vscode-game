import { useLayoutEffect, useRef, useState } from 'preact/hooks';

import { Icon } from '../components/shared';
import type { TreeNode } from '../ui/treeModel';
import { flattenTree, type TreeRow, treeKey } from './treeNav';

type RowAction = { label: string; text: string; command: string; key?: string };

/** A dica do botão: o nome dele e, quando a linha informa, o que a ordem custa ou rende. */
export function actionTitle(node: TreeNode, action: Pick<RowAction, 'label' | 'command'>): string {
  const hint = node.actionHints?.[action.command];
  return hint === undefined ? action.label : `${action.label} (${hint})`;
}

/** As ordens de um item saem destes botões, nunca do clique na linha. */
export function rowActions(node: TreeNode): RowAction[] {
  switch (node.contextValue) {
    case 'lords.worker':
      return [
        {
          label: `Tirar um trabalhador de ${node.label}`,
          text: '−',
          command: 'lords.workersDecrease',
          key: '-',
        },
        {
          label: `Pôr mais um trabalhador em ${node.label}`,
          text: '+',
          command: 'lords.workersIncrease',
          key: '+',
        },
      ];
    case 'lords.upgrade':
      return [{ label: `Melhorar: ${node.label}`, text: 'Melhorar', command: 'lords.build' }];
    case 'lords.newBuilding':
      // O edifício ainda não existe: a linha já se chama "Construir: Celeiro".
      return [{ label: node.label, text: 'Construir', command: 'lords.build' }];
    case 'lords.activeConstruction':
      return [
        {
          label: `Cancelar a obra: ${node.label}`,
          text: 'Cancelar',
          command: 'lords.cancelConstruction',
        },
      ];
    case 'lords.plannedManual':
      // A marca "iniciar quando houver recursos" a um clique: o botão diz o que ele faz.
      return [
        {
          label: `Iniciar quando houver recursos: ${node.label}`,
          text: 'Iniciar sozinha',
          command: 'lords.toggleAutoStart',
        },
      ];
    case 'lords.plannedAuto':
      return [
        {
          label: `Esperar a sua ordem: ${node.label}`,
          text: 'Esperar ordem',
          command: 'lords.toggleAutoStart',
        },
      ];
    case 'lords.card':
      // A carta se lê na aba do Conselho (o clique na linha); o botão abre a lista das opções.
      return [{ label: `Decidir: ${node.label}`, text: 'Decidir', command: 'lords.answerCard' }];
    default:
      return [];
  }
}

/**
 * A árvore lateral (GDD §13.2), desenhada a partir de `buildTree`. Clicar em uma linha só
 * navega; as ordens saem dos botões de cada linha.
 */
export function Tree(props: {
  nodes: TreeNode[];
  label: string;
  /** Sem ligação, os botões de ordem ficam desabilitados: nada vai para uma fila. */
  readOnly: boolean;
  onCommand: (id: string, arg?: unknown) => void;
}) {
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const moveFocus = useRef(false);
  const container = useRef<HTMLDivElement>(null);
  const rows = flattenTree(props.nodes, overrides);
  // O foco cai sempre em uma linha que existe: a primeira, se a anterior sumiu.
  const current = rows.find((row) => row.node.id === focusedId) ?? rows[0];

  // Logo depois de desenhar: quem segura a seta não espera o próximo quadro pelo foco.
  useLayoutEffect(() => {
    if (moveFocus.current) {
      moveFocus.current = false;
      container.current?.querySelector<HTMLElement>('[tabindex="0"]')?.focus();
    }
  });

  const toggle = (id: string, expanded: boolean) =>
    setOverrides((previous) => ({ ...previous, [id]: expanded }));

  const activate = (row: TreeRow) => {
    const { command } = row.node;
    if (command !== undefined) {
      props.onCommand(command.id, command.args?.[0]);
    } else if (row.expandable) {
      toggle(row.node.id, !row.expanded);
    }
  };

  const onKeyDown = (row: TreeRow) => (event: KeyboardEvent) => {
    if (event.target !== event.currentTarget) {
      // Tecla em um botão da linha: o botão cuida dela.
      return;
    }
    const action = props.readOnly
      ? undefined
      : rowActions(row.node).find(
          (candidate) =>
            candidate.key === event.key || (candidate.key === '+' && event.key === '='),
        );
    if (action !== undefined) {
      event.preventDefault();
      props.onCommand(action.command, row.node);
      return;
    }
    const result = treeKey(rows, row.node.id, event.key);
    if (result === null) {
      return;
    }
    event.preventDefault();
    if (result.focus !== undefined) {
      moveFocus.current = true;
      setFocusedId(result.focus);
    }
    if (result.expand !== undefined) {
      toggle(result.expand, true);
    }
    if (result.collapse !== undefined) {
      toggle(result.collapse, false);
    }
    if (result.activate !== undefined) {
      activate(row);
    }
  };

  return (
    <div class="tree" role="tree" aria-label={props.label} ref={container}>
      {rows.map((row) => {
        const { node } = row;
        const focused = current?.node.id === node.id;
        return (
          <div
            key={node.id}
            role="treeitem"
            class={`tree-row tree-depth-${Math.min(row.depth, 3)}`}
            aria-level={row.depth + 1}
            aria-posinset={row.position}
            aria-setsize={row.setSize}
            aria-expanded={row.expandable ? row.expanded : undefined}
            aria-selected={focused}
            tabIndex={focused ? 0 : -1}
            title={node.tooltip}
            data-node={node.id}
            onClick={() => {
              setFocusedId(node.id);
              if (row.expandable && node.command === undefined) {
                toggle(node.id, !row.expanded);
              } else {
                activate(row);
              }
            }}
            onFocus={() => setFocusedId(node.id)}
            onKeyDown={onKeyDown(row)}
          >
            <span
              class="tree-twistie"
              onClick={(event) => {
                if (row.expandable) {
                  event.stopPropagation();
                  toggle(node.id, !row.expanded);
                }
              }}
            >
              {row.expandable ? (
                <Icon name={row.expanded ? 'chevron-down' : 'chevron-right'} />
              ) : null}
            </span>
            {node.icon === undefined ? null : <Icon name={node.icon} />}
            <span class="tree-label">{node.label}</span>
            {node.description ? <span class="tree-description">{node.description}</span> : null}
            <span class="tree-actions">
              {rowActions(node).map((action) => (
                <button
                  key={action.command}
                  type="button"
                  aria-label={action.label}
                  // A dica traz o que a ordem custa ou rende, quando a linha o informa.
                  title={actionTitle(node, action)}
                  disabled={props.readOnly}
                  // Só a linha em foco põe os seus botões na ordem do Tab.
                  tabIndex={focused ? 0 : -1}
                  onClick={(event) => {
                    event.stopPropagation();
                    props.onCommand(action.command, node);
                  }}
                >
                  {action.text}
                </button>
              ))}
            </span>
          </div>
        );
      })}
    </div>
  );
}
