/*
  ACCOMPAGNEMENT · d'abord le silence : une vraie photo, la lumière douce, « Tu n'étudies pas seul » — le titre passe derrière
  l'étudiante du premier plan, deux fils de lumière (jaune, cyan : les deux coachs) traversent la salle.
  Puis la salle de lecture de la George Peabody Library (P. Gillespie, CC BY 2.0), en profondeur : les sept ateliers sont
  des lanternes qui quittent les tables de lecture et montent vers la verrière ; la caméra s'élève avec elles.
  Les deux coachs sont deux lucioles (jaune, cyan) qui accompagnent la lanterne qui s'élève.
*/
export async function create(ctx, el) {
  const { THREE, ss, eOut, eIO, damp, library, shot } = ctx;
  const G = new THREE.Group(); G.visible = false;
  const items = [...el.querySelectorAll('.v2-work li')];
  const supports = [...el.querySelectorAll('.v2-human__list > div')];
  const N = items.length, IMG = 'b15';
  /* chargée pendant la visite (voir campus.js), pas au démarrage */
  const POSE = { pos: library.center.clone().add(new THREE.Vector3(0, 3, 9)), look: library.center.clone().add(new THREE.Vector3(0, 6, 0)) };
  /* départ : les tables de lecture (mesurées sur la photo) ; arrivée : sous la verrière, en éventail */
  const START = [[.4, .86], [.6, .85], [.43, .81], [.57, .8], [.46, .78], [.54, .78], [.5, .77]];
  const END = [[.4, .46], [.6, .4], [.44, .3], [.57, .26], [.47, .38], [.54, .2], [.5, .32]];
  const lanterns = items.map((li, i) => ({ li, s: START[i % 7], e: END[i % 7], ph: i * 1.7, on: 0, d: null }));
  const trails = [[], []];
  /* la rupture (photo réelle) occupe le premier quart du chapitre ; les lanternes partent ensuite */
  const Q0 = .3, launchAt = i => Q0 + .05 + i * .075;
  const photo = el.querySelector('.v2-human__photo'), stage = el.querySelector('.v2-stage');
  const threads = photo ? [...photo.querySelectorAll('.v2-thread')].map((path, k) => {
    const L = path.getTotalLength(); path.style.strokeDasharray = L; path.style.strokeDashoffset = L;
    return { path, L, head: photo.querySelectorAll('.v2-thread__head')[k] };
  }) : [];
  let quietSaid = false;
  let active = -1;
  const lift = (o, i, p) => eOut(ss(launchAt(i), launchAt(i) + .28, p));
  return {
    group: G,
    cam() { return POSE; },
    update(p, t, dt, m, isCurrent) {
      let idx = 0;
      lanterns.forEach((o, i) => { if (p >= launchAt(i)) idx = i; o.on = damp(o.on, i === idx && p >= launchAt(i) ? 1 : 0, 4, dt); });
      if (idx !== active) { if (active >= 0 && isCurrent) ctx.cue('borne'); active = idx; items.forEach((li, i) => li.classList.toggle('is-on', i === idx && p >= launchAt(0))); }
      let cur = -1; supports.forEach((d, i) => { const o = p > Q0 + .02 + i * .05; d.classList.toggle('is-on', o); if (o) cur = i; });
      supports.forEach((d, i) => d.classList.toggle('is-cur', i === cur));
      /* le silence : la scène s'éteint, la vraie salle apparaît, le titre glisse derrière l'étudiante */
      const quiet = p < Q0 - .04;
      el.classList.toggle('is-quiet', quiet);
      if (photo) {
        const o = ss(.01, .06, p) * (1 - ss(Q0 - .07, Q0 - .01, p));
        stage.style.setProperty('--o', o.toFixed(3));
        stage.style.setProperty('--k', (1.07 - .05 * ss(0, Q0, p)).toFixed(4));
        threads.forEach((th, k) => {
          const d = ss(.08 + k * .03, .22 + k * .03, p), at = th.path.getPointAtLength(th.L * d);
          th.path.style.strokeDashoffset = (th.L * (1 - d)).toFixed(1);
          th.head.setAttribute('cx', at.x.toFixed(1)); th.head.setAttribute('cy', at.y.toFixed(1)); th.head.style.opacity = d > .001 && d < .999 ? 1 : 0;
        });
        if (isCurrent && ctx.fx) ctx.fx.uniforms.uBlack.value = ss(0, .05, p) * (1 - ss(Q0 - .06, Q0 + .02, p));
      }
      if (isCurrent && quiet && p > .03 && !quietSaid) { quietSaid = true; ctx.cue('calme'); }
      if (isCurrent && !quiet && quietSaid) { quietSaid = false; ctx.cue('reprise'); }
      /* ----- la salle de lecture en profondeur : la caméra s'élève avec la lanterne ----- */
      const u = ss(Q0 - .06, 1, p), portrait = innerWidth < innerHeight;
      const at = [.5 + m.sx * .01, .7 - .42 * eIO(ss(Q0, .95, p))], zoom = (portrait ? 1.08 : 1.2) + .25 * eIO(u);
      const shown = shot.show({ a: IMG, pa: { at, zoom, T: [-m.sx * .03, (at[1] - .7) * .6], dolly: .5 * eIO(u), d0: .25, focus: .55, dof: .14 },
        fade: ss(Q0 - .06, Q0 + .02, p), warm: .55, expo: 1.12, rays: .28, sun: [.5, -.2], vig: .6, lift: .3 }, t, isCurrent);
      if (!shown || p < Q0 - .06) return;
      const g = shot.touch(), vis = ss(Q0 - .02, Q0 + .04, p) * (1 - ss(.97, 1, p));
      g.globalCompositeOperation = 'lighter';
      const pos = lanterns.map((o, i) => {
        if (o.d == null) o.d = shot.depthAt('a', o.s[0], o.s[1]);
        const l = lift(o, i, p), uu = o.s[0] + (o.e[0] - o.s[0]) * l + Math.sin(t * .6 + o.ph) * .006 * l, vv = o.s[1] + (o.e[1] - o.s[1]) * l + Math.sin(t * .9 + o.ph) * .004;
        return shot.project('a', uu, vv - .012, o.d);  /* [x, y, disparité] */
      });
      /* lanternes de papier : halo chaud qui éclaire la salle, corps lumineux ; la lanterne active brille davantage.
         Pas d'étiquette ici : la liste des ateliers (à droite) nomme celle qui s'élève */
      lanterns.forEach((o, i) => {
        if (p < launchAt(i) - .04) return;
        const q = pos[i], born = ss(launchAt(i) - .04, launchAt(i), p), sz = (16 + 34 * Math.max(0, q[2] - .25)) * (ctx.mobile ? .75 : 1) * Math.min(1.4, innerHeight / 800), fl = .88 + .12 * Math.sin(t * 9 + o.ph);
        const R = sz * (5 + 2 * o.on), gr = g.createRadialGradient(q[0], q[1], 0, q[0], q[1], R);
        gr.addColorStop(0, `rgba(255,190,110,${(.32 + .25 * o.on) * fl * vis * born})`); gr.addColorStop(.35, `rgba(255,140,50,${.12 * vis * born})`); gr.addColorStop(1, 'rgba(255,120,40,0)');
        g.fillStyle = gr; g.beginPath(); g.arc(q[0], q[1], R, 0, 7); g.fill();
        const w = sz * .9, h = sz * 1.25, body = g.createLinearGradient(q[0], q[1] - h, q[0], q[1] + h);
        body.addColorStop(0, `rgba(255,200,130,${.9 * vis * born})`); body.addColorStop(.6, `rgba(255,236,190,${vis * born})`); body.addColorStop(1, `rgba(255,170,90,${.9 * vis * born})`);
        g.fillStyle = body; g.beginPath(); g.ellipse(q[0], q[1], w, h, 0, 0, 7); g.fill();
        g.globalCompositeOperation = 'source-over'; g.globalAlpha = .55 * vis * born; g.fillStyle = '#3A2414';
        g.fillRect(q[0] - w * .55, q[1] - h - 1.5, w * 1.1, 2.5); g.fillRect(q[0] - w * .45, q[1] + h - 1, w * .9, 2);
        g.globalAlpha = 1; g.globalCompositeOperation = 'lighter';
      });
      /* les deux coachs : deux lucioles qui tournent autour de la lanterne qui s'élève */
      const c0 = pos[idx];
      ['#FFD600', '#00BBDB'].forEach((col, k) => {
        const a = t * 1.3 + k * Math.PI, R = 46 + 10 * Math.sin(t * .7 + k), x = c0[0] + Math.cos(a) * R, y = c0[1] + Math.sin(a * 1.4 + k) * R * .45;
        const tr = trails[k]; tr.unshift([x, y]); if (tr.length > 26) tr.pop();
        g.strokeStyle = col; g.lineCap = 'round';
        for (let j = 1; j < tr.length; j++) { g.globalAlpha = (1 - j / tr.length) * .8 * vis; g.lineWidth = 2.4 * (1 - j / tr.length) + .4; g.beginPath(); g.moveTo(tr[j - 1][0], tr[j - 1][1]); g.lineTo(tr[j][0], tr[j][1]); g.stroke(); }
        g.globalAlpha = vis; g.fillStyle = col; g.beginPath(); g.arc(x, y, 3.2, 0, 7); g.fill();
        g.globalAlpha = .35 * vis; g.beginPath(); g.arc(x, y, 9, 0, 7); g.fill();
      });
      g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    }
  };
}
