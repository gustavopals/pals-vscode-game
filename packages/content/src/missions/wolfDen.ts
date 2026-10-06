import type { ExpeditionModelDef, ExpeditionReturnNode } from '../expeditions';

/**
 * "Covil de Lobos" (GDD §9.3, onde a jornada se chama "Covil dos Lobos": aqui vale o nome do
 * tile, publicado na v0.2; revisão da Fase D, B8; ADR 0018, decisões 12 e 14): duas horas de jogo, três nós, dois
 * heróis, risco médio. Vencida a matilha, o tile de ameaça fica limpo até a virada do ano e a
 * Ameaça cai (`balance.threat.tileClearedDrop`). O destino é conhecido desde sempre, e só há o
 * que fazer lá enquanto o Covil estiver ativo.
 *
 * Cada variante sobe a serra por um lado e para diante da toca, com três jeitos de acabar o
 * serviço: **o do meio limpa o Covil** com pouco ouro; **o ousado** vai atrás do que os lobos
 * arrastaram para dentro, e é demais para uma dupla de nível 1; **o cauteloso** não limpa nada
 * (recua, ou só espalha a matilha). Uma dupla de nível 1 sofre um Revés em metade das vezes no
 * caminho do meio; com dois níveis a mais, passa quase sempre.
 *
 * A ficha de cada grafo está em `docs/content-v0.3.md`. Rascunho que o autor não leu.
 */

const MINUTE_MS = 60_000;

const home: ExpeditionReturnNode = {
  kind: 'return',
  title: 'A descida da serra',
  durationMs: 35 * MINUTE_MS,
  text: 'No {dia}º dia {daEstacao}, a expedição de {feudo} desceu a serra do Covil de Lobos.',
};

export const wolfDen: ExpeditionModelDef = {
  id: 'wolfDen',
  label: 'Covil de Lobos',
  riskLabel: 'Médio',
  durationMs: 120 * MINUTE_MS,
  requires: { guildLevel: 1, teamMin: 2, teamMax: 2, minHeroLevel: 1, classes: [] },
  access: { kind: 'tile', tileId: 'wolfDen' },
  variants: [
    {
      start: 'climb',
      nodes: {
        climb: {
          kind: 'hazard',
          title: 'A subida pela encosta de pedra solta',
          durationMs: 40 * MINUTE_MS,
          trial: {
            difficulty: 84,
            xp: 30,
            weights: { skill: { num: 1, den: 1 } },
            onDisaster: 'injury',
            helps: 'archer',
            lesson: 'Um Arqueiro teria visto de baixo qual pedra estava solta.',
            outcomes: {
              full: 'No {dia}º dia {daEstacao}, {heroi} achou o caminho firme na encosta de pedra solta, e a expedição de {feudo} chegou à toca sem que um lobo desse o alarme.',
              success:
                'No {dia}º dia {daEstacao}, {heroi} puxou a expedição de {feudo} encosta acima, até a boca da toca.',
              setback:
                'No {dia}º dia {daEstacao}, a pedra solta cedeu sob {heroi}: a expedição de {feudo} chegou à toca arranhada, e metade do que achara na subida rolou serra abaixo.',
              disaster:
                'No {dia}º dia {daEstacao}, a encosta rolou com {heroi}: a expedição de {feudo} chegou à toca sangrando, sem nada do que achara na subida.',
            },
          },
          rewards: { resources: { gold: { min: 10, max: 20 } } },
          next: 'mouth',
        },
        mouth: {
          kind: 'crossroads',
          title: 'A boca da toca',
          text: 'A toca abre na pedra, escura e funda. Há ossos na entrada, e entre eles brilha o que a matilha arrastou das estradas.',
          options: [
            {
              id: 'enterDen',
              label: 'Entrar na toca atrás do lobo velho',
              hint: 'O chefe da matilha está lá dentro, com tudo o que os lobos arrastaram; no escuro ganha quem aguenta o tranco, e dupla verde não aguenta.',
              next: 'oldWolf',
            },
            {
              id: 'smokeOut',
              label: 'Enfumaçar a toca e esperar na saída',
              hint: 'A matilha sai aos poucos e cega de fumaça; pouco ouro, e o Covil fica limpo.',
              next: 'smoke',
            },
            {
              id: 'retreat',
              label: 'Recuar com o que têm',
              hint: 'Sem risco; os lobos ficam onde estão.',
              next: 'home',
            },
          ],
          posture: { cautious: 'retreat', balanced: 'smokeOut', bold: 'enterDen' },
        },
        oldWolf: {
          kind: 'boss',
          title: 'O lobo velho no fundo da toca',
          durationMs: 45 * MINUTE_MS,
          trial: {
            difficulty: 90,
            xp: 45,
            onDisaster: 'injury',
            helps: 'warrior',
            lesson: 'Um Guerreiro teria fechado a passagem com o escudo.',
            outcomes: {
              full: 'No {dia}º dia {daEstacao}, {heroi} matou o lobo velho no fundo da toca. A matilha fugiu serra acima, e a expedição de {feudo} recolheu o que havia entre os ossos.',
              success:
                'No {dia}º dia {daEstacao}, {heroi} feriu o lobo velho, e a matilha deixou a toca para a expedição de {feudo}.',
              setback:
                'No {dia}º dia {daEstacao}, o lobo velho fez {heroi} recuar no escuro: a expedição de {feudo} saiu da toca com metade do achado e a matilha inteira.',
              disaster:
                'No {dia}º dia {daEstacao}, o lobo velho derrubou {heroi} no fundo da toca, e a expedição de {feudo} saiu de lá sem tocar no que havia entre os ossos.',
            },
          },
          rewards: {
            resources: { gold: { min: 50, max: 80 } },
            item: {
              chance: { num: 1, den: 2 },
              from: ['huntingSpear', 'paddedJerkin', 'trackerHorn'],
            },
            clearsTile: 'wolfDen',
          },
          next: 'home',
        },
        smoke: {
          kind: 'encounter',
          title: 'A matilha na fumaça',
          durationMs: 45 * MINUTE_MS,
          trial: {
            difficulty: 86,
            xp: 40,
            weights: { skill: { num: 1, den: 2 } },
            onDisaster: 'injury',
            helps: 'warrior',
            lesson: 'Um Guerreiro teria segurado a saída enquanto a fumaça fazia o resto.',
            outcomes: {
              full: 'No {dia}º dia {daEstacao}, {heroi} esperou na saída da toca enfumaçada, e nenhum lobo passou. O Covil ficou vazio.',
              success:
                'No {dia}º dia {daEstacao}, {heroi} segurou a saída da toca enfumaçada, e a matilha se desfez serra acima.',
              setback:
                'No {dia}º dia {daEstacao}, o vento virou a fumaça contra {heroi}, e a matilha saiu da toca inteira e furiosa.',
              disaster:
                'No {dia}º dia {daEstacao}, a matilha saiu da fumaça por cima de {heroi}, e a expedição de {feudo} desceu a serra sem nada da toca.',
            },
          },
          rewards: { resources: { gold: { min: 20, max: 35 } }, clearsTile: 'wolfDen' },
          next: 'home',
        },
        home,
      },
    },
    {
      start: 'gorge',
      nodes: {
        gorge: {
          kind: 'encounter',
          title: 'As sentinelas da garganta',
          durationMs: 40 * MINUTE_MS,
          trial: {
            difficulty: 70,
            xp: 30,
            onDisaster: 'injury',
            helps: 'warrior',
            lesson: 'Um Guerreiro teria calado as sentinelas antes do primeiro uivo.',
            outcomes: {
              full: 'No {dia}º dia {daEstacao}, {heroi} abateu as sentinelas da garganta antes do primeiro uivo, e a expedição de {feudo} subiu sem ser vista.',
              success:
                'No {dia}º dia {daEstacao}, {heroi} abriu passagem entre as sentinelas da garganta para a expedição de {feudo}.',
              setback:
                'No {dia}º dia {daEstacao}, uma sentinela mordeu fundo antes de cair diante de {heroi}: a expedição de {feudo} passou a garganta, e metade do que achou nela ficou para trás.',
              disaster:
                'No {dia}º dia {daEstacao}, as sentinelas da garganta cercaram {heroi}: a expedição de {feudo} só passou deixando sangue na pedra, e nada trouxe dali.',
            },
          },
          rewards: { resources: { gold: { min: 10, max: 20 } } },
          next: 'twoMouths',
        },
        twoMouths: {
          kind: 'crossroads',
          title: 'A toca de duas bocas',
          text: 'A toca tem duas bocas, uma de cada lado de um penedo. Do alto do penedo se vê a matilha inteira, junta diante da toca.',
          options: [
            {
              id: 'shootFromAbove',
              label: 'Flechar a matilha do alto do penedo',
              hint: 'Do alto se acerta de longe, enquanto a matilha não achar a subida; quem a vencer revira a toca com calma. Só serve a quem tem arqueiro.',
              requires: { heroClass: 'archer' },
              next: 'crag',
            },
            {
              id: 'blockAndEnter',
              label: 'Fechar uma boca com pedras e entrar pela outra',
              hint: 'Luta de perto, em lugar apertado; o Covil fica limpo.',
              next: 'narrowDen',
            },
            {
              id: 'burnBrush',
              label: 'Queimar o mato em volta e descer',
              hint: 'Sem dente de lobo por perto; a matilha se espalha, mas volta à toca.',
              next: 'brushfire',
            },
          ],
          posture: { cautious: 'burnBrush', balanced: 'blockAndEnter', bold: 'shootFromAbove' },
        },
        crag: {
          kind: 'boss',
          title: 'A matilha sob o penedo',
          durationMs: 45 * MINUTE_MS,
          trial: {
            difficulty: 104,
            xp: 45,
            weights: { skill: { num: 3, den: 2 } },
            onDisaster: 'injury',
            helps: 'archer',
            outcomes: {
              full: 'No {dia}º dia {daEstacao}, {heroi} derrubou do alto do penedo a loba que guiava a matilha. Os outros fugiram, e a expedição de {feudo} revirou a toca com calma.',
              success:
                'No {dia}º dia {daEstacao}, {heroi} flechou a matilha do alto do penedo até ela largar a toca.',
              setback:
                'No {dia}º dia {daEstacao}, a matilha achou o caminho do penedo antes de {heroi} acabar com as flechas: a expedição de {feudo} desceu às pressas, com metade do achado.',
              disaster:
                'No {dia}º dia {daEstacao}, a matilha subiu o penedo por trás de {heroi}, e a expedição de {feudo} saltou de lá sem pôr a mão na toca.',
            },
          },
          rewards: {
            resources: { gold: { min: 40, max: 70 } },
            item: {
              chance: { num: 1, den: 2 },
              from: ['ashBow', 'luckyCharm', 'trackerHorn'],
            },
            clearsTile: 'wolfDen',
          },
          next: 'home',
        },
        narrowDen: {
          kind: 'boss',
          title: 'A toca apertada',
          durationMs: 45 * MINUTE_MS,
          trial: {
            difficulty: 80,
            xp: 40,
            onDisaster: 'injury',
            helps: 'warrior',
            lesson: 'Um Guerreiro teria ido na frente, onde só cabe um.',
            outcomes: {
              full: 'No {dia}º dia {daEstacao}, {heroi} entrou na frente pela boca aberta e acabou com a matilha lobo a lobo. O Covil ficou em silêncio.',
              success:
                'No {dia}º dia {daEstacao}, {heroi} empurrou a matilha para o fundo da toca até ela se render à fome e à pedra.',
              setback:
                'No {dia}º dia {daEstacao}, os lobos derrubaram as pedras da outra boca enquanto {heroi} lutava: a matilha escapou, mordendo.',
              disaster:
                'No {dia}º dia {daEstacao}, a toca apertada virou contra {heroi}: sem espaço para o golpe, a expedição de {feudo} saiu de costas, sem nada da toca.',
            },
          },
          rewards: { resources: { gold: { min: 25, max: 40 } }, clearsTile: 'wolfDen' },
          next: 'home',
        },
        brushfire: {
          kind: 'hazard',
          title: 'O fogo no mato',
          durationMs: 45 * MINUTE_MS,
          trial: {
            difficulty: 60,
            xp: 20,
            weights: { skill: { num: 1, den: 2 } },
            onDisaster: 'injury',
            helps: 'warrior',
            lesson: 'Um Guerreiro teria aberto o aceiro mais depressa.',
            outcomes: {
              full: 'No {dia}º dia {daEstacao}, {heroi} pôs fogo no mato em volta da toca com o vento a favor. A matilha se espalhou, e ficou no chão o que ela guardava cá fora.',
              success:
                'No {dia}º dia {daEstacao}, {heroi} queimou o mato em volta da toca, e a matilha se espalhou pela serra.',
              setback:
                'No {dia}º dia {daEstacao}, o fogo correu para o lado de {heroi}, e a expedição de {feudo} desceu a serra tossindo.',
              disaster:
                'No {dia}º dia {daEstacao}, o fogo cercou {heroi}, e a expedição de {feudo} saiu do mato sem ver o que a matilha guardava cá fora.',
            },
          },
          rewards: { resources: { gold: { min: 10, max: 15 } } },
          next: 'home',
        },
        home,
      },
    },
    {
      start: 'nightCamp',
      nodes: {
        nightCamp: {
          kind: 'camp',
          title: 'A noite na serra',
          durationMs: 40 * MINUTE_MS,
          trial: {
            difficulty: 76,
            xp: 30,
            weights: { will: { num: 3, den: 2 }, attack: { num: 1, den: 2 } },
            onDisaster: 'injury',
            helps: 'cleric',
            lesson: 'Um Clérigo teria mantido o ânimo da equipe com os uivos em volta.',
            outcomes: {
              full: 'No {dia}º dia {daEstacao}, {heroi} manteve o fogo e a calma a noite inteira, com os uivos em volta. A expedição de {feudo} amanheceu descansada diante da toca.',
              success:
                'No {dia}º dia {daEstacao}, {heroi} ficou de vigia na serra, e a expedição de {feudo} dormiu o bastante para subir ao amanhecer.',
              setback:
                'No {dia}º dia {daEstacao}, os uivos tiraram o sono de {heroi} e de todos: a expedição de {feudo} subiu à toca cansada e de nervos à flor da pele.',
              disaster:
                'No {dia}º dia {daEstacao}, o medo venceu {heroi} no meio da noite: o fogo apagou, e os lobos provaram a expedição de {feudo} antes do amanhecer.',
            },
          },
          rewards: { resources: { gold: { min: 10, max: 20 } } },
          next: 'cubs',
        },
        cubs: {
          kind: 'crossroads',
          title: 'Os filhotes na toca',
          text: 'Do alto se vê a loba deitada à entrada, com os filhotes. O resto da matilha caça longe, e volta antes do meio-dia.',
          options: [
            {
              id: 'killSheWolf',
              label: 'Matar a loba antes que a matilha volte',
              hint: 'Uma loba com cria vale por três, e dupla verde não dá conta dela; lá dentro está tudo o que a matilha juntou.',
              next: 'sheWolf',
            },
            {
              id: 'driveAway',
              label: 'Espantar a matilha serra acima',
              hint: 'Gritos, tochas e sangue-frio quando ela voltar; pouco ouro, e o Covil fica limpo.',
              next: 'pack',
            },
            {
              id: 'retreat',
              label: 'Recuar com o que têm',
              hint: 'Sem risco; os lobos ficam onde estão.',
              next: 'home',
            },
          ],
          posture: { cautious: 'retreat', balanced: 'driveAway', bold: 'killSheWolf' },
        },
        sheWolf: {
          kind: 'boss',
          title: 'A loba e a cria',
          durationMs: 45 * MINUTE_MS,
          trial: {
            difficulty: 94,
            xp: 45,
            onDisaster: 'injury',
            helps: 'warrior',
            lesson: 'Um Guerreiro teria aguentado a primeira investida da loba.',
            outcomes: {
              full: 'No {dia}º dia {daEstacao}, {heroi} venceu a loba à entrada da toca antes de a matilha voltar. Sem ela, os lobos largaram a serra, e a expedição de {feudo} esvaziou a toca.',
              success:
                'No {dia}º dia {daEstacao}, {heroi} pôs a loba para correr com a cria na boca, e a matilha foi atrás dela.',
              setback:
                'No {dia}º dia {daEstacao}, a loba segurou {heroi} à entrada até a matilha voltar: a expedição de {feudo} fugiu com metade do que tinha pegado na toca.',
              disaster:
                'No {dia}º dia {daEstacao}, a loba derrubou {heroi} à entrada da toca, e a matilha chegou a tempo de acabar o serviço. Nada saiu de lá.',
            },
          },
          rewards: {
            resources: { gold: { min: 60, max: 90 } },
            item: {
              chance: { num: 1, den: 2 },
              from: ['huntingSpear', 'boiledLeather', 'luckyCharm'],
            },
            clearsTile: 'wolfDen',
          },
          next: 'home',
        },
        pack: {
          kind: 'encounter',
          title: 'A matilha de volta da caça',
          durationMs: 45 * MINUTE_MS,
          trial: {
            difficulty: 94,
            xp: 40,
            weights: { will: { num: 1, den: 1 } },
            onDisaster: 'injury',
            helps: 'mage',
            lesson: 'Um Mago teria feito o fogo falar mais alto do que os lobos.',
            outcomes: {
              full: 'No {dia}º dia {daEstacao}, {heroi} recebeu a matilha com fogo e voz, sem dar um passo atrás. Os lobos viraram serra acima e não olharam para trás.',
              success:
                'No {dia}º dia {daEstacao}, {heroi} não arredou pé diante da matilha, e ela trocou a toca pela serra alta.',
              setback:
                'No {dia}º dia {daEstacao}, {heroi} hesitou quando a matilha voltou, e os lobos perceberam: ficaram com a toca, e a expedição de {feudo}, com as mordidas.',
              disaster:
                'No {dia}º dia {daEstacao}, a matilha não teve medo de {heroi} nem das tochas, e a expedição de {feudo} desceu a serra correndo, sem nada da toca.',
            },
          },
          rewards: { resources: { gold: { min: 15, max: 25 } }, clearsTile: 'wolfDen' },
          next: 'home',
        },
        home,
      },
    },
  ],
};
