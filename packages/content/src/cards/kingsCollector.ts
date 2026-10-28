import type { CouncilCard } from '../council';

/** Ficha aprovada: docs/content-v0.4.md, §6.1. */
export const kingsTax: CouncilCard = {
  id: 'kingsTax',
  title: 'Impostos do Rei',
  text: 'Um arauto do rei parou ao pé da escadaria do Salão e leu o rolo em voz alta, devagar, para que ninguém dissesse que não ouviu. A coroa lembra que o feudo existe por mercê dela e que a mercê tem preço. O escrivão já tem a pena molhada.',
  weight: 2,
  recurring: true,
  requires: {
    seasons: ['spring', 'autumn'],
    buildings: {
      townHall: 3,
    },
    notFlags: ['tax.refused', 'tax.defied', 'tax.refusedTwice'],
  },
  autoResolve: {
    peasant: 'pay',
    lord: 'pay',
    ironKing: 'refuse',
  },
  options: [
    {
      id: 'pay',
      label: 'Pagar o imposto',
      effects: [
        {
          type: 'resourcesPercent',
          resource: 'gold',
          ratio: {
            num: -15,
            den: 100,
          },
        },
      ],
      hint: 'O ouro sai inteiro, e o arauto vai embora satisfeito.',
      chronicle:
        'No {dia}º dia {daEstacao}, o senhor de {feudo} pagou o imposto da coroa. O arauto contou as moedas em voz alta e partiu a cavalo.',
      expiredChronicle:
        'No {dia}º dia {daEstacao}, sem palavra do senhor, o conselho de {feudo} pagou o imposto da coroa. O arauto contou as moedas em voz alta e partiu a cavalo.',
    },
    {
      id: 'negotiate',
      label: 'Negociar com o arauto',
      requires: {
        heroTrait: 'charismatic',
      },
      effects: [
        {
          type: 'resourcesPercent',
          resource: 'gold',
          ratio: {
            num: -7,
            den: 100,
          },
        },
      ],
      hint: 'Quem sabe falar paga menos que quem só sabe pagar.',
      chronicle:
        'No {dia}º dia {daEstacao}, {heroi} falou ao arauto do rei até o imposto encolher. O escrivão riscou um número e escreveu outro.',
    },
    {
      id: 'refuse',
      label: 'Recusar o imposto',
      effects: [
        {
          type: 'morale',
          amount: 10,
          durationDays: 3,
        },
        {
          type: 'setFlag',
          flag: 'tax.refused',
        },
        {
          type: 'scheduleCard',
          cardId: 'kingsCollector',
          afterDays: 2,
        },
      ],
      hint: 'O povo gosta da altivez. O rei não gosta de nada.',
      chronicle:
        'No {dia}º dia {daEstacao}, o senhor de {feudo} recusou o imposto da coroa. A praça aplaudiu, e o arauto não voltou a falar.',
      expiredChronicle:
        'No {dia}º dia {daEstacao}, sem palavra do senhor, o conselho de {feudo} recusou o imposto da coroa. A praça aplaudiu, e o arauto não voltou a falar.',
    },
  ],
};

/** Ficha aprovada: docs/content-v0.4.md, §6.2. */
export const kingsCollector: CouncilCard = {
  id: 'kingsCollector',
  title: 'O Cobrador do Rei',
  text: 'O arauto voltou com companhia: o cobrador do rei, um homem de rosto fechado, e quatro soldados de brasão na mão. Diz que a coroa não esquece quem a esquece e que a conta, agora, vem com multa. Os soldados olham o portão como quem avalia a madeira.',
  weight: 0,
  autoResolve: {
    peasant: 'fine',
    lord: 'fine',
    ironKing: 'refuse',
  },
  options: [
    {
      id: 'fine',
      label: 'Pagar a multa dobrada',
      effects: [
        {
          type: 'resourcesPercent',
          resource: 'gold',
          ratio: {
            num: -30,
            den: 100,
          },
        },
        {
          type: 'morale',
          amount: -5,
          durationDays: 2,
        },
        {
          type: 'clearFlag',
          flag: 'tax.refused',
        },
      ],
      hint: 'Paga-se o dobro do que se devia, e o assunto morre.',
      chronicle:
        'No {dia}º dia {daEstacao}, o senhor de {feudo} pagou a multa dobrada ao cobrador do rei. Os soldados contaram os sacos e não levaram um a mais.',
      expiredChronicle:
        'No {dia}º dia {daEstacao}, sem palavra do senhor, o conselho de {feudo} pagou a multa dobrada ao cobrador do rei. Os soldados contaram os sacos e não levaram um a mais.',
    },
    {
      id: 'soldiers',
      label: 'Mostrar os soldados',
      requires: {
        minSoldiers: 10,
      },
      effects: [
        {
          type: 'morale',
          amount: 10,
          durationDays: 3,
        },
        {
          type: 'clearFlag',
          flag: 'tax.refused',
        },
        {
          type: 'setFlag',
          flag: 'tax.defied',
        },
        {
          type: 'scheduleCard',
          cardId: 'kingsAnswer',
          afterDays: 4,
        },
      ],
      hint: 'A fileira diante do portão pesa mais que a pena do escrivão.',
      chronicle:
        'No {dia}º dia {daEstacao}, o senhor de {feudo} pôs os soldados em fila diante do cobrador do rei. Ele olhou para a fileira, depois para o escrivão, e baixou a voz.',
    },
    {
      id: 'refuse',
      label: 'Mandar o cobrador embora',
      effects: [
        {
          type: 'morale',
          amount: 5,
          durationDays: 2,
        },
        {
          type: 'clearFlag',
          flag: 'tax.refused',
        },
        {
          type: 'setFlag',
          flag: 'tax.refusedTwice',
        },
        {
          type: 'scheduleCard',
          cardId: 'kingsAnswer',
          afterDays: 3,
        },
      ],
      hint: 'Duas recusas seguidas, e a coroa perde a paciência.',
      chronicle:
        'No {dia}º dia {daEstacao}, o senhor de {feudo} mandou o cobrador do rei embora de mãos vazias. Os soldados dele não se mexeram, e isso pesou mais que qualquer ameaça.',
      expiredChronicle:
        'No {dia}º dia {daEstacao}, sem palavra do senhor, o conselho de {feudo} mandou o cobrador do rei embora de mãos vazias. Os soldados dele não se mexeram, e isso pesou mais que qualquer ameaça.',
    },
  ],
};

/** Ficha aprovada: docs/content-v0.4.md, §6.3. */
export const kingsAnswer: CouncilCard = {
  id: 'kingsAnswer',
  title: 'A resposta da coroa',
  text: 'A carta do rei chegou lacrada. O cobrador escreveu à corte que o feudo tem soldados em fileira e vontade de usá-los, e a corte, por ora, prefere conversa a guerra. A coroa propõe um acordo; o conselho quer saber qual.',
  weight: 0,
  autoResolve: {
    peasant: 'tribute',
    lord: 'tribute',
    ironKing: 'hold',
  },
  variants: [
    {
      flag: 'tax.defied',
      text: 'A carta do rei chegou lacrada. O cobrador escreveu à corte que o feudo tem soldados em fileira e vontade de usá-los, e a corte, por ora, prefere conversa a guerra. A coroa propõe um acordo; o conselho quer saber qual.',
    },
    {
      flag: 'tax.refusedTwice',
      text: 'A carta do rei chegou lacrada, e o tom é de quem se cansou. Duas recusas pesaram mais que o ouro devido: a coroa manda dizer que cobrará o atraso, de um jeito ou de outro, e que os homens dela já sabem o caminho. O conselho quer saber o que o senhor responde.',
    },
  ],
  options: [
    {
      id: 'tribute',
      label: 'Pagar o tributo atrasado',
      effects: [
        {
          type: 'resourcesPercent',
          resource: 'gold',
          ratio: {
            num: -20,
            den: 100,
          },
        },
        {
          type: 'morale',
          amount: -5,
          durationDays: 2,
        },
        {
          type: 'clearFlag',
          flag: 'tax.defied',
        },
        {
          type: 'clearFlag',
          flag: 'tax.refusedTwice',
        },
      ],
      hint: 'O rei esquece rápido o que recebe em dia.',
      chronicle:
        'No {dia}º dia {daEstacao}, o senhor de {feudo} pagou o tributo atrasado. A carta do rei veio curta, e o selo não tinha cera demais.',
      expiredChronicle:
        'No {dia}º dia {daEstacao}, sem palavra do senhor, o conselho de {feudo} pagou o tributo atrasado. A carta do rei veio curta, e o selo não tinha cera demais.',
    },
    {
      id: 'envoy',
      label: 'Mandar um enviado à corte',
      cost: {
        gold: 80,
        food: 40,
      },
      effects: [
        {
          type: 'morale',
          amount: 5,
          durationDays: 2,
        },
        {
          type: 'clearFlag',
          flag: 'tax.defied',
        },
        {
          type: 'clearFlag',
          flag: 'tax.refusedTwice',
        },
      ],
      hint: 'Cartas e presentes compram tempo, e tempo compra paz.',
      chronicle:
        'No {dia}º dia {daEstacao}, o senhor de {feudo} mandou um enviado à corte com presentes e boas palavras. A coroa os aceitou, e o assunto foi arquivado.',
    },
    {
      id: 'hold',
      label: 'Manter a recusa',
      effects: [
        {
          type: 'resources',
          amounts: {
            food: -40,
            wood: -40,
          },
        },
        {
          type: 'morale',
          amount: 10,
          durationDays: 3,
        },
        {
          type: 'clearFlag',
          flag: 'tax.defied',
        },
        {
          type: 'clearFlag',
          flag: 'tax.refusedTwice',
        },
      ],
      hint: 'O povo canta a teimosia, e a despensa paga a conta.',
      chronicle:
        'No {dia}º dia {daEstacao}, o senhor de {feudo} manteve a recusa. Os homens do rei levaram o que acharam nos celeiros e no pátio da serraria, e o povo cantou de portão fechado.',
      expiredChronicle:
        'No {dia}º dia {daEstacao}, sem palavra do senhor, o conselho de {feudo} manteve a recusa. Os homens do rei levaram o que acharam nos celeiros e no pátio da serraria, e o povo cantou de portão fechado.',
    },
  ],
};
