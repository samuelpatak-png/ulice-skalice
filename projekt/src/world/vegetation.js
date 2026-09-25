// Vegetation: procedural trees & bushes (6 kinds, 19 variants), chunked GPU instancing with
// 3 LODs (full model / reduced cards / baked multi-view impostor), dithered LOD cross-fades,
// wind sway, alpha-tested shadow casters and coverage-preserving alpha for leaf cards.
//
//   const veg = await buildVegetation(scene, [{x, z, k}], { groundH, seed, base });
//   veg.update(camera, dt); veg.obstacles; veg.setQuality('low'|'medium'|'high'); veg.dispose();
//
// Kinds: 0 broadleaf (linden/oak/maple/chestnut), 1 conifer (2 spruce, 2 Scots pine), 2 birch,
//        3 fruit tree (apple/plum/cherry), 4 Lombardy poplar, 5 bush.
// Impostors are baked with S.renderer (or opts.renderer) at init.
import * as THREE from 'three';
import { S, QUALITY } from '../core/state.js';

const V3 = THREE.Vector3;
const UP = new V3(0, 1, 0), XV = new V3(1, 0, 0);
const TAU = Math.PI * 2, DEG = Math.PI / 180;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0; let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hashU(i, s) {
  let n = Math.imul((i | 0) ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul((s | 0) + 0x632be5ab, 0xc2b2ae35);
  n ^= n >>> 16; n = Math.imul(n, 0x7feb352d); n ^= n >>> 15; n = Math.imul(n, 0x846ca68b); n ^= n >>> 16;
  return (n >>> 0) / 4294967296;
}
function randDir(rnd, out = new V3()) {
  const z = rnd() * 2 - 1, a = rnd() * TAU, r = Math.sqrt(1 - z * z);
  return out.set(r * Math.cos(a), z, r * Math.sin(a));
}
function perpTo(d, ang) {
  const a = Math.abs(d.y) < 0.95 ? UP : XV;
  const p1 = new V3().crossVectors(d, a).normalize(), p2 = new V3().crossVectors(d, p1);
  return p1.multiplyScalar(Math.cos(ang)).addScaledVector(p2, Math.sin(ang));
}

// ---------------------------------------------------------------------------------------------
// Texture layers
// ---------------------------------------------------------------------------------------------
const LY = { BARK: 0, BIRCH: 1, LINDEN: 2, OAK: 3, MAPLE: 4, SPRUCE: 5, PINE: 6, BIRCHL: 7, FRUIT: 8, POPLAR: 9, BUSH: 10, CHESTNUT: 11, APPLE: 12 };
const NLEAF = 11;          // leaf array layers = LY 2..12
const TEX = 512;           // leaf / bark texture size

const LEAFPAINT = {
  [LY.LINDEN]: { kind: 'spray', shape: 'ovate', n: 125, len: [44, 64], wid: 0.44, h: [74, 92], s: [40, 56], l: [21, 32], spread: [0.5, 1.15], slot: 0.065, pet: 9, under: 0.14, sides: 4 },
  [LY.OAK]: { kind: 'spray', shape: 'oak', n: 105, len: [52, 76], wid: 0.36, h: [68, 86], s: [34, 50], l: [17, 27], spread: [0.4, 1.0], slot: 0.07, pet: 4, under: 0.12, sides: 4 },
  [LY.MAPLE]: { kind: 'spray', shape: 'maple', n: 64, len: [58, 84], wid: 1, h: [78, 96], s: [42, 58], l: [21, 32], spread: [0.5, 1.2], slot: 0.08, pet: 20, under: 0.12, sides: 4 },
  [LY.CHESTNUT]: { kind: 'palm', shape: 'obovate', n: 17, len: [58, 88], wid: 0.3, h: [82, 98], s: [36, 50], l: [17, 27], spread: [0.4, 1.1], slot: 0.1, pet: 24, under: 0.1, sides: 3 },
  [LY.BIRCHL]: { kind: 'spray', shape: 'birch', n: 112, len: [28, 42], wid: 0.5, h: [66, 82], s: [48, 62], l: [28, 38], spread: [0.5, 1.3], slot: 0.05, pet: 8, under: 0.12, sides: 5 },
  [LY.FRUIT]: { kind: 'spray', shape: 'elliptic', n: 118, len: [42, 60], wid: 0.34, h: [80, 96], s: [38, 52], l: [22, 32], spread: [0.4, 1.0], slot: 0.06, pet: 6, under: 0.15, sides: 4 },
  [LY.APPLE]: { kind: 'spray', shape: 'elliptic', n: 105, len: [42, 60], wid: 0.34, h: [80, 96], s: [38, 52], l: [22, 32], spread: [0.4, 1.0], slot: 0.06, pet: 6, under: 0.15, sides: 4, apples: 5 },
  [LY.POPLAR]: { kind: 'spray', shape: 'deltoid', n: 150, len: [32, 48], wid: 0.5, h: [74, 90], s: [38, 52], l: [21, 31], spread: [0.35, 0.9], slot: 0.05, pet: 11, under: 0.12, sides: 4 },
  [LY.BUSH]: { kind: 'spray', shape: 'elliptic', n: 230, len: [24, 38], wid: 0.38, h: [84, 104], s: [32, 46], l: [18, 28], spread: [0.4, 1.3], slot: 0.045, pet: 3, under: 0.1, sides: 6 },
  [LY.SPRUCE]: { kind: 'spruce' },
  [LY.PINE]: { kind: 'pine' },
};

function canvas2d(n) { const c = document.createElement('canvas'); c.width = c.height = n; return [c, c.getContext('2d', { willReadFrequently: true })]; }
const hsl = (h, s, l, a = 1) => `hsla(${h.toFixed(1)},${clamp(s, 0, 100).toFixed(1)}%,${clamp(l, 0, 100).toFixed(1)}%,${a})`;
const nrmCol = (x, y, z) => { const l = Math.hypot(x, y, z) || 1; return `rgb(${Math.round(x / l * 127 + 128)},${Math.round(y / l * 127 + 128)},${Math.round(z / l * 127 + 128)})`; };

const serr = (t, n, k) => 1 - k * (t * n - Math.floor(t * n));
const PROF = {
  ovate: t => Math.pow(Math.sin(Math.PI * Math.pow(t, 0.62)), 0.8) * serr(t, 12, 0.08),
  oak: t => Math.pow(Math.sin(Math.PI * Math.pow(t, 1.1)), 0.7) * (0.5 + 0.5 * Math.pow(Math.abs(Math.sin(Math.PI * t * 4.5)), 0.65)),
  elliptic: t => Math.pow(Math.sin(Math.PI * t), 0.85) * serr(t, 16, 0.05),
  obovate: t => Math.pow(Math.sin(Math.PI * Math.pow(t, 1.5)), 0.8) * serr(t, 14, 0.06),
  deltoid: t => Math.min(1, t / 0.22) * Math.pow(1 - t, 0.85) * 1.15 * serr(t, 14, 0.07),
  birch: t => Math.pow(Math.min(1, t / 0.3), 0.7) * Math.pow(1 - t, 0.9) * 1.1 * serr(t, 12, 0.12),
};
function leafPath(shape, L, W) {
  const pts = [];
  if (shape === 'maple') {
    const cy = -0.44 * L, N = 110;
    const lobes = [[0, 1], [0.95, 0.88], [-0.95, 0.88], [1.9, 0.55], [-1.9, 0.55]];
    for (let i = 0; i <= N; i++) {
      const th = -Math.PI + i / N * TAU;
      let r = 0.2;
      for (const [c, a] of lobes) { const d = Math.abs(th - c); r = Math.max(r, a * Math.pow(Math.max(0, Math.cos(Math.min(d * 2.1, Math.PI / 2))), 1.5)); }
      r *= 0.56 * L * (1 - 0.07 * Math.abs(Math.sin(th * 15)));
      if (Math.abs(Math.abs(th) - Math.PI) < 0.35) r *= 0.55 + 0.45 * Math.abs(Math.abs(th) - Math.PI) / 0.35;   // petiole notch
      pts.push([Math.sin(th) * r, cy - Math.cos(th) * r]);
    }
  } else {
    const prof = PROF[shape] || PROF.elliptic, N = 28, right = [], left = [];
    for (let i = 0; i <= N; i++) { const t = i / N, w = prof(t) * W; right.push([w, -t * L]); left.push([-w, -t * L]); }
    pts.push(...right, ...left.reverse());
  }
  const p = new Path2D(); p.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) p.lineTo(pts[i][0], pts[i][1]);
  p.closePath();
  return p;
}
function drawLeaf(A, N, x, y, ang, L, W, shape, h, s, l, rnd) {
  const path = leafPath(shape, L, W);
  A.save(); A.translate(x, y); A.rotate(ang);
  const g = A.createLinearGradient(0, 0, 0, -L);
  g.addColorStop(0, hsl(h - 2, s, l - 5)); g.addColorStop(0.55, hsl(h, s, l + 2)); g.addColorStop(1, hsl(h + 5, s - 3, l - 1));
  A.fillStyle = g; A.fill(path);
  A.save(); A.clip(path);
  A.fillStyle = 'rgba(255,255,220,0.05)'; A.fillRect(0, -L * 1.1, L, L * 1.2);          // fold: one half catches more light
  A.strokeStyle = hsl(h + 6, s - 12, l + 16, 0.5); A.lineWidth = Math.max(1, L * 0.02);
  A.beginPath(); A.moveTo(0, 0); A.lineTo(0, -L * 0.94); A.stroke();
  A.lineWidth = Math.max(0.6, L * 0.009); A.strokeStyle = hsl(h + 6, s - 12, l + 12, 0.28);
  A.beginPath();
  for (let i = 1; i <= 6; i++) { const t = i / 7.3; A.moveTo(0, -t * L); A.lineTo(L * 0.5, -(t + 0.14) * L); A.moveTo(0, -t * L); A.lineTo(-L * 0.5, -(t + 0.14) * L); }
  A.stroke();
  A.restore();
  A.strokeStyle = hsl(h, s, l - 9, 0.4); A.lineWidth = 0.8; A.stroke(path);
  A.restore();
  // normal: random tilt + valley fold along the midrib
  const ta = rnd() * TAU, tm = rnd() * 0.55;
  const n0 = [Math.cos(ta) * Math.sin(tm), Math.sin(ta) * Math.sin(tm), Math.cos(tm)];
  const rx = Math.cos(ang), ry = -Math.sin(ang), f = 0.3;
  N.save(); N.translate(x, y); N.rotate(ang);
  N.fillStyle = nrmCol(n0[0] - rx * f, n0[1] - ry * f, n0[2]); N.fill(path);
  N.save(); N.clip(path); N.fillStyle = nrmCol(n0[0] + rx * f, n0[1] + ry * f, n0[2]); N.fillRect(-L, -L * 1.1, L, L * 1.2); N.restore();
  N.restore();
}

function paintSpray(A, N, Z, rnd, o) {
  const R = (a, b) => a + (b - a) * rnd();
  const twigs = [];
  const mk = (x0, y0, x1, y1, bend, w) => {
    const t = { x0, y0, x1, y1, cx: (x0 + x1) / 2 + (y1 - y0) * bend, cy: (y0 + y1) / 2 - (x1 - x0) * bend, w };
    twigs.push(t); return t;
  };
  const bz = (t, w) => { const u = 1 - t; return [u * u * w.x0 + 2 * u * t * w.cx + t * t * w.x1, u * u * w.y0 + 2 * u * t * w.cy + t * t * w.y1]; };
  const bzd = (t, w) => { const u = 1 - t; const dx = 2 * u * (w.cx - w.x0) + 2 * t * (w.x1 - w.cx), dy = 2 * u * (w.cy - w.y0) + 2 * t * (w.y1 - w.cy); return Math.atan2(dx, -dy); };
  const main = mk(Z * R(0.47, 0.53), Z * 1.01, Z * R(0.42, 0.58), Z * R(0.1, 0.16), R(-0.12, 0.12), Z * 0.013);
  const ns = o.sides || 4;
  for (let i = 0; i < ns; i++) {
    const t = 0.16 + i * (0.64 / ns) + R(0, 0.05);
    const [x, y] = bz(t, main), a0 = bzd(t, main), side = i % 2 ? 1 : -1;
    const a = a0 + side * R(0.55, 1.0), len = Z * R(0.28, 0.42) * (1 - t * 0.3);
    mk(x, y, clamp(x + Math.sin(a) * len, Z * 0.1, Z * 0.9), clamp(y - Math.cos(a) * len, Z * 0.08, Z * 0.92), side * R(0.04, 0.16), Z * 0.0075);
  }
  const slots = [];
  for (const w of twigs) {
    const len = Math.hypot(w.x1 - w.x0, w.y1 - w.y0), n = Math.max(2, Math.round(len / (o.slot * Z)));
    for (let k = 0; k < n; k++) slots.push({ w, t: 0.1 + 0.9 * (k + R(0, 0.6)) / n, side: k % 2 ? 1 : -1 });
    slots.push({ w, t: 1, side: 0 });
  }
  // twigs (drawn below the leaves)
  A.lineCap = 'round';
  for (const w of twigs) {
    A.strokeStyle = hsl(R(18, 30), R(22, 35), R(16, 24)); A.lineWidth = w.w;
    A.beginPath(); A.moveTo(w.x0, w.y0); A.quadraticCurveTo(w.cx, w.cy, w.x1, w.y1); A.stroke();
  }
  const leaves = [];
  const m = 6;
  const inside = (x, y) => x > m && x < Z - m && y > m && y < Z - m;
  for (let i = 0; i < o.n * 1.6 && leaves.length < o.n; i++) {
    const sl = slots[Math.floor(rnd() * slots.length)];
    const [x, y] = bz(sl.t, sl.w), a0 = bzd(sl.t, sl.w);
    const side = sl.side || (rnd() < 0.5 ? -1 : 1);
    const ang = sl.side === 0 ? a0 + R(-0.3, 0.3) : a0 + side * R(o.spread[0], o.spread[1]);
    let L = R(o.len[0], o.len[1]) * (1 - 0.25 * sl.t);
    const pet = o.pet * R(0.6, 1.2);
    const dx = Math.sin(ang), dy = -Math.cos(ang);
    const bx = x + dx * pet, by = y + dy * pet;
    const W = L * o.wid;
    for (let tries = 0; tries < 4; tries++) {
      const ok = inside(bx, by) && inside(bx + dx * L, by + dy * L) &&
        (o.kind === 'palm' || (inside(bx + dx * L * 0.45 - dy * W, by + dy * L * 0.45 + dx * W) && inside(bx + dx * L * 0.45 + dy * W, by + dy * L * 0.45 - dx * W)));
      if (ok) break; L *= 0.75;
    }
    if (L < o.len[0] * 0.5 || !inside(bx + dx * L, by + dy * L)) continue;
    leaves.push({ x, y, bx, by, ang, L, W, depth: rnd() });
  }
  leaves.sort((a, b) => a.depth - b.depth);
  for (const lf of leaves) {
    const under = rnd() < o.under;
    let h = R(o.h[0], o.h[1]), s = R(o.s[0], o.s[1]), l = R(o.l[0], o.l[1]);
    l *= 0.7 + 0.35 * lf.depth;
    if (under) { s -= 16; l += 9; h -= 4; }
    A.strokeStyle = hsl(h - 20, s - 15, l - 4); A.lineWidth = 1.4;
    A.beginPath(); A.moveTo(lf.x, lf.y); A.lineTo(lf.bx, lf.by); A.stroke();
    if (o.kind === 'palm') {
      const k = 5 + (rnd() < 0.5 ? 2 : 0), spreadA = 1.35;
      for (let j = 0; j < k; j++) {
        const f = (j / (k - 1)) * 2 - 1, sz = 1 - 0.45 * Math.abs(f);
        const L2 = lf.L * sz, a2 = lf.ang + f * spreadA;
        const tx = lf.bx + Math.sin(a2) * L2, ty = lf.by - Math.cos(a2) * L2;
        if (!inside(tx, ty)) continue;
        drawLeaf(A, N, lf.bx, lf.by, a2, L2, L2 * o.wid, o.shape, h + R(-2, 2), s, l + R(-2, 2), rnd);
      }
    } else drawLeaf(A, N, lf.bx, lf.by, lf.ang, lf.L, lf.W, o.shape, h, s, l, rnd);
  }
  if (o.apples) {
    for (let i = 0; i < o.apples; i++) {
      const x = R(0.2, 0.8) * Z, y = R(0.25, 0.8) * Z, r = R(10, 15);
      const hue = R(-4, 28);
      const g = A.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.1, x, y, r);
      g.addColorStop(0, hsl(hue + 20, 80, 62)); g.addColorStop(0.5, hsl(hue, 72, 40)); g.addColorStop(1, hsl(hue - 4, 70, 24));
      A.fillStyle = g; A.beginPath(); A.arc(x, y, r, 0, TAU); A.fill();
      N.fillStyle = nrmCol(0, 0, 1); N.beginPath(); N.arc(x, y, r, 0, TAU); N.fill();
      for (const [ox, oy] of [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]]) {
        N.fillStyle = nrmCol(ox * 0.8, -oy * 0.8, 0.6); N.beginPath(); N.arc(x + ox * r * 0.6, y + oy * r * 0.6, r * 0.45, 0, TAU); N.fill();
      }
    }
  }
}

function paintSpruce(A, N, Z, rnd) {
  const R = (a, b) => a + (b - a) * rnd();
  const x0 = Z * 0.5, y0 = Z * 1.0, y1 = Z * 0.03;
  A.lineCap = 'round'; N.lineCap = 'round';
  A.strokeStyle = hsl(22, 30, 20); A.lineWidth = 5; A.beginPath(); A.moveTo(x0, y0); A.lineTo(x0, y1); A.stroke();
  const twigs = [];
  for (let y = y0 - 12; y > y1 + 14; y -= R(8, 12)) {
    const t = (y0 - y) / (y0 - y1);
    const Lmax = Z * 0.44 * Math.pow(1 - t, 0.5) + Z * 0.05;
    for (const side of [-1, 1]) twigs.push({ y, t, side, a: side * R(0.8, 1.15), L: Lmax * R(0.75, 1.05), d: rnd() });
  }
  twigs.sort((a, b) => a.d - b.d);
  for (const tw of twigs) {
    const sa = Math.sin(tw.a), ca = Math.cos(tw.a);
    const xe = clamp(x0 + sa * tw.L, 8, Z - 8), ye = clamp(tw.y - ca * tw.L + tw.L * 0.12, 8, Z - 8);
    const L = Math.hypot(xe - x0, ye - tw.y), ta = Math.atan2(xe - x0, -(ye - tw.y));
    A.strokeStyle = hsl(24, 30, 22); A.lineWidth = 1.6; A.beginPath(); A.moveTo(x0, tw.y); A.lineTo(xe, ye); A.stroke();
    const shade = 0.72 + 0.35 * tw.d;
    const h = R(132, 150), s = R(20, 32), l = R(14, 21) * shade;
    const tilt = rnd() * TAU, tm = R(0.1, 0.5);
    const nc = nrmCol(Math.cos(tilt) * Math.sin(tm), Math.sin(tilt) * Math.sin(tm), Math.cos(tm));
    const pathOld = new Path2D(), pathNew = new Path2D();
    const step = 2.6;
    for (let d = 4; d < L; d += step) {
      const px = x0 + Math.sin(ta) * d, py = tw.y - Math.cos(ta) * d;
      const young = d > L * 0.78;
      for (const ns of [-1, 1]) {
        const na = ta + ns * R(0.6, 1.25), nl = R(6, 10.5) * (young ? 0.85 : 1);
        const p = young ? pathNew : pathOld;
        p.moveTo(px, py); p.lineTo(px + Math.sin(na) * nl, py - Math.cos(na) * nl);
      }
      if (rnd() < 0.5) { const na = ta + R(-0.4, 0.4), nl = R(5, 8); (young ? pathNew : pathOld).moveTo(px, py); (young ? pathNew : pathOld).lineTo(px + Math.sin(na) * nl, py - Math.cos(na) * nl); }
    }
    A.lineWidth = 1.5;
    A.strokeStyle = hsl(h, s, l); A.stroke(pathOld);
    A.strokeStyle = hsl(R(92, 105), R(38, 50), R(28, 36) * shade); A.stroke(pathNew);
    N.lineWidth = 1.5; N.strokeStyle = nc; N.stroke(pathOld); N.stroke(pathNew);
  }
}

function paintPine(A, N, Z, rnd) {
  const R = (a, b) => a + (b - a) * rnd();
  A.lineCap = 'round'; N.lineCap = 'round';
  const bx = Z * 0.5, by = Z * 1.0;
  const tufts = [];
  const nT = 4 + Math.floor(rnd() * 2);
  for (let i = 0; i < nT; i++) {
    const a = (i / (nT - 1) - 0.5) * 1.5 + R(-0.12, 0.12);
    const d = Z * R(0.42, 0.62) * (1 - Math.abs(a) * 0.25);
    tufts.push({ x: bx + Math.sin(a) * d, y: by - Math.cos(a) * d, a });
  }
  const jx = bx + R(-10, 10), jy = Z * 0.7;
  A.strokeStyle = hsl(22, 38, 26); A.lineWidth = 6; A.beginPath(); A.moveTo(bx, by); A.lineTo(jx, jy); A.stroke();
  A.lineWidth = 3.5;
  for (const t of tufts) { A.beginPath(); A.moveTo(jx, jy); A.lineTo(t.x, t.y); A.stroke(); }
  const needles = [];
  for (const t of tufts) {
    const n = 120;
    for (let i = 0; i < n; i++) {
      const u = rnd(), a = t.a + (u * 2 - 1) * 1.6, nl = Z * R(0.1, 0.2) * (1 - 0.3 * Math.abs(u * 2 - 1));
      const ox = t.x + R(-6, 6), oy = t.y + R(0, 18);
      needles.push({ x: ox, y: oy, x1: ox + Math.sin(a) * nl, y1: oy - Math.cos(a) * nl, c: ox + Math.sin(a) * nl * 0.5 + R(-5, 5), cy: oy - Math.cos(a) * nl * 0.5 + R(-2, 6), d: rnd() });
    }
  }
  needles.sort((a, b) => a.d - b.d);
  const bins = 6;
  for (let b = 0; b < bins; b++) {
    const pa = new Path2D();
    for (let i = Math.floor(needles.length * b / bins); i < Math.floor(needles.length * (b + 1) / bins); i++) {
      const q = needles[i];
      const x1 = clamp(q.x1, 4, Z - 4), y1 = clamp(q.y1, 4, Z - 4);
      pa.moveTo(q.x, q.y); pa.quadraticCurveTo(q.c, q.cy, x1, y1);
    }
    const sh = 0.7 + 0.4 * b / (bins - 1);
    A.lineWidth = 1.5; A.strokeStyle = hsl(R(88, 102), R(18, 28), R(24, 32) * sh); A.stroke(pa);
    const tl = rnd() * TAU, tm = R(0.1, 0.45);
    N.lineWidth = 1.5; N.strokeStyle = nrmCol(Math.cos(tl) * Math.sin(tm), Math.sin(tl) * Math.sin(tm), Math.cos(tm)); N.stroke(pa);
  }
  for (const t of tufts) { A.fillStyle = hsl(25, 45, 30); A.beginPath(); A.arc(t.x, t.y + 6, 4, 0, TAU); A.fill(); }
}

// returns { alb: Uint8Array RGBA, nrm: Uint8Array RGBA, mean: [r,g,b] (sRGB 0..1) }
function paintLeafLayer(layer, rnd) {
  const Z = TEX;
  const [, A] = canvas2d(Z), [, N] = canvas2d(Z);
  N.fillStyle = 'rgb(128,128,255)'; N.fillRect(0, 0, Z, Z);
  const o = LEAFPAINT[layer];
  if (o.kind === 'spruce') paintSpruce(A, N, Z, rnd);
  else if (o.kind === 'pine') paintPine(A, N, Z, rnd);
  else paintSpray(A, N, Z, rnd, o);
  const a = A.getImageData(0, 0, Z, Z).data, n = N.getImageData(0, 0, Z, Z).data;
  let sr = 0, sg = 0, sb = 0, c = 0;
  for (let i = 0; i < a.length; i += 4) if (a[i + 3] > 200) { sr += a[i]; sg += a[i + 1]; sb += a[i + 2]; c++; }
  c = Math.max(c, 1); const mr = sr / c, mg = sg / c, mb = sb / c;
  const alb = new Uint8Array(a.length), nrm = new Uint8Array(n.length);
  for (let i = 0; i < a.length; i += 4) {
    const al = a[i + 3];
    if (al < 250) { const f = al / 255; alb[i] = a[i] * f + mr * (1 - f); alb[i + 1] = a[i + 1] * f + mg * (1 - f); alb[i + 2] = a[i + 2] * f + mb * (1 - f); }
    else { alb[i] = a[i]; alb[i + 1] = a[i + 1]; alb[i + 2] = a[i + 2]; }
    alb[i + 3] = al;
    nrm[i] = n[i]; nrm[i + 1] = n[i + 1]; nrm[i + 2] = n[i + 2]; nrm[i + 3] = 255;
  }
  return { alb, nrm, mean: [mr / 255, mg / 255, mb / 255], cover: c / (Z * Z) };
}

function paintBark(rnd, birch) {
  const Z = TEX, R = (a, b) => a + (b - a) * rnd();
  const [, A] = canvas2d(Z), [, H] = canvas2d(Z);
  const wrap = (fn) => { for (const ox of [-Z, 0, Z]) for (const oy of [-Z, 0, Z]) fn(ox, oy); };
  if (birch) {
    A.fillStyle = '#e2ded2'; A.fillRect(0, 0, Z, Z); H.fillStyle = '#c0c0c0'; H.fillRect(0, 0, Z, Z);
    for (let i = 0; i < 180; i++) { const y = R(0, Z), h = R(1, 5); A.fillStyle = `rgba(${R(110, 150) | 0},${R(100, 130) | 0},${R(85, 110) | 0},${R(0.03, 0.09)})`; A.fillRect(0, y, Z, h); }
    for (let i = 0; i < 8; i++) { const x = R(0, Z), y = R(0, Z), w = R(40, 120), h = R(20, 60); wrap((ox, oy) => { A.fillStyle = `rgba(210,175,140,${R(0.12, 0.25)})`; A.beginPath(); A.ellipse(x + ox, y + oy, w, h, 0, 0, TAU); A.fill(); }); }
    for (let i = 0; i < 480; i++) {
      const x = R(0, Z), y = R(0, Z), w = R(5, 30), h = R(1.2, 3.4), a = R(0.45, 0.9);
      wrap((ox, oy) => {
        A.fillStyle = `rgba(62,55,50,${a})`; A.beginPath(); A.ellipse(x + ox, y + oy, w / 2, h / 2, 0, 0, TAU); A.fill();
        H.fillStyle = 'rgba(70,70,70,0.9)'; H.beginPath(); H.ellipse(x + ox, y + oy, w / 2, h / 2, 0, 0, TAU); H.fill();
      });
    }
    for (let i = 0; i < 28; i++) {
      const x = R(0, Z), y = R(0, Z), w = R(14, 80), h = R(5, 24), n = 16, pts = [];
      for (let j = 0; j < n; j++) { const a = j / n * TAU, r = R(0.55, 1.0); pts.push([Math.cos(a) * w * r, Math.sin(a) * h * r]); }
      wrap((ox, oy) => {
        for (const [ctx, col] of [[A, `rgba(26,23,22,${R(0.85, 0.97)})`], [H, 'rgba(40,40,40,1)']]) {
          ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(x + ox + pts[0][0], y + oy + pts[0][1]);
          for (const p of pts) ctx.lineTo(x + ox + p[0], y + oy + p[1]); ctx.closePath(); ctx.fill();
        }
      });
    }
  } else {   // fallback brown bark (only used if the photo texture fails to load)
    A.fillStyle = '#5e5242'; A.fillRect(0, 0, Z, Z); H.fillStyle = '#909090'; H.fillRect(0, 0, Z, Z);
    for (let i = 0; i < 260; i++) {
      const x = R(0, Z), w = R(2, 7), y = R(0, Z), h = R(30, 160);
      wrap((ox, oy) => { A.fillStyle = `rgba(30,24,18,${R(0.4, 0.8)})`; A.fillRect(x + ox, y + oy, w, h); H.fillStyle = 'rgba(20,20,20,0.9)'; H.fillRect(x + ox, y + oy, w, h); });
    }
  }
  const a = A.getImageData(0, 0, Z, Z).data, h = H.getImageData(0, 0, Z, Z).data;
  const alb = new Uint8Array(a.length), nrm = new Uint8Array(a.length);
  const hv = (x, y) => h[(((y + Z) % Z) * Z + ((x + Z) % Z)) * 4] / 255;
  const k = birch ? 3.0 : 6.0;
  for (let y = 0; y < Z; y++) for (let x = 0; x < Z; x++) {
    const i = (y * Z + x) * 4, hh = hv(x, y);
    const dx = (hv(x + 1, y) - hv(x - 1, y)) * k, dy = (hv(x, y + 1) - hv(x, y - 1)) * k;
    const l = Math.hypot(dx, dy, 1);
    nrm[i] = (-dx / l) * 127 + 128; nrm[i + 1] = (-dy / l) * 127 + 128; nrm[i + 2] = (1 / l) * 127 + 128;
    nrm[i + 3] = (birch ? lerp(0.95, 0.62, hh) : 0.9) * 255;
    alb[i] = a[i]; alb[i + 1] = a[i + 1]; alb[i + 2] = a[i + 2]; alb[i + 3] = lerp(0.62, 1.0, smooth(0.2, 0.7, hh)) * 255;
  }
  return { alb, nrm };
}

function dataTex(data, size, srgb, repeat = true) {
  const t = new THREE.DataTexture(data, size, size, THREE.RGBAFormat, THREE.UnsignedByteType);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.wrapS = t.wrapT = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter;
  t.generateMipmaps = true; t.anisotropy = 4; t.needsUpdate = true;
  return t;
}
async function loadBitmapTex(url, srgb) {
  const r = await fetch(url);
  if (!r.ok) throw new Error('missing ' + url);
  const bmp = await createImageBitmap(await r.blob(), { premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
  const t = new THREE.Texture(bmp);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.flipY = false;
  t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter;
  t.generateMipmaps = true; t.anisotropy = 4; t.needsUpdate = true;
  return t;
}

// ---------------------------------------------------------------------------------------------
// Geometry builder
// ---------------------------------------------------------------------------------------------
class VGeo {
  constructor() { this.p = []; this.n = []; this.uv = []; this.c = []; this.d = []; this.t = []; this.idx = []; }
  get nv() { return this.p.length / 3; }
  v(P, N, u, v, col, ao, layer, sway, phase, T) {
    this.p.push(P.x, P.y, P.z); this.n.push(N.x, N.y, N.z); this.uv.push(u, v);
    this.c.push(col[0], col[1], col[2]); this.d.push(ao, layer, sway, phase); this.t.push(T.x, T.y, T.z);
    return this.nv - 1;
  }
  get tris() { return this.idx.length / 3; }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('aCol', new THREE.Float32BufferAttribute(this.c, 3));
    g.setAttribute('aData', new THREE.Float32BufferAttribute(this.d, 4));
    g.setAttribute('aTan', new THREE.Float32BufferAttribute(this.t, 3));
    g.setIndex(this.nv > 65535 ? new THREE.Uint32BufferAttribute(this.idx, 1) : new THREE.Uint16BufferAttribute(this.idx, 1));
    g.computeBoundingSphere(); g.computeBoundingBox();
    return g;
  }
}

// crown envelopes: ellipsoid with lobes (deciduous) or cone (spruce)
class Ellip {
  constructor(c, r, rnd, lobes = 6, amp = 0.16) {
    this.c = c; this.r = r; this.L = [];
    for (let i = 0; i < lobes; i++) this.L.push([randDir(rnd), (rnd() * 2 - 1) * amp + amp * 0.35]);
    this.bottom = c.y - r.y; this.top = c.y + r.y;
  }
  f(P) {
    const qx = (P.x - this.c.x) / this.r.x, qy = (P.y - this.c.y) / this.r.y, qz = (P.z - this.c.z) / this.r.z;
    const rho = Math.hypot(qx, qy, qz); if (rho < 1e-6) return 0;
    let e = 1;
    for (const [d, a] of this.L) { const k = Math.max(0, (qx * d.x + qy * d.y + qz * d.z) / rho); e += a * k * k * k; }
    return rho / e;
  }
  nrm(P, out) {
    return out.set((P.x - this.c.x) / (this.r.x * this.r.x), (P.y - this.c.y) / (this.r.y * this.r.y), (P.z - this.c.z) / (this.r.z * this.r.z)).normalize();
  }
  dist(P, dir, max = 40) {
    const Q = new V3(); let t = 0; const step = 0.15;
    while (t < max) { Q.copy(P).addScaledVector(dir, t + step); if (this.f(Q) > 1) break; t += step; }
    return t;
  }
}
class Cone {
  constructor(H, base, R) { this.H = H; this.base = base; this.R = R; this.bottom = base; this.top = H; this.c = new V3(0, H * 0.4, 0); }
  rAt(y) { return this.R * Math.pow(clamp((this.H - y) / (this.H - this.base), 0, 1), 0.92) + 0.15; }
  f(P) { return Math.hypot(P.x, P.z) / this.rAt(P.y); }
  nrm(P, out) {
    const h = Math.hypot(P.x, P.z) || 1e-3, t = P.y / this.H;
    return out.set(P.x / h, 0.35 + 0.9 * t * t, P.z / h).normalize();
  }
}
function crownAO(cr, P) {
  const rho = cr.f(P);
  const hy = clamp((P.y - cr.bottom) / Math.max(cr.top - cr.bottom, 0.5), 0, 1);
  return (0.3 + 0.7 * smooth(0.12, 1.0, rho)) * (0.58 + 0.42 * hy);
}

function prepBranch(br) {
  const c = [0];
  for (let i = 1; i < br.pts.length; i++) c.push(c[i - 1] + br.pts[i].distanceTo(br.pts[i - 1]));
  br.cum = c; br.len = c[c.length - 1];
  return br;
}
function sampleBr(br, t, P, D) {
  const L = t * br.len; let i = 1;
  while (i < br.pts.length - 1 && br.cum[i] < L) i++;
  const a = br.pts[i - 1], b = br.pts[i], seg = br.cum[i] - br.cum[i - 1];
  const f = seg > 1e-6 ? clamp((L - br.cum[i - 1]) / seg, 0, 1) : 0;
  P.lerpVectors(a, b, f); if (D) D.subVectors(b, a).normalize();
  return lerp(br.rads[i - 1], br.rads[i], f);
}
function grow(start, dir, len, r0, level, o, rnd, crown) {
  const n = o.segs, pts = [start.clone()], rads = [r0];
  const d = dir.clone().normalize(), P = start.clone(), step = len / n;
  const taper = o.taper ?? 0.86;
  for (let i = 1; i <= n; i++) {
    const w = o.wob || 0;
    d.x += (rnd() - 0.5) * w; d.y += (rnd() - 0.5) * w * 0.6 + (o.up || 0) / n - (o.droop || 0) * (i / n) * 2 / n; d.z += (rnd() - 0.5) * w;
    d.normalize();
    P.addScaledVector(d, step); pts.push(P.clone());
    rads.push(r0 * (1 - taper * i / n));
    if (crown && i < n && crown.f(P) > 1.06) break;
  }
  return prepBranch({ pts, rads, level, phase: rnd() });
}

function tube(g, br, seg, o) {
  const pts = br.pts, n = pts.length; if (n < 2) return;
  const T = [], N1 = [], N2 = [];
  for (let i = 0; i < n; i++) T.push(new V3().subVectors(pts[Math.min(i + 1, n - 1)], pts[Math.max(i - 1, 0)]).normalize());
  const a = Math.abs(T[0].y) < 0.9 ? UP : XV;
  let n1 = a.clone().addScaledVector(T[0], -a.dot(T[0])).normalize();
  for (let i = 0; i < n; i++) {
    n1 = n1.clone().addScaledVector(T[i], -n1.dot(T[i])).normalize();
    N1.push(n1); N2.push(new V3().crossVectors(T[i], n1));
  }
  const base = g.nv, P = new V3(), Nn = new V3(), Tg = new V3();
  let vacc = 0;
  const uRep = o.uRep || 1;
  for (let i = 0; i < n; i++) {
    if (i > 0) vacc += pts[i].distanceTo(pts[i - 1]);
    for (let j = 0; j <= seg; j++) {
      const th = j / seg * TAU, cs = Math.cos(th), sn = Math.sin(th);
      Nn.copy(N1[i]).multiplyScalar(cs).addScaledVector(N2[i], sn);
      let r = br.rads[i];
      if (o.flare) r *= o.flare(pts[i].y, th);
      P.copy(pts[i]).addScaledVector(Nn, r);
      Tg.copy(N1[i]).multiplyScalar(-sn).addScaledVector(N2[i], cs);
      g.v(P, Nn, j / seg * uRep, vacc / o.vLen, o.col(P), o.ao(P), o.layer, o.sway(P), br.phase, Tg);
    }
  }
  for (let i = 0; i < n - 1; i++) for (let j = 0; j < seg; j++) {
    const a0 = base + i * (seg + 1) + j, b0 = a0 + 1, c0 = a0 + seg + 1, d0 = c0 + 1;
    g.idx.push(a0, b0, c0, b0, d0, c0);
  }
}
function card(g, C, U, V, w, h, layer, cr, o, phase) {
  const cn = new V3().crossVectors(U, V).normalize();
  const P = new V3(), Nr = new V3(), N = new V3();
  const base = g.nv;
  const corners = [[-0.5, -0.5, 0, 1], [0.5, -0.5, 1, 1], [0.5, 0.5, 1, 0], [-0.5, 0.5, 0, 0]];
  for (const [cu, cv, u, v] of corners) {
    P.copy(C).addScaledVector(U, cu * w).addScaledVector(V, cv * h);
    cr.nrm(P, Nr);
    const s = cn.dot(Nr) < 0 ? -1 : 1;
    N.copy(Nr).multiplyScalar(0.8).addScaledVector(cn, 0.2 * s).normalize();
    g.v(P, N, u, v, o.col, crownAO(cr, P) * o.aoK, layer, o.sway(P), phase, U);
  }
  g.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
}

// ---------------------------------------------------------------------------------------------
// Species
// ---------------------------------------------------------------------------------------------
const W = [1, 1, 1];
const SPECIES = {
  linden: { gen: 'decid', H: 16, clear: 2.8, cy: 9.7, rx: 5.0, ry: 6.3, lobes: 7, lobeAmp: 0.16, r0: 0.3, leader: 0.8, trunkWob: 0.04, flare: 0.35,
    n1: 15, e1: [28, 62], len1: 0.9, up1: 0.35, wob1: 0.14, r1: 0.5, n2: 1.7, a2: 42, len2: 0.8, up2: 0.12, droop2: 0.04, wob2: 0.25,
    leaf: { layer: LY.LINDEN, cards: 800, size: 1.15, shell: 0.45, orient: 'out', lod1: 0.24, tint: [1, 1, 1] } },
  oak: { gen: 'decid', H: 14.5, clear: 3.0, cy: 9.0, rx: 6.6, ry: 5.3, lobes: 8, lobeAmp: 0.22, r0: 0.42, leader: 0.58, trunkWob: 0.09, flare: 0.45,
    n1: 11, e1: [10, 48], len1: 0.93, up1: 0.2, wob1: 0.32, r1: 0.55, n2: 1.5, a2: 50, len2: 0.82, up2: 0.08, droop2: 0.03, wob2: 0.42,
    leaf: { layer: LY.OAK, cards: 800, size: 1.2, shell: 0.45, orient: 'out', lod1: 0.24, tint: [0.97, 0.98, 1] } },
  maple: { gen: 'decid', H: 13, clear: 2.4, cy: 7.9, rx: 5.1, ry: 5.2, lobes: 6, lobeAmp: 0.14, r0: 0.28, leader: 0.78, trunkWob: 0.05, flare: 0.3,
    n1: 13, e1: [28, 60], len1: 0.9, up1: 0.3, wob1: 0.18, r1: 0.5, n2: 1.8, a2: 45, len2: 0.8, up2: 0.1, droop2: 0.03, wob2: 0.25,
    leaf: { layer: LY.MAPLE, cards: 760, size: 1.15, shell: 0.45, orient: 'out', lod1: 0.24, tint: [1, 1.02, 0.95] } },
  chestnut: { gen: 'decid', H: 15, clear: 2.6, cy: 9.0, rx: 5.8, ry: 6.0, lobes: 7, lobeAmp: 0.15, r0: 0.36, leader: 0.75, trunkWob: 0.05, flare: 0.4,
    n1: 14, e1: [20, 58], len1: 0.9, up1: 0.3, wob1: 0.2, r1: 0.5, n2: 1.7, a2: 45, len2: 0.8, up2: 0.1, droop2: 0.05, wob2: 0.3,
    leaf: { layer: LY.CHESTNUT, cards: 800, size: 1.25, shell: 0.45, orient: 'out', lod1: 0.24, tint: [0.96, 1, 1] } },
  spruce: { gen: 'spruce', H: 20, r0: 0.3, base: 0.9, R: 3.2, whorl: 0.55, elB: -0.38, elT: 0.45, droop: 0.55, flare: 0.3, leaf: { layer: LY.SPRUCE, tint: [1, 1, 1] } },
  spruce2: { gen: 'spruce', H: 16, r0: 0.25, base: 0.5, R: 2.8, whorl: 0.5, elB: -0.3, elT: 0.5, droop: 0.45, flare: 0.3, leaf: { layer: LY.SPRUCE, tint: [0.95, 1.02, 1.05] } },
  pine: { gen: 'decid', H: 19, clear: 11.0, cy: 16.3, rx: 3.6, ry: 2.8, lobes: 8, lobeAmp: 0.28, r0: 0.27, leader: 0.9, trunkWob: 0.05, lean: 0.05, flare: 0.25, pine: true,
    n1: 13, e1: [4, 42], len1: 0.95, up1: 0.45, wob1: 0.35, r1: 0.42, n2: 1.4, a2: 45, len2: 0.85, up2: 0.3, droop2: 0, wob2: 0.35, stubs: 9,
    leaf: { layer: LY.PINE, cards: 400, size: 1.0, shell: 0.35, orient: 'up', lod1: 0.28, tint: [1, 1, 1] } },
  pine2: { gen: 'decid', H: 22, clear: 13.5, cy: 19.0, rx: 4.0, ry: 3.2, lobes: 8, lobeAmp: 0.3, r0: 0.3, leader: 0.9, trunkWob: 0.06, lean: 0.07, flare: 0.25, pine: true,
    n1: 14, e1: [0, 40], len1: 0.95, up1: 0.5, wob1: 0.38, r1: 0.42, n2: 1.4, a2: 48, len2: 0.85, up2: 0.3, droop2: 0, wob2: 0.38, stubs: 12,
    leaf: { layer: LY.PINE, cards: 430, size: 1.05, shell: 0.35, orient: 'up', lod1: 0.28, tint: [0.95, 1, 1.04] } },
  birch: { gen: 'decid', H: 16, clear: 4.5, cy: 10.6, rx: 3.3, ry: 5.6, lobes: 6, lobeAmp: 0.18, r0: 0.19, leader: 0.93, trunkWob: 0.06, flare: 0.2, birch: true,
    n1: 16, e1: [38, 62], len1: 0.9, up1: 0.25, wob1: 0.15, r1: 0.4, n2: 1.7, a2: 50, len2: 0.78, up2: -0.1, droop2: 0.9, wob2: 0.2,
    leaf: { layer: LY.BIRCHL, cards: 540, size: 0.95, shell: 0.35, orient: 'hang', lod1: 0.26, tint: [1, 1, 1] } },
  birch2: { gen: 'decid', H: 15, clear: 3.8, cy: 10.0, rx: 3.6, ry: 5.3, lobes: 6, lobeAmp: 0.2, r0: 0.15, leader: 0.92, trunkWob: 0.07, flare: 0.2, birch: true,
    stems: 2, stemAngle: 9, stemSpread: 0.22,
    n1: 18, e1: [38, 64], len1: 0.9, up1: 0.25, wob1: 0.15, r1: 0.4, n2: 1.7, a2: 50, len2: 0.78, up2: -0.1, droop2: 1.0, wob2: 0.2,
    leaf: { layer: LY.BIRCHL, cards: 560, size: 0.95, shell: 0.35, orient: 'hang', lod1: 0.26, tint: [1.03, 1.02, 0.95] } },
  birch3: { gen: 'decid', H: 12.5, clear: 3.2, cy: 8.2, rx: 2.9, ry: 4.4, lobes: 6, lobeAmp: 0.18, r0: 0.15, leader: 0.92, trunkWob: 0.08, flare: 0.2, birch: true,
    n1: 14, e1: [40, 65], len1: 0.9, up1: 0.25, wob1: 0.16, r1: 0.4, n2: 1.8, a2: 50, len2: 0.78, up2: -0.1, droop2: 0.8, wob2: 0.2,
    leaf: { layer: LY.BIRCHL, cards: 420, size: 0.9, shell: 0.35, orient: 'hang', lod1: 0.26, tint: [0.97, 1, 1.02] } },
  apple: { gen: 'decid', H: 5.2, clear: 1.2, top1: 1.9, cy: 3.35, rx: 2.8, ry: 1.95, lobes: 6, lobeAmp: 0.18, r0: 0.13, leader: 0.42, trunkWob: 0.12, flare: 0.25,
    n1: 5, e1: [32, 52], len1: 0.95, up1: 0.35, wob1: 0.35, r1: 0.75, n2: 2.6, a2: 55, len2: 0.85, up2: 0.2, droop2: 0.05, wob2: 0.45,
    leaf: { layer: LY.FRUIT, alt: [LY.APPLE, 0.35], cards: 340, size: 0.8, shell: 0.4, orient: 'out', lod1: 0.28, tint: [1, 1, 1] } },
  plum: { gen: 'decid', H: 5.8, clear: 1.1, top1: 2.2, cy: 3.7, rx: 2.3, ry: 2.35, lobes: 6, lobeAmp: 0.18, r0: 0.12, leader: 0.55, trunkWob: 0.1, flare: 0.25,
    n1: 5, e1: [48, 70], len1: 0.95, up1: 0.35, wob1: 0.3, r1: 0.75, n2: 2.6, a2: 45, len2: 0.85, up2: 0.2, droop2: 0.03, wob2: 0.4,
    leaf: { layer: LY.FRUIT, cards: 320, size: 0.8, shell: 0.4, orient: 'out', lod1: 0.28, tint: [0.9, 0.95, 0.97] } },
  cherry: { gen: 'decid', H: 6.4, clear: 1.3, top1: 2.6, cy: 4.1, rx: 2.8, ry: 2.4, lobes: 6, lobeAmp: 0.18, r0: 0.15, leader: 0.6, trunkWob: 0.08, flare: 0.25,
    n1: 6, e1: [35, 60], len1: 0.95, up1: 0.3, wob1: 0.3, r1: 0.7, n2: 2.4, a2: 48, len2: 0.85, up2: 0.15, droop2: 0.05, wob2: 0.4,
    leaf: { layer: LY.FRUIT, cards: 360, size: 0.85, shell: 0.4, orient: 'out', lod1: 0.28, tint: [1.05, 1.03, 0.92] } },
  poplar: { gen: 'decid', H: 25, clear: 1.2, cy: 13.3, rx: 1.9, ry: 12.2, lobes: 5, lobeAmp: 0.12, r0: 0.38, leader: 0.97, trunkWob: 0.02, flare: 0.35,
    n1: 50, e1: [60, 76], len1: 0.92, up1: 0.35, wob1: 0.08, r1: 0.3, n2: 1.3, a2: 30, len2: 0.6, up2: 0.3, droop2: 0, wob2: 0.15,
    leaf: { layer: LY.POPLAR, cards: 800, size: 0.95, shell: 0.3, orient: 'up', lod1: 0.25, tint: [1, 1, 1] } },
  poplar2: { gen: 'decid', H: 22, clear: 1.5, cy: 11.8, rx: 2.3, ry: 10.6, lobes: 6, lobeAmp: 0.14, r0: 0.34, leader: 0.96, trunkWob: 0.03, flare: 0.35,
    n1: 46, e1: [56, 74], len1: 0.92, up1: 0.35, wob1: 0.1, r1: 0.3, n2: 1.3, a2: 32, len2: 0.6, up2: 0.3, droop2: 0, wob2: 0.15,
    leaf: { layer: LY.POPLAR, cards: 760, size: 0.95, shell: 0.3, orient: 'up', lod1: 0.25, tint: [0.96, 1.0, 1.03] } },
  // clipped globe maple (Acer platanoides 'Globosum') of the old-town squares: clear stem, dense round crown
  globe: { gen: 'decid', H: 5.8, clear: 2.3, top1: 2.5, cy: 4.2, rx: 2.2, ry: 1.75, lobes: 6, lobeAmp: 0.07, r0: 0.12, leader: 0.5, trunkWob: 0.04, flare: 0.2,
    n1: 7, e1: [40, 68], len1: 0.95, up1: 0.35, wob1: 0.2, r1: 0.7, n2: 2.8, a2: 48, len2: 0.85, up2: 0.2, droop2: 0.02, wob2: 0.35,
    leaf: { layer: LY.MAPLE, cards: 440, size: 0.72, shell: 0.3, orient: 'out', lod1: 0.3, tint: [0.98, 1.03, 0.93] } },
  // weeping willow: broad crown, long hanging leaf curtains
  willow: { gen: 'decid', H: 13, clear: 2.4, cy: 7.4, rx: 5.6, ry: 5.4, lobes: 7, lobeAmp: 0.14, r0: 0.4, leader: 0.55, trunkWob: 0.09, flare: 0.45,
    n1: 13, e1: [30, 62], len1: 0.9, up1: 0.3, wob1: 0.16, r1: 0.5, n2: 1.9, a2: 50, len2: 0.85, up2: -0.25, droop2: 1.25, wob2: 0.2,
    leaf: { layer: LY.BIRCHL, cards: 980, size: 1.05, shell: 0.42, orient: 'hang', lod1: 0.25, tint: [1.08, 1.1, 0.82] } },
  bushA: { gen: 'decid', bush: true, H: 2.2, cy: 1.05, rx: 1.5, ry: 1.1, lobes: 6, lobeAmp: 0.2, r0: 0.035, stems: 7, stemAngle: [12, 50], stemSpread: 0.3,
    n1: 3, e1: [20, 60], len1: 0.85, up1: 0.2, wob1: 0.3, r1: 0.6, n2: 3, a2: 50, len2: 0.8, up2: 0.1, wob2: 0.4,
    leaf: { layer: LY.BUSH, cards: 190, size: 0.62, shell: 0.3, orient: 'out', lod1: 0.3, tint: [1, 1, 1] } },
  bushB: { gen: 'decid', bush: true, H: 2.8, cy: 1.35, rx: 1.8, ry: 1.4, lobes: 6, lobeAmp: 0.22, r0: 0.04, stems: 8, stemAngle: [8, 45], stemSpread: 0.35,
    n1: 3, e1: [25, 65], len1: 0.85, up1: 0.25, wob1: 0.3, r1: 0.6, n2: 2.5, a2: 50, len2: 0.8, up2: 0.1, wob2: 0.4,
    leaf: { layer: LY.LINDEN, cards: 230, size: 0.72, shell: 0.3, orient: 'out', lod1: 0.3, tint: [1.02, 1.03, 0.95] } },
  bushC: { gen: 'decid', bush: true, H: 1.7, cy: 0.8, rx: 1.2, ry: 0.9, lobes: 6, lobeAmp: 0.2, r0: 0.03, stems: 6, stemAngle: [15, 55], stemSpread: 0.25,
    n1: 3, e1: [20, 60], len1: 0.85, up1: 0.2, wob1: 0.3, r1: 0.6, n2: 3, a2: 50, len2: 0.8, up2: 0.1, wob2: 0.4,
    leaf: { layer: LY.BUSH, cards: 150, size: 0.58, shell: 0.3, orient: 'out', lod1: 0.3, tint: [1.08, 1.06, 0.9] } },
};
const KIND_VARIANTS = [
  ['linden', 'oak', 'maple', 'chestnut', 'globe', 'willow'],   // globe maple / weeping willow only when forced (weight 0)
  ['spruce', 'spruce2', 'pine', 'pine2'],
  ['birch', 'birch2', 'birch3'],
  ['apple', 'plum', 'cherry'],
  ['poplar', 'poplar2'],
  ['bushA', 'bushB', 'bushC'],
];
const KIND_WEIGHTS = [[0.34, 0.2, 0.26, 0.2], [0.3, 0.2, 0.3, 0.2], [0.4, 0.35, 0.25], [0.45, 0.3, 0.25], [0.55, 0.45], [0.4, 0.35, 0.25]];
// base LOD distances (high quality): lod0 end, lod1 end, max-distance fraction of drawDist
const LOD_BASE = [[120, 450, 1], [120, 450, 1], [110, 420, 1], [80, 300, 0.62], [130, 500, 1], [55, 180, 0.3]];

function barkColFn(p) {
  if (p.birch) return (P) => { const k = smooth(0.2, 1.6, P.y); return [lerp(0.32, 1, k), lerp(0.3, 1, k), lerp(0.28, 1, k)]; };
  if (p.pine) { const H = p.H; return (P) => { const k = smooth(0.35 * H, 0.62 * H, P.y); return [lerp(0.95, 1.5, k), lerp(0.95, 0.9, k), lerp(0.95, 0.6, k)]; }; }
  return () => W;
}
function swayFn(H, bush) {
  return bush ? (P) => 0.05 * P.y + 0.03 * Math.hypot(P.x, P.z)
    : (P) => 0.012 * H * Math.pow(clamp(P.y / H, 0, 1.2), 2) + 0.012 * Math.hypot(P.x, P.z);
}

// deciduous / pine / bush generator -> { lod0: VGeo, lod1: VGeo, trunkR, H }
function genDecid(p, rnd) {
  const H = p.H;
  const cr = new Ellip(new V3(0, p.cy, 0), new V3(p.rx, p.ry, p.rx * (0.9 + rnd() * 0.2)), rnd, p.lobes, p.lobeAmp);
  const trunks = [], prim = [], sec = [];
  const nStems = p.stems || 1;
  const sway = swayFn(H, p.bush);
  const P = new V3(), D = new V3();
  // --- stems
  for (let s = 0; s < nStems; s++) {
    let start, dir, len;
    if (p.bush) {
      const a = s / nStems * TAU + rnd() * 0.6, r = p.stemSpread * rnd();
      start = new V3(Math.cos(a) * r, 0, Math.sin(a) * r);
      const el = (90 - lerp(p.stemAngle[0], p.stemAngle[1], rnd())) * DEG;
      dir = new V3(Math.cos(a) * Math.cos(el), Math.sin(el), Math.sin(a) * Math.cos(el));
      len = Math.max(0.5, cr.dist(start.clone().setY(0.05), dir) * 0.92);
      trunks.push(grow(start, dir, len, p.r0 * (0.7 + rnd() * 0.4), 0, { segs: 4, wob: 0.25, up: 0.1, taper: 0.8 }, rnd));
    } else {
      if (nStems === 1) { start = new V3(); dir = new V3((rnd() - 0.5) * (p.lean || 0.02), 1, (rnd() - 0.5) * (p.lean || 0.02)); }
      else {
        const a = s / nStems * TAU + rnd();
        start = new V3(Math.cos(a) * p.stemSpread * 0.5, 0, Math.sin(a) * p.stemSpread * 0.5);
        dir = new V3(Math.cos(a) * Math.sin(p.stemAngle * DEG), 1, Math.sin(a) * Math.sin(p.stemAngle * DEG));
      }
      len = H * p.leader * (nStems > 1 ? 0.95 - s * 0.08 : 1);
      trunks.push(grow(start, dir, len, p.r0 * (nStems > 1 ? 0.8 : 1), 0, { segs: 10, wob: p.trunkWob, up: 0, taper: p.leader > 0.85 ? 0.92 : 0.7 }, rnd));
    }
  }
  // --- primaries
  let k1 = 0;
  for (const tr of trunks) {
    const n1 = p.bush ? p.n1 : Math.round(p.n1 / nStems);
    const h0 = p.bush ? 0.25 : p.clear, h1 = p.bush ? 0.95 : Math.min(p.top1 || tr.len * 0.96, tr.len * 0.96);
    for (let i = 0; i < n1; i++, k1++) {
      const t = clamp(p.bush ? (i + 0.5 + rnd() * 0.5) / (n1 + 0.5) * 0.9 : (h0 + (h1 - h0) * (i + rnd() * 0.7) / n1) / tr.len, 0, 1);
      const r = sampleBr(tr, t, P, D);
      const az = k1 * 2.39996 + rnd() * 0.6;
      const tt = p.bush ? rnd() : clamp((P.y - h0) / Math.max(h1 - h0, 0.1), 0, 1);
      const el = (lerp(p.e1[0], p.e1[1], tt) + (rnd() - 0.5) * 14) * DEG;
      const dir = new V3(Math.cos(el) * Math.cos(az), Math.sin(el), Math.cos(el) * Math.sin(az));
      if (p.bush) dir.addScaledVector(D, 0.6).normalize();
      const L = cr.dist(P, dir) * p.len1 * (0.8 + rnd() * 0.25);
      if (L < 0.3) continue;
      const rr = Math.max(0.012, r * p.r1 * (0.7 + 0.3 * rnd()) * Math.sqrt(clamp(L / (p.rx * 1.2), 0.2, 1)));
      prim.push(grow(P.clone(), dir, L, rr, 1, { segs: p.bush ? 4 : 6, wob: p.wob1, up: p.up1, droop: p.droop1 || 0, taper: 0.85 }, rnd, cr));
    }
  }
  // pine: dead stubs on the clear trunk
  const stubs = [];
  if (p.stubs) {
    const tr = trunks[0];
    for (let i = 0; i < p.stubs; i++) {
      const t = (2 + rnd() * (p.clear - 2.5)) / tr.len;
      const r = sampleBr(tr, t, P, D), az = rnd() * TAU, el = (rnd() * 30 - 10) * DEG;
      stubs.push(grow(P.clone(), new V3(Math.cos(el) * Math.cos(az), Math.sin(el), Math.cos(el) * Math.sin(az)), 0.25 + rnd() * 0.5, r * 0.22, 2, { segs: 1, taper: 0.7 }, rnd));
    }
  }
  // --- secondaries
  const out = new V3();
  for (const br of prim) {
    const n2 = Math.max(1, Math.round(br.len * p.n2));
    for (let j = 0; j < n2; j++) {
      const t = 0.18 + 0.8 * (j + rnd() * 0.6) / n2;
      const r = sampleBr(br, t, P, D);
      out.set(P.x, 0, P.z); if (out.lengthSq() > 1e-4) out.normalize();
      const side = perpTo(D, j * 2.39996 + rnd());
      const a2 = (p.a2 + (rnd() - 0.5) * 20) * DEG;
      const d2 = D.clone().multiplyScalar(Math.cos(a2)).addScaledVector(side, Math.sin(a2)).addScaledVector(out, 0.3).addScaledVector(UP, p.up2 * 0.5).normalize();
      const L2 = Math.min(cr.dist(P, d2) * p.len2, br.len * (1 - t) * 0.9 + 0.6) * (0.7 + rnd() * 0.4);
      if (L2 < 0.25) continue;
      sec.push(grow(P.clone(), d2, L2, Math.max(0.006, r * 0.6), 2, { segs: 2, wob: p.wob2, up: p.up2, droop: p.droop2 || 0, taper: 0.8 }, rnd));
    }
  }
  // --- leaf clusters
  const lf = p.leaf;
  const bearing = [];
  let Ltot = 0;
  for (const b of sec) { bearing.push([b, 0.15]); Ltot += b.len * 0.85; }
  for (const b of prim) { bearing.push([b, 0.55]); Ltot += b.len * 0.45; }
  if (p.bush) for (const b of trunks) { bearing.push([b, 0.4]); Ltot += b.len * 0.6; }
  const target = lf.cards;
  const sp = Math.max(0.12, Ltot / (target * 1.6));
  let clusters = [];
  for (const [b, t0] of bearing) {
    const n = Math.max(1, Math.round(b.len * (1 - t0) / sp));
    for (let k = 0; k <= n; k++) {
      const t = k === n ? 1 : t0 + (1 - t0) * (k + rnd() * 0.8) / n;
      sampleBr(b, t, P, D);
      const Q = P.clone().add(randDir(rnd).multiplyScalar(rnd() * lf.size * 0.35));
      const rho = cr.f(Q);
      if (rho > 1.2 || rho < lf.shell * (0.7 + 0.6 * rnd())) continue;
      if (Q.y < 0.15) continue;
      clusters.push({ p: Q, d: D.clone(), ph: (b.phase + rnd() * 0.15) % 1 });
    }
  }
  for (let i = clusters.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const t = clusters[i]; clusters[i] = clusters[j]; clusters[j] = t; }
  clusters = clusters.slice(0, target);
  // --- build geometry
  const g0 = new VGeo(), g1 = new VGeo();
  const col = barkColFn(p), barkAO = (P) => 0.45 + 0.55 * smooth(0.0, 1.1, cr.f(P)) * (p.bush ? 0.8 : 1);
  const trunkR = trunks[0].rads[0];
  const flare = p.bush ? null : (y, th) => 1 + p.flare * Math.pow(clamp(1 - y / 1.2, 0, 1), 3) * (0.75 + 0.25 * Math.sin(th * 5 + 1.3));
  const barkL = p.birch ? LY.BIRCH : LY.BARK;
  const texW = p.birch ? 1.3 : 1.0;
  for (const tr of trunks) {
    const uRep = Math.max(1, Math.round(TAU * tr.rads[0] / texW));
    const o = { layer: barkL, uRep, vLen: texW * 1.2, col, ao: barkAO, sway, flare };
    tube(g0, tr, p.bush ? 4 : 10, o);
    const lite = { ...tr, pts: tr.pts.filter((_, i) => i % 2 === 0 || i === tr.pts.length - 1), rads: tr.rads.filter((_, i) => i % 2 === 0 || i === tr.rads.length - 1) };
    tube(g1, lite, p.bush ? 3 : 6, o);
  }
  for (const br of prim) {
    const layer = p.birch && br.rads[0] > 0.035 ? LY.BIRCH : LY.BARK;
    const bc = p.birch && layer === LY.BARK ? () => [0.5, 0.4, 0.36] : col;
    const o = { layer, uRep: 1, vLen: texW, col: bc, ao: barkAO, sway };
    tube(g0, br, br.rads[0] > 0.05 ? 5 : 4, o);
    if (br.rads[0] > (p.bush ? 0.02 : 0.035)) {
      const lite = { ...br, pts: br.pts.filter((_, i) => i % 2 === 0 || i === br.pts.length - 1), rads: br.rads.filter((_, i) => i % 2 === 0 || i === br.rads.length - 1) };
      tube(g1, lite, 3, o);
    }
  }
  for (const br of sec.concat(stubs)) {
    const bc = p.birch ? () => [0.48, 0.38, 0.34] : col;
    tube(g0, br, 3, { layer: LY.BARK, uRep: 1, vLen: texW, col: bc, ao: barkAO, sway });
  }
  const barkTris0 = g0.tris, barkTris1 = g1.tris;
  // cards
  const tint = lf.tint || W, U = new V3(), V = new V3(), tmp = new V3(), outw = new V3();
  const oC = { col: tint, aoK: 1, sway };
  const orient = (c) => {
    outw.copy(c.p).sub(cr.c); outw.y *= 0.5; outw.normalize();
    randDir(rnd, tmp);
    if (lf.orient === 'hang') V.copy(UP).multiplyScalar(-1).addScaledVector(c.d, 0.35).addScaledVector(outw, 0.25).addScaledVector(tmp, 0.3);
    else if (lf.orient === 'up') V.copy(UP).multiplyScalar(0.75).addScaledVector(c.d, 0.45).addScaledVector(outw, 0.25).addScaledVector(tmp, 0.35);
    else V.copy(c.d).multiplyScalar(0.5).addScaledVector(outw, 0.55).addScaledVector(UP, 0.12).addScaledVector(tmp, 0.45);
    V.normalize();
    U.crossVectors(V, randDir(rnd, tmp)).normalize();
  };
  const layerOf = () => lf.alt && rnd() < lf.alt[1] ? lf.alt[0] : lf.layer;
  for (const c of clusters) {
    orient(c);
    const s = lf.size * (0.8 + rnd() * 0.4);
    const C = c.p.clone().addScaledVector(V, s * 0.35);
    card(g0, C, U, V, s, s, layerOf(), cr, oC, c.ph);
  }
  const n1 = Math.min(clusters.length, Math.max(8, Math.round(clusters.length * lf.lod1))), k = Math.sqrt(clusters.length / n1) * 0.92;
  for (let i = 0; i < n1; i++) {
    const c = clusters[i];
    orient(c);
    const s = lf.size * (0.85 + rnd() * 0.3) * k;
    cr.nrm(c.p, outw);
    const C = c.p.clone().addScaledVector(V, s * 0.2).addScaledVector(outw, -s * 0.18);
    card(g1, C, U, V, s, s, layerOf(), cr, oC, c.ph);
  }
  return { g0, g1, trunkR, H, barkTris0, barkTris1, cards0: clusters.length, cards1: n1 };
}

function genSpruce(p, rnd) {
  const H = p.H, cr = new Cone(H, p.base, p.R), sway = swayFn(H, false);
  const trunk = grow(new V3(), new V3((rnd() - 0.5) * 0.01, 1, (rnd() - 0.5) * 0.01), H, p.r0, 0, { segs: 12, wob: 0.015, taper: 0.95 }, rnd);
  const branches = [], P = new V3();
  let h = p.base;
  while (h < H - 0.4) {
    const tRel = (h - p.base) / (H - p.base);
    const Lmax = p.R * Math.pow(1 - tRel, 0.92) + 0.25;
    const nb = tRel > 0.82 ? 3 : 4 + (rnd() < 0.55 ? 1 : 0);
    const az0 = rnd() * TAU;
    sampleBr(trunk, h / trunk.len, P);
    for (let b = 0; b < nb; b++) {
      const az = az0 + b * TAU / nb + (rnd() - 0.5) * 0.5;
      const L = Lmax * (0.8 + rnd() * 0.3);
      const el = lerp(p.elB, p.elT, tRel) + (rnd() - 0.5) * 0.15;
      const dir = new V3(Math.cos(el) * Math.cos(az), Math.sin(el), Math.cos(el) * Math.sin(az));
      const br = grow(P.clone(), dir, L, 0.012 + 0.03 * L / p.R, 1, { segs: 3, wob: 0.08, droop: p.droop * (1 - tRel * 0.6), taper: 0.85 }, rnd);
      const last = br.pts[br.pts.length - 1]; last.y += 0.06 * L; prepBranch(br);
      br.tRel = tRel;
      branches.push(br);
    }
    h += p.whorl * (0.85 + rnd() * 0.3);
  }
  const g0 = new VGeo(), g1 = new VGeo();
  const barkAO = (Q) => 0.35 + 0.65 * smooth(0, 1, cr.f(Q)) * (0.6 + 0.4 * Q.y / H);
  const o = { layer: LY.BARK, uRep: Math.max(1, Math.round(TAU * p.r0)), vLen: 1.2, col: () => [0.85, 0.8, 0.78], ao: barkAO, sway,
    flare: (y, th) => 1 + p.flare * Math.pow(clamp(1 - y / 1.0, 0, 1), 3) * (0.75 + 0.25 * Math.sin(th * 5)) };
  tube(g0, trunk, 8, o);
  tube(g1, { ...trunk, pts: trunk.pts.filter((_, i) => i % 3 === 0 || i === trunk.pts.length - 1), rads: trunk.rads.filter((_, i) => i % 3 === 0 || i === trunk.rads.length - 1) }, 5, o);
  const ob = { ...o, uRep: 1, flare: null };
  for (const br of branches) tube(g0, br, 3, ob);
  const barkTris0 = g0.tris, barkTris1 = g1.tris;
  const tint = p.leaf.tint, D = new V3(), side = new V3(), U = new V3(), oC = { col: tint, aoK: 1, sway };
  let cards0 = 0, cards1 = 0;
  const layer = p.leaf.layer;
  for (const br of branches) {
    const L = br.len, nC = Math.max(1, Math.round(L / 0.85));
    const w = clamp(0.45 + 0.4 * L, 0.5, 1.45), seg = L / nC;
    for (let c = 0; c < nC; c++) {
      const t = (c + 0.55) / nC;
      sampleBr(br, t, P, D);
      side.crossVectors(UP, D).normalize();
      for (const sg of [-1, 1]) {
        const tilt = (26 + rnd() * 12) * DEG * sg;
        U.copy(side).multiplyScalar(Math.cos(tilt)).addScaledVector(UP, Math.sin(tilt)).normalize();
        const Vv = new V3().crossVectors(U, new V3().crossVectors(D, U)).normalize();   // D orthogonalised to U
        card(g0, P.clone(), U, Vv, w * (0.9 + rnd() * 0.2), seg * 1.55, layer, cr, oC, br.phase);
        cards0++;
      }
    }
    // LOD1: one card per branch, alternating tilt
    sampleBr(br, 0.55, P, D);
    side.crossVectors(UP, D).normalize();
    const tilt = (cards1 % 2 ? 1 : -1) * 22 * DEG;
    U.copy(side).multiplyScalar(Math.cos(tilt)).addScaledVector(UP, Math.sin(tilt)).normalize();
    const Vv = new V3().crossVectors(U, new V3().crossVectors(D, U)).normalize();
    card(g1, P.clone(), U, Vv, w * 1.35, L * 1.1, layer, cr, oC, br.phase);
    cards1++;
  }
  // leader: crossed vertical cards at the top
  for (let i = 0; i < 2; i++) {
    const a = i * Math.PI / 2 + 0.3;
    U.set(Math.cos(a), 0, Math.sin(a));
    const top = new V3(0, H - 0.55, 0);
    card(g0, top, U, UP, 0.8, 1.3, layer, cr, oC, 0.5); cards0++;
    card(g1, top, U, UP, 0.9, 1.4, layer, cr, oC, 0.5); cards1++;
  }
  return { g0, g1, trunkR: p.r0, H, barkTris0, barkTris1, cards0, cards1 };
}

// ---------------------------------------------------------------------------------------------
// Shaders
// ---------------------------------------------------------------------------------------------
const GLSL_COMMON = /* glsl */`
vec3 vegRot(vec3 p, float c, float s) { return vec3(p.x * c + p.z * s, p.y, -p.x * s + p.z * c); }
vec3 vegTint(float pk, float leaf) {
  float h = floor(pk / 65536.0);
  float b = floor((pk - h * 65536.0) / 256.0);
  float y = pk - h * 65536.0 - b * 256.0;
  h = h / 127.5 - 1.0; b = 0.84 + b / 255.0 * 0.32; y = y / 255.0;
  vec3 t = vec3(1.0 + 0.09 * h, 1.0 + 0.02 * h, 1.0 - 0.2 * h) * b;
  t = mix(t, vec3(1.5, 1.22, 0.42) * b, y);
  return mix(vec3(0.92 + 0.08 * b), t, leaf);
}
`;
const GLSL_VERT_PARS = /* glsl */`
attribute vec4 iA;
attribute vec4 iB;
attribute vec4 aData;
attribute vec3 aTan;
attribute vec3 aCol;
uniform float uTime;
uniform float uWind;
uniform vec2 uWindDir;
uniform vec3 uCamPos;
uniform float uShadowCull;
varying vec2 vUv2;
varying float vLayer;
varying float vAO;
varying float vFade;
varying vec3 vTint;
varying vec3 vTanV;
${GLSL_COMMON}
vec3 vegWind(vec3 nrm, float sc) {
  float tph = iA.x * 0.043 + iA.z * 0.037;
  float gust = 0.6 + 0.4 * sin(uTime * 0.23 + (iA.x * 0.8 + iA.z * 0.6) * 0.012);
  float w = uWind * gust;
  float sway = sin(uTime * 0.83 + tph) * 0.6 + sin(uTime * 1.61 + tph * 1.7) * 0.28 + 0.45;
  float s = aData.z * sc;
  vec3 d = vec3(uWindDir.x, 0.0, uWindDir.y) * (s * sway * w);
  float ph = aData.w * 6.2831853;
  d += vec3(sin(uTime * 2.3 + ph + tph), 0.4 * sin(uTime * 2.9 + ph * 1.7), cos(uTime * 1.9 + ph * 1.3 + tph)) * (s * 0.22 * w);
  if (aData.y > 1.5) d += nrm * (sin(uTime * (7.0 + aData.w * 4.0) + ph * 9.0 + tph) * 0.03 * w);
  return d;
}
`;
const GLSL_BEGIN = /* glsl */`
float vegC = cos(iA.w), vegS = sin(iA.w);
vec3 vegN = vegRot(normal, vegC, vegS);
vec3 transformed = vegRot(position * iB.x, vegC, vegS);
transformed += vegWind(vegN, iB.x) + iA.xyz;
vUv2 = uv; vLayer = aData.y; vAO = aData.x; vFade = iB.z;
vTint = aCol * vegTint(iB.y, step(1.5, aData.y));
vTanV = normalize((viewMatrix * vec4(vegRot(aTan, vegC, vegS), 0.0)).xyz);
`;
const GLSL_FRAG_PARS = /* glsl */`
precision highp sampler2DArray;
uniform sampler2DArray uLeafA;
uniform sampler2DArray uLeafN;
uniform sampler2D uBarkA;
uniform sampler2D uBarkN;
uniform sampler2D uBirchA;
uniform sampler2D uBirchN;
uniform float uTrans;
varying vec2 vUv2;
varying float vLayer;
varying float vAO;
varying float vFade;
varying vec3 vTint;
varying vec3 vTanV;
float vegLeafK;
float vegIGN(vec2 p) { return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }
void vegFade(float f) {
  if (f == 0.0) return;
  float d = vegIGN(gl_FragCoord.xy);
  if (f > 0.0) { if (d < f) discard; }
  else if (d >= -f) discard;
}
float vegCov(vec2 uv, float a, vec2 sz) {
  vec2 dx = dFdx(uv * sz), dy = dFdy(uv * sz);
  float lod = max(0.0, 0.5 * log2(max(dot(dx, dx), dot(dy, dy))));
  return a * (1.0 + lod * 0.32);
}
`;
const GLSL_TRANSLUCENCY = /* glsl */`
void RE_Direct_Veg(const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight) {
  RE_Direct_Physical(directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight);
  if (vegLeafK > 0.0) {
    float back = pow(clamp(dot(geometryViewDir, -directLight.direction), 0.0, 1.0), 4.0);
    float wrapT = clamp(0.5 - 0.5 * dot(geometryNormal, directLight.direction), 0.0, 1.0);
    reflectedLight.directDiffuse += directLight.color * material.diffuseColor * vec3(1.0, 1.1, 0.5) * (RECIPROCAL_PI * uTrans * vegLeafK * wrapT * (0.35 + 2.2 * back));
  }
}
#undef RE_Direct
#define RE_Direct RE_Direct_Veg
`;

function patchTreeMaterial(m, U) {
  m.onBeforeCompile = (sh) => {
    for (const k of ['uTime', 'uWind', 'uWindDir', 'uCamPos', 'uShadowCull', 'uLeafA', 'uLeafN', 'uBarkA', 'uBarkN', 'uBirchA', 'uBirchN', 'uTrans']) sh.uniforms[k] = U[k];
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\n' + GLSL_VERT_PARS)
      .replace('#include <beginnormal_vertex>', 'vec3 objectNormal = vegRot(normal, cos(iA.w), sin(iA.w));')
      .replace('#include <begin_vertex>', GLSL_BEGIN);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\n' + GLSL_FRAG_PARS)
      .replace('#include <lights_physical_pars_fragment>', '#include <lights_physical_pars_fragment>\n' + GLSL_TRANSLUCENCY)
      .replace('#include <map_fragment>', /* glsl */`
        vegFade(vFade);
        bool vegLeaf = vLayer > 1.5;
        vegLeafK = vegLeaf ? 1.0 : 0.0;
        vec4 vegA, vegNm;
        if (vegLeaf) {
          vec3 uvw = vec3(vUv2, vLayer - 2.0);
          vegA = texture(uLeafA, uvw);
          if (vegCov(vUv2, vegA.a, vec2(${TEX}.0)) < 0.5) discard;
          vegNm = texture(uLeafN, uvw);
        } else if (vLayer < 0.5) { vegA = texture(uBarkA, vUv2); vegNm = texture(uBarkN, vUv2); }
        else { vegA = texture(uBirchA, vUv2); vegNm = texture(uBirchN, vUv2); }
        float vegAO = vAO * (vegLeaf ? 1.0 : mix(1.0, vegA.a, 0.7));
        diffuseColor.rgb = vegA.rgb * vTint * mix(1.0, vegAO, 0.55);
      `)
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = vegLeaf ? 0.6 : clamp(vegNm.a * 1.05, 0.45, 1.0);')
      .replace('#include <normal_fragment_begin>', 'float faceDirection = gl_FrontFacing ? 1.0 : -1.0;\nvec3 normal = normalize(vNormal);\nvec3 nonPerturbedNormal = normal;')
      .replace('#include <normal_fragment_maps>', /* glsl */`
        {
          vec3 vT = vTanV - normal * dot(vTanV, normal);
          float tl = length(vT);
          vT = tl > 1e-4 ? vT / tl : vec3(1.0, 0.0, 0.0);
          vec3 vB = cross(normal, vT);
          vec3 nt = vegNm.xyz * 2.0 - 1.0;
          nt.xy *= vegLeaf ? 0.9 : 1.4;
          normal = normalize(vT * nt.x + vB * nt.y + normal * max(nt.z, 0.1));
        }
      `)
      .replace('#include <aomap_fragment>', 'reflectedLight.indirectDiffuse *= vegAO; reflectedLight.indirectSpecular *= vegAO * vegAO;');
  };
  m.customProgramCacheKey = () => 'veg-tree-v1';
}
function patchDepthMaterial(m, U, distance) {
  m.onBeforeCompile = (sh) => {
    for (const k of ['uTime', 'uWind', 'uWindDir', 'uCamPos', 'uShadowCull', 'uLeafA']) sh.uniforms[k] = U[k];
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\n' + GLSL_VERT_PARS)
      .replace('#include <begin_vertex>', GLSL_BEGIN)
      .replace('#include <project_vertex>', '#include <project_vertex>\nif (distance(iA.xyz, uCamPos) > uShadowCull) gl_Position = vec4(0.0, 0.0, -2.0, 1.0);');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', /* glsl */`#include <common>
        precision highp sampler2DArray;
        uniform sampler2DArray uLeafA;
        varying vec2 vUv2; varying float vLayer; varying float vFade;
        float vegIGN(vec2 p) { return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }
        float vegCov(vec2 uv, float a, vec2 sz) { vec2 dx = dFdx(uv * sz), dy = dFdy(uv * sz); float lod = max(0.0, 0.5 * log2(max(dot(dx, dx), dot(dy, dy)))); return a * (1.0 + lod * 0.32); }`)
      .replace('#include <map_fragment>', /* glsl */`
        if (vFade != 0.0) { float dd = vegIGN(gl_FragCoord.xy); if (vFade > 0.0 ? dd < vFade : dd >= -vFade) discard; }
        if (vLayer > 1.5) { float a = texture(uLeafA, vec3(vUv2, vLayer - 2.0)).a; if (vegCov(vUv2, a, vec2(${TEX}.0)) < 0.5) discard; }
      `);
  };
  m.customProgramCacheKey = () => distance ? 'veg-dist-v1' : 'veg-depth-v1';
}
function patchImpostorMaterial(m, U, nV, W, H) {
  m.onBeforeCompile = (sh) => {
    for (const k of ['uTime', 'uWind', 'uWindDir', 'uImpA', 'uImpN', 'uImp', 'uTrans']) sh.uniforms[k] = U[k];
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', /* glsl */`#include <common>
        attribute vec4 iA;
        attribute vec4 iB;
        uniform vec4 uImp[${nV}];
        uniform float uTime;
        uniform float uWind;
        uniform vec2 uWindDir;
        varying vec3 vImpUv; varying float vFade; varying vec3 vTint; varying vec3 vBR; varying vec3 vBU; varying vec3 vBF;
        ${GLSL_COMMON}`)
      .replace('#include <beginnormal_vertex>', 'vec3 objectNormal = vec3(0.0, 1.0, 0.0);')
      .replace('#include <begin_vertex>', /* glsl */`
        vec4 info = uImp[int(iB.w + 0.5)];
        float sc = iB.x, ic = cos(iA.w), is = sin(iA.w);
        vec3 ctr = iA.xyz + vec3(0.0, info.x * sc, 0.0);
        vec3 Vd = cameraPosition - ctr; float dist = max(length(Vd), 1e-3); Vd /= dist;
        vec3 Rd = cross(vec3(0.0, 1.0, 0.0), Vd); float rl = length(Rd);
        Rd = rl > 1e-3 ? Rd / rl : vegRot(vec3(1.0, 0.0, 0.0), ic, is);
        vec3 Ud = cross(Vd, Rd);
        vec3 ld = vegRot(Vd, ic, -is);
        float az = atan(ld.x, ld.z);
        float fi = mod(floor(az / 1.0471976 + 0.5) + 6.0, 6.0);
        float el = asin(clamp(ld.y, -1.0, 1.0));
        float ei = el < 0.3490659 ? 0.0 : (el < 1.0035643 ? 1.0 : 2.0);
        float rad = info.y * sc;
        vec2 q = position.xy;
        vec3 transformed = ctr + (Rd * q.x + Ud * q.y) * rad;
        float tph = iA.x * 0.043 + iA.z * 0.037;
        float sw = (sin(uTime * 0.83 + tph) * 0.6 + 0.45) * uWind * 0.02 * rad * max(q.y + 0.3, 0.0);
        transformed += vec3(uWindDir.x, 0.0, uWindDir.y) * sw;
        float pull = min(rad * 0.7, dist * 0.5);
        transformed = cameraPosition + (transformed - cameraPosition) * ((dist - pull) / dist);
        vImpUv = vec3((fi + q.x * 0.5 + 0.5) / 6.0, (ei + q.y * 0.5 + 0.5) / 3.0, iB.w);
        vFade = iB.z;
        vTint = vegTint(iB.y, 1.0);
        vBR = normalize((viewMatrix * vec4(Rd, 0.0)).xyz);
        vBU = normalize((viewMatrix * vec4(Ud, 0.0)).xyz);
        vBF = normalize((viewMatrix * vec4(Vd, 0.0)).xyz);
      `);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', /* glsl */`#include <common>
        precision highp sampler2DArray;
        uniform sampler2DArray uImpA;
        uniform sampler2DArray uImpN;
        uniform float uTrans;
        varying vec3 vImpUv; varying float vFade; varying vec3 vTint; varying vec3 vBR; varying vec3 vBU; varying vec3 vBF;
        float vegLeafK;
        float vegIGN(vec2 p) { return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }
        float vegCov(vec2 uv, float a, vec2 sz) { vec2 dx = dFdx(uv * sz), dy = dFdy(uv * sz); float lod = max(0.0, 0.5 * log2(max(dot(dx, dx), dot(dy, dy)))); return a * (1.0 + lod * 0.32); }`)
      .replace('#include <lights_physical_pars_fragment>', '#include <lights_physical_pars_fragment>\n' + GLSL_TRANSLUCENCY)
      .replace('#include <map_fragment>', /* glsl */`
        if (vFade != 0.0) { float dd = vegIGN(gl_FragCoord.xy); if (vFade > 0.0 ? dd < vFade : dd >= -vFade) discard; }
        vec4 impA = texture(uImpA, vImpUv);
        if (vegCov(vImpUv.xy, impA.a, vec2(${W}.0, ${H}.0)) < 0.5) discard;
        vec4 impN = texture(uImpN, vImpUv);
        vegLeafK = clamp((impA.g - impA.r * 0.95) * 14.0, 0.0, 1.0);
        diffuseColor.rgb = impA.rgb * mix(vec3(dot(vTint, vec3(0.3333))), vTint, vegLeafK);
        float vegAO = impN.a;
      `)
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = 0.72;')
      .replace('#include <normal_fragment_begin>', 'float faceDirection = 1.0;\nvec3 normal = normalize(mat3(vBR, vBU, vBF) * (impN.xyz * 2.0 - 1.0));\nvec3 nonPerturbedNormal = normal;')
      .replace('#include <normal_fragment_maps>', '')
      .replace('#include <aomap_fragment>', 'reflectedLight.indirectDiffuse *= vegAO; reflectedLight.indirectSpecular *= vegAO * vegAO;');
  };
  m.customProgramCacheKey = () => 'veg-imp-v1-' + nV;
}

// ---------------------------------------------------------------------------------------------
// Impostor baking: 6 azimuths x 3 elevations per variant into an array render target
// ---------------------------------------------------------------------------------------------
const IMP_AZ = 6, IMP_EL = [0, 40, 75];
function bakeImpostors(renderer, variants, U, F) {
  const nV = variants.length, W = IMP_AZ * F, H = IMP_EL.length * F;
  const opts = { depthBuffer: true, generateMipmaps: false, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter, type: THREE.UnsignedByteType, format: THREE.RGBAFormat };
  const rtA = new THREE.WebGLArrayRenderTarget(W, H, nV, { ...opts, colorSpace: THREE.SRGBColorSpace });
  const rtN = new THREE.WebGLArrayRenderTarget(W, H, nV, { ...opts, colorSpace: THREE.NoColorSpace });
  const mat = new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    uniforms: { uMode: { value: 0 }, uLeafA: U.uLeafA, uLeafN: U.uLeafN, uBarkA: U.uBarkA, uBarkN: U.uBarkN, uBirchA: U.uBirchA, uBirchN: U.uBirchN },
    vertexShader: /* glsl */`
      attribute vec4 aData; attribute vec3 aTan; attribute vec3 aCol;
      varying vec2 vUv2; varying float vLayer; varying float vAO; varying vec3 vTint; varying vec3 vN; varying vec3 vT;
      void main() {
        vUv2 = uv; vLayer = aData.y; vAO = aData.x; vTint = aCol;
        vN = normalize(normalMatrix * normal); vT = normalize(normalMatrix * aTan);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */`
      precision highp sampler2DArray;
      uniform int uMode;
      uniform sampler2DArray uLeafA; uniform sampler2DArray uLeafN;
      uniform sampler2D uBarkA; uniform sampler2D uBarkN; uniform sampler2D uBirchA; uniform sampler2D uBirchN;
      varying vec2 vUv2; varying float vLayer; varying float vAO; varying vec3 vTint; varying vec3 vN; varying vec3 vT;
      void main() {
        bool leaf = vLayer > 1.5; vec4 A, Nm;
        if (leaf) {
          vec3 uvw = vec3(vUv2, vLayer - 2.0);
          A = texture(uLeafA, uvw);
          vec2 dx = dFdx(vUv2 * ${TEX}.0), dy = dFdy(vUv2 * ${TEX}.0);
          float lod = max(0.0, 0.5 * log2(max(dot(dx, dx), dot(dy, dy))));
          if (A.a * (1.0 + lod * 0.32) < 0.5) discard;
          Nm = texture(uLeafN, uvw);
        } else if (vLayer < 0.5) { A = texture(uBarkA, vUv2); Nm = texture(uBarkN, vUv2); }
        else { A = texture(uBirchA, vUv2); Nm = texture(uBirchN, vUv2); }
        float ao = vAO * (leaf ? 1.0 : mix(1.0, A.a, 0.7));
        if (uMode == 0) { gl_FragColor = vec4(A.rgb * vTint * mix(1.0, ao, 0.55), 1.0); return; }
        vec3 n = normalize(vN);
        vec3 t = vT - n * dot(vT, n); t = length(t) > 1e-4 ? normalize(t) : vec3(1.0, 0.0, 0.0);
        vec3 b = cross(n, t);
        vec3 nt = Nm.xyz * 2.0 - 1.0; nt.xy *= leaf ? 0.9 : 1.4;
        n = normalize(t * nt.x + b * nt.y + n * max(nt.z, 0.1));
        gl_FragColor = vec4(n * 0.5 + 0.5, ao);
      }`,
  });
  const scene = new THREE.Scene();
  const prevRT = renderer.getRenderTarget(), prevAC = renderer.autoClear, prevCC = new THREE.Color(), prevCA = renderer.getClearAlpha();
  renderer.getClearColor(prevCC);
  const prevXR = renderer.xr.enabled; renderer.xr.enabled = false;
  renderer.autoClear = true;
  const cam = new THREE.OrthographicCamera(0, 1, 1, 0, 0.1, 100);
  const m4 = new THREE.Matrix4(), mRx = new THREE.Matrix4(), mRy = new THREE.Matrix4(), mT = new THREE.Matrix4();
  const info = [];
  for (let v = 0; v < nV; v++) {
    const vr = variants[v];
    const g = vr.geo0;
    const bb = g.boundingBox;
    const cy = (bb.min.y + bb.max.y) / 2;
    let R = 0;
    const pa = g.attributes.position.array;
    for (let i = 0; i < pa.length; i += 3) R = Math.max(R, Math.hypot(pa[i], pa[i + 1] - cy, pa[i + 2]));
    R *= 1.03;
    info.push([cy, R]);
    const cell = 2 * R;
    cam.left = 0; cam.right = IMP_AZ * cell; cam.bottom = 0; cam.top = IMP_EL.length * cell;
    cam.near = 0.1; cam.far = 4 * R + 10; cam.position.set(0, 0, 2 * R + 5); cam.updateProjectionMatrix(); cam.updateMatrixWorld();
    const meshes = [];
    for (let e = 0; e < IMP_EL.length; e++) for (let a = 0; a < IMP_AZ; a++) {
      const mesh = new THREE.Mesh(g, mat);
      mesh.matrixAutoUpdate = false; mesh.frustumCulled = false;
      mT.makeTranslation(0, -cy, 0);
      mRy.makeRotationY(-a * TAU / IMP_AZ);
      mRx.makeRotationX(IMP_EL[e] * DEG);
      m4.makeTranslation((a + 0.5) * cell, (e + 0.5) * cell, 0).multiply(mRx).multiply(mRy).multiply(mT);
      mesh.matrix.copy(m4); mesh.matrixWorld.copy(m4);
      scene.add(mesh); meshes.push(mesh);
    }
    const lm = vr.leafMean;
    for (const [rt, mode] of [[rtA, 0], [rtN, 1]]) {
      mat.uniforms.uMode.value = mode;
      rt.texture.generateMipmaps = v === nV - 1;
      if (mode === 0) renderer.setClearColor(new THREE.Color().setRGB(lm[0] * 0.55, lm[1] * 0.55, lm[2] * 0.55, THREE.SRGBColorSpace), 0);
      else renderer.setClearColor(new THREE.Color(0.5, 0.5, 1.0), 0.75);
      renderer.setRenderTarget(rt, v);
      renderer.render(scene, cam);
    }
    for (const m of meshes) scene.remove(m);
  }
  renderer.setRenderTarget(prevRT);
  renderer.setClearColor(prevCC, prevCA);
  renderer.autoClear = prevAC; renderer.xr.enabled = prevXR;
  mat.dispose();
  for (const rt of [rtA, rtN]) rt.texture.generateMipmaps = true;
  return { rtA, rtN, info, W, H };
}

// ---------------------------------------------------------------------------------------------
// Instanced meshes with dynamic per-frame instance buffers
// ---------------------------------------------------------------------------------------------
function instBuffer(baseGeo, material, cap, castShadow, depthMat, distMat) {
  const g = new THREE.InstancedBufferGeometry();
  g.index = baseGeo.index;
  for (const k in baseGeo.attributes) g.setAttribute(k, baseGeo.attributes[k]);
  const arr = new Float32Array(Math.max(1, cap) * 8);
  const ib = new THREE.InstancedInterleavedBuffer(arr, 8, 1).setUsage(THREE.DynamicDrawUsage);
  g.setAttribute('iA', new THREE.InterleavedBufferAttribute(ib, 4, 0));
  g.setAttribute('iB', new THREE.InterleavedBufferAttribute(ib, 4, 4));
  g.instanceCount = 0;
  g.boundingSphere = new THREE.Sphere(new V3(), 1e7);
  const mesh = new THREE.Mesh(g, material);
  mesh.frustumCulled = false; mesh.matrixAutoUpdate = false; mesh.visible = false;
  mesh.castShadow = castShadow; mesh.receiveShadow = castShadow;
  if (depthMat) mesh.customDepthMaterial = depthMat;
  if (distMat) mesh.customDistanceMaterial = distMat;
  return { mesh, arr, ib, n: 0, tris: baseGeo.index.count / 3 };
}

// ---------------------------------------------------------------------------------------------
// Main entry
// ---------------------------------------------------------------------------------------------
export async function buildVegetation(scene, trees, { groundH = () => 0, seed = 1, base = S.base, renderer = S.renderer } = {}) {
  const t0 = performance.now();
  const rnd = mulberry(seed * 7919 + 13);
  // ---- textures
  let barkA, barkN;
  try {
    [barkA, barkN] = await Promise.all([loadBitmapTex(`${base}assets/tex/bark_brown_02_a.webp`, true), loadBitmapTex(`${base}assets/tex/bark_brown_02_n.webp`, false)]);
  } catch (e) {
    console.warn('vegetation: bark texture missing, using procedural bark', e);
    const b = paintBark(rnd, false); barkA = dataTex(b.alb, TEX, true); barkN = dataTex(b.nrm, TEX, false);
  }
  const bb = paintBark(mulberry(seed + 99), true);
  const birchA = dataTex(bb.alb, TEX, true), birchN = dataTex(bb.nrm, TEX, false);
  const la = new Uint8Array(TEX * TEX * 4 * NLEAF), ln = new Uint8Array(TEX * TEX * 4 * NLEAF);
  const leafMean = [];
  for (let l = 0; l < NLEAF; l++) {
    const r = paintLeafLayer(l + 2, mulberry(seed * 31 + l * 1013 + 5));
    la.set(r.alb, l * TEX * TEX * 4); ln.set(r.nrm, l * TEX * TEX * 4);
    leafMean[l + 2] = r.mean;
  }
  const mkArr = (d, srgb) => {
    const t = new THREE.DataArrayTexture(d, TEX, TEX, NLEAF);
    t.format = THREE.RGBAFormat; t.type = THREE.UnsignedByteType;
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter;
    t.generateMipmaps = true; t.anisotropy = 4; t.needsUpdate = true;
    return t;
  };
  const leafA = mkArr(la, true), leafN = mkArr(ln, false);
  const tTex = performance.now();

  // ---- variants
  const variants = [];      // { kind, name, geo0, geo1, trunkR, H, cy, R }
  const kindVar = [];
  for (let k = 0; k < KIND_VARIANTS.length; k++) {
    kindVar.push([]);
    for (let j = 0; j < KIND_VARIANTS[k].length; j++) {
      const name = KIND_VARIANTS[k][j], p = SPECIES[name];
      const r = mulberry(seed * 1009 + k * 97 + j * 13 + 1);
      const res = p.gen === 'spruce' ? genSpruce(p, r) : genDecid(p, r);
      const v = {
        kind: k, name, id: variants.length, geo0: res.g0.build(), geo1: res.g1.build(), trunkR: res.trunkR, H: res.H,
        leafMean: leafMean[p.leaf.layer] || [0.2, 0.3, 0.1],
        tris0: res.g0.tris, tris1: res.g1.tris, bark0: res.barkTris0, cards0: res.cards0, cards1: res.cards1,
      };
      variants.push(v); kindVar[k].push(v.id);
    }
  }
  const nV = variants.length;
  const tGen = performance.now();

  // ---- uniforms & materials
  const U = {
    uTime: { value: 0 }, uWind: { value: 0.5 }, uWindDir: { value: new THREE.Vector2(0.94, 0.34).normalize() },
    uCamPos: { value: new V3() }, uShadowCull: { value: 200 },
    uLeafA: { value: leafA }, uLeafN: { value: leafN }, uBarkA: { value: barkA }, uBarkN: { value: barkN }, uBirchA: { value: birchA }, uBirchN: { value: birchN },
    uTrans: { value: 1.0 }, uImpA: { value: null }, uImpN: { value: null }, uImp: { value: [] },
  };
  const treeMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7, metalness: 0, side: THREE.DoubleSide });
  treeMat.shadowSide = THREE.DoubleSide;
  patchTreeMaterial(treeMat, U);
  const depthMat = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, side: THREE.DoubleSide });
  patchDepthMaterial(depthMat, U, false);
  const distMat = new THREE.MeshDistanceMaterial({ side: THREE.DoubleSide });
  patchDepthMaterial(distMat, U, true);

  // ---- impostors
  const R = renderer || S.renderer;
  let imp = null;
  if (R) {
    const F = S.quality === 'high' ? 128 : 96;
    imp = bakeImpostors(R, variants, U, F);
    U.uImpA.value = imp.rtA.texture; U.uImpN.value = imp.rtN.texture;
    U.uImp.value = imp.info.map(([cy, r]) => new THREE.Vector4(cy, r, 0, 0));
    for (let v = 0; v < nV; v++) { variants[v].cy = imp.info[v][0]; variants[v].R = imp.info[v][1]; }
  } else {
    console.warn('vegetation: no renderer (S.renderer) - far LOD falls back to LOD1 geometry');
    for (const v of variants) { const b = v.geo0.boundingBox; v.cy = (b.min.y + b.max.y) / 2; v.R = v.geo0.boundingSphere.radius; }
  }
  const impMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.72, metalness: 0 });
  if (imp) patchImpostorMaterial(impMat, U, nV, imp.W, imp.H);
  const tBake = performance.now();

  // ---- tree instances
  const N = trees.length;
  const CELL = 180;
  const rec = [];
  const cellDom = new Map();
  for (let i = 0; i < N; i++) {
    const t = trees[i];
    // kind 0..5, or kind + 10 * (variant + 1) to force one species (e.g. 11 = spruce, 41 = pine)
    const kv = t.k | 0, k = clamp(kv % 10, 0, 5), force = kv >= 10 ? Math.min(Math.floor(kv / 10) - 1, KIND_VARIANTS[k].length - 1) : -1;
    const x = +t.x, z = +t.z;
    // spatially coherent stands: 55% of trees use the dominant variant of their 70 m cell
    const ck = (Math.floor(x / 70) * 73856093) ^ (Math.floor(z / 70) * 19349663) ^ (k * 83492791);
    let dom = cellDom.get(ck);
    const wts = KIND_WEIGHTS[k];
    const pick = (u) => { let a = 0; for (let j = 0; j < wts.length; j++) { a += wts[j]; if (u <= a) return j; } return wts.length - 1; };
    if (dom === undefined) { dom = pick(hashU(ck, seed + 5)); cellDom.set(ck, dom); }
    const h1 = hashU(i, seed), h2 = hashU(i, seed + 1), h3 = hashU(i, seed + 2), h4 = hashU(i, seed + 3), h5 = hashU(i, seed + 4);
    const vj = force >= 0 ? force : h1 < 0.55 ? dom : pick(h2);
    const vid = kindVar[k][vj];
    const sc = 0.75 + 0.55 * Math.pow(h3, 1.2);
    const yellow = h4 < 0.05 && k !== 1 ? 0.25 + 0.45 * hashU(i, seed + 6) : 0;
    const hue = Math.round(clamp(127.5 + (hashU(i, seed + 7) * 2 - 1) * 120, 0, 255));
    const bri = Math.round(hashU(i, seed + 8) * 255);
    const pk = hue * 65536 + bri * 256 + Math.round(yellow * 255);
    const g = k === 5 ? 0 : k === 3 ? 1 : 2;
    rec.push({ x, y: groundH(x, z), z, yaw: h5 * TAU, sc, pk, vid, k, kh: hashU(i, seed + 9), cx: Math.floor(x / CELL), cz: Math.floor(z / CELL), g });
  }
  rec.sort((a, b) => a.cx - b.cx || a.cz - b.cz || a.g - b.g || a.kh - b.kh);
  const TX = new Float32Array(N), TY = new Float32Array(N), TZ = new Float32Array(N), YAW = new Float32Array(N), SC = new Float32Array(N), PK = new Float32Array(N), KH = new Float32Array(N);
  const VID = new Uint8Array(N);
  for (let i = 0; i < N; i++) { const r = rec[i]; TX[i] = r.x; TY[i] = r.y; TZ[i] = r.z; YAW[i] = r.yaw; SC[i] = r.sc; PK[i] = r.pk; KH[i] = r.kh; VID[i] = r.vid; }
  const VK = new Uint8Array(nV), VCY = new Float32Array(nV), VR = new Float32Array(nV);
  for (const v of variants) { VK[v.id] = v.kind; VCY[v.id] = v.cy; VR[v.id] = v.R; }
  const chunks = [];
  for (let i = 0; i < N;) {
    const cx = rec[i].cx, cz = rec[i].cz;
    const ch = { groups: [], fmin: [1e9, 1e9, 1e9], fmax: [-1e9, -1e9, -1e9] };
    while (i < N && rec[i].cx === cx && rec[i].cz === cz) {
      const g = rec[i].g, i0 = i;
      const grp = { g, i0, i1: 0, n: 0, cmin: [1e9, 1e9, 1e9], cmax: [-1e9, -1e9, -1e9], fmin: [1e9, 1e9, 1e9], fmax: [-1e9, -1e9, -1e9], imp: null };
      while (i < N && rec[i].cx === cx && rec[i].cz === cz && rec[i].g === g) {
        const v = VID[i], cyw = TY[i] + VCY[v] * SC[i], rr = VR[v] * SC[i];
        const c = [TX[i], cyw, TZ[i]];
        for (let a = 0; a < 3; a++) {
          grp.cmin[a] = Math.min(grp.cmin[a], c[a]); grp.cmax[a] = Math.max(grp.cmax[a], c[a]);
          grp.fmin[a] = Math.min(grp.fmin[a], c[a] - rr); grp.fmax[a] = Math.max(grp.fmax[a], c[a] + rr);
        }
        i++;
      }
      grp.i1 = i;
      grp.imp = new Float32Array((grp.i1 - i0) * 8);
      for (let j = i0, o = 0; j < grp.i1; j++, o += 8) {
        const a = grp.imp; a[o] = TX[j]; a[o + 1] = TY[j]; a[o + 2] = TZ[j]; a[o + 3] = YAW[j]; a[o + 4] = SC[j]; a[o + 5] = PK[j]; a[o + 6] = 0; a[o + 7] = VID[j];
      }
      for (let a = 0; a < 3; a++) { ch.fmin[a] = Math.min(ch.fmin[a], grp.fmin[a]); ch.fmax[a] = Math.max(ch.fmax[a], grp.fmax[a]); }
      ch.groups.push(grp);
    }
    chunks.push(ch);
  }

  // ---- meshes
  const group = new THREE.Group(); group.name = 'vegetation'; group.matrixAutoUpdate = false;
  const vCount = new Int32Array(nV);
  for (let i = 0; i < N; i++) vCount[VID[i]]++;
  const lod0 = [], lod1 = [];
  for (const v of variants) {
    const b0 = instBuffer(v.geo0, treeMat, vCount[v.id], true, depthMat, distMat);
    const b1 = instBuffer(v.geo1, treeMat, vCount[v.id], true, depthMat, distMat);
    b0.mesh.name = 'veg-' + v.name + '-lod0'; b1.mesh.name = 'veg-' + v.name + '-lod1';
    group.add(b0.mesh, b1.mesh); lod0.push(b0); lod1.push(b1);
  }
  let impB;
  if (imp) {
    const q = new THREE.BufferGeometry();
    q.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0], 3));
    q.setAttribute('normal', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1], 3));
    q.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2));
    q.setIndex([0, 1, 2, 0, 2, 3]);
    impB = instBuffer(q, impMat, N, false, null, null);
    impB.mesh.receiveShadow = false; impB.mesh.name = 'veg-impostors';
    group.add(impB.mesh);
  }
  scene.add(group);

  // ---- LOD / quality state
  let quality = S.quality in QUALITY ? S.quality : 'high';
  const L0 = new Float32Array(6), B0 = new Float32Array(6), L1 = new Float32Array(6), B1 = new Float32Array(6), MX = new Float32Array(6), BM = new Float32Array(6);
  const GP = [{}, {}, {}];
  let density = 1, shadowD = 150;
  const obstacles = [];
  const applyQuality = () => {
    const Qq = QUALITY[quality];
    const ls = quality === 'low' ? 0.6 : quality === 'medium' ? 0.8 : 1.0;
    density = Qq.trees; shadowD = Qq.shadowDist;
    for (let k = 0; k < 6; k++) {
      const [a, b, m] = LOD_BASE[k];
      L0[k] = a * ls; B0[k] = L0[k] * 0.1; L1[k] = b * ls; B1[k] = L1[k] * 0.08;
      MX[k] = Qq.drawDist * m; BM[k] = MX[k] * 0.07;
      if (!imp) { L1[k] = MX[k]; B1[k] = 0; }
    }
    const kinds = [[5], [3], [0, 1, 2, 4]];
    for (let g = 0; g < 3; g++) {
      const ks = kinds[g];
      GP[g] = { l1: Math.max(...ks.map(k => L1[k])), mx: Math.max(...ks.map(k => MX[k])), mxin: Math.min(...ks.map(k => MX[k] - BM[k])) };
    }
    U.uShadowCull.value = shadowD + 25;
    for (const ch of chunks) for (const grp of ch.groups) {
      let lo = grp.i0, hi = grp.i1;
      while (lo < hi) { const m = (lo + hi) >> 1; if (KH[m] < density) lo = m + 1; else hi = m; }
      grp.n = lo - grp.i0;
    }
    obstacles.length = 0;
    for (const ch of chunks) for (const grp of ch.groups) {
      if (grp.g === 0) continue;
      for (let i = grp.i0; i < grp.i0 + grp.n; i++) obstacles.push({ x: TX[i], z: TZ[i], r: Math.max(0.12, variants[VID[i]].trunkR * 1.1 * SC[i]) });
    }
  };
  applyQuality();

  // ---- per-frame update
  const frustum = new THREE.Frustum(), pm = new THREE.Matrix4();
  const PL = new Float64Array(24);
  const lastM = new Float64Array(32); let dirty = true;
  const sphereIn = (x, y, z, r) => {
    for (let p = 0; p < 24; p += 4) if (PL[p] * x + PL[p + 1] * y + PL[p + 2] * z + PL[p + 3] < -r) return false;
    return true;
  };
  const boxIn = (mn, mx, m) => {
    for (let p = 0; p < 24; p += 4) {
      const x = PL[p] > 0 ? mx[0] + m : mn[0] - m, y = PL[p + 1] > 0 ? mx[1] + m : mn[1] - m, z = PL[p + 2] > 0 ? mx[2] + m : mn[2] - m;
      if (PL[p] * x + PL[p + 1] * y + PL[p + 2] * z + PL[p + 3] < 0) return false;
    }
    return true;
  };
  const emit = (b, i, fade) => {
    const o = b.n * 8, a = b.arr;
    a[o] = TX[i]; a[o + 1] = TY[i]; a[o + 2] = TZ[i]; a[o + 3] = YAW[i]; a[o + 4] = SC[i]; a[o + 5] = PK[i]; a[o + 6] = fade; a[o + 7] = VID[i];
    b.n++;
  };
  const stats = { lod0: 0, lod1: 0, imp: 0, calls: 0, tris: 0, initMs: 0, variants: variants.map(v => ({ name: v.name, tris0: v.tris0, tris1: v.tris1, bark0: v.bark0, cards0: v.cards0, cards1: v.cards1 })) };
  const far1 = imp ? null : lod1;   // no impostors: far trees use LOD1

  function update(camera, dt = 0) {
    U.uTime.value = S.time; U.uWind.value = S.wind;
    camera.updateMatrixWorld();
    const e = camera.matrixWorld.elements, pe = camera.projectionMatrix.elements;
    const cx = e[12], cy = e[13], cz = e[14];
    U.uCamPos.value.set(cx, cy, cz);
    let same = !dirty;
    if (same) for (let i = 0; i < 16; i++) if (lastM[i] !== e[i] || lastM[16 + i] !== pe[i]) { same = false; break; }
    if (same) return;
    for (let i = 0; i < 16; i++) { lastM[i] = e[i]; lastM[16 + i] = pe[i]; }
    dirty = false;
    pm.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    frustum.setFromProjectionMatrix(pm);
    for (let p = 0; p < 6; p++) { const pl = frustum.planes[p]; PL[p * 4] = pl.normal.x; PL[p * 4 + 1] = pl.normal.y; PL[p * 4 + 2] = pl.normal.z; PL[p * 4 + 3] = pl.constant; }
    for (const b of lod0) b.n = 0;
    for (const b of lod1) b.n = 0;
    if (impB) impB.n = 0;
    const sMarg = 22;
    for (let c = 0; c < chunks.length; c++) {
      const ch = chunks[c];
      if (!boxIn(ch.fmin, ch.fmax, sMarg)) continue;
      for (let gi = 0; gi < ch.groups.length; gi++) {
        const grp = ch.groups[gi];
        if (!grp.n) continue;
        const gp = GP[grp.g];
        const mn = grp.cmin, mx = grp.cmax;
        const qx = cx < mn[0] ? mn[0] - cx : cx > mx[0] ? cx - mx[0] : 0;
        const qy = cy < mn[1] ? mn[1] - cy : cy > mx[1] ? cy - mx[1] : 0;
        const qz = cz < mn[2] ? mn[2] - cz : cz > mx[2] ? cz - mx[2] : 0;
        const dmin = Math.sqrt(qx * qx + qy * qy + qz * qz);
        if (dmin > gp.mx) continue;
        if (!boxIn(grp.fmin, grp.fmax, dmin < shadowD ? sMarg : 0)) continue;
        const fx = Math.max(Math.abs(cx - mn[0]), Math.abs(cx - mx[0])), fy = Math.max(Math.abs(cy - mn[1]), Math.abs(cy - mx[1])), fz = Math.max(Math.abs(cz - mn[2]), Math.abs(cz - mx[2]));
        const dmax = Math.sqrt(fx * fx + fy * fy + fz * fz);
        if (impB && dmin > gp.l1 && dmax < gp.mxin) {
          impB.arr.set(grp.imp.subarray(0, grp.n * 8), impB.n * 8); impB.n += grp.n;
          continue;
        }
        for (let i = grp.i0, end = grp.i0 + grp.n; i < end; i++) {
          const v = VID[i], k = VK[v], s = SC[i];
          const x = TX[i], y = TY[i] + VCY[v] * s, z = TZ[i];
          const dx = x - cx, dy = y - cy, dz = z - cz;
          const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
          const mxd = MX[k];
          if (d >= mxd) continue;
          const rad = VR[v] * s;
          if (!sphereIn(x, y, z, d < shadowD ? rad + sMarg : rad)) continue;
          if (d < L0[k]) {
            const t = (d - (L0[k] - B0[k])) / B0[k];
            if (t > 0) { emit(lod0[v], i, t); if (t > 1e-3) emit(lod1[v], i, -t); }
            else emit(lod0[v], i, 0);
          } else if (d < L1[k] || !impB) {
            const t = impB ? (d - (L1[k] - B1[k])) / B1[k] : (d - (mxd - BM[k])) / BM[k];
            if (t > 0) { emit(lod1[v], i, t); if (impB && t > 1e-3) emit(impB, i, -t); }
            else emit(lod1[v], i, 0);
          } else {
            const t = (d - (mxd - BM[k])) / BM[k];
            emit(impB, i, t > 0 ? t : 0);
          }
        }
      }
    }
    let calls = 0, tris = 0, n0 = 0, n1 = 0;
    const fin = (b) => {
      const g = b.mesh.geometry;
      g.instanceCount = b.n; b.mesh.visible = b.n > 0;
      if (b.n > 0) { b.ib.clearUpdateRanges(); b.ib.addUpdateRange(0, b.n * 8); b.ib.needsUpdate = true; calls++; tris += b.n * b.tris; }
    };
    for (const b of lod0) { fin(b); n0 += b.n; }
    for (const b of lod1) { fin(b); n1 += b.n; }
    if (impB) fin(impB);
    stats.lod0 = n0; stats.lod1 = n1; stats.imp = impB ? impB.n : 0; stats.calls = calls; stats.tris = tris;
  }

  function setQuality(q) {
    if (!(q in QUALITY)) return;
    quality = q; applyQuality(); dirty = true;
  }

  function dispose() {
    scene.remove(group);
    for (const b of lod0.concat(lod1, impB ? [impB] : [])) b.mesh.geometry.dispose();
    for (const v of variants) { v.geo0.dispose(); v.geo1.dispose(); }
    if (impB) impB.mesh.geometry.dispose();
    for (const m of [treeMat, depthMat, distMat, impMat]) m.dispose();
    for (const t of [barkA, barkN, birchA, birchN, leafA, leafN]) t.dispose();
    if (imp) { imp.rtA.dispose(); imp.rtN.dispose(); }
    obstacles.length = 0;
  }

  stats.initMs = Math.round(performance.now() - t0);
  stats.timing = { tex: Math.round(tTex - t0), gen: Math.round(tGen - tTex), bake: Math.round(tBake - tGen), inst: Math.round(performance.now() - tBake) };
  return { update, obstacles, setQuality, dispose, group, stats };
}
