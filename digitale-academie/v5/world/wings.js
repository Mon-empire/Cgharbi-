/*
  Les ailes : on est l'oiseau. Un goéland argenté (l'oiseau de la Seine et de l'Yonne), vu depuis son dos.
  Texture : une aile photoréaliste (image générée, détourée), posée sur deux pièces articulées par aile :
    le bras (épaule → poignet) et la main (poignet → pointe). L'aile droite est le miroir de la gauche.
  Le corps reste juste sous le cadre (comme une caméra embarquée sur le dos) ; on voit les ailes dans les coins bas,
  qui montent dans l'image à chaque battement.
  États : plané, battement, freinage (atterrissage : ailes hautes et cabrées), repli (les ailes sortent du champ).
*/
export function createWings(ctx, tex) {
  const { THREE } = ctx;
  const tau = Math.PI * 2;
  /* repères mesurés sur l'image de l'aile (u : 0 gauche → 1 droite ; v : 0 haut → 1 bas) */
  const IMG = { aspect: 1152 / 2048, shoulder: [.955, .44], wrist: [.47, .4] };
  const WD = 1.05, HD = WD * IMG.aspect;          /* largeur de l'image en mètres (envergure d'une aile ≈ 0,95 m) */
  const mat = new THREE.MeshStandardMaterial({
    map: tex, alphaTest: .42, side: THREE.DoubleSide, roughness: .86, metalness: 0,
    emissive: '#d4dcff', emissiveMap: tex, emissiveIntensity: .18, envMapIntensity: .3
  });
  /* l'aile est à quelques dizaines de centimètres de l'œil : légèrement hors de la zone de netteté, comme à l'objectif */
  mat.onBeforeCompile = sh => {
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <map_fragment>', 'diffuseColor *= texture2D( map, vMapUv, 1.1 );')
      .replace('#include <emissivemap_fragment>', 'totalEmissiveRadiance *= texture2D( emissiveMap, vEmissiveMapUv, 1.1 ).rgb;');
  };
  /* une pièce : la portion [u0, u1] de l'image, exprimée par rapport à son pivot (pu, pv) ; légère cambrure */
  const piece = (u0, u1, pu, pv) => {
    const g = new THREE.PlaneGeometry(1, 1, 18, 10), p = g.attributes.position, uv = g.attributes.uv;
    for (let i = 0; i < p.count; i++) {
      const su = uv.getX(i), sv = uv.getY(i);                 /* 0..1 sur la pièce (sv = 1 en haut) */
      const u = u0 + (u1 - u0) * su, v = 1 - sv;               /* coordonnées dans l'image */
      const x = (u - pu) * WD, z = (v - pv) * HD;
      p.setXYZ(i, x, -.06 * Math.pow((v - .45) * 2, 2) * HD, z);   /* bords d'attaque et de fuite légèrement abaissés */
      uv.setXY(i, u, 1 - v);
    }
    g.computeVertexNormals();
    return new THREE.Mesh(g, mat);
  };
  function wing(s) {
    const root = new THREE.Group(), hand = new THREE.Group();
    const [su, sv] = IMG.shoulder, [wu, wv] = IMG.wrist;
    root.add(piece(wu - .01, 1, su, sv));
    hand.position.set((wu - su) * WD, 0, (wv - sv) * HD); root.add(hand);
    hand.add(piece(0, wu + .01, wu, wv));
    const side = new THREE.Group(); side.scale.x = s < 0 ? 1 : -1; side.add(root);   /* l'image est une aile gauche ; miroir à droite */
    return { side, root, hand, s };
  }
  const G = new THREE.Group(); G.name = 'ailes';
  const L = wing(-1), Rw = wing(1);
  /* l'œil est sur le dos, juste derrière la tête : épaules sous le bas du cadre, un demi-mètre devant */
  const pose = { x: .1, y: -.32, z: -.46, dihedral: .22 };
  const place = () => { L.side.position.set(-pose.x, pose.y, pose.z); Rw.side.position.set(pose.x, pose.y, pose.z); };
  place(); G.add(L.side, Rw.side);

  let ph = 0, prevCos = 1;
  const api = {
    group: G, pose, place,
    /* écran en hauteur : le champ est étroit, les ailes se rapprochent du centre et reculent un peu */
    fit(aspect) { const k = Math.min(1, Math.max(0, (1.2 - aspect) / .7)); pose.x = .1 - .06 * k; pose.z = -.46 - .3 * k; pose.y = -.32 - .15 * k; place(); },
    /*
      st : { flap 0..1 (amplitude des battements), freq (Hz), flare 0..1 (freinage, ailes hautes et cabrées),
             fold 0..1 (repli : les ailes sortent du champ), gust 0..1 (turbulence), bank (inclinaison, rad) }
    */
    /* lumière propre aux plumes (la nuit, la lune ; à l'approche, le jour) */
    light(k) { mat.emissiveIntensity = k; },
    update(t, dt, st) {
      const { flap = 0, freq = 2.2, flare = 0, fold = 0, gust = 0, bank = 0 } = st;
      ph += dt * tau * freq * (.3 + .7 * Math.min(1, flap * 1.5));
      const beat = Math.sin(ph) * flap, up = Math.max(0, beat), down = Math.max(0, -beat);
      /* début de l'abattée (ailes au plus haut) : le coup d'aile qu'on entend */
      const cs = Math.cos(ph);
      if (prevCos > 0 && cs <= 0 && flap > .28 && fold < .5 && api.onBeat) api.onBeat(Math.min(1, flap * 1.3));
      prevCos = cs;
      /* le corps monte à chaque abattée et redescend au relèvement : l'œil le ressent */
      api.heave = -Math.sin(ph) * flap * .035 * (1 - fold); api.sway = Math.cos(ph) * flap * .006 * (1 - fold);
      const tremble = (Math.sin(t * 13.7) + Math.sin(t * 7.3 + 1)) * .006 * (.4 + gust);
      [L, Rw].forEach((w, k) => {
        const asym = k ? 1 : -1;
        /* épaule (dans le repère d'une aile gauche ; le miroir fait l'aile droite) */
        w.root.rotation.z = -(pose.dihedral + beat * .78 + flare * .95 - fold * .35 + asym * bank * .35) + tremble;   /* haut / bas */
        w.root.rotation.y = .1 - flare * .25 + fold * 1.25 + up * .1;                                          /* balayage vers l'arrière */
        w.root.rotation.x = -flare * .3 - fold * .4 + down * .05 - up * .35;                                  /* au relèvement, le dessus de l'aile se tourne vers l'œil */                                               /* cabré au freinage */
        /* poignet : la main se replie au relèvement, s'ouvre en bas de battement ; forme en « M » du goéland en plané */
        w.hand.rotation.z = .1 + up * .55 - down * .12 + flare * .2 + tremble * 2;
        w.hand.rotation.y = .12 + up * .35 + fold * 1.1 + flare * .15;
      });
      G.visible = fold < .995;
    }
  };
  api.heave = 0; api.sway = 0;
  return api;
}

/*
  La neige qui file : des flocons attachés à l'œil, étirés par la vitesse (traînées). Rien de blanc en aplat :
  chaque traînée est un trait d'un pixel, bleuté, qui s'éteint au loin et tout près.
*/
export function createStreaks(ctx) {
  const { THREE } = ctx;
  const N = ctx.mobile ? 200 : 480, D = 34;
  const base = new Float32Array(N * 2 * 3), end = new Float32Array(N * 2);
  for (let i = 0; i < N; i++) {
    const x = (Math.random() - .5) * 9, y = (Math.random() - .5) * 6, z = Math.random() * D;
    base.set([x, y, z, x, y, z], i * 6); end[i * 2] = 0; end[i * 2 + 1] = 1;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(base, 3)); g.setAttribute('aEnd', new THREE.BufferAttribute(end, 1));
  const U = { uOff: { value: 0 }, uLen: { value: .2 }, uAmt: { value: 0 } };
  const lines = new THREE.LineSegments(g, new THREE.ShaderMaterial({
    uniforms: U, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, fog: false, toneMapped: false,
    vertexShader: `uniform float uOff,uLen;attribute float aEnd;varying float vA;
      void main(){float z=-mod(position.z+uOff,${D}.)-.6;vec3 p=vec3(position.xy*(1.+(-z)*.08),z-aEnd*uLen*(1.+(-z)*.04));
        vA=smoothstep(.6,3.,-z)*(1.-smoothstep(14.,${D}.,-z))*(1.-aEnd*.85);
        gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`,
    fragmentShader: `uniform float uAmt;varying float vA;void main(){gl_FragColor=vec4(vec3(.62,.72,.9)*vA*uAmt,1.);}`
  }));
  lines.frustumCulled = false; lines.renderOrder = 20;
  let off = 0;
  return {
    group: lines,
    /* amt 0..1 (densité visible), speed (m/s) */
    update(dt, amt, speed) {
      off += dt * speed; U.uOff.value = off % 1e4; U.uLen.value = Math.min(1.4, speed * .035); U.uAmt.value = amt; lines.visible = amt > .003;
    }
  };
}

/*
  Poussière dans la lumière : des grains en suspension autour de l'œil, qui ne s'allument que dans la lumière rasante
  (diffusion vers l'avant : plus on regarde vers le soleil, plus ils brillent). Ils dérivent lentement, sans jamais
  former d'aplat : chacun est un point doux de quelques pixels.
*/
export function createDust(ctx) {
  const { THREE } = ctx;
  const N = ctx.mobile ? 220 : 600, B = 7;
  const p = new Float32Array(N * 3), r = new Float32Array(N);
  for (let i = 0; i < N; i++) { p.set([(Math.random() - .5) * B * 2, (Math.random() - .5) * B, -Math.random() * B * 2.2], i * 3); r[i] = Math.random(); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.setAttribute('aR', new THREE.BufferAttribute(r, 1));
  const U = { uT: { value: 0 }, uAmt: { value: 0 }, uSunV: { value: new THREE.Vector3(0, 0, -1) }, uPix: { value: ctx.renderer.getPixelRatio() } };
  const pts = new THREE.Points(g, new THREE.ShaderMaterial({
    uniforms: U, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, fog: false, toneMapped: false,
    vertexShader: `uniform float uT,uPix;attribute float aR;varying float vA;varying float vS;uniform vec3 uSunV;
      void main(){vec3 q=position;q.x+=sin(uT*.21+aR*40.)*.35;q.y+=sin(uT*.17+aR*23.)*.25+mod(uT*.05*(.3+aR),1.)*.4;q.z+=cos(uT*.13+aR*31.)*.3;
        vec4 mv=modelViewMatrix*vec4(q,1.);gl_Position=projectionMatrix*mv;
        float d=-mv.z;gl_PointSize=min(uPix*7.,uPix*(1.2+aR*2.)*(2.4/max(.6,d)));
        vS=pow(max(dot(normalize(mv.xyz),uSunV),0.),2.);vA=smoothstep(.3,1.,d)*(1.-smoothstep(9.,15.,d))*(.35+.65*fract(aR*7.3));}`,
    fragmentShader: `uniform float uAmt;varying float vA;varying float vS;
      void main(){float r=length(gl_PointCoord-.5);if(r>.5)discard;float a=(1.-smoothstep(0.,.5,r));
        gl_FragColor=vec4(vec3(1.,.78,.48)*a*vA*uAmt*(.25+1.6*vS),1.);}`
  }));
  pts.frustumCulled = false; pts.renderOrder = 19;
  const tv = new THREE.Vector3();
  return {
    group: pts,
    /* amt 0..1 ; sunWorld : direction du soleil (monde) */
    update(t, amt, sunWorld) {
      U.uT.value = t; U.uAmt.value = amt; pts.visible = amt > .003;
      if (sunWorld) U.uSunV.value.copy(tv.copy(sunWorld).transformDirection(ctx.camera.matrixWorldInverse));
    }
  };
}
