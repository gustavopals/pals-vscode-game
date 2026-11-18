import type { ViewState } from '@lotg/protocol';
import type { ComponentChild } from 'preact';
import { renderToString } from 'preact-render-to-string';
import { afterEach, describe, expect, it } from 'vitest';

import type { Controller } from '../app/controller';
import { guildDeadlines } from '../game/gameSession';
import { intentOf } from '../game/intent';
import { buildReturnReport } from '../game/returnReport';
import { bindCommands, type CommandEnv, createCommands, relicRequest } from '../palette/commands';
import { GuildTab } from '../tabs/Guild';
import {
  gameEvent,
  goldenView,
  initialView,
  makeController,
  scriptedDialogs,
  settle,
} from '../test-helpers';
import { buildTree, type TreeNode } from '../ui/treeModel';
import { rowActions } from '../workbench/Tree';
import type { Actions } from './actions';
import { RelicsPanel } from './RelicsPanel';

const noop = () => {};
const actions: Actions = { order: noop, run: noop, playNow: noop };
const NONE: ReadonlySet<string> = new Set();
const html = (node: ComponentChild) => renderToString(<>{node}</>);

type RelicItem = ViewState['relics']['items'][number];

function makeRelic(overrides: Partial<RelicItem> = {}): RelicItem {
  return {
    relicId: 'oakHeart',
    label: 'Coração do Carvalho',
    effectText: '+10% de produção de comida e madeira no feudo.',
    placed: false,
    active: false,
    effectiveInSeconds: null,
    effectiveText: null,
    canPlace: true,
    canRemove: false,
    blockedCode: null,
    blockedReason: null,
    ...overrides,
  };
}

function withRelics(view: ViewState, slots: number, items: RelicItem[]): ViewState {
  return {
    ...view,
    relics: { slots, items },
  };
}

function findNode(nodes: readonly TreeNode[], id: string): TreeNode | undefined {
  for (const node of nodes) {
    if (node.id === id) {
      return node;
    }
    if (node.children !== undefined) {
      const found = findNode(node.children, id);
      if (found !== undefined) {
        return found;
      }
    }
  }
  return undefined;
}

const controllers: Controller[] = [];
afterEach(() => {
  for (const controller of controllers.splice(0)) {
    controller.dispose();
  }
});

describe('RelicsPanel e integração da Capela (V5B-T4)', () => {
  it('sem Capela, mostra 0/0 espaços e a linha curta do que falta vinda da visão (preact-render-to-string)', () => {
    const blockedRelic = makeRelic({
      canPlace: false,
      blockedCode: 'CHAPEL_REQUIRED',
      blockedReason: 'Erga a Capela para colocar uma relíquia.',
    });
    const view = withRelics(initialView, 0, [blockedRelic]);
    const chapelUpgrade = view.constructions.available.find((entry) => entry.building === 'chapel');

    const rendered = html(
      <RelicsPanel view={view} elapsed={0} disabled={false} busy={NONE} actions={actions} />,
    );

    expect(rendered).toContain('Capela e relíquias');
    expect(rendered).toContain('0/0');
    if (chapelUpgrade?.blockedReason != null) {
      expect(rendered).toContain(chapelUpgrade.blockedReason);
    }
    expect(rendered).toContain(blockedRelic.label);
    expect(rendered).toContain(blockedRelic.effectText);
    expect(rendered).toContain(blockedRelic.blockedReason!);
  });

  it('mostra espaços usados/totais, "vale a partir de…", ativa, bloqueio de espaço e botões Colocar/Retirar', () => {
    const pendingOak = makeRelic({
      placed: true,
      active: false,
      effectiveInSeconds: 1200,
      effectiveText: 'Vale a partir da próxima virada de dia de jogo: em 20 min.',
      canPlace: false,
      canRemove: true,
      blockedCode: 'RELIC_ALREADY_PLACED',
      blockedReason: 'Essa relíquia já está colocada na Capela.',
    });
    const blockedWolf = makeRelic({
      relicId: 'wolfBone',
      label: 'Osso do Lobo Branco',
      effectText: '+10% de poder da equipe nas expedições.',
      placed: false,
      active: false,
      canPlace: false,
      canRemove: false,
      blockedCode: 'NO_RELIC_SLOT',
      blockedReason: 'A Capela está sem espaço. Retire uma relíquia ou melhore a Capela.',
    });
    const view = withRelics(initialView, 1, [pendingOak, blockedWolf]);

    const rendered = html(
      <RelicsPanel view={view} elapsed={0} disabled={false} busy={NONE} actions={actions} />,
    );

    expect(rendered).toContain('1/1');
    expect(rendered).toContain(pendingOak.effectiveText!);
    expect(rendered).toContain(blockedWolf.blockedReason!);

    // Desconta o tempo corrido localmente no prazo "Vale a partir de…"
    const elapsedHtml = html(
      <RelicsPanel view={view} elapsed={600} disabled={false} busy={NONE} actions={actions} />,
    );
    expect(elapsedHtml).toContain('Vale a partir da próxima virada de dia de jogo: em 10 min.');

    // Na virada do dia, a relíquia passa a ativa ("Já está em vigor.") e aparece na GuildTab
    const activeOak = makeRelic({
      placed: true,
      active: true,
      effectiveInSeconds: 0,
      effectiveText: 'Já está em vigor.',
      canPlace: false,
      canRemove: true,
      blockedCode: 'RELIC_ALREADY_PLACED',
      blockedReason: 'Essa relíquia já está colocada na Capela.',
    });
    const availableWolf = makeRelic({
      relicId: 'wolfBone',
      label: 'Osso do Lobo Branco',
      effectText: '+10% de poder da equipe nas expedições.',
      canPlace: true,
      canRemove: false,
    });
    const activeView = withRelics(initialView, 2, [activeOak, availableWolf]);

    const guildHtml = html(
      <GuildTab
        view={activeView}
        elapsed={0}
        online={true}
        retryInSeconds={null}
        busy={NONE}
        actions={actions}
      />,
    );
    expect(guildHtml).toContain('1/2');
    expect(guildHtml).toContain('1</strong> ativa');
    expect(guildHtml).toContain(activeOak.effectiveText!);
  });

  it('árvore do explorador expõe a Capela e rowActions Colocar e Retirar para cada relíquia', () => {
    const emptyTree = buildTree({
      account: {
        kind: 'anonymous',
        accountId: 'acc-1',
        displayName: 'Lorde',
        hasRecoveryCode: false,
        gameId: 'game-1',
      },
      view: goldenView,
      connection: { kind: 'online' },
      chronicle: [],
      elapsedSeconds: 0,
      unseen: 0,
    });
    expect(findNode(emptyTree, 'chapel')).toBeUndefined();

    const activeOak = makeRelic({
      placed: true,
      active: true,
      effectiveInSeconds: 0,
      effectiveText: 'Já está em vigor.',
      canPlace: false,
      canRemove: true,
      blockedCode: 'RELIC_ALREADY_PLACED',
      blockedReason: 'Essa relíquia já está colocada na Capela.',
    });
    const availableWolf = makeRelic({
      relicId: 'wolfBone',
      label: 'Osso do Lobo Branco',
      effectText: '+10% de poder da equipe nas expedições.',
      canPlace: true,
      canRemove: false,
    });
    const view = withRelics(initialView, 2, [activeOak, availableWolf]);
    const tree = buildTree({
      account: {
        kind: 'anonymous',
        accountId: 'acc-1',
        displayName: 'Lorde',
        hasRecoveryCode: false,
        gameId: 'game-1',
      },
      view,
      connection: { kind: 'online' },
      chronicle: [],
      elapsedSeconds: 0,
      unseen: 0,
    });

    const chapel = findNode(tree, 'chapel');
    expect(chapel).toBeDefined();
    expect(chapel?.description).toBe('1/2 espaços · 1 ativa');

    const oakNode = findNode(tree, 'relic:oakHeart')!;
    expect(oakNode.contextValue).toBe('lords.relicPlaced');
    expect(rowActions(oakNode)).toEqual([
      {
        label: `Retirar ${oakNode.label} da Capela`,
        text: 'Retirar',
        command: 'lords.removeRelic',
      },
    ]);

    const wolfNode = findNode(tree, 'relic:wolfBone')!;
    expect(wolfNode.contextValue).toBe('lords.relicAvailable');
    expect(rowActions(wolfNode)).toEqual([
      {
        label: `Colocar ${wolfNode.label} na Capela`,
        text: 'Colocar',
        command: 'lords.placeRelic',
      },
    ]);
  });

  it('comandos lords.placeRelic e lords.removeRelic compartilham intenção, trava relic:<id> e releem a visão após diálogo', async () => {
    expect(intentOf('placeRelic', { relicId: 'oakHeart' })).toBe('relic:oakHeart');
    expect(intentOf('removeRelic', { relicId: 'oakHeart' })).toBe('relic:oakHeart');
    expect(relicRequest({ relicId: 'oakHeart' })).toBe('oakHeart');
    expect(relicRequest({ id: 'relic:wolfBone' })).toBe('wolfBone');

    const oak = makeRelic();
    const unplacedView = withRelics(initialView, 1, [oak]);
    const placedView = withRelics(initialView, 1, [
      makeRelic({
        placed: true,
        active: false,
        effectiveInSeconds: 1200,
        effectiveText: 'Vale a partir da próxima virada de dia de jogo: em 20 min.',
        canPlace: false,
        canRemove: true,
        blockedCode: 'RELIC_ALREADY_PLACED',
        blockedReason: 'Essa relíquia já está colocada na Capela.',
      }),
    ]);

    const made = makeController({ signedIn: true });
    controllers.push(made.controller);
    made.api.state.view = unplacedView;
    const scripted = scriptedDialogs();
    const env: CommandEnv = {
      download: () => {},
      reload: () => {},
      sleep: async () => {},
      currentTheme: () => 'dark',
      openPalette: () => {},
      reveal: () => {},
    };
    const commands = createCommands(made.controller, scripted.dialogs, env);
    bindCommands(made.controller, commands);
    await made.controller.start();
    await settle(made.controller);

    // Pela paleta: abre dialogs.pick, escolhe a relíquia e envia placeRelic
    scripted.answers.push(0);
    await commands.find((command) => command.id === 'lords.placeRelic')?.run();
    await settle(made.controller);

    expect(
      made.api.state.commands.map((command) => ({
        type: command.type,
        payload: command.payload,
      })),
    ).toEqual([{ type: 'placeRelic', payload: { relicId: 'oakHeart' } }]);

    // Pela árvore / painel direto com relicId: envia removeRelic sem abrir diálogo
    made.api.state.view = placedView;
    made.api.state.stateVersion += 1;
    await made.controller.session.syncNow();
    await commands
      .find((command) => command.id === 'lords.removeRelic')
      ?.run({ relicId: 'oakHeart' });
    await settle(made.controller);

    expect(
      made.api.state.commands.map((command) => ({
        type: command.type,
        payload: command.payload,
      })),
    ).toEqual([
      { type: 'placeRelic', payload: { relicId: 'oakHeart' } },
      { type: 'removeRelic', payload: { relicId: 'oakHeart' } },
    ]);

    // Se a visão mudar enquanto o diálogo está aberto, relê e não envia ordem velha
    made.api.state.view = placedView;
    made.api.state.stateVersion += 1;
    await made.controller.session.syncNow();
    scripted.answers.push(async () => {
      made.api.state.view = unplacedView;
      made.api.state.stateVersion += 1;
      await made.controller.session.syncNow();
      return 0;
    });
    await commands.find((command) => command.id === 'lords.removeRelic')?.run();
    await settle(made.controller);

    expect(made.api.state.commands).toHaveLength(2);
    expect(made.controller.toasts.at(-1)?.text).toContain('já não estava na Capela');
  });

  it('o prazo "vale a partir de" entra em guildDeadlines (nextPollMs) enquanto aguarda a virada do dia', () => {
    const pendingView = withRelics(initialView, 1, [
      makeRelic({
        placed: true,
        active: false,
        effectiveInSeconds: 45,
        effectiveText: 'Vale a partir da próxima virada de dia de jogo: em 45 s.',
        canPlace: false,
        canRemove: true,
      }),
    ]);
    expect(guildDeadlines(pendingView)).toContain(45);

    const activeView = withRelics(initialView, 1, [
      makeRelic({
        placed: true,
        active: true,
        effectiveInSeconds: 0,
        effectiveText: 'Já está em vigor.',
        canPlace: false,
        canRemove: true,
      }),
    ]);
    expect(guildDeadlines(activeView)).not.toContain(0);
  });

  it('o Relatório de Retorno cita relíquia achada e relíquia que passou a valer', () => {
    const before = withRelics(initialView, 1, [
      makeRelic({
        placed: true,
        active: false,
        effectiveInSeconds: 1200,
        effectiveText: 'Vale a partir da próxima virada de dia de jogo: em 20 min.',
        canPlace: false,
        canRemove: true,
      }),
    ]);
    const after = withRelics(initialView, 1, [
      makeRelic({
        placed: true,
        active: true,
        effectiveInSeconds: 0,
        effectiveText: 'Já está em vigor.',
        canPlace: false,
        canRemove: true,
      }),
      makeRelic({
        relicId: 'wolfBone',
        label: 'Osso do Lobo Branco',
        effectText: '+10% de poder da equipe nas expedições.',
      }),
    ]);
    const events = [
      {
        ...gameEvent(
          1,
          'relicFound',
          'No 1º dia da Primavera, Pedra Alta recebeu uma relíquia: Osso do Lobo Branco. O tesouro foi guardado para a Capela.',
        ),
        data: { relicId: 'wolfBone' },
      },
      {
        ...gameEvent(2, 'dayStarted', 'Começou o 2º dia da Primavera.'),
        data: { dayOfYear: 2 },
      },
    ];

    const report = buildReturnReport(before, after, events, 6 * 60 * 60 * 1000);
    const relicItems = (report.blocks?.prospered ?? []).filter((item) => item.topic === 'relic');
    expect(relicItems).toHaveLength(2);
    expect(relicItems[0]?.text).toContain('recebeu uma relíquia: Osso do Lobo Branco');
    expect(relicItems[1]?.text).toContain('Coração do Carvalho passou a valer na Capela:');
  });
});
