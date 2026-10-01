import type { Pool } from 'pg';

import type { Config } from './config';
import type { Db } from './db/client';

/** Relógio do servidor. É a única fonte de tempo: os testes injetam um relógio controlado. */
export type Clock = () => Date;

/** Pontos de falha injetáveis, usados só pelos testes de rollback. */
export type FaultHooks = {
  beforeCommandReceipt?: () => void | Promise<void>;
  afterRefreshTokenUsed?: () => void | Promise<void>;
};

/** Dependências compartilhadas por rotas, serviços e jobs. */
export type AppContext = {
  config: Config;
  pool: Pool;
  db: Db;
  clock: Clock;
  fetch: typeof fetch;
  hooks: FaultHooks;
};
