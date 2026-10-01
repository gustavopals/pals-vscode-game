import type { Pool } from 'pg';

const HEALTH_TIMEOUT_MS = 1500;

/** O banco responde? Com limite de tempo: `/v1/health` não pode ficar pendurado. */
export async function pingDatabase(pool: Pool): Promise<boolean> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<false>((resolve) => {
    timer = setTimeout(() => resolve(false), HEALTH_TIMEOUT_MS);
  });
  const query = pool
    .query('select 1')
    .then(() => true)
    .catch(() => false);
  try {
    return await Promise.race([query, timeout]);
  } finally {
    clearTimeout(timer);
  }
}
