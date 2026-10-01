import { DisplayNameSchema } from '@lotg/protocol';
import { useState } from 'preact/hooks';

import type { Actions } from './actions';

const NAME_RULE = 'De 2 a 24 caracteres.';
// A regra do nome é a do protocolo: o app não repete os limites.
const validName = (value: string) => DisplayNameSchema.safeParse(value).success;

/**
 * Primeira abertura (GDD §13.9): dois campos e um clique. Sem e-mail, sem senha, sem formulário.
 * Quem já tem conta mas ainda não tem feudo só precisa do nome do feudo.
 */
export function Welcome(props: {
  /** Quem já governa neste navegador, mas ainda sem feudo. */
  account: { displayName: string } | null;
  busy: boolean;
  online: boolean;
  /** O servidor tem o vínculo com o GitHub ligado. */
  githubAvailable: boolean;
  actions: Actions;
}) {
  const { account, busy, online, actions } = props;
  const [displayName, setDisplayName] = useState('');
  const [settlementName, setSettlementName] = useState('Pedra Alta');
  const ruler = account?.displayName ?? displayName;
  const ready = validName(ruler) && validName(settlementName);

  const submit = (event: Event) => {
    event.preventDefault();
    if (ready && !busy) {
      actions.playNow(ruler.trim(), settlementName.trim());
    }
  };

  return (
    <main class="welcome">
      <h1>Lords of the Guild</h1>
      <p class="lead">
        Um feudo que você governa nas pausas do café. As estações passam, as obras terminam e o
        mundo continua andando com a aba fechada.
      </p>
      <form onSubmit={submit}>
        {account === null ? (
          <label>
            Como devemos chamar quem governa?
            <input
              type="text"
              name="displayName"
              value={displayName}
              maxLength={24}
              autoFocus
              autocomplete="nickname"
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
            name="settlementName"
            value={settlementName}
            maxLength={24}
            autocomplete="off"
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
            Sem ligação com o reino. Tente de novo em instantes.
          </p>
        )}
      </form>
      {account === null ? (
        <div class="elsewhere">
          <p>Já governa um feudo em outro navegador?</p>
          <div class="row">
            {props.githubAvailable ? (
              <button
                type="button"
                class="secondary"
                disabled={busy}
                onClick={() => actions.run('lords.signInGithub')}
              >
                Entrar com GitHub
              </button>
            ) : null}
            <button
              type="button"
              class="secondary"
              disabled={busy}
              onClick={() => actions.run('lords.signInRecoveryCode')}
            >
              Usar Código do Reino
            </button>
          </div>
        </div>
      ) : null}
    </main>
  );
}
