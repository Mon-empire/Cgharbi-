/*
  IV · LES SAVOIRS · une tour de lumière dans le noir
  Un fil jaune monte ; à chaque niveau, un anneau de lumière aux couleurs du logo et le nom du diplôme, en grand.
  DAEU (accès) → BTS (Bac+2) → Licence et Bachelor (Bac+3, côte à côte) → Master (Bac+5). Le DU est à part, sur une
  branche : sa durée et son niveau varient (c'est ce que dit la page, rien de plus).
  Survol / focus d'une formation : son anneau s'allume, la caméra y jette un regard. Clic : la caméra monte jusqu'à elle.
*/
export async function create(ctx, el) {
  const { THREE, ss, damp, TOWER } = ctx;
  const items = [...el.querySelectorAll('.v2-step')];
  const levelEl = el.querySelector('.v2-asc__level');
  const N = items.length, V = (x, y, z) => new THREE.Vector3(x, y, z);
  const G = new THREE.Group(); G.visible = false; ctx.scene.add(G); ctx.tower = G;   /* la tour reste visible sous le chemin */
  /* places : hauteur et décalage selon le niveau affiché sur la page */
  const PLACE = { daeu: [0, 2, 3.4], bts: [0, 7, 3.4], licence: [-3.1, 12, 2.6], bachelor: [3.1, 12, 2.6], master: [0, 17, 3.4], du: [-9, 9.5, 2.2] };
  let preview = -1, glance = 0, glanceAt = 0, active = -1, lastLv = '';
  const anchors = items.map((li, i) => {
    const id = li.dataset.id, [dx, y, r] = PLACE[id] || [0, 2 + i * 3, 3], col = new THREE.Color(li.dataset.color || '#FFD600');
    li.style.setProperty('--c', li.dataset.color);
    const c = TOWER.clone().add(V(dx, y, 0));
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r, .016, 8, 180), new THREE.MeshBasicMaterial({ color: col.clone().multiplyScalar(1.6), transparent: true, toneMapped: false, blending: THREE.AdditiveBlending, depthWrite: false }));
    ring.rotation.x = Math.PI / 2; ring.position.copy(c); G.add(ring);
    /* un disque de lumière très doux sous l'anneau : le « palier » */
    const disc = new THREE.Mesh(new THREE.CircleGeometry(r, 64), new THREE.ShaderMaterial({
      uniforms: { uC: { value: col.clone() }, uI: { value: .1 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, side: THREE.DoubleSide,
      vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader: 'uniform vec3 uC;uniform float uI;varying vec2 vUv;void main(){float d=length(vUv-.5)*2.;gl_FragColor=vec4(uC*smoothstep(1.,.2,d)*.35*uI,1.);}'
    }));
    disc.rotation.x = -Math.PI / 2; disc.position.copy(c); G.add(disc);
    const label = ctx.buildText(ctx.fontHeavy, li.querySelector('.v2-step__btn').lastChild.textContent.trim(), ctx.mobile ? .7 : .95, .02, 0, ctx.textMat('#F2EEE6', .85));
    label.position.copy(c).add(V(0, .55, 0)); G.add(label);
    const btn = li.querySelector('button');
    btn.addEventListener('click', () => ctx.scrollTo('asc', (i + .5) / N));
    const on = () => { preview = i; }, off = () => { if (preview === i) preview = -1; };
    btn.addEventListener('pointerenter', on); btn.addEventListener('focus', on);
    btn.addEventListener('pointerleave', off); btn.addEventListener('blur', off);
    /* prise de vue : légèrement au-dessus du palier, de trois quarts, le nom au premier plan */
    const ang = .35 + i * .5;
    const pos = c.clone().add(V(Math.sin(ang) * 15, 4.2, Math.cos(ang) * 15)), look = c.clone().add(V(Math.cos(ang) * 3.6, .5, -Math.sin(ang) * 3.6));
    return { id, c, ring, disc, label, pos, look, on: 0 };
  });
  /* le fil : il monte le long de l'axe, passe par chaque palier ; une branche rejoint le DU */
  const axis = new THREE.CatmullRomCurve3([TOWER.clone().add(V(0, -2, 0)), TOWER.clone().add(V(0, 2, 0)), TOWER.clone().add(V(0, 7, 0)), TOWER.clone().add(V(0, 12, 0)), TOWER.clone().add(V(0, 17, 0)), TOWER.clone().add(V(0, 20, 0))]);
  const fil = ctx.thread(axis, { radius: .03, glow: 1.4 }); G.add(fil);
  const branch = ctx.thread(new THREE.CatmullRomCurve3([TOWER.clone().add(V(0, 9.5, 0)), TOWER.clone().add(V(-4.5, 9.8, 0)), TOWER.clone().add(V(-9, 9.5, 0))]), { radius: .018, glow: .9, segs: 120 }); G.add(branch);
  const dust = ctx.dust(ctx.mobile ? 700 : 2000, TOWER.clone().add(V(0, 10, 0)), [40, 30, 40], '#B8B0A0', .45); G.add(dust);

  const kOf = p => { const kr = Math.min(1, Math.max(0, p * 1.04 - .02)) * (N - 1), k0 = Math.floor(kr); return k0 + ss(.38, .62, kr - k0); };
  /* pendant le chemin, la tour reste en contrebas, en veille : anneaux discrets, aucun nom */
  ctx.towerDim = () => anchors.forEach(a => { a.ring.material.opacity = .22; a.disc.material.uniforms.uI.value = .1; a.label.children.forEach(c => { c.material.opacity = 0; }); });
  return {
    group: G,
    cam(p, m) {
      const k = kOf(p), a = anchors[Math.floor(k)], b = anchors[Math.min(N - 1, Math.ceil(k))], f = k - Math.floor(k);
      const pos = a.pos.clone().lerp(b.pos, f); pos.y += Math.sin(f * Math.PI) * 1.5 + m.sy * .4; pos.x += m.sx * .6;
      const look = a.look.clone().lerp(b.look, f);
      /* écran en hauteur : l'anneau monte dans le tiers supérieur, l'index occupe le bas */
      if (ctx.camera.aspect < 1) look.y -= 3.2;
      if (glance > .001 && anchors[glanceAt]) { look.lerp(anchors[glanceAt].look, .35 * glance); pos.lerp(anchors[glanceAt].pos, .1 * glance); }
      return { pos, look, cut: 'tour' };
    },
    update(p, t, dt, m, isCurrent) {
      G.visible = true;
      const idx = Math.round(kOf(p));
      if (idx !== active) {
        if (active >= 0 && isCurrent) ctx.cue('borne');
        active = idx; items.forEach((li, i) => li.classList.toggle('is-on', i === idx));
        const lv = items[idx].dataset.lv;
        if (lv !== lastLv) { lastLv = lv; levelEl.textContent = lv; levelEl.animate([{ opacity: 0, transform: 'translateY(6%)' }, { opacity: 1, transform: 'none' }], { duration: 700, easing: 'cubic-bezier(.2,.8,.2,1)' }); }
      }
      if (preview >= 0 && preview !== idx) glanceAt = preview;
      glance = damp(glance, preview >= 0 && preview !== idx && isCurrent ? 1 : 0, 3, dt);
      fil.userData.U.uTime.value = t; fil.userData.U.uProg.value = .12 + .88 * ss(0, .92, p);
      branch.userData.U.uTime.value = t; branch.userData.U.uProg.value = ss(.7, .85, p);
      dust.userData.U.uTime.value = t;
      const vis = ss(.05, .12, p);   /* la tour apparaît quand le carton-titre s'efface */
      anchors.forEach((a, i) => {
        a.on = damp(a.on, i === idx ? 1 : i === preview ? .7 : 0, 4, dt);
        a.ring.material.opacity = (.3 + .7 * a.on) * vis;
        a.ring.scale.setScalar(1 + .015 * Math.sin(t * 2 + i));
        a.disc.material.uniforms.uI.value = (.15 + 1.1 * a.on) * vis;
        /* seul le nom de la formation active (ou survolée) s'écrit : jamais deux textes l'un sur l'autre */
        a.label.children.forEach(c => { c.material.opacity = Math.max(0, a.on * 1.2 - .2) * vis; });
        a.label.quaternion.copy(ctx.camera.quaternion);
      });
      fil.userData.U.uA.value = vis; branch.userData.U.uA.value = vis;
      if (isCurrent) { ctx.bloom.threshold = .95; ctx.bloom.strength = .6; }
    }
  };
}
