import { describe, expect, it } from 'vitest';

import {
  balance,
  buildings,
  chronicleTemplates,
  DIFFICULTY_IDS,
  EXPEDITION_DISASTER_IDS,
  EXPEDITION_MODEL_IDS,
  EXPEDITION_NODE_KINDS,
  EXPEDITION_OUTCOME_IDS,
  type ExpeditionModelDef,
  expeditionModels,
  type ExpeditionNode,
  expeditionOutcomes,
  expeditionPostures,
  expeditionTemplates,
  expeditionTexts,
  type ExpeditionVariant,
  HERO_TRAIT_IDS,
  heroTraits,
  POSTURE_IDS,
  SEASON_IDS,
} from './index';
import {
  BalanceSchema,
  ExpeditionOutcomesSchema,
  ExpeditionPosturesSchema,
  ExpeditionTemplatesSchema,
  ExpeditionTextsSchema,
  expeditionModelsSchema,
} from './schemas';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const rules = balance.expeditions;
const CatalogSchema = expeditionModelsSchema(rules);

/** Uma cópia do catálogo que o teste pode estragar. */
type Loose = Record<string, unknown>;
const copyOf = (): Loose[] => JSON.parse(JSON.stringify(expeditionModels)) as Loose[];
const firstVariant = (model: Loose) => (model.variants as Loose[])[0] as Loose;
const nodesOf = (variant: Loose) => variant.nodes as Record<string, Loose>;
const broken = (edit: (models: Loose[]) => void): boolean => {
  const models = copyOf();
  edit(models);
  return !CatalogSchema.safeParse(models).success;
};

/** Todos os caminhos de um grafo, do nó de partida a um retorno. */
function pathsOf(variant: ExpeditionVariant): ExpeditionNode[][] {
  const paths: ExpeditionNode[][] = [];
  const walk = (key: string, trail: ExpeditionNode[]) => {
    const node = variant.nodes[key];
    if (node === undefined || trail.length > 50) {
      throw new Error(`Grafo quebrado em ${key}.`);
    }
    const path = [...trail, node];
    if (node.kind === 'return') {
      paths.push(path);
    } else if (node.kind === 'crossroads') {
      node.options.forEach((option) => walk(option.next, path));
    } else {
      walk(node.next, path);
    }
  };
  walk(variant.start, []);
  return paths;
}

const everyVariant = (): Array<[string, ExpeditionModelDef, ExpeditionVariant]> =>
  expeditionModels.flatMap((model) =>
    model.variants.map(
      (variant, index) =>
        [`${model.id}/${index}`, model, variant] as [string, ExpeditionModelDef, ExpeditionVariant],
    ),
  );

describe('a Guilda dos Aventureiros (GDD §6.1; ADR 0018, decisão 12)', () => {
  const { storage, difficulties, construction } = balance;

  it('o edifício: nasce no nível 0, pede o Salão no nível 3, custa 300, 100 e 200, leva 20 min e vai ao nível 4', () => {
    const def = buildings.guild;
    expect(def.label).toBe('Guilda dos Aventureiros');
    expect(def.article).toBe('a');
    expect(def.initialLevel).toBe(0);
    expect(def.maxLevel).toBe(4);
    expect(def.requires).toEqual({ townHall: 3 });
    expect(def.baseCost).toEqual({ wood: 300, stone: 100, gold: 200 });
    expect(def.baseDurationMs).toBe(20 * MINUTE);
    expect(def.produces).toBeNull();
    // O teto é o desta versão (o GDD vai ao 5), e a recusa diz isso.
    expect(def.maxLevelNote).toBeDefined();
    // Um nível da Guilda para cada linha de `slotsByGuildLevel`.
    expect(rules.slotsByGuildLevel).toHaveLength(def.maxLevel);
  });

  it('cada nível vendido da Guilda cabe no depósito nas três dificuldades, com o Armazém que o Salão daquele nível deixa erguer', () => {
    const def = buildings.guild;
    const { num, den } = construction.costFactor;
    const warehouse = storage.buildings.warehouse;
    if (warehouse === undefined) {
      throw new Error('Falta o Armazém no conteúdo.');
    }
    expect(construction.costFactorByBuilding.guild).toBeUndefined();
    const costs: Array<Record<string, number>> = [];
    for (let target = 1; target <= def.maxLevel; target += 1) {
      const steps = target - 1;
      // arredondar(base × fator^obras), como o motor.
      const cost = Object.fromEntries(
        Object.entries(def.baseCost).map(([resource, base]) => [
          resource,
          Math.floor((2 * base * num ** steps + den ** steps) / (2 * den ** steps)),
        ]),
      );
      costs.push(cost);
      const townHall = Math.max(
        def.requires.townHall ?? 1,
        target - construction.gateLevelsAboveTownHall,
      );
      expect(townHall, `nível ${target}`).toBeLessThanOrEqual(buildings.townHall.maxLevel);
      const level = Math.min(
        buildings.warehouse.maxLevel,
        townHall + construction.gateLevelsAboveTownHall,
      );
      const stored = warehouse.level1 + warehouse.perLevel * (level - 1);
      for (const id of DIFFICULTY_IDS) {
        const factor = difficulties[id].storageCapacity;
        const cap = Math.floor((stored * factor.num) / factor.den);
        for (const resource of warehouse.resources) {
          expect(cost[resource] ?? 0, `nível ${target}, ${id}, ${resource}`).toBeLessThanOrEqual(
            cap,
          );
        }
      }
    }
    expect(costs).toEqual([
      { wood: 300, stone: 100, gold: 200 },
      { wood: 480, stone: 160, gold: 320 },
      { wood: 768, stone: 256, gold: 512 },
      { wood: 1229, stone: 410, gold: 819 },
    ]);
  });
});

describe('os números das expedições (ADR 0017, decisões 1 e 7; ADR 0018, decisão 11)', () => {
  it('valem os do ADR: 6 h reais de espera, limiares 1,3, 1 e 0,7, sorte de 85 a 115, 1, 2, 2 e 3 expedições, 3 relatórios', () => {
    expect(BalanceSchema.safeParse(balance).error).toBeUndefined();
    expect(rules.crossroadsWaitRealMs).toBe(6 * HOUR);
    expect(rules.outcome).toEqual({
      full: { num: 13, den: 10 },
      success: { num: 1, den: 1 },
      setback: { num: 7, den: 10 },
    });
    expect(rules.luck).toEqual({ min: 85, max: 115, base: 100 });
    expect(rules.slotsByGuildLevel).toEqual([1, 2, 2, 3]);
    expect(rules.reportsKept).toBe(3);
    expect(rules.variantsPerModel).toBe(3);
  });

  it('o Revés traz metade do saque do nó e o Desastre, nada (GDD §9.2)', () => {
    expect(rules.lootShare).toEqual({
      full: { num: 1, den: 1 },
      success: { num: 1, den: 1 },
      setback: { num: 1, den: 2 },
      disaster: { num: 0, den: 1 },
    });
  });

  it('em todo ritmo oferecido a espera da encruzilhada vira um número inteiro de ms de jogo', () => {
    for (const { timeScale } of balance.paces) {
      expect(Number.isInteger(rules.crossroadsWaitRealMs * timeScale), String(timeScale)).toBe(
        true,
      );
    }
  });

  it('só o verão encurta a jornada: 15% mais rápida, fixada no envio (GDD §4.1)', () => {
    const bySeason = Object.fromEntries(
      balance.calendar.seasons.map((season) => [season.id, season.effects.expeditionDuration]),
    );
    expect(SEASON_IDS.map((id) => bySeason[id])).toEqual([
      { num: 1, den: 1 },
      { num: 17, den: 20 },
      { num: 1, den: 1 },
      { num: 1, den: 1 },
    ]);
  });

  it('os limites do grafo: de 2 a 5 nós em um caminho, de 5 a 45 minutos de jogo cada um', () => {
    expect(rules.graph).toEqual({
      minDepth: 2,
      maxDepth: 5,
      maxSteps: 8,
      minNodeMs: 5 * MINUTE,
      maxNodeMs: 45 * MINUTE,
    });
    expect(rules.teamMax).toBe(4);
  });

  it('o schema recusa limiares fora de ordem, sorte sem o neutro, saque que cresce no pior desfecho e Guilda que encolhe', () => {
    const parse = (edit: (draft: Loose) => void) => {
      const draft = JSON.parse(JSON.stringify(balance)) as Loose;
      edit(draft.expeditions as Loose);
      return BalanceSchema.safeParse(draft).success;
    };
    expect(parse(() => undefined)).toBe(true);
    expect(parse((e) => ((e.outcome as Loose).setback = { num: 11, den: 10 }))).toBe(false);
    expect(parse((e) => ((e.luck as Loose).base = 120))).toBe(false);
    expect(parse((e) => ((e.lootShare as Loose).disaster = { num: 1, den: 1 }))).toBe(false);
    expect(parse((e) => ((e.lootShare as Loose).full = { num: 3, den: 2 }))).toBe(false);
    expect(parse((e) => (e.slotsByGuildLevel = [2, 1]))).toBe(false);
    expect(parse((e) => (e.crossroadsWaitRealMs = 0))).toBe(false);
    expect(parse((e) => ((e.graph as Loose).minDepth = 9))).toBe(false);
    expect(parse((e) => (e.summerDuration = { num: 17, den: 20 }))).toBe(false);
  });

  it('o Corajoso rende 10% a mais na Ousada e o Prudente, na Cautelosa; nenhum outro traço mexe no poder', () => {
    expect(heroTraits.brave.effects.expeditionPower).toEqual({
      posture: 'bold',
      ratio: { num: 11, den: 10 },
    });
    expect(heroTraits.prudent.effects.expeditionPower).toEqual({
      posture: 'cautious',
      ratio: { num: 11, den: 10 },
    });
    expect(
      HERO_TRAIT_IDS.filter((id) => heroTraits[id].effects.expeditionPower !== undefined),
    ).toEqual(['brave', 'prudent']);
  });
});

describe('o catálogo de expedições (roadmap da v0.3, V3D-T1.2)', () => {
  it('passa pelo schema, na ordem de EXPEDITION_MODEL_IDS, com três variantes por modelo', () => {
    expect(CatalogSchema.safeParse(expeditionModels).error).toBeUndefined();
    expect(expeditionModels.map((model) => model.id)).toEqual([...EXPEDITION_MODEL_IDS]);
    expect(EXPEDITION_MODEL_IDS).toEqual(['patrol', 'oldForest']);
    for (const model of expeditionModels) {
      expect(model.variants, model.id).toHaveLength(3);
      // Três grafos diferentes de verdade.
      expect(new Set(model.variants.map((variant) => JSON.stringify(variant))).size).toBe(3);
    }
  });

  it.each(everyVariant())(
    '%s: todo caminho chega a um retorno, com 2 a 5 nós de 5 a 45 minutos, e cabe na duração anunciada',
    (_name, model, variant) => {
      const paths = pathsOf(variant);
      expect(paths.length).toBeGreaterThan(0);
      for (const path of paths) {
        expect(path.at(-1)?.kind).toBe('return');
        const timed = path.filter((node) => node.kind !== 'crossroads');
        expect(timed.length).toBeGreaterThanOrEqual(rules.graph.minDepth);
        expect(timed.length).toBeLessThanOrEqual(rules.graph.maxDepth);
        expect(path.length).toBeLessThanOrEqual(rules.graph.maxSteps);
        let total = 0;
        for (const node of timed) {
          const { durationMs } = node;
          expect(durationMs).toBeGreaterThanOrEqual(rules.graph.minNodeMs);
          expect(durationMs).toBeLessThanOrEqual(rules.graph.maxNodeMs);
          total += durationMs;
        }
        expect(total).toBeLessThanOrEqual(model.durationMs);
      }
    },
  );

  it.each(everyVariant())(
    '%s: toda encruzilhada marca as três Posturas em opções que existem, e a da Cautelosa não tem requisito',
    (_name, _model, variant) => {
      for (const node of Object.values(variant.nodes)) {
        if (node.kind !== 'crossroads') {
          continue;
        }
        for (const posture of POSTURE_IDS) {
          const option = node.options.find((entry) => entry.id === node.posture[posture]);
          expect(option, posture).toBeDefined();
        }
        const safe = node.options.find((entry) => entry.id === node.posture.cautious);
        expect(safe?.requires).toBeUndefined();
        // A pista é uma frase, sem números: não entrega a dificuldade.
        for (const option of node.options) {
          expect(option.hint).toMatch(/^\p{Lu}[^0-9{}]*\.$/u);
        }
      }
    },
  );

  it.each(everyVariant())(
    '%s: todo nó com dificuldade marca o Desastre e traz a frase de cada desfecho; os outros trazem a frase deles',
    (_name, _model, variant) => {
      for (const node of Object.values(variant.nodes)) {
        if (node.kind === 'crossroads' || node.kind === 'return') {
          continue;
        }
        if (node.trial === undefined) {
          expect(node.text).toBeDefined();
          continue;
        }
        expect(node.text).toBeUndefined();
        expect(EXPEDITION_DISASTER_IDS).toContain(node.trial.onDisaster);
        expect(Object.keys(node.trial.outcomes)).toEqual([...EXPEDITION_OUTCOME_IDS]);
        expect(Number.isInteger(node.trial.difficulty)).toBe(true);
      }
    },
  );

  it('nenhuma recompensa nem frase é de versão futura: só recursos, e nada de ferro, arma, relíquia, planta, unidade ou presságio', () => {
    const text = JSON.stringify(expeditionModels);
    expect(text).not.toMatch(/ferro|\barma|relíquia|planta\b|unidade|presságio|mestre|mercado/i);
    for (const [, , variant] of everyVariant()) {
      for (const node of Object.values(variant.nodes)) {
        if (node.kind === 'crossroads' || node.kind === 'return' || node.rewards === undefined) {
          continue;
        }
        expect(Object.keys(node.rewards)).toEqual(['resources']);
      }
    }
  });

  it('a Patrulha dos Arredores: 15 minutos, dois nós, um herói, risco baixo, com dificuldade que um herói de nível 1 enfrenta (ADR 0017)', () => {
    const model = expeditionModels.find((entry) => entry.id === 'patrol');
    expect(model).toMatchObject({
      label: 'Patrulha dos Arredores',
      riskLabel: 'Baixo',
      durationMs: 15 * MINUTE,
      requires: { guildLevel: 1, teamMin: 1, teamMax: 1, minHeroLevel: 1, classes: [] },
    });
    for (const variant of model?.variants ?? []) {
      const [path] = pathsOf(variant);
      expect(pathsOf(variant)).toHaveLength(1);
      expect(path?.map((node) => node.kind === 'crossroads')).toEqual([false, false]);
      for (const node of path ?? []) {
        if (node.kind !== 'crossroads' && node.kind !== 'return' && node.trial !== undefined) {
          // Com até 36, um Guerreiro de nível 1 tem ao menos Sucesso em 30 de 31 sortes.
          expect(node.trial.difficulty).toBeLessThanOrEqual(36);
        }
      }
    }
  });

  it('a Floresta Antiga: uma hora, um ou dois heróis, e uma encruzilhada de três opções com uma delas pedindo uma classe', () => {
    const model = expeditionModels.find((entry) => entry.id === 'oldForest');
    expect(model).toMatchObject({
      label: 'Floresta Antiga',
      durationMs: HOUR,
      requires: { guildLevel: 1, teamMin: 1, teamMax: 2 },
    });
    for (const variant of model?.variants ?? []) {
      const crossroads = Object.values(variant.nodes).filter((node) => node.kind === 'crossroads');
      expect(crossroads).toHaveLength(1);
      const [node] = crossroads;
      if (node?.kind !== 'crossroads') {
        throw new Error('Sem encruzilhada.');
      }
      expect(node.options).toHaveLength(3);
      expect(node.options.filter((option) => option.requires !== undefined)).toHaveLength(1);
      expect(pathsOf(variant)).toHaveLength(3);
    }
  });

  it('as duas primeiras variantes da Floresta são iguais até a encruzilhada e diferentes depois: é o que o teste de névoa usa', () => {
    const model = expeditionModels.find((entry) => entry.id === 'oldForest');
    const [a, b] = model?.variants ?? [];
    expect(a?.start).toBe(b?.start);
    expect(a?.nodes.trail).toEqual(b?.nodes.trail);
    expect(a?.nodes.fork).toEqual(b?.nodes.fork);
    expect(a?.nodes.deepWoods).not.toEqual(b?.nodes.deepWoods);
    expect(a?.nodes.glade).not.toEqual(b?.nodes.glade);
  });

  it('os tipos de nó são os oito do GDD §9.2, com a encruzilhada e o retorno', () => {
    expect(EXPEDITION_NODE_KINDS).toEqual([
      'travel',
      'encounter',
      'discovery',
      'crossroads',
      'hazard',
      'camp',
      'boss',
      'return',
    ]);
  });

  it('o schema recusa ciclo, caminho sem retorno, nó solto e nó de partida que não existe', () => {
    expect(broken(() => undefined)).toBe(false);
    // Ciclo: o retorno vira um nó comum que volta ao começo.
    expect(
      broken((models) => {
        const variant = firstVariant(models[0] as Loose);
        nodesOf(variant).home = {
          kind: 'travel',
          title: 'De novo',
          durationMs: 5 * MINUTE,
          text: 'No {dia}º dia {daEstacao}, a patrulha deu outra volta.',
          next: variant.start,
        };
      }),
    ).toBe(true);
    // Caminho sem retorno: o `next` aponta para um nó que não existe.
    expect(
      broken((models) => {
        const variant = firstVariant(models[0] as Loose);
        (nodesOf(variant)[variant.start as string] as Loose).next = 'nowhere';
      }),
    ).toBe(true);
    expect(
      broken((models) => {
        const variant = firstVariant(models[0] as Loose);
        nodesOf(variant).loose = { ...nodesOf(variant).home };
      }),
    ).toBe(true);
    expect(broken((models) => (firstVariant(models[0] as Loose).start = 'nowhere'))).toBe(true);
  });

  it('o schema recusa duração fora da faixa, caminho comprido demais, duas variantes e duração anunciada errada', () => {
    const start = (models: Loose[]) => {
      const variant = firstVariant(models[0] as Loose);
      return nodesOf(variant)[variant.start as string] as Loose;
    };
    expect(broken((models) => (start(models).durationMs = 4 * MINUTE))).toBe(true);
    expect(broken((models) => (start(models).durationMs = 46 * MINUTE))).toBe(true);
    expect(broken((models) => ((models[0] as Loose).durationMs = 16 * MINUTE))).toBe(true);
    expect(broken((models) => ((models[0] as Loose).variants as Loose[]).pop())).toBe(true);
    // Seis nós em fila: mais fundo do que o limite.
    expect(
      broken((models) => {
        const variant = firstVariant(models[0] as Loose);
        const nodes = nodesOf(variant);
        const first = nodes[variant.start as string] as Loose;
        let previous = first;
        for (let index = 0; index < 4; index += 1) {
          const key = `extra${index}`;
          nodes[key] = {
            kind: 'travel',
            title: 'Mais um trecho',
            durationMs: 5 * MINUTE,
            text: 'No {dia}º dia {daEstacao}, a patrulha seguiu adiante.',
            next: 'home',
          };
          previous.next = key;
          previous = nodes[key] as Loose;
        }
        (models[0] as Loose).durationMs = 35 * MINUTE;
      }),
    ).toBe(true);
  });

  it('o schema recusa Postura sem opção, Cautelosa com requisito, prova sem Desastre, nó com frase e prova, e recompensa de versão futura', () => {
    const fork = (models: Loose[]) => nodesOf(firstVariant(models[1] as Loose)).fork as Loose;
    const trial = (models: Loose[]) => {
      const variant = firstVariant(models[0] as Loose);
      return nodesOf(variant)[variant.start as string] as Loose;
    };
    expect(broken((models) => ((fork(models).posture as Loose).bold = 'nowhere'))).toBe(true);
    expect(broken((models) => delete (fork(models).posture as Loose).balanced)).toBe(true);
    expect(broken((models) => ((fork(models).posture as Loose).cautious = 'thicket'))).toBe(true);
    expect(
      broken((models) => (fork(models).options = [(fork(models).options as Loose[])[2]])),
    ).toBe(true);
    expect(broken((models) => delete (trial(models).trial as Loose).onDisaster)).toBe(true);
    expect(
      broken((models) => delete ((trial(models).trial as Loose).outcomes as Loose).setback),
    ).toBe(true);
    expect(
      broken((models) => (trial(models).text = 'No {dia}º dia {daEstacao}, nada aconteceu.')),
    ).toBe(true);
    expect(broken((models) => ((trial(models).rewards as Loose).items = ['ironSword']))).toBe(true);
    expect(
      broken(
        (models) =>
          (((trial(models).rewards as Loose).resources as Loose).iron = { min: 1, max: 2 }),
      ),
    ).toBe(true);
    expect(
      broken(
        (models) =>
          (((trial(models).rewards as Loose).resources as Loose).gold = { min: 9, max: 2 }),
      ),
    ).toBe(true);
    expect(broken((models) => (trial(models).onCapture = 'death'))).toBe(true);
    // Equipe maior que o teto, e Guilda de um nível que não existe.
    expect(broken((models) => (((models[0] as Loose).requires as Loose).teamMax = 5))).toBe(true);
    expect(broken((models) => (((models[0] as Loose).requires as Loose).guildLevel = 5))).toBe(
      true,
    );
    // Uma frase com marcador desconhecido.
    expect(
      broken(
        (models) =>
          (((trial(models).trial as Loose).outcomes as Loose).full =
            'No {dia}º dia {daEstacao}, {heroina} venceu.'),
      ),
    ).toBe(true);
  });
});

describe('as frases das expedições', () => {
  it('as Posturas, os desfechos, as frases da Guilda e as da Crônica passam pelo schema', () => {
    expect(ExpeditionPosturesSchema.safeParse(expeditionPostures).error).toBeUndefined();
    expect(ExpeditionOutcomesSchema.safeParse(expeditionOutcomes).error).toBeUndefined();
    expect(ExpeditionTextsSchema.safeParse(expeditionTexts).error).toBeUndefined();
    expect(ExpeditionTemplatesSchema.safeParse(expeditionTemplates).error).toBeUndefined();
    expect(Object.keys(expeditionPostures)).toEqual([...POSTURE_IDS]);
    expect(expeditionPostures.cautious.label).toBe('Cautelosa');
    expect(expeditionPostures.balanced.label).toBe('Equilibrada');
    expect(expeditionPostures.bold.label).toBe('Ousada');
  });

  it('nenhuma frase da Guilda escreve número de regra: prazos, lugares e dificuldades entram por lacuna', () => {
    for (const [key, text] of Object.entries(expeditionTexts)) {
      expect(text, key).not.toMatch(/\d/);
    }
  });

  it('a Crônica tem a frase de cada passo de uma expedição, com o nome dela', () => {
    for (const type of [
      'expeditionSent',
      'expeditionNodeResolved',
      'expeditionAtCrossroads',
      'expeditionPathChosen',
      'expeditionPostureDecided',
      'expeditionReturned',
    ] as const) {
      expect(chronicleTemplates[type], type).toContain('{expedicao}');
    }
    expect(chronicleTemplates.expeditionSent).toContain('{herois}');
    expect(chronicleTemplates.expeditionPathChosen).toContain('{opcao}');
    // Quem decidiu: o senhor em uma, a Postura na outra.
    expect(chronicleTemplates.expeditionPathChosen).toContain('o senhor');
    expect(chronicleTemplates.expeditionPostureDecided).toContain('{postura}');
    expect(expeditionTemplates.postureFallback).toContain('{postura}');
    expect(chronicleTemplates.expeditionReturned).toContain('{saque}');
    expect(expeditionTemplates.returnedCut).toContain('{perda}');
  });
});
