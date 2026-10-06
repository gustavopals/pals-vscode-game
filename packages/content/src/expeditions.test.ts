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
  HERO_CLASS_IDS,
  HERO_TRAIT_IDS,
  heroClasses,
  items,
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

/**
 * Os ids publicados do catálogo (V3D-T3): o estado de uma partida guarda o modelo, a variante
 * (a posição na lista), a chave do nó e a da opção. **Acrescentar é livre; trocar ou tirar um
 * destes pede passo de migração**, como os ids das cartas (`council.test.ts`).
 */
const STABLE_IDS: Record<
  string,
  Array<{ start: string; nodes: string[]; options: Record<string, string[]> }>
> = {
  patrol: [
    {
      start: 'fences',
      nodes: ['fences', 'home'],
      options: {},
    },
    {
      start: 'ford',
      nodes: ['ford', 'home'],
      options: {},
    },
    {
      start: 'oldRoad',
      nodes: ['oldRoad', 'home'],
      options: {},
    },
  ],
  oldForest: [
    {
      start: 'trail',
      nodes: ['trail', 'fork', 'deepWoods', 'glade', 'home'],
      options: { fork: ['thicket', 'stream', 'turnBack'] },
    },
    {
      start: 'trail',
      nodes: ['trail', 'fork', 'deepWoods', 'glade', 'home'],
      options: { fork: ['thicket', 'stream', 'turnBack'] },
    },
    {
      start: 'edge',
      nodes: ['edge', 'hollow', 'nest', 'ravineFloor', 'home'],
      options: { hollow: ['climb', 'ravine', 'leave'] },
    },
  ],
  wolfDen: [
    {
      start: 'climb',
      nodes: ['climb', 'mouth', 'oldWolf', 'smoke', 'home'],
      options: { mouth: ['enterDen', 'smokeOut', 'retreat'] },
    },
    {
      start: 'gorge',
      nodes: ['gorge', 'twoMouths', 'crag', 'narrowDen', 'brushfire', 'home'],
      options: { twoMouths: ['shootFromAbove', 'blockAndEnter', 'burnBrush'] },
    },
    {
      start: 'nightCamp',
      nodes: ['nightCamp', 'cubs', 'sheWolf', 'pack', 'home'],
      options: { cubs: ['killSheWolf', 'driveAway', 'retreat'] },
    },
  ],
  rescue: [
    {
      start: 'captorsTrail',
      nodes: ['captorsTrail', 'campAtHill', 'noonFight', 'nightRopes', 'guardChange', 'home'],
      options: { campAtHill: ['stormAtNoon', 'cutRopesAtNight', 'waitForGuardChange'] },
    },
    {
      start: 'watchedFord',
      nodes: ['watchedFord', 'ruinedTower', 'oakDoor', 'backWall', 'gap', 'home'],
      options: { ruinedTower: ['breakDoor', 'climbBackWall', 'passFileThroughGap'] },
    },
    {
      start: 'firelessNight',
      nodes: ['firelessNight', 'cage', 'duel', 'stampede', 'ditch', 'home'],
      options: { cage: ['challengeChief', 'looseHorses', 'crawlByDitch'] },
    },
  ],
  ruins: [
    {
      start: 'ruinsTrail',
      nodes: ['ruinsTrail', 'stairway', 'corridor', 'gallery', 'stoneGuardian', 'home'],
      options: { stairway: ['inscriptionsCorridor', 'floodedGallery', 'retreat'] },
    },
    {
      start: 'fallenGate',
      nodes: ['fallenGate', 'threeArches', 'bones', 'falseFloor', 'cryptGuardian', 'home'],
      options: { threeArches: ['ossuary', 'falseFloorHall', 'retreat'] },
    },
    {
      start: 'deadRoad',
      nodes: [
        'deadRoad',
        'cisternAndTower',
        'seals',
        'cistern',
        'courtyard',
        'facelessSentinel',
        'home',
      ],
      options: { cisternAndTower: ['readSeals', 'descendCistern', 'gatherCourtyard'] },
    },
  ],
  swamp: [
    {
      start: 'stakeTrail',
      nodes: ['stakeTrail', 'mire', 'lights', 'openWater', 'willows', 'marshWitch', 'home'],
      options: { lights: ['crossOpenWater', 'followWillows', 'retreat'] },
    },
    {
      start: 'rottenRaft',
      nodes: ['rottenRaft', 'fever', 'sunkenVillage', 'dragLair', 'chapel', 'drownedOne', 'home'],
      options: { sunkenVillage: ['followDragMarks', 'diveForBell', 'retreat'] },
    },
    {
      start: 'oldDike',
      nodes: ['oldDike', 'callingFog', 'hangingTree', 'curse', 'canal', 'mudSerpent', 'home'],
      options: { hangingTree: ['liftCurse', 'takeCanal', 'retreat'] },
    },
  ],
};

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

  it('o Sucesso Pleno traz o saque do nó e mais um quarto, o Revés, metade, e o Desastre, nada (GDD §9.2; pendência D-7)', () => {
    expect(rules.lootShare).toEqual({
      full: { num: 5, den: 4 },
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

  it('os limites do grafo: de 2 a 5 nós em um caminho, de 5 a 60 minutos de jogo cada um (pendência D-5)', () => {
    expect(rules.graph).toEqual({
      minDepth: 2,
      maxDepth: 5,
      maxSteps: 8,
      minNodeMs: 5 * MINUTE,
      maxNodeMs: 60 * MINUTE,
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
    expect(parse((e) => ((e.lootShare as Loose).full = { num: 5, den: 2 }))).toBe(false);
    expect(parse((e) => ((e.lootShare as Loose).success = { num: 9, den: 10 }))).toBe(false);
    expect(parse((e) => ((e.lootShare as Loose).full = { num: 9, den: 10 }))).toBe(false);
    expect(parse((e) => ((e.xpShare as Loose).disaster = { num: 2, den: 1 }))).toBe(false);
    expect(parse((e) => ((e.xpShare as Loose).disaster = { num: 0, den: 1 }))).toBe(false);
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
    expect(EXPEDITION_MODEL_IDS).toEqual([
      'patrol',
      'oldForest',
      'wolfDen',
      'rescue',
      'ruins',
      'swamp',
    ]);
    for (const model of expeditionModels) {
      expect(model.variants, model.id).toHaveLength(3);
      // Três grafos diferentes de verdade.
      expect(new Set(model.variants.map((variant) => JSON.stringify(variant))).size).toBe(3);
    }
  });

  it.each(everyVariant())(
    '%s: todo caminho chega a um retorno, com 2 a 5 nós de 5 a 60 minutos, e cabe na duração anunciada',
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
        // O relatório (GDD §9.4): cada desfecho diz quem se destacou, sem palavra que só sirva a
        // um herói ou só a uma heroína logo depois do nome.
        for (const sentence of Object.values(node.trial.outcomes)) {
          expect(sentence).toContain('{heroi}');
          expect(sentence).toMatch(/^No \{dia\}º dia \{daEstacao\}, /);
          expect(sentence).not.toMatch(/\{heroi\},? (sozinh[oa]|ferid[oa]|cansad[oa]|cercad[oa])/);
        }
        // A lição, quando há, diz a classe que o nó favorece, pelo nome que a ficha mostra, e
        // fala de quem faltou ("Um Arqueiro teria…"), nunca de quem estava ("mais firme").
        if (node.trial.lesson !== undefined) {
          expect(node.trial.lesson).toMatch(
            new RegExp(`^Um ${heroClasses[node.trial.helps].label} (teria|não teria) `),
          );
        }
      }
    },
  );

  it.each(everyVariant())(
    '%s: a prova tem lição de classe se, e só se, uma equipe pode chegar a ela sem essa classe (revisão da Fase D, B4 e B18)',
    (_name, model, variant) => {
      // As classes que toda equipe tem ao chegar a cada nó: as que o modelo exige e as que
      // todo caminho até ele exige em uma opção. A lição de classe só sai quando a classe
      // faltava: no nó a que só se chega com ela, a frase nunca apareceria.
      const guaranteed = new Map<string, Set<string>>();
      const visit = (key: string, held: Set<string>): void => {
        const node = variant.nodes[key];
        if (node === undefined) {
          return;
        }
        const before = guaranteed.get(key);
        const now = before === undefined ? held : new Set([...before].filter((id) => held.has(id)));
        guaranteed.set(key, now);
        if (node.kind === 'return') {
          return;
        }
        if (node.kind === 'crossroads') {
          for (const option of node.options) {
            const needs =
              option.requires !== undefined && 'heroClass' in option.requires
                ? [option.requires.heroClass]
                : [];
            visit(option.next, new Set([...held, ...needs]));
          }
          return;
        }
        visit(node.next, held);
      };
      visit(variant.start, new Set(model.requires.classes));
      let trials = 0;
      for (const [key, node] of Object.entries(variant.nodes)) {
        if (node.kind === 'crossroads' || node.kind === 'return' || node.trial === undefined) {
          continue;
        }
        trials += 1;
        const always = guaranteed.get(key)?.has(node.trial.helps) === true;
        expect(node.trial.lesson === undefined, `${key}: lição de ${node.trial.helps}`).toBe(
          always,
        );
      }
      expect(trials).toBeGreaterThan(0);
    },
  );

  describe('o que as frases dos grafos não dizem (revisão editorial da Fase D)', () => {
    /** Todas as frases de um grafo que o jogador lê, com o lugar de cada uma. */
    const phrasesOf = (variant: ExpeditionVariant): Array<[string, string]> =>
      Object.entries(variant.nodes).flatMap(([key, node]): Array<[string, string]> => {
        if (node.kind === 'crossroads') {
          return [
            [`${key}.title`, node.title],
            [`${key}.text`, node.text],
            ...node.options.flatMap((option): Array<[string, string]> => [
              [`${key}.${option.id}.label`, option.label],
              [`${key}.${option.id}.hint`, option.hint],
            ]),
          ];
        }
        if (node.kind === 'return' || node.trial === undefined) {
          return [
            [`${key}.title`, node.title],
            [`${key}.text`, node.text ?? ''],
          ];
        }
        return [
          [`${key}.title`, node.title],
          ...(node.trial.lesson === undefined
            ? []
            : ([[`${key}.lesson`, node.trial.lesson]] as Array<[string, string]>)),
          ...Object.entries(node.trial.outcomes).map(([id, sentence]): [string, string] => [
            `${key}.${id}`,
            sentence,
          ]),
        ];
      });

    it.each(everyVariant())(
      '%s: quem está em cativeiro não tem gênero na frase, ninguém fala a "vocês", e não há capela',
      (_name, _model, variant) => {
        for (const [where, phrase] of phrasesOf(variant)) {
          // Edda também pode ser capturada: "o cativo" não serve (B9).
          expect(phrase, where).not.toMatch(/\bcativ[oa]s?\b|\bprisioneir[oa]s?\b/i);
          // A Crônica fala do feudo, não com o jogador (B22).
          expect(phrase, where).not.toMatch(/\bvocês?\b|\bsua equipe\b/i);
          // A Capela é um edifício da v0.5: não é cenário desta versão (B24).
          expect(phrase, where).not.toMatch(/\bcapelas?\b/i);
        }
      },
    );

    it.each(everyVariant())(
      '%s: "metade" só aparece em frase de Revés, falando do saque, e o Revés rende mesmo a metade',
      (_name, _model, variant) => {
        // As frases escrevem a fração de `balance.expeditions.lootShare.setback`: se o número
        // mudar, este teste aponta cada frase que passou a mentir (B19).
        const { setback } = balance.expeditions.lootShare;
        for (const [where, phrase] of phrasesOf(variant)) {
          if (!/\bmetade\b/i.test(phrase)) {
            continue;
          }
          expect(where, phrase).toMatch(/\.setback$/);
          expect(setback.num * 2, phrase).toBe(setback.den);
        }
      },
    );

    it.each(everyVariant())(
      '%s: o Desastre de um nó a que a equipe já chega com saque não diz que ela ficou sem nada',
      (_name, _model, variant) => {
        // O Desastre zera o saque **do nó**; o que veio dos nós anteriores continua com a equipe,
        // e a volta ainda diz "voltou com N" (B2). Marca os nós alcançáveis depois de um saque.
        const afterLoot = new Set<string>();
        const visit = (key: string, carrying: boolean): void => {
          const node = variant.nodes[key];
          if (node === undefined || node.kind === 'return') {
            return;
          }
          if (node.kind === 'crossroads') {
            for (const option of node.options) {
              visit(option.next, carrying);
            }
            return;
          }
          if (carrying) {
            afterLoot.add(key);
          }
          visit(node.next, carrying || node.rewards?.resources !== undefined);
        };
        visit(variant.start, false);
        const everything =
          /sem nada[.,:;]|sem nada$|largou tudo|de mãos vazias|carga inteira|sem carga nenhuma|até o que (ela )?já trazia|sem uma tora sequer|não levou nada[.,:;]|sem levar nada[.,:;]/;
        for (const key of afterLoot) {
          const node = variant.nodes[key];
          if (
            node === undefined ||
            node.kind === 'crossroads' ||
            node.kind === 'return' ||
            node.trial === undefined
          ) {
            continue;
          }
          expect(node.trial.outcomes.disaster, key).not.toMatch(everything);
        }
      },
    );

    it.each(everyVariant())(
      '%s: a opção que promete "o que têm" ou saque pequeno só existe depois de um trecho que rende algo',
      (_name, _model, variant) => {
        // "Recuar com o que têm" de mãos vazias é promessa falsa (B6).
        const yields = (key: string, seen = new Set<string>()): boolean => {
          // Há algum nó com saque **antes** de `key`, por algum caminho?
          let found = false;
          const walk = (at: string, carrying: boolean): void => {
            if (at === key) {
              found ||= carrying;
              return;
            }
            const node = variant.nodes[at];
            if (node === undefined || node.kind === 'return' || seen.has(`${at}:${carrying}`)) {
              return;
            }
            seen.add(`${at}:${carrying}`);
            if (node.kind === 'crossroads') {
              for (const option of node.options) {
                walk(option.next, carrying);
              }
              return;
            }
            walk(node.next, carrying || node.rewards?.resources !== undefined);
          };
          walk(variant.start, false);
          return found;
        };
        for (const [key, node] of Object.entries(variant.nodes)) {
          if (node.kind !== 'crossroads') {
            continue;
          }
          for (const option of node.options) {
            const promises = /com o que (já )?têm|saque fica pequeno/i.test(
              `${option.label} ${option.hint}`,
            );
            if (promises) {
              expect(yields(key), `${key}.${option.id}`).toBe(true);
            }
          }
        }
      },
    );
  });

  it.each(everyVariant())(
    '%s: a classe que cada prova diz favorecer é a de maior poder contra os pesos do nó',
    (_name, _model, variant) => {
      for (const [key, node] of Object.entries(variant.nodes)) {
        if (node.kind === 'crossroads' || node.kind === 'return' || node.trial === undefined) {
          continue;
        }
        const weights = { ...balance.heroes.power, ...node.trial.weights };
        // Em sexagésimos, para não somar frações: os denominadores do conteúdo dividem 60.
        const power = (classId: (typeof HERO_CLASS_IDS)[number]) =>
          Object.entries(weights).reduce(
            (sum, [attribute, weight]) =>
              sum +
              (heroClasses[classId].attributes[attribute as keyof typeof weights] *
                60 *
                (weight?.num ?? 0)) /
                (weight?.den ?? 1),
            0,
          );
        const best = Math.max(...HERO_CLASS_IDS.map(power));
        expect(power(node.trial.helps), key).toBe(best);
        expect(
          HERO_CLASS_IDS.filter((id) => power(id) === best),
          key,
        ).toHaveLength(1);
      }
    },
  );

  it('nenhuma recompensa nem frase é de versão futura: nada de ferro, arma, relíquia, planta, unidade, presságio ou exército', () => {
    const text = JSON.stringify(expeditionModels);
    // "Armadilha" é do Apêndice C do GDD e não é arma: a palavra inteira é que fica de fora.
    expect(text).not.toMatch(
      /\bferros?\b|\barmas?\b|relíquia|\bplantas?\b|\bunidades?\b|presságio|exército|\bmestres?\b|\bmercado/i,
    );
    for (const [, , variant] of everyVariant()) {
      for (const node of Object.values(variant.nodes)) {
        if (node.kind === 'crossroads' || node.kind === 'return' || node.rewards === undefined) {
          continue;
        }
        // V3D-T2: além dos recursos, um item, um destino revelado, um tile limpo e um cativo solto.
        const known = ['resources', 'item', 'reveals', 'clearsTile', 'rescues'];
        expect(Object.keys(node.rewards).filter((key) => !known.includes(key))).toEqual([]);
      }
    }
  });

  it('a Patrulha dos Arredores: 15 minutos, dois nós, um herói, risco baixo, sem encruzilhada, e revela as Ruínas', () => {
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
      const [stage] = path ?? [];
      if (stage === undefined || stage.kind === 'crossroads' || stage.kind === 'return') {
        throw new Error('A Patrulha começa em uma prova.');
      }
      // A calibragem (o Guerreiro de nível 1 passa em mais de 9 de 10) é conferida no motor,
      // que sabe a conta do poder: `expeditions.calibration.test.ts`.
      expect(stage.trial).toBeDefined();
      expect(stage.rewards?.reveals).toBe('ruins');
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

  it('o catálogo da v0.3: duração, nós, equipe, risco e como cada destino aparece (ADR 0018, decisão 12)', () => {
    const table = expeditionModels.map((model) => {
      const depths = model.variants.flatMap((variant) =>
        pathsOf(variant).map((path) => path.filter((node) => node.kind !== 'crossroads').length),
      );
      return [
        model.label,
        model.durationMs / MINUTE,
        Math.max(...depths),
        `${model.requires.teamMin}-${model.requires.teamMax}`,
        model.requires.minHeroLevel,
        model.requires.classes.join(','),
        model.riskLabel,
        model.requires.guildLevel,
        model.access.kind,
      ];
    });
    // "Nós" conta o que a equipe atravessa no caminho mais longo, com o retorno e sem a
    // encruzilhada. O Resgate tem a chegada, o cativeiro e a volta (pendências D-5 e D-16).
    expect(table).toEqual([
      ['Patrulha dos Arredores', 15, 2, '1-1', 1, '', 'Baixo', 1, 'open'],
      ['Floresta Antiga', 60, 3, '1-2', 1, '', 'Baixo a médio', 1, 'open'],
      ['Covil de Lobos', 120, 3, '2-2', 1, '', 'Médio', 1, 'tile'],
      ['Resgate', 120, 3, '2-2', 1, '', 'Alto', 1, 'captive'],
      ["Ruínas de Vel'Thar", 180, 4, '2-3', 2, '', 'Médio', 1, 'discovered'],
      ['Pântano Nebuloso', 300, 5, '3-3', 1, 'mage', 'Alto', 3, 'discovered'],
    ]);
  });

  it('a descoberta: a Patrulha revela as Ruínas, as Ruínas revelam o Pântano, e nada revela outra coisa', () => {
    const reveals = new Map<string, Set<string>>();
    for (const [, model, variant] of everyVariant()) {
      for (const node of Object.values(variant.nodes)) {
        if (node.kind !== 'crossroads' && node.kind !== 'return' && node.rewards?.reveals) {
          reveals.set(model.id, (reveals.get(model.id) ?? new Set()).add(node.rewards.reveals));
        }
      }
    }
    expect([...reveals].map(([from, to]) => [from, [...to]])).toEqual([
      ['patrol', ['ruins']],
      ['ruins', ['swamp']],
    ]);
    // Toda variante dos dois tem a revelação em todo caminho que chega ao fim da jornada.
    for (const id of ['patrol', 'ruins'] as const) {
      for (const variant of expeditionModels.find((entry) => entry.id === id)?.variants ?? []) {
        expect(
          Object.values(variant.nodes).some(
            (node) => node.kind !== 'crossroads' && node.kind !== 'return' && node.rewards?.reveals,
          ),
        ).toBe(true);
      }
    }
    // Só o Covil limpa o tile, e só o Resgate liberta: em toda variante, por algum caminho.
    for (const [name, model, variant] of everyVariant()) {
      const stages = Object.values(variant.nodes).filter(
        (node) => node.kind !== 'crossroads' && node.kind !== 'return',
      );
      expect(
        stages.some((node) => 'rewards' in node && node.rewards?.clearsTile === 'wolfDen'),
        name,
      ).toBe(model.id === 'wolfDen');
      expect(
        stages.some((node) => 'rewards' in node && node.rewards?.rescues === true),
        name,
      ).toBe(model.id === 'rescue');
    }
  });

  it('as encruzilhadas: uma em cada variante de três nós ou mais, de duas a três opções com verbo no infinitivo, e requisito em parte delas', () => {
    for (const model of expeditionModels) {
      let required = 0;
      for (const variant of model.variants) {
        const crossroads = Object.values(variant.nodes).filter(
          (node) => node.kind === 'crossroads',
        );
        expect(crossroads.length, model.id).toBe(model.id === 'patrol' ? 0 : 1);
        for (const node of crossroads) {
          if (node.kind !== 'crossroads') {
            continue;
          }
          expect(node.options.length).toBeGreaterThanOrEqual(2);
          expect(node.options.length).toBeLessThanOrEqual(3);
          for (const option of node.options) {
            expect(option.label, option.id).toMatch(/^\p{Lu}\p{L}*[aeio]r\b/u);
            required += option.requires === undefined ? 0 : 1;
          }
          // As três Posturas tomam caminhos diferentes: a escolha da Postura no envio importa.
          expect(new Set(Object.values(node.posture)).size).toBe(3);
        }
      }
      if (model.id !== 'patrol') {
        // Parte das opções, nunca todas: em cada modelo há ao menos uma com requisito.
        expect(required, model.id).toBeGreaterThanOrEqual(1);
      }
    }
    // Requisito de classe e de traço: os dois existem no catálogo.
    const requirements = everyVariant().flatMap(([, , variant]) =>
      Object.values(variant.nodes).flatMap((node) =>
        node.kind === 'crossroads' ? node.options.flatMap((option) => option.requires ?? []) : [],
      ),
    );
    expect(requirements.some((entry) => 'heroClass' in entry)).toBe(true);
    expect(requirements.some((entry) => 'trait' in entry)).toBe(true);
  });

  it('os ids de modelo, de nó e de opção são estáveis: uma expedição em curso guarda os três, e mudar um pede passo de migração', () => {
    const published = Object.fromEntries(
      expeditionModels.map((model) => [
        model.id,
        model.variants.map((variant) => ({
          start: variant.start,
          nodes: Object.keys(variant.nodes),
          options: Object.fromEntries(
            Object.entries(variant.nodes).flatMap(([key, node]) =>
              node.kind === 'crossroads' ? [[key, node.options.map((option) => option.id)]] : [],
            ),
          ),
        })),
      ]),
    );
    expect(published).toEqual(STABLE_IDS);
  });

  it('dentro de uma variante nenhum id de opção se repete: a ordem de escolher o caminho só diz a expedição e a opção (revisão da Fase D, M-R7)', () => {
    // `chooseExpeditionPath` identifica a encruzilhada pela expedição: em um grafo com duas
    // encruzilhadas e a mesma chave de opção nas duas, a ordem atrasada de uma aba velha
    // decidiria a segunda. Chaves únicas por variante tornam a ordem atrasada uma recusa.
    for (const model of expeditionModels) {
      for (const [index, variant] of model.variants.entries()) {
        const ids = Object.values(variant.nodes).flatMap((node) =>
          node.kind === 'crossroads' ? node.options.map((option) => option.id) : [],
        );
        expect(
          ids.filter((id, at) => ids.indexOf(id) !== at),
          `${model.id}, variante ${index}`,
        ).toEqual([]);
      }
    }
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
    expect(broken((models) => (start(models).durationMs = 61 * MINUTE))).toBe(true);
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
    // A prova sem a classe que favorece, sem a lição, ou com um desfecho que não diz quem se destacou.
    expect(broken((models) => delete (trial(models).trial as Loose).helps)).toBe(true);
    expect(broken((models) => ((trial(models).trial as Loose).lesson = ''))).toBe(true);
    expect(
      broken(
        (models) =>
          (((trial(models).trial as Loose).outcomes as Loose).success =
            'No {dia}º dia {daEstacao}, a patrulha voltou.'),
      ),
    ).toBe(true);
    // O requisito de uma opção é uma classe ou um traço que existem, nunca os dois.
    const thicket = (models: Loose[]) => (fork(models).options as Loose[])[0] as Loose;
    expect(broken((models) => (thicket(models).requires = { trait: 'tracker' }))).toBe(false);
    expect(broken((models) => (thicket(models).requires = { trait: 'sleepy' }))).toBe(true);
    expect(
      broken((models) => (thicket(models).requires = { heroClass: 'warrior', trait: 'brave' })),
    ).toBe(true);
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

  it('o caminho da Ousada é, em toda encruzilhada, o que mais pode render; e a frase da Postura diz o que acontece quando ele está fora do alcance (revisão da Fase D, B13)', () => {
    // O que um caminho pode render de melhor: o teto de cada recurso de cada nó até o retorno
    // (pelo melhor ramo, se houver outra encruzilhada) e o valor do item mais caro de cada nó.
    const best = (variant: ExpeditionVariant, key: string): number => {
      const node = variant.nodes[key];
      if (node === undefined || node.kind === 'return') {
        return 0;
      }
      if (node.kind === 'crossroads') {
        return Math.max(...node.options.map((option) => best(variant, option.next)));
      }
      const resources = Object.values(node.rewards?.resources ?? {}).reduce(
        (sum, range) => sum + range.max,
        0,
      );
      const item = Math.max(0, ...(node.rewards?.item?.from ?? []).map((id) => items[id].value));
      return resources + item + best(variant, node.next);
    };
    let crossroads = 0;
    for (const [name, , variant] of everyVariant()) {
      for (const node of Object.values(variant.nodes)) {
        if (node.kind !== 'crossroads') {
          continue;
        }
        crossroads += 1;
        const worth = new Map(
          node.options.map((option) => [option.id, best(variant, option.next)]),
        );
        const bold = worth.get(node.posture.bold) ?? -1;
        expect(bold, `${name}: ${node.posture.bold}`).toBe(Math.max(...worth.values()));
        expect(bold, name).toBeGreaterThan(worth.get(node.posture.cautious) ?? Infinity);
      }
    }
    expect(crossroads).toBe(15);
    for (const id of ['balanced', 'bold'] as const) {
      expect(expeditionPostures[id].text).toMatch(/pede o que ela não tem, vale o seguro\.$/);
    }
    expect(expeditionPostures.bold.text).toContain('maior ganho');
  });

  it('a progressão dos itens não pula o incomum: ele cai na Floresta e nas Ruínas, e nenhum raro é certo (revisão da Fase D, B14)', () => {
    /** As quedas de item de um modelo: a raridade de cada item possível e se a queda é certa. */
    const dropsOf = (modelId: string) =>
      expeditionModels
        .filter((model) => model.id === modelId)
        .flatMap((model) => model.variants)
        .flatMap((variant) => Object.values(variant.nodes))
        .flatMap((node) =>
          node.kind === 'crossroads' || node.kind === 'return' || node.rewards?.item === undefined
            ? []
            : [node.rewards.item],
        )
        .flatMap((drop) =>
          drop.from.map((id) => ({
            rarity: items[id].rarity,
            certain: drop.chance.num >= drop.chance.den,
          })),
        );
    const raritiesOf = (modelId: string) => new Set(dropsOf(modelId).map((drop) => drop.rarity));
    expect([...raritiesOf('oldForest')].sort()).toEqual(['common', 'uncommon']);
    expect(raritiesOf('ruins').has('uncommon')).toBe(true);
    expect(raritiesOf('ruins').has('rare')).toBe(true);
    // Nenhum raro cai sempre: quem vence o guardião pode sair sem ele.
    for (const model of expeditionModels) {
      for (const drop of dropsOf(model.id)) {
        if (drop.rarity === 'rare') {
          expect(drop.certain, model.id).toBe(false);
        }
      }
    }
    // E o épico continua só no fundo do Pântano.
    for (const model of expeditionModels) {
      expect(raritiesOf(model.id).has('epic'), model.id).toBe(model.id === 'swamp');
    }
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
