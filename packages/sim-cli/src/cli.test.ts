import { describe, expect, it } from 'vitest';

import { parseCli, USAGE } from './cli';
import { MATRIX_SEEDS } from './matrix';

describe('linha de comando: modo em processo', () => {
  it('só com a semente, usa os padrões: 7 dias, 2 sessões, ritmo 1, Senhor', () => {
    expect(parseCli(['--seed', 'pedra-alta'])).toEqual({
      mode: 'simulate',
      options: {
        seed: 'pedra-alta',
        days: 7,
        strategy: 'economico',
        sessionsPerDay: 2,
        timeScale: 1,
        difficulty: 'lord',
      },
    });
  });

  it('ignora o separador que o pnpm repassa e lê todas as opções', () => {
    const args =
      '-- --seed s --days 3 --strategy economico --sessions-per-day 4 --time-scale 3 --difficulty peasant';
    expect(parseCli(args.split(' '))).toEqual({
      mode: 'simulate',
      options: {
        seed: 's',
        days: 3,
        strategy: 'economico',
        sessionsPerDay: 4,
        timeScale: 3,
        difficulty: 'peasant',
      },
    });
  });

  it('aceita ritmo fracionário', () => {
    expect(parseCli(['--seed', 's', '--time-scale', '0.5'])).toMatchObject({
      options: { timeScale: 0.5 },
    });
  });

  it.each(['0', '-1', 'abc', 'NaN', 'Infinity', '3x', ''])('recusa --time-scale "%s"', (value) => {
    expect(() => parseCli(['--seed', 's', '--time-scale', value])).toThrow(
      '--time-scale deve ser um número positivo.',
    );
  });

  it('recusa --time-scale sem valor', () => {
    expect(() => parseCli(['--seed', 's', '--time-scale'])).toThrow(
      'A opção --time-scale pede um valor.',
    );
    expect(() => parseCli(['--time-scale', '--seed', 's'])).toThrow(
      'A opção --time-scale pede um valor.',
    );
  });

  it('recusa dias e sessões que não são inteiros positivos', () => {
    expect(() => parseCli(['--seed', 's', '--days', '1.5'])).toThrow(
      '--days deve ser um inteiro positivo.',
    );
    expect(() => parseCli(['--seed', 's', '--sessions-per-day', '0'])).toThrow(
      '--sessions-per-day deve ser um inteiro positivo.',
    );
  });

  it('recusa estratégia e opção desconhecidas, e argumento solto', () => {
    expect(() => parseCli(['--seed', 's', '--strategy', 'guerreiro'])).toThrow(
      'Estratégia desconhecida: guerreiro. Disponíveis: economico, preguicoso.',
    );
    expect(() => parseCli(['--seed', 's', '--strategy', 'toString'])).toThrow(
      /Estratégia desconhecida/,
    );
    expect(() => parseCli(['--seed', 's', '--time-scal', '3'])).toThrow(
      'Opção desconhecida: --time-scal',
    );
    expect(() => parseCli(['seed', 's'])).toThrow('Argumento inválido: seed');
  });

  it('aceita o bot preguiçoso', () => {
    expect(parseCli(['--seed', 's', '--strategy', 'preguicoso'])).toMatchObject({
      options: { strategy: 'preguicoso' },
    });
  });

  it('--game-year dura um ano de jogo: 56 h reais no ritmo 3, 14 dias no 0,5', () => {
    expect(parseCli(['--seed', 's', '--game-year'])).toMatchObject({
      mode: 'simulate',
      options: { days: 7, hours: 168, timeScale: 1 },
    });
    expect(parseCli(['--seed', 's', '--game-year', '--time-scale', '3'])).toMatchObject({
      options: { days: 3, hours: 56, timeScale: 3 },
    });
    expect(parseCli(['--game-year', '--time-scale', '0.5', '--seed', 's'])).toMatchObject({
      options: { days: 14, hours: 336, timeScale: 0.5 },
    });
    expect(parseCli(['--seed', 's']).options).not.toHaveProperty('hours');
  });

  it('--game-year não vale com --days nem com um ritmo em que o ano não fecha em horas', () => {
    expect(() => parseCli(['--seed', 's', '--game-year', '--days', '3'])).toThrow(
      '--game-year e --days não valem juntos: escolha uma duração.',
    );
    expect(() => parseCli(['--seed', 's', '--game-year', '--time-scale', '5'])).toThrow(
      'No ritmo 5× um ano de jogo dura 33,6 h reais; o simulador anda em horas inteiras.',
    );
  });

  it('sem semente, matriz nem servidor, pede um deles', () => {
    expect(() => parseCli([])).toThrow(/--seed.*--matrix.*--remote.*--smoke/);
    expect(() => parseCli(['--days', '3'])).toThrow(/Informe a semente/);
  });

  it('recusa opções do modo remoto', () => {
    expect(() => parseCli(['--seed', 's', '--bots', '5'])).toThrow(
      '--bots não vale com o modo em processo.',
    );
    expect(() => parseCli(['--seed', 's', '--keep'])).toThrow(
      '--keep não vale com o modo em processo.',
    );
  });
});

describe('linha de comando: matriz', () => {
  it('sem mais nada, joga as 50 sementes fixas na dificuldade Senhor', () => {
    const command = parseCli(['--', '--matrix']);
    expect(command).toMatchObject({ mode: 'matrix', options: { difficulty: 'lord' } });
    expect(command.mode === 'matrix' && command.options.seeds).toEqual(MATRIX_SEEDS);
  });

  it('--seeds N usa as N primeiras da lista; --difficulty troca a dificuldade', () => {
    expect(parseCli(['--matrix', '--seeds', '3', '--difficulty', 'ironKing'])).toEqual({
      mode: 'matrix',
      options: {
        seeds: ['pedra-alta-001', 'pedra-alta-002', 'pedra-alta-003'],
        difficulty: 'ironKing',
      },
    });
  });

  it('recusa mais sementes do que a lista tem, e um número que não é inteiro positivo', () => {
    expect(() => parseCli(['--matrix', '--seeds', '51'])).toThrow(
      '--seeds vai até 50: a lista de sementes é fixa.',
    );
    expect(() => parseCli(['--matrix', '--seeds', '0'])).toThrow(
      '--seeds deve ser um inteiro positivo.',
    );
  });

  it('recusa as opções de uma partida só e dos modos com servidor', () => {
    expect(() => parseCli(['--matrix', '--seed', 's'])).toThrow('--seed não vale com --matrix.');
    expect(() => parseCli(['--matrix', '--time-scale', '3'])).toThrow(
      '--time-scale não vale com --matrix.',
    );
    expect(() => parseCli(['--matrix', '--game-year'])).toThrow(
      '--game-year não vale com --matrix.',
    );
    expect(() => parseCli(['--seed', 's', '--seeds', '3'])).toThrow(
      '--seeds não vale com o modo em processo.',
    );
    expect(() => parseCli(['--remote', 'http://localhost:3000', '--matrix'])).toThrow(
      '--matrix não vale com --remote.',
    );
    expect(() => parseCli(['--smoke', 'http://localhost:3000', '--matrix'])).toThrow(
      '--matrix não vale com --smoke.',
    );
  });
});

describe('linha de comando: desempenho', () => {
  it('--perf mede o motor nas ausências longas, sem opção nenhuma', () => {
    expect(parseCli(['--perf'])).toEqual({ mode: 'perf', options: {} });
    expect(parseCli(['--', '--perf'])).toEqual({ mode: 'perf', options: {} });
  });

  it('recusa as opções dos outros modos', () => {
    expect(() => parseCli(['--perf', '--seed', 's'])).toThrow('--seed não vale com --perf.');
    expect(() => parseCli(['--perf', '--matrix'])).toThrow('--matrix não vale com --perf.');
    expect(() => parseCli(['--perf', '--difficulty', 'lord'])).toThrow(
      '--difficulty não vale com --perf.',
    );
  });
});

describe('linha de comando: modo remoto', () => {
  it('lê o servidor e usa os padrões', () => {
    expect(parseCli(['--remote', 'http://localhost:3000'])).toEqual({
      mode: 'remote',
      options: {
        baseUrl: 'http://localhost:3000',
        bots: 50,
        minutes: 2,
        pollMs: 2000,
        strategy: 'economico',
      },
    });
    expect(
      parseCli('--remote http://localhost:3000 --bots 5 --minutes 0.5 --poll-ms 5000'.split(' ')),
    ).toMatchObject({ options: { bots: 5, minutes: 0.5, pollMs: 5000 } });
  });

  it('o ritmo é o do servidor: --time-scale não vale', () => {
    expect(() => parseCli(['--remote', 'http://localhost:3000', '--time-scale', '3'])).toThrow(
      '--time-scale não vale com --remote.',
    );
  });
});

describe('linha de comando: fumaça', () => {
  it('lê o servidor; a conta é excluída por padrão', () => {
    expect(parseCli(['--', '--smoke', 'http://localhost:3000'])).toEqual({
      mode: 'smoke',
      options: { baseUrl: 'http://localhost:3000', keep: false },
    });
  });

  it('--keep não pede valor e vale antes ou depois da URL', () => {
    const expected = { mode: 'smoke', options: { baseUrl: 'https://exemplo.test', keep: true } };
    expect(parseCli(['--smoke', 'https://exemplo.test', '--keep'])).toEqual(expected);
    expect(parseCli(['--keep', '--smoke', 'https://exemplo.test'])).toEqual(expected);
  });

  it('recusa URL ausente ou que não é http', () => {
    expect(() => parseCli(['--smoke'])).toThrow('A opção --smoke pede um valor.');
    expect(() => parseCli(['--smoke', '--keep'])).toThrow('A opção --smoke pede um valor.');
    expect(() => parseCli(['--smoke', 'localhost'])).toThrow(/--smoke deve ser a URL do servidor/);
    expect(() => parseCli(['--smoke', 'ftp://exemplo.test'])).toThrow(
      '--smoke deve ser uma URL http ou https.',
    );
  });

  it('recusa misturar com os outros modos', () => {
    expect(() => parseCli(['--smoke', 'http://a.test', '--seed', 's'])).toThrow(
      '--seed não vale com --smoke.',
    );
    expect(() => parseCli(['--smoke', 'http://a.test', '--remote', 'http://b.test'])).toThrow(
      '--remote não vale com --smoke.',
    );
    expect(() => parseCli(['--smoke', 'http://a.test', '--bots', '3'])).toThrow(
      '--bots não vale com --smoke.',
    );
  });
});

describe('texto de uso', () => {
  it('cita os cinco modos e avisa que a fumaça cria e exclui uma conta', () => {
    expect(USAGE).toContain('--time-scale');
    expect(USAGE).toContain('pnpm -s sim -- --perf\n');
    expect(USAGE).toContain('Há faixas para as três dificuldades');
    expect(USAGE).toContain('--matrix [--seeds 50] [--difficulty lord]');
    expect(USAGE).toContain('--days 7 | --game-year');
    expect(USAGE).toContain('--remote <url>');
    expect(USAGE).toContain('--smoke <url> [--keep]');
    expect(USAGE).toMatch(/conta é excluída no fim/);
  });
});
