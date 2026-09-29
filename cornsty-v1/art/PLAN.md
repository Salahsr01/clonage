# Plan de production : Cornsty V2, style « gouache brillante »

Style validé le 2026-09-29 : formes lisses et satinées, lumière et pinceau de gouache, dominante bleue, halo doré des ampoules, étincelles jaunes, couleurs de la charte. Image maîtresse : celle du propriétaire (mélange des styles 3 et 4).

**But (précisé par le propriétaire le 2026-09-29) :** améliorer la V1 avec des assets de grande qualité et des animations plus réalistes, en gardant un site **rapide**. La 3D reste dans l'atelier (Higgsfield + Blender) ; le site n'affiche que des images optimisées et des planches d'animation légères. Pas de moteur 3D dans le navigateur, pas de vidéo.

**Exigence ajoutée le même jour :** la qualité doit être époustouflante **sans que le site bugge**. Les deux tiennent ensemble : la qualité se fabrique à l'atelier, sans compromis ; le visiteur n'en reçoit que le résultat, à la bonne taille pour son appareil (section suivante).

**Retiré pour l'instant :** le vestiaire (merch : maillot, casquette, peluche, box, stickers) n'est pas refait. La V2 a trois stations : la machine, le comptoir, la caisse. Le vestiaire reste dans la V1.

## Le récit et la méthode (précisés par le propriétaire le 2026-09-29)

- **Le kiosque commence au plus bas, avec le minimum, dans le désert** : comptoir de planches, auvent rapiécé, une ampoule, une vieille machine, un panier, une caisse, un panneau. **La plage aux palmiers de l'image maîtresse est le rêve à atteindre.** Le désert est le point de départ visible ; le mirage de palmiers et de mer à l'horizon annonce le rêve. Le lien avec les paliers du Club (chaque palier fait pousser le kiosque vers la plage) est une piste naturelle, **à faire confirmer par le propriétaire avant de la construire**.
- **La planche de style de l'ancienne étape 1 est écartée** (« pas vraiment démonstratif »). La référence de style est l'image maîtresse et le brouillon du désert, validé (« c'est vraiment pas mal »).
- **Blender d'abord.** Le vrai logo, les 6 vrais pochons, le kiosque et **la Mouette modélisée à la main** se font dans Blender (scripts reproductibles dans `art/blender/`, zéro crédit). Higgsfield sert aux brouillons (le modèle le moins cher) et, seulement sur accord écrit et prix préchiffré, à des passes de style ou à des comparaisons (image → 3D).
- **Le 2K suffit** (2048 × 1152 pour les images de scène). Pas de 4K ni de 8K : le propriétaire l'a dit, et c'est aussi ce qui garde le site léger. Les mentions de 4k plus bas sont des plafonds d'origine, remplacés par ce choix.
- **Rendu** : Cycles (lumière réelle, débruitage), puis une finition en code (lueur dorée, étoiles jaunes à quatre branches, dominante chaude et ombres froides, grain de pinceau). Limite connue : c'est du 3D lissé avec finition peinte, pas de la vraie peinture ; une passe de style est possible si le propriétaire la veut.

**Règles.** Chaque étape demande l'accord écrit du propriétaire avant de passer à la suivante et avant toute génération. Prix exact préchiffré avant chaque lancement, tout est noté dans `LEDGER.md`. La V1 ne change pas : la V2 se construit dans une copie et la remplace seulement après validation. Textes, logo et emballages exacts sont posés par-dessus en code, jamais générés.

## Qualité époustouflante sans faire bugger le site

**À l'atelier : aucun compromis**

- Rendu en 2K (2048 × 1152), demande du propriétaire : Cycles pour la 3D (gratuit), et pour les générations Higgsfield le palier 2k (GPT Image 2.5 haute 2,75 ; Nano Banana Pro 2). Le 4k (4,25 à 7 crédits l'image, préchiffré) reste possible pour une image maîtresse si le propriétaire le demande. Les originaux restent dans l'historique Higgsfield (identifiants de job notés dans `LEDGER.md`) ; le dépôt ne garde que les versions optimisées.
- Animations faites dans Blender selon les vrais principes (anticipation, rebond, pièces qui suivent le mouvement, clignements, respiration), pas des boucles mécaniques.
- Un essai avant chaque série : la Mouette posée sur le décor peint, avec la lumière de la scène, montrée au propriétaire avant de produire les planches.
- Textes, logo et emballages posés en code : nets à toutes les tailles.

**Sur l'appareil du visiteur : le site ne bugge pas**

- Trois niveaux de qualité (haute, standard, légère), choisis au démarrage d'après la taille et la densité de l'écran, la mémoire, le nombre de cœurs, le mode économie de données et le gardien de performance du kiosque vivant. Net partout, lourd nulle part : la 4k n'est servie qu'aux grands écrans qui en ont l'usage.
- Mémoire : une image décodée pèse bien plus que son fichier (2560 × 1440 ≈ 15 Mo en mémoire). On ne garde décodées que la station affichée et la suivante (environ 60 à 80 Mo au plus) et on libère le reste : c'est la première cause de plantage sur téléphone.
- Une seule lumière est chargée à la fois (celle de l'heure du visiteur). Halos des ampoules, étincelles, brume et pluie sont dessinés en code par-dessus les images : nets à toutes les tailles, presque sans poids.
- Affichage progressif : version légère tout de suite, version nette dès qu'elle est prête, en fondu et sans saut. Décodage anticipé avant l'affichage pour éviter les à-coups. WebP ou AVIF, choisis à la mesure (le temps de décodage compte autant que le poids sur un téléphone faible).
- Animations : planches d'images pour les gestes complexes ; pièces découpées animées par code pour la respiration, les clignements, la tête qui suit le curseur (fluide et léger). L'essai de l'étape 2 tranche entre les deux, ou les combine.
- Repli : image fixe si l'appareil est faible ou si un fichier manque, « version simple » instantanée, interrupteur d'arrêt par couche (comme dans le kiosque vivant).
- La V1 reste intacte ; la V2 se construit dans une copie ; retour à la V1 en un clic tant que la recette n'est pas signée.

**Budget de vitesse** (mesuré dans Chromium avec processeur et réseau bridés) :

- Premier écran utilisable : moins de 1,5 Mo de téléchargement.
- Site complet chargé au fil de l'eau, par station : moins de 10 Mo au total.
- Cible de fluidité : au moins 50 images par seconde avec un processeur ralenti ×4 (téléphone moyen simulé).
- « Version simple » instantanée.

## Étapes

| # | Étape | On produit | Outils | Crédits (estimation) | Le propriétaire valide |
|---|---|---|---|---:|---|
| 1 | ~~Bible de style~~ → **le lieu de départ (désert)** | ~~planche de style~~ (écartée, 2 crédits dépensés) ; à la place : brouillon du désert (0,25 cr, validé), puis scène Blender finale en 2K avec le vrai logo, les vrais pochons et la Mouette modélisée (0 cr) | GPT Image 2.5 (brouillon), Blender | 2,25 dépensés | l'image finale du désert |
| 2 | La Mouette | fiche de rotation 4 vues, objet 3D (essai Tripo 9 contre Meshy 7 à 38), squelette et animations dans Blender (bibliothèque de mouvements + les miens), rendu en planches d'images : repos, parle, salue, montre à gauche et à droite, sert, lance, attrape, fête, surprise, coquine, dort, marche, surf | GPT Image 2.5, Tripo, Meshy, Blender | 70 à 170 | la Mouette immobile, l'essai sur le décor, puis chaque lot d'animations |
| 3 | Le décor peint | plans du comptoir, de la machine et de la caisse en 4k, calques de parallaxe, 4 lumières (jour, doré, coucher, nuit) | GPT Image 2.5 (haute, 4k), Nano Banana Pro, agrandissement | 90 à 220 | les plans, puis les lumières |
| 4 | Le décor vivant | météo, 5 fêtes en calques, soleil, lune, nuages, voilier, crabe, palmiers, panneau de drop, enseigne, décor de palier | GPT Image 2.5, Nano Banana Pro | 40 à 100 | par famille |
| 5 | Pop-corn et machine | grains de pop-corn rendus en 3D, machine (repos, chauffe, éclate), pochon (rempli, scellé, lancé), étincelles, cœurs, confettis | Tripo, Blender, images | 30 à 80 | les planches |
| 6 | Les produits | 6 pochons (emballages exacts), cartes produit, carte à tampons, 9 badges, 4 emblèmes de palier | Nano Banana Pro, GPT Image 2.5 | 50 à 120 | par famille |
| 7 | L'interface | panneaux, boutons, bulles, icônes, écran d'intro | images + code | 30 à 70 | la maquette de chaque écran |
| 8 | Le son (option) | effets, ambiances, voix de la Mouette (ElevenLabs v4) | à chiffrer | à chiffrer | les échantillons |
| 9 | Le site V2 | voir plus bas | code | 0 | démo à chaque jalon |
| 10 | Tests de vitesse et bascule | budget respecté, parcours complets, repli sur la V1 | Playwright | 0 | la recette |

Estimation totale (revue le 2026-09-29 après préchiffrage du palier haut) : environ 310 à 780 crédits sur 3 996, soit 8 à 19 %. Plafond de chaque étape = le haut de sa fourchette ; plafond global de la V2 : 800 crédits, jamais franchi sans accord écrit. Ces chiffres datent d'avant le passage à Blender et au 2K : ils sont un plafond, pas une prévision, et seront rechiffrés avec l'étape suivante (la 3D faite dans Blender ne coûte rien). Dépensé à ce jour : 6,25 crédits (voir `LEDGER.md`).

## Le site V2 (ce que je construis)

1. Copie améliorée de la V1, même moteur : chat, panier, caisse, Club, kiosque vivant. La V1 reste intacte.
2. Décor en calques avec parallaxe et caméra par stations (bureau, tablette, mobile).
3. Mouette animée avec les planches et les pièces animées par code : boucles, gestes, transitions douces, synchronisée avec le chat, repli image fixe.
4. Lumière selon l'heure du visiteur, météo, fêtes et déco du palier branchées sur le kiosque vivant.
5. Show pop-corn refait avec les nouveaux grains, la machine et le pochon.
6. Interface repensée sur tous les écrans.
7. Chargement par station, trois niveaux de qualité, formats modernes, budget de poids et de mémoire, repli si l'appareil est faible.
8. Tests : parcours a à d et mobile, captures, vitesse, accessibilité.
9. Démo hébergée, documentation, registre des crédits, page de crédits d'auteur.

## Preuves avant la bascule (étape 10)

1. Poids et nombre de requêtes du premier écran et de chaque station (moins de 1,5 Mo, puis moins de 10 Mo au total).
2. Fluidité : images par seconde pendant les mouvements de caméra, les gestes de la Mouette et le show pop-corn, avec processeur ralenti ×4 puis ×6.
3. Réseau : 4G puis 3G simulées, et coupure en plein chargement (repli en image fixe, aucune erreur visible).
4. Mémoire : 20 allers-retours entre les stations, tas JavaScript stable et nombre d'images décodées borné.
5. Zéro erreur, zéro avertissement, zéro promesse rejetée dans la console.
6. Captures côte à côte des trois niveaux de qualité : la différence entre haute et standard reste discrète, la légère reste belle.
7. Parcours a à d et mobile de la V1 repassés à l'identique sur la V2.
8. Accessibilité : mouvement réduit, clavier, version simple.

Les résultats sont donnés tels quels, avec les chiffres, y compris ceux qui ratent la cible.

## Risques et limites

- Le squelette automatique de Meshy est fait pour des humanoïdes : la Mouette peut demander un squelette fait à la main dans Blender. L'essai de l'étape 2 tranche.
- Mélanger une Mouette rendue en 3D et un décor peint demande un réglage de lumière et de texture pour qu'ils se marient : je te montre l'essai avant de produire en série. Si le mariage échoue, plan B : la Mouette peinte en images (mêmes références) et animée en pièces découpées, comme dans la V1 mais dans le nouveau style.
- Les calques de parallaxe à partir d'images générées sont délicats (calques propres qui se superposent). Deux voies : découpe assistée (`image_decompose`, préchiffrage à refaire) ou génération par plans. En cas d'échec : parallaxe à deux plans, moins riche mais plus légère.
- Je ne peux pas tester sur de vrais téléphones : les mesures se font dans Chromium avec processeur et réseau bridés. Paiement réel et serveur de commandes : comme dans la V1.
- Deux références de style portent une signature d'artiste (voir `LEDGER.md`) : on les crédite ou on s'éloigne de leur signature.
