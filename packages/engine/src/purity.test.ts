import { describe, expect, it } from 'vitest';

import * as engine from './index';

// O texto de todos os fontes do motor, lido pelo Vitest sem tocar no sistema de arquivos.
const files = import.meta.glob<string>('./**/*.ts', {
  query: '?raw',
  import: 'default',
  eager: true,
});

const sources = Object.entries(files).filter(
  ([path]) =>
    !path.endsWith('.test.ts') && !path.endsWith('.d.ts') && !path.endsWith('test-helpers.ts'),
);

const forbidden: Array<[string, RegExp]> = [
  ['relógio do sistema', /Date\.now|new Date\b/],
  ['aleatoriedade sem semente', /Math\.random/],
  ['ambiente do processo', /\bprocess\./],
  ['módulos CommonJS', /\brequire\(/],
  ['módulos do Node', /from 'node:/],
  ['API do VS Code', /\bvscode\b/],
  ['rede', /\bfetch\(/],
];

describe('pureza do motor', () => {
  it('encontra os fontes do motor', () => {
    const names = sources.map(([path]) => path);
    expect(names).toContain('./advance.ts');
    expect(names).toContain('./commands.ts');
    expect(names).toContain('./migrations.ts');
    expect(names).toContain('./migrations/v1.ts');
    expect(names).toContain('./random.ts');
    expect(names).toContain('./ids.ts');
    expect(names.length).toBeGreaterThan(10);
  });

  it.each(forbidden)('nenhum fonte usa %s', (_, pattern) => {
    const offenders = sources.filter(([, text]) => pattern.test(text)).map(([path]) => path);
    expect(offenders).toEqual([]);
  });

  it('o motor só importa @lotg/content e os próprios módulos', () => {
    const imports = sources.flatMap(([, text]) =>
      [...text.matchAll(/from '([^']+)'/g)].map((match) => match[1] ?? ''),
    );
    const external = new Set(imports.filter((specifier) => !specifier.startsWith('.')));
    expect([...external]).toEqual(['@lotg/content']);
  });

  it('quem mostra, recusa, agenda ou carrega o estado não importa o gerador de sorteios', () => {
    // Só `advanceTo` sorteia, em eventos com hora marcada. A visão, as ordens, as recusas, a
    // linha do tempo, o estado inicial e a migração nunca: uma leitura não pode rerrolar nada.
    // No Conselho, o sorteio mora em `councilTurn.ts`; `council.ts` (a resposta, a expiração,
    // os efeitos) e `councilView.ts` ficam do lado de quem não sorteia. Na Ameaça, mora em
    // `hordeTurn.ts`; `threat.ts` (a subida e a Paliçada), `raids.ts` (o aviso, a resolução e
    // os feridos, que a linha do tempo, o estado inicial e as previsões da visão também usam)
    // e `threatView.ts` ficam do lado de quem não sorteia. Nos heróis nada sorteia: o soldo, o
    // atraso e quem parte (`heroes.ts`, `wages.ts`) são contas fixas, sem fluxo nenhum, e o herói
    // que uma carta entrega (`arrivals.ts`) chega em instante marcado, com nome e traços do
    // conteúdo. Na Taverna, o sorteio mora em `tavernTurn.ts` (a rotação dos candidatos);
    // `tavern.ts` (as contas), `tavernOrders.ts` (contratar e dar festival) e `tavernView.ts`
    // ficam do lado de quem não sorteia. Nas expedições, mora em `expeditionTurn.ts` (o fim de
    // um nó); `expeditions.ts` (as contas, e a variante do grafo, que sai de um hash),
    // `expeditionOrders.ts` (enviar e escolher o caminho) e `expeditionsView.ts` não sorteiam.
    // Nos desfechos (V3D-T2), quem sofre, a cobiça e o item são sorteados no mesmo
    // `expeditionTurn.ts`; `outcomes.ts` (o que o desfecho faz ao herói e ao mundo) e
    // `equipment.ts` (o arsenal e as ordens de equipar) não sorteiam. No Mercado, o sorteio mora
    // em `marketTurn.ts` (o preço de cada dia, na virada); `market.ts` (as contas),
    // `marketOrders.ts` (comprar e vender) e `marketView.ts` não sorteiam.
    const neverDraw =
      /^\.\/(view|seasonView|moraleView|morale|council|councilView|craftProjection|commands|rejections|timeline|state|migrations|units|clock|chronicle|threat|threatView|raids|heroes|wages|arrivals|tavern|tavernOrders|tavernView|expeditions|expeditionOrders|expeditionsView|equipment|outcomes|guildView|hash|market|marketOrders|marketView)(\.ts|\/)/;
    const guarded = sources.filter(([path]) => neverDraw.test(path));
    expect(guarded.map(([path]) => path)).toEqual(
      expect.arrayContaining([
        './view.ts',
        './seasonView.ts',
        './moraleView.ts',
        './morale.ts',
        './council.ts',
        './councilView.ts',
        './craftProjection.ts',
        './commands.ts',
        './rejections.ts',
        './timeline.ts',
        './threat.ts',
        './threatView.ts',
        './raids.ts',
        './heroes.ts',
        './wages.ts',
        './arrivals.ts',
        './tavern.ts',
        './tavernOrders.ts',
        './tavernView.ts',
        './expeditions.ts',
        './expeditionOrders.ts',
        './expeditionsView.ts',
        './market.ts',
        './marketOrders.ts',
        './marketView.ts',
      ]),
    );
    const offenders = guarded
      .filter(([, text]) => /from '(\.\.?\/)+random'/.test(text))
      .map(([path]) => path);
    expect(offenders).toEqual([]);
    // E quem sorteia na Ameaça é só a virada do dia.
    const draws = sources
      .filter(([, text]) => /from '(\.\.?\/)+random'/.test(text))
      .map(([path]) => path);
    expect(draws).toEqual(expect.arrayContaining(['./hordeTurn.ts']));
    // Na Taverna, só a rotação (`tavernTurn.ts`): contratar e dar festival são ordens, e uma
    // ordem não sorteia.
    expect(draws).toContain('./tavernTurn.ts');
    expect(draws).not.toContain('./tavernOrders.ts');
    // Nas expedições, só o fim de um nó (`expeditionTurn.ts`): enviar e escolher o caminho são
    // ordens.
    expect(draws).toContain('./expeditionTurn.ts');
    expect(draws).not.toContain('./expeditionOrders.ts');
    // No Mercado, só a virada do dia (`marketTurn.ts`): negociar é uma ordem.
    expect(draws).toContain('./marketTurn.ts');
    expect(draws).not.toContain('./marketOrders.ts');
  });

  it('quem mostra, agenda ou carrega o estado não importa o contador de identidades', () => {
    // Só uma ordem aceita e um evento da linha do tempo criam entidades. A visão, as previsões,
    // a linha do tempo, as recusas, o estado inicial e a migração nunca: uma leitura a cada 30
    // segundos não pode gastar um identificador.
    //
    // O critério desta lista **não** é o de `neverDraw`. Entram os módulos de leitura e de
    // conta que a visão e `nextEventAt` importam e que não têm por que criar nada: além dos
    // de visão, a moral (`morale.ts`, a soma e os prazos), a Ameaça (`threat.ts`, a subida e a
    // Paliçada), a economia, o armazenamento, o ritmo e os heróis (`heroes.ts`, as derivações, e
    // `wages.ts`, o soldo e o atraso: quem parte e quem é dispensado sai da lista, ninguém entra). Ficam de fora, de propósito, os
    // módulos de regra que `advanceTo` e `applyCommand` chamam e que **vão** criar entidades:
    // `commands.ts` (contratar e enviar são ordens), `council.ts` (o efeito de uma carta
    // entrega o primeiro herói), `raids.ts` (a resolução é um evento da linha do tempo),
    // `advance.ts` e os `*Turn.ts`. A visão e a linha do tempo importam alguns deles pelas
    // funções de leitura (`nextCouncilEventAt`, `nextRaidEventAt`, as previsões que rodam
    // `advanceTo` em uma cópia): isso este teste de texto não vê, e quem prova é o teste de
    // comportamento de `ids.test.ts` ("quem não cria identidades"), sobre todos os retratos.
    const neverCreate =
      /^\.\/(view|[A-Za-z]+View|craftProjection|rejections|timeline|state|migrations|units|clock|chronicle|format|random|morale|threat|economy|storage|pace|heroes|wages|tavern|expeditions|equipment|outcomes|hash|market|marketOrders|marketTurn)(\.ts|\/)/;
    const guarded = sources.filter(([path]) => neverCreate.test(path));
    expect(guarded.map(([path]) => path)).toEqual(
      expect.arrayContaining([
        './view.ts',
        './seasonView.ts',
        './moraleView.ts',
        './councilView.ts',
        './threatView.ts',
        './storageView.ts',
        './craftProjection.ts',
        './rejections.ts',
        './timeline.ts',
        './state.ts',
        './migrations.ts',
        './migrations/v12.ts',
        './migrations/v13.ts',
        './migrations/v14.ts',
        './migrations/v15.ts',
        './migrations/v16.ts',
        './migrations/v17.ts',
        './random.ts',
        './morale.ts',
        './threat.ts',
        './economy.ts',
        './storage.ts',
        './pace.ts',
        './heroes.ts',
        './wages.ts',
        './tavern.ts',
        './tavernView.ts',
        './expeditions.ts',
        './expeditionsView.ts',
        './equipment.ts',
        './outcomes.ts',
        // O Mercado inteiro: nem a virada do dia, nem a ordem de negociar criam entidade.
        './market.ts',
        './marketOrders.ts',
        './marketTurn.ts',
        './marketView.ts',
        './migrations/v21.ts',
      ]),
    );
    // Os módulos de regra que criam (ou vão criar) entidades não entram por engano.
    // Dois criam de fato: `arrivals.ts`, o herói (o que uma carta entrega e o que a Taverna
    // vende, pela mesma porta), e `tavernTurn.ts`, a oferta de cada candidato, na rotação. A
    // visão e a linha do tempo leem os heróis prometidos por `heroes.ts` e a Taverna por
    // `tavern.ts`, que não criam nada.
    const creators = sources
      .filter(([, text]) => /from '(\.\.?\/)+ids'/.test(text))
      .map(([path]) => path);
    // E, desde V3D-T1, `expeditionOrders.ts`: a ordem de envio dá o identificador à expedição.
    // Desde V3D-T2, `expeditionTurn.ts`: o item achado no fim de um nó nasce com o dele, em um
    // instante da linha do tempo. As ordens de equipar (`equipment.ts`) não criam nada.
    expect(creators).toEqual([
      './arrivals.ts',
      './expeditionOrders.ts',
      './expeditionTurn.ts',
      './tavernTurn.ts',
    ]);
    for (const allowed of [
      './commands.ts',
      './council.ts',
      './raids.ts',
      './advance.ts',
      './arrivals.ts',
      './tavernOrders.ts',
      './tavernTurn.ts',
      './expeditionOrders.ts',
      './expeditionTurn.ts',
    ]) {
      expect(guarded.map(([path]) => path)).not.toContain(allowed);
    }
    const offenders = guarded
      .filter(([, text]) => /from '(\.\.?\/)+ids'/.test(text) || /\bnextId\(/.test(text))
      .map(([path]) => path);
    expect(offenders).toEqual([]);
    // E o contador não sorteia nem lê nada além do estado: não importa módulo nenhum do motor.
    const ids = sources.find(([path]) => path === './ids.ts')?.[1] ?? '';
    expect([...ids.matchAll(/from '([^']+)'/g)].map((match) => match[1])).toEqual(['./types']);
  });
});

describe('API pública', () => {
  it('exporta exatamente o contrato da fase', () => {
    expect(Object.keys(engine).sort()).toEqual([
      'CURRENT_SCHEMA_VERSION',
      'ENGINE_VERSION',
      'REJECTION_CODES',
      'StateMigrationError',
      'advanceTo',
      'applyCommand',
      'createInitialState',
      'deriveViewState',
      'migrateState',
      'nextEventAt',
    ]);
  });
});
