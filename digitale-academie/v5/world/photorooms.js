/*
  Les vraies salles, en volume.
  Trois photographies publiées par la Ville (salle Frida Kahlo, salle Nelson Mandela, salle d'étude) sont projetées
  depuis la position recalée de l'appareil sur les plans de la pièce (sol, plafond, murs, bureaux) : à l'arrêt on voit
  la photo telle quelle, dès que la caméra avance on entre DANS la photo. Aucun pixel n'est inventé.

  Étalonnage (mesuré sur chaque photo, outils de détection de lignes + relevés à la main) :
    - Kahlo (1355 × 1800) : point de fuite de la pièce (930, 689), verticales quasi parallèles → focale ≈ 2000 px,
      tangage −6°, lacet 7,2° ; plinthe du mur du fond y = 1065, plafond y = 400 (2,6 m) ; façades des étagères et
      chant des bureaux comme plans verticaux.
    - Mandela (même appareil) : point de fuite du mur peint (2200, 670) ; angle avec le mur de droite (1240, 306) ;
      plateau du bureau à 0,75 m.
    - Salle d'étude (1181 × 788) : verticales redressées à la prise de vue (objectif à décentrement) → axe horizontal,
      horizon y = 78 ; deux directions orthogonales (bureaux) → focale ≈ 1030 px ; trois plans : sol, rangée de
      bureaux, fond de salle à 7,2 m.
  Unités : mètres, repère de chaque photo (appareil au-dessus de l'origine, −Z = axe de la pièce).
*/
export const ROOMS = {
  kahlo: {
    img: 'kahlo.jpg', W: 1355, H: 1800, f: 2000, cx: 677.5, cy: 900, yaw: 7.16, pitch: -6.02, h: 1.5, step: 9,
    look: [677, 660], push: 1.3,
    room: [{ y: 0 }, { y: 2.6 }, { line: [[500, 1065], [1355, 1065]] }, { foot: [165, 1465] }],
    polys: [
      { img: [[1000, 985], [1160, 905], [1355, 830], [1355, 1800], [1120, 1800], [1040, 1250], [1000, 1100]], plane: { foot: [1110, 1560] } },
      { img: [[0, 1150], [105, 1130], [105, 1590], [0, 1640]], plane: { foot: [60, 1620], dir: 90 } }
    ]
  },
  mandela: {
    img: 'mandela.jpg', W: 1355, H: 1800, f: 2000, cx: 677.5, cy: 900, yaw: 37.10, pitch: -6.56, h: 1.5, step: 9,
    look: [677, 800], push: .5,
    room: [{ y: 0 }, { y: 2.6 }, { foot: [40, 1700] }, { foot: [1240, 306], y: 2.6, dir: 90 }],
    polys: [
      { img: [[400, 1522], [1010, 1255], [1355, 1100], [1355, 1800], [1190, 1800], [400, 1560]], plane: { y: .75 } },
      { img: [[880, 1000], [1355, 960], [1355, 1100], [1250, 1300], [1010, 1490], [880, 1480]], plane: { foot: [1130, 1480], y: .75, dir: 90 } }
    ]
  },
  salle: {
    img: 'salle-travail.jpg', W: 1181, H: 788, f: 1030, cx: 590, cy: 78, yaw: 0, pitch: 0, h: 1.4, step: 6,
    look: [590, 394], push: .8,
    room: [{ y: 0 }, { n: [0, 0, 1], d: -7.2 }],
    polys: [
      { img: [[0, 140], [150, 120], [260, 150], [300, 170], [470, 180], [560, 160], [700, 150], [800, 165], [1181, 150], [1181, 788], [600, 788], [340, 600], [170, 520], [0, 470]], plane: { line: [[350, 578], [1060, 690]] } }
    ]
  }
};

export async function createPhotoRooms(ctx) {
  const { THREE } = ctx;
  const G = new THREE.Group(); G.visible = false; ctx.scene.add(G);
  const rooms = {};
  let slot = 0;
  for (const [id, P] of Object.entries(ROOMS)) {
    const tex = await ctx.tex(P.img);
    if (!tex) continue;
    tex.anisotropy = 16; tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
    const R = new THREE.Matrix4().makeRotationY(THREE.MathUtils.degToRad(P.yaw)).multiply(new THREE.Matrix4().makeRotationX(THREE.MathUtils.degToRad(P.pitch)));
    const R3 = new THREE.Matrix3().setFromMatrix4(R), RT = R3.clone().transpose();
    const C = new THREE.Vector3(0, P.h, 0);
    const ray = (u, v, out = new THREE.Vector3()) => out.set((u - P.cx) / P.f, -(v - P.cy) / P.f, -1).applyMatrix3(R3);

    /* plans de la pièce, d'après leurs traces sur la photo */
    const plane = s => {
      if (s.n) return { n: new THREE.Vector3(...s.n), d: s.d };
      if (s.foot) {
        const y0 = s.y ?? 0, d = ray(...s.foot), a = C.clone().addScaledVector(d, (y0 - C.y) / d.y);
        const ang = THREE.MathUtils.degToRad(s.dir ?? 0), t = new THREE.Vector3(-Math.sin(ang), 0, -Math.cos(ang));
        const n = new THREE.Vector3(-t.z, 0, t.x); return { n, d: n.dot(a) };
      }
      if (s.line) {
        const y0 = s.y ?? 0, [a, b] = s.line.map(([u, v]) => { const d = ray(u, v); return C.clone().addScaledVector(d, (y0 - C.y) / d.y); });
        const t = b.clone().sub(a), n = new THREE.Vector3(-t.z, 0, t.x).normalize(); return { n, d: n.dot(a) };
      }
      return { n: new THREE.Vector3(0, 1, 0), d: s.y };
    };
    const roomPl = P.room.map(plane), polys = (P.polys || []).map(q => ({ img: q.img, pl: plane(q.plane) }));
    const inPoly = (u, v, poly) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [x0, y0] = poly[i], [x1, y1] = poly[j]; if ((y0 > v) !== (y1 > v) && u < (x1 - x0) * (v - y0) / (y1 - y0) + x0) c = !c; } return c; };
    const hit = (pl, d) => { const den = pl.n.dot(d); if (Math.abs(den) < 1e-9) return Infinity; const t = (pl.d - pl.n.dot(C)) / den; return t > 0 ? t : Infinity; };

    /* maillage : une grille de pixels, chaque sommet posé sur le premier plan que rencontre son rayon */
    const s = P.step, nx = Math.ceil(P.W / s) + 1, ny = Math.ceil(P.H / s) + 1;
    const pos = new Float32Array(nx * ny * 3), ok = new Uint8Array(nx * ny), d = new THREE.Vector3();
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const u = Math.min(P.W, i * s), v = Math.min(P.H, j * s); ray(u, v, d);
      let T = Infinity; for (const pl of roomPl) T = Math.min(T, hit(pl, d));
      for (const q of polys) if (inPoly(u, v, q.img)) T = Math.min(T, hit(q.pl, d));
      const k = j * nx + i; if (T < 60) { ok[k] = 1; pos.set([C.x + d.x * T, C.y + d.y * T, C.z + d.z * T], k * 3); }
    }
    const idx = [];
    for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
      const a = j * nx + i, b = a + 1, c = a + nx, e = c + 1;
      if (ok[a] && ok[b] && ok[c] && ok[e]) idx.push(a, c, b, b, c, e);
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setIndex(idx);
    const U = { uMap: { value: tex }, uRT: { value: RT }, uC: { value: C }, uK: { value: new THREE.Vector4(P.f, P.cx, P.cy, 0) }, uWH: { value: new THREE.Vector2(P.W, P.H) }, uLight: { value: 0 }, uExpo: { value: 1 } };
    const mat = new THREE.ShaderMaterial({
      uniforms: U, fog: false,
      vertexShader: 'varying vec3 vP;void main(){vP=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      /* projection de la photo depuis l'appareil ; éteint, la salle tombe dans la pénombre bleue d'avant l'ouverture */
      fragmentShader: `uniform sampler2D uMap;uniform mat3 uRT;uniform vec3 uC;uniform vec4 uK;uniform vec2 uWH;uniform float uLight,uExpo;varying vec3 vP;
        void main(){vec3 pc=uRT*(vP-uC);float z=max(.001,-pc.z);vec2 px=vec2(uK.y+uK.x*pc.x/z,uK.z-uK.x*pc.y/z);
          vec2 uv=vec2(px.x/uWH.x,1.-px.y/uWH.y);vec2 e=min(uv,1.-uv);float inside=smoothstep(-.01,.01,min(e.x,e.y));
          vec3 c=texture2D(uMap,clamp(uv,.001,.999)).rgb*mix(.35,1.,inside);
          float l=dot(c,vec3(.299,.587,.114));
          vec3 off=vec3(l)*vec3(.012,.016,.028);
          gl_FragColor=vec4(mix(off,c*uExpo,uLight),1.);}`
    });
    const mesh = new THREE.Mesh(geo, mat); mesh.frustumCulled = false;
    const g = new THREE.Group(); g.position.set(slot++ * 60, -400, 0); g.add(mesh); G.add(g);

    /* prise de vue : depuis l'appareil, le long du rayon central, avec une focale qui ne sort jamais de la photo */
    const [lu, lv] = P.look, fwd = ray(lu, lv).normalize();
    const flat = new THREE.Vector3(fwd.x, 0, fwd.z).normalize();
    const hHalf = Math.min(lu, P.W - lu) / P.f, vHalf = Math.min(lv, P.H - lv) / P.f;
    rooms[id] = {
      id, group: g, mat, U, P,
      fit: aspect => 2 * THREE.MathUtils.radToDeg(Math.atan(Math.min(vHalf, hHalf / aspect) * .93)),
      /* k : avancée 0 → 1 dans la salle ; m : souris (léger flottement) */
      view(k, m) {
        const pos = g.position.clone().add(C).addScaledVector(flat, P.push * k);
        pos.y += (m ? m.sy * .03 : 0); pos.addScaledVector(new THREE.Vector3(-flat.z, 0, flat.x), m ? m.sx * .05 : 0);
        return { pos, look: pos.clone().addScaledVector(fwd, 10) };
      }
    };
  }
  return { group: G, rooms };
}

/* néon qui s'allume : quelques battements, puis la pleine lumière (k de 0 à 1) */
export function flicker(k) {
  if (k <= 0) return 0;
  if (k >= 1) return 1;
  const steps = [[.06, .85], [.13, .05], [.2, .55], [.3, .04], [.36, .9], [.42, .25], [.5, 1]];
  for (const [e, v] of steps) if (k < e) return v;
  return .82 + .18 * Math.min(1, (k - .5) / .3);
}
