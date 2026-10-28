import { expeditionModels, type DifficultyId } from '@lotg/content';
import { describe, expect, it } from 'vitest';

import { advanceTo } from './advance';
import { settleHordeTiles } from './hordePlan';
import { currentShape } from './migrations';
import { harmOf } from './outcomes';
import { cloneState } from './state';
import {
  accept,
  addHero,
  AUTUMN,
  command,
  expeditionAtNode,
  guildHall,
  HOUR,
  nextVariantIs,
  refuse,
  send,
  SPRING,
  SUMMER,
  WINTER,
  YEAR,
  weakened,
} from './test-helpers';
import type { GameState } from './types';
import { deriveViewState } from './view';

/** Configura um feudo no outono com a Fortaleza da Horda ativa e heróis prontos. */
function autumnWithFortress(
  edit?: (draft: GameState) => void,
  difficulty: DifficultyId = 'lord',
): GameState {
  return guildHall(
    AUTUMN,
    (draft) => {
      draft.map.tiles.hordeFortress = { type: 'hordeFortress', threatActive: true };
      draft.settlement.buildings.watchtower = 2;
      draft.settlement.buildings.guild = 2;
      addHero(draft, { name: 'Edda', gender: 'f', classId: 'warrior', level: 3 });
      addHero(draft, { name: 'Rolf', gender: 'm', classId: 'archer', level: 3 });
      addHero(draft, { name: 'Isolda', gender: 'f', classId: 'mage', level: 3 });
      settleHordeTiles(draft, AUTUMN, []);
      edit?.(draft);
    },
    { difficulty },
  );
}

describe('V4F-T1 · Sabotagem da Fortaleza', () => {
  it.each([
    ['peasant', 'severe', true],
    ['lord', 'captured', false],
    ['ironKing', 'died', false],
  ] as const)('toda prova usa a captura pela dificuldade em %s', (difficulty, kind, spared) => {
    const state = autumnWithFortress(undefined, difficulty);
    const model = expeditionModels.find((entry) => entry.id === 'sabotage')!;
    let trials = 0;
    for (const [index, variant] of model.variants.entries()) {
      for (const [nodeId, node] of Object.entries(variant.nodes)) {
        if (!('trial' in node) || node.trial === undefined) continue;
        trials += 1;
        expect(node.trial.onDisaster, `${index}/${nodeId}`).toBe('capture');
        expect(harmOf(state, 'disaster', node.trial.onDisaster)).toEqual({ kind, spared });
      }
    }
    expect(trials).toBe(15);
  });

  it.each([0, 1, 2])(
    'a jornada completa da variante %i dura seis horas, com decisão imediata',
    (variant) => {
      const state = autumnWithFortress((draft) => {
        for (const hero of draft.guild.heroes) hero.level = 5;
      });
      const model = expeditionModels.find((entry) => entry.id === 'sabotage')!;
      let current = send(
        state,
        'sabotage',
        ['hero-1', 'hero-2', 'hero-3'],
        'balanced',
        variant,
      ).state;
      for (let step = 0; step < 10 && current.guild.expeditions.length > 0; step += 1) {
        const expedition = current.guild.expeditions[0]!;
        if (expedition.crossroads !== null) {
          const node = model.variants[variant]!.nodes[expedition.nodeId]!;
          if (node.kind !== 'crossroads') throw new Error('Encruzilhada esperada.');
          current = accept(
            current,
            command('chooseExpeditionPath', {
              expeditionId: expedition.id,
              optionId: node.posture.balanced,
            }),
          ).state;
        } else {
          current = advanceTo(current, expedition.nodeEndsAtMs!).state;
        }
      }
      expect(current.guild.expeditions).toHaveLength(0);
      expect(current.guild.reports).toHaveLength(1);
      expect(current.lastProcessedAt - AUTUMN).toBe(6 * HOUR);
      expect(model.durationMs).toBe(6 * HOUR);
      expect(
        deriveViewState(state, AUTUMN).guild.available.find((offer) => offer.modelId === 'sabotage')
          ?.durationSeconds,
      ).toBe(6 * 3600);
    },
  );

  it.each([
    [0, 124, 146, 103, 'success'],
    [1, 136, 160, 112, 'setback'],
    [2, 148, 175, 122, 'setback'],
  ] as const)(
    'a régua e a resolução incluem os reforços após %i tentativas',
    (attempts, difficulty, comfort, risk, outcome) => {
      const state = autumnWithFortress((draft) => {
        draft.horde.sabotages.attempts = attempts;
        for (const hero of draft.guild.heroes) hero.level = 1;
        nextVariantIs(draft, 'sabotage', 0);
      });
      const before = cloneState(state);
      const offer = deriveViewState(state, AUTUMN).guild.available.find(
        (entry) => entry.modelId === 'sabotage',
      )!;
      expect(offer.firstStretchDifficulty).toBe(difficulty);
      expect(offer.fit).toMatchObject({ comfortPower: comfort, riskPower: risk });
      expect(offer.firstStretchText).toContain(String(difficulty));
      expect(offer.fit?.text).toContain(String(comfort));
      expect(offer.firstStretchText).not.toContain('Xamã');
      expect(state).toEqual(before);
      const sent = send(state, 'sabotage', ['hero-1', 'hero-2', 'hero-3'], 'balanced', 0);
      // Vetor com a sorte neutra 100 no primeiro sorteio, igual nas três tentativas.
      sent.state.rng[`expedition:${sent.expedition.id}`] = [1, 13, 3, 4];
      const resolved = advanceTo(sent.state, sent.expedition.nodeEndsAtMs!);
      expect(resolved.state.guild.expeditions[0]!.log[0]!.outcome).toBe(outcome);
    },
  );

  describe('recusas de envio', () => {
    it('recusa fora do outono com SABOTAGE_SEASON', () => {
      const heroes = ['hero-1', 'hero-2', 'hero-3'];

      // Primavera
      const spring = guildHall(SPRING, (d) => {
        d.map.tiles.hordeFortress = { type: 'hordeFortress', threatActive: true };
        addHero(d, { name: 'Edda' });
        addHero(d, { name: 'Rolf' });
        addHero(d, { name: 'Isolda' });
      });
      expect(
        refuse(
          spring,
          command('sendExpedition', { modelId: 'sabotage', heroIds: heroes, posture: 'balanced' }),
        ).code,
      ).toBe('SABOTAGE_SEASON');

      // Verão
      const summer = guildHall(SUMMER, (d) => {
        d.map.tiles.hordeFortress = { type: 'hordeFortress', threatActive: true };
        addHero(d, { name: 'Edda' });
        addHero(d, { name: 'Rolf' });
        addHero(d, { name: 'Isolda' });
      });
      expect(
        refuse(
          summer,
          command('sendExpedition', { modelId: 'sabotage', heroIds: heroes, posture: 'balanced' }),
        ).code,
      ).toBe('SABOTAGE_SEASON');

      // Inverno
      const winter = guildHall(WINTER, (d) => {
        d.map.tiles.hordeFortress = { type: 'hordeFortress', threatActive: true };
        addHero(d, { name: 'Edda' });
        addHero(d, { name: 'Rolf' });
        addHero(d, { name: 'Isolda' });
      });
      expect(
        refuse(
          winter,
          command('sendExpedition', { modelId: 'sabotage', heroIds: heroes, posture: 'balanced' }),
        ).code,
      ).toBe('SABOTAGE_SEASON');
    });

    it.each([
      [SPRING, 0, 'SABOTAGE_SEASON'],
      [SUMMER, 0, 'SABOTAGE_SEASON'],
      [WINTER, 0, 'SABOTAGE_SEASON'],
      [AUTUMN, 3, 'SABOTAGE_LIMIT'],
    ] as const)('descobrir sabotage não contorna a recusa %s/%i → %s', (atMs, attempts, code) => {
      const state = guildHall(atMs, (draft) => {
        draft.map.discovered.push('sabotage');
        draft.map.tiles.hordeFortress = { type: 'hordeFortress', threatActive: true };
        draft.horde.sabotages.attempts = attempts;
        for (const name of ['Edda', 'Rolf', 'Isolda']) addHero(draft, { name });
      });
      expect(currentShape(state, '')).toBeNull();
      expect(
        refuse(
          state,
          command('sendExpedition', {
            modelId: 'sabotage',
            heroIds: ['hero-1', 'hero-2', 'hero-3'],
            posture: 'balanced',
          }),
        ).code,
      ).toBe(code);
      const offer = deriveViewState(state, atMs).guild.available.find(
        (entry) => entry.modelId === 'sabotage',
      )!;
      expect(offer.canSend).toBe(false);
      expect(offer.locked).toBe(true);
    });

    it('recusa equipes que não têm exatamente 3 heróis com TEAM_SIZE', () => {
      const state = autumnWithFortress((d) => {
        addHero(d, { name: 'Aldo' });
      });

      // 1 herói
      expect(
        refuse(
          state,
          command('sendExpedition', {
            modelId: 'sabotage',
            heroIds: ['hero-1'],
            posture: 'balanced',
          }),
        ).code,
      ).toBe('TEAM_SIZE');

      // 2 heróis
      expect(
        refuse(
          state,
          command('sendExpedition', {
            modelId: 'sabotage',
            heroIds: ['hero-1', 'hero-2'],
            posture: 'balanced',
          }),
        ).code,
      ).toBe('TEAM_SIZE');

      // 4 heróis
      expect(
        refuse(
          state,
          command('sendExpedition', {
            modelId: 'sabotage',
            heroIds: ['hero-1', 'hero-2', 'hero-3', 'hero-4'],
            posture: 'balanced',
          }),
        ).code,
      ).toBe('TEAM_SIZE');
    });

    it('recusa quando a Fortaleza não está ativa com EXPEDITION_LOCKED', () => {
      const state = autumnWithFortress((d) => {
        d.map.tiles.hordeFortress = { type: 'hordeFortress', threatActive: false };
      });
      expect(
        refuse(
          state,
          command('sendExpedition', {
            modelId: 'sabotage',
            heroIds: ['hero-1', 'hero-2', 'hero-3'],
            posture: 'balanced',
          }),
        ).code,
      ).toBe('EXPEDITION_LOCKED');
    });

    it('permite 3 sabotagens no ano e recusa a quarta com SABOTAGE_LIMIT', () => {
      const state = autumnWithFortress();
      const heroIds = ['hero-1', 'hero-2', 'hero-3'];

      // 1ª tentativa
      state.horde.sabotages.attempts = 0;
      const sent1 = send(state, 'sabotage', heroIds);
      expect(sent1.state.horde.sabotages.attempts).toBe(1);

      // Limpa para a 2ª tentativa
      sent1.state.guild.expeditions = [];
      for (const h of sent1.state.guild.heroes) h.status = 'idle';
      const sent2 = send(sent1.state, 'sabotage', heroIds);
      expect(sent2.state.horde.sabotages.attempts).toBe(2);

      // Limpa para a 3ª tentativa
      sent2.state.guild.expeditions = [];
      for (const h of sent2.state.guild.heroes) h.status = 'idle';
      const sent3 = send(sent2.state, 'sabotage', heroIds);
      expect(sent3.state.horde.sabotages.attempts).toBe(3);

      // 4ª tentativa: recusada com SABOTAGE_LIMIT
      sent3.state.guild.expeditions = [];
      for (const h of sent3.state.guild.heroes) h.status = 'idle';
      const fourth = refuse(
        sent3.state,
        command('sendExpedition', { modelId: 'sabotage', heroIds, posture: 'balanced' }),
      );
      expect(fourth.code).toBe('SABOTAGE_LIMIT');
      expect(fourth.message).toContain('A Fortaleza só pode ser sabotada até 3 vezes por ano');
    });
  });

  describe('mecânicas da sabotagem', () => {
    it('o enfraquecimento reduz a onda em 15% e decrementa postos da composição', () => {
      const state = autumnWithFortress();
      const initialWave1Count = state.horde.wavePlan!.waves[0]!.composition.reduce(
        (sum, p) => sum + p.count,
        0,
      );

      // Executa sabotagem da onda 1
      const heroIds = ['hero-1', 'hero-2', 'hero-3'];
      const { state: sentState, expedition } = send(state, 'sabotage', heroIds, 'balanced', 0);
      const endsAt = expedition.nodeEndsAtMs!;
      const step = advanceTo(sentState, endsAt);

      // Nó 1 concluído com sucesso
      expect(step.state.horde.sabotages.successes).toBe(1);
      const wave1 = step.state.horde.wavePlan!.waves.find((w) => w.number === 1)!;
      expect(wave1.reductionPercent).toBe(15);
      const newWave1Count = wave1.composition.reduce((sum, p) => sum + p.count, 0);
      expect(newWave1Count).toBe(Math.floor((initialWave1Count * 85) / 100));

      // Crônica registrou a sabotagem
      const sabotagedEvent = step.events.find((e) => e.type === 'hordeSabotaged');
      expect(sabotagedEvent).toBeDefined();
      expect(sabotagedEvent?.text).toContain('a primeira onda');
    });

    it('derrotar o Xamã registra o presságio exato da onda 3', () => {
      const state = autumnWithFortress((d) => {
        // Heróis fortes garantem passar até o final
        for (const h of d.guild.heroes) {
          h.level = 5;
        }
      });
      const heroIds = ['hero-1', 'hero-2', 'hero-3'];
      const { state: sentState, expedition } = send(state, 'sabotage', heroIds, 'balanced', 0);

      // Passo 1: nó 1
      const s1 = advanceTo(sentState, AUTUMN + HOUR);
      // Passo 2: nó 2 até a encruzilhada
      const s2 = advanceTo(s1.state, AUTUMN + 2 * HOUR);
      expect(s2.state.guild.expeditions[0]?.crossroads).not.toBeNull();

      // Passo 3: escolhe queimar oficinas de cerco (burnSiegeWorks) para alcançar o Xamã
      const chosen = accept(
        s2.state,
        command('chooseExpeditionPath', {
          expeditionId: expedition.id,
          optionId: 'burnSiegeWorks',
        }),
      );

      // Passo 4: nó 3 (oficinas de cerco)
      const s3 = advanceTo(chosen.state, AUTUMN + 3 * HOUR);
      // Passo 5: nó 4 (Xamã)
      const s4 = advanceTo(s3.state, AUTUMN + 4 * HOUR);

      // Confere se o presságio da onda 3 foi gravado com clareza máxima (exact)
      const exactOmen = s4.state.horde.omens.find((o) => o.wave === 3 && o.clarity === 'exact');
      expect(exactOmen).toBeDefined();
      expect(exactOmen?.reveals).toEqual(
        s4.state.horde.wavePlan!.waves.find((w) => w.number === 3)!.composition,
      );
    });

    it.each([
      ['peasant', 'heroInjured', 'severe'],
      ['lord', 'heroCaptured', 'captured'],
      ['ironKing', 'heroDied', 'died'],
    ] as const)('o Desastre certo alerta e aplica %s → %s', (difficulty, eventType, harm) => {
      const state = autumnWithFortress(undefined, difficulty);
      const heroIds = ['hero-1', 'hero-2', 'hero-3'];
      const initialCount = state.horde.wavePlan!.waves[0]!.composition.reduce(
        (sum, post) => sum + post.count,
        0,
      );
      const sent = send(state, 'sabotage', heroIds, 'bold', 0);
      // Três Clérigos Descontentes Nv1 não alcançam sequer Revés no bastião,
      // mesmo com a melhor sorte. O teste exige o desfecho antes de conferir o dano.
      const positioned = expeditionAtNode(weakened(sent.state, heroIds), 'warriorBastion');
      const step = advanceTo(positioned.state, positioned.endsAt);
      expect(
        step.events.filter(
          (event) => event.type === 'expeditionNodeFailed' && event.data.outcome === 'disaster',
        ),
      ).toHaveLength(1);
      expect(step.events.filter((event) => event.type === eventType)).toHaveLength(1);
      expect(step.events.filter((event) => event.type === 'hordeAlerted')).toHaveLength(1);
      expect(step.state.horde.sabotages.alerted).toBe(true);
      expect(
        step.state.horde.wavePlan!.waves[0]!.composition.reduce((sum, post) => sum + post.count, 0),
      ).toBe(Math.floor((initialCount * 110) / 100));
      expect(step.state.guild.expeditions[0]!.log[0]!.harm?.kind).toBe(harm);
      expect(step.state.guild.heroes).toHaveLength(difficulty === 'ironKing' ? 2 : 3);
      expect(currentShape(step.state, '')).toBeNull();
    });

    it('a Fortaleza que some chama a equipe de volta pela fronteira', () => {
      const state = autumnWithFortress();
      const heroIds = ['hero-1', 'hero-2', 'hero-3'];
      const { state: sentState } = send(state, 'sabotage', heroIds, 'balanced', 0);
      expect(sentState.guild.expeditions).toHaveLength(1);

      // Fortaleza destruída / desaparece no meio da expedição
      sentState.map.tiles.hordeFortress!.threatActive = false;

      // Avança o tempo
      const after = advanceTo(sentState, AUTUMN + 2 * HOUR);

      // Equipe chamada de volta
      expect(after.state.guild.expeditions).toHaveLength(0);
      for (const id of heroIds) {
        const hero = after.state.guild.heroes.find((h) => h.id === id);
        expect(hero?.status).toBe('idle');
      }

      // Crônica emitiu expeditionReturned com template de retorno pela trilha interrompida
      const recalled = after.events.find(
        (e) => e.type === 'expeditionReturned' && e.text.includes('já não levava a parte alguma'),
      );
      expect(recalled).toBeDefined();
    });

    it('três viagens reais reduzem cada onda em 15/30/45% e mantêm a revelação do Xamã válida', () => {
      let state = autumnWithFortress((draft) => {
        for (const hero of draft.guild.heroes) hero.level = 10;
      });
      const expected = [
        [34, 51, 68],
        [28, 42, 56],
        [22, 33, 44],
      ];
      for (let trip = 0; trip < 3; trip += 1) {
        state = send(state, 'sabotage', ['hero-1', 'hero-2', 'hero-3'], 'balanced', 0).state;
        const model = expeditionModels.find((entry) => entry.id === 'sabotage')!;
        for (let step = 0; step < 10 && state.guild.expeditions.length > 0; step += 1) {
          const expedition = state.guild.expeditions[0]!;
          if (expedition.crossroads !== null) {
            const node = model.variants[expedition.variant]!.nodes[expedition.nodeId]!;
            if (node.kind !== 'crossroads') throw new Error('Encruzilhada esperada.');
            state = accept(
              state,
              command('chooseExpeditionPath', {
                expeditionId: expedition.id,
                optionId: node.posture.balanced,
              }),
            ).state;
          } else {
            state = advanceTo(state, expedition.nodeEndsAtMs!).state;
          }
          expect(currentShape(state, '')).toBeNull();
        }
        expect(state.guild.expeditions).toEqual([]);
        expect(state.horde.sabotages.attempts).toBe(trip + 1);
        expect(state.horde.sabotages.successes).toBe(3 * (trip + 1));
        expect(
          state.horde.wavePlan!.waves.map((wave) =>
            wave.composition.reduce((sum, post) => sum + post.count, 0),
          ),
        ).toEqual(expected[trip]);
        const omen = state.horde.omens.find(
          (entry) => entry.wave === 3 && entry.clarity === 'exact',
        );
        expect(omen?.reveals).toEqual(state.horde.wavePlan!.waves[2]!.composition);
      }
      expect(state.guild.reports).toHaveLength(3);
      expect(state.lastProcessedAt).toBe(AUTUMN + 18 * HOUR);
      expect(
        refuse(
          state,
          command('sendExpedition', {
            modelId: 'sabotage',
            heroIds: ['hero-1', 'hero-2', 'hero-3'],
            posture: 'balanced',
          }),
        ).code,
      ).toBe('SABOTAGE_LIMIT');
    });

    it.each([0.5, 1, 3])(
      'dividir o intervalo conserva estado, eventos e RNG na sabotagem, ritmo %s',
      (timeScale) => {
        const state = autumnWithFortress((draft) => {
          draft.settings.timeScale = timeScale;
          for (const hero of draft.guild.heroes) hero.level = 10;
        });
        const sent = send(state, 'sabotage', ['hero-1', 'hero-2', 'hero-3'], 'balanced', 0).state;
        const before = cloneState(sent);
        // A Postura responde no prazo: a mesma chamada cobre as reduções e a revelação final.
        const target = AUTUMN + (6 + 12 * timeScale) * HOUR;
        const once = advanceTo(sent, target);
        let split = sent;
        const events = [];
        const cuts = [
          AUTUMN + HOUR - 1,
          AUTUMN + HOUR,
          AUTUMN + 2 * HOUR,
          AUTUMN + (2 + 12 * timeScale) * HOUR,
          target - 1,
          target,
        ];
        for (const cut of cuts) {
          const result = advanceTo(split, cut);
          split = result.state;
          events.push(...result.events);
        }
        expect(split).toEqual(once.state);
        expect(events).toEqual(once.events);
        expect(split.rng).toEqual(once.state.rng);
        expect(sent).toEqual(before);
        expect(split.guild.expeditions).toEqual([]);
        expect(once.events.filter((event) => event.type === 'hordeSabotaged')).toHaveLength(3);
        expect(once.events.some((event) => event.type === 'omenSeen')).toBe(true);
        expect(currentShape(split, '')).toBeNull();
      },
    );

    it('virada do ano zera os contadores da sabotagem', () => {
      const state = autumnWithFortress((d) => {
        d.horde.sabotages.attempts = 3;
        d.horde.sabotages.successes = 2;
        d.horde.sabotages.alerted = true;
      });

      // Avança até o início do ano seguinte (inverno termina em YEAR)
      const nextYear = advanceTo(state, YEAR);
      expect(nextYear.state.horde.sabotages).toEqual({
        attempts: 0,
        successes: 0,
        alerted: false,
      });
    });
  });

  describe('ViewState da sabotagem', () => {
    it('o destino expõe sabotage com attemptsLeft, wavesWeakened e alerted', () => {
      const state = autumnWithFortress((d) => {
        d.horde.sabotages.attempts = 1;
        d.horde.sabotages.successes = 1;
        d.horde.sabotages.alerted = true;
        d.horde.wavePlan!.waves[0]!.reductionPercent = 15;
      });

      const view = deriveViewState(state, AUTUMN);
      const offer = view.guild.available.find((o) => o.modelId === 'sabotage');
      expect(offer).toBeDefined();
      expect(offer?.sabotage).toEqual({
        attemptsLeft: 2,
        wavesWeakened: [1],
        alerted: true,
      });
      expect(offer?.fit).not.toBeNull();
      expect(offer?.heroFit.length).toBe(3);
    });

    it('o estado respeita o schema da versão 38', () => {
      const state = autumnWithFortress();
      expect(currentShape(state, '')).toBeNull();
    });
  });
});
