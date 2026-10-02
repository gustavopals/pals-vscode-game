import type { CouncilCard } from '../council';

/**
 * Cartas avulsas: não dependem de cadeia nenhuma. As duas daqui não pedem edifício nem estação,
 * para o sorteio ter o que tirar desde o primeiro dia de qualquer feudo. As outras dez do
 * primeiro lote (roadmap da v0.2, §12.2) entram em V2D-T2.
 *
 * Cada carta é uma constante exportada, escrita por extenso: nada de listas montadas com
 * espalhamento (`...`) ou chamadas no nível do módulo, que impedem o build do app de descartar
 * este arquivo (packages/web/src/bundle.test.ts).
 */
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
      cost: { stone: 30 },
      effects: [{ type: 'morale', amount: 5, durationDays: 2 }],
      hint: 'Mureta bem assentada dura mais que a queixa.',
      chronicle:
        'No {dia}º dia {daEstacao}, o senhor de {feudo} cedeu pedra para o poço da praça. A água voltou antes do segundo dia.',
    },
    {
      id: 'dig',
      label: 'Mandar o povo cavar',
      effects: [{ type: 'morale', amount: -5, durationDays: 1 }],
      hint: 'Braço cansado resmunga, mas a água volta.',
      chronicle:
        'No {dia}º dia {daEstacao}, o senhor de {feudo} mandou o povo desentulhar o poço com as próprias mãos. A água voltou; os resmungos também.',
      expiredChronicle:
        'No {dia}º dia {daEstacao}, sem palavra do senhor, o conselho de {feudo} mandou o povo desentulhar o poço com as próprias mãos. A água voltou; os resmungos também.',
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
          { type: 'morale', amount: -10, durationDays: 2 },
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

export const masonsMeal: CouncilCard = {
  id: 'masonsMeal',
  title: 'A refeição dos pedreiros',
  text: 'Os pedreiros largaram as ferramentas ao meio-dia. Pedem uma refeição quente antes de voltar à obra, e dizem que de barriga cheia o braço rende. A despensa é a mesma que alimenta o resto do feudo.',
  weight: 2,
  autoResolve: { peasant: 'bread', lord: 'bread', ironKing: 'refuse' },
  options: [
    {
      id: 'feast',
      label: 'Servir a refeição',
      cost: { food: 40 },
      effects: [{ type: 'morale', amount: 10, durationDays: 2 }],
      hint: 'Barriga cheia, ânimo alto.',
      chronicle:
        'No {dia}º dia {daEstacao}, o senhor de {feudo} mandou servir caldo e pão aos pedreiros. Cantou-se na obra até a tarde.',
    },
    {
      id: 'bread',
      label: 'Repartir o pão do dia',
      effects: [],
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
        { type: 'morale', amount: -5, durationDays: 2 },
      ],
      hint: 'A tarde rende mais pedra, e a obra guarda a mágoa.',
      chronicle:
        'No {dia}º dia {daEstacao}, o senhor de {feudo} mandou os pedreiros de volta à obra sem almoço. A tarde rendeu pedra; o ânimo, não.',
      expiredChronicle:
        'No {dia}º dia {daEstacao}, sem palavra do senhor, o capataz de {feudo} mandou os pedreiros de volta à obra sem almoço. A tarde rendeu pedra; o ânimo, não.',
    },
  ],
};
