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
  /** Maior número de horas reais com frio. */
  coldHours: number;
  /** Maior estoque final de cada material, em unidades: o excedente parado. */
  surplus: Record<SurplusResource, number>;
};

function measured(
  villagers: [number, number],
  townHall: number,
  famineHours: number,
  coldHours: number,
  wood: number,
  stone: number,
  gold: number,
): Baseline {
  return {
    villagers: { min: villagers[0], max: villagers[1] },
    townHall,
    famineHours,
    coldHours,
    surplus: { wood, stone, gold },
  };
}

/**
 * Linha de base medida: dificuldade Senhor, 50 sementes por célula. As faixas saem daqui, pela
 * regra de `SLACK`. A rodada completa, com data e identificação, está em docs/balance-v0.2.md
 * (a última é a da seção 7, depois da moral, V2C-T4).
 *
 * Estes números NÃO são metas aprovadas pelo autor: são o jogo como ele está, postos como
 * guarda de regressão (ADR 0013, decisão 5). Quando uma mecânica muda a economia de propósito,
 * a tarefa roda `pnpm -s sim -- --matrix`, confere o que mudou e por quê, atualiza esta tabela e
 * registra a rodada em docs/balance-v0.2.md, como se faz com um golden. Quando uma faixa falha
 * sem que a mudança fosse a intenção, o ajuste é nos números de `@lotg/content`, nunca no bot.
 */
// Colunas: população (menor e maior), Salão, horas de fome, horas de frio, madeira, pedra e ouro
// parados.
const MEASURED: Partial<Record<CellKey, Baseline>> = {
  'week/3/preguicoso': measured([33, 33], 7, 0, 0, 3900, 3900, 4660),
  'week/3/regular': measured([72, 72], 7, 0, 0, 5100, 5100, 37628),
  'week/3/dedicado': measured([74, 74], 7, 0, 0, 5100, 5100, 64707),
  'week/1/preguicoso': measured([33, 33], 6, 0, 0, 692, 713, 1637),
  'week/1/regular': measured([66, 66], 7, 0, 0, 4500, 4106, 2000),
  'week/1/dedicado': measured([74, 74], 7, 0, 0, 5100, 5100, 5716),
  'week/0.5/preguicoso': measured([14, 14], 4, 0, 0, 70, 188, 231),
  'week/0.5/regular': measured([54, 54], 6, 0, 0, 753, 952, 652),
  'week/0.5/dedicado': measured([61, 61], 6, 0, 0, 813, 920, 180),
  'year/3/preguicoso': measured([13, 13], 3, 0, 0, 513, 531, 160),
  'year/3/regular': measured([27, 27], 5, 0, 0, 780, 1234, 1155),
  'year/3/dedicado': measured([52, 52], 7, 0, 0, 815, 1672, 477),
  'year/1/preguicoso': measured([33, 33], 6, 0, 0, 692, 713, 1637),
  'year/1/regular': measured([66, 66], 7, 0, 0, 4500, 4106, 2000),
  'year/1/dedicado': measured([74, 74], 7, 0, 0, 5100, 5100, 5716),
  'year/0.5/preguicoso': measured([23, 23], 6, 0, 0, 1029, 1279, 977),
  'year/0.5/regular': measured([74, 74], 7, 0, 0, 5100, 5100, 5772),
  'year/0.5/dedicado': measured([74, 74], 7, 0, 0, 5100, 4525, 8053),
};

/** A folga entre o que foi medido e o que a faixa aceita. Pequena e explícita. */
export const SLACK = {
  /** População: de 10% abaixo do menor a 10% acima do maior valor medido. */
  villagersPercent: 10,
  /** Horas de fome, horas de frio e excedente parado: até 5% acima do maior valor medido. */
  ceilingPercent: 5,
} as const;

/** A faixa que a CI cobra de cada partida de uma célula. */
export type Band = {
  villagers: Range;
  townHallMin: number;
  famineHoursMax: number;
  coldHoursMax: number;
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
    coldHoursMax: ceiling(baseline.coldHours),
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
  const { villagers, townHall, famineHours, coldHours, surplus, commandsRefused } = summary;
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
  if (coldHours > band.coldHoursMax) {
    problems.push(`${coldHours} h de frio, acima do limite de ${band.coldHoursMax} h`);
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
