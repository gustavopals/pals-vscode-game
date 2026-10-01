import type { TreeNode } from '../ui/treeModel';
import { type Activity, ACTIVITY_LABELS } from './ActivityBar';
import { Tree } from './Tree';

const NODES: Record<Activity, readonly string[]> = {
  fief: ['today', 'fief'],
  chronicle: ['chronicle'],
  account: ['account', 'settings'],
};

/** Os itens de `buildTree` que cada atividade mostra. */
export function nodesFor(activity: Activity, nodes: TreeNode[]): TreeNode[] {
  const shown = nodes.filter((node) => NODES[activity].includes(node.id));
  // A seção única de uma atividade já abre expandida.
  return shown.map((node) =>
    activity !== 'fief' && node.children !== undefined ? { ...node, expanded: true } : node,
  );
}

const EMPTY: Record<Activity, string> = {
  fief: 'Ninguém governa neste navegador ainda.',
  chronicle: 'A Crônica começa quando o feudo é fundado.',
  account: 'Nenhuma conta neste navegador.',
};

/** A barra lateral: a árvore da atividade escolhida, ou um convite quando não há conta. */
export function SideBar(props: {
  open: boolean;
  activity: Activity;
  nodes: TreeNode[];
  signedIn: boolean;
  readOnly: boolean;
  onCommand: (id: string, arg?: unknown) => void;
}) {
  const nodes = nodesFor(props.activity, props.nodes);
  const title = ACTIVITY_LABELS[props.activity];
  return (
    <aside class="sidebar" id="sidebar" aria-label={`Barra lateral: ${title}`} hidden={!props.open}>
      <h2 class="sidebar-title">{title}</h2>
      <div class="sidebar-body">
        {nodes.length === 0 ? (
          <div class="sidebar-empty">
            <p class="muted">
              {props.signedIn ? 'Nada a mostrar aqui por enquanto.' : EMPTY[props.activity]}
            </p>
            {props.signedIn ? null : (
              <button type="button" onClick={() => props.onCommand('lords.playNow')}>
                Jogar agora
              </button>
            )}
          </div>
        ) : (
          <Tree nodes={nodes} label={title} readOnly={props.readOnly} onCommand={props.onCommand} />
        )}
      </div>
    </aside>
  );
}
