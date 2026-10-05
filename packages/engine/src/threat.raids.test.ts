import { balance, buildings, raidTemplates, RAID_SIZE_IDS } from '@lotg/content';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { advanceTo } from './advance';
import { applyCommand } from './commands';
import { ableVillagers, assignedWorkers, freeVillagers } from './population';
import { scriptedRaidsAfter } from './raids';
import {
  accept,
  AUTUMN,
  command,
  DAY,
  eventsOfType,
  famineSince,
  gameAt,
  gameWith,
  hordeAwake,
  HOUR,
  impoverishedScenario,
  MINUTE,
  newGame,
  play,
  quietCouncil,
  raidInSightScenario,
  refuse,
  starve,
  SUMMER,
  WINTER,
  YEAR,
} from './test-helpers';
import { palisadeAgainst, watchtowerPerks, watchtowerWarningMs } from './threat';
import type { GameEvent, GameState, ScheduledRaid, ThreatView } from './types';
import { deriveViewState } from './view';

const { threat: rules, raids } = balance;

/** O instante da incursão dos cenários: a virada que abre o 11º dia do verão do ano 1. */
const RAID_AT = SUMMER + 10 * DAY;
/** Onde o senhor deixou o feudo: três dias de jogo antes do ataque. */
const LEFT_AT = RAID_AT - 3 * DAY;
/** Quando ele volta: três dias de jogo depois. */
const BACK_AT = RAID_AT + 3 * DAY;

type Size = ScheduledRaid['size'];

/** Os três ritmos oferecidos: o aviso da Torre é tempo real, e em jogo muda com eles. */
const PACES = [3, 1, 0.5] as const;

/**
 * A antecedência do aviso de um nível da Torre em ms de jogo, no ritmo dado: 1 h real no nível
 * 1 e 2 h reais no nível 2 (ADR 0016, item 4). Zero sem Torre.
 */
const warningOf = (tower: number, timeScale = 1): number =>
  (watchtowerPerks(tower)?.warningRealMs ?? 0) * timeScale;

const raid = (atMs: number, size: Size = 'light', id = 'threat-1'): ScheduledRaid => ({
  id,
  atMs,
  kind: 'threat',
  enemy: 'wolves',
  size,
  announcedAtMs: null,
});

/**
 * O feudo da matriz: o mesmo estoque, a mesma gente, os mesmos ofícios e a mesma incursão
 * marcada. Só mudam a Torre de Vigia e a Paliçada. A Ameaça fica baixa, para nenhuma outra
 * incursão ser sorteada na janela do cenário, e o Conselho está calado.
 */
function feud(
  options: {
    tower?: number;
    palisade?: number;
    size?: Size;
    atMs?: number;
    timeScale?: number;
    edit?: (draft: GameState) => void;
  } = {},
): GameState {
  const {
    tower = 0,
    palisade = 0,
    size = 'light',
    atMs = LEFT_AT,
    timeScale = 1,
    edit = () => {},
  } = options;
  return gameAt(atMs, (draft) => {
    const { settlement } = draft;
    draft.settings.timeScale = timeScale;
    settlement.buildings = {
      ...settlement.buildings,
      townHall: 3,
      housing: 2,
      watchtower: tower,
      palisade,
    };
    settlement.population.villagers = 10;
    settlement.workers = { farm: 4, lumberMill: 3, quarry: 2, goldMine: 1 };
    settlement.resources = { food: 400_000, wood: 300_000, stone: 200_000, gold: 100_000 };
    draft.map.threat = 20;
    draft.horde.scheduledRaids = [raid(RAID_AT, size)];
    edit(draft);
  });
}

/** A Ameaça na visão, no ritmo da partida (ou no pedido, para ver o mesmo estado em outro). */
const threatOf = (state: GameState, timeScale = state.settings.timeScale): ThreatView =>
  deriveViewState(state, state.lastProcessedAt, { timeScale }).threat;

const only = (events: GameEvent[], type: GameEvent['type']): GameEvent => {
  const found = eventsOfType(events, type);
  expect(found, type).toHaveLength(1);
  return found[0] as GameEvent;
};

const LEVELS = [0, 1, 2] as const;
const CELLS = LEVELS.flatMap((tower) => LEVELS.map((palisade) => ({ tower, palisade })));

describe('matriz QA-10: a mesma incursão, com o senhor fora, com Torre 0/1/2 e Paliçada 0/1/2, nos três ritmos', () => {
  // O feudo que a Paliçada no nível 2 protegeu é a régua: nele a incursão não tirou nada.
  const untouched = (size: Size, timeScale = 1) =>
    advanceTo(feud({ size, tower: 0, palisade: 2, timeScale }), RAID_AT).state.settlement;
  const MATRIX = PACES.flatMap((timeScale) => RAID_SIZE_IDS.map((size) => ({ timeScale, size })));

  describe.each(MATRIX)('ritmo $timeScale, incursão $size', ({ timeScale, size }) => {
    it.each(CELLS)(
      'Torre Nv$tower e Paliçada Nv$palisade: o aviso, a proteção e a perda',
      ({ tower, palisade }) => {
        const start = feud({ size, tower, palisade, timeScale });
        const { state, events } = advanceTo(start, BACK_AT);
        const before = untouched(size, timeScale);
        const outcome = palisadeAgainst(palisade, size);
        const damage = raids.damage.wolves[size];

        // 1. O aviso: só com a Torre, uma vez, com a antecedência do nível (1 h real no nível
        // 1, 2 h reais no 2, no ritmo da partida), e o tamanho só no 2. No Rápido, as 2 h reais
        // do nível 2 são as 6 h de jogo em que o senhor saiu: o alarme soa no primeiro instante.
        const announced = eventsOfType(events, 'raidAnnounced');
        const perks = watchtowerPerks(tower);
        if (perks === null) {
          expect(announced).toEqual([]);
        } else {
          expect(announced).toHaveLength(1);
          expect(announced[0]?.atMs).toBe(RAID_AT - warningOf(tower, timeScale));
          expect(warningOf(tower, timeScale)).toBe(watchtowerWarningMs(start, perks));
          expect(RAID_AT - (announced[0]?.atMs ?? 0)).toBe(tower * HOUR * timeScale);
          expect(announced[0]?.data).toEqual({
            raidId: 'threat-1',
            enemy: 'wolves',
            warning: perks.revealsRaidSize ? 'sized' : 'warned',
            ...(perks.revealsRaidSize ? { size } : {}),
          });
        }

        // 2. A proteção: a Paliçada que segura o tamanho repele; a que não segura corta a perda.
        const repelled = eventsOfType(events, 'raidRepelled');
        const suffered = eventsOfType(events, 'raidSuffered');
        // Uma incursão, um desfecho, no instante marcado.
        expect(repelled.length + suffered.length).toBe(1);
        const [resolved] = [...repelled, ...suffered];
        expect(resolved?.atMs).toBe(RAID_AT);
        expect(state.horde.scheduledRaids).toEqual([]);

        const atRaid = advanceTo(start, RAID_AT).state.settlement;
        if (outcome.kind === 'held') {
          expect(suffered).toEqual([]);
          expect(atRaid.resources).toEqual(before.resources);
          expect(atRaid.workers).toEqual(before.workers);
          expect(atRaid.injured).toEqual([]);
          expect(atRaid.moraleEffects).toEqual([]);
          expect(eventsOfType(events, 'villagerInjured')).toEqual([]);
          expect(state.stats.raids_repelled).toBe(1);
          expect(state.stats.raids_suffered).toBeUndefined();
        } else {
          expect(repelled).toEqual([]);
          // 3. A perda, em milésimos exatos: a parte do conteúdo, e só a metade dela quando a
          // Paliçada é pequena demais.
          const share = outcome.kind === 'breached' ? outcome.share : { num: 1, den: 1 };
          const part = (stock: number) =>
            Math.floor(
              (stock * damage.lossRatio.num * share.num) / (damage.lossRatio.den * share.den),
            );
          const lostFood = part(before.resources.food);
          const lostWood = part(before.resources.wood);
          expect(lostFood).toBeGreaterThan(0);
          expect(lostWood).toBeGreaterThan(0);
          expect(atRaid.resources).toEqual({
            ...before.resources,
            food: before.resources.food - lostFood,
            wood: before.resources.wood - lostWood,
          });
          const injuries = Math.floor((damage.injuries * share.num) / share.den);
          expect(atRaid.injured).toHaveLength(injuries);
          expect(resolved?.data).toMatchObject({
            raided_food: lostFood / 1000,
            raided_wood: lostWood / 1000,
            injured: injuries,
          });
          expect(eventsOfType(events, 'villagerInjured')).toHaveLength(injuries);
          expect(eventsOfType(events, 'villagerRecovered')).toHaveLength(injuries);
          expect(state.stats.raids_suffered).toBe(1);
          expect(state.stats.raids_repelled).toBeUndefined();
          // Quem se feriu já voltou ao ofício quando o senhor chega.
          expect(state.settlement.injured).toEqual([]);
          expect(state.settlement.workers).toEqual(before.workers);
        }

        // A Ameaça cai `raidDrop` em toda incursão, repelida ou sofrida, e não passa de zero:
        // 20 mais três viradas do covil, menos a queda.
        expect(advanceTo(start, RAID_AT).state.map.threat).toBe(
          Math.max(0, 20 + 3 * rules.perActiveTilePerDay - rules.raidDrop),
        );

        // O relato: como chegou, o que a defesa fez e, na perda, o que a teria evitado.
        const text = resolved?.text ?? '';
        const phrases = raidTemplates.wolves;
        const told = (template: string) => template.split('{')[0] ?? template;
        if (perks === null) {
          expect(text).toContain('sem que ninguém os visse vir');
        } else if (perks.revealsRaidSize) {
          expect(text).toContain(size === 'light' ? 'uma matilha pequena' : 'uma matilha grande');
          expect(text).toContain('como os vigias tinham contado');
        } else {
          expect(text).toContain('os lobos que os vigias tinham avistado');
        }
        if (outcome.kind === 'held') {
          expect(text).toContain(phrases.outcome.held);
          expect(text).not.toContain('teria detido');
        } else {
          expect(text).toContain(
            told(outcome.kind === 'breached' ? phrases.outcome.breached : phrases.outcome.open),
          );
          expect(text).toContain(
            size === 'light'
              ? 'Uma paliçada os teria detido.'
              : 'Uma paliçada no nível 2 os teria detido.',
          );
          expect(resolved?.data.palisadeLevelNeeded).toBe(size === 'light' ? 1 : 2);
        }
        expect(resolved?.data).toMatchObject({
          raidId: 'threat-1',
          enemy: 'wolves',
          size,
          palisadeLevel: palisade,
          warning: perks === null ? 'unwarned' : perks.revealsRaidSize ? 'sized' : 'warned',
        });
      },
    );
  });

  it('a Paliçada muda o que se perde: nada, a metade, tudo', () => {
    const lostBy = (size: Size, palisade: number) => {
      const { events } = advanceTo(feud({ size, palisade }), BACK_AT);
      const [suffered] = eventsOfType(events, 'raidSuffered');
      return suffered === undefined
        ? { food: 0, wood: 0, injured: 0 }
        : {
            food: suffered.data.raided_food,
            wood: suffered.data.raided_wood,
            injured: suffered.data.injured,
          };
    };
    // Leve: 10% e 1 ferido sem Paliçada; nada com ela.
    const light = LEVELS.map((palisade) => lostBy('light', palisade));
    expect(light[0]?.injured).toBe(1);
    expect(light[1]).toEqual({ food: 0, wood: 0, injured: 0 });
    expect(light[2]).toEqual({ food: 0, wood: 0, injured: 0 });
    // Média: 15% e 2 feridos; metade e 1 ferido com o nível 1; nada com o nível 2.
    const medium = LEVELS.map((palisade) => lostBy('medium', palisade));
    expect(medium[0]?.injured).toBe(2);
    expect(medium[1]?.injured).toBe(1);
    expect(medium[2]).toEqual({ food: 0, wood: 0, injured: 0 });
    // A mesma despensa: a média leva uma vez e meia o que a leve leva, e a Paliçada pequena
    // deixa passar a metade disso (a menos de um milésimo, do arredondamento para baixo).
    const food = (entry: (typeof light)[number] | undefined) => Number(entry?.food ?? 0);
    expect(food(medium[0])).toBeCloseTo(food(light[0]) * 1.5, 2);
    expect(food(medium[1])).toBeCloseTo(food(medium[0]) / 2, 2);
  });

  it('a Torre não muda o desfecho de quem está fora: o estado final é o mesmo, com ou sem ela', () => {
    for (const size of RAID_SIZE_IDS) {
      for (const palisade of LEVELS) {
        const [blind, ...watched] = LEVELS.map((tower) => {
          const { state } = advanceTo(feud({ size, tower, palisade }), BACK_AT);
          // O que distingue os três feudos é só a Torre.
          state.settlement.buildings.watchtower = 0;
          return state;
        });
        for (const state of watched) {
          expect(state).toEqual(blind);
        }
      }
    }
  });

  it.each(PACES)(
    'ritmo %s: a Torre muda o que o senhor sabe antes: a incursão à vista, com a antecedência real do nível',
    (timeScale) => {
      // O senhor saiu sete horas de jogo antes: mais do que a maior antecedência (6 h, no Rápido).
      const at = (tower: number, beforeMs: number) =>
        threatOf(
          advanceTo(
            feud({ size: 'medium', tower, timeScale, atMs: RAID_AT - 7 * HOUR }),
            RAID_AT - beforeMs,
          ).state,
        );
      // Sem Torre, nada, nem um instante antes do ataque.
      expect(at(0, 1).incoming).toBeNull();
      expect(at(0, 1).known).toBe(false);
      // Nível 1: 1 h real antes, sem o tamanho.
      expect(at(1, HOUR * timeScale + 1).incoming).toBeNull();
      expect(at(1, HOUR * timeScale).incoming).toMatchObject({ inSeconds: 3600, sizeText: null });
      // Nível 2: 2 h reais antes, com o tamanho.
      expect(at(2, 2 * HOUR * timeScale + 1).incoming).toBeNull();
      expect(at(2, 2 * HOUR * timeScale).incoming).toMatchObject({
        inSeconds: 7200,
        sizeText: 'uma matilha grande',
      });
    },
  );

  it('o aviso dá tempo de agir: quem volta com o alarme e ergue a Paliçada repele o ataque', () => {
    // O mesmo senhor passa pelo feudo meia hora de jogo antes do ataque. Com a Torre ele vê os
    // lobos a caminho e manda erguer a Paliçada (20 min de jogo); sem ela, não vê nada.
    const visitAt = RAID_AT - 30 * MINUTE;
    const outcomeOf = (tower: number) => {
      const visit = advanceTo(feud({ tower }), visitAt).state;
      const { incoming } = threatOf(visit);
      const acted =
        incoming === null
          ? visit
          : accept(visit, command('startConstruction', { building: 'palisade' })).state;
      const { events } = advanceTo(acted, BACK_AT);
      return {
        warned: incoming !== null,
        repelled: eventsOfType(events, 'raidRepelled').length,
        suffered: eventsOfType(events, 'raidSuffered').length,
      };
    };
    expect(outcomeOf(0)).toEqual({ warned: false, repelled: 0, suffered: 1 });
    expect(outcomeOf(1)).toEqual({ warned: true, repelled: 1, suffered: 0 });
    expect(outcomeOf(2)).toEqual({ warned: true, repelled: 1, suffered: 0 });
    // E a tela diz, antes de a ordem ser dada e depois dela, o que a Paliçada vai fazer.
    const visit = advanceTo(feud({ tower: 1 }), visitAt).state;
    expect(threatOf(visit).incoming?.defenseText).toBe('Sem Paliçada, nada segura este ataque.');
    const building = accept(visit, command('startConstruction', { building: 'palisade' })).state;
    expect(threatOf(building).incoming?.defenseText).toContain('que fica pronta a tempo');
    // A obra cabe na antecedência do nível 1 até no ritmo em que ela é mais curta em jogo.
    expect(buildings.palisade.baseDurationMs).toBeLessThan(warningOf(1, 0.5));
  });

  it('uma perda por ataque: avançar mais, de uma vez ou aos pedaços, não repete nada', () => {
    const start = feud({ size: 'medium' });
    const whole = advanceTo(start, BACK_AT);
    let state = start;
    const events: GameEvent[] = [];
    for (let at = LEFT_AT + 37 * MINUTE; at < BACK_AT; at += 37 * MINUTE) {
      const step = advanceTo(state, at);
      state = step.state;
      events.push(...step.events);
    }
    const last = advanceTo(state, BACK_AT);
    events.push(...last.events);
    expect(last.state).toEqual(whole.state);
    expect(events).toEqual(whole.events);
    expect(eventsOfType(events, 'raidSuffered')).toHaveLength(1);
    // Muito depois, nada de novo: a incursão saiu da lista quando foi resolvida.
    const later = advanceTo(whole.state, BACK_AT + DAY);
    expect(eventsOfType(later.events, 'raidSuffered')).toEqual([]);
    expect(eventsOfType(later.events, 'raidRepelled')).toEqual([]);
  });
});

describe('o aviso da Torre de Vigia (raidAnnounced)', () => {
  it('a frase do nível 1 não diz o tamanho; a do nível 2 diz o que os vigias contaram', () => {
    const line = (tower: number, size: Size) =>
      only(advanceTo(feud({ tower, size }), RAID_AT - 1).events, 'raidAnnounced').text;
    expect(line(1, 'light')).toBe(
      'No 10º dia do Verão, os vigias de Pedra Alta deram o alarme: lobos a caminho. Da torre ainda não se distingue quantos são.',
    );
    // A leve e a média são a mesma linha para quem não distingue.
    expect(line(1, 'medium')).toBe(line(1, 'light'));
    expect(line(2, 'light')).toBe(
      'No 10º dia do Verão, os vigias de Pedra Alta deram o alarme: lobos a caminho. Contam uma matilha pequena.',
    );
    expect(line(2, 'medium')).toContain('Contam uma matilha grande.');
  });

  it.each(PACES)(
    'ritmo %s: a visão mostra a incursão no mesmo instante em que o alarme soa, nem antes nem depois',
    (timeScale) => {
      for (const tower of [1, 2]) {
        const warningMs = warningOf(tower, timeScale);
        const start = feud({ tower, timeScale, atMs: RAID_AT - 7 * HOUR });
        const before = advanceTo(start, RAID_AT - warningMs - 1);
        expect(eventsOfType(before.events, 'raidAnnounced')).toEqual([]);
        expect(before.state.horde.scheduledRaids[0]?.announcedAtMs).toBeNull();
        expect(threatOf(before.state).incoming).toBeNull();
        const at = advanceTo(before.state, RAID_AT - warningMs);
        expect(eventsOfType(at.events, 'raidAnnounced')).toHaveLength(1);
        expect(at.state.horde.scheduledRaids[0]?.announcedAtMs).toBe(RAID_AT - warningMs);
        // Uma hora real por nível, em qualquer ritmo.
        expect(threatOf(at.state).incoming?.inSeconds).toBe(tower * 3600);
      }
    },
  );

  it('o instante do aviso, em horas de jogo antes do ataque, nos três ritmos', () => {
    const before = (timeScale: number, tower: number) => {
      const start = feud({ tower, timeScale, atMs: RAID_AT - 7 * HOUR });
      const { events } = advanceTo(start, RAID_AT);
      return (RAID_AT - only(events, 'raidAnnounced').atMs) / HOUR;
    };
    // Rápido: 1 h e 2 h reais são 3 h e 6 h de jogo (seis horas é o prazo de uma incursão
    // sorteada: o nível 2 avisa no instante do sorteio).
    expect([before(3, 1), before(3, 2)]).toEqual([3, 6]);
    expect(6 * HOUR).toBe(rules.raidLeadMs);
    // Normal: como sempre foi.
    expect([before(1, 1), before(1, 2)]).toEqual([1, 2]);
    // Tranquilo: meia hora e uma hora de jogo.
    expect([before(0.5, 1), before(0.5, 2)]).toEqual([0.5, 1]);
  });

  it('a Torre concluída dentro da janela avisa ao concluir; concluída antes, avisa no prazo', () => {
    const finishing = (finishesAtMs: number, targetLevel = 1) =>
      feud({
        tower: targetLevel - 1,
        edit: (draft) => {
          draft.settlement.constructionQueues[0] = {
            building: 'watchtower',
            targetLevel,
            startedAtMs: LEFT_AT,
            finishesAtMs,
          };
        },
      });
    // Pronta meia hora de jogo antes do ataque: o alarme é dela, nesse instante.
    const late = advanceTo(finishing(RAID_AT - 30 * MINUTE), RAID_AT - 1);
    expect(only(late.events, 'raidAnnounced').atMs).toBe(RAID_AT - 30 * MINUTE);
    const types = late.events.map((event) => event.type);
    expect(types.indexOf('buildingFounded')).toBeLessThan(types.indexOf('raidAnnounced'));
    // Pronta bem antes: o alarme sai na antecedência do nível, como para quem já a tinha.
    const early = advanceTo(finishing(LEFT_AT + HOUR), RAID_AT - 1);
    expect(only(early.events, 'raidAnnounced').atMs).toBe(RAID_AT - HOUR);
    // Pronta no instante exato do ataque: já não há o que avisar, e os lobos chegam sem aviso.
    const tooLate = advanceTo(finishing(RAID_AT), BACK_AT);
    expect(eventsOfType(tooLate.events, 'raidAnnounced')).toEqual([]);
    expect(only(tooLate.events, 'raidSuffered').data.warning).toBe('unwarned');
  });

  it('a Torre que sobe ao nível 2 depois do alarme não avisa de novo; o relato já diz o tamanho', () => {
    const start = feud({
      tower: 1,
      size: 'medium',
      palisade: 2,
      edit: (draft) => {
        draft.settlement.constructionQueues[0] = {
          building: 'watchtower',
          targetLevel: 2,
          startedAtMs: LEFT_AT,
          finishesAtMs: RAID_AT - 20 * MINUTE,
        };
      },
    });
    const { events } = advanceTo(start, BACK_AT);
    const announced = only(events, 'raidAnnounced');
    expect(announced.atMs).toBe(RAID_AT - HOUR);
    expect(announced.data).not.toHaveProperty('size');
    expect(only(events, 'raidRepelled').text).toBe(
      'No 11º dia do Verão, os lobos chegaram a Pedra Alta: uma matilha grande, como os vigias tinham contado. Recuaram diante da paliçada: nada se perdeu e ninguém se feriu.',
    );
  });

  it('a Torre que sobe ao nível 2 antes do alarme avisa com a antecedência do nível novo', () => {
    // O nível 2 fica pronto 90 min antes do ataque: já dentro das 2 h dele, e antes da 1 h do
    // nível 1. O alarme é do nível novo, na hora em que ele fica pronto, e diz o tamanho.
    const start = feud({
      tower: 1,
      edit: (draft) => {
        draft.settlement.constructionQueues[0] = {
          building: 'watchtower',
          targetLevel: 2,
          startedAtMs: LEFT_AT,
          finishesAtMs: RAID_AT - 90 * MINUTE,
        };
      },
    });
    const announced = only(advanceTo(start, RAID_AT - 1).events, 'raidAnnounced');
    expect(announced.atMs).toBe(RAID_AT - 90 * MINUTE);
    expect(announced.data).toMatchObject({ warning: 'sized', size: 'light' });
  });

  it('sem Torre nenhum evento conta a incursão antes de ela chegar', () => {
    const { events } = advanceTo(feud({ tower: 0, size: 'medium' }), RAID_AT - 1);
    expect(events.filter((event) => /raid|wolves/i.test(event.type))).toEqual([]);
    expect(events.map((event) => event.text).join('\n')).not.toMatch(/lobo|matilha|vigia/i);
  });

  it('em outro ritmo o alarme soa com a mesma antecedência real, em outro instante de jogo', () => {
    for (const timeScale of [3, 0.5]) {
      const state = feud({ tower: 2, timeScale, atMs: RAID_AT - 7 * HOUR });
      // 2 h reais: 6 h de jogo no Rápido, 1 h no Tranquilo.
      const at = advanceTo(state, RAID_AT - 2 * HOUR * timeScale);
      expect(only(at.events, 'raidAnnounced').atMs).toBe(RAID_AT - 2 * HOUR * timeScale);
      const { incoming } = threatOf(at.state, timeScale);
      expect(incoming?.inSeconds).toBe(2 * 3600);
      expect(only(advanceTo(at.state, BACK_AT).events, 'raidSuffered').atMs).toBe(RAID_AT);
    }
  });
});

describe('a resolução no instante marcado', () => {
  it('a perda é a parte exata do estoque daquele instante, em milésimos e para baixo', () => {
    const start = feud({
      atMs: RAID_AT - 1,
      edit: (draft) => {
        draft.settlement.workers = { farm: 0, lumberMill: 0, quarry: 0, goldMine: 0 };
        draft.settlement.population.villagers = 5;
        draft.settlement.resources = { food: 123_457, wood: 99_999, stone: 77_777, gold: 5_555 };
      },
    });
    const before = advanceTo(start, RAID_AT - 1).state.settlement.resources;
    const { state, events } = advanceTo(start, RAID_AT);
    // Um milissegundo de consumo de 5 bocas não chega a um milésimo: o estoque é o de antes.
    expect(before.food).toBe(123_457);
    expect(state.settlement.resources).toEqual({
      food: 123_457 - 12_345,
      wood: 99_999 - 9_999,
      stone: 77_777,
      gold: 5_555,
    });
    const suffered = only(events, 'raidSuffered');
    expect(suffered.data).toMatchObject({ raided_food: 12.345, raided_wood: 9.999, injured: 1 });
    expect(suffered.text).toBe(
      'No 11º dia do Verão, os lobos chegaram a Pedra Alta sem que ninguém os visse vir. Nada os deteve: o ataque custou 12,3 de comida, 10 de madeira e um aldeão ferido. Uma paliçada os teria detido.',
    );
  });

  it('a média contra a Paliçada Nv1: metade da perda, 1 ferido, e a frase diz o nível que faltou', () => {
    const start = feud({
      atMs: RAID_AT - 1,
      size: 'medium',
      palisade: 1,
      tower: 0,
      edit: (draft) => {
        draft.settlement.workers = { farm: 0, lumberMill: 0, quarry: 0, goldMine: 0 };
        draft.settlement.population.villagers = 5;
        draft.settlement.resources = { food: 200_000, wood: 100_000, stone: 0, gold: 0 };
      },
    });
    const { state, events } = advanceTo(start, RAID_AT);
    // 15% é 30 e 15; a metade é 15 e 7,5.
    expect(state.settlement.resources.food).toBe(200_000 - 15_000);
    expect(state.settlement.resources.wood).toBe(100_000 - 7_500);
    expect(state.settlement.injured).toEqual([
      { untilMs: RAID_AT + raids.injuryMs, building: null },
    ]);
    expect(only(events, 'raidSuffered').text).toBe(
      'No 11º dia do Verão, os lobos chegaram a Pedra Alta sem que ninguém os visse vir. A paliçada lhes quebrou o ímpeto, mas não os deteve: o ataque custou 15 de comida, 7,5 de madeira e um aldeão ferido. Uma paliçada no nível 2 os teria detido.',
    );
  });

  it('a Paliçada que fica pronta no instante exato do ataque já o repele (as obras vêm antes)', () => {
    const building = (finishesAtMs: number) =>
      feud({
        edit: (draft) => {
          draft.settlement.constructionQueues[0] = {
            building: 'palisade',
            targetLevel: 1,
            startedAtMs: LEFT_AT,
            finishesAtMs,
          };
        },
      });
    const inTime = advanceTo(building(RAID_AT), RAID_AT);
    expect(eventsOfType(inTime.events, 'raidRepelled')).toHaveLength(1);
    const types = inTime.events.map((event) => event.type);
    expect(types.indexOf('buildingFounded')).toBeLessThan(types.indexOf('raidRepelled'));
    // Um milissegundo depois já é tarde.
    const late = advanceTo(building(RAID_AT + 1), RAID_AT + 1);
    expect(eventsOfType(late.events, 'raidSuffered')).toHaveLength(1);
    expect(late.state.settlement.buildings.palisade).toBe(1);
  });

  it('a ordem do instante: a virada do dia (com a moral e a Ameaça) vem antes da incursão', () => {
    const at30 = (draft: GameState) => void (draft.map.threat = 30);
    const { state, events } = advanceTo(feud({ tower: 1, edit: at30 }), RAID_AT);
    const at = events.filter((event) => event.atMs === RAID_AT).map((event) => event.type);
    // O fecho do desperdício do dia que acabou abre a virada (a despensa do cenário enche).
    expect(at).toEqual(['storageWasted', 'dayStarted', 'raidSuffered', 'villagerInjured']);
    // A Ameaça subiu na virada (30 + 3 × 2) e caiu com a incursão, nessa ordem: ao contrário,
    // daria 34 − 35 = 0, e a virada a levaria a 2.
    expect(only(events, 'raidSuffered').data).toMatchObject({ previousThreat: 36, threat: 1 });
    expect(state.map.threat).toBe(1);
    // A moral daquela virada é a de antes do ataque: o termo só pesa a partir da seguinte.
    expect(state.settlement.morale).toBe(
      advanceTo(feud({ palisade: 2 }), RAID_AT).state.settlement.morale,
    );
  });

  it('a moral perde 10 por exatamente 2 viradas de dia, e a conta diz o porquê', () => {
    const moraleAt = (state: GameState, atMs: number) =>
      advanceTo(state, atMs).state.settlement.morale;
    const hit = feud();
    const safe = feud({ palisade: 1 });
    expect(moraleAt(hit, RAID_AT)).toBe(moraleAt(safe, RAID_AT));
    expect(moraleAt(hit, RAID_AT + DAY)).toBe(moraleAt(safe, RAID_AT + DAY) + raids.moraleOnLosses);
    expect(moraleAt(hit, RAID_AT + 2 * DAY)).toBe(
      moraleAt(safe, RAID_AT + 2 * DAY) + raids.moraleOnLosses,
    );
    expect(moraleAt(hit, RAID_AT + 3 * DAY)).toBe(moraleAt(safe, RAID_AT + 3 * DAY));
    // Entre o ataque e a virada seguinte a visão já mostra o termo, com o nome dele.
    const after = advanceTo(hit, RAID_AT + 10 * MINUTE).state;
    const { morale } = deriveViewState(after, after.lastProcessedAt);
    expect(morale.terms).toContainEqual({ id: 'effect', label: 'Incursão sofrida', amount: -10 });
    expect(morale.effects).toEqual([
      { label: 'Incursão sofrida', amount: -10, endsInSeconds: (3 * DAY - 10 * MINUTE) / 1000 },
    ]);
    expect(morale.next.value).toBe(morale.value - 10);
    // Quem repeliu não tem termo nenhum.
    expect(advanceTo(safe, BACK_AT).state.settlement.moraleEffects).toEqual([]);
  });

  it('com a despensa e o pátio vazios e ninguém em condição de se ferir, os lobos saem de mãos vazias', () => {
    const start = feud({
      atMs: RAID_AT - 1,
      edit: (draft) => {
        const { settlement } = draft;
        settlement.resources = { food: 0, wood: 0, stone: 50_000, gold: 50_000 };
        settlement.workers = { farm: 0, lumberMill: 0, quarry: 0, goldMine: 0 };
        settlement.population.villagers = 3;
        starve(draft, RAID_AT - DAY);
        // Os três já estão de cama, de outro ataque.
        settlement.injured = [
          { untilMs: RAID_AT + HOUR, building: null },
          { untilMs: RAID_AT + HOUR, building: null },
          { untilMs: RAID_AT + HOUR, building: null },
        ];
      },
    });
    const { state, events } = advanceTo(start, RAID_AT);
    const suffered = only(events, 'raidSuffered');
    expect(suffered.text).toBe(
      'No 11º dia do Verão, os lobos chegaram a Pedra Alta sem que ninguém os visse vir. Não acharam o que levar nem a quem ferir. Uma paliçada os teria detido.',
    );
    expect(suffered.data).toMatchObject({ injured: 0 });
    expect(suffered.data).not.toHaveProperty('raided_food');
    // Sem perda não há termo de moral; a Ameaça cai do mesmo jeito.
    expect(state.settlement.moraleEffects).toEqual([]);
    expect(state.settlement.resources.food).toBe(0);
    expect(state.settlement.injured).toHaveLength(3);
    expect(state.stats.raids_suffered).toBe(1);
  });

  it('a Ameaça nunca fica negativa', () => {
    const start = feud({ atMs: RAID_AT - 1, edit: (draft) => void (draft.map.threat = 0) });
    // A virada soma 5, e a incursão tira o que há.
    expect(advanceTo(start, RAID_AT).state.map.threat).toBe(0);
  });

  it('sem Torre o evento não leva a Ameaça: ela não sai do servidor', () => {
    for (const palisade of [0, 2]) {
      const { events } = advanceTo(feud({ tower: 0, palisade }), BACK_AT);
      for (const event of events) {
        expect(Object.keys(event.data).filter((key) => /threat/i.test(key))).toEqual([]);
      }
    }
    const at40 = (draft: GameState) => void (draft.map.threat = 40);
    const watched = advanceTo(feud({ tower: 1, palisade: 2, edit: at40 }), BACK_AT).events;
    expect(only(watched, 'raidRepelled').data).toMatchObject({ previousThreat: 46, threat: 11 });
  });
});

describe('os feridos', () => {
  it('quem está sem ofício se fere primeiro; se todos trabalham, sai do edifício com mais gente', () => {
    // 10 habitantes e 10 ofícios: o ferido sai da Fazenda, que tem 4.
    const full = advanceTo(feud(), RAID_AT);
    expect(full.state.settlement.workers).toEqual({
      farm: 3,
      lumberMill: 3,
      quarry: 2,
      goldMine: 1,
    });
    expect(full.state.settlement.injured).toEqual([
      { untilMs: RAID_AT + raids.injuryMs, building: 'farm' },
    ]);
    const hurt = only(full.events, 'villagerInjured');
    expect(hurt.data).toEqual({ raidId: 'threat-1', injured: 1, building: 'farm' });
    expect(hurt.text).toBe(
      'No 11º dia do Verão, um lavrador de Pedra Alta saiu ferido do ataque. Larga o ofício até sarar.',
    );
    // Com um aldeão livre, é ele quem se fere, e ninguém larga o ofício.
    const spare = advanceTo(
      feud({ edit: (draft) => void (draft.settlement.population.villagers = 11) }),
      RAID_AT,
    );
    expect(spare.state.settlement.workers).toEqual({
      farm: 4,
      lumberMill: 3,
      quarry: 2,
      goldMine: 1,
    });
    expect(spare.state.settlement.injured).toEqual([
      { untilMs: RAID_AT + raids.injuryMs, building: null },
    ]);
    expect(only(spare.events, 'villagerInjured').text).toBe(
      'No 11º dia do Verão, um aldeão sem ofício de Pedra Alta saiu ferido do ataque. Fica de cama até sarar.',
    );
  });

  it('a média fere dois, um de cada vez, sempre do edifício que tem mais gente naquele momento', () => {
    const start = feud({
      size: 'medium',
      edit: (draft) => {
        draft.settlement.workers = { farm: 4, lumberMill: 4, quarry: 1, goldMine: 1 };
      },
    });
    const { state, events } = advanceTo(start, RAID_AT);
    // Fazenda e Serraria empatam em 4: sai da Fazenda (a primeira do conteúdo); depois, da Serraria.
    expect(state.settlement.workers).toEqual({ farm: 3, lumberMill: 3, quarry: 1, goldMine: 1 });
    expect(eventsOfType(events, 'villagerInjured').map((event) => event.data.building)).toEqual([
      'farm',
      'lumberMill',
    ]);
    expect(only(events, 'raidSuffered').text).toContain('2 aldeões feridos');
  });

  it('quem ainda se adapta sai primeiro, e quem volta do ferimento volta adaptado', () => {
    const start = feud({
      atMs: RAID_AT - 10 * MINUTE,
      edit: (draft) => {
        draft.settlement.adaptation = [{ building: 'farm', count: 2, untilMs: RAID_AT + HOUR }];
      },
    });
    const hit = advanceTo(start, RAID_AT).state;
    expect(hit.settlement.workers.farm).toBe(3);
    expect(hit.settlement.adaptation).toEqual([
      { building: 'farm', count: 1, untilMs: RAID_AT + HOUR },
    ]);
    const healed = advanceTo(hit, RAID_AT + raids.injuryMs).state;
    expect(healed.settlement.workers.farm).toBe(4);
    expect(healed.settlement.adaptation).toEqual([]);
  });

  it('o ferido não trabalha por um dia de jogo: a produção cai no instante do ataque e volta no instante em que ele sara', () => {
    const rate = (state: GameState) =>
      deriveViewState(state, state.lastProcessedAt).workers.find((row) => row.building === 'farm');
    const start = feud();
    const before = advanceTo(start, RAID_AT - 1).state;
    const hit = advanceTo(start, RAID_AT).state;
    const lastHurt = advanceTo(start, RAID_AT + raids.injuryMs - 1);
    const healed = advanceTo(start, RAID_AT + raids.injuryMs);
    expect(rate(before)?.assigned).toBe(4);
    expect(rate(hit)).toMatchObject({ assigned: 3, injured: 1 });
    expect(rate(lastHurt.state)).toMatchObject({ assigned: 3, injured: 1 });
    expect(rate(healed.state)).toMatchObject({ assigned: 4, injured: 0 });
    expect(eventsOfType(lastHurt.events, 'villagerRecovered')).toEqual([]);
    const back = only(healed.events, 'villagerRecovered');
    expect(back.atMs).toBe(RAID_AT + raids.injuryMs);
    expect(back.data).toEqual({ injured: 0, building: 'farm' });
    expect(back.text).toBe(
      'No 12º dia do Verão, um lavrador de Pedra Alta sarou das feridas e voltou ao ofício.',
    );
  });

  it('o ferido continua morando e comendo: só deixa de ser braço', () => {
    const hit = advanceTo(feud(), RAID_AT).state;
    const safe = advanceTo(feud({ palisade: 1 }), RAID_AT).state;
    const view = deriveViewState(hit, hit.lastProcessedAt);
    const calm = deriveViewState(safe, safe.lastProcessedAt);
    expect(view.population).toMatchObject({
      villagers: 10,
      free: 0,
      injured: 1,
      secondsToNextRecovery: raids.injuryMs / 1000,
      injuredNote:
        '1 aldeão ferido na incursão: não trabalha até sarar, em 2 h, e então volta à Fazenda.',
    });
    expect(view.population.housed).toBe(calm.population.housed);
    expect(calm.population).toMatchObject({
      injured: 0,
      secondsToNextRecovery: null,
      injuredNote: null,
    });
    // O consumo é o de 10 bocas nos dois feudos.
    const consumption = (text: string) => /consumo [^;]*/.exec(text)?.[0];
    const food = (state: typeof view) => state.resources.find((row) => row.id === 'food');
    expect(consumption(food(view)?.breakdown ?? '')).toBe(consumption(food(calm)?.breakdown ?? ''));
  });

  it('as ordens de trabalho não contam com o ferido, e ele volta ao ofício mesmo que o senhor mexa nos outros', () => {
    const hit = advanceTo(feud(), RAID_AT + 10 * MINUTE).state;
    expect(freeVillagers(hit)).toBe(0);
    expect(ableVillagers(hit)).toBe(9);
    // Não dá para pôr 4 na Fazenda: o quarto está de cama.
    expect(refuse(hit, command('setWorkers', { building: 'farm', count: 4 }))).toEqual({
      code: 'NOT_ENOUGH_VILLAGERS',
      message: 'Só há 3 aldeões livres para esse ofício.',
    });
    // O senhor tira dois lenhadores e os manda para a Fazenda.
    const moved = accept(
      accept(hit, command('setWorkers', { building: 'lumberMill', count: 1 })).state,
      command('setWorkers', { building: 'farm', count: 5 }),
    ).state;
    expect(assignedWorkers(moved)).toBe(9);
    const healed = advanceTo(moved, RAID_AT + raids.injuryMs).state;
    expect(healed.settlement.workers).toEqual({ farm: 6, lumberMill: 1, quarry: 2, goldMine: 1 });
    expect(assignedWorkers(healed)).toBe(10);
    expect(freeVillagers(healed)).toBe(0);
  });

  it('a experiência do ofício não se perde: o ferido volta antes da contagem da virada', () => {
    // Um lavrador só, no nível 1: ferido, a Fazenda fica vazia o dia inteiro.
    const lone = (palisade: number) =>
      feud({
        palisade,
        edit: (draft) => {
          const { settlement } = draft;
          settlement.population.villagers = 4;
          settlement.workers = { farm: 1, lumberMill: 1, quarry: 1, goldMine: 1 };
          settlement.buildings.farm = 1;
          settlement.craftExperience.farm = 40;
          settlement.resources.food = 400_000;
        },
      });
    const hit = advanceTo(lone(0), RAID_AT + raids.injuryMs);
    const safe = advanceTo(lone(1), RAID_AT + raids.injuryMs);
    expect(eventsOfType(hit.events, 'villagerInjured')[0]?.data.building).toBe('farm');
    expect(hit.state.settlement.craftExperience).toEqual(safe.state.settlement.craftExperience);
    // E enquanto ele está de cama a visão não anuncia a perda do ofício: sabe que ele volta.
    const hurt = advanceTo(lone(0), RAID_AT + 10 * MINUTE).state;
    const farm = deriveViewState(hurt, hurt.lastProcessedAt).workers.find(
      (row) => row.building === 'farm',
    );
    expect(farm).toMatchObject({ assigned: 0, injured: 1, experienceTrend: 'rising' });
  });

  it('a previsão da comida conta com o lavrador que volta: o prazo anunciado é cumprido', () => {
    // Sem o lavrador ferido a Fazenda não cobre as bocas; com ele de volta, cobre. A visão não
    // anuncia uma fome que o motor não entrega.
    const start = feud({
      edit: (draft) => {
        const { settlement } = draft;
        settlement.population.villagers = 20;
        settlement.buildings.housing = 3;
        settlement.workers = { farm: 2, lumberMill: 1, quarry: 1, goldMine: 1 };
        settlement.resources.food = 26_000;
        settlement.craftExperience.farm = 100;
      },
    });
    const hit = advanceTo(start, RAID_AT + 5 * MINUTE).state;
    expect(hit.settlement.injured).toHaveLength(1);
    const food = deriveViewState(hit, hit.lastProcessedAt).resources.find(
      (row) => row.id === 'food',
    );
    const end = advanceTo(hit, RAID_AT + 6 * DAY);
    const famine = eventsOfType(end.events, 'famineStarted')[0];
    if (food?.depletesInSeconds == null) {
      expect(famine).toBeUndefined();
    } else {
      expect(famine).toBeDefined();
      const elapsed = ((famine?.atMs ?? 0) - hit.lastProcessedAt) / 1000;
      expect(Math.floor(elapsed)).toBe(food.depletesInSeconds);
    }
  });

  it('se alguém parte com a moral baixa enquanto há feridos, a conta dos braços continua valendo', () => {
    const start = feud({
      size: 'medium',
      edit: (draft) => {
        const { settlement } = draft;
        settlement.population.villagers = 6;
        settlement.workers = { farm: 0, lumberMill: 3, quarry: 2, goldMine: 1 };
        settlement.resources.food = 0;
        // Fome antiga: a moral está no chão e a deserção corre a cada virada.
        starve(draft, LEFT_AT - 10 * DAY);
        settlement.morale = 0;
      },
    });
    let state = start;
    for (let at = LEFT_AT + DAY; at <= BACK_AT + 3 * DAY; at += DAY / 2) {
      state = advanceTo(state, at).state;
      const { settlement } = state;
      expect(assignedWorkers(state)).toBeLessThanOrEqual(ableVillagers(state));
      expect(settlement.injured.length).toBeLessThanOrEqual(settlement.population.villagers);
      expect(ableVillagers(state)).toBeGreaterThanOrEqual(0);
      for (const count of Object.values(settlement.workers)) {
        expect(count).toBeGreaterThanOrEqual(0);
      }
    }
    expect(state.settlement.population.villagers).toBe(balance.morale.populationFloor);
  });
});

describe('a visão de quem tem a Torre: a chance, o custo e o que fazer', () => {
  const known = (state: GameState, timeScale = 1) => {
    const threat = threatOf(state, timeScale);
    if (!threat.known) {
      throw new Error('O cenário devia ter a Torre de Vigia.');
    }
    return threat;
  };
  const watched = (threat: number, edit: (draft: GameState) => void = () => {}) =>
    gameAt(SUMMER + 2 * DAY + 10 * MINUTE, (draft) => {
      draft.settlement.buildings.townHall = 2;
      draft.settlement.buildings.watchtower = 1;
      draft.map.threat = threat;
      edit(draft);
    });

  it('abaixo do limiar: nenhuma incursão é marcada, e a frase diz a regra', () => {
    const threat = known(watched(30));
    expect(threat.raidChancePercent).toBe(0);
    expect(threat.raidRisk).toBe(
      'Com a Ameaça em 40 ou menos, nenhuma incursão é marcada. Acima disso, cada virada do dia pode marcar uma (a chance é o que a Ameaça passa de 40, em %), e ela chega 6 h depois. Toda incursão, repelida ou sofrida, baixa a Ameaça em 35.',
    );
    // A virada que leva a 40 ainda não sorteia: a chance é o que **passa** de 40.
    expect(known(watched(38)).raidChancePercent).toBe(0);
  });

  it('acima do limiar: a chance da próxima virada, com a Ameaça que ela vai dar, e o tamanho', () => {
    // 48 hoje, 50 depois da virada: 10%.
    const light = known(watched(48));
    expect(light.raidChancePercent).toBe(10);
    expect(light.raidRisk).toBe(
      'Se não houver outra a caminho, a próxima virada do dia tem 10% de chance de marcar uma incursão (a chance é o que a Ameaça passa de 40, em %); ela chega 6 h depois. Com a Ameaça abaixo de 70, o ataque é dos leves; a partir daí, dos médios. Toda incursão, repelida ou sofrida, baixa a Ameaça em 35.',
    );
    // 68 hoje, 70 depois da virada: 30%, e já dos médios.
    const medium = known(watched(68));
    expect(medium.raidChancePercent).toBe(30);
    expect(medium.raidRisk).toContain(
      'Com a Ameaça em 70 ou mais, o ataque é dos médios; abaixo disso, dos leves.',
    );
    expect(known(watched(100)).raidChancePercent).toBe(60);
  });

  it('o que a visão promete, a virada cumpre: a chance é a do sorteio daquele instante', () => {
    // Em muitas sementes, a fração de viradas que marcam incursão fica perto da chance anunciada.
    const state = watched(78, hordeAwake);
    const chance = known(state).raidChancePercent;
    expect(chance).toBe(40);
    let drawn = 0;
    const trials = 400;
    for (let seed = 0; seed < trials; seed += 1) {
      const next = advanceTo({ ...state, seed: `sorteio-${seed}` }, SUMMER + 3 * DAY).state;
      drawn += next.horde.scheduledRaids.length;
    }
    expect(drawn / trials).toBeGreaterThan(0.33);
    expect(drawn / trials).toBeLessThan(0.47);
  });

  it('o prazo sai no ritmo da partida', () => {
    expect(known(watched(45), 3).raidRisk).toContain('ela chega 2 h depois');
    expect(known(watched(45), 0.5).raidRisk).toContain('ela chega 12 h depois');
  });

  it('o custo de cada tamanho, e o que fica depois, em frases', () => {
    expect(known(watched(45), 3).raidCosts).toEqual([
      'Ataques leves: levam 10% do estoque de comida e madeira e ferem 1 aldeão.',
      'Ataques médios: levam 15% do estoque de comida e madeira e ferem 2 aldeões.',
      'Quem se fere fica 40 min sem trabalhar e volta ao ofício sozinho. Um ataque com perdas tira 10 da moral por 2 dias de jogo (1 h 20 min).',
    ]);
  });

  it('com uma incursão à vista: só há uma por vez, o que ela custa hoje e o que a Paliçada faz', () => {
    const state = watched(55, (draft) => {
      draft.settlement.buildings.watchtower = 2;
      draft.settlement.resources.food = 321_500;
      draft.settlement.resources.wood = 200_000;
      draft.horde.scheduledRaids = [raid(draft.lastProcessedAt + 50 * MINUTE, 'medium')];
    });
    const threat = known(state, 3);
    expect(threat.raidChancePercent).toBe(0);
    expect(threat.raidRisk).toBe(
      'Há uma incursão a caminho, e só há uma por vez: nenhuma outra é marcada até ela chegar. Toda incursão, repelida ou sofrida, baixa a Ameaça em 35.',
    );
    expect(threat.incoming).toMatchObject({
      sizeText: 'uma matilha grande',
      costText:
        'Sem defesa, uma matilha grande leva 15% do estoque de comida e madeira (hoje, 48,2 de comida e 30 de madeira) e fere 2 aldeões, que ficam 40 min sem trabalhar.',
      defenseText: 'Sem Paliçada, nada segura este ataque.',
    });
  });

  it('sem o tamanho à vista, o custo diz os dois e a visão inteira é a mesma para a leve e a média', () => {
    const state = (size: Size) =>
      watched(55, (draft) => {
        draft.horde.scheduledRaids = [raid(draft.lastProcessedAt + 50 * MINUTE, size)];
      });
    const light = deriveViewState(state('light'), state('light').lastProcessedAt);
    const medium = deriveViewState(state('medium'), state('medium').lastProcessedAt);
    expect(light).toEqual(medium);
    expect(light.threat.incoming?.costText).toBe(
      'Sem defesa, um ataque dos leves leva 10% do estoque de comida e madeira e fere 1 aldeão; um ataque dos médios leva 15% do estoque de comida e madeira e fere 2 aldeões. Quem se fere fica 2 h sem trabalhar.',
    );
  });

  it('a chance anunciada não denuncia a incursão que os vigias ainda não viram', () => {
    // A mesma Ameaça, com e sem uma incursão marcada fora da antecedência: a visão é a mesma.
    const hidden = watched(55, (draft) => {
      draft.horde.scheduledRaids = [raid(draft.lastProcessedAt + 3 * DAY, 'medium')];
    });
    const none = watched(55, (draft) => {
      draft.horde.scheduledRaids = [];
    });
    expect(deriveViewState(hidden, hidden.lastProcessedAt)).toEqual(
      deriveViewState(none, none.lastProcessedAt),
    );
  });

  describe('a previsão da próxima virada conta a incursão à vista (achado 2 da revisão)', () => {
    // Antes, com os lobos a 10 min, o painel dizia "vai de 70 para 75" e a virada entregava 65:
    // a previsão ignorava a incursão que a própria tela mostrava logo ao lado.
    const TURN_AT = SUMMER + 3 * DAY;
    const rise = rules.perActiveTilePerDay;
    /** A Torre no nível `tower` e uma incursão marcada para a virada, 30 min de jogo antes dela. */
    const sighted = (tower: number, threat: number, size: Size = 'light') =>
      watched(threat, (draft) => {
        draft.lastProcessedAt = TURN_AT - 30 * MINUTE;
        draft.clock.gameTimeMs = TURN_AT - 30 * MINUTE;
        draft.settlement.buildings.watchtower = tower;
        draft.horde.scheduledRaids = [raid(TURN_AT, size)];
      });

    it.each([1, 2])(
      'Torre Nv%i: o que a visão promete para a virada da incursão, a virada cumpre',
      (tower) => {
        for (const threat of [0, 10, 37, 55, 70, 98, 100]) {
          for (const size of RAID_SIZE_IDS) {
            const state = sighted(tower, threat, size);
            const promised = known(state, 3);
            expect(promised.incoming, `${tower}/${threat}`).not.toBeNull();
            const after = advanceTo(state, TURN_AT).state.map.threat;
            expect(after, `Torre ${tower}, Ameaça ${threat}`).toBe(promised.nextLevel);
            // A subida continua sendo a da virada, e é ela que a tela anuncia com a contagem.
            expect(promised.risePerDay).toBe(Math.min(rules.max, threat + rise) - threat);
          }
        }
      },
    );

    it('a frase conta a subida e a queda; no máximo, a queda; perto do zero, até zero', () => {
      expect(known(sighted(1, 70))).toMatchObject({
        level: 70,
        risePerDay: rise,
        nextLevel: 70 + rise - rules.raidDrop,
        trend: `Sobe ${rise} a cada dia de jogo (2 h), e a incursão à vista a faz cair ${rules.raidDrop}: na próxima virada, vai de 70 para ${70 + rise - rules.raidDrop}.`,
      });
      expect(known(sighted(2, 100))).toMatchObject({
        risePerDay: 0,
        nextLevel: 100 - rules.raidDrop,
        trend: `Está no máximo, e a incursão à vista a faz cair ${rules.raidDrop}: na próxima virada, vai de 100 para ${100 - rules.raidDrop}.`,
      });
      expect(known(sighted(1, 0))).toMatchObject({
        nextLevel: 0,
        trend: `Sobe ${rise} a cada dia de jogo (2 h), e a incursão à vista a faz cair até zero: na próxima virada, vai de 0 para 0.`,
      });
    });

    it('a incursão que os vigias ainda não viram não entra na previsão', () => {
      // A Torre Nv1 avisa 1 h antes: 90 min antes da virada, a incursão está fora da vista.
      const early = sighted(1, 70);
      early.lastProcessedAt = TURN_AT - 90 * MINUTE;
      early.clock.gameTimeMs = TURN_AT - 90 * MINUTE;
      const promised = known(early);
      expect(promised.incoming).toBeNull();
      expect(promised.nextLevel).toBe(70 + rise);
      expect(promised.trend).not.toContain('incursão');
    });

    it('no retrato montado à mão, com a incursão antes da virada, ela cai primeiro e a virada sobe depois', () => {
      const state = raidInSightScenario();
      const promised = known(state, 3);
      expect(promised.incoming).not.toBeNull();
      const turn = (Math.floor(state.lastProcessedAt / DAY) + 1) * DAY;
      expect(advanceTo(state, turn).state.map.threat).toBe(promised.nextLevel);
    });
  });
});

describe('os lobos do ano 1: os uivos e a incursão do roteiro (ADR 0014, decisão 10)', () => {
  const HOWL_AT = 9 * DAY;
  const WOLVES_AT = 15 * DAY;

  it('uma partida nova nasce com a incursão do roteiro marcada para o início do 16º dia de jogo', () => {
    expect(newGame().horde.scheduledRaids).toEqual([
      {
        id: 'wolvesYear1',
        atMs: WOLVES_AT,
        kind: 'scripted',
        enemy: 'wolves',
        size: 'light',
        announcedAtMs: null,
      },
    ]);
    expect(WOLVES_AT).toBe(30 * HOUR);
    expect(scriptedRaidsAfter(WOLVES_AT - 1)).toHaveLength(1);
    // Quem já está no instante dela, ou depois, não a recebe.
    expect(scriptedRaidsAfter(WOLVES_AT)).toEqual([]);
  });

  it('os uivos soam no início do 10º dia, sem informação nenhuma, e dizem que falta quem vigie', () => {
    const state = gameWith(quietCouncil);
    expect(eventsOfType(advanceTo(state, HOWL_AT - 1).events, 'wolvesHowl')).toEqual([]);
    const { events } = advanceTo(state, HOWL_AT);
    const howl = only(events, 'wolvesHowl');
    expect(howl.atMs).toBe(HOWL_AT);
    expect(howl.text).toBe(
      'No 10º dia da Primavera, ouviram-se uivos na mata ao redor de Pedra Alta. Sem quem vigie, ninguém sabe quantos são.',
    );
    expect(howl.data).toEqual({ enemy: 'wolves', watched: 0 });
    // Uma vez só.
    expect(eventsOfType(advanceTo(state, WOLVES_AT - 1).events, 'wolvesHowl')).toHaveLength(1);
  });

  it('com a Torre, a frase dos uivos fala dos vigias', () => {
    const state = gameWith((draft) => {
      quietCouncil(draft);
      draft.settlement.buildings.townHall = 2;
      draft.settlement.buildings.watchtower = 1;
    });
    const howl = only(advanceTo(state, HOWL_AT).events, 'wolvesHowl');
    expect(howl.text).toBe(
      'No 10º dia da Primavera, ouviram-se uivos na mata ao redor de Pedra Alta. Os vigias dobraram a ronda.',
    );
    expect(howl.data).toEqual({ enemy: 'wolves', watched: 1 });
  });

  it('os lobos chegam com o senhor fora, no instante marcado, e a derrota custa pouco', () => {
    const state = gameWith((draft) => {
      quietCouncil(draft);
      draft.settlement.workers = { farm: 2, lumberMill: 2, quarry: 1, goldMine: 0 };
    });
    const before = advanceTo(state, WOLVES_AT - 1);
    expect(eventsOfType(before.events, 'raidSuffered')).toEqual([]);
    const { state: after, events } = advanceTo(state, WOLVES_AT);
    const suffered = only(events, 'raidSuffered');
    expect(suffered.atMs).toBe(WOLVES_AT);
    expect(suffered.data).toMatchObject({
      raidId: 'wolvesYear1',
      size: 'light',
      warning: 'unwarned',
      palisadeLevel: 0,
      injured: 1,
      palisadeLevelNeeded: 1,
    });
    expect(suffered.text).toMatch(
      /^No 16º dia da Primavera, os lobos chegaram a Pedra Alta sem que ninguém os visse vir\. Nada os deteve: o ataque custou .* de comida, .* de madeira e um aldeão ferido\. Uma paliçada os teria detido\.$/,
    );
    // 10% do que havia, e nada mais: pedra e ouro ficam.
    const stock = before.state.settlement.resources;
    expect(after.settlement.resources.stone).toBeGreaterThanOrEqual(stock.stone);
    expect(after.settlement.resources.gold).toBeGreaterThanOrEqual(stock.gold);
    expect(Number(suffered.data.raided_food)).toBeLessThanOrEqual((stock.food + 10) / 10_000);
    expect(Number(suffered.data.raided_food)).toBeGreaterThan(0);
    expect(after.horde.scheduledRaids).toEqual([]);
    // A Ameaça, que ninguém vê, chegou a 30 na virada e a incursão a derrubou a zero.
    expect(after.map.threat).toBe(0);
  });

  it('enquanto a do roteiro está marcada, a Ameaça não sorteia outra: a primeira é sempre a leve', () => {
    // No jogo a Ameaça chega a 30 no 15º dia; aqui ela é posta à mão acima de 40 desde o início,
    // e chega a 78 sem que o gerador seja tocado.
    for (const seed of ['a', 'b', 'c', 'd', 'e', 'f']) {
      const start = gameWith((draft) => {
        quietCouncil(draft);
        draft.seed = seed;
        draft.map.threat = 50;
      });
      const { state, events } = advanceTo(start, WOLVES_AT - 1);
      expect(state.map.threat).toBe(50 + 14 * rules.perActiveTilePerDay);
      expect(state.rng.horde).toBeUndefined();
      expect(state.horde.scheduledRaids.map((entry) => entry.id)).toEqual(['wolvesYear1']);
      expect(events.filter((event) => /^raid/.test(event.type))).toEqual([]);
    }
  });

  it('com a Torre erguida a tempo, os vigias avisam dos lobos do roteiro como de quaisquer outros', () => {
    const state = gameWith((draft) => {
      quietCouncil(draft);
      draft.settlement.buildings.townHall = 2;
      draft.settlement.buildings.watchtower = 1;
    });
    const { events } = advanceTo(state, WOLVES_AT);
    expect(only(events, 'raidAnnounced').atMs).toBe(WOLVES_AT - HOUR);
    expect(only(events, 'raidSuffered').data.warning).toBe('warned');
  });

  it('a incursão do roteiro é só do ano 1: não se repete no ano 2', () => {
    const start = gameWith((draft) => {
      quietCouncil(draft);
      draft.settlement.workers = { farm: 3, lumberMill: 2, quarry: 0, goldMine: 0 };
    });
    const { events } = advanceTo(start, YEAR + 20 * DAY);
    const scripted = events.filter((event) => event.data.raidId === 'wolvesYear1');
    expect(scripted.map((event) => event.type)).toEqual(['raidSuffered', 'villagerInjured']);
    expect(eventsOfType(events, 'wolvesHowl')).toHaveLength(1);
    // No ano 2 as incursões continuam, mas são as da Ameaça.
    const secondYear = events.filter(
      (event) => event.atMs >= YEAR && /^raid(Suffered|Repelled)$/.test(event.type),
    );
    for (const event of secondYear) {
      expect(String(event.data.raidId)).toMatch(/^threat-\d+$/);
    }
  });

  it('um feudo posto no inverno do ano 1 já passou dos lobos: não os recebe', () => {
    const state = gameAt(WINTER, hordeAwake);
    expect(state.horde.scheduledRaids).toEqual([]);
  });
});

describe('as incursões por Ameaça (ADR 0014, decisões 10 e 11)', () => {
  const TURN = SUMMER + 3 * DAY;
  /** Um feudo no meio de um dia de verão, sem incursão marcada: a próxima virada pode sortear. */
  const awake = (
    threat: number,
    seed = 'pedra-alta',
    edit: (draft: GameState) => void = () => {},
  ) =>
    gameAt(TURN - 50 * MINUTE, (draft) => {
      draft.seed = seed;
      draft.map.threat = threat;
      draft.settlement.workers = { farm: 3, lumberMill: 1, quarry: 1, goldMine: 0 };
      hordeAwake(draft);
      edit(draft);
    });
  /** As incursões que a virada marcou, em `trials` sementes. */
  const drawnOver = (threat: number, trials: number) => {
    const marked: ScheduledRaid[] = [];
    for (let seed = 0; seed < trials; seed += 1) {
      marked.push(...advanceTo(awake(threat, `semente-${seed}`), TURN).state.horde.scheduledRaids);
    }
    return marked;
  };

  it('com a Ameaça em 40 ou menos depois da virada, nada é sorteado e o gerador não anda', () => {
    // 38 + 2 = 40: chegar ao limiar ainda não sorteia; a chance é o que **passa** dele.
    for (const threat of [0, 20, 38]) {
      const { state } = advanceTo(awake(threat), TURN);
      expect(state.map.threat).toBe(threat + rules.perActiveTilePerDay);
      expect(state.horde.scheduledRaids).toEqual([]);
      expect(state.rng.horde).toBeUndefined();
    }
  });

  it('acima de 40, a chance da virada é a Ameaça menos 40, em %', () => {
    const trials = 600;
    // 41 depois da virada: 1%. 60: 20%. 100: 60%.
    expect(drawnOver(39, trials).length / trials).toBeLessThan(0.04);
    const twenty = drawnOver(58, trials).length / trials;
    expect(twenty).toBeGreaterThan(0.15);
    expect(twenty).toBeLessThan(0.25);
    const sixty = drawnOver(100, trials).length / trials;
    expect(sixty).toBeGreaterThan(0.54);
    expect(sixty).toBeLessThan(0.66);
    // Com a chance em jogo, o gerador andou, tenha saído incursão ou não.
    expect(advanceTo(awake(55), TURN).state.rng.horde).toHaveLength(4);
    expect(rules.raidChanceAbove).toBe(40);
  });

  it('o tamanho vem da Ameaça já somada: leve abaixo de 70, média a partir de 70', () => {
    const sizes = (threat: number) => new Set(drawnOver(threat, 200).map((entry) => entry.size));
    expect([...sizes(45)]).toEqual(['light']);
    // 67 + 2 = 69: ainda leve. 68 + 2 = 70: média.
    expect([...sizes(67)]).toEqual(['light']);
    expect([...sizes(68)]).toEqual(['medium']);
    expect([...sizes(95)]).toEqual(['medium']);
    expect(rules.mediumRaidAbove).toBe(70);
  });

  it('a incursão sorteada chega 6 h de jogo depois, em outra virada de dia, e são os lobos do covil', () => {
    const [marked] = drawnOver(100, 5);
    expect(marked).toEqual({
      id: 'threat-1',
      atMs: TURN + rules.raidLeadMs,
      kind: 'threat',
      enemy: 'wolves',
      size: 'medium',
      announcedAtMs: null,
    });
    expect(rules.raidLeadMs).toBe(6 * HOUR);
    expect((TURN + rules.raidLeadMs) % DAY).toBe(0);
  });

  it('o sorteio não vira evento nem linha: sem Torre ninguém fica sabendo até os lobos chegarem', () => {
    for (let seed = 0; seed < 30; seed += 1) {
      const start = awake(100, `calado-${seed}`);
      const { state, events } = advanceTo(start, TURN);
      expect(events.filter((event) => /raid|wolves|threat/i.test(event.type))).toEqual([]);
      const view = deriveViewState(state, state.lastProcessedAt);
      expect(view.threat).toEqual(deriveViewState(start, start.lastProcessedAt).threat);
    }
  });

  it('no máximo uma por vez: com uma incursão marcada, o gerador não anda até ela chegar', () => {
    const start = awake(100, 'uma-por-vez', (draft) => {
      draft.horde.scheduledRaids = [raid(TURN + 2 * DAY, 'light', 'threat-9')];
    });
    const waiting = advanceTo(start, TURN + 2 * DAY - 1).state;
    expect(waiting.rng.horde).toBeUndefined();
    expect(waiting.horde.scheduledRaids.map((entry) => entry.id)).toEqual(['threat-9']);
    // Na virada em que ela chega o sorteio ainda a encontra marcada (a virada vem antes da
    // incursão): a seguinte só pode ser sorteada um dia depois.
    const arrived = advanceTo(start, TURN + 2 * DAY).state;
    expect(arrived.rng.horde).toBeUndefined();
    expect(arrived.horde.scheduledRaids).toEqual([]);
    expect(advanceTo(arrived, TURN + 3 * DAY).state.rng.horde).toHaveLength(4);
  });

  it('sem tile de ameaça ativo não há quem ataque: nada é sorteado', () => {
    const { state } = advanceTo(
      awake(100, 'sem-covil', (draft) => {
        draft.map.tiles = { wolfDen: { type: 'wolfDen', threatActive: false } };
      }),
      TURN + 10 * DAY,
    );
    expect(state.horde.scheduledRaids).toEqual([]);
    expect(state.rng.horde).toBeUndefined();
  });

  it('toda incursão, repelida ou sofrida, baixa a Ameaça em raidDrop; ela volta a subir, e a marca cruzada de novo vira linha de novo, com a frase da volta', () => {
    // Com a Torre, a Ameaça a uma subida dos 70 e uma incursão média à porta, que a Paliçada
    // Nv2 repele. A prova de que a Ameaça oscila ao longo do ano é o teste do achado 8, abaixo.
    const rise = rules.perActiveTilePerDay;
    const start = gameAt(TURN - 50 * MINUTE, (draft) => {
      draft.settlement.buildings.townHall = 3;
      draft.settlement.buildings.watchtower = 1;
      draft.settlement.buildings.palisade = 2;
      draft.settlement.workers = { farm: 3, lumberMill: 1, quarry: 1, goldMine: 0 };
      draft.map.threat = 70 - rise;
    });
    // O sorteio fica calado: a única incursão é a marcada à mão.
    start.horde.scheduledRaids = [raid(TURN + DAY, 'medium'), ...start.horde.scheduledRaids];
    // As viradas que a Ameaça leva para voltar aos 70 depois da queda.
    const back = Math.ceil((rules.raidDrop - rise) / rise);
    const { state, events } = advanceTo(start, TURN + (1 + back) * DAY);
    // A virada leva aos 70; a seguinte sobe mais e a incursão repelida a derruba.
    const repelled = only(events, 'raidRepelled');
    expect(repelled.atMs).toBe(TURN + DAY);
    expect(repelled.data).toMatchObject({
      threat: 70 + rise - rules.raidDrop,
      previousThreat: 70 + rise,
    });
    // Depois ela volta a subir, e cruzar os 70 de novo dá a linha de novo, com a frase da volta.
    const seventy = eventsOfType(events, 'threatRose').filter((event) => event.data.mark === 70);
    expect(seventy.map((event) => (event.atMs - TURN) / DAY)).toEqual([0, 1 + back]);
    expect(seventy[0]?.text).toContain('já não dormem');
    expect(seventy[1]?.text).toContain('tornam a ver olhos acesos');
    expect(state.map.threat).toBe(70 + rise - rules.raidDrop + back * rise);
  });
});

describe('interações no mesmo instante (roadmap V2E-T3.4)', () => {
  it('a comida que acaba no instante do ataque: a incursão vem antes, e a fome abre por último', () => {
    // 10 bocas, ninguém na Fazenda: 60 de comida duram exatamente as 6 h até o ataque.
    const start = feud({
      edit: (draft) => {
        draft.settlement.workers = { farm: 0, lumberMill: 4, quarry: 3, goldMine: 3 };
        draft.settlement.resources.food = 60_000;
      },
    });
    const { state, events } = advanceTo(start, RAID_AT);
    const at = events.filter((event) => event.atMs === RAID_AT).map((event) => event.type);
    expect(at.slice(-3)).toEqual(['raidSuffered', 'villagerInjured', 'famineStarted']);
    // Da despensa vazia os lobos não levam nada; a madeira vai.
    const suffered = only(events, 'raidSuffered');
    expect(suffered.data).not.toHaveProperty('raided_food');
    expect(Number(suffered.data.raided_wood)).toBeGreaterThan(0);
    expect(state.settlement.resources.food).toBe(0);
    expect(state.settlement.famine).toEqual(famineSince(RAID_AT));
  });

  it('a fome já aberta: o ataque leva a madeira, fere, e a fome continua com a data que tinha', () => {
    const start = feud({
      edit: (draft) => {
        draft.settlement.workers = { farm: 0, lumberMill: 4, quarry: 3, goldMine: 3 };
        draft.settlement.resources.food = 0;
        starve(draft, LEFT_AT - HOUR);
      },
    });
    const { state, events } = advanceTo(start, RAID_AT + HOUR);
    expect(state.settlement.famine).toEqual(famineSince(LEFT_AT - HOUR));
    expect(eventsOfType(events, 'famineStarted')).toEqual([]);
    expect(eventsOfType(events, 'famineEnded')).toEqual([]);
    expect(state.settlement.resources.food).toBe(0);
    expect(state.settlement.injured).toHaveLength(1);
  });

  it('o lavrador ferido pode abrir a fome mais cedo: no instante exato em que a comida acaba, nunca abaixo de zero', () => {
    // A Fazenda cobre as bocas por pouco; sem um lavrador, deixa de cobrir.
    const tight = (palisade: number) =>
      feud({
        palisade,
        edit: (draft) => {
          const { settlement } = draft;
          settlement.population.villagers = 20;
          settlement.buildings.housing = 3;
          settlement.workers = { farm: 2, lumberMill: 6, quarry: 6, goldMine: 6 };
          settlement.resources.food = 4_000;
        },
      });
    const safe = advanceTo(tight(1), RAID_AT + raids.injuryMs - 1);
    expect(eventsOfType(safe.events, 'famineStarted')).toEqual([]);
    let state = tight(0);
    const events: GameEvent[] = [];
    for (let at = LEFT_AT + 7 * MINUTE; at <= RAID_AT + raids.injuryMs - 1; at += 7 * MINUTE) {
      const step = advanceTo(state, at);
      state = step.state;
      events.push(...step.events);
      expect(state.settlement.resources.food).toBeGreaterThanOrEqual(0);
      expect(state.settlement.resources.wood).toBeGreaterThanOrEqual(0);
    }
    // O ferido saiu do edifício com mais gente (não da Fazenda), e ainda assim a despensa
    // menor encurta o prazo: a fome, se vier, vem em um instante depois do ataque.
    for (const famine of eventsOfType(events, 'famineStarted')) {
      expect(famine.atMs).toBeGreaterThan(RAID_AT);
    }
  });

  it('o frio: no inverno, a madeira que os lobos levam apaga a lareira mais cedo, no instante exato', () => {
    const winterRaid = WINTER + 3 * DAY;
    const cold = (palisade: number) =>
      gameAt(winterRaid - DAY, (draft) => {
        const { settlement } = draft;
        settlement.buildings = { ...settlement.buildings, townHall: 3, housing: 2, palisade };
        settlement.population.villagers = 10;
        settlement.workers = { farm: 10, lumberMill: 0, quarry: 0, goldMine: 0 };
        // 10 habitantes queimam 5 de madeira por hora: 30 duram 6 h.
        settlement.resources = { food: 400_000, wood: 30_000, stone: 0, gold: 0 };
        draft.horde.scheduledRaids = [raid(winterRaid)];
      });
    const coldAt = (state: GameState) =>
      eventsOfType(advanceTo(state, winterRaid + 3 * DAY).events, 'coldStarted')[0]?.atMs;
    // Protegido: 30 de madeira duram 6 h a contar da saída.
    expect(coldAt(cold(1))).toBe(winterRaid - DAY + 6 * HOUR);
    // Atacado 2 h depois da saída: dos 20 que restavam, os lobos levam 2; os 18 duram 3 h 36.
    expect(coldAt(cold(0))).toBe(winterRaid + (18 * HOUR) / 5);
    const hit = advanceTo(cold(0), winterRaid + 3 * DAY).state;
    expect(hit.settlement.resources.wood).toBe(0);
    expect(hit.settlement.cold).not.toBeNull();
  });

  it('o recruta que chega no instante do ataque já está no feudo: sem ofício, é ele quem se fere', () => {
    const start = feud({
      edit: (draft) => {
        draft.settlement.recruitmentQueue = [{ finishesAtMs: RAID_AT }];
      },
    });
    const { state, events } = advanceTo(start, RAID_AT);
    const types = events.filter((event) => event.atMs === RAID_AT).map((event) => event.type);
    expect(types.indexOf('recruitmentFinished')).toBeLessThan(types.indexOf('raidSuffered'));
    expect(state.settlement.population.villagers).toBe(11);
    expect(state.settlement.injured).toEqual([
      { untilMs: RAID_AT + raids.injuryMs, building: null },
    ]);
    expect(state.settlement.workers).toEqual({ farm: 4, lumberMill: 3, quarry: 2, goldMine: 1 });
  });

  it('o colono que a moral alta traz na mesma virada também chega antes dos lobos', () => {
    // Moral 80 e vaga nas casas: a virada sorteia a chegada. Em alguma semente ele chega.
    let arrivals = 0;
    for (let seed = 0; seed < 40 && arrivals === 0; seed += 1) {
      const start = feud({
        atMs: RAID_AT - 10 * MINUTE,
        edit: (draft) => {
          draft.seed = `colono-${seed}`;
          draft.settlement.moraleEffects = [
            { id: 'teste:festa', label: 'Festa', amount: 30, untilMs: RAID_AT + 5 * DAY },
          ];
        },
      });
      const { state, events } = advanceTo(start, RAID_AT);
      if (eventsOfType(events, 'villagerArrived').length === 0) {
        continue;
      }
      arrivals += 1;
      const types = events.map((event) => event.type);
      expect(types.indexOf('villagerArrived')).toBeLessThan(types.indexOf('raidSuffered'));
      // O colono chegou sem ofício: é ele quem se fere, e nenhum ofício perde gente.
      expect(state.settlement.injured[0]?.building).toBeNull();
      expect(state.settlement.workers.farm).toBe(4);
    }
    expect(arrivals).toBe(1);
  });

  it('duas incursões no mesmo instante não acontecem no jogo; se o estado trouxer duas, cada uma é resolvida uma vez, em ordem', () => {
    const start = feud({
      edit: (draft) => {
        draft.horde.scheduledRaids = [
          raid(RAID_AT, 'light', 'threat-1'),
          raid(RAID_AT, 'medium', 'threat-2'),
        ];
      },
    });
    const { state, events } = advanceTo(start, BACK_AT);
    expect(eventsOfType(events, 'raidSuffered').map((event) => event.data.raidId)).toEqual([
      'threat-1',
      'threat-2',
    ]);
    expect(state.horde.scheduledRaids).toEqual([]);
    expect(state.stats.raids_suffered).toBe(2);
    // Três feridos, um termo de moral só (o mesmo id troca o efeito, não soma).
    expect(eventsOfType(events, 'villagerInjured')).toHaveLength(3);
    expect(advanceTo(start, RAID_AT).state.settlement.moraleEffects).toHaveLength(1);
  });

  it('a migração no meio da janela de aviso: o alarme soa na fronteira, uma vez, e a virada não se repete', () => {
    // Como a migração deixa a partida: a Torre erguida, os lobos do roteiro marcados e ninguém
    // avisado, com o relógio parado meia hora de jogo antes do ataque.
    const WOLVES_AT = 15 * DAY;
    const boundary = WOLVES_AT - 30 * MINUTE;
    const migrated = gameAt(boundary, (draft) => {
      draft.settlement.buildings.townHall = 2;
      draft.settlement.buildings.watchtower = 1;
      draft.migratedAtMs = boundary;
      hordeAwake(draft);
    });
    expect(migrated.horde.scheduledRaids[0]?.announcedAtMs).toBeNull();
    // A visão já mostra a incursão, antes de qualquer avanço.
    expect(threatOf(migrated).incoming).not.toBeNull();
    const first = advanceTo(migrated, boundary + 1);
    const announced = only(first.events, 'raidAnnounced');
    expect(announced.atMs).toBe(boundary);
    expect(first.events.map((event) => event.type)).toEqual(['raidAnnounced']);
    expect(first.state.horde.scheduledRaids[0]?.announcedAtMs).toBe(boundary);
    // Daí em diante é uma partida como as outras: nenhum alarme de novo, e os lobos chegam.
    const rest = advanceTo(first.state, WOLVES_AT);
    expect(eventsOfType(rest.events, 'raidAnnounced')).toEqual([]);
    expect(only(rest.events, 'raidSuffered').data.warning).toBe('warned');
    // De uma vez dá o mesmo.
    const whole = advanceTo(migrated, WOLVES_AT);
    expect(whole.state).toEqual(rest.state);
    expect(whole.events).toEqual([...first.events, ...rest.events]);
  });

  it('uma partida migrada em cima de uma virada de dia com o alarme devido não repete a virada', () => {
    // A Torre no nível 2 avisa 2 h antes: a fronteira cai exatamente na virada do aviso.
    const WOLVES_AT = 15 * DAY;
    const boundary = WOLVES_AT - 2 * HOUR;
    const migrated = gameAt(boundary, (draft) => {
      draft.settlement.buildings.townHall = 2;
      draft.settlement.buildings.watchtower = 2;
      hordeAwake(draft);
    });
    const { events } = advanceTo(migrated, boundary + 1);
    expect(events.map((event) => event.type)).toEqual(['raidAnnounced']);
    expect(eventsOfType(events, 'dayStarted')).toEqual([]);
  });
});

describe('o aviso da Torre em tempo real (V2G-T3; ADR 0016, item 4)', () => {
  /** Uma partida nova, no ritmo dado, com a Torre no nível pedido desde o primeiro dia. */
  const watching = (timeScale: number, tower: number, seed = 'pedra-alta') =>
    gameWith((draft) => {
      quietCouncil(draft);
      draft.seed = seed;
      draft.settings.timeScale = timeScale;
      draft.settlement.buildings.townHall = 3;
      draft.settlement.buildings.watchtower = tower;
      draft.settlement.workers = { farm: 3, lumberMill: 1, quarry: 1, goldMine: 0 };
    });
  const WOLVES_AT = 15 * DAY;

  it.each([
    // Em horas de jogo: os lobos do roteiro chegam às 30 h.
    { timeScale: 3, tower: 1, hour: 27 },
    { timeScale: 3, tower: 2, hour: 24 },
    { timeScale: 1, tower: 1, hour: 29 },
    { timeScale: 1, tower: 2, hour: 28 },
    { timeScale: 0.5, tower: 1, hour: 29.5 },
    { timeScale: 0.5, tower: 2, hour: 29 },
  ])(
    'ritmo $timeScale, Torre Nv$tower: o alarme dos lobos do roteiro soa às $hour h de jogo, $tower h reais antes',
    ({ timeScale, tower, hour }) => {
      const start = watching(timeScale, tower);
      const before = advanceTo(start, hour * HOUR - 1);
      expect(eventsOfType(before.events, 'raidAnnounced')).toEqual([]);
      expect(threatOf(before.state).incoming).toBeNull();
      const at = advanceTo(before.state, hour * HOUR);
      expect(only(at.events, 'raidAnnounced').atMs).toBe(hour * HOUR);
      // A antecedência em tempo real é a mesma em qualquer ritmo: uma hora por nível.
      expect((WOLVES_AT - hour * HOUR) / timeScale).toBe(tower * HOUR);
      expect(threatOf(at.state).incoming?.inSeconds).toBe(tower * 3600);
      // O alarme soa uma vez, e os lobos chegam no instante de sempre.
      const rest = advanceTo(at.state, WOLVES_AT + DAY);
      expect(eventsOfType(rest.events, 'raidAnnounced')).toEqual([]);
      const suffered = only(rest.events, 'raidSuffered');
      expect(suffered.atMs).toBe(WOLVES_AT);
      expect(suffered.data.warning).toBe(tower === 2 ? 'sized' : 'warned');
    },
  );

  it('no Rápido, o nível 2 avisa da incursão sorteada na própria virada do sorteio: 2 h reais são as 6 h de jogo do prazo', () => {
    let seen = 0;
    for (let index = 0; index < 20; index += 1) {
      // Depois dos lobos do roteiro, com a Ameaça alta: cada virada pode marcar uma incursão.
      const start = gameAt(SUMMER + 30 * MINUTE, (draft) => {
        draft.seed = `sorteio-${index}`;
        draft.settings.timeScale = 3;
        draft.settlement.buildings.townHall = 3;
        draft.settlement.buildings.watchtower = 2;
        draft.map.threat = 90;
        hordeAwake(draft);
      });
      const turn = SUMMER + DAY;
      const { state, events } = advanceTo(start, turn);
      const [drawn] = state.horde.scheduledRaids;
      if (drawn === undefined) {
        expect(eventsOfType(events, 'raidAnnounced')).toEqual([]);
        continue;
      }
      seen += 1;
      // Sorteada e anunciada no mesmo instante, depois da virada do dia; chega 6 h de jogo depois.
      expect(drawn.atMs).toBe(turn + rules.raidLeadMs);
      expect(drawn.announcedAtMs).toBe(turn);
      const order = events.filter((event) => event.atMs === turn).map((event) => event.type);
      expect(order.indexOf('dayStarted')).toBeLessThan(order.indexOf('raidAnnounced'));
      expect(threatOf(state).incoming?.inSeconds).toBe(2 * 3600);
      // No nível 1 a mesma incursão só é avistada uma hora real antes: 3 h de jogo.
      const lower = advanceTo(
        {
          ...start,
          settlement: {
            ...start.settlement,
            buildings: { ...start.settlement.buildings, watchtower: 1 },
          },
        },
        turn + rules.raidLeadMs - 1,
      );
      expect(only(lower.events, 'raidAnnounced').atMs).toBe(turn + 3 * HOUR);
    }
    expect(seen).toBeGreaterThan(3);
  });

  describe('partidas em andamento, gravadas com a antecedência de antes (em tempo de jogo)', () => {
    it('no Rápido, a incursão que a antecedência nova já alcança é anunciada no primeiro instante processado, uma vez', () => {
      // Torre Nv1, duas horas de jogo antes do ataque: pela regra antiga (1 h de jogo) ninguém
      // tinha avisado; pela nova (1 h real, 3 h de jogo) a incursão já está à vista.
      const boundary = RAID_AT - 2 * HOUR;
      const saved = feud({ tower: 1, timeScale: 3, atMs: boundary });
      expect(saved.horde.scheduledRaids[0]?.announcedAtMs).toBeNull();
      // A visão já a mostra, antes de qualquer avanço.
      expect(threatOf(saved).incoming).toMatchObject({ inSeconds: 40 * 60, sizeText: null });
      const first = advanceTo(saved, boundary + 1);
      expect(first.events.map((event) => [event.type, event.atMs])).toEqual([
        ['raidAnnounced', boundary],
      ]);
      expect(first.state.horde.scheduledRaids[0]?.announcedAtMs).toBe(boundary);
      const rest = advanceTo(first.state, BACK_AT);
      expect(eventsOfType(rest.events, 'raidAnnounced')).toEqual([]);
      expect(only(rest.events, 'raidSuffered').data.warning).toBe('warned');
      // De uma vez, ou com o corte em qualquer lugar, dá o mesmo.
      const whole = advanceTo(saved, BACK_AT);
      expect(whole.state).toStrictEqual(rest.state);
      expect(whole.events).toStrictEqual([...first.events, ...rest.events]);
      expect(eventsOfType(whole.events, 'raidAnnounced')).toHaveLength(1);
    });

    it('no Rápido, a incursão ainda fora da antecedência nova espera o instante dela', () => {
      // Quatro horas de jogo antes: fora das 3 h de jogo do nível 1.
      const saved = feud({ tower: 1, timeScale: 3, atMs: RAID_AT - 4 * HOUR });
      expect(threatOf(saved).incoming).toBeNull();
      expect(advanceTo(saved, RAID_AT - 3 * HOUR - 1).events).toEqual([]);
      const { events } = advanceTo(saved, RAID_AT - 3 * HOUR);
      expect(only(events, 'raidAnnounced').atMs).toBe(RAID_AT - 3 * HOUR);
    });

    it('no Tranquilo, a incursão já anunciada continua anunciada e à vista, e o alarme não soa de novo', () => {
      // Torre Nv1: o alarme soou uma hora de jogo antes do ataque, pela regra antiga. A
      // antecedência nova (1 h real) é de meia hora de jogo, e a partida está entre as duas.
      const boundary = RAID_AT - 45 * MINUTE;
      const saved = feud({
        tower: 1,
        timeScale: 0.5,
        atMs: boundary,
        edit: (draft) => {
          const [marked] = draft.horde.scheduledRaids;
          if (marked !== undefined) {
            marked.announcedAtMs = RAID_AT - HOUR;
          }
        },
      });
      // Continua à vista: 45 min de jogo são 1 h 30 reais.
      expect(threatOf(saved).incoming).toMatchObject({ inSeconds: 90 * 60, sizeText: null });
      const { state, events } = advanceTo(saved, BACK_AT);
      expect(eventsOfType(events, 'raidAnnounced')).toEqual([]);
      expect(only(events, 'raidSuffered').data.warning).toBe('warned');
      expect(state.horde.scheduledRaids).toEqual([]);
      // Com cortes em volta do instante em que a antecedência nova começaria, nada muda.
      for (const offset of [-1, 0, 1]) {
        const first = advanceTo(saved, RAID_AT - 30 * MINUTE + offset);
        expect(first.events).toEqual([]);
        expect(first.state.horde.scheduledRaids[0]?.announcedAtMs).toBe(RAID_AT - HOUR);
        expect(threatOf(first.state).incoming).not.toBeNull();
        const second = advanceTo(first.state, BACK_AT);
        expect(second.state).toStrictEqual(state);
        expect(second.events).toStrictEqual(events);
      }
    });

    it('no Tranquilo, a incursão que ninguém anunciou ainda usa a antecedência nova', () => {
      const saved = feud({ tower: 2, timeScale: 0.5, atMs: RAID_AT - 3 * HOUR });
      // Nível 2: 2 h reais, uma hora de jogo (e não as duas de antes).
      expect(eventsOfType(advanceTo(saved, RAID_AT - HOUR - 1).events, 'raidAnnounced')).toEqual(
        [],
      );
      const { events } = advanceTo(saved, RAID_AT - HOUR);
      expect(only(events, 'raidAnnounced')).toMatchObject({
        atMs: RAID_AT - HOUR,
        data: { warning: 'sized', size: 'light' },
      });
    });

    it('a forma do estado não mudou: a antecedência é derivada do nível da Torre e do ritmo', () => {
      const saved = feud({ tower: 2, timeScale: 3 });
      const { state } = advanceTo(saved, BACK_AT);
      expect(Object.keys(state.horde)).toEqual(['scheduledRaids']);
      expect(Object.keys(saved.horde.scheduledRaids[0] ?? {})).toEqual([
        'id',
        'atMs',
        'kind',
        'enemy',
        'size',
        'announcedAtMs',
      ]);
    });
  });
});

describe('30 dias e dois anos de jogo com o senhor fora', () => {
  /** Um feudo novo que se alimenta sozinho, sem defesa, deixado à própria sorte. */
  const left = (seed: string, palisade = 0) =>
    gameWith((draft) => {
      quietCouncil(draft);
      draft.seed = seed;
      draft.settlement.workers = { farm: 3, lumberMill: 1, quarry: 1, goldMine: 0 };
      draft.settlement.buildings.palisade = palisade;
    });
  const resolved = (events: GameEvent[]) =>
    events.filter((event) => event.type === 'raidSuffered' || event.type === 'raidRepelled');
  const SEEDS = ['pedra-alta', 'vau-do-lobo', 'monte-claro', 'ribeira', 'cerro-velho'];

  it('30 dias de jogo: os uivos, a incursão do roteiro, e depois as da Ameaça, uma de cada vez', () => {
    for (const seed of SEEDS) {
      const { state, events } = advanceTo(left(seed), 30 * DAY);
      const raidsSeen = resolved(events);
      expect(eventsOfType(events, 'wolvesHowl').map((event) => event.atMs)).toEqual([9 * DAY]);
      // A primeira é a do roteiro, leve, no início do 16º dia.
      expect(raidsSeen[0]?.data).toMatchObject({ raidId: 'wolvesYear1', size: 'light' });
      expect(raidsSeen[0]?.atMs).toBe(15 * DAY);
      // As seguintes vêm da Ameaça, numeradas na ordem da partida, e nunca em menos de 4 dias
      // de jogo da anterior: o sorteio só volta na virada seguinte à chegada, e a marcada leva 3.
      raidsSeen.slice(1).forEach((event, index) => {
        expect(event.data.raidId).toBe(`threat-${index + 2}`);
        const previous = raidsSeen[index];
        expect(event.atMs - (previous?.atMs ?? 0)).toBeGreaterThanOrEqual(rules.raidLeadMs + DAY);
      });
      expect(state.horde.scheduledRaids.length).toBeLessThanOrEqual(1);
      expect(state.settlement.population.villagers).toBe(5);
    }
  });

  it('com a Torre desde o começo, um ano: a frase de cada marca não se repete na volta, que diz que os lobos voltaram (achado 1 da revisão)', () => {
    // Antes, a incursão do roteiro derrubava a Ameaça de 75 para 65 e a virada seguinte a levava
    // de novo a 70: a mesma frase dos 70, palavra por palavra, nos dias 15 e 17 de toda partida.
    for (const seed of SEEDS) {
      const watched = gameWith((draft) => {
        quietCouncil(draft);
        draft.seed = seed;
        draft.settlement.workers = { farm: 3, lumberMill: 1, quarry: 1, goldMine: 0 };
        draft.settlement.buildings.townHall = 2;
        draft.settlement.buildings.watchtower = 1;
      });
      const lines = eventsOfType(advanceTo(watched, YEAR).events, 'threatRose');
      // A Ameaça volta a alguma marca depois de uma incursão em toda semente.
      expect(lines.length, seed).toBeGreaterThan(rules.chronicleMarks.length);
      // O que a frase diz, sem a data e sem o número.
      const said = (event: GameEvent) =>
        event.text.replace(/^No \d+º dia \S+ \S+, /, '').replace(/\d+\.$/, '');
      for (const mark of rules.chronicleMarks) {
        const [first, ...returns] = lines.filter((event) => event.data.mark === mark).map(said);
        for (const text of returns) {
          expect(text, `${seed}, marca ${mark}`).not.toBe(first);
          expect(text, `${seed}, marca ${mark}`).toContain('tornam a');
        }
      }
    }
  });

  it('a Ameaça oscila de verdade: cai abaixo do limiar e volta a passar dele várias vezes por ano; quase toda incursão sorteada é leve, e as médias vêm com o outono (achado 8 da revisão)', () => {
    // O "Pronto quando" de V2E-T3: a Ameaça oscila em vez de só subir. Com +5 por dia e −10 por
    // incursão ela subia até 90-100 e ficava: depois do roteiro nunca mais ficava abaixo de 60, e
    // nenhuma incursão sorteada era leve. Este teste quebra se ela voltar a saturar.
    const limiar = rules.raidChanceAbove;
    let light = 0;
    let medium = 0;
    let mediumFromAutumn = 0;
    for (const seed of SEEDS) {
      let state = left(seed);
      const events: GameEvent[] = [];
      const atTurn: number[] = [];
      for (let at = DAY; at <= 2 * YEAR; at += DAY) {
        const step = advanceTo(state, at);
        state = step.state;
        events.push(...step.events);
        atTurn.push(state.map.threat);
      }
      // Da incursão do roteiro (16º dia) em diante, em dois anos: quantas vezes ela cruza o
      // limiar para baixo (uma incursão a derrubou) e para cima (voltou a subir).
      const afterScripted = atTurn.slice(15);
      let down = 0;
      let up = 0;
      afterScripted.forEach((threat, index) => {
        const before = afterScripted[index - 1];
        if (before !== undefined && before > limiar && threat <= limiar) down += 1;
        if (before !== undefined && before <= limiar && threat > limiar) up += 1;
      });
      expect(down, `${seed}: vezes que caiu a ${limiar} ou menos`).toBeGreaterThanOrEqual(4);
      expect(up, `${seed}: vezes que voltou a passar de ${limiar}`).toBeGreaterThanOrEqual(4);
      // Mais da metade das viradas fica abaixo da marca das médias: o teto é exceção do outono.
      const calm = afterScripted.filter((threat) => threat < rules.mediumRaidAbove).length;
      expect(calm / afterScripted.length, seed).toBeGreaterThan(0.5);
      for (const event of resolved(events)) {
        if (event.data.raidId === 'wolvesYear1') {
          continue;
        }
        if (event.data.size === 'light') {
          light += 1;
          continue;
        }
        medium += 1;
        // Sorteada em uma virada que fechou um dia de outono, deste ano ou do seguinte: a virada
        // do sorteio é a da chegada menos o prazo.
        const drawnAt = (event.atMs - rules.raidLeadMs) % YEAR;
        if (drawnAt > AUTUMN && drawnAt <= WINTER) {
          mediumFromAutumn += 1;
        }
      }
    }
    // A maioria das sorteadas é leve, que a Paliçada Nv1 segura por inteiro…
    expect(light / (light + medium)).toBeGreaterThan(0.6);
    // …e as médias vêm sobretudo do outono, quando os lobos descem a serra.
    expect(mediumFromAutumn).toBeGreaterThan(medium / 2);
  });

  it('dois anos: a frequência fica entre 4 e 9 incursões por ano de jogo, e a do roteiro não se repete', () => {
    for (const seed of SEEDS) {
      const { events } = advanceTo(left(seed), 2 * YEAR);
      const raidsSeen = resolved(events);
      expect(raidsSeen.filter((event) => event.data.raidId === 'wolvesYear1')).toHaveLength(1);
      expect(eventsOfType(events, 'wolvesHowl')).toHaveLength(1);
      const perYear = raidsSeen.length / 2;
      expect(perYear, seed).toBeGreaterThanOrEqual(4);
      expect(perYear, seed).toBeLessThanOrEqual(9);
      // Os ids não se repetem: cada incursão acontece uma vez.
      const ids = raidsSeen.map((event) => event.data.raidId);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('dois anos sem cascata: a população fica, os braços voltam, nada fica negativo e não há fome', () => {
    for (const seed of SEEDS.slice(0, 3)) {
      let state = left(seed);
      const events: GameEvent[] = [];
      let lowestThreat = 100;
      let highestThreat = 0;
      for (let at = DAY / 2; at <= 2 * YEAR; at += DAY / 2) {
        const step = advanceTo(state, at);
        state = step.state;
        events.push(...step.events);
        const { settlement } = state;
        for (const stock of Object.values(settlement.resources)) {
          expect(stock).toBeGreaterThanOrEqual(0);
        }
        expect(assignedWorkers(state)).toBeLessThanOrEqual(ableVillagers(state));
        expect(settlement.injured.length).toBeLessThanOrEqual(2);
        expect(state.horde.scheduledRaids.length).toBeLessThanOrEqual(1);
        expect(state.map.threat).toBeGreaterThanOrEqual(0);
        expect(state.map.threat).toBeLessThanOrEqual(rules.max);
        if (at > 30 * DAY) {
          lowestThreat = Math.min(lowestThreat, state.map.threat);
          highestThreat = Math.max(highestThreat, state.map.threat);
        }
      }
      // Ninguém parte por causa dos lobos, e quem se feriu voltou ao ofício que tinha.
      expect(state.settlement.population.villagers).toBe(5);
      expect(eventsOfType(events, 'villagerInjured').length).toBe(
        eventsOfType(events, 'villagerRecovered').length + state.settlement.injured.length,
      );
      expect(eventsOfType(events, 'famineStarted')).toEqual([]);
      expect(eventsOfType(events, 'villagerLeft')).toEqual([]);
      expect(eventsOfType(events, 'villagerDeserted')).toEqual([]);
      if (state.settlement.injured.length === 0) {
        expect(state.settlement.workers).toEqual({
          farm: 3,
          lumberMill: 1,
          quarry: 1,
          goldMine: 0,
        });
      }
      // A Ameaça se move: cai com cada incursão e volta a subir. Que ela oscila de verdade, e não
      // só junto ao teto, é o teste do achado 8, acima.
      expect(highestThreat).toBeGreaterThan(lowestThreat);
      expect(state.stats.raids_suffered).toBe(eventsOfType(events, 'raidSuffered').length);
    }
  });

  it('a mesma semente marca as mesmas incursões com ou sem Paliçada: ela só muda o desfecho', () => {
    const open = advanceTo(left('vau-do-lobo', 0), YEAR).events;
    const walled = advanceTo(left('vau-do-lobo', 2), YEAR).events;
    const when = (events: GameEvent[]) =>
      resolved(events).map((event) => [event.atMs, event.data.raidId, event.data.size]);
    expect(when(walled)).toEqual(when(open));
    expect(eventsOfType(walled, 'raidSuffered')).toEqual([]);
    expect(eventsOfType(walled, 'villagerInjured')).toEqual([]);
    expect(eventsOfType(open, 'raidRepelled')).toEqual([]);
    // E quem tem a Paliçada no nível 2 passa o ano sem termo de moral por incursão.
    expect(walled.filter((event) => event.type === 'moraleBandChanged')).toEqual([]);
  });
});

describe('QA-07: frio, fome, moral baixa, feridos e pouca gente', () => {
  it('o feudo no fundo do poço, atacado no meio da recuperação: os feridos voltam sozinhos e ele se refaz sem ordem nenhuma', () => {
    // O feudo empobrecido (3 aldeões, inverno, fome, frio, moral zero) recebe as ordens que o
    // tiram do poço: dois na Fazenda, um na Serraria. Dois dias de jogo depois, uma matilha
    // grande passa por ele, sem Paliçada: dois dos três ficam de cama por um dia.
    const ruined = impoverishedScenario();
    const raidAt = WINTER + 5 * DAY;
    const ordered = play(ruined, [
      command('setWorkers', { building: 'farm', count: 2 }),
      command('setWorkers', { building: 'lumberMill', count: 1 }),
    ]).state;
    const start = { ...ordered, horde: { scheduledRaids: [raid(raidAt, 'medium')] } };
    const calm = { ...ordered, horde: { scheduledRaids: [raid(raidAt, 'medium')] } };
    calm.settlement = {
      ...calm.settlement,
      buildings: { ...calm.settlement.buildings, palisade: 2 },
    };

    let state: GameState = start;
    const events: GameEvent[] = [];
    for (let at = ruined.lastProcessedAt + DAY / 4; at <= YEAR + 2 * DAY; at += DAY / 4) {
      const step = advanceTo(state, at);
      state = step.state;
      events.push(...step.events);
      const { settlement } = state;
      // A alocação continua válida, o piso segura a população e nada fica negativo.
      expect(assignedWorkers(state)).toBeLessThanOrEqual(ableVillagers(state));
      expect(settlement.population.villagers).toBe(3);
      expect(settlement.injured.length).toBeLessThanOrEqual(3);
      for (const stock of Object.values(settlement.resources)) {
        expect(stock).toBeGreaterThanOrEqual(0);
      }
    }
    const last = advanceTo(state, YEAR + 2 * DAY);
    state = last.state;
    events.push(...last.events);
    const hit = only(events, 'raidSuffered');
    expect(hit.atMs).toBe(raidAt);
    expect(hit.data.injured).toBe(2);
    // Os dois lavradores largam a Fazenda e voltam a ela um dia de jogo depois, sozinhos.
    expect(eventsOfType(events, 'villagerInjured').map((event) => event.data.building)).toEqual([
      'farm',
      'farm',
    ]);
    expect(
      eventsOfType(events, 'villagerRecovered').map((event) => [event.atMs, event.data.building]),
    ).toEqual([
      [raidAt + raids.injuryMs, 'farm'],
      [raidAt + raids.injuryMs, 'farm'],
    ]);
    // Há saída sem ordem nenhuma: na primavera o feudo está de pé, com os três no ofício, sem
    // fome e sem frio, como o feudo igual que a Paliçada protegeu.
    expect(state.settlement.workers).toEqual({ farm: 2, lumberMill: 1, quarry: 0, goldMine: 0 });
    expect(state.settlement.famine).toBeNull();
    expect(state.settlement.cold).toBeNull();
    expect(state.settlement.morale).toBeGreaterThanOrEqual(50);
    const safe = advanceTo(calm, YEAR + 2 * DAY).state;
    expect(state.settlement.workers).toEqual(safe.settlement.workers);
    expect(state.settlement.morale).toBe(safe.settlement.morale);
    // O ataque custou o que custou, e mais nada: a experiência do ofício é a mesma.
    expect(state.settlement.craftExperience).toEqual(safe.settlement.craftExperience);
    // Toda fome e todo frio que os feridos reabriram fecharam de novo.
    const opened = (type: GameEvent['type']) => eventsOfType(events, type).length;
    expect(opened('famineEnded')).toBe(opened('famineStarted') + 1);
    expect(opened('coldEnded')).toBe(opened('coldStarted') + 1);
  });

  it('a visão de quem volta no dia do ataque diz que os feridos voltam ao ofício sem ordem nenhuma', () => {
    const ruined = impoverishedScenario();
    const raidAt = WINTER + 5 * DAY;
    const ordered = play(ruined, [
      command('setWorkers', { building: 'farm', count: 2 }),
      command('setWorkers', { building: 'lumberMill', count: 1 }),
    ]).state;
    const hit = advanceTo(
      { ...ordered, horde: { scheduledRaids: [raid(raidAt, 'medium')] } },
      raidAt + 30 * MINUTE,
    ).state;
    const view = deriveViewState(hit, hit.lastProcessedAt, { timeScale: 3 });
    expect(view.population).toMatchObject({
      villagers: 3,
      free: 0,
      injured: 2,
      secondsToNextRecovery: 30 * 60,
      injuredNote:
        '2 aldeões feridos na incursão: não trabalham até sarar. Saram em 30 min; quem tinha ofício volta a ele sozinho.',
    });
    expect(view.workers.find((row) => row.building === 'farm')).toMatchObject({
      assigned: 0,
      injured: 2,
    });
    // A Fazenda vazia não perde o ofício: os lavradores voltam antes da contagem da virada.
    expect(view.workers.find((row) => row.building === 'farm')?.experienceTrend).not.toBe(
      'falling',
    );
  });
});

describe('a divisão de intervalo continua exata com as incursões (GDD §14.3)', () => {
  const cut = fc.integer({ min: 1, max: 12 * DAY });

  it('estado, eventos e gerador iguais, com o sorteio da Ameaça, o aviso, a resolução e os feridos no caminho', () => {
    let drawn = 0;
    let resolvedCount = 0;
    let hurt = 0;
    fc.assert(
      fc.property(
        fc.record({
          seed: fc.string({ maxLength: 12 }),
          startMs: fc.integer({ min: 0, max: YEAR + 20 * DAY }),
          threat: fc.integer({ min: 30, max: 100 }),
          watchtower: fc.integer({ min: 0, max: 2 }),
          palisade: fc.integer({ min: 0, max: 2 }),
          timeScale: fc.constantFrom(0.5, 1, 3),
          workers: fc.tuple(
            fc.integer({ min: 0, max: 4 }),
            fc.integer({ min: 0, max: 3 }),
            fc.integer({ min: 0, max: 2 }),
            fc.integer({ min: 0, max: 1 }),
          ),
          cuts: fc.array(cut, { minLength: 2, maxLength: 6 }),
        }),
        ({ seed, startMs, threat, watchtower, palisade, timeScale, workers, cuts }) => {
          const start = gameAt(startMs, (draft) => {
            const { settlement } = draft;
            draft.seed = seed;
            draft.settings.timeScale = timeScale;
            settlement.buildings = {
              ...settlement.buildings,
              townHall: 3,
              housing: 2,
              watchtower,
              palisade,
            };
            settlement.population.villagers = 10;
            const [farm, lumberMill, quarry, goldMine] = workers;
            settlement.workers = { farm, lumberMill, quarry, goldMine };
            settlement.resources = { food: 300_000, wood: 200_000, stone: 100_000, gold: 50_000 };
            draft.map.threat = threat;
            hordeAwake(draft);
          });
          const stops = [...new Set(cuts)].sort((a, b) => a - b).map((offset) => startMs + offset);
          const end = stops[stops.length - 1] as number;
          const direct = advanceTo(start, end);
          let state = start;
          const events: GameEvent[] = [];
          for (const stop of stops) {
            const step = advanceTo(state, stop);
            state = step.state;
            events.push(...step.events);
            // A cada parada o feudo continua válido.
            expect(assignedWorkers(state)).toBeLessThanOrEqual(ableVillagers(state));
            expect(state.horde.scheduledRaids.length).toBeLessThanOrEqual(1);
            for (const stock of Object.values(state.settlement.resources)) {
              expect(stock).toBeGreaterThanOrEqual(0);
            }
          }
          expect(state).toStrictEqual(direct.state);
          expect(events).toStrictEqual(direct.events);
          expect(state.rng).toStrictEqual(direct.state.rng);
          drawn += direct.state.rng.horde === undefined ? 0 : 1;
          resolvedCount += events.filter((event) =>
            /^raid(Suffered|Repelled)$/.test(event.type),
          ).length;
          hurt += eventsOfType(events, 'villagerInjured').length;
        },
      ),
      { numRuns: 150 },
    );
    // A prova passou mesmo pelas incursões: houve sorteio, resolução e ferido.
    expect(drawn).toBeGreaterThan(50);
    expect(resolvedCount).toBeGreaterThan(50);
    expect(hurt).toBeGreaterThan(20);
  });

  it('vale com o corte em qualquer milissegundo em volta dos uivos, do aviso, do ataque e da volta do ferido, nos três ritmos', () => {
    // O aviso é tempo real: cai em um instante de jogo diferente em cada ritmo.
    const instants = PACES.flatMap((timeScale) =>
      [
        9 * DAY,
        15 * DAY - warningOf(2, timeScale),
        15 * DAY - warningOf(1, timeScale),
        15 * DAY,
        15 * DAY + raids.injuryMs,
      ].map((instant) => ({ timeScale, instant })),
    );
    fc.assert(
      fc.property(
        fc.constantFrom(...instants),
        fc.integer({ min: -3, max: 3 }),
        fc.integer({ min: 0, max: 2 }),
        fc.integer({ min: 0, max: 1 }),
        ({ timeScale, instant }, offset, watchtower, palisade) => {
          const start = gameWith((draft) => {
            quietCouncil(draft);
            draft.settings.timeScale = timeScale;
            draft.settlement.workers = { farm: 2, lumberMill: 2, quarry: 1, goldMine: 0 };
            draft.settlement.buildings.townHall = 3;
            draft.settlement.buildings.watchtower = watchtower;
            draft.settlement.buildings.palisade = palisade;
          });
          const end = 18 * DAY;
          const direct = advanceTo(start, end);
          const first = advanceTo(start, instant + offset);
          const second = advanceTo(first.state, end);
          expect(second.state).toStrictEqual(direct.state);
          expect([...first.events, ...second.events]).toStrictEqual(direct.events);
        },
      ),
      { numRuns: 300 },
    );
  });

  it('vale com ordens do senhor no meio: realocar, recrutar e erguer a Paliçada entre o aviso e o ataque', () => {
    fc.assert(
      fc.property(
        fc.record({
          seed: fc.string({ maxLength: 8 }),
          visits: fc.array(fc.integer({ min: 1, max: 4 * DAY }), { minLength: 1, maxLength: 5 }),
          orders: fc.array(fc.integer({ min: 0, max: 3 }), { minLength: 5, maxLength: 5 }),
          size: fc.constantFrom<Size>('light', 'medium'),
        }),
        ({ seed, visits, orders, size }) => {
          const start = feud({
            tower: 1,
            size,
            edit: (draft) => {
              draft.seed = seed;
              draft.map.threat = 70;
            },
          });
          const order = (state: GameState, pick: number) => {
            const cmd = [
              command('setWorkers', { building: 'farm', count: 2 }),
              command('setWorkers', { building: 'lumberMill', count: 5 }),
              command('startConstruction', { building: 'palisade' }),
              command('recruitVillagers', { quantity: 1 }),
            ][pick];
            if (cmd === undefined) {
              return { state, events: [] as GameEvent[] };
            }
            const result = applyCommand(state, cmd, state.lastProcessedAt);
            return result.ok
              ? { state: result.state, events: result.events }
              : { state, events: [] };
          };
          const stops = [...new Set(visits)]
            .sort((a, b) => a - b)
            .map((offset) => LEFT_AT + offset);
          // Dois senhores dão as mesmas ordens nos mesmos instantes; um deles, além disso, olha
          // o feudo no meio do caminho (o que avança o estado sem ordem nenhuma).
          const run = (peek: boolean) => {
            let state = start;
            const events: GameEvent[] = [];
            stops.forEach((stop, index) => {
              if (peek) {
                const half = advanceTo(
                  state,
                  state.lastProcessedAt + Math.floor((stop - state.lastProcessedAt) / 2),
                );
                state = half.state;
                events.push(...half.events);
              }
              const arrived = advanceTo(state, stop);
              const done = order(arrived.state, orders[index] ?? 0);
              state = done.state;
              events.push(...arrived.events, ...done.events);
              expect(assignedWorkers(state)).toBeLessThanOrEqual(ableVillagers(state));
            });
            const end = advanceTo(state, BACK_AT + 2 * DAY);
            events.push(...end.events);
            return { state: end.state, events };
          };
          const direct = run(false);
          const peeked = run(true);
          expect(peeked.state).toStrictEqual(direct.state);
          expect(peeked.events).toStrictEqual(direct.events);
        },
      ),
      { numRuns: 80 },
    );
  });
});
