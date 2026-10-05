/*
  La nuée de livres.
  Quand le papier peint de la salle d'étude s'efface, ses livres s'en arrachent et s'envolent : couvertures battantes
  comme des ailes, ils tournent dans l'atrium de la bibliothèque, toujours près de la caméra (c'est ce qui fait lire
  la profondeur), puis montent avec nous par la verrière.
  Trois maillages instanciés (couverture gauche, droite, bloc de pages) ; trajectoires calculées sur le processeur
  (quelques centaines de matrices par image).
*/
export function createFlock(ctx) {
  const { THREE, ss, library } = ctx;
  const N = ctx.mobile || ctx.level === 'LOW' ? 70 : 150;
  const C = library.center, TOP = library.TOP;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const PAL = ['#7A1F1F', '#8E3B22', '#2D4A6B', '#2F5B3A', '#6B4A1F', '#3A2A4E', '#9C7A3C', '#5A1A2A', '#1F3D4A', '#B08850'];

  const coverGeo = new THREE.BoxGeometry(.3, .018, .42).translate(.15, 0, 0);    /* charnière au dos (x = 0) */
  const pageGeo = new THREE.BoxGeometry(.07, .05, .4);
  const coverMat = new THREE.MeshStandardMaterial({ roughness: .6, metalness: .05, emissive: '#2a160a', emissiveIntensity: .6 });
  const pageMat = new THREE.MeshStandardMaterial({ color: '#F6ECD4', roughness: .9, emissive: '#FFE3A8', emissiveIntensity: .45 });
  const L = new THREE.InstancedMesh(coverGeo, coverMat, N), Rr = new THREE.InstancedMesh(coverGeo, coverMat, N), P = new THREE.InstancedMesh(pageGeo, pageMat, N);
  [L, Rr, P].forEach(m => { m.frustumCulled = false; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); });
  const G = new THREE.Group(); G.add(L, Rr, P); G.visible = false; ctx.scene.add(G);

  const col = new THREE.Color();
  const B = Array.from({ length: N }, (_, i) => {
    col.set(PAL[i % PAL.length]).multiplyScalar(rnd(.8, 1.25)); L.setColorAt(i, col); Rr.setColorAt(i, col);
    return {
      a0: rnd(0, 6.283), r0: rnd(3.4, 8.6), y0: rnd(1.5, TOP - 1), spd: rnd(.12, .3) * (Math.random() < .5 ? 1 : -1),
      bob: rnd(.6, 2.2), ph: rnd(0, 6.283), flap: rnd(7, 11), size: rnd(.85, 1.35), delay: rnd(0, .55),
      wall: new THREE.Vector3(rnd(-10.5, 10.5), rnd(.5, 2.6), -15.75)   /* place du livre sur le papier peint */
    };
  });

  /* orbite dans l'atrium : couches réparties sur toute la hauteur, rayon et altitude qui respirent */
  const orbit = (b, t, out, lift) => {
    const a = b.a0 + t * b.spd, r = b.r0 + Math.sin(t * .37 + b.ph) * 1.2;
    out.set(C.x + Math.cos(a) * r, b.y0 + Math.sin(t * .5 + b.ph) * b.bob + lift, C.z + Math.sin(a) * r);
    return out;
  };
  const p0 = new THREE.Vector3(), p1 = new THREE.Vector3(), mid = new THREE.Vector3(), pos = new THREE.Vector3(), nxt = new THREE.Vector3();
  const tgt = new THREE.Vector3(), tmp = new THREE.Matrix4();
  const m4 = new THREE.Matrix4(), rot = new THREE.Matrix4(), loc = new THREE.Matrix4(), sc = new THREE.Matrix4(), up = new THREE.Vector3(0, 1, 0);
  const at = (b, t, burst, lift, out) => {
    orbit(b, t, p1, lift);
    if (burst >= 1) return out.copy(p1);
    /* arrachement : du mur vers l'atrium par une courbe qui passe au-dessus de la tête */
    const k = Math.min(1, Math.max(0, (burst - b.delay) / (1 - b.delay))), e = k * k * (3 - 2 * k);
    mid.set(b.wall.x * .6, b.wall.y + 3.5, -19);
    p0.copy(b.wall);
    return out.copy(p0).multiplyScalar((1 - e) * (1 - e)).addScaledVector(mid, 2 * e * (1 - e)).addScaledVector(p1, e * e);
  };

  return {
    group: G,
    /* burst : 0 = livres encore sur le papier peint, 1 = envolés ; lift : montée vers la verrière ; calm : battements lents */
    update(t, { on, burst = 1, lift = 0, calm = 0 }) {
      G.visible = on;
      if (!on) return;
      for (let i = 0; i < N; i++) {
        const b = B[i];
        at(b, t, burst, lift, pos); at(b, t + .05, burst, lift, nxt);
        const k = burst >= 1 ? 1 : Math.min(1, Math.max(0, (burst - b.delay) / (1 - b.delay)));
        /* pas encore parti : le livre est à plat contre le mur, couvertures fermées */
        const dir = nxt.sub(pos);
        if (dir.lengthSq() < 1e-8 || k <= 0) dir.set(0, 0, 1);
        rot.lookAt(tgt.copy(pos).add(dir), pos, up);               /* le dos du livre suit la trajectoire */
        const s = b.size * (k <= 0 ? 0 : .6 + .4 * Math.min(1, k * 3));
        const beat = .5 + .5 * Math.sin(t * b.flap * (1 - .55 * calm) + b.ph);
        const phi = k <= 0 ? 0 : .18 + 1.05 * beat * (1 - .5 * calm);   /* ouverture des ailes */
        m4.copy(rot).setPosition(pos); sc.makeScale(s, s, s); m4.multiply(sc);
        loc.makeRotationZ(phi); L.setMatrixAt(i, tmp.copy(m4).multiply(loc));
        loc.makeRotationZ(Math.PI - phi); Rr.setMatrixAt(i, tmp.copy(m4).multiply(loc));
        P.setMatrixAt(i, m4);
      }
      L.instanceMatrix.needsUpdate = Rr.instanceMatrix.needsUpdate = P.instanceMatrix.needsUpdate = true;
    }
  };
}
