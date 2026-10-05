"""
Repères réels pour l'ouverture et « Nous trouver » : noms et positions issus d'OpenStreetMap (ODbL), rien d'inventé.
Sortie : v5/assets/ign/lieux.json — [{name, kind, x, z}] dans le repère du pavillon (x est, z sud, mètres).
Exécuté par GitHub Actions (Overpass n'est pas joignable depuis l'environnement de développement).
"""
import json, os, time, urllib.request, urllib.parse
from pyproj import Transformer
ROOT = os.path.dirname(__file__)
OUT = os.path.join(ROOT, '..', '..', 'v5', 'assets', 'ign')
LAT, LON = 48.3969801, 2.9569157
T = Transformer.from_crs('EPSG:4326', 'EPSG:2154', always_xy=True)
E0, N0 = T.transform(LON, LAT)
BBOX = '48.370,2.915,48.415,2.985'
Q = f"""[out:json][timeout:120];
(
  nwr["amenity"="place_of_worship"]({BBOX});
  nwr["man_made"="water_tower"]({BBOX});
  nwr["railway"="station"]({BBOX});
  way["bridge"]["highway"]["name"]({BBOX});
  way["bridge"]["highway"~"primary|secondary|tertiary|trunk"]({BBOX});
  nwr["historic"]({BBOX});
  nwr["tourism"~"museum|attraction|viewpoint"]({BBOX});
  nwr["place"~"suburb|quarter|neighbourhood|town"]({BBOX});
  nwr["leisure"~"stadium|park"]["name"]({BBOX});
  nwr["amenity"~"townhall|college|university|school|library"]["name"]({BBOX});
  way["waterway"="river"]({BBOX});
);
out center tags;"""
def get():
    for url in ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter']:
        for k in range(3):
            try:
                req = urllib.request.Request(url, data=urllib.parse.urlencode({'data': Q}).encode(), headers={'User-Agent': 'digitale-academie-montereau/1.0'})
                with urllib.request.urlopen(req, timeout=180) as r: return json.loads(r.read())
            except Exception as e: print('retry', url, k, e, flush=True); time.sleep(10)
    raise RuntimeError('overpass')
out = []
for e in get()['elements']:
    t = e.get('tags', {}); c = e.get('center', e)
    if 'lat' not in c: continue
    E, N = T.transform(c['lon'], c['lat'])
    kind = next((f'{k}={t[k]}' for k in ['amenity', 'man_made', 'railway', 'bridge', 'historic', 'tourism', 'place', 'leisure', 'waterway'] if k in t), '')
    out.append({'name': t.get('name', ''), 'kind': kind, 'x': round(E - E0, 1), 'z': round(N0 - N, 1), 'osm': f"{e['type']}/{e['id']}",
                'denom': t.get('denomination', ''), 'wiki': t.get('wikipedia', '')})
json.dump(out, open(os.path.join(OUT, 'lieux.json'), 'w'), indent=1, ensure_ascii=False)
print(len(out), 'repères')
