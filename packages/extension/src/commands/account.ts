import type { AccountConflictDetails } from '@lotg/protocol';
import * as vscode from 'vscode';

import { conflictOptions, type ConflictChoice } from '../account/githubLink';
import { validateRecoveryCode } from '../account/recoveryCode';
import type { Controller } from '../controller';
import { attempt, type Register } from './shared';

/** Login nativo do VS Code: um clique, sem senha e sem o jogador cadastrar aplicativo nenhum. */
async function githubToken(): Promise<string | null> {
  try {
    const session = await vscode.authentication.getSession('github', ['read:user'], {
      createIfNone: true,
    });
    return session.accessToken;
  } catch {
    // O jogador fechou o diálogo de login: não é um erro, só uma desistência.
    return null;
  }
}

async function chooseConflict(
  details: AccountConflictDetails,
): Promise<ConflictChoice | undefined> {
  const picked = await vscode.window.showQuickPick(
    conflictOptions(details).map((option) => ({
      label: option.label,
      detail: option.description,
      choice: option.choice,
    })),
    {
      title: 'Este GitHub já está vinculado a outro feudo',
      placeHolder: 'Qual feudo manter? Os dois nunca são misturados.',
      ignoreFocusOut: true,
    },
  );
  return picked?.choice;
}

export function registerAccountCommands(controller: Controller, register: Register): void {
  const github = () =>
    attempt(async () => {
      const token = await githubToken();
      if (token === null) {
        return;
      }
      const state = await controller.whileBusy(() =>
        controller.account.signInOrLinkGithub(token, chooseConflict),
      );
      if (state !== null) {
        void vscode.window.showInformationMessage(
          `Conta de ${state.displayName} vinculada ao GitHub. Seu feudo acompanha você em qualquer máquina.`,
        );
      }
    });
  register('lords.linkGithub', github);
  register('lords.signInGithub', github);

  register('lords.generateRecoveryCode', () =>
    attempt(async () => {
      if (
        controller.account.state.kind !== 'signedOut' &&
        controller.account.state.hasRecoveryCode
      ) {
        const replace = 'Gerar um código novo';
        const choice = await vscode.window.showWarningMessage(
          'Você já tem um Código do Reino. Gerar outro invalida o anterior.',
          { modal: true },
          replace,
        );
        if (choice !== replace) {
          return;
        }
      }
      const code = await controller.account.generateRecoveryCode();
      const copy = 'Copiar';
      const choice = await vscode.window.showInformationMessage(
        `Código do Reino: ${code}`,
        {
          modal: true,
          detail:
            'Guarde em lugar seguro. Ele aparece só desta vez: quem o digitar em outra máquina assume este feudo.',
        },
        copy,
      );
      if (choice === copy) {
        await vscode.env.clipboard.writeText(code);
      }
    }),
  );

  register('lords.signInRecoveryCode', async () => {
    const code = await vscode.window.showInputBox({
      title: 'Entrar com Código do Reino',
      prompt: 'Digite o código gerado na outra máquina.',
      placeHolder: 'XXXX-XXXX-XXXX-XXXX-XXXX',
      ignoreFocusOut: true,
      validateInput: (value) => validateRecoveryCode(value),
    });
    if (code !== undefined) {
      await attempt(async () => {
        await controller.whileBusy(() => controller.account.signInWithRecoveryCode(code));
        await vscode.commands.executeCommand('lords.openPanel');
      });
    }
  });

  register('lords.signOut', async () => {
    const state = controller.account.state;
    if (state.kind === 'signedOut') {
      return;
    }
    const warning =
      state.kind === 'anonymous' && !state.hasRecoveryCode
        ? 'Esta conta é anônima e não tem Código do Reino: ao sair desta máquina, você não poderá mais voltar a este feudo.'
        : 'Você poderá voltar com o GitHub ou o Código do Reino.';
    const confirm = 'Sair desta máquina';
    const choice = await vscode.window.showWarningMessage(
      'Sair desta máquina?',
      { modal: true, detail: warning },
      confirm,
    );
    if (choice === confirm) {
      await attempt(() => controller.whileBusy(() => controller.account.signOut()));
    }
  });

  register('lords.deleteAccount', async () => {
    if (controller.account.state.kind === 'signedOut') {
      return;
    }
    const settlement = controller.view?.settlement.name;
    const confirm = 'Excluir a conta';
    const choice = await vscode.window.showWarningMessage(
      'Excluir a conta e o feudo?',
      {
        modal: true,
        detail:
          'A conta é bloqueada na hora e não pode ser recuperada. Os dados são removidos do servidor depois de sete dias; cópias de segurança podem guardá-los por até 14 dias após serem geradas.',
      },
      confirm,
    );
    if (choice !== confirm) {
      return;
    }
    if (settlement !== undefined) {
      const typed = await vscode.window.showInputBox({
        title: 'Confirme a exclusão',
        prompt: `Digite o nome do feudo (${settlement}) para confirmar.`,
        ignoreFocusOut: true,
        validateInput: (value) =>
          value.trim() === settlement ? null : 'O nome não confere com o do feudo.',
      });
      if (typed === undefined) {
        return;
      }
    }
    await attempt(async () => {
      await controller.whileBusy(() => controller.account.deleteAccount());
      void vscode.window.showInformationMessage('Conta excluída. Pedra Alta volta ao silêncio.');
    });
  });

  register('lords.newGame', async () => {
    const state = controller.account.state;
    if (state.kind === 'signedOut') {
      await vscode.commands.executeCommand('lords.openPanel');
      return;
    }
    if (state.gameId !== null) {
      const confirm = 'Começar outro feudo';
      const choice = await vscode.window.showWarningMessage(
        'Começar uma nova partida?',
        { modal: true, detail: 'O feudo atual é arquivado e não pode mais receber ordens.' },
        confirm,
      );
      if (choice !== confirm) {
        return;
      }
    }
    const settlementName = await vscode.window.showInputBox({
      title: 'Nova partida',
      prompt: 'Nome do feudo, de 2 a 24 caracteres.',
      value: 'Pedra Alta',
    });
    if (settlementName !== undefined) {
      await attempt(async () => {
        await controller.whileBusy(() =>
          controller.account.startNewGame({
            settlementName,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            vigilHourLocal: controller.settings.vigilHour,
          }),
        );
        await vscode.commands.executeCommand('lords.openPanel', 'fief');
      });
    }
  });
}
