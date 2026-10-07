import type { ViewState } from '@lotg/protocol';
import type { ComponentChild } from 'preact';
import { renderToString } from 'preact-render-to-string';
import { describe, expect, it } from 'vitest';

import { buildReturnReport } from '../game/returnReport';
import { GuildTab } from '../tabs/Guild';
import {
  gameEvent,
  guildArrearsView,
  guildPaidView,
  heroPromisedView,
  initialView,
  tavernBusyView,
  tavernOpenView,
  withWage,
} from '../test-helpers';
import type { Actions } from './actions';
import { Header } from './Header';
import { HeroesPanel } from './HeroesPanel';
import { ResourcesTable } from './ResourcesTable';
import { TavernPanel } from './TavernPanel';
import { Today } from './Today';

/**
 * A aba Guilda (roadmap da v0.3, V3C-T4): os heróis, o soldo, o atraso e a Taverna, desenhados
 * com as visões do golden do motor. O app só dispõe o que veio: cada preço, prazo e motivo
 * conferido aqui é o da visão.
 */

const noop = () => {};
const actions: Actions = { order: noop, run: noop, playNow: noop };
const html = (node: ComponentChild) => renderToString(<>{node}</>);
const text = (markup: string) =>
  markup
    .replace(/<\/(h1|h2|h3|p|li|button|div)>/g, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
const buttons = (markup: string) =>
  [...markup.matchAll(/<button([^>]*)>(.*?)<\/button>/g)].map((match) => ({
    label: (match[2] ?? '').replace(/<[^>]+>/g, ''),
    disabled: /\sdisabled/.test(match[1] ?? ''),
    describedBy: /aria-describedby="([^"]+)"/.exec(match[1] ?? '')?.[1] ?? null,
  }));
const NONE: ReadonlySet<string> = new Set();

const heroes = (
  view: ViewState,
  overrides: Partial<{
    disabled: boolean;
    busy: ReadonlySet<string>;
    actions: Actions;
    elapsed: number;
  }> = {},
) =>
  html(
    <HeroesPanel
      view={view}
      elapsed={0}
      disabled={false}
      busy={NONE}
      actions={actions}
      {...overrides}
    />,
  );
const tavern = (
  view: ViewState,
  overrides: Partial<{
    disabled: boolean;
    busy: ReadonlySet<string>;
    actions: Actions;
    elapsed: number;
  }> = {},
) =>
  html(
    <TavernPanel
      view={view}
      elapsed={0}
      disabled={false}
      busy={NONE}
      actions={actions}
      {...overrides}
    />,
  );
const tab = (view: ViewState, online = true) =>
  html(
    <GuildTab
      view={view}
      elapsed={0}
      online={online}
      retryInSeconds={online ? null : 30}
      busy={NONE}
      actions={actions}
    />,
  );

type Call = [string, unknown];
/** As ordens que os botões de um painel mandam, na ordem em que aparecem. */
function clicks(render: (actions: Actions) => ComponentChild): Call[] {
  const calls: Call[] = [];
  const spy: Actions = { order: noop, playNow: noop, run: (id, arg) => calls.push([id, arg]) };
  const walk = (node: unknown): void => {
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    if (typeof node !== 'object' || node === null) {
      return;
    }
    const vnode = node as { type?: unknown; props?: Record<string, unknown> };
    if (typeof vnode.type === 'function') {
      walk((vnode.type as (props: unknown) => unknown)(vnode.props));
      return;
    }
    if (vnode.type === 'button' && typeof vnode.props?.onClick === 'function') {
      (vnode.props.onClick as () => void)();
    }
    walk(vnode.props?.children);
  };
  walk(render(spy));
  return calls;
}

describe('painel dos heróis (GDD §9.1 e §13.1)', () => {
  it('sem herói e sem Taverna: a frase do servidor diz como o primeiro chega, sem data, e não há soldo nem lista', () => {
    const markup = heroes(initialView);
    // O painel vazio chama-se "Heróis", e quem diz que não há nenhum é a frase do servidor,
    // logo abaixo: "Heróis · nenhum herói" dizia a mesma coisa duas vezes (decisão Q2).
    expect(markup).toContain('<h2 id="heroes-title">Heróis</h2>');
    expect(text(markup)).not.toContain('nenhum herói');
    expect(markup).toContain(initialView.guild.text);
    expect(markup).toContain('guild-empty');
    expect(text(markup)).not.toContain('Soldo');
    expect(buttons(markup)).toEqual([]);
  });

  it('a ficha de cada herói: nome, classe, nível e traços em uma linha; poder com a conta, experiência, soldo e estado', () => {
    const markup = heroes(guildPaidView);
    const sheet = text(markup);
    expect(sheet).toContain('Heróis · 3 heróis');
    expect(sheet).toContain('Edda · Guerreira · Nv1 · Leal');
    expect(sheet).toContain('Isolda · Maga · Nv2 · Veterana');
    // A explicação de cada traço e a conta do poder são as do servidor, ao alcance do teclado.
    for (const hero of guildPaidView.guild.heroes) {
      expect(markup).toContain(`data-tip="${hero.powerBreakdown}"`);
      for (const trait of hero.traits) {
        expect(markup).toContain(`data-tip="${trait.text}"`);
      }
    }
    expect(sheet).toContain('Poder 42');
    expect(sheet).toContain('XP 0/100 · Soldo 6/h · No feudo');
    // O soldo cresce com o nível: a ficha diz quanto ele sobe, na frase do servidor.
    for (const hero of guildPaidView.guild.heroes) {
      if (hero.wageNextLevelText !== null) {
        expect(sheet).toContain(hero.wageNextLevelText);
      }
    }
    expect(sheet).toContain('Poder 37,8');
    expect(sheet).toContain('XP 0/282');
    // Com equipe, a frase do alto diz que ainda não há para onde mandá-la.
    expect(markup).toContain(guildPaidView.guild.text);
  });

  it('o soldo em horas: quanto a equipe custa e por quanto tempo o ouro ainda a paga', () => {
    const sheet = text(heroes(guildPaidView));
    expect(sheet).toContain('Soldo da equipe: 21/h de ouro. O ouro paga a equipe por mais 23 h.');
    // O prazo desce com o relógio da página.
    expect(text(heroes(guildPaidView, { elapsed: 2 * 3600 }))).toContain('por mais 21 h.');
    // Sem prazo na visão, o ouro não acaba.
    expect(text(heroes(tavernOpenView))).toContain('O ouro paga a equipe sem prazo');
  });

  it('o soldo em atraso: há quanto tempo, os prazos das consequências com os números da visão, a frase do servidor e o botão da Mina', () => {
    const markup = heroes(guildArrearsView);
    const sheet = text(markup);
    const arrears = guildArrearsView.guild.wage.arrears;
    expect(arrears).not.toBeNull();
    expect(sheet).toContain('Soldo em atraso há 26 h.');
    expect(sheet).toContain('Um herói parte em 47 min.');
    // Ninguém mais a ficar descontente: a visão não traz o prazo, e a tela não o inventa.
    expect(sheet).not.toContain('Descontentes em');
    expect(markup).toContain(arrears?.text ?? '');
    expect(markup).toContain('banner-warning');
    // O descontente tem ícone e palavra.
    expect(sheet).toContain('Rolf · Arqueiro · Nv1 · Prudente');
    expect(markup).toMatch(/codicon-warning[^>]*><\/span> Descontente/);
    expect(buttons(markup).map((button) => button.label)).toEqual([
      'Alocar na Mina de Ouro',
      'Dispensar Edda',
      'Dispensar Rolf',
    ]);
    // Com os dois prazos na visão, a tela mostra os dois.
    const both: ViewState = {
      ...guildArrearsView,
      guild: {
        ...guildArrearsView.guild,
        wage: {
          ...guildArrearsView.guild.wage,
          arrears:
            arrears === null
              ? null
              : {
                  ...arrears,
                  discontentInSeconds: 3 * 3600 + 5,
                  nextDepartureInSeconds: 7 * 3600 + 5,
                },
        },
      },
    };
    expect(text(heroes(both))).toContain('Descontentes em 3 h · Um herói parte em 7 h.');
  });

  it('o herói prometido por uma carta: quem é e em quanto tempo chega; à porta, o que o impede', () => {
    expect(heroes(heroPromisedView)).toContain('<h2 id="heroes-title">Heróis</h2>');
    const sheet = text(heroes(heroPromisedView));
    expect(sheet).toContain(heroPromisedView.guild.text);
    expect(sheet).toContain('Rolf · Arqueiro · Prudente');
    expect(sheet).toContain('A caminho: chega em 1 h 27 min.');
    const [promised] = heroPromisedView.guild.arriving;
    if (promised === undefined) {
      throw new Error('O golden deixou de ter um herói a caminho.');
    }
    const waiting: ViewState = {
      ...heroPromisedView,
      guild: {
        ...heroPromisedView.guild,
        arriving: [
          {
            ...promised,
            arrivesInSeconds: 0,
            blockedReason: 'O feudo já abriga 6 heróis: Rolf espera à porta.',
          },
        ],
      },
    };
    const blocked = text(heroes(waiting));
    expect(blocked).toContain('A caminho: à porta.');
    expect(blocked).toContain('O feudo já abriga 6 heróis: Rolf espera à porta.');
  });

  // Revisão da Fase C (A-R1): o painel diz o que o soldo vira com quem está a caminho, mesmo
  // sem ninguém no feudo, e alerta quando o ouro não o paga por um dia.
  it('o soldo de quem está a caminho: quanto passa a custar e por quanto tempo o ouro paga; curto, é alerta com o botão da Mina', () => {
    const calm = heroes(heroPromisedView);
    expect(text(calm)).toContain(
      'Com quem está a caminho, o soldo passa a 2/h de ouro: o ouro paga a equipe por mais 6 dias.',
    );
    expect(calm).not.toContain('banner-warning');
    const broke = withWage(heroPromisedView, {
      afterArrivals: { perHour: 2, coveredForSeconds: 3 * 3600 },
    });
    const markup = heroes(broke);
    expect(markup).toContain('banner-warning');
    expect(text(markup)).toContain('o ouro paga a equipe por mais 3 h.');
    expect(buttons(markup).map((button) => button.label)).toContain('Alocar na Mina de Ouro');
    expect(
      clicks((spy) => (
        <HeroesPanel view={broke} elapsed={0} disabled={false} busy={NONE} actions={spy} />
      )),
    ).toContainEqual(['lords.allocateWorkers', 'goldMine']);
  });

  it('o atraso fechado que ainda cobra uma partida: o painel diz quem parte e em quanto tempo', () => {
    const view = withWage(guildPaidView, {
      lingering: {
        text: 'O soldo voltou a ser pago, mas Isolda parte na próxima virada do dia.',
        departureInSeconds: 40 * 60,
      },
    });
    const markup = heroes(view);
    expect(markup).toContain('banner-warning');
    expect(text(markup)).toContain(
      'O soldo voltou a ser pago, mas Isolda parte na próxima virada do dia. A virada vem em 40 min.',
    );
    expect(heroes(guildPaidView)).not.toContain('banner-warning');
  });

  it('"Dispensar" manda o comando com o herói (que confirma antes); sem ligação e com a ordem a caminho, fica desabilitado', () => {
    expect(
      clicks((spy) => (
        <HeroesPanel view={tavernOpenView} elapsed={0} disabled={false} busy={NONE} actions={spy} />
      )),
    ).toEqual([['lords.dismissHero', { heroId: 'hero-1' }]]);
    expect(
      buttons(heroes(tavernOpenView, { disabled: true })).every((button) => button.disabled),
    ).toBe(true);
    const busy = heroes(tavernOpenView, { busy: new Set(['dismiss:hero-1']) });
    expect(buttons(busy)).toMatchObject([{ label: 'Dispensar Edda', disabled: true }]);
    expect(busy).toContain('aria-busy');
  });
});

describe('painel da Taverna (GDD §6.1 e §9.1)', () => {
  it('sem a Taverna: a frase do servidor, a obra com o custo e o que a impede, e nenhum candidato', () => {
    const markup = tavern(initialView);
    const sheet = text(markup);
    expect(sheet).toContain(initialView.tavern.text);
    const upgrade = initialView.constructions.available.find(
      (entry) => entry.building === 'tavern',
    );
    expect(upgrade?.blockedReason).not.toBeNull();
    expect(sheet).toContain(upgrade?.blockedReason ?? '');
    expect(buttons(markup)).toMatchObject([{ label: 'Construir Taverna', disabled: true }]);
    expect(sheet).not.toContain('Festival');
  });

  it('os candidatos: a ficha, o preço de agora, o soldo por hora e quando a lista troca', () => {
    const markup = tavern(tavernOpenView);
    const sheet = text(markup);
    expect(sheet).toContain(tavernOpenView.tavern.text);
    expect(sheet).toContain('Mécia · Arqueira · Nv1 · Gananciosa');
    expect(sheet).toContain('80 de ouro · soldo de 6/h');
    expect(sheet).toContain('Gonçalo · Clérigo · Nv1 · Devoto');
    expect(sheet).toContain('130 de ouro · soldo de 6/h');
    expect(sheet).toContain('A lista de candidatos troca em 7 h 47 min.');
    const hire = buttons(markup).filter((button) => button.label.startsWith('Contratar'));
    expect(hire).toMatchObject([
      { label: 'Contratar Mécia', disabled: false, describedBy: 'offer-offer-1-about' },
      { label: 'Contratar Gonçalo', disabled: false, describedBy: 'offer-offer-2-about' },
    ]);
    expect(markup).toContain('id="offer-offer-1-about"');
  });

  it('bloqueada, a contratação diz o motivo do servidor e o botão não aperta; o preço com desconto vem por extenso', () => {
    const markup = tavern(tavernBusyView);
    const sheet = text(markup);
    const [offer] = tavernBusyView.tavern.offers;
    expect(sheet).toContain('80 de ouro: 100, menos 20% por Mécia, Carismática · soldo de 2/h');
    expect(sheet).toContain(offer?.blockedReason ?? '—');
    expect(markup).toContain('codicon-lock');
    expect(
      buttons(markup)
        .filter((button) => button.label.startsWith('Contratar'))
        .every((button) => button.disabled),
    ).toBe(true);
  });

  it('o festival: custo, efeito e "um por estação" na frase do servidor; em curso e bloqueado, o prazo e o motivo', () => {
    const open = tavern(tavernOpenView);
    expect(text(open)).toContain('Festival · 100 comida, 50 ouro');
    expect(text(open)).toContain(tavernOpenView.tavern.festival.effectText);
    expect(tavernOpenView.tavern.festival.effectText).toContain('Um festival por estação');
    expect(buttons(open).at(-1)).toMatchObject({
      label: 'Dar um festival',
      disabled: false,
      describedBy: 'festival-terms',
    });
    const busy = tavern(tavernBusyView);
    expect(text(busy)).toContain('Festival em curso: a moral o conta por mais 25 min.');
    expect(text(busy)).toContain('Um festival por estação: no Verão o feudo já festejou.');
    expect(buttons(busy).at(-1)).toMatchObject({ label: 'Dar um festival', disabled: true });
  });

  it('os botões mandam os comandos da paleta: contratar com a oferta, e o festival já confirmado (o custo está ao lado)', () => {
    expect(
      clicks((spy) => (
        <TavernPanel view={tavernOpenView} elapsed={0} disabled={false} busy={NONE} actions={spy} />
      )),
    ).toEqual([
      ['lords.hireHero', { offerId: 'offer-1' }],
      ['lords.hireHero', { offerId: 'offer-2' }],
      ['lords.holdFestival', { confirmed: true }],
    ]);
    expect(
      clicks((spy) => (
        <TavernPanel view={initialView} elapsed={0} disabled={false} busy={NONE} actions={spy} />
      )),
    ).toEqual([['lords.build', 'tavern']]);
  });

  it('com a ordem a caminho, o botão dela fica ocupado; sem ligação, todos', () => {
    const hiring = buttons(tavern(tavernOpenView, { busy: new Set(['hire:offer-1']) }));
    expect(hiring.map((button) => button.disabled)).toEqual([true, false, false]);
    const feast = buttons(tavern(tavernOpenView, { busy: new Set(['festival']) }));
    expect(feast.map((button) => button.disabled)).toEqual([false, false, true]);
    expect(
      buttons(tavern(tavernOpenView, { disabled: true })).every((button) => button.disabled),
    ).toBe(true);
  });
});

describe('aba Guilda', () => {
  it('tem o cabeçalho do feudo, os heróis e a Taverna', () => {
    const markup = tab(tavernOpenView);
    expect(markup).toContain('<h1>Pedra Alta</h1>');
    expect(markup).toContain('id="heroes-title"');
    expect(markup).toContain('id="tavern-title"');
  });

  it('sem ligação: modo leitura, dito por extenso, com todos os botões de ordem desabilitados', () => {
    const markup = tab(tavernOpenView, false);
    expect(text(markup)).toContain(
      'Sem ligação com o reino: a equipe, as expedições, os candidatos e os prazos são os do último estado conhecido do feudo.',
    );
    // As ordens da equipe e da Taverna, e a obra da Guilda dos Aventureiros, que ainda não existe.
    const orders = buttons(markup).filter((button) =>
      /Contratar|Dispensar|festival|Construir/.test(button.label),
    );
    expect(orders).toHaveLength(5);
    expect(orders.every((button) => button.disabled)).toBe(true);
    expect(text(tab(tavernOpenView))).not.toContain('Sem ligação');
  });

  it('nenhum estilo embutido: a política de conteúdo do app não deixa', () => {
    for (const view of [
      initialView,
      guildPaidView,
      guildArrearsView,
      heroPromisedView,
      tavernOpenView,
      tavernBusyView,
    ]) {
      expect(tab(view)).not.toMatch(/\sstyle=/);
    }
  });
});

describe('os heróis fora da aba Guilda (GDD §13.3)', () => {
  it('o cabeçalho diz "Heróis N" ao lado da população quando há equipe, com o soldo na explicação', () => {
    expect(text(html(<Header view={initialView} elapsed={0} />))).not.toContain('Heróis');
    const paid = html(<Header view={guildPaidView} elapsed={0} />);
    expect(text(paid)).toContain('Heróis 3');
    expect(paid).toContain('Soldo da equipe: 21/h de ouro. O ouro paga a equipe por mais 23 h.');
    const late = text(html(<Header view={guildArrearsView} elapsed={0} />));
    expect(late).toContain('Heróis 2');
    expect(late).toContain('soldo em atraso');
  });

  it('a linha do ouro explica o saldo com o soldo, na conta do servidor', () => {
    const markup = html(
      <ResourcesTable view={tavernOpenView} disabled={false} actions={actions} />,
    );
    expect(markup).toContain('−6/h (soldo de 1 herói)');
    expect(
      html(<ResourcesTable view={guildPaidView} disabled={false} actions={actions} />),
    ).toContain('−21/h (soldo de 3 heróis)');
  });

  it('o Relatório de Retorno diz que a produção do ouro já desconta o soldo, e põe o atraso e quem partiu no preço', () => {
    const events = [
      gameEvent(1, 'wageArrearsStarted', 'O cofre secou: o soldo atrasou.'),
      gameEvent(2, 'heroLeft', 'Isolda deixou o feudo.'),
    ];
    const report = buildReturnReport(guildPaidView, guildArrearsView, events, 9 * 3600 * 1000);
    const markup = html(
      <Today report={report} view={guildArrearsView} online elapsed={0} actions={actions} />,
    );
    const sheet = text(markup);
    expect(sheet).toContain('no ouro, o soldo dos heróis');
    // O que uma ordem da Guilda cobrou não está na produção: a nota diz onde está.
    expect(sheet).toContain('o trato de uma contratação e o custo de um festival estão em Gasto.');
    expect(sheet).toContain('O cofre secou: o soldo atrasou.');
    expect(sheet).toContain('Isolda deixou o feudo.');
    // Sem equipe e sem evento dela, a nota não fala de soldo.
    const plain = buildReturnReport(initialView, initialView, [], 9 * 3600 * 1000);
    expect(
      text(html(<Today report={plain} view={initialView} online elapsed={0} actions={actions} />)),
    ).not.toContain('soldo');
  });
});
