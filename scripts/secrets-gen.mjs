// `pnpm secrets:gen`: cria deploy/.env a partir de deploy/.env.example e preenche os segredos
// que estiverem vazios. Nunca sobrescreve um valor existente: trocar RECOVERY_CODE_SECRET
// invalidaria todos os Códigos do Reino já emitidos (ADR 0003).
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const deployDir = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'deploy');
const envPath = resolve(deployDir, '.env');
const examplePath = resolve(deployDir, '.env.example');

const generators = {
  JWT_SECRET: () => randomBytes(48).toString('base64'),
  RECOVERY_CODE_SECRET: () => randomBytes(48).toString('base64'),
  // Hexadecimal para entrar em uma URL de conexão sem precisar de escape.
  POSTGRES_PASSWORD: () => randomBytes(24).toString('hex'),
};

const created = !existsSync(envPath);
const lines = readFileSync(created ? examplePath : envPath, 'utf8').split('\n');
const generated = [];
const kept = [];

for (const [name, generate] of Object.entries(generators)) {
  const index = lines.findIndex((line) => line.startsWith(`${name}=`));
  const current = index === -1 ? '' : lines[index].slice(name.length + 1).trim();
  if (current !== '') {
    kept.push(name);
    continue;
  }
  const entry = `${name}=${generate()}`;
  if (index === -1) {
    lines.push(entry);
  } else {
    lines[index] = entry;
  }
  generated.push(name);
}

if (created || generated.length > 0) {
  writeFileSync(envPath, lines.join('\n'), { mode: 0o600 });
}

// Só os nomes vão para a saída; os valores nunca são impressos.
console.log(
  created ? 'deploy/.env criado a partir de deploy/.env.example.' : 'deploy/.env já existia.',
);
console.log(`Gerados: ${generated.length > 0 ? generated.join(', ') : 'nenhum'}.`);
console.log(`Preservados: ${kept.length > 0 ? kept.join(', ') : 'nenhum'}.`);
