import type { ViewState } from '@lotg/protocol';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  guildPaidView,
  heroPromisedView,
  makeController,
  tavernOpenView,
  withWage,
} from '../test-helpers';
import type { Controller } from './controller';

/**
 * Revisão da Fase C (A-R6): a leitura seguinte vem antes do ciclo de 30 s quando um prazo da
 * Guilda vence (o herói prometido chega, a lista da Taverna troca, o festival acaba, o ouro
 * deixa de pagar o soldo). Sem isso a contagem chegava a zero e a tela ficava parada nela.
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

/** O feudo aberto com a aba à vista e relógio de mentira: o ciclo é o dos 30 s. */
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
    tavern: {
      ...view.tavern,
      nextRotationInSeconds: view.tavern.nextRotationInSeconds === null ? null : 9000,
    },
    guild: {
      ...view.guild,
      arriving: view.guild.arriving.map((entry) => ({ ...entry, arrivesInSeconds: 9000 })),
      wage: { ...view.guild.wage, coveredForSeconds: null, afterArrivals: null, lingering: null },
    },
  };
}

function arriving(
  view: ViewState,
  seconds: number,
  blockedReason: string | null = null,
): ViewState {
  return {
    ...view,
    guild: {
      ...view.guild,
      arriving: view.guild.arriving.map((entry) => ({
        ...entry,
        arrivesInSeconds: seconds,
        blockedReason,
      })),
    },
  };
}

describe('a leitura seguinte acontece quando um prazo da Guilda vence', () => {
  it('sem prazo curto, o ciclo é o de sempre', async () => {
    const made = await watching(quiet(tavernOpenView));
    const before = reads(made);
    await vi.advanceTimersByTimeAsync(20_000);
    expect(reads(made)).toBe(before);
  });

  it('o herói prometido que chega', async () => {
    await readsRightAfter(arriving(quiet(heroPromisedView), 6), 6);
  });

  it('a lista da Taverna que troca', async () => {
    const view = quiet(tavernOpenView);
    await readsRightAfter({ ...view, tavern: { ...view.tavern, nextRotationInSeconds: 7 } }, 7);
  });

  it('o festival que acaba', async () => {
    const view = quiet(tavernOpenView);
    await readsRightAfter(
      {
        ...view,
        tavern: { ...view.tavern, festival: { ...view.tavern.festival, activeForSeconds: 8 } },
      },
      8,
    );
  });

  it('o ouro que deixa de pagar o soldo, com a equipe de agora e com quem está a caminho', async () => {
    await readsRightAfter(withWage(quiet(guildPaidView), { coveredForSeconds: 6 }), 6);
    for (const controller of created.splice(0)) {
      controller.dispose();
    }
    await readsRightAfter(
      withWage(quiet(heroPromisedView), { afterArrivals: { perHour: 2, coveredForSeconds: 9 } }),
      9,
    );
  });

  it('a partida que o atraso fechado ainda cobra', async () => {
    await readsRightAfter(
      withWage(quiet(guildPaidView), {
        lingering: { text: 'Isolda parte na próxima virada do dia.', departureInSeconds: 5 },
      }),
      5,
    );
  });

  it('quem espera à porta (prazo zero) e o soldo em atraso (cobertura zero) não aceleram o ciclo', async () => {
    const made = await watching(
      withWage(arriving(quiet(heroPromisedView), 0, 'Rolf espera à porta.'), {
        coveredForSeconds: 0,
        afterArrivals: { perHour: 2, coveredForSeconds: 0 },
      }),
    );
    const before = reads(made);
    await vi.advanceTimersByTimeAsync(20_000);
    expect(reads(made)).toBe(before);
  });
});
