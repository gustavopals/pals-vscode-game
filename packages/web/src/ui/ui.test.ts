import { type GameEvent, ReturnReportSchema, type ViewState } from '@lotg/protocol';
import { describe, expect, it } from 'vitest';

import golden from '../../../engine/src/__golden__/view-seed-pedra-alta.json';
import type { AccountState } from '../account/accountService';
import { buildReturnReport, isChronicleEvent, shouldShowReturnReport } from '../game/returnReport';
import {
  autumnView,
  coldView,
  unlockedView,
  winterWith,
  withResource,
  withUpgrade,
} from '../test-helpers';
import {
  capExplanation,
  fillsSoon,
  firewoodRunsOutIn,
  formatApprox,
  formatCost,
  formatDuration,
  formatNumber,
  formatRate,
  formatRemaining,
  FULL_SOON_SECONDS,
  refundParts,
  refundSentence,
  remainingNow,
  runsOutIn,
  statusBar,
  storageAlert,
  truncate,
  upgradeName,
} from './format';
import { buildTree, type TreeNode } from './treeModel';

const initial = golden.initial as unknown as ViewState;
const farmers = golden.afterFirstAllocation as unknown as ViewState;
const HOUR = 3_600_000;

const building: ViewState = {
  ...farmers,
  constructions: {
    ...farmers.constructions,
    active: {
      building: 'lumberMill',
      label: 'Serraria',
      targetLevel: 2,
      secondsRemaining: 2520,
      totalSeconds: 3000,
      progressPercent: 16,
      refund: [
        { resource: 'wood', label: 'Madeira', amount: 80, lost: 0 },
        { resource: 'stone', label: 'Pedra', amount: 40, lost: 0 },
      ],
    },
  },
};
const starving: ViewState = {
  ...building,
  famine: { sinceMs: 0, secondsElapsed: 60, text: 'Fome: a produção cai para 75%.' },
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
    expect(statusBar({ ...base, view: farmers }).text).toBe('$(home) Pedra Alta · +19 comida/h');
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
    expect(statusBar({ ...base, view: lit }).text).toBe('$(home) Pedra Alta · +20,4 comida/h');
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
      '$(home) Pedra Alta · +19 comida/h · $(bell) 2',
    );
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
    ]);
  });

  it('recursos mostram estoque e taxa com sinal; o tooltip explica o número', () => {
    const food = find(buildTree(input), 'resource:food');
    // O estoque sobre o limite e a taxa.
    expect(food).toMatchObject({ label: 'Comida', description: '180/500 (+19/h)' });
    expect(food?.tooltip).toContain('2 trabalhadores × 10');
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
      // 60.632 s no golden: quase 17 horas, mais do que uma ausência comum.
      expect(farmers.resources[0]?.fullInSeconds).toBe(60_632);
      expect(find(tree, 'resource:food')?.description).toBe('180/500 (+19/h)');
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
          'Capacidade de comida: 500 → 900.',
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
      const tight: ViewState = {
        ...building,
        constructions: {
          ...building.constructions,
          active: building.constructions.active && {
            ...building.constructions.active,
            refund: [
              { resource: 'wood', label: 'Madeira', amount: 30, lost: 50 },
              { resource: 'stone', label: 'Pedra', amount: 40, lost: 0 },
            ],
          },
        },
      };
      expect(find(buildTree({ ...input, view: tight }), 'construction:active')?.tooltip).toContain(
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
      description: '2 · 24/h',
      contextValue: 'lords.worker',
      // O clique só abre o painel; quem aloca são os botões + e − do item.
      command: { id: 'lords.openPanel', args: ['fief'] },
    });
  });

  it('construções mostram a obra ativa com o tempo restante e as melhorias disponíveis', () => {
    const tree = buildTree({ ...input, elapsedSeconds: 600 });
    expect(find(tree, 'construction:active')).toMatchObject({
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
    expect(find(tree, 'construction:active')?.tooltip).toContain(
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
    ]);
  });

  it('as taxas da árvore trazem o fator da estação na explicação', () => {
    const tree = buildTree({ ...input, view: autumnView });
    // A conta da taxa, de onde vem o limite e por que não há previsão de encher.
    expect(find(tree, 'resource:food')?.tooltip).toBe(
      [
        'Fazenda: 10 trabalhadores × 10 × 1,2 (Nv2) × 1,3 (outono) = 156/h; consumo 18 × 1 = 18/h',
        'Celeiro Nv3: 2.100',
        'Não enche antes da virada para o Inverno.',
      ].join('\n'),
    );
    expect(find(tree, 'worker:goldMine')?.tooltip).toBe(
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
      'hearth',
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
      description: '90/900 (−9/h) · acaba em 10 h',
    });
    expect(find(tree, 'resource:wood')?.tooltip).toContain('−9/h (lenha de 18 habitantes)');
  });

  it('com lenha para o resto do inverno, a árvore não anuncia um fim que não vem', () => {
    const enough = winterWith({ stock: 900, missing: 0, depletesInSeconds: 360_000 });
    const tree = buildTree({ ...input, view: enough });
    expect(find(tree, 'hearth')?.description).toBe('9/h de madeira');
    expect(find(tree, 'hearth')?.tooltip).toContain('O estoque e a Serraria dão conta.');
    expect(find(tree, 'resource:wood')?.description).toBe('900/900 (−9/h)');
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
