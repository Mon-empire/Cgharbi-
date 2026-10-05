"""
La ville réelle, au détail près, sur 2 km autour du pavillon (exécuté par GitHub Actions).
Sources IGN (Géoplateforme, Licence ouverte Etalab 2.0) :
  - MNT  (sol nu, RGE ALTI)                : ELEVATION.ELEVATIONGRIDCOVERAGE.HIGHRES
  - MNS  (surface : bâtiments, arbres, ponts) : ELEVATION.ELEVATIONGRIDCOVERAGE.HIGHRES.MNS
  - BD TOPO bâtiments (emprises, hauteurs)  : WFS BDTOPO_V3:batiment
  - BD ORTHO                               : ORTHOIMAGERY.ORTHOPHOTOS (20 cm au cœur, 50 cm sur l'anneau)
Principe :
  - relief composite = MNS partout (arbres, ponts, talus) SAUF sous les bâtiments (MNT) : plus aucun bâtiment « fondu » ;
  - chaque bâtiment BD TOPO est extrudé à son emprise exacte ; son toit est relevé dans le MNS (grille de 1,25 m triangulée
    dans l'emprise) : pignons, croupes, toits-terrasses tels qu'ils sont ;
  - orthophotos en dalles avec marge (les toits qui débordent d'une dalle restent texturés).
Repère : Lambert-93, origine au pavillon ; x = E - E0 (est), z = N0 - N (sud), altitudes absolues (m).
Sorties (v5/assets/ville/) : relief-*.png, ortho-*.jpg, bati.bin + bati.json, ville.json
"""
import json, os, io, time, math, urllib.request, urllib.parse
import numpy as np
from PIL import Image, ImageDraw
from pyproj import Transformer

ROOT = os.path.dirname(__file__)
OUT = os.path.join(ROOT, '..', '..', 'v5', 'assets', 'ville'); os.makedirs(OUT, exist_ok=True)
LAT, LON = 48.3969801, 2.9569157
E0, N0 = Transformer.from_crs('EPSG:4326', 'EPSG:2154', always_xy=True).transform(LON, LAT)
UA = {'User-Agent': 'digitale-academie-montereau/1.0'}

def fetch(url, tries=5, timeout=240):
    for k in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=timeout) as r: return r.read()
        except Exception as e:
            print('retry', k, str(e)[:200], flush=True); time.sleep(4 + 6 * k)
    raise RuntimeError('échec ' + url[:300])

def wms(layer, x0, z0, x1, z1, w, h, fmt):
    q = {'SERVICE': 'WMS', 'VERSION': '1.3.0', 'REQUEST': 'GetMap', 'LAYERS': layer, 'STYLES': '', 'CRS': 'EPSG:2154',
         'BBOX': f'{E0 + x0},{N0 - z1},{E0 + x1},{N0 - z0}', 'WIDTH': w, 'HEIGHT': h, 'FORMAT': fmt}
    return fetch('https://data.geopf.fr/wms-r/wms?' + urllib.parse.urlencode(q))

def grid(layer, rect, step, chunk=1000):
    x0, z0, x1, z1 = rect
    W, H = int(round((x1 - x0) / step)), int(round((z1 - z0) / step))
    A = np.zeros((H, W), np.float32)
    for j in range(0, H, chunk):
        for i in range(0, W, chunk):
            w, h = min(chunk, W - i), min(chunk, H - j)
            b = wms(layer, x0 + i * step, z0 + j * step, x0 + (i + w) * step, z0 + (j + h) * step, w, h, 'image/x-bil;bits=32')
            A[j:j + h, i:i + w] = np.frombuffer(b, '<f4').reshape(h, w)
        print(layer, j, flush=True)
    bad = A < -100
    if bad.any():
        from scipy import ndimage
        idx = ndimage.distance_transform_edt(bad, return_distances=False, return_indices=True)
        A = A[tuple(idx)]
    return A

# ---------------------------------------------------------------- emprises
RING = [-2000, -2000, 2000, 2400]     # 2 km autour du pavillon, prolongé au sud jusqu'à la gare et la vieille ville
CORE = [-640, -640, 640, 640]          # Surville autour du pavillon
STEP_R, STEP_C = 2.0, 0.5

# ---------------------------------------------------------------- bâtiments BD TOPO
def wfs_batiments(rect):
    x0, z0, x1, z1 = rect
    bbox = f'{E0 + x0},{N0 - z1},{E0 + x1},{N0 - z0},EPSG:2154'
    feats, start = [], 0
    while True:
        q = {'SERVICE': 'WFS', 'VERSION': '2.0.0', 'REQUEST': 'GetFeature', 'TYPENAMES': 'BDTOPO_V3:batiment', 'SRSNAME': 'EPSG:2154',
             'BBOX': bbox, 'OUTPUTFORMAT': 'application/json', 'COUNT': 5000, 'STARTINDEX': start}
        d = json.loads(fetch('https://data.geopf.fr/wfs/ows?' + urllib.parse.urlencode(q)))
        f = d.get('features', []); feats += f; print('bâtiments', len(feats), flush=True)
        if len(f) < 5000: break
        start += 5000
    return feats

feats = wfs_batiments(RING)
print('propriétés exemple', json.dumps(feats[0]['properties'], ensure_ascii=False)[:600] if feats else None, flush=True)

def rings_of(geom):
    t, c = geom['type'], geom['coordinates']
    polys = [c] if t == 'Polygon' else c if t == 'MultiPolygon' else []
    return [p[0] for p in polys if p and len(p[0]) >= 4]   # anneau extérieur seulement

blds = []
for f in feats:
    pr = f['properties']
    for r in rings_of(f['geometry']):
        pts = [(E - E0, N0 - N) for E, N, *rest in r]
        if pts[0] == pts[-1]: pts = pts[:-1]
        if len(pts) < 3: continue
        blds.append({'pts': pts, 'h': pr.get('hauteur'), 'sol': pr.get('altitude_minimale_sol'), 'tmin': pr.get('altitude_minimale_toit'),
                     'tmax': pr.get('altitude_maximale_toit'), 'nature': pr.get('nature'), 'usage': pr.get('usage_1'), 'id': pr.get('cleabs')})
print(len(blds), 'emprises', flush=True)

# ---------------------------------------------------------------- relief : MNT, MNS, composite
def composite(rect, step):
    mnt = grid('ELEVATION.ELEVATIONGRIDCOVERAGE.HIGHRES', rect, step)
    mns = grid('ELEVATION.ELEVATIONGRIDCOVERAGE.HIGHRES.MNS', rect, step)
    x0, z0, x1, z1 = rect; H, W = mnt.shape
    mask = Image.new('L', (W, H), 0); dr = ImageDraw.Draw(mask)
    for b in blds:
        dr.polygon([((x - x0) / step - .5, (z - z0) / step - .5) for x, z in b['pts']], fill=255)
    m = np.asarray(mask) > 0
    from scipy import ndimage
    m = ndimage.binary_dilation(m, iterations=max(1, int(round(1.2 / step))))   # 1,2 m de garde autour des murs
    rel = np.where(m, mnt, np.maximum(mns, mnt))
    veg = np.clip((mns - mnt) * (~m), 0, 60)                                       # hauteur de la végétation et des ponts
    return mnt, mns, rel.astype(np.float32), veg.astype(np.float32)

def save_h(name, A, base):
    q = np.clip(np.round((A - base) * 20), 0, 65535).astype(np.uint16)            # 5 cm
    rgb = np.zeros(q.shape + (3,), np.uint8); rgb[..., 0] = q >> 8; rgb[..., 1] = q & 255
    return rgb

meta = {'src': 'IGN — RGE ALTI (MNT), MNS LiDAR HD, BD TOPO, BD ORTHO — Licence ouverte Etalab 2.0', 'origin_l93': [E0, N0], 'pavAlt': 119.1, 'zones': {}}
MNS_C = None
for name, rect, step in [('anneau', RING, STEP_R), ('coeur', CORE, STEP_C)]:
    mnt, mns, rel, veg = composite(rect, step)
    base = float(math.floor(min(rel.min(), mnt.min())))
    rgb = save_h(name, rel, base); rgb[..., 2] = np.clip(veg * 6, 0, 255).astype(np.uint8)   # B : hauteur de végétation (×6)
    Image.fromarray(rgb).save(os.path.join(OUT, f'relief-{name}.png'), optimize=True)
    meta['zones'][name] = {'rect': rect, 'step': step, 'w': int(rel.shape[1]), 'h': int(rel.shape[0]), 'base': base}
    if name == 'coeur': MNS_C, MNT_C = mns, mnt
    if name == 'anneau': MNS_R, MNT_R = mns, mnt
    print(name, rel.shape, rel.min(), rel.max(), flush=True)

# ---------------------------------------------------------------- toits relevés dans le MNS, murs
def sampler(A, rect, step):
    x0, z0 = rect[0], rect[1]; H, W = A.shape
    def f(x, z):
        fx = np.clip((np.asarray(x) - x0) / step - .5, 0, W - 1.001); fz = np.clip((np.asarray(z) - z0) / step - .5, 0, H - 1.001)
        i, j = np.floor(fx).astype(int), np.floor(fz).astype(int); u, v = fx - i, fz - j
        return A[j, i] * (1 - u) * (1 - v) + A[j, i + 1] * u * (1 - v) + A[j + 1, i] * (1 - u) * v + A[j + 1, i + 1] * u * v
    return f
mnsC, mnsR, mntC, mntR = sampler(MNS_C, CORE, STEP_C), sampler(MNS_R, RING, STEP_R), sampler(MNT_C, CORE, STEP_C), sampler(MNT_R, RING, STEP_R)
inCore = lambda x, z: (x > CORE[0] + 2) & (x < CORE[2] - 2) & (z > CORE[1] + 2) & (z < CORE[3] - 2)
def MNS(x, z): x, z = np.asarray(x, float), np.asarray(z, float); return np.where(inCore(x, z), mnsC(x, z), mnsR(x, z))
def MNT(x, z): x, z = np.asarray(x, float), np.asarray(z, float); return np.where(inCore(x, z), mntC(x, z), mntR(x, z))

import triangle as tr
from shapely.geometry import Polygon, Point
P, IDX, KIND = [], [], []     # KIND : 0 mur, 1 toit
bmeta = []
for b in blds:
    try:
        poly = Polygon(b['pts'])
        if not poly.is_valid: poly = poly.buffer(0)
        if poly.is_empty or poly.area < 6: continue
        if poly.geom_type != 'Polygon': poly = max(poly.geoms, key=lambda g: g.area)
        poly = poly.simplify(.15)
        ext = list(poly.exterior.coords)[:-1]
        if len(ext) < 3: continue
        if Polygon(ext).exterior.is_ccw: ext = ext[::-1]           # sens horaire vu du dessus (x est, z sud)
        xs, zs = np.array([p[0] for p in ext]), np.array([p[1] for p in ext])
        cx, cz = poly.centroid.x, poly.centroid.y
        sol = float(np.min(MNT(xs, zs)))
        tmax = b['tmax'] if b['tmax'] else (sol + (b['h'] or 6))
        tmin = b['tmin'] if b['tmin'] else sol + max(2.5, (b['h'] or 6) * .7)
        if tmax - sol < 2: tmax = sol + 2.5
        # toit : grille intérieure de 1,25 m (1,0 au cœur), triangulée contrainte par l'emprise
        st = 1.0 if inCore(np.array(cx), np.array(cz)) else 1.6
        n = len(ext); seg = [[i, (i + 1) % n] for i in range(n)]
        verts = list(ext)
        minx, minz, maxx, maxz = poly.bounds
        inner = poly.buffer(-.6)
        if not inner.is_empty:
            for gx in np.arange(minx + st / 2, maxx, st):
                for gz in np.arange(minz + st / 2, maxz, st):
                    if inner.contains(Point(gx, gz)): verts.append((gx, gz))
        t = tr.triangulate({'vertices': np.array(verts), 'segments': np.array(seg)}, 'p')
        V, T = t['vertices'], t['triangles']
        # hauteur du toit : le MNS, borné par les altitudes BD TOPO ; au bord, relevée 0,6 m à l'intérieur (pas le sol voisin)
        vx, vz = V[:, 0].copy(), V[:, 1].copy()
        k = len(ext)
        dx, dz = cx - vx[:k], cz - vz[:k]; dl = np.hypot(dx, dz) + 1e-6
        vx[:k] += dx / dl * .6; vz[:k] += dz / dl * .6
        y = np.clip(MNS(vx, vz), min(tmin, tmax) - .5, tmax + .3)
        y = np.maximum(y, sol + 2.2)
        o = len(P) // 3
        for (x, z), yy in zip(V, y): P += [x, float(yy), z]; KIND.append(1)
        for a, b2, c in T: IDX += [o + int(a), o + int(c), o + int(b2)]
        # murs : du sol (MNT au pied, 0,4 m sous terre) jusqu'au bord du toit
        o2 = len(P) // 3
        foot = MNT(xs, zs) - .4
        for i in range(n):
            P += [xs[i], float(foot[i]), zs[i], xs[i], float(y[i]), zs[i]]; KIND += [0, 0]
        for i in range(n):
            a0, a1, b0, b1 = o2 + 2 * i, o2 + 2 * i + 1, o2 + 2 * ((i + 1) % n), o2 + 2 * ((i + 1) % n) + 1
            IDX += [a0, b0, a1, a1, b0, b1]
        bmeta.append([round(cx, 1), round(cz, 1), round(float(tmax), 1), b['nature'] or '', b['usage'] or ''])
    except Exception as e:
        print('bâtiment ignoré', str(e)[:120])

P = np.asarray(P, np.float32); IDX = np.asarray(IDX, np.uint32); KIND = np.asarray(KIND, np.uint8)
with open(os.path.join(OUT, 'bati.bin'), 'wb') as fo:
    fo.write(P.tobytes()); fo.write(IDX.tobytes()); fo.write(KIND.tobytes())
meta['bati'] = {'nv': int(len(P) // 3), 'ni': int(len(IDX)), 'n': len(bmeta)}
json.dump(bmeta, open(os.path.join(OUT, 'bati.json'), 'w'))
print('bâti', meta['bati'], flush=True)

# ---------------------------------------------------------------- orthophotos en dalles (avec marge)
def ortho(name, rect, tile_m, px, margin):
    x0, z0, x1, z1 = rect; tiles = []
    nx, nz = int(math.ceil((x1 - x0) / tile_m)), int(math.ceil((z1 - z0) / tile_m))
    for j in range(nz):
        for i in range(nx):
            a, b = x0 + i * tile_m, z0 + j * tile_m
            r = [a - margin, b - margin, min(x1, a + tile_m) + margin, min(z1, b + tile_m) + margin]
            w = int(round(px * (r[2] - r[0]) / (tile_m + 2 * margin))); h = int(round(px * (r[3] - r[1]) / (tile_m + 2 * margin)))
            im = Image.open(io.BytesIO(wms('ORTHOIMAGERY.ORTHOPHOTOS', *r, w, h, 'image/jpeg'))).convert('RGB')
            f = f'ortho-{name}-{j}{i}'
            im.save(os.path.join(OUT, f + '.jpg'), quality=85, optimize=True, progressive=True)
            im.resize((max(1, w // 2), max(1, h // 2)), Image.LANCZOS).save(os.path.join(OUT, f + '-m.jpg'), quality=82, optimize=True, progressive=True)
            tiles.append({'f': f, 'inner': [a, b, min(x1, a + tile_m), min(z1, b + tile_m)], 'rect': r})
            print('ortho', f, w, h, flush=True)
    return tiles
meta['zones']['anneau']['tiles'] = ortho('anneau', RING, 800, 1680, 40)    # ~0,5 m
meta['zones']['coeur']['tiles'] = ortho('coeur', CORE, 640, 3400, 20)      # ~0,2 m
json.dump(meta, open(os.path.join(OUT, 'ville.json'), 'w'), indent=1)
print('ok', flush=True)
