import type { CurrentSeasonResponse, LeaderboardResponse } from '@lotg/protocol';
import { render } from 'preact-render-to-string';
import { describe, expect, it } from 'vitest';

import { catalogFixture, statsFixture } from '../test-helpers';
import { KingdomTab } from '../tabs/Kingdom';
import { SeasonCard, type SeasonCardProps } from './SeasonCard';

const week: CurrentSeasonResponse['season'] = {
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  code: '2026-W48',
  status: 'open',
  timezone: 'America/Sao_Paulo',
  difficulty: 'lord',
  timeScale: 3,
  startsAt: '2026-11-23T03:00:00Z',
  joinEndsAt: '2026-11-25T03:00:00Z',
  endsAt: '2026-11-30T02:59:00Z',
  rankingPublishedAt: null,
  joinOpen: true,
  seed: null,
};
const closed: CurrentSeasonResponse['season'] = { ...week, joinOpen: false, status: 'closed' };
const props: SeasonCardProps = {
  current: { status: 'ready', value: { season: week, game: null, joined: false } },
  ranking: { status: 'idle' },
  chronicle: null,
  options: catalogFixture().newGame,
  now: Date.parse('2026-11-25T02:59:30Z'),
  online: true,
  joining: false,
  joinError: null,
  viewingSeason: false,
  hasSeasonFief: false,
  actions: { run: () => {}, order: () => {}, playNow: () => {} },
};
const board: LeaderboardResponse = {
  season: closed,
  published: true,
  entries: [
    {
      position: 1,
      settlementName: 'Forte do Vale',
      score: 120,
      siegeOutcome: 'glorious',
      siegeOutcomeText: 'Vitória Gloriosa',
      feats: 3,
      mine: true,
      chronicleAvailable: true,
    },
    {
      position: 3,
      settlementName: 'Pedra Alta',
      score: 80,
      siegeOutcome: 'fall',
      siegeOutcomeText: 'Queda',
      feats: 1,
      mine: false,
      chronicleAvailable: false,
    },
  ],
  me: { position: 1, listed: true },
};

describe('Cartão da Temporada no Reino', () => {
  it('mostra os prazos do servidor e a entrada enquanto aberta, com ranking em espera', () => {
    const html = render(
      <KingdomTab
        signedIn
        stats={{ status: 'ready', value: statsFixture() }}
        season={props}
        actions={props.actions}
      />,
    );
    expect(html).toContain(week.code);
    expect(html).toContain('00:30');
    expect(html).toContain('Horário de Brasília');
    expect(html).toContain(week.endsAt);
    expect(html).toContain('Senhor');
    expect(html).toContain('3×');
    expect(html).toContain('Entrar na Temporada');
    expect(html).toContain('O ranking sai no fim da semana');
    expect(html).not.toContain('Ranking da Temporada 2026-W48');
    const expired = render(<SeasonCard {...props} now={Date.parse(week.joinEndsAt)} />);
    expect(expired).toContain('Entrada encerrada');
    expect(expired).not.toContain('Entrar na Temporada');
  });

  it('mostra a posição, os resultados e só oferece as Crônicas liberadas', () => {
    const html = render(
      <SeasonCard
        {...props}
        current={{ status: 'ready', value: { season: closed, joined: true, game: null } }}
        ranking={{ status: 'ready', value: board }}
      />,
    );
    expect(html).toContain('aria-current="true"');
    expect(html).toContain('Sua posição: 1º');
    expect(html).toContain('Vitória Gloriosa');
    expect(html).toContain('Pontuação');
    expect(html).toContain('Feitos');
    expect(html).toContain('Ler Crônica de Forte do Vale');
    expect(html).not.toContain('Ler Crônica de Pedra Alta');
    expect(html).not.toContain('O ranking sai no fim da semana');
  });

  it('mantém o ranking conhecido da semana anterior e respeita a saída do ranking', () => {
    const prior = { ...closed, id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', code: '2026-W47' };
    const html = render(
      <SeasonCard
        {...props}
        ranking={{
          status: 'ready',
          value: {
            ...board,
            season: prior,
            entries: [],
            me: { listed: false, position: 2 },
          },
        }}
      />,
    );
    expect(html).toContain('O ranking sai no fim da semana');
    expect(html).toContain('Ranking · 2026-W47');
    expect(html).toContain('fora do ranking (ficaria em 2º)');
    expect(html).toContain('Nenhum feudo listado');
  });

  it('renderiza o Markdown anual e escapa HTML no painel de leitura', () => {
    const html = render(
      <SeasonCard
        {...props}
        chronicle={{
          seasonId: week.id,
          position: 1,
          name: 'Forte do Vale',
          document: {
            status: 'ready',
            value: {
              position: 1,
              settlementName: 'Forte do Vale',
              markdown:
                '# Crônica do Forte\n\n## Fecho do ano\n\n| Feito | Pontos |\n| --- | --- |\n| Vigília | 12 |\n\n- **Vitória** <script>ameaça</script>',
            },
          },
        }}
      />,
    );
    expect(html).toContain('Fechar Crônica');
    expect(html).toContain('<h4>Crônica do Forte</h4>');
    expect(html).toContain('<table>');
    expect(html).toContain('<strong>Vitória</strong>');
    expect(html).toContain('&lt;script');
    expect(html).not.toContain('<script>');
  });
});
