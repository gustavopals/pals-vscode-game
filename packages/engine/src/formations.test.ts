import { balance } from '@lotg/content';
import { describe, expect, it } from 'vitest';

import { advanceTo } from './advance';
import { nextId } from './ids';
import {
  accept,
  addHero,
  barracksYard,
  caravanOrder,
  caravanPost,
  command,
  DAY,
  expeditionAtNode,
  formationPosts,
  formationYard,
  guildHall,
  HOUR,
  MINUTE,
  refuse,
  saveFormationOrder,
  send,
  weakened,
  wear,
} from './test-helpers';
import { deriveViewState } from './view';
import type { GameState } from './types';

const NO_COMMANDERS = { left: null, center: null, right: null };

/** O quartel com dois heróis (Edda e Rolf) no feudo. */
function withHeroes(): GameState {
  return barracksYard(0, (draft) => {
    addHero(draft, { name: 'Edda', gender: 'f' });
    addHero(draft, { name: 'Rolf' });
  });
}

describe('saveFormation', () => {
  it('salva uma formação nova com identificador de nextId e emite a linha da Crônica', () => {
    const { state, events } = accept(barracksYard(), saveFormationOrder('Defesa do portão'));
    expect(state.army.formations).toHaveLength(1);
    const [formation] = state.army.formations;
    expect(formation?.id).toBe('formation-1');
    expect(formation?.name).toBe('Defesa do portão');
    expect(formation?.posts.center.front).toEqual({ unit: 'spearman', count: 5 });
    expect(formation?.posts.right.front).toBeNull();
    expect(state.ids.formation).toBe(1);
    expect(state.army.activeFormationId).toBeNull();
    expect(events.map((event) => event.type)).toEqual(['formationSaved']);
    expect(events[0]?.text).toContain('"Defesa do portão"');
  });

  it('a formação é um plano: não toca nos soldados e pode pedir mais do que há', () => {
    const base = barracksYard();
    const { state } = accept(base, saveFormationOrder());
    expect(state.army.units).toEqual(base.army.units);
    expect(state.army.formations[0]?.posts.center.front?.count).toBe(5);
    expect(state.settlement.population).toEqual(base.settlement.population);
  });

  it('um id salvo substitui a formação no mesmo lugar, sem gastar identificador', () => {
    const start = formationYard(2);
    const { state, events } = accept(
      start,
      saveFormationOrder('Nova linha', {
        id: 'formation-1',
        posts: formationPosts((posts) => {
          posts.right.front = { unit: 'knight', count: 2 };
        }),
      }),
    );
    expect(state.army.formations.map((entry) => entry.id)).toEqual(['formation-1', 'formation-2']);
    expect(state.army.formations[0]?.name).toBe('Nova linha');
    expect(state.army.formations[0]?.posts.right.front).toEqual({ unit: 'knight', count: 2 });
    expect(state.ids.formation).toBe(2);
    expect(events[0]?.data.edited).toBe(1);
  });

  it('apara o nome', () => {
    const { state } = accept(barracksYard(), saveFormationOrder('  Muralha  '));
    expect(state.army.formations[0]?.name).toBe('Muralha');
  });

  it('uma ordem recusada não gasta identificador nem grava nada', () => {
    const start = barracksYard();
    const result = refuse(start, saveFormationOrder(''));
    expect(result.code).toBe('INVALID_FORMATION');
    expect(start.ids.formation).toBeUndefined();
    const { state } = accept(start, saveFormationOrder('Primeira'));
    expect(state.army.formations[0]?.id).toBe('formation-1');
  });

  it('recusa o id que não existe', () => {
    const result = refuse(barracksYard(), saveFormationOrder('X', { id: 'formation-7' }));
    expect(result.code).toBe('FORMATION_NOT_FOUND');
  });

  it('recusa a sexta formação, e editar uma existente com o teto cheio continua valendo', () => {
    const full = formationYard(balance.army.formationsCap);
    const over = refuse(full, saveFormationOrder('Mais uma'));
    expect(over.code).toBe('FORMATIONS_CAP');
    expect(over.message).toContain(`${balance.army.formationsCap}`);
    expect(
      accept(full, saveFormationOrder('Editada', { id: 'formation-3' })).state.army.formations,
    ).toHaveLength(balance.army.formationsCap);
  });

  describe('o conteúdo', () => {
    const bad = (over: Parameters<typeof saveFormationOrder>[1], name = 'Teste') =>
      refuse(barracksYard(), saveFormationOrder(name, over));

    it('recusa nome vazio ou comprido demais, com a frase', () => {
      expect(bad({}, '   ').message).toMatch(/nome da formação/);
      expect(bad({}, 'x'.repeat(balance.army.formationNameMaxLength + 1)).code).toBe(
        'INVALID_FORMATION',
      );
    });

    it('recusa a formação sem os seis postos no formato', () => {
      expect(bad({ posts: { left: {}, center: {}, right: {} } as never }).code).toBe(
        'INVALID_FORMATION',
      );
      expect(bad({ commanders: { left: null } as never }).code).toBe('INVALID_FORMATION');
    });

    it('recusa a formação sem nenhum posto', () => {
      const result = bad({
        posts: {
          left: { front: null, back: null },
          center: { front: null, back: null },
          right: { front: null, back: null },
        },
      });
      expect(result.code).toBe('INVALID_FORMATION');
      expect(result.message).toMatch(/ao menos um posto/);
    });

    it('a linha de cada unidade é fixa: o arqueiro só combate atrás', () => {
      const front = bad({
        posts: formationPosts((posts) => {
          posts.right.front = { unit: 'archer', count: 2 };
        }),
      });
      expect(front.code).toBe('INVALID_FORMATION');
      expect(front.message).toMatch(/Arqueiro/);
      const rear = bad({
        posts: formationPosts((posts) => {
          posts.right.back = { unit: 'spearman', count: 2 };
        }),
      });
      expect(rear.code).toBe('INVALID_FORMATION');
    });

    it('recusa unidade desconhecida e quantidade fora de 1 até o máximo do posto', () => {
      const unit = bad({
        posts: formationPosts((posts) => {
          posts.right.front = { unit: 'dragon' as 'spearman', count: 2 };
        }),
      });
      expect(unit.code).toBe('INVALID_FORMATION');
      for (const count of [0, -1, 1.5, balance.army.postMax + 1]) {
        const result = bad({
          posts: formationPosts((posts) => {
            posts.right.front = { unit: 'spearman', count };
          }),
        });
        expect(result.code).toBe('INVALID_FORMATION');
      }
    });

    it('o posto cabe 20 soldados, e 30 com o Quartel no nível 5', () => {
      const posts = formationPosts((p) => {
        p.right.front = { unit: 'spearman', count: 30 };
      });
      expect(refuse(barracksYard(), saveFormationOrder('Grande', { posts })).code).toBe(
        'INVALID_FORMATION',
      );
      const twenty = formationPosts((p) => {
        p.right.front = { unit: 'spearman', count: 20 };
      });
      expect(
        accept(barracksYard(), saveFormationOrder('Vinte', { posts: twenty })).state.army
          .formations,
      ).toHaveLength(1);
      const level5 = barracksYard(0, () => {}, { level: 5 });
      expect(
        accept(level5, saveFormationOrder('Trinta', { posts })).state.army.formations,
      ).toHaveLength(1);
      expect(view(level5).army.editor.postMax).toBe(30);
      expect(view(barracksYard()).army.editor.postMax).toBe(20);
    });
  });
});

function view(state: GameState) {
  return deriveViewState(state, state.lastProcessedAt, { timeScale: 1 });
}

describe('os comandantes', () => {
  it('nomeia um herói por ala e a visão diz o nome, a ala e a formação', () => {
    const start = withHeroes();
    const { state } = accept(
      start,
      saveFormationOrder('Com chefes', {
        commanders: { left: 'hero-1', center: 'hero-2', right: null },
      }),
    );
    const formation = view(state).army.formations[0];
    expect(formation?.commanders.map((entry) => entry.heroName)).toEqual(['Edda', 'Rolf', null]);
    expect(formation?.commanders[0]?.wingLabel).toBe('Ala esquerda');
    const hero = view(state).guild.heroes.find((entry) => entry.id === 'hero-1');
    expect(hero?.commanding).toEqual({
      formationId: 'formation-1',
      formationName: 'Com chefes',
      wing: 'left',
      wingLabel: 'Ala esquerda',
      isActive: false,
    });
  });

  it('recusa o herói que não existe e o mesmo herói em duas alas', () => {
    const start = withHeroes();
    expect(
      refuse(start, saveFormationOrder('X', { commanders: { ...NO_COMMANDERS, left: 'hero-9' } }))
        .code,
    ).toBe('HERO_NOT_FOUND');
    const twice = refuse(
      start,
      saveFormationOrder('X', { commanders: { left: 'hero-1', center: 'hero-1', right: null } }),
    );
    expect(twice.code).toBe('INVALID_FORMATION');
    expect(twice.message).toMatch(/Edda/);
  });

  it('o mesmo herói pode comandar formações diferentes', () => {
    let state = withHeroes();
    const commanders = { left: 'hero-1', center: null, right: null };
    state = accept(state, saveFormationOrder('A', { commanders })).state;
    state = accept(state, saveFormationOrder('B', { commanders })).state;
    expect(state.army.formations.map((entry) => entry.commanders.left)).toEqual([
      'hero-1',
      'hero-1',
    ]);
  });

  it('o herói em expedição, em escolta, ferido ou capturado não pode ser nomeado', () => {
    for (const status of ['expedition', 'escort', 'injured', 'captured'] as const) {
      const start = barracksYard(0, (draft) => {
        addHero(draft, { name: 'Edda', gender: 'f' }).status = status;
      });
      const result = refuse(
        start,
        saveFormationOrder('X', { commanders: { ...NO_COMMANDERS, left: 'hero-1' } }),
      );
      expect(result.code).toBe('HERO_UNAVAILABLE');
      expect(result.message).toMatch(/^Edda não pode comandar agora/);
    }
  });

  it('quem já comanda aquela ala fica, mesmo ferido', () => {
    let state = withHeroes();
    state = accept(
      state,
      saveFormationOrder('A', { commanders: { left: 'hero-1', center: null, right: null } }),
    ).state;
    const hurt = JSON.parse(JSON.stringify(state)) as GameState;
    hurt.guild.heroes[0]!.status = 'injured';
    const saved = accept(
      hurt,
      saveFormationOrder('A2', {
        id: 'formation-1',
        commanders: { left: 'hero-1', center: null, right: null },
      }),
    );
    expect(saved.state.army.formations[0]?.commanders.left).toBe('hero-1');
  });
});

describe('deleteFormation e setActiveFormation', () => {
  it('apaga uma formação salva e emite a linha', () => {
    const { state, events } = accept(
      formationYard(2),
      command('deleteFormation', { id: 'formation-1' }),
    );
    expect(state.army.formations.map((entry) => entry.id)).toEqual(['formation-2']);
    expect(events.map((event) => event.type)).toEqual(['formationDeleted']);
  });

  it('o identificador de uma apagada não volta', () => {
    const { state } = accept(formationYard(1), command('deleteFormation', { id: 'formation-1' }));
    const again = accept(state, saveFormationOrder('Outra')).state;
    expect(again.army.formations[0]?.id).toBe('formation-2');
  });

  it('recusa apagar a que não existe e a Defesa ativa', () => {
    expect(refuse(formationYard(1), command('deleteFormation', { id: 'formation-4' })).code).toBe(
      'FORMATION_NOT_FOUND',
    );
    const active = refuse(formationYard(2, 0), command('deleteFormation', { id: 'formation-1' }));
    expect(active.code).toBe('FORMATION_ACTIVE');
    expect(
      accept(formationYard(2, 0), command('deleteFormation', { id: 'formation-2' })).state.army
        .formations,
    ).toHaveLength(1);
  });

  it('marca a Defesa ativa, troca, desmarca; marcar a mesma de novo não emite nada', () => {
    let { state, events } = accept(
      formationYard(2),
      command('setActiveFormation', { id: 'formation-2' }),
    );
    expect(state.army.activeFormationId).toBe('formation-2');
    expect(events.map((event) => event.type)).toEqual(['formationActivated']);
    ({ state, events } = accept(state, command('setActiveFormation', { id: 'formation-2' })));
    expect(events).toEqual([]);
    state = accept(state, command('setActiveFormation', { id: 'formation-1' })).state;
    expect(state.army.activeFormationId).toBe('formation-1');
    expect(view(state).army.formations.map((entry) => entry.isActive)).toEqual([true, false]);
    ({ state, events } = accept(state, command('setActiveFormation', { id: null })));
    expect(state.army.activeFormationId).toBeNull();
    expect(events).toEqual([]);
  });

  it('recusa marcar a que não existe', () => {
    expect(
      refuse(formationYard(1), command('setActiveFormation', { id: 'formation-8' })).code,
    ).toBe('FORMATION_NOT_FOUND');
  });

  it('nenhuma das ordens sorteia nem cria instante na linha do tempo', () => {
    const start = formationYard(1);
    const { state } = accept(start, command('setActiveFormation', { id: 'formation-1' }));
    expect(state.rng).toEqual(start.rng);
    expect(JSON.stringify(state.rng)).not.toContain('formation');
  });
});

describe('o que falta na formação', () => {
  it('a visão diz o que falta de cada unidade e muda com os soldados', () => {
    const none = view(formationYard(1)).army.formations[0];
    expect(none?.total).toBe(12);
    expect(none?.shortfall).toEqual([
      { unit: 'spearman', unitLabel: 'Lanceiro', missing: 5 },
      { unit: 'swordsman', unitLabel: 'Espadachim', missing: 4 },
      { unit: 'archer', unitLabel: 'Arqueiro', missing: 3 },
    ]);
    expect(none?.shortfallText).toBe(
      'Faltam 5 lanceiros, 4 espadachins e 3 arqueiros para preencher todos os postos.',
    );
    const stocked = view(
      formationYard(1, null, (draft) => {
        draft.army.units.spearman = 7;
        draft.army.units.swordsman = 2;
      }),
    ).army.formations[0];
    expect(stocked?.shortfall).toEqual([
      { unit: 'swordsman', unitLabel: 'Espadachim', missing: 2 },
      { unit: 'archer', unitLabel: 'Arqueiro', missing: 3 },
    ]);
  });

  it('dispensar soldados deixa postos vazios por falta de unidades, sem apagar a formação', () => {
    const start = formationYard(1, 0, (draft) => {
      draft.army.units.spearman = 5;
      draft.army.units.swordsman = 4;
      draft.army.units.archer = 3;
    });
    expect(view(start).army.formations[0]?.shortfall).toEqual([]);
    expect(view(start).army.formations[0]?.shortfallText).toMatch(/soldados para todos/);
    const { state } = accept(start, command('disbandSoldiers', { unit: 'archer', amount: 2 }));
    expect(state.army.formations[0]?.posts.center.back).toEqual({ unit: 'archer', count: 3 });
    expect(view(state).army.formations[0]?.shortfall).toEqual([
      { unit: 'archer', unitLabel: 'Arqueiro', missing: 2 },
    ]);
  });

  it('o editor traz as unidades com a linha e o que há, e os heróis com o motivo', () => {
    const state = barracksYard(0, (draft) => {
      draft.army.units.archer = 2;
      addHero(draft, { name: 'Edda', gender: 'f' });
      addHero(draft, { name: 'Rolf' }).status = 'expedition';
    });
    const { editor } = view(state).army;
    expect(editor.units.find((entry) => entry.id === 'archer')).toMatchObject({
      line: 'back',
      available: 2,
    });
    expect(editor.heroes.map((entry) => entry.reason)).toEqual([null, 'está fora do feudo']);
    expect(editor.formationsCap).toBe(5);
    expect(editor.canSaveNew).toBe(true);
  });
});

describe('o comandante da Defesa ativa não parte', () => {
  function active(): GameState {
    const named = accept(
      guildHall(0, (draft) => {
        addHero(draft, { name: 'Edda', gender: 'f' });
        addHero(draft, { name: 'Rolf' });
      }),
      saveFormationOrder('Guarda', { commanders: { left: 'hero-1', center: null, right: null } }),
    ).state;
    return accept(named, command('setActiveFormation', { id: 'formation-1' })).state;
  }

  it('sendExpedition recusa com HERO_BUSY e a frase própria, e quem não comanda parte', () => {
    const start = active();
    const refused = refuse(
      start,
      command('sendExpedition', {
        modelId: 'patrol',
        heroIds: ['hero-1'],
        posture: 'balanced',
      }),
    );
    expect(refused.code).toBe('HERO_BUSY');
    expect(refused.message).toMatch(/Edda comanda a Defesa ativa \(Guarda\)/);
    expect(send(start, 'patrol', ['hero-2']).expedition.heroIds).toEqual(['hero-2']);
  });

  it('a visão tira o comandante dos que podem partir', () => {
    const { guild } = view(active());
    expect(guild.heroes.find((entry) => entry.id === 'hero-1')?.canDepart).toBe(false);
    expect(guild.heroes.find((entry) => entry.id === 'hero-2')?.canDepart).toBe(true);
    const patrol = guild.available.find((entry) => entry.modelId === 'patrol');
    expect(patrol?.eligibleHeroIds).toEqual(['hero-2']);
  });

  it('desmarcar a Defesa ativa, ou trocá-la, devolve o herói à expedição', () => {
    const off = accept(active(), command('setActiveFormation', { id: null })).state;
    expect(send(off, 'patrol', ['hero-1']).expedition.heroIds).toEqual(['hero-1']);
  });

  it('nas formações salvas que não são a ativa o herói pode partir, e continua nomeado', () => {
    const start = accept(
      guildHall(0, (draft) => {
        addHero(draft, { name: 'Edda', gender: 'f' });
      }),
      saveFormationOrder('Guarda', { commanders: { left: 'hero-1', center: null, right: null } }),
    ).state;
    const sent = send(start, 'patrol', ['hero-1']).state;
    expect(sent.army.formations[0]?.commanders.left).toBe('hero-1');
  });

  it('o comandante da ativa não escolta caravana', () => {
    const named = accept(
      caravanPost(0, (draft) => {
        addHero(draft, { name: 'Edda', gender: 'f' });
        addHero(draft, { name: 'Rolf' });
      }),
      saveFormationOrder('Guarda', { commanders: { left: 'hero-1', center: null, right: null } }),
    ).state;
    const post = accept(named, command('setActiveFormation', { id: 'formation-1' })).state;
    const refused = refuse(post, caravanOrder('wood', 10, 'hero-1'));
    expect(refused.code).toBe('HERO_BUSY');
    expect(refused.message).toMatch(/Edda comanda a Defesa ativa/);
    expect(view(post).market.caravanOffer?.eligibleEscortIds).toEqual(['hero-2']);
    expect(accept(post, caravanOrder('wood', 10, 'hero-2')).state.market.caravans).toHaveLength(1);
  });
});

describe('quem deixa de ser herói do feudo deixa o comando', () => {
  it('dispensado, sai de todas as formações, inclusive da ativa', () => {
    let state = withHeroes();
    const commanders = { left: 'hero-1', center: 'hero-2', right: null };
    state = accept(state, saveFormationOrder('A', { commanders })).state;
    state = accept(state, saveFormationOrder('B', { commanders })).state;
    state = accept(state, command('setActiveFormation', { id: 'formation-1' })).state;
    state = accept(state, command('dismissHero', { heroId: 'hero-1' })).state;
    expect(state.army.formations.map((entry) => entry.commanders)).toEqual([
      { left: null, center: 'hero-2', right: null },
      { left: null, center: 'hero-2', right: null },
    ]);
    expect(state.army.formations[0]?.posts.center.front).not.toBeNull();
  });

  it('capturado em uma expedição, sai do comando e quem voltou continua nele', () => {
    const start = guildHall(
      50 * DAY + HOUR,
      (draft) => {
        addHero(draft, { name: 'Edda', gender: 'f', level: 2 });
        addHero(draft, { name: 'Rolf', classId: 'archer', level: 2, traits: ['tracker'] });
        draft.map.discovered = ['ruins'];
        const [edda, rolf] = draft.guild.heroes;
        if (edda !== undefined && rolf !== undefined) {
          wear(draft, edda, 'huntingSpear');
          wear(draft, rolf, 'paddedJerkin');
        }
      },
      { seed: 'fixture-hero-captured' },
    );
    const named = accept(
      start,
      saveFormationOrder('Chefes', {
        commanders: { left: 'hero-1', center: 'hero-2', right: null },
      }),
    ).state;
    const sent = send(named, 'ruins', ['hero-1', 'hero-2'], 'balanced', 0).state;
    const crypt = expeditionAtNode(weakened(sent, ['hero-1', 'hero-2']), 'stoneGuardian');
    const after = advanceTo(crypt.state, crypt.endsAt + 50 * MINUTE + 321).state;
    const captive = after.guild.heroes.filter((hero) => hero.status === 'captured');
    expect(captive.length).toBeGreaterThan(0);
    const named_ = after.army.formations[0]!.commanders;
    for (const hero of captive) {
      expect(Object.values(named_)).not.toContain(hero.id);
    }
    for (const hero of after.guild.heroes.filter((entry) => entry.status !== 'captured')) {
      expect(Object.values(named_)).toContain(hero.id);
    }
  });

  it('nextId continua sendo o único dono do contador de formações', () => {
    const state = formationYard(3);
    const draft = JSON.parse(JSON.stringify(state)) as GameState;
    expect(nextId(draft, 'formation')).toBe('formation-4');
  });
});
