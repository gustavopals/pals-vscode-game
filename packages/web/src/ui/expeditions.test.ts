import type { ViewState } from '@lotg/protocol';
import { describe, expect, it } from 'vitest';

import { guildDeadlines } from '../game/gameSession';
import {
  CLASS_MISSING_REASON,
  denClearedView,
  expeditionCrossroadsView,
  expeditionReturningView,
  expeditionTravelingView,
  gameEvent,
  guildArrearsView,
  guildPaidView,
  heroCapturedView,
  heroInjuredView,
  initialView,
  tavernOpenView,
  threatIncomingView,
  withoutTheClass,
} from '../test-helpers';
import {
  armableHeroes,
  blockedReason,
  canSend,
  CROSSROADS_NEAR_SECONDS,
  crossroadsDeadline,
  crossroadsOverdue,
  crossroadsSoon,
  defaultTeam,
  destinationTerms,
  eligibleHeroes,
  expeditionDeadlines,
  expeditionLines,
  expeditionProgress,
  expeditionsOwnText,
  expeditionsTreeParts,
  heroFitPower,
  isPostureOption,
  itemsFor,
  keptReports,
  outcomeIcon,
  outcomeIsBad,
  reportOf,
  rescueDestination,
  sendable,
  slotLine,
  stretchEnds,
  teamFit,
  teamFits,
  teamSize,
  waitingExpeditions,
  wornIn,
} from './expeditions';
import { documentTitle, statusBar, type StatusBarInput } from './format';
import { guildTreeLine } from './guild';
import { buildTree, type TreeNode } from './treeModel';

/**
 * As expedições como texto (roadmap da v0.3, V3D-T4): tudo conferido com as visões do golden do
 * motor. O app não escreve regra: cada número e cada frase daqui é o que a visão trouxe, ou uma
 * frase de ligação em volta dele.
 */

const guildOf = (view: ViewState) => view.guild;
const waitingOf = (view: ViewState) => {
  const [expedition] = waitingExpeditions(view.guild);
  if (expedition === undefined || expedition.crossroads === null) {
    throw new Error('Sem equipe na encruzilhada.');
  }
  return { expedition, crossroads: expedition.crossroads };
};
const destination = (view: ViewState, modelId: string) => {
  const found = view.guild.available.find((entry) => entry.modelId === modelId);
  if (found === undefined) {
    throw new Error(`Sem o destino ${modelId}.`);
  }
  return found;
};
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
const tree = (view: ViewState) =>
  buildTree({
    view,
    account: { kind: 'anonymous', displayName: 'Gustavo', gameId: 'g' } as never,
    connection: { kind: 'online' },
    chronicle: [],
    unseen: 0,
    elapsedSeconds: 0,
  });
const bar = (view: ViewState, patch: Partial<StatusBarInput> = {}): StatusBarInput => ({
  view,
  connection: { kind: 'online' },
  discreetMode: false,
  signedIn: true,
  elapsedSeconds: 0,
  pending: 0,
  ...patch,
});

describe('a encruzilhada como texto', () => {
  it('o prazo é o da visão, em tempo real, descontado o tempo desde a leitura', () => {
    const { crossroads } = waitingOf(expeditionCrossroadsView);
    expect(crossroads.decidesInSeconds).toBe(40_798);
    // A encruzilhada não expira: é a espera da equipe que acaba (revisão, A26).
    expect(crossroadsDeadline(crossroads, 0)).toBe('a espera acaba em 11 h');
    expect(crossroadsDeadline(crossroads, 10 * 3600)).toBe('a espera acaba em 1 h');
    // Perto é menos de uma hora (limiar de apresentação): o prazo inteiro não nasce em aviso.
    expect(crossroadsSoon(crossroads, 0)).toBe(false);
    expect(crossroadsSoon(crossroads, 40_798 - 3599)).toBe(true);
    expect(crossroadsOverdue(crossroads, 40_797)).toBe(false);
    expect(crossroadsOverdue(crossroads, 40_798)).toBe(true);
    expect(crossroadsDeadline(crossroads, 41_000)).toBe('a espera acabou');
  });

  it('a opção da Postura é a que a visão marca, e a frase do que ela faz é a do servidor', () => {
    const { crossroads } = waitingOf(expeditionCrossroadsView);
    expect(crossroads.options.filter((option) => isPostureOption(crossroads, option))).toEqual([
      expect.objectContaining({ id: 'stream', label: 'Seguir o riacho' }),
    ]);
    expect(crossroads.postureText).toBe(
      'Sem resposta, a Postura Equilibrada escolhe: Seguir o riacho.',
    );
  });

  it('onde a equipe está e quanto falta: a encruzilhada com o prazo, o trecho com o tempo', () => {
    const { expedition } = waitingOf(expeditionCrossroadsView);
    expect(expeditionProgress(expedition, 0)).toBe('na encruzilhada · a espera acaba em 11 h');
    expect(stretchEnds(expedition, 0)).toBeNull();
    expect(expeditionLines(expedition, 0)).toEqual([
      'Edda e Rolf · Postura Equilibrada',
      'Parada na encruzilhada, à espera da sua palavra.',
      'A trilha se parte em duas diante de um carvalho tombado. À esquerda, a mata fecha; à direita, ouve-se água.',
      'A espera acaba em 11 h. Sem resposta, a Postura Equilibrada escolhe: Seguir o riacho.',
    ]);
    const [traveling] = expeditionTravelingView.guild.expeditions;
    if (traveling === undefined || traveling.nodeEndsInSeconds === null) {
      throw new Error('Sem equipe em viagem.');
    }
    expect(expeditionProgress(traveling, 0)).toMatch(/^Rastros na estrada velha · \d/);
    expect(stretchEnds(traveling, 0)).toMatch(/^O trecho de agora termina em /);
    expect(stretchEnds(traveling, traveling.nodeEndsInSeconds + 5)).toBe(
      'O trecho de agora está terminando.',
    );
    expect(expeditionProgress(traveling, traveling.nodeEndsInSeconds + 5)).toBe(
      'Rastros na estrada velha · chegando',
    );
  });
});

describe('os destinos e a equipe', () => {
  it('quem pode ir a um destino é quem a visão lista, na ordem da ficha', () => {
    expect(
      eligibleHeroes(guildOf(heroInjuredView), destination(heroInjuredView, 'patrol')).map(
        (hero) => hero.name,
      ),
    ).toEqual(['Rolf']);
    // As Ruínas não aceitam ninguém do feudo: a lista da visão vem vazia, com o motivo.
    const ruins = destination(heroCapturedView, 'ruins');
    expect(ruins.eligibleHeroIds).toEqual([]);
    expect(eligibleHeroes(guildOf(heroCapturedView), ruins)).toEqual([]);
    expect(canSend(ruins)).toBe(false);
    // A lista da visão manda, não o nível nem a prontidão da ficha: só quem ela traz.
    const picky = { ...destination(denClearedView, 'oldForest'), eligibleHeroIds: ['hero-2'] };
    expect(eligibleHeroes(guildOf(denClearedView), picky).map((hero) => hero.name)).toEqual([
      'Rolf',
    ]);
    const reversed = {
      ...destination(denClearedView, 'oldForest'),
      eligibleHeroIds: ['hero-2', 'hero-1'],
    };
    expect(eligibleHeroes(guildOf(denClearedView), reversed).map((hero) => hero.name)).toEqual([
      'Edda',
      'Rolf',
    ]);
  });

  it('um destino pode partir quando a visão diz que alguma equipe serve', () => {
    // Um herói pronto: a Patrulha e a Floresta saem; o Covil pede dois.
    expect(sendable(guildOf(heroInjuredView)).map((entry) => entry.modelId)).toEqual([
      'patrol',
      'oldForest',
    ]);
    // Todos os lugares ocupados: nada parte, e o motivo é o do servidor.
    expect(sendable(guildOf(expeditionTravelingView))).toEqual([]);
    expect(destination(expeditionTravelingView, 'patrol').lockedReason).toContain(
      'sustenta 1 expedição por vez',
    );
    // Sem a Guilda dos Aventureiros não há destino nenhum na visão.
    expect(sendable(guildOf(guildPaidView))).toEqual([]);
    expect(guildOf(guildPaidView).available).toEqual([]);
  });

  it('o destino que pede uma classe que o feudo não tem não pode partir, por mais gente que haja (revisão, A1)', () => {
    // Dois heróis prontos, no nível pedido, e a Floresta leva de 1 a 2: pela contagem, serviria.
    const view = withoutTheClass(denClearedView, 'oldForest');
    const forest = destination(view, 'oldForest');
    expect(forest.eligibleHeroIds).toHaveLength(2);
    expect(forest.teamMin).toBe(1);
    expect(canSend(forest)).toBe(false);
    expect(sendable(guildOf(view)).map((entry) => entry.modelId)).toEqual(['patrol']);
    // Nenhuma equipe vem marcada, e o motivo é o do servidor.
    expect(defaultTeam(forest)).toEqual([]);
    expect(blockedReason(forest)).toBe(CLASS_MISSING_REASON);
  });

  it('a equipe que já vem marcada é a que a visão sugere', () => {
    expect(defaultTeam(destination(heroCapturedView, 'wolfDen'))).toEqual(['hero-2', 'hero-3']);
    // A sugestão não é "os primeiros da lista": na Patrulha, a visão manda Brann, o segundo.
    expect(destination(heroCapturedView, 'patrol').eligibleHeroIds).toEqual(['hero-2', 'hero-3']);
    expect(defaultTeam(destination(heroCapturedView, 'patrol'))).toEqual(['hero-3']);
    // O destino aberto e o bloqueado: sem motivo, ou com o do servidor.
    expect(blockedReason(destination(heroCapturedView, 'patrol'))).toBeNull();
    expect(blockedReason(destination(heroInjuredView, 'wolfDen'))).toBe(
      destination(heroInjuredView, 'wolfDen').sendBlockedReason,
    );
  });

  it('o tamanho da equipe em palavras, com os números da visão', () => {
    expect(teamSize(destination(heroInjuredView, 'patrol'))).toBe('1 herói');
    expect(teamSize(destination(heroInjuredView, 'oldForest'))).toBe('de 1 a 2 heróis');
    expect(teamSize(destination(heroInjuredView, 'wolfDen'))).toBe('2 heróis');
    const forest = destination(heroInjuredView, 'oldForest');
    expect([0, 1, 2, 3].map((count) => teamFits(forest, count))).toEqual([
      false,
      true,
      true,
      false,
    ]);
  });

  it('a régua da equipe soma o poder de cada herói contra o primeiro trecho e o compara com os dois números da visão', () => {
    const den = destination(denClearedView, 'wolfDen');
    const patrol = destination(heroInjuredView, 'patrol');
    if (patrol.fit === null) {
      throw new Error('A Patrulha tem prova no primeiro trecho.');
    }
    const rolf = heroFitPower(patrol, 'hero-2');
    expect(rolf).not.toBeNull();
    const fit = teamFit(patrol, ['hero-2']);
    expect(fit?.power).toBe(rolf);
    // A palavra e o ícone saem da comparação com `fit.comfortPower` e `fit.riskPower`.
    const expected =
      (rolf ?? 0) >= patrol.fit.comfortPower
        ? 'Com folga'
        : (rolf ?? 0) >= patrol.fit.riskPower
          ? 'No limite'
          : 'Arriscado';
    expect(fit?.label).toBe(expected);
    expect(fit?.text).toContain('contra o primeiro trecho');
    // Sem ninguém marcado, ou sem prova no trecho, não há régua.
    expect(teamFit(patrol, [])).toBeNull();
    expect(teamFit(destination(heroInjuredView, 'oldForest'), ['hero-2'])).toBeNull();
    // As três faixas, com os limiares do próprio destino.
    const levels = (power: number) =>
      teamFit({ ...den, heroFit: [{ heroId: 'x', power }] }, ['x'])?.level;
    if (den.fit === null) {
      throw new Error('O Covil tem prova no primeiro trecho.');
    }
    expect(levels(den.fit.comfortPower)).toBe('comfort');
    expect(levels(den.fit.comfortPower - 1)).toBe('tight');
    expect(levels(den.fit.riskPower)).toBe('tight');
    expect(levels(den.fit.riskPower - 1)).toBe('risk');
  });

  it('o destino em uma linha: o risco em palavra e a duração real, como a visão os manda', () => {
    expect(destinationTerms(destination(heroInjuredView, 'patrol'))).toMatch(
      /^risco baixo · dura \d+ min$/,
    );
  });

  it('o Resgate é achado pela marca da visão, e só existe com alguém em cativeiro', () => {
    expect(rescueDestination(guildOf(heroCapturedView))?.label).toBe('Resgate');
    expect(rescueDestination(guildOf(heroInjuredView))).toBeNull();
  });
});

describe('o desfecho de um passo: palavra e ícone', () => {
  it('cada desfecho tem o seu ícone, e só o Revés e o Desastre levam o tom de aviso', () => {
    const outcomes = ['full', 'success', 'setback', 'disaster', 'passed', 'chosen'] as const;
    const icons = outcomes.map(outcomeIcon);
    expect(new Set(icons).size).toBe(outcomes.length);
    expect(outcomes.filter(outcomeIsBad)).toEqual(['setback', 'disaster']);
  });

  it('os relatórios do golden trazem a palavra e a chave do desfecho juntas', () => {
    const steps = [heroInjuredView, heroCapturedView, denClearedView].flatMap((view) =>
      view.guild.reports.flatMap((report) => report.log),
    );
    expect(new Set(steps.map((step) => `${step.outcome}:${step.outcomeLabel}`))).toEqual(
      new Set([
        'passed:Sem incidentes',
        'chosen:Caminho escolhido',
        'setback:Revés',
        'disaster:Desastre',
        'full:Sucesso pleno',
      ]),
    );
  });
});

describe('o equipamento e o arsenal', () => {
  it('um espaço em uma linha: o item com o que ele soma, na frase do servidor, ou vazio', () => {
    const rolf = guildOf(heroInjuredView).heroes.find((hero) => hero.name === 'Rolf');
    expect(rolf?.equipment.map(slotLine)).toEqual([
      expect.stringMatching(/^Arma: Arco de freixo \(.+\)$/),
      'Armadura: vazio',
      'Acessório: vazio',
    ]);
    const bow = rolf === undefined ? null : wornIn(rolf, 'weapon');
    expect(bow?.label).toBe('Arco de freixo');
    expect(rolf === undefined ? null : wornIn(rolf, 'armor')).toBeNull();
  });

  it('os itens do arsenal por espaço, e quem pode trocar de equipamento: quem está no feudo', () => {
    const guild = guildOf(heroInjuredView);
    expect(itemsFor(guild, 'accessory').map((item) => item.label)).toEqual(['Figa de azeviche']);
    expect(itemsFor(guild, 'weapon')).toEqual([]);
    // A heroína em recuperação está no feudo e pode ser equipada; o cativo, não.
    expect(armableHeroes(guild).map((hero) => hero.name)).toEqual(['Edda', 'Rolf']);
    expect(armableHeroes(guildOf(heroCapturedView)).map((hero) => hero.name)).toEqual([
      'Rolf',
      'Brann',
    ]);
  });
});

describe('a linha da Crônica e o relatório', () => {
  it('liga a linha ao relatório enquanto ele está guardado; depois, a linha fica sozinha', () => {
    const [report] = heroInjuredView.guild.reports;
    if (report === undefined) {
      throw new Error('Sem relatório.');
    }
    const returned = {
      ...gameEvent(7, 'expeditionReturned', 'A expedição voltou com madeira.'),
      data: { expeditionId: report.expeditionId },
    };
    const older = {
      ...gameEvent(3, 'expeditionReturned', 'Uma expedição antiga voltou.'),
      data: { expeditionId: 'expedition-0' },
    };
    const other = gameEvent(8, 'constructionFinished', 'A Fazenda ficou pronta.');
    expect(reportOf(heroInjuredView.guild, returned)).toBe(report.expeditionId);
    expect(reportOf(heroInjuredView.guild, older)).toBeNull();
    expect(reportOf(heroInjuredView.guild, other)).toBeNull();
    expect(reportOf(null, returned)).toBeNull();
    // A aba Crônica casa a marca de cada linha com os relatórios guardados, pelo identificador.
    expect([...keptReports(heroInjuredView.guild)]).toEqual(
      heroInjuredView.guild.reports.map((entry) => entry.expeditionId),
    );
    // Sem relatório guardado na visão, nenhuma linha liga a nada.
    expect(keptReports(initialView.guild).size).toBe(0);
    expect(keptReports(null).size).toBe(0);
  });
});

describe('a frase da guilda fica em um painel só', () => {
  it('fala das expedições com equipe e a Guilda dos Aventureiros de pé; antes, fala da equipe', () => {
    expect(expeditionsOwnText(guildOf(heroInjuredView))).toBe(true);
    expect(expeditionsOwnText(guildOf(guildPaidView))).toBe(false);
    expect(expeditionsOwnText(guildOf(initialView))).toBe(false);
  });
});

describe('a árvore: "Guilda · 3 heróis · 1 expedição na encruzilhada" (GDD §13.2)', () => {
  it('a linha da Guilda conta as expedições, primeiro as que esperam na encruzilhada', () => {
    expect(expeditionsTreeParts(guildOf(expeditionCrossroadsView))).toEqual([
      '1 expedição na encruzilhada',
    ]);
    expect(expeditionsTreeParts(guildOf(expeditionReturningView))).toEqual([
      '2 expedições em viagem',
    ]);
    expect(expeditionsTreeParts(guildOf(guildPaidView))).toEqual([]);
    expect(guildTreeLine(guildOf(expeditionCrossroadsView), 24 * 3600)).toMatch(
      /^2 heróis · 1 expedição na encruzilhada/,
    );
    expect(find(tree(expeditionCrossroadsView), 'guild')?.description).toMatch(
      /^2 heróis · 1 expedição na encruzilhada/,
    );
  });

  it('uma linha por expedição: a que espera tem o botão "Escolher"; a que viaja só navega', () => {
    const waiting = find(tree(expeditionCrossroadsView), 'expedition:expedition-2');
    expect(waiting).toMatchObject({
      label: 'Floresta Antiga',
      description: '● na encruzilhada · a espera acaba em 11 h',
      contextValue: 'lords.crossroads',
      command: { id: 'lords.openPanel', args: ['expeditions'] },
      // A dica do botão diz o que acontece sem resposta, na frase do servidor.
      actionHints: {
        'lords.chooseExpeditionPath':
          'Sem resposta, a Postura Equilibrada escolhe: Seguir o riacho.',
      },
    });
    expect(waiting?.tooltip).toContain('Edda e Rolf · Postura Equilibrada');
    const [traveling] = expeditionTravelingView.guild.expeditions;
    const row = find(tree(expeditionTravelingView), `expedition:${traveling?.id ?? ''}`);
    expect(row?.contextValue).toBeUndefined();
    expect(row?.description).toMatch(/^Rastros na estrada velha · /);
  });

  it('a linha "Guilda" ganha o botão "Enviar" só quando algum destino pode partir', () => {
    expect(find(tree(heroInjuredView), 'guild')?.contextValue).toBe('lords.guild');
    expect(find(tree(expeditionTravelingView), 'guild')?.contextValue).toBeUndefined();
    expect(find(tree(tavernOpenView), 'guild')?.contextValue).toBeUndefined();
  });

  it('a linha "Guilda" não ganha "Enviar" quando a visão diz que nenhuma equipe serve (revisão, A1)', () => {
    const view = withoutTheClass(withoutTheClass(denClearedView, 'patrol'), 'oldForest');
    expect(find(tree(view), 'guild')?.contextValue).toBeUndefined();
    expect(find(tree(denClearedView), 'guild')?.contextValue).toBe('lords.guild');
  });

  it('a linha de um herói só tem "Dispensar" quando a visão diz que ele pode ser dispensado', () => {
    // Edda viaja (não pode); Rolf está no feudo. A cativa do outro retrato pode: desiste-se dela.
    expect(find(tree(expeditionTravelingView), 'hero:hero-1')?.contextValue).toBeUndefined();
    expect(find(tree(expeditionTravelingView), 'hero:hero-2')?.contextValue).toBe('lords.hero');
    expect(find(tree(heroCapturedView), 'hero:hero-1')?.contextValue).toBe('lords.hero');
  });

  it('a linha "Hoje" conta a encruzilhada como decisão pendente', () => {
    expect(find(tree(expeditionCrossroadsView), 'today')?.description).toBe('● 1 decisão pendente');
  });
});

describe('a barra de status e o título: a encruzilhada conta como decisão pendente', () => {
  it('a linha diz quantas decisões esperam e o prazo da que vence primeiro, e leva à aba dela', () => {
    const output = statusBar(bar(expeditionCrossroadsView));
    expect(output.text).toBe('$(git-compare) 1 decisão pendente · expira em 11 h');
    expect(output.target).toBe('guild');
    expect(output.tooltip).toContain('"Floresta Antiga: A trilha se divide" expira em 11 h');
    expect(output.tooltip).toContain('A equipe espera na encruzilhada, na aba Guilda.');
    expect(documentTitle(bar(expeditionCrossroadsView))).toBe(
      '(1) Pedra Alta · Lords of the Guild',
    );
  });

  it('com uma carta que vence antes, a linha é a da carta, e conta as duas', () => {
    const [crossroads] = expeditionCrossroadsView.pendingDecisions;
    if (crossroads === undefined) {
      throw new Error('Sem encruzilhada.');
    }
    const both: ViewState = {
      ...expeditionCrossroadsView,
      pendingDecisions: [
        crossroads,
        { kind: 'card', id: 'meal-1', title: 'Pão para os pedreiros', expiresInSeconds: 600 },
      ],
    };
    const output = statusBar(bar(both));
    expect(output.text).toBe('$(law) 2 decisões pendentes · expira em 10 min');
    expect(output.target).toBe('council');
    expect(output.tooltip).toContain('A carta espera na aba Conselho.');
    expect(output.tooltip).toContain('A equipe espera na encruzilhada, na aba Guilda.');
    expect(documentTitle(bar(both))).toBe('(2) Pedra Alta · Lords of the Guild');
  });

  it('com o soldo em atraso (ou a fome, ou o frio) na linha, a encruzilhada de prazo perto divide a linha em vez de sumir (revisão, A15)', () => {
    const [crossroads] = expeditionCrossroadsView.pendingDecisions;
    if (crossroads === undefined) {
      throw new Error('Sem encruzilhada.');
    }
    const arrears = (expiresInSeconds: number): ViewState => ({
      ...expeditionCrossroadsView,
      guild: { ...expeditionCrossroadsView.guild, wage: guildArrearsView.guild.wage },
      pendingDecisions: [{ ...crossroads, expiresInSeconds }],
    });
    // Com o prazo longe, a linha é só a do atraso: a decisão está no contador do título.
    const far = statusBar(bar(arrears(5 * 3600)));
    expect(far.text).toMatch(/^\$\(warning\) Soldo em atraso/);
    expect(far.text).not.toContain('git-compare');
    // Faltando cinco minutos, a encruzilhada entra na mesma linha, com o prazo, e o clique leva
    // à aba Guilda; o atraso continua lá, com o tom de alarme.
    const near = statusBar(bar(arrears(300)));
    expect(near.text).toMatch(
      /^\$\(warning\) Soldo em atraso.* · \$\(git-compare\) encruzilhada: 5 min$/,
    );
    expect(near.alarm).toBe(true);
    expect(near.target).toBe('guild');
    expect(near.tooltip).toContain(guildArrearsView.guild.wage.arrears?.text ?? '');
    expect(near.tooltip).toContain(
      '"Floresta Antiga: A trilha se divide": a espera acaba em 5 min. A equipe espera na encruzilhada, na aba Guilda.',
    );
    // O limiar é o mesmo de "Antes de partir": uma hora, descontado o tempo desde a leitura.
    expect(statusBar(bar(arrears(CROSSROADS_NEAR_SECONDS))).text).not.toContain('git-compare');
    expect(statusBar(bar(arrears(CROSSROADS_NEAR_SECONDS - 1))).text).toContain('git-compare');
    expect(statusBar(bar(arrears(5 * 3600), { elapsedSeconds: 5 * 3600 - 300 })).text).toContain(
      'encruzilhada: 5 min',
    );
    // Vale para a fome também; e a carta do Conselho, de prazo longo, não entra na linha.
    const hungry: ViewState = {
      ...arrears(300),
      guild: expeditionCrossroadsView.guild,
      famine: {
        secondsElapsed: 60,
        endsInSeconds: null,
        text: 'A fome chegou.',
      } as ViewState['famine'],
    };
    expect(statusBar(bar(hungry)).text).toMatch(
      /Fome em .* · \$\(git-compare\) encruzilhada: 5 min$/,
    );
    const card: ViewState = {
      ...hungry,
      pendingDecisions: [{ kind: 'card', id: 'meal-1', title: 'Pão', expiresInSeconds: 300 }],
    };
    expect(statusBar(bar(card)).text).not.toContain('·');
    // Com a incursão à vista a linha também se divide, mas o clique continua sendo o da defesa.
    const raid: ViewState = { ...arrears(300), threat: threatIncomingView.threat };
    expect(statusBar(bar(raid)).text).toMatch(
      /^\$\(megaphone\).* · \$\(git-compare\) encruzilhada: 5 min$/,
    );
    expect(statusBar(bar(raid)).target).toBe('threat');
    // Com a espera já vencida no relógio da página, não há o que mostrar.
    expect(statusBar(bar(arrears(300), { elapsedSeconds: 301 })).text).not.toContain('git-compare');
  });

  it('sem ligação a encruzilhada guardada não entra no contador', () => {
    expect(
      documentTitle(
        bar(expeditionCrossroadsView, {
          connection: { kind: 'offline', retryInMs: 1000, attempt: 1 },
        }),
      ),
    ).toBe('Pedra Alta · Lords of the Guild');
  });
});

describe('a leitura seguinte vem antes nos prazos das expedições', () => {
  it('o fim do nó de agora, o prazo da encruzilhada e a recuperação de um ferido', () => {
    const [traveling] = expeditionTravelingView.guild.expeditions;
    expect(expeditionDeadlines(guildOf(expeditionTravelingView))).toEqual([
      traveling?.nodeEndsInSeconds,
    ]);
    expect(expeditionDeadlines(guildOf(expeditionCrossroadsView))).toEqual([40_798]);
    expect(expeditionDeadlines(guildOf(heroInjuredView))).toEqual([1800]);
    expect(expeditionDeadlines(guildOf(guildPaidView))).toEqual([]);
    // E entram nos prazos da Guilda que a sessão lê.
    expect(guildDeadlines(expeditionCrossroadsView)).toContain(40_798);
    expect(guildDeadlines(heroInjuredView)).toContain(1800);
  });
});
