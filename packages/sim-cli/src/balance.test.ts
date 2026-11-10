import { balance, DIFFICULTY_IDS, type DifficultyId } from '@lotg/content';
import { describe, expect, it } from 'vitest';

import { bandFor, baselineFor, cellKey } from './bands';
import {
  MATRIX_SEEDS,
  type MatrixRun,
  PROFILES,
  runMatrix,
  wasteGoalCells,
  WINDOWS,
  YEAR_GAME_HOURS,
} from './matrix';
import { MILESTONES, WASTE_STREAK_GOAL } from './report';
import { simulate } from './simulate';

// A matriz inteira: 2 janelas × 3 ritmos × 4 perfis × 50 sementes, em Senhor: 1.200
// registros e 1.000 partidas distintas (as duas janelas do Normal repetem a mesma partida).
const matrix = await runMatrix();
const paces = balance.paces.map((pace) => pace.timeScale);

// As outras duas dificuldades têm faixa desde a rodada de balanceamento da Fase C (V2C-T7). Aqui
// elas jogam as 3 primeiras sementes: enquanto nenhum bot chega a sortear, todas as sementes dão
// a mesma partida, e as 50 pesariam três vezes na suíte. As 50 rodam pelo comando
// (`pnpm -s sim -- --matrix --difficulty peasant`), e é delas a linha de base de `bands.ts`.
const OTHER_SEEDS = MATRIX_SEEDS.slice(0, 3);
const others = {
  peasant: await runMatrix({ difficulty: 'peasant', seeds: OTHER_SEEDS }),
  ironKing: await runMatrix({ difficulty: 'ironKing', seeds: OTHER_SEEDS }),
};
const byDifficulty: Record<DifficultyId, typeof matrix> = { ...others, lord: matrix };

describe('faixas de balanceamento por ritmo (roadmap da v0.2, V2B-T4)', () => {
  // Se uma faixa falhar, leia o cabeçalho de `MEASURED` em bands.ts antes de mexer em número.
  it('há uma faixa para cada janela, cada ritmo que o jogo oferece e cada perfil, em cada dificuldade', () => {
    expect(Object.keys(byDifficulty).sort()).toEqual([...DIFFICULTY_IDS].sort());
    for (const difficulty of DIFFICULTY_IDS) {
      const { cells } = byDifficulty[difficulty];
      expect(cells, difficulty).toHaveLength(WINDOWS.length * paces.length * PROFILES.length);
      for (const window of WINDOWS) {
        for (const timeScale of paces) {
          for (const profile of PROFILES) {
            const key = cellKey(window.id, timeScale, profile.id);
            expect(bandFor(key, difficulty), `${difficulty} ${key}`).not.toBeNull();
          }
        }
      }
      expect(cells.every((cell) => cell.band !== null)).toBe(true);
    }
    expect(matrix.cells.every((cell) => cell.seeds === 50)).toBe(true);
  });

  it('as 50 sementes de cada célula ficam dentro da faixa: população, Salão, fome e excedente parado', () => {
    expect(matrix.seeds).toBe(MATRIX_SEEDS);
    expect(matrix.runs).toHaveLength(matrix.cells.length * MATRIX_SEEDS.length);
    expect(matrix.cells.flatMap((cell) => cell.violations)).toEqual([]);
  });

  it('a linha de base de Senhor confere sem folga (V3B-T2.4, V4-JUNCAO2)', () => {
    // A faixa aceita 5% ou 10% de folga; isto, nenhuma. É o que prova que uma tarefa que não
    // era para mexer na economia (a fundação da v0.3: identidades, fluxos por entidade, o bot
    // explorador, as colunas reservadas) não mexeu em nenhum número medido. Quando uma mecânica
    // muda a economia de propósito, este teste falha junto com as faixas, e a linha de base é
    // atualizada como um golden (cabeçalho de `MEASURED`, em bands.ts).
    for (const cell of matrix.cells) {
      // Segunda junção: as treze cartas e a sabotagem integram a base nas três dificuldades.
      // Compare diretamente com MEASURED, sem o delta temporário da V4H-T3 nem folga extra
      // (docs/balance-v0.4.md, seção 19).
      const expected = baselineFor(cell.key);
      const { villagers, townHall, famineHours, coldHours, surplus, wasteStreakWorst } =
        cell.measure;
      expect(
        {
          villagers,
          townHall: townHall.min,
          famineHours: famineHours.max,
          coldHours: coldHours.max,
          surplus: { wood: surplus.wood.max, stone: surplus.stone.max, gold: surplus.gold.max },
          wasteStreak: wasteStreakWorst.max,
        },
        cell.key,
      ).toEqual(expected);
    }
  });

  it.each(['peasant', 'ironKing'] as const)(
    'em %s as partidas também ficam dentro das faixas da dificuldade',
    (difficulty) => {
      const result = others[difficulty];
      expect(result.difficulty).toBe(difficulty);
      expect(result.runs).toHaveLength(result.cells.length * OTHER_SEEDS.length);
      expect(result.cells.flatMap((cell) => cell.violations)).toEqual([]);
    },
  );

  it('a estrangeira entrega o primeiro herói a todo feudo, em todo perfil, ritmo e dificuldade, e ninguém parte por soldo (roadmap da v0.3, V3C-T3)', () => {
    // O critério 1 do GDD §16.2 visto pelo simulador (docs/balance-v0.3.md, seção 3). Os dois
    // bots respondem à carta com a primeira opção sem custo, "Acolher": toda partida termina com
    // um herói, Edda, que é Leal. Nenhum bot escolhe "Cuidar e deixar partir": o arqueiro, que
    // não é Leal, nunca passa pela matriz. Só o Explorador tem mais de um herói: os que ele
    // contrata na Taverna (V3C-T2), conferidos no teste seguinte.
    for (const difficulty of DIFFICULTY_IDS) {
      for (const run of byDifficulty[difficulty].runs) {
        const where = `${difficulty} ${run.window}/${run.timeScale}/${run.profile.id} ${run.seed}`;
        const { guild } = run.summary;
        // A estrangeira entrega sempre o primeiro herói. Desde as oito cartas do lote 2 (V4E-T1) o
        // "capitão veterano" pode entregar um segundo, de graça, a quem o acolhe: a regra certa é
        // "um herói da estrangeira, mais os contratados, mais no máximo um da carta nova".
        expect(guild.heroes, where).toBeGreaterThanOrEqual(1 + guild.hired);
        expect(guild.heroes, where).toBeLessThanOrEqual(2 + guild.hired);
        if (run.profile.id !== 'explorador') {
          expect(guild.hired, where).toBe(0);
        }
        expect(guild.departed, where).toBe(0);
        expect(guild.firstHeroAtHour, where).not.toBeNull();
      }
    }
    // A hora real em que ela chega, em Senhor, nas 50 sementes. A carta é do 13º dia de jogo
    // (8 h reais no Rápido, 24 h no Normal, 48 h no Tranquilo) e pede lugar na mesa; o herói
    // entra na visita seguinte. Quem passa uma vez por dia encontra a mesa cheia com as cartas
    // dos dias 5 e 9 na primeira visita, e só recebe a estrangeira na audiência seguinte: no
    // Rápido e no Normal o Preguiçoso tem o herói na hora 48, e não na 24.
    const firstHero = (key: string) => {
      const hours = matrix.runs
        .filter((run) => cellKey(run.window, run.timeScale, run.profile.id) === key)
        .map((run) => run.summary.guild.firstHeroAtHour ?? Infinity);
      return { min: Math.min(...hours), max: Math.max(...hours) };
    };
    expect(firstHero('week/3/dedicado')).toEqual({ min: 12, max: 12 });
    expect(firstHero('week/3/regular')).toEqual({ min: 24, max: 24 });
    expect(firstHero('week/3/preguicoso')).toEqual({ min: 48, max: 48 });
    expect(firstHero('week/1/dedicado')).toEqual({ min: 24, max: 24 });
    expect(firstHero('week/1/regular')).toEqual({ min: 24, max: 36 });
    expect(firstHero('week/1/preguicoso')).toEqual({ min: 48, max: 48 });
    for (const profile of PROFILES) {
      expect(firstHero(cellKey('week', 0.5, profile.id))).toEqual({ min: 48, max: 48 });
    }
    // O soldo em atraso. REGRESSÃO MEDIDA: o Preguiçoso do ritmo Normal soma 21 h reais com o
    // soldo em atraso, em toda semente (ele não põe ninguém na Mina a tempo). Edda é Leal: não
    // fica descontente nem parte, e o custo é o ouro parado em zero nesse tempo. Com um herói
    // que não fosse Leal, 21 h passam das 12 h reais do Descontente e ficam a 3 h das 24 h em
    // que o primeiro parte; isso é conta dos prazos, não medida: nenhum bot escolhe o arqueiro.
    // Nas outras células ninguém atrasa o soldo.
    const arrears = Object.fromEntries(
      matrix.cells.map((cell) => {
        const hours = matrix.runs
          .filter((run) => cellKey(run.window, run.timeScale, run.profile.id) === cell.key)
          .map((run) => run.summary.guild.arrearsHours);
        return [cell.key, [Math.min(...hours), Math.max(...hours)]];
      }),
    );
    // Na V4E-T2 (incursões-batalha; docs/balance-v0.4.md, seção 9) o Preguiçoso da semana do
    // Rápido passou a atrasar o soldo por 7,3 h em toda semente (as incursões do roteiro o
    // deixavam sem Mina; pendência D-39). Com as dos dias 25 e 37 leves e sem ferido (resposta
    // do autor, seção 10) ele volta a não atrasar.
    // Terceira junção (docs/balance-v0.4.md, seção 22): na semana do Rápido o Explorador atrasa o
    // soldo em duas das 50 sementes (025: 6,6 h; 027: 9,8 h) depois das despesas militares e das
    // Quedas nos Cercos de inverno, ainda bem abaixo das 24 h de partida de herói.
    expect(Object.entries(arrears).filter(([, [, max]]) => (max ?? 0) > 0)).toEqual([
      ['week/3/explorador', [0, 9.8]],
      ['week/1/preguicoso', [21, 21]],
      ['year/1/preguicoso', [21, 21]],
    ]);
  });

  it('a Taverna: todo perfil a ergue, só o Explorador contrata, e nenhum herói parte por soldo (roadmap da v0.3, V3C-T2)', () => {
    // docs/balance-v0.3.md, seção 4. A Taverna é uma obra como as outras: `obra mais barata` a
    // ergue nos três bots. Só o Explorador contrata (enquanto o ouro paga o preço e 24 h reais
    // de soldo da equipe) e dá festival (com folga de três vezes o custo).
    for (const difficulty of DIFFICULTY_IDS) {
      for (const run of byDifficulty[difficulty].runs) {
        const where = `${difficulty} ${run.window}/${run.timeScale}/${run.profile.id} ${run.seed}`;
        const { guild } = run.summary;
        // A premissa 3 do ADR 0017, medida: ninguém perde herói, nem o Preguiçoso, nem o
        // Explorador com a Taverna cheia. E nenhum bot dispensa.
        expect(guild.departed, where).toBe(0);
        expect(guild.dismissed, where).toBe(0);
        // Nunca mais heróis do que a Taverna abriga, fora quem volta do cativeiro: o resgatado
        // volta mesmo com a casa cheia (resposta do autor à D-17). Com a Mina Abandonada
        // (V4B-T1), que captura no veio fundo, o Explorador passou a ver a captura e o Resgate.
        expect(guild.heroes, where).toBeLessThanOrEqual(
          // A contratação para em 1 + nível da Taverna heróis no feudo, e os dois heróis de
          // carta (a estrangeira e o capitão veterano do lote 2, V4E-T1) não passam pela
          // Taverna: cada um pode chegar com a casa já cheia (lord year/0.5/explorador
          // pedra-alta-005 termina com 8 heróis e a Taverna Nv5).
          3 + guild.tavernLevel + run.summary.expeditions.fates.rescued,
        );
        if (run.profile.id === 'explorador') {
          // Quem contrata não atrasa o soldo, fora a semana do Rápido em Senhor (duas sementes com
          // até 9,8 h de atraso após as despesas militares e os Cercos, longe das 24 h de partida).
          if (difficulty === 'lord' && run.window === 'week' && run.timeScale === 3) {
            expect(guild.arrearsHours, where).toBeLessThanOrEqual(9.8);
          } else {
            expect(guild.arrearsHours, where).toBe(0);
          }
          // Na semana do Tranquilo (meio ano de jogo) o ouro é curto: desde os objetivos 11 a
          // 16 (V3F-T2) o bot ergue a Guilda e o Mercado que eles apontam, e em uma das 50
          // sementes de Senhor (pedra-alta-023) o cofre nunca paga um contrato com um dia de
          // soldo de folga. Nas outras janelas todo Explorador contrata.
          // V4E-T1: também no ano do Rápido (56 h reais) o Explorador pode terminar sem contratar
          // (Camponês, semente 001): a Muralha e a Torre acima do 2 gastam a folga do começo.
          const short = run.window === 'week' && run.timeScale === 0.5;
          const shortYear = run.window === 'year' && run.timeScale === 3;
          if (!short && !shortYear) {
            expect(guild.hired, where).toBeGreaterThan(0);
          }
        } else {
          expect(guild.festivals, where).toBe(0);
        }
      }
    }
    // Em Senhor, nas 50 sementes: quantos heróis o Explorador tem no fim. Onde a partida chega
    // à Taverna no nível 5 ele enche os seis lugares; no ano do Rápido (56 h reais) a Taverna
    // fica no nível 3 e ele termina com três, porque o cofre só paga dois contratos e um dia de
    // soldo; na semana do Tranquilo (meio ano de jogo) ele tem de três a cinco.
    const heroes = (key: string) =>
      matrix.cells.find((cell) => cell.key === key)?.measure.guild.heroes;
    // Desde a Mina Abandonada (V4B-T1), que captura no veio fundo, em uma semente o resgatado
    // volta com a casa cheia e o feudo termina com sete (o resgatado não respeita o limite).
    // Com a política mínima de guerra (V4C-T1.8) o caminho de obras muda, e nenhuma das 50
    // sementes termina com o resgatado acima do limite: seis em todas.
    // Com a Muralha, a Torre acima do 2 e as cartas do lote 2 (V4E-T1; docs/balance-v0.4.md,
    // seção 8) o capitão veterano entrega um sétimo herói em algumas sementes do Normal e do
    // Rápido: de seis a sete. Com as do roteiro dos dias 25 e 37 leves e sem ferido (D-39;
    // seção 10), em alguma semente chegam os dois de carta com a casa cheia: de seis a oito.
    // Segunda junção (docs/balance-v0.4.md, seção 19): o novo sorteio de cartas mantém a semana
    // do Rápido com seis a sete heróis (nenhuma semente acumula os dois de carta com a casa cheia).
    expect(heroes('week/3/explorador')).toEqual({ min: 6, max: 7 });
    // Desde V3D-T2 o Explorador leva a Guilda até o nível 4 (320, 512 e 819 de ouro): no Normal,
    // em alguma das 50 sementes, o cofre não paga o sexto contrato com um dia de soldo de folga
    // antes de o ano acabar, e ele termina com cinco.
    // Desde V3D-T3 a rota dele é a Floresta Antiga, que rende madeira, e não a Patrulha, que
    // rendia ouro (docs/balance-v0.3.md, seção 8.4: de 285 para 52 de ouro em saque por ano no
    // Normal): na pior das 50 sementes o cofre paga um contrato a menos.
    // Desde a revisão da Fase D (docs/balance-v0.3.md, seção 9.6) ele enche os seis lugares nas
    // 50 sementes do Normal: ergue a Guilda na frente das outras obras e, em metade das partidas,
    // volta quando a equipe para na encruzilhada (mais visitas, mais contratos). **Com a espera
    // de 12 h reais** (resposta do autor de 2026-10-06, D-71) a equipe espera o dobro na
    // encruzilhada, e em alguma das 50 sementes ele termina a semana com cinco (a causa exata
    // não foi investigada; o ritmo de envios e de saque mudou). Com o Mercado (V3E-T1) ele volta
    // a encher os seis lugares nas 50 sementes: o ouro das vendas paga o contrato que faltava.
    // Na revisão da Fase E (docs/balance-v0.3.md, seção 14) a caravana passou a pagar 15% sobre
    // o balcão, e não 40%, e o soldo passou a crescer com o nível: em alguma das 50 sementes o
    // ouro já não paga o sexto contrato na semana, e ele termina com cinco. Com a política
    // mínima de guerra (V4C-T1.8; o Explorador também perdeu o Ferreiro e a forja) ele volta a
    // encher os seis lugares nas 50 sementes (a causa exata não foi investigada).
    // V4E-T2 (incursões-batalha; docs/balance-v0.4.md, seção 9): na pior semente do Normal o
    // cofre paga dois contratos a menos: de quatro a sete.
    // Com a Fortaleza sem Ameaça até o Cerco (resposta do autor à D-43, 2026-10-27; docs/balance-v0.4.md, seção 13): de seis a sete.
    // Junção: os heróis de carta podem chegar acima do limite da Taverna; de seis a oito
    // (docs/balance-v0.4.md, seção 16), sem mudar a política de contratação.
    // Segunda junção (docs/balance-v0.4.md, seção 19): de seis a sete heróis com o sorteio das treze cartas.
    // Terceira junção (docs/balance-v0.4.md, seção 22): com o preparo do Cerco e o treino militar, de cinco a seis.
    expect(heroes('week/1/explorador')).toEqual({ min: 5, max: 6 });
    // Com os objetivos 11 a 16 (V3F-T2) o Explorador do Tranquilo ergue a Guilda e o Mercado
    // que eles apontam, e na pior das 50 sementes termina a semana só com a heroína da carta.
    // V4E-T2 (incursões-batalha; docs/balance-v0.4.md, seção 9): de dois a cinco.
    // D-39 (seção 10): de um a cinco.
    // Segunda junção (docs/balance-v0.4.md, seção 19): de um a quatro heróis com o novo sorteio de cartas.
    // Terceira junção (docs/balance-v0.4.md, seção 22): de um a cinco heróis.
    expect(heroes('week/0.5/explorador')).toEqual({ min: 1, max: 5 });
    // No ano do Rápido o cofre não paga o contrato em uma semente (V4E-T1): de um a três.
    // V4E-T2 (incursões-batalha; docs/balance-v0.4.md, seção 9): de dois a três.
    // D-39 (seção 10): de um a três. Junção da Fase E (objetivos 17 a 21 e Vigília): de dois a três.
    // Terceira junção (docs/balance-v0.4.md, seção 22): de um a três com os gastos do preparo do Cerco.
    expect(heroes('year/3/explorador')).toEqual({ min: 1, max: 3 });
    // No ano do Normal também, com a política mínima de guerra (V4C-T1.8): seis em todas.
    // V4E-T2 (incursões-batalha; docs/balance-v0.4.md, seção 9): de quatro a sete.
    // Junção da Fase E (seção 16.2: a Vigília e os objetivos 17 a 21): de seis a oito.
    // Segunda junção (docs/balance-v0.4.md, seção 19): de seis a sete com o novo sorteio de cartas.
    // Terceira junção (docs/balance-v0.4.md, seção 22): de cinco a seis com o preparo do Cerco.
    expect(heroes('year/1/explorador')).toEqual({ min: 5, max: 6 });
    // E no ano do Tranquilo, pelo mesmo resgatado acima do limite (V4B-T1); com a política
    // mínima de guerra (V4C-T1.8), seis em todas.
    // V4E-T2 (incursões-batalha; docs/balance-v0.4.md, seção 9): de seis a sete.
    expect(heroes('year/0.5/explorador')).toEqual({ min: 6, max: 7 });
    // A hora real em que a Taverna fica pronta, no perfil de 2 sessões por dia: logo depois do
    // Salão no nível 3. O Preguiçoso do primeiro ano do Rápido nem sempre chega a ela.
    const tavernAt = (key: string) =>
      matrix.cells.find((cell) => cell.key === key)?.measure.guild.tavernAtHour;
    // V4E-T2 (incursões-batalha; docs/balance-v0.4.md, seção 9): de 26 a 34.
    // D-39 (seção 10): de 25 a 27.
    expect(tavernAt('week/3/regular')).toEqual({ min: 25, max: 27 });
    // V4E-T1: de 51 a 63 (era até 59): a Muralha e a Torre entram na fila antes da Taverna.
    // Segunda junção (docs/balance-v0.4.md, seção 19): de 51 a 60 com o novo sorteio de cartas.
    expect(tavernAt('week/1/regular')).toEqual({ min: 51, max: 60 });
    // Com o Mercado (V3E-T1), que o Regular ergue assim que o Salão chega ao nível 3: na pior
    // das 50 sementes do Tranquilo a Taverna fica pronta na hora 105 (era até a 97); com os
    // objetivos 11 a 16 (V3F-T2), na hora 103.
    expect(tavernAt('week/0.5/regular')).toEqual({ min: 88, max: 103 });
    expect(tavernAt('week/3/explorador')).toEqual(tavernAt('week/3/regular'));
    // V4E-T2 (incursões-batalha; docs/balance-v0.4.md, seção 9): o Preguiçoso do ano do Rápido não erguia a Taverna em semente nenhuma (D-39).
    // Com as do roteiro dos dias 25 e 37 leves e sem ferido (seção 10) ele a ergue na hora 55
    // em parte das sementes.
    // V4G-T5.3: catálogo de 59 cartas e Cerco reunidos; marco medido nas 50 sementes (§21).
    expect(tavernAt('year/3/preguicoso')).toEqual({ min: 56, max: null });
    // O ouro parado continua sendo o sinal mais alto da matriz: contratar cinco heróis não o
    // gasta. Na semana do Rápido o Explorador termina com mais ouro parado do que o Regular.
    const gold = (key: string) =>
      matrix.cells.find((cell) => cell.key === key)?.measure.surplus.gold.max ?? 0;
    // V4E-T1: a Muralha cara em ouro absorve parte da sobra (docs/balance-v0.4.md, seção 8); o
    // piso cai de 150.000 para 90.000.
    // Terceira junção (docs/balance-v0.4.md, seção 22): o preparo do Cerco, o treino de soldados e
    // as três batalhas de inverno absorvem mais ouro (teto de 52.278 no Explorador e 35.962 no Regular).
    expect(gold('week/3/explorador')).toBeGreaterThan(50_000);
    expect(gold('week/3/regular')).toBeGreaterThan(30_000);
    expect(gold('week/3/explorador')).toBeGreaterThan(gold('week/3/regular'));
  });

  it('em toda dificuldade e em todo perfil: ninguém vai embora, e fome e frio ficam restritos ao Rápido após os Cercos (regressão medida na terceira junção)', () => {
    for (const difficulty of DIFFICULTY_IDS) {
      for (const cell of byDifficulty[difficulty].cells) {
        const where = `${difficulty} ${cell.key}`;
        // REGRESSÃO MEDIDA na terceira junção (docs/balance-v0.4.md, seção 22): em Senhor, no
        // ritmo Rápido, após as Quedas nos Cercos de inverno e o saque de comida e lenha, quatro
        // sementes de week/3/regular têm de 1 a 3 h de fome (007, 014, 015 e 035) e uma tem 1 h
        // de frio (003); em week/3/explorador uma tem 1 h de fome (030) e uma tem 1 h de frio
        // (009), também em year/3/explorador (009). Em nenhuma partida alguém vai embora.
        if (difficulty === 'lord' && cell.key === 'week/3/regular') {
          expect(cell.measure.famineHours, where).toEqual({ min: 0, max: 3 });
          expect(cell.measure.coldHours, where).toEqual({ min: 0, max: 1 });
        } else if (difficulty === 'lord' && cell.key === 'week/3/explorador') {
          expect(cell.measure.famineHours, where).toEqual({ min: 0, max: 1 });
          expect(cell.measure.coldHours, where).toEqual({ min: 0, max: 1 });
        } else if (difficulty === 'lord' && cell.key === 'year/3/explorador') {
          expect(cell.measure.famineHours, where).toEqual({ min: 0, max: 0 });
          expect(cell.measure.coldHours, where).toEqual({ min: 0, max: 1 });
        } else {
          expect(cell.measure.famineHours, where).toEqual({ min: 0, max: 0 });
          expect(cell.measure.coldHours, where).toEqual({ min: 0, max: 0 });
        }
        expect(cell.measure.villagersLost, where).toEqual({ min: 0, max: 0 });
        // A menor população é a das primeiras horas: o feudo de bot nenhum encolhe.
        expect(cell.measure.villagersMin.min, where).toBeGreaterThanOrEqual(5);
      }
    }
  });

  it('em cada dificuldade há caminho de compras até os desbloqueios da fase (V2C-T7.3)', () => {
    // O Celeiro e o Armazém (Salão no nível 2) e a segunda fila de obras (Salão no nível 4): o
    // perfil Regular chega a todos, em todo ritmo, dentro de um ano de jogo, só com ordens que o
    // motor aceita. O que o catálogo anuncia e nenhum caminho alcança está no teste do motor
    // (`storage.test.ts`, "alcançabilidade") e em docs/balance-v0.2.md, seção 9.5. A Torre de
    // Vigia e a Paliçada têm os testes delas, logo abaixo.
    //
    // Desde os objetivos da v0.2 (V2E-T4) o bot ergue o primeiro depósito porque o objetivo o
    // pede, e o segundo, quando o estoque aperta. Com a Ameaça reequilibrada (revisão das Fases
    // D e E) os lobos levam menos, e em Senhor, no ritmo Rápido, as 50 sementes têm o Armazém
    // na hora 37 (eram três sem ele no fim do ano; docs/balance-v0.2.md, seção 16).
    expect(MILESTONES.map(({ id }) => id)).toEqual([
      'townHall2',
      'townHall3',
      'townHall4',
      'granary',
      'warehouse',
      'watchtower',
      'palisade',
    ]);
    const phaseC = MILESTONES.filter(({ id }) => id !== 'watchtower' && id !== 'palisade');
    for (const difficulty of DIFFICULTY_IDS) {
      const regular = byDifficulty[difficulty].cells.filter(
        (cell) => cell.window === 'year' && cell.profile.id === 'regular',
      );
      expect(regular).toHaveLength(paces.length);
      for (const cell of regular) {
        for (const { id } of phaseC) {
          const hours = cell.measure.milestones[id];
          const where = `${difficulty} ${cell.key} ${id}`;
          expect(hours?.max, where).not.toBeNull();
          expect(hours?.max ?? Infinity, where).toBeLessThan(cell.realHours);
        }
        expect(cell.measure.commandsRefused, `${difficulty} ${cell.key}`).toEqual({
          min: 0,
          max: 0,
        });
      }
    }
    // Toda partida do perfil Regular tem ao menos um depósito no fim de um ano de jogo, e em
    // Senhor, no ritmo Rápido, as 50 sementes têm o Armazém na mesma hora.
    for (const run of matrix.runs.filter((entry) => entry.profile.id === 'regular')) {
      const { granary, warehouse } = run.summary.milestones;
      expect(granary ?? warehouse ?? null, `${run.window}/${run.timeScale}/${run.seed}`).not.toBe(
        null,
      );
    }
    const week = matrix.cells.find((cell) => cell.key === 'week/3/regular');
    expect(week?.measure.milestones.warehouse).toEqual({ min: 37, max: 37 });
    const year = matrix.cells.find((cell) => cell.key === 'year/3/regular');
    expect(year?.measure.milestones.warehouse).toEqual({ min: 37, max: 37 });
    expect(
      matrix.runs.filter(
        (run) =>
          run.window === 'year' &&
          run.timeScale === 3 &&
          run.profile.id === 'regular' &&
          run.summary.milestones.warehouse === null,
      ),
    ).toHaveLength(0);
  });

  it('os bots percorrem os objetivos das três versões que a equipe alcança (V2E-T4, V3F-T2, V4H-T3)', () => {
    // O bot segue o que cada objetivo ativo aponta na visão (`seguir os objetivos`). Até a v0.2
    // a lista tinha dez, e o último a cair era o do inverno, na virada para a primavera. Com os
    // seis da v0.3 (V3F-T2) a lista tem dezesseis, e ninguém que não envia expedição a fecha: o
    // Regular e o Dedicado cumprem os dez, o primeiro herói (a carta do 13º dia), a Guilda (que
    // `seguir os objetivos` ergue porque o objetivo a aponta) e, onde chegam ao Mercado, a venda.
    // Que os dez da v0.2 caem todos, com o do inverno por último, é o que `bots.test.ts` prova.
    for (const difficulty of DIFFICULTY_IDS) {
      const year = byDifficulty[difficulty].cells.filter((cell) => cell.window === 'year');
      for (const cell of year.filter((entry) => entry.profile.id !== 'preguicoso')) {
        const where = `${difficulty} ${cell.key}`;
        // Terceira junção (docs/balance-v0.4.md, seção 22): em Senhor, no ano do Rápido (56 h
        // reais), com o preparo do Cerco disputando a fila de obras, parte das sementes de
        // year/3/regular e year/3/explorador termina com 11 objetivos (sem erguer ou vender no
        // Mercado antes da hora 56).
        const minObjectives = difficulty === 'lord' && cell.timeScale === 3 ? 11 : 12;
        expect(cell.measure.objectivesDone.min, where).toBeGreaterThanOrEqual(minObjectives);
        if (cell.profile.id !== 'explorador') {
          expect(cell.measure.objectivesDone.max, where).toBeLessThanOrEqual(13);
          expect(cell.measure.objectivesAllDoneAtHour, where).toEqual({ min: null, max: null });
        }
      }
      // V4H-T3: o Explorador também cumpre os cinco da guerra e chega a 21, em vez de 16.
      // Medição conjunta: docs/balance-v0.4.md, seção 16.
      const tranquil = year.find((cell) => cell.key === 'year/0.5/explorador');
      expect(tranquil?.measure.objectivesDone.max, difficulty).toBe(21);
    }
    // Na semana do ritmo Tranquilo o inverno ainda não chegou: dos dez da v0.2 ficam nove, mais
    // os da v0.3 que já couberam na lista.
    const half = matrix.cells.filter((cell) => cell.window === 'week' && cell.timeScale === 0.5);
    for (const cell of half) {
      expect(cell.measure.objectivesDone.min, cell.key).toBeGreaterThanOrEqual(11);
      // O Explorador chega a quinze nas 50 sementes, em vez dos quatorze da régua antiga;
      // o inverno continua impossível nesta janela (balance-v0.4.md, seção 16).
      expect(cell.measure.objectivesDone.max, cell.key).toBeLessThanOrEqual(
        cell.profile.id === 'explorador' ? 15 : 14,
      );
    }
    // O Preguiçoso, com uma visita por dia, chega aos dez da v0.2 e ao primeiro herói em toda
    // janela de Senhor; no ano do Rápido não chega à Guilda.
    const lazy = (key: string) =>
      matrix.cells.find((cell) => cell.key === key)?.measure.objectivesDone;
    expect(lazy('year/0.5/preguicoso')).toEqual({ min: 12, max: 12 });
    expect(lazy('year/1/preguicoso')).toEqual({ min: 12, max: 12 });
    // Na V4E-T2 (incursões-batalha; docs/balance-v0.4.md, seção 9) caíram para quatro (eram
    // onze; pendência D-39). Com as do roteiro dos dias 25 e 37 leves e sem ferido (resposta do
    // autor, seção 10), de nove a onze.
    expect(lazy('year/3/preguicoso')).toEqual({ min: 9, max: 11 });
    expect(lazy('week/3/preguicoso')).toEqual({ min: 12, max: 12 });
  });

  it('a Torre de Vigia chega cedo para quem segue os objetivos (V2E-T1, V2E-T4)', () => {
    // Até os objetivos da v0.2 o bot só erguia a Torre com o dobro do custo em estoque, e ela
    // chegava tarde: no ritmo Normal, entre as horas 61 e 109; no Tranquilo, entre a 97 e a
    // 157; no Rápido, na hora 37. Com o objetivo "Construa a Torre de Vigia" na lista, o bot a
    // deixa planejada antes de o Salão a liberar, e ela começa sozinha: em Senhor, com 2
    // sessões por dia, fica pronta entre as horas 32 e 43 no Normal, 55 e 61 no Tranquilo e na
    // hora 20 no Rápido (docs/balance-v0.2.md, seção 15). O nível 2 continua sendo o da folga.
    // Com os dois números do ADR 0016 (seção 18): entre as horas 32 e 42 no Normal e 55 e 57 no
    // Tranquilo. Com a pedra do poço a 20 (V2G-T4, seção 20): a partir da hora 33 no Normal e
    // da 53 no Tranquilo.
    const tower = (key: string) =>
      matrix.cells.find((cell) => cell.key === key)?.measure.milestones.watchtower;
    expect(tower('year/1/regular')).toEqual({ min: 33, max: 42 });
    expect(tower('year/0.5/regular')).toEqual({ min: 53, max: 57 });
    expect(tower('year/3/regular')).toEqual({ min: 20, max: 20 });
    expect(tower('week/3/regular')).toEqual({ min: 20, max: 20 });
    // O Preguiçoso, com uma visita por dia, agora chega lá dentro da semana em todo ritmo e em
    // toda semente. No Normal a demora é do ouro: a Torre custa 50, e o Preguiçoso não mexe em
    // quem já trabalha para pôr gente na Mina. Com os lobos levando menos (seção 16), a hora é
    // a mesma em toda semente.
    //
    // Os 50 de ouro do objetivo 4 (ADR 0016, item 7) mexem nisso para os dois lados (seção 18).
    // No Normal a Torre chega quatro horas antes (era na hora 82). No Tranquilo chega 27 horas
    // DEPOIS (era na hora 110). Na semente 001, hora a hora: o ouro cai na conclusão do Salão
    // no nível 2 e vai logo para a melhoria da Fazenda, que sem ele não tinha como começar; a
    // da Mina de Ouro, que sem ele saía na visita seguinte (hora 73), só sai um dia depois, e
    // da hora 100 à 137 o feudo rende um terço do ouro por hora (2,9 contra 9,5). É a ordem de
    // compras deste bot, que as políticas não deixam mexer aqui; fica medido para não passar
    // calado.
    //
    // Com a estrangeira e o primeiro soldo (V3C-T3; docs/balance-v0.3.md, seção 3) o Tranquilo
    // volta atrás e passa: a Torre sai na hora 80. O soldo deixa o saldo do ouro negativo, o
    // Preguiçoso manda os aldeões sem ofício para a Mina, que é onde falta, e o ouro que
    // segurava a Torre aparece. É efeito da política do bot, não de regra nova.
    // Na V4E-T2 (incursões-batalha; docs/balance-v0.4.md, seção 9) a Torre do Preguiçoso do
    // Rápido passou a sair entre as horas 74 e 85 (era 50 e 51), e no Normal na 80 (era 78;
    // pendência D-39). Com a resposta do autor (seção 10): de 50 a 57 no Rápido e 78 no Normal.
    // V4G-T5.3: o Preguiçoso conserva a economia; o catálogo atual desloca uma chegada (§21).
    expect(tower('week/3/preguicoso')).toEqual({ min: 50, max: 58 });
    expect(tower('week/1/preguicoso')).toEqual({ min: 78, max: 78 });
    expect(tower('week/0.5/preguicoso')).toEqual({ min: 80, max: 80 });
    // A Ameaça não satura: com +2 por dia, −35 por incursão e as médias a partir de 70, ela
    // oscila, e nenhuma partida de um ano de jogo ou mais termina perto do máximo. Até a revisão
    // das Fases D e E (+5 e −10) ela chegava a 100 em toda partida e ficava entre 90 e 100
    // (docs/balance-v0.2.md, seções 14 e 16).
    const gameYears = (run: MatrixRun) => (run.realHours * run.timeScale) / YEAR_GAME_HOURS;
    const fullYears = matrix.runs.filter((run) => gameYears(run) >= 1);
    expect(fullYears.length).toBeGreaterThan(0);
    const finals = fullYears.map((run) => run.summary.threat.final);
    // REGRESSÃO MEDIDA em V3D-T3 (docs/balance-v0.3.md, seção 8.6; pendência D-24): **uma** das
    // partidas de um ano termina em 90. É o Explorador de Senhor no Tranquilo, semente 047: ele
    // limpa o Covil no verão (a Ameaça cai a 16), o outono soma 3 por dia sem que nenhum dos 16
    // sorteios de incursão saia (a chance vai de 3% a 48%), e a Ameaça chega ao inverno em 88,
    // onde fica até os lobos voltarem ao Covil na virada do ano. Com o Covil limpo, só uma
    // incursão no outono faz a Ameaça cair: é a regra que a D-24 pede ao autor para rever, e
    // não o catálogo. Não é saturação (ninguém chega a 100, e na primavera ela volta a cair),
    // mas é o caso em que limpar o Covil deixa o feudo com a Ameaça mais alta do que não limpar.
    // Na revisão da Fase D (docs/balance-v0.3.md, seção 9.6) a mesma partida passou a terminar
    // em **92** (eram 90), com o bot e o catálogo da revisão; por que dois pontos a mais não
    // foi investigado. Continua sendo uma só, a mesma semente, com o Covil limpo no ano.
    // V4E-T1 (Muralha, Torre Nv3+ e cartas do lote 2): duas partidas terminam em 80 ou mais (era uma).
    // REGRESSÃO MEDIDA na V4E-T3 (Acampamento e Fortaleza, +2 cada): 330 das 1.000 partidas de
    // um ano ou mais terminavam em 80 ou mais, e a máxima era 100.
    // Com a Fortaleza sem Ameaça até o Cerco (resposta do autor à D-43, 2026-10-27; docs/balance-v0.4.md, seção 13): 76 das 1.000 em 80 ou mais (31 em 90 ou mais, uma em 100). O que sobra é do
    // Acampamento, que soma +2 do 25º dia até a virada do ano (o Covil e ele, +4 por dia no
    // inverno): fica à espera do autor (pendência D-43).
    // Junção: 114 dos mesmos 1.000 registros terminam em ≥80 (48 em ≥90); a Vigília muda
    // os instantes e os sorteios após o ensaio. Guarde os valores exatos, sem aumentar uma
    // tolerância; a comparação com as seções 9/10 está em balance-v0.4.md, seção 16.
    // Segunda junção (docs/balance-v0.4.md, seção 19): 135 dos 1.000 registros terminam em ≥80
    // com as treze cartas adicionais do lote 2 e o sorteio novo.
    expect(Math.max(...finals)).toBe(100);
    expect(finals.filter((value) => value >= 80).length).toBe(135);
    expect(Math.min(...finals)).toBeLessThan(balance.threat.raidChanceAbove);
  });

  it('a Paliçada sai logo depois da Torre: o bot a ergue quando a Ameaça conhecida passa do limiar ou o objetivo a pede (V2E-T3, V2E-T4)', () => {
    // A Paliçada pede o Salão no nível 3. Antes dos objetivos da v0.2 o bot só a erguia com a
    // Torre mostrando o risco, e ela ficava pronta entre as horas 73 e 121 no ritmo Normal, na
    // 49 ou 50 no Rápido e entre a 109 e a 169 no Tranquilo. Com a Torre cedo e o objetivo
    // "Construa a Paliçada", em Senhor, com 2 sessões por dia: entre as horas 48 e 55 no
    // Normal, na 25 no Rápido e entre a 83 e a 86 no Tranquilo (seção 16). Com os dois números
    // do ADR 0016 (seção 18): entre as horas 49 e 53 no Normal e entre a 82 e a 85 no Tranquilo.
    // Com a pedra do poço a 20 (V2G-T4, seção 20): até a hora 86 no Tranquilo. Com a estrangeira
    // no sorteio (V3C-T3): a partir da hora 83 no Tranquilo. Com a Taverna na lista de obras
    // (V3C-T2): até a hora 56 no Normal e até a 26 no Rápido. Com o Mercado erguido assim que o
    // Salão chega ao nível 3 (V3E-T1), na frente da Paliçada em algumas sementes: até a hora 59
    // no Normal.
    const palisade = (key: string) =>
      matrix.cells.find((cell) => cell.key === key)?.measure.milestones.palisade;
    // Com a Muralha, a Torre acima do 2 e as oito cartas do lote 2 (V4E-T1; docs/balance-v0.4.md,
    // seção 8): no Normal entre as horas 49 e 55.
    // V4E-T2 (incursões-batalha; docs/balance-v0.4.md, seção 9): no Normal entre 49 e 54, no Rápido entre 26 e 27.
    expect(palisade('year/1/regular')).toEqual({ min: 49, max: 54 });
    expect(palisade('year/3/regular')).toEqual({ min: 26, max: 27 });
    expect(palisade('year/0.5/regular')).toEqual({ min: 83, max: 86 });
    for (const cell of matrix.cells.filter((entry) => entry.profile.id !== 'preguicoso')) {
      const tower = cell.measure.milestones.watchtower;
      const wall = cell.measure.milestones.palisade;
      if (tower?.min != null && wall?.min != null) {
        expect(wall.min, cell.key).toBeGreaterThan(tower.min);
      }
    }
    // Em toda partida os lobos atacam (a incursão do roteiro, no mínimo), e em nenhuma o feudo
    // perde gente por isso: o teste de cima já cobra fome, frio e partidas em zero.
    for (const run of matrix.runs) {
      const { raids } = run.summary;
      const where = `${run.window}/${run.timeScale}/${run.profile.id}/${run.seed}`;
      expect(raids.suffered + raids.repelled, where).toBeGreaterThan(0);
      // Quem tem a Paliçada no nível 2 repele; quem não tem, sofre: nunca os dois ao contrário.
      if (raids.palisade === 0) {
        expect(raids.repelled, where).toBe(0);
      }
    }
    // O perfil Regular no ritmo Normal, em um ano: a incursão do roteiro sofrida e de 4 a 5
    // repelidas, com a Ameaça no fim entre 19 e 70. Antes da Ameaça reequilibrada (seção 16)
    // eram de 3 a 5 sofridas e de 9 a 13 repelidas, com a Ameaça entre 90 e 100.
    const year = matrix.cells.find((cell) => cell.key === 'year/1/regular')?.measure.raids;
    // V4E-T2 (incursões-batalha; docs/balance-v0.4.md, seção 9): três sofridas (a dos lobos e as duas primeiras do roteiro da guerra, antes da
    // Paliçada e dos soldados), três ou quatro repelidas, a Ameaça no fim entre 28 e 63.
    // D-39 (seção 10): duas sofridas, de quatro a cinco repelidas.
    // Com a Fortaleza sem Ameaça até o Cerco (resposta do autor à D-43, 2026-10-27; docs/balance-v0.4.md, seção 13): de cinco a oito repelidas, e a Ameaça no fim entre 22 e 99 (com os dois tiles da
    // V4E-T3 ela ia de 49 a 100; antes deles, de 28 a 63).
    expect(year?.suffered).toEqual({ min: 2, max: 2 });
    // Segunda junção (docs/balance-v0.4.md, seção 19): de seis a oito repelidas nas 50 sementes.
    // Terceira junção (docs/balance-v0.4.md, seção 22): de cinco a oito repelidas e Ameaça final entre 29 e 93.
    expect(year?.repelled).toEqual({ min: 5, max: 8 });
    // Junção: a Vigília desloca a descarga da Ameaça e os sorteios; intervalo medido das
    // mesmas 50 sementes (docs/balance-v0.4.md, seção 16).
    // Segunda junção (docs/balance-v0.4.md, seção 19): intervalo medido de 22 a 100.
    expect(year?.threatFinal).toEqual({ min: 29, max: 93 });
  });

  it('nenhum bot dá ordens que o motor recusa, em nenhum ritmo e em nenhuma dificuldade', () => {
    for (const run of [...matrix.runs, ...others.peasant.runs, ...others.ironKing.runs]) {
      expect(run.summary.refusedByCode, `${run.window}/${run.timeScale}/${run.profile.id}`).toEqual(
        {},
      );
    }
    expect(matrix.runs.every((run) => run.summary.commandsAccepted > 5)).toBe(true);
  });

  it('com 2 sessões por dia não há fome no Normal nem no Tranquilo (na semana do Rápido há até 3 h após os Cercos)', () => {
    const regular = matrix.cells.filter((cell) => cell.profile.id === 'regular');
    expect(regular).toHaveLength(WINDOWS.length * paces.length);
    for (const cell of regular) {
      if (cell.key === 'week/3/regular') {
        expect(cell.measure.famineHours, cell.key).toEqual({ min: 0, max: 3 });
        expect(cell.band?.famineHoursMax, cell.key).toBe(4);
      } else {
        expect(cell.measure.famineHours, cell.key).toEqual({ min: 0, max: 0 });
        expect(cell.band?.famineHoursMax, cell.key).toBe(0);
      }
    }
  });

  it('no ritmo 1 o perfil Regular passa do que a v0.1 cobrava: de 64 a 75 aldeões no dia 7, acima dos 40 da meta', () => {
    // A v0.1 cobrava 20 a 40 aldeões e o Salão no nível 3 (GDD §15.2: "população 30–40 no dia 7").
    // Com a segunda fila e as planejadas automáticas (V2C-T5) as obras não esperam mais a visita,
    // e o mesmo perfil chegou a 45 aldeões e ao Salão no nível 6. Com a experiência do ofício
    // (V2C-T3) e o bot plantando para crescer (um lavrador a mais enquanto há vaga), chegou a 68
    // e ao Salão no nível 7; com a moral (V2C-T4), a 66. Na rodada da Fase C (V2C-T7) o bot
    // deixou de produzir para o chão, e os braços que sobram rendem em outro ofício: 69. Com o
    // primeiro lote de cartas (V2D-T2) cada semente conta outra história, e o mesmo perfil
    // termina entre 64 e 72; com a Torre de Vigia (V2E-T1), entre 65 e 72. Com as incursões de
    // lobos (V2E-T3), entre 60 e 71, e em parte das sementes o Salão fica no nível 6: o que os
    // lobos levam e a Paliçada custam uma obra ou duas. Nenhum número do conteúdo foi mexido
    // por causa disso: o teto da meta é decisão do autor (docs/balance-v0.2.md, seções 9.8, 11,
    // 12 e 14), e este teste guarda o que foi medido para o desvio não passar despercebido.
    // Com os objetivos da v0.2 (V2E-T4) a população continua entre 60 e 71, e o Salão volta ao
    // nível 7 em toda semente: a defesa chega cedo, e os lobos levam menos (seção 15). Com a
    // Ameaça reequilibrada, entre 63 e 71 (seção 16). Com as cartas corrigidas (os pilares de
    // pedra da Ponte e a Paliçada mostrada aos aldeões por +20, seção 17), entre 63 e 73: os
    // dias em 80 trazem colonos. Com os dois números do ADR 0016 (seção 18), entre 64 e 73.
    // Com a Taverna (V3C-T2; docs/balance-v0.3.md, seção 4), entre 64 e 75: a moral que ela
    // soma mantém o feudo acima dos 80, e os colonos vêm. Com os objetivos 11 a 16 (V3F-T2;
    // docs/balance-v0.3.md, seção 15), entre 65 e 75. Com a política mínima de guerra (V4C-T1.8;
    // docs/balance-v0.4.md, seção 5.1) o soldado sai da população (ADR 0019, decisão 7) e o bot
    // treina até um quarto dos aldeões: entre 56 e 69 aldeões, mais os soldados.
    const band = bandFor(cellKey('week', 1, 'regular'));
    // Com a Muralha, a Torre acima do 2 e as cartas do lote 2 (V4E-T1; docs/balance-v0.4.md,
    // seção 8): de 46 a 68 aldeões na medida, faixa de 41 a 75, e o Salão no nível 6.
    // V4E-T2 (incursões-batalha; docs/balance-v0.4.md, seção 9): de 57 a 71 na medida, faixa de 51 a 79, e o Salão no nível 7.
    // D-39 (seção 10): de 54 a 70 na medida, faixa de 48 a 77, e o Salão no nível 6.
    // Com a Fortaleza sem Ameaça até o Cerco (resposta do autor à D-43, 2026-10-27; docs/balance-v0.4.md, seção 13): de 54 a 68 na medida, faixa de 48 a 75.
    // Segunda junção (docs/balance-v0.4.md, seção 19): de 56 a 68 na medida, faixa de 50 a 75.
    // Terceira junção (docs/balance-v0.4.md, seção 22): com o preparo do Cerco (recrutamento
    // militar mais forte na transição outono/inverno) e a Queda do Cerco no fim do ano 1 em 45 das
    // 50 sementes (que reduz o Salão e a população), a medida vai de 22 a 37 aldeões (faixa de 19
    // a 41) e o Salão fica no mínimo no nível 4.
    expect(band?.villagers).toEqual({ min: 19, max: 41 });
    expect(band?.townHallMin).toBe(4);
    expect(band?.famineHoursMax).toBe(0);
  });

  it('a meta de desperdício (ADR 0013, decisão 17) é cumprida no ritmo Tranquilo; no Normal e no Rápido, não (regressão medida com a Taverna)', () => {
    // GDD §15.2 (ritmo Normal, dificuldade Senhor): com 2 sessões por dia, nenhum recurso passa
    // de 8 h de jogo seguidas indo ao chão. Até a rodada da Fase C só uma das seis células do
    // Regular a cumpria; o que faltava era o bot parar de produzir para o depósito cheio
    // (docs/balance-v0.2.md, seção 9.3), e nenhum número do conteúdo mudou. No ritmo Rápido as 8
    // h de jogo são 2 h 40 reais, e quem volta a cada 12 h não as cumpre. Este teste guarda as
    // duas coisas: o que entrou não pode sair calado, e o que ficou fora não pode piorar calado.
    //
    // Com o primeiro lote de cartas (V2D-T2) cada semente segue um caminho de obras diferente.
    // No ritmo Normal, 49 das 50 sementes continuavam dentro da meta; em uma o Armazém saía
    // tarde e, no outono, o bot mandava os lenhadores juntarem a lenha do inverno com o
    // depósito cheio: 10 h de jogo seguidas de madeira indo ao chão. Com a Torre de Vigia
    // (V2E-T1) o caminho de obras mudou de novo: são três as sementes (017, 034 e 046), com 9 a
    // 10 h de madeira, todas com o Armazém pronto só da hora 61 em diante. Com as três cartas
    // da Paliçada no sorteio (V2E-T2) o caminho mudou outra vez: são cinco (016, 017, 029, 033
    // e 047), ainda com 9 a 10 h de madeira. Com as incursões de lobos e a Paliçada que o bot
    // passou a erguer (V2E-T3), são quatro (007, 027, 037 e 046), com 9 h, e o teto da célula
    // caiu para 9 h; no ritmo Rápido o pior caso da semana subiu de 27 para 33 h, e o do ano
    // caiu de 24 para 18. Não é uma carta, a Torre nem a Paliçada que desperdiça; é o caminho
    // do bot (docs/balance-v0.2.md, seções 11 a 14).
    //
    // Com os objetivos da v0.2 (V2E-T4) o primeiro depósito sai cedo, porque o objetivo o pede,
    // e no ritmo Normal as 50 sementes ficam dentro da meta: o pior caso é de 8 h de madeira.
    // No Rápido a semana continua em 33 h, e o ano caiu de 18 para 15 (seção 15); com a Ameaça
    // reequilibrada, para 9 (seção 16).
    //
    // REGRESSÃO MEDIDA, com os dois números do ADR 0016 (seção 18): no ritmo Normal uma das 50
    // sementes (026) volta a passar da meta, com 9 h de jogo seguidas de madeira indo ao chão.
    // É o mesmo caso de antes dos objetivos da v0.2: nela o Armazém só fica pronto na hora 73.
    // Rodando cada número sozinho, a capacidade de 1.000 baixa o pior caso da célula para 6 h, e
    // os 50 de ouro do objetivo 4 o levam a 10 h; juntos, 9 h. Nenhum número além dos dois foi
    // mexido e o bot não foi tocado: fica à espera do autor.
    //
    // Com as cartas corrigidas (V2G-T4, seção 20) a célula continua com uma semente em 50 acima
    // da meta, pelas mesmas 9 h, mas é outra: na 026 o Armazém passa a ficar pronto na hora 49
    // e o pior caso dela cai para 1 h; na 018, que tinha 8 h, ele sai na hora 74 (era 73) e a
    // madeira vai ao chão por 9 h. O que mudou para o bot foi a pedra do poço, de 30 para 20.
    //
    // Com a estrangeira no lugar do sorteio de uma audiência (V3C-T3; docs/balance-v0.3.md,
    // seção 3) o caminho de obras de cada semente mudou outra vez, e no ritmo Normal as 50
    // voltam a caber na meta: o pior caso é de 8 h. No ano do Rápido o pior caso cai de 9 para
    // 6 h, e a célula também passa. Só a semana do Rápido continua acima, nas mesmas 33 h.
    //
    // REGRESSÃO MEDIDA com a Taverna (V3C-T2; docs/balance-v0.3.md, seção 4): três células
    // voltam a passar da meta. No ritmo Normal uma das 50 sementes (021) tem 10 h de jogo
    // seguidas de madeira indo ao chão; no ano do Rápido, duas (012 e 018) têm 9 h; e a semana
    // do Rápido sobe de 33 para 36 h. A Taverna soma até 25 de moral, a moral acima de 80 traz
    // colonos e a produção cresce antes de os depósitos crescerem; e as cinco obras dela entram
    // na fila na frente das do Armazém quando são as mais baratas. Nenhum número além dos da
    // Taverna foi mexido e os bots Regular e Dedicado não foram tocados: fica à espera do autor.
    expect(WASTE_STREAK_GOAL).toEqual({ sessionsPerDay: 2, gameHours: 8 });
    const goal = wasteGoalCells(matrix.cells);
    expect(goal).toHaveLength(WINDOWS.length * paces.length);
    expect(goal.every(({ cell }) => cell.profile.id === 'regular')).toBe(true);
    const over = Object.fromEntries(
      goal.filter(({ met }) => !met).map(({ cell, gameHours }) => [cell.key, gameHours]),
    );
    // Com o Mercado (V3E-T1; docs/balance-v0.3.md, seção 11) o Regular vende o que iria ao chão:
    // a semana do Rápido volta de 36 para 33 h. As outras três células ficam onde estavam.
    // Com os objetivos 11 a 16 (V3F-T2; docs/balance-v0.3.md, seção 15) o objetivo 14 manda
    // vender o que iria ao chão, e as recompensas mudam o caminho de obras: a semana do Rápido
    // cai para 30 h, e o ano do Rápido volta a caber na meta (pior caso de 6 h).
    // REGRESSÃO MEDIDA com a política mínima de guerra (V4C-T1.8; docs/balance-v0.4.md, seção
    // 5.1): a semana e o ano do Normal passam de 10 para 11 h. O autor aceitou em 2026-10-22,
    // para rever quando as formações (V4C-T2) mudarem o que o bot faz.
    // Com a Muralha, a Torre acima do 2 e as cartas do lote 2 (V4E-T1; docs/balance-v0.4.md,
    // seção 8) o Normal volta a caber na meta (pior caso de 6 h: a fila de obras novas segura a
    // madeira e a pedra), e a semana do Rápido passa de 30 para 36 h.
    // REGRESSÃO MEDIDA na V4E-T2 (incursões-batalha; docs/balance-v0.4.md, seção 9): o Normal volta a passar da meta (10 h, na semana e no ano) e o
    // ano do Rápido também (15 h); a semana do Rápido cai de 36 para 33 h. Só o Tranquilo cabe.
    // D-39 (as do roteiro dos dias 25 e 37 leves e sem ferido; seção 10): o ano do Rápido volta
    // a caber na meta, e o Normal fica em 9 h.
    // Com a Fortaleza sem Ameaça até o Cerco (resposta do autor à D-43, 2026-10-27; docs/balance-v0.4.md, seção 13): o Normal volta a caber na meta (pior caso de 7 h); só a semana do Rápido passa.
    // REGRESSÃO MEDIDA na terceira junção (docs/balance-v0.4.md, seção 22): com o preparo do Cerco
    // (V4G-T5.3) priorizando obras militares, ferreiro e treino, e com as Quedas do Cerco de
    // inverno derrubando níveis de construções, o Normal passa para 22 h de jogo (43 das 50
    // sementes acima de 8 h) e a semana do Rápido sobe de 33 para 81 h. O ano do Rápido e o
    // Tranquilo continuam dentro da meta.
    expect(over).toEqual({
      'week/3/regular': 81,
      'week/1/regular': 22,
      'year/1/regular': 22,
    });
    expect(goal.filter(({ met }) => met).map(({ cell }) => cell.key)).toEqual([
      'week/0.5/regular',
      'year/3/regular',
      'year/0.5/regular',
    ]);
    const beyond = matrix.runs.filter(
      (run) =>
        run.window === 'week' &&
        run.timeScale === 1 &&
        run.profile.id === 'regular' &&
        Math.max(...Object.values(run.summary.wasteStreakGameHours)) > WASTE_STREAK_GOAL.gameHours,
    );
    expect(beyond.map((run) => run.seed)).toEqual([
      'pedra-alta-001',
      'pedra-alta-002',
      'pedra-alta-003',
      'pedra-alta-004',
      'pedra-alta-005',
      'pedra-alta-006',
      'pedra-alta-007',
      'pedra-alta-008',
      'pedra-alta-009',
      'pedra-alta-010',
      'pedra-alta-011',
      'pedra-alta-012',
      'pedra-alta-014',
      'pedra-alta-015',
      'pedra-alta-016',
      'pedra-alta-017',
      'pedra-alta-018',
      'pedra-alta-019',
      'pedra-alta-020',
      'pedra-alta-021',
      'pedra-alta-023',
      'pedra-alta-024',
      'pedra-alta-025',
      'pedra-alta-027',
      'pedra-alta-028',
      'pedra-alta-029',
      'pedra-alta-030',
      'pedra-alta-031',
      'pedra-alta-032',
      'pedra-alta-034',
      'pedra-alta-035',
      'pedra-alta-036',
      'pedra-alta-037',
      'pedra-alta-039',
      'pedra-alta-040',
      'pedra-alta-042',
      'pedra-alta-043',
      'pedra-alta-044',
      'pedra-alta-046',
      'pedra-alta-047',
      'pedra-alta-048',
      'pedra-alta-049',
      'pedra-alta-050',
    ]);
    // Nas outras dificuldades, com as 3 sementes que a suíte joga: dentro no Tranquilo e no ano
    // do Rápido, acima na semana do Rápido e no Normal.
    const overIn = (difficulty: 'peasant' | 'ironKing') =>
      wasteGoalCells(others[difficulty].cells)
        .filter(({ met }) => !met)
        .map(({ cell }) => cell.key);
    expect(overIn('peasant')).toEqual(['week/3/regular', 'week/1/regular', 'year/1/regular']);
    expect(overIn('ironKing')).toEqual(['week/3/regular', 'week/1/regular', 'year/1/regular']);
  });

  it('o excedente parado de madeira caiu em relação à v0.1, em todo ritmo', () => {
    // A linha de base da v0.1, antes de qualquer mecânica (docs/balance-v0.2.md, seção 2): o
    // perfil Regular terminava 7 dias reais com 40.872 de madeira parada no ritmo 3, 10.017 no
    // ritmo 1 e 1.609 no 0,5. Com os limites de estoque ela não passa do que o Armazém guarda;
    // com o início automático ela vira obra; e com o bot sem produzir para o chão, o que
    // sobraria vira ouro. Contando também o que foi ao chão, a madeira sem uso continua menor
    // na partida típica (a mediana das sementes): com as cartas do Conselho cada semente tem o
    // seu caminho, e uma em 50 desperdiça mais do que isso (seção 11).
    const before: Record<number, number> = { 3: 40_872, 1: 10_017, 0.5: 1_609 };
    for (const timeScale of paces) {
      const cell = matrix.cells.find(
        (entry) => entry.key === cellKey('week', timeScale, 'regular'),
      );
      // No ritmo Tranquilo a semana é meio ano de jogo: o Armazém ainda está enchendo, e o
      // limite dele (2.700 no nível 4) já passa do que a v0.1 juntava sem limite nenhum.
      const parked = cell?.measure.surplus.wood.max ?? Infinity;
      if (timeScale >= 1) {
        expect(parked, `ritmo ${timeScale}`).toBeLessThan(before[timeScale] ?? 0);
      }
      const unused = matrix.runs
        .filter(
          (run) =>
            run.window === 'week' && run.timeScale === timeScale && run.profile.id === 'regular',
        )
        .map((run) => run.summary.surplus.wood + run.summary.wasted.wood)
        .sort((a, b) => a - b);
      const median = unused[Math.floor(unused.length / 2)] ?? Infinity;
      expect(median, `ritmo ${timeScale}`).toBeLessThan(before[timeScale] ?? 0);
    }
  });

  it('a sequência desperdiçando tem limite em toda célula: o medido com 5% de folga', () => {
    for (const cell of matrix.cells) {
      const limit = cell.band?.wasteStreakMax ?? -1;
      const worst = cell.measure.wasteStreakWorst.max;
      expect(limit, cell.key).toBeGreaterThanOrEqual(worst);
      expect(limit, cell.key).toBeLessThanOrEqual(Math.ceil(worst * 1.05));
    }
  });

  it('todo ritmo tem limite de excedente parado para cada material, e o limite é o medido com 5% de folga', () => {
    for (const cell of matrix.cells) {
      for (const [resource, range] of Object.entries(cell.measure.surplus)) {
        const limit = cell.band?.surplusMax[resource as keyof typeof cell.measure.surplus] ?? 0;
        expect(limit, `${cell.key} ${resource}`).toBeGreaterThanOrEqual(range.max);
        expect(limit, `${cell.key} ${resource}`).toBeLessThanOrEqual(Math.ceil(range.max * 1.05));
      }
    }
  });

  it('com 1 sessão por dia do bot econômico, nenhuma fome nas primeiras 24 h, em nenhum ritmo', async () => {
    for (const timeScale of paces) {
      const lazy = await simulate({
        seed: 'pedra-alta-golden',
        days: 7,
        strategy: 'economico',
        sessionsPerDay: 1,
        timeScale,
      });
      expect(lazy.rows.slice(0, 24).some((row) => row.famine)).toBe(false);
      const firstFamine = lazy.events.find((event) => event.type === 'famineStarted');
      // O instante do evento é de jogo: 24 h reais são 24 × ritmo horas de jogo.
      expect(
        firstFamine === undefined || firstFamine.atMs > 24 * 3_600_000 * timeScale,
        `ritmo ${timeScale}`,
      ).toBe(true);
    }
  });
});

describe('as duas janelas da matriz', () => {
  const cell = (window: 'week' | 'year', timeScale: number) => {
    const found = matrix.cells.find((entry) => entry.key === cellKey(window, timeScale, 'regular'));
    if (found === undefined) {
      throw new Error(`Célula ausente: ${window}/${timeScale}/regular.`);
    }
    return found;
  };

  it('não se misturam: no ritmo 1 são a mesma partida, nos outros medem durações diferentes', () => {
    expect(cell('year', 1).measure).toEqual(cell('week', 1).measure);
    expect(cell('week', 3)).toMatchObject({ realHours: 168, gameYears: 3 });
    expect(cell('year', 3)).toMatchObject({ realHours: 56, gameYears: 1 });
    expect(cell('week', 0.5)).toMatchObject({ realHours: 168, gameYears: 0.5 });
    expect(cell('year', 0.5)).toMatchObject({ realHours: 336, gameYears: 1 });
    expect(cell('year', 3).measure).not.toEqual(cell('week', 3).measure);
  });
});
