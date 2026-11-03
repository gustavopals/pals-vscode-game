import {
  exactObject,
  literal,
  natural,
  nullable,
  oneOf,
  positive,
  text,
  type Shape,
} from './shape';
import type { MigrationStep, StoredState } from './step';
import { legacyMarketEffects } from './legacyMarket';
import { UNIT_IDS_V28 } from './v28';
import { LINE_IDS_V29, UNIT_LINE_V29, WING_IDS_V29 } from './v29';
import { battleReportV33 } from './v33';
import { stateV38 } from './v38';

const object = (value: unknown): value is StoredState =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const eachWing = (shape: Shape) =>
  exactObject(Object.fromEntries(WING_IDS_V29.map((wing) => [wing, shape])));
const formationShape = exactObject({
  id: text,
  name: text,
  posts: eachWing(
    exactObject(
      Object.fromEntries(
        LINE_IDS_V29.map((line) => [
          line,
          nullable(exactObject({ unit: oneOf(UNIT_IDS_V28), count: positive })),
        ]),
      ),
    ),
  ),
  commanders: eachWing(nullable(text)),
});

const campaignShape = nullable(
  exactObject({
    formationId: text,
    formation: formationShape,
    tile: literal('raiderCamp'),
    departsAtMs: natural,
    battleAtMs: natural,
    returnsAtMs: natural,
    report: nullable(battleReportV33),
  }),
);

type Formation = {
  id: string;
  name: string;
  posts: Record<string, Record<string, { unit: string; count: number } | null>>;
  commanders: Record<string, string | null>;
};
type Campaign = {
  formationId: string;
  formation: Formation;
  tile: string;
  departsAtMs: number;
  battleAtMs: number;
  returnsAtMs: number;
  report: null | {
    id: string;
    formationId: string | null;
    mode: string;
    foughtAtMs: number;
    casualties: Array<{
      owner: string;
      wing: string;
      line: string;
      unit: string;
      start: number;
      lost: number;
    }>;
    commanders: Array<{ heroId: string; fate: string | null }>;
  };
};

/** Estado 39: herói em campanha e reserva da formação; as guardas antigas ficam congeladas. */
export const stateV39: Shape = (value, path) => {
  if (!object(value)) return stateV38(value, path);
  const at = (key: string) => (path === '' ? key : `${path}.${key}`);
  const version = literal(39)(value.schemaVersion, at('schemaVersion'));
  if (version !== null) return version;
  const army = value.army;
  const guild = value.guild;
  if (!object(army) || !object(guild) || !Array.isArray(guild.heroes))
    return stateV38({ ...value, schemaVersion: 38 }, path);
  const { campaign: entry, ...oldArmy } = army;
  const shape = campaignShape(entry, at('army.campaign'));
  if (shape !== null) return shape;
  const awayHeroes = guild.heroes.filter(
    (hero) => object(hero) && hero.status === 'campaign',
  ) as StoredState[];
  // Ferimentos em viagem continuam válidos, mas não tornam o comandante disponível no feudo.
  const heroes = guild.heroes.map((hero) =>
    object(hero) && hero.status === 'campaign'
      ? { ...hero, status: hero.injury === null ? 'idle' : 'injured' }
      : hero,
  );
  const inherited = { ...value, schemaVersion: 38, army: oldArmy, guild: { ...guild, heroes } };
  const previous = stateV38(inherited, path);
  if (previous !== null) return previous;
  const campaign = entry as Campaign | null;
  const here = at('army.campaign');
  if (campaign === null)
    return awayHeroes.length === 0 ? null : `${here}: herói em campanha sem campanha`;
  const now = value.lastProcessedAt as number;
  if (!(
    campaign.departsAtMs <= now &&
    campaign.departsAtMs < campaign.battleAtMs &&
    campaign.battleAtMs < campaign.returnsAtMs &&
    now < campaign.returnsAtMs
  ))
    return `${here}: prazos fora de ordem ou retorno já vencido`;
  if ((campaign.report === null) !== now < campaign.battleAtMs)
    return `${here}.report: relatório incompatível com o instante da batalha`;
  const formation = campaign.formation;
  const ids = value.ids as Record<string, number>;
  if (
    campaign.formationId !== formation.id ||
    !/^formation-[1-9][0-9]*$/.test(formation.id) ||
    Number(formation.id.slice(10)) > (ids.formation ?? 0)
  )
    return `${here}.formationId: formação fora do contador ou diferente da fotografia`;
  if (
    formation.name.trim() !== formation.name ||
    formation.name.length < 1 ||
    formation.name.length > 30
  )
    return `${here}.formation.name: nome inválido`;
  const map = value.map as { tiles: Record<string, { type: string }> };
  if (map.tiles[campaign.tile]?.type !== 'raiderCamp')
    return `${here}.tile: tile ausente ou de outro tipo`;
  const units = army.units as Record<string, number>;
  const reserved: Record<string, number> = {};
  const commanders: string[] = [];
  for (const wing of WING_IDS_V29) {
    let manned = false;
    for (const line of LINE_IDS_V29) {
      const post = formation.posts[wing]![line];
      if (post === null || post === undefined) continue;
      if (post.count > 30 || UNIT_LINE_V29[post.unit] !== line)
        return `${here}.formation.posts: posto inválido`;
      reserved[post.unit] = (reserved[post.unit] ?? 0) + post.count;
      manned = true;
    }
    const heroId = formation.commanders[wing];
    if (heroId === null || heroId === undefined) continue;
    if (!manned || commanders.includes(heroId))
      return `${here}.formation.commanders: comandante repetido ou sem soldados`;
    commanders.push(heroId);
    const hero = awayHeroes.find((hero) => hero.id === heroId);
    const died =
      campaign.report?.commanders.some(
        (commander) => commander.heroId === heroId && commander.fate === 'died',
      ) ?? false;
    if (hero === undefined && !died)
      return `${here}.formation.commanders: comandante ausente da campanha`;
    if (died && guild.heroes.some((hero) => object(hero) && hero.id === heroId))
      return `${here}.report: comandante morto ainda serve ao feudo`;
  }
  if (Object.keys(reserved).length === 0 || commanders.length === 0)
    return `${here}: campanha sem soldados ou comandante`;
  if (awayHeroes.some((hero) => !commanders.includes(hero.id as string)))
    return `${here}: herói em campanha fora da formação`;
  if (Object.entries(reserved).some(([unit, count]) => count > (units[unit] ?? 0)))
    return `${here}: reserva maior que o exército`;
  const report = campaign.report;
  if (report !== null) {
    if (
      report.mode !== 'attack' ||
      report.formationId !== formation.id ||
      report.foughtAtMs !== campaign.battleAtMs ||
      !/^battle-[1-9][0-9]*$/.test(report.id) ||
      Number(report.id.slice(7)) > (ids.battle ?? 0)
    )
      return `${here}.report: batalha incompatível com a campanha`;
    const player = report.casualties.filter((post) => post.owner === 'player');
    const posts = WING_IDS_V29.flatMap((wing) =>
      LINE_IDS_V29.flatMap((line) => {
        const post = formation.posts[wing]![line];
        return post === null || post === undefined ? [] : [{ wing, line, ...post }];
      }),
    );
    if (
      player.length !== posts.length ||
      posts.some(
        (post) =>
          !player.some(
            (loss) =>
              loss.wing === post.wing &&
              loss.line === post.line &&
              loss.unit === post.unit &&
              loss.start === post.count &&
              loss.lost >= 0 &&
              loss.lost <= loss.start,
          ),
      )
    )
      return `${here}.report.casualties: baixas diferentes da tropa enviada`;
    if (report.commanders.some((commander) => !commanders.includes(commander.heroId)))
      return `${here}.report.commanders: comandante fora da campanha`;
  }
  return null;
};

/** V4G-T2: o roadmap previa 35 → 36; nesta base o passo efetivo é 39 → 40. */
export const v39ToV40: MigrationStep = {
  from: 39,
  summary: 'Acrescenta cerco, milícia e reconstrução sem agendar nem sortear na fronteira.',
  shape: (value, path) => stateV39(legacyMarketEffects(value), path),
  migrate: (state) => ({
    ...(legacyMarketEffects(state) as StoredState),
    schemaVersion: 40,
    siege: null,
    settlement: {
      ...(state.settlement as StoredState),
      militia: null,
      reconstructionUntilMs: null,
    },
  }),
};
