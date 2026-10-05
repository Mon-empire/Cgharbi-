"""
La bibliothèque : photographies sous licence libre de la George Peabody Library (Baltimore), celle du papier peint de
la salle d'étude. Exécuté par GitHub Actions (Wikimedia n'est pas joignable depuis l'environnement de développement).
1. inventaire de la catégorie Commons (dimensions, licence, auteur) -> build/biblio/out/inventaire.json + vignettes
2. pour chaque panorama équirectangulaire (rapport 2:1, largeur >= 6000) : six faces de cube (4096 et 1024 px)
"""
import json, os, io, time, urllib.request, urllib.parse
import numpy as np
from PIL import Image
Image.MAX_IMAGE_PIXELS = None
OUT = os.path.join(os.path.dirname(__file__), 'out'); os.makedirs(OUT, exist_ok=True)
UA = {'User-Agent': 'DigitaleAcademieMontereau/1.0 (experience web municipale; contact digitale-academie@ville-montereau77.fr)'}
def get(url, timeout=300):
    for k in range(4):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=timeout) as r: return r.read()
        except Exception as e: print('retry', k, e, flush=True); time.sleep(5 + 10 * k)
    raise RuntimeError(url)
API = 'https://commons.wikimedia.org/w/api.php?'
def api(**q):
    q.update(format='json'); return json.loads(get(API + urllib.parse.urlencode(q)))

files = []
for cat in ['Category:George Peabody Library', 'Category:Interior of the George Peabody Library']:
    try:
        r = api(action='query', generator='categorymembers', gcmtitle=cat, gcmtype='file', gcmlimit=200, prop='imageinfo',
                iiprop='url|size|extmetadata|mime', iiurlwidth=640)
        for p in r.get('query', {}).get('pages', {}).values():
            ii = p['imageinfo'][0]; md = ii.get('extmetadata', {})
            files.append({'title': p['title'], 'w': ii['width'], 'h': ii['height'], 'url': ii['url'], 'thumb': ii.get('thumburl'),
                          'license': md.get('LicenseShortName', {}).get('value'), 'artist': md.get('Artist', {}).get('value'),
                          'mime': ii.get('mime')})
    except Exception as e: print('cat', cat, e)
# recherche plein texte des panoramas
try:
    r = api(action='query', generator='search', gsrsearch='Peabody Library panorama', gsrnamespace=6, gsrlimit=50, prop='imageinfo',
            iiprop='url|size|extmetadata|mime', iiurlwidth=640)
    for p in r.get('query', {}).get('pages', {}).values():
        ii = p['imageinfo'][0]; md = ii.get('extmetadata', {})
        if not any(f['title'] == p['title'] for f in files):
            files.append({'title': p['title'], 'w': ii['width'], 'h': ii['height'], 'url': ii['url'], 'thumb': ii.get('thumburl'),
                          'license': md.get('LicenseShortName', {}).get('value'), 'artist': md.get('Artist', {}).get('value'), 'mime': ii.get('mime')})
except Exception as e: print('search', e)
files.sort(key=lambda f: -f['w'] * f['h'])
json.dump(files, open(os.path.join(OUT, 'inventaire.json'), 'w'), indent=1, ensure_ascii=False)
print(len(files), 'fichiers')

# planche de vignettes (pour choisir)
thumbs = []
for f in files[:40]:
    if not f.get('thumb'): continue
    try: thumbs.append((f['title'], Image.open(io.BytesIO(get(f['thumb']))).convert('RGB')))
    except Exception as e: print('thumb', e)
if thumbs:
    W = 5; th = 260; rows = (len(thumbs) + W - 1) // W
    S = Image.new('RGB', (W * 360, rows * th), 'black')
    for k, (t, im) in enumerate(thumbs):
        im.thumbnail((356, th - 6)); S.paste(im, ((k % W) * 360, (k // W) * th))
    S.save(os.path.join(OUT, 'planche.jpg'), quality=85)

# panoramas équirectangulaires -> faces de cube
def cube(eq, size):
    H, W = eq.shape[:2]; faces = {}
    a = (np.arange(size) + .5) / size * 2 - 1; u, v = np.meshgrid(a, -a)
    dirs = {'px': (np.ones_like(u), v, -u), 'nx': (-np.ones_like(u), v, u), 'py': (u, np.ones_like(u), -v),
            'ny': (u, -np.ones_like(u), v), 'pz': (u, v, np.ones_like(u)), 'nz': (-u, v, -np.ones_like(u))}
    for k, (x, y, z) in dirs.items():
        lon = np.arctan2(x, z); lat = np.arctan2(y, np.hypot(x, z))
        px = ((lon / (2 * np.pi) + .5) * W) % W; py = (.5 - lat / np.pi) * (H - 1)
        x0 = np.floor(px).astype(int); y0 = np.floor(py).astype(int); fx = (px - x0)[..., None]; fy = (py - y0)[..., None]
        x1 = (x0 + 1) % W; y1 = np.minimum(y0 + 1, H - 1)
        c = eq[y0, x0] * (1 - fx) * (1 - fy) + eq[y0, x1] * fx * (1 - fy) + eq[y1, x0] * (1 - fx) * fy + eq[y1, x1] * fx * fy
        faces[k] = Image.fromarray(np.clip(c, 0, 255).astype(np.uint8))
    return faces
done = 0
for f in files:
    if done >= 2: break
    if f['w'] >= 6000 and abs(f['w'] / f['h'] - 2) < .02 and 'jpeg' in (f.get('mime') or ''):
        print('panorama', f['title'], f['w'], f['h'], flush=True)
        im = Image.open(io.BytesIO(get(f['url'], 900))).convert('RGB')
        if im.width > 16384: im = im.resize((16384, 8192), Image.LANCZOS)
        eq = np.asarray(im, np.float32)
        tag = f'pano{done}'
        d = os.path.join(os.path.dirname(__file__), '..', '..', 'v5', 'assets', 'biblio'); os.makedirs(d, exist_ok=True)
        for size, suf in [(4096, ''), (1024, '-m')]:
            for k, face in cube(eq, size).items():
                face.save(os.path.join(d, f'{tag}-{k}{suf}.jpg'), quality=86 if not suf else 80, optimize=True, progressive=True)
        im.resize((2048, 1024), Image.LANCZOS).save(os.path.join(OUT, f'{tag}-apercu.jpg'), quality=85)
        f['cube'] = tag; done += 1
json.dump(files, open(os.path.join(OUT, 'inventaire.json'), 'w'), indent=1, ensure_ascii=False)
