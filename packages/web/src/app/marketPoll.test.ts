import type { ViewState } from '@lotg/protocol';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { caravanView, makeController, marketDayView, mastersView } from '../test-helpers';
import type { Controller } from './controller';

/**
 * A leitura seguinte acontece quando um prazo do Mercado vence (roadmap da v0.3, V3E-T4.5): a
 * caravana que chega (é quando o ouro entra e o desfecho é sorteado), o preço que muda com a
 * virada do dia e o Mestre que termina a adaptação. Sem isso a contagem chegava a zero e a tela
 * ficava parada nela.
 */

const created: Controller[] = [];
afterEach(() => {
  for (const controller of created.splice(0)) {
    controller.dispose();
  }
  vi.useRealTimers();
});

type Made = ReturnType<typeof makeController>;

const reads = (made: Made) =>
  made.api.state.requests.filter((request) => request.endsWith('/view')).length;

async function watching(view: ViewState): Promise<Made> {
  vi.useFakeTimers();
  const made = makeController({ signedIn: true });
  created.push(made.controller);
  made.api.state.view = view;
  made.controller.setVisible(true);
  await made.controller.start();
  await vi.advanceTimersByTimeAsync(0);
  return made;
}

/** A leitura não vem antes do prazo, e vem um segundo depois dele. */
async function readsRightAfter(view: ViewState, seconds: number): Promise<void> {
  const made = await watching(view);
  const before = reads(made);
  await vi.advanceTimersByTimeAsync(seconds * 1000);
  expect(reads(made)).toBe(before);
  await vi.advanceTimersByTimeAsync(1_500);
  expect(reads(made)).toBe(before + 1);
}

/** Uma visão sem nenhum outro prazo curto: o que antecipa a leitura é só o que o teste põe. */
function quiet(view: ViewState): ViewState {
  return {
    ...view,
    calendar: { ...view.calendar, secondsToNextDay: 9000 },
    council: { ...view.council, pending: [], nextAudienceInSeconds: 9000 },
    constructions: {
      ...view.constructions,
      queues: view.constructions.queues.map(() => null),
      planned: [],
    },
    population: { ...view.population, secondsToNextRecruit: null, secondsToNextRecovery: null },
    workers: view.workers.map((row) => ({ ...row, adaptingCohorts: [] })),
    market: { ...view.market, nextChangeInSeconds: 9000 },
    masters: view.masters.map((master) => ({ ...master, adaptationEndsInSeconds: null })),
    tavern: { ...view.tavern, nextRotationInSeconds: null },
    guild: {
      ...view.guild,
      arriving: [],
      wage: { ...view.guild.wage, coveredForSeconds: null, afterArrivals: null, lingering: null },
    },
  };
}

describe('a leitura seguinte acontece quando um prazo do Mercado vence', () => {
  it('a caravana que chega', async () => {
    const view = quiet(caravanView);
    await readsRightAfter(
      {
        ...view,
        market: {
          ...view.market,
          caravans: view.market.caravans.map((caravan) => ({ ...caravan, arrivesInSeconds: 12 })),
        },
      },
      12,
    );
  });

  it('o preço que muda com a virada do dia', async () => {
    const view = quiet(marketDayView);
    await readsRightAfter({ ...view, market: { ...view.market, nextChangeInSeconds: 14 } }, 14);
  });

  it('o fim da adaptação do Mestre', async () => {
    const view = quiet(mastersView);
    await readsRightAfter(
      {
        ...view,
        masters: view.masters.map((master, index) =>
          index === 0 ? { ...master, adaptationEndsInSeconds: 16 } : master,
        ),
      },
      16,
    );
  });

  it('sem nenhum prazo curto, o ciclo é o de sempre', async () => {
    const made = await watching(quiet(caravanView));
    const before = reads(made);
    await vi.advanceTimersByTimeAsync(20_000);
    expect(reads(made)).toBe(before);
  });
});
