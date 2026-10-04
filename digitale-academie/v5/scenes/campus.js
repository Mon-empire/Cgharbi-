/*
  III · LA VISITE · des salles modélisées aux vraies salles, puis le papier peint qui devient réel
  Cafétéria → salle informatique (reconstitution 3D) ; les néons s'éteignent. Dans le noir, un néon claque :
  on est dans la vraie salle Frida Kahlo — la photo de la Ville, en volume — et on y avance. Puis la salle Nelson Mandela,
  puis la salle d'étude. Les néons s'éteignent une dernière fois : seules restent les lampes de bureau, face au grand
  papier peint de bibliothèque. On s'en approche, il s'efface, et la bibliothèque est là, immense.
*/
import { flicker } from '../world/photorooms.js';

export async function create(ctx, el) {
  const { THREE, ss, eIO, pavilion, photoRooms } = ctx;
  const rooms = [...el.querySelectorAll('.v2-room')];
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  /* plans modélisés */
  const CAFE = { pos: V(3.4, 1.6, -2.9), look: V(8.5, 1.1, -5.8) };
  const INFO = { pos: V(-.8, 1.6, -3.4), look: V(-8, 1, -6.4) };
  const STUDY0 = { pos: V(0, 1.6, -8.6), look: V(0, 1.5, -16) };
  const END = { pos: V(0, 1.6, -12.6), look: V(0, 2.4, -30) };   /* on s'arrête à quelques pas : le mur de livres s'arrache devant nous */
  /* les vraies salles : [début, fin] dans le chapitre */
  const PHOTO = [['kahlo', .32, .48], ['mandela', .48, .635], ['salle', .635, .79]].filter(([id]) => photoRooms && photoRooms.rooms[id]);
  const segOf = p => PHOTO.find(([, a, b]) => p >= a && p < b);
  const roomIdx = p => p < .15 ? 0 : p < .31 ? 1 : p < .48 ? 2 : p < .635 ? 3 : 4;
  let active = -1, lastNeon = '';
  return {
    cam(p, m) {
      const seg = segOf(p);
      if (seg) {
        const [id, a, b] = seg, R = photoRooms.rooms[id], k = (p - a) / (b - a);
        const v = R.view(eIO(Math.min(1, k * 1.05)) * .85 + k * .15, m);
        return { ...v, fov: R.fit(ctx.camera.aspect), cut: id, hard: true };
      }
      if (p >= .79) {
        const k = eIO(ss(.81, .97, p));
        const pos = STUDY0.pos.clone().lerp(END.pos, k), look = STUDY0.look.clone().lerp(END.look, eIO(ss(.88, 1, p)));
        pos.x += m.sx * .15; pos.y += m.sy * .06;
        return { pos, look, cut: 'etude' };
      }
      const k = eIO(ss(.1, .22, p));
      const pos = CAFE.pos.clone().lerp(INFO.pos, k), look = CAFE.look.clone().lerp(INFO.look, k);
      pos.x += m.sx * .25; pos.y += m.sy * .1;
      return { pos, look, cut: 'pavillon' };
    },
    update(p, t, dt, m, isCurrent) {
      const idx = roomIdx(p);
      if (idx !== active) { if (active >= 0 && isCurrent && idx < 2) ctx.cue('borne'); active = idx; rooms.forEach((r, i) => r.classList.toggle('is-on', i === idx)); }
      el.querySelector('.v2-rooms').style.opacity = 1 - ss(.86, .94, p);
      pavilion.dissolveMural(ss(.88, .99, p));
      pavilion.lampHeads.forEach((b, i) => b.scale.setScalar(1 + .15 * Math.sin(t * 3 + i)));

      /* vraies salles : néon qui s'allume en battant, avancée lente, puis extinction */
      const seg = segOf(p);
      PHOTO.forEach(([id, a, b]) => {
        const R = photoRooms.rooms[id], k = (p - a) / (b - a), here = seg && seg[0] === id;
        R.group.visible = !!here;
        if (!here) return;
        R.U.uLight.value = flicker(ss(.02, .3, k)) * (1 - ss(.86, .99, k));
        R.U.uExpo.value = 1.02 + .06 * Math.sin(t * 50) * (1 - ss(.3, .4, k)) * ss(.02, .1, k);   /* bourdonnement du tube à l'allumage */
        if (isCurrent && k > .02 && lastNeon !== id) { lastNeon = id; ctx.cue('neon'); }
      });
      if (!seg && p < .3) lastNeon = '';
      if (photoRooms) photoRooms.group.visible = isCurrent && !!seg;

      if (isCurrent) {
        /* le noir entre les mondes : les néons du pavillon s'éteignent avant la première vraie salle, puis avant l'étude */
        const out1 = ss(.27, .315, p) * (1 - ss(.32, .33, p)), out2 = ss(.765, .79, p) * (1 - ss(.8, .83, p));
        if (ctx.fx) ctx.fx.uniforms.uBlack.value = Math.max(out1, out2);
        const study = p >= .79;
        if (ctx.bloom) { ctx.bloom.threshold = 1.15; ctx.bloom.strength = study ? .6 : .4; }
        pavilion.power(study ? 0 : 1 - ss(.27, .31, p));
        if (ctx.ambient) ctx.ambient(study ? .05 : 1 - .9 * ss(.27, .31, p));
        const { key, rim } = ctx.lights;
        if (study) {
          /* seules les lampes de bureau ; le papier peint s'éclaire de l'intérieur */
          key.position.set(0, 1.4, -11.2); key.color.set('#FFD9A0'); key.intensity = 9;
          rim.position.set(0, 2.2, -14.5); rim.color.set('#FFDDA8'); rim.intensity = 6 + 40 * ss(.86, 1, p);
        } else {
          const s = idx === 0 ? CAFE : INFO;
          key.position.copy(s.pos).add(V(0, .9, 0)); key.color.set('#FFF1DC'); key.intensity = 12;
          rim.position.set(0, 2.2, -12); rim.color.set('#FFDDA8'); rim.intensity = 8;
        }
      }
    }
  };
}
