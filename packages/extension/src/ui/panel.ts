import { randomBytes } from 'node:crypto';

import {
  type ExtensionToWebview,
  type WebviewRoute,
  WebviewToExtensionSchema,
} from '@lotg/protocol';
import * as vscode from 'vscode';

import { Controller, describeError } from '../controller';

const ACTION_COMMANDS = {
  signInGithub: 'lords.signInGithub',
  signInRecoveryCode: 'lords.signInRecoveryCode',
  retryConnection: 'lords.refresh',
  exportChronicle: 'lords.exportChronicle',
} as const;

/**
 * O painel do jogo: um único WebviewPanel, com as rotas boas-vindas, Hoje e Feudo.
 * A Webview nunca fala com a rede: troca mensagens tipadas com a extensão (GDD §14.12).
 */
export class LordsPanel implements vscode.Disposable {
  private panel: vscode.WebviewPanel | null = null;
  private route: WebviewRoute = 'welcome';
  private readonly unsubscribe: Array<() => void>;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly controller: Controller,
  ) {
    this.unsubscribe = [controller.onPanelMessage((message) => this.post(message))];
  }

  get visible(): boolean {
    return this.panel?.visible ?? false;
  }

  /** Abre o painel, ou o traz para a frente, na rota pedida. */
  show(route?: WebviewRoute): void {
    const allowed = this.controller.defaultRoute();
    // Sem conta ou sem feudo, só as boas-vindas fazem sentido.
    this.route = allowed === 'welcome' ? 'welcome' : (route ?? allowed);
    if (this.panel !== null) {
      this.panel.reveal(undefined, false);
      this.post({ type: 'navigate', route: this.route });
      return;
    }
    const media = vscode.Uri.joinPath(this.context.extensionUri, 'media');
    const panel = vscode.window.createWebviewPanel(
      'lords.panel',
      'Lords of the Guild',
      vscode.ViewColumn.Active,
      { enableScripts: true, retainContextWhenHidden: true, localResourceRoots: [media] },
    );
    this.panel = panel;
    panel.webview.html = this.html(panel.webview, media);
    // Devolver a promessa não muda nada para o VS Code e deixa os testes esperarem o tratamento.
    panel.webview.onDidReceiveMessage((raw: unknown) => this.receive(raw));
    panel.onDidChangeViewState(() => {
      this.controller.setPanelVisible(panel.visible);
    });
    panel.onDidDispose(() => {
      this.panel = null;
      this.controller.setPanelVisible(false);
    });
    this.controller.setPanelVisible(true);
  }

  private post(message: ExtensionToWebview): void {
    if (message.type === 'navigate') {
      this.route = message.route;
    }
    void this.panel?.webview.postMessage(message);
  }

  private async receive(raw: unknown): Promise<void> {
    const parsed = WebviewToExtensionSchema.safeParse(raw);
    if (!parsed.success) {
      this.controller.output.appendLine('Mensagem inválida vinda do painel foi ignorada.');
      return;
    }
    const message = parsed.data;
    try {
      switch (message.type) {
        case 'ready':
          for (const entry of this.controller.snapshot(this.route)) {
            this.post(entry);
          }
          break;
        case 'navigate':
          this.route = message.route;
          if (message.route === 'fief') {
            this.controller.markSeen();
          }
          break;
        case 'command':
          await this.controller.send(message.command);
          break;
        case 'playNow':
          await this.controller.playNow(message.displayName, message.settlementName);
          this.post({ type: 'navigate', route: 'fief' });
          break;
        case 'action':
          if (message.action === 'dismissReport') {
            this.controller.markSeen();
          } else {
            await vscode.commands.executeCommand(ACTION_COMMANDS[message.action]);
          }
          break;
      }
    } catch (error) {
      // O motivo aparece dentro do painel, ao lado do que o jogador tentou fazer.
      this.post({ type: 'error', ...describeError(error) });
    }
  }

  private html(webview: vscode.Webview, media: vscode.Uri): string {
    const nonce = randomBytes(16).toString('base64');
    const script = webview.asWebviewUri(vscode.Uri.joinPath(media, 'webview.js'));
    const style = webview.asWebviewUri(vscode.Uri.joinPath(media, 'webview.css'));
    const csp = [
      "default-src 'none'",
      `style-src ${webview.cspSource}`,
      `script-src 'nonce-${nonce}'`,
      `font-src ${webview.cspSource}`,
      `img-src ${webview.cspSource} data:`,
    ].join('; ');
    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="${csp}" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <link rel="stylesheet" href="${style.toString()}" />
  <title>Lords of the Guild</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" nonce="${nonce}" src="${script.toString()}"></script>
</body>
</html>`;
  }

  dispose(): void {
    for (const unsubscribe of this.unsubscribe) {
      unsubscribe();
    }
    this.panel?.dispose();
  }
}
