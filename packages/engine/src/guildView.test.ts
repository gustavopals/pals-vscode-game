import {
  balance,
  buildings,
  expeditionPostures,
  guildTexts,
  wageArrearsTexts,
} from '@lotg/content';
import { describe, expect, it } from 'vitest';

import { advanceTo } from './advance';
import {
  addHero,
  DAY,
  gameAt,
  guildScenario,
  HOUR,
  MINUTE,
  newGame,
  roomy,
  wageArrearsPaid,
  wageArrearsScenario,
} from './test-helpers';
import type { GameState } from './types';
import { deriveViewState } from './view';

const PACES = [3, 1, 0.5] as const;

const guildOf = (state: GameState, timeScale?: number) =>
  deriveViewState(state, state.lastProcessedAt, timeScale === undefined ? {} : { timeScale }).guild;

/** Um feudo calado, com comida sobrando e sem mineiro: o saldo de ouro é só o soldo. */
function court(timeScale: number, edit: (draft: GameState) => void): GameState {
  return gameAt(0, (draft) => {
    draft.settings.timeScale = timeScale;
    roomy(draft);
    draft.settlement.workers.farm = 2;
    draft.settlement.resources.gold = 0;
    edit(draft);
  });
}

describe('a guilda na visão', () => {
  it('sem herói: o limite de um, a lista vazia e nenhum soldo', () => {
    expect(guildOf(newGame())).toEqual({
      text: guildTexts.noHeroes,
      // Sem a Guilda dos Aventureiros: nenhum lugar, nenhum destino, nenhuma expedição.
      building: 'guild',
      built: false,
      level: 0,
      slots: 0,
      postures: [
        { id: 'cautious', ...expeditionPostures.cautious },
        { id: 'balanced', ...expeditionPostures.balanced },
        { id: 'bold', ...expeditionPostures.bold },
      ],
      available: [],
      expeditions: [],
      reports: [],
      dismissText: guildTexts.dismiss,
      heroLimit: 1,
      heroes: [],
      arriving: [],
      inventory: [],
      inventoryCap: 30,
      inventoryText: 'O arsenal está vazio: os itens vêm das expedições.',
      captiveText: null,
      rescueTargetName: null,
      wage: {
        perHour: 0,
        coveredForSeconds: null,
        afterArrivals: null,
        arrears: null,
        lingering: null,
      },
    });
  });

  it('a ficha de cada herói: classe, nível, experiência, traços com a frase, o que faz e o soldo', () => {
    const state = court(1, (draft) => {
      draft.settlement.resources.gold = 100_000;
      addHero(draft, { name: 'Edda', traits: ['loyal'] });
      addHero(draft, { name: 'Isolda', classId: 'mage', level: 2, traits: ['veteran', 'greedy'] });
      addHero(draft, { name: 'Tibério', classId: 'cleric', level: 10 });
    });
    const { heroes, heroLimit } = guildOf(state);
    // O limite barra a contratação, não quem já está: três heróis com o limite em um.
    expect(heroLimit).toBe(1);
    expect(heroes).toEqual([
      {
        id: 'hero-1',
        name: 'Edda',
        classLabel: 'Guerreiro',
        level: 1,
        xp: 0,
        xpToNext: 100,
        traits: [{ label: 'Leal', text: 'Nunca fica descontente nem parte por soldo em atraso.' }],
        statusText: 'No feudo',
        atHome: true,
        canDepart: true,
        injury: null,
        captive: false,
        nextRescued: false,
        canDismiss: true,
        dismissText: guildTexts.dismiss,
        equipment: [
          { slot: 'weapon', slotLabel: 'Arma', item: null },
          { slot: 'armor', slotLabel: 'Armadura', item: null },
          { slot: 'accessory', slotLabel: 'Acessório', item: null },
        ],
        power: 42,
        powerBreakdown: '(14 de ataque + 16 de defesa + 120 de vida ÷ 10) × 1 (Nv1) = 42',
        wagePerHour: 2,
        discontent: false,
      },
      {
        id: 'hero-2',
        name: 'Isolda',
        classLabel: 'Mago',
        level: 2,
        xp: 0,
        xpToNext: 282,
        traits: [
          { label: 'Veterano', text: 'Já chegou ao feudo com um nível a mais.' },
          { label: 'Ganancioso', text: 'Volta com mais saque, e às vezes o perde no caminho.' },
        ],
        statusText: 'No feudo',
        atHome: true,
        canDepart: true,
        injury: null,
        captive: false,
        nextRescued: false,
        canDismiss: true,
        dismissText: guildTexts.dismiss,
        equipment: [
          { slot: 'weapon', slotLabel: 'Arma', item: null },
          { slot: 'armor', slotLabel: 'Armadura', item: null },
          { slot: 'accessory', slotLabel: 'Acessório', item: null },
        ],
        power: 37.8,
        powerBreakdown: '(22 de ataque + 6 de defesa + 70 de vida ÷ 10) × 1,08 (Nv2) = 37,8',
        wagePerHour: 2,
        discontent: false,
      },
      {
        id: 'hero-3',
        name: 'Tibério',
        classLabel: 'Clérigo',
        level: 10,
        xp: 0,
        // No nível máximo não há para onde subir.
        xpToNext: null,
        traits: [],
        statusText: 'No feudo',
        atHome: true,
        canDepart: true,
        injury: null,
        captive: false,
        nextRescued: false,
        canDismiss: true,
        dismissText: guildTexts.dismiss,
        equipment: [
          { slot: 'weapon', slotLabel: 'Arma', item: null },
          { slot: 'armor', slotLabel: 'Armadura', item: null },
          { slot: 'accessory', slotLabel: 'Acessório', item: null },
        ],
        power: 55.04,
        powerBreakdown: '(9 de ataque + 13 de defesa + 100 de vida ÷ 10) × 1,72 (Nv10) = 55,04',
        wagePerHour: 2,
        discontent: false,
      },
    ]);
  });

  it('a tabela de experiência é a do conteúdo, nível a nível', () => {
    for (let level = 1; level <= balance.heroes.maxLevel; level += 1) {
      const state = court(1, (draft) => void addHero(draft, { level }));
      expect(guildOf(state).heroes[0]?.xpToNext).toBe(balance.heroes.xpToNext[level - 1] ?? null);
    }
  });

  it.each(PACES)(
    'ritmo %s: o soldo e o prazo do ouro saem no relógio de quem joga',
    (timeScale) => {
      const state = court(timeScale, (draft) => {
        draft.settlement.resources.gold = 60_000;
        addHero(draft);
        addHero(draft);
        addHero(draft);
      });
      const { wage, heroes } = guildOf(state);
      expect(wage.perHour).toBe(6 * timeScale);
      expect(heroes.map((hero) => hero.wagePerHour)).toEqual(Array(3).fill(2 * timeScale));
      // 60 de ouro a 6 por hora de jogo: 10 h de jogo.
      expect(wage.coveredForSeconds).toBe((10 * 3600) / timeScale);
      expect(wage.arrears).toBeNull();
      // É o mesmo prazo de "acaba em" da linha do ouro.
      const gold = deriveViewState(state, 0).resources.find((row) => row.id === 'gold');
      expect(gold?.depletesInSeconds).toBe(wage.coveredForSeconds);
      // E o motor abre o atraso nesse segundo.
      const at = Math.round((wage.coveredForSeconds ?? 0) * 1000 * timeScale);
      expect(advanceTo(state, at - 1).state.guild.wageArrears).toBeNull();
      expect(advanceTo(state, at).state.guild.wageArrears).not.toBeNull();
    },
  );

  it('com a Mina cobrindo o soldo, o ouro não tem prazo', () => {
    const state = court(1, (draft) => {
      draft.settlement.resources.gold = 5_000;
      draft.settlement.workers.goldMine = 1;
      addHero(draft);
      addHero(draft);
    });
    const { wage } = guildOf(state);
    expect(wage).toEqual({
      perHour: 4,
      coveredForSeconds: null,
      afterArrivals: null,
      arrears: null,
      lingering: null,
    });
  });

  it('ver o mesmo estado em outro ritmo muda só o relógio: os prazos e o soldo por hora', () => {
    const state = guildScenario();
    const fast = guildOf(state);
    const normal = guildOf(state, 1);
    expect(fast.wage.perHour).toBe(18);
    expect(normal.wage.perHour).toBe(6);
    expect(normal.heroes.map((hero) => hero.power)).toEqual(fast.heroes.map((hero) => hero.power));
    expect(fast.wage.coveredForSeconds).not.toBeNull();
    // O mesmo prazo de jogo, em tempo real três vezes mais longo no ritmo 1 (a menos do segundo).
    expect(
      Math.abs((normal.wage.coveredForSeconds ?? 0) - 3 * (fast.wage.coveredForSeconds ?? 0)),
    ).toBeLessThanOrEqual(3);
  });
});

describe('o soldo em atraso na visão', () => {
  it.each(PACES)(
    'ritmo %s: há quanto tempo dura e quanto falta, em tempo real, até a virada que cobra',
    (timeScale) => {
      // Dois heróis e o cofre vazio desde o zero; 1 h 10 de jogo depois.
      const open = advanceTo(
        court(timeScale, (draft) => {
          addHero(draft);
          addHero(draft);
        }),
        HOUR + 10 * MINUTE,
      ).state;
      const { wage, heroes } = guildOf(open);
      expect(wage.coveredForSeconds).toBe(0);
      expect(heroes.map((hero) => hero.discontent)).toEqual([false, false]);
      expect(wage.arrears).toMatchObject({
        secondsElapsed: (70 * 60) / timeScale,
        // As 12 h e as 24 h reais caem em viradas de dia nos três ritmos; falta 1 h 10 de jogo a menos.
        discontentInSeconds: 12 * 3600 - (70 * 60) / timeScale,
        nextDepartureInSeconds: 24 * 3600 - (70 * 60) / timeScale,
      });
      // O que a tela anuncia é o que o motor faz, no segundo dito.
      const sourAt =
        open.lastProcessedAt + (wage.arrears?.discontentInSeconds ?? 0) * 1000 * timeScale;
      expect(advanceTo(open, sourAt - 1).state.guild.heroes.some((hero) => hero.discontent)).toBe(
        false,
      );
      expect(advanceTo(open, sourAt).state.guild.heroes.every((hero) => hero.discontent)).toBe(
        true,
      );
      const goneAt =
        open.lastProcessedAt + (wage.arrears?.nextDepartureInSeconds ?? 0) * 1000 * timeScale;
      expect(advanceTo(open, goneAt - 1).state.guild.heroes).toHaveLength(2);
      expect(advanceTo(open, goneAt).state.guild.heroes).toHaveLength(1);
    },
  );

  it('a frase diz o que é, os prazos em tempo real, que não há dívida e o que fazer; é a mesma em todo ritmo', () => {
    const texts = PACES.map((timeScale) => {
      const open = advanceTo(
        court(timeScale, (draft) => {
          addHero(draft);
          addHero(draft, { traits: ['loyal'] });
        }),
        1,
      ).state;
      return guildOf(open).wage.arrears?.text;
    });
    expect(texts[0]).toBe(
      'Soldo em atraso: o cofre está vazio e 2 heróis não recebem. Com 12 h de atraso, quem não é Leal fica descontente e perde 20% dos atributos; com 24 h, parte um herói a cada 2 h, o que chegou por último. As duas coisas acontecem na virada do dia. O que não foi pago não vira dívida: o atraso fecha quando o ouro voltar a pagar a equipe inteira. Para isso, ponha gente na Mina de Ouro ou dispense um herói.',
    );
    expect(new Set(texts).size).toBe(1);
  });

  it('com a Mina pagando parte do soldo, a frase não diz que ninguém recebe (revisão, M-Q3)', () => {
    const mined = advanceTo(
      court(1, (draft) => {
        draft.settlement.workers.goldMine = 1;
        addHero(draft);
        addHero(draft, { traits: ['loyal'] });
        addHero(draft);
      }),
      1,
    ).state;
    const text = guildOf(mined).wage.arrears?.text ?? '';
    expect(text).toContain(
      'Soldo em atraso: o cofre está vazio, e o que a Mina de Ouro entrega paga só parte do soldo de 3 heróis.',
    );
    expect(text).not.toContain('não recebe');
  });

  it('as frases do atraso moram no conteúdo: o motor só preenche as lacunas', () => {
    const open = advanceTo(
      court(1, (draft) => void addHero(draft)),
      1,
    ).state;
    const text = guildOf(open).wage.arrears?.text ?? '';
    expect(text).not.toMatch(/[{}]/);
    expect(text.startsWith(wageArrearsTexts.unpaidOne.replace('{quantidade}', '1'))).toBe(true);
    expect(text).toContain(wageArrearsTexts.remedy.replaceAll('{mina}', 'a Mina de Ouro'));
  });

  it('o Descontente aparece na ficha, com o poder menor e o termo na conta', () => {
    const state = wageArrearsScenario();
    const { heroes, wage } = guildOf(state);
    expect(heroes.map((hero) => [hero.name, hero.discontent, hero.power])).toEqual([
      ['Edda', false, 42],
      ['Rolf', true, 28.8],
    ]);
    expect(heroes[1]?.powerBreakdown).toBe(
      '(18 de ataque + 9 de defesa + 90 de vida ÷ 10) × 1 (Nv1) × 0,8 (descontente) = 28,8',
    );
    // Aberto às 6 h 40 e parado às 33 h 13: 26 h 33 de atraso. Rolf já está Descontente, e o
    // segundo herói é devido com 26 h: parte na virada das 34 h, em 47 minutos.
    expect(wage).toMatchObject({
      perHour: 4,
      coveredForSeconds: 0,
      arrears: {
        secondsElapsed: 26 * 3600 + 33 * 60 + 2,
        discontentInSeconds: null,
        nextDepartureInSeconds: 46 * 60 + 58,
      },
    });
  });

  it('só com Leais: ninguém fica descontente nem parte, e a frase diz isso', () => {
    const open = advanceTo(
      court(1, (draft) => void addHero(draft, { traits: ['loyal'] })),
      3 * DAY,
    ).state;
    const { arrears } = guildOf(open).wage;
    expect(arrears).toMatchObject({ discontentInSeconds: null, nextDepartureInSeconds: null });
    expect(arrears?.text).toBe(
      'Soldo em atraso: o cofre está vazio e 1 herói não recebe. Ele é Leal: não fica descontente nem parte. O que não foi pago não vira dívida: o atraso fecha quando o ouro voltar a pagar a equipe inteira. Para isso, ponha gente na Mina de Ouro ou dispense um herói.',
    );
    const both = advanceTo(
      court(1, (draft) => {
        addHero(draft, { traits: ['loyal'] });
        addHero(draft, { traits: ['loyal', 'devout'] });
      }),
      3 * DAY,
    ).state;
    expect(guildOf(both).wage.arrears?.text).toContain(
      'São todos Leais: não ficam descontentes nem partem.',
    );
  });

  it('o atraso que reabriu traz na duração o que já tinha durado, e o que fechou some da tela', () => {
    const resumed = wageArrearsPaid(3_000, 46 * MINUTE);
    const elapsed = guildOf(resumed).wage.arrears?.secondsElapsed ?? 0;
    // 26 h 33 de antes e mais um minuto desde que reabriu; os 45 minutos pagos não contam.
    expect(elapsed).toBe(26 * 3600 + 33 * 60 + 2 + 60);
    const ended = wageArrearsPaid(3_000, 18 * MINUTE);
    expect(guildOf(ended).wage).toMatchObject({ perHour: 4, arrears: null });
    expect(guildOf(ended).wage.coveredForSeconds).toBe(27 * 60);
  });

  it.each(PACES)(
    'ritmo %s: com o cofre vazio e um herói a caminho, a visão avisa que o soldo dele abre o atraso na chegada (revisão, A-R1)',
    (timeScale) => {
      const state = court(timeScale, (draft) => {
        draft.guild.arriving.push({ namedHeroId: 'rolf', atMs: HOUR });
      });
      const { wage } = guildOf(state);
      // Hoje não há a quem pagar; quando Rolf chegar, há, e o cofre não cobre um instante.
      expect(wage).toMatchObject({ perHour: 0, coveredForSeconds: null, arrears: null });
      expect(wage.afterArrivals).toEqual({
        perHour: 2 * timeScale,
        coveredForSeconds: 3600 / timeScale,
      });
      // É o que o motor faz, no segundo dito.
      const opensAt = (wage.afterArrivals?.coveredForSeconds ?? 0) * 1000 * timeScale;
      expect(advanceTo(state, opensAt - 1).state.guild.wageArrears).toBeNull();
      expect(advanceTo(state, opensAt).state.guild.wageArrears).not.toBeNull();
    },
  );

  it('com quem chega, o prazo do ouro encurta: a conta soma o soldo de cada um no instante em que ele chega', () => {
    // 20 de ouro e Edda no feudo: 2 por hora de jogo, 10 h. Rolf chega em 4 h: sobram 12 de
    // ouro, a 4 por hora, mais 3 h.
    const state = court(1, (draft) => {
      draft.settlement.resources.gold = 20_000;
      addHero(draft, { name: 'Edda', traits: ['loyal'] });
      draft.guild.arriving.push({ namedHeroId: 'rolf', atMs: 4 * HOUR });
    });
    const { wage } = guildOf(state);
    expect(wage.coveredForSeconds).toBe(10 * 3600);
    expect(wage.afterArrivals).toEqual({ perHour: 4, coveredForSeconds: 7 * 3600 });
    expect(advanceTo(state, 7 * HOUR - 1).state.guild.wageArrears).toBeNull();
    expect(advanceTo(state, 7 * HOUR).state.guild.wageArrears).not.toBeNull();
    // O ouro acaba antes de ele chegar: o prazo é o de hoje.
    const late = court(1, (draft) => {
      draft.settlement.resources.gold = 20_000;
      addHero(draft, { name: 'Edda', traits: ['loyal'] });
      draft.guild.arriving.push({ namedHeroId: 'rolf', atMs: 30 * HOUR });
    });
    expect(guildOf(late).wage.afterArrivals).toEqual({ perHour: 4, coveredForSeconds: 10 * 3600 });
    // A Mina cobre os dois: o ouro não acaba, com ou sem ele.
    const rich = court(1, (draft) => {
      draft.settlement.workers.goldMine = 2;
      addHero(draft, { name: 'Edda', traits: ['loyal'] });
      draft.guild.arriving.push({ namedHeroId: 'rolf', atMs: HOUR });
    });
    expect(guildOf(rich).wage.afterArrivals).toEqual({ perHour: 4, coveredForSeconds: null });
    // Sem ninguém a caminho o campo não existe; com o atraso aberto o prazo é zero.
    expect(guildOf(guildScenario()).wage.afterArrivals).toBeNull();
    const open = advanceTo(
      court(1, (draft) => {
        addHero(draft);
        draft.guild.arriving.push({ namedHeroId: 'rolf', atMs: 30 * HOUR });
      }),
      HOUR,
    ).state;
    expect(guildOf(open).wage.afterArrivals).toEqual({ perHour: 4, coveredForSeconds: 0 });
  });

  it('a frase do alto da aba: como o primeiro herói chega, quem está a caminho e, com equipe, que ainda não há para onde ir', () => {
    expect(guildOf(newGame()).text).toBe(guildTexts.noHeroes);
    const promised = gameAt(0, (draft) => {
      draft.guild.arriving.push({ namedHeroId: 'rolf', atMs: DAY });
    });
    expect(guildOf(promised).text).toBe(guildTexts.awaited);
    // Com equipe e sem a Guilda dos Aventureiros: o que a abre é o Salão no nível do conteúdo.
    expect(guildOf(guildScenario()).text).toBe(
      guildTexts.guildLocked.replace('{nivel}', String(buildings.guild.requires.townHall)),
    );
    const hallReady = gameAt(0, (draft) => {
      addHero(draft);
      draft.settlement.buildings.townHall = 3;
    });
    expect(guildOf(hallReady).text).toBe(guildTexts.guildUnbuilt);
    // Nenhuma promete data nem escreve número de regra: o nível entra pela lacuna.
    expect(guildOf(guildScenario()).dismissText).toBe(guildTexts.dismiss);
    for (const text of Object.values(guildTexts)) {
      expect(text).not.toMatch(/\d|\bdias?\b|\bhoras\b|amanhã|em breve/i);
    }
  });

  it('nada do que é segredo sai: nem contador, nem gerador, nem o que o herói guarda só para o motor', () => {
    const view = deriveViewState(wageArrearsScenario(), wageArrearsScenario().lastProcessedAt);
    expect(Object.keys(view.guild)).toEqual([
      'text',
      'building',
      'built',
      'level',
      'slots',
      'postures',
      'available',
      'expeditions',
      'reports',
      'dismissText',
      'heroLimit',
      'heroes',
      'arriving',
      'inventory',
      'inventoryCap',
      'inventoryText',
      'captiveText',
      'rescueTargetName',
      'wage',
    ]);
    expect(Object.keys(view.guild.wage)).toEqual([
      'perHour',
      'coveredForSeconds',
      'afterArrivals',
      'arrears',
      'lingering',
    ]);
    const text = JSON.stringify(view);
    expect(text).not.toMatch(
      /"(ids|rng|joinedAtMs|classId|gender|namedHeroId|carriedMs|departed|defId|captivity|untilMs)"/,
    );
  });
});
