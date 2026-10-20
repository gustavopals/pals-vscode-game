import type { ItemId, ItemRarityId, ItemSlotId, Ratio } from './ids';

/**
 * O equipamento dos heróis (GDD §9.1; ADR 0018, decisão 15): três espaços, quatro raridades e um
 * catálogo enxuto. Um item vem do saque de uma expedição; equipado, multiplica o poder de quem o
 * leva, como os outros fatores do herói. **Desgasta e se repara** (V4B-T3; ADR 0019, decisão 5):
 * cada raridade tem uma durabilidade (`itemRarities[].durability`, em usos), e o Ferreiro refaz
 * o que se gastou. **Sem venda**: o único jeito de um item virar ouro é não caber no arsenal
 * (`balance.equipment.inventoryCap`), e vale o que o conteúdo diz, não a condição.
 * **Nenhum item é relíquia** (as relíquias são da Capela, na v0.5): nem o nome, nem a chave, nem
 * a frase de um item repete uma delas (revisão da Fase D, B23). Rascunho que o autor não leu.
 */
export type ItemDef = {
  /** "Lança de caça": como a ficha e a Crônica o chamam. */
  readonly label: string;
  /** Uma frase de crônica sobre o item, sem números. */
  readonly text: string;
  readonly slot: ItemSlotId;
  readonly rarity: ItemRarityId;
  /** O fator do poder de quem o leva: 21/20 é +5%. */
  readonly power: Ratio;
  /** O ouro que ele vale quando não há lugar no arsenal. */
  readonly value: number;
};

/** Como a ficha chama cada espaço. */
export const itemSlots: Record<ItemSlotId, { readonly label: string }> = {
  weapon: { label: 'Arma' },
  armor: { label: 'Armadura' },
  accessory: { label: 'Acessório' },
};

/** Como a ficha chama cada raridade. */
export const itemRarities: Record<
  ItemRarityId,
  { readonly label: string; readonly durability: number }
> = {
  // A durabilidade é o número de expedições concluídas que o item aguenta (ADR 0019, decisão 5).
  common: { label: 'Comum', durability: 8 },
  uncommon: { label: 'Incomum', durability: 10 },
  rare: { label: 'Raro', durability: 14 },
  epic: { label: 'Épico', durability: 20 },
};

/** **Na ordem de `ITEM_IDS`.** */
export const items: Record<ItemId, ItemDef> = {
  huntingSpear: {
    label: 'Lança de caça',
    text: 'Haste de freixo e ponta larga, feita para javali e boa para o resto.',
    slot: 'weapon',
    rarity: 'common',
    power: { num: 21, den: 20 },
    value: 30,
  },
  ashBow: {
    label: 'Arco de freixo',
    text: 'Curvado a vapor por quem sabia o que fazia. Atira longe e não range.',
    slot: 'weapon',
    rarity: 'uncommon',
    power: { num: 27, den: 25 },
    value: 60,
  },
  veltharBlade: {
    label: "Lâmina de Vel'Thar",
    text: 'Aço antigo, tirado das ruínas sem um ponto de ferrugem.',
    slot: 'weapon',
    rarity: 'rare',
    power: { num: 28, den: 25 },
    value: 120,
  },
  emberStaff: {
    label: 'Cajado de brasa',
    text: 'A ponta nunca esfria. Ninguém sabe dizer por quê.',
    slot: 'weapon',
    rarity: 'epic',
    power: { num: 23, den: 20 },
    value: 250,
  },
  paddedJerkin: {
    label: 'Gibão acolchoado',
    text: 'Lã batida entre duas camadas de linho. Segura mais do que parece.',
    slot: 'armor',
    rarity: 'common',
    power: { num: 21, den: 20 },
    value: 30,
  },
  boiledLeather: {
    label: 'Couro fervido',
    text: 'Duro como casca de carvalho, leve o bastante para um dia inteiro de marcha.',
    slot: 'armor',
    rarity: 'uncommon',
    power: { num: 27, den: 25 },
    value: 60,
  },
  riveredMail: {
    label: 'Cota rebitada',
    text: 'Anel por anel, rebitada à mão. Já salvou alguém antes de mudar de dono.',
    slot: 'armor',
    rarity: 'rare',
    power: { num: 28, den: 25 },
    value: 120,
  },
  wardenPlate: {
    label: 'Placas do guardião',
    text: 'Peitoral de um guardião de outro tempo, com as armas raspadas do metal.',
    slot: 'armor',
    rarity: 'epic',
    power: { num: 23, den: 20 },
    value: 250,
  },
  luckyCharm: {
    label: 'Figa de azeviche',
    text: 'Uma mãozinha fechada de pedra preta, num cordão. Quem a leva jura que anda com mais sorte.',
    slot: 'accessory',
    rarity: 'common',
    power: { num: 21, den: 20 },
    value: 30,
  },
  trackerHorn: {
    label: 'Corno de batedor',
    text: 'Um toque curto reúne a equipe na mata fechada.',
    slot: 'accessory',
    rarity: 'uncommon',
    power: { num: 27, den: 25 },
    value: 60,
  },
  travelerMedal: {
    label: 'Medalha do viajante',
    text: 'Gasta de tanto roçar no cordão, por mais estradas do que o dono contava. Dá firmeza a quem duvida.',
    slot: 'accessory',
    rarity: 'rare',
    power: { num: 28, den: 25 },
    value: 120,
  },
  captainChain: {
    label: 'Corrente do capitão',
    text: 'Elos grossos de prata, de quem já comandou homens. Quem a leva é ouvido primeiro.',
    slot: 'accessory',
    rarity: 'epic',
    power: { num: 23, den: 20 },
    value: 250,
  },
};

/**
 * As frases do arsenal e do equipamento na aba Guilda, com lacunas que o motor preenche. Nenhum
 * número de regra é escrito aqui. Rascunho que o autor não leu.
 */
export const equipmentTexts = {
  /** O que um item soma: `{percentual}` é o ganho de poder, em pontos percentuais. */
  bonus: '+{percentual}% de poder',
  /** O arsenal, no alto da lista: `{quantidade}` e `{teto}`. */
  inventory: 'Arsenal: {quantidade} de {teto} itens.',
  inventoryEmpty: 'O arsenal está vazio: os itens vêm das expedições.',
  /** O que acontece com o que não cabe. */
  inventoryFull: 'O arsenal está cheio: o próximo item que chegar é vendido pelo que vale.',
  /** Um espaço sem item. */
  emptySlot: 'vazio',
  /** A condição de um item inteiro. */
  conditionFull: 'Em perfeito estado.',
  /** A condição de um item usado: `{atual}` e `{total}` são usos. */
  condition: 'Condição: {atual} de {total} usos.',
  /** A condição de um item que chegou a zero. */
  conditionWorn: 'Gasto: não dá bônus até o Ferreiro repará-lo.',
  /** O que a forja está fazendo, para a tela: um lote de armas ou um reparo. */
  forgeWeapons: 'Lote de {quantidade} armas',
  forgeRepair: 'Reparo de {item}: {quantidade} pontos',
  /** Por que um item não pode ser reparado agora. */
  repairCarried: '{item} está com {heroi}: devolva-o ao arsenal antes de mandar reparar.',
  repairIntact: '{item} está inteiro.',
  repairBusy: 'A forja está ocupada: espere o trabalho dela terminar.',
  repairNoSmithy: 'Sem o Ferreiro não há reparo.',
  repairNoIron: 'Faltam {faltam} de ferro para o reparo de {item}.',
  /** O termo do poder de quem leva um item gasto: `{item}` é o nome dele. */
  breakdownWorn: '{item} gasto, sem bônus',
} as const;
