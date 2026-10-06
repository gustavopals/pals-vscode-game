import type { ExpeditionItemDrop, ExpeditionModelDef, ExpeditionReturnNode } from '../expeditions';

/**
 * "Pântano Nebuloso" (GDD §9.3; ADR 0018, decisão 12): cinco horas de jogo, cinco nós, três
 * heróis com um Mago entre eles, risco alto. Pede a Guilda dos Aventureiros no nível 3 e só
 * aparece depois de as Ruínas de Vel'Thar o revelarem. É o destino mais longe desta versão:
 * rende ouro e, vencido o que mora no fundo, um item épico (sem relíquia: é de outra versão).
 *
 * Cada variante tem duas provas antes da encruzilhada ou uma travessia e uma prova, a escolha,
 * mais uma prova e o chefe. **O chefe é o filtro**: três heróis de nível 1 chegam a ele em mais
 * da metade das vezes e o vencem em uma de cada três; com dois níveis a mais, em quatro de cada
 * cinco. **O caminho ousado tem um nó que captura** e está fora do alcance de quem acabou de
 * chegar; o chefe também captura.
 *
 * A ficha de cada grafo está em `docs/content-v0.3.md`. Rascunho que o autor não leu.
 */

const MINUTE_MS = 60_000;

/** O que os três chefes do pântano guardam: um item épico, sempre que vencidos. */
const swampHoard: ExpeditionItemDrop = {
  chance: { num: 1, den: 1 },
  from: ['emberStaff', 'wardenPlate', 'captainChain'],
};

const home: ExpeditionReturnNode = {
  kind: 'return',
  title: 'A volta pelas estacas',
  durationMs: 60 * MINUTE_MS,
  text: 'No {dia}º dia {daEstacao}, a expedição de {feudo} saiu do Pântano Nebuloso pela trilha de estacas, com lama até a cintura.',
};

export const swamp: ExpeditionModelDef = {
  id: 'swamp',
  label: 'Pântano Nebuloso',
  riskLabel: 'Alto',
  durationMs: 300 * MINUTE_MS,
  requires: { guildLevel: 3, teamMin: 3, teamMax: 3, minHeroLevel: 1, classes: ['mage'] },
  access: { kind: 'discovered' },
  variants: [
    {
      start: 'stakeTrail',
      nodes: {
        stakeTrail: {
          kind: 'travel',
          title: 'A trilha de estacas',
          durationMs: 60 * MINUTE_MS,
          text: 'No {dia}º dia {daEstacao}, a expedição de {feudo} entrou no Pântano Nebuloso pela trilha de estacas que os turfeiros deixaram.',
          next: 'mire',
        },
        mire: {
          kind: 'hazard',
          title: 'O atoleiro',
          durationMs: 60 * MINUTE_MS,
          trial: {
            difficulty: 130,
            xp: 45,
            weights: { skill: { num: 1, den: 1 } },
            onDisaster: 'injury',
            helps: 'archer',
            lesson: 'Um Arqueiro teria distinguido o chão firme da lama que engole.',
            outcomes: {
              full: 'No {dia}º dia {daEstacao}, {heroi} sondou o atoleiro com a vara, passo a passo, e a expedição de {feudo} atravessou sem molhar a carga.',
              success:
                'No {dia}º dia {daEstacao}, {heroi} achou a passagem do atoleiro, e a expedição de {feudo} atravessou com lama pelo joelho.',
              setback:
                'No {dia}º dia {daEstacao}, o atoleiro prendeu {heroi} até a cintura: a expedição de {feudo} perdeu horas e fôlego para sair dali.',
              disaster:
                'No {dia}º dia {daEstacao}, o atoleiro quase engoliu {heroi}, e a expedição de {feudo} saiu dele quebrada.',
            },
          },
          next: 'lights',
        },
        lights: {
          kind: 'crossroads',
          title: 'As luzes sobre a água',
          text: 'A névoa abre sobre um charco largo. Luzes azuis dançam no meio dele, em volta de uma ilha; pela margem, uma fila de salgueiros some na bruma.',
          options: [
            {
              id: 'crossOpenWater',
              label: 'Atravessar o charco, direto à ilha',
              hint: 'O caminho mais curto passa por onde as luzes moram; dizem que quem as segue não volta, e que a ilha está cheia do ouro dos que tentaram.',
              next: 'openWater',
            },
            {
              id: 'followWillows',
              label: 'Contornar pela margem dos salgueiros',
              hint: 'As luzes chamam de longe; quem tem a cabeça firme segue os salgueiros e não olha para o lado.',
              next: 'willows',
            },
            {
              id: 'retreat',
              label: 'Recuar com o que têm',
              hint: 'Sem risco; o pântano fica com os segredos dele.',
              next: 'home',
            },
          ],
          posture: { cautious: 'retreat', balanced: 'followWillows', bold: 'crossOpenWater' },
        },
        openWater: {
          kind: 'encounter',
          title: 'As luzes do charco',
          durationMs: 60 * MINUTE_MS,
          trial: {
            difficulty: 140,
            xp: 55,
            onDisaster: 'capture',
            helps: 'warrior',
            lesson: 'Um Guerreiro teria aberto caminho entre as coisas que as luzes escondem.',
            outcomes: {
              full: 'No {dia}º dia {daEstacao}, {heroi} atravessou o charco entre as luzes, golpeando o que subia da água. Na ilha, a expedição de {feudo} achou o ouro de todos os que não tinham chegado.',
              success:
                'No {dia}º dia {daEstacao}, {heroi} abriu caminho pelo charco, e a expedição de {feudo} alcançou a ilha das luzes.',
              setback:
                'No {dia}º dia {daEstacao}, as coisas do charco agarraram {heroi} pelas pernas: a expedição de {feudo} chegou à ilha com metade da gente de pé e pegou o que pôde.',
              disaster:
                'No {dia}º dia {daEstacao}, as luzes do charco fecharam em volta de {heroi}: a expedição de {feudo} foi desbaratada na água e não levou nada da ilha.',
            },
          },
          rewards: {
            resources: { gold: { min: 80, max: 120 } },
            item: {
              chance: { num: 1, den: 3 },
              from: ['veltharBlade', 'riveredMail', 'travelerMedal'],
            },
          },
          next: 'marshWitch',
        },
        willows: {
          kind: 'hazard',
          title: 'A margem dos salgueiros',
          durationMs: 60 * MINUTE_MS,
          trial: {
            difficulty: 132,
            xp: 50,
            weights: { will: { num: 1, den: 1 } },
            onDisaster: 'injury',
            helps: 'mage',
            lesson: 'Um Mago teria sabido que as luzes mentem.',
            outcomes: {
              full: 'No {dia}º dia {daEstacao}, {heroi} levou a expedição de {feudo} pela margem dos salgueiros sem que ninguém olhasse para as luzes, e ainda achou a canoa de um turfeiro, com a bolsa dentro.',
              success:
                'No {dia}º dia {daEstacao}, {heroi} manteve a expedição de {feudo} na margem dos salgueiros, de costas para as luzes.',
              setback:
                'No {dia}º dia {daEstacao}, {heroi} olhou para as luzes e deu três passos charco adentro: a expedição de {feudo} gastou a tarde para tirar gente da água.',
              disaster:
                'No {dia}º dia {daEstacao}, as luzes levaram {heroi} para longe dos salgueiros, e a expedição de {feudo} se perdeu na bruma atrás.',
            },
          },
          rewards: { resources: { gold: { min: 30, max: 50 } } },
          next: 'marshWitch',
        },
        marshWitch: {
          kind: 'boss',
          title: 'A bruxa do charco',
          durationMs: 60 * MINUTE_MS,
          trial: {
            difficulty: 170,
            xp: 80,
            weights: { will: { num: 3, den: 2 } },
            onDisaster: 'capture',
            helps: 'mage',
            lesson: 'Um Mago mais firme teria desfeito a névoa da bruxa.',
            outcomes: {
              full: 'No {dia}º dia {daEstacao}, {heroi} desfez a névoa da bruxa do charco palavra por palavra, e ela fugiu para o fundo. A cabana ficou para a expedição de {feudo}, com tudo o que havia nela.',
              success:
                'No {dia}º dia {daEstacao}, {heroi} resistiu à bruxa do charco até ela largar a cabana, e a expedição de {feudo} levou o que a velha guardava.',
              setback:
                'No {dia}º dia {daEstacao}, a névoa da bruxa do charco entrou nos olhos de {heroi}: a expedição de {feudo} saiu da cabana às cegas, com o que estava à mão.',
              disaster:
                'No {dia}º dia {daEstacao}, a bruxa do charco calou {heroi} com um gesto: a expedição de {feudo} foi desbaratada na névoa e deixou a cabana sem levar nada.',
            },
          },
          rewards: { resources: { gold: { min: 100, max: 150 } }, item: swampHoard },
          next: 'home',
        },
        home,
      },
    },
    {
      start: 'rottenRaft',
      nodes: {
        rottenRaft: {
          kind: 'hazard',
          title: 'A balsa podre',
          durationMs: 60 * MINUTE_MS,
          trial: {
            difficulty: 140,
            xp: 45,
            weights: { speed: { num: 1, den: 1 }, skill: { num: 1, den: 2 } },
            onDisaster: 'injury',
            helps: 'archer',
            lesson: 'Um Arqueiro teria pulado para a margem a tempo de segurar a corda.',
            outcomes: {
              full: 'No {dia}º dia {daEstacao}, {heroi} conduziu a balsa podre de margem a margem antes que ela se desfizesse, e a expedição de {feudo} entrou seca no pântano.',
              success:
                'No {dia}º dia {daEstacao}, {heroi} segurou a balsa podre inteira o bastante para a expedição de {feudo} atravessar.',
              setback:
                'No {dia}º dia {daEstacao}, a balsa podre se abriu sob {heroi} no meio do canal: a expedição de {feudo} chegou a nado, tossindo lodo.',
              disaster:
                'No {dia}º dia {daEstacao}, a balsa podre virou com {heroi}, e a expedição de {feudo} saiu do canal quebrada.',
            },
          },
          next: 'fever',
        },
        fever: {
          kind: 'camp',
          title: 'A noite da febre',
          durationMs: 60 * MINUTE_MS,
          trial: {
            difficulty: 120,
            xp: 45,
            weights: { will: { num: 3, den: 2 }, attack: { num: 1, den: 2 } },
            onDisaster: 'injury',
            helps: 'cleric',
            lesson: 'Um Clérigo teria baixado a febre antes do amanhecer.',
            outcomes: {
              full: 'No {dia}º dia {daEstacao}, {heroi} velou a expedição de {feudo} em uma noite de mosquitos e febre, e ao amanhecer todos estavam de pé.',
              success:
                'No {dia}º dia {daEstacao}, {heroi} cuidou dos febris no acampamento do pântano, e a expedição de {feudo} seguiu de manhã.',
              setback:
                'No {dia}º dia {daEstacao}, a febre do pântano pegou {heroi} junto com os outros: a expedição de {feudo} seguiu tremendo.',
              disaster:
                'No {dia}º dia {daEstacao}, a febre do pântano derrubou {heroi}, e a expedição de {feudo} amanheceu sem forças.',
            },
          },
          next: 'sunkenVillage',
        },
        sunkenVillage: {
          kind: 'crossroads',
          title: 'A aldeia afundada',
          text: 'Telhados saem da água parada: uma aldeia inteira afundou aqui. Do campanário vem um toque abafado, e na lama da margem há um rastro largo, de coisa arrastada.',
          options: [
            {
              id: 'followDragMarks',
              label: 'Seguir o rastro na lama',
              hint: 'Quem arrasta as redes dos pescadores guarda em algum lugar o que tira delas; só olho treinado não perde um rastro desses na água.',
              requires: { trait: 'tracker' },
              next: 'dragLair',
            },
            {
              id: 'diveForBell',
              label: 'Mergulhar até a capela do sino',
              hint: 'Fôlego e mão segura no escuro; o cofre das esmolas afundou com a capela.',
              next: 'chapel',
            },
            {
              id: 'retreat',
              label: 'Recuar com o que têm',
              hint: 'Sem risco; o pântano fica com os segredos dele.',
              next: 'home',
            },
          ],
          posture: { cautious: 'retreat', balanced: 'diveForBell', bold: 'followDragMarks' },
        },
        dragLair: {
          kind: 'encounter',
          title: 'A toca do que arrasta as redes',
          durationMs: 60 * MINUTE_MS,
          trial: {
            difficulty: 138,
            xp: 55,
            onDisaster: 'capture',
            helps: 'warrior',
            lesson: 'Um Guerreiro teria ficado entre a toca e a equipe.',
            outcomes: {
              full: 'No {dia}º dia {daEstacao}, {heroi} matou na própria toca o que arrastava as redes, e a expedição de {feudo} achou ali o que ele tirara dos pescadores em anos.',
              success:
                'No {dia}º dia {daEstacao}, {heroi} expulsou da toca o que arrastava as redes, e a expedição de {feudo} recolheu o que havia lá.',
              setback:
                'No {dia}º dia {daEstacao}, o que arrasta as redes puxou {heroi} para a água: a expedição de {feudo} largou metade do achado para puxar de volta.',
              disaster:
                'No {dia}º dia {daEstacao}, o que arrasta as redes enrolou {heroi} na própria rede: a expedição de {feudo} foi desbaratada e deixou a toca sem nada.',
            },
          },
          rewards: {
            resources: { gold: { min: 80, max: 120 } },
            item: {
              chance: { num: 1, den: 3 },
              from: ['veltharBlade', 'riveredMail', 'travelerMedal'],
            },
          },
          next: 'drownedOne',
        },
        chapel: {
          kind: 'hazard',
          title: 'A capela debaixo da água',
          durationMs: 60 * MINUTE_MS,
          trial: {
            difficulty: 128,
            xp: 50,
            weights: { skill: { num: 1, den: 1 } },
            onDisaster: 'injury',
            helps: 'archer',
            lesson: 'Um Arqueiro teria achado a porta da capela no escuro da água.',
            outcomes: {
              full: 'No {dia}º dia {daEstacao}, {heroi} mergulhou até a capela do sino e voltou com o cofre das esmolas inteiro, de um fôlego só.',
              success:
                'No {dia}º dia {daEstacao}, {heroi} achou a capela debaixo da água, e a expedição de {feudo} içou o cofre das esmolas.',
              setback:
                'No {dia}º dia {daEstacao}, {heroi} ficou sem fôlego dentro da capela afundada: o cofre abriu na subida, e metade das esmolas voltou ao lodo.',
              disaster:
                'No {dia}º dia {daEstacao}, {heroi} quase não voltou da capela afundada, e o cofre das esmolas ficou onde estava.',
            },
          },
          rewards: { resources: { gold: { min: 40, max: 60 } } },
          next: 'drownedOne',
        },
        drownedOne: {
          kind: 'boss',
          title: 'O afogado que anda',
          durationMs: 60 * MINUTE_MS,
          trial: {
            difficulty: 120,
            xp: 80,
            onDisaster: 'capture',
            helps: 'warrior',
            lesson: 'Um Guerreiro mais calejado teria aguentado o abraço do afogado.',
            outcomes: {
              full: 'No {dia}º dia {daEstacao}, {heroi} devolveu o afogado que anda ao fundo, de onde ele não devia ter saído. A casa do senhor da aldeia ficou aberta para a expedição de {feudo}.',
              success:
                'No {dia}º dia {daEstacao}, {heroi} segurou o afogado que anda enquanto a expedição de {feudo} tirava da casa grande o que ele guardava.',
              setback:
                'No {dia}º dia {daEstacao}, o afogado que anda não sentiu os golpes de {heroi}: a expedição de {feudo} recuou com o que estava à porta.',
              disaster:
                'No {dia}º dia {daEstacao}, o afogado que anda abraçou {heroi} e foi andando para a água: a expedição de {feudo} foi desbaratada e não levou nada.',
            },
          },
          rewards: { resources: { gold: { min: 100, max: 150 } }, item: swampHoard },
          next: 'home',
        },
        home,
      },
    },
    {
      start: 'oldDike',
      nodes: {
        oldDike: {
          kind: 'travel',
          title: 'O dique velho',
          durationMs: 60 * MINUTE_MS,
          text: 'No {dia}º dia {daEstacao}, a expedição de {feudo} entrou no Pântano Nebuloso por cima do dique velho, com água dos dois lados.',
          next: 'callingFog',
        },
        callingFog: {
          kind: 'hazard',
          title: 'O nevoeiro que chama pelo nome',
          durationMs: 60 * MINUTE_MS,
          trial: {
            difficulty: 128,
            xp: 45,
            weights: { will: { num: 1, den: 1 } },
            onDisaster: 'injury',
            helps: 'mage',
            lesson: 'Um Mago teria reconhecido que a voz do nevoeiro não era de gente.',
            outcomes: {
              full: 'No {dia}º dia {daEstacao}, {heroi} respondeu ao nevoeiro que chamava pelo nome, e foi o nevoeiro que se calou. A expedição de {feudo} seguiu pelo dique sem perder ninguém.',
              success:
                'No {dia}º dia {daEstacao}, {heroi} mandou a expedição de {feudo} tapar os ouvidos e atravessou o nevoeiro que chama pelo nome.',
              setback:
                'No {dia}º dia {daEstacao}, {heroi} ouviu o próprio nome no nevoeiro e saiu do dique: a expedição de {feudo} perdeu horas procurando.',
              disaster:
                'No {dia}º dia {daEstacao}, o nevoeiro chamou {heroi} pelo nome até o dique acabar debaixo dos pés, e a expedição de {feudo} saiu da água quebrada.',
            },
          },
          next: 'hangingTree',
        },
        hangingTree: {
          kind: 'crossroads',
          title: 'A árvore dos enforcados',
          text: 'No fim do dique há uma árvore morta, com cordas velhas nos galhos e oferendas entre as raízes. Um canal passa ao largo dela, estreito e escuro.',
          options: [
            {
              id: 'liftCurse',
              label: 'Desfazer a maldição da árvore',
              hint: 'As oferendas são de quem pediu e não foi atendido; quem souber rezar pelos enforcados leva o que eles deixaram.',
              requires: { heroClass: 'cleric' },
              next: 'curse',
            },
            {
              id: 'takeCanal',
              label: 'Passar ao largo, pelo canal',
              hint: 'Água pela cintura e coisa que morde; quem vai na frente abre o caminho.',
              next: 'canal',
            },
            {
              id: 'retreat',
              label: 'Recuar com o que têm',
              hint: 'Sem risco; o pântano fica com os segredos dele.',
              next: 'home',
            },
          ],
          posture: { cautious: 'retreat', balanced: 'takeCanal', bold: 'liftCurse' },
        },
        curse: {
          kind: 'hazard',
          title: 'A maldição dos enforcados',
          durationMs: 60 * MINUTE_MS,
          trial: {
            difficulty: 150,
            xp: 55,
            weights: { will: { num: 3, den: 2 }, attack: { num: 1, den: 2 } },
            onDisaster: 'capture',
            helps: 'cleric',
            lesson: 'Um Clérigo teria sabido o nome de cada enforcado.',
            outcomes: {
              full: 'No {dia}º dia {daEstacao}, {heroi} rezou pelos enforcados um a um, e as cordas caíram dos galhos. As oferendas entre as raízes ficaram para a expedição de {feudo}.',
              success:
                'No {dia}º dia {daEstacao}, {heroi} aquietou a árvore dos enforcados o bastante para a expedição de {feudo} recolher as oferendas.',
              setback:
                'No {dia}º dia {daEstacao}, a prece de {heroi} falhou na metade: a árvore dos enforcados acordou, e a expedição de {feudo} correu com o que tinha nas mãos.',
              disaster:
                'No {dia}º dia {daEstacao}, as cordas da árvore dos enforcados desceram sobre {heroi}: a expedição de {feudo} foi desbaratada e não tocou nas oferendas.',
            },
          },
          rewards: {
            resources: { gold: { min: 80, max: 120 } },
            item: {
              chance: { num: 1, den: 3 },
              from: ['veltharBlade', 'riveredMail', 'travelerMedal'],
            },
          },
          next: 'mudSerpent',
        },
        canal: {
          kind: 'encounter',
          title: 'O canal escuro',
          durationMs: 60 * MINUTE_MS,
          trial: {
            difficulty: 104,
            xp: 50,
            onDisaster: 'injury',
            helps: 'warrior',
            lesson: 'Um Guerreiro teria ido na frente, com a água pela cintura.',
            outcomes: {
              full: 'No {dia}º dia {daEstacao}, {heroi} foi na frente pelo canal escuro e matou o que mordia. No lodo do fundo, a expedição de {feudo} achou a bolsa de um afogado.',
              success:
                'No {dia}º dia {daEstacao}, {heroi} abriu o canal escuro para a expedição de {feudo}, a golpes na água.',
              setback:
                'No {dia}º dia {daEstacao}, algo mordeu {heroi} no canal escuro: a expedição de {feudo} saiu do outro lado mancando.',
              disaster:
                'No {dia}º dia {daEstacao}, o canal escuro ferveu em volta de {heroi}, e a expedição de {feudo} saiu dele quebrada.',
            },
          },
          rewards: { resources: { gold: { min: 30, max: 50 } } },
          next: 'mudSerpent',
        },
        mudSerpent: {
          kind: 'boss',
          title: 'A serpente do lodo',
          durationMs: 60 * MINUTE_MS,
          trial: {
            difficulty: 134,
            xp: 80,
            weights: { skill: { num: 1, den: 2 } },
            onDisaster: 'capture',
            helps: 'warrior',
            lesson: 'Um Guerreiro mais calejado teria segurado a cabeça da serpente.',
            outcomes: {
              full: 'No {dia}º dia {daEstacao}, {heroi} cravou a serpente do lodo no tronco em que ela se enrolava. No ninho, a expedição de {feudo} achou o que ela engolira com os viajantes.',
              success:
                'No {dia}º dia {daEstacao}, {heroi} feriu a serpente do lodo, e ela largou o ninho para a expedição de {feudo}.',
              setback:
                'No {dia}º dia {daEstacao}, a serpente do lodo enrolou {heroi} e só soltou a troco de sangue: a expedição de {feudo} levou o que estava na beira do ninho.',
              disaster:
                'No {dia}º dia {daEstacao}, a serpente do lodo arrastou {heroi} para dentro da água: a expedição de {feudo} foi desbaratada e fugiu sem nada.',
            },
          },
          rewards: { resources: { gold: { min: 100, max: 150 } }, item: swampHoard },
          next: 'home',
        },
        home,
      },
    },
  ],
};
