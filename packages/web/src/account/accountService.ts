import type { Client } from '@lotg/client-sdk';
import type {
  Account,
  AccountConflictDetails,
  CreateGameRequest,
  GameSummary,
} from '@lotg/protocol';

import { Emitter, type KeyValueStore } from '../services/store';
import { type ConflictChoice, linkOrSignInWithGithub } from './githubLink';
import { normalizeRecoveryCode } from './recoveryCode';

/** Quem governa neste navegador. Fica no armazenamento do navegador, ao lado dos tokens. */
export type AccountState =
  | { kind: 'signedOut' }
  | {
      kind: 'anonymous' | 'linked';
      accountId: string;
      displayName: string;
      hasRecoveryCode: boolean;
      /** Partida pessoal ativa; `null` quando a conta ainda não fundou um feudo pessoal. */
      gameId: string | null;
      seasonGames?: SeasonGame[];
    };

export type SignedInState = Exclude<AccountState, { kind: 'signedOut' }>;
type SeasonGame = Pick<GameSummary, 'id' | 'status' | 'createdAt'> & { seasonId: string };

/**
 * O que funda um feudo. `difficulty` e `timeScale` só vêm quando o jogador viu as opções do
 * servidor (`GET /catalog`); sem eles, o corpo vai como na v0.1 e valem os padrões do servidor.
 */
export type NewGameInput = Pick<
  CreateGameRequest,
  | 'settlementName'
  | 'timezone'
  | 'vigilHourLocal'
  | 'difficulty'
  | 'timeScale'
  | 'scenario'
  | 'seed'
>;

/** Corpo de `POST /games` montado a partir do formulário de boas-vindas. */
export function gameRequest(input: NewGameInput, replaceActive = false): CreateGameRequest {
  const seed = input.seed?.trim();
  return {
    settlementName: input.settlementName.trim(),
    timezone: input.timezone,
    vigilHourLocal: input.vigilHourLocal,
    ...(input.difficulty === undefined ? {} : { difficulty: input.difficulty }),
    // O número vai como veio do catálogo, sem conversão.
    ...(input.timeScale === undefined ? {} : { timeScale: input.timeScale }),
    ...(input.scenario === undefined ? {} : { scenario: input.scenario }),
    ...(seed === undefined || seed === '' ? {} : { seed }),
    ...(replaceActive ? { replaceActive: true } : {}),
  };
}

function seasonGame(game: GameSummary): SeasonGame[] {
  const { id, status, seasonId, createdAt } = game;
  return seasonId == null ? [] : [{ id, status, seasonId, createdAt }];
}

function stateOf(account: Account, games: GameSummary[] = []): SignedInState {
  const seasonGames = games.flatMap(seasonGame).slice(0, 2);
  return {
    kind: account.linked.github ? 'linked' : 'anonymous',
    accountId: account.id,
    displayName: account.displayName,
    hasRecoveryCode: account.hasRecoveryCode,
    gameId: games.find((game) => game.status === 'active' && game.seasonId == null)?.id ?? null,
    ...(seasonGames.length === 0 ? {} : { seasonGames }),
  };
}

/**
 * A conta do jogador nesta máquina: criar em um clique, entrar por GitHub ou Código do Reino,
 * sair e excluir (GDD §13.9 e §14.7). Não conhece a interface: os diálogos entram por parâmetro.
 */
export class AccountService {
  private current: AccountState = { kind: 'signedOut' };
  private readonly changes = new Emitter<AccountState>();
  /** Assinar para ser avisado de toda mudança de conta. */
  readonly onDidChange = this.changes.on;

  constructor(
    private readonly deps: {
      client: Client;
      store: KeyValueStore;
      /** Identifica o servidor nas chaves do armazenamento. */
      serverKey: string;
      deviceLabel: string;
    },
  ) {}

  get state(): AccountState {
    return this.current;
  }

  private get storeKey(): string {
    return `lords.account:${this.deps.serverKey}`;
  }

  private async set(state: AccountState): Promise<void> {
    this.current = state;
    await this.deps.store.update(this.storeKey, state.kind === 'signedOut' ? undefined : state);
    this.changes.emit(state);
  }

  /** Ao abrir a página: retoma a conta guardada, sem tocar a rede. */
  restore(): AccountState {
    this.current = this.deps.store.get<SignedInState>(this.storeKey) ?? { kind: 'signedOut' };
    return this.current;
  }

  /**
   * Outra aba mudou a conta guardada (entrou, saiu, fundou outro feudo): esta aba adota o que
   * está no armazenamento, sem gravar de volta.
   */
  adoptStored(): AccountState {
    const stored = this.deps.store.get<SignedInState>(this.storeKey) ?? { kind: 'signedOut' };
    if (JSON.stringify(stored) !== JSON.stringify(this.current)) {
      this.current = stored;
      this.changes.emit(stored);
    }
    return this.current;
  }

  /** Confere a conta e suas partidas com o servidor. */
  async sync(): Promise<AccountState> {
    if (this.current.kind === 'signedOut') {
      return this.current;
    }
    const before = this.current;
    const account = await this.deps.client.getMe();
    const games = await this.deps.client.listGames();
    // Enquanto o servidor respondia, o jogador pode ter saído ou trocado de conta: a resposta
    // é da conta antiga e não pode ser gravada por cima.
    if (this.current !== before) {
      return this.current;
    }
    await this.set(stateOf(account, games));
    return this.current;
  }

  /**
   * "Jogar agora": cria a conta anônima, se ainda não houver sessão, e funda o feudo.
   * Do clique ao painel são duas requisições.
   */
  async playNow(input: NewGameInput & { displayName: string }): Promise<SignedInState> {
    let state = this.current;
    if (state.kind === 'signedOut') {
      const auth = await this.deps.client.signUpAnonymous({
        displayName: input.displayName.trim(),
        deviceLabel: this.deps.deviceLabel,
      });
      state = stateOf(auth.account);
      // A conta já existe: guardar agora evita criar outra se a fundação do feudo falhar.
      await this.set(state);
    }
    const game = await this.deps.client.createGame(gameRequest(input));
    const signedIn: SignedInState = { ...state, gameId: game.id };
    await this.set(signedIn);
    return signedIn;
  }

  /** "Nova partida": arquiva a atual e funda outro feudo. */
  async startNewGame(input: NewGameInput): Promise<SignedInState> {
    if (this.current.kind === 'signedOut') {
      throw new Error('Não há conta nesta máquina.');
    }
    const game = await this.deps.client.createGame(gameRequest(input, true));
    const signedIn: SignedInState = { ...this.current, gameId: game.id };
    await this.set(signedIn);
    return signedIn;
  }

  /** Adota a partida que a leitura ou a entrada na Temporada devolveu e avisa as outras abas. */
  async rememberSeasonGame(accountId: string, game: GameSummary): Promise<void> {
    const state = this.current;
    if (state.kind === 'signedOut' || state.accountId !== accountId) return;
    const [entry] = seasonGame(game);
    if (entry === undefined) return;
    const seasons = state.seasonGames ?? [];
    if (seasons.some((known) => known.id === entry.id && known.status === entry.status)) return;
    const seasonGames = [entry, ...seasons.filter((known) => known.seasonId !== entry.seasonId)]
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
      .slice(0, 2);
    await this.set({ ...state, seasonGames });
  }

  /** Entra em outra máquina com o Código do Reino. */
  async signInWithRecoveryCode(code: string): Promise<SignedInState> {
    const auth = await this.deps.client.recover({
      code: normalizeRecoveryCode(code),
      deviceLabel: this.deps.deviceLabel,
    });
    const state = stateOf(auth.account, await this.deps.client.listGames());
    await this.set(state);
    return state;
  }

  /**
   * Vincula a conta atual ao GitHub, ou entra na conta já vinculada. Devolve `null` se o
   * jogador desistiu diante de um conflito. Se a escolha foi usar o feudo existente, a conta
   * local muda: quem assina `onDidChange` deve limpar o cache da conta anterior.
   */
  async signInOrLinkGithub(
    githubAccessToken: string,
    choose: (details: AccountConflictDetails) => Promise<ConflictChoice | undefined>,
  ): Promise<SignedInState | null> {
    const response = await linkOrSignInWithGithub(
      this.deps.client,
      { githubAccessToken, deviceLabel: this.deps.deviceLabel },
      choose,
    );
    if (response === null) {
      return null;
    }
    const state = stateOf(response.account, await this.deps.client.listGames());
    await this.set(state);
    return state;
  }

  /** Gera (ou troca) o Código do Reino. O código só aparece nesta resposta. */
  async generateRecoveryCode(): Promise<string> {
    const code = await this.deps.client.createRecoveryCode();
    if (this.current.kind !== 'signedOut') {
      await this.set({ ...this.current, hasRecoveryCode: true });
    }
    return code;
  }

  async rename(displayName: string): Promise<void> {
    const account = await this.deps.client.renameMe(displayName);
    if (this.current.kind !== 'signedOut') {
      await this.set({ ...this.current, displayName: account.displayName });
    }
  }

  /** "Sair desta máquina": revoga a sessão local. As credenciais somem mesmo sem rede. */
  async signOut(): Promise<void> {
    try {
      await this.deps.client.logout();
    } finally {
      await this.set({ kind: 'signedOut' });
    }
  }

  /** Exclui a conta: bloqueio imediato no servidor, sem desfazer. */
  async deleteAccount(): Promise<{ deletedAt: string; purgeAfter: string }> {
    const response = await this.deps.client.deleteMe();
    await this.set({ kind: 'signedOut' });
    return response;
  }

  /** A sessão acabou no servidor (revogada, expirada ou conta excluída). */
  async handleUnauthenticated(): Promise<void> {
    if (this.current.kind !== 'signedOut') {
      await this.set({ kind: 'signedOut' });
    }
  }
}
