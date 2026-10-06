import type {
  ExpeditionItemDrop,
  ExpeditionModelDef,
  ExpeditionReturnNode,
  ExpeditionStageNode,
} from '../expeditions';

/**
 * "Ruínas de Vel'Thar" (GDD §9.3 e Apêndice C; ADR 0018, decisão 12): três horas de jogo,
 * quatro nós, dois ou três heróis de nível 2 ou mais, risco médio. Só aparece depois de uma
 * Patrulha a revelar. Rende pedra, ouro e, vencido o guardião, um item raro; do guardião em
 * diante revela o Pântano Nebuloso.
 *
 * **A primeira variante é o grafo do Apêndice C do GDD**, com o item raro no lugar da planta da
 * Capela: a escadaria desaba, e a equipe escolhe entre o Corredor das Inscrições (perícia), a
 * Galeria Inundada (pede um Guerreiro) e recuar. As outras duas mudam o caminho e o guardião: o
 * da cripta é de vontade (Mago), a sentinela sem rosto, de perícia (Arqueiro).
 *
 * As dificuldades do corredor (60) e da galeria (50) do Apêndice C não paravam ninguém de nível
 * 2: subiram para 110 e 72, e a escolha passou a depender da equipe (o corredor é de quem tem
 * Arqueiro ou vai em três; a galeria, de quem tem Guerreiro).
 *
 * **O guardião é o nó em que o Desastre captura.** Dois heróis de nível 2 chegam a ele sem
 * dificuldade e quase sempre saem com um Revés; três passam. Uma dupla sem Guerreiro nem
 * Arqueiro pode deixar alguém lá (pendência A-6: com o guardião em 90, como no exemplo do ADR,
 * ninguém nunca era capturado).
 *
 * A ficha de cada grafo está em `docs/content-v0.3.md`. Rascunho que o autor não leu.
 */

const MINUTE_MS = 60_000;

/** O que os três guardiões guardam: um item raro, sempre que vencidos. */
const guardianHoard: ExpeditionItemDrop = {
  chance: { num: 1, den: 1 },
  from: ['veltharBlade', 'riveredMail', 'travelerMedal'],
};

const home: ExpeditionReturnNode = {
  kind: 'return',
  title: 'A volta pela estrada dos mortos',
  durationMs: 45 * MINUTE_MS,
  text: "No {dia}º dia {daEstacao}, a expedição de {feudo} deixou as Ruínas de Vel'Thar.",
};

/** Recuar depois de um trecho que rendeu algo: o que a equipe já traz é pouco, e é dela. */
const retreatHint = 'Sem risco; o saque fica pequeno.';

const stoneGuardian: ExpeditionStageNode = {
  kind: 'boss',
  title: 'O guardião de pedra',
  durationMs: 45 * MINUTE_MS,
  trial: {
    difficulty: 92,
    xp: 60,
    onDisaster: 'capture',
    helps: 'warrior',
    lesson: 'Um Guerreiro teria aparado os golpes do guardião de pedra.',
    outcomes: {
      full: 'No {dia}º dia {daEstacao}, {heroi} quebrou o guardião de pedra pelo joelho, e ele não se levantou. A câmara atrás dele ficou aberta para a expedição de {feudo}.',
      success:
        'No {dia}º dia {daEstacao}, {heroi} segurou o guardião de pedra o bastante para a expedição de {feudo} esvaziar a câmara que ele guardava.',
      setback:
        'No {dia}º dia {daEstacao}, o guardião de pedra jogou {heroi} contra a parede: a expedição de {feudo} recuou com o que tinha nas mãos, sem chegar à câmara.',
      disaster:
        'No {dia}º dia {daEstacao}, o guardião de pedra derrubou {heroi}, e a porta da câmara desceu: a expedição de {feudo} foi desbaratada e fugiu das ruínas sem o tesouro.',
    },
  },
  rewards: {
    resources: { stone: { min: 70, max: 90 }, gold: { min: 50, max: 70 } },
    item: guardianHoard,
    reveals: 'swamp',
  },
  next: 'home',
};

export const ruins: ExpeditionModelDef = {
  id: 'ruins',
  label: "Ruínas de Vel'Thar",
  riskLabel: 'Médio',
  durationMs: 180 * MINUTE_MS,
  requires: { guildLevel: 1, teamMin: 2, teamMax: 3, minHeroLevel: 2, classes: [] },
  access: { kind: 'discovered' },
  variants: [
    {
      start: 'ruinsTrail',
      nodes: {
        ruinsTrail: {
          kind: 'travel',
          title: 'A trilha até as ruínas',
          durationMs: 45 * MINUTE_MS,
          text: "No {dia}º dia {daEstacao}, a expedição de {feudo} subiu a trilha até as Ruínas de Vel'Thar e desceu a escadaria da entrada.",
          next: 'stairway',
        },
        stairway: {
          kind: 'crossroads',
          title: 'A escadaria desaba',
          text: 'A escadaria desaba às costas da expedição. Adiante, um corredor de paredes escritas; à direita, uma galeria com água parada; e, entre os escombros, uma fresta por onde ainda se sai.',
          options: [
            {
              id: 'inscriptionsCorridor',
              label: 'Seguir pelo Corredor das Inscrições',
              hint: 'Armadilhas antigas, e nichos que ninguém abriu; quem tem perícia passa.',
              next: 'corridor',
            },
            {
              id: 'floodedGallery',
              label: 'Atravessar a Galeria Inundada',
              hint: 'Água até o peito e coisa que se mexe debaixo dela; é preciso quem vá na frente abrindo passagem.',
              requires: { heroClass: 'warrior' },
              next: 'gallery',
            },
            {
              id: 'retreat',
              // Até aqui a equipe não achou nada: a pista não promete saque (revisão, B6).
              label: 'Sair pela fresta',
              hint: 'Sem risco; voltam de mãos vazias.',
              next: 'home',
            },
          ],
          posture: {
            cautious: 'retreat',
            balanced: 'floodedGallery',
            bold: 'inscriptionsCorridor',
          },
        },
        corridor: {
          kind: 'hazard',
          title: 'O Corredor das Inscrições',
          durationMs: 45 * MINUTE_MS,
          trial: {
            difficulty: 110,
            xp: 40,
            weights: { skill: { num: 3, den: 2 } },
            onDisaster: 'injury',
            helps: 'archer',
            lesson: 'Um Arqueiro teria visto os fios esticados à altura do tornozelo.',
            outcomes: {
              full: 'No {dia}º dia {daEstacao}, {heroi} leu o Corredor das Inscrições laje por laje, e a expedição de {feudo} abriu os nichos sem disparar um dardo.',
              success:
                'No {dia}º dia {daEstacao}, {heroi} guiou a expedição de {feudo} pelo Corredor das Inscrições, desviando do que estalava.',
              setback:
                'No {dia}º dia {daEstacao}, {heroi} pisou na laje errada do Corredor das Inscrições: os dardos voaram, e metade dos nichos ficou fechada.',
              disaster:
                'No {dia}º dia {daEstacao}, o Corredor das Inscrições se fechou sobre {heroi}: a expedição de {feudo} passou, sangrando e sem abrir um nicho.',
            },
          },
          rewards: {
            resources: { stone: { min: 30, max: 50 }, gold: { min: 30, max: 50 } },
            item: {
              chance: { num: 1, den: 2 },
              from: ['veltharBlade', 'riveredMail', 'travelerMedal'],
            },
          },
          next: 'stoneGuardian',
        },
        gallery: {
          kind: 'encounter',
          title: 'A Galeria Inundada',
          durationMs: 45 * MINUTE_MS,
          trial: {
            difficulty: 72,
            xp: 35,
            onDisaster: 'injury',
            helps: 'warrior',
            outcomes: {
              full: 'No {dia}º dia {daEstacao}, {heroi} atravessou a Galeria Inundada na frente e matou o que se mexia debaixo da água. A expedição de {feudo} tirou do fundo pedra lavrada e moedas.',
              success:
                'No {dia}º dia {daEstacao}, {heroi} abriu passagem pela Galeria Inundada, e a expedição de {feudo} carregou o que achou nas bordas.',
              setback:
                'No {dia}º dia {daEstacao}, algo puxou {heroi} para o fundo da Galeria Inundada: a expedição de {feudo} atravessou, mas largou na água metade do que tirara da galeria.',
              disaster:
                'No {dia}º dia {daEstacao}, a Galeria Inundada quase ficou com {heroi}: a expedição de {feudo} chegou ao outro lado sem nada do que a galeria guardava.',
            },
          },
          rewards: { resources: { stone: { min: 50, max: 70 }, gold: { min: 30, max: 40 } } },
          next: 'stoneGuardian',
        },
        stoneGuardian,
        home,
      },
    },
    {
      start: 'fallenGate',
      nodes: {
        fallenGate: {
          kind: 'encounter',
          title: 'Os saqueadores no portão caído',
          durationMs: 45 * MINUTE_MS,
          trial: {
            difficulty: 70,
            xp: 35,
            onDisaster: 'injury',
            helps: 'warrior',
            lesson: 'Um Guerreiro teria feito os saqueadores cederem o portão.',
            outcomes: {
              full: 'No {dia}º dia {daEstacao}, {heroi} desbaratou os saqueadores do portão caído, e a expedição de {feudo} ficou com o que eles tinham cavado.',
              success:
                'No {dia}º dia {daEstacao}, {heroi} abriu passagem entre os saqueadores do portão caído.',
              setback:
                'No {dia}º dia {daEstacao}, os saqueadores do portão caído cercaram {heroi} e cobraram caro a passagem da expedição de {feudo}.',
              disaster:
                'No {dia}º dia {daEstacao}, os saqueadores do portão caído emboscaram {heroi}: a expedição de {feudo} passou deixando sangue e sem levar nada deles.',
            },
          },
          rewards: { resources: { stone: { min: 30, max: 50 } } },
          next: 'threeArches',
        },
        threeArches: {
          kind: 'crossroads',
          title: 'O pátio dos três arcos',
          text: 'O pátio tem três arcos. O primeiro desce a um ossário de onde vem um canto baixo; o segundo dá em um salão de lajes desiguais; o terceiro é o da entrada.',
          options: [
            {
              id: 'ossuary',
              label: 'Descer ao ossário',
              hint: 'Os mortos de lá não descansam, e guardam o que foi enterrado com eles; quem tem fé firme não se perde.',
              next: 'bones',
            },
            {
              id: 'falseFloorHall',
              label: 'Atravessar o salão das lajes falsas',
              hint: 'Chão que cede e pedra boa pelas paredes; quem tem perícia passa.',
              next: 'falseFloor',
            },
            {
              id: 'retreat',
              label: 'Recuar com o que têm',
              hint: retreatHint,
              next: 'home',
            },
          ],
          posture: { cautious: 'retreat', balanced: 'falseFloorHall', bold: 'ossuary' },
        },
        bones: {
          kind: 'hazard',
          title: 'O ossário que canta',
          durationMs: 45 * MINUTE_MS,
          trial: {
            difficulty: 104,
            xp: 40,
            weights: { will: { num: 3, den: 2 }, attack: { num: 1, den: 2 } },
            onDisaster: 'injury',
            helps: 'cleric',
            lesson: 'Um Clérigo teria calado o canto do ossário com uma prece.',
            outcomes: {
              full: 'No {dia}º dia {daEstacao}, {heroi} atravessou o ossário rezando mais alto do que os mortos cantavam, e a expedição de {feudo} recolheu o que fora enterrado com eles.',
              success:
                'No {dia}º dia {daEstacao}, {heroi} não deu ouvidos ao canto do ossário e levou a expedição de {feudo} até o outro lado.',
              setback:
                'No {dia}º dia {daEstacao}, o canto do ossário entrou na cabeça de {heroi}: a expedição de {feudo} andou em círculos e saiu com metade do achado.',
              disaster:
                'No {dia}º dia {daEstacao}, o canto do ossário levou {heroi} para o meio das ossadas, e a expedição de {feudo} deixou os túmulos fechados para ir buscar quem se perdia.',
            },
          },
          rewards: {
            resources: { stone: { min: 40, max: 60 }, gold: { min: 30, max: 50 } },
            item: {
              chance: { num: 1, den: 2 },
              from: ['veltharBlade', 'riveredMail', 'travelerMedal'],
            },
          },
          next: 'cryptGuardian',
        },
        falseFloor: {
          kind: 'hazard',
          title: 'O salão das lajes falsas',
          durationMs: 45 * MINUTE_MS,
          trial: {
            difficulty: 84,
            xp: 40,
            weights: { skill: { num: 1, den: 1 } },
            onDisaster: 'injury',
            helps: 'archer',
            lesson: 'Um Arqueiro teria testado cada laje antes de pôr o peso.',
            outcomes: {
              full: 'No {dia}º dia {daEstacao}, {heroi} marcou a giz as lajes firmes do salão, e a expedição de {feudo} tirou a pedra das paredes sem pressa.',
              success:
                'No {dia}º dia {daEstacao}, {heroi} levou a expedição de {feudo} pelo salão das lajes falsas, pisando onde o chão aguentava.',
              setback:
                'No {dia}º dia {daEstacao}, uma laje falsa se abriu sob {heroi}: a expedição de {feudo} perdeu no buraco metade da pedra do salão.',
              disaster:
                'No {dia}º dia {daEstacao}, o chão do salão cedeu inteiro sob {heroi}, e a pedra das paredes ficou onde estava.',
            },
          },
          rewards: { resources: { stone: { min: 40, max: 70 }, gold: { min: 20, max: 40 } } },
          next: 'cryptGuardian',
        },
        cryptGuardian: {
          kind: 'boss',
          title: 'O guardião da cripta',
          durationMs: 45 * MINUTE_MS,
          trial: {
            difficulty: 116,
            xp: 60,
            weights: { will: { num: 1, den: 1 } },
            onDisaster: 'capture',
            helps: 'mage',
            lesson: 'Um Mago teria quebrado o olhar do guardião da cripta.',
            outcomes: {
              full: 'No {dia}º dia {daEstacao}, {heroi} encarou o guardião da cripta até ele baixar os olhos e voltar ao túmulo. A expedição de {feudo} abriu a arca sem pressa.',
              success:
                'No {dia}º dia {daEstacao}, {heroi} resistiu ao olhar do guardião da cripta enquanto a expedição de {feudo} levava a arca.',
              setback:
                'No {dia}º dia {daEstacao}, o olhar do guardião da cripta paralisou {heroi}: a expedição de {feudo} saiu arrastando gente, com o que estava fora da arca.',
              disaster:
                'No {dia}º dia {daEstacao}, o olhar do guardião da cripta dobrou {heroi}, e a laje da cripta se fechou: a expedição de {feudo} foi desbaratada e fugiu sem a arca.',
            },
          },
          rewards: {
            resources: { stone: { min: 60, max: 80 }, gold: { min: 60, max: 80 } },
            item: guardianHoard,
            reveals: 'swamp',
          },
          next: 'home',
        },
        home,
      },
    },
    {
      start: 'deadRoad',
      nodes: {
        deadRoad: {
          kind: 'travel',
          title: 'A estrada dos mortos',
          durationMs: 45 * MINUTE_MS,
          text: "No {dia}º dia {daEstacao}, a expedição de {feudo} seguiu a estrada dos mortos até os muros de Vel'Thar e entrou pelo lado da torre.",
          next: 'cisternAndTower',
        },
        cisternAndTower: {
          kind: 'crossroads',
          title: 'A cisterna e a torre',
          text: 'No pátio há uma torre de porta selada, coberta de sinais, e a boca de uma cisterna seca. Pedra lavrada está espalhada pelo chão.',
          options: [
            {
              id: 'readSeals',
              label: 'Romper os selos da torre',
              hint: 'Os sinais da porta queimam quem não os entende; atrás deles, o que os senhores da cidade esconderam.',
              requires: { heroClass: 'mage' },
              next: 'seals',
            },
            {
              id: 'descendCistern',
              label: 'Descer à cisterna',
              hint: 'Escuro, e ninho de alguma coisa; há pedra boa e moeda perdida no fundo.',
              next: 'cistern',
            },
            {
              id: 'gatherCourtyard',
              label: 'Catar a pedra do pátio e voltar',
              hint: 'Sem risco; só a pedra que está à vista.',
              next: 'courtyard',
            },
          ],
          posture: { cautious: 'gatherCourtyard', balanced: 'descendCistern', bold: 'readSeals' },
        },
        seals: {
          kind: 'hazard',
          title: 'Os selos da torre',
          durationMs: 45 * MINUTE_MS,
          trial: {
            difficulty: 104,
            xp: 40,
            weights: { will: { num: 3, den: 2 } },
            onDisaster: 'injury',
            helps: 'mage',
            outcomes: {
              full: 'No {dia}º dia {daEstacao}, {heroi} desfez os selos da torre um a um, sem uma faísca, e a expedição de {feudo} achou a sala do tesouro intacta.',
              success:
                'No {dia}º dia {daEstacao}, {heroi} rompeu os selos da torre, e a expedição de {feudo} entrou.',
              setback:
                'No {dia}º dia {daEstacao}, um selo da torre estourou na mão de {heroi}: a porta abriu, e metade do que havia atrás dela virou cinza.',
              disaster:
                'No {dia}º dia {daEstacao}, os selos da torre queimaram {heroi} e fundiram a porta. A expedição de {feudo} não levou nada dali.',
            },
          },
          rewards: {
            resources: { gold: { min: 60, max: 90 } },
            item: {
              chance: { num: 1, den: 2 },
              from: ['veltharBlade', 'riveredMail', 'travelerMedal'],
            },
          },
          next: 'facelessSentinel',
        },
        cistern: {
          kind: 'encounter',
          title: 'O ninho na cisterna',
          durationMs: 45 * MINUTE_MS,
          trial: {
            difficulty: 64,
            xp: 35,
            onDisaster: 'injury',
            helps: 'warrior',
            lesson: 'Um Guerreiro teria descido primeiro e limpado o ninho.',
            outcomes: {
              full: 'No {dia}º dia {daEstacao}, {heroi} desceu à cisterna e acabou com o ninho antes que ele acordasse. A expedição de {feudo} subiu a pedra e as moedas do fundo.',
              success:
                'No {dia}º dia {daEstacao}, {heroi} manteve o ninho da cisterna encurralado enquanto a expedição de {feudo} carregava a pedra.',
              setback:
                'No {dia}º dia {daEstacao}, o ninho da cisterna acordou em cima de {heroi}: a expedição de {feudo} subiu a corda com metade do que a cisterna dava.',
              disaster:
                'No {dia}º dia {daEstacao}, o ninho da cisterna cobriu {heroi}, e a expedição de {feudo} deixou no fundo o que a cisterna dava, para puxar gente.',
            },
          },
          rewards: { resources: { stone: { min: 50, max: 70 }, gold: { min: 20, max: 30 } } },
          next: 'facelessSentinel',
        },
        courtyard: {
          kind: 'discovery',
          title: 'A pedra do pátio',
          durationMs: 45 * MINUTE_MS,
          text: 'No {dia}º dia {daEstacao}, a expedição de {feudo} catou a pedra lavrada do pátio das ruínas e não foi além.',
          rewards: { resources: { stone: { min: 20, max: 30 } } },
          next: 'home',
        },
        facelessSentinel: {
          kind: 'boss',
          title: 'A sentinela sem rosto',
          durationMs: 45 * MINUTE_MS,
          trial: {
            difficulty: 112,
            xp: 60,
            weights: { skill: { num: 1, den: 1 } },
            onDisaster: 'capture',
            helps: 'archer',
            lesson: 'Um Arqueiro teria acertado a junta do elmo, o único ponto fraco da sentinela.',
            outcomes: {
              full: 'No {dia}º dia {daEstacao}, {heroi} acertou a junta do elmo da sentinela sem rosto, e ela desabou em peças. A expedição de {feudo} levou o que ela guardava havia séculos.',
              success:
                'No {dia}º dia {daEstacao}, {heroi} achou o ponto fraco da sentinela sem rosto, e a expedição de {feudo} passou por cima dela até o cofre.',
              setback:
                'No {dia}º dia {daEstacao}, a sentinela sem rosto foi mais rápida do que {heroi}: a expedição de {feudo} recuou com o que estava no chão, sem tocar no cofre.',
              disaster:
                'No {dia}º dia {daEstacao}, a sentinela sem rosto derrubou {heroi} e trancou a passagem: a expedição de {feudo} foi desbaratada e fugiu sem o cofre.',
            },
          },
          rewards: {
            resources: { stone: { min: 60, max: 80 }, gold: { min: 60, max: 80 } },
            item: guardianHoard,
            reveals: 'swamp',
          },
          next: 'home',
        },
        home,
      },
    },
  ],
};
