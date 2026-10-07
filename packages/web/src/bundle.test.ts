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
  // O que o Mercado negocia e os dois sentidos (V3E-T1): os schemas da ordem e da visão os usam.
  'MARKET_RESOURCE_IDS',
  'MORALE_BAND_IDS',
  'MORALE_TERM_IDS',
  'PRODUCTION_BUILDING_IDS',
  'RESOURCE_IDS',
  'SEASON_IDS',
  'TRADE_DIRECTION_IDS',
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

  it('não leva nenhum número de regra do Mercado: preços-base, margem, volume, passeio, estação e marcas (v0.3)', () => {
    const { market } = content.balance;
    const markers = [
      'basePrice:{',
      'sellRatio:{',
      // `dailyVolume` é também um campo da visão: o que não pode chegar é a chave do conteúdo.
      'dailyVolumePerLevel:',
      'maxStepPerMille:',
      'reversion:{',
      'ceiling:{',
      'seasonal:{',
      'swing:{',
    ];
    // Os marcadores são do conteúdo de hoje: a tabela, escrita como um objeto de JavaScript,
    // tem de conter cada um.
    const leaked = asJavaScript({ market });
    expect(markers.filter((marker) => !leaked.includes(marker))).toEqual([]);
    expect(markers.filter((marker) => code.includes(marker))).toEqual([]);
    // A tabela de preços inteira, como o minificador a escreveria, e as frases do Mercado.
    expect(code.includes(asJavaScript(market.basePrice))).toBe(false);
    expect(code.includes('marketTemplates')).toBe(false);
    // O que o estado guarda e a visão nunca mostra: o preço de ontem e o fluxo do sorteio.
    expect(['previousPrices', 'walkedPrice'].filter((key) => code.includes(key))).toEqual([]);
  });

  it('não leva nenhum número de regra das caravanas: preço, prazo, lugares, risco e perda (v0.3)', () => {
    const { caravan } = content.balance.market;
    const markers = [
      'caravan:{',
      'requiresLevel:',
      // `maxUnits` e `tripSeconds` são campos da visão: o que não pode chegar é a tabela.
      'tripMs:',
      'priceRatio:{',
      'slotsByLevel:',
      'ambush:{',
      'basePercent:',
      'perWatchtowerLevel:',
      'floorPercent:',
      'lossRatio:{',
    ];
    // Os marcadores são do conteúdo de hoje: a tabela, escrita como um objeto de JavaScript,
    // tem de conter cada um.
    const leaked = asJavaScript({ caravan });
    expect(markers.filter((marker) => !leaked.includes(marker))).toEqual([]);
    expect(markers.filter((marker) => code.includes(marker))).toEqual([]);
    expect(code.includes(asJavaScript(caravan.ambush))).toBe(false);
    // As frases das caravanas são do conteúdo, e o que o estado guarda e a visão nunca mostra
    // (a chegada em tempo de jogo, a conta do risco) também não chega.
    expect(
      ['caravanTemplates', 'caravanTexts', 'arrivesAtMs', 'ambushPercent', 'ambushLoss'].filter(
        (key) => code.includes(key),
      ),
    ).toEqual([]);
    for (const text of Object.values(content.caravanTexts)) {
      expect(code.includes(text), text).toBe(false);
    }
  });

  it('não leva nenhum número de regra dos Mestres, nem as frases e a ficha deles (v0.3)', () => {
    const { masters } = content.balance;
    const markers = ['masters:{', 'bonus:{', 'maxPerBuilding:', 'adaptationMs:', 'rosterCap:'];
    // Os marcadores são do conteúdo de hoje: a tabela, escrita como um objeto de JavaScript,
    // tem de conter cada um.
    const leaked = asJavaScript({ masters });
    expect(markers.filter((marker) => !leaked.includes(marker))).toEqual([]);
    expect(markers.filter((marker) => code.includes(marker))).toEqual([]);
    expect(code.includes(asJavaScript(masters))).toBe(false);
    // O que o estado guarda e a visão nunca mostra (o Mestre no conteúdo, o prazo em tempo de
    // jogo) e os nomes das tabelas do conteúdo também não chegam.
    expect(
      ['masterTemplates', 'masterTexts', 'adaptingUntilMs', 'mastersWaiting:['].filter((key) =>
        code.includes(key),
      ),
    ).toEqual([]);
    // As frases da tela vêm prontas na visão; os nomes e as origens, também. Ficam de fora os
    // textos curtos demais para servir de prova (os tratamentos e os rótulos de duas palavras).
    for (const text of Object.values(content.masterTexts)) {
      if (text.length > 12) {
        expect(code.includes(text), text).toBe(false);
      }
    }
    for (const def of Object.values(content.masters)) {
      expect(code.includes(def.originText), def.originText).toBe(false);
    }
    for (const text of Object.values(content.masterTemplates)) {
      expect(code.includes(text), text).toBe(false);
    }
  });

  // Revisão da Fase D (A25): os itens e o que cada nó rende têm números próprios, e os
  // marcadores acima não os conheciam.
  it('não leva os itens nem as recompensas das expedições: bônus, valor, raridade, chance de achado e faixas de saque (v0.3)', () => {
    // O teto do arsenal: `inventoryCap` é também um campo da visão; o que não pode chegar é o
    // número do conteúdo, escrito como a tabela o escreve.
    const { equipment } = content.balance;
    const cap = `inventoryCap:${equipment.inventoryCap}}`;
    expect(asJavaScript({ equipment })).toContain(cap);
    expect(code.includes(cap)).toBe(false);
    // Cada item: o fator do poder, o valor em ouro e a chave dele (a visão só fala em `item-<n>`
    // e mostra o bônus em frase).
    const defs = Object.entries(content.items);
    expect(defs.length).toBeGreaterThanOrEqual(9);
    const itemSecrets = defs.flatMap(([id, def]) => [
      id,
      `power:${asJavaScript(def.power)},value:${def.value}`,
    ]);
    // Os marcadores são do conteúdo de hoje: a tabela, escrita como JavaScript, contém cada um.
    const table = asJavaScript(content.items);
    expect(itemSecrets.filter((secret) => secret.includes(':') && !table.includes(secret))).toEqual(
      [],
    );
    // O que cada nó rende: a chance e a lista de onde sai um item, e a faixa de cada recurso.
    const rewardSecrets: string[] = [];
    for (const model of content.expeditionModels) {
      for (const variant of model.variants) {
        for (const node of Object.values(variant.nodes)) {
          const rewards = 'rewards' in node ? node.rewards : undefined;
          if (rewards === undefined) {
            continue;
          }
          if (rewards.item !== undefined) {
            rewardSecrets.push(`chance:${asJavaScript(rewards.item.chance)}`);
          }
          for (const [resource, range] of Object.entries(rewards.resources ?? {})) {
            rewardSecrets.push(`${resource}:${asJavaScript(range)}`);
          }
        }
      }
    }
    expect(rewardSecrets.filter((secret) => secret.startsWith('chance:')).length).toBeGreaterThan(
      5,
    );
    expect(
      rewardSecrets.filter((secret) => /\{min:\d+,max:\d+\}/.test(secret)).length,
    ).toBeGreaterThan(20);
    const loose = (secret: string) =>
      secret.includes(':') ? code.includes(secret) : new RegExp(`["'\`]${secret}["'\`]`).test(code);
    expect([...new Set([...itemSecrets, ...rewardSecrets])].filter(loose)).toEqual([]);
    // As chaves que só o conteúdo tem: de onde sai o item, o que o nó revela, limpa e solta, e a
    // tabela das raridades. (`rescue` e `rarityLabel` são da visão; estas, não.)
    expect(
      ['clearsTile', 'reveals:', 'rescues:', 'itemRarities', 'ITEM_RARITY_IDS', 'ITEM_IDS'].filter(
        (key) => code.includes(key),
      ),
    ).toEqual([]);
    // E nenhuma raridade solta entre aspas: a visão manda a palavra pronta (`rarityLabel`).
    expect(content.ITEM_RARITY_IDS.filter(loose)).toEqual([]);
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
