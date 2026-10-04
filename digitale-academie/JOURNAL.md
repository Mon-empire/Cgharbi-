# Digitale Académie · « Le Fil » — journal de reprise

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
