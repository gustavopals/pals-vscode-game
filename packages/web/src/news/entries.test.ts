import { describe, expect, it } from 'vitest';

import { compareNewsVersions, latestPublishedNews, NEWS_ENTRIES, newsForVersion } from './entries';

describe('crônicas das versões', () => {
  it('traz uma entrada por versão, em ordem decrescente, com data válida', () => {
    expect(NEWS_ENTRIES.map((entry) => entry.version)).toEqual([
      '0.4.0',
      '0.3.0',
      '0.2.0',
      '0.1.0',
    ]);
    expect(new Set(NEWS_ENTRIES.map((entry) => entry.version)).size).toBe(NEWS_ENTRIES.length);
    for (const entry of NEWS_ENTRIES) {
      expect(new Date(`${entry.date}T12:00:00Z`).toISOString().slice(0, 10)).toBe(entry.date);
      expect(entry.changes.length).toBeGreaterThan(0);
      // Só os metadados têm números. A crônica não congela custo, taxa, prazo ou porcentagem.
      expect([entry.title, entry.introduction, ...entry.changes].join(' ')).not.toMatch(/\d|%/);
    }
  });

  it('mantém a guerra como rascunho e não anuncia o Cerco como publicado', () => {
    expect(NEWS_ENTRIES[0]?.status).toBe('draft');
    expect(latestPublishedNews('0.4.0')?.version).toBe('0.3.0');
    expect(latestPublishedNews('0.3.0')?.version).toBe('0.3.0');
    expect(latestPublishedNews('0.2.1')?.version).toBe('0.2.0');
  });

  it.each([null, '', 'desconhecida', '0.4.0-rc.1', '0.0.0'])(
    'não acende selo sem publicação confirmada (%s)',
    (version) => {
      expect(latestPublishedNews(version)).toBeNull();
    },
  );

  it('usa a ordem numérica das versões e admite metadados do build', () => {
    expect(compareNewsVersions('0.10.0', '0.3.0')).toBeGreaterThan(0);
    expect(compareNewsVersions('0.3.0+reino', '0.3.0')).toBe(0);
    expect(compareNewsVersions('inválida', '0.3.0')).toBeNull();
    expect(latestPublishedNews('1.0.0')?.version).toBe('0.3.0');
  });

  it('mostra o histórico do reino e o rascunho identificado, sem inventar a versão offline', () => {
    expect(newsForVersion('0.2.0').map((entry) => entry.version)).toEqual([
      '0.4.0',
      '0.2.0',
      '0.1.0',
    ]);
    expect(newsForVersion(null)).toEqual(NEWS_ENTRIES);
  });
});
