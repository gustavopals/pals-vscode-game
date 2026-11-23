import { DisplayNameSchema, GameSeedSchema } from '@lotg/protocol';
import { useEffect, useState } from 'preact/hooks';

import {
  difficultyLine,
  isScenarioLocked,
  type NewGameChoice,
  type NewGameOptions,
  paceLine,
  resolveChoice,
  scenarioLine,
  scenarioLockedText,
} from '../game/newGame';
import type { Actions } from './actions';
import { Icon } from './shared';

const NAME_RULE = 'De 2 a 24 caracteres.';
// A regra do nome é a do protocolo: o app não repete os limites.
const validName = (value: string) => DisplayNameSchema.safeParse(value).success;

/**
 * Um grupo de opções em que uma só vale (dificuldade, ritmo). Botões de rádio nativos: o `Tab`
 * para uma vez no grupo e as setas trocam a escolha. O nome de cada opção é a linha curta; a
 * frase que a explica fica como descrição, à vista de todos e lida depois do nome.
 */
function ChoiceGroup<T extends string | number>(props: {
  name: string;
  legend: string;
  options: Array<{
    value: T;
    line: string;
    about: string;
    disabled?: boolean;
    locked?: string | null;
  }>;
  selected: T;
  disabled: boolean;
  onSelect: (value: T) => void;
}) {
  const { name } = props;
  return (
    <fieldset
      class="choice"
      role="radiogroup"
      aria-labelledby={`${name}-legend`}
      disabled={props.disabled}
    >
      <legend id={`${name}-legend`}>{props.legend}</legend>
      {props.options.map((option, index) => {
        const optionDisabled = option.disabled === true;
        const describedBy =
          option.locked !== undefined && option.locked !== null
            ? `${name}-${index}-about ${name}-${index}-locked`
            : `${name}-${index}-about`;
        return (
          <label
            key={String(option.value)}
            class={optionDisabled ? 'choice-option choice-option-locked' : 'choice-option'}
          >
            <input
              type="radio"
              name={name}
              value={String(option.value)}
              checked={option.value === props.selected}
              disabled={optionDisabled}
              aria-labelledby={`${name}-${index}-line`}
              aria-describedby={describedBy}
              onChange={() => {
                if (!optionDisabled) {
                  props.onSelect(option.value);
                }
              }}
            />
            <span id={`${name}-${index}-line`}>{option.line}</span>
            <span id={`${name}-${index}-about`} class="choice-about muted">
              {option.about}
            </span>
            {option.locked !== undefined && option.locked !== null ? (
              <span id={`${name}-${index}-locked`} class="choice-about blocked">
                <Icon name="lock" /> {option.locked}
              </span>
            ) : null}
          </label>
        );
      })}
    </fieldset>
  );
}

/**
 * Primeira abertura (GDD §13.9): dois campos e um clique. Sem e-mail, sem senha, sem formulário.
 * Quem já tem conta mas ainda não tem feudo só precisa do nome do feudo. A dificuldade e o ritmo
 * já vêm marcados com o padrão do servidor: escolher é opcional, e "Jogar agora" não espera.
 */
export function Welcome(props: {
  /** Quem já governa neste navegador, mas ainda sem feudo. */
  account: { displayName: string } | null;
  busy: boolean;
  online: boolean;
  /** O servidor tem o vínculo com o GitHub ligado. */
  githubAvailable: boolean;
  /**
   * As opções de nova partida, vindas do servidor. `null` enquanto não chegam (ou se o servidor
   * não as tem): a tela fica como na v0.1 e o feudo nasce com os padrões do servidor.
   */
  options: NewGameOptions | null;
  /** Legado acumulado da conta, vindo de `GET /v1/stats`; `0` sem conta, `null` enquanto carrega. */
  legacy?: number | null;
  /** Semente preenchida pelo endereço (`#/nova?seed=…`); `null` sem pedido. */
  initialSeed?: string | null;
  /** Abre o campo de semente já na primeira exibição (ex.: ao chegar por `#/nova`). */
  openSeed?: boolean;
  actions: Actions;
}) {
  const { account, busy, online, actions, options } = props;
  const [displayName, setDisplayName] = useState('');
  const [settlementName, setSettlementName] = useState('Pedra Alta');
  const [picked, setPicked] = useState<Partial<NewGameChoice>>({});
  const [seedOpen, setSeedOpen] = useState(
    () =>
      props.openSeed === true || (props.initialSeed !== undefined && props.initialSeed !== null),
  );
  const [seed, setSeed] = useState(() => props.initialSeed ?? '');

  useEffect(() => {
    if (props.initialSeed !== undefined && props.initialSeed !== null) {
      setSeedOpen(true);
      setSeed(props.initialSeed);
    } else if (props.openSeed === true) {
      setSeedOpen(true);
    }
  }, [props.initialSeed, props.openSeed]);

  const ruler = account?.displayName ?? displayName;
  const trimmedSeed = seed.trim();
  const seedValid = trimmedSeed === '' || GameSeedSchema.safeParse(trimmedSeed).success;
  const ready = validName(ruler) && validName(settlementName) && seedValid;
  const legacy = props.legacy === undefined ? (account === null ? 0 : null) : props.legacy;
  const choice = options === null ? undefined : resolveChoice(options, picked, legacy);
  const scenarios = options?.scenarios;
  const hasScenarios = scenarios !== undefined && scenarios.length > 0;

  const submit = (event: Event) => {
    event.preventDefault();
    if (ready && !busy) {
      actions.playNow(
        ruler.trim(),
        settlementName.trim(),
        choice,
        trimmedSeed === '' ? undefined : trimmedSeed,
      );
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
        {options === null || choice === undefined ? null : (
          <div class="choices">
            <ChoiceGroup
              name="difficulty"
              legend="Dificuldade"
              options={options.difficulties.map((option) => ({
                value: option.id,
                line: difficultyLine(option),
                about: option.description,
              }))}
              selected={choice.difficulty}
              disabled={busy}
              onSelect={(difficulty) => setPicked({ ...picked, difficulty })}
            />
            <ChoiceGroup
              name="pace"
              legend="Ritmo"
              options={options.paces.map((option) => ({
                value: option.timeScale,
                line: paceLine(option),
                about: option.hint,
              }))}
              selected={choice.timeScale}
              disabled={busy}
              onSelect={(timeScale) => setPicked({ ...picked, timeScale })}
            />
            {hasScenarios && choice.scenario !== undefined ? (
              <ChoiceGroup
                name="scenario"
                legend="Cenário"
                options={scenarios.map((option) => ({
                  value: option.id,
                  line: scenarioLine(option),
                  about: option.description,
                  disabled: isScenarioLocked(option, legacy),
                  locked: scenarioLockedText(option, legacy),
                }))}
                selected={choice.scenario}
                disabled={busy}
                onSelect={(scenario) => setPicked({ ...picked, scenario })}
              />
            ) : null}
            <p class="muted hint choices-note">
              {hasScenarios
                ? 'Ficam gravados no feudo e não mudam durante o ano. Na dúvida, deixe como está.'
                : 'Os dois ficam gravados no feudo e não mudam durante o ano. Na dúvida, deixe como está.'}
            </p>
          </div>
        )}
        {seedOpen ? (
          <div class="welcome-seed">
            <label>
              Semente (opcional)
              <input
                type="text"
                name="seed"
                value={seed}
                maxLength={64}
                autocomplete="off"
                aria-describedby="seed-rule"
                onInput={(event) => setSeed((event.target as HTMLInputElement).value)}
              />
            </label>
            <p id="seed-rule" class="muted hint">
              Deixe em branco para sortear uma nova. Mesma semente e ritmo geram a mesma jornada.
            </p>
          </div>
        ) : null}
        <div class="row welcome-actions">
          <button type="submit" class="primary" disabled={!ready || busy || !online}>
            {busy ? 'Abrindo os portões…' : account === null ? 'Jogar agora' : 'Fundar o feudo'}
          </button>
          {seedOpen ? null : (
            <button
              type="button"
              class="secondary"
              disabled={busy}
              onClick={() => setSeedOpen(true)}
            >
              Escolher semente…
            </button>
          )}
        </div>
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
