// Procedural modern cars (fictional, unbranded). Car faces local +Z, +Y up, +X = car's left side.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { S } from '../core/state.js';

export const CAR_TYPES = ['hatch', 'sedan', 'kombi', 'suv', 'van'];
export const CAR_COLORS = ['#b9bcbf', '#8e9296', '#e8e8e6', '#f2f2ef', '#1c1d20', '#2b2f35', '#4a4f55', '#1f3a5f', '#2a4d7a', '#7a1f1f',
  '#a3282a', '#3b4a3a', '#6b5a45', '#c9c3b5', '#d9a441', '#2f6d8a'];

// dims: L length, W width, H height, wb wheelbase, r wheel radius, fo front overhang, belt, hood, roof profile (z fractions)
const SPEC = {
  hatch: { L: 4.10, W: 1.78, H: 1.47, wb: 2.56, r: 0.315, belt: 0.93, hood: 0.80, ws: 0.95, wsTop: 0.28, roofEnd: -1.55, rearTop: -1.72, rearBot: -1.95, trunk: 0, mass: 1250 },
  sedan: { L: 4.72, W: 1.82, H: 1.45, wb: 2.82, r: 0.325, belt: 0.92, hood: 0.78, ws: 1.05, wsTop: 0.12, roofEnd: -0.85, rearTop: -1.05, rearBot: -1.62, trunk: 0.02, mass: 1450 },
  kombi: { L: 4.72, W: 1.82, H: 1.50, wb: 2.82, r: 0.325, belt: 0.93, hood: 0.78, ws: 1.05, wsTop: 0.12, roofEnd: -2.05, rearTop: -2.2, rearBot: -2.33, trunk: 0, mass: 1500 },
  suv:   { L: 4.52, W: 1.87, H: 1.68, wb: 2.70, r: 0.36, belt: 1.06, hood: 0.98, ws: 1.02, wsTop: 0.22, roofEnd: -1.9, rearTop: -2.05, rearBot: -2.2, trunk: 0, mass: 1700 },
  van:   { L: 5.20, W: 2.00, H: 2.30, wb: 3.30, r: 0.34, belt: 1.10, hood: 1.02, ws: 0.95, wsTop: 0.8, roofEnd: -2.45, rearTop: -2.55, rearBot: -2.58, trunk: 0, mass: 2100, panel: true },
};

// ------------------------------------------------------------------ shared materials
let M = null;
function mats() {
  if (M) return M;
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x0a0e12, metalness: 0.1, roughness: 0.04, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 1.6 });
  const trim = new THREE.MeshStandardMaterial({ color: 0x151617, roughness: 0.55, metalness: 0.0 });
  const chrome = new THREE.MeshStandardMaterial({ color: 0xcfd2d6, roughness: 0.18, metalness: 1.0 });
  const tyre = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.92 });
  const rim = new THREE.MeshStandardMaterial({ color: 0xa9adb2, roughness: 0.3, metalness: 0.9, map: rimTexture() });
  const under = new THREE.MeshStandardMaterial({ color: 0x0c0c0c, roughness: 1 });
  const lens = new THREE.MeshPhysicalMaterial({ color: 0xdfe6ea, roughness: 0.05, metalness: 0.3, clearcoat: 1, emissive: 0xfff2dd, emissiveIntensity: 0 });
  const tail = new THREE.MeshStandardMaterial({ color: 0x5a0508, roughness: 0.2, metalness: 0.1, emissive: 0xff1a10, emissiveIntensity: 0 });
  const ind = new THREE.MeshStandardMaterial({ color: 0x6a4008, roughness: 0.2, emissive: 0xff8a10, emissiveIntensity: 0 });
  const interior = new THREE.MeshStandardMaterial({ color: 0x1b1b1d, roughness: 0.8 });
  M = { glass, trim, chrome, tyre, rim, under, lens, tail, ind, interior };
  return M;
}
function rimTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  g.fillStyle = '#222'; g.fillRect(0, 0, 128, 128);
  g.fillStyle = '#d8dadd'; g.beginPath(); g.arc(64, 64, 60, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#1a1a1a';
  for (let i = 0; i < 5; i++) { g.save(); g.translate(64, 64); g.rotate(i / 5 * Math.PI * 2); g.beginPath(); g.moveTo(8, -14); g.lineTo(50, -24); g.quadraticCurveTo(56, 0, 50, 24); g.lineTo(8, 14); g.closePath(); g.fill(); g.restore(); }
  g.fillStyle = '#9a9ea3'; g.beginPath(); g.arc(64, 64, 11, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#555'; g.lineWidth = 3; g.beginPath(); g.arc(64, 64, 58, 0, Math.PI * 2); g.stroke();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
function plateTexture(text) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 56; const g = c.getContext('2d');
  g.fillStyle = '#f4f4f0'; g.fillRect(0, 0, 256, 56); g.strokeStyle = '#111'; g.lineWidth = 3; g.strokeRect(2, 2, 252, 52);
  g.fillStyle = '#1f3f9a'; g.fillRect(3, 3, 30, 50); g.fillStyle = '#f7d117';
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; g.beginPath(); g.arc(18 + Math.cos(a) * 8, 20 + Math.sin(a) * 8, 1.5, 0, Math.PI * 2); g.fill(); }
  g.fillStyle = '#fff'; g.font = 'bold 13px sans-serif'; g.textAlign = 'center'; g.fillText('SK', 18, 47);
  g.fillStyle = '#111'; g.font = 'bold 38px "Arial Narrow", Arial, sans-serif'; g.textBaseline = 'middle'; g.fillText(text, 146, 30);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
export function randomPlate(rng = Math.random) {
  const Lt = 'ABCDEFHIJKLMNOPRSTUVXYZ', D = () => Math.floor(rng() * 10), A = () => Lt[Math.floor(rng() * Lt.length)];
  const r = rng();
  if (r < 0.62) return `SI-${D()}${D()}${D()}${A()}${A()}`;
  if (r < 0.85) return `${['SE', 'BA', 'TT', 'NR', 'MY', 'HO'][Math.floor(rng() * 6)]}-${D()}${D()}${D()}${A()}${A()}`;
  return `${A()}${A()}${D()}${D()}${D()}${A()}${A()}`;
}

// ------------------------------------------------------------------ body geometry (built once per type)
const GEO = {};
function extrudeProfile(shape, width, bevel) {
  const g = new THREE.ExtrudeGeometry(shape, { depth: Math.max(0.01, width - bevel * 2), bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel * 0.9, bevelSegments: 4, curveSegments: 10 });
  g.rotateY(-Math.PI / 2); // shape x -> car +z (forward), extrusion -> car -x
  g.translate(width / 2 - bevel, 0, 0);
  g.computeVertexNormals();
  return g;
}
function typeGeometry(type) {
  if (GEO[type]) return GEO[type];
  const s = SPEC[type], hl = s.L / 2, r = s.r, bev = 0.07;
  const zf = s.wb / 2 + 0.02, zr = -s.wb / 2 + 0.02;       // axle positions (slightly forward-biased)
  const sill = 0.30, arch = r + 0.06;
  // ---- lower body side profile (x = forward)
  const b = new THREE.Shape();
  b.moveTo(-hl + 0.06, sill + 0.05);
  b.lineTo(zr - arch, sill);
  b.absarc(zr, r, arch, Math.PI - Math.asin((sill - r) / arch), Math.asin((sill - r) / arch), true);
  b.lineTo(zf - arch, sill);
  b.absarc(zf, r, arch, Math.PI - Math.asin((sill - r) / arch), Math.asin((sill - r) / arch), true);
  b.lineTo(hl - 0.08, sill + 0.06);
  b.quadraticCurveTo(hl + 0.02, sill + 0.12, hl, sill + 0.3);                     // front bumper
  b.quadraticCurveTo(hl - 0.02, s.hood - 0.05, hl - 0.2, s.hood);                   // nose
  b.quadraticCurveTo(hl - s.ws * 0.5, s.hood + 0.08, hl - s.ws, s.belt);            // hood to windscreen base
  if (s.trunk) { b.lineTo(s.rearBot, s.belt + 0.02); b.quadraticCurveTo(-hl + 0.1, s.belt + 0.02, -hl + 0.02, s.belt - 0.1); }
  else b.lineTo(-hl + 0.12, s.belt);
  b.quadraticCurveTo(-hl - 0.02, s.belt - 0.2, -hl + 0.02, sill + 0.35);            // tail
  b.quadraticCurveTo(-hl - 0.01, sill + 0.08, -hl + 0.06, sill + 0.05);
  const body = extrudeProfile(b, s.W, bev);
  // ---- greenhouse (glass) and roof
  const inset = 0.09, gw = s.W - 0.22;
  const g = new THREE.Shape();
  const wsBase = hl - s.ws, wsTop = s.wsTop, rt = s.H - 0.06;
  g.moveTo(wsBase - 0.02, s.belt - 0.01);
  g.quadraticCurveTo((wsBase + wsTop) / 2 + 0.05, (s.belt + rt) / 2 + 0.05, wsTop, rt - 0.02);
  g.lineTo(s.roofEnd, rt - 0.02);
  g.quadraticCurveTo(s.rearTop, rt - 0.04, s.rearBot + (s.trunk ? 0.08 : 0), s.belt - 0.01);
  g.closePath();
  const glass = extrudeProfile(g, gw, 0.05);
  const rf = new THREE.Shape();
  const r0 = wsTop + (s.panel ? -0.05 : -0.12), r1 = s.roofEnd + 0.1;
  rf.moveTo(r0 + 0.25, rt - 0.04); rf.quadraticCurveTo(r0 + 0.05, rt - 0.03, r0, rt + 0.0);
  rf.lineTo(r0 - 0.05, rt + 0.035); rf.lineTo(r1 + 0.04, rt + 0.035); rf.quadraticCurveTo(r1 - 0.06, rt + 0.02, r1 - 0.08, rt - 0.05); rf.lineTo(r1 + 0.2, rt - 0.05); rf.closePath();
  const roof = extrudeProfile(rf, gw + 0.06, 0.04);
  // pillars (B-pillar and, for vans, a panel side replacing rear glass)
  const parts = [];
  if (s.panel) { // panel van: cargo box sides are body coloured
    const pv = new THREE.Shape(); const c0 = wsTop - 0.55;
    pv.moveTo(c0, s.belt - 0.02); pv.lineTo(c0, rt - 0.02); pv.lineTo(s.roofEnd, rt - 0.02); pv.quadraticCurveTo(s.rearTop, rt - 0.05, s.rearBot, s.belt - 0.02); pv.closePath();
    parts.push(extrudeProfile(pv, gw + 0.04, 0.05));
  } else {
    const bp = new THREE.BoxGeometry(gw + 0.035, rt - s.belt, 0.11); bp.translate(0, (rt + s.belt) / 2, (wsTop + s.roofEnd) / 2 + (type === 'hatch' ? 0.1 : 0.2)); parts.push(bp);
  }
  const bodyAll = mergeGeometries([body, roof, ...parts].map(x => x.index ? x.toNonIndexed() : x), false);
  // trims: bumpers, sills, grille
  const tr = [];
  const box = (w, h, d, x, y, z) => { const q = new THREE.BoxGeometry(w, h, d); q.translate(x, y, z); tr.push(q); };
  box(s.W - 0.1, 0.16, 0.12, 0, sill + 0.1, hl - 0.02); box(s.W - 0.1, 0.16, 0.12, 0, sill + 0.12, -hl + 0.04);
  box(s.W * 0.5, 0.12, 0.05, 0, s.hood - 0.26, hl - 0.03);                                                             // grille
  for (const sx of [1, -1]) box(0.05, 0.08, s.wb - 2 * arch - 0.1, sx * (s.W / 2 - 0.01), sill + 0.06, (zf + zr) / 2); // sills
  for (const sx of [1, -1]) { const q = new THREE.BoxGeometry(0.2, 0.1, 0.14); q.translate(sx * (s.W / 2 + 0.05), s.belt + 0.1, wsBase - 0.12); tr.push(q); } // mirrors
  const trim = mergeGeometries(tr.map(x => x.toNonIndexed()), false);
  // interior hint
  const it = [];
  const ib = (w, h, d, x, y, z) => { const q = new THREE.BoxGeometry(w, h, d); q.translate(x, y, z); it.push(q.toNonIndexed()); };
  ib(s.W - 0.3, 0.25, 0.4, 0, s.belt - 0.05, wsBase - 0.25);
  for (const sx of [1, -1]) { ib(0.5, 0.55, 0.12, sx * 0.4, s.belt - 0.1, wsBase - 1.2); ib(0.5, 0.12, 0.5, sx * 0.4, s.belt - 0.35, wsBase - 0.95); }
  const interior = mergeGeometries(it, false);
  // lamps
  const lamp = (w, h, d, x, y, z) => { const q = new THREE.BoxGeometry(w, h, d); q.translate(x, y, z); return q.toNonIndexed(); };
  const hy = s.hood - 0.12, ty = s.trunk ? s.belt - 0.12 : s.belt - 0.08;
  const head = mergeGeometries([lamp(0.42, 0.11, 0.1, s.W / 2 - 0.3, hy, hl - 0.12), lamp(0.42, 0.11, 0.1, -s.W / 2 + 0.3, hy, hl - 0.12)], false);
  const tail = mergeGeometries([lamp(0.34, 0.12, 0.08, s.W / 2 - 0.2, ty, -hl + 0.06), lamp(0.34, 0.12, 0.08, -s.W / 2 + 0.2, ty, -hl + 0.06), lamp(s.W * 0.4, 0.035, 0.05, 0, ty + 0.02, -hl + 0.05)], false);
  const indL = mergeGeometries([lamp(0.1, 0.06, 0.06, s.W / 2 - 0.08, hy - 0.08, hl - 0.1), lamp(0.08, 0.05, 0.06, s.W / 2 - 0.08, ty - 0.1, -hl + 0.07)], false);
  const indR = indL.clone(); indR.scale(-1, 1, 1);
  const plate = new THREE.PlaneGeometry(0.52, 0.114);
  GEO[type] = { body: bodyAll, glass, trim, interior, head, tail, indL, indR, plate, zf, zr, hy, ty };
  return GEO[type];
}
let WHEEL = null;
function wheelGeo(r, w) {
  const key = r.toFixed(3);
  WHEEL = WHEEL || {};
  if (WHEEL[key]) return WHEEL[key];
  const tyre = new THREE.CylinderGeometry(r, r, w, 24, 1, false); tyre.rotateZ(Math.PI / 2);
  const rim = new THREE.CircleGeometry(r * 0.72, 24); rim.rotateY(Math.PI / 2); rim.translate(w / 2 + 0.003, 0, 0);
  const rim2 = rim.clone(); rim2.rotateY(Math.PI);
  WHEEL[key] = { tyre, rim: mergeGeometries([rim, rim2], false) };
  return WHEEL[key];
}

export function createCar({ type = 'hatch', color = '#8a1a1a', seed = 1, plate = null } = {}) {
  const s = SPEC[type] || SPEC.hatch, G = typeGeometry(type), m = mats();
  const paint = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(color), metalness: 0.45, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.04, envMapIntensity: 1.1 });
  const group = new THREE.Group(), body = new THREE.Group(); group.add(body);
  const mk = (geo, mat, cast = true) => { const x = new THREE.Mesh(geo, mat); x.castShadow = cast; x.receiveShadow = true; body.add(x); return x; };
  mk(G.body, paint); mk(G.glass, m.glass); mk(G.trim, m.trim); mk(G.interior, m.interior, false);
  const head = m.lens.clone(), tail = m.tail.clone(), indL = m.ind.clone(), indR = m.ind.clone();
  mk(G.head, head, false); mk(G.tail, tail, false); mk(G.indL, indL, false); mk(G.indR, indR, false);
  const pl = plate || randomPlate(() => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; });
  const pm = new THREE.MeshStandardMaterial({ map: plateTexture(pl), roughness: 0.4 });
  const pf = mk(G.plate, pm, false); pf.position.set(0, s.hood - 0.32, s.L / 2 + 0.035);
  const pr = mk(G.plate, pm, false); pr.position.set(0, (s.trunk ? s.belt - 0.3 : s.belt - 0.35), -s.L / 2 - 0.02); pr.rotation.y = Math.PI;
  // wheels
  const wheels = [], WG = wheelGeo(s.r, 0.22);
  for (const [z, front] of [[G.zf, true], [G.zr, false]]) for (const side of [1, -1]) {
    const pivot = new THREE.Object3D(); pivot.position.set(side * (s.W / 2 - 0.16), s.r, z);
    const spin = new THREE.Object3D(); pivot.add(spin);
    const t = new THREE.Mesh(WG.tyre, m.tyre); t.castShadow = true; spin.add(t);
    const rr = new THREE.Mesh(WG.rim, m.rim); spin.add(rr);
    group.add(pivot);
    wheels.push({ pivot, spin, radius: s.r, front, side });
  }
  // contact shadow blob (cheap AO under the car)
  const blob = new THREE.Mesh(new THREE.PlaneGeometry(s.W + 0.3, s.L + 0.3), shadowBlobMat());
  blob.rotation.x = -Math.PI / 2; blob.position.y = 0.025; blob.renderOrder = 1; group.add(blob);
  let blink = 0, L0 = { head: 0, brake: false, reverse: false, left: false, right: false, hazard: false };
  const car = {
    type, group, body, wheels, paint, plate: pl,
    dims: { length: s.L, width: s.W, height: s.H, wheelBase: s.wb, track: s.W - 0.32, wheelRadius: s.r, mass: s.mass },
    seat: new THREE.Vector3(0.38, 0.42, G.zf - s.wb * 0.55), door: new THREE.Vector3(s.W / 2 + 0.55, 0, G.zf - s.wb * 0.45),
    headlights: [new THREE.Vector3(s.W / 2 - 0.3, G.hy, s.L / 2), new THREE.Vector3(-s.W / 2 + 0.3, G.hy, s.L / 2)],
    setLights(o) { Object.assign(L0, o); },
    update(dt) {
      blink = (blink + dt) % 0.8; const on = blink < 0.4, n = S.night;
      const auto = L0.head || (n > 0.3 ? 1 : 0);
      head.emissiveIntensity = auto ? (auto === 2 ? 22 : 12) : 0;
      tail.emissiveIntensity = (L0.brake ? 9 : 0) + (auto ? 2.5 : 0);
      indL.emissiveIntensity = ((L0.left || L0.hazard) && on) ? 8 : 0;
      indR.emissiveIntensity = ((L0.right || L0.hazard) && on) ? 8 : 0;
    },
    setColor(c) { paint.color.set(c); },
    dispose() { paint.dispose(); pm.map.dispose(); pm.dispose(); head.dispose(); tail.dispose(); indL.dispose(); indR.dispose(); },
  };
  return car;
}
let BLOB = null;
function shadowBlobMat() {
  if (BLOB) return BLOB;
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 4, 32, 32, 32); gr.addColorStop(0, 'rgba(0,0,0,0.75)'); gr.addColorStop(0.6, 'rgba(0,0,0,0.45)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  BLOB = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
  return BLOB;
}

// ------------------------------------------------------------------ instanced parked cars
// one merged geometry per type; attribute 'paint' = 1 on body panels (tinted by instance colour)
export function createCarInstancing() {
  const out = {};
  for (const type of CAR_TYPES) {
    const s = SPEC[type], G = typeGeometry(type), WG = wheelGeo(s.r, 0.22);
    const parts = [];
    const add = (geo, rgb, paint) => {
      const g = geo.index ? geo.toNonIndexed() : geo.clone();
      for (const k of Object.keys(g.attributes)) if (!['position', 'normal'].includes(k)) g.deleteAttribute(k);
      const n = g.attributes.position.count;
      g.setAttribute('color', new THREE.Float32BufferAttribute(new Array(n).fill(0).flatMap(() => rgb), 3));
      g.setAttribute('paint', new THREE.Float32BufferAttribute(new Array(n).fill(paint), 1));
      parts.push(g);
    };
    add(G.body, [1, 1, 1], 1); add(G.glass, [0.012, 0.016, 0.02], 0); add(G.trim, [0.02, 0.02, 0.02], 0);
    add(G.head, [0.7, 0.72, 0.72], 0); add(G.tail, [0.35, 0.01, 0.01], 0);
    for (const [z] of [[G.zf], [G.zr]]) for (const side of [1, -1]) {
      const t = WG.tyre.clone(); t.translate(side * (s.W / 2 - 0.16), s.r, z); add(t, [0.02, 0.02, 0.02], 0);
      const r = WG.rim.clone(); r.translate(side * (s.W / 2 - 0.16), s.r, z); add(r, [0.45, 0.46, 0.48], 0);
    }
    const geometry = mergeGeometries(parts, false);
    const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.25, metalness: 0.35, envMapIntensity: 1.2 });
    material.onBeforeCompile = (sh) => {
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float paint; varying float vPaint;')
        .replace('#include <color_vertex>', `#include <color_vertex>
vPaint = paint;
#ifdef USE_INSTANCING_COLOR
  vColor.xyz = paint > 0.5 ? instanceColor.xyz : color.xyz;
#else
  vColor.xyz = color.xyz;
#endif`);
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vPaint;')
        .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = vPaint > 0.5 ? 0.22 : (vColor.r < 0.03 ? 0.08 : 0.6);');
    };
    material.customProgramCacheKey = () => 'parked-car-v1';
    out[type] = { geometry, material, spec: s };
  }
  return out;
}
