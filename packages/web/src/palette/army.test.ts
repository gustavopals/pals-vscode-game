import type { ViewState } from '@lotg/protocol';
import { afterEach, describe, expect, it } from 'vitest';

import type { Controller } from '../app/controller';
import { intentOf } from '../game/intent';
import {
  armyIdleView,
  armyTrainingView,
  makeController,
  scriptedDialogs,
  settle,
} from '../test-helpers';
import { bindCommands, type CommandEnv, createCommands, paletteItems } from './commands';

/**
 * Os comandos do Quartel (V4C-T3.2; GDD §10.2): um caminho só para cada ordem. O painel e a árvore
 * chamam o mesmo comando que a paleta, que passa por `controller.prepare`; cada fluxo roda um por
 * vez e lê a visão depois de cada diálogo. O custo e o prazo são os da visão.
 */

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
  const revealed: string[] = [];
  const env: CommandEnv = {
    download: () => {},
    reload: () => {},
    sleep: async () => {},
    currentTheme: () => 'dark',
    openPalette: () => {},
    reveal: (elementId) => {
      revealed.push(elementId);
    },
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
  return { ...made, ...scripted, commands, run, orders, toasts, revealed };
}

describe('a paleta e os comandos do Quartel', () => {
  it('a paleta tem os comandos do Quartel e identifica a simulação como defesa', async () => {
    const { commands } = await setup(armyIdleView);
    expect(paletteItems(commands).map((item) => item.label)).toEqual(
      expect.arrayContaining([
        'Lords: Ir para o Exército',
        'Lords: Treinar soldados…',
        'Lords: Cancelar o treino…',
        'Lords: Dispensar soldados…',
        'Lords: Simular defesa do feudo…',
      ]),
    );
  });

  it('`openArmy` e `openPanel army` levam à aba Exército', async () => {
    const { run, controller, revealed } = await setup(armyIdleView);
    await run('lords.openArmy');
    expect(controller.route).toBe('army');
    controller.navigate('fief');
    await run('lords.openPanel', 'army');
    expect(controller.route).toBe('army');
    expect(revealed).toEqual(['army-title']);
  });
});

describe('treinar', () => {
  it('pela paleta: a unidade, o lote, a confirmação com a linha da visão e a ordem', async () => {
    const { run, answers, shown, orders } = await setup(armyIdleView);
    // O Arqueiro (terceiro da lista), 4 soldados (quarto da lista de 1 a 6; a lista responde por posição), confirma.
    answers.push(2, 3, true);
    await run('lords.trainSoldiers');
    expect(shown.map((dialog) => dialog.kind)).toEqual(['pick', 'pick', 'confirm']);
    const confirm = shown[2];
    if (confirm?.kind !== 'confirm') {
      throw new Error('esperava a confirmação');
    }
    expect(confirm.title).toContain('Treinar Arqueiro × 4');
    expect(orders()).toEqual([{ type: 'trainSoldiers', payload: { unit: 'archer', amount: 4 } }]);
  });

  it('desistir em qualquer diálogo não envia nada', async () => {
    for (const answers of [[undefined], [2, undefined], [2, 1, false]]) {
      const made = await setup(armyIdleView);
      made.answers.push(...answers);
      await made.run('lords.trainSoldiers');
      expect(made.orders()).toEqual([]);
    }
  });

  it('o painel manda a ordem já conferida: nenhum diálogo', async () => {
    const { run, shown, orders } = await setup(armyIdleView);
    await run('lords.trainSoldiers', { unit: 'knight', amount: 2, confirmed: true });
    expect(shown).toEqual([]);
    expect(orders()).toEqual([{ type: 'trainSoldiers', payload: { unit: 'knight', amount: 2 } }]);
  });

  it('o duplo acionamento vale uma ordem só (a trava do treino)', async () => {
    const { commands, controller, orders } = await setup(armyIdleView);
    const train = commands.find((command) => command.id === 'lords.trainSoldiers');
    await Promise.all([
      train?.run({ unit: 'spearman', amount: 2, confirmed: true }),
      train?.run({ unit: 'spearman', amount: 2, confirmed: true }),
    ]);
    await settle(controller);
    expect(orders()).toHaveLength(1);
  });

  it('com lote no pátio ou sem Quartel: um aviso e nenhum diálogo', async () => {
    const busy = await setup(armyTrainingView);
    await busy.run('lords.trainSoldiers');
    expect(busy.shown).toEqual([]);
    expect(busy.toasts().join(' ')).toContain('É um lote por vez');
    expect(busy.orders()).toEqual([]);
    const none = await setup({ ...armyIdleView, army: { ...armyIdleView.army, built: false } });
    await none.run('lords.trainSoldiers');
    expect(none.shown).toEqual([]);
    expect(none.orders()).toEqual([]);
  });
});

describe('cancelar o treino', () => {
  it('pela paleta: a confirmação traz o que a visão diz que devolve', async () => {
    const { run, answers, shown, orders } = await setup(armyTrainingView);
    answers.push(true);
    await run('lords.cancelTraining');
    const confirm = shown[0];
    if (confirm?.kind !== 'confirm') {
      throw new Error('esperava a confirmação');
    }
    expect(confirm.detail).toContain(armyTrainingView.army.training?.cancelRefundText);
    expect(orders()).toEqual([{ type: 'cancelTraining', payload: { lotKey: '0:archer:4' } }]);
  });

  it('o painel manda o cancelamento conferido; sem lote, um aviso', async () => {
    const sent = await setup(armyTrainingView);
    await sent.run('lords.cancelTraining', { confirmed: true, lotKey: '0:archer:4' });
    expect(sent.shown).toEqual([]);
    expect(sent.orders()).toEqual([{ type: 'cancelTraining', payload: { lotKey: '0:archer:4' } }]);
    const none = await setup(armyIdleView);
    await none.run('lords.cancelTraining');
    expect(none.orders()).toEqual([]);
    expect(none.toasts().join(' ')).toContain('Não há lote');
  });

  it('o lote que mudou com a pergunta aberta (outra identidade) não é cancelado', async () => {
    const made = await setup(armyTrainingView);
    const training = armyTrainingView.army.training;
    if (training === null) {
      throw new Error('o cenário pede um lote');
    }
    made.answers.push(async () => {
      // Mesma unidade, mesma quantidade, mesma duração: só a identidade do lote mudou.
      made.api.state.view = {
        ...armyTrainingView,
        army: { ...armyTrainingView.army, training: { ...training, lotKey: '9999:archer:4' } },
      };
      made.api.state.stateVersion += 1;
      await made.controller.session.syncNow();
      return true;
    });
    await made.run('lords.cancelTraining');
    expect(made.orders()).toEqual([]);
    expect(made.toasts().join(' ')).toContain('O lote do pátio mudou');
  });

  it('manter o lote não envia nada', async () => {
    const kept = await setup(armyTrainingView);
    kept.answers.push(false);
    await kept.run('lords.cancelTraining');
    expect(kept.orders()).toEqual([]);
  });
});

describe('dispensar', () => {
  it('sempre confirma: a unidade, a quantidade e a frase', async () => {
    const { run, answers, shown, orders } = await setup(armyIdleView);
    answers.push(0, 1, true);
    await run('lords.disbandSoldiers');
    expect(shown.map((dialog) => dialog.kind)).toEqual(['pick', 'pick', 'confirm']);
    expect(orders()).toEqual([
      { type: 'disbandSoldiers', payload: { unit: 'spearman', amount: 2 } },
    ]);
  });

  it('sem soldados não há o que dispensar', async () => {
    const made = await setup({
      ...armyIdleView,
      army: {
        ...armyIdleView.army,
        units: armyIdleView.army.units.map((unit) => ({ ...unit, count: 0 })),
      },
    });
    await made.run('lords.disbandSoldiers');
    expect(made.shown).toEqual([]);
    expect(made.orders()).toEqual([]);
  });

  it('desistir na confirmação não envia nada', async () => {
    const made = await setup(armyIdleView);
    made.answers.push(0, 0, false);
    await made.run('lords.disbandSoldiers');
    expect(made.orders()).toEqual([]);
  });
});

describe('a intenção do treino', () => {
  it('treinar e cancelar são a mesma intenção; dispensar é por unidade', () => {
    expect(intentOf('trainSoldiers', { unit: 'archer', amount: 2 })).toBe(
      intentOf('cancelTraining', { lotKey: 'k' }),
    );
    expect(intentOf('disbandSoldiers', { unit: 'archer', amount: 1 })).not.toBe(
      intentOf('disbandSoldiers', { unit: 'knight', amount: 1 }),
    );
    expect(intentOf('disbandSoldiers', { unit: 'archer', amount: 1 })).not.toBe(
      intentOf('cancelTraining', { lotKey: 'k' }),
    );
  });

  it('o ataque ao acampamento tem intenção campaign', () => {
    expect(intentOf('attackCamp', { formationId: 'formation-1' })).toBe('campaign');
  });
});

describe('atacar o acampamento (V4F-T3)', () => {
  const WINGS = ['left', 'center', 'right'] as const;
  const LINES = ['front', 'back'] as const;
  const mockFormation = (id: string, name: string): ViewState['army']['formations'][number] => ({
    id,
    name,
    isActive: true,
    previewStale: false,
    total: 6,
    shortfall: [],
    shortfallText: '',
    canDelete: true,
    posts: WINGS.flatMap((wing) =>
      LINES.map((line) => ({
        wing,
        wingLabel: wing,
        line,
        lineLabel: line,
        unit: 'spearman' as const,
        unitLabel: 'Lanceiro',
        count: 1,
        text: '1 lanceiro',
      })),
    ),
    commanders: WINGS.map((wing) => ({
      wing,
      wingLabel: wing,
      heroId: null,
      heroName: null,
      classLabel: null,
    })),
  });

  const readyView: ViewState = {
    ...armyIdleView,
    army: {
      ...armyIdleView.army,
      campAssault: {
        text: 'O exército viaja até o Acampamento de Saqueadores.',
        travelSeconds: 5400,
        totalSeconds: 10800,
        blockedReason: null,
        formations: [
          {
            formationId: 'formation-1',
            canAttack: true,
            blockedReason: null,
          },
        ],
      },
      formations: [mockFormation('formation-1', 'Vanguarda')],
    },
  };

  it('pelo painel: com formationId, confirma com a duração e envia a ordem', async () => {
    const { run, answers, shown, orders } = await setup(readyView);
    answers.push(true);
    await run('lords.attackCamp', { formationId: 'formation-1' });
    expect(shown.map((dialog) => dialog.kind)).toEqual(['confirm']);
    const confirm = shown[0];
    if (confirm?.kind !== 'confirm') {
      throw new Error('esperava a confirmação');
    }
    expect(confirm.detail?.[0]).toContain('O feudo fica sem estes esquadrões por 3 h.');
    expect(orders()).toEqual([{ type: 'attackCamp', payload: { formationId: 'formation-1' } }]);
  });

  it('pela paleta: sem formationId, pergunta a formação e depois confirma', async () => {
    const { run, answers, shown, orders } = await setup(readyView);
    answers.push(0, true);
    await run('lords.attackCamp');
    expect(shown.map((dialog) => dialog.kind)).toEqual(['pick', 'confirm']);
    expect(orders()).toEqual([{ type: 'attackCamp', payload: { formationId: 'formation-1' } }]);
  });

  it('desistir na confirmação não envia nada', async () => {
    const { run, answers, orders } = await setup(readyView);
    answers.push(false);
    await run('lords.attackCamp', { formationId: 'formation-1' });
    expect(orders()).toEqual([]);
  });

  it('com exército já em campanha avisa e não envia', async () => {
    const awayView: ViewState = {
      ...readyView,
      army: {
        ...readyView.army,
        campaign: {
          formationId: 'formation-1',
          formationName: 'Vanguarda',
          tile: 'raiderCamp',
          destination: 'Acampamento',
          phase: 'marching',
          text: 'O exército segue para o Acampamento de Saqueadores.',
          battleInSeconds: 3600,
          returnsInSeconds: 7200,
          reportId: null,
        },
      },
    };
    const { run, toasts, orders } = await setup(awayView);
    await run('lords.attackCamp', { formationId: 'formation-1' });
    expect(toasts()).toContain('O exército segue para o Acampamento de Saqueadores.');
    expect(orders()).toEqual([]);
  });

  it.each(['posts', 'commanders', 'duration', 'availability', 'deleted', 'campaign'] as const)(
    'mudar %s com a confirmação aberta invalida o ataque',
    async (change) => {
      const made = await setup(readyView);
      made.answers.push(async () => {
        const army = structuredClone(readyView.army);
        if (change === 'posts') {
          army.formations[0]!.posts[0]!.count += 1;
        } else if (change === 'commanders') {
          army.formations[0]!.commanders[0]!.heroId = 'hero-2';
          army.formations[0]!.commanders[0]!.heroName = 'Berta';
        } else if (change === 'duration') {
          army.campAssault.totalSeconds += 300;
        } else if (change === 'availability') {
          army.campAssault.formations[0]!.canAttack = false;
          army.campAssault.formations[0]!.blockedReason = 'O comandante já partiu.';
        } else if (change === 'deleted') {
          army.formations = [];
        } else {
          army.campaign = {
            formationId: 'formation-1',
            formationName: 'Vanguarda',
            tile: 'raiderCamp',
            destination: 'Acampamento',
            phase: 'marching',
            text: 'O exército já está em campanha.',
            battleInSeconds: 300,
            returnsInSeconds: 600,
            reportId: null,
          };
        }
        made.api.state.view = { ...readyView, army };
        made.api.state.stateVersion += 1;
        await made.controller.session.syncNow();
        return true;
      });
      await made.run('lords.attackCamp', { formationId: 'formation-1' });
      expect(made.orders()).toEqual([]);
      expect(made.toasts().join(' ')).toMatch(/Nada foi enviado|já partiu|já está em campanha/);
    },
  );

  it('sem disponibilidade explícita da formação na visão, não pede confirmação nem envia', async () => {
    const made = await setup({
      ...readyView,
      army: {
        ...readyView.army,
        campAssault: { ...readyView.army.campAssault, formations: [] },
      },
    });
    made.answers.push(true);
    await made.run('lords.attackCamp', { formationId: 'formation-1' });
    expect(made.shown).toEqual([]);
    expect(made.orders()).toEqual([]);
  });

  it('uma atualização sem mudança na formação ou na duração preserva a confirmação', async () => {
    const made = await setup(readyView);
    made.answers.push(async () => {
      made.api.state.view = structuredClone(readyView);
      made.api.state.stateVersion += 1;
      await made.controller.session.syncNow();
      return true;
    });
    await made.run('lords.attackCamp', { formationId: 'formation-1' });
    expect(made.orders()).toEqual([{ type: 'attackCamp', payload: { formationId: 'formation-1' } }]);
  });
});
