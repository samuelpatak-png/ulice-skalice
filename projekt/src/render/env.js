// Environment: time of day, sun & moon, sky dome, image based lighting, fog / aerial perspective, exposure.
//
// Units (scene-linear, three.js physical light units), reference values at full phase:
//   sun at noon ~3.2 (golden hour ~2, 19:55 ~2), moon 0.22, sky ambient (IBL mean radiance): day 0.30,
//   sunset 0.13, dusk 0.045, night 0.018. Emissives / lamps should be tuned against these
//   (e.g. a PointLight of 15 cd gives an irradiance of ~0.4 at 6 m, i.e. an eighth of the noon sun).
// Tone mapping: ACES filmic (three's fit). The sky dome shows the Poly Haven tonemapped JPGs through an
// exact inverse of that curve, so the background looks as photographed at any exposure.
//
// Global shader patches (installed when this module is imported, before any material compiles):
//   * fog chunks: exponential height fog + sun-side in-scattering colour + a guaranteed fade before
//     the draw distance. Driven by scene.fog (FogExp2: colour = away-from-sun horizon, density) and
//     shared uniforms (fogSunColor, fogSunDir, fogParams). Works for every built-in material incl.
//     the world material; custom ShaderMaterials with fog:true fall back to plain exp2 fog.
//   * shadow map lookup: the directional shadow fades out towards the edge of the shadow frustum
//     instead of ending in a hard line.
import * as THREE from 'three';
import { S, Q } from '../core/state.js';
import { WORLD } from './materials.js';

const DEG = Math.PI / 180;
// Skalica 48.85 N, 17.23 E; early July (declination 22 deg) -> sunrise ~4:59, sunset ~20:51 CEST
const LAT = 48.85 * DEG, DECL = 22.0 * DEG, NOON = 12 + 55 / 60;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const wrapPi = (a) => Math.atan2(Math.sin(a), Math.cos(a));

// ---------------------------------------------------------------------------------------------
// Phases. exposure = renderer.toneMappingExposure, sky = IBL mean radiance (scene units),
// iblTint = colour grade of the IBL, bg = display-space gain of the sky dome photo,
// fog = fog density multiplier, hazeW = elevation (rad) over which the sky fades into fog colour,
// sunPow = sharpness of the sun-side fog colour.
// ---------------------------------------------------------------------------------------------
const KEYS = ['day', 'sunset', 'dusk', 'night'];
export const PHASES = {
  day:    { exposure: 1.00, sky: 0.30,  iblTint: [1.0, 1.0, 1.0],    bg: [1.0, 1.0, 1.0],    fog: 1.0,  hazeW: 0.060, sunPow: 6 },
  sunset: { exposure: 1.10, sky: 0.13,  iblTint: [1.0, 0.94, 0.88], bg: [1.0, 1.0, 1.0],    fog: 1.15, hazeW: 0.035, sunPow: 4 },
  dusk:   { exposure: 1.25, sky: 0.045, iblTint: [0.85, 0.95, 1.2], bg: [1.0, 1.0, 1.0],    fog: 1.1,  hazeW: 0.045, sunPow: 3 },
  night:  { exposure: 1.40, sky: 0.018, iblTint: [0.55, 0.75, 1.3], bg: [0.5, 0.6, 0.85],  fog: 0.9,  hazeW: 0.050, sunPow: 2 },
};
// sky key frames by sun elevation (deg, descending): [elevation, phase index]; equal neighbours = hold
const PK = [[14, 0], [7, 1], [2, 1], [-3, 2], [-7, 2], [-12, 3]];
// how each HDRI is placed: its brightest spot follows the sun / the moon, or stays at a fixed azimuth
// (night: the light-pollution glow of the photo sits towards Bratislava / Vienna, SSW).
const PLACE = {
  day: { track: 'sun', lo: 8, hi: 75 },
  sunset: { track: 'sun', lo: 2.5, hi: 14 },
  dusk: { track: 'moon', lo: 8, hi: 45 },
  night: { track: 'fixed', az: 200 },
};
const SKIP = [7, 12, 19.5, 21, 23.5];   // skip(): morning, noon, evening, dusk, night

// ---------------------------------------------------------------------------------------------
// ACES (three.js fit) and its inverse — used to show display-referred sky photos under ACES.
// ---------------------------------------------------------------------------------------------
const ACES_IN = new THREE.Matrix3().fromArray([0.59719, 0.07600, 0.02840, 0.35458, 0.90834, 0.13383, 0.04823, 0.01566, 0.83777]);
const ACES_OUT = new THREE.Matrix3().fromArray([1.60475, -0.10208, -0.00327, -0.53108, 1.10813, -0.07276, -0.07367, -0.00605, 1.07602]);
const ACES_IN_INV = ACES_IN.clone().invert(), ACES_OUT_INV = ACES_OUT.clone().invert();
const glMat3 = (m) => `mat3(${m.elements.map(v => v.toFixed(7)).join(', ')})`;
const GLSL_INV_ACES = /* glsl */`
vec3 invRRT(vec3 y) {
  y = clamp(y, 0.0, 0.985);
  vec3 A = 0.983729 * y - 1.0, B = 0.4329510 * y - 0.0245786, C = 0.238081 * y + 0.000090537;
  return (-B - sqrt(max(B * B - 4.0 * A * C, 0.0))) / (2.0 * A);
}
// display-linear colour -> scene-linear radiance that ACES(exposure) maps back onto it
vec3 invACES(vec3 c, float exposure) {
  vec3 v = ${glMat3(ACES_OUT_INV)} * c;
  v = invRRT(max(v, 0.0));
  v = ${glMat3(ACES_IN_INV)} * v;
  return max(v, 0.0) * (0.6 / exposure);
}`;
function invRRT1(y) {
  y = clamp(y, 0, 0.985);
  const A = 0.983729 * y - 1, B = 0.432951 * y - 0.0245786, C = 0.238081 * y + 0.000090537;
  return (-B - Math.sqrt(Math.max(B * B - 4 * A * C, 0))) / (2 * A);
}
const _iv = new THREE.Vector3();
function invACES(c, exposure, out) {
  _iv.copy(c).applyMatrix3(ACES_OUT_INV);
  _iv.set(invRRT1(Math.max(_iv.x, 0)), invRRT1(Math.max(_iv.y, 0)), invRRT1(Math.max(_iv.z, 0))).applyMatrix3(ACES_IN_INV);
  return out.set(Math.max(_iv.x, 0), Math.max(_iv.y, 0), Math.max(_iv.z, 0)).multiplyScalar(0.6 / exposure);
}

// ---------------------------------------------------------------------------------------------
// Global shader chunk patches (fog + shadow edge fade)
// ---------------------------------------------------------------------------------------------
export const FOG_U = {
  fogSunColor: new Float32Array([0.5, 0.5, 0.5]),
  fogSunDir: new Float32Array([0, 1, 0, 4]),      // xyz towards sun, w = sharpness
  fogParams: new Float32Array([1 / 150, 0, 0, 0]), // x: 1/scale height, y: base height, z/w: guaranteed fade start/end (0 = off)
};
(function patchChunks() {
  const C = THREE.ShaderChunk;
  if (C.fog_fragment.includes('fogParams')) return;
  C.fog_pars_vertex = /* glsl */`
#ifdef USE_FOG
  varying float vFogDepth;
  varying vec3 vFogWDir;
#endif`;
  C.fog_vertex = /* glsl */`
#ifdef USE_FOG
  vFogDepth = - mvPosition.z;
  vFogWDir = ( vec4( mvPosition.xyz, 0.0 ) * viewMatrix ).xyz;
#endif`;
  C.fog_pars_fragment = /* glsl */`
#ifdef USE_FOG
  uniform vec3 fogColor;
  uniform vec3 fogSunColor;
  uniform vec4 fogSunDir;
  uniform vec4 fogParams;
  varying float vFogDepth;
  varying vec3 vFogWDir;
  #ifdef FOG_EXP2
    uniform float fogDensity;
  #else
    uniform float fogNear;
    uniform float fogFar;
  #endif
#endif`;
  C.fog_fragment = /* glsl */`
#ifdef USE_FOG
  #ifdef FOG_EXP2
    vec3 fogCol = fogColor;
    float fogFactor;
    if ( fogParams.w > 0.0 ) {
      float fogDist = length( vFogWDir );
      vec3 fogV = vFogWDir / max( fogDist, 1e-4 );
      float fk = fogParams.x, fdh = vFogWDir.y * fk;
      float fh = exp( - fk * ( cameraPosition.y - fogParams.y ) ) * ( abs( fdh ) > 1e-3 ? ( 1.0 - exp( - fdh ) ) / fdh : 1.0 );
      fogFactor = 1.0 - exp( - fogDensity * max( fogDist - 12.0, 0.0 ) * fh );
      fogFactor = max( fogFactor, smoothstep( fogParams.z, fogParams.w, fogDist ) );
      fogCol = mix( fogColor, fogSunColor, pow( max( dot( fogV, fogSunDir.xyz ), 0.0 ), fogSunDir.w ) );
    } else {
      fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
    }
  #else
    vec3 fogCol = fogColor;
    float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
  #endif
  #ifdef TONE_MAPPING
    fogCol = toneMapping( fogCol );
  #endif
  fogCol = linearToOutputTexel( vec4( fogCol, 1.0 ) ).rgb;
  gl_FragColor.rgb = mix( gl_FragColor.rgb, fogCol, fogFactor );
#endif`;
  // fade the (single, camera following) shadow map out towards its border
  C.shadowmap_pars_fragment = C.shadowmap_pars_fragment.replace(
    'return mix( 1.0, shadow, shadowIntensity );',
    `vec2 shEdge = abs( shadowCoord.xy - 0.5 ) * 2.0;
		return mix( 1.0, shadow, shadowIntensity * ( 1.0 - smoothstep( 0.82, 0.98, max( shEdge.x, shEdge.y ) ) ) );`);
  // shared uniform values (typed arrays are shared by reference through UniformsUtils.clone)
  const add = (u) => { u.fogSunColor = { value: FOG_U.fogSunColor }; u.fogSunDir = { value: FOG_U.fogSunDir }; u.fogParams = { value: FOG_U.fogParams }; };
  for (const k in THREE.ShaderLib) { const u = THREE.ShaderLib[k].uniforms; if (u && u.fogColor) add(u); }
  add(THREE.UniformsLib.fog);
})();

// ---------------------------------------------------------------------------------------------
// Astronomy
// ---------------------------------------------------------------------------------------------
function sunVec(tod, out) {
  const H = (tod * 24 - NOON) * 15 * DEG;
  const E = -Math.cos(DECL) * Math.sin(H);
  const N = Math.sin(DECL) * Math.cos(LAT) - Math.cos(DECL) * Math.cos(H) * Math.sin(LAT);
  const U = Math.sin(DECL) * Math.sin(LAT) + Math.cos(DECL) * Math.cos(H) * Math.cos(LAT);
  return out.set(E, U, -N).normalize();          // world: x east, y up, z south
}
const dirFromAzEl = (az, el, out) => out.set(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el));
const azOf = (d) => Math.atan2(d.x, -d.z);         // compass azimuth (0 = north, clockwise)
const phiOf = (x, z) => Math.atan2(z, x);          // three.js equirect longitude
// direct sun colour & relative intensity from air mass (Kasten-Young) with per-channel extinction
const TAU = [0.030, 0.065, 0.160];
function sunLight(elDeg, outCol) {
  if (elDeg < -2) { outCol.setRGB(1, 0.4, 0.1); return 0; }
  const am = 1 / (Math.sin(Math.max(elDeg, -1.5) * DEG) + 0.50572 * Math.pow(Math.max(elDeg, -1.5) + 6.07995, -1.6364));
  const amNoon = 1.12;
  const r = Math.exp(-(am - amNoon) * TAU[0]), g = Math.exp(-(am - amNoon) * TAU[1]), b = Math.exp(-(am - amNoon) * TAU[2]);
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const m = Math.max(r, g, b);
  outCol.setRGB(r / m * 1.0, g / m * 0.975, b / m * 0.93);
  return Math.min(lum, 1.05) * sstep(-1.2, 2.5, elDeg);
}

// ---------------------------------------------------------------------------------------------
// Shaders
// ---------------------------------------------------------------------------------------------
const GLSL_WARP = /* glsl */`
float hermite(float p0, float p1, float m0, float m1, float s) {
  float s2 = s * s, s3 = s2 * s;
  return (2.0 * s3 - 3.0 * s2 + 1.0) * p0 + (s3 - 2.0 * s2 + s) * m0 + (-2.0 * s3 + 3.0 * s2) * p1 + (s3 - s2) * m1;
}
// elevation warp (normalised 0 = horizon .. 1 = zenith): world elevation -> photo elevation.
// w = (sun elevation in world, sun elevation in photo, slope at sun, slope at zenith); slope 1 at horizon.
float warpT(float t, vec4 w) {
  if (t <= 0.0) return t;
  if (t < w.x) return hermite(0.0, w.y, w.x, w.z * w.x, t / w.x);
  float h = 1.0 - w.x;
  return hermite(w.y, 1.0, w.z * h, w.w * h, (t - w.x) / h);
}
vec2 photoUv(vec3 d, float rot, vec4 w) {
  float t = asin(clamp(d.y, -1.0, 1.0)) / 1.5707963;
  t = warpT(t, w);
  return vec2(fract((atan(d.z, d.x) - rot) / 6.2831853 + 0.5), t * 0.5 + 0.5);
}`;

const SKY_VERT = /* glsl */`
varying vec3 vDir;
void main() {
  vDir = position;
  vec4 p = projectionMatrix * vec4(mat3(viewMatrix) * position, 1.0);
  gl_Position = p.xyww;
}`;
const SKY_FRAG = /* glsl */`
uniform sampler2D tA, tB;
uniform float uB, uRotA, uRotB, uExpo, uHazeW;
uniform vec4 uWarpA, uWarpB, uMoon, uSun;
uniform vec3 uGainA, uGainB, uFog, uFogSun;
varying vec3 vDir;
${GLSL_WARP}
${GLSL_INV_ACES}
float mh(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float mn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mh(i), mh(i + vec2(1, 0)), f.x), mix(mh(i + vec2(0, 1)), mh(i + vec2(1, 1)), f.x), f.y); }
void main() {
  vec3 d = normalize(vDir);
  vec2 ua = photoUv(d, uRotA, uWarpA), ub = photoUv(d, uRotB, uWarpB);
  vec3 ca = texture2D(tA, vec2(ua.x, 1.0 - ua.y)).rgb * uGainA;
  vec3 cb = texture2D(tB, vec2(ub.x, 1.0 - ub.y)).rgb * uGainB;
  vec3 col = invACES(mix(ca, cb, uB), uExpo);
  // moon (the night photo has none; the dusk photo's moon is aligned with uMoon.xyz)
  if (uMoon.w > 0.001) {
    float ch = sqrt(max(2.0 - 2.0 * dot(d, uMoon.xyz), 0.0));
    vec3 mt = normalize(cross(uMoon.xyz, vec3(0.0, 1.0, 0.0))), mb = cross(mt, uMoon.xyz);
    vec2 mp = vec2(dot(d, mt), dot(d, mb)) / 0.0115;
    float maria = 0.72 + 0.28 * smoothstep(0.35, 0.65, mn(mp * 2.3 + 3.0)) * (0.7 + 0.3 * mn(mp * 7.0));
    float disc = 1.0 - smoothstep(0.0105, 0.0125, ch);
    float halo = exp(-ch * 25.0) * 0.12 + exp(-ch * 90.0) * 0.25;
    col += uMoon.w * vec3(0.85, 0.9, 1.0) * (disc * 5.0 * maria + halo * 0.6 / uExpo);
  }
  // aerial perspective: the sky melts into the same fog colour distant geometry fades to
  vec3 fc = mix(uFog, uFogSun, pow(max(dot(d, uSun.xyz), 0.0), uSun.w));
  float hz = d.y <= 0.0 ? 1.0 : exp(-d.y / uHazeW);
  col = mix(col, fc, hz);
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

const BLEND_VERT = /* glsl */`
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
const BLEND_FRAG = /* glsl */`
uniform sampler2D hA, hB;
uniform float uB, uOffA, uOffB, uClampA, uClampB;
uniform vec4 uWarpA, uWarpB;
uniform vec3 uTintA, uTintB, uGround;
varying vec2 vUv;
${GLSL_WARP}
vec3 slot(sampler2D h, vec3 d, float off, vec4 w, float cl, vec3 tint) {
  vec3 c = texture2D(h, photoUv(d, off, w)).rgb;
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  return c * min(1.0, cl / max(l, 1e-6)) * tint;     // sun/moon removed: the DirectionalLight provides it
}
void main() {
  // output is in the "sun frame" (sun azimuth at longitude 0); scene.environmentRotation turns it into place
  float phi = (vUv.x - 0.5) * 6.2831853, el = (vUv.y - 0.5) * 3.1415927;
  vec3 d = vec3(cos(el) * cos(phi), sin(el), cos(el) * sin(phi));
  vec3 c = mix(slot(hA, d, uOffA, uWarpA, uClampA, uTintA), slot(hB, d, uOffB, uWarpB, uClampB, uTintB), uB);
  // lower hemisphere: lit ground instead of the photo's synthetic floor
  c = mix(c, uGround * (0.85 + 0.15 * smoothstep(-0.5, 0.0, d.y)), smoothstep(0.03, -0.06, d.y));
  gl_FragColor = vec4(c, 1.0);
}`;

// ---------------------------------------------------------------------------------------------
// Asset loading helpers
// ---------------------------------------------------------------------------------------------
async function loadJpg(url, width) {
  const r = await fetch(url);
  if (!r.ok) throw new Error('Chýba obloha ' + url);
  const blob = await r.blob();
  const opts = { colorSpaceConversion: 'none', premultiplyAlpha: 'none' };
  const bmp = width ? await createImageBitmap(blob, { ...opts, resizeWidth: width, resizeHeight: width / 2, resizeQuality: 'high' })
    : await createImageBitmap(blob, opts);
  const tex = new THREE.Texture(bmp);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.flipY = false;                      // ImageBitmaps are not flipped by WebGL; the sky shader flips v
  tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.minFilter = THREE.LinearFilter; tex.magFilter = THREE.LinearFilter; tex.generateMipmaps = false;
  tex.needsUpdate = true;
  // horizon profile (display-linear), 64 azimuth bins from 0.5..4 deg elevation
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 128;
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(bmp, 0, 0, 256, 128);
  const px = ctx.getImageData(0, 61, 256, 3).data;
  const prof = new Float32Array(64 * 3);
  const s2l = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  for (let y = 0; y < 3; y++) for (let x = 0; x < 256; x++) {
    const i = (y * 256 + x) * 4, b = (x >> 2) * 3;
    prof[b] += s2l(px[i]) / 12; prof[b + 1] += s2l(px[i + 1]) / 12; prof[b + 2] += s2l(px[i + 2]) / 12;
  }
  return { tex, prof };
}
// robust sky statistics of an equirect HDR (upper hemisphere, solid-angle weighted)
// HDR skies ship as two lossless PNGs (RGBE mantissa RGB + exponent grey, see tools/pack_hdr.py)
async function loadRGBE(stem) {
  const load = async (u) => { const r = await fetch(u); if (!r.ok) throw new Error('Chýba obloha ' + u); return createImageBitmap(await r.blob(), { premultiplyAlpha: 'none', colorSpaceConversion: 'none' }); };
  const [a, b] = await Promise.all([load(stem + '_rgbe.png'), load(stem + '_exp.png')]);
  const w = a.width, h = a.height, cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const g = cv.getContext('2d', { willReadFrequently: true });
  g.drawImage(a, 0, 0); const m = g.getImageData(0, 0, w, h).data;
  g.drawImage(b, 0, 0); const e = g.getImageData(0, 0, w, h).data;
  const out = new Uint16Array(w * h * 4), toH = THREE.DataUtils.toHalfFloat, one = toH(1);
  for (let i = 0; i < w * h; i++) {
    const E = e[i * 4], o = i * 4;
    if (E === 0) { out[o] = out[o + 1] = out[o + 2] = 0; }
    else { const f = Math.pow(2, E - 136); out[o] = toH(Math.min(65000, (m[o] + 0.5) * f)); out[o + 1] = toH(Math.min(65000, (m[o + 1] + 0.5) * f)); out[o + 2] = toH(Math.min(65000, (m[o + 2] + 0.5) * f)); }
    out[o + 3] = one;
  }
  const t = new THREE.DataTexture(out, w, h, THREE.RGBAFormat, THREE.HalfFloatType);
  t.colorSpace = THREE.LinearSRGBColorSpace; t.flipY = true; t.needsUpdate = true;
  return t;
}
function hdrStats(tex, sunDir) {
  const { data, width: w, height: h } = tex.image;
  const half = tex.type === THREE.HalfFloatType, f = half ? THREE.DataUtils.fromHalfFloat : (v) => v;
  const sd = new THREE.Vector3(...sunDir).normalize();
  const acc = (clampL) => {
    let sw = 0, sl = 0, sr = 0, sg = 0, sb = 0;
    for (let y = 1; y < h / 2; y += 3) {
      const el = (0.5 - (y + 0.5) / h) * Math.PI, ce = Math.cos(el), se = Math.sin(el);
      for (let x = 1; x < w; x += 3) {
        const ph = ((x + 0.5) / w - 0.5) * 2 * Math.PI;
        const i = (y * w + x) * 4;
        let r = f(data[i]), g = f(data[i + 1]), b = f(data[i + 2]);
        let l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        if (clampL === 0) {  // pass 1: ignore the sun's neighbourhood
          if (ce * Math.cos(ph) * sd.x + se * sd.y + ce * Math.sin(ph) * sd.z > 0.97) continue;
        } else if (l > clampL) { const k = clampL / l; r *= k; g *= k; b *= k; l = clampL; }
        sw += ce; sl += l * ce; sr += r * ce; sg += g * ce; sb += b * ce;
      }
    }
    return { l: sl / sw, rgb: [sr / sw, sg / sw, sb / sw] };
  };
  const clampL = acc(0).l * 6;
  const s = acc(clampL);
  return { clampL, avgL: s.l, avg: s.rgb };
}

// warp parameters: world elevation dstDeg of the tracked body <- photo elevation srcDeg
function warpParams(dstDeg, srcDeg, out) {
  const a = clamp(dstDeg / 90, 0.02, 0.97), b = clamp(srcDeg / 90, 0.01, 0.97);
  const d1 = b / a, d2 = (1 - b) / (1 - a);
  const m1 = Math.min(2 / (1 / d1 + 1 / d2), 3 * d1, 3 * d2);
  return out.set(a, b, m1, d2);
}

// ---------------------------------------------------------------------------------------------
export async function initEnv(renderer, scene, camera, meta, onProgress) {
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const H = meta.hdri;
  const hiRes = Q().drawDist > 2000;               // high quality: 4k sky photos, 1k IBL source
  let done = 0; const total = KEYS.length * 2;
  const tick = () => { done++; onProgress && onProgress(done / total); };
  const src = {};
  await Promise.all(KEYS.map(async (k) => {
    const [hdr, jpg] = await Promise.all([
      loadRGBE(`${S.base}assets/hdri/${k}`).then(t => { tick(); return t; }),
      loadJpg(`${S.base}assets/hdri/${k}.jpg`, hiRes ? 0 : 2048).then(t => { tick(); return t; }),
    ]);
    hdr.minFilter = THREE.LinearFilter; hdr.magFilter = THREE.LinearFilter; hdr.generateMipmaps = false;
    hdr.wrapS = THREE.RepeatWrapping; hdr.wrapT = THREE.ClampToEdgeWrapping; hdr.needsUpdate = true;
    const sd = H[k].sunDir;
    const st = hdrStats(hdr, sd);
    const tint = new THREE.Vector3(...PHASES[k].iblTint);
    tint.multiplyScalar(1 / (0.2126 * tint.x + 0.7152 * tint.y + 0.0722 * tint.z));
    src[k] = {
      key: k, hdr, jpg: jpg.tex, prof: jpg.prof, stats: st,
      phi: phiOf(sd[0], sd[2]), elDeg: Math.asin(clamp(sd[1], -1, 1)) / DEG,
      iblTint: tint.multiplyScalar(1 / st.avgL),        // normalises the photo to unit mean sky radiance
      rot: 0, warp: new THREE.Vector4(0.5, 0.5, 1, 1), off: 0,
    };
  }));
  for (const k of KEYS) { renderer.initTexture(src[k].jpg); renderer.initTexture(src[k].hdr); }

  // ---- lights
  const sun = new THREE.DirectionalLight(0xffffff, 3);
  sun.name = 'env-sun';
  sun.castShadow = true;
  sun.shadow.camera.near = 1; sun.shadow.camera.far = 700;
  scene.add(sun); scene.add(sun.target);
  const hemi = new THREE.HemisphereLight(0xbcd0ff, 0x6b604f, 0.1);
  hemi.name = 'env-hemi';
  scene.add(hemi);
  scene.fog = new THREE.FogExp2(0xa0b0c0, 0.001);

  // ---- sky dome
  const skyU = {
    tA: { value: null }, tB: { value: null }, uB: { value: 0 }, uRotA: { value: 0 }, uRotB: { value: 0 },
    uWarpA: { value: new THREE.Vector4() }, uWarpB: { value: new THREE.Vector4() },
    uGainA: { value: new THREE.Vector3(1, 1, 1) }, uGainB: { value: new THREE.Vector3(1, 1, 1) },
    uExpo: { value: 1 }, uHazeW: { value: 0.05 }, uMoon: { value: new THREE.Vector4(0, 1, 0, 0) },
    uSun: { value: new THREE.Vector4(0, 1, 0, 4) }, uFog: { value: new THREE.Vector3() }, uFogSun: { value: new THREE.Vector3() },
  };
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 32), new THREE.ShaderMaterial({
    name: 'env-sky', uniforms: skyU, vertexShader: SKY_VERT, fragmentShader: SKY_FRAG,
    side: THREE.BackSide, depthWrite: false, depthTest: true, depthFunc: THREE.LessEqualDepth, fog: false,
  }));
  sky.name = 'env-sky'; sky.frustumCulled = false; sky.renderOrder = 1e9; sky.castShadow = sky.receiveShadow = false;
  scene.add(sky);

  // ---- IBL: blended equirect (float) -> PMREM
  const blendU = {
    hA: { value: null }, hB: { value: null }, uB: { value: 0 }, uOffA: { value: 0 }, uOffB: { value: 0 },
    uClampA: { value: 1 }, uClampB: { value: 1 }, uWarpA: { value: new THREE.Vector4() }, uWarpB: { value: new THREE.Vector4() },
    uTintA: { value: new THREE.Vector3() }, uTintB: { value: new THREE.Vector3() }, uGround: { value: new THREE.Vector3() },
  };
  const blendScene = new THREE.Scene();
  const blendQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
    uniforms: blendU, vertexShader: BLEND_VERT, fragmentShader: BLEND_FRAG, depthTest: false, depthWrite: false,
  }));
  blendQuad.frustumCulled = false; blendScene.add(blendQuad);
  const blendCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  let blendRT = null, pmremRT = null;
  const makeBlendRT = () => {
    const w = Q().shadowMap >= 4096 ? 1024 : 512;
    if (blendRT && blendRT.width === w) return;
    if (blendRT) blendRT.dispose();
    if (pmremRT) { pmremRT.dispose(); pmremRT = null; }
    blendRT = new THREE.WebGLRenderTarget(w, w / 2, {
      type: THREE.HalfFloatType, format: THREE.RGBAFormat, depthBuffer: false, generateMipmaps: false,
      minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, wrapS: THREE.RepeatWrapping, colorSpace: THREE.LinearSRGBColorSpace,
    });
  };
  makeBlendRT();

  // ---- state
  const v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), c1 = new THREE.Color();
  const sunDir = new THREE.Vector3(), moonDir = new THREE.Vector3(), lightDir = new THREE.Vector3(0, 1, 0);
  const shadowDir = new THREE.Vector3(0, 1, 0);
  const lookM = new THREE.Matrix4(), ax = new THREE.Vector3(), ay = new THREE.Vector3(), az = new THREE.Vector3();
  const fogA = new THREE.Vector3(), fogS = new THREE.Vector3(), tmpA = new THREE.Vector3(), tmpS = new THREE.Vector3();
  const skyMean = new THREE.Vector3(), ground = new THREE.Vector3();
  const regenAt = { a: '', b: '', t: -1, offA: 0, offB: 0, wA: new THREE.Vector4(), wB: new THREE.Vector4(), g: new THREE.Vector3(), time: -1e9 };
  let forceRegen = true, forceShadow = true;

  const ENV = {
    sun, hemi, sky, timeScale: 1, running: true,
    sunDir, moonDir, phase: { a: 'day', b: 'day', t: 0 }, sunElevation: 0,
    stats: { pmremMs: 0, regens: 0 },
    update, setTime, skip, clockString, setQuality,
    regenIBL: () => { forceRegen = true; regenAt.time = -1e9; update(0, camera, null); },
  };

  function phaseAt(elDeg) {
    if (elDeg >= PK[0][0]) return ['day', 'day', 0];
    for (let i = 0; i < PK.length - 1; i++) {
      const [e0, p0] = PK[i], [e1, p1] = PK[i + 1];
      if (elDeg >= e1) return p0 === p1 ? [KEYS[p0], KEYS[p0], 0] : [KEYS[p0], KEYS[p1], sstep(0, 1, (e0 - elDeg) / (e0 - e1))];
    }
    return ['night', 'night', 0];
  }
  // world placement of a photo: rot = longitude offset, warp = elevation warp
  function place(s, sunEl, moonEl) {
    const P = PLACE[s.key];
    let phiW, dst = s.elDeg;
    if (P.track === 'sun') { phiW = phiOf(sunDir.x, sunDir.z); dst = clamp(sunEl, P.lo, P.hi); }
    else if (P.track === 'moon') { phiW = phiOf(moonDir.x, moonDir.z); dst = clamp(moonEl, P.lo, P.hi); }
    else { dirFromAzEl(P.az * DEG, 0, v1); phiW = phiOf(v1.x, v1.z); }
    s.rot = wrapPi(phiW - s.phi);
    warpParams(dst, s.elDeg, s.warp);
  }
  // average horizon colour of a photo around longitude phiTex (triangular window)
  function horizon(s, phiTex, halfW, out) {
    out.set(0, 0, 0); let sw = 0;
    for (let i = 0; i < 64; i++) {
      const ph = ((i + 0.5) / 64 - 0.5) * 2 * Math.PI;
      const w = Math.max(0, 1 - Math.abs(wrapPi(ph - phiTex)) / halfW);
      if (w <= 0) continue;
      out.x += s.prof[i * 3] * w; out.y += s.prof[i * 3 + 1] * w; out.z += s.prof[i * 3 + 2] * w; sw += w;
    }
    return out.multiplyScalar(1 / Math.max(sw, 1e-6));
  }

  function update(dt = 0, cam = camera, target = null) {
    if (ENV.running && !S.paused && dt > 0) S.tod = ((S.tod + dt * ENV.timeScale / 1440) % 1 + 1) % 1;
    const q = Q();
    // --- sun & moon
    sunVec(S.tod, sunDir);
    const sunEl = Math.asin(sunDir.y) / DEG;
    const sunAz = azOf(sunDir);
    const moonEl = clamp(14 + (-sunEl - 2) * 1.2, 8, 38);
    dirFromAzEl(sunAz + Math.PI, moonEl * DEG, moonDir);
    ENV.sunElevation = sunEl;
    S.night = sstep(6, -8, sunEl);
    if (WORLD.uniforms && WORLD.uniforms.uNight) WORLD.uniforms.uNight.value = S.night;

    // --- sky phases
    const [ka, kb, bt] = phaseAt(sunEl);
    ENV.phase.a = ka; ENV.phase.b = kb; ENV.phase.t = bt;
    const A = src[ka], B = src[kb], PA = PHASES[ka], PB = PHASES[kb];
    place(A, sunEl, moonEl); if (B !== A) place(B, sunEl, moonEl);
    const expo = lerp(PA.exposure, PB.exposure, bt);
    renderer.toneMappingExposure = expo;

    // --- direct light: sun by day, moon by night
    const sunI = 3.2 * sunLight(sunEl, c1);
    const moonI = 0.22 * sstep(-2, -10, sunEl);
    if (sunI >= moonI) { lightDir.copy(sunDir); sun.color.copy(c1); sun.intensity = sunI; }
    else { lightDir.copy(moonDir); sun.color.setRGB(0.62, 0.74, 1.0); sun.intensity = moonI; }
    S.sunDir.copy(lightDir);
    sun.shadow.intensity = sunI >= moonI ? 1 : 0.85;

    // --- ambient
    const dayK = lerp(0.72, 1.0, sstep(10, 45, sunEl));   // low morning / evening sun: dimmer sky
    const skyL = lerp(PA.sky * (ka === 'day' ? dayK : 1), PB.sky * (kb === 'day' ? dayK : 1), bt);
    scene.environmentIntensity = skyL * 0.88;
    const albedo = 0.16;
    const eDirect = sun.intensity * Math.max(lightDir.y, 0);
    ground.set(0.95, 0.9, 0.8).multiplyScalar(albedo * (eDirect / (Math.PI * skyL) + 1));
    ground.add(v1.set(0.012, 0.0075, 0.0035).multiplyScalar(S.night / skyL));   // warm sodium bounce at night
    skyMean.set(...A.stats.avg).multiplyScalar(1 / A.stats.avgL).lerp(v1.set(...B.stats.avg).multiplyScalar(1 / B.stats.avgL), bt);
    skyMean.multiply(v1.set(...PA.iblTint).lerp(v2.set(...PB.iblTint), bt));
    hemi.color.setRGB(skyMean.x, skyMean.y, skyMean.z);
    hemi.groundColor.setRGB(ground.x, ground.y, ground.z);
    hemi.intensity = 0.12 * Math.PI * skyL;

    // --- fog / aerial perspective colours from the photos' horizon, in scene-linear units
    const sunPhiW = phiOf(sunDir.x, sunDir.z);
    const fogCols = (s, gain, outA, outS) => {
      horizon(s, sunPhiW - s.rot + Math.PI, 110 * DEG, outA).multiply(gain);
      horizon(s, sunPhiW - s.rot, 35 * DEG, outS).multiply(gain);
    };
    fogCols(A, v1.set(...PA.bg), fogA, fogS);
    fogCols(B, v2.set(...PB.bg), tmpA, tmpS);
    fogA.lerp(tmpA, bt); fogS.lerp(tmpS, bt);
    invACES(fogA, expo, fogA); invACES(fogS, expo, fogS);
    scene.fog.color.setRGB(fogA.x, fogA.y, fogA.z);
    FOG_U.fogSunColor[0] = fogS.x; FOG_U.fogSunColor[1] = fogS.y; FOG_U.fogSunColor[2] = fogS.z;
    const sunPow = lerp(PA.sunPow, PB.sunPow, bt);
    FOG_U.fogSunDir[0] = sunDir.x; FOG_U.fogSunDir[1] = sunDir.y; FOG_U.fogSunDir[2] = sunDir.z; FOG_U.fogSunDir[3] = sunPow;
    const dd = q.drawDist;
    scene.fog.density = 2.2 / dd * lerp(PA.fog, PB.fog, bt);
    FOG_U.fogParams[0] = 1 / 150; FOG_U.fogParams[1] = 0; FOG_U.fogParams[2] = dd * 0.7; FOG_U.fogParams[3] = dd * 0.95;
    if (cam && cam.far !== dd) { cam.far = dd; cam.updateProjectionMatrix(); }

    // --- sky dome uniforms
    skyU.tA.value = A.jpg; skyU.tB.value = B.jpg; skyU.uB.value = bt;
    skyU.uRotA.value = A.rot; skyU.uRotB.value = B.rot;
    skyU.uWarpA.value.copy(A.warp); skyU.uWarpB.value.copy(B.warp);
    skyU.uGainA.value.set(...PA.bg); skyU.uGainB.value.set(...PB.bg);
    skyU.uExpo.value = expo; skyU.uHazeW.value = lerp(PA.hazeW, PB.hazeW, bt);
    skyU.uFog.value.copy(fogA); skyU.uFogSun.value.copy(fogS);
    skyU.uSun.value.set(sunDir.x, sunDir.y, sunDir.z, sunPow);
    const moonW = (ka === 'night' ? 1 - bt : 0) + (kb === 'night' ? bt : 0);
    skyU.uMoon.value.set(moonDir.x, moonDir.y, moonDir.z, moonW);

    // --- IBL regeneration (throttled; only when the blend visibly changed)
    scene.environmentRotation.set(0, -sunPhiW, 0);
    const offA = wrapPi(sunPhiW - A.rot), offB = wrapPi(sunPhiW - B.rot);
    const now = performance.now() / 1000;
    const changed = forceRegen || regenAt.a !== ka || regenAt.b !== kb || Math.abs(regenAt.t - bt) > 0.03 ||
      Math.abs(wrapPi(regenAt.offA - offA)) > 2 * DEG || Math.abs(wrapPi(regenAt.offB - offB)) > 2 * DEG ||
      Math.abs(regenAt.wA.x - A.warp.x) > 0.015 || Math.abs(regenAt.wB.x - B.warp.x) > 0.015 ||
      Math.abs(regenAt.g.y - ground.y) > 0.08 * Math.max(regenAt.g.y, 0.05);
    if (changed && (forceRegen || now - regenAt.time > 1.0)) {
      const t0 = performance.now();
      blendU.hA.value = A.hdr; blendU.hB.value = B.hdr; blendU.uB.value = bt;
      blendU.uOffA.value = A.rot - sunPhiW; blendU.uOffB.value = B.rot - sunPhiW;
      blendU.uWarpA.value.copy(A.warp); blendU.uWarpB.value.copy(B.warp);
      blendU.uClampA.value = A.stats.clampL; blendU.uClampB.value = B.stats.clampL;
      blendU.uTintA.value.copy(A.iblTint); blendU.uTintB.value.copy(B.iblTint);
      blendU.uGround.value.copy(ground);
      const prevRT = renderer.getRenderTarget();
      renderer.setRenderTarget(blendRT);
      renderer.render(blendScene, blendCam);
      renderer.setRenderTarget(prevRT);
      pmremRT = pmrem.fromEquirectangular(blendRT.texture, pmremRT);
      scene.environment = pmremRT.texture;
      Object.assign(regenAt, { a: ka, b: kb, t: bt, offA, offB, time: now });
      regenAt.wA.copy(A.warp); regenAt.wB.copy(B.warp); regenAt.g.copy(ground);
      forceRegen = false;
      ENV.stats.pmremMs = performance.now() - t0; ENV.stats.regens++;
    }

    // --- shadow camera: follows the target, texel snapped, light direction quantised
    if (forceShadow || shadowDir.angleTo(lightDir) > 0.1 * DEG) { shadowDir.copy(lightDir); forceShadow = false; }
    const size = q.shadowDist, texel = size / q.shadowMap;
    const sc = sun.shadow.camera;
    if (sc.right !== size / 2 || sun.shadow.mapSize.x !== q.shadowMap) {
      sc.left = -size / 2; sc.right = size / 2; sc.top = size / 2; sc.bottom = -size / 2; sc.updateProjectionMatrix();
      if (sun.shadow.mapSize.x !== q.shadowMap) {
        sun.shadow.mapSize.set(q.shadowMap, q.shadowMap);
        if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
      }
    }
    sun.shadow.bias = -0.00003;
    sun.shadow.normalBias = texel * 1.6;
    const center = v1.copy(target || (cam ? cam.position : v2.set(0, 0, 0)));
    if (cam) { cam.getWorldDirection(v2); v2.y = 0; if (v2.lengthSq() > 1e-6) center.addScaledVector(v2.normalize(), size * 0.22); }
    lookM.lookAt(shadowDir, v2.set(0, 0, 0), sun.shadow.camera.up);
    lookM.extractBasis(ax, ay, az);
    const px = center.dot(ax), py = center.dot(ay);
    center.addScaledVector(ax, Math.round(px / texel) * texel - px).addScaledVector(ay, Math.round(py / texel) * texel - py);
    sun.target.position.copy(center);
    sun.position.copy(center).addScaledVector(shadowDir, 400);
    sun.target.updateMatrixWorld(); sun.updateMatrixWorld();
  }

  function setTime(tod) {
    S.tod = ((tod % 1) + 1) % 1; forceRegen = true; forceShadow = true;
    update(0, camera, null);
  }
  function skip() {
    const h = S.tod * 24;
    let next = SKIP.find(x => x > h + 0.01);
    if (next === undefined) next = SKIP[0];
    setTime(next / 24);
  }
  function clockString() {
    const m = Math.floor(S.tod * 1440 + 1e-6) % 1440;
    return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
  }
  function setQuality(qname) {
    if (qname && qname !== S.quality) S.quality = qname;
    makeBlendRT();
    forceRegen = true; forceShadow = true;
    update(0, camera, null);
  }

  setTime(S.tod);
  onProgress && onProgress(1);
  return ENV;
}
