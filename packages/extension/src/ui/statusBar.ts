import * as vscode from 'vscode';

import type { Controller } from '../controller';
import { statusBar } from './format';

/** A contagem regressiva anda a cada 30 s, não por segundo, para não distrair. */
const TICK_MS = 30_000;

/** O item da barra de status: uma linha, uma prioridade. Clique abre o painel. */
export class LordsStatusBar implements vscode.Disposable {
  private readonly item: vscode.StatusBarItem;
  private readonly timer: ReturnType<typeof setInterval>;
  private readonly unsubscribe: () => void;

  constructor(
    private readonly controller: Controller,
    onTick: () => void,
  ) {
    this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 50);
    this.item.name = 'Lords of the Guild';
    this.item.command = 'lords.openPanel';
    this.unsubscribe = controller.onChange(() => this.render());
    this.timer = setInterval(() => {
      this.render();
      onTick();
    }, TICK_MS);
    this.render();
    this.item.show();
  }

  render(): void {
    const { controller } = this;
    const output = statusBar({
      view: controller.view,
      connection: controller.connection,
      discreetMode: controller.settings.discreetMode,
      signedIn: controller.account.state.kind !== 'signedOut',
      elapsedSeconds: controller.elapsedSeconds,
      pending: controller.unseen,
    });
    this.item.text = output.text;
    this.item.tooltip = output.tooltip;
  }

  dispose(): void {
    this.unsubscribe();
    clearInterval(this.timer);
    this.item.dispose();
  }
}
