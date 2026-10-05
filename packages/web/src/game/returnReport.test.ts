import { type GameEvent, ReturnReportSchema, type ViewState } from '@lotg/protocol';
import { describe, expect, it } from 'vitest';

import {
  coldView,
  councilView,
  goldenView,
  impoverishedView,
  initialView,
  mealCard,
  palisadeRaisedView,
  proudView,
  raidAftermathView,
  shareCard,
  threatIncomingView,
  threatWatchedView,
  unlockedView,
  withCards,
  withPlanned,
  withResource,
  withUpgrade,
} from '../test-helpers';
import { beforeLeaving, leavingItems } from './beforeLeaving';
import {
  buildReturnReport,
  costAction,
  coveredTopics,
  currentBlocks,
  pendingItems,
} from './returnReport';

// Roadmap da v0.2, V2D-T4: o Relatório de Retorno em três blocos. Os eventos são sintéticos: a
// frase de cada um é a que o servidor mandaria, e o que se confere é em que bloco ele cai, em
// que ordem e com que ação. Nenhuma regra de jogo: só agrupamento.

const HOUR = 3_600_000;

let seq = 0;
const event = (type: GameEvent['type'], text: string, data: GameEvent['data'] = {}): GameEvent => ({
  seq: (seq += 1),
  type,
  at: '2026-10-01T12:00:00.000Z',
  atMs: seq * 1000,
  text,
  data,
});

const texts = (items: Array<{ text: string }>) => items.map((item) => item.text);
const blocksOf = (before: ViewState | null, after: ViewState, events: GameEvent[]) => {
  const report = buildReturnReport(before, after, events, 6 * HOUR);
  if (report.blocks === undefined) {
    throw new Error('O relatório saiu sem os blocos.');
  }
  // O que sai daqui é o que o protocolo descreve.
  expect(ReturnReportSchema.safeParse(report).error).toBeUndefined();
  return report.blocks;
};

/** Um feudo tranquilo: ninguém livre, uma obra que começa sozinha, nada a preparar. */
const calm = withPlanned(unlockedView, [
  {
    building: 'farm',
    autoStart: true,
    waiting: { reason: 'resources', text: 'espera 59 de madeira', etaSeconds: 7200 },
  },
]);

describe('os três blocos: cada tipo de evento no bloco certo', () => {
  it('o feudo tranquilo, sem eventos: três blocos vazios', () => {
    expect(leavingItems(calm)).toEqual([]);
    expect(blocksOf(calm, calm, [])).toEqual({ prospered: [], cost: [], pending: [] });
  });

  it('"O feudo prosperou": obras, planejadas que começaram sozinhas, ofícios, objetivos e alívios', () => {
    const events = [
      event('dayStarted', 'Amanhece.'),
      event('constructionFinished', 'Os pedreiros ergueram as Habitações ao 2º nível.'),
      event('constructionAutoStarted', 'Os pedreiros começaram sozinhos a erguer a Fazenda.', {
        building: 'farm',
        spent_wood: 80,
      }),
      event('buildingFounded', 'Ergueu-se o Celeiro em Pedra Alta.'),
      event('craftMastered', 'Os lavradores dominaram o ofício.'),
      event('objectiveCompleted', 'Cumpriu-se um objetivo: Recrute 3 aldeões.'),
      event('famineEnded', 'Voltou a haver pão. A fome acabou.'),
      event('coldEnded', 'As lareiras voltaram a arder. O frio passou.'),
      event('moraleBandChanged', 'O povo anda de cabeça erguida.', {
        morale: 78,
        previousMorale: 60,
        band: 'proud',
        previousBand: 'content',
      }),
      event('cardEffectApplied', 'A ponte refeita trouxe um mercador.', { gained_gold: 20 }),
    ];
    const blocks = blocksOf(calm, calm, events);
    // Na ordem em que aconteceram, com a frase da Crônica de cada um; nenhum pede ação.
    expect(texts(blocks.prospered)).toEqual(events.slice(1).map((entry) => entry.text));
    expect(blocks.prospered.every((item) => item.action === undefined)).toBe(true);
    expect(blocks.prospered.map((item) => item.topic)).toEqual([
      'construction',
      'construction',
      'construction',
      'craft',
      'objective',
      'food',
      'firewood',
      'morale',
      'council',
    ]);
    expect(blocks.cost).toEqual([]);
  });

  it('"O que exigiu um preço": fome, frio, moral que desce, cartas expiradas e efeitos que cobram', () => {
    const events = [
      event('famineStarted', 'As despensas ficaram vazias. A fome começou.'),
      event('coldStarted', 'Queimou-se a última acha. O frio entrou nas casas.'),
      event('moraleBandChanged', 'Há resmungos junto ao poço.', {
        morale: 38,
        previousMorale: 60,
        band: 'restless',
        previousBand: 'content',
      }),
      event('cardExpired', 'O conselho esperou em vão e mandou guardar cada saco.', {
        cardId: 'commonGranaryShare',
        optionId: 'reserve',
      }),
      event('cardEffectApplied', 'O atalho pela mata custou caro.', { spent_wood: 30 }),
      event('cardEffectApplied', 'A promessa não cumprida azedou o povo.', {
        morale: -5,
        moraleDays: 2,
      }),
    ];
    const blocks = blocksOf(calm, calm, events);
    expect(texts(blocks.cost)).toEqual(events.map((entry) => entry.text));
    expect(blocks.cost.map((item) => item.topic)).toEqual([
      'food',
      'firewood',
      'morale',
      'council',
      'council',
      'council',
    ]);
    // Toda perda aponta uma ação possível (V2D-T4.2), e nunca é dita só pela cor.
    for (const item of blocks.cost) {
      expect(item.action, item.text).toBeDefined();
      expect(item.severity).toBe('warning');
    }
    expect(blocks.prospered).toEqual([]);
  });

  it('a recompensa que o depósito cortou: a boa notícia em "prosperou", e o corte na linha do depósito', () => {
    // A frase de "Sementes para o próximo campo", como o conteúdo a escreve: ela conta a colheita
    // e não fala de perda. Com a Despensa no limite (o estado comum do feudo), uma unidade fica
    // de fora, e quem diz isso é a linha do depósito, com o botão dela.
    const harvest =
      'No 9º dia da Primavera, o campo novo de Pedra Alta deu a primeira colheita. O grão cedido voltou dobrado.';
    const blocks = blocksOf(calm, calm, [
      event('cardEffectApplied', harvest, { gained_food: 79, lost_food: 1 }),
      event('constructionFinished', 'Os pedreiros ergueram a Serraria ao 2º nível.'),
      event('cardExpired', 'O conselho decidiu sozinho.'),
    ]);
    expect(blocks.prospered.map((item) => [item.text, item.topic])).toEqual([
      [harvest, 'council'],
      ['Os pedreiros ergueram a Serraria ao 2º nível.', 'construction'],
    ]);
    expect(blocks.prospered[0]?.severity).toBeUndefined();
    expect(blocks.cost.map((item) => [item.text, item.topic])).toEqual([
      // O corte de uma recompensa é perda como a da produção: entra na linha do depósito, que
      // fica onde a perda aconteceu.
      ['Despensa sem espaço: 1 de comida foi ao chão.', 'storage:granary'],
      ['O conselho decidiu sozinho.', 'council'],
    ]);
  });

  it('o efeito escondido que tirou do estoque ou da moral é preço, mesmo com um ganho junto', () => {
    const blocks = blocksOf(calm, calm, [
      event('cardEffectApplied', 'O poço de Pedra Alta desabou de vez.', { spent_stone: 15 }),
      event('cardEffectApplied', 'Os viajantes seguiram viagem resmungando.', {
        gained_wood: 20,
        morale: -5,
        moraleDays: 2,
      }),
    ]);
    expect(blocks.cost.map((item) => item.text)).toEqual([
      'O poço de Pedra Alta desabou de vez.',
      'Os viajantes seguiram viagem resmungando.',
    ]);
    expect(blocks.prospered).toEqual([]);
  });

  it('a gente entra somada: uma linha por motivo, e não uma por aldeão', () => {
    const events = [
      event('recruitmentFinished', 'Um novo aldeão se juntou ao feudo. Agora são 6.'),
      event('villagerArrived', 'Um colono bateu ao portão. Agora são 7.'),
      event('recruitmentFinished', 'Um novo aldeão se juntou ao feudo. Agora são 8.'),
      event('villagerDeserted', 'Um lavrador fugiu da fome. Restam 7.'),
      event('villagerLeft', 'Um lenhador juntou a trouxa. Restam 6.'),
      event('villagerDeserted', 'Um canteiro fugiu da fome. Restam 5.'),
    ];
    const blocks = blocksOf(calm, calm, events);
    expect(texts(blocks.prospered)).toEqual([
      'Chegaram 2 recrutas que o Salão mandou chamar.',
      'Chegou 1 colono sem ninguém chamar: a moral alta atrai gente.',
    ]);
    // A soma fica onde aconteceu o primeiro: as deserções antes da partida.
    expect(blocks.cost).toEqual([
      {
        text: 'Desertaram 2 aldeões: a fome durou demais.',
        topic: 'food',
        severity: 'warning',
        action: { command: 'lords.allocateWorkers', arg: 'farm', label: 'Alocar na Fazenda' },
      },
      {
        text: 'Partiu 1 aldeão: a moral estava baixa.',
        topic: 'morale',
        severity: 'warning',
        action: { command: 'lords.openPanel', arg: 'fief', label: 'Ver a moral' },
      },
    ]);
  });

  it('o que não é desfecho fica fora dos blocos, e continua na Crônica da ausência', () => {
    const events = [
      event('dayStarted', 'Amanhece.'),
      event('seasonChanged', 'Chega o Verão a Pedra Alta.'),
      event('yearStarted', 'Começa o ano 2.'),
      // Ordens dadas em outro navegador durante a ausência deste.
      event('constructionStarted', 'Os pedreiros começaram a erguer a Serraria.', {
        spent_wood: 100,
      }),
      event('constructionCancelled', 'Os pedreiros largaram as ferramentas.'),
      event('recruitmentStarted', 'O Salão mandou chamar novos aldeões: 2.'),
      event('cardAnswered', 'O senhor mandou abrir os sacos.', { spent_food: 30 }),
      event('settlementRenamed', 'O feudo passou a se chamar Vila Nova.'),
      // A carta que chegou e ainda espera aparece em "Você ainda pode decidir", pela visão.
      event('cardDrawn', 'O conselho pediu audiência: A vez de repartir.'),
    ];
    const report = buildReturnReport(calm, calm, events, 6 * HOUR);
    expect(report.blocks).toEqual({ prospered: [], cost: [], pending: [] });
    expect(report.highlights).toEqual(events.slice(1).map((entry) => entry.text));
  });

  it('vários objetivos cumpridos na ausência: uma linha só, com a recompensa de cada um, onde o primeiro aconteceu', () => {
    // O feudo que já tinha a Torre, o depósito e a Paliçada recebe os objetivos deles e os
    // cumpre de uma vez: são cinco eventos, e o bloco diz tudo em uma linha.
    const events = [
      event('constructionFinished', 'Os pedreiros ergueram a Fazenda ao 2º nível.'),
      event('objectiveCompleted', 'Cumpriu-se um objetivo: Construa a Torre de Vigia.', {
        objective: 'buildWatchtower',
        gained_stone: 40,
      }),
      event('objectiveCompleted', 'Cumpriu-se um objetivo: Responda à primeira carta.', {
        objective: 'answerFirstCard',
        morale: 10,
        moraleDays: 1,
      }),
      event('craftMastered', 'Os lavradores dominaram o ofício.'),
      event('objectiveCompleted', 'Cumpriu-se um objetivo: Construa o Celeiro ou o Armazém.', {
        objective: 'buildGranaryOrWarehouse',
        gained_wood: 60,
      }),
      event('objectiveCompleted', 'Cumpriu-se um objetivo: Construa a Paliçada.', {
        objective: 'buildPalisade',
        gained_wood: 100,
      }),
      event('objectiveCompleted', 'Cumpriu-se um objetivo: Atravesse o inverno sem passar frio.', {
        objective: 'surviveWinterWithoutCold',
        morale: 15,
        moraleDays: 1,
      }),
    ];
    // A visão de agora traz os dez cumpridos, com a recompensa de cada um como a tela a diz.
    const after = palisadeRaisedView;
    const report = buildReturnReport(after, after, events, 6 * HOUR);
    expect(texts(report.blocks?.prospered ?? [])).toEqual([
      'Os pedreiros ergueram a Fazenda ao 2º nível.',
      '5 objetivos cumpridos. Construa a Torre de Vigia: +40 pedra. ' +
        'Responda à primeira carta do Conselho: +10 de moral por 1 dia de jogo (40 min). ' +
        'Construa o Celeiro ou o Armazém: +60 madeira. Construa a Paliçada: +100 madeira. ' +
        'Atravesse o inverno sem passar frio: +15 de moral por 1 dia de jogo (40 min).',
      'Os lavradores dominaram o ofício.',
    ]);
    const line = report.blocks?.prospered[1];
    // Boa notícia não pede ação, e o assunto continua sendo o dos objetivos.
    expect(line?.topic).toBe('objective');
    expect(line?.action).toBeUndefined();
    // A contagem, a conta dos estoques e a Crônica da ausência continuam com cada um.
    expect(report.counts.objectivesCompleted).toBe(5);
    expect(report.resources.find((row) => row.id === 'wood')?.received).toBe(160);
    expect(report.resources.find((row) => row.id === 'stone')?.received).toBe(40);
    expect(report.highlights).toEqual(events.map((entry) => entry.text));
  });

  it('um objetivo só fica com a frase da Crônica, que já diz a recompensa', () => {
    const text =
      'No 9º dia da Primavera, cumpriu-se um objetivo: Responda à primeira carta do Conselho. Recompensa: +10 de moral por 1 dia de jogo.';
    const events = [
      event('objectiveCompleted', text, {
        objective: 'answerFirstCard',
        morale: 10,
        moraleDays: 1,
      }),
    ];
    expect(texts(blocksOf(calm, calm, events).prospered)).toEqual([text]);
  });

  it('a ordem de cada bloco é a dos acontecimentos, mesmo com os tipos misturados', () => {
    const events = [
      event('cardExpired', 'O conselho decidiu sozinho: repartir o pão.'),
      event('constructionFinished', 'Os pedreiros ergueram a Fazenda ao 2º nível.'),
      event('famineStarted', 'A fome começou.'),
      event('objectiveCompleted', 'Cumpriu-se um objetivo.'),
      event('villagerDeserted', 'Um lavrador fugiu da fome.'),
      event('famineEnded', 'A fome acabou.'),
      event('constructionFinished', 'Os pedreiros ergueram a Serraria ao 2º nível.'),
    ];
    const blocks = blocksOf(calm, calm, events);
    expect(texts(blocks.prospered)).toEqual([
      'Os pedreiros ergueram a Fazenda ao 2º nível.',
      'Cumpriu-se um objetivo.',
      'A fome acabou.',
      'Os pedreiros ergueram a Serraria ao 2º nível.',
    ]);
    expect(texts(blocks.cost)).toEqual([
      'O conselho decidiu sozinho: repartir o pão.',
      'A fome começou.',
      'Desertou 1 aldeão: a fome durou demais.',
    ]);
  });
});

describe('o que foi ao chão: uma linha por depósito, com a soma e a obra que resolve', () => {
  const filled = (resource: string, building: string, text: string) =>
    event('storageFilled', text, { resource, building, level: 0, cap: 500 });
  const wasted = (data: GameEvent['data']) => event('storageWasted', 'Foi ao chão.', data);

  it('soma os fechos diários e diz o lugar com o nome que ele tem hoje', () => {
    const after = withResource(unlockedView, 'food', { stock: 500, wastedToday: 12 });
    const events = [
      event('constructionFinished', 'Os pedreiros ergueram as Habitações.'),
      filled('food', 'granary', 'A despensa de Pedra Alta encheu.'),
      wasted({ wasted_food: 60 }),
      event('cardExpired', 'O conselho decidiu sozinho.'),
      wasted({ wasted_food: 48 }),
    ];
    const blocks = blocksOf(unlockedView, after, events);
    // 60 + 48 dos fechos e os 12 que o dia de hoje ainda não fechou. A frase de "encheu" não se
    // repete: a linha do depósito diz mais. Ela fica onde o depósito encheu, antes da carta.
    expect(blocks.cost).toEqual([
      {
        text: 'Despensa sem espaço: 120 de comida foram ao chão.',
        topic: 'storage:granary',
        severity: 'warning',
        // O Celeiro pode ser erguido (Salão Nv2), mas faltam recursos: o botão leva ao feudo.
        action: { command: 'lords.openPanel', arg: 'fief', label: 'Ver os depósitos' },
      },
      expect.objectContaining({ text: 'O conselho decidiu sozinho.' }),
    ]);
    // O fecho diário nunca vira linha.
    expect(texts([...blocks.cost, ...blocks.prospered])).not.toContain('Foi ao chão.');
  });

  it('com a obra do depósito ao alcance, o botão é ela ("Celeiro cheio → Construir Celeiro")', () => {
    const affordable = withUpgrade(
      withResource(unlockedView, 'food', { stock: 500, wastedToday: 0 }),
      'granary',
      { blockedReason: null },
    );
    const [item] = blocksOf(unlockedView, affordable, [wasted({ wasted_food: 120 })]).cost;
    expect(item?.action).toEqual({
      command: 'lords.build',
      arg: 'granary',
      label: 'Construir Celeiro',
    });
  });

  it('a madeira e a pedra dividem o Pátio: uma linha, um botão', () => {
    const events = [wasted({ wasted_wood: 76, wasted_stone: 20 }), wasted({ wasted_wood: 4 })];
    const blocks = blocksOf(unlockedView, unlockedView, events);
    expect(texts(blocks.cost)).toEqual([
      'Pátio sem espaço: 80 de madeira e 20 de pedra foram ao chão.',
    ]);
    expect(blocks.cost[0]?.topic).toBe('storage:warehouse');
  });

  it('uma unidade só: "foi ao chão"', () => {
    const blocks = blocksOf(unlockedView, unlockedView, [wasted({ wasted_food: 1 })]);
    expect(texts(blocks.cost)).toEqual(['Despensa sem espaço: 1 de comida foi ao chão.']);
  });

  it('o depósito que encheu sem nada ir ao chão: a frase da Crônica, com o mesmo botão', () => {
    const blocks = blocksOf(unlockedView, unlockedView, [
      filled('wood', 'warehouse', 'O Pátio de Pedra Alta encheu: não cabe mais madeira.'),
    ]);
    expect(blocks.cost).toEqual([
      {
        text: 'O Pátio de Pedra Alta encheu: não cabe mais madeira.',
        topic: 'storage:warehouse',
        severity: 'warning',
        action: { command: 'lords.openPanel', arg: 'fief', label: 'Ver os depósitos' },
      },
    ]);
  });

  it('sem a visão da última visita, vale a soma dos fechos diários', () => {
    // O contador de hoje pode ser de antes da saída: sem a visão de antes, não entra.
    const after = withResource(unlockedView, 'food', { wastedToday: 30 });
    const blocks = blocksOf(null, after, [wasted({ wasted_food: 60 })]);
    expect(texts(blocks.cost)).toEqual(['Despensa sem espaço: 60 de comida foram ao chão.']);
  });
});

describe('a próxima ação de cada perda (V2D-T4.2): a de "Antes de partir", com a visão de agora', () => {
  it('a fome que não parou: uma linha sem número, com o botão do item da comida', () => {
    const food = beforeLeaving(impoverishedView).find((item) => item.id === 'food');
    // A fome começou antes da saída e nenhum evento da ausência a conta: é o primeiro item, e
    // sem ele o bloco diria que nada se perdeu.
    const blocks = blocksOf(impoverishedView, impoverishedView, [
      event('villagerDeserted', 'Um lavrador fugiu da fome.'),
    ]);
    expect(blocks.cost[0]).toEqual({
      text: 'A fome continuou durante toda a sua ausência.',
      topic: 'food',
      severity: 'warning',
      action: { command: food?.command.id, arg: food?.command.arg, label: food?.command.label },
    });
    expect(food?.command.label).toBe('Alocar na Fazenda');
    // Quem desertou na fome aponta a mesma saída.
    const deserted = blocks.cost.find((item) => item.text.startsWith('Desertou 1 aldeão'));
    expect(deserted?.action).toEqual(blocks.cost[0]?.action);
    // Com a fome começando na ausência, quem conta é o evento: a linha não se repete.
    const started = blocksOf(initialView, impoverishedView, [
      event('famineStarted', 'As despensas ficaram vazias. A fome começou.'),
    ]);
    expect(texts(started.cost).filter((text) => text.includes('fome'))).toEqual([
      'As despensas ficaram vazias. A fome começou.',
    ]);
  });

  it('o frio que não parou: uma linha sem número, com o botão da Serraria', () => {
    expect(blocksOf(coldView, coldView, []).cost).toEqual([
      {
        text: 'O frio continuou durante toda a sua ausência.',
        topic: 'firewood',
        severity: 'warning',
        action: {
          command: 'lords.allocateWorkers',
          arg: 'lumberMill',
          label: 'Alocar na Serraria',
        },
      },
    ]);
    // O frio que começou na ausência é contado pelo evento.
    const started = blocksOf(calm, coldView, [event('coldStarted', 'O frio entrou nas casas.')]);
    expect(texts(started.cost)).toEqual(['O frio entrou nas casas.']);
  });

  it('a fome que já acabou ainda aponta a Fazenda: é o que evita a próxima', () => {
    expect(leavingItems(calm).find((item) => item.id === 'food')).toBeUndefined();
    expect(costAction(calm, 'food')).toEqual({
      command: 'lords.allocateWorkers',
      arg: 'farm',
      label: 'Alocar na Fazenda',
    });
    expect(costAction(calm, 'firewood')).toEqual({
      command: 'lords.allocateWorkers',
      arg: 'lumberMill',
      label: 'Alocar na Serraria',
    });
  });

  it('a carta que expirou leva ao Conselho; com outra à espera, o botão diz isso', () => {
    const council = { command: 'lords.openPanel', arg: 'council' };
    expect(costAction(calm, 'council')).toEqual({ ...council, label: 'Ver o Conselho' });
    expect(costAction(withCards(calm, [mealCard]), 'council')).toEqual({
      ...council,
      label: 'Decidir a carta à espera',
    });
    expect(costAction(councilView, 'council')).toEqual({
      ...council,
      label: 'Decidir as cartas à espera',
    });
  });

  it('a moral leva ao painel dela; um depósito que a visão não conhece, aos depósitos', () => {
    expect(costAction(calm, 'morale')).toEqual({
      command: 'lords.openPanel',
      arg: 'fief',
      label: 'Ver a moral',
    });
    expect(costAction(calm, 'storage:cellar')).toEqual({
      command: 'lords.openPanel',
      arg: 'fief',
      label: 'Ver os depósitos',
    });
  });
});

describe('a incursão no relatório (GDD §8.2, §12.3 e critério 4 da §16.2)', () => {
  const HOWL =
    'No 10º dia da Primavera, ouviram-se uivos na mata ao redor de Pedra Alta. Sem quem vigie, ninguém sabe quantos são.';
  const SUFFERED =
    'No 16º dia da Primavera, os lobos chegaram a Pedra Alta sem que ninguém os visse vir. Nada os deteve: o ataque custou 30 de comida, 12,5 de madeira e um aldeão ferido. Uma paliçada os teria detido.';
  const REPELLED =
    'No 16º dia da Primavera, os lobos chegaram a Pedra Alta sem que ninguém os visse vir. Recuaram diante da paliçada: nada se perdeu e ninguém se feriu.';
  const HURT = 'No 16º dia da Primavera, um lenhador de Pedra Alta saiu ferido do ataque.';
  const HEALED = 'No 17º dia da Primavera, um lenhador de Pedra Alta sarou das feridas.';
  const RAID = { raidId: 'wolvesYear1', enemy: 'wolves', size: 'light', warning: 'unwarned' };

  const suffered = () =>
    event('raidSuffered', SUFFERED, {
      ...RAID,
      palisadeLevel: 0,
      injured: 1,
      raided_food: 30,
      raided_wood: 12.5,
      palisadeLevelNeeded: 1,
    });
  const repelled = () => event('raidRepelled', REPELLED, { ...RAID, palisadeLevel: 1 });
  const hurt = () =>
    event('villagerInjured', HURT, { raidId: 'wolvesYear1', injured: 1, building: 'lumberMill' });
  const healed = () => event('villagerRecovered', HEALED, { injured: 0, building: 'lumberMill' });

  it('a incursão sofrida entra em "custou": a frase com as perdas, os feridos e o que a teria detido, e a próxima ação', () => {
    const blocks = blocksOf(calm, calm, [event('wolvesHowl', HOWL), suffered(), hurt()]);
    expect(blocks.cost).toEqual([
      {
        text: SUFFERED,
        topic: 'raid',
        severity: 'warning',
        // A ação é a da defesa, pela visão de agora: os casos estão logo abaixo.
        action: costAction(calm, 'raid'),
      },
    ]);
    // Os uivos e o ferido não são desfechos: a frase do ataque já conta quem se feriu.
    expect(blocks.prospered).toEqual([]);
  });

  it('a incursão que a paliçada deteve entra em "prosperou", sem botão: o feudo se defendeu sozinho', () => {
    const blocks = blocksOf(calm, calm, [repelled()]);
    expect(blocks.prospered).toEqual([{ text: REPELLED, topic: 'raid' }]);
    expect(blocks.cost).toEqual([]);
  });

  it('os feridos que sararam entram somados em "prosperou", onde o primeiro sarou', () => {
    const blocks = blocksOf(calm, calm, [
      suffered(),
      hurt(),
      hurt(),
      event('constructionFinished', 'A Serraria ficou pronta.'),
      healed(),
      healed(),
    ]);
    expect(texts(blocks.prospered)).toEqual([
      'A Serraria ficou pronta.',
      '2 aldeões sararam das feridas: quem tinha ofício voltou a ele.',
    ]);
    expect(texts(blocksOf(calm, calm, [healed()]).prospered)).toEqual([
      '1 aldeão sarou das feridas: se tinha ofício, voltou a ele.',
    ]);
    // Quem se feriu não ganha linha própria: está na frase de cada ataque.
    expect(texts(blocks.cost)).toEqual([SUFFERED]);
  });

  describe('a próxima ação é a defesa, pela visão de agora', () => {
    it('com a obra da Paliçada liberada, o botão é ela', () => {
      expect(costAction(palisadeRaisedView, 'raid')).toEqual({
        command: 'lords.build',
        arg: 'palisade',
        label: 'Melhorar Paliçada',
      });
    });

    it('com a Paliçada travada, o painel da Ameaça, mesmo com a Torre ao alcance (ADR 0016, item 9)', () => {
      // Depois do ataque do golden a Torre pode subir de nível agora, e a Paliçada espera o
      // Salão: o botão não manda gastar na Torre a madeira que a Paliçada vai pedir.
      const tower = raidAftermathView.constructions.available.find(
        (upgrade) => upgrade.building === 'watchtower',
      );
      expect(tower?.blockedReason).toBeNull();
      expect(costAction(raidAftermathView, 'raid')).toEqual({
        command: 'lords.openPanel',
        arg: 'threat',
        label: 'Ver a defesa',
      });
    });

    it('sem nenhuma das duas ao alcance, o caminho para o painel da Ameaça, que diz o motivo', () => {
      expect(costAction(initialView, 'raid')).toEqual({
        command: 'lords.openPanel',
        arg: 'threat',
        label: 'Ver a defesa',
      });
      expect(costAction(threatIncomingView, 'raid')).toEqual({
        command: 'lords.openPanel',
        arg: 'threat',
        label: 'Ver a defesa',
      });
    });

    it('na tela, o botão acompanha o feudo: a obra que ficou ao alcance toma o lugar do caminho', () => {
      const report = buildReturnReport(initialView, initialView, [suffered()], 6 * HOUR);
      expect(currentBlocks(report, initialView).cost[0]?.action?.label).toBe('Ver a defesa');
      // O Salão subiu e os recursos chegaram: a mesma perda aponta agora a obra.
      const [cost] = currentBlocks(report, palisadeRaisedView).cost;
      expect(cost).toMatchObject({ text: SUFFERED, action: { label: 'Melhorar Paliçada' } });
    });
  });

  it('a conta dos estoques: o que os lobos levaram tem a sua parcela, e a produção não o paga', () => {
    const before = withResource(withResource(calm, 'food', { stock: 300 }), 'wood', { stock: 125 });
    // 60 de comida e 20 de madeira produzidas; os lobos levaram 30 e 12,5.
    const after = withResource(withResource(calm, 'food', { stock: 330 }), 'wood', {
      stock: 132.5,
    });
    const report = buildReturnReport(before, after, [suffered(), hurt()], 6 * HOUR);
    const row = (id: string) => report.resources.find((entry) => entry.id === id);
    expect(row('food')).toMatchObject({ delta: 30, raided: 30, produced: 60, spent: 0, wasted: 0 });
    expect(row('wood')).toMatchObject({ delta: 7.5, raided: 12.5, produced: 20 });
    // A pedra e o ouro ficaram.
    expect(row('stone')).toMatchObject({ raided: 0 });
    expect(row('gold')).toMatchObject({ raided: 0 });
    expect(ReturnReportSchema.safeParse(report).error).toBeUndefined();
  });

  it('as contagens vêm dos eventos: sofridas, repelidas, feridos e quem já sarou', () => {
    const report = buildReturnReport(
      calm,
      calm,
      [suffered(), hurt(), healed(), repelled(), suffered(), hurt(), hurt()],
      30 * HOUR,
    );
    expect(report.counts).toMatchObject({
      raidsSuffered: 2,
      raidsRepelled: 1,
      villagersInjured: 3,
      villagersRecovered: 1,
    });
    // Tudo continua na Crônica da ausência, linha a linha.
    expect(report.highlights).toHaveLength(7);
  });

  it('com a Torre, o alarme dos vigias não é desfecho: fica na Crônica da ausência', () => {
    const alarm = event(
      'raidAnnounced',
      'No 15º dia da Primavera, os vigias de Pedra Alta deram o alarme: lobos a caminho.',
      { raidId: 'wolvesYear1', enemy: 'wolves', warning: 'warned' },
    );
    const report = buildReturnReport(
      threatWatchedView,
      raidAftermathView,
      [alarm, suffered()],
      HOUR,
    );
    expect(texts(report.blocks?.cost ?? []).filter((text) => text === SUFFERED)).toHaveLength(1);
    expect(texts(report.blocks?.cost ?? [])).not.toContain(alarm.text);
    expect(texts(report.blocks?.prospered ?? [])).not.toContain(alarm.text);
    expect(report.highlights).toContain(alarm.text);
  });
});

describe('"Você ainda pode decidir": só a visão de agora', () => {
  it('as cartas, da que vence primeiro à última, com o prazo e a escolha que voltou', () => {
    const items = pendingItems(councilView);
    expect(items.slice(0, 2)).toEqual([
      {
        // A continuação lembra a escolha que a trouxe, na frase do servidor.
        text: `Conselho: “A vez de repartir” · expira em 22 h. ${shareCard.followsFrom?.text}`,
        topic: `card:${shareCard.instanceId}`,
        action: { command: 'lords.openPanel', arg: 'council', label: 'Decidir' },
      },
      {
        text: 'Conselho: “A refeição dos pedreiros” · expira em 23 h.',
        topic: `card:${mealCard.instanceId}`,
        action: { command: 'lords.openPanel', arg: 'council', label: 'Decidir' },
      },
    ]);
    expect(shareCard.followsFrom?.text).toContain('A história continua');
    // Com o prazo folgado não há urgência a dizer: o item não leva grau nenhum.
    expect(items[0]).not.toHaveProperty('severity');
  });

  it('o prazo desce com o relógio da página, e perto do fim ganha o sinal de aviso', () => {
    const [share] = pendingItems(councilView, 16 * 3600);
    expect(share?.text).toContain('expira em 6 h');
    expect(share?.severity).toBe('warning');
  });

  it('depois das cartas, as obras que não começam sozinhas e os aldeões livres', () => {
    const view = withCards(initialView, [mealCard]);
    const leaving = leavingItems(view);
    expect(leaving.map((item) => item.id)).toEqual(['queue', 'idle']);
    expect(pendingItems(view).map((item) => [item.topic, item.text, item.action?.label])).toEqual([
      [
        `card:${mealCard.instanceId}`,
        'Conselho: “A refeição dos pedreiros” · expira em 23 h.',
        'Decidir',
      ],
      ['queue', 'Os pedreiros estão livres e nenhuma obra começa sozinha.', 'Planejar obras'],
      ['idle', '5 aldeões livres, sem ofício.', 'Alocar trabalhadores'],
    ]);
    // O que é previsão (a comida que acaba, o depósito que enche) fica em "Antes de partir".
    expect(pendingItems(proudView).map((item) => item.topic)).not.toContain('storage:granary');
  });

  it('o relatório guarda o bloco do instante em que foi montado', () => {
    const view = withCards(initialView, [mealCard]);
    expect(blocksOf(initialView, view, []).pending).toEqual(pendingItems(view));
  });
});

describe('os blocos na tela: o que é da ausência fica, o que é de agora acompanha o feudo', () => {
  const absence = [
    event('constructionFinished', 'Os pedreiros ergueram as Habitações.'),
    event('storageWasted', 'Foi ao chão.', { wasted_food: 120 }),
    event('cardExpired', 'O conselho decidiu sozinho.'),
  ];
  const full = withUpgrade(withResource(unlockedView, 'food', { stock: 500 }), 'granary', {
    blockedReason: null,
  });
  const returned = withCards(full, [mealCard]);
  const report = buildReturnReport(unlockedView, returned, absence, 6 * HOUR);

  it('com a visão de quando voltou, são os blocos do relatório', () => {
    expect(currentBlocks(report, returned)).toEqual(report.blocks);
    expect(report.blocks?.cost.map((item) => item.action?.label)).toEqual([
      'Construir Celeiro',
      'Decidir a carta à espera',
    ]);
  });

  it('a carta respondida sai de "Você ainda pode decidir", e as ações acompanham', () => {
    // O jogador respondeu a carta e mandou erguer o Celeiro: a obra já não é oferecida.
    const acted = withUpgrade(withCards(returned, []), 'granary', {
      blockedReason: 'Os pedreiros estão ocupados.',
    });
    const blocks = currentBlocks(report, acted);
    expect(blocks.prospered).toEqual(report.blocks?.prospered);
    expect(texts(blocks.cost)).toEqual(texts(report.blocks?.cost ?? []));
    expect(blocks.cost.map((item) => item.action?.label)).toEqual([
      'Ver os depósitos',
      'Ver o Conselho',
    ]);
    expect(blocks.pending.map((item) => item.topic)).not.toContain(`card:${mealCard.instanceId}`);
  });

  it('um relatório sem blocos (de quem não os preenche) fica só com o que a visão diz', () => {
    const bare = { ...report };
    delete bare.blocks;
    expect(currentBlocks(bare, returned)).toEqual({
      prospered: [],
      cost: [],
      pending: pendingItems(returned),
    });
  });

  it('"Antes de partir" não repete o que "Você ainda pode decidir" já traz, com a mesma frase', () => {
    const view = withCards(withResource(initialView, 'food', { stock: 500 }), [mealCard]);
    const built = buildReturnReport(initialView, view, absence, 6 * HOUR);
    const covered = coveredTopics(currentBlocks(built, view));
    expect(covered).toEqual([`card:${mealCard.instanceId}`, 'queue', 'idle']);
    expect(leavingItems(view).map((item) => item.id)).toEqual(['queue', 'idle']);
    expect(beforeLeaving(view, covered)).toEqual([]);
    // O que custou não tira nada de lá: o relatório conta a perda da ausência, e "Antes de
    // partir", o que está acontecendo agora (o depósito que segue cheio).
    const wasting = withResource(view, 'food', { full: true, wastingPerHour: 55, perHour: 0 });
    const still = coveredTopics(currentBlocks(built, wasting));
    expect(still).not.toContain('storage:granary');
    expect(beforeLeaving(wasting, still).map((item) => item.id)).toEqual(['storage:granary']);
  });

  it('nada do golden do feudo comum quebra a montagem', () => {
    for (const view of [
      goldenView,
      initialView,
      coldView,
      impoverishedView,
      proudView,
      councilView,
      threatIncomingView,
      raidAftermathView,
      palisadeRaisedView,
    ]) {
      const built = buildReturnReport(view, view, absence, HOUR);
      expect(ReturnReportSchema.safeParse(built).error).toBeUndefined();
    }
  });
});
