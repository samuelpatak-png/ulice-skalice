"""Pack Radiance .hdr files into two lossless PNGs (RGBE: mantissa RGB + exponent grey) so any static host serves them.
Decode: c = (m + 0.5) * 2^(E - 136)   (E = 0 -> black)."""
import os, glob
import numpy as np, cv2
from PIL import Image
D = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'public', 'assets', 'hdri')
for f in sorted(glob.glob(os.path.join(D, '*.hdr'))):
    img = cv2.imread(f, cv2.IMREAD_ANYDEPTH | cv2.IMREAD_COLOR)[:, :, ::-1].astype(np.float64)
    mx = img.max(axis=2)
    mant, ex = np.frexp(mx)
    ok = mx > 1e-32
    scale = np.where(ok, mant * 256.0 / np.where(ok, mx, 1), 0)
    rgb = np.clip(np.floor(img * scale[..., None]), 0, 255).astype(np.uint8)
    E = np.where(ok, np.clip(ex + 128, 0, 255), 0).astype(np.uint8)
    k = os.path.splitext(os.path.basename(f))[0]
    Image.fromarray(rgb, 'RGB').save(os.path.join(D, f'{k}_rgbe.png'), optimize=True)
    Image.fromarray(E, 'L').save(os.path.join(D, f'{k}_exp.png'), optimize=True)
    dec = (rgb.astype(np.float64) + 0.5) * np.power(2.0, E.astype(np.float64) - 136)[..., None] * ok[..., None]
    err = np.abs(dec - img).max() / max(img.max(), 1e-9)
    print(k, img.shape, 'max rel err', round(float(err), 5), os.path.getsize(os.path.join(D, f'{k}_rgbe.png')) // 1024, 'KB')
