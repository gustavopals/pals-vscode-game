export const PROTOCOL_PACKAGE_VERSION = '0.2.0';

/**
 * Versão do protocolo `/v1`. O cliente a envia em `X-Lords-Protocol`; um servidor que não a
 * atende responde `426 UPGRADE_REQUIRED`.
 *
 * - **1:** a v0.1 e a economia da v0.2 (o `ViewState` só cresceu por adição).
 * - **2:** o Conselho do Feudo (ADR 0014). `pendingDecisions` deixou de ser sempre vazio e o
 *   `ViewState` ganhou `council`: o app da versão 1 recusa a visão inteira ao ver uma carta, e
 *   por isso recebe o 426 com a instrução de recarregar a página, em vez de quebrar.
 */
export const PROTOCOL_VERSION = 2;

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
export * from './report';
export { canonicalJson } from './canonical';
export { contentHash } from './contentHash';
