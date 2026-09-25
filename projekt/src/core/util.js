// Shared helpers: data decoding, 2D geometry, spatial hashing, geometry builder
import * as THREE from 'three';

export async function decodeData(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Nepodarilo sa načítať mapové dáta (' + res.status + ')');
  const buf = await res.arrayBuffer(), b = new Uint8Array(buf, 0, 2);
  if (b[0] !== 0x1f || b[1] !== 0x8b) return JSON.parse(new TextDecoder().decode(buf));   // host already decompressed it
  const ds = new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'));
  return JSON.parse(await new Response(ds).text());
}

// delta-encoded decimetre ints -> [[x,z],...] metres
export function pts(a) {
  const out = new Array(a.length / 2);
  let x = 0, z = 0;
  for (let i = 0, j = 0; i < a.length; i += 2, j++) { x += a[i]; z += a[i + 1]; out[j] = [x / 10, z / 10]; }
  return out;
}
export function hash(n) {
  n = (n ^ 61) ^ (n >>> 16); n = n + (n << 3); n = n ^ (n >>> 4);
  n = Math.imul(n, 0x27d4eb2d); n = n ^ (n >>> 15);
  return (n >>> 0) / 4294967296;
}
export function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}
export function area(p) {
  let a = 0;
  for (let i = 0, n = p.length; i < n; i++) { const q = p[i], r = p[(i + 1) % n]; a += q[0] * r[1] - r[0] * q[1]; }
  return a / 2;
}
export function centroid(p) { let x = 0, z = 0; for (const v of p) { x += v[0]; z += v[1]; } return [x / p.length, z / p.length]; }
export function pip(x, z, p) {
  let inside = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const xi = p[i][0], zi = p[i][1], xj = p[j][0], zj = p[j][1];
    if (((zi > z) !== (zj > z)) && (x < (xj - xi) * (z - zi) / (zj - zi + 1e-12) + xi)) inside = !inside;
  }
  return inside;
}
export function segDist(x, z, ax, az, bx, bz) {
  const vx = bx - ax, vz = bz - az, L2 = vx * vx + vz * vz;
  let t = L2 < 1e-9 ? 0 : ((x - ax) * vx + (z - az) * vz) / L2; t = t < 0 ? 0 : t > 1 ? 1 : t;
  return Math.hypot(x - (ax + t * vx), z - (az + t * vz));
}
export function segClosest(x, z, ax, az, bx, bz) {
  const vx = bx - ax, vz = bz - az, L2 = vx * vx + vz * vz;
  let t = L2 < 1e-9 ? 0 : ((x - ax) * vx + (z - az) * vz) / L2; t = t < 0 ? 0 : t > 1 ? 1 : t;
  return [ax + t * vx, az + t * vz, t];
}
export function clipHalf(poly, a, b, c) {
  const out = [], n = poly.length;
  if (!n) return out;
  for (let i = 0; i < n; i++) {
    const cur = poly[i], prev = poly[(i + n - 1) % n];
    const dc = a * cur[0] + b * cur[1] + c, dp = a * prev[0] + b * prev[1] + c;
    if (dc <= 1e-7) {
      if (dp > 1e-7) { const t = dp / (dp - dc); out.push([prev[0] + (cur[0] - prev[0]) * t, prev[1] + (cur[1] - prev[1]) * t]); }
      out.push(cur);
    } else if (dp <= 1e-7) { const t = dp / (dp - dc); out.push([prev[0] + (cur[0] - prev[0]) * t, prev[1] + (cur[1] - prev[1]) * t]); }
  }
  return dedupe(out);
}
export function dedupe(p) {
  const out = [];
  for (const v of p) { const l = out[out.length - 1]; if (!l || Math.abs(l[0] - v[0]) > 1e-4 || Math.abs(l[1] - v[1]) > 1e-4) out.push(v); }
  while (out.length > 1) { const a = out[0], b = out[out.length - 1]; if (Math.abs(a[0] - b[0]) < 1e-4 && Math.abs(a[1] - b[1]) < 1e-4) out.pop(); else break; }
  return out;
}
export function offset(p, d) {
  const n = p.length, out = [];
  for (let i = 0; i < n; i++) {
    const a = p[(i + n - 1) % n], b = p[i], c = p[(i + 1) % n];
    let e1x = b[0] - a[0], e1z = b[1] - a[1]; const l1 = Math.hypot(e1x, e1z) || 1; e1x /= l1; e1z /= l1;
    let e2x = c[0] - b[0], e2z = c[1] - b[1]; const l2 = Math.hypot(e2x, e2z) || 1; e2x /= l2; e2z /= l2;
    const n1x = e1z, n1z = -e1x, n2x = e2z, n2z = -e2x;
    let mx = n1x + n2x, mz = n1z + n2z; const ml = Math.hypot(mx, mz);
    if (ml < 1e-6) { mx = n1x; mz = n1z; } else { mx /= ml; mz /= ml; }
    const k = d / Math.max(mx * n1x + mz * n1z, 0.35);
    out.push([b[0] + mx * k, b[1] + mz * k]);
  }
  return out;
}
const _c = new THREE.Color();
export function col(hex) { _c.set(hex); return [_c.r, _c.g, _c.b]; }   // linear working space
export const mulc = (c, k) => [c[0] * k, c[1] * k, c[2] * k];
export const mixc = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

// ---------------------------------------------------------------------------
// Geometry builder for the world material.
//   color: tint (linear), mat: texture layer, fa: facade params (u, v, wallLen, eave), ft: facade/surface type
// ---------------------------------------------------------------------------
export class Geo {
  constructor() { this.pos = []; this.nor = []; this.col = []; this.mat = []; this.fa = []; this.ft = []; }
  get count() { return this.pos.length / 3; }
  tri(p0, p1, p2, c, mat, ft = 0, f0 = null, f1 = null, f2 = null, dn = null) {
    const ux = p1[0] - p0[0], uy = p1[1] - p0[1], uz = p1[2] - p0[2];
    const vx = p2[0] - p0[0], vy = p2[1] - p0[1], vz = p2[2] - p0[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz); if (l < 1e-10) return;
    nx /= l; ny /= l; nz /= l;
    if (dn && nx * dn[0] + ny * dn[1] + nz * dn[2] < 0) { const t = p1; p1 = p2; p2 = t; const tf = f1; f1 = f2; f2 = tf; nx = -nx; ny = -ny; nz = -nz; }
    this.pos.push(p0[0], p0[1], p0[2], p1[0], p1[1], p1[2], p2[0], p2[1], p2[2]);
    this.nor.push(nx, ny, nz, nx, ny, nz, nx, ny, nz);
    this.col.push(c[0], c[1], c[2], c[0], c[1], c[2], c[0], c[1], c[2]);
    this.mat.push(mat, mat, mat); this.ft.push(ft, ft, ft);
    const z = Z4; f0 = f0 || z; f1 = f1 || z; f2 = f2 || z;
    this.fa.push(f0[0], f0[1], f0[2], f0[3], f1[0], f1[1], f1[2], f1[3], f2[0], f2[1], f2[2], f2[3]);
  }
  quad(a, b, c, d, col, mat, ft, fa, fb, fc, fd, dn) { this.tri(a, b, c, col, mat, ft, fa, fb, fc, dn); this.tri(a, c, d, col, mat, ft, fa, fc, fd, dn); }
  poly(outer, holes, yf, c, mat, ft, fav = null, down = false) {
    const contour = outer.map(v => new THREE.Vector2(v[0], v[1]));
    const hs = (holes || []).map(h => h.map(v => new THREE.Vector2(v[0], v[1])));
    let faces; try { faces = THREE.ShapeUtils.triangulateShape(contour, hs); } catch (e) { return; }
    const all = outer.concat(...(holes || []));
    const dn = down ? [0, -1, 0] : [0, 1, 0];
    const yy = typeof yf === 'function' ? yf : () => yf;
    for (const f of faces) {
      const a = all[f[0]], b = all[f[1]], cc = all[f[2]]; if (!a || !b || !cc) continue;
      this.tri([a[0], yy(a[0], a[1]), a[1]], [b[0], yy(b[0], b[1]), b[1]], [cc[0], yy(cc[0], cc[1]), cc[1]], c, mat, ft, fav, fav, fav, dn);
    }
  }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setAttribute('mat', new THREE.Float32BufferAttribute(this.mat, 1));
    g.setAttribute('fa', new THREE.Float32BufferAttribute(this.fa, 4));
    g.setAttribute('ft', new THREE.Float32BufferAttribute(this.ft, 1));
    g.computeBoundingSphere(); g.computeBoundingBox();
    return g;
  }
}
const Z4 = [0, 0, 0, 0];

export class Grid2D {
  constructor(cell) { this.cell = cell; this.m = new Map(); }
  addBox(x0, z0, x1, z1, item) {
    const c = this.cell;
    for (let ix = Math.floor(x0 / c); ix <= Math.floor(x1 / c); ix++)
      for (let iz = Math.floor(z0 / c); iz <= Math.floor(z1 / c); iz++) {
        const k = ix * 100003 + iz; let a = this.m.get(k); if (!a) { a = []; this.m.set(k, a); } a.push(item);
      }
  }
  query(x0, z0, x1, z1, out) {
    const c = this.cell, stamp = ++STAMP.v;
    for (let ix = Math.floor(x0 / c); ix <= Math.floor(x1 / c); ix++)
      for (let iz = Math.floor(z0 / c); iz <= Math.floor(z1 / c); iz++) {
        const a = this.m.get(ix * 100003 + iz); if (!a) continue;
        for (const it of a) { if (it._s === stamp) continue; it._s = stamp; out.push(it); }
      }
    return out;
  }
}
export const STAMP = { v: 1 };
export const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
export const lerp = (a, b, t) => a + (b - a) * t;
export const angDiff = (a, b) => { let d = b - a; return Math.atan2(Math.sin(d), Math.cos(d)); };
