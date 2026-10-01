import type { GameEvent } from '@lotg/protocol';
import * as vscode from 'vscode';

import type { Controller } from '../controller';
import { isEssential } from './policy';

const VIEW = 'Ver';
const MUTE = 'Silenciar 2h';

/**
 * Mostra as notificações que a política liberou, com os botões "Ver" e "Silenciar 2h".
 * O que pede atenção sai como aviso; o resto, como informação.
 */
export function registerNotifier(controller: Controller): () => void {
  return controller.onNotify((events) => {
    for (const event of events) {
      void notify(controller, event);
    }
  });
}

async function notify(controller: Controller, event: GameEvent): Promise<void> {
  const show = isEssential(event)
    ? vscode.window.showWarningMessage
    : vscode.window.showInformationMessage;
  const choice = await show(event.text, VIEW, MUTE);
  if (choice === VIEW) {
    await vscode.commands.executeCommand('lords.openPanel', 'fief');
  } else if (choice === MUTE) {
    controller.muteNotifications();
  }
}
