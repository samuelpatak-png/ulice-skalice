// PBR materials built on Poly Haven CC0 texture sets packed into texture arrays.
//
// ONE world material (MeshStandardMaterial + onBeforeCompile) renders the whole city: every vertex carries
//   color = tint (linear; multiplies the albedo of the layer — use tintFor() to get an absolute albedo),
//   mat   = texture layer (L.*) or L.GROUND (splat-mapped terrain),
//   fa    = facade/surface params (walls: u along wall, v height above building base, wall length, eave height;
//           roads: u along road, s across road (m), half width, 0; parking: dir.x, dir.z, u offset, v offset),
//   ft    = facade / surface type (see FT below). A fractional part (< 0.5) carries a per-surface flag.
// Flat surface types (ft 30..69) get a depth bias toward the camera by priority (no z-fighting at any distance).
import * as THREE from 'three';
import { S } from '../core/state.js';

// keep in sync with tools/fetch_assets.py TEXTURES
export const L = {
  ASPHALT: 0, PAVERS: 1, COBBLE: 2, PLASTER: 3, PLASTER_ROUGH: 4, ROOF_CLAY: 5, ROOF_GREY: 6, GRASS: 7, PRECAST: 8,
  CORRUGATED: 9, CLADDING: 10, BRICK: 11, BARK: 12, GRAVEL_ROOF: 13, STONE: 14, FOREST: 15, ASPHALT_LIGHT: 16, DIRT: 17,
  GROUND: 50,
};
// facade / surface types (ft). Walls 0..29, flat ground-level surfaces 30..69 (depth-biased), paint 60..64.
export const FT = {
  PLAIN: 0, HOUSE: 1, OLDTOWN: 2, PANEL: 3, SHOPS: 4, INDUSTRIAL: 5, CHURCH: 6, RETAIL: 7, GREENHOUSE: 8, KD: 9,
  STONEWALL: 10, BELFRY: 11, FENCE: 12, CURTAIN: 13, GARAGE: 14, CIVIC: 15, DOOR: 16, PLANKS: 17, PATINA: 18, GOLD: 19,
  ROOF: 20, FLATROOF: 21, METALROOF: 22, GLASSROOF: 23, CLOCK: 24, STEEL: 25, RAILING: 26, FOLIAGE: 27, SOLAR: 28, CORNICE: 29,
  ROAD_MAIN: 30, ROAD: 31, ROAD_SETTS: 32, ROAD_SERVICE: 33, TRACK: 34, PATH: 35, FOOTWAY: 36, SIDEWALK: 37, CURB: 38,
  PLAZA: 39, PARKING: 40, PITCH: 41, TARTAN: 42, SAND: 43, BALLAST: 44, BRIDGE: 45, GRAVE: 46,
  LOT: 47, LOTLINE: 48, LOTROW: 49,   // surveyed car parks: aisle base, paver bay lines, bay rows / walks / lawns
  PAINT: 60, PAINT_YELLOW: 61, ZEBRA: 63,
};
// flag values carried in the fractional part of ft
export const FLAG = { A: 0.25, B: 0.125, AB: 0.375 };

// metres per texture repeat, normal strength, roughness multiplier
const LAYER = [
  [4.5, 1.0, 1.0], [2.2, 0.9, 1.0], [2.0, 1.2, 1.0], [3.2, 0.7, 1.0], [3.0, 0.9, 1.0], [2.4, 1.1, 0.95], [2.4, 1.0, 0.9],
  [3.0, 0.9, 1.0], [4.0, 0.8, 1.0], [3.0, 1.0, 0.9], [3.0, 0.8, 0.9], [2.0, 1.0, 1.0], [1.6, 1.2, 1.0], [3.0, 0.9, 1.0],
  [2.6, 1.2, 1.0], [3.2, 1.0, 1.0], [4.5, 0.9, 1.0], [3.4, 1.0, 1.0],
];
// minimum roughness per layer (gravel_road ships an all-black roughness channel)
const ROUGH_MIN = { 17: 0.86, 7: 0.75, 15: 0.8 };
// measured linear mean albedo of each set (replaced by values measured at load time)
const MEAN_DEFAULT = [[0.1016, 0.1004, 0.0874], [0.2447, 0.2057, 0.1519], [0.3015, 0.276, 0.2292], [0.4994, 0.448, 0.371], [0.2066, 0.1694, 0.0957], [0.3102, 0.0831, 0.0217], [0.1225, 0.1103, 0.0736], [0.3191, 0.2348, 0.1004], [0.3175, 0.2487, 0.1779], [0.0952, 0.095, 0.078], [0.0964, 0.0905, 0.0745], [0.2778, 0.1353, 0.0806], [0.1226, 0.1004, 0.0572], [0.0459, 0.0405, 0.0313], [0.1855, 0.1351, 0.071], [0.293, 0.1763, 0.0477], [0.3123, 0.2725, 0.2137], [0.1905, 0.0962, 0.0451]];
// depth-bias priority of flat surface types (index ft - 30)
const PRIO = new Array(40).fill(0);
Object.entries({ 30: 6, 31: 5, 32: 5, 33: 4, 34: 3, 35: 2, 36: 2.5, 37: 7, 38: 7, 39: 1, 40: 2, 41: 1, 42: 1.5, 43: 1.5, 44: 2, 45: 6, 46: 1, 47: 4.6, 48: 8.5, 49: 5.2,
  60: 9, 61: 9, 62: 9, 63: 9, 64: 9 }).forEach(([k, v]) => { PRIO[k - 30] = v; });

export const WORLD = { uniforms: null, material: null, mean: MEAN_DEFAULT.map(m => m.slice()) };

// tint that makes `layer` render with the given average linear albedo
export function tintFor(layer, c) {
  const m = WORLD.mean[layer] || [0.5, 0.5, 0.5];
  return [c[0] / m[0], c[1] / m[1], c[2] / m[2]];
}

async function loadBitmap(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error('Chýba textúra ' + url);
  const b = await r.blob();
  return await createImageBitmap(b, { premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
}

// Raw (non-premultiplied) RGBA readback through WebGL2: a 2D canvas would premultiply and destroy the RGB of
// texels with tiny alpha (normal maps keep roughness in alpha).
let _gl = null, _glProg = null;
function glReader() {
  if (_gl !== null) return _gl || null;
  try {
    const cv = document.createElement('canvas');
    const gl = cv.getContext('webgl2', { premultipliedAlpha: false, antialias: false, preserveDrawingBuffer: true });
    if (!gl) { _gl = false; return null; }
    const vs = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vs, '#version 300 es\nout vec2 uv; void main(){ vec2 p = vec2(float((gl_VertexID<<1)&2), float(gl_VertexID&2)); uv = p; gl_Position = vec4(p*2.0-1.0,0.0,1.0); }');
    gl.compileShader(vs);
    const fs = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fs, '#version 300 es\nprecision highp float; uniform sampler2D t; in vec2 uv; out vec4 o; void main(){ o = texture(t, uv); }');
    gl.compileShader(fs);
    const pr = gl.createProgram(); gl.attachShader(pr, vs); gl.attachShader(pr, fs); gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) { _gl = false; return null; }
    _glProg = pr; _gl = gl;
    return gl;
  } catch (e) { _gl = false; return null; }
}
function readPixelsGL(img, size) {
  const gl = glReader();
  if (!gl) return null;
  gl.canvas.width = size; gl.canvas.height = size;
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, img);
  gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.viewport(0, 0, size, size);
  gl.disable(gl.BLEND);
  gl.useProgram(_glProg);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  const out = new Uint8Array(size * size * 4);
  gl.readPixels(0, 0, size, size, gl.RGBA, gl.UNSIGNED_BYTE, out);
  gl.deleteTexture(tex);
  // framebuffer row 0 samples texture row 0 (= image top), so rows come out top-down like getImageData
  return out;
}

export async function loadTextureArrays(meta, albedoSize, normalSize, progress) {
  const ids = meta.textures.map(t => t.id);
  const N = ids.length;
  const mean = [];
  const pack = async (suffix, size, k0, measure) => {
    const data = new Uint8Array(size * size * 4 * N);
    let cv = null, ctx = null;
    for (let i = 0; i < N; i++) {
      const img = await loadBitmap(`${S.base}assets/tex/${ids[i]}_${suffix}.webp`);
      let px = null;
      try { px = readPixelsGL(img, size); } catch (e) { px = null; }
      if (!px) {
        if (!cv) { cv = document.createElement('canvas'); cv.width = cv.height = size; ctx = cv.getContext('2d', { willReadFrequently: true }); }
        ctx.clearRect(0, 0, size, size);
        ctx.drawImage(img, 0, 0, size, size);
        px = ctx.getImageData(0, 0, size, size).data;
      }
      data.set(px, i * size * size * 4);
      if (measure) {
        let r = 0, g = 0, b = 0, n = 0;
        for (let k = 0; k < px.length; k += 4 * 37) { r += Math.pow(px[k] / 255, 2.2); g += Math.pow(px[k + 1] / 255, 2.2); b += Math.pow(px[k + 2] / 255, 2.2); n++; }
        mean[i] = [r / n, g / n, b / n];
      }
      img.close && img.close();
      progress && progress(k0 + (i + 1) / N * 0.5);
    }
    const tex = new THREE.DataArrayTexture(data, size, size, N);
    tex.format = THREE.RGBAFormat; tex.type = THREE.UnsignedByteType;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.minFilter = THREE.LinearMipmapLinearFilter; tex.magFilter = THREE.LinearFilter;
    tex.generateMipmaps = true; tex.anisotropy = 8;
    tex.needsUpdate = true;
    return tex;
  };
  const alb = await pack('a', albedoSize, 0, true);
  const nrm = await pack('n', normalSize, 0.5, false);
  return { alb, nrm, count: N, metal: meta.textures.map(t => t.metal), mean };
}

const GLSL_COMMON = /* glsl */`
precision highp sampler2DArray;
uniform sampler2DArray uAlb;
uniform sampler2DArray uNrm;
uniform float uScale[24];
uniform float uNrmK[24];
uniform float uRoughK[24];
uniform float uRoughMin[24];
uniform vec3 uMean[24];
uniform float uNight;
uniform float uDebug;
uniform float uWet;
uniform float uTime;
uniform sampler2D uSplat;
uniform sampler2D uSplat2;
uniform vec4 uSplatBox;
varying float vMat; varying vec4 vFa; varying float vFt; varying vec3 vWPos; varying vec3 vWN;
float h11(float n) { return fract(sin(n * 127.1) * 43758.5453); }
float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p) { vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1, 0)), u.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), u.x), u.y); }
float fbm(vec2 p) { return 0.5 * vnoise(p) + 0.3 * vnoise(p * 2.13 + 1.7) + 0.2 * vnoise(p * 4.37 + 3.1); }
vec3 s2l(vec3 c) { return pow(c, vec3(2.2)); }
float lum(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
vec3 sAlb; float sAO; vec3 sN; float sRough; float sMetal; vec3 sEmis; float sSpecK;

void layerSample(float layer, vec2 uv, bool bomb, out vec4 A, out vec4 Nm) {
  A = texture(uAlb, vec3(uv, layer)); Nm = texture(uNrm, vec3(uv, layer));
  if (bomb) { // break up tiling with a second, rotated lookup blended by low-frequency noise
    vec2 uv2 = mat2(0.8, -0.6, 0.6, 0.8) * uv * 0.61 + 0.37;
    vec4 A2 = texture(uAlb, vec3(uv2, layer)); vec4 N2 = texture(uNrm, vec3(uv2, layer));
    float w = smoothstep(0.35, 0.65, vnoise(uv * 0.23));
    A = mix(A, A2, w); Nm = mix(Nm, N2, w);
  }
}
vec3 tnormal(vec4 Nm, int li) { vec3 nt = Nm.rgb * 2.0 - 1.0; nt.xy *= uNrmK[li]; return nt; }
float lrough(vec4 Nm, int li) { return clamp(max(Nm.a * uRoughK[li], uRoughMin[li]), 0.04, 1.0); }

vec3 glassCol(vec2 cell, float fy) {
  float r = h21(cell);
  vec3 g = mix(vec3(0.030, 0.036, 0.045), vec3(0.075, 0.085, 0.10), fy);
  g = mix(g, vec3(0.25, 0.20, 0.14), step(0.8, r) * 0.6);          // curtains
  g = mix(g, vec3(0.16, 0.16, 0.15), step(0.93, r) * 0.7);         // blinds
  return g;
}
// anti-aliased box mask: 1 inside [a,b] (per component) with ~1px soft edges
float aabox(vec2 p, vec2 a, vec2 b, vec2 fw) {
  vec2 s = smoothstep(a - fw, a + fw, p) * (1.0 - smoothstep(b - fw, b + fw, p));
  return s.x * s.y;
}

// ---------------------------------------------------------------------------------------------------------
// Facade layout: finds the opening (window / door / shop window) of the bay & floor containing (u, v).
// Returns kind: 0 none, 1 window, 2 door, 3 shop window, 4 belfry opening, 5 garage / roller door,
// 6 strip window, 7 arched church window, 8 greenhouse glazing. rect = (u0, v0, u1, v1). cell = id for random.
// ---------------------------------------------------------------------------------------------------------
float winLayout(float ti, float flag, vec2 p, float Lw, float eave, out vec4 rect, out vec2 cell, out float depth) {
  float u = p.x, v = p.y;
  rect = vec4(-10.0); cell = vec2(0.0); depth = 0.15;
  if (v > eave - 0.25 && ti != 11.0) return 0.0;
  if (ti == 8.0) { // greenhouse: glazing grid everywhere
    vec2 c = floor(vec2(u / 1.2, v / 0.9));
    rect = vec4(c.x * 1.2 + 0.04, c.y * 0.9 + 0.04, c.x * 1.2 + 1.16, c.y * 0.9 + 0.86); cell = c; depth = 0.01;
    return 8.0;
  }
  if (ti == 11.0) { // tower belfry: one arched opening per side near the top
    float hw = min(0.6, Lw * 0.14);
    rect = vec4(Lw * 0.5 - hw, eave - 5.2, Lw * 0.5 + hw, eave - 2.0); cell = vec2(1.0, 0.0); depth = 0.5;
    return 4.0;
  }
  if (ti == 6.0) { // church: tall arched windows
    float nb = max(1.0, floor(Lw / 5.5 + 0.001)); float bw = Lw / nb;
    if (bw > Lw + 0.01 || Lw < 4.0) return 0.0;
    float k = floor(u / bw); float cx = (k + 0.5) * bw;
    float top = eave - 1.6, bot = min(3.2, eave * 0.35);
    rect = vec4(cx - 0.65, bot, cx + 0.65, top); cell = vec2(k, 7.0); depth = 0.35;
    if (u < 1.0 || u > Lw - 1.0 || top - bot < 1.5) return 0.0;
    return 7.0;
  }
  if (ti == 7.0) { // retail box: glass sections at the bottom
    float k = floor(u / 23.0); float f0 = k * 23.0;
    rect = vec4(f0 + 23.0 * 0.62, 0.15, f0 + 23.0 * 0.9, min(3.4, eave - 1.0)); cell = vec2(k, 0.0); depth = 0.05;
    if (rect.x < 0.75 || rect.z > Lw - 0.75) return 0.0;
    return 3.0;
  }
  if (ti == 5.0) { // industrial: ribbon windows under the eave + one roller door on the road side
    if (flag > 0.1 && Lw > 12.0 && eave > 5.0) {
      rect = vec4(Lw * 0.5 - 2.3, 0.0, Lw * 0.5 + 2.3, min(4.6, eave - 2.8)); cell = vec2(floor(Lw), 3.0); depth = 0.12;
      if (u > rect.x - 0.3 && u < rect.z + 0.3 && v < rect.w + 0.4) return 5.0;
    }
    if (eave < 3.8 || Lw < 4.0) return 0.0;
    float k = floor(u / 1.25);
    rect = vec4(k * 1.25 + 0.05, eave - 2.3, k * 1.25 + 1.2, eave - 1.1); cell = vec2(k, 1.0); depth = 0.06;
    if (u < 0.9 || u > Lw - 0.9) return 0.0;
    return 6.0;
  }
  if (ti == 14.0) { // garages: one up-and-over door per 3 m bay
    float nb = max(1.0, floor(Lw / 2.95 + 0.001)); float bw = Lw / nb;
    if (bw > 4.5 || Lw < 2.6) return 0.0;
    float k = floor(u / bw); float cx = (k + 0.5) * bw;
    float hw = min(1.2, bw * 0.5 - 0.2);
    rect = vec4(cx - hw, 0.0, cx + hw, min(2.15, eave - 0.35)); cell = vec2(k + floor(Lw * 7.0), 2.0); depth = 0.1;
    return 5.0;
  }
  // storey based facades
  float bay = 3.6, fh = 3.0, ww = 1.25, wh = 1.35, sill = 0.9; depth = 0.14;
  if (ti == 2.0 || ti == 9.0) { bay = 3.1; fh = 3.7; ww = 1.1; wh = 1.75; sill = 0.95; depth = 0.28; }
  else if (ti == 3.0) { bay = 3.0; fh = 2.8; ww = 1.5; wh = 1.35; sill = 0.9; depth = 0.12;
    if (Lw < 13.5) return 0.0; } // blind gable walls
  else if (ti == 4.0) { bay = 3.1; fh = 3.7; ww = 1.1; wh = 1.75; sill = 0.95; depth = 0.22; }
  else if (ti == 15.0) { bay = 3.4; fh = 3.4; ww = 2.0; wh = 1.9; sill = 0.9; depth = 0.18; }
  float nb = max(1.0, floor(Lw / bay + 0.001)); float bw = Lw / nb;
  if (Lw < 2.2) return 0.0;
  float k = floor(u / bw); float cx = (k + 0.5) * bw;
  float fl = floor(v / fh), fy0 = fl * fh;
  if (v < 0.0 || fy0 + fh > eave + 0.4) return 0.0;
  cell = vec2(k + floor(Lw * 3.0) * 17.0, fl);
  ww = min(ww, bw - 0.7);
  bool margin = cx - ww * 0.5 > 0.55 && cx + ww * 0.5 < Lw - 0.55;
  if (!margin) return 0.0;
  if (ti == 4.0 && fl < 0.5) { // shop front
    float hw = min(bw * 0.42, bw * 0.5 - 0.25);
    rect = vec4(cx - hw, 0.25, cx + hw, fh * 0.78); cell.y = -1.0; depth = 0.14;
    return 3.0;
  }
  float doorBay = floor(nb * 0.5);
  if (flag > 0.1 && fl < 0.5) { // entrance on the street side
    bool isDoor = false; float dw = 1.0, dh = 2.15;
    if (ti == 1.0) isDoor = k == doorBay;
    else if (ti == 2.0 || ti == 9.0) { isDoor = mod(k, 4.0) == 1.0; dw = 1.2; dh = 2.5; if (nb > 3.0 && k == nb - 2.0 && mod(k, 4.0) != 1.0) { isDoor = true; dw = 2.4; dh = 3.0; } }
    else if (ti == 3.0) { isDoor = mod(k, 6.0) == 3.0; dw = 1.7; dh = 2.35; }
    else if (ti == 15.0) { isDoor = k == doorBay; dw = 2.0; dh = 2.6; }
    if (isDoor) { rect = vec4(cx - dw * 0.5, 0.12, cx + dw * 0.5, 0.12 + dh); cell.y = -2.0; depth = 0.22; return 2.0; }
  }
  if (ti == 3.0) {
    if (flag > 0.1 && mod(k, 6.0) == 3.0) { // stairwell windows on the half landings
      float fs = floor((v + fh * 0.5) / fh);
      if (fs < 1.0 || fs * fh + fh * 0.5 > eave) return 0.0;
      rect = vec4(cx - 0.5, fs * fh - 0.35, cx + 0.5, fs * fh + 0.75); depth = 0.12; cell.y = fs + 0.5;
      return 1.0;
    }
    if (flag < 0.1 && mod(k, 3.0) == 1.0 && fl > 0.5) { // balcony door + window
      rect = vec4(cx - 0.75, fy0 + 0.12, cx + 0.75, fy0 + 2.35); depth = 0.12; cell.y += 0.5;
      return 1.0;
    }
  }
  rect = vec4(cx - ww * 0.5, fy0 + sill, cx + ww * 0.5, fy0 + sill + wh);
  if (mod(flag + 0.001, 0.125) > 0.03) depth = 0.09;   // surveyed panel facades: shallow reveals
  return 1.0;
}

// shading of what is seen inside an opening (point q in facade coordinates, already parallax shifted)
void openingShade(float kind, vec4 rect, vec2 q, vec2 cell, float ti, float flag, vec3 N, vec2 fwp) {
  vec2 lp = q - rect.xy; vec2 sz = rect.zw - rect.xy;
  float r = h21(cell + floor(vFa.z * 13.0));
  sN = N; sAO = 1.0; sMetal = 0.0;
  if (kind == 4.0) { // belfry: dark void with louvres
    float lv = step(0.55, fract(q.y / 0.32));
    sAlb = mix(vec3(0.012), vec3(0.08, 0.07, 0.06), lv); sRough = 0.8;
    return;
  }
  if (kind == 5.0) { // garage / roller door
    vec3 dc = r < 0.3 ? vec3(0.23, 0.12, 0.06) : r < 0.55 ? vec3(0.5, 0.5, 0.48) : r < 0.7 ? vec3(0.08, 0.16, 0.1) : r < 0.82 ? vec3(0.08, 0.12, 0.22) : vec3(0.62, 0.6, 0.55);
    if (ti == 5.0) dc = vec3(0.35, 0.37, 0.38);
    float rib = ti == 5.0 ? smoothstep(0.0, 0.5, fract(q.y / 0.11)) : smoothstep(0.1, 0.6, fract(lp.x / 0.14));
    sAlb = dc * (0.82 + 0.25 * rib); sRough = 0.45; sMetal = 0.4;
    float fr = 1.0 - aabox(lp, vec2(0.05), sz - 0.05, vec2(0.004));
    sAlb = mix(sAlb, dc * 0.55, fr);
    return;
  }
  if (kind == 2.0) { // entrance door
    vec3 dc = r < 0.35 ? vec3(0.14, 0.07, 0.035) : r < 0.55 ? vec3(0.62, 0.62, 0.6) : r < 0.75 ? vec3(0.04, 0.045, 0.05) : vec3(0.05, 0.11, 0.07);
    if (ti == 3.0 || ti == 15.0) dc = vec3(0.35, 0.36, 0.37);
    float fw = 0.07;
    float frame = 1.0 - aabox(lp, vec2(fw), sz - vec2(fw, fw * 0.5), vec2(0.004));
    bool dbl = sz.x > 1.5;
    float mid = dbl ? step(abs(lp.x - sz.x * 0.5), 0.03) : 0.0;
    float lx = dbl ? fract(lp.x / (sz.x * 0.5)) : lp.x / sz.x;
    bool glassy = ti == 3.0 || ti == 15.0 || r > 0.5 || sz.x > 2.0;
    float gl = glassy ? aabox(vec2(lx, lp.y / sz.y), vec2(0.18, 0.42), vec2(0.82, 0.9), vec2(0.004)) : 0.0;
    float pan = aabox(vec2(lx, lp.y / sz.y), vec2(0.18, 0.1), vec2(0.82, 0.36), vec2(0.004));
    sAlb = dc * (1.0 - 0.18 * pan); sRough = 0.5;
    if (gl > 0.5) { sAlb = vec3(0.03, 0.035, 0.04); sRough = 0.05; sEmis = uNight * vec3(1.0, 0.8, 0.55) * 1.2; }
    sAlb = mix(sAlb, dc * 0.7, max(frame, mid));
    float handle = step(length(vec2(lx - (dbl ? 0.1 : 0.88), lp.y - 1.05)), 0.035);
    sAlb = mix(sAlb, vec3(0.7, 0.68, 0.62), handle); sMetal = mix(sMetal, 1.0, handle);
    return;
  }
  // glazing: frame, mullions, glass
  float fw = kind == 3.0 || kind == 6.0 ? 0.045 : kind == 8.0 ? 0.035 : 0.075;
  float frame = 1.0 - aabox(lp, vec2(fw), sz - fw, fwp);
  float mull = 0.0;
  if (kind == 1.0 || kind == 7.0) {
    if (sz.x > 0.95) mull = max(mull, 1.0 - smoothstep(0.025 - fwp.x, 0.025 + fwp.x, abs(lp.x - sz.x * 0.5)));
    if (ti == 2.0 || ti == 9.0 || ti == 4.0) mull = max(mull, 1.0 - smoothstep(0.025 - fwp.y, 0.025 + fwp.y, abs(lp.y - sz.y * 0.68)));
    if (ti == 15.0) mull = max(mull, 1.0 - smoothstep(0.025 - fwp.y, 0.025 + fwp.y, abs(lp.y - sz.y * 0.72)));
  }
  if (kind == 7.0) { // leaded glass diamonds
    vec2 dq = vec2(lp.x + lp.y, lp.x - lp.y) / 0.32;
    mull = max(mull, 0.5 * (1.0 - smoothstep(0.02, 0.06, min(abs(fract(dq.x) - 0.5), abs(fract(dq.y) - 0.5)) * 0.32)));
  }
  if (kind == 3.0) mull = max(mull, 1.0 - smoothstep(0.03 - fwp.x, 0.03 + fwp.x, abs(fract(lp.x / 1.6 + 0.5) - 0.5) * 1.6));
  float fm = max(frame, mull);
  bool brown = ti == 9.0 || ((ti == 2.0 || ti == 4.0) && r > 0.55) || (ti == 1.0 && r > 0.8);
  vec3 fc = brown ? vec3(0.12, 0.065, 0.035) : kind == 3.0 || kind == 6.0 ? vec3(0.22, 0.23, 0.24) : kind == 8.0 ? vec3(0.8, 0.82, 0.8) : vec3(0.78, 0.78, 0.76);
  float fy = clamp(lp.y / max(sz.y, 0.1), 0.0, 1.0);
  vec3 gc = glassCol(cell, fy);
  float curtain = 0.0;
  if (kind == 1.0 || kind == 7.0) {
    // sheer curtains / blinds on part of the windows
    float cr = h21(cell + 5.3);
    if (cr > 0.55) curtain = (cr > 0.8 ? 0.55 : 0.35) * step(fy, cr > 0.8 ? 1.0 : 0.62);
    gc = mix(gc, vec3(0.42, 0.40, 0.36), curtain);
  }
  if (kind == 3.0) { // shop interior: goods on display
    float g = vnoise(vec2(q.x * 2.3, q.y * 1.7) + cell) ;
    gc = mix(vec3(0.05, 0.055, 0.06), vec3(0.3, 0.25, 0.2) * (0.5 + g), smoothstep(0.55, 0.0, fy) * 0.6);
  }
  if (kind == 8.0) gc = vec3(0.35, 0.42, 0.38);
  if (kind == 7.0) gc = mix(vec3(0.05, 0.06, 0.07), vec3(0.12, 0.09, 0.05), vnoise(q * 3.0));
  sAlb = mix(gc, fc, fm);
  sRough = mix(kind == 8.0 ? 0.16 : 0.14, 0.45, fm);
  sMetal = mix(kind == 3.0 ? 0.15 : 0.08, 0.0, fm);
  float lit = step(0.58, h21(cell + 7.7));
  vec3 lampc = mix(vec3(1.0, 0.76, 0.46), vec3(0.85, 0.9, 1.0), step(0.75, h11(r * 31.0)));
  float em = kind == 3.0 ? 0.14 : (kind == 7.0 ? 0.2 : 1.0 * lit);
  sEmis = (1.0 - fm) * uNight * lampc * em * (0.7 + 0.5 * fy) * (1.0 + curtain);
}

void facade(float ti, float flag, vec3 N, vec3 T, float uSign) {
  float u = vFa.x, v = vFa.y, Lw = vFa.z, eave = vFa.w;
  vec3 wallAlb = sAlb;
  // ---- base weathering: soil splash at the bottom, faint vertical streaks
  if (ti != 13.0 && ti != 8.0) {
    wallAlb *= mix(0.8, 1.0, smoothstep(0.0, 1.2, v)) * (0.94 + 0.06 * vnoise(vec2(u * 2.0, v * 0.25)));
  }
  // ---- plinth / socle
  float plH = (ti == 2.0 || ti == 9.0 || ti == 6.0 || ti == 4.0) ? 0.8 : ti == 3.0 ? 1.0 : ti == 15.0 ? 0.7 : 0.45;
  bool plinth = eave > 0.5 && v < plH && ti != 13.0 && ti != 8.0 && ti != 11.0 && ti != 10.0 && ti != 5.0 && ti != 12.0 && ti != 17.0;
  if (plinth) {
    if (ti == 2.0 || ti == 6.0 || ti == 9.0) {
      vec4 A2, N2; layerSample(14.0, vec2(u, -v) / uScale[14], false, A2, N2);
      wallAlb = s2l(A2.rgb) * vec3(1.05, 1.0, 0.95); sRough = lrough(N2, 14);
      vec3 nt = tnormal(N2, 14); sN = normalize(T * uSign * nt.x + vec3(0.0, 1.0, 0.0) * nt.y + N * max(nt.z, 0.2));
    } else {
      wallAlb *= ti == 3.0 ? 0.5 : 0.62; sRough = min(1.0, sRough + 0.08);
    }
    if (v > plH - 0.06) { wallAlb *= 1.2; sN = normalize(N + vec3(0.0, 1.2, 0.0)); }
  }
  // ---- cornices / string courses on historic facades
  if (ti == 2.0 || ti == 9.0 || ti == 6.0 || ti == 4.0 || ti == 15.0) {
    float fh = ti == 15.0 ? 3.4 : 3.7;
    float band = eave - v;
    if (band < 0.55 && band > 0.0) { // main cornice under the eave
      float k = band / 0.55;
      wallAlb *= k < 0.35 ? 1.12 : k < 0.6 ? 0.8 : 1.05;
      sN = normalize(N + vec3(0.0, k < 0.35 ? -0.6 : (k < 0.6 ? 1.0 : 0.2), 0.0));
    } else if (ti != 6.0 && v > fh - 0.05 && v < eave - 1.0) {
      float s = fract((v + 0.05) / fh) * fh;
      if (s < 0.22) { wallAlb *= s < 0.08 ? 0.82 : 1.1; sN = normalize(N + vec3(0.0, s < 0.08 ? -0.5 : 0.6, 0.0)); }
    }
    // rusticated corners (quoins)
    if ((u < 0.45 || u > Lw - 0.45) && v > plH && v < eave - 0.55) {
      float q = fract(v / 0.55);
      wallAlb *= 1.08 - 0.25 * step(0.9, q);
    }
  }
  // ---- panel blocks: colour accents on the balcony / stairwell axes, horizontal slab joints (not for surveyed 'exact' facades)
  if (ti == 3.0 && mod(flag + 0.001, 0.125) < 0.03) {
    float nb = max(1.0, floor(Lw / 3.0 + 0.001)); float bw = Lw / nb; float k = floor(u / bw);
    float axis = flag > 0.1 ? step(0.5, 1.0 - abs(mod(k, 6.0) - 3.0)) : step(0.5, 1.0 - abs(mod(k, 3.0) - 1.0));
    float hsel = h11(floor(Lw * 7.0) + floor(eave * 3.0));
    vec3 acc = hsel < 0.33 ? wallAlb * vec3(1.25, 0.8, 0.55) : hsel < 0.66 ? wallAlb * vec3(0.7, 0.9, 1.15) : wallAlb * 0.72;
    if (Lw < 13.5) { // gable: big colour field
      float bandv = step(0.5, fract(v / 5.6));
      wallAlb = mix(wallAlb, acc, bandv * step(1.0, v) * step(v, eave - 0.6) * step(0.8, u) * step(u, Lw - 0.8) * 0.8);
    } else wallAlb = mix(wallAlb, acc, axis * step(plH, v));
    wallAlb *= 1.0 - 0.06 * step(fract(v / 2.8), 0.012);
  }
  // ---- plank cladding (sheds, barns)
  if (ti == 17.0) { float g = fract(u / 0.16); wallAlb *= (0.9 + 0.1 * h11(floor(u / 0.16))) * (1.0 - 0.45 * step(0.93, g)); }
  // ---- fence slats
  if (ti == 12.0) { float g = fract(u / 0.14); wallAlb *= (0.88 + 0.12 * h11(floor(u / 0.14))) * mix(0.25, 1.0, step(0.18, g)); if (v > 1.25) wallAlb *= 0.8; }
  sAlb = wallAlb;

  // ---- openings
  vec4 rect; vec2 cell; float depth;
  vec2 p = vec2(u, v);
  float kind = winLayout(ti, flag, p, Lw, eave, rect, cell, depth);
  if (kind < 0.5) return;
  vec2 fw = fwidth(p);
  bool arch = kind == 7.0 || kind == 4.0;
  float hw = (rect.z - rect.x) * 0.5;
  float inFront;
  if (arch) {
    vec2 c = vec2(rect.x + hw, rect.w - hw);
    inFront = (p.x > rect.x && p.x < rect.z && p.y > rect.y && (p.y < c.y || length(p - c) < hw)) ? 1.0 : 0.0;
  } else inFront = (p.x > rect.x && p.x < rect.z && p.y > rect.y && p.y < rect.w) ? 1.0 : 0.0;
  if (inFront > 0.5) {
    // recessed opening: parallax into the wall
    vec3 V = normalize(cameraPosition - vWPos);
    vec3 vt = vec3(dot(V, T) * uSign, V.y, dot(V, N));
    vec2 q = p - vt.xy / max(vt.z, 0.15) * depth;
    bool in2;
    if (arch) { vec2 c = vec2(rect.x + hw, rect.w - hw); in2 = q.x > rect.x && q.x < rect.z && q.y > rect.y && (q.y < c.y || length(q - c) < hw); }
    else in2 = q.x > rect.x && q.x < rect.z && q.y > rect.y && q.y < rect.w;
    if (in2 || depth < 0.02) {
      openingShade(kind, rect, q, cell, ti, flag, N, fw * 0.7);
      if (!in2) sAlb *= 0.6;
    } else { // window reveal: wall material, shaded by orientation
      float sh = q.y > rect.w ? 0.35 : q.y < rect.y ? 0.95 : 0.6;
      sAlb = wallAlb * sh; sEmis = vec3(0.0); sMetal = 0.0; sRough = 0.9;
      sN = q.y > rect.w ? -vec3(0.0, 1.0, 0.0) : q.y < rect.y ? vec3(0.0, 1.0, 0.0) : T * uSign * sign(rect.x + hw - q.x);
      sN = normalize(sN + N * 0.3);
    }
    return;
  }
  if (kind == 8.0 || kind == 6.0 || kind == 3.0 || kind == 5.0 || kind == 4.0) return;
  // ---- window sill
  if (kind == 1.0 && p.y < rect.y && p.y > rect.y - 0.07 && p.x > rect.x - 0.07 && p.x < rect.z + 0.07) {
    sAlb = ti == 2.0 || ti == 9.0 ? wallAlb * 1.15 : vec3(0.42, 0.42, 0.41); sRough = 0.45;
    sN = normalize(N + vec3(0.0, 0.9, 0.0));
    return;
  }
  // shadow under the sill
  if (kind == 1.0 && p.y < rect.y - 0.07 && p.y > rect.y - 0.16 && p.x > rect.x - 0.07 && p.x < rect.z + 0.07) sAlb *= 0.8;
  // ---- window surrounds (baroque šambrány) on historic facades
  if ((ti == 2.0 || ti == 9.0 || ti == 4.0) && kind != 3.0) {
    float d = max(max(rect.x - p.x, p.x - rect.z), max(rect.y - p.y, p.y - rect.w));
    if (d < 0.14) { sAlb = wallAlb * (ti == 9.0 ? 0.55 : 1.22); if (d > 0.1) sAlb *= 0.85; }
    if (p.y > rect.w + 0.14 && p.y < rect.w + 0.34 && p.x > rect.x - 0.25 && p.x < rect.z + 0.25) { // lintel cap
      sAlb = wallAlb * 1.18; sN = normalize(N + vec3(0.0, p.y > rect.w + 0.28 ? 1.0 : -0.3, 0.0));
    }
  }
}

// ---------------------------------------------------------------------------------------------------------
// terrain: splat A (rgb = cover albedo sRGB, a = paved weight), splat B (r = bare soil, g = forest floor,
// b = row angle / pi, a = row spacing / 4 m)
// ---------------------------------------------------------------------------------------------------------
void groundSurface(vec3 N) {
  vec2 guv = (vWPos.xz - uSplatBox.xy) / uSplatBox.zw;
  vec2 suv = vec2(guv.x, 1.0 - guv.y);
  vec4 sp = texture2D(uSplat, suv);
  vec4 s2 = texture2D(uSplat2, suv);
  vec3 cover = s2l(sp.rgb);
  float pv = smoothstep(0.35, 0.65, sp.a + (fbm(vWPos.xz * 0.07) - 0.5) * 0.55 * step(sp.a, 0.97));
  float soil = s2.r, forest = s2.g;
  vec2 wp = vWPos.xz;
  // crop / vine rows
  float rows = 0.0, spacing = s2.a * 4.0;
  float ang = s2.b * 3.14159265;
  vec2 nrm = vec2(-sin(ang), cos(ang));
  float q = dot(wp, nrm) / max(spacing, 0.35);
  float w = fwidth(q);
  if (spacing > 0.35) {
    float d = abs(fract(q) - 0.5) * 2.0;           // 0 between rows, 1 on the row line
    float rw = spacing > 1.8 ? 0.34 : 0.5;
    float rm = smoothstep(1.0 - rw - w, 1.0 - rw + w, d);
    rows = mix(rm, rw, smoothstep(0.25, 0.7, w)) * smoothstep(0.35, 0.6, spacing);
  }
  // grass
  vec4 Ag, Ng; layerSample(7.0, wp / uScale[7], true, Ag, Ng);
  float mac = fbm(wp * 0.013);
  vec3 grass = s2l(Ag.rgb) / uMean[7] * cover * (0.82 + 0.36 * mac);
  vec3 nt = tnormal(Ng, 7); float rough = lrough(Ng, 7); float ao = Ag.a;
  vec3 alb = grass;
  bool vine = spacing > 1.8;
  float soilW = soil;
  if (spacing > 0.35) {
    if (vine) { alb *= mix(1.0, 0.55, rows); soilW = soil * (1.0 - rows); }
    else soilW = mix(soil, soil * 0.15, rows);
  }
  if (soilW > 0.01) {
    vec4 Ad, Nd; layerSample(17.0, wp / uScale[17], true, Ad, Nd);
    vec3 dirt = s2l(Ad.rgb) * vec3(0.95, 0.9, 0.85) * (0.8 + 0.4 * mac);
    alb = mix(alb, dirt, soilW); nt = mix(nt, tnormal(Nd, 17), soilW); rough = mix(rough, 0.9, soilW); ao = mix(ao, Ad.a, soilW);
  }
  if (forest > 0.01) {
    vec4 Af, Nf; layerSample(15.0, wp / uScale[15], true, Af, Nf);
    vec3 lit = s2l(Af.rgb) * vec3(0.8, 0.85, 0.75) * (0.8 + 0.4 * mac);
    alb = mix(alb, lit, forest); nt = mix(nt, tnormal(Nf, 15), forest); rough = mix(rough, lrough(Nf, 15), forest); ao = mix(ao, Af.a, forest);
  }
  if (pv > 0.01) {
    vec4 Ap, Np; layerSample(1.0, wp / uScale[1], false, Ap, Np);
    vec3 pav = s2l(Ap.rgb) / uMean[1] * mix(vec3(0.27, 0.255, 0.235), cover, 0.25) * (0.85 + 0.3 * vnoise(wp * 0.3));
    alb = mix(alb, pav, pv); nt = mix(nt, tnormal(Np, 1), pv); rough = mix(rough, lrough(Np, 1), pv); ao = mix(ao, Ap.a, pv);
  }
  sAlb = alb; sAO = mix(1.0, ao, 0.8); sRough = rough; sMetal = 0.0;
  sN = normalize(vec3(1.0, 0.0, 0.0) * nt.x + vec3(0.0, 0.0, -1.0) * nt.y + N * max(nt.z, 0.2));
}

void surface() {
  vec3 N = normalize(vWN);
  vec3 T = abs(N.y) > 0.97 ? vec3(1.0, 0.0, 0.0) : normalize(cross(vec3(0.0, 1.0, 0.0), N));
  vec3 B = cross(N, T);
  // direction of increasing facade u in world space (walls are built in both directions)
  vec3 dpx = dFdx(vWPos), dpy = dFdy(vWPos);
  float su = dot(dpx, T) * dFdx(vFa.x) + dot(dpy, T) * dFdy(vFa.x);
  float uSign = su < 0.0 ? -1.0 : 1.0;
  float layer = vMat;
  float t = vFt; float ti = floor(t + 0.01); float flag = t - ti;
  vec3 tint = vColor.rgb;
  sEmis = vec3(0.0); sSpecK = 1.0; sMetal = 0.0;
  if (layer > 49.5) {
    groundSurface(N);
  } else {
    int li = int(layer + 0.5);
    vec2 uv = vec2(dot(vWPos, T), -dot(vWPos, B)) / uScale[li];
    if (ti == 39.0 && flag > 0.1) { // old-town setts laid in segmental arcs (Segmentbogenpflaster): bend the sett rows into arcs
      vec2 q = vec2(dot(vWPos.xz, vFa.xy), dot(vWPos.xz, vec2(-vFa.y, vFa.x)));
      float aw = 2.4, R = 1.75, lx = q.x - (floor(q.x / aw) + 0.5) * aw;
      q.y += R - sqrt(max(R * R - lx * lx, 0.0));
      uv = q / (uScale[li] * 0.8);
    }
    bool bomb = (li == 0 || li == 7 || li == 16 || li == 15 || li == 17 || li == 13 || li == 1);
    vec4 A, Nm;
    layerSample(layer, uv, bomb, A, Nm);
    sAlb = s2l(A.rgb) * tint;
    sAO = mix(1.0, A.a, 0.85);
    vec3 nt = tnormal(Nm, li);
    sN = normalize(T * nt.x + B * nt.y + N * max(nt.z, 0.2));
    sRough = lrough(Nm, li);
  }
  vec2 wp = vWPos.xz;
  bool wall = abs(N.y) < 0.5;
  // ================================================================ flat surfaces / roads / paint
  if (ti > 29.5 && ti < 69.5) {
    float u = vFa.x, s = vFa.y, hw = vFa.z;
    if (ti < 33.5) { // asphalt & setts roads: wear, tyre tracks, patches, markings
      if (ti != 32.0) {
        float patchK = smoothstep(0.62, 0.66, fbm(wp * 0.09 + 3.0));
        sAlb *= mix(1.0, 0.72, patchK) * (0.9 + 0.2 * fbm(wp * 0.5));
        if (hw > 0.5) {
          float as = abs(s);
          float tr = smoothstep(0.5, 0.0, abs(as - hw * 0.5)) * 0.18;
          sAlb *= 1.0 - tr; sRough = mix(sRough, sRough * 0.8, tr * 3.0);
          sAlb *= mix(1.0, 1.2, smoothstep(hw - 0.6, hw, as));   // dusty edges
        }
      } else if (hw > 0.5) {
        sAlb *= mix(0.85, 1.0, smoothstep(0.0, 1.2, hw - abs(s)));
      }
      if (hw > 0.5 && (ti == 30.0 || ti == 31.0 && flag > 0.1)) {
        float fwu = fwidth(u), fws = fwidth(s);
        float paint = 0.0;
        if (ti == 30.0) { // dashed centre line 3 m / 6 m
          float dash = smoothstep(0.0, fwu * 1.5, fract(u / 9.0) * 9.0) * (1.0 - smoothstep(3.0 - fwu * 1.5, 3.0, fract(u / 9.0) * 9.0));
          paint = max(paint, dash * (1.0 - smoothstep(0.06, 0.06 + fws * 1.5, abs(s))));
        }
        if (flag > 0.1) paint = max(paint, 1.0 - smoothstep(0.065, 0.065 + fws * 1.5, abs(abs(s) - (hw - 0.3))));
        paint *= 0.75 + 0.25 * vnoise(wp * 3.0);
        sAlb = mix(sAlb, vec3(0.68, 0.68, 0.64), paint); sRough = mix(sRough, 0.5, paint);
      }
    } else if (ti == 34.0) { // farm track: grass in the middle and on the edges
      float as = abs(s);
      float g = hw > 0.5 ? max(1.0 - smoothstep(0.25, 0.5, as), smoothstep(hw - 0.5, hw - 0.1, as + 0.2 * vnoise(wp * 2.0))) : 0.0;
      if (g > 0.01) {
        vec4 Ag, Ng; layerSample(7.0, wp / uScale[7], true, Ag, Ng);
        vec3 gr = s2l(Ag.rgb) / uMean[7] * vec3(0.11, 0.15, 0.045);
        sAlb = mix(sAlb, gr, g); sRough = mix(sRough, 0.8, g);
      }
    } else if (ti == 38.0) { // granite curb stones
      sAlb *= 0.92 + 0.12 * h11(floor(u / 1.0)); sAlb *= 1.0 - 0.35 * step(0.97, fract(u / 1.0));
    } else if (ti == 40.0) { // parking lot bays
      vec2 dir = vFa.xy; vec2 pr = vec2(-dir.y, dir.x);
      float pu = dot(wp, dir) + vFa.z, pvv = dot(wp, pr) + vFa.w;
      float rs = flag * 40.0;
      if (rs > 4.0) {
        float q = (fract(pvv / rs) - 0.5) * rs;
        float inBay = step(abs(q), 2.45);
        float fwu = fwidth(pu);
        float sep = 1.0 - smoothstep(0.06, 0.06 + fwu * 1.5, abs(fract(pu / 2.7 + 0.5) - 0.5) * 2.7);
        float endl = (1.0 - smoothstep(0.06, 0.06 + fwidth(q) * 1.5, abs(abs(q) - 2.45))) * step(rs, 7.0);
        float paint = max(sep * inBay, endl) * (0.7 + 0.3 * vnoise(wp * 2.0));
        sAlb *= 0.9 + 0.2 * fbm(wp * 0.4);
        sAlb = mix(sAlb, vec3(0.7, 0.7, 0.66), paint); sRough = mix(sRough, 0.5, paint);
      }
    } else if (ti == 47.0 || ti == 49.0) { // car-park surfaces: stains and slight per-surface variation
      sAlb *= 0.9 + 0.2 * fbm(wp * 0.35);
      if (ti == 47.0) sAlb *= 1.0 - 0.12 * smoothstep(0.55, 0.75, fbm(wp * 0.8 + 7.0));   // oil / tyre stains on the aisles
    } else if (ti == 41.0) { // pitch mowing stripes
      sAlb *= 0.9 + 0.12 * step(0.5, fract(dot(wp, vFa.xy) / 5.0));
    } else if (ti == 42.0) {
      sRough = 0.7;
    } else if (ti >= 60.0) { // paint
      vec3 pc = ti == 61.0 ? vec3(0.7, 0.48, 0.05) : vec3(0.7, 0.7, 0.66);
      float wear = 0.75 + 0.25 * vnoise(wp * 4.0);
      sAlb = mix(sAlb * 0.8, pc, wear); sRough = 0.5;
    }
  }
  // ================================================================ walls
  else if (wall && ((ti > 0.5 && ti < 12.5) || ti == 14.0 || ti == 15.0 || ti == 17.0)) {
    facade(ti, flag, N, T, uSign);
  }
  else if (ti == 0.0 && wall && vFa.w > 0.5 && vFa.y < 0.4) { sAlb *= 0.62; }
  // glass curtain wall
  if (ti == 13.0) {
    // FLAG.B: shopfront glazing - full-height panes with slim anthracite mullions and a lit interior
    bool shopG = mod(flag + 0.001, 0.25) > 0.1;
    float gw = shopG ? 1.3 : 1.6, gh = shopG ? max(vFa.w, 1.0) : 1.45;
    float gx = fract(vFa.x / gw), gy = fract(vFa.y / gh);
    float fr = shopG ? 1.0 - step(0.025, gx) * step(0.03, gy) * step(gx, 0.975) * step(gy, 0.97)
                     : 1.0 - step(0.03, gx) * step(0.035, gy) * step(gx, 0.97) * step(gy, 0.965);
    vec2 cell = floor(vec2(vFa.x / gw, vFa.y / gh));
    sAlb = mix(glassCol(cell, gy) * (shopG ? 1.1 : 1.4), shopG ? vec3(0.07, 0.075, 0.08) : vec3(0.55, 0.57, 0.58), fr);
    sRough = mix(0.04, 0.4, fr); sMetal = mix(0.35, 0.8, fr); sN = N; sAO = 1.0;
    sEmis = (1.0 - fr) * uNight * vec3(1.0, 0.86, 0.66) * 2.2 * step(0.35, h21(cell + 3.1));
  }
  // ================================================================ special materials
  if (ti == 18.0) { // copper patina (tower helmets)
    float st = vnoise(vec2(wp.x * 3.0 + wp.y * 3.0, vWPos.y * 0.6));
    sAlb *= 0.85 + 0.3 * st; sRough = 0.45; sMetal = 0.25;
  } else if (ti == 19.0) { // gilding
    sAlb = vec3(0.95, 0.72, 0.3); sMetal = 1.0; sRough = 0.28; sN = N;
  } else if (ti == 25.0) { // steel
    sAlb = vec3(0.5, 0.5, 0.52); sMetal = 0.9; sRough = 0.35;
  } else if (ti == 26.0) { // balcony railing panel
    sAlb *= 0.9 + 0.1 * step(0.5, fract(vFa.x / 0.1)); sRough = 0.5; sMetal = 0.1;
    if (vFa.y > vFa.w - 0.06) { sAlb = vec3(0.35); sMetal = 0.6; sRough = 0.35; }
  } else if (ti == 27.0) { // foliage (hedges, vine rows)
    float n1 = vnoise(vWPos.xz * 3.1 + vWPos.y * 2.3), n2 = vnoise(vec2(vWPos.x + vWPos.z, vWPos.y) * 7.0);
    sAlb *= 0.55 + 0.6 * n1 * n2 + 0.2 * n2; sRough = 0.8;
    sN = normalize(sN + vec3(n1 - 0.5, n2 - 0.5, n1 * n2 - 0.25) * 1.2);
    sAO *= 0.7 + 0.3 * n1;
  } else if (ti == 28.0) { // PV panels
    vec2 c = vec2(vFa.x / 1.0, vFa.y / 1.65);
    float fr = 1.0 - aabox(fract(c), vec2(0.03), vec2(0.97), vec2(0.01));
    float cells = step(0.94, fract(c.x * 6.0)) + step(0.94, fract(c.y * 10.0));
    sAlb = mix(vec3(0.02, 0.03, 0.06) * (1.0 - 0.3 * min(cells, 1.0)), vec3(0.6, 0.62, 0.64), fr);
    sRough = mix(0.08, 0.35, fr); sMetal = mix(0.2, 0.9, fr); sN = N;
  } else if (ti == 24.0) { // clock face: fa.xy in [-1, 1]
    vec2 c = vFa.xy; float r = length(c);
    float a = atan(c.y, c.x);
    float tick = step(0.78, r) * step(r, 0.9) * step(0.8, abs(cos(a * 6.0)));
    float h1 = step(abs(dot(c, vec2(0.866, -0.5))), 0.05) * step(0.0, dot(c, vec2(0.5, 0.866))) * step(r, 0.55);
    float h2 = step(abs(dot(c, vec2(-0.866, -0.5))), 0.035) * step(0.0, dot(c, vec2(-0.5, 0.866))) * step(r, 0.8);
    sAlb = mix(vec3(0.75, 0.72, 0.65), vec3(0.02), max(tick, max(h1, h2)));
    if (r > 0.92) { sAlb = vec3(0.9, 0.7, 0.3); sMetal = 1.0; sRough = 0.3; } else { sRough = 0.4; }
    sN = N; sEmis = uNight * vec3(1.0, 0.9, 0.7) * 0.6 * step(r, 0.92) * (1.0 - max(tick, max(h1, h2)));
  } else if (ti == 21.0 && N.y > 0.9) { // flat roofs: patchy gravel, puddle stains
    sAlb *= 0.8 + 0.4 * fbm(wp * 0.35);
  } else if (ti == 22.0) { // standing seam metal roof
    float sd = fract(dot(vWPos, T) / 0.55);
    sAlb *= 0.9 + 0.12 * smoothstep(0.9, 1.0, sd); sMetal = 0.45; sRough = 0.45;
  } else if (ti == 23.0) {
    sAlb = vec3(0.45, 0.52, 0.5); sRough = 0.08; sMetal = 0.2; sN = N;
  } else if (ti == 20.0 && N.y > 0.2) { // pitched tile roofs: moss / soot variation
    float m = fbm(wp * 0.25 + vWPos.y * 0.3);
    sAlb *= 0.8 + 0.35 * m;
  }
  if (uDebug > 2.5) { sEmis = uDebug < 3.5 ? sAlb * 2.0 : (sN * 0.5 + 0.5) * 0.6; sAlb = vec3(0.0); sRough = 1.0; sMetal = 0.0; sAO = 1.0; }
  else if (uDebug > 0.5) { sAlb = uDebug < 1.5 ? vec3(fract(vFa.x), fract(vFa.y), 0.0) : vec3(uSign * 0.5 + 0.5, 0.0, flag * 4.0); sEmis = sAlb * 0.5; sRough = 1.0; sMetal = 0.0; sN = N; sAO = 1.0; }
  // ---- rain/wetness darkening on horizontal surfaces (optional)
  if (uWet > 0.0 && N.y > 0.7) { sAlb *= mix(1.0, 0.55, uWet); sRough = mix(sRough, 0.08, uWet * 0.8); }
}
`;

export function makeWorldMaterial(arrays) {
  if (arrays.mean && arrays.mean.length) WORLD.mean = arrays.mean.map(m => m.slice());
  const mean = new Array(24).fill(0).map((_, i) => new THREE.Vector3(...(WORLD.mean[i] || [0.5, 0.5, 0.5])));
  const uniforms = {
    uAlb: { value: arrays.alb }, uNrm: { value: arrays.nrm },
    uScale: { value: new Array(24).fill(3) }, uNrmK: { value: new Array(24).fill(1) }, uRoughK: { value: new Array(24).fill(1) },
    uRoughMin: { value: new Array(24).fill(0) }, uMean: { value: mean },
    uNight: { value: 0 }, uWet: { value: 0 }, uTime: { value: 0 }, uDebug: { value: 0 },
    uSplat: { value: null }, uSplat2: { value: null }, uSplatBox: { value: new THREE.Vector4(0, 0, 1, 1) },
    uPrio: { value: PRIO.slice() }, uDepthBias: { value: 1.2e-4 },
  };
  LAYER.forEach((l, i) => { uniforms.uScale.value[i] = l[0]; uniforms.uNrmK.value[i] = l[1]; uniforms.uRoughK.value[i] = l[2]; });
  for (const k in ROUGH_MIN) uniforms.uRoughMin.value[k] = ROUGH_MIN[k];
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0, side: THREE.FrontSide });
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
attribute float mat; attribute vec4 fa; attribute float ft;
uniform float uPrio[40]; uniform float uDepthBias;
varying float vMat; varying vec4 vFa; varying float vFt; varying vec3 vWPos; varying vec3 vWN;`)
      .replace('#include <project_vertex>', `#include <project_vertex>
{ float pr = 0.0; if (ft > 29.5 && ft < 69.5) pr = uPrio[int(ft + 0.01) - 30];
  if (pr > 0.0) gl_Position = projectionMatrix * vec4(mvPosition.xyz * (1.0 - uDepthBias * pr), 1.0); }`)
      .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
{ vec4 wp = modelMatrix * vec4(transformed, 1.0); vWPos = wp.xyz; vWN = normalize(mat3(modelMatrix) * objectNormal);
  vMat = mat; vFa = fa; vFt = ft; }`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <clipping_planes_pars_fragment>', '#include <clipping_planes_pars_fragment>\n' + GLSL_COMMON)
      .replace('#include <map_fragment>', 'surface(); diffuseColor.rgb = sAlb;')
      .replace('#include <color_fragment>', '')
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = sRough;')
      .replace('#include <metalnessmap_fragment>', 'float metalnessFactor = sMetal;')
      .replace('#include <normal_fragment_maps>', 'normal = normalize((viewMatrix * vec4(sN, 0.0)).xyz);')
      .replace('#include <emissivemap_fragment>', 'totalEmissiveRadiance = sEmis;')
      .replace('#include <aomap_fragment>', 'reflectedLight.indirectDiffuse *= sAO; reflectedLight.indirectSpecular *= mix(1.0, sAO, 0.6); reflectedLight.directDiffuse *= mix(1.0, sAO, 0.35);');
  };
  m.customProgramCacheKey = () => 'world-v2';
  WORLD.uniforms = uniforms; WORLD.material = m; WORLD.arrays = arrays;
  WORLD.shadowMaterial = null;
  return m;
}

// Water: dark, glossy, two scrolling normal maps sampled in world space. uTime is advanced by the caller
// (mesh.onBeforeRender in city.js does it automatically).
export function makeWaterMaterial(normalTex, opts = {}) {
  const m = new THREE.MeshStandardMaterial({ color: new THREE.Color(opts.color || 0x1d2a22), roughness: 0.06, metalness: 0.0, envMapIntensity: 1.0 });
  m.polygonOffset = true; m.polygonOffsetFactor = -1; m.polygonOffsetUnits = -2;
  const u = { uWN: { value: normalTex }, uTime: { value: 0 }, uWScale: { value: opts.scale || 7.0 } };
  m.userData.uniforms = u;
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWP;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWP; uniform sampler2D uWN; uniform float uTime; uniform float uWScale;')
      .replace('#include <normal_fragment_maps>', `{
  vec2 p = vWP.xz / uWScale;
  vec3 n1 = texture2D(uWN, p + vec2(uTime * 0.021, uTime * 0.013)).xyz * 2.0 - 1.0;
  vec3 n2 = texture2D(uWN, p * 0.47 - vec2(uTime * 0.011, -uTime * 0.017)).xyz * 2.0 - 1.0;
  vec3 wn = normalize(vec3(n1.x + n2.x, 7.0, n1.y + n2.y));
  normal = normalize((viewMatrix * vec4(wn, 0.0)).xyz);
}`);
  };
  m.customProgramCacheKey = () => 'water-v1';
  return m;
}

// simple helper for standard materials that should react to the night factor (emissive lights)
export function lightMaterial(color, intensity) {
  const m = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: new THREE.Color(color), emissiveIntensity: 0, roughness: 0.3 });
  m.userData.nightEmissive = intensity;
  return m;
}
