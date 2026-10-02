import type { ComponentChild } from 'preact';
import { renderToString } from 'preact-render-to-string';
import { describe, expect, it } from 'vitest';

import type { Toast } from '../app/controller';
import { TOAST_TIMEOUT_MS, Toasts } from './Toasts';

const noop = () => {};
const html = (node: ComponentChild) => renderToString(<>{node}</>);
const render = (toasts: Toast[]) => html(<Toasts toasts={toasts} onDismiss={noop} />);

const toast = (overrides: Partial<Toast> = {}): Toast => ({
  id: 1,
  kind: 'info',
  text: 'A Fazenda chegou ao nível 2.',
  actions: [],
  sticky: false,
  ...overrides,
});

const tags = (markup: string, pattern: RegExp): string[] => markup.match(pattern) ?? [];
const attribute = (tag: string, name: string) =>
  new RegExp(`\\s${name}="([^"]*)"`).exec(tag)?.[1] ?? null;
const items = (markup: string) => tags(markup, /<div[^>]*class="toast toast-[a-z]+"[^>]*>/g);

describe('avisos no canto (Toasts)', () => {
  it('sem avisos, a região existe e fica vazia', () => {
    const markup = render([]);
    expect(markup).toMatch(/^<div[^>]*class="toasts"[^>]*aria-label="Avisos"[^>]*><\/div>$/);
    expect(items(markup)).toEqual([]);
    expect(markup).not.toContain('role="alert"');
    expect(markup).not.toContain('role="status"');
    expect(markup).not.toContain('<button');
  });

  it('um erro interrompe o leitor de tela (alert); o resto espera a vez (status)', () => {
    const roles = (kind: Toast['kind']) =>
      attribute(items(render([toast({ kind })]))[0] ?? '', 'role');
    expect(roles('error')).toBe('alert');
    expect(roles('warning')).toBe('status');
    expect(roles('info')).toBe('status');
  });

  it('cada tipo tem o seu ícone, além da cor', () => {
    for (const kind of ['info', 'warning', 'error'] as const) {
      const markup = render([toast({ kind })]);
      expect(items(markup)[0]).toContain(`toast-${kind}`);
      expect(markup).toMatch(
        new RegExp(`<span[^>]*class="codicon codicon-${kind}"[^>]*aria-hidden="true"`),
      );
    }
  });

  it('um aviso com ícone próprio o mostra no lugar do ícone do tom, sem perder o tom', () => {
    const cold = render([toast({ kind: 'warning', icon: 'flame' })]);
    expect(items(cold)[0]).toContain('toast-warning');
    expect(cold).toMatch(/<span[^>]*class="codicon codicon-flame"[^>]*aria-hidden="true"/);
    expect(cold).not.toContain('codicon-warning');
    const relief = render([toast({ kind: 'info', icon: 'flame' })]);
    expect(items(relief)[0]).toContain('toast-info');
    expect(relief).toContain('codicon-flame');
    expect(relief).not.toContain('codicon-info');
  });

  it('mostra o texto do aviso', () => {
    expect(render([toast()])).toContain('<span>A Fazenda chegou ao nível 2.</span>');
  });

  it('as frases que detalham o aviso viram uma lista, uma por linha, antes dos botões', () => {
    const markup = render([
      toast({
        icon: 'calendar',
        text: 'Verão à vista: chega em 1 h.',
        details: [
          'A produção de comida passa de × 1,2 para × 1.',
          'O recrutamento volta ao prazo de sempre.',
        ],
        actions: [{ label: 'Ver', run: noop }],
        sticky: true,
      }),
    ]);
    expect(markup).toContain(
      '<ul class="toast-details"><li>A produção de comida passa de × 1,2 para × 1.</li><li>O recrutamento volta ao prazo de sempre.</li></ul>',
    );
    expect(markup.indexOf('toast-details')).toBeGreaterThan(markup.indexOf('Verão à vista'));
    expect(markup.indexOf('toast-details')).toBeLessThan(markup.indexOf('toast-actions'));
    // Sem frases, não há lista vazia.
    expect(render([toast()])).not.toContain('toast-details');
    expect(render([toast({ details: [] })])).not.toContain('toast-details');
  });

  it('todo aviso pode ser dispensado por um botão com rótulo acessível', () => {
    const markup = render([toast(), toast({ id: 2, kind: 'error', text: 'Falhou.' })]);
    const dismiss = tags(markup, /<button[^>]*aria-label="Dispensar aviso"[^>]*>/g);
    expect(dismiss).toHaveLength(2);
    expect(dismiss.every((tag) => attribute(tag, 'type') === 'button')).toBe(true);
  });

  it('desenha um botão para cada ação do aviso, na ordem', () => {
    const markup = render([
      toast({
        kind: 'warning',
        text: 'A fome começou.',
        sticky: true,
        actions: [
          { label: 'Ver', run: noop },
          { label: 'Silenciar 2h', run: noop },
        ],
      }),
    ]);
    const labels = [
      ...markup.matchAll(/<button[^>]*class="secondary"[^>]*>([^<]*)<\/button>/g),
    ].map((match) => match[1]);
    expect(labels).toEqual(['Ver', 'Silenciar 2h']);
    // O botão de dispensar continua lá.
    expect(markup).toContain('aria-label="Dispensar aviso"');
  });

  it('aviso sem ações não desenha a área de botões', () => {
    const markup = render([toast()]);
    expect(markup).not.toContain('toast-actions');
    expect(tags(markup, /<button[^>]*>/g)).toHaveLength(1);
  });

  it('vários avisos aparecem do mais antigo para o mais novo', () => {
    const markup = render([
      toast({ id: 1, text: 'Primeiro.' }),
      toast({ id: 2, kind: 'warning', text: 'Segundo.' }),
      toast({ id: 3, kind: 'error', text: 'Terceiro.' }),
    ]);
    expect(items(markup)).toHaveLength(3);
    expect(markup.indexOf('Primeiro.')).toBeLessThan(markup.indexOf('Segundo.'));
    expect(markup.indexOf('Segundo.')).toBeLessThan(markup.indexOf('Terceiro.'));
  });

  it('o texto do aviso nunca vira marcação', () => {
    const markup = render([toast({ text: '<img src=x onerror=alert(1)> & cia' })]);
    expect(markup).not.toContain('<img');
    expect(markup).toContain('&lt;img src=x onerror=alert(1)> &amp; cia');
  });

  it('avisos sem botões somem sozinhos em alguns segundos, não na hora', () => {
    expect(TOAST_TIMEOUT_MS).toBeGreaterThanOrEqual(5000);
    expect(TOAST_TIMEOUT_MS).toBeLessThanOrEqual(15000);
  });
});
