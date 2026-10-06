import type {
  ExpeditionCrossroadsNode,
  ExpeditionModelDef,
  ExpeditionReturnNode,
  ExpeditionStageNode,
} from '../expeditions';

/**
 * "Floresta Antiga" (GDD §9.3; ADR 0018, decisão 12): uma hora de jogo, três nós, um ou dois
 * heróis, risco de baixo a médio. Rende madeira, algum ouro e, na mata fechada, um item comum.
 *
 * É a primeira encruzilhada do jogo, e a lição dela é **a equipe decide o caminho**: o caminho
 * de quem vai sozinho (o riacho, o barranco) não é o de quem vai em dupla (a mata fechada, que
 * pede um Guerreiro e é demais para um só), e o ninho é de Arqueiro. Voltar com o que já se tem
 * é a escolha de quem foi sem a classe certa.
 *
 * As duas primeiras variantes têm o mesmo primeiro trecho e a mesma encruzilhada, com ramos
 * diferentes adiante: antes da encruzilhada o jogador não sabe em qual das duas está (é o que o
 * teste de névoa usa). A ficha de cada grafo está em `docs/content-v0.3.md`. Rascunho que o
 * autor não leu.
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
      hint: 'A melhor madeira do bosque, e pegadas grandes na lama; é serviço para mais de um, com quem abra o caminho no braço.',
      requires: { heroClass: 'warrior' },
      next: 'deepWoods',
    },
    {
      id: 'stream',
      label: 'Seguir o riacho',
      hint: 'O riacho leva à lenha boa da outra margem; se houver pedra molhada no caminho, quem tem perícia passa melhor.',
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
            difficulty: 52,
            xp: 22,
            onDisaster: 'injury',
            helps: 'warrior',
            outcomes: {
              full: 'No {dia}º dia {daEstacao}, {heroi} abateu o javali da mata fechada, e a expedição de {feudo} cortou a melhor madeira do bosque.',
              success:
                'No {dia}º dia {daEstacao}, {heroi} espantou o javali da mata fechada, e a expedição de {feudo} trabalhou em paz.',
              setback:
                'No {dia}º dia {daEstacao}, o javali da mata fechada passou por {heroi} e dispersou a expedição de {feudo}: metade da madeira da mata ficou para trás.',
              disaster:
                'No {dia}º dia {daEstacao}, o javali da mata fechada derrubou {heroi} e pôs a expedição de {feudo} para correr, sem tocar na madeira dali.',
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
            difficulty: 46,
            xp: 22,
            weights: { skill: { num: 1, den: 1 } },
            onDisaster: 'injury',
            helps: 'archer',
            lesson: 'Um Arqueiro teria escolhido as pedras secas.',
            outcomes: {
              full: 'No {dia}º dia {daEstacao}, {heroi} passou as pedras do riacho sem um escorregão e achou do outro lado uma clareira de troncos secos.',
              success:
                'No {dia}º dia {daEstacao}, {heroi} passou as pedras do riacho, e a expedição de {feudo} encheu os ombros de lenha.',
              setback:
                'No {dia}º dia {daEstacao}, {heroi} escorregou nas pedras do riacho, e metade da lenha da outra margem foi para a água.',
              disaster:
                'No {dia}º dia {daEstacao}, as pedras do riacho derrubaram {heroi}, e a lenha da outra margem ficou onde estava.',
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
            difficulty: 54,
            xp: 22,
            onDisaster: 'injury',
            helps: 'warrior',
            outcomes: {
              full: 'No {dia}º dia {daEstacao}, {heroi} encarou os lenhadores sem senhor da mata fechada, e eles largaram os machados e a pilha de toras.',
              success:
                'No {dia}º dia {daEstacao}, {heroi} dividiu a mata fechada com os lenhadores sem senhor, à força de cara feia.',
              setback:
                'No {dia}º dia {daEstacao}, os lenhadores sem senhor não se assustaram com {heroi}: ficaram com a melhor parte, e a expedição de {feudo}, com as sobras.',
              disaster:
                'No {dia}º dia {daEstacao}, os lenhadores sem senhor cercaram {heroi} e puseram a expedição de {feudo} para fora da mata fechada, sem um cavaco dela.',
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
              hint: 'Sem risco; voltam de mãos vazias.',
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
            difficulty: 50,
            xp: 22,
            weights: { skill: { num: 3, den: 2 } },
            onDisaster: 'injury',
            helps: 'archer',
            outcomes: {
              full: 'No {dia}º dia {daEstacao}, {heroi} subiu ao ninho do tronco oco e desceu com tudo o que a gralha tinha juntado em anos.',
              success:
                'No {dia}º dia {daEstacao}, {heroi} alcançou o ninho do tronco oco e trouxe as moedas da gralha.',
              setback:
                'No {dia}º dia {daEstacao}, um galho cedeu sob {heroi}, e metade do achado do ninho ficou no mato.',
              disaster:
                'No {dia}º dia {daEstacao}, {heroi} despencou do tronco oco antes de tocar o ninho.',
            },
          },
          rewards: {
            resources: { gold: { min: 30, max: 50 } },
            // Uma gralha junta o que brilha e cabe no bico: moedas e, com sorte, um amuleto.
            item: { chance: { num: 1, den: 2 }, from: ['luckyCharm'] },
          },
          next: 'home',
        },
        ravineFloor: {
          kind: 'encounter',
          title: 'O fundo do barranco',
          durationMs: 25 * MINUTE_MS,
          trial: {
            difficulty: 40,
            xp: 22,
            onDisaster: 'injury',
            helps: 'warrior',
            lesson: 'Um Guerreiro teria ficado entre o urso e a carga.',
            outcomes: {
              full: 'No {dia}º dia {daEstacao}, {heroi} desceu na frente e achou o fundo do barranco vazio, com os troncos prontos para levar.',
              success:
                'No {dia}º dia {daEstacao}, {heroi} afugentou o urso do barranco, e a expedição de {feudo} levou os troncos.',
              setback:
                'No {dia}º dia {daEstacao}, o urso do barranco avançou sobre {heroi} e só deixou a expedição de {feudo} sair com metade dos troncos.',
              disaster:
                'No {dia}º dia {daEstacao}, o urso do barranco derrubou {heroi} e expulsou a expedição de {feudo}, que largou os troncos na subida.',
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
