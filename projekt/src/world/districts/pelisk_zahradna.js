// Pelíškova + Záhradná (sídlisko východ). Reference: Google Street View 9/2019, 10/2022, 7/2023 and satellite imagery.
// World coordinates: metres, x east, z south, origin 48.8446 N 17.2266 E.
export default {
  name: 'Pelíškova, Záhradná',
  id: 'peliskova',
  spawn: [712, -210.5, Math.PI / 2 - 0.19],
  // procedural trees / parked cars inside this polygon are replaced by the hand-placed ones below
  clear: [[695, -205], [808, -227.5], [865, -239.5], [932, -254], [1011, -267], [1045, -262], [1049, -186], [1000, -150], [950, -113],
    [880, -58], [830, -2], [700, -22], [620, -60], [598, -96], [688, -101], [698, -130]],

  // ------------------------------------------------------------------ colour schemes of the panel blocks (8 storeys)
  schemes: {
    // Pelíškova 13–20 (SV 10/2022): cream beige, top three storeys chocolate brown, grey stair cores,
    // ochre loggia parapets in white frames (loggia bays 0, 2, 5 of every 6-bay section)
    pelBrown: { floors: 8, wall: '#ddd3b9', top: { floors: 3, color: '#6e4538' }, gable: '#c8c8c3', gableTop: { floors: 3, color: '#6e4538' },
      plinth: '#77797b', stair: '#cacac5',
      loggia: { bays: [0, 2, 5], color: '#d8a64b', frame: '#ecebe6', depth: 0.32, sides: 'both' } },
    // Pelíškova 29–35 (L block): sand beige, top three storeys brick red, red stripe over the grey plinth
    pelBeigeRed: { floors: 8, wall: '#dac8ad', gable: '#dac8ad', plinth: '#b3a794', stripe: '#bb5c4b', top: { floors: 3, color: '#bf6150' } },
    // Pelíškova 27–28 (SV 10/2022): warm light grey, taupe stair core on the street (west) side, lime green loggia column on the south gable
    pelGreyGreen: { floors: 8, wall: '#d5d0c7', gable: '#d5d0c7', plinth: '#8a8680', stair: '#8b7f75',
      gableLoggia: { side: 'south', frame: '#7cc242', parapet: '#c9cdce' } },
    // shop block (SV 10/2022, positions ray-cast from 8 panoramas onto the OSM footprint): medium grey, lime green loggia
    // columns (grey railings) at surveyed positions, green wall fields, blank east wall of the south wing, entrance on the west side
    shopBeige: { floors: 8, wall: '#a0a7ac', gable: '#a0a7ac', plinth: '#6f7274', green: '#8ccb3e', railing: '#b4babe', noStreet: true,
      loggiaCols: [
        { p: [912.45, -236.12], w: 4.0 }, { p: [913.72, -229.84], w: 4.0 }, { p: [918.77, -204.85], w: 4.0 },   // west facade (lot side)
        { p: [927.21, -220.12], w: 4.4 }, { p: [928.91, -211.69], w: 4.4 },                                   // east facade (branch side)
        { p: [923.08, -244.07], w: 4.2 }, { p: [931.75, -190.38], w: 4.0 },                                   // north and south gable
      ],
      bands: [
        { a: [914.67, -225.14], b: [916.45, -216.32], v0: 0 },     // west: green field above Môj obchod
        { a: [924.53, -233.45], b: [925.77, -227.28], v0: 5.6 },   // east: green field from the 3rd storey up
        { a: [930.0, -237.6], b: [924.0, -236.1], v0: 0 },         // south face of the north wing
      ],
      blank: [[938.45, -195.65]],                                   // windowless east wall of the south wing
      doors: [{ p: [913.08, -232.98], w: 1.8 }] },
    // single-storey shop annex on the west side of the shop block (Môj obchod): lime green, shop windows, white fascia
    shopAnnex: { floors: 1, fh: 3.5, wall: '#8ccb3e', gable: '#8ccb3e', plinth: '#5e615f', ft: 4, fascia: '#ecebe6' },
    // timber lean-tos on the east side (weathered grey boards): the north one with a slatted open upper band,
    // the south one closed with a window and a door (used as an outdoor flat)
    shedBand: { kind: 'shed', fh: 2.8, wall: '#bdb6a8', open: 'band' },
    shedFlat: { kind: 'shed', fh: 2.8, wall: '#b6afa1', open: 'window' },
    // Záhradná 1–3: cream
    zahCream: { floors: 8, wall: '#e0d4bf', gable: '#e0d4bf', plinth: '#85878a', stair: '#ebe5d8' },
    // Záhradná 4–6 and 10–12: terracotta red with white loggia columns, gable salmon over light grey
    zahRed: { floors: 8, wall: '#aa4a3e', gable: '#babcbb', gableTop: { floors: 4, color: '#d3948a' }, plinth: '#5f6266', stair: '#e6e5e0', cols: '#e6e5e0',
      balcony: { sides: 'back', color: '#b3503f', slab: '#e6e5e0', depth: 0.3 } },
    // Záhradná 7–9: cream white with a red-brown top
    zahCreamRedTop: { floors: 8, wall: '#e6e0d3', gable: '#e6e0d3', plinth: '#6d7073', top: { floors: 3, color: '#9e4b3c' }, gableTop: { floors: 3, color: '#9e4b3c' } },
    // Detské jasle Lienka (crèche): single storey, light yellow, flat roof
    creche: { floors: 1, fh: 3.6, wall: '#e8d9a8', gable: '#e8d9a8', plinth: '#8d8a82', ft: 15 },
    // sports building with PV roof: white panels, maroon band under the roof
    sportsLow: { floors: 1, fh: 5.2, wall: '#e9e9e6', gable: '#e9e9e6', plinth: '#9a9a98', top: { h: 1.6, color: '#8a3a34' }, ft: 5, roof: 'solar' },
    // large hall: light grey corrugated metal
    hall: { floors: 1, fh: 8.5, wall: '#b8bbbd', gable: '#c9a19a', plinth: '#8f9294', ft: 5, mat: 'corrugated', roof: 'white' },
  },
  buildings: {
    // Pelíškova 13–20
    61001072: 'pelBrown', 60997398: 'pelBrown', 61004249: 'pelBrown', 60997737: 'pelBrown', 106083060: 'pelBrown', 106082775: 'pelBrown', 106082526: 'pelBrown', 106082505: 'pelBrown',
    // Pelíškova 29–35
    106082686: 'pelBeigeRed', 106082506: 'pelBeigeRed', 106082696: 'pelBeigeRed', 106083069: 'pelBeigeRed', 106082692: 'pelBeigeRed', 106082786: 'pelBeigeRed', 106083076: 'pelBeigeRed',
    // Pelíškova 27–28
    106082748: 'pelGreyGreen', 106082500: 'pelGreyGreen',
    106082850: 'shopBeige', 106082753: 'shopAnnex', 106082592: 'shopAnnex', 106082565: 'shedBand', 106083039: 'shedFlat',
    // Záhradná
    60998568: 'zahCream', 60996798: 'zahCream', 60997108: 'zahCream',
    61000181: 'zahRed', 61000959: 'zahRed', 60999092: 'zahRed',
    61003069: 'zahCreamRedTop', 61003156: 'zahCreamRedTop', 60997209: 'zahCreamRedTop',
    60997920: 'zahRed', 60998086: 'zahRed', 60999948: 'zahRed',
    60997058: 'creche', 61000386: 'sportsLow', 106082702: 'hall',
  },

  // ------------------------------------------------------------------ streets: sidewalk layout per side ('L' = left of the way's direction)
  // Pelíškova runs west→east: left = south (block side, sidewalk behind the parking bays), right = north (garden walls, no sidewalk)
  // Záhradná runs west→east: left = south (stream, no sidewalk), right = north (blocks)
  roads: [
    // the north–south branch past the shop block and Pelíškova 27–28: no kerbed sidewalks (the paths along the blocks are separate ways)
    { name: 'Pelíškova', box: [925, -258, 962, -150], sw: [0, 0], off: [0, 0] },
    { name: 'Pelíškova', box: [660, -275, 935, -195], sw: [1.8, 0], off: [5.2, 0] },
    { name: 'Záhradná', box: [595, -115, 800, -5], sw: [0, 2.0], off: [0, 1.6], mat: 'asphalt', flat: true },
    // aisle of the lot along the tree line (end of Pelíškova): no kerbed sidewalks, the bays open onto it
    { name: 'Pelíškova', box: [990, -200, 1050, -160], sw: [0, 0], off: [0, 0] },
  ],

  // ------------------------------------------------------------------ parking: rows of perpendicular bays (a→b along the row, cars on the left side of a→b unless side = -1)
  parking: [
    // Pelíškova, bays along the south kerb in front of Pelíškova 13–20
    { a: [722, -209.8], b: [808, -226.2], off: 3.0, depth: 5.0, fill: 0.85 },
    { a: [812, -227.0], b: [866, -238.5], off: 3.0, depth: 5.0, fill: 0.8 },
    // large lot west of the shop block (aisles run north–south)
    { lot: [[866, -237], [906, -245], [906, -179], [867, -179]], mat: 'concrete', color: '#8f8d88' },
    { a: [868.5, -232], b: [868.5, -183], depth: 5.0, side: -1, fill: 0.55 },
    { a: [885, -234], b: [885, -184], depth: 5.0, side: 1, fill: 0.6 },
    { a: [885, -184], b: [885, -236], depth: 5.0, side: 1, fill: 0.6 },
    { a: [904, -240], b: [904, -184], depth: 5.0, side: 1, fill: 0.5 },
    // north of Pelíškova opposite the lot
    { a: [870, -251], b: [902, -258], off: 0, depth: 5.0, side: -1, fill: 0.6 },
    // Záhradná: lots between the blocks (weathered concrete)
    { a: [727, -104], b: [729.5, -83], depth: 5.0, side: 1, fill: 0.75 },
    { lot: [[707, -49], [733, -55], [731, -80], [708, -76]], color: '#8e8c87' },
    { a: [708, -52], b: [729, -57], depth: 5.0, side: -1, fill: 0.8 },
    { a: [729, -69.5], b: [708, -64.5], depth: 5.0, side: 1, fill: 0.85 },
    { a: [708, -70], b: [729, -75], depth: 5.0, side: 1, fill: 0.7 },
    // Záhradná: big lot between blocks 4–6 and 1–3 (E–W rows by the street, N–S rows further in)
    { lot: [[742, -27], [780, -29], [779, -86], [746, -84]], color: '#8e8c87' },
    { a: [745, -31], b: [779, -32.8], depth: 5.0, side: -1, fill: 0.85, color: '#8e8c87' },
    { a: [745, -41.5], b: [779, -43.3], depth: 5.0, side: -1, fill: 0.8, color: '#8e8c87' },
    { a: [779, -48.3], b: [745, -46.5], depth: 5.0, side: -1, fill: 0.75, color: '#8e8c87' },
    { a: [757, -84], b: [757, -56], depth: 5.0, side: -1, fill: 0.8, color: '#8e8c87' },
    { a: [762, -56], b: [762, -84], depth: 5.0, side: 1, fill: 0.7, color: '#8e8c87' },
    // concrete pad with bays in front of Pelíškova 27 (west side)
    { a: [949.6, -198], b: [951.8, -184], depth: 4.8, side: -1, fill: 0.85, mat: 'concrete', color: '#8f8d88' },
    // perpendicular bays on the east side of the branch, north of Pelíškova 27 (SV 10/2022)
    { a: [943.4, -221.5], b: [944.9, -213.2], depth: 4.6, side: -1, fill: 0.8, mat: 'concrete', color: '#8f8d88' },
    // lot between the diagonal part of Pelíškova and the aisle along the tree line (satellite): one row along the road, one along the trees
    { lot: [[990.5, -169.5], [1016, -192], [1025, -198.5], [1045, -202], [1045.5, -187.5], [1027.5, -180.8], [1010, -164.3], [1003, -164]], color: '#5d5d5b' },
    { a: [992.3, -172.2], b: [1015.4, -193.5], depth: 5.0, side: 1, fill: 0.75 },
    { a: [1025.4, -199.0], b: [1044.4, -202.6], depth: 5.0, side: 1, fill: 0.8 },
    { a: [1006.5, -168.2], b: [1024.1, -184.8], depth: 5.0, side: 1, fill: 0.7 },
    { a: [1024.3, -184.5], b: [1041.8, -189.5], depth: 5.0, side: 1, fill: 0.75 },
    // Pelíškova: bays in front of the shop block's north gable
    { a: [912, -251.2], b: [940, -255.2], depth: 5.0, side: 1, fill: 0.7 },
  ],

  // parallel parking along the kerb (off < 0 = right of the way's direction)
  streetParking: [
    { road: 'Pelíškova', near: [670, -201], box: [700, -262, 866, -196], off: -4.0, fill: 0.62 },
    { road: 'Pelíškova', near: [670, -201], box: [898, -275, 930, -258.5], off: -4.0, fill: 0.5 },
    { road: 'Záhradná', box: [690, -115, 790, -5], off: 4.0, fill: 0.45 },
  ],

  // ------------------------------------------------------------------ trees (k: 0 broadleaf, 1 conifer, 2 birch, 4 poplar, 5 bush) and rows
  trees: [
    // in front of Pelíškova 13–20 (street side): one big linden at no. 16, young trees and shrubs by the entrances
    [789, -212, 0, 1.3], [746, -201.5, 2, 0.8], [812, -206, 0, 0.7], [838, -211, 2, 0.8], [760, -203, 5], [800, -209.5, 5], [826, -214, 5], [852, -219, 5],
    // meadow south of the long block: scattered solitaires
    [775, -180, 0, 1.1], [792, -165, 0, 0.9], [812, -172, 2], [835, -160, 0, 1.2], [850, -178, 2], [868, -150, 0, 1.0], [760, -150, 0, 0.9],
    [800, -135, 0, 1.1], [826, -118, 2], [760, -118, 0, 1.2], [748, -105, 2], [785, -100, 0, 0.9],
    // playground Rodinka: old trees
    [727, -140, 0, 1.45], [734, -131, 0, 1.35], [719, -151, 0, 1.2], [743, -124, 0, 1.3], [715, -135, 1, 1.1],
    // L-block courtyard: spruces and deciduous trees around the playground
    [976, -226, 0, 1.1], [1004, -214, 0, 1.2], [958, -210, 1, 1.15], [985, -214, 1, 1.0], [1016, -236, 0, 1.0], [963, -236, 2], [1020, -210, 1, 1.1],
    // young trees on the lawn east of Pelíškova 27–28
    [985, -175, 0, 0.7], [995, -165, 0, 0.65], [1005, -180, 0, 0.7], [990, -190, 0, 0.6],
    // parking lot islands and edges
    [874, -205, 0, 0.9], [893, -200, 0, 0.85], [893, -222, 2], [908, -182, 0, 1.0], [866, -183, 5],
    // Záhradná: birches and ashes around the blocks and lots
    [735, -84, 0, 1.2], [739, -64, 2, 0.8], [741, -46, 0, 1.0], [748, -58, 2], [770, -30, 0, 0.9], [783, -32, 5], [700, -90, 0, 1.2], [705, -120, 0, 1.1],
    [754, -92, 0, 1.0], [790, -95, 0, 1.1], [806, -80, 0, 1.2], [812, -60, 2],
  ],
  // dense tree line along the stream south of Záhradná (offset from the street centreline)
  treeRows: [
    { road: 'Záhradná', box: [595, -115, 800, -5], off: 8.5, every: 6.5, kinds: [0, 0, 5, 0, 2, 5], jitter: 2.2 },
    { road: 'Záhradná', box: [595, -115, 800, -5], off: 13.5, every: 9, kinds: [0, 5, 0], jitter: 3 },
  ],

  // ------------------------------------------------------------------ stream (potok) along Záhradná
  streams: [{ road: 'Záhradná', box: [595, -115, 800, -5], off: 10.5, w: 2.4, extend: [[800, -5.5], [830, 0]] }],

  // ------------------------------------------------------------------ garden walls / concrete panel fences along the streets (off < 0 = right side)
  fences: [
    { road: 'Pelíškova', near: [670, -201], box: [690, -262, 870, -196], off: -6.2, h: 2.0 },
    // plain concrete panels north of the road opposite the shop block (SV 10/2022: starts at x≈928, open parking west of it)
    { road: 'Pelíškova', near: [670, -201], box: [927, -275, 958, -258.5], off: -6.2, h: 2.0 },
    // rusty pipe railing between Záhradná and the stream ravine
    { road: 'Záhradná', box: [645, -115, 793, -5], off: 5.6, h: 1.1, type: 'rail' },
  ],

  // ------------------------------------------------------------------ waste containers: [x, z, angle, style]
  // style: none = concrete enclosure, 'open' = row by the kerb, 'recycle' = glass/plastic/paper, 'mesh' = behind a chain-link fence
  bins: [[786, -219.5, 1], [838, -230, 1], [703, -58, 0.2], [747, -38, 0], [890.5, -251.3, -0.262, 'open'], [964, -246, 0.3],
    [949.8, -200.8, 1.372, 'recycle'], [948.0, -207.0, 1.372, 'mesh'], [944.8, -224.2, 1.372, 'mesh']],

  // ------------------------------------------------------------------ surveyed footprints (replace the OSM outline)
  shapes: {
    // shop block without the thin OSM wall between the two shop annexes (it was extruded to full height)
    106082850: [[928.4, -245.1], [930.0, -237.6], [924.0, -236.1], [931.6, -198.3], [937.7, -199.4], [939.2, -191.9], [922.1, -188.4], [911.3, -241.8]],
  },
  // single-storey link between the two shop annexes
  extraBuildings: [{ id: 9000001, like: 106082753, scheme: 'shopAnnex', ring: [[910.6, -215.0], [917.6, -216.4], [918.0, -213.6], [911.1, -212.6]] }],

  // ------------------------------------------------------------------ footway corrections (OSM vs satellite / SV 10/2022)
  wayEdits: [
    { drop: [993, -217], k: 7 },                      // no paved paths across the sand of the playground
    { move: [[950, -211], [952.5, -211]] },            // sidewalk east of the branch runs behind the parked cars
    { move: [[947, -228], [949.5, -228.5]] },
    { move: [[954, -193], [957, -193]] },            // sidewalk in front of Pelíškova 27 behind the concrete pad
  ],

  // ------------------------------------------------------------------ hand-placed details
  props: [
    // Môj obchod: white sign board with the blue logo on the chamfered north-west corner of the shop annex
    { p: [910.67, -221.45], y: 3.22, w: 3.2, h: 0.95, d: 0.14, ang: -1.0024, color: '#f1f1ed' },
    { p: [910.02, -220.62], y: 3.33, w: 0.72, h: 0.72, d: 0.12, ang: -1.0024, color: '#1e6fc6' },
    { p: [910.83, -221.88], y: 3.62, w: 1.9, h: 0.26, d: 0.12, ang: -1.0024, color: '#e0782a' },
    { p: [910.75, -221.75], y: 3.34, w: 1.5, h: 0.2, d: 0.12, ang: -1.0024, color: '#5e9f3e' },
    // air-conditioning unit on the west wall of the shop
    { p: [909.52, -218.08], y: 2.2, w: 0.9, h: 0.65, d: 0.35, ang: -1.7525, color: '#e6e6e2' },
  ],
};
