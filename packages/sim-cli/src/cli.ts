import { DIFFICULTY_IDS, type DifficultyId } from '@lotg/content';

import { MATRIX_SEEDS, type MatrixOptions, windowRealHours } from './matrix';
import type { PerfOptions } from './perf';
import type { RemoteOptions } from './remote';
import { type SimulationOptions, strategies, type StrategyName } from './simulate';
import type { SmokeOptions } from './smoke';

export const USAGE = `Uso:
  pnpm -s sim -- --seed <semente> [--days 7 | --game-year] [--strategy economico] [--sessions-per-day 2] [--time-scale 1] [--difficulty lord]
  pnpm -s sim -- --matrix [--seeds 50] [--difficulty lord]
  pnpm -s sim -- --perf
  pnpm -s sim -- --remote <url> [--bots 50] [--minutes 2] [--poll-ms 2000] [--strategy economico]
  pnpm -s sim -- --smoke <url> [--keep]

Em processo, o CSV sai na saída padrão e o resumo na saída de erro:
  pnpm -s sim -- --seed pedra-alta-golden --days 7 > semana.csv
Com --time-scale, dias, sessões e linhas do CSV continuam em tempo real; o jogo anda N vezes mais rápido.
Com --game-year, a partida dura um ano de jogo completo: 56 h reais no ritmo 3, 14 dias no 0,5.
Com --difficulty, a partida nasce em peasant, lord ou ironKing.
Com --matrix, joga a matriz de balanceamento: 7 dias reais e um ano de jogo, em cada ritmo que o
jogo oferece, com os perfis de 1, 2 e 4 sessões por dia e as 50 sementes fixas (--seeds N usa só
as N primeiras). O CSV, uma linha por partida, sai na saída padrão; as tabelas, na saída de erro.
Há faixas para as três dificuldades; o comando sai com erro se alguma partida ficar fora delas.
Com --perf, mede o motor na volta de ausências de 1, 7 e 30 dias reais no ritmo 3: o tempo de um
advanceTo, os eventos emitidos e o tamanho do estado e da visão. A tabela sai na saída padrão.
Com --remote, os bots jogam contra um servidor pela API e o relatório traz p50 e p95 por endpoint.
Com --smoke, uma conta e uma partida são criadas no servidor para conferir concorrência e
idempotência das ordens; a conta é excluída no fim, a menos que --keep seja passado.
`;

export type CliCommand =
  | { mode: 'simulate'; options: SimulationOptions }
  | { mode: 'matrix'; options: MatrixOptions }
  | { mode: 'perf'; options: PerfOptions }
  | { mode: 'remote'; options: RemoteOptions }
  | { mode: 'smoke'; options: SmokeOptions };

/** Opções que pedem um valor, por modo. `strategy` vale em processo e no modo remoto. */
const SIMULATE_OPTIONS = ['seed', 'days', 'sessions-per-day', 'time-scale', 'difficulty'];
const MATRIX_OPTIONS = ['seeds', 'difficulty'];
const REMOTE_OPTIONS = ['remote', 'bots', 'minutes', 'poll-ms'];
const SMOKE_OPTIONS = ['smoke'];
const VALUE_OPTIONS = new Set([
  ...SIMULATE_OPTIONS,
  ...MATRIX_OPTIONS,
  ...REMOTE_OPTIONS,
  ...SMOKE_OPTIONS,
  'strategy',
]);
/** Opções sem valor. */
const FLAGS = new Set(['keep', 'matrix', 'game-year', 'perf']);

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

function difficultyOf(args: RawArgs): DifficultyId {
  const difficulty = args.values.difficulty ?? 'lord';
  const known: readonly string[] = DIFFICULTY_IDS;
  if (!known.includes(difficulty)) {
    throw new Error(
      `Dificuldade desconhecida: ${difficulty}. Disponíveis: ${DIFFICULTY_IDS.join(', ')}.`,
    );
  }
  return difficulty as DifficultyId;
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

  if (args.flags.has('perf')) {
    onlyFor(args, '--perf', ['perf']);
    return { mode: 'perf', options: {} };
  }

  if (args.flags.has('matrix')) {
    onlyFor(args, '--matrix', [...MATRIX_OPTIONS, 'matrix']);
    const count = positiveNumber(values.seeds ?? String(MATRIX_SEEDS.length), 'seeds');
    if (count > MATRIX_SEEDS.length) {
      throw new Error(`--seeds vai até ${MATRIX_SEEDS.length}: a lista de sementes é fixa.`);
    }
    return {
      mode: 'matrix',
      options: { seeds: MATRIX_SEEDS.slice(0, count), difficulty: difficultyOf(args) },
    };
  }

  if (values.seed === undefined) {
    throw new Error(
      'Informe a semente com --seed, a matriz com --matrix, a medida de desempenho com --perf, ou um servidor com --remote ou --smoke.',
    );
  }
  onlyFor(args, 'o modo em processo', [...SIMULATE_OPTIONS, 'strategy', 'game-year']);
  const timeScale = positiveNumber(values['time-scale'] ?? '1', 'time-scale', false);
  const options: SimulationOptions = {
    seed: values.seed,
    days: positiveNumber(values.days ?? '7', 'days'),
    strategy: strategyOf(args),
    sessionsPerDay: positiveNumber(values['sessions-per-day'] ?? '2', 'sessions-per-day'),
    timeScale,
    difficulty: difficultyOf(args),
  };
  if (args.flags.has('game-year')) {
    if (values.days !== undefined) {
      throw new Error('--game-year e --days não valem juntos: escolha uma duração.');
    }
    const hours = windowRealHours('year', timeScale);
    return { mode: 'simulate', options: { ...options, days: Math.ceil(hours / 24), hours } };
  }
  return { mode: 'simulate', options };
}
