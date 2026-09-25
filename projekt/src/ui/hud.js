// HUD: minimap with street names, full map with waypoint / teleport, speedometer, clock, location popup.
import { S } from '../core/state.js';
import { clamp, segDist, pip } from '../core/util.js';
import { CITY } from '../world/city.js';
import { GAME } from '../game/game.js';
import { AUDIO } from '../core/audio.js';

const $ = (id) => document.getElementById(id);
export const HUD = { mapOpen: false, waypoint: null, zoom: 1, pan: [0, 0], lastStreet: '', lastPlace: '' };
const MAPC = {
  land: '#2a2f33', res: '#2d3236', park: '#2c4430', forest: '#253b29', field: '#34392e', vine: '#353b2c', water: '#2b5a86',
  ind: '#33363b', retail: '#35373c', plaza: '#4a4d52', parking: '#3a3d42', bld: '#454b52', bldOld: '#57524a',
  r1: '#e9e6df', r2: '#c7c9cc', r3: '#9fa3a8', r4: '#8a8e93', path: '#6c7176', rail: '#5b5f64',
};
const AREA_FILL = { forest: 'forest', scrub: 'park', park: 'park', grass: 'park', golf: 'park', cemetery: 'park', pitch: 'park', sports: 'park', playground: 'park',
  farmland: 'field', orchard: 'field', allotments: 'field', vineyard: 'vine', wetland: 'park', water: 'water', pool: 'water', industrial: 'ind', retail: 'retail',
  plaza: 'plaza', parking: 'parking', residential: 'res', farmyard: 'field', campus: 'res', track: 'park' };

HUD.init = function () {
  const [X0, Z0, X1, Z1] = CITY.bounds;
  const SZ = S.mobile ? 2048 : 4096;
  const cv = document.createElement('canvas'); cv.width = cv.height = SZ;
  const g = cv.getContext('2d'), sx = SZ / (X1 - X0), sz = SZ / (Z1 - Z0);
  HUD.base = { cv, sx, sz, X0, Z0, SZ };
  const tx = (x) => (x - X0) * sx, tz = (z) => (z - Z0) * sz;
  g.fillStyle = MAPC.land; g.fillRect(0, 0, SZ, SZ);
  const ring = (p) => { p.forEach((v, i) => i ? g.lineTo(tx(v[0]), tz(v[1])) : g.moveTo(tx(v[0]), tz(v[1]))); g.closePath(); };
  const order = ['residential', 'farmland', 'vineyard', 'orchard', 'allotments', 'farmyard', 'campus', 'industrial', 'retail', 'grass', 'park', 'golf', 'scrub', 'wetland', 'cemetery', 'forest', 'sports', 'pitch', 'playground', 'parking', 'plaza', 'water', 'pool'];
  for (const k of order) for (const a of CITY.areas) if (a.kind === k) { g.beginPath(); ring(a.outer); a.holes.forEach(ring); g.fillStyle = MAPC[AREA_FILL[k]] || MAPC.land; g.fill('evenodd'); }
  g.lineCap = g.lineJoin = 'round';
  for (const l of CITY.lines) if (l.kind === 'water' || l.kind === 'rail') {
    g.strokeStyle = l.kind === 'water' ? MAPC.water : MAPC.rail; g.lineWidth = Math.max(1.5, (l.kind === 'water' ? l.w : 2.5) * sx);
    if (l.kind === 'rail') g.setLineDash([6, 4]); g.beginPath(); l.p.forEach((v, i) => i ? g.lineTo(tx(v[0]), tz(v[1])) : g.moveTo(tx(v[0]), tz(v[1]))); g.stroke(); g.setLineDash([]);
  }
  for (const bd of CITY.buildings) { g.beginPath(); ring(bd.p); g.fillStyle = bd.cat === 1 || bd.cat === 6 ? MAPC.bldOld : MAPC.bld; g.fill(); }
  const RW = { 1: [MAPC.r1, 1.25], 2: [MAPC.r2, 1.2], 3: [MAPC.r3, 1.1], 4: [MAPC.r4, 1.0], 5: [MAPC.r3, 1.0], 6: [MAPC.path, 0.9], 7: [MAPC.path, 0.9], 8: [MAPC.path, 0.8], 9: [MAPC.path, 0.9], 10: [MAPC.path, 0.9] };
  for (const pass of [6, 5, 4, 3, 2, 1]) for (const r of CITY.roads) {
    const k = r.k === 5 ? 3 : r.k; if (!RW[r.k] || (r.k <= 5 ? (k === pass ? false : true) : pass !== 6)) continue;
    g.strokeStyle = RW[r.k][0]; g.lineWidth = Math.max(r.k > 5 ? 1 : 2, r.w * RW[r.k][1] * sx);
    g.beginPath(); r.p.forEach((v, i) => i ? g.lineTo(tx(v[0]), tz(v[1])) : g.moveTo(tx(v[0]), tz(v[1]))); g.stroke();
  }
  // street label anchors: long named segments
  HUD.labels = [];
  const byName = new Map();
  for (const r of CITY.roads) if (r.n >= 0 && r.k <= 5) (byName.get(r.n) || byName.set(r.n, []).get(r.n)).push(r);
  for (const [n, rs] of byName) for (const r of rs) {
    let acc = 0;
    for (let i = 0; i < r.p.length - 1; i++) {
      const a = r.p[i], b = r.p[i + 1], Ln = Math.hypot(b[0] - a[0], b[1] - a[1]); acc += Ln;
      if (Ln > 28 || (acc > 70 && Ln > 14)) { acc = 0; HUD.labels.push({ n: CITY.names[n], x: (a[0] + b[0]) / 2, z: (a[1] + b[1]) / 2, ang: Math.atan2(b[1] - a[1], b[0] - a[0]), len: Ln, k: r.k }); }
    }
  }
  HUD.mm = $('minimap'); HUD.mmc = HUD.mm.getContext('2d');
  HUD.big = $('bigmap'); HUD.bigc = HUD.big.getContext('2d');
  HUD.bindBig();
  HUD.resize();
};
HUD.resize = function () {
  const dpr = Math.min(2, devicePixelRatio || 1), r = HUD.mm.getBoundingClientRect();
  HUD.mm.width = Math.round(r.width * dpr); HUD.mm.height = Math.round(r.height * dpr); HUD.dpr = dpr;
  if (HUD.mapOpen) { HUD.big.width = innerWidth * dpr; HUD.big.height = innerHeight * dpr; }
};

// nearest named street and place (for the popup)
HUD.streetAt = function (x, z) {
  const out = CITY.rgrid.query(x - 40, z - 40, x + 40, z + 40, []);
  let best = null, bd = 32;
  for (const s of out) { if (s.r.n < 0 || s.r.k > 5) continue; const d = segDist(x, z, s.ax, s.az, s.bx, s.bz) - s.r.w / 2; if (d < bd) { bd = d; best = s.r; } }
  return best ? CITY.names[best.n] : '';
};
HUD.placeAt = function (x, z) {
  let best = '', bd = 45;
  for (const p of HUD.notable || (HUD.notable = CITY.pois.filter(p => /Rotunda|Kostol|Kultúrny|Radnica|Ratúz|múzeum|Mariánsky|Kaufland|Tesco|Lidl|Billa|Max|Kalvária|Synag|nemocnica|Kaplnka|Mlyn|štadión|Štadión|kúpalisko|Kúpalisko|Námestie|Point|Slovnaft|OMV|Shell/i.test(p.n)))) {
    const d = Math.hypot(p.x - x, p.z - z); if (d < bd) { bd = d; best = p.n; }
  }
  return best;
};

HUD.update = function (dt) {
  const p = GAME.pos;
  $('clock').textContent = HUD.clock ? HUD.clock() : '';
  // speedometer
  const drive = GAME.mode === 'drive';
  $('speedo').hidden = !drive;
  if (drive) { $('spd').textContent = Math.round(GAME.speed * 3.6); $('gear').textContent = GAME.car.gear < 0 ? 'R' : (GAME.speed < 0.3 ? 'N' : GAME.car.gear); }
  // prompts
  const near = !drive && GAME.nearestCarDist() < 4.5;
  $('prompt').hidden = !near && !(drive && GAME.speed < 4);
  $('prompt').innerHTML = drive ? '<kbd>F</kbd> vystúpiť' : '<kbd>F</kbd> nastúpiť do auta';
  // location popup
  HUD._acc = (HUD._acc || 0) + dt;
  if (HUD._acc > 0.5) {
    HUD._acc = 0;
    const st = HUD.streetAt(p.x, p.z), pl = HUD.placeAt(p.x, p.z);
    if ((st && st !== HUD.lastStreet) || (pl && pl !== HUD.lastPlace)) {
      HUD.lastStreet = st || HUD.lastStreet; HUD.lastPlace = pl;
      $('loc-street').textContent = pl || st; $('loc-area').textContent = pl ? st : 'Skalica';
      const el = $('loc'); el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
    }
  }
  HUD.drawMini();
  if (HUD.mapOpen) HUD.drawBig();
};

// ------------------------------------------------------------------ minimap
HUD.drawMini = function () {
  const c = HUD.mmc, W = HUD.mm.width, H = HUD.mm.height, B = HUD.base, dpr = HUD.dpr;
  const drive = GAME.mode === 'drive';
  const mpp = (drive ? 1.2 + clamp(GAME.speed / 30, 0, 1) * 1.2 : 0.75) / dpr;      // metres per canvas pixel
  const rot = GAME.camYaw;                                                             // map rotates with the camera (view direction up)
  const cx = W / 2, cy = H * 0.62;
  c.save(); c.fillStyle = MAPC.land; c.fillRect(0, 0, W, H);
  c.translate(cx, cy); c.rotate(rot);
  const k = 1 / (mpp * B.sx);
  c.scale(k, k); c.translate(-(GAME.pos.x - B.X0) * B.sx, -(GAME.pos.z - B.Z0) * B.sz);
  c.imageSmoothingEnabled = true;
  const R = Math.hypot(W, H) * mpp * B.sx;
  const px = (GAME.pos.x - B.X0) * B.sx, pz = (GAME.pos.z - B.Z0) * B.sz;
  const sx0 = clamp(px - R, 0, B.SZ), sz0 = clamp(pz - R, 0, B.SZ), sx1 = clamp(px + R, 0, B.SZ), sz1 = clamp(pz + R, 0, B.SZ);
  if (sx1 > sx0 && sz1 > sz0) c.drawImage(B.cv, sx0, sz0, sx1 - sx0, sz1 - sz0, sx0, sz0, sx1 - sx0, sz1 - sz0);
  c.restore();
  // waypoint route line (straight) and marker
  const toScreen = (x, z) => { const dx = (x - GAME.pos.x) / mpp, dz = (z - GAME.pos.z) / mpp, cs = Math.cos(rot), sn = Math.sin(rot); return [cx + dx * cs - dz * sn, cy + dx * sn + dz * cs]; };
  if (HUD.waypoint) {
    let [wx, wy] = toScreen(HUD.waypoint[0], HUD.waypoint[1]);
    const m = 10 * dpr, inside = wx > m && wx < W - m && wy > m && wy < H - m;
    if (!inside) { const dx = wx - cx, dy = wy - cy, t = Math.min((dx > 0 ? W - m - cx : m - cx) / dx, (dy > 0 ? H - m - cy : m - cy) / dy); wx = cx + dx * t; wy = cy + dy * t; }
    c.fillStyle = '#f2c230'; c.strokeStyle = '#1a1a1a'; c.lineWidth = 2 * dpr;
    c.beginPath(); c.arc(wx, wy, 6 * dpr, 0, Math.PI * 2); c.fill(); c.stroke();
    const d = Math.hypot(HUD.waypoint[0] - GAME.pos.x, HUD.waypoint[1] - GAME.pos.z);
    $('wp-dist').hidden = false; $('wp-dist').textContent = d > 1000 ? (d / 1000).toFixed(1) + ' km' : Math.round(d) + ' m';
    if (d < 12) { HUD.waypoint = null; AUDIO.ui('mission'); $('wp-dist').hidden = true; }
  } else $('wp-dist').hidden = true;
  // street names
  c.font = `600 ${11 * dpr}px "Barlow Condensed", "Arial Narrow", sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.lineJoin = 'round'; c.strokeStyle = 'rgba(15,17,19,0.9)'; c.lineWidth = 3.2 * dpr; c.fillStyle = '#f3f1ea';
  const lim = Math.hypot(W, H) * 0.55 * mpp, used = [];
  for (const l of HUD.labels) {
    if (Math.abs(l.x - GAME.pos.x) > lim || Math.abs(l.z - GAME.pos.z) > lim) continue;
    const [sx, sy] = toScreen(l.x, l.z);
    if (sx < 20 || sx > W - 20 || sy < 12 || sy > H - 12) continue;
    if (used.some(u => Math.hypot(u[0] - sx, u[1] - sy) < 60 * dpr || u[2] === l.n && Math.hypot(u[0] - sx, u[1] - sy) < 160 * dpr)) continue;
    used.push([sx, sy, l.n]);
    let a = l.ang + rot; a = Math.atan2(Math.sin(a), Math.cos(a)); if (a > Math.PI / 2) a -= Math.PI; if (a < -Math.PI / 2) a += Math.PI;
    c.save(); c.translate(sx, sy); c.rotate(a); c.strokeText(l.n, 0, 0); c.fillText(l.n, 0, 0); c.restore();
    if (used.length > 7) break;
  }
  // player arrow
  const ha = -GAME.heading + rot + Math.PI;
  c.save(); c.translate(cx, cy); c.rotate(ha);
  c.fillStyle = '#ffffff'; c.strokeStyle = '#15171a'; c.lineWidth = 1.5 * dpr;
  c.beginPath(); c.moveTo(0, -9 * dpr); c.lineTo(6.5 * dpr, 7 * dpr); c.lineTo(0, 3.5 * dpr); c.lineTo(-6.5 * dpr, 7 * dpr); c.closePath(); c.fill(); c.stroke();
  c.restore();
  // north marker on the border
  const nd = [Math.sin(rot) * 1, -Math.cos(rot) * 1];
  let nx = cx + nd[0] * 1e4, ny = cy + nd[1] * 1e4; const t = Math.min(Math.abs((nd[0] > 0 ? W - 12 * dpr - cx : 12 * dpr - cx) / (nd[0] || 1e-9)), Math.abs((nd[1] > 0 ? H - 12 * dpr - cy : 12 * dpr - cy) / (nd[1] || 1e-9)));
  nx = cx + nd[0] * t; ny = cy + nd[1] * t;
  c.fillStyle = '#15171a'; c.beginPath(); c.arc(nx, ny, 8 * dpr, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#fff'; c.font = `700 ${10 * dpr}px "Barlow", sans-serif`; c.fillText('S', nx, ny + 0.5 * dpr);
};

// ------------------------------------------------------------------ full map
HUD.toggleMap = function (force) {
  HUD.mapOpen = force !== undefined ? force : !HUD.mapOpen;
  $('mapview').hidden = !HUD.mapOpen; S.paused = HUD.mapOpen;
  if (HUD.mapOpen) { if (document.pointerLockElement) document.exitPointerLock(); HUD.zoom = 1.6; HUD.pan = [GAME.pos.x, GAME.pos.z]; HUD.resize(); }
  AUDIO.ui('click');
};
HUD.bigView = function () {
  const W = HUD.big.width, H = HUD.big.height, B = HUD.base;
  const [X0, Z0, X1, Z1] = CITY.bounds, fit = Math.min(W / (X1 - X0), H / (Z1 - Z0));
  const ppm = fit * HUD.zoom;                                                           // canvas px per metre
  return { W, H, ppm, toS: (x, z) => [W / 2 + (x - HUD.pan[0]) * ppm, H / 2 + (z - HUD.pan[1]) * ppm], toW: (sx, sy) => [HUD.pan[0] + (sx - W / 2) / ppm, HUD.pan[1] + (sy - H / 2) / ppm] };
};
HUD.drawBig = function () {
  const c = HUD.bigc, B = HUD.base, v = HUD.bigView(), dpr = HUD.dpr;
  c.fillStyle = '#1e2226'; c.fillRect(0, 0, v.W, v.H);
  const [a0, b0] = v.toS(B.X0, B.Z0);
  c.imageSmoothingEnabled = true;
  c.drawImage(B.cv, a0, b0, B.SZ / B.sx * v.ppm, B.SZ / B.sz * v.ppm);
  // labels when zoomed in
  if (v.ppm > 0.9 * dpr) {
    c.font = `600 ${12 * dpr}px "Barlow Condensed", sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.strokeStyle = 'rgba(15,17,19,0.9)'; c.lineWidth = 3 * dpr; c.fillStyle = '#f3f1ea'; const used = [];
    for (const l of HUD.labels) {
      const [sx, sy] = v.toS(l.x, l.z); if (sx < 0 || sy < 0 || sx > v.W || sy > v.H) continue;
      if (l.len * v.ppm < c.measureText(l.n).width * 0.8) continue;
      if (used.some(u => Math.hypot(u[0] - sx, u[1] - sy) < 70 * dpr)) continue; used.push([sx, sy]);
      let a = l.ang; if (a > Math.PI / 2) a -= Math.PI; if (a < -Math.PI / 2) a += Math.PI;
      c.save(); c.translate(sx, sy); c.rotate(a); c.strokeText(l.n, 0, 0); c.fillText(l.n, 0, 0); c.restore();
    }
  }
  // POI markers
  c.font = `600 ${11 * dpr}px "Barlow", sans-serif`; c.textAlign = 'left';
  for (const p of HUD.notable || []) {
    const [sx, sy] = v.toS(p.x, p.z); if (sx < 0 || sy < 0 || sx > v.W || sy > v.H) continue;
    c.fillStyle = '#7fb2e5'; c.beginPath(); c.arc(sx, sy, 4 * dpr, 0, Math.PI * 2); c.fill();
    if (v.ppm > 0.6 * dpr) { c.strokeText(p.n, sx + 7 * dpr, sy); c.fillStyle = '#dce8f3'; c.fillText(p.n, sx + 7 * dpr, sy); }
  }
  if (HUD.waypoint) { const [sx, sy] = v.toS(HUD.waypoint[0], HUD.waypoint[1]); c.fillStyle = '#f2c230'; c.strokeStyle = '#111'; c.lineWidth = 2 * dpr; c.beginPath(); c.arc(sx, sy, 8 * dpr, 0, Math.PI * 2); c.fill(); c.stroke(); }
  const [px, py] = v.toS(GAME.pos.x, GAME.pos.z);
  c.save(); c.translate(px, py); c.rotate(-GAME.heading + Math.PI);
  c.fillStyle = '#fff'; c.strokeStyle = '#111'; c.lineWidth = 2 * dpr; c.beginPath(); c.moveTo(0, -12 * dpr); c.lineTo(8 * dpr, 9 * dpr); c.lineTo(0, 4 * dpr); c.lineTo(-8 * dpr, 9 * dpr); c.closePath(); c.fill(); c.stroke(); c.restore();
};
HUD.bindBig = function () {
  const el = HUD.big; let drag = null, moved = 0, lastTap = 0;
  el.addEventListener('pointerdown', (e) => { drag = [e.clientX, e.clientY]; moved = 0; el.setPointerCapture(e.pointerId); });
  el.addEventListener('pointermove', (e) => {
    if (!drag) return; const v = HUD.bigView(), dpr = HUD.dpr;
    HUD.pan[0] -= (e.clientX - drag[0]) * dpr / v.ppm; HUD.pan[1] -= (e.clientY - drag[1]) * dpr / v.ppm;
    moved += Math.abs(e.clientX - drag[0]) + Math.abs(e.clientY - drag[1]); drag = [e.clientX, e.clientY];
  });
  el.addEventListener('pointerup', (e) => {
    drag = null; if (moved > 6) return;
    const v = HUD.bigView(), w = v.toW(e.clientX * HUD.dpr, e.clientY * HUD.dpr), now = performance.now();
    if (now - lastTap < 350) { HUD.teleport(w[0], w[1]); return; }
    lastTap = now; HUD.waypoint = w; AUDIO.ui('waypoint');
  });
  el.addEventListener('wheel', (e) => { HUD.zoom = clamp(HUD.zoom * (e.deltaY < 0 ? 1.15 : 1 / 1.15), 0.8, 14); e.preventDefault(); }, { passive: false });
  $('map-close').addEventListener('click', () => HUD.toggleMap(false));
  $('map-tp').addEventListener('click', () => { if (HUD.waypoint) HUD.teleport(HUD.waypoint[0], HUD.waypoint[1]); });
  $('map-zin').addEventListener('click', () => { HUD.zoom = clamp(HUD.zoom * 1.4, 0.8, 14); });
  $('map-zout').addEventListener('click', () => { HUD.zoom = clamp(HUD.zoom / 1.4, 0.8, 14); });
};
HUD.teleport = function (x, z) {
  // find a free spot near the requested point (not inside a building), prefer roads
  const r = CITY.nearestRoadDist(x, z, [1, 2, 3, 4, 5], 120);
  if (r.seg && r.d < 120) { const s = r.seg, t = 0.5; x = s.ax + (s.bx - s.ax) * t; z = s.az + (s.bz - s.az) * t; }
  const h = r.seg ? Math.atan2(r.seg.bx - r.seg.ax, r.seg.bz - r.seg.az) : 0;
  GAME.placeAt(x, z, h);
  HUD.toggleMap(false); HUD.lastStreet = '';
};
