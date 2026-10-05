import { describe, expect, it } from 'vitest';

import { toCsv } from '../report';
import { simulate, type SimulationOptions } from '../simulate';

/**
 * Roadmap da v0.3, V3B-T2.1: enquanto nenhuma mecânica da Guilda existe, o explorador é o
 * econômico. A prova é a partida inteira, não a lista de políticas: as mesmas ordens, os mesmos
 * eventos, o mesmo estado final (com o gerador de sorteios) e o mesmo CSV.
 *
 * Quando a primeira política da Guilda entrar no explorador, este teste falha de propósito: ele
 * passa a valer só para o feudo em que aquela política não tem o que fazer, e a tarefa diz qual.
 */
const games: ReadonlyArray<Omit<SimulationOptions, 'strategy'>> = [
  // Um ano de jogo no ritmo de produção, com 2 sessões por dia: o comando de verificação.
  { seed: 'pedra-alta-001', days: 3, hours: 56, sessionsPerDay: 2, timeScale: 3 },
  // Sete dias reais no ritmo 1 com 4 sessões: outro prazo de ausência para a alocação.
  { seed: 'pedra-alta-017', days: 7, sessionsPerDay: 4, timeScale: 1 },
  // Outra dificuldade e o ritmo Tranquilo, com uma visita por dia.
  { seed: 'pedra-alta-050', days: 7, sessionsPerDay: 1, timeScale: 0.5, difficulty: 'ironKing' },
];

describe('bot explorador', () => {
  it.each(games)(
    'joga a mesma partida que o econômico: $seed, ritmo $timeScale, $sessionsPerDay por dia',
    async (options) => {
      const economico = await simulate({ ...options, strategy: 'economico' });
      const explorador = await simulate({ ...options, strategy: 'explorador' });
      expect(explorador.options.strategy).toBe('explorador');
      expect(explorador.commands).toEqual(economico.commands);
      expect(explorador.commands.accepted).toBeGreaterThan(0);
      expect(explorador.events).toEqual(economico.events);
      expect(explorador.finalState).toStrictEqual(economico.finalState);
      expect(toCsv(explorador.rows)).toBe(toCsv(economico.rows));
    },
  );
});
