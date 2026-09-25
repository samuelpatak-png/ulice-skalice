// Street furniture: street lamps (instanced poles, emissive heads, light pools on the ground, a few real lights near the player).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { S, Q } from '../core/state.js';
import { CITY } from './city.js';

export const PROPS = { lamps: [] };
const LAMP_H = 7.2, ARM = 1.25;

// Lamp types (D.lampsX): pole height, arm lengths (heads at the arm ends), extra lower heads [x, y].
// Entries are either the short car-park form [x, z, angleDeg, type] or the district `lamps` form
// { x, z, a (radians), t, h, arm, color } - there h overrides H, so one street can have 4.8 m lanterns
// while the lamps coming from the map data keep their fixed height.
const LOT_TYPES = {
  lot1: { H: 9.0, arms: [0.85] },                 // single LED head on a short arm
  lot2: { H: 9.0, arms: [0.85, -0.85] },          // T: two heads
  lot2h: { H: 9.6, arms: [0.35], low: [[-0.75, 7.3]] },   // post-top head plus a second one lower on the other side
  mast: { H: 10.5, arms: [1.6] },                 // tall street-type mast at the car-park edge
  street: { H: LAMP_H, arms: [ARM] },             // ordinary street lamp on a straight arm
  banana: { H: 8.0, arms: [1.1], banana: true },  // housing-estate lamp on a curved 'banana' arm
  // old-town cast-iron lamps with glass lanterns: heads [x, y, z] relative to the base
  lantern: { H: 3.7, style: 'lantern', heads: [[0, 3.75, 0]] },                                        // post-top lantern
  cand2: { H: 3.5, style: 'lantern', heads: [[-0.62, 3.55, 0], [0.62, 3.55, 0]], finial: true },         // two lanterns on scrolled arms
  cand3: { H: 3.9, style: 'lantern', heads: [[0, 4.25, 0], [-0.62, 3.6, 0], [0.62, 3.6, 0]] },
  cand5: { H: 4.4, style: 'lantern', heads: [[0, 4.75, 0], [0.7, 4.0, 0], [-0.7, 4.0, 0], [0, 4.0, 0.7], [0, 4.0, -0.7]] },
  wallLantern: { H: 3.2, style: 'wall', heads: [[0.55, 3.2, 0]] },      // lantern on a bracket, no post of its own
  catenary: { H: 6.5, style: 'catenary' },                              // luminaire hung on a span wire
};

// one lamp group -> an instanced pole mesh (+ lens mesh); headOff = lens positions in the local frame
function addLampMesh(scene, parts, lensParts, list, mat, lensMat, obstR, headOff, heads, m4, q, p, up, one) {
  const geo = mergeGeometries(parts.map(g => g.toNonIndexed()));
  const lgeo = lensParts.length ? mergeGeometries(lensParts.map(g => g.toNonIndexed())) : null;
  const im = new THREE.InstancedMesh(geo, mat, Math.max(1, list.length)); im.count = list.length;
  const li = lgeo ? new THREE.InstancedMesh(lgeo, lensMat, Math.max(1, list.length)) : null; if (li) li.count = list.length;
  list.forEach((l, i) => {
    q.setFromAxisAngle(up, -l.a); m4.compose(p.set(l.x, l.y, l.z), q, one);
    im.setMatrixAt(i, m4); if (li) li.setMatrixAt(i, m4);
    if (obstR) CITY.addObst(l.x, l.z, obstR, 'l');
    const ca = Math.cos(l.a), sa = Math.sin(l.a);
    for (const [hx, hy, hz] of headOff) heads.push({ x: l.x + ca * hx - sa * hz, z: l.z + sa * hx + ca * hz, y: l.y + hy });
  });
  im.castShadow = true; im.receiveShadow = true; im.computeBoundingSphere();
  scene.add(im);
  if (li) { li.computeBoundingSphere(); scene.add(li); }
}

export function buildProps(scene, D) {
  const L = D.lamps, lamps = [];
  for (let i = 0; i < L.length; i += 3) {
    const x = L[i] / 10, z = L[i + 1] / 10, a = L[i + 2] * Math.PI / 180;
    lamps.push({ x, z, a, hx: x + Math.cos(a) * ARM, hz: z + Math.sin(a) * ARM, y: CITY.groundH(x, z) });
    CITY.addObst(x, z, 0.16, 'l');
  }
  PROPS.lamps = lamps;
  // every light-emitting head (street lamps and car-park lamps): position of the lens
  const heads = lamps.map(l => ({ x: l.hx, z: l.hz, y: l.y + LAMP_H - 0.1 }));
  // ---- pole + arm + head (pole along +y, arm along +x)
  const pole = new THREE.CylinderGeometry(0.055, 0.085, LAMP_H, 8); pole.translate(0, LAMP_H / 2, 0);
  const base = new THREE.CylinderGeometry(0.13, 0.15, 0.6, 8); base.translate(0, 0.3, 0);
  const arm = new THREE.CylinderGeometry(0.035, 0.035, ARM, 6); arm.rotateZ(Math.PI / 2); arm.translate(ARM / 2, LAMP_H - 0.08, 0);
  const head = new THREE.BoxGeometry(0.62, 0.1, 0.26); head.translate(ARM, LAMP_H - 0.1, 0);
  const metal = mergeGeometries([pole, base, arm, head].map(g => g.toNonIndexed()));
  const lens = new THREE.BoxGeometry(0.54, 0.02, 0.2); lens.translate(ARM, LAMP_H - 0.16, 0);
  const n = lamps.length, m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), p = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1);
  const metalMat = new THREE.MeshStandardMaterial({ color: 0x3b3f42, roughness: 0.45, metalness: 0.7 });
  const lensMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.3, emissive: 0xffd7a0, emissiveIntensity: 0 });
  const poles = new THREE.InstancedMesh(metal, metalMat, Math.max(1, n)), lensI = new THREE.InstancedMesh(lens, lensMat, Math.max(1, n));
  poles.count = lensI.count = n;
  lamps.forEach((l, i) => { q.setFromAxisAngle(up, -l.a); m4.compose(p.set(l.x, l.y, l.z), q, one); poles.setMatrixAt(i, m4); lensI.setMatrixAt(i, m4); });
  poles.castShadow = true; poles.receiveShadow = true; poles.computeBoundingSphere(); lensI.computeBoundingSphere();
  scene.add(poles, lensI);
  // ---- car-park, historic and hand-placed lamps: one instanced pole mesh and one lens mesh per group
  // (group = type + height + arm + colour, so a district can set its own height without losing instancing)
  const X = D.lampsX || [], groups = {};
  for (const e of X) {
    const o = Array.isArray(e) ? { x: e[0], z: e[1], a: e[2] * Math.PI / 180, t: e[3] } : e;
    const T = LOT_TYPES[o.t] || LOT_TYPES.lot1;
    const h = o.h || T.H, arm = o.arm ?? (T.arms ? Math.abs(T.arms[0]) : 0);
    const key = `${o.t}|${h}|${arm}|${o.color || ''}`;
    const g = groups[key] || (groups[key] = { T, h, arm, color: o.color, list: [] });
    g.list.push({ x: o.x, z: o.z, a: o.a || 0, y: CITY.groundH(o.x, o.z) });
  }
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x8d9296, roughness: 0.5, metalness: 0.6 });
  const ironMat = new THREE.MeshStandardMaterial({ color: 0x1c1f21, roughness: 0.55, metalness: 0.5 });
  const tinted = {};
  const matFor = (hex, dark) => hex ? (tinted[hex] || (tinted[hex] = new THREE.MeshStandardMaterial({ color: new THREE.Color(hex), roughness: 0.5, metalness: 0.55 }))) : (dark ? ironMat : poleMat);
  // glass lantern on a cast-iron mount (used by the post-top, candelabra and wall-bracket types)
  const lantern = (parts, lensParts, hx, hy, hz) => {
    const bot = new THREE.CylinderGeometry(0.1, 0.06, 0.1, 8); bot.translate(hx, hy - 0.02, hz); parts.push(bot);
    const cap = new THREE.ConeGeometry(0.28, 0.26, 4); cap.rotateY(Math.PI / 4); cap.translate(hx, hy + 0.58, hz); parts.push(cap);
    const knob = new THREE.SphereGeometry(0.045, 6, 4); knob.translate(hx, hy + 0.74, hz); parts.push(knob);
    for (const [cx, cz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { const pst = new THREE.BoxGeometry(0.025, 0.44, 0.025); pst.translate(hx + cx * 0.15, hy + 0.25, hz + cz * 0.15); parts.push(pst); }
    const gl = new THREE.CylinderGeometry(0.19, 0.13, 0.42, 4, 1); gl.rotateY(Math.PI / 4); gl.translate(hx, hy + 0.25, hz); lensParts.push(gl);
  };
  for (const key in groups) {
    const { T, h, arm, color, list } = groups[key], parts = [], lensParts = [];
    const dh = h - T.H;                                   // the type is built at its own height, then stretched to h
    if (T.style === 'lantern' || T.style === 'wall') {     // cast-iron lanterns: stepped base, slim shaft, glass lanterns
      const hs = T.heads.map(([hx, hy, hz]) => [hx, hy + dh, hz]);
      if (T.style === 'lantern') {
        const b0 = new THREE.CylinderGeometry(0.2, 0.24, 0.35, 12); b0.translate(0, 0.175, 0); parts.push(b0);
        const b1 = new THREE.CylinderGeometry(0.12, 0.18, 0.75, 12); b1.translate(0, 0.72, 0); parts.push(b1);
        const sh = new THREE.CylinderGeometry(0.055, 0.075, h - 1.1, 10); sh.translate(0, 1.1 + (h - 1.1) / 2, 0); parts.push(sh);
        const ring = new THREE.TorusGeometry(0.09, 0.025, 6, 12); ring.rotateX(Math.PI / 2); ring.translate(0, 1.6, 0); parts.push(ring);
        if (T.finial) { const f = new THREE.ConeGeometry(0.06, 0.4, 8); f.translate(0, h + 0.2, 0); parts.push(f); }
      } else {                                             // wall bracket: back plate and a scrolled arm
        const pl = new THREE.BoxGeometry(0.16, 0.3, 0.06); pl.translate(0, h, 0); parts.push(pl);
        const a1 = new THREE.CylinderGeometry(0.03, 0.03, 0.55, 6); a1.rotateZ(Math.PI / 2); a1.translate(0.28, h + 0.22, 0); parts.push(a1);
        const a2 = new THREE.CylinderGeometry(0.025, 0.025, 0.28, 6); a2.translate(0.55, h + 0.1, 0); parts.push(a2);
      }
      for (const [hx, hy, hz] of hs) {
        const off = Math.hypot(hx, hz);
        if (off > 0.05 && T.style === 'lantern') {        // arm: gentle S-curve approximated by two straight tubes
          const a1 = new THREE.CylinderGeometry(0.03, 0.03, off, 6); a1.rotateZ(Math.PI / 2); a1.rotateY(-Math.atan2(hz, hx)); a1.translate(hx / 2, hy - 0.18, hz / 2); parts.push(a1);
          const a2 = new THREE.CylinderGeometry(0.025, 0.025, 0.4, 6); a2.translate(hx, hy - 0.2, hz); parts.push(a2);
        }
        lantern(parts, lensParts, hx, hy, hz);
      }
      addLampMesh(scene, parts, lensParts, list, matFor(color, true), lensMat, 0.25, hs.map(([hx, hy, hz]) => [hx, hy + 0.25, hz]), heads, m4, q, p, up, one);
      continue;
    }
    if (T.style === 'catenary') {                          // luminaire hanging from a span wire
      const rod = new THREE.CylinderGeometry(0.018, 0.018, 0.5, 5); rod.translate(0, h + 0.25, 0); parts.push(rod);
      const cone = new THREE.ConeGeometry(0.3, 0.2, 10); cone.translate(0, h - 0.06, 0); parts.push(cone);
      const ln = new THREE.CylinderGeometry(0.22, 0.22, 0.03, 10); ln.translate(0, h - 0.17, 0); lensParts.push(ln);
      addLampMesh(scene, parts, lensParts, list, matFor(color, true), lensMat, 0, [[0, h - 0.17, 0]], heads, m4, q, p, up, one);
      continue;
    }
    const arms = T.arms.map(a => Math.sign(a) * (arm || Math.abs(a)));
    const pl = new THREE.CylinderGeometry(0.065, 0.11, h, 10); pl.translate(0, h / 2, 0); parts.push(pl);
    const bs = new THREE.CylinderGeometry(0.16, 0.19, 0.7, 10); bs.translate(0, 0.35, 0); parts.push(bs);
    const hd = [...arms.map(a => [a, h - 0.1]), ...(T.low || []).map(([ax, ay]) => [ax, ay + dh])];
    for (const [ax, ay] of hd) {
      const la = Math.abs(ax), sg = Math.sign(ax || 1);
      if (la > 0.05) {
        if (T.banana) {                                    // curved arm: three tubes along a quarter arc
          for (let i = 0; i < 3; i++) {
            const t0 = i / 3, t1 = (i + 1) / 3;
            const x0 = sg * la * t0, y0 = ay + 0.55 * Math.sin(t0 * Math.PI / 2), x1 = sg * la * t1, y1 = ay + 0.55 * Math.sin(t1 * Math.PI / 2);
            const len = Math.hypot(x1 - x0, y1 - y0), ar = new THREE.CylinderGeometry(0.04, 0.04, len, 6);
            ar.rotateZ(Math.atan2(-(x1 - x0), y1 - y0));   // cylinder runs along +y: turn it onto the chord
            ar.translate((x0 + x1) / 2, (y0 + y1) / 2, 0); parts.push(ar);
          }
        } else { const ar = new THREE.CylinderGeometry(0.04, 0.04, la, 6); ar.rotateZ(Math.PI / 2); ar.translate(ax / 2, ay + 0.02, 0); parts.push(ar); }
      }
      const hy = T.banana ? ay + 0.55 : ay;
      const hb = new THREE.BoxGeometry(0.72, 0.12, 0.32); hb.translate(ax + sg * 0.2, hy, 0); parts.push(hb);
      const ln = new THREE.BoxGeometry(0.62, 0.02, 0.26); ln.translate(ax + sg * 0.2, hy - 0.07, 0); lensParts.push(ln);
    }
    addLampMesh(scene, parts, lensParts, list, matFor(color, false), lensMat, 0.2,
      hd.map(([ax, ay]) => [ax + Math.sign(ax || 1) * 0.2, (T.banana ? ay + 0.55 : ay) - 0.07, 0]), heads, m4, q, p, up, one);
  }
  const nh = heads.length;
  // ---- light pools: additive radial quads on the ground (cheap fake lighting)
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,0.55)'); gr.addColorStop(0.6, 'rgba(255,255,255,0.15)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  const poolTex = new THREE.CanvasTexture(c);
  const poolMat = new THREE.MeshBasicMaterial({ map: poolTex, color: 0xffc58a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -8, fog: true });
  const pq = new THREE.PlaneGeometry(15, 15); pq.rotateX(-Math.PI / 2);
  const pools = new THREE.InstancedMesh(pq, poolMat, Math.max(1, nh)); pools.count = nh;
  heads.forEach((h, i) => { m4.makeTranslation(h.x, CITY.groundH(h.x, h.z) + 0.2, h.z); pools.setMatrixAt(i, m4); });
  pools.computeBoundingSphere(); pools.renderOrder = 2; scene.add(pools);
  // ---- glow sprites around the heads (seen from afar)
  const glowGeo = new THREE.PlaneGeometry(1.6, 1.6);
  const glowShader = new THREE.ShaderMaterial({
    uniforms: { map: { value: poolTex }, uO: { value: 0 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `uniform float uO; varying vec2 vUv; void main(){ vUv = uv; vec4 mv = modelViewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0); float s = 0.6 + clamp(-mv.z / 90.0, 0.0, 1.4); mv.xy += position.xy * s; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform sampler2D map; uniform float uO; varying vec2 vUv; void main(){ vec4 t = texture2D(map, vUv); gl_FragColor = vec4(vec3(1.0, 0.82, 0.62) * t.a * t.a * uO * 1.3, 1.0); }`,
  });
  const glows = new THREE.InstancedMesh(glowGeo, glowShader, Math.max(1, nh)); glows.count = nh;
  heads.forEach((h, i) => { m4.makeTranslation(h.x, h.y - 0.15, h.z); glows.setMatrixAt(i, m4); });
  glows.computeBoundingSphere(); glows.frustumCulled = false; scene.add(glows);
  // ---- a few real point lights re-assigned to the lamps nearest to the player
  const nl = S.quality === 'low' ? 0 : S.quality === 'medium' ? 2 : 4;
  const lights = [];
  for (let i = 0; i < nl; i++) { const pl = new THREE.PointLight(0xffc890, 0, 22, 1.6); pl.castShadow = false; scene.add(pl); lights.push(pl); }
  let acc = 1;
  PROPS.update = (dt, pos) => {
    const k = S.night;
    lensMat.emissiveIntensity = 6 * k; poolMat.opacity = 0.55 * k; glowShader.uniforms.uO.value = k;
    pools.visible = glows.visible = k > 0.02;
    acc += dt;
    if (acc > 0.5 && lights.length) {
      acc = 0;
      const near = [];
      for (const h of heads) { const d = (h.x - pos.x) ** 2 + (h.z - pos.z) ** 2; if (d < 3600) near.push([d, h]); }
      near.sort((a, b) => a[0] - b[0]);
      lights.forEach((pl, i) => { const h = near[i] && near[i][1]; if (h) { pl.position.set(h.x, h.y - 0.3, h.z); pl.userData.on = 1; } else pl.userData.on = 0; });
    }
    for (const pl of lights) pl.intensity = pl.userData.on ? 55 * k : 0;
  };
  return PROPS;
}
