import { DIFFICULTY_IDS, SCENARIO_IDS } from '@lotg/content';
import { z } from 'zod';

import { CommandSchema } from './commands';
import { isStorableText, UNSTORABLE } from './text';
import { StateVersionSchema } from './errors';
import { GameEventSchema, ViewStateSchema } from './view';

const isoDate = z.iso.datetime();

/** Nome de quem governa e nome do feudo: 2 a 24 caracteres, sem espaços nas pontas. */
export const DisplayNameSchema = z
  .string()
  .trim()
  .min(2)
  .max(24)
  .refine(isStorableText, UNSTORABLE);
export const DeviceLabelSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .refine(isStorableText, UNSTORABLE);

/** Semente escolhida para uma partida pessoal (D-19): 1 a 64 caracteres armazenáveis. */
export const GameSeedSchema = z.string().trim().min(1).max(64).refine(isStorableText, UNSTORABLE);

const timezone = z
  .string()
  .min(1)
  .max(64)
  .refine((value) => {
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: value });
      return true;
    } catch {
      return false;
    }
  }, 'fuso horário IANA desconhecido');

// --- Conta e sessão ---------------------------------------------------------

export const AccountSchema = z.strictObject({
  id: z.uuid(),
  displayName: z.string(),
  linked: z.strictObject({ github: z.boolean() }),
  hasRecoveryCode: z.boolean(),
  createdAt: isoDate,
});
export type Account = z.infer<typeof AccountSchema>;

export const TokenPairSchema = z.strictObject({
  accessToken: z.string(),
  refreshToken: z.string(),
  /** Validade do access token, em segundos. */
  expiresIn: z.number().int().positive(),
});
export type TokenPair = z.infer<typeof TokenPairSchema>;

export const AuthResponseSchema = z.strictObject({
  account: AccountSchema,
  ...TokenPairSchema.shape,
});
export type AuthResponse = z.infer<typeof AuthResponseSchema>;

export const AnonymousRequestSchema = z.strictObject({
  displayName: DisplayNameSchema,
  deviceLabel: DeviceLabelSchema.optional(),
});
export type AnonymousRequest = z.infer<typeof AnonymousRequestSchema>;

export const RefreshRequestSchema = z.strictObject({ refreshToken: z.string().min(1).max(200) });
export type RefreshRequest = z.infer<typeof RefreshRequestSchema>;
export const RefreshResponseSchema = TokenPairSchema;
export type RefreshResponse = TokenPair;

export const RecoveryCodeResponseSchema = z.strictObject({
  /** O Código do Reino em claro, no formato XXXX-XXXX-XXXX-XXXX-XXXX. Só aparece aqui. */
  code: z.string(),
});
export type RecoveryCodeResponse = z.infer<typeof RecoveryCodeResponseSchema>;

export const RecoverRequestSchema = z.strictObject({
  code: z.string().max(200),
  deviceLabel: DeviceLabelSchema.optional(),
});
export type RecoverRequest = z.infer<typeof RecoverRequestSchema>;

export const GithubAuthRequestSchema = z.strictObject({
  githubAccessToken: z.string().min(1).max(4096),
  deviceLabel: DeviceLabelSchema.optional(),
  /** Resposta ao `409 ACCOUNT_CONFLICT`: qual feudo manter. Os estados nunca são mesclados. */
  resolve: z.enum(['useExisting', 'keepCurrent']).optional(),
});
export type GithubAuthRequest = z.infer<typeof GithubAuthRequestSchema>;

/**
 * Vincular a conta atual devolve só `account`. Entrar em uma conta já vinculada (sem sessão,
 * ou com `resolve: 'useExisting'`) cria uma sessão nova e devolve também os tokens.
 */
export const GithubAuthResponseSchema = z.strictObject({
  account: AccountSchema,
  ...TokenPairSchema.partial().shape,
});
export type GithubAuthResponse = z.infer<typeof GithubAuthResponseSchema>;

/**
 * *Device flow* do GitHub (GDD §14.7). O navegador não pode chamar o GitHub direto; o servidor
 * só repassa as duas chamadas, com o `GITHUB_CLIENT_ID`, e não guarda nada.
 */
export const GithubDeviceStartResponseSchema = z.strictObject({
  /** Segredo desta tentativa: volta em cada consulta e nunca é mostrado ao jogador. */
  deviceCode: z.string().min(1).max(256),
  /** O código que o jogador digita no GitHub. */
  userCode: z.string().min(1).max(64),
  verificationUri: z.url(),
  expiresInSeconds: z.number().int().positive(),
  /** Intervalo mínimo entre consultas. */
  intervalSeconds: z.number().int().positive(),
});
export type GithubDeviceStartResponse = z.infer<typeof GithubDeviceStartResponseSchema>;

export const GithubDevicePollRequestSchema = z.strictObject({
  deviceCode: z.string().min(1).max(256),
});
export type GithubDevicePollRequest = z.infer<typeof GithubDevicePollRequestSchema>;

export const GithubDevicePollResponseSchema = z.discriminatedUnion('status', [
  /** O jogador confirmou: o token segue para `POST /auth/github`. */
  z.strictObject({ status: z.literal('authorized'), githubAccessToken: z.string().min(1) }),
  z.strictObject({ status: z.literal('pending') }),
  /** Consultas rápidas demais: passar a esperar `intervalSeconds` entre elas. */
  z.strictObject({ status: z.literal('slowDown'), intervalSeconds: z.number().int().positive() }),
  z.strictObject({ status: z.literal('expired') }),
  z.strictObject({ status: z.literal('denied') }),
]);
export type GithubDevicePollResponse = z.infer<typeof GithubDevicePollResponseSchema>;

export const UpdateMeRequestSchema = z.strictObject({ displayName: DisplayNameSchema });
export type UpdateMeRequest = z.infer<typeof UpdateMeRequestSchema>;

/** `202` de `DELETE /v1/me`: a conta já está bloqueada; o expurgo vem depois de `purgeAfter`. */
export const DeleteMeResponseSchema = z.strictObject({ deletedAt: isoDate, purgeAfter: isoDate });
export type DeleteMeResponse = z.infer<typeof DeleteMeResponseSchema>;

// --- Partidas ---------------------------------------------------------------

export const GameSummarySchema = z.strictObject({
  id: z.uuid(),
  status: z.enum(['active', 'archived']),
  settlementName: z.string(),
  difficulty: z.string(),
  timeScale: z.number(),
  timezone: z.string(),
  vigilHourLocal: z.number().int(),
  stateVersion: StateVersionSchema,
  createdAt: isoDate,
  /**
   * Identificador da Temporada à qual a partida pertence (`null` para partida pessoal). Opcional
   * por adição no protocolo 4: clientes/servidores anteriores à Fase G omitem o campo.
   */
  seasonId: z.uuid().nullable().optional(),
});
export type GameSummary = z.infer<typeof GameSummarySchema>;

/** Uma das dificuldades do conteúdo (GDD §12.1). */
export const DifficultySchema = z.enum(DIFFICULTY_IDS);

/** Um dos cenários de mapa do conteúdo (GDD §11.5; D-18). */
export const ScenarioSchema = z.enum(SCENARIO_IDS);

/**
 * O ritmo pedido para a partida (GDD §4.2): horas de jogo por hora real. Aqui só a forma. Quais
 * ritmos o jogo oferece é conteúdo (`balance.paces`), e quem confere é o servidor, que recusa
 * os outros com o mesmo `400 VALIDATION`. Este módulo não pode ler `balance`: o app importa os
 * schemas daqui, e um uso de `balance` em tempo de execução leva a tabela inteira de números
 * do jogo para dentro do JavaScript servido ao navegador.
 */
export const PaceTimeScaleSchema = z.number().positive();

export const CreateGameRequestSchema = z.strictObject({
  settlementName: DisplayNameSchema,
  timezone,
  vigilHourLocal: z.number().int().min(0).max(23),
  /** Fica gravada na partida e não muda durante o ano. Sem ela, vale a recomendada (Senhor). */
  difficulty: DifficultySchema.optional(),
  /**
   * Fica gravado na partida e não muda durante o ano. Sem ele, vale o padrão do servidor. Tem
   * de ser um dos ritmos de `GET /catalog`: o servidor recusa os outros.
   */
  timeScale: PaceTimeScaleSchema.optional(),
  /** Arquiva a partida ativa, se houver, em vez de recusar com `ACTIVE_GAME_EXISTS`. */
  replaceActive: z.boolean().optional(),
  /** Semente escolhida para a partida (D-19). Sem ela, o servidor sorteia uma. */
  seed: GameSeedSchema.optional(),
  /** Cenário do gerador de mapa (D-18). Sem ele, vale o cenário padrão. */
  scenario: ScenarioSchema.optional(),
});
export type CreateGameRequest = z.infer<typeof CreateGameRequestSchema>;

export const CreateGameResponseSchema = z.strictObject({ game: GameSummarySchema });
export type CreateGameResponse = z.infer<typeof CreateGameResponseSchema>;

export const ListGamesResponseSchema = z.strictObject({ games: z.array(GameSummarySchema) });
export type ListGamesResponse = z.infer<typeof ListGamesResponseSchema>;

/** Corpo de `GET /v1/games/:id/view`. O ETag é calculado sobre este corpo inteiro. */
export const ViewResponseSchema = z.strictObject({
  view: ViewStateSchema,
  stateVersion: StateVersionSchema,
});
export type ViewResponse = z.infer<typeof ViewResponseSchema>;

export const CommandRequestSchema = CommandSchema;
export type CommandRequest = z.infer<typeof CommandRequestSchema>;

/** `200` de um comando aceito: eventos do avanço do mundo e do próprio comando. */
export const CommandAcceptedSchema = z.strictObject({
  view: ViewStateSchema,
  events: z.array(GameEventSchema),
  stateVersion: StateVersionSchema,
  /** O cliente decidiu olhando uma versão que já não era a persistida. Aviso, não bloqueio. */
  staleView: z.boolean(),
});
export type CommandAccepted = z.infer<typeof CommandAcceptedSchema>;

export const EventsQuerySchema = z.strictObject({
  after: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(500).default(100),
});
export type EventsQuery = z.infer<typeof EventsQuerySchema>;

export const EventsResponseSchema = z.strictObject({
  events: z.array(GameEventSchema),
  /** Cursor para a próxima chamada: a maior sequência entregue, ou o `after` recebido. */
  lastSeq: z.number().int().min(0),
  /** Há mais eventos além do limite pedido. */
  hasMore: z.boolean(),
});
export type EventsResponse = z.infer<typeof EventsResponseSchema>;

export const ChronicleQuerySchema = z.strictObject({
  limit: z.coerce.number().int().min(1).max(500).default(50),
  /** Só as linhas de um ano de jogo. */
  year: z.coerce.number().int().min(1).optional(),
});
export type ChronicleQuery = z.infer<typeof ChronicleQuerySchema>;

/**
 * `GET /games/:id/chronicle.md`: com `links=1`, cada linha de expedição leva no fim a marca de
 * `chronicleLink.ts`, que liga a linha ao relatório. Sem ele, o documento sai limpo.
 */
export const ChronicleMarkdownQuerySchema = z.strictObject({
  links: z.enum(['0', '1']).optional(),
});
export type ChronicleMarkdownQuery = z.infer<typeof ChronicleMarkdownQuerySchema>;

/** `GET /games/:id/years/:year/chronicle.md`: parâmetros de rota para a Crônica do Ano. */
export const YearChronicleParamsSchema = z.strictObject({
  id: z.string().uuid(),
  year: z.coerce.number().int().min(1),
});
export type YearChronicleParams = z.infer<typeof YearChronicleParamsSchema>;

/** As últimas linhas da Crônica, da mais antiga para a mais recente. */
export const ChronicleResponseSchema = z.strictObject({ entries: z.array(GameEventSchema) });
export type ChronicleResponse = z.infer<typeof ChronicleResponseSchema>;

// --- Catálogo ---------------------------------------------------------------

/**
 * Corpo de `GET /v1/catalog`: o que o app precisa do conteúdo e que não vem no `ViewState`. Na
 * v0.2, as opções de nova partida (GDD §13.9). Os fatores de regra de cada dificuldade não saem
 * daqui: o app mostra a frase, e quem aplica o fator é o motor.
 */
export const CatalogResponseSchema = z
  .strictObject({
    /** O mesmo de `GET /version`: muda quando qualquer número ou texto do conteúdo muda. */
    contentHash: z.string(),
    newGame: z.strictObject({
      /** Da mais branda à mais dura. */
      difficulties: z
        .array(
          z.strictObject({
            id: DifficultySchema,
            label: z.string(),
            /** Uma frase sobre o que a dificuldade muda nesta versão. */
            description: z.string(),
            recommended: z.boolean(),
          }),
        )
        .min(1),
      /** Na ordem em que as boas-vindas os mostram. */
      paces: z
        .array(
          z.strictObject({
            timeScale: z.number().positive(),
            label: z.string(),
            /** Quanto dura o ano em tempo real: "um ano em 56 horas". */
            description: z.string(),
            /** Para quem é este ritmo, em uma frase. */
            hint: z.string(),
            recommended: z.boolean(),
          }),
        )
        .min(1),
      /** Cenários de mapa oferecidos na criação (D-18); opcional por adição no protocolo 4. */
      scenarios: z
        .array(
          z.strictObject({
            id: ScenarioSchema,
            label: z.string(),
            description: z.string(),
            legacyCost: z.number().int().nonnegative(),
            /** Custo pronto para exibir ("200 de Legado"); `null` quando gratuito. */
            costLabel: z.string().nullable(),
            /** Motivo pronto quando falta Legado na conta; `null` quando gratuito. */
            lockedReason: z.string().nullable(),
            recommended: z.boolean(),
          }),
        )
        .min(1)
        .optional(),
      /**
       * O que as boas-vindas trazem marcado: a dificuldade recomendada, o ritmo padrão do
       * servidor (quando oferecido; senão, o recomendado) e o cenário padrão.
       */
      defaults: z.strictObject({
        difficulty: DifficultySchema,
        timeScale: z.number().positive(),
        scenario: ScenarioSchema.optional(),
      }),
    }),
  })
  .refine(
    ({ newGame }) =>
      newGame.difficulties.some((entry) => entry.id === newGame.defaults.difficulty) &&
      newGame.paces.some((entry) => entry.timeScale === newGame.defaults.timeScale) &&
      (newGame.scenarios === undefined
        ? newGame.defaults.scenario === undefined
        : newGame.defaults.scenario !== undefined &&
          newGame.scenarios.some((entry) => entry.id === newGame.defaults.scenario)),
    'os padrões têm de estar entre as opções',
  );
export type CatalogResponse = z.infer<typeof CatalogResponseSchema>;

// --- Serviço ----------------------------------------------------------------

export const HealthResponseSchema = z.strictObject({
  /** O processo está de pé. O estado do banco vem em `db`; com ele fora, o status HTTP é 503. */
  status: z.literal('ok'),
  db: z.enum(['ok', 'down']),
});
export type HealthResponse = z.infer<typeof HealthResponseSchema>;

export const VersionResponseSchema = z.strictObject({
  server: z.string(),
  protocol: z.number().int(),
  contentHash: z.string(),
  builtAt: z.string(),
  /** O que este servidor tem ligado, para o cliente não oferecer o que não funciona. */
  features: z.strictObject({
    /** Há `GITHUB_CLIENT_ID`: as rotas `/auth/github/device` respondem. */
    githubDevice: z.boolean(),
  }),
});
export type VersionResponse = z.infer<typeof VersionResponseSchema>;

// --- Estatísticas e ranking (ADR 0021) ---------------------------------------

const count = z.number().int().nonnegative();

/** `GET` e `PUT /v1/me/ranking`: se os feudos da conta aparecem no ranking de ouro. */
export const RankingPreferenceSchema = z.strictObject({ listed: z.boolean() });
export type RankingPreference = z.infer<typeof RankingPreferenceSchema>;

/** Uma linha do ranking de ouro: só o nome do feudo e o ouro dele, nada da conta. */
export const RankingEntrySchema = z.strictObject({
  /** 1 é o feudo com mais ouro; no empate, o mais antigo fica na frente. */
  position: z.number().int().positive(),
  settlementName: z.string(),
  /** Unidades inteiras de ouro do estado gravado (não avançado para a leitura). */
  gold: z.number().int(),
  /** A linha é do feudo de quem lê. */
  mine: z.boolean(),
});
export type RankingEntry = z.infer<typeof RankingEntrySchema>;

/** O que o estado gravado de um feudo diz dele; um campo que a versão do estado não tem é 0. */
export const FiefStatsSchema = z.strictObject({
  settlementName: z.string(),
  gold: z.number().int(),
  villagers: count,
  soldiers: count,
  heroes: count,
  raidsRepelled: count,
  raidsSuffered: count,
  expeditionsSent: count,
  constructionsStarted: count,
  /** Dias reais desde a fundação. */
  daysReigning: count,
});
export type FiefStats = z.infer<typeof FiefStatsSchema>;

/**
 * `GET /v1/stats`: os totais do reino (anônimos, de todas as contas que jogam), os primeiros do
 * ranking de ouro (só quem não saiu dele) e o que é do próprio jogador. Os totais e o ranking
 * vêm de uma consulta guardada por um minuto (`generatedAt`); a parte do jogador é de agora.
 */
export const StatsResponseSchema = z.strictObject({
  generatedAt: isoDate,
  kingdom: z.strictObject({
    accounts: count,
    fiefs: count,
    /** Contas com alguma requisição nos últimos 7 dias reais. */
    activeLastWeek: count,
    gold: z.number().int(),
    villagers: count,
    raidsRepelled: count,
    raidsSuffered: count,
    expeditionsSent: count,
  }),
  /** Os 10 primeiros e, se o jogador está listado e fora deles, a linha dele no fim. */
  ranking: z.array(RankingEntrySchema),
  /** Quantos feudos estão no ranking. */
  rankedFiefs: count,
  me: z.strictObject({
    listed: z.boolean(),
    /** A posição no ranking (ou a que o feudo teria, se a conta saiu dele); `null` sem feudo. */
    position: z.number().int().positive().nullable(),
    fief: FiefStatsSchema.nullable(),
    /** Pontos de Legado da conta, incluindo feudos arquivados. Servidores anteriores omitem. */
    legacy: count.default(0),
  }),
});
export type StatsResponse = z.infer<typeof StatsResponseSchema>;

// --- Temporadas (GDD §11.6; ADR 0022, D-25 a D-28) --------------------------

export const SeasonStatusSchema = z.enum(['open', 'closed']);
export type SeasonStatus = z.infer<typeof SeasonStatusSchema>;

/**
 * Resumo público de uma Temporada semanal. Fuso fixo de Brasília (`America/Sao_Paulo`, UTC−3,
 * sem horário de verão desde 2019). A semente é sempre `null` antes do fecho (D-27).
 */
export const SeasonSummarySchema = z.strictObject({
  id: z.uuid(),
  /** Semana ISO em Brasília (ex.: `"2026-W48"`). */
  code: z.string().regex(/^\d{4}-W\d{2}$/),
  status: SeasonStatusSchema,
  timezone: z.literal('America/Sao_Paulo'),
  /** Dificuldade fixa para todos os participantes (D-26: `lord`). */
  difficulty: DifficultySchema,
  /** Ritmo fixo para todos os participantes (D-26: 3×). */
  timeScale: PaceTimeScaleSchema,
  /** Abertura da semana: segunda-feira 00:00 de Brasília. */
  startsAt: isoDate,
  /** Fim da janela de entrada: quarta-feira 00:00 de Brasília (aceita até terça 23:59:59). */
  joinEndsAt: isoDate,
  /** Fecho previsto da Temporada e horário do ranking: domingo 23:59 de Brasília. */
  endsAt: isoDate,
  /** Instante em que a Temporada fechou e o ranking foi publicado; `null` enquanto aberta. */
  rankingPublishedAt: isoDate.nullable(),
  /** A janela de entrada está aberta no relógio do servidor (`status === 'open'` e `< joinEndsAt`). */
  joinOpen: z.boolean(),
  /** Semente da Temporada: `null` enquanto aberta (D-27); revelada somente após o fecho. */
  seed: z.string().min(1).nullable(),
});
export type SeasonSummary = z.infer<typeof SeasonSummarySchema>;

/** `GET /v1/seasons/current`: Temporada da semana e situação da conta autenticada nela. */
export const CurrentSeasonResponseSchema = z.strictObject({
  season: SeasonSummarySchema,
  /** Se a conta autenticada já entrou nesta Temporada. */
  joined: z.boolean(),
  /** A partida da conta nesta Temporada (`null` se ainda não entrou). */
  game: GameSummarySchema.nullable(),
});
export type CurrentSeasonResponse = z.infer<typeof CurrentSeasonResponseSchema>;

/**
 * `POST /v1/seasons/current/join`: apenas nome do feudo e preferência da Vigília. Semente,
 * dificuldade (`lord`), ritmo (3×) e cenário (`standard`) vêm da Temporada (D-26).
 */
export const JoinSeasonRequestSchema = z.strictObject({
  settlementName: DisplayNameSchema,
  timezone,
  vigilHourLocal: z.number().int().min(0).max(23),
});
export type JoinSeasonRequest = z.infer<typeof JoinSeasonRequestSchema>;

/** `201` de `POST /v1/seasons/current/join`: a Temporada atual e a partida recém-criada. */
export const JoinSeasonResponseSchema = z.strictObject({
  season: SeasonSummarySchema,
  game: GameSummarySchema,
});
export type JoinSeasonResponse = z.infer<typeof JoinSeasonResponseSchema>;
