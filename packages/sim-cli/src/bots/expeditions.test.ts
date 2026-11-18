import { deriveViewState, type EngineViewState as ViewState } from '@lotg/engine';
import { describe, expect, it } from 'vitest';

import { addHero, guildHall } from '../../../engine/src/test-helpers';
import { enviarExpedicoes, enviarExpedicoesOusado } from './policies';
import type { Act, Policy } from './types';

const legendaryIds = ['ancestralVault', 'hermitsRefuge'];

function guildView(unlocked: boolean, discovered: boolean): ViewState {
  const state = guildHall(0, (draft) => {
    draft.settlement.buildings.townHall = 5;
    draft.settlement.buildings.guild = unlocked ? 4 : 1;
    draft.settlement.buildings.chapel = unlocked ? 1 : 0;
    for (const classId of ['warrior', 'archer', 'mage', 'cleric'] as const) {
      addHero(draft, { classId, level: 10 });
    }
    if (discovered) draft.map.discovered.push('ruins');
  });
  return deriveViewState(state, state.lastProcessedAt);
}

async function ordersFrom(policy: Policy, view: ViewState) {
  const orders: Array<{ type: Parameters<Act>[0]; payload: unknown }> = [];
  const act: Act = async (type, payload) => {
    orders.push({ type, payload });
    return view;
  };
  await policy.run(view, act);
  return orders;
}

describe('as expedições da Fase B ficam fora das políticas até a Fase H', () => {
  for (const policy of [enviarExpedicoes, enviarExpedicoesOusado]) {
    describe(policy.name, () => {
      it.each([
        { unlocked: false, discovered: false },
        { unlocked: false, discovered: true },
        { unlocked: true, discovered: false },
        { unlocked: true, discovered: true },
      ])(
        'preserva o envio anterior com lendárias abertas=$unlocked e caminho descoberto=$discovered',
        async ({ unlocked, discovered }) => {
          const view = guildView(unlocked, discovered);
          const legendary = view.guild.available.filter((offer) =>
            legendaryIds.includes(offer.modelId),
          );
          expect(legendary).toHaveLength(2);
          expect(legendary.every((offer) => offer.canSend === unlocked)).toBe(true);
          const beforePhaseB = {
            ...view,
            guild: {
              ...view.guild,
              available: view.guild.available.filter(
                (offer) => !legendaryIds.includes(offer.modelId),
              ),
            },
          };
          const previous = await ordersFrom(policy, beforePhaseB);
          expect(previous).toHaveLength(1);
          if (policy === enviarExpedicoesOusado && !discovered) {
            expect(previous[0]?.payload).toMatchObject({ modelId: 'patrol' });
          }
          expect(await ordersFrom(policy, view)).toEqual(previous);
        },
      );
    });
  }
});
