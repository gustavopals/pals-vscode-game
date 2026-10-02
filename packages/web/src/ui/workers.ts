import type { ViewState } from '@lotg/protocol';

import { formatDuration, formatNumber, formatRate, joinList, remainingNow } from './format';

/**
 * A troca de ofício e a experiência do ofício (GDD §5.3 e §5.4), como texto. Tudo vem do
 * `ViewState`: o que rende um trabalhador adaptado e um recém-chegado, quanto dura a adaptação,
 * as levas em adaptação e a frase de cada regra. Aqui só se soma e se escreve.
 */

type WorkerRow = ViewState['workers'][number];
type Rules = ViewState['workersRules'];

/** "1 trabalhador", "3 trabalhadores". */
export const workersCount = (count: number) =>
  `${count} ${count === 1 ? 'trabalhador' : 'trabalhadores'}`;

/** "1 ferido", "2 feridos". */
export const injuredCount = (count: number) => `${count} ${count === 1 ? 'ferido' : 'feridos'}`;

/**
 * Quantos aldeões têm ofício agora. Os feridos de uma incursão moram e comem no feudo, mas não
 * trabalham nem estão livres para uma ordem (GDD §8.2): ficam fora das duas contas.
 */
export function employed(population: ViewState['population']): number {
  return population.villagers - population.free - population.injured;
}

/**
 * Os feridos que sararam durante uma ausência, somados, para o Relatório de Retorno: "2 aldeões
 * sararam das feridas: quem tinha ofício voltou a ele." `null` quando ninguém sarou.
 */
export function recoveredLine(count: number): string | null {
  if (count <= 0) {
    return null;
  }
  return count === 1
    ? '1 aldeão sarou das feridas: se tinha ofício, voltou a ele.'
    : `${count} aldeões sararam das feridas: quem tinha ofício voltou a ele.`;
}

/**
 * Quem saiu ferido deste ofício, na linha do edifício: "1 ferido: volta a este ofício quando
 * sarar." O prazo e a regra estão na frase do servidor (`population.injuredNote`), acima da
 * lista. `null` quando ninguém daqui se feriu.
 */
export function injuredLine(row: Pick<WorkerRow, 'injured'>): string | null {
  if (row.injured <= 0) {
    return null;
  }
  return row.injured === 1
    ? '1 ferido: volta a este ofício quando sarar.'
    : `${row.injured} feridos: voltam a este ofício quando sararem.`;
}

/**
 * O custo da troca, antes de qualquer clique: o que um trabalhador a mais rende agora e o que
 * passa a render depois da adaptação. "+5,2/h agora, +10,4/h depois de 40 min".
 */
export function nextWorkerGain(row: WorkerRow, rules: Rules): string {
  return `${formatRate(row.perNewWorkerPerHour)} agora, ${formatRate(row.perWorkerPerHour)} depois de ${formatDuration(rules.adaptationSeconds)}`;
}

/** O ofício chegou ao fim da barra. */
export function isMastered(row: WorkerRow, rules: Rules): boolean {
  return row.experience >= rules.experienceMax;
}

const TREND_WORDS: Record<WorkerRow['experienceTrend'], string | null> = {
  rising: 'subindo',
  steady: null,
  falling: 'caindo',
};

/** Para onde a experiência vai, em uma palavra; `null` quando está parada. */
export function experienceTrendWord(row: WorkerRow): string | null {
  return TREND_WORDS[row.experienceTrend];
}

/** "Experiência 40/100, subindo · +12% de produção", "Ofício dominado · +30% de produção". */
export function experienceSummary(row: WorkerRow, rules: Rules): string {
  const trend = experienceTrendWord(row);
  const level = isMastered(row, rules)
    ? 'Ofício dominado'
    : `Experiência ${formatNumber(row.experience)}/${formatNumber(rules.experienceMax)}`;
  const bonus =
    row.masteryBonusPercent > 0 ? ` · +${formatNumber(row.masteryBonusPercent)}% de produção` : '';
  return `${level}${trend === null ? '' : `, ${trend}`}${bonus}`;
}

/**
 * A experiência pede uma ação: está caindo, ou parou com gente trabalhando e a barra por encher
 * (falta gente para o nível do edifício). A frase do servidor diz o porquê e o que fazer, e nesses
 * casos fica à vista. O edifício vazio que nunca teve ofício não tem o que perder: só explicação.
 */
export function experienceNeedsAttention(row: WorkerRow, rules: Rules): boolean {
  return (
    row.experienceTrend === 'falling' ||
    (row.experienceTrend === 'steady' && row.assigned > 0 && !isMastered(row, rules))
  );
}

/**
 * Quem ainda se adapta e por quanto tempo, com o prazo descontado do tempo desde a leitura:
 * "2 em adaptação por mais 38 min", "3 em adaptação: 1 por mais 12 min e 2 por mais 38 min".
 * `time` escreve o prazo (contagem regressiva no painel, duração por extenso na árvore).
 */
export function adaptationLine(
  row: WorkerRow,
  elapsedSeconds: number,
  time: (seconds: number) => string = formatDuration,
): string | null {
  if (row.adapting === 0) {
    return null;
  }
  const left = (seconds: number) => `por mais ${time(remainingNow(seconds, elapsedSeconds))}`;
  const [only] = row.adaptingCohorts;
  if (row.adaptingCohorts.length === 1 && only !== undefined) {
    return `${row.adapting} em adaptação ${left(only.endsInSeconds)}`;
  }
  if (row.adaptingCohorts.length === 0) {
    // Sem as levas, vale o prazo da última.
    return row.adaptationEndsInSeconds === null
      ? `${row.adapting} em adaptação`
      : `${row.adapting} em adaptação ${left(row.adaptationEndsInSeconds)}`;
  }
  return `${row.adapting} em adaptação: ${joinList(
    row.adaptingCohorts.map((cohort) => `${cohort.count} ${left(cohort.endsInSeconds)}`),
  )}`;
}

export type AllocationPreview = {
  /** O que o edifício rende assim que a ordem for aceita. */
  nowPerHour: number;
  /** O que rende com todos adaptados. */
  settledPerHour: number;
  /** Quantos ficam em adaptação. */
  adapting: number;
  /** Em quanto tempo o último deles termina; `null` sem ninguém em adaptação. */
  settlesInSeconds: number | null;
};

/**
 * O que o edifício passaria a render com `count` trabalhadores. É uma prévia, e quem decide é o
 * servidor. Quem chega entra como uma leva nova, com o prazo de `workersRules.adaptationSeconds`;
 * quem sai, sai das levas mais novas primeiro, como diz `workersRules.removalText`. As taxas são
 * as duas que a visão traz: a de um trabalhador adaptado e a de um recém-chegado.
 */
export function previewAllocation(row: WorkerRow, rules: Rules, count: number): AllocationPreview {
  const delta = count - row.assigned;
  // Em ordem de término: a última é a mais nova.
  const cohorts = row.adaptingCohorts.map((cohort) => ({ ...cohort }));
  if (delta > 0) {
    cohorts.push({ count: delta, endsInSeconds: rules.adaptationSeconds });
  }
  for (let leaving = -delta; leaving > 0 && cohorts.length > 0;) {
    const newest = cohorts[cohorts.length - 1] as (typeof cohorts)[number];
    const taken = Math.min(newest.count, leaving);
    newest.count -= taken;
    leaving -= taken;
    if (newest.count === 0) {
      cohorts.pop();
    }
  }
  const adapting = cohorts.reduce((sum, cohort) => sum + cohort.count, 0);
  const last = cohorts[cohorts.length - 1];
  return {
    // Sem mudança, o número é o da visão: a soma das duas taxas pode diferir dele em um milésimo.
    nowPerHour:
      delta === 0
        ? row.grossPerHour
        : (count - adapting) * row.perWorkerPerHour + adapting * row.perNewWorkerPerHour,
    settledPerHour: count * row.perWorkerPerHour,
    adapting,
    settlesInSeconds: last === undefined ? null : last.endsInSeconds,
  };
}

/**
 * A frase que acompanha o número digitado na lista de alocação: o custo da troca antes de
 * confirmar. "+2: 81,5/h agora, 122,3/h depois da adaptação (40 min). Quem troca de ofício produz
 * metade por 40 min."
 */
export function allocationMessage(row: WorkerRow, rules: Rules, count: number): string {
  const delta = count - row.assigned;
  const preview = previewAllocation(row, rules, count);
  const head = delta === 0 ? 'Como hoje' : `${delta > 0 ? '+' : '−'}${Math.abs(delta)}`;
  const rate =
    preview.settlesInSeconds === null
      ? `${formatNumber(preview.nowPerHour)}/h`
      : `${formatNumber(preview.nowPerHour)}/h agora, ${formatNumber(preview.settledPerHour)}/h depois da adaptação (${formatDuration(preview.settlesInSeconds)})`;
  // A regra que explica o número, na frase do servidor: a da chegada ou a da saída.
  const rule =
    delta > 0
      ? ` ${rules.adaptationText}`
      : delta < 0 && row.adapting > 0
        ? ` ${rules.removalText}`
        : '';
  return `${head}: ${rate}.${rule}`;
}
