import { balance, councilCards, type SeasonId } from '@lotg/content';

import type { Range } from './matrix';
import type { SimulationResult } from './simulate';

/**
 * A cobertura do catálogo do Conselho em partidas jogadas (roadmap da v0.2, V2D-T2.5): quantas
 * cartas o bot vê em um ano de jogo, quais, em que estação e com o Salão em que nível, e se
 * alguma audiência ficou sem carta por falta de assunto.
 *
 * Tudo sai dos eventos e das linhas por hora de uma partida do simulador. A elegibilidade em
 * si (quantas cartas o sorteio tinha ao alcance) é regra do motor e é medida lá
 * (`packages/engine/src/council.coverage.test.ts`).
 */

const { dayMs, seasons } = balance.calendar;
const YEAR_MS = seasons.reduce((sum, season) => sum + season.days, 0) * dayMs;
const AUDIENCE_MS = balance.council.drawIntervalDays * dayMs;
const HOUR_MS = 3_600_000;

/** A estação de um instante de jogo. */
function seasonAt(atMs: number): SeasonId {
  let rest = (atMs % YEAR_MS) / dayMs;
  for (const season of seasons) {
    if (rest < season.days) {
      return season.id;
    }
    rest -= season.days;
  }
  return seasons[0]?.id ?? 'spring';
}

/** Por que uma audiência não trouxe carta do sorteio. */
type Blank = { seed: string; atMs: number; reason: 'mesa cheia' | 'sem assunto' };

export type Coverage = {
  runs: number;
  /** Audiências de cada partida: as que caem dentro da janela jogada. */
  audiences: number;
  /** Por partida, a menor e a maior contagem entre as sementes. */
  perRun: {
    cards: Range;
    models: Range;
    continuations: Range;
    answered: Range;
    expired: Range;
    /** Audiências puladas porque a mesa estava cheia (ou reservada a uma continuação). */
    blocked: Range;
    /** Audiências com lugar na mesa e sem carta: o catálogo não tinha assunto. */
    blank: Range;
  };
  /** Por estação: as audiências dela e as cartas que o sorteio tirou nelas, por partida. */
  bySeason: Record<SeasonId, { audiences: number; drawn: Range; models: string[] }>;
  /** Por nível do Salão na hora da chegada: quantas cartas, somadas as sementes, e de quantos modelos. */
  byTownHall: Array<{ level: number; cards: number; models: number }>;
  /** Por carta do catálogo: em quantas partidas ela apareceu e quantas vezes ao todo. */
  byCard: Array<{ cardId: string; title: string; runs: number; total: number }>;
  blanks: Blank[];
};

const range = (values: number[]): Range => ({
  min: Math.min(...values),
  max: Math.max(...values),
});

/**
 * Mede a cobertura de um conjunto de partidas com o mesmo ritmo e a mesma duração. As partidas
 * precisam ter o Conselho desde o instante zero (toda partida nova tem).
 */
export function measureCoverage(results: readonly SimulationResult[]): Coverage {
  const [first] = results;
  if (first === undefined) {
    throw new Error('A cobertura precisa de ao menos uma partida.');
  }
  const timeScale = first.options.timeScale ?? 1;
  const endMs = first.rows.length * HOUR_MS * timeScale;
  const audienceInstants: number[] = [];
  for (let at = AUDIENCE_MS; at <= endMs; at += AUDIENCE_MS) {
    audienceInstants.push(at);
  }
  const seasonIds = seasons.map((season) => season.id);

  const blanks: Blank[] = [];
  const perRun = results.map((result) => {
    const cards = result.events.filter((event) => event.type.startsWith('card'));
    const drawn = cards.filter((event) => event.type === 'cardDrawn');
    const left = cards.filter(
      (event) => event.type === 'cardAnswered' || event.type === 'cardExpired',
    );
    let blocked = 0;
    let blank = 0;
    for (const at of audienceInstants) {
      if (drawn.some((event) => event.atMs === at && event.data.source !== 'continuation')) {
        continue;
      }
      // O que estava na mesa quando o sorteio rodou: o que chegou antes e ainda não tinha
      // saído. As expirações do mesmo instante vêm depois do sorteio; as respostas, também.
      const seated =
        drawn.filter((event) => event.atMs < at).length -
        left.filter((event) => event.atMs < at).length;
      // Uma continuação que chega nesse instante tinha o lugar reservado.
      const reserved = drawn.filter(
        (event) => event.atMs === at && event.data.source === 'continuation',
      ).length;
      if (seated + reserved >= balance.council.maxPending) {
        blocked += 1;
      } else {
        blank += 1;
        blanks.push({ seed: result.options.seed, atMs: at, reason: 'sem assunto' });
      }
    }
    const levelAt = (atMs: number) => {
      const hour = Math.min(result.rows.length, Math.max(1, Math.ceil(atMs / timeScale / HOUR_MS)));
      return result.rows[hour - 1]?.levels.townHall ?? 1;
    };
    return {
      drawn,
      models: new Set(drawn.map((event) => String(event.data.cardId))),
      continuations: drawn.filter((event) => event.data.source === 'continuation').length,
      answered: cards.filter((event) => event.type === 'cardAnswered').length,
      expired: cards.filter((event) => event.type === 'cardExpired').length,
      blocked,
      blank,
      levels: drawn.map((event) => ({ level: levelAt(event.atMs), id: String(event.data.cardId) })),
    };
  });

  const bySeason = Object.fromEntries(
    seasonIds.map((season) => {
      const inSeason = (atMs: number) => seasonAt(atMs) === season;
      const models = new Set<string>();
      const counts = perRun.map((run) => {
        const here = run.drawn.filter(
          (event) => inSeason(event.atMs) && event.data.source !== 'continuation',
        );
        here.forEach((event) => models.add(String(event.data.cardId)));
        return here.length;
      });
      return [
        season,
        {
          audiences: audienceInstants.filter(inSeason).length,
          drawn: range(counts),
          models: councilCards.map((card) => card.id).filter((id) => models.has(id)),
        },
      ];
    }),
  ) as Coverage['bySeason'];

  const levels = [...new Set(perRun.flatMap((run) => run.levels.map((entry) => entry.level)))];
  const byTownHall = levels
    .sort((a, b) => a - b)
    .map((level) => {
      const here = perRun.flatMap((run) => run.levels.filter((entry) => entry.level === level));
      return { level, cards: here.length, models: new Set(here.map((entry) => entry.id)).size };
    });

  return {
    runs: results.length,
    audiences: audienceInstants.length,
    perRun: {
      cards: range(perRun.map((run) => run.drawn.length)),
      models: range(perRun.map((run) => run.models.size)),
      continuations: range(perRun.map((run) => run.continuations)),
      answered: range(perRun.map((run) => run.answered)),
      expired: range(perRun.map((run) => run.expired)),
      blocked: range(perRun.map((run) => run.blocked)),
      blank: range(perRun.map((run) => run.blank)),
    },
    bySeason,
    byTownHall,
    byCard: councilCards.map((card) => ({
      cardId: card.id,
      title: card.title,
      runs: perRun.filter((run) => run.models.has(card.id)).length,
      total: perRun.reduce(
        (sum, run) => sum + run.drawn.filter((event) => event.data.cardId === card.id).length,
        0,
      ),
    })),
    blanks,
  };
}

const span = ({ min, max }: Range) => (min === max ? `${min}` : `${min} a ${max}`);

/** A cobertura em tabelas de Markdown, como vai para docs/content-v0.2.md. */
export function formatCoverage(title: string, coverage: Coverage): string {
  const { perRun } = coverage;
  const seasonLabel = (id: SeasonId) => seasons.find((season) => season.id === id)?.label ?? id;
  return [
    `#### ${title}`,
    '',
    `${coverage.runs} sementes, ${coverage.audiences} audiências por partida.`,
    '',
    '| Por partida | Menor a maior |',
    '|---|---|',
    `| Cartas que chegaram | ${span(perRun.cards)} |`,
    `| Modelos diferentes | ${span(perRun.models)} |`,
    `| Continuações de cadeia | ${span(perRun.continuations)} |`,
    `| Respondidas pelo bot | ${span(perRun.answered)} |`,
    `| Expiradas | ${span(perRun.expired)} |`,
    `| Audiências puladas com a mesa cheia | ${span(perRun.blocked)} |`,
    `| Audiências sem carta por falta de assunto | ${span(perRun.blank)} |`,
    '',
    '| Estação | Audiências | Cartas sorteadas por partida | Modelos vistos nas 50 sementes |',
    '|---|---:|---|---:|',
    ...seasons.map(({ id }) => {
      const row = coverage.bySeason[id];
      return `| ${seasonLabel(id)} | ${row.audiences} | ${span(row.drawn)} | ${row.models.length} |`;
    }),
    '',
    '| Salão na chegada da carta | Cartas (soma das sementes) | Modelos diferentes |',
    '|---:|---:|---:|',
    ...coverage.byTownHall.map((row) => `| ${row.level} | ${row.cards} | ${row.models} |`),
    '',
    '| Carta | Partidas em que apareceu | Vezes ao todo |',
    '|---|---:|---:|',
    ...coverage.byCard.map((row) => `| ${row.title} | ${row.runs} | ${row.total} |`),
    '',
  ].join('\n');
}
