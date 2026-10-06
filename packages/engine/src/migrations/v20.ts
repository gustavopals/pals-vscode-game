import { exactObject, literal, natural, nullable, type Shape } from './shape';
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
 * Quem subir `schemaVersion` para 21 acrescenta aqui o passo `v20ToV21`, com esta forma como
 * entrada, e escreve a forma nova em `v21.ts`.
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
