"""
Bâti BD TOPO : toits simplifiés (décimation quadrique, contours préservés : les murs se raccordent exactement), puis
quantifiés (x, z au décimètre, altitude au centimètre). 20 Mo -> ~6 Mo. Idempotent (ne refait rien si déjà compact).
"""
import json, os, numpy as np, pyfqmr
D = os.path.join(os.path.dirname(__file__), '..', '..', 'v5', 'assets', 'ville')
m = json.load(open(os.path.join(D, 'ville.json'))); b = m['bati']
if 'fmt' in b: raise SystemExit('déjà compact')
d = open(os.path.join(D, 'bati.bin'), 'rb').read(); nv, ni = b['nv'], b['ni']
P = np.frombuffer(d, '<f4', nv * 3).reshape(-1, 3).astype(np.float64); I = np.frombuffer(d, '<u4', ni, nv * 12).reshape(-1, 3); K = np.frombuffer(d, 'u1', nv, nv * 12 + ni * 4)
def sub(T):
    u, inv = np.unique(T.ravel(), return_inverse=True); return P[u], inv.reshape(-1, 3)
rp, rt = sub(I[K[I[:, 0]] == 1]); wp, wt = sub(I[K[I[:, 0]] == 0])
s = pyfqmr.Simplify(); s.setMesh(rp, rt.astype(np.int32))
s.simplify_mesh(target_count=int(len(rt) * .3), aggressiveness=5, preserve_border=True, verbose=0, max_iterations=150)
rp2, rt2, _ = s.getMesh()
V = np.vstack([rp2, wp]); T = np.vstack([rt2, wt + len(rp2)]); KK = np.concatenate([np.ones(len(rp2), np.uint8), np.zeros(len(wp), np.uint8)])
x = np.round(V[:, 0] * 10).astype(np.int16); z = np.round(V[:, 2] * 10).astype(np.int16); y = np.round((V[:, 1] - 40) * 100).astype(np.uint16)
with open(os.path.join(D, 'bati.bin'), 'wb') as f:
    for a in (x, y, z, T.astype(np.uint32), KK): f.write(a.tobytes())
m['bati'] = {'nv': int(len(V)), 'ni': int(T.size), 'n': b['n'], 'fmt': 'x:int16/10, y:uint16/100+40, z:int16/10, idx:uint32, kind:uint8'}
json.dump(m, open(os.path.join(D, 'ville.json'), 'w'), indent=1)
print(m['bati'])
