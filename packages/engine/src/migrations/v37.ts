import {
  boolean,
  exactObject,
  listOf,
  literal,
  natural,
  oneOf,
  positive,
  text,
  type Shape,
} from './shape';
import type { MigrationStep, StoredState } from './step';
import { marketEffectsWithinState, stateV36 } from './v36';

const object = (value: unknown): value is StoredState =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const name: Shape = (value, path) =>
  text(value, path) ?? ((value as string).trim().length > 0 ? null : `${path}: nome vazio`);
const heroId: Shape = (value, path) =>
  typeof value === 'string' &&
  /^hero-[1-9][0-9]*$/.test(value) &&
  Number.isSafeInteger(Number(value.slice(5)))
    ? null
    : `${path}: esperado identificador hero-<n>`;
const heroes = listOf(exactObject({ id: heroId, name }));

const effectsV37 = listOf(
  exactObject({
    resource: oneOf(['food', 'wood', 'stone', 'iron']),
    factor: exactObject({ num: positive, den: positive }),
    fromMs: natural,
    untilMs: natural,
    label: (value, path) =>
      text(value, path) ?? ((value as string).trim().length > 0 ? null : `${path}: texto vazio`),
  }),
);

/** Identificadores congelados; participantes antigos podem já ter partido da Guilda. */
const participants: Readonly<Record<string, number>> = {
  gamblingDebt: 1,
  squareDuel: 2,
  wanderingHealer: 1,
};

export const stateV37: Shape = (value, path) => {
  if (!object(value)) return stateV36(value, path);
  const at = (key: string) => (path === '' ? key : `${path}.${key}`);
  const version = literal(37)(value.schemaVersion, at('schemaVersion'));
  if (version !== null) return version;
  const old = { ...value, schemaVersion: 36 };
  const guild = value.guild;
  const council = value.council;
  const market = value.market;
  if (!object(guild) || !object(guild.tavern) || !object(council) || !object(market))
    return stateV36(old, path);
  if (!Array.isArray(market.effects)) return stateV36(old, path);
  const effectsError =
    effectsV37(market.effects, at('market.effects')) ??
    marketEffectsWithinState(market, value.lastProcessedAt as number, path);
  if (effectsError !== null) return effectsError;
  const { extraOffer, ...tavern } = guild.tavern;
  const marker = boolean(extraOffer, at('guild.tavern.extraOffer'));
  if (marker !== null) return marker;
  if (
    extraOffer === true &&
    object(value.settlement) &&
    object(value.settlement.buildings) &&
    value.settlement.buildings.tavern === 0
  )
    return `${at('guild.tavern.extraOffer')}: oferta extra sem Taverna erguida`;
  const stripped: StoredState = { ...council };
  for (const key of ['pending', 'delayed']) {
    const list = council[key];
    if (!Array.isArray(list)) return stateV36(old, path);
    const entries: StoredState[] = [];
    for (const [index, entry] of list.entries()) {
      if (!object(entry)) return stateV36(old, path);
      const targetPath = at(`council.${key}.${index}.heroes`);
      const count = typeof entry.cardId === 'string' ? participants[entry.cardId] : undefined;
      if (Object.hasOwn(entry, 'heroes')) {
        const error = heroes(entry.heroes, targetPath);
        if (error !== null) return error;
        const targets = entry.heroes as Array<{ id: string; name: string }>;
        if (
          targets.length < 1 ||
          targets.length > 2 ||
          (count !== undefined && targets.length !== count)
        )
          return `${targetPath}: quantidade de participantes inválida`;
        if (new Set(targets.map((hero) => hero.id)).size !== targets.length)
          return `${targetPath}: participante repetido`;
        const issued = object(value.ids) ? value.ids.hero : 0;
        if (
          targets.some(
            (hero) => Number(hero.id.slice(5)) > (typeof issued === 'number' ? issued : 0),
          )
        )
          return `${targetPath}: herói além do contador de identidades`;
      } else if (count !== undefined) return `${targetPath}: campo ausente`;
      const { heroes: targets, ...rest } = entry;
      void targets;
      entries.push(rest);
    }
    stripped[key] = entries;
  }
  const offers = guild.tavernOffers;
  if (!Array.isArray(offers)) return stateV36(old, path);
  // O recrutador permite quatro ofertas; a guarda v16 congela o teto antigo de três.
  if (offers.length > 4) return `${at('guild.tavernOffers')}: mais de quatro candidatos`;
  if (
    new Set(offers.map((offer) => (object(offer) ? offer.offerId : undefined))).size !==
    offers.length
  )
    return `${at('guild.tavernOffers')}: oferta repetida`;
  const inherited = {
    ...old,
    council: stripped,
    guild: { ...guild, tavern, tavernOffers: offers.slice(0, 3) },
    market: { ...market, effects: [] },
  };
  const error = stateV36(inherited, path);
  if (error !== null || offers.length <= 3) return error;
  // Confere também a quarta oferta inteira e suas relações com o contador e a Taverna.
  return stateV36({ ...inherited, guild: { ...guild, tavern, tavernOffers: [offers[3]] } }, path);
};

/**
 * Estado 37 → 38 (V4F-T1.2):
 * Acrescenta horde.sabotages = { attempts: 0, successes: 0, alerted: false }
 * Não cria instante, sorteio nem prazo.
 */
export const v37ToV38: MigrationStep = {
  from: 37,
  summary: 'Acrescenta os contadores de sabotagem da Fortaleza à Horda.',
  shape: stateV37,
  migrate: (state) => {
    const horde = state.horde as StoredState;
    return {
      ...state,
      schemaVersion: 38,
      horde: {
        ...horde,
        sabotages: { attempts: 0, successes: 0, alerted: false },
      },
    };
  },
};
