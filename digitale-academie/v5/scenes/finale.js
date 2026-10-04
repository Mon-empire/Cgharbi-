/*
  FINAL · l'heure bleue, devant la porte
  On redescend devant le vrai pavillon (la photo prise devant l'entrée), au moment où le jour tombe.
  Les fenêtres s'allument, la porte se rouvre sur la lumière chaude ; le logo se détache du mur,
  grandit et entre dans la lumière : c'est une invitation. Symétrique de l'ouverture (nuit → jour).
*/
export async function create(ctx, el) {
  const { THREE, ss, eIO, eOut } = ctx;
  const G = new THREE.Group(); ctx.scene.add(G);
  const LU = {
    uTime: { value: 0 }, uReveal: { value: 0 }, uForm: { value: 1 }, uColor: { value: 1 }, uDisperse: { value: 0 }, uFade: { value: 1 },
    uPixel: { value: ctx.renderer.getPixelRatio() * 1.25 }, uOrigin: { value: new THREE.Vector3() }, uScale: { value: 1 }
  };
  const logo = new THREE.Points(ctx.logoGeo, new THREE.ShaderMaterial({ uniforms: LU, ...ctx.logoShader, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, fog: false }));
  logo.frustumCulled = false; logo.renderOrder = 10; G.add(logo);

  const V = ctx.real.viewpoint2, F = ctx.real.forward2;
  /* le logo se détache du mur, grandit, puis glisse dans la lumière de la porte ouverte et s'y dissout */
  const D = ctx.pavilion.door, DOORC = new THREE.Vector3(D.x, 1.15, D.z + .2);
  const FROM = ctx.real.logo, S0 = ctx.real.logoRadius / ctx.REACH;

  /* le texte arrive ligne à ligne, quand la porte s'ouvre */
  const lines = [...el.querySelectorAll('.v2-fin__t > span:not(.v2-badge), .v2-fin__t em, .v2-fin__t .v2-badge')];
  const after = [el.querySelector('.v2-fin__cta'), el.querySelector('.v2-fin__slogan')];
  const show = (node, k, dy = 26) => { node.style.opacity = k.toFixed(3); node.style.transform = `translate3d(0,${((1 - k) * dy).toFixed(1)}px,0)`; };

  return {
    group: G,
    cam(p, m) {
      /* au point de vue de la photo prise devant l'entrée, regard posé sur la porte ; on s'en approche doucement */
      const k = eIO(ss(0, 1, p));
      const pos = V.clone().addScaledVector(F, -1.2 + 1.3 * k).add(new THREE.Vector3(m.sx * .25, .1 + m.sy * .1, 0));
      const look = V.clone().addScaledVector(F, 12).add(new THREE.Vector3(0, .4, 0));
      return { pos, look, cut: 'finale', hard: true };   /* on arrive à travers le faisceau : coupe franche, jamais un vol au-dessus de la ville */
    },
    update(p, t) {
      const r = eIO(ss(.3, .82, p)), arc = Math.sin(Math.PI * r);
      LU.uTime.value = t; LU.uReveal.value = ss(.12, .28, p); LU.uFade.value = 1 - ss(.74, .9, p);
      LU.uOrigin.value.copy(FROM).lerp(DOORC, r); LU.uOrigin.value.y += .9 * arc; LU.uOrigin.value.z += .6 * arc;
      LU.uScale.value = S0 * (1 + 1.3 * arc) * (1 - .6 * r);
      lines.forEach((n, i) => show(n, eOut(ss(.42 + i * .06, .6 + i * .06, p)), 40));
      after.forEach((n, i) => n && show(n, eOut(ss(.66 + i * .06, .82 + i * .06, p))));
    }
  };
}
