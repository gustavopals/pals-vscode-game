import { NetworkError } from '@lotg/client-sdk';
import type { Command } from '@lotg/protocol';
import { describe, expect, it } from 'vitest';

import * as editor from '../test/fake-vscode';
import { attempt } from './commands/shared';
import { Controller } from './controller';

function setup() {
  editor.reset();
  const context = editor.createContext();
  const output = editor.window.createOutputChannel('teste');
  const controller = new Controller(context as never, output as never);
  const sent: Command[] = [];
  // Uma partida aberta de mentira: só interessa o que a extensão manda enviar.
  Object.defineProperty(controller.session, 'gameId', { get: () => 'partida-1' });
  return { controller, sent };
}

describe('ordens do jogador', () => {
  it('"Tentar de novo" reenvia a mesma ordem, com o mesmo commandId', async () => {
    const { controller, sent } = setup();
    let failures = 1;
    controller.session.send = async (command) => {
      sent.push(command);
      if (failures > 0) {
        failures -= 1;
        // A ordem pode ter chegado ao servidor; a resposta é que se perdeu.
        throw new NetworkError('fora');
      }
    };
    editor.state.answers.push('Tentar de novo');
    await attempt(controller.prepare('recruitVillagers', { quantity: 2 }));

    expect(editor.state.messages.at(-1)).toMatchObject({
      kind: 'error',
      buttons: ['Tentar de novo'],
    });
    expect(sent).toHaveLength(2);
    // Mesmo UUID: se a primeira tinha chegado, o servidor responde com o recibo e não recruta
    // de novo.
    expect(sent[1]?.commandId).toBe(sent[0]?.commandId);
    expect(sent[1]).toEqual(sent[0]);
  });

  it('cada intenção nova do jogador tem o seu commandId', async () => {
    const { controller, sent } = setup();
    controller.session.send = async (command) => {
      sent.push(command);
    };
    await attempt(controller.prepare('recruitVillagers', { quantity: 2 }));
    await attempt(controller.prepare('recruitVillagers', { quantity: 2 }));
    expect(sent).toHaveLength(2);
    expect(sent[1]?.commandId).not.toBe(sent[0]?.commandId);
    expect(sent[0]?.commandId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('sem partida aberta, a ordem é recusada sem ir à rede', async () => {
    editor.reset();
    const controller = new Controller(
      editor.createContext() as never,
      editor.window.createOutputChannel('teste') as never,
    );
    await attempt(controller.prepare('recruitVillagers', { quantity: 1 }));
    expect(editor.state.messages.at(-1)?.text).toContain('Sem ligação com o reino');
  });
});
