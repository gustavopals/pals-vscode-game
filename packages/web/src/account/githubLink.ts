import { ApiClientError, type Client } from '@lotg/client-sdk';
import type { AccountConflictDetails, GithubAuthResponse } from '@lotg/protocol';

export type ConflictChoice = 'useExisting' | 'keepCurrent';

export type ConflictOption = { choice: ConflictChoice; label: string; description: string };

/** As duas saídas de um conflito de vínculo, descritas para o jogador. Os feudos nunca se misturam. */
export function conflictOptions(details: AccountConflictDetails): ConflictOption[] {
  const loss = details.currentHasProgress
    ? 'este feudo anônimo, com o progresso que tem, será excluído'
    : 'este feudo anônimo será excluído';
  return [
    {
      choice: 'useExisting',
      label: `Usar o feudo de ${details.existingDisplayName}, já vinculado ao GitHub`,
      description: `Você passa a governar o feudo vinculado; ${loss}.`,
    },
    {
      choice: 'keepCurrent',
      label: 'Manter este feudo e mover o vínculo para ele',
      description: `O feudo de ${details.existingDisplayName} fica sem vínculo com o GitHub.`,
    },
  ];
}

export function isAccountConflict(
  error: unknown,
): error is ApiClientError & { details: AccountConflictDetails } {
  return error instanceof ApiClientError && error.code === 'ACCOUNT_CONFLICT';
}

/**
 * Vincula ou entra com o GitHub. Num conflito, pergunta ao jogador qual feudo manter e repete
 * com a escolha; se ele desistir, devolve `null` e nada muda.
 */
export async function linkOrSignInWithGithub(
  client: Client,
  input: { githubAccessToken: string; deviceLabel: string },
  choose: (details: AccountConflictDetails) => Promise<ConflictChoice | undefined>,
): Promise<GithubAuthResponse | null> {
  try {
    return await client.github(input);
  } catch (error) {
    if (!isAccountConflict(error)) {
      throw error;
    }
    const resolve = await choose(error.details);
    return resolve === undefined ? null : client.github({ ...input, resolve });
  }
}
