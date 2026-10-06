import type { ExpeditionModelDef, ExpeditionReturnNode, ExpeditionStageNode } from '../expeditions';

/**
 * "Resgate" (GDD §9.3; ADR 0017, decisão 8; ADR 0018, decisão 12): duas horas de jogo, dois
 * heróis, risco alto. Só aparece enquanto houver um herói em cativeiro. **Grafo provisório de
 * V3D-T2**: três variantes mínimas, sem encruzilhada. Do Sucesso em diante, o último nó liberta
 * quem está em cativeiro há mais tempo. O ADR diz "2 nós": com o teto de 45 minutos por nó, duas
 * horas pedem dois nós de prova e o caminho de volta (pendência D-16). O catálogo de verdade é
 * de V3D-T3. Rascunho que o autor não leu.
 */

const MINUTE_MS = 60_000;

const home: ExpeditionReturnNode = {
  kind: 'return',
  title: 'A fuga para casa',
  durationMs: 30 * MINUTE_MS,
  text: 'No {dia}º dia {daEstacao}, a expedição de {feudo} tomou o caminho de casa pelos atalhos.',
};

/** A chegada ao cativeiro sem ser visto: perícia pesa. */
const approach = (title: string, difficulty: number): ExpeditionStageNode => ({
  kind: 'hazard',
  title,
  durationMs: 45 * MINUTE_MS,
  trial: {
    difficulty,
    xp: 30,
    weights: { skill: { num: 1, den: 2 } },
    onDisaster: 'injury',
    outcomes: {
      full: 'No {dia}º dia {daEstacao}, a expedição de {feudo} chegou ao cativeiro sem ser vista e contou os guardas um a um.',
      success:
        'No {dia}º dia {daEstacao}, a expedição de {feudo} chegou ao cativeiro pela sombra, sem alarme.',
      setback:
        'No {dia}º dia {daEstacao}, um galho estalou sob a expedição de {feudo}: chegaram ao cativeiro com os guardas já de pé.',
      disaster:
        'No {dia}º dia {daEstacao}, a expedição de {feudo} caiu numa cilada a caminho do cativeiro e seguiu ferida.',
    },
  },
  next: 'cell',
});

/** A porta do cativeiro: quem a abre traz o cativo; quem falha feio fica lá também. */
const cell = (title: string, difficulty: number): ExpeditionStageNode => ({
  kind: 'boss',
  title,
  durationMs: 45 * MINUTE_MS,
  trial: {
    difficulty,
    xp: 45,
    onDisaster: 'capture',
    outcomes: {
      full: 'No {dia}º dia {daEstacao}, a expedição de {feudo} rendeu os guardas, abriu a porta do cativeiro e ainda levou a bolsa do carcereiro.',
      success:
        'No {dia}º dia {daEstacao}, a expedição de {feudo} forçou a porta do cativeiro e saiu de lá com quem tinha ido buscar.',
      setback:
        'No {dia}º dia {daEstacao}, os guardas seguraram a porta do cativeiro contra a expedição de {feudo}. A equipe recuou sem quem tinha ido buscar.',
      disaster:
        'No {dia}º dia {daEstacao}, a expedição de {feudo} foi cercada diante do cativeiro. Em vez de abrir a porta, deixou mais um atrás dela.',
    },
  },
  rewards: { resources: { gold: { min: 10, max: 30 } }, rescues: true },
  next: 'home',
});

export const rescue: ExpeditionModelDef = {
  id: 'rescue',
  label: 'Resgate',
  riskLabel: 'Alto',
  durationMs: 120 * MINUTE_MS,
  requires: { guildLevel: 1, teamMin: 2, teamMax: 2, minHeroLevel: 1, classes: [] },
  access: { kind: 'captive' },
  variants: [
    {
      start: 'approach',
      nodes: {
        approach: /* @__PURE__ */ approach('A chegada pela mata', 55),
        cell: /* @__PURE__ */ cell('A porta do cativeiro', 78),
        home,
      },
    },
    {
      start: 'approach',
      nodes: {
        approach: /* @__PURE__ */ approach('A chegada pelo leito seco', 58),
        cell: /* @__PURE__ */ cell('O carcereiro e os cães', 80),
        home,
      },
    },
    {
      start: 'approach',
      nodes: {
        approach: /* @__PURE__ */ approach('A chegada com a troca da guarda', 52),
        cell: /* @__PURE__ */ cell('A jaula no pátio', 82),
        home,
      },
    },
  ],
};
