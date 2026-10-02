import type { NotificationLevel } from '../notifications/policy';
import { type Preferences, THEMES, type ThemeId } from '../services/preferences';
import { THEME_LABELS } from '../theme/theme';

const LEVELS: Array<{ value: NotificationLevel; label: string; hint: string }> = [
  { value: 'silent', label: 'Silencioso', hint: 'nenhum aviso' },
  {
    value: 'essential',
    label: 'Essenciais',
    hint: 'só o que pede ação, como a fome, o frio e a gente que vai embora',
  },
  { value: 'all', label: 'Todos', hint: 'também obras, aldeões e objetivos concluídos' },
];

/** A dificuldade e o ritmo do feudo aberto, com os textos que vieram do servidor. */
export type GameSettings = {
  difficultyLabel: string;
  paceLabel: string;
  /** O que a dificuldade muda, em uma frase; `null` se o servidor ainda não a mandou. */
  difficultyAbout: string | null;
};

/**
 * Preferências deste navegador (nenhuma delas vai para o servidor) e, no fim, a dificuldade e o
 * ritmo do feudo aberto, só para leitura: foram escolhidos ao fundá-lo.
 */
export function SettingsTab(props: {
  preferences: Preferences;
  /** O tema em uso (a escolha ou o do sistema). */
  theme: ThemeId;
  /** O navegador tem a Notification API. */
  browserNotificationsSupported: boolean;
  /** `null` sem feudo aberto. */
  game: GameSettings | null;
  onChange: (patch: Partial<Preferences>) => void;
  onBrowserNotifications: (enabled: boolean) => void;
  /** "Nova partida…": é onde se escolhe outra dificuldade ou outro ritmo. */
  onNewGame: () => void;
}) {
  const { preferences } = props;
  return (
    <form class="settings" onSubmit={(event) => event.preventDefault()}>
      <h1>Preferências</h1>
      <p class="lead">Valem só neste navegador.</p>

      <fieldset>
        <legend>Tema</legend>
        {THEMES.map((theme) => (
          <label key={theme}>
            <input
              type="radio"
              name="theme"
              value={theme}
              checked={props.theme === theme}
              onChange={() => props.onChange({ theme })}
            />
            {THEME_LABELS[theme]}
          </label>
        ))}
      </fieldset>

      <fieldset>
        <legend>Notificações</legend>
        {LEVELS.map((level) => (
          <label key={level.value}>
            <input
              type="radio"
              name="notifications"
              value={level.value}
              checked={preferences.notifications === level.value}
              onChange={() => props.onChange({ notifications: level.value })}
            />
            {level.label} <span class="muted">({level.hint})</span>
          </label>
        ))}
        <p class="muted hint">No máximo três avisos por hora; o que passar disso vira contador.</p>
        <label>
          <input
            type="checkbox"
            name="browserNotifications"
            checked={preferences.browserNotifications}
            disabled={!props.browserNotificationsSupported}
            onChange={(event) =>
              props.onBrowserNotifications((event.target as HTMLInputElement).checked)
            }
          />
          Avisar também pelo navegador, com a aba em segundo plano
        </label>
        <p class="muted hint">
          {props.browserNotificationsSupported
            ? 'O navegador pede a sua permissão ao ligar. Com a aba fechada, nada é enviado.'
            : 'Este navegador não tem notificações.'}
        </p>
      </fieldset>

      <fieldset>
        <legend>Modo discreto</legend>
        <label>
          <input
            type="checkbox"
            name="discreetMode"
            checked={preferences.discreetMode}
            onChange={(event) =>
              props.onChange({ discreetMode: (event.target as HTMLInputElement).checked })
            }
          />
          Mostrar só um contador na barra de status e no título da aba, sem avisos
        </label>
      </fieldset>

      <fieldset>
        <legend>Hora da Vigília</legend>
        <label>
          Hora local em que você costuma jogar
          <select
            name="vigilHour"
            value={String(preferences.vigilHour)}
            onChange={(event) =>
              props.onChange({ vigilHour: Number((event.target as HTMLSelectElement).value) })
            }
          >
            {Array.from({ length: 24 }, (_, hour) => (
              <option key={hour} value={String(hour)}>
                {String(hour).padStart(2, '0')}:00
              </option>
            ))}
          </select>
        </label>
        <p class="muted hint">
          Fica guardada com cada feudo fundado a partir de agora. Ainda não muda nada no jogo: é
          nessa hora que os grandes acontecimentos das próximas versões vão chegar.
        </p>
      </fieldset>

      {props.game === null ? null : (
        <fieldset class="settings-game">
          <legend>Esta partida</legend>
          <p>
            Dificuldade: {props.game.difficultyLabel} · Ritmo: {props.game.paceLabel}{' '}
            <span class="muted">(não mudam durante o ano)</span>
          </p>
          {props.game.difficultyAbout === null ? null : (
            <p class="muted hint">{props.game.difficultyAbout}</p>
          )}
          <p class="muted hint">
            Ficam gravados no feudo, em qualquer navegador. Para jogar em outro ritmo ou em outra
            dificuldade, comece uma nova partida: o feudo atual é arquivado.
          </p>
          <button type="button" class="secondary" onClick={props.onNewGame}>
            Nova partida…
          </button>
        </fieldset>
      )}
    </form>
  );
}
