/*
  La bibliothèque du rêve, derrière le papier peint de la salle d'étude.
  Atrium de cinq niveaux : galeries de livres, colonnes de fonte, garde-corps ouvragés, lampes chaudes,
  verrière ouverte sur le ciel de nuit. Les formations sont des lutrins éclairés sur la galerie de leur niveau.
  Au centre, l'escalier en colimaçon du parcours et ses sept paliers.
  Le papier peint affiche le rendu de cette bibliothèque : quand on s'en approche, l'image devient réelle.
*/
export function createLibrary(ctx, formations) {
  const { THREE } = ctx;
  const C = new THREE.Vector3(0, 0, -30.4);               /* centre de l'atrium : sa face avant touche le mur du fond de la salle d'étude (z = -16) */
  const G = new THREE.Group(); G.position.copy(C);
  const rnd = (a, b) => a + Math.random() * (b - a);
  const IN = 10, OUT = 14, TIER = 6, NT = 5, TOP = TIER * NT;   /* vide central 20 × 20, galeries de 4 m */
  const box = (w, h, d, m) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  const ctex = (w, h, draw, rep) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; if (rep) t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; };

  const marble = ctex(512, 512, (g, w, h) => { const s = 64; for (let y = 0; y < h; y += s) for (let x = 0; x < w; x += s) { g.fillStyle = ((x + y) / s) % 2 ? '#E9E1D2' : '#2D2A28'; g.fillRect(x, y, s, s); } for (let i = 0; i < 300; i++) { g.strokeStyle = `rgba(150,140,120,${Math.random() * .25})`; g.beginPath(); g.moveTo(Math.random() * w, Math.random() * h); g.bezierCurveTo(Math.random() * w, Math.random() * h, Math.random() * w, Math.random() * h, Math.random() * w, Math.random() * h); g.stroke(); } }, true);
  marble.repeat.set(4, 4);
  const M = {
    floor: new THREE.MeshStandardMaterial({ map: marble, roughness: .18, metalness: .1, envMapIntensity: 1.2, emissive: '#ffffff', emissiveMap: marble, emissiveIntensity: .12 }),
    wood: new THREE.MeshStandardMaterial({ color: '#4A2E1C', roughness: .55, emissive: '#3A1E0C', emissiveIntensity: .5 }),
    woodLight: new THREE.MeshStandardMaterial({ color: '#7A5233', roughness: .5, emissive: '#5A3418', emissiveIntensity: .45 }),
    iron: new THREE.MeshStandardMaterial({ color: '#2C2A27', roughness: .4, metalness: .8 }),
    bronze: new THREE.MeshStandardMaterial({ color: '#8C6A3F', roughness: .35, metalness: .9 }),
    cream: new THREE.MeshStandardMaterial({ color: '#E8DCC4', roughness: .6, emissive: '#8A7350', emissiveIntensity: .35 }),
    lamp: new THREE.MeshBasicMaterial({ color: new THREE.Color('#FFD08A').multiplyScalar(3.4), toneMapped: false })
  };
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(OUT * 2, OUT * 2), M.floor); floor.rotation.x = -Math.PI / 2; G.add(floor);

  /* galeries : dalles en anneau, sous-face en bois, corniche crème */
  for (let t = 1; t < NT; t++) {
    const y = t * TIER;
    for (const [w, d, x, z] of [[OUT * 2, OUT - IN, 0, (IN + OUT) / 2], [OUT * 2, OUT - IN, 0, -(IN + OUT) / 2], [OUT - IN, IN * 2, (IN + OUT) / 2, 0], [OUT - IN, IN * 2, -(IN + OUT) / 2, 0]]) {
      const s = box(w, .35, d, M.wood); s.position.set(x, y, z); G.add(s);
      const top = new THREE.Mesh(new THREE.PlaneGeometry(w, d), M.floor); top.rotation.x = -Math.PI / 2; top.position.set(x, y + .18, z); G.add(top);
    }
    for (const [w, d, x, z] of [[IN * 2 + .3, .3, 0, IN], [IN * 2 + .3, .3, 0, -IN], [.3, IN * 2 + .3, IN, 0], [.3, IN * 2 + .3, -IN, 0]]) { const c = box(w, .5, d, M.cream); c.position.set(x, y - .1, z); G.add(c); }
  }
  /* garde-corps ouvragés (instanciés) et lampes chaudes sur les lisses */
  const posts = [], lamps = [];
  for (let t = 1; t < NT; t++) {
    const y = t * TIER + .18;
    for (let s = 0; s < 4; s++) for (let u = -IN; u <= IN; u += .5) {
      const [x, z] = [[u, IN], [IN, u], [u, -IN], [-IN, u]][s];
      posts.push(new THREE.Vector3(x, y + .5, z));
      if (Math.abs(u % 4) < .01) lamps.push(new THREE.Vector3(x, y + 1.25, z));
    }
    for (const [w, d, x, z] of [[IN * 2, .08, 0, IN], [IN * 2, .08, 0, -IN], [.08, IN * 2, IN, 0], [.08, IN * 2, -IN, 0]]) { const r = box(w, .08, d, M.bronze); r.position.set(x, y + 1.02, z); G.add(r); const r2 = box(w, .04, d, M.iron); r2.position.set(x, y + .15, z); G.add(r2); }
  }
  const postGeo = new THREE.BoxGeometry(.035, 1, .035), postIM = new THREE.InstancedMesh(postGeo, M.iron, posts.length);
  const mtx = new THREE.Matrix4(); posts.forEach((p, i) => { mtx.makeTranslation(p.x, p.y, p.z); postIM.setMatrixAt(i, mtx); }); G.add(postIM);
  const lampIM = new THREE.InstancedMesh(new THREE.SphereGeometry(.09, 10, 10), M.lamp, lamps.length); lamps.forEach((p, i) => { mtx.makeTranslation(p.x, p.y, p.z); lampIM.setMatrixAt(i, mtx); }); G.add(lampIM);
  /* colonnes de fonte du sol à la verrière */
  for (let u = -IN; u <= IN; u += 5) for (const [x, z] of [[u, IN], [u, -IN], [IN, u], [-IN, u]]) {
    const c = new THREE.Mesh(new THREE.CylinderGeometry(.14, .17, TOP, 12), M.iron); c.position.set(x, TOP / 2, z); G.add(c);
    for (let t = 1; t <= NT; t++) { const cap = new THREE.Mesh(new THREE.CylinderGeometry(.3, .15, .3, 12), M.bronze); cap.position.set(x, t * TIER - .3, z); G.add(cap); }
  }

  /* rayonnages : murs extérieurs de chaque niveau couverts de livres (une seule instance pour des dizaines de milliers) */
  const books = [];
  const shelfBoards = [];
  const PAL = ['#7A1F1F', '#8E3B22', '#2D4A6B', '#2F5B3A', '#6B4A1F', '#3A2A4E', '#9C7A3C', '#5A1A2A', '#1F3D4A', '#B08850', '#4E3424'];
  for (let t = 0; t < NT; t++) {
    const y0 = t * TIER + .25;
    for (let s = 0; s < 4; s++) {
      const L = OUT * 2 - .6;
      for (let r = 0; r < 11; r++) {
        const yy = y0 + .1 + r * .46;
        shelfBoards.push([s, yy, L]);
        let u = -L / 2;
        while (u < L / 2 - .1) {
          const w = rnd(.035, .085), h = rnd(.26, .4);
          if (Math.random() < .03) { u += rnd(.1, .3); continue; }
          if (t === 0 && s === 2 && Math.abs(u) < 5) { u += .2; continue; }   /* arche d'entrée au rez-de-chaussée, face à la salle d'étude */
          books.push({ s, u: u + w / 2, y: yy + h / 2 + .02, w, h, d: rnd(.18, .26), c: PAL[Math.floor(Math.random() * PAL.length)], tilt: Math.random() < .02 ? rnd(-.25, .25) : 0 });
          u += w + .004;
        }
      }
    }
  }
  const bookIM = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ roughness: .75, emissive: '#4A2A14', emissiveIntensity: .55 }), books.length);
  const q = new THREE.Quaternion(), sc = new THREE.Vector3(), pv = new THREE.Vector3(), col = new THREE.Color(), up = new THREE.Vector3(0, 1, 0), fwd = new THREE.Vector3(0, 0, 1);
  const wallPos = (s, u, y, inset) => { const W = OUT - inset; return [[u, y, -W], [W, y, u], [-u, y, W], [-W, y, -u]][s]; };
  books.forEach((b, i) => {
    const [x, y, z] = wallPos(b.s, b.u, b.y, .3);
    q.setFromAxisAngle(up, [0, -Math.PI / 2, Math.PI, Math.PI / 2][b.s]); if (b.tilt) q.multiply(new THREE.Quaternion().setFromAxisAngle(fwd, b.tilt));
    mtx.compose(pv.set(x, y, z), q, sc.set(b.w, b.h, b.d)); bookIM.setMatrixAt(i, mtx);
    col.set(b.c).multiplyScalar(rnd(.7, 1.1)); bookIM.setColorAt(i, col);
  });
  G.add(bookIM);
  const boardIM = new THREE.InstancedMesh(new THREE.BoxGeometry(1, .03, .32), M.woodLight, shelfBoards.length);
  shelfBoards.forEach(([s, y, L], i) => { const [x, yy, z] = wallPos(s, 0, y, .22); q.setFromAxisAngle(up, [0, -Math.PI / 2, Math.PI, Math.PI / 2][s]); mtx.compose(pv.set(x, yy, z), q, sc.set(L, 1, 1)); boardIM.setMatrixAt(i, mtx); });
  G.add(boardIM);
  for (const [w, d, x, z] of [[OUT * 2, .3, 0, -OUT], [.3, OUT * 2, OUT, 0], [.3, OUT * 2, -OUT, 0]]) { const b = box(w, TOP, d, M.wood); b.position.set(x, TOP / 2, z); G.add(b); }
  /* face avant : mur de rayonnages avec une arche de 10 m au rez-de-chaussée */
  for (const [w, h, x, y] of [[9, TIER, -9.5, TIER / 2], [9, TIER, 9.5, TIER / 2], [OUT * 2, TOP - TIER, 0, TIER + (TOP - TIER) / 2]]) { const b = box(w, h, .3, M.wood); b.position.set(x, y, OUT); G.add(b); }

  /* verrière : armature de fonte, ciel au-dessus ; faisceaux de lumière qui tombent dans l'atrium */
  for (let u = -IN; u <= IN; u += 2.5) { const a = box(IN * 2, .08, .08, M.iron); a.position.set(0, TOP + 1.5, u); G.add(a); const b = box(.08, .08, IN * 2, M.iron); b.position.set(u, TOP + 1.5, 0); G.add(b); }
  const beamMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
    uniforms: { uI: { value: .35 }, uTime: { value: 0 } },
    vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: `uniform float uI,uTime;varying vec2 vUv;void main(){float a=smoothstep(0.,.6,vUv.y)*(1.-abs(vUv.x-.5)*2.)*(.8+.2*sin(uTime*.5+vUv.x*6.));gl_FragColor=vec4(vec3(.75,.82,1.)*a*uI,1.);}`
  });
  const beams = new THREE.Group();
  for (let k = 0; k < 5; k++) { const b = new THREE.Mesh(new THREE.PlaneGeometry(3.2, TOP + 2), beamMat); b.position.set(rnd(-6, 6), TOP / 2, rnd(-6, 6)); b.rotation.y = rnd(0, 3); b.rotation.z = rnd(-.25, .25); beams.add(b); }
  G.add(beams);
  const motes = ctx.dust(ctx.mobile ? 600 : 1600, [IN * 2, TOP, IN * 2], '#FFE2B0'); motes.position.y = TOP / 2; G.add(motes);

  /* formations : lutrins éclairés sur la galerie de leur niveau */
  /* [niveau, côté, décalage latéral] ; côté 0 = face à l'entrée. Le DAEU est décalé pour que le trajet d'entrée contourne l'escalier central */
  const TIERS = { daeu: [0, 2, -6], bts: [1, 1, 0], du: [1, 3, 0], licence: [2, 0, 0], bachelor: [2, 2, 0], master: [4, 0, 0] };
  const anchors = formations.map((f, i) => {
    const [t, s, lat = 0] = TIERS[f.id] || [i % NT, i % 4, 0];
    const inward = [[0, 0, -1], [-1, 0, 0], [0, 0, 1], [1, 0, 0]][s];   /* vers le centre, depuis le côté s */
    const edge = [[0, IN + 1.6], [IN + 1.6, 0], [0, -IN - 1.6], [-IN - 1.6, 0]][s];
    const y = t * TIER + .18;
    const g = new THREE.Group(); g.position.set(edge[0] + (s % 2 ? 0 : lat), y, edge[1] + (s % 2 ? lat : 0)); g.lookAt(edge[0] + inward[0], y, edge[1] + inward[2]); G.add(g);
    const c = new THREE.Color(f.color);
    const stand = box(.5, 1.1, .4, M.wood); stand.position.set(0, .55, 0); g.add(stand);
    const bookMat = new THREE.MeshStandardMaterial({ color: '#FFF4DC', emissive: '#FFE7B0', emissiveIntensity: .4, roughness: .8 });
    const pageL = box(.42, .02, .5, bookMat); pageL.position.set(-.21, 1.16, 0); pageL.rotation.z = .12; g.add(pageL);
    const pageR = box(.42, .02, .5, bookMat); pageR.position.set(.21, 1.16, 0); pageR.rotation.z = -.12; g.add(pageR);
    const aura = new THREE.Mesh(new THREE.CircleGeometry(1.6, 40), new THREE.MeshBasicMaterial({ color: c.clone().multiplyScalar(1.6), transparent: true, opacity: .25, depthWrite: false, toneMapped: false }));
    aura.rotation.x = -Math.PI / 2; aura.position.y = .02; g.add(aura);
    const label = ctx.buildText(ctx.fontMid, f.label, .55, .06, 0, ctx.textMat('#ffffff', .3)); label.position.set(0, 2.1, 0); g.add(label);
    const glow = new THREE.Mesh(new THREE.SphereGeometry(.16, 16, 16), new THREE.MeshBasicMaterial({ color: c.clone().multiplyScalar(4), toneMapped: false })); glow.position.set(0, 1.5, 0); g.add(glow);
    const world = new THREE.Vector3(); g.getWorldPosition(world);
    return { id: f.id, g, bookMat, aura, label, glow, tier: t, side: s, inward: new THREE.Vector3(...inward), local: g.position.clone(), on: 0 };
  });

  /* escalier en colimaçon : marches instanciées autour d'une colonne, rampe hélicoïdale, sept paliers */
  const TURNS = 3.2, NS = 150, R0 = .35, R1 = 2.4;
  const core = new THREE.Mesh(new THREE.CylinderGeometry(.3, .3, TOP, 16), M.iron); core.position.set(0, TOP / 2, 0); G.add(core);
  const stepIM = new THREE.InstancedMesh(new THREE.BoxGeometry(R1 - R0, .07, .55), M.woodLight, NS);
  const angAt = h => h / TOP * TURNS * Math.PI * 2;
  for (let i = 0; i < NS; i++) { const h = (i + .5) / NS * TOP, a = angAt(h); q.setFromAxisAngle(up, -a); mtx.compose(pv.set(Math.cos(a) * (R0 + R1) / 2, h, Math.sin(a) * (R0 + R1) / 2), q, sc.set(1, 1, 1)); stepIM.setMatrixAt(i, mtx); }
  G.add(stepIM);
  const railPts = []; for (let i = 0; i <= 400; i++) { const h = i / 400 * TOP, a = angAt(h); railPts.push(new THREE.Vector3(Math.cos(a) * R1, h + .95, Math.sin(a) * R1)); }
  const railCurve = new THREE.CatmullRomCurve3(railPts);
  G.add(new THREE.Mesh(new THREE.TubeGeometry(railCurve, 600, .03, 6, false), M.bronze));
  const filGeo = new THREE.TubeGeometry(railCurve, 800, .045, 8, false);
  const fil = new THREE.Mesh(filGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color('#FFD600').multiplyScalar(3), toneMapped: false })); G.add(fil);
  const landings = [];
  for (let k = 0; k < 7; k++) {
    const h = 2.5 + k * 3.9, a = angAt(h);
    const pos = new THREE.Vector3(Math.cos(a) * (R1 + 1.1), h, Math.sin(a) * (R1 + 1.1));
    const pl = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, .1, 28), M.woodLight); pl.position.copy(pos); G.add(pl);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.1, .03, 8, 48), new THREE.MeshBasicMaterial({ color: new THREE.Color('#FFD600').multiplyScalar(2), transparent: true, opacity: .3, toneMapped: false })); ring.rotation.x = Math.PI / 2; ring.position.copy(pos).add(new THREE.Vector3(0, .06, 0)); G.add(ring);
    const num = ctx.buildText(ctx.fontMid, String(k + 1).padStart(2, '0'), .6, .08, 0, ctx.textMat('#ffffff', .2)); num.position.copy(pos).add(new THREE.Vector3(0, 1.6, 0)); G.add(num);
    landings.push({ pos, ring, num, a, h, on: 0 });
  }

  ctx.scene.add(G);

  /* le papier peint : rendu de la bibliothèque vu depuis la salle d'étude */
  const rt = new THREE.WebGLRenderTarget(2048, 236);
  /* le rendu hors écran est linéaire : la texture doit l'être aussi (sinon l'image s'assombrit) */
  const muralCam = new THREE.PerspectiveCamera(30, 23.4 / 2.7, .1, 400);
  const toWorld = v => v.clone().add(C);
  return {
    group: G, center: C, TIER, TOP, IN, anchors, landings, railCurve, filGeo, beamMat, toWorld,
    muralTexture: rt.texture,
    renderMural(renderer, scene, hide = []) {
      muralCam.position.set(0, 1.5, -7); muralCam.lookAt(0, 5.5, C.z); muralCam.updateMatrixWorld();
      const vis = hide.map(o => o.visible); hide.forEach(o => { o.visible = false; });
      const prev = renderer.getRenderTarget(), cc = renderer.getClearColor(new THREE.Color()), ca = renderer.getClearAlpha();
      renderer.setClearColor('#120C08', 1); renderer.setRenderTarget(rt); renderer.render(scene, muralCam); renderer.setRenderTarget(prev); renderer.setClearColor(cc, ca);
      hide.forEach((o, i) => { o.visible = vis[i]; });
    },
    update(t) { beamMat.uniforms.uTime.value = t; motes.rotation.y = t * .01; }
  };
}
