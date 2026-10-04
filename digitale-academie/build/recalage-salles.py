"""Recalage des photos de salles : caméra (f, pp, tangage, lacet), plans de la pièce, polygones de premier plan.
# Usage : python3 recalage-salles.py salles/kahlo.json sortie.png  (superpose les arêtes des plans sur la photo + carte de profondeur)
Sortie : superposition des arêtes (changement de plan) et carte de profondeur, pour vérifier à l'œil.
Conventions three.js : caméra regarde -Z, Y haut. Pixel (u, v), v vers le bas."""
import json, math, sys
import numpy as np
from PIL import Image, ImageDraw

def rot(yaw, pitch, roll=0):
    cy, sy, cp, sp, cr, sr = math.cos(yaw), math.sin(yaw), math.cos(pitch), math.sin(pitch), math.cos(roll), math.sin(roll)
    Ry = np.array([[cy, 0, sy], [0, 1, 0], [-sy, 0, cy]])
    Rx = np.array([[1, 0, 0], [0, cp, -sp], [0, sp, cp]])
    Rz = np.array([[cr, -sr, 0], [sr, cr, 0], [0, 0, 1]])
    return Ry @ Rx @ Rz

def cam_from_vp(P):
    """lacet et tangage (degrés) tels que la direction -Z du monde se projette sur le point de fuite vp."""
    f, cx, cy = P['f'], P['cx'], P['cy']; u, v = P['vp']
    d = np.array([(u - cx) / f, -(v - cy) / f, -1.0]); d /= np.linalg.norm(d)
    best = (1e9, 0, 0)
    for yaw in np.arange(-60, 60, .02):
        Ry = rot(math.radians(yaw), 0)
        # tangage : R = Ry Rx ; on veut R d = -Z  =>  Rx d = Ry^T (-Z)
        w = Ry.T @ np.array([0, 0, -1.0])
        # Rx ne change pas d.x : il faut d.x == w.x
        err = abs(d[0] - w[0])
        if err < best[0]:
            # tangage : rotation autour de X qui amène (d.y, d.z) sur (w.y, w.z)
            p = math.atan2(w[1], -w[2]) - math.atan2(d[1], -d[2])
            best = (err, yaw, math.degrees(p))
    return best[1], best[2]

def ray(P, R, u, v):
    d = np.stack([(u - P['cx']) / P['f'], -(v - P['cy']) / P['f'], -np.ones_like(u)], -1)
    return d @ R.T

def plane_of(P, R, C, spec):
    """plan à partir d'une spécification : {'y': h} horizontal ; {'line': [[u,v],[u,v]], 'y': 0} plan vertical passant par
    la trace au sol (ou à la hauteur y) de deux pixels ; {'n': [...], 'd': k} direct."""
    if 'n' in spec: return np.array(spec['n'], float), float(spec['d'])
    if 'foot' in spec:
        y0 = spec.get('y', 0.0); u, v = spec['foot']
        d = ray(P, R, np.array([u], float), np.array([v], float))[0]
        a = C + (y0 - C[1]) / d[1] * d
        ang = math.radians(spec.get('dir', 0)); t = np.array([-math.sin(ang), 0, -math.cos(ang)])
        n = np.array([-t[2], 0, t[0]]); return n, float(n @ a)
    if 'line' in spec:
        y0 = spec.get('y', 0.0); pts = []
        for (u, v) in spec['line']:
            d = ray(P, R, np.array([u], float), np.array([v], float))[0]
            t = (y0 - C[1]) / d[1]; pts.append(C + t * d)
        a, b = pts; t = b - a; n = np.array([-t[2], 0, t[0]]); n /= np.linalg.norm(n)
        return n, float(n @ a)
    if 'y' in spec: return np.array([0, 1.0, 0]), float(spec['y'])
    raise ValueError(spec)

def point_in_poly(u, v, poly):
    poly = np.array(poly, float); inside = np.zeros(u.shape, bool); n = len(poly)
    for i in range(n):
        x0, y0 = poly[i]; x1, y1 = poly[(i + 1) % n]
        c = ((y0 > v) != (y1 > v)) & (u < (x1 - x0) * (v - y0) / (y1 - y0 + 1e-12) + x0)
        inside ^= c
    return inside

def solve(P):
    if 'vp' in P and 'yaw' not in P: P['yaw'], P['pitch'] = cam_from_vp(P); print('yaw %.2f pitch %.2f' % (P['yaw'], P['pitch']))
    R = rot(math.radians(P['yaw']), math.radians(P['pitch']))
    C = np.array([0, P['h'], 0.0])
    return R, C

def depth(P, step=4):
    R, C = solve(P)
    W, H = P['W'], P['H']
    us, vs = np.meshgrid(np.arange(0, W + 1, step, float), np.arange(0, H + 1, step, float))
    d = ray(P, R, us, vs)
    T = np.full(us.shape, np.inf); lab = np.full(us.shape, -1)
    for k, sp in enumerate(P['room']):
        n, dd = plane_of(P, R, C, sp)
        den = d @ n; t = (dd - C @ n) / np.where(np.abs(den) < 1e-9, 1e-9, den)
        ok = (t > 0) & (t < T); T = np.where(ok, t, T); lab = np.where(ok, k, lab)
    for k, pg in enumerate(P.get('polys', [])):
        n, dd = plane_of(P, R, C, pg['plane'])
        den = d @ n; t = (dd - C @ n) / np.where(np.abs(den) < 1e-9, 1e-9, den)
        ins = point_in_poly(us, vs, pg['img']) & (t > 0) & (t < T)
        T = np.where(ins, t, T); lab = np.where(ins, 100 + k, lab)
    return us, vs, T, lab, R, C

def report(P, out):
    us, vs, T, lab, R, C = depth(P, 4)
    im = Image.open(P['src']).convert('RGB'); dr = ImageDraw.Draw(im)
    # arêtes : changement de label
    e = np.zeros(lab.shape, bool); e[:, 1:] |= lab[:, 1:] != lab[:, :-1]; e[1:, :] |= lab[1:, :] != lab[:-1, :]
    for (j, i) in zip(*np.nonzero(e)): dr.rectangle((us[j, i] - 2, vs[j, i] - 2, us[j, i] + 2, vs[j, i] + 2), fill=(0, 255, 255))
    vp = P.get('vp');
    if vp: dr.ellipse((vp[0] - 10, vp[1] - 10, vp[0] + 10, vp[1] + 10), outline=(255, 0, 255), width=4)
    # carte de profondeur à côté
    Tn = np.clip(T, 0, P.get('maxd', 12)) / P.get('maxd', 12)
    dm = Image.fromarray((255 * (1 - Tn)).astype(np.uint8)).resize(im.size)
    S = Image.new('RGB', (im.width * 2, im.height)); S.paste(im, (0, 0)); S.paste(dm.convert('RGB'), (im.width, 0))
    S = S.resize((S.width * 700 // S.height, 700)); S.save(out)
    # résumé
    vals = {}
    for k in np.unique(lab):
        m = lab == k; pts = C + T[m][:, None] * ray(P, R, us[m], vs[m])
        vals[int(k)] = [pts.min(0).round(2).tolist(), pts.max(0).round(2).tolist()]
    print(json.dumps(vals))

if __name__ == '__main__':
    P = json.load(open(sys.argv[1])); report(P, sys.argv[2])
