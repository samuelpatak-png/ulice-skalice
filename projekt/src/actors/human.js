// Procedural, rigged and animated people (player + pedestrians).
//
// One SkinnedMesh per person built from lofted cross-sections (torso+neck+head as one tube, limb tubes welded into
// it by overlapping rings with blended skin weights), clothing as shader regions of the same mesh (colours, garment
// thickness and patterns come from per-instance uniforms so the body geometry of each sex is built once and shared),
// plus a skinned hair mesh (and a skirt mesh when needed) bound to the same per-instance Skeleton.
// Animation is fully procedural: foot-planting leg IK driven by a gait phase, blended states.
//
// Conventions: metres, y up, the character faces local +Z, its left is +X, origin between the feet on the ground.
import * as THREE from 'three';

const PI = Math.PI, TAU = PI * 2, DEG = PI / 180;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const gauss = (x, s) => Math.exp(-(x * x) / (s * s));
const wrapA = (a) => Math.atan2(Math.sin(a), Math.cos(a));

// ---------------------------------------------------------------------------------------------------------------
// Skeleton definition
// ---------------------------------------------------------------------------------------------------------------
export const HUMAN_BONES = ['root', 'hips', 'spine', 'chest', 'neck', 'head',
  'shoulder_L', 'upperArm_L', 'forearm_L', 'hand_L', 'shoulder_R', 'upperArm_R', 'forearm_R', 'hand_R',
  'thigh_L', 'shin_L', 'foot_L', 'toe_L', 'thigh_R', 'shin_R', 'foot_R', 'toe_R'];
const NB = HUMAN_BONES.length;
const PARENT = [-1, 0, 1, 2, 3, 4, 3, 6, 7, 8, 3, 10, 11, 12, 1, 14, 15, 16, 1, 18, 19, 20];
const I_ROOT = 0, I_HIPS = 1, I_SPINE = 2, I_CHEST = 3, I_NECK = 4, I_HEAD = 5;
const armIdx = (s) => s > 0 ? 6 : 10;   // shoulder, upperArm, forearm, hand
const legIdx = (s) => s > 0 ? 14 : 18;  // thigh, shin, foot, toe

// ---------------------------------------------------------------------------------------------------------------
// Body proportions (base male 1.78 m). Rows: torso/neck/head cross-sections [y, halfWidth, frontDepth, backDepth,
// centreZ, frontExp, backExp, part]; part 2 torso, 1 neck, 0 head.
// ---------------------------------------------------------------------------------------------------------------
const MALE = {
  sex: 'm', H: 1.78, top: 1.781,
  J: {
    root: [0, 0, 0], hips: [0, 0.965, 0], spine: [0, 1.075, -0.012], chest: [0, 1.245, -0.018],
    neck: [0, 1.462, -0.030], head: [0, 1.585, -0.012],
    shoulder: [0.028, 1.425, -0.020], upperArm: [0.183, 1.412, -0.032], forearm: [0.205, 1.112, -0.048], hand: [0.224, 0.862, -0.030],
    thigh: [0.088, 0.905, 0], shin: [0.088, 0.49, 0], foot: [0.088, 0.082, 0], toe: [0.088, 0.014, 0.135],
  },
  rows: [
    [0.797, 0.040, 0.034, 0.040, -0.010, 2.0, 2.0, 2],
    [0.830, 0.118, 0.068, 0.086, -0.012, 2.1, 2.1, 2],
    [0.875, 0.160, 0.090, 0.117, -0.014, 2.3, 2.2, 2],
    [0.930, 0.174, 0.098, 0.124, -0.014, 2.4, 2.3, 2],
    [0.990, 0.170, 0.100, 0.110, -0.012, 2.4, 2.3, 2],
    [1.050, 0.160, 0.102, 0.097, -0.010, 2.4, 2.3, 2],
    [1.110, 0.151, 0.103, 0.091, -0.010, 2.4, 2.3, 2],
    [1.180, 0.158, 0.110, 0.096, -0.012, 2.5, 2.4, 2],
    [1.250, 0.167, 0.119, 0.105, -0.015, 2.5, 2.4, 2],
    [1.310, 0.172, 0.122, 0.112, -0.018, 2.6, 2.5, 2],
    [1.360, 0.174, 0.117, 0.115, -0.021, 2.6, 2.5, 2],
    [1.400, 0.176, 0.104, 0.110, -0.024, 2.7, 2.6, 2],
    [1.430, 0.162, 0.086, 0.096, -0.027, 2.6, 2.5, 2],
    [1.452, 0.126, 0.068, 0.080, -0.029, 2.4, 2.3, 2],
    [1.468, 0.084, 0.059, 0.066, -0.030, 2.2, 2.1, 2],
    [1.490, 0.062, 0.058, 0.059, -0.027, 2.0, 2.0, 1],
    [1.515, 0.059, 0.057, 0.057, -0.020, 2.0, 2.0, 1],
    // head
    [1.537, 0.058, 0.063, 0.056, -0.012, 2.0, 2.0, 0],
    [1.553, 0.059, 0.082, 0.058, -0.008, 2.2, 2.0, 0],
    [1.567, 0.061, 0.096, 0.063, -0.005, 2.4, 2.0, 0],
    [1.581, 0.064, 0.100, 0.069, -0.003, 2.5, 2.0, 0],
    [1.595, 0.066, 0.101, 0.077, -0.001, 2.6, 2.1, 0],
    [1.609, 0.068, 0.101, 0.085, 0.000, 2.6, 2.1, 0],
    [1.623, 0.071, 0.099, 0.091, 0.000, 2.6, 2.1, 0],
    [1.638, 0.074, 0.098, 0.095, 0.000, 2.6, 2.1, 0],
    [1.653, 0.076, 0.097, 0.098, 0.000, 2.6, 2.1, 0],
    [1.666, 0.077, 0.097, 0.100, 0.000, 2.6, 2.1, 0],
    [1.679, 0.078, 0.099, 0.101, 0.000, 2.5, 2.1, 0],
    [1.697, 0.078, 0.096, 0.101, -0.001, 2.4, 2.1, 0],
    [1.720, 0.075, 0.089, 0.098, -0.002, 2.2, 2.1, 0],
    [1.742, 0.068, 0.078, 0.089, -0.004, 2.1, 2.0, 0],
    [1.759, 0.056, 0.063, 0.074, -0.006, 2.0, 2.0, 0],
    [1.771, 0.038, 0.043, 0.052, -0.007, 2.0, 2.0, 0],
  ],
  // [y, amplitude, sigmaPhi] nose profile at phi = 0
  nose: [[1.683, 0, 0.10], [1.670, 0.004, 0.10], [1.656, 0.009, 0.11], [1.641, 0.015, 0.12], [1.628, 0.021, 0.14],
    [1.618, 0.023, 0.17], [1.610, 0.010, 0.21], [1.601, 0.002, 0.2], [1.592, 0, 0.2]],
  // gaussian bumps {y, p (phi), sy, sp, a (m), m (mirror), h (1 head / 0 torso)}
  feat: [
    { y: 1.664, p: 0.36, sy: 0.011, sp: 0.20, a: -0.0065, m: 1, h: 1 },   // eye sockets
    { y: 1.681, p: 0.36, sy: 0.008, sp: 0.36, a: 0.004, m: 1, h: 1 },     // brow ridge
    { y: 1.640, p: 0.85, sy: 0.014, sp: 0.35, a: 0.005, m: 1, h: 1 },     // cheekbones
    { y: 1.600, p: 0.00, sy: 0.006, sp: 0.35, a: 0.004, m: 0, h: 1 },     // upper lip
    { y: 1.587, p: 0.00, sy: 0.006, sp: 0.30, a: 0.005, m: 0, h: 1 },     // lower lip
    { y: 1.567, p: 0.00, sy: 0.010, sp: 0.45, a: 0.006, m: 0, h: 1 },     // chin
    { y: 1.646, p: 1.68, sy: 0.019, sp: 0.13, a: 0.019, m: 1, h: 1 },     // ears
    { y: 1.690, p: 1.10, sy: 0.020, sp: 0.30, a: -0.003, m: 1, h: 1 },    // temples
    { y: 1.520, p: 0.00, sy: 0.012, sp: 0.25, a: 0.004, m: 0, h: 0 },     // larynx
    { y: 1.300, p: 0.45, sy: 0.035, sp: 0.40, a: 0.008, m: 1, h: 0 },     // pectorals
    { y: 1.330, p: 2.55, sy: 0.050, sp: 0.35, a: 0.007, m: 1, h: 0 },     // shoulder blades
    { y: 1.200, p: PI, sy: 0.250, sp: 0.15, a: -0.004, m: 0, h: 0 },      // spine groove
    { y: 0.925, p: 2.55, sy: 0.045, sp: 0.45, a: 0.012, m: 1, h: 0 },     // buttocks
    { y: 0.890, p: PI, sy: 0.050, sp: 0.10, a: -0.008, m: 0, h: 0 },      // cleft
  ],
  // arm rings along the arm path from the shoulder joint: [a, lateral, front, back]
  arm: [
    [-0.052, 0.018, 0.020, 0.020], [-0.036, 0.040, 0.042, 0.044], [-0.015, 0.050, 0.052, 0.054], [0.020, 0.054, 0.054, 0.054],
    [0.070, 0.051, 0.050, 0.049], [0.125, 0.045, 0.047, 0.046], [0.185, 0.042, 0.045, 0.043], [0.245, 0.039, 0.040, 0.041],
    [0.300, 0.038, 0.036, 0.040], [0.345, 0.040, 0.041, 0.040], [0.410, 0.036, 0.037, 0.035], [0.480, 0.029, 0.030, 0.028],
    [0.545, 0.021, 0.028, 0.027],
    // hand (palm faces medially: thin laterally, broad front-back)
    [0.580, 0.018, 0.040, 0.038], [0.625, 0.017, 0.043, 0.041], [0.668, 0.015, 0.043, 0.040], [0.705, 0.013, 0.038, 0.035],
    [0.737, 0.011, 0.030, 0.028], [0.757, 0.009, 0.018, 0.016],
  ],
  handFrom: 13,
  // leg rings: [y, outer, inner, front, back]
  leg: [
    [0.975, 0.050, 0.040, 0.050, 0.055], [0.945, 0.080, 0.070, 0.078, 0.090], [0.905, 0.090, 0.080, 0.085, 0.094],
    [0.850, 0.086, 0.079, 0.080, 0.088], [0.780, 0.078, 0.072, 0.074, 0.078], [0.700, 0.070, 0.064, 0.068, 0.066],
    [0.620, 0.062, 0.056, 0.060, 0.058], [0.550, 0.054, 0.050, 0.054, 0.050], [0.500, 0.050, 0.050, 0.055, 0.046],
    [0.450, 0.050, 0.049, 0.050, 0.052], [0.390, 0.052, 0.054, 0.048, 0.062], [0.320, 0.048, 0.050, 0.044, 0.056],
    [0.250, 0.041, 0.042, 0.040, 0.045], [0.180, 0.035, 0.034, 0.035, 0.036], [0.120, 0.031, 0.030, 0.032, 0.032],
    [0.085, 0.034, 0.032, 0.036, 0.038], [0.050, 0.032, 0.030, 0.034, 0.036],
  ],
  // shoe rings along z (relative to the ankle): [z, halfWidth, top, bottom]
  shoe: [
    [-0.072, 0.022, 0.066, 0.006], [-0.064, 0.034, 0.084, 0.000], [-0.045, 0.041, 0.094, 0.000], [-0.015, 0.043, 0.098, 0.000],
    [0.020, 0.045, 0.092, 0.000], [0.055, 0.048, 0.082, 0.000], [0.090, 0.050, 0.070, 0.000], [0.125, 0.051, 0.058, 0.000],
    [0.160, 0.048, 0.047, 0.002], [0.190, 0.040, 0.040, 0.005], [0.208, 0.028, 0.032, 0.009], [0.218, 0.012, 0.024, 0.013],
  ],
  heelZ: -0.055, ballZ: 0.135,
};

function femaleFrom(M) {
  const k = 1.66 / 1.78, top = 1.66, hs = 0.955;
  const mapHeadY = (y) => top - (M.top - y) * hs;
  const tabW = [[0.797, 1.05], [0.83, 1.08], [0.875, 1.09], [0.93, 1.09], [0.99, 1.05], [1.05, 0.97], [1.11, 0.90], [1.18, 0.92],
    [1.25, 0.94], [1.31, 0.94], [1.36, 0.92], [1.40, 0.90], [1.43, 0.89], [1.452, 0.90], [1.468, 0.90], [1.49, 0.88], [1.515, 0.88]];
  const tabF = [[0.797, 1.0], [0.93, 1.0], [1.05, 0.92], [1.11, 0.90], [1.18, 0.90], [1.25, 0.90], [1.31, 0.92], [1.40, 0.94], [1.515, 0.92]];
  const tabB = [[0.797, 1.05], [0.875, 1.08], [0.93, 1.10], [0.99, 1.05], [1.11, 0.92], [1.25, 0.94], [1.515, 0.92]];
  const tab = (t, y) => { if (y <= t[0][0]) return t[0][1]; for (let i = 1; i < t.length; i++) if (y <= t[i][0]) return lerp(t[i - 1][1], t[i][1], (y - t[i - 1][0]) / (t[i][0] - t[i - 1][0])); return t[t.length - 1][1]; };
  const rows = M.rows.map(r => {
    const [y, w, df, db, cz, nf, nb, part] = r;
    if (part > 0) return [y * k, w * k * tab(tabW, y), df * k * tab(tabF, y), db * k * tab(tabB, y), cz * k, nf, nb, part];
    const jaw = y < 1.60 ? 0.94 : 1.0;
    return [mapHeadY(y), w * hs * jaw, df * hs, db * hs, cz * hs, nf, nb, part];
  });
  const J = {};
  for (const n in M.J) J[n] = M.J[n].map(v => v * k);
  J.neck = [0, M.J.neck[1] * k, M.J.neck[2] * k];
  J.head = [0, mapHeadY(M.J.head[1]), M.J.head[2] * hs];
  const ax = 0.905;
  J.shoulder[0] = M.J.shoulder[0] * k * 0.92; J.upperArm[0] = M.J.upperArm[0] * k * ax;
  J.forearm[0] = M.J.forearm[0] * k * ax + 0.006; J.hand[0] = M.J.hand[0] * k * ax + 0.018;
  for (const n of ['thigh', 'shin', 'foot', 'toe']) J[n][0] = M.J[n][0] * k * 1.05;
  const feat = M.feat.filter(f => !(f.h === 0 && (f.p === 0.45 || f.y === 1.52))).map(f => f.h ? { ...f, y: mapHeadY(f.y), a: f.a * hs * (f.p === 0.36 && f.a > 0 ? 0.4 : 1) } : { ...f, y: f.y * k, a: f.a * (f.p === 2.55 && f.y < 1 ? 1.35 : 1) });
  feat.push({ y: 1.24 * k, p: 0.5, sy: 0.045, sp: 0.42, a: 0.034, m: 1, h: 0 });   // bust
  return {
    sex: 'f', H: 1.66, top, J, rows, feat,
    nose: M.nose.map(([y, a, s]) => [mapHeadY(y), a * 0.8, s * 0.95]),
    arm: M.arm.map(([a, x, f, b]) => [a * k, x * k * 0.9, f * k * 0.9, b * k * 0.9]), handFrom: M.handFrom,
    leg: M.leg.map(([y, o, i, f, b]) => { const m = y > 0.47 ? 1.03 : 0.93; return [y * k, o * k * m, i * k * m, f * k * m, b * k * m]; }),
    shoe: M.shoe.map(([z, w, t, b]) => [z * k * 0.95, w * k * 0.9, t * k, b]),
    heelZ: M.heelZ * k * 0.95, ballZ: M.ballZ * k * 0.95,
  };
}
const FEMALE = femaleFrom(MALE);
for (const P of [MALE, FEMALE]) {
  P.k = P.H / 1.78;
  P.headRows = P.rows.filter(r => r[7] === 0);
  P.torsoRows = P.rows.filter(r => r[7] > 0);
  P.chinY = P.headRows[1][0];
  P.neckBaseY = P.rows.filter(r => r[7] === 2).pop()[0];
  P.crotchY = P.rows[0][0];
  let wi = 0; P.headRows.forEach((r, i) => { if (r[1] + r[2] > P.headRows[wi][1] + P.headRows[wi][2]) wi = i; });
  P.headWideY = P.headRows[wi][0];
  P.faceY0 = P.top - (MALE.top - 1.540) * (P.sex === 'f' ? 0.955 : 1);
  P.faceY1 = P.top - (MALE.top - 1.720) * (P.sex === 'f' ? 0.955 : 1);
}

// Hermite interpolation over row tables keyed by column 0
function rowAt(rows, y, out) {
  const n = rows.length;
  if (y <= rows[0][0]) { for (let c = 1; c < 7; c++) out[c - 1] = rows[0][c]; return out; }
  if (y >= rows[n - 1][0]) { for (let c = 1; c < 7; c++) out[c - 1] = rows[n - 1][c]; return out; }
  let i = 0; while (i < n - 2 && y > rows[i + 1][0]) i++;
  const y0 = rows[i][0], y1 = rows[i + 1][0], h = y1 - y0, t = (y - y0) / h;
  const t2 = t * t, t3 = t2 * t;
  const h00 = 2 * t3 - 3 * t2 + 1, h10 = t3 - 2 * t2 + t, h01 = -2 * t3 + 3 * t2, h11 = t3 - t2;
  for (let c = 1; c < 7; c++) {
    const p0 = rows[i][c], p1 = rows[i + 1][c];
    const m0 = i > 0 ? (p1 - rows[i - 1][c]) / (y1 - rows[i - 1][0]) : (p1 - p0) / h;
    const m1 = i + 2 < n ? (rows[i + 2][c] - p0) / (rows[i + 2][0] - y0) : (p1 - p0) / h;
    out[c - 1] = h00 * p0 + h10 * h * m0 + h01 * p1 + h11 * h * m1;
  }
  return out;
}

// superellipse cross-section; phi = 0 front (+z), + towards +x
function secXZ(w, df, db, nf, nb, phi, out) {
  const s = Math.sin(phi), c = Math.cos(phi);
  const e = 2 / (c >= 0 ? nf : nb);
  out[0] = w * Math.sign(s) * Math.pow(Math.abs(s), e);
  out[1] = (c >= 0 ? df : db) * Math.sign(c) * Math.pow(Math.abs(c), e);
  return out;
}

function featDisp(P, head, phi, y) {
  let d = 0;
  for (const f of P.feat) {
    if ((f.h === 1) !== head) continue;
    const dy = (y - f.y) / f.sy; if (dy * dy > 9) continue;
    const gy = Math.exp(-dy * dy);
    d += f.a * gy * gauss(wrapA(phi - f.p), f.sp);
    if (f.m) d += f.a * gy * gauss(wrapA(phi + f.p), f.sp);
  }
  if (head) {
    const N = P.nose;
    if (y < N[0][0] && y > N[N.length - 1][0]) {
      let i = 0; while (i < N.length - 1 && y < N[i + 1][0]) i++;
      const t = (y - N[i][0]) / (N[i + 1][0] - N[i][0]);
      const a = lerp(N[i][1], N[i + 1][1], t), s = lerp(N[i][2], N[i + 1][2], t);
      d += a * gauss(phi, s);
    }
  }
  return d;
}

const _r6 = new Array(6), _xz = [0, 0];
function headPoint(P, phi, y, feat, out) {
  const hr = P.headRows, last = hr[hr.length - 1];
  let w, df, db, cz, nf, nb;
  if (y >= last[0]) {
    const f = Math.sqrt(clamp((P.top - y) / (P.top - last[0]), 0, 1));
    w = last[1] * f; df = last[2] * f; db = last[3] * f; cz = last[4]; nf = last[5]; nb = last[6];
  } else { rowAt(hr, y, _r6);[w, df, db, cz, nf, nb] = _r6; }
  secXZ(w, df, db, nf, nb, phi, _xz);
  let x = _xz[0], z = _xz[1];
  if (feat) { const d = featDisp(P, true, phi, y); if (d) { const L = Math.hypot(x, z) || 1; x += x / L * d; z += z / L * d; } }
  out[0] = x; out[1] = y; out[2] = z + cz; return out;
}
function torsoPoint(P, phi, y, out) {
  rowAt(P.torsoRows, y, _r6);
  const [w, df, db, cz, nf, nb] = _r6;
  secXZ(w, df, db, nf, nb, phi, _xz);
  out[0] = _xz[0]; out[1] = y; out[2] = _xz[1] + cz; return out;
}

// ---------------------------------------------------------------------------------------------------------------
// Geometry builder
// ---------------------------------------------------------------------------------------------------------------
class GB {
  constructor(regSize = 4) { this.pos = []; this.uv = []; this.reg = []; this.si = []; this.sw = []; this.col = []; this.sx = []; this.idx = []; this.seams = []; this.regSize = regSize; }
  get n() { return this.pos.length / 3; }
  v(p, uv, reg, w, col, swing) {
    // w: {boneIndex: weight}
    const e = Object.entries(w).map(([b, x]) => [+b, x]).filter(a => a[1] > 1e-4).sort((a, b) => b[1] - a[1]).slice(0, 4);
    let s = 0; for (const a of e) s += a[1];
    while (e.length < 4) e.push([0, 0]);
    this.pos.push(p[0], p[1], p[2]); this.uv.push(uv[0], uv[1]);
    for (let i = 0; i < this.regSize; i++) this.reg.push(reg[i] || 0);
    for (const a of e) { this.si.push(a[0]); this.sw.push(a[1] / (s || 1)); }
    if (col) this.col.push(col[0], col[1], col[2]);
    if (swing !== undefined) this.sx.push(swing);
    return this.n - 1;
  }
  P(i) { return [this.pos[i * 3], this.pos[i * 3 + 1], this.pos[i * 3 + 2]]; }
  tri(a, b, c, hint) {
    const A = this.P(a), Bp = this.P(b), C = this.P(c);
    const ux = Bp[0] - A[0], uy = Bp[1] - A[1], uz = Bp[2] - A[2], vx = C[0] - A[0], vy = C[1] - A[1], vz = C[2] - A[2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    if (nx * hint[0] + ny * hint[1] + nz * hint[2] < 0) this.idx.push(a, c, b); else this.idx.push(a, b, c);
  }
  // connect two rings (arrays of N+1 indices, last = seam duplicate). centre: [x,y,z] of each ring for the outward hint
  bridge(r0, r1, c0, c1) {
    for (let i = 0; i < r0.length - 1; i++) {
      const a = r0[i], b = r0[i + 1], c = r1[i + 1], d = r1[i];
      const m = this.P(a), m2 = this.P(c);
      const hint = [(m[0] + m2[0]) / 2 - (c0[0] + c1[0]) / 2, (m[1] + m2[1]) / 2 - (c0[1] + c1[1]) / 2, (m[2] + m2[2]) / 2 - (c0[2] + c1[2]) / 2];
      this.tri(a, b, c, hint); this.tri(a, c, d, hint);
    }
  }
  cap(r, tip, dir) { for (let i = 0; i < r.length - 1; i++) this.tri(tip, r[i], r[i + 1], dir); }
  seam(r) { this.seams.push([r[0], r[r.length - 1]]); }
  build(extra) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(this.si, 4));
    g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(this.sw, 4));
    if (this.reg.length) g.setAttribute(extra || 'aReg', new THREE.Float32BufferAttribute(this.reg, this.regSize));
    if (this.col.length) g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    if (this.sx.length) g.setAttribute('aSwing', new THREE.Float32BufferAttribute(this.sx, 1));
    g.setIndex(this.idx);
    g.computeVertexNormals();
    const nr = g.attributes.normal;
    for (const [a, b] of this.seams) {
      const x = nr.getX(a) + nr.getX(b), y = nr.getY(a) + nr.getY(b), z = nr.getZ(a) + nr.getZ(b), l = Math.hypot(x, y, z) || 1;
      nr.setXYZ(a, x / l, y / l, z / l); nr.setXYZ(b, x / l, y / l, z / l);
    }
    g.computeBoundingBox(); g.computeBoundingSphere();
    return g;
  }
}

// weight helpers: chain blend
function chainW(bones, blends) {
  const w = {}; let acc = 1;
  for (let i = 0; i < bones.length; i++) {
    const b = i < blends.length ? blends[i] : 1;
    const own = i < blends.length ? acc * (1 - b) : acc;
    w[bones[i]] = (w[bones[i]] || 0) + own; acc *= b;
    if (i >= blends.length) break;
  }
  return w;
}
function moveW(w, bone, f) { if (f <= 0) return w; for (const k in w) w[k] *= (1 - f); w[bone] = (w[bone] || 0) + f; return w; }

const PART = { HEAD: 0, NECK: 1, TORSO: 2, ARM: 3, HAND: 4, THUMB: 5, LEG: 6, SHOE: 7, SKIRT: 8 };

function buildBody(P) {
  const B = new GB(4), J = P.J, k = P.k;
  const faceU = (phi) => 0.5 + phi / (TAU / 3);
  const faceV = (y) => (y - P.faceY0) / (P.faceY1 - P.faceY0);
  // ---------------- torso + neck + head ----------------
  {
    const N = 22, WARP = 0.30;
    const rings = [], cents = [];
    const tp = [0, 0, 0];
    const yNB = P.neckBaseY, y0 = P.crotchY, yCh = P.headRows[0][0];
    for (const r of P.rows) {
      const [y, w, df, db, cz, nf, nb, part] = r;
      const ring = []; let arc = 0, prev = null;
      for (let i = 0; i <= N; i++) {
        const u = -PI + TAU * i / N, phi = u - WARP * Math.sin(u);
        secXZ(w, df, db, nf, nb, phi, _xz);
        let x = _xz[0], z = _xz[1];
        const d = featDisp(P, part === 0, phi, y);
        if (d) { const L = Math.hypot(x, z) || 1; x += x / L * d; z += z / L * d; }
        const p = [x, y, z + cz];
        if (prev) arc += Math.hypot(p[0] - prev[0], p[2] - prev[2]); prev = p;
        let t, uv;
        if (part === 2) t = (y - y0) / (yNB - y0);
        else if (part === 1) t = (y - yNB) / (yCh - yNB);
        else t = (y - yCh) / (P.top - yCh);
        uv = part === 0 ? [faceU(phi), faceV(y)] : [arc, y];
        // weights
        const zb = Math.max(0, p[2] - J.neck[2]);
        const yb = y + (y > J.neck[1] + 0.02 * k ? 0.55 * zb : 0);
        const w8 = chainW([I_HIPS, I_SPINE, I_CHEST, I_NECK, I_HEAD], [
          smooth(J.hips[1] + 0.01 * k, J.spine[1] + 0.06 * k, yb), smooth(J.spine[1] + 0.07 * k, J.chest[1] + 0.03 * k, yb),
          smooth(J.neck[1] - 0.03 * k, J.neck[1] + 0.02 * k, yb), smooth(J.head[1] - 0.045 * k, J.head[1] - 0.008 * k, yb)]);
        const ax = Math.abs(x), s = x >= 0 ? 1 : -1;
        if (part === 2) {
          const sh = smooth(0.09 * k, 0.16 * k, ax) * smooth(J.chest[1] + 0.03 * k, J.upperArm[1] - 0.02 * k, y) * 0.8;
          moveW(w8, armIdx(s), sh);
          const ua = smooth(0.15 * k, 0.185 * k, ax) * smooth(J.upperArm[1] - 0.05 * k, J.upperArm[1] + 0.005 * k, y) * 0.3;
          moveW(w8, armIdx(s) + 1, ua);
          const th = smooth(J.thigh[1] + 0.03 * k, J.thigh[1] - 0.08 * k, y) * smooth(0.0, 0.08 * k, ax) * 0.45;
          moveW(w8, legIdx(s), th);
        }
        // ambient occlusion heuristics
        let ao = 1;
        if (part === 2) {
          ao -= 0.35 * smooth(0.10 * k, 0.15 * k, ax) * gauss(y - (J.upperArm[1] - 0.085 * k), 0.05 * k) * gauss(Math.abs(phi) - PI / 2, 0.7);
          ao -= 0.40 * smooth(J.thigh[1] - 0.02 * k, P.crotchY, y);
        } else if (part === 1) ao = 0.82 + 0.1 * t - 0.1 * smooth(0.5, 0.0, Math.abs(phi) / PI);
        else {
          ao -= 0.25 * smooth(P.headRows[3][0], P.headRows[0][0], y) * smooth(1.2, 0.2, Math.abs(phi));
          ao -= 0.12 * gauss(y - 1.664 * k * (P.sex === 'f' ? 1.0 : 1), 0.02) * gauss(Math.abs(phi) - 0.33, 0.2) * 0;
        }
        ring.push(B.v(p, uv, [part, t, phi, clamp(ao, 0.4, 1)], w8));
      }
      rings.push(ring); cents.push([0, y, cz]); B.seam(ring);
    }
    for (let i = 0; i < rings.length - 1; i++) B.bridge(rings[i], rings[i + 1], cents[i], cents[i + 1]);
    // caps
    const r0 = P.rows[0];
    const bot = B.v([0, r0[0] - 0.012 * k, r0[4]], [0, r0[0]], [2, 0, 0, 0.5], { [I_HIPS]: 1 });
    B.cap(rings[0], bot, [0, -1, 0]);
    const lr = P.headRows[P.headRows.length - 1];
    const topv = B.v([0, P.top, lr[4]], [0.5, faceV(P.top)], [0, 1, 0, 1], { [I_HEAD]: 1 });
    B.cap(rings[rings.length - 1], topv, [0, 1, 0]);
  }
  // ---------------- arms + hands ----------------
  for (const s of [1, -1]) {
    const ai = armIdx(s);
    const S = new THREE.Vector3(s * J.upperArm[0], J.upperArm[1], J.upperArm[2]);
    const E = new THREE.Vector3(s * J.forearm[0], J.forearm[1], J.forearm[2]);
    const W = new THREE.Vector3(s * J.hand[0], J.hand[1], J.hand[2]);
    const d1 = E.clone().sub(S), L1 = d1.length(); d1.normalize();
    const d2 = W.clone().sub(E), L2 = d2.length(); d2.normalize();
    const aE = L1, aW = L1 + L2;
    const at = (a) => a < aE ? S.clone().addScaledVector(d1, a) : a < aW ? E.clone().addScaledVector(d2, a - aE) : W.clone().addScaledVector(d2, a - aW);
    const tan = (a) => (Math.abs(a - aE) < 0.03 * k ? d1.clone().add(d2).normalize() : a < aE ? d1.clone() : d2.clone());
    const N = 10, rings = [], cents = [];
    for (let j = 0; j < P.arm.length; j++) {
      const [a, rl, rf, rb] = P.arm[j];
      const hand = j >= P.handFrom;
      const c = at(a), t = tan(a);
      const nz = new THREE.Vector3(0, 0, 1).addScaledVector(t, -t.z).normalize();
      const nx = new THREE.Vector3().crossVectors(nz, t).normalize();   // ~ +x
      // finger curl towards the palm (medial) and slightly forward
      const curl = smooth(0.62 * k, 0.76 * k, a);
      c.addScaledVector(nx, -s * 0.026 * k * curl * curl).addScaledVector(nz, 0.004 * curl);
      const ring = []; let arc = 0, prev = null;
      for (let i = 0; i <= N; i++) {
        const u = -PI + TAU * i / N;
        const phiL = u;   // + = outer side
        const sn = Math.sin(phiL), cs = Math.cos(phiL);
        const e = 2 / (hand ? 2.6 : 2.15);
        let lx = rl * Math.sign(sn) * Math.pow(Math.abs(sn), e);
        let lz = (cs >= 0 ? rf : rb) * Math.sign(cs) * Math.pow(Math.abs(cs), e);
        if (!hand && a > 0.1 * k && a < 0.25 * k) lz += 0.004 * k * Math.max(0, cs) * gauss(a - 0.16 * k, 0.05 * k); // biceps
        const p = c.clone().addScaledVector(nx, s * lx).addScaledVector(nz, lz);
        if (prev) arc += p.distanceTo(prev); prev = p;
        const w = chainW([ai, ai + 1, ai + 2, ai + 3], [
          0.55 + 0.45 * smooth(-0.03 * k, 0.07 * k, a), smooth(aE - 0.035 * k, aE + 0.035 * k, a), smooth(aW - 0.012 * k, aW + 0.022 * k, a)]);
        let ao = 1 - 0.4 * smooth(0.08 * k, -0.02 * k, a) * smooth(0.0, -1.0, sn) - 0.1 * (hand ? smooth(0, -1, sn) : 0);
        const part = hand ? PART.HAND : PART.ARM;
        const tt = hand ? 1 + (a - aW) / (0.21 * k) : a / aW;
        ring.push(B.v([p.x, p.y, p.z], [arc, -a], [part, tt, phiL, clamp(ao, 0.45, 1)], w));
      }
      rings.push(ring); cents.push([c.x, c.y, c.z]); B.seam(ring);
    }
    for (let i = 0; i < rings.length - 1; i++) B.bridge(rings[i], rings[i + 1], cents[i], cents[i + 1]);
    const a0 = P.arm[0][0], aN = P.arm[P.arm.length - 1][0];
    const top = at(a0 - 0.008 * k), tip = at(aN + 0.008 * k);
    const tipC = tip.clone().addScaledVector(new THREE.Vector3(1, 0, 0), -s * 0.026 * k);
    B.cap(rings[0], B.v([top.x, top.y, top.z], [0, -a0], [PART.ARM, a0 / aW, 0, 1], chainW([ai, ai + 1], [0.55])), d1.clone().negate().toArray());
    B.cap(rings[rings.length - 1], B.v([tipC.x, tipC.y, tipC.z], [0, -aN], [PART.HAND, 2, 0, 1], { [ai + 3]: 1 }), d2.toArray());
    // thumb
    {
      const base = at(aW + 0.03 * k).addScaledVector(new THREE.Vector3(0, 0, 1), 0.022 * k).addScaledVector(new THREE.Vector3(1, 0, 0), -s * 0.004 * k);
      const dir = new THREE.Vector3(-s * 0.32, -0.72, 0.62).normalize();
      const TR = [[0, 0.0145], [0.022, 0.0125], [0.044, 0.0105], [0.060, 0.0085]];
      const tn = 6, rings2 = [], c2 = [];
      const nz = new THREE.Vector3(0, 1, 0).addScaledVector(dir, -dir.y).normalize();
      const nx = new THREE.Vector3().crossVectors(nz, dir).normalize();
      for (const [d, r] of TR) {
        const c = base.clone().addScaledVector(dir, d * k);
        const ring = [];
        for (let i = 0; i <= tn; i++) {
          const u = -PI + TAU * i / tn;
          const p = c.clone().addScaledVector(nx, Math.sin(u) * r * k).addScaledVector(nz, Math.cos(u) * r * k * 0.85);
          ring.push(B.v([p.x, p.y, p.z], [u * 0.01, d], [PART.THUMB, 1.2, u, 0.85], { [ai + 3]: 1 }));
        }
        rings2.push(ring); c2.push([c.x, c.y, c.z]); B.seam(ring);
      }
      for (let i = 0; i < rings2.length - 1; i++) B.bridge(rings2[i], rings2[i + 1], c2[i], c2[i + 1]);
      const tp = base.clone().addScaledVector(dir, 0.068 * k);
      B.cap(rings2[rings2.length - 1], B.v([tp.x, tp.y, tp.z], [0, 0.07], [PART.THUMB, 1.3, 0, 0.9], { [ai + 3]: 1 }), dir.toArray());
      const bp = base.clone().addScaledVector(dir, -0.008 * k);
      B.cap(rings2[0], B.v([bp.x, bp.y, bp.z], [0, 0], [PART.THUMB, 1.1, 0, 0.8], { [ai + 3]: 1 }), dir.clone().negate().toArray());
    }
  }
  // ---------------- legs ----------------
  for (const s of [1, -1]) {
    const li = legIdx(s), hx = s * J.thigh[0];
    const N = 12, rings = [], cents = [];
    const yH = J.thigh[1], yK = J.shin[1], yA = J.foot[1];
    for (const [y, ro, ri, rf, rb] of P.leg) {
      const x0 = lerp(s * J.foot[0], hx, clamp((y - yA) / (yH - yA), 0, 1));
      const ring = []; let arc = 0, prev = null;
      for (let i = 0; i <= N; i++) {
        const u = -PI + TAU * i / N, sn = Math.sin(u), cs = Math.cos(u);
        const e = 2 / 2.1;
        let lx = (sn >= 0 ? ro : ri) * Math.sign(sn) * Math.pow(Math.abs(sn), e);
        let lz = (cs >= 0 ? rf : rb) * Math.sign(cs) * Math.pow(Math.abs(cs), e);
        // kneecap and calf shaping
        lz += 0.006 * k * Math.max(0, cs) * gauss(y - (yK + 0.01 * k), 0.025 * k) * gauss(sn, 0.6);
        lx += -0.004 * k * Math.max(0, -sn) * gauss(y - (yK + 0.04 * k), 0.05 * k);
        const p = [x0 + s * lx, y, lz];
        if (prev) arc += Math.hypot(p[0] - prev[0], p[2] - prev[2]); prev = p;
        const w = chainW([I_HIPS, li, li + 1, li + 2], [
          smooth(yH + 0.06 * k, yH - 0.07 * k, y), smooth(yK + 0.045 * k, yK - 0.04 * k, y), smooth(yA + 0.03 * k, yA - 0.015 * k, y)]);
        let ao = 1 - 0.42 * smooth(yH - 0.2 * k, yH - 0.03 * k, y) * smooth(0.2, -0.9, sn) - 0.15 * gauss(y - yK, 0.04 * k) * smooth(0.2, -1, cs);
        const t = (yH - y) / (yH - yA);
        ring.push(B.v(p, [arc, -y], [PART.LEG, t, u, clamp(ao, 0.45, 1)], w));
      }
      rings.push(ring); cents.push([x0, y, 0]); B.seam(ring);
    }
    for (let i = 0; i < rings.length - 1; i++) B.bridge(rings[i], rings[i + 1], cents[i], cents[i + 1]);
    const yt = P.leg[0][0] + 0.01 * k, yb = P.leg[P.leg.length - 1][0] - 0.015 * k;
    B.cap(rings[0], B.v([hx, yt, 0], [0, -yt], [PART.LEG, -0.1, 0, 1], { [I_HIPS]: 1 }), [0, 1, 0]);
    B.cap(rings[rings.length - 1], B.v([s * J.foot[0], yb, 0], [0, -yb], [PART.LEG, 1.1, 0, 0.5], { [li + 2]: 1 }), [0, -1, 0]);
  }
  // ---------------- shoes ----------------
  for (const s of [1, -1]) {
    const li = legIdx(s), fx = s * J.foot[0], fz = J.foot[2];
    const N = 10, rings = [], cents = [];
    const toeOut = s * 4 * DEG, co = Math.cos(toeOut), so = Math.sin(toeOut);
    const z0 = P.shoe[0][0], z1 = P.shoe[P.shoe.length - 1][0];
    const rot = (x, z) => [fx + x * co + z * so, fz - x * so + z * co];
    for (const [z, w, top, bot] of P.shoe) {
      const yc = (top + bot) / 2, hh = (top - bot) / 2;
      const ring = []; let arc = 0, prev = null;
      for (let i = 0; i <= N; i++) {
        const u = -PI + TAU * i / N, sn = Math.sin(u), cs = Math.cos(u);   // u = 0 top, +: outer side
        const e = 2 / (cs >= 0 ? 2.4 : 5.0);
        const lx = w * Math.sign(sn) * Math.pow(Math.abs(sn), e);
        const ly = hh * Math.sign(cs) * Math.pow(Math.abs(cs), e);
        const [px, pz] = rot(s * lx, z);
        const p = [px, yc + ly, pz];
        if (prev) arc += Math.hypot(p[0] - prev[0], p[1] - prev[1]); prev = p;
        const wt = { [li + 2]: 1 };
        moveW(wt, li + 3, smooth(P.ballZ - 0.03 * k, P.ballZ + 0.015 * k, z));
        moveW(wt, li + 1, 0.3 * smooth(0.07 * k, 0.095 * k, p[1]) * smooth(0.05 * k, -0.01 * k, z));
        const hf = (p[1] - bot) / Math.max(top - bot, 1e-3);
        ring.push(B.v(p, [arc, z], [PART.SHOE, hf, (z - z0) / (z1 - z0), 1 - 0.4 * smooth(0.2, 0, hf)], wt));
      }
      const [cx, cz] = rot(0, z);
      rings.push(ring); cents.push([cx, yc, cz]); B.seam(ring);
    }
    for (let i = 0; i < rings.length - 1; i++) B.bridge(rings[i], rings[i + 1], cents[i], cents[i + 1]);
    const f0 = P.shoe[0], fN = P.shoe[P.shoe.length - 1];
    const [bx, bz] = rot(0, z0 - 0.006), [tx, tz] = rot(0, z1 + 0.004);
    B.cap(rings[0], B.v([bx, (f0[2] + f0[3]) / 2, bz], [0, z0], [PART.SHOE, 0.5, 0, 1], { [li + 2]: 1 }), [0, 0, -1]);
    B.cap(rings[rings.length - 1], B.v([tx, (fN[2] + fN[3]) / 2, tz], [0, z1], [PART.SHOE, 0.5, 1, 1], { [li + 3]: 1 }), [0, 0, 1]);
  }
  return B.build();
}

function buildSkirt(P) {
  const B = new GB(4), J = P.J, k = P.k;
  const N = 20, rings = [], cents = [];
  const rows = [[1.070, 1.03, 1.0], [1.030, 1.05, 1.02], [0.985, 1.08, 1.05], [0.930, 1.10, 1.08], [0.860, 1.13, 1.12], [0.780, 1.20, 1.18], [0.700, 1.27, 1.24], [0.620, 1.33, 1.30]];
  const yTop = rows[0][0] * k, yHem = rows[rows.length - 1][0] * k;
  const tp = [0, 0, 0];
  for (const [ym, gw, gd] of rows) {
    const y = ym * k;
    const ring = []; let arc = 0, prev = null;
    const yy = Math.max(y, 0.93 * k);   // below the hips the skirt keeps the hip section, flared
    for (let i = 0; i <= N; i++) {
      const u = -PI + TAU * i / N;
      torsoPoint(P, u, yy, tp);
      const cz = -0.012 * k;
      const dz = tp[2] - cz, fl = (y < 0.93 * k) ? 1 + (0.93 * k - y) * 0.9 : 1;
      let x = tp[0] * gw * fl, z = cz + dz * gd * fl;
      x += Math.sign(x) * 0.006; z += Math.sign(dz) * 0.006;
      const p = [x, y, z];
      if (prev) arc += Math.hypot(p[0] - prev[0], p[2] - prev[2]); prev = p;
      const kk = smooth(0.95 * k, yHem, y) * 0.72;
      const wl = kk * smooth(-0.08 * k, 0.08 * k, x), wr = kk - wl;
      const w = { [I_HIPS]: 1 - kk, [legIdx(1)]: wl, [legIdx(-1)]: wr };
      ring.push(B.v(p, [arc, y], [PART.SKIRT, (yTop - y) / (yTop - yHem), u, 0.75 + 0.25 * smooth(yHem, yTop, y)], w));
    }
    rings.push(ring); cents.push([0, y, -0.012 * k]); B.seam(ring);
  }
  for (let i = 0; i < rings.length - 1; i++) B.bridge(rings[i], rings[i + 1], cents[i], cents[i + 1]);
  const g = B.build();
  g.userData.span = yTop - yHem;
  return g;
}

// ---------------------------------------------------------------------------------------------------------------
// Hair
// ---------------------------------------------------------------------------------------------------------------
// boundary: [|phi|, h] with h = normalised head height (0 = chin line, 1 = top of head), t0/t1 = thickness crown/edge
const HAIR = {
  short: { b: [[0, 0.715], [0.45, 0.705], [0.75, 0.665], [1.05, 0.60], [1.22, 0.47], [1.36, 0.53], [1.62, 0.575], [1.95, 0.47], [2.4, 0.30], [PI, 0.21]], t0: 0.013, t1: 0.0015, K: 7, hang: 0, quiff: 0.006 },
  medium: { b: [[0, 0.64], [0.32, 0.62], [0.55, 0.46], [0.78, 0.16], [1.1, 0.0], [1.6, -0.08], [2.4, -0.13], [PI, -0.15]], t0: 0.02, t1: 0.011, K: 10, hang: 1, taper: 0.22 },
  long: { b: [[0, 0.725], [0.40, 0.705], [0.62, 0.55], [0.82, 0.10], [1.05, -0.40], [1.6, -0.52], [2.2, -0.95], [PI, -1.08]], t0: 0.018, t1: 0.012, K: 13, hang: 1, taper: 0.0, back: 1 },
  ponytail: { b: [[0, 0.735], [0.5, 0.715], [0.8, 0.645], [1.1, 0.565], [1.36, 0.52], [1.62, 0.56], [2.0, 0.45], [2.5, 0.32], [PI, 0.25]], t0: 0.009, t1: 0.002, K: 7, hang: 0, tail: 1 },
  bob: { b: [[0, 0.60], [0.35, 0.60], [0.55, 0.44], [0.78, 0.14], [1.1, 0.02], [1.6, -0.02], [2.4, -0.04], [PI, -0.05]], t0: 0.019, t1: 0.012, K: 10, hang: 1, taper: 0.3 },
};
function boundH(b, phi) {
  const a = Math.abs(wrapA(phi));
  for (let i = 1; i < b.length; i++) if (a <= b[i][0]) { const t = (a - b[i - 1][0]) / (b[i][0] - b[i - 1][0]); const s = t * t * (3 - 2 * t); return lerp(b[i - 1][1], b[i][1], s); }
  return b[b.length - 1][1];
}
function buildHair(P, style) {
  const H = HAIR[style]; if (!H) return null;
  const B = new GB(0), J = P.J, k = P.k;
  const yCh = P.chinY, span = P.top - yCh, yW = P.headWideY;
  const C = [0, lerp(yCh, P.top, 0.5), 0];
  const M = 24, K = H.K;
  const hp = [0, 0, 0], wp = [0, 0, 0], tpt = [0, 0, 0];
  const headW = (y) => ({ [I_HEAD]: 1 - smooth(J.neck[1] + 0.07 * k, J.neck[1] - 0.01 * k, y), [I_CHEST]: smooth(J.neck[1] + 0.07 * k, J.neck[1] - 0.01 * k, y) });
  const lr = P.headRows[P.headRows.length - 1];
  const topV = B.v([0, P.top + H.t0 * 0.9, lr[4]], [0, 0], [], { [I_HEAD]: 1 }, [1, 1, 1], 0);
  const rings = [], cents = [];
  for (let kk = 1; kk <= K; kk++) {
    const s = kk / K, sp = Math.pow(s, 1.05);
    const ring = []; let cy = 0;
    for (let i = 0; i <= M; i++) {
      const u = -PI + TAU * i / M, phi = u;
      const hb = boundH(H.b, phi), yb = yCh + hb * span;
      const y = P.top - sp * (P.top - yb);
      let th = lerp(H.t0, H.t1, Math.pow(s, 1.5));
      if (H.quiff) th += H.quiff * gauss(phi, 0.6) * gauss(s - 0.35, 0.25);
      if (H.hang) th = Math.max(th, 0.022 * gauss(Math.abs(phi) - 1.68, 0.35) * smooth(0.62, 0.4, (y - yCh) / span) + H.t1 * 0.5);
      let p;
      if (y >= yW || !H.hang) {
        headPoint(P, phi, Math.max(y, yCh - 0.02), false, hp);
        const dx = hp[0] - C[0], dy = hp[1] - C[1], dz = hp[2] - C[2], L = Math.hypot(dx, dy, dz) || 1;
        p = [hp[0] + dx / L * th, hp[1] + dy / L * th, hp[2] + dz / L * th];
      } else {
        headPoint(P, phi, yW, false, wp);
        const d = (yW - y) / span;
        const taper = 1 - (H.taper || 0) * smooth(0.2, 0.8, d) * (Math.abs(phi) > 0.9 ? 1 : 0.5);
        const cz = wp[2] - 0 * 1;
        let x = wp[0] * taper, z = wp[2] * taper;
        // follow the head below the widest point if it bulges out more (jaw/ears)
        headPoint(P, phi, Math.max(y, yCh), false, hp);
        if (y > yCh && Math.hypot(hp[0], hp[2]) > Math.hypot(x, z)) { x = hp[0]; z = hp[2]; }
        const L = Math.hypot(x, z) || 1;
        x += x / L * th; z += z / L * th;
        if (H.back && y < P.neckBaseY + 0.05 * k) {   // lie on the upper back / shoulders
          torsoPoint(P, phi, y, tpt);
          const tl = Math.hypot(tpt[0], tpt[2] + 0.0) + 0.018 * k, cl = Math.hypot(x, z);
          if (tl > cl) { x *= tl / cl; z *= tl / cl; }
        }
        p = [x, y, z];
      }
      const ao = 1 - 0.3 * smooth(0.7, 1.0, s) - (H.hang ? 0.15 * smooth(0.5, 1.0, s) : 0);
      ring.push(B.v(p, [u / TAU * 7, s * (H.hang ? 4 : 2)], [], headW(y), [ao, ao, ao], 0));
      cy += y;
    }
    rings.push(ring); cents.push([0, cy / (M + 1), 0]); B.seam(ring);
  }
  // crown fan + bands
  for (let i = 0; i < M; i++) B.tri(topV, rings[0][i], rings[0][i + 1], [0, 1, 0]);
  for (let i = 0; i < rings.length - 1; i++) {
    for (let j = 0; j < M; j++) {
      const a = rings[i][j], b = rings[i][j + 1], c = rings[i + 1][j + 1], d = rings[i + 1][j];
      const pa = B.P(a), pc = B.P(c);
      const hint = [(pa[0] + pc[0]) / 2 - C[0], (pa[1] + pc[1]) / 2 - C[1] + 0.03, (pa[2] + pc[2]) / 2 - C[2]];
      B.tri(a, b, c, hint); B.tri(a, c, d, hint);
    }
  }
  if (H.tail) {
    headPoint(P, PI, yCh + 0.56 * span, false, hp);
    const T = new THREE.Vector3(hp[0], hp[1], hp[2] - 0.012 * k);
    const path = [[0, 0, 0, 0.017], [0, -0.03, -0.028, 0.026], [0, -0.09, -0.042, 0.028], [0, -0.16, -0.040, 0.024], [0, -0.22, -0.030, 0.016], [0, -0.26, -0.020, 0.006]];
    const tn = 8, rs = [], cs = [];
    let total = 0; for (let i = 1; i < path.length; i++) total += Math.hypot(path[i][1] - path[i - 1][1], path[i][2] - path[i - 1][2]);
    let acc = 0;
    for (let j = 0; j < path.length; j++) {
      if (j) acc += Math.hypot(path[j][1] - path[j - 1][1], path[j][2] - path[j - 1][2]);
      const c = T.clone().add(new THREE.Vector3(path[j][0], path[j][1] * k, path[j][2] * k));
      const nx = j < path.length - 1 ? j : j - 1;
      const dir = new THREE.Vector3(0, path[nx + 1][1] - path[nx][1], path[nx + 1][2] - path[nx][2]).normalize();
      const n2 = new THREE.Vector3(0, -dir.z, dir.y);   // perpendicular in yz plane (pointing back/up)
      const n1 = new THREE.Vector3(1, 0, 0);
      const ring = [];
      for (let i = 0; i <= tn; i++) {
        const u = -PI + TAU * i / tn;
        const r = path[j][3] * k;
        const p = c.clone().addScaledVector(n1, Math.sin(u) * r * 0.85).addScaledVector(n2, Math.cos(u) * r);
        const sw = acc / total;
        ring.push(B.v([p.x, p.y, p.z], [u / TAU * 3, acc * 6], [], { [I_HEAD]: 1 }, [0.85 + 0.15 * (j > 0 ? 1 : 0), 0.85 + 0.15 * (j > 0 ? 1 : 0), 0.85 + 0.15 * (j > 0 ? 1 : 0)], sw));
      }
      rs.push(ring); cs.push([c.x, c.y, c.z]); B.seam(ring);
    }
    for (let i = 0; i < rs.length - 1; i++) B.bridge(rs[i], rs[i + 1], cs[i], cs[i + 1]);
    const e = cs[cs.length - 1];
    B.cap(rs[rs.length - 1], B.v([e[0], e[1] - 0.006, e[2] + 0.002], [0, total * 6], [], { [I_HEAD]: 1 }, [1, 1, 1], 1), [0, -1, 0]);
    B.cap(rs[0], B.v([T.x, T.y + 0.004, T.z + 0.012], [0, 0], [], { [I_HEAD]: 1 }, [0.8, 0.8, 0.8], 0), [0, 0, 1]);
  }
  return B.build();
}

// ---------------------------------------------------------------------------------------------------------------
// Shared textures (runtime generated)
// ---------------------------------------------------------------------------------------------------------------
const TEX = {};
function hashI(x, y, s) { let h = (x * 374761393 + y * 668265263 + s * 982451653) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
function tileNoise(x, y, per, seed) {
  const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const h = (a, b) => hashI(((a % per) + per) % per, ((b % per) + per) % per, seed);
  return lerp(lerp(h(xi, yi), h(xi + 1, yi), u), lerp(h(xi, yi + 1), h(xi + 1, yi + 1), u), v);
}
function heightToNormal(hgt, S, strength) {
  const d = new Uint8Array(S * S * 4);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const hl = hgt[y * S + ((x - 1 + S) % S)], hr = hgt[y * S + ((x + 1) % S)];
    const hd = hgt[((y - 1 + S) % S) * S + x], hu = hgt[((y + 1) % S) * S + x];
    let nx = (hl - hr) * strength, ny = (hd - hu) * strength, nz = 1; const l = Math.hypot(nx, ny, nz);
    const i = (y * S + x) * 4;
    d[i] = (nx / l * 0.5 + 0.5) * 255; d[i + 1] = (ny / l * 0.5 + 0.5) * 255; d[i + 2] = (nz / l * 0.5 + 0.5) * 255; d[i + 3] = 255;
  }
  return d;
}
function dataTex(d, S, repeat) {
  const t = new THREE.DataTexture(d, S, S, THREE.RGBAFormat);
  t.wrapS = t.wrapT = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true;
  t.anisotropy = 4; t.needsUpdate = true;
  return t;
}
function fabricNormal() {
  if (TEX.fabric) return TEX.fabric;
  const S = 128, h = new Float32Array(S * S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const tw = Math.sin((x + y) * TAU / 8) * 0.5 + Math.sin(x * TAU / 4) * Math.sin(y * TAU / 4) * 0.35;
    const n = tileNoise(x / 16, y / 16, 8, 3) * 1.4 + tileNoise(x / 4, y / 4, 32, 7) * 0.5;
    h[y * S + x] = tw * 0.35 + n;
  }
  TEX.fabric = dataTex(heightToNormal(h, S, 1.6), S, true);
  TEX.fabric.repeat.set(16, 16);
  return TEX.fabric;
}
function hairTextures() {
  if (TEX.hairN) return;
  const S = 256, h = new Float32Array(S * S), alb = new Uint8Array(S * S * 4);
  const strands = new Float32Array(S);
  for (let x = 0; x < S; x++) strands[x] = hashI(x, 1, 11);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const wob = Math.sin(y / S * TAU * 2 + x * 0.3) * 1.5 + tileNoise(x / 32, y / 32, 8, 5) * 6;
    const xs = ((x + wob) % S + S) % S, xi = Math.floor(xs), f = xs - xi;
    const sv = lerp(strands[xi], strands[(xi + 1) % S], f);
    const clump = tileNoise(xs / 12, y / 64, S / 12 | 0, 9);
    const v = sv * 0.6 + clump * 0.5 + tileNoise(xs / 3, y / 40, (S / 3) | 0, 13) * 0.35;
    h[y * S + x] = v;
    const a = 150 + v * 90, i = (y * S + x) * 4;
    alb[i] = alb[i + 1] = alb[i + 2] = clamp(a, 0, 255); alb[i + 3] = 255;
  }
  TEX.hairN = dataTex(heightToNormal(h, S, 2.2), S, true);
  TEX.hairA = dataTex(alb, S, true);
}
// face mask: R brows, G lips, B eye whites, A dark (iris 0.5 / pupils, lash line, nostrils, mouth line 1.0)
function faceTexture(P) {
  const key = 'face' + P.sex;
  if (TEX[key] !== undefined) return TEX[key];
  if (typeof document === 'undefined' && typeof OffscreenCanvas === 'undefined') return (TEX[key] = null);
  const S = 256;
  const mk = () => { const c = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(S, S) : Object.assign(document.createElement('canvas'), { width: S, height: S }); const g = c.getContext('2d', { willReadFrequently: true }); g.fillStyle = '#000'; g.fillRect(0, 0, S, S); return [c, g]; };
  const hr = P.headRows, row = [0, 0, 0, 0, 0, 0];
  // map metric face coordinates (x across, y height) to texture pixels via the head's section parameterisation
  const px = (x, y) => {
    rowAt(hr, y, row); const w = row[0], e = 2 / row[4];
    const sphi = Math.min(1, Math.pow(Math.abs(x) / w, 1 / e));
    const phi = Math.sign(x) * Math.asin(sphi);
    return [(0.5 + phi / (TAU / 3)) * S, (1 - (y - P.faceY0) / (P.faceY1 - P.faceY0)) * S];
  };
  const sy = (P.top - P.chinY) / (MALE.top - MALE.chinY);   // head scale
  const Y = (ym) => P.top - (MALE.top - ym) * sy;          // male reference heights -> this head
  const f = P.sex === 'f';
  const poly = (g, pts, fill) => { g.beginPath(); pts.forEach(([x, y], i) => { const [a, b] = px(x * sy, Y(y)); i ? g.lineTo(a, b) : g.moveTo(a, b); }); g.closePath(); g.fillStyle = fill; g.fill(); };
  const ell = (cx, cy, rx, ry, n = 20) => { const a = []; for (let i = 0; i < n; i++) { const t = i / n * TAU; a.push([cx + Math.cos(t) * rx, cy + Math.sin(t) * ry]); } return a; };
  const eyeC = 0.0315, eyeY = 1.664;
  const [cR, gR] = mk(), [cG, gG] = mk(), [cB, gB] = mk(), [cA, gA] = mk();
  for (const s of [1, -1]) {
    // eyebrow: arched band
    const bw = [], bw2 = [];
    for (let i = 0; i <= 12; i++) {
      const t = i / 12, x = s * lerp(0.010, 0.050, t);
      const arch = (f ? 0.0075 : 0.0045) * Math.sin(Math.min(1, t * 1.25) * PI * 0.8);
      const yb = eyeY + 0.0145 + arch - t * 0.003;
      const th = (f ? 0.0032 : 0.0052) * (1 - 0.6 * t * t) + 0.0008;
      bw.push([x, yb + th * 0.5]); bw2.unshift([x, yb - th * 0.5]);
    }
    gR.filter = 'blur(1.2px)'; poly(gR, bw.concat(bw2), '#fff');
    // eye white (almond)
    const al = [], hw = 0.0145, hh = f ? 0.0052 : 0.0046;
    for (let i = 0; i < 24; i++) { const t = i / 24 * TAU; const x = Math.cos(t) * hw, y = Math.sin(t) * hh * (Math.sin(t) > 0 ? 1 : 0.8) * (1 - 0.35 * Math.abs(Math.cos(t)) * Math.sign(x * s)); al.push([s * eyeC + x, eyeY + y]); }
    gB.filter = 'blur(0.6px)'; poly(gB, al, '#fff');
    // iris, pupil, lash line
    gA.filter = 'blur(0.5px)';
    poly(gA, ell(s * eyeC, eyeY - 0.0003, 0.0056, 0.0056), '#808080');
    poly(gA, ell(s * eyeC, eyeY - 0.0003, 0.0022, 0.0022), '#fff');
    const lash = [];
    for (let i = 0; i <= 12; i++) { const t = i / 12, x = s * (eyeC - hw * 1.05 + t * hw * 2.1); lash.push([x, eyeY + hh * Math.sin(t * PI) * 1.05 + 0.0004]); }
    for (let i = 12; i >= 0; i--) { const t = i / 12, x = s * (eyeC - hw * 1.05 + t * hw * 2.1); lash.push([x, eyeY + hh * Math.sin(t * PI) * 1.05 + (f ? 0.0022 : 0.0013)]); }
    poly(gA, lash, f ? '#fff' : '#d0d0d0');
    // nostril
    poly(gA, ell(s * 0.0072, 1.6085, 0.0032, 0.0016), '#a0a0a0');
  }
  // lips
  const lw = f ? 0.0235 : 0.0245;
  const up = [], lo = [];
  for (let i = 0; i <= 16; i++) {
    const t = i / 16, x = (t * 2 - 1) * lw, e = 1 - Math.pow(Math.abs(t * 2 - 1), 2.2);
    const bow = 0.0012 * gauss(Math.abs(x) - 0.006, 0.004) - 0.0008 * gauss(x, 0.003);
    up.push([x, 1.5955 + e * (f ? 0.0052 : 0.0040) + bow * e]);
    lo.unshift([x, 1.5955 - e * (f ? 0.0068 : 0.0058)]);
  }
  gG.filter = 'blur(0.8px)'; poly(gG, up.concat(lo), '#fff');
  // mouth line
  const ml = [];
  for (let i = 0; i <= 16; i++) { const t = i / 16, x = (t * 2 - 1) * lw * 0.98; ml.push([x, 1.5955 + 0.0005 - 0.0008 * Math.abs(t * 2 - 1)]); }
  for (let i = 16; i >= 0; i--) { const t = i / 16, x = (t * 2 - 1) * lw * 0.98; ml.push([x, 1.5955 - 0.0007 - 0.0008 * Math.abs(t * 2 - 1)]); }
  gA.filter = 'blur(0.6px)'; poly(gA, ml, '#b0b0b0');
  const d = new Uint8Array(S * S * 4);
  const R = gR.getImageData(0, 0, S, S).data, G = gG.getImageData(0, 0, S, S).data, Bb = gB.getImageData(0, 0, S, S).data, A = gA.getImageData(0, 0, S, S).data;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const src = (y * S + x) * 4, dst = ((S - 1 - y) * S + x) * 4;
    d[dst] = R[src]; d[dst + 1] = G[src]; d[dst + 2] = Bb[src]; d[dst + 3] = A[src];
  }
  const t = dataTex(d, S, false);
  t.anisotropy = 8;
  return (TEX[key] = t);
}

// ---------------------------------------------------------------------------------------------------------------
// Materials
// ---------------------------------------------------------------------------------------------------------------
const BODY_VERT_PARS = /* glsl */`
attribute vec4 aReg;
varying vec4 vReg;
varying vec2 vHUv;
uniform vec4 uTopA;   // hem t, sleeve end t, pattern, top kind
uniform vec4 uBotA;   // waist t, leg end t, sock top t, bottom kind
uniform vec4 uMisc;   // shoe kind, girth, beard, scalp
uniform vec4 uMisc2;  // skirt y shift, jacket open, tights, sex
float hOffset(vec4 r) {
  float part = r.x, t = r.y, aa = abs(r.z);
  float topK = uTopA.w, botK = uBotA.w, g = uMisc.y;
  float thT = topK < 0.5 ? 0.0035 : (topK < 1.5 ? 0.012 : (topK < 2.5 ? 0.015 : (topK < 3.5 ? 0.005 : 0.009)));
  float thB = botK < 0.5 ? 0.0035 : (botK < 1.5 ? 0.005 : (botK < 2.5 ? 0.0 : (botK < 3.5 ? 0.006 : 0.008)));
  float off = 0.0;
  if (part > 1.5 && part < 2.5) {
    float belly = exp(-pow((t - 0.40) / 0.17, 2.0)) * (1.0 - smoothstep(0.4, 1.7, aa));
    off += g * (0.032 * belly + 0.010 * (1.0 - smoothstep(0.85, 1.0, t)));
    off += t > uTopA.x ? thT : thB;
    if (topK > 0.5 && topK < 1.5) off += 0.03 * smoothstep(0.90, 1.0, t) * smoothstep(1.9, 2.8, aa);
    if (topK > 1.5 && topK < 2.5) off += 0.004 * smoothstep(0.93, 1.0, t) + 0.006 * (1.0 - smoothstep(0.0, 0.03, t - uTopA.x));
  } else if (part > 0.5 && part < 1.5) {
    if (topK > 0.5 && topK < 1.5) off += (0.03 * smoothstep(1.5, 2.6, aa) + 0.013) * (1.0 - smoothstep(0.3, 0.75, t));
    if (topK > 1.5 && topK < 2.5) off += 0.02 * (1.0 - smoothstep(0.45, 0.62, t)) * smoothstep(0.3, 0.9, aa);
    if (topK > 2.5 && topK < 3.5) off += 0.005 * (1.0 - smoothstep(0.4, 0.5, t)) * smoothstep(0.25, 0.6, aa);
  } else if (part > 2.5 && part < 3.5) {
    off += g * 0.007 * (1.0 - smoothstep(0.3, 0.6, t));
    if (t < uTopA.y) off += thT + (uTopA.y < 0.95 ? 0.007 * smoothstep(uTopA.y - 0.25, uTopA.y, t) : -0.004 * smoothstep(0.9, 1.0, t));
  } else if (part > 5.5 && part < 6.5) {
    off += g * 0.012 * (1.0 - smoothstep(0.1, 0.5, t));
    if (t < uBotA.y) {
      off += thB;
      if (botK < 1.5) off += 0.011 * smoothstep(0.82, 1.02, t);
      if (botK > 2.5 && botK < 3.5) off += 0.014 * smoothstep(uBotA.y - 0.25, uBotA.y, t);
      if (botK > 3.5) off += 0.003 - 0.009 * smoothstep(0.88, 0.98, t);
    }
    if (uMisc.x > 1.5 && uMisc.x < 2.5) off += 0.007 * smoothstep(0.76, 0.8, t);
  }
  return off;
}
`;
const BODY_FRAG_PARS = /* glsl */`
varying vec4 vReg;
varying vec2 vHUv;
uniform vec3 uSkin, uTop, uTop2, uBot, uShoe, uSole, uHair, uEye, uLip, uSock;
uniform vec4 uTopA, uBotA, uMisc, uMisc2;
uniform sampler2D uFace;
vec3 hAlb; float hRough; float hNrmK; vec2 hWr; float hAO;
float hHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float hNoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hHash(i), hHash(i + vec2(1.0, 0.0)), f.x), mix(hHash(i + vec2(0.0, 1.0)), hHash(i + vec2(1.0, 1.0)), f.x), f.y); }
float hLine(float x, float c, float w) { float d = abs(x - c); float fw = fwidth(x) + 1e-5; return 1.0 - smoothstep(w, w + fw * 1.2, d); }
vec3 topPattern(vec3 base, vec2 uv) {
  float pat = uTopA.z;
  if (pat > 0.5 && pat < 1.5) { float s = step(0.5, fract(uv.y / 0.034)); return mix(base, uTop2, s); }
  if (pat > 1.5 && pat < 2.5) {
    vec2 q = fract(uv / 0.085);
    float a = step(q.x, 0.36), b = step(q.y, 0.36);
    float th = hLine(q.x, 0.62, 0.02) + hLine(q.y, 0.62, 0.02);
    vec3 c = mix(base, uTop2, clamp(a + b, 0.0, 1.0) * 0.55 + a * b * 0.35);
    return mix(c, vec3(0.6), clamp(th, 0.0, 1.0) * 0.25);
  }
  if (pat > 2.5 && pat < 3.5) { float n = hNoise(uv * 180.0) * 0.6 + hNoise(uv * 40.0) * 0.4; return base * (0.82 + 0.3 * n); }
  return base;
}
void hSurface() {
  float part = vReg.x, t = vReg.y, ang = vReg.z, aa = abs(ang);
  vec2 uv = vHUv;
  float topK = uTopA.w, botK = uBotA.w, shoeK = uMisc.x;
  hAO = vReg.w; hNrmK = 0.0; hWr = vec2(0.0); hRough = 0.5;
  vec3 skin = uSkin;
  float layer = 0.0;   // 0 skin, 1 top, 2 bottom, 3 shoe, 4 inner layer, 5 sock, 6 sole
  float detail = 1.0;
  if (part < 0.5) {
    // ---------------- head / face ----------------
    vec4 fm = texture2D(uFace, uv);
    float nz = hNoise(uv * vec2(90.0, 60.0));
    // subtle warmth on cheeks, nose, ears
    float cheek = exp(-pow((aa - 0.75) / 0.3, 2.0) - pow((t - 0.40) / 0.12, 2.0));
    float nose = exp(-pow(ang / 0.12, 2.0) - pow((t - 0.36) / 0.08, 2.0));
    float ear = exp(-pow((aa - 1.68) / 0.18, 2.0) - pow((t - 0.45) / 0.12, 2.0));
    skin *= vec3(1.0 + 0.10 * (cheek + nose + ear), 1.0 - 0.02 * (cheek + nose), 1.0 - 0.03 * (cheek + nose + ear));
    // beard / stubble
    float cheekLine = 0.30 + 0.20 * smoothstep(0.35, 1.3, aa);
    float bm = (1.0 - smoothstep(cheekLine - 0.03, cheekLine + 0.03, t)) * (1.0 - smoothstep(1.35, 1.55, aa));
    bm *= smoothstep(0.0, 0.06, t) + (1.0 - smoothstep(0.3, 0.9, aa)) * 0.0;
    bm *= 1.0 - fm.g * 0.9;
    float beard = uMisc.z * bm * (0.75 + 0.5 * hNoise(uv * 220.0));
    skin = mix(skin, uHair * 0.55 + skin * 0.12, clamp(beard, 0.0, 0.92));
    // scalp shading under / instead of hair
    float hl = mix(0.735, 0.575, smoothstep(0.55, 1.25, aa));
    hl = mix(hl, 0.25, smoothstep(1.9, 2.9, aa));
    float scalp = smoothstep(hl - 0.01, hl + 0.02, t) * (1.0 - exp(-pow((aa - 1.68) / 0.2, 2.0)) * (1.0 - smoothstep(0.52, 0.6, t)));
    skin = mix(skin, uHair * 0.6 + skin * 0.1, scalp * uMisc.w * (0.7 + 0.3 * nz));
    // lips, brows, eyes
    skin = mix(skin, uLip, fm.g * 0.62);
    skin = mix(skin, uHair * 0.42, fm.r * 0.9);
    vec3 sclera = vec3(0.62, 0.58, 0.55);
    skin = mix(skin, sclera, fm.b);
    float iris = smoothstep(0.3, 0.45, fm.a) * (1.0 - smoothstep(0.7, 0.9, fm.a));
    float dark = smoothstep(0.55, 0.95, fm.a);
    skin = mix(skin, uEye, iris * fm.b);
    skin = mix(skin, vec3(0.018, 0.012, 0.01), dark * (0.55 + 0.45 * fm.b));
    hAlb = skin;
    hRough = mix(0.48, 0.25, fm.b) - fm.g * 0.08 + beard * 0.2;
    return;
  }
  if (part < 1.5) {
    // neck (collar of hoodie / jacket / shirt)
    if (topK > 0.5 && topK < 1.5 && t < 0.62) layer = 1.0;
    if (topK > 1.5 && topK < 2.5 && t < 0.52 && aa > 0.32) layer = 1.0;
    if (topK > 2.5 && topK < 3.5 && t < 0.45 && aa > 0.25) layer = 1.0;
  } else if (part < 2.5) {
    // torso
    float neckY = 0.962 + 0.03 * smoothstep(0.2, 2.2, aa);
    if (topK > 2.5 && topK < 3.5) neckY = mix(0.905, 0.99, smoothstep(0.05, 0.5, aa));
    if (topK > 1.5 && topK < 2.5) neckY = 1.2;
    if (topK > 0.5 && topK < 1.5) neckY = 0.975 + 0.03 * smoothstep(0.2, 1.5, aa);
    if (t > uTopA.x) layer = t > neckY ? 0.0 : 1.0; else layer = 2.0;
    if (topK > 1.5 && topK < 2.5 && uMisc2.y > 0.5 && t > uTopA.x && aa < 0.24) layer = t > 0.965 + 0.02 * smoothstep(0.0, 0.2, aa) ? 0.0 : 4.0;
    if (botK > 1.5 && botK < 2.5 && layer > 1.5 && layer < 2.5) layer = 2.0;
  } else if (part < 3.5) {
    layer = t < uTopA.y ? 1.0 : 0.0;
  } else if (part < 5.5) {
    layer = 0.0;
  } else if (part < 6.5) {
    layer = t < uBotA.y ? 2.0 : (t > uBotA.z ? 5.0 : 0.0);
    if (shoeK > 1.5 && shoeK < 2.5 && t > 0.78) layer = 3.0;
  } else if (part < 7.5) {
    layer = t < (shoeK > 0.5 && shoeK < 1.5 ? 0.13 : 0.2) ? 6.0 : 3.0;
    if (shoeK > 2.5 && t > 0.62 && ang > 0.18) layer = 5.0;
  } else {
    layer = 2.0;
  }
  vec3 alb = skin; float rough = 0.5;
  float nz = hNoise(uv * 23.0);
  if (layer < 0.5) {
    alb = skin; rough = 0.5; hNrmK = 0.0;
    if (part > 5.5 && part < 6.5 && uMisc2.z > 0.5) { alb = mix(skin, uSock, 0.72); rough = 0.4; }
    if (part > 3.5 && part < 5.5) alb *= vec3(1.03, 0.985, 0.975);
  } else if (layer < 1.5) {
    // tops
    alb = topPattern(uTop, uv);
    rough = 0.82; hNrmK = 0.55;
    if (topK > 1.5 && topK < 2.5) { rough = uMisc2.w > 1.5 ? 0.42 : 0.72; hNrmK = uMisc2.w > 1.5 ? 0.25 : 0.8; }
    if (part > 1.5 && part < 2.5) {
      // hems, collars, pockets, zips
      if (topK < 0.5) alb *= 1.0 - 0.18 * hLine(t, mix(0.962, 0.992, smoothstep(0.2, 2.2, aa)) - 0.008, 0.006);
      if (topK > 0.5 && topK < 1.5) {
        float pocket = hLine(t, 0.36, 0.003) * step(aa, 0.62) + hLine(aa, 0.62, 0.012) * step(t, 0.36) * step(0.2, t);
        alb *= 1.0 - 0.25 * pocket;
        alb = mix(alb, vec3(0.75), hLine(ang, 0.1, 0.006) * step(0.84, t) + hLine(ang, -0.1, 0.006) * step(0.84, t));
        alb *= 1.0 - 0.15 * (1.0 - smoothstep(0.0, 0.035, t - uTopA.x));
      }
      if (topK > 1.5 && topK < 2.5) {
        alb *= 1.0 - 0.3 * hLine(aa, 0.25, 0.01) * uMisc2.y;
        alb = mix(alb, vec3(0.35), hLine(ang, 0.0, 0.005) * (1.0 - uMisc2.y));
        alb *= 1.0 - 0.25 * hLine(t, 0.3, 0.003) * step(0.5, aa) * step(aa, 1.2);
        alb *= 1.0 - 0.2 * (1.0 - smoothstep(0.0, 0.03, t - uTopA.x));
      }
      if (topK > 2.5 && topK < 3.5) {
        alb *= 1.0 - 0.25 * hLine(ang, 0.0, 0.006);
        float bt = hLine(fract(t * 11.0), 0.5, 0.06) * hLine(ang, 0.0, 0.012);
        alb = mix(alb, vec3(0.8), bt * 0.6);
      }
    }
    if (part > 2.5 && part < 3.5) {
      if (uTopA.y > 0.95) { alb *= 1.0 - 0.18 * smoothstep(0.93, 0.95, t); hWr.y += sin(uv.y * 170.0) * 0.35 * smoothstep(0.82, 1.0, t); }
      else alb *= 1.0 - 0.15 * hLine(t, uTopA.y - 0.02, 0.008);
      hWr.y += sin(uv.y * 150.0) * 0.4 * exp(-pow((t - 0.55) / 0.06, 2.0)) * step(0.55, uTopA.y);
    }
    if (part > 0.5 && part < 1.5) alb *= 0.9;
  } else if (layer < 2.5) {
    // bottoms
    alb = uBot; rough = 0.85; hNrmK = 0.7;
    if (botK < 0.5) {   // jeans: twill, fades, seams
      hNrmK = 1.0; rough = 0.9;
      float fade = 0.0;
      if (part > 5.5) fade = exp(-pow((t - 0.25) / 0.2, 2.0)) * (1.0 - smoothstep(0.3, 1.2, aa)) + 0.6 * exp(-pow((t - 0.52) / 0.06, 2.0)) * (1.0 - smoothstep(0.2, 0.9, aa));
      alb *= 1.0 + 0.35 * fade * (0.7 + 0.6 * nz);
      alb *= 1.0 - 0.2 * exp(-pow((t - 0.5) / 0.05, 2.0)) * smoothstep(1.8, 2.6, aa) * step(5.5, part);
      float seam = part > 5.5 ? hLine(ang, 1.57, 0.012) + hLine(ang, -1.57, 0.012) : 0.0;
      alb = mix(alb, vec3(0.55, 0.38, 0.2), seam * 0.35);
    }
    if (botK > 0.5 && botK < 1.5) { rough = 0.8; hNrmK = 0.5; if (part > 5.5) alb *= 1.0 - 0.12 * hLine(ang, 0.0, 0.008); }
    if (botK > 3.5) {   // tracksuit side stripes
      rough = 0.6; hNrmK = 0.35;
      float st = part > 5.5 ? (hLine(ang, 1.50, 0.022) + hLine(ang, 1.67, 0.022)) : 0.0;
      alb = mix(alb, vec3(0.8), clamp(st, 0.0, 1.0));
    }
    if (botK > 1.5 && botK < 2.5) { rough = 0.8; hNrmK = 0.5; alb *= 1.0 - 0.12 * hLine(t, 0.97, 0.01) * step(7.5, part); }
    if (part > 1.5 && part < 2.5) {   // waistband, belt, pockets
      float wb = hLine(t, uBotA.x - 0.012, 0.014);
      alb *= 1.0 - 0.12 * wb;
      if (uTopA.x > uBotA.x - 0.03 && botK < 1.5) alb = mix(alb, vec3(0.05, 0.035, 0.03), hLine(t, uBotA.x - 0.012, 0.010));
      if (botK < 0.5) alb *= 1.0 - 0.3 * (hLine(aa, 2.1, 0.01) + hLine(aa, 2.75, 0.01)) * step(uBotA.x - 0.2, t) * step(t, uBotA.x - 0.04);
    }
    if (part > 5.5 && part < 6.5) {
      hWr.y += sin(uv.y * 130.0) * 0.45 * smoothstep(0.85, 1.0, t);
      hWr.y += sin(uv.y * 160.0) * 0.35 * exp(-pow((t - 0.5) / 0.05, 2.0)) * smoothstep(1.4, 2.4, aa);
      hWr.y += sin(uv.y * 120.0 + ang * 3.0) * 0.3 * (1.0 - smoothstep(0.0, 0.12, t)) * smoothstep(1.0, 2.0, abs(ang + 1.57));
    }
  } else if (layer < 3.5) {
    // shoes
    alb = uShoe; rough = shoeK > 0.5 && shoeK < 1.5 ? 0.32 : 0.6; hNrmK = shoeK > 0.5 && shoeK < 2.5 ? 0.15 : 0.5;
    if (part > 6.5) {
      if (shoeK < 0.5) {
        alb *= 1.0 - 0.15 * hLine(t, 0.34, 0.01);
        float lace = step(0.9, t) * step(0.3, ang) * step(ang, 0.62) * step(0.5, fract(ang * 38.0));
        alb = mix(alb, uSole, lace * 0.7);
        alb = mix(alb, uSole * 0.9, step(0.85, ang) * 0.0);
      }
      if (shoeK > 0.5 && shoeK < 1.5) alb *= 1.0 - 0.3 * hLine(t, 0.8, 0.01);
    } else alb *= 0.95;
  } else if (layer < 4.5) {
    alb = uTop2; rough = 0.85; hNrmK = 0.5;
  } else if (layer < 5.5) {
    alb = uSock; rough = 0.9; hNrmK = 0.6;
    if (part > 6.5) { alb = skin; rough = 0.5; hNrmK = 0.0; }
  } else {
    alb = uSole; rough = 0.7; hNrmK = 0.3;
    alb *= 1.0 - 0.3 * hLine(t, 0.12, 0.012);
  }
  hWr += (vec2(hNoise(uv * 14.0), hNoise(uv * 14.0 + 7.3)) - 0.5) * 0.25 * step(0.5, hNrmK);
  hWr *= step(0.01, hNrmK);
  hAlb = alb * (0.86 + 0.14 * hAO);
  hRough = rough;
}
`;

function bodyMaterial(U, side) {
  const m = new THREE.MeshStandardMaterial({ roughness: 0.8, metalness: 0, normalMap: fabricNormal(), normalScale: new THREE.Vector2(0.7, 0.7), side: side || THREE.FrontSide });
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\n' + BODY_VERT_PARS)
      .replace('#include <begin_vertex>', 'vec3 transformed = vec3( position );\nvReg = aReg; vHUv = uv;\ntransformed += normal * hOffset(aReg);\nif (aReg.x > 7.5) transformed.y += uMisc2.x * aReg.y;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\n' + BODY_FRAG_PARS)
      .replace('vec4 diffuseColor = vec4( diffuse, opacity );', 'hSurface();\nvec4 diffuseColor = vec4( hAlb, opacity );')
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = hRough;')
      .replace('#include <normal_fragment_maps>', THREE.ShaderChunk.normal_fragment_maps.replace('mapN.xy *= normalScale;', 'mapN.xy *= normalScale * hNrmK; mapN.xy += hWr;'))
      .replace('#include <aomap_fragment>', '#include <aomap_fragment>\nreflectedLight.indirectDiffuse *= hAO; reflectedLight.indirectSpecular *= mix(1.0, hAO, 0.8);');
  };
  m.customProgramCacheKey = () => 'human-body-1' + (side === THREE.DoubleSide ? 'd' : '');
  return m;
}
function hairMaterial(U) {
  hairTextures();
  const m = new THREE.MeshStandardMaterial({ color: U.uHair.value, vertexColors: true, map: TEX.hairA, normalMap: TEX.hairN, normalScale: new THREE.Vector2(0.9, 0.9), roughness: 0.52, metalness: 0, side: THREE.DoubleSide });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uSwing = U.uSwing;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aSwing;\nuniform vec3 uSwing;')
      .replace('#include <begin_vertex>', 'vec3 transformed = vec3( position ) + uSwing * aSwing * aSwing;');
  };
  m.customProgramCacheKey = () => 'human-hair-1';
  return m;
}

// ---------------------------------------------------------------------------------------------------------------
// Shared per-sex assets
// ---------------------------------------------------------------------------------------------------------------
const ASSETS = {};
function sexAssets(sex) {
  if (ASSETS[sex]) return ASSETS[sex];
  const P = sex === 'f' ? FEMALE : MALE;
  const J = P.J;
  const pos = (i) => {
    const n = HUMAN_BONES[i], base = n.replace(/_[LR]$/, ''), s = n.endsWith('_R') ? -1 : 1;
    const v = J[base]; return [v[0] * s, v[1], v[2]];
  };
  const world = []; for (let i = 0; i < NB; i++) world.push(pos(i));
  const local = world.map((w, i) => PARENT[i] < 0 ? w.slice() : [w[0] - world[PARENT[i]][0], w[1] - world[PARENT[i]][1], w[2] - world[PARENT[i]][2]]);
  const inverses = world.map(w => new THREE.Matrix4().makeTranslation(-w[0], -w[1], -w[2]));
  const geo = buildBody(P);
  const A = { P, world, local, inverses, geo, skirt: null, hair: {} };
  // rig constants
  const k = P.k;
  A.rig = {
    k, hipsY: J.hips[1], hjx: J.thigh[0], hjy: J.thigh[1] - J.hips[1],
    lt: J.thigh[1] - J.shin[1], ls: J.shin[1] - J.foot[1], ankleH: J.foot[1],
    hv: [J.foot[2] - P.heelZ, J.foot[1]],               // heel pivot -> ankle
    bv: [J.foot[2] - P.ballZ, J.foot[1]],               // ball pivot -> ankle
    fb: P.ballZ - P.heelZ,
    heelOff: P.heelZ - J.foot[2],
  };
  // sit ergonomics (metres, group-local, for a 1.78 m reference person; scaled by height in createHuman)
  return (ASSETS[sex] = A);
}
function skirtGeo(A) { return A.skirt || (A.skirt = buildSkirt(A.P)); }
function hairGeo(A, style) { if (!(style in A.hair)) A.hair[style] = buildHair(A.P, style); return A.hair[style]; }

// ---------------------------------------------------------------------------------------------------------------
// Appearance options
// ---------------------------------------------------------------------------------------------------------------
function pickW(rng, arr) { let s = 0; for (const a of arr) s += a[1]; let r = rng() * s; for (const a of arr) { r -= a[1]; if (r <= 0) return a[0]; } return arr[arr.length - 1][0]; }
const pick = (rng, arr) => arr[Math.floor(rng() * arr.length) % arr.length];
function gaussR(rng) { return (rng() + rng() + rng() + rng() - 2) * 0.866; }

const SKIN = [['#f2cdb2', 3], ['#ecc0a2', 5], ['#e4b294', 5], ['#dba585', 4], ['#cf9a79', 3], ['#c08867', 2], ['#ab7755', 1.1], ['#8f5f42', 0.6], ['#6d452f', 0.4], ['#4e3122', 0.25]];
const HAIRC = [['#b59a73', 0.6], ['#c7a466', 0.35], ['#8a6a4a', 1.2], ['#5e4330', 2], ['#3b2a1f', 2.2], ['#1d1714', 1], ['#7a3f24', 0.3], ['#9a4c28', 0.12]];
const EYES = [['#5a7ea3', 3], ['#7b8b99', 2], ['#6a7848', 1.5], ['#7a5d38', 2], ['#4a2f1c', 2.5], ['#2a1b12', 1]];
const TEE = ['#e8e6e1', '#1e1e20', '#8a8b8d', '#2a3350', '#9b2c2c', '#5e6342', '#c49a3a', '#8fb2d4', '#5c1f2a', '#2f4a36', '#d6d2c4', '#44474d'];
const TEE_F = ['#d99aa5', '#e8e6e1', '#b9c7d9', '#1e1e20', '#c4a4c9', '#e0c8a0', '#7a2f3a', '#6f8f7f'];
const HOOD = ['#7c7d80', '#202022', '#27304a', '#2f4436', '#5a2230', '#b3a58c', '#4a4c52'];
const JACKET = ['#18181a', '#2e2f33', '#232a3d', '#4b4e36', '#8e704a', '#4a3222', '#4a6384', '#6d2626', '#39424a'];
const SHIRT = ['#eceae4', '#a9c2de', '#e6c3c6', '#5d7494', '#6a6f4e', '#f0ede4', '#c9cfd6'];
const JEANS = ['#27344f', '#34466a', '#4d6690', '#6f8bb0', '#1e1f24', '#55585e'];
const CHINO = ['#b9a582', '#8c7c5c', '#2c3346', '#565a42', '#6d6e70', '#3f3a34'];
const SKIRTC = ['#1f1f22', '#2a3350', '#7a2a33', '#6f6a5f', '#a88f6b', '#3e4f3a', '#5a4a6a'];
const TRACK = ['#1a1a1c', '#23283a', '#5a5c60', '#2b3d2b', '#3a1e28'];
const LIPS = ['#b86f6a', '#a85f5c', '#c07a72'];

export function randomHumanOpts(rng = Math.random) {
  const sex = rng() < 0.5 ? 'm' : 'f';
  const age = rng();   // 0 young .. 1 old
  const height = clamp(sex === 'm' ? 1.795 + gaussR(rng) * 0.068 : 1.672 + gaussR(rng) * 0.062, sex === 'm' ? 1.63 : 1.58, sex === 'm' ? 1.95 : 1.82);
  const skin = pickW(rng, SKIN);
  let hairColor = pickW(rng, HAIRC);
  if (age > 0.72 && rng() < (age - 0.6) * 2.2) hairColor = rng() < 0.5 ? '#8f8b86' : '#bdb8b1';
  if (skin === '#6d452f' || skin === '#4e3122' || skin === '#8f5f42') hairColor = rng() < 0.8 ? '#1b1512' : '#2e221a';
  let style;
  if (sex === 'm') style = pickW(rng, [['short', 6], ['buzz', 2], ['bald', age > 0.6 ? 2.5 : 0.3], ['medium', 0.6]]);
  else style = pickW(rng, [['long', 4], ['ponytail', 3], ['medium', 2], ['bob', 1.5], ['short', 0.4]]);
  const topType = pickW(rng, sex === 'm' ? [['t-shirt', 4], ['hoodie', 2], ['jacket', 3], ['shirt', 2.5]] : [['t-shirt', 4], ['hoodie', 1.5], ['jacket', 3], ['shirt', 2]]);
  const top = { type: topType, color: '#888', color2: '#ddd', pattern: 'solid', sleeve: 'long', open: false, leather: false };
  if (topType === 't-shirt') { top.color = pick(rng, sex === 'f' && rng() < 0.5 ? TEE_F : TEE); top.sleeve = rng() < 0.15 ? 'long' : 'short'; if (rng() < 0.12) { top.pattern = 'stripes'; top.color2 = rng() < 0.5 ? '#e8e6e1' : '#1e1e20'; } else if (rng() < 0.25) top.pattern = 'heather'; }
  if (topType === 'hoodie') { top.color = pick(rng, HOOD); top.pattern = rng() < 0.4 ? 'heather' : 'solid'; }
  if (topType === 'jacket') { top.color = pick(rng, JACKET); top.open = rng() < 0.55; top.color2 = pick(rng, TEE); top.leather = (top.color === '#18181a' || top.color === '#4a3222') && rng() < 0.6; }
  if (topType === 'shirt') { top.color = pick(rng, SHIRT); top.sleeve = rng() < 0.3 ? 'rolled' : 'long'; if (rng() < 0.3) { top.pattern = 'plaid'; top.color = pick(rng, ['#8a2a2a', '#2c3e63', '#3d5a3a', '#6a6a6a']); top.color2 = pick(rng, ['#1d1d1d', '#e0ddd5', '#2a2a30']); } top.tucked = rng() < 0.35; }
  const botType = pickW(rng, sex === 'm' ? [['jeans', 6], ['chinos', 3], ['shorts', 1.2], ['tracksuit', 1]] : [['jeans', 5], ['chinos', 1.5], ['skirt', 3], ['shorts', 0.8], ['tracksuit', 0.6]]);
  const bottom = { type: botType, color: '#333' };
  if (botType === 'jeans') bottom.color = pick(rng, JEANS);
  if (botType === 'chinos') bottom.color = pick(rng, CHINO);
  if (botType === 'skirt') { bottom.color = pick(rng, SKIRTC); bottom.length = 0.55 + rng() * 0.45; bottom.tights = rng() < 0.45; bottom.tightsColor = rng() < 0.7 ? '#1a1718' : '#6a5a50'; }
  if (botType === 'shorts') bottom.color = pick(rng, CHINO.concat(JEANS.slice(1, 3)));
  if (botType === 'tracksuit') bottom.color = pick(rng, TRACK);
  const shoeType = botType === 'tracksuit' ? 'trainers' : pickW(rng, sex === 'm' ? [['trainers', 5], ['leather', 2], ['boots', 1.5]] : [['trainers', 4], ['flats', 2], ['boots', 2], ['leather', 0.8]]);
  const shoes = { type: shoeType, color: '#eee', sole: '#eee' };
  if (shoeType === 'trainers') { shoes.color = pick(rng, ['#e9e8e4', '#e9e8e4', '#1e1e20', '#8b8d90', '#2a3350', '#b0aaa0']); shoes.sole = shoes.color === '#1e1e20' && rng() < 0.5 ? '#222' : '#efeeea'; }
  if (shoeType === 'leather') { shoes.color = pick(rng, ['#161616', '#3f2616', '#5a3a22']); shoes.sole = '#1c1612'; }
  if (shoeType === 'boots') { shoes.color = pick(rng, ['#5a3b24', '#1a1a1a', '#7a5a3a']); shoes.sole = '#2a221c'; }
  if (shoeType === 'flats') { shoes.color = pick(rng, ['#1a1a1a', '#c2a88a', '#7a2a2a', '#d8d0c4']); shoes.sole = '#2a2420'; }
  const sock = pick(rng, ['#efeeea', '#1d1d1f', '#8a8b8d']);
  return {
    sex, height, age, build: clamp(0.25 + gaussR(rng) * 0.25 + age * 0.25 + (sex === 'm' ? 0.05 : 0), 0, 1),
    skin, eyes: pickW(rng, EYES), lips: pick(rng, LIPS),
    hair: { style, color: hairColor }, beard: sex === 'm' ? pickW(rng, [[0, 3], [0.3, 3], [0.55, 1.5], [0.9, 1]]) : 0,
    top, bottom, shoes, sock, seed: Math.floor(rng() * 1e9),
  };
}

export function createPlayer(rng = Math.random) {
  return createHuman({
    sex: 'm', height: 1.82, build: 0.3, skin: '#e2b08e', eyes: '#4a3522', lips: '#b06a62',
    hair: { style: 'short', color: '#2b1f18' }, beard: 0.38,
    top: { type: 'jacket', color: '#1b1c20', color2: '#8d8f93', pattern: 'solid', open: true, leather: false },
    bottom: { type: 'jeans', color: '#2a3752' },
    shoes: { type: 'trainers', color: '#e6e5e0', sole: '#f2f1ec' },
    sock: '#efeeea', seed: Math.floor(rng() * 1e9), player: true,
  });
}

// ---------------------------------------------------------------------------------------------------------------
// Pose + animation
// ---------------------------------------------------------------------------------------------------------------
class Pose {
  constructor() { this.r = new Float32Array(NB * 3); this.p = new Float32Array(3); }
  clear() { this.r.fill(0); this.p.fill(0); return this; }
  addScaled(o, w) { for (let i = 0; i < this.r.length; i++) this.r[i] += o.r[i] * w; for (let i = 0; i < 3; i++) this.p[i] += o.p[i] * w; }
  set(i, x, y, z) { this.r[i * 3] = x; this.r[i * 3 + 1] = y; this.r[i * 3 + 2] = z; }
}
const ST = { IDLE: 0, LOCO: 1, SIT: 2, JUMP: 3, FALL: 4, ENTER: 5 };
const NST = 6;

// Hermite through (s, value) knots with Catmull-Rom tangents, explicit end tangents
function spline(s, ks, vs, m0, m1) {
  const n = ks.length; let i = 0; while (i < n - 2 && s > ks[i + 1]) i++;
  const h = ks[i + 1] - ks[i], t = clamp((s - ks[i]) / h, 0, 1);
  const tg = (j) => j === 0 ? m0 : j === n - 1 ? m1 : (vs[j + 1] - vs[j - 1]) / (ks[j + 1] - ks[j - 1]);
  const t2 = t * t, t3 = t2 * t;
  return (2 * t3 - 3 * t2 + 1) * vs[i] + (t3 - 2 * t2 + t) * h * tg(i) + (-2 * t3 + 3 * t2) * vs[i + 1] + (t3 - t2) * h * tg(i + 1);
}

// 2-bone sagittal leg IK -> writes thigh/shin/foot/toe rotations
function solveLeg(o, R, s, hx, hy, hz, ax, ay, az, phi, toe, hp, hyaw, hroll) {
  const dx = ax - hx, dy = ay - hy, dz = az - hz;
  const vy = Math.hypot(dy, dx);
  const abd = Math.atan2(dx, -dy);
  let D = Math.hypot(dz, vy);
  const lt = R.lt, ls = R.ls;
  D = clamp(D, 0.3 * (lt + ls), (lt + ls) * 0.9995);
  const g = Math.atan2(dz, vy);
  const A = Math.acos(clamp((lt * lt + D * D - ls * ls) / (2 * lt * D), -1, 1));
  const Bq = Math.acos(clamp((ls * ls + D * D - lt * lt) / (2 * ls * D), -1, 1));
  const th = g + A, sh = g - Bq;
  const bi = legIdx(s);
  o.set(bi, -th - hp, -hyaw, abd - hroll);
  o.set(bi + 1, th - sh, 0, 0);
  o.set(bi + 2, sh - phi, 0, -abd);
  o.set(bi + 3, toe, 0, 0);
}

const _m = new THREE.Matrix4(), _m2 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _q3 = new THREE.Quaternion();
const _e = new THREE.Euler(), _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3(), _v4 = new THREE.Vector3();
const _s1 = new THREE.Vector3(1, 1, 1);

// ---------------------------------------------------------------------------------------------------------------
// Human
// ---------------------------------------------------------------------------------------------------------------
const KIND_TOP = { 't-shirt': 0, hoodie: 1, jacket: 2, shirt: 3, sweater: 4 };
const KIND_BOT = { jeans: 0, chinos: 1, skirt: 2, shorts: 3, tracksuit: 4 };
const KIND_SHOE = { trainers: 0, leather: 1, boots: 2, flats: 3 };
const PATTERN = { solid: 0, stripes: 1, plaid: 2, heather: 3 };

function mulberry(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

export function createHuman(opts) {
  if (!opts) opts = randomHumanOpts(Math.random);
  const seed = opts.seed ?? Math.floor(Math.random() * 1e9);
  const def = randomHumanOpts(mulberry(seed));
  const o = { ...def, ...opts, hair: { ...def.hair, ...(opts.hair || {}) }, top: { ...def.top, ...(opts.top || {}) }, bottom: { ...def.bottom, ...(opts.bottom || {}) }, shoes: { ...def.shoes, ...(opts.shoes || {}) } };
  if (opts.sex && !opts.hair && opts.sex !== def.sex) o.hair.style = opts.sex === 'm' ? 'short' : 'long';
  if (o.sex !== 'f' && o.bottom.type === 'skirt') o.bottom.type = 'jeans';
  const A = sexAssets(o.sex === 'f' ? 'f' : 'm');
  const P = A.P, R = A.rig, J = P.J, k = P.k;
  const scale = (o.height || P.H) / P.H;

  // ---- uniforms (per instance) ----
  const C = (h) => new THREE.Color(h);
  const topK = KIND_TOP[o.top.type] ?? 0, botK = KIND_BOT[o.bottom.type] ?? 0, shoeK = KIND_SHOE[o.shoes.type] ?? 0;
  let hemT = [0.195, 0.175, 0.165, 0.2, 0.19][topK];
  if (topK === 3 && o.top.tucked) hemT = 0.31;
  const sleeve = o.top.sleeve === 'short' ? 0.25 : o.top.sleeve === 'rolled' ? 0.66 : 1.02;
  const waistT = 0.30;
  const legEnd = botK === 3 ? 0.40 : botK === 2 ? -1 : 2.0;
  const sockT = botK === 3 || botK === 2 ? (o.sockLow ? 0.99 : 0.9) : 5;
  const skirtLen = o.bottom.length ?? 1;
  const U = {
    uSkin: { value: C(o.skin) }, uTop: { value: C(o.top.color) }, uTop2: { value: C(o.top.color2 || '#ddd') },
    uBot: { value: C(o.bottom.color) }, uShoe: { value: C(o.shoes.color) }, uSole: { value: C(o.shoes.sole || '#eee') },
    uHair: { value: C(o.hair.color) }, uEye: { value: C(o.eyes || '#5a4030') }, uLip: { value: C(o.lips || '#b0706a') },
    uSock: { value: C(o.bottom.tights ? (o.bottom.tightsColor || '#1a1718') : (o.sock || '#eeeeea')) },
    uTopA: { value: new THREE.Vector4(hemT, sleeve, PATTERN[o.top.pattern] || 0, topK) },
    uBotA: { value: new THREE.Vector4(waistT, legEnd, sockT, botK) },
    uMisc: { value: new THREE.Vector4(shoeK, o.build ?? 0.3, o.beard || 0, o.hair.style === 'buzz' ? 1 : o.hair.style === 'bald' ? 0 : 0.6) },
    uMisc2: { value: new THREE.Vector4(0, o.top.open ? 1 : 0, o.bottom.tights ? 1 : 0, o.top.leather ? 2 : 0) },
    uFace: { value: faceTexture(P) },
    uSwing: { value: new THREE.Vector3() },
  };
  if (!U.uFace.value) U.uFace.value = null;

  // ---- skeleton (per instance) ----
  const bones = [];
  for (let i = 0; i < NB; i++) {
    const b = new THREE.Bone(); b.name = HUMAN_BONES[i];
    b.position.fromArray(A.local[i]);
    bones.push(b);
    if (PARENT[i] >= 0) bones[PARENT[i]].add(b);
  }
  const skeleton = new THREE.Skeleton(bones, A.inverses);
  const ident = new THREE.Matrix4();
  const bsphere = new THREE.Sphere(new THREE.Vector3(0, 0.85 * k, -0.15), 1.45 * k);

  const group = new THREE.Group();
  group.name = 'human';
  group.scale.setScalar(scale);
  const mat = bodyMaterial(U);
  const mesh = new THREE.SkinnedMesh(A.geo, mat);
  mesh.name = 'body';
  mesh.add(bones[0]);
  mesh.bind(skeleton, ident);
  mesh.castShadow = true; mesh.receiveShadow = true;
  mesh.boundingSphere = bsphere;
  group.add(mesh);
  const extra = [];
  if (botK === 2) {
    const sg = skirtGeo(A);
    U.uMisc2.value.x = (1 - clamp(skirtLen, 0.3, 1)) * sg.userData.span;
    const sm = new THREE.SkinnedMesh(sg, bodyMaterial(U, THREE.DoubleSide));
    sm.bind(skeleton, ident); sm.castShadow = true; sm.receiveShadow = true; sm.boundingSphere = bsphere; sm.name = 'skirt';
    group.add(sm); extra.push(sm);
  }
  const hg = hairGeo(A, o.hair.style);
  if (hg) {
    const hm = new THREE.SkinnedMesh(hg, hairMaterial(U));
    hm.bind(skeleton, ident); hm.castShadow = true; hm.receiveShadow = true; hm.boundingSphere = bsphere; hm.name = 'hair';
    group.add(hm); extra.push(hm);
  }

  // ---- animation state ----
  const rnd = mulberry(seed ^ 0x9e3779b9);
  const st = {
    w: new Float32Array(NST), ph: rnd(), run: 0, t: rnd() * 100, lastMode: 'auto', enterT: 0,
    look: 0, lookT: 0, lookTimer: 0, speedS: 0,
    idleFoot: [0.095 + rnd() * 0.03, (rnd() - 0.5) * 0.08], swing: new THREE.Vector3(), swingV: new THREE.Vector3(), prevHip: new THREE.Vector3(),
    armIn: (o.sex === 'f' ? 0 : 1),
  };
  st.w[ST.IDLE] = 1;
  const poses = []; for (let i = 0; i < NST; i++) poses.push(new Pose());
  const out = new Pose();
  const fs = { z: 0, y: 0, phi: 0, toe: 0, stance: false };

  // sit configuration (metres, group-local)
  const sit = {
    seat: new THREE.Vector3(0, 0.30, -0.70),        // hip joint (H-point)
    wheel: new THREE.Vector3(0, 0.67, -0.30),       // steering wheel centre
    wheelRadius: 0.185, wheelTilt: 25 * DEG,
    pedalZ: 0.05, pedalY: 0.10,
  };

  // ---------------- pose functions (all in base units of the body) ----------------
  function footState(q, L, beta, zH0, phiHS, phiTO, run, vn, out) {
    if (q < beta) {
      const s = q / beta, heelZ = zH0 - q * L;
      const sa = lerp(0.14, 0.1, run), sb = lerp(0.5, 0.45, run);
      let phi;
      if (s < sa) phi = phiHS * (1 - smooth(0, sa, s));
      else if (s < sb) phi = 0;
      else { const u = (s - sb) / (1 - sb); phi = -phiTO * Math.pow(u, 1.6); }
      const c = Math.cos(phi), sn = Math.sin(phi);
      if (phi >= 0) { out.z = heelZ + R.hv[0] * c - R.hv[1] * sn; out.y = R.hv[0] * sn + R.hv[1] * c; }
      else { const bz = heelZ + R.fb; out.z = bz + R.bv[0] * c - R.bv[1] * sn; out.y = R.bv[0] * sn + R.bv[1] * c; }
      out.phi = phi; out.toe = phi < 0 ? phi : 0; out.stance = true;
      return out;
    }
    const s = (q - beta) / (1 - beta);
    footState(beta - 1e-6, L, beta, zH0, phiHS, phiTO, run, vn, out);
    const z0 = out.z, y0 = out.y, toe0 = out.toe;
    footState(0, L, beta, zH0, phiHS, phiTO, run, vn, out);
    const z1 = out.z, y1 = out.y;
    const vr = clamp((vn - 3) / 3, 0, 1);
    const ks = [0, lerp(0.22, 0.25, run), lerp(0.5, 0.52, run), lerp(0.8, 0.8, run), 1];
    const zs = [z0, lerp(z0 + (z1 - z0) * 0.10, z0 * 0.55, run), lerp(z0 + (z1 - z0) * 0.55, -0.02 * k + 0.05 * L * run, run), lerp(z1 + 0.02 * k, z1 + 0.10 * k, run), z1];
    const ys = [y0, lerp(y0 + 0.075 * k, (0.30 + 0.12 * vr) * k, run), lerp(R.ankleH + 0.06 * k, (0.40 + 0.12 * vr) * k, run), lerp(y1 + 0.03 * k, y1 + 0.13 * k, run), y1];
    const vz = -L * (1 - beta);
    out.z = spline(s, ks, zs, vz, vz);
    out.y = spline(s, ks, ys, (ys[1] - y0) / ks[1] * 0.8, lerp(0, -0.3 * k, run));
    out.phi = lerp(-phiTO, phiHS, smooth(0.0, 0.75, s));
    out.toe = lerp(toe0, 0, smooth(0, 0.3, s));
    out.stance = false;
    return out;
  }

  function hipJoint(s, px, py, pz, pitch, yaw, roll, outv) {
    const x = s * R.hjx, y = R.hjy;
    outv.x = px + x * Math.cos(yaw) * Math.cos(roll);
    outv.y = py + y * Math.cos(pitch) + x * Math.sin(roll);
    outv.z = pz - x * Math.sin(yaw) + y * Math.sin(pitch);
    return outv;
  }

  function spineAndHead(p, pitchH, pitchS, pitchC, yawH, yawC, roll, headYaw, headPitch) {
    p.set(I_HIPS, pitchH, yawH, roll);
    p.set(I_SPINE, pitchS, (yawC - yawH) * 0.5, -roll * 0.55);
    p.set(I_CHEST, pitchC, (yawC - yawH) * 0.5, -roll * 0.3);
    const tot = pitchH + pitchS + pitchC;
    p.set(I_NECK, -tot * 0.45 + headPitch * 0.4, (headYaw - yawC) * 0.4, -roll * 0.1);
    p.set(I_HEAD, -tot * 0.55 + headPitch * 0.6, (headYaw - yawC) * 0.6, -roll * 0.05);
  }

  function armFK(p, s, F, E, abd, twist, handX, shElev, shFwd) {
    const ai = armIdx(s);
    p.set(ai, 0, -s * shFwd, s * shElev);
    p.set(ai + 1, -F, s * twist, s * abd);
    p.set(ai + 2, -E, 0, 0);
    p.set(ai + 3, handX, 0, -s * 6 * DEG);
  }

  function poseIdle(p, t) {
    p.clear();
    const sway = 0.017 * k * Math.sin(t * 0.55 + seed % 7) + 0.005 * k * Math.sin(t * 1.3 + 1);
    const breath = Math.sin(t * TAU / 4.2);
    const roll = sway / (0.1 * k) * 0.035;
    const px = sway, py = R.hipsY - 0.009 * k - Math.abs(sway) * 0.15, pz = 0.004 * k;
    p.p[0] = px; p.p[1] = py - R.hipsY; p.p[2] = pz;
    const pitch = 0.02;
    spineAndHead(p, pitch, 0.01, -0.012 * breath - 0.01, 0, 0, roll, st.look, 0.02 * Math.sin(t * 0.37));
    const hj = _v;
    for (const s of [1, -1]) {
      hipJoint(s, px, py, pz, pitch, 0, roll, hj);
      const fx = s * st.idleFoot[0] * k, fz = s * st.idleFoot[1] * k;
      solveLeg(p, R, s, hj.x, hj.y, hj.z, fx, R.ankleH, fz, 0, 0, pitch, 0, roll);
    }
    for (const s of [1, -1]) armFK(p, s, (3 + 1.2 * breath) * DEG, (11 + 2 * Math.sin(t * 0.4 + s)) * DEG, (-2.5 * st.armIn + 0.5) * DEG, 0, 0.05, 0.01 * breath, 0);
  }

  function poseLoco(p, ph, v, run, turn, t) {
    p.clear();
    const vn = Math.abs(v) / k;
    const f = st.f;
    const L = Math.max(Math.abs(v), 0.05) / f;
    const beta = lerp(clamp(0.62 - 0.05 * (vn - 1.4), 0.56, 0.7), clamp(0.40 - 0.025 * vn, 0.26, 0.38), run);
    const phiHS = lerp(16, 7, run) * DEG, phiTO = lerp(50, 40, run) * DEG;
    const cOff = lerp(-0.055, -0.02, run) * L;
    const zH0 = cOff + beta * L * 0.5 + R.heelOff;
    const qmid = clamp((zH0 - R.heelOff) / L, 0, 0.5);
    const Ls = L / (1.38 * k);
    // pelvis
    const cw = Math.cos(4 * PI * (ph - qmid));
    const yWalk = R.hipsY - k * (0.010 + 0.016 * Ls * Ls) + k * 0.017 * Math.min(Ls, 1.3) * cw;
    const yRun = R.hipsY - k * (0.035 + 0.006 * vn) - k * 0.026 * cw;
    let py = lerp(yWalk, yRun, run);
    const c1 = Math.cos(TAU * (ph - qmid));
    const px = lerp(0.022, 0.010, run) * k * c1 * Math.min(1, Ls * 1.5);
    const pz = 0;
    const roll = lerp(3.0, 3.5, run) * DEG * c1 * Math.min(1, Ls * 1.5);
    const yawA = lerp(4 + 2 * Ls, 8 + vn, run) * DEG * Math.min(1, Ls * 2);
    const yawH = -yawA * Math.cos(TAU * ph);
    const yawC = lerp(0.9, 1.3, run) * yawA * Math.cos(TAU * ph);
    const lean = lerp(2.5 + 1.5 * vn, 8 + 1.5 * vn, run) * DEG;
    const pitchH = lean * 0.45 + lerp(0.01, 0.025, run) * Math.cos(4 * PI * (ph - qmid));
    // feet
    const feet = [];
    for (const s of [1, -1]) {
      const q = ((ph + (s > 0 ? 0 : 0.5)) % 1 + 1) % 1;
      footState(q, L, beta, zH0, phiHS, phiTO, run, vn, fs);
      feet.push({ s, z: fs.z, y: fs.y, phi: fs.phi, toe: fs.toe, stance: fs.stance });
    }
    // keep reachable: lower pelvis if needed
    const hj = _v;
    for (const F of feet) {
      if (!F.stance) continue;
      hipJoint(F.s, px, py, pz, pitchH, yawH, roll, hj);
      const dz = F.z - hj.z, Lm = (R.lt + R.ls) * 0.995;
      if (Math.abs(dz) < Lm) { const ymax = F.y + Math.sqrt(Lm * Lm - dz * dz); if (hj.y > ymax) py -= hj.y - ymax; }
    }
    p.p[0] = px; p.p[1] = py - R.hipsY; p.p[2] = pz;
    const headYaw = turn * 0.25;
    spineAndHead(p, pitchH, lean * 0.3, lean * 0.2 - 0.01, yawH, yawC, roll, headYaw, lerp(0.03, 0.06, run));
    const footX = lerp(0.8, 0.6, run) * R.hjx;
    for (const F of feet) {
      hipJoint(F.s, px, py, pz, pitchH, yawH, roll, hj);
      solveLeg(p, R, F.s, hj.x, hj.y, hj.z, F.s * footX, F.y, F.z, F.phi, F.toe, pitchH, yawH, roll);
    }
    // arms
    const aAmp = lerp(clamp(8 + 12 * (vn - 0.9), 3, 28), 28 + 4 * vn, run) * DEG * Math.min(1, Ls * 2);
    const ap = TAU * (ph - lerp(0.04, 0.0, run));
    for (const s of [1, -1]) {
      const sw = -s * Math.cos(ap);   // + = forward
      const F = aAmp * sw + lerp(2, 10, run) * DEG;
      const E = lerp(12 + 14 * Math.max(0, sw) * Math.min(1, Ls), 80 + 18 * Math.max(0, sw) - 6 * Math.max(0, -sw), run) * DEG;
      const abd = lerp(-1.5 * st.armIn + 1, 9, run) * DEG;
      armFK(p, s, F, E, abd, -12 * DEG * run, lerp(0.08, 0.15, run), 0, sw * 0.05);
    }
  }

  const _S = new THREE.Vector3(), _T = new THREE.Vector3(), _E = new THREE.Vector3(), _P = new THREE.Vector3();
  const wm = []; for (let i = 0; i < NB; i++) wm.push(new THREE.Matrix4());
  function fk(p, upto) {
    for (let i = 0; i <= upto; i++) {
      const l = A.local[i];
      _v.set(l[0], l[1], l[2]); if (i === I_HIPS) _v.x += p.p[0], _v.y += p.p[1], _v.z += p.p[2];
      _q.setFromEuler(_e.set(p.r[i * 3], p.r[i * 3 + 1], p.r[i * 3 + 2]));
      _m.compose(_v, _q, _s1);
      if (PARENT[i] < 0) wm[i].copy(_m); else wm[i].multiplyMatrices(wm[PARENT[i]], _m);
    }
  }
  function armIK(p, s, target, pole, handDir, palmDir) {
    const ai = armIdx(s);
    fk(p, ai + 1);
    _S.setFromMatrixPosition(wm[ai + 1]);
    const l1 = Math.hypot(...A.local[ai + 2]), l2 = Math.hypot(...A.local[ai + 3]);
    _T.copy(target).sub(_S);
    let D = _T.length(); const dn = _T.clone().normalize();
    D = clamp(D, Math.abs(l1 - l2) + 0.02, (l1 + l2) * 0.999);
    const a = (l1 * l1 - l2 * l2 + D * D) / (2 * D), h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
    const pn = pole.clone().addScaledVector(dn, -pole.dot(dn)).normalize();
    _E.copy(_S).addScaledVector(dn, a).addScaledVector(pn, h);
    const W = _S.clone().addScaledVector(dn, D);
    const r1 = new THREE.Vector3().fromArray(A.local[ai + 2]).normalize();
    const r2 = new THREE.Vector3().fromArray(A.local[ai + 3]).normalize();
    const u1 = _E.clone().sub(_S).normalize(), u2 = W.clone().sub(_E).normalize();
    const parentQ = new THREE.Quaternion().setFromRotationMatrix(_m2.extractRotation(wm[ai]));
    const q1 = new THREE.Quaternion().setFromUnitVectors(r1, u1);
    const q2 = new THREE.Quaternion().setFromUnitVectors(r2.clone().applyQuaternion(q1), u2).multiply(q1);
    const l1q = parentQ.clone().invert().multiply(q1);
    const l2q = q1.clone().invert().multiply(q2);
    // hand: fingers along handDir, palm facing palmDir
    const ra = new THREE.Vector3(0, -1, 0), rb = new THREE.Vector3(-s, 0, 0);
    const da = handDir.clone().normalize(), db = palmDir.clone().addScaledVector(da, -palmDir.dot(da)).normalize();
    const mr = new THREE.Matrix4().makeBasis(ra, rb, ra.clone().cross(rb));
    const md = new THREE.Matrix4().makeBasis(da, db, da.clone().cross(db));
    const qh = new THREE.Quaternion().setFromRotationMatrix(md.multiply(mr.transpose()));
    const l3q = q2.clone().invert().multiply(qh);
    _e.setFromQuaternion(l1q); p.set(ai + 1, _e.x, _e.y, _e.z);
    _e.setFromQuaternion(l2q); p.set(ai + 2, _e.x, _e.y, _e.z);
    _e.setFromQuaternion(l3q); p.set(ai + 3, _e.x, _e.y, _e.z);
  }

  function poseSit(p, t, turn) {
    p.clear();
    const inv = 1 / scale;
    const seat = _P.copy(sit.seat).multiplyScalar(inv);
    const pitchH = -13 * DEG;
    // hips bone from H-point
    const hx = seat.x, hy = seat.y - R.hjy * Math.cos(pitchH), hz = seat.z - R.hjy * Math.sin(pitchH);
    p.p[0] = hx; p.p[1] = hy - R.hipsY; p.p[2] = hz;
    const breath = Math.sin(t * TAU / 4.5);
    spineAndHead(p, pitchH, -5 * DEG, -3 * DEG - 0.01 * breath, 0, 0, 0, turn * 0.18, 0.02);
    const hj = _v2;
    for (const s of [1, -1]) {
      hipJoint(s, hx, hy, hz, pitchH, 0, 0, hj);
      const fx = s * (s > 0 ? 0.13 : 0.10) * k;
      solveLeg(p, R, s, hj.x, hj.y, hj.z, fx, sit.pedalY * inv, sit.pedalZ * inv - (s > 0 ? 0.06 : 0) * k, 22 * DEG, 0, pitchH, 0, 0);
    }
    // wheel & hands
    const C = _v3.copy(sit.wheel).multiplyScalar(inv);
    const n = new THREE.Vector3(0, Math.sin(sit.wheelTilt), -Math.cos(sit.wheelTilt));   // towards driver
    const X = new THREE.Vector3(1, 0, 0), Uv = new THREE.Vector3().crossVectors(n, X).normalize();
    if (Uv.y < 0) Uv.negate();
    const om = clamp(turn, -1, 1) * 1.05;
    const rad = sit.wheelRadius * inv;
    for (const s of [1, -1]) {
      const th = (s > 0 ? 18 * DEG : PI - 18 * DEG) - om;
      const grip = C.clone().addScaledVector(X, Math.cos(th) * rad).addScaledVector(Uv, Math.sin(th) * rad);
      const tang = X.clone().multiplyScalar(-Math.sin(th)).addScaledVector(Uv, Math.cos(th));   // rim tangent (ccw)
      const wrist = grip.clone().addScaledVector(n, 0.035 * k).addScaledVector(Uv, -0.02 * k).addScaledVector(X, s * 0.02 * k);
      const pole = new THREE.Vector3(s * 0.7, -1, -0.2);
      const handDir = grip.clone().sub(wrist).addScaledVector(tang, s * 0.04 * k).addScaledVector(n, -0.03 * k);
      const palm = C.clone().sub(grip);
      armIK(p, s, wrist, pole, handDir, palm);
      const ai = armIdx(s);
      p.r[ai * 3 + 1] = -s * 0.1;   // shoulders slightly forward
    }
  }

  function poseJump(p, t) {
    p.clear();
    p.p[1] = -0.02 * k;
    spineAndHead(p, 6 * DEG, 4 * DEG, 0, 0, 0, 0, st.look * 0.3, 0.05);
    const li = legIdx(1), ri = legIdx(-1);
    p.set(li, -55 * DEG, 0, 3 * DEG); p.set(li + 1, 75 * DEG, 0, 0); p.set(li + 2, 15 * DEG, 0, 0);
    p.set(ri, 12 * DEG, 0, -3 * DEG); p.set(ri + 1, 55 * DEG, 0, 0); p.set(ri + 2, 25 * DEG, 0, 0);
    armFK(p, 1, -25 * DEG, 45 * DEG, 18 * DEG, 0, 0.1, 0.05, 0);
    armFK(p, -1, 55 * DEG, 50 * DEG, 18 * DEG, 0, 0.1, 0.05, 0.05);
  }
  function poseFall(p, t) {
    p.clear();
    const w = Math.sin(t * 7), w2 = Math.sin(t * 5.3 + 1);
    spineAndHead(p, -4 * DEG, -3 * DEG, 0, 0, 0, 0.03 * w, 0, -0.05);
    const li = legIdx(1), ri = legIdx(-1);
    p.set(li, (-22 + 10 * w) * DEG, 0, 6 * DEG); p.set(li + 1, (35 - 10 * w) * DEG, 0, 0); p.set(li + 2, 20 * DEG, 0, 0);
    p.set(ri, (-12 - 10 * w) * DEG, 0, -6 * DEG); p.set(ri + 1, (40 + 8 * w) * DEG, 0, 0); p.set(ri + 2, 20 * DEG, 0, 0);
    armFK(p, 1, (35 + 15 * w2) * DEG, 35 * DEG, (65 + 12 * w) * DEG, 0, 0.1, 0.12, 0);
    armFK(p, -1, (35 - 15 * w2) * DEG, 35 * DEG, (65 - 12 * w) * DEG, 0, 0.1, 0.12, 0);
  }
  function poseEnter(p, tau) {
    p.clear();
    const f = smooth(0, 0.45, tau), g = smooth(0.25, 0.8, tau);
    const px = 0.03 * k * f, py = R.hipsY - 0.17 * k * f, pz = -0.05 * k * f;
    p.p[0] = px; p.p[1] = py - R.hipsY; p.p[2] = pz;
    const pitchH = 22 * DEG * f, yaw = 18 * DEG * f;
    spineAndHead(p, pitchH, 12 * DEG * f, 6 * DEG * f, yaw, yaw * 1.3, -4 * DEG * f, yaw * 1.5, 0.1 * f);
    const hj = _v;
    hipJoint(-1, px, py, pz, pitchH, yaw, -4 * DEG * f, hj);
    solveLeg(p, R, -1, hj.x, hj.y, hj.z, -0.11 * k, R.ankleH, -0.03 * k, 0, 0, pitchH, yaw, -4 * DEG * f);
    hipJoint(1, px, py, pz, pitchH, yaw, -4 * DEG * f, hj);
    solveLeg(p, R, 1, hj.x, hj.y, hj.z, 0.22 * k * g + 0.1 * k, R.ankleH + 0.22 * k * g * (1 - g * 0.6), 0.12 * k * g, 10 * DEG * g, 0, pitchH, yaw, -4 * DEG * f);
    armFK(p, 1, 75 * DEG * f, 35 * DEG * f + 10 * DEG, 30 * DEG * f, 0, 0.1, 0.1 * f, 0);
    armFK(p, -1, 40 * DEG * f, 50 * DEG * f + 10 * DEG, 5 * DEG, 0, 0.1, 0, 0);
  }

  // ---------------- update ----------------
  const tgtW = new Float32Array(NST);
  st.f = 1;
  function update(dt, params = {}) {
    dt = clamp(dt || 0, 0, 0.1);
    const speed = params.speed || 0, mode = params.mode || 'auto', turn = clamp(params.turn || 0, -1, 1);
    st.t += dt;
    if (mode !== st.lastMode) { if (mode === 'enter') st.enterT = 0; st.lastMode = mode; }
    const sp = Math.abs(speed);
    tgtW.fill(0);
    let v = sp, runT = st.run;
    switch (mode) {
      case 'idle': tgtW[ST.IDLE] = 1; break;
      case 'walk': tgtW[ST.LOCO] = 1; runT = 0; if (v < 0.2) v = 1.35 * scale; break;
      case 'run': tgtW[ST.LOCO] = 1; runT = 1; if (v < 2.0) v = 4.2 * scale; break;
      case 'sit': tgtW[ST.SIT] = 1; break;
      case 'jump': tgtW[ST.JUMP] = 1; break;
      case 'fall': tgtW[ST.FALL] = 1; break;
      case 'enter': tgtW[ST.ENTER] = 1; break;
      default:
        if (sp > 0.12) { tgtW[ST.LOCO] = 1; runT = smooth(2.3, 3.4, sp / scale * k); } else tgtW[ST.IDLE] = 1;
    }
    const kb = 1 - Math.exp(-dt * (mode === 'jump' || mode === 'fall' ? 12 : 9));
    for (let i = 0; i < NST; i++) st.w[i] += (tgtW[i] - st.w[i]) * kb;
    st.run += (runT - st.run) * (1 - Math.exp(-dt * 5));
    st.speedS += (v - st.speedS) * (1 - Math.exp(-dt * 10));
    const vb = (mode === 'walk' || mode === 'run') ? v / scale : st.speedS / scale;
    const vn = vb / k;
    const fW = clamp(0.52 + 0.34 * vn, 0.55, 1.3), fR = 1.28 + 0.06 * vn;
    st.f = lerp(fW, fR, st.run);
    st.ph = (st.ph + dt * st.f * (speed < 0 ? -1 : 1) + 1) % 1;
    if (mode === 'enter') st.enterT = Math.min(1, st.enterT + dt / 0.85);
    // idle look-around
    st.lookTimer -= dt;
    if (st.lookTimer <= 0) { st.lookTimer = 2 + rnd() * 4; st.lookT = rnd() < 0.4 ? (rnd() - 0.5) * 1.0 : 0; }
    st.look += (st.lookT - st.look) * (1 - Math.exp(-dt * 2.5));

    out.clear();
    let wsum = 0;
    for (let i = 0; i < NST; i++) {
      const w = st.w[i]; if (w < 0.002) continue;
      const p = poses[i];
      if (i === ST.IDLE) poseIdle(p, st.t);
      else if (i === ST.LOCO) poseLoco(p, st.ph, Math.max(vb, 0.05), st.run, turn, st.t);
      else if (i === ST.SIT) poseSit(p, st.t, turn);
      else if (i === ST.JUMP) poseJump(p, st.t);
      else if (i === ST.FALL) poseFall(p, st.t);
      else if (i === ST.ENTER) poseEnter(p, st.enterT);
      out.addScaled(p, w); wsum += w;
    }
    if (wsum > 0) { const iw = 1 / wsum; for (let i = 0; i < out.r.length; i++) out.r[i] *= iw; for (let i = 0; i < 3; i++) out.p[i] *= iw; }
    // lean into turns (about the feet)
    const lean = (1 - st.w[ST.SIT] - st.w[ST.ENTER]) * clamp(0.018 * vb * vb, 0, 0.24) * turn;
    out.r[2] = -lean;
    // apply
    for (let i = 0; i < NB; i++) bones[i].quaternion.setFromEuler(_e.set(out.r[i * 3], out.r[i * 3 + 1], out.r[i * 3 + 2]));
    const hb = A.local[I_HIPS];
    bones[I_HIPS].position.set(hb[0] + out.p[0], hb[1] + out.p[1], hb[2] + out.p[2]);
    // ponytail / hair swing: damped spring driven by pelvis motion and speed
    const sw = st.swing, sv = st.swingV;
    const hipNow = _v4.set(out.p[0], out.p[1], out.p[2]);
    const acc = hipNow.clone().sub(st.prevHip); st.prevHip.copy(hipNow);
    if (dt > 0) {
      const target = _v2.set(-acc.x / dt * 0.02 - lean * 0.05, 0, -0.015 * vb * (1 - st.w[ST.SIT]));
      sv.addScaledVector(target.sub(sw), dt * 60).multiplyScalar(Math.exp(-dt * 6));
      sw.addScaledVector(sv, dt);
      sw.x = clamp(sw.x, -0.05, 0.05); sw.z = clamp(sw.z, -0.08, 0.04);
      sw.y = -Math.abs(acc.y / dt) * 0.02;
    }
    U.uSwing.value.set(sw.x, sw.y + (-sw.z > 0 ? sw.z * 0.4 : 0), sw.z);
  }

  const human = {
    group, height: (o.height || P.H), opts: o, mesh, skeleton, bones: Object.fromEntries(bones.map(b => [b.name, b])),
    sit, update,
    get mode() { return st.lastMode; },
    get phase() { return st.ph; },
    dispose() {
      mat.dispose(); for (const m of extra) m.material.dispose();
      skeleton.dispose();
      group.removeFromParent();
    },
  };
  update(0, { mode: 'idle' });
  return human;
}

// Triangle count of the shared body geometry (for budgeting / tests)
export function humanStats(sex = 'm') {
  const A = sexAssets(sex);
  const hairTris = {}; for (const s of Object.keys(HAIR)) { const g = hairGeo(A, s); hairTris[s] = g ? g.index.count / 3 : 0; }
  return { bodyTris: A.geo.index.count / 3, bodyVerts: A.geo.attributes.position.count, skirtTris: skirtGeo(A).index.count / 3, hairTris, bones: NB };
}
