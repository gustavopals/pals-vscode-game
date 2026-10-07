import { describe, expect, it } from 'vitest';

import { summarize, toCsv } from '../report';
import { simulate, type SimulationOptions } from '../simulate';
import { economicoPolicies } from './economico';
import { exploradorPolicies } from './explorador';
import { preguicosoPolicies } from './preguicoso';

/**
 * O explorador é o econômico mais as políticas da Guilda (roadmap da v0.3, V3B-T2.1 e V3C-T2.7).
 * Enquanto o feudo não tem Taverna, as duas políticas novas não têm o que fazer, e a partida é a
 * do econômico, ordem por ordem: as mesmas ordens, os mesmos eventos, o mesmo estado final (com
 * o gerador de sorteios) e o mesmo CSV. Com a Taverna, ele contrata e dá festival, e o econômico
 * não.
 */
const beforeTavern: ReadonlyArray<Omit<SimulationOptions, 'strategy'>> = [
  // As primeiras horas, em cada ritmo e cadência de visitas: o Salão ainda não chegou ao nível 3.
  { seed: 'pedra-alta-001', days: 1, hours: 4, sessionsPerDay: 2, timeScale: 3 },
  { seed: 'pedra-alta-017', days: 1, hours: 12, sessionsPerDay: 4, timeScale: 1 },
  { seed: 'pedra-alta-050', days: 1, sessionsPerDay: 1, timeScale: 0.5, difficulty: 'ironKing' },
];

const withTavern: ReadonlyArray<Omit<SimulationOptions, 'strategy'>> = [
  // Um ano de jogo no ritmo de produção, com 2 sessões por dia: o comando de verificação.
  { seed: 'pedra-alta-001', days: 3, hours: 56, sessionsPerDay: 2, timeScale: 3 },
  // Sete dias reais no ritmo 1 com 4 sessões: outro prazo de ausência para a alocação.
  { seed: 'pedra-alta-017', days: 7, sessionsPerDay: 4, timeScale: 1 },
];

describe('bot explorador', () => {
  it('as políticas são as do econômico, na ordem, com a Guilda na frente de todas as obras (e de novo depois das cartas) e contratar, festejar, escolher o caminho e enviar antes da alocação', () => {
    const names = (policies: typeof exploradorPolicies) => policies.map((policy) => policy.name);
    // A Guilda vem na frente de tudo (revisão da Fase D, M-R1): é a obra que dá trabalho a quem
    // já recebe soldo. E de novo depois das cartas: a que promete um herói acabou de ser
    // respondida, e a obra fica planejada nesta visita.
    expect(names(exploradorPolicies)).toEqual([
      'erguer a Guilda',
      'erguer a Paliçada',
      'seguir os objetivos',
      'erguer a Torre',
      'obra mais barata',
      'ampliar o estoque',
      'planejar automáticas',
      'recrutar',
      'responder a carta',
      'erguer a Guilda',
      'contratar',
      'dar festival',
      'escolher o caminho',
      'equipar o melhor item',
      'enviar expedições',
      'alocar por demanda',
      'alocar o Mestre',
      'mandar caravana',
      'vender o excedente',
      'erguer o Mercado',
      'comprar lenha',
      'guardar lenha',
    ]);
    const own = [
      'erguer a Guilda',
      'contratar',
      'dar festival',
      'escolher o caminho',
      'equipar o melhor item',
      'enviar expedições',
    ];
    expect(names(exploradorPolicies).filter((name) => !own.includes(name))).toEqual(
      names(economicoPolicies),
    );
    // O econômico e o preguiçoso nunca contratam nem dão festival (V3C-T2.7), e não erguem a
    // Guilda dos Aventureiros nem enviam expedições (V3D-T1).
    for (const policies of [economicoPolicies, preguicosoPolicies]) {
      for (const name of own) {
        expect(names(policies)).not.toContain(name);
      }
    }
  });

  it.each(beforeTavern)(
    'sem Taverna joga a mesma partida que o econômico: $seed, ritmo $timeScale, $sessionsPerDay por dia',
    async (options) => {
      const economico = await simulate({ ...options, strategy: 'economico' });
      const explorador = await simulate({ ...options, strategy: 'explorador' });
      expect(explorador.finalState.settlement.buildings.tavern).toBe(0);
      expect(explorador.options.strategy).toBe('explorador');
      expect(explorador.commands).toEqual(economico.commands);
      expect(explorador.commands.accepted).toBeGreaterThan(0);
      expect(explorador.events).toEqual(economico.events);
      expect(explorador.finalState).toStrictEqual(economico.finalState);
      expect(toCsv(explorador.rows)).toBe(toCsv(economico.rows));
    },
  );

  it.each(withTavern)(
    'com a Taverna contrata sem nenhuma ordem recusada, e o econômico não contrata: $seed, ritmo $timeScale',
    async (options) => {
      const economico = summarize(await simulate({ ...options, strategy: 'economico' }));
      const result = await simulate({ ...options, strategy: 'explorador' });
      const explorador = summarize(result);
      // Os dois erguem a Taverna: ela é uma obra como as outras.
      expect(economico.guild.tavernLevel).toBeGreaterThan(0);
      expect(explorador.guild.tavernLevel).toBeGreaterThan(0);
      expect(economico.guild.hired).toBe(0);
      expect(economico.guild.festivals).toBe(0);
      expect(explorador.guild.hired).toBeGreaterThan(0);
      // Nenhuma ordem saiu para ser recusada: a política só pede o que a visão diz que pode.
      expect(result.commands.refused).toEqual({});
      // Quem contratou está no feudo, ou partiu sem soldo: a conta fecha com o herói da carta.
      const joined = result.events.filter((event) => event.type === 'heroJoined').length;
      expect(explorador.guild.heroes).toBe(
        joined + explorador.guild.hired - explorador.guild.departed,
      );
      // E nunca passa do que a Taverna abriga.
      expect(explorador.guild.heroes).toBeLessThanOrEqual(1 + explorador.guild.tavernLevel);
      // As colunas dos heróis saem medidas no CSV.
      const last = result.rows[result.rows.length - 1];
      expect(last?.guild.heroes).toBe(explorador.guild.heroes);
      expect(last?.guild.departed).toBe(explorador.guild.departed);
    },
  );
});
