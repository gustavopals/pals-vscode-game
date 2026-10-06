import { fileURLToPath } from 'node:url';

import { build } from 'vite';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

// Só este teste lê o conteúdo, e por caminho relativo: o app não depende de `@lotg/content`.
import * as content from '../../content/src/index';

/**
 * O app só exibe: números e textos de jogo chegam pelo `ViewState` e por `GET /catalog`, nunca
 * dentro do JavaScript servido (ADR 0013, decisão 2a; roadmap da v0.2, §0.7, "Visão e
 * privacidade narrativa"). Do conteúdo, o pacote só pode levar as listas de identificadores que
 * os schemas do protocolo usam. O que garante isso é o descarte de código sem uso do build: um
 * uso de `balance` em tempo de execução dentro de `@lotg/protocol` basta para a tabela inteira
 * ir ao navegador, sem lint nem tipo acusarem. Por isso este teste compila o app de verdade.
 */
const ALLOWED_CONTENT_EXPORTS: readonly string[] = [
  'BUILDING_IDS',
  'DIFFICULTY_IDS',
  'ENEMY_IDS',
  'EVENT_TYPES',
  // Os espaços de equipamento (V3D-T2): o schema da visão os usa, como usa os recursos.
  'ITEM_SLOT_IDS',
  'MORALE_BAND_IDS',
  'MORALE_TERM_IDS',
  'PRODUCTION_BUILDING_IDS',
  'RESOURCE_IDS',
  'SEASON_IDS',
];

type BundledModule = { id: string; exports: readonly string[] };

let code = '';
let contentModules: BundledModule[] = [];

beforeAll(async () => {
  // O Vitest roda com NODE_ENV=test; o pacote que vai ao ar é o de produção.
  vi.stubEnv('NODE_ENV', 'production');
  const result = await build({
    root: fileURLToPath(new URL('..', import.meta.url)),
    logLevel: 'silent',
    build: { write: false },
  });
  const outputs = Array.isArray(result) ? result : [result];
  for (const output of outputs) {
    if (!('output' in output)) {
      throw new Error('O build do app não devolveu os arquivos gerados.');
    }
    for (const chunk of output.output) {
      if (chunk.type !== 'chunk') {
        continue;
      }
      code += chunk.code;
      for (const [id, module] of Object.entries(chunk.modules)) {
        if (id.includes('/packages/content/src/')) {
          contentModules.push({ id, exports: module.renderedExports });
        }
      }
    }
  }
});

afterAll(() => {
  vi.unstubAllEnvs();
  code = '';
  contentModules = [];
});

/** Os textos de jogo de um valor do conteúdo: frases, não identificadores. */
function phrases(value: unknown, found: Set<string> = new Set()): Set<string> {
  if (typeof value === 'string') {
    if (value.length >= 12 && value.includes(' ')) {
      found.add(value);
    }
  } else if (Array.isArray(value)) {
    value.forEach((item) => phrases(item, found));
  } else if (typeof value === 'object' && value !== null) {
    Object.values(value).forEach((item) => phrases(item, found));
  }
  return found;
}

/**
 * Um valor do conteúdo como o minificador o escreveria dentro do pacote: um objeto de
 * JavaScript, com as chaves sem aspas ("rosterCap:12"). É contra essa forma que os marcadores
 * de número são conferidos.
 */
function asJavaScript(value: unknown): string {
  return JSON.stringify(value).replace(/"([A-Za-z_$][\w$]*)":/g, '$1:');
}

describe('o pacote do app', () => {
  it('é compilado inteiro, com o protocolo dentro', () => {
    expect(code.length).toBeGreaterThan(50_000);
    expect(contentModules.map((module) => module.id).join('\n')).toContain('content/src/ids.ts');
  });

  it('do conteúdo, só leva as listas de identificadores', () => {
    const carried = [...new Set(contentModules.flatMap((module) => module.exports))].sort();
    expect(carried.filter((name) => !ALLOWED_CONTENT_EXPORTS.includes(name))).toEqual([]);
  });

  it('não leva nenhum número de regra', () => {
    for (const marker of [
      'perWorkerPerHour:{',
      'foodPerVillagerPerHour:',
      'storageCapacity:{',
      'famineDesertion:',
      'costFactor:{',
      'baseCost:{',
    ]) {
      expect(code.includes(marker), marker).toBe(false);
    }
  });

  it('não leva o que o Conselho e a Ameaça escondem: flags, efeitos escondidos e as regras das incursões', () => {
    // O catálogo de cartas está a um `import` de distância: `contentHash`, de `@lotg/protocol`,
    // o lê inteiro. O lint barra o `import` no app; este teste prova que nada chegou ao pacote,
    // nem por um caminho que o lint não conhece.
    const effects = content.councilCards.flatMap((card) =>
      card.options.flatMap((option) => [...option.effects, ...(option.hidden?.effects ?? [])]),
    );
    const flags = effects.flatMap((effect) =>
      effect.type === 'setFlag' || effect.type === 'clearFlag' ? [effect.flag] : [],
    );
    // A frase de um efeito escondido, em pedaços: os marcadores ({dia}, {feudo}) ficam de fora.
    const hidden = content.councilCards.flatMap((card) =>
      card.options.flatMap((option) =>
        (option.hidden?.chronicle ?? '')
          .split(/\{[^}]*\}/)
          .map((piece) => piece.trim())
          .filter((piece) => piece.length >= 16),
      ),
    );
    expect(new Set(flags).size).toBeGreaterThan(10);
    expect(hidden.length).toBeGreaterThan(10);
    const keys = [
      'autoResolve',
      'scheduleCard',
      'afterDays',
      'drawIntervalDays',
      'raidChanceAbove',
      'mediumRaidAbove',
      'palisadeBreach',
      'lossRatio',
    ];
    expect(
      [...new Set(flags), ...hidden, ...keys].filter((secret) => code.includes(secret)),
    ).toEqual([]);
  });

  // Revisão da Fase C (A-R8): a Guilda e a Taverna têm números e segredos próprios, e os
  // marcadores acima são todos de antes delas.
  it('não leva nenhum número de regra da Guilda nem da Taverna (v0.3)', () => {
    const { heroes, tavern } = content.balance;
    const markers = [
      // `wagePerHour` é também um campo da visão: o que não pode chegar é o número do conteúdo.
      `wagePerHour:${heroes.wagePerHour},`,
      'limitBase:',
      'rosterCap:',
      'arrivingCap:',
      'discontentAfterRealMs:',
      'leaveAfterRealMs:',
      'leaveEveryRealMs:',
      'resumeWithinRealMs:',
      'discontentFactor:',
      'levelBonus:',
      'offersByLevel:',
      'rotationMs:',
      'moralePerLevel:',
      'heroLimitPerLevel:',
      'moraleLabel:',
    ];
    // Os marcadores são do conteúdo de hoje: se um nome mudar lá, o marcador velho passaria
    // para sempre. A tabela, escrita como um objeto de JavaScript, tem de conter cada um.
    const leaked = asJavaScript({ heroes, tavern });
    expect(markers.filter((marker) => !leaked.includes(marker))).toEqual([]);
    expect(markers.filter((marker) => code.includes(marker))).toEqual([]);
    // Os efeitos dos traços e os atributos das classes, que a ficha só mostra em frase.
    const traitKeys = [
      ...new Set(Object.values(content.heroTraits).flatMap((trait) => Object.keys(trait.effects))),
    ];
    expect(traitKeys.length).toBeGreaterThanOrEqual(3);
    // "morale" é palavra da visão; dos efeitos, o que denuncia é a chave com o número.
    const traitEffects = Object.values(content.heroTraits)
      .filter((trait) => Object.keys(trait.effects).length > 0)
      .map((trait) => asJavaScript(trait.effects).slice(1, -1));
    expect(
      [...traitKeys.filter((key) => key !== 'morale'), ...traitEffects].filter((secret) =>
        code.includes(secret),
      ),
    ).toEqual([]);
    const classes = Object.values(content.heroClasses).map((entry) =>
      asJavaScript(entry.attributes),
    );
    expect(classes.filter((attributes) => code.includes(attributes))).toEqual([]);
  });

  it('não leva o que a Taverna e as cartas escondem dos heróis: modelos de candidato, pesos, preços cheios e quem tem nome', () => {
    // O modelo de um candidato diz o peso dele no sorteio e o preço sem desconto; o evento da
    // contratação já deixou de levá-lo (`templateId`), e o pacote não pode trazê-lo de volta.
    const templates = content.tavernCandidates.flatMap((candidate) => [
      candidate.id,
      `weight:${candidate.weight},price:${candidate.price}`,
    ]);
    expect(content.TAVERN_CANDIDATE_IDS.length).toBeGreaterThanOrEqual(10);
    expect(templates.filter((secret) => code.includes(secret))).toEqual([]);
    // A visão fala em oferta (`offerId`), nunca em modelo, e não diz que um herói tem nome.
    expect(
      ['templateId', 'namedHeroId', 'tavernCandidates', 'namedHeroes', 'heroNames'].filter((key) =>
        code.includes(key),
      ),
    ).toEqual([]);
    // Quem uma carta pode trazer e os nomes que a Taverna sorteia: fora de qualquer frase, como
    // um texto solto (entre aspas ou crases), que é como uma lista vazada apareceria.
    const names = [
      ...Object.keys(content.namedHeroes),
      ...Object.values(content.namedHeroes).map((hero) => hero.name),
      ...content.heroNames.map((entry) => entry.name),
    ];
    expect(names.length).toBeGreaterThan(20);
    const loose = (name: string) => new RegExp(`["'\`]${name}["'\`]`).test(code);
    expect(names.filter(loose)).toEqual([]);
    // A carta roteirizada: o dia em que ela sai não é do app.
    expect(code.includes('atGameDay')).toBe(false);
  });

  it('não leva os grafos das expedições: nem número de regra, nem dificuldade, nem chave de nó, nem o que vem depois de uma encruzilhada (v0.3)', () => {
    const { expeditions } = content.balance;
    const markers = [
      'crossroadsWaitRealMs:',
      'lootShare:',
      'slotsByGuildLevel:',
      'reportsKept:',
      'variantsPerModel:',
      'minNodeMs:',
      'maxSteps:',
    ];
    const leaked = asJavaScript({ expeditions });
    expect(markers.filter((marker) => !leaked.includes(marker))).toEqual([]);
    expect(markers.filter((marker) => code.includes(marker))).toEqual([]);
    // O efeito de estação que encurta a jornada.
    expect(code.includes('expeditionDuration')).toBe(false);
    // Os grafos: as chaves que só o conteúdo tem, e cada nó escrito como um objeto.
    expect(
      ['expeditionModels', 'onDisaster', 'riskLabel', 'minHeroLevel', 'guildLevel'].filter((key) =>
        code.includes(key),
      ),
    ).toEqual([]);
    const secrets: string[] = [];
    for (const model of content.expeditionModels) {
      for (const variant of model.variants) {
        for (const [key, node] of Object.entries(variant.nodes)) {
          // A chave do nó e a de cada opção, soltas entre aspas, como um grafo vazado as traria.
          secrets.push(key);
          if (node.kind === 'crossroads') {
            secrets.push(...node.options.map((option) => option.id));
          } else if (node.kind !== 'return' && node.trial !== undefined) {
            secrets.push(`difficulty:${node.trial.difficulty},`);
          }
        }
      }
    }
    expect(secrets.length).toBeGreaterThan(20);
    const loose = (secret: string) =>
      secret.includes(':') ? code.includes(secret) : new RegExp(`["'\`]${secret}["'\`]`).test(code);
    // Chaves que também são palavras comuns do app ficam de fora da conferência por aspas.
    const common = new Set(['home', 'leave', 'edge', 'trail', 'stream', 'fork', 'nest', 'climb']);
    expect([...new Set(secrets)].filter((secret) => !common.has(secret)).filter(loose)).toEqual([]);
    // Os títulos, as frases e as pistas dos nós são frases do conteúdo: o teste abaixo as barra.
  });

  it('não leva nenhuma frase do conteúdo', () => {
    const secret = Object.entries(content)
      .filter(([name]) => !ALLOWED_CONTENT_EXPORTS.includes(name))
      .flatMap(([, value]) => [...phrases(value)]);
    // A lista não pode esvaziar sem ninguém notar: dificuldades, ritmos, objetivos e Crônica.
    expect(secret.length).toBeGreaterThan(30);
    expect(secret.filter((phrase) => code.includes(phrase))).toEqual([]);
  });
});
