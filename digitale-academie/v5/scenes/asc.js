/*
  FORMATIONS · les galeries de la bibliothèque
  Chaque formation est un lutrin éclairé sur la galerie de son niveau : DAEU au rez-de-chaussée, BTS au premier,
  Licence et Bachelor au deuxième, Master tout en haut, DU sur une galerie latérale. Monter, c'est progresser.
*/
export async function create(ctx, el) {
  const { THREE, ss, damp, library } = ctx;
  const items = [...el.querySelectorAll('.v2-step')];
  const levelEl = el.querySelector('.v2-asc__level');
  const head = el.querySelector('.v2-asc__head'), list = el.querySelector('.v2-steps'), note = el.querySelector('.v2-asc__note');
  const N = items.length, up = new THREE.Vector3(0, 1, 0);
  const shots = library.anchors.map((a, i) => {
    items[i].style.setProperty('--c', items[i].dataset.color);
    const btn = items[i].querySelector('button');
    /* choisir une formation : la caméra suit le fil jusqu'à son lutrin */
    btn.addEventListener('click', () => ctx.scrollTo('asc', (i + .5) / N));
    /* survol ou focus clavier : le lutrin s'allume et la caméra y jette un regard, sans quitter la formation en cours */
    const on = () => { preview = i; }, off = () => { if (preview === i) preview = -1; };
    btn.addEventListener('pointerenter', on); btn.addEventListener('focus', on);
    btn.addEventListener('pointerleave', off); btn.addEventListener('blur', off);
    const w = new THREE.Vector3(); a.g.getWorldPosition(w);
    const fwd = a.inward.clone().negate(), right = new THREE.Vector3().crossVectors(fwd, up).normalize();
    return {
      pos: w.clone().addScaledVector(a.inward, 6).add(new THREE.Vector3(0, 2.3, 0)).addScaledVector(right, -1.2),
      look: w.clone().add(new THREE.Vector3(0, 1.5, 0)).addScaledVector(right, 2.6),
      light: w.clone().add(new THREE.Vector3(0, 3, 0)).addScaledVector(a.inward, 1.5)
    };
  });
  const kOf = p => { const kr = Math.min(1, Math.max(0, p * 1.04 - .02)) * (N - 1), k0 = Math.floor(kr); return k0 + ss(.38, .62, kr - k0); };
  let active = -1, lastLv = '', preview = -1, glance = 0, glanceAt = 0;
  return {
    cam(p, m) {
      const k = kOf(p), a = shots[Math.floor(k)], b = shots[Math.min(N - 1, Math.ceil(k))], f = k - Math.floor(k);
      const pos = a.pos.clone().lerp(b.pos, f); pos.y += Math.sin(f * Math.PI) * 2.5 + m.sy * .5; pos.x += m.sx * .8;
      const look = a.look.clone().lerp(b.look, f);
      if (glance > .001 && shots[glanceAt]) { look.lerp(shots[glanceAt].look, .45 * glance); pos.lerp(shots[glanceAt].pos, .12 * glance); }
      return { pos, look };
    },
    update(p, t, dt, m, isCurrent) {
      const idx = Math.round(kOf(p));
      if (idx !== active) {
        if (active >= 0 && isCurrent) ctx.cue('borne');
        active = idx; items.forEach((li, i) => li.classList.toggle('is-on', i === idx));
        const lv = items[idx].dataset.lv;
        if (lv !== lastLv) { lastLv = lv; levelEl.textContent = lv; levelEl.animate([{ opacity: 0, transform: 'translateY(6%)' }, { opacity: 1, transform: 'none' }], { duration: 700, easing: 'cubic-bezier(.2,.8,.2,1)' }); }
      }
      if (preview >= 0 && preview !== idx) glanceAt = preview;
      glance = damp(glance, preview >= 0 && preview !== idx && isCurrent ? 1 : 0, 3, dt);
      library.anchors.forEach((a, i) => {
        a.on = damp(a.on, i === idx ? 1 : i === preview ? .75 : 0, 4, dt);
        a.bookMat.emissiveIntensity = .3 + 2.2 * a.on;
        a.aura.material.opacity = .12 + .6 * a.on;
        a.glow.scale.setScalar(.6 + .8 * a.on + .1 * Math.sin(t * 3 + i));
        a.label.children.forEach(c => { c.material.emissiveIntensity = .2 + 1.4 * a.on; });
        a.label.lookAt(ctx.camera.position);
      });
      if (isCurrent) { const { key, rim } = ctx.lights; key.position.copy(shots[idx].light); key.color.set('#FFE2B0'); key.intensity = 60; rim.position.copy(library.center).add(new THREE.Vector3(0, library.TOP, 0)); rim.color.set('#9DB8FF'); rim.intensity = 200; }
      const vis = ss(0, .05, p) * (1 - ss(.96, 1, p));
      head.style.opacity = vis; list.style.opacity = vis; levelEl.style.opacity = vis; note.style.opacity = vis;
    }
  };
}
