import { describe, expect, it } from 'vitest';

import * as engine from './index';

// O texto de todos os fontes do motor, lido pelo Vitest sem tocar no sistema de arquivos.
const files = import.meta.glob<string>('./**/*.ts', {
  query: '?raw',
  import: 'default',
  eager: true,
});

const sources = Object.entries(files).filter(
  ([path]) =>
    !path.endsWith('.test.ts') && !path.endsWith('.d.ts') && !path.endsWith('test-helpers.ts'),
);

const forbidden: Array<[string, RegExp]> = [
  ['relógio do sistema', /Date\.now|new Date\b/],
  ['aleatoriedade sem semente', /Math\.random/],
  ['ambiente do processo', /\bprocess\./],
  ['módulos CommonJS', /\brequire\(/],
  ['módulos do Node', /from 'node:/],
  ['API do VS Code', /\bvscode\b/],
  ['rede', /\bfetch\(/],
];

describe('pureza do motor', () => {
  it('encontra os fontes do motor', () => {
    const names = sources.map(([path]) => path);
    expect(names).toContain('./advance.ts');
    expect(names).toContain('./commands.ts');
    expect(names).toContain('./migrations.ts');
    expect(names).toContain('./migrations/v1.ts');
    expect(names).toContain('./random.ts');
    expect(names.length).toBeGreaterThan(10);
  });

  it.each(forbidden)('nenhum fonte usa %s', (_, pattern) => {
    const offenders = sources.filter(([, text]) => pattern.test(text)).map(([path]) => path);
    expect(offenders).toEqual([]);
  });

  it('o motor só importa @lotg/content e os próprios módulos', () => {
    const imports = sources.flatMap(([, text]) =>
      [...text.matchAll(/from '([^']+)'/g)].map((match) => match[1] ?? ''),
    );
    const external = new Set(imports.filter((specifier) => !specifier.startsWith('.')));
    expect([...external]).toEqual(['@lotg/content']);
  });

  it('quem mostra, recusa, agenda ou carrega o estado não importa o gerador de sorteios', () => {
    // Só `advanceTo` sorteia, em eventos com hora marcada. A visão, as ordens, as recusas, a
    // linha do tempo, o estado inicial e a migração nunca: uma leitura não pode rerrolar nada.
    // No Conselho, o sorteio mora em `councilTurn.ts`; `council.ts` (a resposta, a expiração,
    // os efeitos) e `councilView.ts` ficam do lado de quem não sorteia. Na Ameaça, mora em
    // `hordeTurn.ts`; `threat.ts` (a subida e a Paliçada), `raids.ts` (o aviso, a resolução e
    // os feridos, que a linha do tempo, o estado inicial e as previsões da visão também usam)
    // e `threatView.ts` ficam do lado de quem não sorteia.
    const neverDraw =
      /^\.\/(view|seasonView|moraleView|morale|council|councilView|craftProjection|commands|rejections|timeline|state|migrations|units|clock|chronicle|threat|threatView|raids)(\.ts|\/)/;
    const guarded = sources.filter(([path]) => neverDraw.test(path));
    expect(guarded.map(([path]) => path)).toEqual(
      expect.arrayContaining([
        './view.ts',
        './seasonView.ts',
        './moraleView.ts',
        './morale.ts',
        './council.ts',
        './councilView.ts',
        './craftProjection.ts',
        './commands.ts',
        './rejections.ts',
        './timeline.ts',
        './threat.ts',
        './threatView.ts',
        './raids.ts',
      ]),
    );
    const offenders = guarded
      .filter(([, text]) => /from '(\.\.?\/)+random'/.test(text))
      .map(([path]) => path);
    expect(offenders).toEqual([]);
    // E quem sorteia na Ameaça é só a virada do dia.
    const draws = sources
      .filter(([, text]) => /from '(\.\.?\/)+random'/.test(text))
      .map(([path]) => path);
    expect(draws).toEqual(expect.arrayContaining(['./hordeTurn.ts']));
  });
});

describe('API pública', () => {
  it('exporta exatamente o contrato da fase', () => {
    expect(Object.keys(engine).sort()).toEqual([
      'CURRENT_SCHEMA_VERSION',
      'ENGINE_VERSION',
      'REJECTION_CODES',
      'StateMigrationError',
      'advanceTo',
      'applyCommand',
      'createInitialState',
      'deriveViewState',
      'migrateState',
      'nextEventAt',
    ]);
  });
});
