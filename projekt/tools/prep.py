"""Preprocess OSM data of Skalica into a compact game data file."""
import json, math, random, hashlib, base64, gzip, collections
import numpy as np
from PIL import Image, ImageDraw

random.seed(7)
SRC = 'data/osm_compact.json'
d = json.load(open(SRC))
LAT0 = 48.8446; LON0 = 17.2266
KX = 111320 * math.cos(math.radians(LAT0)); KY = 110540
X0, Z0, X1, Z1 = -2300, -1800, 2400, 2700   # crop box (x east, z south)

def xy(g):
    return [(g[i] / 1e6 * KX, -g[i + 1] / 1e6 * KY) for i in range(0, len(g), 2) if g[i] is not None]

def h01(*a):
    s = hashlib.md5(('|'.join(map(str, a))).encode()).digest()
    return int.from_bytes(s[:4], 'little') / 2**32

def area_signed(p):
    return sum(p[i][0] * p[(i + 1) % len(p)][1] - p[(i + 1) % len(p)][0] * p[i][1] for i in range(len(p))) / 2

def centroid(p):
    return (sum(a for a, b in p) / len(p), sum(b for a, b in p) / len(p))

def inbox(p, m=0):
    return any(X0 - m < x < X1 + m and Z0 - m < z < Z1 + m for x, z in p)

def clean_ring(p, tol=0.12):
    if len(p) > 1 and p[0] == p[-1]:
        p = p[:-1]
    # remove duplicates
    q = []
    for v in p:
        if not q or math.hypot(v[0] - q[-1][0], v[1] - q[-1][1]) > 0.05:
            q.append(v)
    if len(q) > 1 and math.hypot(q[0][0] - q[-1][0], q[0][1] - q[-1][1]) < 0.05:
        q.pop()
    # remove collinear
    changed = True
    while changed and len(q) > 3:
        changed = False
        for i in range(len(q)):
            a, b, c = q[i - 1], q[i], q[(i + 1) % len(q)]
            abx, abz = c[0] - a[0], c[1] - a[1]
            L = math.hypot(abx, abz)
            if L < 1e-6:
                q.pop(i); changed = True; break
            dist = abs((b[0] - a[0]) * abz - (b[1] - a[1]) * abx) / L
            if dist < tol:
                q.pop(i); changed = True; break
    return q

def clip_rect(poly, x0, z0, x1, z1):
    def clip(poly, inside, inter):
        out = []
        for i in range(len(poly)):
            cur, prev = poly[i], poly[i - 1]
            if inside(cur):
                if not inside(prev):
                    out.append(inter(prev, cur))
                out.append(cur)
            elif inside(prev):
                out.append(inter(prev, cur))
        return out
    def ix(xc):
        return lambda a, b: (xc, a[1] + (b[1] - a[1]) * (xc - a[0]) / (b[0] - a[0]))
    def iz(zc):
        return lambda a, b: (a[0] + (b[0] - a[0]) * (zc - a[1]) / (b[1] - a[1]), zc)
    p = poly
    for inside, inter in ((lambda v: v[0] >= x0, ix(x0)), (lambda v: v[0] <= x1, ix(x1)),
                          (lambda v: v[1] >= z0, iz(z0)), (lambda v: v[1] <= z1, iz(z1))):
        if not p: break
        p = clip(p, inside, inter)
    return p

def obb(p):
    """min-area rectangle angle via edge directions. returns (angle, w, l)"""
    best = None
    for i in range(len(p)):
        a, b = p[i], p[(i + 1) % len(p)]
        ang = math.atan2(b[1] - a[1], b[0] - a[0])
        c, s = math.cos(ang), math.sin(ang)
        us = [x * c + z * s for x, z in p]; vs = [-x * s + z * c for x, z in p]
        w, l = max(us) - min(us), max(vs) - min(vs)
        ar = w * l
        if best is None or ar < best[0] - 1e-6:
            best = (ar, ang, w, l)
    ar, ang, w, l = best
    if l > w:  # make angle along long axis
        ang += math.pi / 2; w, l = l, w
    ang = (ang + math.pi) % math.pi
    return ang, w, l, ar

def q(v):  # to decimeters int
    return int(round(v * 10))

def enc_pts(p):
    """delta encoded decimeter ints"""
    out = []; px = pz = 0
    for x, z in p:
        ix, iz = q(x), q(z)
        out += [ix - px, iz - pz]; px, pz = ix, iz
    return out

# ---------------------------------------------------------------- landuse polygons
area_kinds = {}
AREAS = []  # (kind, outer, holes)

def classify_area(tg):
    lu = tg.get('landuse'); le = tg.get('leisure'); na = tg.get('natural'); am = tg.get('amenity')
    if na == 'water' or lu in ('reservoir', 'basin'):
        return 'water'
    if tg.get('area:highway') or (tg.get('highway') == 'pedestrian' and tg.get('area') == 'yes') or tg.get('place') == 'square':
        return 'plaza'
    if am == 'parking':
        return 'parking'
    if le == 'golf_course': return 'golf'
    if le in ('pitch',): return 'pitch'
    if le in ('track',): return 'track'
    if le in ('park', 'garden'): return 'park'
    if le in ('playground',): return 'playground'
    if le in ('stadium', 'sports_centre'): return 'sports'
    if le == 'swimming_pool': return 'pool'
    if lu in ('forest',) or na == 'wood': return 'forest'
    if na in ('scrub', 'heath'): return 'scrub'
    if na == 'wetland': return 'wetland'
    if lu == 'vineyard': return 'vineyard'
    if lu == 'orchard': return 'orchard'
    if lu in ('farmland',): return 'farmland'
    if lu in ('meadow', 'grass', 'village_green', 'recreation_ground', 'flowerbed') : return 'grass'
    if lu in ('cemetery',) or am == 'grave_yard': return 'cemetery'
    if lu in ('allotments',): return 'allotments'
    if lu in ('industrial', 'railway', 'construction', 'brownfield'): return 'industrial'
    if lu in ('retail', 'commercial'): return 'retail'
    if lu in ('residential',): return 'residential'
    if lu in ('farmyard', 'greenhouse_horticulture'): return 'farmyard'
    if am in ('school', 'kindergarten', 'hospital', 'college'): return 'campus'
    return None

for e in d:
    tg = e.get('tg') or {}
    if tg.get('building') or tg.get('boundary'):
        continue
    k = classify_area(tg)
    if not k:
        continue
    if e['t'] == 'w':
        p = xy(e['g'])
        if len(p) < 4 or p[0] != p[-1]:
            if not (len(p) >= 4 and math.hypot(p[0][0]-p[-1][0], p[0][1]-p[-1][1]) < 0.5):
                continue
        if not inbox(p): continue
        p = clean_ring(p, 0.2)
        p = clip_rect(p, X0, Z0, X1, Z1)
        if len(p) >= 3 and abs(area_signed(p)) > 4:
            AREAS.append((k, p, [], e['id']))
    elif e['t'] == 'r':
        # stitch outer members into rings
        def stitch(members):
            segs = [xy(m['g']) for m in members]
            rings = []
            while segs:
                cur = segs.pop(0)
                changed = True
                while changed and math.hypot(cur[0][0]-cur[-1][0], cur[0][1]-cur[-1][1]) > 0.5:
                    changed = False
                    for i, s in enumerate(segs):
                        if math.hypot(s[0][0]-cur[-1][0], s[0][1]-cur[-1][1]) < 0.5:
                            cur = cur + s[1:]; segs.pop(i); changed = True; break
                        if math.hypot(s[-1][0]-cur[-1][0], s[-1][1]-cur[-1][1]) < 0.5:
                            cur = cur + s[::-1][1:]; segs.pop(i); changed = True; break
                rings.append(cur)
            return rings
        outers = stitch([m for m in e['m'] if m['r'] in ('outer', '')])
        inners = stitch([m for m in e['m'] if m['r'] == 'inner'])
        for o in outers:
            if not inbox(o): continue
            o = clip_rect(clean_ring(o, 0.3), X0, Z0, X1, Z1)
            if len(o) < 3 or abs(area_signed(o)) < 4: continue
            hs = []
            for inn in inners:
                inn = clean_ring(inn, 0.3)
                if len(inn) >= 3 and inbox(inn):
                    c = centroid(inn)
                    hs.append(clip_rect(inn, X0, Z0, X1, Z1))
            AREAS.append((k, o, [h for h in hs if len(h) >= 3], e['id']))

print('areas', collections.Counter(a[0] for a in AREAS))

def point_in_poly(x, z, p):
    inside = False
    j = len(p) - 1
    for i in range(len(p)):
        xi, zi = p[i]; xj, zj = p[j]
        if ((zi > z) != (zj > z)) and (x < (xj - xi) * (z - zi) / (zj - zi + 1e-12) + xi):
            inside = not inside
        j = i
    return inside

industrial_polys = [a[1] for a in AREAS if a[0] in ('industrial',)]
retail_polys = [a[1] for a in AREAS if a[0] in ('retail',)]

# ---------------------------------------------------------------- roads
ROAD_W = {'trunk': 9, 'primary': 8.5, 'secondary': 8, 'tertiary': 7, 'residential': 6, 'unclassified': 5.5,
          'living_street': 5, 'service': 3.6, 'pedestrian': 5, 'track': 3, 'footway': 2, 'path': 1.4,
          'cycleway': 2.2, 'steps': 2, 'bridleway': 2, 'road': 5, 'construction': 5}
ROAD_K = {'secondary': 1, 'tertiary': 1, 'primary': 1, 'trunk': 1, 'residential': 2, 'unclassified': 2, 'living_street': 3,
          'road': 2, 'service': 4, 'pedestrian': 5, 'track': 6, 'footway': 7, 'path': 8, 'cycleway': 9, 'steps': 10, 'bridleway': 8,
          'construction': 2}
names = []
name_idx = {}
def nid(n):
    if n is None: return -1
    if n not in name_idx:
        name_idx[n] = len(names); names.append(n)
    return name_idx[n]

ROADS = []
for e in d:
    tg = e.get('tg') or {}
    hw = tg.get('highway')
    if e['t'] != 'w' or not hw or hw not in ROAD_W: continue
    if tg.get('area') == 'yes': continue
    p = xy(e['g'])
    if len(p) < 2 or not inbox(p, 50): continue
    w = ROAD_W[hw]
    if hw == 'service' and tg.get('service') in ('parking_aisle',): w = 5
    if hw == 'service' and tg.get('service') in ('driveway',): w = 3
    try:
        if 'width' in tg: w = max(1.2, min(14, float(tg['width'].replace(',', '.').split()[0])))
    except Exception: pass
    if hw in ('secondary', 'tertiary') and tg.get('lanes') == '4': w = 13
    kind = ROAD_K[hw]
    fw = tg.get('footway')
    if hw == 'footway' and fw == 'crossing': kind = 11
    if hw == 'cycleway' and tg.get('cycleway') == 'crossing': kind = 11
    surf = tg.get('surface', '')
    if hw == 'track' and surf in ('asphalt', 'paved', 'concrete'): kind = 4
    if hw in ('footway', 'path') and surf in ('dirt', 'ground', 'grass', 'gravel', 'fine_gravel', 'unpaved', 'compacted'): kind = 8
    cobble = surf in ('sett', 'paving_stones', 'cobblestone', 'unhewn_cobblestone')
    bridge = 1 if tg.get('bridge') and tg.get('bridge') != 'no' else 0
    tunnel = 1 if tg.get('tunnel') and tg.get('tunnel') != 'no' else 0
    oneway = 1 if tg.get('oneway') == 'yes' else 0
    ROADS.append({'p': p, 'w': w, 'k': kind, 'hw': hw, 'n': nid(tg.get('name')), 'b': bridge, 't': tunnel, 'c': 1 if cobble else 0, 'o': oneway, 'id': e['id']})

# pedestrian areas as plazas already in AREAS
print('roads', len(ROADS), collections.Counter(r['hw'] for r in ROADS).most_common())

# ---------------------------------------------------------------- linear features
LINES = []  # kind, points, width/height
for e in d:
    tg = e.get('tg') or {}
    if e['t'] != 'w': continue
    p = xy(e['g'])
    if len(p) < 2 or not inbox(p, 20): continue
    if tg.get('railway') in ('rail', 'light_rail', 'disused', 'abandoned') and tg.get('railway') == 'rail':
        LINES.append(('rail', p, 0, tg.get('service', '')))
    elif tg.get('waterway') in ('stream', 'river', 'canal', 'ditch', 'drain'):
        w = {'river': 14, 'canal': 8, 'stream': 3, 'ditch': 1.6, 'drain': 1.6}[tg['waterway']]
        if tg.get('tunnel') or tg.get('layer', '0').startswith('-'):
            continue
        LINES.append(('water', p, w, ''))
    elif tg.get('barrier') == 'city_wall':
        LINES.append(('citywall', p, 0.8 if (tg.get('ruins') == 'yes' or tg.get('area') == 'yes') else 1.4, ''))
    elif tg.get('barrier') in ('wall', 'retaining_wall'):
        LINES.append(('wall', p, 0.4, ''))
    elif tg.get('barrier') in ('fence',):
        LINES.append(('fence', p, 0.1, ''))
    elif tg.get('natural') == 'tree_row':
        LINES.append(('treerow', p, 0, ''))
    elif tg.get('barrier') == 'hedge':
        LINES.append(('hedge', p, 1.0, ''))
print('lines', collections.Counter(l[0] for l in LINES))

# ---------------------------------------------------------------- buildings
OLD_C = (170, -190)
def old_town(x, z):
    return math.hypot(x - OLD_C[0], (z - OLD_C[1]) * 1.1) < 330

BUILD = []
POIS = []
for e in d:
    tg = e.get('tg') or {}
    if e['t'] == 'n':
        continue
    b = tg.get('building')
    if not b or b == 'no': continue
    if e['t'] == 'w':
        p = xy(e['g'])
        holes = []
    else:
        outs = [xy(m['g']) for m in e['m'] if m['r'] == 'outer']
        if not outs: continue
        p = max(outs, key=lambda r: abs(area_signed(r)))
        holes = [xy(m['g']) for m in e['m'] if m['r'] == 'inner']
    if len(p) < 4 or not inbox(p): continue
    p = clean_ring(p, 0.12)
    if len(p) < 3: continue
    A = area_signed(p)
    if A < 0:  # make CCW in (x,z) math sense -> we want consistent orientation
        p = p[::-1]; A = -A
    if A < 4: continue
    holes = [clean_ring(h, 0.12) for h in holes]
    holes = [h if area_signed(h) < 0 else h[::-1] for h in holes if len(h) >= 3]
    cx, cz = centroid(p)
    ang, L, W, obbA = obb(p)
    rect = A / max(obbA, 1e-6)
    name = tg.get('name', '')
    hid = h01(e['id'])
    hid2 = h01(e['id'], 'b')
    hid3 = h01(e['id'], 'c')
    ot = old_town(cx, cz)
    ind = any(point_in_poly(cx, cz, ip) for ip in industrial_polys)
    ret = any(point_in_poly(cx, cz, rp) for rp in retail_polys)
    levels = None
    try:
        if 'building:levels' in tg: levels = float(tg['building:levels'])
    except Exception: pass
    height = None
    try:
        if 'height' in tg: height = float(tg['height'].split()[0])
    except Exception: pass

    # categories: 0 house, 1 oldtown, 2 panel, 3 garage, 4 industrial, 5 commercial/retail, 6 church, 7 civic, 8 shed, 9 greenhouse, 10 roof(carport), 11 tower
    cat = 0; eave = 3; roof = 'flat'; pitch = 35; floor_h = 3.0
    if b in ('garage', 'garages', 'carport'):
        cat = 3; eave = 2.6 + hid * 0.3; roof = 'flat'
    elif b == 'roof':
        cat = 10; eave = 3.2; roof = 'flat'
    elif b in ('church', 'chapel', 'synagogue') or tg.get('amenity') == 'place_of_worship':
        cat = 6
        if b == 'chapel' or A < 90:
            eave = 4.5; roof = 'gable'; pitch = 50
        else:
            eave = 11 if A > 350 else 8; roof = 'gable'; pitch = 52
    elif tg.get('man_made') == 'tower':
        cat = 11; eave = 24; roof = 'pyramid'; pitch = 70
    elif b == 'greenhouse':
        cat = 9; eave = 3.2; roof = 'gable'; pitch = 25
    elif b == 'apartments':
        cat = 2
        compact = (L / max(W, 1)) < 1.6
        if compact and 180 < A < 700 and hid < 0.35:
            fl = 8
        elif L > 55:
            fl = 4 if hid < 0.6 else 5
        else:
            fl = 4 if hid < 0.55 else (3 if hid < 0.75 else 5)
        if A < 180: fl = 3
        floor_h = 2.8; eave = fl * floor_h + 0.6; roof = 'flat'
    elif b in ('industrial', 'manufacture', 'warehouse') or (ind and A > 250):
        cat = 4; eave = 8 + hid * 4 if A > 800 else 5 + hid * 2; roof = 'flat'
    elif b in ('retail', 'commercial', 'supermarket') or (ret and A > 300):
        cat = 5; eave = 7.5 if A > 1500 else 5.5; roof = 'flat'
    elif b in ('hospital',):
        cat = 7; eave = 4 * 3.3 if A > 400 else 2 * 3.3; roof = 'flat'
    elif b in ('school', 'kindergarten', 'public', 'office', 'train_station', 'civic', 'government', 'college'):
        cat = 7; eave = (2 if b == 'kindergarten' else 3) * 3.4; roof = 'hip' if A < 900 else 'flat'; pitch = 25
    elif b in ('farm_auxiliary', 'barn', 'shed', 'hut', 'cabin'):
        cat = 8; eave = 3 if A > 40 else 2.4; roof = 'gable'; pitch = 30
    else:  # yes / house / detached ...
        if A < 22:
            cat = 8; eave = 2.3; roof = 'flat' if hid < 0.5 else 'gable'; pitch = 25
        elif A < 55:
            cat = 8 if not ot else 1
            eave = 2.8; roof = 'gable' if hid < 0.7 else 'flat'; pitch = 32
        elif ot:
            cat = 1; floor_h = 3.7
            fl = 2 if A > 90 else 1
            if A > 450 and hid < 0.4: fl = 3
            eave = fl * floor_h + 0.4; roof = 'gable' if rect > 0.72 or A < 400 else 'hip'; pitch = 42
        elif A < 260:
            cat = 0
            fl = 1 if hid < 0.55 else 2
            eave = fl * 3.0 + 0.5
            roof = 'hip' if hid2 < 0.45 else 'gable'
            pitch = 32 + hid3 * 12 if fl == 1 else 28 + hid3 * 8
            if hid3 > 0.93: roof = 'flat'
        elif A < 900:
            if ind:
                cat = 4; eave = 6; roof = 'flat'
            else:
                cat = 7 if A > 450 else 0
                eave = 2 * 3.2 + 0.5 if A < 450 else 3 * 3.3
                roof = 'hip' if (hid2 < 0.5 and rect > 0.8) else 'flat'; pitch = 25
        else:
            if ind or cz < -300 and cx < -400:
                cat = 4; eave = 9 + hid * 3; roof = 'flat'
            else:
                cat = 5 if A > 2500 else 7; eave = 8 if A > 2500 else 3 * 3.3; roof = 'flat'
    if levels:
        eave = levels * (floor_h if cat != 1 else 3.6) + 0.4
    if height:
        eave = max(2, height * (0.75 if roof != 'flat' else 1.0))
    if rect < 0.55 and roof in ('gable', 'hip') and cat not in (6,):
        roof = 'hip'
    # roof ridge: gable/hip half-width W/2, roof height = tan(pitch)*W/2, capped
    rh = 0
    if roof in ('gable', 'hip', 'pyramid'):
        rh = math.tan(math.radians(pitch)) * W / 2
        cap = {6: 16, 11: 18}.get(cat, 6.5)
        rh = min(rh, cap)
    BUILD.append({'id': e['id'], 'p': p, 'holes': holes, 'A': A, 'c': (cx, cz), 'ang': ang, 'L': L, 'W': W, 'cat': cat,
                  'eave': eave, 'roof': roof, 'rh': rh, 'name': name, 'tg': tg, 'ot': ot, 'hid': hid, 'hid2': hid2})

print('buildings', len(BUILD), collections.Counter(b['cat'] for b in BUILD))

# ---------------------------------------------------------------- spatial grid for buildings
G = 40
grid = collections.defaultdict(list)
for i, bd in enumerate(BUILD):
    xs = [a for a, b in bd['p']]; zs = [b for a, b in bd['p']]
    for gx in range(int(math.floor(min(xs) / G)), int(math.floor(max(xs) / G)) + 1):
        for gz in range(int(math.floor(min(zs) / G)), int(math.floor(max(zs) / G)) + 1):
            grid[(gx, gz)].append(i)

def building_at(x, z):
    for i in grid.get((int(math.floor(x / G)), int(math.floor(z / G))), []):
        if point_in_poly(x, z, BUILD[i]['p']):
            return i
    return None

def nearest_building(x, z, maxd=25):
    best = None
    for gx in range(int(math.floor((x - maxd) / G)), int(math.floor((x + maxd) / G)) + 1):
        for gz in range(int(math.floor((z - maxd) / G)), int(math.floor((z + maxd) / G)) + 1):
            for i in grid.get((gx, gz), []):
                p = BUILD[i]['p']
                for k in range(len(p)):
                    a, b = p[k], p[(k + 1) % len(p)]
                    dd = seg_dist(x, z, a, b)
                    if best is None or dd < best[0]:
                        best = (dd, i)
    return best

def seg_dist(x, z, a, b):
    vx, vz = b[0] - a[0], b[1] - a[1]
    L2 = vx * vx + vz * vz
    t = 0 if L2 < 1e-9 else max(0, min(1, ((x - a[0]) * vx + (z - a[1]) * vz) / L2))
    px, pz = a[0] + t * vx, a[1] + t * vz
    return math.hypot(x - px, z - pz)

# road grid for facing computations
RG = 50
rgrid = collections.defaultdict(list)
for ri, r in enumerate(ROADS):
    p = r['p']
    for k in range(len(p) - 1):
        a, b = p[k], p[k + 1]
        for gx in range(int(math.floor(min(a[0], b[0]) / RG)), int(math.floor(max(a[0], b[0]) / RG)) + 1):
            for gz in range(int(math.floor(min(a[1], b[1]) / RG)), int(math.floor(max(a[1], b[1]) / RG)) + 1):
                rgrid[(gx, gz)].append((ri, k))

def nearest_road(x, z, maxd=80, kinds=(1, 2, 3, 4, 5)):
    best = None
    for gx in range(int(math.floor((x - maxd) / RG)), int(math.floor((x + maxd) / RG)) + 1):
        for gz in range(int(math.floor((z - maxd) / RG)), int(math.floor((z + maxd) / RG)) + 1):
            for ri, k in rgrid.get((gx, gz), []):
                r = ROADS[ri]
                if r['k'] not in kinds: continue
                dd = seg_dist(x, z, r['p'][k], r['p'][k + 1])
                if best is None or dd < best[0]:
                    best = (dd, ri, k)
    return best

# ---------------------------------------------------------------- POIs and signs
POI_KEYS = ('shop', 'amenity', 'tourism', 'historic', 'office', 'craft', 'leisure')
for e in d:
    tg = e.get('tg') or {}
    if e['t'] != 'n': continue
    name = tg.get('name') or tg.get('brand')
    if not name: continue
    kind = None
    for k in POI_KEYS:
        if k in tg: kind = k + ':' + tg[k]; break
    if not kind: continue
    x, z = xy(e['g'])[0]
    if not (X0 < x < X1 and Z0 < z < Z1): continue
    if kind.startswith('tourism:information') and tg.get('information') in ('guidepost', 'board', 'map', 'route_marker'):
        continue
    POIS.append({'x': x, 'z': z, 'n': name, 'k': kind, 'brand': tg.get('brand', ''), 'tg': tg})
# polygon POIs
for bi, bd in enumerate(BUILD):
    tg = bd['tg']
    if bd['name'] and any(k in tg for k in POI_KEYS):
        kind = next(k + ':' + tg[k] for k in POI_KEYS if k in tg)
        POIS.append({'x': bd['c'][0], 'z': bd['c'][1], 'n': bd['name'], 'k': kind, 'brand': tg.get('brand', ''), 'tg': tg, 'bi': bi})
for e in d:  # area POIs (not buildings)
    tg = e.get('tg') or {}
    if e['t'] == 'w' and not tg.get('building') and tg.get('name') and (tg.get('shop') or tg.get('amenity') in ('marketplace', 'bus_station', 'hospital', 'school') or tg.get('leisure') in ('stadium', 'park', 'golf_course')):
        p = xy(e['g']); c = centroid(p)
        if X0 < c[0] < X1 and Z0 < c[1] < Z1:
            kind = 'shop:' + tg['shop'] if tg.get('shop') else ('amenity:' + tg['amenity'] if tg.get('amenity') else 'leisure:' + tg['leisure'])
            POIS.append({'x': c[0], 'z': c[1], 'n': tg['name'], 'k': kind, 'brand': tg.get('brand', ''), 'tg': tg})
print('pois', len(POIS))

# sign styles for known brands (plain text; colours only)
BRAND = {
    'Kaufland': ('Kaufland', '#ffffff', '#d4121c', 1),
    'Tesco': ('TESCO', '#ffffff', '#e2231a', 1),
    'OC Max': ('MAX', '#1c4fa0', '#ffffff', 1),
    'Lidl': ('LIDL', '#ffe500', '#0050aa', 1),
    'Billa': ('BILLA', '#ffe600', '#d7141a', 1),
    'COOP Jednota': ('COOP Jednota', '#ffffff', '#1b8a3a', 1),
    'dm': ('dm drogerie markt', '#ffffff', '#1d3c8f', 1),
    'Cinemax Skalica': ('CINEMAX', '#1d1d1d', '#ffcc00', 1),
    'Slovnaft': ('SLOVNAFT', '#ffffff', '#1a3d8f', 1),
    'OMV': ('OMV', '#ffffff', '#0a4a8f', 1),
    'Sportisimo': ('SPORTISIMO', '#e30613', '#ffffff', 1),
    'NAY': ('NAY', '#ffffff', '#e2001a', 1),
    'Dr. Max': ('Dr.Max', '#ffffff', '#00843d', 0),
    'TEDi': ('TEDi', '#ffdd00', '#1a3a8a', 1),
    'Sinsay': ('Sinsay', '#ffffff', '#111111', 1),
    'SUPER ZOO': ('SUPER ZOO', '#ffffff', '#00a651', 1),
    'PLANEO Elektro': ('PLANEO', '#ffffff', '#e30613', 1),
    'Dráčik': ('Dráčik', '#ffffff', '#e4007c', 1),
    'Gate': ('GATE', '#111111', '#ffffff', 1),
    '101 Drogerie': ('101 Drogerie', '#ffffff', '#e2007a', 0),
    'Fresh Corner': ('Fresh Corner', '#ffffff', '#2d8b3a', 0),
    'Viva': ('Viva', '#ffffff', '#d7141a', 0),
    'Tatra banka': ('Tatra banka', '#ffffff', '#1d1d1b', 0),
    'Slovenská sporiteľňa': ('Slovenská sporiteľňa', '#ffffff', '#2870ed', 0),
    'Všeobecná úverová banka': ('VÚB banka', '#ffffff', '#e2231a', 0),
    'ČSOB': ('ČSOB', '#ffffff', '#003b75', 0),
    'Prima banka': ('Prima banka', '#ffffff', '#e2001a', 0),
    'UniCredit Bank': ('UniCredit', '#ffffff', '#e2001a', 0),
    '365.bank': ('365.bank', '#ffffff', '#7b3fe4', 0),
    'Orange': ('orange', '#000000', '#ff7900', 0),
    'Benu': ('BENU Lekáreň', '#ffffff', '#00833e', 0),
    'Niké': ('NIKÉ', '#ffffff', '#1e1e1e', 0),
    'Hotel Tatran': ('Hotel Tatran', '#2b2b2b', '#f3e5c0', 0),
    'Hotel sv.Michal': ('Hotel sv. Michal', '#2b2b2b', '#f3e5c0', 0),
    'Hílek': ('ŠKODA  Hílek', '#ffffff', '#0e3a2f', 0),
}

SIGNS = []
used_sign_building = collections.Counter()
for po in POIS:
    x, z = po['x'], po['z']
    bi = po.get('bi')
    if bi is None:
        bi = building_at(x, z)
    if bi is None:
        nb = nearest_building(x, z, 12)
        if nb and nb[0] < 8: bi = nb[1]
    po['bi'] = bi
    k = po['k']
    if bi is None: continue
    if k.split(':')[0] not in ('shop', 'amenity', 'tourism', 'office', 'craft'): continue
    if k in ('amenity:place_of_worship', 'amenity:school', 'amenity:kindergarten', 'amenity:hospital', 'tourism:information', 'amenity:parking', 'amenity:bench', 'amenity:waste_basket'):
        continue
    bd = BUILD[bi]
    # choose wall facing nearest road; among walls, prefer the one closest to the POI and facing road
    nr = nearest_road(x, z, 120)
    p = bd['p']
    best = None
    for kk in range(len(p)):
        a, b = p[kk], p[(kk + 1) % len(p)]
        L = math.hypot(b[0] - a[0], b[1] - a[1])
        if L < 2.2: continue
        mx, mz = (a[0] + b[0]) / 2, (a[1] + b[1]) / 2
        # outward normal: polygon CCW in (x, z) with z south... compute via area sign: p is positive-area in x,z coords
        nx, nz = (b[1] - a[1]) / L, -(b[0] - a[0]) / L
        # check outward: point slightly along normal must be outside
        if point_in_poly(mx + nx * 0.5, mz + nz * 0.5, p):
            nx, nz = -nx, -nz
        score = 0
        if nr:
            rr = ROADS[nr[1]]; ra, rb = rr['p'][nr[2]], rr['p'][nr[2] + 1]
            rd = seg_dist(mx + nx * 3, mz + nz * 3, ra, rb) - seg_dist(mx, mz, ra, rb)
            score += rd * 3  # negative if moving toward road
        score += math.hypot(mx - x, mz - z) * 0.6
        score -= min(L, 30) * 0.2
        if best is None or score < best[0]:
            best = (score, kk, mx, mz, nx, nz, L)
    if not best: continue
    _, kk, mx, mz, nx, nz, L = best
    name = po['n']
    style = None
    for key, st in BRAND.items():
        if name == key or po['brand'] == key or (key in name and len(key) > 3):
            style = st; break
    big = 0
    txt = name
    if style:
        txt, fg, bg, big = style
    else:
        fg, bg = '#2b2926', '#f4ecd8'
        if k.startswith('amenity:pharmacy'): fg, bg = '#ffffff', '#1f8a4c'
        elif k.startswith('amenity:bank'): fg, bg = '#ffffff', '#27466e'
        elif k.startswith(('amenity:restaurant', 'amenity:cafe', 'amenity:pub', 'amenity:bar', 'amenity:fast_food')): fg, bg = '#f8efd9', '#6a3b2a'
        elif k.startswith('shop:bakery') or k.startswith('shop:pastry'): fg, bg = '#5a3312', '#f3dfb5'
        elif k.startswith('shop:wine'): fg, bg = '#f6e9d2', '#6d1f2e'
    idx = used_sign_building[bi]
    used_sign_building[bi] += 1
    if big:
        hh = 2.8 if bd['eave'] >= 7 else 2.0
        if len(txt) > 10: hh *= 0.8
        y = max(bd['eave'] - hh / 2 - 0.6, 3.4)
        wdt = min(L * 0.85, max(7, len(txt) * hh * 0.78))
    else:
        y = 2.9 if bd['eave'] > 4 else max(1.9, bd['eave'] - 0.8)
        wdt = min(L * 0.8, max(1.6, len(txt) * 0.26 + 0.6))
        hh = 0.55
    # shift along wall for multiple signs on same wall
    a, b = p[kk], p[(kk + 1) % len(p)]
    tx, tz = (b[0] - a[0]) / L, (b[1] - a[1]) / L
    # position: project POI onto wall
    t = max(wdt / 2, min(L - wdt / 2, (x - a[0]) * tx + (z - a[1]) * tz))
    if big: t = L / 2
    sx, sz = a[0] + tx * t + nx * 0.12, a[1] + tz * t + nz * 0.12
    SIGNS.append({'x': sx, 'z': sz, 'nx': nx, 'nz': nz, 'y': y + (idx % 2) * (0 if big else 0.7), 'w': wdt, 'h': hh, 't': txt, 'fg': fg, 'bg': bg, 'big': big, 'bi': bi})
print('signs', len(SIGNS))

# mark buildings with shops -> commercial facade
shop_buildings = set(s['bi'] for s in SIGNS)

# ---------------------------------------------------------------- landmark specific overrides
LM = {}
for bi, bd in enumerate(BUILD):
    n = bd['name']
    if n == 'Kostol sv. Michala archanjela': LM['michal'] = bi
    elif n == 'Kostol sv. Františka Xaverského' and bd['c'][1] < 0: LM['jezuiti'] = bi
    elif n == 'Kostol Sedembolestnej Panny Márie' and bd['cat'] == 6: LM['frantiskani'] = bi
    elif n == 'Evanjelický a. v. kostol': LM['evanjelici'] = bi
    elif n == 'Kostol Najsvätejšej Trojice': LM['trojica'] = bi
    elif n == 'Rotunda sv. Juraja': LM['rotunda'] = bi
    elif n == 'Kostol Povýšenia sv. Kríža': LM['kriz'] = bi
    elif n == 'Kostol sv. Pavla pustovníka': LM['pavol'] = bi
    elif n == 'Kostol sv. Urbana': LM['urban'] = bi
    elif n == 'Karner sv. Anny': LM['karner'] = bi
    elif n == 'OC Max': LM['max'] = bi
    elif n == 'Mestský úrad': LM['urad'] = bi
    elif n == 'Stará radnica - Ratúz': LM['ratuz'] = bi
    elif n == 'Synagóga': LM['synagoga'] = bi
# Kultúrny dom: building at POI
for po in POIS:
    if po['n'] == 'Kultúrny dom' and po.get('bi') is not None: LM['kd'] = po['bi']
    if po['n'] == 'Záhorske múzeum' and po.get('bi') is not None: LM['muzeum'] = po['bi']
    if po['n'] == 'Kaufland' and po.get('bi') is not None: LM['kaufland'] = po['bi']
    if po['n'] == 'Tesco' and po.get('bi') is not None: LM['tesco'] = po['bi']
    if po['n'] == 'Lidl' and po.get('bi') is not None: LM['lidl'] = po['bi']
    if po['n'] == 'Billa' and po.get('bi') is not None: LM['billa'] = po['bi']
    if po['n'] == 'Fakultná nemocnica Agel Skalica' and po.get('bi') is not None: LM['nemocnica'] = po['bi']
print('landmarks', {k: (BUILD[v]['name'], [round(c) for c in BUILD[v]['c']], round(BUILD[v]['A'])) for k, v in LM.items()})

# tweak landmark heights
def setb(key, **kw):
    if key in LM: BUILD[LM[key]].update(kw)
setb('michal', eave=13, roof='gable', rh=11)
setb('jezuiti', eave=14, roof='gable', rh=9)
setb('frantiskani', eave=12, roof='gable', rh=8)
setb('evanjelici', eave=10, roof='hip', rh=6)
setb('trojica', eave=10, roof='gable', rh=7)
setb('rotunda', eave=6.5, roof='cone', rh=5)
setb('karner', eave=4.5, roof='cone', rh=4.5)
setb('kd', eave=8, roof='gable', rh=7.5, cat=12)
setb('urad', eave=8, roof='hip', rh=4, cat=1)
setb('ratuz', eave=7.5, roof='gable', rh=5, cat=1)
if 'max' in LM: BUILD[LM['max']].update(eave=11, roof='flat', cat=5)
for key in ('kaufland', 'tesco', 'lidl', 'billa'):
    if key in LM: BUILD[LM[key]].update(roof='flat', cat=5, eave=7.5 if key in ('kaufland', 'tesco') else 5.5)

# ---------------------------------------------------------------- colours
# palettes (indexes into JS palette arrays)
WALL = {
    'old': ['#f1e6c8', '#ecd08e', '#f2dd9e', '#ebbfa4', '#d6e0bd', '#f5f0e4', '#efcfc9', '#cfd8d6', '#e9c27c', '#f0d9b5'],
    'house': ['#f3efe5', '#e8dcc2', '#dcd9d1', '#efe3b7', '#eac9b0', '#f0e8d8', '#d9cdb5', '#e3e6dd', '#f1d7a8', '#cfd6cf'],
    'panel': ['#cfe0bf', '#efc4ae', '#eee0bd', '#c6d8e3', '#f1e3a6', '#e0cfe0', '#d8d4c8'],
    'garage': ['#c9c5bb', '#bdb9ae', '#d4d0c6'],
    'ind': ['#d9dcdc', '#c2cfdb', '#d8d2c2', '#b8c4c9', '#e2e0da'],
    'comm': ['#eceae4', '#dfe3e6', '#e9e2d3'],
    'church': ['#efe4c9', '#f4efe3', '#eedb9d'],
    'civic': ['#efe3c4', '#e7d8b8', '#e5e9e3', '#f1dfae'],
}
ROOFC = {
    'old': ['#b5543b', '#a5472f', '#9a4a36', '#c0613f', '#8e4a3a', '#6e6660'],
    'house': ['#5c5a58', '#7a4b35', '#a9493a', '#3f4346', '#8d5a3c', '#b35d3f', '#6b3f33'],
    'flat': ['#9d9a93', '#8f8c86', '#a9a59c'],
    'church': ['#8f4032', '#5d6d64', '#7d3a2e'],
}
PAL = []
pal_idx = {}
def col(c):
    if c not in pal_idx:
        pal_idx[c] = len(PAL); PAL.append(c)
    return pal_idx[c]

def pick(lst, h):
    return lst[int(h * len(lst)) % len(lst)]

FAC = {0: 1, 1: 2, 2: 3, 3: 0, 4: 5, 5: 7, 6: 6, 7: 4, 8: 0, 9: 8, 10: 0, 11: 6, 12: 9}
out_b = []
for bi, bd in enumerate(BUILD):
    cat = bd['cat']; h = bd['hid']; h2 = bd['hid2']
    if cat == 1: w = pick(WALL['old'], h); r = pick(ROOFC['old'], h2)
    elif cat == 0: w = pick(WALL['house'], h); r = pick(ROOFC['house'], h2)
    elif cat == 2: w = pick(WALL['panel'], h); r = pick(ROOFC['flat'], h2)
    elif cat == 3: w = pick(WALL['garage'], h); r = '#7b7873'
    elif cat == 4: w = pick(WALL['ind'], h); r = pick(ROOFC['flat'], h2)
    elif cat == 5: w = pick(WALL['comm'], h); r = pick(ROOFC['flat'], h2)
    elif cat in (6, 11): w = pick(WALL['church'], h); r = pick(ROOFC['church'], h2)
    elif cat == 7: w = pick(WALL['civic'], h); r = pick(ROOFC['old'], h2) if bd['roof'] != 'flat' else pick(ROOFC['flat'], h2)
    elif cat == 8: w = pick(WALL['house'], h); r = pick(ROOFC['house'], h2)
    elif cat == 9: w = '#dfeee8'; r = '#e8f2ee'
    elif cat == 10: w = '#c9c5bb'; r = '#8d8a84'
    elif cat == 12: w = '#f0c94a'; r = '#7c4a2e'
    else: w = '#eeeeee'; r = '#999999'
    if bd['roof'] == 'flat' and cat in (0, 1, 7, 8): r = pick(ROOFC['flat'], h2)
    fac = FAC.get(cat, 1)
    if bi in shop_buildings and cat in (0, 1, 7): fac = 4
    # special colours
    if 'max' in LM and bi == LM['max']: w = '#2c5ea8'
    if 'kaufland' in LM and bi == LM['kaufland']: w = '#e4e6e8'
    if 'tesco' in LM and bi == LM['tesco']: w = '#6f777b'
    if 'lidl' in LM and bi == LM['lidl']: w = '#e9e7e2'
    if 'michal' in LM and bi == LM['michal']: w = '#e8d6ad'; r = '#8a3e2e'
    if 'rotunda' in LM and bi == LM['rotunda']: w = '#e9e1cf'; r = '#6b5a4a'
    roofcode = {'flat': 0, 'gable': 1, 'hip': 2, 'pyramid': 3, 'cone': 4}[bd['roof']]
    out_b.append([enc_pts(bd['p']), q(bd['eave']), roofcode, q(bd['rh']), round(math.degrees(bd['ang'])) % 180,
                  col(w), col(r), fac, cat, [enc_pts(hh) for hh in bd['holes'] if len(hh) >= 3], bd['id']])

# ---------------------------------------------------------------- trees (raster sampling at 1 m)
RES = 1.0
Wd, Hd = int((X1 - X0) / RES), int((Z1 - Z0) / RES)
def to_px(p):
    return [((x - X0) / RES, (z - Z0) / RES) for x, z in p]
bmask = Image.new('L', (Wd, Hd), 0); bdraw = ImageDraw.Draw(bmask)
for bd in BUILD:
    bdraw.polygon(to_px(bd['p']), fill=255)
rmask = Image.new('L', (Wd, Hd), 0); rdraw = ImageDraw.Draw(rmask)
for r in ROADS:
    w = r['w'] + (5 if r['k'] in (1, 2, 3) else 1.5)
    rdraw.line(to_px(r['p']), fill=255, width=max(1, int(w / RES)), joint='curve')
for kind, p, w, _ in LINES:
    if kind in ('rail', 'water', 'citywall'):
        rdraw.line(to_px(p), fill=255, width=max(2, int((w + 4) / RES)))
amask = {}
def area_mask(kinds):
    m = Image.new('L', (Wd, Hd), 0); dr = ImageDraw.Draw(m)
    for k, p, holes, _ in AREAS:
        if k in kinds:
            dr.polygon(to_px(p), fill=255)
            for hh in holes: dr.polygon(to_px(hh), fill=0)
    return np.array(m) > 0
no_tree = area_mask({'parking', 'pitch', 'track', 'water', 'plaza', 'pool', 'sports', 'industrial', 'retail', 'farmland', 'golf', 'vineyard'})
forest = area_mask({'forest'})
parkm = area_mask({'park', 'cemetery', 'grass', 'playground', 'campus'})
orchard = area_mask({'orchard', 'allotments'})
scrub = area_mask({'scrub', 'wetland'})
golf = area_mask({'golf'})
B = np.array(bmask) > 0; R = np.array(rmask) > 0
# distance-ish: dilate buildings to find "residential" zone (within 45 m of buildings)
from PIL import ImageFilter
def dilate(m, r):
    im = Image.fromarray((m * 255).astype(np.uint8))
    for _ in range(r):
        im = im.filter(ImageFilter.MaxFilter(3))
    return np.array(im) > 0
near_b = np.array(Image.fromarray((B * 255).astype(np.uint8)).resize((Wd // 5, Hd // 5), Image.BILINEAR)) > 0
near_b_small = dilate(near_b, 8)  # 8*5 = 40 m
near_b = np.array(Image.fromarray((near_b_small * 255).astype(np.uint8)).resize((Wd, Hd), Image.NEAREST)) > 0
bclear = dilate(B, 2)
blocked = bclear | R | no_tree
TREES = []
def sample(mask, spacing, prob, kind_fn):
    rng = np.random.default_rng(int(spacing * 100 + prob * 1000))
    for gz in np.arange(0, Hd, spacing / RES):
        for gx in np.arange(0, Wd, spacing / RES):
            if rng.random() > prob: continue
            px = gx + rng.random() * spacing / RES; pz = gz + rng.random() * spacing / RES
            ix, iz = int(px), int(pz)
            if ix >= Wd or iz >= Hd: continue
            if mask[iz, ix] and not blocked[iz, ix]:
                x = X0 + px * RES; z = Z0 + pz * RES
                TREES.append((x, z, kind_fn(rng)))
# kinds: 0 round deciduous, 1 conifer, 2 birch, 3 fruit (small), 4 poplar (tall narrow), 5 bush
gardens = near_b & ~forest & ~parkm
sample(gardens, 9.0, 0.42, lambda r: 3 if r.random() < 0.45 else (0 if r.random() < 0.6 else (1 if r.random() < 0.5 else (2 if r.random() < 0.5 else 5))))
sample(parkm, 11.0, 0.55, lambda r: 0 if r.random() < 0.6 else (2 if r.random() < 0.4 else (1 if r.random() < 0.5 else 4)))
sample(forest, 8.5, 0.8, lambda r: 0 if r.random() < 0.75 else 1)
sample(orchard, 7.0, 0.7, lambda r: 3)
sample(scrub, 9.0, 0.5, lambda r: 5 if r.random() < 0.6 else 0)
sample(golf, 45.0, 0.5, lambda r: 0)
# open countryside sparse
countryside = ~near_b & ~forest & ~parkm & ~orchard & ~golf
sample(countryside, 60.0, 0.12, lambda r: 0 if r.random() < 0.7 else 4)
# tree rows
for kind, p, w, _ in LINES:
    if kind == 'treerow':
        for k in range(len(p) - 1):
            a, b = p[k], p[k + 1]; L = math.hypot(b[0] - a[0], b[1] - a[1])
            n = max(1, int(L / 8))
            for i in range(n):
                t = (i + 0.5) / n; TREES.append((a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, 0))
# street trees on selected residential/tertiary roads in town
for r in ROADS:
    if r['k'] not in (1, 2) or r['n'] < 0: continue
    hsel = h01(r['n'], 'st')
    if hsel > 0.4: continue
    p = r['p']; off = r['w'] / 2 + 2.6
    tkind = 0 if hsel < 0.25 else 4
    for k in range(len(p) - 1):
        a, b = p[k], p[k + 1]; L = math.hypot(b[0] - a[0], b[1] - a[1])
        if L < 4: continue
        nx, nz = -(b[1] - a[1]) / L, (b[0] - a[0]) / L
        n = int(L / 13)
        for i in range(n):
            t = (i + 0.5) / max(n, 1)
            for side in (1, -1):
                x = a[0] + (b[0] - a[0]) * t + nx * off * side; z = a[1] + (b[1] - a[1]) * t + nz * off * side
                ix, iz = int((x - X0) / RES), int((z - Z0) / RES)
                if 0 <= ix < Wd and 0 <= iz < Hd and near_b[iz, ix] and not bclear[iz, ix] and not no_tree[iz, ix]:
                    TREES.append((x, z, tkind))
# explicit OSM trees
for e in d:
    tg = e.get('tg') or {}
    if e['t'] == 'n' and tg.get('natural') == 'tree':
        x, z = xy(e['g'])[0]
        if X0 < x < X1 and Z0 < z < Z1: TREES.append((x, z, 0))
print('trees', len(TREES), collections.Counter(t[2] for t in TREES))

# ---------------------------------------------------------------- parked cars in parking lots
CARS = []
for k, p, holes, aid in AREAS:
    if k != 'parking': continue
    A = abs(area_signed(p))
    if A < 60 or A > 20000: continue
    ang, L, W, _ = obb(p)
    c, s = math.cos(ang), math.sin(ang)
    cx, cz = centroid(p)
    # rows along long axis every 6 m, car slots 2.6 m
    n_rows = max(1, int(W / 5.5))
    for ri in range(n_rows):
        v = -W / 2 + (ri + 0.5) * W / n_rows
        n_slots = int(L / 2.7)
        for si in range(n_slots):
            u = -L / 2 + (si + 0.5) * 2.7
            if h01(aid, ri, si) > 0.32: continue
            x = cx + u * c - v * s; z = cz + u * s + v * c
            if not point_in_poly(x, z, p): continue
            ix, iz = int((x - X0) / RES), int((z - Z0) / RES)
            if not (0 <= ix < Wd and 0 <= iz < Hd) or B[iz, ix]: continue
            CARS.append((x, z, ang + math.pi / 2 + (math.pi if h01(aid, ri, si, 'f') < 0.5 else 0), int(h01(aid, ri, si, 'c') * 8)))
print('parked cars', len(CARS))

# ---------------------------------------------------------------- street lamps along urban roads
LAMPS = []
for r in ROADS:
    if r['k'] not in (1, 2, 3, 5): continue
    p = r['p']; off = r['w'] / 2 + 1.0
    acc = 0
    side = 1 if h01(r['id']) < 0.5 else -1
    for k in range(len(p) - 1):
        a, b = p[k], p[k + 1]; L = math.hypot(b[0] - a[0], b[1] - a[1])
        if L < 1e-3: continue
        nx, nz = -(b[1] - a[1]) / L, (b[0] - a[0]) / L
        t = 30 - acc
        while t < L:
            x = a[0] + (b[0] - a[0]) * t / L + nx * off * side; z = a[1] + (b[1] - a[1]) * t / L + nz * off * side
            ix, iz = int((x - X0) / RES), int((z - Z0) / RES)
            if 0 <= ix < Wd and 0 <= iz < Hd and near_b[iz, ix] and not B[iz, ix]:
                LAMPS.append((x, z, math.atan2(-nz * side, -nx * side)))
            t += 30
        acc = (acc + L) % 30
print('lamps', len(LAMPS))

# ---------------------------------------------------------------- chimneys
CHIM = []
for e in d:
    tg = e.get('tg') or {}
    if e['t'] == 'n' and tg.get('man_made') == 'chimney':
        x, z = xy(e['g'])[0]
        if X0 < x < X1 and Z0 < z < Z1:
            try: h = float(tg.get('height', '40'))
            except Exception: h = 40
            CHIM.append((x, z, h))
print('chimneys', CHIM)

# ---------------------------------------------------------------- output
AK = ['water', 'plaza', 'parking', 'golf', 'pitch', 'track', 'park', 'playground', 'sports', 'pool', 'forest', 'scrub', 'wetland',
      'vineyard', 'orchard', 'farmland', 'grass', 'cemetery', 'allotments', 'industrial', 'retail', 'residential', 'farmyard', 'campus']
out = {
    'origin': [LAT0, LON0], 'box': [X0, Z0, X1, Z1],
    'pal': PAL,
    'b': out_b,
    'r': [[enc_pts(r['p']), q(r['w']), r['k'], r['n'], r['b'], r['c'], r['o']] for r in ROADS],
    'names': names,
    'ak': AK,
    'a': [[AK.index(k), enc_pts(p), [enc_pts(h) for h in holes]] for k, p, holes, _ in AREAS],
    'l': [[['rail', 'water', 'citywall', 'wall', 'fence', 'treerow', 'hedge'].index(k), enc_pts(p), q(w)] for k, p, w, _ in LINES if k != 'treerow'],
    't': [v for x, z, k in TREES for v in (q(x), q(z), k)],
    'cars': [v for x, z, a, c in CARS for v in (q(x), q(z), int(math.degrees(a)) % 360, c)],
    'lamps': [v for x, z, a in LAMPS for v in (q(x), q(z), int(math.degrees(a)) % 360)],
    'signs': [[q(s['x']), q(s['z']), round(math.degrees(math.atan2(s['nx'], s['nz']))), q(s['y']), q(s['w']), q(s['h']), s['t'], s['fg'], s['bg'], s['big'], s['bi']] for s in SIGNS],
    'pois': [[q(p['x']), q(p['z']), p['n'], p['k']] for p in POIS],
    'lm': LM,
    'chim': [[q(x), q(z), q(h)] for x, z, h in CHIM],
}
js = json.dumps(out, ensure_ascii=False, separators=(',', ':'))
open('data/game.json', 'w').write(js)
gz = gzip.compress(js.encode('utf-8'), 9)
open('data/game.b64', 'w').write(base64.b64encode(gz).decode())
print('json', len(js), 'gz', len(gz), 'b64', len(base64.b64encode(gz)))
