import { councilCards } from '@lotg/content';
import { describe, expect, it } from 'vitest';

import { cloneState } from './state';
import { emptyPosts } from './formations';
import { advanceTo } from './advance';
import { eligibleCards, meetsRequirements, optionLock } from './council';
import {
  accept,
  addHero,
  AUTUMN,
  command,
  DAY,
  dealt,
  gameAt,
  quietCouncil,
  quietHorde,
  refuse,
  send,
  YEAR,
} from './test-helpers';
import { accessLock, modelOf } from './expeditions';
import { nextHiddenDestination, revealDestination } from './outcomes';
import { nextEventAt } from './timeline';
import { deriveViewState } from './view';

const paws = councilCards.find((card) => card.id === 'whitePaws')!;
const hunt = councilCards.find((card) => card.id === 'whiteWolf')!.options[0]!;

function ready(atMs = AUTUMN) {
  const state = gameAt(atMs);
  quietCouncil(state);
  quietHorde(state);
  state.settlement.buildings.guild = 1;
  state.settlement.buildings.granary = 3;
  state.settlement.resources.food = 300_000;
  state.map.tiles.wolfDen!.threatActive = false;
  addHero(state);
  return state;
}

function unlock(atMs = AUTUMN) {
  const state = dealt(ready(atMs), 'whiteWolf').state;
  return accept(
    state,
    command('answerCard', { instanceId: state.council.pending[0]!.instanceId, optionId: 'hunt' }),
  );
}

describe('ganchos das fichas do Lobo Branco', () => {
  it('só a carta abre a caçada: descoberta comum e envio direto não a liberam', () => {
    const state = ready();
    expect(
      deriveViewState(state, state.lastProcessedAt).guild.available.some(
        (offer) => offer.modelId === 'whiteWolfHunt',
      ),
    ).toBe(false);
    expect(revealDestination(state, 'whiteWolfHunt')).toBe(false);
    state.map.discovered = ['ruins', 'abandonedMine', 'swamp'];
    expect(nextHiddenDestination(state)).toBeNull();
    expect(
      refuse(
        state,
        command('sendExpedition', {
          modelId: 'whiteWolfHunt',
          heroIds: [state.guild.heroes[0]!.id],
          posture: 'balanced',
        }),
      ),
    ).toMatchObject({ code: 'EXPEDITION_LOCKED' });
  });

  it('a visão e o próximo instante não sorteiam; mostram o prazo real sem expor flags', () => {
    const state = unlock().state;
    const before = cloneState(state);
    const view = deriveViewState(state, state.lastProcessedAt, { timeScale: 3 });
    expect(view.guild.available.find((offer) => offer.modelId === 'whiteWolfHunt')).toMatchObject({
      expiresInSeconds: (6 * DAY) / 3000,
    });
    expect(JSON.stringify(view)).not.toContain('whiteWolf.hunt');
    nextEventAt(state);
    expect(state).toEqual(before);
  });

  it('a equipe que partiu no último milissegundo termina depois do prazo, sem reabrir o destino', () => {
    const state = unlock().state;
    state.guild.heroes[0]!.level = 10;
    const until = state.map.expeditionUnlocks.whiteWolfHunt!;
    const before = advanceTo(state, until - 1).state;
    const sent = send(before, 'whiteWolfHunt', [before.guild.heroes[0]!.id]);
    const expired = advanceTo(sent.state, until).state;
    expect(expired.guild.expeditions).toHaveLength(1);
    expect(expired.map.discovered).not.toContain('whiteWolfHunt');
    expect(accessLock(expired, modelOf('whiteWolfHunt')!)).not.toBeNull();
    const returned = advanceTo(expired, until + 2 * DAY);
    expect(returned.state.guild.expeditions).toEqual([]);
    expect(returned.state.guild.reports[0]?.modelId).toBe('whiteWolfHunt');
    expect(returned.state.map.discovered).not.toContain('whiteWolfHunt');
    expect(Object.keys(returned.state.rng).some((key) => key.startsWith('expedition:'))).toBe(
      false,
    );
    const noDeparture = advanceTo(state, until).state;
    expect(
      refuse(
        noDeparture,
        command('sendExpedition', {
          modelId: 'whiteWolfHunt',
          heroIds: [noDeparture.guild.heroes[0]!.id],
          posture: 'balanced',
        }),
      ),
    ).toMatchObject({ code: 'EXPEDITION_LOCKED' });
  });

  it('as pegadas exigem outono, Covil existente e limpo, nenhum ramo em curso e uma chegada por ano', () => {
    const state = ready();
    expect(eligibleCards(state, AUTUMN, [paws])).toEqual([paws]);
    expect(meetsRequirements(state, paws, 0)).toBe(false);
    state.map.tiles.wolfDen!.threatActive = true;
    expect(meetsRequirements(state, paws, AUTUMN)).toBe(false);
    delete state.map.tiles.wolfDen;
    expect(meetsRequirements(state, paws, AUTUMN)).toBe(false);
    state.map.tiles.wolfDen = { type: 'wolfDen', threatActive: false };
    for (const flag of ['whiteWolf.hunt', 'whiteWolf.offer', 'whiteWolf.ignored']) {
      state.council.flags = { [flag]: true };
      expect(meetsRequirements(state, paws, AUTUMN)).toBe(false);
    }
    state.council.flags = {};
    state.council.seenThisYear = ['whitePaws'];
    expect(eligibleCards(state, AUTUMN, [paws])).toEqual([]);
    const next = advanceTo(state, YEAR).state;
    expect(next.map.tiles.wolfDen?.threatActive).toBe(true);
    expect(meetsRequirements(next, paws, YEAR + AUTUMN)).toBe(false);
    next.map.tiles.wolfDen!.threatActive = false;
    expect(eligibleCards(next, YEAR + AUTUMN, [paws])).toEqual([paws]);
  });

  it('a opção pede Guilda e um herói que possa partir, sem aceitar ferido, ausente ou comandante', () => {
    const state = ready();
    const hero = state.guild.heroes[0]!;
    expect(optionLock(state, hunt)).toBeNull();
    state.settlement.buildings.guild = 0;
    expect(optionLock(state, hunt)).toContain('Guilda');
    state.settlement.buildings.guild = 1;
    hero.status = 'injured';
    expect(optionLock(state, hunt)).toContain('herói');
    hero.status = 'expedition';
    expect(optionLock(state, hunt)).toContain('herói');
    hero.status = 'idle';
    state.army.activeFormationId = 'formation-1';
    state.army.formations = [
      {
        id: 'formation-1',
        name: 'Defesa',
        posts: emptyPosts(),
        commanders: { left: hero.id, center: null, right: null },
      },
    ];
    expect(optionLock(state, hunt)).toContain('herói');
  });

  it.each([0.5, 1, 3])(
    'abre por seis dias contados da escolha no ritmo %s, sem sortear',
    (timeScale) => {
      const start = dealt(ready(AUTUMN + 1234), 'whiteWolf').state;
      start.settings.timeScale = timeScale;
      const before = cloneState(start).rng;
      const chosen = accept(
        start,
        command('answerCard', {
          instanceId: start.council.pending[0]!.instanceId,
          optionId: 'hunt',
        }),
      );
      expect(chosen.state.map.discovered).toContain('whiteWolfHunt');
      expect(chosen.state.map.expeditionUnlocks).toEqual({
        whiteWolfHunt: start.lastProcessedAt + 6 * DAY,
      });
      expect(chosen.state.rng).toEqual(before);
      const view = deriveViewState(start, start.lastProcessedAt, { timeScale });
      expect(view.council.pending[0]?.options[0]?.effectsText).toContain('6 dias');
    },
  );

  it('expira no instante exato; a divisão de intervalo preserva estado, eventos e sorteios', () => {
    const start = unlock().state;
    const end = AUTUMN + 6 * DAY;
    const before = advanceTo(start, end - 1);
    expect(before.state.map.discovered).toContain('whiteWolfHunt');
    const divided = advanceTo(before.state, end);
    const whole = advanceTo(start, end);
    expect(divided.state).toEqual(whole.state);
    expect([...before.events, ...divided.events]).toEqual(whole.events);
    expect(whole.state.map.discovered).not.toContain('whiteWolfHunt');
    expect(whole.state.map.expeditionUnlocks).toEqual({});
  });

  it('a fera é uma só: bloqueia segunda equipe a caminho e encerra a janela só quando volta com a fera vencida', () => {
    const start = unlock().state;
    start.settlement.buildings.guild = 2;
    const firstHero = start.guild.heroes[0]!;
    const secondHero = addHero(start, { name: 'Rolf', classId: 'warrior', level: 1 });
    firstHero.classId = 'cleric';
    firstHero.level = 1;

    // 1. Primeira equipe parte; segunda equipe é recusada enquanto a primeira está a caminho.
    const sent = send(start, 'whiteWolfHunt', [firstHero.id], 'balanced', 0);
    const reason =
      'Esse destino ainda não está ao alcance do feudo: outra equipe já partiu para essa caçada.';
    expect(
      refuse(
        sent.state,
        command('sendExpedition', {
          modelId: 'whiteWolfHunt',
          heroIds: [secondHero.id],
          posture: 'balanced',
        }),
      ),
    ).toEqual({
      code: 'EXPEDITION_LOCKED',
      message: reason,
    });
    expect(
      deriveViewState(sent.state, sent.state.lastProcessedAt).guild.available.find(
        (offer) => offer.modelId === 'whiteWolfHunt',
      ),
    ).toMatchObject({
      locked: true,
      lockedReason: reason,
      canSend: false,
      sendBlockedReason: reason,
    });

    // 2. Clérigo Nv1 sozinho nunca vence o nó da fera (poder 32 contra dificuldade 44):
    // na volta sem vencer a fera, a janela de seis dias continua aberta para nova tentativa.
    const failedReturn = advanceTo(sent.state, sent.state.lastProcessedAt + 2 * 3_600_000).state;
    expect(failedReturn.guild.expeditions).toEqual([]);
    expect(['setback', 'disaster']).toContain(
      failedReturn.guild.reports[0]?.log.find((entry) => entry.nodeId === 'whiteWolf')?.outcome,
    );
    expect(failedReturn.map.discovered).toContain('whiteWolfHunt');
    expect(failedReturn.map.expeditionUnlocks.whiteWolfHunt).toBe(AUTUMN + 6 * DAY);

    // 3. Equipe forte vence a fera: continua bloqueando outra equipe durante o caminho de volta
    // e encerra a janela no instante em que chega em casa.
    secondHero.level = 10;
    const retry = send(failedReturn, 'whiteWolfHunt', [secondHero.id], 'balanced', 0);
    const returning = advanceTo(retry.state, retry.state.lastProcessedAt + 90 * 60_000).state;
    expect(returning.guild.expeditions[0]?.status).toBe('returning');
    expect(
      ['full', 'success'].includes(
        returning.guild.expeditions[0]?.log.find((entry) => entry.nodeId === 'whiteWolf')
          ?.outcome ?? '',
      ),
    ).toBe(true);
    expect(
      refuse(
        returning,
        command('sendExpedition', {
          modelId: 'whiteWolfHunt',
          heroIds: [firstHero.id],
          posture: 'balanced',
        }),
      ).code,
    ).toBe('EXPEDITION_LOCKED');

    const wonReturnAt = retry.state.lastProcessedAt + 120 * 60_000;
    const stepBefore = advanceTo(returning, wonReturnAt - 1);
    const stepAt = advanceTo(stepBefore.state, wonReturnAt);
    const direct = advanceTo(returning, wonReturnAt);
    expect(stepAt.state).toEqual(direct.state);
    expect([...stepBefore.events, ...stepAt.events]).toEqual(direct.events);
    expect(direct.state.map.discovered).not.toContain('whiteWolfHunt');
    expect(direct.state.map.expeditionUnlocks).toEqual({});
    expect(
      deriveViewState(direct.state, direct.state.lastProcessedAt).guild.available.some(
        (offer) => offer.modelId === 'whiteWolfHunt',
      ),
    ).toBe(false);
    expect(
      refuse(
        direct.state,
        command('sendExpedition', {
          modelId: 'whiteWolfHunt',
          heroIds: [secondHero.id],
          posture: 'balanced',
        }),
      ),
    ).toEqual({
      code: 'EXPEDITION_LOCKED',
      message:
        'Esse destino ainda não está ao alcance do feudo: a Guilda não conhece esse caminho.',
    });
  });
});
