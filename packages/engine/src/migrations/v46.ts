import { exactObject, listOf, literal, natural, nullable, oneOf, text, type Shape } from './shape';
import type { MigrationStep, StoredState } from './step';
import { stateV45 } from './v45';

const postShape = exactObject({
  id: text,
  hex: text,
  status: oneOf(['building', 'active', 'damaged']),
  readyAtMs: nullable(natural),
});
const postsShape = listOf(postShape);
const object = (value: unknown): value is StoredState =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

export const stateV46: Shape = (value, path) => {
  const at = (field: string) => (path ? `${path}.${field}` : field);
  if (!object(value) || !object(value.map)) return `${at('map')}: mapa ausente`;
  const { outposts, ...map } = value.map;
  const invalid =
    literal(46)(value.schemaVersion, at('schemaVersion')) ??
    stateV45({ ...value, map, schemaVersion: 45 }, path) ??
    natural((value.ids as StoredState).outpost, at('ids.outpost')) ??
    postsShape(outposts, at('map.outposts'));
  if (invalid) return invalid;

  const posts = outposts as { id: string; hex: string; status: string; readyAtMs: number | null }[];
  if (posts.length > 3) return `${at('map.outposts')}: limite de postos excedido`;
  const grid = map.hexes as Record<string, { fog: string; terrain: string }>;
  const issued = (value.ids as Record<string, number>).outpost!;
  let prevId = 0;
  const occupied = new Set<string>();
  for (const [index, post] of posts.entries()) {
    const where = at(`map.outposts.${index}`);
    const idNum = /^outpost-[1-9][0-9]*$/.test(post.id) ? Number(post.id.slice(8)) : Number.NaN;
    if (!Number.isSafeInteger(idNum) || idNum > issued || idNum <= prevId)
      return `${where}.id: identidade repetida, fora de ordem ou fora do contador`;
    prevId = idNum;
    const cell = grid[post.hex];
    const building = post.status === 'building';
    if (
      post.hex === '0,0' ||
      !Object.hasOwn(grid, post.hex) ||
      !cell ||
      occupied.has(post.hex) ||
      !['forest', 'fields', 'hills', 'ironVein'].includes(cell.terrain) ||
      cell.fog !== (building ? 'explored' : 'claimed')
    )
      return `${where}.hex: hexágono incompatível ou já ocupado`;
    occupied.add(post.hex);
    if (
      building
        ? post.readyAtMs === null || post.readyAtMs <= (value.lastProcessedAt as number)
        : post.readyAtMs !== null
    )
      return `${where}.readyAtMs: prazo incompatível com a situação do posto`;
  }
  return null;
};

export const v45ToV46: MigrationStep = {
  from: 45,
  summary: 'Abre os postos avançados com a lista vazia e o contador inicial.',
  shape: stateV45,
  migrate: (state) => ({
    ...state,
    schemaVersion: 46,
    map: { ...(state.map as StoredState), outposts: [] },
    ids: { ...(state.ids as StoredState), outpost: 0 },
  }),
};
