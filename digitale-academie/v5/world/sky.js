/*
  Le ciel du rêve : dôme en dégradé (nuit → crépuscule), étoiles, mer de nuages en contrebas,
  nuages flottants. uDusk fait glisser l'heure : nuit profonde à l'ouverture, aube au final.
*/
export function createSky(ctx) {
  const { THREE } = ctx;
  const G = new THREE.Group();
  const U = { uTime: { value: 0 }, uDusk: { value: 0 } };

  const dome = new THREE.Mesh(new THREE.SphereGeometry(900, 48, 24), new THREE.ShaderMaterial({
    uniforms: U, side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: 'varying vec3 vD;void main(){vD=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: `uniform float uTime,uDusk;varying vec3 vD;
      float h(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
      void main(){
        float y=vD.y;
        vec3 zen=mix(vec3(.012,.018,.06),vec3(.05,.06,.2),uDusk);
        vec3 mid=mix(vec3(.025,.02,.07),vec3(.25,.13,.34),uDusk);
        vec3 hor=mix(vec3(.09,.05,.13),vec3(1.1,.55,.38),uDusk);
        vec3 c=mix(hor,mid,smoothstep(-.02,.22,y));c=mix(c,zen,smoothstep(.2,.75,y));
        c=mix(c,vec3(.08,.06,.16),(1.-smoothstep(-.25,0.,y)));
        /* étoiles : visibles surtout la nuit */
        vec3 q=floor(vD*420.);float s=step(.9965,h(q))*smoothstep(.05,.4,y);
        s*=.55+.45*sin(uTime*(1.+h(q+1.)*3.)+h(q)*40.);
        c+=vec3(.9,.92,1.)*s*(1.-uDusk*.7)*1.6;
        /* halo de lune */
        vec3 m=normalize(vec3(-.45,.38,-.8));float md=max(dot(vD,m),0.);
        c+=vec3(.75,.8,1.)*(pow(md,900.)*6.+pow(md,24.)*.18);
        gl_FragColor=vec4(c,1.);}`
  }));
  dome.renderOrder = -10; G.add(dome);

  /* mer de nuages */
  const SU = { uTime: U.uTime, uDusk: U.uDusk };
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(2400, 2400, 1, 1), new THREE.ShaderMaterial({
    uniforms: SU, transparent: true, depthWrite: false, fog: false,
    vertexShader: 'varying vec2 vW;void main(){vec4 w=modelMatrix*vec4(position,1.);vW=w.xz;gl_Position=projectionMatrix*viewMatrix*w;}',
    fragmentShader: `uniform float uTime,uDusk;varying vec2 vW;
      float hh(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hh(i),hh(i+vec2(1,0)),f.x),mix(hh(i+vec2(0,1)),hh(i+vec2(1,1)),f.x),f.y);}
      float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<5;i++){v+=a*n(p);p*=2.03;a*=.5;}return v;}
      void main(){
        vec2 p=vW*.012+vec2(uTime*.01,uTime*.004);
        float d=fbm(p+fbm(p*1.7+uTime*.02));
        float a=smoothstep(.35,.75,d);
        vec3 lo=mix(vec3(.025,.022,.06),vec3(.42,.26,.4),uDusk),hi=mix(vec3(.13,.12,.24),vec3(1.,.72,.62),uDusk);
        vec3 c=mix(lo,hi,smoothstep(.45,.9,d));
        float fade=1.-smoothstep(300.,1100.,length(vW));
        gl_FragColor=vec4(c,a*.92*fade);}`
  }));
  sea.rotation.x = -Math.PI / 2; sea.position.y = -46; G.add(sea);

  /* nuages flottants : sprites doux générés (aucune image externe) */
  const cv = document.createElement('canvas'); cv.width = cv.height = 128;
  const g = cv.getContext('2d');
  for (let i = 0; i < 26; i++) {
    const x = 64 + (Math.random() - .5) * 60, y = 64 + (Math.random() - .5) * 26, r = 16 + Math.random() * 26;
    const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(255,255,255,.22)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  }
  const ctex = new THREE.CanvasTexture(cv); ctex.colorSpace = THREE.SRGBColorSpace;
  const puffs = [];
  for (let i = 0; i < (ctx.mobile ? 18 : 40); i++) {
    const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: ctex, transparent: true, depthWrite: false, color: '#9C8FC8', opacity: .55, fog: false }));
    const a = Math.random() * Math.PI * 2, r = 60 + Math.random() * 260;
    m.position.set(Math.cos(a) * r, 40 + Math.random() * 60, Math.sin(a) * r - 40);
    const s = 40 + Math.random() * 80; m.scale.set(s, s * .45, 1);
    m.userData = { a, r, sp: (Math.random() - .5) * .004, y: m.position.y };
    puffs.push(m); G.add(m);
  }

  ctx.scene.add(G);
  const night = new THREE.Color('#0A0A1C'), dawn = new THREE.Color('#6B4766'), tmp = new THREE.Color();
  return {
    U, group: G,
    update(t, dusk) {
      U.uTime.value = t; U.uDusk.value = dusk;
      puffs.forEach(m => { const u = m.userData; u.a += u.sp * .016; m.position.x = Math.cos(u.a) * u.r; m.position.z = Math.sin(u.a) * u.r - 40; m.material.color.setRGB(.2 + .8 * dusk, .18 + .52 * dusk, .34 + .44 * dusk); m.material.opacity = .3 + .3 * dusk; });
      if (ctx.scene.fog) ctx.scene.fog.color.copy(tmp.copy(night).lerp(dawn, dusk));
    }
  };
}
