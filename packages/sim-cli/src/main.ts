import { parseCli, USAGE } from './cli';
import { formatMatrix, matrixCsv, runMatrix } from './matrix';
import { formatRemoteReport, runRemote } from './remote';
import { formatSummary, toCsv } from './report';
import { simulate } from './simulate';
import { formatSmokeReport, runSmoke } from './smoke';

async function main(): Promise<void> {
  const command = parseCli(process.argv.slice(2));

  if (command.mode === 'smoke') {
    const report = await runSmoke(command.options);
    process.stdout.write(formatSmokeReport(report));
    if (!report.ok) {
      process.exitCode = 1;
    }
    return;
  }

  if (command.mode === 'remote') {
    const report = await runRemote(command.options);
    process.stdout.write(formatRemoteReport(report));
    if (Object.keys(report.errors).length > 0) {
      process.exitCode = 1;
    }
    return;
  }

  if (command.mode === 'matrix') {
    const result = await runMatrix(command.options);
    process.stdout.write(matrixCsv(result));
    process.stderr.write(formatMatrix(result));
    if (result.cells.some((cell) => cell.violations.length > 0)) {
      process.exitCode = 1;
    }
    return;
  }

  const result = await simulate(command.options);
  // A mesma partida com as planejadas manuais: o resumo compara a fila ociosa das duas.
  const control = await simulate({ ...command.options, manualPlans: true });
  process.stdout.write(toCsv(result.rows));
  process.stderr.write(formatSummary(result, control));
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n\n${USAGE}`);
  process.exitCode = 1;
});
