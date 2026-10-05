"""
Prépare la vraie 3D de Montereau pour l'ouverture et le chapitre « Nous trouver » (exécuté par GitHub Actions).
Sources IGN (Géoplateforme, Licence ouverte Etalab 2.0) :
  - MNS (modèle numérique de surface, bâtiments et arbres compris) : ELEVATION.ELEVATIONGRIDCOVERAGE.HIGHRES.MNS
  - orthophotographies : ORTHOIMAGERY.ORTHOPHOTOS
Repère : Lambert-93, origine au pavillon ; x = E - E0 (est), z = N0 - N (sud), y = altitude - altitude du pavillon.
Sorties (v5/assets/ign/) :
  dsm-<zone>.png  : altitudes en décimètres au-dessus de « base », codées R = poids fort, G = poids faible
  ortho-<zone>-<i><j>.jpg (+ -m.jpg demi-résolution pour mobile)
  zones.json      : emprises, pas, base, tuiles
"""
import json, os, io, time, urllib.request, urllib.parse
import numpy as np
from PIL import Image
from pyproj import Transformer

ROOT = os.path.dirname(__file__)
OUT = os.path.join(ROOT, '..', '..', 'v5', 'assets', 'ign'); os.makedirs(OUT, exist_ok=True)
LAT, LON = 48.3969801, 2.9569157
E0, N0 = Transformer.from_crs('EPSG:4326', 'EPSG:2154', always_xy=True).transform(LON, LAT)

def get(q, tries=4):
    url = 'https://data.geopf.fr/wms-r/wms?' + urllib.parse.urlencode(q)
    for k in range(tries):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'digitale-academie-montereau/1.0'})
            with urllib.request.urlopen(req, timeout=180) as r: return r.read()
        except Exception as e:
            print('retry', k, e, flush=True); time.sleep(3 + 5 * k)
    raise RuntimeError('échec ' + url)

def wms(layer, x0, z0, x1, z1, w, h, fmt):
    # x0..x1 (est), z0..z1 (sud) en repère local -> bbox Lambert-93 (E min, N min, E max, N max)
    bbox = f'{E0 + x0},{N0 - z1},{E0 + x1},{N0 - z0}'
    return get({'SERVICE': 'WMS', 'VERSION': '1.3.0', 'REQUEST': 'GetMap', 'LAYERS': layer, 'STYLES': '', 'CRS': 'EPSG:2154',
                'BBOX': bbox, 'WIDTH': w, 'HEIGHT': h, 'FORMAT': fmt})

def dsm(x0, z0, x1, z1, step, chunk=1000):
    W, H = int(round((x1 - x0) / step)), int(round((z1 - z0) / step))
    A = np.zeros((H, W), np.float32)
    for j in range(0, H, chunk):
        for i in range(0, W, chunk):
            w, h = min(chunk, W - i), min(chunk, H - j)
            b = wms('ELEVATION.ELEVATIONGRIDCOVERAGE.HIGHRES.MNS', x0 + i * step, z0 + j * step, x0 + (i + w) * step, z0 + (j + h) * step, w, h, 'image/x-bil;bits=32')
            A[j:j + h, i:i + w] = np.frombuffer(b, '<f4').reshape(h, w)
            print('mns', i, j, flush=True)
    bad = A < -100
    if bad.any():
        from scipy import ndimage
        idx = ndimage.distance_transform_edt(bad, return_distances=False, return_indices=True)
        A = A[tuple(idx)]
    return A

def ortho(name, x0, z0, x1, z1, n, px):
    tiles = []
    tw, th = (x1 - x0) / n, (z1 - z0) / n
    for j in range(n):
        for i in range(n):
            b = wms('ORTHOIMAGERY.ORTHOPHOTOS', x0 + i * tw, z0 + j * th, x0 + (i + 1) * tw, z0 + (j + 1) * th, px, px, 'image/jpeg')
            im = Image.open(io.BytesIO(b)).convert('RGB')
            f = f'ortho-{name}-{j}{i}'
            im.save(os.path.join(OUT, f + '.jpg'), quality=84, optimize=True, progressive=True)
            im.resize((px // 2, px // 2), Image.LANCZOS).save(os.path.join(OUT, f + '-m.jpg'), quality=82, optimize=True, progressive=True)
            tiles.append({'f': f, 'i': i, 'j': j, 'rect': [x0 + i * tw, z0 + j * th, x0 + (i + 1) * tw, z0 + (j + 1) * th]})
            print('ortho', f, flush=True)
    return tiles

ZONES = {
    # la ville survolée : de la vieille ville (au sud-ouest) au pavillon, 3 × 3 km
    'ville': dict(rect=[-1700, -800, 1300, 2200], step=2.0, n=3, px=2000),
    # Surville autour du pavillon : 800 × 800 m
    'pav': dict(rect=[-400, -400, 400, 400], step=1.0, n=2, px=2000),
}
meta = {'src': 'IGN — MNS (LiDAR HD / RGE ALTI) et BD ORTHO, Licence ouverte Etalab 2.0', 'origin_l93': [E0, N0], 'zones': {}}
alt0 = None
for name, Z in ZONES.items():
    x0, z0, x1, z1 = Z['rect']
    A = dsm(x0, z0, x1, z1, Z['step'])
    if alt0 is None:
        H = A.shape; alt0 = float(A[int((0 - z0) / Z['step']), int((0 - x0) / Z['step'])])   # sol du pavillon (approximatif, MNS)
    base = float(np.floor(A.min()))
    q = np.clip(np.round((A - base) * 10), 0, 65535).astype(np.uint16)
    rgb = np.zeros(q.shape + (3,), np.uint8); rgb[..., 0] = q >> 8; rgb[..., 1] = q & 255
    Image.fromarray(rgb).save(os.path.join(OUT, f'dsm-{name}.png'), optimize=True)
    tiles = ortho(name, x0, z0, x1, z1, Z['n'], Z['px'])
    meta['zones'][name] = {'rect': Z['rect'], 'step': Z['step'], 'w': int(q.shape[1]), 'h': int(q.shape[0]), 'base': base, 'tiles': tiles}
    print(name, A.shape, A.min(), A.max(), flush=True)
meta['alt0'] = alt0
json.dump(meta, open(os.path.join(OUT, 'zones.json'), 'w'), indent=1)
print('ok', meta['alt0'])
