import { formatSummary, toCsv } from './report';
import { simulate, strategies, type StrategyName } from './simulate';

const USAGE = `Uso: pnpm -s sim -- --seed <semente> [--days 7] [--strategy economico] [--sessions-per-day 2]

O CSV sai na saída padrão e o resumo na saída de erro:
  pnpm -s sim -- --seed pedra-alta-golden --days 7 > semana.csv
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

function positiveInteger(value: string, name: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`--${name} deve ser um inteiro positivo.`);
  }
  return parsed;
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const strategy = args.strategy ?? 'economico';
  if (args.seed === undefined) {
    throw new Error('Informe a semente com --seed.');
  }
  if (!(strategy in strategies)) {
    throw new Error(
      `Estratégia desconhecida: ${strategy}. Disponíveis: ${Object.keys(strategies).join(', ')}.`,
    );
  }
  if (args.remote !== undefined) {
    throw new Error('O modo --remote chega em F2-T8, junto com o servidor.');
  }
  const result = simulate({
    seed: args.seed,
    days: positiveInteger(args.days ?? '7', 'days'),
    strategy: strategy as StrategyName,
    sessionsPerDay: positiveInteger(args['sessions-per-day'] ?? '2', 'sessions-per-day'),
  });
  process.stdout.write(toCsv(result.rows));
  process.stderr.write(formatSummary(result));
}

try {
  main();
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n\n${USAGE}`);
  process.exitCode = 1;
}
