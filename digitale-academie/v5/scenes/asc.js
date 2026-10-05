/*
  FORMATIONS · « un étage après l'autre », dans une vraie bibliothèque
  Photographie : George Peabody Library (Baltimore), la bibliothèque du papier peint de la salle d'étude — élévation de face,
  de la salle de lecture (rez-de-chaussée) aux quatre galeries. Carte de profondeur estimée : la caméra monte comme une grue,
  les tables du premier plan glissent plus vite que les galeries (vraie parallaxe), la mise au point suit l'étage.
  Un étage = un niveau : DAEU au rez-de-chaussée (les tables de lecture), BTS à la 1re galerie, Licence et Bachelor côte à côte
  à la 2e (tous deux Bac+3), Master à la 3e, DU à la 4e. Le fil jaune monte le long d'une colonne et s'allume sur la rambarde.
  Une seule fiche lisible à la fois, reliée à son étage par un trait. Le panneau des étages (à droite) sert d'ascenseur.
*/
export async function create(ctx, el) {
  const { THREE, ss, damp, eIO, shot, library } = ctx;
  /* la caméra 3D reste dans l'atrium modélisé (repli si la photo n'est pas encore chargée) */
  const POSE = { pos: library.center.clone().add(new THREE.Vector3(0, 6, 9)), look: library.center.clone().add(new THREE.Vector3(0, 9, 0)) };
  const items = [...el.querySelectorAll('.v2-step')];
  const head = el.querySelector('.v2-asc__head'), list = el.querySelector('.v2-steps'), note = el.querySelector('.v2-asc__note');
  const N = items.length, IMG = 'b31';
  /* chargée pendant la visite (voir campus.js), pas au démarrage */
  /* repères mesurés sur la photo (u,v ∈ [0,1], v vers le bas) : haut de la rambarde de chaque galerie, table centrale */
  const COL = .414;   /* la colonne que le fil remonte */
  const L = [
    { y: .806, x0: .315, x1: .645, at: [.5, .74] },     /* DAEU : la table de lecture centrale */
    { y: .548, x0: .095, x1: .905, at: [.5, .56] },     /* BTS : 1re galerie */
    { y: .388, x0: .095, x1: .43, at: [.36, .42] },     /* Licence : 2e galerie, à gauche */
    { y: .388, x0: .585, x1: .905, at: [.64, .42] },    /* Bachelor : 2e galerie, à droite */
    { y: .222, x0: .095, x1: .905, at: [.5, .27] },     /* Master : 3e galerie */
    { y: .058, x0: .095, x1: .905, at: [.5, .13] }      /* DU : 4e galerie */
  ].slice(0, N);
  /* fiche : copie visuelle de la formation active (la liste reste la source pour les lecteurs d'écran) */
  const card = document.createElement('div'); card.className = 'v2-asc__card'; card.setAttribute('aria-hidden', 'true');
  card.innerHTML = '<p class="v2-asc__card-lv"></p><p class="v2-asc__card-t"></p><p class="v2-asc__card-d"></p>';
  el.querySelector('.v2-stage').append(card);
  const cLv = card.children[0], cT = card.children[1], cD = card.children[2];
  items.forEach((li, i) => {
    li.style.setProperty('--c', li.dataset.color);
    const btn = li.querySelector('button');
    btn.addEventListener('click', () => ctx.scrollTo('asc', pOf(i)));
    const on = () => { preview = i; }, off = () => { if (preview === i) preview = -1; };
    btn.addEventListener('pointerenter', on); btn.addEventListener('focus', on);
    btn.addEventListener('pointerleave', off); btn.addEventListener('blur', off);
  });
  /* rythme : plan d'ensemble (titre), six étages (tenue puis montée), plan d'ensemble final, tout allumé */
  const P0 = .1, P1 = .86, span = (P1 - P0) / N;
  const pOf = i => P0 + span * (i + .3);
  const kOf = p => { if (p < P0) return -1 + ss(.04, P0, p); if (p > P1) return N - 1; const kr = (p - P0) / span, k0 = Math.floor(kr); return Math.min(N - 1, k0 + ss(.6, .98, kr - k0)); };
  let active = -2, preview = -1, dRail = null;
  const lit = L.map(() => 0), lineK = L.map(() => 0);
  const lerp2 = (a, b, f) => [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
  const frame = (k, p) => {
    const portrait = innerWidth < innerHeight, Z = portrait ? 1.22 : 1.75, W0 = [.5, portrait ? .62 : .5];
    let at, zoom;
    if (k < 0) { const f = k + 1; at = lerp2(W0, L[0].at, eIO(f)); zoom = 1.02 + (Z - 1.02) * eIO(f); }
    else { const k0 = Math.floor(k), f = k - k0, a = L[k0], b = L[Math.min(N - 1, k0 + 1)]; at = lerp2(a.at, b.at, eIO(f)); zoom = Z * (1 + .04 * Math.sin(f * Math.PI)); }
    /* plan final : on recule, toute l'élévation s'allume */
    const out = eIO(ss(P1, .97, p)); at = lerp2(at, W0, out); zoom += (1.02 - zoom) * out;
    /* lente poussée continue (respiration du plan) */
    zoom *= 1 + .025 * Math.sin(p * 9);
    return { at, zoom };
  };
  return {
    cam() { return POSE; },
    update(p, t, dt, m, isCurrent) {
      const k = kOf(p), idx = Math.max(0, Math.round(k));
      const { at, zoom } = frame(k, p);
      /* la grue : la caméra s'est déplacée avec le cadre ; les plans proches (tables, colonnes) glissent davantage */
      const T = [-(at[0] - .5) * .5 + m.sx * .02, (at[1] - .5) * .55 - m.sy * .015];
      const shown = shot.show({
        a: IMG, pa: { at, zoom, T, d0: .32, dolly: .06, focus: k < 0 ? .45 : .34, dof: k < 0 ? 0 : .12 },
        fade: 1, warm: .5, expo: 1.22, rays: .32, sun: [.5, -.4], vig: .4, lift: .45
      }, t, isCurrent);
      if (!shown) return;
      if (!dRail) dRail = L.map(l => { let d = 0; for (let x = l.x0; x <= l.x1; x += .02) d = Math.max(d, shot.depthAt('a', x, l.y + .006)); return d; });
      if (idx !== active && k >= -.5) {
        if (active >= 0 && isCurrent) ctx.cue('borne');
        active = idx; items.forEach((li, i) => li.classList.toggle('is-on', i === idx));
        const li = items[idx];
        cLv.textContent = li.querySelector('.v2-step__lv').textContent; cT.textContent = li.querySelector('.v2-step__btn').lastChild.textContent.trim();
        cD.textContent = li.querySelector('.v2-step__body p:last-child').textContent;
        card.style.setProperty('--c', li.dataset.color);
        card.animate([{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }], { duration: 650, easing: 'cubic-bezier(.2,.8,.2,1)' });
      }
      const hold = k >= 0 ? 1 - Math.min(1, Math.abs(k - Math.round(k)) * 3) : 0, fin = ss(P1, .97, p);
      L.forEach((l, i) => {
        lit[i] = damp(lit[i], i === idx && k > -.3 ? 1 : i === preview ? .7 : i < idx ? .35 : fin, 3.5, dt);
        lineK[i] = damp(lineK[i], (i <= idx && k > -.3) || fin > .3 || i === preview ? 1 : 0, 2.2, dt);
      });
      /* ----- calque : le fil, les rambardes, le trait vers la fiche ----- */
      const g = shot.touch(), vis = ss(0, .04, p) * (1 - ss(.97, 1, p));
      g.globalCompositeOperation = 'lighter'; g.lineCap = 'round';
      const pr = (u, v, d) => shot.project('a', u, v, d);
      const stroke = (pts, col, w, a) => {
        if (pts.length < 2) return;
        g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
        g.strokeStyle = col; g.globalAlpha = a * .18 * vis; g.lineWidth = w * 6; g.stroke();
        g.globalAlpha = a * .5 * vis; g.lineWidth = w * 2.2; g.stroke();
        g.globalAlpha = a * vis; g.lineWidth = w; g.stroke();
      };
      /* le fil : du sol jusqu'à l'étage atteint, le long de la colonne */
      const top = k < 0 ? .99 - (.99 - L[0].y) * ss(-.6, 0, k) : (() => { const k0 = Math.floor(k), f = ss(.1, .9, k - k0); return L[k0].y + (L[Math.min(N - 1, k0 + 1)].y - L[k0].y) * f; })();
      const yTop = Math.min(.99, fin > 0 ? top + (L[N - 1].y - top) * fin : top);
      const fil = []; for (let v = .995; v >= yTop - 1e-3; v -= .01) fil.push(pr(COL, v));
      fil.push(pr(COL, yTop));
      stroke(fil, '#FFD600', 1.6, .95);
      /* rambardes : la ligne s'allume depuis la colonne, dans la couleur de la formation */
      L.forEach((l, i) => {
        if (lineK[i] < .01) return;
        const c = items[i].dataset.color, a0 = Math.max(l.x0, Math.min(l.x1, COL)), half = Math.max(a0 - l.x0, l.x1 - a0) * lineK[i];
        const pts = []; for (let x = Math.max(l.x0, a0 - half); x <= Math.min(l.x1, a0 + half) + 1e-3; x += .015) pts.push(pr(x, l.y, dRail[i]));
        stroke(pts, c, 1.2 + 1.3 * lit[i], .35 + .65 * lit[i]);
      });
      /* tête du fil */
      const h = pr(COL, yTop); g.globalAlpha = vis; g.fillStyle = '#FFF4C0'; g.beginPath(); g.arc(h[0], h[1], 3.2, 0, 7); g.fill();
      g.globalAlpha = .25 * vis; g.beginPath(); g.arc(h[0], h[1], 11 + 2 * Math.sin(t * 4), 0, 7); g.fill();
      /* trait de la fiche vers son étage */
      const cv = ctx.renderer.domElement.getBoundingClientRect(), cr = card.getBoundingClientRect(), l = L[idx];
      const anc = pr(Math.max(l.x0, Math.min(l.x1, at[0] + (idx === 3 ? .08 : idx === 2 ? -.08 : .12))), l.y, dRail[idx]);
      const cardOn = (k > -.3 ? 1 : 0) * hold * (1 - fin);
      card.style.opacity = (vis * (k > -.3 ? 1 : 0) * (1 - ss(P1, P1 + .03, p))).toFixed(3);
      if (cardOn > .05) {
        const sx = cr.left - cv.left + 18, sy = cr.top - cv.top - 8;
        g.globalCompositeOperation = 'source-over'; g.globalAlpha = .85 * cardOn * vis; g.strokeStyle = items[idx].dataset.color; g.lineWidth = 1;
        g.beginPath(); g.moveTo(sx, sy); g.lineTo(sx, Math.min(sy, anc[1] + 26)); g.lineTo(anc[0], anc[1] + 4); g.stroke();
        g.fillStyle = items[idx].dataset.color; g.beginPath(); g.arc(anc[0], anc[1] + 4, 3.5, 0, 7); g.fill();
      }
      g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
      head.style.opacity = (vis * (1 - ss(-.75, -.35, k))).toFixed(3);
      list.style.opacity = (vis * ss(-.6, -.2, k)).toFixed(3); note.style.opacity = list.style.opacity;
    }
  };
}
