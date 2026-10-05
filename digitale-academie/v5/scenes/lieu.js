/*
  II · LE LIEU · on passe la porte, et les chiffres prennent corps
  Le pavillon est encore éteint. Par la porte ouverte entrent 3 000 points de lumière : un par formation (l'Université
  vient à toi). Ils se rassemblent en « 3 000+ » au milieu de la cafétéria, puis tombent au sol et deviennent la fibre
  qui court sous les 600 m² du pavillon. Deux d'entre eux se relèvent : les deux coachs, deux lucioles (jaune, cyan)
  qu'on retrouvera parmi les lanternes de l'atelier. Enfin les néons s'allument : la visite commence.
  Chiffres affichés : ceux de la page (3 000+ formations, 600 m² fibrés, 2 coachs) ; aucune quantité inventée.
*/
import { flicker } from '../world/photorooms.js';

export async function create(ctx, el) {
  const { THREE, ss, eOut, eIO, lerp, pavilion } = ctx;
  const label = el.querySelector('.v2-label'), title = el.querySelector('.v2-lieu__t'), spaces = el.querySelector('.v2-lieu__spaces');
  const facts = [...el.querySelectorAll('.v2-facts li')];
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const rnd = (a, b) => a + Math.random() * (b - a);

  /* ---------- plans de caméra ---------- */
  const SHOTS = [
    [0, V(2.05, 1.62, 2.4), V(2.05, 1.45, -6)],        /* la porte */
    [.16, V(2.5, 1.6, -2.7), V(6.4, 1.5, -5.6)],        /* on entre : la nuée arrive par-dessus l'épaule */
    [.4, V(2.6, 1.62, -3.1), V(6.6, 1.45, -5.7)],       /* « 3 000+ » face à nous */
    [.6, V(10.6, 2.3, -2.7), V(1.5, .1, -6.4)],         /* plongée : la fibre court sous tout le pavillon */
    [.78, V(1.8, 1.7, -3), V(5.6, 1.4, -6.2)],          /* les deux lucioles */
    [1, V(3.4, 1.6, -2.9), V(8.5, 1.1, -5.8)]           /* néons allumés : départ de la visite */
  ];
  const shot = p => {
    let i = 0; while (i < SHOTS.length - 2 && p > SHOTS[i + 1][0]) i++;
    const [a, pa, la] = SHOTS[i], [b, pb, lb] = SHOTS[i + 1], k = eIO((p - a) / (b - a));
    return { pos: pa.clone().lerp(pb, k), look: la.clone().lerp(lb, k) };
  };

  /* ---------- 3 000 points : cibles « 3 000+ » (texte) et « fibre » (sol) ---------- */
  const N = 3000;
  const TXT = V(6.5, 1.55, -5.7);
  /* sur un écran en hauteur, le chiffre est plus petit pour tenir dans le cadre */
  const txt = ctx.buildText(ctx.fontHeavy, '3 000+', ctx.mobile ? .56 : 1.05, .04, 0, new THREE.MeshBasicMaterial());
  const holder = new THREE.Object3D(); holder.position.copy(TXT); holder.lookAt(SHOTS[2][1]); holder.updateMatrixWorld(true);
  /* échantillonnage des faces avant des lettres, à surface égale */
  const tris = [], va = new THREE.Vector3(), vb = new THREE.Vector3(), vc = new THREE.Vector3();
  let area = 0;
  txt.userData.letters.forEach(m => {
    const g = m.geometry, pa = g.attributes.position, ix = g.index;
    const cnt = ix ? ix.count : pa.count, get = k => ix ? ix.getX(k) : k;
    for (let t = 0; t < cnt; t += 3) {
      va.fromBufferAttribute(pa, get(t)); vb.fromBufferAttribute(pa, get(t + 1)); vc.fromBufferAttribute(pa, get(t + 2));
      if (va.z < .015 || vb.z < .015 || vc.z < .015) continue;   /* face avant seulement (z = +profondeur/2) */
      const ar = vb.clone().sub(va).cross(vc.clone().sub(va)).length() / 2; if (ar <= 0) continue;
      area += ar; tris.push({ a: va.clone().setX(va.x + m.position.x), b: vb.clone().setX(vb.x + m.position.x), c: vc.clone().setX(vc.x + m.position.x), acc: area });
    }
  });
  const samplePt = () => {
    const r = Math.random() * area; let lo = 0, hi = tris.length - 1;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (tris[mid].acc < r) lo = mid + 1; else hi = mid; }
    const T = tris[lo]; let u = Math.random(), v = Math.random(); if (u + v > 1) { u = 1 - u; v = 1 - v; }
    return T.a.clone().addScaledVector(T.b.clone().sub(T.a), u).addScaledVector(T.c.clone().sub(T.a), v).applyMatrix4(holder.matrixWorld);
  };
  /* fibre : un réseau orthogonal sous le plan du pavillon (bloc du fond et deux ailes), départ depuis la porte */
  const segs = [];
  const addSeg = (x0, z0, x1, z1) => segs.push([x0, z0, x1, z1, Math.hypot(x1 - x0, z1 - z0)]);
  addSeg(2.05, -1.9, 2.05, -15.4);
  for (let z = -3.2; z >= -15.4; z -= 2.4) addSeg(-11.4, z, 11.4, z);
  for (let x = -10.8; x <= 10.8; x += 2.4) addSeg(x, -2.4, x, -15.4);
  for (const sx of [-1, 1]) { for (let z = 5.2; z >= -1.6; z -= 2.2) addSeg(sx * 4.6, z, sx * 11.4, z); addSeg(sx * 8, 5.4, sx * 8, -2.4); }
  const total = segs.reduce((a, s) => a + s[4], 0);
  const pos = new Float32Array(N * 3), aT1 = new Float32Array(N * 3), aT2 = new Float32Array(N * 3), aS = new Float32Array(N), aL = new Float32Array(N);
  const door = pavilion.door;
  for (let i = 0; i < N; i++) {
    /* départ : dans l'embrasure de la porte, de part et d'autre du seuil : c'est la lumière qui attire depuis l'allée */
    pos.set([door.x + rnd(-.9, .9), rnd(.25, 2.4), door.z + rnd(-3.2, .7)], i * 3);
    aT1.set(samplePt().toArray(), i * 3);
    let r = (i + Math.random() * .5) / N * total, k = 0; while (k < segs.length - 1 && r > segs[k][4]) { r -= segs[k][4]; k++; }
    const [x0, z0, x1, z1, L] = segs[k], u = Math.min(1, r / L);
    aT2.set([x0 + (x1 - x0) * u, .025, z0 + (z1 - z0) * u], i * 3);
    aS[i] = Math.random(); aL[i] = (Math.abs(x0 - door.x) + Math.abs(z0 - door.z)) + r;   /* distance (réseau) depuis la porte */
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('aT1', new THREE.BufferAttribute(aT1, 3));
  geo.setAttribute('aT2', new THREE.BufferAttribute(aT2, 3)); geo.setAttribute('aS', new THREE.BufferAttribute(aS, 1)); geo.setAttribute('aL', new THREE.BufferAttribute(aL, 1));
  const U = { uPre: { value: 0 }, uTime: { value: 0 }, uIn: { value: 0 }, uFloor: { value: 0 }, uOut: { value: 0 }, uPix: { value: ctx.renderer.getPixelRatio() }, uCam: { value: new THREE.Vector3() } };
  const pts = new THREE.Points(geo, new THREE.ShaderMaterial({
    uniforms: U, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, toneMapped: false,
    vertexShader: `attribute vec3 aT1,aT2;attribute float aS,aL;uniform float uTime,uIn,uFloor,uOut,uPix,uPre;uniform vec3 uCam;varying vec3 vC;varying float vA;
      vec3 bez(vec3 a,vec3 b,vec3 c,float t){return mix(mix(a,b,t),mix(b,c,t),t);}
      void main(){
        /* arrivée : chaque point passe près de la caméra (par-dessus l'épaule) avant de trouver sa place */
        float k=clamp(uIn*1.7-aS*.7,0.,1.);float e=k*k*(3.-2.*k);
        vec3 mid=mix(position,aT1,.45)+vec3(sin(aS*40.)*1.4,.8+cos(aS*23.)*.9,cos(aS*31.)*1.2);
        vec3 p=bez(position,mid,aT1,e);
        p+=vec3(sin(uTime*.9+aS*60.),cos(uTime*.7+aS*40.),sin(uTime*.8+aS*20.))*(.025*e+.07*(1.-e)*uPre);
        /* chute vers la fibre : légère avance selon la distance au sol réseau (on voit la nappe se poser depuis la porte) */
        float f=clamp(uFloor*1.6-aS*.25-aL*.012,0.,1.);float ef=f*f*(3.-2.*f);
        vec3 arc=mix(p,aT2,.5)+vec3(0.,.6*(1.-abs(ef*2.-1.)),0.);
        p=bez(p,arc,aT2,ef);
        vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;
        float pulse=pow(.5+.5*sin(aL*1.6-uTime*5.),12.);
        gl_PointSize=uPix*mix(2.4,1.7,ef)*(1.+pulse*ef*1.2)*(8./max(.6,-mv.z));
        vec3 warm=mix(vec3(1.,.78,.4),vec3(1.,.92,.7),aS);vec3 fib=mix(vec3(1.,.82,.35),vec3(.75,.9,1.),step(.82,aS));
        vC=mix(warm*1.7,fib*(1.1+pulse*2.6),ef);
        vA=max(smoothstep(0.,.05,uIn-aS*.55),uPre*(.45+.25*sin(uTime*2.+aS*70.)))*(1.-uOut)*mix(.85+.15*sin(uTime*3.+aS*80.),1.,e);}`,
    fragmentShader: `varying vec3 vC;varying float vA;void main(){vec2 c=gl_PointCoord-.5;float r=length(c);if(r>.5)discard;gl_FragColor=vec4(vC*(1.-smoothstep(0.,.5,r))*vA,1.);}`
  }));
  pts.frustumCulled = false; pts.visible = false; pts.renderOrder = 10; ctx.scene.add(pts);

  /* ---------- deux lucioles : les coachs (couleurs des lucioles du chapitre « Les veilleurs ») ---------- */
  const luc = ['#FFD600', '#00BBDB'].map((c, k) => {
    const col = new THREE.Color(c);
    const orb = new THREE.Mesh(new THREE.SphereGeometry(.07, 16, 16), new THREE.MeshBasicMaterial({ color: col.clone().multiplyScalar(5), toneMapped: false }));
    const TR = 70, tp = new Float32Array(TR * 3), tc = new Float32Array(TR * 3);
    for (let i = 0; i < TR; i++) { const a = (1 - i / TR) ** 1.6 * 3; tc.set([col.r * a, col.g * a, col.b * a], i * 3); }
    const tg = new THREE.BufferGeometry(); tg.setAttribute('position', new THREE.BufferAttribute(tp, 3)); tg.setAttribute('color', new THREE.BufferAttribute(tc, 3));
    const trail = new THREE.Line(tg, new THREE.LineBasicMaterial({ vertexColors: true, toneMapped: false, transparent: true, blending: THREE.AdditiveBlending }));
    trail.frustumCulled = false; orb.visible = trail.visible = false; orb.renderOrder = trail.renderOrder = 10; ctx.scene.add(orb, trail);
    return { orb, trail, tp, TR, k, start: V(k ? 4.4 : 3.6, .03, k ? -6.2 : -4.8), init: false };
  });
  const HOVER = V(5.2, 1.55, -5.4);

  let lit = 1, act0 = -1, neonSaid = false, preK = 0;
  return {
    /* hors du chapitre : la nuée et les lucioles disparaissent (elles ne doivent pas traîner dans la visite) */
    /* fin de l'ouverture : la nuée attend déjà dans l'embrasure (k de 0 à 1) */
    prelude(k, t) { preK = k; if (k <= 0) return; pts.visible = true; U.uPre.value = k; U.uIn.value = 0; U.uFloor.value = 0; U.uOut.value = 0; U.uTime.value = t; },
    rest() { if (preK > 0) return; pts.visible = false; luc.forEach(L => { L.orb.visible = L.trail.visible = false; L.init = false; }); },
    cam(p, m) {
      const s = shot(p);
      s.pos.x += m.sx * .2; s.pos.y += m.sy * .08;
      return s;
    },
    update(p, t, dt, m, isCurrent) {
      /* l'électricité : on entre dans le pavillon éteint ; à la fin, les néons s'allument (quelques battements) */
      const dark = ss(.04, .16, p), on = ss(.84, 1, p);
      const power = on > 0 ? flicker(on) : .03 + .12 * (1 - dark);
      if (isCurrent) { pavilion.power(power); lit = power; }
      if (on > 0 && !neonSaid && isCurrent) { neonSaid = true; ctx.cue('neon'); } if (on === 0) neonSaid = false;
      /* l'accueil, en photographie : la porte passée, la lumière dorée de l'entrée ; les néons s'allument à la fin */
      if (isCurrent && ctx.backdrop) ctx.backdrop.show({
        a: 'accueil', fade: ss(.02, .11, p), zoom: 1.02 + .12 * ss(.08, 1, p),
        pan: [m.sx * .008, -.05 * ss(.5, .6, p) * (1 - ss(.7, .8, p)) + m.sy * .005],
        light: on > 0 ? .5 + .5 * flicker(on) : .5 - .12 * dark, warm: .5, expo: 1
      });

      U.uPre.value = 1 - ss(.08, .3, p); U.uTime.value = t; U.uIn.value = ss(.06, .4, p); U.uFloor.value = ss(.46, .64, p); U.uOut.value = ss(.9, 1, p);
      pts.visible = isCurrent && p < .999;

      /* lucioles : se détachent de la fibre, s'élèvent en spirale, tournent ensemble, puis filent vers la visite */
      const rise = eOut(ss(.62, .76, p)), leave = eIO(ss(.88, 1, p));
      luc.forEach(L => {
        const show = isCurrent && p > .6;
        L.orb.visible = L.trail.visible = show;
        const a = t * 1.3 + L.k * Math.PI, rad = lerp(.05, .55, rise);
        const P = L.start.clone().lerp(HOVER, rise).add(V(Math.cos(a) * rad, Math.sin(t * 2.1 + L.k) * .18 * rise, Math.sin(a) * rad));
        P.lerp(V(-3 + L.k * .6, 1.7, -4.5), leave);
        L.orb.position.copy(P); L.orb.scale.setScalar(.5 + .5 * ss(.6, .7, p));
        if (!L.init || !show) { for (let i = 0; i < L.TR; i++) L.tp.set(P.toArray(), i * 3); L.init = true; }
        L.tp.copyWithin(3, 0, (L.TR - 1) * 3); L.tp.set(P.toArray(), 0); L.trail.geometry.attributes.position.needsUpdate = true;
      });

      /* textes : le titre, puis un seul chiffre à la fois, synchronisé avec la matière */
      const r1 = eOut(ss(.03, .12, p)), back = ss(.86, .95, p);
      const hide = 1 - ss(.24, .3, p);
      label.style.opacity = Math.max(r1 * hide, back); title.style.opacity = Math.max(r1 * hide, back);
      title.style.transform = `translate3d(0,${(1 - r1) * 40}px,0)`;
      const act = p < .3 ? -1 : p < .55 ? 0 : p < .7 ? 1 : p < .86 ? 2 : -1;
      if (act !== act0) { if (act >= 0 && isCurrent) ctx.cue('borne'); act0 = act; }
      facts.forEach((li, i) => li.classList.toggle('is-on', i === act));
      if (spaces) spaces.style.opacity = eOut(ss(.9, .98, p));

      if (isCurrent) {
        const { key, rim } = ctx.lights;
        /* pénombre : la lumière vient de la nuée, puis de la fibre, puis des deux lucioles ; les néons reprennent la main */
        if (ctx.ambient) ctx.ambient(lerp(.04, 1, lit));
        if (ctx.bloom) { ctx.bloom.threshold = 1.15; ctx.bloom.strength = .55; }
        if (p < .6) { key.position.copy(TXT).add(V(-1.2, .4, 1.6)); key.color.set('#FFD9A0'); key.intensity = 4 * ss(.2, .4, p) * (1 - ss(.48, .6, p)); rim.position.set(4, 1.6, -7); rim.color.set('#FFC870'); rim.intensity = 1.5 * ss(.5, .6, p); }
        else { key.position.copy(luc[0].orb.position); key.color.set('#FFD600'); key.intensity = 2.5 * rise * (1 - on) + 12 * lit; rim.position.copy(luc[1].orb.position); rim.color.set('#00BBDB'); rim.intensity = 2.5 * rise * (1 - on) + 7 * lit; }
        if (on > .5) { key.position.set(5, 2.4, -4.5); key.color.set('#FFF1DC'); rim.position.set(-4, 2.4, -5); rim.color.set('#EAF2FF'); }
      }
    }
  };
}
