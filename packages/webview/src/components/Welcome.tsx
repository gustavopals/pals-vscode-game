import type { WebviewSession } from '@lotg/protocol';
import { useState } from 'preact/hooks';

import type { Send } from '../bridge';

const NAME_RULE = 'De 2 a 24 caracteres.';
const validName = (value: string) => value.trim().length >= 2 && value.trim().length <= 24;

/**
 * Primeira abertura (GDD §13.9): dois campos e um clique. Sem e-mail, sem senha, sem formulário.
 * Quem já tem conta mas ainda não tem feudo só precisa do nome do feudo.
 */
export function Welcome(props: { session: WebviewSession | null; online: boolean; send: Send }) {
  const { session, online, send } = props;
  const account = session?.account ?? null;
  const [displayName, setDisplayName] = useState(session?.defaults.displayName ?? '');
  const [settlementName, setSettlementName] = useState(
    session?.defaults.settlementName ?? 'Pedra Alta',
  );
  const busy = session?.busy ?? false;
  const ruler = account?.displayName ?? displayName;
  const ready = validName(ruler) && validName(settlementName);

  const submit = (event: Event) => {
    event.preventDefault();
    if (ready && !busy) {
      send({ type: 'playNow', displayName: ruler.trim(), settlementName: settlementName.trim() });
    }
  };

  return (
    <main class="welcome">
      <h1>Lords of the Guild</h1>
      <p class="lead">
        Um feudo que você governa nas pausas do café. Cada semana é um ano, e o mundo continua
        andando com o editor fechado.
      </p>
      <form onSubmit={submit}>
        {account === null ? (
          <label>
            Como devemos chamar quem governa?
            <input
              type="text"
              value={displayName}
              maxLength={24}
              autoFocus
              aria-describedby="name-rule"
              onInput={(event) => setDisplayName((event.target as HTMLInputElement).value)}
            />
          </label>
        ) : (
          <p>
            Bem-vindo de volta, <strong>{account.displayName}</strong>. Falta fundar o seu feudo.
          </p>
        )}
        <label>
          Nome do feudo
          <input
            type="text"
            value={settlementName}
            maxLength={24}
            aria-describedby="name-rule"
            onInput={(event) => setSettlementName((event.target as HTMLInputElement).value)}
          />
        </label>
        <p id="name-rule" class="muted hint">
          {NAME_RULE}
        </p>
        <button type="submit" class="primary" disabled={!ready || busy || !online}>
          {busy ? 'Abrindo os portões…' : account === null ? 'Jogar agora' : 'Fundar o feudo'}
        </button>
        {online ? null : (
          <p class="blocked" role="status">
            Sem ligação com o reino. Confira o servidor em Configurações e tente de novo.
          </p>
        )}
      </form>
      {account === null ? (
        <div class="elsewhere">
          <p>Já governa um feudo em outra máquina?</p>
          <div class="row">
            <button
              type="button"
              class="secondary"
              disabled={busy}
              onClick={() => send({ type: 'action', action: 'signInGithub' })}
            >
              Entrar com GitHub
            </button>
            <button
              type="button"
              class="secondary"
              disabled={busy}
              onClick={() => send({ type: 'action', action: 'signInRecoveryCode' })}
            >
              Usar Código do Reino
            </button>
          </div>
        </div>
      ) : null}
    </main>
  );
}
