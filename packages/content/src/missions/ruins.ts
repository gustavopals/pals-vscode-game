import type { ExpeditionModelDef, ExpeditionReturnNode, ExpeditionStageNode } from '../expeditions';

/**
 * "Ruínas de Vel'Thar" (GDD §9.3 e Apêndice C; ADR 0018, decisão 12): três horas de jogo, quatro
 * nós, dois ou três heróis de nível 2 ou mais, risco médio. Só aparece depois de uma Patrulha a
 * revelar. **Grafo provisório de V3D-T2**: três variantes mínimas, sem encruzilhada, com as
 * dificuldades do exemplo do ADR 0017 (50, 60 e 90), para a captura e o item raro terem onde
 * acontecer: o guardião da cripta é o único nó marcado com captura. O grafo de verdade (a
 * variante A é a do Apêndice C) é de V3D-T3. Rascunho que o autor não leu.
 */

const MINUTE_MS = 60_000;

const home: ExpeditionReturnNode = {
  kind: 'return',
  title: 'A volta pela estrada dos mortos',
  durationMs: 45 * MINUTE_MS,
  text: "No {dia}º dia {daEstacao}, a expedição de {feudo} deixou as Ruínas de Vel'Thar.",
};

const gate = (difficulty: number): ExpeditionStageNode => ({
  kind: 'encounter',
  title: 'Os saqueadores no portão caído',
  durationMs: 45 * MINUTE_MS,
  trial: {
    difficulty,
    xp: 35,
    onDisaster: 'injury',
    outcomes: {
      full: 'No {dia}º dia {daEstacao}, a expedição de {feudo} desbaratou os saqueadores do portão caído e ficou com o que eles tinham cavado.',
      success:
        'No {dia}º dia {daEstacao}, a expedição de {feudo} abriu passagem entre os saqueadores do portão caído.',
      setback:
        'No {dia}º dia {daEstacao}, os saqueadores do portão caído cobraram caro a passagem da expedição de {feudo}.',
      disaster:
        'No {dia}º dia {daEstacao}, os saqueadores do portão caído emboscaram a expedição de {feudo}, que passou deixando sangue.',
    },
  },
  rewards: { resources: { stone: { min: 30, max: 50 } } },
  next: 'falseFloor',
});

const hall = (difficulty: number): ExpeditionStageNode => ({
  kind: 'hazard',
  title: 'O salão das lajes falsas',
  durationMs: 45 * MINUTE_MS,
  trial: {
    difficulty,
    xp: 40,
    weights: { skill: { num: 1, den: 2 } },
    onDisaster: 'injury',
    outcomes: {
      full: 'No {dia}º dia {daEstacao}, a expedição de {feudo} leu as lajes do salão como quem lê um mapa e tirou das paredes o que ainda brilhava.',
      success:
        'No {dia}º dia {daEstacao}, a expedição de {feudo} atravessou o salão das lajes falsas pisando onde devia.',
      setback:
        'No {dia}º dia {daEstacao}, uma laje cedeu sob a expedição de {feudo} no salão. Seguiram, mancando.',
      disaster:
        'No {dia}º dia {daEstacao}, o chão do salão se abriu sob a expedição de {feudo}. Tiraram um dos seus do fosso a muito custo.',
    },
  },
  rewards: { resources: { stone: { min: 40, max: 70 }, gold: { min: 20, max: 40 } } },
  next: 'crypt',
});

const crypt = (difficulty: number): ExpeditionStageNode => ({
  kind: 'boss',
  title: 'O guardião da cripta',
  durationMs: 45 * MINUTE_MS,
  trial: {
    difficulty,
    xp: 60,
    onDisaster: 'capture',
    outcomes: {
      full: "No {dia}º dia {daEstacao}, a expedição de {feudo} derrubou o guardião da cripta de Vel'Thar e abriu as arcas que ele velava.",
      success:
        "No {dia}º dia {daEstacao}, a expedição de {feudo} venceu o guardião da cripta de Vel'Thar e levou o que pôde carregar.",
      setback:
        "No {dia}º dia {daEstacao}, o guardião da cripta de Vel'Thar rechaçou a expedição de {feudo}, que saiu só com o que estava à mão.",
      disaster:
        "No {dia}º dia {daEstacao}, o guardião da cripta de Vel'Thar fechou a porta de pedra sobre a expedição de {feudo}. Nem todos ficaram do lado de fora.",
    },
  },
  rewards: {
    resources: { gold: { min: 60, max: 100 } },
    item: {
      chance: { num: 1, den: 2 },
      from: ['veltharBlade', 'riveredMail', 'pilgrimRelic'],
    },
  },
  next: 'home',
});

export const ruins: ExpeditionModelDef = {
  id: 'ruins',
  label: "Ruínas de Vel'Thar",
  riskLabel: 'Médio',
  durationMs: 180 * MINUTE_MS,
  requires: { guildLevel: 1, teamMin: 2, teamMax: 3, minHeroLevel: 2, classes: [] },
  access: { kind: 'discovered' },
  variants: [
    {
      start: 'fallenGate',
      nodes: {
        fallenGate: /* @__PURE__ */ gate(50),
        falseFloor: /* @__PURE__ */ hall(60),
        crypt: /* @__PURE__ */ crypt(90),
        home,
      },
    },
    {
      start: 'fallenGate',
      nodes: {
        fallenGate: /* @__PURE__ */ gate(52),
        falseFloor: /* @__PURE__ */ hall(56),
        crypt: /* @__PURE__ */ crypt(92),
        home,
      },
    },
    {
      start: 'fallenGate',
      nodes: {
        fallenGate: /* @__PURE__ */ gate(48),
        falseFloor: /* @__PURE__ */ hall(62),
        crypt: /* @__PURE__ */ crypt(88),
        home,
      },
    },
  ],
};
