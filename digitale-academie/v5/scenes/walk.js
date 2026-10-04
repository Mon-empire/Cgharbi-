/*
  V · LE CHEMIN · le fil sort de la tour et monte en spirale ; sept étapes, sept lumières
  La caméra accompagne le fil de l'extérieur ; chaque étape s'allume quand on l'atteint (le texte de la page dit laquelle).
  La tour des savoirs reste visible en contrebas : on voit d'où l'on vient.
*/
export async function create(ctx, el) {
  const { THREE, ss, damp, TOWER } = ctx;
  const steps = [...el.querySelectorAll('.v2-walk__step')];
  const counter = el.querySelector('.v2-walk__count');
  const N = steps.length, V = (x, y, z) => new THREE.Vector3(x, y, z);
  const G = new THREE.Group(); G.visible = false; ctx.scene.add(G);
  const Y0 = 20, Y1 = ctx.TOWER_TOP - 1, R0 = 5.2, TURNS = 1.15;
  const at = u => { const a = u * TURNS * Math.PI * 2 + .4; return TOWER.clone().add(V(Math.cos(a) * R0, Y0 + (Y1 - Y0) * u, Math.sin(a) * R0)); };
  const pts = []; for (let i = 0; i <= 160; i++) pts.push(at(i / 160));
  const curve = new THREE.CatmullRomCurve3([TOWER.clone().add(V(0, 17, 0)), TOWER.clone().add(V(0, 19.4, 0)), ...pts]);
  const fil = ctx.thread(curve, { radius: .03, glow: 1.5, segs: 900 }); G.add(fil);
  const nodes = steps.map((li, i) => {
    const u = (i + .5) / N, c = at(u);
    const core = new THREE.Mesh(new THREE.SphereGeometry(.09, 16, 16), new THREE.MeshBasicMaterial({ color: new THREE.Color('#FFE27A').multiplyScalar(3), toneMapped: false, transparent: true }));
    core.position.copy(c); G.add(core);
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 1.3), new THREE.ShaderMaterial({
      uniforms: { uI: { value: 0 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
      vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader: 'uniform float uI;varying vec2 vUv;void main(){float d=length(vUv-.5)*2.;gl_FragColor=vec4(vec3(1.,.8,.25)*pow(max(0.,1.-d),2.6)*uI,1.);}'
    }));
    glow.position.copy(c); G.add(glow);
    const num = ctx.buildText(ctx.fontMid, String(i + 1).padStart(2, '0'), .32, .01, 0, ctx.textMat('#FFE9A6', .8)); num.position.copy(c).add(V(0, .45, 0)); G.add(num);
    /* prise de vue : à l'extérieur de la spirale, un peu au-dessus, le nœud au tiers de l'image */
    const dir = c.clone().sub(TOWER).setY(0).normalize(), side = V(-dir.z, 0, dir.x);
    const pos = c.clone().addScaledVector(dir, 12).addScaledVector(side, -3.5).add(V(0, 2.4, 0));
    return { u, c, core, glow, num, pos, look: c.clone().add(V(0, .2, 0)), on: 0 };
  });
  const kOf = p => { const kr = Math.min(1, Math.max(0, p * 1.03 - .015)) * (N - 1), k0 = Math.floor(kr); return k0 + ss(.3, .7, kr - k0); };
  let active = -1;
  return {
    group: G,
    cam(p, m) {
      const k = kOf(p), k0 = Math.floor(k), f = k - k0, a = nodes[k0], b = nodes[Math.min(N - 1, k0 + 1)];
      /* entre deux étapes, la caméra tourne avec la spirale (interpolation angulaire autour de l'axe) */
      const ra = a.pos.clone().sub(TOWER), rb = b.pos.clone().sub(TOWER);
      const aa = Math.atan2(ra.z, ra.x), ab = Math.atan2(rb.z, rb.x); let da = ab - aa; if (da > Math.PI) da -= 2 * Math.PI; if (da < -Math.PI) da += 2 * Math.PI;
      const ang = aa + da * f, rad = Math.hypot(ra.x, ra.z) + (Math.hypot(rb.x, rb.z) - Math.hypot(ra.x, ra.z)) * f;
      const pos = TOWER.clone().add(V(Math.cos(ang) * rad, ra.y + (rb.y - ra.y) * f, Math.sin(ang) * rad));
      pos.x += m.sx * .4; pos.y += m.sy * .3;
      return { pos, look: a.look.clone().lerp(b.look, f), cut: 'tour' };
    },
    update(p, t, dt, m, isCurrent) {
      G.visible = true; if (ctx.tower) { ctx.tower.visible = true; ctx.towerDim && ctx.towerDim(); }
      const idx = Math.round(kOf(p));
      if (idx !== active) {
        if (active >= 0 && isCurrent) ctx.cue('borne');
        active = idx; steps.forEach((s, i) => s.classList.toggle('is-on', i === idx));
        if (counter) counter.textContent = String(idx + 1).padStart(2, '0') + ' / ' + String(N).padStart(2, '0');
      }
      const u = (Math.min(N - 1, kOf(p)) + .5) / N;
      fil.userData.U.uTime.value = t; fil.userData.U.uProg.value = .06 + .94 * u;
      nodes.forEach((n, i) => {
        n.on = damp(n.on, i === idx ? 1 : i < idx ? .35 : .08, 4, dt);
        n.glow.material.uniforms.uI.value = .12 + .75 * n.on * (1 + .08 * Math.sin(t * 3 + i));
        n.core.material.opacity = .25 + .75 * n.on;
        n.glow.quaternion.copy(ctx.camera.quaternion); n.num.quaternion.copy(ctx.camera.quaternion);
        n.num.children.forEach(c => { c.material.opacity = .2 + .8 * n.on; });
      });
      if (isCurrent) { ctx.bloom.threshold = .95; ctx.bloom.strength = .6; }
    },
    rest() { G.visible = false; }
  };
}
