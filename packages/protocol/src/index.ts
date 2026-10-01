export const PROTOCOL_PACKAGE_VERSION = '0.1.0';

/**
 * Versão do protocolo `/v1`. O cliente a envia em `X-Lords-Protocol`; um servidor que não a
 * atende responde `426 UPGRADE_REQUIRED`.
 */
export const PROTOCOL_VERSION = 1;

export const API_PREFIX = '/v1';

/**
 * Cabeçalhos próprios da API.
 *
 * - `X-Lords-Protocol` e `X-Lords-Client`: versão do protocolo e do cliente, enviados em toda chamada.
 * - `X-Lords-State-Version`: opcional em `POST /commands`. É a `stateVersion` que o cliente
 *   conhecia ao decidir; se não for a persistida, a resposta vem com `staleView: true`. É só um
 *   aviso: a ação é validada contra o estado atual e nunca é bloqueada por isso. `If-Match` não
 *   é usado para esse fim.
 * - `X-Lords-Replayed: true`: a resposta é o recibo de um comando já registrado. O status e o
 *   corpo são os originais; o indicador de reenvio só existe no cabeçalho.
 *
 * `GET /view` usa `ETag` fraco (SHA-256 do corpo `{ view, stateVersion }`) e `If-None-Match`.
 * O ETag não é a `stateVersion`: produção e contagens regressivas mudam o corpo sem escrita no banco.
 */
export const HEADERS = {
  protocol: 'x-lords-protocol',
  client: 'x-lords-client',
  stateVersion: 'x-lords-state-version',
  replayed: 'x-lords-replayed',
} as const;

export * from './commands';
export * from './view';
export * from './errors';
export * from './api';
export * from './webview';
export { canonicalJson } from './canonical';
