// Vertical traffic signs (Slovak codes), traffic lights and street-name / house-number plates.
// The plates are painted into the shared sign atlas (signs.js), so the whole city needs only a couple of extra
// draw calls; the posts are merged into the per-tile city geometry like every other small prop.
import { addSign, PRESETS } from '../signs.js';
import { CITY } from '../city.js';
import { L, FT, tintFor } from '../../render/materials.js';
import { col, mulc } from '../../core/util.js';

const tt = (layer, hex, k = 1) => tintFor(layer, mulc(col(hex), k));
// dir = degrees clockwise from north -> unit vector in game (x, z); north is -z
export const dirVec = (d) => [Math.sin(d * Math.PI / 180), -Math.cos(d * Math.PI / 180)];
// the same direction as a maths angle atan2(z, x) (used by the instanced props and CITY.box)
export const dirAng = (d) => (d - 90) * Math.PI / 180;

// ------------------------------------------------------------------ atlas painting
const txt = (c, s, cx, cy, maxW, size, color, weight = '700', font = 'Arial') => {
  let px = size;
  c.font = `${weight} ${px}px ${font}, Arial, sans-serif`;
  const w = c.measureText(s).width;
  if (w > maxW) { px = Math.max(4, px * maxW / w); c.font = `${weight} ${px}px ${font}, Arial, sans-serif`; }
  c.fillStyle = color; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(s, cx, cy);
};
// silhouette of a plate shape in the box (0,0,W,H)
function shapePath(c, shape, W, H, k = 1) {
  const cx = W / 2, cy = H / 2, sx = W / 2 * k, sy = H / 2 * k;
  c.beginPath();
  if (shape === 'tri') { c.moveTo(cx, cy - sy); c.lineTo(cx + sx, cy + sy * 0.85); c.lineTo(cx - sx, cy + sy * 0.85); c.closePath(); }
  else if (shape === 'tdown') { c.moveTo(cx, cy + sy); c.lineTo(cx + sx, cy - sy * 0.85); c.lineTo(cx - sx, cy - sy * 0.85); c.closePath(); }
  else if (shape === 'octagon') { for (let i = 0; i < 8; i++) { const a = (i + 0.5) / 8 * Math.PI * 2; const p = [cx + Math.cos(a) * sx * 1.08, cy + Math.sin(a) * sy * 1.08]; i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]); } c.closePath(); }
  else if (shape === 'diamond') { c.moveTo(cx, cy - sy); c.lineTo(cx + sx, cy); c.lineTo(cx, cy + sy); c.lineTo(cx - sx, cy); c.closePath(); }
  else if (shape === 'circle') c.arc(cx, cy, Math.min(sx, sy), 0, Math.PI * 2);
  else c.rect(cx - sx, cy - sy, sx * 2, sy * 2);
}
// plate shape and size in metres for a sign code
export function plateOf(code) {
  const c = String(code || '').split(':')[0];
  if (c === 'P1') return ['tdown', 0.9, 0.8];
  if (c === 'P2') return ['octagon', 0.8, 0.8];
  if (c === 'P3' || c === 'P4') return ['diamond', 0.75, 0.75];
  if (/^A/.test(c)) return ['tri', 0.9, 0.8];
  if (/^[BC]/.test(c)) return ['circle', 0.7, 0.7];
  if (/^E/.test(c)) return ['plate', 0.7, 0.26];
  return ['rect', 0.7, 0.7];       // IP, IS, ... information signs
}
const RED = '#c8102e', BLUE = '#12428c', WHITE = '#f3f2ee', BLACK = '#1b1b19', YELL = '#f2c300';

// pictograms of the codes that actually occur in the surveyed districts; anything else gets the plate shape
// with the code written on it (readable at street distance and honest about what is not drawn yet)
function picto(c, code, W, H) {
  const cx = W / 2, cy = H / 2, R = Math.min(W, H) / 2;
  if (code === 'A22') {                                    // Deti: two running figures
    c.fillStyle = BLACK;
    for (const [x, s] of [[cx - W * 0.1, 1], [cx + W * 0.12, 0.85]]) {
      c.beginPath(); c.arc(x, cy - H * 0.02, R * 0.12 * s, 0, Math.PI * 2); c.fill();
      c.lineWidth = R * 0.11 * s; c.strokeStyle = BLACK; c.lineCap = 'round';
      c.beginPath(); c.moveTo(x, cy + H * 0.04); c.lineTo(x - W * 0.02, cy + H * 0.2);
      c.moveTo(x, cy + H * 0.2); c.lineTo(x + W * 0.09, cy + H * 0.3); c.lineTo(x + W * 0.1, cy + H * 0.3);
      c.moveTo(x, cy + H * 0.08); c.lineTo(x - W * 0.12, cy + H * 0.14); c.stroke();
    }
    return true;
  }
  if (code === 'IP6') {                                    // Priechod pre chodcov: blue square, white triangle, walker
    c.fillStyle = WHITE; c.beginPath(); c.moveTo(cx, cy - R * 0.72); c.lineTo(cx + R * 0.78, cy + R * 0.62); c.lineTo(cx - R * 0.78, cy + R * 0.62); c.closePath(); c.fill();
    c.fillStyle = BLACK; c.beginPath(); c.arc(cx - R * 0.05, cy - R * 0.28, R * 0.1, 0, Math.PI * 2); c.fill();
    c.lineWidth = R * 0.1; c.strokeStyle = BLACK; c.lineCap = 'round';
    c.beginPath(); c.moveTo(cx - R * 0.05, cy - R * 0.16); c.lineTo(cx - R * 0.02, cy + R * 0.12); c.lineTo(cx + R * 0.14, cy + R * 0.34);
    c.moveTo(cx - R * 0.02, cy + R * 0.12); c.lineTo(cx - R * 0.2, cy + R * 0.36); c.stroke();
    for (let i = 0; i < 3; i++) c.fillRect(cx - R * 0.55 + i * R * 0.24, cy + R * 0.4, R * 0.13, R * 0.2);
    return true;
  }
  return false;
}
// one sign face: white/red/blue plate with a pictogram; `back` paints the grey rear side
function drawSign(c, W, H, code, text, back) {
  const k = String(code || '').split(':')[0], arg = String(code || '').split(':')[1] || text || '';
  const [shape] = plateOf(k);
  c.clearRect(0, 0, W, H);
  if (back) { shapePath(c, shape, W, H); c.fillStyle = '#7b7e80'; c.fill(); return; }
  const cx = W / 2, cy = H / 2, R = Math.min(W, H) / 2;
  if (shape === 'circle') {
    const blue = /^C/.test(k) || k === 'B33' || k === 'B34';
    shapePath(c, shape, W, H); c.fillStyle = k === 'B2' ? RED : blue ? BLUE : WHITE; c.fill();
    if (k !== 'B2') { c.lineWidth = R * 0.2; c.strokeStyle = /^C/.test(k) ? BLUE : RED; c.beginPath(); c.arc(cx, cy, R * 0.9, 0, Math.PI * 2); c.stroke(); }
    if (k === 'B2') { c.fillStyle = WHITE; c.fillRect(cx - R * 0.66, cy - R * 0.17, R * 1.32, R * 0.34); }
    else if (k === 'B33' || k === 'B34') {
      c.lineWidth = R * 0.17; c.strokeStyle = RED; c.lineCap = 'butt';
      const d = R * 0.62;
      c.beginPath(); c.moveTo(cx - d, cy + d); c.lineTo(cx + d, cy - d);
      if (k === 'B34') { c.moveTo(cx - d, cy - d); c.lineTo(cx + d, cy + d); }
      c.stroke();
    } else if (/^B(20|31)/.test(k)) txt(c, arg || '50', cx, cy, R * 1.2, R * 1.1, BLACK, '900');
    else if (/^C/.test(k)) {                                // mandatory: white arrow
      c.fillStyle = WHITE; c.lineWidth = R * 0.18; c.strokeStyle = WHITE; c.lineCap = 'round';
      c.beginPath(); c.moveTo(cx, cy + R * 0.5); c.lineTo(cx, cy - R * 0.35); c.stroke();
      c.beginPath(); c.moveTo(cx, cy - R * 0.62); c.lineTo(cx + R * 0.3, cy - R * 0.22); c.lineTo(cx - R * 0.3, cy - R * 0.22); c.closePath(); c.fill();
    } else if (k !== 'B1' && !picto(c, k, W, H)) txt(c, k, cx, cy, R * 1.1, R * 0.7, BLACK, '700');
    return;
  }
  if (shape === 'tri' || shape === 'tdown') {
    shapePath(c, shape, W, H); c.fillStyle = WHITE; c.fill();
    c.lineWidth = Math.min(W, H) * 0.11; c.strokeStyle = RED; c.lineJoin = 'round'; c.stroke();
    if (shape === 'tri' && !picto(c, k, W, H)) txt(c, k, cx, cy + H * 0.12, W * 0.45, H * 0.3, BLACK, '700');
    return;
  }
  if (shape === 'octagon') {
    shapePath(c, shape, W, H); c.fillStyle = RED; c.fill();
    c.lineWidth = Math.min(W, H) * 0.06; c.strokeStyle = WHITE; c.stroke();
    txt(c, 'STOP', cx, cy, W * 0.72, H * 0.34, WHITE, '900');
    return;
  }
  if (shape === 'diamond') {
    shapePath(c, shape, W, H); c.fillStyle = WHITE; c.fill();
    shapePath(c, shape, W, H, 0.82); c.fillStyle = BLACK; c.fill();
    shapePath(c, shape, W, H, 0.72); c.fillStyle = k === 'P4' ? '#c9c7c0' : YELL; c.fill();
    return;
  }
  if (shape === 'plate') {                                 // supplementary plate: white, black border, text
    c.fillStyle = WHITE; c.fillRect(0, 0, W, H);
    c.lineWidth = Math.max(1, H * 0.09); c.strokeStyle = BLACK; c.strokeRect(H * 0.06, H * 0.06, W - H * 0.12, H - H * 0.12);
    if (/^E2/.test(k)) {                                   // Tvar križovatky: thick main road with a side arm
      c.strokeStyle = BLACK; c.lineWidth = H * 0.22; c.lineCap = 'butt';
      c.beginPath(); c.moveTo(W * 0.18, H * 0.5); c.lineTo(W * 0.82, H * 0.5); c.stroke();
      c.lineWidth = H * 0.11; c.beginPath(); c.moveTo(W * 0.5, H * 0.5); c.lineTo(W * 0.5, H * 0.86); c.stroke();
    } else txt(c, arg || k, W / 2, H / 2, W * 0.9, H * 0.55, BLACK, '700');
    return;
  }
  // information sign (IP / IS): blue board
  c.fillStyle = BLUE; c.fillRect(0, 0, W, H);
  c.lineWidth = Math.max(1, Math.min(W, H) * 0.06); c.strokeStyle = WHITE; c.strokeRect(0, 0, W, H);
  if (!picto(c, k, W, H)) {
    if (/^IP1[12]/.test(k)) txt(c, 'P', cx, cy, W * 0.6, H * 0.8, WHITE, '900');
    else txt(c, arg || k, cx, cy, W * 0.82, H * 0.4, WHITE, '700');
  }
}
PRESETS.tsign = (c, W, H, a = []) => drawSign(c, W, H, a[0], a[1], false);
PRESETS.tsignBack = (c, W, H, a = []) => drawSign(c, W, H, a[0], a[1], true);
PRESETS.plate = (c, W, H, a = []) => {          // street name / house number plate
  const [text = '', color = '#c8322d', kind = 'street'] = a;
  c.clearRect(0, 0, W, H);
  c.fillStyle = color; c.fillRect(0, 0, W, H);
  c.strokeStyle = 'rgba(255,255,255,0.85)'; c.lineWidth = Math.max(1, H * 0.06); c.strokeRect(H * 0.09, H * 0.09, W - H * 0.18, H - H * 0.18);
  const light = (col(color)[0] + col(color)[1] + col(color)[2]) / 3 > 0.35;
  txt(c, text, W / 2, H * 0.54, W * 0.82, H * (kind === 'number' ? 0.55 : 0.46), light ? '#20201e' : '#ffffff', '700', kind === 'number' ? 'Arial' : 'Georgia');
};

// ------------------------------------------------------------------ geometry
// one column of plates; y = centre of the topmost plate. Returns the height of the top edge.
function plates(x, z, y, dir, codes, faceOut = 0.045) {
  const n = dirVec(dir), back = [-n[0], -n[1]];
  let cy = y, top = y;
  codes.forEach((code, i) => {
    const [, w, h] = plateOf(code);
    if (i === 0) top = cy + h / 2; else cy -= h / 2;
    const c = [x + n[0] * faceOut, cy, z + n[1] * faceOut];
    addSign({ c, n, w, h, preset: 'tsign', arg: [code], glow: 0, cut: true });
    addSign({ c: [x - n[0] * faceOut, cy, z - n[1] * faceOut], n: back, w, h, preset: 'tsignBack', arg: [code], glow: 0, cut: true });
    cy -= h / 2 + 0.04;
  });
  return top;
}
const POLE_C = { grey: '#9aa0a4', white: '#e6e6e2', dark: '#3a3d40', green: '#3f5a3a' };

// trafficSigns: one entry = one post (or a plate on a lamp / pole / gate / fence / wall)
export function buildTrafficSigns(list, anchors) {
  for (const s of list || []) {
    if (!s.p || !s.codes || !s.codes.length) continue;
    let [x, z] = s.p;
    const dir = s.dir || 0, h = s.h ?? 2.2;
    const gy = CITY.groundH(x, z);
    const on = s.on;
    if (on && on !== 'gate' && on !== 'fence' && on !== 'wall') {                 // hang it on a lamp or a line pole
      const host = on === 'lamp' ? anchors.nearestLamp(x, z, 3.0) : anchors.poles[on];
      if (host) {
        const n = dirVec(dir), r = (host.r || 0.08) + 0.03;
        plates(host.x + n[0] * r, host.z + n[1] * r, CITY.groundH(host.x, host.z) + h, dir, s.codes);
        continue;
      }
    }
    if (on === 'gate' || on === 'fence' || on === 'wall') {                        // plate only, no post of its own
      plates(x, z, gy + h, dir, s.codes, 0.06);
      continue;
    }
    const top = plates(x, z, gy + h, dir, s.codes);
    const G = CITY.tile(x, z).b, pc = tt(L.PRECAST, POLE_C[s.pole] || POLE_C.grey, 0.9);
    CITY.cylinder(G, x, gy - 0.05, z, 0.032, top - gy + 0.14, 6, pc, L.PRECAST, FT.STEEL);
    CITY.addObst(x, z, 0.12, 'm');
  }
}

// trafficLights: signal head on a post, t 'car' (three lenses) or 'ped' (two)
export function buildTrafficLights(list) {
  for (const t of list || []) {
    if (!t.p) continue;
    const [x, z] = t.p, gy = CITY.groundH(x, z), dir = t.dir || 0, h = t.h ?? 3.0;
    const ang = dirAng(dir), n = dirVec(dir), G = CITY.tile(x, z).b;
    const dark = tt(L.PRECAST, '#26292b', 0.9), body = tt(L.PRECAST, '#1b1d1f', 0.9);
    CITY.cylinder(G, x, gy - 0.05, z, 0.055, h - 0.4, 8, dark, L.PRECAST, FT.STEEL);
    const ped = t.t === 'ped', lenses = ped ? ['#b02a20', '#2f7d3a'] : ['#b02a20', '#d7a932', '#2f7d3a'];
    const bh = lenses.length * 0.32 + 0.12, cx = x + n[0] * 0.09, cz = z + n[1] * 0.09;
    CITY.box(G, cx, gy + h - bh, cz, 0.3, bh, 0.24, ang + Math.PI / 2, body, L.PRECAST, FT.STEEL, body, L.PRECAST, FT.STEEL);
    lenses.forEach((hex, i) => {
      const y = gy + h - 0.22 - i * 0.32, q = [cx + n[0] * 0.13, cz + n[1] * 0.13];
      CITY.box(G, q[0], y, q[1], 0.2, 0.2, 0.04, ang + Math.PI / 2, tt(L.PLASTER, hex, 0.9), L.PLASTER, 0, tt(L.PLASTER, hex, 0.9), L.PLASTER, 0);
    });
    CITY.addObst(x, z, 0.14, 'm');
  }
}

// nameplates: street name and house number plates on a wall or on a small post
export function buildNameplates(list) {
  for (const p of list || []) {
    if (!p.p) continue;
    const [x, z] = p.p, gy = CITY.groundH(x, z), dir = p.dir || 0, n = dirVec(dir);
    const kind = p.t === 'number' ? 'number' : 'street';
    const text = p.text || '';
    const w = kind === 'number' ? 0.3 : Math.max(0.5, Math.min(1.1, 0.16 + text.length * 0.085));
    const hh = kind === 'number' ? 0.22 : 0.3, y = gy + (p.h ?? (kind === 'number' ? 3.0 : 2.8));
    const off = p.mount === 'pole' ? 0.03 : 0.05;
    addSign({ c: [x + n[0] * off, y, z + n[1] * off], n, w, h: hh, preset: 'plate', arg: [text, p.color || (kind === 'number' ? '#f2f0ea' : '#c8322d'), kind], glow: 0, cut: false });
    if (p.mount === 'pole') {
      const G = CITY.tile(x, z).b;
      CITY.cylinder(G, x, gy - 0.05, z, 0.03, y - gy + hh / 2, 6, tt(L.PRECAST, '#9aa0a4', 0.9), L.PRECAST, FT.STEEL);
      CITY.addObst(x, z, 0.1, 'm');
    }
  }
}
