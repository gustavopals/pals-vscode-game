import type { CouncilCard } from '../council';

/**
 * Cartas roteirizadas: chegam em um dia marcado, uma vez por partida, na frente das sorteadas
 * (GDD §7.1). A ficha de cada uma está em docs/content-v0.3.md.
 *
 * Cada carta é uma constante exportada, escrita por extenso: nada de listas montadas com
 * espalhamento (`...`) ou chamadas no nível do módulo, que impedem o build do app de descartar
 * este arquivo (packages/web/src/bundle.test.ts).
 */

/**
 * "Estrangeira ferida" (GDD §2.2, §9.1 e Apêndice B, carta 1; ADR 0017, decisão 6): a carta que
 * entrega o primeiro herói, sem custo. As duas opções dão um herói, e a expiração também:
 * ninguém fica sem equipe porque estava fora. A partida que já passou do dia marcado a recebe
 * na primeira audiência com lugar.
 */
export const woundedStranger: CouncilCard = {
  id: 'woundedStranger',
  title: 'Estrangeira ferida',
  text: 'Os vigias acharam uma mulher caída à beira da estrada, de espada na mão e com um talho fundo no flanco. Diz chamar-se Edda e não pede esmola: pede um teto até a ferida fechar. A quem lhe der abrigo, oferece o braço e a palavra.',
  weight: 0,
  scripted: { atGameDay: 13 },
  autoResolve: { peasant: 'shelter', lord: 'shelter', ironKing: 'tend' },
  options: [
    {
      id: 'shelter',
      label: 'Acolher a estrangeira',
      effects: [{ type: 'addHero', heroId: 'edda' }],
      hint: 'Uma espada leal fica no feudo, e toda espada cobra soldo.',
      chronicle:
        'No {dia}º dia {daEstacao}, o senhor de {feudo} deu teto à estrangeira ferida. Edda jurou a espada ao feudo que a acolheu.',
      expiredChronicle:
        'No {dia}º dia {daEstacao}, sem palavra do senhor, o conselho de {feudo} deu teto à estrangeira ferida. Edda jurou a espada ao feudo que a acolheu.',
    },
    {
      id: 'tend',
      label: 'Cuidar e deixar partir',
      effects: [
        { type: 'resources', amounts: { gold: 40 } },
        { type: 'morale', amount: 5, durationDays: 1 },
        { type: 'addHero', heroId: 'rolf', afterDays: 1 },
      ],
      hint: 'Ela paga o cuidado em moedas, e diz que o irmão virá agradecer.',
      chronicle:
        'No {dia}º dia {daEstacao}, o senhor de {feudo} mandou tratar a estrangeira e a deixou seguir viagem. Edda pagou em moedas e prometeu mandar ao feudo o irmão, arqueiro de mão firme.',
      expiredChronicle:
        'No {dia}º dia {daEstacao}, sem palavra do senhor, as mulheres de {feudo} trataram a estrangeira, e ela seguiu viagem. Edda pagou em moedas e prometeu mandar ao feudo o irmão, arqueiro de mão firme.',
    },
  ],
};
