/*
  Les abords réels, d'après les photos : allée d'enrobé mouillé bordée de bordures, bande podotactile jaune
  qui mène à la porte double, deux bornes béton, pelouse, arbustes, arbres nus, lampadaire, clôture en
  treillis vert, totem « MONTEREAU DIGITALE ACADEMIE » + téléphone, immeubles à balcons et château d'eau de Surville.
  La bande jaune peut s'allumer progressivement : c'est le fil, et il existe vraiment.
*/
import { makeSegmentText } from './pavilion.js';

export async function createSurville(ctx) {
  const { THREE } = ctx;
  const G = new THREE.Group();
  const rnd = (a, b) => a + Math.random() * (b - a);
  const box = (w, h, d, m) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  const at = (o, x, y, z) => { o.position.set(x, y, z); G.add(o); return o; };
  const ctex = (w, h, draw, rep) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; if (rep) t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; };

  /* sol : pelouse, enrobé mouillé (peu rugueux : il reflète les lumières), flaques */
  const grassTex = ctex(256, 256, (g, w, h) => { g.fillStyle = '#34432C'; g.fillRect(0, 0, w, h); for (let i = 0; i < 5000; i++) { g.fillStyle = `rgba(${60 + Math.random() * 50},${80 + Math.random() * 60},${40 + Math.random() * 30},.5)`; g.fillRect(Math.random() * w, Math.random() * h, 1, 3); } }, true);
  grassTex.repeat.set(40, 40);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshStandardMaterial({ map: grassTex, roughness: .95 }));
  ground.rotation.x = -Math.PI / 2; ground.position.set(0, -.01, -20); G.add(ground);
  const asphaltTex = ctex(256, 256, (g, w, h) => { g.fillStyle = '#2E3034'; g.fillRect(0, 0, w, h); for (let i = 0; i < 9000; i++) { const v = 30 + Math.random() * 40; g.fillStyle = `rgb(${v},${v},${v + 4})`; g.fillRect(Math.random() * w, Math.random() * h, 1.5, 1.5); } }, true);
  asphaltTex.repeat.set(3, 10);
  const asphalt = new THREE.MeshStandardMaterial({ map: asphaltTex, roughness: .22, metalness: .25, envMapIntensity: 1.4 });
  const path = new THREE.Mesh(new THREE.PlaneGeometry(7.6, 28), asphalt); path.rotation.x = -Math.PI / 2; at(path, 0, .005, 18);
  const court = new THREE.Mesh(new THREE.PlaneGeometry(7.8, 8), new THREE.MeshStandardMaterial({ color: '#7E7F80', roughness: .3, metalness: .15 })); court.rotation.x = -Math.PI / 2; at(court, 0, .006, 2);
  const curbM = new THREE.MeshStandardMaterial({ color: '#8F8D88', roughness: .7 });
  for (const x of [-3.85, 3.85]) at(box(.18, .14, 28, curbM), x, .07, 18);
  const puddle = new THREE.MeshStandardMaterial({ color: '#2A2D33', roughness: .03, metalness: .5, envMapIntensity: 2, transparent: true, opacity: .55, depthWrite: false });
  for (const [x, z, r] of [[-1.6, 9, 1.1], [1, 14, .8], [-.6, 21, 1.4], [2.6, 5, .7]]) { const p = new THREE.Mesh(new THREE.CircleGeometry(r, 32), puddle); p.rotation.x = -Math.PI / 2; p.scale.y = rnd(.5, .8); at(p, x, .008, z); }

  /* bande podotactile jaune : nervures en relief, et lumière qui la parcourt jusqu'à la porte */
  const stripU = { uProg: { value: 0 }, uTime: { value: 0 } };
  const strip = new THREE.Mesh(new THREE.PlaneGeometry(.42, 33.5, 1, 1), new THREE.ShaderMaterial({
    uniforms: stripU,
    vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    /* uv.y = 0 côté rue, 1 côté porte */
    fragmentShader: `uniform float uProg,uTime;varying vec2 vUv;
      void main(){
        float rib=step(.5,fract(vUv.x*5.));
        vec3 base=mix(vec3(.72,.56,.06),vec3(.86,.7,.12),rib)*.55;
        float lit=(1.-smoothstep(uProg-.004,uProg+.004,vUv.y));
        float head=exp(-pow((vUv.y-uProg)*90.,2.))*step(.001,uProg)*step(uProg,.999);
        float pulse=.85+.15*sin(uTime*2.-vUv.y*40.);
        vec3 glow=vec3(1.,.82,.1)*(1.1*pulse);
        gl_FragColor=vec4(base+glow*lit+vec3(1.,.95,.6)*head*3.,1.);}`
  }));
  strip.rotation.x = -Math.PI / 2; at(strip, 2.05, .012, 14.85);

  /* bornes béton (deux, comme sur la photo de couverture) */
  const bollM = new THREE.MeshStandardMaterial({ color: '#A3A19C', roughness: .8 });
  for (const [x, z] of [[-1.1, 1.4], [1.55, 1.4]]) { at(new THREE.Mesh(new THREE.CylinderGeometry(.16, .17, .82, 20), bollM), x, .41, z); at(new THREE.Mesh(new THREE.SphereGeometry(.16, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), bollM), x, .82, z); }

  /* clôture en treillis soudé vert, portillon ouvert sur l'allée */
  const meshTex = ctex(128, 128, (g, w, h) => { g.clearRect(0, 0, w, h); g.strokeStyle = '#3E6B4A'; g.lineWidth = 3; for (let x = 0; x <= w; x += 16) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); } for (let y = 0; y <= h; y += 64) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); } }, true);
  const fenceM = new THREE.MeshStandardMaterial({ map: meshTex, transparent: true, alphaTest: .4, side: THREE.DoubleSide, roughness: .6 });
  for (const [x0, x1] of [[-30, -4.2], [4.2, 30]]) { const w = x1 - x0; const f = new THREE.Mesh(new THREE.PlaneGeometry(w, 1.8), fenceM.clone()); f.material.map = meshTex.clone(); f.material.map.repeat.set(w / 2.5, 1); f.material.map.needsUpdate = true; at(f, (x0 + x1) / 2, .9, 30); for (let x = x0; x <= x1; x += 2.5) at(box(.06, 1.85, .06, new THREE.MeshStandardMaterial({ color: '#2F5A3C' })), x, .92, 30); }

  /* lampadaire (la lumière clé de la nuit s'y accroche) */
  const poleM = new THREE.MeshStandardMaterial({ color: '#4A4F55', roughness: .5, metalness: .6 });
  at(new THREE.Mesh(new THREE.CylinderGeometry(.07, .1, 6.5, 10), poleM), -6, 3.25, 15);
  at(box(1.1, .08, .08, poleM), -5.5, 6.45, 15);
  const lamp = at(box(.5, .12, .25, new THREE.MeshBasicMaterial({ color: new THREE.Color('#FFD9A0').multiplyScalar(5), toneMapped: false })), -5.05, 6.38, 15);

  /* totem, d'après le bandeau du site : logo, enseigne à segments, téléphone */
  const logoTex = await ctx.tex('logo-da.png');
  const tc = document.createElement('canvas'); tc.width = 512; tc.height = 1200; const tg = tc.getContext('2d');
  tg.fillStyle = '#F4F5F6'; tg.fillRect(0, 0, 512, 1200);
  if (logoTex && logoTex.image) tg.drawImage(logoTex.image, 96, 60, 320, 347);
  const segImg = s => makeSegmentText(THREE, s, { w: 460, h: 90 }).image;
  ['MONTEREAU', 'DIGITALE', 'ACADEMIE'].forEach((s, i) => tg.drawImage(segImg(s.padEnd(9, ' ')), 26, 520 + i * 110, 460, 90));
  tg.fillStyle = '#3B4048'; tg.font = '500 44px Jost, Arial'; tg.textAlign = 'center'; tg.fillText('☎ 01 82 34 01 41', 256, 940);
  const totemTex = new THREE.CanvasTexture(tc); totemTex.colorSpace = THREE.SRGBColorSpace; totemTex.anisotropy = 8;
  const white = new THREE.MeshStandardMaterial({ color: '#E9EBED', roughness: .5 });
  const totem = at(new THREE.Mesh(new THREE.BoxGeometry(1.35, 3.2, .18), [white, white, white, white, new THREE.MeshStandardMaterial({ map: totemTex, roughness: .55, emissive: '#ffffff', emissiveMap: totemTex, emissiveIntensity: .12 }), white]), 6.2, 1.6, 26);
  totem.rotation.y = -.25;

  /* végétation : arbres nus d'hiver, arbustes fleuris le long des façades */
  const treeM = new THREE.LineBasicMaterial({ color: '#4B4552' });
  const tree = (x, z, s) => {
    const pts = [];
    const grow = (p, d, len, depth) => { const e = p.clone().addScaledVector(d, len); pts.push(p, e); if (depth <= 0) return; const n = depth > 2 ? 3 : 2; for (let k = 0; k < n; k++) { const d2 = d.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), rnd(0, 6.28)).applyAxisAngle(new THREE.Vector3(1, 0, 0), rnd(-.6, .6)); d2.y = Math.abs(d2.y) * .8 + .3; d2.normalize(); grow(e, d2, len * rnd(.6, .78), depth - 1); } };
    grow(new THREE.Vector3(x, 0, z), new THREE.Vector3(0, 1, 0), 2.4 * s, 5);
    G.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), treeM));
  };
  [[-7, 11, 1], [7.5, 9, .8], [-9, 22, 1.2], [10, 20, 1.1], [-16, 4, 1.3], [16, -2, 1.2], [-15, -18, 1.4], [14, -20, 1.3]].forEach(a => tree(...a));
  const bushM = new THREE.MeshStandardMaterial({ color: '#2F4A2C', roughness: 1, flatShading: true });
  const flowerM = new THREE.MeshStandardMaterial({ color: '#F1EEE6', roughness: 1 });
  for (const [x, z, s] of [[-12.6, 4, 1], [-12.6, 0, .8], [12.7, 3, .9], [-6, 6.8, .7], [6.5, 6.8, .8], [-14, -6, 1.1], [14, -9, 1]]) {
    const b = at(new THREE.Mesh(new THREE.IcosahedronGeometry(.9 * s, 1), bushM), x, .55 * s, z); b.scale.y = .7;
    for (let k = 0; k < 14; k++) at(new THREE.Mesh(new THREE.SphereGeometry(.05, 6, 6), flowerM), x + rnd(-.7, .7) * s, .55 * s + rnd(-.2, .5) * s, z + rnd(-.7, .7) * s);
  }

  /* Surville : immeubles à balcons (fenêtres allumées) et château d'eau */
  const winTex = (cols, rows, lit) => ctex(cols * 12, rows * 18, (g, w, h) => {
    g.fillStyle = '#7E7C77'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < rows; y++) { g.fillStyle = '#A9A59C'; g.fillRect(0, y * 18 + 15, w, 3); for (let x = 0; x < cols; x++) { g.fillStyle = Math.random() < lit ? `rgb(255,${196 + Math.random() * 30},${140 + Math.random() * 40})` : '#22262C'; g.fillRect(x * 12 + 3, y * 18 + 4, 6, 9); } }
  });
  const block = (w, h, d, x, z, ry) => { const t = winTex(Math.round(w * 1.6), Math.round(h / 2.8), .28); const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ map: t, emissive: '#ffffff', emissiveMap: t, emissiveIntensity: .22, roughness: .9 })); m.position.set(x, h / 2, z); m.rotation.y = ry; G.add(m); return m; };
  block(14, 30, 12, -26, -40, .15); block(30, 18, 11, 24, -34, -.3); block(12, 40, 12, 40, -70, 0); block(36, 15, 10, -40, -12, .9);
  const conc = new THREE.MeshStandardMaterial({ color: '#9B9EA2', roughness: .95 });
  const tw = new THREE.Group(); tw.position.set(6, 0, -62); G.add(tw);
  const shaft = box(5, 30, 5, conc); shaft.position.y = 15; tw.add(shaft);
  const head = box(11, 7, 10, conc); head.position.y = 33; tw.add(head);
  for (let k = -3; k <= 3; k++) { const fin = box(.8, 7.4, 10.4, conc); fin.position.set(k * 1.5, 33, 0); tw.add(fin); }

  /* pluie fine : traits calculés sur la carte graphique, autour de la caméra */
  const RN = ctx.mobile ? 1500 : 4000;
  const rp = new Float32Array(RN * 2 * 3), rs = new Float32Array(RN * 2);
  for (let i = 0; i < RN; i++) { const x = rnd(-25, 25), y = rnd(0, 22), z = rnd(-25, 25); rp.set([x, y, z, x, y, z], i * 6); rs[i * 2] = 0; rs[i * 2 + 1] = 1; }
  const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.BufferAttribute(rp, 3)); rg.setAttribute('aEnd', new THREE.BufferAttribute(rs, 1));
  const RU = { uTime: { value: 0 }, uCam: { value: new THREE.Vector3() }, uAmt: { value: 1 } };
  const rain = new THREE.LineSegments(rg, new THREE.ShaderMaterial({
    uniforms: RU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    vertexShader: `uniform float uTime,uAmt;uniform vec3 uCam;attribute float aEnd;varying float vA;
      void main(){vec3 p=position;p.y=mod(p.y-uTime*14.,22.)-4.;p.x+=uCam.x;p.z+=uCam.z;p.x+=aEnd*.06;p.y-=aEnd*.55;
        vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;vA=uAmt*(1.-aEnd*.7)*(1.-smoothstep(4.,40.,-mv.z));}`,
    fragmentShader: 'varying float vA;void main(){gl_FragColor=vec4(vec3(.62,.68,.8)*vA*.55,1.);}'
  }));
  rain.frustumCulled = false; G.add(rain);

  ctx.scene.add(G);
  return {
    group: G, lamp, totem, strip,
    lampPos: new THREE.Vector3(-5.05, 6.2, 15),
    /* prog : 0 → bande éteinte, 1 → allumée jusqu'à la porte ; rain : intensité de la pluie */
    update(t, prog, rainAmt) { stripU.uTime.value = t; stripU.uProg.value = prog; RU.uTime.value = t; RU.uAmt.value = rainAmt; RU.uCam.value.copy(ctx.camera.position); rain.visible = rainAmt > .01; }
  };
}
