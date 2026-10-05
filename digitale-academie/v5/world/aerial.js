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

  /* ---------- relief ---------- */
  const E = D.elev, raw = Uint8Array.from(atob(E.dm), c => c.charCodeAt(0)), H16 = new Int16Array(raw.buffer);
  const height = (x, z) => {
    const fx = Math.min(E.nx - 1.001, Math.max(0, (x - E.x0) / E.step)), fz = Math.min(E.nz - 1.001, Math.max(0, (z - E.z0) / E.step));
    const i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j, h = (a, b) => H16[b * E.nx + a] / 10;
    return h(i, j) * (1 - u) * (1 - v) + h(i + 1, j) * u * (1 - v) + h(i, j + 1) * (1 - u) * v + h(i + 1, j + 1) * u * v;
  };
  const stride = LOW ? 2 : 1, NX = Math.floor((E.nx - 1) / stride) + 1, NZ = Math.floor((E.nz - 1) / stride) + 1;
  const tp = new Float32Array(NX * NZ * 3), idx = [];
  for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) {
    const x = E.x0 + i * stride * E.step, z = E.z0 + j * stride * E.step;
    tp.set([x, H16[j * stride * E.nx + i * stride] / 10, z], (j * NX + i) * 3);
  }
  for (let j = 0; j < NZ - 1; j++) for (let i = 0; i < NX - 1; i++) { const a = j * NX + i; idx.push(a, a + NX, a + 1, a + 1, a + NX, a + NX + 1); }
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
    const c0 = new THREE.Vector3((D.a[0] + D.a[2]) / 2, 0, (D.a[1] + D.a[3]) / 2);
    shCam.position.copy(c0).addScaledVector(SUN, 5000); shCam.up.set(0, 1, 0); shCam.lookAt(c0); shCam.updateMatrixWorld();
    const inv = shCam.matrixWorldInverse, b = new THREE.Box3();
    for (const x of [D.a[0] - 400, D.a[2] + 400]) for (const z of [D.a[1] - 400, D.a[3] + 400]) for (const y of [-90, 140]) b.expandByPoint(new THREE.Vector3(x, y, z).applyMatrix4(inv));
    Object.assign(shCam, { left: b.min.x, right: b.max.x, bottom: b.min.y, top: b.max.y, near: -b.max.z - 50, far: -b.min.z + 50 });
    shCam.updateProjectionMatrix();
    U.uShM.value.multiplyMatrices(shCam.projectionMatrix, shCam.matrixWorldInverse);
    U.uBias.value = 1.2 / (shCam.far - shCam.near);
    const shScene = new THREE.Scene(), occ = new THREE.MeshBasicMaterial({ colorWrite: false, side: THREE.DoubleSide });
    shScene.add(new THREE.Mesh(tg, occ), new THREE.Mesh(bg, occ));
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
  const path = new THREE.CatmullRomCurve3([
    V(-1050, 590, 1900),   /* au-dessus des nuages, au sud-ouest ; le soleil se lève devant */
    V(-680, 470, 1480),    /* à travers la couche */
    V(-260, 330, 1180),    /* la vieille ville, la Seine */
    V(230, 245, 760),      /* le confluent de la Seine et de l'Yonne */
    V(330, 190, 260),      /* on remonte le coteau boisé de Surville */
    V(230, 185, -200),     /* on passe le pavillon, on vire */
    V(-40, 165, -290),     /* au nord, face au sud : la cour du pavillon en ligne de mire */
    V(-10, 140, -140),
    V(0, 105, -45)         /* au-dessus du pavillon, regard plongeant : la vraie photo à 0,32 m, puis le piqué */
  ], false, 'centripetal');
  const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3();
  const world = v => G.localToWorld(v);
  G.updateMatrixWorld(true);

  return {
    group: G, height, sun: SUN,
    /* k 0..1 le long du vol ; renvoie position et regard (monde) */
    cam(k) {
      G.updateMatrixWorld(true);
      /* temps égal par étape (et non par distance) : rapide en altitude, lent près du sol, comme un vrai vol */
      const p = path.getPoint(k), ahead = path.getPoint(Math.min(1, k + .03));
      const h = p.y - height(p.x, p.z);
      /* l'oiseau regarde devant lui et vers le bas (plus il est haut, plus il plonge le regard), puis fixe la cour */
      tmp.copy(ahead).sub(p); tmp.y = 0; tmp.normalize();
      const look = p.clone().addScaledVector(tmp, Math.max(60, h * 1.2)); look.y = height(look.x, look.z);
      look.lerp(V(0, 2, 6), ss(.66, .86, k));   /* le pavillon, au centre de l'image, bien avant la plongée */
      return { pos: world(p.clone()), look: world(look), h };
    },
    update(on, t, camPos) {
      G.visible = dome.visible = on; if (!on) return;
      dome.position.copy(camPos);
      G.worldToLocal(U.uCam.value.copy(camPos));
      CU.uTime.value = t;
      /* les nuages font face à l'oiseau (billboards) */
      clouds.children.forEach(m => { m.quaternion.copy(ctx.camera.quaternion); m.rotateZ(m.userData.spin); });
    },
    dispose() { /* */ }
  };
}
