import type { Command } from '@lotg/protocol';
import { afterEach, describe, expect, it } from 'vitest';

import { fakeApi, gameEvent, makeController, settle, siegeWaveView } from '../test-helpers';
import type { Controller } from './controller';

const controllers: Controller[] = [];
afterEach(() => {
  for (const controller of controllers.splice(0)) controller.dispose();
});

async function opened() {
  const made = makeController({ signedIn: true });
  controllers.push(made.controller);
  await made.controller.start();
  await settle(made.controller);
  return made;
}

describe('os avisos do Cerco no controlador', () => {
  it('a onda abre uma decisão essencial com acesso ao Cerco e some na onda seguinte', async () => {
    const made = await opened();
    made.controller.setVisible(false);
    made.api.state.view = siegeWaveView;
    made.api.state.stateVersion += 1;
    made.api.state.events.push({
      ...gameEvent(1, 'siegeWaveFought', 'A primeira onda recuou.'),
      data: { year: 1, wave: 1 },
    });
    await made.controller.session.syncNow();
    await settle(made.controller);
    const toast = made.controller.toasts.find((entry) => entry.text === 'A primeira onda recuou.');
    expect(toast).toMatchObject({
      kind: 'info',
      details: [
        expect.stringContaining('A onda seguinte chega em 1 h'),
        expect.stringContaining('Defesa ativa'),
      ],
    });
    expect(toast?.actions.map((action) => action.label)).toContain('Ver a próxima onda');
    expect(made.controller.unseen).toBe(0);
    made.api.state.view = { ...siegeWaveView, pendingDecisions: [] };
    made.api.state.stateVersion += 1;
    await made.controller.session.syncNow();
    await settle(made.controller);
    expect(made.controller.toasts.some((entry) => entry.id === toast?.id)).toBe(false);
  });
  it('a onda à vista na aba Exército e o modo discreto não repetem a decisão em aviso', async () => {
    for (const mode of ['army', 'discreet'] as const) {
      const made = await opened();
      made.controller.setVisible(true);
      if (mode === 'army') made.controller.navigate('army');
      else await made.controller.setPreferences({ discreetMode: true });
      made.api.state.view = siegeWaveView;
      made.api.state.stateVersion += 1;
      made.api.state.events.push({
        ...gameEvent(1, 'siegeWaveFought', 'A primeira onda recuou.'),
        data: { year: 1, wave: 1 },
      });
      await made.controller.session.syncNow();
      await settle(made.controller);
      expect(made.controller.toasts.some((entry) => entry.text === 'A primeira onda recuou.')).toBe(
        false,
      );
      expect(made.controller.unseen).toBe(0);
    }
  });
  it('a Queda é um aviso essencial de perigo, com acesso ao rescaldo', async () => {
    const made = await opened();
    made.api.state.view = {
      ...siegeWaveView,
      siege: {
        ...siegeWaveView.siege!,
        result: 'fall',
        resultText: 'Queda',
        nextWaveInSeconds: null,
      },
      pendingDecisions: [],
    };
    made.api.state.stateVersion += 1;
    made.api.state.events.push({
      ...gameEvent(1, 'siegeFell', 'O feudo sobrevive em ruínas.'),
      data: { year: 1 },
    });
    await made.controller.session.syncNow();
    await settle(made.controller);
    expect(made.controller.toasts).toContainEqual(
      expect.objectContaining({ text: 'O feudo sobrevive em ruínas.', kind: 'warning' }),
    );
  });
});

describe('retentativa das ordens do Cerco', () => {
  it('uma retentativa da troca não alcança a decisão da outra onda', async () => {
    const made = await opened();
    made.api.state.view = siegeWaveView;
    made.api.state.stateVersion += 1;
    await made.controller.session.syncNow();
    made.api.state.online = false;
    expect(await made.controller.swapWaveFormation(2, null)).toBe(false);
    const retry = made.controller.toasts
      .flatMap((toast) => toast.actions)
      .find((action) => action.label === 'Tentar de novo');
    expect(retry).toBeDefined();
    made.api.state.online = true;
    made.api.state.view = {
      ...siegeWaveView,
      pendingDecisions: siegeWaveView.pendingDecisions.map((entry) =>
        entry.kind === 'siegeWave' ? { ...entry, wave: 3 as const, id: 'siege-1-3' } : entry,
      ),
    };
    made.api.state.stateVersion += 1;
    await made.controller.session.syncNow();
    await retry!.run();
    await settle(made.controller);
    expect(made.api.state.commands).toEqual([]);
    expect(made.controller.toasts.map((toast) => toast.text)).toContain(
      'O Cerco mudou ou o prazo acabou: a ordem antiga não foi reenviada. Confira a próxima onda.',
    );
  });
  it('a troca e o reparo levam a onda conferida e não saem para outra onda', async () => {
    const made = await opened();
    made.api.state.view = siegeWaveView;
    made.api.state.stateVersion += 1;
    await made.controller.session.syncNow();
    expect(await made.controller.swapWaveFormation(3, null)).toBe(false);
    expect(await made.controller.emergencyRepair(3)).toBe(false);
    expect(made.api.state.commands).toEqual([]);
    expect(await made.controller.swapWaveFormation(2, null)).toBe(true);
    expect(made.api.state.commands.map(({ type, payload }) => ({ type, payload }))).toEqual([
      { type: 'swapWaveFormation', payload: { wave: 2, formationId: null } },
    ]);
  });
  for (const type of ['setBattlePlan', 'swapWaveFormation', 'emergencyRepair'] as const) {
    it(`${type}: a falha de rede e Tentar de novo conservam commandId e payload`, async () => {
      const api = fakeApi();
      const requests: Command[] = [];
      const made = makeController({
        api,
        signedIn: true,
        overrides: {
          fetch: async (input, init) => {
            if (String(input).endsWith('/commands'))
              requests.push(JSON.parse(String(init?.body)) as Command);
            return api.fetch(input, init);
          },
        },
      });
      controllers.push(made.controller);
      api.state.view =
        type === 'setBattlePlan'
          ? {
              ...siegeWaveView,
              siege: { ...siegeWaveView.siege!, current: 0, scheduledInSeconds: 3600 },
              pendingDecisions: [],
            }
          : siegeWaveView;
      await made.controller.start();
      await settle(made.controller);
      api.state.online = false;
      const send =
        type === 'setBattlePlan'
          ? () => made.controller.setBattlePlan(2, null)
          : type === 'swapWaveFormation'
            ? () => made.controller.swapWaveFormation(2, null)
            : () => made.controller.emergencyRepair(2);
      expect(await send()).toBe(false);
      const retry = made.controller.toasts
        .flatMap((toast) => toast.actions)
        .find((action) => action.label === 'Tentar de novo');
      expect(retry).toBeDefined();
      api.state.online = true;
      await made.controller.session.syncNow();
      await retry!.run();
      await settle(made.controller);
      expect(requests.length).toBeGreaterThanOrEqual(2);
      expect(
        requests.every((command) => JSON.stringify(command) === JSON.stringify(requests[0])),
      ).toBe(true);
      expect(api.state.commands).toEqual([requests[0]]);
    });
  }
});
