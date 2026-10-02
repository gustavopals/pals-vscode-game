import { balance, type DifficultyId } from '@lotg/content';

import type { ProfileId, Range, WindowId } from './matrix';
import { refusedByCode, type Summary, SURPLUS_RESOURCES, type SurplusResource } from './report';

/** Uma célula da matriz: `week/3/regular` é 7 dias reais, ritmo 3, perfil Regular. */
export type CellKey = `${WindowId}/${number}/${ProfileId}`;

export function cellKey(window: WindowId, timeScale: number, profile: ProfileId): CellKey {
  return `${window}/${timeScale}/${profile}`;
}

/** O que as 50 sementes mediram em uma célula, só nas grandezas que têm faixa. */
type Baseline = {
  /** Menor e maior população final. */
  villagers: Range;
  /** Menor nível final do Salão do Senhor. */
  townHall: number;
  /** Maior número de horas reais com fome. */
  famineHours: number;
  /** Maior estoque final de cada material, em unidades: o excedente parado. */
  surplus: Record<SurplusResource, number>;
};

function measured(
  villagers: [number, number],
  townHall: number,
  famineHours: number,
  wood: number,
  stone: number,
  gold: number,
): Baseline {
  return {
    villagers: { min: villagers[0], max: villagers[1] },
    townHall,
    famineHours,
    surplus: { wood, stone, gold },
  };
}

/**
 * Linha de base medida: dificuldade Senhor, 50 sementes por célula. As faixas saem daqui, pela
 * regra de `SLACK`. A rodada completa, com data e identificação, está em docs/balance-v0.2.md.
 *
 * Estes números NÃO são metas aprovadas pelo autor: são o jogo como ele está, postos como
 * guarda de regressão (ADR 0013, decisão 5). Quando uma mecânica muda a economia de propósito,
 * a tarefa roda `pnpm -s sim -- --matrix`, confere o que mudou e por quê, atualiza esta tabela e
 * registra a rodada em docs/balance-v0.2.md, como se faz com um golden. Quando uma faixa falha
 * sem que a mudança fosse a intenção, o ajuste é nos números de `@lotg/content`, nunca no bot.
 */
// Colunas: população (menor e maior), Salão, horas de fome, madeira, pedra e ouro parados.
const MEASURED: Partial<Record<CellKey, Baseline>> = {
  'week/3/preguicoso': measured([20, 20], 2, 0, 17803, 9142, 6450),
  'week/3/regular': measured([35, 35], 3, 0, 40872, 16118, 6626),
  'week/3/dedicado': measured([55, 55], 5, 0, 83001, 33786, 12151),
  'week/1/preguicoso': measured([12, 12], 2, 0, 5515, 1846, 1921),
  'week/1/regular': measured([26, 26], 3, 0, 10017, 4190, 1637),
  'week/1/dedicado': measured([17, 17], 5, 0, 2068, 1145, 676),
  'week/0.5/preguicoso': measured([11, 11], 2, 0, 2443, 814, 674),
  'week/0.5/regular': measured([12, 12], 3, 0, 1609, 710, 409),
  'week/0.5/dedicado': measured([14, 14], 4, 0, 470, 316, 182),
  'year/3/preguicoso': measured([15, 15], 1, 0, 5419, 475, 514),
  'year/3/regular': measured([15, 15], 1, 0, 6274, 1571, 1338),
  'year/3/dedicado': measured([25, 25], 2, 0, 8758, 2989, 1493),
  'year/1/preguicoso': measured([12, 12], 2, 0, 5515, 1846, 1921),
  'year/1/regular': measured([26, 26], 3, 0, 10017, 4190, 1637),
  'year/1/dedicado': measured([17, 17], 5, 0, 2068, 1145, 676),
  'year/0.5/preguicoso': measured([14, 14], 3, 0, 4777, 2487, 1843),
  'year/0.5/regular': measured([17, 17], 5, 0, 2068, 1145, 676),
  'year/0.5/dedicado': measured([18, 18], 6, 0, 457, 322, 366),
};

/** A folga entre o que foi medido e o que a faixa aceita. Pequena e explícita. */
export const SLACK = {
  /** População: de 10% abaixo do menor a 10% acima do maior valor medido. */
  villagersPercent: 10,
  /** Horas de fome e excedente parado: até 5% acima do maior valor medido. */
  ceilingPercent: 5,
} as const;

/** A faixa que a CI cobra de cada partida de uma célula. */
export type Band = {
  villagers: Range;
  townHallMin: number;
  famineHoursMax: number;
  /** Limite do excedente parado de cada material, em unidades. */
  surplusMax: Record<SurplusResource, number>;
};

function ceiling(value: number): number {
  return Math.ceil((value * (100 + SLACK.ceilingPercent)) / 100);
}

function bandOf(baseline: Baseline): Band {
  const { villagersPercent } = SLACK;
  return {
    villagers: {
      min: Math.floor((baseline.villagers.min * (100 - villagersPercent)) / 100),
      max: Math.ceil((baseline.villagers.max * (100 + villagersPercent)) / 100),
    },
    townHallMin: baseline.townHall,
    famineHoursMax: ceiling(baseline.famineHours),
    surplusMax: Object.fromEntries(
      SURPLUS_RESOURCES.map((id) => [id, ceiling(baseline.surplus[id])]),
    ) as Record<SurplusResource, number>,
  };
}

/** A dificuldade em que as faixas foram medidas. As outras entram quando tiverem efeito. */
export const BANDED_DIFFICULTY: DifficultyId = 'lord';

/** A faixa de uma célula; `null` quando ela não foi medida (outra dificuldade, ritmo de fora). */
export function bandFor(key: CellKey, difficulty: DifficultyId = BANDED_DIFFICULTY): Band | null {
  const baseline = MEASURED[key];
  return difficulty !== BANDED_DIFFICULTY || baseline === undefined ? null : bandOf(baseline);
}

/** O que uma partida tem fora da faixa, uma frase por problema; vazio quando está dentro. */
export function checkBand(band: Band, summary: Summary): string[] {
  const problems: string[] = [];
  const { villagers, townHall, famineHours, surplus, commandsRefused } = summary;
  if (villagers < band.villagers.min || villagers > band.villagers.max) {
    problems.push(
      `população ${villagers}, fora da faixa de ${band.villagers.min} a ${band.villagers.max}`,
    );
  }
  if (townHall < band.townHallMin) {
    problems.push(`Salão no nível ${townHall}, abaixo do nível ${band.townHallMin}`);
  }
  if (famineHours > band.famineHoursMax) {
    problems.push(`${famineHours} h de fome, acima do limite de ${band.famineHoursMax} h`);
  }
  for (const id of SURPLUS_RESOURCES) {
    if (surplus[id] > band.surplusMax[id]) {
      problems.push(
        `excedente parado de ${balance.resources[id].label.toLowerCase()}: ${surplus[id]}, acima do limite de ${band.surplusMax[id]}`,
      );
    }
  }
  if (commandsRefused > 0) {
    problems.push(
      `${commandsRefused} ordens recusadas pelo motor (${refusedByCode(summary.refusedByCode)})`,
    );
  }
  return problems;
}
