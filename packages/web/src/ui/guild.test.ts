import type { GameEvent, ViewState } from '@lotg/protocol';
import { describe, expect, it } from 'vitest';

import type { AccountState } from '../account/accountService';
import { beforeLeaving, leavingItems } from '../game/beforeLeaving';
import { buildReturnReport, costAction } from '../game/returnReport';
import {
  arrearsAhead,
  decideNotifications,
  eventIcon,
  isEssential,
  isGuildEvent,
  isHeroArrival,
  isRelief,
  type PolicyInput,
} from '../notifications/policy';
import {
  gameEvent,
  guildArrearsView,
  guildPaidView,
  heroPromisedView,
  initialView,
  tavernBusyView,
  tavernOpenView,
} from '../test-helpers';
import { rowActions } from '../workbench/Tree';
import { documentTitle, statusBar } from './format';
import {
  arrearsDeadlines,
  arrearsSince,
  guildLines,
  guildTreeLine,
  heroCount,
  sheetLine,
  tavernTreeLine,
  wageCoverage,
  xpLine,
} from './guild';
import { buildTree, type TreeNode } from './treeModel';

/**
 * A Guilda fora dos painéis (roadmap da v0.3, V3C-T4): as frases, a árvore, a barra de status, a
 * política de avisos, "Antes de partir" e o Relatório de Retorno, com as visões do golden.
 */

const account: AccountState = {
  kind: 'anonymous',
  accountId: 'conta-1',
  displayName: 'Gustavo',
  hasRecoveryCode: false,
  gameId: 'partida-1',
};
const online = { kind: 'online' } as const;
const offline = { kind: 'offline', retryInMs: 5000, attempt: 1 } as const;

const find = (nodes: TreeNode[], id: string): TreeNode | undefined => {
  for (const node of nodes) {
    if (node.id === id) {
      return node;
    }
    const inner = find(node.children ?? [], id);
    if (inner !== undefined) {
      return inner;
    }
  }
  return undefined;
};
const tree = (view: ViewState, elapsedSeconds = 0) =>
  buildTree({ view, account, connection: online, chronicle: [], unseen: 0, elapsedSeconds });
const guildOf = (view: ViewState) => {
  const node = find(tree(view), 'guild');
  if (node === undefined) {
    throw new Error('A árvore não tem a linha da Guilda.');
  }
  return node;
};

/** A visão com o atraso trocado: os prazos que o golden não traz. */
function withArrears(
  patch: Partial<NonNullable<ViewState['guild']['wage']['arrears']>>,
): ViewState {
  const { arrears } = guildArrearsView.guild.wage;
  if (arrears === null) {
    throw new Error('O golden `guildInArrears` deixou de ter o soldo em atraso.');
  }
  return {
    ...guildArrearsView,
    guild: {
      ...guildArrearsView.guild,
      wage: { ...guildArrearsView.guild.wage, arrears: { ...arrears, ...patch } },
    },
  };
}

/** A visão com o ouro pagando a equipe por `seconds`. */
const coveredFor = (seconds: number | null): ViewState => ({
  ...guildPaidView,
  guild: {
    ...guildPaidView.guild,
    wage: { ...guildPaidView.guild.wage, coveredForSeconds: seconds },
  },
});

describe('as frases da Guilda', () => {
  it('conta heróis e resume a ficha', () => {
    expect([0, 1, 3].map(heroCount)).toEqual(['nenhum herói', '1 herói', '3 heróis']);
    const [edda, , isolda] = guildPaidView.guild.heroes;
    expect(edda === undefined ? '' : sheetLine(edda)).toBe('Guerreira Nv1 · Leal');
    expect(isolda === undefined ? '' : sheetLine(isolda)).toBe('Maga Nv2 · Veterana · Gananciosa');
    expect(xpLine({ xp: 40, xpToNext: 100 })).toBe('XP 40/100');
    expect(xpLine({ xp: 900, xpToNext: null })).toBe('XP 900 (nível máximo)');
  });

  it('o soldo em horas vem do prazo da visão, e some sem herói e com o atraso aberto', () => {
    expect(wageCoverage(guildPaidView.guild, 0)).toBe('O ouro paga a equipe por mais 23 h.');
    expect(wageCoverage(coveredFor(5 * 3600 + 10).guild, 0)).toBe(
      'O ouro paga a equipe por mais 5 h.',
    );
    expect(wageCoverage(coveredFor(null).guild, 0)).toContain('sem prazo');
    expect(wageCoverage(initialView.guild, 0)).toBeNull();
    expect(wageCoverage(guildArrearsView.guild, 0)).toBeNull();
  });

  it('os prazos do atraso são os da visão; o que ela não traz não ganha frase', () => {
    const late = withArrears({ discontentInSeconds: 3 * 3600, nextDepartureInSeconds: 7 * 3600 });
    const arrears = late.guild.wage.arrears;
    if (arrears === null) {
      throw new Error('sem atraso');
    }
    expect(arrearsDeadlines(arrears, 0)).toEqual(['Descontentes em 3 h', 'Um herói parte em 7 h']);
    expect(arrearsDeadlines(arrears, 3600)).toEqual([
      'Descontentes em 2 h',
      'Um herói parte em 6 h',
    ]);
    expect(
      arrearsDeadlines({ ...arrears, discontentInSeconds: null, nextDepartureInSeconds: null }, 0),
    ).toEqual([]);
    expect(arrearsSince({ ...arrears, secondsElapsed: 3 * 3600 }, 0)).toBe(
      'Soldo em atraso há 3 h',
    );
  });

  it('a explicação da Guilda junta a frase do servidor, o soldo e a cobertura ou o atraso', () => {
    expect(guildLines(initialView.guild, 0)).toEqual([initialView.guild.text]);
    expect(guildLines(guildPaidView.guild, 0)).toEqual([
      guildPaidView.guild.text,
      'Soldo da equipe: 18/h de ouro.',
      'O ouro paga a equipe por mais 23 h.',
    ]);
    const late = guildLines(guildArrearsView.guild, 0);
    expect(late).toContain(guildArrearsView.guild.wage.arrears?.text);
    expect(late).toContain('Um herói parte em 47 min.');
  });
});

describe('a Guilda na árvore (GDD §13.2)', () => {
  it('sem herói e sem Taverna é uma linha só, e a explicação diz como o primeiro herói chega', () => {
    const node = guildOf(initialView);
    expect(node).toMatchObject({
      label: 'Guilda',
      description: 'nenhum herói',
      icon: 'compass',
      command: { id: 'lords.openPanel', args: ['guild'] },
    });
    expect(node.tooltip).toBe(initialView.guild.text);
    expect(node.children).toEqual([]);
    expect(rowActions(node)).toEqual([]);
  });

  it('"Guilda · 3 heróis": uma linha por herói, com a classe, o nível e o soldo, e o botão que dispensa (com confirmação)', () => {
    const node = guildOf(guildPaidView);
    expect(node.description).toBe('3 heróis');
    expect(guildTreeLine(guildPaidView.guild)).toBe('3 heróis');
    expect(node.children?.map((child) => [child.id, child.label, child.description])).toEqual([
      ['hero:hero-1', 'Edda', 'Guerreira Nv1 · 6/h'],
      ['hero:hero-2', 'Rolf', 'Arqueiro Nv1 · 6/h'],
      ['hero:hero-3', 'Isolda', 'Maga Nv2 · 6/h'],
    ]);
    const edda = find(tree(guildPaidView), 'hero:hero-1');
    // O clique só navega; a ordem sai do botão da linha.
    expect(edda?.command).toEqual({ id: 'lords.openPanel', args: ['guild'] });
    expect(edda === undefined ? [] : rowActions(edda)).toEqual([
      { label: 'Dispensar Edda', text: 'Dispensar', command: 'lords.dismissHero' },
    ]);
    expect(edda?.tooltip).toContain('Leal: Nunca fica descontente');
  });

  it('o soldo em atraso aparece por extenso na Guilda e na linha do feudo, com o descontente marcado', () => {
    const nodes = tree(guildArrearsView);
    const node = find(nodes, 'guild');
    expect(node).toMatchObject({ description: '2 heróis · ⚠ soldo em atraso', icon: 'warning' });
    expect(find(nodes, 'hero:hero-2')?.description).toBe('Arqueiro Nv1 · 2/h · ⚠ descontente');
    expect(find(nodes, 'fief')?.description).toContain('soldo em atraso');
    expect(find(nodes, 'fief')?.tooltip).toContain(guildArrearsView.guild.wage.arrears?.text);
  });

  it('o herói prometido tem a linha dele, com o prazo, e nenhum botão', () => {
    const nodes = tree(heroPromisedView);
    expect(find(nodes, 'guild')?.description).toBe('nenhum herói · 1 a caminho');
    const arriving = find(nodes, 'arriving:0');
    expect(arriving).toMatchObject({
      label: 'Rolf',
      description: 'Arqueiro · chega em 1 h 27 min',
    });
    expect(arriving === undefined ? [] : rowActions(arriving)).toEqual([]);
  });

  it('a Taverna de pé ganha a linha dela, com os candidatos, o preço de cada um e os botões', () => {
    const nodes = tree(tavernOpenView);
    const tavern = find(nodes, 'tavern');
    expect(tavern).toMatchObject({
      label: 'Taverna',
      description: '2 candidatos · troca em 7 h 47 min',
      icon: 'coffee',
      command: { id: 'lords.openPanel', args: ['tavern'] },
    });
    expect(tavernTreeLine(tavernOpenView.tavern, 0)).toBe('2 candidatos · troca em 7 h 47 min');
    expect(tavern?.children?.map((child) => [child.id, child.label, child.description])).toEqual([
      ['offer:offer-1', 'Mécia', 'Arqueira · 80 de ouro'],
      ['offer:offer-2', 'Gonçalo', 'Clérigo · 130 de ouro'],
    ]);
    const offer = find(nodes, 'offer:offer-1');
    expect(offer === undefined ? [] : rowActions(offer)).toEqual([
      { label: 'Contratar Mécia', text: 'Contratar', command: 'lords.hireHero' },
    ]);
    // O preço e o soldo vão na dica do botão.
    expect(offer?.actionHints).toEqual({ 'lords.hireHero': '80 de ouro · soldo de 6/h' });
    expect(tavern === undefined ? [] : rowActions(tavern)).toEqual([
      { label: 'Dar um festival na Taverna', text: 'Festival', command: 'lords.holdFestival' },
    ]);
    expect(tavern?.actionHints).toEqual({ 'lords.holdFestival': '100 comida, 50 ouro' });
  });

  it('bloqueados, o candidato e o festival não ganham botão, e a explicação diz o motivo do servidor', () => {
    const nodes = tree(tavernBusyView);
    const offer = find(nodes, 'offer:offer-3');
    expect(offer?.icon).toBe('lock');
    expect(offer === undefined ? [] : rowActions(offer)).toEqual([]);
    expect(offer?.tooltip).toContain(tavernBusyView.tavern.offers[0]?.blockedReason);
    // Na linha estreita, só o preço de agora; a conta do desconto fica na explicação e na aba.
    expect(offer?.description).toBe('Arqueiro · 80 de ouro');
    expect(offer?.tooltip).toContain('80 de ouro: 100, menos 20% por Mécia, Carismática');
    const tavern = find(nodes, 'tavern');
    expect(tavern === undefined ? [] : rowActions(tavern)).toEqual([]);
    expect(tavern?.tooltip).toContain('Um festival por estação: no Verão o feudo já festejou.');
  });
});

describe('o soldo em atraso na barra de status (GDD §13.5)', () => {
  const base = {
    connection: online,
    discreetMode: false,
    signedIn: true,
    elapsedSeconds: 0,
    pending: 0,
  };

  it('passa na frente das decisões pendentes, com o destaque de alarme, e leva à aba Guilda', () => {
    // O golden tem uma carta à espera: o atraso toma a linha, como a fome e o frio.
    expect(guildArrearsView.pendingDecisions).toHaveLength(1);
    const status = statusBar({ ...base, view: guildArrearsView });
    expect(status).toMatchObject({
      text: '$(warning) Soldo em atraso · um herói parte em 47 min',
      alarm: true,
      target: 'guild',
    });
    expect(status.tooltip).toContain(guildArrearsView.guild.wage.arrears?.text);
    expect(documentTitle({ ...base, view: guildArrearsView })).toBe(
      '(1) Soldo em atraso em Pedra Alta · Lords of the Guild',
    );
  });

  it('sem herói a partir, diz em quanto tempo ficam descontentes; sem prazo nenhum, só o atraso', () => {
    const sour = withArrears({ discontentInSeconds: 3 * 3600, nextDepartureInSeconds: null });
    expect(statusBar({ ...base, view: sour }).text).toBe(
      '$(warning) Soldo em atraso · descontentes em 3 h',
    );
    const loyal = withArrears({ discontentInSeconds: null, nextDepartureInSeconds: null });
    expect(statusBar({ ...base, view: loyal }).text).toBe('$(warning) Soldo em atraso');
  });

  it('a fome continua na frente dele, e a incursão à vista, na frente dos dois', () => {
    const starving: ViewState = {
      ...guildArrearsView,
      famine: { sinceMs: 0, secondsElapsed: 60, endsInSeconds: null, text: 'Fome.' },
    };
    expect(statusBar({ ...base, view: starving }).text).toBe('$(warning) Fome em Pedra Alta');
  });

  it('com o soldo em dia, a equipe não toma a linha; sem ligação, o atraso guardado não é anunciado', () => {
    expect(statusBar({ ...base, view: tavernOpenView }).text).not.toContain('Soldo');
    expect(statusBar({ ...base, view: guildArrearsView, connection: offline }).text).toBe(
      '$(debug-disconnect) Sem ligação com o reino',
    );
  });
});

describe('a política de avisos da equipe (GDD §13.5)', () => {
  const now = Date.parse('2026-10-01T12:00:00.000Z');
  const input = (overrides: Partial<PolicyInput>): PolicyInput => ({
    events: [],
    level: 'essential',
    discreetMode: false,
    mutedUntil: null,
    now,
    history: [],
    ...overrides,
  });
  const event = (type: GameEvent['type'], seq = 1) => gameEvent(seq, type);
  const shown = (level: PolicyInput['level'], ...types: GameEvent['type'][]) =>
    decideNotifications(
      input({ level, events: types.map((type, index) => event(type, index + 1)) }),
    ).show.map((entry) => entry.type);

  it('o atraso que abre, o herói descontente e o que parte são alarmes; o atraso que fecha, alívio', () => {
    for (const type of ['wageArrearsStarted', 'heroDiscontent', 'heroLeft'] as const) {
      expect(isEssential(event(type)), type).toBe(true);
      expect(isGuildEvent(event(type)), type).toBe(true);
    }
    expect(isRelief(event('wageArrearsEnded'))).toBe(true);
    expect(isEssential(event('wageArrearsEnded'))).toBe(false);
    expect(shown('essential', 'wageArrearsStarted', 'heroLeft', 'wageArrearsEnded')).toEqual([
      'wageArrearsStarted',
      'heroLeft',
      'wageArrearsEnded',
    ]);
  });

  it('o herói que uma carta prometeu avisa no nível essencial, sem tom de alarme; o contratado e o dispensado não avisam', () => {
    expect(isHeroArrival(event('heroJoined'))).toBe(true);
    expect(isEssential(event('heroJoined'))).toBe(false);
    expect(shown('essential', 'heroJoined', 'heroHired', 'heroDismissed', 'festivalHeld')).toEqual([
      'heroJoined',
    ]);
    expect(shown('all', 'heroHired', 'heroDismissed', 'festivalHeld')).toEqual([]);
    // O fim do festival só no nível "Todas".
    expect(shown('essential', 'festivalEnded')).toEqual([]);
    expect(shown('all', 'festivalEnded')).toEqual(['festivalEnded']);
    expect(shown('silent', 'wageArrearsStarted', 'heroLeft', 'heroJoined')).toEqual([]);
  });

  it('com pouco espaço, o atraso passa na frente do que só informa', () => {
    expect(
      shown('all', 'constructionFinished', 'heroJoined', 'wageArrearsStarted', 'heroLeft'),
    ).toEqual(['wageArrearsStarted', 'heroLeft', 'heroJoined']);
  });

  it('cada aviso da equipe tem o seu ícone', () => {
    expect(
      (['wageArrearsStarted', 'heroLeft', 'heroJoined', 'heroDiscontent'] as const).map((type) =>
        eventIcon(event(type)),
      ),
    ).toEqual(['compass', 'sign-out', 'person-add', 'person']);
  });

  it('o aviso do atraso leva os prazos da visão (a explicação inteira fica na aba); com o atraso já fechado, nada', () => {
    const late = withArrears({ discontentInSeconds: 3 * 3600, nextDepartureInSeconds: 7 * 3600 });
    expect(arrearsAhead(late)).toEqual(['Descontentes em 3 h.', 'Um herói parte em 7 h.']);
    expect(arrearsAhead(guildPaidView)).toEqual([]);
    expect(arrearsAhead(null)).toEqual([]);
  });
});

describe('"Antes de partir" e o soldo (roadmap da v0.3, §11.3-A)', () => {
  const wage = (view: ViewState) => leavingItems(view).find((item) => item.id === 'wage');

  it('o ouro que acaba antes de um dia, com soldo a pagar, entra na lista com o prazo da visão e o botão da Mina', () => {
    expect(wage(guildPaidView)).toEqual({
      id: 'wage',
      severity: 'warning',
      text: 'O ouro paga a equipe por mais 23 h: depois disso o soldo atrasa.',
      command: { id: 'lords.allocateWorkers', arg: 'goldMine', label: 'Alocar na Mina de Ouro' },
    });
    // Poucas horas: o feudo não está "preparado para a ausência".
    const soon = coveredFor(5 * 3600);
    expect(wage(soon)).toMatchObject({
      severity: 'danger',
      text: 'O ouro paga a equipe por mais 5 h: depois disso o soldo atrasa.',
    });
    expect(beforeLeaving(soon).map((item) => item.id)).toContain('wage');
    const today = find(tree(soon), 'today');
    expect(today?.description).not.toBe('pronto para a ausência');
    expect(today?.tooltip).toContain('O ouro paga a equipe por mais 5 h');
  });

  it('com o atraso aberto, diz há quanto tempo e o que ele cobra a seguir', () => {
    expect(wage(guildArrearsView)).toMatchObject({
      severity: 'danger',
      text: 'Soldo em atraso há 26 h: um herói parte em 47 min.',
    });
  });

  it('sem herói, com o ouro sobrando ou acabando depois de um dia, não há item', () => {
    expect(wage(initialView)).toBeUndefined();
    expect(wage(tavernOpenView)).toBeUndefined();
    expect(wage(coveredFor(30 * 3600))).toBeUndefined();
  });
});

describe('a equipe no Relatório de Retorno', () => {
  const report = (before: ViewState, after: ViewState, events: GameEvent[]) =>
    buildReturnReport(before, after, events, 9 * 3600 * 1000);
  const texts = (items: Array<{ text: string }>) => items.map((item) => item.text);

  it('o herói que chegou, o contratado e o festival dado são do que prosperou', () => {
    const { blocks } = report(initialView, tavernOpenView, [
      gameEvent(1, 'heroJoined', 'Edda passou a servir.'),
      gameEvent(2, 'heroHired', 'Mécia aceitou o soldo.'),
      gameEvent(3, 'festivalHeld', 'Houve festival.'),
      gameEvent(4, 'festivalEnded', 'Os barris secaram.'),
      gameEvent(5, 'heroDismissed', 'O senhor dispensou Rolf.'),
    ]);
    expect(texts(blocks?.prospered ?? [])).toEqual([
      'Edda passou a servir.',
      'Mécia aceitou o soldo.',
      'Houve festival.',
    ]);
    expect(blocks?.cost).toEqual([]);
  });

  it('o atraso, o descontente e quem partiu exigiram um preço, com o botão do soldo de agora; o atraso que fechou é alívio', () => {
    const { blocks } = report(guildPaidView, guildArrearsView, [
      gameEvent(1, 'wageArrearsStarted', 'O soldo atrasou.'),
      gameEvent(2, 'heroDiscontent', 'Rolf anda descontente.'),
      gameEvent(3, 'heroLeft', 'Isolda deixou o feudo.'),
    ]);
    // (As duas visões são de feudos diferentes do golden: só as linhas do soldo interessam.)
    expect(blocks?.cost.filter((item) => item.topic === 'wage')).toEqual(
      ['O soldo atrasou.', 'Rolf anda descontente.', 'Isolda deixou o feudo.'].map((text) => ({
        text,
        topic: 'wage',
        severity: 'warning',
        // O atraso continua: o botão é o de "Antes de partir".
        action: {
          command: 'lords.allocateWorkers',
          arg: 'goldMine',
          label: 'Alocar na Mina de Ouro',
        },
      })),
    );
    const closed = report(guildPaidView, tavernOpenView, [
      gameEvent(1, 'wageArrearsStarted', 'O soldo atrasou.'),
      gameEvent(2, 'wageArrearsEnded', 'O soldo voltou a ser pago.'),
    ]);
    expect(texts(closed.blocks?.prospered ?? [])).toEqual(['O soldo voltou a ser pago.']);
    // Fechado o atraso, e com o ouro sobrando, o botão leva à equipe.
    expect(costAction(tavernOpenView, 'wage')).toEqual({
      command: 'lords.openPanel',
      arg: 'guild',
      label: 'Ver a Guilda',
    });
  });

  it('o atraso que já vinha de antes e não fechou ganha uma linha: o bloco não diz que nada se perdeu', () => {
    const { blocks } = report(guildArrearsView, guildArrearsView, []);
    expect(texts(blocks?.cost ?? [])).toEqual([
      'O soldo dos heróis continuou em atraso durante toda a sua ausência.',
    ]);
  });
});
