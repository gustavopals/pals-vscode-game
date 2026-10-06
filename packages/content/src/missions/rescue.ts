import type { ExpeditionModelDef, ExpeditionReturnNode } from '../expeditions';

/**
 * "Resgate" (GDD §9.3; ADR 0018, decisão 12): duas horas de jogo, dois heróis, risco alto. Só
 * aparece enquanto houver um herói em cativeiro, e devolve quem está lá há mais tempo. São dois
 * nós de prova (a chegada e o cativeiro) e o caminho de volta: é assim que o "2 nós" do ADR
 * coube em duas horas (pendências D-5 e D-16).
 *
 * Diante do cativeiro há três jeitos de entrar, **e os três soltam o cativo**: o cauteloso é o
 * mais fácil e não rende mais nada; o do meio traz também algum ouro; o ousado vai atrás do
 * cofre dos captores, e é demais para uma dupla de nível 1. **O cativeiro é o nó em que o
 * Desastre captura** (em Camponês, fere gravemente; em Rei de Ferro, mata): mandar gente fraca
 * buscar um cativo pode deixar dois lá.
 *
 * A ficha de cada grafo está em `docs/content-v0.3.md`. Rascunho que o autor não leu.
 */

const MINUTE_MS = 60_000;

const home: ExpeditionReturnNode = {
  kind: 'return',
  title: 'A fuga para casa',
  durationMs: 30 * MINUTE_MS,
  text: 'No {dia}º dia {daEstacao}, a expedição de resgate tomou o caminho de {feudo}, sem olhar para trás.',
};

export const rescue: ExpeditionModelDef = {
  id: 'rescue',
  label: 'Resgate',
  riskLabel: 'Alto',
  durationMs: 120 * MINUTE_MS,
  requires: { guildLevel: 1, teamMin: 2, teamMax: 2, minHeroLevel: 1, classes: [] },
  access: { kind: 'captive' },
  variants: [
    {
      start: 'captorsTrail',
      nodes: {
        captorsTrail: {
          kind: 'hazard',
          title: 'A trilha dos captores',
          durationMs: 45 * MINUTE_MS,
          trial: {
            difficulty: 90,
            xp: 30,
            weights: { skill: { num: 1, den: 1 } },
            onDisaster: 'injury',
            helps: 'archer',
            lesson: 'Um Arqueiro teria visto os laços armados na trilha.',
            outcomes: {
              full: 'No {dia}º dia {daEstacao}, {heroi} seguiu a trilha dos captores sem pisar em um laço, e a expedição de {feudo} chegou ao acampamento sem ser vista.',
              success:
                'No {dia}º dia {daEstacao}, {heroi} achou a trilha dos captores e levou a expedição de {feudo} até o acampamento deles.',
              setback:
                'No {dia}º dia {daEstacao}, {heroi} pisou em um laço dos captores: a expedição de {feudo} perdeu tempo e chegou com o acampamento alerta.',
              disaster:
                'No {dia}º dia {daEstacao}, a trilha dos captores era uma cilada, e {heroi} caiu nela: a expedição de {feudo} chegou ao acampamento ferida e anunciada.',
            },
          },
          next: 'campAtHill',
        },
        campAtHill: {
          kind: 'crossroads',
          title: 'O acampamento ao pé do morro',
          text: 'Os captores acampam ao pé de um morro. O cativo está amarrado a uma carroça; o cofre do bando fica na tenda do meio.',
          options: [
            {
              id: 'stormAtNoon',
              label: 'Atacar ao meio-dia e levar também o cofre',
              hint: 'O bando inteiro acordado e com a mão na lâmina; quem ganhar leva tudo.',
              next: 'noonFight',
            },
            {
              id: 'cutRopesAtNight',
              label: 'Entrar à noite e cortar as cordas',
              hint: 'Silêncio e mão leve; dá para soltar o cativo e encher os bolsos na saída.',
              next: 'nightRopes',
            },
            {
              id: 'waitForGuardChange',
              label: 'Esperar a troca da guarda',
              hint: 'O momento mais seguro para chegar à carroça; não sobra tempo para mais nada.',
              next: 'guardChange',
            },
          ],
          posture: {
            cautious: 'waitForGuardChange',
            balanced: 'cutRopesAtNight',
            bold: 'stormAtNoon',
          },
        },
        noonFight: {
          kind: 'boss',
          title: 'O bando ao meio-dia',
          durationMs: 45 * MINUTE_MS,
          trial: {
            difficulty: 96,
            xp: 50,
            onDisaster: 'capture',
            helps: 'warrior',
            lesson: 'Um Guerreiro teria segurado o bando enquanto as cordas eram cortadas.',
            outcomes: {
              full: 'No {dia}º dia {daEstacao}, {heroi} rompeu o bando ao meio-dia, de frente. Os captores largaram o cativo e o cofre para salvar a pele.',
              success:
                'No {dia}º dia {daEstacao}, {heroi} abriu caminho até a carroça em pleno dia, e a expedição de {feudo} saiu do acampamento com o cativo e o cofre.',
              setback:
                'No {dia}º dia {daEstacao}, o bando fechou em volta de {heroi} antes da carroça: a expedição de {feudo} recuou com o que agarrou, e o cativo ficou.',
              disaster:
                'No {dia}º dia {daEstacao}, o bando fechou sobre {heroi} no meio do acampamento: a expedição de {feudo} foi desbaratada, e o cativo ficou onde estava.',
            },
          },
          rewards: {
            resources: { gold: { min: 60, max: 90 } },
            item: {
              chance: { num: 1, den: 2 },
              from: ['ashBow', 'boiledLeather', 'trackerHorn'],
            },
            rescues: true,
          },
          next: 'home',
        },
        nightRopes: {
          kind: 'boss',
          title: 'As cordas no escuro',
          durationMs: 45 * MINUTE_MS,
          trial: {
            difficulty: 96,
            xp: 45,
            weights: { skill: { num: 1, den: 1 } },
            onDisaster: 'capture',
            helps: 'archer',
            lesson: 'Um Arqueiro teria chegado à carroça sem acordar ninguém.',
            outcomes: {
              full: 'No {dia}º dia {daEstacao}, {heroi} cortou as cordas no escuro sem um estalo, e a expedição de {feudo} ainda esvaziou os alforjes do bando antes de sumir.',
              success:
                'No {dia}º dia {daEstacao}, {heroi} cortou as cordas no escuro, e a expedição de {feudo} deixou o acampamento com o cativo.',
              setback:
                'No {dia}º dia {daEstacao}, um cão latiu quando {heroi} tocou a carroça: a expedição de {feudo} fugiu no escuro, e o cativo ficou amarrado.',
              disaster:
                'No {dia}º dia {daEstacao}, o acampamento acordou em cima de {heroi}: a expedição de {feudo} foi desbaratada no escuro, e o cativo ficou amarrado.',
            },
          },
          rewards: { resources: { gold: { min: 20, max: 40 } }, rescues: true },
          next: 'home',
        },
        guardChange: {
          kind: 'encounter',
          title: 'A troca da guarda',
          durationMs: 45 * MINUTE_MS,
          trial: {
            difficulty: 78,
            xp: 40,
            weights: { skill: { num: 1, den: 2 } },
            onDisaster: 'capture',
            helps: 'warrior',
            lesson: 'Um Guerreiro teria calado a sentinela que sobrou.',
            outcomes: {
              full: 'No {dia}º dia {daEstacao}, {heroi} chegou à carroça na troca da guarda, e ninguém do bando deu pela falta do cativo antes do amanhecer.',
              success:
                'No {dia}º dia {daEstacao}, {heroi} aproveitou a troca da guarda, e a expedição de {feudo} levou o cativo pelo lado do morro.',
              setback:
                'No {dia}º dia {daEstacao}, a guarda trocou mais cedo do que {heroi} contava: a expedição de {feudo} teve de largar a carroça e correr.',
              disaster:
                'No {dia}º dia {daEstacao}, as duas guardas pegaram {heroi} entre elas: a expedição de {feudo} foi desbaratada, e a carroça continuou vigiada.',
            },
          },
          rewards: { rescues: true },
          next: 'home',
        },
        home,
      },
    },
    {
      start: 'watchedFord',
      nodes: {
        watchedFord: {
          kind: 'encounter',
          title: 'O vau vigiado',
          durationMs: 45 * MINUTE_MS,
          trial: {
            difficulty: 72,
            xp: 30,
            onDisaster: 'injury',
            helps: 'warrior',
            lesson:
              'Um Guerreiro teria atravessado o vau na frente, com as flechas batendo no escudo.',
            outcomes: {
              full: 'No {dia}º dia {daEstacao}, {heroi} tomou o vau vigiado antes que as sentinelas dessem o sinal, e a expedição de {feudo} atravessou sem deixar aviso.',
              success:
                'No {dia}º dia {daEstacao}, {heroi} forçou a passagem no vau vigiado, e a expedição de {feudo} seguiu para a torre.',
              setback:
                'No {dia}º dia {daEstacao}, as sentinelas do vau seguraram {heroi} o bastante para tocar a corneta: a torre soube que vinha gente.',
              disaster:
                'No {dia}º dia {daEstacao}, as sentinelas do vau derrubaram {heroi} na água, e a expedição de {feudo} atravessou ferida e esperada.',
            },
          },
          next: 'ruinedTower',
        },
        ruinedTower: {
          kind: 'crossroads',
          title: 'A torre em ruínas',
          text: 'O cativo está no alto de uma torre meio caída. A porta é de carvalho, a parede dos fundos está rachada, e há uma fresta ao nível do chão.',
          options: [
            {
              id: 'breakDoor',
              label: 'Arrombar a porta',
              hint: 'A guarda inteira atrás dela, com o soldo do bando; é serviço para quem aguenta pancada.',
              requires: { heroClass: 'warrior' },
              next: 'oakDoor',
            },
            {
              id: 'climbBackWall',
              label: 'Escalar a parede dos fundos',
              hint: 'Pedra solta e altura; lá em cima há só um carcereiro, e a bolsa dele.',
              next: 'backWall',
            },
            {
              id: 'passFileThroughGap',
              label: 'Passar a lima pela fresta e esperar',
              hint: 'Paciência e nervos, com a ronda passando ao lado; o cativo serra a própria saída, e é só o que se leva.',
              next: 'gap',
            },
          ],
          posture: {
            cautious: 'passFileThroughGap',
            balanced: 'climbBackWall',
            bold: 'breakDoor',
          },
        },
        oakDoor: {
          kind: 'boss',
          title: 'A guarda atrás da porta',
          durationMs: 45 * MINUTE_MS,
          trial: {
            difficulty: 96,
            xp: 50,
            onDisaster: 'capture',
            helps: 'warrior',
            lesson: 'Um Guerreiro teria sido o primeiro a passar pela porta.',
            outcomes: {
              full: 'No {dia}º dia {daEstacao}, {heroi} arrombou a porta da torre e varreu a guarda escada acima. O cativo desceu livre, e o soldo do bando desceu junto.',
              success:
                'No {dia}º dia {daEstacao}, {heroi} arrombou a porta da torre e venceu a guarda degrau a degrau, até a cela.',
              setback:
                'No {dia}º dia {daEstacao}, a guarda segurou {heroi} na escada da torre: a expedição de {feudo} saiu com o que achou embaixo, e a cela ficou trancada.',
              disaster:
                'No {dia}º dia {daEstacao}, a guarda da torre fechou a porta atrás de {heroi}: a expedição de {feudo} lutou só para sair, e a cela continuou trancada.',
            },
          },
          rewards: {
            resources: { gold: { min: 50, max: 80 } },
            item: {
              chance: { num: 1, den: 2 },
              from: ['ashBow', 'boiledLeather', 'paddedJerkin'],
            },
            rescues: true,
          },
          next: 'home',
        },
        backWall: {
          kind: 'boss',
          title: 'A parede dos fundos',
          durationMs: 45 * MINUTE_MS,
          trial: {
            difficulty: 104,
            xp: 45,
            weights: { skill: { num: 3, den: 2 } },
            onDisaster: 'capture',
            helps: 'archer',
            lesson: 'Um Arqueiro teria subido a parede e jogado a corda.',
            outcomes: {
              full: 'No {dia}º dia {daEstacao}, {heroi} escalou a parede dos fundos, rendeu o carcereiro dormindo e desceu com o cativo e com a bolsa dele.',
              success:
                'No {dia}º dia {daEstacao}, {heroi} escalou a parede dos fundos e desceu o cativo por uma corda.',
              setback:
                'No {dia}º dia {daEstacao}, uma pedra da parede cedeu sob {heroi}, e o barulho acordou a torre: a expedição de {feudo} largou a corda e correu.',
              disaster:
                'No {dia}º dia {daEstacao}, {heroi} caiu da parede dos fundos aos pés da ronda: a expedição de {feudo} foi desbaratada, e o cativo ficou no alto.',
            },
          },
          rewards: { resources: { gold: { min: 15, max: 30 } }, rescues: true },
          next: 'home',
        },
        gap: {
          kind: 'hazard',
          title: 'A fresta ao pé da torre',
          durationMs: 45 * MINUTE_MS,
          trial: {
            difficulty: 84,
            xp: 40,
            weights: { will: { num: 1, den: 1 } },
            onDisaster: 'capture',
            helps: 'mage',
            lesson: 'Um Mago teria esperado sem tremer, com a ronda a dois passos.',
            outcomes: {
              full: 'No {dia}º dia {daEstacao}, {heroi} passou a lima pela fresta e esperou imóvel, ronda após ronda. Antes do amanhecer o cativo estava do lado de fora.',
              success:
                'No {dia}º dia {daEstacao}, {heroi} passou a lima pela fresta, e o cativo serrou a própria saída.',
              setback:
                'No {dia}º dia {daEstacao}, {heroi} perdeu a calma com a ronda tão perto e se afastou da fresta: a lima não chegou ao cativo.',
              disaster:
                'No {dia}º dia {daEstacao}, a ronda deu com {heroi} junto à fresta: a expedição de {feudo} foi desbaratada, e a lima nunca chegou ao cativo.',
            },
          },
          rewards: { rescues: true },
          next: 'home',
        },
        home,
      },
    },
    {
      start: 'firelessNight',
      nodes: {
        firelessNight: {
          kind: 'camp',
          title: 'A noite sem fogo',
          durationMs: 45 * MINUTE_MS,
          trial: {
            difficulty: 78,
            xp: 30,
            weights: { will: { num: 3, den: 2 }, attack: { num: 1, den: 2 } },
            onDisaster: 'injury',
            helps: 'cleric',
            lesson: 'Um Clérigo teria feito a equipe aguentar o frio e o medo sem acender nada.',
            outcomes: {
              full: 'No {dia}º dia {daEstacao}, {heroi} manteve a expedição de {feudo} quieta e sem fogo a noite toda, a um grito do bando. Amanheceram perto, inteiros e sem serem vistos.',
              success:
                'No {dia}º dia {daEstacao}, {heroi} segurou o ânimo da expedição de {feudo} em uma noite sem fogo, à vista das fogueiras do bando.',
              setback:
                'No {dia}º dia {daEstacao}, o frio venceu {heroi}, que acendeu um fogo pequeno: o bando viu a luz e dobrou a guarda.',
              disaster:
                'No {dia}º dia {daEstacao}, a noite sem fogo quebrou {heroi}: a expedição de {feudo} amanheceu doente, cansada e com o bando à procura dela.',
            },
          },
          next: 'cage',
        },
        cage: {
          kind: 'crossroads',
          title: 'A gaiola no meio do acampamento',
          text: 'O cativo está em uma gaiola de madeira no meio do acampamento, entre as tendas e os cavalos. O chefe do bando bebe sentado em cima do cofre.',
          options: [
            {
              id: 'challengeChief',
              label: 'Desafiar o chefe do bando',
              hint: 'Um contra um, diante de todos, valendo o cativo e o cofre; só quem não conhece o medo propõe uma coisa dessas.',
              requires: { trait: 'brave' },
              next: 'duel',
            },
            {
              id: 'looseHorses',
              label: 'Soltar os cavalos e entrar na confusão',
              hint: 'Pernas e mão ligeira; na correria dá para abrir a gaiola e pegar o que estiver solto.',
              next: 'stampede',
            },
            {
              id: 'crawlByDitch',
              label: 'Rastejar pela vala até a gaiola',
              hint: 'Devagar e na lama, por baixo dos olhos do bando; o cativo, e nada além dele.',
              next: 'ditch',
            },
          ],
          posture: { cautious: 'crawlByDitch', balanced: 'looseHorses', bold: 'challengeChief' },
        },
        duel: {
          kind: 'boss',
          title: 'O duelo com o chefe do bando',
          durationMs: 45 * MINUTE_MS,
          trial: {
            difficulty: 92,
            xp: 50,
            onDisaster: 'capture',
            helps: 'warrior',
            lesson: 'Um Guerreiro teria aguentado os golpes do chefe até ele cansar.',
            outcomes: {
              full: 'No {dia}º dia {daEstacao}, {heroi} venceu o chefe do bando diante de todos. Ninguém ousou negar o trato: a gaiola foi aberta, e o cofre mudou de dono.',
              success:
                'No {dia}º dia {daEstacao}, {heroi} derrubou o chefe do bando no duelo, e o bando cumpriu a palavra dele a contragosto.',
              setback:
                'No {dia}º dia {daEstacao}, o duelo entre {heroi} e o chefe do bando acabou sem vencedor: a expedição de {feudo} saiu viva, com o que lhe atiraram, e sem o cativo.',
              disaster:
                'No {dia}º dia {daEstacao}, {heroi} perdeu o duelo com o chefe do bando, e o bando cobrou a aposta na hora: a expedição de {feudo} foi desbaratada, e a gaiola continuou fechada.',
            },
          },
          rewards: {
            resources: { gold: { min: 70, max: 100 } },
            item: {
              chance: { num: 1, den: 2 },
              from: ['ashBow', 'boiledLeather', 'trackerHorn'],
            },
            rescues: true,
          },
          next: 'home',
        },
        stampede: {
          kind: 'boss',
          title: 'Os cavalos soltos',
          durationMs: 45 * MINUTE_MS,
          trial: {
            difficulty: 106,
            xp: 45,
            weights: { speed: { num: 1, den: 1 }, skill: { num: 1, den: 2 } },
            onDisaster: 'capture',
            helps: 'archer',
            lesson: 'Um Arqueiro teria chegado à gaiola antes de a poeira baixar.',
            outcomes: {
              full: 'No {dia}º dia {daEstacao}, {heroi} soltou os cavalos e atravessou o acampamento na poeira: abriu a gaiola, e ainda catou o que o bando largou na correria.',
              success:
                'No {dia}º dia {daEstacao}, {heroi} abriu a gaiola no meio da confusão dos cavalos, e a expedição de {feudo} sumiu com o cativo.',
              setback:
                'No {dia}º dia {daEstacao}, os cavalos correram para o lado errado, e {heroi} ficou à vista: a expedição de {feudo} fugiu com o que pegou, e a gaiola ficou fechada.',
              disaster:
                'No {dia}º dia {daEstacao}, a poeira dos cavalos baixou cedo demais, com {heroi} no meio do acampamento: a expedição de {feudo} foi desbaratada, e a gaiola continuou fechada.',
            },
          },
          rewards: { resources: { gold: { min: 20, max: 35 } }, rescues: true },
          next: 'home',
        },
        ditch: {
          kind: 'hazard',
          title: 'A vala até a gaiola',
          durationMs: 45 * MINUTE_MS,
          trial: {
            difficulty: 80,
            xp: 40,
            weights: { skill: { num: 1, den: 2 } },
            onDisaster: 'capture',
            helps: 'warrior',
            lesson: 'Um Guerreiro teria arrancado as travas da gaiola sem ferramenta.',
            outcomes: {
              full: 'No {dia}º dia {daEstacao}, {heroi} rastejou pela vala até a gaiola e tirou as travas uma a uma. O bando só achou a gaiola vazia.',
              success:
                'No {dia}º dia {daEstacao}, {heroi} chegou à gaiola pela vala, e a expedição de {feudo} voltou por ela com o cativo.',
              setback:
                'No {dia}º dia {daEstacao}, {heroi} atolou na vala a poucos passos da gaiola, e a expedição de {feudo} teve de voltar antes da ronda.',
              disaster:
                'No {dia}º dia {daEstacao}, a ronda olhou para a vala na hora errada e deu com {heroi}: a expedição de {feudo} foi desbaratada, e a gaiola continuou fechada.',
            },
          },
          rewards: { rescues: true },
          next: 'home',
        },
        home,
      },
    },
  ],
};
