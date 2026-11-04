import fs from 'node:fs';
import path from 'node:path';
import { balance, yearChronicleTexts, type YearEndedData } from '@lotg/content';
import { describe, expect, it, vi } from 'vitest';

import { buildYearChronicleMarkdown, type YearChronicleRow } from './chronicle';

const DAY_MS = balance.calendar.dayMs;
const DAYS_PER_YEAR = balance.calendar.seasons.reduce((sum, season) => sum + season.days, 0);
const YEAR_MS = DAYS_PER_YEAR * DAY_MS;

const row = (
  kind: string,
  text: string,
  data: YearChronicleRow['payload']['data'] = {},
  atMs = 0,
): YearChronicleRow => ({
  kind,
  payload: { text, data, atMs },
});

function expectGolden(actual: string, filename: string): void {
  const goldenDir = path.join(__dirname, '__golden__');
  const filePath = path.join(goldenDir, filename);
  if (!fs.existsSync(goldenDir)) {
    fs.mkdirSync(goldenDir, { recursive: true });
  }
  if (process.env.UPDATE_GOLDEN || !fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, actual, 'utf8');
  }
  const expected = fs.readFileSync(filePath, 'utf8');
  expect(actual).toBe(expected);
}

describe('Crônica do Ano em Markdown (V4G-T3.2 e T3.4)', () => {
  it('golden de um ano com cerco vencido', () => {
    const rows: YearChronicleRow[] = [
      row('yearStarted', 'Começa o ano 1 da Casa de Pedra Alta.', { year: 1 }, 0),
      row(
        'constructionStarted',
        'No 3º dia da Primavera, os pedreiros começaram a erguer as Habitações ao 1º nível.',
        {},
        3 * DAY_MS,
      ),
      row(
        'constructionFinished',
        'No 6º dia da Primavera, os pedreiros ergueram as Habitações ao 1º nível.',
        {},
        6 * DAY_MS,
      ),
      row('seasonChanged', 'Chega o Verão a Pedra Alta.', { season: 'summer' }, 24 * DAY_MS),
      row(
        'expeditionSent',
        'No 4º dia do Verão, a expedição "Patrulha" deixou o feudo rumo à Floresta Antiga.',
        { expeditionId: 'expedition-1' },
        28 * DAY_MS,
      ),
      row(
        'expeditionReturned',
        'No 6º dia do Verão, a expedição "Patrulha" voltou com 20 de madeira.',
        { expeditionId: 'expedition-1' },
        30 * DAY_MS,
      ),
      row('seasonChanged', 'Chega o Outono a Pedra Alta.', { season: 'autumn' }, 48 * DAY_MS),
      row(
        'cardDrawn',
        'No 2º dia do Outono, o conselho pediu audiência sobre os celeiros.',
        { instanceId: 'granary-1', source: 'draw' },
        50 * DAY_MS,
      ),
      row(
        'cardAnswered',
        'No 3º dia do Outono, o senhor ordenou estocar os grãos.',
        { instanceId: 'granary-1' },
        51 * DAY_MS,
      ),
      row('seasonChanged', 'Chega o Inverno a Pedra Alta.', { season: 'winter' }, 72 * DAY_MS),
      row(
        'siegeWaveResolved',
        'No 6º dia do Inverno, a 1ª onda da Horda foi repelida pela ala centro.',
        {},
        78 * DAY_MS,
      ),
      row(
        'siegeWaveResolved',
        'No 7º dia do Inverno, a 2ª onda da Horda recuou sob saraivada de flechas.',
        {},
        79 * DAY_MS,
      ),
      row(
        'siegeWaveResolved',
        'No 8º dia do Inverno, a 3ª onda rompeu a ala esquerda, mas o exército de Pedra Alta venceu o cerco.',
        {},
        80 * DAY_MS,
      ),
    ];

    const yearEnded: YearEndedData = {
      year: 1,
      populationMax: 35,
      battles: 4,
      battlesWon: 4,
      expeditions: 3,
      cards: 5,
      siegeResult: 'victory',
      score: 285,
      feats: 'firstWinter,feint,saboteur',
    };

    const markdown = buildYearChronicleMarkdown('Pedra Alta', 1, rows, yearEnded);
    expectGolden(markdown, 'year-chronicle-victory.md');
  });

  it('golden de um ano com cerco com Queda', () => {
    const rows: YearChronicleRow[] = [
      row('yearStarted', 'Começa o ano 1 da Casa de Vila Nova.', { year: 1 }, 0),
      row('seasonChanged', 'Chega o Verão a Vila Nova.', { season: 'summer' }, 24 * DAY_MS),
      row('seasonChanged', 'Chega o Outono a Vila Nova.', { season: 'autumn' }, 48 * DAY_MS),
      row('seasonChanged', 'Chega o Inverno a Vila Nova.', { season: 'winter' }, 72 * DAY_MS),
      row(
        'siegeWaveResolved',
        'No 6º dia do Inverno, as defesas caíram perante a Horda e o feudo sucumbiu.',
        {},
        78 * DAY_MS,
      ),
    ];

    const yearEnded: YearEndedData = {
      year: 1,
      populationMax: 18,
      battles: 3,
      battlesWon: 1,
      expeditions: 1,
      cards: 2,
      siegeResult: 'fall',
      score: 65,
      feats: '',
    };

    const markdown = buildYearChronicleMarkdown('Vila Nova', 1, rows, yearEnded);
    expectGolden(markdown, 'year-chronicle-fall.md');
  });

  it('o ano 2 sem a Crônica do 1 duplicada', () => {
    const allRows: YearChronicleRow[] = [
      // Eventos do ano 1
      row('yearStarted', 'Começa o ano 1 da Casa de Pedra Alta.', { year: 1 }, 0),
      row(
        'constructionFinished',
        'No 3º dia da Primavera, habitações erguidas no ano 1.',
        {},
        3 * DAY_MS,
      ),
      row('seasonChanged', 'Chega o Verão a Pedra Alta.', { season: 'summer' }, 24 * DAY_MS),
      row('yearEnded', 'Encerra-se o ano 1 da Casa de Pedra Alta.', { year: 1 }, YEAR_MS),

      // Eventos do ano 2
      row('yearStarted', 'Começa o ano 2 da Casa de Pedra Alta.', { year: 2 }, YEAR_MS),
      row(
        'constructionFinished',
        'No 4º dia da Primavera, muralha reforçada no ano 2.',
        {},
        YEAR_MS + 4 * DAY_MS,
      ),
      row(
        'seasonChanged',
        'Chega o Verão a Pedra Alta no ano 2.',
        { season: 'summer' },
        YEAR_MS + 24 * DAY_MS,
      ),
      row('yearEnded', 'Encerra-se o ano 2 da Casa de Pedra Alta.', { year: 2 }, 2 * YEAR_MS),
    ];

    const yearEndedYear2: YearEndedData = {
      year: 2,
      populationMax: 45,
      battles: 5,
      battlesWon: 5,
      expeditions: 4,
      cards: 7,
      siegeResult: 'glorious',
      score: 395,
      feats: 'firstWinter,intactWall',
    };

    const markdownYear2 = buildYearChronicleMarkdown('Pedra Alta', 2, allRows, yearEndedYear2);

    // O cabeçalho deve ser do ano 2
    expect(markdownYear2).toContain('# Crônica do Ano 2 — Pedra Alta');

    // Apenas acontecimentos do ano 2 devem estar presentes
    expect(markdownYear2).toContain('No 4º dia da Primavera, muralha reforçada no ano 2.');
    expect(markdownYear2).toContain('Chega o Verão a Pedra Alta no ano 2.');

    // Nenhum acontecimento do ano 1 deve aparecer no ano 2
    expect(markdownYear2).not.toContain('Começa o ano 1 da Casa de Pedra Alta.');
    expect(markdownYear2).not.toContain('habitações erguidas no ano 1.');

    // Outono e Inverno do ano 2 não tiveram eventos nesta amostra: exibe mensagem padrão
    expect(markdownYear2).toContain(`## Outono\n\n${yearChronicleTexts.emptySeason}`);
    expect(markdownYear2).toContain(`## Inverno\n\n${yearChronicleTexts.emptySeason}`);

    // Cerco glorioso e Feitos
    expect(markdownYear2).toContain('Vitória Gloriosa — nenhuma ala foi rompida.');
    expect(markdownYear2).toContain('Muralha Intacta');
  });

  it('continuação de cartas e links de expedição', () => {
    const rows: YearChronicleRow[] = [
      row(
        'cardDrawn',
        'No 1º dia da Primavera, o conselho fez uma proposta.',
        { cardId: 'c1', instanceId: 'inst-1', source: 'draw' },
        DAY_MS,
      ),
      row(
        'cardAnswered',
        'No 2º dia da Primavera, o senhor aceitou.',
        { cardId: 'c1', instanceId: 'inst-1', optionId: 'accept' },
        2 * DAY_MS,
      ),
      row(
        'cardDrawn',
        'No 5º dia da Primavera, a promessa foi cumprida.',
        {
          cardId: 'c2',
          instanceId: 'inst-2',
          source: 'continuation',
          previousInstanceId: 'inst-1',
        },
        5 * DAY_MS,
      ),
      row(
        'expeditionSent',
        'No 10º dia da Primavera, uma expedição partiu.',
        { expeditionId: 'expedition-42' },
        10 * DAY_MS,
      ),
    ];

    const yearEnded: YearEndedData = {
      year: 1,
      populationMax: 20,
      battles: 0,
      battlesWon: 0,
      expeditions: 1,
      cards: 1,
      siegeResult: 'none',
      score: 50,
      feats: '',
    };

    const linked = buildYearChronicleMarkdown('Pedra Alta', 1, rows, yearEnded, {
      links: true,
    });
    expect(linked).toContain('Sua escolha voltou: “No 2º dia da Primavera, o senhor aceitou.”');
    expect(linked).toContain('<!-- expedition-42 -->');

    const clean = buildYearChronicleMarkdown('Pedra Alta', 1, rows, yearEnded, {
      links: false,
    });
    expect(clean).not.toContain('<!-- expedition-42 -->');
  });

  it.each([1, 2])(
    'o ano %s acompanha as fronteiras de outro calendário do conteúdo',
    async (year) => {
      // Durações diferentes das publicadas detectam limites fixos tanto nas estações como no ano.
      const seasons = balance.calendar.seasons.map((season, index) => ({
        ...season,
        days: index + 1,
      }));
      vi.resetModules();
      vi.doMock('@lotg/content', async (importOriginal) => {
        const content = await importOriginal<typeof import('@lotg/content')>();
        return {
          ...content,
          balance: { ...balance, calendar: { ...balance.calendar, seasons } },
        };
      });
      try {
        const { buildYearChronicleMarkdown: render } = await import('./chronicle');
        const yearMs = seasons.reduce((sum, season) => sum + season.days * DAY_MS, 0);
        const rows: YearChronicleRow[] = [];
        let start = (year - 1) * yearMs;
        rows.push(row('marker', 'antes do ano', {}, start - 1));
        for (const season of seasons) {
          rows.push(row('marker', `primeiro instante: ${season.id}`, {}, start));
          start += season.days * DAY_MS;
          rows.push(row('marker', `último instante: ${season.id}`, {}, start - 1));
        }
        rows.push(row('marker', 'fim do ano', {}, start));
        rows.push(row('marker', 'depois do ano', {}, start + 1));
        const yearEnded: YearEndedData = {
          year,
          populationMax: 0,
          battles: 0,
          battlesWon: 0,
          expeditions: 0,
          cards: 0,
          siegeResult: 'victory',
          score: 0,
          feats: '',
        };
        const markdown = render('Pedra Alta', year, rows, yearEnded);
        expect(markdown).not.toContain('antes do ano');
        expect(markdown).not.toContain('depois do ano');
        seasons.forEach((season, index) => {
          const from = markdown.indexOf(`## ${season.label}\n`);
          const next = seasons[index + 1];
          const to = next === undefined ? markdown.length : markdown.indexOf(`## ${next.label}\n`);
          const section = markdown.slice(from, to);
          expect(section).toContain(`primeiro instante: ${season.id}`);
          expect(section).toContain(`último instante: ${season.id}`);
          for (const other of seasons.filter((entry) => entry.id !== season.id))
            expect(section).not.toContain(`: ${other.id}`);
          if (next === undefined) expect(section).toContain('fim do ano');
        });
      } finally {
        vi.doUnmock('@lotg/content');
        vi.resetModules();
      }
    },
  );
});
