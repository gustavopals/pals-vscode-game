import { z } from 'zod';

const integer = (fallback: number, min = 1) => z.coerce.number().int().min(min).default(fallback);
const flag = z
  .enum(['true', 'false'])
  .default('false')
  .transform((value) => value === 'true');

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: integer(3000),
  HOST: z.string().default('0.0.0.0'),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(1),
  RECOVERY_CODE_SECRET: z.string().min(1),
  PUBLIC_URL: z.url().default('http://localhost:3000'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  RATE_LIMIT_PER_MINUTE: integer(60),
  ACCOUNT_CREATE_PER_HOUR_PER_IP: integer(10),
  RECOVERY_ATTEMPTS_PER_HOUR_PER_IP: integer(5),
  ADVANCE_JOB_INTERVAL_MS: integer(3_600_000),
  ADVANCE_STALE_AFTER_MS: integer(3_600_000, 0),
  GITHUB_API_URL: z.url().default('https://api.github.com'),
  TRUST_PROXY: flag,
});

export type Config = {
  nodeEnv: 'development' | 'test' | 'production';
  port: number;
  host: string;
  databaseUrl: string;
  /** Chave HS256 dos access tokens. */
  jwtSecret: Uint8Array;
  /** Chave HMAC dos Códigos do Reino, independente da chave JWT (ADR 0003). */
  recoveryCodeSecret: Uint8Array;
  publicUrl: string;
  logLevel: string;
  rateLimitPerMinute: number;
  accountCreatePerHourPerIp: number;
  recoveryAttemptsPerHourPerIp: number;
  advanceJobIntervalMs: number;
  advanceStaleAfterMs: number;
  githubApiUrl: string;
  /** Confiar em `X-Forwarded-For`. Só atrás do proxy reverso: os limites por IP dependem disso. */
  trustProxy: boolean;
  /** Aceitar a semente informada em `POST /games`. Só em ambiente de teste. */
  allowGameSeed: boolean;
};

const MIN_SECRET_BYTES = 32;

export class ConfigError extends Error {
  constructor(problems: string[]) {
    super(`Configuração inválida:\n${problems.map((problem) => `  - ${problem}`).join('\n')}`);
    this.name = 'ConfigError';
  }
}

function decodeSecret(name: string, value: string, problems: string[]): Uint8Array {
  const compact = value.trim();
  const bytes = Buffer.from(compact, 'base64');
  // Buffer ignora caracteres inválidos em silêncio; conferir o formato evita uma chave truncada.
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(compact)) {
    problems.push(`${name} deve estar em base64.`);
  } else if (bytes.length < MIN_SECRET_BYTES) {
    problems.push(`${name} deve ter pelo menos ${MIN_SECRET_BYTES} bytes aleatórios (em base64).`);
  }
  return new Uint8Array(bytes);
}

/**
 * Valida as variáveis de ambiente no arranque e falha rápido, dizendo o que corrigir.
 * As mensagens citam só o nome das variáveis: um segredo nunca aparece em um erro.
 */
export function loadConfig(env: Record<string, string | undefined>): Config {
  const parsed = EnvSchema.safeParse(env);
  if (!parsed.success) {
    throw new ConfigError(
      parsed.error.issues.map((issue) => {
        const name = issue.path.join('.');
        return env[name] === undefined || env[name] === ''
          ? `${name} é obrigatória.`
          : `${name} tem valor inválido.`;
      }),
    );
  }
  const values = parsed.data;
  const problems: string[] = [];
  const jwtSecret = decodeSecret('JWT_SECRET', values.JWT_SECRET, problems);
  const recoveryCodeSecret = decodeSecret(
    'RECOVERY_CODE_SECRET',
    values.RECOVERY_CODE_SECRET,
    problems,
  );
  if (problems.length === 0 && Buffer.from(jwtSecret).equals(Buffer.from(recoveryCodeSecret))) {
    problems.push('JWT_SECRET e RECOVERY_CODE_SECRET devem ser chaves diferentes.');
  }
  if (problems.length > 0) {
    throw new ConfigError(problems);
  }
  return {
    nodeEnv: values.NODE_ENV,
    port: values.PORT,
    host: values.HOST,
    databaseUrl: values.DATABASE_URL,
    jwtSecret,
    recoveryCodeSecret,
    publicUrl: values.PUBLIC_URL.replace(/\/+$/, ''),
    logLevel: values.LOG_LEVEL,
    rateLimitPerMinute: values.RATE_LIMIT_PER_MINUTE,
    accountCreatePerHourPerIp: values.ACCOUNT_CREATE_PER_HOUR_PER_IP,
    recoveryAttemptsPerHourPerIp: values.RECOVERY_ATTEMPTS_PER_HOUR_PER_IP,
    advanceJobIntervalMs: values.ADVANCE_JOB_INTERVAL_MS,
    advanceStaleAfterMs: values.ADVANCE_STALE_AFTER_MS,
    githubApiUrl: values.GITHUB_API_URL.replace(/\/+$/, ''),
    trustProxy: values.TRUST_PROXY,
    allowGameSeed: values.NODE_ENV === 'test',
  };
}
