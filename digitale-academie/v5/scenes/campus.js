/*
  III · LA VISITE · uniquement les vraies salles
  Les photos de la Ville (salle Frida Kahlo, salle Nelson Mandela, salle d'étude), mises en volume depuis leur prise de vue :
  dans le noir, un néon claque, la salle apparaît, on y avance ; elle s'éteint, la suivante s'allume.
  L'accueil et la salle informatique n'ont pas de photo publiée : ils sont nommés (texte), jamais inventés en images.
*/
import { flicker } from '../world/photorooms.js';

export async function create(ctx, el) {
  const { ss, eIO, photoRooms } = ctx;
  const rooms = [...el.querySelectorAll('.v2-room')];
  /* salles 01 et 02 : texte seul dans le noir ; 03 à 05 : les photos */
  const PHOTO = [['kahlo', .14, .42], ['mandela', .42, .7], ['salle', .7, .98]].filter(([id]) => photoRooms && photoRooms.rooms[id]);
  const first = PHOTO[0];
  const segOf = p => PHOTO.find(([, a, b]) => p >= a && p < b) || (p < first[1] ? first : PHOTO[PHOTO.length - 1]);
  const roomIdx = p => p < .07 ? 0 : p < .14 ? 1 : p < .42 ? 2 : p < .7 ? 3 : 4;
  let active = -1, lastNeon = '';
  return {
    cam(p, m) {
      const [id, a, b] = segOf(p), R = photoRooms.rooms[id], k = clamp01((p - a) / (b - a));
      const v = R.view(eIO(Math.min(1, k * 1.05)) * .85 + k * .15, m);
      return { ...v, fov: R.fit(ctx.camera.aspect), cut: id, hard: true };
    },
    update(p, t, dt, m, isCurrent) {
      const idx = roomIdx(p);
      if (idx !== active) { if (active >= 0 && isCurrent && idx < 2) ctx.cue('borne'); active = idx; rooms.forEach((r, i) => r.classList.toggle('is-on', i === idx)); }
      el.classList.toggle('is-dark', p < .14);
      if (!isCurrent) return;
      const seg = segOf(p);
      PHOTO.forEach(([id, a, b]) => {
        const R = photoRooms.rooms[id], k = (p - a) / (b - a), here = seg[0] === id;
        R.group.visible = here && p >= first[1] - .01;
        if (!here) return;
        R.U.uLight.value = flicker(ss(.02, .28, k)) * (1 - ss(.88, .995, k));
        R.U.uExpo.value = 1.02 + .05 * Math.sin(t * 50) * (1 - ss(.28, .38, k)) * ss(.02, .1, k);   /* bourdonnement du tube à l'allumage */
        if (k > .02 && lastNeon !== id) { lastNeon = id; ctx.cue('neon'); }
      });
      if (p < first[1]) lastNeon = '';
      photoRooms.group.visible = p >= first[1] - .01;
      ctx.bloom.threshold = 1.1; ctx.bloom.strength = .35;
    }
  };
}
const clamp01 = x => Math.min(1, Math.max(0, x));
