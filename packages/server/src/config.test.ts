import { describe, expect, it } from 'vitest';

import { ConfigError, loadConfig } from './config';

const jwt = Buffer.alloc(48, 7).toString('base64');
const recovery = Buffer.alloc(48, 9).toString('base64');
const base = {
  DATABASE_URL: 'postgres://lotg:lotg@localhost:5432/lotg',
  JWT_SECRET: jwt,
  RECOVERY_CODE_SECRET: recovery,
};

function problemsOf(env: Record<string, string | undefined>): string {
  try {
    loadConfig(env);
  } catch (error) {
    expect(error).toBeInstanceOf(ConfigError);
    return (error as Error).message;
  }
  throw new Error('A configuração deveria ter sido recusada.');
}

describe('loadConfig', () => {
  it('aplica os padrões de desenvolvimento da §1.3 do roadmap', () => {
    const config = loadConfig(base);
    expect(config).toMatchObject({
      nodeEnv: 'development',
      port: 3000,
      publicUrl: 'http://localhost:3000',
      rateLimitPerMinute: 60,
      accountCreatePerHourPerIp: 10,
      recoveryAttemptsPerHourPerIp: 5,
      advanceStaleAfterMs: 3_600_000,
      githubApiUrl: 'https://api.github.com',
      trustProxy: false,
      allowGameSeed: false,
    });
    expect(config.jwtSecret).toHaveLength(48);
    expect(config.recoveryCodeSecret).toHaveLength(48);
  });

  it('lê os valores informados e tira a barra final das URLs', () => {
    const config = loadConfig({
      ...base,
      NODE_ENV: 'production',
      PORT: '8080',
      PUBLIC_URL: 'https://lords.example/',
      TRUST_PROXY: 'true',
      ADVANCE_JOB_INTERVAL_MS: '1000',
    });
    expect(config).toMatchObject({
      nodeEnv: 'production',
      port: 8080,
      publicUrl: 'https://lords.example',
      trustProxy: true,
      advanceJobIntervalMs: 1000,
    });
  });

  it('só aceita semente informada em ambiente de teste', () => {
    expect(loadConfig({ ...base, NODE_ENV: 'test' }).allowGameSeed).toBe(true);
    expect(loadConfig({ ...base, NODE_ENV: 'production' }).allowGameSeed).toBe(false);
  });

  it('falha rápido dizendo qual variável falta', () => {
    const message = problemsOf({ JWT_SECRET: jwt });
    expect(message).toContain('DATABASE_URL é obrigatória.');
    expect(message).toContain('RECOVERY_CODE_SECRET é obrigatória.');
  });

  it('exige ao menos 32 bytes em cada segredo', () => {
    const short = Buffer.alloc(16, 1).toString('base64');
    expect(problemsOf({ ...base, JWT_SECRET: short })).toContain(
      'JWT_SECRET deve ter pelo menos 32 bytes',
    );
    expect(problemsOf({ ...base, RECOVERY_CODE_SECRET: short })).toContain(
      'RECOVERY_CODE_SECRET deve ter pelo menos 32 bytes',
    );
  });

  it('exige base64 e chaves diferentes', () => {
    expect(problemsOf({ ...base, JWT_SECRET: 'não é base64!' })).toContain(
      'JWT_SECRET deve estar em base64.',
    );
    expect(problemsOf({ ...base, RECOVERY_CODE_SECRET: jwt })).toContain(
      'JWT_SECRET e RECOVERY_CODE_SECRET devem ser chaves diferentes.',
    );
  });

  it('nunca imprime um segredo em uma mensagem de erro', () => {
    const short = Buffer.from('segredo-curto-demais').toString('base64');
    const message = problemsOf({ ...base, JWT_SECRET: short, PORT: 'abc' });
    expect(message).not.toContain(short);
    expect(message).not.toContain(recovery);
    expect(message).toContain('PORT tem valor inválido.');
  });
});
