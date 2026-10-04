/*
  CAMPUS · la visite du lieu réel, puis le papier peint qui devient réel
  Cafétéria → salle informatique → salle Frida Kahlo → salle Nelson Mandela → salle d'étude.
  Au fond de la salle d'étude, le grand papier peint de bibliothèque : on s'en approche, il s'efface,
  et la bibliothèque est là, immense.
*/
export async function create(ctx, el) {
  const { THREE, ss, eIO, pavilion } = ctx;
  const rooms = [...el.querySelectorAll('.v2-room')];
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const STOPS = [
    { pos: V(3.4, 1.6, -2.9), look: V(8.5, 1.1, -5.8) },     /* accueil, cafétéria */
    { pos: V(-.8, 1.6, -3.4), look: V(-8, 1, -6.4) },         /* salle informatique */
    { pos: V(-7, 1.6, 4.2), look: V(-11.9, 1.45, 2) },        /* Frida Kahlo */
    { pos: V(7, 1.6, 4.2), look: V(11.9, 1.45, 2) },          /* Nelson Mandela */
    { pos: V(0, 1.6, -7.2), look: V(0, 1.45, -15.9) }         /* salle d'étude, face au papier peint */
  ];
  const N = Math.min(rooms.length, STOPS.length);
  const END = { pos: V(0, 1.6, -12.6), look: V(0, 2.4, -30) };   /* on s'arrête à quelques pas : le mur de livres s'arrache devant nous */
  const kOf = p => { const kr = Math.min(1, Math.max(0, p / .78)) * (N - 1), k0 = Math.floor(kr); return k0 + ss(.35, .65, kr - k0); };
  let active = -1;
  return {
    cam(p, m) {
      const k = kOf(p), a = STOPS[Math.floor(k)], b = STOPS[Math.min(N - 1, Math.ceil(k))], f = k - Math.floor(k);
      let pos = a.pos.clone().lerp(b.pos, f), look = a.look.clone().lerp(b.look, f);
      const go = eIO(ss(.8, 1, p));                                 /* on marche vers le papier peint */
      pos.lerp(END.pos, go); look.lerp(END.look, go);
      pos.x += m.sx * .25 * (1 - go); pos.y += m.sy * .1;
      return { pos, look };
    },
    update(p, t, dt, m, isCurrent) {
      const idx = Math.round(kOf(p));
      if (idx !== active) { if (active >= 0 && isCurrent) ctx.cue('borne'); active = idx; rooms.forEach((r, i) => r.classList.toggle('is-on', i === idx)); }
      el.querySelector('.v2-rooms').style.opacity = 1 - ss(.86, .94, p);
      pavilion.dissolveMural(ss(.88, .99, p));
      pavilion.lampHeads.forEach((b, i) => b.scale.setScalar(1 + .15 * Math.sin(t * 3 + i)));
      if (isCurrent) {
        const { key, rim } = ctx.lights, s = STOPS[idx];
        key.position.copy(s.pos).add(new THREE.Vector3(0, .9, 0)); key.color.set('#FFF1DC'); key.intensity = 16;
        rim.position.set(0, 2.2, -12); rim.color.set('#FFDDA8'); rim.intensity = 10 + 40 * ss(.75, 1, p);
      }
    }
  };
}
