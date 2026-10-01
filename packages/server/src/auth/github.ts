import { ApiError } from '../api-error';
import type { AppContext } from '../context';

/**
 * Valida o token do GitHub obtido pelo VS Code e devolve o `github_id`. O token não é guardado
 * nem registrado em log; do GitHub o servidor só conserva esse identificador.
 */
export async function fetchGithubId(ctx: AppContext, githubAccessToken: string): Promise<string> {
  let response: Response;
  try {
    response = await ctx.fetch(`${ctx.config.githubApiUrl}/user`, {
      headers: {
        authorization: `Bearer ${githubAccessToken}`,
        accept: 'application/vnd.github+json',
        'user-agent': 'lords-of-the-guild-server',
      },
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new ApiError('INTERNAL', 'Não foi possível falar com o GitHub agora. Tente de novo.');
  }
  if (response.status === 401 || response.status === 403) {
    throw new ApiError('GITHUB_TOKEN_INVALID', 'O GitHub recusou a autorização. Entre de novo.');
  }
  if (!response.ok) {
    throw new ApiError('INTERNAL', 'O GitHub não respondeu como esperado. Tente de novo.');
  }
  const body = (await response.json().catch(() => null)) as { id?: unknown } | null;
  const id = body?.id;
  if (typeof id !== 'number' && typeof id !== 'string') {
    throw new ApiError('GITHUB_TOKEN_INVALID', 'O GitHub não informou a conta desta autorização.');
  }
  return String(id);
}
