import { parseCli, USAGE } from './cli';
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

  const result = await simulate(command.options);
  process.stdout.write(toCsv(result.rows));
  process.stderr.write(formatSummary(result));
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n\n${USAGE}`);
  process.exitCode = 1;
});
