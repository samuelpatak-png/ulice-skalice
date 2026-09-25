// See-through slat fences and gates, and the plinth (y0 / base) that a fence can stand on.
// districts/index.js calls fenceBase() and slatFence() from drawFence; buildGate() comes from a driveway.
import { CITY } from '../city.js';
import { L, FT, tintFor } from '../../render/materials.js';
import { col, mulc } from '../../core/util.js';
import { S } from '../../core/state.js';

const tt = (layer, hex, k = 1) => tintFor(layer, mulc(col(hex), k));
const BASE = { wall: [0.3, L.PLASTER, '#d9cfbf'], stone: [0.45, L.STONE, '#a8977c'], brick: [0.3, L.BRICK, '#8a4a36'] };

// Plinth under a fence: f.y0 = its height, f.base = { type, color }. Returns the height the fence starts at.
export function fenceBase(f, a, b) {
  const y0 = f.y0 || (f.base ? 0.4 : 0);
  if (y0 <= 0.001) return 0;
  const dx = b[0] - a[0], dz = b[1] - a[1], Ln = Math.hypot(dx, dz); if (Ln < 0.15) return y0;
  const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], ang = Math.atan2(dz, dx), G = CITY.tile(a[0], a[1]).b;
  const [th, mat, hex] = BASE[(f.base && f.base.type) || 'wall'] || BASE.wall;
  const c = tt(mat, (f.base && f.base.color) || hex, 0.92);
  CITY.box(G, m[0], CITY.groundH(m[0], m[1]) - 0.15, m[1], Ln, y0 + 0.15, th, ang, c, mat, 0, tt(L.PRECAST, '#8f8a82', 0.9), L.PRECAST, 0);
  return y0;
}

// Vertical slats with visible gaps: two rails, posts and one box per slat (merged into the tile geometry).
export function slatFence(f, a, b, y0, h) {
  const dx = b[0] - a[0], dz = b[1] - a[1], Ln = Math.hypot(dx, dz); if (Ln < 0.12) return;
  const ang = Math.atan2(dz, dx), G = CITY.tile(a[0], a[1]).b;
  const c = tt(L.PLASTER_ROUGH, f.color || '#6a4632', 0.9), dark = mulc(c, 0.78);
  const at = (t) => [a[0] + dx * t, a[1] + dz * t];
  const pitch = S.quality === 'low' ? 0.3 : 0.16, sw = pitch * 0.55;
  const n = Math.max(1, Math.round((Ln - 0.1) / pitch));
  for (let i = 0; i <= n; i++) {
    const p = at((0.05 + (Ln - 0.1) * i / n) / Ln);
    CITY.box(G, p[0], y0 + 0.02, p[1], sw, h - 0.06, 0.035, ang, c, L.PLASTER_ROUGH, 0, c, L.PLASTER_ROUGH, 0);
  }
  for (const y of [0.12, h - 0.18]) {                           // horizontal rails behind the slats
    const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    CITY.box(G, m[0], y0 + y, m[1], Ln, 0.07, 0.045, ang, dark, L.PLASTER_ROUGH, 0, dark, L.PLASTER_ROUGH, 0);
  }
  for (const t of [0, 1]) {                                     // end posts
    const p = at(t);
    CITY.box(G, p[0], y0 - 0.05, p[1], 0.09, h + 0.1, 0.09, ang, dark, L.PLASTER_ROUGH, 0, dark, L.PLASTER_ROUGH, 0);
  }
}

// Driveway gate on the building line: 'swing' (two leaves), 'slide' (one leaf on a guide rail).
export function gate(cx, cz, ang, w, h, color, t = 'swing') {
  const u = [Math.cos(ang), Math.sin(ang)], G = CITY.tile(cx, cz).b, gy = CITY.groundH(cx, cz);
  const c = tt(L.PRECAST, color, 0.85), dark = mulc(c, 0.8);
  const leaf = (s0, s1) => {                                    // frame + vertical bars
    const Ln = s1 - s0, m = [cx + u[0] * (s0 + s1) / 2, cz + u[1] * (s0 + s1) / 2];
    for (const y of [gy + 0.14, gy + h - 0.12]) CITY.box(G, m[0], y, m[1], Ln, 0.08, 0.05, ang, dark, L.PRECAST, FT.STEEL, dark, L.PRECAST, FT.STEEL);
    const pitch = S.quality === 'low' ? 0.26 : 0.15, n = Math.max(2, Math.round(Ln / pitch));
    for (let i = 0; i <= n; i++) {
      const p = [cx + u[0] * (s0 + Ln * i / n), cz + u[1] * (s0 + Ln * i / n)];
      CITY.box(G, p[0], gy + 0.06, p[1], pitch * 0.4, h - 0.06, 0.035, ang, c, L.PRECAST, FT.STEEL, c, L.PRECAST, FT.STEEL);
    }
  };
  const hw = w / 2;
  for (const s of [-1, 1]) {                                    // gate posts
    const p = [cx + u[0] * s * (hw + 0.07), cz + u[1] * s * (hw + 0.07)];
    CITY.box(G, p[0], gy - 0.05, p[1], 0.14, h + 0.25, 0.14, ang, dark, L.PRECAST, FT.STEEL, dark, L.PRECAST, FT.STEEL);
  }
  if (t === 'slide') {
    leaf(-hw + 0.05, hw - 0.05);
    CITY.box(G, cx + u[0] * (hw + 0.6), gy + 0.02, cz + u[1] * (hw + 0.6), 1.2, 0.05, 0.08, ang, dark, L.PRECAST, FT.STEEL, dark, L.PRECAST, FT.STEEL);
  } else {
    leaf(-hw + 0.05, -0.03); leaf(0.03, hw - 0.05);
    CITY.box(G, cx, gy - 0.05, cz, 0.1, h + 0.1, 0.1, ang, dark, L.PRECAST, FT.STEEL, dark, L.PRECAST, FT.STEEL);
  }
  CITY.addEdge(cx - u[0] * hw, cz - u[1] * hw, cx + u[0] * hw, cz + u[1] * hw, h, 'wall');
}
