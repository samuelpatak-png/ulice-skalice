// Generic street elements that any district file can use (schema: technik/schema_prvkov.md).
// One data pass (applyPrvky, before the city is built) and one geometry pass (buildPrvky, with the other
// district props). districts/index.js and districts/lots.js only hand the new keys over to this module.
import { CITY } from '../city.js';
import { clearMapLamps, applyLamps, buildPoles, buildWires, wireDirs } from './stlpy.js';
import { buildTrafficSigns, buildTrafficLights, buildNameplates } from './znacky.js';
import { buildFurniturePrvky } from './mobiliar.js';
import { buildCrossings, buildMarkings, buildDriveways, dropOsmZebras } from './cesta.js';

export { fenceBase, slatFence } from './ploty.js';
export { fenceGaps } from './cesta.js';
export { SURF, SURF_MATS, roadSurface } from './surfaces.js';

const KEYS = ['trafficSigns', 'trafficLights', 'nameplates', 'poles', 'wires', 'lamps', 'clearLamps',
  'driveways', 'crossings', 'markings', 'furniture', 'todo'];
let DATA = null;

// ------------------------------------------------------------------ data pass
export function applyPrvky(D, Z, over) {
  DATA = D;
  if (!KEYS.some(k => Z[k])) return;
  clearMapLamps(D, Z.clearLamps);
  applyLamps(D, Z.lamps);
  dropOsmZebras(D, Z.crossings);
  (over.prvky || (over.prvky = [])).push(Z);
}
// trees: [x, z, k, scale, dir] or { p, k, h, sc, dir, species }. Entries that carry a size or a rotation
// go to D.tExtra so the exact values survive to buildVegetation; plain [x, z, k] keeps the packed fast path.
// onlySized = only divert entries that really carry a size or a rotation (keeps the packed order of the rest)
export function treeExtra(tr, onlySized = false) {
  if (Array.isArray(tr)) {
    if (tr.length < 4 || (tr[3] == null && tr[4] == null)) return null;
    return { x: tr[0], z: tr[1], k: tr[2] | 0, sc: tr[3] == null ? undefined : +tr[3], dir: tr[4] == null ? undefined : +tr[4] };
  }
  if (!tr || !tr.p) return null;
  if (onlySized && tr.h == null && tr.sc == null && tr.dir == null) return null;
  return { x: tr.p[0], z: tr.p[1], k: (tr.k ?? 0) | 0, h: tr.h, sc: tr.sc, dir: tr.dir };
}
export const pushTree = (D, e) => { (D.tExtra || (D.tExtra = [])).push(e); };

// ------------------------------------------------------------------ geometry pass
// lamps and line poles a sign can be mounted on (trafficSigns[].on)
function anchorsFor() {
  const lamps = [];
  if (DATA) {
    const Lm = DATA.lamps || [];
    for (let i = 0; i < Lm.length; i += 3) lamps.push({ x: Lm[i] / 10, z: Lm[i + 1] / 10, r: 0.085 });
    for (const e of DATA.lampsX || []) { const o = Array.isArray(e) ? { x: e[0], z: e[1] } : e; lamps.push({ x: o.x, z: o.z, r: 0.075 }); }
  }
  return {
    poles: {},
    nearestLamp(x, z, max = 3) {
      let best = null, bd = max;
      for (const l of lamps) { const d = Math.hypot(l.x - x, l.z - z); if (d < bd) { bd = d; best = l; } }
      return best;
    },
  };
}
export function buildPrvky() {
  const over = CITY.over;
  if (!over || !over.prvky) return;
  const anchors = anchorsFor();
  for (const Z of over.prvky) buildPoles(Z.poles, anchors, wireDirs(Z.poles, Z.wires));
  for (const Z of over.prvky) {
    buildWires(Z.wires, anchors);
    buildTrafficSigns(Z.trafficSigns, anchors);
    buildTrafficLights(Z.trafficLights);
    buildNameplates(Z.nameplates);
    buildCrossings(Z.crossings);
    buildMarkings(Z.markings);
    buildDriveways(Z.driveways);
    buildFurniturePrvky(Z.furniture);
    // `todo` is survey prose for elements the schema has no field for: never drawn, must never break anything
  }
}
// all driveways of all districts (districts/index.js uses them to cut the fence runs)
export function allDriveways() {
  const out = [];
  for (const Z of (CITY.over && CITY.over.prvky) || []) for (const d of Z.driveways || []) out.push(d);
  return out;
}
