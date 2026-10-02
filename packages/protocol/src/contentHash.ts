import {
  balance,
  buildings,
  chronicleTemplates,
  foundingTemplates,
  objectives,
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
export function contentHash(sha256Hex: (text: string) => string): string {
  return sha256Hex(
    canonicalJson({ balance, buildings, objectives, chronicleTemplates, foundingTemplates }),
  ).slice(0, 16);
}
