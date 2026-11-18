import type { RelicId } from './ids';

/** Apêndice D e ADR 0022, D-5/D-8/D-9/D-10. Identificadores publicados e únicos. */
export const relics = {
  ancestralHorn: {
    label: 'Chifre dos Ancestrais',
    effectText: '+10 de moral do exército em batalha.',
    battleMorale: 10,
  },
  oakHeart: {
    label: 'Coração de Carvalho',
    effectText: 'Produção da Serraria +15%.',
    production: { num: 23, den: 20 },
  },
  watchersEye: {
    label: 'Olho do Vigia',
    effectText: 'Presságios com clareza de pelo menos Torre Nv3, sem aumentar a chance.',
    clarityLevel: 3,
  },
  ancientKingsSeal: {
    label: 'Selo do Rei Antigo',
    effectText: 'Metade do ouro pedido nas cartas Impostos do Rei e O Cobrador do Rei.',
    crownGold: { num: 1, den: 2 },
  },
  wolfBone: {
    label: 'Osso de Lobo',
    effectText: 'Ataque dos lobos −30%.',
    wolfAttack: { num: 7, den: 10 },
  },
  hermitsLamp: {
    label: 'Lâmpada do Eremita',
    effectText: 'Expedições com prazo de viagem 10% menor.',
    duration: { num: 9, den: 10 },
  },
  saltStone: {
    label: 'Pedra de Sal',
    effectText: 'Capacidade de comida +20%.',
    foodCapacity: { num: 6, den: 5 },
  },
  wintersCloak: {
    label: 'Manto do Inverno',
    effectText: 'Consumo de lenha −50%.',
    firewood: { num: 1, den: 2 },
  },
} as const satisfies Record<
  RelicId,
  { label: string; effectText: string } & Record<string, unknown>
>;

export const relicTexts = {
  chapelRequired: 'Erga a Capela para colocar uma relíquia.',
  notFound: 'Essa relíquia não está entre os tesouros do feudo.',
  noSlot: 'A Capela está sem espaço. Retire uma relíquia ou melhore a Capela.',
  alreadyPlaced: 'Essa relíquia já está colocada na Capela.',
  notPlaced: 'Essa relíquia já está guardada fora da Capela.',
  effective: 'Vale a partir da próxima virada de dia de jogo: em {prazo}.',
  active: 'Já está em vigor.',
};
