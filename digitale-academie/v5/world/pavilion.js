/*
  La Digitale Académie, reconstruite d'après les photos publiées par la Ville (brochure 2024, site, bandeau) :
  bâtiment modulaire blanc en U autour d'une cour d'entrée ; au fond de la cour : porte coulissante vitrée,
  logo à la toque, porte double vitrée surmontée de l'enseigne « MONTEREAU DIGITALE ACADEMIE » (caractères
  d'afficheur), grilles d'aération, lecteur de badge ; aile gauche à volets roulants ; aile droite à portes
  vitrées étroites ; garde-corps métallique sur le toit.
  Intérieur : linoléum rouge, plafond à dalles et tubes fluorescents, cafétéria (tables hautes, tabourets orange,
  distributeur), coin détente (chaises vertes), salle informatique (bureaux, cloisons, écrans, kakémono),
  salle d'étude (bureaux, lampes chromées, colonne blanche, étagères) et son grand papier peint de bibliothèque.
  Unités : mètres. Origine : centre de la cour, au sol ; +z vers la rue.
*/
export async function createPavilion(ctx) {
  const { THREE } = ctx;
  const G = new THREE.Group();
  /* extérieur modélisé (en v5, remplacé par la façade photographique) ; l'intérieur reste dans IN */
  const EXT = new THREE.Group(); G.add(EXT);
  const rnd = (a, b) => a + Math.random() * (b - a);

  /* ---------- textures procédurales (aucune image inventée) ---------- */
  const canvasTex = (w, h, draw, repeat) => {
    const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
    if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
    return t;
  };
  /* panneau de module : joints verticaux tous les 2,4 m, léger voile de salissure en pied */
  const panelTex = canvasTex(512, 256, (g, w, h) => {
    g.fillStyle = '#E3E5E7'; g.fillRect(0, 0, w, h);
    const gr = g.createLinearGradient(0, h, 0, h * .6); gr.addColorStop(0, 'rgba(120,120,110,.18)'); gr.addColorStop(1, 'rgba(120,120,110,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(80,85,90,.55)'; g.fillRect(0, 0, 3, h); g.fillStyle = 'rgba(255,255,255,.6)'; g.fillRect(3, 0, 2, h);
    for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(90,90,90,${Math.random() * .04})`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
  }, true);
  const shutterTex = canvasTex(64, 256, (g, w, h) => { g.fillStyle = '#E9EAEB'; g.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 8) { g.fillStyle = '#C3C6C9'; g.fillRect(0, y, w, 1); g.fillStyle = '#F7F7F7'; g.fillRect(0, y + 1, w, 1); } }, true);
  const linoTex = canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#C23A2E'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 2600; i++) { const r = Math.random(); g.fillStyle = r < .5 ? 'rgba(150,35,28,.35)' : 'rgba(230,90,70,.25)'; g.beginPath(); g.ellipse(Math.random() * w, Math.random() * h, rnd(2, 14), rnd(1, 4), rnd(0, 3), 0, 7); g.fill(); }
  }, true);
  const ceilTex = canvasTex(256, 256, (g, w, h) => { g.fillStyle = '#EEEEEA'; g.fillRect(0, 0, w, h); g.fillStyle = '#CFCFC8'; for (let x = 0; x < w; x += 32) g.fillRect(x, 0, 1, h); }, true);

  /* ---------- matériaux ---------- */
  const M = {
    panel: new THREE.MeshStandardMaterial({ map: panelTex, roughness: .62, metalness: .05 }),
    fascia: new THREE.MeshStandardMaterial({ color: '#E7E9EB', roughness: .5, metalness: .1 }),
    alu: new THREE.MeshStandardMaterial({ color: '#BFC4C9', roughness: .32, metalness: .75 }),
    dark: new THREE.MeshStandardMaterial({ color: '#2E3238', roughness: .5 }),
    glass: new THREE.MeshPhysicalMaterial({ color: '#9FB2C2', roughness: .04, metalness: .1, transparent: true, opacity: .32, envMapIntensity: 1.6, clearcoat: 1, depthWrite: false }),
    shutter: new THREE.MeshStandardMaterial({ map: shutterTex, roughness: .55 }),
    lino: new THREE.MeshStandardMaterial({ map: linoTex, roughness: .35, metalness: 0 }),
    ceil: new THREE.MeshStandardMaterial({ map: ceilTex, roughness: .9, emissive: '#ffffff', emissiveMap: ceilTex, emissiveIntensity: .35 }),
    wallIn: new THREE.MeshStandardMaterial({ color: '#E8E7E2', roughness: .85 }),
    tube: new THREE.MeshBasicMaterial({ color: new THREE.Color('#F4F7FF').multiplyScalar(2.2), toneMapped: false }),
    wood: new THREE.MeshStandardMaterial({ color: '#B98A5A', roughness: .55 }),
    whiteLeg: new THREE.MeshStandardMaterial({ color: '#F2F2F2', roughness: .4 }),
    chair: new THREE.MeshStandardMaterial({ color: '#1F2226', roughness: .6 }),
    orange: new THREE.MeshStandardMaterial({ color: '#E8823A', roughness: .5 }),
    green: new THREE.MeshStandardMaterial({ color: '#8BBF3C', roughness: .55 }),
    grey: new THREE.MeshStandardMaterial({ color: '#7D8186', roughness: .6 }),
    chrome: new THREE.MeshStandardMaterial({ color: '#E8ECEF', roughness: .12, metalness: 1 })
  };
  const box = (w, h, d, m) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  const at = (o, x, y, z) => { o.position.set(x, y, z); EXT.add(o); return o; };
  /* mur texturé : le motif de joints se répète tous les 2,4 m */
  const wall = (w, h, d, x, y, z, ry = 0) => {
    const g = new THREE.BoxGeometry(w, h, d);
    const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * Math.max(w, d) / 2.4, uv.getY(i) * h / 3);
    const m = new THREE.Mesh(g, M.panel); m.position.set(x, y, z); m.rotation.y = ry; EXT.add(m); return m;
  };

  const H = 3.0, FA = .45;            /* hauteur des murs, bandeau de rive */
  /* ---------- volumes : bloc du fond (x -12..12, z -16..-2) et deux ailes (z -2..6) ---------- */
  const backWall = wall(24, H, .2, 0, H / 2, -16);              /* façade arrière (s'efface quand le papier peint devient réel) */
  wall(.2, H, 14, -12, H / 2, -9); wall(.2, H, 14, 12, H / 2, -9); /* pignons du bloc */
  wall(8, H, .2, -8, H / 2, -2); wall(8, H, .2, 8, H / 2, -2);   /* (côtés du fond de cour, derrière les ailes) */
  /* mur du fond de la cour (x -4..4, z -2) : percements réels gérés plus bas, pièces pleines entre eux */
  const back = [[-4, -3.45], [-.85, .85], [3.25, 4]];
  back.forEach(([a, b]) => wall(b - a, H, .2, (a + b) / 2, H / 2, -2));
  wall(2.6, H - 2.25, .2, -2.15, 2.25 + (H - 2.25) / 2, -2);     /* linteau porte coulissante */
  wall(2.4, H - 2.35, .2, 2.05, 2.35 + (H - 2.35) / 2, -2);       /* linteau porte double */
  /* ailes : murs intérieurs sur la cour (x = ±4), murs extérieurs, pignons sur rue */
  wall(.2, H, 8, -4, H / 2, 2); wall(.2, H, 8, 4, H / 2, 2);
  wall(.2, H, 8, -12, H / 2, 2); wall(.2, H, 8, 12, H / 2, 2);
  wall(8, H, .2, -8, H / 2, 6); wall(8, H, .2, 8, H / 2, 6);
  /* bandeau de rive et toiture */
  const roofGeo = (w, d, x, z) => { const r = box(w + .3, FA, d + .3, M.fascia); r.position.set(x, H + FA / 2, z); EXT.add(r); };
  roofGeo(24, 14, 0, -9); roofGeo(8, 8, -8, 2); roofGeo(8, 8, 8, 2);
  /* garde-corps métallique en rive de toiture (côté cour et façades) */
  const railM = new THREE.MeshStandardMaterial({ color: '#D9DCDF', roughness: .35, metalness: .7 });
  const rail = (x0, z0, x1, z1) => {
    const len = Math.hypot(x1 - x0, z1 - z0), n = Math.max(2, Math.round(len / 1.5)), ang = Math.atan2(z1 - z0, x1 - x0);
    const y0 = H + FA;
    for (const yy of [.5, 1.05]) { const tb = new THREE.Mesh(new THREE.CylinderGeometry(.025, .025, len, 6), railM); tb.rotation.z = Math.PI / 2; tb.rotation.y = -ang; tb.position.set((x0 + x1) / 2, y0 + yy, (z0 + z1) / 2); EXT.add(tb); }
    for (let i = 0; i <= n; i++) { const u = i / n; const p = new THREE.Mesh(new THREE.CylinderGeometry(.02, .02, 1.05, 6), railM); p.position.set(x0 + (x1 - x0) * u, y0 + .525, z0 + (z1 - z0) * u); EXT.add(p); }
  };
  rail(-4, -2.1, 4, -2.1); rail(-3.9, -2, -3.9, 6); rail(3.9, -2, 3.9, 6); rail(-12, 6, -4, 6); rail(4, 6, 12, 6);

  /* ---------- fond de cour : porte coulissante, logo, porte double, enseigne ---------- */
  const frame = (x0, x1, y0, y1, z, panes = 2) => {
    const w = x1 - x0, h = y1 - y0, cx = (x0 + x1) / 2;
    for (const [fw, fh, fx, fy] of [[w, .07, cx, y1], [w, .07, cx, y0 + .035], [.07, h, x0, (y0 + y1) / 2], [.07, h, x1, (y0 + y1) / 2]]) at(box(fw, fh, .09, M.alu), fx, fy, z);
    for (let i = 1; i < panes; i++) at(box(.06, h, .09, M.alu), x0 + w * i / panes, (y0 + y1) / 2, z);
    const gl = at(box(w - .08, h - .08, .02, M.glass), cx, (y0 + y1) / 2, z); gl.renderOrder = 2;
  };
  frame(-3.45, -.85, .05, 2.25, -1.95, 2);
  at(box(2.7, .28, .3, M.fascia), -2.15, 2.4, -1.85);                     /* coffre au-dessus de la porte coulissante */
  /* porte double : deux vantaux qui s'ouvriront vers l'intérieur */
  const leaves = [];
  [[.85, 2.05, .85], [2.05, 3.25, 3.25]].forEach(([a, b, hinge]) => {
    const pivot = new THREE.Group(); pivot.position.set(hinge, 0, -1.95); EXT.add(pivot);
    const w = b - a, cx = (a + b) / 2 - hinge;
    const leaf = new THREE.Group(); pivot.add(leaf);
    for (const [fw, fh, fx, fy] of [[w, .08, cx, 2.3], [w, .12, cx, .1], [.08, 2.3, cx - w / 2 + .04, 1.2], [.08, 2.3, cx + w / 2 - .04, 1.2]]) { const m = box(fw, fh, .08, M.alu); m.position.set(fx, fy, 0); leaf.add(m); }
    const gl = box(w - .14, 2.1, .02, M.glass); gl.position.set(cx, 1.2, 0); gl.renderOrder = 2; leaf.add(gl);
    const handle = box(.03, .35, .05, M.alu); handle.position.set(hinge < 2 ? cx + w / 2 - .12 : cx - w / 2 + .12, 1.05, .06); leaf.add(handle);
    leaves.push({ pivot, dir: hinge < 2 ? 1 : -1 });
  });
  at(box(2.5, .28, .3, M.fascia), 2.05, 2.5, -1.85);                     /* coffre de la porte double */
  /* enseigne en caractères d'afficheur à segments, comme sur la façade */
  const seg = makeSegmentText(THREE, 'MONTEREAU DIGITALE ACADEMIE', { color: '#3B4048', bg: null, w: 1400, h: 80 });
  const sign = at(new THREE.Mesh(new THREE.PlaneGeometry(2.55, .145), new THREE.MeshStandardMaterial({ map: seg, transparent: true, roughness: .6 })), 2.05, 2.78, -1.88);
  /* logo réel (toque au centre), à gauche de la porte double */
  const logoTex = await ctx.tex('logo-da.png');
  const logo = at(new THREE.Mesh(new THREE.PlaneGeometry(.95, 1.03), new THREE.MeshStandardMaterial({ map: logoTex, transparent: true, roughness: .5, emissive: '#ffffff', emissiveMap: logoTex, emissiveIntensity: .15 })), .02, 1.95, -1.88);
  at(box(.32, .2, .02, M.whiteLeg), .05, 1.35, -1.88);                    /* plaque */
  for (const vx of [-.12, .25]) { const v = at(new THREE.Mesh(new THREE.CircleGeometry(.09, 24), M.dark), vx, .38, -1.89); v.material = new THREE.MeshStandardMaterial({ color: '#C9CCCF', roughness: .4 }); }
  at(box(.09, .14, .04, M.dark), 3.5, 1.25, -1.88);                       /* lecteur de badge */
  /* aile gauche : deux grands volets roulants baissés sur la cour */
  for (const [z0, z1] of [[-1.5, .2], [.55, 2.25]]) { const s = at(new THREE.Mesh(new THREE.PlaneGeometry(z1 - z0, 2.45), M.shutter), -3.88, 1.28, (z0 + z1) / 2); s.rotation.y = Math.PI / 2; s.material.map.repeat.set(1, 6); at(box(.12, .25, z1 - z0 + .1, M.fascia), -3.86, 2.62, (z0 + z1) / 2); }
  /* aile droite : portes vitrées étroites */
  for (const [z0, z1] of [[-1.5, -.6], [-.2, .7], [1.1, 2.0]]) {
    const cz = (z0 + z1) / 2, d = z1 - z0;
    for (const [fz, fy, fd, fh] of [[cz, 2.25, d, .07], [z0, 1.15, .07, 2.3], [z1, 1.15, .07, 2.3]]) at(box(.09, fh, fd, M.alu), 3.9, fy, fz);
    const gl = at(box(.02, 2.15, d - .08, M.glass), 3.9, 1.12, cz); gl.renderOrder = 2;
  }
  /* façades extérieures : grandes baies à cadre blanc, comme sur le bandeau de la Ville */
  const winOut = (cx, cz, ry) => { const g = new THREE.Group(); g.position.set(cx, 0, cz); g.rotation.y = ry; EXT.add(g); for (const dx of [-.62, .62]) { const gl = box(1.1, 1.75, .02, M.glass); gl.position.set(dx, 1.35, 0); gl.renderOrder = 2; g.add(gl); } for (const [w, h, x, y] of [[2.5, .09, 0, 2.27], [2.5, .09, 0, .45], [.09, 1.9, -1.25, 1.36], [.09, 1.9, 1.25, 1.36], [.07, 1.9, 0, 1.36]]) { const m = box(w, h, .1, M.whiteLeg); m.position.set(x, y, .02); g.add(m); } const sh = box(2.6, .28, .26, M.fascia); sh.position.set(0, 2.55, .1); g.add(sh); };
  [-10, -6].forEach(x => winOut(x, 6.11, 0)); [6, 10].forEach(x => winOut(x, 6.11, 0));
  [-0, 4].forEach(z => { winOut(-12.11, z - 1, -Math.PI / 2); winOut(12.11, z - 1, Math.PI / 2); });
  [-14, -10, -6].forEach(z => { winOut(-12.11, z, -Math.PI / 2); winOut(12.11, z, Math.PI / 2); });

  /* ---------- intérieur ---------- */
  const IN = new THREE.Group(); G.add(IN);
  const inAt = (o, x, y, z) => { o.position.set(x, y, z); IN.add(o); return o; };
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(23.6, 13.6), M.lino); floor.rotation.x = -Math.PI / 2; linoTex.repeat.set(5, 3); inAt(floor, 0, .01, -9);
  const floorW = (cx, cz, w, d) => { const f = new THREE.Mesh(new THREE.PlaneGeometry(w, d), M.lino); f.rotation.x = -Math.PI / 2; inAt(f, cx, .011, cz); };
  floorW(-8, 2, 7.6, 7.6); floorW(8, 2, 7.6, 7.6);
  const CH = 2.7;
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(23.6, 13.6), M.ceil); ceil.rotation.x = Math.PI / 2; ceilTex.repeat.set(24, 14); inAt(ceil, 0, CH, -9);
  for (let x = -10; x <= 10; x += 3.4) for (let z = -14.5; z <= -3; z += 2.6) inAt(box(1.25, .04, .18, M.tube), x, CH - .03, z);
  for (const wx of [-8, 8]) { const c = new THREE.Mesh(new THREE.PlaneGeometry(7.6, 7.6), M.ceil); c.rotation.x = Math.PI / 2; inAt(c, wx, CH, 2); for (const z of [0, 3.5]) inAt(box(1.25, .04, .18, M.tube), wx, CH - .03, z); }
  /* cloisons : salle d'étude au fond (z < -8), cafétéria à droite, salle informatique à gauche */
  const part = (w, d, x, z) => inAt(box(w, CH, d, M.wallIn), x, CH / 2, z);
  part(9.6, .12, -6.9, -8); part(9.6, .12, 6.9, -8);           /* ouverture centrale de 4 m vers la salle d'étude */
  part(.12, 3.2, 0, -6.3);                                      /* cloison partielle entre informatique et cafétéria */
  /* cafétéria : tables hautes rondes, tabourets orange, distributeur, poubelle inox */
  for (const [x, z] of [[4, -4], [6.5, -5.8], [8.8, -3.8]]) {
    inAt(new THREE.Mesh(new THREE.CylinderGeometry(.35, .35, .03, 24), M.wood), x, 1.05, z);
    inAt(new THREE.Mesh(new THREE.CylinderGeometry(.03, .03, 1.05, 8), M.grey), x, .52, z);
    inAt(new THREE.Mesh(new THREE.CylinderGeometry(.25, .25, .02, 20), M.grey), x, .01, z);
    for (let k = 0; k < 3; k++) { const a = k * 2.1 + x; const sx = x + Math.cos(a) * .6, sz = z + Math.sin(a) * .6;
      inAt(new THREE.Mesh(new THREE.CylinderGeometry(.19, .19, .05, 16), M.orange), sx, .74, sz);
      for (const [lx, lz] of [[-.13, -.13], [.13, -.13], [-.13, .13], [.13, .13]]) inAt(new THREE.Mesh(new THREE.CylinderGeometry(.012, .012, .74, 5), M.grey), sx + lx, .37, sz + lz);
      inAt(box(.34, .3, .02, M.grey), sx, .95, sz - .18); }
  }
  const vend = inAt(box(.9, 1.85, .75, M.dark), 11.2, .93, -6.5);
  inAt(box(.6, 1.1, .02, new THREE.MeshBasicMaterial({ color: new THREE.Color('#BFD9F2').multiplyScalar(1.4), toneMapped: false })), 10.74, 1.15, -6.5).rotation.y = -Math.PI / 2;
  inAt(new THREE.Mesh(new THREE.CylinderGeometry(.2, .18, .7, 18), M.chrome), 9.6, .35, -7.4);
  /* coin détente : chaises vertes et grises, table basse */
  for (const [x, z, c] of [[5, -2.9, 'green'], [7.2, -3, 'grey'], [4.6, -7.4, 'green'], [8.2, -7.2, 'grey']]) { inAt(box(.5, .08, .5, M[c]), x, .45, z); inAt(box(.5, .45, .07, M[c]), x, .7, z - .22); }
  inAt(box(.8, .04, .5, M.dark), 6.2, .42, -2.9);
  /* salle informatique : bureaux bois à piètement blanc, cloisons, écrans allumés, unités centrales */
  const desk = (x, z, ry, screen = true) => {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; IN.add(g);
    const top = box(1.4, .04, .75, M.wood); top.position.y = .74; g.add(top);
    for (const [lx, lz] of [[-.66, -.33], [.66, -.33], [-.66, .33], [.66, .33]]) { const l = box(.04, .74, .04, M.whiteLeg); l.position.set(lx, .37, lz); g.add(l); }
    if (screen) {
      const p = box(1.4, .55, .03, new THREE.MeshStandardMaterial({ color: '#EDEDED', roughness: .9 })); p.position.set(0, 1.02, -.37); g.add(p);
      const mon = box(.55, .34, .03, M.dark); mon.position.set(0, 1.0, -.25); g.add(mon);
      const scr = new THREE.Mesh(new THREE.PlaneGeometry(.5, .29), new THREE.MeshBasicMaterial({ color: new THREE.Color(['#5FA7E8', '#F2B33D', '#7ED0C3'][Math.floor(Math.random() * 3)]).multiplyScalar(1.3), toneMapped: false })); scr.position.set(0, 1.0, -.233); g.add(scr);
      const kb = box(.42, .02, .14, M.dark); kb.position.set(0, .77, .05); g.add(kb);
    }
    const ch = box(.45, .06, .45, M.chair); ch.position.set(0, .46, .55); g.add(ch); const bk = box(.45, .45, .05, M.chair); bk.position.set(0, .72, .77); g.add(bk);
    return g;
  };
  for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) desk(-9.6 + i * 3.2, -6.6 + j * 2.2, 0);
  /* kakémono avec le slogan, comme dans la salle informatique */
  const kakemono = makeBanner(THREE, logoTex);
  inAt(new THREE.Mesh(new THREE.PlaneGeometry(.85, 2.05), new THREE.MeshStandardMaterial({ map: kakemono, roughness: .7 })), -1.2, 1.05, -2.6).rotation.y = -.35;
  /* salle d'étude : bureaux, lampes chromées allumées, colonne blanche, étagères */
  const lampHeads = [];
  for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) {
    const x = -6 + i * 6, z = -10.2 - j * 2.4;
    desk(x - .8, z, 0, false); desk(x + .8, z, 0, false);
    const arm = box(.03, .55, .03, M.chrome); arm.position.set(x, 1.05, z - .2); IN.add(arm);
    const head = new THREE.Mesh(new THREE.ConeGeometry(.13, .18, 18, 1, true), M.chrome); head.position.set(x + .12, 1.32, z - .2); head.rotation.z = .9; IN.add(head);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(.05, 10, 10), new THREE.MeshBasicMaterial({ color: new THREE.Color('#FFE6B8').multiplyScalar(4), toneMapped: false })); bulb.position.set(x + .17, 1.27, z - .2); IN.add(bulb); lampHeads.push(bulb);
  }
  inAt(new THREE.Mesh(new THREE.CylinderGeometry(.13, .13, CH, 16), M.whiteLeg), 2.6, CH / 2, -11.4);
  for (const sx of [-11.2, 11.2]) { const sh = box(.35, 1.9, 1.6, M.whiteLeg); inAt(sh, sx, .95, -12.5); for (let k = 0; k < 4; k++) inAt(box(.3, .02, 1.5, M.wallIn), sx, .3 + k * .45, -12.5); for (let k = 0; k < 9; k++) inAt(box(.18, rnd(.18, .26), .05, new THREE.MeshStandardMaterial({ color: ['#C8473A', '#2F6DB1', '#E0B640', '#3E8E5E'][k % 4] })), sx, .42 + Math.floor(k / 3) * .45, -13.1 + (k % 3) * .55); }
  /* le grand papier peint de bibliothèque : il affiche le rendu de la vraie bibliothèque 3D qui l'attend derrière */
  const muralMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffffff').multiplyScalar(1.6), toneMapped: true, transparent: true });
  const mural = inAt(new THREE.Mesh(new THREE.PlaneGeometry(23.4, CH), muralMat), 0, CH / 2, -15.88);
  /* portraits peints dans les ailes (photos de la Ville) */
  const [tk, tm] = await Promise.all([ctx.tex('kahlo.jpg'), ctx.tex('mandela.jpg')]);
  const portrait = (t, x, z, ry) => { const a = t ? t.image.width / t.image.height : .75; const m = inAt(new THREE.Mesh(new THREE.PlaneGeometry(2.3 * a, 2.3), new THREE.MeshStandardMaterial({ map: t, roughness: .8 })), x, 1.35, z); m.rotation.y = ry; return m; };
  const kahlo = portrait(tk, -11.88, 2, Math.PI / 2), mandela = portrait(tm, 11.88, 2, -Math.PI / 2);

  ctx.scene.add(G);
  return {
    group: G, exterior: EXT, interior: IN, mural, muralMat, leaves, lampHeads, kahlo, mandela, sign, logo,
    door: new THREE.Vector3(2.05, 0, -1.95),
    /* ouverture des portes (0 → 1) */
    open(k) { const e = k * k * (3 - 2 * k); leaves.forEach(l => { l.pivot.rotation.y = -l.dir * e * 1.75; }); },
    /* mur du fond qui s'efface : la bibliothèque devient réelle */
    dissolveMural(k) { muralMat.opacity = 1 - k; mural.visible = k < .999; backWall.visible = k < .02; }
  };
}

/* ---------- texte d'afficheur à 14 segments (enseigne et totem) ---------- */
export function makeSegmentText(THREE, text, { color = '#2D3238', w = 1400, h = 80, italic = .18 } = {}) {
  const S = { a: [[.1, 0], [.9, 0]], b: [[.95, .05], [.95, .45]], c: [[.95, .55], [.95, .95]], d: [[.1, 1], [.9, 1]], e: [[.05, .55], [.05, .95]], f: [[.05, .05], [.05, .45]],
    g1: [[.1, .5], [.45, .5]], g2: [[.55, .5], [.9, .5]], h: [[.15, .1], [.45, .42]], i: [[.5, .08], [.5, .42]], j: [[.85, .1], [.55, .42]], k: [[.45, .58], [.15, .9]], l: [[.5, .58], [.5, .92]], m: [[.55, .58], [.85, .9]] };
  const F = { M: 'f e b c h j', O: 'a b c d e f', N: 'f e b c h m', T: 'a i l', E: 'a d e f g1 g2', R: 'a b f e g1 g2 m', A: 'a b c e f g1 g2', U: 'b c d e f', D: 'a b c d i l', I: 'a d i l', G: 'a c d e f g2', L: 'd e f', C: 'a d e f',
    0: 'a b c d e f j k', 1: 'b c', 2: 'a b g1 g2 e d', 3: 'a b c d g2', 4: 'f g1 g2 b c', 8: 'a b c d e f g1 g2', ' ': '' };
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
  const cw = w / text.length, ch = h * .78, oy = h * .11;
  g.strokeStyle = color; g.lineCap = 'round'; g.lineWidth = Math.max(2, h * .07);
  [...text].forEach((chr, n) => {
    const segs = (F[chr] ?? '').split(' ').filter(Boolean), ox = n * cw + cw * .14, sw = cw * .62;
    segs.forEach(s => { const [[x0, y0], [x1, y1]] = S[s]; const k0 = (1 - y0) * italic * ch, k1 = (1 - y1) * italic * ch; g.beginPath(); g.moveTo(ox + x0 * sw + k0, oy + y0 * ch); g.lineTo(ox + x1 * sw + k1, oy + y1 * ch); g.stroke(); });
  });
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}

/* kakémono : logo + slogan (tel qu'imprimé sur le kakémono de la salle informatique) */
function makeBanner(THREE, logoTex) {
  const c = document.createElement('canvas'); c.width = 340; c.height = 820; const g = c.getContext('2d');
  g.fillStyle = '#FFFFFF'; g.fillRect(0, 0, 340, 820);
  g.fillStyle = '#2B3540'; g.font = '600 22px Jost, Arial'; g.textAlign = 'center';
  ['Si tu ne vas pas à l’Université,', 'l’Université vient à toi.'].forEach((s, i) => g.fillText(s, 170, 70 + i * 30));
  const img = logoTex && logoTex.image; if (img) g.drawImage(img, 60, 160, 220, 238);
  g.fillStyle = '#3B4048'; g.font = '500 34px Jost, Arial'; ['MONTEREAU', 'DIGITALE', 'ACADÉMIE'].forEach((s, i) => g.fillText(s, 170, 470 + i * 44));
  g.fillStyle = '#F5C12A'; g.fillRect(0, 760, 340, 60);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
