import {
  balance,
  DIFFICULTY_IDS,
  type DifficultyId,
  expeditionModels,
  HERO_HARM_IDS,
  HERO_STATUS_IDS,
  INJURY_SEVERITY_IDS,
  ITEM_SLOT_IDS,
  items,
  type PostureId,
} from '@lotg/content';
import { describe, expect, it } from 'vitest';

import { advanceTo } from './advance';
import { heroLimit, heroPower, lodgedHeroes, paidHeroes, wageRate } from './heroes';
import { currentShape } from './migrations';
import {
  HERO_HARM_IDS_V18,
  HERO_STATUS_IDS_V18,
  INJURY_SEVERITY_IDS_V18,
  INVENTORY_CAP_V18,
  ITEM_SLOT_IDS_V18,
} from './migrations/v18';
import { drawVictim } from './expeditionTurn';
import { harmCandidates, harmOf } from './outcomes';
import { entityStream } from './random';
import { cloneState } from './state';
import {
  accept,
  addHero,
  command,
  AUTUMN,
  DAY,
  expeditionAtNode,
  throughCrossroads,
  giveItem,
  guildHall,
  HOUR,
  hordeAwake,
  MINUTE,
  refuse,
  send,
  weakened,
  wear,
  WINTER,
  YEAR,
} from './test-helpers';
import { nextEventAt } from './timeline';
import type { Expedition, GameEvent, GameState, Hero } from './types';
import { MILLI } from './units';
import { deriveViewState } from './view';
import { nextDiscontentAt, nextWageDepartureAt } from './wages';

/**
 * Os desfechos das expedições (V3D-T2; GDD §9.1, §9.2 e §12.1; ADR 0017, decisão 8 e "Os oito
 * traços"; ADR 0018, decisões 14 e 15): ferimento, captura, morte, Resgate, experiência, itens,
 * destinos revelados e o Covil limpo. Os desfechos são **garantidos pela conta**, nunca
 * procurados em uma semente: a equipe é forte ou fraca o bastante para toda a faixa da sorte.
 */

const { injuries, equipment, heroes: heroRules, threat } = balance;

const only = (state: GameState): Expedition => {
  const [expedition] = state.guild.expeditions;
  if (expedition === undefined) {
    throw new Error('Não há expedição em curso.');
  }
  return expedition;
};

const heroOf = (state: GameState, id: string): Hero => {
  const hero = state.guild.heroes.find((entry) => entry.id === id);
  if (hero === undefined) {
    throw new Error(`${id} não serve ao feudo.`);
  }
  return hero;
};

const ofType = (events: GameEvent[], type: GameEvent['type']) =>
  events.filter((event) => event.type === type);

const shaped = (state: GameState) => currentShape(JSON.parse(JSON.stringify(state)), '');

type Custom = Parameters<typeof guildHall>[2];

/** A Guilda de pé com Edda, Rolf e Brann, Guerreiros do nível dado, e as Ruínas já reveladas. */
function hall(level: number, custom: Custom = {}, edit: (draft: GameState) => void = () => {}) {
  return guildHall(
    0,
    (draft) => {
      addHero(draft, { name: 'Edda', gender: 'f', level });
      addHero(draft, { name: 'Rolf', level });
      addHero(draft, { name: 'Brann', level });
      draft.map.discovered = ['ruins'];
      edit(draft);
    },
    custom,
  );
}

const placeAt = expeditionAtNode;
const weaken = weakened;

/** Paga o soldo de novo e tira o Descontente: o que `weaken` fez, desfeito. */
function hearten(state: GameState): GameState {
  const next = cloneState(state);
  for (const hero of next.guild.heroes) {
    hero.discontent = false;
  }
  next.guild.wageArrears = null;
  next.settlement.resources.gold = 2_000 * MILLI;
  return next;
}

/** Edda e Rolf, fracos e com um item cada, diante do guardião da cripta: Desastre certo. */
function atCrypt(difficulty: DifficultyId, team: string[] = ['hero-1', 'hero-2'], timeScale = 1) {
  const start = hall(2, { difficulty, timeScale }, (draft) => {
    wear(draft, heroOf(draft, 'hero-1'), 'huntingSpear');
    wear(draft, heroOf(draft, 'hero-2'), 'paddedJerkin');
  });
  const sent = send(start, 'ruins', ['hero-1', 'hero-2'], 'balanced', 0).state;
  const weak = weaken(sent, ['hero-1', 'hero-2']);
  if (team.length === 1) {
    only(weak).heroIds = [...team];
    heroOf(weak, 'hero-2').status = 'idle';
  }
  return placeAt(weak, 'stoneGuardian');
}

describe('quem sofre o desfecho (ADR 0017, decisão 8 e "Os oito traços")', () => {
  const team = (traits: Array<Hero['traits']>) =>
    traits.map((list, index) => ({
      ...addHero(hall(1), {}),
      id: `hero-${index + 1}`,
      traits: list,
    }));

  it('o Revés fere de leve; o Desastre, de forma grave, ou faz o que a dificuldade diz onde o nó marca captura', () => {
    const at = (difficulty: DifficultyId) => hall(1, { difficulty });
    for (const difficulty of DIFFICULTY_IDS) {
      const state = at(difficulty);
      expect(harmOf(state, 'full', 'capture')).toBeNull();
      expect(harmOf(state, 'success', 'capture')).toBeNull();
      expect(harmOf(state, 'setback', 'capture')).toEqual({ kind: 'light', spared: false });
      expect(harmOf(state, 'disaster', 'injury')).toEqual({ kind: 'severe', spared: false });
    }
    expect(harmOf(at('peasant'), 'disaster', 'capture')).toEqual({ kind: 'severe', spared: true });
    expect(harmOf(at('lord'), 'disaster', 'capture')).toEqual({ kind: 'captured', spared: false });
    expect(harmOf(at('ironKing'), 'disaster', 'capture')).toEqual({ kind: 'died', spared: false });
  });

  it('o Corajoso pesa 6 contra 5 dos outros', () => {
    const weights = harmCandidates(team([['brave'], [], ['loyal']]), 'encounter', {
      kind: 'severe',
      spared: false,
    }).map((entry) => entry.weight);
    expect(weights).toEqual([6, 5, 5]);
  });

  it('o Prudente não é sorteado para o ferimento leve em nó de perigo; no resto, pesa como os outros', () => {
    const heroes = team([['prudent'], []]);
    const light = { kind: 'light', spared: false } as const;
    expect(harmCandidates(heroes, 'hazard', light).map((entry) => entry.weight)).toEqual([0, 5]);
    expect(harmCandidates(heroes, 'encounter', light).map((entry) => entry.weight)).toEqual([5, 5]);
    expect(
      harmCandidates(heroes, 'hazard', { kind: 'severe', spared: false }).map(
        (entry) => entry.weight,
      ),
    ).toEqual([5, 5]);
  });

  it('só se sorteia o que pode acontecer: sem candidato ninguém sofre, e com um só é ele, sem gastar o fluxo', () => {
    const state = hall(1);
    const stream = entityStream('expedition', 'expedition-1');
    const light = { kind: 'light', spared: false } as const;
    const prudent = team([['prudent'], ['prudent']]);
    expect(drawVictim(state, stream, harmCandidates(prudent, 'hazard', light))).toBeNull();
    const mixed = team([['prudent'], []]);
    expect(drawVictim(state, stream, harmCandidates(mixed, 'hazard', light))?.id).toBe('hero-2');
    expect(state.rng).toEqual({});
    // Com dois candidatos, sorteia: o fluxo nasce.
    const draft = cloneState(state);
    draft.ids.expedition = 1;
    expect(drawVictim(draft, stream, harmCandidates(mixed, 'encounter', light))).not.toBeNull();
    expect(Object.keys(draft.rng)).toEqual([stream]);
  });
});

describe('o ferimento (QA-08)', () => {
  /** Edda sozinha, de nível 2, contra o javali da mata (55): Revés em toda a faixa da sorte. */
  function setbackInTheWoods(difficulty: DifficultyId) {
    const sent = send(hall(2, { difficulty }), 'oldForest', ['hero-1'], 'bold', 0);
    const fork = advanceTo(sent.state, sent.expedition.nodeEndsAtMs ?? 0).state;
    const chosen = accept(
      fork,
      command('chooseExpeditionPath', { expeditionId: 'expedition-1', optionId: 'thicket' }),
    ).state;
    const at = only(chosen).nodeEndsAtMs ?? 0;
    return { chosen, at, after: advanceTo(chosen, at) };
  }

  it.each(DIFFICULTY_IDS)(
    'em %s o Revés fere de leve: 2 h de jogo, e a equipe termina a jornada',
    (difficulty) => {
      const { at, after } = setbackInTheWoods(difficulty);
      const edda = heroOf(after.state, 'hero-1');
      expect(only(after.state).log.at(-1)).toMatchObject({
        outcome: 'setback',
        harm: { heroName: 'Edda', kind: 'light' },
      });
      expect(edda.injury).toEqual({ severity: 'light', untilMs: at + injuries.durationMs.light });
      expect(injuries.durationMs.light).toBe(2 * HOUR);
      // Ferida, continua em expedição: o caminho de volta é dela.
      expect(edda.status).toBe('expedition');
      expect(only(after.state).status).toBe('returning');
      const [line] = ofType(after.events, 'heroInjured');
      expect(line?.text).toBe(
        'No 1º dia da Primavera, Edda sofreu um ferimento leve em "Floresta Antiga". Termina a jornada, mas depois precisa de descanso.',
      );
      expect(line?.data).toMatchObject({ heroId: 'hero-1', severity: 'light', spared: 0 });
      expect(shaped(after.state)).toBeNull();
    },
  );

  it('de volta ao feudo fica em recuperação, não parte em outra, e sara no instante exato', () => {
    const { at, after } = setbackInTheWoods('lord');
    const home = advanceTo(after.state, at + 20 * MINUTE).state;
    const healsAt = at + injuries.durationMs.light;
    expect(heroOf(home, 'hero-1').status).toBe('injured');
    expect(home.guild.expeditions).toEqual([]);
    expect(nextEventAt(home)).toBeLessThanOrEqual(healsAt);
    expect(
      refuse(
        home,
        command('sendExpedition', { modelId: 'patrol', heroIds: ['hero-1'], posture: 'bold' }),
      ),
    ).toEqual({
      code: 'HERO_UNAVAILABLE',
      message: 'Edda não pode partir agora: ainda se recupera dos ferimentos.',
    });
    // Ferida, continua no feudo: recebe soldo, pode ser equipada e pode ser dispensada.
    expect(paidHeroes(home)).toBe(3);
    const view = deriveViewState(home, home.lastProcessedAt).guild.heroes[0];
    expect(view).toMatchObject({
      atHome: true,
      canDepart: false,
      captive: false,
      injury: {
        severityLabel: 'Ferimento leve',
        recoversInSeconds: (healsAt - home.lastProcessedAt) / 1000,
      },
    });
    expect(view?.statusText).toBe('Em recuperação: volta a poder partir em 1 h 40 min');

    const before = advanceTo(home, healsAt - 1);
    expect(heroOf(before.state, 'hero-1').status).toBe('injured');
    expect(ofType(before.events, 'heroRecovered')).toEqual([]);
    const healed = advanceTo(before.state, healsAt);
    expect(heroOf(healed.state, 'hero-1')).toMatchObject({ status: 'idle', injury: null });
    expect(ofType(healed.events, 'heroRecovered')).toMatchObject([
      { atMs: healsAt, data: { heroId: 'hero-1' } },
    ]);
    expect(healed.events.at(-1)?.text).toContain('Edda sarou das feridas');
    // No instante em que sara, já pode partir.
    expect(
      accept(
        healed.state,
        command('sendExpedition', { modelId: 'patrol', heroIds: ['hero-1'], posture: 'bold' }),
      ).state.guild.expeditions,
    ).toHaveLength(1);
    expect(shaped(healed.state)).toBeNull();
  });

  it('no ritmo 3 o ferimento dura o mesmo tempo de jogo, e a tela diz um terço', () => {
    const sent = send(hall(2, { timeScale: 3 }), 'oldForest', ['hero-1'], 'bold', 0);
    const fork = advanceTo(sent.state, sent.expedition.nodeEndsAtMs ?? 0).state;
    const chosen = accept(
      fork,
      command('chooseExpeditionPath', { expeditionId: 'expedition-1', optionId: 'thicket' }),
    ).state;
    const at = only(chosen).nodeEndsAtMs ?? 0;
    const home = advanceTo(chosen, at + 20 * MINUTE).state;
    const edda = heroOf(home, 'hero-1');
    expect(edda.injury?.untilMs).toBe(at + 2 * HOUR);
    const view = deriveViewState(home, home.lastProcessedAt, { timeScale: 3 }).guild.heroes[0];
    expect(view?.injury?.recoversInSeconds).toBe((100 * MINUTE) / 3 / 1000);
  });

  it('o Desastre onde o nó marca ferimento fere de forma grave: 12 h de jogo', () => {
    const { chosen, at } = setbackInTheWoods('lord');
    // Clériga de nível 1, Descontente: 25,6 contra 55 é Desastre em toda a faixa da sorte.
    const after = advanceTo(weaken(chosen, ['hero-1']), at);
    expect(only(after.state).log.at(-1)).toMatchObject({
      outcome: 'disaster',
      harm: { heroName: 'Edda', kind: 'severe' },
      gained: { food: 0, wood: 0, stone: 0, gold: 0 },
    });
    expect(heroOf(after.state, 'hero-1').injury).toEqual({
      severity: 'severe',
      untilMs: at + 12 * HOUR,
    });
    expect(ofType(after.events, 'heroInjured')[0]?.text).toContain('sofreu um ferimento grave');
  });

  it('quem já estava ferido fica com o prazo mais longo e a gravidade maior', () => {
    const { chosen, at } = setbackInTheWoods('lord');
    const hurt = cloneState(chosen);
    heroOf(hurt, 'hero-1').injury = { severity: 'severe', untilMs: at + 9 * HOUR };
    const after = advanceTo(hurt, at).state;
    expect(heroOf(after, 'hero-1').injury).toEqual({ severity: 'severe', untilMs: at + 9 * HOUR });
  });
});

describe('a captura, por dificuldade (QA-08; GDD §12.1)', () => {
  it('em Camponês a captura vira ferimento grave, com frase própria, e ninguém sai da equipe', () => {
    const { state, endsAt } = atCrypt('peasant');
    const after = advanceTo(state, endsAt);
    const [line] = ofType(after.events, 'heroInjured');
    expect(line?.data).toMatchObject({ severity: 'severe', spared: 1 });
    expect(line?.text).toContain('por pouco');
    expect(line?.text).toContain('ao preço de um ferimento grave');
    expect(ofType(after.events, 'heroCaptured')).toEqual([]);
    expect(ofType(after.events, 'heroDied')).toEqual([]);
    expect(only(after.state).heroIds).toEqual(['hero-1', 'hero-2']);
    const victim = heroOf(after.state, String(line?.data.heroId));
    expect(victim.injury).toEqual({ severity: 'severe', untilMs: endsAt + 12 * HOUR });
    expect(shaped(after.state)).toBeNull();
  });

  it('em Senhor o herói fica em cativeiro: sai da equipe, não recebe soldo, não ocupa lugar no limite e leva o que tinha', () => {
    const { state, endsAt } = atCrypt('lord');
    const after = advanceTo(state, endsAt);
    const [line] = ofType(after.events, 'heroCaptured');
    const victim = heroOf(after.state, String(line?.data.heroId));
    const other = victim.id === 'hero-1' ? 'hero-2' : 'hero-1';
    expect(line?.text).toBe(
      `No 1º dia da Primavera, ${victim.name} caiu em cativeiro em "Ruínas de Vel'Thar". Só um resgate traz de volta a Pedra Alta quem ficou lá.`,
    );
    expect(victim).toMatchObject({
      status: 'captured',
      captivity: { sinceMs: endsAt, modelId: 'ruins' },
      injury: null,
      discontent: false,
    });
    // O item fica com ele.
    expect(ITEM_SLOT_IDS.some((slot) => victim.equipment[slot] !== null)).toBe(true);
    expect(after.state.guild.inventory).toEqual([]);
    expect(only(after.state).heroIds).toEqual([other]);
    // Três servem ao feudo, dois recebem: o cativo não.
    expect(after.state.guild.heroes).toHaveLength(3);
    expect(paidHeroes(after.state)).toBe(2);
    expect(wageRate(after.state)).toBe(2 * heroRules.wagePerHour * MILLI);
    // Sem Taverna o limite é 1, e o cativo não ocupa lugar nele (D-17, resposta de 2026-10-06).
    expect(heroLimit(after.state)).toBe(1);
    expect(lodgedHeroes(after.state)).toBe(2);
    // Quem ficou de pé ganha a experiência do Desastre: um quarto.
    expect(only(after.state).log.at(-1)).toMatchObject({
      outcome: 'disaster',
      harm: { heroName: victim.name, kind: 'captured' },
      xp: 15,
    });
    expect(heroOf(after.state, other).xp).toBe(15);
    expect(victim.xp).toBe(0);
    expect(shaped(after.state)).toBeNull();

    const view = deriveViewState(after.state, endsAt).guild;
    const captive = view.heroes.find((hero) => hero.id === victim.id);
    expect(captive).toMatchObject({
      statusText: 'Em cativeiro desde "Ruínas de Vel\'Thar"',
      atHome: false,
      canDepart: false,
      captive: true,
      wagePerHour: 0,
    });
    expect(view.captiveText).toContain('não recebe soldo');
    expect(view.available.map((offer) => offer.modelId)).toContain('rescue');
    // A tela acha o Resgate pela marca, sem conhecer o nome do modelo.
    expect(view.available.filter((offer) => offer.rescue).map((offer) => offer.modelId)).toEqual([
      'rescue',
    ]);
    // Em cativeiro, não é equipado; dispensá-lo é desistir dele (revisão da Fase D, M-R3).
    expect(view.heroes.find((hero) => hero.id === victim.id)?.canDismiss).toBe(true);
    expect(
      refuse(after.state, command('unequipItem', { heroId: victim.id, slot: 'weapon' })),
    ).toEqual({
      code: 'HERO_BUSY',
      message: `${victim.name} está fora do feudo: o arsenal espera um resgate.`,
    });

    // A equipe volta sem ele, e o relatório diz quem foi e quem ficou.
    const home = advanceTo(after.state, endsAt + 45 * MINUTE);
    const [report] = home.state.guild.reports;
    expect(report?.heroNames).toEqual([heroOf(home.state, other).name, victim.name]);
    expect(report?.lost).toBe(false);
    const reportView = deriveViewState(home.state, home.state.lastProcessedAt).guild.reports[0];
    // O último passo do relatório é o caminho de volta; o do guardião é o anterior.
    expect(reportView?.log.at(-2)?.notes).toEqual([`${victim.name} ficou em cativeiro.`]);
    expect(reportView?.lossesText).toBe(`O preço: ${victim.name}, em cativeiro.`);
    expect(shaped(home.state)).toBeNull();
  });

  it('em Rei de Ferro o herói morre, e os itens dele voltam ao arsenal', () => {
    const { state, endsAt } = atCrypt('ironKing');
    const after = advanceTo(state, endsAt);
    const [line] = ofType(after.events, 'heroDied');
    const victimId = String(line?.data.heroId);
    const name = victimId === 'hero-1' ? 'Edda' : 'Rolf';
    expect(line?.text).toBe(
      `No 1º dia da Primavera, ${name} tombou em "Ruínas de Vel'Thar" e não se levantou. Pedra Alta guarda as armas que ficaram.`,
    );
    expect(after.state.guild.heroes.map((hero) => hero.id)).not.toContain(victimId);
    expect(after.state.guild.heroes).toHaveLength(2);
    expect(after.state.guild.inventory.map((item) => item.defId)).toEqual([
      victimId === 'hero-1' ? 'huntingSpear' : 'paddedJerkin',
    ]);
    expect(only(after.state).heroIds).toHaveLength(1);
    expect(ofType(after.events, 'heroCaptured')).toEqual([]);
    expect(only(after.state).log.at(-1)?.harm).toEqual({ heroName: name, kind: 'died' });
    expect(shaped(after.state)).toBeNull();
    // O relatório ainda diz o nome de quem não voltou.
    const home = advanceTo(after.state, endsAt + 45 * MINUTE).state;
    expect(home.guild.reports[0]?.heroNames).toContain(name);
    const view = deriveViewState(home, home.lastProcessedAt).guild.reports[0];
    expect(view?.log.at(-2)?.notes).toEqual([`${name} não voltou.`]);
    expect(view?.lossesText).toBe(`O preço: ${name}, que não voltou.`);
  });

  it('a equipe inteira capturada: a expedição termina ali, e o saque se perde', () => {
    const { state, endsAt } = atCrypt('lord', ['hero-1']);
    only(state).loot.resources.stone = 40;
    only(state).loot.items = [{ id: 'item-3', defId: 'ashBow' }];
    state.ids.item = 3;
    state.rng[entityStream('expedition', 'expedition-1')] = [1, 2, 3, 4];
    const stoneBefore = state.settlement.resources.stone;
    const after = advanceTo(state, endsAt);
    expect(after.state.guild.expeditions).toEqual([]);
    expect(heroOf(after.state, 'hero-1').status).toBe('captured');
    expect(ofType(after.events, 'expeditionLost')).toMatchObject([
      {
        atMs: endsAt,
        text: 'No 1º dia da Primavera, a expedição "Ruínas de Vel\'Thar" não voltou a Pedra Alta: ninguém da equipe ficou de pé, e o que traziam se perdeu.',
      },
    ]);
    expect(ofType(after.events, 'expeditionReturned')).toEqual([]);
    const [report] = after.state.guild.reports;
    expect(report).toMatchObject({
      lost: true,
      heroNames: ['Edda'],
      loot: { resources: { food: 0, wood: 0, stone: 0, gold: 0 }, items: [] },
      sold: [],
    });
    // Nem a pedra nem o arco chegaram, e o fluxo de sorteio da expedição foi apagado.
    expect(after.state.settlement.resources.stone).toBe(stoneBefore);
    expect(after.state.guild.inventory).toEqual([]);
    expect(Object.keys(after.state.rng).filter((key) => key.startsWith('expedition:'))).toEqual([]);
    expect(shaped(after.state)).toBeNull();
    const view = deriveViewState(after.state, endsAt).guild.reports[0];
    expect(view).toMatchObject({
      lost: true,
      lootText: 'Ninguém da equipe voltou: o que traziam se perdeu.',
      itemsText: null,
    });
  });

  it('em Rei de Ferro, a equipe inteira morta: a expedição termina e ninguém fica devendo soldo', () => {
    const { state, endsAt } = atCrypt('ironKing', ['hero-1']);
    const after = advanceTo(state, endsAt);
    expect(after.state.guild.expeditions).toEqual([]);
    expect(after.state.guild.heroes.map((hero) => hero.id)).toEqual(['hero-2', 'hero-3']);
    expect(after.state.guild.reports[0]).toMatchObject({ lost: true, heroNames: ['Edda'] });
    expect(after.state.guild.inventory.map((item) => item.defId)).toEqual(['huntingSpear']);
    expect(shaped(after.state)).toBeNull();
  });

  it('o cativo não fica Descontente nem parte por soldo em atraso; quem ficou no feudo, sim', () => {
    const { state, endsAt } = atCrypt('lord', ['hero-1']);
    const captured = advanceTo(state, endsAt).state;
    // 30 h reais de cofre vazio, no ritmo 1: o prazo de partir venceu há muito.
    const later = advanceTo(captured, endsAt + 30 * HOUR);
    expect(heroOf(later.state, 'hero-1')).toMatchObject({ status: 'captured', discontent: false });
    const left = ofType(later.events, 'heroLeft').map((event) => event.data.heroId);
    expect(left).not.toContain('hero-1');
    expect(left.length).toBeGreaterThan(0);
    expect(shaped(later.state)).toBeNull();
  });
});

describe('o Resgate (GDD §9.3; ADR 0018, decisão 12)', () => {
  /** Edda em cativeiro, e Rolf e Brann fortes e pagos, prontos para ir buscá-la. */
  function withCaptive(): GameState {
    const { state, endsAt } = atCrypt('lord', ['hero-1']);
    const next = hearten(advanceTo(state, endsAt).state);
    for (const id of ['hero-2', 'hero-3']) {
      Object.assign(heroOf(next, id), { classId: 'warrior', level: 10 });
    }
    return next;
  }

  it('sem cativo o destino nem aparece, e a ordem é recusada', () => {
    const state = hall(10);
    const view = deriveViewState(state, 0).guild;
    expect(view.available.map((offer) => offer.modelId)).toEqual([
      'patrol',
      'oldForest',
      'wolfDen',
      'ruins',
    ]);
    expect(view.captiveText).toBeNull();
    expect(
      refuse(
        state,
        command('sendExpedition', {
          modelId: 'rescue',
          heroIds: ['hero-1', 'hero-2'],
          posture: 'bold',
        }),
      ),
    ).toEqual({
      code: 'EXPEDITION_LOCKED',
      message: 'Esse destino ainda não está ao alcance do feudo: não há ninguém em cativeiro.',
    });
  });

  it('com sucesso, devolve o herói ao feudo no fim do nó, com o que ele levava, e o soldo volta a correr', () => {
    const start = withCaptive();
    expect(paidHeroes(start)).toBe(2);
    const sent = send(start, 'rescue', ['hero-2', 'hero-3'], 'bold', 0);
    // Dois Guerreiros de nível 10 contra a trilha (165,12 contra 90) e, pelo caminho seguro, a
    // troca da guarda (154,8 contra 78): Sucesso Pleno em toda a sorte.
    const cellAt = sent.state.lastProcessedAt + 90 * MINUTE;
    const before = advanceTo(throughCrossroads(sent.state, 'waitForGuardChange').state, cellAt - 1);
    expect(heroOf(before.state, 'hero-1').status).toBe('captured');
    const after = advanceTo(before.state, cellAt);
    const [line] = ofType(after.events, 'heroRescued');
    expect(line).toMatchObject({ atMs: cellAt, data: { heroId: 'hero-1', modelId: 'rescue' } });
    expect(line?.text).toContain('Edda ganhou a liberdade e volta a servir a Pedra Alta');
    const edda = heroOf(after.state, 'hero-1');
    expect(edda).toMatchObject({ status: 'idle', captivity: null });
    expect(edda.equipment.weapon?.defId).toBe('huntingSpear');
    expect(paidHeroes(after.state)).toBe(3);
    expect(only(after.state).log.at(-1)).toMatchObject({ outcome: 'full', rescued: 'Edda' });
    expect(shaped(after.state)).toBeNull();
    // Livre, já pode partir; e o Resgate some da lista.
    const home = advanceTo(after.state, cellAt + 30 * MINUTE).state;
    const view = deriveViewState(home, home.lastProcessedAt).guild;
    expect(view.available.map((offer) => offer.modelId)).not.toContain('rescue');
    expect(view.heroes[0]).toMatchObject({ statusText: 'No feudo', canDepart: true });
    expect(view.reports[0]?.log.at(-2)?.notes).toEqual(['Edda ganhou a liberdade.']);
    expect(view.reports[0]?.deedsText).toBe('Edda ganhou a liberdade.');
  });

  it('com mais de um cativo, liberta quem está lá há mais tempo', () => {
    const start = withCaptive();
    addHero(start, { name: 'Isolda', gender: 'f' });
    Object.assign(heroOf(start, 'hero-4'), {
      status: 'captured',
      // Isolda caiu antes de Edda.
      captivity: { sinceMs: 1, modelId: 'ruins' },
    });
    expect(shaped(start)).toBeNull();
    const sent = send(start, 'rescue', ['hero-2', 'hero-3'], 'bold', 0);
    const after = advanceTo(
      throughCrossroads(sent.state, 'waitForGuardChange').state,
      sent.state.lastProcessedAt + 90 * MINUTE,
    );
    expect(ofType(after.events, 'heroRescued').map((event) => event.data.heroId)).toEqual([
      'hero-4',
    ]);
    expect(heroOf(after.state, 'hero-1').status).toBe('captured');
    // Ainda há quem buscar: o Resgate continua na lista.
    const home = advanceTo(after.state, after.state.lastProcessedAt + 30 * MINUTE).state;
    const view = deriveViewState(home, home.lastProcessedAt).guild;
    expect(view.available.map((offer) => offer.modelId)).toContain('rescue');
    // A tela acha o Resgate pela marca, sem conhecer o nome do modelo.
    expect(view.available.filter((offer) => offer.rescue).map((offer) => offer.modelId)).toEqual([
      'rescue',
    ]);
  });

  it('o Revés no cativeiro não liberta ninguém', () => {
    const start = withCaptive();
    const sent = send(start, 'rescue', ['hero-2', 'hero-3'], 'bold', 0);
    const placed = placeAt(sent.state, 'guardChange');
    // A troca da guarda pede 78, com a perícia pesando metade: um Guerreiro vale 45 por nível 1.
    // Para o Revés certo é preciso 78 × 0,7 ÷ 0,85 = 64,3 ou mais e menos de 78 ÷ 1,15 = 67,8:
    // um Guerreiro de nível 7 vale 66,6.
    only(placed.state).heroIds = ['hero-2'];
    heroOf(placed.state, 'hero-3').status = 'idle';
    heroOf(placed.state, 'hero-2').level = 7;
    const after = advanceTo(placed.state, placed.endsAt);
    expect(only(after.state).log.at(-1)).toMatchObject({ outcome: 'setback', rescued: null });
    expect(ofType(after.events, 'heroRescued')).toEqual([]);
    expect(heroOf(after.state, 'hero-1').status).toBe('captured');
  });
});

describe('experiência e nível (GDD §9.1; ADR 0017, decisão 7)', () => {
  const patrol = (edit: (hero: Hero) => void) => {
    const start = hall(10);
    edit(heroOf(start, 'hero-1'));
    const sent = send(start, 'patrol', ['hero-1'], 'bold', 0);
    const at = sent.expedition.nodeEndsAtMs ?? 0;
    return { at, after: advanceTo(sent.state, at) };
  };

  it('cada prova dá a experiência do nó, na parte do desfecho: 12 no Sucesso Pleno vira 15', () => {
    // Um Guerreiro de nível 9 (68,88) contra 30: Sucesso Pleno em toda a sorte.
    const { after } = patrol((hero) => (hero.level = 9));
    expect(only(after.state).log[0]).toMatchObject({ outcome: 'full', xp: 15, leveled: [] });
    expect(heroOf(after.state, 'hero-1')).toMatchObject({ level: 9, xp: 15 });
    expect(ofType(after.events, 'heroLeveledUp')).toEqual([]);
  });

  it('quem junta o que o nível pede sobe, leva o resto e ganha linha na Crônica', () => {
    const { at, after } = patrol((hero) => Object.assign(hero, { level: 5, xp: 1_110 }));
    // 1.110 + 15 = 1.125; o nível 5 pede 1.118: sobe para o 6 com 7.
    expect(heroOf(after.state, 'hero-1')).toMatchObject({ level: 6, xp: 7 });
    expect(only(after.state).log[0]?.leveled).toEqual([{ heroName: 'Edda', level: 6 }]);
    expect(ofType(after.events, 'heroLeveledUp')).toMatchObject([
      {
        atMs: at,
        data: { heroId: 'hero-1', level: 6 },
        text: 'No 1º dia da Primavera, Edda aprendeu com a estrada: chegou ao nível 6.',
      },
    ]);
    // O nível entra no poder sem compor: 42 × (1 + 0,08 × 5).
    expect(heroPower(heroOf(after.state, 'hero-1'))).toBe(58_800);
  });

  it('o nível 10 não passa: quem chega a ele zera a experiência, e quem já está nele não junta mais', () => {
    const rising = patrol((hero) => Object.assign(hero, { level: 9, xp: 2_699 }));
    expect(heroOf(rising.after.state, 'hero-1')).toMatchObject({ level: 10, xp: 0 });
    expect(ofType(rising.after.events, 'heroLeveledUp')).toHaveLength(1);
    const top = patrol(() => undefined);
    expect(heroOf(top.after.state, 'hero-1')).toMatchObject({ level: 10, xp: 0 });
    expect(ofType(top.after.events, 'heroLeveledUp')).toEqual([]);
    expect(heroRules.maxLevel).toBe(10);
    const view = deriveViewState(top.after.state, top.at).guild.heroes[0];
    expect(view).toMatchObject({ level: 10, xp: 0, xpToNext: null });
  });

  it('um salto grande sobe mais de um nível de uma vez', () => {
    const start = hall(10);
    Object.assign(heroOf(start, 'hero-1'), { level: 1, xp: 99 });
    Object.assign(heroOf(start, 'hero-2'), { level: 10 });
    // Edda fraca vai com Rolf forte às Ruínas: o guardião (60 × 5/4 = 75 de experiência) cai.
    const sent = send(start, 'ruins', ['hero-2', 'hero-3'], 'bold', 0);
    only(sent.state).heroIds = ['hero-2', 'hero-3', 'hero-1'];
    heroOf(sent.state, 'hero-1').status = 'expedition';
    const placed = placeAt(sent.state, 'stoneGuardian');
    const after = advanceTo(placed.state, placed.endsAt);
    // 99 + 75 = 174: passa os 100 do nível 1 e fica com 74 no nível 2.
    expect(heroOf(after.state, 'hero-1')).toMatchObject({ level: 2, xp: 74 });
  });
});

describe('o equipamento (GDD §9.1; ADR 0018, decisão 15)', () => {
  const armed = () =>
    hall(1, {}, (draft) => {
      giveItem(draft, 'huntingSpear');
      giveItem(draft, 'veltharBlade');
      giveItem(draft, 'paddedJerkin');
    });

  it('equipar tira o item do arsenal e o põe no espaço dele; o bônus entra no poder, com a explicação', () => {
    const start = armed();
    expect(heroPower(heroOf(start, 'hero-1'))).toBe(42_000);
    const equipped = accept(start, command('equipItem', { heroId: 'hero-1', itemId: 'item-1' }));
    const edda = heroOf(equipped.state, 'hero-1');
    expect(edda.equipment).toEqual({
      weapon: { id: 'item-1', defId: 'huntingSpear' },
      armor: null,
      accessory: null,
    });
    expect(equipped.state.guild.inventory.map((item) => item.id)).toEqual(['item-2', 'item-3']);
    // 42 × 21/20 = 44,1.
    expect(heroPower(edda)).toBe(44_100);
    expect(equipped.events).toMatchObject([
      {
        type: 'itemEquipped',
        data: { heroId: 'hero-1', itemId: 'item-1', defId: 'huntingSpear', slot: 'weapon' },
        text: 'No 1º dia da Primavera, Edda passou a levar um item do arsenal de Pedra Alta: Lança de caça.',
      },
    ]);
    const view = deriveViewState(equipped.state, 0).guild;
    expect(view.heroes[0]?.power).toBe(44.1);
    expect(view.heroes[0]?.powerBreakdown).toBe(
      '(14 de ataque + 16 de defesa + 120 de vida ÷ 10) × 1 (Nv1) × 1,05 (lança de caça) = 44,1',
    );
    expect(view.heroes[0]?.equipment).toEqual([
      {
        slot: 'weapon',
        slotLabel: 'Arma',
        item: {
          id: 'item-1',
          label: 'Lança de caça',
          text: items.huntingSpear.text,
          slot: 'weapon',
          slotLabel: 'Arma',
          rarityLabel: 'Comum',
          bonusText: '+5% de poder',
          bonusPercent: 5,
        },
      },
      { slot: 'armor', slotLabel: 'Armadura', item: null },
      { slot: 'accessory', slotLabel: 'Acessório', item: null },
    ]);
    expect(
      view.inventory.map((item) => [item.id, item.label, item.rarityLabel, item.bonusText]),
    ).toEqual([
      ['item-2', "Lâmina de Vel'Thar", 'Raro', '+12% de poder'],
      ['item-3', 'Gibão acolchoado', 'Comum', '+5% de poder'],
    ]);
    expect(view.inventoryText).toBe('Arsenal: 2 de 30 itens.');
    expect(shaped(equipped.state)).toBeNull();
  });

  it('equipar por cima troca: o anterior volta ao arsenal, no lugar do novo', () => {
    const first = accept(armed(), command('equipItem', { heroId: 'hero-1', itemId: 'item-1' }));
    const swapped = accept(
      first.state,
      command('equipItem', { heroId: 'hero-1', itemId: 'item-2' }),
    ).state;
    expect(heroOf(swapped, 'hero-1').equipment.weapon).toEqual({
      id: 'item-2',
      defId: 'veltharBlade',
    });
    expect(swapped.guild.inventory.map((item) => item.id)).toEqual(['item-1', 'item-3']);
    // Dois itens, dois fatores: 42 × 28/25 × 21/20 = 49,392.
    const both = accept(swapped, command('equipItem', { heroId: 'hero-1', itemId: 'item-3' }));
    expect(heroPower(heroOf(both.state, 'hero-1'))).toBe(49_392);
    expect(shaped(both.state)).toBeNull();
  });

  it('desequipar devolve o item ao arsenal', () => {
    const first = accept(armed(), command('equipItem', { heroId: 'hero-1', itemId: 'item-1' }));
    const back = accept(first.state, command('unequipItem', { heroId: 'hero-1', slot: 'weapon' }));
    expect(heroOf(back.state, 'hero-1').equipment.weapon).toBeNull();
    expect(back.state.guild.inventory.map((item) => item.id)).toEqual([
      'item-2',
      'item-3',
      'item-1',
    ]);
    expect(back.events[0]).toMatchObject({ type: 'itemUnequipped', data: { slot: 'weapon' } });
    expect(heroPower(heroOf(back.state, 'hero-1'))).toBe(42_000);
  });

  it('as recusas: o herói que não existe, o que está em expedição, o item que não está no arsenal e o espaço vazio', () => {
    const start = armed();
    expect(refuse(start, command('equipItem', { heroId: 'hero-9', itemId: 'item-1' })).code).toBe(
      'HERO_NOT_FOUND',
    );
    expect(refuse(start, command('equipItem', { heroId: 'hero-1', itemId: 'item-9' }))).toEqual({
      code: 'ITEM_NOT_FOUND',
      message: 'Esse item já não está no arsenal do feudo.',
    });
    expect(refuse(start, command('unequipItem', { heroId: 'hero-1', slot: 'weapon' }))).toEqual({
      code: 'WRONG_SLOT',
      message: 'Edda não leva nada nesse espaço.',
    });
    expect(
      refuse(start, command('unequipItem', { heroId: 'hero-1', slot: 'ring' as never })).code,
    ).toBe('WRONG_SLOT');
    const away = send(start, 'patrol', ['hero-1']).state;
    expect(refuse(away, command('equipItem', { heroId: 'hero-1', itemId: 'item-1' }))).toEqual({
      code: 'HERO_BUSY',
      message: 'Edda está fora do feudo: o arsenal espera a volta da expedição.',
    });
    expect(refuse(away, command('unequipItem', { heroId: 'hero-1', slot: 'weapon' })).code).toBe(
      'HERO_BUSY',
    );
    // Uma recusa não muda nada.
    expect(away.guild.inventory).toHaveLength(3);
  });

  it('quem deixa de servir ao feudo devolve o que levava: o dispensado e o que parte sem soldo', () => {
    const first = accept(armed(), command('equipItem', { heroId: 'hero-1', itemId: 'item-1' }));
    const dismissed = accept(first.state, command('dismissHero', { heroId: 'hero-1' })).state;
    expect(dismissed.guild.inventory.map((item) => item.id)).toEqual([
      'item-2',
      'item-3',
      'item-1',
    ]);
    // Brann chegou por último: é o primeiro a partir quando o prazo do atraso vence.
    const broke = cloneState(armed());
    heroOf(broke, 'hero-3').equipment.armor = broke.guild.inventory.pop() ?? null;
    heroOf(broke, 'hero-3').joinedAtMs = 0;
    broke.settlement.resources.gold = 0;
    const later = advanceTo(broke, 26 * HOUR);
    expect(ofType(later.events, 'heroLeft')[0]?.data.heroId).toBe('hero-3');
    expect(later.state.guild.inventory.map((item) => item.id)).toContain('item-3');
    expect(shaped(later.state)).toBeNull();
  });

  it('o item achado nasce com identificador, vai no saque e entra no arsenal na volta', () => {
    // Dois Guerreiros de nível 3 contra o javali: Sucesso Pleno certo; o item é uma chance.
    const outcomes = Array.from({ length: 24 }, (_, index) => {
      const start = hall(3, { seed: `achado-${index}` });
      const sent = send(start, 'oldForest', ['hero-1', 'hero-2'], 'bold', 0);
      const fork = advanceTo(sent.state, sent.expedition.nodeEndsAtMs ?? 0).state;
      const chosen = accept(
        fork,
        command('chooseExpeditionPath', { expeditionId: 'expedition-1', optionId: 'thicket' }),
      ).state;
      const at = only(chosen).nodeEndsAtMs ?? 0;
      const after = advanceTo(chosen, at);
      const home = advanceTo(after.state, at + 20 * MINUTE);
      return { after, home };
    });
    const found = outcomes.filter(({ after }) => only(after.state).loot.items.length > 0);
    expect(found.length).toBeGreaterThan(0);
    expect(found.length).toBeLessThan(outcomes.length);
    for (const { after, home } of outcomes) {
      const { items: carried } = only(after.state).loot;
      const entry = only(after.state).log.at(-1);
      expect(entry?.found).toEqual(carried.map((item) => item.defId));
      expect(ofType(after.events, 'itemFound')).toHaveLength(carried.length);
      expect(home.state.guild.inventory).toEqual(carried);
      expect(after.state.ids.item ?? 0).toBe(carried.length);
      expect(shaped(home.state)).toBeNull();
    }
    const [{ after, home } = outcomes[0]!] = found;
    const [item] = only(after.state).loot.items;
    expect(item?.id).toBe('item-1');
    expect(['huntingSpear', 'paddedJerkin', 'luckyCharm']).toContain(item?.defId);
    const label = items[item?.defId as keyof typeof items].label;
    expect(ofType(after.events, 'itemFound')[0]?.text).toBe(
      `No 1º dia da Primavera, a expedição "Floresta Antiga" achou um item: ${label}.`,
    );
    expect(ofType(home.events, 'expeditionReturned')[0]?.text).toContain(`um item (${label})`);
    const view = deriveViewState(home.state, home.state.lastProcessedAt).guild;
    expect(view.reports[0]?.itemsText).toBe(`Para o arsenal: ${label}.`);
    expect(view.reports[0]?.log.at(-2)?.notes).toContain(`Achado: ${label}.`);
    expect(view.inventory.map((entry) => entry.label)).toEqual([label]);
  });

  it('com o arsenal cheio, o item que chega vira ouro pelo valor, com linha na Crônica', () => {
    const start = hall(1, {}, (draft) => {
      for (let count = 0; count < equipment.inventoryCap; count += 1) {
        giveItem(draft, 'luckyCharm');
      }
    });
    expect(equipment.inventoryCap).toBe(30);
    const sent = send(start, 'patrol', ['hero-1'], 'bold', 0).state;
    only(sent).loot.items = [{ id: 'item-31', defId: 'veltharBlade' }];
    sent.ids.item = 31;
    const placed = placeAt(sent, 'home');
    only(placed.state).status = 'returning';
    const goldBefore = placed.state.settlement.resources.gold;
    const home = advanceTo(placed.state, placed.endsAt);
    expect(home.state.guild.inventory).toHaveLength(30);
    expect(home.state.guild.inventory.map((item) => item.id)).not.toContain('item-31');
    const [sold] = ofType(home.events, 'itemSold');
    expect(sold?.text).toBe(
      "No 1º dia da Primavera, não havia lugar no arsenal de Pedra Alta para mais um item: Lâmina de Vel'Thar foi vendido por 120 de ouro.",
    );
    expect(sold?.data).toMatchObject({ defId: 'veltharBlade', gained_gold: 120 });
    // 120 de ouro a mais, fora o soldo de três heróis por dez minutos (1 de ouro).
    const paid = (3 * heroRules.wagePerHour * MILLI * 10) / 60;
    expect(home.state.settlement.resources.gold).toBe(goldBefore + 120 * MILLI - paid);
    expect(home.state.guild.reports[0]?.sold).toEqual(['veltharBlade']);
    const view = deriveViewState(home.state, placed.endsAt).guild;
    expect(view.reports[0]?.itemsText).toBe(
      "Sem lugar no arsenal, viraram ouro: Lâmina de Vel'Thar.",
    );
    expect(view.inventoryText).toBe(
      'Arsenal: 30 de 30 itens. O arsenal está cheio: o próximo item que chegar é vendido pelo que vale.',
    );
    expect(shaped(home.state)).toBeNull();
  });
});

describe('o saque e os traços (ADR 0017, "Os oito traços"; pendência D-7)', () => {
  const fences = (traits: Hero['traits'], seed: string) => {
    const start = hall(10, { seed }, (draft) => (heroOf(draft, 'hero-1').traits = traits));
    const sent = send(start, 'patrol', ['hero-1'], 'bold', 0);
    return advanceTo(sent.state, sent.expedition.nodeEndsAtMs ?? 0);
  };

  it('o Sucesso Pleno traz o saque do nó e mais um quarto', () => {
    for (let index = 0; index < 12; index += 1) {
      const entry = only(fences([], `pleno-${index}`).state).log[0];
      expect(entry?.outcome).toBe('full');
      // De 15 a 25 de ouro, vezes 5/4, para baixo: de 18 a 31.
      expect(entry?.gained.gold).toBeGreaterThanOrEqual(18);
      expect(entry?.gained.gold).toBeLessThanOrEqual(31);
    }
  });

  it('o Ganancioso traz um quarto a mais, e de vez em quando perde o saque do nó', () => {
    const runs = Array.from({ length: 60 }, (_, index) => fences(['greedy'], `cobica-${index}`));
    const lost = runs.filter((run) => only(run.state).log[0]?.lootLost === true);
    expect(lost.length).toBeGreaterThan(0);
    expect(lost.length).toBeLessThan(20);
    for (const run of runs) {
      const entry = only(run.state).log[0];
      if (entry?.lootLost === true) {
        expect(entry.gained.gold).toBe(0);
        expect(ofType(run.events, 'expeditionNodeResolved')[0]?.data.lootLost).toBe(1);
      } else {
        // De 15 a 25, vezes 5/4 do Sucesso Pleno, vezes 5/4 da cobiça: de 23 a 39.
        expect(entry?.gained.gold).toBeGreaterThanOrEqual(23);
        expect(entry?.gained.gold).toBeLessThanOrEqual(39);
      }
    }
    const view = deriveViewState(lost[0]!.state, lost[0]!.state.lastProcessedAt).guild;
    expect(view.expeditions[0]?.log[0]?.notes).toContain(
      'A cobiça pesou: o que a equipe juntou neste trecho ficou pelo caminho.',
    );
  });

  it('dois Gananciosos não somam, e o sorteio da cobiça não acontece onde não há o que perder', () => {
    // No Desastre nada se traz: nem a cobiça nem a quantidade são sorteadas.
    const start = hall(1, {}, (draft) => (heroOf(draft, 'hero-1').traits = ['greedy']));
    const sent = send(start, 'patrol', ['hero-1'], 'bold', 0);
    const weak = weaken(sent.state, ['hero-1']);
    heroOf(weak, 'hero-1').level = 1;
    // 25,6 contra 30: Revés certo; o Desastre pede menos. Um Mago não ajuda: tira-se o poder
    // pelo nó, pondo a equipe diante do javali (55), onde 25,6 é Desastre certo.
    const forest = send(
      hall(1, {}, (draft) => (heroOf(draft, 'hero-1').traits = ['greedy'])),
      'oldForest',
      ['hero-1'],
      'bold',
      0,
    );
    const placed = placeAt(weaken(forest.state, ['hero-1']), 'deepWoods');
    const before = JSON.stringify(placed.state.rng);
    const after = advanceTo(placed.state, placed.endsAt).state;
    expect(only(after).log.at(-1)).toMatchObject({ outcome: 'disaster', lootLost: false });
    // Só a sorte foi sorteada: uma palavra do fluxo.
    const fresh = cloneState(placed.state);
    expect(JSON.stringify(fresh.rng)).toBe(before);
    expect(Object.keys(after.rng).filter((key) => key.startsWith('expedition:'))).toHaveLength(1);
    expect(weak.guild.heroes).toHaveLength(3);
  });

  it('a Patrulha revela as Ruínas do Sucesso em diante; no Revés, só com um Rastreador', () => {
    const unknown = (traits: Hero['traits']) =>
      hall(10, {}, (draft) => {
        draft.map.discovered = [];
        heroOf(draft, 'hero-1').traits = traits;
      });
    expect(deriveViewState(unknown([]), 0).guild.available.map((offer) => offer.modelId)).toEqual([
      'patrol',
      'oldForest',
      'wolfDen',
    ]);
    expect(JSON.stringify(deriveViewState(unknown([]), 0))).not.toContain("Vel'Thar");
    expect(
      refuse(
        unknown([]),
        command('sendExpedition', {
          modelId: 'ruins',
          heroIds: ['hero-1', 'hero-2'],
          posture: 'bold',
        }),
      ).message,
    ).toBe('Esse destino ainda não está ao alcance do feudo: a Guilda não conhece esse caminho.');

    const sent = send(unknown([]), 'patrol', ['hero-1'], 'bold', 0);
    const done = advanceTo(sent.state, sent.expedition.nodeEndsAtMs ?? 0);
    expect(done.state.map.discovered).toEqual(['ruins']);
    expect(only(done.state).log[0]?.revealed).toBe('ruins');
    expect(ofType(done.events, 'destinationRevealed')[0]?.text).toBe(
      'No 1º dia da Primavera, a expedição "Patrulha dos Arredores" achou o caminho de um lugar novo: Ruínas de Vel\'Thar.',
    );
    expect(
      deriveViewState(done.state, done.state.lastProcessedAt).guild.available.map(
        (offer) => offer.modelId,
      ),
    ).toContain('ruins');
    // A segunda Patrulha não revela de novo.
    const home = advanceTo(done.state, done.state.lastProcessedAt + 5 * MINUTE).state;
    const again = send(home, 'patrol', ['hero-1'], 'bold', 0);
    const twice = advanceTo(again.state, again.expedition.nodeEndsAtMs ?? 0);
    expect(twice.state.map.discovered).toEqual(['ruins']);
    expect(ofType(twice.events, 'destinationRevealed')).toEqual([]);

    // Clérigo de nível 1 Descontente (25,6) contra 30: Revés em toda a faixa da sorte.
    const setback = (traits: Hero['traits']) => {
      const out = send(unknown(traits), 'patrol', ['hero-1'], 'bold', 0);
      return advanceTo(weaken(out.state, ['hero-1']), out.expedition.nodeEndsAtMs ?? 0);
    };
    const plain = setback([]);
    expect(only(plain.state).log[0]).toMatchObject({ outcome: 'setback', revealed: null });
    expect(plain.state.map.discovered).toEqual([]);
    const tracked = setback(['tracker']);
    expect(only(tracked.state).log[0]).toMatchObject({ outcome: 'setback', revealed: 'ruins' });
    expect(tracked.state.map.discovered).toEqual(['ruins']);
  });
});

describe('o Covil dos Lobos e a Ameaça (GDD §8.2; ADR 0018, decisão 14)', () => {
  /** Edda e Rolf, de nível 10, a caminho do Covil, com a Ameaça em `level`. */
  function toTheDen(level: number, edit: (draft: GameState) => void = () => {}) {
    const start = hall(10, {}, (draft) => {
      draft.map.threat = level;
      edit(draft);
    });
    const sent = send(start, 'wolfDen', ['hero-1', 'hero-2'], 'bold', 0);
    // A subida (40 minutos), a escolha na boca da toca, na hora, e a matilha na fumaça (45): com
    // os dois no nível 10, Sucesso Pleno em toda a sorte nos dois nós.
    return {
      sent: { ...sent, state: throughCrossroads(sent.state, 'smokeOut').state },
      clearsAt: sent.state.lastProcessedAt + 85 * MINUTE,
    };
  }

  it('o sucesso na toca desliga o tile e tira 30 da Ameaça, no instante do nó', () => {
    const { sent, clearsAt } = toTheDen(50);
    const before = advanceTo(sent.state, clearsAt - 1).state;
    expect(before.map).toMatchObject({ threat: 50, tiles: { wolfDen: { threatActive: true } } });
    const after = advanceTo(before, clearsAt);
    expect(after.state.map.tiles.wolfDen?.threatActive).toBe(false);
    expect(after.state.map.threat).toBe(50 - threat.tileClearedDrop);
    expect(threat.tileClearedDrop).toBe(30);
    expect(only(after.state).log.at(-1)).toMatchObject({ outcome: 'full', cleared: 'wolfDen' });
    const [line] = ofType(after.events, 'threatTileCleared');
    expect(line?.text).toBe(
      'No 1º dia da Primavera, a expedição "Covil dos Lobos" limpou o Covil de Lobos. Dali já não sai quem ronde Pedra Alta, até a virada do ano.',
    );
    // A virada do dia seguinte não soma nada: é primavera, e o tile está limpo.
    const nextDay = advanceTo(after.state, DAY).state;
    expect(nextDay.map.threat).toBe(20);
    expect(shaped(after.state)).toBeNull();
  });

  it('a Ameaça não cai abaixo de zero', () => {
    const { sent, clearsAt } = toTheDen(12);
    expect(advanceTo(sent.state, clearsAt).state.map.threat).toBe(0);
  });

  it('sem Torre o jogador sabe que limpou o Covil, e não o número: nem na visão, nem no evento', () => {
    const { sent, clearsAt } = toTheDen(50);
    const after = advanceTo(sent.state, clearsAt);
    const [line] = ofType(after.events, 'threatTileCleared');
    expect(line?.data).toEqual({
      tileId: 'wolfDen',
      expeditionId: 'expedition-1',
      modelId: 'wolfDen',
    });
    expect(JSON.stringify(line)).not.toMatch(/\b(20|30|50)\b/);
    const view = deriveViewState(after.state, clearsAt);
    expect(view.threat).toMatchObject({
      known: false,
      clearedText: 'O Covil de Lobos está limpo: dali ninguém ronda o feudo até a virada do ano.',
    });
    expect(JSON.stringify(view.threat)).not.toMatch(/\b20\b/);
    expect(view.guild.reports).toEqual([]);
    expect(view.guild.expeditions[0]?.log.at(-1)?.notes).toContain('Limpo: o Covil de Lobos.');
  });

  it('com a Torre, o painel mostra o tile limpo, a subida sem ele e, fora do outono, nenhuma chance de incursão', () => {
    const { sent, clearsAt } = toTheDen(90, (draft) => {
      draft.settlement.buildings.watchtower = 1;
      hordeAwake(draft);
      draft.horde.scheduledRaids = [];
    });
    const view = deriveViewState(advanceTo(sent.state, clearsAt).state, clearsAt).threat;
    expect(view).toMatchObject({
      known: true,
      level: 60,
      risePerDay: 0,
      sources: [],
      tiles: [{ id: 'wolfDen', label: 'Covil de Lobos', active: false }],
      raidChancePercent: 0,
    });
    expect(view.clearedText).toContain('está limpo');
    // No outono os lobos descem a serra mesmo com o Covil limpo: a Ameaça sobe e a chance volta.
    const state = hall(1, {}, (draft) => {
      draft.settlement.buildings.watchtower = 1;
      draft.map.threat = 60;
      draft.horde.scheduledRaids = [];
      const den = draft.map.tiles.wolfDen;
      if (den !== undefined) {
        den.threatActive = false;
      }
    });
    const autumn = { ...state, lastProcessedAt: AUTUMN + DAY + 1 };
    const fall = deriveViewState(autumn, autumn.lastProcessedAt).threat;
    expect(fall).toMatchObject({
      known: true,
      risePerDay: 3,
      sources: ['+3/dia: outono'],
      // 63 depois da virada: 23% de chance.
      raidChancePercent: 23,
    });
    expect(fall.known && fall.raidCosts.length).toBeGreaterThan(0);
  });

  it('com o Covil limpo o destino fecha, com o motivo, e a segunda equipe que chega não tira mais 30', () => {
    const { sent, clearsAt } = toTheDen(80, (draft) => {
      draft.settlement.buildings.guild = 2;
      addHero(draft, { name: 'Isolda', gender: 'f', level: 10 });
    });
    // A segunda equipe parte quando a primeira escolhe o caminho, com o Covil ainda ativo, e
    // toma o mesmo caminho quarenta minutos atrás dela.
    // Desde a revisão da Fase D (M-R4) a ordem recusa a segunda equipe; uma partida gravada
    // antes pode ter as duas a caminho, e é esse estado que se monta aqui, à mão.
    expect(
      refuse(
        sent.state,
        command('sendExpedition', {
          modelId: 'wolfDen',
          heroIds: ['hero-3', 'hero-4'],
          posture: 'bold',
        }),
      ).code,
    ).toBe('EXPEDITION_LOCKED');
    const alone = cloneState(sent.state);
    const [ahead] = alone.guild.expeditions.splice(0, 1);
    const second = send(alone, 'wolfDen', ['hero-3', 'hero-4'], 'bold', 0);
    if (ahead !== undefined) {
      second.state.guild.expeditions.unshift(ahead);
    }
    expect(shaped(second.state)).toBeNull();
    const first = advanceTo(second.state, clearsAt);
    expect(first.state.map.threat).toBe(50);
    const both = advanceTo(
      // Ela já esperava na boca da toca: a ordem chega agora, e a fumaça leva 45 minutos.
      throughCrossroads(first.state, 'smokeOut', 'expedition-2').state,
      clearsAt + 45 * MINUTE,
    );
    expect(both.state.map.threat).toBe(50);
    expect(ofType(both.events, 'threatTileCleared')).toEqual([]);
    expect(both.state.guild.expeditions.at(-1)?.log.at(-1)).toMatchObject({
      outcome: 'full',
      cleared: null,
    });
    const home = advanceTo(both.state, clearsAt + 2 * HOUR).state;
    const view = deriveViewState(home, home.lastProcessedAt).guild;
    const offer = view.available.find((entry) => entry.modelId === 'wolfDen');
    expect(offer).toMatchObject({
      locked: true,
      lockedReason:
        'Esse destino ainda não está ao alcance do feudo: o Covil de Lobos está limpo até a virada do ano.',
    });
    expect(
      refuse(
        home,
        command('sendExpedition', {
          modelId: 'wolfDen',
          heroIds: ['hero-1', 'hero-2'],
          posture: 'bold',
        }),
      ).code,
    ).toBe('EXPEDITION_LOCKED');
  });

  it('a incursão já marcada continua marcada; com o Covil limpo nenhuma outra é sorteada até o outono, quando os lobos descem a serra; e na virada do ano eles voltam ao Covil', () => {
    const marked = {
      id: 'threat-1',
      atMs: 3 * DAY,
      kind: 'threat',
      enemy: 'wolves',
      size: 'light',
      announcedAtMs: null,
    } as const;
    const { sent, clearsAt } = toTheDen(100, (draft) => {
      draft.horde.scheduledRaids = [{ ...marked }];
      Object.assign(draft.settlement.workers, { farm: 3, goldMine: 2 });
    });
    const cleared = advanceTo(sent.state, clearsAt).state;
    expect(cleared.horde.scheduledRaids).toEqual([marked]);
    const raidsIn = (events: GameEvent[]) =>
      events.filter((event) => event.type === 'raidSuffered' || event.type === 'raidRepelled');
    // A incursão marcada chega. Depois dela, a primavera e o verão inteiros sem nenhuma: a
    // Ameaça fica onde estava (100 − 30 do Covil − 35 da incursão), porque nada a faz subir.
    const summerEnd = advanceTo(cleared, AUTUMN);
    expect(raidsIn(summerEnd.events)).toHaveLength(1);
    expect(summerEnd.state.horde.scheduledRaids).toEqual([]);
    expect(summerEnd.state.map.threat).toBe(35);
    // No outono os lobos descem a serra, com o Covil limpo ou não: a Ameaça sobe 3 por dia, e
    // acima de 40 as incursões voltam a ser sorteadas (e cada uma a derruba em 35).
    const autumnEnd = advanceTo(summerEnd.state, WINTER);
    expect(raidsIn(autumnEnd.events).length).toBeGreaterThan(0);
    expect(autumnEnd.state.map.tiles.wolfDen?.threatActive).toBe(false);
    // No inverno, de novo ninguém: passada a última incursão marcada no outono (chega em três
    // dias de jogo), nenhuma outra, e a Ameaça não muda mais até a virada do ano.
    const settled = advanceTo(autumnEnd.state, WINTER + 4 * DAY);
    const winterEnd = advanceTo(settled.state, YEAR - 1);
    expect(raidsIn(winterEnd.events)).toEqual([]);
    expect(winterEnd.state.map.threat).toBe(settled.state.map.threat);
    const autumn = winterEnd;
    const turned = advanceTo(autumn.state, YEAR);
    expect(turned.state.map.tiles.wolfDen?.threatActive).toBe(true);
    expect(ofType(turned.events, 'threatTileRestored')).toMatchObject([
      {
        atMs: YEAR,
        text: 'No 1º dia da Primavera, com o ano novo, voltou a haver movimento: o Covil de Lobos está ocupado outra vez.',
      },
    ]);
    // O destino reabre.
    const view = deriveViewState(turned.state, YEAR).guild.available;
    expect(view.find((entry) => entry.modelId === 'wolfDen')?.locked).toBe(false);
    expect(shaped(turned.state)).toBeNull();
    // Avançar de uma vez dá o mesmo.
    expect(advanceTo(cleared, YEAR).state).toStrictEqual(turned.state);
  });

  it('quem nunca limpou o Covil não recebe a linha da volta dos lobos', () => {
    const start = hall(1, {}, (draft) =>
      Object.assign(draft.settlement.workers, { farm: 3, goldMine: 2 }),
    );
    const turned = advanceTo(start, YEAR);
    expect(ofType(turned.events, 'threatTileRestored')).toEqual([]);
  });
});

describe('a divisão de intervalo com os desfechos no caminho', () => {
  const cases = DIFFICULTY_IDS.flatMap((difficulty) =>
    [1, 3, 0.5].map((timeScale) => [difficulty, timeScale] as const),
  );

  it.each(cases)(
    'em %s, no ritmo %s: o Desastre na cripta, a volta, o soldo em atraso e o ferido que sara dão o mesmo de uma vez ou aos pedaços',
    (difficulty, timeScale) => {
      const { state, endsAt } = atCrypt(difficulty, ['hero-1', 'hero-2'], timeScale);
      const horizon = endsAt + 14 * HOUR;
      const direct = advanceTo(state, horizon);
      const cuts = [
        endsAt - 1,
        endsAt,
        endsAt + 1,
        endsAt + 45 * MINUTE - 1,
        endsAt + 45 * MINUTE,
        endsAt + 7 * HOUR + 123,
        endsAt + 12 * HOUR - 1,
        endsAt + 12 * HOUR,
        endsAt + 12 * HOUR + 1,
      ];
      let stepped = state;
      const events: GameEvent[] = [];
      for (const cut of cuts) {
        const piece = advanceTo(JSON.parse(JSON.stringify(stepped)) as GameState, cut);
        expect(shaped(piece.state)).toBeNull();
        stepped = piece.state;
        events.push(...piece.events);
      }
      const last = advanceTo(stepped, horizon);
      expect(last.state).toStrictEqual(direct.state);
      expect(last.state.rng).toStrictEqual(direct.state.rng);
      expect(last.state.ids).toStrictEqual(direct.state.ids);
      expect([...events, ...last.events]).toStrictEqual(direct.events);
      // O caminho passou pelo desfecho da dificuldade.
      const expected = {
        peasant: 'heroInjured',
        lord: 'heroCaptured',
        ironKing: 'heroDied',
      } as const;
      expect(ofType(direct.events, expected[difficulty])).toHaveLength(1);
      if (difficulty === 'peasant') {
        // O ferimento grave dura 12 h de jogo em qualquer ritmo, e sara no instante exato.
        expect(ofType(direct.events, 'heroRecovered').map((event) => event.atMs)).toEqual([
          endsAt + 12 * HOUR,
        ]);
      }
    },
  );

  it('ordens de equipar entre os avanços não mudam o que o tempo faz', () => {
    const { state, endsAt } = atCrypt('ironKing');
    const home = advanceTo(state, endsAt + 45 * MINUTE).state;
    const [spare] = home.guild.inventory;
    const order = command('equipItem', { heroId: 'hero-3', itemId: spare?.id ?? '' });
    const direct = advanceTo(accept(home, order).state, endsAt + 6 * HOUR);
    const half = advanceTo(accept(home, order).state, endsAt + 2 * HOUR + 7);
    const split = advanceTo(half.state, endsAt + 6 * HOUR);
    expect(split.state).toStrictEqual(direct.state);
    expect([...half.events, ...split.events]).toStrictEqual(direct.events);
    expect(heroOf(direct.state, 'hero-3').equipment).not.toEqual({
      weapon: null,
      armor: null,
      accessory: null,
    });
  });
});

describe('a névoa e a pureza dos desfechos (QA-18)', () => {
  it('parada na encruzilhada, a visão não traz o item que o caminho não tomado daria', () => {
    const sent = send(hall(3), 'oldForest', ['hero-1', 'hero-2'], 'bold', 0);
    const fork = advanceTo(sent.state, sent.expedition.nodeEndsAtMs ?? 0).state;
    const text = JSON.stringify(deriveViewState(fork, fork.lastProcessedAt));
    for (const id of ['huntingSpear', 'paddedJerkin', 'luckyCharm'] as const) {
      expect(text).not.toContain(items[id].label);
      expect(text).not.toContain(id);
    }
    // Tomado o riacho, o item da mata nunca aparece.
    const stream = accept(
      fork,
      command('chooseExpeditionPath', { expeditionId: 'expedition-1', optionId: 'stream' }),
    ).state;
    const home = advanceTo(stream, stream.lastProcessedAt + 2 * HOUR).state;
    expect(JSON.stringify(deriveViewState(home, home.lastProcessedAt))).not.toContain(
      items.huntingSpear.label,
    );
    expect(home.ids.item).toBeUndefined();
  });

  it('a visão não leva contador, gerador, chave de item do conteúdo nem a de um destino por revelar', () => {
    const { state, endsAt } = atCrypt('lord');
    const after = advanceTo(state, endsAt).state;
    const text = JSON.stringify(deriveViewState(after, endsAt));
    expect(text).not.toContain('"rng"');
    expect(text).not.toContain('"ids"');
    expect(text).not.toContain('defId');
    expect(text).not.toContain('captivity');
    expect(text).not.toContain('untilMs');
    expect(text).not.toContain('sinceMs');
  });

  it('a visão e nextEventAt não mudam o estado, o gerador nem os contadores com feridos, cativos e itens', () => {
    const { state, endsAt } = atCrypt('lord');
    const after = advanceTo(state, endsAt).state;
    giveItem(after, 'ashBow');
    const before = JSON.stringify(after);
    deriveViewState(after, endsAt);
    deriveViewState(after, endsAt, { timeScale: 3 });
    nextEventAt(after);
    expect(JSON.stringify(after)).toBe(before);
  });

  it('uma ordem de equipar não sorteia nem dá identificador', () => {
    const start = hall(1, {}, (draft) => void giveItem(draft, 'ashBow'));
    const done = accept(start, command('equipItem', { heroId: 'hero-1', itemId: 'item-1' })).state;
    expect(done.rng).toStrictEqual(start.rng);
    expect(done.ids).toStrictEqual(start.ids);
  });
});

describe('o estado gravado dos desfechos (a guarda da versão 18)', () => {
  it('os identificadores e os tetos escritos na guarda são os do conteúdo', () => {
    expect(HERO_STATUS_IDS_V18).toEqual([...HERO_STATUS_IDS]);
    expect(INJURY_SEVERITY_IDS_V18).toEqual([...INJURY_SEVERITY_IDS]);
    expect(HERO_HARM_IDS_V18).toEqual([...HERO_HARM_IDS]);
    expect(ITEM_SLOT_IDS_V18).toEqual([...ITEM_SLOT_IDS]);
    expect(INVENTORY_CAP_V18).toBe(equipment.inventoryCap);
    // No máximo um item por nó: é o teto de `found` em cada registro.
    for (const model of expeditionModels) {
      expect(model.variants.length).toBeGreaterThan(0);
    }
  });

  it('recusa o que só se vê olhando dois campos', () => {
    const { state, endsAt } = atCrypt('lord');
    const good = advanceTo(state, endsAt).state;
    giveItem(good, 'ashBow');
    expect(shaped(good)).toBeNull();
    const broken = (edit: (draft: GameState) => void): string | null => {
      const draft = cloneState(good);
      edit(draft);
      return shaped(draft);
    };
    const captive = (draft: GameState) => {
      const hero = draft.guild.heroes.find((entry) => entry.status === 'captured');
      if (hero === undefined) {
        throw new Error('Ninguém em cativeiro.');
      }
      return hero;
    };
    expect(broken((draft) => (captive(draft).captivity = null))).toContain('captivity');
    expect(broken((draft) => (captive(draft).discontent = true))).toContain('cativeiro');
    expect(
      broken((draft) => (heroOf(draft, 'hero-3').captivity = { sinceMs: 0, modelId: 'ruins' })),
    ).toContain('captivity');
    expect(broken((draft) => (heroOf(draft, 'hero-3').status = 'injured'))).toContain('injury');
    expect(
      broken(
        (draft) => (heroOf(draft, 'hero-3').injury = { severity: 'light', untilMs: endsAt + 1 }),
      ),
    ).toContain('herói pronto com ferimento');
    expect(
      broken((draft) => {
        Object.assign(heroOf(draft, 'hero-3'), {
          status: 'injured',
          injury: { severity: 'light', untilMs: endsAt },
        });
      }),
    ).toContain('ferimento vencido');
    expect(
      broken(
        (draft) => (heroOf(draft, 'hero-3').equipment.weapon = { id: 'item-3', defId: 'ashBow' }),
      ),
    ).toContain('item em dois lugares');
    expect(
      broken(
        (draft) => (heroOf(draft, 'hero-3').equipment.weapon = { id: 'item-9', defId: 'ashBow' }),
      ),
    ).toContain('ids.item');
    expect(broken((draft) => (draft.map.discovered = ['ruins', 'ruins']))).toContain('repetido');
    expect(
      broken((draft) => {
        draft.ids.item = 40;
        draft.guild.inventory = Array.from({ length: 31 }, (_, index) => ({
          id: `item-${index + 4}`,
          defId: 'ashBow',
        }));
      }),
    ).toContain('lista de até 30 itens');
    expect(
      broken((draft) => delete (heroOf(draft, 'hero-3') as Partial<Hero>).equipment),
    ).toContain('equipment');
    expect(
      broken(
        (draft) => ((heroOf(draft, 'hero-3').equipment as Record<string, unknown>).ring = null),
      ),
    ).toContain('ring');
  });
});

describe('o cenário roteirizado dos desfechos, nas três dificuldades (V3D-T2, "Pronto quando")', () => {
  const told = /^(hero|item|destination|threatTile|expedition(Lost|Returned))/;

  /**
   * Uma campanha curta: a Patrulha que revela as Ruínas e dá um nível, o item equipado, o Revés
   * na mata (ferimento leve), o Desastre na cripta (o que a dificuldade faz da captura), o
   * Resgate onde há quem resgatar, e o Covil limpo.
   */
  function campaign(difficulty: DifficultyId) {
    const lines: string[] = [];
    const run = (state: GameState, untilMs: number): GameState => {
      const step = advanceTo(state, untilMs);
      lines.push(
        ...step.events.filter((event) => told.test(event.type)).map((event) => event.text),
      );
      return step.state;
    };
    const order = (state: GameState, cmd: Parameters<typeof accept>[1]): GameState => {
      const step = accept(state, cmd);
      lines.push(
        ...step.events.filter((event) => told.test(event.type)).map((event) => event.text),
      );
      return step.state;
    };
    const go = (state: GameState, modelId: string, heroIds: string[], variant: number): GameState =>
      send(state, modelId, heroIds, 'bold', variant).state;
    /** Até a encruzilhada, e o caminho que a Postura dada marca, por ordem do senhor. */
    const cross = (state: GameState, how: PostureId): GameState => {
      const step = throughCrossroads(state, how);
      lines.push(
        ...step.events.filter((event) => told.test(event.type)).map((event) => event.text),
      );
      return step.state;
    };

    let state = hall(2, { difficulty, seed: 'roteiro-desfechos' }, (draft) => {
      draft.map.discovered = [];
      draft.map.threat = 60;
      Object.assign(heroOf(draft, 'hero-3'), { level: 5, xp: 1_110 });
      giveItem(draft, 'ashBow');
    });
    // 1. Brann patrulha: Sucesso Pleno certo, as Ruínas reveladas e um nível novo.
    state = run(go(state, 'patrol', ['hero-3'], 0), 15 * MINUTE);
    const afterPatrol = state;
    // 2. O arco do arsenal vai para Brann.
    state = order(state, command('equipItem', { heroId: 'hero-3', itemId: 'item-1' }));
    // 3. Edda vai sozinha à mata: Revés certo, ferimento leve; volta e sara.
    state = run(go(state, 'oldForest', ['hero-1'], 0), state.lastProcessedAt + 15 * MINUTE);
    state = order(
      state,
      command('chooseExpeditionPath', { expeditionId: 'expedition-2', optionId: 'thicket' }),
    );
    state = run(state, state.lastProcessedAt + 45 * MINUTE);
    const afterWoods = state;
    state = run(state, state.lastProcessedAt + 3 * HOUR);
    // 4. Edda e Rolf, enfraquecidos, diante do guardião da cripta: Desastre certo.
    const crypt = placeAt(
      weaken(go(state, 'ruins', ['hero-1', 'hero-2'], 0), ['hero-1', 'hero-2']),
      'stoneGuardian',
    );
    state = run(crypt.state, crypt.endsAt);
    const afterCrypt = state;
    state = run(state, crypt.endsAt + 45 * MINUTE);
    // O soldo volta a ser pago, e quem ficou treina até o nível 10.
    state = hearten(state);
    for (const hero of state.guild.heroes) {
      if (hero.status !== 'captured') {
        Object.assign(hero, { classId: 'warrior', level: 10, xp: 0 });
      }
    }
    // 5. O Resgate, onde há quem resgatar.
    const captive = state.guild.heroes.find((hero) => hero.status === 'captured');
    const rescueOrder = command('sendExpedition', {
      modelId: 'rescue',
      heroIds: state.guild.heroes.filter((hero) => hero.status === 'idle').map((hero) => hero.id),
      posture: 'bold',
    });
    const rescueRefused = captive === undefined ? refuse(state, rescueOrder).code : null;
    if (captive !== undefined) {
      // Diante do cativeiro, o caminho seguro: com dois de nível 10, Sucesso Pleno certo.
      state = run(cross(order(state, rescueOrder), 'cautious'), state.lastProcessedAt + 2 * HOUR);
    }
    // Quem se feriu de forma grave sara antes da última jornada.
    state = run(state, state.lastProcessedAt + 13 * HOUR);
    const threatBefore = state.map.threat;
    // 6. O Covil: dois de nível 10 pelo caminho do meio, Sucesso Pleno certo.
    const team = state.guild.heroes.filter((hero) => hero.status === 'idle').slice(0, 2);
    state = run(
      cross(
        go(
          state,
          'wolfDen',
          team.map((hero) => hero.id),
          0,
        ),
        'balanced',
      ),
      state.lastProcessedAt + 2 * HOUR,
    );
    return { state, lines, afterPatrol, afterWoods, afterCrypt, rescueRefused, threatBefore };
  }

  it.each(DIFFICULTY_IDS)(
    'em %s: Revés, Desastre, nível novo, item equipado e o Covil limpo',
    (difficulty) => {
      const { state, lines, afterPatrol, afterWoods, afterCrypt, rescueRefused, threatBefore } =
        campaign(difficulty);
      // A Patrulha: as Ruínas e o nível 6.
      expect(afterPatrol.map.discovered).toEqual(['ruins']);
      expect(heroOf(afterPatrol, 'hero-3')).toMatchObject({ level: 6, xp: 7 });
      // O Revés: Edda ferida de leve, em recuperação no feudo.
      expect(heroOf(afterWoods, 'hero-1')).toMatchObject({
        status: 'injured',
        injury: { severity: 'light' },
      });
      // O Desastre na cripta: o que a dificuldade faz da captura.
      const fate = afterCrypt.guild.expeditions[0]?.log.at(-1)?.harm?.kind;
      expect(fate).toBe({ peasant: 'severe', lord: 'captured', ironKing: 'died' }[difficulty]);
      expect(afterCrypt.guild.heroes).toHaveLength(difficulty === 'ironKing' ? 2 : 3);
      // O Resgate: só em Senhor há quem resgatar, e ele volta.
      expect(rescueRefused).toBe(difficulty === 'lord' ? null : 'EXPEDITION_LOCKED');
      expect(lines.some((line) => line.includes('ganhou a liberdade'))).toBe(difficulty === 'lord');
      expect(state.guild.heroes.some((hero) => hero.status === 'captured')).toBe(false);
      // O item equipado continua com Brann, e entra no poder dele.
      expect(heroOf(state, 'hero-3').equipment.weapon).toEqual({ id: 'item-1', defId: 'ashBow' });
      // Limpar o Covil muda a Ameaça.
      expect(state.map.tiles.wolfDen?.threatActive).toBe(false);
      expect(state.map.threat).toBeLessThanOrEqual(threatBefore - 30 + 2);
      expect(lines.some((line) => line.includes('limpou o Covil de Lobos'))).toBe(true);
      expect(shaped(state)).toBeNull();
    },
  );

  it('a mesma semente, as mesmas ordens: a mesma Crônica e os mesmos relatórios (golden)', async () => {
    const golden = Object.fromEntries(
      DIFFICULTY_IDS.map((difficulty) => {
        const { state, lines } = campaign(difficulty);
        const view = deriveViewState(state, state.lastProcessedAt).guild;
        return [
          difficulty,
          {
            chronicle: lines,
            reports: view.reports,
            heroes: view.heroes.map((hero) => ({
              name: hero.name,
              level: hero.level,
              statusText: hero.statusText,
              power: hero.power,
              powerBreakdown: hero.powerBreakdown,
              equipment: hero.equipment.map((entry) => entry.item?.label ?? null),
            })),
            inventory: view.inventory.map((item) => item.label),
          },
        ];
      }),
    );
    await expect(`${JSON.stringify(golden, null, 1)}\n`).toMatchFileSnapshot(
      './__golden__/expedition-outcomes.json',
    );
  });
});

describe('o resgatado em pleno atraso do soldo tem os prazos dele (revisão da Fase D, M-D1)', () => {
  const turnFrom = (atMs: number): number => Math.ceil(atMs / DAY) * DAY;

  /**
   * Edda e Rolf, Guerreiros Leais de nível 10, e Brann em cativeiro desde o começo; o cofre
   * vazio e ninguém na Mina. Trinta horas reais de atraso depois, os dois vão buscá-lo, e a
   * troca da guarda (154,8 contra 78) é Sucesso Pleno em toda a sorte.
   */
  function rescuedLate(timeScale: number) {
    const start = guildHall(
      10 * DAY,
      (draft) => {
        addHero(draft, { name: 'Edda', gender: 'f', level: 10, traits: ['loyal'] });
        addHero(draft, { name: 'Rolf', level: 10, traits: ['loyal'] });
        const brann = addHero(draft, { name: 'Brann', classId: 'archer' });
        brann.status = 'captured';
        brann.captivity = { sinceMs: draft.lastProcessedAt, modelId: 'ruins' };
        draft.settlement.resources.gold = 0;
      },
      { difficulty: 'lord', timeScale },
    );
    const late = advanceTo(start, 10 * DAY + 30 * HOUR * timeScale).state;
    expect(late.guild.wageArrears).not.toBeNull();
    const sent = send(late, 'rescue', ['hero-1', 'hero-2'], 'cautious', 0);
    const placed = placeAt(sent.state, 'guardChange');
    return { state: placed.state, freedAt: placed.endsAt };
  }

  const ofHero = (events: GameEvent[], heroId: string) =>
    events
      .filter((event) => event.type === 'heroDiscontent' || event.type === 'heroLeft')
      .filter((event) => event.data.heroId === heroId)
      .map((event) => [event.type, event.atMs]);

  it.each([3, 1, 0.5])(
    'ritmo %s: volta sem dever o atraso que correu com ele preso; fica Descontente 12 h reais depois da volta e só parte com 24 h',
    (timeScale) => {
      const { state, freedAt } = rescuedLate(timeScale);
      const freed = advanceTo(state, freedAt);
      expect(ofType(freed.events, 'heroRescued').map((event) => event.atMs)).toEqual([freedAt]);
      expect(heroOf(freed.state, 'hero-3')).toMatchObject({ status: 'idle', freedAtMs: freedAt });
      expect(shaped(freed.state)).toBeNull();

      const sourAt = turnFrom(freedAt + 12 * HOUR * timeScale);
      // Nunca antes das 24 h reais dele; no máximo um passo de 2 h reais e uma virada depois
      // (a conta que ninguém podia pagar fica perdoada: `turnWages`).
      const goneAt = nextWageDepartureAt(freed.state) ?? -1;
      expect(goneAt - freedAt).toBeGreaterThanOrEqual(24 * HOUR * timeScale);
      expect(goneAt - freedAt).toBeLessThan(26 * HOUR * timeScale + DAY);
      expect(nextDiscontentAt(freed.state)).toBe(sourAt);
      // A tela diz os dois prazos certos, e que eles contam da volta.
      const { arrears } = deriveViewState(freed.state, freedAt, { timeScale }).guild.wage;
      expect(arrears?.discontentInSeconds).toBe((sourAt - freedAt) / timeScale / 1000);
      expect(arrears?.nextDepartureInSeconds).toBe((goneAt - freedAt) / timeScale / 1000);
      expect(arrears?.text).toContain('ou voltou do cativeiro');

      // A virada seguinte à volta não cobra nada dele.
      const nextTurn = turnFrom(freedAt + 1);
      expect(
        ofHero(advanceTo(freed.state, Math.min(nextTurn, sourAt - 1)).events, 'hero-3'),
      ).toEqual([]);
      expect(ofHero(advanceTo(freed.state, sourAt - 1).events, 'hero-3')).toEqual([]);
      expect(ofHero(advanceTo(freed.state, goneAt - 1).events, 'hero-3')).toEqual([
        ['heroDiscontent', sourAt],
      ]);
      expect(ofHero(advanceTo(freed.state, goneAt).events, 'hero-3')).toEqual([
        ['heroDiscontent', sourAt],
        ['heroLeft', goneAt],
      ]);
    },
  );

  it('quem volta com o soldo em dia não muda nada: o instante fica gravado e nenhum prazo corre', () => {
    const { state, freedAt } = rescuedLate(1);
    const paid = cloneState(state);
    paid.settlement.resources.gold = 2_000_000;
    const freed = advanceTo(paid, freedAt + 3 * DAY);
    expect(heroOf(freed.state, 'hero-3').freedAtMs).toBe(freedAt);
    expect(ofHero(freed.events, 'hero-3')).toEqual([]);
  });
});

describe('desistir de quem está em cativeiro (revisão da Fase D, M-R3)', () => {
  /** Edda em cativeiro com a lança de caça; Rolf e Brann no feudo. */
  function withCaptive(): GameState {
    const { state, endsAt } = atCrypt('lord', ['hero-1']);
    return hearten(advanceTo(state, endsAt).state);
  }

  it('a ordem é aceita: o lugar na lista fica livre, a Crônica tem a frase dela e o que o cativo levava fica lá', () => {
    const start = withCaptive();
    expect(heroOf(start, 'hero-1')).toMatchObject({ status: 'captured' });
    expect(heroOf(start, 'hero-1').equipment.weapon?.defId).toBe('huntingSpear');
    const view = deriveViewState(start, start.lastProcessedAt).guild;
    expect(view.heroes[0]).toMatchObject({
      captive: true,
      canDismiss: true,
      dismissText:
        'Desistir de quem está em cativeiro é para sempre: nenhum Resgate parte mais por essa pessoa, e o que ela levava fica no cativeiro. O lugar na lista do feudo fica livre.',
    });
    expect(view.heroes[1]).toMatchObject({ canDismiss: true, dismissText: view.dismissText });

    const done = accept(start, command('dismissHero', { heroId: 'hero-1' }));
    expect(done.state.guild.heroes.map((hero) => hero.id)).toEqual(['hero-2', 'hero-3']);
    expect(done.state.guild.inventory).toEqual(start.guild.inventory);
    expect(done.events.map((event) => event.type)).toEqual(['heroDismissed']);
    expect(done.events[0]).toMatchObject({
      data: { heroId: 'hero-1', heroes: 2, captive: 1, itemsLost: 1 },
    });
    expect(done.events[0]?.text).toContain(
      'o senhor de Pedra Alta desistiu de Edda: ninguém mais parte para o resgate, e o que Edda levava ficou no cativeiro.',
    );
    expect(shaped(done.state)).toBeNull();
    // Sem cativo, o Resgate some da lista.
    const after = deriveViewState(done.state, done.state.lastProcessedAt).guild;
    expect(after.available.map((offer) => offer.modelId)).not.toContain('rescue');
    expect(after.captiveText).toBeNull();
  });

  it('sem item, a frase não fala do que ele levava', () => {
    const start = withCaptive();
    heroOf(start, 'hero-1').equipment.weapon = null;
    const done = accept(start, command('dismissHero', { heroId: 'hero-1' }));
    expect(done.events[0]?.text).toMatch(/desistiu de Edda: ninguém mais parte para o resgate\.$/);
    expect(done.events[0]?.data.itemsLost).toBe(0);
  });

  it('com o Resgate dele a caminho, a dispensa espera; quem está em expedição continua sem poder ser dispensado', () => {
    const start = withCaptive();
    for (const id of ['hero-2', 'hero-3']) {
      Object.assign(heroOf(start, id), { classId: 'warrior', level: 10 });
    }
    const sent = send(start, 'rescue', ['hero-2', 'hero-3'], 'bold', 0).state;
    expect(refuse(sent, command('dismissHero', { heroId: 'hero-1' }))).toEqual({
      code: 'HERO_BUSY',
      message: 'Edda está fora do feudo: há um Resgate a caminho.',
    });
    expect(refuse(sent, command('dismissHero', { heroId: 'hero-2' }))).toEqual({
      code: 'HERO_BUSY',
      message: 'Rolf está fora do feudo: a dispensa espera a volta.',
    });
    const view = deriveViewState(sent, sent.lastProcessedAt).guild;
    expect(view.heroes[0]).toMatchObject({
      canDismiss: false,
      dismissText: 'Edda está fora do feudo: há um Resgate a caminho.',
    });
    expect(view.heroes[1]).toMatchObject({ canDismiss: false });
  });

  it('a lista cheia de cativos deixa de ser beco sem saída: desistir de um abre o lugar', () => {
    const start = guildHall(0, (draft) => {
      for (let index = 0; index < heroRules.rosterCap; index += 1) {
        const hero = addHero(draft, { name: `Cativo ${index + 1}` });
        hero.status = 'captured';
        hero.captivity = { sinceMs: 0, modelId: 'ruins' };
      }
    });
    expect(shaped(start)).toBeNull();
    expect(start.guild.heroes).toHaveLength(heroRules.rosterCap);
    const done = accept(start, command('dismissHero', { heroId: 'hero-5' }));
    expect(done.state.guild.heroes).toHaveLength(heroRules.rosterCap - 1);
    expect(shaped(done.state)).toBeNull();
  });
});

describe('a equipe que arriscaria por nada não parte (revisão da Fase D, M-R4)', () => {
  /** Guilda no nível 2 (dois lugares), Edda em cativeiro e quatro Guerreiros fortes no feudo. */
  function twoSlots(extraCaptive = false): GameState {
    const { state, endsAt } = atCrypt('lord', ['hero-1']);
    const next = hearten(advanceTo(state, endsAt).state);
    next.settlement.buildings.guild = 2;
    addHero(next, { name: 'Isolda', gender: 'f' });
    addHero(next, { name: 'Tomas' });
    for (const id of ['hero-2', 'hero-3', 'hero-4', 'hero-5']) {
      Object.assign(heroOf(next, id), { classId: 'warrior', level: 10 });
    }
    if (extraCaptive) {
      const other = addHero(next, { name: 'Ulric' });
      other.status = 'captured';
      other.captivity = { sinceMs: next.lastProcessedAt, modelId: 'ruins' };
    }
    expect(shaped(next)).toBeNull();
    return next;
  }
  const order = (modelId: string, heroIds: string[]) =>
    command('sendExpedition', { modelId, heroIds, posture: 'balanced' });
  const offer = (state: GameState, modelId: string) =>
    deriveViewState(state, state.lastProcessedAt).guild.available.find(
      (entry) => entry.modelId === modelId,
    );

  it('um cativo, um Resgate: o segundo é recusado, e a oferta continua na lista dizendo por quê', () => {
    const first = send(twoSlots(), 'rescue', ['hero-2', 'hero-3']).state;
    expect(refuse(first, order('rescue', ['hero-4', 'hero-5']))).toEqual({
      code: 'EXPEDITION_LOCKED',
      message:
        'Esse destino ainda não está ao alcance do feudo: já há um Resgate a caminho de quem está em cativeiro.',
    });
    expect(offer(first, 'rescue')).toMatchObject({
      locked: true,
      lockedReason:
        'Esse destino ainda não está ao alcance do feudo: já há um Resgate a caminho de quem está em cativeiro.',
    });
  });

  it('dois cativos, dois Resgates: o segundo parte', () => {
    const first = send(twoSlots(true), 'rescue', ['hero-2', 'hero-3']).state;
    expect(offer(first, 'rescue')).toMatchObject({ locked: false });
    const second = accept(first, order('rescue', ['hero-4', 'hero-5']));
    expect(second.state.guild.expeditions.map((entry) => entry.modelId)).toEqual([
      'rescue',
      'rescue',
    ]);
  });

  it('o Covil com uma equipe a caminho não recebe outra; limpo, fica fechado até a virada do ano', () => {
    const first = send(twoSlots(), 'wolfDen', ['hero-2', 'hero-3']).state;
    const reason =
      'Esse destino ainda não está ao alcance do feudo: outra equipe já partiu para limpar o Covil de Lobos.';
    expect(refuse(first, order('wolfDen', ['hero-4', 'hero-5']))).toEqual({
      code: 'EXPEDITION_LOCKED',
      message: reason,
    });
    expect(offer(first, 'wolfDen')).toMatchObject({ locked: true, lockedReason: reason });
    // Com o Covil já limpo, a recusa é a de sempre.
    const cleared = twoSlots();
    const den = cleared.map.tiles.wolfDen;
    if (den !== undefined) {
      den.threatActive = false;
    }
    expect(refuse(cleared, order('wolfDen', ['hero-4', 'hero-5'])).message).toBe(
      'Esse destino ainda não está ao alcance do feudo: o Covil de Lobos está limpo até a virada do ano.',
    );
  });
});
