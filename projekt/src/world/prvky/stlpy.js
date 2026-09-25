// Line poles (electricity, telephone, radio) and the wires between them, plus the data pass for the
// district `lamps` key (manual street lamps, drawn by the instanced lamp builder in props.js).
import { CITY } from '../city.js';
import { L, FT, tintFor } from '../../render/materials.js';
import { col, mulc } from '../../core/util.js';
import { S } from '../../core/state.js';
import { dirAng } from './znacky.js';

const tt = (layer, hex, k = 1) => tintFor(layer, mulc(col(hex), k));

// ------------------------------------------------------------------ data pass: lamps + clearLamps
// clearLamps: rectangles [x1, z1, x2, z2] in which the lamps coming from the map data are removed.
export function clearMapLamps(D, rects) {
  if (!rects || !rects.length) return;
  const inside = (x, z) => rects.some(r => x > Math.min(r[0], r[2]) && x < Math.max(r[0], r[2]) && z > Math.min(r[1], r[3]) && z < Math.max(r[1], r[3]));
  const out = [];
  for (let i = 0; i < D.lamps.length; i += 3) if (!inside(D.lamps[i] / 10, D.lamps[i + 1] / 10)) out.push(D.lamps[i], D.lamps[i + 1], D.lamps[i + 2]);
  D.lamps = out;
}
// district `lamps`: { p, dir, t, h, arm, color } -> the extended D.lampsX list read by props.js
export function applyLamps(D, list) {
  if (!list || !list.length) return;
  D.lampsX = D.lampsX || [];
  for (const l of list) {
    if (!l.p) continue;
    const [x, z] = l.p;
    // a lamp surveyed twice (the same post also entered as lots.lamps, which is how districts show it today)
    // must not be built twice: the richer district entry wins
    for (let i = D.lampsX.length - 1; i >= 0; i--) {
      const q = D.lampsX[i], qx = Array.isArray(q) ? q[0] : q.x, qz = Array.isArray(q) ? q[1] : q.z;
      if (Math.hypot(qx - x, qz - z) < 1.0) D.lampsX.splice(i, 1);
    }
    D.lampsX.push({ x, z, a: dirAng(l.dir || 0), t: l.t || 'street', h: l.h, arm: l.arm, color: l.color });
  }
}

// ------------------------------------------------------------------ poles
const POLE = {
  concrete: { r: 0.11, top: 0.075, hex: '#b4b0a8', mat: L.PRECAST, ft: 0, sides: 4 },
  wood: { r: 0.115, top: 0.085, hex: '#6b5133', mat: L.BARK, ft: 0, sides: 8 },
  steel: { r: 0.085, top: 0.06, hex: '#8d9296', mat: L.PRECAST, ft: FT.STEEL, sides: 8 },
  lattice: { r: 0.32, top: 0.16, hex: '#8d9296', mat: L.PRECAST, ft: FT.STEEL, sides: 4 },
};
// attachment points of n conductors on a pole, spread over the crossarm(s)
function attachPoints(P, n) {
  const out = [], rows = P.arms >= 2 && n > 2 ? 2 : 1, per = Math.ceil(n / rows);
  const w = Math.min(1.6, 0.42 * Math.max(1, per - 1)) || 0.3;
  for (let i = 0; i < n; i++) {
    const row = rows === 1 ? 0 : Math.floor(i / per), k = i - row * per, m = Math.min(per, n - row * per);
    const t = m <= 1 ? 0 : (k / (m - 1) - 0.5) * w;
    out.push([P.x + P.u[0] * t, P.h - row * 0.85 - 0.12, P.z + P.u[1] * t]);
  }
  return out;
}
// build the poles; `dirOf` gives the mean direction of the wires at a pole so the crossarm stands across it
export function buildPoles(list, anchors, dirOf) {
  for (const p of list || []) {
    if (!p.p) continue;
    const [x, z] = p.p, gy = CITY.groundH(x, z), h = p.h ?? 9, T = POLE[p.t] || POLE.concrete;
    const d = dirOf(p.id) || [1, 0];
    const u = [-d[1], d[0]];                                  // crossarm across the line
    const G = CITY.tile(x, z).b, c = tt(T.mat, p.color || T.hex, 0.95), ang = Math.atan2(u[1], u[0]);
    if (p.t === 'lattice') {                                   // four legs with a lacing pattern
      const steel = tt(L.PRECAST, p.color || T.hex, 0.85);
      for (const [a, b] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        const q = [x + (u[0] * a - u[1] * b) * T.r, z + (u[1] * a + u[0] * b) * T.r];
        CITY.box(G, q[0], gy - 0.1, q[1], 0.07, h + 0.1, 0.07, ang, steel, L.PRECAST, FT.STEEL);
      }
      for (let y = 0.6; y < h; y += 1.4) CITY.box(G, x, gy + y, z, T.r * 2.1, 0.05, T.r * 2.1, ang, steel, L.PRECAST, FT.STEEL);
    } else CITY.cylinder(G, x, gy - 0.15, z, T.r, h + 0.15, T.sides, c, T.mat, T.ft);
    const P = { x, z, h: gy + h, u, arms: p.arms ?? 1, r: T.r, t: p.t };
    for (let a = 0; a < (p.arms ?? 1); a++) {                  // crossarms
      const y = gy + h - a * 0.85 - 0.12;
      CITY.box(G, x, y, z, 1.7, 0.09, 0.1, ang, tt(L.PRECAST, '#6f6a62', 0.9), L.PRECAST, FT.STEEL);
      for (const sg of [-1, 1]) {                              // insulators
        const q = [x + u[0] * sg * 0.6, z + u[1] * sg * 0.6];
        CITY.cylinder(G, q[0], y + 0.09, q[1], 0.05, 0.14, 6, tt(L.PLASTER, '#cfd3d0', 0.9), L.PLASTER, 0);
      }
    }
    if (p.id) anchors.poles[p.id] = P;
    CITY.addObst(x, z, T.r + 0.05, 'm');
  }
}

// ------------------------------------------------------------------ wires
// one catenary step: a horizontal and a vertical ribbon (both sides), so the wire is visible from everywhere
function wireSeg(G, p, q, r, c) {
  const dx = q[0] - p[0], dz = q[2] - p[2], hl = Math.hypot(dx, dz) || 1, sx = -dz / hl * r, sz = dx / hl * r;
  for (const s of [1, -1]) {
    G.quad([p[0] + sx, p[1], p[2] + sz], [q[0] + sx, q[1], q[2] + sz], [q[0] - sx, q[1], q[2] - sz], [p[0] - sx, p[1], p[2] - sz],
      c, L.PRECAST, FT.STEEL, null, null, null, null, [0, s, 0]);
    G.quad([p[0], p[1] + r, p[2]], [q[0], q[1] + r, q[2]], [q[0], q[1] - r, q[2]], [p[0], p[1] - r, p[2]],
      c, L.PRECAST, FT.STEEL, null, null, null, null, [sx * s, 0, sz * s]);
  }
}
// a: pole id, b: pole id or [x, z, y] on a facade; n = number of conductors, drawn as sagging catenaries
export function buildWires(list, anchors) {
  const seg = S.quality === 'low' ? 4 : 8, wc = tt(L.PRECAST, '#2a2b2c', 0.8);
  for (const w of list || []) {
    const n = Math.max(1, w.n || 2);
    const A = endPoints(w.a, anchors, n), B = endPoints(w.b, anchors, n);
    if (!A || !B) continue;
    for (let i = 0; i < n; i++) {
      const a = A[i], b = B[i], Ln = Math.hypot(b[0] - a[0], b[2] - a[2]);
      const sag = Math.max(0.12, Ln * 0.028);
      const G = CITY.tile(a[0], a[2]).b;
      let prev = a;
      for (let k = 1; k <= seg; k++) {
        const t = k / seg;
        const q = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - sag * 4 * t * (1 - t), a[2] + (b[2] - a[2]) * t];
        wireSeg(G, prev, q, 0.016, wc);
        prev = q;
      }
    }
  }
}
function endPoints(e, anchors, n) {
  if (Array.isArray(e)) {                                      // house connection: [x, z, y]
    const out = [], y = e[2] ?? 6.0;
    for (let i = 0; i < n; i++) out.push([e[0], y - (i - (n - 1) / 2) * 0.18, e[1]]);
    return out;
  }
  const P = anchors.poles[e];
  if (!P) return null;
  return attachPoints(P, n).map(q => [q[0], q[1], q[2]]);
}
// mean direction of the wires meeting at each pole (used to turn the crossarms across the line)
export function wireDirs(poles, wires) {
  const pos = {}, acc = {};
  for (const p of poles || []) if (p.id && p.p) pos[p.id] = p.p;
  for (const w of wires || []) {
    const A = pos[w.a], B = Array.isArray(w.b) ? [w.b[0], w.b[1]] : pos[w.b];
    if (!A || !B) continue;
    const d = [B[0] - A[0], B[1] - A[1]], Ln = Math.hypot(d[0], d[1]) || 1;
    for (const [id, s] of [[w.a, 1], [Array.isArray(w.b) ? null : w.b, -1]]) {
      if (!id) continue;
      const a = acc[id] || (acc[id] = [0, 0]);
      a[0] += d[0] / Ln * s; a[1] += d[1] / Ln * s;
    }
  }
  return (id) => {
    const a = acc[id];
    if (!a) return null;
    const Ln = Math.hypot(a[0], a[1]);
    return Ln < 1e-3 ? null : [a[0] / Ln, a[1] / Ln];
  };
}
