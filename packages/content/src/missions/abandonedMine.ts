import type { ExpeditionModelDef, ExpeditionReturnNode, ExpeditionStageNode } from '../expeditions';

/**
 * "Mina Abandonada" (GDD §9.3; ADR 0019, decisão 3; V4B-T1): quatro horas de jogo, quatro nós,
 * dois heróis com um Guerreiro entre eles, risco médio. Pede a Guilda dos Aventureiros no nível 2 e só aparece
 * depois de revelada pela Floresta Antiga. **É o
 * único destino que rende ferro**: de 40 a 80 no último nó com prova, mais pedra pelo caminho.
 *
 * Cada variante tem a descida (um trecho sem prova), uma prova na boca da galeria, a
 * encruzilhada (o veio fundo, a galeria lateral ou a volta) e a prova do veio. **O veio fundo é
 * o caminho ousado e o único nó que captura**; a galeria lateral rende menos ferro e só fere.
 *
 * A ficha de cada grafo está em `docs/content-v0.4.md`, seção 1. Rascunho que o autor não leu.
 */

const MINUTE_MS = 60_000;

const descent: ExpeditionStageNode = {
  kind: 'travel',
  title: 'A descida pela boca da mina',
  durationMs: 60 * MINUTE_MS,
  text: 'No {dia}º dia {daEstacao}, a expedição de {feudo} acendeu as tochas e desceu pela boca da Mina Abandonada, juntando a pedra solta da rampa.',
  rewards: { resources: { stone: { min: 10, max: 20 } } },
  next: 'shaft',
};

const home: ExpeditionReturnNode = {
  kind: 'return',
  title: 'A subida pela rampa',
  durationMs: 60 * MINUTE_MS,
  text: 'No {dia}º dia {daEstacao}, a expedição de {feudo} subiu a rampa da Mina Abandonada e voltou a ver o céu.',
};

export const abandonedMine: ExpeditionModelDef = {
  id: 'abandonedMine',
  label: 'Mina Abandonada',
  riskLabel: 'Médio',
  durationMs: 240 * MINUTE_MS,
  requires: { guildLevel: 2, teamMin: 2, teamMax: 2, minHeroLevel: 1, classes: ['warrior'] },
  access: { kind: 'discovered' },
  variants: [
    {
      start: 'descent',
      nodes: {
        descent,
        shaft: {
          kind: 'hazard',
          title: 'O poço escorado',
          durationMs: 60 * MINUTE_MS,
          trial: {
            difficulty: 78,
            xp: 20,
            weights: { skill: { num: 1, den: 1 } },
            onDisaster: 'injury',
            helps: 'archer',
            lesson: 'Um Arqueiro teria visto qual escora ainda aguentava o peso.',
            outcomes: {
              full: 'No {dia}º dia {daEstacao}, {heroi} escolheu as escoras firmes do poço, e a expedição de {feudo} desceu sem perder uma corda.',
              success:
                'No {dia}º dia {daEstacao}, {heroi} achou o caminho pelas escoras do poço, e a expedição de {feudo} chegou ao fundo.',
              setback:
                'No {dia}º dia {daEstacao}, uma escora do poço cedeu perto de {heroi}, e a expedição de {feudo} chegou ao fundo sem fôlego e com metade da pedra.',
              disaster:
                'No {dia}º dia {daEstacao}, o poço desabou em parte sobre {heroi}, e a expedição de {feudo} chegou ao fundo quebrada.',
            },
          },
          rewards: { resources: { stone: { min: 20, max: 30 } } },
          next: 'galleries',
        },
        galleries: {
          kind: 'crossroads',
          title: 'Duas galerias',
          text: 'No fundo do poço, a mina se divide. Uma galeria desce, úmida, para onde os mineiros deixaram as picaretas; a outra corre de lado, seca e escorada.',
          options: [
            {
              id: 'deepVein',
              label: 'Descer ao veio fundo',
              hint: 'É lá embaixo que o ferro brilha na parede; dizem que o que mora no escuro arrasta quem desce para longe da luz.',
              next: 'lowerVein',
            },
            {
              id: 'sideGallery',
              label: 'Seguir a galeria escorada',
              hint: 'Menos ferro, e as escoras ainda seguram; quem tem braço para a picareta tira o que a parede dá.',
              next: 'sideDrift',
            },
            {
              id: 'climbOut',
              label: 'Subir com o que já têm',
              hint: 'Sem risco; volta só a pedra da descida.',
              next: 'home',
            },
          ],
          posture: { cautious: 'climbOut', balanced: 'sideGallery', bold: 'deepVein' },
        },
        lowerVein: {
          kind: 'boss',
          title: 'O que mora no veio fundo',
          durationMs: 60 * MINUTE_MS,
          trial: {
            difficulty: 96,
            xp: 40,
            onDisaster: 'capture',
            helps: 'warrior',
            outcomes: {
              full: 'No {dia}º dia {daEstacao}, {heroi} enfrentou o que morava no veio fundo e o fez recuar para o escuro. A expedição de {feudo} encheu os sacos de ferro.',
              success:
                'No {dia}º dia {daEstacao}, {heroi} segurou a coisa do veio fundo à distância da tocha, e a expedição de {feudo} arrancou o ferro da parede.',
              setback:
                'No {dia}º dia {daEstacao}, a coisa do veio fundo saiu do escuro contra {heroi}, e a expedição de {feudo} fugiu com metade do ferro.',
              disaster:
                'No {dia}º dia {daEstacao}, a coisa do veio fundo apagou as tochas e caiu sobre {heroi}: a expedição de {feudo} subiu às cegas, sem ferro nenhum.',
            },
          },
          rewards: { resources: { iron: { min: 70, max: 80 } } },
          next: 'home',
        },
        sideDrift: {
          kind: 'encounter',
          title: 'A galeria escorada',
          durationMs: 60 * MINUTE_MS,
          trial: {
            difficulty: 84,
            xp: 30,
            onDisaster: 'injury',
            helps: 'warrior',
            outcomes: {
              full: 'No {dia}º dia {daEstacao}, {heroi} abriu a parede da galeria escorada golpe a golpe, e a expedição de {feudo} achou um veio limpo.',
              success:
                'No {dia}º dia {daEstacao}, {heroi} trabalhou a parede da galeria escorada, e a expedição de {feudo} tirou o ferro que ela dava.',
              setback:
                'No {dia}º dia {daEstacao}, a parede da galeria escorada resistiu a {heroi}, e a expedição de {feudo} só tirou metade do ferro.',
              disaster:
                'No {dia}º dia {daEstacao}, uma escora da galeria caiu sobre {heroi}, e a expedição de {feudo} largou as picaretas e o ferro.',
            },
          },
          rewards: { resources: { iron: { min: 40, max: 50 } } },
          next: 'home',
        },
        home,
      },
    },
    {
      start: 'descent',
      nodes: {
        descent,
        shaft: {
          kind: 'encounter',
          title: 'Os ratos da rampa',
          durationMs: 60 * MINUTE_MS,
          trial: {
            difficulty: 80,
            xp: 20,
            onDisaster: 'injury',
            helps: 'warrior',
            outcomes: {
              full: 'No {dia}º dia {daEstacao}, {heroi} espantou os ratos da rampa a golpes de pá, e a expedição de {feudo} desceu com as tochas acesas.',
              success:
                'No {dia}º dia {daEstacao}, {heroi} abriu caminho entre os ratos da rampa, e a expedição de {feudo} chegou ao fundo.',
              setback:
                'No {dia}º dia {daEstacao}, os ratos da rampa subiram pelas pernas de {heroi}, e a expedição de {feudo} largou metade da pedra para fugir deles.',
              disaster:
                'No {dia}º dia {daEstacao}, os ratos da rampa apagaram as tochas em volta de {heroi}, e a expedição de {feudo} chegou ao fundo às cegas.',
            },
          },
          rewards: { resources: { stone: { min: 20, max: 30 } } },
          next: 'galleries',
        },
        galleries: {
          kind: 'crossroads',
          title: 'A água no fundo',
          text: 'No fundo da rampa a água cobre o chão. Uma galeria afunda nela, rumo ao som de pedra caindo; outra sobe por degraus cortados na rocha.',
          options: [
            {
              id: 'deepVein',
              label: 'Atravessar a galeria alagada',
              hint: 'Do outro lado da água está o veio que fez a fama da mina; a água esconde poços, e quem cai neles não sobe sozinho.',
              next: 'lowerVein',
            },
            {
              id: 'sideGallery',
              label: 'Subir pelos degraus de rocha',
              hint: 'Um veio menor, no seco; os degraus pedem olho atento para o lugar de cada pé, coisa de Arqueiro.',
              requires: { heroClass: 'archer' },
              next: 'sideDrift',
            },
            {
              id: 'climbOut',
              label: 'Subir com o que já têm',
              hint: 'Sem risco; volta só a pedra da descida.',
              next: 'home',
            },
          ],
          posture: { cautious: 'climbOut', balanced: 'sideGallery', bold: 'deepVein' },
        },
        lowerVein: {
          kind: 'hazard',
          title: 'A galeria alagada',
          durationMs: 60 * MINUTE_MS,
          trial: {
            difficulty: 102,
            xp: 40,
            weights: { will: { num: 1, den: 1 } },
            onDisaster: 'capture',
            helps: 'mage',
            lesson: 'Um Mago teria mantido a cabeça fria na água escura e achado o chão firme.',
            outcomes: {
              full: 'No {dia}º dia {daEstacao}, {heroi} guiou a expedição de {feudo} pela água escura sem um passo em falso, até o veio do outro lado.',
              success:
                'No {dia}º dia {daEstacao}, {heroi} atravessou a galeria alagada, e a expedição de {feudo} arrancou o ferro do veio molhado.',
              setback:
                'No {dia}º dia {daEstacao}, a água da galeria quase levou {heroi}, e a expedição de {feudo} voltou com metade do ferro.',
              disaster:
                'No {dia}º dia {daEstacao}, o chão sumiu sob {heroi} na galeria alagada, e a expedição de {feudo} saiu da água sem ferro nenhum.',
            },
          },
          rewards: { resources: { iron: { min: 70, max: 80 } } },
          next: 'home',
        },
        sideDrift: {
          kind: 'hazard',
          title: 'Os degraus de rocha',
          durationMs: 60 * MINUTE_MS,
          trial: {
            difficulty: 82,
            xp: 30,
            weights: { skill: { num: 1, den: 1 } },
            onDisaster: 'injury',
            helps: 'archer',
            outcomes: {
              full: 'No {dia}º dia {daEstacao}, {heroi} subiu os degraus de rocha sem um tropeço, e a expedição de {feudo} achou o veio seco no alto.',
              success:
                'No {dia}º dia {daEstacao}, {heroi} venceu os degraus de rocha, e a expedição de {feudo} tirou o ferro do veio seco.',
              setback:
                'No {dia}º dia {daEstacao}, um degrau de rocha se partiu sob {heroi}, e a expedição de {feudo} só tirou metade do ferro.',
              disaster:
                'No {dia}º dia {daEstacao}, os degraus de rocha derrubaram {heroi}, e a expedição de {feudo} desceu de volta sem ferro.',
            },
          },
          rewards: { resources: { iron: { min: 40, max: 50 } } },
          next: 'home',
        },
        home,
      },
    },
    {
      start: 'descent',
      nodes: {
        descent,
        shaft: {
          kind: 'discovery',
          title: 'O acampamento dos mineiros',
          durationMs: 60 * MINUTE_MS,
          trial: {
            difficulty: 76,
            xp: 20,
            weights: { will: { num: 1, den: 1 } },
            onDisaster: 'injury',
            helps: 'mage',
            lesson: 'Um Mago teria lido os sinais que os mineiros deixaram nas paredes.',
            outcomes: {
              full: 'No {dia}º dia {daEstacao}, {heroi} leu os sinais riscados no acampamento dos mineiros, e a expedição de {feudo} achou o mapa das galerias.',
              success:
                'No {dia}º dia {daEstacao}, {heroi} entendeu parte dos sinais do acampamento dos mineiros, e a expedição de {feudo} seguiu adiante.',
              setback:
                'No {dia}º dia {daEstacao}, os sinais do acampamento confundiram {heroi}, e a expedição de {feudo} rodou em círculos e largou metade da pedra.',
              disaster:
                'No {dia}º dia {daEstacao}, o teto do acampamento dos mineiros cedeu perto de {heroi}, e a expedição de {feudo} seguiu adiante aos pedaços.',
            },
          },
          rewards: { resources: { stone: { min: 20, max: 30 } } },
          next: 'galleries',
        },
        galleries: {
          kind: 'crossroads',
          title: 'O mapa riscado',
          text: 'O mapa dos mineiros marca dois veios. Um, fundo, tem uma cruz por cima; o outro, raso, fica atrás de uma porta de tábuas.',
          options: [
            {
              id: 'deepVein',
              label: 'Seguir até o veio marcado com a cruz',
              hint: 'O veio mais rico da mina; os mineiros marcaram a cruz por um motivo, e não voltaram para dizer qual.',
              next: 'lowerVein',
            },
            {
              id: 'sideGallery',
              label: 'Abrir a porta de tábuas',
              hint: 'Um veio raso; atrás da porta há barulho, e quem tem braço passa melhor.',
              next: 'sideDrift',
            },
            {
              id: 'climbOut',
              label: 'Subir com o que já têm',
              hint: 'Sem risco; volta só a pedra da descida.',
              next: 'home',
            },
          ],
          posture: { cautious: 'climbOut', balanced: 'sideGallery', bold: 'deepVein' },
        },
        lowerVein: {
          kind: 'boss',
          title: 'O veio da cruz',
          durationMs: 60 * MINUTE_MS,
          trial: {
            difficulty: 97,
            xp: 40,
            onDisaster: 'capture',
            helps: 'warrior',
            outcomes: {
              full: 'No {dia}º dia {daEstacao}, {heroi} venceu o que guardava o veio da cruz, e a expedição de {feudo} arrancou o ferro mais puro da mina.',
              success:
                'No {dia}º dia {daEstacao}, {heroi} afastou o guardião do veio da cruz, e a expedição de {feudo} encheu os sacos de ferro.',
              setback:
                'No {dia}º dia {daEstacao}, o guardião do veio da cruz caiu sobre {heroi}, e a expedição de {feudo} escapou com metade do ferro.',
              disaster:
                'No {dia}º dia {daEstacao}, o guardião do veio da cruz levou {heroi} para o escuro, e a expedição de {feudo} subiu sem ferro nenhum.',
            },
          },
          rewards: { resources: { iron: { min: 70, max: 80 } } },
          next: 'home',
        },
        sideDrift: {
          kind: 'encounter',
          title: 'A porta de tábuas',
          durationMs: 60 * MINUTE_MS,
          trial: {
            difficulty: 86,
            xp: 30,
            onDisaster: 'injury',
            helps: 'warrior',
            outcomes: {
              full: 'No {dia}º dia {daEstacao}, {heroi} derrubou a porta de tábuas e pôs para correr o que se escondia atrás, e a expedição de {feudo} limpou o veio raso.',
              success:
                'No {dia}º dia {daEstacao}, {heroi} abriu a porta de tábuas, e a expedição de {feudo} tirou o ferro do veio raso.',
              setback:
                'No {dia}º dia {daEstacao}, o que estava atrás da porta de tábuas avançou sobre {heroi}, e a expedição de {feudo} só tirou metade do ferro.',
              disaster:
                'No {dia}º dia {daEstacao}, a porta de tábuas caiu sobre {heroi}, e a expedição de {feudo} fugiu sem o ferro.',
            },
          },
          rewards: { resources: { iron: { min: 40, max: 50 } } },
          next: 'home',
        },
        home,
      },
    },
  ],
};
