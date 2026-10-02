import type { ViewState } from '@lotg/protocol';
import { describe, expect, it } from 'vitest';

import type { AccountState } from '../account/accountService';
import {
  activeConstruction,
  craftsView,
  initialView,
  queuesView,
  threatIncomingView,
  threatWatchedView,
  withPlanned,
  withQueues,
} from '../test-helpers';
import {
  DEFENSE_ICON,
  RAID_ICON,
  THREAT_ICON,
  THREAT_UNKNOWN_ICON,
  threatIcon,
  threatLines,
  threatRising,
  threatTreeLine,
  tileLine,
  type WatchedThreat,
  watchtowerPlanLine,
  watchtowerTerms,
  watchtowerWork,
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
    const icons = [THREAT_ICON, THREAT_UNKNOWN_ICON, RAID_ICON, DEFENSE_ICON];
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
      expect(watchtowerTerms(work.upgrade)).toBe('120 madeira, 120 pedra, 50 ouro · 12 min');
    }
  });

  it('com a Torre no nível 1, a obra é a melhoria para o nível 2', () => {
    const work = watchtowerWork(threatWatchedView);
    expect(work).toMatchObject({ kind: 'available', upgrade: { fromLevel: 1, targetLevel: 2 } });
    if (work.kind === 'available') {
      // No ritmo Rápido o prazo já vem em tempo real.
      expect(watchtowerTerms(work.upgrade)).toBe('192 madeira, 192 pedra, 80 ouro · 6 min');
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
      expect(watchtowerPlanLine(work.plan, 0)).toBe(
        'Planejada, com início automático · espera 55 de pedra: em 1 h 15 min.',
      );
      // O prazo desce com o relógio da página.
      expect(watchtowerPlanLine(work.plan, 900)).toBe(
        'Planejada, com início automático · espera 55 de pedra: em 1 h.',
      );
      expect(watchtowerPlanLine({ ...work.plan, autoStart: false, waiting: null }, 0)).toBe(
        'Planejada · pode começar agora.',
      );
    }
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
  it('sem a Torre: a névoa, o que a Torre daria, o custo com o que a impede e a defesa', () => {
    expect(threatLines(initialView, 0)).toEqual([
      'Sem uma Torre de Vigia, ninguém sabe o que ronda o feudo.',
      'Torre de Vigia Nv1: mostra a Ameaça com a explicação e avisa de uma incursão com 1 h de antecedência.',
      '120 madeira, 120 pedra, 50 ouro · 12 min. Melhore antes o Salão do Senhor para o nível 2.',
      'Sem Paliçada, nada segura um ataque.',
    ]);
    // Com a obra liberada, só o custo e o prazo.
    expect(threatLines(craftsView, 0)[2]).toBe('120 madeira, 120 pedra, 50 ouro · 12 min.');
  });

  it('sem a Torre, nenhuma frase traz número de Ameaça, origem ou tile', () => {
    const text = threatLines(initialView, 0).join(' ');
    expect(text).not.toMatch(/Ameaça \d/);
    expect(text).not.toContain('Covil');
    expect(text).not.toContain('/dia');
  });

  it('com a Torre em obras, a explicação diz quando ela fica pronta', () => {
    expect(threatLines(towerUnderway, 0)[2]).toBe(
      'Torre de Vigia → Nv1 em obras: termina em 00:09.',
    );
    expect(threatLines(towerUnderway, 240)[2]).toBe(
      'Torre de Vigia → Nv1 em obras: termina em 00:05.',
    );
  });

  it('com a Torre: o número, a tendência com o prazo, as origens, a Torre e a defesa', () => {
    expect(threatLines(threatWatchedView, 0)).toEqual([
      'Ameaça 46 de 100.',
      'Sobe 8 a cada dia de jogo (40 min): na próxima virada, vai de 46 para 54. Faltam 36 min.',
      '+5/dia: Covil de Lobos',
      '+3/dia: outono',
      'Torre de Vigia Nv1: mostra a Ameaça com a explicação e avisa de uma incursão com 20 min de antecedência.',
      'Torre de Vigia Nv2: avisa com 40 min de antecedência (em vez de 20 min) e passa a dizer o tamanho da incursão.',
      '192 madeira, 192 pedra, 80 ouro · 6 min.',
      'Sem Paliçada, nada segura um ataque.',
    ]);
  });

  it('com uma incursão à vista, o aviso dos vigias entra com o prazo; no teto, não há obra', () => {
    const lines = threatLines(threatIncomingView, 0);
    expect(lines).toContain(
      'Lobos a caminho. Os vigias contam uma matilha grande. Chegada em 16 min.',
    );
    expect(lines.at(-2)).toMatch(/Os níveis seguintes chegam em versões futuras do jogo\.$/);
    expect(lines.at(-1)).toBe('Sem Paliçada, nada segura um ataque.');
    expect(lines.join(' ')).not.toContain('madeira');
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
      // O clique só navega, e não há ordem na linha: a melhoria da Torre fica em "Construções".
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
      contextValue: 'lords.threatUnwatched',
      actionLabels: { 'lords.build': 'Construir: Torre de Vigia' },
      actionHints: { 'lords.build': '120 madeira, 120 pedra, 50 ouro · 12 min' },
      // O clique na linha continua só navegando.
      command: { id: 'lords.openPanel', args: ['fief'] },
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
