"""Download CC0 assets from Poly Haven (textures + HDRIs) and pack them for the game.

Textures -> public/assets/tex/<id>_a.webp  (albedo RGB + ambient occlusion in A)
            public/assets/tex/<id>_n.webp  (OpenGL normal RGB + roughness in A)
HDRIs    -> public/assets/hdri/<id>.hdr     (1k, image based lighting)
            public/assets/hdri/<id>.jpg     (4k tonemapped background)
            public/assets/hdri/meta.json    (sun direction / colour per HDRI)
All Poly Haven assets are CC0 (https://polyhaven.com/license).
"""
import json, os, sys, urllib.request, math
import numpy as np
import cv2
from PIL import Image

UA = {'User-Agent': 'ulice-skalice-builder/1.0 (+asset pipeline)'}
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'assets_src')
OUT_T = os.path.join(ROOT, 'public', 'assets', 'tex')
OUT_H = os.path.join(ROOT, 'public', 'assets', 'hdri')
os.makedirs(SRC, exist_ok=True); os.makedirs(OUT_T, exist_ok=True); os.makedirs(OUT_H, exist_ok=True)

# layer order == material ids used in the shader (keep in sync with src/world/materials.js)
TEXTURES = [
    'asphalt_02',                  # 0 road asphalt
    'patterned_concrete_pavers',   # 1 sidewalk pavers
    'cobblestone_floor_08',        # 2 granite setts (old town)
    'plastered_wall_02',           # 3 smooth plaster (tinted)
    'white_plaster_rough_01',      # 4 rough plaster (tinted)
    'clay_roof_tiles_02',          # 5 clay roof tiles
    'grey_roof_tiles',             # 6 grey roof tiles
    'leafy_grass',                 # 7 grass
    'precast_concrete_wall',       # 8 concrete panels
    'corrugated_iron_02',          # 9 corrugated metal
    'rectangular_facade_tiles',    # 10 facade cladding
    'red_brick',                   # 11 brick
    'bark_brown_02',               # 12 bark
    'tarred_gravel',               # 13 flat roof gravel
    'rustic_stone_wall',           # 14 stone (city walls)
    'forest_leaves_02',            # 15 forest floor
    'asphalt_06',                  # 16 light asphalt (parking)
    'gravel_road',                 # 17 dirt / gravel track
]
HDRIS = {
    'day': 'kloofendal_48d_partly_cloudy_puresky',
    'sunset': 'qwantani_sunset_puresky',
    'dusk': 'qwantani_moonrise_puresky',
    'night': 'qwantani_night_puresky',
}

def get_json(url):
    return json.load(urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=120))

def download(url, path):
    if os.path.exists(path) and os.path.getsize(path) > 1000:
        return path
    data = urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=300).read()
    open(path, 'wb').write(data)
    return path

# Textures whose photo has vertical board joints (plasterboard panels) that read as siding on a rendered house:
# id -> number of equally spaced joints across the tile. They are painted out by copying a nearby strip of the same rows.
JOINTS = {'plastered_wall_02': 4}

def dejoint(img, n):
    a = np.asarray(img).astype(np.float32); W = a.shape[1]
    half, feather, shift = int(math.ceil(0.0137 * W)), max(2, W // 256), int(0.045 * W)
    out = a.copy()
    for j in range(n):
        c = int(round((j / n + 0.0015) * W))
        for dx in range(-half - feather, half + feather + 1):
            x, xs = (c + dx) % W, (c + dx + shift) % W
            t = 1.0 if abs(dx) <= half else 1.0 - (abs(dx) - half) / (feather + 1)
            out[:, x] = a[:, x] * (1 - t) + a[:, xs] * t
    return Image.fromarray(np.clip(out + 0.5, 0, 255).astype(np.uint8), img.mode)

def process_texture(tid, size):
    files = get_json('https://api.polyhaven.com/files/' + tid)
    res = '1k' if size <= 1024 else '2k'
    diff = download(files['Diffuse'][res]['jpg']['url'], os.path.join(SRC, f'{tid}_diff.jpg'))
    nor = download(files['nor_gl'][res]['jpg']['url'], os.path.join(SRC, f'{tid}_nor.jpg'))
    arm = download(files['arm'][res]['jpg']['url'], os.path.join(SRC, f'{tid}_arm.jpg'))
    d = Image.open(diff).convert('RGB').resize((size, size), Image.LANCZOS)
    a = Image.open(arm).convert('RGB').resize((size, size), Image.LANCZOS)
    n = Image.open(nor).convert('RGB').resize((size, size), Image.LANCZOS)
    ao, rough, metal = a.split()
    A = Image.merge('RGBA', (*d.split(), ao))
    N = Image.merge('RGBA', (*n.split(), rough))
    if tid in JOINTS: A, N = dejoint(A, JOINTS[tid]), dejoint(N, JOINTS[tid])
    pa, pn = os.path.join(OUT_T, f'{tid}_a.webp'), os.path.join(OUT_T, f'{tid}_n.webp')
    if not os.path.exists(pa): A.save(pa, 'WEBP', quality=84, method=4)
    if not os.path.exists(pn): N.save(pn, 'WEBP', quality=88, method=4)
    m = np.asarray(metal, dtype=np.float32).mean() / 255.0
    return {'id': tid, 'metal': round(float(m), 3)}

def process_hdri(key, hid):
    files = get_json('https://api.polyhaven.com/files/' + hid)
    hdr = download(files['hdri']['1k']['hdr']['url'], os.path.join(OUT_H, f'{key}.hdr'))
    tm = download(files['tonemapped']['url'], os.path.join(SRC, f'{hid}_tm.jpg'))
    if not os.path.exists(os.path.join(OUT_H, f'{key}.jpg')):
        im = Image.open(tm).convert('RGB')
        im.draft('RGB', (4096, 2048))
        im = im.resize((4096, 2048), Image.BICUBIC)
        im.save(os.path.join(OUT_H, f'{key}.jpg'), 'JPEG', quality=84, optimize=True, progressive=True)
    # sun: brightest region of the HDR (equirect, u=0 at -x? three maps u=0.5 to -z)
    img = cv2.imread(hdr, cv2.IMREAD_ANYDEPTH | cv2.IMREAD_COLOR)[:, :, ::-1]
    lum = img[..., 0] * 0.2126 + img[..., 1] * 0.7152 + img[..., 2] * 0.0722
    h, w = lum.shape
    blur = cv2.GaussianBlur(lum, (0, 0), 3)
    y, x = np.unravel_index(np.argmax(blur[: h // 2]), blur[: h // 2].shape)
    u, v = (x + 0.5) / w, (y + 0.5) / h
    # three.js equirect: direction -> uv: u = atan(dir.z, dir.x) / (2pi) + 0.5, v = asin(dir.y)/pi + 0.5 (v up)
    phi = (u - 0.5) * 2 * math.pi
    theta = (0.5 - v) * math.pi
    d = [math.cos(theta) * math.cos(phi), math.sin(theta), math.cos(theta) * math.sin(phi)]
    col = img[max(0, y - 2):y + 3, max(0, x - 2):x + 3].reshape(-1, 3).mean(0)
    col = (col / max(col.max(), 1e-6)).tolist()
    avg = img[: h // 2].reshape(-1, 3).mean(0).tolist()
    horizon = img[int(h * 0.47):int(h * 0.5)].reshape(-1, 3).mean(0).tolist()
    return {'key': key, 'id': hid, 'sunDir': d, 'sunColor': col, 'peak': float(blur[y, x]), 'skyAvg': avg, 'horizon': horizon}

if __name__ == '__main__':
    tex_meta = []
    for i, t in enumerate(TEXTURES):
        print('texture', i, t, flush=True)
        tex_meta.append(process_texture(t, 1024))
    hdr_meta = {}
    for k, h in HDRIS.items():
        print('hdri', k, h, flush=True)
        hdr_meta[k] = process_hdri(k, h)
    json.dump({'textures': tex_meta, 'hdri': hdr_meta}, open(os.path.join(ROOT, 'public', 'assets', 'meta.json'), 'w'), indent=1)
    # water normals (three.js examples, MIT)
    download('https://raw.githubusercontent.com/mrdoob/three.js/r169/examples/textures/waternormals.jpg', os.path.join(ROOT, 'public', 'assets', 'tex', 'waternormals.jpg'))
    print('done')
