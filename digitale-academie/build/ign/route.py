"""
Le fil d'or de « Nous trouver » suit les vraies rues : plus court chemin sur le réseau routier d'OpenStreetMap (ODbL),
du pont de Seine jusqu'à la rue Honoré de Balzac (adresse du pavillon). Exécuté par GitHub Actions.
Sortie : v5/assets/ville/route.json — {pts: [[x, z], ...]} dans le repère du pavillon (x est, z sud, mètres).
"""
import json, os, time, math, urllib.request, urllib.parse
import networkx as nx
from pyproj import Transformer
OUT = os.path.join(os.path.dirname(__file__), '..', '..', 'v5', 'assets', 'ville'); os.makedirs(OUT, exist_ok=True)
LAT, LON = 48.3969801, 2.9569157
T = Transformer.from_crs('EPSG:4326', 'EPSG:2154', always_xy=True); E0, N0 = T.transform(LON, LAT)
Q = """[out:json][timeout:120];
way["highway"~"^(primary|secondary|tertiary|unclassified|residential|living_street|service|pedestrian|footway|path|steps|cycleway|trunk|primary_link|secondary_link|tertiary_link)$"](48.375,2.935,48.405,2.975);
(._;>;);out body;"""
def get():
    for url in ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter']:
        for k in range(3):
            try:
                req = urllib.request.Request(url, data=urllib.parse.urlencode({'data': Q}).encode(), headers={'User-Agent': 'digitale-academie-montereau/1.0'})
                with urllib.request.urlopen(req, timeout=180) as r: return json.loads(r.read())
            except Exception as e: print('retry', k, e, flush=True); time.sleep(10)
    raise RuntimeError('overpass')
d = get()
node = {e['id']: T.transform(e['lon'], e['lat']) for e in d['elements'] if e['type'] == 'node'}
xy = {k: (E - E0, N0 - N) for k, (E, N) in node.items()}
G = nx.Graph(); balzac = set(); seine = set()
for w in (e for e in d['elements'] if e['type'] == 'way'):
    nm = w.get('tags', {}).get('name', '')
    ns = [n for n in w['nodes'] if n in xy]
    for a, b in zip(ns, ns[1:]): G.add_edge(a, b, weight=math.dist(xy[a], xy[b]))
    if 'Balzac' in nm: balzac.update(ns)
    if nm == 'Pont de Seine': seine.update(ns)
near = lambda S, p: min(S, key=lambda n: math.dist(xy[n], p))
src = near(seine or G.nodes, (209.6, 894.3))
dst = near(balzac or G.nodes, (0, 0))
path = nx.shortest_path(G, src, dst, weight='weight')
pts = [[round(xy[n][0], 1), round(xy[n][1], 1)] for n in path]
json.dump({'src': 'Itinéraire calculé sur le réseau © contributeurs OpenStreetMap (ODbL)', 'from': 'Pont de Seine', 'to': 'rue Honoré de Balzac',
           'balzac_found': bool(balzac), 'pts': pts}, open(os.path.join(OUT, 'route.json'), 'w'))
print(len(pts), 'points', 'longueur', round(sum(math.dist(a, b) for a, b in zip(pts, pts[1:]))), 'm', 'balzac', bool(balzac))
