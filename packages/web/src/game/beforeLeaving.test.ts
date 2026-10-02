import type { ViewState } from '@lotg/protocol';
import { describe, expect, it } from 'vitest';

import {
  activeConstruction,
  autumnView,
  coldView,
  craftsView,
  FOOD_RUNS_OUT_AHEAD,
  impoverishedView,
  initialView,
  proudView,
  queuesView,
  unlockedView,
  winterWith,
  withFoodAhead,
  withPlanned,
  withQueues,
  withResource,
  withUpgrade,
} from '../test-helpers';
import { beforeLeaving, type LeavingItem, MAX_LEAVING_ITEMS } from './beforeLeaving';

const HOUR = 3600;

/**
 * Um feudo sem nada a preparar: ninguém livre, comida e depósitos com folga e uma obra planejada
 * que começa sozinha quando a madeira chegar. Cada teste estraga uma coisa só.
 */
const prepared = withPlanned(unlockedView, [
  {
    building: 'farm',
    autoStart: true,
    waiting: { reason: 'resources', text: 'espera 59 de madeira', etaSeconds: 2 * HOUR },
  },
]);

const ids = (items: LeavingItem[]) => items.map((item) => item.id);
const only = (view: ViewState): LeavingItem => {
  const items = beforeLeaving(view);
  expect(ids(items)).toHaveLength(1);
  return items[0] as LeavingItem;
};

describe('antes de partir', () => {
  it('com tudo em ordem, não há o que preparar', () => {
    expect(beforeLeaving(prepared)).toEqual([]);
  });

  describe('comida', () => {
    const hungry = (seconds: number) =>
      withResource(prepared, 'food', {
        perHour: -5,
        depletesInSeconds: seconds,
        fullInSeconds: null,
      });

    it('acaba antes de um dia: diz em quanto tempo, o saldo e leva à Fazenda', () => {
      expect(only(hungry(9 * HOUR))).toEqual({
        id: 'food',
        severity: 'warning',
        text: 'A comida acaba em 9 h: saldo de −5/h.',
        command: { id: 'lords.allocateWorkers', arg: 'farm', label: 'Alocar na Fazenda' },
      });
    });

    it('acaba antes de uma ausência comum: é urgente', () => {
      expect(only(hungry(3 * HOUR))).toMatchObject({
        severity: 'danger',
        text: 'A comida acaba em 3 h: saldo de −5/h.',
      });
      expect(only(hungry(8 * HOUR - 1)).severity).toBe('danger');
      expect(only(hungry(8 * HOUR)).severity).toBe('warning');
    });

    it('com um dia ou mais de comida, nada a dizer', () => {
      expect(beforeLeaving(hungry(24 * HOUR))).toEqual([]);
      expect(beforeLeaving(hungry(36 * HOUR))).toEqual([]);
      expect(only(hungry(24 * HOUR - 1)).id).toBe('food');
    });

    it('a fome em andamento é o primeiro item, com o tempo que já dura', () => {
      const [first] = beforeLeaving(impoverishedView);
      expect(first).toEqual({
        id: 'food',
        severity: 'danger',
        text: 'A fome já dura 40 h: saldo de comida de −3/h.',
        command: { id: 'lords.allocateWorkers', arg: 'farm', label: 'Alocar na Fazenda' },
      });
    });
  });

  describe('comida, do outro lado da virada de estação', () => {
    const farm = { id: 'lords.allocateWorkers', arg: 'farm', label: 'Alocar na Fazenda' };
    /** A comida cresce com a estação de agora: o prazo da linha não tem o que dizer. */
    const growing = withResource(prepared, 'food', { perHour: 9, depletesInSeconds: null });
    const season = prepared.calendar.nextSeason.label;

    it('cresce agora e acaba depois da virada: a estação, o saldo que vem, o prazo e a Fazenda', () => {
      expect(only(withFoodAhead(growing, FOOD_RUNS_OUT_AHEAD, HOUR))).toEqual({
        id: 'food',
        severity: 'warning',
        text: `${season} em 1 h: o saldo de comida passa a −18,5/h, e ela acaba em 8 h.`,
        command: farm,
      });
    });

    it('acaba antes de uma ausência comum: é urgente; a um dia ou mais, nada a dizer', () => {
      const within = (seconds: number | null) =>
        withFoodAhead(growing, { ...FOOD_RUNS_OUT_AHEAD, depletesInSeconds: seconds }, HOUR);
      expect(only(within(8 * HOUR - 1)).severity).toBe('danger');
      expect(only(within(24 * HOUR - 1)).severity).toBe('warning');
      expect(beforeLeaving(within(24 * HOUR))).toEqual([]);
      // A comida atravessa a estação que vem: a previsão não tem prazo.
      expect(beforeLeaving(within(null))).toEqual([]);
    });

    it('caindo devagar agora e depressa depois da virada: vale o prazo da previsão', () => {
      // Pela taxa do outono seriam 40 h; a virada, daqui a uma hora, muda a conta.
      const slow = withResource(prepared, 'food', { perHour: -1, depletesInSeconds: 40 * HOUR });
      expect(beforeLeaving(withFoodAhead(slow, null, HOUR))).toEqual([]);
      expect(
        only(withFoodAhead(slow, { ...FOOD_RUNS_OUT_AHEAD, depletesInSeconds: 5 * HOUR }, HOUR)),
      ).toEqual({
        id: 'food',
        severity: 'danger',
        text: `${season} em 1 h: o saldo de comida passa a −18,5/h, e ela acaba em 5 h.`,
        command: farm,
      });
    });

    it('acabando antes da virada, o prazo é o de agora', () => {
      const soon = withResource(prepared, 'food', { perHour: -5, depletesInSeconds: 3 * HOUR });
      expect(only(withFoodAhead(soon, FOOD_RUNS_OUT_AHEAD, 10 * HOUR)).text).toBe(
        'A comida acaba em 3 h: saldo de −5/h.',
      );
    });
  });

  describe('lenha', () => {
    /** O outono do golden, a quatro horas do inverno, sem mais nada a preparar. */
    const autumn = withPlanned({ ...autumnView, constructions: prepared.constructions }, [
      {
        building: 'farm',
        autoStart: true,
        waiting: { reason: 'resources', text: 'espera 59 de madeira', etaSeconds: 2 * HOUR },
      },
    ]);
    const firewood = (item: LeavingItem | undefined) => item?.id === 'firewood';

    it('inverno a menos de um dia e lenha que não chega: a conta e a Serraria', () => {
      expect(beforeLeaving(autumn).find(firewood)).toEqual({
        id: 'firewood',
        severity: 'warning',
        text: 'Inverno em 4 h: 18 habitantes vão queimar 9 madeira/h, e faltam 156 de madeira para a estação inteira.',
        command: { id: 'lords.allocateWorkers', arg: 'lumberMill', label: 'Alocar na Serraria' },
      });
    });

    it('inverno longe, ou com lenha que basta: nada a dizer', () => {
      const far: ViewState = {
        ...autumn,
        calendar: {
          ...autumn.calendar,
          nextSeason: { ...autumn.calendar.nextSeason, secondsUntil: 24 * HOUR },
        },
      };
      expect(beforeLeaving(far).some(firewood)).toBe(false);
      const { firewood: forecast } = autumn.calendar.nextSeason;
      const enough: ViewState = {
        ...autumn,
        calendar: {
          ...autumn.calendar,
          nextSeason: {
            ...autumn.calendar.nextSeason,
            firewood: forecast === null ? null : { ...forecast, missing: 0 },
          },
        },
      };
      expect(beforeLeaving(enough).some(firewood)).toBe(false);
      // No golden dos ofícios o inverno está longe e a Serraria dá conta.
      expect(beforeLeaving(craftsView).some(firewood)).toBe(false);
    });

    it('no inverno, a madeira com prazo para acabar: o prazo, a lareira e o que falta', () => {
      const lit = winterWith({ stock: 90, missing: 59, depletesInSeconds: 10 * HOUR });
      expect(beforeLeaving(lit).find(firewood)).toEqual({
        id: 'firewood',
        severity: 'warning',
        text: 'A lenha acaba em 10 h: a lareira queima 9 madeira/h e faltam 59 de madeira para o resto da estação.',
        command: { id: 'lords.allocateWorkers', arg: 'lumberMill', label: 'Alocar na Serraria' },
      });
      const soon = winterWith({ stock: 40, missing: 109, depletesInSeconds: 4 * HOUR });
      expect(beforeLeaving(soon).find(firewood)?.severity).toBe('danger');
    });

    it('no inverno, com lenha até a primavera, a madeira caindo não é alarme', () => {
      const enough = winterWith({ stock: 400, missing: 0, depletesInSeconds: 20 * HOUR });
      expect(beforeLeaving(enough).some(firewood)).toBe(false);
    });

    it('o frio em andamento é urgente e diz há quanto tempo', () => {
      expect(beforeLeaving(coldView).find(firewood)).toEqual({
        id: 'firewood',
        severity: 'danger',
        text: 'O frio já dura 50 min: a lareira pede 9 madeira/h e faltam 149 de madeira para o resto da estação.',
        command: { id: 'lords.allocateWorkers', arg: 'lumberMill', label: 'Alocar na Serraria' },
      });
    });
  });

  describe('depósitos', () => {
    it('cheio em menos de 8 h: o prazo, o que acontece e a obra do depósito', () => {
      const filling = withUpgrade(
        withResource(prepared, 'wood', { fullInSeconds: 3 * HOUR }),
        'warehouse',
        { blockedCode: null, blockedReason: null },
      );
      expect(only(filling)).toEqual({
        id: 'storage:warehouse',
        severity: 'warning',
        text: 'Pátio: madeira no limite em 3 h. O que passar disso vai ao chão.',
        command: { id: 'lords.build', arg: 'warehouse', label: 'Construir Armazém' },
      });
    });

    it('a 8 h ou mais de encher, nada a dizer', () => {
      expect(beforeLeaving(withResource(prepared, 'wood', { fullInSeconds: 8 * HOUR }))).toEqual(
        [],
      );
    });

    it('a madeira e a pedra dividem o depósito: um item, um botão', () => {
      const both = withResource(
        withResource(prepared, 'wood', { fullInSeconds: 3 * HOUR }),
        'stone',
        { fullInSeconds: 5 * HOUR },
      );
      const item = only(both);
      expect(item.id).toBe('storage:warehouse');
      expect(item.text).toBe(
        'Pátio: madeira no limite em 3 h e pedra no limite em 5 h. O que passar disso vai ao chão.',
      );
    });

    it('com a obra do depósito travada, o botão leva ao feudo, onde está o motivo', () => {
      // No golden o Armazém ainda não pode ser erguido: faltam recursos.
      const item = only(withResource(prepared, 'wood', { fullInSeconds: 3 * HOUR }));
      expect(item.command).toEqual({
        id: 'lords.openPanel',
        arg: 'fief',
        label: 'Ver os depósitos',
      });
    });

    it('um depósito que já existe é ampliado, não construído', () => {
      const filling = withResource(craftsView, 'food', { fullInSeconds: 2 * HOUR });
      expect(beforeLeaving(filling).find((item) => item.id === 'storage:granary')).toMatchObject({
        text: 'Celeiro: comida no limite em 2 h. O que passar disso vai ao chão.',
        command: { id: 'lords.build', arg: 'granary', label: 'Ampliar Celeiro' },
      });
    });

    it('cheio e perdendo: quanto vai ao chão por hora, um item por depósito', () => {
      const items = beforeLeaving(proudView);
      expect(items.filter((item) => item.id.startsWith('storage:'))).toEqual([
        {
          id: 'storage:granary',
          severity: 'warning',
          text: 'Despensa no limite: 64,8/h de comida vão ao chão.',
          command: { id: 'lords.build', arg: 'granary', label: 'Construir Celeiro' },
        },
        {
          id: 'storage:warehouse',
          severity: 'warning',
          text: 'Pátio no limite: 67,3/h de madeira e 35/h de pedra vão ao chão.',
          command: { id: 'lords.build', arg: 'warehouse', label: 'Construir Armazém' },
        },
      ]);
    });

    it('com a obra do depósito em curso e pronta antes de ele encher, está preparado', () => {
      const building = withQueues(withResource(prepared, 'wood', { fullInSeconds: 3 * HOUR }), [
        activeConstruction({ building: 'warehouse', label: 'Armazém', targetLevel: 1 }),
      ]);
      expect(beforeLeaving(building)).toEqual([]);
      // Se a obra só termina depois de o depósito encher, o aviso fica, com o prazo dela.
      const late = withQueues(withResource(prepared, 'wood', { fullInSeconds: 600 }), [
        activeConstruction({ building: 'warehouse', label: 'Armazém', targetLevel: 1 }),
      ]);
      expect(only(late)).toEqual({
        id: 'storage:warehouse',
        severity: 'warning',
        text: 'Pátio: madeira no limite em 10 min. O que passar disso vai ao chão. A obra de Armazém termina em 42 min.',
        command: { id: 'lords.openPanel', arg: 'fief', label: 'Ver os depósitos' },
      });
    });
  });

  describe('obras', () => {
    const idle = { ...prepared, constructions: unlockedView.constructions };

    it('pedreiros livres e nada planejado: planejar', () => {
      expect(only(idle)).toEqual({
        id: 'queue',
        severity: 'info',
        text: 'Os pedreiros estão livres e nenhuma obra começa sozinha.',
        command: { id: 'lords.planConstruction', label: 'Planejar obras' },
      });
    });

    it('planejadas só manuais: ligar o início automático', () => {
      expect(only(withPlanned(idle, [{ building: 'farm' }]))).toEqual({
        id: 'queue',
        severity: 'info',
        text: 'Os pedreiros estão livres e a obra planejada não começa sozinha.',
        command: { id: 'lords.toggleAutoStart', label: 'Ligar o início automático' },
      });
      expect(only(withPlanned(idle, [{ building: 'farm' }, { building: 'housing' }])).text).toBe(
        'Os pedreiros estão livres e nenhuma das 2 obras planejadas começa sozinha.',
      );
    });

    it('uma fila livre de duas, sem automática: a fila parada é dita', () => {
      const [first] = queuesView.constructions.queues;
      const oneFree = withPlanned(withQueues(queuesView, [first ?? null, null]), []);
      expect(beforeLeaving(oneFree).find((item) => item.id === 'queue')?.text).toBe(
        'Há uma fila de obras livre e nenhuma obra começa sozinha.',
      );
    });

    it('filas ocupadas, obra que termina antes de uma ausência comum e nada depois', () => {
      const busy = withQueues(idle, [activeConstruction()]);
      expect(only(busy)).toEqual({
        id: 'queue',
        severity: 'info',
        text: 'A obra de Serraria termina em 42 min e nenhuma começa depois dela.',
        command: { id: 'lords.planConstruction', label: 'Planejar obras' },
      });
      const long = withQueues(idle, [activeConstruction({ secondsRemaining: 8 * HOUR })]);
      expect(beforeLeaving(long)).toEqual([]);
    });

    it('com uma automática à espera de algo que chega, está preparado', () => {
      expect(beforeLeaving(queuesView).some((item) => item.id === 'queue')).toBe(false);
    });

    it('automática que esperar não resolve: diz o que a trava', () => {
      const stuck: ViewState = {
        ...queuesView,
        constructions: {
          ...queuesView.constructions,
          planned: queuesView.constructions.planned.filter(
            (plan) => plan.waiting?.etaSeconds === null,
          ),
        },
      };
      expect(beforeLeaving(stuck).find((item) => item.id === 'queue')).toEqual({
        id: 'queue',
        severity: 'info',
        text: 'Salão do Senhor Nv4 → Nv5 não começa sozinha (não cabe no Pátio: construa o Armazém).',
        command: { id: 'lords.openPanel', arg: 'fief', label: 'Ver as planejadas' },
      });
    });

    it('sem obra nenhuma a oferecer, não há o que planejar', () => {
      const nothing: ViewState = {
        ...idle,
        constructions: { ...idle.constructions, available: [] },
      };
      expect(beforeLeaving(nothing)).toEqual([]);
    });
  });

  describe('aldeões livres', () => {
    const withFree = (free: number): ViewState => ({
      ...prepared,
      population: { ...prepared.population, free },
    });

    it('quem está sem ofício é o último item', () => {
      expect(only(withFree(3))).toEqual({
        id: 'idle',
        severity: 'info',
        text: '3 aldeões livres, sem ofício.',
        command: { id: 'lords.allocateWorkers', label: 'Alocar trabalhadores' },
      });
      expect(only(withFree(1)).text).toBe('1 aldeão livre, sem ofício.');
    });
  });

  it('o feudo recém-fundado: planejar uma obra e dar ofício aos cinco', () => {
    // A comida dura 36 horas: ainda não é assunto.
    expect(ids(beforeLeaving(initialView))).toEqual(['queue', 'idle']);
  });

  it('a ordem é a da urgência, e a lista para em cinco', () => {
    // Fome, frio, os dois depósitos cheios, pedreiros livres e três aldeões sem ofício.
    const everything: ViewState = {
      ...impoverishedView,
      resources: impoverishedView.resources.map((row) => {
        const full = proudView.resources.find((entry) => entry.id === row.id);
        return row.id === 'stone' && full !== undefined ? full : row;
      }),
    };
    const worst = withResource(everything, 'food', {
      full: true,
      wastingPerHour: 12,
    });
    const items = beforeLeaving(worst);
    expect(ids(items)).toEqual([
      'food',
      'firewood',
      'storage:granary',
      'storage:warehouse',
      'queue',
    ]);
    expect(items).toHaveLength(MAX_LEAVING_ITEMS);
    expect(items.map((item) => item.severity)).toEqual([
      'danger',
      'danger',
      'warning',
      'warning',
      'info',
    ]);
    // O sexto, os aldeões livres, ficou de fora: é o menos urgente.
    expect(worst.population.free).toBeGreaterThan(0);
  });

  it('todo item tem uma ação', () => {
    for (const view of [
      initialView,
      impoverishedView,
      proudView,
      coldView,
      autumnView,
      queuesView,
    ]) {
      for (const item of beforeLeaving(view)) {
        expect(item.command.label).not.toBe('');
        expect(item.command.id.startsWith('lords.')).toBe(true);
      }
    }
  });
});
