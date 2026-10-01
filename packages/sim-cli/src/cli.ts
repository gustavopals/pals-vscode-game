import type { RemoteOptions } from './remote';
import { type SimulationOptions, strategies, type StrategyName } from './simulate';
import type { SmokeOptions } from './smoke';

export const USAGE = `Uso:
  pnpm -s sim -- --seed <semente> [--days 7] [--strategy economico] [--sessions-per-day 2] [--time-scale 1]
  pnpm -s sim -- --remote <url> [--bots 50] [--minutes 2] [--poll-ms 2000] [--strategy economico]
  pnpm -s sim -- --smoke <url> [--keep]

Em processo, o CSV sai na saída padrão e o resumo na saída de erro:
  pnpm -s sim -- --seed pedra-alta-golden --days 7 > semana.csv
Com --time-scale, dias, sessões e linhas do CSV continuam em tempo real; o jogo anda N vezes mais rápido.
Com --remote, os bots jogam contra um servidor pela API e o relatório traz p50 e p95 por endpoint.
Com --smoke, uma conta e uma partida são criadas no servidor para conferir concorrência e
idempotência das ordens; a conta é excluída no fim, a menos que --keep seja passado.
`;

export type CliCommand =
  | { mode: 'simulate'; options: SimulationOptions }
  | { mode: 'remote'; options: RemoteOptions }
  | { mode: 'smoke'; options: SmokeOptions };

/** Opções que pedem um valor, por modo. `strategy` vale em processo e no modo remoto. */
const SIMULATE_OPTIONS = ['seed', 'days', 'sessions-per-day', 'time-scale'];
const REMOTE_OPTIONS = ['remote', 'bots', 'minutes', 'poll-ms'];
const SMOKE_OPTIONS = ['smoke'];
const VALUE_OPTIONS = new Set([
  ...SIMULATE_OPTIONS,
  ...REMOTE_OPTIONS,
  ...SMOKE_OPTIONS,
  'strategy',
]);
/** Opções sem valor. */
const FLAGS = new Set(['keep']);

type RawArgs = { values: Record<string, string>; flags: Set<string> };

function readArgs(argv: string[]): RawArgs {
  const values: Record<string, string> = {};
  const flags = new Set<string>();
  // O pnpm repassa o separador `--`; ele não é uma opção.
  const args = argv.filter((arg) => arg !== '--');
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index] ?? '';
    if (!arg.startsWith('--')) {
      throw new Error(`Argumento inválido: ${arg}`);
    }
    const name = arg.slice(2);
    if (FLAGS.has(name)) {
      flags.add(name);
      continue;
    }
    if (!VALUE_OPTIONS.has(name)) {
      throw new Error(`Opção desconhecida: ${arg}`);
    }
    const value = args[index + 1];
    if (value === undefined || value.startsWith('--')) {
      throw new Error(`A opção ${arg} pede um valor.`);
    }
    values[name] = value;
    index += 1;
  }
  return { values, flags };
}

function positiveNumber(value: string, name: string, integer = true): number {
  // `Number('')` é 0 e `Number(' ')` também: a recusa de valores não positivos cobre os dois.
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0 || (integer && !Number.isInteger(parsed))) {
    throw new Error(`--${name} deve ser um ${integer ? 'inteiro' : 'número'} positivo.`);
  }
  return parsed;
}

function serverUrl(value: string, name: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`--${name} deve ser a URL do servidor (ex.: http://localhost:3000).`);
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`--${name} deve ser uma URL http ou https.`);
  }
  return value;
}

/** Recusa opções de outro modo em vez de ignorá-las em silêncio. */
function onlyFor(args: RawArgs, mode: string, allowed: string[]): void {
  const stray = [...Object.keys(args.values), ...args.flags].filter(
    (name) => !allowed.includes(name),
  );
  if (stray.length > 0) {
    throw new Error(`${stray.map((name) => `--${name}`).join(', ')} não vale com ${mode}.`);
  }
}

function strategyOf(args: RawArgs): StrategyName {
  const strategy = args.values.strategy ?? 'economico';
  if (!Object.hasOwn(strategies, strategy)) {
    throw new Error(
      `Estratégia desconhecida: ${strategy}. Disponíveis: ${Object.keys(strategies).join(', ')}.`,
    );
  }
  return strategy as StrategyName;
}

/** Lê a linha de comando (sem `node` nem o script) e devolve o modo com as opções validadas. */
export function parseCli(argv: string[]): CliCommand {
  const args = readArgs(argv);
  const { values } = args;

  if (values.smoke !== undefined) {
    onlyFor(args, '--smoke', [...SMOKE_OPTIONS, 'keep']);
    return {
      mode: 'smoke',
      options: { baseUrl: serverUrl(values.smoke, 'smoke'), keep: args.flags.has('keep') },
    };
  }

  if (values.remote !== undefined) {
    onlyFor(args, '--remote', [...REMOTE_OPTIONS, 'strategy']);
    return {
      mode: 'remote',
      options: {
        baseUrl: serverUrl(values.remote, 'remote'),
        bots: positiveNumber(values.bots ?? '50', 'bots'),
        minutes: positiveNumber(values.minutes ?? '2', 'minutes', false),
        pollMs: positiveNumber(values['poll-ms'] ?? '2000', 'poll-ms'),
        strategy: strategyOf(args),
      },
    };
  }

  if (values.seed === undefined) {
    throw new Error('Informe a semente com --seed, ou um servidor com --remote ou --smoke.');
  }
  onlyFor(args, 'o modo em processo', [...SIMULATE_OPTIONS, 'strategy']);
  return {
    mode: 'simulate',
    options: {
      seed: values.seed,
      days: positiveNumber(values.days ?? '7', 'days'),
      strategy: strategyOf(args),
      sessionsPerDay: positiveNumber(values['sessions-per-day'] ?? '2', 'sessions-per-day'),
      timeScale: positiveNumber(values['time-scale'] ?? '1', 'time-scale', false),
    },
  };
}
