import {
  balance,
  battleFactorLabels,
  battleNoFactorText,
  battleOutcomeLabels,
  type HeroCaptureRuleId,
  type HordeUnitId,
  type UnitId,
} from '@lotg/content';
import { describe, expect, it } from 'vitest';

import { EVEN_LUCK, resolveBattle, type BattleInput } from './battle';
import { applyBattleOutcome, commanderSeverity } from './battleOutcome';
import { buildBattleReport, type BattleReport } from './battleReport';
import { cloneState } from './state';
import { heroesStart, wear } from './test-helpers';
import type { GameEvent, GameState } from './types';

/** Uma batalha no Centro, com Edda (hero-1, Guerreira) no comando. */
function centerBattle(
  front: [UnitId, number],
  back: [UnitId, number] | null,
  horde: [HordeUnitId, number],
  heroCapture: HeroCaptureRuleId = 'capture',
): BattleInput {
  const none = { front: null, back: null };
  return {
    mode: 'defense',
    player: {
      posts: {
        left: none,
        center: {
          front: { unit: front[0], count: front[1] },
          back: back === null ? null : { unit: back[0], count: back[1] },
        },
        right: none,
      },
      commanders: {
        left: null,
        center: { heroId: 'hero-1', heroClass: 'warrior' },
        right: null,
      },
    },
    horde: {
      posts: {
        left: none,
        center: { front: { unit: horde[0], count: horde[1] }, back: null },
        right: none,
      },
    },
    wall: {},
    watchtowerLevel: 0,
    heroCapture,
  };
}

const reportOf = (input: BattleInput): BattleReport =>
  buildBattleReport('battle-1', 0, resolveBattle(input, EVEN_LUCK));

function apply(state: GameState, report: BattleReport): { state: GameState; events: GameEvent[] } {
  const draft = cloneState(state);
  const events: GameEvent[] = [];
  applyBattleOutcome(draft, report, draft.lastProcessedAt, events);
  return { state: draft, events };
}

const won = reportOf(centerBattle(['spearman', 12], null, ['blackKnight', 6]));
const fell = reportOf(centerBattle(['spearman', 1], ['archer', 2], ['blackKnight', 10]));

describe('o comandante depois da batalha (V4D-T3.2; GDD §10.4 e §8.2)', () => {
  it('a vitória dá a experiência inteira a quem comandou, sem ferimento', () => {
    expect(won.commanders[0]).toMatchObject({ fate: null, xp: balance.battle.commanderXp });
    const start = heroesStart('batalha-xp', 0);
    const { state, events } = apply(start, won);
    const edda = state.guild.heroes[0]!;
    expect(edda.xp).toBe(40);
    expect(edda.injury).toBeNull();
    expect(edda.status).toBe('idle');
    expect(events.map((event) => event.type)).toEqual(['battleFought']);
    // Os outros heróis não comandaram: nada muda.
    expect(state.guild.heroes.slice(1)).toEqual(start.guild.heroes.slice(1));
  });

  it('a experiência sobe de nível com heroLeveledUp', () => {
    const start = heroesStart('batalha-nivel', 0);
    start.guild.heroes[0]!.xp = balance.heroes.xpToNext[0]! - 10;
    const { state, events } = apply(start, won);
    expect(state.guild.heroes[0]).toMatchObject({ level: 2, xp: 30 });
    expect(events.map((event) => event.type)).toEqual(['battleFought', 'heroLeveledUp']);
  });

  it('quem cai fica ferido: grave com metade da ala perdida, e metade da experiência', () => {
    expect(fell.commanders[0]).toMatchObject({ fate: 'wounded', xp: 20 });
    expect(commanderSeverity(fell, 'center')).toBe('severe');
    const start = heroesStart('batalha-ferido', 0);
    const { state, events } = apply(start, fell);
    const edda = state.guild.heroes[0]!;
    expect(edda.status).toBe('injured');
    expect(edda.injury).toEqual({
      severity: 'severe',
      untilMs: start.lastProcessedAt + balance.injuries.durationMs.severe,
    });
    expect(edda.xp).toBe(20);
    expect(events.map((event) => event.type)).toEqual(['battleFought', 'commanderInjured']);
    expect(events[1]?.data).toEqual({ heroId: 'hero-1', battleId: 'battle-1', severity: 'severe' });
    expect(events[1]?.text).toContain('Edda');
  });

  it('a ala que perdeu menos da metade deixa o comandante ferido de leve', () => {
    const light: BattleReport = {
      ...fell,
      casualties: fell.casualties.map((entry) =>
        entry.owner === 'player' ? { ...entry, start: 10, lost: 4 } : entry,
      ),
    };
    expect(commanderSeverity(light, 'center')).toBe('light');
    const start = heroesStart('batalha-leve', 0);
    // Quem já estava ferido de forma grave fica com a gravidade e o prazo maiores.
    start.guild.heroes[0]!.injury = { severity: 'severe', untilMs: start.lastProcessedAt + 1 };
    start.guild.heroes[0]!.status = 'injured';
    const edda = apply(start, light).state.guild.heroes[0]!;
    expect(edda.injury).toEqual({
      severity: 'severe',
      untilMs: start.lastProcessedAt + balance.injuries.durationMs.light,
    });
  });

  it('só em Rei de Ferro o comandante morre: sai das formações e devolve o que levava', () => {
    const died = reportOf(
      centerBattle(['spearman', 1], ['archer', 2], ['blackKnight', 10], 'death'),
    );
    expect(died.commanders[0]).toMatchObject({ fate: 'died', xp: 0 });
    const start = heroesStart('batalha-morte', 0);
    const sword = wear(start, start.guild.heroes[0]!, 'huntingSpear');
    const { state, events } = apply(start, died);
    expect(state.guild.heroes.map((hero) => hero.id)).not.toContain('hero-1');
    expect(state.guild.inventory.map((item) => item.id)).toContain(sword.id);
    expect(events.map((event) => event.type)).toEqual(['battleFought', 'commanderDied']);
    // Fora de Rei de Ferro a resolução nunca diz "morreu".
    for (const rule of ['injury', 'capture'] as const) {
      expect(
        reportOf(centerBattle(['spearman', 1], ['archer', 2], ['blackKnight', 10], rule))
          .commanders[0]?.fate,
      ).toBe('wounded');
    }
  });

  it('o equipamento de quem comandou gasta um ponto por batalha; o que chega a zero tem linha', () => {
    const start = heroesStart('batalha-desgaste', 0);
    const spear = wear(start, start.guild.heroes[0]!, 'huntingSpear');
    const other = wear(start, start.guild.heroes[1]!, 'huntingSpear');
    const once = apply(start, won).state;
    expect(once.guild.heroes[0]!.equipment.weapon?.condition).toBe(
      spear.condition - balance.equipment.wearPerBattle,
    );
    expect(once.guild.heroes[1]!.equipment.weapon?.condition).toBe(other.condition);
    start.guild.heroes[0]!.equipment.weapon!.condition = 1;
    expect(apply(start, won).events.map((event) => event.type)).toEqual([
      'battleFought',
      'itemWorn',
    ]);
  });

  it('o herói que o estado já não tem é saltado; a função não sorteia nem dá identificador', () => {
    const start = heroesStart('batalha-sem-heroi', 0);
    start.guild.heroes = start.guild.heroes.slice(1);
    const { state, events } = apply(start, fell);
    expect(events.map((event) => event.type)).toEqual(['battleFought']);
    expect(state.rng).toEqual(start.rng);
    expect(state.ids).toEqual(start.ids);
  });

  it('battleFought: o desfecho e os três fatores decisivos, como dados e na frase', () => {
    const start = heroesStart('batalha-linha', 0);
    const [line] = apply(start, fell).events;
    expect(line?.type).toBe('battleFought');
    expect(fell.decisive.length).toBeGreaterThan(0);
    expect(line?.data).toMatchObject({
      battleId: 'battle-1',
      outcome: fell.outcome,
      rounds: fell.rounds,
    });
    fell.decisive.forEach((entry, index) => {
      expect(line?.data[`factor${index + 1}`]).toBe(entry.factor);
      expect(line?.data[`factor${index + 1}Owner`]).toBe(entry.owner);
      expect(line?.data[`factor${index + 1}Amount`]).toBe(entry.amount);
      expect(line?.text).toContain(battleFactorLabels[entry.factor][entry.owner]);
    });
    expect(line?.text).toContain(battleOutcomeLabels[fell.outcome]);
    expect(line?.text).not.toMatch(/\{[a-zA-Z]+\}/);
    // Sem fator nenhum, a frase diz a força dos braços.
    const bare = apply(start, { ...won, decisive: [] }).events[0];
    expect(bare?.text).toContain(battleNoFactorText);
    expect(bare?.data).not.toHaveProperty('factor1');
  });
});
