import { afterEach, describe, expect, it } from 'vitest';

import { gameEvent, makeController, settle } from '../test-helpers';
import type { Controller } from './controller';

const controllers: Controller[] = [];
afterEach(() => {
  for (const controller of controllers.splice(0)) controller.dispose();
});

describe('o fechamento anual nos avisos (V4H-T4.1)', () => {
  it('a notícia abre a Crônica e usa a frase emitida, sem refazer a pontuação', async () => {
    const made = makeController({ signedIn: true });
    const { controller, api } = made;
    controllers.push(controller);
    await controller.start();
    await settle(controller);
    await controller.setPreferences({ notifications: 'all' });
    const event = {
      ...gameEvent(1, 'yearEnded', 'Encerra-se o ano 1: 731 pontos.'),
      data: { year: 1, score: 731 },
    };
    api.state.events.push(event);
    api.state.stateVersion += 1;
    await controller.session.syncNow();
    await settle(controller);
    const toast = controller.toasts.find((toast) => toast.text === event.text);
    expect(toast).toMatchObject({ kind: 'info', icon: 'book' });
    const action = toast?.actions.find((action) => action.label === 'Ver');
    expect(action).toBeDefined();
    await action?.run();
    expect(controller.route).toBe('chronicle');
  });
});
