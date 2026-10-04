/*
  ACCOMPAGNEMENT · lanternes dans l'atrium
  Les sept ateliers sont des lanternes qui quittent le sol de la bibliothèque et montent vers la verrière.
  Les deux coachs sont deux lucioles (jaune, cyan) qui accompagnent la lanterne qui s'élève.
*/
export async function create(ctx, el) {
  const { THREE, ss, eOut, damp, library } = ctx;
  const G = new THREE.Group(); G.visible = false; ctx.scene.add(G);
  const items = [...el.querySelectorAll('.v2-work li')];
  const supports = [...el.querySelectorAll('.v2-human__list > div')];
  const N = items.length, C = library.center, TOP = library.TOP;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const paper = new THREE.MeshStandardMaterial({ color: '#FFCF8A', emissive: '#FF9F45', emissiveIntensity: .8, roughness: .9, side: THREE.DoubleSide, transparent: true, opacity: .95 });
  const lanterns = items.map((li, i) => {
    const g = new THREE.Group(); g.scale.setScalar(1.5);
    const body = new THREE.Mesh(new THREE.CylinderGeometry(.55, .45, 1.2, 16, 1, true), paper.clone()); g.add(body);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(.55, .03, 6, 24), new THREE.MeshStandardMaterial({ color: '#3A2A22' })); rim.rotation.x = Math.PI / 2; rim.position.y = .6; g.add(rim);
    const flame = new THREE.Mesh(new THREE.SphereGeometry(.12, 12, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color('#FFE2A0').multiplyScalar(6), toneMapped: false })); flame.position.y = -.45; g.add(flame);
    const label = ctx.buildText(ctx.fontMid, li.textContent.trim(), .16, .02, 0, ctx.textMat('#FFF4E0', .6)); label.position.y = -.95; g.add(label);
    const a = i / N * Math.PI * 2;
    const start = C.clone().add(new THREE.Vector3(Math.cos(a) * 6.5, 1.2, Math.sin(a) * 6.5));
    const re = rnd(3.2, 5);   /* assez loin des galeries pour que la caméra garde quatre à six mètres de recul */
    const end = C.clone().add(new THREE.Vector3(Math.cos(a + .6) * re, TOP * rnd(.55, .9), Math.sin(a + .6) * re));
    g.position.copy(start); G.add(g);
    return { li, g, body, label, flame, start, end, ph: rnd(0, 6), on: 0 };
  });
  const coach = (color, phase) => {
    const c = new THREE.Color(color);
    const orb = new THREE.Mesh(new THREE.SphereGeometry(.2, 20, 20), new THREE.MeshBasicMaterial({ color: c.clone().multiplyScalar(7), toneMapped: false }));
    const TR = 110, pos = new Float32Array(TR * 3), cols = new Float32Array(TR * 3);
    for (let i = 0; i < TR; i++) { const k = (1 - i / TR) ** 1.5 * 3; cols.set([c.r * k, c.g * k, c.b * k], i * 3); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    const trail = new THREE.Line(geo, new THREE.LineBasicMaterial({ vertexColors: true, toneMapped: false, transparent: true, blending: THREE.AdditiveBlending }));
    trail.frustumCulled = false; G.add(orb, trail);
    return { orb, trail, pos, TR, phase, init: false };
  };
  const coaches = [coach('#FFD600', 0), coach('#00BBDB', Math.PI)];
  const launchAt = i => .05 + i * .11;
  let active = -1;
  return {
    group: G,
    cam(p, m) {
      /* la caméra accompagne la lanterne qui s'élève : légèrement en retrait, côté galerie, jamais hors de l'atrium */
      const f = Math.max(0, (p - .05) / .11), i0 = Math.min(N - 1, Math.floor(f)), i1 = Math.min(N - 1, i0 + 1), u = ss(.55, 1, f - i0);
      const at = i => lanterns[i].start.clone().lerp(lanterns[i].end, eOut(ss(launchAt(i), launchAt(i) + .3, p)));
      const T = at(i0).lerp(at(i1), u);
      const rel = T.clone().sub(C), a = Math.atan2(rel.z, rel.x) + .5, r = 9.3;
      return {
        pos: new THREE.Vector3(C.x + Math.cos(a) * r + m.sx * .6, T.y + .9 + m.sy * .5, C.z + Math.sin(a) * r),
        look: T.clone().add(new THREE.Vector3(0, -.1, 0))
      };
    },
    update(p, t, dt, m, isCurrent) {
      G.visible = library.group.visible;
      let idx = 0;
      lanterns.forEach((o, i) => {
        const l = eOut(ss(launchAt(i), launchAt(i) + .3, p));
        if (p >= launchAt(i)) idx = i;
        o.g.position.copy(o.start).lerp(o.end, l);
        o.g.position.x += Math.sin(t * .6 + o.ph) * .3 * l; o.g.position.z += Math.cos(t * .5 + o.ph) * .3 * l;
        o.g.rotation.y = Math.sin(t * .3 + o.ph) * .4;
        o.label.lookAt(ctx.camera.position);
        o.on = damp(o.on, i === idx && p >= launchAt(i) ? 1 : 0, 4, dt);
        o.body.material.emissiveIntensity = .6 + 1 * o.on;
        o.flame.scale.setScalar(.8 + .3 * Math.sin(t * 9 + o.ph) + .6 * o.on);
      });
      if (idx !== active) { if (active >= 0 && isCurrent) ctx.cue('borne'); active = idx; items.forEach((li, i) => li.classList.toggle('is-on', i === idx && p >= launchAt(0))); }
      supports.forEach((d, i) => d.classList.toggle('is-on', p > .02 + i * .06));
      const target = lanterns[idx].g.position;
      coaches.forEach((c, k) => {
        const a = t * 1.1 + c.phase, x = target.x + Math.cos(a) * 3.2, y = target.y + Math.sin(a * 1.7 + k) * 1.2, z = target.z + Math.sin(a) * 3.2;
        c.orb.position.set(x, y, z);
        if (!c.init) { for (let i = 0; i < c.TR; i++) c.pos.set([x, y, z], i * 3); c.init = true; }
        c.pos.copyWithin(3, 0, (c.TR - 1) * 3); c.pos.set([x, y, z], 0); c.trail.geometry.attributes.position.needsUpdate = true;
      });
      if (isCurrent) { const { key, rim } = ctx.lights; key.position.copy(coaches[0].orb.position); key.color.set('#FFD600'); key.intensity = 25; rim.position.copy(coaches[1].orb.position); rim.color.set('#00BBDB'); rim.intensity = 25; }
    }
  };
}
