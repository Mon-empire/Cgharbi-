/*
  PARCOURS · l'escalier en colimaçon
  Sept paliers sur l'escalier central de la bibliothèque, du rez-de-chaussée vers la verrière.
  Le fil jaune court sur la rampe et s'allume palier après palier ; la caméra monte en tournant.
*/
export async function create(ctx, el) {
  const { THREE, ss, damp, library } = ctx;
  const steps = [...el.querySelectorAll('.v2-walk__step')];
  const counter = el.querySelector('.v2-walk__count');
  const N = steps.length, C = library.center;
  const L = library.landings.slice(0, N);
  const shot = (k, m) => {
    const l = L[Math.min(N - 1, Math.max(0, k))], a = l.a + .55;
    const pos = C.clone().add(new THREE.Vector3(Math.cos(a) * 8.5, l.h + 2.2, Math.sin(a) * 8.5));
    return { pos, look: C.clone().add(l.pos).add(new THREE.Vector3(0, 1.1, 0)) };
  };
  const kOf = p => { const kr = Math.min(1, Math.max(0, p * 1.03 - .015)) * (N - 1), k0 = Math.floor(kr); return k0 + ss(.3, .7, kr - k0); };
  let active = -1;
  return {
    cam(p, m) {
      const k = kOf(p), k0 = Math.floor(k), f = k - k0;
      const a = shot(k0, m), b = shot(k0 + 1, m);
      /* entre deux paliers, la caméra tourne autour de la colonne (interpolation angulaire) */
      const la = L[Math.min(N - 1, k0)].a + .55, lb = L[Math.min(N - 1, k0 + 1)].a + .55, ang = la + (lb - la) * f;
      const y = a.pos.y + (b.pos.y - a.pos.y) * f;
      const pos = C.clone().add(new THREE.Vector3(Math.cos(ang) * 8.5 + m.sx * .5, y + m.sy * .4, Math.sin(ang) * 8.5));
      return { pos, look: a.look.clone().lerp(b.look, f) };
    },
    update(p, t, dt, m, isCurrent) {
      const idx = Math.round(kOf(p));
      if (idx !== active) {
        if (active >= 0 && isCurrent) ctx.cue('borne');
        active = idx; steps.forEach((li, i) => li.classList.toggle('is-on', i === idx));
        if (counter) counter.textContent = String(idx + 1).padStart(2, '0') + ' / ' + String(N).padStart(2, '0');
      }
      L.forEach((l, i) => {
        l.on = damp(l.on, i === idx ? 1 : i < idx ? .4 : 0, 4, dt);
        l.ring.material.opacity = .15 + .85 * l.on;
        l.num.children.forEach(c => { c.material.emissiveIntensity = .2 + 1.6 * l.on; });
        l.num.lookAt(ctx.camera.position);
      });
      const prog = Math.min(1, (L[idx].h + 1) / library.TOP);
      library.filGeo.setDrawRange(0, Math.floor(prog * 800) * 8 * 6);
      if (isCurrent) { const { key, rim } = ctx.lights; key.position.copy(C).add(L[idx].pos).add(new THREE.Vector3(0, 2.5, 0)); key.color.set('#FFD98A'); key.intensity = 45; rim.position.copy(C).add(new THREE.Vector3(0, library.TOP, 0)); rim.color.set('#9DB8FF'); rim.intensity = 220; }
    }
  };
}
