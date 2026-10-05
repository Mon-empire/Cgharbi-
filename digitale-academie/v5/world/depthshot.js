/*
  Photographies en profondeur : une vraie photo + sa carte de profondeur estimée (Depth Anything V2) deviennent un plan
  de cinéma. La caméra virtuelle avance (travelling), glisse (panoramique latéral), monte (grue) : les plans proches
  bougent plus que les lointains, comme dans la réalité. Mise au point (flou de profondeur par niveau de mip),
  rayons de lumière depuis la verrière, étalonnage chaud, fondu « par la profondeur » d'un plan au suivant.
  Le calque 2D (fil de lumière, repères) est projeté avec la même transformation : il reste collé à la photo.

  Repère : unités de hauteur d'écran, origine au centre de l'écran, y vers le haut.
  Image (u,v ∈ [0,1], v=0 en haut) -> X = ((u-.5)·W, (.5-v)·H) avec W,H la taille « cover » de l'image.
  Projection d'un point de disparité d (1 = proche) : P = (X - C)·zoom·(1 + dolly·(d - d0)) + T·(d - d0)
  C : point de l'image au centre du cadre (borné pour ne jamais sortir de la photo) ; T : déplacement de la caméra
  (grue, travelling latéral) — les plans proches glissent plus que le plan de référence d0.
*/
export async function createDepthShot(ctx) {
  const { THREE } = ctx;
  const BASE = ctx.assets + 'biblio/';
  const shots = {};
  const loader = new THREE.TextureLoader();
  const loadTex = f => new Promise(ok => loader.load(BASE + f, t => ok(t), undefined, () => ok(null)));
  const loadDepth = f => new Promise(ok => {
    const im = new Image(); im.crossOrigin = 'anonymous';
    im.onload = () => {
      const c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
      const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(im, 0, 0);
      const px = g.getImageData(0, 0, c.width, c.height).data, d = new Float32Array(c.width * c.height);
      for (let i = 0; i < d.length; i++) d[i] = px[i * 4] / 255;
      const t = new THREE.CanvasTexture(c); t.flipY = false; t.colorSpace = THREE.NoColorSpace; t.minFilter = THREE.LinearFilter; t.generateMipmaps = false;
      ok({ t, d, w: c.width, h: c.height });
    };
    im.onerror = () => ok(null); im.src = BASE + f;
  });
  /* chargement à la demande (la bibliothèque arrive après l'ouverture) ; version mobile plus légère */
  const load = tag => shots[tag] || (shots[tag] = (async () => {
    const [img, dep] = await Promise.all([loadTex(tag + (ctx.mobile ? '-m' : '') + '.jpg'), loadDepth(tag + '-d.png')]);
    if (!img || !dep) return null;
    img.flipY = false; img.colorSpace = THREE.SRGBColorSpace; img.anisotropy = 8; img.minFilter = THREE.LinearMipmapLinearFilter; img.generateMipmaps = true;
    const s = { tag, img, dep, asp: img.image.width / img.image.height };
    shots[tag].ready = s; return s;
  })());
  const ready = tag => shots[tag] && shots[tag].ready;

  const STEPS = ctx.mobile ? 4 : 6, RAYS = ctx.mobile ? 8 : 12;
  const mkU = () => ({ img: { value: null }, dep: { value: null }, size: { value: new THREE.Vector2(1, 1) }, F: { value: new THREE.Vector2() },
    T: { value: new THREE.Vector2() }, zoom: { value: 1 }, dolly: { value: 0 }, d0: { value: .5 }, roll: { value: 0 }, focus: { value: .5 }, dof: { value: 0 } });
  const A = mkU(), B = mkU();
  const U = { uScr: { value: 1.6 }, uMix: { value: 0 }, uFade: { value: 1 }, uWarm: { value: .5 }, uExpo: { value: 1 }, uRays: { value: 0 },
    uSun: { value: new THREE.Vector2(0, .6) }, uVig: { value: .5 }, uTime: { value: 0 }, uLift: { value: 0 } };
  for (const [k, u] of Object.entries(A)) U['a_' + k] = u;
  for (const [k, u] of Object.entries(B)) U['b_' + k] = u;
  const decl = p => `uniform sampler2D ${p}img,${p}dep;uniform vec2 ${p}size,${p}F,${p}T;uniform float ${p}zoom,${p}dolly,${p}d0,${p}roll,${p}focus,${p}dof;`;
  const sampler = p => `
    vec2 ${p}inv(vec2 P,out float d){
      float cr=cos(${p}roll),sr=sin(${p}roll);P=mat2(cr,sr,-sr,cr)*P;
      vec2 X=${p}F+P/${p}zoom;d=${p}d0;
      for(int i=0;i<${STEPS};i++){
        float s=${p}zoom*(1.+${p}dolly*(d-${p}d0));
        X=${p}F+(P-${p}T*(d-${p}d0))/s;
        vec2 uv=vec2(X.x/${p}size.x+.5,.5-X.y/${p}size.y);
        d=mix(d,texture2D(${p}dep,clamp(uv,.002,.998)).r,.75);
      }
      return vec2(X.x/${p}size.x+.5,.5-X.y/${p}size.y);
    }
    vec3 ${p}col(vec2 P,out float d){
      vec2 uv=${p}inv(P,d);
      float blur=${p}dof*abs(d-${p}focus)*6.;
      vec3 c=texture2D(${p}img,clamp(uv,.001,.999),blur).rgb;
      /* bords de l'image : on ne montre jamais au-delà, on étire doucement */
      return c;
    }
    /* luminance approchée (sans parallaxe) pour les rayons : une seule lecture, très floue */
    float ${p}lum(vec2 P){float cr=cos(${p}roll),sr=sin(${p}roll);P=mat2(cr,sr,-sr,cr)*P;vec2 X=${p}F+P/${p}zoom;
      vec2 uv=vec2(X.x/${p}size.x+.5,.5-X.y/${p}size.y);vec3 c=texture2D(${p}img,clamp(uv,.001,.999),4.).rgb;return smoothstep(.62,.95,dot(c,vec3(.3,.55,.15)));}`;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShaderMaterial({
    uniforms: U, transparent: true, depthTest: false, depthWrite: false, fog: false, toneMapped: true,
    vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: `${decl('a_')}${decl('b_')}
      uniform float uScr,uMix,uFade,uWarm,uExpo,uRays,uVig,uTime,uLift;uniform vec2 uSun;varying vec2 vUv;
      ${sampler('a_')}${sampler('b_')}
      float hh(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      void main(){
        vec2 P=(vUv-.5)*vec2(uScr,1.);
        float da,db=0.;vec3 ca=a_col(P,da),cb=ca;
        float w=0.;
        if(uMix>.001){cb=b_col(P,db);
          /* fondu par la profondeur : le premier plan du plan suivant arrive le premier */
          w=smoothstep(0.,1.,clamp(uMix*1.6-.3+(db-.5)*.6,0.,1.));}
        vec3 c=mix(ca,cb,w);float d=mix(da,db,w);
        /* rayons : la lumière de la verrière (zones claires) tirée vers la source, en suivant l'image */
        if(uRays>.001){
          vec3 r=vec3(0.);float acc=0.;vec2 dir=(uSun-P)/float(${RAYS});float j=hh(vUv*911.+uTime);
          for(int i=0;i<${RAYS};i++){vec2 q=P+dir*(float(i)+j);float l=w>.001?mix(a_lum(q),b_lum(q),w):a_lum(q);acc+=l*(1.-float(i)/float(${RAYS}));}
          float k=acc/float(${RAYS});
          c+=vec3(1.,.82,.55)*k*uRays*.9*(1.-d*.5);
        }
        float l=dot(c,vec3(.299,.587,.114));
        /* étalonnage : ombres légèrement relevées et bleutées, hautes lumières ambrées (heure dorée) */
        c=mix(c,c*vec3(1.1,.98,.8)+vec3(.012,.008,0.),uWarm);
        c=mix(c,c+vec3(.02,.025,.04)*(1.-l),uLift);
        c*=uExpo;
        float v=length((vUv-.5)*vec2(1.,.8));c*=1.-uVig*smoothstep(.35,.85,v);
        c+=(hh(vUv*1733.+fract(uTime*7.))-.5)*.012;
        gl_FragColor=vec4(c,uFade);}`
  }));
  mesh.renderOrder = 4;   /* sous le papier peint qui brûle (calque photo des salles, ordre 5) */ mesh.frustumCulled = false; mesh.visible = false;
  ctx.camera.add(mesh);

  /* calque 2D au-dessus de la scène WebGL, sous le texte */
  const ov = document.createElement('canvas'); ov.className = 'v2-ov'; ov.setAttribute('aria-hidden', 'true');
  ctx.root.querySelector('.v2-gl').after(ov);
  const g2 = ov.getContext('2d');
  let ovW = 1, ovH = 1, ovDirty = false;

  const size = (s, scr) => { const H = Math.max(1, scr / s.asp); return [H * s.asp, H]; };
  /* centre du cadre (unités image), borné : le cadre reste dans la photo au plan de référence */
  const center = (p, W, H, scr) => {
    const at = p.at || [.5, .5], z = p.zoom || 1, mx = Math.max(0, W / 2 - scr / 2 / z), my = Math.max(0, H / 2 - .5 / z);
    return [Math.max(-mx, Math.min(mx, (at[0] - .5) * W)), Math.max(-my, Math.min(my, (.5 - at[1]) * H))];
  };
  /* état courant de chaque plan (pour la projection des repères) */
  const cur = { a: null, b: null, pa: null, pb: null, mix: 0 };
  const setU = (u, s, p, scr) => {
    const [W, H] = size(s, scr);
    u.img.value = s.img; u.dep.value = s.dep.t; u.size.value.set(W, H);
    const [Cx, Cy] = center(p, W, H, scr); u.F.value.set(Cx, Cy);
    u.T.value.set(...(p.T || [0, 0])); u.zoom.value = p.zoom || 1; u.dolly.value = p.dolly || 0; u.d0.value = p.d0 ?? .5;
    u.roll.value = p.roll || 0; u.focus.value = p.focus ?? .5; u.dof.value = p.dof || 0;
  };
  const depthAt = (s, u, v) => { const D = s.dep, x = Math.min(D.w - 1, Math.max(0, Math.round(u * (D.w - 1)))), y = Math.min(D.h - 1, Math.max(0, Math.round(v * (D.h - 1)))); return D.d[y * D.w + x]; };

  /* point de l'image -> repère écran (unités de hauteur d'écran) */
  const projP = (which, u, v, d) => {
    const s = which === 'b' ? cur.b : cur.a, p = which === 'b' ? cur.pb : cur.pa; if (!s) return null;
    const scr = U.uScr.value, [W, H] = size(s, scr);
    d = d ?? depthAt(s, u, v);
    const [Cx, Cy] = center(p, W, H, scr), X = (u - .5) * W, Y = (.5 - v) * H, d0 = p.d0 ?? .5;
    const k = (p.zoom || 1) * (1 + (p.dolly || 0) * (d - d0)), T = p.T || [0, 0];
    let x = (X - Cx) * k + T[0] * (d - d0), y = (Y - Cy) * k + T[1] * (d - d0);
    const r = -(p.roll || 0), cr = Math.cos(r), sr = Math.sin(r);
    return [cr * x - sr * y, sr * x + cr * y, d];
  };
  const api = {
    on: false, U, load, ready, ov: g2,
    /* s : { a:'b0', pa:{zoom,at:[u,v],dolly,d0,T:[x,y],roll,focus,dof}, b, pb, mix, fade, warm, expo, rays, sun:[u,v] (image A), vig, lift } */
    /* own : le chapitre courant ; un chapitre voisin (encore visible) ne prend jamais la main sur lui */
    show(s, t, own = true) {
      if (!own && api.on) return false;
      const sa = ready(s.a); if (!sa) { load(s.a); return false; }
      const sb = s.b ? ready(s.b) : sa; if (s.b && !sb) load(s.b);
      const scr = U.uScr.value;
      setU(A, sa, s.pa || {}, scr); setU(B, sb || sa, sb && s.b ? (s.pb || {}) : (s.pa || {}), scr);
      U.uMix.value = sb && s.b ? (s.mix || 0) : 0; U.uFade.value = s.fade ?? 1; U.uWarm.value = s.warm ?? .5; U.uExpo.value = s.expo ?? 1;
      U.uRays.value = s.rays || 0; U.uVig.value = s.vig ?? .55; U.uLift.value = s.lift ?? .4; U.uTime.value = t || 0;
      Object.assign(cur, { a: sa, b: sb && s.b ? sb : null, pa: s.pa || {}, pb: s.pb || {}, mix: U.uMix.value });
      if (s.sun) { const q = projP('a', s.sun[0], s.sun[1], .05); U.uSun.value.set(q[0], q[1]); }
      api.on = true; mesh.visible = true; return true;
    },
    /* point de l'image (u,v) du plan 'a' ou 'b' -> pixels CSS du calque ; d forcé possible */
    project(which, u, v, d) {
      const q = projP(which, u, v, d); if (!q) return null;
      return [(q[0] / U.uScr.value + .5) * ovW, (.5 - q[1]) * ovH, q[2]];
    },
    depthAt(which, u, v) { const s = which === 'b' ? cur.b : cur.a; return s ? depthAt(s, u, v) : .5; },
    /* le calque est effacé une fois par image, puis chaque chapitre y dessine */
    clear() {
      if (ovDirty) { g2.setTransform(1, 0, 0, 1, 0, 0); g2.clearRect(0, 0, ov.width, ov.height); ovDirty = false; }
      const dpr = Math.min(devicePixelRatio, 2);
      g2.setTransform(dpr, 0, 0, dpr, 0, 0);
    },
    touch() { ovDirty = true; return g2; },
    reset() { api.on = false; mesh.visible = false; },
    fit() {
      const cam = ctx.camera, D = 19, h = 2 * D * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)) * 1.02;
      mesh.position.set(0, 0, -D); mesh.scale.set(h * cam.aspect, h, 1); U.uScr.value = cam.aspect;
      const dpr = Math.min(devicePixelRatio, 2), cv = ctx.renderer.domElement, w = cv.clientWidth || innerWidth, hh = cv.clientHeight || innerHeight;
      if (ov.width !== Math.round(w * dpr) || ov.height !== Math.round(hh * dpr)) { ov.width = Math.round(w * dpr); ov.height = Math.round(hh * dpr); }
      ovW = w; ovH = hh;
    }
  };
  return api;
}
