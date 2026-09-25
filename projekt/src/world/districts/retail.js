// Surveyed shop facades: coloured cladding sections, glazing, stone plinths, canopies, portals, signs, poles.
// A face is a polyline along the real wall; items are placed in facade coordinates (s along the face, v up, d outwards).
import { col, mulc } from '../../core/util.js';
import { L, FT, FLAG, tintFor } from '../../render/materials.js';
import { CITY } from '../city.js';
import { addSign } from '../signs.js';

const tt = (layer, hex, k = 1) => tintFor(layer, mulc(col(hex), k));
const LAY = (m) => L[m || 'CLADDING'];

// face frame: path vertices; s = projection onto an axis (so small jogs of the wall do not shift the survey) or arc length
function frame(face) {
  const P = face.path, side = face.side ?? 1, segs = [];
  const ax = face.axis;
  let acc = face.s0 || 0;
  for (let i = 0; i < P.length - 1; i++) {
    const a = P[i], b = P[i + 1], dx = b[0] - a[0], dz = b[1] - a[1], Ln = Math.hypot(dx, dz); if (Ln < 1e-6) continue;
    const u = [dx / Ln, dz / Ln], n = side > 0 ? [-u[1], u[0]] : [u[1], -u[0]];
    let sa, sb;
    if (ax) { sa = (a[0] - ax.o[0]) * ax.u[0] + (a[1] - ax.o[1]) * ax.u[1]; sb = (b[0] - ax.o[0]) * ax.u[0] + (b[1] - ax.o[1]) * ax.u[1]; }
    else { sa = acc; sb = acc + Ln; acc = sb; }
    if (Math.abs(sb - sa) < 0.3) continue;                       // tiny jogs of the outline
    segs.push({ a, b, u, n, sa, sb, Ln });
  }
  const find = (s) => segs.find(g => s >= Math.min(g.sa, g.sb) - 1e-6 && s <= Math.max(g.sa, g.sb) + 1e-6) || (s < segs[0].sa ? segs[0] : segs[segs.length - 1]);
  const at = (s, d = 0) => { const g = find(s), t = (s - g.sa) / (g.sb - g.sa); return { p: [g.a[0] + (g.b[0] - g.a[0]) * t + g.n[0] * d, g.a[1] + (g.b[1] - g.a[1]) * t + g.n[1] * d], u: g.u, n: g.n }; };
  return { segs, at };
}

function quadOn(F, s0, s1, v0, v1, d, color, layer, ft, eaveFa) {
  for (const g of F.segs) {
    const lo = Math.max(s0, Math.min(g.sa, g.sb)), hi = Math.min(s1, Math.max(g.sa, g.sb)); if (hi - lo < 0.01) continue;
    const pt = (s) => { const t = (s - g.sa) / (g.sb - g.sa); return [g.a[0] + (g.b[0] - g.a[0]) * t + g.n[0] * d, g.a[1] + (g.b[1] - g.a[1]) * t + g.n[1] * d]; };
    // a quad (A, B, B', A') faces (dz, -dx) of A->B; pick the order so that this is the face normal n
    let A = pt(lo), B = pt(hi), la = lo - s0, lb = hi - s0;
    const dx = B[0] - A[0], dz = B[1] - A[1];
    if (dz * g.n[0] - dx * g.n[1] < 0) { [A, B] = [B, A]; [la, lb] = [lb, la]; }
    const Lw = s1 - s0, m = [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2], base = CITY.groundH(m[0], m[1]), G = CITY.tile(m[0], m[1]).b;
    const nn = [g.n[0], 0, g.n[1]], fa = (u, v) => [u, v, Lw, eaveFa];
    G.quad([A[0], base + v0, A[1]], [B[0], base + v0, B[1]], [B[0], base + v1, B[1]], [A[0], base + v1, A[1]], color, layer, ft,
      fa(la, v0), fa(lb, v0), fa(lb, v1), fa(la, v1), nn);
  }
}

export function buildRetail(list) {
  for (const face of list) {
    const F = frame(face);
    if (!F.segs.length) continue;
    for (const it of face.items) {
      const [s0, s1] = Array.isArray(it.s) ? it.s : [it.s, it.s];
      const [v0, v1] = it.v || [0, 0], sm = (s0 + s1) / 2, dd = it.dd || 0;
      if (it.t === 'wall') quadOn(F, s0, s1, v0, v1, 0.05 + dd, tt(LAY(it.m), it.c, it.k ?? 0.92), LAY(it.m), it.ft ?? 0, 0);
      else if (it.t === 'glass') quadOn(F, s0, s1, v0, v1, 0.06 + dd, [1, 1, 1], L.PLASTER, FT.CURTAIN + FLAG.B, v1 - v0);
      else if (it.t === 'box') {
        const [d0, d1] = it.d || [0, 0.3], q = F.at(sm, (d0 + d1) / 2 + 0.02), base = CITY.groundH(q.p[0], q.p[1]), G = CITY.tile(q.p[0], q.p[1]).b;
        const c = tt(LAY(it.m), it.c, 0.92), top = it.top ? tt(LAY(it.tm || it.m), it.top, 0.92) : c;
        CITY.box(G, q.p[0], base + v0, q.p[1], Math.max(0.05, s1 - s0), v1 - v0, Math.max(0.05, d1 - d0), Math.atan2(q.u[1], q.u[0]), c, LAY(it.m), it.ft ?? 0, top, LAY(it.tm || it.m), it.tft ?? 0);
        if (it.solid) { const e0 = F.at(s0, d1), e1 = F.at(s1, d1); CITY.addEdge(e0.p[0], e0.p[1], e1.p[0], e1.p[1], v1, 'b'); }
      }
      else if (it.t === 'sign') {
        const q = F.at(sm, 0.08 + dd), base = CITY.groundH(q.p[0], q.p[1]);
        addSign({ c: [q.p[0], base + (v0 + v1) / 2, q.p[1]], n: q.n, w: s1 - s0, h: v1 - v0, preset: it.preset, arg: it.arg, glow: it.glow ?? 1, cut: it.cut });
      }
      else if (it.t === 'pole' || it.t === 'flag') {
        const q = F.at(sm, it.d ?? 5), base = CITY.groundH(q.p[0], q.p[1]), G = CITY.tile(q.p[0], q.p[1]).b, h = it.h || 10;
        CITY.box(G, q.p[0], base, q.p[1], it.r || 0.16, h, it.r || 0.16, 0, tt(L.PRECAST, it.c || '#c9cacb', 0.9), L.PRECAST, FT.STEEL, null, null, FT.STEEL);
        CITY.addObst(q.p[0], q.p[1], 0.25, 'b');
        if (it.t === 'flag') { // banner hanging from a short arm, visible from both sides
          const fw = 1.1, fh = 3.2, off = [q.u[0] * (fw / 2 + 0.1), q.u[1] * (fw / 2 + 0.1)];
          for (const sg of [1, -1]) addSign({ c: [q.p[0] + off[0] + q.n[0] * 0.02 * sg, base + h - fh / 2 - 0.3, q.p[1] + off[1] + q.n[1] * 0.02 * sg], n: [q.n[0] * sg, q.n[1] * sg], w: fw, h: fh, preset: 'flag', arg: it.colors, glow: 0 });
          CITY.box(G, q.p[0] + off[0], base + h - 0.35, q.p[1] + off[1], fw + 0.2, 0.06, 0.06, Math.atan2(q.u[1], q.u[0]), tt(L.PRECAST, '#c9cacb'), L.PRECAST, FT.STEEL);
        }
      }
      else if (it.t === 'bollards') {
        const every = it.every || 2.5;
        for (let s = s0; s <= s1 + 1e-6; s += every) {
          const q = F.at(s, it.d ?? 2), base = CITY.groundH(q.p[0], q.p[1]), G = CITY.tile(q.p[0], q.p[1]).b;
          CITY.box(G, q.p[0], base, q.p[1], 0.14, it.h || 0.95, 0.14, 0, tt(L.PLASTER, it.c || '#1d3c8c', 0.9), L.PLASTER, 0);
          CITY.addObst(q.p[0], q.p[1], 0.15, 'b');
        }
      }
      else if (it.t === 'planter') { // black trough with shrubs
        const [d0, d1] = it.d || [0.2, 1.0], q = F.at(sm, (d0 + d1) / 2), base = CITY.groundH(q.p[0], q.p[1]), G = CITY.tile(q.p[0], q.p[1]).b, ang = Math.atan2(q.u[1], q.u[0]);
        CITY.box(G, q.p[0], base, q.p[1], s1 - s0, 0.6, d1 - d0, ang, tt(L.PLASTER, it.c || '#232426', 0.9), L.PLASTER, 0, tt(L.FOREST, '#3a3025'), L.FOREST, 0);
        CITY.box(G, q.p[0], base + 0.6, q.p[1], s1 - s0 - 0.2, 0.55, d1 - d0 - 0.2, ang, tt(L.GRASS, '#3f5a2a'), L.GRASS, FT.FOLIAGE, tt(L.GRASS, '#46622e'), L.GRASS, FT.FOLIAGE);
        const e0 = F.at(s0, d1), e1 = F.at(s1, d1); CITY.addEdge(e0.p[0], e0.p[1], e1.p[0], e1.p[1], 0.9, 'b');
      }
    }
  }
}

// free-standing totems (pylons) with a sign board on both sides
export function buildPylons(list) {
  for (const p of list) {
    if (p.style === 'tri') { buildTriPylon(p); continue; }
    const [x, z] = p.p, base = CITY.groundH(x, z), G = CITY.tile(x, z).b, a = p.ang || 0, u = [Math.cos(a), Math.sin(a)], n = [-u[1], u[0]];
    const h = p.h || 12, bw = p.w || 3, bh = p.bh || 3, colC = tt(L.PRECAST, p.column || '#b9bbbd', 0.9);
    if (p.style === 'blade') CITY.box(G, x, base, z, bw, h, 0.5, a, colC, L.PRECAST, 0, colC, L.PRECAST, 0);
    else CITY.box(G, x, base, z, p.cw || 0.7, h - bh, p.cw || 0.7, a, colC, L.PRECAST, 0);
    CITY.addObst(x, z, 0.6, 'b');
    const y = p.style === 'blade' ? base + h - bh / 2 - 0.3 : base + h - bh / 2;
    if (p.style !== 'blade') CITY.box(G, x, base + h - bh - 0.1, z, bw + 0.2, bh + 0.2, 0.45, a, tt(L.PRECAST, p.frame || '#e8e9ea', 0.9), L.PRECAST, 0);
    for (const sg of [1, -1]) {
      const d = (p.style === 'blade' ? 0.27 : 0.25) * sg;
      addSign({ c: [x + n[0] * d, y, z + n[1] * d], n: [n[0] * sg, n[1] * sg], w: bw, h: bh, preset: p.preset, arg: p.arg, glow: 1 });
    }
    for (const extra of p.extra || []) for (const sg of [1, -1]) {
      const d = (p.style === 'blade' ? 0.27 : 0.25) * sg;
      addSign({ c: [x + n[0] * d, base + extra.y, z + n[1] * d], n: [n[0] * sg, n[1] * sg], w: extra.w, h: extra.h, preset: extra.preset, arg: extra.arg, glow: 1 });
    }
  }
}

// free-standing billboards: board box on one post or two legs; front (and optional back) poster, optional lamp arms on top
//   { p:[x,z], n:[nx,nz] front normal, w, h, y0 bottom edge, legs 1|2, legC, frameC, depth, preset, arg, back:{preset,arg}|null, lamps }
export function buildBillboards(list) {
  for (const b of list) {
    const [x, z] = b.p, base = CITY.groundH(x, z), G = CITY.tile(x, z).b, n = b.n, r = [n[1], -n[0]], ang = Math.atan2(r[1], r[0]);
    const w = b.w || 5.1, h = b.h || 2.4, y0 = b.y0 ?? 1.6, dp = b.depth || 0.32;
    const legC = tt(L.PRECAST, b.legC || '#3d5b3e', 0.9), frC = tt(L.PRECAST, b.frameC || '#3a4d3c', 0.9);
    const c = [x - n[0] * dp / 2, z - n[1] * dp / 2];                                   // board centre (front face at p)
    CITY.box(G, c[0], base + y0 - 0.12, c[1], w + 0.24, h + 0.24, dp, ang, frC, L.PRECAST, FT.STEEL, frC, L.PRECAST, FT.STEEL);
    const legs = b.legs === 1 ? [0] : [-w * 0.27, w * 0.27], lh = y0 + h * 0.55, lw = b.legs === 1 ? 0.34 : 0.2;
    for (const o of legs) {
      const lx = c[0] + r[0] * o - n[0] * (dp / 2 + lw / 2), lz = c[1] + r[1] * o - n[1] * (dp / 2 + lw / 2);
      CITY.box(G, lx, base - 0.05, lz, lw, lh, lw, ang, legC, L.PRECAST, FT.STEEL, legC, L.PRECAST, FT.STEEL);
      CITY.addObst(lx, lz, lw * 0.8, 'b');
    }
    addSign({ c: [x + n[0] * 0.02, base + y0 + h / 2, z + n[1] * 0.02], n, w, h, preset: b.preset, arg: b.arg, glow: b.glow ?? 0.5 });
    if (b.back) addSign({ c: [c[0] - n[0] * (dp / 2 + 0.02), base + y0 + h / 2, c[1] - n[1] * (dp / 2 + 0.02)], n: [-n[0], -n[1]], w, h, preset: b.back.preset, arg: b.back.arg, glow: b.glow ?? 0.5 });
    if (b.lamps) for (const o of [-w * 0.3, w * 0.3]) {                                   // gooseneck floodlights over the poster
      const lx = x + r[0] * o + n[0] * 0.45, lz = z + r[1] * o + n[1] * 0.45;
      CITY.box(G, lx, base + y0 + h + 0.05, lz, 0.08, 0.08, 0.9, ang, legC, L.PRECAST, FT.STEEL);
      CITY.box(G, lx + n[0] * 0.45, base + y0 + h - 0.05, lz + n[1] * 0.45, 0.4, 0.12, 0.22, ang, tt(L.PRECAST, '#2b2c2e'), L.PRECAST, FT.STEEL);
    }
  }
}

// triangular sign prism on a column or a steel lattice tower (brand totems of the shopping zone)
//   { p, h top, bh sign height, w face width, a0 (rad, direction of face 0 normal), faces:[{preset,arg}x3], column, cw, lattice, spots }
export function buildTriPylon(p) {
  const [x, z] = p.p, base = CITY.groundH(x, z), G = CITY.tile(x, z).b, w = p.w, bh = p.bh, top = base + p.h, bot = top - bh;
  const R = w / Math.sqrt(3), ri = w / (2 * Math.sqrt(3)), frame = tt(L.PRECAST, p.frame || '#eceded', 0.9), colC = tt(L.PRECAST, p.column || '#b9bbbd', 0.9);
  const corner = (k) => { const a = p.a0 + Math.PI / 3 + k * 2 * Math.PI / 3; return [x + Math.cos(a) * R, z + Math.sin(a) * R]; };
  for (let k = 0; k < 3; k++) {
    const A = corner(k - 1), B = corner(k), a = p.a0 + k * 2 * Math.PI / 3, n = [Math.cos(a), Math.sin(a)];
    G.quad([A[0], bot, A[1]], [B[0], bot, B[1]], [B[0], top, B[1]], [A[0], top, A[1]], frame, L.PRECAST, 0, null, null, null, null, [n[0], 0, n[1]]);
    const f = p.faces[k] || p.faces[0];
    addSign({ c: [x + n[0] * (ri + 0.03), (bot + top) / 2, z + n[1] * (ri + 0.03)], n, w: w * 0.93, h: bh * 0.9, preset: f.preset, arg: f.arg, glow: 1 });
    if (p.spots) for (const o of [-0.3, 0, 0.3]) {                                          // floodlights on outriggers above the face
      const m = [(A[0] + B[0]) / 2 + (B[0] - A[0]) * o + n[0] * 0.9, (A[1] + B[1]) / 2 + (B[1] - A[1]) * o + n[1] * 0.9];
      CITY.box(G, m[0], top + 0.1, m[1], 0.25, 0.25, 0.35, a, tt(L.PRECAST, '#3a3c3e'), L.PRECAST, FT.STEEL);
      CITY.box(G, (m[0] + x) / 2, top, (m[1] + z) / 2, 0.06, 0.06, 1.0, a + Math.PI / 2, tt(L.PRECAST, '#3a3c3e'), L.PRECAST, FT.STEEL);
    }
  }
  const C = [corner(0), corner(1), corner(2)];
  G.tri([C[0][0], top, C[0][1]], [C[1][0], top, C[1][1]], [C[2][0], top, C[2][1]], frame, L.PRECAST, 0, null, null, null, [0, 1, 0]);
  G.tri([C[0][0], bot, C[0][1]], [C[1][0], bot, C[1][1]], [C[2][0], bot, C[2][1]], frame, L.PRECAST, 0, null, null, null, [0, -1, 0]);
  if (p.lattice) { // three-legged steel lattice tapering from lrBase to lr, horizontal rings and zig-zag bracing on each side
    const lrT = p.lr || 1.1, lrB = p.lrBase || lrT, steel = tt(L.PRECAST, p.column || '#5d6266', 0.9);
    const dirs = [0, 1, 2].map(k => { const a = p.a0 + Math.PI / 3 + k * 2 * Math.PI / 3; return [Math.cos(a), Math.sin(a)]; });
    const L0 = bot - base, at = (d, y) => { const r = lrB + (lrT - lrB) * (y - base) / L0; return [x + d[0] * r, z + d[1] * r]; };
    const strip = (P0, y0, P1, y1, t) => { // square steel tube between two points
      const A = [P0[0], y0, P0[1]], B = [P1[0], y1, P1[1]], ax = [B[0] - A[0], B[1] - A[1], B[2] - A[2]], la = Math.hypot(...ax) || 1;
      const a = ax.map(v => v / la), up = Math.abs(a[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
      const cr = (u, v) => [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]], nz = (v) => { const l = Math.hypot(...v) || 1; return v.map(q => q / l); };
      const e1 = nz(cr(a, up)), e2 = nz(cr(a, e1)), P = (Q, s1, s2) => [Q[0] + (e1[0] * s1 + e2[0] * s2) * t, Q[1] + (e1[1] * s1 + e2[1] * s2) * t, Q[2] + (e1[2] * s1 + e2[2] * s2) * t];
      for (const [s1, s2, t1, t2, n] of [[1, 1, 1, -1, e1], [-1, 1, -1, -1, e1.map(v => -v)], [1, 1, -1, 1, e2], [1, -1, -1, -1, e2.map(v => -v)]])
        G.quad(P(A, s1, s2), P(B, s1, s2), P(B, t1, t2), P(A, t1, t2), steel, L.PRECAST, FT.STEEL, null, null, null, null, n);
    };
    for (const d of dirs) { // legs as vertical-ish members (crossed strips)
      const A = at(d, base), B = at(d, bot);
      strip(A, base, B, bot, 0.13);
      CITY.box(G, A[0], base, A[1], 0.5, 0.25, 0.5, 0, tt(L.PRECAST, '#9b9b96'), L.PRECAST, 0);
    }
    const rings = Math.max(3, Math.round(L0 / 1.8));
    for (let i = 0; i <= rings; i++) {
      const y = base + 0.3 + (L0 - 0.4) * i / rings, y2 = base + 0.3 + (L0 - 0.4) * (i + 1) / rings;
      for (let k = 0; k < 3; k++) {
        const a = dirs[k], b = dirs[(k + 1) % 3];
        strip(at(a, y), y, at(b, y), y, 0.05);
        if (i < rings) { const [s0, s1] = i % 2 ? [at(a, y), at(b, y2)] : [at(b, y), at(a, y2)]; strip(s0, y, s1, y2, 0.04); }
      }
    }
    CITY.addObst(x, z, lrB + 0.2, 'b');
  } else {
    const cw = p.cw || 0.9;
    CITY.box(G, x, base, z, cw, bot - base, cw, p.a0, colC, L.PRECAST, 0, colC, L.PRECAST, 0);
    CITY.addObst(x, z, cw * 0.75, 'b');
  }
}
