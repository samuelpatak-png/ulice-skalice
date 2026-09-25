// City builder: OpenStreetMap-derived data of Skalica -> realistic geometry for the single PBR world material.
import * as THREE from 'three';
import { S } from '../core/state.js';
import { pts, hash, rng, area, centroid, pip, segDist, clipHalf, offset, col, mulc, mixc, Geo, Grid2D } from '../core/util.js';
import { L, FT, FLAG, WORLD, tintFor, makeWaterMaterial } from '../render/materials.js';
import { roadSurface } from './prvky/surfaces.js';

export const CITY = {
  tileSize: 400, tiles: new Map(),
  edges: new Grid2D(16), obst: new Grid2D(16), bgrid: new Grid2D(40), rgrid: new Grid2D(60), agrid: new Grid2D(120),
  buildings: [], roads: [], areas: [], lines: [], pois: [], landmarks: {}, names: [], hills: [], skip: new Set(),
  extraMeshes: [], water: new Geo(), stats: {},
};
const UP = [0, 1, 0];
export const ROAD_Y = 0.02, WALK_Y = 0.15;
const tt = (layer, hex, k = 1) => tintFor(layer, mulc(col(hex), k));

// ------------------------------------------------------------------ basics
CITY.groundH = function (x, z) {
  let h = 0;
  for (const hl of CITY.hills) {
    const d = Math.hypot(x - hl.x, z - hl.z);
    if (d < hl.r) { const t = d <= hl.top ? 0 : (d - hl.top) / (hl.r - hl.top); h = Math.max(h, hl.h * (0.5 + 0.5 * Math.cos(Math.PI * t))); }
  }
  return h;
};
CITY.tile = function (x, z) {
  const ix = Math.floor(x / CITY.tileSize), iz = Math.floor(z / CITY.tileSize), k = ix * 1000 + iz;
  let t = CITY.tiles.get(k);
  if (!t) { t = { ix, iz, b: new Geo(), f: new Geo() }; CITY.tiles.set(k, t); }
  return t;
};
CITY.addEdge = function (ax, az, bx, bz, h, kind) {
  const e = { ax, az, bx, bz, h, kind };
  CITY.edges.addBox(Math.min(ax, bx) - 1, Math.min(az, bz) - 1, Math.max(ax, bx) + 1, Math.max(az, bz) + 1, e);
};
CITY.addObst = function (x, z, r, kind) { const o = { x, z, r, kind }; CITY.obst.addBox(x - r, z - r, x + r, z + r, o); return o; };

CITY.prepare = function (D) {
  CITY.D = D; CITY.bounds = D.box; CITY.names = D.names; CITY.pal = D.pal.map(h => col(h));
  for (let i = 0; i < D.b.length; i++) {
    const r = D.b[i], p = pts(r[0]), holes = (r[9] || []).map(pts);
    let x0 = 1e9, z0 = 1e9, x1 = -1e9, z1 = -1e9;
    for (const v of p) { x0 = Math.min(x0, v[0]); x1 = Math.max(x1, v[0]); z0 = Math.min(z0, v[1]); z1 = Math.max(z1, v[1]); }
    const bd = { i, p, holes, eave: r[1] / 10, roof: r[2], rh: r[3] / 10, ang: r[4], wall: r[5], roofc: r[6], fac: r[7], cat: r[8],
      bbox: [x0, z0, x1, z1], c: centroid(p), top: r[1] / 10 + r[3] / 10, base: 0, osm: r[10] };
    const ov = CITY.over && CITY.over.buildings[bd.osm];
    if (ov) { bd.ov = ov; bd.eave = (ov.floors || 1) * (ov.fh || 2.8) + 0.3; bd.roof = 0; bd.rh = 0; bd.top = bd.eave; if ((ov.ft ?? 3) === 3) bd.cat = 2; }
    // surveyed look for the generic builder: exact wall / roof colours, storeys, roof shape
    const lk = !ov && CITY.over && CITY.over.looks && CITY.over.looks[bd.osm];
    if (lk) {
      bd.look = lk;
      if (lk.cat !== undefined) bd.cat = lk.cat;
      if (lk.floors) bd.eave = lk.floors * (lk.fh || 2.9) + (lk.plinth ?? 0.5);
      if (lk.eave) bd.eave = lk.eave;
      if (lk.roof) bd.roof = { flat: 0, gable: 1, hip: 2, pyramid: 3 }[lk.roof];
      if (lk.ang !== undefined) bd.ang = lk.ang;                 // ridge direction (deg) when the OBB axis is wrong (deep blocks with the eaves on the street)
      if (bd.roof >= 1 && bd.roof <= 3) {
        const a = bd.ang * Math.PI / 180; let v0 = 1e9, v1 = -1e9;
        for (const v of p) { const q = -v[0] * Math.sin(a) + v[1] * Math.cos(a); v0 = Math.min(v0, q); v1 = Math.max(v1, q); }
        bd.rh = lk.rh ?? (v1 - v0) / 2 * Math.tan((lk.pitch || 30) * Math.PI / 180);
      } else bd.rh = 0;
      bd.top = bd.eave + bd.rh;
    }
    CITY.buildings.push(bd); CITY.bgrid.addBox(x0, z0, x1, z1, bd);
  }
  CITY.landmarks = D.lm || {};
  if (CITY.landmarks.rotunda !== undefined) { const b = CITY.buildings[CITY.landmarks.rotunda]; CITY.hills.push({ x: b.c[0], z: b.c[1], r: 26, top: 7, h: 6.5 }); }
  for (const bd of CITY.buildings) bd.base = CITY.groundH(bd.c[0], bd.c[1]);
  for (const r of D.r) {
    const p = pts(r[0]);
    const rd = { p, w: r[1] / 10, k: r[2], n: r[3], bridge: r[4], cob: r[5], oneway: r[6] };
    CITY.roads.push(rd);
    for (let k = 0; k < p.length - 1; k++) {
      const a = p[k], b = p[k + 1];
      CITY.rgrid.addBox(Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[0], b[0]), Math.max(a[1], b[1]), { r: rd, k, ax: a[0], az: a[1], bx: b[0], bz: b[1] });
    }
  }
  for (const a of D.a) {
    const outer = pts(a[1]), holes = a[2].map(pts);
    let x0 = 1e9, z0 = 1e9, x1 = -1e9, z1 = -1e9;
    for (const v of outer) { x0 = Math.min(x0, v[0]); x1 = Math.max(x1, v[0]); z0 = Math.min(z0, v[1]); z1 = Math.max(z1, v[1]); }
    const ar = { kind: D.ak[a[0]], outer, holes, bbox: [x0, z0, x1, z1] };
    CITY.areas.push(ar); CITY.agrid.addBox(x0, z0, x1, z1, ar);
  }
  for (const ea of (CITY.over && CITY.over.areas) || []) {
    let x0 = 1e9, z0 = 1e9, x1 = -1e9, z1 = -1e9;
    for (const v of ea.outer) { x0 = Math.min(x0, v[0]); x1 = Math.max(x1, v[0]); z0 = Math.min(z0, v[1]); z1 = Math.max(z1, v[1]); }
    const ar = { kind: ea.kind, outer: ea.outer, holes: ea.holes || [], bbox: [x0, z0, x1, z1], fav: ea.fav, bays: ea.bays, color: ea.color, mat: ea.mat };
    CITY.areas.push(ar); CITY.agrid.addBox(x0, z0, x1, z1, ar);
  }
  const LK = ['rail', 'water', 'citywall', 'wall', 'fence', 'treerow', 'hedge'];
  for (const l of D.l) CITY.lines.push({ kind: LK[l[0]], p: pts(l[1]), w: l[2] / 10 });
  CITY.pois = D.pois.map(p => ({ x: p[0] / 10, z: p[1] / 10, n: p[2], k: p[3] }));
  CITY.occ = new Set();
  for (const bd of CITY.buildings) if (bd.cat !== 3 && bd.cat !== 8) CITY.occ.add(Math.floor(bd.c[0] / 30) * 10000 + Math.floor(bd.c[1] / 30));
};
CITY.isUrban = function (x, z) {
  const ix = Math.floor(x / 30), iz = Math.floor(z / 30); let n = 0;
  for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) if (CITY.occ.has((ix + dx) * 10000 + iz + dz)) n++;
  return n >= 2;
};
CITY.buildingAt = function (x, z) {
  const out = CITY.bgrid.query(x, z, x, z, []);
  for (const bd of out) if (x >= bd.bbox[0] && x <= bd.bbox[2] && z >= bd.bbox[1] && z <= bd.bbox[3] && pip(x, z, bd.p)) return bd;
  return null;
};
// footpath segments are not drawn through buildings or across parking lots
CITY.pathBlocked = function (x, z) {
  if (CITY.buildingAt(x, z)) return true;
  for (const a of CITY.agrid.query(x, z, x, z, [])) if (a.kind === 'parking' && x >= a.bbox[0] && x <= a.bbox[2] && z >= a.bbox[1] && z <= a.bbox[3] && pip(x, z, a.outer)) return true;
  return false;
};
CITY.nearestRoadDist = function (x, z, kinds, R = 60) {
  const out = CITY.rgrid.query(x - R, z - R, x + R, z + R, []);
  let best = 1e9, bestSeg = null;
  for (const s of out) {
    if (kinds && !kinds.includes(s.r.k)) continue;
    const d = segDist(x, z, s.ax, s.az, s.bx, s.bz);
    if (d < best) { best = d; bestSeg = s; }
  }
  return { d: best, seg: bestSeg };
};

// ------------------------------------------------------------------ primitive helpers (G = Geo)
CITY.ribbonSeg = function (G, a, b, w, y, c, mat, ft, fa = null) {
  const dx = b[0] - a[0], dz = b[1] - a[1], Ln = Math.hypot(dx, dz); if (Ln < 1e-4) return;
  const nx = -dz / Ln * w / 2, nz = dx / Ln * w / 2;
  const ya = typeof y === 'function' ? y(a[0], a[1]) : y, yb = typeof y === 'function' ? y(b[0], b[1]) : y;
  G.quad([a[0] + nx, ya, a[1] + nz], [b[0] + nx, yb, b[1] + nz], [b[0] - nx, yb, b[1] - nz], [a[0] - nx, ya, a[1] - nz], c, mat, ft, fa, fa, fa, fa, UP);
};
CITY.disc = function (G, c, r, y, cl, mat, ft, n = 12, fa = null) {
  const yy = typeof y === 'function' ? y(c[0], c[1]) : y;
  for (let i = 0; i < n; i++) {
    const a0 = i / n * Math.PI * 2, a1 = (i + 1) / n * Math.PI * 2;
    G.tri([c[0], yy, c[1]], [c[0] + Math.cos(a0) * r, yy, c[1] + Math.sin(a0) * r], [c[0] + Math.cos(a1) * r, yy, c[1] + Math.sin(a1) * r], cl, mat, ft, fa, fa, fa, UP);
  }
};
// oriented box: centre x,z, bottom y; sx along angle, sz across. Walls get facade coords.
CITY.box = function (G, x, y, z, sx, sy, sz, ang, c, mat, ft = 0, topC = null, topMat = null, topFt = null) {
  const cs = Math.cos(ang), sn = Math.sin(ang);
  const pt = (u, v) => [x + u * cs - v * sn, z + u * sn + v * cs];
  const P = [pt(-sx / 2, -sz / 2), pt(sx / 2, -sz / 2), pt(sx / 2, sz / 2), pt(-sx / 2, sz / 2)];
  const y1 = y + sy;
  for (let i = 0; i < 4; i++) {
    const a = P[i], b = P[(i + 1) % 4], Ln = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const mx = (a[0] + b[0]) / 2 - x, mz = (a[1] + b[1]) / 2 - z;
    G.quad([a[0], y, a[1]], [b[0], y, b[1]], [b[0], y1, b[1]], [a[0], y1, a[1]], c, mat, ft, [0, 0, Ln, sy], [Ln, 0, Ln, sy], [Ln, sy, Ln, sy], [0, sy, Ln, sy], [mx, 0, mz]);
  }
  G.quad([P[0][0], y1, P[0][1]], [P[1][0], y1, P[1][1]], [P[2][0], y1, P[2][1]], [P[3][0], y1, P[3][1]], topC || c, topMat ?? mat, topFt ?? 0, null, null, null, null, UP);
  return P;
};
CITY.cylinder = function (G, x, y, z, r, h, n, c, mat, ft = 0, cap = true) {
  for (let i = 0; i < n; i++) {
    const a0 = i / n * Math.PI * 2, a1 = (i + 1) / n * Math.PI * 2;
    const p0 = [x + Math.cos(a0) * r, z + Math.sin(a0) * r], p1 = [x + Math.cos(a1) * r, z + Math.sin(a1) * r];
    const u0 = r * a0, u1 = r * a1;
    G.quad([p0[0], y, p0[1]], [p1[0], y, p1[1]], [p1[0], y + h, p1[1]], [p0[0], y + h, p0[1]], c, mat, ft, [u0, 0, r * 6.3, h], [u1, 0, r * 6.3, h], [u1, h, r * 6.3, h], [u0, h, r * 6.3, h], [Math.cos((a0 + a1) / 2), 0, Math.sin((a0 + a1) / 2)]);
    if (cap) G.tri([x, y + h, z], [p0[0], y + h, p0[1]], [p1[0], y + h, p1[1]], c, mat, 0, null, null, null, UP);
  }
};
CITY.coneAt = function (G, x, y, z, r, h, n, c, mat, ft = 0) {
  for (let i = 0; i < n; i++) {
    const a0 = i / n * Math.PI * 2, a1 = (i + 1) / n * Math.PI * 2;
    G.tri([x + Math.cos(a0) * r, y, z + Math.sin(a0) * r], [x + Math.cos(a1) * r, y, z + Math.sin(a1) * r], [x, y + h, z], c, mat, ft, null, null, null, [Math.cos((a0 + a1) / 2), r / h, Math.sin((a0 + a1) / 2)]);
  }
};
CITY.gable = function (G, x, y, z, sx, sz, h, ang, c, mat, ft = FT.ROOF) {
  const cs = Math.cos(ang), sn = Math.sin(ang);
  const pt = (u, v, yy) => [x + u * cs - v * sn, yy, z + u * sn + v * cs];
  const a = pt(-sx / 2, -sz / 2, y), b = pt(sx / 2, -sz / 2, y), cc = pt(sx / 2, sz / 2, y), d = pt(-sx / 2, sz / 2, y);
  const r0 = pt(-sx / 2, 0, y + h), r1 = pt(sx / 2, 0, y + h);
  G.quad(a, b, r1, r0, c, mat, ft, null, null, null, null, [sn, 0.6, -cs]);
  G.quad(d, cc, r1, r0, c, mat, ft, null, null, null, null, [-sn, 0.6, cs]);
  G.tri(a, d, r0, c, mat, 0, null, null, null, [-cs, 0, -sn]);
  G.tri(b, cc, r1, c, mat, 0, null, null, null, [cs, 0, sn]);
};
CITY.cross = function (G, x, y, z, h) {
  const g = [1, 1, 1];
  CITY.box(G, x, y, z, 0.12, h, 0.12, 0, g, L.PLASTER, FT.GOLD);
  CITY.box(G, x, y + h * 0.62, z, 0.7, 0.12, 0.12, 0, g, L.PLASTER, FT.GOLD);
};

// ------------------------------------------------------------------ ground splat maps
const COVER = {
  meadow: '#67703f', lush: '#5b6a39', dry: '#7e7a4b', park: '#5a6c37', golf: '#557036', pitch: '#50702f', cemetery: '#5f6b3c',
  residential: '#636d3d', forest: '#4a5230', scrub: '#5f6638', wetland: '#5c6842', orchard: '#617040', allotments: '#666c3c',
  vineyard: '#666c3a', farmyard: '#72704c', campus: '#5e6c3a',
};
CITY.buildGround = function () {
  const [X0, Z0, X1, Z1] = CITY.bounds, W = X1 - X0, H = Z1 - Z0;
  const SA = S.mobile ? 2048 : 4096, SB = 2048;
  const mk = (s) => { const c = document.createElement('canvas'); c.width = c.height = s; return c; };
  const cvA = mk(SA), ca = cvA.getContext('2d', { willReadFrequently: true });
  const cvG = mk(SA), cg = cvG.getContext('2d', { willReadFrequently: true });
  const R = rng(99);
  const path = (ctx, s, a, grow = 0) => {
    const tx = x => (x - X0) / W * s, tz = z => (z - Z0) / H * s;
    ctx.beginPath();
    const ring = (p) => { p.forEach((v, i) => i ? ctx.lineTo(tx(v[0]), tz(v[1])) : ctx.moveTo(tx(v[0]), tz(v[1]))); ctx.closePath(); };
    ring(a.outer); (a.holes || []).forEach(ring);
  };
  const line = (ctx, s, p, w) => {
    const tx = x => (x - X0) / W * s, tz = z => (z - Z0) / H * s;
    ctx.lineWidth = Math.max(1, w / W * s); ctx.beginPath(); p.forEach((v, i) => i ? ctx.lineTo(tx(v[0]), tz(v[1])) : ctx.moveTo(tx(v[0]), tz(v[1]))); ctx.stroke();
  };
  const blob = (ctx, s, x, z, r, style) => {
    const px = (x - X0) / W * s, pz = (z - Z0) / H * s, pr = r / W * s;
    const g = ctx.createRadialGradient(px, pz, 0, px, pz, pr); g.addColorStop(0, style); g.addColorStop(1, style.replace(/[\d.]+\)$/, '0)'));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(px, pz, pr, 0, Math.PI * 2); ctx.fill();
  };
  const hexA = (h, a) => { const c = new THREE.Color(h); return `rgba(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)},${a})`; };
  // ---- A: cover colour (sRGB albedo of the vegetation)
  ca.fillStyle = COVER.meadow; ca.fillRect(0, 0, SA, SA);
  for (let i = 0; i < 420; i++) blob(ca, SA, X0 + R() * W, Z0 + R() * H, 40 + R() * 220, hexA([COVER.lush, COVER.dry, '#6e7446', '#5a6436'][Math.floor(R() * 4)], 0.55));
  // ---- G: grey data maps, painted one after another and read back into the byte arrays
  const A = new Uint8Array(SA * SA * 4), B = new Uint8Array(SB * SB * 4);
  const grab = (ctx, s, arr, ch, S2) => {
    const d = ctx.getImageData(0, 0, s, s).data;
    if (s === S2) { for (let y = 0; y < s; y++) { const ro = (s - 1 - y) * s * 4, ri = y * s * 4; for (let x = 0; x < s; x++) arr[ro + x * 4 + ch] = d[ri + x * 4]; } }
    else { const k = s / S2; for (let y = 0; y < S2; y++) { const ro = (S2 - 1 - y) * S2 * 4, ri = Math.floor(y * k) * s * 4; for (let x = 0; x < S2; x++) arr[ro + x * 4 + ch] = d[ri + Math.floor(x * k) * 4]; } }
  };
  const grey = (v) => `rgb(${v},${v},${v})`;
  const kindsOrder = ['farmland', 'residential', 'farmyard', 'campus', 'industrial', 'retail', 'grass', 'golf', 'vineyard', 'orchard', 'allotments',
    'scrub', 'wetland', 'park', 'cemetery', 'forest', 'sports', 'playground', 'pitch', 'track', 'parking', 'plaza', 'water', 'pool'];
  const byKind = {}; for (const a of CITY.areas) (byKind[a.kind] = byKind[a.kind] || []).push(a);
  const longest = (a) => { let best = 0, ang = 0; for (let i = 0; i < a.outer.length; i++) { const p0 = a.outer[i], p1 = a.outer[(i + 1) % a.outer.length]; const l = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]); if (l > best) { best = l; ang = Math.atan2(p1[1] - p0[1], p1[0] - p0[0]); } } return ((ang % Math.PI) + Math.PI) % Math.PI; };
  // field crops for farmland polygons (deterministic per polygon)
  const crops = new Map();
  (byKind.farmland || []).forEach((a, i) => { const h = hash(i * 7919 + 13); crops.set(a, h < 0.28 ? 'stubble' : h < 0.5 ? 'plough' : h < 0.72 ? 'maize' : h < 0.86 ? 'green' : 'wheat'); });
  for (const kind of kindsOrder) for (const a of byKind[kind] || []) {
    path(ca, SA, a);
    let c = COVER[kind];
    if (kind === 'farmland') c = { stubble: '#8f8a4f', plough: '#6b5d45', maize: '#566b2d', green: '#5a7a30', wheat: '#9e9352' }[crops.get(a)];
    if (kind === 'industrial' || kind === 'retail' || kind === 'parking' || kind === 'plaza') c = '#8a8680';
    if (kind === 'sports' || kind === 'playground') c = '#5b7331';
    if (kind === 'track') c = '#a04a35';
    if (c) { ca.fillStyle = c; ca.fill('evenodd'); }
  }
  // soft darker margins along roads (dust), building gardens
  ca.lineCap = cg.lineCap = 'round'; ca.lineJoin = cg.lineJoin = 'round';
  for (const r of CITY.roads) if (r.k <= 4) { ca.strokeStyle = 'rgba(112,112,72,0.35)'; line(ca, SA, r.p, r.w + 3); }
  { const d = ca.getImageData(0, 0, SA, SA).data; for (let y = 0; y < SA; y++) { const ro = (SA - 1 - y) * SA * 4, ri = y * SA * 4; for (let x = 0; x < SA; x++) { A[ro + x * 4] = d[ri + x * 4]; A[ro + x * 4 + 1] = d[ri + x * 4 + 1]; A[ro + x * 4 + 2] = d[ri + x * 4 + 2]; } } }
  // paved weight
  cg.fillStyle = '#000'; cg.fillRect(0, 0, SA, SA);
  for (const kind of ['industrial', 'retail', 'plaza', 'parking', 'farmyard']) for (const a of byKind[kind] || []) { path(cg, SA, a); cg.fillStyle = grey(kind === 'farmyard' ? 90 : kind === 'industrial' ? 215 : 255); cg.fill('evenodd'); }
  { // historic centre courtyards
    const g = cg.createRadialGradient((170 - X0) / W * SA, (-190 - Z0) / H * SA, 0, (170 - X0) / W * SA, (-190 - Z0) / H * SA, 230 / W * SA);
    g.addColorStop(0, 'rgba(255,255,255,0.62)'); g.addColorStop(0.6, 'rgba(255,255,255,0.5)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    cg.fillStyle = g; cg.fillRect(0, 0, SA, SA);
  }
  cg.strokeStyle = grey(255); cg.lineCap = cg.lineJoin = 'round';
  for (const r of CITY.roads) { // old town: paved from facade to facade
    if (r.k > 5) continue; const m = r.p[r.p.length >> 1];
    if (Math.hypot(m[0] - 150, m[1] + 170) < 330) line(cg, SA, r.p, r.w + 12);
  }
  for (const bd of CITY.buildings) if (bd.cat === 5 || bd.cat === 4 || bd.cat === 2 || bd.cat === 7) { path(cg, SA, { outer: bd.p }); cg.lineWidth = (bd.cat === 5 ? 14 : 5) / W * SA; cg.stroke(); }
  for (const kind of ['park', 'grass', 'cemetery', 'forest', 'pitch', 'sports', 'playground']) for (const a of byKind[kind] || []) { path(cg, SA, a); cg.fillStyle = '#000'; cg.fill('evenodd'); }
  grab(cg, SA, A, 3, SA);
  // B: soil (r), forest floor (g), row angle (b), row spacing (a)
  const tmp = mk(SB); const ct = tmp.getContext('2d', { willReadFrequently: true });
  const passT = (ch, fn) => { ct.fillStyle = '#000'; ct.fillRect(0, 0, SB, SB); fn(); grab(ct, SB, B, ch, SB); };
  passT(0, () => {
    for (const a of byKind.farmland || []) { const c = crops.get(a); path(ct, SB, a); ct.fillStyle = grey({ stubble: 90, plough: 245, maize: 150, green: 110, wheat: 30 }[c]); ct.fill('evenodd'); }
    for (const kind of ['vineyard', 'allotments', 'farmyard']) for (const a of byKind[kind] || []) { path(ct, SB, a); ct.fillStyle = grey(kind === 'vineyard' ? 140 : 170); ct.fill('evenodd'); }
    ct.strokeStyle = 'rgba(255,255,255,0.5)'; ct.lineCap = 'round';
    for (const r of CITY.roads) if (r.k === 6 || r.k === 8) line(ct, SB, r.p, r.w + 0.8);
  });
  passT(1, () => { for (const kind of ['forest', 'scrub', 'wetland']) for (const a of byKind[kind] || []) { path(ct, SB, a); ct.fillStyle = grey(kind === 'forest' ? 235 : 90); ct.fill('evenodd'); } });
  const rowPass = (ch, val) => passT(ch, () => {
    for (const a of byKind.farmland || []) { const c = crops.get(a); if (c === 'wheat' || c === 'stubble') continue; path(ct, SB, a); ct.fillStyle = grey(val(a, c)); ct.fill('evenodd'); }
    for (const kind of ['vineyard', 'allotments']) for (const a of byKind[kind] || []) { path(ct, SB, a); ct.fillStyle = grey(val(a, kind)); ct.fill('evenodd'); }
  });
  rowPass(2, (a) => Math.round(longest(a) / Math.PI * 255));
  rowPass(3, (a, c) => Math.round(({ vineyard: 2.4, allotments: 0.9, maize: 0.75, green: 0.5, plough: 0.6 }[c] || 0) / 4 * 255));
  const texA = new THREE.DataTexture(A, SA, SA, THREE.RGBAFormat), texB = new THREE.DataTexture(B, SB, SB, THREE.RGBAFormat);
  for (const t of [texA, texB]) { t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; t.anisotropy = 8; t.needsUpdate = true; }
  WORLD.uniforms.uSplat.value = texA; WORLD.uniforms.uSplat2.value = texB;
  WORLD.uniforms.uSplatBox.value.set(X0, Z0, W, H);
  CITY.coverA = { data: A, size: SA };
  // ---- terrain mesh: 25 m cells, finer around hills
  const gcol = [1, 1, 1], step = 25;
  for (let x = X0; x < X1; x += step) for (let z = Z0; z < Z1; z += step) {
    const hill = CITY.hills.find(h => x + step > h.x - h.r && x < h.x + h.r && z + step > h.z - h.r && z < h.z + h.r);
    const s = hill ? 2.5 : step, G = CITY.tile(x + 1, z + 1).f;
    for (let xx = x; xx < x + step - 1e-6; xx += s) for (let zz = z; zz < z + step - 1e-6; zz += s) {
      const v = (a, b) => [a, CITY.groundH(a, b), b];
      G.quad(v(xx, zz), v(xx, zz + s), v(xx + s, zz + s), v(xx + s, zz), gcol, L.GROUND, 0, null, null, null, null, UP);
    }
  }
  // outer land beyond the data box (no shadows, coarse)
  const O = new Geo(), E = 7000, st = 250;
  for (let x = X0 - E; x < X1 + E; x += st) for (let z = Z0 - E; z < Z1 + E; z += st) {
    if (x >= X0 && x + st <= X1 && z >= Z0 && z + st <= Z1) continue;
    const q = [[x, z], [x, z + st], [x + st, z + st], [x + st, z]].map(([a, b]) => [Math.min(Math.max(a, x), x + st), -0.02, b]);
    // clip cells overlapping the inner box into up to 4 strips
    const parts = [];
    const cx0 = Math.max(x, X0), cx1 = Math.min(x + st, X1), cz0 = Math.max(z, Z0), cz1 = Math.min(z + st, Z1);
    if (cx0 < cx1 && cz0 < cz1) {
      if (x < X0) parts.push([x, z, X0, z + st]); if (x + st > X1) parts.push([X1, z, x + st, z + st]);
      if (z < Z0) parts.push([cx0, z, cx1, Z0]); if (z + st > Z1) parts.push([cx0, Z1, cx1, z + st]);
    } else parts.push([x, z, x + st, z + st]);
    for (const [a0, b0, a1, b1] of parts) O.quad([a0, -0.02, b0], [a0, -0.02, b1], [a1, -0.02, b1], [a1, -0.02, b0], gcol, L.GROUND, 0, null, null, null, null, UP);
  }
  CITY.outerGeo = O;
};

// ------------------------------------------------------------------ flat areas
CITY.buildAreas = function () {
  for (const a of CITY.areas) {
    const k = a.kind; if (!['parking', 'plaza', 'pitch', 'track', 'playground', 'water', 'pool'].includes(k)) continue;
    const c = centroid(a.outer), G = CITY.tile(c[0], c[1]).f;
    const gy = (x, z) => CITY.groundH(x, z) + (k === 'plaza' ? 0.03 : 0.015);
    if (k === 'water' || k === 'pool') { CITY.water.poly(a.outer, a.holes, (x, z) => CITY.groundH(x, z) + (k === 'pool' ? 0.4 : 0.05), [1, 1, 1], 0, 0); continue; }
    if (k === 'parking') {
      let best = 0, dir = [1, 0];
      for (let i = 0; i < a.outer.length; i++) { const p0 = a.outer[i], p1 = a.outer[(i + 1) % a.outer.length]; const l = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]); if (l > best) { best = l; dir = [(p1[0] - p0[0]) / l, (p1[1] - p0[1]) / l]; } }
      const p0 = a.outer[0], pr = [-dir[1], dir[0]];
      const fav = [dir[0], dir[1], -(p0[0] * dir[0] + p0[1] * dir[1]), -(p0[0] * pr[0] + p0[1] * pr[1]) + 8.0];
      const big = a.bays !== undefined ? a.bays : Math.abs(area(a.outer)) > 250;
      const lm = a.mat === 'concrete' ? L.PRECAST : L.ASPHALT_LIGHT;
      G.poly(a.outer, a.holes, a.bays ? (x, z) => gy(x, z) + 0.004 : gy, tt(lm, a.color || '#5a5a57'), lm, FT.PARKING + (big ? 0.4 : 0), a.fav || fav);
    } else if (k === 'plaza') G.poly(a.outer, a.holes, gy, tt(L.COBBLE, '#8d877c'), L.COBBLE, FT.PLAZA);
    else if (k === 'pitch') {
      let best = 0, dir = [1, 0];
      for (let i = 0; i < a.outer.length; i++) { const p0 = a.outer[i], p1 = a.outer[(i + 1) % a.outer.length]; const l = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]); if (l > best) { best = l; dir = [(p1[0] - p0[0]) / l, (p1[1] - p0[1]) / l]; } }
      G.poly(a.outer, a.holes, gy, tt(L.GRASS, '#4d7a2c'), L.GRASS, FT.PITCH, [dir[0], dir[1], 0, 0]);
      const ar = area(a.outer), ring = ar > 0 ? a.outer : a.outer.slice().reverse(), inner = offset(ring, -1.2);
      for (let i = 0; i < inner.length; i++) CITY.ribbonSeg(G, inner[i], inner[(i + 1) % inner.length], 0.12, (x, z) => gy(x, z) + 0.004, tt(L.ASPHALT, '#bbbbb5'), L.ASPHALT, FT.PAINT);
    } else if (k === 'track') G.poly(a.outer, a.holes, gy, tt(L.ASPHALT, '#8a3a2a'), L.ASPHALT, FT.TARTAN);
    else if (k === 'playground') G.poly(a.outer, a.holes, gy, tt(L.DIRT, '#a08c68'), L.DIRT, FT.SAND);
  }
};

// ------------------------------------------------------------------ roads
// k: 1 main, 2 residential, 3 living street, 4 service, 5 pedestrian, 6 track, 7 footway, 8 path, 9 cycleway, 10 steps, 11 crossing
const RSPEC = {
  1: { mat: L.ASPHALT, hex: '#3f3f3d', ft: FT.ROAD_MAIN, sw: 2.4 }, 2: { mat: L.ASPHALT, hex: '#39393a', ft: FT.ROAD, sw: 2.0 },
  3: { mat: L.COBBLE, hex: '#8b8378', ft: FT.ROAD_SETTS, sw: 0 }, 4: { mat: L.ASPHALT, hex: '#4a4a47', ft: FT.ROAD_SERVICE, sw: 0 },
  5: { mat: L.COBBLE, hex: '#948c80', ft: FT.ROAD_SETTS, sw: 0 }, 6: { mat: L.DIRT, hex: '#7a6a52', ft: FT.TRACK, sw: 0 },
  7: { mat: L.PAVERS, hex: '#8f8a80', ft: FT.FOOTWAY, sw: 0 }, 8: { mat: L.DIRT, hex: '#86755a', ft: FT.PATH, sw: 0 },
  9: { mat: L.ASPHALT, hex: '#6e3a30', ft: FT.FOOTWAY, sw: 0 }, 10: { mat: L.PAVERS, hex: '#9a958a', ft: FT.FOOTWAY, sw: 0 },
};
const VEH = (k) => k >= 1 && k <= 5;
const nkey = (p) => Math.round(p[0] * 5) + ',' + Math.round(p[1] * 5);

// mitered offset of an open polyline (d > 0 = left of travel direction, i.e. +normal (-dz, dx))
function offsetOpen(p, d) {
  const out = [];
  for (let i = 0; i < p.length; i++) {
    const a = p[Math.max(0, i - 1)], b = p[i], c = p[Math.min(p.length - 1, i + 1)];
    let e1x = b[0] - a[0], e1z = b[1] - a[1], e2x = c[0] - b[0], e2z = c[1] - b[1];
    let l1 = Math.hypot(e1x, e1z), l2 = Math.hypot(e2x, e2z);
    if (l1 < 1e-6) { e1x = e2x; e1z = e2z; l1 = l2; } if (l2 < 1e-6) { e2x = e1x; e2z = e1z; l2 = l1; }
    e1x /= l1 || 1; e1z /= l1 || 1; e2x /= l2 || 1; e2z /= l2 || 1;
    const n1x = -e1z, n1z = e1x, n2x = -e2z, n2z = e2x;
    let mx = n1x + n2x, mz = n1z + n2z; const ml = Math.hypot(mx, mz);
    if (ml < 1e-6) { mx = n1x; mz = n1z; } else { mx /= ml; mz /= ml; }
    const k = d / Math.max(mx * n1x + mz * n1z, 0.4);
    out.push([b[0] + mx * k, b[1] + mz * k]);
  }
  return out;
}

CITY.buildRoads = function () {
  // ---- junction analysis on the vehicle network
  const nodes = new Map();
  for (const r of CITY.roads) {
    if (!VEH(r.k)) continue;
    const sw = (RSPEC[r.k].sw && (CITY.isUrban(r.p[0][0], r.p[0][1]) || CITY.isUrban(r.p[r.p.length >> 1][0], r.p[r.p.length >> 1][1]))) ? RSPEC[r.k].sw : 0;
    r.sw = sw;
    const o = CITY.roadOverride && CITY.roadOverride(r);
    if (o) { r.swAt = o.at; r.swDef = sw; }
    r.p.forEach((v, i) => {
      const k = nkey(v); let n = nodes.get(k);
      if (!n) { n = { x: v[0], z: v[1], deg: 0, hw: 0, hws: 0, arms: [] }; nodes.set(k, n); }
      n.deg += (i === 0 || i === r.p.length - 1) ? 1 : 2;
      n.hw = Math.max(n.hw, r.w / 2); n.hws = Math.max(n.hws, r.w / 2 + sw);
      n.arms.push({ r, i });
    });
  }
  CITY.nodes = nodes;
  const isJ = (n) => n && n.deg >= 3;
  const swTint = tt(L.PAVERS, '#8c877e'), curbTint = tt(L.PRECAST, '#9a9892'), fillTint = tt(L.PAVERS, '#8a857c');
  const white = tt(L.ASPHALT, '#c9c9c3');
  for (const r of CITY.roads) {
    const gy = (x, z) => CITY.groundH(x, z);
    if (r.k === 11) { // zebra crossing: stripes laid along the road being crossed
      for (let k = 0; k < r.p.length - 1; k++) {
        const a = r.p[k], b = r.p[k + 1], dx = b[0] - a[0], dz = b[1] - a[1], Ln = Math.hypot(dx, dz); if (Ln < 0.3) continue;
        const ux = dx / Ln, uz = dz / Ln, n = Math.max(1, Math.floor(Ln / 1.0)), wz = Math.max(2.6, r.w + 1.4);
        const G = CITY.tile(a[0], a[1]).f;
        for (let i = 0; i < n; i++) {
          const t0 = (i + 0.25) * Ln / n, t1 = (i + 0.75) * Ln / n;
          CITY.ribbonSeg(G, [a[0] + ux * t0, a[1] + uz * t0], [a[0] + ux * t1, a[1] + uz * t1], wz, (x, z) => gy(x, z) + ROAD_Y + 0.004, white, L.ASPHALT, FT.ZEBRA);
        }
      }
      continue;
    }
    const s = RSPEC[r.k]; if (!s) continue;
    let mat = s.mat, ft = s.ft, tint = tt(mat, s.hex);
    if (r.cob && r.k <= 4) { mat = L.COBBLE; ft = FT.ROAD_SETTS; tint = tt(mat, '#7f786e'); }
    const hw = r.w / 2, veh = VEH(r.k);
    const flag = (r.k === 1 && hw >= 3.2 && !r.cob) ? FLAG.A : 0;
    const y0 = veh ? ROAD_Y : r.k === 6 ? 0.012 : 0.03;
    // ---- resample: insert cut points around junction nodes (sharp marking / sidewalk cuts)
    const P = [], U = [], J = [];     // points, u, in-junction flag
    let u = 0;
    const jr = (n) => n.hw + (r.sw || 0) + 0.6;
    for (let i = 0; i < r.p.length; i++) {
      const v = r.p[i];
      if (i > 0) {
        const a = r.p[i - 1], Ln = Math.hypot(v[0] - a[0], v[1] - a[1]);
        const na = veh ? nodes.get(nkey(a)) : null, nb = veh ? nodes.get(nkey(v)) : null;
        const cuts = [];
        if (isJ(na)) cuts.push(Math.min(Ln * 0.5, jr(na)), Math.min(Ln * 0.5, jr(na) + 1.3));
        if (isJ(nb)) cuts.push(Math.max(Ln * 0.5, Ln - jr(nb) - 1.3), Math.max(Ln * 0.5, Ln - jr(nb)));
        cuts.sort((x, y) => x - y);
        for (const c of cuts) if (c > 0.02 && c < Ln - 0.02) { const t = c / Ln; P.push([a[0] + (v[0] - a[0]) * t, a[1] + (v[1] - a[1]) * t]); U.push(u + c); J.push(0); }
        u += Ln;
      }
      P.push(v); U.push(u); J.push(0);
    }
    // junction membership: distance along u to any junction node
    const jU = [];
    if (veh) { let uu = 0; for (let i = 0; i < r.p.length; i++) { if (i) uu += Math.hypot(r.p[i][0] - r.p[i - 1][0], r.p[i][1] - r.p[i - 1][1]); const n = nodes.get(nkey(r.p[i])); if (isJ(n)) jU.push([uu, jr(n)]); } }
    const zone = (uu) => { let m = 0; for (const [ju, rr] of jU) { const d = Math.abs(uu - ju); if (d < rr - 1e-3) m = 2; else if (d < rr + 1.3 - 1e-3 && m < 1) m = 1; } return m; }; // 2 = inside, 1 = ramp
    for (let i = 0; i < P.length; i++) J[i] = zone(U[i]);
    // ---- carriageway ribbon (mitered)
    const Lft = offsetOpen(P, hw), Rgt = offsetOpen(P, -hw);
    const t0 = CITY.tile(P[0][0], P[0][1]);
    for (let i = 0; i < P.length - 1; i++) {
      const mx = (P[i][0] + P[i + 1][0]) / 2, mz = (P[i][1] + P[i + 1][1]) / 2;
      if (!veh && CITY.pathBlocked(mx, mz)) continue;
      const G = CITY.tile(mx, mz).f;
      const m0 = (J[i] === 2 || J[i + 1] === 2) ? 0.01 : hw, m1 = m0;
      const a = Lft[i], b = Lft[i + 1], c = Rgt[i + 1], d = Rgt[i];
      // roads[].surface from a district: the carriageway material of this box (overrides the OSM cobble tint,
      // and setts / stone / pavers carry no painted centre line)
      const so = r.swAt && r.swAt(mx, mz), sp = so && so.surface ? roadSurface(so.surface) : null;
      const sAsph = sp && so.surface === 'asphalt';               // asphalt keeps the markings of the road class
      G.quad([a[0], gy(a[0], a[1]) + y0, a[1]], [b[0], gy(b[0], b[1]) + y0, b[1]], [c[0], gy(c[0], c[1]) + y0, c[1]], [d[0], gy(d[0], d[1]) + y0, d[1]],
        sp ? sp.tint : tint, sp ? sp.mat : mat, sp && !sAsph ? sp.ft : ft + flag,
        [U[i], hw, m0, 0], [U[i + 1], hw, m1, 0], [U[i + 1], -hw, m1, 0], [U[i], -hw, m0, 0], UP);
    }
    // round ends and sharp bends of non-vehicle ways
    if (!veh) for (let i = 0; i < r.p.length; i++) if (i === 0 || i === r.p.length - 1) CITY.disc(CITY.tile(r.p[i][0], r.p[i][1]).f, r.p[i], hw, (x, z) => gy(x, z) + y0 - 0.002, tint, mat, ft, 10);
    // ---- sidewalks: curb band + paved strip on both sides, cut at junctions with ramps
    if (r.sw > 0 || r.swAt) {
      for (const side of [1, -1]) {
        const si = side === 1 ? 0 : 1;
        const segO = (i) => { if (!r.swAt) return null; return r.swAt((P[i][0] + P[i + 1][0]) / 2, (P[i][1] + P[i + 1][1]) / 2); };
        let so = 0, swi = r.sw; const flat = [], asph = [], grav = [], kerb = [];
        // o.mat applies to both sides, o.mats = [side +1, side -1]; 'gravel' is a flat verge without kerb.
        // o.curbH / o.curb ('road' | 'low' | 'none') set the kerb height of this stretch (prvky).
        const pick = (i) => {
          const o = segO(i), mt = o ? (o.mats ? o.mats[si] : o.mat) : null;
          so = o ? o.off[si] : 0; swi = o ? o.sw[si] : (r.swDef ?? r.sw); grav[i] = mt === 'gravel';
          flat[i] = !!(o && (o.flat || grav[i] || o.curb === 'none')); asph[i] = mt === 'asphalt';
          kerb[i] = o ? (o.curb === 'low' ? Math.min(o.curbH ?? 0.08, 0.08) : o.curbH ?? WALK_Y) : WALK_Y;
        };
        const I0 = [], I1 = [], O1 = [];
        for (let i = 0; i < P.length - 1; i++) { pick(i); for (const [arr, d] of [[I0, hw + so], [I1, hw + so + 0.16], [O1, hw + so + swi]]) { const seg = offsetOpen([P[i], P[i + 1]], side * d); arr[i] = arr[i] || seg[0]; arr[i + 1] = seg[1]; arr.sw = arr.sw || []; arr.sw[i] = swi; } }
        const yS = (i) => J[i] === 2 ? null : J[i] === 1 ? (U[i] === undefined ? WALK_Y : null) : WALK_Y;
        for (let i = 0; i < P.length - 1; i++) {
          if (J[i] === 2 || J[i + 1] === 2 || !O1.sw[i]) continue;
          const WY = flat[i] ? 0.04 : (kerb[i] ?? WALK_Y);
          const ha = J[i] === 1 && J[i + 1] !== 1 ? ROAD_Y + 0.004 : WY, hb = J[i + 1] === 1 && J[i] !== 1 ? ROAD_Y + 0.004 : WY;
          const hA = (J[i] === 1 && J[i + 1] === 1) ? ROAD_Y + 0.004 : ha, hB = (J[i] === 1 && J[i + 1] === 1) ? ROAD_Y + 0.004 : hb;
          const G = CITY.tile((P[i][0] + P[i + 1][0]) / 2, (P[i][1] + P[i + 1][1]) / 2).f, Gb = CITY.tile(P[i][0], P[i][1]).b;
          const v3 = (q, h) => [q[0], gy(q[0], q[1]) + h, q[1]];
          const fa0 = [U[i], 0, 1, 0], fa1 = [U[i + 1], 0, 1, 0];
          if (grav[i]) { G.quad(v3(I0[i], hA), v3(I0[i + 1], hB), v3(O1[i + 1], hB), v3(O1[i], hA), tt(L.DIRT, '#8b7f6a'), L.DIRT, FT.PATH, null, null, null, null, UP); continue; }
          if (!asph[i]) G.quad(v3(I0[i], hA), v3(I0[i + 1], hB), v3(I1[i + 1], hB), v3(I1[i], hA), curbTint, L.PRECAST, FT.CURB, fa0, fa1, fa1, fa0, UP);
          if (asph[i]) G.quad(v3(I0[i], hA), v3(I0[i + 1], hB), v3(O1[i + 1], hB), v3(O1[i], hA), tt(L.ASPHALT, '#4b4b49'), L.ASPHALT, FT.FOOTWAY, null, null, null, null, UP);
          else G.quad(v3(I1[i], hA), v3(I1[i + 1], hB), v3(O1[i + 1], hB), v3(O1[i], hA), swTint, L.PAVERS, FT.SIDEWALK, null, null, null, null, UP);
          if (flat[i]) continue;
          // curb face toward the road and outer edge down to the terrain
          const dn = [-(I0[i + 1][1] - I0[i][1]) * side, 0, (I0[i + 1][0] - I0[i][0]) * side];
          G.quad(v3(I0[i], ROAD_Y - 0.02), v3(I0[i + 1], ROAD_Y - 0.02), v3(I0[i + 1], hB), v3(I0[i], hA), curbTint, L.PRECAST, FT.CURB, [U[i], 0, 1, 0], [U[i + 1], 0, 1, 0], [U[i + 1], 0.15, 1, 0], [U[i], 0.15, 1, 0], [-dn[0], 0, -dn[2]]);
          G.quad(v3(O1[i], -0.05), v3(O1[i + 1], -0.05), v3(O1[i + 1], hB), v3(O1[i], hA), curbTint, L.PRECAST, 0, null, null, null, null, dn);
        }
      }
    }
    // collision helpers for AI / camera not needed for roads
  }
  // ---- junction fills: carriageway disc + paved corner hull at road level
  for (const n of nodes.values()) {
    if (!isJ(n)) continue;
    const G = CITY.tile(n.x, n.z).f, gy = CITY.groundH(n.x, n.z);
    let main = null; for (const a of n.arms) if (!main || a.r.w > main.r.w) main = a;
    const rs = RSPEC[main.r.k]; let mat = rs.mat, tint = tt(mat, rs.hex), ft = rs.ft === FT.ROAD_MAIN ? FT.ROAD : rs.ft;
    if (main.r.cob) { mat = L.COBBLE; tint = tt(mat, '#7f786e'); ft = FT.ROAD_SETTS; }
    const jo = main.r.swAt && main.r.swAt(n.x, n.z), jsp = jo && jo.surface ? roadSurface(jo.surface) : null;
    if (jsp) { mat = jsp.mat; tint = jsp.tint; ft = jsp.ft; }     // the junction disc follows roads[].surface too
    CITY.disc(G, [n.x, n.z], n.hw * 1.02, gy + ROAD_Y - 0.001, tint, mat, ft, 16, [0, 0, 0, 0]);
    if (n.hws > n.hw + 0.5) {
      const hull = [];
      for (const a of n.arms) {
        const p = a.r.p, i = a.i;
        for (const j of [i - 1, i + 1]) {
          if (j < 0 || j >= p.length) continue;
          const dx = p[j][0] - p[i][0], dz = p[j][1] - p[i][1], Ln = Math.hypot(dx, dz); if (Ln < 1e-3) continue;
          const ux = dx / Ln, uz = dz / Ln, d = Math.min(Ln * 0.5, n.hw + (a.r.sw || 0) + 0.6), w = a.r.w / 2 + (a.r.sw || 0);
          hull.push([n.x + ux * d - uz * w, n.z + uz * d + ux * w], [n.x + ux * d + uz * w, n.z + uz * d - ux * w]);
        }
      }
      const h = convexHull(hull);
      if (h.length >= 3) G.poly(h, [], gy + ROAD_Y - 0.003, fillTint, L.PAVERS, FT.PLAZA);
    }
  }
};
function convexHull(P) {
  const p = P.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]); if (p.length < 3) return p;
  const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], hi = [];
  for (const q of p) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (hi.length >= 2 && cr(hi[hi.length - 2], hi[hi.length - 1], q) <= 0) hi.pop(); hi.push(q); }
  hi.pop(); lo.pop(); return lo.concat(hi);
}

// ------------------------------------------------------------------ linear features
CITY.buildLines = function () {
  const ballast = tt(L.DIRT, '#6d6860'), steel = [1, 1, 1], sleeper = tt(L.PRECAST, '#6f6a62');
  for (const l of CITY.lines) {
    const p = l.p;
    if (l.kind === 'water') {
      const Lp = offsetOpen(p, l.w / 2), Rp = offsetOpen(p, -l.w / 2);
      for (let k = 0; k < p.length - 1; k++) CITY.water.quad([Lp[k][0], 0.04, Lp[k][1]], [Lp[k + 1][0], 0.04, Lp[k + 1][1]], [Rp[k + 1][0], 0.04, Rp[k + 1][1]], [Rp[k][0], 0.04, Rp[k][1]], [1, 1, 1], 0, 0, null, null, null, null, UP);
      // muddy banks
      for (let k = 0; k < p.length - 1; k++) CITY.ribbonSeg(CITY.tile(p[k][0], p[k][1]).f, p[k], p[k + 1], l.w + 2.2, 0.02, tt(L.DIRT, '#5a5040'), L.DIRT, FT.PATH, [0, 0, 0, 0]);
    } else if (l.kind === 'rail') {
      for (let k = 0; k < p.length - 1; k++) {
        const a = p[k], b = p[k + 1], G = CITY.tile(a[0], a[1]).f, Gb = CITY.tile(a[0], a[1]).b;
        CITY.ribbonSeg(G, a, b, 3.4, 0.06, ballast, L.DIRT, FT.BALLAST); CITY.disc(G, b, 1.7, 0.059, ballast, L.DIRT, FT.BALLAST, 8);
        const dx = b[0] - a[0], dz = b[1] - a[1], Ln = Math.hypot(dx, dz); if (Ln < 0.01) continue;
        const nx = -dz / Ln, nz = dx / Ln;
        for (let s = 0.3; s < Ln; s += 0.65) { const c = [a[0] + dx * s / Ln, a[1] + dz * s / Ln]; CITY.box(G, c[0], 0.06, c[1], 0.25, 0.1, 2.5, Math.atan2(dz, dx), sleeper, L.PRECAST, 0); }
        for (const off of [-0.72, 0.72]) { const pa = [a[0] + nx * off, a[1] + nz * off], pb = [b[0] + nx * off, b[1] + nz * off]; CITY.box(Gb, (pa[0] + pb[0]) / 2, 0.16, (pa[1] + pb[1]) / 2, Ln, 0.14, 0.07, Math.atan2(dz, dx), steel, L.PRECAST, FT.STEEL, null, null, FT.STEEL); }
      }
    } else if (l.kind === 'citywall' || l.kind === 'wall' || l.kind === 'fence' || l.kind === 'hedge') {
      const H = l.kind === 'citywall' ? (l.w < 1.0 ? 1.8 : 4.3) : l.kind === 'wall' ? 2.0 : l.kind === 'hedge' ? 1.3 : 1.5;
      const W = l.kind === 'citywall' ? 1.3 : l.kind === 'wall' ? 0.35 : l.kind === 'hedge' ? 0.9 : 0.05;
      const mat = l.kind === 'citywall' ? L.STONE : l.kind === 'wall' ? L.PLASTER_ROUGH : l.kind === 'hedge' ? L.GRASS : L.PRECAST;
      const tint = l.kind === 'citywall' ? tt(L.STONE, '#9c8f78') : l.kind === 'wall' ? tt(mat, '#b9b0a0') : l.kind === 'hedge' ? tt(L.GRASS, '#2f4a1c') : tt(mat, '#5a5a58');
      const ft = l.kind === 'citywall' ? FT.STONEWALL : l.kind === 'fence' ? FT.FENCE : l.kind === 'hedge' ? FT.FOLIAGE : 0;
      let u = 0;
      for (let k = 0; k < p.length - 1; k++) {
        const a = p[k], b = p[k + 1], dx = b[0] - a[0], dz = b[1] - a[1], Ln = Math.hypot(dx, dz); if (Ln < 0.05) continue;
        const G = CITY.tile(a[0], a[1]).b, nx = -dz / Ln * W / 2, nz = dx / Ln * W / 2;
        const g0 = CITY.groundH(a[0], a[1]), g1 = CITY.groundH(b[0], b[1]);
        const C = [[a[0] + nx, a[1] + nz], [b[0] + nx, b[1] + nz], [b[0] - nx, b[1] - nz], [a[0] - nx, a[1] - nz]];
        for (const [i0, i1, dn] of [[0, 1, [nx, 0, nz]], [2, 3, [-nx, 0, -nz]], [1, 2, [dx, 0, dz]], [3, 0, [-dx, 0, -dz]]]) {
          const q0 = C[i0], q1 = C[i1], h0 = (i0 === 0 || i0 === 3) ? g0 : g1, h1 = (i1 === 0 || i1 === 3) ? g0 : g1, len = Math.hypot(q1[0] - q0[0], q1[1] - q0[1]);
          const uu = i0 === 2 ? u + Ln : u, du = i0 === 2 ? -len : len;
          G.quad([q0[0], h0 - 0.3, q0[1]], [q1[0], h1 - 0.3, q1[1]], [q1[0], h1 + H, q1[1]], [q0[0], h0 + H, q0[1]], tint, mat, ft, [uu, 0, 1e4, H], [uu + du, 0, 1e4, H], [uu + du, H, 1e4, H], [uu, H, 1e4, H], dn);
        }
        G.quad([C[0][0], g0 + H, C[0][1]], [C[1][0], g1 + H, C[1][1]], [C[2][0], g1 + H, C[2][1]], [C[3][0], g0 + H, C[3][1]], l.kind === 'citywall' ? tt(L.STONE, '#8a806c') : tint, mat, l.kind === 'hedge' ? FT.FOLIAGE : 0, null, null, null, null, UP);
        if (l.kind !== 'hedge') { CITY.addEdge(C[0][0], C[0][1], C[1][0], C[1][1], H, 'wall'); CITY.addEdge(C[3][0], C[3][1], C[2][0], C[2][1], H, 'wall'); }
        else CITY.addEdge(a[0], a[1], b[0], b[1], H, 'wall');
        u += Ln;
      }
    }
  }
};

// ------------------------------------------------------------------ buildings
CITY.roofPlanes = function (bd, p) {
  const ang = bd.ang * Math.PI / 180, ux = Math.cos(ang), uz = Math.sin(ang), vx = -uz, vz = ux;
  let umin = 1e9, umax = -1e9, vmin = 1e9, vmax = -1e9;
  for (const q of p) { const u = q[0] * ux + q[1] * uz, v = q[0] * vx + q[1] * vz; umin = Math.min(umin, u); umax = Math.max(umax, u); vmin = Math.min(vmin, v); vmax = Math.max(vmax, v); }
  const W = Math.max(0.5, vmax - vmin), Ln = umax - umin, planes = [], rh = bd.rh;
  if (bd.roof >= 1 && bd.roof <= 3) {
    const s = rh / (W / 2);
    planes.push([s * vx, s * vz, -s * vmin]); planes.push([-s * vx, -s * vz, s * vmax]);
    if (bd.roof >= 2) { const se = bd.roof === 3 ? rh / (Ln / 2) : s; planes.push([se * ux, se * uz, -se * umin]); planes.push([-se * ux, -se * uz, se * umax]); }
  }
  return { planes, ux, uz, vx, vz, umin, umax, vmin, vmax, W, L: Ln };
};
CITY.evalRoof = function (planes, x, z) { if (!planes.length) return 0; let h = 1e9; for (const pl of planes) { const v = pl[0] * x + pl[1] * z + pl[2]; if (v < h) h = v; } return h; };
CITY.envelope = function (planes, a, b) {
  const ts = [0, 1], n = planes.length;
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
    const pi = planes[i], pj = planes[j];
    const d0 = (pi[0] * a[0] + pi[1] * a[1] + pi[2]) - (pj[0] * a[0] + pj[1] * a[1] + pj[2]);
    const d1 = (pi[0] * b[0] + pi[1] * b[1] + pi[2]) - (pj[0] * b[0] + pj[1] * b[1] + pj[2]);
    if ((d0 > 0) !== (d1 > 0) && Math.abs(d0 - d1) > 1e-9) { const t = d0 / (d0 - d1); if (t > 1e-4 && t < 1 - 1e-4) ts.push(t); }
  }
  return ts.sort((x, y) => x - y);
};

// realistic wall colour from the (pastel) palette colour
function wallTint(bd, mat) {
  const c = CITY.pal[bd.wall];
  let k = 0.78;
  if (bd.cat === 2) k = 0.72; else if (bd.cat === 3 || bd.cat === 10) k = 0.6; else if (bd.cat === 4 || bd.cat === 5) k = 0.7;
  const v = 0.94 + hash(bd.i * 31 + 7) * 0.12;
  return tintFor(mat, mulc(c, k * v));
}
const WALL_SPEC = { // cat -> [layer, facade type]
  0: [L.PLASTER, FT.HOUSE], 1: [L.PLASTER_ROUGH, FT.OLDTOWN], 2: [L.PLASTER, FT.PANEL], 3: [L.PRECAST, FT.GARAGE], 4: [L.CORRUGATED, FT.INDUSTRIAL],
  5: [L.CLADDING, FT.RETAIL], 6: [L.PLASTER_ROUGH, FT.CHURCH], 7: [L.PLASTER, FT.CIVIC], 8: [L.PLASTER_ROUGH, FT.HOUSE], 9: [L.PLASTER, FT.GREENHOUSE],
  10: [L.PRECAST, FT.GARAGE], 11: [L.PLASTER_ROUGH, FT.BELFRY], 12: [L.PLASTER, FT.KD],
};
CITY.buildBuilding = function (bd) {
  if (CITY.skip.has(bd.i)) return;
  if (bd.ov && CITY.customBuild) { CITY.customBuild(bd); return; }
  const t = CITY.tile(bd.c[0], bd.c[1]), G = t.b;
  let [wmat, wft] = WALL_SPEC[bd.cat] || [L.PLASTER, FT.HOUSE];
  if (bd.cat === 8) { if (hash(bd.i * 5) < 0.35) { wmat = L.PLASTER_ROUGH; wft = FT.PLANKS; } else wft = FT.PLAIN; }
  const lk = bd.look;
  if ((bd.cat === 0 || bd.cat === 1) && bd.fac === 4) wft = FT.SHOPS;
  if (bd.cat === 0 && !lk && hash(bd.i * 13) < 0.12) wmat = L.BRICK;
  if (bd.cat === 4 && !lk && hash(bd.i * 3) < 0.4) wmat = L.PRECAST;
  if (lk && lk.mat) wmat = L[lk.mat];
  if (lk && lk.ft !== undefined) wft = lk.ft;
  const wall = lk && lk.wall ? tt(wmat, lk.wall, 0.92) : wmat === L.BRICK ? tt(L.BRICK, '#8a4a36') : wallTint(bd, wmat);
  const roofMat = lk && lk.roofColor ? (lk.roofMat === 'grey' ? L.ROOF_GREY : L.ROOF_CLAY)
    : bd.cat === 9 ? L.PLASTER : (CITY.pal[bd.roofc][0] < 0.12 && CITY.pal[bd.roofc][2] > CITY.pal[bd.roofc][0] * 0.9) ? L.ROOF_GREY : L.ROOF_CLAY;
  const rc = CITY.pal[bd.roofc];
  const roofc = lk && lk.roofColor ? tt(roofMat, lk.roofColor, 0.85) : tintFor(roofMat, mulc(rc, roofMat === L.ROOF_CLAY ? 0.62 : 0.55));
  const base = bd.base, eaveY = base + bd.eave, ring = bd.p, holes = bd.holes || [], faE = lk && lk.blank ? 0 : bd.eave;
  const pitched = bd.roof >= 1 && bd.roof <= 3 && holes.length === 0;
  const RP = pitched ? CITY.roofPlanes(bd, ring) : { planes: [], ux: Math.cos(bd.ang * Math.PI / 180), uz: Math.sin(bd.ang * Math.PI / 180) };
  const planes = RP.planes;
  const baseY = base - (base > 0.1 ? 1.5 : 0.3);
  // street-facing walls get the entrance flag
  const doRing = (p, isHole) => {
    let bestI = -1, bestD = 1e9;
    const Ls = [];
    for (let i = 0; i < p.length; i++) {
      const a = p[i], b = p[(i + 1) % p.length], dx = b[0] - a[0], dz = b[1] - a[1], Ln = Math.hypot(dx, dz); Ls.push(Ln);
      if (Ln < 4 || isHole) continue;
      const mx = (a[0] + b[0]) / 2 + dz / Ln * 3, mz = (a[1] + b[1]) / 2 - dx / Ln * 3;
      const d = CITY.nearestRoadDist(mx, mz, [1, 2, 3, 4, 5], 30).d;
      if (d < bestD) { bestD = d; bestI = i; }
    }
    for (let i = 0; i < p.length; i++) {
      const a = p[i], b = p[(i + 1) % p.length], dx = b[0] - a[0], dz = b[1] - a[1], Ln = Ls[i];
      if (Ln < 0.02) continue;
      const dn = [dz / Ln, 0, -dx / Ln];
      const ts = CITY.envelope(planes, a, b);
      const wc = mulc(wall, 0.97 + hash(bd.i * 97 + i * 13) * 0.06);
      const ftw = wft + (i === bestI && bestD < 16 ? FLAG.A : 0);
      let prev = null;
      for (const tt2 of ts) {
        const x = a[0] + dx * tt2, z = a[1] + dz * tt2, h = Math.max(0, CITY.evalRoof(planes, x, z));
        const cur = { x, z, top: eaveY + h, u: tt2 * Ln };
        if (prev) G.quad([prev.x, baseY, prev.z], [cur.x, baseY, cur.z], [cur.x, cur.top, cur.z], [prev.x, prev.top, prev.z], wc, wmat, ftw,
          [prev.u, baseY - base, Ln, faE], [cur.u, baseY - base, Ln, faE], [cur.u, cur.top - base, Ln, faE], [prev.u, prev.top - base, Ln, faE], dn);
        prev = cur;
      }
      CITY.addEdge(a[0], a[1], b[0], b[1], bd.eave + bd.rh, 'b');
    }
  };
  doRing(ring, false); holes.forEach(h => doRing(h, true));
  if (bd.roof === 4) { // cone
    const O = offset(ring, 0.35), apex = [bd.c[0], eaveY + bd.rh, bd.c[1]];
    for (let i = 0; i < O.length; i++) { const a = O[i], b = O[(i + 1) % O.length]; G.tri([a[0], eaveY - 0.2, a[1]], [b[0], eaveY - 0.2, b[1]], apex, roofc, roofMat, FT.ROOF, null, null, null, [(a[0] + b[0]) / 2 - bd.c[0], 0.5, (a[1] + b[1]) / 2 - bd.c[1]]); }
    return;
  }
  if (!pitched) {
    const flatMat = bd.cat === 4 ? L.CORRUGATED : L.GRAVEL_ROOF, flatFt = bd.cat === 4 ? FT.METALROOF : FT.FLATROOF;
    G.poly(ring, holes, eaveY, bd.cat === 9 ? tt(L.PLASTER, '#aab8b0') : tt(flatMat, bd.cat === 4 ? '#8c8e8c' : '#6a6862'), bd.cat === 9 ? L.PLASTER : flatMat, bd.cat === 9 ? FT.GLASSROOF : flatFt);
    if (bd.cat !== 3 && bd.cat !== 8 && bd.cat !== 9 && bd.cat !== 10) { // parapet with coping
      const cop = tt(L.PRECAST, '#8e8c86'), ph = bd.cat === 0 || bd.cat === 1 ? 0.35 : 0.6;
      for (const p of [ring, ...holes]) for (let i = 0; i < p.length; i++) {
        const a = p[i], b = p[(i + 1) % p.length], Ln = Math.hypot(b[0] - a[0], b[1] - a[1]); if (Ln < 0.05) continue;
        const dn = [(b[1] - a[1]) / Ln, 0, -(b[0] - a[0]) / Ln];
        G.quad([a[0], eaveY, a[1]], [b[0], eaveY, b[1]], [b[0], eaveY + ph, b[1]], [a[0], eaveY + ph, a[1]], wall, wmat, 0, null, null, null, null, dn);
        G.quad([a[0], eaveY + ph, a[1]], [b[0], eaveY + ph, b[1]], [b[0] - dn[0] * 0.3, eaveY + ph, b[1] - dn[2] * 0.3], [a[0] - dn[0] * 0.3, eaveY + ph, a[1] - dn[2] * 0.3], cop, L.PRECAST, 0, null, null, null, null, UP);
        G.quad([b[0] - dn[0] * 0.3, eaveY + ph, b[1] - dn[2] * 0.3], [a[0] - dn[0] * 0.3, eaveY + ph, a[1] - dn[2] * 0.3], [a[0] - dn[0] * 0.3, eaveY, a[1] - dn[2] * 0.3], [b[0] - dn[0] * 0.3, eaveY, b[1] - dn[2] * 0.3], wall, wmat, 0, null, null, null, null, [-dn[0], 0, -dn[2]]);
      }
    }
    if ((bd.cat === 2 && bd.eave > 9) || (bd.cat === 5 && hash(bd.i) < 0.7) || (bd.cat === 7 && bd.eave > 7)) { // rooftop plant rooms / AC units
      CITY.box(G, bd.c[0], eaveY, bd.c[1], 3.2, 2.3, 2.6, bd.ang * Math.PI / 180, wall, wmat, 0, tt(L.GRAVEL_ROOF, '#666'), L.GRAVEL_ROOF, FT.FLATROOF);
      if (bd.cat !== 2) CITY.box(G, bd.c[0] + 4 * RP.ux, eaveY, bd.c[1] + 4 * RP.uz, 1.4, 1.0, 1.0, bd.ang * Math.PI / 180, [1, 1, 1], L.PRECAST, FT.STEEL, null, null, FT.STEEL);
    }
    return;
  }
  // ---- pitched roof with overhang, fascia and soffit
  const ov = bd.cat === 8 ? 0.25 : 0.45, O = offset(ring, ov);
  const rY = (x, z) => eaveY + CITY.evalRoof(planes, x, z);
  for (let i = 0; i < planes.length; i++) {
    let reg = O; const pi = planes[i];
    for (let j = 0; j < planes.length && reg.length >= 3; j++) { if (j === i) continue; const pj = planes[j]; reg = clipHalf(reg, pi[0] - pj[0], pi[1] - pj[1], pi[2] - pj[2]); }
    if (reg.length < 3) continue;
    G.poly(reg, [], (x, z) => eaveY + pi[0] * x + pi[1] * z + pi[2], roofc, roofMat, FT.ROOF);
  }
  const fasc = tt(L.PLASTER, bd.cat === 1 ? '#6a4a36' : '#5a5550'), soff = mulc(wall, 0.8);
  for (let i = 0; i < O.length; i++) {
    const a = O[i], b = O[(i + 1) % O.length], wa = ring[i], wb = ring[(i + 1) % ring.length];
    const dx = b[0] - a[0], dz = b[1] - a[1], Ln = Math.hypot(dx, dz); if (Ln < 0.02) continue;
    const dn = [dz / Ln, 0, -dx / Ln];
    const ts = CITY.envelope(planes, a, b);
    let prev = null;
    for (const tq of ts) {
      const x = a[0] + dx * tq, z = a[1] + dz * tq, y = rY(x, z);
      const wx = wa[0] + (wb[0] - wa[0]) * tq, wz = wa[1] + (wb[1] - wa[1]) * tq, wy = eaveY + Math.max(0, CITY.evalRoof(planes, wx, wz));
      const cur = [x, y, z, wx, wy, wz];
      if (prev) {
        G.quad([prev[0], prev[1] - 0.2, prev[2]], [x, y - 0.2, z], [x, y + 0.02, z], [prev[0], prev[1] + 0.02, prev[2]], fasc, L.PLASTER, 0, null, null, null, null, dn);
        G.quad([prev[3], prev[4], prev[5]], [wx, wy, wz], [x, y - 0.2, z], [prev[0], prev[1] - 0.2, prev[2]], soff, L.PLASTER, 0, null, null, null, null, [dn[0] * 0.3, -1, dn[2] * 0.3]);
      }
      prev = cur;
    }
  }
  // chimney
  if ((bd.cat === 0 || bd.cat === 1) && hash(bd.i * 7 + 3) < 0.6 && RP.L > 5) {
    const uu = RP.umin + (RP.umax - RP.umin) * (0.3 + hash(bd.i) * 0.4), vv = (RP.vmin + RP.vmax) / 2 + (hash(bd.i * 3) - 0.5) * RP.W * 0.3;
    const cx = uu * RP.ux + vv * RP.vx, cz = uu * RP.uz + vv * RP.vz;
    if (pip(cx, cz, ring)) {
      const h = rY(cx, cz), brick = hash(bd.i * 11) < 0.5;
      CITY.box(G, cx, h - 0.8, cz, 0.55, 1.9, 0.55, bd.ang * Math.PI / 180, brick ? tt(L.BRICK, '#7a3e2c') : wall, brick ? L.BRICK : wmat, 0, tt(L.PRECAST, '#3a3836'), L.PRECAST, 0);
      CITY.box(G, cx, h + 1.1, cz, 0.68, 0.1, 0.68, bd.ang * Math.PI / 180, tt(L.PRECAST, '#6a6862'), L.PRECAST, 0);
    }
  }
};

// ------------------------------------------------------------------ towers & landmarks
CITY.frontEnd = function (bd) {
  const RP = CITY.roofPlanes({ ang: bd.ang, roof: 1, rh: 1 }, bd.p), vm = (RP.vmin + RP.vmax) / 2;
  const e1 = [RP.umin * RP.ux + vm * RP.vx, RP.umin * RP.uz + vm * RP.vz], e2 = [RP.umax * RP.ux + vm * RP.vx, RP.umax * RP.uz + vm * RP.vz];
  const d1 = CITY.nearestRoadDist(e1[0], e1[1], [1, 2, 3, 5, 7]).d, d2 = CITY.nearestRoadDist(e2[0], e2[1], [1, 2, 3, 5, 7]).d;
  const front = d1 <= d2 ? e1 : e2, back = d1 <= d2 ? e2 : e1, dir = [back[0] - front[0], back[1] - front[1]], Ln = Math.hypot(dir[0], dir[1]) || 1;
  return { front, back, inward: [dir[0] / Ln, dir[1] / Ln], side: [RP.vx, RP.vz], W: RP.W, L: RP.L, ang: bd.ang * Math.PI / 180 };
};
CITY.tower = function (x, z, side, H, helmet, wallHex, helmHex, ang, base = 0, clock = true) {
  const G = CITY.tile(x, z).b;
  const wall = tt(L.PLASTER_ROUGH, wallHex, 0.8), helm = tt(L.PLASTER, helmHex, 0.75), slate = tt(L.ROOF_GREY, '#3e3e40');
  const P = CITY.box(G, x, base - 0.5, z, side, H + 0.5, side, ang, wall, L.PLASTER_ROUGH, FT.BELFRY);
  CITY.box(G, x, base + H - 0.1, z, side + 0.6, 0.5, side + 0.6, ang, mulc(wall, 0.92), L.PLASTER_ROUGH, 0);
  CITY.box(G, x, base + H * 0.55, z, side + 0.25, 0.3, side + 0.25, ang, mulc(wall, 0.92), L.PLASTER_ROUGH, 0);
  for (let i = 0; i < 4; i++) { const a = P[i], b = P[(i + 1) % 4]; CITY.addEdge(a[0], a[1], b[0], b[1], H, 'b'); }
  const top = base + H + 0.4;
  if (helmet === 'spire') {
    const n = 8, Rr = side * 0.62, SH = side * 2.4;
    for (let i = 0; i < n; i++) {
      const a0 = i / n * Math.PI * 2 + Math.PI / 8, a1 = (i + 1) / n * Math.PI * 2 + Math.PI / 8;
      G.tri([x + Math.cos(a0) * Rr, top, z + Math.sin(a0) * Rr], [x + Math.cos(a1) * Rr, top, z + Math.sin(a1) * Rr], [x, top + SH, z], slate, L.ROOF_GREY, FT.ROOF, null, null, null, [Math.cos((a0 + a1) / 2), 0.3, Math.sin((a0 + a1) / 2)]);
    }
    for (let i = 0; i < 4; i++) { const q = P[i], qx = x + (q[0] - x) * 0.85, qz = z + (q[1] - z) * 0.85; CITY.box(G, qx, top - 0.2, qz, 0.5, 1.2, 0.5, ang, wall, L.PLASTER_ROUGH, 0); CITY.coneAt(G, qx, top + 1.0, qz, 0.36, 1.5, 6, slate, L.ROOF_GREY, FT.ROOF); }
    CITY.cross(G, x, top + SH, z, 1.6);
  } else if (helmet === 'onion' || helmet === 'dome') {
    const r = side * 0.55;
    const prof = helmet === 'onion'
      ? [[r * 1.02, 0], [r * 1.05, 0.9], [r * 0.7, 1.7], [r * 0.9, 2.6], [r * 0.55, 3.6], [r * 0.18, 4.4], [r * 0.3, 4.9], [r * 0.34, 5.8], [r * 0.12, 6.9], [0.04, 8.6]]
      : [[r * 1.02, 0], [r * 1.0, 1.4], [r * 0.7, 2.6], [r * 0.2, 3.3], [0.05, 4.2]];
    const n = 12;
    for (let k = 0; k < prof.length - 1; k++) {
      const [r0, y0] = prof[k], [r1, y1] = prof[k + 1];
      for (let i = 0; i < n; i++) {
        const a0 = i / n * Math.PI * 2, a1 = (i + 1) / n * Math.PI * 2, am = (a0 + a1) / 2;
        const q00 = [x + Math.cos(a0) * r0, top + y0, z + Math.sin(a0) * r0], q01 = [x + Math.cos(a1) * r0, top + y0, z + Math.sin(a1) * r0];
        const q10 = [x + Math.cos(a0) * r1, top + y1, z + Math.sin(a0) * r1], q11 = [x + Math.cos(a1) * r1, top + y1, z + Math.sin(a1) * r1];
        G.quad(q00, q01, q11, q10, helm, L.PLASTER, FT.PATINA, null, null, null, null, [Math.cos(am) * (y1 - y0), (r0 - r1), Math.sin(am) * (y1 - y0)]);
      }
    }
    CITY.cross(G, x, top + prof[prof.length - 1][1], z, 1.4);
  } else if (helmet === 'pyramid') {
    const Rr = side * 0.75;
    for (let i = 0; i < 4; i++) {
      const a0 = i / 4 * Math.PI * 2 + Math.PI / 4 + ang, a1 = (i + 1) / 4 * Math.PI * 2 + Math.PI / 4 + ang;
      G.tri([x + Math.cos(a0) * Rr, top, z + Math.sin(a0) * Rr], [x + Math.cos(a1) * Rr, top, z + Math.sin(a1) * Rr], [x, top + side * 1.6, z], slate, L.ROOF_GREY, FT.ROOF, null, null, null, [Math.cos((a0 + a1) / 2), 0.5, Math.sin((a0 + a1) / 2)]);
    }
    CITY.cross(G, x, top + side * 1.6, z, 1.2);
  }
  if (clock) {
    const cy = base + H - 6.2, Rc = Math.min(1.1, side * 0.2);
    for (let i = 0; i < 4; i++) {
      const a = P[i], b = P[(i + 1) % 4], mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2;
      let nx = mx - x, nz = mz - z; const l = Math.hypot(nx, nz) || 1; nx /= l; nz /= l;
      const cx = mx + nx * 0.06, cz = mz + nz * 0.06, rx = nz, rz = -nx;
      for (let k = 0; k < 16; k++) {
        const a0 = k / 16 * Math.PI * 2, a1 = (k + 1) / 16 * Math.PI * 2;
        G.tri([cx, cy, cz], [cx + rx * Math.cos(a0) * Rc, cy + Math.sin(a0) * Rc, cz + rz * Math.cos(a0) * Rc], [cx + rx * Math.cos(a1) * Rc, cy + Math.sin(a1) * Rc, cz + rz * Math.cos(a1) * Rc],
          [1, 1, 1], L.PLASTER, FT.CLOCK, [0, 0, 0, 0], [Math.cos(a0), Math.sin(a0), 0, 0], [Math.cos(a1), Math.sin(a1), 0, 0], [nx, 0, nz]);
      }
    }
  }
};
CITY.statue = function (G, x, y, z, h, c, mat, ft = 0) {
  CITY.coneAt(G, x, y, z, h * 0.26, h * 0.72, 10, c, mat, ft);
  CITY.cylinder(G, x, y + h * 0.5, z, h * 0.12, h * 0.25, 8, c, mat, ft);
  CITY.cylinder(G, x, y + h * 0.78, z, h * 0.08, h * 0.16, 8, c, mat, ft);
};
CITY.buildLandmarks = function () {
  const skipLM = (CITY.over && CITY.over.landmarks && CITY.over.landmarks.skip) || [];
  const LMk = CITY.landmarks, B = (k) => LMk[k] !== undefined && !skipLM.includes(k) ? CITY.buildings[LMk[k]] : null;
  const churchTower = (k, cfg) => {
    const bd = B(k); if (!bd) return;
    const fe = CITY.frontEnd(bd), s = Math.min(cfg.side, fe.W * 0.55);
    if (cfg.twin) for (const sg of [-1, 1]) { const off = (fe.W / 2 - s / 2) * sg; CITY.tower(fe.front[0] + fe.inward[0] * s / 2 + fe.side[0] * off, fe.front[1] + fe.inward[1] * s / 2 + fe.side[1] * off, s, cfg.H, cfg.helmet, cfg.wall, cfg.helm, fe.ang, bd.base, cfg.clock !== false); }
    else CITY.tower(fe.front[0] + fe.inward[0] * s / 2, fe.front[1] + fe.inward[1] * s / 2, s, cfg.H, cfg.helmet, cfg.wall, cfg.helm, fe.ang, bd.base, cfg.clock !== false);
  };
  churchTower('michal', { side: 7.5, H: 36, helmet: 'spire', wall: '#d9c69c', helm: '#4b4746' });
  churchTower('jezuiti', { side: 5.5, H: 27, helmet: 'onion', wall: '#e8dfc8', helm: '#5f8a78', twin: true });
  churchTower('frantiskani', { side: 5.6, H: 29, helmet: 'onion', wall: '#ece3cc', helm: '#5f8a78' });
  churchTower('trojica', { side: 5.2, H: 24, helmet: 'onion', wall: '#ede4cf', helm: '#5f8a78' });
  churchTower('kriz', { side: 3.6, H: 13, helmet: 'onion', wall: '#efeae0', helm: '#6a6f6b', clock: false });
  churchTower('urban', { side: 3.6, H: 14, helmet: 'onion', wall: '#efeae0', helm: '#6a6f6b', clock: false });
  churchTower('pavol', { side: 2.6, H: 17, helmet: 'spire', wall: '#e8dfc8', helm: '#4b4746', clock: false });
  const rot = B('rotunda');
  if (rot) {
    const G = CITY.tile(rot.c[0], rot.c[1]).b, y = rot.base + rot.eave + rot.rh - 0.6;
    CITY.cylinder(G, rot.c[0], y, rot.c[1], 0.55, 1.1, 10, tt(L.PLASTER_ROUGH, '#d8d0bd', 0.8), L.PLASTER_ROUGH, 0);
    CITY.coneAt(G, rot.c[0], y + 1.1, rot.c[1], 0.8, 1.4, 10, tt(L.ROOF_GREY, '#4a4038'), L.ROOF_GREY, FT.ROOF);
    CITY.cross(G, rot.c[0], y + 2.5, rot.c[1], 1.0);
  }
  const kar = B('karner'); if (kar) CITY.cross(CITY.tile(kar.c[0], kar.c[1]).b, kar.c[0], kar.base + kar.eave + kar.rh, kar.c[1], 1.0);
  const kd = B('kd'); if (kd) CITY.mosaic(kd);
  const stone = tt(L.STONE, '#b8ad96'), stoneS = tt(L.PLASTER_ROUGH, '#c9c0ad', 0.8);
  for (const po of CITY.pois) {
    const G = CITY.tile(po.x, po.z).b, gy = CITY.groundH(po.x, po.z) + 0.03;
    if (skipLM.includes(po.n)) continue;
    if (po.n === 'Mariánsky stĺp') {
      CITY.box(G, po.x, gy, po.z, 3.4, 0.4, 3.4, 0.3, stone, L.STONE, 0);
      CITY.box(G, po.x, gy + 0.4, po.z, 2.6, 1.0, 2.6, 0.3, stoneS, L.PLASTER_ROUGH, 0);
      CITY.box(G, po.x, gy + 1.4, po.z, 1.9, 2.0, 1.9, 0.3, stoneS, L.PLASTER_ROUGH, 0);
      CITY.cylinder(G, po.x, gy + 3.4, po.z, 0.38, 6.5, 12, stoneS, L.PLASTER_ROUGH, 0);
      CITY.box(G, po.x, gy + 9.9, po.z, 1.0, 0.4, 1.0, 0.3, stoneS, L.PLASTER_ROUGH, 0);
      CITY.statue(G, po.x, gy + 10.3, po.z, 1.4, [1, 1, 1], L.PLASTER, FT.GOLD);
      CITY.addObst(po.x, po.z, 1.9, 'm');
    } else if (po.k === 'historic:memorial' && (po.n.startsWith('sv.') || po.n.startsWith('Panna'))) {
      CITY.box(G, po.x, gy, po.z, 1.3, 2.2, 1.3, 0.2, stoneS, L.PLASTER_ROUGH, 0); CITY.statue(G, po.x, gy + 2.2, po.z, 1.6, stoneS, L.PLASTER_ROUGH); CITY.addObst(po.x, po.z, 0.9, 'm');
    } else if (po.k === 'historic:memorial') {
      CITY.box(G, po.x, gy, po.z, 1.0, 1.7, 0.9, 0.4, stone, L.STONE, 0); CITY.statue(G, po.x, gy + 1.7, po.z, 0.9, tt(L.PRECAST, '#3f4a44'), L.PRECAST, FT.STEEL); CITY.addObst(po.x, po.z, 0.7, 'm');
    } else if (po.k === 'historic:wayside_shrine') {
      CITY.box(G, po.x, gy, po.z, 1.3, 2.3, 1.0, 0.5, tt(L.PLASTER, '#e9e4d8', 0.8), L.PLASTER, 0); CITY.gable(G, po.x, gy + 2.3, po.z, 1.6, 1.3, 0.9, 0.5, tt(L.ROOF_CLAY, '#a54a36', 0.6), L.ROOF_CLAY); CITY.addObst(po.x, po.z, 0.8, 'm');
    } else if (po.k === 'historic:wayside_cross' || po.k === 'man_made:cross') {
      CITY.box(G, po.x, gy, po.z, 0.7, 0.5, 0.7, 0, stone, L.STONE, 0); CITY.box(G, po.x, gy + 0.5, po.z, 0.16, 3.0, 0.16, 0, tt(L.PRECAST, '#3a3632'), L.PRECAST, FT.STEEL); CITY.box(G, po.x, gy + 2.6, po.z, 1.0, 0.14, 0.16, 0, tt(L.PRECAST, '#3a3632'), L.PRECAST, FT.STEEL);
    } else if (po.k === 'amenity:fountain') {
      CITY.cylinder(G, po.x, gy, po.z, 2.4, 0.55, 20, stone, L.STONE, 0, false);
      CITY.water.poly(Array.from({ length: 20 }, (_, i) => [po.x + Math.cos(i / 20 * Math.PI * 2) * 2.25, po.z + Math.sin(i / 20 * Math.PI * 2) * 2.25]).reverse(), [], gy + 0.45, [1, 1, 1], 0, 0);
      CITY.cylinder(G, po.x, gy, po.z, 0.35, 1.4, 10, stoneS, L.PLASTER_ROUGH, 0);
      CITY.addObst(po.x, po.z, 2.5, 'm');
    }
  }
  for (const e of [[-1, -136], [398, -226]]) { // historic wells
    const G = CITY.tile(e[0], e[1]).b, wood = tt(L.BARK, '#4a3626');
    CITY.cylinder(G, e[0], 0, e[1], 0.95, 0.9, 16, stone, L.STONE, 0, false);
    CITY.box(G, e[0] - 0.85, 0.9, e[1], 0.14, 1.6, 0.14, 0, wood, L.BARK, 0); CITY.box(G, e[0] + 0.85, 0.9, e[1], 0.14, 1.6, 0.14, 0, wood, L.BARK, 0);
    CITY.gable(G, e[0], 2.5, e[1], 2.3, 1.7, 0.75, 0, tt(L.ROOF_CLAY, '#8e4a3a', 0.6), L.ROOF_CLAY);
    CITY.addObst(e[0], e[1], 1.05, 'm');
  }
};
CITY.mosaic = function (bd) {
  const p = bd.p; let best = null;
  for (let i = 0; i < p.length; i++) {
    const a = p[i], b = p[(i + 1) % p.length], Ln = Math.hypot(b[0] - a[0], b[1] - a[1]); if (Ln < 8) continue;
    const mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2, d = CITY.nearestRoadDist(mx, mz, [1, 2, 3, 5]).d;
    if (!best || d < best.d) best = { d, a, b, L: Ln, mx, mz };
  }
  if (!best) return;
  const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 512; const ctx = cv.getContext('2d');
  ctx.fillStyle = '#d9c48a'; ctx.fillRect(0, 0, 1024, 512);
  const cols = ['#a22f27', '#2c5580', '#d7a932', '#3a6e43', '#efe8d8', '#5e3524'], rnd = rng(5);
  for (let i = 0; i < 9; i++) {
    const x = 60 + i * 112, y = 300;
    ctx.fillStyle = cols[i % 4]; ctx.beginPath(); ctx.moveTo(x, y); ctx.bezierCurveTo(x - 44, y - 80, x - 20, y - 140, x, y - 104); ctx.bezierCurveTo(x + 20, y - 140, x + 44, y - 80, x, y); ctx.fill();
    ctx.strokeStyle = '#3a6e43'; ctx.lineWidth = 10; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 140); ctx.stroke();
    ctx.fillStyle = '#3a6e43'; ctx.beginPath(); ctx.ellipse(x - 24, y + 80, 24, 10, -0.6, 0, Math.PI * 2); ctx.ellipse(x + 24, y + 60, 24, 10, 0.6, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = '#a22f27'; for (let i = 0; i < 16; i++) { ctx.beginPath(); ctx.arc(32 + i * 64, 44, 16 + rnd() * 6, 0, Math.PI * 2); ctx.fill(); }
  // mosaic tesserae
  const id = ctx.getImageData(0, 0, 1024, 512); for (let y = 0; y < 512; y++) for (let x = 0; x < 1024; x++) { if (x % 8 === 0 || y % 8 === 0) { const o = (y * 1024 + x) * 4; id.data[o] *= 0.7; id.data[o + 1] *= 0.7; id.data[o + 2] *= 0.7; } }
  ctx.putImageData(id, 0, 0);
  ctx.strokeStyle = '#5e3524'; ctx.lineWidth = 16; ctx.strokeRect(8, 8, 1008, 496);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  const w = Math.min(best.L * 0.55, 9), h = w * 0.5;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.35, metalness: 0.05 }));
  const nx = (best.b[1] - best.a[1]) / best.L, nz = -(best.b[0] - best.a[0]) / best.L;
  m.position.set(best.mx + nx * 0.06, bd.base + bd.eave - h / 2 - 0.6, best.mz + nz * 0.06);
  m.lookAt(m.position.x + nx, m.position.y, m.position.z + nz); m.receiveShadow = true;
  CITY.extraMeshes.push(m);
};

// ------------------------------------------------------------------ assemble
export async function buildCity(scene, D, onProgress = () => {}) {
  const t0 = performance.now();
  const tick = () => new Promise(r => setTimeout(r, 0));
  CITY.prepare(D); onProgress(0.1); await tick();
  CITY.buildGround(); onProgress(0.3); await tick();
  CITY.buildAreas(); CITY.buildRoads(); onProgress(0.5); await tick();
  CITY.buildLines();
  let n = 0;
  for (const bd of CITY.buildings) { CITY.buildBuilding(bd); if (++n % 1500 === 0) { onProgress(0.5 + 0.4 * n / CITY.buildings.length); await tick(); } }
  CITY.buildLandmarks(); onProgress(0.95);
  CITY.stats.buildMs = performance.now() - t0;
}
CITY.flush = function (scene, waterNormals) {
  const mat = WORLD.material; let tris = 0;
  for (const t of CITY.tiles.values()) {
    if (t.b.count) { const m = new THREE.Mesh(t.b.build(), mat); m.castShadow = true; m.receiveShadow = true; scene.add(m); tris += t.b.count / 3; }
    if (t.f.count) { const m = new THREE.Mesh(t.f.build(), mat); m.receiveShadow = true; scene.add(m); tris += t.f.count / 3; }
    t.b = t.f = null;
  }
  if (CITY.outerGeo) { const m = new THREE.Mesh(CITY.outerGeo.build(), mat); m.receiveShadow = false; scene.add(m); CITY.outerGeo = null; }
  if (CITY.water.count) {
    const wm = makeWaterMaterial(waterNormals);
    const m = new THREE.Mesh(CITY.water.build(), wm); m.receiveShadow = true;
    m.onBeforeRender = () => { wm.userData.uniforms.uTime.value = S.time; };
    scene.add(m); CITY.waterMesh = m;
  }
  for (const m of CITY.extraMeshes) scene.add(m);
  CITY.stats.tris = tris;
};
