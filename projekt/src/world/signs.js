// Shop signs, logos and billboards: drawn on one canvas atlas, rendered as textured quads (backlit at night).
import * as THREE from 'three';
import { S } from '../core/state.js';

export const SIGNS = { list: [], mats: [], update() { for (const m of SIGNS.mats) if (m.userData.glow) m.emissiveIntensity = S.night * m.userData.glow; } };

// o: { c: [x, y, z] centre, u: [ux, uz] right-to-left direction as seen from the front (unit), n: [nx, nz] facing, w, h,
//      preset: name, arg: preset argument, glow: 0..1 (backlight at night), cut: alpha cut-out (letters without a board) }
export function addSign(o) { SIGNS.list.push(o); return o; }

const PPM = 40;            // texels per metre
const rr = (c, x, y, w, h, r) => { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); };
// text fitted into a box (centre cx, cy), shrinking the font until it fits maxW
function txt(c, s, cx, cy, maxW, size, color, font = 'Arial', weight = '900', style = '') {
  let px = size;
  c.font = `${style} ${weight} ${px}px ${font}, Arial, sans-serif`;
  const w = c.measureText(s).width; if (w > maxW) { px = Math.max(6, px * maxW / w); c.font = `${style} ${weight} ${px}px ${font}, Arial, sans-serif`; }
  c.fillStyle = color; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(s, cx, cy);
}
const fill = (c, col, W, H) => { c.fillStyle = col; c.fillRect(0, 0, W, H); };
const grad = (c, W, H, a, b, vertical = false) => { const g = vertical ? c.createLinearGradient(0, 0, 0, H) : c.createLinearGradient(0, 0, W, H); g.addColorStop(0, a); g.addColorStop(1, b); c.fillStyle = g; c.fillRect(0, 0, W, H); };
const person = (c, x, y, s, skin, shirt) => { // simple poster figure
  c.fillStyle = shirt; rr(c, x - s * 0.5, y + s * 0.55, s, s * 1.3, s * 0.25); c.fill();
  c.fillStyle = skin; c.beginPath(); c.arc(x, y + s * 0.3, s * 0.3, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#3b2a20'; c.beginPath(); c.arc(x, y + s * 0.2, s * 0.31, Math.PI, 0); c.fill();
};

export const PRESETS = {
  tesco(c, W, H) { // white board, red TESCO, five blue dashes
    fill(c, '#f7f7f5', W, H);
    txt(c, 'TESCO', W / 2, H * 0.43, W * 0.84, H * 0.56, '#e1251b', 'Georgia', '900');
    c.fillStyle = '#1f4f9e'; const dw = W * 0.12, gap = W * 0.03, y = H * 0.77, x0 = W / 2 - (5 * dw + 4 * gap) / 2;
    for (let i = 0; i < 5; i++) c.fillRect(x0 + i * (dw + gap), y, dw, H * 0.07);
  },
  ff(c, W, H) { fill(c, '#111214', W, H); txt(c, 'F&F', W / 2, H / 2, W * 0.8, H * 0.62, '#f2f2f2', 'Georgia', '700'); },
  kaufland(c, W, H) { // white board: red square with the white K mark, wordmark below
    fill(c, '#f7f7f5', W, H);
    const s = Math.min(W * 0.78, H * 0.62), x = (W - s) / 2, y = H * 0.06;
    c.fillStyle = '#e3001b'; c.fillRect(x, y, s, s);
    c.fillStyle = '#ffffff';
    c.fillRect(x + s * 0.2, y + s * 0.18, s * 0.2, s * 0.64);                              // stem
    c.beginPath(); c.moveTo(x + s * 0.42, y + s * 0.5); c.lineTo(x + s * 0.8, y + s * 0.18); c.lineTo(x + s * 0.8, y + s * 0.42); c.lineTo(x + s * 0.56, y + s * 0.6); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(x + s * 0.5, y + s * 0.56); c.lineTo(x + s * 0.8, y + s * 0.82); c.lineTo(x + s * 0.8, y + s * 0.6); c.lineTo(x + s * 0.62, y + s * 0.46); c.closePath(); c.fill();
    txt(c, 'Kaufland', W / 2, y + s + (H - y - s) / 2, W * 0.9, (H - s) * 0.5, '#e3001b', 'Arial', '700');
  },
  kauflandBand(c, W, H) { // anthracite band with white line drawings of groceries
    fill(c, '#26272a', W, H);
    c.strokeStyle = '#f2f2f2'; c.lineWidth = Math.max(2, H * 0.03); c.lineCap = 'round';
    const n = Math.floor(W / (H * 0.42));
    for (let i = 0; i < n; i++) {
      const x = (i + 0.5) * W / n + Math.sin(i * 7.3) * H * 0.08, y = H * (0.22 + 0.56 * ((i * 37) % 10) / 10), s = H * 0.085, k = (i * 5) % 6;
      c.beginPath();
      if (k === 0) c.arc(x, y, s, 0, Math.PI * 2);                                              // apple
      else if (k === 1) { c.rect(x - s * 0.45, y - s, s * 0.9, s * 2); }                      // bottle
      else if (k === 2) { c.ellipse(x, y, s * 1.2, s * 0.6, 0.5, 0, Math.PI * 2); }          // banana-ish
      else if (k === 3) { c.moveTo(x - s, y + s); c.lineTo(x, y - s); c.lineTo(x + s, y + s); c.closePath(); } // cheese
      else if (k === 4) { c.arc(x, y, s * 0.7, 0, Math.PI * 2); c.moveTo(x, y - s * 0.7); c.lineTo(x + s * 0.3, y - s * 1.2); }
      else { c.rect(x - s, y - s * 0.6, s * 2, s * 1.2); c.moveTo(x - s, y); c.lineTo(x + s, y); }
      c.stroke();
    }
  },
  kauflandCart(c, W, H) { // big white line drawing of a shopping cart on anthracite
    fill(c, '#26272a', W, H);
    c.strokeStyle = '#f2f2f2'; c.lineWidth = Math.max(3, W * 0.025); c.lineJoin = 'round';
    c.beginPath(); c.moveTo(W * 0.08, H * 0.25); c.lineTo(W * 0.22, H * 0.25); c.lineTo(W * 0.32, H * 0.72); c.lineTo(W * 0.85, H * 0.72); c.lineTo(W * 0.92, H * 0.38); c.lineTo(W * 0.26, H * 0.38); c.stroke();
    for (const x of [0.38, 0.8]) { c.beginPath(); c.arc(W * x, H * 0.84, W * 0.05, 0, Math.PI * 2); c.stroke(); }
    for (let i = 0; i < 5; i++) { c.beginPath(); c.arc(W * (0.36 + i * 0.1), H * (0.3 - (i % 2) * 0.08), W * 0.045, 0, Math.PI * 2); c.stroke(); }
  },
  max(c, W, H, keep) { // MAX roof letters: blue with a yellow star, cut out
    if (!keep) c.clearRect(0, 0, W, H);
    txt(c, 'MAX', W * 0.47, H * 0.56, W * 0.84, H * 0.95, '#1f4fbf', 'Arial Black', '900', 'italic');
    c.fillStyle = '#f5c400'; c.beginPath();
    const cx = W * 0.9, cy = H * 0.22, r = H * 0.2;
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr2 = i % 2 ? r * 0.45 : r; c.lineTo(cx + Math.cos(a) * rr2, cy + Math.sin(a) * rr2); }
    c.closePath(); c.fill();
  },
  maxPylon(c, W, H) { fill(c, '#f4f5f6', W, H); PRESETS.max(c, W, H, true); },
  nay(c, W, H) { // NAY roof letters with the play-button roundel, cut out
    c.clearRect(0, 0, W, H);
    const r = H * 0.38; c.strokeStyle = '#1d4fb6'; c.lineWidth = H * 0.1; c.beginPath(); c.arc(r + H * 0.08, H / 2, r, 0, Math.PI * 2); c.stroke();
    c.fillStyle = '#1d4fb6'; c.beginPath(); c.moveTo(r * 0.75 + H * 0.08, H * 0.32); c.lineTo(r * 1.45 + H * 0.08, H / 2); c.lineTo(r * 0.75 + H * 0.08, H * 0.68); c.closePath(); c.fill();
    txt(c, 'NAY', W * 0.62, H * 0.55, W * 0.6, H * 0.95, '#1d4fb6', 'Arial Black', '900');
  },
  pepco(c, W, H) { fill(c, '#ffffff', W, H); c.strokeStyle = '#1d3f8f'; c.lineWidth = H * 0.06; rr(c, W * 0.05, H * 0.1, W * 0.9, H * 0.8, H * 0.35); c.stroke(); txt(c, 'PEPCO', W / 2, H / 2, W * 0.78, H * 0.55, '#1d3f8f', 'Arial', '900'); },
  pepcoAd(c, W, H) { fill(c, '#2458c6', W, H); c.fillStyle = '#ffffff'; c.beginPath(); c.ellipse(W / 2, H * 0.5, W * 0.38, H * 0.15, 0, 0, Math.PI * 2); c.fill(); txt(c, 'PEPCO', W / 2, H * 0.5, W * 0.6, H * 0.18, '#e4301f', 'Arial', '900'); },
  takko(c, W, H) { fill(c, '#f4d000', W, H); txt(c, 'TAKKO', W / 2, H * 0.44, W * 0.84, H * 0.55, '#2b2b2b', 'Arial', '900'); txt(c, 'FASHION', W / 2, H * 0.82, W * 0.5, H * 0.17, '#2b2b2b', 'Arial', '700'); },
  kik(c, W, H) { fill(c, '#ffffff', W, H); txt(c, 'KiK', W / 2, H * 0.52, W * 0.86, H * 0.8, '#e2231a', 'Arial Black', '900'); },
  telekom(c, W, H) { fill(c, '#e20074', W, H); txt(c, '· · T · ·', W / 2, H / 2, W * 0.8, H * 0.7, '#ffffff', 'Arial', '900'); },
  dracik(c, W, H) { fill(c, '#3aa935', W, H); txt(c, 'DRÁČIK', W / 2, H / 2, W * 0.86, H * 0.6, '#ffffff', 'Arial', '900'); },
  cinemax(c, W, H) { fill(c, '#3b3e44', W, H); txt(c, 'CINEMAX', W / 2, H / 2, W * 0.9, H * 0.66, '#ffffff', 'Arial', '900'); },
  euronics(c, W, H) { fill(c, '#1b3d8f', W, H); txt(c, 'DOMOSS', W * 0.18, H * 0.3, W * 0.28, H * 0.22, '#ffffff', 'Arial', '700'); txt(c, 'EURONICS', W * 0.46, H * 0.62, W * 0.62, H * 0.44, '#ffffff', 'Arial', '900', 'italic'); txt(c, '★', W * 0.86, H * 0.45, W * 0.2, H * 0.5, '#ffffff'); },
  orion(c, W, H) { fill(c, '#1e2f5c', W, H); txt(c, 'orion', W / 2, H / 2, W * 0.7, H * 0.6, '#ffffff', 'Arial', '700'); },
  tmsport(c, W, H) { fill(c, '#161616', W, H); txt(c, 'TM', W * 0.25, H / 2, W * 0.3, H * 0.62, '#e2231a', 'Arial Black', '900', 'italic'); txt(c, 'SPORT', W * 0.62, H / 2, W * 0.5, H * 0.5, '#ffffff', 'Arial', '900', 'italic'); },
  majestic(c, W, H) { fill(c, '#15171a', W, H); c.strokeStyle = '#c9a24a'; c.lineWidth = H * 0.03; c.beginPath(); c.moveTo(W * 0.38, H * 0.34); c.lineTo(W * 0.42, H * 0.18); c.lineTo(W * 0.5, H * 0.28); c.lineTo(W * 0.58, H * 0.18); c.lineTo(W * 0.62, H * 0.34); c.closePath(); c.stroke(); txt(c, 'MAJESTIC', W / 2, H * 0.52, W * 0.84, H * 0.16, '#c9a24a', 'Georgia', '700'); txt(c, 'café', W / 2, H * 0.66, W * 0.3, H * 0.09, '#c9a24a', 'Georgia', '400', 'italic'); grad(c, W, H, 'rgba(0,0,0,0)', 'rgba(0,0,0,0)'); c.fillStyle = '#4a6b3a'; c.fillRect(W * 0.1, H * 0.78, W * 0.8, H * 0.15); },
  dm(c, W, H) { fill(c, '#ffffff', W, H); txt(c, 'dm', W * 0.42, H * 0.5, W * 0.5, H * 0.7, '#1f3f8c', 'Arial', '900'); c.fillStyle = '#f5b800'; c.beginPath(); c.arc(W * 0.78, H * 0.35, H * 0.12, 0, Math.PI * 2); c.fill(); c.fillStyle = '#e2231a'; c.beginPath(); c.arc(W * 0.78, H * 0.68, H * 0.12, 0, Math.PI); c.fill(); },
  planeo(c, W, H) { fill(c, '#ffffff', W, H); txt(c, 'PLANEO', W * 0.5, H * 0.42, W * 0.84, H * 0.5, '#1a1a1a', 'Arial', '900'); txt(c, 'ELEKTRO', W / 2, H * 0.8, W * 0.5, H * 0.18, '#e2231a', 'Arial', '700'); },
  tedi(c, W, H) { fill(c, '#2a6dc9', W, H); txt(c, 'TEDi', W / 2, H / 2, W * 0.7, H * 0.66, '#ffffff', 'Arial', '900'); },
  sinsay(c, W, H) { fill(c, '#ffffff', W, H); txt(c, 'Sinsay', W / 2, H / 2, W * 0.8, H * 0.56, '#111111', 'Arial', '700'); },
  superzoo(c, W, H) { fill(c, '#ffffff', W, H); txt(c, 'SUPER ZOO', W / 2, H / 2, W * 0.88, H * 0.5, '#2f8a3a', 'Arial', '900'); },
  sportisimo(c, W, H) { fill(c, '#0e3a86', W, H); txt(c, 'SPORTISIMO', W / 2, H / 2, W * 0.9, H * 0.5, '#ffffff', 'Arial', '900', 'italic'); },
  slovnaft(c, W, H) { fill(c, '#f3c300', W, H); txt(c, 'Slovnaft', W / 2, H / 2, W * 0.5, H * 0.62, '#11345e', 'Arial', '700'); },
  drmax(c, W, H) { fill(c, '#1f8a4c', W, H); txt(c, 'Dr.Max', W / 2, H / 2, W * 0.8, H * 0.6, '#ffffff', 'Arial', '900'); },
  mgym(c, W, H) { fill(c, '#1a1a1a', W, H); txt(c, 'MGYM', W / 2, H / 2, W * 0.8, H * 0.6, '#57c34a', 'Arial', '900'); },
  megashop(c, W, H) {
    grad(c, W, H, '#f0d34a', '#f7a800', true);
    for (let i = 0; i < 4; i++) person(c, W * (0.1 + i * 0.1), H * 0.28, H * 0.22, '#e7b894', ['#d23', '#27c', '#2a4', '#fa0'][i]);
    txt(c, 'MEGASHOP', W * 0.7, H * 0.2, W * 0.55, H * 0.24, '#d32020', 'Arial', '900');
    c.fillStyle = '#ffffff'; c.fillRect(W * 0.45, H * 0.4, W * 0.52, H * 0.5);
    txt(c, 'TEXTIL - OBUV - TAŠKY', W * 0.71, H * 0.53, W * 0.5, H * 0.1, '#1e3d8f', 'Arial', '900');
    txt(c, 'DOMÁCE POTREBY', W * 0.71, H * 0.66, W * 0.5, H * 0.1, '#1e3d8f', 'Arial', '900');
    txt(c, 'KOZMETIKA - HRAČKY', W * 0.71, H * 0.79, W * 0.5, H * 0.1, '#1e3d8f', 'Arial', '900');
  },
  // generic billboard: arg = [bg1, bg2, headline, sub, accent]
  ad(c, W, H, a = []) {
    const [b1 = '#2a6fd0', b2 = '#12357a', head = 'AKCIA', sub = '', acc = '#ffd200', fig = true, tc = '#ffffff'] = a;
    grad(c, W, H, b1, b2);
    if (fig) person(c, W * 0.22, H * 0.18, H * 0.34, '#e8bb97', acc);
    txt(c, head, fig ? W * 0.64 : W / 2, H * 0.38, W * (fig ? 0.6 : 0.9), H * 0.26, tc, 'Arial', '900');
    if (sub) txt(c, sub, fig ? W * 0.64 : W / 2, H * 0.68, W * (fig ? 0.6 : 0.9), H * 0.12, acc, 'Arial', '700');
    c.strokeStyle = 'rgba(255,255,255,0.85)'; c.lineWidth = Math.max(2, H * 0.02); c.strokeRect(0, 0, W, H);
  },
  percent(c, W, H) { fill(c, '#ffffff', W, H); txt(c, '1+1', W * 0.25, H * 0.4, W * 0.4, H * 0.3, '#1d3f8f', 'Arial', '900'); c.fillStyle = '#e4301f'; c.beginPath(); c.arc(W * 0.66, H * 0.42, H * 0.3, 0, Math.PI * 2); c.fill(); txt(c, '-70%', W * 0.66, H * 0.42, H * 0.5, H * 0.22, '#ffffff', 'Arial', '900'); txt(c, 'ZĽAVA NA VŠETKO', W / 2, H * 0.85, W * 0.9, H * 0.09, '#1d3f8f', 'Arial', '900'); },
  flag(c, W, H, a = ['#ffffff', '#e2231a']) { fill(c, a[0], W, H); c.fillStyle = a[1]; c.fillRect(0, H * 0.62, W, H * 0.38); },
  parkP(c, W, H) { fill(c, '#1f5fb8', W, H); txt(c, 'P', W / 2, H * 0.52, W * 0.8, H * 0.8, '#ffffff', 'Arial', '900'); },
  // ---- free-standing billboards of the shopping-zone car parks (campaigns seen 10/2022)
  myjava(c, W, H) { // folk festival: deep blue, rings of folk ornaments
    grad(c, W, H, '#2c2d7c', '#16336e');
    const orn = [['#e8b04a', 0.12, 0.3], ['#d8577a', 0.07, 0.75], ['#5fb3d9', 0.9, 0.28], ['#e8b04a', 0.93, 0.8], ['#9a6fd1', 0.2, 0.92]];
    for (const [cc, x, y] of orn) for (let k = 3; k > 0; k--) { c.fillStyle = k % 2 ? cc : '#1d2a6a'; c.beginPath(); c.arc(W * x, H * y, H * 0.09 * k, 0, Math.PI * 2); c.fill(); }
    txt(c, '42. MEDZINÁRODNÝ FOLKLÓRNY FESTIVAL', W / 2, H * 0.2, W * 0.6, H * 0.08, '#f4e7c5', 'Arial', '700');
    txt(c, 'MYJAVA', W / 2, H * 0.5, W * 0.5, H * 0.3, '#ffffff', 'Georgia', '700');
    txt(c, '15. – 19. JÚNA 2022', W / 2, H * 0.74, W * 0.4, H * 0.1, '#f4e7c5', 'Arial', '700');
  },
  tauris(c, W, H) { // grill competition: green, red kettle grill, TAURIS box
    grad(c, W, H, '#7db84a', '#4a8a2f');
    c.fillStyle = '#d42a24'; c.fillRect(W * 0.03, H * 0.08, W * 0.14, H * 0.2); txt(c, 'TAURIS', W * 0.1, H * 0.18, W * 0.12, H * 0.1, '#ffffff', 'Arial', '900');
    txt(c, 'Súťaž', W * 0.2, H * 0.52, W * 0.3, H * 0.28, '#ffffff', 'Georgia', '700', 'italic');
    txt(c, 'o horúce ceny', W * 0.22, H * 0.76, W * 0.34, H * 0.16, '#ffffff', 'Georgia', '700', 'italic');
    c.fillStyle = '#c92420'; c.beginPath(); c.arc(W * 0.52, H * 0.5, H * 0.28, Math.PI, 0); c.fill(); c.fillRect(W * 0.52 - H * 0.28, H * 0.5, H * 0.56, H * 0.06);
    c.fillStyle = '#2b2b2b'; c.fillRect(W * 0.5, H * 0.56, W * 0.04, H * 0.3);
    c.fillStyle = '#ffffff'; c.fillRect(W * 0.68, H * 0.1, W * 0.3, H * 0.62);
    txt(c, 'KÚP SI 2 PRODUKTY', W * 0.83, H * 0.2, W * 0.28, H * 0.08, '#c92420', 'Arial', '900');
    txt(c, 'TAURIS GRIL', W * 0.83, H * 0.32, W * 0.28, H * 0.08, '#2b2b2b', 'Arial', '700');
    txt(c, 'www.sutazetauris.sk', W * 0.5, H * 0.92, W * 0.4, H * 0.07, '#ffffff', 'Arial', '700');
  },
  ahoj(c, W, H) { // regional radio: dark teal, smile and sun
    grad(c, W, H, '#1f5160', '#133a47', true);
    c.fillStyle = '#f2c230'; c.beginPath(); c.arc(W * 0.87, H * 0.25, H * 0.17, 0, Math.PI * 2); c.fill();
    txt(c, 'AHOJ, SKALICA!', W / 2, H * 0.44, W * 0.72, H * 0.24, '#ffffff', 'Arial', '900');
    c.strokeStyle = '#f2c230'; c.lineWidth = H * 0.05; c.lineCap = 'round'; c.beginPath(); c.arc(W / 2, H * 0.36, W * 0.16, 0.25 * Math.PI, 0.75 * Math.PI); c.stroke();
    txt(c, 'TRNAVSKÉ RÁDIO', W * 0.14, H * 0.85, W * 0.22, H * 0.08, '#f2c230', 'Arial', '900');
    txt(c, 'www.trnavskeradio.sk', W * 0.84, H * 0.88, W * 0.25, H * 0.06, '#ffffff', 'Arial', '700');
  },
  mirai(c, W, H) { // summer music festival: colourful rings on dark, band name
    fill(c, '#1a1a24', W, H);
    const cols = ['#e2466f', '#f39a2b', '#f5d33b', '#43b3a0', '#3d7fd1', '#7b4bc2'];
    for (let i = 0; i < cols.length; i++) { c.fillStyle = cols[i]; c.beginPath(); c.arc(W * 0.5, H * 0.45, H * (0.7 - i * 0.1), 0, Math.PI * 2); c.fill(); }
    for (let i = 0; i < 4; i++) person(c, W * (0.37 + i * 0.09), H * 0.12, H * 0.3, '#e2b893', ['#2a2a2a', '#f2f2f2', '#3a3f58', '#6b4b3a'][i]);
    txt(c, 'MIRAI', W / 2, H * 0.72, W * 0.4, H * 0.26, '#ffffff', 'Arial Black', '900');
    c.fillStyle = '#f5d33b'; c.fillRect(W * 0.76, H * 0.06, W * 0.22, H * 0.28);
    txt(c, '21–23/7', W * 0.87, H * 0.14, W * 0.2, H * 0.11, '#1a1a24', 'Arial', '900');
    txt(c, 'AREÁL PRI LETISKU', W * 0.87, H * 0.27, W * 0.2, H * 0.07, '#1a1a24', 'Arial', '700');
    txt(c, 'CIBULA FEST', W * 0.12, H * 0.14, W * 0.18, H * 0.1, '#ffffff', 'Arial', '900');
    c.fillStyle = '#f4f4f4'; c.fillRect(0, H * 0.86, W, H * 0.14);
  },
  domoss(c, W, H) { // electronics shop: black, big red percent
    fill(c, '#0e0e10', W, H);
    txt(c, '%', W * 0.12, H * 0.52, W * 0.2, H * 0.7, '#e2231a', 'Arial Black', '900');
    txt(c, 'DOMOSS', W * 0.55, H * 0.3, W * 0.5, H * 0.2, '#ffffff', 'Arial', '900');
    txt(c, 'BLACK FRIDAY', W * 0.55, H * 0.6, W * 0.66, H * 0.28, '#ffffff', 'Arial Black', '900');
    txt(c, 'Skalica · MAX', W * 0.55, H * 0.87, W * 0.4, H * 0.08, '#e2231a', 'Arial', '700');
  },
  zipser(c, W, H) { // meat products: blue, man in an orange cap with a tray
    grad(c, W, H, '#2749a8', '#16307a');
    person(c, W * 0.3, H * 0.12, H * 0.5, '#e8b58f', '#f2f2f2');
    c.fillStyle = '#f07f1c'; c.beginPath(); c.arc(W * 0.3, H * 0.2, H * 0.17, Math.PI, 0); c.fill();
    c.fillStyle = '#c86a4a'; c.fillRect(W * 0.18, H * 0.62, W * 0.24, H * 0.12);
    txt(c, 'ŠUNKU, SALÁMU A PÁRKY ZIPSER', W * 0.7, H * 0.2, W * 0.52, H * 0.09, '#ffffff', 'Arial', '900');
    txt(c, 'KÚPTE V NAŠICH TRHOCH', W * 0.7, H * 0.34, W * 0.5, H * 0.08, '#ffffff', 'Arial', '700');
    c.fillStyle = '#ffffff'; c.beginPath(); c.ellipse(W * 0.78, H * 0.68, W * 0.13, H * 0.17, 0, 0, Math.PI * 2); c.fill();
    txt(c, 'ZIPSER', W * 0.78, H * 0.68, W * 0.2, H * 0.12, '#1f3f95', 'Georgia', '900', 'italic');
  },
  civic(c, W, H, a = []) { // municipal campaign poster: navy, portrait silhouette, slogan
    const [bg = '#152a4e', acc = '#f2c230', slogan = 'VOĽBY 2022', tc = '#ffffff'] = a;
    fill(c, bg, W, H);
    person(c, W * 0.78, H * 0.12, H * 0.62, '#e4b995', '#2b2f38');
    txt(c, slogan, W * 0.36, H * 0.46, W * 0.58, H * 0.2, tc, 'Arial', '900');
    c.fillStyle = acc; c.fillRect(W * 0.08, H * 0.62, W * 0.52, H * 0.04);
    txt(c, 'Choďte voliť · 29. 10. 2022', W * 0.36, H * 0.78, W * 0.5, H * 0.08, tc, 'Arial', '700');
  },
  nayPylon(c, W, H) { fill(c, '#f6f7f8', W, H); c.save(); c.translate(W * 0.06, H * 0.2); PRESETS.nayMark(c, W * 0.88, H * 0.6); c.restore(); },
  nayMark(c, W, H) { // NAY roundel + letters on an existing background
    const r = H * 0.38; c.strokeStyle = '#1d4fb6'; c.lineWidth = H * 0.1; c.beginPath(); c.arc(r + H * 0.08, H / 2, r, 0, Math.PI * 2); c.stroke();
    c.fillStyle = '#1d4fb6'; c.beginPath(); c.moveTo(r * 0.75 + H * 0.08, H * 0.32); c.lineTo(r * 1.45 + H * 0.08, H / 2); c.lineTo(r * 0.75 + H * 0.08, H * 0.68); c.closePath(); c.fill();
    txt(c, 'NAY', W * 0.62, H * 0.55, W * 0.6, H * 0.95, '#1d4fb6', 'Arial Black', '900');
  },
  maxFace(c, W, H) { fill(c, '#f6f7f8', W, H); c.save(); c.translate(W * 0.1, H * 0.12); PRESETS.max(c, W * 0.8, H * 0.76, true); c.restore(); },
  tescoFace(c, W, H) { PRESETS.tesco(c, W, H); },
  kauflandInfo(c, W, H) { // opening hours and car-park rules under the totem sign
    fill(c, '#f2f2f0', W, H); c.fillStyle = '#e3001b'; c.fillRect(0, 0, W, H * 0.16);
    txt(c, 'PO – SO 7:00 – 21:00', W / 2, H * 0.34, W * 0.9, H * 0.12, '#2a2a2a', 'Arial', '700');
    txt(c, 'NE 8:00 – 20:00', W / 2, H * 0.52, W * 0.8, H * 0.12, '#2a2a2a', 'Arial', '700');
    c.fillStyle = '#1f5fb8'; c.fillRect(W * 0.08, H * 0.66, H * 0.22, H * 0.22); txt(c, 'P', W * 0.08 + H * 0.11, H * 0.77, H * 0.2, H * 0.18, '#ffffff', 'Arial', '900');
    txt(c, 'max. 2 h', W * 0.62, H * 0.77, W * 0.5, H * 0.1, '#2a2a2a', 'Arial', '700');
  },
  bbBack(c, W, H) { fill(c, '#3b4a3e', W, H); c.strokeStyle = '#2c372e'; c.lineWidth = Math.max(2, H * 0.02); for (let i = 1; i < 4; i++) { c.beginPath(); c.moveTo(0, H * i / 4); c.lineTo(W, H * i / 4); c.stroke(); } },
  // ---- Námestie slobody: architectural details drawn as cut-out textures
  clockFace(c, W, H) { // white dial, black Roman ticks and hands, dark rim
    c.clearRect(0, 0, W, H); const r = Math.min(W, H) / 2 - 1;
    c.fillStyle = '#26221e'; c.beginPath(); c.arc(W / 2, H / 2, r, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#f2efe6'; c.beginPath(); c.arc(W / 2, H / 2, r * 0.9, 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#1b1a18'; c.lineCap = 'round';
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; c.lineWidth = r * (i % 3 ? 0.04 : 0.08); c.beginPath(); c.moveTo(W / 2 + Math.cos(a) * r * 0.66, H / 2 + Math.sin(a) * r * 0.66); c.lineTo(W / 2 + Math.cos(a) * r * 0.82, H / 2 + Math.sin(a) * r * 0.82); c.stroke(); }
    c.lineWidth = r * 0.07; c.beginPath(); c.moveTo(W / 2, H / 2); c.lineTo(W / 2 + r * 0.35, H / 2 - r * 0.25); c.stroke();
    c.lineWidth = r * 0.045; c.beginPath(); c.moveTo(W / 2, H / 2); c.lineTo(W / 2 - r * 0.1, H / 2 - r * 0.62); c.stroke();
  },
  darkArch(c, W, H) { c.clearRect(0, 0, W, H); c.fillStyle = '#1e1b18'; c.beginPath(); c.moveTo(0, H); c.lineTo(0, W / 2); c.arc(W / 2, W / 2, W / 2, Math.PI, 0); c.lineTo(W, H); c.fill(); },
  narrowArch(c, W, H) { c.clearRect(0, 0, W, H); c.fillStyle = '#c9bfa8'; c.beginPath(); c.moveTo(0, H); c.lineTo(0, W / 2); c.arc(W / 2, W / 2, W / 2, Math.PI, 0); c.lineTo(W, H); c.fill(); c.fillStyle = '#2b2622'; c.beginPath(); c.moveTo(W * 0.2, H * 0.95); c.lineTo(W * 0.2, W * 0.5); c.arc(W / 2, W * 0.5, W * 0.3, Math.PI, 0); c.lineTo(W * 0.8, H * 0.95); c.fill(); },
  oculus(c, W, H) { c.clearRect(0, 0, W, H); c.fillStyle = '#c4b99f'; c.beginPath(); c.ellipse(W / 2, H / 2, W / 2, H / 2, 0, 0, Math.PI * 2); c.fill(); c.fillStyle = '#272320'; c.beginPath(); c.ellipse(W / 2, H / 2, W * 0.36, H * 0.33, 0, 0, Math.PI * 2); c.fill(); c.strokeStyle = '#6d6a62'; c.lineWidth = W * 0.02; c.beginPath(); c.moveTo(W * 0.15, H / 2); c.lineTo(W * 0.85, H / 2); c.stroke(); },
  karnerDoor(c, W, H) { c.clearRect(0, 0, W, H); c.fillStyle = '#c9bea4'; c.beginPath(); c.moveTo(0, H); c.lineTo(0, W * 0.5); c.arc(W / 2, W * 0.5, W / 2, Math.PI, 0); c.lineTo(W, H); c.fill(); c.fillStyle = '#4d3526'; c.beginPath(); c.moveTo(W * 0.2, H); c.lineTo(W * 0.2, W * 0.55); c.arc(W / 2, W * 0.55, W * 0.3, Math.PI, 0); c.lineTo(W * 0.8, H); c.fill(); c.strokeStyle = '#2e2018'; c.lineWidth = W * 0.02; c.beginPath(); c.moveTo(W / 2, W * 0.3); c.lineTo(W / 2, H); c.stroke(); },
  towerPair(c, W, H) { c.clearRect(0, 0, W, H); for (const x of [0.28, 0.72]) { const w = W * 0.2, x0 = W * x - w / 2; c.fillStyle = '#c4b595'; c.fillRect(x0 - w * 0.2, H * 0.1, w * 1.4, H * 0.85); c.fillStyle = '#1c1a17'; c.beginPath(); c.moveTo(x0, H * 0.9); c.lineTo(x0, H * 0.1 + w / 2); c.arc(x0 + w / 2, H * 0.1 + w / 2, w / 2, Math.PI, 0); c.lineTo(x0 + w, H * 0.9); c.fill(); } },
  corbelFrieze(c, W, H) { // Lombard band: row of small round arches on corbels
    c.fillStyle = '#d8cbac'; c.fillRect(0, 0, W, H); const n = Math.max(6, Math.round(W / (H * 0.55))), aw = W / n;
    c.fillStyle = 'rgba(70,58,40,0.45)'; for (let i = 0; i < n; i++) { c.beginPath(); c.moveTo(i * aw + aw * 0.12, H * 0.8); c.lineTo(i * aw + aw * 0.12, H * 0.45); c.arc(i * aw + aw / 2, H * 0.45, aw * 0.38, Math.PI, 0); c.lineTo(i * aw + aw * 0.88, H * 0.8); c.fill(); }
    c.fillStyle = '#c3b391'; c.fillRect(0, H * 0.8, W, H * 0.2); c.fillRect(0, 0, W, H * 0.08);
  },
  towerGallery(c, W, H) { // gallery storey: four arched openings above a balustrade band
    c.fillStyle = '#dccfb1'; c.fillRect(0, 0, W, H); const n = 4, aw = W / n;
    for (let i = 0; i < n; i++) { const x0 = i * aw + aw * 0.2, w = aw * 0.6; c.fillStyle = '#c9ba98'; c.fillRect(x0 - w * 0.12, H * 0.14, w * 1.24, H * 0.72); c.fillStyle = '#1d1b18'; c.beginPath(); c.moveTo(x0, H * 0.72); c.lineTo(x0, H * 0.2 + w / 2); c.arc(x0 + w / 2, H * 0.2 + w / 2, w / 2, Math.PI, 0); c.lineTo(x0 + w, H * 0.72); c.fill(); }
    c.fillStyle = '#cbbd9c'; c.fillRect(0, H * 0.7, W, H * 0.3); c.fillStyle = 'rgba(60,50,35,0.35)'; for (let x = 0; x < W; x += H * 0.08) c.fillRect(x, H * 0.76, H * 0.035, H * 0.18);
  },
  cartouche(c, W, H) { c.clearRect(0, 0, W, H); c.fillStyle = '#d7d0bf'; c.beginPath(); c.ellipse(W / 2, H / 2, W * 0.45, H * 0.45, 0, 0, Math.PI * 2); c.fill(); c.strokeStyle = '#a79f8c'; c.lineWidth = W * 0.05; c.stroke(); c.fillStyle = '#bdb5a2'; c.beginPath(); c.ellipse(W / 2, H / 2, W * 0.28, H * 0.3, 0, 0, Math.PI * 2); c.fill(); },
  corpus(c, W, H) { c.clearRect(0, 0, W, H); c.fillStyle = '#d9d3c6'; c.fillRect(W * 0.46, H * 0.2, W * 0.08, H * 0.55); c.fillRect(W * 0.12, H * 0.22, W * 0.76, H * 0.05); c.beginPath(); c.arc(W / 2, H * 0.14, W * 0.06, 0, Math.PI * 2); c.fill(); },
  brandStrip(c, W, H, a = 'Coca-Cola') { fill(c, '#f4f3ee', W, H); txt(c, a, W / 2, H / 2, W * 0.8, H * 0.8, '#c8102e', 'Georgia', '700', 'italic'); },
  // baroque volute gable (cut-out): arg [wall, trim, clock?, oculus?]
  volGable(c, W, H, a = []) {
    const [wall = '#c8dfc8', trim = '#f4f2ea', clock = false, ocu = false] = a; c.clearRect(0, 0, W, H);
    const path = () => { c.beginPath(); c.moveTo(0, H); c.bezierCurveTo(W * 0.02, H * 0.55, W * 0.22, H * 0.72, W * 0.26, H * 0.5); c.lineTo(W * 0.3, H * 0.28); c.bezierCurveTo(W * 0.34, H * 0.12, W * 0.42, H * 0.1, W * 0.46, H * 0.06); c.lineTo(W * 0.5, 0); c.lineTo(W * 0.54, H * 0.06); c.bezierCurveTo(W * 0.58, H * 0.1, W * 0.66, H * 0.12, W * 0.7, H * 0.28); c.lineTo(W * 0.74, H * 0.5); c.bezierCurveTo(W * 0.78, H * 0.72, W * 0.98, H * 0.55, W, H); c.closePath(); };
    path(); c.fillStyle = wall; c.fill(); c.lineWidth = Math.max(3, W * 0.025); c.strokeStyle = trim; c.stroke();
    c.fillStyle = trim; c.fillRect(W * 0.28, H * 0.47, W * 0.44, H * 0.04); c.fillRect(0, H * 0.94, W, H * 0.06);
    for (const x of [0.31, 0.66]) c.fillRect(W * x, H * 0.52, W * 0.03, H * 0.42);
    if (clock) { const r = H * 0.13; c.fillStyle = '#2a2622'; c.beginPath(); c.arc(W / 2, H * 0.3, r, 0, Math.PI * 2); c.fill(); c.fillStyle = '#f2efe6'; c.beginPath(); c.arc(W / 2, H * 0.3, r * 0.86, 0, Math.PI * 2); c.fill(); c.strokeStyle = '#1b1a18'; c.lineWidth = r * 0.12; c.beginPath(); c.moveTo(W / 2, H * 0.3); c.lineTo(W / 2 + r * 0.45, H * 0.3 - r * 0.3); c.moveTo(W / 2, H * 0.3); c.lineTo(W / 2, H * 0.3 - r * 0.7); c.stroke(); }
    if (ocu) { c.fillStyle = '#2b2724'; c.beginPath(); c.ellipse(W / 2, H * 0.7, W * 0.07, H * 0.09, 0, 0, Math.PI * 2); c.fill(); }
    else if (!clock) { c.fillStyle = '#2b2724'; c.fillRect(W * 0.44, H * 0.6, W * 0.12, H * 0.28); }
  },
  pediment(c, W, H, a = []) { // triangular pediment with a coat of arms (cut-out)
    const [wall = '#eeeeea', trim = '#c8c9c6'] = a; c.clearRect(0, 0, W, H);
    c.beginPath(); c.moveTo(0, H); c.lineTo(W / 2, 0); c.lineTo(W, H); c.closePath(); c.fillStyle = wall; c.fill(); c.lineWidth = Math.max(3, H * 0.07); c.strokeStyle = trim; c.stroke();
    c.fillStyle = '#b9b8b0'; c.beginPath(); c.ellipse(W / 2, H * 0.6, W * 0.06, H * 0.22, 0, 0, Math.PI * 2); c.fill();
  },
  portalBaroque(c, W, H) { // church west portal: coupled columns, entablature, broken pediment, arched door
    c.clearRect(0, 0, W, H); const st = '#d9cdb2', sh = '#b8aa8c';
    c.fillStyle = st; c.fillRect(W * 0.08, H * 0.32, W * 0.84, H * 0.68);
    c.beginPath(); c.moveTo(W * 0.02, H * 0.34); c.lineTo(W / 2, H * 0.02); c.lineTo(W * 0.98, H * 0.34); c.closePath(); c.fill(); c.strokeStyle = sh; c.lineWidth = W * 0.02; c.stroke();
    c.fillStyle = sh; c.fillRect(W * 0.04, H * 0.32, W * 0.92, H * 0.05);
    for (const x of [0.12, 0.22, 0.72, 0.82]) { c.fillStyle = '#e7dcc3'; c.fillRect(W * x, H * 0.37, W * 0.07, H * 0.63); c.fillStyle = sh; c.fillRect(W * x - W * 0.01, H * 0.37, W * 0.09, H * 0.03); c.fillRect(W * x - W * 0.01, H * 0.96, W * 0.09, H * 0.04); }
    c.fillStyle = '#2c3a58'; c.beginPath(); c.moveTo(W * 0.33, H); c.lineTo(W * 0.33, H * 0.62); c.arc(W / 2, H * 0.62, W * 0.17, Math.PI, 0); c.lineTo(W * 0.67, H); c.fill();
    c.fillStyle = '#4a3325'; c.beginPath(); c.moveTo(W * 0.36, H); c.lineTo(W * 0.36, H * 0.64); c.arc(W / 2, H * 0.64, W * 0.14, Math.PI, 0); c.lineTo(W * 0.64, H); c.fill();
    c.fillStyle = '#2b2724'; c.beginPath(); c.ellipse(W / 2, H * 0.2, W * 0.05, H * 0.06, 0, 0, Math.PI * 2); c.fill();
  },
  gothicPortal(c, W, H) { c.clearRect(0, 0, W, H); c.fillStyle = '#c7b894'; c.beginPath(); c.moveTo(0, H); c.lineTo(0, H * 0.45); c.quadraticCurveTo(0, 0, W / 2, 0); c.quadraticCurveTo(W, 0, W, H * 0.45); c.lineTo(W, H); c.fill(); c.fillStyle = '#4b3324'; c.beginPath(); c.moveTo(W * 0.18, H); c.lineTo(W * 0.18, H * 0.5); c.quadraticCurveTo(W * 0.18, H * 0.14, W / 2, H * 0.14); c.quadraticCurveTo(W * 0.82, H * 0.14, W * 0.82, H * 0.5); c.lineTo(W * 0.82, H); c.fill(); },
  flowers(c, W, H) { // window box with red geraniums
    c.clearRect(0, 0, W, H); c.fillStyle = '#5b3c28'; c.fillRect(0, H * 0.62, W, H * 0.38);
    for (let i = 0; i < W / (H * 0.18); i++) { const x = (i + 0.5) * H * 0.18, y = H * (0.35 + 0.15 * Math.sin(i * 2.3)); c.fillStyle = '#3f6b2a'; c.beginPath(); c.arc(x, y + H * 0.12, H * 0.16, 0, Math.PI * 2); c.fill(); c.fillStyle = i % 3 ? '#d42a2a' : '#e8424f'; c.beginPath(); c.arc(x + H * 0.03, y, H * 0.11, 0, Math.PI * 2); c.fill(); }
  },
  hangBasket(c, W, H) { c.clearRect(0, 0, W, H); for (let i = 0; i < 26; i++) { const a = i * 2.4, r = W * 0.4 * Math.sqrt(i / 26); c.fillStyle = i % 4 ? '#e0405a' : '#3f6b2a'; c.beginPath(); c.arc(W / 2 + Math.cos(a) * r, H * 0.45 + Math.sin(a) * r * 0.9, W * 0.09, 0, Math.PI * 2); c.fill(); } },
  letters(c, W, H, a = []) { // free-standing letters (cut-out): [text, colour, font, style]
    const [t = 'HOTEL', colr = '#6b5a2e', font = 'Georgia', style = ''] = a; c.clearRect(0, 0, W, H); txt(c, t, W / 2, H * 0.55, W * 0.98, H * 0.92, colr, font, '700', style);
  },
  board(c, W, H, a = []) { // shop board: [bg, fg, text, sub, font]
    const [bg = '#1b1b1b', fg = '#ffffff', t = '', sub = '', font = 'Arial'] = a; fill(c, bg, W, H);
    txt(c, t, W / 2, sub ? H * 0.4 : H * 0.54, W * 0.9, H * (sub ? 0.5 : 0.7), fg, font, '700'); if (sub) txt(c, sub, W / 2, H * 0.8, W * 0.9, H * 0.22, fg, 'Arial', '400');
  },
  tatraBanka(c, W, H) { fill(c, '#1d1d1d', W, H); c.fillStyle = '#8a8a8a'; c.fillRect(0, 0, W, H * 0.06); txt(c, 'TATRA BANKA', W / 2, H * 0.55, W * 0.9, H * 0.6, '#ffffff', 'Arial', '700'); },
  sporitelna(c, W, H) { c.clearRect(0, 0, W, H); c.fillStyle = '#e30613'; c.fillRect(0, H * 0.15, H * 0.7, H * 0.7); txt(c, 'SLOVENSKÁ SPORITEĽŇA', W * 0.56, H * 0.52, W * 0.8, H * 0.55, '#12367f', 'Arial', '900'); },
  primaBanka(c, W, H) { c.clearRect(0, 0, W, H); txt(c, 'Prima banka', W * 0.45, H * 0.55, W * 0.8, H * 0.7, '#2a2a2a', 'Arial', '700'); c.fillStyle = '#20a04a'; c.fillRect(W * 0.9, H * 0.25, H * 0.5, H * 0.5); },
  jurkovicBand(c, W, H) { // folk-painted fascia and bracket heads of the Spolkový dom eaves (Jurkovič)
    fill(c, '#5a2e1c', W, H); const n = Math.round(W / (H * 1.1)), sw = W / n;
    for (let i = 0; i < n; i++) {
      const x = i * sw; c.fillStyle = '#d64a1e'; c.beginPath(); c.moveTo(x + sw * 0.1, H * 0.15); c.lineTo(x + sw * 0.5, H * 0.85); c.lineTo(x + sw * 0.9, H * 0.15); c.fill();
      c.fillStyle = '#f2b233'; c.beginPath(); c.arc(x + sw * 0.5, H * 0.35, H * 0.14, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#2f7a4a'; c.fillRect(x + sw * 0.46, H * 0.55, sw * 0.08, H * 0.3);
    }
    c.fillStyle = '#e9dcb4'; c.fillRect(0, 0, W, H * 0.07); c.fillRect(0, H * 0.93, W, H * 0.07);
  },
  // Spolkový dom / Dom kultúry (Jurkovič 1905): whole street front painted as one texture (W x H = 18.4 x 7.9 m)
  kdFacade(c, W, H) {
    const m = W / 18.4, Y = (v) => H - v * m, R = (s0, v0, s1, v1, col) => { c.fillStyle = col; c.fillRect(s0 * m, Y(v1), (s1 - s0) * m, (v1 - v0) * m); };
    fill(c, '#f3efe4', W, H);
    R(0, 0, 18.4, 0.95, '#2d6b4c'); c.fillStyle = 'rgba(255,255,255,0.18)'; for (let s = 0.3; s < 18.4; s += 0.3) c.fillRect(s * m, Y(0.95), 1, 0.95 * m); // glazed plinth tiles
    const folk = (s0, v0, s1, v1) => { // painted folk border: red tulips, blue and yellow dots on a green stem line
      c.strokeStyle = '#2f7a4a'; c.lineWidth = Math.max(1, m * 0.05); c.strokeRect(s0 * m, Y(v1), (s1 - s0) * m, (v1 - v0) * m);
      const n = Math.max(3, Math.round((s1 - s0) / 0.35));
      for (let i = 0; i <= n; i++) { const x = (s0 + (s1 - s0) * i / n) * m; c.fillStyle = ['#c8392b', '#2b5f9c', '#e0a52a'][i % 3]; c.beginPath(); c.arc(x, Y(v1) - m * 0.08, m * 0.07, 0, Math.PI * 2); c.fill(); }
      c.fillStyle = '#c8392b'; for (const x of [s0, s1]) { c.beginPath(); c.moveTo(x * m, Y(v1) - m * 0.35); c.lineTo(x * m - m * 0.14, Y(v1) - m * 0.05); c.lineTo(x * m + m * 0.14, Y(v1) - m * 0.05); c.fill(); }
    };
    const win = (s0, v0, s1, v1) => { // brown frame, dark glass with glazing bars, painted surround
      R(s0 - 0.18, v0 - 0.15, s1 + 0.18, v1 + 0.18, '#ffffff'); folk(s0 - 0.18, v0 - 0.15, s1 + 0.18, v1 + 0.18);
      R(s0, v0, s1, v1, '#5a3a24'); R(s0 + 0.08, v0 + 0.08, s1 - 0.08, v1 - 0.08, '#27313a');
      c.fillStyle = '#5a3a24'; c.fillRect(((s0 + s1) / 2) * m - m * 0.03, Y(v1), m * 0.06, (v1 - v0) * m); c.fillRect(s0 * m, Y(v0 + (v1 - v0) * 0.66), (s1 - s0) * m, m * 0.05);
    };
    for (const s of [1.3, 4.1, 6.6]) { win(s, 1.35, s + 1.2, 3.05); win(s, 4.9, s + 1.2, 6.8); }
    win(16.2, 1.35, 17.4, 3.05); win(16.2, 4.9, 17.4, 6.8);
    for (const s of [8.7, 11.0, 13.3]) { // three light blue double doors with glazed tops in white stone frames, on two steps
      R(s - 0.2, 0.3, s + 1.8, 3.4, '#ffffff'); R(s, 0.3, s + 1.6, 3.2, '#7fa7cf'); R(s + 0.12, 2.0, s + 0.74, 3.05, '#dbe7ef'); R(s + 0.86, 2.0, s + 1.48, 3.05, '#dbe7ef');
      c.fillStyle = '#56789a'; c.fillRect((s + 0.79) * m, Y(3.2), m * 0.03, 2.9 * m); R(s + 0.12, 0.45, s + 0.74, 1.85, '#6a92bb'); R(s + 0.86, 0.45, s + 1.48, 1.85, '#6a92bb');
    }
    R(8.1, 0, 15.5, 0.3, '#c9c4b8');
    // "Dom kultúry" in a painted cartouche above the doors
    R(8.4, 3.55, 15.2, 4.45, '#f8f3e6'); folk(8.4, 3.55, 15.2, 4.45);
    txt(c, 'Dom kultúry', 11.8 * m, Y(3.98), 5.8 * m, 0.62 * m, '#2d6b4c', 'Georgia', '700', 'italic');
    for (const s of [9.0, 11.2, 13.4]) win(s, 4.95, s + 1.2, 6.85);
    for (const s of [10.25, 12.45]) { // painted figure panels between the upper windows (saints in folk costume)
      R(s + 0.02, 4.95, s + 0.9, 6.85, '#e8d9b0'); c.strokeStyle = '#8a3a22'; c.lineWidth = Math.max(1, m * 0.04); c.strokeRect((s + 0.02) * m, Y(6.85), 0.88 * m, 1.9 * m);
      person(c, (s + 0.46) * m, Y(6.55), 0.7 * m, '#e2b48c', s < 11 ? '#c8392b' : '#2b5f9c');
    }
    // folk frieze under the eaves
    R(0, 7.25, 18.4, 7.9, '#f7f2e4');
    const n = Math.round(18.4 / 0.55); for (let i = 0; i < n; i++) { const x = (i + 0.5) * 18.4 / n * m; c.fillStyle = '#2f7a4a'; c.fillRect(x - m * 0.02, Y(7.75), m * 0.04, m * 0.4); c.fillStyle = i % 2 ? '#c8392b' : '#2b5f9c'; c.beginPath(); c.arc(x, Y(7.7), m * 0.12, 0, Math.PI * 2); c.fill(); c.fillStyle = '#e0a52a'; c.beginPath(); c.arc(x, Y(7.7), m * 0.05, 0, Math.PI * 2); c.fill(); }
  },
  // front gable of the Spolkový dom: glass mosaic on a gold ground framed by carved boards (cut-out triangle)
  kdMosaic(c, W, H) {
    c.clearRect(0, 0, W, H); c.save(); c.beginPath(); c.moveTo(0, H); c.lineTo(W / 2, 0); c.lineTo(W, H); c.closePath(); c.clip();
    grad(c, W, H, '#d9b24a', '#b88a2a', true);
    const tess = Math.max(3, W / 90); c.fillStyle = 'rgba(0,0,0,0.08)'; for (let x = 0; x < W; x += tess) c.fillRect(x, 0, 1, H); for (let y = 0; y < H; y += tess) c.fillRect(0, y, W, 1);
    c.fillStyle = '#2b4f8c'; c.beginPath(); c.arc(W / 2, H * 0.62, H * 0.3, Math.PI, 0); c.fill();                  // blue arch behind the figures
    const figs = [[0.3, '#c8392b'], [0.42, '#f1e6c8'], [0.5, '#2f7a4a'], [0.58, '#f1e6c8'], [0.7, '#c8392b']];
    for (const [x, col] of figs) person(c, W * x, H * 0.46, H * 0.22, '#e2b48c', col);
    c.fillStyle = '#2f7a4a'; for (let i = 0; i < 9; i++) { const x = W * (0.1 + i * 0.1); c.beginPath(); c.ellipse(x, H * 0.93, W * 0.03, H * 0.05, 0.5, 0, Math.PI * 2); c.fill(); }
    c.fillStyle = '#c8392b'; for (let i = 0; i < 9; i++) { c.beginPath(); c.arc(W * (0.1 + i * 0.1), H * 0.87, W * 0.015, 0, Math.PI * 2); c.fill(); }
    c.restore(); c.strokeStyle = '#5a2e1c'; c.lineWidth = W * 0.035; c.beginPath(); c.moveTo(0, H); c.lineTo(W / 2, 0); c.lineTo(W, H); c.stroke();
  },
  kdGable(c, W, H) { // painted timber gable with a floral mosaic field (Spolkový dom balcony wing)
    c.clearRect(0, 0, W, H); c.beginPath(); c.moveTo(0, H); c.lineTo(W / 2, 0); c.lineTo(W, H); c.closePath(); c.fillStyle = '#e9dcb4'; c.fill();
    c.save(); c.clip(); const cols = ['#c8392b', '#e0a52a', '#2f7a4a', '#2b5f8c'];
    for (let i = 0; i < 40; i++) { const x = W * (0.2 + 0.6 * ((i * 37) % 40) / 40), y = H * (0.35 + 0.55 * ((i * 17) % 40) / 40); c.fillStyle = cols[i % 4]; c.beginPath(); c.arc(x, y, W * 0.025, 0, Math.PI * 2); c.fill(); }
    c.restore(); c.strokeStyle = '#5a2e1c'; c.lineWidth = W * 0.04; c.beginPath(); c.moveTo(0, H); c.lineTo(W / 2, 0); c.lineTo(W, H); c.stroke();
  },
  balustrade(c, W, H, a = ['#ecd9c4']) { // parapet balustrade (cut-out)
    c.clearRect(0, 0, W, H); const col = a[0]; c.fillStyle = col; c.fillRect(0, 0, W, H * 0.18); c.fillRect(0, H * 0.84, W, H * 0.16);
    const n = Math.round(W / (H * 0.32)); for (let i = 0; i < n; i++) { const x = (i + 0.5) * W / n; c.beginPath(); c.ellipse(x, H * 0.5, H * 0.08, H * 0.3, 0, 0, Math.PI * 2); c.fill(); }
    for (let x = 0; x < W; x += W / Math.max(1, Math.round(W / (H * 3)))) c.fillRect(x, 0, H * 0.25, H);
  },
  stucco(c, W, H, a = ['#f0ead8']) { // Art Nouveau relief panel between windows: framed field with a hanging garland (cut-out, light)
    c.clearRect(0, 0, W, H); const col = a[0]; c.fillStyle = col; c.globalAlpha = 0.9;
    c.fillRect(W * 0.08, H * 0.08, W * 0.84, H * 0.84); c.globalAlpha = 1;
    c.strokeStyle = 'rgba(90,80,60,0.35)'; c.lineWidth = Math.max(1, H * 0.035); c.strokeRect(W * 0.14, H * 0.16, W * 0.72, H * 0.68);
    c.strokeStyle = 'rgba(90,80,60,0.45)'; c.beginPath(); c.moveTo(W * 0.2, H * 0.3); c.quadraticCurveTo(W * 0.5, H * 0.75, W * 0.8, H * 0.3); c.stroke();
    c.fillStyle = 'rgba(90,80,60,0.4)'; for (const x of [0.2, 0.8]) { c.beginPath(); c.arc(W * x, H * 0.3, H * 0.06, 0, Math.PI * 2); c.fill(); }
  },
  nayKlub(c, W, H) { grad(c, W, H, '#dff1fb', '#8fc9ea'); person(c, W * 0.22, H * 0.12, H * 0.42, '#e8bb97', '#1d4fb6'); txt(c, 'NAY EXTRA', W * 0.66, H * 0.26, W * 0.56, H * 0.14, '#1d4fb6', 'Arial', '900'); txt(c, 'KLUB %', W * 0.66, H * 0.52, W * 0.5, H * 0.3, '#d42a8a', 'Arial Black', '900'); c.fillStyle = '#1d4fb6'; c.fillRect(0, H * 0.84, W, H * 0.16); txt(c, 'NAY', W / 2, H * 0.92, W * 0.3, H * 0.12, '#ffffff', 'Arial', '900'); },
  nayFoto(c, W, H) { grad(c, W, H, '#f7f7f7', '#d6e8f7'); person(c, W * 0.25, H * 0.14, H * 0.42, '#e8bb97', '#e05aa0'); txt(c, 'FOTO', W * 0.68, H * 0.32, W * 0.5, H * 0.24, '#1d4fb6', 'Arial Black', '900'); txt(c, 'SLUŽBY', W * 0.68, H * 0.58, W * 0.5, H * 0.18, '#1d4fb6', 'Arial', '900'); c.fillStyle = '#1d4fb6'; c.fillRect(0, H * 0.84, W, H * 0.16); txt(c, 'NAY', W / 2, H * 0.92, W * 0.3, H * 0.12, '#ffffff', 'Arial', '900'); },
};

export function buildSigns(scene) {
  if (!SIGNS.list.length) return;
  // shelf-pack the atlas
  const ATW = 2048; let x = 2, y = 2, rowH = 0; const items = [];
  for (const s of SIGNS.list) {
    let W = s.w * PPM, H = s.h * PPM; const k = Math.min(1, 900 / W, 360 / H); W = Math.max(8, Math.round(W * k)); H = Math.max(8, Math.round(H * k));
    if (x + W + 2 > ATW) { x = 2; y += rowH + 4; rowH = 0; }
    items.push({ s, x, y, W, H }); x += W + 4; rowH = Math.max(rowH, H);
  }
  let ATH = 64; while (ATH < y + rowH + 2) ATH *= 2;
  const cv = document.createElement('canvas'); cv.width = ATW; cv.height = ATH;
  const ctx = cv.getContext('2d');
  for (const it of items) {
    ctx.save(); ctx.translate(it.x, it.y); ctx.beginPath(); ctx.rect(0, 0, it.W, it.H); ctx.clip();
    const f = PRESETS[it.s.preset] || PRESETS.ad; f(ctx, it.W, it.H, it.s.arg); ctx.restore();
  }
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  // quads, one mesh per (glowing, cut-out) combination
  const groups = {};
  for (const it of items) {
    const s = it.s, key = `${s.glow ? 1 : 0}${s.cut ? 1 : 0}`, g = groups[key] || (groups[key] = { pos: [], nor: [], uv: [], idx: [], glow: s.glow ? 1.1 : 0, cut: !!s.cut });
    const [cx, cy, cz] = s.c, n = s.n, r = [n[1], -n[0]];            // right-hand direction for a viewer facing the sign
    const hw = s.w / 2, hh = s.h / 2, base = g.pos.length / 3;
    const P = [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]];
    const u0 = it.x / ATW, u1 = (it.x + it.W) / ATW, v0 = 1 - (it.y + it.H) / ATH, v1 = 1 - it.y / ATH, UV = [[u0, v0], [u1, v0], [u1, v1], [u0, v1]];
    for (let i = 0; i < 4; i++) { g.pos.push(cx + r[0] * P[i][0], cy + P[i][1], cz + r[1] * P[i][0]); g.nor.push(n[0], 0, n[1]); g.uv.push(UV[i][0], UV[i][1]); }
    g.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  for (const key in groups) {
    const g = groups[key], geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(g.pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(g.nor, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(g.uv, 2));
    geo.setIndex(g.idx); geo.computeBoundingSphere();
    const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5, metalness: 0.0, alphaTest: g.cut ? 0.5 : 0,
      emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    mat.userData.glow = g.glow; SIGNS.mats.push(mat);
    const mesh = new THREE.Mesh(geo, mat); mesh.receiveShadow = true; mesh.frustumCulled = true; mesh.name = 'signs' + key;
    scene.add(mesh);
  }
}
