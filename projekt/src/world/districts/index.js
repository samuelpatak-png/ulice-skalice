// Hand-surveyed districts: exact building colours/heights, parking, trees, streams, bins.
// Each district file describes one or more streets (see pelisk_zahradna.js); this module applies them to the data and the city builder.
import { pts, pip, hash, rng, col, mulc } from '../../core/util.js';
import { L, FT, FLAG, tintFor } from '../../render/materials.js';
import { CITY } from '../city.js';
import { buildRetail, buildPylons, buildBillboards } from './retail.js';
import { applyLots, buildLots } from './lots.js';
import { buildMichalTower, buildKarner, buildPlagueColumn, buildFurniture } from './landmarks.js';
import PZ from './pelisk_zahradna.js';
import ML from './malleho_lucky.js';
import NS from './namestie.js';
import JHM from './jednoradova_horska_mytna.js';

export const DISTRICTS = [PZ, ML, NS, JHM];
const EXACT = 0.0625;                       // ft flag: colours come from geometry, no random facade accents
const tt = (layer, hex, k = 1) => tintFor(layer, mulc(col(hex), k));

// polyline helpers ----------------------------------------------------------------------------------------
function offsetLine(p, d) {
  const out = [];
  for (let i = 0; i < p.length; i++) {
    const a = p[Math.max(0, i - 1)], b = p[i], c = p[Math.min(p.length - 1, i + 1)];
    let e1x = b[0] - a[0], e1z = b[1] - a[1], e2x = c[0] - b[0], e2z = c[1] - b[1];
    const l1 = Math.hypot(e1x, e1z) || 1, l2 = Math.hypot(e2x, e2z) || 1;
    if (i === 0) { e1x = e2x; e1z = e2z; } if (i === p.length - 1) { e2x = e1x; e2z = e1z; }
    const n1 = [-e1z / (i === 0 ? l2 : l1), e1x / (i === 0 ? l2 : l1)], n2 = [-e2z / (i === p.length - 1 ? l1 : l2), e2x / (i === p.length - 1 ? l1 : l2)];
    let mx = n1[0] + n2[0], mz = n1[1] + n2[1]; const ml = Math.hypot(mx, mz) || 1; mx /= ml; mz /= ml;
    const k = d / Math.max(0.4, mx * n1[0] + mz * n1[1]);
    out.push([b[0] + mx * k, b[1] + mz * k]);
  }
  return out;
}
function roadLines(D, name, box, maxK = 3, near = null) {
  const ni = D.names.indexOf(name), out = [];
  if (ni < 0) return out;
  for (const r of D.r) if (r[3] === ni && r[2] <= maxK) {
    const p = pts(r[0]);
    if (near && !p.some(m => Math.hypot(m[0] - near[0], m[1] - near[1]) < 40)) continue;
    if (p.some(m => m[0] > box[0] && m[0] < box[2] && m[1] > box[1] && m[1] < box[3]) || near) out.push(p);
  }
  return out;
}
// clip segment a-b to an axis-aligned box [x0, z0, x1, z1] (Liang–Barsky); null when outside
function clipSeg(a, b, box) {
  let t0 = 0, t1 = 1; const dx = b[0] - a[0], dz = b[1] - a[1];
  for (const [p, q] of [[-dx, a[0] - box[0]], [dx, box[2] - a[0]], [-dz, a[1] - box[1]], [dz, box[3] - a[1]]]) {
    if (Math.abs(p) < 1e-9) { if (q < 0) return null; continue; }
    const r = q / p; if (p < 0) { if (r > t1) return null; if (r > t0) t0 = r; } else { if (r < t0) return null; if (r < t1) t1 = r; }
  }
  return [[a[0] + dx * t0, a[1] + dz * t0], [a[0] + dx * t1, a[1] + dz * t1]];
}
function resample(p, step, jitter, R) {
  const out = []; let acc = step * 0.5;
  for (let i = 0; i < p.length - 1; i++) {
    const a = p[i], b = p[i + 1], L0 = Math.hypot(b[0] - a[0], b[1] - a[1]);
    while (acc < L0) { const t = acc / L0; out.push([a[0] + (b[0] - a[0]) * t + (R() - 0.5) * jitter, a[1] + (b[1] - a[1]) * t + (R() - 0.5) * jitter]); acc += step; }
    acc -= L0;
  }
  return out;
}

// ------------------------------------------------------------------ data pass (before the city is built)
export function applyDistricts(D) {
  const over = { buildings: {}, looks: {}, roads: [], areas: [], streams: [], bins: [], fences: [], props: [], retail: [], pylons: [], lots: [], billboards: [], furniture: [], landmarks: { skip: [] } };
  // footprint ring -> prep.py encoding (decimetres, first point absolute, then deltas)
  const enc = (ring) => {
    const out = [Math.round(ring[0][0] * 10), Math.round(ring[0][1] * 10)]; let px = out[0], pz = out[1];
    for (let i = 1; i < ring.length; i++) { const x = Math.round(ring[i][0] * 10), z = Math.round(ring[i][1] * 10); out.push(x - px, z - pz); px = x; pz = z; }
    return out;
  };
  for (const Z of DISTRICTS) {
    const R = rng(Z.name.length * 7919 + 17);
    const inside = Z.clear ? (x, z) => pip(x, z, Z.clear) : () => false;
    // trees: drop procedural ones, add surveyed ones
    const t = [];
    for (let i = 0; i < D.t.length; i += 3) if (!inside(D.t[i] / 10, D.t[i + 1] / 10)) t.push(D.t[i], D.t[i + 1], D.t[i + 2]);
    for (const tr of Z.trees || []) t.push(Math.round(tr[0] * 10), Math.round(tr[1] * 10), tr[2]);
    for (const row of Z.treeRows || []) for (const p of roadLines(D, row.road, row.box)) {
      let j = 0; for (const q of resample(offsetLine(p, row.off), row.every, row.jitter, R)) t.push(Math.round(q[0] * 10), Math.round(q[1] * 10), row.kinds[j++ % row.kinds.length]);
    }
    D.t = t;
    // parked cars: drop procedural ones, generate bays
    const c = [];
    for (let i = 0; i < D.cars.length; i += 4) if (!inside(D.cars[i] / 10, D.cars[i + 1] / 10)) c.push(D.cars[i], D.cars[i + 1], D.cars[i + 2], D.cars[i + 3]);
    for (const pk of Z.parking || []) {
      if (pk.lot) { over.areas.push({ kind: 'parking', outer: pk.lot, holes: [], bays: false, color: pk.color, mat: pk.mat }); continue; }
      const dx = pk.b[0] - pk.a[0], dz = pk.b[1] - pk.a[1], Ln = Math.hypot(dx, dz), ux = dx / Ln, uz = dz / Ln;
      const s = pk.side ?? 1, nx = -uz * s, nz = ux * s, off = pk.off || 0, dep = pk.depth || 5;
      const q = (t, o) => [pk.a[0] + ux * t + nx * o, pk.a[1] + uz * t + nz * o];
      const cc = q(0, off + dep / 2), prx = -uz, prz = ux;
      over.areas.push({ kind: 'parking', outer: [q(0, off), q(Ln, off), q(Ln, off + dep), q(0, off + dep)], holes: [], bays: true, color: pk.color, mat: pk.mat,
        fav: [ux, uz, -(pk.a[0] * ux + pk.a[1] * uz) + 1.35, -(cc[0] * prx + cc[1] * prz) + 8.0] });
      const n = Math.floor(Ln / 2.6);
      for (let i = 0; i < n; i++) {
        if (R() > (pk.fill ?? 0.7)) continue;
        const p = q((i + 0.5) * Ln / n, off + dep * 0.5 + (R() - 0.5) * 0.3);
        const ang = Math.atan2(nz, nx) + (R() < 0.5 ? Math.PI : 0) + (R() - 0.5) * 0.06;
        c.push(Math.round(p[0] * 10), Math.round(p[1] * 10), Math.round(ang * 180 / Math.PI + 360) % 360, Math.floor(R() * 16));
      }
    }
    for (const sp of Z.streetParking || []) for (const p of roadLines(D, sp.road, sp.box, 3, sp.near)) {
      const q = offsetLine(p, sp.off);
      for (let i = 0; i < q.length - 1; i++) {
        const cs = clipSeg(q[i], q[i + 1], sp.box); if (!cs) continue;
        const [a, b] = cs, dx = b[0] - a[0], dz = b[1] - a[1], Ln = Math.hypot(dx, dz);
        for (let t = 3; t < Ln - 2.5; t += 6.0) {
          if (R() > sp.fill) continue;
          const x = a[0] + dx * t / Ln, z = a[1] + dz * t / Ln, ang = Math.atan2(dz, dx) + (sp.off > 0 ? Math.PI : 0);
          c.push(Math.round(x * 10), Math.round(z * 10), Math.round(ang * 180 / Math.PI + 360) % 360, Math.floor(R() * 16));
        }
      }
    }
    D.cars = c;
    applyLots(D, Z, over, R);
    // OSM area mis-tags: the area containing p gets another kind (e.g. a traffic playground tagged as a running track -> grass)
    for (const ak of Z.areaKinds || []) {
      const ki = D.ak.indexOf(ak.kind); if (ki < 0) continue;
      for (const a of D.a) { if (ak.from && D.ak[a[0]] !== ak.from) continue; const P = pts(a[1]); if (pip(ak.p[0], ak.p[1], P)) { a[0] = ki; break; } }
    }
    for (const id in Z.buildings || {}) over.buildings[id] = Z.schemes[Z.buildings[id]];
    // surveyed footprints replace the OSM outline; extra pieces are cloned from a similar OSM building
    for (const id in Z.shapes || {}) { const b = D.b.find(q => q[10] === +id); if (b) b[0] = enc(Z.shapes[id]); }
    for (const e of Z.extraBuildings || []) {
      const src = D.b.find(q => q[10] === e.like); if (!src) continue;
      const nb = JSON.parse(JSON.stringify(src)); nb[0] = enc(e.ring); nb[10] = e.id; D.b.push(nb);
      if (e.scheme) over.buildings[e.id] = Z.schemes[e.scheme];
      if (e.look) over.looks[e.id] = e.look;
    }
    for (const f of Z.retail || []) over.retail.push(f);
    for (const p of Z.pylons || []) over.pylons.push(p);
    for (const p of Z.props || []) over.props.push(p);
    for (const f of Z.furniture || []) over.furniture.push(f);
    if (Z.landmarks) { const { skip, ...rest } = Z.landmarks; over.landmarks.skip.push(...(skip || [])); Object.assign(over.landmarks, rest); }
    // generic-builder looks (houses, shops, halls): { id: {wall, roofColor, roof, floors, ...} | 'lookName' }
    for (const id in Z.looks || {}) { const v = Z.looks[id]; over.looks[id] = typeof v === 'string' ? Z.lookSchemes[v] : v; }
    // panel blocks that OSM maps as separate sections (often tagged as houses): merge into one bar with a surveyed scheme
    for (const bk of Z.blocks || []) {
      const secs = bk.ids.map(id => D.b.find(q => q[10] === id)).filter(Boolean); if (!secs.length) continue;
      const all = secs.flatMap(b => pts(b[0]));
      let best = null;
      for (const deg of [secs[0][4], secs[0][4] + 90]) {
        const a = deg * Math.PI / 180, ux = Math.cos(a), uz = Math.sin(a);
        let u0 = 1e9, u1 = -1e9, v0 = 1e9, v1 = -1e9;
        for (const p of all) { const u = p[0] * ux + p[1] * uz, v = -p[0] * uz + p[1] * ux; u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, v); v1 = Math.max(v1, v); }
        if (!best || u1 - u0 > best.L) best = { deg, L: u1 - u0, ux, uz, u0, u1, v0, v1 };
      }
      const { ux, uz, u0, u1, v0, v1 } = best, P = (u, v) => [u * ux - v * uz, u * uz + v * ux];
      let ring = [P(u0, v0), P(u1, v0), P(u1, v1), P(u0, v1)];
      let s = 0; for (let i = 0; i < 4; i++) { const a = ring[i], b = ring[(i + 1) % 4]; s += a[0] * b[1] - b[0] * a[1]; }
      if (s < 0) ring = ring.reverse();
      secs[0][0] = enc(ring); secs[0][4] = Math.round(((best.deg % 180) + 180) % 180);
      const drop = new Set(secs.slice(1)); D.b = D.b.filter(b => !drop.has(b));
      over.buildings[secs[0][10]] = bk.floors ? { ...Z.schemes[bk.scheme], floors: bk.floors } : Z.schemes[bk.scheme];
    }
    // stepped blocks: every section keeps its footprint, with its own storey count
    for (const sc of Z.sections || []) for (const [id, floors] of sc.ids) over.buildings[id] = { ...Z.schemes[sc.scheme], floors };
    // footway corrections: drop ways through a point, move shared vertices (all ways touching them follow)
    for (const e of Z.wayEdits || []) {
      const near = (p, q, r = 1.0) => Math.hypot(p[0] - q[0], p[1] - q[1]) < r;
      if (e.drop) D.r = D.r.filter(r => !((e.k == null || r[2] === e.k) && pts(r[0]).some(p => near(p, e.drop))));
      if (e.move) for (const r of D.r) {
        const p = pts(r[0]); let hit = false;
        for (const v of p) if (near(v, e.move[0])) { v[0] = e.move[1][0]; v[1] = e.move[1][1]; hit = true; }
        if (hit) r[0] = enc(p);
      }
    }
    for (const r of Z.roads || []) over.roads.push(r);
    for (const s of Z.streams || []) for (const p of roadLines(D, s.road, s.box)) over.streams.push({ p: offsetLine(p, s.off), w: s.w });
    for (const b of Z.bins || []) over.bins.push(b);
    // fences: along a street at a fixed offset (off > 0 = right of the way's direction), clipped to a box, or an explicit polyline p.
    // clip = d: the fence is cut where a building stands on the line or within d m behind it (the house front is the frontage there).
    for (const f of Z.fences || []) {
      const rec = (a, b, n) => ({ a, b, n, h: f.h, type: f.type, color: f.color, clip: f.clip, cap: f.cap });
      if (f.p) { for (let i = 0; i < f.p.length - 1; i++) over.fences.push(rec(f.p[i], f.p[i + 1], f.n || [0, 0])); continue; }
      for (const p of roadLines(D, f.road, f.box, 3, f.near)) {
        const q = offsetLine(p, f.off), s = Math.sign(f.off);
        for (let i = 0; i < q.length - 1; i++) {
          const cs = clipSeg(q[i], q[i + 1], f.box); if (!cs) continue;
          const ex = q[i + 1][0] - q[i][0], ez = q[i + 1][1] - q[i][1], Ln = Math.hypot(ex, ez) || 1;
          over.fences.push(rec(cs[0], cs[1], [-ez / Ln * s, ex / Ln * s]));
        }
      }
    }
  }
  CITY.over = over;
  CITY.customBuild = buildOverride;
  CITY.roadOverride = roadOverride;
}

// ------------------------------------------------------------------ road override lookup (used by buildRoads)
export function roadOverride(r) {
  if (!CITY.over || r.n < 0) return null;
  const name = CITY.names[r.n], list = CITY.over.roads.filter(o => o.name === name);
  if (!list.length) return null;
  // per point: which override box contains it (segments use their midpoint)
  const at = (x, z) => list.find(o => x > o.box[0] && x < o.box[2] && z > o.box[1] && z < o.box[3]) || null;
  if (!r.p.some(v => at(v[0], v[1]))) return null;
  return { at };
}

// ------------------------------------------------------------------ street fences
// Parts of a fence that are not covered by a house: with f.clip = d the line is cut wherever a building stands on it or within
// d m behind it (f.n points away from the street), so the fence only fills the gaps between the house fronts.
function fenceRuns(f) {
  if (!f.clip) return [[f.a, f.b]];
  const dx = f.b[0] - f.a[0], dz = f.b[1] - f.a[1], Ln = Math.hypot(dx, dz), N = Math.max(1, Math.ceil(Ln / 0.25)), n = f.n || [0, 0];
  const blocked = (x, z) => [-0.5, 0, 0.5 * f.clip, f.clip].some(k => CITY.buildingAt(x + n[0] * k, z + n[1] * k));
  const out = []; let t0 = null;
  for (let i = 0; i <= N; i++) {
    const t = i / N, bl = blocked(f.a[0] + dx * t, f.a[1] + dz * t);
    if (!bl && t0 === null) t0 = t;
    if ((bl || i === N) && t0 !== null) {
      const t1 = bl ? Math.max(t0, (i - 1) / N) : t;
      if ((t1 - t0) * Ln > 0.4) out.push([[f.a[0] + dx * t0, f.a[1] + dz * t0], [f.a[0] + dx * t1, f.a[1] + dz * t1]]);
      t0 = null;
    }
  }
  return out;
}
// Fence types seen along the streets: 'panel' (precast concrete panels between posts, the default), 'block' (concrete block wall
// with block pillars), 'stoneblock' (split-face stone-look blocks, pillars and caps), 'sheet' (steel sheet fence or gate on a frame),
// 'wood' (closed vertical boards), 'slat' (open slats / pickets), 'wall' (plastered wall with a cap), 'stone' (rubble stone wall),
// 'brick', 'hedge', 'creeper' (low wall grown over), 'mesh' (welded mesh), 'rail' (pipe railing).
function drawFence(f, a, b) {
  const dx = b[0] - a[0], dz = b[1] - a[1], Ln = Math.hypot(dx, dz); if (Ln < 0.2) return;
  const G = CITY.tile(a[0], a[1]).b, ang = Math.atan2(dz, dx), m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], h = f.h || 1.6;
  const y0 = CITY.groundH(m[0], m[1]);
  const at = (t) => [a[0] + dx * t, a[1] + dz * t];
  const body = (th, c, mat, ft = 0, y = -0.1, hh = h + 0.1) => CITY.box(G, m[0], y0 + y, m[1], Ln, hh, th, ang, c, mat, ft);
  const posts = (step, w, hh, c, mat, ends = false) => {
    const n = Math.max(1, Math.round(Ln / step));
    for (let i = 0; i <= n; i++) { if (ends && i > 0 && i < n) continue; const p = at(i / n); CITY.box(G, p[0], y0 - 0.1, p[1], w, hh + 0.1, w, ang, c, mat, 0); }
  };
  const cap = (th, c, mat) => CITY.box(G, m[0], y0 + h, m[1], Ln + 0.04, 0.07, th, ang, c, mat, 0);
  switch (f.type) {
    case 'mesh': { // welded mesh panels on square posts (green paint), see-through: posts and rails only
      const mc = tt(L.CORRUGATED, f.color || '#4b5a42', 0.8);
      for (const y of [0.08, h - 0.04]) CITY.box(G, m[0], y0 + y, m[1], Ln, 0.04, 0.04, ang, mc, L.CORRUGATED, 0, mc, L.CORRUGATED, 0);
      posts(2.5, 0.06, h, mc, L.CORRUGATED);
      break;
    }
    case 'rail': { // steel pipe railing, rusty brown paint
      const rc = tt(L.CORRUGATED, f.color || '#6b3b26', 0.8);
      for (const y of [0.55, h - 0.05]) CITY.box(G, m[0], y0 + y, m[1], Ln, 0.06, 0.06, ang, rc, L.CORRUGATED, 0, rc, L.CORRUGATED, 0);
      posts(2.2, 0.07, h, rc, L.CORRUGATED);
      break;
    }
    case 'block': {
      const c = tt(L.PRECAST, f.color || '#aaa69e', 0.95);
      body(0.2, c, L.PRECAST); posts(2.6, 0.4, h + 0.1, mulc(c, 0.96), L.PRECAST);
      break;
    }
    case 'stoneblock': {
      const c = tt(L.STONE, f.color || '#a3a19b', 0.95);
      body(0.25, c, L.STONE); posts(2.5, 0.45, h + 0.12, mulc(c, 0.92), L.STONE); cap(0.32, tt(L.PRECAST, '#8e8b85', 0.9), L.PRECAST);
      break;
    }
    case 'sheet': {
      const c = tt(L.CORRUGATED, f.color || '#5b3a2e', 0.85), fr = tt(L.CORRUGATED, '#2c2b2a', 0.8);
      body(0.05, c, L.CORRUGATED, 0, 0.04, h - 0.04); posts(Ln, 0.08, h, fr, L.CORRUGATED, true);
      CITY.box(G, m[0], y0 + h - 0.05, m[1], Ln, 0.05, 0.07, ang, fr, L.CORRUGATED, 0);
      break;
    }
    case 'wood': case 'slat': {
      const c = tt(L.PLASTER_ROUGH, f.color || '#6a4632', 0.9);
      body(0.04, c, L.PLASTER_ROUGH, f.type === 'wood' ? FT.PLANKS : FT.FENCE, 0.03, h - 0.03);
      posts(2.4, 0.1, h - 0.05, mulc(c, 0.8), L.PLASTER_ROUGH);
      break;
    }
    case 'wall': {
      const c = tt(L.PLASTER, f.color || '#d9cfbf', 0.92);
      body(0.3, c, L.PLASTER); cap(0.36, tt(L.PRECAST, f.cap || '#8f8a82', 0.9), L.PRECAST);
      break;
    }
    case 'stone': body(0.45, tt(L.STONE, f.color || '#a8977c', 0.95), L.STONE, 0, -0.1, h + 0.1); break;
    case 'brick': body(0.3, tt(L.BRICK, f.color || '#8a4a36', 1), L.BRICK); cap(0.34, tt(L.PRECAST, '#8f8a82', 0.9), L.PRECAST); break;
    case 'hedge': case 'creeper': {
      const c = tt(L.GRASS, f.color || (f.type === 'hedge' ? '#35522a' : '#6d3a2a'), 1);
      CITY.box(G, m[0], y0, m[1], Ln, h, f.type === 'hedge' ? 0.8 : 0.5, ang, c, L.GRASS, FT.FOLIAGE, c, L.GRASS, FT.FOLIAGE);
      break;
    }
    default: { // precast concrete panels slotted into posts
      body(0.12, tt(L.PRECAST, f.color || '#bfbab0', 0.9), L.PRECAST);
      posts(2.0, 0.22, h + 0.15, tt(L.PRECAST, '#a9a49a', 0.9), L.PRECAST);
    }
  }
  CITY.addEdge(a[0], a[1], b[0], b[1], h, 'wall');
}

// ------------------------------------------------------------------ exact panel-block facades
function sameSide(ring, i, j) { // edges i and j face the same way (both outward normals within 45 deg)
  const n = (q) => { const a = ring[q], b = ring[(q + 1) % ring.length], L0 = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; return [(b[1] - a[1]) / L0, -(b[0] - a[0]) / L0]; };
  const p = n(i), q = n(j); return p[0] * q[0] + p[1] * q[1] > 0.7;
}
// is the wall a->b glued to another building (probe just outside its middle)?
function gluedWall(bd, a, b) {
  const dx = b[0] - a[0], dz = b[1] - a[1], Ln = Math.hypot(dx, dz) || 1;
  const o = CITY.buildingAt((a[0] + b[0]) / 2 + dz / Ln * 0.6, (a[1] + b[1]) / 2 - dx / Ln * 0.6);
  return !!(o && o !== bd);
}
// timber lean-to against a block (weathered board cladding, flat slab roof); open = 'band' (slatted open upper part) | 'window'
function buildShed(bd, sc) {
  const G = CITY.tile(bd.c[0], bd.c[1]).b, ring = bd.p, base = bd.base, H = sc.fh || 2.8;
  const wood = tt(L.PLASTER_ROUGH, sc.wall, 0.95), dark = tt(L.PLASTER, '#161513'), glass = tt(L.PLASTER, '#2a3136'), frame = tt(L.PLASTER, '#d9d6cf', 0.9);
  let best = -1, bestL = 0; const glued = [];
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length], Ln = Math.hypot(b[0] - a[0], b[1] - a[1]);
    glued[i] = gluedWall(bd, a, b);
    if (!glued[i] && Ln > bestL) { bestL = Ln; best = i; }
  }
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length], dx = b[0] - a[0], dz = b[1] - a[1], Ln = Math.hypot(dx, dz);
    if (Ln < 0.05 || glued[i]) continue;
    const dn = [dz / Ln, 0, -dx / Ln], ang = Math.atan2(dz, dx);
    const P = (u, v, o = 0) => [a[0] + dx * u / Ln + dn[0] * o, base + v, a[1] + dz * u / Ln + dn[2] * o];
    const q = (u0, u1, v0, v1, c, lay, ft, o = 0) => G.quad(P(u0, v0, o), P(u1, v0, o), P(u1, v1, o), P(u0, v1, o), c, lay, ft, [u0, v0, Ln, 0], [u1, v0, Ln, 0], [u1, v1, Ln, 0], [u0, v1, Ln, 0], dn);
    CITY.addEdge(a[0], a[1], b[0], b[1], H, 'b');
    if (i === best && sc.open === 'band' && Ln > 3) {
      q(0, Ln, -0.2, 1.1, wood, L.PLASTER_ROUGH, FT.PLANKS);
      q(0, Ln, 2.3, H, wood, L.PLASTER_ROUGH, FT.PLANKS);
      q(0.25, Ln - 0.25, 1.1, 2.3, dark, L.PLASTER, 0, -0.35);                       // dark interior behind the open band
      q(0, 0.25, 1.1, 2.3, wood, L.PLASTER_ROUGH, FT.PLANKS); q(Ln - 0.25, Ln, 1.1, 2.3, wood, L.PLASTER_ROUGH, FT.PLANKS);
      const n = Math.max(2, Math.round((Ln - 0.5) / 0.45));
      for (let k = 1; k < n; k++) { const m = P(0.25 + (Ln - 0.5) * k / n, 0, -0.03); CITY.box(G, m[0], base + 1.1, m[2], 0.07, 1.2, 0.05, ang, wood, L.PLASTER_ROUGH, FT.PLANKS); }
    } else if (i === best && sc.open === 'window' && Ln > 3) {
      q(0, Ln, -0.2, H, wood, L.PLASTER_ROUGH, FT.PLANKS);
      const w0 = Ln - 2.1, d0 = 0.6;
      q(w0 - 0.06, w0 + 1.46, 0.94, 2.06, frame, L.PLASTER, 0, 0.02); q(w0, w0 + 1.4, 1.0, 2.0, glass, L.PLASTER, 0, 0.03);   // window
      q(d0 - 0.05, d0 + 0.95, -0.05, 2.1, dark, L.PLASTER, 0, 0.02); q(d0, d0 + 0.9, 0, 2.05, mulc(wood, 0.8), L.PLASTER_ROUGH, FT.PLANKS, 0.03); // door
    } else q(0, Ln, -0.2, H, wood, L.PLASTER_ROUGH, FT.PLANKS);
  }
  // slab roof over the oriented bounding box of the footprint (axis = longest free wall)
  const a = ring[Math.max(0, best)], b = ring[(Math.max(0, best) + 1) % ring.length], L0 = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  const ux = (b[0] - a[0]) / L0, uz = (b[1] - a[1]) / L0;
  let u0 = 1e9, u1 = -1e9, v0 = 1e9, v1 = -1e9;
  for (const p of ring) { const u = p[0] * ux + p[1] * uz, v = -p[0] * uz + p[1] * ux; u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, v); v1 = Math.max(v1, v); }
  const um = (u0 + u1) / 2, vm = (v0 + v1) / 2, cx = um * ux - vm * uz, cz = um * uz + vm * ux, rc = tt(L.PRECAST, sc.roofColor || '#6f6c66', 0.9);
  CITY.box(G, cx, base + H, cz, u1 - u0 + 0.3, 0.14, v1 - v0 + 0.3, Math.atan2(uz, ux), rc, L.PRECAST, 0, tt(L.GRAVEL_ROOF, '#5e5c58'), L.GRAVEL_ROOF, FT.FLATROOF);
}
// fuel-station canopy: slab on columns, white fascia with a coloured stripe, light soffit
function buildCanopy(bd, sc) {
  const G = CITY.tile(bd.c[0], bd.c[1]).b, ring = bd.p, base = bd.base, a = bd.ang * Math.PI / 180, ux = Math.cos(a), uz = Math.sin(a);
  let u0 = 1e9, u1 = -1e9, v0 = 1e9, v1 = -1e9;
  for (const p of ring) { const u = p[0] * ux + p[1] * uz, v = -p[0] * uz + p[1] * ux; u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, v); v1 = Math.max(v1, v); }
  const um = (u0 + u1) / 2, vm = (v0 + v1) / 2, cx = um * ux - vm * uz, cz = um * uz + vm * ux, L0 = u1 - u0, W0 = v1 - v0;
  const y0 = base + (sc.clear || 4.8), th = sc.th || 1.0;
  const band = tt(L.PLASTER, sc.color || '#f1f1ee', 0.9), stripe = tt(L.PLASTER, sc.stripe || '#f3c300', 0.95), soff = tt(L.PLASTER, sc.soffit || '#dddcd8', 0.85);
  const P4 = CITY.box(G, cx, y0, cz, L0, th, W0, a, band, L.PLASTER, 0, tt(L.PRECAST, '#9a9a96'), L.PRECAST, FT.FLATROOF);
  G.quad([P4[3][0], y0, P4[3][1]], [P4[2][0], y0, P4[2][1]], [P4[1][0], y0, P4[1][1]], [P4[0][0], y0, P4[0][1]], soff, L.PLASTER, 0, null, null, null, null, [0, -1, 0]);
  const sh = sc.stripeH || th * 0.35; CITY.box(G, cx, y0 + (th - sh) / 2, cz, L0 + 0.05, sh, W0 + 0.05, a, stripe, L.PLASTER, 0);
  const col = tt(L.PRECAST, sc.columns || '#b8b8b4', 0.9);
  for (const f of [0.25, 0.75]) {
    const x = cx + ux * (f - 0.5) * L0, z = cz + uz * (f - 0.5) * L0;
    CITY.box(G, x, base, z, 0.5, y0 - base, 0.5, a, col, L.PRECAST, 0); CITY.addObst(x, z, 0.4, 'b');
    const q = [x - uz * 1.6, z + ux * 1.6];   // pump island with a dispenser
    CITY.box(G, q[0], base, q[1], 3.2, 0.18, 1.0, a, tt(L.PRECAST, '#9c9c98'), L.PRECAST, 0);
    CITY.box(G, q[0], base + 0.18, q[1], 0.9, 1.9, 0.5, a, tt(L.PLASTER, sc.pump || '#e7e7e3', 0.9), L.PLASTER, 0, stripe, L.PLASTER, 0);
    CITY.addObst(q[0], q[1], 1.0, 'b');
  }
}
function buildOverride(bd) {
  bd._built = (bd._built || 0) + 1;
  if (bd.ov.kind === 'shed') return buildShed(bd, bd.ov);
  if (bd.ov.kind === 'canopy') return buildCanopy(bd, bd.ov);
  if (bd.ov.kind === 'karner') return buildKarner(bd, bd.ov);
  const sc = bd.ov, fh = sc.fh || 2.8, F = sc.floors, base = bd.base, eave = bd.eave, eaveY = base + eave;
  const G = CITY.tile(bd.c[0], bd.c[1]).b, ring = bd.p;
  const wmat = sc.mat === 'corrugated' ? L.CORRUGATED : L.PLASTER;
  const ftBase = sc.ft ?? FT.PANEL, panel = ftBase === FT.PANEL;
  const T = (hex) => tt(wmat, hex, wmat === L.CORRUGATED ? 1 : 0.92);
  const plinthTop = panel ? 0.9 : 0.45, baseV = -0.3;
  // street side = the wall facing the nearest road
  let bestI = -1, bestD = 1e9, maxL = 0;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length], dx = b[0] - a[0], dz = b[1] - a[1], Ln = Math.hypot(dx, dz); maxL = Math.max(maxL, Ln);
    if (Ln < 4) continue;
    const d = CITY.nearestRoadDist((a[0] + b[0]) / 2 + dz / Ln * 3, (a[1] + b[1]) / 2 - dx / Ln * 3, [1, 2, 3, 4, 5], 40).d;
    if (d < bestD) { bestD = d; bestI = i; }
  }
  const topV = sc.top ? (sc.top.h ? eave - sc.top.h : eave - sc.top.floors * fh - 0.15) : 1e9;
  const gTopV = sc.gableTop ? eave - sc.gableTop.floors * fh - 0.15 : topV;
  // block axis (from the footprint OBB) -> long facades get one continuous facade coordinate so the bay grid lines up
  const ax = Math.cos(bd.ang * Math.PI / 180), az = Math.sin(bd.ang * Math.PI / 180);
  let pMin = 1e9, pMax = -1e9; for (const v of ring) { const q = v[0] * ax + v[1] * az; pMin = Math.min(pMin, q); pMax = Math.max(pMax, q); }
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length], dx = b[0] - a[0], dz = b[1] - a[1], Ln = Math.hypot(dx, dz);
    if (Ln < 0.02) continue;
    const dn = [dz / Ln, 0, -dx / Ln];
    const along = Math.abs((dx * ax + dz * az) / Ln) > 0.7;
    const gable = panel ? !along : Ln < maxL * 0.6;
    const street = !sc.noStreet && (i === bestI || (bestI >= 0 && along && (dn[0] * ring[bestI][0] !== undefined) && sameSide(ring, i, bestI)));
    const ft = ftBase + (street ? FLAG.A : 0) + EXACT;
    // surveyed colour bands and loggia columns lying on this wall (world points within 0.9 m of the wall line)
    const onWall = (p) => { const t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / (Ln * Ln), d = Math.abs((p[0] - a[0]) * dz - (p[1] - a[1]) * dx) / Ln; return t > -0.03 && t < 1.03 && d < 0.9 ? t : null; };
    const bands = [], cols = [];
    for (const bb of sc.bands || []) { const t0 = onWall(bb.a), t1 = onWall(bb.b); if (t0 !== null && t1 !== null) bands.push({ t0: Math.min(t0, t1), t1: Math.max(t0, t1), v0: bb.v0 ?? plinthTop, color: bb.color || sc.green }); }
    for (const cc of sc.loggiaCols || []) { const t = onWall(cc.p); if (t !== null) { const hw = cc.w / 2 / Ln; cols.push({ t, w: cc.w }); bands.push({ t0: t - hw, t1: t + hw, v0: plinthTop, color: cc.color || sc.green }); } }
    const fe = (sc.blank || []).some(p => onWall(p) !== null) ? 0 : eave;   // eave 0 in the facade attribute = no openings
    // facade coordinate: global along the axis for long walls (u grows along a->b)
    const pa = a[0] * ax + a[1] * az, pb = b[0] * ax + b[1] * az, sgn = pb >= pa ? 1 : -1;
    // local facade coordinate from the building end (keeps shader precision), grid of exact 3 m bays
    const U0 = panel && along ? (sgn > 0 ? pa - pMin : pMax - pa) : 0, LwF = panel && along ? Math.max(15, Math.ceil((pMax - pMin) / 3) * 3) : Ln;
    const uA = U0, uB = U0 + Ln * (panel && along ? Math.abs((dx * ax + dz * az) / Ln) : 1);
    const k0 = panel && along ? Math.floor(uA / 3.0) : 0, k1 = panel && along ? Math.ceil(uB / 3.0) : 1;
    const vc = [baseV, plinthTop, Math.min(gable ? gTopV : topV, eave), eave, ...bands.map(bb => bb.v0).filter(v => v > plinthTop && v < eave)]
      .sort((p, q) => p - q).filter((v, j, arr) => j === 0 || v > arr[j - 1] + 0.01);
    const uOf = (t) => uA + t * (uB - uA);
    const cuts = []; for (const bb of bands) cuts.push(uOf(bb.t0), uOf(bb.t1));
    const bandAt = (um, v0) => { for (const bb of bands) if (um > Math.min(uOf(bb.t0), uOf(bb.t1)) && um < Math.max(uOf(bb.t0), uOf(bb.t1)) && v0 >= bb.v0 - 0.01) return bb.color; return null; };
    const paint = (k, v0) => {
      if (v0 < plinthTop - 0.01) return sc.plinth;
      if (gable) return v0 >= gTopV - 0.01 && sc.gableTop ? sc.gableTop.color : (v0 >= topV - 0.01 && sc.top ? sc.top.color : sc.gable);
      if (sc.top && v0 >= topV - 0.01) return sc.top.color;
      if (street && sc.stair && k % 6 === 3) return sc.stair;
      if (!street && sc.cols && k % 3 === 1) return sc.cols;
      return sc.wall;
    };
    const P = (u, v) => { const t = (u - uA) / (uB - uA || 1); return [a[0] + dx * t, base + v, a[1] + dz * t]; };
    const grid = panel && along;
    for (let k = k0; k < k1; k++) {
      const U0 = grid ? Math.max(uA, k * 3.0) : uA, U1 = grid ? Math.min(uB, (k + 1) * 3.0) : uB; if (U1 - U0 < 1e-3) continue;
      const kk = panel && along ? k : 0;
      const us = [U0, ...cuts.filter(c => c > U0 + 0.02 && c < U1 - 0.02), U1].sort((p, q) => p - q);
      for (let s = 0; s < us.length - 1; s++) {
        const u0 = us[s], u1 = us[s + 1], um = (u0 + u1) / 2;
        for (let j = 0; j < vc.length - 1; j++) {
          const v0 = vc[j], v1 = vc[j + 1], c = T(bandAt(um, v0) || paint(kk, v0));
          G.quad(P(u0, v0), P(u1, v0), P(u1, v1), P(u0, v1), c, wmat, ft, [u0, v0, LwF, fe], [u1, v0, LwF, fe], [u1, v1, LwF, fe], [u0, v1, LwF, fe], dn);
        }
      }
    }
    const nb = k1 - k0, bw = 3.0;
    if (sc.stripe && !gable) { // thin coloured stripe over the plinth
      const c = T(sc.stripe), Q = (u, v) => { const q = P(u, v); return [q[0] + dn[0] * 0.03, q[1], q[2] + dn[2] * 0.03]; };
      G.quad(Q(uA, plinthTop), Q(uB, plinthTop), Q(uB, plinthTop + 0.25), Q(uA, plinthTop + 0.25), c, wmat, 0, null, null, null, null, dn);
    }
    CITY.addEdge(a[0], a[1], b[0], b[1], eave, 'b');
    // ---- balconies
    const bal = sc.balcony;
    if (bal && !gable && Ln > 6 && (bal.sides === 'both' || (bal.sides === 'back' && !street) || (bal.sides === 'street' && street))) {
      const ang = Math.atan2(dz, dx), pc = tt(L.PLASTER, bal.color, 0.9), sc2 = tt(L.PRECAST, bal.slab || '#cfcfca', 0.85);
      for (let k = k0; k < k1; k++) {
        if (k % 3 !== 1 || (street && k % 6 === 3)) continue;
        if (k * 3.0 < uA + 0.4 || (k + 1) * 3.0 > uB - 0.4) continue;
        if (bal.every === 'first' && (k - k0) > 3) continue;
        const cx = (k + 0.5) * 3.0 - uA, w = 2.7, d = bal.depth;
        const tl = (uB - uA) / Ln;
        for (let f = 1; f < F; f++) {
          const y0 = base + f * fh - 0.02;
          const at = (o) => [a[0] + dx * cx / tl / Ln + dn[0] * o, a[1] + dz * cx / tl / Ln + dn[2] * o];
          const m = at(d / 2), fr = at(d - 0.04);
          CITY.box(G, m[0], y0, m[1], w, 0.14, d, ang, sc2, L.PRECAST, 0);                          // slab
          CITY.box(G, fr[0], y0 + 0.14, fr[1], w, 1.0, 0.08, ang, pc, L.PLASTER, 0);                // front parapet
          for (const e of [-1, 1]) { const s = [m[0] + dx / Ln * e * (w / 2 - 0.04), m[1] + dz / Ln * e * (w / 2 - 0.04)]; CITY.box(G, s[0], y0 + 0.14, s[1], 0.08, 1.0, d, ang, pc, L.PLASTER, 0); }
        }
      }
    }
    // ---- loggias: flush boxes with coloured parapet panels and white side frames on selected bays of each 6-bay section
    const lg = sc.loggia;
    if (lg && panel && along && Ln > 6 && (lg.sides === 'both' || (lg.sides === 'back') !== street)) {
      const ang = Math.atan2(dz, dx), pcol = tt(L.PLASTER, lg.color, 0.9), fcol = tt(L.PLASTER, lg.frame, 0.9), d = lg.depth;
      for (let k = k0; k < k1; k++) {
        if (!lg.bays.includes(((k % 6) + 6) % 6) || (street && k % 6 === 3)) continue;
        if (k * 3.0 < uA + 0.3 || (k + 1) * 3.0 > uB - 0.3) continue;
        const t = ((k + 0.5) * 3.0 - uA) / (uB - uA), w = 2.85;
        const at = (o, e = 0) => [a[0] + dx * t + dn[0] * o + dx / Ln * e, a[1] + dz * t + dn[2] * o + dz / Ln * e];
        for (let f = 0; f < F; f++) {
          const y0 = base + (f === 0 ? 0.9 : f * fh);
          const fr = at(d - 0.05), m = at(d / 2);
          CITY.box(G, fr[0], y0, fr[1], w - 0.24, 1.0, 0.1, ang, pcol, L.PLASTER, 0, fcol, L.PLASTER, 0);          // parapet panel
          CITY.box(G, m[0], y0 - 0.12, m[1], w, 0.12, d, ang, fcol, L.PLASTER, 0);                              // slab edge
          for (const e of [-1, 1]) { const q = at(d / 2, e * (w / 2 - 0.06)); CITY.box(G, q[0], y0 - 0.12, q[1], 0.12, fh, d, ang, fcol, L.PLASTER, 0); }
        }
      }
    }
    // ---- stacked loggia column on one exterior gable (green frames)
    const gl = sc.gableLoggia;
    if (gl && gable && Ln > 6 && ((gl.side === 'south' && dn[2] > 0.5) || (gl.side === 'north' && dn[2] < -0.5))) {
      const mid = [(a[0] + b[0]) / 2 + dn[0] * 1.5, (a[1] + b[1]) / 2 + dn[2] * 1.5], other = CITY.buildingAt(mid[0], mid[1]);
      if (!other || !other.ov) {
        const ang = Math.atan2(dz, dx), fc = tt(L.PLASTER, gl.frame, 0.9), pc = tt(L.PLASTER, gl.parapet, 0.9), d = 1.25, w = 3.4;
        const at = (o, e = 0) => [(a[0] + b[0]) / 2 + dn[0] * o + dx / Ln * e, (a[1] + b[1]) / 2 + dn[2] * o + dz / Ln * e];
        for (const e of [-1, 1]) { const q = at(d / 2, e * (w / 2 - 0.15)); CITY.box(G, q[0], base + 0.9, q[1], 0.3, eave - 0.9, d, ang, fc, L.PLASTER, 0); }
        const tp = at(d / 2); CITY.box(G, tp[0], base + eave - 0.35, tp[1], w, 0.35, d, ang, fc, L.PLASTER, 0);
        for (let f = 1; f < F; f++) {
          const y0 = base + f * fh, m = at(d / 2), fr = at(d - 0.06);
          CITY.box(G, m[0], y0 - 0.14, m[1], w - 0.6, 0.14, d, ang, pc, L.PRECAST, 0);
          CITY.box(G, fr[0], y0, fr[1], w - 0.6, 1.0, 0.08, ang, pc, L.PLASTER, 0);
        }
      }
    }
    // ---- surveyed loggia columns: full-height side fins in the accent colour, balcony slabs and grey railings on every storey
    for (const cc of cols) {
      const ang = Math.atan2(dz, dx), fc = tt(L.PLASTER, sc.green, 0.9), rc = tt(L.PLASTER, sc.railing || '#b4babe', 0.9), sl = tt(L.PRECAST, '#b9bcbc', 0.9), d = 1.2, w = cc.w;
      const at = (o, e = 0) => [a[0] + dx * cc.t + dn[0] * o + dx / Ln * e, a[1] + dz * cc.t + dn[2] * o + dz / Ln * e];
      for (const e of [-1, 1]) { const q = at(d / 2, e * (w / 2 - 0.13)); CITY.box(G, q[0], base - 0.2, q[1], 0.26, eave + 0.2, d, ang, fc, L.PLASTER, 0, fc, L.PLASTER, 0); }
      const tp = at(d / 2); CITY.box(G, tp[0], base + eave - 0.3, tp[1], w, 0.3 + (panel ? 0.7 : 0.35), d, ang, fc, L.PLASTER, 0, tt(L.PRECAST, '#8e8c86'), L.PRECAST, 0);
      for (let f = 1; f < F; f++) {
        const y0 = base + f * fh, m = at(d / 2), fr = at(d - 0.05);
        CITY.box(G, m[0], y0 - 0.16, m[1], w - 0.5, 0.16, d, ang, sl, L.PRECAST, 0);
        CITY.box(G, fr[0], y0, fr[1], w - 0.5, 1.05, 0.06, ang, rc, L.CORRUGATED, 0, rc, L.CORRUGATED, 0);
      }
      const e0 = at(d, -w / 2), e1 = at(d, w / 2); CITY.addEdge(e0[0], e0[1], e1[0], e1[1], eave, 'b');
    }
    // ---- surveyed entrances: dark door leaf and a precast canopy
    for (const dr of sc.doors || []) {
      const t = onWall(dr.p); if (t === null) continue;
      const u = uOf(t), w = dr.w || 1.8, dc = tt(L.PLASTER, '#2b2c2d');
      const Po = (uu, v) => { const p = P(uu, v); return [p[0] + dn[0] * 0.03, p[1], p[2] + dn[2] * 0.03]; };
      G.quad(Po(u - w / 2, -0.1), Po(u + w / 2, -0.1), Po(u + w / 2, 2.4), Po(u - w / 2, 2.4), dc, L.PLASTER, 0, null, null, null, null, dn);
      const m = [a[0] + dx * t + dn[0] * 0.8, a[1] + dz * t + dn[2] * 0.8];
      CITY.box(G, m[0], base + 2.75, m[1], w + 0.9, 0.16, 1.6, Math.atan2(dz, dx), tt(L.PRECAST, '#8e9092'), L.PRECAST, 0);
    }
    // ---- entrance canopies over the stair doors
    if (panel && street && along) for (let k = k0; k < k1; k++) {
      if (k % 6 !== 3 || k * 3.0 < uA + 0.4 || (k + 1) * 3.0 > uB - 0.4) continue;
      const t = ((k + 0.5) * 3.0 - uA) / (uB - uA), m = [a[0] + dx * t + dn[0] * 0.7, a[1] + dz * t + dn[2] * 0.7];
      CITY.box(G, m[0], base + 2.75, m[1], 2.6, 0.16, 1.4, Math.atan2(dz, dx), tt(L.PRECAST, '#8e9092'), L.PRECAST, 0);
    }
  }
  // ---- roof
  const roofT = sc.roof === 'white' ? tt(L.CORRUGATED, '#d9dcdc') : tt(L.GRAVEL_ROOF, '#6a6862');
  G.poly(ring, bd.holes || [], eaveY, roofT, sc.roof === 'white' ? L.CORRUGATED : L.GRAVEL_ROOF, sc.roof === 'white' ? FT.METALROOF : FT.FLATROOF);
  const cop = tt(L.PRECAST, '#8e8c86'), ph = panel ? 0.7 : 0.35, wall = T(sc.top ? sc.top.color : sc.wall);
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length], Ln = Math.hypot(b[0] - a[0], b[1] - a[1]); if (Ln < 0.05) continue;
    const dn = [(b[1] - a[1]) / Ln, 0, -(b[0] - a[0]) / Ln];
    G.quad([a[0], eaveY, a[1]], [b[0], eaveY, b[1]], [b[0], eaveY + ph, b[1]], [a[0], eaveY + ph, a[1]], wall, wmat, 0, null, null, null, null, dn);
    G.quad([a[0], eaveY + ph, a[1]], [b[0], eaveY + ph, b[1]], [b[0] - dn[0] * 0.3, eaveY + ph, b[1] - dn[2] * 0.3], [a[0] - dn[0] * 0.3, eaveY + ph, a[1] - dn[2] * 0.3], cop, L.PRECAST, 0, null, null, null, null, [0, 1, 0]);
    G.quad([b[0] - dn[0] * 0.3, eaveY + ph, b[1] - dn[2] * 0.3], [a[0] - dn[0] * 0.3, eaveY + ph, a[1] - dn[2] * 0.3], [a[0] - dn[0] * 0.3, eaveY, a[1] - dn[2] * 0.3], [b[0] - dn[0] * 0.3, eaveY, b[1] - dn[2] * 0.3], wall, wmat, 0, null, null, null, null, [-dn[0], 0, -dn[2]]);
  }
  if (sc.fascia) for (let i = 0; i < ring.length; i++) { // white fascia band under the roof edge (shop annexes)
    const a = ring[i], b = ring[(i + 1) % ring.length], Ln = Math.hypot(b[0] - a[0], b[1] - a[1]); if (Ln < 0.3 || gluedWall(bd, a, b)) continue;
    const dn = [(b[1] - a[1]) / Ln, 0, -(b[0] - a[0]) / Ln], o = 0.06, fc = tt(L.PLASTER, sc.fascia, 0.9);
    const Q = (p, y) => [p[0] + dn[0] * o, y, p[1] + dn[2] * o];
    G.quad(Q(a, eaveY - 0.5), Q(b, eaveY - 0.5), Q(b, eaveY + ph + 0.02), Q(a, eaveY + ph + 0.02), fc, L.PLASTER, 0, null, null, null, null, dn);
  }
  const RP = CITY.roofPlanes({ ang: bd.ang, roof: 1, rh: 1 }, ring);
  if (panel && F >= 6) CITY.box(G, bd.c[0], eaveY, bd.c[1], 3.4, 2.4, 2.8, bd.ang * Math.PI / 180, T(sc.wall), wmat, 0, tt(L.GRAVEL_ROOF, '#5e5c58'), L.GRAVEL_ROOF, FT.FLATROOF);
  if (sc.roof === 'solar') { // rows of PV panels along the long axis
    const ux = RP.ux, uz = RP.uz, vx = RP.vx, vz = RP.vz, len = RP.L - 3;
    for (let v = RP.vmin + 2; v < RP.vmax - 2; v += 3.2) {
      const um = (RP.umin + RP.umax) / 2, c0 = [um * ux + v * vx, um * uz + v * vz];
      const h0 = eaveY + 0.35, h1 = eaveY + 0.8, dpt = 1.7;
      const p = (u, w, h) => [c0[0] + ux * u + vx * w, h, c0[1] + uz * u + vz * w];
      G.quad(p(-len / 2, 0, h0), p(len / 2, 0, h0), p(len / 2, dpt, h1), p(-len / 2, dpt, h1), [1, 1, 1], L.PRECAST, FT.SOLAR, [0, 0, 0, 0], [len, 0, 0, 0], [len, 1.7, 0, 0], [0, 1.7, 0, 0], [0, 1, 0]);
    }
  }
}

// ------------------------------------------------------------------ props (after buildCity, before flush): streams and bin enclosures
export function buildDistrictProps() {
  if (!CITY.over) return;
  for (const s of CITY.over.streams) {
    const p = s.p, wl = offsetLine(p, s.w / 2), wr = offsetLine(p, -s.w / 2);
    const mud = tt(L.FOREST, '#3a3528'), reed = tt(L.GRASS, '#3d4c25');
    for (let i = 0; i < p.length - 1; i++) {
      CITY.water.quad([wl[i][0], 0.045, wl[i][1]], [wl[i + 1][0], 0.045, wl[i + 1][1]], [wr[i + 1][0], 0.045, wr[i + 1][1]], [wr[i][0], 0.045, wr[i][1]], [1, 1, 1], 0, 0, null, null, null, null, [0, 1, 0]);
      const Gf = CITY.tile(p[i][0], p[i][1]).f, Gb = CITY.tile(p[i][0], p[i][1]).b;
      CITY.ribbonSeg(Gf, p[i], p[i + 1], s.w + 2.0, 0.03, mud, L.FOREST, FT.PATH, [0, 0, 0, 0]);
      // reeds and rough grass on both banks
      const dx = p[i + 1][0] - p[i][0], dz = p[i + 1][1] - p[i][1], Ln = Math.hypot(dx, dz); if (Ln < 0.3) continue;
      for (const e of [1, -1]) {
        const o = e * (s.w / 2 + 1.0), m = [(p[i][0] + p[i + 1][0]) / 2 - dz / Ln * o, (p[i][1] + p[i + 1][1]) / 2 + dx / Ln * o];
        CITY.box(Gb, m[0], 0.02, m[1], Ln + 0.4, 0.55 + hash(i * 7 + (e > 0 ? 1 : 2)) * 0.4, 0.8, Math.atan2(dz, dx), reed, L.GRASS, FT.FOLIAGE, reed, L.GRASS, FT.FOLIAGE);
      }
    }
  }
  for (const f of CITY.over.fences) for (const [a, b] of fenceRuns(f)) drawFence(f, a, b);
  const wallC = tt(L.PRECAST, '#b8b3a8', 0.9), binC = ['#1f5aa6', '#e2c019', '#2f7d3a', '#2a2b2d'];
  for (const [x, z, a, style] of CITY.over.bins) {
    const G = CITY.tile(x, z).b, cs = Math.cos(a), sn = Math.sin(a);
    const P = (u, v) => [x + u * cs - v * sn, z + u * sn + v * cs];
    const back = P(0, -0.9), l = P(-2.1, 0), r = P(2.1, 0);
    if (!style) { // precast enclosure with four coloured 1100 l containers
      CITY.box(G, back[0], 0, back[1], 4.4, 1.5, 0.2, a, wallC, L.PRECAST, 0);
      CITY.box(G, l[0], 0, l[1], 0.2, 1.5, 1.8, a, wallC, L.PRECAST, 0);
      CITY.box(G, r[0], 0, r[1], 0.2, 1.5, 1.8, a, wallC, L.PRECAST, 0);
      for (let i = 0; i < 4; i++) {
        const b = P(-1.5 + i, -0.25), c = tt(L.PRECAST, binC[i], 0.8);
        CITY.box(G, b[0], 0.05, b[1], 0.9, 1.25, 1.1, a, c, L.PRECAST, 0, mulc(c, 0.85), L.PRECAST, 0);
      }
    } else { // open row by the kerb ('open': glass bell, paper, mixed, textile box) or behind a chain-link fence ('mesh')
      const kinds = style === 'mesh' ? [['#1f2022', 1.3, 1.3], ['#1f2022', 1.3, 1.3], ['#5e4128', 0.7, 1.05], ['#2f7d3a', 1.4, 1.5]]
        : style === 'recycle' ? [['#2f7d3a', 1.4, 1.5], ['#e2c019', 1.3, 1.3], ['#1f5aa6', 1.3, 1.3]]
        : [['#2f7d3a', 1.4, 1.5], ['#1f5aa6', 1.3, 1.3], ['#1f2022', 1.3, 1.3], ['#e3e3df', 1.2, 1.9]];
      let u = -2.1;
      for (const [hex, w, h] of kinds) {
        const b = P(u + w / 2, -0.2), c = tt(L.PLASTER, hex, 0.8); u += w + 0.15;   // smooth plastic containers
        CITY.box(G, b[0], 0.05, b[1], w, h, 1.1, a, c, L.PLASTER, 0, mulc(c, 0.85), L.PLASTER, 0);
      }
      if (style === 'mesh') { // green chain-link fence on posts behind and at the sides
        const mc = tt(L.CORRUGATED, '#3f5a3a', 0.8);
        for (const [p, q] of [[P(-2.4, -0.9), P(2.4, -0.9)], [P(-2.4, -0.9), P(-2.4, 0.9)], [P(2.4, -0.9), P(2.4, 0.9)]]) {
          const ddx = q[0] - p[0], ddz = q[1] - p[1], Ln = Math.hypot(ddx, ddz), ang = Math.atan2(ddz, ddx);
          for (const y of [0.05, 1.55]) CITY.box(G, (p[0] + q[0]) / 2, y, (p[1] + q[1]) / 2, Ln, 0.05, 0.05, ang, mc, L.CORRUGATED, 0);
          for (let t = 0; t <= Ln + 0.01; t += 1.2) CITY.box(G, p[0] + ddx * t / Ln, 0, p[1] + ddz * t / Ln, 0.06, 1.6, 0.06, ang, mc, L.CORRUGATED, 0);
          for (let t = 0.2; t < Ln; t += 0.2) CITY.box(G, p[0] + ddx * t / Ln, 0.1, p[1] + ddz * t / Ln, 0.012, 1.45, 0.012, ang, mc, L.CORRUGATED, 0);
        }
      }
    }
    CITY.addObst(x, z, 2.2, 'b');
  }
  buildLots(); buildRetail(CITY.over.retail); buildPylons(CITY.over.pylons); buildBillboards(CITY.over.billboards);
  buildFurniture(CITY.over.furniture);
  const LM = CITY.over.landmarks;
  if (LM.michalTower) buildMichalTower(LM.michalTower);
  if (LM.plagueColumn) buildPlagueColumn(LM.plagueColumn);
  // hand-placed boxes: shop signs, air-conditioning units, ... ('onWall' snaps the box flat onto the nearest building wall)
  for (const p of CITY.over.props) {
    let pos = p.p, ang = p.ang || 0;
    if (p.onWall) {
      let best = null;
      for (const bd of CITY.bgrid.query(pos[0] - 20, pos[1] - 20, pos[0] + 20, pos[1] + 20, [])) for (let i = 0; i < bd.p.length; i++) {
        const a = bd.p[i], b = bd.p[(i + 1) % bd.p.length], dx = b[0] - a[0], dz = b[1] - a[1], L2 = dx * dx + dz * dz; if (L2 < 1) continue;
        const t = Math.max(0, Math.min(1, ((pos[0] - a[0]) * dx + (pos[1] - a[1]) * dz) / L2)), d = Math.hypot(pos[0] - a[0] - dx * t, pos[1] - a[1] - dz * t);
        if (!best || d < best.d) best = { a, dx, dz, t, d, Ln: Math.sqrt(L2) };
      }
      if (best) {
        const { a, dx, dz, t, Ln } = best, n = [dz / Ln, -dx / Ln], o = p.d / 2 + 0.03 + (p.dd || 0), du = p.du || 0;
        pos = [a[0] + dx * t + dx / Ln * du + n[0] * o, a[1] + dz * t + dz / Ln * du + n[1] * o]; ang = Math.atan2(dz, dx);
      }
    }
    const G = CITY.tile(pos[0], pos[1]).b, lay = p.layer ?? L.PLASTER, c = tt(lay, p.color, 0.9);
    CITY.box(G, pos[0], (p.y ?? 0) + (p.onWall ? CITY.groundH(pos[0], pos[1]) : 0), pos[1], p.w, p.h, p.d, ang, c, lay, 0, p.top ? tt(lay, p.top, 0.9) : c, lay, 0);
  }
}
