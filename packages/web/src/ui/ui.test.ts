import type { GameEvent, ViewState } from '@lotg/protocol';
import { describe, expect, it } from 'vitest';

import golden from '../../../engine/src/__golden__/view-seed-pedra-alta.json';
import type { AccountState } from '../account/accountService';
import { buildReturnReport, shouldShowReturnReport } from '../game/returnReport';
import {
  formatCost,
  formatDuration,
  formatNumber,
  formatRate,
  formatRemaining,
  remainingNow,
  statusBar,
  truncate,
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
        { resource: 'wood', label: 'Madeira', amount: 80 },
        { resource: 'stone', label: 'Pedra', amount: 40 },
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

  it('sem ligação passa na frente de tudo', () => {
    const result = statusBar({ ...base, view: starving, connection: offline });
    expect(result.text).toBe('$(debug-disconnect) Sem ligação com o reino');
    expect(result.tooltip).toContain('O mundo continua andando');
  });

  it('modo discreto mostra só um contador', () => {
    expect(statusBar({ ...base, view: building, discreetMode: true }).text).toBe(
      '$(circle-filled) 00:42',
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
    expect(food).toMatchObject({ label: 'Comida', description: '180 (+19/h)' });
    expect(food?.tooltip).toContain('2 trabalhadores × 10');
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
});
