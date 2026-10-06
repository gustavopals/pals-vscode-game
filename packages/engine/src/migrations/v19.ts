import { exactObject, literal, nullable, oneOf, type Shape } from './shape';
import { rngWithinIds, RNG_STREAM_FAMILIES_V13 } from './v13';
import { guildOf, guildWithinState } from './v14';
import { tavernWithinState } from './v16';
import { expeditionsWithinState, nonEmptyName, POSTURE_IDS_V17, where } from './v17';
import {
  expeditionShapesOf,
  guildV18Fields,
  logEntryV18Fields,
  logEntryV18Rules,
  outcomesWithinState,
  stateV18Fields,
} from './v18';

// Como nas outras versões, os identificadores ficam escritos aqui: a forma de uma versão não
// acompanha o motor nem `@lotg/content`. O teste confere que hoje coincidem com `types.ts`.
export const EXPEDITION_LESSON_KINDS_V19: readonly string[] = [
  'class',
  'posture',
  'item',
  'strength',
];

const lesson: Shape = (value, path) => {
  const found = exactObject({
    kind: oneOf(EXPEDITION_LESSON_KINDS_V19),
    heroName: nullable(nonEmptyName),
    posture: nullable(oneOf(POSTURE_IDS_V17)),
  })(value, path);
  if (found !== null) {
    return found;
  }
  const entry = value as { kind: string; heroName: string | null; posture: string | null };
  const named = entry.kind === 'posture' || entry.kind === 'item';
  if (named !== (entry.heroName !== null)) {
    return `${where(path)}.heroName: só a lição da Postura e a do item falam de um herói`;
  }
  if ((entry.kind === 'posture') !== (entry.posture !== null)) {
    return `${where(path)}.posture: só a lição da Postura diz uma Postura`;
  }
  return null;
};

const logEntryV19Form: Shape = exactObject({
  ...logEntryV18Fields,
  standout: nullable(nonEmptyName),
  lesson: nullable(lesson),
});

/**
 * Um registro do percurso da versão 19: o da 18 com quem se destacou e a lição. Só um nó com
 * prova tem destaque, e só o Revés e o Desastre ensinam.
 */
const logEntry: Shape = (value, path) => {
  const found = logEntryV19Form(value, path) ?? logEntryV18Rules(value, path);
  if (found !== null) {
    return found;
  }
  const entry = value as { outcome: string; standout: unknown; lesson: unknown };
  const trial = entry.outcome !== 'chosen' && entry.outcome !== 'passed';
  if (!trial && entry.standout !== null) {
    return `${where(path)}.standout: só um nó com prova tem quem se destaque`;
  }
  if (entry.lesson !== null && entry.outcome !== 'setback' && entry.outcome !== 'disaster') {
    return `${where(path)}.lesson: só o Revés e o Desastre ensinam`;
  }
  return null;
};

const { expeditions, reports } = expeditionShapesOf(logEntry);

export const guildV19Fields: Readonly<Record<string, Shape>> = {
  ...guildV18Fields,
  expeditions,
  reports,
};

/**
 * O `GameState` da versão 19: o da versão 18 com o relatório nó a nó (V3D-T3; GDD §9.4). Cada
 * registro do percurso de uma expedição, em curso ou já no relatório, ganha `standout` (quem se
 * destacou no nó, pelo nome) e `lesson` (o que o Revés ou o Desastre ensina: o tipo, o herói e
 * a Postura de que fala). Nada mais muda de forma; `ids` e `rng` ficam como estavam.
 *
 * Quem subir `schemaVersion` para 20 acrescenta aqui o passo `v19ToV20`, com esta forma como
 * entrada, e escreve a forma nova em `v20.ts`.
 */
export const stateV19Fields: Readonly<Record<string, Shape>> = {
  ...stateV18Fields,
  schemaVersion: literal(19),
  guild: guildOf(exactObject(guildV19Fields)),
};

const stateV19Form: Shape = exactObject(stateV19Fields);
const stateV19Streams: Shape = rngWithinIds(RNG_STREAM_FAMILIES_V13);

export const stateV19: Shape = (value, path) =>
  stateV19Form(value, path) ??
  stateV19Streams(value, path) ??
  guildWithinState(value, path) ??
  tavernWithinState(value, path) ??
  expeditionsWithinState(value, path) ??
  outcomesWithinState(value, path);
