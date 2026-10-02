import { fileURLToPath } from 'node:url';

import { build } from 'vite';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

// Só este teste lê o conteúdo, e por caminho relativo: o app não depende de `@lotg/content`.
import * as content from '../../content/src/index';

/**
 * O app só exibe: números e textos de jogo chegam pelo `ViewState` e por `GET /catalog`, nunca
 * dentro do JavaScript servido (ADR 0013, decisão 2a; roadmap da v0.2, §0.7, "Visão e
 * privacidade narrativa"). Do conteúdo, o pacote só pode levar as listas de identificadores que
 * os schemas do protocolo usam. O que garante isso é o descarte de código sem uso do build: um
 * uso de `balance` em tempo de execução dentro de `@lotg/protocol` basta para a tabela inteira
 * ir ao navegador, sem lint nem tipo acusarem. Por isso este teste compila o app de verdade.
 */
const ALLOWED_CONTENT_EXPORTS: readonly string[] = [
  'BUILDING_IDS',
  'DIFFICULTY_IDS',
  'ENEMY_IDS',
  'EVENT_TYPES',
  'MORALE_BAND_IDS',
  'MORALE_TERM_IDS',
  'PRODUCTION_BUILDING_IDS',
  'RESOURCE_IDS',
  'SEASON_IDS',
];

type BundledModule = { id: string; exports: readonly string[] };

let code = '';
let contentModules: BundledModule[] = [];

beforeAll(async () => {
  // O Vitest roda com NODE_ENV=test; o pacote que vai ao ar é o de produção.
  vi.stubEnv('NODE_ENV', 'production');
  const result = await build({
    root: fileURLToPath(new URL('..', import.meta.url)),
    logLevel: 'silent',
    build: { write: false },
  });
  const outputs = Array.isArray(result) ? result : [result];
  for (const output of outputs) {
    if (!('output' in output)) {
      throw new Error('O build do app não devolveu os arquivos gerados.');
    }
    for (const chunk of output.output) {
      if (chunk.type !== 'chunk') {
        continue;
      }
      code += chunk.code;
      for (const [id, module] of Object.entries(chunk.modules)) {
        if (id.includes('/packages/content/src/')) {
          contentModules.push({ id, exports: module.renderedExports });
        }
      }
    }
  }
});

afterAll(() => {
  vi.unstubAllEnvs();
  code = '';
  contentModules = [];
});

/** Os textos de jogo de um valor do conteúdo: frases, não identificadores. */
function phrases(value: unknown, found: Set<string> = new Set()): Set<string> {
  if (typeof value === 'string') {
    if (value.length >= 12 && value.includes(' ')) {
      found.add(value);
    }
  } else if (Array.isArray(value)) {
    value.forEach((item) => phrases(item, found));
  } else if (typeof value === 'object' && value !== null) {
    Object.values(value).forEach((item) => phrases(item, found));
  }
  return found;
}

describe('o pacote do app', () => {
  it('é compilado inteiro, com o protocolo dentro', () => {
    expect(code.length).toBeGreaterThan(50_000);
    expect(contentModules.map((module) => module.id).join('\n')).toContain('content/src/ids.ts');
  });

  it('do conteúdo, só leva as listas de identificadores', () => {
    const carried = [...new Set(contentModules.flatMap((module) => module.exports))].sort();
    expect(carried.filter((name) => !ALLOWED_CONTENT_EXPORTS.includes(name))).toEqual([]);
  });

  it('não leva nenhum número de regra', () => {
    for (const marker of [
      'perWorkerPerHour:{',
      'foodPerVillagerPerHour:',
      'storageCapacity:{',
      'famineDesertion:',
      'costFactor:{',
      'baseCost:{',
    ]) {
      expect(code.includes(marker), marker).toBe(false);
    }
  });

  it('não leva nenhuma frase do conteúdo', () => {
    const secret = Object.entries(content)
      .filter(([name]) => !ALLOWED_CONTENT_EXPORTS.includes(name))
      .flatMap(([, value]) => [...phrases(value)]);
    // A lista não pode esvaziar sem ninguém notar: dificuldades, ritmos, objetivos e Crônica.
    expect(secret.length).toBeGreaterThan(30);
    expect(secret.filter((phrase) => code.includes(phrase))).toEqual([]);
  });
});
