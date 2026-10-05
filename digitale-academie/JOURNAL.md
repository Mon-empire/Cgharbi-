# Digitale Académie · « Le Fil » — journal de reprise

> **5 octobre 2026 — retour à la v14 à la demande de la Ville.** La v15 (« photographie et lumière dans le noir ») a été
> refusée ; elle reste dans l'historique git (commit 1527f31) mais n'est plus en ligne. Code remis tel quel, sans retouche.

## Version 14.8 (5 octobre 2026) : retour à la bibliothèque 3D, la vraie ville au détail près, « 600 m² »
Retour de la Ville : la bibliothèque photographique (14.7) est refusée → **retour à la bibliothèque 3D précédente**
(Formations, Parcours, Accompagnement), avec finitions seulement (niveau en filigrane discret, liste sur panneau de verre,
mobile : un soutien à la fois). Photos Peabody et `depthshot.js` retirés de la livraison (restent dans l'historique git).

**La ville, 2 km autour du pavillon** (`build/ign/ville3d.py`, `bati_compact.py`, `route.py` via GitHub Actions ;
`v5/assets/ville/`) : 6 883 bâtiments BD TOPO extrudés à leur emprise exacte, toits relevés dans le MNS LiDAR (pignons,
terrasses) puis simplifiés (contours préservés) ; sol nu RGE ALTI sous les bâtiments, MNS ailleurs (arbres, ponts, talus) ;
orthophotos 0,5 m (anneau) et 0,2 m (cœur, Surville) ; murs d'enduit clair (aucune matière inventée) ; eau : reflet du
ciel et scintillement du soleil. Vol relevé à 70 m au-dessus des arbres et toits (150–200 m sur les quartiers).
Fil d'or de « Nous trouver » : plus court chemin OSM du pont de Seine à la rue Honoré de Balzac. Repère « Surville »
retiré (position non sourcée).

**II · Le lieu, « 600 m² »** : les 3 000 points se rangent en 30 × 20 cases d'un mètre carré ; la fibre les relie en
vague, le compteur monte jusqu'à 600 ; chiffre et légende centrés sous la surface ; les lucioles s'en détachent.

## Version 14.7 (5 octobre 2026) : vraie 3D de Montereau, vraie bibliothèque, clarté
Retour de la Ville : « niveau médiocre », pas reconnaissable, pas cinématographique, intérieur confus, bibliothèque sous-exploitée,
survol final « pas mon trop », mobile difficile. Feu vert sur tous les outils ; pas de clé Google (alternative gratuite demandée).

**Données (GitHub Actions, l'environnement de développement n'atteint pas l'IGN, Wikimedia ni Overpass)**
- `.github/workflows/ign-montereau.yml` → `build/ign/build.py` : MNS IGN (`ELEVATION.ELEVATIONGRIDCOVERAGE.HIGHRES.MNS`,
  bâtiments et arbres compris) 2 m sur 3 × 3 km et 1 m sur 800 × 800 m autour du pavillon, orthophotos 0,5 m et 0,2 m
  (`v5/assets/ign/`). `build/ign/lieux.py` : noms et positions réels d'OpenStreetMap (`lieux.json`).
- `.github/workflows/biblio.yml` → `build/biblio/fetch.py` (inventaire Commons) puis `photos.py` : 16 photos retenues de la
  George Peabody Library (la bibliothèque du papier peint de la salle d'étude) en 3840 px + carte de profondeur estimée
  (Depth Anything V2 Small). Licences : Carol M. Highsmith (domaine public), Patrick Gillespie (CC BY 2.0),
  Matthew Petroff (CC BY-SA 3.0) — voir `build/biblio/out/choix.json`.
- Poussée des workflows robuste (rebase et nouvelle tentative), `concurrency: data-push`.

**Ouverture** (`world/aerial.js`) : la vraie surface IGN remplace le relief SRTM + bâtiments OSM dans 3 × 3 km (une dalle par
orthophoto, jupe aux raccords ; murs = teinte moyenne du voisinage, aucune matière inventée ; ombres longues du MNS).
Nouveau vol : nuages → piqué sur la vieille ville → ras de l'Yonne, collégiale, confluent, pont de Seine → remontée du coteau
boisé de Surville (battements) → plateau → pavillon. Garde de 22 m au-dessus de la surface réelle. Repères projetés :
Montereau-Fault-Yonne, Collégiale Notre-Dame et Saint-Loup, L'Yonne, La Seine, Digitale Académie.

**Bibliothèque** (`world/depthshot.js`) : photo + profondeur = plan de cinéma (grue, travelling avant, mise au point,
rayons de la verrière, fondu par la profondeur) ; calque 2D (fil, repères) projeté avec la même transformation.
- IV Formations (élévation de face, P. Gillespie) : un étage = un niveau (DAEU salle de lecture, BTS 1re galerie, Licence et
  Bachelor côte à côte à la 2e, Master 3e, DU 4e) ; le fil monte une colonne et allume la rambarde ; panneau d'ascenseur ;
  une seule fiche lisible reliée à son étage ; plan final : toute l'élévation allumée.
- V Parcours (nef, M. Petroff) : sept stations sur l'axe jusqu'à la verrière, travelling avant ; 7e étape sous la verrière.
- VI Accompagnement : la rupture photo réelle (inchangée), puis lanternes de papier qui quittent les tables de lecture, les
  deux coachs en lucioles ; plus d'étiquettes doublées (la liste des ateliers nomme la lanterne active).
- Le papier peint de la salle d'étude brûle sur la vraie bibliothèque (plus de bibliothèque modélisée à l'image).

**VII Nous trouver** : la vraie ville en 3D (plus de maquette) : survol à la manière d'un globe virtuel, repères (gare,
collégiale, rivières, Surville), fil d'or du confluent au pavillon, faisceau, plongée dans le faisceau (relais du final).

**Clarté** : « Le lieu » — un chiffre à la fois (le sortant s'efface avant que l'autre n'entre), légende de « 3 000+ » sous
le chiffre de lumière. Marques « à valider » discrètes par défaut + bouton « Relecture · N » qui les déplie. Crédits en bas,
sur une ligne. Mobile : une fiche à la fois, ateliers nommés en haut, note de relecture masquée.

## Version 14.6 (5 octobre 2026) : les intérieurs en photographie
Plus aucune pièce du pavillon modélisée à l'image (`world/backdrop.js` : photo plein cadre attachée à l'œil, travelling
avant lent, fondu enchaîné, néons, dissolution ; la nuée, les lucioles et les livres restent au-dessus).
- **II · Le lieu** : l'accueil en photographie, « 3 000+ », la fibre et les deux lucioles par-dessus.
- **III · La visite** : accueil → salle informatique (vraie photo de la Ville, `etudiants-1.jpg`) → les trois vraies
  salles en volume (inchangées) → la vraie salle d'étude, dont le papier peint de bibliothèque se consume vers la bibliothèque.
- **Accueil = image générée** (Gemini 3 Pro Image via ElevenLabs, d'après les photos des vraies salles : même sol rouge,
  mêmes cloisons, même plafond ; `assets/img/accueil-genere.jpg`), à la demande du commanditaire faute de photo de
  l'accueil. Badge « image générée · à valider » affiché aux chapitres II et III. **À remplacer par une vraie photo.**
- Salle informatique : la photo montre des étudiants reconnaissables → badge « droit à l'image à valider » étendu.
- Une salle informatique générée était prévue : quota d'images ElevenLabs épuisé (plan gratuit), Canva ne livre que des
  vignettes signées, Weave (Figma) non relié ; la vraie photo la remplace, ce qui est plus juste.

## Version 14.5 (5 octobre 2026) : plus de 3D sur le bâtiment à l'ouverture
- Vol : les volumes OSM ne sont plus affichés (ils ne servent qu'à projeter leurs vraies ombres sur la photo IGN) ;
  la fin du vol reste au-dessus du pavillon (105 m), regard plongeant sur la photo IGN à 0,32 m/pixel, puis le piqué.
- Porte : plus de vantaux modélisés (verre et aluminium). La porte s'ouvre **dans la photo** : fondu vers
  `assets/img/facade-2023-ouverte.jpg`, la photo 2023 de la Ville dont seule l'embrasure a été retouchée (portes
  ouvertes, lumière chaude ; retouche générée par Gemini 3 Pro Image via ElevenLabs, recalée au pixel près par
  SIFT + homographie, erreur 1,1 px, et incrustée avec un masque adouci : tout le reste est la photo d'origine).
  **À valider par la Ville** (photo retouchée). Le pavillon modélisé n'est plus visible derrière la porte depuis dehors.
- Reste en 3D : l'intérieur du chapitre II « Le lieu » et le début de la visite (accueil, salle informatique).

## Version 14.4 (5 octobre 2026) : l'heure dorée (brief « jeu AAA »)
Brief demandé : rendu cinématique de jeu AAA, heure dorée, ombres longues et douces, poussière volumétrique, netteté.
Appliqué à l'ouverture **sans rien inventer** (pas de pierres ni de briques : le pavillon et Surville sont modernes).
- Soleil couchant à l'ouest, 10° au-dessus de l'horizon. **Ombres réelles** : carte d'ombre (4096×2048, 2048×1024 sur
  mobile) rendue une fois au chargement à partir du relief et des 6 003 bâtiments ; filtrage doux (PCF 5×5 / 3×3).
  Les tours de Surville projettent leurs ombres sur des centaines de mètres.
- **Rayons volumétriques** : le voile atmosphérique est calculé le long du regard à travers la carte d'ombre
  (14 / 10 / 6 pas selon la qualité) : l'air à l'ombre des tours reste sombre, l'air au soleil s'embrase.
- Étalonnage « heure dorée » : ombres bleutées, lumières ambrées ; ciel et nuages dorés côté soleil.
- **Poussière en suspension** (points doux, diffusion vers l'avant) dans le ciel et dans l'allée ; plus brillante en
  regardant vers la lumière (la porte, dans l'allée).
- L'allée passe à la même lumière (teinte dorée, presque plus de nuit) ; image plus nette à l'ouverture
  (accentuation légère, plus de halo « rêve »).

## Version 14.3 (5 octobre 2026) : le vrai Montereau vu du ciel
La maquette de lumière ne sert plus à l'ouverture (elle reste au chapitre VII). L'oiseau survole la **vraie ville** :
- **Orthophotographies IGN** (BD ORTHO, Licence ouverte Etalab 2.0), trois niveaux emboîtés : la région à 5,3 m/pixel,
  la ville survolée à 0,9 m, les abords du pavillon à 0,32 m (`assets/img/aerien-*.jpg`, versions `-m` pour mobile).
  L'environnement de travail n'a pas accès à `data.geopf.fr` : les tuiles WMS ont été récupérées par le connecteur
  ElevenLabs (import d'URL), sans retouche. Requêtes : `build/aerien.py` (emprises EPSG:3857 en tête du fichier).
- **Relief réel** (AWS Terrain Tiles : SRTM, EU-DEM ; zoom 14, grille de 12 m) : le plateau de Surville à 119 m,
  la Seine et l'Yonne vers 45 m. **6 003 bâtiments OpenStreetMap** à leur hauteur, toits pris dans la photo IGN,
  façades teintées par la photo ; recalage vérifié sur la photo à 0,32 m (le pavillon en U tombe exactement).
- **Direction artistique : le matin.** Soleil levant au nord-est, devant l'oiseau ; voile atmosphérique qui bleuit le
  lointain et s'embrase vers le soleil ; on commence au-dessus d'une couche de nuages, on la traverse.
- **Le vol** (temps égal par étape) : nuages au-dessus de la vieille ville → la Seine → le confluent → le coteau boisé
  de Surville → les tours → virage au nord du pavillon → piqué vers la cour, le pavillon au centre de l'image → coupe
  (fondu au noir) sur la vraie photo de l'allée. Le plan-séquence de l'allée garde ses durées ; il commence à l'aube
  (et non plus en pleine nuit) pour rester dans la même lumière.
- Crédit des sources affiché pendant le vol. Affiches de démarrage refaites.
- Code : `world/aerial.js` ; données : `assets/data/aerien.json` (relief en décimètres, bâtiments) ; `scenes/terr.js` revenu à la v14.

## Version 14.2 (5 octobre 2026) : le son du vol
- Sons générés (ElevenLabs, effets sonores) : `vent.mp3` (boucle), `aile.mp3` (un coup d'aile), `plongee.mp3`, `atterrissage.mp3`.
- Toujours **à la demande** (bouton « Activer le son ») : le vent monte avec la vitesse et s'éclaircit dans la plongée,
  la musique se retire de moitié derrière lui ; chaque abattée des ailes à l'écran déclenche un coup d'aile (hauteur
  et niveau variés) ; un souffle pour la plongée, des battements de freinage à l'atterrissage.
- Le corps de l'oiseau porte l'œil : légère montée à chaque abattée, léger roulis.
- Plongée : flou de vitesse radial (net au centre).
- **Bloqué** : la vraie vue aérienne de Montereau (orthophotos IGN 20 cm + relief LiDAR HD, licence ouverte Etalab)
  demande l'accès réseau à `data.geopf.fr`, refusé par l'environnement de travail actuel.

## Version 14.1 (5 octobre 2026) : l'ouverture « on est l'oiseau »
Seule l'ouverture (chapitre I) change ; le reste de la v14 est intact.
- **Lignes jaunes de la façade retirées** (arêtes « photo → espace »). Le fil au sol de l'allée reste (version d'origine).
- **Vue subjective d'un goéland** (l'oiseau de la Seine et de l'Yonne) : on descend du ciel de nuit au-dessus de la
  vraie ville (maquette OSM + relief EU-DEM du chapitre VII, éclairage public atténué, faisceau court sur le pavillon
  pour cap), on plonge dans la neige (fondu au noir, jamais de blanc), on ressort au ras de l'allée réelle (le
  plan-séquence d'hiver → automne de la v14), on freine ailes hautes devant la porte, on se pose, les ailes se replient
  **avant** que le slogan ne monte (lisibilité d'abord).
- **Ailes** (`world/wings.js`) : texture photoréaliste d'une aile de goéland argenté (`assets/img/aile-goeland.png`,
  image générée puis détourée — c'est un oiseau générique, pas une photo du lieu), posée sur deux pièces articulées
  (bras, main) par aile ; plané, battements, freinage, repli ; léger flou de mise au point ; placement adapté aux
  écrans en hauteur. Comme une caméra embarquée sur le dos : en plané les ailes restent au bord du cadre, elles y
  entrent à chaque relèvement.
- Neige qui file (traînées d'un pixel, bleutées), attachée à l'œil.
- Chapitre I plus long (5,2 écrans au lieu de 3,4) : 43 % pour le vol, le reste garde les durées de la v14.
- Affiches de démarrage refaites (la première image est maintenant la ville de nuit).
- Correctif moteur : pas de temps négatif impossible (`dt` borné à 0) — il faisait diverger la caméra sur mobile.

## Version 14 (4 octobre 2026) : « Director's cut », première passe

### P0 · le flash blanc (cause trouvée, corrigée)
- **La frame blanche** : héro p ≈ 0,25 → 0,43, uniforme `uWhite` de la passe fx à 1 (« bourrasque de neige »), couleur
  (0,9 ; 0,93 ; 0,97). Elle servait à cacher le saut de caméra entre la photo d'hiver 2019 (loin) et la photo d'automne 2023
  (devant l'entrée). Or les deux photos sont recalées sur **les mêmes volumes** : la caméra vole maintenant de l'une à
  l'autre (courbe Catmull-Rom), la saison se fond (`season()`), la neige devient rafale puis feuilles. Aucune coupe.
- **Deux autres quasi-blancs** : l'intérieur surexposé à l'ouverture de la porte (lumière ponctuelle à 38 + néons + bloom)
  et le « voile doré » vers le final (1 ; 0,84 ; 0,55). Le premier : pavillon dans la pénombre, la lumière chaude est la
  nuée des 3 000 points qui attend dans l'embrasure ; le faisceau additif s'efface de près (on le traversait : voile laiteux).
  Le second : ambre profond (0,5 ; 0,33 ; 0,1), coupe franche au cœur du voile.
- **Démarrage continu** : un script en ligne (dans le bloc) décide avant le premier rendu si la 3D va tourner ; si oui, mise en
  page vivante immédiate + **affiche** `assets/img/seuil-poster(-portrait).jpg` = la première image rendue par le moteur
  (générée par `build/affiche.mjs`, à régénérer si l'étalonnage de l'ouverture change). Shaders compilés avant la première
  image ; la toile apparaît par-dessus une image identique ; plus de fondu depuis le noir. Secours : si le moteur ne
  répond pas en 30 s, retour à la page éditoriale. Vérifié en temps réel (luminance moyenne ≈ 26/255 de bout en bout).

### Seuil
- Plan-séquence hiver → automne, puis porte, nuée, intérieur (voir P0).
- **Photo → espace** : les arêtes des volumes recalés (les vraies lignes de la façade) se tracent en lumière jaune depuis la
  porte à l'aube, prolongent l'architecture dans la profondeur, puis s'effacent quand la caméra entre dans l'image.

### Accompagnement
- Rupture : la 3D s'éteint, vraie photo (`etudiants-1.jpg`), « Tu n'étudies pas seul » passe **derrière** l'étudiante du
  premier plan (même photo détourée par un polygone), deux fils de lumière jaune et cyan (les deux coachs) traversent la
  salle, la musique se retire. Puis les lanternes. **Photo marquée `data-da-droits="A_VALIDER"` + badge** : à retirer en
  production tant que l'autorisation n'est pas confirmée (la section fonctionne sans elle).

### Formations
- Survol ou focus clavier d'une formation : son lutrin s'allume, la caméra y jette un regard ; clic : la caméra suit le fil
  jusqu'à elle (existant). La liste reste l'index lisible.

### Son — CONTRADICTION À ARBITRER
- Kit précédent : « son obligatoire, activé par défaut, démarre au premier geste ». Nouveau brief : « aucun son automatique non
  sollicité ». Le premier clic n'importe où démarrait la musique : c'est du son non sollicité. **Appliqué : le nouveau brief**
  (bouton « Activer le son » qui invite discrètement, choix mémorisé). Pour revenir à l'ancien comportement :
  `core/prefs.js`, `sound()` → `get('da-sound') !== '0'`.

### Non fait (honnêtement)
- Photogrammétrie / Gaussian splatting : impossible avec 2 photos de façade et 3 de salles (et sans réseau vers les modèles
  d'estimation de profondeur ici). La projection photographique recalée reste la méthode fidèle.
- Les passages entre vraies salles restent des coupes au noir motivées (néons qui s'éteignent / se rallument).
- KTX2 / Draco : sans objet (pas de modèles glTF ; quelques JPEG).

## Version 13 (4 octobre 2026) : « Le lieu » et « La visite » élevés

### II · Le lieu — les chiffres prennent corps
- On entre dans un pavillon **éteint**. Par la porte ouverte arrivent **3 000 points de lumière** (un par formation : l'Université vient à toi). Ils passent par-dessus l'épaule et se rassemblent en « 3 000+ » au milieu de la cafétéria.
- Ils tombent au sol et deviennent **la fibre** : un réseau de lignes qui court sous tout le plan du pavillon, avec des impulsions qui partent de la porte → « 600 m² connectés à la fibre ».
- Deux points se relèvent : **les deux coachs**, deux lucioles jaune et cyan (les mêmes que dans VI · Les veilleurs).
- Les **néons s'allument** en battant (son de starter + bourdonnement 100 Hz, synthétisé en WebAudio) : la visite commence.
- Texte : un seul chiffre à la fois, en bas à gauche ; « 3 000+ » est écrit par les points, le nombre reste dans le DOM pour les lecteurs d'écran.
- Chiffres : uniquement ceux de la page (3 000+, 600 m², 2). Le réseau de fibre est une image (tracé orthogonal sur la reconstitution), pas un plan réel du câblage.

### III · La visite — des salles modélisées aux vraies salles
- Cafétéria → salle informatique (reconstitution 3D, inchangée), puis **les néons s'éteignent**.
- Salles **Frida Kahlo**, **Nelson Mandela**, **salle d'étude** : les photos de la Ville sont **projetées en volume** (même principe que la façade) : à l'arrêt on voit la photo, en avançant on entre dedans. Chaque salle s'allume au néon, on y avance, elle s'éteint, coupe dans le noir.
- Correction : `kahlo.jpg` et `mandela.jpg` sont des photos de salles entières ; la v12 les collait comme « portraits » plats sur un mur (une salle dans la salle).
- Dernière coupe : la salle d'étude modélisée, **lampes de bureau seules**, face au papier peint qui s'efface → bibliothèque (moment conservé).
- Crédit mis à jour + badge « droit à l'image à valider » (deux personnes de dos sur la photo de la salle d'étude).
- Crédit « Photo de fond » du chapitre VI retiré : aucune photo n'y est affichée.

### Moteur (`main.js`)
- `uBlack` (voile noir) dans la passe fx ; `cam()` peut renvoyer `fov`, `cut` et `hard` → coupe franche (la caméra saute, ne traverse jamais le vide entre deux mondes).
- `ctx.ambient(k)`, `ctx.bloom`, `ctx.fx`, `pavilion.power(k)` (néons, plafonds, écrans).
- Dehors / dedans au **franchissement réel de la porte** (position caméra), plus à un pourcentage : on ne voit plus la photo de façade « de dos » (voile blanc à l'entrée en v12).
- Un chapitre peut exposer `rest()` : appelé quand il n'est plus à l'écran.

### Recalage des photos de salles
- `world/photorooms.js` contient les paramètres ; `build/recalage-salles.py` + `build/salles/*.json` permettent de les vérifier (arêtes des plans superposées à la photo + carte de profondeur).
- Kahlo : point de fuite (930, 689), focale ≈ 2000 px, tangage −6°. Mandela : même appareil, point de fuite du mur peint (2200, 670), angle (1240, 306), bureau à 0,75 m. Salle d'étude : verticales redressées (décentrement) → axe horizontal, horizon y = 78, focale ≈ 1030 px ; modèle en trois couches (sol, rangée de bureaux, fond à 7,2 m).

### Banc d'essai
`build/banc-essai.mjs` : Chromium sans écran (SwiftShader), three/lenis/opentype servis en local, captures à des points précis du film :
```
cd build && npm i three@0.169.0 lenis@1.1.13 opentype.js@1.3.4 playwright
Q=LOW N=40 node banc-essai.mjs captures/a "lieu:.42,campus:.4" 1280 800
```

## À faire
- Tester sur un vrai téléphone et en lecture continue avec le son (le son de néon est nouveau).
- Faire valider : noms des salles, phrases éditoriales, droit à l'image de la photo de la salle d'étude.
- Demander à la Ville des photos de l'accueil / cafétéria et de la salle informatique (sans personnes reconnaissables) : elles pourraient rejoindre les vraies salles en volume.
- Intégration WordPress (thème Stratis ou extension).
