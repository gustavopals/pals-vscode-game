import type { GameEvent, ViewState } from '@lotg/protocol';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { BrowserNotifier } from '../notifications/browserNotifications';
import {
  councilView,
  type FakeApi,
  fakeApi,
  GAME_ID,
  gameEvent,
  goldenView,
  makeController,
  mealCard,
  settle,
  shareCard,
  withCards,
} from '../test-helpers';
import type { Controller, Toast, ToastAction } from './controller';

/**
 * O Conselho no controlador (roadmap da v0.2, V2D-T3): o caminho único da resposta, o aviso de
 * carta nova e o que acontece com eles quando a carta sai da mesa.
 */

const COMMANDS_REQUEST = `POST /games/${GAME_ID}/commands`;
const NEW_CARD = 'Nova carta do Conselho';
const APP_TITLE = 'Lords of the Guild';

type Made = ReturnType<typeof makeController>;
type MakeOptions = Parameters<typeof makeController>[0];

const created: Controller[] = [];
afterEach(() => {
  for (const controller of created.splice(0)) {
    controller.dispose();
  }
  vi.useRealTimers();
});

/** Um navegador que já jogou, com o feudo aberto na visão dada. */
async function opened(view: ViewState = councilView, options: MakeOptions = {}): Promise<Made> {
  const api = options.api ?? fakeApi();
  api.state.view = view;
  const made = makeController({ signedIn: true, ...options, api });
  created.push(made.controller);
  await made.controller.start();
  await settle(made.controller);
  return made;
}

/** O servidor passa a mostrar outra visão e, se houver, entrega eventos novos. */
async function serverShows(made: Made, view: ViewState, ...events: GameEvent[]): Promise<void> {
  made.api.state.view = view;
  made.api.state.stateVersion += 1;
  made.api.state.events.push(...events);
  await made.controller.session.syncNow();
  await settle(made.controller);
}

const toastWith = (controller: Controller, fragment: string): Toast | undefined =>
  controller.toasts.find((toast) => toast.text.includes(fragment));

function actionOf(toast: Toast | undefined, label: string): ToastAction {
  const found = toast?.actions.find((entry) => entry.label === label);
  if (found === undefined) {
    throw new Error(`O aviso não tem o botão "${label}".`);
  }
  return found;
}

/** O evento da chegada de uma carta, como o motor o emite: a ocorrência vai em `data`. */
const drawn = (seq: number, card = mealCard): GameEvent => ({
  ...gameEvent(seq, 'cardDrawn', `O conselho pediu audiência: ${card.title}.`),
  data: { cardId: card.instanceId.split('-')[0] ?? '', instanceId: card.instanceId },
});

/** Uma API de mentira que segura as ordens até o teste soltar: a resposta "a caminho". */
function heldCommands(api: FakeApi) {
  let release: () => void = () => {};
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  const fetchFn: typeof fetch = async (input, init) => {
    if (String(input).endsWith('/commands')) {
      await held;
    }
    return api.fetch(input, init);
  };
  return { fetch: fetchFn, release };
}

describe('responder uma carta (controller.answerCard)', () => {
  it('manda a ordem answerCard com a carta e a opção, e a visão da resposta toma a tela', async () => {
    const made = await opened();
    // O servidor responde com a mesa sem a carta respondida.
    made.api.state.view = withCards(councilView, [shareCard]);
    const ok = await made.controller.answerCard('masonsMeal-4', 'feast');
    expect(ok).toBe(true);
    expect(made.api.state.commands).toEqual([
      {
        commandId: '00000000-0000-4000-8000-000000000001',
        type: 'answerCard',
        payload: { instanceId: 'masonsMeal-4', optionId: 'feast' },
      },
    ]);
    expect(made.controller.view?.council.pending.map((card) => card.instanceId)).toEqual([
      'commonGranaryShare-3',
    ]);
    expect(made.controller.toasts).toEqual([]);
    expect(made.controller.answering.size).toBe(0);
  });

  describe('o desfecho da resposta', () => {
    const answered = (seq: number, instanceId: string): GameEvent => ({
      ...gameEvent(
        seq,
        'cardAnswered',
        'O senhor de Pedra Alta mandou servir caldo e pão aos pedreiros. Cantou-se na obra até a tarde.',
      ),
      data: { cardId: 'masonsMeal', instanceId, optionId: 'feast' },
    });
    /** A API de mentira passa a devolver, na resposta da ordem, o evento da decisão. */
    const answering = (api: FakeApi, event: GameEvent): typeof fetch => {
      return async (input, init) => {
        const response = await api.fetch(input, init);
        if (!String(input).endsWith('/commands') || !response.ok) {
          return response;
        }
        const body = (await response.json()) as Record<string, unknown>;
        return new Response(JSON.stringify({ ...body, events: [event] }), {
          status: response.status,
          headers: { 'content-type': 'application/json' },
        });
      };
    };

    it('a frase da Crônica da escolha aparece na hora, por alguns segundos, com o ícone do Conselho', async () => {
      const api = fakeApi();
      const event = answered(1, 'masonsMeal-4');
      const made = await opened(councilView, {
        api,
        overrides: { fetch: answering(api, event) },
      });
      await made.controller.setPreferences({ notifications: 'silent' });
      expect(await made.controller.answerCard('masonsMeal-4', 'feast')).toBe(true);
      // Não é notificação: vale em qualquer nível, não tem botões e some sozinha.
      expect(made.controller.toasts).toEqual([
        {
          id: expect.any(Number),
          kind: 'info',
          icon: 'law',
          text: event.text,
          actions: [],
          sticky: false,
        },
      ]);
      expect(made.controller.chronicle.map((entry) => entry.text)).toEqual([event.text]);
    });

    it('a resposta dada em outra aba não avisa aqui: a carta só some', async () => {
      const made = await opened(councilView);
      await serverShows(made, withCards(councilView, [shareCard]), answered(1, 'masonsMeal-4'));
      expect(made.controller.toasts).toEqual([]);
      expect(made.controller.view?.council.pending).toHaveLength(1);
    });

    it('no modo discreto, nada do jogo vai para a tela', async () => {
      const api = fakeApi();
      const made = await opened(councilView, {
        api,
        overrides: { fetch: answering(api, answered(1, 'masonsMeal-4')) },
      });
      await made.controller.setPreferences({ discreetMode: true });
      expect(await made.controller.answerCard('masonsMeal-4', 'feast')).toBe(true);
      expect(made.controller.toasts).toEqual([]);
    });
  });

  it('enquanto a resposta não volta, a carta fica marcada e um segundo clique não vira ordem', async () => {
    const api = fakeApi();
    const gate = heldCommands(api);
    const made = await opened(councilView, { api, overrides: { fetch: gate.fetch } });
    let redraws = 0;
    made.controller.onChange(() => {
      redraws += 1;
    });

    const first = made.controller.answerCard('masonsMeal-4', 'feast');
    await settle();
    expect([...made.controller.answering]).toEqual(['masonsMeal-4']);
    // A bancada foi avisada: é assim que os botões da carta ficam desabilitados.
    expect(redraws).toBeGreaterThan(0);
    // Duplo clique, ou a mesma carta pela árvore: nada sai.
    expect(await made.controller.answerCard('masonsMeal-4', 'bread')).toBe(false);
    // A outra carta continua livre.
    expect(made.controller.answering.has('commonGranaryShare-3')).toBe(false);

    gate.release();
    expect(await first).toBe(true);
    await settle(made.controller);
    expect(made.controller.answering.size).toBe(0);
    expect(made.api.state.commands).toHaveLength(1);
    expect(made.api.state.commands[0]?.payload).toEqual({
      instanceId: 'masonsMeal-4',
      optionId: 'feast',
    });
  });

  it('"Tentar de novo", depois de uma falha de rede, reenvia a mesma ordem, com o mesmo commandId', async () => {
    const made = await opened();
    made.api.state.online = false;
    const sent: string[] = [];
    const original = made.controller.send.bind(made.controller);
    made.controller.send = async (command) => {
      sent.push(command.commandId);
      await original(command);
    };

    expect(await made.controller.answerCard('masonsMeal-4', 'bread')).toBe(false);
    const toast = toastWith(made.controller, 'Sem ligação com o reino');
    expect(toast).toMatchObject({ kind: 'error', sticky: true });
    expect(made.controller.answering.size).toBe(0);
    expect(made.api.state.commands).toEqual([]);

    made.api.state.online = true;
    await made.controller.session.syncNow();
    await actionOf(toast, 'Tentar de novo').run();
    await settle(made.controller);
    expect(sent).toHaveLength(2);
    expect(sent[0]).toBe(sent[1]);
    expect(made.api.state.commands.map((command) => command.commandId)).toEqual([sent[0]]);
    expect(made.api.state.commands[0]?.payload).toEqual({
      instanceId: 'masonsMeal-4',
      optionId: 'bread',
    });
  });

  it('a recusa do servidor aparece com a frase dele, e a carta que saiu da mesa some da tela', async () => {
    const made = await opened();
    // Outra aba respondeu antes: a visão que vem na recusa já não tem a carta.
    made.api.state.view = withCards(councilView, [shareCard]);
    made.api.refuseNextCommand(
      'Esta carta já não espera resposta: o conselho já a resolveu.',
      'CARD_NOT_PENDING',
    );
    expect(await made.controller.answerCard('masonsMeal-4', 'feast')).toBe(false);
    expect(toastWith(made.controller, 'Esta carta já não espera resposta')).toMatchObject({
      kind: 'warning',
      text: 'Esta carta já não espera resposta: o conselho já a resolveu.',
    });
    expect(made.controller.view?.council.pending.map((card) => card.instanceId)).toEqual([
      'commonGranaryShare-3',
    ]);
    expect(made.controller.view?.pendingDecisions).toHaveLength(1);
    expect(made.controller.answering.size).toBe(0);
    // Uma recusa não tem o que tentar de novo.
    expect(made.controller.toasts.flatMap((toast) => toast.actions)).toEqual([]);
  });

  it.each([
    ['CARD_EXPIRED', 'O prazo desta carta acabou: o conselho já decidiu sozinho.'],
    ['OPTION_LOCKED', 'Servir a refeição requer 100 de comida em estoque.'],
    ['INSUFFICIENT_RESOURCES', 'Faltam 12 de comida para servir a refeição.'],
    ['INVALID_OPTION', 'Essa opção não existe nesta carta.'],
  ])('recusa %s: a frase do servidor vira aviso', async (code, message) => {
    const made = await opened();
    made.api.refuseNextCommand(message, code);
    expect(await made.controller.answerCard('masonsMeal-4', 'feast')).toBe(false);
    expect(toastWith(made.controller, message)).toMatchObject({ kind: 'warning' });
    expect(made.controller.answering.size).toBe(0);
  });

  it('sessão encerrada com a resposta a caminho: diz o que foi feito da ordem', async () => {
    const made = await opened();
    made.api.state.failNext.set('/commands', {
      status: 401,
      body: { code: 'SESSION_REVOKED', message: 'Esta sessão foi encerrada. Entre de novo.' },
    });
    // A renovação também é recusada: a sessão acabou mesmo.
    made.api.state.failNext.set('/auth/refresh', {
      status: 401,
      body: { code: 'SESSION_REVOKED', message: 'Esta sessão foi encerrada. Entre de novo.' },
    });
    expect(await made.controller.answerCard('masonsMeal-4', 'feast')).toBe(false);
    await settle(made.controller);
    expect(
      toastWith(made.controller, 'A sessão terminou antes de a resposta chegar ao conselho'),
    ).toMatchObject({ kind: 'warning' });
    expect(made.controller.account.state.kind).toBe('signedOut');
    expect(made.controller.route).toBe('welcome');
    expect(made.controller.answering.size).toBe(0);
    expect(made.api.state.commands).toEqual([]);
  });

  it('sem ligação nada é enviado nem fica em fila', async () => {
    const made = await opened();
    made.api.state.online = false;
    await made.controller.session.syncNow();
    await settle(made.controller);
    const before = made.api.state.requests.filter((entry) => entry === COMMANDS_REQUEST).length;
    expect(await made.controller.answerCard('masonsMeal-4', 'feast')).toBe(false);
    expect(toastWith(made.controller, 'Sua ordem não foi enviada')).toBeDefined();
    expect(made.api.state.requests.filter((entry) => entry === COMMANDS_REQUEST)).toHaveLength(
      before,
    );
  });
});

describe('aba do Conselho', () => {
  it('é uma aba fixa do feudo, e o endereço #/conselho abre nela', async () => {
    const made = await opened();
    expect(made.controller.tabs).toEqual(['today', 'fief', 'council']);
    made.controller.navigate('council');
    expect(made.controller.route).toBe('council');
    // Ir ao Conselho não é ter visto as novidades em badge.
    made.controller.unseen = 2;
    made.controller.navigate('council');
    expect(made.controller.unseen).toBe(2);

    const reloaded = makeController({ signedIn: true });
    created.push(reloaded.controller);
    reloaded.api.state.view = councilView;
    await reloaded.controller.start('council');
    await settle(reloaded.controller);
    expect(reloaded.controller.route).toBe('council');
  });

  it('sem feudo, o endereço do Conselho leva às boas-vindas', async () => {
    const made = makeController();
    created.push(made.controller);
    await made.controller.start('council');
    expect(made.controller.route).toBe('welcome');
  });
});

describe('título da aba do navegador', () => {
  it('a carta pendente entra no contador: "(1) Pedra Alta"', async () => {
    const made = await opened(withCards(goldenView, [mealCard]));
    expect(made.controller.title(0)).toBe(`(1) Pedra Alta · ${APP_TITLE}`);
    made.controller.unseen = 2;
    expect(made.controller.title(0)).toBe(`(3) Pedra Alta · ${APP_TITLE}`);
    await made.controller.setPreferences({ discreetMode: true });
    // No modo discreto, só o contador de tempo.
    expect(made.controller.title(0)).toBe('02:00');
  });
});

describe('aviso de carta nova (GDD §13.5)', () => {
  const seated = withCards(goldenView, [mealCard]);

  it('"Nova carta do Conselho: <título>", com "Decidir", que leva à aba do Conselho', async () => {
    const made = await opened(goldenView);
    await serverShows(made, seated, drawn(1));
    const toast = toastWith(made.controller, NEW_CARD);
    expect(toast).toMatchObject({
      kind: 'info',
      icon: 'law',
      text: 'Nova carta do Conselho: A refeição dos pedreiros',
      details: [
        'Espera a sua resposta por 23 h.',
        'Sem resposta até o fim do prazo, o conselho decide sozinho: repartir o pão do dia.',
      ],
      sticky: true,
      game: true,
    });
    expect(toast?.actions.map((action) => action.label)).toEqual(['Decidir', 'Silenciar 2h']);
    expect(made.controller.route).toBe('fief');
    await actionOf(toast, 'Decidir').run();
    expect(made.controller.route).toBe('council');
  });

  it('com a aba à vista não mexe no contador de novidades: a carta já é contada como decisão', async () => {
    const made = await opened(goldenView);
    await serverShows(made, seated, drawn(1));
    expect(made.controller.unseen).toBe(0);
    expect(made.controller.title(0)).toBe(`(1) Pedra Alta · ${APP_TITLE}`);
  });

  it('com a aba em segundo plano: o título conta uma vez só, e o navegador avisa se o jogador pediu', async () => {
    const shown: Array<{ title: string; body: string }> = [];
    const notifier: BrowserNotifier = {
      supported: true,
      granted: () => true,
      request: async () => true,
      show: (title, body) => shown.push({ title, body }),
    };
    const made = await opened(goldenView, { overrides: { notifier } });
    await made.controller.setPreferences({ browserNotifications: true });
    made.controller.setVisible(false);
    await serverShows(made, seated, drawn(1));
    expect(toastWith(made.controller, NEW_CARD)).toBeDefined();
    expect(made.controller.unseen).toBe(0);
    expect(made.controller.title(0)).toBe(`(1) Pedra Alta · ${APP_TITLE}`);
    expect(shown).toEqual([
      {
        title: 'Pedra Alta',
        body: 'Nova carta do Conselho: A refeição dos pedreiros Espera a sua resposta por 23 h. Sem resposta até o fim do prazo, o conselho decide sozinho: repartir o pão do dia.',
      },
    ]);
  });

  it('sai de cena quando a carta é respondida ou expira', async () => {
    const made = await opened(goldenView);
    await serverShows(made, seated, drawn(1));
    expect(toastWith(made.controller, NEW_CARD)).toBeDefined();
    // Outra aba respondeu, ou o prazo acabou: a visão volta sem a carta.
    await serverShows(made, goldenView);
    expect(toastWith(made.controller, NEW_CARD)).toBeUndefined();
  });

  it('a resposta dada aqui também leva o aviso embora', async () => {
    const made = await opened(goldenView);
    await serverShows(made, seated, drawn(1));
    made.api.state.view = goldenView;
    expect(await made.controller.answerCard('masonsMeal-4', 'bread')).toBe(true);
    expect(toastWith(made.controller, NEW_CARD)).toBeUndefined();
  });

  it('na aba do Conselho as cartas estão à vista: os avisos delas saem da frente', async () => {
    const made = await opened(goldenView);
    await serverShows(made, seated, drawn(1));
    expect(toastWith(made.controller, NEW_CARD)).toBeDefined();
    // Pela aba, pela árvore ou pela barra de status: chegar ao Conselho dispensa o aviso.
    made.controller.navigate('council');
    expect(toastWith(made.controller, NEW_CARD)).toBeUndefined();
    // E a carta que chega com a aba do Conselho à vista não ganha aviso por cima dela.
    await serverShows(made, councilView, drawn(2, shareCard));
    expect(made.controller.toasts).toEqual([]);
    expect(made.controller.view?.council.pending).toHaveLength(2);
  });

  it('com a página em segundo plano, a carta avisa mesmo que a aba aberta seja a do Conselho', async () => {
    const made = await opened(goldenView);
    made.controller.navigate('council');
    made.controller.setVisible(false);
    await serverShows(made, seated, drawn(1));
    expect(toastWith(made.controller, NEW_CARD)).toBeDefined();
  });

  it('duas cartas, dois avisos; cada um some com a sua carta', async () => {
    const made = await opened(goldenView);
    await serverShows(made, councilView, drawn(1, shareCard), drawn(2, mealCard));
    expect(made.controller.toasts.map((toast) => toast.text)).toEqual([
      'Nova carta do Conselho: A vez de repartir',
      'Nova carta do Conselho: A refeição dos pedreiros',
    ]);
    await serverShows(made, withCards(councilView, [mealCard]));
    expect(made.controller.toasts.map((toast) => toast.text)).toEqual([
      'Nova carta do Conselho: A refeição dos pedreiros',
    ]);
  });

  it('a carta que já saiu da mesa quando o evento chega não vira aviso', async () => {
    const made = await opened(goldenView);
    // O evento da chegada vem atrasado: a visão de agora já não tem a carta.
    await serverShows(made, goldenView, drawn(1));
    expect(made.controller.toasts).toEqual([]);
  });

  it('respeita a política: nada no nível silencioso e no modo discreto', async () => {
    const silent = await opened(goldenView);
    await silent.controller.setPreferences({ notifications: 'silent' });
    await serverShows(silent, seated, drawn(1));
    expect(silent.controller.toasts).toEqual([]);

    const discreet = await opened(goldenView);
    await discreet.controller.setPreferences({ discreetMode: true });
    await serverShows(discreet, seated, drawn(1));
    expect(discreet.controller.toasts).toEqual([]);
    expect(discreet.controller.unseen).toBe(0);
  });

  it('durante o "Silenciar 2h" não avisa nem vira novidade; a decisão continua contada', async () => {
    const made = await opened(goldenView);
    await made.controller.muteNotifications();
    await serverShows(made, seated, drawn(1));
    expect(made.controller.toasts).toEqual([]);
    expect(made.controller.unseen).toBe(0);
    expect(made.controller.title(0)).toBe(`(1) Pedra Alta · ${APP_TITLE}`);
  });

  it('"Silenciar 2h" tira da tela o aviso da carta, com os outros avisos do jogo', async () => {
    const made = await opened(goldenView);
    await serverShows(made, seated, drawn(1));
    await actionOf(toastWith(made.controller, NEW_CARD), 'Silenciar 2h').run();
    await settle(made.controller);
    expect(made.controller.toasts).toEqual([]);
    expect(made.controller.preferences.mutedUntil).not.toBeNull();
  });

  it('em "todas", a carta que expirou e o efeito tardio avisam com a frase da Crônica', async () => {
    const made = await opened(goldenView);
    await made.controller.setPreferences({ notifications: 'all' });
    const expired = gameEvent(
      1,
      'cardExpired',
      'Sem palavra do senhor, os pedreiros de Pedra Alta repartiram o pão que havia.',
    );
    const effect = gameEvent(2, 'cardEffectApplied', 'O poço de Pedra Alta desabou de vez.');
    await serverShows(made, goldenView, expired, effect);
    expect(made.controller.toasts.map((toast) => [toast.icon, toast.text])).toEqual([
      ['law', expired.text],
      ['law', effect.text],
    ]);
    expect(made.controller.toasts.every((toast) => toast.kind === 'info')).toBe(true);
    expect(made.controller.toasts[0]?.actions.map((action) => action.label)).toEqual([
      'Ver',
      'Silenciar 2h',
    ]);
  });

  it('a resposta do próprio jogador não vira aviso, mas entra na Crônica recente', async () => {
    const made = await opened(seated);
    await made.controller.setPreferences({ notifications: 'all' });
    const answered = gameEvent(1, 'cardAnswered', 'O senhor mandou servir caldo e pão.');
    await serverShows(made, goldenView, answered);
    expect(made.controller.toasts).toEqual([]);
    expect(made.controller.chronicle.map((event) => event.text)).toEqual([answered.text]);
  });

  it('sair da conta leva junto os avisos de carta e as respostas a caminho', async () => {
    const made = await opened(goldenView);
    await serverShows(made, seated, drawn(1));
    await made.controller.signOut();
    await settle(made.controller);
    expect(toastWith(made.controller, NEW_CARD)).toBeUndefined();
    expect(made.controller.answering.size).toBe(0);
  });
});

describe('a leitura seguinte acontece quando um prazo do Conselho vence', () => {
  const reads = (made: Made) =>
    made.api.state.requests.filter((request) => request.endsWith('/view')).length;
  /** O feudo aberto com a aba à vista e relógio de mentira: o ciclo é o dos 30 s. */
  const watching = async (view: ViewState): Promise<Made> => {
    vi.useFakeTimers();
    const made = makeController({ signedIn: true });
    created.push(made.controller);
    made.api.state.view = view;
    made.controller.setVisible(true);
    await made.controller.start();
    await vi.advanceTimersByTimeAsync(0);
    return made;
  };

  it('a carta que expira: a tela não fica parada em "prazo encerrado"', async () => {
    const made = await watching(
      withCards(goldenView, [{ ...mealCard, expiresInSeconds: 6 }], {
        nextAudienceInSeconds: 9000,
      }),
    );
    const before = reads(made);
    await vi.advanceTimersByTimeAsync(6_000);
    expect(reads(made)).toBe(before);
    // Um segundo depois do prazo, a leitura acontece.
    await vi.advanceTimersByTimeAsync(1_500);
    expect(reads(made)).toBe(before + 1);
  });

  it('a próxima audiência: a carta nova aparece na hora, sem esperar o ciclo', async () => {
    const made = await watching(withCards(goldenView, [], { nextAudienceInSeconds: 9 }));
    const before = reads(made);
    await vi.advanceTimersByTimeAsync(9_000);
    expect(reads(made)).toBe(before);
    await vi.advanceTimersByTimeAsync(1_500);
    expect(reads(made)).toBe(before + 1);
  });
});
