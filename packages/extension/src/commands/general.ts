import { PROTOCOL_VERSION, WebviewRouteSchema } from '@lotg/protocol';
import * as vscode from 'vscode';

import { type Controller, describeError, EXTENSION_VERSION } from '../controller';
import type { LordsPanel } from '../ui/panel';
import type { Register } from './shared';

export function registerGeneralCommands(
  controller: Controller,
  panel: LordsPanel,
  register: Register,
): void {
  register('lords.openPanel', (route) => {
    const parsed = WebviewRouteSchema.safeParse(route);
    panel.show(parsed.success ? parsed.data : undefined);
  });

  register('lords.about', async () => {
    let server: string;
    try {
      const version = await controller.client.version();
      server = `Servidor ${version.server} · protocolo ${version.protocol} · conteúdo ${version.contentHash}`;
    } catch (error) {
      server = `Servidor indisponível: ${describeError(error).message}`;
    }
    void vscode.window.showInformationMessage(
      `Lords of the Guild ${EXTENSION_VERSION} (protocolo ${PROTOCOL_VERSION})`,
      { modal: true, detail: `${server}\n${controller.settings.serverUrl}` },
    );
  });

  register('lords.toggleDiscreetMode', async () => {
    const config = vscode.workspace.getConfiguration('lords');
    const next = !config.get<boolean>('discreetMode', false);
    await config.update('discreetMode', next, vscode.ConfigurationTarget.Global);
    void vscode.window.setStatusBarMessage(
      next ? 'Modo discreto ligado.' : 'Modo discreto desligado.',
      3000,
    );
  });

  register('lords.muteNotifications', () => {
    controller.muteNotifications();
    void vscode.window.setStatusBarMessage('Notificações do feudo silenciadas por 2 horas.', 3000);
  });

  register('lords.privacy', () => {
    void vscode.window.showInformationMessage('Lords of the Guild: privacidade', {
      modal: true,
      detail: [
        'O servidor guarda o nome de exibição que você escolheu, o identificador do GitHub (só se você vincular), o rótulo desta máquina, as datas de acesso e os hashes das credenciais. O progresso do feudo e as ordens dadas ficam vinculados à conta. O token do GitHub não é guardado.',
        'Nesta máquina, as credenciais ficam só no armazenamento seguro do VS Code, e o último estado do feudo fica em cache para o modo sem conexão.',
        'Excluir a conta bloqueia o acesso na hora. Os dados saem do servidor depois de sete dias; cópias de segurança podem guardá-los por até 14 dias depois de geradas.',
      ].join('\n\n'),
    });
  });

  register('lords.openSettings', () =>
    vscode.commands.executeCommand('workbench.action.openSettings', 'lords.'),
  );
}
