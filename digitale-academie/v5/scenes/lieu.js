/*
  CAMPUS (seuil) · on passe la porte
  La caméra franchit la porte double et découvre l'accueil et la cafétéria ; les chiffres confirmés apparaissent.
*/
export async function create(ctx, el) {
  const { THREE, ss, eOut, eIO } = ctx;
  const label = el.querySelector('.v2-label'), title = el.querySelector('.v2-lieu__t'), spaces = el.querySelector('.v2-lieu__spaces');
  const facts = [...el.querySelectorAll('.v2-facts li')];
  const A = { pos: new THREE.Vector3(2.05, 1.62, 2.4), look: new THREE.Vector3(2.05, 1.45, -6) };
  const B = { pos: new THREE.Vector3(2.6, 1.62, -3.2), look: new THREE.Vector3(8, 1.1, -5.6) };
  return {
    cam(p, m) {
      const k = eIO(ss(0, .7, p));
      return { pos: A.pos.clone().lerp(B.pos, k).add(new THREE.Vector3(m.sx * .25, m.sy * .12, 0)), look: A.look.clone().lerp(B.look, k) };
    },
    update(p, t, dt, m, isCurrent) {
      const r1 = eOut(ss(.12, .3, p));
      label.style.opacity = r1; title.style.opacity = r1; title.style.transform = `translate3d(0,${(1 - r1) * 40}px,0)`;
      facts.forEach((li, i) => { const r = eOut(ss(.3 + i * .08, .46 + i * .08, p)); li.style.opacity = r; li.style.transform = `translate3d(0,${(1 - r) * 50}px,0)`; });
      if (spaces) spaces.style.opacity = eOut(ss(.55, .7, p));
      if (isCurrent && p > .3) { const { key, rim } = ctx.lights; key.position.set(5, 2.4, -4.5); key.color.set('#FFF1DC'); key.intensity = 18; rim.position.set(-4, 2.4, -5); rim.color.set('#EAF2FF'); rim.intensity = 14; }
    }
  };
}
