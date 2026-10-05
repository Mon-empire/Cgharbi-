/*
  Les intérieurs en photographie (plus aucune pièce modélisée) : une image plein cadre, attachée à l'œil, derrière
  la matière lumineuse (nuée, lucioles, livres). Lent travelling avant (zoom), léger flottement à la souris,
  fondu enchaîné d'une photo à l'autre, extinction / allumage des néons, dissolution finale (le papier peint qui brûle
  vers la bibliothèque).
  Photos : accueil = image générée d'après les vraies salles (à valider) ; salle informatique = vraie photo de la Ville
  (étudiants aux postes) ; salle d'étude = vraie photo de la Ville (papier peint de bibliothèque).
*/
export async function createBackdrop(ctx) {
  const { THREE } = ctx;
  const FILES = { accueil: 'accueil-genere.jpg', info: 'etudiants-1.jpg', salle: 'salle-travail.jpg' };
  const tex = {};
  await Promise.all(Object.entries(FILES).map(async ([k, f]) => { const t = await ctx.tex(f); if (t) { t.anisotropy = 8; tex[k] = t; } }));
  const U = {
    uA: { value: null }, uB: { value: null }, uAspA: { value: 1.6 }, uAspB: { value: 1.6 }, uScr: { value: 1.6 },
    uMix: { value: 0 }, uZoom: { value: 1 }, uPan: { value: new THREE.Vector2() }, uLight: { value: 1 }, uExpo: { value: 1 },
    uFade: { value: 1 }, uBurn: { value: 0 }, uTime: { value: 0 }, uWarm: { value: 0 }
  };
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShaderMaterial({
    uniforms: U, transparent: true, depthTest: false, depthWrite: false, fog: false, toneMapped: true,
    vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: `uniform sampler2D uA,uB;uniform float uAspA,uAspB,uScr,uMix,uZoom,uLight,uExpo,uFade,uBurn,uTime,uWarm;uniform vec2 uPan;varying vec2 vUv;
      vec2 cover(vec2 uv,float a){vec2 s=uScr>a?vec2(1.,a/uScr):vec2(uScr/a,1.);return (uv-.5)*s/uZoom+.5+uPan;}
      float hh(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hh(i),hh(i+vec2(1,0)),f.x),mix(hh(i+vec2(0,1)),hh(i+vec2(1,1)),f.x),f.y);}
      void main(){
        vec3 a=texture2D(uA,clamp(cover(vUv,uAspA),.001,.999)).rgb,b=texture2D(uB,clamp(cover(vUv,uAspB),.001,.999)).rgb;
        vec3 c=mix(a,b,uMix);
        float l=dot(c,vec3(.299,.587,.114));
        /* éteint : la pièce tombe dans la pénombre bleue (comme les vraies salles du chapitre III) */
        c=mix(vec3(l)*vec3(.05,.07,.12),c*uExpo*mix(vec3(1.),vec3(1.08,.98,.82),uWarm),uLight);
        /* dissolution : le papier peint (à gauche) se consume le premier, le front gagne toute l'image */
        float d=vUv.x*.85+n(vUv*vec2(7.,4.))*.25+n(vUv*vec2(29.,16.))*.08;
        float burn=uBurn*1.25-.05;float a1=smoothstep(burn-.03,burn+.03,d);
        float edge=(1.-smoothstep(0.,.025,abs(d-burn)))*step(.001,uBurn)*step(.02,burn);
        c+=vec3(1.,.6,.2)*edge*1.4;
        gl_FragColor=vec4(c,uFade*max(a1,edge*.8));}`
  }));
  mesh.renderOrder = 5; mesh.frustumCulled = false; mesh.visible = false;
  ctx.camera.add(mesh);
  const asp = t => t && t.image ? t.image.width / t.image.height : 1.6;
  const api = {
    on: false, U,
    /* s : { a, b, mix, zoom, pan:[x,y], light, expo, fade, burn, warm } */
    show(s) {
      api.on = true; mesh.visible = true;
      U.uA.value = tex[s.a] || null; U.uB.value = tex[s.b || s.a] || U.uA.value; U.uAspA.value = asp(U.uA.value); U.uAspB.value = asp(U.uB.value);
      U.uMix.value = s.mix || 0; U.uZoom.value = s.zoom || 1; U.uPan.value.set(...(s.pan || [0, 0]));
      U.uLight.value = s.light ?? 1; U.uExpo.value = s.expo ?? 1; U.uFade.value = s.fade ?? 1; U.uBurn.value = s.burn || 0; U.uWarm.value = s.warm || 0;
    },
    /* appelé à chaque image avant les chapitres : la photo ne reste que si un chapitre la redemande */
    reset() { api.on = false; mesh.visible = false; },
    fit() {
      const cam = ctx.camera, D = 20, h = 2 * D * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)) * 1.02;
      mesh.position.set(0, 0, -D); mesh.scale.set(h * cam.aspect, h, 1); U.uScr.value = cam.aspect;
    }
  };
  return api;
}
