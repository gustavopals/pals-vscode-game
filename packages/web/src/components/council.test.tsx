import type { GameEvent, ViewState } from '@lotg/protocol';
import type { ComponentChild } from 'preact';
import { renderToString } from 'preact-render-to-string';
import { describe, expect, it } from 'vitest';

import { CouncilTab } from '../tabs/Council';
import type { CouncilLog } from '../ui/council';
import {
  autumnView,
  councilView,
  gameEvent,
  goldenView,
  mealCard,
  shareCard,
  withCards,
} from '../test-helpers';
import type { Actions } from './actions';
import { CouncilCard } from './CouncilCard';
import { Today } from './Today';

const HOUR = 3600;
const noop = () => {};
const actions: Actions = { order: noop, run: noop, playNow: noop };
const html = (node: ComponentChild) => renderToString(<>{node}</>);

/** O texto sem as marcas; cada título, parágrafo, item e botão é um trecho à parte. */
const text = (markup: string) =>
  markup
    .replace(/<\/(h2|h3|p|li|button)>/g, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
const buttons = (markup: string) => markup.match(/<button[^>]*>/g) ?? [];
const choices = (markup: string) =>
  [...markup.matchAll(/<button([^>]*class="card-choice"[^>]*)>([^<]*)<\/button>/g)].map(
    (match) => ({ label: match[2] ?? '', disabled: /\sdisabled/.test(match[1] ?? '') }),
  );

type CardRow = ViewState['council']['pending'][number];
type VNodeLike = { type?: unknown; props?: Record<string, unknown> };

/** Aciona o botão com este texto, percorrendo a árvore de elementos sem um navegador. */
function click(node: unknown, label: string): void {
  if (Array.isArray(node)) {
    node.forEach((child) => click(child, label));
    return;
  }
  if (typeof node !== 'object' || node === null) {
    return;
  }
  const { type, props } = node as VNodeLike;
  if (typeof type === 'function') {
    click((type as (props: unknown) => unknown)(props), label);
    return;
  }
  if (type === 'button' && props?.children === label && props.disabled !== true) {
    (props.onClick as () => void)();
  }
  click(props?.children, label);
}

const card = (
  overrides: Partial<{
    card: CardRow;
    elapsed: number;
    readOnly: boolean;
    answering: boolean;
    actions: Actions;
  }> = {},
) => (
  <CouncilCard
    card={mealCard}
    elapsed={0}
    readOnly={false}
    answering={false}
    actions={actions}
    {...overrides}
  />
);

/** "Servir a refeição" com o que o teste trocar: o requisito que a tranca, o custo que falta. */
const withFeast = (patch: Partial<CardRow['options'][number]>): CardRow => ({
  ...mealCard,
  options: mealCard.options.map((option) =>
    option.id === 'feast' ? { ...option, ...patch } : option,
  ),
});

describe('CouncilCard', () => {
  it('é uma folha para ler: título, texto, opções e o que acontece sem resposta', () => {
    const markup = html(card());
    // Um artigo com o título da carta como nome.
    expect(markup).toMatch(
      /<article class="council-card" aria-labelledby="card-masonsMeal-4-title" aria-busy="false">/,
    );
    expect(markup).toMatch(/<h3 id="card-masonsMeal-4-title"[^>]*>A refeição dos pedreiros<\/h3>/);
    expect(markup).toContain(`<p class="card-text">${mealCard.text}</p>`);
    expect(text(markup)).toContain('Carta do Conselho Expira em 23 h');
    expect(markup).toContain(
      'Sem resposta até o fim do prazo, o conselho decide sozinho: repartir o pão do dia.',
    );
  });

  it('cada opção traz o verbo no botão e, ao lado, o custo com a consequência e a pista', () => {
    const markup = html(card());
    expect(choices(markup)).toEqual([
      { label: 'Servir a refeição', disabled: false },
      { label: 'Repartir o pão do dia', disabled: false },
      { label: 'Mandar voltar ao trabalho', disabled: false },
    ]);
    // O custo e a consequência conhecida, na frase do servidor; a pista, na voz do conselho.
    expect(markup).toContain(
      '<p class="card-effects">−40 comida; +10 de moral por 2 dias de jogo (1 h 20 min)</p>',
    );
    expect(markup).toContain('+15 pedra; −5 de moral por 2 dias de jogo (1 h 20 min)');
    expect(text(markup)).toContain('Barriga cheia, ânimo alto.');
    expect(text(markup)).toContain('A tarde rende mais pedra, e a obra guarda a mágoa.');
  });

  it('o botão aponta para o que ele custa: quem chega pelo teclado ouve o preço antes', () => {
    const markup = html(card());
    const about = /<button[^>]*aria-describedby="([^"]+)"[^>]*>Servir a refeição/.exec(markup)?.[1];
    expect(about).toBe('card-masonsMeal-4-option-feast');
    const described = new RegExp(`<div id="${about}"[^>]*>(.*?)</div>`).exec(markup)?.[1] ?? '';
    expect(described).toContain('−40 comida');
    expect(described).toContain('Barriga cheia, ânimo alto.');
    // Cada opção tem a sua descrição.
    const ids = [...markup.matchAll(/aria-describedby="([^"]+)"/g)].map((match) => match[1]);
    expect(new Set(ids).size).toBe(3);
  });

  it('a opção que o conselho aplica sozinho é dita por extenso, com ícone, e só nela', () => {
    const markup = html(card());
    expect(markup.match(/Sem resposta, é isto que o conselho faz\./g)).toHaveLength(1);
    const bread = /id="card-masonsMeal-4-option-bread"[^>]*>(.*?)<\/div>/.exec(markup)?.[1] ?? '';
    expect(bread).toContain('Sem resposta, é isto que o conselho faz.');
    expect(bread).toContain('codicon-watch');
  });

  it('clicar em uma opção manda a carta e a opção pelo comando único', () => {
    const calls: Array<[string, unknown]> = [];
    const spy: Actions = { ...actions, run: (id, arg) => calls.push([id, arg]) };
    click(card({ actions: spy }), 'Mandar voltar ao trabalho');
    expect(calls).toEqual([
      ['lords.answerCard', { instanceId: 'masonsMeal-4', optionId: 'refuse' }],
    ]);
  });

  it('opção trancada: o botão fica desabilitado e o requisito aparece, com cadeado', () => {
    const locked = withFeast({ locked: true, lockedReason: 'Requer 100 de comida em estoque.' });
    const markup = html(card({ card: locked }));
    expect(choices(markup)[0]).toEqual({ label: 'Servir a refeição', disabled: true });
    expect(
      choices(markup)
        .slice(1)
        .every((choice) => !choice.disabled),
    ).toBe(true);
    expect(markup).toMatch(
      /<p class="card-block warning"><span class="codicon codicon-lock"[^>]*><\/span> Requer 100 de comida em estoque\.<\/p>/,
    );
    expect(markup).toContain('card-option card-option-blocked');
    // O botão desabilitado não manda nada.
    const calls: unknown[] = [];
    click(
      card({ card: locked, actions: { ...actions, run: (id) => calls.push(id) } }),
      'Servir a refeição',
    );
    expect(calls).toEqual([]);
  });

  it('custo impagável: o botão fica desabilitado e a carta diz o que falta', () => {
    const poor = withFeast({
      affordable: false,
      cost: [{ resource: 'food', label: 'Comida', amount: 40, missing: 12 }],
    });
    const markup = html(card({ card: poor }));
    expect(choices(markup)[0]).toEqual({ label: 'Servir a refeição', disabled: true });
    expect(markup).toMatch(
      /<p class="card-block warning"><span class="codicon codicon-warning"[^>]*><\/span> Faltam 12 de comida\.<\/p>/,
    );
  });

  it('com a resposta a caminho, todos os botões ficam desabilitados e a carta diz que está levando', () => {
    const markup = html(card({ answering: true }));
    expect(markup).toContain('aria-busy="true"');
    expect(choices(markup).every((choice) => choice.disabled)).toBe(true);
    expect(markup).toMatch(
      /<p class="card-foot" role="status">.*Levando a sua decisão ao conselho…/,
    );
    // Fora do envio, nada disso.
    expect(html(card())).not.toContain('Levando a sua decisão');
  });

  it('sem ligação a carta se lê, mas não se responde', () => {
    const markup = html(card({ readOnly: true }));
    expect(choices(markup).every((choice) => choice.disabled)).toBe(true);
    expect(markup).toContain(mealCard.text);
    expect(markup).toContain(mealCard.expiryNote);
  });

  it('o prazo desce com o relógio da página e, perto do fim, ganha o sinal de aviso', () => {
    const fresh = html(card({ card: { ...mealCard, expiresInSeconds: 24 * HOUR } }));
    expect(fresh).toMatch(/<span class="card-deadline"><span class="codicon codicon-watch"/);
    expect(text(fresh)).toContain('Expira em 24 h');
    const soon = html(
      card({ card: { ...mealCard, expiresInSeconds: 24 * HOUR }, elapsed: 21 * HOUR }),
    );
    expect(soon).toMatch(
      /<span class="card-deadline warning"><span class="codicon codicon-warning"/,
    );
    expect(text(soon)).toContain('Expira em 3 h');
  });

  it('com o prazo vencido nesta página, avisa e não deixa enviar', () => {
    const markup = html(card({ card: { ...mealCard, expiresInSeconds: 600 }, elapsed: 600 }));
    expect(text(markup)).toContain('Prazo encerrado');
    expect(choices(markup).every((choice) => choice.disabled)).toBe(true);
    expect(markup).toMatch(
      /<p class="card-foot warning" role="status">.*O prazo acabou: o conselho está decidindo sozinho/,
    );
    expect(markup).not.toContain(mealCard.expiryNote);
  });

  it('a continuação diz de onde a história vem, na frase do servidor', () => {
    const markup = html(card({ card: shareCard }));
    expect(markup).toMatch(/<p class="card-follows muted"><span class="codicon codicon-history"/);
    expect(markup).toContain(
      'A história continua: em &quot;Tábuas para as reservas&quot;, a decisão foi ceder a madeira.',
    );
    // A carta do sorteio não tem esse trecho.
    expect(html(card())).not.toContain('card-follows');
  });

  it('sem estilo embutido: a política de conteúdo da página não deixa', () => {
    expect(html(card())).not.toMatch(/\sstyle=/);
  });
});

describe('aba Conselho', () => {
  /** O registro lido até o começo da Crônica: sem linha, o conselho não registrou nada mesmo. */
  const readAll = (lines: GameEvent[] = []): CouncilLog => ({
    status: 'ready',
    lines,
    complete: true,
  });
  const tab = (
    overrides: Partial<{
      view: ViewState;
      elapsed: number;
      online: boolean;
      answering: ReadonlySet<string>;
      record: CouncilLog;
      actions: Actions;
    }> = {},
  ) => (
    <CouncilTab
      view={councilView}
      elapsed={0}
      online={true}
      retryInSeconds={null}
      answering={new Set()}
      record={readAll()}
      actions={actions}
      {...overrides}
    />
  );
  const cards = (markup: string) => markup.match(/<article class="council-card"/g) ?? [];

  it('sem cartas: "nada a tratar" e quando é a próxima audiência', () => {
    const markup = html(tab({ view: goldenView, elapsed: 5 * HOUR + 50 * 60 }));
    expect(cards(markup)).toHaveLength(0);
    expect(text(markup)).toContain('Conselho do Feudo O conselho não tem nada a tratar agora.');
    expect(text(markup)).toContain('Próxima audiência em 2 h 10 min.');
    // A regra em uma frase, como o servidor a escreveu para o ritmo da partida.
    expect(markup).toContain(goldenView.council.rulesText);
    // Sem cartas não há custo a comparar: a linha do estoque não aparece.
    expect(markup).not.toContain('Em estoque:');
  });

  it('sem assunto para o feudo como ele está, diz isso em vez de prometer carta', () => {
    const markup = text(html(tab({ view: autumnView })));
    expect(markup).toContain('O conselho não tem nada a tratar agora.');
    expect(markup).toContain(
      'O conselho não tem assunto novo para o feudo como ele está: a próxima audiência não traz carta.',
    );
  });

  it('uma carta: a carta, o estoque ao lado dos custos e a próxima audiência', () => {
    const markup = html(tab({ view: withCards(goldenView, [mealCard]) }));
    expect(cards(markup)).toHaveLength(1);
    expect(text(markup)).toContain('Conselho do Feudo · 1 carta pendente');
    expect(text(markup)).toContain('Em estoque: 180 comida · 120 madeira · 65 pedra · 270 ouro.');
    expect(text(markup)).toContain('Próxima audiência em 8 h.');
    expect(markup).not.toContain('o conselho não traz outra');
  });

  it('duas cartas: as duas, na ordem em que chegaram, e o conselho espera uma resposta antes de trazer outra', () => {
    const markup = html(tab());
    expect(cards(markup)).toHaveLength(2);
    expect(text(markup)).toContain('Conselho do Feudo · 2 cartas pendentes');
    expect(markup.indexOf('A vez de repartir')).toBeLessThan(
      markup.indexOf('A refeição dos pedreiros'),
    );
    expect(text(markup)).toContain(
      'Com 2 cartas à espera, o conselho não traz outra: responda uma antes da próxima audiência para ela trazer novidade. Próxima audiência em 2 h 34 min.',
    );
  });

  it('só a carta com resposta a caminho fica ocupada', () => {
    const markup = html(tab({ answering: new Set(['masonsMeal-4']) }));
    const busy = [...markup.matchAll(/aria-labelledby="(card-[^"]+)-title" aria-busy="(\w+)"/g)];
    expect(busy.map((match) => [match[1], match[2]])).toEqual([
      ['card-commonGranaryShare-3', 'false'],
      ['card-masonsMeal-4', 'true'],
    ]);
    const disabled = choices(markup).map((choice) => choice.disabled);
    expect(disabled).toEqual([false, false, true, true, true]);
  });

  it('sem ligação: modo leitura, pelo último estado conhecido', () => {
    const markup = html(tab({ online: false }));
    expect(text(markup)).toContain('Sem ligação com o reino.');
    expect(text(markup)).toContain(
      'Sem ligação com o reino: as cartas e os prazos são os do último estado conhecido do feudo. Dá para ler; para responder, é preciso a ligação.',
    );
    expect(cards(markup)).toHaveLength(2);
    expect(choices(markup).every((choice) => choice.disabled)).toBe(true);
    // Sem cartas e sem ligação, a frase não afirma o que o conselho tem agora.
    const empty = text(html(tab({ view: goldenView, online: false })));
    expect(empty).toContain('No último estado conhecido, o conselho não tinha nada a tratar.');
    expect(empty).not.toContain('O conselho não tem nada a tratar agora.');
    // Com ligação, nenhum dos dois avisos.
    expect(html(tab())).not.toContain('council-stale');
  });

  it('o que o conselho registrou: as linhas das cartas na Crônica, da mais nova para a mais antiga', () => {
    const chronicle = [
      gameEvent(1, 'cardDrawn', 'O conselho pediu audiência: O poço entulhado.'),
      gameEvent(2, 'constructionFinished', 'Os pedreiros ergueram a Fazenda.'),
      gameEvent(3, 'cardAnswered', 'O senhor cedeu pedra para o poço da praça.'),
    ];
    const markup = html(tab({ view: goldenView, record: readAll(chronicle) }));
    const record = /<ul class="chronicle" aria-live="polite">(.*?)<\/ul>/.exec(markup)?.[1] ?? '';
    expect(record.match(/<li>[^<]*<\/li>/g)).toEqual([
      '<li>O senhor cedeu pedra para o poço da praça.</li>',
      '<li>O conselho pediu audiência: O poço entulhado.</li>',
    ]);
    expect(buttons(markup).length).toBeGreaterThan(0);
    expect(text(markup)).toContain('Abrir a Crônica inteira');
    // Sem nenhuma linha, a seção diz o que vai aparecer ali.
    expect(text(html(tab({ view: goldenView })))).toContain(
      'O que o conselho registrou Nada ainda.',
    );
  });

  it('o registro sem linha diz por quê: "Nada ainda" só quando a leitura chegou ao começo da Crônica', () => {
    const section = (record: CouncilLog, online = true) =>
      text(
        /<section aria-labelledby="council-record-title">.*?<\/section>/.exec(
          html(tab({ record, online })),
        )?.[0] ?? '',
      );
    // As linhas do conselho ficaram antes do trecho lido: o que ele registrou está na Crônica.
    const beyond = section({ status: 'ready', lines: [], complete: false });
    expect(beyond).toBe(
      'O que o conselho registrou As linhas mais recentes da Crônica não falam do conselho. O que ele registrou antes está na Crônica inteira. Abrir a Crônica inteira',
    );
    // A leitura falhou: a seção não afirma que não há nada.
    const failed = section({ status: 'error', lines: [], complete: false });
    expect(failed).toBe(
      'O que o conselho registrou Não deu para ler agora o que o conselho registrou. Está tudo na Crônica inteira. Abrir a Crônica inteira',
    );
    // A página abriu sem ligação: a Crônica não foi lida.
    expect(section({ status: 'idle', lines: [], complete: false }, false)).toBe(
      'O que o conselho registrou Sem ligação com o reino: o que o conselho registrou vem da Crônica, que é lida com a ligação.',
    );
    expect(section({ status: 'loading', lines: [], complete: false })).toBe(
      'O que o conselho registrou Lendo o que o conselho registrou…',
    );
    const unread: CouncilLog[] = [
      { status: 'ready', lines: [], complete: false },
      { status: 'error', lines: [], complete: false },
      { status: 'idle', lines: [], complete: false },
      { status: 'loading', lines: [], complete: false },
    ];
    for (const record of unread) {
      expect(section(record)).not.toContain('Nada ainda');
    }
    // Com linhas, elas aparecem, venha a leitura como vier.
    const line = gameEvent(30, 'cardAnswered', 'O senhor cedeu pedra para o poço da praça.');
    expect(section({ status: 'error', lines: [line], complete: false })).toBe(
      'O que o conselho registrou O senhor cedeu pedra para o poço da praça. Abrir a Crônica inteira',
    );
  });

  it('tem o cabeçalho do feudo, com a moral: é ela que as cartas mexem', () => {
    const markup = html(tab());
    expect(markup).toMatch(/<h1>Pedra Alta<\/h1>/);
    expect(markup).toContain('class="morale"');
  });

  it('sem estilo embutido', () => {
    expect(html(tab())).not.toMatch(/\sstyle=/);
  });
});

describe('aba Hoje: decisões pendentes (GDD §2.3 e §13.3)', () => {
  const section = (markup: string) =>
    /<section aria-labelledby="decisions-title">.*?<\/section>/.exec(markup)?.[0] ?? '';
  const today = (view: ViewState, overrides: Partial<{ elapsed: number; online: boolean }> = {}) =>
    html(<Today report={null} view={view} actions={actions} {...overrides} />);

  it('sem nenhuma, diz quando o conselho volta a se reunir e leva a ele', () => {
    const markup = section(today(goldenView));
    expect(text(markup)).toBe(
      'Decisões pendentes Nenhuma por agora. Próxima audiência em 8 h. Ver o Conselho',
    );
  });

  it('uma linha por carta, da que vence primeiro à última, com o prazo e o botão "Decidir"', () => {
    const view = withCards(goldenView, [
      { ...shareCard, expiresInSeconds: 20 * HOUR },
      { ...mealCard, expiresInSeconds: 14 * HOUR },
    ]);
    const markup = section(today(view));
    expect(text(markup)).toBe(
      'Decisões pendentes (2) ' +
        'Conselho: “A refeição dos pedreiros” · expira em 14 h Decidir ' +
        'Conselho: “A vez de repartir” · expira em 20 h Decidir',
    );
    expect(markup).toMatch(/<button[^>]*aria-label="Decidir: A refeição dos pedreiros"/);
    // O prazo desce com o relógio da página.
    expect(text(section(today(view, { elapsed: 4 * HOUR })))).toContain('expira em 10 h');
  });

  it('"Decidir" leva à aba do Conselho, onde a carta se lê inteira', () => {
    const calls: Array<[string, unknown]> = [];
    const spy: Actions = { ...actions, run: (id, arg) => calls.push([id, arg]) };
    click(
      <Today report={null} view={withCards(goldenView, [mealCard])} actions={spy} />,
      'Decidir',
    );
    expect(calls).toEqual([['lords.openPanel', 'council']]);
  });

  it('o prazo que acaba antes de uma ausência comum ganha o sinal de aviso, com palavra', () => {
    const soon = section(
      today(withCards(goldenView, [{ ...mealCard, expiresInSeconds: 3 * HOUR }])),
    );
    expect(soon).toContain('leaving-item leaving-warning');
    expect(soon).toContain('codicon-warning');
    expect(soon).toContain('<span class="sr-only">Atenção: </span>');
    const calm = section(today(withCards(goldenView, [mealCard])));
    expect(calm).toContain('leaving-item leaving-info');
    expect(calm).toContain('codicon-law');
    expect(calm).not.toContain('Atenção');
  });

  it('sem ligação, avisa que as cartas e os prazos são os do último estado conhecido', () => {
    const offline = text(section(today(councilView, { online: false })));
    expect(offline).toContain(
      'Sem ligação com o reino: as cartas e os prazos são os do último estado conhecido do feudo.',
    );
    expect(text(section(today(councilView)))).not.toContain('Sem ligação');
  });
});
