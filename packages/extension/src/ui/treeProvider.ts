import * as vscode from 'vscode';

import type { Controller } from '../controller';
import { buildTree, type TreeNode } from './treeModel';

const DEBOUNCE_MS = 500;

/** Traduz o modelo da árvore (`treeModel.ts`) para itens do VS Code. */
export class LordsTreeProvider implements vscode.TreeDataProvider<TreeNode>, vscode.Disposable {
  private readonly changed = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this.changed.event;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private readonly unsubscribe: () => void;

  constructor(private readonly controller: Controller) {
    // Várias mudanças seguidas (visão, eventos, conexão) viram um redesenho só.
    this.unsubscribe = controller.onChange(() => this.refreshSoon());
  }

  refreshSoon(): void {
    if (this.timer === null) {
      this.timer = setTimeout(() => {
        this.timer = null;
        this.changed.fire();
      }, DEBOUNCE_MS);
    }
  }

  refreshNow(): void {
    this.changed.fire();
  }

  getChildren(node?: TreeNode): TreeNode[] {
    if (node !== undefined) {
      return node.children ?? [];
    }
    const { controller } = this;
    return buildTree({
      view: controller.view,
      account: controller.account.state,
      connection: controller.connection,
      chronicle: controller.chronicle,
      unseen: controller.unseen,
      elapsedSeconds: controller.elapsedSeconds,
    });
  }

  getTreeItem(node: TreeNode): vscode.TreeItem {
    const hasChildren = (node.children?.length ?? 0) > 0;
    const item = new vscode.TreeItem(
      node.label,
      hasChildren
        ? node.expanded
          ? vscode.TreeItemCollapsibleState.Expanded
          : vscode.TreeItemCollapsibleState.Collapsed
        : vscode.TreeItemCollapsibleState.None,
    );
    item.id = node.id;
    if (node.description !== undefined) {
      item.description = node.description;
    }
    if (node.tooltip !== undefined) {
      item.tooltip = node.tooltip;
    }
    if (node.icon !== undefined) {
      item.iconPath = new vscode.ThemeIcon(node.icon);
    }
    if (node.contextValue !== undefined) {
      item.contextValue = node.contextValue;
    }
    if (node.command !== undefined) {
      item.command = {
        command: node.command.id,
        title: node.label,
        arguments: node.command.args ?? [],
      };
    }
    return item;
  }

  dispose(): void {
    this.unsubscribe();
    if (this.timer !== null) {
      clearTimeout(this.timer);
    }
    this.changed.dispose();
  }
}
