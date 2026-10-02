import { balance, buildings, RAID_SIZE_IDS, raidSizes } from '@lotg/content';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { advanceTo } from './advance';
import {
  accept,
  apply,
  command,
  DAY,
  eventsOfType,
  gameAt,
  HOUR,
  MINUTE,
  YEAR,
} from './test-helpers';
import { palisadeAgainst, palisadeLevel } from './threat';
import type { GameEvent, GameState, ScheduledRaid, ThreatView } from './types';
import { deriveViewState } from './view';

/**
 * A Paliçada (GDD §6.1 e §8.2; ADR 0014, decisão 11): o que cada nível segura, o que a visão diz
 * disso e o que os vigias dizem dela diante de uma incursão que vem. A obra em si (gate, custo,
 * teto, cancelamento) está em `construction.test.ts`; o desfecho da incursão, com as perdas e os
 * feridos, é da incursão de lobos (V2E-T3).
 */

const { threat: rules } = balance;

/** Um feudo com o Salão no nível 3, a Torre e a Paliçada que o teste pedir. */
function feud(
  atMs: number,
  palisade: number,
  watchtower = 0,
  edit: (draft: GameState) => void = () => {},
): GameState {
  return gameAt(atMs, (draft) => {
    draft.settlement.buildings.townHall = 3;
    draft.settlement.buildings.palisade = palisade;
    draft.settlement.buildings.watchtower = watchtower;
    draft.settlement.resources = { food: 400_000, wood: 400_000, stone: 400_000, gold: 400_000 };
    draft.map.threat = 55;
    edit(draft);
  });
}

const raid = (atMs: number, size: ScheduledRaid['size']): ScheduledRaid => ({
  id: 'threat-1',
  atMs,
  kind: 'threat',
  enemy: 'wolves',
  size,
  announcedAtMs: null,
});

const view = (state: GameState, timeScale = 1): ThreatView =>
  deriveViewState(state, state.lastProcessedAt, { timeScale }).threat;

const HALF = { num: 1, den: 2 };

describe('o que cada nível da Paliçada segura (ADR 0014, decisão 11)', () => {
  it('sem Paliçada, todo ataque passa inteiro', () => {
    for (const size of RAID_SIZE_IDS) {
      expect(palisadeAgainst(0, size)).toEqual({ kind: 'open' });
    }
  });

  it('nível 1: segura as incursões leves; uma média passa com metade do estrago', () => {
    expect(palisadeAgainst(1, 'light')).toEqual({ kind: 'held' });
    expect(palisadeAgainst(1, 'medium')).toEqual({ kind: 'breached', share: HALF });
  });

  it('nível 2: segura as leves e as médias', () => {
    expect(palisadeAgainst(2, 'light')).toEqual({ kind: 'held' });
    expect(palisadeAgainst(2, 'medium')).toEqual({ kind: 'held' });
  });

  it('a matriz inteira vem do conteúdo: um nível nunca segura menos que o anterior', () => {
    expect(rules.palisadeLevels).toHaveLength(buildings.palisade.maxLevel);
    expect(rules.palisadeBreach).toEqual(HALF);
    const rank = { open: 0, breached: 1, held: 2 } as const;
    for (const size of RAID_SIZE_IDS) {
      for (let level = 1; level <= buildings.palisade.maxLevel; level += 1) {
        expect(rank[palisadeAgainst(level, size).kind]).toBeGreaterThanOrEqual(
          rank[palisadeAgainst(level - 1, size).kind],
        );
      }
    }
    // Em cada nível, se um tamanho é segurado, todos os menores também são.
    for (let level = 1; level <= buildings.palisade.maxLevel; level += 1) {
      const kinds = RAID_SIZE_IDS.map((size) => palisadeAgainst(level, size).kind);
      expect(kinds.join(',')).toMatch(/^(held,?)*(breached,?)*$/);
    }
    // Um nível que o conteúdo não descreve não segura nada: não há Muralha nesta versão.
    expect(palisadeAgainst(3, 'light')).toEqual({ kind: 'open' });
  });

  it('o nível é o do edifício, e só muda quando a obra termina', () => {
    const start = feud(10 * DAY, 0);
    expect(palisadeLevel(start)).toBe(0);
    const building = accept(start, command('startConstruction', { building: 'palisade' })).state;
    expect(palisadeLevel(advanceTo(building, 10 * DAY + 20 * MINUTE - 1).state)).toBe(0);
    expect(palisadeLevel(advanceTo(building, 10 * DAY + 20 * MINUTE).state)).toBe(1);
  });

  it('a Paliçada não mexe na Ameaça nem na economia: o feudo com ela e o feudo sem ela seguem iguais', () => {
    // Nada a danifica e ela não produz nada: fora o nível, os dois estados coincidem depois de
    // 30 dias de jogo, com os mesmos eventos.
    for (const level of [1, 2]) {
      const without = advanceTo(feud(3 * DAY, 0, 1), 33 * DAY);
      const fenced = advanceTo(feud(3 * DAY, level, 1), 33 * DAY);
      expect(fenced.state.settlement.buildings.palisade).toBe(level);
      expect(fenced.state.map).toEqual(without.state.map);
      expect(fenced.state.settlement.resources).toEqual(without.state.settlement.resources);
      expect(fenced.events).toEqual(without.events);
    }
  });
});

describe('o que protege o feudo, na visão (`threat.defense`)', () => {
  it('sem Paliçada: nada segura um ataque, e a frase seguinte diz o que a obra daria', () => {
    expect(view(feud(10 * DAY, 0)).defense).toEqual({
      building: 'palisade',
      palisadeLevel: 0,
      text: 'Sem Paliçada, nada segura um ataque.',
      next: 'Paliçada Nv1: segura ataques leves, sem perda nem ferido; os médios passam, mas com metade do estrago.',
    });
  });

  it('nível 1: diz o que segura, o que ainda passa, e o que o nível 2 muda', () => {
    expect(view(feud(10 * DAY, 1)).defense).toEqual({
      building: 'palisade',
      palisadeLevel: 1,
      text: 'Paliçada Nv1: segura ataques leves, sem perda nem ferido; os médios passam, mas com metade do estrago.',
      next: 'Paliçada Nv2: passa a segurar também os ataques médios, sem perda nem ferido.',
    });
  });

  it('nível 2: segura os dois tamanhos e diz que a Muralha de Pedra fica para depois, sem prometer data', () => {
    const { defense } = view(feud(10 * DAY, 2));
    expect(defense).toEqual({
      building: 'palisade',
      palisadeLevel: 2,
      text: 'Paliçada Nv2: segura ataques leves e médios, sem perda nem ferido. A Muralha de Pedra chega em uma versão futura.',
      next: null,
    });
    expect(defense.text).not.toMatch(/\d{2,}|v0|breve|semana|mês/);
  });

  it('é a mesma frase com ou sem Torre de Vigia: a Paliçada é do feudo, e o jogador a conhece', () => {
    for (const level of [0, 1, 2]) {
      const blind = view(feud(10 * DAY, level, 0));
      const watched = view(feud(10 * DAY, level, 2));
      expect(blind.known).toBe(false);
      expect(watched.known).toBe(true);
      expect(blind.defense).toEqual(watched.defense);
    }
  });

  it('não depende do ritmo: a frase não tem prazo', () => {
    for (const level of [0, 1, 2]) {
      const state = feud(10 * DAY, level, 1);
      expect(view(state, 3).defense).toEqual(view(state, 1).defense);
      expect(view(state, 0.5).defense).toEqual(view(state, 1).defense);
    }
  });

  it('a Paliçada em obras ainda não segura nada; pronta, segura no mesmo instante', () => {
    const state = accept(
      feud(10 * DAY, 0),
      command('startConstruction', { building: 'palisade' }),
    ).state;
    const done = 10 * DAY + 20 * MINUTE;
    expect(deriveViewState(state, done - 1).threat.defense.palisadeLevel).toBe(0);
    expect(deriveViewState(state, done).threat.defense).toMatchObject({
      palisadeLevel: 1,
      text: 'Paliçada Nv1: segura ataques leves, sem perda nem ferido; os médios passam, mas com metade do estrago.',
    });
  });

  it('não promete o que a versão não tem: nem inimigo humano, nem dano, nem reparo', () => {
    for (const level of [0, 1, 2]) {
      const { defense } = view(feud(10 * DAY, level, 2));
      for (const text of [defense.text, defense.next ?? '']) {
        expect(text).not.toMatch(/saqueador|bandido|homens|ex[ée]rcito|HP|dano|repar|cerco|Horda/i);
      }
    }
  });

  it('os nomes dos tamanhos são os do conteúdo', () => {
    expect(view(feud(10 * DAY, 1)).defense.text).toContain(`ataques ${raidSizes.light.plural}`);
    expect(view(feud(10 * DAY, 1)).defense.text).toContain(`os ${raidSizes.medium.plural}`);
  });
});

describe('a incursão à vista e a Paliçada (`threat.incoming.defenseText`)', () => {
  const arrival = 20 * DAY + 3 * HOUR;
  const hunted = (palisade: number, watchtower: number, size: ScheduledRaid['size']) =>
    feud(arrival - 30 * MINUTE, palisade, watchtower, (draft) => {
      draft.horde.scheduledRaids = [raid(arrival, size)];
    });
  const told = (palisade: number, watchtower: number, size: ScheduledRaid['size']) =>
    view(hunted(palisade, watchtower, size)).incoming?.defenseText;

  it('com a Torre no nível 2 os vigias dizem o tamanho, e a frase diz o que a Paliçada faz a ele', () => {
    expect(told(0, 2, 'light')).toBe('Sem Paliçada, nada segura este ataque.');
    expect(told(0, 2, 'medium')).toBe('Sem Paliçada, nada segura este ataque.');
    expect(told(1, 2, 'light')).toBe('A Paliçada Nv1 segura este ataque: sem perda nem ferido.');
    expect(told(1, 2, 'medium')).toBe(
      'A Paliçada Nv1 não segura um ataque deste tamanho: ele passa, mas com metade do estrago.',
    );
    expect(told(2, 2, 'light')).toBe('A Paliçada Nv2 segura este ataque: sem perda nem ferido.');
    expect(told(2, 2, 'medium')).toBe('A Paliçada Nv2 segura este ataque: sem perda nem ferido.');
  });

  it('a frase é a regra: o que ela diz é o que `palisadeAgainst` responde', () => {
    for (const level of [0, 1, 2]) {
      for (const size of RAID_SIZE_IDS) {
        const text = told(level, 2, size) ?? '';
        const outcome = palisadeAgainst(level, size).kind;
        expect(text.includes('segura este ataque: sem perda'), `${level}/${size}`).toBe(
          outcome === 'held',
        );
        expect(text.includes('ele passa'), `${level}/${size}`).toBe(outcome === 'breached');
        expect(text.startsWith('Sem Paliçada'), `${level}/${size}`).toBe(outcome === 'open');
      }
    }
  });

  it('com a Torre no nível 1 o tamanho não se vê, e a frase não o entrega: é a mesma para uma incursão leve e para uma média', () => {
    for (const level of [0, 1, 2]) {
      const light = view(hunted(level, 1, 'light'));
      const medium = view(hunted(level, 1, 'medium'));
      expect(light.incoming?.sizeText).toBeNull();
      expect(light, `Paliçada ${level}`).toEqual(medium);
    }
    // Com a obra da Paliçada em curso, também: o que muda a frase é a obra, não o tamanho.
    for (const level of [0, 1]) {
      const building = (size: ScheduledRaid['size']) =>
        view(
          accept(hunted(level, 1, size), command('startConstruction', { building: 'palisade' }))
            .state,
        );
      expect(building('light'), `Paliçada ${level} em obras`).toEqual(building('medium'));
    }
    expect(told(0, 1, 'medium')).toBe('Sem Paliçada, nada segura este ataque.');
    expect(told(1, 1, 'medium')).toBe(
      'A Paliçada Nv1 segura este ataque se ele for dos leves; se for dos médios, ele passa, mas com metade do estrago.',
    );
    // No nível 2 nem é preciso saber o tamanho: ela segura os dois.
    expect(told(2, 1, 'medium')).toBe('A Paliçada Nv2 segura este ataque: sem perda nem ferido.');
  });

  it('sem Torre não há incursão à vista, com Paliçada ou sem: a visão inteira é a mesma com os lobos à porta', () => {
    for (const level of [0, 1, 2]) {
      const at = arrival - 30 * MINUTE;
      const calm = feud(at, level, 0);
      const hunting = hunted(level, 0, 'medium');
      expect(view(hunting).incoming).toBeNull();
      expect(deriveViewState(hunting, at)).toEqual(deriveViewState(calm, at));
    }
  });

  it('a Paliçada que fica pronta com os lobos à vista muda a frase no instante em que termina', () => {
    // A Torre no nível 2 avisa 2 h de jogo antes; a Paliçada leva 20 min: dá tempo.
    const warned = feud(arrival - 2 * HOUR, 0, 2, (draft) => {
      draft.horde.scheduledRaids = [raid(arrival, 'light')];
    });
    expect(view(warned).incoming).toMatchObject({
      inSeconds: 7200,
      defenseText: 'Sem Paliçada, nada segura este ataque.',
    });
    // Dada a ordem, a frase já responde à pergunta de quem a deu: dá tempo.
    const building = accept(warned, command('startConstruction', { building: 'palisade' })).state;
    const done = arrival - 2 * HOUR + 20 * MINUTE;
    expect(view(building).incoming?.defenseText).toBe(
      'A Paliçada Nv1, que fica pronta a tempo, segura este ataque: sem perda nem ferido.',
    );
    expect(deriveViewState(building, done - 1).threat.incoming?.defenseText).toBe(
      'A Paliçada Nv1, que fica pronta a tempo, segura este ataque: sem perda nem ferido.',
    );
    // A defesa de hoje continua dizendo o que existe hoje: a obra ainda não segura nada.
    expect(deriveViewState(building, done - 1).threat.defense.palisadeLevel).toBe(0);
    expect(deriveViewState(building, done).threat.incoming).toMatchObject({
      inSeconds: 6000,
      defenseText: 'A Paliçada Nv1 segura este ataque: sem perda nem ferido.',
    });
  });

  it('a obra que não termina antes do ataque não conta, e a frase avisa; a que termina no instante exato conta', () => {
    // A Paliçada leva 20 min de jogo: mandada erguer a 10 min do ataque, chega tarde.
    const late = accept(
      feud(arrival - 10 * MINUTE, 0, 2, (draft) => {
        draft.horde.scheduledRaids = [raid(arrival, 'light')];
      }),
      command('startConstruction', { building: 'palisade' }),
    ).state;
    expect(view(late).incoming?.defenseText).toBe(
      'Sem Paliçada, nada segura este ataque. A obra em curso só termina depois dele.',
    );
    // Mandada erguer a exatos 20 min do ataque, termina no instante dele: conta.
    const exact = accept(
      feud(arrival - 20 * MINUTE, 0, 2, (draft) => {
        draft.horde.scheduledRaids = [raid(arrival, 'light')];
      }),
      command('startConstruction', { building: 'palisade' }),
    ).state;
    expect(view(exact).incoming?.defenseText).toBe(
      'A Paliçada Nv1, que fica pronta a tempo, segura este ataque: sem perda nem ferido.',
    );
    expect(palisadeLevel(advanceTo(exact, arrival).state)).toBe(1);
  });

  it('a melhoria em curso também conta: o nível 2 a tempo segura a incursão média; atrasado, vale o nível 1', () => {
    const upgrading = (minutesBefore: number, watchtower: number) =>
      accept(
        feud(arrival - minutesBefore * MINUTE, 1, watchtower, (draft) => {
          draft.horde.scheduledRaids = [raid(arrival, 'medium')];
        }),
        command('startConstruction', { building: 'palisade' }),
      ).state;
    // O nível 2 leva 30 min de jogo.
    expect(view(upgrading(45, 2)).incoming?.defenseText).toBe(
      'A Paliçada Nv2, que fica pronta a tempo, segura este ataque: sem perda nem ferido.',
    );
    expect(view(upgrading(15, 2)).incoming?.defenseText).toBe(
      'A Paliçada Nv1 não segura um ataque deste tamanho: ele passa, mas com metade do estrago. A obra em curso só termina depois dele.',
    );
    // Sem o tamanho à vista (Torre no nível 1), a frase do atraso cobre os dois tamanhos.
    expect(view(upgrading(15, 1)).incoming?.defenseText).toBe(
      'A Paliçada Nv1 segura este ataque se ele for dos leves; se for dos médios, ele passa, mas com metade do estrago. A obra em curso só termina depois dele.',
    );
  });
});

describe('a Paliçada e a ordem do mesmo instante', () => {
  // A incursão resolve-se depois das obras concluídas: a Paliçada que termina no instante exato
  // do ataque já conta, e o repele. Os vigias da Torre (nível 2) já tinham dado o alarme: no
  // cenário, na primeira coisa que acontece, porque o feudo nasce dentro da antecedência.
  const arrival = 21 * DAY;
  const racing = (finishesAtMs: number, targetLevel = 1) =>
    feud(arrival - 20 * MINUTE, targetLevel - 1, 2, (draft) => {
      draft.horde.scheduledRaids = [raid(arrival, targetLevel === 1 ? 'light' : 'medium')];
      draft.settlement.constructionQueues[0] = {
        building: 'palisade',
        targetLevel,
        startedAtMs: arrival - 20 * MINUTE,
        finishesAtMs,
      };
    });

  it('a obra que termina no instante da incursão já vale nele: o nível subiu antes da virada do dia', () => {
    const { state, events } = advanceTo(racing(arrival), arrival);
    const types = events.map((event) => event.type);
    expect(types).toEqual(['raidAnnounced', 'buildingFounded', 'dayStarted', 'raidRepelled']);
    expect(palisadeLevel(state)).toBe(1);
    expect(palisadeAgainst(palisadeLevel(state), 'light')).toEqual({ kind: 'held' });
    expect(view(state).defense.palisadeLevel).toBe(1);
  });

  it('um milissegundo depois já é tarde: no instante da incursão a Paliçada ainda não existe', () => {
    const { state, events } = advanceTo(racing(arrival + 1), arrival);
    expect(palisadeLevel(state)).toBe(0);
    expect(palisadeAgainst(palisadeLevel(state), 'light')).toEqual({ kind: 'open' });
    expect(events.map((event) => event.type)).toEqual([
      'raidAnnounced',
      'dayStarted',
      'raidSuffered',
      'villagerInjured',
    ]);
  });

  it('vale também para a melhoria: o nível 2 que termina na hora segura a incursão média', () => {
    const before = advanceTo(racing(arrival, 2), arrival - 1).state;
    expect(palisadeAgainst(palisadeLevel(before), 'medium').kind).toBe('breached');
    const { state, events } = advanceTo(racing(arrival, 2), arrival);
    expect(events.map((event) => event.type)).toEqual([
      'raidAnnounced',
      'constructionFinished',
      'dayStarted',
      'raidRepelled',
    ]);
    expect(palisadeAgainst(palisadeLevel(state), 'medium')).toEqual({ kind: 'held' });
  });
});

describe('a divisão de intervalo continua exata com a Paliçada', () => {
  it('estado e eventos iguais, com a obra em curso, planejada como automática ou já erguida', () => {
    fc.assert(
      fc.property(
        fc.record({
          startMs: fc.integer({ min: 0, max: YEAR + 10 * DAY }),
          palisade: fc.integer({ min: 0, max: 2 }),
          watchtower: fc.integer({ min: 0, max: 2 }),
          townHall: fc.integer({ min: 2, max: 4 }),
          order: fc.constantFrom('none', 'start', 'plan'),
          cuts: fc.array(fc.integer({ min: 1, max: 6 * DAY }), { minLength: 2, maxLength: 4 }),
        }),
        ({ startMs, palisade, watchtower, townHall, order, cuts }) => {
          let start = feud(startMs, palisade, watchtower, (draft) => {
            draft.settlement.buildings.townHall = townHall;
            draft.settlement.workers = { farm: 2, lumberMill: 2, quarry: 1, goldMine: 0 };
            // Madeira e pedra aquém do custo: a planejada automática espera o estoque chegar lá.
            draft.settlement.resources = {
              food: 300_000,
              wood: order === 'plan' ? 90_000 : 400_000,
              stone: order === 'plan' ? 20_000 : 400_000,
              gold: 300_000,
            };
          });
          const cmd =
            order === 'start'
              ? command('startConstruction', { building: 'palisade' })
              : command('planConstruction', { building: 'palisade', autoStart: true });
          if (order !== 'none') {
            // A ordem pode ser recusada (o Salão abaixo do nível 3, a Paliçada no teto): o
            // estado segue como estava, e a propriedade vale do mesmo jeito.
            const result = apply(start, cmd);
            start = result.ok ? result.state : start;
          }
          const stops = [...new Set(cuts)].sort((a, b) => a - b).map((cut) => startMs + cut);
          const end = stops[stops.length - 1] as number;
          const direct = advanceTo(start, end);
          let state = start;
          const events: GameEvent[] = [];
          for (const stop of stops) {
            const step = advanceTo(state, stop);
            state = step.state;
            events.push(...step.events);
          }
          expect(state).toStrictEqual(direct.state);
          expect(events).toStrictEqual(direct.events);
          expect(direct.state.settlement.buildings.palisade).toBeLessThanOrEqual(
            buildings.palisade.maxLevel,
          );
          // A Paliçada nunca sobe sem o Salão no nível 3.
          if (townHall < 3) {
            expect(direct.state.settlement.buildings.palisade).toBe(palisade);
          }
          expect(eventsOfType(direct.events, 'buildingFounded').length).toBeLessThanOrEqual(1);
        },
      ),
      { numRuns: 60 },
    );
  });
});
