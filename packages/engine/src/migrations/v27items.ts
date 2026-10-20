// As tabelas da versão 27, à parte de `v27.ts` para o passo 26 → 27 (que vive em `v26.ts`) poder
// usá-las sem um ciclo de importação com a forma da versão 27.
// Como nas outras versões, os identificadores e os números ficam escritos aqui: a forma de uma
// versão não acompanha `@lotg/content`. O teste confere que hoje coincidem com o conteúdo
// (`itemRarities[].durability`, `items[].rarity`, `balance.smithy` e `balance.equipment`).
/** A durabilidade de cada raridade, em usos (V4B-T3; ADR 0019, decisão 5). */
export const DURABILITY_V27: Readonly<Record<string, number>> = {
  common: 8,
  uncommon: 10,
  rare: 14,
  epic: 20,
};
/** A raridade de cada item que o conteúdo tinha na versão 27. */
export const ITEM_RARITY_V27: Readonly<Record<string, string>> = {
  huntingSpear: 'common',
  ashBow: 'uncommon',
  veltharBlade: 'rare',
  emberStaff: 'epic',
  paddedJerkin: 'common',
  boiledLeather: 'uncommon',
  riveredMail: 'rare',
  wardenPlate: 'epic',
  luckyCharm: 'common',
  trackerHorn: 'uncommon',
  travelerMedal: 'rare',
  captainChain: 'epic',
};
/** A durabilidade que o passo dá a um item cuja chave o conteúdo já não tem: a do Comum. */
export const DURABILITY_UNKNOWN_V27 = 8;
/** A maior durabilidade de todas: o teto da condição de um item que o conteúdo já não tem. */
export const DURABILITY_CEILING_V27 = 20;
/** O maior lote de uma ordem de forja (`balance.smithy.batchMax`), sem mudança desde a 26. */
export const FORGE_BATCH_MAX_V27 = 10;
/** O arsenal guarda 30 itens (`balance.equipment.inventoryCap`). */
export const INVENTORY_CAP_V27 = 30;

/** A durabilidade de um item pela chave dele; a do Comum para o que o conteúdo já não tem. */
export function durabilityOfV27(defId: string): number {
  const rarity = Object.hasOwn(ITEM_RARITY_V27, defId) ? ITEM_RARITY_V27[defId] : undefined;
  return rarity === undefined ? DURABILITY_UNKNOWN_V27 : (DURABILITY_V27[rarity] as number);
}
