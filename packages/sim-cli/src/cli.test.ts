import { describe, expect, it } from 'vitest';

import { parseCli, USAGE } from './cli';

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
      'Estratégia desconhecida: guerreiro. Disponíveis: economico.',
    );
    expect(() => parseCli(['--seed', 's', '--strategy', 'toString'])).toThrow(
      /Estratégia desconhecida/,
    );
    expect(() => parseCli(['--seed', 's', '--time-scal', '3'])).toThrow(
      'Opção desconhecida: --time-scal',
    );
    expect(() => parseCli(['seed', 's'])).toThrow('Argumento inválido: seed');
  });

  it('sem semente nem servidor, pede um dos dois', () => {
    expect(() => parseCli([])).toThrow(/--seed.*--remote.*--smoke/);
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
  it('cita os três modos e avisa que a fumaça cria e exclui uma conta', () => {
    expect(USAGE).toContain('--time-scale');
    expect(USAGE).toContain('--remote <url>');
    expect(USAGE).toContain('--smoke <url> [--keep]');
    expect(USAGE).toMatch(/conta é excluída no fim/);
  });
});
