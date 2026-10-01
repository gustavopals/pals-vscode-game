import type { TreeNode } from '../ui/treeModel';

/** Uma linha visível da árvore, com a profundidade e o estado de expansão. */
export type TreeRow = {
  node: TreeNode;
  depth: number;
  parentId: string | null;
  expandable: boolean;
  expanded: boolean;
  /** Posição entre os irmãos e total deles, para leitores de tela. */
  position: number;
  setSize: number;
};

/** As linhas à vista, de cima para baixo. `overrides` guarda o que o jogador abriu ou fechou. */
export function flattenTree(
  nodes: TreeNode[],
  overrides: Readonly<Record<string, boolean>>,
  depth = 0,
  parentId: string | null = null,
): TreeRow[] {
  const rows: TreeRow[] = [];
  nodes.forEach((node, index) => {
    const expandable = (node.children?.length ?? 0) > 0;
    const expanded = expandable && (overrides[node.id] ?? node.expanded ?? false);
    rows.push({
      node,
      depth,
      parentId,
      expandable,
      expanded,
      position: index + 1,
      setSize: nodes.length,
    });
    if (expanded) {
      rows.push(...flattenTree(node.children ?? [], overrides, depth + 1, node.id));
    }
  });
  return rows;
}

export type TreeKeyResult = {
  /** Linha que recebe o foco. */
  focus?: string;
  expand?: string;
  collapse?: string;
  /** Linha acionada (`Enter`): navega; nunca dá uma ordem ao feudo. */
  activate?: string;
};

/**
 * Teclado no padrão de árvore ARIA: setas para cima e para baixo andam entre as linhas à vista;
 * a seta para a direita abre um ramo ou entra nele; a para a esquerda fecha ou sobe ao pai;
 * `Home` e `End` vão às pontas; `Enter` e espaço acionam. Devolve `null` para as outras teclas.
 */
export function treeKey(
  rows: TreeRow[],
  currentId: string | null,
  key: string,
): TreeKeyResult | null {
  if (rows.length === 0) {
    return null;
  }
  const index = rows.findIndex((row) => row.node.id === currentId);
  const current = rows[index];
  const at = (position: number) => rows[Math.min(Math.max(position, 0), rows.length - 1)]?.node.id;
  const focus = (id: string | undefined): TreeKeyResult => (id === undefined ? {} : { focus: id });
  switch (key) {
    case 'ArrowDown':
      return focus(at(index + 1));
    case 'ArrowUp':
      return focus(at(index < 0 ? 0 : index - 1));
    case 'Home':
      return focus(at(0));
    case 'End':
      return focus(at(rows.length - 1));
    case 'ArrowRight':
      if (current === undefined || !current.expandable) {
        return {};
      }
      return current.expanded ? focus(at(index + 1)) : { expand: current.node.id };
    case 'ArrowLeft':
      if (current === undefined) {
        return {};
      }
      if (current.expanded) {
        return { collapse: current.node.id };
      }
      return current.parentId === null ? {} : { focus: current.parentId };
    case 'Enter':
    case ' ':
      return current === undefined ? {} : { activate: current.node.id };
    default:
      return null;
  }
}
