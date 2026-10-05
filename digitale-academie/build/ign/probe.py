"""
Sonde des services IGN (Géoplateforme) pour Montereau-Fault-Yonne, exécutée par GitHub Actions
(l'environnement de développement n'a pas accès à data.geopf.fr).
Écrit build/ign/out/report.json et quelques échantillons.
"""
import json, os, re, io, sys, traceback, urllib.request, urllib.parse
import numpy as np
from PIL import Image
from pyproj import Transformer

OUT = os.path.join(os.path.dirname(__file__), 'out'); os.makedirs(OUT, exist_ok=True)
R = {'steps': []}
def log(k, v): R['steps'].append({k: v}); print(k, str(v)[:400], flush=True)
def get(url, timeout=120):
    req = urllib.request.Request(url, headers={'User-Agent': 'digitale-academie-montereau/1.0'})
    with urllib.request.urlopen(req, timeout=timeout) as r: return r.read(), r.headers.get('Content-Type', '')

LAT, LON = 48.3969801, 2.9569157
t = Transformer.from_crs('EPSG:4326', 'EPSG:2154', always_xy=True)
X, Y = t.transform(LON, LAT); log('pavillon_l93', [X, Y])

# 1. couches d'altitude disponibles (WMS raster)
try:
    cap, _ = get('https://data.geopf.fr/wms-r/wms?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetCapabilities')
    txt = cap.decode('utf8', 'ignore')
    names = re.findall(r'<Name>([^<]+)</Name>', txt)
    elev = [n for n in names if re.search(r'ELEV|MNS|MNT|LIDAR|ALTI|MNH', n, re.I)]
    log('wms_r_layers_elevation', elev)
    fm = sorted(set(re.findall(r'<Format>([^<]+)</Format>', txt)))
    log('wms_r_formats', fm)
except Exception as e: log('wms_r_cap_error', repr(e))

# 2. échantillon de MNS / MNT autour du pavillon (200 m, 0,5 m/px) en BIL float32
half = 100
for layer in [l for l in R['steps'][1].get('wms_r_layers_elevation', [])][:40] if len(R['steps']) > 1 else []:
    for fmt in ['image/x-bil;bits=32', 'image/geotiff']:
        q = {'SERVICE': 'WMS', 'VERSION': '1.3.0', 'REQUEST': 'GetMap', 'LAYERS': layer, 'STYLES': '', 'CRS': 'EPSG:2154',
             'BBOX': f'{X-half},{Y-half},{X+half},{Y+half}', 'WIDTH': 400, 'HEIGHT': 400, 'FORMAT': fmt}
        try:
            b, ct = get('https://data.geopf.fr/wms-r/wms?' + urllib.parse.urlencode(q), 60)
            info = {'layer': layer, 'fmt': fmt, 'ct': ct, 'bytes': len(b)}
            if 'bil' in fmt and len(b) == 400 * 400 * 4:
                a = np.frombuffer(b, '<f4').reshape(400, 400); v = a[a > -1000]
                info.update(min=float(v.min()) if v.size else None, max=float(v.max()) if v.size else None, center=float(a[200, 200]))
                np.save(os.path.join(OUT, re.sub(r'[^A-Za-z0-9]+', '_', layer) + '.npy'), a)
                if v.size:
                    im = ((np.clip(a, v.min(), v.max()) - v.min()) / max(1e-6, v.max() - v.min()) * 255).astype(np.uint8)
                    Image.fromarray(im).save(os.path.join(OUT, re.sub(r'[^A-Za-z0-9]+', '_', layer) + '.png'))
            log('sample', info)
            if 'bil' in fmt and len(b) == 400 * 400 * 4: break
        except Exception as e: log('sample_error', {'layer': layer, 'fmt': fmt, 'err': repr(e)[:200]})

# 3. orthophoto 20 cm autour du pavillon
try:
    q = {'SERVICE': 'WMS', 'VERSION': '1.3.0', 'REQUEST': 'GetMap', 'LAYERS': 'ORTHOIMAGERY.ORTHOPHOTOS', 'STYLES': '', 'CRS': 'EPSG:2154',
         'BBOX': f'{X-half},{Y-half},{X+half},{Y+half}', 'WIDTH': 1000, 'HEIGHT': 1000, 'FORMAT': 'image/jpeg'}
    b, ct = get('https://data.geopf.fr/wms-r/wms?' + urllib.parse.urlencode(q))
    open(os.path.join(OUT, 'ortho_pav_20cm.jpg'), 'wb').write(b); log('ortho', {'ct': ct, 'bytes': len(b)})
except Exception as e: log('ortho_error', repr(e))

# 4. dalles LiDAR HD (nuages de points) qui couvrent le pavillon
for typename in ['IGNF_NUAGES-DE-POINTS-LIDAR-HD:dalle', 'IGNF_LIDAR-HD_TA:nuage-dalle']:
    try:
        q = {'SERVICE': 'WFS', 'VERSION': '2.0.0', 'REQUEST': 'GetFeature', 'TYPENAMES': typename, 'OUTPUTFORMAT': 'application/json',
             'BBOX': f'{LAT-.003},{LON-.004},{LAT+.003},{LON+.004},urn:ogc:def:crs:EPSG::4326', 'COUNT': 20}
        b, ct = get('https://data.geopf.fr/wfs/ows?' + urllib.parse.urlencode(q))
        j = json.loads(b); log('lidar_tiles', {'typename': typename, 'n': len(j.get('features', [])), 'props': [f['properties'] for f in j.get('features', [])][:6]})
    except Exception as e: log('lidar_tiles_error', {'typename': typename, 'err': repr(e)[:300]})

json.dump(R, open(os.path.join(OUT, 'report.json'), 'w'), indent=1, ensure_ascii=False)
