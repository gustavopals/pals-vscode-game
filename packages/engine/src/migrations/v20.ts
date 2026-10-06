import { exactObject, literal, natural, nullable, type Shape } from './shape';
import type { MigrationStep, StoredState } from './step';
import { rngWithinIds, RNG_STREAM_FAMILIES_V13 } from './v13';
import { guildOf, guildWithinState, heroRoster } from './v14';
import { tavernWithinState } from './v16';
import { expeditionsWithinState } from './v17';
import { expeditionShapesOf, heroShapeOf, outcomesWithinState } from './v18';
import {
  EXPEDITION_LESSON_KINDS_V19,
  guildV19Fields,
  logEntryShapeOf,
  stateV19Fields,
} from './v19';

const where = (path: string) => (path === '' ? 'estado' : path);

/** Um herói da versão 20: o da 18 com o instante da volta do cativeiro, que pode não haver. */
const hero: Shape = heroShapeOf({ freedAtMs: nullable(natural) });

// Como nas outras versões, os identificadores ficam escritos aqui: a forma de uma versão não
// acompanha o motor. O teste confere que hoje coincidem com `types.ts`. `level` é a lição da
// força que faltou a uma equipe que já ia completa (revisão da Fase D, B3).
export const EXPEDITION_LESSON_KINDS_V20: readonly string[] = [
  ...EXPEDITION_LESSON_KINDS_V19,
  'level',
];

const { expeditions, reports } = expeditionShapesOf(logEntryShapeOf(EXPEDITION_LESSON_KINDS_V20));

export const guildV20Fields: Readonly<Record<string, Shape>> = {
  ...guildV19Fields,
  heroes: heroRoster(hero),
  expeditions,
  reports,
};

type FreedState = {
  guild: { heroes: Array<{ joinedAtMs: number; freedAtMs: number | null }> };
  lastProcessedAt: number;
};

/**
 * A volta do cativeiro com o resto do estado: ninguém voltou depois de agora, nem antes de ter
 * chegado ao feudo.
 */
export const freedWithinState: Shape = (value, path) => {
  const { guild, lastProcessedAt } = value as FreedState;
  const at = path === '' ? 'guild' : `${path}.guild`;
  for (const [index, entry] of guild.heroes.entries()) {
    if (entry.freedAtMs === null) {
      continue;
    }
    if (entry.freedAtMs > lastProcessedAt) {
      return `${where(at)}.heroes.${index}.freedAtMs: herói que voltou do cativeiro depois de agora`;
    }
    if (entry.freedAtMs < entry.joinedAtMs) {
      return `${where(at)}.heroes.${index}.freedAtMs: herói que voltou do cativeiro antes de chegar`;
    }
  }
  return null;
};

/**
 * O `GameState` da versão 20: o da versão 19 com `freedAtMs` em cada herói (revisão da Fase D,
 * M-D1): o instante em que ele voltou do cativeiro pela última vez, ou `null`. E a lição de um
 * registro do percurso ganha um tipo, `level` (revisão da Fase D, B3): a versão 19 nunca o
 * escreveu, e o passo não mexe nas lições que encontra. Nada mais muda de forma; `ids` e `rng`
 * ficam como estavam.
 *
 * O passo que sai daqui é o `v20ToV21`, abaixo; a forma da versão 21 está em `v21.ts`.
 */
export const stateV20Fields: Readonly<Record<string, Shape>> = {
  ...stateV19Fields,
  schemaVersion: literal(20),
  guild: guildOf(exactObject(guildV20Fields)),
};

const stateV20Form: Shape = exactObject(stateV20Fields);
const stateV20Streams: Shape = rngWithinIds(RNG_STREAM_FAMILIES_V13);

export const stateV20: Shape = (value, path) =>
  stateV20Form(value, path) ??
  stateV20Streams(value, path) ??
  guildWithinState(value, path) ??
  tavernWithinState(value, path) ??
  expeditionsWithinState(value, path) ??
  outcomesWithinState(value, path) ??
  freedWithinState(value, path);

/**
 * Os preços-base do Mercado **no dia em que este passo foi escrito** (V3E-T1), em milésimos de
 * ouro por unidade. Ficam escritos aqui, e não lidos de `@lotg/content`: um passo de migração é
 * o retrato de uma data. O teste confere que coincidem com o conteúdo de hoje; se a base mudar
 * depois, quem já tem o Mercado continua com o preço que o passeio lhe deu, e a reversão o puxa
 * para a base nova.
 */
export const MARKET_BASE_PRICES_V21 = { food: 1000, wood: 1200, stone: 2000 } as const;

/**
 * Versão 20 → 21: o Mercado (V3E-T1; ADR 0018, decisão 16).
 *
 * - `settlement.buildings` ganha o Mercado (`market`) no nível 0: ninguém o tinha. Quem já tem
 *   o Salão no nível 3 pode erguê-lo logo depois da migração.
 * - Entra `market`: os preços na base (os de hoje e os de ontem, iguais), o dia da cotação em
 *   zero e nada negociado. **Os preços só andam depois que o Mercado existe**: a primeira
 *   virada de dia com ele de pé faz o primeiro passeio.
 *
 * **O passo não cria prazo nenhum**, e por isso não usa a fronteira. Não emite evento, não dá
 * identificador a ninguém e não toca o gerador: o fluxo `market` nasce no primeiro sorteio, na
 * primeira virada de dia com o Mercado erguido.
 */
export const v20ToV21: MigrationStep = {
  from: 20,
  summary: 'Mercado no nível 0, com os preços na base, sem cotação e sem nada negociado',
  shape: stateV20,
  migrate(state) {
    const settlement = state.settlement as StoredState;
    return {
      ...state,
      schemaVersion: 21,
      settlement: {
        ...settlement,
        buildings: { ...(settlement.buildings as StoredState), market: 0 },
      },
      market: {
        prices: { ...MARKET_BASE_PRICES_V21 },
        previousPrices: { ...MARKET_BASE_PRICES_V21 },
        quoteDay: 0,
        tradedToday: { food: 0, wood: 0, stone: 0 },
      },
    };
  },
};
