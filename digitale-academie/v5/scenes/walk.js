/*
  PARCOURS · « sept étapes, jusqu'à la lumière »
  Photographie : la nef de la George Peabody Library vue d'une galerie haute (M. Petroff, CC BY-SA 3.0), puis la verrière
  vue d'en dessous (P. Gillespie, CC BY 2.0). Le fil jaune remonte l'axe de la nef : le sol de la salle de lecture, le fond,
  les galeries du fond, jusqu'à la verrière. Travelling avant à vraie parallaxe (les galeries proches s'écartent et sortent
  du cadre, le fond grandit lentement), la caméra se relève vers la lumière ; la 7e étape bascule sous la verrière.
*/
export async function create(ctx, el) {
  const { THREE, ss, damp, eIO, shot, library } = ctx;
  const steps = [...el.querySelectorAll('.v2-walk__step')];
  const counter = el.querySelector('.v2-walk__count'), head = el.querySelector('.v2-walk__head'), box = el.querySelector('.v2-walk__steps');
  const N = steps.length, NAVE = 'b30', SKY = 'b14';
  /* chargées pendant la visite (voir campus.js), pas au démarrage */
  const POSE = { pos: library.center.clone().add(new THREE.Vector3(0, 10, 9)), look: library.center.clone().add(new THREE.Vector3(0, 14, 0)) };
  /* stations sur l'axe de la nef (u,v mesurés sur la photo) : sol proche, allée, portes du fond, galeries du fond, verrière */
  const S = [[.5, .905], [.5, .76], [.5, .628], [.5, .562], [.5, .49], [.5, .398], [.5, .17]].slice(0, N);
  const P0 = .06, P1 = .94, span = (P1 - P0) / N;
  const kOf = p => { if (p < P0) return -1 + ss(0, P0, p); const kr = Math.min(N - 1, (p - P0) / span), k0 = Math.floor(kr); return Math.min(N - 1, k0 + ss(.55, .95, kr - k0)); };
  let active = -2, dAxis = null;
  const on = S.map(() => 0);
  return {
    cam() { return POSE; },
    update(p, t, dt, m, isCurrent) {
      const k = kOf(p), idx = Math.max(0, Math.round(k)), kc = Math.max(0, k);
      /* travelling avant le long de la nef, regard qui se relève ; dernière étape : sous la verrière */
      const portrait = innerWidth < innerHeight, f = kc / (N - 1);
      const v = S[0][1] + (S[Math.min(N - 2, N - 1)][1] - S[0][1]) * eIO(Math.min(1, kc / (N - 2)));
      const pa = { at: [.5 + m.sx * .01, v - .05], zoom: (portrait ? 1.05 : 1.12) + .55 * eIO(f), dolly: 1.1 * eIO(f), d0: .18,
        T: [-m.sx * .03, m.sy * .02], focus: .2 + .3 * (1 - f), dof: .18 };
      const sky = ss(N - 2 + .35, N - 1, k);
      const pb = { at: [.5, .5], zoom: 1.35 - .25 * sky, dolly: .3, d0: .2, roll: (1 - sky) * .35 + t * .004, focus: .2, dof: .1 };
      const shown = shot.show({ a: NAVE, pa, b: sky > 0 ? SKY : null, pb, mix: sky, fade: 1, warm: .55, expo: 1.18 + .1 * sky,
        rays: .3 + .35 * sky, sun: [.5, -.25], vig: .4, lift: .45 }, t, isCurrent);
      if (!shown) return;
      if (!dAxis) dAxis = S.map(([u, vv]) => shot.depthAt('a', u, vv));
      if (idx !== active && k > -.5) {
        if (active >= 0 && isCurrent) ctx.cue('borne');
        active = idx; steps.forEach((li, i) => li.classList.toggle('is-on', i === idx));
        if (counter) counter.textContent = String(idx + 1).padStart(2, '0') + ' / ' + String(N).padStart(2, '0');
      }
      if (k <= -.5 && active !== -2) { active = -2; steps.forEach(li => li.classList.remove('is-on')); }
      S.forEach((_, i) => { on[i] = damp(on[i], i === idx && k > -.5 ? 1 : i < idx ? .45 : .12, 3.5, dt); });
      /* ----- calque : le fil sur l'axe, les sept stations, le trait vers l'étape ----- */
      const visT = ss(0, .04, p) * (1 - ss(.97, 1, p));
      head.style.opacity = (ss(0, .04, p) * (1 - ss(-.4, 0, k))).toFixed(3);
      box.style.opacity = (visT * ss(-.5, -.1, k)).toFixed(3);
      if (counter) counter.style.opacity = box.style.opacity;
      const g = shot.touch(), vis = visT * (1 - sky);
      if (vis < .01) return;
      const pr = (u, vv, d) => shot.project('a', u, vv, d);
      const headV = k < 0 ? S[0][1] + .08 * (1 - ss(-.8, 0, k)) : (() => { const k0 = Math.floor(kc), ff = ss(.05, .95, kc - k0); return S[k0][1] + (S[Math.min(N - 1, k0 + 1)][1] - S[k0][1]) * ff; })();
      const pts = []; for (let vv = .99; vv >= headV; vv -= .006) pts.push(pr(.5, vv));
      pts.push(pr(.5, headV));
      g.globalCompositeOperation = 'lighter'; g.lineCap = 'round'; g.lineJoin = 'round';
      if (pts.length > 1) {
        g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); pts.forEach(q => g.lineTo(q[0], q[1]));
        g.strokeStyle = '#FFD600';
        for (const [w, a] of [[10, .12], [4, .4], [1.7, 1]]) { g.globalAlpha = a * vis; g.lineWidth = w; g.stroke(); }
      }
      S.forEach(([u, vv], i) => {
        const q = pr(u, vv, dAxis[i]), r = 3 + 3 * on[i];
        g.globalAlpha = (.35 + .65 * on[i]) * vis; g.fillStyle = i <= idx ? '#FFE680' : '#FFFFFF';
        g.beginPath(); g.arc(q[0], q[1], r, 0, 7); g.fill();
        if (i === idx) { g.globalAlpha = .3 * vis; g.beginPath(); g.arc(q[0], q[1], 12 + 3 * Math.sin(t * 3), 0, 7); g.fill(); }
      });
      /* trait de l'étape active vers sa station */
      const cur = steps[idx], cv = ctx.renderer.domElement.getBoundingClientRect();
      if (cur && k > -.3) {
        const r = cur.querySelector('h3').getBoundingClientRect(), q = pr(S[idx][0], S[idx][1], dAxis[idx]);
        const sx = r.left - cv.left + Math.min(r.width, 260) + 18, sy = r.top - cv.top + r.height * .5;
        const hold = 1 - Math.min(1, Math.abs(k - Math.round(k)) * 3);
        g.globalCompositeOperation = 'source-over'; g.globalAlpha = .8 * hold * vis; g.strokeStyle = '#FFD600'; g.lineWidth = 1;
        g.beginPath(); g.moveTo(sx, sy); g.lineTo(Math.max(sx + 20, q[0] - 30), sy); g.lineTo(q[0] - 9, q[1]); g.stroke();
      }
      g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    }
  };
}
