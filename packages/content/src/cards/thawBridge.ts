import type { CouncilCard } from '../council';

/**
 * Cadeia "A Ponte do Degelo" (roadmap da v0.2, §12.2): três cartas sobre refazer a travessia do
 * riacho. Gastar madeira, pagar gente de fora ou adiar; no meio da obra, fazer direito (pedra),
 * fazer barato (uma pinguela) ou largar; no fim, inaugurar a travessia com festa ou sem ela.
 *
 * Só a primeira é sorteada, na primavera e no verão. Não há mapa, rota nem produção nova: a
 * ponte existe na história, e o que ela rende é o que as cartas dizem.
 *
 * Flags: `thawBridge.open` marca a cadeia em curso; `timber` e `hired` dizem quem começou a
 * obra, e saem no desfecho. As duas que ficam contam o que foi construído e atravessam os anos:
 * com `thawBridge.piers` (a ponte de pedra) a primeira carta nunca mais volta; com
 * `thawBridge.plank` (a pinguela) ela volta no ano seguinte, e o texto lembra que a pinguela
 * não resistiu.
 */

export const thawBridgePlea: CouncilCard = {
  id: 'thawBridgePlea',
  title: 'A ponte que o degelo levou',
  text: 'O degelo engrossou o riacho e levou o tabuleiro da ponte velha. Desde então os lavradores dão a volta pelo vau, com água pelo joelho e a carroça vazia. Pedem madeira para refazer a travessia.',
  weight: 4,
  requires: {
    seasons: ['spring', 'summer'],
    notFlags: ['thawBridge.open', 'thawBridge.piers'],
  },
  variants: [
    {
      flag: 'thawBridge.plank',
      text: 'A pinguela não resistiu às águas do degelo. Desde então os lavradores dão a volta pelo vau, com água pelo joelho e a carroça vazia. Pedem madeira para uma travessia que dure mais que um inverno.',
      arrival:
        'No {dia}º dia {daEstacao}, soube-se em {feudo} que o riacho levou a pinguela, e o conselho voltou ao assunto: {carta}.',
    },
  ],
  autoResolve: { peasant: 'postpone', lord: 'postpone', ironKing: 'postpone' },
  options: [
    {
      id: 'timber',
      label: 'Ceder as vigas',
      cost: { wood: 40 },
      effects: [
        { type: 'morale', amount: 5, durationDays: 3 },
        { type: 'setFlag', flag: 'thawBridge.open' },
        { type: 'setFlag', flag: 'thawBridge.timber' },
        { type: 'scheduleCard', cardId: 'thawBridgeSlab', afterDays: 2 },
      ],
      hint: 'A obra começa. O riacho ainda tem o que dizer.',
      chronicle:
        'No {dia}º dia {daEstacao}, o senhor de {feudo} cedeu vigas das obras para a ponte do riacho. Os lavradores as levaram no ombro até a margem.',
    },
    {
      id: 'hire',
      label: 'Pagar carpinteiros de fora',
      cost: { gold: 40 },
      effects: [
        { type: 'morale', amount: 5, durationDays: 3 },
        { type: 'setFlag', flag: 'thawBridge.open' },
        { type: 'setFlag', flag: 'thawBridge.hired' },
        { type: 'scheduleCard', cardId: 'thawBridgeSlab', afterDays: 2 },
      ],
      hint: 'Gente de fora traz a própria madeira e cobra à vista. O riacho ainda tem o que dizer.',
      chronicle:
        'No {dia}º dia {daEstacao}, o senhor de {feudo} pagou carpinteiros de fora para refazer a ponte do riacho. Vieram com vigas, cordas e pressa.',
    },
    {
      id: 'postpone',
      label: 'Adiar a obra',
      effects: [],
      hint: 'Nada se gasta. Os lavradores seguem pelo vau, e a ponte espera outro degelo.',
      chronicle:
        'No {dia}º dia {daEstacao}, o senhor de {feudo} deixou a ponte para depois. Os lavradores seguiram pelo vau.',
      expiredChronicle:
        'No {dia}º dia {daEstacao}, o conselho de {feudo} esperou em vão pelo senhor, e a ponte ficou para depois. Os lavradores seguiram pelo vau.',
    },
  ],
};

export const thawBridgeSlab: CouncilCard = {
  id: 'thawBridgeSlab',
  title: 'A laje no leito do riacho',
  text: 'A obra da ponte parou no meio do riacho. Sob a lama do leito há uma laje que não deixa cravar as estacas. O mestre de obras vê dois caminhos, e o povo já fala em um terceiro.',
  weight: 0,
  variants: [
    {
      flag: 'thawBridge.timber',
      text: 'As vigas que o senhor cedeu chegaram ao meio do riacho, e ali a obra parou. Sob a lama do leito há uma laje que não deixa cravar as estacas. O mestre de obras vê dois caminhos, e o povo já fala em um terceiro.',
      arrival:
        'No {dia}º dia {daEstacao}, as vigas cedidas pelo senhor de {feudo} pararam no meio do riacho, e o conselho voltou ao assunto: {carta}.',
    },
    {
      flag: 'thawBridge.hired',
      text: 'Os carpinteiros pagos pelo senhor avançaram até o meio do riacho, e ali a obra parou. Sob a lama do leito há uma laje que não deixa cravar as estacas. O mestre de obras vê dois caminhos, e o povo já fala em um terceiro.',
      arrival:
        'No {dia}º dia {daEstacao}, os carpinteiros pagos pelo senhor de {feudo} pararam no meio do riacho, e o conselho voltou ao assunto: {carta}.',
    },
  ],
  autoResolve: { peasant: 'plank', lord: 'plank', ironKing: 'abandon' },
  options: [
    {
      id: 'piers',
      label: 'Assentar pilares de pedra',
      cost: { stone: 30 },
      effects: [
        { type: 'setFlag', flag: 'thawBridge.piers' },
        { type: 'clearFlag', flag: 'thawBridge.plank' },
        { type: 'scheduleCard', cardId: 'thawBridgeCrossing', afterDays: 2 },
      ],
      hint: 'Ponte de pedra aguenta carroça carregada, e mais de um degelo.',
      hidden: {
        afterDays: 4,
        effects: [{ type: 'resources', amounts: { food: 90 } }],
        // A carta do desfecho chega 2 dias depois da escolha e pode esperar na mesa 24 h reais:
        // este efeito cai com ela ainda sem resposta, e nenhuma das duas frases diz qual
        // travessia foi a primeira.
        chronicle:
          'No {dia}º dia {daEstacao}, o grão do campo de lá começou a chegar a {feudo} pela ponte de pedra, carroça após carroça.',
      },
      chronicle:
        'No {dia}º dia {daEstacao}, o senhor de {feudo} mandou assentar pilares de pedra sobre a laje do riacho. A ponte há de ver muitos degelos.',
    },
    {
      id: 'plank',
      label: 'Estender uma pinguela',
      effects: [
        { type: 'setFlag', flag: 'thawBridge.plank' },
        { type: 'scheduleCard', cardId: 'thawBridgeCrossing', afterDays: 2 },
      ],
      hint: 'Passa gente em fila; carroça, não. O próximo degelo dirá se ela fica.',
      chronicle:
        'No {dia}º dia {daEstacao}, o senhor de {feudo} mandou contornar a laje com uma pinguela. Mais barata que a ponte, e mais estreita.',
      expiredChronicle:
        'No {dia}º dia {daEstacao}, sem palavra do senhor, o mestre de obras de {feudo} contornou a laje com uma pinguela. Mais barata que a ponte, e mais estreita.',
    },
    {
      id: 'abandon',
      label: 'Largar a obra',
      effects: [
        { type: 'resources', amounts: { wood: 30 } },
        { type: 'morale', amount: -5, durationDays: 2 },
        { type: 'clearFlag', flag: 'thawBridge.open' },
        { type: 'clearFlag', flag: 'thawBridge.timber' },
        { type: 'clearFlag', flag: 'thawBridge.hired' },
      ],
      hint: 'Recolhe-se a madeira que der, e o povo volta ao vau.',
      chronicle:
        'No {dia}º dia {daEstacao}, o senhor de {feudo} mandou largar a obra da ponte. Recolheu-se a madeira; os lavradores voltaram ao vau.',
      expiredChronicle:
        'No {dia}º dia {daEstacao}, sem palavra do senhor, o conselho de {feudo} largou a obra da ponte. Recolheu-se a madeira; os lavradores voltaram ao vau.',
    },
  ],
};

/**
 * O desfecho. As duas opções apagam o que a obra gravou no caminho; `piers` e `plank` ficam,
 * porque dizem que travessia o feudo tem.
 */
export const thawBridgeCrossing: CouncilCard = {
  id: 'thawBridgeCrossing',
  title: 'A passagem volta a servir',
  text: 'A travessia do riacho está pronta, e o povo já passa por ela. Falta saber se haverá festa. O conselho pergunta como o senhor quer inaugurá-la.',
  weight: 0,
  variants: [
    {
      flag: 'thawBridge.piers',
      text: 'Os pilares de pedra que o senhor mandou assentar seguram a ponte nova, e as carroças já a experimentam. O povo quer saber se a travessia terá festa. O conselho pergunta como o senhor quer inaugurá-la.',
      arrival:
        'No {dia}º dia {daEstacao}, a ponte de {feudo} ficou pronta sobre os pilares de pedra que o senhor mandou assentar: {carta}.',
    },
    {
      flag: 'thawBridge.plank',
      text: 'A pinguela ficou pronta: passa gente em fila, e carroça nenhuma. Os lavradores levam os sacos às costas e não reclamam em voz alta. O conselho pergunta como o senhor quer inaugurá-la.',
      arrival:
        'No {dia}º dia {daEstacao}, a pinguela de {feudo} ficou pronta, estreita como foi pedida: {carta}.',
    },
  ],
  autoResolve: { peasant: 'quiet', lord: 'quiet', ironKing: 'quiet' },
  options: [
    {
      id: 'feast',
      label: 'Inaugurar a travessia com festa',
      cost: { food: 40 },
      effects: [
        { type: 'morale', amount: 15, durationDays: 3 },
        { type: 'clearFlag', flag: 'thawBridge.open' },
        { type: 'clearFlag', flag: 'thawBridge.timber' },
        { type: 'clearFlag', flag: 'thawBridge.hired' },
      ],
      hint: 'Festa na travessia junta as duas margens, e a notícia segue pela estrada.',
      chronicle:
        'No {dia}º dia {daEstacao}, o senhor de {feudo} inaugurou a travessia do riacho com pão e música. Dançou-se nas duas margens.',
    },
    {
      id: 'quiet',
      label: 'Dispensar a cerimônia',
      effects: [
        { type: 'morale', amount: 5, durationDays: 2 },
        { type: 'clearFlag', flag: 'thawBridge.open' },
        { type: 'clearFlag', flag: 'thawBridge.timber' },
        { type: 'clearFlag', flag: 'thawBridge.hired' },
      ],
      hint: 'A travessia serve do mesmo jeito. Só não vira história.',
      chronicle:
        'No {dia}º dia {daEstacao}, a travessia do riacho de {feudo} seguiu servindo, sem festa nem discurso.',
      expiredChronicle:
        'No {dia}º dia {daEstacao}, sem palavra do senhor, o conselho de {feudo} deu a travessia do riacho por entregue, sem festa nem discurso.',
    },
  ],
};
