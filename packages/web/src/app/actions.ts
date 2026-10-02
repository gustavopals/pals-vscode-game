import type { Actions } from '../components/actions';
import type { Controller } from './controller';

/** As ações dos componentes ligadas direto ao controlador, sem ponte de mensagens. */
export function controllerActions(controller: Controller): Actions {
  return {
    order: (type, payload) => {
      void controller.order(type, payload as never);
    },
    run: (commandId, arg) => controller.runCommand(commandId, arg),
    playNow: (displayName, settlementName, choice) => {
      void controller.attempt(async () => {
        await controller.playNow(displayName, settlementName, choice);
      });
    },
  };
}
