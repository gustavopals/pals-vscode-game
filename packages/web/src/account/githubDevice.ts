import { ApiClientError, type Client } from '@lotg/client-sdk';
import type { GithubDeviceStartResponse } from '@lotg/protocol';

/** Intervalo depois de um 429 ou 5xx do nosso servidor. */
const BUSY_INTERVAL_SECONDS = 10;

export type DeviceOutcome =
  | { kind: 'authorized'; githubAccessToken: string }
  /** O código venceu sem confirmação. */
  | { kind: 'expired' }
  /** O jogador recusou no GitHub. */
  | { kind: 'denied' }
  /** O jogador fechou o diálogo. */
  | { kind: 'cancelled' };

/**
 * Espera o jogador confirmar o código no GitHub, consultando no intervalo que o GitHub pediu.
 * Um `slowDown` aumenta o intervalo; o prazo do código encerra a espera. Um servidor ocupado
 * (429 ou 5xx) em uma consulta só adia a próxima: o jogador pode já ter confirmado o código.
 * Uma falha de rede sobe para quem chamou: a tentativa inteira é refeita, com outro código.
 */
export async function awaitGithubAuthorization(
  client: Pick<Client, 'pollGithubDevice'>,
  start: GithubDeviceStartResponse,
  options: {
    sleep: (ms: number) => Promise<void>;
    now: () => number;
    cancelled: () => boolean;
  },
): Promise<DeviceOutcome> {
  const deadline = options.now() + start.expiresInSeconds * 1000;
  let intervalSeconds = start.intervalSeconds;
  for (;;) {
    await options.sleep(intervalSeconds * 1000);
    if (options.cancelled()) {
      return { kind: 'cancelled' };
    }
    if (options.now() >= deadline) {
      return { kind: 'expired' };
    }
    let poll;
    try {
      poll = await client.pollGithubDevice(start.deviceCode);
    } catch (error) {
      if (error instanceof ApiClientError && (error.status === 429 || error.status >= 500)) {
        intervalSeconds = Math.max(intervalSeconds, BUSY_INTERVAL_SECONDS);
        continue;
      }
      throw error;
    }
    switch (poll.status) {
      case 'authorized':
        return { kind: 'authorized', githubAccessToken: poll.githubAccessToken };
      case 'expired':
        return { kind: 'expired' };
      case 'denied':
        return { kind: 'denied' };
      case 'slowDown':
        intervalSeconds = Math.max(intervalSeconds, poll.intervalSeconds);
        break;
      case 'pending':
        break;
    }
  }
}
