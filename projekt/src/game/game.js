// Gameplay: input, player on foot, driving physics, 3rd-person camera, collisions.
import * as THREE from 'three';
import { S } from '../core/state.js';
import { clamp, lerp, angDiff, segDist, segClosest, pip } from '../core/util.js';
import { CITY, ROAD_Y, WALK_Y } from '../world/city.js';
import { createCar, createCarInstancing, CAR_COLORS, CAR_TYPES } from '../actors/carmodel.js';
import { Grid2D, hash, rng } from '../core/util.js';
import { createPlayer } from '../actors/human.js';
import { AUDIO } from '../core/audio.js';

export const GAME = {
  keys: {}, mode: 'walk', pos: new THREE.Vector3(), heading: 0, speed: 0,
  camYaw: 0, camPitch: 0.22, camDist: 4.4, lastMouse: -10, look: { x: 0, y: 0 },
  car: null, cars: [], joy: { x: 0, y: 0, on: false }, events: [],
};
const _v = new THREE.Vector3(), _w = new THREE.Vector3();

// ------------------------------------------------------------------ surface height (road vs raised sidewalk)
export function surfaceY(x, z) {
  const g = CITY.groundH(x, z);
  const out = CITY.rgrid.query(x - 12, z - 12, x + 12, z + 12, []);
  let best = 0, onRoad = false;
  for (const s of out) {
    const r = s.r; if (r.k > 5) continue;
    const d = segDist(x, z, s.ax, s.az, s.bx, s.bz), hw = r.w / 2;
    if (d < hw) { onRoad = true; break; }
    if (r.sw && d < hw + r.sw) best = WALK_Y;
  }
  return g + (onRoad ? ROAD_Y : best || 0.0);
}

// ------------------------------------------------------------------ collisions (circle vs building edges / obstacles)
const _q = [];
export function collideCircle(p, r, withObst = true) {
  let hit = 0, nx = 0, nz = 0;
  _q.length = 0; CITY.edges.query(p.x - r - 1, p.z - r - 1, p.x + r + 1, p.z + r + 1, _q);
  for (let it = 0; it < 2; it++) for (const e of _q) {
    const c = segClosest(p.x, p.z, e.ax, e.az, e.bx, e.bz), dx = p.x - c[0], dz = p.z - c[1], d = Math.hypot(dx, dz);
    if (d < r && d > 1e-6) { const k = (r - d) / d; p.x += dx * k; p.z += dz * k; hit++; nx += dx / d; nz += dz / d; }
  }
  if (withObst) {
    _q.length = 0; CITY.obst.query(p.x - r - 2, p.z - r - 2, p.x + r + 2, p.z + r + 2, _q);
    for (const o of _q) {
      const dx = p.x - o.x, dz = p.z - o.z, d = Math.hypot(dx, dz), R = r + o.r;
      if (d < R && d > 1e-6) { const k = (R - d) / d; p.x += dx * k; p.z += dz * k; hit++; nx += dx / d; nz += dz / d; }
    }
  }
  const l = Math.hypot(nx, nz) || 1;
  return hit ? { nx: nx / l, nz: nz / l } : null;
}

// ------------------------------------------------------------------ setup
GAME.init = function (scene, camera, dom) {
  GAME.scene = scene; GAME.camera = camera; GAME.dom = dom;
  GAME.player = createPlayer(Math.random);
  scene.add(GAME.player.group);
  // headlight for the player's car (only one real light for performance)
  GAME.headLight = new THREE.SpotLight(0xfff1dc, 0, 70, 0.55, 0.5, 1.4);
  GAME.headLight.castShadow = false; scene.add(GAME.headLight); scene.add(GAME.headLight.target);
  GAME.bindInput(dom);
};
GAME.spawnCar = function (x, z, heading, type = 'hatch', color = null) {
  const car = createCar({ type, color: color || CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)], seed: Math.floor(Math.random() * 1e6) });
  const c = { model: car, pos: new THREE.Vector3(x, surfaceY(x, z), z), heading, v: new THREE.Vector2(), w: 0, steer: 0, rpm: 0.1, gear: 1, wheelRot: 0, pitch: 0, roll: 0, driven: false, lastHit: 0 };
  car.group.position.copy(c.pos); car.group.rotation.y = heading;
  GAME.scene.add(car.group); GAME.cars.push(c);
  return c;
};
GAME.placeAt = function (x, z, heading = 0) {
  GAME.pos.set(x, surfaceY(x, z), z); GAME.heading = heading; GAME.camYaw = heading + Math.PI;
  if (GAME.mode === 'drive' && GAME.car) { GAME.car.pos.set(x, surfaceY(x, z), z); GAME.car.heading = heading; GAME.car.v.set(0, 0); }
};

// ------------------------------------------------------------------ parked cars (instanced, enterable)
GAME.buildParked = function (C) {
  const inst = createCarInstancing(), byType = {}, list = [];
  GAME.parkGrid = new Grid2D(30);
  const R = rng(4242);
  const pickType = (h) => h < 0.34 ? 'hatch' : h < 0.58 ? 'kombi' : h < 0.78 ? 'sedan' : h < 0.94 ? 'suv' : 'van';
  for (let i = 0; i < C.length; i += 4) {
    const x = C[i] / 10, z = C[i + 1] / 10, a = C[i + 2] * Math.PI / 180, h = R();
    const type = pickType(h), color = CAR_COLORS[Math.floor(R() * CAR_COLORS.length)];
    const it = { x, z, heading: Math.PI / 2 - a, type, color, idx: 0, obst: [] };
    (byType[type] = byType[type] || []).push(it); list.push(it);
    GAME.parkGrid.addBox(x - 1, z - 1, x + 1, z + 1, it);
    const fx = Math.cos(a), fz = Math.sin(a);
    it.obst.push(CITY.addObst(x + fx * 1.2, z + fz * 1.2, 0.95, 'c'), CITY.addObst(x - fx * 1.2, z - fz * 1.2, 0.95, 'c'));
  }
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), one = new THREE.Vector3(1, 1, 1), col = new THREE.Color();
  GAME.parkedMeshes = {};
  for (const type in byType) {
    const items = byType[type], im = new THREE.InstancedMesh(inst[type].geometry, inst[type].material, items.length);
    items.forEach((it, i) => {
      it.idx = i; it.mesh = im;
      q.setFromEuler(e.set(0, it.heading, 0)); m4.compose(_v.set(it.x, surfaceY(it.x, it.z), it.z), q, one);
      im.setMatrixAt(i, m4); im.setColorAt(i, col.set(it.color));
    });
    im.castShadow = true; im.receiveShadow = true; im.computeBoundingSphere();
    GAME.scene.add(im); GAME.parkedMeshes[type] = im;
  }
  GAME.parked = list;
};
GAME.takeParked = function () {
  const out = GAME.parkGrid.query(GAME.pos.x - 5, GAME.pos.z - 5, GAME.pos.x + 5, GAME.pos.z + 5, []);
  let best = null, bd = 4.2;
  for (const it of out) { if (it.taken) continue; const d = Math.hypot(it.x - GAME.pos.x, it.z - GAME.pos.z); if (d < bd) { bd = d; best = it; } }
  if (!best) return null;
  best.taken = true;
  const m4 = new THREE.Matrix4().makeScale(0, 0, 0); best.mesh.setMatrixAt(best.idx, m4); best.mesh.instanceMatrix.needsUpdate = true;
  for (const o of best.obst) o.r = 0;
  return GAME.spawnCar(best.x, best.z, best.heading, best.type, best.color);
};

// ------------------------------------------------------------------ input
GAME.bindInput = function (dom) {
  const K = GAME.keys;
  addEventListener('keydown', (e) => {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT')) return;
    K[e.code] = true;
    if (e.code === 'KeyF' || e.code === 'Enter') GAME.toggleCar();
    if (e.code === 'KeyH') AUDIO.horn(true);
    if (e.code === 'KeyC') GAME.camDist = GAME.mode === 'drive' ? (GAME.camDist > 7 ? 5.2 : GAME.camDist > 5.5 ? 9.5 : 7.2) : (GAME.camDist > 4 ? 2.8 : 4.4);
    if (['Space', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
    GAME.events.push(e.code);
  });
  addEventListener('keyup', (e) => { K[e.code] = false; if (e.code === 'KeyH') AUDIO.horn(false); });
  addEventListener('blur', () => { for (const k in K) K[k] = false; });
  dom.addEventListener('mousemove', (e) => {
    if (document.pointerLockElement !== dom && !(e.buttons & 1)) return;
    GAME.camYaw -= e.movementX * 0.0032; GAME.camPitch = clamp(GAME.camPitch + e.movementY * 0.0026, -0.35, 1.25);
    GAME.lastMouse = performance.now() / 1000;
  });
  dom.addEventListener('wheel', (e) => { GAME.camDist = clamp(GAME.camDist * (1 + Math.sign(e.deltaY) * 0.1), 2.2, 16); }, { passive: true });
  // touch: left half = joystick, right half = look
  let lookId = null, joyId = null, lx = 0, ly = 0, jx = 0, jy = 0;
  dom.addEventListener('touchstart', (e) => {
    for (const t of e.changedTouches) {
      if (t.clientX < innerWidth * 0.45 && joyId === null) { joyId = t.identifier; jx = t.clientX; jy = t.clientY; GAME.joy.on = true; GAME.joy.cx = jx; GAME.joy.cy = jy; }
      else if (lookId === null) { lookId = t.identifier; lx = t.clientX; ly = t.clientY; }
    }
    e.preventDefault();
  }, { passive: false });
  dom.addEventListener('touchmove', (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier === joyId) { GAME.joy.x = clamp((t.clientX - jx) / 55, -1, 1); GAME.joy.y = clamp((t.clientY - jy) / 55, -1, 1); }
      if (t.identifier === lookId) { GAME.camYaw -= (t.clientX - lx) * 0.006; GAME.camPitch = clamp(GAME.camPitch + (t.clientY - ly) * 0.004, -0.35, 1.25); lx = t.clientX; ly = t.clientY; GAME.lastMouse = performance.now() / 1000; }
    }
    e.preventDefault();
  }, { passive: false });
  const end = (e) => { for (const t of e.changedTouches) { if (t.identifier === joyId) { joyId = null; GAME.joy.on = false; GAME.joy.x = GAME.joy.y = 0; } if (t.identifier === lookId) lookId = null; } };
  dom.addEventListener('touchend', end); dom.addEventListener('touchcancel', end);
};
GAME.axis = function () {
  const K = GAME.keys;
  let f = (K.KeyW || K.ArrowUp ? 1 : 0) - (K.KeyS || K.ArrowDown ? 1 : 0);
  let s = (K.KeyD || K.ArrowRight ? 1 : 0) - (K.KeyA || K.ArrowLeft ? 1 : 0);
  if (GAME.joy.on) { f = -GAME.joy.y; s = GAME.joy.x; }
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  for (const p of pads) if (p && p.connected) {
    if (Math.abs(p.axes[0]) > 0.15) s = p.axes[0];
    if (GAME.mode === 'drive') { const rt = p.buttons[7]?.value || 0, lt = p.buttons[6]?.value || 0; if (rt + lt > 0.05) f = rt - lt; }
    else if (Math.abs(p.axes[1]) > 0.15) f = -p.axes[1];
    if (Math.abs(p.axes[2]) > 0.15 || Math.abs(p.axes[3]) > 0.15) { GAME.camYaw -= p.axes[2] * 0.05; GAME.camPitch = clamp(GAME.camPitch + p.axes[3] * 0.03, -0.35, 1.25); GAME.lastMouse = performance.now() / 1000; }
  }
  return { f, s };
};

// ------------------------------------------------------------------ enter / exit vehicles
GAME.toggleCar = function () {
  if (GAME.mode === 'drive') {
    const c = GAME.car; if (Math.hypot(c.v.x, c.v.y) > 4) return;
    const side = new THREE.Vector3(Math.cos(c.heading), 0, -Math.sin(c.heading)); // car's +x (left)
    const x = c.pos.x + side.x * (c.model.dims.width / 2 + 0.6), z = c.pos.z + side.z * (c.model.dims.width / 2 + 0.6);
    GAME.pos.set(x, surfaceY(x, z), z); collideCircle(GAME.pos, 0.3);
    GAME.heading = c.heading; GAME.mode = 'walk'; c.driven = false; GAME.car = null;
    GAME.player.group.visible = true; GAME.camDist = 4.4;
    c.model.setLights({ brake: false, reverse: false }); AUDIO.engine({ on: false }); AUDIO.door('close');
    return;
  }
  let best = null, bd = 4.5;
  for (const c of GAME.cars) { const d = Math.hypot(c.pos.x - GAME.pos.x, c.pos.z - GAME.pos.z); if (d < bd) { bd = d; best = c; } }
  if (!best) best = GAME.takeParked();
  if (!best) return;
  GAME.mode = 'drive'; GAME.car = best; best.driven = true; GAME.player.group.visible = false; GAME.camDist = 7.2;
  AUDIO.door('open');
};
GAME.nearestCarDist = function () {
  let bd = 1e9; for (const c of GAME.cars) bd = Math.min(bd, Math.hypot(c.pos.x - GAME.pos.x, c.pos.z - GAME.pos.z));
  if (GAME.parkGrid) for (const it of GAME.parkGrid.query(GAME.pos.x - 5, GAME.pos.z - 5, GAME.pos.x + 5, GAME.pos.z + 5, [])) if (!it.taken) bd = Math.min(bd, Math.hypot(it.x - GAME.pos.x, it.z - GAME.pos.z));
  return bd;
};

// ------------------------------------------------------------------ update
GAME.update = function (dt) {
  if (GAME.mode === 'walk') GAME.updateWalk(dt); else GAME.updateDrive(dt);
  for (const c of GAME.cars) { if (!c.driven) GAME.updateParkedCar(c, dt); c.model.update(dt); }
  GAME.updateCamera(dt);
};
GAME.updateWalk = function (dt) {
  const { f, s } = GAME.axis(), K = GAME.keys;
  const run = K.ShiftLeft || K.ShiftRight;
  const mag = Math.min(1, Math.hypot(f, s));
  // camera-relative movement: forward = direction the camera looks
  const fwd = GAME.camYaw + Math.PI;
  const tgt = Math.atan2(s, f);
  let spd = 0;
  if (mag > 0.1) {
    const want = fwd - tgt;
    GAME.heading += angDiff(GAME.heading, want) * Math.min(1, dt * 10);
    spd = mag * (run ? 5.6 : 1.6);
  }
  GAME.speed = lerp(GAME.speed, spd, Math.min(1, dt * 6));
  GAME.pos.x += Math.sin(GAME.heading) * GAME.speed * dt; GAME.pos.z += Math.cos(GAME.heading) * GAME.speed * dt;
  collideCircle(GAME.pos, 0.3);
  const [X0, Z0, X1, Z1] = CITY.bounds; GAME.pos.x = clamp(GAME.pos.x, X0 + 5, X1 - 5); GAME.pos.z = clamp(GAME.pos.z, Z0 + 5, Z1 - 5);
  const gy = surfaceY(GAME.pos.x, GAME.pos.z); GAME.pos.y = lerp(GAME.pos.y, gy, Math.min(1, dt * 12));
  const P = GAME.player; P.group.position.copy(GAME.pos); P.group.rotation.y = GAME.heading;
  P.update(dt, { speed: GAME.speed });
  // footsteps
  GAME._step = (GAME._step || 0) + GAME.speed * dt;
  if (GAME._step > (run ? 1.6 : 1.35)) { GAME._step = 0; AUDIO.footstep(gy < 0.05 ? 'grass' : 'hard', run); }
};

// arcade car physics (bicycle model with grip / drift)
GAME.updateDrive = function (dt) {
  const c = GAME.car, K = GAME.keys, { f, s } = GAME.axis(), dims = c.model.dims;
  const fx = Math.sin(c.heading), fz = Math.cos(c.heading), rx = fz, rz = -fx;          // forward, right(-x local = right side)
  let vf = c.v.x * fx + c.v.y * fz, vl = c.v.x * rx + c.v.y * rz;
  const hand = K.Space;
  const maxV = K.ShiftLeft ? 52 : 44;
  // throttle / brake / reverse
  let acc = 0, braking = false;
  if (f > 0) { if (vf < -0.5) { acc = 14; braking = true; } else acc = 7.2 * f * (1 - clamp(vf / maxV, 0, 1) ** 1.5) * (vf < 10 ? 1.25 : 1); }
  else if (f < 0) { if (vf > 0.5) { acc = -15 * -f; braking = true; } else acc = 4.5 * f * (vf > -9 ? 1 : 0); }
  vf += acc * dt;
  if (hand) vf -= Math.sign(vf) * Math.min(Math.abs(vf), 9 * dt);
  vf -= Math.sign(vf) * Math.min(Math.abs(vf), (0.35 + 0.0012 * vf * vf + (f === 0 ? 0.9 : 0)) * dt);
  // steering (less lock at speed)
  const lock = lerp(0.62, 0.14, clamp(Math.abs(vf) / 38, 0, 1));
  c.steer = lerp(c.steer, s * lock, Math.min(1, dt * (s ? 5 : 7)));
  const yawTarget = vf * Math.tan(c.steer) / dims.wheelBase;
  const grip = hand ? 1.4 : 7.5;
  c.w = lerp(c.w, yawTarget * (hand && Math.abs(vf) > 6 ? 1.35 : 1), Math.min(1, dt * (hand ? 3.5 : 9)));
  c.heading -= c.w * dt;
  vl *= Math.exp(-grip * dt);
  // centrifugal slip when handbraking gives a drift feel
  if (hand && Math.abs(vf) > 5) vl += c.w * vf * 0.18 * dt;
  const nfx = Math.sin(c.heading), nfz = Math.cos(c.heading), nrx = nfz, nrz = -nfx;
  c.v.set(nfx * vf + nrx * vl, nfz * vf + nrz * vl);
  // integrate + collide (two circles along the body)
  const R = dims.width * 0.5, off = dims.length * 0.5 - R;
  c.pos.x += c.v.x * dt; c.pos.z += c.v.y * dt;
  let hitN = null;
  for (const sg of [1, -1]) {
    _w.set(c.pos.x + nfx * off * sg, 0, c.pos.z + nfz * off * sg);
    const bx = _w.x, bz = _w.z, h = collideCircle(_w, R);
    if (h) { c.pos.x += _w.x - bx; c.pos.z += _w.z - bz; hitN = h; }
  }
  if (hitN) {
    const vn = c.v.x * hitN.nx + c.v.y * hitN.nz;
    if (vn < 0) { c.v.x -= vn * hitN.nx * 1.35; c.v.y -= vn * hitN.nz * 1.35; c.v.multiplyScalar(0.82); if (-vn > 3 && S.time - c.lastHit > 0.4) { AUDIO.crash(clamp(-vn / 20, 0.1, 1)); c.lastHit = S.time; GAME.shake = clamp(-vn / 15, 0, 1); } }
  }
  const [X0, Z0, X1, Z1] = CITY.bounds; c.pos.x = clamp(c.pos.x, X0 + 5, X1 - 5); c.pos.z = clamp(c.pos.z, Z0 + 5, Z1 - 5);
  c.pos.y = lerp(c.pos.y, surfaceY(c.pos.x, c.pos.z), Math.min(1, dt * 10));
  // body motion: pitch under accel/brake, roll in corners
  c.pitch = lerp(c.pitch, clamp(-acc * 0.004, -0.04, 0.05), Math.min(1, dt * 4));
  c.roll = lerp(c.roll, clamp(-c.w * vf * 0.004, -0.06, 0.06), Math.min(1, dt * 4));
  GAME.speed = Math.abs(vf);
  // gears for sound
  const ratios = [0, 11, 19, 28, 38, 50, 64];
  if (vf < -0.5) c.gear = -1; else { if (c.gear < 1) c.gear = 1; while (c.gear < 6 && vf > ratios[c.gear] * 0.95) c.gear++; while (c.gear > 1 && vf < ratios[c.gear - 1] * 0.7) c.gear--; }
  const g = Math.max(1, c.gear), lo = g > 1 ? ratios[g - 1] * 0.55 : 0, hi = ratios[g];
  c.rpm = lerp(c.rpm, clamp(0.12 + 0.85 * (Math.abs(vf) - lo) / (hi - lo + 1e-3), 0.1, 1), Math.min(1, dt * 8));
  AUDIO.engine({ on: true, rpm: c.rpm, throttle: Math.max(0, f), speed: Math.abs(vf), type: c.model.type === 'van' ? 'van' : 'car' });
  AUDIO.skid(clamp((Math.abs(vl) - 2.5) / 6, 0, 1) + (braking && Math.abs(vf) > 8 ? 0.25 : 0));
  c.model.setLights({ brake: braking || (f < 0 && vf > 0.2) || (hand && Math.abs(vf) > 1), reverse: vf < -0.3 });
  GAME.applyCarTransform(c, dt, vf);
  // player follows the car (for the minimap etc.)
  GAME.pos.copy(c.pos); GAME.heading = c.heading;
  // headlight
  const hl = GAME.headLight, n = S.night;
  hl.intensity = n > 0.25 ? 60 * n : 0;
  hl.position.set(c.pos.x + nfx * (dims.length / 2), c.pos.y + 0.7, c.pos.z + nfz * (dims.length / 2));
  hl.target.position.set(c.pos.x + nfx * 25, c.pos.y - 0.5, c.pos.z + nfz * 25);
};
GAME.applyCarTransform = function (c, dt, vf) {
  const m = c.model;
  m.group.position.copy(c.pos); m.group.rotation.set(0, c.heading, 0);
  m.body.rotation.set(c.pitch, 0, c.roll);
  c.wheelRot += vf * dt / m.dims.wheelRadius;
  for (const w of m.wheels) { w.spin.rotation.x = c.wheelRot; if (w.front) w.pivot.rotation.y = -c.steer; }
};
GAME.updateParkedCar = function (c, dt) {
  if (c.v.lengthSq() < 1e-4) return;
  c.v.multiplyScalar(Math.exp(-2.5 * dt));
  c.pos.x += c.v.x * dt; c.pos.z += c.v.y * dt;
  GAME.applyCarTransform(c, dt, 0);
};

// ------------------------------------------------------------------ camera (GTA-like chase / orbit)
GAME.updateCamera = function (dt) {
  const cam = GAME.camera, now = performance.now() / 1000;
  if (GAME.camOverride) { // test hook: exact street-view-like pose {x, y, z, h (deg, clockwise from north), p (deg up), vfov}
    const o = GAME.camOverride, h = o.h * Math.PI / 180, pt = o.p * Math.PI / 180;
    cam.position.set(o.x, o.y, o.z);
    cam.lookAt(o.x + Math.sin(h) * Math.cos(pt), o.y + Math.sin(pt), o.z - Math.cos(h) * Math.cos(pt));
    if (cam.fov !== o.vfov) { cam.fov = o.vfov; cam.updateProjectionMatrix(); }
    GAME.player.group.visible = false; return;
  }
  const drive = GAME.mode === 'drive', c = GAME.car;
  const target = _v.copy(drive ? c.pos : GAME.pos); target.y += drive ? 1.35 : 1.55;
  // auto-return behind the vehicle / player when the mouse is idle
  if (drive && now - GAME.lastMouse > 1.6 && GAME.speed > 2) {
    const behind = c.heading + Math.PI + (Math.sign(c.v.x * Math.sin(c.heading) + c.v.y * Math.cos(c.heading)) < 0 ? Math.PI : 0);
    GAME.camYaw += angDiff(GAME.camYaw, behind) * Math.min(1, dt * 2.2);
    GAME.camPitch = lerp(GAME.camPitch, 0.2, Math.min(1, dt * 1.5));
  }
  const dist = drive ? GAME.camDist + clamp(GAME.speed / 40, 0, 1) * 1.6 : GAME.camDist;
  const cp = Math.cos(GAME.camPitch), sp = Math.sin(GAME.camPitch);
  let want = dist;
  // pull in when a building is between the target and the camera
  const dx = Math.sin(GAME.camYaw) * cp, dz = Math.cos(GAME.camYaw) * cp;
  const ex = target.x + dx * dist, ez = target.z + dz * dist;
  _q.length = 0; CITY.edges.query(Math.min(target.x, ex) - 1, Math.min(target.z, ez) - 1, Math.max(target.x, ex) + 1, Math.max(target.z, ez) + 1, _q);
  for (const e of _q) {
    const t = segIntersect(target.x, target.z, ex, ez, e.ax, e.az, e.bx, e.bz);
    if (t !== null) { const hy = target.y + sp * dist * t; if (hy < CITY.groundH(e.ax, e.az) + e.h + 0.5) want = Math.min(want, Math.max(0.45, dist * t - 0.35)); }
  }
  GAME.camCur = GAME.camCur === undefined ? want : (want < GAME.camCur ? want : lerp(GAME.camCur, want, Math.min(1, dt * 2.5)));
  const d = GAME.camCur;
  cam.position.set(target.x + dx * d, target.y + sp * d, target.z + dz * d);
  const gy = CITY.groundH(cam.position.x, cam.position.z) + 0.35; if (cam.position.y < gy) cam.position.y = gy;
  if (GAME.shake > 0.01) { cam.position.x += (Math.random() - 0.5) * GAME.shake * 0.3; cam.position.y += (Math.random() - 0.5) * GAME.shake * 0.3; GAME.shake *= Math.exp(-dt * 6); }
  cam.lookAt(target.x, target.y + (drive ? 0.25 : 0.1), target.z);
  // FOV widens with speed
  const fov = GAME.fixedFov || (drive ? 58 + clamp(GAME.speed / 45, 0, 1) * 12 : 55);
  if (Math.abs(cam.fov - fov) > 0.05) { cam.fov = GAME.fixedFov ? fov : lerp(cam.fov, fov, Math.min(1, dt * 3)); cam.updateProjectionMatrix(); }
  if (!drive) GAME.player.group.visible = d > 1.0;
};
function segIntersect(ax, az, bx, bz, cx, cz, dx, dz) {
  const rx = bx - ax, rz = bz - az, sx = dx - cx, sz = dz - cz, den = rx * sz - rz * sx;
  if (Math.abs(den) < 1e-9) return null;
  const t = ((cx - ax) * sz - (cz - az) * sx) / den, u = ((cx - ax) * rz - (cz - az) * rx) / den;
  return (t >= 0 && t <= 1 && u >= 0 && u <= 1) ? t : null;
}
