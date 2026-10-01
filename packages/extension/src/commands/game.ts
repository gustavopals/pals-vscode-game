import type { ViewState } from '@lotg/protocol';
import * as vscode from 'vscode';

import type { Controller } from '../controller';
import {
  formatCost,
  formatDuration,
  formatNumber,
  formatRemaining,
  remainingNow,
} from '../ui/format';
import type { TreeNode } from '../ui/treeModel';
import { attempt, type Register, requireView } from './shared';

type WorkerRow = ViewState['workers'][number];
type Building = WorkerRow['building'];

/** Aceita o id do edifício, vindo de um comando, ou o item da árvore, vindo de uma ação inline. */
function workerOf(view: ViewState, arg: unknown): WorkerRow | undefined {
  const id =
    typeof arg === 'string' ? arg : (arg as TreeNode | undefined)?.id?.replace(/^worker:/, '');
  return view.workers.find((row) => row.building === id);
}

async function pickWorker(view: ViewState): Promise<WorkerRow | undefined> {
  const picked = await vscode.window.showQuickPick(
    view.workers.map((row) => ({
      label: `${row.label} Nv${row.level}`,
      description: `${row.assigned} ${row.assigned === 1 ? 'trabalhador' : 'trabalhadores'} · ${formatNumber(row.grossPerHour)}/h`,
      detail: row.breakdown,
      row,
    })),
    {
      title: 'Alocar trabalhadores',
      placeHolder: `${view.population.free} ${view.population.free === 1 ? 'aldeão livre' : 'aldeões livres'}`,
    },
  );
  return picked?.row;
}

/** Texto da validação do InputBox: a taxa que o número digitado daria, ou o motivo do erro. */
export function workersPreview(row: WorkerRow, free: number, input: string): string | null {
  const max = row.assigned + free;
  const count = Number(input);
  if (input.trim() === '' || !Number.isInteger(count) || count < 0) {
    return 'Digite um número inteiro de trabalhadores.';
  }
  if (count > max) {
    return `Só há ${max} disponíveis para ${row.label} (${row.assigned} já lá e ${free} livres).`;
  }
  return null;
}

async function askWorkerCount(view: ViewState, row: WorkerRow): Promise<number | undefined> {
  const { free } = view.population;
  const answer = await vscode.window.showInputBox({
    title: `${row.label} Nv${row.level}`,
    prompt: `Quantos trabalhadores? Hoje são ${row.assigned}; há ${free} livres. Cada um rende ${formatNumber(row.perWorkerPerHour)}/h aqui.`,
    value: String(row.assigned),
    validateInput: (value) => {
      const problem = workersPreview(row, free, value);
      if (problem !== null) {
        return problem;
      }
      // Mensagem informativa: a taxa que o edifício passaria a render.
      return {
        message: `${Number(value)} × ${formatNumber(row.perWorkerPerHour)} = ${formatNumber(Number(value) * row.perWorkerPerHour)}/h`,
        severity: vscode.InputBoxValidationSeverity.Info,
      };
    },
  });
  return answer === undefined ? undefined : Number(answer);
}

export function registerGameCommands(controller: Controller, register: Register): void {
  const setWorkers = (building: Building, count: number) =>
    attempt(controller.prepare('setWorkers', { building, count }));

  register('lords.allocateWorkers', async (arg) => {
    const view = requireView(controller);
    if (view === null) {
      return;
    }
    const row = workerOf(view, arg) ?? (await pickWorker(view));
    if (row === undefined) {
      return;
    }
    const count = await askWorkerCount(view, row);
    if (count !== undefined && count !== row.assigned) {
      await setWorkers(row.building, count);
    }
  });

  const step = (delta: number) => async (arg: unknown) => {
    const view = requireView(controller);
    const row = view === null ? undefined : workerOf(view, arg);
    if (row === undefined) {
      await vscode.commands.executeCommand('lords.allocateWorkers');
      return;
    }
    await setWorkers(row.building, Math.max(0, row.assigned + delta));
  };
  register('lords.workersIncrease', step(1));
  register('lords.workersDecrease', step(-1));

  register('lords.build', async (arg) => {
    const view = requireView(controller);
    if (view === null) {
      return;
    }
    const { available, active } = view.constructions;
    // Vem o id do edifício, de um comando, ou o item da árvore, da ação "Melhorar" do item.
    const requested =
      typeof arg === 'string'
        ? arg
        : (arg as TreeNode | undefined)?.id?.replace(/^construction:/, '');
    let building = available.find((upgrade) => upgrade.building === requested)?.building;
    if (building === undefined) {
      const picked = await vscode.window.showQuickPick(
        available.map((upgrade) => ({
          // $(check) pode começar agora; $(lock) está bloqueada, e o detalhe diz por quê.
          label: `${upgrade.blockedReason === null ? '$(check)' : '$(lock)'} ${upgrade.label} Nv${upgrade.fromLevel} → Nv${upgrade.targetLevel}`,
          description: `${formatCost(upgrade.cost)} · ${formatDuration(upgrade.durationSeconds)}`,
          detail: upgrade.blockedReason ?? 'Pode começar agora.',
          building: upgrade.building,
        })),
        {
          title: 'Construir ou melhorar',
          placeHolder:
            active === null
              ? 'Os pedreiros estão livres.'
              : `Em obras: ${active.label} → Nv${active.targetLevel}, termina em ${formatRemaining(remainingNow(active.secondsRemaining, controller.elapsedSeconds))}`,
          matchOnDescription: true,
        },
      );
      building = picked?.building;
    }
    if (building !== undefined) {
      const chosen = building;
      // Mesmo bloqueada, a ordem segue: é o servidor que recusa, com o motivo atualizado.
      await attempt(controller.prepare('startConstruction', { building: chosen }));
    }
  });

  register('lords.cancelConstruction', async () => {
    const active = requireView(controller)?.constructions.active;
    if (active === undefined) {
      return;
    }
    if (active === null) {
      void vscode.window.showInformationMessage('Não há obra em andamento.');
      return;
    }
    const confirm = 'Cancelar a obra';
    const choice = await vscode.window.showWarningMessage(
      `Cancelar a obra de ${active.label}? Voltam ${formatCost(active.refund)}.`,
      { modal: true },
      confirm,
    );
    if (choice === confirm) {
      await attempt(controller.prepare('cancelConstruction', { building: active.building }));
    }
  });

  register('lords.planConstruction', async () => {
    const view = requireView(controller);
    if (view === null) {
      return;
    }
    const planned = new Set(view.constructions.planned.map((plan) => plan.building));
    const options = [
      ...view.constructions.planned.map((plan) => ({
        label: `$(close) Tirar da lista: ${plan.label} → Nv${plan.targetLevel}`,
        description: formatCost(plan.cost),
        building: plan.building,
        unplan: true,
      })),
      ...view.constructions.available
        .filter((upgrade) => !planned.has(upgrade.building))
        .map((upgrade) => ({
          label: `$(add) Planejar: ${upgrade.label} → Nv${upgrade.targetLevel}`,
          description: `${formatCost(upgrade.cost)} · ${formatDuration(upgrade.durationSeconds)}`,
          building: upgrade.building,
          unplan: false,
        })),
    ];
    const picked = await vscode.window.showQuickPick(options, {
      title: 'Obras planejadas',
      placeHolder: 'Planejar não gasta nada: a obra fica na lista, com o custo à vista.',
    });
    if (picked !== undefined) {
      await attempt(
        controller.prepare(picked.unplan ? 'unplanConstruction' : 'planConstruction', {
          building: picked.building,
        }),
      );
    }
  });

  register('lords.recruit', async () => {
    const view = requireView(controller);
    if (view === null) {
      return;
    }
    const { recruitment, population } = view;
    const max = recruitment.maxQuantity;
    const answer = await vscode.window.showInputBox({
      title: 'Recrutar aldeões',
      prompt: `Cada aldeão custa ${formatCost(recruitment.cost)} e leva ${formatDuration(recruitment.secondsPerVillager)}. Vagas: ${population.capacity - population.villagers - population.inTraining} de ${population.capacity}.`,
      placeHolder: max > 0 ? `de 1 a ${max}` : 'sem vaga agora',
      value: max > 0 ? '1' : '',
      validateInput: (value) => {
        const quantity = Number(value);
        if (value.trim() === '' || !Number.isInteger(quantity) || quantity < 1) {
          return 'Digite quantos aldeões recrutar.';
        }
        return quantity > max && max > 0 ? `Agora cabem no máximo ${max}.` : null;
      },
    });
    if (answer !== undefined) {
      await attempt(controller.prepare('recruitVillagers', { quantity: Number(answer) }));
    }
  });

  register('lords.renameSettlement', async () => {
    const view = requireView(controller);
    if (view === null) {
      return;
    }
    const name = await vscode.window.showInputBox({
      title: 'Renomear o feudo',
      value: view.settlement.name,
      prompt: 'De 2 a 24 caracteres.',
    });
    if (name !== undefined && name.trim() !== view.settlement.name) {
      await attempt(controller.prepare('renameSettlement', { name }));
    }
  });

  register('lords.refresh', () => attempt(() => controller.session.syncNow()));

  register('lords.exportChronicle', async () => {
    const gameId = controller.session.gameId;
    if (gameId === null) {
      requireView(controller);
      return;
    }
    await attempt(async () => {
      const content = await controller.client.getChronicleMarkdown(gameId);
      // Um editor novo, não salvo: o jogador decide se e onde guardar.
      const document = await vscode.workspace.openTextDocument({ language: 'markdown', content });
      await vscode.window.showTextDocument(document, { preview: false });
    });
  });
}
