import {
  balance,
  buildings,
  chronicleTemplates,
  coldReliefs,
  councilCards,
  craftGuilds,
  enemies,
  foundingTemplates,
  idleVillager,
  injuredLoss,
  injuryTemplates,
  moraleBandTemplates,
  objectives,
  raidSizes,
  raidTemplates,
  startingTiles,
  threatMarkTemplates,
  tileTypes,
} from '@lotg/content';

import { canonicalJson } from './canonical';

/**
 * O `contentHash` de `GET /version` e de `GET /catalog`: os 16 primeiros caracteres, em
 * hexadecimal, do SHA-256 do JSON canônico do conteúdo de jogo. Muda sempre que um número ou
 * um texto de `@lotg/content` muda.
 *
 * Este pacote não importa módulos do Node, então quem chama entrega o SHA-256. O servidor e o
 * simulador usam esta mesma função: um relatório de balanceamento e o servidor que está no ar
 * dizem o mesmo hash para o mesmo conteúdo. Conteúdo novo (cartas, tiles) entra na lista daqui.
 */
/**
 * O que entra no resumo: todos os números e todos os textos de jogo. As frases que só entram
 * dentro de outras (o alívio do frio, os ofícios, quem parte sem ofício) e as frases de cada
 * faixa da moral também contam: mudá-las muda o que o jogador lê. As cartas do Conselho
 * entram inteiras: texto, opções, custos, efeitos (os escondidos também) e a ordem do catálogo,
 * que faz parte do sorteio. Da Ameaça entram os tiles, os inimigos, os nomes dos tamanhos de
 * incursão e as frases de cada marca; os números dela, e os da Paliçada, estão em `balance`. Das
 * incursões entram as frases de cada inimigo (o aviso, o desfecho, o conselho) e as de quem se
 * fere e sara; os números (o roteiro, o estrago, o ferimento, a moral) estão em `balance.raids`.
 */
function hashedContent(): Record<string, unknown> {
  return {
    balance,
    buildings,
    objectives,
    chronicleTemplates,
    foundingTemplates,
    coldReliefs,
    craftGuilds,
    moraleBandTemplates,
    idleVillager,
    councilCards,
    tileTypes,
    startingTiles,
    enemies,
    raidSizes,
    threatMarkTemplates,
    raidTemplates,
    injuryTemplates,
    injuredLoss,
  };
}

export function contentHash(sha256Hex: (text: string) => string): string {
  return sha256Hex(canonicalJson(hashedContent())).slice(0, 16);
}
