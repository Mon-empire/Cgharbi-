"""
La vraie vue aérienne de Montereau pour l'ouverture « on est l'oiseau ».
Sources (toutes ouvertes) :
  - orthophotographies IGN (BD ORTHO, Géoplateforme, Licence ouverte Etalab 2.0) : tuiles WMS EPSG:3857
    téléchargées dans IGN_DIR (voir JOURNAL.md pour les requêtes) ;
  - relief : tuiles « terrarium » (AWS Terrain Tiles, Mapzen ; sources SRTM / EU-DEM), zoom 14 ;
  - bâtiments : OpenStreetMap (ODbL), déjà extraits dans assets/data/montereau.json (hauteurs en mètres).
Repère produit : mètres vrais, origine au pavillon (1 rue Honoré de Balzac), x vers l'est, z vers le sud, y = altitude - altitude du pavillon.
"""
import math, json, base64, io, os, sys, urllib.request
import numpy as np
from PIL import Image

IGN_DIR = sys.argv[1] if len(sys.argv) > 1 else 'ign'
OUT = os.path.join(os.path.dirname(__file__), '..', 'v5', 'assets')
R = 6378137
LAT, LON = 48.3969801, 2.9569157            # pavillon
mx = lambda lon: R * math.radians(lon)
my = lambda lat: R * math.log(math.tan(math.pi / 4 + math.radians(lat) / 2))
XP, YP = mx(LON), my(LAT)
K = math.cos(math.radians(LAT))             # mètre Mercator -> mètre vrai

def rect(X0, Y0, X1, Y1):
    return [round((X0 - XP) * K, 2), round(-(Y1 - YP) * K, 2), round((X1 - XP) * K, 2), round(-(Y0 - YP) * K, 2)]   # x0, z0 (nord), x1, z1 (sud)

WIDE = (324830.3, 6168967.0, 333067.9, 6176679.0)
A = (326841.0, 6169434.0, 330864.0, 6174022.0)
P = (328662.4, 6172654.1, 329662.4, 6173654.1)

# ---------- images ----------
def load(n): return Image.open(os.path.join(IGN_DIR, n + '.webp')).convert('RGB')
wide = load('WIDE')
a = Image.new('RGB', (3072, 3504))
for j in range(4):
    for i in range(3): a.paste(load(f'A{j}{i}'), (i * 1024, j * 876))
p = Image.new('RGB', (2048, 2048))
for j in range(2):
    for i in range(2): p.paste(load(f'P{j}{i}'), (i * 1024, j * 1024))
img = os.path.join(OUT, 'img')
wide.save(os.path.join(img, 'aerien-large.jpg'), quality=84, optimize=True, progressive=True)
a.save(os.path.join(img, 'aerien-ville.jpg'), quality=80, optimize=True, progressive=True)
a.resize((1536, 1752), Image.LANCZOS).save(os.path.join(img, 'aerien-ville-m.jpg'), quality=80, optimize=True, progressive=True)
p.save(os.path.join(img, 'aerien-pavillon.jpg'), quality=82, optimize=True, progressive=True)
p.resize((1024, 1024), Image.LANCZOS).save(os.path.join(img, 'aerien-pavillon-m.jpg'), quality=82, optimize=True, progressive=True)

# ---------- relief ----------
O = 20037508.342789244; z = 14; ts = 2 * O / 2 ** z
X0, Y0, X1, Y1 = WIDE
tx0, tx1, ty0, ty1 = int((X0 + O) / ts), int((X1 + O) / ts), int((O - Y1) / ts), int((O - Y0) / ts)
M = np.zeros(((ty1 - ty0 + 1) * 256, (tx1 - tx0 + 1) * 256), np.float32)
for ty in range(ty0, ty1 + 1):
    for tx in range(tx0, tx1 + 1):
        raw = urllib.request.urlopen(f'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{tx}/{ty}.png', timeout=30).read()
        t = np.asarray(Image.open(io.BytesIO(raw)).convert('RGB')).astype(np.float32)
        M[(ty - ty0) * 256:(ty - ty0 + 1) * 256, (tx - tx0) * 256:(tx - tx0 + 1) * 256] = t[..., 0] * 256 + t[..., 1] + t[..., 2] / 256 - 32768
px = ts / 256; gx0 = tx0 * ts - O; gy1 = O - ty0 * ts
def elev_merc(X, Y):
    c = (X - gx0) / px - .5; r = (gy1 - Y) / px - .5
    c0, r0 = int(c), int(r); fc, fr = c - c0, r - r0
    return (M[r0, c0] * (1 - fc) * (1 - fr) + M[r0, c0 + 1] * fc * (1 - fr) + M[r0 + 1, c0] * (1 - fc) * fr + M[r0 + 1, c0 + 1] * fc * fr)
EP = float(elev_merc(XP, YP))
# grille régulière en mètres vrais (pas de 12 m) sur l'emprise large
x0, z0, x1, z1 = rect(*WIDE)
STEP = 12.0
nx, nz = int((x1 - x0) / STEP) + 1, int((z1 - z0) / STEP) + 1
G = np.zeros((nz, nx), np.int16)
for j in range(nz):
    for i in range(nx):
        X = XP + (x0 + i * STEP) / K; Y = YP - (z0 + j * STEP) / K
        G[j, i] = int(round((float(elev_merc(X, Y)) - EP) * 10))
# ---------- bâtiments (OSM) ----------
D = json.load(open(os.path.join(OUT, 'data', 'montereau.json')))
KX = math.cos(math.radians(48.39)) * 111320; KZ = 110540
pxl, pzl = (LON - 2.955) * KX, -(LAT - 48.39) * KZ
ax0, az0, ax1, az1 = rect(*A)
bld = []
for b in D['bld']:
    pts = [(b[1 + 2 * i] - pxl, b[2 + 2 * i] - pzl) for i in range((len(b) - 1) // 2)]
    cx = sum(q[0] for q in pts) / len(pts); cz = sum(q[1] for q in pts) / len(pts)
    if not (ax0 < cx < ax1 and az0 < cz < az1): continue
    X = XP + cx / K; Y = YP - cz / K
    base = float(elev_merc(X, Y)) - EP
    h = b[0]
    if math.hypot(cx, cz) < 25: h = 3.6        # le pavillon : un seul niveau (photos de la Ville), OSM donne la valeur par défaut
    row = [round(h, 1), round(base, 1)]
    for q in pts: row += [round(q[0], 1), round(q[1], 1)]
    bld.append(row)
out = {
    'src': 'Orthophotos IGN (Licence ouverte Etalab 2.0) ; relief AWS Terrain Tiles (SRTM, EU-DEM) ; bâtiments OpenStreetMap (ODbL)',
    'pav': [LAT, LON], 'pavAlt': round(EP, 1),
    'wide': rect(*WIDE), 'a': rect(*A), 'p': rect(*P),
    'elev': {'nx': nx, 'nz': nz, 'x0': x0, 'z0': z0, 'step': STEP, 'dm': base64.b64encode(G.astype('<i2').tobytes()).decode()},
    'bld': bld
}
json.dump(out, open(os.path.join(OUT, 'data', 'aerien.json'), 'w'), separators=(',', ':'))
print('pav alt', EP, 'grid', nx, nz, 'buildings', len(bld), 'extents', out['wide'], out['a'], out['p'])
