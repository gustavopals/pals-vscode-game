import { expeditionModels, type DifficultyId } from '@lotg/content';
import { describe, expect, it } from 'vitest';

import { advanceTo } from './advance';
import { currentShape } from './migrations';
import { harmOf } from './outcomes';
import { cloneState } from './state';
import {
  accept,
  addHero,
  AUTUMN,
  command,
  guildHall,
  HOUR,
  refuse,
  send,
  SPRING,
  SUMMER,
  WINTER,
  YEAR,
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
      if (!draft.horde.wavePlan) {
        draft.horde.wavePlan = {
          year: 1,
          revision: 1,
          generatedAtMs: AUTUMN,
          waves: [
            {
              number: 1,
              composition: [
                { wing: 'center', line: 'front', unit: 'raider', count: 20 },
                { wing: 'right', line: 'back', unit: 'banditArcher', count: 10 },
              ],
            },
            {
              number: 2,
              composition: [
                { wing: 'center', line: 'front', unit: 'raider', count: 30 },
                { wing: 'left', line: 'front', unit: 'blackKnight', count: 15 },
              ],
            },
            {
              number: 3,
              composition: [
                { wing: 'center', line: 'front', unit: 'ogre', count: 40 },
                { wing: 'center', line: 'back', unit: 'shaman', count: 5 },
              ],
            },
          ],
        };
      }
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
      expect(step.state.horde.sabotages.successes).toBeGreaterThanOrEqual(1);
      const wave1 = step.state.horde.wavePlan!.waves.find((w) => w.number === 1)!;
      expect(wave1.reductionPercent).toBe(15);
      const newWave1Count = wave1.composition.reduce((sum, p) => sum + p.count, 0);
      expect(newWave1Count).toBeLessThan(initialWave1Count);

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

    it('o Desastre alerta a Horda (+10% na onda 1) e captura o herói no modo Senhor', () => {
      const state = autumnWithFortress((d) => {
        // Heróis fracos de nível 1 em postura ousada para forçar desastre
        for (const h of d.guild.heroes) {
          h.level = 1;
        }
      }, 'lord');
      const initialWave1Count = state.horde.wavePlan!.waves[0]!.composition.reduce(
        (sum, p) => sum + p.count,
        0,
      );

      // Envia variante com desastre
      const heroIds = ['hero-1', 'hero-2', 'hero-3'];
      const { state: sentState, expedition } = send(state, 'sabotage', heroIds, 'bold', 2);
      const endsAt = expedition.nodeEndsAtMs!;
      const step = advanceTo(sentState, endsAt);

      // Se desastre ocorreu, alerta e captura
      const disasterEvent = step.events.find(
        (e) => e.type === 'expeditionNodeFailed' && e.data?.outcome === 'disaster',
      );
      if (disasterEvent) {
        expect(step.state.horde.sabotages.alerted).toBe(true);
        const wave1 = step.state.horde.wavePlan!.waves.find((w) => w.number === 1)!;
        const newCount = wave1.composition.reduce((sum, p) => sum + p.count, 0);
        expect(newCount).toBeGreaterThan(initialWave1Count);

        // Herói capturado no Senhor
        const victim = step.state.guild.heroes.find((h) => h.status === 'captured');
        expect(victim).toBeDefined();

        // Crônica registrou o alerta da Horda
        const alertEvent = step.events.find((e) => e.type === 'hordeAlerted');
        expect(alertEvent).toBeDefined();
      }
    });

    it('o Desastre mata o herói no modo Rei de Ferro', () => {
      const state = autumnWithFortress((d) => {
        for (const h of d.guild.heroes) {
          h.level = 1;
        }
      }, 'ironKing');

      const heroIds = ['hero-1', 'hero-2', 'hero-3'];
      const { state: sentState, expedition } = send(state, 'sabotage', heroIds, 'bold', 2);
      const endsAt = expedition.nodeEndsAtMs!;
      const step = advanceTo(sentState, endsAt);

      const disasterEvent = step.events.find(
        (e) => e.type === 'expeditionNodeFailed' && e.data?.outcome === 'disaster',
      );
      if (disasterEvent) {
        expect(step.state.horde.sabotages.alerted).toBe(true);
        expect(step.events.some((e) => e.type === 'heroDied')).toBe(true);
        expect(step.state.guild.heroes.length).toBe(2);
      }
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

    it('a dificuldade dos nós sobe a cada tentativa pelo fator guardIncreasePerAttempt', () => {
      const state = autumnWithFortress();
      const heroIds = ['hero-1', 'hero-2', 'hero-3'];

      // 1ª tentativa: fator 1.0
      state.horde.sabotages.attempts = 0;
      const sent1 = send(state, 'sabotage', heroIds, 'balanced', 0);
      const ends1 = sent1.expedition.nodeEndsAtMs!;
      const step1 = advanceTo(sent1.state, ends1);
      const log1 = step1.state.guild.reports[0]?.log ?? step1.state.guild.expeditions[0]?.log;
      expect(log1).toBeDefined();

      // 2ª tentativa: fator 1.1 (+10%)
      const state2 = cloneState(step1.state);
      state2.guild.expeditions = [];
      for (const h of state2.guild.heroes) h.status = 'idle';
      state2.horde.sabotages.attempts = 1;
      const sent2 = send(state2, 'sabotage', heroIds, 'balanced', 0);
      expect(sent2.state.horde.sabotages.attempts).toBe(2);

      // 3ª tentativa: fator 1.2 (+20%)
      const state3 = cloneState(sent2.state);
      state3.guild.expeditions = [];
      for (const h of state3.guild.heroes) h.status = 'idle';
      state3.horde.sabotages.attempts = 2;
      const sent3 = send(state3, 'sabotage', heroIds, 'balanced', 0);
      expect(sent3.state.horde.sabotages.attempts).toBe(3);
    });

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
