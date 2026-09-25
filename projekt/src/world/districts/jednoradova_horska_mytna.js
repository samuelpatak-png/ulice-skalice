// Jednoradová, Horská, Mýtna — surveyed from Street View (Mýtna, Horská west and Jednoradová 10/2022, Horská east and Jednoradová centre 7/2023;
// the north end of Jednoradová only has 5/2012 imagery). Every house seen from the street was ray-cast onto its OSM outline;
// colours, storeys, roof shape and roof colour come from the panoramas. The ridge follows the street (eaves to the street) unless
// the house shows its gable to the street.
// West of Mýtna / Jednoradová: the lawns of the Vaľy in front of the town wall with the asphalt loops of the traffic playground
// (OSM maps the playground as a running track), a green mesh fence along the sidewalk.

const looks = {
  60998087: { wall: '#e6bea2', floors: 1, fh: 3.0, roof: 'gable', rh: 3.9, roofColor: '#8e4a36', ang: 40.7, ft: 1 },  // Mýtna 15, salmon, brown gate
  60997144: { wall: '#eeede8', floors: 1, fh: 3.1, roof: 'gable', rh: 4.8, roofColor: '#7a2e28', ang: 56.5, ft: 1 },  // Mýtna 11 white, skylights, brick front
  60998433: { wall: '#d9be8c', floors: 1, fh: 3.0, roof: 'gable', rh: 3.9, roofColor: '#66615b', roofMat: 'grey', ang: 55.6, ft: 1 },  // Mýtna ochre, grey roof
  1113376389: { wall: '#e8dcc4', floors: 1, fh: 3.1, roof: 'gable', rh: 4.8, roofColor: '#4a3a33', ang: 58.2, ft: 1 },  // Mýtna 9 cream, dormer
  60999998: { wall: '#e3b574', floors: 1, fh: 3.0, roof: 'gable', rh: 3.9, roofColor: '#9c4a36', ang: 56.9, ft: 1 },  // Mýtna/Horská corner ochre, arched gable windows, stone base
  60997815: { wall: '#ebe9e3', floors: 1, fh: 3.0, roof: 'gable', rh: 3.9, roofColor: '#b34a30', ang: 44.2 },  // fire station U Hasičov long white
  60999230: { wall: '#5b3a2e', floors: 1, fh: 3.1, roof: 'gable', rh: 4.8, roofColor: '#2c2d30', roofMat: 'grey' },  // pub Budvar, dark roof, red banners
  60998195: { wall: '#e2896f', floors: 2, fh: 2.9, roof: 'gable', rh: 3.6, roofColor: '#7a3a2e', ft: 1 },  // Horská 6? coral, balconies
  60999267: { wall: '#c3c4c2', floors: 2, fh: 2.9, roof: 'gable', rh: 3.6, roofColor: '#b04a32', ang: 166.7, ft: 1 },  // grey house red roof
  60997520: { wall: '#e2c79c', floors: 1, fh: 3.1, roof: 'gable', rh: 4.8, roofColor: '#4a3f3a', ang: 161.7, ft: 1 },  // sand + brick pilasters, dormers
  60999142: { wall: '#d97a6c', floors: 1, fh: 3.0, roof: 'flat', roofColor: '#6a6560', roofMat: 'grey', ang: 137.2, ft: 1 },  // modern pink flat-roof behind block fence
  61002147: { wall: '#e6cf5c', floors: 2, fh: 2.9, roof: 'gable', rh: 3.6, roofColor: '#3c3d40', roofMat: 'grey', ang: 165.4, ft: 1 },  // yellow with dark grey panels, dormers
  61003149: { wall: '#dcc5a6', floors: 2, fh: 2.9, roof: 'gable', rh: 3.6, roofColor: '#6a3a2e', ang: 164.9, ft: 1 },  // beige with brick bands
  60998546: { wall: '#e9b9a3', floors: 1, fh: 3.0, roof: 'hip', rh: 3.9, roofColor: '#6e4c40', ang: 166, ft: 1 },  // pink single storey
  60998788: { wall: '#e88a6c', floors: 2, fh: 2.9, roof: 'gable', rh: 3.6, roofColor: '#564842', ang: 167.4, ft: 1 },  // salmon 2-storey
  61001653: { wall: '#ecebe6', floors: 1, fh: 3.0, roof: 'gable', rh: 3.9, roofColor: '#3a3a3c', roofMat: 'grey', ang: 138.2 },  // pub U Viktora (tent terrace, green sign)
  61000143: { wall: '#e0a89c', floors: 1, fh: 3.0, roof: 'gable', rh: 3.9, roofColor: '#9a5642', ang: 164.5, ft: 1 },  // old pink barn, big brown gate
  61003912: { wall: '#e0a89c', floors: 1, fh: 3.0, roof: 'gable', rh: 3.9, roofColor: '#9a5642', ang: 163.6, ft: 1 },  // pink barn continued
  60997811: { wall: '#e28b62', floors: 1, fh: 3.1, roof: 'gable', rh: 4.8, roofColor: '#5a3f36', ang: 166.8, ft: 1 },  // orange house, skylights, stone fence
  60999775: { wall: '#dcdad4', floors: 1, fh: 3.0, roof: 'gable', rh: 3.9, roofColor: '#9a9c9e', roofMat: 'grey', ang: 170.1, ft: 1 },  // long workshop, grey metal roof
  61001313: { wall: '#e8d6b8', floors: 1, fh: 3.0, roof: 'gable', rh: 3.9, roofColor: '#a8452f', ang: 166.4, ft: 1 },  // cream single storey
  60997440: { wall: '#e3a79d', floors: 1, fh: 3.0, roof: 'gable', rh: 3.9, roofColor: '#8a5a48', ft: 1 },  // pink barns + wall with brown steel gate
  60997661: { wall: '#d4ada5', floors: 1, fh: 3.0, roof: 'gable', rh: 3.9, roofColor: '#a3553f', ft: 1 },  // pink/grey plaster barn, gable to street
  61004148: { wall: '#c9b99a', floors: 1, fh: 3.0, roof: 'gable', rh: 3.9, roofColor: '#b02a24', ang: 164.2, ft: 1 },  // loam-plaster barn, new red metal roof, corrugated gate
  61004252: { wall: '#eee9df', floors: 1, fh: 3.0, roof: 'gable', rh: 3.9, roofColor: '#d0692c', ang: 163.6, ft: 1 },  // white, orange roof, sign
  60997386: { wall: '#e3c898', floors: 1, fh: 3.0, roof: 'gable', rh: 3.9, roofColor: '#b5553d', ang: 165.4, ft: 1 },  // sand single storey, timber porch
  60997888: { wall: '#cfc1a2', floors: 2, fh: 2.9, roof: 'hip', rh: 3.0, roofColor: '#6b5a4e', ang: 164.7, ft: 1 },  // 2-storey beige, low roof
  106082839: { wall: '#aeb2b6', floors: 1, fh: 3.0, roof: 'gable', rh: 3.9, roofColor: '#3e4044', roofMat: 'grey', ang: 164.5, ft: 1 },  // grey modern, grey steel gate, stone-look block fence
  106082828: { wall: '#cbc2b2', floors: 2, fh: 2.9, roof: 'hip', rh: 3.0, roofColor: '#6a5e56', ang: 164.3, ft: 1 },  // 2-storey beige old
  106082580: { wall: '#a3a7ab', floors: 2, fh: 2.9, roof: 'flat', roofColor: '#5e6064', roofMat: 'grey', ang: 163.5, ft: 1 },  // grey modern cube
  872005479: { wall: '#cfd0cf', floors: 1, fh: 3.0, roof: 'gable', rh: 3.9, roofColor: '#333538', roofMat: 'grey', ang: 164, ft: 1 },  // grey modern, solar panels
  106082690: { wall: '#a9c48c', floors: 1, fh: 3.1, roof: 'gable', rh: 4.8, roofColor: '#d9683a', ang: 169.7, ft: 1 },  // green, orange roof
  106082486: { wall: '#dcbab7', floors: 2, fh: 2.9, roof: 'gable', rh: 3.6, roofColor: '#7a4a3e', ang: 167.2, ft: 1 },  // pink 2-storey, balcony
  106082785: { wall: '#bdbec0', floors: 1, fh: 3.0, roof: 'flat', roofColor: '#6a6c70', roofMat: 'grey', ang: 167.4, ft: 1 },  // grey garage-house, grey sectional door
  106082860: { wall: '#d0a877', floors: 2, fh: 2.9, roof: 'gable', rh: 3.6, roofColor: '#6e3e32', ang: 172.4, ft: 1 },  // tan 2-storey, balcony
  106082738: { wall: '#cac8c3', floors: 2, fh: 2.9, roof: 'gable', rh: 3.6, roofColor: '#6a6a6a', roofMat: 'grey', ang: 172.6, ft: 1 },  // grey-white 2-storey
  106082533: { wall: '#c49c6e', floors: 2, fh: 2.9, roof: 'gable', rh: 3.6, roofColor: '#5e5a58', roofMat: 'grey', ang: 168, ft: 1 },  // tan 2-storey, metal roof
  106082598: { wall: '#e8e6e0', floors: 1, fh: 3.0, roof: 'gable', rh: 3.9, roofColor: '#c0492f', ang: 12.1, ft: 1 },  // white, behind timber fence
  106082959: { wall: '#c8bdb0', floors: 1, fh: 3.0, roof: 'flat', roofColor: '#6a6560', roofMat: 'grey', ang: 167.9, ft: 1 },  // garage, light blue doors
  106083006: { wall: '#efeee9', floors: 1, fh: 3.1, roof: 'gable', rh: 4.8, roofColor: '#b85a3e', ft: 1 },  // white, gable to street, old white wall
  1308389668: { wall: '#ebebea', floors: 1, fh: 3.0, roof: 'flat', roofColor: '#5e6064', roofMat: 'grey', ang: 83.3, ft: 1 },  // garage row white
  1308389670: { wall: '#ebebea', floors: 1, fh: 3.0, roof: 'flat', roofColor: '#5e6064', roofMat: 'grey', ang: 172.4, ft: 1 },  // garage row white
  1308389669: { wall: '#ebebea', floors: 1, fh: 3.0, roof: 'flat', roofColor: '#5e6064', roofMat: 'grey', ang: 172.4, ft: 1 },  // garage row white
  1308389666: { wall: '#ebebea', floors: 1, fh: 3.0, roof: 'flat', roofColor: '#5e6064', roofMat: 'grey', ang: 172.4, ft: 1 },  // garage row white
  1308389667: { wall: '#ebebea', floors: 1, fh: 3.0, roof: 'flat', roofColor: '#5e6064', roofMat: 'grey', ang: 174.3, ft: 1 },  // garage row white
  106082625: { wall: '#c98270', floors: 1, fh: 3.0, roof: 'hip', rh: 3.9, roofColor: '#6b4a40', ang: 173.7, ft: 1 },  // salmon single storey
  106082684: { wall: '#cfc4b0', floors: 2, fh: 2.9, roof: 'gable', rh: 3.6, roofColor: '#5e5652', ang: 174.3, ft: 1 },  // beige 2-storey
  106082994: { wall: '#e8e0c8', floors: 1, fh: 3.0, roof: 'gable', rh: 3.9, roofColor: '#6b4a40', ang: 173.2, ft: 1 },  // cream single storey
  106082995: { wall: '#dcdedd', floors: 1, fh: 3.1, roof: 'gable', rh: 4.8, roofColor: '#d7663b', ang: 173.4, ft: 1 },  // terrace
  106082549: { wall: '#e9e8e2', floors: 1, fh: 3.1, roof: 'gable', rh: 4.8, roofColor: '#d7663b', ang: 171.1, ft: 1 },  // terrace
  106082634: { wall: '#dcdedd', floors: 1, fh: 3.1, roof: 'gable', rh: 4.8, roofColor: '#d7663b', ang: 170.9, ft: 1 },  // terrace
  106082911: { wall: '#e9e8e2', floors: 1, fh: 3.1, roof: 'gable', rh: 4.8, roofColor: '#d7663b', ang: 173.3, ft: 1 },  // terrace
  1157011755: { wall: '#dcdedd', floors: 1, fh: 3.1, roof: 'gable', rh: 4.8, roofColor: '#d7663b', ang: 171.2, ft: 1 },  // terrace
  106082812: { wall: '#e9e8e2', floors: 1, fh: 3.1, roof: 'gable', rh: 4.8, roofColor: '#d7663b', ang: 171.3, ft: 1 },  // terrace
  106082556: { wall: '#e3d2bc', floors: 1, fh: 3.1, roof: 'gable', rh: 4.8, roofColor: '#d7663b', ang: 171.1, ft: 1 },  // terrace
  106082540: { wall: '#e9e8e2', floors: 1, fh: 3.1, roof: 'gable', rh: 4.8, roofColor: '#d7663b', ang: 172.4, ft: 1 },  // terrace
  106082916: { wall: '#d6ccb8', floors: 2, fh: 2.9, roof: 'hip', rh: 3.0, roofColor: '#7a7470', roofMat: 'grey', ang: 173.8, ft: 1 },  // beige cube
  106082736: { wall: '#bdb9b2', floors: 2, fh: 2.9, roof: 'hip', rh: 3.0, roofColor: '#6a6664', roofMat: 'grey', ang: 173.5, ft: 1 },  // grey cube
  106082638: { wall: '#cbb8a0', floors: 2, fh: 2.9, roof: 'hip', rh: 3.0, roofColor: '#6e6a66', roofMat: 'grey', ang: 173.3, ft: 1 },  // beige cube, balconies
  106082457: { wall: '#e6a262', floors: 2, fh: 2.9, roof: 'hip', rh: 3.0, roofColor: '#8a8c8e', roofMat: 'grey', ang: 172.7, ft: 1 },  // apricot cube, grey metal hip roof
  106082809: { wall: '#cfc3ad', floors: 2, fh: 2.9, roof: 'hip', rh: 3.0, roofColor: '#7a7470', roofMat: 'grey', ang: 172.9, ft: 1 },  // beige cube
  106082629: { wall: '#b8b6ae', eave: 5.5, roof: 'gable', rh: 3.9, roofColor: '#8e4a38', ft: 1 },  // old grey rough-plaster hall, eave 5.5, two chimneys
  106082476: { wall: '#d2c3a8', floors: 1, fh: 3.0, roof: 'hip', rh: 3.9, roofColor: '#6e4a3e', ang: 174.3, ft: 1 },  // beige bungalow, block fence red gate
  608455875: { wall: '#e6dfd0', floors: 2, fh: 2.9, roof: 'gable', rh: 3.6, roofColor: '#b8452f', ang: 173.4, ft: 1 },  // cream 2-storey, brick ground floor
  106082454: { wall: '#d8cbb4', floors: 1, fh: 3.0, roof: 'gable', rh: 3.9, roofColor: '#7a5044', ang: 174.6, ft: 1 },  // beige
  61002822: { wall: '#e38b74', floors: 1, fh: 3.1, roof: 'gable', rh: 4.8, roofColor: '#5e4238', ang: 105, ft: 1 },  // salmon, dormers
  61000102: { wall: '#bcc4cc', floors: 1, fh: 3.0, roof: 'gable', rh: 3.9, roofColor: '#9c4a36', ang: 100 },  // grey-blue café, timber fence, yellow umbrellas
  60999250: { wall: '#eba796', floors: 1, fh: 3.0, roof: 'gable', rh: 3.9, roofColor: '#b8503a', ang: 105.3, ft: 1 },  // pink
  60997058: { wall: '#dcdfd4', floors: 2, fh: 2.9, roof: 'gable', rh: 3.6, roofColor: '#3d3e40', ang: 116.3, ft: 1 },  // civic, dark roof with big dormers
  60997289: { wall: '#c05848', floors: 1, fh: 3.1, roof: 'gable', rh: 4.8, roofColor: '#b04a36', ft: 1 },  // terracotta, gable to street, skylights
  60998242: { wall: '#cfc6b6', floors: 1, fh: 3.1, roof: 'gable', rh: 4.8, roofColor: '#6e5a4e', ang: 105.1, ft: 1 },  // beige, garage, mural fence
  61000081: { wall: '#e6e2d6', floors: 1, fh: 3.0, roof: 'gable', rh: 3.9, roofColor: '#b8503a', ang: 105.1, ft: 1 },  // cream single storey
  61001978: { wall: '#ece8df', floors: 1, fh: 3.0, roof: 'gable', rh: 3.9, roofColor: '#c85a3c', ang: 105.3, ft: 1 },  // white single storey, brown gate
  60999710: { wall: '#e8e8e4', floors: 1, fh: 3.1, roof: 'gable', rh: 4.8, roofColor: '#3a3c40', roofMat: 'grey', ang: 104.9, ft: 1 },  // modern white + dark stone cladding, dormers
  60998142: { wall: '#e4d4bc', floors: 1, fh: 3.0, roof: 'gable', rh: 3.9, roofColor: '#7a5a4c', ang: 105.3, ft: 1 },  // beige
  61000473: { wall: '#eeece6', floors: 1, fh: 3.1, roof: 'gable', rh: 4.8, roofColor: '#b04a34', ang: 99.2, ft: 1 },  // white + brick-slip section, skylights, brown garage door
  60997527: { wall: '#e6e4de', floors: 1, fh: 3.0, roof: 'gable', rh: 3.9, roofColor: '#a84a36', ang: 97, ft: 1 },  // white single storey, brown garage door
  61000366: { wall: '#d9cfc2', floors: 1, fh: 3.0, roof: 'gable', rh: 3.9, roofColor: '#a85038', ang: 97.2, ft: 1 },  // old peeling plaster, red double door
  61000658: { wall: '#e6e2da', floors: 1, fh: 3.0, roof: 'gable', rh: 3.9, roofColor: '#7a4e40', ang: 99, ft: 1 },  // white outbuilding
  60998967: { wall: '#efefec', eave: 4.0, roof: 'gable', rh: 3.9, roofColor: '#6a5a50', ang: 101.7 },  // Brčkov pub, white, eave 4
  60998585: { wall: '#c4704e', floors: 1, fh: 3.0, roof: 'gable', rh: 3.9, roofColor: '#3c3d40', roofMat: 'grey', ang: 98.6, ft: 1 },  // new brick house under construction, dark roof
  61004181: { wall: '#e0a8a6', floors: 2, fh: 2.9, roof: 'gable', rh: 3.6, roofColor: '#4e4442', ang: 101.4, ft: 1 },  // pink 2-storey, brick base
  60997248: { wall: '#e08a48', floors: 1, fh: 3.0, roof: 'hip', rh: 3.9, roofColor: '#6a4638', ang: 101.6, ft: 1 },  // orange, brick-slip fence
  61001219: { wall: '#dccab0', floors: 1, fh: 3.1, roof: 'gable', rh: 4.8, roofColor: '#4a3c36', ang: 113.7, ft: 1 },  // beige, dormers
  60997047: { wall: '#e8e6e0', floors: 1, fh: 3.0, roof: 'gable', rh: 3.9, roofColor: '#b0503a', ang: 103.5, ft: 1 },  // white behind grey block fence
  60999108: { wall: '#e4d8c0', floors: 2, fh: 2.9, roof: 'gable', rh: 3.6, roofColor: '#b0503a', ang: 103.2, ft: 1 },  // beige 2-storey behind gate
  60997014: { wall: '#eeeae0', floors: 1, fh: 3.0, roof: 'gable', rh: 3.9, roofColor: '#a84a36', ang: 103.9, ft: 1 },  // (not seen)
};

// asphalt loop of the traffic playground (inset of the OSM outline) and the cross drives between the loops
const LOOP = [[539.8, 52.4], [542.0, 57.3], [547.8, 59.5], [558.7, 55.3], [563.0, 46.6], [564.0, 41.2], [560.2, 29.3], [568.8, 21.6], [573.8, 16.1], [585.4, -22.4], [585.0, -26.7], [580.2, -39.0], [581.4, -50.8], [592.3, -61.3], [593.9, -67.5], [539.2, -176.8], [533.5, -178.9], [522.6, -170.8], [513.4, -170.6], [505.4, -168.9], [502.3, -164.1], [502.7, -157.7], [504.9, -155.0], [511.5, -152.6], [514.7, -153.5], [521.8, -160.1], [532.8, -162.7], [542.7, -156.5], [544.1, -144.7], [544.6, -140.4], [559.9, -116.3], [562.0, -110.7], [561.6, -86.8], [564.4, -80.6], [567.0, -79.1], [577.4, -79.9], [584.6, -74.7], [581.6, -65.8], [573.0, -56.0], [570.4, -51.1], [562.1, -27.2], [548.3, 23.5]];
const lots = {
  ribbons: [
    { pts: LOOP, w: 4.5, closed: true, m: 'asphalt', c: '#5d5d5a' },
    { pts: [[561.6, -86.8], [566, -60], [574, -35], [566, -5], [556, 30]], w: 4.0, m: 'asphalt', c: '#5d5d5a' },
    { pts: [[544.6, -140.4], [548, -165], [539.2, -176.8]], w: 4.0, m: 'asphalt', c: '#5d5d5a' },
  ],
};

export default {
  name: 'Jednoradová, Horská, Mýtna',
  id: 'jednoradova',
  spawn: [590, -128, 0.45],
  looks,
  lots,
  areaKinds: [{ p: [575, -40], from: 'track', kind: 'grass' }],
  fences: [
    { road: 'Mýtna', box: [520, -222, 600, -112], off: -9.5, h: 1.4, type: 'mesh' },
    { road: 'Jednoradová', box: [570, -108, 620, 62], off: -7.5, h: 1.4, type: 'mesh' },
  ],
};
