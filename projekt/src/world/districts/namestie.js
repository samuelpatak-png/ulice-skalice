// Námestie slobody — the main square of Skalica. Surveyed from Street View (10/2022, 9/2019; 5/2012 on the NE corner)
// by ray-casting panorama columns onto the OSM outlines and projecting ground points (kerbs, bollards, lamp and tree bases).
// Frames: NR = the north side of the square along the road past the Jesuit college, Hotel Tatran and the Spolkový dom;
//         WR = the west side along the row of burgher houses from the town hall towards Potočná (d > 0 = house side).

const NR = { o: [170, -182], u: [0.9822, 0.1878] };
const WR = { o: [135, -170], u: [0.608, 0.794] };
const nr = (o) => ({ f: 'NR', ...o }), wr = (o) => ({ f: 'WR', ...o });
const sign = (s, v, preset, arg, extra = {}) => ({ t: 'sign', s, v, preset, arg, glow: 0, ...extra });
const cut = (s, v, preset, arg, extra = {}) => sign(s, v, preset, arg, { cut: true, ...extra });
const box = (s, d, v, c, extra = {}) => ({ t: 'box', s, d, v, c, m: 'PLASTER', ...extra });
const RED = '#b0462f', WHITE = '#f3f1e8';
const wall = (s, v, c, extra = {}) => ({ t: 'wall', s, v, c, m: 'PLASTER', ...extra });

// -------------------------------------------------------------------- building looks
const looks = {
  // west side (burgher houses, N -> S)
  61001746: { wall: '#c3dcc4', floors: 2, fh: 4.1, roof: 'hip', roofColor: RED, ang: 57.9, rh: 6.0},                    // town hall (radnica)
  60998611: { wall: '#efece4', floors: 2, fh: 3.6, roof: 'gable', roofColor: RED, ang: 54.5, rh: 7.5},                   // café u Radnice
  60997971: { wall: '#f0ebdf', floors: 2, fh: 3.2, roof: 'gable', roofColor: '#7a6456', roofMat: 'grey', ang: 52.9, rh: 7.5},
  61003734: { wall: '#f1eee6', floors: 2, fh: 3.3, roof: 'gable', roofColor: '#6f5d52', roofMat: 'grey', ang: 47.8, rh: 7.5},
  61000802: { wall: '#e6a98a', floors: 2, fh: 3.6, roof: 'gable', roofColor: RED, ang: 44.1, rh: 7.5},
  61000094: { wall: '#8c413b', floors: 2, fh: 3.6, roof: 'gable', roofColor: '#9c3e2c', ang: 43.5, rh: 7.5},             // Optika
  61000239: { wall: '#eee5d1', floors: 2, fh: 3.9, roof: 'hip', roofColor: RED, ang: 48.3, rh: 7.5},
  60998121: { wall: '#d79657', floors: 2, fh: 3.8, roof: 'gable', pitch: 24, roofColor: '#b3502f', ft: 4 },       // Slovenská sporiteľňa (1990s)
  61000462: { wall: '#e8b09a', floors: 2, fh: 3.7, roof: 'gable', pitch: 42, roofColor: RED },                   // DAKA
  // north side
  60999686: { wall: '#eeede7', floors: 3, fh: 3.9, roof: 'hip', pitch: 44, roofColor: RED, ft: 15 },                     // Jesuit college (gymnázium)
  60997972: { wall: '#d4dfc4', floors: 3, fh: 3.7, roof: 'hip', roofColor: '#6d5d52', roofMat: 'grey', ang: 18.7, rh: 5.5}, // Hotel Tatran (eaves on the square)
  61000039: { wall: '#8b4c42', floors: 2, fh: 3.6, roof: 'gable', pitch: 42, roofColor: RED },
  314707636: { wall: '#f3efe4', floors: 2, fh: 3.8, roof: 'hip', rh: 6.5, roofColor: '#3d7b55', cat: 1 },   // Spolkový dom (D. Jurkovič, 1905)
  61000430: { wall: '#e9c3a5', floors: 2, fh: 4.0, roof: 'hip', rh: 3.2, ang: 15.1, roofColor: RED },                     // Záhorské múzeum
  // ft potláča výklady, ktoré by dom dostal z obchodnej značky OSM (fac 4): v skutočnosti má prízemie bežné okná
  60999098: { wall: '#eee6d5', floors: 2, fh: 3.8, roof: 'gable', pitch: 38, roofColor: RED, ft: 2 },            // Prima banka
  // east side
  61000733: { wall: '#e38d7d', floors: 3, fh: 3.4, roof: 'hip', pitch: 56, roofColor: '#3f5c49', roofMat: 'grey', ft: 15 }, // court (1990s), ft = civic facade instead of the OSM shop fronts
  314690307: { wall: '#b9c5a3', floors: 1, fh: 4.1, roof: 'gable', roofColor: '#8c3e2c', ang: 108.5, rh: 4.5},
  60997244: { wall: '#93a6b6', floors: 2, fh: 3.5, roof: 'gable', roofColor: '#5d6064', roofMat: 'grey', cat: 1, ang: 98.7, rh: 4.0},
  // St Michael's church: plastered nave and chancel, tall pointed windows, steep red tile roof (tower built separately)
  194265919: { wall: '#dbcfb4', mat: 'PLASTER', ft: 6, eave: 11.5, rh: 9.5, roof: 'gable', roofColor: '#9a3f2c' },
};

// freshly painted smooth render (not the weathered rough plaster of the generic old-town houses)
for (const id in looks) looks[id] = { mat: 'PLASTER', ...looks[id] };

// -------------------------------------------------------------------- facade details on the real wall lines
const buttresses = (L0, n, h = 8.6) => Array.from({ length: n - 1 }, (_, k) => (k + 1) * L0 / n).flatMap(s => [
  box([s - 0.65, s + 0.65], [0, 1.35], [-0.3, h], '#c3b392', { m: 'STONE', solid: true }),
  box([s - 0.6, s + 0.6], [0, 0.85], [h, h + 1.3], '#b9a987', { m: 'STONE' })]);
const retail = [
  // town hall: central risalit with a baroque volute gable and the clock, white pilasters, cornice, red geraniums, arched portal
  { path: [[119, -173], [129, -156]], side: -1, items: [
    wall([0, 19.7], [0, 0.8], '#a8b8a4'),
    box([6.6, 13.1], [0, 0.3], [0, 8.5], '#c3dcc4'),
    ...[0.1, 6.35, 13.1, 19.1].map(s => box([s, s + 0.55], [0, 0.34], [0.8, 8.3], WHITE)),
    box([-0.1, 19.8], [0, 0.4], [8.25, 8.65], WHITE),
    cut([6.3, 13.4], [8.6, 14.2], 'volGable', ['#c3dcc4', WHITE, true], { dd: 0.28 }),
    cut([8.55, 11.15], [0, 3.7], 'karnerDoor', null, { dd: 0.32 }),
    ...[1.9, 4.5, 8.1, 9.85, 11.6, 15.2, 17.8].map(s => cut([s - 0.75, s + 0.75], [4.55, 5.05], 'flowers', null, { dd: 0.4 })),
  ] },
  // café u Radnice: small volute dormer gable, board over the café
  { path: [[129, -156], [140, -142]], side: -1, items: [
    cut([7.3, 10.5], [7.5, 10.9], 'volGable', ['#efece4', '#dedad0'], { dd: 0.05 }),
    sign([2.5, 10.5], [3.25, 3.75], 'board', ['#264a36', '#f2e6c8', 'RESTAURANT U RADNICE']),
  ] },
  // Optika: maroon house with a cream volute gable and an oculus
  { path: [[157, -123], [163, -117]], side: -1, items: [
    cut([1.6, 6.9], [7.5, 11.8], 'volGable', ['#e9b59c', '#f3e8d8', false, true], { dd: 0.05 }),
    cut([3.8, 7.6], [3.3, 4.0], 'letters', ['Optika', '#e8c35a', 'Georgia', 'italic']),
  ] },
  // Slovenská sporiteľňa: glazed ground floor, projecting bay, logo
  { path: [[175, -105], [190, -87]], side: -1, items: [
    { t: 'glass', s: [3.0, 21.0], v: [0.2, 3.4] },
    box([12.2, 15.8], [0, 1.2], [3.7, 7.4], '#d18d4f', { solid: true }),
    cut([4.0, 11.5], [3.55, 4.2], 'sporitelna'),
  ] },
  { path: [[189, -87], [198, -72]], side: -1, items: [sign([6.5, 10.0], [3.0, 3.55], 'board', ['#2f6eb5', '#ffffff', 'DAKA'])] },
  // Jesuit college: grey pilaster strips, central pediment with the arms
  { path: [[107, -247], [154, -205]], side: 1, items: Array.from({ length: 16 }, (_, k) => box([1.8 + k * 3.9, 2.4 + k * 3.9], [0, 0.12], [0.9, 12.2], '#cbccc9')) },
  { path: [[154, -205], [171, -198]], side: 1, items: [
    ...Array.from({ length: 5 }, (_, k) => box([0.6 + k * 4.1, 1.2 + k * 4.1], [0, 0.12], [0.9, 12.2], '#cbccc9')),
    box([6.3, 12.1], [0, 0.25], [0, 12.3], '#f1f0ea'),
    cut([6.0, 12.4], [12.2, 14.9], 'pediment', ['#f1f0ea', '#c9cac7'], { dd: 0.27 }),
    cut([8.1, 10.3], [0, 3.1], 'karnerDoor', null, { dd: 0.28 }),
  ] },
  // Hotel Tatran: gilt letters, TATRA BANKA over the entrance, stucco reliefs between the upper windows
  { path: [[171, -198], [189, -192]], side: 1, items: [
    cut([2.5, 16.5], [7.35, 8.2], 'letters', ['HOTEL TATRAN', '#8a6a2e', 'Georgia']),
    sign([8.2, 11.8], [2.95, 3.55], 'tatraBanka'),
    ...[2.2, 5.4, 8.6, 11.8, 15.0].map(s => cut([s, s + 1.8], [8.6, 10.2], 'stucco', ['#f4f2e8'])),
  ] },
  { path: [[189, -192], [206, -188]], side: 1, items: [
    ...[1.4, 5.8, 10.2, 14.6].map(s => cut([s, s + 1.9], [5.9, 7.0], 'stucco', ['#efe1c4'])),
    { t: 'glass', s: [2.0, 5.8], v: [0.5, 2.9] },
  ] },
  // Spolkový dom / Dom kultúry (Jurkovič): painted street front (folk ornaments, blue doors, lettering), deep timber eaves with a folk-painted fascia
  { path: [[206, -188], [224, -184]], side: 1, items: [
    sign([0, 18.4], [0, 7.9], 'kdFacade', null, { dd: 0.02 }),
    box([-0.6, 19.0], [0, 1.5], [7.95, 8.35], '#5a2e1c'),
    sign([-0.6, 19.0], [7.55, 8.3], 'jurkovicBand', null, { dd: 1.5 }),
    box([8.5, 15.1], [0, 1.4], [0, 0.18], '#c9c4b8', { m: 'STONE' }), box([8.5, 15.1], [0, 0.8], [0.18, 0.32], '#c9c4b8', { m: 'STONE' }),   // entrance steps
  ] },
  // Záhorské múzeum: rusticated ground floor, balustrade parapet, name in letters
  { path: [[224, -184], [247, -178]], side: 1, items: [
    wall([0, 23.8], [0, 4.0], '#e0b597'),
    ...Array.from({ length: 9 }, (_, k) => wall([0, 23.8], [0.45 * k, 0.45 * k + 0.05], '#c99f82', { dd: 0.01 })),
    cut([0, 23.8], [8.2, 9.2], 'balustrade', ['#efdcc8'], { dd: 0.12 }),
    cut([7.0, 17.0], [4.05, 4.6], 'letters', ['ZÁHORSKÉ MÚZEUM', '#6b4a36', 'Georgia']),
  ] },
  // court building: light grey ground floor under a blue glazed-tile canopy band
  { path: [[241, -119], [257, -152]], side: -1, items: [
    wall([0, 36.7], [0, 3.5], '#dcdfe3'),
    box([0, 36.7], [0, 1.0], [3.5, 3.85], '#2c4f8a', { top: '#3b62a6' }),
  ] },
  // single-storey house on the east side: white stucco frieze under the eaves
  { path: [[222, -84], [229, -106]], side: -1, items: [wall([0, 23.1], [3.6, 4.35], '#f2f0e7', { dd: 0.02 })] },
  // St Michael's church: baroque west portal, Gothic south portal, sandstone buttresses along the nave
  { path: [[185, -117], [183, -139]], side: -1, items: [
    box([7.0, 13.0], [0, 0.35], [0, 7.3], '#d6cab0', { m: 'STONE' }),
    cut([6.8, 13.2], [0, 7.6], 'portalBaroque', null, { dd: 0.37 }),
    ...[1.2, 20.9].map(s => box([s - 0.7, s + 0.7], [0, 1.1], [-0.3, 9.0], '#c3b392', { m: 'STONE', solid: true })),
  ] },
  { path: [[223, -120], [185, -117]], side: -1, items: [
    ...buttresses(38.1, 6),
    box([26.1, 29.6], [0, 0.5], [0, 4.9], '#c9b995', { m: 'STONE' }),
    cut([26.3, 29.4], [0, 4.7], 'gothicPortal', null, { dd: 0.52 }),
  ] },
  { path: [[183, -139], [214, -141]], side: -1, items: buttresses(31.1, 5) },
];

// -------------------------------------------------------------------- ground: setts, lawns, parking, trees, lamps
const PLAZA = [[116, -180], [125, -200], [137, -208], [154, -205], [171, -198], [189, -192], [206, -188], [224, -184], [247, -178], [258, -165], [257, -152],
  [241, -119], [229, -106], [222, -84], [218, -70], [205, -68], [198, -72], [190, -87], [175, -105], [163, -117], [157, -123], [151, -129], [145, -135], [140, -142], [129, -156], [119, -173]];
const LAWN_N = [[187, -169.6], [229.5, -161.6], [230.5, -152], [228, -144], [225.5, -141.5], [219.5, -147.8], [213.5, -146.8], [213.5, -141.5], [184, -139.5]];   // east of it: paved strip with young trees in grates
const LAWN_S = [[186, -113.4], [221, -116.2], [214.4, -100], [210.2, -85], [206.6, -86.3], [200.6, -94.3]];
const GLOBE = 50, WILLOW = 60, LINDEN = 10, CHESTNUT = 40;
const lots = {
  frames: { NR, WR },
  dropAreas: [[190, -183], [210, -172], [148, -160], [133, -165], [155, -139], [180, -106], [228, -176]],
  clear: [{ ring: PLAZA }],
  clearLamps: true,
  surfaces: [{ ring: PLAZA, fan: 12 }],
  islands: [
    { ring: LAWN_N, top: 'grass', h: 0.12, kerb: '#a9a59c' },
    { ring: LAWN_S, top: 'grass', h: 0.12, kerb: '#a9a59c' },
  ],
  bays: [
    nr({ s: [-1, 55], d: [-9.3, -4.0], line: 'dark', lw: 0.3, every: 2.6, nose: -1, fill: 0.72 }),
    nr({ s: [12, 70], d: [4.0, 9.3], line: 'dark', lw: 0.3, every: 2.6, nose: 1, fill: 0.72 }),
    wr({ s: [-1, 11], d: [3.2, 8.4], line: 'dark', lw: 0.3, every: 2.6, nose: 1, fill: 0.65 }),
    wr({ s: [27, 113], d: [3.2, 8.4], line: 'dark', lw: 0.3, every: 2.6, nose: 1, fill: 0.72, skip: [[40, 43]] }),
    wr({ s: [0, 31], d: [-8.4, -3.2], line: 'dark', lw: 0.3, every: 2.6, nose: -1, fill: 0.7 }),
  ],
  trees: [
    ...[-30, -23, -16, -9].map(s => nr({ s, d: -12.5, k: GLOBE })),
    ...[-1, 6, 13, 20, 27, 34, 41].map(s => nr({ s, d: -10.4, k: GLOBE })),
    ...[30, 38, 46, 54, 62, 70, 78, 86, 94, 102].map(s => wr({ s, d: 9.4, k: GLOBE })),
    { p: [183.5, -148.5], k: WILLOW },
    ...[[197.5, -103.5], [202.5, -98.5], [208, -101], [213.5, -103.5], [193, -109], [217.5, -110.5]].map((p, i) => ({ p, k: i % 2 ? CHESTNUT : LINDEN })),
    { p: [226.5, -151], k: LINDEN }, ...[[235.7, -139.5], [236.5, -146.7], [237.3, -152.9]].map(p => ({ p, k: 33 })),   // young trees in cast-iron grates (SV 10/2022)
  ],
  lamps: [
    { p: [151.7, -175.7], t: 'cand5' },
    ...[18, 34, 50, 66].map(s => nr({ s, d: 10.4, t: 'lantern' })),
    ...[2.5, 16.5, 30.5].map(s => nr({ s, d: -10.4, t: 'cand2', a: 0 })),
    ...[-12, 16, 50, 84].map(s => wr({ s, d: 10.2, t: 'cand2', a: 0 })),
    ...[40, 70, 100].map(s => wr({ s, d: -4.2, t: 'lantern' })),
    { p: [190, -113.2], t: 'lantern' }, { p: [205, -114.6], t: 'lantern' }, { p: [229, -123], t: 'cand2' },
  ],
};

// -------------------------------------------------------------------- street furniture and monuments
const furniture = [
  { t: 'medallion', p: [151.7, -175.7], r: 3.2 },
  { t: 'clock', p: [156.0, -197.6], ang: 20 },
  { t: 'roundBench', p: [155.2, -195.6] },
  { t: 'fountain', p: [170.2, -138.0], r: 1.7, benches: [60, 150, 240, 330] },
  { t: 'bollards', p: [0, 0], line: [[157.8, -145.9], [201.5, -88.7]], every: 3.0 },
  { t: 'crucifix', p: [182.4, -131.6], ang: 90 },
  { t: 'adColumn', p: [151.9, -130.8], posters: [['#1f5fb8', '#0d2f66', 'KONCERT', 'Kultúrny dom', '#ffd200'], ['#e8e2d0', '#c9b98a', 'TRDELNÍK FEST', 'Skalica', '#8a2d1f', false, '#8a2d1f'], ['#2a7a3a', '#15451f', 'Vinobranie', 'Skalica 2022', '#fff2b0'], ['#b3202a', '#6e0f16', 'DIVADLO', 'Záhorácke divadlo', '#f2d27a']] },
  { t: 'adColumn', p: [229.6, -145.3], rot: 0.12 },
  { t: 'terrace', p: [139.4, -152.8], size: [12.5, 5.0], ang: 51.8, brand: 'Coca-Cola' },
  { t: 'bikeRack', p: [197.5, -115.4], ang: 175, n: 5 },
  ...[[197, -107], [206, -107.8]].map(p => ({ t: 'bench', p, ang: 175 })),
  ...[[160, -190], [147, -199]].map(p => ({ t: 'bench', p, ang: 20 })),
  ...[[235.7, -139.5], [237.3, -152.9]].map(p => ({ t: 'grate', p, r: 1.1 })), { t: 'roundBench', p: [236.5, -146.7] },
  ...[[232.2, -150.5], [231.2, -143.2]].map(p => ({ t: 'bench', p, ang: 102 })),
  { t: 'signpost', p: [244.5, -156.5], ang: 30 },
  // Dom kultúry front gable over the entrance: mosaic, timber gallery (a/b = gable feet on the facade line, left to right seen from the square)
  { t: 'frontGable', p: [214, -186], a: [214.1, -186.2], b: [220.9, -184.7], y0: 8.1, h: 5.2, depth: 9, roofC: '#3d7b55', mosaic: 'kdMosaic', balcony: true },
];

export default {
  name: 'Námestie slobody',
  id: 'namestie',
  spawn: [150, -178, 2.6],
  looks,
  retail,
  lots,
  furniture,
  landmarks: {
    skip: ['michal', 'karner', 'kd', 'Mariánsky stĺp'],
    michalTower: { p: [188.4, -128.0], ang: -0.055 },
    plagueColumn: { p: [132.6, -194.5], ang: 0.72 },
  },
  schemes: { karner: { kind: 'karner', floors: 3, fh: 2.8, ft: 0, eave: 8.2, dome: 6.3, door: 4 } },
  buildings: { 54268033: 'karner' },
  roads: [{ name: 'Námestie slobody', box: [100, -215, 265, -60], sw: [0, 0], off: [0, 0] }],
};
