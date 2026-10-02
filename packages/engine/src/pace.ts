import { balance } from '@lotg/content';

import { YEAR_MS } from './clock';
import { decimal, plural } from './format';
import { assertTimeScale } from './units';

const MINUTE_MS = 60_000;
const MINUTES_PER_HOUR = 60;
const MINUTES_PER_DAY = 24 * MINUTES_PER_HOUR;
/** A partir de três dias a frase fala em dias e horas; antes disso, em horas e minutos. */
const DAYS_FROM_MINUTES = 3 * MINUTES_PER_DAY;
/** Folga para a divisão em ponto flutuante: 168 h ÷ 0,7 são 10 dias, não "cerca de" 10 dias. */
const EXACT_WITHIN_MINUTES = 1e-6;

function join(parts: string[]): string {
  return parts.filter((part) => part !== '').join(' e ');
}

/**
 * Quanto dura o ano de jogo no relógio do jogador, pela conta "ano de jogo ÷ ritmo": "um ano em
 * 56 horas", "um ano em 7 dias". Quando a frase arredonda, ela diz "cerca de". Só produz texto:
 * nenhum prazo do jogo sai daqui.
 */
export function yearInRealTime(timeScale: number): string {
  assertTimeScale(timeScale);
  const raw = YEAR_MS / timeScale / MINUTE_MS;
  let minutes = Math.round(raw);
  if (minutes < 1) {
    return 'um ano em menos de 1 minuto';
  }
  let exact = Math.abs(raw - minutes) < EXACT_WITHIN_MINUTES;
  if (minutes >= DAYS_FROM_MINUTES && minutes % MINUTES_PER_HOUR !== 0) {
    // Em um prazo de dias, os minutos só atrapalham: arredonda para a hora mais próxima.
    minutes = Math.round(minutes / MINUTES_PER_HOUR) * MINUTES_PER_HOUR;
    exact = false;
  }
  const inDays = minutes % MINUTES_PER_DAY === 0 || minutes >= DAYS_FROM_MINUTES;
  const days = inDays ? Math.floor(minutes / MINUTES_PER_DAY) : 0;
  const hours = Math.floor((minutes - days * MINUTES_PER_DAY) / MINUTES_PER_HOUR);
  const rest = minutes % MINUTES_PER_HOUR;
  const duration = join([
    days > 0 ? plural(days, 'dia', 'dias') : '',
    hours > 0 ? plural(hours, 'hora', 'horas') : '',
    rest > 0 ? plural(rest, 'minuto', 'minutos') : '',
  ]);
  return `um ano em ${exact ? '' : 'cerca de '}${duration}`;
}

/**
 * O ritmo da partida, pronto para exibir: "Rápido: um ano em 56 horas". Um ritmo que não está
 * entre os oferecidos (uma partida da v0.1 criada com outro `GAME_TIME_SCALE`) não ganha o nome
 * de nenhum deles: sai como "Ritmo 7×", com a duração calculada.
 */
export function paceLabel(timeScale: number): string {
  const offered = balance.paces.find((pace) => pace.timeScale === timeScale);
  return offered === undefined
    ? `Ritmo ${decimal(timeScale)}×: ${yearInRealTime(timeScale)}`
    : `${offered.label}: ${offered.description}`;
}
