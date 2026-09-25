// Demo district for the new street elements: every key and every type of the frozen schema at least once.
// It is NOT part of the game - districts/index.js only adds it when the page is opened with ?prvky=test.
// Place: the open stretch of Strážnická north-east of the town, so nothing surveyed is disturbed.
//
//   npm run build && npx http-server dist   ->  /index.html?prvky=test#prvky-test
//
// Local frame: s runs along the street (heading 38.3 deg from north), t across it (+t = north-west side,
// the side city.js calls index 0). p = O + u*s + n*t.
const O = [1316.8, -1377.1], U = [0.6197, -0.7848], N = [0.7848, 0.6197];
const R2 = (v) => Math.round(v * 100) / 100;
const P = (s, t) => [R2(O[0] + U[0] * s + N[0] * t), R2(O[1] + U[1] * s + N[1] * t)];
const DIR = 38.3;                       // street direction (degrees clockwise from north)
const BACK = (DIR + 180) % 360;         // facing a driver coming from s = 0
const TO_ROAD_N = (DIR + 270) % 360;    // from the +t side towards the carriageway
const TO_ROAD_S = (DIR + 90) % 360;

export const testEnabled = () => {
  try { return new URLSearchParams(location.search).get('prvky') === 'test'; } catch (e) { return false; }
};

export default {
  name: 'Test prvkov (?prvky=test)',
  id: 'prvky-test',
  spawn: [...P(6, 0), DIR * Math.PI / 180],
  clear: [P(-20, -30), P(90, -30), P(90, 30), P(-20, 30)],

  // ---- carriageway surface, kerb height and kerb type (two boxes = two different surfaces on one street)
  roads: [
    { name: 'Strážnická', box: [1290, -1450, 1342, -1340], sw: [2.6, 2.2], off: [0, 0], surface: 'setts', curbH: 0.15, curb: 'road' },
    { name: 'Strážnická', box: [1342, -1450, 1400, -1340], sw: [2.6, 2.2], off: [0, 0], surface: 'settsDark', curbH: 0.08, curb: 'low' },
  ],

  // ---- vertical traffic signs: own post, two plates, a supplementary plate with text, on a lamp, on a gate
  trafficSigns: [
    { p: P(4, 4.4), dir: BACK, codes: ['P1', 'E2b'], h: 2.3, pole: 'grey', note: 'daj prednosť + tvar križovatky' },
    { p: P(14, 4.4), dir: BACK, codes: ['B33', 'A22'], h: 2.2, pole: 'grey' },
    { p: P(26, 4.4), dir: BACK, codes: ['B20a:30', 'E12:Okrem dopravnej obsluhy'], h: 2.3, pole: 'white' },
    { p: P(44, -4.4), dir: DIR, codes: ['P2'], h: 2.4, pole: 'grey' },
    { p: P(52, -4.4), dir: DIR, codes: ['IP6'], h: 2.6, pole: 'grey' },
    { p: P(36, 4.3), dir: BACK, codes: ['B34'], h: 2.5, on: 'lamp', note: 'na stĺpe historickej lampy' },
    { p: P(40, -5.6), dir: TO_ROAD_S, codes: ['B1'], h: 1.8, on: 'gate', note: 'na krídle brány, bez vlastného stĺpika' },
    { p: P(55, -5.6), dir: TO_ROAD_S, codes: ['B2'], h: 1.9, on: 'fence' },
    { p: P(8, -6.2), dir: TO_ROAD_S, codes: ['C1'], h: 2.0, on: 'wall' },
  ],
  trafficLights: [
    { p: P(48, 4.5), dir: BACK, t: 'car', h: 3.2 },
    { p: P(48, -4.5), dir: DIR, t: 'ped', h: 2.6 },
  ],
  nameplates: [
    { p: P(2, 5.4), dir: BACK, text: 'Skúšobná', t: 'street', mount: 'pole', h: 2.8, color: '#c8322d' },
    { p: P(40.1, -5.75), dir: TO_ROAD_S, text: '12', t: 'number', mount: 'wall', h: 1.9, color: '#f2f0ea' },
  ],

  // ---- line poles and wires (catenary sag), including a connection to a house point
  poles: [
    { id: 'k1', p: P(6, 6.6), t: 'concrete', h: 9, arms: 1 },
    { id: 'k2', p: P(30, 6.6), t: 'wood', h: 8.5, arms: 2 },
    { id: 'k3', p: P(58, 6.6), t: 'lattice', h: 11, arms: 1 },
  ],
  wires: [
    { a: 'k1', b: 'k2', n: 4 },
    { a: 'k2', b: 'k3', n: 4 },
    { a: 'k2', b: [...P(34, 16), 6.5], n: 2 },
    { a: 'k2', b: [...P(30, -6.6), 6.6], n: 1 },    // span wire holding the catenary lamp
  ],

  // ---- street lamps entered by hand (height, arm, colour, type)
  lamps: [
    { p: P(8, 4.3), dir: TO_ROAD_N, t: 'street', h: 9, arm: 1.4, color: '#3a3d40' },
    { p: P(22, 4.3), dir: TO_ROAD_N, t: 'banana', h: 8 },
    { p: P(36, 4.3), dir: 0, t: 'lantern', h: 4.8, color: '#2a2c2e' },
    { p: P(46, 4.3), dir: DIR, t: 'cand2', h: 4.2, color: '#2a2c2e' },
    { p: P(66, -5.6), dir: TO_ROAD_S, t: 'wallLantern', h: 3.4, color: '#2a2c2e' },
    { p: P(30, 0), dir: DIR, t: 'catenary', h: 6.2 },
  ],
  clearLamps: [[1290, -1450, 1400, -1340]],

  // ---- crossings (the zebra), markings, driveways
  crossings: [{ p: [P(10, -4.4), P(10, 4.4)], w: 3, t: 'zebra', drops: true }],
  markings: [
    { t: 'stop', p: [P(8, -3.4), P(8, -0.2)], color: 'white' },
    { t: 'giveway', p: [P(46, 0.2), P(46, 3.4)], color: 'white' },
    { t: 'dash', p: [P(14, 0), P(44, 0)], w: 0.125, color: 'white' },
    { t: 'solid', p: [P(46, 0), P(64, 0)], w: 0.125, color: 'white' },
    { t: 'arrow', p: [P(16, -1.8), P(21, -1.8)], arrow: 'S' },
    { t: 'arrow', p: [P(24, -1.8), P(29, -1.8)], arrow: 'SL' },
    { t: 'arrow', p: [P(32, -1.8), P(37, -1.8)], arrow: 'R' },
    { t: 'yellowZigzag', p: [P(52, 3.6), P(64, 3.6)], w: 0.125, color: 'yellow' },
    { t: 'parking', p: [P(66, -3.6), P(76, -3.6)], w: 0.125, color: 'white' },
  ],
  driveways: [
    { road: 'Strážnická', p: P(40, -5), w: 4.0, side: 'R', mat: 'concrete', gate: { t: 'swing', color: '#3c3a38', h: 1.7 } },
    { road: 'Strážnická', p: P(55, -5), w: 3.5, side: 'R', mat: 'setts', gate: { t: 'slide', color: '#5a6a72', h: 1.6 } },
  ],

  // ---- fences: slats with visible gaps, and mesh on a 0.4 m plinth
  fences: [
    { p: [P(32, -5.7), P(48, -5.7)], h: 1.7, type: 'slat', color: '#3c3a38' },
    { p: [P(48, -5.7), P(70, -5.7)], h: 1.5, type: 'mesh', color: '#4b5a42', y0: 0.4, base: { type: 'stone', color: '#a8977c' } },
  ],

  // ---- trees with a size and a rotation (4th and 5th value, or h in the object form)
  trees: [
    [...P(12, 7.5), 35, 0.65, 20],        // low ornamental grass tuft, not a 2.5 m shrub
    [...P(20, 8.5), 10, 1.0, 0],          // lime at its normal size
    { p: P(44, 8.5), k: 20, h: 12 },      // oak, exact height in metres
    { p: P(52, 8.5), k: 41, h: 6, species: 'tuja' },   // species the engine has no model for yet
  ],

  // ---- new furniture types (dir in degrees)
  furniture: [
    { t: 'litterBin', p: P(4, 3.9), dir: TO_ROAD_N },
    { t: 'litterBin', p: P(7, 3.9), dir: TO_ROAD_N, style: 'stand', color: '#3a4a3a' },
    { t: 'hydrant', p: P(12, 5.2), dir: TO_ROAD_N },
    { t: 'hydrantUnder', p: P(15, 4.6), dir: DIR },
    { t: 'manhole', p: P(18, -1.2), dir: DIR },
    { t: 'manhole', p: P(21, 1.4), dir: DIR, w: 0.9 },
    { t: 'drain', p: P(24, 3.4), dir: DIR },
    { t: 'mailbox', p: P(27, 4.2), dir: TO_ROAD_N },
    { t: 'parkingMeter', p: P(31, 4.2), dir: TO_ROAD_N },
    { t: 'cabinet', p: P(34, 5.4), dir: TO_ROAD_N, w: 0.8, h: 1.4, d: 0.4, color: '#b9bcb8' },
    { t: 'cabinet', p: P(8, -6.0), dir: TO_ROAD_S, w: 0.5, h: 0.6, color: '#d8c27a' },
    { t: 'phoneBooth', p: P(40, 5.2), dir: TO_ROAD_N },
    { t: 'planter', p: P(44, 4.4), dir: DIR, style: 'round', w: 1.0 },
    { t: 'planter', p: P(47, 4.4), dir: DIR, w: 1.2, d: 0.6 },
    { t: 'busStop', p: P(66, 5.8), dir: TO_ROAD_N, shelter: true, bench: true, name: 'Skalica, Skúšobná' },
  ],

  // ---- ignored by the renderer, must not break anything
  todo: [
    { t: 'stojan s reklamnou tabuľou', p: P(50, 4.2), note: 'test: prvok, pre ktorý schéma nemá pole' },
    { t: 'vlajka na držiaku', p: P(51, 4.2), note: 'test' },
  ],
};
