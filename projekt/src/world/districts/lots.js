// Surveyed car parks: aisle surfaces, bay rows (concrete pavers with red paver lines, or asphalt with white paint),
// kerbed islands with grass / hedges, sidewalks, parked cars, car-park lamps, trees, trolley shelters and billboards.
// Everything is placed in a local frame F = { o:[x,z], u:[ux,uz] }: s runs along u, d along n = (-uz, ux).
import { col, mulc, pip } from '../../core/util.js';
import { L, FT, FLAG, tintFor } from '../../render/materials.js';
import { CITY } from '../city.js';

const tt = (layer, hex, k = 1) => tintFor(layer, mulc(col(hex), k));
export const frame = (F) => { const n = [-F.u[1], F.u[0]]; return { W: (s, d) => [F.o[0] + F.u[0] * s + n[0] * d, F.o[1] + F.u[1] * s + n[1] * d], u: F.u, n }; };
const MATS = {
  asphalt: [L.ASPHALT, '#5a5a57'], asphaltL: [L.ASPHALT, '#686865'], pavers: [L.PAVERS, '#8f8e8a'], walk: [L.PAVERS, '#a0948b'],
  grass: [L.GRASS, '#56743a'], redline: [L.PAVERS, '#8a4535'], white: [L.ASPHALT, '#c9c9c3'], gravel: [L.DIRT, '#8b8275'],
  setts: [L.COBBLE, '#77726a'], settsDark: [L.COBBLE, '#4f4d4a'], stone: [L.STONE, '#c9c2b2'],
};
const rect = (W, s, d) => [W(s[0], d[0]), W(s[1], d[0]), W(s[1], d[1]), W(s[0], d[1])];
// rounded rectangle in frame coordinates (r clamps to half the short side: fully round ends)
function rrect(W, s, d, r) {
  const hs = (s[1] - s[0]) / 2, hd = (d[1] - d[0]) / 2; r = Math.min(r || 0, hs, hd);
  if (r < 0.05) return rect(W, s, d);
  const out = [], cs = [[s[1] - r, d[0] + r, -Math.PI / 2], [s[1] - r, d[1] - r, 0], [s[0] + r, d[1] - r, Math.PI / 2], [s[0] + r, d[0] + r, Math.PI]];
  for (const [cs0, cd0, a0] of cs) for (let i = 0; i <= 5; i++) { const a = a0 + i / 5 * Math.PI / 2; out.push(W(cs0 + Math.cos(a) * r, cd0 + Math.sin(a) * r)); }
  return out;
}
const gy = (dy) => (x, z) => CITY.groundH(x, z) + dy;
const centroid = (P) => [P.reduce((a, p) => a + p[0], 0) / P.length, P.reduce((a, p) => a + p[1], 0) / P.length];

// ------------------------------------------------------------------ data pass (trees, cars, lamps, dropped OSM areas)
export function applyLots(D, Z, over, R) {
  const LT = Z.lots; if (!LT) return;
  const F = {}; for (const k in LT.frames) F[k] = frame(LT.frames[k]);
  // OSM car-park polygons replaced by the survey (matched by a point inside them)
  if (LT.dropAreas) D.a = D.a.filter(a => {
    const k = D.ak[a[0]]; if (k !== 'parking') return true;
    const P = []; let x = a[1][0], z = a[1][1]; P.push([x / 10, z / 10]); for (let j = 2; j < a[1].length; j += 2) { x += a[1][j]; z += a[1][j + 1]; P.push([x / 10, z / 10]); }
    return !LT.dropAreas.some(q => pip(q[0], q[1], P));
  });
  // procedural parked cars and trees inside the surveyed lots go away
  const clear = (LT.clear || []).map(c => c.f ? rect(F[c.f].W, c.s, c.d) : c.ring);
  const inClear = (x, z) => clear.some(P => pip(x, z, P));
  const cars = []; for (let i = 0; i < D.cars.length; i += 4) if (!inClear(D.cars[i] / 10, D.cars[i + 1] / 10)) cars.push(D.cars[i], D.cars[i + 1], D.cars[i + 2], D.cars[i + 3]);
  const trees = []; for (let i = 0; i < D.t.length; i += 3) if (!inClear(D.t[i] / 10, D.t[i + 1] / 10)) trees.push(D.t[i], D.t[i + 1], D.t[i + 2]);
  // cars in the surveyed bays
  for (const b of LT.bays || []) {
    if (!b.fill) continue;
    const f = F[b.f], ax = b.axis || 's', every = b.every || 2.5, [a0, a1] = ax === 's' ? b.s : b.d, [c0, c1] = ax === 's' ? b.d : b.s;
    const n = Math.floor((a1 - a0) / every + 1e-6);
    for (let i = 0; i < n; i++) {
      const t = a0 + (i + 0.5) * every;
      if ((b.skip || []).some(([p, q]) => t > p && t < q) || R() > b.fill) continue;
      for (const half of b.double ? [[c0, (c0 + c1) / 2, 1], [(c0 + c1) / 2, c1, -1]] : [[c0, c1, b.nose || 1]]) {   // nose-in: front away from the aisle
        if (b.double && R() > b.fill) continue;
        const m = (half[0] + half[1]) / 2 + (R() - 0.5) * 0.25, p = ax === 's' ? f.W(t + (R() - 0.5) * 0.2, m) : f.W(m, t + (R() - 0.5) * 0.2);
        const dir = ax === 's' ? f.n : f.u, sg = (half[2] || 1) * (R() < 0.8 ? 1 : -1);   // most cars park nose-in
        const ang = Math.atan2(dir[1] * sg, dir[0] * sg) + (R() - 0.5) * 0.05;
        cars.push(Math.round(p[0] * 10), Math.round(p[1] * 10), Math.round(ang * 180 / Math.PI + 360) % 360, Math.floor(R() * 16));
      }
    }
  }
  D.cars = cars;
  if (LT.clearLamps) { const l = []; for (let i = 0; i < D.lamps.length; i += 3) if (!inClear(D.lamps[i] / 10, D.lamps[i + 1] / 10)) l.push(D.lamps[i], D.lamps[i + 1], D.lamps[i + 2]); D.lamps = l; }
  for (const t of LT.trees || []) { const p = t.p || F[t.f].W(t.s, t.d); trees.push(Math.round(p[0] * 10), Math.round(p[1] * 10), t.k); }
  for (const is of LT.islands || []) for (const b of is.bushes || []) { const p = is.f ? F[is.f].W(b[0], b[1]) : b; trees.push(Math.round(p[0] * 10), Math.round(p[1] * 10), b[2] ?? 5); }
  D.t = trees;
  D.lampsX = D.lampsX || [];
  for (const l of LT.lamps || []) {
    const f = l.f ? F[l.f] : null, p = l.p || f.W(l.s, l.d), a = (f ? Math.atan2(f.u[1], f.u[0]) : 0) + (l.a || 0) * Math.PI / 180;
    D.lampsX.push([p[0], p[1], a * 180 / Math.PI, l.t || 'lot1']);
  }
  over.lots.push({ LT, F });
  for (const b of LT.billboards || []) {
    const f = F[b.f], p = f.W(b.s, b.d), fc = b.face || '-d';
    const v = { '+d': f.n, '-d': [-f.n[0], -f.n[1]], '+s': f.u, '-s': [-f.u[0], -f.u[1]] }[fc];
    over.billboards.push({ ...b, p, n: v });
  }
}

// ------------------------------------------------------------------ geometry pass
function surf(P, m, c, ft, dy = 0.03, fav = null) {
  const [layer, hex] = MATS[m] || MATS.asphalt, cc = centroid(P), G = CITY.tile(cc[0], cc[1]).f;
  G.poly(P, [], gy(dy), tt(layer, c || hex), layer, ft, fav);
}
function island(P, top, h, kerbC) {
  const cc = centroid(P), Gb = CITY.tile(cc[0], cc[1]).b, kc = tt(L.PRECAST, kerbC || '#b7b4ac', 0.9);
  for (let i = 0; i < P.length; i++) {
    const a = P[i], b = P[(i + 1) % P.length], dx = b[0] - a[0], dz = b[1] - a[1], Ln = Math.hypot(dx, dz); if (Ln < 0.01) continue;
    const ya = CITY.groundH(a[0], a[1]), yb = CITY.groundH(b[0], b[1]), m = [(a[0] + b[0]) / 2 - cc[0], (a[1] + b[1]) / 2 - cc[1]];
    Gb.quad([a[0], ya, a[1]], [b[0], yb, b[1]], [b[0], yb + h, b[1]], [a[0], ya + h, a[1]], kc, L.PRECAST, 0, null, null, null, null, [m[0], 0, m[1]]);
  }
  // kerb top band (light concrete) and the planted top
  const [layer, hex] = MATS[top] || MATS.grass;
  CITY.tile(cc[0], cc[1]).f.poly(P, [], gy(h), tt(layer, hex), layer, FT.LOTROW);
}

export function buildLots() {
  for (const { LT, F } of CITY.over.lots || []) {
    for (const s of LT.surfaces || []) {
      const W = s.f && F[s.f].W, P = s.ring ? (W ? s.ring.map(q => W(q[0], q[1])) : s.ring) : s.r ? rrect(W, s.s, s.d, s.r) : rect(W, s.s, s.d);
      if (s.fan !== undefined) { const a = s.fan * Math.PI / 180; surf(P, s.m || 'setts', s.c, FT.PLAZA + FLAG.B, 0.028, [Math.cos(a), Math.sin(a), 0, 0]); }
      else surf(P, s.m, s.c, s.base ? FT.LOT : FT.LOTROW, s.base ? 0.03 : 0.035);
    }
    // bay rows: surface + lines (red paver courses or white paint), optional line along the aisle edge / the back
    for (const b of LT.bays || []) {
      const f = F[b.f], ax = b.axis || 's', W = f.W;
      if (b.m) surf(rect(W, b.s, b.d), b.m, b.c, FT.LOTROW, 0.035);
      const ln = b.line || 'red', red = ln === 'red' || ln === 'dark', lw = b.lw || (red ? 0.24 : 0.12), every = b.every || 2.5;
      const [lm, lhex] = ln === 'dark' ? MATS.settsDark : red ? MATS.redline : MATS.white, lc = tt(lm, b.lc || lhex), lft = red ? FT.LOTLINE : FT.PAINT;
      const [a0, a1] = ax === 's' ? b.s : b.d, [c0, c1] = ax === 's' ? b.d : b.s;
      const n = Math.round((a1 - a0) / every);
      const seg = (p, q) => { const cc = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2]; CITY.ribbonSeg(CITY.tile(cc[0], cc[1]).f, p, q, lw, gy(0.04), lc, lm, lft); };
      for (let i = 0; i <= n; i++) {
        const t = a0 + i * (a1 - a0) / Math.max(1, n);
        if ((b.skip || []).some(([p, q]) => t > p + 0.01 && t < q - 0.01)) continue;
        const e0 = b.short ? c0 + (c1 - c0) * 0.08 : c0, e1 = b.short ? c1 - (c1 - c0) * 0.08 : c1;
        seg(ax === 's' ? W(t, e0) : W(e0, t), ax === 's' ? W(t, e1) : W(e1, t));
      }
      for (const e of b.edges || []) {             // lines along the row: 0 = near edge, 1 = far edge, 0.5 = middle of a double row
        const c = c0 + (c1 - c0) * e;
        seg(ax === 's' ? W(a0, c) : W(c, a0), ax === 's' ? W(a1, c) : W(c, a1));
      }
    }
    for (const is of LT.islands || []) {
      const W = is.f ? F[is.f].W : null, P = is.ring || rrect(W, is.s, is.d, is.r ?? 1.2);
      island(P, is.top || 'grass', is.h ?? 0.15, is.kerb);
      if (is.hedge) { // trimmed hedge block on the island
        const hg = is.hedge, s = hg.s || [is.s[0] + 0.6, is.s[1] - 0.6], d = hg.d || [is.d[0] + 0.6, is.d[1] - 0.6];
        const c = W((s[0] + s[1]) / 2, (d[0] + d[1]) / 2), f = F[is.f], G = CITY.tile(c[0], c[1]).b, hc = tt(L.GRASS, hg.c || '#3f5d2a');
        CITY.box(G, c[0], CITY.groundH(c[0], c[1]) + 0.15, c[1], s[1] - s[0], hg.h || 0.8, d[1] - d[0], Math.atan2(f.u[1], f.u[0]), hc, L.GRASS, FT.FOLIAGE, mulc(hc, 1.08), L.GRASS, FT.FOLIAGE);
      }
    }
    for (const rb of LT.ribbons || []) { // paved bands along a polyline (asphalt drives of the traffic playground, paths)
      const P = rb.pts, n = P.length, [layer, hex] = MATS[rb.m || 'asphalt'] || MATS.asphalt, c = tt(layer, rb.c || hex), segs = rb.closed ? n : n - 1;
      for (let i = 0; i < segs; i++) { const a = P[i], b = P[(i + 1) % n], G = CITY.tile(a[0], a[1]).f; CITY.ribbonSeg(G, a, b, rb.w, gy(0.028), c, layer, FT.LOT); }
      for (const q of P) CITY.disc(CITY.tile(q[0], q[1]).f, q, rb.w / 2, gy(0.028), c, layer, FT.LOT, 12);
    }
    for (const sh of LT.shelters || []) buildShelter(F[sh.f], sh);
    for (const ds of LT.dashes || []) { // dashed white centre line
      const W = F[ds.f].W, [on, off] = ds.dash || [3, 3], A = W(...ds.a), B = W(...ds.b), Ln = Math.hypot(B[0] - A[0], B[1] - A[1]), lc = tt(L.ASPHALT, '#c9c9c3');
      for (let t = 0; t < Ln; t += on + off) {
        const t1 = Math.min(Ln, t + on), p = [A[0] + (B[0] - A[0]) * t / Ln, A[1] + (B[1] - A[1]) * t / Ln], q = [A[0] + (B[0] - A[0]) * t1 / Ln, A[1] + (B[1] - A[1]) * t1 / Ln];
        CITY.ribbonSeg(CITY.tile(p[0], p[1]).f, p, q, 0.12, gy(0.04), lc, L.ASPHALT, FT.PAINT);
      }
    }
  }
}

// trolley shelter: galvanised posts, slightly arched translucent roof, mesh back wall
function buildShelter(f, sh) {
  const W = f.W, [s0, s1] = sh.s, [d0, d1] = sh.d, h = sh.h || 2.3, ang = Math.atan2(f.u[1], f.u[0]);
  const c = W((s0 + s1) / 2, (d0 + d1) / 2), base = CITY.groundH(c[0], c[1]), G = CITY.tile(c[0], c[1]).b;
  const steel = tt(L.PRECAST, sh.frame || '#9aa0a4', 0.9), roof = tt(L.PRECAST, sh.roof || '#b9c3c8', 0.9);
  const Ls = s1 - s0, Ld = d1 - d0, np = Math.max(2, Math.round(Ls / 3) + 1);
  for (let i = 0; i < np; i++) for (const d of [d0 + 0.15, d1 - 0.15]) {
    const p = W(s0 + 0.1 + (Ls - 0.2) * i / (np - 1), d); CITY.box(G, p[0], base, p[1], 0.09, h + (d > (d0 + d1) / 2 ? 0.15 : 0), 0.09, ang, steel, L.PRECAST, FT.STEEL);
  }
  // arched roof: three slabs stepping up to the middle
  for (const [a, b, dy] of [[0, 0.33, 0], [0.33, 0.67, 0.18], [0.67, 1, 0]]) {
    const m = W((s0 + s1) / 2, d0 + Ld * (a + b) / 2);
    CITY.box(G, m[0], base + h + dy, m[1], Ls + 0.3, 0.05, Ld * (b - a) + 0.05, ang, roof, L.PRECAST, 0, roof, L.PRECAST, 0);
  }
  const back = W((s0 + s1) / 2, sh.backAt === 0 ? d0 + 0.1 : d1 - 0.1);
  CITY.box(G, back[0], base + 0.25, back[1], Ls, 1.0, 0.04, ang, tt(L.PRECAST, '#7d8488', 0.9), L.PRECAST, FT.STEEL);
  // parked trolleys (blue handles)
  const tc = tt(L.PRECAST, '#aab0b3', 0.9), hc = tt(L.PLASTER, '#1f4fb0', 0.9);
  for (let r = 0; r < (sh.rows || 2); r++) {
    const dd = d0 + Ld * (r + 0.5) / (sh.rows || 2), m = W((s0 + s1) / 2, dd);
    CITY.box(G, m[0], base + 0.15, m[1], Ls - 0.8, 0.75, 0.55, ang, tc, L.PRECAST, FT.STEEL, tc, L.PRECAST, FT.STEEL);
    const hnd = W(s0 + 0.5, dd); CITY.box(G, hnd[0], base + 0.9, hnd[1], 0.08, 0.1, 0.55, ang, hc, L.PLASTER, 0);
  }
  CITY.addEdge(W(s0, d0)[0], W(s0, d0)[1], W(s1, d0)[0], W(s1, d0)[1], h, 'b');
  CITY.addEdge(W(s0, d1)[0], W(s0, d1)[1], W(s1, d1)[0], W(s1, d1)[1], h, 'b');
}
