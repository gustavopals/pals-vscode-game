import type { GameEvent, ViewState } from '@lotg/protocol';
import { describe, expect, it } from 'vitest';

import {
  activeConstruction,
  autumnView,
  gameEvent,
  initialView,
  lateObjectivesView,
  mealCard,
  unlockedView,
  withCards,
  withObjective,
  withPlanned,
  withQueues,
  withUpgrade,
} from '../test-helpers';
import {
  activeObjectives,
  completedObjectives,
  navigatesOnly,
  noActiveObjectives,
  objectiveAction,
  objectiveLines,
  objectiveNote,
  objectiveProgress,
  objectivesCompleted,
  objectivesCompletedSentence,
  objectivesSummary,
  objectiveTreeLine,
} from './objectives';

type Objective = ViewState['objectives'][number];

/** O objetivo com este id, como a visão o traz. */
function objectiveOf(view: ViewState, id: string): Objective {
  const found = view.objectives.find((objective) => objective.id === id);
  if (found === undefined) {
    throw new Error(`A visão não traz o objetivo ${id}.`);
  }
  return found;
}

const actionOf = (view: ViewState, id: string) => objectiveAction(view, objectiveOf(view, id));
const noteOf = (view: ViewState, id: string) => objectiveNote(view, objectiveOf(view, id));

const completed = (
  seq: number,
  objective: string,
  text = `Cumpriu-se ${objective}.`,
): GameEvent => ({
  ...gameEvent(seq, 'objectiveCompleted', text),
  data: { objective },
});

describe('objetivos: o que a lista diz', () => {
  it('separa os em aberto dos cumpridos, na ordem em que vieram', () => {
    expect(activeObjectives(unlockedView).map((objective) => objective.id)).toEqual([
      'buildWatchtower',
      'answerFirstCard',
      'buildGranaryOrWarehouse',
    ]);
    expect(completedObjectives(unlockedView).map((objective) => objective.id)).toEqual([
      'allocateFarmers',
      'upgradeHousing',
      'recruitVillagers',
      'townHallLevel2',
    ]);
  });

  it('o resumo da árvore conta os dois grupos, e fala só do que existe', () => {
    expect(objectivesSummary(initialView)).toBe('3 em aberto');
    expect(objectivesSummary(unlockedView)).toBe('3 em aberto · 4 cumpridos');
    expect(objectivesSummary(autumnView)).toBe('10 cumpridos');
    expect(objectivesSummary({ objectives: [objectiveOf(unlockedView, 'allocateFarmers')] })).toBe(
      '1 cumprido',
    );
    expect(objectivesSummary({ objectives: [] })).toBe('nenhum por agora');
  });

  it('sem objetivo em aberto, a frase não promete nem lamenta: a visão não diz quantos vêm', () => {
    // O fim da sequência e a leitura em que os seguintes ainda não foram revelados são o mesmo
    // estado para o app: nada em aberto, com objetivos cumpridos.
    expect(noActiveObjectives(autumnView)).toBe(
      'Nenhum objetivo em aberto agora: o que havia a cumprir está cumprido.',
    );
    expect(noActiveObjectives({ objectives: completedObjectives(unlockedView) })).toBe(
      'Nenhum objetivo em aberto agora: o que havia a cumprir está cumprido.',
    );
    expect(noActiveObjectives({ objectives: [] })).toBe('Nenhum objetivo por agora.');
  });

  it('o progresso só aparece no objetivo que se cumpre aos poucos', () => {
    expect(objectiveProgress(objectiveOf(initialView, 'allocateFarmers'))).toBe('0/2');
    expect(objectiveProgress(objectiveOf(initialView, 'recruitVillagers'))).toBe('0/3');
    // "0/1" não diz nada que "Construa a Torre de Vigia" já não diga.
    expect(objectiveProgress(objectiveOf(unlockedView, 'buildWatchtower'))).toBeNull();
    expect(objectiveTreeLine(objectiveOf(initialView, 'recruitVillagers'))).toBe(
      '0/3 · +40 comida',
    );
    expect(objectiveTreeLine(objectiveOf(unlockedView, 'buildWatchtower'))).toBe('+40 pedra');
  });

  it('a recompensa de moral sai como o servidor a escreveu, com o prazo no relógio de quem joga', () => {
    const card = objectiveOf(unlockedView, 'answerFirstCard');
    expect(objectiveTreeLine(card)).toBe('+10 de moral por 1 dia de jogo (2 h)');
    expect(objectiveLines(unlockedView, card)).toEqual([
      'Quem se cala deixa o conselho decidir em seu lugar.',
      'Recompensa: +10 de moral por 1 dia de jogo (2 h).',
      'Nenhuma carta espera resposta: vale a próxima que o Conselho trouxer.',
    ]);
    const winter = objectiveOf(lateObjectivesView, 'surviveWinterWithoutCold');
    expect(objectiveLines(lateObjectivesView, winter)).toEqual([
      'A lareira queima madeira o inverno inteiro: guarde lenha no outono.',
      'Recompensa: +15 de moral por 1 dia de jogo (2 h).',
      'Falta o Inverno chegar e passar sem frio.',
    ]);
  });
});

describe('objetivos: o que falta e o botão que leva até lá', () => {
  it('trabalhadores: abre a alocação no edifício pedido, com o nome que a visão dá', () => {
    expect(actionOf(initialView, 'allocateFarmers')).toEqual({
      command: 'lords.allocateWorkers',
      arg: 'farm',
      label: 'Alocar na Fazenda',
      text: 'Alocar',
    });
    expect(noteOf(initialView, 'allocateFarmers')).toEqual({
      ready: false,
      text: 'Faltam 2 aldeões na Fazenda.',
    });
  });

  it('a obra que pode começar: o botão a ordena, e o custo e o prazo ficam ao lado da recompensa', () => {
    expect(actionOf(initialView, 'upgradeHousing')).toEqual({
      command: 'lords.build',
      arg: 'housing',
      label: 'Melhorar Habitações',
      text: 'Melhorar',
      terms: '80 madeira, 20 pedra · 4 min',
    });
    // O servidor não manda frase quando só falta a ordem: a tela diz isso, com o preço.
    expect(noteOf(initialView, 'upgradeHousing')).toEqual({
      ready: true,
      text: 'Pode começar agora: 80 madeira, 20 pedra · 4 min.',
    });
    const freed = withObjective(
      withUpgrade(unlockedView, 'watchtower', { blockedReason: null }),
      'buildWatchtower',
      { missing: null },
    );
    expect(actionOf(freed, 'buildWatchtower')).toMatchObject({
      command: 'lords.build',
      arg: 'watchtower',
      label: 'Construir Torre de Vigia',
      text: 'Construir',
    });
  });

  it('a obra travada: a frase do servidor diz o motivo, e o botão leva às construções', () => {
    expect(noteOf(unlockedView, 'buildWatchtower')).toEqual({
      ready: false,
      text: 'Faltam 99 madeira e 112 pedra.',
    });
    const action = actionOf(unlockedView, 'buildWatchtower');
    expect(action).toEqual({
      command: 'lords.openPanel',
      arg: 'constructions',
      label: 'Ver as obras',
      text: 'Ver',
    });
    // Só navega: continua valendo sem ligação.
    expect(action === null ? false : navigatesOnly(action)).toBe(true);
    expect(actionOf(lateObjectivesView, 'buildPalisade')).toMatchObject({ label: 'Ver as obras' });
    expect(noteOf(lateObjectivesView, 'buildPalisade')?.text).toBe(
      'Melhore antes o Salão do Senhor para o nível 3.',
    );
  });

  it('a obra já em curso: não há botão, e a frase do servidor diz que é só esperar', () => {
    const building = withObjective(
      withQueues(unlockedView, [
        activeConstruction({ building: 'watchtower', label: 'Torre de Vigia', targetLevel: 1 }),
      ]),
      'buildWatchtower',
      { missing: 'A obra da Torre de Vigia já começou: o objetivo se cumpre quando ela terminar.' },
    );
    expect(actionOf(building, 'buildWatchtower')).toBeNull();
    expect(noteOf(building, 'buildWatchtower')).toEqual({
      ready: false,
      text: 'A obra da Torre de Vigia já começou: o objetivo se cumpre quando ela terminar.',
    });
  });

  it('o depósito: o botão é o do edifício que a visão aponta, o Celeiro ou o Armazém', () => {
    const granary = withObjective(
      withUpgrade(unlockedView, 'granary', { blockedReason: null }),
      'buildGranaryOrWarehouse',
      { missing: null },
    );
    expect(actionOf(granary, 'buildGranaryOrWarehouse')).toMatchObject({
      command: 'lords.build',
      arg: 'granary',
      label: 'Construir Celeiro',
    });
    const warehouse = withObjective(
      withUpgrade(unlockedView, 'warehouse', { blockedReason: null }),
      'buildGranaryOrWarehouse',
      { missing: null, target: { kind: 'building', building: 'warehouse' } },
    );
    expect(actionOf(warehouse, 'buildGranaryOrWarehouse')).toMatchObject({
      command: 'lords.build',
      arg: 'warehouse',
      label: 'Construir Armazém',
    });
  });

  it('recrutamento: abre o recrutamento; com gente a caminho que basta, não há o que ordenar', () => {
    expect(actionOf(initialView, 'recruitVillagers')).toEqual({
      command: 'lords.recruit',
      label: 'Recrutar aldeões',
      text: 'Recrutar',
    });
    const coming: ViewState = {
      ...withObjective(initialView, 'recruitVillagers', {
        missing: 'Os 3 aldeões que faltam já estão a caminho.',
      }),
      population: { ...initialView.population, inTraining: 3 },
    };
    expect(actionOf(coming, 'recruitVillagers')).toBeNull();
    // Dois a caminho e três por recrutar: ainda falta chamar um.
    const some: ViewState = {
      ...initialView,
      population: { ...initialView.population, inTraining: 2 },
    };
    expect(actionOf(some, 'recruitVillagers')).toMatchObject({ command: 'lords.recruit' });
  });

  it('a carta: sem carta na mesa, ver o Conselho; com carta, decidir', () => {
    expect(actionOf(unlockedView, 'answerFirstCard')).toEqual({
      command: 'lords.openPanel',
      arg: 'council',
      label: 'Ver o Conselho',
      text: 'Ver',
    });
    const waiting = withObjective(withCards(unlockedView, [mealCard]), 'answerFirstCard', {
      missing: null,
    });
    expect(actionOf(waiting, 'answerFirstCard')).toEqual({
      command: 'lords.openPanel',
      arg: 'council',
      label: 'Decidir no Conselho',
      text: 'Decidir',
    });
    expect(noteOf(waiting, 'answerFirstCard')).toEqual({
      ready: true,
      text: 'Só falta a sua ordem.',
    });
  });

  it('a obra marcada: planejar, ou ligar a marca de uma que já está na lista', () => {
    expect(actionOf(lateObjectivesView, 'planAutoStart')).toEqual({
      command: 'lords.planConstruction',
      label: 'Planejar obras',
      text: 'Planejar',
    });
    const planned = withPlanned(lateObjectivesView, [{ building: 'farm' }]);
    expect(actionOf(planned, 'planAutoStart')).toEqual({
      command: 'lords.toggleAutoStart',
      label: 'Ligar o início automático',
      text: 'Marcar',
    });
    expect(noteOf(lateObjectivesView, 'planAutoStart')).toEqual({
      ready: true,
      text: 'Só falta a sua ordem.',
    });
  });

  it('o inverno: nada a ordenar, só a frase do servidor', () => {
    expect(actionOf(lateObjectivesView, 'surviveWinterWithoutCold')).toBeNull();
    expect(noteOf(lateObjectivesView, 'surviveWinterWithoutCold')).toEqual({
      ready: false,
      text: 'Falta o Inverno chegar e passar sem frio.',
    });
  });

  it('o objetivo cumprido não tem botão nem o que falte', () => {
    expect(actionOf(unlockedView, 'allocateFarmers')).toBeNull();
    expect(noteOf(unlockedView, 'allocateFarmers')).toBeNull();
    expect(objectiveLines(unlockedView, objectiveOf(unlockedView, 'allocateFarmers'))).toEqual([
      'Comida é o que mantém todo o resto.',
      'Recompensa: +20 ouro.',
    ]);
  });
});

describe('objetivos: vários cumpridos de uma vez', () => {
  it('um só fica com a frase da Crônica: não há o que resumir', () => {
    expect(objectivesCompleted([completed(1, 'buildWatchtower')], autumnView)).toBeNull();
    expect(objectivesCompleted([gameEvent(1, 'constructionFinished')], autumnView)).toBeNull();
    expect(objectivesCompleted([], autumnView)).toBeNull();
  });

  it('dois ou mais: um título com a contagem e uma frase por objetivo, com a recompensa da visão', () => {
    const events = [
      gameEvent(1, 'buildingFounded'),
      completed(2, 'buildWatchtower'),
      completed(3, 'answerFirstCard'),
      gameEvent(4, 'dayStarted'),
      completed(5, 'buildPalisade'),
    ];
    expect(objectivesCompleted(events, autumnView)).toEqual({
      title: '3 objetivos cumpridos',
      lines: [
        'Construa a Torre de Vigia: +40 pedra',
        'Responda à primeira carta do Conselho: +10 de moral por 1 dia de jogo (2 h)',
        'Construa a Paliçada: +100 madeira',
      ],
    });
  });

  it('o objetivo que a visão não traz fica com a frase da Crônica, inteira', () => {
    const events = [
      completed(1, 'buildWatchtower'),
      completed(2, 'deOutraVersao', 'Cumpriu-se um objetivo que esta página não conhece.'),
    ];
    expect(objectivesCompleted(events, autumnView)?.lines).toEqual([
      'Construa a Torre de Vigia: +40 pedra',
      'Cumpriu-se um objetivo que esta página não conhece',
    ]);
    // Sem visão nenhuma, todos ficam com a frase que veio no evento.
    expect(objectivesCompleted(events, null)?.lines).toEqual([
      'Cumpriu-se buildWatchtower',
      'Cumpriu-se um objetivo que esta página não conhece',
    ]);
  });

  it('em uma frase só, para o Relatório de Retorno: o título e cada objetivo, com ponto', () => {
    const summary = objectivesCompleted(
      [completed(1, 'buildWatchtower'), completed(2, 'surviveWinterWithoutCold')],
      autumnView,
    );
    expect(summary === null ? null : objectivesCompletedSentence(summary)).toBe(
      '2 objetivos cumpridos. Construa a Torre de Vigia: +40 pedra. ' +
        'Atravesse o inverno sem passar frio: +15 de moral por 1 dia de jogo (2 h).',
    );
  });
});
