import type { GithubDevicePollResponse, GithubDeviceStartResponse } from '@lotg/protocol';

import { ApiError } from '../api-error';
import type { AppContext } from '../context';

const DEVICE_GRANT = 'urn:ietf:params:oauth:grant-type:device_code';
/** Só o necessário para o servidor ler o identificador da conta em `GET /user`. */
const SCOPE = 'read:user';

const unavailable = () =>
  new ApiError('INTERNAL', 'Não foi possível falar com o GitHub agora. Tente de novo.');

function clientId(ctx: AppContext): string {
  const id = ctx.config.githubClientId;
  if (id === null) {
    // Sem GITHUB_CLIENT_ID o vínculo pelo navegador não existe neste servidor.
    throw new ApiError('NOT_FOUND', 'O vínculo com o GitHub não está ligado neste servidor.');
  }
  return id;
}

/**
 * Repassa uma chamada de *device flow* ao GitHub, que não aceita chamadas diretas do navegador.
 * Só o `GITHUB_CLIENT_ID`, que é público, vai junto: não há segredo, e nada do que passa por
 * aqui é guardado nem registrado em log.
 */
async function relay(
  ctx: AppContext,
  path: string,
  form: Record<string, string>,
): Promise<Record<string, unknown>> {
  let response: Response;
  try {
    response = await ctx.fetch(`${ctx.config.githubOauthUrl}${path}`, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/x-www-form-urlencoded',
        'user-agent': 'lords-of-the-guild-server',
      },
      body: new URLSearchParams(form).toString(),
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw unavailable();
  }
  const body = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  if (body === null || typeof body !== 'object') {
    throw unavailable();
  }
  return body;
}

const positiveInt = (value: unknown): number | null =>
  typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : null;

/** Pede ao GitHub um código para o jogador confirmar em `github.com/login/device`. */
export async function startGithubDevice(ctx: AppContext): Promise<GithubDeviceStartResponse> {
  const body = await relay(ctx, '/login/device/code', { client_id: clientId(ctx), scope: SCOPE });
  const { device_code: deviceCode, user_code: userCode, verification_uri: uri } = body;
  const expiresInSeconds = positiveInt(body.expires_in);
  if (
    typeof deviceCode !== 'string' ||
    typeof userCode !== 'string' ||
    typeof uri !== 'string' ||
    expiresInSeconds === null ||
    // O endereço vira um link na tela do jogador: só vale o do próprio GitHub configurado.
    !uri.startsWith(`${ctx.config.githubOauthUrl}/`)
  ) {
    // Inclui `device_flow_disabled` e `incorrect_client_credentials`: é configuração do
    // OAuth App, não algo que o jogador possa resolver.
    throw new ApiError('INTERNAL', 'O GitHub não aceitou o pedido de vínculo. Tente mais tarde.');
  }
  return {
    deviceCode,
    userCode,
    verificationUri: uri,
    expiresInSeconds,
    intervalSeconds: positiveInt(body.interval) ?? 5,
  };
}

/** Consulta se o jogador já confirmou o código. */
export async function pollGithubDevice(
  ctx: AppContext,
  deviceCode: string,
): Promise<GithubDevicePollResponse> {
  const body = await relay(ctx, '/login/oauth/access_token', {
    client_id: clientId(ctx),
    device_code: deviceCode,
    grant_type: DEVICE_GRANT,
  });
  if (typeof body.access_token === 'string' && body.access_token !== '') {
    return { status: 'authorized', githubAccessToken: body.access_token };
  }
  switch (body.error) {
    case 'authorization_pending':
      return { status: 'pending' };
    case 'slow_down':
      return { status: 'slowDown', intervalSeconds: positiveInt(body.interval) ?? 10 };
    case 'expired_token':
    case 'incorrect_device_code':
      return { status: 'expired' };
    case 'access_denied':
      return { status: 'denied' };
    default:
      throw new ApiError('INTERNAL', 'O GitHub não respondeu como esperado. Tente de novo.');
  }
}
