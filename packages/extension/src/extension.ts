import * as vscode from 'vscode';

import { registerAccountCommands } from './commands/account';
import { registerGameCommands } from './commands/game';
import { registerGeneralCommands } from './commands/general';
import type { Register } from './commands/shared';
import { Controller, describeError } from './controller';
import { registerNotifier } from './notifications/notifier';
import { LordsPanel } from './ui/panel';
import { LordsStatusBar } from './ui/statusBar';
import { LordsTreeProvider } from './ui/treeProvider';

/**
 * Ponto de entrada da extensão. Ela é só o cliente: guarda credenciais, conversa com o servidor
 * pelo `client-sdk` e exibe o `ViewState` que recebe. Nenhuma regra de jogo vive aqui.
 */
export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const output = vscode.window.createOutputChannel('Lords of the Guild');
  const controller = new Controller(context, output);
  const panel = new LordsPanel(context, controller);
  const tree = new LordsTreeProvider(controller);
  const treeView = vscode.window.createTreeView('lords.tree', { treeDataProvider: tree });
  const statusBar = new LordsStatusBar(controller, () => tree.refreshSoon());

  // O badge da view mostra as novidades ainda não vistas.
  const updateBadge = controller.onChange(() => {
    treeView.badge =
      controller.unseen > 0
        ? {
            value: controller.unseen,
            tooltip: `${controller.unseen} ${controller.unseen === 1 ? 'novidade' : 'novidades'} em Pedra Alta`,
          }
        : undefined;
    const name = controller.view?.settlement.name;
    treeView.title = name ?? 'Pedra Alta';
  });

  const register: Register = (id, handler) => {
    context.subscriptions.push(vscode.commands.registerCommand(id, handler));
  };
  registerGeneralCommands(controller, panel, register);
  registerGameCommands(controller, register);
  registerAccountCommands(controller, register);

  context.subscriptions.push(
    output,
    controller,
    panel,
    tree,
    treeView,
    statusBar,
    { dispose: updateBadge },
    { dispose: registerNotifier(controller) },
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration('lords')) {
        void controller.reconfigure();
      }
    }),
  );

  try {
    await controller.start();
  } catch (error) {
    // A ativação nunca falha por causa do servidor: o painel explica a situação.
    output.appendLine(`Falha ao retomar a partida: ${describeError(error).message}`);
  }
}

export function deactivate(): void {
  // Tudo que precisa ser encerrado está em `context.subscriptions`.
}
