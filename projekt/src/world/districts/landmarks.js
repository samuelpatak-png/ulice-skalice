// Hand-modelled landmarks and street furniture of Námestie slobody (Skalica):
// St Michael's tower, the round Karner of St Anne, the Marian plague column, fountain, benches, bollards,
// advertising columns, the square clock, crucifix, café terraces, paving medallions.
import { col, mulc } from '../../core/util.js';
import { L, FT, tintFor } from '../../render/materials.js';
import { CITY } from '../city.js';
import { addSign } from '../signs.js';

const tt = (layer, hex, k = 0.92) => tintFor(layer, mulc(col(hex), k));
const TAU = Math.PI * 2;

// surface of revolution around (x, z): profile [[r, y], ...] from bottom to top
function lathe(G, x, z, y0, prof, n, c, mat, ft = 0) {
  for (let k = 0; k < prof.length - 1; k++) {
    const [r0, a0] = prof[k], [r1, a1] = prof[k + 1];
    for (let i = 0; i < n; i++) {
      const t0 = i / n * TAU, t1 = (i + 1) / n * TAU, tm = (t0 + t1) / 2;
      const p = (r, t, y) => [x + Math.cos(t) * r, y0 + y, z + Math.sin(t) * r];
      G.quad(p(r0, t0, a0), p(r0, t1, a0), p(r1, t1, a1), p(r1, t0, a1), c, mat, ft,
        [r0 * t0, a0, r0 * TAU, 0], [r0 * t1, a0, r0 * TAU, 0], [r1 * t1, a1, r1 * TAU, 0], [r1 * t0, a1, r1 * TAU, 0], [Math.cos(tm) * (a1 - a0), r0 - r1, Math.sin(tm) * (a1 - a0)]);
    }
  }
}
// square box rotated by ang with a sign on each of the four faces
function signBox(G, x, y, z, w, h, d, ang, c, mat, faces, inset = 0.03) {
  CITY.box(G, x, y, z, w, h, d, ang, c, mat, 0);
  if (!faces) return;
  const u = [Math.cos(ang), Math.sin(ang)], n = [-u[1], u[0]];
  const F = [[n, d / 2, w], [[-n[0], -n[1]], d / 2, w], [u, w / 2, d], [[-u[0], -u[1]], w / 2, d]];
  F.forEach(([nn, off, ww], i) => { const f = Array.isArray(faces) ? faces[i % faces.length] : faces; if (!f) return; addSign({ c: [x + nn[0] * (off + inset), y + h / 2 + (f.dy || 0), z + nn[1] * (off + inset)], n: nn, w: f.w || ww * 0.94, h: f.h || h * 0.9, preset: f.preset, arg: f.arg, glow: f.glow ?? 0, cut: f.cut ?? true }); });
}

// ------------------------------------------------------------------ St Michael's church tower
// t: { p:[x,z], ang (rad, church axis), shaft, parts... }  heights above the ground at the tower foot
export function buildMichalTower(t) {
  const [x, z] = t.p, base = CITY.groundH(x, z), G = CITY.tile(x, z).b, a = t.ang;
  const plaster = tt(L.PLASTER, '#e2d6bb'), stone = tt(L.STONE, '#c4b595'), cornice = tt(L.PLASTER, '#d2c4a4');
  const tile = tt(L.ROOF_CLAY, '#8e3a2b', 0.8), dark = tt(L.PLASTER, '#2a2622');
  const S = 7.4;
  // shaft with sandstone corner quoins
  CITY.box(G, x, base - 0.5, z, S, 23.5, S, a, plaster, L.PLASTER, 0);
  const u = [Math.cos(a), Math.sin(a)], v = [-u[1], u[0]];
  for (const [cu, cv] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    const q = [x + (u[0] * cu + v[0] * cv) * (S / 2 - 0.3), z + (u[1] * cu + v[1] * cv) * (S / 2 - 0.3)];
    for (let y = 0; y < 23; y += 0.9) CITY.box(G, q[0], base + y, q[1], y % 1.8 < 0.9 ? 0.68 : 0.5, 0.86, y % 1.8 < 0.9 ? 0.5 : 0.68, a, stone, L.STONE, 0);
  }
  const cq = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([cu, cv]) => [x + (u[0] * cu + v[0] * cv) * S / 2, z + (u[1] * cu + v[1] * cv) * S / 2]);
  for (let k = 0; k < 4; k++) CITY.addEdge(cq[k][0], cq[k][1], cq[(k + 1) % 4][0], cq[(k + 1) % 4][1], 30, 'b');
  // paired belfry windows below the frieze, corbel-arch frieze, gallery storey with arcades, cornices
  signBox(G, x, base + 19.6, z, S + 0.02, 2.9, S + 0.02, a, plaster, L.PLASTER, { preset: 'towerPair', w: S * 0.5, h: 2.6 });
  signBox(G, x, base + 22.5, z, S + 0.35, 2.4, S + 0.35, a, plaster, L.PLASTER, { preset: 'corbelFrieze', w: S + 0.3, h: 2.3 });
  CITY.box(G, x, base + 24.9, z, S + 0.9, 0.35, S + 0.9, a, cornice, L.PLASTER, 0);
  signBox(G, x, base + 25.25, z, S + 0.55, 5.3, S + 0.55, a, plaster, L.PLASTER, { preset: 'towerGallery', w: S + 0.5, h: 5.2 });
  CITY.box(G, x, base + 30.5, z, S + 1.0, 0.45, S + 1.0, a, cornice, L.PLASTER, 0);
  // clock stage (chamfered square), clock faces, cornice
  const C = 5.9;
  signBox(G, x, base + 30.95, z, C, 4.6, C, a, plaster, L.PLASTER, { preset: 'clockFace', w: 2.1, h: 2.1, dy: 0.1 });
  for (const [cu, cv] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    const q = [x + (u[0] * cu + v[0] * cv) * (C / 2 - 0.2), z + (u[1] * cu + v[1] * cv) * (C / 2 - 0.2)];
    CITY.box(G, q[0], base + 30.95, q[1], 0.55, 4.6, 0.55, a, stone, L.STONE, 0);
  }
  CITY.box(G, x, base + 35.5, z, C + 0.7, 0.45, C + 0.7, a, cornice, L.PLASTER, 0);
  // onion helmet (red-brown tiles), lantern, small cap, cross
  const y0 = base + 35.95;
  lathe(G, x, z, y0, [[3.05, 0], [3.1, 0.35], [3.0, 1.1], [2.55, 2.1], [1.8, 3.0], [1.05, 3.8], [0.75, 4.3], [0.72, 4.6]], 16, tile, L.ROOF_CLAY, 0);
  lathe(G, x, z, y0 + 4.6, [[0.72, 0], [0.72, 1.25], [0.9, 1.35]], 8, plaster, L.PLASTER, 0);
  for (let i = 0; i < 8; i += 2) { const th = i / 8 * TAU + a; addSign({ c: [x + Math.cos(th) * 0.74, y0 + 5.2, z + Math.sin(th) * 0.74], n: [Math.cos(th), Math.sin(th)], w: 0.3, h: 0.7, preset: 'darkArch', glow: 0, cut: true }); }
  lathe(G, x, z, y0 + 5.95, [[0.9, 0], [0.85, 0.25], [0.55, 0.65], [0.15, 0.95], [0.05, 1.05]], 12, tile, L.ROOF_CLAY, 0);
  const iron = tt(L.PRECAST, '#2c2a26');
  CITY.box(G, x, y0 + 6.95, z, 0.09, 1.9, 0.09, a, iron, L.PRECAST, FT.STEEL);
  CITY.box(G, x, y0 + 8.1, z, 0.75, 0.08, 0.08, a, iron, L.PRECAST, FT.STEEL);
  lathe(G, x, z, y0 + 7.4, [[0.001, 0], [0.16, 0.12], [0.001, 0.26]], 8, tt(L.PLASTER, '#c9a44a'), L.PLASTER, FT.GOLD);
}

// ------------------------------------------------------------------ Karner (ossuary chapel of St Anne): rotunda with a tiled dome
export function buildKarner(bd, sc) {
  const G = CITY.tile(bd.c[0], bd.c[1]).b, [x, z] = sc.c || bd.c, base = bd.base;
  let A = 0; for (let i = 0; i < bd.p.length; i++) { const p = bd.p[i], q = bd.p[(i + 1) % bd.p.length]; A += p[0] * q[1] - q[0] * p[1]; }
  const R = sc.r || Math.sqrt(Math.abs(A / 2) / Math.PI), H = sc.eave || 8.2;
  const wall = tt(L.PLASTER, '#e6e1d6'), stone = tt(L.STONE, '#c9bfa8'), tile = tt(L.ROOF_CLAY, '#8b3a2c', 0.8);
  lathe(G, x, z, base - 0.4, [[R, 0], [R, H + 0.4]], 28, wall, L.PLASTER, 0);
  lathe(G, x, z, base - 0.4, [[R + 0.12, 0], [R + 0.12, 1.0], [R, 1.1]], 28, stone, L.STONE, 0);         // plinth
  lathe(G, x, z, base + H, [[R, 0], [R + 0.45, 0.25], [R + 0.45, 0.55], [R, 0.6]], 28, stone, L.STONE, 0);  // cornice
  for (let i = 0; i < 28; i++) CITY.addEdge(x + Math.cos(i / 28 * TAU) * R, z + Math.sin(i / 28 * TAU) * R, x + Math.cos((i + 1) / 28 * TAU) * R, z + Math.sin((i + 1) / 28 * TAU) * R, H, 'b');
  // eight flat buttresses with weathered sandstone caps
  for (let i = 0; i < 8; i++) {
    const th = (i + 0.5) / 8 * TAU + (sc.rot || 0), q = [x + Math.cos(th) * (R + 0.3), z + Math.sin(th) * (R + 0.3)];
    CITY.box(G, q[0], base - 0.3, q[1], 0.9, H - 1.2, 0.7, th + Math.PI / 2, wall, L.PLASTER, 0);
    CITY.box(G, q[0], base + H - 1.5, q[1], 0.95, 0.35, 0.75, th + Math.PI / 2, stone, L.STONE, 0);
  }
  // oval windows between the buttresses, a portal on the west side
  for (let i = 0; i < 8; i++) {
    const th = i / 8 * TAU + (sc.rot || 0), n = [Math.cos(th), Math.sin(th)];
    if (i === (sc.door ?? 4)) {
      addSign({ c: [x + n[0] * (R + 0.04), base + 1.6, z + n[1] * (R + 0.04)], n, w: 2.2, h: 3.2, preset: 'karnerDoor', glow: 0, cut: true });
      continue;
    }
    if (i % 2 === 0) addSign({ c: [x + n[0] * (R + 0.04), base + 5.2, z + n[1] * (R + 0.04)], n, w: 1.7, h: 1.25, preset: 'oculus', glow: 0, cut: true });
    else addSign({ c: [x + n[0] * (R + 0.04), base + 3.2, z + n[1] * (R + 0.04)], n, w: 1.0, h: 2.3, preset: 'narrowArch', glow: 0, cut: true });
  }
  // dome, lantern, cap, cross
  const d0 = base + H + 0.55, DH = sc.dome || 6.2;
  lathe(G, x, z, d0, [[R + 0.35, 0], [R + 0.3, DH * 0.12], [R * 0.95, DH * 0.32], [R * 0.78, DH * 0.55], [R * 0.52, DH * 0.78], [R * 0.25, DH * 0.94], [1.2, DH]], 28, tile, L.ROOF_CLAY, 0);
  const lr = 1.15, l0 = d0 + DH;
  lathe(G, x, z, l0, [[lr, 0], [lr, 1.9], [lr + 0.15, 2.05], [lr + 0.15, 2.2]], 6, wall, L.PLASTER, 0);
  for (let i = 0; i < 6; i++) { const th = (i + 0.5) / 6 * TAU, n = [Math.cos(th), Math.sin(th)], ap = Math.cos(Math.PI / 6) * lr; addSign({ c: [x + n[0] * (ap + 0.03), l0 + 1.0, z + n[1] * (ap + 0.03)], n, w: 0.55, h: 1.1, preset: 'darkArch', glow: 0, cut: true }); }
  lathe(G, x, z, l0 + 2.2, [[lr + 0.15, 0], [lr, 0.3], [0.75, 0.75], [0.2, 1.1], [0.06, 1.2]], 12, tile, L.ROOF_CLAY, 0);
  const iron = tt(L.PRECAST, '#2c2a26');
  CITY.box(G, x, l0 + 3.35, z, 0.08, 1.4, 0.08, 0, iron, L.PRECAST, FT.STEEL);
  CITY.box(G, x, l0 + 4.25, z, 0.6, 0.07, 0.07, 0, iron, L.PRECAST, FT.STEEL);
}

// ------------------------------------------------------------------ Marian plague column (Immaculata) on a stepped base with four posts and chains
export function buildPlagueColumn(c) {
  const [x, z] = c.p, gy = CITY.groundH(x, z), G = CITY.tile(x, z).b, a = c.ang || 0;
  const st = tt(L.PLASTER_ROUGH, '#e4dfd2', 0.9), st2 = tt(L.STONE, '#d5cdbb'), dark = tt(L.PRECAST, '#2a2a28');
  CITY.box(G, x, gy - 0.1, z, 6.2, 0.22, 6.2, a, tt(L.COBBLE, '#9c968b'), L.COBBLE, 0);
  [[4.6, 0.12], [3.9, 0.36], [3.2, 0.6]].forEach(([w, y]) => CITY.box(G, x, gy + y - 0.12, z, w, 0.26, w, a, st2, L.STONE, 0));
  signBox(G, x, gy + 0.74, z, 2.2, 2.2, 2.2, a, st, L.PLASTER_ROUGH, { preset: 'cartouche', w: 1.3, h: 1.5, dy: 0.05 });
  CITY.box(G, x, gy + 0.62, z, 2.5, 0.25, 2.5, a, st2, L.STONE, 0);
  CITY.box(G, x, gy + 2.94, z, 2.55, 0.3, 2.55, a, st2, L.STONE, 0);
  CITY.box(G, x, gy + 3.24, z, 1.5, 0.55, 1.5, a, st, L.PLASTER_ROUGH, 0);
  lathe(G, x, z, gy + 3.79, [[0.42, 0], [0.36, 0.3], [0.33, 1.0], [0.3, 6.0], [0.33, 6.2], [0.5, 6.5], [0.62, 6.9], [0.45, 7.2]], 12, st, L.PLASTER_ROUGH, 0);
  // clouds with cherubs around the capital, the Virgin on top
  lathe(G, x, z, gy + 10.9, [[0.5, 0], [0.8, 0.25], [0.7, 0.55], [0.35, 0.75]], 10, st, L.PLASTER_ROUGH, 0);
  lathe(G, x, z, gy + 11.6, [[0.38, 0], [0.33, 0.5], [0.24, 1.1], [0.2, 1.35], [0.13, 1.5], [0.15, 1.62], [0.12, 1.8], [0.001, 1.85]], 10, st, L.PLASTER_ROUGH, 0);
  CITY.box(G, x, gy + 13.2, z, 0.5, 0.05, 0.05, a, tt(L.PLASTER, '#c9a44a'), L.PLASTER, FT.GOLD);    // halo
  const u = [Math.cos(a), Math.sin(a)], v = [-u[1], u[0]], P = [];
  for (const [cu, cv] of [[1, 1], [1, -1], [-1, -1], [-1, 1]]) P.push([x + (u[0] * cu + v[0] * cv) * 2.7, z + (u[1] * cu + v[1] * cv) * 2.7]);
  for (const q of P) { CITY.box(G, q[0], gy, q[1], 0.36, 1.05, 0.36, a, st, L.PLASTER_ROUGH, 0); CITY.addObst(q[0], q[1], 0.3, 'm'); }
  for (let i = 0; i < 4; i++) { // sagging chains between the posts (three links per side)
    const p = P[i], q = P[(i + 1) % 4];
    for (let k = 0; k < 3; k++) {
      const t0 = k / 3, t1 = (k + 1) / 3, s0 = 0.28 * Math.sin(Math.PI * t0), s1 = 0.28 * Math.sin(Math.PI * t1);
      const A = [p[0] + (q[0] - p[0]) * t0, p[1] + (q[1] - p[1]) * t0], B = [p[0] + (q[0] - p[0]) * t1, p[1] + (q[1] - p[1]) * t1];
      const m = [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2], L0 = Math.hypot(B[0] - A[0], B[1] - A[1]);
      CITY.box(G, m[0], gy + 0.85 - (s0 + s1) / 2, m[1], L0, 0.04, 0.04, Math.atan2(B[1] - A[1], B[0] - A[0]), dark, L.PRECAST, FT.STEEL);
    }
  }
  CITY.addObst(x, z, 1.7, 'm');
}

// ------------------------------------------------------------------ street furniture
export function buildFurniture(list) {
  const iron = tt(L.PRECAST, '#1f2224'), stoneC = tt(L.STONE, '#b8b2a5'), wood = tt(L.PLASTER_ROUGH, '#7a5436');
  for (const f of list) {
    const [x, z] = f.p, gy = CITY.groundH(x, z), G = CITY.tile(x, z).b, a = (f.ang || 0) * Math.PI / 180;
    if (f.t === 'bollards') { // cast-iron bollards along a line
      const [p0, p1] = f.line, n = Math.max(1, Math.round(Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) / (f.every || 3)));
      for (let i = 0; i <= n; i++) {
        const q = [p0[0] + (p1[0] - p0[0]) * i / n, p0[1] + (p1[1] - p0[1]) * i / n], y = CITY.groundH(q[0], q[1]), Gq = CITY.tile(q[0], q[1]).b;
        lathe(Gq, q[0], q[1], y, [[0.09, 0], [0.08, 0.7], [0.1, 0.78], [0.07, 0.9], [0.001, 1.0]], 8, iron, L.PRECAST, FT.STEEL);
        CITY.addObst(q[0], q[1], 0.12, 'm');
      }
    } else if (f.t === 'fountain') { // low round stone basin with a bubbling jet, stone benches around
      const r = f.r || 1.6;
      lathe(G, x, z, gy, [[r, 0], [r, 0.42], [r - 0.25, 0.46], [r - 0.25, 0.1]], 24, stoneC, L.STONE, 0);
      CITY.water.poly(Array.from({ length: 24 }, (_, i) => [x + Math.cos(i / 24 * TAU) * (r - 0.25), z + Math.sin(i / 24 * TAU) * (r - 0.25)]).reverse(), [], gy + 0.36, [1, 1, 1], 0, 0);
      lathe(G, x, z, gy + 0.3, [[0.25, 0], [0.2, 0.12], [0.06, 0.28], [0.001, 0.3]], 10, tt(L.PLASTER, '#dfe8ea'), L.PLASTER, 0);
      for (const b of f.benches || []) { const q = [x + Math.cos(b * Math.PI / 180) * (r + 1.4), z + Math.sin(b * Math.PI / 180) * (r + 1.4)]; bench(G, q[0], CITY.groundH(q[0], q[1]), q[1], b * Math.PI / 180 + Math.PI / 2, 'stone'); }
      CITY.addObst(x, z, r, 'm');
    } else if (f.t === 'bench') bench(G, x, gy, z, a, f.style || 'wood');
    else if (f.t === 'roundBench') { // wooden bench ring around a tree
      lathe(G, x, z, gy, [[1.35, 0.42], [1.35, 0.47], [0.75, 0.47], [0.75, 0.42]], 12, wood, L.PLASTER_ROUGH, 0);
      for (let i = 0; i < 6; i++) { const th = i / 6 * TAU; CITY.box(G, x + Math.cos(th) * 1.05, gy, z + Math.sin(th) * 1.05, 0.12, 0.42, 0.12, th, iron, L.PRECAST, FT.STEEL); }
      lathe(G, x, z, gy + 0.47, [[1.35, 0], [1.35, 0.45], [1.3, 0.45], [1.3, 0]], 12, wood, L.PLASTER_ROUGH, 0);
      CITY.addObst(x, z, 1.4, 'm');
    } else if (f.t === 'clock') { // square clock on a cast-iron post
      lathe(G, x, z, gy, [[0.14, 0], [0.11, 0.6], [0.07, 0.8], [0.06, 3.1]], 10, iron, L.PRECAST, FT.STEEL);
      CITY.box(G, x, gy + 3.1, z, 0.75, 0.75, 0.22, a, iron, L.PRECAST, FT.STEEL);
      const n = [-Math.sin(a), Math.cos(a)];
      for (const sg of [1, -1]) addSign({ c: [x + n[0] * 0.12 * sg, gy + 3.47, z + n[1] * 0.12 * sg], n: [n[0] * sg, n[1] * sg], w: 0.62, h: 0.62, preset: 'clockFace', glow: 0.4, cut: true });
      CITY.addObst(x, z, 0.2, 'm');
    } else if (f.t === 'adColumn') { // advertising column with posters and a dark green cap
      const g = tt(L.PRECAST, '#27402f');
      lathe(G, x, z, gy, [[0.62, 0], [0.62, 0.3], [0.55, 0.32], [0.55, 2.6], [0.66, 2.7], [0.66, 2.85], [0.4, 3.05], [0.08, 3.3], [0.001, 3.35]], 12, g, L.PRECAST, 0);
      for (let i = 0; i < 4; i++) { const th = (i / 4 + (f.rot || 0)) * TAU, n = [Math.cos(th), Math.sin(th)]; addSign({ c: [x + n[0] * 0.58, gy + 1.5, z + n[1] * 0.58], n, w: 0.78, h: 1.9, preset: 'ad', arg: f.posters && f.posters[i], glow: 0 }); }
      CITY.addObst(x, z, 0.6, 'm');
    } else if (f.t === 'crucifix') { // tall wooden cross with a corpus on a stone plinth
      CITY.box(G, x, gy, z, 0.9, 0.5, 0.9, a, stoneC, L.STONE, 0);
      CITY.box(G, x, gy + 0.5, z, 0.2, 4.2, 0.16, a, tt(L.BARK, '#3a2a1e'), L.BARK, 0);
      CITY.box(G, x, gy + 3.6, z, 1.8, 0.18, 0.16, a, tt(L.BARK, '#3a2a1e'), L.BARK, 0);
      const n = [-Math.sin(a), Math.cos(a)];
      addSign({ c: [x + n[0] * 0.1, gy + 3.2, z + n[1] * 0.1], n, w: 1.6, h: 1.7, preset: 'corpus', cut: true, glow: 0 });
      CITY.box(G, x, gy + 4.5, z, 0.7, 0.08, 0.5, a, iron, L.PRECAST, FT.STEEL);   // small tin roof
      CITY.addObst(x, z, 0.5, 'm');
    } else if (f.t === 'medallion') { // light stone rosette in the setts (compass star) around a candelabra
      const r = f.r || 3.0, Gf = CITY.tile(x, z).f;
      Gf.poly(Array.from({ length: 32 }, (_, i) => [x + Math.cos(-i / 32 * TAU) * r, z + Math.sin(-i / 32 * TAU) * r]), [], (xx, zz) => CITY.groundH(xx, zz) + 0.045, tt(L.STONE, '#cdc8bd'), L.STONE, FT.PLAZA);
      Gf.poly(Array.from({ length: 32 }, (_, i) => [x + Math.cos(-i / 32 * TAU) * r * 0.93, z + Math.sin(-i / 32 * TAU) * r * 0.93]), [], (xx, zz) => CITY.groundH(xx, zz) + 0.05, tt(L.STONE, '#e1ddd3'), L.STONE, FT.PLAZA);
      for (let i = 0; i < 8; i++) { // star rays of darker stone
        const th = i / 8 * TAU + a, w = i % 2 ? 0.18 : 0.3, L0 = i % 2 ? r * 0.7 : r * 0.9;
        const tip = [x + Math.cos(th) * L0, z + Math.sin(th) * L0], l1 = [x + Math.cos(th + Math.PI / 2) * w, z + Math.sin(th + Math.PI / 2) * w], l2 = [x - Math.cos(th + Math.PI / 2) * w, z - Math.sin(th + Math.PI / 2) * w];
        Gf.tri([l1[0], gy + 0.055, l1[1]], [tip[0], gy + 0.055, tip[1]], [l2[0], gy + 0.055, l2[1]], tt(L.STONE, '#8f897e'), L.STONE, FT.PLAZA, null, null, null, [0, 1, 0]);
      }
    } else if (f.t === 'terrace') { // café terrace: timber deck with a low fence, tables, chairs, big white umbrellas
      const [w, d] = f.size, u = [Math.cos(a), Math.sin(a)], v = [-u[1], u[0]], P = (s, t) => [x + u[0] * s + v[0] * t, z + u[1] * s + v[1] * t];
      CITY.box(G, x, gy, z, w, 0.14, d, a, tt(L.PLASTER_ROUGH, '#5d4a38'), L.PLASTER_ROUGH, FT.PLANKS, tt(L.GRASS, '#4f7d3a'), L.GRASS, 0);
      for (const [s, t, L0, ang2] of [[0, -d / 2, w, a], [0, d / 2, w, a], [-w / 2, 0, d, a + Math.PI / 2], [w / 2, 0, d, a + Math.PI / 2]]) {
        const q = P(s, t); CITY.box(G, q[0], gy + 0.14, q[1], L0, 0.85, 0.08, ang2, tt(L.PLASTER_ROUGH, '#4a3526'), L.PLASTER_ROUGH, FT.PLANKS);
        const e0 = P(s - (ang2 === a ? L0 / 2 : 0), t - (ang2 === a ? 0 : L0 / 2)), e1 = P(s + (ang2 === a ? L0 / 2 : 0), t + (ang2 === a ? 0 : L0 / 2));
        if (!(f.open && s === 0 && t === (f.open > 0 ? d / 2 : -d / 2))) CITY.addEdge(e0[0], e0[1], e1[0], e1[1], 1.0, 'b');
      }
      const nu = Math.max(1, Math.round(w / 4.2));
      for (let i = 0; i < nu; i++) {
        const q = P(-w / 2 + (i + 0.5) * w / nu, 0), y = gy + 0.14;
        CITY.box(G, q[0], y, q[1], 0.08, 2.3, 0.08, a, tt(L.PRECAST, '#d9d9d6'), L.PRECAST, FT.STEEL);
        lathe(G, q[0], q[1], y + 2.05, [[2.0, 0], [1.6, 0.18], [0.3, 0.5], [0.001, 0.55]], 4, tt(L.PLASTER, '#f2f1ec'), L.PLASTER, 0);
        lathe(G, q[0], q[1], y + 2.05, [[0.001, 0], [2.0, 0]], 4, tt(L.PLASTER, '#dcdbd5'), L.PLASTER, 0);
        for (const [ds, dt] of [[-1.0, -0.8], [1.0, 0.8], [-1.0, 0.8], [1.0, -0.8]]) {
          const tq = P(-w / 2 + (i + 0.5) * w / nu + ds * 0.9, dt * 0.9 * d / 3);
          CITY.box(G, tq[0], y, tq[1], 0.7, 0.75, 0.7, a, tt(L.PLASTER, '#efece6'), L.PLASTER, 0);
        }
        if (f.brand) for (let k = 0; k < 4; k++) { const th = a + k * Math.PI / 2 + Math.PI / 4, n = [Math.cos(th), Math.sin(th)]; addSign({ c: [q[0] + n[0] * 1.45, y + 2.07, q[1] + n[1] * 1.45], n, w: 1.5, h: 0.22, preset: 'brandStrip', arg: f.brand, glow: 0 }); }
      }
    } else if (f.t === 'statue') { // bronze figure on a stone pedestal
      CITY.box(G, x, gy, z, 1.0, f.ped || 1.6, 1.0, a, stoneC, L.STONE, 0);
      CITY.statue(G, x, gy + (f.ped || 1.6), z, f.h || 1.9, tt(L.PRECAST, '#3d4a43'), L.PRECAST, FT.STEEL);
      CITY.addObst(x, z, 0.7, 'm');
    } else if (f.t === 'bikeRack') {
      for (let i = 0; i < (f.n || 4); i++) { const q = [x + Math.cos(a) * (i - (f.n || 4) / 2) * 0.8, z + Math.sin(a) * (i - (f.n || 4) / 2) * 0.8]; CITY.box(G, q[0], gy, q[1], 0.05, 0.8, 0.7, a, tt(L.PRECAST, '#a3a6a8'), L.PRECAST, FT.STEEL); }
    } else if (f.t === 'grate') { // cast-iron tree grate
      const Gf = CITY.tile(x, z).f, r = f.r || 1.1;
      Gf.poly(Array.from({ length: 20 }, (_, i) => [x + Math.cos(-i / 20 * TAU) * r, z + Math.sin(-i / 20 * TAU) * r]), [], (xx, zz) => CITY.groundH(xx, zz) + 0.05, tt(L.PRECAST, '#1d1e1f'), L.PRECAST, FT.STEEL);
    } else if (f.t === 'frontGable') { // gable facing the street over part of an eaves front: triangle wall (painted), roof slopes running back into the main roof, timber balcony
      const [ax, az] = f.a, [bx, bz] = f.b, W = Math.hypot(bx - ax, bz - az), u = [(bx - ax) / W, (bz - az) / W], n = [-u[1], u[0]];
      const y0 = CITY.groundH(ax, az) + f.y0, h = f.h, D = f.depth || 8, ov = f.over || 0.9, Gb = CITY.tile(ax, az).b;
      const roofC = tt(L.ROOF_CLAY, f.roofC || '#3d7b55', 0.85), wallC = tt(L.PLASTER, f.wall || '#f3efe4'), wood = tt(L.PLASTER_ROUGH, '#5a2e1c');
      const P = (s, d, y) => [ax + u[0] * s + n[0] * d, y, az + u[1] * s + n[1] * d];
      Gb.tri(P(0, 0.02, y0), P(W, 0.02, y0), P(W / 2, 0.02, y0 + h), wallC, L.PLASTER, 0, null, null, null, [n[0], 0, n[1]]);
      for (const [s0, e] of [[-0.35, 1], [W + 0.35, -1]]) { // roof slopes (with overhang at the front and eaves)
        const sl = [P(s0, ov, y0 - 0.25), P(W / 2, ov, y0 + h + 0.25), P(W / 2, -D, y0 + h + 0.25), P(s0, -D, y0 - 0.25)];
        Gb.quad(sl[0], sl[1], sl[2], sl[3], roofC, L.ROOF_CLAY, FT.ROOF, null, null, null, null, [-u[0] * e * h, W / 2, -u[1] * e * h]);
        Gb.quad(sl[3], sl[2], sl[1], sl[0], mulc(roofC, 0.6), L.ROOF_CLAY, 0, null, null, null, null, [u[0] * e * h, -W / 2, u[1] * e * h]);
      }
      for (const [s0, s1] of [[-0.35, W / 2], [W / 2, W + 0.35]]) { // carved barge boards
        const A = P(s0, ov + 0.02, s0 < W / 2 && s1 === W / 2 ? y0 - 0.25 : y0 + h + 0.25), B = P(s1, ov + 0.02, s1 === W / 2 ? y0 + h + 0.25 : y0 - 0.25);
        const dy = 0.35; Gb.quad(A, B, [B[0], B[1] - dy, B[2]], [A[0], A[1] - dy, A[2]], wood, L.PLASTER_ROUGH, FT.PLANKS, null, null, null, null, [n[0], 0, n[1]]);
      }
      if (f.mosaic) addSign({ c: [ax + u[0] * W / 2 + n[0] * 0.06, y0 + h * 0.42, az + u[1] * W / 2 + n[1] * 0.06], n, w: W * 0.8, h: h * 0.84, preset: f.mosaic, glow: 0, cut: true });
      if (f.balcony) { // timber gallery on brackets across the gable base
        const bw = W - 0.4, m = [ax + u[0] * W / 2 + n[0] * 0.6, az + u[1] * W / 2 + n[1] * 0.6], ang = Math.atan2(u[1], u[0]);
        CITY.box(Gb, m[0], y0 - 0.45, m[1], bw, 0.18, 1.2, ang, wood, L.PLASTER_ROUGH, FT.PLANKS);
        const r = [m[0] + n[0] * 0.55, m[1] + n[1] * 0.55]; CITY.box(Gb, r[0], y0 - 0.27, r[1], bw, 1.0, 0.08, ang, wood, L.PLASTER_ROUGH, FT.PLANKS);
        addSign({ c: [r[0] + n[0] * 0.05, y0 + 0.2, r[1] + n[1] * 0.05], n, w: bw, h: 0.8, preset: 'jurkovicBand', glow: 0 });
        for (const s of [0.4, W / 2, W - 0.4]) { const q = P(s, 0.9, 0); CITY.box(Gb, q[0], y0 - 1.3, q[2], 0.18, 0.85, 1.1, ang, wood, L.PLASTER_ROUGH, FT.PLANKS); }
      }
    } else if (f.t === 'signpost') { // black tourist finger-post
      CITY.box(G, x, gy, z, 0.1, 3.0, 0.1, a, iron, L.PRECAST, FT.STEEL);
      for (let k = 0; k < 3; k++) CITY.box(G, x + Math.cos(a + k) * 0.4, gy + 2.3 - k * 0.3, z + Math.sin(a + k) * 0.4, 0.9, 0.22, 0.04, a + k, iron, L.PRECAST, FT.STEEL);
    }
  }
}
function bench(G, x, y, z, a, style) {
  const u = [Math.cos(a), Math.sin(a)], v = [-u[1], u[0]];
  if (style === 'stone') { CITY.box(G, x, y, z, 2.2, 0.45, 0.55, a, tt(L.STONE, '#c2bcb0'), L.STONE, 0); CITY.addObst(x, z, 0.8, 'm'); return; }
  const iron = tt(L.PRECAST, '#1f2224'), wood = tt(L.PLASTER_ROUGH, '#7a5436');
  for (const s of [-0.75, 0.75]) CITY.box(G, x + u[0] * s, y, z + u[1] * s, 0.08, 0.45, 0.55, a, iron, L.PRECAST, FT.STEEL);
  CITY.box(G, x, y + 0.42, z, 1.8, 0.06, 0.5, a, wood, L.PLASTER_ROUGH, FT.PLANKS);
  CITY.box(G, x - v[0] * 0.24, y + 0.5, z - v[1] * 0.24, 1.8, 0.4, 0.05, a, wood, L.PLASTER_ROUGH, FT.PLANKS);
  CITY.addObst(x, z, 0.6, 'm');
}
