// Shared surface table for roads[].surface (carriageway, city.js) and lots.surfaces (districts/lots.js).
// The same key must give the same layer, texture and tint on both sides, otherwise a surveyed car park and the
// street next to it would not match where they touch.
import { L, FT, tintFor } from '../../render/materials.js';
import { col, mulc } from '../../core/util.js';

// key -> [texture layer, tint hex, surface type used on a carriageway]
export const SURF = {
  asphalt: [L.ASPHALT, '#5a5a57', FT.ROAD],
  setts: [L.COBBLE, '#77726a', FT.ROAD_SETTS],
  settsDark: [L.COBBLE, '#4f4d4a', FT.ROAD_SETTS],
  stone: [L.STONE, '#c9c2b2', FT.ROAD_SETTS],
  pavers: [L.PAVERS, '#8f8e8a', FT.ROAD_SETTS],
  concrete: [L.PRECAST, '#9a9892', FT.ROAD_SERVICE],
};
// the pairs district/lots.js needs ([layer, hex]) - same objects, so the two paths can never drift apart
export const SURF_MATS = Object.fromEntries(Object.entries(SURF).map(([k, v]) => [k, [v[0], v[1]]]));

// carriageway spec for one roads[].surface value: { mat, ft, tint } or null for an unknown key
export function roadSurface(name) {
  const s = SURF[name];
  if (!s) return null;
  return { mat: s[0], ft: s[2], tint: tintFor(s[0], col(s[1])) };
}
// tint of a surface key, optionally darkened/brightened by k
export const surfTint = (name, k = 1) => {
  const s = SURF[name] || SURF.asphalt;
  return tintFor(s[0], mulc(col(s[1]), k));
};
export const surfLayer = (name) => (SURF[name] || SURF.asphalt)[0];
