import { describe, expect, it } from 'vitest';

import { type ChronicleRow, chronicleMarkdown } from './chronicleMarkdown';

const row = (kind: string, text: string, data: ChronicleRow['payload']['data'] = {}) => ({
  kind,
  payload: { text, data },
});

const planksAnswered = row('cardAnswered', 'No 3º dia da Primavera, o senhor cedeu madeira.', {
  cardId: 'commonGranaryPlanks',
  instanceId: 'commonGranaryPlanks-1',
  optionId: 'cede',
});
const shareDrawn = row('cardDrawn', 'No 5º dia da Primavera, o conselho voltou ao assunto.', {
  cardId: 'commonGranaryShare',
  instanceId: 'commonGranaryShare-2',
  source: 'continuation',
  previousCardId: 'commonGranaryPlanks',
  previousOptionId: 'cede',
  previousInstanceId: 'commonGranaryPlanks-1',
});

describe('Markdown da Crônica', () => {
  it('título, o ano 1 e a nota de que ainda não há nada a contar', () => {
    expect(chronicleMarkdown('Pedra Alta', [])).toBe(
      '# Crônica de Pedra Alta\n\n## Ano 1\n\n*Ainda não há nada a contar.*\n',
    );
  });

  it('uma linha por evento, na ordem, e um cabeçalho a cada ano que começa', () => {
    const markdown = chronicleMarkdown('Vila Nova', [
      row('constructionFinished', 'Os pedreiros ergueram as Habitações.'),
      row('yearStarted', 'Começa o ano 2 da Casa de Vila Nova.', { year: 2 }),
      row('seasonChanged', 'Chega a Primavera a Vila Nova.'),
    ]);
    expect(markdown.split('\n')).toEqual([
      '# Crônica de Vila Nova',
      '',
      '## Ano 1',
      '',
      '- Os pedreiros ergueram as Habitações.',
      '',
      '## Ano 2',
      '',
      '- Começa o ano 2 da Casa de Vila Nova.',
      '- Chega a Primavera a Vila Nova.',
      '',
    ]);
  });
});

describe('"Sua escolha voltou" (V2D-T4.3)', () => {
  it('a continuação cita, logo abaixo, a linha da escolha que a trouxe', () => {
    const markdown = chronicleMarkdown('Pedra Alta', [
      row('cardDrawn', 'No 3º dia da Primavera, o conselho pediu audiência.', {
        cardId: 'commonGranaryPlanks',
        instanceId: 'commonGranaryPlanks-1',
        source: 'draw',
      }),
      planksAnswered,
      row('constructionFinished', 'Os pedreiros ergueram as Habitações.'),
      shareDrawn,
    ]);
    expect(markdown.split('\n').slice(4)).toEqual([
      '- No 3º dia da Primavera, o conselho pediu audiência.',
      '- No 3º dia da Primavera, o senhor cedeu madeira.',
      '- Os pedreiros ergueram as Habitações.',
      '- No 5º dia da Primavera, o conselho voltou ao assunto.',
      '  - Sua escolha voltou: “No 3º dia da Primavera, o senhor cedeu madeira.”',
      '',
    ]);
    // Continua sendo uma linha por evento: a nota é recuada, não um item da lista.
    expect(markdown.split('\n').filter((line) => line.startsWith('- '))).toHaveLength(4);
  });

  it('quando quem escolheu foi o conselho, a nota diz isso', () => {
    const expired = row('cardExpired', 'Sem palavra do senhor, o conselho guardou as reservas.', {
      cardId: 'commonGranaryPlanks',
      instanceId: 'commonGranaryPlanks-1',
      optionId: 'keep',
    });
    expect(chronicleMarkdown('Pedra Alta', [expired, shareDrawn])).toContain(
      '\n  - A decisão do conselho voltou: “Sem palavra do senhor, o conselho guardou as reservas.”\n',
    );
  });

  it('liga pela ocorrência: a mesma carta respondida duas vezes não se confunde', () => {
    const again = row('cardAnswered', 'No 9º dia do Verão, o senhor pagou o conserto.', {
      cardId: 'commonGranaryPlanks',
      instanceId: 'commonGranaryPlanks-7',
      optionId: 'pay',
    });
    const markdown = chronicleMarkdown('Pedra Alta', [planksAnswered, again, shareDrawn]);
    expect(markdown).toContain('Sua escolha voltou: “No 3º dia da Primavera, o senhor cedeu');
    expect(markdown).not.toContain('voltou: “No 9º dia');
  });

  it('sem a linha da escolha (ainda não aconteceu, ou não é desta Crônica), não inventa nota', () => {
    // A continuação antes do desfecho, uma carta de sorteio e uma ocorrência desconhecida.
    const draw = row('cardDrawn', 'O conselho pediu audiência.', {
      cardId: 'masonsMeal',
      instanceId: 'masonsMeal-4',
      source: 'draw',
    });
    const orphan = row('cardDrawn', 'O conselho voltou a um assunto antigo.', {
      cardId: 'tollReturn',
      instanceId: 'tollReturn-9',
      source: 'continuation',
      previousInstanceId: 'toll-8',
    });
    const markdown = chronicleMarkdown('Pedra Alta', [shareDrawn, planksAnswered, draw, orphan]);
    expect(markdown).not.toContain('voltou: “');
    expect(markdown.split('\n').filter((line) => line.startsWith('  - '))).toEqual([]);
  });
});
