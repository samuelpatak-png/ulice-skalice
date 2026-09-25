// New street furniture types: litter bins, hydrants, manholes, gullies, mailboxes, parking meters,
// cabinets, phone booths, planters and bus stops. Data: furniture entries with `dir` in degrees.
import { CITY } from '../city.js';
import { addSign } from '../signs.js';
import { L, FT, tintFor } from '../../render/materials.js';
import { col, mulc } from '../../core/util.js';
import { S } from '../../core/state.js';
import { dirVec, dirAng } from './znacky.js';

const tt = (layer, hex, k = 1) => tintFor(layer, mulc(col(hex), k));
export const NEW_TYPES = new Set(['litterBin', 'hydrant', 'hydrantUnder', 'manhole', 'drain', 'mailbox', 'parkingMeter', 'cabinet', 'phoneBooth', 'planter', 'busStop']);
// flat ground details are not worth a draw on the low preset
const TINY = new Set(['manhole', 'drain', 'hydrantUnder']);

export function buildFurniturePrvky(list) {
  const low = S.quality === 'low';
  for (const f of list || []) {
    if (!NEW_TYPES.has(f.t) || !f.p) continue;
    if (low && TINY.has(f.t)) continue;
    const [x, z] = f.p, gy = CITY.groundH(x, z), dir = f.dir ?? 0, ang = dirAng(dir), n = dirVec(dir);
    const G = CITY.tile(x, z).b, Gf = CITY.tile(x, z).f;
    const iron = tt(L.PRECAST, '#2a2c2e', 0.85), steel = tt(L.PRECAST, '#9aa0a4', 0.9);
    switch (f.t) {
      case 'litterBin': {                                  // on a post (default), free standing or concrete
        const c = tt(L.PRECAST, f.color || (f.style === 'concrete' ? '#a8a49c' : '#2f4f38'), 0.85);
        if (f.style === 'concrete') CITY.cylinder(G, x, gy, z, 0.26, f.h ?? 0.7, 10, c, L.PRECAST, 0);
        else if (f.style === 'stand') { CITY.cylinder(G, x, gy, z, 0.22, f.h ?? 0.85, 10, c, L.PRECAST, FT.STEEL); CITY.cylinder(G, x, gy + (f.h ?? 0.85), z, 0.24, 0.05, 10, iron, L.PRECAST, FT.STEEL); }
        else {
          CITY.cylinder(G, x, gy, z, 0.05, f.h ?? 1.0, 6, iron, L.PRECAST, FT.STEEL);
          const q = [x + n[0] * 0.2, z + n[1] * 0.2];
          CITY.cylinder(G, q[0], gy + (f.h ?? 1.0) - 0.45, q[1], 0.19, 0.45, 10, c, L.PRECAST, FT.STEEL);
        }
        CITY.addObst(x, z, 0.3, 'm');
        break;
      }
      case 'hydrant': {                                    // above-ground hydrant
        const c = tt(L.PLASTER, f.color || '#b0261e', 0.85), h = f.h ?? 0.8;
        CITY.cylinder(G, x, gy, z, 0.16, 0.1, 10, iron, L.PRECAST, 0);
        CITY.cylinder(G, x, gy + 0.1, z, 0.1, h - 0.22, 10, c, L.PLASTER, 0);
        CITY.cylinder(G, x, gy + h - 0.12, z, 0.14, 0.12, 10, c, L.PLASTER, 0);
        CITY.coneAt(G, x, gy + h, z, 0.13, 0.12, 10, c, L.PLASTER, 0);
        for (const s of [1, -1]) CITY.cylinder(G, x + n[0] * s * 0.1, gy + h - 0.3, z + n[1] * s * 0.1, 0.05, 0.08, 6, iron, L.PRECAST, FT.STEEL);
        CITY.addObst(x, z, 0.2, 'm');
        break;
      }
      case 'hydrantUnder':                                 // underground hydrant: small cover in the paving
        CITY.disc(Gf, [x, z], 0.17, gy + 0.055, tt(L.PRECAST, '#4a4c4d', 0.85), L.PRECAST, FT.STEEL, 8);
        break;
      case 'manhole': {                                    // round cast-iron cover, or a square one when w is given
        const c = tt(L.PRECAST, f.color || '#4a4c4d', 0.85);
        if (f.w) CITY.box(G, x, gy + 0.03, z, f.w, 0.02, f.d || f.w, ang, c, L.PRECAST, FT.STEEL, c, L.PRECAST, FT.STEEL);
        else CITY.disc(Gf, [x, z], (f.w || 0.66) / 2, gy + 0.055, c, L.PRECAST, FT.STEEL, 14);
        break;
      }
      case 'drain': {                                      // kerb gully: dark frame with a slotted grate
        const w = f.w || 0.5, d = f.d || 0.32, c = tt(L.PRECAST, '#3a3c3d', 0.85);
        CITY.box(G, x, gy + 0.02, z, w, 0.02, d, ang, c, L.PRECAST, FT.STEEL, c, L.PRECAST, FT.STEEL);
        for (let i = -1; i <= 1; i++) {
          const q = [x + n[0] * i * d * 0.3, z + n[1] * i * d * 0.3];
          CITY.box(G, q[0], gy + 0.035, q[1], w * 0.8, 0.012, d * 0.14, ang, tt(L.PRECAST, '#17191a', 0.8), L.PRECAST, 0, tt(L.PRECAST, '#17191a', 0.8), L.PRECAST, 0);
        }
        break;
      }
      case 'mailbox': {                                    // post box (Slovenská pošta orange) on a post or on a wall
        const c = tt(L.PLASTER, f.color || '#e07a1f', 0.85), h = f.h ?? 1.15, w = f.w || 0.38, d = f.d || 0.26;
        const body = [x + n[0] * d * 0.5, z + n[1] * d * 0.5];
        CITY.box(G, body[0], gy + h - 0.5, body[1], w, 0.5, d, ang + Math.PI / 2, c, L.PLASTER, 0, mulc(c, 0.9), L.PLASTER, 0);
        CITY.box(G, x, gy, z, 0.07, h - 0.5, 0.07, ang, iron, L.PRECAST, FT.STEEL);
        CITY.addObst(x, z, 0.25, 'm');
        break;
      }
      case 'parkingMeter': {
        const c = tt(L.PRECAST, f.color || '#6d7275', 0.9), h = f.h ?? 1.45;
        CITY.box(G, x, gy, z, 0.28, h, 0.2, ang + Math.PI / 2, c, L.PRECAST, FT.STEEL, mulc(c, 0.9), L.PRECAST, FT.STEEL);
        const q = [x + n[0] * 0.11, z + n[1] * 0.11];
        CITY.box(G, q[0], gy + h - 0.5, q[1], 0.22, 0.34, 0.02, ang + Math.PI / 2, tt(L.PLASTER, '#17191a', 0.8), L.PLASTER, 0, tt(L.PLASTER, '#17191a', 0.8), L.PLASTER, 0);
        CITY.addObst(x, z, 0.2, 'm');
        break;
      }
      case 'cabinet': {                                    // distribution / meter cabinet: free standing or on a wall
        const w = f.w || 0.6, h = f.h || 0.9, d = f.d || 0.28, c = tt(L.PRECAST, f.color || '#b9bcb8', 0.9);
        const y = h >= 1.0 ? gy : gy + (f.y ?? 1.0);        // small boxes sit on the facade, tall ones on the ground
        const q = h >= 1.0 ? [x, z] : [x + n[0] * d * 0.5, z + n[1] * d * 0.5];
        CITY.box(G, q[0], y, q[1], w, h, d, ang + Math.PI / 2, c, L.PRECAST, 0, mulc(c, 0.92), L.PRECAST, 0);
        if (h >= 1.0) { CITY.box(G, q[0], y + h, q[1], w + 0.06, 0.04, d + 0.06, ang + Math.PI / 2, mulc(c, 0.85), L.PRECAST, 0); CITY.addObst(x, z, Math.max(w, d) * 0.6, 'm'); }
        break;
      }
      case 'phoneBooth': {
        const w = f.w || 1.0, d = f.d || 0.95, h = f.h || 2.3, c = tt(L.PRECAST, f.color || '#2f6ab0', 0.9);
        CITY.box(G, x, gy, z, w, h, d, ang + Math.PI / 2, c, L.PRECAST, 0, mulc(c, 0.85), L.PRECAST, 0);
        for (const s of [1, -1]) {
          const q = [x + n[0] * s * d * 0.5, z + n[1] * s * d * 0.5];
          CITY.box(G, q[0], gy + 0.5, q[1], w - 0.16, h - 0.85, 0.03, ang + Math.PI / 2, tt(L.PLASTER, '#8fa3ad', 0.8), L.PLASTER, FT.CURTAIN, tt(L.PLASTER, '#8fa3ad', 0.8), L.PLASTER, 0);
        }
        CITY.addObst(x, z, Math.max(w, d) * 0.6, 'm');
        break;
      }
      case 'planter': {                                    // concrete planter with a shrub
        const c = tt(L.PRECAST, f.color || '#a8a49c', 0.9), h = f.h || 0.55, w = f.w || 0.9;
        if (f.style === 'round') { CITY.cylinder(G, x, gy, z, w / 2, h, 12, c, L.PRECAST, 0, false); CITY.disc(G, [x, z], w / 2 - 0.08, gy + h - 0.06, tt(L.FOREST, '#3a3528'), L.FOREST, 0, 12); }
        else CITY.box(G, x, gy, z, w, h, f.d || w * 0.6, ang, c, L.PRECAST, 0, tt(L.FOREST, '#3a3528'), L.FOREST, 0);
        const gc = tt(L.GRASS, '#3f5d2a', 1);
        CITY.box(G, x, gy + h - 0.05, z, w * 0.8, 0.45, (f.d || w * 0.6) * 0.8, ang, gc, L.GRASS, FT.FOLIAGE, gc, L.GRASS, FT.FOLIAGE);
        CITY.addObst(x, z, w * 0.6, 'm');
        break;
      }
      case 'busStop': {                                    // shelter with a glazed back, bench and a stop flag
        const w = f.w || 3.6, d = f.d || 1.5, h = f.h || 2.45, u = [Math.cos(ang), Math.sin(ang)];
        const roof = tt(L.PRECAST, '#b9c3c8', 0.9), glass = tt(L.PLASTER, '#8fa3ad', 0.8);
        if (f.shelter !== false) {
          for (const s of [-1, 1]) {                        // corner posts
            for (const t of [-1, 1]) {
              const q = [x + u[0] * s * w / 2 + n[0] * t * d / 2, z + u[1] * s * w / 2 + n[1] * t * d / 2];
              CITY.box(G, q[0], gy, q[1], 0.09, h, 0.09, ang, steel, L.PRECAST, FT.STEEL);
            }
          }
          const back = [x - n[0] * d / 2, z - n[1] * d / 2];  // glazed back wall away from the facing direction
          CITY.box(G, back[0], gy + 0.25, back[1], w - 0.2, h - 0.55, 0.04, ang, glass, L.PLASTER, FT.CURTAIN, glass, L.PLASTER, 0);
          for (const s of [-1, 1]) {
            const q = [x + u[0] * s * (w / 2 - 0.02), z + u[1] * s * (w / 2 - 0.02)];
            CITY.box(G, q[0], gy + 0.25, q[1], 0.04, h - 0.55, d - 0.2, ang, glass, L.PLASTER, FT.CURTAIN, glass, L.PLASTER, 0);
          }
          CITY.box(G, x, gy + h, z, w + 0.25, 0.09, d + 0.35, ang, roof, L.PRECAST, 0, roof, L.PRECAST, 0);
          CITY.addEdge(x + u[0] * w / 2 - n[0] * d / 2, z + u[1] * w / 2 - n[1] * d / 2, x - u[0] * w / 2 - n[0] * d / 2, z - u[1] * w / 2 - n[1] * d / 2, h, 'b');
        }
        if (f.bench !== false) {
          const b = [x - n[0] * (d / 2 - 0.35), z - n[1] * (d / 2 - 0.35)];
          CITY.box(G, b[0], gy + 0.42, b[1], w - 0.9, 0.06, 0.4, ang, tt(L.PLASTER_ROUGH, '#7a5436', 0.9), L.PLASTER_ROUGH, FT.PLANKS);
          for (const s of [-1, 1]) { const q = [b[0] + u[0] * s * (w / 2 - 0.7), b[1] + u[1] * s * (w / 2 - 0.7)]; CITY.box(G, q[0], gy, q[1], 0.07, 0.42, 0.4, ang, steel, L.PRECAST, FT.STEEL); }
        }
        const fp = [x + u[0] * (w / 2 + 0.5), z + u[1] * (w / 2 + 0.5)];   // stop flag with the stop name
        CITY.cylinder(G, fp[0], gy, fp[1], 0.04, 2.9, 6, steel, L.PRECAST, FT.STEEL);
        for (const s of [1, -1]) addSign({ c: [fp[0] + n[0] * s * 0.05, gy + 2.6, fp[1] + n[1] * s * 0.05], n: [n[0] * s, n[1] * s], w: 0.62, h: 0.42, preset: 'plate', arg: [f.name || 'Zastávka', '#1b4f9c', 'street'], glow: 0, cut: false });
        CITY.addObst(x, z, Math.max(w, d) * 0.5, 'm');
        break;
      }
      default: break;
    }
  }
}
