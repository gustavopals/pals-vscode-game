import {
  balance,
  feats,
  type SeasonId,
  yearChronicleTexts,
  type YearEndedData,
  YearEndedDataSchema,
} from '@lotg/content';
import { CHRONICLE_HIDDEN_EVENT_TYPES, chronicleLinkSuffix, isExpeditionId } from '@lotg/protocol';
import { and, eq, gt, lte, notInArray, sql } from 'drizzle-orm';

import { notFound } from '../api-error';
import type { AppContext } from '../context';
import { gameEvents } from '../db/schema';
import { withGameReading } from './service';

const DAY_MS = balance.calendar.dayMs;
const DAYS_PER_YEAR = balance.calendar.seasons.reduce((sum, season) => sum + season.days, 0);
const YEAR_MS = DAYS_PER_YEAR * DAY_MS;

/** Linha de evento da Crônica para montagem do Markdown. */
export type YearChronicleRow = {
  kind: string;
  payload: {
    atMs?: number;
    text: string;
    data: Record<string, string | number>;
  };
};

/**
 * Como a nota de uma continuação cita a escolha que a trouxe (GDD §7, V2D-T4.3).
 */
const ECHO_LABELS: Record<string, string> = {
  cardAnswered: 'Sua escolha voltou',
  cardExpired: 'A decisão do conselho voltou',
};

/** Os capítulos acompanham a ordem e a duração das estações do conteúdo. */
const SEASONS = balance.calendar.seasons.reduce<
  { id: SeasonId; label: string; endOffset: number }[]
>((list, season) => {
  const start = list.at(-1)?.endOffset ?? 0;
  list.push({ id: season.id, label: season.label, endOffset: start + season.days * DAY_MS });
  return list;
}, []);

/**
 * Monta o Markdown da Crônica do Ano conforme GDD §11.4 e Apêndice E:
 * - Título com o ano e o nome do feudo
 * - Quatro seções por estação com as linhas da Crônica e notas de continuação
 * - Seção do Cerco do Inverno com o resultado narrativo
 * - Tabela de estatísticas com os totais do ano
 * - Pontuação do ano
 * - Lista dos Feitos anuais conquistados
 */
export function buildYearChronicleMarkdown(
  settlementName: string,
  year: number,
  rows: readonly YearChronicleRow[],
  yearEnded: YearEndedData,
  options: { links?: boolean } = {},
): string {
  const lines: string[] = [];

  // 1. Título
  const title = yearChronicleTexts.title
    .replace('{ano}', String(year))
    .replace('{feudo}', settlementName);
  lines.push(`# ${title}`, '');

  // 2. Agrupamento por estação
  const yearStartMs = (year - 1) * YEAR_MS;
  const yearEndMs = year * YEAR_MS;

  const seasonRows = new Map<SeasonId, YearChronicleRow[]>(
    SEASONS.map((season) => [season.id, []]),
  );

  const outcomes = new Map<string, YearChronicleRow>();

  for (const row of rows) {
    if (row.kind === 'yearEnded') {
      continue;
    }
    const atMs = row.payload.atMs ?? 0;
    const data = row.payload.data;
    if (row.kind === 'yearStarted' && typeof data.year === 'number' && data.year !== year) {
      continue;
    }
    if (atMs === yearEndMs && row.kind === 'threatTileRestored') {
      continue;
    }
    const offsetMs = atMs - yearStartMs;
    if (offsetMs < 0 || offsetMs > YEAR_MS) {
      continue;
    }

    // O instante exato do fim do ano fica na última estação, como o fecho anual.
    const season = SEASONS.find((entry) => offsetMs < entry.endOffset) ?? SEASONS.at(-1)!;
    seasonRows.get(season.id)!.push(row);
  }

  // 3. Seções por estação
  for (const season of SEASONS) {
    lines.push(`## ${season.label}`, '');
    const events = seasonRows.get(season.id)!;
    if (events.length === 0) {
      lines.push(yearChronicleTexts.emptySeason, '');
    } else {
      for (const row of events) {
        const { text, data } = row.payload;
        const link =
          options.links === true && isExpeditionId(data.expeditionId)
            ? chronicleLinkSuffix(data.expeditionId)
            : '';
        lines.push(`- ${text}${link}`);
        if (row.kind === 'cardDrawn' && typeof data.previousInstanceId === 'string') {
          const previous = outcomes.get(data.previousInstanceId);
          const label = previous === undefined ? undefined : ECHO_LABELS[previous.kind];
          if (previous !== undefined && label !== undefined) {
            lines.push(`  - ${label}: “${previous.payload.text}”`);
          }
        }
        if (row.kind in ECHO_LABELS && typeof data.instanceId === 'string') {
          outcomes.set(data.instanceId, row);
        }
      }
      lines.push('');
    }
  }

  // 4. O Cerco do Inverno
  lines.push(`## ${yearChronicleTexts.siege}`, '');
  lines.push(yearChronicleTexts.siegeResults[yearEnded.siegeResult], '');

  // 5. O ano em números
  lines.push(`## ${yearChronicleTexts.statistics}`, '');
  lines.push(`| ${yearChronicleTexts.metric} | ${yearChronicleTexts.value} |`);
  lines.push('|---|---|');
  lines.push(`| ${yearChronicleTexts.metrics.populationMax} | ${yearEnded.populationMax} |`);
  lines.push(`| ${yearChronicleTexts.metrics.battles} | ${yearEnded.battles} |`);
  lines.push(`| ${yearChronicleTexts.metrics.battlesWon} | ${yearEnded.battlesWon} |`);
  lines.push(`| ${yearChronicleTexts.metrics.expeditions} | ${yearEnded.expeditions} |`);
  lines.push(`| ${yearChronicleTexts.metrics.cards} | ${yearEnded.cards} |`);
  lines.push('');

  // 6. Pontuação
  lines.push(`## ${yearChronicleTexts.score}`, '');
  lines.push(yearChronicleTexts.points.replace('{pontos}', String(yearEnded.score)), '');

  // 7. Feitos do ano
  lines.push(`## ${yearChronicleTexts.feats}`, '');
  const earnedFeatIds = yearEnded.feats
    .split(',')
    .map((s: string) => s.trim())
    .filter(Boolean);
  const earnedFeats = feats.filter((f) => earnedFeatIds.includes(f.id));
  if (earnedFeats.length === 0) {
    lines.push(yearChronicleTexts.noFeats);
  } else {
    for (const feat of earnedFeats) {
      lines.push(`- **${feat.label}**: ${feat.description}`);
    }
  }
  lines.push('');

  return lines.join('\n');
}

/**
 * Lê os eventos do ano de uma partida autorizada e monta a Crônica do Ano em Markdown.
 * Lança 404 se a Crônica do ano pedido ainda não foi publicada (evento yearEnded ausente).
 */
export async function readYearChronicleMarkdown(
  ctx: AppContext,
  accountId: string,
  gameId: string,
  year: number,
  options: { links?: boolean } = {},
): Promise<string> {
  return withGameReading(ctx, accountId, gameId, async (reading, tx) => {
    const [yearEndedRow] = await tx
      .select()
      .from(gameEvents)
      .where(
        and(
          eq(gameEvents.gameId, reading.game.id),
          eq(gameEvents.kind, 'yearEnded'),
          sql`${gameEvents.payload} -> 'data' ->> 'year' = ${String(year)}`,
        ),
      );
    if (yearEndedRow === undefined) {
      throw notFound('Crônica do ano');
    }

    const yearEnded = YearEndedDataSchema.parse(yearEndedRow.payload.data);

    let startSeq = 0;
    if (year > 1) {
      const [prevYearEnded] = await tx
        .select({ seq: gameEvents.seq })
        .from(gameEvents)
        .where(
          and(
            eq(gameEvents.gameId, reading.game.id),
            eq(gameEvents.kind, 'yearEnded'),
            sql`${gameEvents.payload} -> 'data' ->> 'year' = ${String(year - 1)}`,
          ),
        );
      startSeq = prevYearEnded?.seq ?? 0;
    }

    const endSeq = yearEndedRow.seq;

    const rows = await tx
      .select()
      .from(gameEvents)
      .where(
        and(
          eq(gameEvents.gameId, reading.game.id),
          gt(gameEvents.seq, startSeq),
          lte(gameEvents.seq, endSeq),
          notInArray(gameEvents.kind, [...CHRONICLE_HIDDEN_EVENT_TYPES]),
        ),
      )
      .orderBy(gameEvents.seq);

    return buildYearChronicleMarkdown(
      reading.state.settlement.name,
      year,
      rows,
      yearEnded,
      options,
    );
  });
}
