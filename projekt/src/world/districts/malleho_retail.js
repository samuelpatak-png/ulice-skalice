// Shopping zone at the Mallého / Lúčky roundabout: Tesco, OC MAX, Kaufland, OC Point.
// Surveyed from Street View 10/2022 (lot panoramas around the buildings); facade positions ray-cast onto the OSM outlines.
// Facade coordinate s of the Tesco + MAX front = distance from Tesco's north corner along the front (towards the south-west).

const AX = { o: [-554.8, 487.1], u: [-0.8003, 0.6007] };
const ad = (b1, b2, head, sub, acc, fig = true, tc) => ['ad', [b1, b2, head, sub, acc, fig, tc]];
const sign = (s, v, p, extra = {}) => { const [preset, arg] = Array.isArray(p) ? p : [p]; return { t: 'sign', s, v, preset, arg, ...extra }; };
const BLUE = '#2e5dc6', GREY_DARK = '#5a5f65', STONE = '#38393c';

export const shapes = {
  // OC MAX main hall (without the lower NAY / KiK wing, which is its own piece below)
  61001914: [[-576.3, 571.7], [-597.8, 589.0], [-586.2, 603.9], [-583.4, 601.7], [-576.8, 610.4], [-600.7, 628.4], [-613.0, 612.8],
    [-646.8, 638.2], [-689.3, 581.6], [-656.6, 557.1], [-657.1, 556.3], [-647.8, 549.4], [-647.4, 550.0], [-612.7, 523.6]],
};
export const extraBuildings = [
  { id: 9000101, like: 61001914, ring: [[-646.8, 638.2], [-699.8, 678.1], [-742.4, 622.2], [-691.4, 583.7], [-691.4, 583.1], [-689.3, 581.6]],
    look: { wall: '#dfe2e3', mat: 'CLADDING', blank: true, eave: 8.5, roof: 'flat', cat: 5 } },
];
export const looks = {
  54267396: { wall: '#adb4ba', mat: 'CORRUGATED', blank: true, eave: 8.45, roof: 'flat', cat: 5 },     // Tesco
  61001914: { wall: '#d3d6d8', mat: 'CLADDING', blank: true, eave: 10.5, roof: 'flat', cat: 5 },      // OC MAX
  837544586: { wall: '#e2e4e5', mat: 'CLADDING', blank: true, eave: 7.8, roof: 'flat', cat: 5 },      // Kaufland
  1113376388: { wall: '#d9dcde', mat: 'CLADDING', blank: true, eave: 5.9, roof: 'flat', cat: 5 },     // OC Point
};

export const retail = [
  // ================================================================ Tesco, car-park front (NW)
  { path: [[-554.8, 487.1], [-609.3, 528.0]], axis: AX, side: 1, items: [
    { t: 'wall', s: [0, 68.1], v: [8.1, 8.45], c: '#244a9a' },                                    // thin blue edge under the coping
    sign([9.7, 23.0], [2.6, 7.0], 'tesco'),
    sign([34.7, 41.0], [3.2, 6.8], ad('#2d8c3c', '#1d5f28', 'Clubcard', 'Výhodné ceny každý deň', '#ffffff', false)),
    // cart shelter in front of the wall
    { t: 'box', s: [25, 35], d: [2.2, 5.6], v: [2.3, 2.45], c: '#8c9196', m: 'PRECAST' },
    ...[25.2, 34.8].flatMap(s => [{ t: 'pole', s, d: 2.3, h: 2.3, r: 0.08, c: '#8c9196' }, { t: 'pole', s, d: 5.5, h: 2.3, r: 0.08, c: '#8c9196' }]),
    { t: 'box', s: [25, 35], d: [2.2, 2.3], v: [0.2, 1.2], c: '#9ea3a8', m: 'PRECAST' },
    // entrance: projecting anthracite canopy on two columns, glazing, TESCO over the doors
    { t: 'glass', s: [44.5, 56.0], v: [0, 3.4] },
    { t: 'box', s: [43.0, 57.5], d: [0, 4.0], v: [3.4, 4.6], c: '#3e4348', top: '#55595e', m: 'CLADDING' },
    { t: 'pole', s: 43.4, d: 3.7, h: 3.4, r: 0.3, c: '#3e4348' }, { t: 'pole', s: 57.1, d: 3.7, h: 3.4, r: 0.3, c: '#3e4348' },
    sign([47.0, 53.5], [3.55, 4.45], 'tesco', { dd: 4.02 }),
    sign([59.2, 64.1], [5.2, 6.8], 'ff'),
  ] },
  // Tesco, Lúčky side (NE)
  { path: [[-554.8, 487.1], [-513.6, 540.9]], side: -1, items: [
    { t: 'wall', s: [0, 67.8], v: [8.1, 8.45], c: '#244a9a' },
    sign([28.0, 36.0], [5.0, 7.2], 'tesco'),
  ] },

  // ================================================================ OC MAX, car-park front (NW), s continues from Tesco
  { path: [[-612.7, 523.6], [-647.4, 550.0], [-647.8, 549.4], [-657.1, 556.3], [-656.6, 557.1], [-691.4, 583.1], [-691.4, 583.7], [-742.4, 622.2]], axis: AX, side: 1, items: [
    // Telekom corner: shop glazing and dark stone, billboards, shop signs under the coping
    { t: 'glass', s: [68.6, 75.0], v: [0, 3.4] },
    { t: 'wall', s: [75.0, 79.0], v: [0, 3.4], c: STONE, m: 'STONE' },
    sign([68.8, 73.5], [4.3, 8.3], ad('#8cc63f', '#4f8f22', '1 DAY', 'OBCHOD NA JEDNOTKY!', '#ffffff')),
    sign([74.3, 79.4], [4.3, 8.3], ad('#f4f4f4', '#d9dde3', 'Ford', 'AUTORIZOVANÝ PREDAJ A SERVIS', '#1b4f9c', false, '#1b4f9c')),
    sign([80.8, 85.4], [4.3, 8.3], ad('#b3202a', '#6e0f16', 'MONACO', 'reštaurácia', '#f2d27a', false)),
    sign([68.8, 72.8], [9.0, 10.2], 'telekom'),
    sign([72.8, 77.0], [9.0, 10.2], 'dracik'),
    // ribbed dark section, blue section with TAKKO / PEPCO, kiosk and bollards
    { t: 'wall', s: [85.6, 89.4], v: [0, 10.5], c: GREY_DARK, m: 'CORRUGATED' },
    { t: 'wall', s: [89.4, 104.2], v: [0, 10.5], c: BLUE },
    sign([92.7, 97.6], [3.6, 7.6], 'percent'),
    sign([98.9, 103.6], [3.3, 7.8], 'pepcoAd'),
    sign([100.1, 103.9], [8.3, 9.6], 'takko'),
    { t: 'box', s: [86.5, 91.5], d: [0.6, 3.0], v: [0, 2.6], c: '#e9e5dc', m: 'PLASTER', top: '#b8342c' },
    { t: 'bollards', s: [88, 132], d: 7.0, every: 3.2 },
    // entrance portal: grey frame with the MAX letters on top, dark stone recess, glazed doors and window band
    { t: 'box', s: [106.8, 110.3], d: [0, 1.6], v: [0, 13.4], c: '#9ea4aa', solid: true },
    { t: 'box', s: [125.6, 129.4], d: [0, 1.6], v: [0, 13.4], c: '#9ea4aa', solid: true },
    { t: 'box', s: [106.8, 129.4], d: [0, 1.6], v: [11.0, 13.4], c: '#9ea4aa' },
    { t: 'wall', s: [110.3, 120.8], v: [0, 6.8], c: STONE, m: 'STONE' },
    { t: 'glass', s: [112.5, 120.1], v: [0, 3.5], dd: 0.02 },
    { t: 'glass', s: [112.5, 120.1], v: [4.3, 6.1], dd: 0.02 },
    sign([109.5, 126.5], [13.5, 17.6], 'max', { cut: true, dd: 0.8 }),
    { t: 'box', s: [104.1, 105.5], d: [4.8, 5.6], v: [0, 2.7], c: '#8c8f93' },            // city-light column
    sign([104.2, 105.4], [0.6, 2.5], ad('#2aa0d8', '#1b6fa8', '6 €', 'mám chuť', '#ffd200'), { dd: 5.62 }),
    // blue section with PEPCO, posters
    { t: 'wall', s: [129.4, 143.6], v: [0, 10.5], c: BLUE },
    sign([130.2, 134.8], [8.3, 9.6], 'pepco'),
    sign([130.9, 135.9], [3.5, 7.8], ad('#f3d9c9', '#e0a28c', 'Pre malých aj veľkých', 'detský svet', '#ffffff')),
    sign([137.4, 142.0], [3.5, 7.8], ad('#ffffff', '#e9eef2', 'Nová dimenzia spánku', 'segum.sk', '#c9202a', false, '#c9202a')),
    // louvres, Euronics / Cinemax block with posters, MGYM door and shop glazing in dark stone
    { t: 'wall', s: [143.6, 146.2], v: [0, 10.5], c: GREY_DARK, m: 'CORRUGATED' },
    sign([147.2, 155.4], [8.9, 10.3], 'euronics'),
    sign([155.6, 163.8], [8.9, 10.3], 'cinemax'),
    sign([147.5, 151.6], [4.0, 8.2], ad('#12367f', '#0a2256', 'Nákup aj na splátky', 'Euronics', '#ffd200')),
    sign([153.0, 157.4], [4.0, 8.2], ad('#f4f4f4', '#dfe6ef', 'Najlepšie ceny v Skalici', 'Euronics', '#12367f', false, '#12367f')),
    sign([158.8, 163.1], [4.0, 8.2], ad('#f2d2d6', '#d88a95', 'Maxnails', 'nechtové štúdio', '#8a1d33', true, '#8a1d33')),
    { t: 'glass', s: [143.6, 145.6], v: [0, 2.8] },
    sign([143.7, 145.5], [2.9, 3.4], 'mgym'),
    { t: 'wall', s: [145.6, 149.5], v: [0, 3.0], c: STONE, m: 'STONE' },
    { t: 'glass', s: [149.5, 157.0], v: [0, 3.0] },
    { t: 'wall', s: [157.0, 164.3], v: [0, 3.0], c: STONE, m: 'STONE' },
    // lower west wing (NAY, KiK, Majestic): blue band under the coping, posters, blue canopy over the NAY entrance
    { t: 'wall', s: [164.3, 231.3], v: [7.3, 8.5], c: '#2f62d4' },
    sign([168.4, 172.3], [5.3, 6.2], 'orion'),
    { t: 'wall', s: [169.5, 170.7], v: [0, 2.3], c: '#2f62d4', dd: 0.02 },
    sign([173.2, 181.4], [3.9, 7.1], 'megashop'),
    sign([182.1, 186.2], [5.3, 6.2], 'tmsport'),
    sign([184.0, 196.0], [8.7, 11.4], 'nay', { cut: true, dd: 0.2 }),
    sign([186.6, 190.8], [5.5, 7.1], ad('#8fc63e', '#5c9a2a', 'Akcia týždňa', 'NAY', '#ffffff')),
    sign([191.4, 195.6], [5.5, 7.1], ad('#4e7fd6', '#2a4f9c', 'Foto služby', 'NAY', '#ffd200')),
    sign([196.2, 200.4], [5.5, 7.1], ad('#e05aa0', '#a8307a', 'Klub výhod', 'NAY', '#ffffff')),
    sign([201.0, 205.2], [5.5, 7.1], ad('#f08a24', '#c0561a', 'Výpredaj', 'NAY', '#ffffff')),
    { t: 'glass', s: [187.0, 201.0], v: [0, 3.3] },
    { t: 'box', s: [186.2, 201.5], d: [0, 2.2], v: [3.3, 3.9], c: '#2f62d4' },
    sign([214.9, 218.3], [5.0, 7.6], 'kik'),
    sign([219.5, 222.9], [4.8, 7.4], 'majestic'),
    { t: 'wall', s: [220.8, 222.0], v: [0, 2.3], c: '#2f62d4', dd: 0.02 },
    // Majestic café terrace: light awning on slim posts, black planters with shrubs, flag poles
    { t: 'glass', s: [205.6, 218.4], v: [0, 2.7] },
    { t: 'box', s: [205.2, 218.6], d: [0.2, 5.0], v: [2.7, 3.0], c: '#e3e3df', m: 'PLASTER' },
    ...[205.4, 208.7, 212.0, 215.3, 218.4].map(s => ({ t: 'pole', s, d: 4.9, h: 2.7, r: 0.09, c: '#3a3b3d' })),
    ...[[205.5, 208.5], [208.8, 211.8], [212.1, 215.1], [215.4, 218.4]].map(s => ({ t: 'planter', s, d: [5.3, 6.1] })),
    // three flag poles on the island at the NAY corner (NAY, Slovak, EU)
    { t: 'flag', s: 228.6, d: 10.3, h: 10, r: 0.1, c: '#e9ebec', colors: ['#ffffff', '#1d4fb6'] }, { t: 'flag', s: 230.0, d: 9.9, h: 10, r: 0.1, c: '#e9ebec', colors: ['#ffffff', '#1d4fb6'] },
    { t: 'flag', s: 231.4, d: 9.5, h: 10, r: 0.1, c: '#e9ebec', colors: ['#1f3f9a', '#1f3f9a'] },
  ] },
  // OC MAX back (SE): blue cinema box over the grey service hall, fire stair, mast; the NAY wing's service wall (SV 10/2022 from Karvašova):
  // white sandwich panels, a thin blue drip profile at 4.5 m with slightly proud fascia panels above, blue coping, blue doors and windows,
  // two sectional doors, a blue storage container, bins and grey steel lock-ups at the south-west end
  { path: [[-613.0, 612.8], [-699.8, 678.1]], side: -1, items: [
    { t: 'box', s: [0, 40], d: [-30, 0.06], v: [5, 17], c: '#2d5cc2' },
    { t: 'box', s: [36.5, 40.5], d: [0.1, 3.2], v: [0, 10.4], c: '#8a8e92', m: 'PRECAST' },
    { t: 'pole', s: 22, d: -12, h: 29, r: 0.45, c: '#b9bbbd' },
    { t: 'wall', s: [42.3, 108.6], v: [0, 4.45], c: '#d6d9da' },
    { t: 'wall', s: [42.3, 108.6], v: [4.6, 7.3], c: '#eceeef', dd: 0.1 },
    { t: 'box', s: [42.3, 108.6], d: [0, 0.32], v: [4.42, 4.6], c: '#2f62d4' },
    { t: 'wall', s: [42.3, 108.6], v: [7.3, 8.5], c: '#2f62d4', dd: 0.12 },
    { t: 'wall', s: [41.3, 43.1], v: [0, 2.3], c: '#9a9ea2', dd: 0.02 },
    ...[[49.2, 50.4], [65.9, 67.1], [75.3, 76.5], [83.7, 84.8], [86.2, 87.2], [90.0, 90.9], [96.7, 97.9]].map(s => ({ t: 'wall', s, v: [0, 2.2], c: '#2f62d4', dd: 0.02 })),
    { t: 'wall', s: [76.7, 78.9], v: [0, 2.9], c: '#2f62d4', dd: 0.02 }, { t: 'wall', s: [92.3, 95.1], v: [0, 3.3], c: '#2f62d4', dd: 0.02 },
    ...[[70.9, 71.9], [72.8, 73.8], [81.7, 82.6], [88.1, 89.1]].map(s => ({ t: 'wall', s, v: [1.4, 2.2], c: '#2f62d4', dd: 0.02 })),
    ...[47, 60, 74, 88, 106.2].map(x => ({ t: 'box', s: [x, x + 0.14], d: [0.05, 0.2], v: [0, 4.45], c: '#2f62d4' })),
    { t: 'box', s: [97.2, 103.3], d: [1.0, 3.45], v: [0, 2.6], c: '#2c5cb0', m: 'CORRUGATED', solid: true },
    { t: 'box', s: [103.5, 105.0], d: [1.0, 2.3], v: [0, 1.3], c: '#2c5cb0', solid: true },
    ...[['#232426', 104.9], ['#e8c21f', 106.3], ['#232426', 107.7], ['#1f5aa6', 109.1], ['#e8c21f', 110.5]].map(([c, x]) => ({ t: 'box', s: [x, x + 1.25], d: [4.2, 5.3], v: [0, 1.35], c, m: 'PLASTER', solid: true })),
    { t: 'box', s: [111.5, 120.5], d: [0.6, 5.6], v: [0, 2.3], c: '#8a9095', m: 'CORRUGATED', solid: true },
  ] },
  // NAY south-west end wall (facing OC Point; SV 5/2012, signage updated to the current NAY letters): roof letters, blue coping,
  // side entrance under a blue canopy, three lit posters on goosenecks, a blue door and an external steel stair at the far end
  { path: [[-742.4, 622.2], [-699.8, 678.1]], side: 1, items: [
    { t: 'wall', s: [0, 70.3], v: [7.3, 8.5], c: '#2f62d4' },
    sign([2.3, 11.2], [8.7, 11.4], 'nay', { cut: true, dd: 0.2 }),
    { t: 'glass', s: [9.0, 13.1], v: [0, 3.1] },
    { t: 'box', s: [5.8, 19.2], d: [0, 2.2], v: [3.2, 3.9], c: '#2f62d4' },
    sign([2.2, 6.7], [4.0, 6.4], 'nayKlub'), sign([14.1, 18.7], [4.0, 6.4], 'nayFoto'),
    sign([24.7, 29.8], [4.0, 6.4], ad('#4e7fd6', '#2a4f9c', 'Foto služby', 'NAY', '#ffd200')),
    ...[3.3, 5.6, 15.2, 17.6, 26.0, 28.5].flatMap(x => [{ t: 'box', s: [x, x + 0.08], d: [0, 0.85], v: [6.75, 6.83], c: '#2b2c2e' }, { t: 'box', s: [x - 0.15, x + 0.23], d: [0.7, 1.0], v: [6.6, 6.75], c: '#2b2c2e' }]),
    { t: 'wall', s: [22.7, 23.8], v: [0, 2.2], c: '#2f62d4', dd: 0.02 },
    { t: 'bollards', s: [8.5, 13.5], d: 3.0, every: 1.25 },
    { t: 'box', s: [63.8, 68.2], d: [0.05, 1.5], v: [0, 0.12], c: '#6f7478' },
    ...[0, 1, 2, 3, 4, 5].map(k => ({ t: 'box', s: [63.8 + k * 0.7, 64.6 + k * 0.7], d: [0.1, 1.45], v: [k * 1.25, k * 1.25 + 0.08], c: '#6f7478' })),
    { t: 'box', s: [67.9, 68.2], d: [0.1, 1.5], v: [0, 7.3], c: '#6f7478' }, { t: 'box', s: [63.8, 64.0], d: [1.35, 1.5], v: [0, 7.3], c: '#6f7478' },
  ] },

  // ================================================================ Kaufland: entrance corner (NW and NE faces)
  { path: [[-823.7, 571.0], [-911.7, 638.3]], side: 1, items: [
    sign([0.3, 18.5], [4.6, 7.6], 'kauflandBand', { glow: 0.25 }),
    { t: 'glass', s: [3.0, 15.0], v: [0, 3.6] },
    { t: 'box', s: [2.0, 16.0], d: [0, 2.5], v: [3.6, 4.0], c: '#2b2c2e' },
    { t: 'glass', s: [22.0, 36.0], v: [2.8, 4.0] }, { t: 'glass', s: [38.0, 42.0], v: [2.8, 4.0] },
    sign([0.4, 3.9], [7.6, 11.8], 'kaufland'),
  ] },
  { path: [[-823.7, 571.0], [-794.5, 609.0]], side: -1, items: [
    sign([0.3, 30.5], [4.6, 7.6], 'kauflandBand', { glow: 0.25 }),
    { t: 'glass', s: [1.5, 7.0], v: [0, 3.6] },
    { t: 'wall', s: [15.0, 16.2], v: [0, 2.2], c: '#f2f2f0', m: 'PLASTER', dd: 0.02 },
    sign([25.5, 30.5], [0.4, 4.4], 'kauflandCart', { glow: 0.2 }),
    sign([0.4, 3.9], [7.6, 11.8], 'kaufland'),
  ] },

  // ================================================================ OC Point: glazed shop row, anthracite fascia, terracotta fins
  { path: [[-798.2, 619.0], [-732.5, 705.4]], side: -1, items: [
    { t: 'glass', s: [0.4, 108.1], v: [0, 4.05] },
    { t: 'box', s: [0, 108.5], d: [0, 0.5], v: [4.2, 5.95], c: '#2d2f33' },
    { t: 'box', s: [0, 108.5], d: [0, 0.55], v: [4.05, 4.2], c: '#a54a2f' },
    ...[0.3, 13.8, 27.3, 40.8, 54.3, 67.8, 81.3, 94.8, 108.2].map(s => ({ t: 'box', s: [s - 0.18, s + 0.18], d: [0, 0.6], v: [0, 4.2], c: '#a54a2f', m: 'PLASTER' })),
    sign([6.5, 12.0], [4.35, 5.8], 'dm', { dd: 0.5 }),
    sign([24.0, 32.0], [4.35, 5.8], 'planeo', { dd: 0.5 }),
    sign([44.0, 50.0], [4.35, 5.8], 'tedi', { dd: 0.5 }),
    sign([55.0, 61.5], [4.35, 5.8], 'sinsay', { dd: 0.5 }),
    sign([68.0, 77.0], [4.35, 5.8], 'superzoo', { dd: 0.5 }),
    sign([87.0, 99.0], [4.35, 5.8], 'sportisimo', { dd: 0.5 }),
  ] },
];

// brand totems (positions triangulated from several lot panoramas; the big ones carry a three-sided sign)
export const pylons = [
  // NAY / MAX at the south-west end of the planted strip: 7 m faces, 4.5 m tall, top 17.4 m
  { style: 'tri', p: [-781.0, 604.5], h: 17.4, bh: 4.5, w: 7.0, a0: -0.644, cw: 1.0, column: '#c9ccce',
    faces: [{ preset: 'nayPylon' }, { preset: 'maxFace' }, { preset: 'nayPylon' }] },
  // Kaufland by the roundabout: ~22 m tall mast with a 6.3 m sign prism
  { style: 'tri', p: [-670.0, 474.0], h: 21.8, bh: 6.3, w: 6.3, a0: -1.571, cw: 1.1, column: '#55595e', faces: [{ preset: 'kaufland' }] },
  // Tesco: three-sided sign on a steel lattice tower with floodlights on top
  { style: 'tri', p: [-632.8, 486.2], h: 20.7, bh: 4.3, w: 7.6, a0: -2.2, lattice: true, lr: 1.1, lrBase: 2.6, spots: true, column: '#5d6266', frame: '#f4f4f2',
    faces: [{ preset: 'tescoFace' }] },
  // small Kaufland totem at the Mallého entrance with opening hours
  { p: [-751.8, 506.8], h: 6.2, w: 2.2, bh: 2.0, preset: 'kaufland', ang: 0.314, style: 'blade', column: '#5f6468',
    extra: [{ preset: 'kauflandInfo', y: 2.3, w: 1.9, h: 2.4 }] },
];
