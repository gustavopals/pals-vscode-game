import type { CouncilCard } from '../council';

/**
 * Cadeia "O Celeiro Comum" (roadmap da v0.2, §12.2): três cartas sobre repartir agora ou guardar
 * margem para as obras e o inverno. Só a primeira é sorteada; as outras duas chegam como
 * continuação, e o texto de cada uma lembra a escolha que a trouxe.
 *
 * Flags: `commonGranary.open` marca a cadeia em curso (a primeira carta não volta enquanto ela
 * durar) e é apagada no desfecho, com as transitórias. Fica gravado só o desfecho.
 */

export const commonGranaryPlanks: CouncilCard = {
  id: 'commonGranaryPlanks',
  title: 'Tábuas para as reservas',
  text: 'As prateleiras do celeiro cederam com a última carga. Os moradores propõem refazê-las antes que a próxima colheita chegue. A madeira usada ali fará falta nas obras do salão.',
  weight: 3,
  requires: { buildings: { granary: 1 }, notFlags: ['commonGranary.open'] },
  autoResolve: { peasant: 'keep', lord: 'keep', ironKing: 'keep' },
  options: [
    {
      id: 'cede',
      label: 'Ceder a madeira',
      cost: { wood: 40 },
      effects: [
        { type: 'morale', amount: 5, durationDays: 2 },
        { type: 'setFlag', flag: 'commonGranary.open' },
        { type: 'setFlag', flag: 'commonGranary.supported' },
        { type: 'scheduleCard', cardId: 'commonGranaryShare', afterDays: 3 },
      ],
      hint: 'O conselho volta ao assunto quando as prateleiras estiverem de pé.',
      chronicle:
        'No {dia}º dia {daEstacao}, o senhor de {feudo} cedeu madeira das obras ao celeiro. Os moradores pregaram tábuas até o anoitecer.',
    },
    {
      id: 'pay',
      label: 'Pagar o conserto',
      cost: { gold: 30 },
      effects: [
        { type: 'morale', amount: 5, durationDays: 2 },
        { type: 'setFlag', flag: 'commonGranary.open' },
        { type: 'setFlag', flag: 'commonGranary.paid' },
        { type: 'scheduleCard', cardId: 'commonGranaryShare', afterDays: 3 },
      ],
      hint: 'Ouro traz carpinteiro de fora, e a madeira do feudo fica para as obras.',
      chronicle:
        'No {dia}º dia {daEstacao}, o senhor de {feudo} pagou um carpinteiro de fora para refazer as prateleiras do celeiro. A madeira do feudo ficou para as obras.',
    },
    {
      id: 'keep',
      label: 'Conservar as reservas',
      effects: [],
      hint: 'Nada se gasta, e o assunto morre aqui.',
      chronicle:
        'No {dia}º dia {daEstacao}, o senhor de {feudo} guardou a madeira e o ouro. O celeiro segue escorado com o que havia.',
      expiredChronicle:
        'No {dia}º dia {daEstacao}, o conselho de {feudo} esperou em vão pelo senhor e não mexeu nas reservas. O celeiro segue escorado com o que havia.',
    },
  ],
};

export const commonGranaryShare: CouncilCard = {
  id: 'commonGranaryShare',
  title: 'A vez de repartir',
  text: 'O conserto do celeiro ficou pronto. Algumas famílias pedem uma refeição em comum para estrear as prateleiras; outras preferem guardar cada saco para o frio. O conselho quer saber que exemplo o senhor dá.',
  weight: 0,
  variants: [
    {
      flag: 'commonGranary.supported',
      text: 'As prateleiras feitas com a madeira que o senhor cedeu já seguram a carga. Algumas famílias pedem uma refeição em comum para estreá-las; outras preferem guardar cada saco para o frio. O conselho quer saber que exemplo o senhor dá.',
      arrival:
        'No {dia}º dia {daEstacao}, a madeira cedida ao celeiro de {feudo} virou prateleira, e o conselho voltou ao assunto: {carta}.',
    },
    {
      flag: 'commonGranary.paid',
      text: 'O carpinteiro pago pelo senhor entregou as prateleiras e seguiu viagem. Algumas famílias pedem uma refeição em comum para estreá-las; outras preferem guardar cada saco para o frio. O conselho quer saber que exemplo o senhor dá.',
      arrival:
        'No {dia}º dia {daEstacao}, o carpinteiro pago pelo senhor entregou as prateleiras do celeiro de {feudo}, e o conselho voltou ao assunto: {carta}.',
    },
  ],
  autoResolve: { peasant: 'reserve', lord: 'reserve', ironKing: 'reserve' },
  options: [
    {
      id: 'share',
      label: 'Partilhar a comida',
      cost: { food: 30 },
      effects: [
        { type: 'morale', amount: 10, durationDays: 2 },
        { type: 'setFlag', flag: 'commonGranary.shared' },
        { type: 'scheduleCard', cardId: 'commonGranaryOutcome', afterDays: 3 },
      ],
      hint: 'Mesa farta hoje, um saco a menos no inverno. Quem come junto costuma lembrar.',
      chronicle:
        'No {dia}º dia {daEstacao}, o senhor de {feudo} mandou abrir os sacos, e o feudo inteiro comeu à mesma mesa.',
    },
    {
      id: 'reserve',
      label: 'Guardar para o inverno',
      effects: [
        { type: 'setFlag', flag: 'commonGranary.reserved' },
        { type: 'scheduleCard', cardId: 'commonGranaryOutcome', afterDays: 3 },
      ],
      hint: 'Ninguém festeja, mas o frio respeita celeiro cheio.',
      chronicle:
        'No {dia}º dia {daEstacao}, o senhor de {feudo} mandou guardar cada saco para o frio. Não houve festa nem queixa.',
      expiredChronicle:
        'No {dia}º dia {daEstacao}, sem palavra do senhor, o conselho de {feudo} mandou guardar cada saco para o frio.',
    },
  ],
};

/**
 * O desfecho, nos dois ramos, apaga o que a cadeia gravou no caminho (e com isso deixa a
 * primeira carta voltar em outro ano) e grava só como ela terminou.
 */
export const commonGranaryOutcome: CouncilCard = {
  id: 'commonGranaryOutcome',
  title: 'O que ficou da escolha',
  text: 'As prateleiras resistiram à carga. Na mesa do conselho, a conversa volta à decisão sobre os mantimentos. As famílias oferecem ao celeiro uma parte da colheita.',
  weight: 0,
  variants: [
    {
      flag: 'commonGranary.shared',
      text: 'As prateleiras resistiram à carga. Quem comeu à mesa do senhor não esqueceu: as famílias trazem agora uma parte da própria colheita. O conselho pergunta o que fazer com ela.',
      arrival:
        'No {dia}º dia {daEstacao}, quem comeu à mesa comum de {feudo} voltou com sacos às costas: {carta}.',
    },
    {
      flag: 'commonGranary.reserved',
      text: 'As prateleiras resistiram à carga, e o saco guardado para o frio não precisou ser aberto. Aliviadas, as famílias oferecem ao celeiro uma parte da colheita. O conselho pergunta o que fazer com ela.',
      arrival:
        'No {dia}º dia {daEstacao}, o saco guardado para o frio seguia fechado em {feudo}, e as famílias vieram ao conselho: {carta}.',
    },
  ],
  autoResolve: { peasant: 'accept', lord: 'accept', ironKing: 'leave' },
  options: [
    {
      id: 'accept',
      label: 'Receber a contribuição',
      effects: [
        { type: 'resources', amounts: { food: 40 } },
        { type: 'clearFlag', flag: 'commonGranary.open' },
        { type: 'clearFlag', flag: 'commonGranary.supported' },
        { type: 'clearFlag', flag: 'commonGranary.paid' },
        { type: 'clearFlag', flag: 'commonGranary.shared' },
        { type: 'clearFlag', flag: 'commonGranary.reserved' },
        { type: 'setFlag', flag: 'commonGranary.stocked' },
      ],
      hint: 'O que não couber no celeiro se perde.',
      chronicle:
        'No {dia}º dia {daEstacao}, a contribuição das famílias subiu às prateleiras novas do celeiro de {feudo}.',
      expiredChronicle:
        'No {dia}º dia {daEstacao}, sem palavra do senhor, o conselho de {feudo} recebeu a contribuição das famílias e a pôs nas prateleiras novas do celeiro.',
    },
    {
      id: 'leave',
      label: 'Deixar com as famílias',
      effects: [
        { type: 'morale', amount: 10, durationDays: 2 },
        { type: 'clearFlag', flag: 'commonGranary.open' },
        { type: 'clearFlag', flag: 'commonGranary.supported' },
        { type: 'clearFlag', flag: 'commonGranary.paid' },
        { type: 'clearFlag', flag: 'commonGranary.shared' },
        { type: 'clearFlag', flag: 'commonGranary.reserved' },
        { type: 'setFlag', flag: 'commonGranary.gifted' },
      ],
      hint: 'Despensa cheia em cada casa alegra mais que celeiro cheio.',
      chronicle:
        'No {dia}º dia {daEstacao}, o senhor de {feudo} deixou a colheita com quem a plantou. Falou-se disso em cada casa.',
      expiredChronicle:
        'No {dia}º dia {daEstacao}, sem palavra do senhor, o conselho de {feudo} deixou a colheita com quem a plantou. Falou-se disso em cada casa.',
    },
  ],
};
