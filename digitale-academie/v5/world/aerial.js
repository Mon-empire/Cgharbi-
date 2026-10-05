/*
  Le vrai Montereau vu du ciel, pour l'ouverture « on est l'oiseau ».
  Rien d'inventé : les orthophotographies de l'IGN (BD ORTHO, Licence ouverte Etalab 2.0) posées sur le relief réel
  (AWS Terrain Tiles : SRTM / EU-DEM) et les bâtiments d'OpenStreetMap (ODbL) à leur hauteur, le toit pris dans la photo.
  Trois photos emboîtées : la région (5,3 m par pixel), la ville survolée (0,9 m), les abords du pavillon (0,32 m).
  Direction artistique : l'heure dorée, en fin de journée. Soleil bas à l'ouest (10° au-dessus de l'horizon) :
  les vrais bâtiments et le relief projettent de longues ombres douces, calculées une fois au chargement (carte d'ombre) ;
  la lumière rasante traverse le voile atmosphérique (rayons volumétriques : l'air à l'ombre des tours reste sombre) ;
  ombres froides, lumières chaudes ; une couche de nuages dorés traversée au début.
  Repère des données : mètres, origine au pavillon, x vers l'est, z vers le sud, y = altitude au-dessus du pavillon.
  Le groupe est à l'échelle 1/4 (1 unité = 4 m) pour garder la profondeur de la caméra.
*/
export async function createAerial(ctx) {
  const { THREE, ss } = ctx;
  const ASSETS = document.getElementById('da-experience').dataset.daAssets || 'assets/';
  const LOW = ctx.mobile || ctx.level === 'LOW';
  const SCALE = .25;
  const G = new THREE.Group(); G.name = 'aerien'; G.visible = false;
  G.scale.setScalar(SCALE); G.position.set(0, -420, 0);
  ctx.scene.add(G);

  const [D, tWide, tCity, tPav] = await Promise.all([
    fetch(ASSETS + 'data/aerien.json').then(r => r.json()),
    ctx.tex('aerien-large.jpg'), ctx.tex(LOW ? 'aerien-ville-m.jpg' : 'aerien-ville.jpg'), ctx.tex(LOW ? 'aerien-pavillon-m.jpg' : 'aerien-pavillon.jpg')
  ]);
  [tWide, tCity, tPav].forEach(t => { t.anisotropy = ctx.renderer.capabilities.getMaxAnisotropy(); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; });

  /* ---------- la vraie 3D : modèle numérique de surface IGN (bâtiments, arbres, coteau) + orthophotos 0,5 m et 0,2 m ---------- */
  const IGN = ASSETS + 'ign/';
  const loadDsm = (f, Z) => new Promise(ok => {
    const im = new Image(); im.onload = () => {
      const c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
      const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(im, 0, 0);
      const px = g.getImageData(0, 0, c.width, c.height).data, A = new Float32Array(c.width * c.height);
      for (let i = 0; i < A.length; i++) A[i] = (px[i * 4] * 256 + px[i * 4 + 1]) / 10 + Z.base - D.pavAlt;
      ok({ A, w: c.width, h: c.height, Z });
    }; im.onerror = () => ok(null); im.src = IGN + f;
  });
  let Zn = null;
  try {
    const zj = await fetch(IGN + 'zones.json').then(r => r.ok ? r.json() : null);
    if (zj) {
      const [dv, dp] = await Promise.all([loadDsm('dsm-ville.png', zj.zones.ville), loadDsm('dsm-pav.png', zj.zones.pav)]);
      if (dv && dp) Zn = { ville: dv, pav: dp, meta: zj };
    }
  } catch (e) { Zn = null; }
  const inRect = (r, x, z, m = 0) => x > r[0] + m && x < r[2] - m && z > r[1] + m && z < r[3] - m;
  const dsmAt = (Dz, x, z) => {
    const r = Dz.Z.rect, st = Dz.Z.step, fx = Math.min(Dz.w - 1.001, Math.max(0, (x - r[0]) / st - .5)), fz = Math.min(Dz.h - 1.001, Math.max(0, (z - r[1]) / st - .5));
    const i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j, A = Dz.A, w = Dz.w;
    return A[j * w + i] * (1 - u) * (1 - v) + A[j * w + i + 1] * u * (1 - v) + A[(j + 1) * w + i] * (1 - u) * v + A[(j + 1) * w + i + 1] * u * v;
  };

  /* ---------- relief ---------- */
  const E = D.elev, raw = Uint8Array.from(atob(E.dm), c => c.charCodeAt(0)), H16 = new Int16Array(raw.buffer);
  const height0 = (x, z) => {
    const fx = Math.min(E.nx - 1.001, Math.max(0, (x - E.x0) / E.step)), fz = Math.min(E.nz - 1.001, Math.max(0, (z - E.z0) / E.step));
    const i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j, h = (a, b) => H16[b * E.nx + a] / 10;
    return h(i, j) * (1 - u) * (1 - v) + h(i + 1, j) * u * (1 - v) + h(i, j + 1) * (1 - u) * v + h(i + 1, j + 1) * u * v;
  };
  const height = (x, z) => Zn && inRect(Zn.pav.Z.rect, x, z, 2) ? dsmAt(Zn.pav, x, z) : Zn && inRect(Zn.ville.Z.rect, x, z, 2) ? dsmAt(Zn.ville, x, z) : height0(x, z);
  const stride = LOW ? 2 : 1, NX = Math.floor((E.nx - 1) / stride) + 1, NZ = Math.floor((E.nz - 1) / stride) + 1;
  const tp = new Float32Array(NX * NZ * 3), idx = [];
  for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) {
    const x = E.x0 + i * stride * E.step, z = E.z0 + j * stride * E.step;
    tp.set([x, H16[j * stride * E.nx + i * stride] / 10, z], (j * NX + i) * 3);
  }
  for (let j = 0; j < NZ - 1; j++) for (let i = 0; i < NX - 1; i++) {
    const a = j * NX + i;
    if (Zn && inRect(Zn.ville.Z.rect, tp[a * 3] + stride * E.step * .5, tp[a * 3 + 2] + stride * E.step * .5, 14)) continue;   /* la vraie 3D prend le relais */
    idx.push(a, a + NX, a + 1, a + 1, a + NX, a + NX + 1);
  }
  const tg = new THREE.BufferGeometry(); tg.setAttribute('position', new THREE.BufferAttribute(tp, 3)); tg.setIndex(idx); tg.computeVertexNormals();

  /* ---------- lumière, voile et photo : partagés par le sol et les bâtiments ---------- */
  const SUN = new THREE.Vector3(-.95, .19, -.25).normalize();    /* soleil couchant à l'ouest, 10° : il éclaire l'oiseau de côté */

  /* ---------- carte d'ombre du soleil (rendue une fois : la ville ne bouge pas) ---------- */
  const SHW = LOW ? 2048 : 4096, SHH = LOW ? 1024 : 2048;
  const shRT = new THREE.WebGLRenderTarget(SHW, SHH, { depthBuffer: true });
  shRT.depthTexture = new THREE.DepthTexture(SHW, SHH); shRT.depthTexture.type = THREE.UnsignedIntType;
  const shCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 10);
  const U = {
    uWide: { value: tWide }, uCity: { value: tCity }, uPav: { value: tPav },
    rWide: { value: new THREE.Vector4(...D.wide) }, rCity: { value: new THREE.Vector4(...D.a) }, rPav: { value: new THREE.Vector4(...D.p) },
    uSun: { value: SUN }, uCam: { value: new THREE.Vector3() }, uHaze: { value: new THREE.Color('#C3B7A6') }, uWarm: { value: 1 }, uShow: { value: 1 },
    uShTex: { value: shRT.depthTexture }, uShM: { value: new THREE.Matrix4() }, uShTexel: { value: new THREE.Vector2(1 / SHW, 1 / SHH) }, uBias: { value: 0 }
  };
  const PHOTO = `
    #define PCF ${LOW ? 1 : 2}
    #define STEPS ${LOW ? 6 : ['HIGH', 'ULTRA'].includes(ctx.level) ? 14 : 10}
    uniform sampler2D uWide,uCity,uPav,uShTex;uniform vec4 rWide,rCity,rPav;uniform vec3 uSun,uCam,uHaze;uniform float uWarm,uShow,uBias;
    uniform mat4 uShM;uniform vec2 uShTexel;
    vec3 shp(vec3 w){vec4 s=uShM*vec4(w,1.);return s.xyz/s.w*.5+.5;}
    float lit1(vec3 q){if(q.x<0.||q.x>1.||q.y<0.||q.y>1.)return 1.;return step(q.z-uBias,texture2D(uShTex,q.xy).r);}
    /* ombre douce : filtrage sur (2·PCF+1)² échantillons */
    float sunLit(vec3 w){vec3 q=shp(w);if(q.x<0.||q.x>1.||q.y<0.||q.y>1.)return 1.;float s=0.,n=0.;
      for(int i=-PCF;i<=PCF;i++)for(int j=-PCF;j<=PCF;j++){s+=step(q.z-uBias,texture2D(uShTex,q.xy+vec2(float(i),float(j))*uShTexel*1.6).r);n+=1.;}
      return s/n;}
    /* rayons volumétriques : part de l'air éclairé le long du regard (l'air à l'ombre des tours reste sombre) */
    float airLit(vec3 w){vec3 d=w-uCam;float j=fract(sin(dot(gl_FragCoord.xy,vec2(12.9898,78.233)))*43758.5453);float a=0.;
      for(int i=0;i<STEPS;i++){a+=lit1(shp(uCam+d*((float(i)+j)/float(STEPS))));}return a/float(STEPS);}
    vec2 ruv(vec4 r,vec2 p){return vec2((p.x-r.x)/(r.z-r.x),1.-(p.y-r.y)/(r.w-r.y));}
    float inside(vec4 r,vec2 p,float m){vec2 a=smoothstep(r.xy,r.xy+m,p)*(1.-smoothstep(r.zw-m,r.zw,p));return a.x*a.y;}
    vec3 photo(vec2 p){
      vec3 c=texture2D(uWide,ruv(rWide,p)).rgb;
      c=mix(c,texture2D(uCity,ruv(rCity,p)).rgb,inside(rCity,p,90.));
      c=mix(c,texture2D(uPav,ruv(rPav,p)).rgb,inside(rPav,p,40.));
      return c;}
    /* étalonnage « heure dorée » : contraste franc, ombres bleutées, lumières ambrées */
    vec3 grade(vec3 c){
      c=(c-.4)*1.08+.4;
      float l=dot(c,vec3(.299,.587,.114));
      c=mix(c*vec3(.84,.9,1.04),c*vec3(1.16,1.,.76),smoothstep(.12,.7,l)*uWarm);
      return max(c,0.);}
    /* lumière du soleil couchant sur la photo : ce qui est au soleil se réchauffe, ce qui est à l'ombre bleuit */
    vec3 sunlight(vec3 c,float sh,float facing){vec3 lit=c*vec3(1.26,1.03,.72)*(.92+.35*facing),dark=c*vec3(.3,.36,.5);return mix(dark,lit,sh);}
    vec3 haze(vec3 c,vec3 w){float d=length(w-uCam);float k=1.-exp(-d*d*4e-8-d*7e-5);
      vec3 v=normalize(w-uCam);float s=pow(max(dot(v,uSun),0.),3.);
      float al=airLit(w);
      vec3 air=mix(uHaze*vec3(.62,.68,.8),uHaze+vec3(.75,.42,.1)*s,al);
      return mix(c,air,clamp(k*(1.+s*.8),0.,.95));}`;
  const terrMat = new THREE.ShaderMaterial({
    uniforms: U, fog: false,
    vertexShader: 'varying vec3 vW;varying vec3 vN;void main(){vW=position;vN=normal;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: PHOTO + `varying vec3 vW;varying vec3 vN;
      void main(){vec3 N=normalize(vN);vec3 c=grade(photo(vW.xz));
        /* la photo porte la lumière douce du jour ; le soleil bas ajoute ses ombres longues et la chaleur des pentes qui lui font face */
        float f=clamp(dot(N,uSun)*2.2+.35,0.,1.);
        c=sunlight(c,sunLit(vW+N*1.5)*smoothstep(-.05,.15,dot(N,uSun)+.12),f);
        vec2 e=abs(vW.xz-(rWide.xy+rWide.zw)*.5)/((rWide.zw-rWide.xy)*.5);float edge=smoothstep(.7,.98,max(e.x,e.y));
        c=mix(c,uHaze,edge);
        gl_FragColor=vec4(haze(c,vW)*uShow,1.);}`
  });
  const terrain = new THREE.Mesh(tg, terrMat); terrain.frustumCulled = false; G.add(terrain);

  /* la vraie 3D : une dalle par orthophoto, le relief du MNS (bâtiments et arbres compris) ; une jupe cache les raccords */
  const dsmMeshes = [];
  if (Zn) {
    const tl = new THREE.TextureLoader(), maxAni = ctx.renderer.capabilities.getMaxAnisotropy();
    const loadT = f => tl.loadAsync(IGN + f).then(t => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = maxAni; t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; return t; }).catch(() => null);
    const HIQ = !LOW && ['HIGH', 'ULTRA'].includes(ctx.level);
    const DSMF = PHOTO + `uniform sampler2D uTile;uniform vec4 rTile;varying vec3 vW;varying vec3 vN;
      void main(){vec3 N=normalize(vN);vec2 tuv=ruv(rTile,vW.xz);
        /* une orthophoto n'a pas de façade : sur les murs, la teinte moyenne du voisinage, assombrie (aucune matière inventée) */
        float steep=1.-smoothstep(.42,.8,N.y);
        vec3 ph=mix(texture2D(uTile,tuv).rgb,texture2D(uTile,tuv,4.5).rgb*.78,steep*.75);
        vec3 c=grade(ph);
        float f=clamp(dot(N,uSun)*2.2+.35,0.,1.);
        c=sunlight(c,sunLit(vW+N*1.2)*smoothstep(-.05,.15,dot(N,uSun)+.12),f);
        c*=1.-.3*steep*(1.-clamp(dot(N,uSun)*2.,0.,1.));
        gl_FragColor=vec4(haze(c,vW)*uShow,1.);}`;
    const build = async (Dz, name, stride, hole, hiTex) => {
      const st = Dz.Z.step * stride, zr = Dz.Z.rect;
      await Promise.all(Dz.Z.tiles.map(async t => {
        const tex = await loadT(t.f + (hiTex ? '' : '-m') + '.jpg'); if (!tex) return;
        const [x0, z0, x1, z1] = t.rect, nx = Math.round((x1 - x0) / st) + 1, nz = Math.round((z1 - z0) / st) + 1;
        const P = [], I = [];
        for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { const x = x0 + (x1 - x0) * i / (nx - 1), z = z0 + (z1 - z0) * j / (nz - 1); P.push(x, dsmAt(Dz, x, z), z); }
        for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) {
          const a = j * nx + i, cx = x0 + (x1 - x0) * (i + .5) / (nx - 1), cz = z0 + (z1 - z0) * (j + .5) / (nz - 1);
          if (hole && inRect(hole, cx, cz, 1)) continue;
          I.push(a, a + nx, a + 1, a + 1, a + nx, a + nx + 1);
        }
        /* jupe sur les bords extérieurs de la zone : 30 m vers le bas */
        const edge = (ids) => { for (let k = 0; k < ids.length - 1; k++) { const a = ids[k], b = ids[k + 1], n = P.length / 3; P.push(P[a * 3], P[a * 3 + 1] - 30, P[a * 3 + 2], P[b * 3], P[b * 3 + 1] - 30, P[b * 3 + 2]); I.push(a, n, b, b, n, n + 1, a, b, n, b, n + 1, n); } };
        const row = j => Array.from({ length: nx }, (_, i) => j * nx + i), col = i => Array.from({ length: nz }, (_, j) => j * nx + i);
        if (Math.abs(z0 - zr[1]) < 1) edge(row(0)); if (Math.abs(z1 - zr[3]) < 1) edge(row(nz - 1));
        if (Math.abs(x0 - zr[0]) < 1) edge(col(0)); if (Math.abs(x1 - zr[2]) < 1) edge(col(nx - 1));
        const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); geo.setIndex(I); geo.computeVertexNormals();
        const mat = new THREE.ShaderMaterial({ uniforms: Object.assign({}, U, { uTile: { value: tex }, rTile: { value: new THREE.Vector4(x0, z0, x1, z1) } }), fog: false,
          vertexShader: 'varying vec3 vW;varying vec3 vN;void main(){vW=position;vN=normal;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}', fragmentShader: DSMF });
        const m = new THREE.Mesh(geo, mat); m.frustumCulled = false; m.name = 'mns-' + name; G.add(m); dsmMeshes.push(m);
      }));
    };
    await Promise.all([
      build(Zn.ville, 'ville', LOW ? 4 : HIQ ? 1 : 2, Zn.pav.Z.rect, HIQ),
      build(Zn.pav, 'pav', LOW ? 2 : 1, null, !LOW)
    ]);
  }
  /* au-delà des données : une plaine dans le voile, pour qu'aucun bord ne se voie à l'horizon */
  const plain = new THREE.Mesh(new THREE.RingGeometry(2200, 30000, 64, 1), new THREE.ShaderMaterial({
    uniforms: U, fog: false, side: THREE.DoubleSide,
    vertexShader: 'varying vec3 vW;void main(){vW=position.xzy*vec3(1.,0.,-1.);vW.y=-70.;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: PHOTO + `varying vec3 vW;void main(){gl_FragColor=vec4(uHaze*uShow,1.);}`
  }));
  plain.rotation.x = -Math.PI / 2; plain.position.y = -70; G.add(plain);

  /* ---------- bâtiments OSM : toits pris dans la photo, façades claires éclairées par le soleil bas ---------- */
  const pos = [], nor = [], top = [];
  for (const b of D.bld) {
    const hM = Math.max(3, b[0]), base = b[1] - 1.2, n = (b.length - 2) / 2; if (n < 3) continue;
    const pts = []; for (let i = 0; i < n; i++) pts.push(new THREE.Vector2(b[2 + 2 * i], b[3 + 2 * i]));
    let area = 0; for (let i = 0, j = n - 1; i < n; j = i++) area += (pts[j].x + pts[i].x) * (pts[j].y - pts[i].y);
    const s = area > 0 ? -1 : 1, roof = b[1] + hM;
    for (let i = 0; i < n; i++) {
      const a = pts[i], c = pts[(i + 1) % n], nx = (c.y - a.y) * s, nz = -(c.x - a.x) * s, nl = Math.hypot(nx, nz) || 1;
      for (const [p, y] of [[a, base], [c, base], [c, roof], [a, base], [c, roof], [a, roof]]) { pos.push(p.x, y, p.y); nor.push(nx / nl, 0, nz / nl); top.push(y === roof ? hM : 0); }
    }
    for (const t of THREE.ShapeUtils.triangulateShape(pts, [])) for (const k of t) { pos.push(pts[k].x, roof, pts[k].y); nor.push(0, 1, 0); top.push(-1); }
  }
  const bg = new THREE.BufferGeometry();
  bg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); bg.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); bg.setAttribute('aTop', new THREE.Float32BufferAttribute(top, 1));
  const bldMat = new THREE.ShaderMaterial({
    uniforms: U, fog: false,
    vertexShader: 'attribute float aTop;varying vec3 vW;varying vec3 vN;varying float vT;void main(){vW=position;vN=normal;vT=aTop;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: PHOTO + `varying vec3 vW;varying vec3 vN;varying float vT;
      float hh(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      void main(){vec3 c;
        if(vT<-.5){c=sunlight(grade(photo(vW.xz)),sunLit(vW+vec3(0.,1.,0.)),.6);}
        else{
          /* façade : enduit clair, rangs de fenêtres tous les 2,9 m, assombrie au pied (occlusion) */
          float l=max(dot(normalize(vN),normalize(vec3(uSun.x,0.,uSun.z))),0.);
          /* la couleur du bâtiment vient de la photo (toit, bord du toit) mêlée à un enduit neutre */
          vec3 wall=mix(photo(vW.xz)*.85,vec3(.58,.56,.52)*(.9+.2*hh(floor(vW.xz/40.))),.45);
          float fl=fract((vW.y)/2.9);float win=step(.35,fl)*step(fl,.75)*step(.3,fract((vW.x+vW.z)/3.1));
          wall=mix(wall,vec3(.12,.14,.18),win*.35);
          c=sunlight(grade(wall),sunLit(vW+normalize(vN)*1.2)*step(.02,l),l)*.85;
          c*=mix(.62,1.,smoothstep(0.,6.,vT));
        }
        gl_FragColor=vec4(haze(c,vW)*uShow,1.);}`
  });
  /* aucun volume modélisé à l'image : les bâtiments ne servent qu'à projeter leurs vraies ombres sur la photo */
  const blds = new THREE.Mesh(bg, bldMat); blds.frustumCulled = false;

  /* carte d'ombre : caméra orthographique alignée sur le soleil, ajustée à la zone survolée (relief et bâtiments en mètres) */
  {
    const RA = Zn ? Zn.ville.Z.rect : D.a;
    const c0 = new THREE.Vector3((RA[0] + RA[2]) / 2, 0, (RA[1] + RA[3]) / 2);
    shCam.position.copy(c0).addScaledVector(SUN, 5000); shCam.up.set(0, 1, 0); shCam.lookAt(c0); shCam.updateMatrixWorld();
    const inv = shCam.matrixWorldInverse, b = new THREE.Box3();
    for (const x of [RA[0] - 200, RA[2] + 200]) for (const z of [RA[1] - 200, RA[3] + 200]) for (const y of [-110, 90]) b.expandByPoint(new THREE.Vector3(x, y, z).applyMatrix4(inv));
    Object.assign(shCam, { left: b.min.x, right: b.max.x, bottom: b.min.y, top: b.max.y, near: -b.max.z - 50, far: -b.min.z + 50 });
    shCam.updateProjectionMatrix();
    U.uShM.value.multiplyMatrices(shCam.projectionMatrix, shCam.matrixWorldInverse);
    U.uBias.value = 1.2 / (shCam.far - shCam.near);
    const shScene = new THREE.Scene(), occ = new THREE.MeshBasicMaterial({ colorWrite: false, side: THREE.DoubleSide });
    shScene.add(new THREE.Mesh(tg, occ));
    if (dsmMeshes.length) dsmMeshes.forEach(m => shScene.add(new THREE.Mesh(m.geometry, occ))); else shScene.add(new THREE.Mesh(bg, occ));
    const r = ctx.renderer, prev = r.getRenderTarget();
    r.setRenderTarget(shRT); r.clear(); r.render(shScene, shCam); r.setRenderTarget(prev);
  }

  /* ---------- ciel de fin d'après-midi : dégradé, soleil voilé, il suit la caméra ---------- */
  const SK = { uSun: U.uSun, uHaze: U.uHaze, uShow: U.uShow };
  const dome = new THREE.Mesh(new THREE.SphereGeometry(1500, 48, 24), new THREE.ShaderMaterial({
    uniforms: SK, side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: 'varying vec3 vD;void main(){vD=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: `uniform vec3 uSun,uHaze;uniform float uShow;varying vec3 vD;
      void main(){float y=vD.y;
        vec3 zen=vec3(.26,.38,.6),hor=uHaze*1.08+vec3(.12,.05,-.04);
        vec3 c=mix(hor,zen,smoothstep(0.,.55,y));c=mix(c,uHaze*.9,1.-smoothstep(-.2,0.,y));
        float s=max(dot(vD,uSun),0.);c+=vec3(1.,.66,.32)*(pow(s,900.)*6.+pow(s,40.)*.5+pow(s,5.)*.3);
        gl_FragColor=vec4(c*uShow,1.);}`
  }));
  dome.renderOrder = -20; dome.frustumCulled = false; ctx.scene.add(dome); dome.visible = false;

  /* ---------- nuages : une couche qu'on traverse en commençant la descente ---------- */
  const CU = { uTime: { value: 0 }, uSun: U.uSun, uShow: U.uShow };
  const cloudMat = new THREE.ShaderMaterial({
    uniforms: CU, transparent: true, depthWrite: false, fog: false, side: THREE.DoubleSide,
    vertexShader: 'varying vec2 vUv;varying vec3 vW;void main(){vUv=uv;vW=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*viewMatrix*vec4(vW,1.);}',
    fragmentShader: `uniform float uTime,uShow;uniform vec3 uSun;varying vec2 vUv;varying vec3 vW;
      float hh(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hh(i),hh(i+vec2(1,0)),f.x),mix(hh(i+vec2(0,1)),hh(i+vec2(1,1)),f.x),f.y);}
      float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<6;i++){v+=a*n(p);p=p*2.03+vec2(1.7,9.2);a*=.5;}return v;}
      void main(){vec2 q=vUv*2.-1.;
        /* le nuage s'efface quand l'œil est dedans (pas d'aplat blanc devant la caméra) */float r=length(q*vec2(1.,1.6));
        float d=fbm(vUv*3.2+vec2(uTime*.004,0.)+vW.xz*.002);
        float a=smoothstep(.38,.72,d)*(1.-smoothstep(.3,1.,r));
        vec3 lit=vec3(1.,.8,.58),sh=vec3(.5,.52,.62);
        vec3 c=mix(sh,lit,smoothstep(.4,.85,d+.3*q.x*-uSun.x));
        a*=smoothstep(12.,60.,distance(vW,cameraPosition));
        gl_FragColor=vec4(c*uShow,a*.9);}`
  });
  const clouds = new THREE.Group(); G.add(clouds);
  const rnd = (a, b) => a + Math.random() * (b - a);
  for (let i = 0; i < (LOW ? 14 : 30); i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), cloudMat);
    const s = rnd(260, 560); m.scale.set(s, s * rnd(.32, .48), 1);
    /* autour du point de départ de l'oiseau, entre 470 et 640 m au-dessus du pavillon */
    m.position.set(-850 + rnd(-750, 750), rnd(380, 560), 1450 + rnd(-750, 550));
    m.userData.spin = rnd(-.12, .12);
    clouds.add(m);
  }

  /* ---------- trajectoire de l'oiseau (mètres) ---------- */
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  /* y : mètres au-dessus du pavillon (la Seine est à -72 m, le plateau de Surville à 0) */
  const path = new THREE.CatmullRomCurve3(Zn ? [
    V(-1250, 560, 2050),   /* au-dessus des nuages, au sud-ouest ; le soleil couchant sur la gauche */
    V(-820, 360, 1640),    /* à travers la couche, la vieille ville apparaît */
    V(-330, 230, 1290),    /* au-dessus de la vieille ville (assez haut : la vraie surface reste photographique) */
    V(110, 25, 1120),      /* on plonge sur l'Yonne, la collégiale à gauche */
    V(230, -12, 840),      /* au ras de l'eau : le confluent, le pont de Seine */
    V(450, -36, 720),      /* la Seine ; le coteau boisé de Surville se dresse devant */
    V(400, 40, 420),       /* on remonte le coteau, au-dessus des arbres */
    V(250, 95, 170),       /* la crête : le plateau, le pavillon en vue */
    V(60, 130, -150),      /* on passe le pavillon, on vire au nord */
    V(-60, 150, -270),     /* au nord, face au sud : la cour du pavillon en ligne de mire */
    V(-10, 140, -140),
    V(0, 105, -45)         /* au-dessus du pavillon, regard plongeant, puis le piqué */
  ] : [
    V(-1050, 590, 1900), V(-680, 470, 1480), V(-260, 330, 1180), V(230, 245, 760), V(330, 190, 260),
    V(230, 185, -200), V(-40, 165, -290), V(-10, 140, -140), V(0, 105, -45)
  ], false, 'centripetal');
  const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3();
  const world = v => G.localToWorld(v);
  G.updateMatrixWorld(true);

  /* ---------- repères : les vrais noms (OpenStreetMap), posés sur les lieux, le temps de les survoler ---------- */
  const MARKS = [
    { n: 'Montereau-Fault-Yonne', x: -90.7, z: 1335.5, up: 0, w: [.14, .3], wt: [.08, .3], big: true },
    { n: 'Collégiale Notre-Dame et Saint-Loup', x: 95.9, z: 1147.6, up: 30, w: [.24, .4], wt: [.22, .45] },
    { n: 'L’Yonne', x: 150, z: 1300, up: 2, w: [.28, .42], wt: [.14, .42] },
    { n: 'La Seine', x: 480, z: 780, up: 2, w: [.36, .56], wt: [.14, .5] },
    { n: 'Gare de Montereau', x: -1055.7, z: 1950.7, up: 4, w: [0, 0], wt: [.1, .3] },
    { n: 'Surville', x: 250, z: 60, up: 20, w: [0, 0], wt: [.42, .62], big: true, area: true },
    { n: 'Digitale Académie', x: 0, z: 0, up: 8, w: [.66, .9], wt: [.6, .95], big: true }
  ];
  const mk = document.createElement('div'); mk.className = 'v2-marks'; mk.setAttribute('aria-hidden', 'true');
  ctx.root ? ctx.root.append(mk) : document.getElementById('da-experience').append(mk);
  MARKS.forEach(m => {
    m.el = document.createElement('div'); m.el.className = 'v2-mark' + (m.big ? ' v2-mark--big' : '');
    m.el.innerHTML = '<span>' + m.n + '</span>'; if (m.area) m.el.classList.add('v2-mark--area'); mk.append(m.el);
    m.p = new THREE.Vector3(m.x, height(m.x, m.z) + m.up, m.z);
  });
  const pv = new THREE.Vector3();
  const marks = (k, on, mode) => {
    mk.style.display = on ? '' : 'none'; if (!on) return;
    const cv = ctx.renderer.domElement, W = cv.clientWidth, H = cv.clientHeight;
    MARKS.forEach(m => {
      const w = mode === 'terr' ? m.wt : m.w, a = ss(w[0], w[0] + .04, k) * (1 - ss(w[1] - .04, w[1], k));
      if (a < .01) { m.el.style.opacity = 0; return; }
      pv.copy(m.p); G.localToWorld(pv); const d = pv.distanceTo(ctx.camera.position); pv.project(ctx.camera);
      const vis = pv.z < 1 && Math.abs(pv.x) < .92 && Math.abs(pv.y) < .9 ? 1 : 0;
      m.el.style.opacity = (a * vis * (1 - ss(900, 1400, d / SCALE))).toFixed(3);
      m.el.style.transform = `translate3d(${((pv.x * .5 + .5) * W).toFixed(1)}px,${((.5 - pv.y * .5) * H).toFixed(1)}px,0)`;
    });
  };

  /* ---------- « Nous trouver » : survol à la manière d'un globe virtuel, du confluent jusqu'au pavillon ---------- */
  const tPath = new THREE.CatmullRomCurve3([
    V(-150, 1150, 1950),   /* très haut : toute la ville, le confluent au centre */
    V(450, 760, 1780),
    V(880, 420, 1300),     /* on tourne autour du confluent et de la vieille ville */
    V(860, 270, 760),
    V(560, 200, 380),      /* on remonte vers Surville */
    V(280, 150, 60),
    V(110, 115, -190),     /* on tourne autour du pavillon */
    V(-150, 90, -150),
    V(-170, 70, 70),
    V(-40, 55, 150),
    V(0, 42, 80)           /* face au pavillon, on plonge dans le faisceau */
  ], false, 'centripetal');
  const CONF = V(170, -66, 1000), PAV = V(0, 4, 0);
  const cam2 = k => {
    G.updateMatrixWorld(true);
    const p = tPath.getPoint(k); p.y = Math.max(p.y, height(p.x, p.z) + 25);
    const look = CONF.clone().lerp(PAV, eIO(ss(.3, .62, k)));
    return { pos: world(p), look: world(look) };
  };
  function eIO(x) { return x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; }
  /* le faisceau doré sur le pavillon */
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(7, 9, 420, 32, 1, true), new THREE.ShaderMaterial({
    uniforms: { uT: { value: 0 }, uI: { value: 0 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false, toneMapped: false,
    vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: `uniform float uT,uI;varying vec2 vUv;void main(){float a=pow(1.-vUv.y,2.2)*(.75+.25*sin(vUv.y*40.-uT*3.));gl_FragColor=vec4(vec3(1.,.78,.4)*a*uI,1.);}`
  }));
  beam.position.set(0, height(0, 0) + 210, 0); beam.visible = false; G.add(beam);
  /* le fil d'or : du confluent jusqu'au pavillon, posé sur la vraie surface */
  const filPts = new THREE.CatmullRomCurve3([V(185, 0, 960), V(212, 0, 890), V(310, 0, 700), V(270, 0, 450), V(130, 0, 210), V(0, 0, 0)]).getSpacedPoints(400);
  const fP = [], fI = [], FW = 3.2;
  filPts.forEach((q, i) => {
    const n = filPts[Math.min(filPts.length - 1, i + 1)].clone().sub(filPts[Math.max(0, i - 1)]).setY(0).normalize(), sd = V(-n.z, 0, n.x);
    const y = height(q.x, q.z) + 3;
    fP.push(q.x + sd.x * FW, y, q.z + sd.z * FW, q.x - sd.x * FW, y, q.z - sd.z * FW);
    if (i) { const a = (i - 1) * 2; fI.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  });
  const filGeo = new THREE.BufferGeometry(); filGeo.setAttribute('position', new THREE.Float32BufferAttribute(fP, 3)); filGeo.setIndex(fI);
  const fil = new THREE.Mesh(filGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color('#FFD600').multiplyScalar(2.2), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false, fog: false }));
  fil.visible = false; fil.frustumCulled = false; G.add(fil);
  const terr = (k, t, on) => {
    beam.visible = fil.visible = on; if (!on) return;
    beam.material.uniforms.uT.value = t; beam.material.uniforms.uI.value = ss(.5, .7, k) * (1.1 + .25 * Math.sin(t * 2));
    filGeo.setDrawRange(0, Math.floor(ss(.3, .7, k) * fI.length / 6) * 6);
  };

  return {
    group: G, height, sun: SUN, marks, cam2, terr,
    /* k 0..1 le long du vol ; renvoie position et regard (monde) */
    cam(k) {
      G.updateMatrixWorld(true);
      /* temps égal par étape (et non par distance) : rapide en altitude, lent près du sol, comme un vrai vol */
      const p = path.getPoint(k), ahead = path.getPoint(Math.min(1, k + .025));
      /* jamais dans un arbre ni un toit : 22 m de garde au-dessus de la vraie surface */
      p.y = Math.max(p.y, height(p.x, p.z) + 22); ahead.y = Math.max(ahead.y, height(ahead.x, ahead.z) + 22);
      const h = p.y - height(p.x, p.z);
      /* l'oiseau regarde devant lui ; haut, il plonge le regard ; au ras de l'eau, il regarde l'horizon */
      tmp.copy(ahead).sub(p); const climb = tmp.y; tmp.y = 0; tmp.normalize();
      const dist = 110 + h * 1.1, look = p.clone().addScaledVector(tmp, dist);
      const low = 1 - ss(60, 220, h);
      look.y = (1 - low) * height(look.x, look.z) + low * (p.y + climb * 2.2 - 12);
      look.lerp(V(0, 2, 6), ss(.8, .92, k));   /* le pavillon, au centre de l'image, bien avant la plongée */
      return { pos: world(p.clone()), look: world(look), h };
    },
    update(on, t, camPos) {
      G.visible = dome.visible = on; if (!on) { mk.style.display = 'none'; return; }
      dome.position.copy(camPos);
      G.worldToLocal(U.uCam.value.copy(camPos));
      CU.uTime.value = t;
      /* les nuages font face à l'oiseau (billboards) */
      clouds.children.forEach(m => { m.quaternion.copy(ctx.camera.quaternion); m.rotateZ(m.userData.spin); });
    },
    dispose() { /* */ }
  };
}
