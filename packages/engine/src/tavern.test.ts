import { balance, buildings, heroNames, tavernCandidates } from '@lotg/content';
import { describe, expect, it } from 'vitest';

import { advanceTo, stateAtNextMoraleTurn } from './advance';
import { upgradeCost } from './construction';
import { heroLimit } from './heroes';
import { currentShape } from './migrations';
import { moraleAt } from './morale';
import { cloneState } from './state';
import { bargainer, festivalHeldThisSeason, hirePrice, offersPerRotation } from './tavern';
import {
  accept,
  addHero,
  AUTUMN,
  command,
  DAY,
  eventsOfType,
  HOUR,
  MINUTE,
  NO_TAVERN,
  refuse,
  SUMMER,
  tavernScenario,
  tavernSite,
  WINTER,
} from './test-helpers';
import { nextEventAt } from './timeline';
import type { GameEvent, GameState } from './types';
import { deriveViewState } from './view';

const { tavern: rules } = balance;
const ROTATION = rules.rotationMs;
/** A obra da Taverna do cenário termina 15 minutos de jogo depois da ordem. */
const OPENS = buildings.tavern.baseDurationMs;

const offersOf = (state: GameState) =>
  state.guild.tavernOffers.map((offer) => [offer.offerId, offer.templateId, offer.name]);
const view = (state: GameState) => deriveViewState(state, state.lastProcessedAt);
const gold = (state: GameState) => state.settlement.resources.gold;
const types = (events: GameEvent[]) => events.map((event) => event.type);

/** Leva a Taverna do cenário ao nível `level`, obra por obra, sem deixar o tempo passar da próxima rotação. */
function raisedTo(start: GameState, level: number): GameState {
  let state = start;
  while (state.settlement.buildings.tavern < level) {
    const ordered = accept(state, command('startConstruction', { building: 'tavern' })).state;
    state = advanceTo(ordered, ordered.settlement.constructionQueues[0]?.finishesAtMs ?? 0).state;
  }
  return state;
}

describe('a Taverna como edifício (GDD §6.1; ADR 0017, decisões 4 e 5)', () => {
  it('pede o Salão no nível 3, e sem ele a obra é recusada com o que falta', () => {
    const early = tavernSite(0, (draft) => {
      draft.settlement.buildings.townHall = 2;
    });
    expect(refuse(early, command('startConstruction', { building: 'tavern' }))).toEqual({
      code: 'GATE_LOCKED',
      message: 'Melhore antes o Salão do Senhor para o nível 3.',
    });
    expect(upgradeCost('tavern', 0)).toEqual({ wood: 180, stone: 60, gold: 120 });
  });

  it('o custo de cada nível é o base × 1,6 por obra, e o Salão no nível 4 deixa chegar ao 5', () => {
    expect([0, 1, 2, 3, 4].map((from) => upgradeCost('tavern', from))).toEqual([
      { wood: 180, stone: 60, gold: 120 },
      { wood: 288, stone: 96, gold: 192 },
      { wood: 461, stone: 154, gold: 307 },
      { wood: 737, stone: 246, gold: 492 },
      { wood: 1180, stone: 393, gold: 786 },
    ]);
    // Com o Salão no nível 3 a Taverna vai até o 4 (o nível dele mais um).
    const four = raisedTo(tavernScenario().state, 4);
    expect(refuse(four, command('startConstruction', { building: 'tavern' }))).toMatchObject({
      code: 'GATE_LOCKED',
      message: 'Melhore antes o Salão do Senhor para o nível 4.',
    });
    const five = raisedTo(
      tavernScenario(0, (draft) => {
        draft.settlement.buildings.townHall = 4;
        draft.settlement.resources.wood = 3_000_000;
      }).state,
      5,
    );
    expect(five.settlement.buildings.tavern).toBe(5);
    expect(refuse(five, command('startConstruction', { building: 'tavern' })).code).toBe(
      'MAX_LEVEL',
    );
  });

  it('o limite de contratação é 1 + o nível da Taverna, e vale no instante em que a obra termina', () => {
    const site = tavernSite();
    expect(heroLimit(site)).toBe(1);
    const ordered = accept(site, command('startConstruction', { building: 'tavern' })).state;
    expect(heroLimit(advanceTo(ordered, OPENS - 1).state)).toBe(1);
    expect(heroLimit(advanceTo(ordered, OPENS).state)).toBe(2);
    expect(view(advanceTo(ordered, OPENS).state).guild.heroLimit).toBe(2);
    expect(heroLimit(raisedTo(tavernScenario().state, 3))).toBe(4);
  });

  it('a lista de obras diz o que cada nível dá', () => {
    const effectOf = (state: GameState) =>
      view(state).constructions.available.find((entry) => entry.building === 'tavern')?.effect;
    expect(effectOf(tavernSite())).toBe(
      'Abriga 2 heróis, traz 2 candidatos a cada troca e soma 5 à moral.',
    );
    const open = tavernScenario().state;
    expect(effectOf(open)).toBe(
      'Abriga 3 heróis, traz 2 candidatos a cada troca e soma 10 à moral.',
    );
    expect(effectOf(raisedTo(open, 2))).toBe(
      'Abriga 4 heróis, traz 3 candidatos a cada troca e soma 15 à moral.',
    );
  });
});

describe('a rotação dos candidatos (ADR 0017, decisão 4)', () => {
  it('as primeiras ofertas nascem no instante exato em que a Taverna fica pronta, sem linha na Crônica', () => {
    const ordered = accept(tavernSite(), command('startConstruction', { building: 'tavern' }));
    const before = advanceTo(ordered.state, OPENS - 1);
    expect(before.state.guild).toMatchObject(NO_TAVERN);
    expect(before.state.rng.tavern).toBeUndefined();
    expect(before.state.ids.offer).toBeUndefined();
    // A obra é o próximo evento, e a rotação ainda não tem instante.
    expect(nextEventAt(before.state)).toBe(OPENS);

    const opened = advanceTo(before.state, OPENS);
    expect(types(opened.events)).toEqual(['buildingFounded']);
    expect(opened.state.settlement.buildings.tavern).toBe(1);
    expect(offersOf(opened.state)).toEqual([
      ['offer-1', 'trackerArcher', 'Soeiro'],
      ['offer-2', 'devoutCleric', 'Elvira'],
    ]);
    expect(opened.state.guild.tavernOffers.map((offer) => [offer.gender, offer.price])).toEqual([
      ['m', 100],
      ['f', 130],
    ]);
    expect(opened.state.ids).toEqual({ offer: 2 });
    expect(opened.state.rng.tavern).toHaveLength(4);
    // A cadência fica ancorada na inauguração: 12 dias de jogo depois, que não é virada de dia.
    expect(opened.state.guild.tavern.nextRotationAtMs).toBe(OPENS + ROTATION);
    expect(ROTATION).toBe(12 * DAY);
    expect((OPENS + ROTATION) % DAY).not.toBe(0);
    expect(currentShape(JSON.parse(JSON.stringify(opened.state)), '')).toBeNull();
  });

  it('a mesma semente dá os mesmos candidatos, e outra semente dá outros', () => {
    const again = tavernScenario().state;
    expect(again).toStrictEqual(tavernScenario().state);
    expect(offersOf(tavernScenario(0, () => {}, { seed: 'vau-do-corvo' }).state)).toEqual([
      ['offer-1', 'trackerArcher', 'Gonçalo'],
      ['offer-2', 'steadyWarrior', 'Brites'],
    ]);
    // O sorteio é só do fluxo `tavern`: o ritmo, a dificuldade e a hora da obra não o mudam.
    const elsewhere = tavernScenario(
      SUMMER + 5 * HOUR,
      (draft) => {
        draft.settlement.population.villagers = 9;
      },
      { timeScale: 3, difficulty: 'ironKing' },
    ).state;
    expect(offersOf(elsewhere)).toEqual(offersOf(again));
  });

  it('no instante marcado a lista inteira troca, a cadência anda um intervalo e nada vai à Crônica', () => {
    const { state, opensAt } = tavernScenario();
    expect(nextEventAt(advanceTo(state, opensAt + ROTATION - 10 * MINUTE).state)).toBe(
      opensAt + ROTATION,
    );
    const before = advanceTo(state, opensAt + ROTATION - 1);
    expect(offersOf(before.state)).toEqual(offersOf(state));
    expect(before.state.rng.tavern).toEqual(state.rng.tavern);

    const at = advanceTo(before.state, opensAt + ROTATION);
    expect(at.events).toEqual([]);
    expect(offersOf(at.state)).toEqual([
      ['offer-3', 'veteranArcher', 'Egas'],
      ['offer-4', 'veteranWarrior', 'Mafalda'],
    ]);
    expect(at.state.guild.tavern.nextRotationAtMs).toBe(opensAt + 2 * ROTATION);
    expect(at.state.ids.offer).toBe(4);
    // Quem não foi contratado saiu, e não volta.
    expect(refuse(at.state, command('hireHero', { offerId: 'offer-1' })).code).toBe('OFFER_GONE');
  });

  it('trinta dias fora sorteiam os mesmos candidatos que trinta dias de visitas', () => {
    const { state, opensAt } = tavernScenario();
    const month = opensAt + 30 * 24 * HOUR;
    const away = advanceTo(state, month);
    let visiting = state;
    const events: GameEvent[] = [];
    const seen: string[] = [];
    for (let at = opensAt + 7 * HOUR + 13 * MINUTE; at < month; at += 7 * HOUR + 13 * MINUTE) {
      const step = advanceTo(visiting, at);
      // Cada visita olha a tela, e olhar não muda nada.
      const frozen = JSON.stringify(step.state);
      view(step.state);
      nextEventAt(step.state);
      expect(JSON.stringify(step.state)).toBe(frozen);
      visiting = JSON.parse(frozen) as GameState;
      events.push(...step.events);
      seen.push(...visiting.guild.tavernOffers.map((offer) => offer.offerId));
    }
    const last = advanceTo(visiting, month);
    expect(last.state).toStrictEqual(away.state);
    expect([...events, ...last.events]).toStrictEqual(away.events);
    // Trinta rotações além da primeira, duas ofertas cada: quem visitou viu todas.
    expect(away.state.ids.offer).toBe(62);
    expect(away.state.guild.tavern.nextRotationAtMs).toBe(opensAt + 31 * ROTATION);
    expect(new Set(seen).size).toBe(60);
    expect(offersOf(advanceTo(state, opensAt + 4 * ROTATION).state)).toEqual([
      ['offer-9', 'veteranArcher', 'Fernão'],
      ['offer-10', 'braveWarrior', 'Bernardo'],
    ]);
  });

  it('em uma rotação ninguém repete modelo nem nome, e nenhum candidato tem o nome de quem já serve ou foi prometido', () => {
    for (const seed of ['pedra-alta', 'vau-do-corvo', 'soldo-3', 'taverna-7']) {
      let state = raisedTo(
        tavernScenario(
          0,
          (draft) => {
            // Um feudo cheio de gente com nome da lista (Leais: ficam, com soldo ou sem), e
            // Rolf a caminho.
            for (const { name } of heroNames.slice(0, 10)) {
              addHero(draft, { name, traits: ['loyal'] });
            }
            draft.guild.arriving = [{ namedHeroId: 'rolf', atMs: 900 * DAY }];
          },
          { seed },
        ).state,
        3,
      );
      const taken = new Set([...state.guild.heroes.map((hero) => hero.name), 'Rolf']);
      for (let turn = 1; turn <= 40; turn += 1) {
        state = advanceTo(state, state.guild.tavern.nextRotationAtMs ?? 0).state;
        const offers = state.guild.tavernOffers;
        expect(offers).toHaveLength(3);
        expect(new Set(offers.map((offer) => offer.templateId)).size).toBe(3);
        expect(new Set(offers.map((offer) => offer.name)).size).toBe(3);
        for (const offer of offers) {
          expect(taken.has(offer.name), `${seed}: ${offer.name}`).toBe(false);
          const model = tavernCandidates.find((entry) => entry.id === offer.templateId);
          expect(offer.price).toBe(model?.price);
          expect(heroNames.find((entry) => entry.name === offer.name)?.gender).toBe(offer.gender);
        }
      }
    }
  });

  it('subir o nível da Taverna no meio de uma rotação não mexe na lista: os três candidatos vêm na troca seguinte', () => {
    const { state, opensAt } = tavernScenario();
    expect(offersPerRotation(state)).toBe(2);
    const three = raisedTo(state, 3);
    expect(three.lastProcessedAt).toBeLessThan(opensAt + ROTATION);
    expect(offersPerRotation(three)).toBe(3);
    expect(offersOf(three)).toEqual(offersOf(state));
    expect(three.guild.tavern.nextRotationAtMs).toBe(opensAt + ROTATION);
    const next = advanceTo(three, opensAt + ROTATION).state;
    expect(next.guild.tavernOffers).toHaveLength(3);
    expect(next.ids.offer).toBe(5);
  });

  it('a obra que termina no instante da rotação já conta: a lista daquele instante sai com o número do nível novo', () => {
    const { state, opensAt } = tavernScenario();
    const two = raisedTo(state, 2);
    // A obra do nível 3 leva 33 min 45 s: ordenada para acabar em cima da rotação.
    const lead = advanceTo(two, opensAt + ROTATION - 33 * MINUTE - 45_000).state;
    const ordered = accept(lead, command('startConstruction', { building: 'tavern' })).state;
    expect(ordered.settlement.constructionQueues[0]?.finishesAtMs).toBe(opensAt + ROTATION);
    const at = advanceTo(ordered, opensAt + ROTATION);
    // No caminho há uma virada de dia, que não é da Crônica; no instante, só a obra.
    expect(types(at.events)).toEqual(['dayStarted', 'constructionFinished']);
    expect(at.events.at(-1)?.atMs).toBe(opensAt + ROTATION);
    expect(at.state.guild.tavernOffers).toHaveLength(3);
  });

  it('um estado atrasado sorteia uma lista só, e a cadência volta a ficar depois de agora', () => {
    const { state, opensAt } = tavernScenario();
    const late = cloneState(state);
    late.guild.tavern.nextRotationAtMs = opensAt - 5 * ROTATION + HOUR;
    const step = advanceTo(late, opensAt + 1);
    // O primeiro instante processado resolve o atraso de uma vez.
    expect(step.state.ids.offer).toBe(4);
    expect(step.state.guild.tavern.nextRotationAtMs).toBe(opensAt + HOUR);
  });

  it('a Taverna posta de pé à mão, sem obra, ganha os candidatos no primeiro avanço, ancorados no instante em que o estado estava', () => {
    // No jogo isto não acontece: a Taverna só fica de pé pelo fim de uma obra. É o estado dos
    // testes que erguem um edifício direto no banco (`/__test/raise`).
    const raised = tavernSite(5 * HOUR + 7 * MINUTE, (draft) => {
      draft.settlement.buildings.tavern = 2;
    });
    expect(currentShape(JSON.parse(JSON.stringify(raised)), '')).toBeNull();
    const at = raised.lastProcessedAt;
    const soon = advanceTo(raised, at + 1).state;
    expect(soon.guild.tavernOffers).toHaveLength(2);
    expect(soon.guild.tavern.nextRotationAtMs).toBe(at + ROTATION);
    // Olhar cedo ou tarde dá no mesmo: a âncora é a do estado, não a da primeira visita.
    const late = advanceTo(raised, at + 3 * HOUR).state;
    expect(advanceTo(soon, at + 3 * HOUR).state).toStrictEqual(late);
    expect(late.guild.tavernOffers).toStrictEqual(soon.guild.tavernOffers);
  });

  it('a rotação é tempo de jogo: no ritmo 3 a tela diz 8 h, e no 0,5, 48 h', () => {
    const seconds = (timeScale: number) =>
      view(tavernScenario(0, () => {}, { timeScale }).state).tavern.nextRotationInSeconds;
    expect(seconds(1)).toBe(24 * 3600);
    expect(seconds(3)).toBe(8 * 3600);
    expect(seconds(0.5)).toBe(48 * 3600);
  });
});

describe('contratar (hireHero)', () => {
  it('cobra o preço, tira a oferta da lista e põe o herói no feudo, sem sortear nada', () => {
    const { state, opensAt } = tavernScenario();
    const hired = accept(state, command('hireHero', { offerId: 'offer-1' }));
    expect(gold(hired.state)).toBe(gold(state) - 100_000);
    expect(offersOf(hired.state)).toEqual([['offer-2', 'devoutCleric', 'Elvira']]);
    expect(hired.state.guild.heroes).toEqual([
      {
        id: 'hero-1',
        name: 'Soeiro',
        gender: 'm',
        classId: 'archer',
        level: 1,
        xp: 0,
        traits: ['tracker'],
        status: 'idle',
        injury: null,
        captivity: null,
        equipment: { weapon: null, armor: null, accessory: null },
        joinedAtMs: opensAt,
        freedAtMs: null,
        discontent: false,
      },
    ]);
    expect(hired.events).toEqual([
      {
        type: 'heroHired',
        atMs: opensAt,
        text: 'No 1º dia da Primavera, Soeiro, arqueiro, aceitou na Taverna o soldo de Pedra Alta. O senhor pagou 100 de ouro pelo trato.',
        data: {
          heroId: 'hero-1',
          offerId: 'offer-1',
          classId: 'archer',
          price: 100,
          fullPrice: 100,
          heroes: 1,
          // O total gasto, como em toda ordem que cobra: é o que o Relatório de Retorno lê.
          spent_gold: 100,
        },
      },
    ]);
    // O modelo do candidato não sai no evento: o servidor entrega `data` inteiro, e o modelo
    // diria os pesos do sorteio (névoa; revisão da Fase C, M-R4).
    expect(JSON.stringify(hired.events)).not.toContain('trackerArcher');
    expect(JSON.stringify(hired.events)).not.toContain('templateId');
    // A ordem não sorteia e não gasta identificador de oferta: só o do herói.
    expect(hired.state.rng).toStrictEqual(state.rng);
    expect(hired.state.ids).toEqual({ offer: 2, hero: 1 });
    expect(hired.state.guild.tavern).toEqual(state.guild.tavern);
    // O soldo conta desde a contratação.
    expect(view(hired.state).guild.wage.perHour).toBe(2);
    expect(currentShape(JSON.parse(JSON.stringify(hired.state)), '')).toBeNull();
  });

  it('a heroína e o veterano chegam como o modelo diz: a ficha concorda com o nome e o nível vem escrito', () => {
    const { state, opensAt } = tavernScenario();
    const cleric = accept(state, command('hireHero', { offerId: 'offer-2' })).state;
    expect(view(cleric).guild.heroes[0]).toMatchObject({
      name: 'Elvira',
      classLabel: 'Clériga',
      level: 1,
      traits: [{ label: 'Devota' }],
    });
    const second = advanceTo(state, opensAt + ROTATION).state;
    const veteran = accept(second, command('hireHero', { offerId: 'offer-4' }));
    expect(veteran.state.guild.heroes[0]).toMatchObject({
      name: 'Mafalda',
      gender: 'f',
      classId: 'warrior',
      level: 2,
      traits: ['veteran', 'loyal'],
    });
    expect(veteran.events[0]?.text).toBe(
      'No 13º dia da Primavera, Mafalda, guerreira, aceitou na Taverna o soldo de Pedra Alta. O senhor pagou 300 de ouro pelo trato.',
    );
  });

  it('sem Taverna, a ordem é recusada dizendo o que a abre', () => {
    expect(
      refuse(
        tavernSite(0, (draft) => (draft.settlement.buildings.townHall = 2)),
        command('hireHero', { offerId: 'offer-1' }),
      ),
    ).toEqual({
      code: 'TAVERN_REQUIRED',
      message: 'Erga a Taverna primeiro: ela abre com o Salão do Senhor Nv3.',
    });
    expect(refuse(tavernSite(), command('hireHero', { offerId: 'offer-1' }))).toEqual({
      code: 'TAVERN_REQUIRED',
      message: 'Erga a Taverna primeiro.',
    });
  });

  it('a oferta que já foi contratada, que nunca existiu ou que não é texto já não está na lista', () => {
    const { state } = tavernScenario();
    const hired = accept(state, command('hireHero', { offerId: 'offer-1' })).state;
    const gone = {
      code: 'OFFER_GONE',
      message: 'Esse candidato já não está na Taverna: a lista trocou, ou ele já foi contratado.',
    };
    expect(refuse(hired, command('hireHero', { offerId: 'offer-1' }))).toEqual(gone);
    expect(refuse(state, command('hireHero', { offerId: 'offer-3' }))).toEqual(gone);
    expect(refuse(state, command('hireHero', { offerId: 7 as unknown as string }))).toEqual(gone);
    // A recusa não cobra nem cria nada.
    expect(gold(hired)).toBe(gold(state) - 100_000);
    expect(hired.guild.heroes).toHaveLength(1);
  });

  it('contratar no instante da rotação: a troca resolve antes da ordem, e a oferta antiga já saiu', () => {
    const { state, opensAt } = tavernScenario();
    const at = opensAt + ROTATION;
    // Um milissegundo antes a oferta ainda vale.
    expect(
      accept(advanceTo(state, at - 1).state, command('hireHero', { offerId: 'offer-1' })).state
        .guild.heroes,
    ).toHaveLength(1);
    const turned = advanceTo(state, at).state;
    expect(refuse(turned, command('hireHero', { offerId: 'offer-1' })).code).toBe('OFFER_GONE');
    // E a nova já pode ser contratada, no mesmo instante.
    const hired = accept(turned, command('hireHero', { offerId: 'offer-3' }));
    expect(hired.state.guild.heroes[0]?.name).toBe('Egas');
    expect(hired.state.guild.heroes[0]?.joinedAtMs).toBe(at);
  });

  it('o limite por nível: a Taverna Nv1 abriga 2 heróis, contando o que chegou por carta', () => {
    const { state } = tavernScenario(0, (draft) => void addHero(draft, { name: 'Edda' }));
    const one = accept(state, command('hireHero', { offerId: 'offer-1' })).state;
    expect(one.guild.heroes).toHaveLength(2);
    expect(refuse(one, command('hireHero', { offerId: 'offer-2' }))).toEqual({
      code: 'HERO_LIMIT',
      message:
        'A Taverna Nv1 abriga 2 heróis, e o feudo já os tem: melhore a Taverna ou dispense um herói.',
    });
    expect(view(one).tavern.offers[0]).toMatchObject({
      offerId: 'offer-2',
      affordable: true,
      blockedReason:
        'A Taverna Nv1 abriga 2 heróis, e o feudo já os tem: melhore a Taverna ou dispense um herói.',
    });
    // Dispensar abre o lugar, e melhorar a Taverna também.
    const freed = accept(one, command('dismissHero', { heroId: 'hero-1' })).state;
    expect(
      accept(freed, command('hireHero', { offerId: 'offer-2' })).state.guild.heroes,
    ).toHaveLength(2);
    const bigger = raisedTo(one, 2);
    expect(
      accept(bigger, command('hireHero', { offerId: 'offer-2' })).state.guild.heroes,
    ).toHaveLength(3);
  });

  it('quem está em cativeiro não conta no limite: dá para contratar no lugar dele, e o resgatado volta por cima do limite (ADR 0017, decisão 5, resposta de 2026-10-06)', () => {
    const capture = (draft: GameState, heroId: string): void => {
      const hero = draft.guild.heroes.find((entry) => entry.id === heroId);
      if (hero === undefined) {
        throw new Error(`Sem o herói ${heroId}.`);
      }
      hero.status = 'captured';
      hero.captivity = { sinceMs: draft.lastProcessedAt, modelId: 'ruins' };
    };
    const { state } = tavernScenario(0, (draft) => {
      addHero(draft, { name: 'Edda' });
      addHero(draft, { name: 'Rolf' });
    });
    // Dois heróis na Taverna Nv1: a casa está cheia.
    expect(refuse(state, command('hireHero', { offerId: 'offer-1' })).code).toBe('HERO_LIMIT');
    const taken = cloneState(state);
    capture(taken, 'hero-2');
    expect(currentShape(taken, '')).toBeNull();
    // O limite continua 2, e só um dos dois o ocupa.
    expect(heroLimit(taken)).toBe(2);
    expect(view(taken).guild.heroLimit).toBe(2);
    expect(view(taken).tavern.offers.map((offer) => offer.blockedReason)).toEqual([null, null]);
    expect(view(taken).guild.captiveText).toBe(
      'Quem está em cativeiro não recebe soldo e não tem prazo: fica lá até um Resgate dar certo. Não ocupa lugar no limite de heróis: dá para contratar outro e montar o Resgate.',
    );
    const hired = accept(taken, command('hireHero', { offerId: 'offer-1' })).state;
    expect(hired.guild.heroes).toHaveLength(3);
    // Com dois de pé a casa está cheia de novo, com o cativo fora da conta.
    const full =
      'A Taverna Nv1 abriga 2 heróis, e o feudo já os tem: melhore a Taverna ou dispense um herói.';
    expect(refuse(hired, command('hireHero', { offerId: 'offer-2' }))).toEqual({
      code: 'HERO_LIMIT',
      message: full,
    });
    // O resgatado entra assim mesmo: três de pé, limite de dois, e a contratação segue barrada.
    const back = cloneState(hired);
    const rescued = back.guild.heroes.find((hero) => hero.id === 'hero-2');
    if (rescued !== undefined) {
      rescued.status = 'idle';
      rescued.captivity = null;
    }
    expect(currentShape(back, '')).toBeNull();
    expect(back.guild.heroes.filter((hero) => hero.status !== 'captured')).toHaveLength(3);
    expect(refuse(back, command('hireHero', { offerId: 'offer-2' }))).toEqual({
      code: 'HERO_LIMIT',
      message: full,
    });
    expect(view(back).tavern.offers[0]?.blockedReason).toBe(full);
    // Dispensar um só volta ao limite: ainda não abre lugar. Dispensar dois, ou subir a Taverna, abre.
    const two = accept(back, command('dismissHero', { heroId: 'hero-1' })).state;
    expect(refuse(two, command('hireHero', { offerId: 'offer-2' })).code).toBe('HERO_LIMIT');
    const one = accept(two, command('dismissHero', { heroId: 'hero-2' })).state;
    expect(
      accept(one, command('hireHero', { offerId: 'offer-2' })).state.guild.heroes,
    ).toHaveLength(2);
    // Um nível a mais só iguala o limite aos três de pé; com dois níveis, cabe mais um.
    expect(refuse(raisedTo(back, 2), command('hireHero', { offerId: 'offer-2' })).code).toBe(
      'HERO_LIMIT',
    );
    expect(
      accept(raisedTo(back, 3), command('hireHero', { offerId: 'offer-2' })).state.guild.heroes,
    ).toHaveLength(4);
  });

  it('o teto da guarda vale com os cativos dentro: com a lista cheia ninguém é contratado, mesmo com lugar no limite', () => {
    const packed = tavernScenario(0, (draft) => {
      for (let hero = 0; hero < balance.heroes.rosterCap; hero += 1) {
        const added = addHero(draft);
        if (hero >= 4) {
          added.status = 'captured';
          added.captivity = { sinceMs: 0, modelId: 'ruins' };
        }
      }
    }).state;
    packed.settlement.buildings.tavern = 5;
    expect(currentShape(packed, '')).toBeNull();
    // Quatro de pé, limite de seis: o limite deixaria; o teto da lista não.
    const message = `A guarda do feudo abriga ${balance.heroes.rosterCap} heróis, e o feudo já os tem: resgate quem está em cativeiro ou dispense um herói.`;
    expect(refuse(packed, command('hireHero', { offerId: 'offer-1' }))).toEqual({
      code: 'HERO_LIMIT',
      message,
    });
    expect(view(packed).tavern.offers[0]?.blockedReason).toBe(message);
    expect(packed.guild.heroes).toHaveLength(balance.heroes.rosterCap);
  });

  it('no nível máximo a recusa só manda dispensar', () => {
    const full = tavernScenario(0, (draft) => {
      for (let hero = 0; hero < 6; hero += 1) {
        addHero(draft);
      }
    }).state;
    full.settlement.buildings.tavern = 5;
    expect(refuse(full, command('hireHero', { offerId: 'offer-1' })).message).toBe(
      'A Taverna Nv5 abriga 6 heróis, e o feudo já os tem: dispense um herói.',
    );
  });

  it('sem ouro para o preço, a recusa diz quanto falta, e a visão marca o candidato', () => {
    const { state } = tavernScenario(0, (draft) => {
      draft.settlement.resources.gold = 190_000;
    });
    // A obra levou 120: sobram 70.
    expect(gold(state)).toBe(70_000);
    expect(refuse(state, command('hireHero', { offerId: 'offer-1' }))).toEqual({
      code: 'INSUFFICIENT_RESOURCES',
      message: 'Faltam 30 ouro.',
    });
    expect(
      view(state).tavern.offers.map((offer) => [offer.affordable, offer.blockedReason]),
    ).toEqual([
      [false, 'Faltam 30 ouro.'],
      [false, 'Faltam 60 ouro.'],
    ]);
  });

  it('um Carismático no feudo dá 20% de desconto, uma vez: dois não somam', () => {
    const plain = tavernScenario().state;
    const one = tavernScenario(0, (draft) => {
      addHero(draft, { name: 'Mécia', gender: 'f', traits: ['charismatic'] });
    }).state;
    const two = raisedTo(
      tavernScenario(0, (draft) => {
        addHero(draft, { name: 'Mécia', gender: 'f', traits: ['charismatic'] });
        addHero(draft, { name: 'Lopo', traits: ['prudent', 'charismatic'] });
      }).state,
      2,
    );
    const [offer] = plain.guild.tavernOffers;
    if (offer === undefined) {
      throw new Error('O cenário esperava um candidato.');
    }
    expect(bargainer(plain)).toBeNull();
    expect(hirePrice(plain, offer)).toEqual({ full: 100, price: 100, discount: null });
    expect(hirePrice(one, offer)).toMatchObject({ full: 100, price: 80 });
    expect(hirePrice(two, offer)).toMatchObject({ full: 100, price: 80 });
    expect(bargainer(two)?.hero.name).toBe('Mécia');

    expect(view(one).tavern.offers.map((entry) => [entry.price, entry.priceText])).toEqual([
      [80, '80 de ouro: 100, menos 20% por Mécia, Carismática'],
      [104, '104 de ouro: 130, menos 20% por Mécia, Carismática'],
    ]);
    expect(view(plain).tavern.offers.map((entry) => entry.priceText)).toEqual([
      '100 de ouro',
      '130 de ouro',
    ]);
    const hired = accept(one, command('hireHero', { offerId: 'offer-1' }));
    expect(gold(hired.state)).toBe(gold(one) - 80_000);
    expect(hired.events[0]).toMatchObject({
      data: { price: 80, fullPrice: 100, spent_gold: 80 },
    });
    expect(hired.events[0]?.text).toContain('pagou 80 de ouro');
    // O ouro que paga o preço com desconto e não paga o cheio basta.
    const tight = cloneState(one);
    tight.settlement.resources.gold = 80_000;
    expect(
      accept(tight, command('hireHero', { offerId: 'offer-1' })).state.settlement.resources.gold,
    ).toBe(0);
    // Dispensado o Carismático, o preço volta ao cheio.
    const alone = accept(one, command('dismissHero', { heroId: 'hero-1' })).state;
    expect(view(alone).tavern.offers[0]?.price).toBe(100);
  });

  it('a oferta de um modelo que o conteúdo já não tem não aparece e não pode ser contratada', () => {
    const { state } = tavernScenario();
    const orphan = cloneState(state);
    const [first] = orphan.guild.tavernOffers;
    if (first !== undefined) {
      first.templateId = 'retiredModel';
    }
    expect(view(orphan).tavern.offers.map((offer) => offer.offerId)).toEqual(['offer-2']);
    expect(refuse(orphan, command('hireHero', { offerId: 'offer-1' })).code).toBe('OFFER_GONE');
    expect(currentShape(JSON.parse(JSON.stringify(orphan)), '')).toBeNull();
  });
});

describe('a moral da Taverna (GDD §5.7; ADR 0017, decisão 10)', () => {
  it('+5 por nível, como termo permanente, a partir da virada de dia seguinte', () => {
    const { state, opensAt } = tavernScenario();
    // A moral não muda no instante da obra: só a virada a recalcula.
    expect(state.settlement.morale).toBe(balance.morale.base);
    const terms = view(state).morale.terms;
    expect(terms).toEqual([
      { id: 'base', label: 'Base', amount: 50 },
      { id: 'foodReserve', label: 'Comida guardada para 24 h', amount: 10 },
      { id: 'tavern', label: 'Taverna Nv1', amount: 5 },
    ]);
    expect(view(state).morale.breakdown).toBe(
      '50 (base) + 10 (comida guardada para 24 h) + 5 (taverna Nv1) = 65',
    );
    expect(advanceTo(state, DAY - 1).state.settlement.morale).toBe(50);
    expect(advanceTo(state, DAY).state.settlement.morale).toBe(65);
    const three = raisedTo(state, 3);
    expect(three.lastProcessedAt).toBeLessThan(opensAt + DAY);
    expect(advanceTo(three, DAY).state.settlement.morale).toBe(75);
    expect(view(three).morale.terms.at(-1)).toEqual({
      id: 'tavern',
      label: 'Taverna Nv3',
      amount: 15,
    });
  });

  it('a Taverna que fica pronta em cima da virada já conta nela, e a visão avisa antes', () => {
    const site = tavernSite(DAY - OPENS);
    const ordered = accept(site, command('startConstruction', { building: 'tavern' })).state;
    expect(view(ordered).morale.terms.map((term) => term.id)).toContain('tavern');
    expect(view(ordered).morale.next.value).toBe(65);
    expect(advanceTo(ordered, DAY).state.settlement.morale).toBe(65);
  });

  it('cada herói Devoto no feudo soma 5, com o nome dele na conta', () => {
    const { state } = tavernScenario(0, (draft) => {
      addHero(draft, { name: 'Edda', gender: 'f', traits: ['loyal'] });
    });
    const devout = accept(state, command('hireHero', { offerId: 'offer-2' })).state;
    expect(view(devout).morale.terms.slice(2)).toEqual([
      { id: 'tavern', label: 'Taverna Nv1', amount: 5 },
      { id: 'devout', label: 'Fé de Elvira', amount: 5 },
    ]);
    expect(advanceTo(devout, DAY).state.settlement.morale).toBe(70);
    // Dois Devotos são dois termos.
    const pair = cloneState(devout);
    addHero(pair, { name: 'Nuno', traits: ['devout'] });
    expect(moraleAt(pair, DAY)).toBe(75);
    expect(view(pair).morale.breakdown).toBe(
      '50 (base) + 10 (comida guardada para 24 h) + 5 (taverna Nv1) + 5 (fé de Elvira) + 5 (fé de Nuno) = 75',
    );
    // Dispensada, a fé sai da conta da virada seguinte.
    const gone = accept(devout, command('dismissHero', { heroId: 'hero-2' })).state;
    expect(advanceTo(gone, DAY).state.settlement.morale).toBe(65);
  });
});

describe('o festival (holdFestival; ADR 0017, decisão 10)', () => {
  const festival = (state: GameState) => accept(state, command('holdFestival', {}));

  it('cobra 100 de comida e 50 de ouro, não mexe na moral na hora e soma 15 a partir da virada seguinte', () => {
    const { state, opensAt } = tavernScenario();
    const held = festival(state);
    expect(held.state.settlement.resources.food).toBe(state.settlement.resources.food - 100_000);
    expect(gold(held.state)).toBe(gold(state) - 50_000);
    expect(held.events).toEqual([
      {
        type: 'festivalHeld',
        atMs: opensAt,
        text: 'No 1º dia da Primavera, o senhor de Pedra Alta mandou abrir os barris da Taverna: houve festival, e o povo cantou até tarde.',
        data: { morale: 15, days: 12, spent_food: 100, spent_gold: 50 },
      },
    ]);
    expect(held.state.settlement.morale).toBe(state.settlement.morale);
    expect(held.state.settlement.moraleEffects).toEqual([
      { id: 'festival', label: 'Festival na Taverna', amount: 15, untilMs: opensAt + 12 * DAY },
    ]);
    expect(held.state.guild.tavern).toEqual({
      nextRotationAtMs: opensAt + ROTATION,
      festival: { untilMs: opensAt + 12 * DAY },
      lastFestivalAtMs: opensAt,
    });
    // A ordem não sorteia nem cria nada.
    expect(held.state.rng).toStrictEqual(state.rng);
    expect(held.state.ids).toStrictEqual(state.ids);
    expect(view(held.state).morale.terms.at(-1)).toEqual({
      id: 'effect',
      label: 'Festival na Taverna',
      amount: 15,
    });
    expect(advanceTo(held.state, DAY).state.settlement.morale).toBe(80);
    expect(currentShape(JSON.parse(JSON.stringify(held.state)), '')).toBeNull();
  });

  it('dura 12 dias de jogo: conta em doze viradas, e a décima terceira o encerra, com a linha na Crônica', () => {
    const { state, opensAt } = tavernScenario();
    const held = festival(state).state;
    const morales: number[] = [];
    for (let day = 1; day <= 14; day += 1) {
      morales.push(advanceTo(held, day * DAY).state.settlement.morale);
    }
    expect(morales).toEqual([80, 80, 80, 80, 80, 80, 80, 80, 80, 80, 80, 80, 65, 65]);
    const lastDay = advanceTo(held, 13 * DAY - 1);
    expect(eventsOfType(lastDay.events, 'festivalEnded')).toEqual([]);
    expect(lastDay.state.guild.tavern.festival).toEqual({ untilMs: opensAt + 12 * DAY });
    const ended = advanceTo(lastDay.state, 13 * DAY);
    expect(eventsOfType(ended.events, 'festivalEnded')).toEqual([
      {
        type: 'festivalEnded',
        atMs: 13 * DAY,
        text: 'No 14º dia da Primavera, os barris secaram em Pedra Alta: o festival ficou para trás, e o povo voltou ao trabalho.',
        data: {},
      },
    ]);
    expect(ended.state.guild.tavern.festival).toBeNull();
    expect(ended.state.settlement.moraleEffects).toEqual([]);
    // O fim é uma virada de dia: não há instante novo na linha do tempo por causa dele.
    expect(nextEventAt(lastDay.state)).toBe(13 * DAY);
    // Na tela, o prazo é o da virada que o encerra, no ritmo da partida.
    expect(view(held).tavern.festival.activeForSeconds).toBe((13 * DAY - opensAt) / 1000);
    expect(view(ended.state).tavern.festival.activeForSeconds).toBeNull();
  });

  it('dado em cima de uma virada, conta nas doze seguintes', () => {
    const { state } = tavernScenario(3 * DAY - OPENS);
    expect(state.lastProcessedAt).toBe(3 * DAY);
    const held = festival(state).state;
    // A virada deste instante já recalculou a moral, com a Taverna e sem o festival.
    expect(held.settlement.morale).toBe(65);
    expect(advanceTo(held, 15 * DAY).state.settlement.morale).toBe(80);
    const ended = advanceTo(held, 16 * DAY);
    expect(ended.state.settlement.morale).toBe(65);
    expect(eventsOfType(ended.events, 'festivalEnded').map((event) => event.atMs)).toEqual([
      16 * DAY,
    ]);
  });

  it('um por estação: o segundo é recusado, e o da estação seguinte é aceito', () => {
    const { state } = tavernScenario(SUMMER - 3 * DAY, (draft) => {
      // Comida para um ano de festas, sem ninguém na Fazenda.
      draft.settlement.resources.food = 5_000_000;
    });
    const held = festival(state).state;
    expect(festivalHeldThisSeason(held, held.lastProcessedAt)).toBe(true);
    expect(refuse(held, command('holdFestival', {}))).toEqual({
      code: 'FESTIVAL_ALREADY_HELD',
      message: 'Um festival por estação: na Primavera o feudo já festejou.',
    });
    expect(view(held).tavern.festival).toMatchObject({
      available: false,
      blockedReason: 'Um festival por estação: na Primavera o feudo já festejou.',
    });
    // Um milissegundo antes do verão ainda é primavera.
    expect(refuse(advanceTo(held, SUMMER - 1).state, command('holdFestival', {})).code).toBe(
      'FESTIVAL_ALREADY_HELD',
    );
    // Na virada do verão o feudo pode festejar de novo, com o da primavera ainda em curso: o
    // efeito é trocado, não somado, e o prazo recomeça.
    const summer = advanceTo(held, SUMMER).state;
    expect(summer.guild.tavern.festival).not.toBeNull();
    expect(view(summer).tavern.festival.available).toBe(true);
    const again = festival(summer);
    expect(again.state.settlement.moraleEffects).toEqual([
      { id: 'festival', label: 'Festival na Taverna', amount: 15, untilMs: SUMMER + 12 * DAY },
    ]);
    expect(again.state.guild.tavern.lastFestivalAtMs).toBe(SUMMER);
    expect(refuse(again.state, command('holdFestival', {})).code).toBe('FESTIVAL_ALREADY_HELD');
    const through = advanceTo(again.state, SUMMER + 14 * DAY);
    // Um fim só, o do segundo.
    expect(eventsOfType(through.events, 'festivalEnded').map((event) => event.atMs)).toEqual([
      SUMMER + 13 * DAY,
    ]);
    // E no outono, no inverno e na primavera do ano seguinte, um de cada vez.
    for (const season of [AUTUMN, WINTER, 84 * DAY]) {
      const there = advanceTo(through.state, season + HOUR).state;
      const party = festival(there).state;
      expect(refuse(party, command('holdFestival', {})).code).toBe('FESTIVAL_ALREADY_HELD');
    }
  });

  it('sem Taverna e sem o custo, a recusa diz o que falta', () => {
    expect(refuse(tavernSite(), command('holdFestival', {}))).toEqual({
      code: 'TAVERN_REQUIRED',
      message: 'Erga a Taverna primeiro.',
    });
    const poor = tavernScenario(0, (draft) => {
      draft.settlement.resources.food = 40_000;
      draft.settlement.resources.gold = 150_000;
    }).state;
    const refusal = refuse(poor, command('holdFestival', {}));
    expect(refusal.code).toBe('INSUFFICIENT_RESOURCES');
    expect(refusal.message).toMatch(/^Faltam \d+ comida e 20 ouro\.$/);
    expect(view(poor).tavern.festival).toMatchObject({
      available: false,
      cost: [
        { resource: 'food', amount: 100 },
        { resource: 'gold', amount: 50, missing: 20 },
      ],
    });
  });

  it('o festival é tempo de jogo: no ritmo 3 a tela diz 8 h, e a regra é a mesma', () => {
    const fast = tavernScenario(0, () => {}, { timeScale: 3 }).state;
    expect(view(fast).tavern.festival.effectText).toBe(
      '+15 de moral por 8 h, a partir da próxima virada do dia. Um festival por estação.',
    );
    const held = festival(fast).state;
    expect(held.settlement.moraleEffects[0]?.untilMs).toBe(fast.lastProcessedAt + 12 * DAY);
    expect(eventsOfType(advanceTo(held, 13 * DAY).events, 'festivalEnded')).toHaveLength(1);
  });
});

describe('a Taverna na visão e na névoa', () => {
  it('sem Taverna a visão existe, vazia, e diz como obtê-la', () => {
    const early = view(tavernSite(0, (draft) => (draft.settlement.buildings.townHall = 2))).tavern;
    expect(early).toEqual({
      level: 0,
      text: 'A Taverna abre com o Salão do Senhor Nv3: nela o feudo contrata heróis e dá festivais.',
      offers: [],
      nextRotationInSeconds: null,
      festival: {
        available: false,
        cost: [
          { resource: 'food', label: 'Comida', amount: 100, missing: 0 },
          { resource: 'gold', label: 'Ouro', amount: 50, missing: 0 },
        ],
        effectText:
          '+15 de moral por 24 h, a partir da próxima virada do dia. Um festival por estação.',
        blockedReason: 'Erga a Taverna primeiro: ela abre com o Salão do Senhor Nv3.',
        activeForSeconds: null,
      },
    });
    expect(view(tavernSite()).tavern.text).toBe(
      'Erga a Taverna: nela o feudo contrata heróis e dá festivais.',
    );
  });

  it('com a Taverna, a ficha de cada candidato, o preço, o soldo e o prazo da troca', () => {
    const { state } = tavernScenario(0, () => {}, { timeScale: 3 });
    expect(view(state).tavern).toMatchObject({
      level: 1,
      text: 'Taverna Nv1: abriga 2 heróis, traz 2 candidatos a cada troca e soma 5 à moral.',
      nextRotationInSeconds: 8 * 3600,
      offers: [
        {
          offerId: 'offer-1',
          name: 'Soeiro',
          classLabel: 'Arqueiro',
          level: 1,
          traits: [
            {
              label: 'Rastreador',
              text: 'Acha o caminho de volta a um lugar mesmo quando a jornada vai mal.',
            },
          ],
          price: 100,
          priceText: '100 de ouro',
          // 2 de ouro por hora de jogo, no ritmo 3.
          wagePerHour: 6,
          affordable: true,
          blockedReason: null,
        },
        {
          offerId: 'offer-2',
          name: 'Elvira',
          classLabel: 'Clériga',
          traits: [{ label: 'Devota' }],
        },
      ],
    });
  });

  it('a visão não leva o gerador, os contadores, o modelo nem nada da próxima rotação', () => {
    const { state, opensAt } = tavernScenario();
    const text = JSON.stringify(view(state));
    expect(text).not.toContain('rng');
    expect(text).not.toContain('trackerArcher');
    expect(text).not.toContain('templateId');
    for (const word of state.rng.tavern ?? []) {
      expect(text).not.toContain(String(word));
    }
    // Os candidatos da próxima troca ainda não existem em lugar nenhum: nem os nomes deles.
    const next = advanceTo(state, opensAt + ROTATION).state.guild.tavernOffers;
    for (const offer of next) {
      expect(text).not.toContain(offer.name);
      expect(text).not.toContain(offer.offerId);
    }
  });

  it('olhar a tela e perguntar pelo próximo evento não muda o gerador nem os contadores, com a Taverna viva', () => {
    const { state, opensAt } = tavernScenario();
    for (const at of [
      opensAt,
      opensAt + ROTATION - 1,
      opensAt + ROTATION,
      opensAt + 5 * ROTATION + HOUR,
    ]) {
      const there = advanceTo(state, at).state;
      const frozen = JSON.stringify(there);
      view(there);
      nextEventAt(there);
      // A visão de um instante futuro avança uma cópia: a entrada fica como estava.
      deriveViewState(there, at + 3 * ROTATION);
      expect(JSON.stringify(there)).toBe(frozen);
    }
  });

  it('a previsão da moral não sorteia: a rotação que cai antes da virada do dia fica de fora da cópia', () => {
    // A rotação do cenário cai 15 minutos depois de uma virada: da virada até lá, a previsão
    // da próxima virada passaria por ela.
    const { state, opensAt } = tavernScenario();
    const before = advanceTo(state, opensAt + ROTATION - 5 * MINUTE).state;
    const forecast = stateAtNextMoraleTurn(before);
    expect(forecast.lastProcessedAt).toBe(13 * DAY);
    expect(forecast.rng).toStrictEqual(before.rng);
    expect(forecast.ids).toStrictEqual(before.ids);
    expect(forecast.guild.tavernOffers).toStrictEqual(before.guild.tavernOffers);
    // Nem a Taverna que fica pronta antes da virada: a cópia a vê erguida (o termo da moral
    // conta), sem sortear a primeira lista.
    const building = accept(tavernSite(), command('startConstruction', { building: 'tavern' }));
    const ahead = stateAtNextMoraleTurn(building.state);
    expect(ahead.settlement.buildings.tavern).toBe(1);
    expect(ahead.rng).toStrictEqual({});
    expect(ahead.ids).toStrictEqual({});
    expect(ahead.guild.tavernOffers).toEqual([]);
    expect(JSON.stringify(view(building.state))).not.toContain('offer-');
    // E a moral prevista é a que a virada entrega.
    expect(view(before).morale.next.value).toBe(
      advanceTo(before, 13 * DAY).state.settlement.morale,
    );
  });
});
