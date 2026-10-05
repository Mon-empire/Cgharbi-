/*
  Digitale Académie · v3 « Monde onirique »
  Un seul ciel de rêve, un seul vol de caméra, sans coupe. Au centre : la Digitale Académie sur son île flottante.
    Ouverture  — le logo naît dans la nuit, éclate en lettres de verre ; l'île monte des nuages et vient à toi.
    Formations — archipel d'îlots en orbite, à la hauteur de leur niveau, reliés par le fil jaune.
    Parcours   — sept pierres flottantes jusqu'à la porte.
    Accompagnement — sept lanternes (les ateliers) et deux lucioles (les coachs).
    Campus     — le bâtiment s'ouvre comme une boîte : les vraies salles apparaissent.
    Territoire — deux rivières de lumière se rejoignent sous l'île.
    Final      — l'archipel entier, le logo en constellation.
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
  say('Chargement du monde…');
  start().then(() => say('')).catch(e => { console.warn('[Digitale Académie] scène indisponible :', e); R.classList.remove('is-live'); unboot(); say('Scène 3D indisponible : ' + (e && e.message || e)); });
}

async function start() {
  const T = VEND + 'three@0.169.0/', J = T + 'examples/jsm/';
  const [THREE, { EffectComposer }, { RenderPass }, { UnrealBloomPass }, { ShaderPass }, { OutputPass }, { RoomEnvironment }, { RoundedBoxGeometry }, OT] = await Promise.all([
    import(T + '+esm'),
    import(J + 'postprocessing/EffectComposer.js/+esm'), import(J + 'postprocessing/RenderPass.js/+esm'),
    import(J + 'postprocessing/UnrealBloomPass.js/+esm'), import(J + 'postprocessing/ShaderPass.js/+esm'),
    import(J + 'postprocessing/OutputPass.js/+esm'), import(J + 'environments/RoomEnvironment.js/+esm'),
    import(J + 'geometries/RoundedBoxGeometry.js/+esm'), import(VEND + 'opentype.js@1.3.4/dist/opentype.module.js')
  ]);
  const parseFont = OT.parse || OT.default.parse;
  const loadFont = w => fetch(ASSETS + `fonts/jost-${w}.woff`).then(r => { if (!r.ok) throw new Error('police ' + w + ' : ' + r.status); return r.arrayBuffer(); }).then(parseFont);
  const [fontHeavy, fontMid] = await Promise.all([loadFont(800), loadFont(600)]);
  const mobile = matchMedia('(max-width: 760px)').matches, coarse = matchMedia('(pointer: coarse)').matches;

  /* ---------- qualité ---------- */
  const QL = ['LOW', 'MEDIUM', 'HIGH', 'ULTRA'];
  const QCFG = { ULTRA: { dpr: 2, np: 40000, samples: 4 }, HIGH: { dpr: 1.6, np: 26000, samples: 4 }, MEDIUM: { dpr: 1.25, np: 14000, samples: 2 }, LOW: { dpr: 1, np: 6000, samples: 0 } };
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
  /* tone mapping neutre : la photo de la Ville garde ses vraies couleurs (AgX la délavait) */
  renderer.toneMapping = THREE.NeutralToneMapping; renderer.toneMappingExposure = 1;
  if ('transmissionResolutionScale' in renderer) renderer.transmissionResolutionScale = level === 'ULTRA' ? .75 : .5;
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2('#1B1538', .0042);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), .02).texture; scene.environmentIntensity = .55;
  /* éclairage constant (aucune recompilation) : lune, ciel, deux lumières mobiles */
  const moon = new THREE.DirectionalLight('#B9C6FF', 1.6); moon.position.set(-60, 80, 40); scene.add(moon);
  const hemi = new THREE.HemisphereLight('#7E86C8', '#2A1E3A', .6); scene.add(hemi);
  const key = new THREE.PointLight('#FFE9A8', 0, 80, 1.5), rim = new THREE.PointLight('#7FB8FF', 0, 80, 1.5); scene.add(key, rim);

  const camera = new THREE.PerspectiveCamera(38, 1, .1, 2000);
  const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: Q.samples });
  const composer = new EffectComposer(renderer, rt);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), .5, .5, .9); composer.addPass(bloom);
  const fx = new ShaderPass({
    uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uFade: { value: 1 }, uCA: { value: .0007 }, uDream: { value: .5 }, uWhite: { value: 0 }, uBlack: { value: 0 }, uWhiteC: { value: new THREE.Vector3(.9, .93, .97) } },
    vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    /* rendu de rêve : léger halo diffus, aberration sur les bords, vignette, grain fin */
    fragmentShader: `uniform sampler2D tDiffuse;uniform float uTime,uFade,uCA,uDream,uWhite,uBlack;uniform vec3 uWhiteC;varying vec2 vUv;
      float h(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
      void main(){vec2 d=vUv-.5;float r=dot(d,d);vec2 o=d*uCA*(1.+r*6.);
        vec3 c=vec3(texture2D(tDiffuse,vUv+o).r,texture2D(tDiffuse,vUv).g,texture2D(tDiffuse,vUv-o).b);
        vec3 soft=(texture2D(tDiffuse,vUv+vec2(.004,0.)).rgb+texture2D(tDiffuse,vUv-vec2(.004,0.)).rgb+texture2D(tDiffuse,vUv+vec2(0.,.005)).rgb+texture2D(tDiffuse,vUv-vec2(0.,.005)).rgb)*.25;
        c=mix(c,max(c,soft),uDream*.18);
        /* bourrasque de neige : l'image blanchit, avec un voile qui dérive */
        float fl=h(floor(vUv*vec2(160.,90.)+vec2(0.,uTime*30.)));c=mix(c,uWhiteC+fl*.05,uWhite*(.85+.15*smoothstep(.2,.9,uWhite)));
        c*=1.-r*1.1;c+=(h(vUv*vec2(1123.,987.)+fract(uTime*7.))-.5)*.018;c*=(1.-uFade)*(1.-uBlack);gl_FragColor=vec4(c,1.);}`
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
  const loader = new THREE.TextureLoader();
  const tex = f => new Promise(ok => loader.load(ASSETS + 'img/' + f, t => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; ok(t); }, undefined, () => ok(null)));
  function dust(n, box, color = '#C9C3F0') {
    const p = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { p[i * 3] = (Math.random() - .5) * box[0]; p[i * 3 + 1] = (Math.random() - .5) * box[1]; p[i * 3 + 2] = (Math.random() - .5) * box[2]; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    return new THREE.Points(g, new THREE.PointsMaterial({ size: .09, color, transparent: true, opacity: .7, depthWrite: false, sizeAttenuation: true, blending: THREE.AdditiveBlending }));
  }
  const textMat = (c = '#ffffff', e = .9) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: e, roughness: .4, transparent: true });

  /* ---------- logo en particules : géométrie et shader partagés ---------- */
  const BR = [
    { c: '#F2E12B', a: 90, l: 95 }, { c: '#EE7623', a: 46.5, l: 106 }, { c: '#E3301E', a: 0, l: 60 }, { c: '#9B1B1F', a: -44.5, l: 88 },
    { c: '#6A4A90', a: -90, l: 80 }, { c: '#1C5FA8', a: -136, l: 122 }, { c: '#1E8496', a: 180, l: 88 }, { c: '#22A397', a: 133, l: 69 }
  ];
  const PX = 1 / 60, DOT = 17 * PX, HUB_R = 30 * PX, REACH = 139 * PX, NP = Q.np;
  const lp = new Float32Array(NP * 3), lt = new Float32Array(NP * 3), lc = new Float32Array(NP * 3), ls = new Float32Array(NP);
  {
    const lens = BR.map(b => b.l * PX), tot = lens.reduce((a, b) => a + b, 0), cols = BR.map(b => new THREE.Color(b.c)), hubC = new THREE.Color('#E6EDF2');
    for (let i = 0; i < NP; i++) {
      lp[i * 3] = (Math.random() - .5) * 60; lp[i * 3 + 1] = (Math.random() - .5) * 34; lp[i * 3 + 2] = -10 - Math.random() * 50;
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
  const LOGO_SHADER = {
    vertexShader: `attribute vec3 aTarget;attribute vec3 aColor;attribute float aSeed;
      uniform float uTime,uReveal,uForm,uColor,uDisperse,uPixel,uScale,uFade;uniform vec3 uOrigin;
      varying vec3 vColor;varying float vAlpha;
      void main(){
        vec3 drift=position+vec3(sin(uTime*.13+aSeed*6.28)*.6,cos(uTime*.11+aSeed*12.)*.45,sin(uTime*.07+aSeed*3.)*.9);
        float d=clamp(uForm*1.35-aSeed*.35,0.,1.);d=d*d*(3.-2.*d);
        vec3 p=mix(drift,uOrigin+aTarget*uScale,d);
        p+=(normalize(aTarget+vec3(.001,.002,0.))*11.+vec3(0.,3.+6.*aSeed,8.*aSeed))*uDisperse*uDisperse;
        vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;
        gl_PointSize=max(1.,mix(1.3,2.6,fract(aSeed*7.))*uPixel*(16./-mv.z)*mix(1.,.8,d));
        vColor=mix(vec3(.55,.75,1.)*1.6,aColor*2.4,uColor*d);
        float tw=.6+.4*sin(uTime*2.+aSeed*50.);
        vAlpha=smoothstep(aSeed,aSeed+.12,uReveal*1.12)*mix(tw,1.,d)*(1.-uDisperse*.85)*uFade;
      }`,
    fragmentShader: `varying vec3 vColor;varying float vAlpha;
      void main(){vec2 c=gl_PointCoord-.5;float r=length(c);if(r>.5)discard;gl_FragColor=vec4(vColor*(1.-smoothstep(0.,.5,r))*vAlpha,1.);}`
  };


  /* ---------- le monde : le réel (pavillon, Surville) et le rêve (bibliothèque) ---------- */
  const ctx = {
    THREE, scene, camera, renderer, mobile, ss, eIO, eOut, lerp, damp, clamp, tex, dust, buildText, textMat,
    fontMid, fontHeavy, RoundedBoxGeometry, cue, lights: { key, rim }, logoGeo: lg, logoShader: LOGO_SHADER, logoBranches: BR, REACH, level, fx, bloom,
    /* lumière d'ambiance (lune, ciel, environnement) : un chapitre d'intérieur peut l'éteindre (0) ou la garder (1) */
    ambient: k => { moon.intensity *= k; hemi.intensity *= k; scene.environmentIntensity *= k; }
  };
  const [{ createSky }, { createPavilion }, { createSurville }, { createLibrary }, { createRealFacade }] = await Promise.all([
    import('./world/sky.js'), import('./world/pavilion.js'), import('./world/surville.js'), import('./world/library.js'), import('./world/realfacade.js')
  ]);
  const sky = createSky(ctx);
  const pavilion = await createPavilion(ctx);
  const surville = await createSurville(ctx);
  surville.group.visible = false;                       /* les abords modélisés cèdent la place à la vraie photo */
  /* la vraie façade : la photo de la Ville, projetée sur des volumes reconstruits dans sa perspective */
  const real = await createRealFacade(ctx, { door: pavilion.door });
  ctx.real = real;
  /* le fil : une ligne de lumière (narrative) posée sur l'allée réelle, jusqu'à la porte */
  const filU = { uProg: { value: 0 }, uTime: { value: 0 } };
  const filLen = real.path.z0 - pavilion.door.z;
  const filLine = new THREE.Mesh(new THREE.PlaneGeometry(.09, filLen), new THREE.ShaderMaterial({
    uniforms: filU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
    vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: `uniform float uProg,uTime;varying vec2 vUv;void main(){float lit=1.-smoothstep(uProg-.006,uProg+.006,vUv.y);float head=exp(-pow((vUv.y-uProg)*120.,2.))*step(.001,uProg)*step(uProg,.999);float side=1.-abs(vUv.x-.5)*2.;gl_FragColor=vec4(vec3(1.,.8,.2)*(lit*(.9+.1*sin(uTime*2.-vUv.y*50.))*1.1+head*1.4)*side,1.);}`
  }));
  filLine.rotation.x = -Math.PI / 2; filLine.position.set(pavilion.door.x, .02, pavilion.door.z + filLen / 2); scene.add(filLine);
  const formations = [...R.querySelectorAll('.v2-step')].map(li => ({ id: li.dataset.id, color: li.dataset.color, label: li.querySelector('.v2-step__btn').lastChild.textContent.trim() }));
  const library = createLibrary(ctx, formations);
  Object.assign(ctx, { pavilion, surville, library });
  /* la nuée de livres qui s'arrachent du papier peint et peuplent l'atrium */
  const { createFlock } = await import('./world/flock.js');
  const flock = createFlock(ctx);
  /* le papier peint montre la vraie bibliothèque qui attend derrière le mur */
  pavilion.muralMat.map = library.muralTexture; pavilion.muralMat.needsUpdate = true;
  /* les vraies salles, en volume (photos de la Ville projetées depuis leur prise de vue) */
  const { createPhotoRooms } = await import('./world/photorooms.js');
  const photoRooms = await createPhotoRooms(ctx);
  ctx.photoRooms = photoRooms;
  const renderMural = () => library.renderMural(renderer, scene, [pavilion.group, surville.group, real.group]);

  /* ---------- prologue : logo en particules qui se pose sur le vrai logo de la façade ---------- */
  const LU = { uTime: { value: 0 }, uReveal: { value: 0 }, uForm: { value: 0 }, uColor: { value: 0 }, uDisperse: { value: 0 }, uFade: { value: 1 }, uPixel: { value: renderer.getPixelRatio() }, uOrigin: { value: new THREE.Vector3() }, uScale: { value: 1 } };
  const logoPts = new THREE.Points(lg, new THREE.ShaderMaterial({ uniforms: LU, ...LOGO_SHADER, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, fog: false }));
  logoPts.frustumCulled = false; logoPts.renderOrder = 10; scene.add(logoPts);
  /* le logo de particules se pose sur le vrai logo, tel qu'il est sur la photo */
  const realLogo = real.logo.clone();
  const realScale = real.logoRadius / REACH;
  /* le logo naît au centre de l'image, dans la nuit, juste au-dessus du pavillon */
  const LOGO_HOME = real.viewpoint.clone().addScaledVector(real.forward, 14).add(new THREE.Vector3(0, 2.5, 0));
  LU.uPixel.value = renderer.getPixelRatio() * 1.15;
  /* champ de l'appareil d'hiver (EXIF : 18 mm sur APS-C) : à ce point de vue, l'écran reste dans la photo, jamais de bord visible */
  const fitFov = a => 2 * THREE.MathUtils.radToDeg(Math.atan(Math.min(Math.tan(THREE.MathUtils.degToRad(44.9 / 2)), .619 / a) * .93));

  /* deux photographes, deux saisons : on part de l'hiver 2019 (loin), on arrive à l'automne 2023 (devant la porte) */
  const VIEW = real.viewpoint, AHEAD = VIEW.clone().addScaledVector(real.forward, 30);
  const VIEW2 = real.viewpoint2, AHEAD2 = VIEW2.clone().addScaledVector(real.forward2, 12);
  const THRESHOLD = new THREE.Vector3(pavilion.door.x, 1.62, pavilion.door.z + 2.2), INSIDE = new THREE.Vector3(pavilion.door.x, 1.45, pavilion.door.z - 6);
  /* plan-séquence : de la photo d'hiver 2019 (loin) à la photo d'automne 2023 (devant l'entrée), sans coupe.
     Les deux photos sont recalées sur les mêmes volumes : la caméra vole de l'une à l'autre pendant que la saison
     change (bourrasque de neige → feuilles). Plus de voile blanc : c'était la cause du flash blanc au démarrage. */
  const APPROACH = new THREE.CatmullRomCurve3([VIEW.clone(), VIEW.clone().addScaledVector(real.forward, 5), VIEW2.clone().addScaledVector(real.forward2, -3.2), VIEW2.clone().addScaledVector(real.forward2, -1.2)], false, 'centripetal');
  const gust = p => ss(.2, .32, p) * (1 - ss(.42, .56, p));
  const heroScene = {
    cam(p, m) {
      /* hiver : on entre de quelques pas dans la photo de 2019 ; une bourrasque de neige blanchit l'image (p ≈ .33) ;
         quand elle se dissipe, c'est l'automne, devant l'entrée (photo prise de là) ; puis le seuil */
      const b = eIO(ss(.6, .94, p));
      let pos, look;
      pos = APPROACH.getPoint(eIO(ss(.04, .58, p))).lerp(THRESHOLD, b);
      look = AHEAD.clone().lerp(AHEAD2, eIO(ss(.12, .52, p))).lerp(INSIDE, eIO(ss(.7, 1, p)));
      pos.x += m.sx * .3 * (1 - b); pos.y += m.sy * .12 * (1 - b);
      return { pos, look };
    }
  };

  /* ---------- photo → espace : les arêtes des volumes recalés sur la photo s'allument en lumière jaune ----------
     Ce sont les vraies lignes de la façade (les volumes ont été reconstruits depuis la photo) : elles se tracent depuis la porte,
     prolongent l'architecture dans la profondeur que la photo ne montre pas, puis s'effacent quand on entre dans l'image. */
  const archU = { uProg: { value: 0 }, uAlpha: { value: 0 }, uTime: { value: 0 } };
  const arch = (() => {
    const pos = [], dist = [], O = real.logo.clone().setY(0), a = new THREE.Vector3();
    real.group.updateMatrixWorld(true);
    real.group.traverse(o => {
      if (!o.isMesh || o.geometry.type !== 'BoxGeometry' || o.parent !== real.group && o.parent !== real.entrance) return;
      const prm = o.geometry.parameters; if (prm.width < .3 && prm.depth < .3) return;
      const e = new THREE.EdgesGeometry(o.geometry), pa = e.attributes.position;
      for (let i = 0; i < pa.count; i++) { a.fromBufferAttribute(pa, i).applyMatrix4(o.matrixWorld); pos.push(a.x, a.y, a.z); dist.push(a.distanceTo(O)); }
    });
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('aD', new THREE.Float32BufferAttribute(dist, 1));
    const l = new THREE.LineSegments(g, new THREE.ShaderMaterial({
      uniforms: archU, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, toneMapped: false, fog: false,
      vertexShader: 'attribute float aD;varying float vD;void main(){vD=aD;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader: `uniform float uProg,uAlpha,uTime;varying float vD;void main(){float lit=1.-smoothstep(uProg-1.5,uProg,vD);float front=exp(-pow((vD-uProg)*.9,2.));
        gl_FragColor=vec4(vec3(1.,.78,.12)*(lit*.75+front*2.2)*uAlpha*(.9+.1*sin(uTime*3.-vD)),1.);}`
    }));
    l.frustumCulled = false; l.renderOrder = 5; scene.add(l); return l;
  })();

  /* ---------- l'air du lieu : givre d'hiver qui devient feuilles d'automne en approchant ---------- */
  const AN = mobile ? 900 : 2600;
  const ap = new Float32Array(AN * 3), as = new Float32Array(AN);
  for (let i = 0; i < AN; i++) { ap.set([pavilion.door.x + (Math.random() - .5) * 22, Math.random() * 7, pavilion.door.z + 1 + Math.random() * (VIEW.z - pavilion.door.z)], i * 3); as[i] = Math.random(); }
  const ag = new THREE.BufferGeometry(); ag.setAttribute('position', new THREE.BufferAttribute(ap, 3)); ag.setAttribute('aS', new THREE.BufferAttribute(as, 1));
  const AU = { uTime: { value: 0 }, uSeason: { value: 0 }, uPix: { value: renderer.getPixelRatio() }, uAmt: { value: 1 }, uGust: { value: 0 } };
  const air = new THREE.Points(ag, new THREE.ShaderMaterial({
    uniforms: AU, transparent: true, depthWrite: false, fog: false,
    vertexShader: `uniform float uTime,uSeason,uPix,uAmt,uGust;attribute float aS;varying float vS;varying float vA;varying float vR;
      void main(){vec3 p=position;float sp=mix(.12,.9,uSeason)*(.6+aS);
        p.y=mod(p.y-uTime*sp*(1.+uGust*2.5),7.);p.x+=sin(uTime*(.3+aS)+aS*40.)*mix(.15,.8,uSeason)+uGust*(sin(uTime*1.7+aS*90.)*1.6+2.2*fract(aS*7.+uTime*.35));p.z+=cos(uTime*.4+aS*20.)*.2;
        vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;
        gl_PointSize=min(uPix*28.,uPix*mix(1.6+aS*1.6,7.+aS*7.,uSeason)*(1.+uGust*1.4)*(6./max(.5,-mv.z)));
        vS=aS;vR=uTime*(1.+aS*3.)+aS*30.;vA=uAmt*smoothstep(0.,.6,p.y)*(.55+.45*sin(uTime*3.+aS*60.)*(1.-uSeason));}`,
    fragmentShader: `uniform float uSeason;varying float vS;varying float vA;varying float vR;
      void main(){vec2 c=gl_PointCoord-.5;float cs=cos(vR),sn=sin(vR);c=mat2(cs,-sn,sn,cs)*c;
        /* givre : point scintillant ; feuille : ellipse pointue aux couleurs d'automne */
        float frost=1.-smoothstep(0.,.5,length(c));float leaf=1.-smoothstep(0.,.02,length(c*vec2(1.,2.4))-.32);
        float a=mix(frost,leaf,uSeason);if(a<.02)discard;
        vec3 fc=vec3(.9,.95,1.)*1.4;vec3 lc=mix(vec3(.85,.42,.12),vec3(.95,.72,.2),vS)*mix(1.,.7,step(.7,vS));
        gl_FragColor=vec4(mix(fc,lc,uSeason),a*vA);}`
  }));
  air.frustumCulled = false; scene.add(air);

  /* ---------- la lumière de la porte : nappe chaude sur la terrasse et faisceau dans l'air ---------- */
  const glowMat = (shape) => new THREE.ShaderMaterial({
    uniforms: { uI: { value: 0 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false,
    vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: shape
  });
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 5), glowMat(`uniform float uI;varying vec2 vUv;void main(){float w=mix(.32,1.,1.-vUv.y);float a=(1.-smoothstep(max(0.,w*.5-.18),w*.5,abs(vUv.x-.5)))*pow(max(vUv.y,0.),1.4);gl_FragColor=vec4(vec3(1.,.78,.45)*a*uI*.9,1.);}`));
  pool.rotation.x = -Math.PI / 2; pool.position.set(pavilion.door.x, .03, pavilion.door.z + 2.5); scene.add(pool);
  const shaft = new THREE.Mesh(new THREE.PlaneGeometry(3, 3.2), glowMat(`uniform float uI;varying vec2 vUv;void main(){float a=(1.-smoothstep(.1,.5,abs(vUv.x-.5)))*smoothstep(0.,.5,vUv.y)*(1.-vUv.y*.6);gl_FragColor=vec4(vec3(1.,.82,.55)*a*uI*.35,1.);}`));
  shaft.position.set(pavilion.door.x, 1.4, pavilion.door.z + 1.4); shaft.rotation.x = -.5; scene.add(shaft);

  /* ---------- intertitres de cinéma entre les chapitres ---------- */
  const inter = document.createElement('div'); inter.className = 'v2-inter'; inter.setAttribute('aria-hidden', 'true');
  inter.innerHTML = '<span class="v2-inter__n"></span><span class="v2-inter__l"></span><span class="v2-inter__t"></span>';
  R.append(inter);
  const TITLES = { hero: ['I', 'Le seuil'], lieu: ['II', 'Le lieu'], campus: ['III', 'La visite'], asc: ['IV', 'Les savoirs'], walk: ['V', 'Le chemin'], human: ['VI', 'Les veilleurs'], terr: ['VII', 'Le territoire'], finale: ['VIII', 'L’heure bleue'] };
  const showInter = id => { const t = TITLES[id]; if (!t) return; inter.children[0].textContent = t[0]; inter.children[2].textContent = t[1]; inter.classList.remove('is-on'); void inter.offsetWidth; inter.classList.add('is-on'); };

  /* ---------- chapitres en modules ---------- */
  const SC = { hero: heroScene };
  const chaptersEls = [...R.querySelectorAll('.v2-ch')];
  await Promise.all(chaptersEls.map(async el => {
    const id = el.dataset.ch; if (id === 'hero') return;
    const mod = await import(`./scenes/${id}.js`);
    SC[id] = await mod.create(ctx, el);
  }));

  /* ---------- chapitres DOM ---------- */
  const chapters = chaptersEls.map(el => ({ el, id: el.dataset.ch, stage: el.querySelector('.v2-stage'), p: 0, vis: false }));
  const C = Object.fromEntries(chapters.map(c => [c.id, c]));
  const order = Object.fromEntries(chapters.map((c, i) => [c.id, i]));
  const split = el => { const s = document.createElement('span'); s.textContent = el.textContent; el.textContent = ''; el.appendChild(s); return s; };
  const h1 = split(R.querySelector('.v2-hero__l1')), h2 = split(R.querySelector('.v2-hero__l2'));
  const q = s => R.querySelector(s);
  const heroEls = { kicker: q('.v2-kicker'), sub: q('.v2-hero__sub'), hint: q('.v2-scroll') };

  R.classList.add('is-live');
  renderMural();

  let lenis = null;
  if (!coarse) { try { const { default: Lenis } = await import(VEND + 'lenis@1.1.13/dist/lenis.mjs'); lenis = new Lenis({ lerp: .1, smoothWheel: true }); } catch (e) { /* natif */ } }
  const geom = () => { const y0 = scrollY; chapters.forEach(c => { const r = c.el.getBoundingClientRect(); c.top = r.top + y0; c.h = r.height; }); };
  geom(); new ResizeObserver(() => geom()).observe(R); document.fonts && document.fonts.ready.then(geom);
  const scrollToChapter = (c, p) => { const y = c.top - TOP + (c.h - (innerHeight - TOP)) * p; lenis ? lenis.scrollTo(y, { duration: 2 }) : scrollTo({ top: y, behavior: 'smooth' }); };
  ctx.scrollTo = (id, p) => C[id] && scrollToChapter(C[id], p);

  const mouse = { x: 0, y: 0, sx: 0, sy: 0, u: .5, v: .5 };
  addEventListener('pointermove', e => { mouse.x = e.clientX / innerWidth * 2 - 1; mouse.y = -(e.clientY / innerHeight * 2 - 1); mouse.u = e.clientX / innerWidth; mouse.v = 1 - (e.clientY - TOP) / (innerHeight - TOP); }, { passive: true });
  const resize = () => {
    measure(); if (chapters[0].h !== undefined) geom();
    const w = innerWidth, h = Math.max(1, innerHeight - TOP);
    renderer.setSize(w, h, false); composer.setSize(w, h); bloom.setSize(w, h);
    camera.aspect = w / h; camera.fov = w / h < 1 ? 60 : 46; camera.updateProjectionMatrix();
  };
  resize(); addEventListener('resize', resize);

  const nav = R.querySelector('.v2-nav'), navLinks = [...nav.querySelectorAll('a')];
  const chapterById = Object.fromEntries(chapters.map(c => [c.el.id, c]));
  navLinks.forEach(a => a.addEventListener('click', e => { const c = chapterById[a.getAttribute('href').slice(1)]; if (!c) return; e.preventDefault(); scrollToChapter(c, 0); history.replaceState(null, '', a.getAttribute('href')); }));

  let current = null, introT0 = 0, fade = booting ? 0 : 1, logoLanded = false, sloganSaid = false, doorSaid = false, navCur = '', ready = false, muralTick = 0;
  const probe = { n: 0, sum: 0, drops: 0 };
  const camPos = new THREE.Vector3(.6, 1.75, 34), look = new THREE.Vector3(1.4, 2.2, -2), tmpP = new THREE.Vector3(), tmpL = new THREE.Vector3();
  const prevCam = new THREE.Vector3(), tmpV = new THREE.Vector3(), tmpF = new THREE.Vector3(), tmpR = new THREE.Vector3();
  let bank = 0, speed = 0, lastCut = '', lastHard = false;
  const BL = .18;   /* part de chaque chapitre consacrée au raccord de caméra avec le précédent */
  const DUSK = { hero: .45, lieu: .45, campus: .1, asc: .2, walk: .3, human: .4, terr: .65, finale: 1 };
  window.__v2 = { get state() { return { current, level, cam: camera.position.toArray().map(v => +v.toFixed(1)), p: Object.fromEntries(chapters.map(c => [c.id, +c.p.toFixed(3)])) }; } };
  window.__v2.scenes = SC; window.__v2.real = real; window.__v2.camera = camera; window.__v2.flock = flock;
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
    });
    const anyVis = chapters.some(c => c.vis);
    canvas.classList.toggle('is-on', anyVis);
    if (!anyVis) return;
    if (!center) { const first = C.hero.top - sy > TOP; center = first ? 'hero' : chapters[chapters.length - 1].id; ci = first ? 0 : chapters.length - 1; }
    if (!introT0 && C.hero.vis) introT0 = now;
    if (center !== current) { if (current) { cue('coupe'); showInter(center); } current = center; }
    const pc = C[center].p;
    mouse.sx = damp(mouse.sx, mouse.x, 2.5, dt); mouse.sy = damp(mouse.sy, mouse.y, 2.5, dt);

    /* heure : nuit de pluie → aube */
    const nextId = chapters[Math.min(chapters.length - 1, ci + 1)].id;
    const dusk = lerp(DUSK[center] ?? 0, DUSK[nextId] ?? 0, ss(.7, 1, pc));
    sky.update(t, dusk);
    /* lumière réelle de la nuit d'hiver → aube */
    moon.intensity = lerp(.35, 1.5, dusk); hemi.intensity = lerp(.18, .7, dusk); scene.environmentIntensity = lerp(.14, .55, dusk);
    fx.uniforms.uTime.value = t; fx.uniforms.uBlack.value = 0; bloom.threshold = .9; bloom.strength = .5;
    pavilion.power(1); photoRooms.group.visible = false;
    fade = damp(fade, 0, 2.2, dt); fx.uniforms.uFade.value = fade;

    /* le rêve n'existe que du fond de la salle d'étude jusqu'à la sortie par la verrière */
    const libOn = ['asc', 'walk', 'human'].includes(center) || (center === 'campus' && pc > .78) || (center === 'terr' && pc < .3);
    library.group.visible = libOn;
    /* papier peint : intact avant la visite, effacé une fois qu'on est passé de l'autre côté (même en sautant par le menu) */
    if (center !== 'campus') pavilion.dissolveMural(order[center] > order.campus ? 1 : 0);
    library.update(t);

    /* ----- prologue ----- */
    {
      const p = C.hero.p;
      const intro = window.__v2.introAt != null ? window.__v2.introAt : introT0 ? (now - introT0) / 1000 : 0;
      /* dehors / dedans : la caméra a-t-elle passé le seuil ? (et non une part du chapitre : on ne voit jamais la photo de dos) */
      const pastDoor = camera.position.z < pavilion.door.z - .15;
      const outside = ['hero', 'finale'].includes(center) || (center === 'lieu' && !pastDoor);
      /* photo → espace : les lignes de l'architecture se tracent à l'aube, puis s'effacent quand la caméra entre dans l'image */
      archU.uTime.value = t; archU.uProg.value = ss(.05, .26, p) * 40; archU.uAlpha.value = center === 'hero' ? ss(.04, .08, p) * (1 - ss(.24, .36, p)) * .9 : 0;
      arch.visible = archU.uAlpha.value > .002;
      /* le fil de lumière court sur l'allée jusqu'à la porte */
      filU.uTime.value = t; filU.uProg.value = center === 'finale' ? 1 : center === 'hero' ? ss(.04, .62, p) : 1;
      filLine.visible = outside && camera.position.distanceTo(VIEW2) > 5;
      /* voiles : bourrasque de neige (blanc froid) à l'ouverture ; plongée dans le faisceau doré entre la maquette et le final */
      const dive = center === 'terr' ? ss(.86, .99, pc) : center === 'finale' ? 1 - ss(.04, .17, pc) : 0;
      fx.uniforms.uWhite.value = center === 'hero' ? 0 : dive * .92;
      /* plongée dans le faisceau : un ambre profond (jamais une image blanche), la coupe se fait au cœur du voile */
      fx.uniforms.uWhiteC.value.set(.5, .33, .1);
      /* réel / intérieur : la photo dehors, le modèle dedans */
      const inside = (center === 'lieu' && pastDoor) || ['campus', 'asc', 'walk', 'human'].includes(center);
      /* chaque monde n'existe que là où on le voit : la façade réelle dehors, le pavillon modélisé dans la visite, la maquette au territoire */
      const inPav = center === 'lieu' || center === 'campus' || (center === 'asc' && pc < BL);
      real.group.visible = !inside && center !== 'terr';
      pavilion.exterior.visible = inPav; pavilion.interior.visible = inPav || (center === 'hero' && p > .7);
      if (SC.terr) SC.terr.group.visible = C.terr.vis || (center === 'finale' && pc < BL);
      real.update(camera.position);
      /* heure : matin d'hiver de la photo, puis lumière dorée de l'aube au final */
      /* ouverture : nuit de neige, le pavillon allumé ; le jour se lève quand on avance. Final : l'heure bleue, tout se rallume */
      const nightK = center === 'hero' ? 1 - ss(.04, .3, p) : center === 'finale' ? ss(.05, .5, pc) : 0;
      const blue = center === 'finale';
      real.grade({
        expo: lerp(1, blue ? .66 : .6, nightK), sat: lerp(1, blue ? .85 : .7, nightK), night: (blue ? .5 : .9) * nightK,
        tint: [lerp(1, .82, nightK), lerp(1, .9, nightK), lerp(1, 1.12, nightK)], lights: blue ? ss(.2, .6, pc) : nightK
      });
      /* la porte s'ouvre sur la lumière chaude de l'intérieur ; au final elle se rouvre pour toi */
      const openK = center === 'hero' ? ss(.72, .9, p) : center === 'finale' ? ss(.35, .7, pc) : 1;
      real.open(openK);
      /* la saison suit la marche : hiver loin de la porte, automne devant elle */
      const near = 1 - ss(1.2, 6, camera.position.distanceTo(VIEW2));
      const seasonK = center === 'hero' ? ss(.27, .5, p) : near;
      AU.uGust.value = center === 'hero' ? gust(p) : 0;
      real.season(outside ? seasonK : 1);
      AU.uTime.value = t; AU.uSeason.value = seasonK; AU.uAmt.value = outside ? 1 : 0; air.visible = outside;
      pool.material.uniforms.uI.value = openK * (outside ? 1 : 0);
      /* le faisceau se voit de loin ; de près, la caméra le traverserait (voile laiteux sur toute l'image) : il s'efface */
      shaft.material.uniforms.uI.value = openK * (outside ? 1 : 0) * ss(1.6, 4, camera.position.distanceTo(shaft.position));
      if (openK > .3 && !doorSaid) { doorSaid = true; cue('coupe'); } if (openK < .1) doorSaid = false;
      /* logo : naît dans le ciel de pluie, se pose sur le logo réel au-dessus de la porte */
      LU.uTime.value = t; LU.uReveal.value = ss(.2, 1.6, intro);
      LU.uForm.value = ss(.6, 2.6, intro); LU.uColor.value = ss(1.8, 2.8, intro);
      const land = eIO(ss(.06, .24, p));
      LU.uOrigin.value.copy(LOGO_HOME).lerp(realLogo, land);
      LU.uScale.value = lerp(.46, realScale, land);
      LU.uFade.value = (1 - ss(.27, .32, p)) * (center === 'hero' ? 1 : 0);   /* posé, il s'efface : le vrai logo réapparaît */
      logoPts.visible = center === 'hero';
      if (land > .98 && !logoLanded) { logoLanded = true; cue('logo'); } if (land < .5) logoLanded = false;
      /* derrière la porte : le pavillon est dans la pénombre ; la lumière chaude, c'est la nuée qui attend dans l'embrasure */
      const pre = center === 'hero' ? ss(.62, .84, p) : 0;
      if (center === 'hero') pavilion.power(1 - .85 * pre);
      if (SC.lieu && SC.lieu.prelude) SC.lieu.prelude(pre, t);
      if (center === 'hero' || (center === 'lieu' && !pastDoor)) {
        /* lampadaire (clé chaude) et lueur de l'intérieur derrière la porte (contre-jour) */
        key.position.set(pavilion.door.x, 2.4, pavilion.door.z - 4); key.color.set('#FFE2B8'); key.intensity = 6;
        rim.position.set(2.05, 1.8, -3.2); rim.color.set('#FFC873'); rim.intensity = 3 + 7 * openK;
      }
      const k1 = eOut(ss(.68, .8, p)), k2 = eOut(ss(.8, .92, p));
      h1.style.transform = `translate3d(0,${(1 - k1) * 110}%,0)`; h2.style.transform = `translate3d(0,${(1 - k2) * 110}%,0)`;
      if (k2 > .02 && !sloganSaid) { sloganSaid = true; cue('slogan'); } else if (p < .6) sloganSaid = false;
      const out = 1 - ss(.97, 1, p);
      h1.parentNode.parentNode.style.opacity = out;
      heroEls.sub.style.opacity = ss(.88, .95, p) * out;
      const kIn = eOut((intro - 2.3) / 1.4), kOut = ss(.02, .12, p);
      heroEls.kicker.style.opacity = kIn * (1 - kOut);
      C.hero.stage.style.setProperty('--scrim', (kIn * (1 - kOut) + ss(.66, .8, p) * out).toFixed(3));
      heroEls.kicker.style.transform = `translate3d(0,${((1 - kIn) * 14 - kOut * 30).toFixed(1)}px,0)`;
      heroEls.kicker.style.letterSpacing = `${(.62 - .2 * kIn).toFixed(3)}em`;
      heroEls.hint.style.opacity = eOut((intro - 3.6) / 1) * (1 - ss(.02, .1, p));
    }

    /* ----- chapitres ----- */
    for (const id in SC) { const c = C[id]; if (id !== 'hero' && c && (c.vis || id === center)) SC[id].update(c.p, t, dt, mouse, id === center); else if (SC[id].rest) SC[id].rest(); }
    if (SC.finale) SC.finale.group.visible = C.finale.vis || center === 'finale';
    /* livres : arrachés du mur à la fin de la visite, en vol dans l'atrium, calmes près des lanternes, puis aspirés par la verrière */
    flock.update(t, center === 'campus' ? { on: pc > .87, burst: ss(.89, .995, pc) }
      : ['asc', 'walk', 'human'].includes(center) ? { on: true, calm: center === 'human' ? 1 : 0 }
      : center === 'terr' ? { on: pc < .3, lift: eIO(pc / .3) * 70 } : { on: false });   /* le logo du final ne survit pas quand on remonte */
    /* le papier peint suit la vie de la bibliothèque (rendu réduit, quelques images par seconde) */
    if (center === 'campus' && ++muralTick % 6 === 0) renderMural();

    /* ----- vol de caméra continu ----- */
    const cur = SC[center], c = C[center];
    const tgt = cur.cam(c.p, mouse, t);
    /* le final ne se raccorde pas en vol : on y arrive à travers la lumière du faisceau (voile doré) */
    if (ci > 0 && c.p < BL && center !== 'finale') {
      const prev = SC[chapters[ci - 1].id].cam(1, mouse, t), b = eIO(c.p / BL);
      const dd = prev.pos.distanceTo(tgt.pos);
      /* arc de vol seulement pour les grands déplacements (jamais à travers un plafond) */
      tmpP.lerpVectors(prev.pos, tgt.pos, b); tmpP.y += dd > 25 ? Math.sin(b * Math.PI) * Math.min(6, dd * .15) : 0;
      tmpL.lerpVectors(prev.look, tgt.look, b);
    } else { tmpP.copy(tgt.pos); tmpL.copy(tgt.look); }
    /* au cœur de la bourrasque (image blanche), la caméra saute d'une photo à l'autre sans traverser l'entre-deux */
    /* une coupe franche (changement de monde demandé par le chapitre) ne se traverse pas : la caméra saute */
    /* un monde « coupé » (tgt.hard : les vraies salles, posées hors du pavillon) se rejoint toujours par une coupe */
    const cutId = tgt.cut || '', snap = cutId !== lastCut && (!!tgt.hard || lastHard || !!(cutId && lastCut)); lastCut = cutId; lastHard = !!tgt.hard;
    const kk = ready && !snap && fx.uniforms.uWhite.value < .88 && fx.uniforms.uBlack.value < .9 ? 1 - Math.exp(-4.5 * dt) : 1; ready = true;
    camPos.lerp(tmpP, kk); look.lerp(tmpL, kk);
    camera.position.copy(camPos); camera.lookAt(look);
    /* sensation de vol : la caméra s'incline dans les virages ; l'image se dédouble un peu avec la vitesse */
    if (dt > 0 && kk < 1) {
      const vel = tmpV.copy(camPos).sub(prevCam).divideScalar(dt), fwd = tmpF.copy(look).sub(camPos).normalize(), right = tmpR.crossVectors(fwd, camera.up).normalize();
      bank = damp(bank, clamp(-vel.dot(right) * .012, -.16, .16), 2.5, dt);
      speed = damp(speed, vel.length(), 4, dt);
    }
    prevCam.copy(camPos); camera.rotateZ(bank);
    fx.uniforms.uCA.value = .0007 + Math.min(.0016, speed * .0001);
    /* focale : celle de la photo d'hiver au départ (aucun bord visible), puis l'œil normal */
    const baseFov = camera.aspect < 1 ? 60 : 46;
    const tf = tgt.fov && !(ci > 0 && c.p < BL) ? tgt.fov : center === 'hero' ? lerp(fitFov(camera.aspect), baseFov, eIO(ss(.08, .5, C.hero.p))) : baseFov;
    if (Math.abs(camera.fov - tf) > .01) { camera.fov = tf; camera.updateProjectionMatrix(); }

    const navId = { hero: 'da-accueil', lieu: 'da-campus', campus: 'da-campus', asc: 'da-formations', walk: 'da-parcours', human: 'da-accompagnement', terr: 'da-contact', finale: 'da-contact' }[center];
    if (navId !== navCur) { navCur = navId; navLinks.forEach(a => a.getAttribute('href') === '#' + navId ? a.setAttribute('aria-current', 'true') : a.removeAttribute('aria-current')); }
    nav.classList.toggle('is-away', center === 'hero' && C.hero.p < .03 && !nav.contains(document.activeElement));

    if (document.visibilityState === 'visible') {
      probe.n++; probe.sum += dt;
      if (probe.n >= 120) {
        const fps = probe.n / probe.sum; probe.n = 0; probe.sum = 0;
        if (fps < 40 && probe.drops < 2 && QL.indexOf(level) > 0) { probe.drops++; level = QL[QL.indexOf(level) - 1]; renderer.setPixelRatio(Math.min(devicePixelRatio, QCFG[level].dpr)); composer.setPixelRatio(renderer.getPixelRatio()); resize(); }
      }
    }
    composer.render(dt);
  }
  /* démarrage continu : shaders compilés et textures envoyées avant la première image visible ;
     la toile apparaît par-dessus l'affiche (image identique), puis l'affiche s'en va une fois couverte */
  try { renderer.compile(scene, camera); } catch (e) { /* */ }
  tick(performance.now());
  requestAnimationFrame(frame);
  setTimeout(unboot, 1600);
}
