/*
  TERRITOIRE · « Nous trouver » — le vrai Montereau-Fault-Yonne, en 3D réelle (plus aucune maquette)
  On sort par la verrière de la bibliothèque : la photo se dissout dans le ciel. En contrebas, la ville réelle — le modèle
  numérique de surface de l'IGN (bâtiments, arbres, coteau) habillé des orthophotographies 0,5 m et 0,2 m — à l'heure dorée.
  Survol à la manière d'un globe virtuel : la ville entière, le confluent de la Seine et de l'Yonne, la collégiale ;
  le fil d'or s'élance du confluent et remonte le coteau jusqu'au pavillon (1 rue Honoré de Balzac), sous son faisceau ;
  on tourne autour du pavillon pendant que l'adresse s'affiche, puis on plonge dans le faisceau (relais du final).
  Données : IGN (Licence ouverte Etalab 2.0) ; noms des lieux © contributeurs OpenStreetMap (ODbL).
*/
export async function create(ctx, el) {
  const { THREE, ss, eOut, shot } = ctx;
  const aerial = ctx.aerial;
  const G = new THREE.Group(); G.visible = false;   /* rien de modélisé : le monde, c'est la vraie ville */
  const head = el.querySelector('.v2-terr__head'), list = el.querySelector('.v2-terr__list'), credit = el.querySelector('.v2-terr__schema');
  const reveal = (n, k, dy = 24) => { if (!n) return; n.style.opacity = k.toFixed(3); n.style.transform = `translate3d(0,${((1 - k) * dy).toFixed(1)}px,0)`; n.style.pointerEvents = k > .5 ? '' : 'none'; };
  const K = p => ss(0, .97, p);
  return {
    group: G,
    cam(p, m) {
      const c = aerial.cam2(K(p));
      c.pos.x += m.sx * 1.5; c.pos.y += m.sy;
      return { ...c, cut: 'ciel', hard: true, fov: innerWidth < innerHeight ? 62 : 48 };
    },
    update(p, t, dt, m, isCurrent) {
      const k = K(p);
      aerial.terr(k, t, true);
      /* la sortie par la verrière : la dernière image de la bibliothèque se dissout dans le ciel doré */
      const out = 1 - ss(.01, .1, p);
      if (out > .001) shot.show({ a: 'b15', pa: { at: [.5, .28], zoom: 1.45 + .4 * (1 - out), dolly: .5, d0: .25, focus: .3, dof: .1 }, fade: out, warm: .6, expo: 1 + .5 * (1 - out), rays: .5, sun: [.5, -.2], vig: .5, lift: .3 }, t, isCurrent);
      reveal(head, eOut(ss(.12, .22, p)) * (1 - ss(.56, .64, p)));
      reveal(list, eOut(ss(.68, .78, p)) * (1 - ss(.93, .98, p)));
      if (credit) credit.style.opacity = (ss(.1, .2, p) * (1 - ss(.95, 1, p))).toFixed(3);
    },
    rest() { aerial.terr(0, 0, false); }
  };
}
