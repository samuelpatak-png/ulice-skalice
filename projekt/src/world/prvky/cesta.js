// Things that belong to the carriageway: pedestrian crossings, road markings, driveways (dropped kerb,
// paving across the sidewalk, a gap in the fence and a gate) and the kerb ramps they share.
import { CITY, ROAD_Y, WALK_Y } from '../city.js';
import { L, FT, tintFor } from '../../render/materials.js';
import { col, mulc, segDist } from '../../core/util.js';
import { surfTint, surfLayer } from './surfaces.js';
import { gate as buildGate } from './ploty.js';

const tt = (layer, hex, k = 1) => tintFor(layer, mulc(col(hex), k));
const UP = [0, 1, 0];
// flat surfaces of this module have to win over the sidewalk / kerb (both depth priority 7), so they use a
// surface type with a higher priority; the shader gives ft 48 no treatment of its own, only the plain layer
const OVER_FT = FT.LOTLINE;

// ------------------------------------------------------------------ helpers
// road geometry around a point: direction, the side the point is on, kerb offset and sidewalk width
export function roadInfo(x, z, R = 40) {
  const { seg } = CITY.nearestRoadDist(x, z, [1, 2, 3, 4, 5], R);
  if (!seg) return null;
  const dx = seg.bx - seg.ax, dz = seg.bz - seg.az, Ln = Math.hypot(dx, dz) || 1;
  const u = [dx / Ln, dz / Ln], nl = [-u[1], u[0]];
  const side = ((x - seg.ax) * nl[0] + (z - seg.az) * nl[1]) >= 0 ? 1 : -1, si = side === 1 ? 0 : 1;
  const r = seg.r, o = r.swAt ? r.swAt(x, z) : null;
  const t = Math.max(0, Math.min(Ln, (x - seg.ax) * u[0] + (z - seg.az) * u[1]));
  return {
    r, u, n: [nl[0] * side, nl[1] * side], side,
    base: [seg.ax + u[0] * t, seg.az + u[1] * t],
    hw: r.w / 2, so: o ? o.off[si] : 0, sw: o ? o.sw[si] : (r.sw || 0),
  };
}
// kerb ramp: a concrete wedge laid against the kerb, from the kerb line down into the carriageway.
// (The kerb itself is built per road segment in city.js; a driveway or crossing is much shorter than one
// segment, so the drop is modelled as this ramp instead of cutting the kerb geometry.)
export function kerbRamp(cx, cz, u, n, w, dep = 0.55) {
  const G = CITY.tile(cx, cz).b, c = tt(L.PRECAST, '#a5a29b', 0.9);
  const gy = CITY.groundH(cx, cz);
  const P = (a, b, y) => [cx + u[0] * a + n[0] * b, gy + y, cz + u[1] * a + n[1] * b];
  const hw = w / 2, top = WALK_Y, bot = ROAD_Y + 0.012;
  G.quad(P(-hw, 0, top), P(hw, 0, top), P(hw, -dep, bot), P(-hw, -dep, bot), c, L.PRECAST, FT.CURB, [0, 0, 1, 0], [w, 0, 1, 0], [w, dep, 1, 0], [0, dep, 1, 0], UP);
  for (const s of [-1, 1]) {                       // side flares
    const a = s * hw;
    G.tri(P(a, 0, top), P(a, -dep, bot), P(a + s * dep * 0.7, 0, bot), c, L.PRECAST, 0, null, null, null, [u[0] * s, 0.2, u[1] * s]);
    G.quad(P(a, 0, top), P(a + s * dep * 0.7, 0, bot), P(a + s * dep * 0.7, -0.02, bot), P(a, 0, top - 0.02), c, L.PRECAST, 0, null, null, null, UP);
  }
}

// ------------------------------------------------------------------ crossings
// p = the axis across the carriageway, w = depth of the crossing measured along the road
export function buildCrossings(list) {
  const white = tt(L.ASPHALT, '#c9c9c3');
  for (const cr of list || []) {
    const p = cr.p; if (!p || p.length < 2) continue;
    const a = p[0], b = p[p.length - 1];
    const dx = b[0] - a[0], dz = b[1] - a[1], Ln = Math.hypot(dx, dz); if (Ln < 0.5) continue;
    const u = [dx / Ln, dz / Ln], n = [-u[1], u[0]], w = cr.w || 3;
    const G = CITY.tile(a[0], a[1]).f, gy = (x, z) => CITY.groundH(x, z) + ROAD_Y + 0.006;
    if ((cr.t || 'zebra') === 'zebra') {
      const nb = Math.max(1, Math.round(Ln / 1.0));
      for (let i = 0; i < nb; i++) {
        const t0 = (i + 0.25) * Ln / nb, t1 = (i + 0.75) * Ln / nb;
        CITY.ribbonSeg(G, [a[0] + u[0] * t0, a[1] + u[1] * t0], [a[0] + u[0] * t1, a[1] + u[1] * t1], w, gy, white, L.ASPHALT, FT.ZEBRA);
      }
    } else {                                        // unmarked crossing: only the dropped kerbs
      CITY.ribbonSeg(G, a, b, w, gy, white, L.ASPHALT, FT.ZEBRA);
    }
    // the ramps point into the carriageway, i.e. away from the end of the axis they sit on
    if (cr.drops) for (const [e, s] of [[a, -1], [b, 1]]) kerbRamp(e[0], e[1], n, [u[0] * s, u[1] * s], w + 0.4);
  }
}
// A crossing entered in a district replaces the OSM zebra (road k 11) within 3 m with a similar heading,
// so the same crossing is never drawn twice. Runs in the data pass, before the city is built.
export function dropOsmZebras(D, list) {
  if (!list || !list.length) return;
  const axes = list.filter(c => c.p && c.p.length >= 2).map(c => {
    const a = c.p[0], b = c.p[c.p.length - 1];
    return { a, b, ang: Math.atan2(b[1] - a[1], b[0] - a[0]) };
  });
  if (!axes.length) return;
  const dec = (enc) => { const out = []; let x = 0, z = 0; for (let i = 0; i < enc.length; i += 2) { x += enc[i]; z += enc[i + 1]; out.push([x / 10, z / 10]); } return out; };
  D.r = D.r.filter(r => {
    if (r[2] !== 11) return true;
    const q = dec(r[0]); if (q.length < 2) return true;
    const m = [(q[0][0] + q[q.length - 1][0]) / 2, (q[0][1] + q[q.length - 1][1]) / 2];
    const ang = Math.atan2(q[q.length - 1][1] - q[0][1], q[q.length - 1][0] - q[0][0]);
    return !axes.some(ax => {
      if (segDist(m[0], m[1], ax.a[0], ax.a[1], ax.b[0], ax.b[1]) > 3) return false;
      const d = Math.abs(Math.atan2(Math.sin(ang - ax.ang), Math.cos(ang - ax.ang)));
      return Math.min(d, Math.PI - d) < 0.52;      // within 30 degrees (either direction along the axis)
    });
  });
}

// ------------------------------------------------------------------ road markings
const paint = (p, q, w, yellow, y = 0.006) => {
  const c = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2], G = CITY.tile(c[0], c[1]).f;
  CITY.ribbonSeg(G, p, q, w, (x, z) => CITY.groundH(x, z) + ROAD_Y + y, tt(L.ASPHALT, yellow ? '#c8a12a' : '#c9c9c3'),
    L.ASPHALT, yellow ? FT.PAINT_YELLOW : FT.PAINT);
};
const tri3 = (a, b, c, yellow) => {
  const G = CITY.tile(a[0], a[1]).f, y = (x, z) => CITY.groundH(x, z) + ROAD_Y + 0.006;
  G.tri([a[0], y(a[0], a[1]), a[1]], [b[0], y(b[0], b[1]), b[1]], [c[0], y(c[0], c[1]), c[1]],
    tt(L.ASPHALT, yellow ? '#c8a12a' : '#c9c9c3'), L.ASPHALT, yellow ? FT.PAINT_YELLOW : FT.PAINT, null, null, null, UP);
};
export function buildMarkings(list) {
  for (const m of list || []) {
    const p = m.p; if (!p || p.length < 2) continue;
    const yellow = m.color === 'yellow', w = m.w || 0.125, t = m.t || 'solid';
    const A = p[0], B = p[1], dx = B[0] - A[0], dz = B[1] - A[1], Ln = Math.hypot(dx, dz) || 1;
    const u = [dx / Ln, dz / Ln], n = [-u[1], u[0]];
    if (t === 'solid' || t === 'parking') {
      for (let i = 0; i < p.length - 1; i++) paint(p[i], p[i + 1], w, yellow);
      if (t === 'parking') for (let i = 0; i < p.length - 1; i++) {   // bay ticks across the line every 2.5 m
        const a = p[i], b = p[i + 1], dd = [b[0] - a[0], b[1] - a[1]], Lq = Math.hypot(dd[0], dd[1]) || 1, uu = [dd[0] / Lq, dd[1] / Lq], nn = [-uu[1], uu[0]];
        for (let s = 0; s <= Lq + 0.01; s += 2.5) {
          const q = [a[0] + uu[0] * s, a[1] + uu[1] * s];
          paint(q, [q[0] + nn[0] * 2.0, q[1] + nn[1] * 2.0], w, yellow);
        }
      }
    } else if (t === 'dash') {
      const on = yellow ? 1.0 : 3.0, off = yellow ? 1.0 : 6.0;
      for (let i = 0; i < p.length - 1; i++) {
        const a = p[i], b = p[i + 1], dd = [b[0] - a[0], b[1] - a[1]], Lq = Math.hypot(dd[0], dd[1]) || 1;
        for (let s = 0; s < Lq - 0.05; s += on + off) {
          const s1 = Math.min(Lq, s + on);
          paint([a[0] + dd[0] * s / Lq, a[1] + dd[1] * s / Lq], [a[0] + dd[0] * s1 / Lq, a[1] + dd[1] * s1 / Lq], w, yellow);
        }
      }
    } else if (t === 'stop') {
      paint(A, B, Math.max(w, 0.5), yellow);
    } else if (t === 'giveway') {                    // row of triangles pointing at the driver
      const nb = Math.max(1, Math.floor(Ln / 0.8));
      for (let i = 0; i < nb; i++) {
        const s = (i + 0.2) * Ln / nb, q = [A[0] + u[0] * s, A[1] + u[1] * s], e = [q[0] + u[0] * 0.5, q[1] + u[1] * 0.5];
        tri3(q, e, [(q[0] + e[0]) / 2 + n[0] * 0.6, (q[1] + e[1]) / 2 + n[1] * 0.6], yellow);
      }
    } else if (t === 'arrow') {                      // lane arrow starting at p[0], pointing along p[0] -> p[1]
      const k = m.arrow || 'S', len = Math.min(Ln, 4.0), w0 = 0.28;
      const nl = [u[1], -u[0]];                      // left hand of the driver following p[0] -> p[1]
      const at = (s, o = 0) => [A[0] + u[0] * s + nl[0] * o, A[1] + u[1] * s + nl[1] * o];
      const straight = k === 'S' || k === 'SL' || k === 'SR', tip = straight ? len : len - 1.4;
      paint(at(0), at(straight ? tip - 1.1 : tip), w0, yellow);
      if (straight) tri3(at(tip - 1.1, 0.45), at(tip - 1.1, -0.45), at(tip), yellow);
      const sg = (k === 'L' || k === 'SL') ? 1 : (k === 'R' || k === 'SR') ? -1 : 0;
      if (sg) {
        const base = straight ? tip - 1.9 : tip;
        paint(at(base), at(base, sg * 0.9), w0, yellow);
        tri3(at(base - 0.35, sg * 0.9), at(base + 0.35, sg * 0.9), at(base, sg * 1.6), yellow);
      }
    } else if (t === 'yellowZigzag') {
      for (let i = 0; i < p.length - 1; i++) {
        const a = p[i], b = p[i + 1], dd = [b[0] - a[0], b[1] - a[1]], Lq = Math.hypot(dd[0], dd[1]) || 1;
        const uu = [dd[0] / Lq, dd[1] / Lq], nn = [-uu[1], uu[0]], step = 1.0, amp = m.w ? m.w * 4 : 0.5;
        let prev = [a[0] + nn[0] * amp / 2, a[1] + nn[1] * amp / 2];
        for (let s = step, k = 0; s <= Lq + 1e-6; s += step, k++) {
          const q = [a[0] + uu[0] * s + nn[0] * (k % 2 ? amp / 2 : -amp / 2), a[1] + uu[1] * s + nn[1] * (k % 2 ? amp / 2 : -amp / 2)];
          paint(prev, q, 0.12, true); prev = q;
        }
      }
    }
  }
}

// ------------------------------------------------------------------ driveways
// Lowers the kerb (ramp), lays the drive surface across the sidewalk and puts a gate on the building line.
// The gap in the fence is cut by fenceGaps() below, which districts/index.js calls for every fence run.
export function buildDriveways(list) {
  for (const d of list || []) {
    if (!d.p) continue;
    const [x, z] = d.p, info = roadInfo(x, z);
    if (!info) continue;
    const { u, n, base, hw, so, sw } = info, w = d.w || 3.5;
    const k0 = hw + so, k1 = hw + so + Math.max(sw, 0.6);
    const G = CITY.tile(x, z).f, mat = d.mat || 'pavers';
    const lay = surfLayer(mat), tint = surfTint(mat);
    const P = (a, b) => [base[0] + u[0] * a + n[0] * b, base[1] + u[1] * a + n[1] * b];
    const y = (px, pz) => CITY.groundH(px, pz) + WALK_Y + 0.004;
    const v3 = (q) => [q[0], y(q[0], q[1]), q[1]];
    const q0 = P(-w / 2, k0), q1 = P(w / 2, k0), q2 = P(w / 2, k1), q3 = P(-w / 2, k1);
    G.quad(v3(q0), v3(q1), v3(q2), v3(q3), tint, lay, OVER_FT, null, null, null, null, UP);
    kerbRamp(P(0, k0)[0], P(0, k0)[1], u, n, w + 0.5);
    if (d.gate && d.gate.t && d.gate.t !== 'none') {
      const c = P(0, k1), a = Math.atan2(u[1], u[0]);
      buildGate(c[0], c[1], a, w, d.gate.h || 1.6, d.gate.color || '#4a4d52', d.gate.t);
    }
  }
}
// Fence runs are cut where a driveway crosses them (the gate takes over there).
const GAP = new WeakMap();
export function fenceGaps(runs, drives) {
  if (!drives || !drives.length) return runs;
  let out = runs;
  for (const d of drives) {
    if (!d.p) continue;
    const w = (d.w || 3.5) / 2 + 0.15;
    let c = GAP.get(d);
    if (!c) {                                        // gate position on the building line, looked up once
      const info = roadInfo(d.p[0], d.p[1]), o = info ? info.hw + info.so + Math.max(info.sw, 0.6) : 0;
      c = info ? [info.base[0] + info.n[0] * o, info.base[1] + info.n[1] * o] : d.p;
      GAP.set(d, c);
    }
    const next = [];
    for (const [a, b] of out) {
      const dx = b[0] - a[0], dz = b[1] - a[1], Ln = Math.hypot(dx, dz) || 1;
      const t = ((c[0] - a[0]) * dx + (c[1] - a[1]) * dz) / (Ln * Ln);
      const perp = Math.abs((c[0] - a[0]) * dz - (c[1] - a[1]) * dx) / Ln;
      const tc = Math.max(0, Math.min(1, t));
      if (perp > 3.5 || segDist(c[0], c[1], a[0], a[1], b[0], b[1]) > 3.5) { next.push([a, b]); continue; }
      const t0 = tc - w / Ln, t1 = tc + w / Ln;
      if (t0 > 0.02) next.push([a, [a[0] + dx * t0, a[1] + dz * t0]]);
      if (t1 < 0.98) next.push([[a[0] + dx * t1, a[1] + dz * t1], b]);
    }
    out = next;
  }
  return out;
}
