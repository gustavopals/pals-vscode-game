import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { balance, omenTexts } from '@lotg/content';
import { expect, it, vi } from 'vitest';
import { CommandSchema, ViewStateSchema } from '@lotg/protocol';
import { advanceTo, deriveViewState, type GameState } from '@lotg/engine';

import { cloneState } from '../../../engine/src/state';
import { currentShape } from '../../../engine/src/migrations';
import { newGame, WINTER, DAY, HOUR } from '../../../engine/src/test-helpers';
import type { GameRow } from '../db/schema';
import { loadGame } from './repository';
import { weakEtag } from './view';

/** Auditoria pontual da V4E-T5.1 sem escrever nem alterar arquivos de packages/web. */
it('9. o pacote de produção não leva números, memória, ondas ou textos escondidos da Fase E', async () => {
  // Usa a dependência do próprio app, sem acrescentar Vite ao motor.
  const webRequire = createRequire(new URL('../../../web/package.json', import.meta.url));
  const { build } = await import(webRequire.resolve('vite'));
  type Chunk = {
    type: string;
    code?: string;
    modules?: Record<string, { renderedExports: string[] }>;
  };
  type Output = { output: Chunk[] };
  let code = '';
  const carried: string[] = [];
  const forbiddenModules: string[] = [];
  vi.stubEnv('NODE_ENV', 'production');
  try {
    const result: Output | Output[] = await build({
      root: fileURLToPath(new URL('../../../web', import.meta.url)),
      logLevel: 'silent',
      build: { write: false },
    });
    for (const output of Array.isArray(result) ? result : [result]) {
      for (const chunk of output.output) {
        if (chunk.type !== 'chunk') continue;
        code += chunk.code;
        for (const [id, module] of Object.entries(chunk.modules ?? {})) {
          if (id.includes('/packages/content/src/')) carried.push(...module.renderedExports);
          if (/\/packages\/(engine|server)\//.test(id)) forbiddenModules.push(id);
        }
      }
    }
  } finally {
    vi.unstubAllEnvs();
  }
  expect(code.length).toBeGreaterThan(50_000);
  expect(carried).toContain('UNIT_IDS');
  // A mesma lista fechada da auditoria do app: nem identificadores secretos podem entrar.
  const allowed = [
    'BUILDING_IDS',
    'RELIC_IDS',
    'SCENARIO_IDS',
    'TERRAIN_IDS',
    'VOW_IDS',
    'DIFFICULTY_IDS',
    'ENEMY_IDS',
    'EVENT_TYPES',
    'ITEM_SLOT_IDS',
    'MARKET_RESOURCE_IDS',
    'MORALE_BAND_IDS',
    'MORALE_TERM_IDS',
    'PRODUCTION_BUILDING_IDS',
    'RESOURCE_IDS',
    'SEASON_IDS',
    'TRADE_DIRECTION_IDS',
    'UNIT_IDS',
    'WING_IDS',
    'LINE_IDS',
  ];
  expect(carried.filter((name) => !allowed.includes(name))).toEqual([]);
  expect(forbiddenModules).toEqual([]);
  const markers = [
    'hpByLevel:',
    'quarterMs:',
    'stoneRatio:',
    'counterWeights:',
    'chancePercent:',
    'clarityByLevel:',
  ];
  const table = JSON.stringify({
    wall: balance.wall,
    horde: balance.horde,
    omens: balance.omens,
  }).replace(/"([A-Za-z_$][\w$]*)":/g, '$1:');
  expect(markers.filter((marker) => !table.includes(marker))).toEqual([]);
  expect(markers.filter((marker) => code.includes(marker))).toEqual([]);
  expect(
    ['lastFormationSeen', 'wavePlan', 'prepareWaves', 'compositionWeights'].filter((secret) =>
      code.includes(secret),
    ),
  ).toEqual([]);
  const phrases = [omenTexts.partial, omenTexts.exact, ...Object.values(omenTexts.vague)];
  expect(phrases.filter((phrase) => code.includes(phrase))).toEqual([]);
});

it('protocolo e ETag do servidor não distinguem a composição escondida sem Torre', () => {
  const state = newGame('v4e-servidor');
  state.horde.scheduledRaids = [
    {
      id: 'secret',
      atMs: HOUR,
      kind: 'threat',
      enemy: 'horde',
      size: 'strong',
      announcedAtMs: null,
      composition: [{ wing: 'left', line: 'front', unit: 'ogre', count: 12 }],
    },
  ];
  const other = cloneState(state);
  other.horde.scheduledRaids[0]!.composition = [
    { wing: 'center', line: 'back', unit: 'shaman', count: 7 },
  ];
  const first = { view: ViewStateSchema.parse(deriveViewState(state, 0)), stateVersion: '1' };
  const second = { view: ViewStateSchema.parse(deriveViewState(other, 0)), stateVersion: '1' };
  expect(second).toEqual(first);
  expect(weakEtag(second)).toBe(weakEtag(first));
  expect(ViewStateSchema.safeParse({ ...first.view, horde: state.horde }).success).toBe(false);
  expect(
    ViewStateSchema.safeParse({ ...first.view, army: { ...first.view.army, wavePlan: {} } })
      .success,
  ).toBe(false);
});

it('as ordens da Fase E recusam estado, custo e prazo escolhidos pelo cliente', () => {
  const base = {
    commandId: '11111111-1111-4111-8111-111111111111',
    type: 'repairWall',
    payload: {},
  };
  expect(CommandSchema.parse(base)).toEqual(base);
  for (const payload of [
    { untilMs: 0 },
    { toHp: { left: 999 } },
    { cost: 0 },
    { composition: [] },
  ]) {
    expect(CommandSchema.safeParse({ ...base, payload }).success).toBe(false);
  }
  const deletion = { ...base, type: 'deleteFormation', payload: { id: 'formation-1' } };
  expect(CommandSchema.parse(deletion)).toEqual(deletion);
  expect(
    CommandSchema.safeParse({ ...deletion, payload: { ...deletion.payload, force: true } }).success,
  ).toBe(false);
});

it('o carregador do servidor migra o retrato de inverno sem eventos retroativos nem sorteio', () => {
  const old = JSON.parse(
    readFileSync(
      new URL('../../../engine/src/__fixtures__/state-v33-fresh.json', import.meta.url),
      'utf8',
    ),
  ) as GameState;
  const atMs = WINTER + DAY / 2;
  old.lastProcessedAt = atMs;
  old.clock.gameTimeMs = atMs;
  old.horde.scheduledRaids = [];
  const createdAt = new Date('2026-10-20T12:00:00Z');
  const row: GameRow = {
    id: '11111111-1111-4111-8111-111111111111',
    accountId: '22222222-2222-4222-8222-222222222222',
    seasonId: null,
    status: 'active',
    seed: old.seed,
    difficulty: 'lord',
    timeScale: '1',
    timezone: old.settings.timezone,
    vigilHour: old.settings.vigilHourLocal,
    schemaVersion: 33,
    state: old,
    stateVersion: 1,
    createdAt,
    lastProcessedAt: new Date(createdAt.getTime() + atMs),
    updatedAt: createdAt,
  };
  const before = JSON.stringify(row);
  const loaded = loadGame(row);
  expect(JSON.stringify(row)).toBe(before);
  expect(loaded.migratedFrom).toBe(33);
  expect(loaded.state.rng).toEqual(old.rng);
  expect(loaded.state.horde.wavePlan).toBeNull();
  expect(currentShape(loaded.state, '')).toBeNull();
  const advanced = advanceTo(loaded.state, WINTER + DAY);
  expect(advanced.events.filter((e) => e.type === 'fortressAppeared')).toEqual([]);
  expect(advanced.state.map.tiles.hordeFortress?.threatActive).toBe(true);
  expect(advanced.state.horde.wavePlan?.generatedAtMs).toBe(WINTER + DAY);
  expect(advanced.state.siege?.atMs).toBeGreaterThan(WINTER + DAY);
  expect(ViewStateSchema.parse(deriveViewState(advanced.state, WINTER + DAY))).toEqual(
    deriveViewState(advanced.state, WINTER + DAY),
  );
  expect(currentShape(advanced.state, '')).toBeNull();
});
