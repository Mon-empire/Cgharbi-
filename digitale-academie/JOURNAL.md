# Digitale Académie · « Le Fil » — journal de reprise

## Version 15 : nouvelle direction artistique (refonte radicale)

Retour de la Ville sur la v14 : « aucune direction artistique, moche dès le début ». Diagnostic : dix effets empilés,
des intérieurs modélisés au rendu de jeu vidéo (cafétéria, bibliothèque à damier, lanternes), un logo qui bave, du texte posé
n'importe où (jusqu'au titre caché par une tête).

**Direction : deux matières seulement. La vraie photographie, et la lumière dans le noir.** Une couleur signature (jaune),
le cyan pour le second coach. Ce qui est réel est photographique ; ce qui est merveilleux est lumière ; rien n'est modélisé
« à l'imitation » d'un lieu réel.

| | Avant (v14) | Maintenant |
|---|---|---|
| I Le seuil | façade dès la 1re image, logo posé sur le vrai logo, lignes jaunes | noir → un point → le logo → il se défait vers les fenêtres qu'il allume → la façade émerge → approche continue → porte |
| II Le lieu | cafétéria modélisée, fibre au sol | le noir : « 3 000+ » → « 600 m² » → « 2 », deux lucioles (une seule matière) |
| III La visite | 2 salles modélisées + 3 photos | les 3 vraies salles seulement ; 01 et 02 nommées en texte (pas de photo publiée) |
| IV Les savoirs | bibliothèque à damier | tour de lumière : un anneau par niveau, Licence et Bachelor côte à côte, DU à part |
| V Le chemin | escalier modélisé | le fil monte en spirale, 7 lumières |
| VI Les veilleurs | lanternes + titre derrière une tête | vraie photo plein cadre, titre lisible sur zone sombre, puis les listes |
| VII, VIII | — | conservés |

- Moteur réécrit (`main.js`), plus de pavillon / bibliothèque / nuée / abords (`world/` : `realfacade`, `photorooms`, `sky`).
- Typographie : cartons-titres centrés en début de chapitre (attribut `data-card`), bandeaux en bas à gauche avec filet jaune,
  un seul texte à la fois, jamais sur un visage.
- Démarrage : la première image est le noir (comme le film), avec un fil jaune qui respire ; plus d'affiche photo.
- Mondes séparés (salles, tour) : on y entre par une coupe dans le noir, jamais par un vol au-dessus du vide.

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
