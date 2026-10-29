import { balance } from '@lotg/content';
import { describe, expect, it } from 'vitest';

import { advanceTo, stateAtNextMoraleTurn } from './advance';
import { availableUnits } from './campaign';
import { currentShape } from './migrations';
import { departBlock } from './expeditions';
import { YEAR_MS } from './clock';
import {
  accept,
  addHero,
  apply,
  campaignYard,
  command,
  HOUR,
  giveItem,
  MINUTE,
} from './test-helpers';
import { nextEventAt } from './timeline';
import type { GameState } from './types';
import { deriveViewState } from './view';
import { previewInputFor } from './warCouncilOrders';

const attack = (state: GameState) =>
  accept(state, command('attackCamp', { formationId: 'formation-1' }));
const refuse = (state: GameState, formationId = 'formation-1') => {
  const result = apply(state, command('attackCamp', { formationId }));
  if (result.ok) throw new Error('A ordem devia ser recusada.');
  return result.code;
};
const arrival = balance.army.campaign.travelMs;

function raidAt(state: GameState, atMs: number): void {
  state.horde.scheduledRaids = [
    {
      id: 'raid-campaign',
      kind: 'threat',
      atMs,
      enemy: 'raiders',
      size: 'light',
      announcedAtMs: null,
      composition: [{ wing: 'center', line: 'front', unit: 'raider', count: 6 }],
    },
  ];
}

describe('ataque ao Acampamento (V4F-T2)', () => {
  it('recusa tile ausente, oculto ou limpo, formação ausente e formação sem soldados', () => {
    const absent = campaignYard();
    delete absent.map.tiles.raiderCamp;
    expect(refuse(absent)).toBe('CAMP_NOT_FOUND');
    const hidden = campaignYard();
    hidden.settlement.buildings.watchtower = 0;
    expect(refuse(hidden)).toBe('CAMP_NOT_FOUND');
    const clean = campaignYard();
    clean.map.tiles.raiderCamp!.threatActive = false;
    expect(refuse(clean)).toBe('CAMP_NOT_FOUND');
    expect(refuse(campaignYard(), 'formation-999')).toBe('FORMATION_NOT_FOUND');
    const empty = campaignYard();
    empty.army.units.swordsman = 0;
    empty.army.units.archer = 0;
    expect(refuse(empty)).toBe('NO_SOLDIERS');
  });

  it('pede comandante livre em ala preenchida e recusa um que já está ocupado', () => {
    const missing = campaignYard();
    missing.army.formations[0]!.commanders.center = null;
    expect(refuse(missing)).toBe('HERO_UNAVAILABLE');
    const injured = campaignYard();
    injured.guild.heroes[0]!.status = 'injured';
    injured.guild.heroes[0]!.injury = { severity: 'light', untilMs: HOUR };
    expect(refuse(injured)).toBe('HERO_UNAVAILABLE');
  });

  it('explica o ferimento do comandante na recusa e na oferta de ataque', () => {
    const state = campaignYard();
    const hero = state.guild.heroes[0]!;
    hero.status = 'injured';
    hero.injury = { severity: 'light', untilMs: HOUR };
    const before = JSON.stringify(state);
    const result = apply(state, command('attackCamp', { formationId: 'formation-1' }));
    expect(result).toMatchObject({
      ok: false,
      code: 'HERO_UNAVAILABLE',
      message: `${hero.name} não pode partir agora: ainda se recupera de um ferimento.`,
    });
    if (result.ok) throw new Error('O comandante ferido não pode marchar.');
    expect(deriveViewState(state, state.lastProcessedAt).army.campAssault).toMatchObject({
      blockedReason: result.message,
      formations: [{ formationId: 'formation-1', canAttack: false, blockedReason: result.message }],
    });
    expect(JSON.stringify(state)).toBe(before);
  });

  it('reserva só os postos disponíveis, leva os comandantes e não sorteia na ordem', () => {
    const start = campaignYard();
    start.army.units.swordsman = 20;
    const original = JSON.stringify(start);
    const { state, events } = attack(start);
    expect(JSON.stringify(start)).toBe(original);
    expect(state.rng).toEqual(start.rng);
    expect(state.ids).toEqual(start.ids);
    expect(events.map((event) => event.type)).toEqual(['armyMarched']);
    expect(state.army.campaign?.formation.posts.right.front).toBeNull();
    expect(state.army.campaign?.formation.posts.center.front?.count).toBe(5);
    expect(state.guild.heroes[0]?.status).toBe('campaign');
    expect(departBlock(state, state.guild.heroes[0]!)).toMatchObject({ code: 'HERO_BUSY' });
    expect(availableUnits(state).swordsman).toBe(0);
    expect(availableUnits(state).archer).toBe(0);
    expect(refuse(state)).toBe('ARMY_AWAY');
    expect(
      apply(state, command('disbandSoldiers', { unit: 'swordsman', amount: 1 })),
    ).toMatchObject({ ok: false, code: 'NOT_ENOUGH_SOLDIERS' });
    expect(apply(state, command('dismissHero', { heroId: 'hero-1' }))).toMatchObject({
      ok: false,
      code: 'HERO_BUSY',
    });
    expect(currentShape(state, '')).toBeNull();
    expect(nextEventAt(state)).toBeLessThanOrEqual(arrival);
  });

  it('luta na chegada, limpa uma vez, traz saque e desconta as baixas só ao voltar', () => {
    const start = campaignYard();
    const { state } = attack(start);
    const before = advanceTo(state, arrival - 1);
    expect(before.state.army.reports).toHaveLength(0);
    const at = advanceTo(before.state, arrival);
    const report = at.state.army.campaign!.report!;
    expect(report.mode).toBe('attack');
    expect(report.outcome).toBe('victory');
    expect(report.wall).toHaveLength(3);
    expect(report.formationId).toBe('formation-1');
    expect(at.state.map.tiles.raiderCamp?.threatActive).toBe(false);
    expect(at.state.map.threat).toBe(state.map.threat - balance.threat.tileClearedDrop);
    expect(at.events.filter((event) => event.type === 'threatTileCleared')).toHaveLength(1);
    expect(at.state.army.units).toEqual(start.army.units);
    expect(Object.keys(at.state.rng).some((stream) => stream.startsWith('battle:'))).toBe(false);
    expect(currentShape(at.state, '')).toBeNull();
    const almost = advanceTo(at.state, arrival * 2 - 1);
    expect(almost.state.army.campaign).not.toBeNull();
    const back = advanceTo(almost.state, arrival * 2);
    expect(back.state.army.campaign).toBeNull();
    for (const unit of ['swordsman', 'archer'] as const) {
      const lost = report.casualties
        .filter((post) => post.owner === 'player' && post.unit === unit)
        .reduce((sum, post) => sum + post.lost, 0);
      expect(back.state.army.units[unit]).toBe(start.army.units[unit] - lost);
    }
    const returned = back.events.find((event) => event.type === 'armyReturned');
    expect(returned?.data.gained_gold).toBe(balance.army.campaign.loot.gold);
    // O pátio já tem o depósito cheio: o saque continua contabilizado como desperdício.
    expect(Number(returned?.data.gained_wood ?? 0) + Number(returned?.data.lost_wood ?? 0)).toBe(
      balance.army.campaign.loot.wood,
    );
    expect(back.state.guild.heroes[0]?.status).toBe('idle');
    expect(currentShape(back.state, '')).toBeNull();
    expect(refuse(back.state)).toBe('CAMP_NOT_FOUND');
    expect(advanceTo(back.state, arrival * 2).events).toHaveLength(0);
  });

  it('uma derrota conserva o Acampamento e volta sem saque', () => {
    const { state } = attack(campaignYard(0, false));
    const back = advanceTo(state, arrival * 2);
    expect(back.state.army.reports[0]?.outcome).toBe('defeat');
    expect(back.state.map.tiles.raiderCamp?.threatActive).toBe(true);
    expect(back.state.army.units.swordsman).toBe(0);
    expect(back.state.army.campaign).toBeNull();
    expect(
      back.events.find((event) => event.type === 'armyReturned')?.data.gained_gold,
    ).toBeUndefined();
    expect(currentShape(back.state, '')).toBeNull();
  });

  it('atribui a limpeza do Acampamento ao exército na Crônica', () => {
    const at = advanceTo(attack(campaignYard()).state, arrival);
    const cleared = at.events.filter((event) => event.type === 'threatTileCleared');
    expect(cleared).toHaveLength(1);
    expect(cleared[0]).toMatchObject({
      text: 'No 1º dia da Primavera, o exército de Pedra Alta limpou o Acampamento de Saqueadores. Dali já não sai quem ronde o feudo, até a virada do ano.',
      data: { tileId: 'raiderCamp', battleId: at.state.army.campaign!.report!.id },
    });
    expect(cleared[0]!.data).not.toHaveProperty('expeditionId');
  });

  it('a morte do comandante em Rei de Ferro não deixa herói nem reserva órfã', () => {
    const start = campaignYard(0, false);
    start.settings.difficulty = 'ironKing';
    // A retaguarda continua de pé depois da Frente cair: o golpe seguinte expõe o comandante.
    start.army.units.archer = 5;
    start.army.formations[0]!.posts.center.back = { unit: 'archer', count: 5 };
    const { state } = attack(start);
    const at = advanceTo(state, arrival);
    expect(at.state.army.campaign?.report?.commanders[0]?.fate).toBe('died');
    expect(at.state.guild.heroes).toHaveLength(0);
    expect(currentShape(at.state, '')).toBeNull();
    const back = advanceTo(at.state, arrival * 2);
    expect(back.state.army.campaign).toBeNull();
    expect(currentShape(back.state, '')).toBeNull();
  });

  it('o limite de 12 rodadas faz o exército recuar sem limpar o Acampamento nem trazer saque', () => {
    const start = campaignYard(0, false);
    start.army.units.swordsman = 0;
    start.army.units.shieldbearer = 10;
    start.army.formations[0]!.posts.center.front = { unit: 'shieldbearer', count: 10 };
    const { state } = attack(start);
    const back = advanceTo(state, arrival * 2);
    const report = back.state.army.reports[0]!;
    expect(report.outcome).toBe('withdrew');
    expect(report.rounds).toBe(balance.battle.maxRounds);
    expect(back.state.map.tiles.raiderCamp?.threatActive).toBe(true);
    expect(back.state.army.campaign).toBeNull();
    expect(back.events.some((event) => event.type === 'threatTileCleared')).toBe(false);
    expect(
      back.events.find((event) => event.type === 'armyReturned')?.data.gained_gold,
    ).toBeUndefined();
    expect(currentShape(back.state, '')).toBeNull();
  });

  it('a incursão no meio e no instante da volta luta sem quem partiu; a prévia usa a mesma reserva', () => {
    for (const raidAtMs of [HOUR, arrival * 2]) {
      const { state } = attack(campaignYard());
      raidAt(state, raidAtMs);
      const preview = previewInputFor(state, state.army.formations[0]!);
      expect(
        Object.values(preview.player.posts).every(
          (post) => post.front === null && post.back === null,
        ),
      ).toBe(true);
      const back = advanceTo(state, arrival * 2);
      const defense = back.state.army.reports.find((report) => report.mode === 'defense')!;
      expect(defense.casualties.filter((post) => post.owner === 'player')).toHaveLength(0);
      expect(defense.commanders).toHaveLength(0);
      expect(back.events.findIndex((event) => event.type === 'raidSuffered')).toBeLessThan(
        back.events.findIndex((event) => event.type === 'armyReturned'),
      );
      expect(currentShape(back.state, '')).toBeNull();
    }
  });

  it('reserva a fotografia mesmo se o plano salvo é editado ou apagado', () => {
    const { state } = attack(campaignYard());
    const snapshot = JSON.stringify(state.army.campaign?.formation);
    state.army.formations[0]!.posts.center.front = { unit: 'swordsman', count: 1 };
    const inactive = accept(state, command('setActiveFormation', { id: null })).state;
    const deleted = accept(inactive, command('deleteFormation', { id: 'formation-1' })).state;
    expect(JSON.stringify(deleted.army.campaign?.formation)).toBe(snapshot);
    expect(currentShape(deleted, '')).toBeNull();
    expect(advanceTo(deleted, arrival * 2).state.army.reports[0]?.outcome).toBe('victory');
  });

  it('o Acampamento limpo volta na virada do ano e volta a somar ameaça', () => {
    const state = campaignYard(YEAR_MS - arrival * 2 - MINUTE);
    state.map.tiles.wolfDen!.threatActive = false;
    const back = advanceTo(attack(state).state, YEAR_MS - MINUTE);
    expect(back.state.map.tiles.raiderCamp?.threatActive).toBe(false);
    const spring = advanceTo(back.state, YEAR_MS);
    expect(spring.state.map.tiles.raiderCamp?.threatActive).toBe(true);
    expect(
      spring.events.filter(
        (event) => event.type === 'threatTileRestored' && event.data.tileId === 'raiderCamp',
      ),
    ).toHaveLength(1);
    expect(spring.state.map.threat).toBeGreaterThan(back.state.map.threat);
    expect(currentShape(spring.state, '')).toBeNull();
  });

  it('a visão mostra a fase, os prazos reais, o relatório e os avisos sem sortear', () => {
    const { state } = attack(campaignYard());
    const before = JSON.stringify(state);
    const view = deriveViewState(state, state.lastProcessedAt, { timeScale: 3 });
    expect(view.army.campaign).toMatchObject({
      phase: 'marching',
      battleInSeconds: arrival / 3000,
      returnsInSeconds: (arrival * 2) / 3000,
    });
    expect(view.army.editor.warning).toContain('campanha');
    expect(view.army.editor.units.find((unit) => unit.id === 'swordsman')?.available).toBe(0);
    expect(view.guild.heroes[0]).toMatchObject({
      atHome: false,
      canDepart: false,
      canDismiss: false,
    });
    expect(JSON.stringify(state)).toBe(before);
    const at = advanceTo(state, arrival).state;
    expect(deriveViewState(at, arrival).army.campaign).toMatchObject({
      phase: 'returning',
      battleInSeconds: 0,
      reportId: at.army.reports[0]?.id,
    });
    const threat = deriveViewState(at, arrival).threat;
    expect(threat.known).toBe(true);
    if (threat.known)
      expect(threat.tiles.find((tile) => tile.id === 'raiderCamp')).toMatchObject({
        active: false,
      });
  });

  it('a previsão da moral não resolve a campanha nem antecipa sorte, experiência ou baixas', () => {
    const { state } = attack(campaignYard());
    const ahead = stateAtNextMoraleTurn(state);
    expect(ahead.rng).toEqual(state.rng);
    expect(ahead.ids).toEqual(state.ids);
    expect(ahead.army.reports).toEqual(state.army.reports);
    expect(ahead.army.units).toEqual(state.army.units);
    expect(ahead.guild.heroes[0]?.xp).toBe(state.guild.heroes[0]?.xp);
    expect(ahead.guild.heroes[0]?.status).toBe('campaign');
  });

  it('os soldados e o comandante que ficaram em casa ainda defendem; as duas baixas não se misturam', () => {
    const start = campaignYard();
    start.army.units.swordsman += 5;
    addHero(start, { name: 'Rolf', classId: 'archer', traits: ['loyal'] });
    const { state } = attack(start);
    // Uma edição do plano em casa não muda a fotografia que partiu.
    state.army.formations[0]!.commanders.left = 'hero-2';
    raidAt(state, HOUR);
    const middle = advanceTo(state, HOUR);
    const defense = middle.state.army.reports[0]!;
    const homePosts = defense.casualties.filter((post) => post.owner === 'player');
    expect(homePosts.reduce((sum, post) => sum + post.start, 0)).toBe(5);
    expect(defense.commanders.map((hero) => hero.heroId)).toEqual(['hero-2']);
    const homeLost = homePosts
      .filter((post) => post.unit === 'swordsman')
      .reduce((sum, post) => sum + post.lost, 0);
    expect(middle.state.army.units.swordsman).toBe(50 - homeLost);
    expect(availableUnits(middle.state).swordsman).toBe(5 - homeLost);
    const back = advanceTo(middle.state, arrival * 2);
    const assault = back.state.army.reports.find((report) => report.mode === 'attack')!;
    const awayLost = assault.casualties
      .filter((post) => post.owner === 'player' && post.unit === 'swordsman')
      .reduce((sum, post) => sum + post.lost, 0);
    expect(back.state.army.units.swordsman).toBe(50 - homeLost - awayLost);
    expect(currentShape(back.state, '')).toBeNull();
  });

  it('o comandante com soldo vencido é cobrado depois da linha do retorno', () => {
    const start = campaignYard(balance.heroes.arrears.leaveAfterRealMs - HOUR, false);
    const hero = start.guild.heroes[0]!;
    hero.traits = [];
    hero.joinedAtMs = 0;
    start.settlement.resources.gold = 0;
    start.guild.wageArrears = {
      sinceMs: 0,
      carriedMs: 0,
      departed: 0,
    };
    const { state } = attack(start);
    const middle = advanceTo(state, state.army.campaign!.battleAtMs);
    expect(middle.state.guild.heroes[0]?.status).toBe('campaign');
    expect(currentShape(middle.state, '')).toBeNull();
    const back = advanceTo(middle.state, state.army.campaign!.returnsAtMs);
    expect(back.state.guild.heroes).toHaveLength(0);
    const kinds = back.events.map((event) => event.type);
    expect(kinds.indexOf('heroLeft')).toBeGreaterThan(kinds.indexOf('armyReturned'));
    expect(currentShape(back.state, '')).toBeNull();
  });

  it('um comandante em campanha não equipa item nem sai para expedição', () => {
    const start = campaignYard();
    start.settlement.buildings.guild = 1;
    const item = giveItem(start, 'huntingSpear');
    const { state } = attack(start);
    expect(apply(state, command('equipItem', { heroId: 'hero-1', itemId: item.id }))).toMatchObject(
      { ok: false, code: 'HERO_BUSY' },
    );
    expect(
      apply(
        state,
        command('sendExpedition', { modelId: 'patrol', heroIds: ['hero-1'], posture: 'balanced' }),
      ),
    ).toMatchObject({ ok: false, code: 'HERO_BUSY' });
  });
});
