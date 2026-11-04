import type { GameEvent, ViewState } from '@lotg/protocol';
import { describe, expect, it } from 'vitest';

import {
  councilView,
  expeditionCrossroadsView,
  gameEvent,
  siegeWaveView,
  unlockedView,
} from '../test-helpers';
import { beforeLeaving } from './beforeLeaving';
import { buildReturnReport, coveredTopics, currentBlocks } from './returnReport';

const HOUR = 3_600_000;
const report: ViewState['army']['reports'][number] = {
  id: 'battle-7',
  mode: 'defense',
  modeLabel: 'Defesa do feudo',
  outcome: 'victory',
  outcomeLabel: 'Vitória',
  ending: 'rout',
  endingText: 'A Horda debandou.',
  roundsCount: 2,
  factors: [
    {
      factor: 'counter',
      owner: 'player',
      wing: 'left',
      wingLabel: 'Ala esquerda',
      round: 1,
      amount: 999,
      percent: null,
      text: 'O encontro favorável rendeu 17 de dano adicional.',
    },
  ],
  noFactorText: 'Nenhum fator sobressaiu nesta batalha.',
  rounds: [],
  casualties: [],
  wall: [],
  commanders: [],
  adjustFormationId: null,
};
const view: ViewState = {
  ...unlockedView,
  army: { ...unlockedView.army, reports: [report] },
};
const blocksOf = (events: GameEvent[], after = view) =>
  buildReturnReport(view, after, events, 4 * HOUR).blocks!;
const fought = (id = report.id) => ({
  ...gameEvent(1, 'battleFought', 'O exército resistiu à Horda.'),
  data: { battleId: id },
});

describe('a guerra nos três blocos do Retorno (V4H-T4.1)', () => {
  it.each([
    'weaponsForged',
    'itemRepaired',
    'soldiersTrained',
    'hordeSabotaged',
    'armyReturned',
    'siegeWon',
    'siegeGlorious',
    'warlordSlain',
    'reconstructionStarted',
  ] as const)('%s conta o que o feudo ganhou na ausência', (type) => {
    const event = gameEvent(1, type, `Notícia recebida: ${type}.`);
    const blocks = blocksOf([event]);
    expect(blocks.prospered).toContainEqual(expect.objectContaining({ text: event.text }));
    expect(blocks.cost).toEqual([]);
  });

  it.each(['trainingShortfall', 'hordeAlerted', 'wallDamaged', 'omenSeen', 'siegeFell'] as const)(
    '%s conta o preço com uma próxima ação',
    (type) => {
      const event = gameEvent(1, type, `Notícia recebida: ${type}.`);
      expect(blocksOf([event]).cost).toContainEqual(
        expect.objectContaining({
          text: event.text,
          action: expect.objectContaining({ command: expect.any(String) }),
        }),
      );
    },
  );

  it('a batalha usa os fatores e a ala da visão com o mesmo identificador', () => {
    const other = {
      ...report,
      id: 'battle-8',
      factors: [{ ...report.factors[0]!, text: 'Outro combate.' }],
    };
    const after = { ...view, army: { ...view.army, reports: [other, report] } };
    const [item] = blocksOf([fought()], after).cost;
    expect(item?.text).toBe(`${fought().text} ${report.factors[0]!.text} (Ala esquerda)`);
    expect(item?.text).not.toContain('Outro combate');
    expect(item?.action).toMatchObject({ command: 'lords.openPanel', arg: 'army' });
  });

  it('sem fator decisivo, repete o texto da visão; sem relatório guardado, preserva só o evento', () => {
    const empty = { ...view, army: { ...view.army, reports: [{ ...report, factors: [] }] } };
    expect(blocksOf([fought()], empty).cost[0]?.text).toBe(
      `${fought().text} ${report.noFactorText}`,
    );
    expect(blocksOf([fought('battle-antiga')]).cost[0]?.text).toBe(fought().text);
    expect(blocksOf([{ ...fought(), data: {} }]).cost[0]?.text).toBe(fought().text);
  });

  it('conta a onda e os fatores em uma linha por batalha, mesmo com os eventos fora de ordem', () => {
    const wave = {
      ...gameEvent(2, 'siegeWaveFought', 'O feudo enfrentou a primeira onda.'),
      data: { battleId: report.id, wave: 1, year: 1 },
    };
    const blocks = blocksOf([wave, fought()]);
    expect(blocks.cost).toHaveLength(1);
    expect(blocks.cost[0]?.text).toBe(
      `${wave.text} ${fought().text} ${report.factors[0]!.text} (Ala esquerda)`,
    );
    expect(blocksOf([wave]).cost[0]?.text).toContain(wave.text);
    const unrelated = { ...wave, data: { ...wave.data, battleId: 'battle-9' } };
    expect(blocksOf([unrelated, fought()]).cost).toHaveLength(2);
  });

  it('a Crônica do Ano usa a pontuação emitida, sem recalcular nem perder o ano fechado', () => {
    const ended = {
      ...gameEvent(3, 'yearEnded', 'Encerra-se o ano 2: 731 pontos e seus Feitos.'),
      data: { year: 2, score: 731, feats: 'firstWinter' },
    };
    const blocks = blocksOf([ended]);
    expect(blocks.prospered).toContainEqual({
      text: ended.text,
      topic: 'chronicle',
      action: { command: 'lords.openPanel', arg: 'chronicle', label: 'Ver a Crônica' },
    });
    expect(
      currentBlocks(buildReturnReport(view, view, [ended], 4 * HOUR), unlockedView).prospered,
    ).toEqual(blocks.prospered);
  });

  it('a decisão entre ondas vem antes da encruzilhada e da carta; o prazo acompanha a visão atual', () => {
    const waiting: ViewState = {
      ...siegeWaveView,
      guild: expeditionCrossroadsView.guild,
      council: councilView.council,
      pendingDecisions: [
        ...siegeWaveView.pendingDecisions,
        ...expeditionCrossroadsView.pendingDecisions,
        ...councilView.pendingDecisions,
      ],
    };
    const report = buildReturnReport(view, waiting, [fought()], 4 * HOUR);
    const blocks = currentBlocks(report, waiting, 60);
    expect(blocks.pending[1]?.topic).toBe('crossroads:expedition-2');
    expect(blocks.pending[2]?.topic).toMatch(/^card:/);
    expect(blocks.pending[0]).toMatchObject({
      topic: 'siegeWave:siege-1-2',
      severity: 'danger',
      action: { command: 'lords.openPanel', arg: 'siege' },
    });
    expect(blocks.pending[0]?.text).toContain('59 min');
    expect(beforeLeaving(waiting, coveredTopics(blocks)).map((item) => item.id)).not.toContain(
      'siegeWave:siege-1-2',
    );
    expect(
      currentBlocks(report, {
        ...waiting,
        pendingDecisions: waiting.pendingDecisions.filter(
          (decision) => decision.kind !== 'siegeWave',
        ),
      }).pending,
    ).not.toContainEqual(expect.objectContaining({ topic: 'siegeWave:siege-1-2' }));
  });
});
