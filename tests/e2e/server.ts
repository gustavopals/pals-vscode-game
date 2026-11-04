import { balance, type ItemId, itemRarities, items } from '../../packages/content/src/index';
import { advanceTo, type GameState } from '../../packages/engine/src/index';
import type { FastifyInstance } from 'fastify';

import { buildApp } from '../../packages/server/src/app';
import { runJobsOnce } from '../../packages/server/src/jobs/scheduler';
import { forgetStats } from '../../packages/server/src/stats/service';
import { testConfig } from '../../packages/server/test/helpers/app';
import { createTestPool, resetTestDb, truncateAll } from '../../packages/server/test/helpers/db';
import { fakeGithub } from '../../packages/server/test/helpers/github';

/**
 * A API de verdade para os testes em navegador, contra o banco de teste, com três coisas que só
 * existem aqui: um relógio que os testes adiantam, um GitHub de mentira e rotas `/__test` para
 * comandar os dois. Nada disto está no código de produção.
 */

process.env.TEST_DATABASE_URL ??= 'postgres://lotg:lotg@localhost:5433/lotg_test';

const PORT = Number(process.env.E2E_API_PORT ?? 3100);
const GITHUB = 'https://github.test';
/**
 * O ritmo com que as partidas nascem quando o jogador não escolhe outro. A suíte foi escrita no
 * ritmo Normal (1) e é nele que roda. `GAME_TIME_SCALE=3` sobe este servidor como o da produção
 * (ADR 0011): o Rápido vem marcado nas boas-vindas. Só os cenários de "ritmo da produção" de
 * `03-retorno-e-conexao.spec.ts` valem nos dois casos, porque fundam o feudo no Rápido de
 * qualquer jeito; os outros esperam os prazos do ritmo 1.
 */
const TIME_SCALE = process.env.GAME_TIME_SCALE?.trim() || '1';

let offsetMs = 0;
const clock = () => new Date(Date.now() + offsetMs);
const github = fakeGithub({ api: GITHUB, oauth: GITHUB });

await resetTestDb();
const pool = createTestPool();
const { app, ctx } = await buildApp({
  config: testConfig({
    PUBLIC_URL: `http://localhost:${PORT}`,
    GITHUB_OAUTH_URL: GITHUB,
    GITHUB_CLIENT_ID: 'cliente-e2e',
    GAME_TIME_SCALE: TIME_SCALE,
  }),
  pool,
  clock,
  fetch: github.fetch,
  logger: false,
});

// As rotas de controle ficam fora de `/v1`: o app nunca as alcança pelo repasse.
const control = app as unknown as FastifyInstance;

/** Esvazia o reino e volta o relógio e o GitHub ao começo. */
control.post('/__test/reset', async () => {
  await truncateAll(pool);
  offsetMs = 0;
  github.reset();
  // O Reino guardado (ADR 0021) era do mundo anterior.
  forgetStats(ctx);
  return { ok: true };
});

/** Adianta o relógio do servidor. O teste adianta o do navegador na mesma medida. */
control.post('/__test/advance', async (request) => {
  const { ms } = request.body as { ms: number };
  offsetMs += ms;
  return { now: clock().toISOString() };
});

control.post('/__test/jobs', async () => runJobsOnce(ctx));

/**
 * Põe o Conselho de todos os feudos em recesso: a próxima audiência vai para um futuro que
 * teste nenhum alcança. As cartas chegam por sorteio, de 8 em 8 horas no ritmo Normal, e mexem
 * na moral, nos avisos e na barra de status; os cenários que não são sobre o Conselho não podem
 * depender de qual carta a semente tirou. Quem funda o feudo pela página chama isto antes de a
 * resposta chegar a ela (`helpers.ts`), a menos que o teste tenha convocado o conselho. Só o
 * instante do próximo sorteio muda; o resto do estado é o que o motor criou.
 */
const RECESS_UNTIL_GAME_MS = 100 * 365 * 24 * 3_600_000;
control.post('/__test/council-recess', async () => {
  await pool.query(
    `update games set state = jsonb_set(state, '{council,nextDrawAtMs}', to_jsonb($1::bigint))`,
    [RECESS_UNTIL_GAME_MS],
  );
  return { ok: true };
});

/**
 * Põe uma carta do catálogo na mesa do Conselho de todos os feudos, agora, com o prazo pedido
 * (24 horas de relógio, se nenhum for dado). Com o conselho em recesso, é como um teste escolhe
 * qual carta está à espera: o sorteio depende da semente e do catálogo, que cresce. A carta entra
 * como chegaria do sorteio, sem escolha anterior; daí em diante o motor cuida dela: a resposta,
 * a expiração e a continuação que a opção marcar são as de verdade. Só não há a linha da
 * chegada na Crônica, porque nenhum evento foi emitido.
 */
control.post('/__test/council-deal', async (request) => {
  const { cardId, expiresInMs = 24 * 3_600_000 } = request.body as {
    cardId: string;
    expiresInMs?: number;
  };
  const games = await pool.query<{ id: string; created_at: Date; time_scale: string }>(
    'select id, created_at, time_scale from games',
  );
  for (const game of games.rows) {
    const scale = Number(game.time_scale);
    // O instante de agora em tempo de jogo, como o servidor o calcula, e o prazo convertido.
    const nowMs = Math.floor((clock().getTime() - game.created_at.getTime()) * scale);
    const card = {
      instanceId: `${cardId}-posta-${nowMs}`,
      cardId,
      drawnAtMs: nowMs,
      expiresAtMs: nowMs + Math.round(expiresInMs * scale),
      origin: null,
    };
    await pool.query(
      `update games
          set state = jsonb_set(state, '{council,pending}',
                                (state -> 'council' -> 'pending') || $2::jsonb)
        where id = $1`,
      [game.id, JSON.stringify([card])],
    );
  }
  return { ok: true };
});

/**
 * Cala a Horda de todos os feudos: no lugar das incursões marcadas fica uma só, para daqui a mil
 * anos de jogo. Como só há uma incursão marcada por vez, os lobos do roteiro não vêm (nem os
 * uivos que os anunciam) e a Ameaça não sorteia outra; ela continua subindo como sempre. Toda
 * partida nova tem os uivos na hora 18 e os lobos na hora 30 de jogo, e eles mexem nos estoques,
 * na moral, nos braços e nos avisos; os cenários que não são sobre a incursão não podem depender
 * disso. Quem funda o feudo pela página chama isto antes de a resposta chegar a ela
 * (`helpers.ts`), a menos que o teste tenha soltado os lobos (`world.wolvesRoam()`). É o mesmo
 * que `quietHorde` faz nos testes de integração do servidor.
 */
const NEVER_GAME_MS = 1000 * 84 * 2 * 3_600_000;
/** Relatório de uma batalha real, com a Defesa ativa do cenário; nunca existe em produção. */
control.post('/__test/battle', async () => {
  const games = await pool.query<{ id: string; state: GameState }>('select id, state from games');
  for (const game of games.rows) {
    const atMs = game.state.lastProcessedAt + 1;
    game.state.horde.scheduledRaids = [
      {
        id: 'threat-1',
        kind: 'threat',
        enemy: 'raiders',
        size: 'medium',
        atMs,
        announcedAtMs: null,
        composition: [
          { wing: 'left', line: 'front', unit: 'raider', count: 6 },
          { wing: 'center', line: 'front', unit: 'wolf', count: 10 },
          { wing: 'center', line: 'back', unit: 'banditArcher', count: 4 },
        ],
      },
    ];
    const result = advanceTo(game.state, atMs);
    await pool.query('update games set state = $2::jsonb where id = $1', [
      game.id,
      JSON.stringify(result.state),
    ]);
  }
  return { ok: true };
});

/**
 * Cerco já marcado a N minutos reais, com exércitos de referência pequenos ou esmagadores.
 * Só a preparação é posta de fora; plano, intervalo, batalha, dano e Queda usam o motor real.
 * Não serve para medir balanceamento nem substitui os cenários de calendário do motor.
 */
control.post('/__test/siege', async (request) => {
  const { inMinutes = 2, opposition = 'small' } = (request.body ?? {}) as {
    inMinutes?: number;
    opposition?: 'small' | 'overwhelming';
  };
  const games = await pool.query<{ id: string; state: GameState }>('select id, state from games');
  for (const game of games.rows) {
    const { state } = game;
    state.settlement.buildings.barracks = 5;
    state.settlement.buildings.palisade = 3;
    state.settlement.buildings.watchtower = 3;
    state.settlement.wall.hp = { left: 40, center: 40, right: 40 };
    state.army.units.knight = 60;
    state.army.units.archer = 60;
    state.ids.formation = (state.ids.formation ?? 0) + 2;
    const formations = [state.ids.formation - 1, state.ids.formation].map((number, index) => ({
      id: `formation-${number}`,
      name: index === 0 ? 'Muralha Firme' : 'Guarda do Inverno',
      posts: {
        left: {
          front: { unit: 'knight' as const, count: 20 },
          back: { unit: 'archer' as const, count: 20 },
        },
        center: {
          front: { unit: 'knight' as const, count: 20 },
          back: { unit: 'archer' as const, count: 20 },
        },
        right: {
          front: { unit: 'knight' as const, count: 20 },
          back: { unit: 'archer' as const, count: 20 },
        },
      },
      commanders: { left: null, center: null, right: null },
    }));
    state.army.formations = formations;
    state.army.activeFormationId = opposition === 'small' ? formations[0]!.id : null;
    if (opposition === 'overwhelming') {
      state.army.units.knight = 0;
      state.army.units.archer = 0;
      state.settlement.wall.hp = { left: 0, center: 0, right: 0 };
    }
    const atMs = state.lastProcessedAt + inMinutes * 60_000 * state.settings.timeScale;
    state.siege = {
      year: 1,
      atMs,
      current: 0,
      nextWaveAtMs: atMs,
      plan: { 1: null, 2: null, 3: null },
      result: null,
      breached: false,
      deaths: 0,
      endedAtMs: null,
      aftermathUntilMs: null,
      waves: ([1, 2, 3] as const).map((number) => ({
        number,
        composition: [
          {
            wing: 'left',
            line: 'front',
            unit: opposition === 'small' ? 'raider' : 'ogre',
            count: opposition === 'small' ? 1 : 100,
          },
          { wing: 'center', line: 'front', unit: number === 3 ? 'warlord' : 'raider', count: 1 },
          {
            wing: 'right',
            line: 'front',
            unit: opposition === 'small' ? 'raider' : 'ogre',
            count: opposition === 'small' ? 1 : 100,
          },
        ],
      })),
    };
    await pool.query('update games set state = $2::jsonb where id = $1', [
      game.id,
      JSON.stringify(state),
    ]);
  }
  return { ok: true };
});

control.post('/__test/horde-quiet', async () => {
  const never = {
    id: 'never',
    atMs: NEVER_GAME_MS,
    kind: 'threat',
    enemy: 'wolves',
    size: 'light',
    // Desde o estado 33 (V4E-T2.2) a incursão marcada leva a composição; `null` luta com a
    // composição-base da estação, sem sorteio.
    composition: null,
    announcedAtMs: null,
  };
  await pool.query(
    `update games set state = jsonb_set(state, '{horde,scheduledRaids}', $1::jsonb)`,
    [JSON.stringify([never])],
  );
  return { ok: true };
});

/** Incursão anunciada com prazo escolhido pelo cenário da campanha; só existe neste servidor. */
control.post('/__test/raid-in', async (request) => {
  const { inSeconds } = request.body as { inSeconds: number };
  const games = await pool.query<{ id: string; state: GameState }>('select id, state from games');
  for (const game of games.rows) {
    const { state } = game;
    state.horde.scheduledRaids = [
      {
        id: 'threat-1',
        kind: 'threat',
        enemy: 'raiders',
        size: 'medium',
        atMs:
          state.lastProcessedAt +
          Math.max(1, Math.round(inSeconds * 1000 * state.settings.timeScale)),
        announcedAtMs: state.lastProcessedAt,
        composition: [{ wing: 'center', line: 'front', unit: 'raider', count: 2 }],
      },
    ];
    await pool.query('update games set state = $2::jsonb where id = $1', [
      game.id,
      JSON.stringify(state),
    ]);
  }
  return { ok: true };
});

/**
 * Põe um edifício de todos os feudos em um nível, sem obra: é como um teste da incursão tem a
 * Torre de Vigia ou a Paliçada de pé antes da hora dos lobos, sem jogar as dezenas de horas que
 * o Salão do Senhor leva para liberá-las (a obra de verdade é coberta pelos cenários da Torre e
 * pelos testes do servidor). Só o nível muda; daí em diante o aviso, a defesa e o desfecho são
 * os do motor. Serve também à Taverna: posta de pé assim, ela ganha os candidatos no primeiro
 * avanço do motor (a leitura seguinte), ancorados no instante em que o estado estava. E à Guilda
 * dos Aventureiros, que abre os destinos na leitura seguinte.
 */
control.post('/__test/raise', async (request) => {
  const { building, level } = request.body as { building: string; level: number };
  await pool.query(
    `update games
        set state = jsonb_set(state, array['settlement', 'buildings', $1::text], to_jsonb($2::int))`,
    [building, level],
  );
  // A Paliçada posta assim tem a muralha cheia no nível pedido (V4E-T1): a guarda do estado
  // recusa uma ala acima da vida do nível, e a muralha vazia seria uma muralha derrubada.
  if (building === 'palisade') {
    const hp = level > 0 ? (balance.wall.hpByLevel[Math.min(level, 6) - 1] ?? 0) : 0;
    await pool.query(
      `update games
          set state = jsonb_set(state, array['settlement', 'wall'],
                                jsonb_build_object('hp', jsonb_build_object(
                                  'left', $1::int, 'center', $1::int, 'right', $1::int)))`,
      [hp],
    );
  }
  return { ok: true };
});

/**
 * Põe a vida de cada ala da muralha de todos os feudos em uma porcentagem da vida cheia do nível
 * da Paliçada (`{ percent }`), sem passar por uma batalha: é como um cenário do reparo tem a
 * muralha danificada sem depender do desfecho de um combate. O reparo, o custo e o prazo daí em
 * diante são os do motor.
 */
control.post('/__test/wall', async (request) => {
  const { percent } = request.body as { percent: number };
  const games = await pool.query<{ id: string; state: GameState }>('select id, state from games');
  for (const game of games.rows) {
    const level = game.state.settlement.buildings.palisade;
    const full = level > 0 ? (balance.wall.hpByLevel[Math.min(level, 6) - 1] ?? 0) : 0;
    const hp = Math.floor((full * percent) / 100);
    game.state.settlement.wall.hp = { left: hp, center: hp, right: hp };
    await pool.query('update games set state = $2::jsonb where id = $1', [
      game.id,
      JSON.stringify(game.state),
    ]);
  }
  return { ok: true };
});

/**
 * Põe um presságio vago (a onda 2) na mente da Horda de todos os feudos, com a preparação do ano
 * que o guarda exige (V4E-T3): é como um cenário da aba Exército tem o que ler sem esperar o
 * sorteio dos vigias. O texto é o que a visão devolverá; o presságio nunca revela posto.
 */
control.post('/__test/omen', async () => {
  const games = await pool.query<{ id: string; state: GameState }>('select id, state from games');
  for (const game of games.rows) {
    const { state } = game;
    state.horde.wavePlan = {
      year: state.clock.year,
      revision: 1,
      generatedAtMs: state.lastProcessedAt,
      waves: ([1, 2, 3] as const).map((number) => ({
        number,
        composition: [{ wing: 'center', line: 'front', unit: 'wolf', count: 10 }],
      })),
    };
    state.horde.omens = [
      {
        atMs: state.lastProcessedAt,
        revision: 1,
        clarity: 'vague',
        wave: 2,
        text: 'A terra treme ao anoitecer: algo grande se move na serra.',
        reveals: [],
      },
    ];
    await pool.query('update games set state = $2::jsonb where id = $1', [
      game.id,
      JSON.stringify(state),
    ]);
  }
  return { ok: true };
});

/**
 * Põe soldados no exército de todos os feudos (`{ units: { spearman: 6, ... } }`), sem passar
 * pelo treino: é como um cenário do editor de formação tem tropa sem esperar os lotes. Só a
 * contagem de `army.units` muda; daí em diante a fome, o limite e as formações são as do motor.
 */
control.post('/__test/soldiers', async (request) => {
  const { units } = request.body as { units: Record<string, number> };
  for (const [unit, count] of Object.entries(units)) {
    await pool.query(
      `update games
          set state = jsonb_set(state, array['army', 'units', $1::text], to_jsonb($2::int))`,
      [unit, count],
    );
  }
  return { ok: true };
});

/**
 * Põe o estoque de um recurso de todos os feudos em um valor, em unidades: é como um teste da
 * Taverna tem o ouro de uma contratação ou a comida de um festival sem jogar as horas que a
 * produção leva para juntá-los. O resto do acumulador do recurso é zerado, para o número ser
 * exato; daí em diante a produção, o consumo, o soldo e o limite do depósito são os do motor
 * (o que passa do limite fica como está e não recebe produção).
 */
control.post('/__test/stock', async (request) => {
  const { resource, amount } = request.body as { resource: string; amount: number };
  await pool.query(
    `update games
        set state = jsonb_set(
              jsonb_set(state, array['settlement', 'resources', $1::text],
                        to_jsonb(($2::bigint) * 1000)),
              array['settlement', 'accumulators', $1::text], '0'::jsonb)`,
    [resource, Math.trunc(amount)],
  );
  return { ok: true };
});

/**
 * Põe a equipe de todos os feudos parada em uma encruzilhada, agora, sem depender da semente
 * (a variante do grafo de uma expedição sai de uma conta sobre ela): ergue a Guilda dos
 * Aventureiros, se ainda não está de pé, e grava uma expedição à Floresta Antiga na encruzilhada
 * da primeira variante, com o primeiro herói que está no feudo, a Postura pedida e o prazo pedido
 * (6 horas de relógio, se nenhum for dado). O feudo sem herói no feudo fica como está. Daí em
 * diante o motor cuida dela: a escolha, o prazo, o nó seguinte e a volta são os de verdade. Só
 * não há a linha da partida nem a da chegada à encruzilhada na Crônica, porque nenhum evento
 * foi emitido. É para os cenários em navegador da interface das expedições (V3D-T4).
 */
control.post('/__test/crossroads', async (request) => {
  const { posture = 'balanced', expiresInMs = 12 * 3_600_000 } = (request.body ?? {}) as {
    posture?: 'cautious' | 'balanced' | 'bold';
    expiresInMs?: number;
  };
  type Stored = {
    lastProcessedAt: number;
    ids: Record<string, number>;
    settlement: { buildings: Record<string, number> };
    guild: {
      heroes: Array<{ id: string; status: string }>;
      expeditions: unknown[];
    };
  };
  const games = await pool.query<{
    id: string;
    created_at: Date;
    time_scale: string;
    state: Stored;
  }>('select id, created_at, time_scale, state from games');
  let placed = 0;
  for (const game of games.rows) {
    const { state } = game;
    const hero = state.guild.heroes.find((entry) => entry.status === 'idle');
    if (hero === undefined) {
      continue;
    }
    const scale = Number(game.time_scale);
    const nowMs = Math.floor((clock().getTime() - game.created_at.getTime()) * scale);
    const number = (state.ids.expedition ?? 0) + 1;
    hero.status = 'expedition';
    state.ids.expedition = number;
    state.settlement.buildings.guild = Math.max(1, state.settlement.buildings.guild ?? 0);
    state.guild.expeditions.push({
      id: `expedition-${number}`,
      modelId: 'oldForest',
      variant: 0,
      heroIds: [hero.id],
      posture,
      sentAtMs: state.lastProcessedAt,
      durationFactor: { num: 1, den: 1 },
      status: 'atCrossroads',
      nodeId: 'fork',
      nodeEndsAtMs: null,
      crossroads: { decidesAtMs: nowMs + Math.max(1, Math.round(expiresInMs * scale)) },
      loot: { resources: { food: 0, wood: 0, stone: 0, gold: 0, iron: 0 }, items: [] },
      log: [],
    });
    await pool.query('update games set state = $2::jsonb where id = $1', [
      game.id,
      JSON.stringify(state),
    ]);
    placed += 1;
  }
  return { ok: true, placed };
});

/**
 * Põe um herói no feudo de todos os reinos, pronto, sem carta nem Taverna: é como um cenário das
 * expedições tem equipe sem depender de quem o sorteio da Taverna ofereceu (o nome de um
 * candidato dentro de uma frase já quebrou um teste, em uma semente em sete). O herói nasce com
 * o identificador seguinte do contador do estado, no nível e com a classe pedidos, sem traço e
 * sem item; daí em diante o soldo, o poder, a experiência e o que acontece a ele em uma
 * expedição são os do motor. O teto da lista de heróis do motor continua valendo: a rota não
 * passa de doze.
 */
control.post('/__test/hero', async (request) => {
  const {
    name,
    classId = 'warrior',
    level = 1,
    gender = 'm',
  } = request.body as { name: string; classId?: string; level?: number; gender?: 'f' | 'm' };
  type Stored = {
    lastProcessedAt: number;
    ids: Record<string, number>;
    guild: { heroes: unknown[] };
  };
  const games = await pool.query<{ id: string; state: Stored }>('select id, state from games');
  for (const game of games.rows) {
    const { state } = game;
    if (state.guild.heroes.length >= 12) {
      continue;
    }
    const number = (state.ids.hero ?? 0) + 1;
    state.ids.hero = number;
    state.guild.heroes.push({
      id: `hero-${number}`,
      name,
      gender,
      classId,
      level,
      xp: 0,
      traits: [],
      status: 'idle',
      injury: null,
      captivity: null,
      equipment: { weapon: null, armor: null, accessory: null },
      joinedAtMs: state.lastProcessedAt,
      freedAtMs: null,
      discontent: false,
    });
    await pool.query('update games set state = $2::jsonb where id = $1', [
      game.id,
      JSON.stringify(state),
    ]);
  }
  return { ok: true };
});

/**
 * Põe um item do conteúdo no arsenal de todos os feudos, com o identificador seguinte do
 * contador do estado: é como um cenário do equipamento tem o que equipar sem depender do item
 * que uma expedição sorteou. Daí em diante equipar, desequipar e o que o item soma ao poder são
 * os do motor.
 */
control.post('/__test/item', async (request) => {
  const { defId, condition } = request.body as { defId: string; condition?: number };
  type Stored = { ids: Record<string, number>; guild: { inventory: unknown[] } };
  const games = await pool.query<{ id: string; state: Stored }>('select id, state from games');
  for (const game of games.rows) {
    const { state } = game;
    const number = (state.ids.item ?? 0) + 1;
    state.ids.item = number;
    // O item nasce inteiro, como o motor o cria: a condição é a durabilidade da raridade (V4B-T3).
    const def = items[defId as ItemId];
    state.guild.inventory.push({
      id: `item-${number}`,
      defId,
      // `condition` põe um item já gasto no arsenal (0 = sem bônus), para os cenários do reparo.
      condition: condition ?? itemRarities[def.rarity].durability,
    });
    await pool.query('update games set state = $2::jsonb where id = $1', [
      game.id,
      JSON.stringify(state),
    ]);
  }
  return { ok: true };
});

/**
 * Põe um Mestre do conteúdo no feudo de todos os feudos, sem edifício, com o identificador
 * seguinte do contador do estado: é como um cenário da alocação tem um Mestre sem depender de uma
 * expedição que o ache (o sorteio dele é de 1 em 4 ou 1 em 3, e a expedição, de horas). Entra pela
 * porta que toda chegada tem, mas direto nas casas: as habitações do feudo de teste têm vaga.
 * Daí em diante a alocação, a adaptação, o bônus e a conta da produção são os do motor.
 */
control.post('/__test/master', async (request) => {
  const { masterId = 'odo' } = (request.body ?? {}) as { masterId?: string };
  type Stored = {
    ids: Record<string, number>;
    settlement: { masters: Array<Record<string, unknown>> };
  };
  const games = await pool.query<{ id: string; state: Stored }>('select id, state from games');
  for (const game of games.rows) {
    const { state } = game;
    const number = (state.ids.master ?? 0) + 1;
    state.ids.master = number;
    state.settlement.masters.push({
      id: `master-${number}`,
      masterId,
      building: null,
      adaptingUntilMs: null,
      worked: false,
    });
    await pool.query('update games set state = $2::jsonb where id = $1', [
      game.id,
      JSON.stringify(state),
    ]);
  }
  return { ok: true };
});

/**
 * Revela um destino a todos os feudos, como uma expedição que achou o caminho dele: é como um
 * cenário tem na lista da Guilda o destino que pede três heróis ou uma classe, sem jogar as
 * jornadas que o descobrem (qual nó o revela depende da variante, que sai da semente). Só a
 * lista dos descobertos muda; daí em diante quem pode ir, o motivo de quem não pode e o envio
 * são os do motor.
 */
control.post('/__test/reveal', async (request) => {
  const { modelId } = request.body as { modelId: string };
  type Stored = { map: { discovered: string[] } };
  const games = await pool.query<{ id: string; state: Stored }>('select id, state from games');
  for (const game of games.rows) {
    const { state } = game;
    if (!state.map.discovered.includes(modelId)) {
      state.map.discovered.push(modelId);
      await pool.query('update games set state = $2::jsonb where id = $1', [
        game.id,
        JSON.stringify(state),
      ]);
    }
  }
  return { ok: true };
});

/**
 * Põe em cativeiro o herói de todos os feudos com o nome pedido, que precisa estar no feudo e
 * pronto: é como um cenário do Resgate tem um cativo sem depender de um Desastre com captura,
 * que é sorte. O cativeiro é gravado como o motor o grava (desde o último instante processado,
 * na Floresta Antiga); daí em diante o Resgate na lista da Guilda, quem ele solta e a volta do
 * herói são os do motor.
 */
control.post('/__test/captive', async (request) => {
  const { name } = request.body as { name: string };
  type Stored = {
    lastProcessedAt: number;
    guild: {
      heroes: Array<{
        name: string;
        status: string;
        captivity: { sinceMs: number; modelId: string } | null;
      }>;
    };
  };
  const games = await pool.query<{ id: string; state: Stored }>('select id, state from games');
  let placed = 0;
  for (const game of games.rows) {
    const { state } = game;
    const hero = state.guild.heroes.find((entry) => entry.name === name && entry.status === 'idle');
    if (hero === undefined) {
      continue;
    }
    hero.status = 'captured';
    hero.captivity = { sinceMs: state.lastProcessedAt, modelId: 'oldForest' };
    await pool.query('update games set state = $2::jsonb where id = $1', [
      game.id,
      JSON.stringify(state),
    ]);
    placed += 1;
  }
  return { ok: true, placed };
});

/**
 * Põe a Ameaça de todos os feudos em um valor, sem passar pelos dias: é como um teste tem a
 * Ameaça perto de uma marca da Crônica sem jogar as dezenas de horas que ela leva para subir
 * (a subida de verdade é coberta pelo cenário da Torre de Vigia e pelos testes do motor). Só o
 * número muda; daí em diante a subida, as marcas e o sorteio são os do motor.
 */
control.post('/__test/threat', async (request) => {
  const { level } = request.body as { level: number };
  await pool.query(`update games set state = jsonb_set(state, '{map,threat}', to_jsonb($1::int))`, [
    level,
  ]);
  return { ok: true };
});

/** Encerra no servidor todas as sessões, como uma revogação por reuso de refresh token. */
control.post('/__test/revoke-sessions', async () => {
  await pool.query('update sessions set revoked_at = $1 where revoked_at is null', [clock()]);
  return { ok: true };
});

control.post('/__test/github', async (request) => {
  const { action, userCode, githubId } = request.body as {
    action: 'approve' | 'deny' | 'expire' | 'slowDown' | 'down' | 'up';
    userCode?: string;
    githubId?: number;
  };
  switch (action) {
    case 'approve': {
      const user = githubId === undefined ? github.newUser() : github.userWithId(githubId);
      return github.approve(userCode ?? '', user);
    }
    case 'deny':
      github.deny(userCode ?? '');
      break;
    case 'expire':
      github.expire(userCode ?? '');
      break;
    case 'slowDown':
      github.slowDownNext(userCode ?? '');
      break;
    case 'down':
      github.setDown(true);
      break;
    case 'up':
      github.setDown(false);
      break;
  }
  return { ok: true };
});

await app.listen({ port: PORT, host: '127.0.0.1' });
console.log(`API de teste em http://127.0.0.1:${PORT} (ritmo ${ctx.config.gameTimeScale})`);

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    void app
      .close()
      .then(() => pool.end())
      .finally(() => process.exit(0));
  });
}
