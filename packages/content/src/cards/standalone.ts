import type { CouncilCard } from '../council';

/**
 * Cartas avulsas: não dependem de cadeia nenhuma. São as doze do primeiro lote (roadmap da
 * v0.2, §12.2; a ficha de cada uma está em docs/content-v0.2.md).
 *
 * **Quatro são recorrentes** (`recurring`): os assuntos de sempre do feudo, que podem voltar no
 * mesmo ano e não pedem estação nem edifício. São elas que garantem assunto ao conselho em
 * qualquer audiência, do primeiro dia ao fim do inverno. Para a mesma não vir duas vezes
 * seguidas, cada uma grava a própria flag `routine.*` em todas as opções e apaga as das outras
 * três: uma recorrente só volta depois de outra recorrente ter passado pela mesa.
 *
 * As outras oito saem no máximo uma vez por ano, cada uma na sua estação.
 *
 * Cada carta é uma constante exportada, escrita por extenso: nada de listas montadas com
 * espalhamento (`...`) ou chamadas no nível do módulo, que impedem o build do app de descartar
 * este arquivo (packages/web/src/bundle.test.ts).
 */

// ---------------------------------------------------------------------------------------------
// As quatro recorrentes
// ---------------------------------------------------------------------------------------------

export const masonsMeal: CouncilCard = {
  id: 'masonsMeal',
  title: 'A refeição dos pedreiros',
  text: 'Os pedreiros largaram as ferramentas ao meio-dia. Pedem uma refeição quente antes de voltar à obra, e dizem que de barriga cheia o braço rende. A despensa é a mesma que alimenta o resto do feudo.',
  weight: 1,
  recurring: true,
  requires: { notFlags: ['routine.masonsMeal'] },
  autoResolve: { peasant: 'bread', lord: 'bread', ironKing: 'refuse' },
  options: [
    {
      id: 'feast',
      label: 'Servir a refeição',
      // O cozinheiro só abre a despensa quando há folga: a refeição não pode trazer a fome.
      requires: { resources: { food: 100 } },
      cost: { food: 40 },
      effects: [
        { type: 'morale', amount: 10, durationDays: 2 },
        { type: 'setFlag', flag: 'routine.masonsMeal' },
        { type: 'clearFlag', flag: 'routine.sawmillRest' },
        { type: 'clearFlag', flag: 'routine.neighborsWatch' },
        { type: 'clearFlag', flag: 'routine.moreMouths' },
      ],
      hint: 'Barriga cheia, ânimo alto.',
      chronicle:
        'No {dia}º dia {daEstacao}, o senhor de {feudo} mandou servir caldo e pão aos pedreiros. Cantou-se na obra até a tarde.',
    },
    {
      id: 'bread',
      label: 'Repartir o pão do dia',
      effects: [
        { type: 'setFlag', flag: 'routine.masonsMeal' },
        { type: 'clearFlag', flag: 'routine.sawmillRest' },
        { type: 'clearFlag', flag: 'routine.neighborsWatch' },
        { type: 'clearFlag', flag: 'routine.moreMouths' },
      ],
      hint: 'Nem festa, nem queixa.',
      chronicle:
        'No {dia}º dia {daEstacao}, os pedreiros de {feudo} repartiram o pão que havia e voltaram à obra.',
      expiredChronicle:
        'No {dia}º dia {daEstacao}, sem palavra do senhor, os pedreiros de {feudo} repartiram o pão que havia e voltaram à obra.',
    },
    {
      id: 'refuse',
      label: 'Mandar voltar ao trabalho',
      effects: [
        { type: 'resources', amounts: { stone: 15 } },
        { type: 'morale', amount: -5, durationDays: 4 },
        { type: 'setFlag', flag: 'routine.masonsMeal' },
        { type: 'clearFlag', flag: 'routine.sawmillRest' },
        { type: 'clearFlag', flag: 'routine.neighborsWatch' },
        { type: 'clearFlag', flag: 'routine.moreMouths' },
      ],
      hint: 'A tarde rende mais pedra, e a obra guarda a mágoa.',
      chronicle:
        'No {dia}º dia {daEstacao}, o senhor de {feudo} mandou os pedreiros de volta à obra sem almoço. A tarde rendeu pedra; o ânimo, não.',
      expiredChronicle:
        'No {dia}º dia {daEstacao}, sem palavra do senhor, o capataz de {feudo} mandou os pedreiros de volta à obra sem almoço. A tarde rendeu pedra; o ânimo, não.',
    },
  ],
};

export const sawmillRest: CouncilCard = {
  id: 'sawmillRest',
  title: 'A serraria e o descanso',
  text: 'Os lenhadores pedem um dia de descanso. As serras estão cegas e os braços, pesados. O capataz avisa que serra parada não junta lenha.',
  weight: 1,
  recurring: true,
  requires: { notFlags: ['routine.sawmillRest'] },
  autoResolve: { peasant: 'keep', lord: 'keep', ironKing: 'keep' },
  options: [
    {
      id: 'rest',
      label: 'Conceder o descanso',
      // O dia parado custa a madeira que eles cortariam.
      cost: { wood: 30 },
      effects: [
        { type: 'morale', amount: 10, durationDays: 2 },
        { type: 'setFlag', flag: 'routine.sawmillRest' },
        { type: 'clearFlag', flag: 'routine.masonsMeal' },
        { type: 'clearFlag', flag: 'routine.neighborsWatch' },
        { type: 'clearFlag', flag: 'routine.moreMouths' },
      ],
      hint: 'Braço descansado volta ao machado de boa vontade.',
      chronicle:
        'No {dia}º dia {daEstacao}, o senhor de {feudo} deu um dia de descanso aos lenhadores. A serraria calou, e ouviu-se riso na praça.',
    },
    {
      id: 'sharpen',
      label: 'Mandar afiar as serras',
      cost: { stone: 15 },
      effects: [
        { type: 'setFlag', flag: 'routine.sawmillRest' },
        { type: 'clearFlag', flag: 'routine.masonsMeal' },
        { type: 'clearFlag', flag: 'routine.neighborsWatch' },
        { type: 'clearFlag', flag: 'routine.moreMouths' },
      ],
      hint: 'Serra afiada corta por duas. O ganho aparece em poucos dias, se houver onde guardar.',
      hidden: {
        afterDays: 2,
        effects: [{ type: 'resources', amounts: { wood: 45 } }],
        chronicle:
          'No {dia}º dia {daEstacao}, as serras afiadas de {feudo} mostraram o fio: saiu da mata mais madeira do que se esperava.',
      },
      chronicle:
        'No {dia}º dia {daEstacao}, o senhor de {feudo} mandou buscar pedra de amolar. Os lenhadores passaram o dia afiando, sentados, em vez de descansar.',
    },
    {
      id: 'keep',
      label: 'Manter o ritmo',
      effects: [
        { type: 'setFlag', flag: 'routine.sawmillRest' },
        { type: 'clearFlag', flag: 'routine.masonsMeal' },
        { type: 'clearFlag', flag: 'routine.neighborsWatch' },
        { type: 'clearFlag', flag: 'routine.moreMouths' },
      ],
      hint: 'Nada se gasta. O cansaço fica para outro dia.',
      chronicle:
        'No {dia}º dia {daEstacao}, o senhor de {feudo} mandou os lenhadores de volta à mata. A serraria não parou.',
      expiredChronicle:
        'No {dia}º dia {daEstacao}, sem palavra do senhor, o capataz de {feudo} manteve os lenhadores na mata. A serraria não parou.',
    },
  ],
};

export const neighborsWatch: CouncilCard = {
  id: 'neighborsWatch',
  title: 'Vigília entre vizinhos',
  text: 'Há três noites somem galinhas dos currais, e ninguém viu o ladrão. Os vizinhos querem revezar a vigília e pedem lenha para as fogueiras. O capataz lembra que lenha queimada na vigília é lenha a menos na pilha.',
  weight: 1,
  recurring: true,
  requires: { notFlags: ['routine.neighborsWatch'] },
  autoResolve: { peasant: 'vigil', lord: 'vigil', ironKing: 'wind' },
  options: [
    {
      id: 'fires',
      label: 'Ceder lenha para as fogueiras',
      cost: { wood: 25 },
      effects: [
        { type: 'morale', amount: 5, durationDays: 3 },
        { type: 'setFlag', flag: 'routine.neighborsWatch' },
        { type: 'clearFlag', flag: 'routine.masonsMeal' },
        { type: 'clearFlag', flag: 'routine.sawmillRest' },
        { type: 'clearFlag', flag: 'routine.moreMouths' },
      ],
      hint: 'Fogueira acesa afasta o medo, e bicho pequeno não gosta de luz.',
      chronicle:
        'No {dia}º dia {daEstacao}, o senhor de {feudo} cedeu lenha para as fogueiras da vigília. Os vizinhos velaram juntos, e nenhuma galinha sumiu naquela noite.',
    },
    {
      id: 'vigil',
      label: 'Revezar a vigília no escuro',
      effects: [
        { type: 'setFlag', flag: 'routine.neighborsWatch' },
        { type: 'clearFlag', flag: 'routine.masonsMeal' },
        { type: 'clearFlag', flag: 'routine.sawmillRest' },
        { type: 'clearFlag', flag: 'routine.moreMouths' },
      ],
      hint: 'Sem fogueira vela-se do mesmo jeito: com mais frio e menos conversa.',
      chronicle:
        'No {dia}º dia {daEstacao}, os vizinhos de {feudo} revezaram a vigília no escuro, cada qual com o seu cajado. Nada sumiu dos currais.',
      expiredChronicle:
        'No {dia}º dia {daEstacao}, sem palavra do senhor, os vizinhos de {feudo} revezaram a vigília no escuro, cada qual com o seu cajado. Nada sumiu dos currais.',
    },
    {
      id: 'wind',
      label: 'Dizer que é só o vento',
      effects: [
        { type: 'morale', amount: 5, durationDays: 1 },
        { type: 'setFlag', flag: 'routine.neighborsWatch' },
        { type: 'clearFlag', flag: 'routine.masonsMeal' },
        { type: 'clearFlag', flag: 'routine.sawmillRest' },
        { type: 'clearFlag', flag: 'routine.moreMouths' },
      ],
      hint: 'A palavra do senhor acalma por uma noite. O que ronda costuma voltar.',
      hidden: {
        afterDays: 2,
        effects: [{ type: 'resources', amounts: { food: -20 } }],
        chronicle:
          'No {dia}º dia {daEstacao}, o que rondava os currais de {feudo} voltou, e não era o vento: raposa, pelo rastro. Foram-se galinhas e um saco de grão.',
      },
      chronicle:
        'No {dia}º dia {daEstacao}, o senhor de {feudo} disse aos vizinhos que era só o vento. Dormiu-se bem naquela noite.',
      expiredChronicle:
        'No {dia}º dia {daEstacao}, sem palavra do senhor, o conselho de {feudo} disse aos vizinhos que era só o vento. Dormiu-se bem naquela noite.',
    },
  ],
};

export const moreMouths: CouncilCard = {
  id: 'moreMouths',
  title: 'Mais bocas à mesa',
  text: 'Uma família de viajantes parou ao portão, com fome e pó da estrada. Pedem abrigo por algumas noites e oferecem os braços em troca. A despensa do feudo não cresce com as visitas.',
  weight: 1,
  recurring: true,
  requires: { notFlags: ['routine.moreMouths'] },
  autoResolve: { peasant: 'close', lord: 'close', ironKing: 'close' },
  options: [
    {
      id: 'host',
      label: 'Acolher por uns dias',
      // Hóspede só entra com folga na despensa: a acolhida não pode trazer a fome.
      requires: { resources: { food: 100 } },
      cost: { food: 40 },
      effects: [
        { type: 'morale', amount: 5, durationDays: 2 },
        { type: 'setFlag', flag: 'routine.moreMouths' },
        { type: 'clearFlag', flag: 'routine.masonsMeal' },
        { type: 'clearFlag', flag: 'routine.sawmillRest' },
        { type: 'clearFlag', flag: 'routine.neighborsWatch' },
      ],
      hint: 'Hóspede agradecido costuma pagar com os braços antes de seguir viagem.',
      hidden: {
        afterDays: 3,
        effects: [{ type: 'resources', amounts: { wood: 30, stone: 20 } }],
        chronicle:
          'No {dia}º dia {daEstacao}, os viajantes acolhidos em {feudo} seguiram estrada. Antes, pagaram a hospedagem com trabalho: lenha rachada e pedra carregada.',
      },
      chronicle:
        'No {dia}º dia {daEstacao}, o senhor de {feudo} abriu o portão aos viajantes. Houve mais bocas à mesa, e mais braços no trabalho.',
    },
    {
      id: 'provide',
      label: 'Dar provisões para a estrada',
      cost: { food: 15 },
      effects: [
        { type: 'morale', amount: 5, durationDays: 2 },
        { type: 'setFlag', flag: 'routine.moreMouths' },
        { type: 'clearFlag', flag: 'routine.masonsMeal' },
        { type: 'clearFlag', flag: 'routine.sawmillRest' },
        { type: 'clearFlag', flag: 'routine.neighborsWatch' },
      ],
      hint: 'Quem segue viagem de barriga cheia fala bem do feudo.',
      chronicle:
        'No {dia}º dia {daEstacao}, o senhor de {feudo} deu pão e queijo aos viajantes, e eles seguiram estrada agradecidos.',
    },
    {
      id: 'close',
      label: 'Fechar o portão',
      effects: [
        { type: 'setFlag', flag: 'routine.moreMouths' },
        { type: 'clearFlag', flag: 'routine.masonsMeal' },
        { type: 'clearFlag', flag: 'routine.sawmillRest' },
        { type: 'clearFlag', flag: 'routine.neighborsWatch' },
      ],
      hint: 'Portão fechado não gasta pão, e não faz amigos.',
      chronicle:
        'No {dia}º dia {daEstacao}, o senhor de {feudo} mandou fechar o portão. Os viajantes seguiram estrada sem olhar para trás.',
      expiredChronicle:
        'No {dia}º dia {daEstacao}, ninguém em {feudo} abriu o portão aos viajantes. Eles seguiram estrada sem olhar para trás.',
    },
  ],
};

// ---------------------------------------------------------------------------------------------
// As oito de uma vez por ano
// ---------------------------------------------------------------------------------------------

export const collapsedWell: CouncilCard = {
  id: 'collapsedWell',
  title: 'O poço entulhado',
  text: 'A boca do poço da praça cedeu durante a noite. As mulheres já descem ao riacho com os baldes, e a fila cresce. O mestre de obras pede pedra para refazer a mureta.',
  weight: 2,
  autoResolve: { peasant: 'dig', lord: 'dig', ironKing: 'wait' },
  options: [
    {
      id: 'repair',
      label: 'Ceder a pedra',
      cost: { stone: 20 },
      effects: [{ type: 'morale', amount: 10, durationDays: 3 }],
      hint: 'Mureta bem assentada dura mais que a queixa.',
      chronicle:
        'No {dia}º dia {daEstacao}, o senhor de {feudo} cedeu pedra para o poço da praça. A água voltou antes do segundo dia.',
    },
    {
      id: 'dig',
      label: 'Mandar o povo cavar',
      effects: [],
      hint: 'Sem pedra nova, a mureta fica como der. A água volta, e é só.',
      chronicle:
        'No {dia}º dia {daEstacao}, o senhor de {feudo} mandou o povo desentulhar o poço com as próprias mãos. A água voltou, e a mureta ficou como deu.',
      expiredChronicle:
        'No {dia}º dia {daEstacao}, sem palavra do senhor, o povo de {feudo} desentulhou o poço com as próprias mãos. A água voltou, e a mureta ficou como deu.',
    },
    {
      id: 'wait',
      label: 'Deixar para depois',
      effects: [],
      hint: 'O riacho fica longe, e o povo tem memória. Dizem que no entulho ainda há pedra boa.',
      hidden: {
        afterDays: 2,
        effects: [
          { type: 'resources', amounts: { stone: 20 } },
          { type: 'morale', amount: -10, durationDays: 3 },
        ],
        chronicle:
          'No {dia}º dia {daEstacao}, o poço de {feudo} desabou de vez. Do entulho saiu pedra de cantaria; da fila do riacho, só queixa.',
      },
      chronicle:
        'No {dia}º dia {daEstacao}, o senhor de {feudo} deixou o poço como estava. O povo seguiu descendo ao riacho.',
      expiredChronicle:
        'No {dia}º dia {daEstacao}, ninguém em {feudo} decidiu nada sobre o poço. O povo seguiu descendo ao riacho.',
    },
  ],
};

export const springSeeds: CouncilCard = {
  id: 'springSeeds',
  title: 'Sementes para o próximo campo',
  text: 'Os lavradores abriram um campo novo junto ao riacho, e falta semente para ele. Pedem grão da despensa para lançar à terra. O que se planta hoje só volta à mesa daqui a alguns dias.',
  weight: 3,
  requires: { seasons: ['spring'] },
  autoResolve: { peasant: 'fallow', lord: 'fallow', ironKing: 'fallow' },
  options: [
    {
      id: 'sow',
      label: 'Ceder o grão',
      cost: { food: 40 },
      effects: [],
      hint: 'Grão na terra volta dobrado em poucos dias, se houver onde guardar.',
      hidden: {
        afterDays: 4,
        effects: [{ type: 'resources', amounts: { food: 80 } }],
        chronicle:
          'No {dia}º dia {daEstacao}, o campo novo de {feudo} deu a primeira colheita. O grão cedido voltou dobrado.',
      },
      chronicle:
        'No {dia}º dia {daEstacao}, o senhor de {feudo} cedeu grão da despensa para o campo novo. Semeou-se até o sol baixar.',
    },
    {
      id: 'buy',
      label: 'Comprar a semente',
      cost: { gold: 30 },
      effects: [],
      hint: 'O ouro poupa a despensa, e a colheita vem do mesmo jeito.',
      hidden: {
        afterDays: 4,
        effects: [{ type: 'resources', amounts: { food: 80 } }],
        chronicle:
          'No {dia}º dia {daEstacao}, o campo novo de {feudo} deu a primeira colheita, da semente comprada a um vizinho. A despensa não tinha cedido um grão.',
      },
      chronicle:
        'No {dia}º dia {daEstacao}, o senhor de {feudo} comprou semente a um vizinho para o campo novo. A despensa ficou como estava.',
    },
    {
      id: 'fallow',
      label: 'Deixar o campo em pousio',
      effects: [],
      hint: 'Terra descansada não pede nada, e não dá nada.',
      chronicle:
        'No {dia}º dia {daEstacao}, o senhor de {feudo} deixou o campo novo em pousio. A semente fica para outro ano.',
      expiredChronicle:
        'No {dia}º dia {daEstacao}, sem palavra do senhor, o campo novo de {feudo} ficou em pousio. A semente fica para outro ano.',
    },
  ],
};

export const springNews: CouncilCard = {
  id: 'springNews',
  title: 'A notícia da primavera',
  text: 'As cegonhas voltaram ao telhado do salão, e com elas a certeza de que a primavera veio para ficar. O povo quer marcar o dia com música e um tonel aberto. O tesoureiro lembra que tonel não se enche sozinho.',
  weight: 3,
  // Não sai com o feudo desesperado ou inquieto de fome: a faixa de "A colheita de todos".
  requires: { seasons: ['spring'], moralRange: [40, 100] },
  autoResolve: { peasant: 'bells', lord: 'bells', ironKing: 'fields' },
  options: [
    {
      id: 'cask',
      label: 'Abrir o tonel',
      cost: { gold: 40 },
      effects: [{ type: 'morale', amount: 15, durationDays: 2 }],
      hint: 'Dia de festa pesa pouco no cofre e muito na lembrança.',
      chronicle:
        'No {dia}º dia {daEstacao}, o senhor de {feudo} mandou abrir um tonel pela volta das cegonhas. Cantou-se até elas reclamarem.',
    },
    {
      id: 'bells',
      label: 'Mandar tocar o sino',
      effects: [{ type: 'morale', amount: 5, durationDays: 1 }],
      hint: 'Sino não custa nada, e festa sem tonel acaba cedo.',
      chronicle:
        'No {dia}º dia {daEstacao}, o sino de {feudo} saudou a volta das cegonhas. Houve sorrisos, e cada um voltou ao seu trabalho.',
      expiredChronicle:
        'No {dia}º dia {daEstacao}, sem palavra do senhor, o conselho de {feudo} mandou tocar o sino pela volta das cegonhas. Houve sorrisos, e cada um voltou ao seu trabalho.',
    },
    {
      id: 'fields',
      label: 'Mandar todos ao campo',
      effects: [
        { type: 'resources', amounts: { food: 25 } },
        { type: 'morale', amount: -5, durationDays: 4 },
      ],
      hint: 'Dia de sol é dia de enxada: a despensa agradece, o povo nem tanto.',
      chronicle:
        'No {dia}º dia {daEstacao}, o senhor de {feudo} mandou todos ao campo em vez da festa. A terra rendeu; a música ficou para outro ano.',
      expiredChronicle:
        'No {dia}º dia {daEstacao}, sem palavra do senhor, o capataz de {feudo} mandou todos ao campo em vez da festa. A terra rendeu; a música ficou para outro ano.',
    },
  ],
};

export const apprenticesTable: CouncilCard = {
  id: 'apprenticesTable',
  title: 'A mesa dos aprendizes',
  text: 'Os rapazes do feudo querem aprender ofício com os mais velhos da serraria e da pedreira. Os velhos aceitam, se alguém pagar as horas que perdem ensinando. Aprendiz erra muito antes de acertar.',
  weight: 3,
  requires: { seasons: ['summer', 'autumn'] },
  autoResolve: { peasant: 'watch', lord: 'watch', ironKing: 'harvest' },
  options: [
    {
      id: 'teach',
      label: 'Pagar as lições',
      cost: { gold: 40 },
      effects: [{ type: 'morale', amount: 5, durationDays: 3 }],
      hint: 'Aprendiz bem ensinado paga a lição com trabalho, daqui a alguns dias.',
      hidden: {
        afterDays: 5,
        effects: [{ type: 'resources', amounts: { wood: 40, stone: 30 } }],
        chronicle:
          'No {dia}º dia {daEstacao}, os aprendizes de {feudo} entregaram a primeira obra: tábuas direitas e pedra bem cortada.',
      },
      chronicle:
        'No {dia}º dia {daEstacao}, o senhor de {feudo} pagou as lições dos aprendizes. À noite, a mesa deles era a mais barulhenta do salão.',
    },
    {
      id: 'watch',
      label: 'Deixar aprender olhando',
      effects: [],
      hint: 'Quem aprende olhando aprende devagar, e não custa nada.',
      chronicle:
        'No {dia}º dia {daEstacao}, o senhor de {feudo} deixou os rapazes aprenderem olhando. Os velhos seguiram no trabalho, com plateia.',
      expiredChronicle:
        'No {dia}º dia {daEstacao}, sem palavra do senhor, os rapazes de {feudo} ficaram aprendendo de longe. Os velhos seguiram no trabalho, com plateia.',
    },
    {
      id: 'harvest',
      label: 'Mandar os rapazes à colheita',
      effects: [
        { type: 'resources', amounts: { food: 30 } },
        { type: 'morale', amount: -5, durationDays: 2 },
      ],
      hint: 'A despensa ganha hoje. O ofício fica para quando houver tempo, e os rapazes sabem disso.',
      chronicle:
        'No {dia}º dia {daEstacao}, o senhor de {feudo} mandou os rapazes à colheita em vez da lição. Voltaram com os cestos cheios e a cara fechada.',
      expiredChronicle:
        'No {dia}º dia {daEstacao}, sem palavra do senhor, o capataz de {feudo} mandou os rapazes à colheita em vez da lição. Voltaram com os cestos cheios e a cara fechada.',
    },
  ],
};

export const fullGranary: CouncilCard = {
  id: 'fullGranary',
  title: 'O celeiro quase cheio',
  text: 'Os lavradores juram que a colheita deste ano não cabe no celeiro. O que sobrar apodrece ao relento antes do inverno. As famílias perguntam se o senhor reparte uma parte do grão enquanto ele ainda presta.',
  weight: 3,
  // Só com o Celeiro erguido e o povo bem alimentado (a moral de quem tem comida guardada).
  requires: { seasons: ['summer', 'autumn'], buildings: { granary: 1 }, moralRange: [60, 100] },
  autoResolve: { peasant: 'keep', lord: 'keep', ironKing: 'keep' },
  options: [
    {
      id: 'share',
      label: 'Repartir o excedente',
      // Só há excedente a repartir com o celeiro de fato carregado.
      requires: { resources: { food: 300 } },
      cost: { food: 80 },
      effects: [{ type: 'morale', amount: 15, durationDays: 2 }],
      hint: 'Grão repartido não apodrece, e o povo lembra de quem repartiu.',
      chronicle:
        'No {dia}º dia {daEstacao}, o senhor de {feudo} repartiu entre as famílias o grão que sobrava. Nenhum saco apodreceu; nenhuma casa ficou sem.',
    },
    {
      id: 'firewood',
      label: 'Pagar lenha com grão',
      requires: { resources: { food: 300 } },
      cost: { food: 60 },
      effects: [{ type: 'resources', amounts: { wood: 40 } }],
      hint: 'Quem recebe grão racha lenha de bom grado. O inverno agradece.',
      chronicle:
        'No {dia}º dia {daEstacao}, o senhor de {feudo} pagou em grão a lenha que as famílias racharam. O celeiro aliviou, e a pilha de lenha cresceu.',
    },
    {
      id: 'keep',
      label: 'Guardar cada saco',
      effects: [],
      hint: 'O que couber fica. O que não couber, o tempo leva.',
      chronicle:
        'No {dia}º dia {daEstacao}, o senhor de {feudo} mandou guardar cada saco. O celeiro que se arranje.',
      expiredChronicle:
        'No {dia}º dia {daEstacao}, sem palavra do senhor, o conselho de {feudo} mandou guardar cada saco no celeiro.',
    },
  ],
};

export const dampFirewood: CouncilCard = {
  id: 'dampFirewood',
  title: 'Lenha ainda úmida',
  text: 'As chuvas do outono pegaram as pilhas de lenha descobertas. Madeira molhada faz mais fumaça que calor, e o inverno está perto. O lenhador mais velho pede telheiros de palha para secar as pilhas a tempo.',
  weight: 3,
  requires: { seasons: ['autumn'] },
  autoResolve: { peasant: 'leave', lord: 'leave', ironKing: 'split' },
  options: [
    {
      id: 'sheds',
      label: 'Pagar os telheiros',
      cost: { gold: 30 },
      effects: [],
      hint: 'Lenha seca rende mais na lareira. O ganho aparece quando as pilhas secarem.',
      hidden: {
        afterDays: 3,
        effects: [{ type: 'resources', amounts: { wood: 45 } }],
        chronicle:
          'No {dia}º dia {daEstacao}, a lenha de {feudo} secou debaixo dos telheiros de palha. A mesma pilha passou a valer por mais achas.',
      },
      chronicle:
        'No {dia}º dia {daEstacao}, o senhor de {feudo} pagou telheiros de palha para a lenha. As pilhas atravessaram a chuva cobertas.',
    },
    {
      id: 'leave',
      label: 'Deixar secar ao tempo',
      effects: [],
      hint: 'Nada se gasta e nada se ganha: a lenha queima como estiver.',
      chronicle:
        'No {dia}º dia {daEstacao}, o senhor de {feudo} deixou as pilhas de lenha secarem ao tempo.',
      expiredChronicle:
        'No {dia}º dia {daEstacao}, ninguém em {feudo} decidiu nada sobre a lenha úmida. As pilhas ficaram ao tempo.',
    },
    {
      id: 'split',
      label: 'Mandar rachar e empilhar ao vento',
      effects: [{ type: 'morale', amount: -5, durationDays: 2 }],
      hint: 'Lenha rachada fina seca sozinha. Dá para salvar no braço, e o braço reclama.',
      hidden: {
        afterDays: 3,
        effects: [{ type: 'resources', amounts: { wood: 25 } }],
        chronicle:
          'No {dia}º dia {daEstacao}, a lenha rachada fina de {feudo} secou ao vento. Rendeu mais achas do que a pilha molhada prometia.',
      },
      chronicle:
        'No {dia}º dia {daEstacao}, o senhor de {feudo} mandou o povo rachar a lenha fina e empilhá-la ao vento. Os braços doeram até a noite.',
      expiredChronicle:
        'No {dia}º dia {daEstacao}, sem palavra do senhor, o capataz de {feudo} mandou o povo rachar a lenha fina e empilhá-la ao vento. Os braços doeram até a noite.',
    },
  ],
};

export const roofBeforeCold: CouncilCard = {
  id: 'roofBeforeCold',
  title: 'Um teto antes do frio',
  text: 'Duas famílias dormem no palheiro desde que a ventania destelhou as casas delas. Pedem ao senhor um teto de verdade antes da primeira geada. O carpinteiro lembra que cada tábua dada agora é uma acha a menos no inverno.',
  weight: 3,
  requires: { seasons: ['autumn'] },
  autoResolve: { peasant: 'hall', lord: 'hall', ironKing: 'axes' },
  options: [
    {
      id: 'build',
      label: 'Ceder madeira e pedra',
      cost: { wood: 50, stone: 20 },
      effects: [{ type: 'morale', amount: 10, durationDays: 4 }],
      hint: 'Quem ganha um teto no outono não esquece no inverno.',
      chronicle:
        'No {dia}º dia {daEstacao}, o senhor de {feudo} cedeu madeira e pedra para o teto de duas famílias. Em poucos dias havia fumaça outra vez nas duas chaminés.',
    },
    {
      id: 'hall',
      label: 'Abrigar as famílias no salão',
      effects: [],
      hint: 'O salão é grande e seco. Nenhum teto se refaz, e ninguém dorme ao relento.',
      chronicle:
        'No {dia}º dia {daEstacao}, o senhor de {feudo} abriu o salão às duas famílias do palheiro. Dormiram secas, entre os bancos do conselho.',
      expiredChronicle:
        'No {dia}º dia {daEstacao}, sem palavra do senhor, o conselho de {feudo} abrigou no salão as duas famílias do palheiro. Dormiram secas, entre os bancos do conselho.',
    },
    {
      id: 'axes',
      label: 'Dar machados e mandar à mata',
      effects: [{ type: 'morale', amount: -5, durationDays: 2 }],
      hint: 'Quem corta a própria viga demora, reclama, e às vezes corta de sobra.',
      hidden: {
        afterDays: 3,
        effects: [{ type: 'resources', amounts: { wood: 40 } }],
        chronicle:
          'No {dia}º dia {daEstacao}, as duas famílias de {feudo} fecharam o próprio teto com a madeira que cortaram. O que sobrou das vigas foi para a lenha do feudo.',
      },
      chronicle:
        'No {dia}º dia {daEstacao}, o senhor de {feudo} deu machados às famílias do palheiro e as mandou à mata. Foram resmungando.',
      expiredChronicle:
        'No {dia}º dia {daEstacao}, sem palavra do senhor, o capataz de {feudo} deu machados às famílias do palheiro e as mandou à mata. Foram resmungando.',
    },
  ],
};

export const harvestFeast: CouncilCard = {
  id: 'harvestFeast',
  title: 'A colheita de todos',
  text: 'Os campos renderam, e as carroças voltam cheias. O povo pede uma festa da colheita, com mesa posta na praça. Os mais velhos lembram que o inverno come o que o outono guarda.',
  weight: 4,
  // Ninguém pede festa com o feudo desesperado ou inquieto de fome.
  requires: { seasons: ['autumn'], moralRange: [40, 100] },
  autoResolve: { peasant: 'store', lord: 'store', ironKing: 'store' },
  options: [
    {
      id: 'feast',
      label: 'Celebrar a colheita',
      cost: { food: 100, gold: 50 },
      effects: [{ type: 'morale', amount: 20, durationDays: 2 }],
      hint: 'Festa grande corre as estradas, e feudo alegre atrai gente nova.',
      chronicle:
        'No {dia}º dia {daEstacao}, o senhor de {feudo} mandou pôr a mesa na praça e celebrar a colheita. Comeu-se, bebeu-se e dançou-se até a madrugada.',
    },
    {
      id: 'modest',
      label: 'Fazer uma festa modesta',
      cost: { food: 40 },
      effects: [{ type: 'morale', amount: 10, durationDays: 2 }],
      hint: 'Pão novo e um brinde: pouco para a lenda, bastante para o ânimo.',
      chronicle:
        'No {dia}º dia {daEstacao}, o senhor de {feudo} mandou repartir pão novo e brindar à colheita. Festa curta, sono tranquilo.',
    },
    {
      id: 'store',
      label: 'Guardar tudo para o inverno',
      effects: [],
      hint: 'Despensa cheia não canta. Também não passa fome.',
      chronicle:
        'No {dia}º dia {daEstacao}, o senhor de {feudo} mandou guardar a colheita inteira. Não houve festa; trabalhou-se em silêncio.',
      expiredChronicle:
        'No {dia}º dia {daEstacao}, sem palavra do senhor, o conselho de {feudo} mandou guardar a colheita inteira. Não houve festa; trabalhou-se em silêncio.',
    },
  ],
};
