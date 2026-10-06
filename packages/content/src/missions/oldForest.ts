import type {
  ExpeditionCrossroadsNode,
  ExpeditionModelDef,
  ExpeditionReturnNode,
  ExpeditionStageNode,
} from '../expeditions';

/**
 * "Floresta Antiga" (GDD §9.3; ADR 0018, decisão 12): uma hora de jogo, três nós, um ou dois
 * heróis, risco de baixo a médio. **Grafo provisório de V3D-T1**: uma encruzilhada de três
 * opções, uma delas com requisito de classe, para a máquina das expedições ter onde parar,
 * esperar e deixar a Postura decidir. As duas primeiras variantes têm o mesmo primeiro trecho e
 * a mesma encruzilhada, com ramos diferentes adiante: é o que o teste de névoa usa (duas
 * expedições iguais até a encruzilhada dão a mesma visão). O catálogo de verdade é de V3D-T3.
 * Rascunho que o autor não leu.
 */

const MINUTE_MS = 60_000;

const trail: ExpeditionStageNode = {
  kind: 'travel',
  title: 'A trilha sob os carvalhos',
  durationMs: 15 * MINUTE_MS,
  text: 'No {dia}º dia {daEstacao}, a expedição de {feudo} entrou na Floresta Antiga e juntou a lenha caída pelo caminho.',
  rewards: { resources: { wood: { min: 10, max: 20 } } },
  next: 'fork',
};

const fork: ExpeditionCrossroadsNode = {
  kind: 'crossroads',
  title: 'A trilha se divide',
  text: 'A trilha se parte em duas diante de um carvalho tombado. À esquerda, a mata fecha; à direita, ouve-se água.',
  options: [
    {
      id: 'thicket',
      label: 'Abrir caminho pela mata fechada',
      hint: 'Madeira boa e pegadas grandes; é preciso quem abra o caminho no braço.',
      requires: { heroClass: 'warrior' },
      next: 'deepWoods',
    },
    {
      id: 'stream',
      label: 'Seguir o riacho',
      hint: 'Chão escorregadio e alguma lenha; quem tem perícia passa melhor.',
      next: 'glade',
    },
    {
      id: 'turnBack',
      label: 'Voltar com o que já têm',
      hint: 'Sem risco; o saque fica pequeno.',
      next: 'home',
    },
  ],
  posture: { cautious: 'turnBack', balanced: 'stream', bold: 'thicket' },
};

const home: ExpeditionReturnNode = {
  kind: 'return',
  title: 'A volta pela trilha',
  durationMs: 20 * MINUTE_MS,
  text: 'No {dia}º dia {daEstacao}, a expedição de {feudo} deixou a Floresta Antiga.',
};

export const oldForest: ExpeditionModelDef = {
  id: 'oldForest',
  label: 'Floresta Antiga',
  riskLabel: 'Baixo a médio',
  durationMs: 60 * MINUTE_MS,
  requires: { guildLevel: 1, teamMin: 1, teamMax: 2, minHeroLevel: 1, classes: [] },
  access: { kind: 'open' },
  variants: [
    {
      start: 'trail',
      nodes: {
        trail,
        fork,
        deepWoods: {
          kind: 'encounter',
          title: 'O javali da mata fechada',
          durationMs: 25 * MINUTE_MS,
          trial: {
            difficulty: 55,
            xp: 20,
            onDisaster: 'injury',
            outcomes: {
              full: 'No {dia}º dia {daEstacao}, a expedição de {feudo} abateu o javali da mata fechada e cortou a melhor madeira do bosque.',
              success:
                'No {dia}º dia {daEstacao}, a expedição de {feudo} espantou o javali da mata fechada e trabalhou em paz.',
              setback:
                'No {dia}º dia {daEstacao}, o javali da mata fechada dispersou a expedição de {feudo}: metade da madeira ficou para trás.',
              disaster:
                'No {dia}º dia {daEstacao}, o javali da mata fechada pôs a expedição de {feudo} para correr, sem uma tora sequer.',
            },
          },
          rewards: {
            resources: { wood: { min: 60, max: 90 }, gold: { min: 20, max: 30 } },
            item: {
              chance: { num: 1, den: 3 },
              from: ['huntingSpear', 'paddedJerkin', 'luckyCharm'],
            },
          },
          next: 'home',
        },
        glade: {
          kind: 'hazard',
          title: 'As pedras do riacho',
          durationMs: 25 * MINUTE_MS,
          trial: {
            difficulty: 36,
            xp: 20,
            weights: { skill: { num: 1, den: 2 } },
            onDisaster: 'injury',
            outcomes: {
              full: 'No {dia}º dia {daEstacao}, a expedição de {feudo} passou as pedras do riacho sem um escorregão e achou uma clareira de troncos secos.',
              success:
                'No {dia}º dia {daEstacao}, a expedição de {feudo} passou as pedras do riacho e encheu os ombros de lenha.',
              setback:
                'No {dia}º dia {daEstacao}, a expedição de {feudo} escorregou nas pedras do riacho e perdeu metade da carga na água.',
              disaster:
                'No {dia}º dia {daEstacao}, as pedras do riacho derrubaram a expedição de {feudo}, e a carga desceu com a correnteza.',
            },
          },
          rewards: { resources: { wood: { min: 40, max: 60 } } },
          next: 'home',
        },
        home,
      },
    },
    {
      start: 'trail',
      nodes: {
        trail,
        fork,
        deepWoods: {
          kind: 'encounter',
          title: 'Os lenhadores sem senhor',
          durationMs: 25 * MINUTE_MS,
          trial: {
            difficulty: 58,
            xp: 20,
            onDisaster: 'injury',
            outcomes: {
              full: 'No {dia}º dia {daEstacao}, a expedição de {feudo} fez os lenhadores sem senhor largarem os machados e a pilha de toras.',
              success:
                'No {dia}º dia {daEstacao}, a expedição de {feudo} dividiu a mata com os lenhadores sem senhor, à força de cara feia.',
              setback:
                'No {dia}º dia {daEstacao}, os lenhadores sem senhor ficaram com a melhor parte, e a expedição de {feudo}, com as sobras.',
              disaster:
                'No {dia}º dia {daEstacao}, os lenhadores sem senhor tomaram da expedição de {feudo} até o que ela trazia.',
            },
          },
          rewards: { resources: { wood: { min: 70, max: 100 }, gold: { min: 10, max: 20 } } },
          next: 'home',
        },
        glade: {
          kind: 'discovery',
          title: 'A cabana do carvoeiro',
          durationMs: 25 * MINUTE_MS,
          text: 'No {dia}º dia {daEstacao}, a expedição de {feudo} achou à beira do riacho a cabana vazia de um carvoeiro, com a lenha empilhada.',
          rewards: { resources: { wood: { min: 30, max: 50 } } },
          next: 'home',
        },
        home,
      },
    },
    {
      start: 'edge',
      nodes: {
        edge: {
          kind: 'travel',
          title: 'A orla da floresta',
          durationMs: 15 * MINUTE_MS,
          text: 'No {dia}º dia {daEstacao}, a expedição de {feudo} contornou a orla da Floresta Antiga até achar por onde entrar.',
          next: 'hollow',
        },
        hollow: {
          kind: 'crossroads',
          title: 'O tronco oco',
          text: 'Um tronco oco, da altura de um homem, guarda a entrada de um barranco. Há marcas de garra na casca e um ninho no alto.',
          options: [
            {
              id: 'climb',
              label: 'Subir ao ninho',
              hint: 'Algo brilha lá em cima; é preciso olho e mão firme de arqueiro.',
              requires: { heroClass: 'archer' },
              next: 'nest',
            },
            {
              id: 'ravine',
              label: 'Descer o barranco',
              hint: 'Troncos caídos lá embaixo, e quem os derrubou talvez ainda esteja por perto.',
              next: 'ravineFloor',
            },
            {
              id: 'leave',
              label: 'Dar meia-volta',
              hint: 'Sem risco; voltam de mãos quase vazias.',
              next: 'home',
            },
          ],
          posture: { cautious: 'leave', balanced: 'ravine', bold: 'climb' },
        },
        nest: {
          kind: 'hazard',
          title: 'O ninho no alto',
          durationMs: 25 * MINUTE_MS,
          trial: {
            difficulty: 40,
            xp: 20,
            weights: { skill: { num: 1, den: 1 } },
            onDisaster: 'injury',
            outcomes: {
              full: 'No {dia}º dia {daEstacao}, a expedição de {feudo} subiu ao ninho do tronco oco e desceu com o que a gralha tinha juntado em anos.',
              success:
                'No {dia}º dia {daEstacao}, a expedição de {feudo} alcançou o ninho do tronco oco e trouxe as moedas da gralha.',
              setback:
                'No {dia}º dia {daEstacao}, um galho cedeu sob a expedição de {feudo}, e metade do achado do ninho ficou no mato.',
              disaster:
                'No {dia}º dia {daEstacao}, a expedição de {feudo} despencou do tronco oco antes de tocar o ninho.',
            },
          },
          rewards: { resources: { gold: { min: 30, max: 50 } } },
          next: 'home',
        },
        ravineFloor: {
          kind: 'encounter',
          title: 'O fundo do barranco',
          durationMs: 25 * MINUTE_MS,
          trial: {
            difficulty: 38,
            xp: 20,
            onDisaster: 'injury',
            outcomes: {
              full: 'No {dia}º dia {daEstacao}, a expedição de {feudo} achou o fundo do barranco vazio e os troncos prontos para levar.',
              success:
                'No {dia}º dia {daEstacao}, a expedição de {feudo} afugentou o urso do barranco e levou os troncos.',
              setback:
                'No {dia}º dia {daEstacao}, o urso do barranco só deixou a expedição de {feudo} sair com metade dos troncos.',
              disaster:
                'No {dia}º dia {daEstacao}, o urso do barranco expulsou a expedição de {feudo}, que largou tudo na subida.',
            },
          },
          rewards: { resources: { wood: { min: 50, max: 70 } } },
          next: 'home',
        },
        home,
      },
    },
  ],
};
