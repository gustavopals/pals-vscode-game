import type { ViewState } from '@lotg/protocol';
import { afterEach, describe, expect, it } from 'vitest';
import type { Controller } from '../app/controller';
import { intentOf } from '../game/intent';
import {
  makeController,
  palisadeRaisedView,
  siegeWaveView,
  scriptedDialogs,
  settle,
} from '../test-helpers';
import { bindCommands, type CommandEnv, createCommands, paletteItems } from './commands';

const controllers: Controller[] = [];
afterEach(() => {
  for (const controller of controllers.splice(0)) {
    controller.dispose();
  }
});

async function setup(view: ViewState) {
  const made = makeController({ signedIn: true });
  controllers.push(made.controller);
  made.api.state.view = view;
  const scripted = scriptedDialogs();
  const env: CommandEnv = {
    download: () => {},
    reload: () => {},
    sleep: async () => {},
    currentTheme: () => 'dark',
    openPalette: () => {},
    reveal: () => {},
  };
  const commands = createCommands(made.controller, scripted.dialogs, env);
  bindCommands(made.controller, commands);
  await made.controller.start();
  await settle(made.controller);
  const run = async (id: string, arg?: unknown) => {
    await commands.find((command) => command.id === id)?.run(arg);
    await settle(made.controller);
  };
  const orders = () => made.api.state.commands.map(({ type, payload }) => ({ type, payload }));
  const toasts = () => made.controller.toasts.map((toast) => toast.text);
  return { ...made, ...scripted, commands, run, orders, toasts };
}

const scheduled: ViewState = {
  ...siegeWaveView,
  siege: { ...siegeWaveView.siege!, current: 0, scheduledInSeconds: 900 },
  pendingDecisions: [],
};
const repairable: ViewState = { ...siegeWaveView, threat: palisadeRaisedView.threat };

describe('o Plano e a decisão entre ondas', () => {
  it('a paleta oferece os três comandos disponíveis na visão', async () => {
    const { commands } = await setup(siegeWaveView);
    expect(paletteItems(commands).map((item) => item.label)).toEqual(
      expect.arrayContaining([
        'Lords: Salvar Plano de Batalha por onda…',
        'Lords: Trocar formação entre ondas…',
        'Lords: Reparar a muralha entre ondas…',
      ]),
    );
  });
  it('o Plano pergunta a onda e abre com a Defesa ativa selecionada', async () => {
    const { run, answers, shown, orders } = await setup(scheduled);
    answers.push(1, 0);
    await run('lords.setBattlePlan');
    expect(shown).toHaveLength(2);
    expect(shown[1]).toMatchObject({ selected: 0 });
    expect(orders()).toEqual([{ type: 'setBattlePlan', payload: { wave: 2, formationId: null } }]);
  });
  it('o botão da onda salva só a onda escolhida e não abre diálogo', async () => {
    const { run, shown, orders } = await setup(scheduled);
    await run('lords.setBattlePlan', { wave: 3, formationId: null });
    expect(shown).toEqual([]);
    expect(orders()).toEqual([{ type: 'setBattlePlan', payload: { wave: 3, formationId: null } }]);
  });
  it('o Plano fechado ou uma decisão de outra onda não envia', async () => {
    const made = await setup(siegeWaveView);
    await made.run('lords.setBattlePlan', { wave: 1, formationId: null });
    await made.run('lords.swapWaveFormation', { decisionId: 'siege-1-3', formationId: null });
    expect(made.orders()).toEqual([]);
  });
  it('troca pela paleta com o prazo da visão e a opção atual selecionada', async () => {
    const { run, answers, shown, orders } = await setup(siegeWaveView);
    answers.push(0);
    await run('lords.swapWaveFormation');
    expect(shown[0]).toMatchObject({
      selected: 0,
      detail: expect.arrayContaining(['A onda seguinte chega em 1 h']),
    });
    expect(orders()).toEqual([
      { type: 'swapWaveFormation', payload: { wave: 2, formationId: null } },
    ]);
  });
  it('cancelar a lista não envia; duplo clique envia uma só ordem', async () => {
    const made = await setup(siegeWaveView);
    made.answers.push(undefined);
    await made.run('lords.swapWaveFormation');
    expect(made.orders()).toEqual([]);
    await Promise.all([
      made.run('lords.swapWaveFormation', { formationId: null }),
      made.run('lords.swapWaveFormation', { formationId: null }),
    ]);
    expect(made.orders()).toHaveLength(1);
  });
  it('reparo confirma pedra e ouro antes de enviar e não promete o prazo de uma obra', async () => {
    const { run, answers, shown, orders } = await setup(repairable);
    answers.push(true);
    await run('lords.emergencyRepair');
    expect(shown[0]).toMatchObject({
      kind: 'confirm',
      detail: expect.arrayContaining([
        expect.stringMatching(/Reparar toda a muralha agora: .* de pedra e .* de ouro/),
      ]),
    });
    expect(orders()).toEqual([{ type: 'emergencyRepair', payload: { wave: 2 } }]);
  });
  it('reparo cancelado ou bloqueado não envia', async () => {
    const made = await setup(repairable);
    made.answers.push(false);
    await made.run('lords.emergencyRepair');
    expect(made.orders()).toEqual([]);
    const blocked = await setup(siegeWaveView);
    await blocked.run('lords.emergencyRepair');
    expect(blocked.orders()).toEqual([]);
  });
  it('cada onda tem intenção própria e os dois reparos disputam a muralha', () => {
    expect(intentOf('setBattlePlan', { wave: 1, formationId: null })).not.toBe(
      intentOf('setBattlePlan', { wave: 2, formationId: null }),
    );
    expect(intentOf('setBattlePlan', { wave: 1, formationId: 'formation-1' })).toBe(
      intentOf('setBattlePlan', { wave: 1, formationId: null }),
    );
    expect(intentOf('emergencyRepair', { wave: 2 })).toBe(intentOf('repairWall', {}));
  });
  it('a decisão que avança com a lista aberta fecha a pergunta e não troca a onda seguinte', async () => {
    const made = await setup(siegeWaveView);
    made.answers.push(async () => {
      made.api.state.view = {
        ...siegeWaveView,
        pendingDecisions: siegeWaveView.pendingDecisions.map((entry) => ({
          ...entry,
          id: 'siege-1-3',
          wave: 3 as const,
        })),
      };
      made.api.state.stateVersion += 1;
      await made.controller.session.syncNow();
      return 0;
    });
    await made.run('lords.swapWaveFormation');
    expect(made.orders()).toEqual([]);
    expect(made.toasts()).toContain(
      'O Cerco mudou ou o prazo acabou: nada foi enviado. Confira a próxima onda.',
    );
  });
  it('outra aba muda o plano com a pergunta aberta: nenhuma ordem antiga o sobrescreve', async () => {
    const made = await setup(scheduled);
    made.answers.push(async () => {
      made.api.state.view = { ...scheduled, siege: { ...scheduled.siege!, current: 1 } };
      made.api.state.stateVersion += 1;
      await made.controller.session.syncNow();
      return 0;
    });
    await made.run('lords.setBattlePlan', { wave: 1 });
    expect(made.orders()).toEqual([]);
  });
  it('a confirmação do reparo perde a validade quando o preço ou a decisão mudam', async () => {
    for (const change of ['price', 'wave'] as const) {
      const made = await setup(repairable);
      made.answers.push(async () => {
        made.api.state.view =
          change === 'price'
            ? {
                ...repairable,
                threat: {
                  ...repairable.threat,
                  defense: {
                    ...repairable.threat.defense,
                    wall: {
                      ...repairable.threat.defense.wall,
                      repairOffer: { ...repairable.threat.defense.wall.repairOffer, stone: 999 },
                    },
                  },
                },
              }
            : { ...repairable, pendingDecisions: [] };
        made.api.state.stateVersion += 1;
        await made.controller.session.syncNow();
        return true;
      });
      await made.run('lords.emergencyRepair');
      expect(made.orders()).toEqual([]);
      expect(made.toasts()).toContain(
        'O Cerco mudou ou o prazo acabou: nada foi enviado. Confira a próxima onda.',
      );
    }
  });
  it('trocar de conta com a lista aberta não envia a decisão ao outro feudo', async () => {
    const made = await setup(siegeWaveView);
    made.answers.push(async () => {
      await made.controller.signOut();
      return 0;
    });
    await made.run('lords.swapWaveFormation');
    expect(made.orders()).toEqual([]);
    expect(made.toasts()).toContain(
      'A sessão terminou, ou o feudo mudou, com a troca de formação em aberto: nada foi enviado.',
    );
  });
});

const militiaView: ViewState = {
  ...scheduled,
  siege: {
    ...scheduled.siege!,
    militiaOffer: {
      maxCount: 7,
      canCall: true,
      blockedReason: null,
      untilInSeconds: 900,
      warningSeconds: 3600,
      targetId: 'embate-1',
      activeCount: 0,
      termsText: 'Aldeões deixam o trabalho; baixas permanentes.',
    },
  },
};

describe('milícia pela oferta pública', () => {
  it('a paleta pede quantidade e confere os termos antes de enviar uma ordem', async () => {
    const made = await setup(militiaView);
    made.answers.push('3', true);
    await made.run('lords.callMilitia');
    expect(made.shown).toHaveLength(2);
    expect(made.shown[0]).toMatchObject({
      kind: 'input',
      value: '7',
      prompt: expect.stringContaining('Até 7'),
    });
    expect(made.shown[1]).toMatchObject({
      kind: 'confirm',
      detail: ['Convocar 3 aldeões.', militiaView.siege!.militiaOffer.termsText],
    });
    expect(made.orders()).toEqual([{ type: 'callMilitia', payload: { count: 3 } }]);
  });
  it('cancelar qualquer etapa, informar quantidade inválida ou ter oferta bloqueada não envia', async () => {
    for (const answers of [[undefined], ['3', false], ['8'], ['1.5']]) {
      const made = await setup(militiaView);
      made.answers.push(...answers);
      await made.run('lords.callMilitia');
      expect(made.orders()).toEqual([]);
    }
    const made = await setup({
      ...militiaView,
      siege: {
        ...militiaView.siege!,
        militiaOffer: {
          ...militiaView.siege!.militiaOffer,
          canCall: false,
          blockedReason: 'Sem posto livre.',
        },
      },
    });
    await made.run('lords.callMilitia');
    expect(made.shown).toEqual([]);
    expect(made.toasts()).toContain('Sem posto livre.');
  });
  it('reconfere quantidade, alvo e disponibilidade após cada etapa', async () => {
    for (const step of [0, 1]) {
      for (const patch of [{ maxCount: 2 }, { targetId: 'embate-2' }, { canCall: false }]) {
        const made = await setup(militiaView);
        const change = async () => {
          made.api.state.view = {
            ...militiaView,
            siege: {
              ...militiaView.siege!,
              militiaOffer: { ...militiaView.siege!.militiaOffer, ...patch },
            },
          };
          made.api.state.stateVersion += 1;
          await made.controller.session.syncNow();
          return step === 0 ? '3' : true;
        };
        made.answers.push(...(step === 0 ? [change] : ['3', change]));
        await made.run('lords.callMilitia');
        expect(made.orders()).toEqual([]);
      }
    }
  });
  it('duplo acionamento compartilha o fluxo; trocar de conta na conferência cancela', async () => {
    const made = await setup(militiaView);
    made.answers.push('3', true);
    await Promise.all([made.run('lords.callMilitia'), made.run('lords.callMilitia')]);
    expect(made.orders()).toHaveLength(1);
    const other = await setup(militiaView);
    other.answers.push('3', async () => {
      await other.controller.signOut();
      return true;
    });
    await other.run('lords.callMilitia');
    expect(other.orders()).toEqual([]);
  });
  it('a prévia da onda leva o alvo ao servidor; a prévia comum mantém seu payload', async () => {
    const view = {
      ...militiaView,
      army: {
        ...militiaView.army,
        formations: [
          {
            id: 'formation-1',
            name: 'Guarda',
            isActive: true,
            posts: [],
            commanders: [],
            total: 0,
            shortfall: [],
            shortfallText: '',
            canDelete: true,
            previewStale: false,
          },
        ],
      },
    };
    const made = await setup(view);
    await made.run('lords.simulateBattle', { id: 'formation-1', siegeWave: 3 });
    await made.run('lords.simulateBattle', { id: 'formation-1' });
    expect(made.orders()).toEqual([
      { type: 'simulateBattle', payload: { formationId: 'formation-1', siegeWave: 3 } },
      { type: 'simulateBattle', payload: { formationId: 'formation-1' } },
    ]);
  });
});
