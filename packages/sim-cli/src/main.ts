import { formatRemoteReport, runRemote } from './remote';
import { formatSummary, toCsv } from './report';
import { simulate, strategies, type StrategyName } from './simulate';

const USAGE = `Uso:
  pnpm -s sim -- --seed <semente> [--days 7] [--strategy economico] [--sessions-per-day 2]
  pnpm -s sim -- --remote <url> [--bots 50] [--minutes 2] [--poll-ms 2000] [--strategy economico]

Em processo, o CSV sai na saída padrão e o resumo na saída de erro:
  pnpm -s sim -- --seed pedra-alta-golden --days 7 > semana.csv
Com --remote, os bots jogam contra um servidor pela API e o relatório traz p50 e p95 por endpoint.
`;

function parseArgs(argv: string[]): Record<string, string> {
  const options: Record<string, string> = {};
  // O pnpm repassa o separador `--`; ele não é uma opção.
  const args = argv.filter((arg) => arg !== '--');
  for (let index = 0; index < args.length; index += 2) {
    const name = args[index];
    const value = args[index + 1];
    if (name === undefined || !name.startsWith('--') || value === undefined) {
      throw new Error(`Argumento inválido: ${name ?? ''}`);
    }
    options[name.slice(2)] = value;
  }
  return options;
}

function positiveNumber(value: string, name: string, integer = true): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0 || (integer && !Number.isInteger(parsed))) {
    throw new Error(`--${name} deve ser um ${integer ? 'inteiro' : 'número'} positivo.`);
  }
  return parsed;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const strategy = args.strategy ?? 'economico';
  if (!(strategy in strategies)) {
    throw new Error(
      `Estratégia desconhecida: ${strategy}. Disponíveis: ${Object.keys(strategies).join(', ')}.`,
    );
  }

  if (args.remote !== undefined) {
    const report = await runRemote({
      baseUrl: args.remote,
      bots: positiveNumber(args.bots ?? '50', 'bots'),
      minutes: positiveNumber(args.minutes ?? '2', 'minutes', false),
      pollMs: positiveNumber(args['poll-ms'] ?? '2000', 'poll-ms'),
      strategy: strategy as StrategyName,
    });
    process.stdout.write(formatRemoteReport(report));
    if (Object.keys(report.errors).length > 0) {
      process.exitCode = 1;
    }
    return;
  }

  if (args.seed === undefined) {
    throw new Error('Informe a semente com --seed, ou um servidor com --remote.');
  }
  const result = await simulate({
    seed: args.seed,
    days: positiveNumber(args.days ?? '7', 'days'),
    strategy: strategy as StrategyName,
    sessionsPerDay: positiveNumber(args['sessions-per-day'] ?? '2', 'sessions-per-day'),
  });
  process.stdout.write(toCsv(result.rows));
  process.stderr.write(formatSummary(result));
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n\n${USAGE}`);
  process.exitCode = 1;
});
