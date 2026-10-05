import type { ViewState } from '@lotg/protocol';
import { describe, expect, it } from 'vitest';

import type { AccountState } from '../account/accountService';
import {
  activeConstruction,
  autumnView,
  craftsView,
  initialView,
  palisadeRaisedView,
  queuesView,
  raidAftermathView,
  threatIncomingView,
  threatWatchedView,
  withPlanned,
  withQueues,
} from '../test-helpers';
import {
  DEFENSE_ICON,
  INJURED_ICON,
  palisadeRace,
  palisadeWork,
  RAID_ICON,
  THREAT_ICON,
  THREAT_UNKNOWN_ICON,
  threatIcon,
  threatLines,
  threatRising,
  threatRowWork,
  threatTreeLine,
  tileLine,
  type WatchedThreat,
  watchtowerWork,
  workPlanLine,
  workTerms,
} from './threat';
import { buildTree, type TreeNode } from './treeModel';

/** A Ameaça de uma visão com Torre; o teste falha se o golden deixar de trazê-la. */
function watched(view: ViewState): WatchedThreat {
  if (!view.threat.known) {
    throw new Error('O golden deixou de trazer a Ameaça à vista.');
  }
  return view.threat;
}

/** A mesma visão com campos da Ameaça à vista trocados. */
const withThreat = (view: ViewState, patch: Partial<WatchedThreat>): ViewState => ({
  ...view,
  threat: { ...watched(view), ...patch },
});

/** O feudo sem Torre com a obra dela em uma fila: a névoa continua até a obra terminar. */
const towerUnderway = withQueues(initialView, [
  activeConstruction({
    building: 'watchtower',
    label: 'Torre de Vigia',
    targetLevel: 1,
    secondsRemaining: 500,
    totalSeconds: 720,
  }),
]);

describe('Ameaça: o ícone diz se há quem veja', () => {
  it('o olho aberto com a Torre, o fechado sem ela', () => {
    expect(threatIcon(initialView.threat)).toBe(THREAT_UNKNOWN_ICON);
    expect(threatIcon(threatWatchedView.threat)).toBe(THREAT_ICON);
    expect([THREAT_ICON, THREAT_UNKNOWN_ICON]).toEqual(['eye', 'eye-closed']);
  });

  it('nenhum ícone da Ameaça é o da fome, o do frio ou o do Conselho', () => {
    const icons = [THREAT_ICON, THREAT_UNKNOWN_ICON, RAID_ICON, DEFENSE_ICON, INJURED_ICON];
    expect(new Set(icons).size).toBe(icons.length);
    for (const taken of ['warning', 'flame', 'law']) {
      expect(icons).not.toContain(taken);
    }
  });
});

describe('a obra da Torre, pelo que a visão diz das construções', () => {
  it('sem Torre: a obra está na lista, com o custo e o que a impede', () => {
    const work = watchtowerWork(initialView);
    expect(work).toMatchObject({
      kind: 'available',
      plan: null,
      upgrade: {
        building: 'watchtower',
        fromLevel: 0,
        blockedReason: 'Melhore antes o Salão do Senhor para o nível 2.',
      },
    });
    if (work.kind === 'available') {
      // O custo e o prazo são os da visão: o app não conhece nenhum dos dois.
      expect(workTerms(work.upgrade)).toBe('120 madeira, 120 pedra, 50 ouro · 12 min');
    }
  });

  it('com a Torre no nível 1, a obra é a melhoria para o nível 2', () => {
    const work = watchtowerWork(threatWatchedView);
    expect(work).toMatchObject({ kind: 'available', upgrade: { fromLevel: 1, targetLevel: 2 } });
    if (work.kind === 'available') {
      // No ritmo Rápido o prazo já vem em tempo real.
      expect(workTerms(work.upgrade)).toBe('192 madeira, 192 pedra, 80 ouro · 6 min');
    }
  });

  it('em obras, quem fala é a fila, e a obra sai da lista', () => {
    expect(watchtowerWork(towerUnderway)).toMatchObject({
      kind: 'underway',
      queue: { building: 'watchtower', targetLevel: 1, secondsRemaining: 500 },
    });
    // A segunda fila também conta.
    const second = withQueues(queuesView, [
      activeConstruction(),
      activeConstruction({ building: 'watchtower', label: 'Torre de Vigia', targetLevel: 1 }),
    ]);
    expect(watchtowerWork(second).kind).toBe('underway');
  });

  it('no teto desta versão não há obra a ordenar', () => {
    expect(watchtowerWork(threatIncomingView)).toEqual({ kind: 'none' });
  });

  it('planejada, a obra continua na lista e a espera vem do servidor', () => {
    const planned = withPlanned(initialView, [
      {
        building: 'watchtower',
        autoStart: true,
        waiting: { reason: 'resources', text: 'espera 55 de pedra', etaSeconds: 4500 },
      },
    ]);
    const work = watchtowerWork(planned);
    expect(work).toMatchObject({ kind: 'available', plan: { autoStart: true } });
    if (work.kind === 'available' && work.plan !== null) {
      expect(workPlanLine(work.plan, 0)).toBe(
        'Planejada, com início automático · espera 55 de pedra: em 1 h 15 min.',
      );
      // O prazo desce com o relógio da página.
      expect(workPlanLine(work.plan, 900)).toBe(
        'Planejada, com início automático · espera 55 de pedra: em 1 h.',
      );
      expect(workPlanLine({ ...work.plan, autoStart: false, waiting: null }, 0)).toBe(
        'Planejada · pode começar agora.',
      );
    }
  });
});

describe('a obra da Paliçada, pelo que a visão diz das construções (GDD §8.2)', () => {
  /** O Salão no nível 3 e a Paliçada em obras, em uma das filas. */
  const fenceUnderway = withQueues(craftsView, [
    activeConstruction({
      building: 'palisade',
      label: 'Paliçada',
      targetLevel: 1,
      secondsRemaining: 300,
      totalSeconds: 1200,
    }),
  ]);

  it('antes do Salão Nv3 a obra está na lista, travada, com o motivo do servidor', () => {
    const work = palisadeWork(initialView);
    expect(work).toMatchObject({
      kind: 'available',
      plan: null,
      upgrade: {
        building: 'palisade',
        fromLevel: 0,
        blockedReason: 'Melhore antes o Salão do Senhor para o nível 3.',
      },
    });
    if (work.kind === 'available') {
      expect(workTerms(work.upgrade)).toBe('200 madeira, 50 pedra · 20 min');
    }
  });

  it('com o Salão no nível 3 a obra se oferece; erguida, é a melhoria para o nível 2', () => {
    expect(palisadeWork(craftsView)).toMatchObject({
      kind: 'available',
      upgrade: { fromLevel: 0, targetLevel: 1, blockedReason: null },
    });
    const raised = palisadeWork(palisadeRaisedView);
    expect(raised).toMatchObject({
      kind: 'available',
      upgrade: { fromLevel: 1, targetLevel: 2, blockedReason: null },
    });
    if (raised.kind === 'available') {
      expect(workTerms(raised.upgrade)).toBe('320 madeira, 80 pedra · 10 min');
    }
  });

  it('em obras, quem fala é a fila; no teto desta versão não há obra a ordenar', () => {
    expect(palisadeWork(fenceUnderway)).toMatchObject({
      kind: 'underway',
      queue: { building: 'palisade', targetLevel: 1, secondsRemaining: 300 },
    });
    const ceiling: ViewState = {
      ...palisadeRaisedView,
      constructions: {
        ...palisadeRaisedView.constructions,
        available: palisadeRaisedView.constructions.available.filter(
          (upgrade) => upgrade.building !== 'palisade',
        ),
      },
    };
    expect(palisadeWork(ceiling)).toEqual({ kind: 'none' });
  });

  it('com um ataque à vista, o prazo da obra fica ao lado do prazo dele; quem diz se dá tempo é o servidor', () => {
    const work = palisadeWork(palisadeRaisedView);
    if (work.kind !== 'available') {
      throw new Error('O golden deixou de trazer a obra da Paliçada.');
    }
    expect(palisadeRace(palisadeRaisedView, work.upgrade, 0)).toBe(
      'A obra leva 10 min; o ataque chega em 16 min.',
    );
    // O prazo do ataque desce com o relógio da página; o da obra é o que ela leva.
    expect(palisadeRace(palisadeRaisedView, work.upgrade, 400)).toBe(
      'A obra leva 10 min; o ataque chega em 9 min.',
    );
    // O painel escreve o prazo do ataque como contagem regressiva.
    expect(palisadeRace(palisadeRaisedView, work.upgrade, 0, (seconds) => `${seconds} s`)).toBe(
      'A obra leva 10 min; o ataque chega em 940 s.',
    );
    // Sem incursão à vista não há corrida a mostrar.
    expect(palisadeRace(threatWatchedView, work.upgrade, 0)).toBeNull();
    expect(palisadeRace(craftsView, work.upgrade, 0)).toBeNull();
  });

  describe('a obra que o botão da linha "Ameaça" ordena', () => {
    it('sem a Torre, a Torre: é a saída da névoa', () => {
      // O Salão no nível 3 libera as duas; a Torre passa na frente.
      expect(palisadeWork(craftsView)).toMatchObject({ upgrade: { blockedReason: null } });
      expect(threatRowWork(craftsView)?.building).toBe('watchtower');
    });

    it('com a Torre, a Paliçada, quando a obra dela pode começar', () => {
      expect(threatRowWork(palisadeRaisedView)).toMatchObject({
        building: 'palisade',
        targetLevel: 2,
      });
      // Antes do Salão Nv3 a obra está travada: a linha não oferece nada.
      expect(threatRowWork(threatWatchedView)).toBeNull();
      expect(threatRowWork(raidAftermathView)).toBeNull();
    });

    it('sem a Torre e com a obra dela travada, a Paliçada, se puder começar', () => {
      // Com o Salão no nível 3 e sem os recursos da Torre, a defesa é o que há a ordenar.
      const towerShort: ViewState = {
        ...craftsView,
        constructions: {
          ...craftsView.constructions,
          available: craftsView.constructions.available.map((upgrade) =>
            upgrade.building === 'watchtower'
              ? { ...upgrade, blockedReason: 'Faltam 50 ouro.' }
              : upgrade,
          ),
        },
      };
      expect(threatRowWork(towerShort)?.building).toBe('palisade');
      // Com as duas travadas, nada.
      expect(threatRowWork(initialView)).toBeNull();
      expect(threatRowWork(autumnView)).toBeNull();
    });

    it('com a Torre em obras e a Paliçada travada, a linha não tem o que ordenar', () => {
      expect(threatRowWork(towerUnderway)).toBeNull();
    });
  });
});

describe('a linha "Ameaça" da árvore (GDD §13.2)', () => {
  it('com a Torre: o número e os tiles ativos', () => {
    expect(threatTreeLine(threatWatchedView, 0)).toBe('46 · Covil de Lobos');
  });

  it('sem tile ativo, só o número; com dois, os dois', () => {
    const [den] = watched(threatWatchedView).tiles;
    if (den === undefined) {
      throw new Error('O golden deixou de trazer o Covil de Lobos.');
    }
    expect(threatTreeLine(withThreat(threatWatchedView, { tiles: [] }), 0)).toBe('46');
    expect(
      threatTreeLine(withThreat(threatWatchedView, { tiles: [{ ...den, active: false }] }), 0),
    ).toBe('46');
    expect(
      threatTreeLine(
        withThreat(threatWatchedView, {
          tiles: [den, { id: 'camp', label: 'Acampamento', active: true }],
        }),
        0,
      ),
    ).toBe('46 · Covil de Lobos, Acampamento');
  });

  it('com uma incursão à vista, o aviso toma o lugar dos tiles, com sinal e texto', () => {
    expect(threatTreeLine(threatIncomingView, 0)).toBe('46 · ⚠ Lobos em 16 min');
    // O prazo desconta o tempo desde a leitura.
    expect(threatTreeLine(threatIncomingView, 600)).toBe('46 · ⚠ Lobos em 6 min');
  });

  it('sem a Torre não há número: a linha diz que ninguém sabe, e o que falta', () => {
    expect(threatTreeLine(initialView, 0)).toBe('desconhecida · sem Torre de Vigia');
    expect(threatTreeLine(towerUnderway, 0)).toBe('desconhecida · Torre de Vigia em obras');
    // Se a lista de obras não trouxer a Torre, a linha não inventa o nome dela.
    const bare: ViewState = {
      ...initialView,
      constructions: {
        ...initialView.constructions,
        available: initialView.constructions.available.filter(
          (upgrade) => upgrade.building !== 'watchtower',
        ),
      },
    };
    expect(threatTreeLine(bare, 0)).toBe('desconhecida');
  });
});

describe('a explicação da Ameaça, frase a frase', () => {
  it('sem a Torre: a névoa, o que a Torre daria, o custo com o que a impede, a defesa e a obra dela', () => {
    expect(threatLines(initialView, 0)).toEqual([
      'Sem uma Torre de Vigia, ninguém sabe o que ronda o feudo.',
      'Torre de Vigia Nv1: mostra a Ameaça com a explicação e avisa de uma incursão com 1 h de antecedência.',
      '120 madeira, 120 pedra, 50 ouro · 12 min. Melhore antes o Salão do Senhor para o nível 2.',
      'Sem Paliçada, nada segura um ataque.',
      'Paliçada Nv1: segura ataques leves, sem perda nem ferido; os médios passam, mas com metade do estrago.',
      '200 madeira, 50 pedra · 20 min. Melhore antes o Salão do Senhor para o nível 3.',
    ]);
    // Com as obras liberadas, só o custo e o prazo.
    expect(threatLines(craftsView, 0)[2]).toBe('120 madeira, 120 pedra, 50 ouro · 12 min.');
    expect(threatLines(craftsView, 0).at(-1)).toBe('200 madeira, 50 pedra · 20 min.');
  });

  it('sem a Torre, nenhuma frase traz número de Ameaça, origem, tile, chance ou estrago', () => {
    const text = threatLines(initialView, 0).join(' ');
    expect(text).not.toMatch(/Ameaça \d/);
    expect(text).not.toContain('Covil');
    expect(text).not.toContain('/dia');
    expect(text).not.toContain('%');
    expect(text).not.toContain('chance');
  });

  it('com a Torre em obras, a explicação diz quando ela fica pronta', () => {
    expect(threatLines(towerUnderway, 0)[2]).toBe(
      'Torre de Vigia → Nv1 em obras: termina em 00:09.',
    );
    expect(threatLines(towerUnderway, 240)[2]).toBe(
      'Torre de Vigia → Nv1 em obras: termina em 00:05.',
    );
  });

  it('com a Torre: o número, a tendência, as origens, a chance e o custo de um ataque, a defesa e a Torre', () => {
    const threat = watched(threatWatchedView);
    expect(threatLines(threatWatchedView, 0)).toEqual([
      'Ameaça 46 de 100.',
      'Sobe 5 a cada dia de jogo (40 min): na próxima virada, vai de 46 para 51. Faltam 36 min.',
      '+2/dia: Covil de Lobos',
      '+3/dia: outono',
      // A regra das incursões e o que cada tamanho custa: as frases do servidor, como vieram.
      threat.raidRisk,
      ...threat.raidCosts,
      'Sem Paliçada, nada segura um ataque.',
      'Paliçada Nv1: segura ataques leves, sem perda nem ferido; os médios passam, mas com metade do estrago.',
      '200 madeira, 50 pedra · 6 min 40 s. Melhore antes o Salão do Senhor para o nível 3.',
      'Torre de Vigia Nv1: mostra a Ameaça com a explicação e avisa de uma incursão com 1 h de antecedência.',
      'Torre de Vigia Nv2: avisa com 2 h de antecedência (em vez de 1 h) e passa a dizer o tamanho da incursão.',
      '192 madeira, 192 pedra, 80 ouro · 6 min.',
    ]);
    expect(threat.raidRisk).toContain('11% de chance');
    expect(threat.raidCosts).toHaveLength(3);
  });

  it('com uma incursão à vista: o aviso com o prazo, o que ela custa e o que a Paliçada faz a ela', () => {
    const lines = threatLines(threatIncomingView, 0);
    const at = lines.indexOf(
      'Lobos a caminho. Os vigias contam uma matilha grande. Chegada em 16 min.',
    );
    expect(at).toBeGreaterThan(-1);
    expect(lines.slice(at + 1, at + 3)).toEqual([
      'Sem defesa, uma matilha grande leva 15% do estoque de comida e madeira (hoje, 75 de comida e 65,9 de madeira) e fere 2 aldeões, que ficam 40 min sem trabalhar.',
      'Sem Paliçada, nada segura este ataque.',
    ]);
    // O custo deste ataque toma o lugar da lista do que cada tamanho custa.
    expect(lines.join(' ')).not.toContain('Ataques leves');
    // A Torre no teto não tem obra; a frase dela fecha a explicação.
    expect(lines.at(-1)).toMatch(/Os níveis seguintes chegam em versões futuras do jogo\.$/);
    expect(lines.join(' ')).not.toContain('ouro');
    // Com a Paliçada no nível 1, a frase é a do que ela faz a este ataque, e a obra é a do nível 2.
    const raised = threatLines(palisadeRaisedView, 0);
    expect(raised).toContain(
      'A Paliçada Nv1 não segura um ataque deste tamanho: ele passa, mas com metade do estrago.',
    );
    expect(raised).toContain(
      'Paliçada Nv2: passa a segurar também os ataques médios, sem perda nem ferido.',
    );
    expect(raised).toContain('320 madeira, 80 pedra · 10 min.');
  });

  it('no máximo a Ameaça não sobe: a frase do servidor basta, sem prazo', () => {
    const top = withThreat(threatWatchedView, {
      level: 100,
      nextLevel: 100,
      risePerDay: 0,
      text: 'Ameaça 100 de 100.',
      trend: 'Está no máximo: não sobe mais.',
      sources: [],
    });
    expect(threatRising(watched(top))).toBe(false);
    expect(threatRising(watched(threatWatchedView))).toBe(true);
    expect(threatLines(top, 0).slice(0, 2)).toEqual([
      'Ameaça 100 de 100.',
      'Está no máximo: não sobe mais.',
    ]);
  });

  it('um tile diz o nome e se está ativo, por extenso', () => {
    expect(tileLine({ id: 'wolfDen', label: 'Covil de Lobos', active: true })).toBe(
      'Covil de Lobos (ativo)',
    );
    expect(tileLine({ id: 'wolfDen', label: 'Covil de Lobos', active: false })).toBe(
      'Covil de Lobos (inativo)',
    );
  });
});

describe('a Ameaça na árvore', () => {
  const account: AccountState = {
    kind: 'anonymous',
    accountId: 'conta-1',
    displayName: 'Gustavo',
    hasRecoveryCode: false,
    gameId: 'partida-1',
  };
  const node = (view: ViewState, elapsedSeconds = 0): TreeNode => {
    const fief = buildTree({
      view,
      account,
      connection: { kind: 'online' },
      chronicle: [],
      unseen: 0,
      elapsedSeconds,
    })[1];
    const found = fief?.children?.find((child) => child.id === 'threat');
    if (found === undefined) {
      throw new Error('A árvore deixou de ter a linha da Ameaça.');
    }
    return found;
  };

  it('com a Torre: o número, os tiles, o olho aberto e a explicação do painel', () => {
    expect(node(threatWatchedView)).toEqual({
      id: 'threat',
      label: 'Ameaça',
      description: '46 · Covil de Lobos',
      tooltip: threatLines(threatWatchedView, 0).join('\n'),
      icon: 'eye',
      // O clique só navega. Com a Paliçada ainda travada não há ordem na linha, e a melhoria
      // da Torre fica em "Construções".
      command: { id: 'lords.openPanel', args: ['fief'] },
    });
    expect(node(threatIncomingView).description).toBe('46 · ⚠ Lobos em 16 min');
  });

  it('sem a Torre e com a obra travada: a névoa, o motivo na explicação e nenhum botão', () => {
    const blocked = node(initialView);
    expect(blocked).toMatchObject({
      label: 'Ameaça',
      description: 'desconhecida · sem Torre de Vigia',
      icon: 'eye-closed',
      command: { id: 'lords.openPanel', args: ['fief'] },
    });
    expect(blocked.tooltip).toContain('Melhore antes o Salão do Senhor para o nível 2.');
    expect(blocked.contextValue).toBeUndefined();
    expect(blocked.actionLabels).toBeUndefined();
  });

  it('sem a Torre e com a obra liberada: a linha ganha o botão que a ergue, com o custo na dica', () => {
    expect(node(craftsView)).toMatchObject({
      description: 'desconhecida · sem Torre de Vigia',
      contextValue: 'lords.threatBuild',
      actionLabels: { 'lords.build': 'Construir: Torre de Vigia' },
      actionHints: { 'lords.build': '120 madeira, 120 pedra, 50 ouro · 12 min' },
      // O clique na linha continua só navegando.
      command: { id: 'lords.openPanel', args: ['fief'] },
    });
  });

  it('com a Torre e a obra da Paliçada liberada: o botão da linha ordena a defesa, com o custo na dica', () => {
    expect(node(palisadeRaisedView)).toMatchObject({
      description: '46 · ⚠ Lobos em 16 min',
      icon: 'eye',
      contextValue: 'lords.threatUpgrade',
      actionLabels: { 'lords.build': 'Melhorar: Paliçada Nv1 → Nv2' },
      actionHints: { 'lords.build': '320 madeira, 80 pedra · 10 min' },
      command: { id: 'lords.openPanel', args: ['fief'] },
    });
    // A Paliçada que ainda não existe: "Construir: Paliçada".
    const fresh: ViewState = {
      ...threatWatchedView,
      constructions: {
        ...threatWatchedView.constructions,
        available: threatWatchedView.constructions.available.map((upgrade) =>
          upgrade.building === 'palisade'
            ? { ...upgrade, blockedCode: null, blockedReason: null }
            : upgrade,
        ),
      },
    };
    expect(node(fresh)).toMatchObject({
      contextValue: 'lords.threatBuild',
      actionLabels: { 'lords.build': 'Construir: Paliçada' },
      actionHints: { 'lords.build': '200 madeira, 50 pedra · 6 min 40 s' },
    });
  });

  it('com a Torre em obras não há o que ordenar: a linha diz que ela vem', () => {
    const underway = node(towerUnderway);
    expect(underway.description).toBe('desconhecida · Torre de Vigia em obras');
    expect(underway.contextValue).toBeUndefined();
  });

  it('a linha fica depois da Moral e antes da Lareira', () => {
    const tree = buildTree({
      view: initialView,
      account,
      connection: { kind: 'online' },
      chronicle: [],
      unseen: 0,
      elapsedSeconds: 0,
    });
    const ids = tree[1]?.children?.map((child) => child.id) ?? [];
    expect(ids.indexOf('threat')).toBe(ids.indexOf('morale') + 1);
  });
});
