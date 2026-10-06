import type {
  ExpeditionModelDef,
  ExpeditionReturnNode,
  ExpeditionStageNode,
  ExpeditionTrial,
} from '../expeditions';

/**
 * "Covil dos Lobos" (GDD §9.3; ADR 0018, decisões 12 e 14): duas horas de jogo, três nós, dois
 * heróis, risco médio. **Grafo provisório de V3D-T2**: três variantes mínimas, sem encruzilhada,
 * para o desfecho ter onde limpar o tile de ameaça. Do Sucesso em diante, o último nó limpa o
 * Covil: a Ameaça cai e o tile para de somar até a virada do ano. Os lobos ferem, não capturam.
 * O catálogo de verdade é de V3D-T3. Rascunho que o autor não leu.
 *
 * As chamadas que montam os nós levam a marca `@__PURE__`: sem ela o empacotador do app não
 * sabe que pode deixar o grafo de fora, e `bundle.test.ts` acusa o conteúdo no navegador.
 */

const MINUTE_MS = 60_000;

const home: ExpeditionReturnNode = {
  kind: 'return',
  title: 'A descida da serra',
  durationMs: 30 * MINUTE_MS,
  text: 'No {dia}º dia {daEstacao}, a expedição de {feudo} desceu a serra do Covil.',
};

/** A subida até a toca: o mesmo trecho nas três variantes, com a dificuldade de cada uma. */
const climb = (difficulty: number): ExpeditionStageNode => ({
  kind: 'hazard',
  title: 'A subida pela pedreira solta',
  durationMs: 45 * MINUTE_MS,
  trial: {
    difficulty,
    xp: 25,
    weights: { skill: { num: 1, den: 2 } },
    onDisaster: 'injury',
    outcomes: {
      full: 'No {dia}º dia {daEstacao}, a expedição de {feudo} subiu a pedreira solta sem rolar uma pedra, e achou no caminho o que os lobos tinham arrastado.',
      success:
        'No {dia}º dia {daEstacao}, a expedição de {feudo} venceu a pedreira solta e chegou à boca do Covil.',
      setback:
        'No {dia}º dia {daEstacao}, a pedreira cedeu sob a expedição de {feudo}: chegaram à boca do Covil, mas arranhados e sem fôlego.',
      disaster:
        'No {dia}º dia {daEstacao}, a pedreira desabou sobre a expedição de {feudo}. Chegaram ao Covil carregando um dos seus.',
    },
  },
  rewards: { resources: { gold: { min: 10, max: 20 } } },
  next: 'den',
});

/** A toca: quem a vence limpa o Covil. */
const den = (
  title: string,
  difficulty: number,
  outcomes: ExpeditionTrial['outcomes'],
): ExpeditionStageNode => ({
  kind: 'boss',
  title,
  durationMs: 45 * MINUTE_MS,
  trial: { difficulty, xp: 40, onDisaster: 'injury', outcomes },
  rewards: { resources: { gold: { min: 40, max: 60 } }, clearsTile: 'wolfDen' },
  next: 'home',
});

export const wolfDen: ExpeditionModelDef = {
  id: 'wolfDen',
  label: 'Covil dos Lobos',
  riskLabel: 'Médio',
  durationMs: 120 * MINUTE_MS,
  requires: { guildLevel: 1, teamMin: 2, teamMax: 2, minHeroLevel: 1, classes: [] },
  access: { kind: 'tile', tileId: 'wolfDen' },
  variants: [
    {
      start: 'climb',
      nodes: {
        climb: /* @__PURE__ */ climb(55),
        den: /* @__PURE__ */ den('A matilha na toca', 66, {
          full: 'No {dia}º dia {daEstacao}, a expedição de {feudo} entrou na toca com fogo e aço. A matilha fugiu serra acima, e o Covil ficou vazio.',
          success:
            'No {dia}º dia {daEstacao}, a expedição de {feudo} enfrentou a matilha na toca e a pôs para correr. O Covil ficou vazio.',
          setback:
            'No {dia}º dia {daEstacao}, a matilha cercou a expedição de {feudo} na toca. Saíram de lá aos tropeços, e os lobos ficaram.',
          disaster:
            'No {dia}º dia {daEstacao}, a matilha caiu sobre a expedição de {feudo} no escuro da toca. Fugiram deixando sangue na pedra, e os lobos ficaram.',
        }),
        home,
      },
    },
    {
      start: 'climb',
      nodes: {
        climb: /* @__PURE__ */ climb(52),
        den: /* @__PURE__ */ den('A loba velha', 70, {
          full: 'No {dia}º dia {daEstacao}, a expedição de {feudo} abateu a loba velha diante da toca. Sem ela, a matilha se desfez, e o Covil ficou vazio.',
          success:
            'No {dia}º dia {daEstacao}, a expedição de {feudo} feriu a loba velha e a viu sumir na serra com os seus. O Covil ficou vazio.',
          setback:
            'No {dia}º dia {daEstacao}, a loba velha não recuou diante da expedição de {feudo}. Foi a equipe que desceu, e os lobos ficaram.',
          disaster:
            'No {dia}º dia {daEstacao}, a loba velha derrubou um dos de {feudo} antes que alguém erguesse o escudo. A equipe fugiu, e os lobos ficaram.',
        }),
        home,
      },
    },
    {
      start: 'climb',
      nodes: {
        climb: /* @__PURE__ */ climb(58),
        den: /* @__PURE__ */ den('Os filhotes e os vigias', 74, {
          full: 'No {dia}º dia {daEstacao}, a expedição de {feudo} passou pelos lobos de vigia sem um uivo e tocou fogo na toca. O Covil ficou vazio.',
          success:
            'No {dia}º dia {daEstacao}, a expedição de {feudo} rompeu os lobos de vigia e espantou a ninhada serra acima. O Covil ficou vazio.',
          setback:
            'No {dia}º dia {daEstacao}, os lobos de vigia deram o alarme antes de a expedição de {feudo} chegar à toca. A equipe recuou, e os lobos ficaram.',
          disaster:
            'No {dia}º dia {daEstacao}, os lobos de vigia fecharam a saída atrás da expedição de {feudo}. Abriram caminho a custo, e os lobos ficaram.',
        }),
        home,
      },
    },
  ],
};
