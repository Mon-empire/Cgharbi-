"""
Bibliothèque : photographies retenues (George Peabody Library, Baltimore — celle du papier peint de la salle d'étude)
et cartes de profondeur estimées (Depth Anything V2, petit modèle) pour des mouvements de caméra à vraie parallaxe.
Exécuté par GitHub Actions. Sorties : v5/assets/biblio/b<k>.jpg (3840 px), b<k>-m.jpg (1920 px), b<k>-d.png (profondeur),
build/biblio/out/choix.json (titres, licences, auteurs, pour les crédits).
"""
import json, os, io, re, time, urllib.request
import numpy as np
from PIL import Image
Image.MAX_IMAGE_PIXELS = None
HERE = os.path.dirname(__file__)
OUT = os.path.join(HERE, '..', '..', 'v5', 'assets', 'biblio'); os.makedirs(OUT, exist_ok=True)
UA = {'User-Agent': 'DigitaleAcademieMontereau/1.0 (experience web municipale; contact digitale-academie@ville-montereau77.fr)'}
def get(url, timeout=300):
    for k in range(5):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=timeout) as r: return r.read()
        except Exception as e: print('retry', k, e, flush=True); time.sleep(5 + 15 * k)
    raise RuntimeError(url)

inv = json.load(open(os.path.join(HERE, 'out', 'inventaire.json')))
PICK = [0, 1, 2, 3, 4, 5, 6, 9, 10, 11, 12, 14, 15, 18, 30, 31]
from transformers import pipeline
depth = pipeline('depth-estimation', model='depth-anything/Depth-Anything-V2-Small-hf', device='cpu')
choix = []
for k in PICK:
    f = inv[k]; th = f.get('thumb')
    if not th: continue
    url = re.sub(r'/((?:lossy-)?(?:page\d+-)?)\d+px-', r'/\g<1>3840px-', th.split('?')[0])
    try: im = Image.open(io.BytesIO(get(url))).convert('RGB')
    except Exception as e:
        print('échec', k, e, flush=True); continue
    if im.width > 3840: im = im.resize((3840, round(im.height * 3840 / im.width)), Image.LANCZOS)
    tag = f'b{k}'
    im.save(os.path.join(OUT, tag + '.jpg'), quality=86, optimize=True, progressive=True)
    m = im.resize((1920, round(im.height * 1920 / im.width)), Image.LANCZOS)
    m.save(os.path.join(OUT, tag + '-m.jpg'), quality=82, optimize=True, progressive=True)
    d = np.asarray(depth(m)['predicted_depth'].squeeze().numpy(), np.float32)   # disparité relative (grand = proche)
    d = (d - np.percentile(d, 1)) / max(1e-6, np.percentile(d, 99.5) - np.percentile(d, 1))
    D = Image.fromarray((np.clip(d, 0, 1) * 255).astype(np.uint8)).resize((960, round(960 * im.height / im.width)), Image.BILINEAR)
    D.save(os.path.join(OUT, tag + '-d.png'), optimize=True)
    choix.append({'tag': tag, 'title': f['title'], 'license': f['license'], 'artist': re.sub('<[^>]+>', '', f.get('artist') or '').strip(),
                  'w': im.width, 'h': im.height, 'src': f['url'].split('?')[0]})
    print('ok', tag, im.size, flush=True)
json.dump(choix, open(os.path.join(HERE, 'out', 'choix.json'), 'w'), indent=1, ensure_ascii=False)
