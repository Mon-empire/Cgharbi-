/*
  VI · LES VEILLEURS · après la lumière, le silence et l'humain
  La 3D s'éteint. Une vraie photo (étudiantes et étudiants au travail à la Digitale Académie), plein cadre, qui respire.
  « Tu n'étudies pas seul. » — seul, lisible, sur la zone sombre de l'image. Puis l'accompagnement et les ateliers,
  posés sur la photo assombrie. La musique se retire pendant le silence.
*/
export async function create(ctx, el) {
  const { THREE, ss, TOWER, TOWER_TOP } = ctx;
  const items = [...el.querySelectorAll('.v2-work li')];
  const supports = [...el.querySelectorAll('.v2-human__list > div')];
  const stage = el.querySelector('.v2-stage');
  const POS = TOWER.clone().add(new THREE.Vector3(0, TOWER_TOP + 1, 13)), LOOK = TOWER.clone().add(new THREE.Vector3(0, TOWER_TOP - 2, 0));
  let quietSaid = false, active = -1;
  return {
    cam() { return { pos: POS.clone(), look: LOOK.clone(), cut: 'tour' }; },
    update(p, t, dt, m, isCurrent) {
      /* la photo : elle arrive du noir, recule très lentement (respiration), puis s'assombrit sous le contenu */
      const o = ss(.0, .08, p) * (1 - ss(.94, 1, p));
      stage.style.setProperty('--o', o.toFixed(3));
      stage.style.setProperty('--k', (1.08 - .07 * ss(0, 1, p)).toFixed(4));
      stage.style.setProperty('--dim', ss(.3, .38, p).toFixed(3));
      const quiet = p < .32;
      el.classList.toggle('is-quiet', quiet);
      supports.forEach((d, i) => d.classList.toggle('is-on', p > .36 + i * .05));
      const idx = Math.max(-1, Math.min(items.length - 1, Math.floor((p - .5) / .065)));
      if (idx !== active) { if (idx >= 0 && isCurrent) ctx.cue('borne'); active = idx; items.forEach((li, i) => li.classList.toggle('is-on', i === idx)); }
      if (isCurrent) {
        ctx.fx.uniforms.uBlack.value = ss(0, .06, p) * (1 - ss(.94, 1, p));
        if (quiet && p > .03 && !quietSaid) { quietSaid = true; ctx.cue('calme'); }
        if (!quiet && quietSaid) { quietSaid = false; ctx.cue('reprise'); }
      }
    }
  };
}
