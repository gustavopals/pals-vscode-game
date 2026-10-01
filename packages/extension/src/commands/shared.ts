import { isGameRuleError } from '@lotg/client-sdk';
import * as vscode from 'vscode';

import { type Controller, describeError } from '../controller';

const RETRY = 'Tentar de novo';

/**
 * Roda uma ação do jogador e mostra o que deu errado: a recusa do motor é um aviso, com a frase
 * que veio do servidor; falta de rede é um erro com "Tentar de novo".
 */
export async function attempt(action: () => Promise<void>): Promise<void> {
  try {
    await action();
  } catch (error) {
    const { code, message } = describeError(error);
    if (isGameRuleError(error)) {
      void vscode.window.showWarningMessage(message);
    } else if (code === 'NETWORK') {
      const choice = await vscode.window.showErrorMessage(message, RETRY);
      if (choice === RETRY) {
        await attempt(action);
      }
    } else {
      void vscode.window.showErrorMessage(message);
    }
  }
}

/** A visão atual, ou um aviso de que ainda não há feudo aberto. */
export function requireView(controller: Controller) {
  const view = controller.view;
  if (view === null) {
    void vscode.window
      .showInformationMessage(
        'Ainda não há um feudo aberto nesta máquina. Abra o painel para jogar agora.',
        'Abrir painel',
      )
      .then((choice) => {
        if (choice !== undefined) {
          void vscode.commands.executeCommand('lords.openPanel');
        }
      });
  }
  return view;
}

export type Register = (id: string, handler: (...args: unknown[]) => unknown) => void;
