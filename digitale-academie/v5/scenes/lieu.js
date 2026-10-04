/*
  II · LE LIEU · derrière la porte, le noir — et les chiffres en lumière
  La nuée qui attendait dans l'embrasure (3 000 points : un par formation) entre avec nous et écrit « 3 000+ ».
  La même matière se réarrange en « 600 m² », puis en « 2 » : deux points s'en détachent, jaune et cyan, les deux coachs.
  Une seule matière, trois chiffres, aucun décor : seulement ce que la page affirme (3 000+ formations, 600 m² fibrés, 2 coachs).
*/
export async function create(ctx, el) {
  const { THREE, ss, eOut, eIO, lerp } = ctx;
  const label = el.querySelector('.v2-label'), title = el.querySelector('.v2-lieu__t'), spaces = el.querySelector('.v2-lieu__spaces');
  const facts = [...el.querySelectorAll('.v2-facts li')];
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const rnd = (a, b) => a + Math.random() * (b - a);
  const D = ctx.pavilion.door;

  /* ---------- plan : on passe la porte, on avance lentement vers les chiffres ---------- */
  const TXT = V(D.x, 1.7, D.z - 11);
  const A = { pos: V(D.x, 1.62, D.z + 2.2), look: V(D.x, 1.5, D.z - 8) };
  const B = { pos: V(D.x, 1.62, D.z - 3.2), look: TXT.clone() };
  const E = { pos: V(D.x + .25, 1.66, D.z - 5.2), look: TXT.clone().add(V(0, -.05, 0)) };

  /* ---------- trois cibles écrites par la même matière ---------- */
  const N = 3000, S = ctx.mobile ? .62 : 1.25;
  const holder = new THREE.Object3D(); holder.position.copy(TXT); ctx.scene.add(holder);
  const mk = (str, size) => ctx.samplerOf(ctx.buildText(ctx.fontHeavy, str, size, .04, 0, new THREE.MeshBasicMaterial()), holder);
  const s1 = mk('3 000+', S), s2 = mk('600 m²', S), s3 = mk('2', S * 1.9);
  const pos = new Float32Array(N * 3), t1 = new Float32Array(N * 3), t2 = new Float32Array(N * 3), t3 = new Float32Array(N * 3), aS = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    pos.set([D.x + rnd(-.9, .9), rnd(.25, 2.4), D.z + rnd(-3.2, .7)], i * 3);   /* l'embrasure de la porte */
    t1.set(s1().toArray(), i * 3); t2.set(s2().toArray(), i * 3);
    /* « 2 » : quatre points sur dix ; les autres s'écartent en un ciel d'étoiles autour du chiffre */
    if (Math.random() < .4) t3.set(s3().toArray(), i * 3);
    else { const a = rnd(0, 6.283), b = rnd(-.6, .9), r = rnd(5, 11); t3.set([TXT.x + Math.cos(a) * r, TXT.y + b * r * .5, TXT.z + Math.sin(a) * r * .6 - 2], i * 3); }
    aS[i] = Math.random();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('aT1', new THREE.BufferAttribute(t1, 3));
  geo.setAttribute('aT2', new THREE.BufferAttribute(t2, 3)); geo.setAttribute('aT3', new THREE.BufferAttribute(t3, 3)); geo.setAttribute('aS', new THREE.BufferAttribute(aS, 1));
  const U = { uTime: { value: 0 }, uPre: { value: 0 }, uA: { value: 0 }, uB: { value: 0 }, uC: { value: 0 }, uOut: { value: 0 }, uPix: { value: ctx.renderer.getPixelRatio() }, uCtr: { value: TXT.clone() } };
  const pts = new THREE.Points(geo, new THREE.ShaderMaterial({
    uniforms: U, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, toneMapped: false,
    vertexShader: `attribute vec3 aT1,aT2,aT3;attribute float aS;uniform float uTime,uPre,uA,uB,uC,uOut,uPix;uniform vec3 uCtr;varying vec3 vC;varying float vA;
      float st(float u,float s,float w){float k=clamp(u*(1.+w)-s*w,0.,1.);return k*k*(3.-2.*k);}
      vec3 arc(vec3 a,vec3 b,float k,float lift,float seed){vec3 m=mix(a,b,.5)+vec3(sin(seed*31.)*lift,lift*.6+cos(seed*17.)*lift*.4,cos(seed*23.)*lift*.5);return mix(mix(a,m,k),mix(m,b,k),k);}
      void main(){
        vec3 p=position+vec3(sin(uTime*.9+aS*60.),cos(uTime*.7+aS*40.),sin(uTime*.8+aS*20.))*.06*uPre;
        float a=st(uA,aS,.8),b=st(uB,fract(aS*7.3),.6),c=st(uC,fract(aS*3.1),.6);
        p=arc(p,aT1,a,1.4,aS);p=arc(p,aT2,b,.9,aS+.3);p=arc(p,aT3,c,.9,aS+.6);
        p+=vec3(sin(uTime*1.3+aS*90.),cos(uTime*1.1+aS*70.),0.)*.012;
        p+=normalize(p-uCtr+vec3(.001))*uOut*uOut*(2.+6.*aS);
        vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;
        gl_PointSize=clamp(uPix*mix(1.6,2.4,fract(aS*5.))*(9./-mv.z),1.,uPix*9.);
        vec3 warm=mix(vec3(1.,.86,.55),vec3(1.,.95,.82),aS)*1.7;
        vC=mix(warm,vec3(1.,.82,.18)*1.9,c*.6);
        vA=max(a,uPre*(.45+.25*sin(uTime*2.+aS*70.)))*(1.-uOut)*(.75+.25*sin(uTime*3.+aS*80.)*(1.-a*.7));}`,
    fragmentShader: `varying vec3 vC;varying float vA;void main(){vec2 c=gl_PointCoord-.5;float r=length(c);if(r>.5)discard;gl_FragColor=vec4(vC*(1.-smoothstep(0.,.5,r))*vA,1.);}`
  }));
  pts.frustumCulled = false; pts.visible = false; ctx.scene.add(pts);
  /* poussière dans le noir : la profondeur, sans décor */
  const dust = ctx.dust(ctx.mobile ? 500 : 1400, TXT.clone().add(V(0, 0, 4)), [16, 8, 20], '#B8B0A0', .4); dust.visible = false; ctx.scene.add(dust);

  /* ---------- deux lucioles : les coachs, nées du « 2 » ---------- */
  const luc = ['#FFD600', '#00BBDB'].map((c, k) => {
    const col = new THREE.Color(c);
    const orb = new THREE.Mesh(new THREE.SphereGeometry(.06, 16, 16), new THREE.MeshBasicMaterial({ color: col.clone().multiplyScalar(5), toneMapped: false }));
    const TR = 80, tp = new Float32Array(TR * 3), tc = new Float32Array(TR * 3);
    for (let i = 0; i < TR; i++) { const a = (1 - i / TR) ** 1.8 * 2.4; tc.set([col.r * a, col.g * a, col.b * a], i * 3); }
    const tg = new THREE.BufferGeometry(); tg.setAttribute('position', new THREE.BufferAttribute(tp, 3)); tg.setAttribute('color', new THREE.BufferAttribute(tc, 3));
    const trail = new THREE.Line(tg, new THREE.LineBasicMaterial({ vertexColors: true, toneMapped: false, transparent: true, blending: THREE.AdditiveBlending }));
    trail.frustumCulled = false; orb.visible = trail.visible = false; ctx.scene.add(orb, trail);
    return { orb, trail, tp, TR, k, init: false };
  });

  let act0 = -1, preK = 0;
  const hide = () => { pts.visible = false; dust.visible = false; luc.forEach(L => { L.orb.visible = L.trail.visible = false; L.init = false; }); };
  return {
    /* fin de l'ouverture : la nuée attend déjà dans l'embrasure (k de 0 à 1) */
    prelude(k, t) { preK = k; if (k <= 0) return; pts.visible = true; U.uPre.value = k; U.uA.value = 0; U.uB.value = 0; U.uC.value = 0; U.uOut.value = 0; U.uTime.value = t; },
    rest() { if (preK > 0) return; hide(); },
    cam(p, m) {
      const k1 = eIO(ss(0, .2, p)), k2 = eIO(ss(.2, 1, p));
      const pos = A.pos.clone().lerp(B.pos, k1).lerp(E.pos, k2), look = A.look.clone().lerp(B.look, k1).lerp(E.look, k2);
      pos.x += m.sx * .18; pos.y += m.sy * .08;
      return { pos, look, cut: 'lieu' };
    },
    update(p, t, dt, m, isCurrent) {
      if (!isCurrent) { if (preK <= 0) hide(); return; }
      pts.visible = p < .999; dust.visible = true; dust.userData.U.uTime.value = t;
      U.uTime.value = t; U.uPre.value = 1 - ss(.02, .16, p);
      U.uA.value = ss(.03, .3, p); U.uB.value = ss(.38, .54, p); U.uC.value = ss(.62, .76, p); U.uOut.value = ss(.9, 1, p);

      /* les lucioles : elles se détachent du « 2 », tournent l'une autour de l'autre, puis filent vers la visite */
      const born = eOut(ss(.74, .84, p)), leave = eIO(ss(.88, 1, p));
      luc.forEach(L => {
        const show = p > .73;
        L.orb.visible = L.trail.visible = show;
        const a = t * 1.4 + L.k * Math.PI, rad = lerp(.05, .9, born);
        const P = TXT.clone().add(V(Math.cos(a) * rad, .2 + Math.sin(t * 2 + L.k) * .25 * born, Math.sin(a) * rad * .7 + .6 * born));
        P.lerp(V(D.x + (L.k ? 3 : -3), 1.8, D.z - 20), leave);
        L.orb.position.copy(P);
        if (!L.init || !show) { for (let i = 0; i < L.TR; i++) L.tp.set(P.toArray(), i * 3); L.init = true; }
        L.tp.copyWithin(3, 0, (L.TR - 1) * 3); L.tp.set(P.toArray(), 0); L.trail.geometry.attributes.position.needsUpdate = true;
      });

      /* un chiffre à la fois, en sous-titre, synchronisé avec la matière */
      const act = p < .22 ? -1 : p < .4 ? 0 : p < .55 ? -1 : p < .62 ? 1 : p < .78 ? -1 : p < .88 ? 2 : -1;
      if (act !== act0) { if (act >= 0) ctx.cue('borne'); act0 = act; }
      facts.forEach((li, i) => li.classList.toggle('is-on', i === act));
      if (spaces) spaces.style.opacity = eOut(ss(.88, .96, p));
      const head = Math.max(1 - ss(.2, .27, p), ss(.88, .95, p));
      if (label) label.style.opacity = head; if (title) title.style.opacity = head;
      ctx.bloom.threshold = .7; ctx.bloom.strength = .7;
    }
  };
}
