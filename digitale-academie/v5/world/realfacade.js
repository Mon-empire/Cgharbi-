/*
  La vraie façade, en volume : la photo d'hiver de la Ville (2560 × 1707) est projetée depuis la position exacte
  de l'appareil sur des volumes reconstruits dans sa perspective (projection photographique, comme au cinéma).
  Au premier plan, on voit la photo telle quelle ; dès que la caméra avance, on marche DANS la photo.

  Étalonnage, mesuré sur la photo (repère 2000 × 1334) :
    - point de fuite de l'allée (957, 633) ; horizon ≈ 650 ; appareil à 1,6 m
    - modules de 6 m : aile gauche 490 px pour 6,2 m, aile droite 515 px pour 5,7 m → cohérent avec 2,8 m de haut
    - profondeur du renfoncement d'entrée : un module (2,4 m) → focale ≈ 800 px, champ vertical ≈ 79,6°
  Aucun pixel n'est inventé : là où la photo ne voit pas, une couleur neutre prend le relais.
*/
export async function createRealFacade(ctx, { door }) {
  const { THREE } = ctx;
  const G = new THREE.Group();
  const tex = await ctx.tex('facade-hiver-hd.jpg');
  tex.anisotropy = 16;

  /* ---------- recalage conjoint des deux photos de la Ville ----------
     Photo 1 (hiver, 2560 × 1707, repère 2000 × 1334) : appareil à 1,6 m ; cap déduit du point de fuite de l'allée (x 957).
     Inconnues : sa focale et son inclinaison (elles fixent toutes les profondeurs).
     Photo 2 (2023, 1800 × 1200), prise devant l'entrée : position, cap, inclinaison, focale.
     On cherche l'ensemble qui fait coïncider 12 points vus sur les deux photos (logo, enseigne, coins de la porte et de la
     baie, bornes), avec une contrainte physique : les modules font 2,85 m de haut (aile gauche). Méthode du simplexe. */
  const mkCam1 = (vfov, pitch) => {
    const c = new THREE.PerspectiveCamera(vfov, 2560 / 1707, .1, 600); c.rotation.order = 'YXZ';
    const f = 667 / Math.tan(vfov * Math.PI / 360); c.rotation.set(pitch, -Math.atan(43 / f), 0);
    c.position.set(0, 1.6, 0); c.updateMatrixWorld(); c.updateProjectionMatrix(); return c;
  };
  const tools = c => {
    const ray = (x, y) => new THREE.Vector3(x / 1000 - 1, 1 - y / 667, .5).unproject(c).sub(c.position).normalize();
    const onGround = (x, y) => { const d = ray(x, y); return c.position.clone().addScaledVector(d, -c.position.y / d.y); };
    const atZ = (x, y, z) => { const d = ray(x, y); return c.position.clone().addScaledVector(d, (z - c.position.z) / d.z); };
    return { ray, onGround, atZ };
  };
  const pairsFor = c => {
    const { onGround, atZ } = tools(c);
    const zE0 = (onGround(722, 765).z + onGround(1075, 765).z) / 2;
    const zL0 = (onGround(178, 776).z + onGround(668, 776).z) / 2;
    const hL0 = atZ(668, 556, zL0).y;
    const W = (x, y) => atZ(x, y, zE0), Gp = (x, y, h = 0) => onGround(x, y).add(new THREE.Vector3(0, h, 0));
    return { hL0, pairs: [
      [W(905, 645), 998, 425], [W(995, 605), 1140, 363],
      [W(945, 750), 1052, 612], [W(1045, 750), 1240, 612], [W(945, 625), 1052, 405], [W(1045, 625), 1240, 405],
      [W(760, 755), 763, 608], [W(760, 640), 763, 425],
      [Gp(812, 785), 488, 875], [Gp(940, 785), 884, 890], [Gp(812, 785, .9), 488, 665], [Gp(940, 785, .9), 884, 678]
    ] };
  };
  const cam2 = new THREE.PerspectiveCamera(50, 1.5, .1, 600); cam2.rotation.order = 'YXZ';
  const setCam2 = q => { cam2.position.set(q[2], q[3], q[4]); cam2.rotation.set(q[6], q[5], 0); cam2.fov = q[7]; cam2.updateProjectionMatrix(); cam2.updateMatrixWorld(); };
  const tv = new THREE.Vector3();
  const jointErr = q => {
    if (q[0] < 15 || q[0] > 100 || q[7] < 25 || q[7] > 100 || Math.abs(q[1]) > .3) return 1e12;
    const { hL0, pairs } = pairsFor(mkCam1(q[0], q[1])); setCam2(q);
    let e = 0; for (const [w, px, py] of pairs) { tv.copy(w).project(cam2); if (tv.z > 1) return 1e12; const dx = (tv.x + 1) * 900 - px, dy = (1 - tv.y) * 600 - py; e += dx * dx + dy * dy; }
    /* focale réelle d'après les métadonnées EXIF : Canon EOS 600D (capteur 22,3 × 14,9 mm) à 18 mm → champ vertical 44,9° */
    return e + 4e4 * (hL0 - 2.85) ** 2 + 2e5 * (q[0] - 44.9) ** 2;
  };
  const nelder = (fn, x0, step, iters) => {
    const n = x0.length; let S = [x0]; for (let i = 0; i < n; i++) { const v = x0.slice(); v[i] += step[i]; S.push(v); }
    let F = S.map(fn);
    for (let it = 0; it < iters; it++) {
      const ord = F.map((f, i) => i).sort((a, b) => F[a] - F[b]); S = ord.map(i => S[i]); F = ord.map(i => F[i]);
      const c = new Array(n).fill(0); for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) c[j] += S[i][j] / n;
      const pt = a => c.map((v, j) => v + a * (S[n][j] - v));
      const xr = pt(-1), fr = fn(xr);
      if (fr < F[0]) { const xe = pt(-2), fe = fn(xe); if (fe < fr) { S[n] = xe; F[n] = fe; } else { S[n] = xr; F[n] = fr; } }
      else if (fr < F[n - 1]) { S[n] = xr; F[n] = fr; }
      else { const xc = pt(.5), fc = fn(xc); if (fc < F[n]) { S[n] = xc; F[n] = fc; } else { for (let i = 1; i <= n; i++) { S[i] = S[i].map((v, j) => S[0][j] + .5 * (v - S[0][j])); F[i] = fn(S[i]); } } }
    }
    const b = F.indexOf(Math.min(...F)); return { x: S[b], f: F[b] };
  };
  let best = { f: Infinity };
  for (const v1 of [44.9]) for (const p1 of [-.04, -.01, .02]) {
    const z0 = tools(mkCam1(v1, p1)).onGround(995, 765).z, x0 = tools(mkCam1(v1, p1)).onGround(995, 765).x;
    for (const dz of [4, 7]) for (const dx of [-2.5, -.5]) {
      const r = nelder(jointErr, [v1, p1, x0 + dx, 1.4, z0 + dz, .15, -.05, 55], [8, .03, .8, .2, .8, .08, .04, 8], 1400);
      if (r.f < best.f) best = r;
    }
  }
  for (let k = 0; k < 2; k++) { const r = nelder(jointErr, best.x, [2, .01, .2, .08, .2, .02, .015, 2], 1400); if (r.f < best.f) best = r; }
  const pc = mkCam1(best.x[0], best.x[1]);
  setCam2(best.x);
  const fit = pairsFor(pc);
  const rms2 = (() => { let e = 0; for (const [w, px, py] of fit.pairs) { tv.copy(w).project(cam2); const dx = (tv.x + 1) * 900 - px, dy = (1 - tv.y) * 600 - py; e += dx * dx + dy * dy; } return Math.sqrt(e / fit.pairs.length); })();
  const { ray, onGround, atZ } = tools(pc);

  /* recalage : la porte de la photo tombe sur la porte de l'intérieur modélisé */
  const doorPhoto = onGround(995, 765);
  const T = new THREE.Vector3(door.x - doorPhoto.x, 0, door.z - doorPhoto.z);
  const P = v => v.clone().add(T);

  /* matériau projeté : la photo si la surface est vue par l'appareil, sinon une couleur neutre */
  const U = {
    uMap: { value: tex }, uPV: { value: new THREE.Matrix4() }, uProj: { value: new THREE.Vector3() },
    uExpo: { value: 1 }, uTint: { value: new THREE.Color(1, 1, 1) }, uSat: { value: 1 }, uFade: { value: 1 }, uNight: { value: 0 },
    /* seconde photo (2023, prise devant l'entrée) : nette de près, fondue selon la proximité */
    uMap2: { value: null }, uPV2: { value: new THREE.Matrix4() }, uProj2: { value: new THREE.Vector3() }, uMix2: { value: 0 },
    /* vitrages relevés à la main (pixels : photo d'hiver 2000×1334, photo 2023 1800×1200) et têtes des lampadaires */
    uLights: { value: 0 },
    uWin1: { value: [[220, 628, 355, 768], [475, 626, 613, 766], [668, 632, 690, 758], [700, 636, 716, 758], [762, 645, 870, 752], [945, 637, 1043, 752], [1185, 597, 1347, 766], [1485, 597, 1560, 766], [1082, 640, 1110, 758]].map(r => new THREE.Vector4(...r)) },
    uWin2: { value: [[122, 385, 362, 658], [488, 398, 582, 650], [636, 415, 690, 612], [768, 430, 856, 605], [858, 430, 938, 605], [1062, 418, 1222, 612], [1285, 410, 1305, 580], [1330, 395, 1360, 590], [1410, 320, 1460, 560], [1655, 295, 1800, 500], [1062, 418, 1222, 612]].map(r => new THREE.Vector4(...r)) },
    uLamp: { value: [[157, 255], [1582, 332], [1338, 435]].map(p => new THREE.Vector2(...p)) },
    uD1: { value: null }, uD2: { value: null }, uShadow: { value: 0 }
  };
  const projMat = (fallback, minFace = .02) => new THREE.ShaderMaterial({
    uniforms: { ...U, uFall: { value: new THREE.Color(fallback) }, uMinFace: { value: minFace } },
    vertexShader: `varying vec3 vW;varying vec3 vN;void main(){vec4 w=modelMatrix*vec4(position,1.);vW=w.xyz;vN=normalize(mat3(modelMatrix)*normal);gl_Position=projectionMatrix*viewMatrix*w;}`,
    fragmentShader: `uniform sampler2D uMap;uniform mat4 uPV;uniform vec3 uProj,uTint,uFall;uniform float uExpo,uSat,uFade,uNight,uMinFace,uMix2;uniform sampler2D uMap2;uniform mat4 uPV2;uniform vec3 uProj2;varying vec3 vW;varying vec3 vN;
      uniform float uLights;uniform vec4 uWin1[9];uniform vec4 uWin2[11];uniform vec2 uLamp[3];
      float rectM(vec2 p,vec4 r){vec2 a=smoothstep(r.xy-2.,r.xy+2.,p)*(1.-smoothstep(r.zw-2.,r.zw+2.,p));return a.x*a.y;}
      /* ombre du projecteur : une surface cachée à l'appareil photo ne reçoit pas sa photo (plus de bornes fantômes au sol) */
      uniform sampler2D uD1,uD2;uniform float uShadow;
      float linZ(float z){return 2.*250./(251.-z*249.);}
      float seen(sampler2D d,vec2 uv,float z){float a=linZ(z),b=linZ(texture2D(d,uv).r*2.-1.);float s=.06+.004*b+.0006*b*b;return mix(1.,1.-smoothstep(s,s*1.8,a-b),uShadow);}
      void main(){
        vec4 c=uPV*vec4(vW,1.);vec2 uv=c.xy/c.w*.5+.5;
        float face=dot(normalize(vN),normalize(uProj-vW));
        float inside=step(0.,c.w)*step(0.,uv.x)*step(uv.x,1.)*step(0.,uv.y)*step(uv.y,1.);
        vec2 e=min(uv,1.-uv);float edge=smoothstep(0.,.015,min(e.x,e.y));
        float k=inside*edge*smoothstep(uMinFace,uMinFace+.16,face)*uFade;
        /* zone cachée à l'appareil (derrière une borne) : on la comble avec les pixels voisins, de part et d'autre */
        float s1=seen(uD1,uv,c.z/c.w);
        vec3 ph=mix((texture2D(uMap,uv+vec2(.014,0.)).rgb+texture2D(uMap,uv-vec2(.014,0.)).rgb)*.5,texture2D(uMap,uv).rgb,s1);
        float l=dot(ph,vec3(.299,.587,.114));ph=mix(vec3(l),ph,uSat)*uTint*uExpo;
        vec3 fb=uFall*(.55+.45*clamp(vN.y*.5+.5,0.,1.))*uExpo*uTint;
        vec3 col=mix(fb,ph,k);
        vec4 c2=uPV2*vec4(vW,1.);vec2 uv2=c2.xy/c2.w*.5+.5;
        float f2=dot(normalize(vN),normalize(uProj2-vW));
        float in2=step(0.,c2.w)*step(0.,uv2.x)*step(uv2.x,1.)*step(0.,uv2.y)*step(uv2.y,1.);
        vec2 e2=min(uv2,1.-uv2);float k2=in2*smoothstep(0.,.09,min(e2.x,e2.y))*smoothstep(uMinFace,uMinFace+.16,f2)*uMix2*uFade;
        float s2=seen(uD2,uv2,c2.z/c2.w);
        vec3 ph2=mix((texture2D(uMap2,uv2+vec2(.032,0.)).rgb+texture2D(uMap2,uv2-vec2(.032,0.)).rgb)*.5,texture2D(uMap2,uv2).rgb,s2);float l2=dot(ph2,vec3(.299,.587,.114));ph2=mix(vec3(l2),ph2,uSat)*uTint*uExpo;
        col=mix(col,ph2,k2);
        col=mix(col,col*vec3(.32,.38,.55),uNight);
        /* la nuit, le pavillon s'allume : vitrages mesurés sur chaque photo, lampadaires de la photo d'hiver */
        if(uLights>.001){
          vec2 p1=vec2(uv.x*2000.,(1.-uv.y)*1334.),p2=vec2(uv2.x*1800.,(1.-uv2.y)*1200.);
          /* lumière intérieure : plus forte sous les néons du plafond, plus douce en bas ; les montants restent sombres */
          float w1=0.,w2=0.;
          for(int i=0;i<9;i++){vec4 r=uWin1[i];w1+=rectM(p1,r)*(1.-.6*clamp((p1.y-r.y)/(r.w-r.y),0.,1.));}
          for(int i=0;i<11;i++){vec4 r=uWin2[i];w2+=rectM(p2,r)*(1.-.6*clamp((p2.y-r.y)/(r.w-r.y),0.,1.));}
          float a1=k*(1.-k2),lum=mix(l,l2,k2/(a1+k2+.001));
          /* montants blancs (clairs sur la photo) : ils restent en silhouette ; le verre garde les nuances de ses reflets */
          float win=min(1.,w1*a1+w2*k2)*(1.-smoothstep(.5,.7,lum))*(.35+lum*1.4);
          col=col*(1.-.6*min(1.,win)*uLights)+vec3(1.,.64,.3)*win*uLights*1.15;
          float g=0.;
          for(int i=0;i<3;i++){vec2 d=p1-uLamp[i];float r2=dot(d,d);g+=exp(-r2/500.)*1.6+exp(-r2/9000.)*.35;}
          col+=vec3(1.,.78,.5)*g*a1*uLights;
        }
        gl_FragColor=vec4(col,1.);}`
  });
  const mWall = projMat('#D9DCDF'), mGround = projMat('#4E5A44', -.4), mBack = projMat('#C8CCD1');
  const mProp = projMat('#8E918C', -1.2);   /* objets arrondis (bornes, arbuste, totem) : toujours la photo, même aux bords */
  const add = (geo, mat, pos) => { const m = new THREE.Mesh(geo, mat); m.position.copy(pos); G.add(m); return m; };
  /* boîte murale entre deux coins au sol (x0..x1 à la profondeur z), hauteur h, profondeur d vers l'arrière */
  const block = (x0, x1, zFront, h, d) => add(new THREE.BoxGeometry(x1 - x0, h, d), mWall, P(new THREE.Vector3((x0 + x1) / 2, h / 2, zFront - d / 2)));

  /* ---------- volumes mesurés sur la photo ---------- */
  const A = onGround(178, 776), B = onGround(668, 776);            /* aile gauche, façade */
  const zL = (A.z + B.z) / 2, hL = atZ(668, 556, zL).y;
  const E1 = onGround(722, 765), E2 = onGround(1075, 765);          /* entrée en retrait */
  const zE = (E1.z + E2.z) / 2, hE = atZ(900, 590, zE).y;
  const R1 = onGround(1135, 770), R2 = onGround(1650, 770);         /* aile droite */
  const zR = (R1.z + R2.z) / 2, hR = atZ(1400, 518, zR).y;
  const DEPTH = 12;
  block(A.x, B.x, zL, hL, DEPTH);
  block(R1.x, R2.x, zR, hR, DEPTH);
  /* module d'entrée percé de la porte double (les vantaux sont des objets à part, qui s'ouvrent) */
  const dl = atZ(945, 750, zE).x, dr = atZ(1045, 750, zE).x, dh = atZ(995, 625, zE).y;
  const ent = new THREE.Group(); G.add(ent);
  /* façade d'entrée mince : derrière la porte, c'est l'intérieur modélisé qui prend le relais */
  const entPiece = (x0, x1, y0, y1) => { const m = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, y1 - y0, .25), mWall); m.position.copy(P(new THREE.Vector3((x0 + x1) / 2, (y0 + y1) / 2, zE - .125))); ent.add(m); };
  add(new THREE.BoxGeometry(R1.x - B.x, .3, DEPTH), mWall, P(new THREE.Vector3((B.x + R1.x) / 2, hE + .15, zE - DEPTH / 2)));   /* toit du module d'entrée */
  entPiece(B.x, dl, 0, hE); entPiece(dr, R1.x, 0, hE); entPiece(dl, dr, dh, hE);
  /* vantaux : photo projetée tant qu'ils sont fermés, verre quand ils s'ouvrent */
  const glass = new THREE.MeshPhysicalMaterial({ color: '#7E8E9A', roughness: .05, metalness: .1, transparent: true, opacity: .22, envMapIntensity: 1.5, depthWrite: false });
  const alu = new THREE.MeshStandardMaterial({ color: '#9EA4AA', roughness: .45, metalness: .6 });
  const leaves = [[dl, (dl + dr) / 2, dl, 1], [(dl + dr) / 2, dr, dr, -1]].map(([a, b, hinge, dir]) => {
    const pivot = new THREE.Group(); pivot.position.copy(P(new THREE.Vector3(hinge, 0, zE + .01))); G.add(pivot);
    const w = b - a, cx = (a + b) / 2 - hinge;
    const closed = new THREE.Mesh(new THREE.BoxGeometry(w, dh, .04), mWall); closed.position.set(cx, dh / 2, 0); pivot.add(closed);
    const open = new THREE.Group(); open.visible = false; pivot.add(open);
    const g = new THREE.Mesh(new THREE.BoxGeometry(w - .1, dh - .14, .02), glass); g.position.set(cx, dh / 2, 0); open.add(g);
    for (const [fw, fh, fx, fy] of [[w, .07, cx, dh - .035], [w, .1, cx, .05], [.06, dh, cx - w / 2 + .03, dh / 2], [.06, dh, cx + w / 2 - .03, dh / 2]]) { const f = new THREE.Mesh(new THREE.BoxGeometry(fw, fh, .06), alu); f.position.set(fx, fy, 0); open.add(f); }
    return { pivot, closed, open, dir };
  });
  /* joues latérales entre les ailes et l'entrée */
  add(new THREE.BoxGeometry(.2, hL, Math.abs(zL - zE) + .2), mWall, P(new THREE.Vector3(B.x, hL / 2, (zL + zE) / 2)));
  add(new THREE.BoxGeometry(.2, hR, Math.abs(zR - zE) + .2), mWall, P(new THREE.Vector3(R1.x, hR / 2, (zR + zE) / 2)));

  /* sol (allée, pelouses, terrasse) : un grand plan qui reçoit la photo */
  const ground = add(new THREE.PlaneGeometry(220, 220), mGround, P(new THREE.Vector3(0, 0, -60)));
  ground.rotation.x = -Math.PI / 2;
  /* bornes inox, totem, gros arbuste, jeunes arbres : volumes posés à leur place mesurée */
  for (const x of [812, 940]) { const p = onGround(x, 785); add(new THREE.CylinderGeometry(.11, .11, .9, 20), mProp, P(p.add(new THREE.Vector3(0, .45, 0)))); }
  const tp = onGround(1740, 850); const tH = atZ(1740, 410, tp.z).y;
  add(new THREE.BoxGeometry(1.28, tH, .18), mProp, P(new THREE.Vector3(tp.x, tH / 2, tp.z)));
  /* toile de fond lointaine : ciel, château d'eau, immeubles, arbres */
  const ZB = -95, hB = 2 * Math.tan(THREE.MathUtils.degToRad(pc.fov / 2)) * Math.abs(ZB) * 1.25;
  const back = add(new THREE.PlaneGeometry(hB * 1.6, hB), mBack, P(new THREE.Vector3(Math.tan(pc.rotation.y) * ZB, 1.6 - Math.tan(pc.rotation.x) * ZB, ZB)));

  /* points mesurés sur la photo (à calculer AVANT de recaler le projecteur) */
  const LOGO = P(atZ(905, 645, zE)).add(new THREE.Vector3(0, 0, .05)), SIGN = P(atZ(995, 605, zE));
  const PATH = { x: P(onGround(957, 1334)).x, z0: P(onGround(957, 1334)).z, z1: P(onGround(957, 790)).z };
  /* seconde photo : même translation que le reste, puis matrices du projecteur */
  const tex2 = await ctx.tex('facade-2023.jpg');
  cam2.position.add(T); cam2.updateMatrixWorld();
  U.uMap2.value = tex2; U.uPV2.value.multiplyMatrices(cam2.projectionMatrix, cam2.matrixWorldInverse); U.uProj2.value.copy(cam2.position);
  const forward2 = new THREE.Vector3(0, 0, -1).applyQuaternion(cam2.quaternion);

  /* projecteur recalé (même translation que les volumes) */
  pc.position.add(T); pc.updateMatrixWorld();
  U.uPV.value.multiplyMatrices(pc.projectionMatrix, pc.matrixWorldInverse);
  U.uProj.value.copy(pc.position);
  const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(pc.quaternion);

  /* cartes de profondeur des deux appareils (géométrie fixe : rendues une seule fois) ; near 1 / far 250 = linZ du shader */
  const depthOf = cam => {
    const c = cam.clone(); c.near = 1; c.far = 250; c.updateProjectionMatrix(); c.updateMatrixWorld();
    const rt = new THREE.WebGLRenderTarget(2048, 1366, { depthBuffer: true });
    rt.depthTexture = new THREE.DepthTexture(2048, 1366, THREE.FloatType);
    const r = ctx.renderer; r.setRenderTarget(rt); r.render(G, c); r.setRenderTarget(null);
    return { tex: rt.depthTexture, pv: new THREE.Matrix4().multiplyMatrices(c.projectionMatrix, c.matrixWorldInverse) };
  };
  try {
    G.updateMatrixWorld(true);
    const d1 = depthOf(pc), d2 = depthOf(cam2);
    U.uD1.value = d1.tex; U.uD2.value = d2.tex; U.uPV.value.copy(d1.pv); U.uPV2.value.copy(d2.pv); U.uShadow.value = 1;
  } catch (e) { console.warn('[Digitale Académie] ombres de projection indisponibles :', e); }

  ctx.scene.add(G);
  return {
    group: G, entrance: ent, leaves, U, debug: { pc, ray, onGround, atZ, T, doorPhoto, zE, zL, zR, cam2, rms2, params2: best.x, hL: fit.hL0 },
    viewpoint2: cam2.position.clone(), forward2, fov2: cam2.fov,
    /* proximité de la seconde photo : 0 = hiver (photo lointaine), 1 = automne (photo proche) */
    season(k) { U.uMix2.value = k; },
    viewpoint: pc.position.clone(), forward,
    logo: LOGO, logoRadius: .4, sign: SIGN, path: PATH,
    planes: { zL: zL + T.z, zE: zE + T.z, zR: zR + T.z, hL, hE, hR },
    /* ouverture de la porte : 0 fermée (photo) → 1 ouverte (verre) */
    open(k) { const e = k * k * (3 - 2 * k); leaves.forEach(l => { l.closed.visible = e < .02; l.open.visible = e >= .02; l.pivot.rotation.y = -l.dir * e * 1.7; }); },
    /* étalonnage : heure du jour et éloignement de l'appareil (la photo s'efface quand on s'en écarte trop) */
    grade({ expo = 1, tint = [1, 1, 1], sat = 1, night = 0, lights = 0 } = {}) { U.uExpo.value = expo; U.uTint.value.setRGB(...tint); U.uSat.value = sat; U.uNight.value = night; U.uLights.value = lights; },
    update(camPos) { const d = camPos.distanceTo(pc.position); U.uFade.value = 1 - ctx.ss(18, 45, d); }
  };
}
