// Boot: load data + CC0 assets, build Skalica, run the game loop.
import * as THREE from 'three';
import { S, Q } from './core/state.js';
import { decodeData } from './core/util.js';
import { loadTextureArrays, makeWorldMaterial, WORLD } from './render/materials.js';
import { initEnv } from './render/env.js';
import { initPost } from './render/post.js';
import { CITY, buildCity } from './world/city.js';
import { GAME } from './game/game.js';
import { HUD } from './ui/hud.js';
import { AUDIO } from './core/audio.js';
import { buildVegetation } from './world/vegetation.js';
import { buildProps, PROPS } from './world/props.js';
import { buildSigns, SIGNS } from './world/signs.js';
import { applyDistricts, buildDistrictProps, DISTRICTS } from './world/districts/index.js';

const $ = (id) => document.getElementById(id);
const TIPS = [
  ['Rotunda sv. Juraja', 'Románska rotunda na vŕšku nad mestom patrí k najstarším stavbám Skalice. Nájdeš ju severozápadne od námestia.'],
  ['Kultúrny dom', 'Secesný Spolkový dom navrhol Dušan Jurkovič a otvorili ho v roku 1905. Spoznáš ho podľa farebnej mozaiky na priečelí.'],
  ['Skalický trdelník', 'Skalický trdelník má od roku 2007 chránené zemepisné označenie Európskej únie.'],
  ['Kráľovské mesto', 'Skalica je slobodným kráľovským mestom od roku 1372. Časť mestských hradieb stojí dodnes.'],
  ['Víno', 'Za mestom sú vinice. Skalický rubín je miestne červené víno, ktoré sa s mestom spája najviac.'],
  ['Tip', 'Na mape (M) klikni pre cieľ a dvojklikni pre okamžitý presun kamkoľvek v meste.'],
  ['Tip', 'Klávesou N posunieš čas. V noci svietia okná, lampy aj svetlá áut.'],
];

async function main() {
  const P = new URLSearchParams(location.search);
  S.mobile = matchMedia('(pointer: coarse)').matches || Math.min(screen.width, screen.height) < 700;
  if (S.mobile) document.documentElement.classList.add('touch');
  let savedQ = null; try { savedQ = localStorage.getItem('us-quality'); } catch (e) { /* storage blocked */ }
  S.quality = P.get('q') || savedQ || (S.mobile ? 'low' : 'high');
  if (P.get('base')) S.base = P.get('base');
  const bar = $('load-bar'), step = $('load-step');
  const prog = (v, t) => { bar.style.width = Math.round(v * 100) + '%'; if (t) step.textContent = t; };
  let ti = 0; const tip = () => { const [h, b] = TIPS[ti++ % TIPS.length]; $('tip').innerHTML = `<strong>${h}</strong>${b}`; };
  tip(); const tipTimer = setInterval(tip, 6000);

  // ---- renderer
  const canvas = $('gl');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false });
  if (!renderer.capabilities.isWebGL2) throw new Error('Prehliadač nepodporuje WebGL 2.');
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.3, Q().drawDist);
  S.renderer = renderer; S.scene = scene; S.camera = camera;

  prog(0.03, 'Mapové dáta OpenStreetMap…');
  const [D, meta] = await Promise.all([decodeData(`${S.base}data/game.json`), fetch(`${S.base}assets/meta.json`).then(r => r.json())]);
  applyDistricts(D);
  prog(0.12, 'PBR textúry (Poly Haven)…');
  const ts = Q().texSize;
  const arrays = await loadTextureArrays(meta, ts, Math.min(ts, 512), (v) => prog(0.12 + v * 0.28));
  makeWorldMaterial(arrays);
  prog(0.42, 'Obloha a osvetlenie…');
  S.tod = parseFloat(P.get('t') ?? '0.42');
  const ENV = await initEnv(renderer, scene, camera, meta, (v) => prog(0.42 + v * 0.1));
  prog(0.52, 'Stavia sa mesto…');
  await buildCity(scene, D, (v) => prog(0.52 + v * 0.36, v < 0.3 ? 'Terén, polia a vinice…' : v < 0.5 ? 'Cesty, chodníky a obrubníky…' : 'Budovy, kostoly a veže…'));
  buildDistrictProps();
  const wn = await new THREE.TextureLoader().loadAsync(`${S.base}assets/tex/waternormals.jpg`); wn.wrapS = wn.wrapT = THREE.RepeatWrapping;
  CITY.flush(scene, wn);
  buildProps(scene, D);
  buildSigns(scene);
  prog(0.88, 'Stromy a zeleň…');
  const trees = []; for (let i = 0; i < D.t.length; i += 3) trees.push({ x: D.t[i] / 10, z: D.t[i + 1] / 10, k: D.t[i + 2] });
  for (const t of D.tExtra || []) trees.push(t);        // surveyed trees with an exact scale / height / rotation
  let VEG = null;
  try { VEG = await buildVegetation(scene, trees, { groundH: CITY.groundH, renderer }); for (const o of VEG.obstacles) CITY.addObst(o.x, o.z, o.r, 't'); }
  catch (e) { console.warn('vegetation failed', e, e && e.stack); }
  prog(0.94, 'Mapa a HUD…');
  GAME.init(scene, camera, canvas);
  HUD.init(); HUD.clock = () => ENV.clockString();
  // cars are switched off for now (they come back later, rebuilt street by street); ?cars=1 shows them for testing
  const CARS = P.get('cars') === '1';
  GAME.buildParked(CARS ? D.cars : []);
  // spawn on Námestie slobody
  const sp = (P.get('at') || '143,-181.5').split(',').map(Number);
  GAME.placeAt(sp[0], sp[1], Math.PI / 2 + Math.PI);
  const hashD = DISTRICTS.find(d => location.hash === '#' + d.id);
  if (hashD) GAME.placeAt(hashD.spawn[0], hashD.spawn[1], hashD.spawn[2]);
  if (CARS) {
    GAME.spawnCar(146, -184.2, Math.PI / 2, 'hatch', '#9b1d2a');
    GAME.spawnCar(122, -186.5, -Math.PI / 2, 'kombi', '#2b2f35');
  }
  const POST = initPost(renderer, scene, camera);
  const resize = () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); POST.setSize(innerWidth, innerHeight); HUD.resize(); };
  addEventListener('resize', resize); resize();
  // warm up shaders
  ENV.update(0, camera, GAME.pos); GAME.updateCamera(0.016);
  renderer.compile(scene, camera);
  prog(1, 'Hotovo');
  clearInterval(tipTimer);

  // ---- menu / keys
  const menu = $('menu');
  const setQ = (q) => { S.quality = q; try { localStorage.setItem('us-quality', q); } catch (e) { /* ignore */ } POST.setQuality(q); VEG && VEG.setQuality && VEG.setQuality(q); ENV.setQuality && ENV.setQuality(q); camera.far = Q().drawDist; camera.updateProjectionMatrix(); resize(); document.querySelectorAll('#q-seg .btn').forEach(b => b.classList.toggle('on', b.dataset.q === q)); };
  document.querySelectorAll('#q-seg .btn').forEach(b => { b.classList.toggle('on', b.dataset.q === S.quality); b.onclick = () => setQ(b.dataset.q); });
  const openMenu = (on) => { menu.hidden = !on; S.paused = on || HUD.mapOpen; if (on && document.pointerLockElement) document.exitPointerLock(); };
  $('m-resume').onclick = () => { openMenu(false); canvas.focus(); };
  $('m-skip').onclick = () => ENV.skip();
  for (const d of DISTRICTS) { const b = document.createElement('button'); b.className = 'btn'; b.textContent = d.name; b.onclick = () => { if (GAME.mode === 'drive') GAME.toggleCar(); GAME.placeAt(d.spawn[0], d.spawn[1], d.spawn[2]); HUD.lastStreet = ''; openMenu(false); }; $('m-places').appendChild(b); }
  document.querySelector('#m-places [data-at="square"]').onclick = () => { if (GAME.mode === 'drive') GAME.toggleCar(); GAME.placeAt(143, -181.5, Math.PI * 1.5); HUD.lastStreet = ''; openMenu(false); };
  $('m-stop').onclick = (e) => { ENV.running = !ENV.running; e.target.textContent = ENV.running ? 'Zastaviť čas' : 'Spustiť čas'; };
  $('m-sound').onclick = (e) => { AUDIO.mute(); e.target.textContent = AUDIO.muted ? 'Zvuk vypnutý' : 'Zvuk zapnutý'; };
  $('m-radio').onclick = () => toast(AUDIO.radio('toggle') || 'Rádio vypnuté');
  let toastT = 0; const toast = (m) => { const t = $('toast'); t.textContent = m; t.hidden = false; toastT = 3.5; };
  addEventListener('keydown', (e) => {
    if (e.code === 'KeyM') HUD.toggleMap();
    else if (e.code === 'KeyN') { ENV.skip(); toast('Čas posunutý: ' + ENV.clockString()); }
    else if (e.code === 'KeyR') toast(AUDIO.radio('next') || 'Rádio vypnuté');
    else if (e.code === 'Escape') { if (HUD.mapOpen) HUD.toggleMap(false); else openMenu(menu.hidden); }
  });
  canvas.addEventListener('click', () => { if (!S.mobile && menu.hidden && canvas.requestPointerLock) { try { const r = canvas.requestPointerLock(); if (r && r.catch) r.catch(() => {}); } catch (e) { /* optional */ } } });
  $('t-car').addEventListener('touchstart', (e) => { e.preventDefault(); GAME.toggleCar(); });
  $('t-map').addEventListener('touchstart', (e) => { e.preventDefault(); HUD.toggleMap(); });
  for (const [id, code] of [['t-brake', 'Space'], ['t-run', 'ShiftLeft']]) {
    $(id).addEventListener('touchstart', (e) => { e.preventDefault(); GAME.keys[code] = true; });
    $(id).addEventListener('touchend', (e) => { e.preventDefault(); GAME.keys[code] = false; });
  }

  // ---- loop
  const clock = new THREE.Clock();
  const frame = (dt, draw = true) => {
    if (!S.paused) {
      S.time += dt;
      GAME.update(dt);
      ENV.update(dt, camera, GAME.pos);
      if (WORLD.uniforms) WORLD.uniforms.uTime.value = S.time;
      if (VEG) VEG.update(camera, dt);
      PROPS.update(dt, GAME.pos);
      SIGNS.update();
    }
    HUD.update(dt);
    AUDIO.ambient({ night: S.night, urban: CITY.isUrban(GAME.pos.x, GAME.pos.z) ? 1 : 0.2, speed: GAME.speed, inCar: GAME.mode === 'drive' });
    if (toastT > 0 && (toastT -= dt) <= 0) $('toast').hidden = true;
    if (draw) POST.render(dt);
  };
  const start = () => {
    $('load').hidden = true; $('hud').hidden = false; AUDIO.init(); canvas.focus();
    HUD.lastStreet = ''; HUD.resize();
    if (window.__TEST) return;
    const loop = () => { frame(Math.min(clock.getDelta(), 0.05)); requestAnimationFrame(loop); };
    clock.getDelta(); requestAnimationFrame(loop);
  };
  $('start').hidden = false; $('start').onclick = start; step.textContent = 'Mesto je pripravené';
  // test hooks
  window.GAME = GAME; window.WORLD = WORLD; window.CITY = CITY; window.ENV = ENV; window.HUD = HUD; window.S = S; window.POST = POST;
  window.__start = start;
  window.__frame = (n = 1, dt = 1 / 30) => { for (let i = 0; i < n; i++) frame(dt, i === n - 1); return { calls: renderer.info.render.calls, tris: renderer.info.render.triangles }; };
  window.__READY = true;
}

main().catch((e) => {
  console.error(e);
  const s = $('load-step'); if (s) { s.textContent = 'Chyba: ' + (e && e.message || e); s.style.color = '#e0475c'; }
});
