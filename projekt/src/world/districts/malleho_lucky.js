// Mallého (route 426 through the west of town) + Lúčky. Reference: Google Street View 9/2019 and 10/2022, satellite imagery.
// Colours are read from panoramas; every building id was matched by ray-casting the panorama direction onto the OSM footprints.
// World coordinates: metres, x east, z south, origin 48.8446 N 17.2266 E.
import * as RETAIL from './malleho_retail.js';
import LOTS from './malleho_lots.js';

const HIP = '#8e3f2c';            // red-brown tiles of the Lúčky apartment houses
const house3 = (wall) => ({ wall, floors: 3, roof: 'hip', roofColor: HIP, pitch: 38, cat: 0 });

export default {
  name: 'Mallého, Lúčky',
  id: 'malleho',
  spawn: [-596, 423, 0.736],

  // ------------------------------------------------------------------ panel blocks (exact facade builder)
  schemes: {
    // Mallého NE estate (SV 10/2022)
    malOchreBlue: { floors: 4, wall: '#dcc07c', gable: '#b9c3cf', plinth: '#7d7a74', stair: '#ccb06b' },
    malGreenWhite: { floors: 4, wall: '#eceee6', gable: '#e6e9df', plinth: '#83857f', stair: '#86b36e', cols: '#9cc486' },
    malPinkBeige: { floors: 4, wall: '#d8bcae', gable: '#d2b5a7', plinth: '#817b77', stair: '#c7a797' },
    malMauve: { floors: 4, wall: '#c9a6a1', gable: '#c29f9a', plinth: '#7c7674', stair: '#b89290' },
    malYellowBeige: { floors: 4, wall: '#dcc58f', gable: '#d6bf8a', plinth: '#817c72', stair: '#cfb57c',
      balcony: { sides: 'back', color: '#8a5a3c', slab: '#dedad0', depth: 0.3 } },
    malCreamGreen: { floors: 4, wall: '#e3d6bd', gable: '#ddd0b6', plinth: '#817d76', stair: '#6aa06a' },
    malPaleGreen: { floors: 4, wall: '#b8cc9d', gable: '#b1c697', plinth: '#7d8176', stair: '#a3bb88' },
    malWhiteRed: { floors: 8, wall: '#ecebe7', gable: '#e6e5e1', plinth: '#85847f', stair: '#c8625c' },
    malWhiteGrey: { floors: 8, wall: '#dfe0df', gable: '#d9dad9', plinth: '#82837f', stair: '#c9cacb' },
    malWhiteYellow: { floors: 8, wall: '#ecebe5', gable: '#e3c96a', plinth: '#83827c', stair: '#e3c96a' },
    // Lúčky NE side (SV 9/2019)
    lukWhiteBrown: { floors: 5, wall: '#e9e6df', gable: '#e3e0d9', plinth: '#8a8784', stair: '#dcd8d0',
      balcony: { sides: 'both', color: '#7d3f35', slab: '#e6e3dc', depth: 0.3 } },
    lukTower: { floors: 8, wall: '#e6dfcf', gable: '#e0d9c9', plinth: '#85827d', stair: '#d7cfbd' },
    lukOchre: { floors: 4, wall: '#d8aa6f', gable: '#d2a46a', plinth: '#7f7b74', stair: '#c99a60' },
    lukBeige: { floors: 4, wall: '#dcc7a0', gable: '#d6c19a', plinth: '#817d75', stair: '#cdb690' },
    lukGreenBal: { floors: 4, wall: '#ebe8df', gable: '#e4e1d8', plinth: '#83827d', stair: '#dad6cc',
      balcony: { sides: 'both', color: '#6f9f5a', slab: '#e3e0d8', depth: 0.3 } },
    lukNeutral: { floors: 4, wall: '#e3ddd0', gable: '#ddd7ca', plinth: '#83807a', stair: '#d3ccbd' },
    lukYellow: { floors: 4, wall: '#e2c77f', gable: '#e6c066', plinth: '#817c70', stair: '#d6b86c' },
    lukBeigeYellow: { floors: 4, wall: '#dfc79a', gable: '#dcc28f', plinth: '#817c72', stair: '#d0b787' },
    // Slovnaft at the roundabout: white canopy with the yellow band
    slovnaftCanopy: { kind: 'canopy', floors: 1, clear: 4.8, th: 1.1, stripeH: 0.6, color: '#f1f1ee', stripe: '#f3c300' },
  },
  buildings: {
    1265736141: 'slovnaftCanopy',
  },

  // sections mapped separately in OSM (mostly tagged as houses) merged into whole bars: [ids], scheme, storeys
  blocks: [
    { ids: [60996791, 60998162, 61000194, 61001829, 61003180, 61003730], scheme: 'malOchreBlue' },   // gable onto Mallého, ochre / blue-grey
    { ids: [60997826, 60999400], scheme: 'malGreenWhite' },
    { ids: [60996906, 60998007, 60999240], scheme: 'malGreenWhite' },
    { ids: [60996710, 60998356, 61002842, 61003969], scheme: 'malPinkBeige' },
    { ids: [60996874, 60997565, 60999485, 61002179, 61002613, 61003774], scheme: 'malMauve' },
    { ids: [61000293, 60996747, 60999656, 61004482], scheme: 'malYellowBeige' },
    { ids: [60996694, 61000174, 61002482, 61003951], scheme: 'malPaleGreen' },
    { ids: [60998834, 61001572], scheme: 'malWhiteRed' },
    { ids: [60999546, 60999874], scheme: 'malWhiteGrey' },
    { ids: [61000161, 61001089], scheme: 'malWhiteYellow' },
    { ids: [60999326, 61000876, 61002811, 60999184], scheme: 'lukOchre' },
    { ids: [60998949, 60999345, 61000216, 61001553], scheme: 'lukNeutral' },
    { ids: [60996708, 60996828, 60998288, 60999067, 61000643, 61001333, 61002354, 61002406], scheme: 'lukYellow' },   // behind the Lúčky garages
    { ids: [60997702, 60998201, 60998704, 61000087, 61000196, 61000931], scheme: 'lukBeigeYellow' },
    { ids: [60996999, 60997139, 60997684, 60997908, 60998403, 60999438, 61000001, 61004435], scheme: 'lukNeutral' },
  ],
  // stepped bars: every section keeps its own storey count (OSM building:levels)
  sections: [
    { scheme: 'malCreamGreen', ids: [[60996959, 8], [60999748, 4], [61000350, 4], [61004445, 5]] },
    { scheme: 'lukTower', ids: [[61000077, 8], [61000291, 4], [61002293, 8], [61003792, 8]] },
    { scheme: 'lukWhiteBrown', ids: [[60997319, 4], [60999878, 5], [61001232, 5], [61003151, 5]] },
    { scheme: 'lukBeige', ids: [[61001937, 4], [61001773, 4], [61001397, 4], [61000129, 5], [61000337, 4]] },
    { scheme: 'lukGreenBal', ids: [[60998354, 4], [60999456, 4], [61000516, 4], [60997786, 4]] },
    { scheme: 'lukTower', ids: [[60997005, 4], [60998123, 5], [60998543, 8], [60998562, 4], [60999471, 4], [61000684, 4],
      [60997548, 4], [61002167, 8], [60997924, 4], [61000227, 8], [61003920, 5], [60997880, 5]] },
    { scheme: 'lukNeutral', ids: [[60996980, 4], [60997270, 4], [60997569, 4], [60997947, 4], [60999100, 4], [60999307, 4], [61001873, 4], [61003219, 4], [61003822, 4]] },
  ],

  // ------------------------------------------------------------------ everything else: generic builder with surveyed colours / storeys / roofs
  looks: {
    // Lúčky SW: three-storey apartment houses with hipped tile roofs, each in its own colour
    60999494: house3('#c3ccd0'), 60999926: house3('#dca69b'), 60999769: house3('#c6d9b8'), 60997907: house3('#e2cf9a'),
    61002071: house3('#d88a74'), 60999789: house3('#7fb09a'), 60997692: house3('#e0a86e'), 60998644: house3('#eadfca'),
    61003029: house3('#e9e2d4'), 314217836: house3('#dfb8ae'), 314217837: house3('#e8dcc0'), 198154597: house3('#e9d9a0'),
    // new builds at the south-east end: white, flat roof / white with anthracite gable roofs
    840966864: { wall: '#efefec', floors: 4, roof: 'flat', cat: 0 }, 840966865: { wall: '#efefec', floors: 4, roof: 'flat', cat: 0 },
    1235156670: { wall: '#efefec', floors: 4, roof: 'flat', cat: 0 },
    1077420691: { wall: '#f0efeb', floors: 3, roof: 'gable', roofColor: '#4a4c4f', roofMat: 'grey', pitch: 35, cat: 0 },
    1077420692: { wall: '#f0efeb', floors: 3, roof: 'gable', roofColor: '#4a4c4f', roofMat: 'grey', pitch: 35, cat: 0 },
    1077420693: { wall: '#f0efeb', floors: 3, roof: 'gable', roofColor: '#4a4c4f', roofMat: 'grey', pitch: 35, cat: 0 },
    // Lúčky 2861: single-storey sand-coloured shop / office pavilion with big windows
    60998250: { wall: '#d9d8d4', roof: 'flat', cat: 3 },   // white-grey double garage by Kľúčové centrum
    61000670: { wall: '#d8c5a3', floors: 1, fh: 3.8, roof: 'flat', ft: 4, cat: 0 },
    // Kľúčové centrum and its neighbour: white two-storey offices
    61002895: { wall: '#efefed', floors: 2, fh: 3.6, roof: 'flat', ft: 15, cat: 7 },
    61003103: { wall: '#e9e9e6', floors: 2, fh: 3.6, roof: 'flat', ft: 15, cat: 7 },
    // shopping zone: see malleho_retail.js
    ...RETAIL.looks,
    // roundabout: Slovnaft shop, tax office (3 storeys, flat roof), unfinished brick shell opposite the bus stop
    840966858: { wall: '#ecece8', floors: 1, fh: 4.2, roof: 'flat', ft: 7, cat: 5 },
    840966857: { wall: '#ecece8', floors: 1, fh: 4.2, roof: 'flat', ft: 7, cat: 5 },
    60998345: { wall: '#ddd2b8', floors: 3, fh: 3.3, roof: 'flat', ft: 15, cat: 7 },
    61004129: { wall: '#9a5a44', mat: 'BRICK', floors: 3, fh: 3.1, roof: 'flat', cat: 0 },
    // Mallého NE of the roundabout: family houses and the GUR building
    60999125: { wall: '#e6dcc4', roof: 'gable', roofColor: '#a8432c' },
    61000340: { wall: '#eeeeea', roof: 'gable', roofColor: '#5a5b5d', roofMat: 'grey' },
    60999057: { wall: '#dcc6a0', roof: 'gable', roofColor: '#a8432c' },
    60997096: { wall: '#dccaa6', floors: 2, roof: 'gable', roofColor: '#a94a33' },
    60998111: { wall: '#cfc7b6', floors: 2, fh: 3.2, roof: 'hip', roofColor: '#a94a33', cat: 0 },
    60998912: { wall: '#efece6', roof: 'gable', roofColor: '#a8432c' },
    61000344: { wall: '#e6cfc4', floors: 2, roof: 'hip', roofColor: '#7a4a38' },
    // shops and school further NE
    61001661: { wall: '#e8dfc9', floors: 2, fh: 3.4, roof: 'flat', ft: 4, cat: 0 },
    61004367: { wall: '#a9bfd4', floors: 2, fh: 3.4, roof: 'flat', ft: 4, cat: 0 },
    60999681: { wall: '#e2c9a6', floors: 3, fh: 3.4, roof: 'hip', roofColor: '#a3452f', pitch: 25, cat: 7 },
    60999444: { wall: '#dcdedf', mat: 'PRECAST', cat: 4 }, 61004242: { wall: '#dcdedf', mat: 'PRECAST', cat: 4 },
  },

  // ------------------------------------------------------------------ concrete panel fence of the industrial yard NW of Mallého (SV 10/2022)
  fences: [{ road: 'Mallého', box: [-915, 540, -835, 610], off: 11, h: 2.2 }],

  // ------------------------------------------------------------------ shopping zone (Tesco, OC MAX, Kaufland, OC Point)
  shapes: RETAIL.shapes,
  extraBuildings: RETAIL.extraBuildings,
  retail: RETAIL.retail,
  pylons: RETAIL.pylons,
  lots: LOTS,
};
