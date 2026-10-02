import { describe, expect, it } from 'vitest';

import { advanceTo } from './advance';
import {
  accept,
  command,
  DAY,
  gameAt,
  gameWith,
  HOUR,
  MINUTE,
  newGame,
  play,
  SPRING,
  WINTER,
} from './test-helpers';
import { nextAutoStartAt, nextEventAt } from './timeline';
import type { GameState } from './types';

describe('nextEventAt', () => {
  it('sem nada em andamento, o próximo evento é a virada de dia', () => {
    const state = gameWith((draft) => {
      draft.settlement.workers.farm = 2;
    });
    expect(nextEventAt(state)).toBe(DAY);
  });

  it('considera o fim da obra', () => {
    const { state } = accept(newGame(), command('startConstruction', { building: 'housing' }));
    expect(nextEventAt(state)).toBe(4 * MINUTE);
  });

  it('considera a chegada do próximo aldeão', () => {
    const { state } = accept(newGame(), command('recruitVillagers', { quantity: 2 }));
    // Na primavera o treinamento leva 16 minutos (20 × 0,8).
    expect(nextEventAt(state)).toBe(16 * MINUTE);
    expect(nextEventAt(advanceTo(state, 16 * MINUTE).state)).toBe(32 * MINUTE);
  });

  it('considera o instante em que a comida acaba', () => {
    // 1 de comida e 5 habitantes sem fazendeiros: 1 / 5 de hora.
    const state = gameWith((draft) => {
      draft.settlement.resources.food = 1000;
    });
    expect(nextEventAt(state)).toBe(HOUR / 5);
  });

  it('no inverno, considera o instante em que a madeira acaba na lareira', () => {
    // 1 de madeira e 5 habitantes queimando 0,5 cada: 1 / 2,5 de hora.
    const state = gameWith((draft) => {
      draft.lastProcessedAt = WINTER;
      draft.clock.gameTimeMs = WINTER;
      draft.settlement.workers.farm = 5;
      draft.settlement.resources.wood = 1000;
    });
    expect(nextEventAt(state)).toBe(WINTER + (2 * HOUR) / 5);
  });

  it('considera a incursão marcada, o aviso da Torre de Vigia e o ferido que sara', () => {
    // Uma incursão marcada para o meio de um dia de verão (no jogo elas caem em viradas).
    const at = 30 * DAY;
    const arrival = at + 90 * MINUTE;
    const hunted = (watchtower: number, edit: (draft: GameState) => void = () => {}) =>
      gameAt(at, (draft) => {
        draft.settlement.workers.farm = 5;
        draft.settlement.buildings.townHall = 2;
        draft.settlement.buildings.watchtower = watchtower;
        draft.horde.scheduledRaids = [
          {
            id: 'threat-1',
            atMs: arrival,
            kind: 'threat',
            enemy: 'wolves',
            size: 'light',
            announcedAtMs: null,
          },
        ];
        edit(draft);
      });
    // Sem Torre não há aviso: o próximo evento é a chegada dos lobos.
    expect(nextEventAt(hunted(0))).toBe(arrival);
    // Com a Torre no nível 1, o aviso soa 1 h de jogo antes; depois dele, só a chegada.
    expect(nextEventAt(hunted(1))).toBe(arrival - HOUR);
    const announced = advanceTo(hunted(1), arrival - HOUR).state;
    expect(announced.horde.scheduledRaids[0]?.announcedAtMs).toBe(arrival - HOUR);
    expect(nextEventAt(announced)).toBe(arrival);
    // O aviso do nível 2 (2 h antes) já teria passado: não é um instante por vir. Quem o dá é
    // o primeiro avanço, no instante em que o estado está.
    expect(nextEventAt(hunted(2))).toBe(arrival);
    expect(advanceTo(hunted(2), at + 1).events.map((event) => event.type)).toEqual([
      'raidAnnounced',
    ]);
    // O ferido sara um dia de jogo depois do ataque: o instante entra na linha do tempo.
    const hit = advanceTo(hunted(0), arrival).state;
    expect(hit.settlement.injured).toEqual([{ untilMs: arrival + DAY, building: 'farm' }]);
    expect(nextEventAt(hit)).toBe(31 * DAY);
    expect(nextEventAt(advanceTo(hit, 31 * DAY).state)).toBe(arrival + DAY);
    // Um prazo que já passou (um estado montado à mão) não vira um instante repetido.
    const stale = hunted(0, (draft) => {
      draft.horde.scheduledRaids = [];
      draft.settlement.workers.farm = 4;
      draft.settlement.injured = [{ untilMs: at - HOUR, building: 'farm' }];
    });
    expect(nextEventAt(stale)).toBe(31 * DAY);
    expect(advanceTo(stale, 31 * DAY).state.settlement.injured).toEqual([]);
  });

  it('fora do inverno a madeira não queima: o próximo evento é a virada de dia', () => {
    const state = gameWith((draft) => {
      draft.settlement.workers.farm = 2;
      draft.settlement.resources.wood = 1000;
    });
    expect(nextEventAt(state)).toBe(DAY);
  });

  it('durante o frio a madeira não tem hora para acabar', () => {
    const state = gameWith((draft) => {
      draft.lastProcessedAt = WINTER;
      draft.clock.gameTimeMs = WINTER;
      draft.settlement.workers.farm = 5;
      draft.settlement.resources.wood = 0;
      draft.settlement.cold = { sinceMs: WINTER };
    });
    expect(nextEventAt(state)).toBe(WINTER + DAY);
  });

  it('ignora a fila de recrutamento enquanto durar a fome', () => {
    const starving = gameWith((draft) => {
      draft.settlement.resources.food = 0;
      draft.settlement.famine = { sinceMs: 0 };
      draft.settlement.recruitmentQueue = [{ finishesAtMs: 20 * MINUTE }];
    });
    expect(nextEventAt(starving)).toBe(DAY);
  });

  describe('o instante em que a produção completa o custo de uma planejada automática', () => {
    // Primavera, cinco lenhadores (40 de madeira por hora), pedra e ouro de sobra e 60 de madeira.
    const camp = (edit: (draft: GameState) => void = () => {}) =>
      gameAt(SPRING, (draft) => {
        draft.settlement.workers.lumberMill = 5;
        draft.settlement.resources = { food: 500_000, wood: 60_000, stone: 400_000, gold: 400_000 };
        edit(draft);
      });
    const auto = (building: 'lumberMill' | 'townHall' | 'farm' | 'housing') =>
      command('planConstruction', { building, autoStart: true });

    it('é evento da linha do tempo: a Serraria (100 de madeira) começa em 1 hora', () => {
      const state = accept(camp(), auto('lumberMill')).state;
      expect(nextAutoStartAt(state)).toBe(HOUR);
      expect(nextEventAt(state)).toBe(HOUR);
      // Depois de começar, o próximo evento é o fim da obra.
      const started = advanceTo(state, HOUR).state;
      expect(nextAutoStartAt(started)).toBeNull();
      expect(nextEventAt(started)).toBe(HOUR + 5 * MINUTE);
    });

    it('entre várias, vale a que chega primeiro, esteja onde estiver na lista', () => {
      // O Salão (150) vem antes na lista e chega em 2 h 15 min; a Serraria (100), em 1 h.
      const state = play(camp(), [auto('townHall'), auto('lumberMill')]).state;
      expect(nextAutoStartAt(state)).toBe(HOUR);
    });

    it('a planejada manual não marca instante nenhum', () => {
      const state = accept(camp(), command('planConstruction', { building: 'lumberMill' })).state;
      expect(nextAutoStartAt(state)).toBeNull();
      expect(nextEventAt(state)).toBe(DAY);
    });

    it('sem fila livre não há instante: quem inicia a obra é o fim da que ocupa a fila', () => {
      const state = accept(
        camp((draft) => {
          draft.settlement.constructionQueues = [
            { building: 'goldMine', targetLevel: 2, startedAtMs: 0, finishesAtMs: 90 * MINUTE },
            null,
          ];
        }),
        auto('lumberMill'),
      ).state;
      expect(nextAutoStartAt(state)).toBeNull();
      expect(nextEventAt(state)).toBe(90 * MINUTE);
      // No fim da obra a madeira já passou dos 100 (60 + 60): a Serraria começa ali.
      const { events } = advanceTo(state, 90 * MINUTE);
      expect(events.map((event) => event.type)).toEqual([
        'constructionFinished',
        'constructionAutoStarted',
      ]);
    });

    it('sem saldo positivo no recurso que falta, ou com o Salão ou o depósito no caminho, não há instante', () => {
      const idle = accept(
        camp((draft) => {
          draft.settlement.workers.lumberMill = 0;
        }),
        auto('lumberMill'),
      ).state;
      expect(nextAutoStartAt(idle)).toBeNull();
      // Fazenda no nível 2 com o Salão no 1: o nível 3 espera o Salão, não a madeira.
      const gated = accept(
        camp((draft) => {
          draft.settlement.buildings.farm = 2;
        }),
        auto('farm'),
      ).state;
      expect(nextAutoStartAt(gated)).toBeNull();
      // O Salão 4 → 5 pede 875 de madeira e o Pátio guarda 500: não adianta esperar.
      const tooBig = accept(
        camp((draft) => {
          draft.settlement.buildings.townHall = 4;
        }),
        auto('townHall'),
      ).state;
      expect(nextAutoStartAt(tooBig)).toBeNull();
    });

    it('a previsão é refeita a cada trecho: a virada de estação muda a taxa, e o instante acompanha', () => {
      // A uma hora do verão, faltando 100 de madeira: 40 na última hora da primavera e 60 no
      // verão, a 48,879 por hora (× 1,15 da estação, × 1,012 dos 4 de experiência que a
      // Serraria ganha na mesma virada e × 1,05 da moral, que a virada leva a 60).
      const start = gameAt(24 * DAY - HOUR, (draft) => {
        draft.settlement.workers.lumberMill = 5;
        draft.settlement.resources = { food: 500_000, wood: 0, stone: 400_000, gold: 400_000 };
      });
      const state = accept(start, auto('lumberMill')).state;
      // Com a taxa da primavera a conta dá 2 h 30 min; a virada chega antes.
      expect(nextAutoStartAt(state)).toBe(24 * DAY - HOUR + 150 * MINUTE);
      expect(nextEventAt(state)).toBe(24 * DAY);
      const summer = advanceTo(state, 24 * DAY).state;
      const expected = 24 * DAY + Math.ceil((60_000 * HOUR) / 48_879);
      expect(nextAutoStartAt(summer)).toBe(expected);
      const { events } = advanceTo(state, 24 * DAY + 2 * HOUR);
      expect(
        events.filter((event) => event.type === 'constructionAutoStarted').map((e) => e.atMs),
      ).toEqual([expected]);
    });
  });

  it('nunca devolve um instante no passado ao longo de 10 dias', () => {
    let state = accept(newGame(), command('recruitVillagers', { quantity: 3 })).state;
    state = accept(state, command('startConstruction', { building: 'farm' })).state;
    while (state.lastProcessedAt < 10 * 24 * HOUR) {
      const next = nextEventAt(state);
      expect(next).not.toBeNull();
      expect(next!).toBeGreaterThanOrEqual(state.lastProcessedAt);
      state = advanceTo(state, Math.max(next!, state.lastProcessedAt + 1)).state;
    }
  });
});
