// Procedural sound system. Everything is synthesised with the Web Audio API (no audio files):
// engine (4-cyl petrol / diesel), tyres, horn, impacts, footsteps, doors, ambience, a generative
// radio and UI blips. Every public AUDIO method is a silent no-op before init() or after a failure
// and never throws. No ScriptProcessor/AudioWorklet: noise buffers are built once and reused.
//
// Graph:  [engine | sfx | ui | ambient(lowpass when inCar) | radio]  -> master gain -> mute gain
//         -> glue compressor -> limiter -> trim -> destination

const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const num = (v, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const rnd = (a = 0, b = 1) => a + Math.random() * (b - a);
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
function prng(seed) {
  let s = seed >>> 0 || 1;
  return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// ---------------------------------------------------------------------------------------------
// Engine models. rpm 0..1 maps idle..redline; firing frequency = rpm/60 * cyl/2.
// lp = lowpass cutoff [base, +rpm, +load]; eq = two fixed exhaust/cabin resonances [Hz, dB, Q].
const ENG = {
  car: { cyl: 4, idle: 800, red: 6500, lvl: 0.36, lp: [320, 2300, 1900], diesel: 0, eq: [[115, 4, 1.1], [520, 3, 1.4]], seed: 11 },
  van: { cyl: 4, idle: 720, red: 4300, lvl: 0.38, lp: [240, 1300, 1000], diesel: 1, eq: [[88, 5, 1.0], [390, 4, 1.3]], seed: 23 },
  bus: { cyl: 6, idle: 560, red: 2500, lvl: 0.42, lp: [200, 950, 800], diesel: 1.2, eq: [[72, 6, 0.9], [300, 4, 1.2]], seed: 37 },
};

// Generative radio stations (fictional). prog = [bass root, chord voicing] per bar (MIDI notes).
const STATIONS = [
  { name: 'Skalica FM', bpm: 84, beats: 4, div: 4, swing: 0.16, kit: 'lofi',
    prog: [[41, [57, 60, 64, 67]], [40, [55, 59, 62, 64]], [38, [53, 57, 60, 64]], [36, [52, 55, 59, 62]]],
    scale: [65, 67, 69, 72, 74, 77, 79, 81, 84] },
  { name: 'Rádio Záhorie', bpm: 132, beats: 3, div: 2, swing: 0.04, kit: 'folk',
    prog: [[43, [59, 62, 67]], [43, [59, 62, 67]], [38, [57, 62, 66]], [38, [57, 60, 66]], [43, [59, 62, 67]], [36, [60, 64, 67]], [38, [57, 60, 66]], [43, [59, 62, 67]]],
    scale: [62, 64, 66, 67, 69, 71, 72, 74, 76, 78, 79] },
  { name: 'Trdelník Jazz', bpm: 76, beats: 4, div: 2, swing: 0.3, kit: 'jazz',
    prog: [[36, [51, 55, 58, 62]], [41, [51, 55, 57, 62]], [34, [50, 53, 57, 60]], [43, [53, 56, 59, 62]]],
    scale: [65, 67, 69, 70, 72, 74, 75, 77, 79, 81, 82] },
];
const RADIO_VOL = 0.3;
const LIMIT = { step: 4, bird: 5, pop: 6, ui: 4, dog: 2, door: 3, crash: 3, start: 1 };
const MAX_VOICES = 40;

// ---------------------------------------------------------------------------------------------
let ctx = null, offline = false;
let N = null, NB = null, W = null;       // node graph, noise buffers, cached waves/curves
let vol = 0.8, isMuted = false;
let E = null, lastType = 'car', lastEngineOff = -10;
let SK = null, HN = null, AMB = null, R = null;
let voices = [], radioTimer = 0;
let crashT = -10, crashI = 0;
let station = -1, lastStation = 0;

// ---- tiny node helpers (all use the current ctx) -------------------------------------------
function G(v = 1, dst) { const g = ctx.createGain(); g.gain.value = v; if (dst) g.connect(dst); return g; }
function F(type, f, Q = 0.7, dst) { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = Q; if (dst) b.connect(dst); return b; }
function O(type, f, dst) { const o = ctx.createOscillator(); if (typeof type === 'string') o.type = type; else o.setPeriodicWave(type); o.frequency.value = f; if (dst) o.connect(dst); return o; }
function S(buf, rate = 1, dst) { const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; s.playbackRate.value = rate; if (dst) s.connect(dst); return s; }
function P(pan, dst) {
  if (!ctx.createStereoPanner) return G(1, dst);
  const p = ctx.createStereoPanner(); p.pan.value = clamp(pan, -1, 1); p.connect(dst); return p;
}
// percussive envelope: linear attack a, then exponential decay with time constant tc
function env(t, peak, a, tc, dst) {
  const g = ctx.createGain(), p = g.gain; p.value = 0;
  p.setValueAtTime(0, t); p.linearRampToValueAtTime(peak, t + a); p.setTargetAtTime(0, t + a, tc);
  g.connect(dst); return g;
}
// looped-noise one-shot with a random read offset
function burst(buf, t, dur, dst, rate = 1) { const s = S(buf, rate, dst); s.start(t, Math.random() * (buf.duration * 0.8)); s.stop(t + dur); return s; }
// gain node whose envelope is a cloud of short exponential grains (crunch, gravel, debris)
function grains(t, dur, count, peak, decay, dst, shape = 1) {
  const n = 256, cv = new Float32Array(n), dt = dur / n;
  for (let k = 0; k < count; k++) {
    const at = Math.pow(Math.random(), shape) * dur * 0.8, a = peak * rnd(0.3, 1), dk = decay * rnd(0.5, 1.5);
    for (let i = Math.ceil(at / dt); i < n; i++) { const v = a * Math.exp(-(i * dt - at) / dk); if (v < 1e-4) break; cv[i] += v; }
  }
  cv[n - 1] = 0;
  const g = ctx.createGain(); g.gain.value = 0; g.gain.setValueCurveAtTime(cv, t, dur); g.connect(dst); return g;
}
// smoothed parameter target; skips redundant updates so it can be called at 60 Hz
function to(p, v, tc = 0.05) {
  if (!(v === v)) return;
  const o = p._t;
  if (o !== undefined && Math.abs(v - o) <= 1e-4 * (Math.abs(v) > 1 ? Math.abs(v) : 1)) return;
  p._t = v; p.setTargetAtTime(v, ctx.currentTime, tc);
}
function hold(p, t) { if (p.cancelAndHoldAtTime) p.cancelAndHoldAtTime(t); else p.cancelScheduledValues(t); }
// scheduling horizon; offline renders schedule generative content up to the end of the buffer
function LA(d) { return offline ? Math.max(d, ctx.length / ctx.sampleRate - ctx.currentTime + 0.05) : d; }
// voice limiter: returns false when too many sounds of this tag (or overall) overlap time t
function claim(tag, t, dur) {
  const n = ctx.currentTime;
  if (voices.length > 24) voices = voices.filter((v) => v.e > n);
  let c = 0, all = 0;
  for (const v of voices) if (v.s <= t + 0.001 && v.e > t) { all++; if (v.tag === tag) c++; }
  if (c >= (LIMIT[tag] || 8) || (all >= MAX_VOICES && tag !== 'crash')) return false;
  voices.push({ s: t, e: t + dur, tag });
  return true;
}

function mkNoise(sec, kind) {
  const sr = ctx.sampleRate, n = Math.floor(sr * sec), M = Math.floor(sr * 0.05), x = new Float32Array(n + M);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, br = 0;
  for (let i = 0; i < n + M; i++) {
    const w = Math.random() * 2 - 1;
    if (kind === 'white') x[i] = w;
    else if (kind === 'pink') {
      b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852;
      b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
      x[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362; b6 = w * 0.115926;
    } else { br = (br + 0.02 * w) / 1.02; x[i] = br; }
  }
  for (let i = 0; i < M; i++) { const k = i / M; x[i] = x[i] * k + x[n + i] * (1 - k); }   // seamless loop
  let m = 0; for (let i = 0; i < n; i++) m += x[i]; m /= n;
  let s = 0; for (let i = 0; i < n; i++) { x[i] -= m; s += x[i] * x[i]; }
  const g = 0.35 / Math.sqrt(s / n || 1), buf = ctx.createBuffer(1, n, sr), d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = x[i] * g;
  return buf;
}
function curve(k) {
  const n = 1024, c = new Float32Array(n), d = Math.tanh(k);
  for (let i = 0; i < n; i++) c[i] = Math.tanh(k * (i / (n - 1) * 2 - 1)) / d;
  return c;
}
function pulseWave(n, tilt) {
  const re = new Float32Array(n + 1), im = new Float32Array(n + 1);
  for (let k = 1; k <= n; k++) re[k] = Math.pow(k, -tilt);
  return ctx.createPeriodicWave(re, im);
}
// Two wavetables on the camshaft fundamental (rpm/120): firing orders are harmonics k*cyl, the
// rest are weak, randomised half/whole crank orders (cylinder imbalance -> lumpy, non-pure tone).
function engWaves(type) {
  if (W.eng[type]) return W.eng[type];
  const c = ENG[type], r = prng(c.seed), H = 160;
  const mk = (slope, rough) => {
    const re = new Float32Array(H + 1), im = new Float32Array(H + 1);
    for (let h = 1; h <= H; h++) {
      const k = h / c.cyl; let a, ph;
      if (h % c.cyl === 0) { a = Math.pow(k, -slope) * (k === 2 ? 0.8 : 1); ph = r() * 0.6; }
      else { a = k < 1 ? rough * (0.4 + 0.6 * r()) : rough * (h % 2 ? 0.7 : 1.3) * Math.pow(k, -slope) * (0.35 + 0.65 * r()); ph = r() * TAU; }
      re[h] = a * Math.cos(ph); im[h] = a * Math.sin(ph);
    }
    return ctx.createPeriodicWave(re, im);
  };
  return (W.eng[type] = { smooth: mk(1.0, 0.07), rich: mk(0.6, 0.16) });
}

// ---- graph ----------------------------------------------------------------------------------
function build(c, off) {
  ctx = c; offline = off;
  try {
    NB = { white: mkNoise(3, 'white'), pink: mkNoise(4, 'pink'), brown: mkNoise(4, 'brown') };
    W = { grit: curve(2.5), soft: curve(1.6), pulse6: pulseWave(6, 0.3), pulse24: pulseWave(24, 0), eng: {} };
    for (const k in ENG) engWaves(k);          // build wavetables/buffers now (inside the init gesture), not mid-game
    W.crick = crickBuffer();
    const trim = G(0.84, ctx.destination);
    const lim = ctx.createDynamicsCompressor(); comp(lim, -3, 0, 20, 0.002, 0.1); lim.connect(trim);
    const glue = ctx.createDynamicsCompressor(); comp(glue, -14, 10, 2.5, 0.008, 0.25); glue.connect(lim);
    const muteG = G(isMuted ? 0 : 1, glue), master = G(vol, muteG);
    const ambG = G(1, master), ambLP = F('lowpass', 16000, 0, ambG), ambIn = G(1, ambLP);
    N = { master, muteG, glue, lim, trim, eng: G(1, master), sfx: G(1, master), ui: G(0.9, master), ambIn, ambLP, ambG };
    return true;
  } catch (e) { ctx = null; N = null; return false; }
}
function comp(c, th, knee, ratio, att, rel) {
  c.threshold.value = th; c.knee.value = knee; c.ratio.value = ratio; c.attack.value = att; c.release.value = rel;
}
function reset() {
  if (radioTimer) { clearInterval(radioTimer); radioTimer = 0; }
  if (ctx && !offline && ctx.close) { try { ctx.close().catch(() => {}); } catch (e) { /* ignore */ } }
  ctx = null; N = NB = W = null; E = SK = HN = AMB = R = null;
  voices = []; crashT = -10; crashI = 0; station = -1; lastStation = 0; lastEngineOff = -10;
}

// ---- engine ---------------------------------------------------------------------------------
function mkEngine(type) {
  const c = ENG[type], w = engWaves(type), t0 = ctx.currentTime + 0.01;
  const e = { type, c, oscs: [], srcs: [], pk: 0, lastT: t0, bStart: 0, bUntil: 0, nextPop: 0, bAmp: 0 };
  const osc = (wave, f, dst) => { const x = O(wave, f, dst); e.oscs.push(x); return x; };
  const src = (buf, rate, dst) => { const x = S(buf, rate, dst); e.srcs.push(x); return x; };
  e.out = G(0, N.eng);                                   // on/off fader
  e.body = G(0, e.out);                                  // load-dependent level
  e.eq2 = F('peaking', c.eq[1][0], c.eq[1][2], e.body); e.eq2.gain.value = c.eq[1][1];
  e.eq1 = F('peaking', c.eq[0][0], c.eq[0][2], e.eq2); e.eq1.gain.value = c.eq[0][1];
  e.lp = F('lowpass', 400, 0.8, e.eq1);                  // opens with rpm and load
  e.rough = G(1, e.lp);                                  // cycle-to-cycle amplitude jitter
  const hp = F('highpass', 34, -3, e.rough);
  // tonal core: smooth (light load) and rich/saturated (full load) wavetables, crossfaded by throttle
  e.gA = G(0.5, hp); e.oA = osc(w.smooth, 7, e.gA);
  e.post = G(1, hp); const sh = ctx.createWaveShaper(); sh.curve = W.grit; sh.oversample = '2x'; sh.connect(e.post);
  e.pre = G(0.35, sh); e.gB = G(0.1, e.pre); e.oB = osc(w.rich, 7, e.gB); e.oB.detune.value = 6;
  e.gS = G(0, hp); e.oS = osc('sawtooth', 27, e.gS); e.oS.detune.value = -9;   // detuned buzz under load
  // exhaust roughness: brown noise band-passed around the low firing harmonics, pulsed at the firing rate
  const brown = src(NB.brown, 1), white = src(NB.white, 1);
  e.exBP = F('bandpass', 120, 1.1); brown.connect(e.exBP);
  e.exAM = G(0.4); e.exBP.connect(e.exAM); e.gN = G(0, hp); e.exAM.connect(e.gN);
  e.amO = osc(W.pulse6, 27, G(0.6, e.exAM.gain));
  // intake / induction hiss (bypasses the exhaust lowpass)
  e.inBP = F('bandpass', 1200, 0.8); white.connect(e.inBP); e.gI = G(0, e.body); e.inBP.connect(e.gI);
  // diesel clatter: noise gated by sharp pulses at the firing rate
  e.clBP = F('bandpass', 2600, 1.3); white.connect(e.clBP); e.clAM = G(0); e.clBP.connect(e.clAM);
  e.gC = G(0, e.body); e.clAM.connect(e.gC); e.clO = osc(W.pulse24, 27, e.clAM.gain);
  e.gT = G(0, e.body); e.oT = osc('sine', 2000, e.gT);   // turbo whistle (diesels)
  // tyre / road roll noise with speed (not part of the engine jitter)
  e.rdLP = F('lowpass', 200, 0); brown.connect(e.rdLP); e.gR = G(0, e.out); e.rdLP.connect(e.gR);
  // jitter: slow pitch wander (cents) + fast amplitude roughness
  const jp = src(NB.brown, 0.02), jpg = G(14); jp.connect(jpg);
  for (const x of [e.oA, e.oB, e.oS, e.amO, e.clO]) jpg.connect(x.detune);
  const ja = src(NB.white, 0.0016), jag = G(0.12); ja.connect(jag); jag.connect(e.rough.gain);
  for (const x of e.oscs) x.start(t0);
  for (const x of e.srcs) x.start(t0, Math.random() * 2);
  // start-up: starter crank, then fade in with a small rev flare
  const fresh = ctx.currentTime - lastEngineOff > 1.2, tOn = t0 + (fresh ? 0.32 : 0.02);
  if (fresh) starter(t0, c);
  e.out.gain.setValueAtTime(0, t0); e.out.gain.setTargetAtTime(1, tOn, fresh ? 0.05 : 0.15);
  if (fresh) for (const x of [e.oA, e.oB, e.oS, e.amO, e.clO]) {
    const d = x.detune, b = d.value;
    d.setValueAtTime(b - 500, tOn); d.linearRampToValueAtTime(b + 450, tOn + 0.22); d.setTargetAtTime(b, tOn + 0.25, 0.3);
  }
  return e;
}
function setEngineType(e, type) {
  const c = ENG[type], w = engWaves(type);
  e.type = type; e.c = c; e.oA.setPeriodicWave(w.smooth); e.oB.setPeriodicWave(w.rich);
  to(e.eq1.frequency, c.eq[0][0], 0.1); to(e.eq2.frequency, c.eq[1][0], 0.1);
  e.eq1.gain.value = c.eq[0][1]; e.eq2.gain.value = c.eq[1][1];
}
function updEngine(e, rpm, thr, spd) {
  const c = e.c, n = ctx.currentTime;
  const rr = c.idle + (c.red - c.idle) * rpm, fire = rr / 60 * c.cyl / 2, cam = rr / 120;
  to(e.oA.frequency, cam, 0.035); to(e.oB.frequency, cam, 0.035);
  to(e.oS.frequency, fire, 0.035); to(e.amO.frequency, fire, 0.035); to(e.clO.frequency, fire, 0.035);
  to(e.exBP.frequency, clamp(fire * 2.5, 60, 2000), 0.05);
  const over = thr < 0.1 ? clamp((rpm - 0.25) * 1.5, 0, 1) : 0;   // closed-throttle overrun
  to(e.lp.frequency, c.lp[0] + c.lp[1] * Math.pow(rpm, 1.15) + c.lp[2] * thr * (0.35 + rpm), 0.06);
  to(e.lp.Q, 0.8 + thr * 1.4, 0.1);
  to(e.gA.gain, 0.55 * (1 - 0.6 * thr), 0.06);
  to(e.gB.gain, 0.1 + 0.55 * thr + 0.1 * rpm, 0.06);
  to(e.pre.gain, 0.35 * (1 + 3 * thr + 1.5 * rpm), 0.06);
  to(e.post.gain, 1 / (1 + 1.2 * thr), 0.06);
  to(e.gS.gain, 0.015 + 0.07 * thr * rpm, 0.06);
  to(e.gN.gain, (0.06 + 0.3 * thr + 0.18 * over) * (0.5 + rpm), 0.06);
  to(e.inBP.frequency, 800 + 2800 * rpm, 0.08);
  to(e.gI.gain, 0.006 + 0.07 * thr * rpm, 0.08);
  to(e.gC.gain, c.diesel * 0.12 * (1 - 0.55 * rpm) * (0.7 + 0.3 * thr), 0.08);
  to(e.oT.frequency, 1500 + 5500 * rpm, 0.3);
  to(e.gT.gain, c.diesel * 0.01 * thr * rpm, 0.4);
  to(e.body.gain, c.lvl * (0.45 + 0.35 * rpm + 0.35 * thr), 0.05);
  to(e.gR.gain, 0.12 * Math.pow(clamp(spd / 35, 0, 1), 1.3), 0.15);
  to(e.rdLP.frequency, 160 + 12 * clamp(spd, 0, 60), 0.2);
  // exhaust burble on lift-off (throttle snapped shut from high load at decent rpm)
  const dt = Math.max(0, n - e.lastT); e.lastT = n;
  e.pk = Math.max(thr, e.pk * Math.exp(-dt / 0.5));
  if (thr < 0.12 && e.pk > 0.55 && rpm > 0.3 && n >= e.bUntil) {
    e.bStart = n; e.bUntil = n + 0.45 + 0.9 * rpm; e.nextPop = n + rnd(0.02, 0.06); e.bAmp = c.diesel ? 0.35 : 1; e.pk = 0;
  }
  if (thr > 0.3 && e.bUntil > n) e.bUntil = n;
  const until = Math.min(e.bUntil, n + LA(0.12));
  while (e.nextPop < until) {
    const k = 1 - (e.nextPop - e.bStart) / (e.bUntil - e.bStart);
    pop(e.nextPop, 0.32 * e.bAmp * k * rnd(0.25, 1), c.diesel);
    e.nextPop += rnd(0.025, 0.12) * (c.diesel ? 1.6 : 1);
  }
}
function stopEngine() {
  const e = E; E = null; if (!e) return;
  const n = ctx.currentTime; lastEngineOff = n;
  hold(e.out.gain, n); e.out.gain.setTargetAtTime(0, n, 0.18);
  for (const x of [e.oA, e.oB, e.oS, e.amO, e.clO]) { hold(x.detune, n); x.detune.setTargetAtTime(-600, n, 0.35); }
  for (const x of e.oscs.concat(e.srcs)) x.stop(n + 1.6);
}
function pop(t, a, diesel) {
  if (a < 0.004 || !claim('pop', t, 0.1)) return;
  const g = env(t, a, 0.0015, rnd(0.006, 0.018), N.eng);
  burst(NB.white, t, 0.12, F('bandpass', rnd(300, diesel ? 600 : 1300), 0.9, g), rnd(0.5, 1.1));
  const g2 = env(t, a * 0.8, 0.002, 0.02, N.eng), o = O('sine', rnd(70, 130), g2);
  o.frequency.setTargetAtTime(45, t, 0.02); o.start(t); o.stop(t + 0.15);
}
function starter(t, c) {
  if (!claim('start', t, 0.45)) return;
  const d = 0.36, g = G(0, N.eng), p = g.gain;
  p.setValueAtTime(0, t); p.linearRampToValueAtTime(0.1, t + 0.03); p.setValueAtTime(0.1, t + d - 0.05); p.linearRampToValueAtTime(0, t + d);
  const am = G(0.55, g), lfo = O('sine', c.diesel ? 7 : 9.5, G(0.45, am.gain));
  const o = O('sawtooth', c.diesel ? 95 : 140, F('bandpass', c.diesel ? 500 : 750, 1.2, am));
  o.frequency.linearRampToValueAtTime(c.diesel ? 105 : 160, t + d);
  burst(NB.brown, t, d + 0.05, F('lowpass', 300, 0, am));
  for (const x of [lfo, o]) { x.start(t); x.stop(t + d + 0.05); }
}

// ---- tyres / horn ---------------------------------------------------------------------------
function mkSkid() {
  const out = G(0, N.sfx), s = S(NB.white, 1);
  const bp1 = F('bandpass', 1100, 9, G(3, out)), bp2 = F('bandpass', 2300, 6, G(1, out));
  s.connect(bp1); s.connect(bp2);
  const oBP = F('bandpass', 1100, 4, G(0.16, out)), o = O('sawtooth', 1100, oBP);
  // slight pitch modulation: periodic (tyre stick-slip) + random wobble
  const lfo = O('sine', 6.5), lg = G(45), wob = S(NB.brown, 0.03), wg = G(160);
  lfo.connect(lg); wob.connect(wg);
  for (const p of [bp1.frequency, o.frequency, oBP.frequency]) { lg.connect(p); wg.connect(p); }
  wg.connect(bp2.frequency);
  const t = ctx.currentTime;
  s.start(t, Math.random() * 2); o.start(t); lfo.start(t); wob.start(t, Math.random() * 3);
  return { out, bp1, bp2, o, oBP, lfo };
}
function mkHorn(ty) {
  const fs = ty === 'bus' ? [220, 277.2, 329.6] : ty === 'van' ? [370, 466] : [415, 523];
  const t = ctx.currentTime + 0.003, out = G(0, N.sfx), p = out.gain;
  p.setValueAtTime(0, t); p.linearRampToValueAtTime(0.13, t + 0.012);
  const pk = F('peaking', ty === 'bus' ? 900 : 1600, 1.5, F('lowpass', ty === 'bus' ? 2400 : 3400, 0, out)); pk.gain.value = 5;
  const sh = ctx.createWaveShaper(); sh.curve = W.soft; sh.connect(pk);
  const mix = G(0.9 / fs.length, sh);
  const oscs = fs.map((f) => { const o = O(ty === 'bus' ? 'sawtooth' : 'square', f, mix); o.detune.value = rnd(-6, 6); o.start(t); return o; });
  return { out, oscs };
}

// ---- impacts --------------------------------------------------------------------------------
function glass(t, k, d) {
  burst(NB.white, t, 0.3, F('highpass', 4000, 0, env(t, 0.2 * (0.4 + 0.6 * k), 0.001, 0.04, d)));
  burst(NB.white, t, 0.4, F('highpass', 5000, 0, grains(t, 0.35, Math.round(8 + 16 * k), 0.12, 0.006, d, 1.8)));
  const n = Math.round(5 + 14 * k);
  for (let j = 0; j < n; j++) {
    const tt = t + 0.02 + Math.pow(Math.random(), 1.6) * 0.75;
    const o = O('sine', rnd(2600, 8500), env(tt, rnd(0.008, 0.035), 0.001, rnd(0.01, 0.05), P(rnd(-0.7, 0.7), d)));
    o.start(tt); o.stop(tt + 0.35);
  }
}

// ---- ambience -------------------------------------------------------------------------------
function mkAmb() {
  const n = ctx.currentTime, A = { nextBird: n + rnd(0.1, 0.8), nextDog: n + rnd(1, 3.5), dogP: rnd(0.85, 1.2), crick: null };
  const pink = S(NB.pink, 1), brown = S(NB.brown, 0.9);
  // distant traffic hum with slow swells
  A.gT = G(0, N.ambIn); const sw = G(1, A.gT), lfo = O('sine', 0.045, G(0.35, sw.gain));
  brown.connect(F('lowpass', 170, 0, sw)); pink.connect(F('bandpass', 450, 0.6, G(0.18, sw)));
  // wind (always a light breeze, rush grows with speed) with gusts
  A.gW = G(0, N.ambIn); const gust = G(1, A.gW), gs = S(NB.brown, 0.005); gs.connect(G(0.9, gust.gain));
  A.lpW = F('lowpass', 300, -1, gust); pink.connect(A.lpW);
  // birds (slightly distant), crickets, dog with a little street echo
  A.bird = G(0, F('lowpass', 9000, 0, N.ambIn));
  A.gC = G(0, N.ambIn);
  A.dog = G(0, N.ambIn); A.dogIn = G(1);
  const dlp = F('lowpass', 1600, 0, A.dog); A.dogIn.connect(dlp);
  const dly = ctx.createDelay(1); dly.delayTime.value = 0.23; dlp.connect(dly);
  const fb = F('lowpass', 900, 0, G(0.3, dly)); dly.connect(fb); dly.connect(G(0.5, A.dog));
  for (const x of [pink, brown, gs]) x.start(n, Math.random() * 3);
  lfo.start(n);
  return A;
}
// field crickets: short 3-4 pulse chirps, pre-rendered once (at init) into a 6 s stereo loop at 22.05 kHz
function crickBuffer() {
  const sr = 22050, L = 6, n = sr * L, buf = ctx.createBuffer(2, n, sr), l = buf.getChannelData(0), r = buf.getChannelData(1);
  const bugs = [{ f: 4300, P: 0.5, k: 3, a: 0.5, pan: -0.5 }, { f: 4700, P: 0.75, k: 4, a: 0.32, pan: 0.6 }, { f: 3900, P: 0.4, k: 3, a: 0.22, pan: 0.1 }];
  let pk = 0;
  for (const b of bugs) {
    const gl = Math.cos((b.pan + 1) * Math.PI / 4), gr = Math.sin((b.pan + 1) * Math.PI / 4), w = TAU * b.f / sr, len = Math.floor(0.014 * sr);
    for (let c0 = Math.random() * b.P * 0.5; c0 + 0.15 < L; c0 += b.P * rnd(0.95, 1.05)) {
      const ca = b.a * rnd(0.6, 1);
      for (let q = 0; q < b.k; q++) {
        const s0 = Math.floor((c0 + q * 0.024) * sr);
        for (let i = 0; i < len; i++) {
          const j = s0 + i, e = Math.sin(Math.PI * i / len), v = ca * e * e * Math.sin(w * j);
          l[j] += v * gl; r[j] += v * gr; const m = Math.abs(l[j]) > Math.abs(r[j]) ? Math.abs(l[j]) : Math.abs(r[j]); if (m > pk) pk = m;
        }
      }
    }
  }
  return { buf, gain: 0.9 / (pk || 1) };
}
function crickets(A) {
  const t = ctx.currentTime, cb = W.crick || (W.crick = crickBuffer());
  A.crick = S(cb.buf, 1, G(cb.gain, A.gC)); A.crick.start(t);
  // tree cricket: soft continuous trill (carrier gated at 42 Hz, slow 3 s swell) - oscillators, no per-sample JS
  const swell = G(0.5, G(0.05, A.gC)), gate = G(0.5, swell), car = O('sine', 3100, gate);
  const am = O('sine', 42, G(0.5, gate.gain)), sw = O('sine', 1 / 3, G(0.5, swell.gain));
  for (const x of [car, am, sw]) x.start(t);
}
function bird(t) {
  if (!claim('bird', t, 1.2)) return;
  const g = G(0, P(rnd(-0.85, 0.85), AMB.bird)), o = O('sine', 3000, g), a = rnd(0.25, 1), f = o.frequency, p = g.gain, kind = Math.random();
  let T = t;
  if (kind < 0.45) {            // series of short "tsip" chirps
    const k = 2 + (Math.random() * 6 | 0), f0 = rnd(3800, 6800), gap = rnd(0.07, 0.15), dn = rnd(0.7, 0.9);
    for (let i = 0; i < k; i++, T += gap) {
      f.setValueAtTime(f0 * 1.12, T); f.exponentialRampToValueAtTime(f0 * dn, T + 0.045);
      p.setValueAtTime(0, T); p.linearRampToValueAtTime(a, T + 0.006); p.linearRampToValueAtTime(0, T + 0.05);
    }
  } else if (kind < 0.8) {      // fluty whistle phrase with glides
    const k = 2 + (Math.random() * 3 | 0); let fc = rnd(1700, 3000);
    for (let i = 0; i < k; i++) {
      const d = rnd(0.08, 0.22), nf = fc * Math.pow(2, rnd(-5, 7) / 12);
      f.setValueAtTime(fc, T); f.exponentialRampToValueAtTime(nf, T + d);
      p.setValueAtTime(0, T); p.linearRampToValueAtTime(a * 0.8, T + 0.02); p.setValueAtTime(a * 0.8, T + d - 0.02); p.linearRampToValueAtTime(0, T + d);
      T += d + rnd(0.02, 0.09); fc = nf;
    }
  } else {                      // fast FM trill
    const d = rnd(0.35, 0.9), fc = rnd(3200, 5200), m = O('sine', rnd(22, 38), G(fc * 0.12, f));
    f.setValueAtTime(fc, T); m.start(T); m.stop(T + d + 0.02);
    p.setValueAtTime(0, T); p.linearRampToValueAtTime(a * 0.7, T + 0.05); p.setValueAtTime(a * 0.7, T + d - 0.08); p.linearRampToValueAtTime(0, T + d);
    T += d;
  }
  o.start(t); o.stop(T + 0.05);
}
function bark(t) {
  const k = 1 + (Math.random() * 3 | 0);
  if (!claim('dog', t, k * 0.45)) return;
  const pan = P(rnd(-0.9, 0.9), AMB.dogIn), pp = AMB.dogP;
  let T = t;
  for (let i = 0; i < k; i++) {
    const p = pp * rnd(0.97, 1.03), g = G(0, pan), gp = g.gain;
    gp.setValueAtTime(0, T); gp.linearRampToValueAtTime(rnd(0.5, 1), T + 0.012); gp.setTargetAtTime(0, T + 0.06, 0.035);
    const f1 = F('bandpass', 850 * p, 2.2, g), f2 = F('bandpass', 1900 * p, 3, g);
    const o = O('sawtooth', 420 * p); o.frequency.setValueAtTime(420 * p, T); o.frequency.exponentialRampToValueAtTime(240 * p, T + 0.12);
    o.connect(f1); o.connect(f2); o.start(T); o.stop(T + 0.3);
    burst(NB.white, T, 0.3, F('bandpass', 1400 * p, 1, G(0.4, g)));
    T += rnd(0.25, 0.42);
  }
}

// ---- radio ----------------------------------------------------------------------------------
function mkRadio() {
  const out = G(0, N.master), dly = ctx.createDelay(0.05); dly.delayTime.value = 0.008; dly.connect(out);
  const wow = O('sine', 0.5, G(0.0011, dly.delayTime)); wow.start();      // tape-ish wow
  const lp = F('lowpass', 5200, -1, dly), hp = F('highpass', 85, -1, lp);
  R = { out, in: hp, sess: null };
}
function setStation(i) {
  if (!R) mkRadio();
  const n = ctx.currentTime + 0.01;
  if (R.sess) { const g = R.sess.g; hold(g.gain, n); g.gain.setTargetAtTime(0, n, 0.06); R.sess = null; if (!offline) setTimeout(() => { try { g.disconnect(); } catch (e) { /* ignore */ } }, 3000); }
  station = i;
  if (i < 0) {
    hold(R.out.gain, n); R.out.gain.setTargetAtTime(0, n, 0.08);
    if (radioTimer) { clearInterval(radioTimer); radioTimer = 0; }
    return null;
  }
  lastStation = i;
  hold(R.out.gain, n); R.out.gain.setTargetAtTime(RADIO_VOL, n, 0.03);
  // tuning static between stations
  const sg = G(0, R.in), sp = sg.gain; sp.setValueAtTime(0, n); sp.linearRampToValueAtTime(0.12, n + 0.03); sp.setTargetAtTime(0, n + 0.2, 0.04);
  burst(NB.white, n, 0.45, F('bandpass', 2500, 0.4, sg));
  const st = STATIONS[i], t = n + 0.28, g = G(0, R.in);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(1, t + 0.3);
  R.sess = { st, g, step: 0, bar: 0, next: t, spb: 60 / st.bpm / st.div, mel: st.scale.length >> 1 };
  radioTick();
  if (!offline && !radioTimer) radioTimer = setInterval(radioTick, 50);
  return st.name;
}
function radioTick() {
  try {
    if (!ctx || !R || !R.sess) return;
    const s = R.sess, n = ctx.currentTime, until = n + LA(0.35), per = s.st.beats * s.st.div;
    const adv = () => { s.next += s.spb; if (++s.step >= per) { s.step = 0; s.bar++; } };
    while (s.next < n - 0.02) adv();                    // timer was throttled: skip, don't burst
    while (s.next < until) { playStep(s, s.next); adv(); }
  } catch (e) { /* never let the timer throw */ }
}
function playStep(s, t0) {
  const st = s.st, i = s.step, spb = s.spb, d = s.g, barLen = spb * st.beats * st.div;
  const t = t0 + (i % 2 === 1 ? st.swing * spb : 0) + rnd(0, 0.006);
  const [root, chord] = st.prog[s.bar % st.prog.length], nextRoot = st.prog[(s.bar + 1) % st.prog.length][0];
  if (st.kit === 'lofi') {
    if (i === 0 || i === 10 || (i === 7 && Math.random() < 0.5)) kick(t, d, i === 0 ? 0.9 : 0.6);
    if (i === 4 || i === 12) snare(t, d, 0.5);
    if (i % 2 === 0) hat(t, d, i % 4 === 0 ? 0.35 : 0.22); else if (Math.random() < 0.2) hat(t, d, 0.1);
    if (i === 0) { keys(t, chord, barLen * 0.95, d, 'rhodes', 0.09); bass(t, root, spb * 5, d, 'lofi', 0.5); }
    if (i === 8 && Math.random() < 0.35) keys(t, chord, barLen * 0.45, d, 'rhodes', 0.06);
    if (i === 10) bass(t, root, spb * 3, d, 'lofi', 0.42);
    if (i === 14 && Math.random() < 0.5) bass(t, root + 7, spb * 2, d, 'lofi', 0.35);
    if (i % 2 === 0) melody(s, t, spb * 2, 'bell', 0.28, chord);
    if (Math.random() < 0.1) crackle(t, d);
  } else if (st.kit === 'folk') {        // 3/4 "oom-pah-pah" with an accordion and a clarinet
    if (i === 0) { bass(t, root + (s.bar % 2 ? -5 : 0), spb * 1.6, d, 'folk', 0.8); kick(t, d, 0.45); }
    if (i === 2 || i === 4) { keys(t, chord, spb * 0.9, d, 'accordion', 0.075); snare(t, d, 0.22, true); }
    if (i === 5 && Math.random() < 0.3) keys(t, chord, spb * 0.7, d, 'accordion', 0.05);
    melody(s, t, spb, 'clarinet', 0.55, chord);
  } else {                               // brushed swing: ride, walking bass, comping, vibes
    if (i === 0 || i === 2 || i === 3 || i === 4 || i === 6 || i === 7) ride(t, d, i % 2 ? 0.5 : 0.8);
    if (i === 2 || i === 6) brush(t, d, 0.6);
    if (i % 2 === 0) {
      const beat = i / 2; let m;
      if (beat === 0) m = root;
      else if (beat === 3) m = nextRoot + (Math.random() < 0.5 ? 1 : -1);
      else { const pc = chord[(Math.random() * chord.length) | 0] % 12; m = root + ((pc - root % 12 + 12) % 12); }
      bass(t, m, spb * 1.9, d, 'jazz', 0.6);
      melody(s, t, spb * 2, 'vibes', 0.3, chord);
    }
    if (i === 0 || (i === 3 && Math.random() < 0.6) || Math.random() < 0.08) keys(t, chord, spb * (i === 0 ? 1.8 : 0.9), d, 'piano', 0.06);
  }
}
function melody(s, t, dur, kind, p, chord) {
  if (Math.random() > p) return;
  const sc = s.st.scale;
  if (s.step === 0 && Math.random() < 0.7) {     // land on a chord tone at the bar start
    let best = s.mel, bd = 99;
    for (let k = 0; k < sc.length; k++) if (chord.some((c) => c % 12 === sc[k] % 12) && Math.abs(k - s.mel) < bd) { bd = Math.abs(k - s.mel); best = k; }
    s.mel = best;
  } else s.mel = clamp(s.mel + [-2, -1, -1, 0, 1, 1, 2][(Math.random() * 7) | 0], 0, sc.length - 1);
  lead(t, sc[s.mel], dur * rnd(0.8, 1.5), s.g, kind, rnd(0.6, 1));
}
function kick(t, d, v) {
  const o = O('sine', 125, env(t, v * 0.8, 0.002, 0.07, d));
  o.frequency.setValueAtTime(125, t); o.frequency.exponentialRampToValueAtTime(44, t + 0.11); o.start(t); o.stop(t + 0.5);
}
function snare(t, d, v, rim) {
  burst(NB.white, t, 0.35, F('bandpass', rim ? 2600 : 1800, rim ? 3 : 0.9, env(t, v * (rim ? 0.35 : 0.45), 0.001, rim ? 0.015 : 0.045, d)));
  if (!rim) { const o = O('triangle', 185, env(t, v * 0.25, 0.001, 0.03, d)); o.frequency.setTargetAtTime(150, t, 0.03); o.start(t); o.stop(t + 0.25); }
}
function hat(t, d, v) { burst(NB.white, t, 0.1, F('highpass', 7500, 0, env(t, v * 0.12, 0.001, 0.011, d))); }
function crackle(t, d) { burst(NB.white, t + rnd(0, 0.1), 0.02, F('highpass', 1500, 0, env(t, rnd(0.02, 0.05), 0.0005, 0.0015, d))); }
function brush(t, d, v) {
  const g = G(0, d), p = g.gain; p.setValueAtTime(0, t); p.linearRampToValueAtTime(v * 0.1, t + 0.05); p.setTargetAtTime(0, t + 0.05, 0.05);
  burst(NB.pink, t, 0.4, F('bandpass', 3000, 0.5, g));
}
function ride(t, d, v) {
  burst(NB.white, t, 0.6, F('highpass', 6500, 0, env(t, v * 0.05, 0.001, 0.12, d)));
  const o = O('sine', 3950, env(t, v * 0.012, 0.001, 0.18, d)); o.start(t); o.stop(t + 1);
}
function bass(t, m, dur, d, kind, v) {
  const f = mtof(m), g = G(0, d), p = g.gain;
  p.setValueAtTime(0, t);
  if (kind === 'jazz') { p.linearRampToValueAtTime(v * 0.5, t + 0.008); p.setTargetAtTime(v * 0.22, t + 0.01, 0.08); }
  else { p.linearRampToValueAtTime(v * 0.45, t + 0.012); p.setTargetAtTime(v * (kind === 'folk' ? 0.16 : 0.3), t + 0.02, kind === 'folk' ? 0.15 : 0.4); }
  p.setTargetAtTime(0, t + dur, 0.05);
  const o = O(kind === 'folk' ? 'sawtooth' : 'triangle', f, F('lowpass', kind === 'folk' ? 650 : 900, 0, g));
  const o2 = O('sine', f, G(0.6, g));
  for (const x of [o, o2]) { x.start(t); x.stop(t + dur + 0.4); }
}
function keys(t, notes, dur, d, kind, v) {
  const g = G(0, d), p = g.gain, lp = F('lowpass', kind === 'accordion' ? 2600 : 2200, 0, g);
  p.setValueAtTime(0, t);
  if (kind === 'accordion') { p.linearRampToValueAtTime(v, t + 0.03); p.setValueAtTime(v, t + dur); p.setTargetAtTime(0, t + dur, 0.04); }
  else if (kind === 'piano') { p.linearRampToValueAtTime(v, t + 0.003); p.setTargetAtTime(0, t + 0.005, 0.4); p.setTargetAtTime(0, t + dur, 0.08); }
  else { p.linearRampToValueAtTime(v, t + 0.006); p.setTargetAtTime(v * 0.35, t + 0.01, 0.35); p.setTargetAtTime(0, t + dur, 0.12); }
  const end = t + dur + 0.8;
  notes.forEach((m, j) => {
    const f = mtof(m), tt = t + (kind === 'rhodes' ? j * 0.012 : 0);
    if (kind === 'accordion') {
      for (const dt of [-7, 7]) { const o = O('sawtooth', f, lp); o.detune.value = dt; o.start(tt); o.stop(end); }
    } else {
      const o = O('sine', f, lp), o2 = O(kind === 'piano' ? 'triangle' : 'sine', kind === 'piano' ? f : f * 2, G(kind === 'piano' ? 0.5 : 0.15, lp));
      o.start(tt); o.stop(end); o2.start(tt); o2.stop(end);
    }
  });
}
function lead(t, m, dur, d, kind, v) {
  const f = mtof(m);
  if (kind === 'clarinet') {
    const g = G(0, d), p = g.gain; p.setValueAtTime(0, t); p.linearRampToValueAtTime(v * 0.08, t + 0.03); p.setValueAtTime(v * 0.08, t + dur); p.setTargetAtTime(0, t + dur, 0.05);
    const o = O('square', f, F('lowpass', 1500, 0, g)), vib = O('sine', 5.5, G(9, o.detune));
    for (const x of [o, vib]) { x.start(t); x.stop(t + dur + 0.4); }
  } else {
    const long = kind === 'vibes' ? 0.55 : 0.3, hi = kind === 'vibes' ? 4 : 3;
    const o = O('sine', f, env(t, v * 0.09, 0.004, long, d)), o2 = O('sine', f * hi, env(t, v * 0.025, 0.002, 0.05, d));
    for (const x of [o, o2]) { x.start(t); x.stop(t + long * 7); }
  }
}

// ---- UI -------------------------------------------------------------------------------------
function tone(t, f, v, tc, d, type = 'sine') { const o = O(type, f, env(t, v, 0.003, tc, d)); o.start(t); o.stop(t + tc * 8 + 0.05); }
function bellTone(t, f, v, d) { tone(t, f, v, 0.25, d); tone(t, f * 2.76, v * 0.22, 0.05, d); }

// ---- public API -----------------------------------------------------------------------------
function guard(fn, fb) {
  return (...a) => {
    if (!ctx || !N) return fb;
    try { return fn(...a); } catch (e) {
      if (typeof window !== 'undefined' && window.__AUDIO_DEBUG) console.warn('[audio]', e);
      return fb;
    }
  };
}

export const AUDIO = {
  // Call from a user gesture. Creates (or resumes) the AudioContext. Idempotent. Returns true if audio is available.
  init() {
    try {
      if (ctx && N && !offline && ctx.state !== 'closed') {
        if (ctx.state !== 'running' && ctx.resume) ctx.resume().catch(() => {});
        return true;
      }
      const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
      if (!AC) return false;
      reset();
      let c;
      try { c = new AC({ latencyHint: 'interactive' }); } catch (e) { c = new AC(); }
      if (!build(c, false)) return false;
      if (c.state !== 'running' && c.resume) c.resume().catch(() => {});
      try { const s = c.createBufferSource(); s.buffer = c.createBuffer(1, 1, c.sampleRate); s.connect(c.destination); s.start(); } catch (e) { /* iOS unlock */ }
      return true;
    } catch (e) { ctx = null; N = null; return false; }
  },
  setMaster(v) {
    vol = clamp(num(v, vol), 0, 1);
    try { if (ctx && N) to(N.master.gain, vol, 0.03); } catch (e) { /* ignore */ }
  },
  mute(b) {
    isMuted = b === undefined ? !isMuted : !!b;
    try { if (ctx && N) to(N.muteG.gain, isMuted ? 0 : 1, 0.03); } catch (e) { /* ignore */ }
  },
  get muted() { return isMuted; },

  engine: guard((o) => {
    o = o || {};
    const type = ENG[o.type] ? o.type : 'car';
    if (o.on !== undefined && !o.on) { stopEngine(); return; }
    if (!E) E = mkEngine(type); else if (E.type !== type) setEngineType(E, type);
    lastType = type;
    updEngine(E, clamp(num(o.rpm, 0), 0, 1), clamp(num(o.throttle, 0), 0, 1), Math.abs(num(o.speed, 0)));
  }),

  skid: guard((amount) => {
    const a = clamp(num(amount, 0), 0, 1);
    if (!SK) { if (a < 0.01) return; SK = mkSkid(); }
    const n = ctx.currentTime, p = SK.out.gain;
    p.cancelScheduledValues(n); p.setTargetAtTime(0.3 * Math.pow(a, 0.8), n, 0.04);
    p.setTargetAtTime(0, n + 0.25, 0.08);          // fades by itself if the game stops calling
    const f = 950 + 350 * a;
    to(SK.bp1.frequency, f, 0.1); to(SK.o.frequency, f, 0.1); to(SK.oBP.frequency, f, 0.1);
    to(SK.bp2.frequency, f * 2.1, 0.1); to(SK.lfo.frequency, 5 + 4 * a, 0.2);
  }),

  horn: guard((on) => {
    if (on) { if (!HN) HN = mkHorn(E ? E.type : lastType); return; }
    if (!HN) return;
    const n = ctx.currentTime, h = HN; HN = null;
    hold(h.out.gain, n); h.out.gain.setTargetAtTime(0, n, 0.025);
    for (const o of h.oscs) o.stop(n + 0.25);
  }),

  crash: guard((intensity) => {
    const i = clamp(num(intensity, 0.5), 0, 1), n = ctx.currentTime;
    if (i < 0.02) return;
    if (n - crashT < 0.09 && i <= crashI + 0.15) return;          // debounce physics contact spam
    const t = n + 0.004;
    if (!claim('crash', t, 1.2)) return;
    crashT = n; crashI = i;
    const L = 0.35 + 0.65 * i, out = G(1, N.sfx);
    // body thud
    const o = O('sine', 90 + 50 * i, env(t, 0.6 * L, 0.002, 0.07 + 0.08 * i, out));
    o.frequency.setValueAtTime(90 + 50 * i, t); o.frequency.exponentialRampToValueAtTime(34, t + 0.25); o.start(t); o.stop(t + 0.8);
    burst(NB.brown, t, 0.6, F('lowpass', 300 + 400 * i, 0, env(t, 0.5 * L, 0.001, 0.05 + 0.05 * i, out)));
    // impact crack + crumpling metal (resonant bands gated by grains)
    burst(NB.white, t, 0.2, F('bandpass', 1800, 0.7, env(t, 0.3 * L, 0.001, 0.02, out)));
    const dur = 0.12 + 0.3 * i, cg = grains(t, dur, Math.round(4 + 14 * i), 0.9 * L, 0.012, out, 1.6), s = burst(NB.white, t, dur + 0.05, null, rnd(0.8, 1.2));
    for (let k = 0; k < 3; k++) s.connect(F('bandpass', rnd(600, 3200), rnd(4, 10), cg));
    // metallic ring
    for (let k = 0; k < 3; k++) { const r = O('sine', rnd(420, 2400), env(t, 0.03 * L, 0.001, rnd(0.08, 0.25), out)); r.start(t); r.stop(t + 1.5); }
    if (i > 0.45) glass(t + 0.01, (i - 0.45) / 0.55, out);
    // debris rattle
    burst(NB.white, t + 0.08, 0.55, F('bandpass', 1200, 1, grains(t + 0.08, 0.5, Math.round(3 + 8 * i), 0.1 * L, 0.01, out, 1.4)));
  }),

  footstep: guard((surface = 'hard', run = false) => {
    const t = ctx.currentTime + 0.003;
    if (!claim('step', t, 0.2)) return;
    const v = (run ? 1.3 : 1) * rnd(0.8, 1.1), d = N.sfx, sf = surface === 'grass' || surface === 'gravel' ? surface : 'hard';
    const thump = (a, f) => { const o = O('sine', f, env(t, a, 0.002, 0.018, d)); o.frequency.exponentialRampToValueAtTime(50, t + 0.06); o.start(t); o.stop(t + 0.15); };
    if (sf === 'hard') {
      burst(NB.pink, t, 0.12, F('bandpass', rnd(1100, 1900), 1.2, env(t, 0.18 * v, 0.001, run ? 0.01 : 0.014, d)), rnd(0.9, 1.1));
      thump(0.13 * v, rnd(95, 130));
      if (!run) { const tt = t + rnd(0.05, 0.07); burst(NB.pink, tt, 0.08, F('bandpass', 2400, 1.2, env(tt, 0.07 * v, 0.001, 0.008, d))); }
    } else if (sf === 'grass') {
      burst(NB.white, t, 0.14, F('bandpass', 3400, 0.5, F('highpass', 1400, 0, grains(t, 0.12, 6, 0.16 * v, 0.02, d, 1.3))));
      thump(0.08 * v, 80);
    } else {
      burst(NB.white, t, 0.13, F('bandpass', rnd(2000, 3800), 1.2, grains(t, 0.11, run ? 9 : 7, 0.3 * v, 0.006, d, 1.5)));
      burst(NB.pink, t, 0.12, F('bandpass', 900, 0.8, env(t, 0.1 * v, 0.001, 0.025, d)));
      thump(0.1 * v, 100);
    }
  }),

  door: guard((kind) => {
    const t = ctx.currentTime + 0.003, d = N.sfx;
    if (!claim('door', t, 0.5)) return;
    const click = (tt, f, a, tc) => burst(NB.white, tt, 0.08, F('bandpass', f, 2.5, env(tt, a, 0.0005, tc, d)));
    const thud = (tt, f0, f1, a, tc) => { const o = O('sine', f0, env(tt, a, 0.002, tc, d)); o.frequency.setValueAtTime(f0, tt); o.frequency.exponentialRampToValueAtTime(f1, tt + tc * 3); o.start(tt); o.stop(tt + tc * 8 + 0.05); };
    const whoosh = (tt, f, a, att, tc) => { const g = G(0, d), p = g.gain; p.setValueAtTime(0, tt); p.linearRampToValueAtTime(a, tt + att); p.setTargetAtTime(0, tt + att, tc); burst(NB.pink, tt, att + tc * 7, F('lowpass', f, 0, g)); };
    if (kind === 'close') {
      whoosh(t, 700, 0.06, 0.06, 0.02);
      const s = t + 0.07;
      thud(s, 90, 45, 0.4, 0.05);
      burst(NB.brown, s, 0.4, F('lowpass', 380, 0, env(s, 0.32, 0.001, 0.045, d)));
      click(s + 0.004, 2300, 0.2, 0.006); click(s + 0.018, 3400, 0.09, 0.004);
      const r = O('sine', 290, env(s, 0.04, 0.001, 0.06, d)); r.start(s); r.stop(s + 0.5);
    } else {
      click(t, 2900, 0.16, 0.004); click(t + 0.03, 1900, 0.12, 0.006);
      thud(t + 0.028, 160, 100, 0.12, 0.025);
      whoosh(t + 0.04, 1000, 0.05, 0.05, 0.08);
      const r = O('sine', 1250, env(t, 0.012, 0.001, 0.04, d)); r.start(t); r.stop(t + 0.4);
    }
  }),

  ambient: guard((o) => {
    o = o || {};
    if (!AMB) AMB = mkAmb();
    const A = AMB, nt = clamp(num(o.night, 0), 0, 1), ur = clamp(num(o.urban, 1), 0, 1), sp = Math.abs(num(o.speed, 0)), car = !!o.inCar, day = 1 - nt;
    to(N.ambLP.frequency, car ? 650 : 16000, 0.12); to(N.ambG.gain, car ? 0.6 : 1, 0.12);
    to(A.gT.gain, 0.05 * ur * (1 - 0.6 * nt), 0.5);
    const v = clamp(sp / 40, 0, 1.3);
    to(A.gW.gain, 0.012 + 0.2 * Math.pow(v, 1.6), 0.25); to(A.lpW.frequency, 260 + 4200 * Math.pow(v, 1.3), 0.25);
    to(A.bird.gain, 0.07 * Math.pow(day, 1.5) * (0.55 + 0.45 * (1 - ur)), 0.8);
    const ck = 0.07 * Math.pow(nt, 1.5) * (1 - 0.55 * ur);
    if (ck > 0.001 && !A.crick) crickets(A);
    to(A.gC.gain, ck, 0.8); to(A.dog.gain, 0.09 * nt, 0.5);
    const n = ctx.currentTime, until = n + LA(0.3);
    if (A.nextBird < n) A.nextBird = n + rnd(0.05, 0.5);
    if (A.nextDog < n) A.nextDog = n + rnd(1, 5);
    if (day > 0.08) while (A.nextBird < until) { bird(A.nextBird); A.nextBird += rnd(0.3, 3.2) / (0.4 + day); }
    if (nt > 0.35) while (A.nextDog < until) { bark(A.nextDog); A.nextDog += rnd(6, 20); }
  }),

  // 'next' cycles stations (from off it resumes the last one), 'toggle' on/off, 'off'. Returns station name or null.
  radio: guard((action) => {
    if (action === 'off') return setStation(-1);
    if (action === 'toggle') return setStation(station >= 0 ? -1 : lastStation);
    if (action === 'next') return setStation(station >= 0 ? (station + 1) % STATIONS.length : lastStation);
    return station >= 0 ? STATIONS[station].name : null;
  }, null),

  ui: guard((kind) => {
    const t = ctx.currentTime + 0.004, d = N.ui;
    if (!claim('ui', t, 0.4)) return;
    if (kind === 'waypoint') { tone(t, 880, 0.1, 0.05, d); tone(t + 0.085, 1318.5, 0.1, 0.08, d); tone(t + 0.085, 659.3, 0.04, 0.08, d, 'triangle'); }
    else if (kind === 'notify') { bellTone(t, 659.3, 0.09, d); bellTone(t + 0.11, 987.8, 0.08, d); }
    else if (kind === 'mission') {
      [523.25, 659.25, 783.99, 1046.5].forEach((f, k) => bellTone(t + k * 0.09, f, 0.07, d));
      const s = t + 0.36, g = G(0, F('lowpass', 2500, 0, d)), p = g.gain;
      p.setValueAtTime(0, s); p.linearRampToValueAtTime(0.045, s + 0.08); p.setTargetAtTime(0, s + 0.5, 0.25);
      for (const f of [261.63, 523.25, 659.25, 783.99]) for (const dt of [-5, 5]) { const x = O('triangle', f, g); x.detune.value = dt; x.start(s); x.stop(s + 2); }
    } else { tone(t, 1600, 0.06, 0.008, d, 'triangle'); tone(t, 2400, 0.03, 0.004, d); }
  }),

  // ---- test hooks ----
  // Rebuild the whole graph on a supplied (Offline)AudioContext; generative parts schedule to its end.
  _initOffline(c) {
    try {
      reset();
      if (!c || typeof c.createGain !== 'function') return false;
      return build(c, typeof c.startRendering === 'function');
    } catch (e) { ctx = null; N = null; return false; }
  },
  _tap() { return N ? N.trim : null; },   // final output node (tests attach an AnalyserNode)
  _debug() { return { ctx: !!ctx, state: ctx ? ctx.state : null, offline, voices: voices.length, engine: E ? E.type : null, station, muted: isMuted, vol }; },
};
