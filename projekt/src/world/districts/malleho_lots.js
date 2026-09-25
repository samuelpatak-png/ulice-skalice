// Car parks of the shopping zone (OC MAX / NAY, Kaufland, Tesco), surveyed from Street View 10/2022 lot panoramas
// (ground-plane projection of kerbs, lamp bases and billboard legs) and satellite imagery with the frame grid overlaid.
// AX frame: s = distance from Tesco's north corner along the Tesco / MAX front (towards the south-west), d = distance in front
// of it (towards Mallého). MAX front at d 4.75, NAY south-west end wall at s 231.3. TS frame: the Tesco lot grid (rotated 5.8°).

const AX = { o: [-554.8, 487.1], u: [-0.8003, 0.6007] };
const TS = { o: [-564.39, 484.16], u: [-0.7354, 0.6776] };
const ax = (o) => ({ f: 'AX', ...o }), ts = (o) => ({ f: 'TS', ...o });

// ---------------------------------------------------------------- OC MAX / NAY front car park (concrete pavers, red paver lines)
// cross-section (d): sidewalk 4.75-11.9 | building row 11.9-16.9 | aisle 16.9-22.9 | double row 22.9-31.9 | aisle 31.9-37.9 |
// row 37.9-42.6 | planted strip 42.6-44.5 with lamps and billboards | Kaufland car park beyond
const MAXLOT = {
  surfaces: [
    ax({ s: [76, 252], d: [11.9, 42.6], m: 'asphalt', base: true }),
    ax({ s: [236.5, 252], d: [-14.2, 11.9], m: 'asphalt', base: true }),
    ax({ s: [68.6, 231.3], d: [4.75, 11.9], m: 'walk' }),                       // wide sidewalk along the shop fronts
    ax({ s: [231.3, 236.5], d: [-14.2, 11.9], m: 'walk' }),                     // along the NAY end wall
  ],
  bays: [
    // building row (cars nose to the sidewalk); gaps in front of the MAX entrance, a crossing and the NAY entrance
    ...[[80.7, 109.1], [126, 164.1], [169, 192.9], [202.4, 227.5]].map(s => ax({ s, d: [11.9, 16.9], m: 'pavers', nose: -1, fill: 0.72 })),
    ...[[88, 162.5], [174.5, 227], [232, 241]].map(s => ax({ s, d: [22.9, 31.9], m: 'pavers', double: true, fill: 0.7 })),
    ...[[90, 157], [177, 241]].map(s => ax({ s, d: [37.9, 42.6], m: 'pavers', nose: 1, fill: 0.65 })),
    // along the NAY end wall (perpendicular to it), then the row across the aisle
    ax({ axis: 'd', s: [236.5, 241.5], d: [-12, 10.5], m: 'pavers', nose: -1, fill: 0.5 }),
    ax({ axis: 'd', s: [247, 252], d: [-12, 35], m: 'pavers', nose: 1, fill: 0.55 }),
  ],
  islands: [
    ax({ s: [84, 88], d: [22.9, 31.9], r: 2 }), ax({ s: [86, 90], d: [37.9, 42.6], r: 1.6 }),
    ax({ s: [86, 157], d: [42.6, 44.5], r: 0.4 }), ax({ s: [177, 245], d: [42.6, 44.5], r: 0.4 }),
    ax({ s: [157, 164.1], d: [37.9, 44.5], r: 1.6 }), ax({ s: [161.2, 164.1], d: [44.3, 50], r: 1.4 }),     // island with the Tauris board
    ax({ s: [171.4, 177], d: [37.9, 44.5], r: 1.6 }), ax({ s: [171.4, 179.6], d: [44.3, 50.1], r: 1.6 }),   // island with the Ahoj board
    ax({ s: [162.5, 174.5], d: [22.9, 31.9], r: 2.2, bushes: [[166.8, 26.4], [168.4, 25.1], [167.2, 23.9], [169.6, 26.9]] }),
    ax({ s: [227, 232], d: [22.9, 31.9], r: 1.8 }), ax({ s: [241, 244.5], d: [22.9, 31.9], r: 1.7 }),
    ax({ s: [241, 245], d: [37.9, 44.5], r: 1.6 }), ax({ s: [236.1, 238.5], d: [44.3, 49.7], r: 1.1 }),
    ax({ s: [227.5, 233], d: [11.9, 16.9], r: 1.2 }),                            // flag island at the NAY corner
  ],
  trees: [
    ax({ s: 171.4, d: 24.2, k: 11 }), ax({ s: 165.8, d: 29.6, k: 4 }), ax({ s: 229.5, d: 26.3, k: 0 }),
    ax({ s: 203.9, d: 20.2, k: 0 }), ax({ s: 221.4, d: 12.7, k: 0 }), ax({ s: 237.3, d: 47.0, k: 0 }),
  ],
  lamps: [
    ...[120, 151, 200.5].map(s => ax({ s, d: 27.4, t: 'lot2h', a: 90 })), ax({ s: 173.3, d: 28.2, t: 'lot2' }), ax({ s: 231, d: 27.4, t: 'lot2' }),
    ...[108.7, 131.3, 153.9, 199.1, 221.7].map(s => ax({ s, d: 43.55, t: 'lot1', a: -90 })), ax({ s: 176.5, d: 45.1, t: 'lot1', a: -90 }),
    ax({ s: 243, d: 41.5, t: 'lot1', a: -90 }), ax({ s: 244.2, d: -3, t: 'lot2', a: 90 }),
  ],
};

// ---------------------------------------------------------------- Kaufland car park (asphalt, white bay lines, hedges)
const KAUF_RING = [[247.5, 49.9], [246.5, 49.5], [245.3, 47.9], [245.3, 44.2], [238.4, 44.2], [238.5, 46.9], [238.1, 48.1], [236.7, 49.7], [236.4, 49.2],
  [236.1, 44.8], [179.6, 45.2], [179.5, 50.1], [176.9, 50.2], [174.6, 49.4], [172.8, 48.1], [171.9, 46.7], [171.4, 44.8], [164.1, 44.8], [163.9, 49.1],
  [162.8, 49.9], [161.6, 50.0], [161.2, 45.4], [160.7, 45.2], [123.6, 45.6], [123.4, 46.1], [123.4, 52.2], [118.4, 52.2], [117.8, 52.8], [118.2, 89.5],
  [118.9, 90.1], [123.8, 90.1], [124.2, 96.5], [124.6, 96.8], [156.5, 96.3], [156.6, 91.7], [157.0, 91.5], [159.1, 92.1], [161.1, 93.1], [162.6, 94.5],
  [164.5, 97.7], [165.1, 99.8], [165.2, 102.1], [164.3, 105.6], [163.2, 107.5], [174.8, 107.3], [173.2, 105.1], [172.5, 102.6], [172.3, 99.3], [173.3, 95.8],
  [174.2, 94.5], [176.9, 92.1], [180.6, 91.3], [180.9, 96.1], [257.6, 95.7], [258.3, 95.0], [258.3, 90.8], [263.6, 90.7], [263.0, 49.9], [254.1, 47.5]];
const KAUF = {
  ringAX: KAUF_RING,
  bays: [
    ...[[123.5, 161.2], [179.6, 236.1], [238.5, 245.3]].map(s => ax({ s, d: [44.6, 49.6], line: 'white', nose: -1, fill: 0.7 })),
    ...[[131, 166], [188.5, 251]].map(s => ax({ s, d: [55.6, 65.6], line: 'white', double: true, fill: 0.72 })),
    ax({ s: [172.5, 180], d: [55.6, 60.6], line: 'white', nose: 1, fill: 0.6 }),
    ...[[131, 168], [188.5, 251]].map(s => ax({ s, d: [72, 82.4], line: 'white', double: true, fill: 0.62 })),
    ...[[124.5, 162.5], [175.5, 251]].map(s => ax({ s, d: [89, 94], line: 'white', nose: 1, fill: 0.5 })),
    ax({ axis: 'd', s: [118.4, 124.2], d: [53, 89], line: 'white', nose: -1, fill: 0.45 }),
    ax({ axis: 'd', s: [257.5, 263], d: [51, 90], line: 'white', nose: 1, fill: 0.5 }),
  ],
  islands: [
    ax({ s: [166, 180], d: [60.6, 65.6], r: 1.6, hedge: { h: 0.9 } }),
    ax({ s: [168, 181], d: [72, 82.4], r: 2.4, hedge: { h: 1.0, c: '#3b5a28' } }),
    ax({ s: [129.5, 131], d: [55.6, 65.6], r: 0.7, hedge: { h: 0.7 } }), ax({ s: [251, 252.5], d: [55.6, 65.6], r: 0.7, hedge: { h: 0.7 } }),
    ax({ s: [129.5, 131], d: [72, 82.4], r: 0.7, hedge: { h: 0.7 } }), ax({ s: [251, 252.5], d: [72, 82.4], r: 0.7, hedge: { h: 0.7 } }),
    ax({ s: [149.5, 162.5], d: [94.2, 97.6], r: 1.2, hedge: { h: 1.0, c: '#3d5a29' } }),                 // hedge by the Mallého entrance
  ],
  shelters: [ax({ s: [215, 224], d: [56.3, 59.3], backAt: 1 }), ax({ s: [166.5, 172.3], d: [55.8, 58.6], backAt: 1 })],
  lamps: [
    ...[141.5, 160, 199.5, 218.6].map(s => ax({ s, d: 49.4, t: 'lot1', a: 90 })),
    ...[150, 205, 235].map(s => ax({ s, d: 77.2, t: 'lot2' })),
    ...[147.9, 200, 230].map(s => ax({ s, d: 96.6, t: 'mast', a: -90 })),
  ],
};

// ---------------------------------------------------------------- Tesco car park (TS frame, asphalt, white lines)
const TESCO = {
  ringTS: [[54.5, 15.4], [49.7, 15.0], [43.4, 9.6], [3.9, 7.4], [4.4, 5.5], [-2.1, 5.5], [-4.1, -2.0], [-9.9, -1.9], [-11.5, 89.6], [-6.3, 89.9], [-6.5, 94.2],
    [39.5, 94.4], [39.3, 90.2], [40.7, 86.6], [44.6, 88.0], [49.3, 81.8], [51.3, 76.2], [53.3, 67.6], [54.2, 60.9], [53.9, 47.7]],
  bays: [
    ts({ axis: 'd', s: [-11.5, -6.95], d: [7, 88], line: 'white', nose: -1, fill: 0.72 }),
    ...[[8, 31], [37.6, 84]].map(d => ts({ axis: 'd', s: [-0.45, 8.95], d, line: 'white', double: true, fill: 0.7 })),
    ...[[8, 31], [37.6, 84]].map(d => ts({ axis: 'd', s: [15.45, 27.35], d, line: 'white', double: true, fill: 0.62 })),
    ...[[8, 31], [37.6, 76]].map(d => ts({ axis: 'd', s: [33.85, 42.75], d, line: 'white', double: true, fill: 0.55 })),
  ],
  islands: [ts({ s: [2.2, 4.2], d: [15.8, 17.8], r: 1 })],
  dashes: [ts({ a: [-3.7, 4], b: [-3.7, 88], dash: [3, 3] })],
  trees: [ts({ s: 3.2, d: 16.8, k: 3 })],
  shelters: [ts({ s: [-0.3, 2.9], d: [18.5, 24.5], backAt: 0, rows: 2 })],
  lamps: [...[20, 50, 75].map(d => ts({ s: 21.4, d, t: 'lot2' })), ...[45, 70].map(d => ts({ s: 4.25, d, t: 'lot2' })), ...[20, 55].map(d => ts({ s: 38.3, d, t: 'lot2' }))],
};

// ---------------------------------------------------------------- lawn between the car parks and the brand totems' surroundings
const LAWN = [
  ax({ s: [74, 118.4], d: [44.5, 104], m: 'grass' }), ax({ s: [74, 86], d: [37, 44.5], m: 'grass' }),
  ax({ s: [118.4, 162.5], d: [96.8, 104.5], m: 'grass' }), ax({ s: [175.5, 263], d: [96.2, 104.5], m: 'grass' }),
  ax({ s: [231.3, 254], d: [-66, -14.2], m: 'grass' }),                              // lawn along the NAY end wall
  ax({ s: [120, 242], d: [-88, -65.7], m: 'asphalt', base: true }),                  // service yard behind OC MAX / NAY
  ax({ s: [150, 242], d: [-93.5, -88], m: 'grass' }),
];

// ---------------------------------------------------------------- billboards on the planted strip between the MAX and Kaufland car parks
// all face the MAX car park (-d); euro boards 5.1 x 2.4 m on two green legs, the Myjava one is a 9.6 x 3.6 m bigboard
const BB = (s, d, preset, extra = {}) => ax({ s, d, face: '-d', preset, w: 5.1, h: 2.4, y0: 1.6, back: { preset: 'bbBack' }, ...extra });
const BILLBOARDS = [
  BB(95.5, 43.3, 'civic', { legs: 1, arg: ['#152a4e', '#f2c230', 'KOMUNÁLNE VOĽBY 2022'] }),
  BB(109.5, 43.8, 'domoss'),
  BB(129.0, 43.5, 'civic', { arg: ['#f4f6f2', '#58b947', 'VOĽBY DO VÚC 2022', '#1f5a2a'] }),
  BB(142.0, 44.3, 'myjava', { frameC: '#2f3336' }),
  BB(160.9, 44.6, 'tauris'),
  BB(174.5, 43.4, 'ahoj', { frameC: '#23483a' }),
  BB(187.8, 42.95, 'mirai'),
  BB(206.0, 44.0, 'civic', { arg: ['#f2f2f2', '#d42a24', 'VOĽBY 2022', '#1a1a1a'] }),
  BB(220.6, 43.4, 'zipser'),
];

export default {
  frames: { AX, TS },
  dropAreas: [[-743, 539], [-690, 565], [-619, 465], [-746, 669]],
  clear: [ax({ s: [60, 275], d: [-100, 100] }), ts({ s: [-12, 56], d: [-3, 95] })],
  surfaces: [
    ...MAXLOT.surfaces,
    { f: 'AX', ring: KAUF.ringAX, m: 'asphaltL', base: true },
    { f: 'TS', ring: TESCO.ringTS, m: 'asphaltL', base: true },
    ax({ s: [254, 270], d: [-99, 36], m: 'asphalt', base: true }),                 // aisle and bays along the OC Point front
    ...LAWN,
  ],
  bays: [...MAXLOT.bays, ...KAUF.bays, ...TESCO.bays,
    ax({ axis: 'd', s: [254, 259], d: [-95, 34], line: 'white', nose: -1, fill: 0.55 }), ax({ axis: 'd', s: [265, 270], d: [-95, 34], line: 'white', nose: 1, fill: 0.6 })],
  islands: [...MAXLOT.islands, ...KAUF.islands, ...TESCO.islands],
  trees: [...MAXLOT.trees, ...TESCO.trees],
  lamps: [...MAXLOT.lamps, ...KAUF.lamps, ...TESCO.lamps],
  shelters: [...KAUF.shelters, ...TESCO.shelters],
  dashes: TESCO.dashes,
  billboards: BILLBOARDS,
};
