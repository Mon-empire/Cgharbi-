/*
  TERRITOIRE · Montereau-Fault-Yonne, la nuit, en maquette de lumière — d'après les vraies données
  On sort par la verrière de la bibliothèque. En contrebas, la ville réelle se dessine depuis le confluent :
  relief réel (EU-DEM Copernicus 25 m, exagéré ×2,5), la Seine et l'Yonne à leur vrai tracé, 12 600 bâtiments
  OpenStreetMap qui se dressent et s'allument, les rues en traits de lumière parcourues de phares, les tours de
  Surville sur le plateau, et le faisceau doré sur le pavillon de la Digitale Académie (1 rue Honoré de Balzac).
  Le fil d'or s'élance du confluent jusqu'au pavillon ; à la fin on plonge dans le faisceau (relais du final).
  Données © contributeurs OpenStreetMap (ODbL) ; relief EU-DEM via OpenTopoData.
*/
export async function create(ctx, el) {
  const { THREE, ss, eOut } = ctx;
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const O = V(0, -24, -190);                                 /* position de la maquette dans le monde */
  const G = new THREE.Group(); G.position.copy(O); G.visible = false; ctx.scene.add(G);
  const LOW = ctx.level === 'LOW' || ctx.mobile;
  const ASSETS = (document.getElementById('da-experience').dataset.daAssets || 'assets/');

  /* repère : mètres (x est, z sud, origine 48,39° N / 2,955° E) → unités de la maquette (1 u = 25 m), centrée entre confluent et pavillon */
  const KX = Math.cos(48.39 * Math.PI / 180) * 111320, KZ = 110540, CX = 160, CZ = -330, U = 1 / 25, VEX = 2.5;
  const mx = x => (x - CX) * U, mz = z => (z - CZ) * U;
  const geo = (lat, lon) => ({ x: mx((lon - 2.955) * KX), z: mz(-(lat - 48.39) * KZ) });
  const W2 = 165, H2 = 126;                                   /* demi-étendue utile (u) */
  const PAVm = geo(48.3969801, 2.9569157), CONF = { x: mx(189), z: mz(155) };

  /* texte : le titre et le fait « Campus connecté » au-dessus de la ville, les coordonnées à l'arrivée sur le faisceau */
  const head = el.querySelector('.v2-terr__head'), list = el.querySelector('.v2-terr__list'), credit = el.querySelector('.v2-terr__schema');
  const reveal = (n, k, dy = 24) => { if (!n) return; n.style.opacity = k.toFixed(3); n.style.transform = `translate3d(0,${((1 - k) * dy).toFixed(1)}px,0)`; n.style.pointerEvents = k > .5 ? '' : 'none'; };

  /* ---------- uniformes partagés ---------- */
  const SU = { uTime: { value: 0 }, uShow: { value: 0 }, uStreet: { value: 1.8 }, uConf: { value: new THREE.Vector2(CONF.x, CONF.z) } };
  /* rayon d'apparition : distance au confluent, normalisée */
  const REV = 'float revR(vec2 p){return length((p-uConf)/vec2(190.,150.));}';

  /* ---------- pavillon : faisceau, anneau, cœur, fil d'or (visibles même avant l'arrivée des données) ---------- */
  let ground = (x, z) => 0;
  const beamMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uI: { value: 0 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
    vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: `uniform float uTime,uI;varying vec2 vUv;void main(){float a=(1.-vUv.y)*(1.-vUv.y)*(.7+.3*sin(vUv.y*50.-uTime*4.));gl_FragColor=vec4(vec3(1.,.82,.45)*a*uI,1.);}`
  });
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(.5, 1.6, 90, 24, 1, true), beamMat); G.add(beam);
  const ring = new THREE.Mesh(new THREE.RingGeometry(1, 1.18, 64), new THREE.MeshBasicMaterial({ color: new THREE.Color('#FFD27A').multiplyScalar(3), transparent: true, opacity: 0, toneMapped: false, depthWrite: false, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2; G.add(ring);
  const core = new THREE.Mesh(new THREE.SphereGeometry(.45, 20, 20), new THREE.MeshBasicMaterial({ color: new THREE.Color('#FFE2A0').multiplyScalar(5), toneMapped: false })); G.add(core);
  let filGeo = null, PAV = V(PAVm.x, 0, PAVm.z);
  const W = p => p.clone().add(O);
  const tv1 = V(0, 0, 0), tv2 = V(0, 0, 0), tv3 = V(0, 0, 0), tv4 = V(0, 0, 0);

  /* ---------- noms posés sur la carte et grand titre flottant ---------- */
  const tags = [];
  const tag = (txt, x, z, rot, size, color = '#BFD8FF') => { const t = ctx.buildText(ctx.fontMid, txt, size, .02, 0, ctx.textMat(color, .55)); t.rotation.set(-Math.PI / 2, 0, rot); t.position.set(x, 0, z); t.children.forEach(c => { c.material = c.material.clone(); c.material.opacity = 0; }); G.add(t); tags.push(t); return t; };
  const title = ctx.buildText(ctx.fontHeavy, 'Montereau-Fault-Yonne', 5, .5, 0, new THREE.MeshStandardMaterial({ color: '#FFFFFF', emissive: '#CFE2FF', emissiveIntensity: 1.1, transparent: true, opacity: 0, roughness: .3 }));
  G.add(title);

  /* ---------- chargement des vraies données (en arrière-plan, dès l'ouverture de la page) ---------- */
  let built = false, bldMat = null, waterMat = null, terrainMat = null, carMat = null, flowMat = null;
  const load = Promise.all([fetch(ASSETS + 'data/montereau.json').then(r => r.json()), fetch(ASSETS + 'data/montereau-relief.json').then(r => r.json())]);
  load.then(([D, E]) => build(D, E)).catch(e => console.warn('[Digitale Académie] maquette : données indisponibles', e));

  async function build(D, E) {
    const yieldF = () => new Promise(r => setTimeout(r, 0));
    /* relief : interpolation bilinéaire de la grille d'altitudes */
    const elevAt = (x, z) => {
      const lon = 2.955 + (x / U + CX) / KX, lat = 48.39 - (z / U + CZ) / KZ;
      const fi = Math.min(E.nx - 1.001, Math.max(0, (lon - E.W) / (E.E - E.W) * (E.nx - 1))), fj = Math.min(E.ny - 1.001, Math.max(0, (lat - E.S) / (E.N - E.S) * (E.ny - 1)));
      const i = Math.floor(fi), j = Math.floor(fj), u = fi - i, v = fj - j, z0 = E.z[j * E.nx + i], z1 = E.z[j * E.nx + i + 1], z2 = E.z[(j + 1) * E.nx + i], z3 = E.z[(j + 1) * E.nx + i + 1];
      return (z0 * (1 - u) + z1 * u) * (1 - v) + (z2 * (1 - u) + z3 * u) * v;
    };
    const Y = e => (e - 45) * U * VEX;

    /* masques peints sur canvas : l'eau (pour creuser le lit) et la carte des lumières (rues, voie ferrée) */
    const CW = 2048, CH = Math.round(2048 * H2 / W2);
    const px = x => (mx(x) + W2) / (2 * W2) * CW, pz = z => (mz(z) + H2) / (2 * H2) * CH;
    const mkCanvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
    const wc = mkCanvas(512, Math.round(512 * H2 / W2)), wg = wc.getContext('2d');
    wg.fillStyle = '#000'; wg.fillRect(0, 0, wc.width, wc.height); wg.fillStyle = '#fff';
    const sx = wc.width / CW, sz = wc.height / CH;
    /* chaque surface d'eau : [1 = rivière | 0 = étang, x, z, x, z…] */
    for (const poly of D.water) { wg.beginPath(); for (let i = 1; i < poly.length; i += 2) { const X = px(poly[i]) * sx, Z = pz(poly[i + 1]) * sz; i > 1 ? wg.lineTo(X, Z) : wg.moveTo(X, Z); } wg.closePath(); wg.fill(); }
    wg.filter = 'blur(2px)'; wg.drawImage(wc, 0, 0); wg.filter = 'none';
    const wdata = wg.getImageData(0, 0, wc.width, wc.height).data;
    const waterAt = (X, Z) => { const i = Math.round((X + W2) / (2 * W2) * (wc.width - 1)), j = Math.round((Z + H2) / (2 * H2) * (wc.height - 1)); if (i < 0 || j < 0 || i >= wc.width || j >= wc.height) return 0; return wdata[(j * wc.width + i) * 4] / 255; };
    /* niveau de l'eau : le point le plus bas du relief le long des rivières */
    let wl = 1e9; for (const r of D.rivers) for (let i = 0; i < r.p.length; i += 2) wl = Math.min(wl, elevAt(mx(r.p[i]), mz(r.p[i + 1])));
    const WY = Y(wl) + .15;
    ground = (X, Z) => { const h = Y(elevAt(X, Z)), w = waterAt(X, Z); return h + (WY - .5 - h) * Math.min(1, w * 1.6); };

    const lc = mkCanvas(CW, CH), lg2 = lc.getContext('2d');
    lg2.fillStyle = '#000'; lg2.fillRect(0, 0, CW, CH); lg2.globalCompositeOperation = 'lighter'; lg2.lineCap = lg2.lineJoin = 'round';
    const stroke = (pts, w, col, blur) => { lg2.strokeStyle = col; lg2.lineWidth = w; lg2.shadowColor = col; lg2.shadowBlur = blur; lg2.beginPath(); for (let i = 0; i < pts.length; i += 2) { const X = px(pts[i]), Z = pz(pts[i + 1]); i ? lg2.lineTo(X, Z) : lg2.moveTo(X, Z); } lg2.stroke(); };
    for (const r of D.rail) stroke(r, 1.6, 'rgba(120,170,255,.7)', 5);
    for (const pass of [2, 1, 0]) for (const r of D.roads) if (r[0] === pass) stroke(r.slice(1), [4.2, 2.8, 1.8][pass], ['rgba(255,178,90,1)', 'rgba(255,196,120,.85)', 'rgba(255,206,140,.6)'][pass], [14, 8, 4][pass]);
    lg2.shadowBlur = 0;
    const lightTex = new THREE.CanvasTexture(lc); lightTex.colorSpace = THREE.SRGBColorSpace; lightTex.anisotropy = 8;
    await yieldF();

    /* ---------- terrain ---------- */
    const NXs = LOW ? 200 : 300, NZs = Math.round(NXs * H2 / W2);
    const tg = new THREE.PlaneGeometry(W2 * 2, H2 * 2, NXs, NZs); tg.rotateX(-Math.PI / 2);
    const tp = tg.attributes.position;
    for (let i = 0; i < tp.count; i++) tp.setY(i, ground(tp.getX(i), tp.getZ(i)));
    tg.computeVertexNormals();
    terrainMat = new THREE.ShaderMaterial({
      uniforms: { ...SU, uLight: { value: lightTex }, uWH: { value: new THREE.Vector2(W2, H2) } }, transparent: true, fog: false, extensions: { derivatives: true },
      vertexShader: `varying vec3 vP;varying vec3 vN;void main(){vP=position;vN=normal;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader: `uniform float uTime,uShow,uStreet;uniform vec2 uConf,uWH;uniform sampler2D uLight;varying vec3 vP;varying vec3 vN;${REV}
        void main(){
          float r=revR(vP.xz),front=uShow*1.35;
          float shown=1.-smoothstep(front-.05,front,r);
          float ring=exp(-pow((r-front+.025)*26.,2.))*step(.01,uShow)*(1.-step(1.3,uShow));
          float lit=clamp(dot(normalize(vN),normalize(vec3(-.5,.75,.35))),0.,1.);
          vec3 col=mix(vec3(.018,.025,.06),vec3(.06,.07,.14),smoothstep(-1.,8.,vP.y))*(.45+.75*lit);
          float c=vP.y/.5;float w=max(fwidth(c),1e-4);float line=1.-smoothstep(0.,w*1.5,abs(fract(c+.5)-.5));
          col+=vec3(.25,.42,.85)*line*.09;
          vec2 uv=vec2((vP.x+uWH.x)/(2.*uWH.x),(vP.z+uWH.y)/(2.*uWH.y));
          vec3 L=texture2D(uLight,uv).rgb;col+=L*uStreet*shown;
          col+=vec3(.6,.85,1.)*ring*1.4;
          vec2 e=abs(vP.xz)/uWH;float edge=(1.-smoothstep(.6,1.,e.x))*(1.-smoothstep(.55,1.,e.y));
          float a=edge*shown;if(a<.02)discard;
          gl_FragColor=vec4(col,a);}`
    });
    const terrain = new THREE.Mesh(tg, terrainMat); terrain.renderOrder = 2; G.add(terrain);   /* après les nuages : le bord en fondu ne les masque plus */
    await yieldF();

    /* ---------- l'eau : surfaces réelles, courant et reflets des lumières ---------- */
    const wpos = [], wriv = [];
    for (const poly of D.water) {
      const contour = []; for (let i = 1; i < poly.length; i += 2) contour.push(new THREE.Vector2(mx(poly[i]), mz(poly[i + 1])));
      if (contour.length < 3) continue;
      const tris = THREE.ShapeUtils.triangulateShape(contour, []);
      for (const t of tris) for (const k of t) { wpos.push(contour[k].x, WY, contour[k].y); wriv.push(poly[0]); }
    }
    const wgeo = new THREE.BufferGeometry(); wgeo.setAttribute('position', new THREE.Float32BufferAttribute(wpos, 3)); wgeo.setAttribute('aRiv', new THREE.Float32BufferAttribute(wriv, 1));
    /* rivières : bleu profond qui coule, reflets mouvants des quais ; étangs : miroirs sombres, quasi immobiles */
    waterMat = new THREE.ShaderMaterial({
      uniforms: { ...SU }, transparent: true, depthWrite: false, fog: false, side: THREE.DoubleSide,
      vertexShader: 'attribute float aRiv;varying vec3 vP;varying float vR;void main(){vP=position;vR=aRiv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader: `uniform float uTime,uShow;uniform vec2 uConf;varying vec3 vP;varying float vR;${REV}
        float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
        float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}
        void main(){
          float r=revR(vP.xz);float on=1.-smoothstep(uShow*1.35-.12,uShow*1.35,r);
          float sp=mix(.06,1.,vR);
          float rip=n(vP.xz*1.4+vec2(uTime*.3,uTime*.1)*sp)*.6+n(vP.xz*3.6+vec2(-uTime*.45,uTime*.25)*sp)*.4;
          float spark=step(mix(.985,.95,vR),n(vP.xz*10.+uTime*.7*sp));
          vec3 lake=vec3(.012,.025,.06)+vec3(.05,.09,.2)*rip*.5;
          vec3 river=vec3(.02,.07,.2)+vec3(.12,.3,.75)*rip*.45;
          vec3 col=mix(lake,river,vR)+vec3(1.,.78,.5)*spark*mix(.35,.8,vR);
          gl_FragColor=vec4(col,mix(.85,.95,vR)*on);}`
    });
    const water = new THREE.Mesh(wgeo, waterMat); water.renderOrder = 3; G.add(water);

    /* ---------- courants : particules le long du vrai tracé (Seine bleue, Yonne cyan), vers le confluent puis l'aval ---------- */
    const chain = name => {
      const segs = D.rivers.filter(r => r.n === name).map(r => r.p.slice());
      const key = (a, b) => a + ',' + b, ends = new Set(segs.map(s => key(s[s.length - 2], s[s.length - 1])));
      let cur = segs.find(s => !ends.has(key(s[0], s[1]))) || segs[0]; const out = cur.slice(); segs.splice(segs.indexOf(cur), 1);
      for (let guard = 0; guard < 50 && segs.length; guard++) {
        const ex = out[out.length - 2], ez = out[out.length - 1], nx = segs.find(s => s[0] === ex && s[1] === ez); if (!nx) break;
        out.push(...nx.slice(2)); segs.splice(segs.indexOf(nx), 1);
      }
      const pts = []; for (let i = 0; i < out.length; i += 2) pts.push(V(mx(out[i]), WY + .25, mz(out[i + 1])));
      return new THREE.CatmullRomCurve3(pts, false, 'centripetal');
    };
    const curves = [chain('La Seine'), chain("L'Yonne")];
    const S = 512, data = new Float32Array(S * 2 * 4);
    curves.forEach((c, ri) => c.getSpacedPoints(S - 1).forEach((p, k) => data.set([p.x, p.y, p.z, 1], (ri * S + k) * 4)));
    const pathTex = new THREE.DataTexture(data, S, 2, THREE.RGBAFormat, THREE.FloatType); pathTex.needsUpdate = true;
    const NF = LOW ? 3500 : 9000, fo = new Float32Array(NF), fl = new Float32Array(NF), fsp = new Float32Array(NF), fr = new Float32Array(NF);
    for (let i = 0; i < NF; i++) { fo[i] = Math.random(); fl[i] = (Math.random() - .5) * 2; fsp[i] = .006 + Math.random() * .008; fr[i] = Math.random() < .62 ? 0 : 1; }
    const fg = new THREE.BufferGeometry(); fg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NF * 3), 3));
    fg.setAttribute('aOff', new THREE.BufferAttribute(fo, 1)); fg.setAttribute('aLat', new THREE.BufferAttribute(fl, 1)); fg.setAttribute('aSpd', new THREE.BufferAttribute(fsp, 1)); fg.setAttribute('aRiv', new THREE.BufferAttribute(fr, 1));
    flowMat = new THREE.ShaderMaterial({
      uniforms: { ...SU, uPath: { value: pathTex }, uPix: { value: ctx.renderer.getPixelRatio() } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
      vertexShader: `uniform sampler2D uPath;uniform float uTime,uShow,uPix;uniform vec2 uConf;attribute float aOff,aLat,aSpd,aRiv;varying vec3 vC;varying float vA;${REV}
        void main(){float f=fract(aOff+uTime*aSpd),row=(aRiv+.5)/2.;
          vec3 a=texture2D(uPath,vec2((f*511.+.5)/512.,row)).xyz,b=texture2D(uPath,vec2((min(f*511.+1.,511.)+.5)/512.,row)).xyz;
          vec3 tg=normalize(b-a+1e-5),side=normalize(vec3(-tg.z,0.,tg.x));
          vec3 p=a+side*aLat*(aRiv<.5?2.:1.4);
          vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;
          float r=revR(p.xz);vA=1.-smoothstep(uShow*1.35-.1,uShow*1.35,r);
          gl_PointSize=uPix*2.2*(60./-mv.z);vC=aRiv<.5?vec3(.25,.55,1.):vec3(.15,.9,1.);}`,
      fragmentShader: `varying vec3 vC;varying float vA;void main(){float r=length(gl_PointCoord-.5);if(r>.5)discard;gl_FragColor=vec4(vC*(1.-smoothstep(0.,.5,r))*vA*1.5,1.);}`
    });
    const flows = new THREE.Points(fg, flowMat); flows.frustumCulled = false; G.add(flows);
    await yieldF();

    /* ---------- la ville : 12 600 bâtiments extrudés qui se dressent et s'allument ---------- */
    const pos = [], nor = [], uvh = [], cen = [], rnd = [];
    const minArea = LOW ? 45 : 0;
    let n = 0;
    for (const b of D.bld) {
      const hM = b[0], cnt = (b.length - 1) / 2; if (cnt < 3) continue;
      const pts = []; let cx = 0, cz = 0, area = 0;
      for (let i = 0; i < cnt; i++) { const X = mx(b[1 + i * 2]), Z = mz(b[2 + i * 2]); pts.push(new THREE.Vector2(X, Z)); cx += X; cz += Z; }
      cx /= cnt; cz /= cnt;
      for (let i = 0, j = cnt - 1; i < cnt; j = i++) area += (pts[j].x + pts[i].x) * (pts[j].y - pts[i].y);
      const aM = Math.abs(area / 2) / (U * U); if (aM < minArea) continue;
      if (Math.abs(cx) > W2 * .98 || Math.abs(cz) > H2 * .98) continue;
      const base = ground(cx, cz) - .05, top = base + .3 + hM * U * VEX, id = Math.random();
      let along = 0;
      for (let i = 0; i < cnt; i++) {
        const a = pts[i], c = pts[(i + 1) % cnt], len = a.distanceTo(c) / U, nx = (c.y - a.y), nz = -(c.x - a.x), nl = Math.hypot(nx, nz) || 1;
        const s = area > 0 ? -1 : 1;   /* normales vers l'extérieur quel que soit le sens du tracé */
        const quad = [[a, base, along, 0], [c, base, along + len, 0], [c, top, along + len, hM], [a, base, along, 0], [c, top, along + len, hM], [a, top, along, hM]];
        for (const [p, y, u, v] of quad) { pos.push(p.x, y, p.y); nor.push(s * nx / nl, 0, s * nz / nl); uvh.push(u, v); cen.push(cx, cz, base); rnd.push(id); }
        along += len;
      }
      const tris = THREE.ShapeUtils.triangulateShape(pts, []);
      for (const t of tris) for (const k of t) { pos.push(pts[k].x, top, pts[k].y); nor.push(0, 1, 0); uvh.push(0, -1); cen.push(cx, cz, base); rnd.push(id); }
      if (++n % 1500 === 0) await yieldF();
    }
    const bg = new THREE.BufferGeometry();
    bg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); bg.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    bg.setAttribute('aUV', new THREE.Float32BufferAttribute(uvh, 2)); bg.setAttribute('aCen', new THREE.Float32BufferAttribute(cen, 3)); bg.setAttribute('aId', new THREE.Float32BufferAttribute(rnd, 1));
    bldMat = new THREE.ShaderMaterial({
      uniforms: { ...SU, uPav: { value: new THREE.Vector2(PAVm.x, PAVm.z) } }, fog: false, side: THREE.DoubleSide, extensions: { derivatives: true },
      vertexShader: `uniform float uTime,uShow;uniform vec2 uConf;attribute vec2 aUV;attribute vec3 aCen;attribute float aId;varying vec2 vUV;varying vec3 vN;varying float vId;varying float vGrow;varying vec3 vW;${REV}
        void main(){float r=revR(aCen.xy);float g=smoothstep(r,r+.12,uShow*1.35-.04);
          vec3 p=position;p.y=aCen.z+(p.y-aCen.z)*max(g,.001);
          vUV=aUV;vN=normal;vId=aId;vGrow=g;vW=p;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`,
      fragmentShader: `uniform float uTime;uniform vec2 uPav;varying vec2 vUV;varying vec3 vN;varying float vId;varying float vGrow;varying vec3 vW;
        float h(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
        void main(){
          if(vGrow<.01)discard;
          float lit=clamp(dot(normalize(vN),normalize(vec3(-.5,.6,.4))),0.,1.);
          vec3 col=vec3(.035,.045,.085)*(.6+.8*lit);
          if(vUV.y>=0.){
            /* fenêtres : un étage tous les 3 m, une baie tous les 3,4 m ; allumées au hasard, chaudes ou froides */
            vec2 g=vec2(vUV.x/3.4,vUV.y/3.);vec2 cell=floor(g),f=fract(g);
            float win=step(.22,f.x)*step(f.x,.78)*step(.3,f.y)*step(f.y,.82)*step(1.,vUV.y);
            float rnd=h(vec3(cell,vId*91.));float on=step(.48,rnd);
            vec3 wc=mix(vec3(1.,.66,.32),vec3(.75,.85,1.),step(.86,rnd));
            float flick=.85+.15*sin(uTime*(1.+rnd*3.)+rnd*50.);
            /* au loin, le motif se fond en lueur moyenne (pas de scintillement) */
            float fw=clamp(max(fwidth(g.x),fwidth(g.y))*1.4,0.,1.);
            vec3 detail=wc*win*on*flick*1.3,avg=wc*.1;
            col+=mix(detail,avg,fw);
          } else col+=vec3(.05,.07,.13)*.6;
          gl_FragColor=vec4(col,1.);}`
    });
    G.add(new THREE.Mesh(bg, bldMat));
    await yieldF();

    /* ---------- phares : circulation sur les grands axes (blanc dans un sens, rouge dans l'autre) ---------- */
    const majors = D.roads.filter(r => r[0] <= 1 && r.length > 9).map(r => { const pts = []; for (let i = 1; i < r.length; i += 2) pts.push(V(mx(r[i]), 0, mz(r[i + 1]))); return pts; })
      .filter(pts => { let L = 0; for (let i = 1; i < pts.length; i++) L += pts[i].distanceTo(pts[i - 1]); return L > 6; }).slice(0, 256);
    const RS = 64, rows = majors.length, rdata = new Float32Array(RS * rows * 4);
    majors.forEach((pts, ri) => { pts.forEach(p => { p.y = ground(p.x, p.z) + .18; }); const c = new THREE.CatmullRomCurve3(pts, false, 'centripetal'); c.getSpacedPoints(RS - 1).forEach((p, k) => rdata.set([p.x, p.y, p.z, 1], (ri * RS + k) * 4)); });
    const roadTex = new THREE.DataTexture(rdata, RS, rows, THREE.RGBAFormat, THREE.FloatType); roadTex.needsUpdate = true;
    const NC = LOW ? 900 : 2400, co = new Float32Array(NC), crow = new Float32Array(NC), cdir = new Float32Array(NC), cspd = new Float32Array(NC);
    for (let i = 0; i < NC; i++) { co[i] = Math.random(); crow[i] = Math.floor(Math.random() * rows); cdir[i] = Math.random() < .5 ? 1 : -1; cspd[i] = .02 + Math.random() * .05; }
    const cg = new THREE.BufferGeometry(); cg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NC * 3), 3));
    cg.setAttribute('aOff', new THREE.BufferAttribute(co, 1)); cg.setAttribute('aRow', new THREE.BufferAttribute(crow, 1)); cg.setAttribute('aDir', new THREE.BufferAttribute(cdir, 1)); cg.setAttribute('aSpd', new THREE.BufferAttribute(cspd, 1));
    carMat = new THREE.ShaderMaterial({
      uniforms: { ...SU, uRoad: { value: roadTex }, uRows: { value: rows }, uPix: { value: ctx.renderer.getPixelRatio() } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
      vertexShader: `uniform sampler2D uRoad;uniform float uTime,uShow,uRows,uPix;uniform vec2 uConf;attribute float aOff,aRow,aDir,aSpd;varying vec3 vC;varying float vA;${REV}
        void main(){float f=fract(aOff+uTime*aSpd*aDir);float row=(aRow+.5)/uRows;
          vec3 a=texture2D(uRoad,vec2((f*63.+.5)/64.,row)).xyz,b=texture2D(uRoad,vec2((min(f*63.+1.,63.)+.5)/64.,row)).xyz;
          vec3 side=normalize(vec3(-(b-a).z,0.,(b-a).x)+1e-5);vec3 p=a+side*.12*aDir;
          vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;
          vA=smoothstep(.1,.5,uShow)*(1.-smoothstep(uShow*1.35-.1,uShow*1.35,revR(p.xz)));
          gl_PointSize=uPix*1.8*(50./-mv.z);vC=aDir>0.?vec3(1.,.95,.85):vec3(1.,.25,.15);}`,
      fragmentShader: `varying vec3 vC;varying float vA;void main(){float r=length(gl_PointCoord-.5);if(r>.5)discard;gl_FragColor=vec4(vC*(1.-smoothstep(0.,.5,r))*vA*1.6,1.);}`
    });
    const cars = new THREE.Points(cg, carMat); cars.frustumCulled = false; G.add(cars);

    /* ---------- pavillon et fil d'or, posés sur le vrai relief ---------- */
    PAV.y = ground(PAV.x, PAV.z);
    beam.position.copy(PAV).add(V(0, 45, 0)); ring.position.copy(PAV).add(V(0, .35, 0)); core.position.copy(PAV).add(V(0, .9, 0));
    const C0 = V(CONF.x, WY + .3, CONF.z);
    const filCurve = new THREE.CatmullRomCurve3([C0, C0.clone().lerp(PAV, .3).add(V(-3, 7, 0)), C0.clone().lerp(PAV, .7).add(V(-2, 10, 0)), PAV.clone().add(V(0, .9, 0))]);
    filGeo = new THREE.TubeGeometry(filCurve, 200, .16, 8, false);
    G.add(new THREE.Mesh(filGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color('#FFD600').multiplyScalar(3), toneMapped: false })));
    /* noms */
    const t1 = tag('La Seine', mx(-1900), mz(780), .62, 5), t2 = tag("L'Yonne", mx(1250), mz(1420), -.95, 4.2), t3 = tag('Surville', mx(-150), mz(-1150), 0, 4), t4 = tag('Digitale Académie', PAV.x + 3, PAV.z - 3, 0, 1.6, '#FFE2A0');
    [t1, t2, t3, t4].forEach(t => { t.position.y = ground(t.position.x, t.position.z) + 1.2; });
    t1.position.y = t2.position.y = WY + .6;
    title.position.set(CONF.x - 20, 34, CONF.z + 10);
    built = true;
  }

  /* ---------- trajectoire : sortie par la verrière, survol, descente sur la Seine, montée vers Surville, faisceau ---------- */
  const lib = ctx.library, top = lib.center.clone().add(V(0, lib.TOP + 3, 0));
  const P = (x, y, z) => W(V(mx(x), y, mz(z)));
  const camPath = new THREE.CatmullRomCurve3([top.clone(), top.clone().add(V(0, 30, -25)), P(-2600, 150, 4200), P(-3600, 70, 1900), P(-1700, 26, 900), P(-500, 18, 700), P(-450, 22, -300), W(V(PAVm.x - 22, 18, PAVm.z + 20))], false, 'centripetal');
  const lookPath = new THREE.CatmullRomCurve3([top.clone().add(V(0, 40, -40)), P(0, 30, 2000), P(200, 0, 0), P(0, 0, 300), P(189, 0, 155), P(189, 0, 0), P(150, 2, -600), W(V(PAVm.x, 4, PAVm.z))], false, 'centripetal');

  /* ---------- l'ouverture survole aussi cette maquette (on est l'oiseau qui descend du ciel) ---------- */
  const flight = {
    P, W, conf: W(V(CONF.x, 0, CONF.z)),
    /* le pavillon dans le monde (son altitude n'est connue qu'une fois le relief chargé) */
    get pav() { return W(PAV); }, get ready() { return built; },
    /* on : la ville entière, allumée, et le faisceau sur le pavillon (le cap de l'oiseau) ; aucun texte */
    aerial(on, t, beamK = 1) {
      G.visible = on; if (!on) return;
      SU.uTime.value = t; SU.uShow.value = 1; SU.uStreet.value = .4;   /* vue d'avion de nuit : l'éclairage public en lueur discrète */
      /* vu d'en haut, le faisceau n'est qu'une colonne de lumière courte et douce au-dessus du pavillon */
      beam.scale.y = .3; beam.position.y = PAV.y + 45 * .3;
      beamMat.uniforms.uTime.value = t; beamMat.uniforms.uI.value = beamK * .55;
      ring.material.opacity = beamK * (.6 + .4 * Math.sin(t * 3)); ring.scale.setScalar(1 + (t * .6 % 1) * 2.5);
      core.scale.setScalar(Math.max(.001, beamK * (1 + .15 * Math.sin(t * 4))));
      if (filGeo) filGeo.setDrawRange(0, 0);
      tags.forEach(g => g.children.forEach(c => { c.material.opacity = 0; }));
      title.visible = false;
    }
  };
  ctx.flight = flight;
  return {
    group: G,
    cam(p, m) {
      const k = ss(0, 1, p);
      return { pos: camPath.getPointAt(k).add(V(m.sx * 2, m.sy * 1.2, 0)), look: lookPath.getPointAt(k) };
    },
    update(p, t, dt, m, isCurrent) {
      const show = ss(.1, .48, p);
      SU.uTime.value = t; SU.uShow.value = show; SU.uStreet.value = 1.8; beam.scale.y = 1; beam.position.y = PAV.y + 45;
      beamMat.uniforms.uTime.value = t; beamMat.uniforms.uI.value = ss(.55, .75, p) * (1.2 + .3 * Math.sin(t * 2));
      ring.material.opacity = ss(.6, .75, p) * (.6 + .4 * Math.sin(t * 3)); ring.scale.setScalar(1 + (t * .6 % 1) * 2.5);
      core.scale.setScalar(Math.max(.001, ss(.55, .7, p) * (1 + .15 * Math.sin(t * 4))));
      if (filGeo) filGeo.setDrawRange(0, Math.floor(ss(.62, .86, p) * filGeo.index.count / 6) * 6);
      tags.forEach((g, i) => g.children.forEach(c => { c.material.opacity = ss(.3 + i * .05, .45 + i * .05, p) * .9; }));
      /* grand titre : il apparaît au-dessus de la ville pendant le survol, tourné vers nous */
      const tk = ss(.2, .32, p) * (1 - ss(.5, .6, p));
      title.children.forEach(c => { c.material.opacity = tk; }); title.visible = tk > .01;
      /* le titre flotte dans la moitié droite du champ, loin devant, au-dessus de la ville (le texte occupe la gauche) */
      const cam = ctx.camera, fwd = tv1.set(0, 0, -1).applyQuaternion(cam.quaternion), right = tv2.set(1, 0, 0).applyQuaternion(cam.quaternion), upv = tv3.set(0, 1, 0).applyQuaternion(cam.quaternion);
      const wpos = tv4.copy(cam.position).addScaledVector(fwd, 95).addScaledVector(right, 30).addScaledVector(upv, 9 - 18 * ss(.2, .6, p));
      title.position.copy(G.worldToLocal(wpos)); title.quaternion.copy(cam.quaternion);
      reveal(head, eOut(ss(.12, .26, p)) * (1 - ss(.58, .66, p)));
      reveal(list, eOut(ss(.7, .8, p)) * (1 - ss(.92, .98, p)));
      if (credit) credit.style.opacity = ss(.2, .3, p) * (1 - ss(.95, 1, p));
    }
  };
}
