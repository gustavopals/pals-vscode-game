import { type GameEvent, ReturnReportSchema, type ViewState } from '@lotg/protocol';
import { describe, expect, it } from 'vitest';

import golden from '../../../engine/src/__golden__/view-seed-pedra-alta.json';
import type { AccountState } from '../account/accountService';
import { buildReturnReport, isChronicleEvent, shouldShowReturnReport } from '../game/returnReport';
import {
  activeConstruction,
  autumnView,
  coldView,
  craftsView,
  FOOD_RUNS_OUT_AHEAD,
  impoverishedView,
  lateObjectivesView,
  proudView,
  queuesView,
  councilView,
  mealCard,
  palisadeRaisedView,
  raidAftermathView,
  shareCard,
  threatIncomingView,
  threatWatchedView,
  unlockedView,
  winterWith,
  withCards,
  withFoodAhead,
  withPlanned,
  withQueues,
  withResource,
  withUpgrade,
} from '../test-helpers';
import {
  busyQueues,
  capExplanation,
  capitalize,
  documentTitle,
  fillsSoon,
  firewoodRunsOutIn,
  formatApprox,
  formatCost,
  formatDuration,
  formatNumber,
  formatRate,
  formatRemaining,
  FULL_SOON_SECONDS,
  planWaiting,
  refundParts,
  refundSentence,
  remainingNow,
  runsOutIn,
  runsOutWhy,
  soonestConstruction,
  statusBar,
  type StatusBarInput,
  storageAlert,
  storageNotice,
  truncate,
  upgradeName,
} from './format';
import { THREAT_SECTION } from './threat';
import { buildTree, type TreeInput, type TreeNode } from './treeModel';

const initial = golden.initial as unknown as ViewState;
const farmers = golden.afterFirstAllocation as unknown as ViewState;
const HOUR = 3_600_000;

const building = withQueues(farmers, [activeConstruction()]);
const starving: ViewState = {
  ...building,
  famine: {
    sinceMs: 0,
    secondsElapsed: 60,
    endsInSeconds: null,
    text: 'Fome: a produção cai para 75%.',
  },
};

const account: AccountState = {
  kind: 'anonymous',
  accountId: 'conta-1',
  displayName: 'Gustavo',
  hasRecoveryCode: false,
  gameId: 'partida-1',
};
const online = { kind: 'online' } as const;
const offline = { kind: 'offline', retryInMs: 5000, attempt: 1 } as const;

describe('formatação', () => {
  it('tempo restante em horas e minutos, arredondando para cima', () => {
    expect(formatRemaining(2520)).toBe('00:42');
    expect(formatRemaining(1)).toBe('00:01');
    expect(formatRemaining(0)).toBe('00:00');
    expect(formatRemaining(8040)).toBe('02:14');
    expect(formatRemaining(2 * 86_400 + 5 * 3600)).toBe('2d 05h');
    expect(formatRemaining(-30)).toBe('00:00');
  });

  it('taxa com sinal e vírgula decimal', () => {
    expect(formatRate(15)).toBe('+15/h');
    expect(formatRate(-5)).toBe('−5/h');
    expect(formatRate(0)).toBe('0/h');
    expect(formatRate(7.5)).toBe('+7,5/h');
    expect(formatNumber(1024)).toBe('1.024');
  });

  it('duração e custo por extenso', () => {
    expect(formatDuration(300)).toBe('5 min');
    expect(formatDuration(4080)).toBe('1 h 08 min');
    expect(formatDuration(28_800)).toBe('8 h');
    expect(formatDuration(10)).toBe('10 s');
    // Nos ritmos acelerados os prazos não são minutos redondos: os segundos aparecem.
    expect(formatDuration(80)).toBe('1 min 20 s');
    expect(formatDuration(400)).toBe('6 min 40 s');
    expect(formatDuration(601)).toBe('11 min');
    expect(formatDuration(3601)).toBe('1 h 01 min');
    expect(formatCost(initial.recruitment.cost)).toBe('50 comida, 10 ouro');
  });

  it('a espera de uma planejada: a frase do servidor e, quando há, o prazo que desce', () => {
    const waiting = (text: string, etaSeconds: number | null) => ({
      waiting: { reason: 'resources' as const, text, etaSeconds },
    });
    expect(planWaiting(waiting('espera 15 de ouro', 6630), 0)).toBe(
      'espera 15 de ouro: em 1 h 51 min',
    );
    expect(planWaiting(waiting('espera 15 de ouro', 6630), 6600)).toBe(
      'espera 15 de ouro: em 30 s',
    );
    // Vencido o prazo, a tela não mostra tempo negativo: a leitura seguinte traz a obra iniciada.
    expect(planWaiting(waiting('espera 15 de ouro', 60), 600)).toBe('espera 15 de ouro: em 1 s');
    expect(planWaiting(waiting('não cabe no Armazém: amplie-o', null), 600)).toBe(
      'não cabe no Armazém: amplie-o',
    );
    expect(planWaiting({ waiting: null }, 0)).toBe('pode começar agora');
    expect(capitalize('espera 15 de ouro')).toBe('Espera 15 de ouro');
    expect(capitalize('')).toBe('');
  });

  it('corta texto longo com reticências e desconta o tempo decorrido', () => {
    expect(truncate('Pedra Alta', 20)).toBe('Pedra Alta');
    expect(truncate('Os pedreiros ergueram a Serraria', 12)).toBe('Os pedreiro…');
    expect(remainingNow(100, 30.9)).toBe(70);
    expect(remainingNow(100, 500)).toBe(0);
  });
});

describe('estoque que acaba', () => {
  const wood = (view: ViewState) => {
    const row = view.resources.find((entry) => entry.id === 'wood');
    if (row === undefined) {
      throw new Error('A visão não tem madeira.');
    }
    return row;
  };
  const food = (view: ViewState) => view.resources.find((entry) => entry.id === 'food');

  it('tempo aproximado: minutos, horas e dias', () => {
    expect(formatApprox(1500)).toBe('25 min');
    expect(formatApprox(36_000)).toBe('10 h');
    expect(formatApprox(3 * 86_400)).toBe('3 dias');
    expect(formatApprox(0)).toBe('1 min');
  });

  it('fora do inverno, o prazo é o que a visão traz', () => {
    const row = food(initial);
    expect(row?.depletesInSeconds).toBe(129_600);
    expect(row === undefined ? null : runsOutIn(initial, row)).toBe(129_600);
    expect(firewoodRunsOutIn(initial)).toBeNull();
    expect(firewoodRunsOutIn(autumnView)).toBeNull();
  });

  it('no inverno, a madeira que não chega à primavera acaba no prazo da visão', () => {
    const short = winterWith({ stock: 90, missing: 59, depletesInSeconds: 36_000 });
    expect(runsOutIn(short, wood(short))).toBe(36_000);
    expect(firewoodRunsOutIn(short)).toBe(36_000);
  });

  it('com lenha para o resto do inverno, o prazo da visão não vira alarme', () => {
    // O prazo é o estoque pela taxa de agora e passa da primavera, quando a lareira apaga.
    const enough = winterWith({ stock: 900, missing: 0, depletesInSeconds: 360_000 });
    expect(enough.calendar.secondsToNextSeason).toBeLessThan(360_000);
    expect(runsOutIn(enough, wood(enough))).toBeNull();
    expect(firewoodRunsOutIn(enough)).toBeNull();
    // Só a madeira tem lareira: os outros recursos seguem o prazo da visão.
    const hungry: ViewState = {
      ...enough,
      resources: enough.resources.map((row) =>
        row.id === 'food' ? { ...row, depletesInSeconds: 7200 } : row,
      ),
    };
    const row = food(hungry);
    expect(row === undefined ? null : runsOutIn(hungry, row)).toBe(7200);
  });

  it('no frio não há prazo: a madeira já acabou', () => {
    expect(firewoodRunsOutIn(coldView)).toBeNull();
  });

  it('a comida que só acaba depois da virada de estação: o prazo é o da previsão do servidor', () => {
    const row = (view: ViewState) => {
      const found = food(view);
      if (found === undefined) {
        throw new Error('A visão não trouxe a comida.');
      }
      return found;
    };
    // Crescendo agora: a linha não tem prazo, e a previsão da estação que vem tem.
    const growing = withFoodAhead(
      withResource(autumnView, 'food', { perHour: 9, depletesInSeconds: null }),
      FOOD_RUNS_OUT_AHEAD,
      3600,
    );
    expect(runsOutIn(growing, row(growing))).toBe(FOOD_RUNS_OUT_AHEAD.depletesInSeconds);
    expect(runsOutWhy(growing, row(growing))).toBe(FOOD_RUNS_OUT_AHEAD.text);
    // Caindo devagar: o prazo da linha passa da virada e é a conta pela taxa de agora.
    const slow = withFoodAhead(
      withResource(autumnView, 'food', { perHour: -1, depletesInSeconds: 144_000 }),
      FOOD_RUNS_OUT_AHEAD,
      3600,
    );
    expect(runsOutIn(slow, row(slow))).toBe(FOOD_RUNS_OUT_AHEAD.depletesInSeconds);
    // A previsão sem prazo: a comida atravessa a estação que vem, e não há alarme.
    const lasting = withFoodAhead(slow, { ...FOOD_RUNS_OUT_AHEAD, depletesInSeconds: null }, 3600);
    expect(runsOutIn(lasting, row(lasting))).toBeNull();
    expect(runsOutWhy(lasting, row(lasting))).toBeNull();
    // Acabando antes da virada, ou sem previsão: vale o prazo da linha, sem explicação a mais.
    const soon = withFoodAhead(
      withResource(autumnView, 'food', { perHour: -5, depletesInSeconds: 1800 }),
      FOOD_RUNS_OUT_AHEAD,
      3600,
    );
    expect(runsOutIn(soon, row(soon))).toBe(1800);
    expect(runsOutWhy(soon, row(soon))).toBeNull();
    const alone = withFoodAhead(slow, null, 3600);
    expect(runsOutIn(alone, row(alone))).toBe(144_000);
    // Só a comida tem essa previsão.
    expect(runsOutIn(growing, wood(growing))).toBe(wood(growing).depletesInSeconds);
    expect(runsOutWhy(growing, wood(growing))).toBeNull();
  });
});

describe('barra de status', () => {
  const base = {
    connection: online,
    discreetMode: false,
    signedIn: true,
    elapsedSeconds: 0,
    pending: 0,
  };

  it('sem conta, convida a jogar', () => {
    expect(statusBar({ ...base, view: null, signedIn: false }).text).toBe(
      '$(home) Lords of the Guild',
    );
  });

  it('padrão: o feudo e a comida por hora', () => {
    expect(statusBar({ ...base, view: farmers }).text).toBe('$(home) Pedra Alta · +7 comida/h');
    expect(statusBar({ ...base, view: initial }).text).toBe('$(home) Pedra Alta · −5 comida/h');
  });

  it('obra em andamento passa na frente, com contagem regressiva local', () => {
    expect(statusBar({ ...base, view: building }).text).toBe('$(tools) Serraria Nv2 · 00:42');
    expect(statusBar({ ...base, view: building, elapsedSeconds: 600 }).text).toBe(
      '$(tools) Serraria Nv2 · 00:32',
    );
  });

  it('a fome passa na frente da obra', () => {
    expect(statusBar({ ...base, view: starving }).text).toBe('$(warning) Fome em Pedra Alta');
  });

  it('com duas obras em curso, mostra a que termina primeiro e conta a outra', () => {
    // No golden o Celeiro enche em menos de 8 h, o que passaria na frente das obras.
    const twoQueues = withResource(queuesView, 'food', { fullInSeconds: null });
    const result = statusBar({ ...base, view: twoQueues });
    expect(result.text).toBe('$(tools) Serraria Nv2 · 00:03 · +1 obra');
    expect(result.tooltip).toBe('Pedra Alta: 2 obras em andamento');
    // A ordem das filas não importa: vale o prazo. Aqui a segunda fila termina antes.
    const [first, second] = twoQueues.constructions.queues;
    const swapped = withQueues(twoQueues, [second ?? null, first ?? null]);
    expect(statusBar({ ...base, view: swapped }).text).toBe(
      '$(tools) Serraria Nv2 · 00:03 · +1 obra',
    );
    expect(soonestConstruction(swapped.constructions)?.building).toBe('lumberMill');
    // Com a primeira fila livre, a obra da segunda é a que aparece, sem "+1".
    const onlySecond = withQueues(twoQueues, [null, second ?? null]);
    expect(statusBar({ ...base, view: onlySecond }).text).toBe('$(tools) Mina de Ouro Nv2 · 00:06');
    expect(busyQueues(onlySecond.constructions).map((queue) => queue.building)).toEqual([
      'goldMine',
    ]);
    expect(soonestConstruction(farmers.constructions)).toBeNull();
    // No modo discreto, o contador é o da obra que termina primeiro.
    expect(statusBar({ ...base, view: swapped, discreetMode: true }).text).toBe(
      '$(circle-filled) 00:03',
    );
  });

  it('o frio tem ícone e texto próprios, e a explicação é a que o servidor mandou', () => {
    const result = statusBar({ ...base, view: coldView });
    expect(result.text).toBe('$(flame) Frio em Pedra Alta');
    expect(result.text).not.toContain('Fome');
    expect(result.tooltip).toBe(coldView.winter?.cold?.text);
    expect(result.tooltip).toContain('Faltam 149 de madeira');
    // Passa na frente da obra, como a fome, e convive com o contador de novidades.
    const busy: ViewState = { ...coldView, constructions: building.constructions };
    expect(statusBar({ ...base, view: busy, pending: 2 }).text).toBe(
      '$(flame) Frio em Pedra Alta · $(bell) 2',
    );
  });

  it('fome e frio juntos dividem a linha, e a explicação traz os dois', () => {
    const both: ViewState = { ...coldView, famine: starving.famine };
    const result = statusBar({ ...base, view: both });
    expect(result.text).toBe('$(warning) Fome e frio em Pedra Alta');
    expect(result.tooltip).toContain('Fome: a produção cai para 75%.');
    expect(result.tooltip).toContain('Frio: sem lenha');
  });

  it('inverno com a lareira acesa não toma a barra', () => {
    const lit = winterWith({ stock: 90, missing: 59, depletesInSeconds: 36_000 });
    expect(statusBar({ ...base, view: lit }).text).toBe('$(home) Pedra Alta · +24,7 comida/h');
  });

  it('sem ligação passa na frente de tudo', () => {
    const result = statusBar({ ...base, view: starving, connection: offline });
    expect(result.text).toBe('$(debug-disconnect) Sem ligação com o reino');
    expect(result.tooltip).toContain('O mundo continua andando');
  });

  it('modo discreto mostra só um contador', () => {
    expect(statusBar({ ...base, view: building, discreetMode: true }).text).toBe(
      '$(circle-filled) 00:42',
    );
    // Nem a fome nem o frio aparecem para quem olha por cima do ombro.
    expect(statusBar({ ...base, view: coldView, discreetMode: true }).text).toBe(
      '$(circle-filled) 00:30',
    );
    expect(
      statusBar({ ...base, view: starving, connection: offline, discreetMode: true }).text,
    ).toBe('$(circle-filled) 00:42');
    // Sem obra, conta até a próxima virada de dia.
    expect(statusBar({ ...base, view: farmers, discreetMode: true }).text).toBe(
      '$(circle-filled) 02:00',
    );
  });

  it('mostra as novidades pendentes', () => {
    expect(statusBar({ ...base, view: farmers, pending: 2 }).text).toBe(
      '$(home) Pedra Alta · +7 comida/h · $(bell) 2',
    );
  });

  describe('prioridade: decisões > fome e frio > depósito a encher > obra', () => {
    /** A madeira a três horas de encher o Pátio, com uma obra em curso. */
    const filling = withResource(building, 'wood', { perHour: 24, fullInSeconds: 3 * 3600 });
    /** A mesma visão com as primeiras `count` cartas da mesa cheia à espera de resposta. */
    const deciding = (view: ViewState, count: number): ViewState =>
      withCards(view, councilView.council.pending.slice(0, count));

    it('o depósito a menos de 8 h de encher passa na frente da obra, e o clique leva ao feudo', () => {
      const result = statusBar({ ...base, view: filling, pending: 1 });
      expect(result.text).toBe('$(archive) Madeira: cheio em 3 h · $(bell) 1');
      expect(result.tooltip).toBe('Pátio: madeira no limite de 500 em 3 h.');
      expect(result.target).toBe('fief');
      expect(result.alarm).toBeUndefined();
      // No golden das duas filas o Celeiro enche em menos de sete horas.
      expect(statusBar({ ...base, view: queuesView }).text).toBe('$(archive) Comida: cheio em 6 h');
    });

    it('a 8 h ou mais de encher, a obra continua na linha', () => {
      const later = withResource(building, 'wood', { perHour: 24, fullInSeconds: 8 * 3600 });
      expect(statusBar({ ...base, view: later }).text).toBe('$(tools) Serraria Nv2 · 00:42');
    });

    it('cheio e perdendo: a linha fala do que mais se perde, e a explicação, de todos', () => {
      const result = statusBar({ ...base, view: proudView });
      expect(result.text).toBe('$(archive) Madeira: cheio, perde 67,3/h');
      expect(result.tooltip).toBe(
        proudView.resources
          .map(storageNotice)
          .filter((line) => line !== null)
          .join(' '),
      );
      expect(result.tooltip).toContain('Despensa cheia: 64,8/h de comida indo ao chão.');
      expect(result.tooltip).toContain('Pátio cheio: 35/h de pedra indo ao chão.');
      // O que já se perde passa na frente do que ainda vai encher.
      const mixed = withResource(proudView, 'wood', {
        full: false,
        wastingPerHour: 0,
        fullNote: null,
        fullInSeconds: 600,
      });
      expect(statusBar({ ...base, view: mixed }).text).toBe(
        '$(archive) Comida: cheio, perde 64,8/h',
      );
    });

    it('a fome e o frio passam na frente do depósito', () => {
      const hungry: ViewState = { ...filling, famine: starving.famine };
      expect(statusBar({ ...base, view: hungry })).toMatchObject({
        text: '$(warning) Fome em Pedra Alta',
        alarm: true,
      });
      const frozen = withResource(coldView, 'stone', { fullInSeconds: 1800 });
      expect(statusBar({ ...base, view: frozen })).toMatchObject({
        text: '$(flame) Frio em Pedra Alta',
        alarm: true,
      });
    });

    it('as decisões pendentes passam na frente de tudo, com o prazo da que vence primeiro', () => {
      const hungry: ViewState = { ...filling, famine: starving.famine };
      const result = statusBar({ ...base, view: deciding(hungry, 2), pending: 3 });
      expect(result.text).toBe('$(law) 2 decisões pendentes · expira em 22 h · $(bell) 3');
      // A explicação diz o título e o prazo de cada carta, e onde elas esperam.
      expect(result.tooltip).toBe(
        'Pedra Alta: "A vez de repartir" expira em 22 h; "A refeição dos pedreiros" expira em 23 h. As cartas esperam na aba Conselho.',
      );
      // O clique leva à aba do Conselho, onde a carta se lê inteira.
      expect(result.target).toBe('council');
      expect(result.alarm).toBeUndefined();
      const one = statusBar({ ...base, view: deciding(farmers, 1) });
      expect(one.text).toBe('$(law) 1 decisão pendente · expira em 22 h');
      expect(one.tooltip).toBe(
        'Pedra Alta: "A vez de repartir" expira em 22 h. A carta espera na aba Conselho.',
      );
    });

    it('o prazo da decisão desce com o relógio da página e é o da carta que vence primeiro', () => {
      // A mesa na ordem contrária: a visão traz as decisões do prazo mais curto ao mais longo.
      const [first, second] = councilView.council.pending;
      const view = withCards(farmers, [
        { ...(second ?? mealCard), expiresInSeconds: 20 * 3600 },
        { ...(first ?? shareCard), expiresInSeconds: 3 * 3600 },
      ]);
      expect(statusBar({ ...base, view }).text).toBe('$(law) 2 decisões pendentes · expira em 3 h');
      expect(statusBar({ ...base, view, elapsedSeconds: 2 * 3600 + 35 * 60 }).text).toBe(
        '$(law) 2 decisões pendentes · expira em 25 min',
      );
      // Com o prazo vencido no relógio desta página, a linha não promete tempo que não há.
      expect(statusBar({ ...base, view, elapsedSeconds: 3 * 3600 }).text).toBe(
        '$(law) 2 decisões pendentes · prazo encerrado',
      );
    });

    it('sem ligação e no modo discreto, nada disso aparece', () => {
      const urgent = deciding(filling, 2);
      expect(statusBar({ ...base, view: urgent, connection: offline }).text).toBe(
        '$(debug-disconnect) Sem ligação com o reino',
      );
      const discreet = statusBar({ ...base, view: urgent, discreetMode: true });
      expect(discreet.text).toBe('$(circle-filled) 00:42');
      expect(discreet.target).toBeUndefined();
    });

    describe('a incursão que os vigias avistaram passa na frente de tudo (GDD §8.2 e §13.5)', () => {
      it('"Lobos em 16 min", com o ícone da incursão; a explicação traz o custo e a defesa, e o clique leva ao painel da Ameaça', () => {
        const result = statusBar({ ...base, view: threatIncomingView, pending: 1 });
        expect(result.text).toBe('$(megaphone) Lobos em 16 min · $(bell) 1');
        expect(result.tooltip).toBe(
          'Pedra Alta: Lobos a caminho. Os vigias contam uma matilha grande. Sem defesa, uma matilha grande leva 15% do estoque de comida e madeira (hoje, 75 de comida e 65,9 de madeira) e fere 2 aldeões, que ficam 40 min sem trabalhar. Sem Paliçada, nada segura este ataque.',
        );
        // O clique leva ao painel da Ameaça, onde a obra da defesa está ao lado do aviso.
        expect(result.target).toBe(THREAT_SECTION);
        // Sem o destaque de alarme: a mesma linha anuncia o ataque que a Paliçada segura.
        expect(result.alarm).toBeUndefined();
        expect(statusBar({ ...base, view: palisadeRaisedView }).tooltip).toContain(
          'A Paliçada Nv1 não segura um ataque deste tamanho',
        );
      });

      it('o prazo desce com o relógio da página', () => {
        expect(statusBar({ ...base, view: threatIncomingView, elapsedSeconds: 600 }).text).toBe(
          '$(megaphone) Lobos em 6 min',
        );
        expect(statusBar({ ...base, view: threatIncomingView, elapsedSeconds: 9999 }).text).toBe(
          '$(megaphone) Lobos em 1 min',
        );
      });

      it('passa na frente das decisões pendentes, da fome, do frio, do depósito e da obra', () => {
        // O golden da incursão já tem a Despensa cheia e perdendo: sem os lobos, a linha é dela.
        expect(statusBar({ ...base, view: threatWatchedView }).text).toMatch(/^\$\(archive\) /);
        const crowded: ViewState = {
          ...deciding(withQueues(threatIncomingView, [activeConstruction()]), 2),
          famine: starving.famine,
          winter: coldView.winter,
        };
        expect(statusBar({ ...base, view: crowded }).text).toBe('$(megaphone) Lobos em 16 min');
        // Quando o ataque chega, a linha volta ao assunto que estava: as cartas à espera.
        const after: ViewState = { ...crowded, threat: threatWatchedView.threat };
        expect(statusBar({ ...base, view: after }).text).toMatch(/^\$\(law\) 2 decisões pendentes/);
      });

      it('sem a Torre a visão não traz incursão nenhuma, e a linha não inventa uma', () => {
        expect(statusBar({ ...base, view: building }).text).toBe('$(tools) Serraria Nv2 · 00:42');
      });

      it('sem ligação e no modo discreto, nada da incursão aparece', () => {
        expect(statusBar({ ...base, view: threatIncomingView, connection: offline }).text).toBe(
          '$(debug-disconnect) Sem ligação com o reino',
        );
        expect(statusBar({ ...base, view: threatIncomingView, discreetMode: true }).text).toMatch(
          /^\$\(circle-filled\) \d\d:\d\d$/,
        );
      });

      it('o título da aba do navegador repete o assunto, com as decisões no contador', () => {
        const APP = 'Lords of the Guild';
        expect(documentTitle({ ...base, view: threatIncomingView })).toBe(
          `Lobos em 16 min · Pedra Alta · ${APP}`,
        );
        expect(documentTitle({ ...base, view: deciding(threatIncomingView, 1), pending: 1 })).toBe(
          `(2) Lobos em 16 min · Pedra Alta · ${APP}`,
        );
        // Sem ligação o estado guardado pode estar velho: o ataque dele pode já ter passado.
        expect(documentTitle({ ...base, view: threatIncomingView, connection: offline })).toBe(
          `Pedra Alta · ${APP}`,
        );
      });
    });

    describe('título da aba do navegador', () => {
      const APP = 'Lords of the Guild';
      const title = (view: ViewState | null, overrides: Partial<StatusBarInput> = {}) =>
        documentTitle({ ...base, view, ...overrides });

      it('sem conta ou sem feudo, só o nome do jogo', () => {
        expect(title(null)).toBe(APP);
        expect(title(farmers, { signedIn: false })).toBe(APP);
      });

      it('sem nada a destacar, o nome do feudo, com as novidades na frente', () => {
        expect(title(farmers)).toBe(`Pedra Alta · ${APP}`);
        expect(title(farmers, { pending: 2 })).toBe(`(2) Pedra Alta · ${APP}`);
      });

      it('repete o assunto da barra de status, na mesma prioridade', () => {
        expect(title(building)).toBe(`Serraria Nv2 · 00:42 · Pedra Alta · ${APP}`);
        expect(title(building, { elapsedSeconds: 600 })).toBe(
          `Serraria Nv2 · 00:32 · Pedra Alta · ${APP}`,
        );
        expect(title(filling)).toBe(`Madeira: cheio em 3 h · Pedra Alta · ${APP}`);
        expect(title(starving)).toBe(`Fome em Pedra Alta · ${APP}`);
        expect(title(coldView, { pending: 1 })).toBe(`(1) Frio em Pedra Alta · ${APP}`);
        expect(title({ ...coldView, famine: starving.famine })).toBe(
          `Fome e frio em Pedra Alta · ${APP}`,
        );
      });

      it('as decisões pendentes entram no contador, com as novidades: "(1) Pedra Alta"', () => {
        expect(title(deciding(farmers, 1))).toBe(`(1) Pedra Alta · ${APP}`);
        expect(title(deciding(farmers, 2))).toBe(`(2) Pedra Alta · ${APP}`);
        expect(title(deciding(farmers, 1), { pending: 2 })).toBe(`(3) Pedra Alta · ${APP}`);
        // Com carta à espera, o assunto do título é o contador, mesmo com fome ou obra.
        expect(title(deciding(starving, 2), { pending: 4 })).toBe(`(6) Pedra Alta · ${APP}`);
        expect(title(deciding(building, 1))).toBe(`(1) Pedra Alta · ${APP}`);
      });

      it('sem ligação, a carta do estado guardado não entra no contador do título', () => {
        expect(title(deciding(farmers, 2), { connection: offline })).toBe(`Pedra Alta · ${APP}`);
        expect(title(deciding(farmers, 2), { connection: offline, pending: 1 })).toBe(
          `(1) Pedra Alta · ${APP}`,
        );
      });

      it('com duas obras, o título fica com a que termina primeiro, sem contar a outra', () => {
        const twoQueues = withResource(queuesView, 'food', { fullInSeconds: null });
        expect(title(twoQueues)).toBe(`Serraria Nv2 · 00:03 · Pedra Alta · ${APP}`);
      });

      it('sem ligação o estado guardado pode estar velho: fica só o nome do feudo', () => {
        expect(title(starving, { connection: offline })).toBe(`Pedra Alta · ${APP}`);
      });

      it('no modo discreto, só o contador', () => {
        expect(title(deciding(starving, 2), { discreetMode: true, pending: 4 })).toBe('00:42');
      });
    });
  });
});

describe('árvore', () => {
  const event = (seq: number, text: string): GameEvent => ({
    seq,
    type: 'constructionFinished',
    at: '2026-10-01T12:00:00.000Z',
    atMs: 0,
    text,
    data: {},
  });
  const input = {
    view: building,
    account,
    connection: online,
    chronicle: [1, 2, 3, 4, 5, 6, 7].map((seq) => event(seq, `linha ${seq}`)),
    unseen: 0,
    elapsedSeconds: 0,
  };
  const find = (nodes: TreeNode[], id: string): TreeNode | undefined => {
    for (const node of nodes) {
      if (node.id === id) {
        return node;
      }
      const inner = find(node.children ?? [], id);
      if (inner) {
        return inner;
      }
    }
    return undefined;
  };

  it('sem conta, fica vazia para o VS Code mostrar as boas-vindas', () => {
    expect(buildTree({ ...input, account: { kind: 'signedOut' } })).toEqual([]);
  });

  it('tem Hoje, Feudo, Crônica, Conta e Configurações', () => {
    const tree = buildTree(input);
    expect(tree.map((node) => node.id)).toEqual([
      'today',
      'fief',
      'chronicle',
      'account',
      'settings',
    ]);
    expect(tree[0]?.label).toBe('Hoje em Pedra Alta');
    expect(tree[1]).toMatchObject({ label: 'Feudo: Pedra Alta', description: 'Primavera, dia 1' });
    expect(tree[1]?.children?.map((node) => node.id)).toEqual([
      'resources',
      'workers',
      'constructions',
      'council',
      'morale',
      'threat',
      'objectives',
    ]);
  });

  describe('"Hoje": o que há a preparar antes de sair (GDD §2.3)', () => {
    const today = (overrides: Partial<TreeInput>) => buildTree({ ...input, ...overrides })[0];

    it('diz quantos itens "Antes de partir" tem, e a explicação os lista', () => {
      // No feudo recém-fundado: planejar uma obra e dar ofício aos cinco. Nada urgente.
      expect(today({ view: initial })).toMatchObject({
        description: '2 a preparar',
        tooltip:
          'Antes de partir:\nOs pedreiros estão livres e nenhuma obra começa sozinha.\n5 aldeões livres, sem ofício.',
      });
    });

    it('com algo que acaba ou enche, o sinal de alerta acompanha o número', () => {
      expect(today({ view: proudView })?.description).toBe('⚠ 4 a preparar');
      expect(today({ view: impoverishedView })?.description).toBe('⚠ 4 a preparar');
      expect(today({ view: impoverishedView })?.tooltip).toContain('A fome já dura 40 h');
    });

    it('sem nada a preparar, diz que o feudo está pronto', () => {
      const ready = withPlanned(unlockedView, [
        {
          building: 'farm',
          autoStart: true,
          waiting: { reason: 'resources', text: 'espera 59 de madeira', etaSeconds: 7200 },
        },
      ]);
      expect(today({ view: ready })).toMatchObject({
        description: 'pronto para a ausência',
        tooltip: 'O feudo está preparado para a sua ausência.',
      });
    });

    it('as decisões pendentes passam na frente de tudo, com as novidades ao lado', () => {
      expect(today({ view: councilView })?.description).toBe('● 2 decisões pendentes');
      expect(today({ view: withCards(initial, [mealCard]) })?.description).toBe(
        '● 1 decisão pendente',
      );
      expect(today({ view: councilView, unseen: 3 })?.description).toBe(
        '● 2 decisões pendentes · 3 novidades',
      );
      // Sem ligação a carta é a do estado guardado, e pode já ter saído da mesa: não é anunciada.
      expect(today({ view: councilView, connection: offline })?.description).toBe(
        'sem ligação com o reino',
      );
    });

    it('as novidades e a falta de ligação passam na frente', () => {
      expect(today({ view: initial, unseen: 2 })?.description).toBe('● 2 novidades');
      expect(today({ view: initial, connection: offline })?.description).toBe(
        'sem ligação com o reino',
      );
    });

    it('sem ligação, a explicação não afirma que o feudo está preparado: a visão é a guardada', () => {
      const ready = withPlanned(unlockedView, [
        {
          building: 'farm',
          autoStart: true,
          waiting: { reason: 'resources', text: 'espera 59 de madeira', etaSeconds: 7200 },
        },
      ]);
      expect(today({ view: ready, connection: offline })).toMatchObject({
        description: 'sem ligação com o reino',
        tooltip:
          'Sem ligação com o reino: este é o último estado conhecido do feudo. Nele não havia nada a preparar.',
      });
      // Com itens, a lista é a de sempre, com o aviso de que é a do último estado conhecido.
      expect(today({ view: impoverishedView, connection: offline })?.tooltip?.split('\n')[0]).toBe(
        'Antes de partir, pelo último estado conhecido (sem ligação com o reino):',
      );
      expect(today({ view: impoverishedView })?.tooltip?.split('\n')[0]).toBe('Antes de partir:');
    });
  });

  describe('Conselho (GDD §13.2)', () => {
    const council = (view: ViewState, elapsedSeconds = 0) =>
      find(buildTree({ ...input, view, elapsedSeconds }), 'council');

    it('sem cartas, diz quando é a próxima audiência; a explicação traz a regra do servidor', () => {
      const node = council(farmers);
      expect(node).toMatchObject({
        label: 'Conselho',
        description: 'próxima audiência em 8 h',
        icon: 'law',
        command: { id: 'lords.openPanel', args: ['council'] },
      });
      expect(node?.children).toEqual([]);
      expect(node?.tooltip).toBe(
        [farmers.council.rulesText, 'Próxima audiência em 8 h.'].join('\n'),
      );
      // O prazo desce com o relógio da página.
      expect(council(farmers, 7 * 3600 + 30 * 60)?.description).toBe('próxima audiência em 30 min');
    });

    it('sem assunto para o feudo como ele está, não promete carta', () => {
      const node = council(autumnView);
      expect(node?.description).toBe('sem assunto por agora');
      expect(node?.tooltip).toContain(
        'O conselho não tem assunto novo para o feudo como ele está: a próxima audiência não traz carta.',
      );
    });

    it('com cartas: quantas esperam e o prazo da que vence primeiro', () => {
      expect(council(withCards(farmers, [mealCard]))?.description).toBe(
        '1 carta pendente (expira em 23 h)',
      );
      const node = council(
        withCards(farmers, [
          { ...shareCard, expiresInSeconds: 20 * 3600 },
          { ...mealCard, expiresInSeconds: 14 * 3600 },
        ]),
      );
      expect(node?.description).toBe('2 cartas pendentes (expira em 14 h)');
      expect(council(councilView)?.tooltip).toContain('Com 2 cartas à espera');
    });

    it('cada carta é uma linha, com o prazo, o texto na explicação e o botão que decide', () => {
      const node = council(councilView);
      expect(node?.children?.map((card) => card.id)).toEqual([
        'card:commonGranaryShare-3',
        'card:masonsMeal-4',
      ]);
      expect(node?.children?.[1]).toMatchObject({
        label: 'A refeição dos pedreiros',
        description: 'expira em 23 h',
        contextValue: 'lords.card',
        // O clique só navega: a carta se lê na aba do Conselho.
        command: { id: 'lords.openPanel', args: ['council'] },
      });
      expect(node?.children?.[1]?.tooltip).toBe([mealCard.text, mealCard.expiryNote].join('\n'));
    });
  });

  it('recursos mostram estoque e taxa com sinal; o tooltip explica o número', () => {
    const food = find(buildTree(input), 'resource:food');
    // O estoque sobre o limite e a taxa.
    expect(food).toMatchObject({ label: 'Comida', description: '180/500 (+7/h)' });
    // Os dois lavradores acabaram de chegar: a explicação diz que rendem metade (V2C-T3).
    expect(food?.tooltip).toContain('2 trabalhadores (2 em adaptação por 2 h');
    expect(food?.tooltip).toContain('× 10 × 1 (Nv1)');
    // O ouro não tem limite: só o estoque e a taxa.
    expect(find(buildTree(input), 'resource:gold')?.description).toBe('270 (0/h)');
  });

  describe('armazenamento (GDD §5.5 e §13.2)', () => {
    const soon = withResource(farmers, 'food', {
      stock: 412,
      perHour: 22,
      fullInSeconds: 14_400,
    });
    const note = 'Pátio cheio: 72/h de madeira indo ao chão. Construa o Armazém ou gaste madeira.';
    const wasting = withResource(unlockedView, 'wood', {
      stock: 500,
      perHour: 72,
      full: true,
      fullInSeconds: null,
      fullNote: note,
      wastingPerHour: 72,
    });

    it('longe de encher, a árvore não fala do limite: a previsão distante fica na tabela', () => {
      const tree = buildTree({ ...input, view: farmers });
      // 58.599 s no golden: 16 horas, mais do que uma ausência comum.
      expect(farmers.resources[0]?.fullInSeconds).toBe(58_599);
      expect(find(tree, 'resource:food')?.description).toBe('180/500 (+7/h)');
      expect(find(tree, 'resources')?.description).toBeUndefined();
    });

    it('a menos de 8 h de encher, o alerta aparece na linha do recurso e na de "Recursos"', () => {
      const tree = buildTree({ ...input, view: soon });
      // O alerta toma o lugar da taxa, para caber na barra lateral (GDD §13.2).
      expect(find(tree, 'resource:food')?.description).toBe('412/500 ⚠ cheio em 4 h');
      // Com o grupo recolhido, a linha de cima continua dizendo o que importa.
      expect(find(tree, 'resources')?.description).toBe('comida ⚠ cheio em 4 h');
      expect(fillsSoon(soon.resources[0] as ViewState['resources'][number])).toBe(true);
      expect(FULL_SOON_SECONDS).toBe(8 * 3600);
    });

    it('cheio e perdendo: diz quanto vai ao chão, e a explicação traz a frase do servidor', () => {
      const tree = buildTree({ ...input, view: wasting });
      const wood = find(tree, 'resource:wood');
      expect(wood?.description).toBe('500/500 ⚠ cheio, perde 72/h');
      expect(wood?.tooltip?.split('\n').slice(1)).toEqual(['Pátio: 500 iniciais', note]);
      expect(find(tree, 'resources')?.description).toBe('madeira ⚠ cheio, perde 72/h');
      // Dois recursos pedindo atenção: os dois na linha de cima.
      const both = withResource(wasting, 'food', { fullInSeconds: 3600 });
      expect(find(buildTree({ ...input, view: both }), 'resources')?.description).toBe(
        'comida ⚠ cheio em 1 h · madeira ⚠ cheio, perde 72/h',
      );
    });

    it('no limite sem nada a entrar: "cheio", sem alarme', () => {
      const still = withResource(farmers, 'wood', { stock: 500, full: true });
      const tree = buildTree({ ...input, view: still });
      expect(find(tree, 'resource:wood')?.description).toBe('500/500 (0/h) · cheio');
      expect(find(tree, 'resources')?.description).toBeUndefined();
    });

    it('o texto do alerta: cheio perdendo, cheio, cheio em (com e sem destaque) e nada', () => {
      const wood = (patch: Partial<ViewState['resources'][number]>) =>
        ({ ...farmers.resources[1], ...patch }) as ViewState['resources'][number];
      expect(storageAlert(wood({ full: true, wastingPerHour: 7.5 }))).toBe('⚠ cheio, perde 7,5/h');
      expect(storageAlert(wood({ full: true }))).toBe('cheio');
      expect(storageAlert(wood({ fullInSeconds: 8 * 3600 - 1 }))).toBe('⚠ cheio em 7 h');
      expect(storageAlert(wood({ fullInSeconds: 8 * 3600 }))).toBe('cheio em 8 h');
      expect(storageAlert(wood({ fullInSeconds: 3 * 86_400 }))).toBe('cheio em 3 dias');
      expect(storageAlert(wood({}))).toBeNull();
      // O ouro não tem limite nem lugar: nada a explicar.
      expect(capExplanation(farmers.resources[3] as ViewState['resources'][number])).toBeNull();
      expect(capExplanation(wood({}))).toBe('Pátio: 500 iniciais');
      expect(
        capExplanation(wood({ storageLabel: 'Armazém', capBreakdown: 'Armazém Nv2: 1.500' })),
      ).toBe('Armazém Nv2: 1.500');
    });

    it('o Celeiro e o Armazém ainda por erguer aparecem como "Construir", com o que mudam', () => {
      // Antes do Salão Nv2: bloqueados, com o motivo.
      const locked = find(buildTree({ ...input, view: farmers }), 'construction:granary');
      expect(locked).toMatchObject({
        label: 'Construir: Celeiro',
        description: '160 madeira, 80 pedra · 10 min',
        icon: 'lock',
        contextValue: 'lords.blockedUpgrade',
      });
      expect(locked?.tooltip).toBe(
        [
          '160 madeira, 80 pedra · 10 min',
          'Capacidade de comida: 500 → 1.000.',
          'Melhore antes o Salão do Senhor para o nível 2.',
        ].join('\n'),
      );
      // Liberado e pago: a linha ganha o botão "Construir".
      const open = withUpgrade(unlockedView, 'warehouse', {
        affordable: true,
        blockedCode: null,
        blockedReason: null,
      });
      expect(find(buildTree({ ...input, view: open }), 'construction:warehouse')).toMatchObject({
        label: 'Construir: Armazém',
        icon: 'check',
        contextValue: 'lords.newBuilding',
      });
      expect(upgradeName({ label: 'Celeiro', fromLevel: 1, targetLevel: 2 })).toBe(
        'Celeiro Nv1 → Nv2',
      );
    });

    it('a obra em andamento diz o que o cancelamento devolve e o que se perderia', () => {
      const tight = withQueues(farmers, [
        activeConstruction({
          refund: [
            { resource: 'wood', label: 'Madeira', amount: 30, lost: 50 },
            { resource: 'stone', label: 'Pedra', amount: 40, lost: 0 },
          ],
        }),
      ]);
      expect(find(buildTree({ ...input, view: tight }), 'active:lumberMill')?.tooltip).toContain(
        'Cancelar devolve 30 madeira, 40 pedra. Não cabem no depósito e se perderiam: 50 madeira.',
      );
      expect(refundParts([{ resource: 'wood', label: 'Madeira', amount: 0, lost: 64 }])).toEqual({
        back: null,
        lost: '64 madeira',
      });
      expect(refundSentence([], 'Voltam')).toBe('Nada volta ao estoque.');
      // Nas frases do painel, a lista fecha com "e".
      const three = [
        { resource: 'wood', label: 'Madeira', amount: 120, lost: 0 },
        { resource: 'stone', label: 'Pedra', amount: 80, lost: 0 },
        { resource: 'gold', label: 'Ouro', amount: 80, lost: 0 },
      ] as const;
      expect(refundSentence(three, 'Cancelar devolve', 'sentence')).toBe(
        'Cancelar devolve 120 madeira, 80 pedra e 80 ouro.',
      );
      expect(refundSentence(three, 'Voltam')).toBe('Voltam 120 madeira, 80 pedra, 80 ouro.');
    });
  });

  it('trabalhadores têm ações inline de mais e menos', () => {
    const tree = buildTree(input);
    expect(find(tree, 'workers')?.description).toBe('2/5 alocados · 3 livres');
    expect(find(tree, 'worker:farm')).toMatchObject({
      label: 'Fazenda Nv1',
      // Os dois lavradores acabaram de chegar: a linha diz que ainda se adaptam.
      description: '2 · 12/h · 2 em adaptação',
      contextValue: 'lords.worker',
      // O clique só abre o painel; quem aloca são os botões + e − do item.
      command: { id: 'lords.openPanel', args: ['fief'] },
    });
    expect(find(tree, 'worker:lumberMill')?.description).toBe('0 · 0/h');
  });

  describe('troca de ofício e experiência (GDD §5.3 e §5.4)', () => {
    const tree = buildTree({ ...input, view: craftsView });
    const rules = craftsView.workersRules;

    it('cada edifício diz quem se adapta e se o ofício está se perdendo', () => {
      expect(
        ['farm', 'lumberMill', 'quarry', 'goldMine'].map(
          (building) => find(tree, `worker:${building}`)?.description,
        ),
      ).toEqual([
        '4 · 61,2/h · 2 em adaptação',
        '4 · 41,6/h',
        '2 · 11,1/h · 1 em adaptação',
        // Vazia e perdendo experiência: o alerta é texto, não só um sinal.
        '0 · 0/h · ⚠ o ofício se perde',
      ]);
    });

    it('a explicação traz a conta da taxa, a experiência com o porquê e o custo de um a mais', () => {
      expect(find(tree, 'worker:farm')?.tooltip?.split('\n')).toEqual([
        '4 trabalhadores (2 em adaptação por 38 min, valendo metade: contam como 3) × 10 × 1,4 (Nv3) × 1,12 (mestria 40) × 1,3 (outono) = 61,15/h',
        'Experiência 40/100, subindo · +12% de produção. A experiência sobe 4 a cada virada do dia enquanto houver ao menos 3 trabalhadores.',
        `+1 aqui: +10,2/h agora, +20,4/h depois de 2 h. ${rules.adaptationText}`,
      ]);
      expect(find(tree, 'worker:lumberMill')?.tooltip).toContain(
        'Ofício dominado · +30% de produção. Ofício dominado: 30% a mais de produção.',
      );
      expect(find(tree, 'worker:goldMine')?.tooltip).toContain(
        'Sem ninguém na Mina de Ouro, o ofício se perde',
      );
    });

    it('o "+" da linha leva o custo da troca na dica; o "−" não tem o que avisar', () => {
      expect(find(tree, 'worker:lumberMill')?.actionHints).toEqual({
        'lords.workersIncrease': '+5,2/h agora, +10,4/h depois de 2 h',
      });
    });

    it('a linha "Trabalhadores" explica as regras, nas frases do servidor', () => {
      expect(find(tree, 'workers')?.tooltip?.split('\n')).toEqual([
        rules.adaptationText,
        rules.removalText,
        rules.experienceText,
      ]);
    });
  });

  describe('incursão e feridos (GDD §8.2)', () => {
    it('a linha do feudo diz que há uma incursão a caminho, por extenso, e a explicação traz o aviso', () => {
      const fief = buildTree({ ...input, view: threatIncomingView })[1];
      expect(fief?.description).toBe('Outono, dia 5 · incursão a caminho');
      expect(fief?.tooltip?.split('\n')).toContain(
        'Lobos a caminho. Os vigias contam uma matilha grande.',
      );
      expect(buildTree({ ...input, view: threatWatchedView })[1]?.description).toBe(
        'Outono, dia 5',
      );
    });

    it('a linha "Hoje" conta o ataque entre o que há a preparar', () => {
      const today = buildTree({ ...input, view: threatIncomingView })[0];
      expect(today?.description).toBe('⚠ 4 a preparar');
      expect(today?.tooltip?.split('\n')[1]).toBe(
        'Lobos a caminho. Os vigias contam uma matilha grande. Chegada em 16 min. Sem Paliçada, nada segura este ataque.',
      );
    });

    it('os feridos têm a sua parcela na linha "Trabalhadores" e a marca em cada ofício', () => {
      const tree = buildTree({ ...input, view: raidAftermathView });
      // Doze aldeões: dez com ofício, nenhum livre, dois feridos.
      expect(find(tree, 'workers')?.description).toBe('10/12 alocados · 0 livres · 2 feridos');
      expect(find(tree, 'workers')?.tooltip?.split('\n')[0]).toBe(
        '2 aldeões feridos na incursão: não trabalham até sarar. Saram em 20 min; quem tinha ofício volta a ele sozinho.',
      );
      expect(
        ['farm', 'lumberMill', 'quarry', 'goldMine'].map(
          (building) => find(tree, `worker:${building}`)?.description,
        ),
      ).toEqual(['3 · 152,7/h · 1 ferido', '3 · 78,3/h · 1 ferido', '2 · 32,6/h', '2 · 28,7/h']);
    });

    it('sem feridos a linha fica como sempre foi', () => {
      const tree = buildTree({ ...input, view: threatWatchedView });
      expect(find(tree, 'workers')?.description).toBe('12/12 alocados · 0 livres');
    });
  });

  it('construções mostram a obra ativa com o tempo restante e as melhorias disponíveis', () => {
    const tree = buildTree({ ...input, elapsedSeconds: 600 });
    expect(find(tree, 'active:lumberMill')).toMatchObject({
      label: 'Serraria → Nv2',
      description: '00:32',
      contextValue: 'lords.activeConstruction',
    });
    const hall = find(tree, 'construction:townHall');
    // Clicar em uma melhoria nunca gasta recursos: abre o painel. Começar a obra é o botão do item.
    expect(hall).toMatchObject({
      icon: 'lock',
      contextValue: 'lords.blockedUpgrade',
      command: { id: 'lords.openPanel', args: ['fief'] },
    });
    expect(find(tree, 'active:lumberMill')?.tooltip).toContain(
      'Cancelar devolve 80 madeira, 40 pedra.',
    );
    expect(hall?.tooltip).toContain('Faltam 30 madeira e 35 pedra.');
    expect(find(buildTree({ ...input, view: farmers }), 'construction:farm')).toMatchObject({
      label: 'Fazenda Nv1 → Nv2',
      description: '80 madeira, 40 ouro · 5 min',
      icon: 'check',
      contextValue: 'lords.upgrade',
    });
  });

  describe('filas de obras e planejadas (GDD §6.3)', () => {
    const queued = { ...input, view: queuesView };

    it('com duas filas, cada obra em curso é uma linha, com o edifício no id e o seu Cancelar', () => {
      const tree = buildTree(queued);
      expect(find(tree, 'active:lumberMill')).toMatchObject({
        label: 'Serraria → Nv2',
        description: '00:03',
        contextValue: 'lords.activeConstruction',
      });
      expect(find(tree, 'active:goldMine')).toMatchObject({
        label: 'Mina de Ouro → Nv2',
        description: '00:06',
        contextValue: 'lords.activeConstruction',
      });
      expect(find(tree, 'active:goldMine')?.tooltip).toContain(
        'Cancelar devolve 96 madeira, 64 pedra.',
      );
    });

    it('a linha "Construções" resume as obras, a fila que sobra e quantas planejadas esperam', () => {
      expect(find(buildTree(queued), 'constructions')?.description).toBe(
        'Serraria · 00:03, Mina de Ouro · 00:06 · 5 planejadas',
      );
      const oneFree = withQueues(queuesView, [null, activeConstruction()]);
      expect(find(buildTree({ ...input, view: oneFree }), 'constructions')?.description).toBe(
        'Serraria · 00:42 · 1 fila livre · 5 planejadas',
      );
      // Com uma fila só, ocupada, não há fila livre a anunciar.
      expect(find(buildTree(input), 'constructions')?.description).toBe('Serraria · 00:42');
      const idle = withPlanned(farmers, [{ building: 'farm' }]);
      expect(find(buildTree({ ...input, view: idle }), 'constructions')?.description).toBe(
        'nenhuma obra em andamento · 1 planejada',
      );
      expect(find(buildTree({ ...input, view: farmers }), 'constructions')?.description).toBe(
        'nenhuma obra em andamento',
      );
    });

    it('enquanto a segunda fila está fechada, a explicação da linha diz o que a abre', () => {
      expect(find(buildTree(input), 'constructions')?.tooltip).toBe(
        'A segunda fila abre com o Salão do Senhor Nv4.',
      );
      expect(find(buildTree(queued), 'constructions')?.tooltip).toBeUndefined();
    });

    it('as planejadas têm o seu grupo, na ordem da lista, com a marca por extenso e o que cada uma espera', () => {
      const group = find(buildTree(queued), 'planned');
      expect(group).toMatchObject({
        label: 'Planejadas',
        description: '4 automáticas, 1 manual',
        expanded: true,
      });
      // O grupo só abre e fecha: não navega nem dá ordem.
      expect(group?.command).toBeUndefined();
      const planned = group?.children ?? [];
      expect(planned.map((node) => [node.id, node.label, node.description])).toEqual([
        [
          'planned:lumberMill',
          'Serraria → Nv3',
          'automática · espera a obra da Serraria terminar: em 3 min',
        ],
        [
          'planned:housing',
          'Habitações → Nv2',
          'manual · espera os pedreiros terminarem outra obra: em 3 min',
        ],
        ['planned:farm', 'Fazenda → Nv2', 'automática · espera 15 de ouro: em 1 h 51 min'],
        [
          'planned:townHall',
          'Salão do Senhor → Nv5',
          'automática · não cabe no Pátio: construa o Armazém',
        ],
        [
          'planned:quarry',
          'Pedreira → Nv6',
          'automática · espera o Salão do Senhor chegar ao nível 5: melhore-o',
        ],
      ]);
      expect(planned.map((node) => node.contextValue)).toEqual([
        'lords.plannedAuto',
        'lords.plannedManual',
        'lords.plannedAuto',
        'lords.plannedAuto',
        'lords.plannedAuto',
      ]);
      // Clicar na linha só navega; a marca muda no botão da linha.
      expect(planned.every((node) => node.command?.id === 'lords.openPanel')).toBe(true);
      expect(planned[2]?.tooltip).toBe(
        [
          'Planejada, com início automático: os pedreiros começam sozinhos quando puderem.',
          'Fazenda Nv1 → Nv2 · 80 madeira, 40 ouro · 5 min',
          'Espera 15 de ouro: em 1 h 51 min.',
        ].join('\n'),
      );
      expect(planned[1]?.tooltip).toContain('Planejada: espera a sua ordem para começar.');
    });

    it('o grupo conta as marcas no singular e no plural, e some sem planejadas', () => {
      const one = withPlanned(farmers, [{ building: 'farm' }]);
      expect(find(buildTree({ ...input, view: one }), 'planned')?.description).toBe('1 manual');
      const mixed = withPlanned(farmers, [
        { building: 'farm', autoStart: true },
        { building: 'housing' },
        { building: 'quarry' },
      ]);
      expect(find(buildTree({ ...input, view: mixed }), 'planned')?.description).toBe(
        '1 automática, 2 manuais',
      );
      expect(find(buildTree({ ...input, view: farmers }), 'planned')).toBeUndefined();
    });

    it('uma planejada manual sem espera diz que já pode começar', () => {
      const ready = withPlanned(farmers, [{ building: 'farm' }]);
      expect(find(buildTree({ ...input, view: ready }), 'planned:farm')).toMatchObject({
        label: 'Fazenda → Nv2',
        description: 'manual · pode começar agora',
        contextValue: 'lords.plannedManual',
      });
    });

    it('a planejada do que ainda não existe não fala em "Nv0" nem em "Nv1"', () => {
      const fresh = withPlanned(unlockedView, [{ building: 'granary', autoStart: true }]);
      expect(find(buildTree({ ...input, view: fresh }), 'planned:granary')?.label).toBe(
        'Construir: Celeiro',
      );
    });

    it('as planejadas ficam entre as obras em curso e as que podem ser ordenadas', () => {
      const kinds = (find(buildTree(queued), 'constructions')?.children ?? []).map(
        (node) => node.id.split(':')[0],
      );
      expect([...new Set(kinds)]).toEqual(['active', 'planned', 'construction']);
    });
  });

  it('a Crônica traz as 5 últimas linhas, da mais nova para a mais antiga', () => {
    const chronicle = find(buildTree(input), 'chronicle');
    expect(chronicle?.description).toBe('linha 7');
    expect(chronicle?.children?.map((node) => node.label)).toEqual([
      'linha 7',
      'linha 6',
      'linha 5',
      'linha 4',
      'linha 3',
    ]);
    expect(find(buildTree({ ...input, chronicle: [] }), 'chronicle')?.description).toBe(
      'nada a contar ainda',
    );
  });

  it('a conta oferece vincular, Código do Reino, sair e excluir', () => {
    const anonymous = find(buildTree(input), 'account');
    expect(anonymous).toMatchObject({ label: 'Conta: Gustavo', description: 'anônima' });
    expect(anonymous?.children?.map((node) => node.command?.id)).toEqual([
      'lords.linkGithub',
      'lords.generateRecoveryCode',
      'lords.privacy',
      'lords.signOut',
      'lords.deleteAccount',
    ]);
    const linked = find(
      buildTree({ ...input, account: { ...account, kind: 'linked', hasRecoveryCode: true } }),
      'account',
    );
    expect(linked?.description).toBe('GitHub');
    expect(linked?.children?.map((node) => node.label)).toEqual([
      'Trocar o Código do Reino',
      'Privacidade',
      'Sair desta máquina',
      'Excluir conta…',
    ]);
  });

  it('mostra novidades, fome e falta de ligação', () => {
    expect(buildTree({ ...input, unseen: 2 })[0]?.description).toBe('● 2 novidades');
    expect(buildTree({ ...input, unseen: 1 })[0]?.description).toBe('● 1 novidade');
    expect(buildTree({ ...input, connection: offline })[0]).toMatchObject({
      description: 'sem ligação com o reino',
      icon: 'debug-disconnect',
    });
    expect(buildTree({ ...input, view: starving })[1]).toMatchObject({
      description: 'Primavera, dia 1 · fome',
      icon: 'warning',
    });
  });

  it('o feudo diz a estação e, na explicação, o que ela muda', () => {
    const spring = buildTree(input)[1];
    expect(spring?.tooltip).toBe('Primavera: comida × 1,2; recrutamento com prazo × 0,8.');
    const autumn = buildTree({ ...input, view: autumnView })[1];
    expect(autumn).toMatchObject({
      description: 'Outono, dia 23',
      icon: 'shield',
      tooltip: 'Outono: comida × 1,3; ouro × 1,1.',
    });
    // Fora do inverno não há lareira na árvore.
    expect(autumn?.children?.map((node) => node.id)).toEqual([
      'resources',
      'workers',
      'constructions',
      'council',
      'morale',
      'threat',
      'objectives',
    ]);
  });

  it('as taxas da árvore trazem o fator da estação na explicação', () => {
    const tree = buildTree({ ...input, view: autumnView });
    // A conta da taxa, de onde vem o limite e por que não há previsão de encher.
    expect(find(tree, 'resource:food')?.tooltip).toBe(
      [
        'Fazenda: 10 trabalhadores × 10 × 1,2 (Nv2) × 1,3 (outono) = 156/h; consumo 18 × 1 = 18/h',
        'Celeiro Nv3: 2.200',
        'Não enche antes da virada para o Inverno.',
      ].join('\n'),
    );
    // A primeira linha da explicação de um edifício é a conta da taxa.
    expect(find(tree, 'worker:goldMine')?.tooltip?.split('\n')[0]).toBe(
      '3 trabalhadores × 4 × 1 (Nv1) × 1,1 (outono) = 13,2/h',
    );
  });

  it('no inverno, a lareira mostra a lenha por hora e em quanto tempo a madeira acaba', () => {
    const lit = winterWith({ stock: 90, missing: 59, depletesInSeconds: 36_000 });
    const tree = buildTree({ ...input, view: lit });
    expect(tree[1]).toMatchObject({ description: 'Inverno, dia 4', icon: 'shield' });
    expect(tree[1]?.tooltip).toContain('a lareira queima 0,5 de madeira por habitante por hora');
    expect(tree[1]?.children?.map((node) => node.id)).toEqual([
      'resources',
      'workers',
      'constructions',
      'council',
      'morale',
      'threat',
      'hearth',
      'objectives',
    ]);
    expect(find(tree, 'hearth')).toMatchObject({
      label: 'Lareira',
      description: '9/h de madeira · acaba em 10 h',
      icon: 'flame',
      tooltip: lit.winter?.firewood.text,
      // Como todo item da árvore, o clique só navega.
      command: { id: 'lords.openPanel', args: ['fief'] },
    });
    expect(find(tree, 'resource:wood')).toMatchObject({
      description: '90/1.000 (−9/h) · acaba em 10 h',
    });
    expect(find(tree, 'resource:wood')?.tooltip).toContain('−9/h (lenha de 18 habitantes)');
  });

  describe('moral (GDD §5.7)', () => {
    it('a linha "Moral" diz o número e a faixa, com o ícone da faixa; o clique só navega', () => {
      const tree = buildTree({ ...input, view: initial });
      expect(find(tree, 'morale')).toMatchObject({
        label: 'Moral',
        description: '50 (Contente) · sobe para 60',
        icon: 'smiley',
        command: { id: 'lords.openPanel', args: ['fief'] },
      });
      expect(find(tree, 'morale')?.contextValue).toBeUndefined();
      expect(find(buildTree({ ...input, view: proudView }), 'morale')).toMatchObject({
        description: '80 (Orgulhoso)',
        icon: 'star-full',
      });
      expect(find(buildTree({ ...input, view: impoverishedView }), 'morale')).toMatchObject({
        description: '0 (Desesperado)',
        icon: 'thumbsdown',
      });
    });

    it('a moral que vai cair leva o alerta, com a faixa a que desce', () => {
      const tree = buildTree({ ...input, view: coldView });
      expect(find(tree, 'morale')?.description).toBe('60 (Contente) · ⚠ cai para 40 (Inquieto)');
    });

    it('a explicação é a do servidor, uma frase por linha: o fator, a virada, a conta, o conselho e o povo', () => {
      const tree = buildTree({ ...input, view: impoverishedView, elapsedSeconds: 600 });
      expect(find(tree, 'morale')?.tooltip?.split('\n')).toEqual([
        'Moral 0 (Desesperado): produção × 0,75.',
        'A moral só muda na virada do dia: na próxima, continua em 0.',
        // O prazo desconta o tempo desde a leitura: 1 h 40 min menos 10 min.
        'A conta dessa virada, daqui a 1 h 30 min: 50 (base) − 20 (fome) − 42 (21 dias inteiros de fome) − 20 (frio) = −32; a moral não desce de 0.',
        'O que mais pesa é a fome (−62). Ponha mais gente na Fazenda: quando a comida voltar a sobrar, a fome acaba e a moral sobe na virada seguinte.',
        'Restam 3 aldeões: com 3 ou menos, ninguém mais parte nem deserta.',
      ]);
      // Sem conselho e sem frases do povo, a explicação acaba na conta.
      expect(
        find(buildTree({ ...input, view: initial }), 'morale')?.tooltip?.split('\n'),
      ).toHaveLength(3);
    });
  });

  it('com lenha para o resto do inverno, a árvore não anuncia um fim que não vem', () => {
    const enough = winterWith({ stock: 900, missing: 0, depletesInSeconds: 360_000 });
    const tree = buildTree({ ...input, view: enough });
    expect(find(tree, 'hearth')?.description).toBe('9/h de madeira');
    expect(find(tree, 'hearth')?.tooltip).toContain('O estoque e a Serraria dão conta.');
    expect(find(tree, 'resource:wood')?.description).toBe('900/1.000 (−9/h)');
  });

  it('com frio, o feudo avisa com ícone e texto próprios, diferentes dos da fome', () => {
    const tree = buildTree({ ...input, view: coldView });
    expect(tree[1]).toMatchObject({ description: 'Inverno, dia 4 · frio', icon: 'flame' });
    expect(tree[1]?.tooltip).toContain('Frio: sem lenha');
    expect(find(tree, 'hearth')).toMatchObject({
      description: 'sem lenha · frio há 50 min',
      tooltip: coldView.winter?.cold?.text,
    });
    // Os dois juntos: os dois por extenso, e o ícone é o da fome.
    const both = buildTree({ ...input, view: { ...coldView, famine: starving.famine } })[1];
    expect(both).toMatchObject({ description: 'Inverno, dia 4 · fome · frio', icon: 'warning' });
    expect(both?.tooltip).toContain('Fome: a produção cai para 75%.');
    expect(both?.tooltip).toContain('Frio: sem lenha');
  });

  it('a comida que acaba depois da virada de estação diz o prazo, e a explicação traz a conta', () => {
    const ahead = withFoodAhead(autumnView, FOOD_RUNS_OUT_AHEAD, 3600);
    const food = find(buildTree({ ...input, view: ahead }), 'resource:food');
    const row = autumnView.resources.find((entry) => entry.id === 'food');
    // A taxa é a de agora, positiva; o prazo é o da previsão do servidor.
    expect(food?.description).toMatch(/\(\+[\d,]+\/h\) · acaba em 8 h$/);
    expect(food?.tooltip?.split('\n')).toEqual([
      row?.breakdown,
      'Celeiro Nv3: 2.200',
      'Não enche antes da virada para o Inverno.',
      FOOD_RUNS_OUT_AHEAD.text,
    ]);
    // Sem a previsão, a linha e a explicação são as de sempre.
    const plain = find(buildTree({ ...input, view: autumnView }), 'resource:food');
    expect(plain?.description).not.toContain('acaba em');
    expect(plain?.tooltip).not.toContain('a virada encontra');
  });

  it('um estoque que está acabando diz em quanto tempo', () => {
    expect(find(buildTree({ ...input, view: initial }), 'resource:food')?.description).toBe(
      '180/500 (−5/h) · acaba em 36 h',
    );
  });

  it('a explicação de uma obra diz por que o prazo é esse na estação', () => {
    const farm = find(buildTree({ ...input, view: coldView }), 'construction:farm');
    expect(farm?.description).toBe('128 madeira, 64 ouro · 12 min');
    expect(farm?.tooltip).toBe(
      [
        '128 madeira, 64 ouro · 12 min',
        'No Inverno, o prazo de uma obra iniciada agora é × 1,5.',
        'Faltam 128 madeira.',
      ].join('\n'),
    );
    // Sem nota e sem bloqueio, só o custo e o prazo.
    expect(find(buildTree({ ...input, view: farmers }), 'construction:farm')?.tooltip).toBe(
      '80 madeira, 40 ouro · 5 min',
    );
  });

  describe('objetivos (GDD §12.2)', () => {
    it('a linha "Objetivos" conta os em aberto e os cumpridos, e abre com uma linha por objetivo', () => {
      const tree = buildTree({ ...input, view: unlockedView });
      const node = find(tree, 'objectives');
      expect(node).toMatchObject({
        label: 'Objetivos',
        description: '3 em aberto · 4 cumpridos',
        icon: 'target',
        expanded: true,
        // O clique só navega, como em toda linha.
        command: { id: 'lords.openPanel', args: ['fief'] },
      });
      // Os cumpridos não ganham linha: ficam na explicação do grupo, pelo título.
      expect(node?.tooltip).toBe(
        'Cumpridos: Aloque 2 aldeões na Fazenda; Inicie a melhoria das Habitações; ' +
          'Recrute 3 aldeões; Alcance o Salão do Senhor Nv2.',
      );
      expect(node?.children?.map((child) => child.id)).toEqual([
        'objective:buildWatchtower',
        'objective:answerFirstCard',
        'objective:buildGranaryOrWarehouse',
      ]);
    });

    it('cada objetivo diz o progresso e a recompensa; a explicação traz o porquê e o que falta', () => {
      const start = buildTree({ ...input, view: initial });
      expect(find(start, 'objectives')?.description).toBe('3 em aberto');
      expect(find(start, 'objective:allocateFarmers')).toMatchObject({
        label: 'Aloque 2 aldeões na Fazenda',
        description: '0/2 · +20 ouro',
        tooltip: [
          'Comida é o que mantém todo o resto.',
          'Recompensa: +20 ouro.',
          'Faltam 2 aldeões na Fazenda.',
        ].join('\n'),
        icon: 'target',
        command: { id: 'lords.openPanel', args: ['fief'] },
      });
      // A recompensa de moral, como o servidor a escreveu, com o prazo de relógio.
      const tree = buildTree({ ...input, view: unlockedView });
      expect(find(tree, 'objective:answerFirstCard')).toMatchObject({
        label: 'Responda à primeira carta do Conselho',
        description: '+10 de moral por 1 dia de jogo (2 h)',
        tooltip: [
          'Quem se cala deixa o conselho decidir em seu lugar.',
          'Recompensa: +10 de moral por 1 dia de jogo (2 h).',
          'Nenhuma carta espera resposta: vale a próxima que o Conselho trouxer.',
        ].join('\n'),
      });
    });

    it('o botão da linha é o comando que leva a cumprir o objetivo, com o custo da obra na dica', () => {
      const start = buildTree({ ...input, view: initial });
      const housing = find(start, 'objective:upgradeHousing');
      expect(housing?.action).toEqual({
        command: 'lords.build',
        arg: 'housing',
        label: 'Melhorar Habitações: Inicie a melhoria das Habitações',
        text: 'Melhorar',
      });
      expect(housing?.actionHints).toEqual({ 'lords.build': '80 madeira, 20 pedra · 4 min' });
      expect(housing?.tooltip?.split('\n').at(-1)).toBe(
        'Pode começar agora: 80 madeira, 20 pedra · 4 min.',
      );
      // A obra travada: o botão só leva às construções, e não há custo a anunciar.
      const tower = find(buildTree({ ...input, view: unlockedView }), 'objective:buildWatchtower');
      expect(tower?.action).toEqual({
        command: 'lords.openPanel',
        arg: 'constructions',
        label: 'Ver as obras: Construa a Torre de Vigia',
        text: 'Ver',
      });
      expect(tower?.actionHints).toBeUndefined();
      // O inverno: nada a ordenar.
      const winter = find(
        buildTree({ ...input, view: lateObjectivesView }),
        'objective:surviveWinterWithoutCold',
      );
      expect(winter?.action).toBeUndefined();
      expect(winter?.description).toBe('+15 de moral por 1 dia de jogo (2 h)');
    });

    it('com tudo cumprido, a linha fica sem filhos, com o visto e a frase que não promete nada', () => {
      const node = find(buildTree({ ...input, view: autumnView }), 'objectives');
      expect(node).toMatchObject({ description: '10 cumpridos', icon: 'pass', children: [] });
      expect(node?.tooltip?.split('\n')[0]).toBe(
        'Nenhum objetivo em aberto agora: o que havia a cumprir está cumprido.',
      );
    });
  });

  it('conta sem partida carregada oferece abrir o painel', () => {
    const tree = buildTree({ ...input, view: null, account: { ...account, gameId: null } });
    expect(tree.map((node) => node.label)).toEqual([
      'Fundar um feudo',
      'Conta: Gustavo',
      'Configurações',
    ]);
  });
});

describe('Relatório de Retorno', () => {
  it('só aparece com 4 horas ou mais de ausência', () => {
    const now = 100 * HOUR;
    expect(shouldShowReturnReport(now - 4 * HOUR, now)).toBe(true);
    expect(shouldShowReturnReport(now - 4 * HOUR + 1, now)).toBe(false);
    expect(shouldShowReturnReport(null, now)).toBe(false);
  });

  it('diz o que mudou nos estoques e se a fome começou, acabou ou continua', () => {
    const event = (type: GameEvent['type']): GameEvent => ({
      seq: 1,
      type,
      at: '2026-10-01T12:00:00.000Z',
      atMs: 0,
      text: type,
      data: {},
    });
    const none = buildReturnReport(farmers, farmers, [event('dayStarted')], 5 * HOUR);
    expect(none).toMatchObject({ awaySeconds: 18_000, famine: 'none', highlights: [] });
    expect(none.counts.daysPassed).toBe(1);
    expect(none.resources.every((row) => row.delta === 0)).toBe(true);

    expect(buildReturnReport(initial, starving, [event('famineStarted')], HOUR).famine).toBe(
      'started',
    );
    expect(buildReturnReport(starving, starving, [], HOUR).famine).toBe('ongoing');
    expect(buildReturnReport(starving, farmers, [event('famineEnded')], HOUR).famine).toBe('ended');
    // Sem visão anterior não há o que comparar: nenhuma linha, em vez de "nada mudou".
    expect(buildReturnReport(null, farmers, [event('dayStarted')], HOUR)).toMatchObject({
      resources: [],
      counts: { daysPassed: 1 },
    });
  });

  describe('moral e gente (GDD §5.6 e §5.7)', () => {
    let seq = 0;
    const event = (type: GameEvent['type'], text: string = type): GameEvent => ({
      seq: (seq += 1),
      type,
      at: '2026-10-01T12:00:00.000Z',
      atMs: 0,
      text,
      data: {},
    });

    it('conta, pelos eventos, os colonos que chegaram, quem partiu e quem desertou', () => {
      const events = [
        event('dayStarted'),
        event('villagerArrived', 'Um colono bateu ao portão.'),
        event('recruitmentFinished'),
        event('villagerLeft', 'Um lenhador juntou a trouxa.'),
        event('villagerDeserted', 'Um aldeão sem ofício fugiu da fome.'),
        event('villagerDeserted', 'Um lavrador fugiu da fome.'),
        event('moraleBandChanged', 'O povo anda inquieto.'),
      ];
      const report = buildReturnReport(coldView, impoverishedView, events, 30 * HOUR);
      expect(report.counts).toMatchObject({
        settlersArrived: 1,
        villagersLeft: 1,
        villagersDeserted: 2,
        // Os recrutados continuam na sua contagem: o colono não entra nela.
        villagersArrived: 1,
      });
      // Todos são linhas da Crônica: entram na lista do que ler, na ordem em que aconteceram.
      expect(report.highlights).toEqual([
        'Um colono bateu ao portão.',
        'recruitmentFinished',
        'Um lenhador juntou a trouxa.',
        'Um aldeão sem ofício fugiu da fome.',
        'Um lavrador fugiu da fome.',
        'O povo anda inquieto.',
      ]);
      expect(ReturnReportSchema.safeParse(report).success).toBe(true);
    });

    it('diz a moral de agora e a da última visita, com as faixas que a visão traz', () => {
      const report = buildReturnReport(coldView, impoverishedView, [], 30 * HOUR);
      expect(report.morale).toEqual({
        value: 0,
        band: 'desperate',
        bandLabel: 'Desesperado',
        before: { value: 60, band: 'content', bandLabel: 'Contente' },
      });
      expect(buildReturnReport(farmers, proudView, [], 30 * HOUR).morale).toEqual({
        value: 80,
        band: 'proud',
        bandLabel: 'Orgulhoso',
        before: { value: 50, band: 'content', bandLabel: 'Contente' },
      });
    });

    it('sem a visão guardada, só a moral de agora; sem eventos, as contagens são zero', () => {
      const report = buildReturnReport(null, proudView, [], 5 * HOUR);
      expect(report.morale).toEqual({ value: 80, band: 'proud', bandLabel: 'Orgulhoso' });
      expect(report.counts).toMatchObject({
        settlersArrived: 0,
        villagersLeft: 0,
        villagersDeserted: 0,
      });
      expect(ReturnReportSchema.safeParse(report).success).toBe(true);
    });
  });

  describe('produção, gasto e perda (GDD §5.5)', () => {
    let seq = 0;
    const event = (
      type: GameEvent['type'],
      data: GameEvent['data'] = {},
      text: string = type,
    ): GameEvent => ({
      seq: (seq += 1),
      type,
      at: '2026-10-01T12:00:00.000Z',
      atMs: 0,
      text,
      data,
    });
    const stocks = (view: ViewState, patch: Partial<Record<string, Partial<Row>>>): ViewState => ({
      ...view,
      resources: view.resources.map((row) => ({ ...row, ...patch[row.id] })),
    });
    type Row = ViewState['resources'][number];
    const row = (report: ReturnType<typeof buildReturnReport>, id: Row['id']) =>
      report.resources.find((entry) => entry.id === id);

    // A ausência: uma obra paga, três aldeões recrutados, uma obra cancelada, um objetivo com a
    // recompensa cortada no limite, o Pátio cheio por dois dias e o Celeiro erguido.
    const before = stocks(farmers, {
      food: { stock: 180 },
      wood: { stock: 320, wastedToday: 5 },
      stone: { stock: 200 },
      gold: { stock: 270 },
    });
    const after = stocks(farmers, {
      food: { stock: 255 },
      wood: { stock: 500, wastedToday: 9 },
      stone: { stock: 164 },
      gold: { stock: 300 },
    });
    const events = [
      event('dayStarted'),
      event('constructionStarted', {
        building: 'granary',
        level: 1,
        spent_wood: 160,
        spent_stone: 80,
      }),
      event('recruitmentStarted', { quantity: 3, spent_food: 150, spent_gold: 30 }),
      event('constructionStarted', { building: 'farm', level: 2, spent_wood: 80, spent_gold: 40 }),
      event('constructionCancelled', {
        building: 'farm',
        level: 2,
        gained_wood: 30,
        gained_gold: 32,
      }),
      event('objectiveCompleted', { objective: 'recruitVillagers', gained_food: 14.8 }),
      event(
        'storageFilled',
        { resource: 'wood', building: 'warehouse', level: 0, cap: 500 },
        'O Pátio encheu.',
      ),
      event('storageWasted', { wasted_wood: 48 }, 'Foi ao chão: 48 de madeira.'),
      event('dayStarted'),
      event('storageWasted', { wasted_wood: 24, wasted_stone: 20 }, 'Foi ao chão de novo.'),
      event('buildingFounded', { building: 'granary', level: 1 }, 'Ergueu-se o Celeiro.'),
      event('constructionFinished', { building: 'housing', level: 2 }, 'As Habitações cresceram.'),
    ];
    const report = buildReturnReport(before, after, events, 6 * HOUR);

    it('gasto e recebido são a soma dos totais que os eventos trazem', () => {
      expect(row(report, 'wood')).toMatchObject({ spent: 240, received: 30 });
      expect(row(report, 'stone')).toMatchObject({ spent: 80, received: 0 });
      expect(row(report, 'food')).toMatchObject({ spent: 150, received: 14.8 });
      expect(row(report, 'gold')).toMatchObject({ spent: 70, received: 32 });
    });

    it('a produção é a variação mais o gasto menos o recebido: a variação sozinha mentiria', () => {
      // Madeira: 320 → 500 parece +180, mas o feudo pagou 240 e recebeu 30 de volta.
      expect(row(report, 'wood')).toMatchObject({ delta: 180, produced: 390 });
      // Pedra: 200 → 164 parece perda; foram 80 de obra e +44 de produção.
      expect(row(report, 'stone')).toMatchObject({ delta: -36, produced: 44 });
      // A recompensa cortada no limite vem fracionária do motor: uma casa, sem ruído.
      expect(row(report, 'food')).toMatchObject({ delta: 75, produced: 210.2 });
      expect(row(report, 'gold')).toMatchObject({ delta: 30, produced: 68 });
      for (const entry of report.resources) {
        expect(
          entry.before + (entry.produced ?? 0) - (entry.spent ?? 0) + (entry.received ?? 0),
        ).toBeCloseTo(entry.after, 6);
      }
    });

    it('o desperdício é o total dos fechos diários, mais o que a visão ainda não relatou', () => {
      // 48 + 24 dos dois fechos, mais 9 ainda por relatar, menos os 5 que a visão de antes já
      // contava (o primeiro fecho da ausência os inclui).
      expect(row(report, 'wood')?.wasted).toBe(76);
      expect(row(report, 'stone')?.wasted).toBe(20);
      expect(row(report, 'food')?.wasted).toBe(0);
      // O ouro não tem limite: nada se perde.
      expect(row(report, 'gold')?.wasted).toBe(0);
    });

    it('a recompensa cortada no limite: o evento diz o que não coube, e o corte não vira produção', () => {
      // A Despensa cheia (500) e ninguém na Fazenda: em cinco horas o feudo comeu 38,8. No meio
      // do caminho um objetivo rendeu +40 de comida: couberam 4,8, e 35,2 foram ao chão. O fecho
      // do dia relatou as 35 unidades inteiras.
      const full = stocks(farmers, { food: { stock: 500 } });
      const later = stocks(farmers, { food: { stock: 466 } });
      const cut = buildReturnReport(
        full,
        later,
        [
          event(
            'objectiveCompleted',
            { objective: 'recruitVillagers', gained_food: 4.8, lost_food: 35.2 },
            'Cumpriu-se um objetivo. Recompensa: +40 comida.',
          ),
          event('dayStarted'),
          event('storageWasted', { wasted_food: 35 }),
        ],
        5 * HOUR,
      );
      expect(row(cut, 'food')).toEqual({
        id: 'food',
        label: 'Comida',
        before: 500,
        after: 466,
        delta: -34,
        spent: 0,
        // O que entrou no estoque e, à parte, o que a recompensa perdeu.
        received: 4.8,
        cut: 35.2,
        // O perdido nunca é menos que o corte: o fecho do dia só conta unidades inteiras.
        wasted: 35.2,
        raided: 0,
        produced: -38.8,
      });
      expect(ReturnReportSchema.safeParse(cut).success).toBe(true);
      // A devolução de um cancelamento cortada no limite conta do mesmo jeito.
      const refund = buildReturnReport(
        stocks(farmers, { wood: { stock: 470 } }),
        stocks(farmers, { wood: { stock: 500, wastedToday: 34 } }),
        [
          event('constructionCancelled', {
            building: 'housing',
            level: 1,
            gained_wood: 30,
            lost_wood: 34,
            gained_stone: 16,
          }),
        ],
        4 * HOUR,
      );
      expect(row(refund, 'wood')).toMatchObject({
        delta: 30,
        received: 30,
        cut: 34,
        wasted: 34,
        produced: 0,
      });
      // Eventos de antes desta chave (ou ganhos que couberam inteiros): nenhum corte.
      expect(row(report, 'food')?.cut).toBe(0);
    });

    it('sem virada de dia na ausência, o desperdício ainda aparece: vem do contador da visão', () => {
      const short = buildReturnReport(before, after, [], 4 * HOUR);
      expect(row(short, 'wood')?.wasted).toBe(4);
      expect(row(short, 'stone')?.wasted).toBe(0);
    });

    it('trinta dias cheios são trinta fechos e um total só: nenhuma linha por dia no relatório', () => {
      const month = Array.from({ length: 30 }, () =>
        event('storageWasted', { wasted_food: 120 }, 'A produção não coube e foi ao chão.'),
      );
      const long = buildReturnReport(farmers, farmers, month, 60 * HOUR);
      expect(row(long, 'food')?.wasted).toBe(3600);
      expect(long.highlights).toEqual([]);
    });

    it('a lista do que ler deixa de fora a virada de dia e o fecho do desperdício', () => {
      expect(report.highlights).toEqual([
        'constructionStarted',
        'recruitmentStarted',
        'constructionStarted',
        'constructionCancelled',
        'objectiveCompleted',
        'O Pátio encheu.',
        'Ergueu-se o Celeiro.',
        'As Habitações cresceram.',
      ]);
      expect(events.filter((entry) => !isChronicleEvent(entry)).map((entry) => entry.type)).toEqual(
        ['dayStarted', 'storageWasted', 'dayStarted', 'storageWasted'],
      );
    });

    it('a obra que começou sozinha é gasto como as outras e entra na lista do que ler', () => {
      const auto = [
        event(
          'constructionAutoStarted',
          { building: 'quarry', level: 2, spent_wood: 120, spent_gold: 30 },
          'Com as reservas cheias, os pedreiros começaram sozinhos a erguer a Pedreira ao 2º nível.',
        ),
        event('constructionStarted', {
          building: 'farm',
          level: 2,
          spent_wood: 80,
          spent_gold: 40,
        }),
        event(
          'constructionAutoStarted',
          { building: 'warehouse', level: 1, spent_wood: 160, spent_stone: 80 },
          'Com as reservas cheias, os pedreiros começaram sozinhos a levantar o Armazém.',
        ),
      ];
      const away = buildReturnReport(before, after, auto, 6 * HOUR);
      expect(row(away, 'wood')).toMatchObject({ spent: 360, produced: 540 });
      expect(row(away, 'stone')).toMatchObject({ spent: 80 });
      expect(row(away, 'gold')).toMatchObject({ spent: 70 });
      expect(away.highlights).toEqual([
        'Com as reservas cheias, os pedreiros começaram sozinhos a erguer a Pedreira ao 2º nível.',
        'constructionStarted',
        'Com as reservas cheias, os pedreiros começaram sozinhos a levantar o Armazém.',
      ]);
      expect(auto.every(isChronicleEvent)).toBe(true);
      expect(ReturnReportSchema.safeParse(away).success).toBe(true);
    });

    it('um edifício erguido do zero conta como obra concluída', () => {
      expect(report.counts).toMatchObject({ daysPassed: 2, constructionsFinished: 2 });
    });

    it('sem visão anterior não há linhas, e por isso nenhum número inventado', () => {
      expect(buildReturnReport(null, after, events, 6 * HOUR).resources).toEqual([]);
    });

    it('o relatório montado passa no schema do protocolo', () => {
      expect(ReturnReportSchema.safeParse(report).success).toBe(true);
    });
  });
});
