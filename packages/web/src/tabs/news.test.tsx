import { renderToString } from 'preact-render-to-string';
import { describe, expect, it } from 'vitest';

import { NEWS_ENTRIES } from '../news/entries';
import { AboutTab } from './About';
import { NewsTab } from './News';

describe('aba Novidades', () => {
  it('desenha as crônicas em ordem, com títulos, datas e ações em palavras', () => {
    const html = renderToString(<NewsTab serverVersion="0.3.0" />);
    expect(html).toContain('aria-labelledby="news-title"');
    expect(html).toContain('id="news-title" tabindex="-1"');
    let previous = -1;
    for (const entry of NEWS_ENTRIES) {
      const position = html.indexOf(`v${entry.version}`);
      expect(position).toBeGreaterThan(previous);
      previous = position;
      expect(html).toContain(entry.title);
      expect(html).toContain(`datetime="${entry.date}"`);
      for (const change of entry.changes) expect(html).toContain(change);
    }
    expect(html).not.toMatch(/style=|<script|Visual Studio Code/);
  });

  it('identifica a guerra como preparação e a data como redação', () => {
    const html = renderToString(<NewsTab serverVersion="0.4.0" />);
    expect(html).toContain('Em preparação');
    expect(html).toContain('Rascunho de');
    expect(html).toContain('Esta versão ainda não foi publicada.');
    expect(html).toContain('nem tudo está disponível para jogar.');
    expect(html).toContain('Publicada em <time datetime="2026-10-15">15/10/2026</time>');
  });

  it('mantém o histórico sem confirmação do servidor e explica essa ausência', () => {
    const html = renderToString(<NewsTab serverVersion={null} />);
    expect(html).toContain('Não foi possível confirmar a versão deste reino.');
    expect(html).toContain('A Guilda');
    expect(html).toContain('Fundação do feudo');
  });

  it('oferece Novidades junto da Privacidade em Sobre, com selo por ler', () => {
    const actions = { order: () => {}, run: () => {}, playNow: () => {} };
    const html = renderToString(
      <AboutTab server={{ status: 'idle' }} actions={actions} unreadNews />,
    );
    expect(html).toContain('Novidades <span class="chip">novo</span>');
    expect(html).toContain('Privacidade');
  });
});
