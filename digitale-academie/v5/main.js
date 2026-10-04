/*
  Digitale Académie · « Le Seuil » — moteur du film
  Direction : deux matières seulement. La vraie photographie (façade, salles, étudiants, la ville réelle en données)
  et la lumière, dans le noir. Une seule couleur signature : le jaune de la Digitale Académie (et le cyan du second coach).
  Rien n'est modélisé « à l'imitation » : ce qui est réel est photographique, ce qui est merveilleux est lumière.

    I    Le seuil      noir → un point → le logo en particules → il se défait vers les fenêtres de la vraie façade,
                       qui s'allument ; la façade émerge de la nuit ; approche continue (hiver 2019 → automne 2023) ;
                       la porte s'ouvre sur la lumière (la nuée qui attend dans l'embrasure).
    II   Le lieu       derrière la porte, le noir : les 3 000 points écrivent « 3 000+ », deviennent « 600 m² », puis « 2 ».
    III  La visite     les vraies salles (photos de la Ville mises en volume), allumées au néon.
    IV   Les savoirs   une tour de lumière : un anneau par niveau, du DAEU au Master.
    V    Le chemin     le fil monte en spirale : sept étapes, sept lumières.
    VI   Les veilleurs une vraie photo, le silence ; puis les ateliers.
    VII  Le territoire la ville réelle en maquette de lumière (OpenStreetMap, EU-DEM).
    VIII L'heure bleue retour devant la vraie porte.
  Mouvement réduit ou WebGL absent : la page reste éditoriale et lisible, rien ne s'exécute.
*/
const R = document.getElementById('da-experience');
const VEND = R.dataset.daVendor || 'https://cdn.jsdelivr.net/npm/';
const ASSETS = R.dataset.daAssets || 'assets/';
const forced = (() => { try { return localStorage.getItem('da-motion'); } catch (e) { return null; } })();
const reduce = forced === 'off' || (forced !== 'on' && matchMedia('(prefers-reduced-motion: reduce)').matches);
const hasGL = (() => { try { return !!document.createElement('canvas').getContext('webgl2'); } catch (e) { return false; } })();

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const ss = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
const eOut = t => 1 - Math.pow(1 - clamp(t), 4);
const eIO = t => { t = clamp(t); return t < .5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2; };
const damp = (a, b, k, dt) => lerp(a, b, 1 - Math.exp(-k * dt));

const status = document.createElement('p');
status.className = 'v2-status'; status.setAttribute('role', 'status'); R.append(status);
const say = m => { status.textContent = m; status.hidden = !m; };
const cue = name => R.dispatchEvent(new CustomEvent('da:cue', { detail: name }));
import('./core/sound.js').then(({ initSound }) => {
  const snd = initSound({ root: R, assets: ASSETS });
  R.addEventListener('da:cue', e => snd.cue(e.detail));
}).catch(e => console.warn('[Digitale Académie] son indisponible :', e));
const motionBtn = R.querySelector('[data-da-action="motion"]');
if (motionBtn) {
  motionBtn.setAttribute('aria-pressed', String(reduce));
  motionBtn.addEventListener('click', () => { try { localStorage.setItem('da-motion', reduce ? 'on' : 'off'); } catch (e) { /* */ } location.reload(); });
}
const booting = R.classList.contains('is-booting');
const unboot = () => R.classList.remove('is-booting');
if (reduce || !hasGL) R.classList.remove('is-live', 'is-booting');
if (reduce) say('Animations réduites : version sans 3D.');
else if (!hasGL) say('WebGL 2 indisponible sur ce navigateur : version sans 3D.');
else {
  say('Chargement…');
  start().then(() => say('')).catch(e => { console.warn('[Digitale Académie] scène indisponible :', e); R.classList.remove('is-live'); unboot(); say('Scène 3D indisponible : ' + (e && e.message || e)); });
}

async function start() {
  const T = VEND + 'three@0.169.0/', J = T + 'examples/jsm/';
  const [THREE, { EffectComposer }, { RenderPass }, { UnrealBloomPass }, { ShaderPass }, { OutputPass }, { RoomEnvironment }, OT] = await Promise.all([
    import(T + '+esm'),
    import(J + 'postprocessing/EffectComposer.js/+esm'), import(J + 'postprocessing/RenderPass.js/+esm'),
    import(J + 'postprocessing/UnrealBloomPass.js/+esm'), import(J + 'postprocessing/ShaderPass.js/+esm'),
    import(J + 'postprocessing/OutputPass.js/+esm'), import(J + 'environments/RoomEnvironment.js/+esm'),
    import(VEND + 'opentype.js@1.3.4/dist/opentype.module.js')
  ]);
  const parseFont = OT.parse || OT.default.parse;
  const loadFont = w => fetch(ASSETS + `fonts/jost-${w}.woff`).then(r => { if (!r.ok) throw new Error('police ' + w + ' : ' + r.status); return r.arrayBuffer(); }).then(parseFont);
  const [fontHeavy, fontMid] = await Promise.all([loadFont(800), loadFont(600)]);
  const mobile = matchMedia('(max-width: 760px)').matches, coarse = matchMedia('(pointer: coarse)').matches;

  /* ---------- qualité ---------- */
  const QL = ['LOW', 'MEDIUM', 'HIGH', 'ULTRA'];
  const QCFG = { ULTRA: { dpr: 2, np: 40000, samples: 4 }, HIGH: { dpr: 1.6, np: 26000, samples: 4 }, MEDIUM: { dpr: 1.25, np: 14000, samples: 2 }, LOW: { dpr: 1, np: 7000, samples: 0 } };
  const pickLevel = () => {
    let f = new URLSearchParams(location.search).get('qualite');
    try { f = f || localStorage.getItem('da-quality'); } catch (e) { /* */ }
    if (f && QL.includes(f.toUpperCase())) return f.toUpperCase();
    const mem = navigator.deviceMemory || 8, cores = navigator.hardwareConcurrency || 4;
    if (mobile) return mem <= 4 || cores <= 4 ? 'LOW' : 'MEDIUM';
    if (mem >= 8 && cores >= 8 && devicePixelRatio >= 1.5) return 'ULTRA';
    if (mem <= 4 || cores <= 4) return 'MEDIUM';
    return 'HIGH';
  };
  let level = pickLevel();
  const Q = QCFG[level];

  let TOP = 0;
  const measure = () => {
    const h = document.querySelector('.header.js-fixed-element, .header-wrapper .js-fixed-element');
    TOP = h && getComputedStyle(h).position === 'fixed' ? Math.round(h.getBoundingClientRect().height) : 0;
    R.style.setProperty('--top', TOP + 'px'); R.style.setProperty('--vh', innerHeight + 'px');
  };
  measure();

  /* ---------- rendu ---------- */
  const canvas = document.createElement('canvas'); canvas.className = 'v2-gl'; canvas.setAttribute('aria-hidden', 'true'); R.prepend(canvas);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, Q.dpr));
  renderer.setClearColor('#020307', 1);
  /* tone mapping neutre : les photos de la Ville gardent leurs vraies couleurs */
  renderer.toneMapping = THREE.NeutralToneMapping; renderer.toneMappingExposure = 1;
  const scene = new THREE.Scene();
  const VOIDC = new THREE.Color('#020307');
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), .02).texture; scene.environmentIntensity = .4;
  const moon = new THREE.DirectionalLight('#B9C6FF', 1); moon.position.set(-60, 80, 40); scene.add(moon);
  const hemi = new THREE.HemisphereLight('#7E86C8', '#2A1E3A', .4); scene.add(hemi);
  const key = new THREE.PointLight('#FFE9A8', 0, 80, 1.5), rim = new THREE.PointLight('#7FB8FF', 0, 80, 1.5); scene.add(key, rim);

  const camera = new THREE.PerspectiveCamera(38, 1, .1, 2000);
  const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: Q.samples });
  const composer = new EffectComposer(renderer, rt);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), .55, .6, .85); composer.addPass(bloom);
  /* passe finale : grain photographique fin, vignette douce, légère aberration aux bords, voiles noir et ambre */
  const fx = new ShaderPass({
    uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uCA: { value: .0006 }, uBlack: { value: 0 }, uAmber: { value: 0 } },
    vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: `uniform sampler2D tDiffuse;uniform float uTime,uCA,uBlack,uAmber;varying vec2 vUv;
      float h(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
      void main(){vec2 d=vUv-.5;float r=dot(d,d);vec2 o=d*uCA*(1.+r*5.);
        vec3 c=vec3(texture2D(tDiffuse,vUv+o).r,texture2D(tDiffuse,vUv).g,texture2D(tDiffuse,vUv-o).b);
        c=mix(c,vec3(.5,.33,.1)*(.85+.3*(1.-r*2.)),uAmber);
        c*=1.-r*.9;c+=(h(vUv*vec2(1123.,987.)+fract(uTime*7.))-.5)*.022;c*=1.-uBlack;gl_FragColor=vec4(max(c,0.),1.);}`
  });
  composer.addPass(fx); composer.addPass(new OutputPass());

  /* ---------- outils partagés ---------- */
  function buildText(font, str, size, depth, bevel, material) {
    const scale = size / font.unitsPerEm, glyphs = font.stringToGlyphs(str), group = new THREE.Group();
    let x = 0; const letters = [];
    glyphs.forEach((g, i) => {
      if (i) x += font.getKerningValue(glyphs[i - 1], g) * scale;
      const cmds = g.getPath(0, 0, size).commands;
      if (cmds.length) {
        const sp = new THREE.ShapePath();
        for (const c of cmds) {
          if (c.type === 'M') sp.moveTo(c.x, -c.y); else if (c.type === 'L') sp.lineTo(c.x, -c.y);
          else if (c.type === 'Q') sp.quadraticCurveTo(c.x1, -c.y1, c.x, -c.y); else if (c.type === 'C') sp.bezierCurveTo(c.x1, -c.y1, c.x2, -c.y2, c.x, -c.y);
        }
        let big = 0, cw = true;
        for (const s of sp.subPaths) { const a = THREE.ShapeUtils.area(s.getPoints()); if (Math.abs(a) > big) { big = Math.abs(a); cw = a < 0; } }
        const geo = new THREE.ExtrudeGeometry(sp.toShapes(!cw), { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel * .6, bevelSegments: 5, curveSegments: 14 });
        geo.computeBoundingBox(); const bb = geo.boundingBox, cx = (bb.min.x + bb.max.x) / 2;
        geo.translate(-cx, -size * .36, -depth / 2);
        const m = new THREE.Mesh(geo, material); m.userData.x = x + cx; letters.push(m); group.add(m);
      }
      x += g.advanceWidth * scale;
    });
    letters.forEach(m => { m.userData.x -= x / 2; m.position.x = m.userData.x; });
    group.userData = { width: x, letters };
    return group;
  }
  /* échantillonne des points sur les faces avant d'un texte extrudé (à surface égale) */
  function samplerOf(txt, holder) {
    const tris = [], va = new THREE.Vector3(), vb = new THREE.Vector3(), vc = new THREE.Vector3(); let area = 0;
    txt.userData.letters.forEach(m => {
      const g = m.geometry, pa = g.attributes.position, ix = g.index, cnt = ix ? ix.count : pa.count, get = k => ix ? ix.getX(k) : k;
      const zf = g.boundingBox ? g.boundingBox.max.z - 1e-4 : 0;
      for (let t = 0; t < cnt; t += 3) {
        va.fromBufferAttribute(pa, get(t)); vb.fromBufferAttribute(pa, get(t + 1)); vc.fromBufferAttribute(pa, get(t + 2));
        if (va.z < zf || vb.z < zf || vc.z < zf) continue;
        const ar = vb.clone().sub(va).cross(vc.clone().sub(va)).length() / 2; if (ar <= 0) continue;
        area += ar; tris.push({ a: va.clone().setX(va.x + m.position.x), b: vb.clone().setX(vb.x + m.position.x), c: vc.clone().setX(vc.x + m.position.x), acc: area });
      }
    });
    holder.updateMatrixWorld(true);
    return () => {
      const r = Math.random() * area; let lo = 0, hi = tris.length - 1;
      while (lo < hi) { const mid = (lo + hi) >> 1; if (tris[mid].acc < r) lo = mid + 1; else hi = mid; }
      const T = tris[lo]; let u = Math.random(), v = Math.random(); if (u + v > 1) { u = 1 - u; v = 1 - v; }
      return T.a.clone().addScaledVector(T.b.clone().sub(T.a), u).addScaledVector(T.c.clone().sub(T.a), v).applyMatrix4(holder.matrixWorld);
    };
  }
  const loader = new THREE.TextureLoader();
  const tex = f => new Promise(ok => loader.load(ASSETS + 'img/' + f, t => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; ok(t); }, undefined, () => ok(null)));
  /* poussière de lumière : des particules très fines, en profondeur (jamais un filtre posé sur l'image) */
  function dust(n, center, size, color = '#C9C1A8', opacity = .55) {
    const p = new Float32Array(n * 3), s = new Float32Array(n);
    for (let i = 0; i < n; i++) { p.set([center.x + (Math.random() - .5) * size[0], center.y + (Math.random() - .5) * size[1], center.z + (Math.random() - .5) * size[2]], i * 3); s[i] = Math.random(); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.setAttribute('aS', new THREE.BufferAttribute(s, 1));
    const U = { uTime: { value: 0 }, uPix: { value: renderer.getPixelRatio() }, uA: { value: opacity }, uC: { value: new THREE.Color(color) } };
    const pts = new THREE.Points(g, new THREE.ShaderMaterial({
      uniforms: U, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, toneMapped: false,
      vertexShader: `uniform float uTime,uPix;attribute float aS;varying float vA;void main(){vec3 q=position+vec3(sin(uTime*.07+aS*40.),cos(uTime*.05+aS*30.)*.6,sin(uTime*.06+aS*20.))*.6;
        vec4 mv=modelViewMatrix*vec4(q,1.);gl_Position=projectionMatrix*mv;float z=-mv.z;gl_PointSize=clamp(uPix*(1.2+aS*1.4)*(9./z),1.,uPix*7.);vA=(.35+.65*aS)*smoothstep(.4,2.5,z)*(.7+.3*sin(uTime*1.3+aS*60.));}`,
      fragmentShader: `uniform float uA;uniform vec3 uC;varying float vA;void main(){vec2 c=gl_PointCoord-.5;float r=length(c);if(r>.5)discard;gl_FragColor=vec4(uC*(1.-smoothstep(0.,.5,r))*vA*uA,1.);}`
    }));
    pts.frustumCulled = false; pts.userData.U = U; return pts;
  }
  /* un fil de lumière le long d'une courbe, qui se trace (prog 0 → 1) */
  function thread(curve, { color = '#FFD600', radius = .022, segs = 600, glow = 1.6 } = {}) {
    const geo = new THREE.TubeGeometry(curve, segs, radius, 8, false);
    const U = { uProg: { value: 0 }, uTime: { value: 0 }, uC: { value: new THREE.Color(color) }, uI: { value: glow }, uA: { value: 1 } };
    const m = new THREE.Mesh(geo, new THREE.ShaderMaterial({
      uniforms: U, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, fog: false,
      vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader: `uniform float uProg,uTime,uI,uA;uniform vec3 uC;varying vec2 vUv;void main(){float lit=1.-smoothstep(uProg-.002,uProg,vUv.x);
        float head=exp(-pow((vUv.x-uProg)*90.,2.))*step(.001,uProg)*step(uProg,.999);float pulse=.85+.15*sin(uTime*2.2-vUv.x*60.);
        gl_FragColor=vec4(uC*(lit*pulse*uI+head*uI*3.)*uA,1.);}`
    }));
    m.frustumCulled = false; m.userData.U = U; return m;
  }
  const textMat = (c = '#ffffff', e = 1) => new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(e), transparent: true, toneMapped: false, fog: false });

  /* ---------- logo en particules : couleurs et angles mesurés sur le vrai logo ---------- */
  const BR = [
    { c: '#F2E12B', a: 90, l: 95 }, { c: '#EE7623', a: 46.5, l: 106 }, { c: '#E3301E', a: 0, l: 60 }, { c: '#9B1B1F', a: -44.5, l: 88 },
    { c: '#6A4A90', a: -90, l: 80 }, { c: '#1C5FA8', a: -136, l: 122 }, { c: '#1E8496', a: 180, l: 88 }, { c: '#22A397', a: 133, l: 69 }
  ];
  const PX = 1 / 60, DOT = 17 * PX, HUB_R = 30 * PX, REACH = 139 * PX, NP = Q.np;
  const lp = new Float32Array(NP * 3), lt = new Float32Array(NP * 3), lc = new Float32Array(NP * 3), ls = new Float32Array(NP), lw = new Float32Array(NP * 3);
  {
    const lens = BR.map(b => b.l * PX), tot = lens.reduce((a, b) => a + b, 0), cols = BR.map(b => new THREE.Color(b.c)), hubC = new THREE.Color('#E6EDF2');
    for (let i = 0; i < NP; i++) {
      /* départ : un seul point de lumière au centre ; la nuée s'en déploie */
      lp[i * 3] = (Math.random() - .5) * .3; lp[i * 3 + 1] = (Math.random() - .5) * .3; lp[i * 3 + 2] = (Math.random() - .5) * .3;
      const r = Math.random(); let x, y, c;
      if (r < .95) {
        let k = 0, pick = Math.random() * tot; while (pick > lens[k] && k < 7) { pick -= lens[k]; k++; }
        const ang = BR[k].a * Math.PI / 180, Lk = lens[k], ux = Math.cos(ang), uy = Math.sin(ang); c = cols[k];
        if (r < .7) { const tt = HUB_R + Math.random() * (Lk - HUB_R - DOT * .6), j = (Math.random() - .5) * .05; x = ux * tt - uy * j; y = uy * tt + ux * j; }
        else { const rr = Math.sqrt(Math.random()) * DOT, th = Math.random() * 6.283; x = ux * Lk + Math.cos(th) * rr; y = uy * Lk + Math.sin(th) * rr; }
      } else { const th = Math.random() * 6.283, rr = HUB_R * (.92 + Math.random() * .12); x = Math.cos(th) * rr; y = Math.sin(th) * rr; c = hubC; }
      lt[i * 3] = x; lt[i * 3 + 1] = y; lt[i * 3 + 2] = (Math.random() - .5) * .06;
      lc[i * 3] = c.r; lc[i * 3 + 1] = c.g; lc[i * 3 + 2] = c.b; ls[i] = Math.random();
    }
  }
  const lg = new THREE.BufferGeometry();
  lg.setAttribute('position', new THREE.BufferAttribute(lp, 3)); lg.setAttribute('aTarget', new THREE.BufferAttribute(lt, 3));
  lg.setAttribute('aColor', new THREE.BufferAttribute(lc, 3)); lg.setAttribute('aSeed', new THREE.BufferAttribute(ls, 1));
  lg.setAttribute('aWin', new THREE.BufferAttribute(lw, 3));
  const LOGO_SHADER = {
    vertexShader: `attribute vec3 aTarget;attribute vec3 aColor;attribute float aSeed;attribute vec3 aWin;
      uniform float uTime,uReveal,uForm,uColor,uDisperse,uPixel,uScale,uFade,uWin;uniform vec3 uOrigin;
      varying vec3 vColor;varying float vAlpha;
      void main(){
        /* naissance : une nébuleuse lente autour d'un point, qui se resserre en logo */
        float sp=fract(aSeed*13.7);
        vec3 neb=vec3(cos(aSeed*40.+uTime*.15),sin(aSeed*23.+uTime*.12)*.6,sin(aSeed*31.))*(1.2+3.*sp)*smoothstep(0.,1.,uReveal);
        vec3 drift=uOrigin+position+neb;
        float d=clamp(uForm*1.35-aSeed*.35,0.,1.);d=d*d*(3.-2.*d);
        vec3 p=mix(drift,uOrigin+aTarget*uScale,d);
        p+=(normalize(aTarget+vec3(.001,.002,0.))*11.+vec3(0.,3.+6.*aSeed,8.*aSeed))*uDisperse*uDisperse;
        /* le logo se défait : chaque particule file vers une fenêtre de la vraie façade, en arc */
        float w=clamp(uWin*1.7-aSeed*.7,0.,1.);float ew=w*w*(3.-2.*w);
        vec3 mid=mix(p,aWin,.5)+vec3(0.,1.6+2.*aSeed,0.);
        p=mix(mix(p,mid,ew),mix(mid,aWin,ew),ew);
        vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;
        gl_PointSize=max(1.,mix(1.3,2.4,fract(aSeed*7.))*uPixel*(16./-mv.z)*mix(1.,.8,d));
        vColor=mix(vec3(1.,.86,.45)*1.5,aColor*2.2,uColor*d*(1.-ew));vColor=mix(vColor,vec3(1.,.72,.32)*2.,ew);
        float tw=.6+.4*sin(uTime*2.+aSeed*50.);
        vAlpha=smoothstep(aSeed*.9,aSeed*.9+.1,uReveal*1.1)*mix(tw,1.,d)*(1.-uDisperse*.85)*uFade*(1.-smoothstep(.85,1.,ew));
      }`,
    fragmentShader: `varying vec3 vColor;varying float vAlpha;
      void main(){vec2 c=gl_PointCoord-.5;float r=length(c);if(r>.5)discard;gl_FragColor=vec4(vColor*(1.-smoothstep(0.,.5,r))*vAlpha,1.);}`
  };

  /* ---------- le réel : la façade (photos recalées) et les salles (photos mises en volume) ---------- */
  const DOOR = new THREE.Vector3(2.05, 0, -1.95);
  /* la tour de lumière (savoirs, chemin) : dans le noir, loin derrière le pavillon ; le territoire s'élève depuis son sommet */
  const TOWER = new THREE.Vector3(2, 0, -70), TOWER_TOP = 30;
  const ctx = {
    THREE, scene, camera, renderer, mobile, ss, eIO, eOut, lerp, damp, clamp, tex, dust, thread, buildText, samplerOf, textMat,
    fontMid, fontHeavy, cue, lights: { key, rim }, logoGeo: lg, logoShader: LOGO_SHADER, logoBranches: BR, REACH, level, fx, bloom,
    pavilion: { door: DOOR }, TOWER, TOWER_TOP,
    /* repère attendu par le territoire : son vol part du sommet de la tour */
    library: { center: TOWER, TOP: TOWER_TOP },
    ambient: k => { moon.intensity *= k; hemi.intensity *= k; scene.environmentIntensity *= k; }
  };
  const [{ createSky }, { createRealFacade }, { createPhotoRooms }] = await Promise.all([import('./world/sky.js'), import('./world/realfacade.js'), import('./world/photorooms.js')]);
  const sky = createSky(ctx);
  sky.group.children.forEach((o, i) => { if (i) o.visible = false; });
  const real = await createRealFacade(ctx, { door: DOOR });
  ctx.real = real;
  ctx.photoRooms = await createPhotoRooms(ctx);

  /* cibles « fenêtres » : les vitrages mesurés sur la photo d'hiver, ramenés sur leur plan de façade */
  {
    const W = [[220, 628, 355, 768], [475, 626, 613, 766], [762, 645, 870, 752], [945, 637, 1043, 752], [1185, 597, 1347, 766], [1485, 597, 1560, 766]];
    const areas = W.map(r => (r[2] - r[0]) * (r[3] - r[1])), tot = areas.reduce((a, b) => a + b, 0);
    const pl = real.planes, at = real.debug.atZ;
    for (let i = 0; i < NP; i++) {
      let k = 0, r = Math.random() * tot; while (r > areas[k] && k < W.length - 1) { r -= areas[k]; k++; }
      const [x0, y0, x1, y1] = W[k], x = x0 + Math.random() * (x1 - x0), y = y0 + Math.random() * (y1 - y0);
      const zp = x < 700 ? pl.zL : x < 1110 ? pl.zE : pl.zR;
      const v = at(x, y, zp); lw.set([v.x, v.y, v.z + .05], i * 3);
    }
    lg.attributes.aWin.needsUpdate = true;
  }

  /* le fil : une ligne de lumière posée sur l'allée réelle, jusqu'à la porte (la couleur devient chemin) */
  const filU = { uProg: { value: 0 }, uTime: { value: 0 } };
  const filLen = real.path.z0 - DOOR.z;
  const filLine = new THREE.Mesh(new THREE.PlaneGeometry(.06, filLen), new THREE.ShaderMaterial({
    uniforms: filU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
    vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: `uniform float uProg,uTime;varying vec2 vUv;void main(){float lit=1.-smoothstep(uProg-.006,uProg+.006,vUv.y);float head=exp(-pow((vUv.y-uProg)*120.,2.))*step(.001,uProg)*step(uProg,.999);float side=1.-abs(vUv.x-.5)*2.;gl_FragColor=vec4(vec3(1.,.8,.2)*(lit*(.9+.1*sin(uTime*2.-vUv.y*50.))+head*1.6)*side,1.);}`
  }));
  filLine.rotation.x = -Math.PI / 2; filLine.position.set(DOOR.x, .02, DOOR.z + filLen / 2); scene.add(filLine);

  /* ---------- I · le seuil ---------- */
  const LU = { uTime: { value: 0 }, uReveal: { value: 0 }, uForm: { value: 0 }, uColor: { value: 0 }, uDisperse: { value: 0 }, uFade: { value: 1 }, uWin: { value: 0 }, uPixel: { value: renderer.getPixelRatio() * 1.15 }, uOrigin: { value: new THREE.Vector3() }, uScale: { value: 1 } };
  const logoPts = new THREE.Points(lg, new THREE.ShaderMaterial({ uniforms: LU, ...LOGO_SHADER, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, fog: false }));
  logoPts.frustumCulled = false; logoPts.renderOrder = 10; scene.add(logoPts);
  /* le logo naît dans le noir, au centre de l'image, devant le pavillon encore invisible */
  const LOGO_HOME = real.viewpoint.clone().addScaledVector(real.forward, 13).add(new THREE.Vector3(0, 1.4, 0));
  /* champ de l'appareil d'hiver (EXIF : 18 mm sur APS-C) : à ce point de vue, l'écran reste dans la photo */
  const fitFov = a => 2 * THREE.MathUtils.radToDeg(Math.atan(Math.min(Math.tan(THREE.MathUtils.degToRad(44.9 / 2)), .619 / a) * .93));
  const VIEW = real.viewpoint, AHEAD = VIEW.clone().addScaledVector(real.forward, 30);
  const VIEW2 = real.viewpoint2, AHEAD2 = VIEW2.clone().addScaledVector(real.forward2, 12);
  const THRESHOLD = new THREE.Vector3(DOOR.x, 1.62, DOOR.z + 2.2), INSIDE = new THREE.Vector3(DOOR.x, 1.5, DOOR.z - 8);
  /* plan-séquence : de la photo d'hiver 2019 (loin) à la photo d'automne 2023 (devant l'entrée), sans coupe :
     les deux photos sont recalées sur les mêmes volumes, la saison se fond pendant le vol */
  const APPROACH = new THREE.CatmullRomCurve3([VIEW.clone(), VIEW.clone().addScaledVector(real.forward, 5), VIEW2.clone().addScaledVector(real.forward2, -3.2), VIEW2.clone().addScaledVector(real.forward2, -1.2)], false, 'centripetal');
  const gust = p => ss(.3, .38, p) * (1 - ss(.46, .56, p));
  const heroScene = {
    cam(p, m) {
      const b = eIO(ss(.62, .95, p));
      const pos = APPROACH.getPoint(eIO(ss(.17, .6, p))).lerp(THRESHOLD, b);
      const look = AHEAD.clone().lerp(AHEAD2, eIO(ss(.22, .55, p))).lerp(INSIDE, eIO(ss(.72, 1, p)));
      /* respiration de la caméra : un très léger flottement, jamais un tremblement */
      const t = performance.now() / 1000, br = (1 - b) * .025;
      pos.x += m.sx * .25 * (1 - b) + Math.sin(t * .35) * br; pos.y += m.sy * .1 * (1 - b) + Math.sin(t * .5) * br * .6;
      return { pos, look };
    }
  };
  /* l'air : givre d'hiver qui devient feuilles d'automne en approchant */
  const AN = mobile ? 900 : 2200;
  const ap = new Float32Array(AN * 3), as = new Float32Array(AN);
  for (let i = 0; i < AN; i++) { ap.set([DOOR.x + (Math.random() - .5) * 22, Math.random() * 7, DOOR.z + 1 + Math.random() * (VIEW.z - DOOR.z)], i * 3); as[i] = Math.random(); }
  const ag = new THREE.BufferGeometry(); ag.setAttribute('position', new THREE.BufferAttribute(ap, 3)); ag.setAttribute('aS', new THREE.BufferAttribute(as, 1));
  const AU = { uTime: { value: 0 }, uSeason: { value: 0 }, uPix: { value: renderer.getPixelRatio() }, uAmt: { value: 1 }, uGust: { value: 0 } };
  const air = new THREE.Points(ag, new THREE.ShaderMaterial({
    uniforms: AU, transparent: true, depthWrite: false, fog: false,
    vertexShader: `uniform float uTime,uSeason,uPix,uAmt,uGust;attribute float aS;varying float vS;varying float vA;varying float vR;
      void main(){vec3 p=position;float sp=mix(.12,.9,uSeason)*(.6+aS);
        p.y=mod(p.y-uTime*sp*(1.+uGust*2.5),7.);p.x+=sin(uTime*(.3+aS)+aS*40.)*mix(.15,.8,uSeason)+uGust*(sin(uTime*1.7+aS*90.)*1.6+2.2*fract(aS*7.+uTime*.35));p.z+=cos(uTime*.4+aS*20.)*.2;
        vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;
        gl_PointSize=min(uPix*22.,uPix*mix(1.4+aS*1.4,6.+aS*6.,uSeason)*(1.+uGust*1.2)*(6./max(.5,-mv.z)));
        vS=aS;vR=uTime*(1.+aS*3.)+aS*30.;vA=uAmt*smoothstep(0.,.6,p.y)*smoothstep(.8,2.5,-mv.z)*(.55+.45*sin(uTime*3.+aS*60.)*(1.-uSeason));}`,
    fragmentShader: `uniform float uSeason;varying float vS;varying float vA;varying float vR;
      void main(){vec2 c=gl_PointCoord-.5;float cs=cos(vR),sn=sin(vR);c=mat2(cs,-sn,sn,cs)*c;
        float frost=1.-smoothstep(0.,.5,length(c));float leaf=1.-smoothstep(0.,.02,length(c*vec2(1.,2.4))-.32);
        float a=mix(frost,leaf,uSeason);if(a<.02)discard;
        vec3 fc=vec3(.9,.95,1.)*1.3;vec3 lc=mix(vec3(.85,.42,.12),vec3(.95,.72,.2),vS)*mix(1.,.7,step(.7,vS));
        gl_FragColor=vec4(mix(fc,lc,uSeason),a*vA);}`
  }));
  air.frustumCulled = false; scene.add(air);
  /* la lumière de la porte : nappe chaude sur la terrasse */
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 5), new THREE.ShaderMaterial({
    uniforms: { uI: { value: 0 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
    vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: `uniform float uI;varying vec2 vUv;void main(){float w=mix(.32,1.,1.-vUv.y);float a=(1.-smoothstep(max(0.,w*.5-.18),w*.5,abs(vUv.x-.5)))*pow(max(vUv.y,0.),1.4);gl_FragColor=vec4(vec3(1.,.74,.36)*a*uI*.8,1.);}`
  }));
  pool.rotation.x = -Math.PI / 2; pool.position.set(DOOR.x, .03, DOOR.z + 2.5); scene.add(pool);

  /* ---------- chapitres ---------- */
  const SC = { hero: heroScene };
  const chaptersEls = [...R.querySelectorAll('.v2-ch')];
  await Promise.all(chaptersEls.map(async el => {
    const id = el.dataset.ch; if (id === 'hero') return;
    const mod = await import(`./scenes/${id}.js`);
    SC[id] = await mod.create(ctx, el);
  }));
  const chapters = chaptersEls.map(el => ({ el, id: el.dataset.ch, stage: el.querySelector('.v2-stage'), p: 0, vis: false, card: +(el.dataset.card || 0) }));
  const C = Object.fromEntries(chapters.map(c => [c.id, c]));
  const split = el => { const s = document.createElement('span'); s.textContent = el.textContent; el.textContent = ''; el.appendChild(s); return s; };
  const h1 = split(R.querySelector('.v2-hero__l1')), h2 = split(R.querySelector('.v2-hero__l2'));
  const q = s => R.querySelector(s);
  const heroEls = { kicker: q('.v2-kicker'), sub: q('.v2-hero__sub'), hint: q('.v2-scroll') };

  R.classList.add('is-live');

  let lenis = null;
  if (!coarse) { try { const { default: Lenis } = await import(VEND + 'lenis@1.1.13/dist/lenis.mjs'); lenis = new Lenis({ lerp: .085, smoothWheel: true }); } catch (e) { /* natif */ } }
  const geom = () => { const y0 = scrollY; chapters.forEach(c => { const r = c.el.getBoundingClientRect(); c.top = r.top + y0; c.h = r.height; }); };
  geom(); new ResizeObserver(() => geom()).observe(R); document.fonts && document.fonts.ready.then(geom);
  const scrollToChapter = (c, p) => { const y = c.top - TOP + (c.h - (innerHeight - TOP)) * p; lenis ? lenis.scrollTo(y, { duration: 2.2 }) : scrollTo({ top: y, behavior: 'smooth' }); };
  ctx.scrollTo = (id, p) => C[id] && scrollToChapter(C[id], p);

  const mouse = { x: 0, y: 0, sx: 0, sy: 0 };
  addEventListener('pointermove', e => { mouse.x = e.clientX / innerWidth * 2 - 1; mouse.y = -(e.clientY / innerHeight * 2 - 1); }, { passive: true });
  const resize = () => {
    measure(); if (chapters[0].h !== undefined) geom();
    const w = innerWidth, h = Math.max(1, innerHeight - TOP);
    renderer.setSize(w, h, false); composer.setSize(w, h); bloom.setSize(w, h);
    camera.aspect = w / h; camera.updateProjectionMatrix();
  };
  resize(); addEventListener('resize', resize);

  const nav = R.querySelector('.v2-nav'), navLinks = [...nav.querySelectorAll('a')];
  const chapterById = Object.fromEntries(chapters.map(c => [c.el.id, c]));
  navLinks.forEach(a => a.addEventListener('click', e => { const c = chapterById[a.getAttribute('href').slice(1)]; if (!c) return; e.preventDefault(); scrollToChapter(c, 0); history.replaceState(null, '', a.getAttribute('href')); }));

  let current = null, introT0 = 0, sloganSaid = false, doorSaid = false, winSaid = false, navCur = '', ready = false;
  const probe = { n: 0, sum: 0, drops: 0 };
  const camPos = VIEW.clone(), look = AHEAD.clone(), tmpP = new THREE.Vector3(), tmpL = new THREE.Vector3();
  const prevCam = new THREE.Vector3(), tmpV = new THREE.Vector3(), tmpF = new THREE.Vector3(), tmpR = new THREE.Vector3();
  let bank = 0, speed = 0, lastCut = '', lastHard = false, fovNow = 46;
  const BL = .14;   /* part de chaque chapitre consacrée au raccord de caméra avec le précédent */
  window.__v2 = { get state() { return { current, level, cam: camera.position.toArray().map(v => +v.toFixed(1)), p: Object.fromEntries(chapters.map(c => [c.id, +c.p.toFixed(3)])) }; } };
  window.__v2.scenes = SC; window.__v2.real = real; window.__v2.camera = camera;
  let last = performance.now(), virt = 0;
  window.__v2.settle = (n = 60) => { for (let i = 0; i < n; i++) { virt += 16.7; tick(performance.now() + virt); } };
  function frame(now) { requestAnimationFrame(frame); tick(now + virt); }

  function tick(now) {
    const dt = Math.min(.05, (now - last) / 1000); last = now;
    const t = now / 1000;
    if (lenis) lenis.raf(now);
    const vh = innerHeight - TOP, sy = scrollY;
    let center = null, ci = 0;
    chapters.forEach((c, i) => {
      const top = c.top - sy, span = Math.max(1, c.h - vh), y = clamp(TOP - top, 0, span);
      c.stage.style.transform = `translate3d(0,${y.toFixed(1)}px,0)`;
      c.p = y / span; c.vis = top + c.h > TOP && top < innerHeight;
      if (top <= TOP + vh * .5 && top + c.h >= TOP + vh * .5) { center = c.id; ci = i; }
      /* carton-titre : au début de chaque chapitre, le titre seul au centre ; puis il se range */
      if (c.card) c.el.classList.toggle('is-card', c.p < c.card);
    });
    const anyVis = chapters.some(c => c.vis);
    canvas.classList.toggle('is-on', anyVis);
    if (!anyVis) return;
    if (!center) { const first = C.hero.top - sy > TOP; center = first ? 'hero' : chapters[chapters.length - 1].id; ci = first ? 0 : chapters.length - 1; }
    if (!introT0 && C.hero.vis) introT0 = now;
    if (center !== current) { if (current) cue('coupe'); current = center; }
    const pc = C[center].p;
    mouse.sx = damp(mouse.sx, mouse.x, 2, dt); mouse.sy = damp(mouse.sy, mouse.y, 2, dt);

    fx.uniforms.uTime.value = t; fx.uniforms.uBlack.value = 0; fx.uniforms.uAmber.value = 0;
    bloom.threshold = .85; bloom.strength = .55;
    ctx.photoRooms.group.visible = false;
    if (ctx.tower) ctx.tower.visible = false;

    /* ----- I · le seuil ----- */
    const p = C.hero.p;
    const intro = window.__v2.introAt != null ? window.__v2.introAt : introT0 ? (now - introT0) / 1000 : 0;
    const pastDoor = camera.position.z < DOOR.z + .3;
    const outside = ['hero', 'finale'].includes(center) || (center === 'lieu' && !pastDoor);
    /* les mondes : le ciel et la façade dehors ; le noir partout ailleurs, sauf la maquette du territoire */
    const skyOn = outside || center === 'terr';
    sky.group.visible = skyOn; scene.background = skyOn ? null : VOIDC;
    real.group.visible = outside;
    real.backdrop.visible = !(center === 'hero' && p > .66) && center !== 'lieu';
    if (SC.terr) SC.terr.group.visible = C.terr.vis || (center === 'finale' && pc < BL);
    const dusk = center === 'terr' ? .22 : center === 'finale' ? .8 : .1;
    sky.update(t, dusk);
    moon.intensity = .9; hemi.intensity = .4; scene.environmentIntensity = .4;
    real.update(camera.position);
    filU.uTime.value = t; filU.uProg.value = center === 'finale' ? 1 : center === 'hero' ? ss(.17, .62, p) : 1;
    filLine.visible = outside && camera.position.distanceTo(VIEW2) > 5;
    if (center === 'hero') {
      /* le noir, puis les fenêtres, puis la façade autour d'elles ; enfin le jour qui se lève sur l'approche */
      /* la nuit ne s'efface jamais tout à fait : l'approche finit à l'heure bleue, fenêtres allumées, pour que la porte
         s'ouvre sur un vrai contraste froid / chaud */
      const winK = ss(.05, .17, p), emerge = ss(.12, .3, p), night = 1 - .45 * ss(.32, .55, p);
      real.grade({
        expo: lerp(0, lerp(1, .62, night), emerge), sat: lerp(1, .72, night), night: .85 * night,
        tint: [lerp(1, .84, night), lerp(1, .92, night), lerp(1, 1.1, night)], lights: winK
      });
      if (winK > .4 && !winSaid) { winSaid = true; cue('logo'); } if (winK < .1) winSaid = false;
    } else if (center === 'lieu') {
      /* on franchit la porte : la façade s'éteint derrière nous, on entre dans le noir */
      const d = camera.position.z - DOOR.z;
      real.grade({ expo: ss(.4, 2, d), sat: 1, night: 0, tint: [1, 1, 1], lights: 0 });
    } else if (center === 'finale') {
      const blue = ss(.05, .5, pc);
      real.grade({ expo: lerp(1, .66, blue), sat: lerp(1, .85, blue), night: .5 * blue, tint: [lerp(1, .82, blue), lerp(1, .9, blue), lerp(1, 1.12, blue)], lights: ss(.2, .6, pc) });
    }
    const openK = center === 'hero' ? ss(.72, .9, p) : center === 'finale' ? ss(.35, .7, pc) : 1;
    real.open(openK);
    const near = 1 - ss(1.2, 6, camera.position.distanceTo(VIEW2));
    const seasonK = center === 'hero' ? ss(.34, .54, p) : near;
    real.season(outside ? seasonK : 1);
    AU.uTime.value = t; AU.uSeason.value = seasonK; AU.uGust.value = center === 'hero' ? gust(p) : 0;
    AU.uAmt.value = outside ? (center === 'hero' ? ss(.14, .26, p) : 1) : 0; air.visible = outside;
    pool.material.uniforms.uI.value = openK * (outside ? 1 : 0);
    if (openK > .3 && !doorSaid) { doorSaid = true; cue('coupe'); } if (openK < .1) doorSaid = false;
    /* le logo : naît d'un point dans le noir, se forme, puis se défait vers les fenêtres qu'il allume */
    LU.uTime.value = t; LU.uReveal.value = ss(.1, 1.8, intro);
    LU.uForm.value = ss(.9, 2.8, intro); LU.uColor.value = ss(2, 3, intro);
    LU.uOrigin.value.copy(LOGO_HOME); LU.uScale.value = .52;
    LU.uWin.value = ss(.03, .17, p); LU.uFade.value = center === 'hero' ? 1 : 0;
    logoPts.visible = center === 'hero' && p < .2;
    /* la nuée attend dans l'embrasure : c'est la lumière chaude derrière la porte */
    const pre = center === 'hero' ? ss(.62, .84, p) : 0;
    if (SC.lieu && SC.lieu.prelude) SC.lieu.prelude(pre, t);
    if (center === 'hero' || (center === 'lieu' && !pastDoor)) {
      key.position.set(DOOR.x, 2.4, DOOR.z - 4); key.color.set('#FFE2B8'); key.intensity = 4;
      rim.position.set(DOOR.x, 1.8, DOOR.z - 3.2); rim.color.set('#FFC873'); rim.intensity = 2 + 5 * openK;
    }
    /* textes de l'ouverture : carton-titre, puis le slogan quand la porte s'ouvre */
    const k1 = eOut(ss(.68, .8, p)), k2 = eOut(ss(.78, .9, p));
    h1.style.transform = `translate3d(0,${(1 - k1) * 110}%,0)`; h2.style.transform = `translate3d(0,${(1 - k2) * 110}%,0)`;
    if (k2 > .02 && !sloganSaid) { sloganSaid = true; cue('slogan'); } else if (p < .6) sloganSaid = false;
    const out = 1 - ss(.96, 1, p);
    h1.parentNode.parentNode.style.opacity = out;
    heroEls.sub.style.opacity = ss(.86, .94, p) * out;
    const kIn = eOut((intro - 2.6) / 1.6), kOut = ss(.015, .07, p);
    heroEls.kicker.style.opacity = kIn * (1 - kOut);
    heroEls.kicker.style.transform = `translate3d(0,${((1 - kIn) * 12 - kOut * 24).toFixed(1)}px,0)`;
    heroEls.kicker.style.letterSpacing = `${(.6 - .18 * kIn).toFixed(3)}em`;
    C.hero.stage.style.setProperty('--scrim', (ss(.64, .78, p) * out).toFixed(3));
    heroEls.hint.style.opacity = eOut((intro - 4.4) / 1) * (1 - ss(.01, .05, p));

    /* ----- chapitres ----- */
    for (const id in SC) { const c = C[id]; if (id !== 'hero' && c && (c.vis || id === center)) SC[id].update(c.p, t, dt, mouse, id === center); else if (SC[id].rest) SC[id].rest(); }
    if (SC.finale) SC.finale.group.visible = C.finale.vis || center === 'finale';
    /* plongée dans le faisceau doré du territoire vers l'heure bleue : un ambre profond, jamais une image blanche */
    const dive = center === 'terr' ? ss(.86, .99, pc) : center === 'finale' ? 1 - ss(.04, .17, pc) : 0;
    fx.uniforms.uAmber.value = Math.max(fx.uniforms.uAmber.value, dive * .92);

    /* ----- caméra ----- */
    const cur = SC[center], c = C[center];
    const tgt = cur.cam(c.p, mouse, t);
    let blending = false;
    if (ci > 0 && c.p < BL && !tgt.hard) {
      const prev = SC[chapters[ci - 1].id].cam(1, mouse, t);
      /* jamais de vol à travers le vide entre deux mondes séparés : ceux-là se rejoignent par une coupe */
      if (!prev.hard) {
        blending = true;
        const b = eIO(c.p / BL), dd = prev.pos.distanceTo(tgt.pos);
        tmpP.lerpVectors(prev.pos, tgt.pos, b); tmpP.y += dd > 25 ? Math.sin(b * Math.PI) * Math.min(6, dd * .15) : 0;
        tmpL.lerpVectors(prev.look, tgt.look, b);
      }
    }
    if (!blending) { tmpP.copy(tgt.pos); tmpL.copy(tgt.look); }
    const cutId = tgt.cut || center, snap = cutId !== lastCut && (!!tgt.hard || lastHard); lastCut = cutId; lastHard = !!tgt.hard;
    const kk = ready && !snap && fx.uniforms.uAmber.value < .85 ? 1 - Math.exp(-4 * dt) : 1; ready = true;
    camPos.lerp(tmpP, kk); look.lerp(tmpL, kk);
    camera.position.copy(camPos); camera.lookAt(look);
    /* inertie : la caméra s'incline légèrement dans les virages, l'image se dédouble à peine avec la vitesse */
    if (dt > 0 && kk < 1) {
      const vel = tmpV.copy(camPos).sub(prevCam).divideScalar(dt), fwd = tmpF.copy(look).sub(camPos).normalize(), right = tmpR.crossVectors(fwd, camera.up).normalize();
      bank = damp(bank, clamp(-vel.dot(right) * .008, -.1, .1), 2, dt);
      speed = damp(speed, vel.length(), 4, dt);
    } else { bank = 0; speed = 0; }
    prevCam.copy(camPos); camera.rotateZ(bank);
    fx.uniforms.uCA.value = .0006 + Math.min(.0012, speed * .00008);
    /* focale : celle de la photo au départ (aucun bord de photo visible), puis une focale de cinéma */
    const baseFov = camera.aspect < 1 ? 58 : 42;
    const tf = tgt.fov && !blending ? tgt.fov : center === 'hero' ? lerp(fitFov(camera.aspect), baseFov, eIO(ss(.2, .55, C.hero.p))) : baseFov;
    fovNow = snap ? tf : damp(fovNow, tf, 6, dt);
    if (Math.abs(camera.fov - fovNow) > .005) { camera.fov = fovNow; camera.updateProjectionMatrix(); }

    const navId = { hero: 'da-accueil', lieu: 'da-campus', campus: 'da-campus', asc: 'da-formations', walk: 'da-parcours', human: 'da-accompagnement', terr: 'da-contact', finale: 'da-contact' }[center];
    if (navId !== navCur) { navCur = navId; navLinks.forEach(a => a.getAttribute('href') === '#' + navId ? a.setAttribute('aria-current', 'true') : a.removeAttribute('aria-current')); }
    nav.classList.toggle('is-away', center === 'hero' && C.hero.p < .02 && !nav.contains(document.activeElement));

    if (document.visibilityState === 'visible') {
      probe.n++; probe.sum += dt;
      if (probe.n >= 120) {
        const fps = probe.n / probe.sum; probe.n = 0; probe.sum = 0;
        if (fps < 40 && probe.drops < 2 && QL.indexOf(level) > 0) { probe.drops++; level = QL[QL.indexOf(level) - 1]; renderer.setPixelRatio(Math.min(devicePixelRatio, QCFG[level].dpr)); composer.setPixelRatio(renderer.getPixelRatio()); resize(); }
      }
    }
    composer.render(dt);
  }
  /* démarrage continu : shaders compilés avant la première image visible ; la toile apparaît sur une affiche identique */
  try { renderer.compile(scene, camera); } catch (e) { /* */ }
  tick(performance.now());
  requestAnimationFrame(frame);
  setTimeout(unboot, 1600);
}
