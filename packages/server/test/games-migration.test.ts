import { createHash, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';

import type {
  ApiError,
  Command,
  CommandAccepted,
  EventsResponse,
  GameRuleError,
  ListGamesResponse,
  ViewResponse,
} from '@lotg/protocol';
import {
  canonicalJson,
  CommandAcceptedSchema,
  GameRuleErrorSchema,
  ViewResponseSchema,
} from '@lotg/protocol';
import { CURRENT_SCHEMA_VERSION } from '@lotg/engine';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { lockGame, persistState } from '../src/games/repository';
import { advanceStaleGames } from '../src/jobs/advanceStaleGames';
import { runJobsOnce } from '../src/jobs/scheduler';
import {
  call,
  countRows,
  createTestApp,
  DAY,
  fakeClock,
  HOUR,
  newPlayer,
  order,
  renew,
  send,
  signUp,
  type TestApp,
} from './helpers/app';
import { resetTestDb, truncateAll } from './helpers/db';

// Testes derivados da documentação: roadmap da v0.2, V2B-T1 (migração de `GameState` por
// `schemaVersion`), GDD §14.8 e §15.4 e ADR 0013, decisão 4. As linhas de partida são gravadas
// direto no banco, a partir de retratos feitos pelo motor da v0.1 (`schema_version = 1`).

const REPLAYED = 'x-lords-replayed';
