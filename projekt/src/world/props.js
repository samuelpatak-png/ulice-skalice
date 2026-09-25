// Street furniture: street lamps (instanced poles, emissive heads, light pools on the ground, a few real lights near the player).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { S, Q } from '../core/state.js';
import { CITY } from './city.js';

export const PROPS = { lamps: [] };
const LAMP_H = 7.2, ARM = 1.25;

// car-park lamps (D.lampsX: [x, z, angleDeg, type]): pole height, arm lengths (heads at the arm ends), extra lower heads [x, y]
const LOT_TYPES = {
  lot1: { H: 9.0, arms: [0.85] },                 // single LED head on a short arm
  lot2: { H: 9.0, arms: [0.85, -0.85] },          // T: two heads
  lot2h: { H: 9.6, arms: [0.35], low: [[-0.75, 7.3]] },   // post-top head plus a second one lower on the other side
  mast: { H: 10.5, arms: [1.6] },                 // tall street-type mast at the car-park edge
  // old-town cast-iron lamps with glass lanterns: heads [x, y, z] relative to the base
  lantern: { H: 3.7, style: 'lantern', heads: [[0, 3.75, 0]] },                                        // post-top lantern
  cand2: { H: 3.5, style: 'lantern', heads: [[-0.62, 3.55, 0], [0.62, 3.55, 0]], finial: true },         // two lanterns on scrolled arms
  cand3: { H: 3.9, style: 'lantern', heads: [[0, 4.25, 0], [-0.62, 3.6, 0], [0.62, 3.6, 0]] },
  cand5: { H: 4.4, style: 'lantern', heads: [[0, 4.75, 0], [0.7, 4.0, 0], [-0.7, 4.0, 0], [0, 4.0, 0.7], [0, 4.0, -0.7]] },
};

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
  // ---- car-park lamps: one instanced pole mesh and one lens mesh per type
  const X = D.lampsX || [], byType = {};
  for (const [x, z, deg, t] of X) (byType[t] || (byType[t] = [])).push({ x, z, a: deg * Math.PI / 180, y: CITY.groundH(x, z) });
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x8d9296, roughness: 0.5, metalness: 0.6 });
  const ironMat = new THREE.MeshStandardMaterial({ color: 0x1c1f21, roughness: 0.55, metalness: 0.5 });
  for (const t in byType) {
    const T = LOT_TYPES[t] || LOT_TYPES.lot1, list = byType[t], parts = [], lensParts = [];
    if (T.style === 'lantern') { // cast-iron post: stepped base, slim shaft, scrolled arms, glass lanterns with caps
      const H = T.H;
      const b0 = new THREE.CylinderGeometry(0.2, 0.24, 0.35, 12); b0.translate(0, 0.175, 0); parts.push(b0);
      const b1 = new THREE.CylinderGeometry(0.12, 0.18, 0.75, 12); b1.translate(0, 0.72, 0); parts.push(b1);
      const sh = new THREE.CylinderGeometry(0.055, 0.075, H - 1.1, 10); sh.translate(0, 1.1 + (H - 1.1) / 2, 0); parts.push(sh);
      const ring = new THREE.TorusGeometry(0.09, 0.025, 6, 12); ring.rotateX(Math.PI / 2); ring.translate(0, 1.6, 0); parts.push(ring);
      if (T.finial) { const f = new THREE.ConeGeometry(0.06, 0.4, 8); f.translate(0, H + 0.2, 0); parts.push(f); }
      for (const [hx, hy, hz] of T.heads) {
        const off = Math.hypot(hx, hz);
        if (off > 0.05) { // arm: gentle S-curve approximated by two straight tubes
          const a1 = new THREE.CylinderGeometry(0.03, 0.03, off, 6); a1.rotateZ(Math.PI / 2); a1.rotateY(-Math.atan2(hz, hx)); a1.translate(hx / 2, hy - 0.18, hz / 2); parts.push(a1);
          const a2 = new THREE.CylinderGeometry(0.025, 0.025, 0.4, 6); a2.translate(hx, hy - 0.2, hz); parts.push(a2);
        }
        const bot = new THREE.CylinderGeometry(0.1, 0.06, 0.1, 8); bot.translate(hx, hy - 0.02, hz); parts.push(bot);
        const cap = new THREE.ConeGeometry(0.28, 0.26, 4); cap.rotateY(Math.PI / 4); cap.translate(hx, hy + 0.58, hz); parts.push(cap);
        const knob = new THREE.SphereGeometry(0.045, 6, 4); knob.translate(hx, hy + 0.74, hz); parts.push(knob);
        for (const [cx, cz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { const pst = new THREE.BoxGeometry(0.025, 0.44, 0.025); pst.translate(hx + cx * 0.15, hy + 0.25, hz + cz * 0.15); parts.push(pst); }
        const gl = new THREE.CylinderGeometry(0.19, 0.13, 0.42, 4, 1); gl.rotateY(Math.PI / 4); gl.translate(hx, hy + 0.25, hz); lensParts.push(gl);
      }
      const geo = mergeGeometries(parts.map(g => g.toNonIndexed())), lgeo = mergeGeometries(lensParts.map(g => g.toNonIndexed()));
      const im = new THREE.InstancedMesh(geo, ironMat, list.length), li = new THREE.InstancedMesh(lgeo, lensMat, list.length);
      list.forEach((l, i) => {
        q.setFromAxisAngle(up, -l.a); m4.compose(p.set(l.x, l.y, l.z), q, one); im.setMatrixAt(i, m4); li.setMatrixAt(i, m4);
        CITY.addObst(l.x, l.z, 0.25, 'l');
        const ca = Math.cos(l.a), sa = Math.sin(l.a);
        for (const [hx, hy, hz] of T.heads) heads.push({ x: l.x + ca * hx - sa * hz, z: l.z + sa * hx + ca * hz, y: l.y + hy + 0.25 });
      });
      im.castShadow = true; im.receiveShadow = true; im.computeBoundingSphere(); li.computeBoundingSphere();
      scene.add(im, li);
      continue;
    }
    const pl = new THREE.CylinderGeometry(0.065, 0.11, T.H, 10); pl.translate(0, T.H / 2, 0); parts.push(pl);
    const bs = new THREE.CylinderGeometry(0.16, 0.19, 0.7, 10); bs.translate(0, 0.35, 0); parts.push(bs);
    const hd = [...T.arms.map(a => [a, T.H - 0.1]), ...(T.low || [])];
    for (const [ax, ay] of hd) {
      const la = Math.abs(ax);
      if (la > 0.05) { const ar = new THREE.CylinderGeometry(0.04, 0.04, la, 6); ar.rotateZ(Math.PI / 2); ar.translate(ax / 2, ay + 0.02, 0); parts.push(ar); }
      const hb = new THREE.BoxGeometry(0.72, 0.12, 0.32); hb.translate(ax + Math.sign(ax || 1) * 0.2, ay, 0); parts.push(hb);
      const ln = new THREE.BoxGeometry(0.62, 0.02, 0.26); ln.translate(ax + Math.sign(ax || 1) * 0.2, ay - 0.07, 0); lensParts.push(ln);
    }
    const geo = mergeGeometries(parts.map(g => g.toNonIndexed())), lgeo = mergeGeometries(lensParts.map(g => g.toNonIndexed()));
    const im = new THREE.InstancedMesh(geo, poleMat, list.length), li = new THREE.InstancedMesh(lgeo, lensMat, list.length);
    list.forEach((l, i) => {
      q.setFromAxisAngle(up, -l.a); m4.compose(p.set(l.x, l.y, l.z), q, one); im.setMatrixAt(i, m4); li.setMatrixAt(i, m4);
      CITY.addObst(l.x, l.z, 0.2, 'l');
      for (const [ax, ay] of hd) { const hx = ax + Math.sign(ax || 1) * 0.2; heads.push({ x: l.x + Math.cos(l.a) * hx, z: l.z + Math.sin(l.a) * hx, y: l.y + ay }); }
    });
    im.castShadow = true; im.receiveShadow = true; im.computeBoundingSphere(); li.computeBoundingSphere();
    scene.add(im, li);
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
