# Plan de production : Cornsty V2, style « gouache brillante »

Style validé le 2026-09-29 : formes lisses et satinées, lumière et pinceau de gouache, dominante bleue, halo doré des ampoules, étincelles jaunes, couleurs de la charte. Image maîtresse : celle du propriétaire (mélange des styles 3 et 4).

**But (précisé par le propriétaire le 2026-09-29) :** améliorer la V1 avec des assets de grande qualité et des animations plus réalistes, en gardant un site **rapide**. La 3D reste dans l'atelier (Higgsfield + Blender) ; le site n'affiche que des images optimisées et des planches d'animation légères. Pas de moteur 3D dans le navigateur, pas de vidéo.

**Retiré pour l'instant :** le vestiaire (merch : maillot, casquette, peluche, box, stickers) n'est pas refait. La V2 a trois stations : la machine, le comptoir, la caisse. Le vestiaire reste dans la V1.

**Règles.** Chaque étape demande l'accord écrit du propriétaire avant de passer à la suivante et avant toute génération. Prix exact préchiffré avant chaque lancement, tout est noté dans `LEDGER.md`. La V1 ne change pas : la V2 se construit dans une copie et la remplace seulement après validation. Textes, logo et emballages exacts sont posés par-dessus en code, jamais générés.

## Budget de vitesse (mesuré avec limitation de processeur et de réseau dans Chromium)

- Premier écran utilisable : moins de 1,5 Mo de téléchargement.
- Site complet chargé au fil de l'eau, par station : moins de 10 Mo au total.
- Images en WebP ou AVIF, animations en planches d'images légères, mise en cache, chargement anticipé de la station suivante.
- Fluide sur un téléphone moyen ; « version simple » instantanée ; repli en image fixe si l'appareil est faible.

## Étapes

| # | Étape | On produit | Outils | Crédits (estimation) | Le propriétaire valide |
|---|---|---|---|---:|---|
| 1 | Bible de style | 1 planche (palette, matières, lumière, étincelles, coups de pinceau, interdits) et la « recette » de consigne | GPT Image 2.5, Nano Banana Pro | 3 à 6 | la planche |
| 2 | La Mouette | fiche de rotation 4 vues, objet 3D (essai Tripo 9 contre Meshy 7 à 38), squelette et animations dans Blender (bibliothèque de mouvements + les miens), rendu en planches d'images : repos, parle, salue, montre à gauche et à droite, sert, lance, attrape, fête, surprise, coquine, dort, marche, surf | Tripo, Meshy, Blender | 60 à 150 | la Mouette immobile, puis chaque lot d'animations |
| 3 | Le décor peint | plans du comptoir, de la machine et de la caisse en haute définition, calques de parallaxe, 4 lumières (jour, doré, coucher, nuit) | Nano Banana Pro, GPT Image 2.5, agrandissement | 60 à 150 | les plans, puis les lumières |
| 4 | Le décor vivant | météo, 5 fêtes en calques, soleil, lune, nuages, voilier, crabe, palmiers, panneau de drop, enseigne, décor de palier | GPT Image 2.5, Nano Banana Pro | 40 à 90 | par famille |
| 5 | Pop-corn et machine | grains de pop-corn rendus en 3D, machine (repos, chauffe, éclate), pochon (rempli, scellé, lancé), étincelles, cœurs, confettis | Tripo, Blender, images | 30 à 80 | les planches |
| 6 | Les produits | 6 pochons (emballages exacts), cartes produit, carte à tampons, 9 badges, 4 emblèmes de palier | Nano Banana Pro | 50 à 110 | par famille |
| 7 | L'interface | panneaux, boutons, bulles, icônes, écran d'intro | images + code | 30 à 70 | la maquette de chaque écran |
| 8 | Le son (option) | effets, ambiances, voix de la Mouette (ElevenLabs v4) | à chiffrer | à chiffrer | les échantillons |
| 9 | Le site V2 | voir plus bas | code | 0 | démo à chaque jalon |
| 10 | Tests de vitesse et bascule | budget respecté, parcours complets, repli sur la V1 | Playwright | 0 | la recette |

Estimation totale : environ 300 à 700 crédits sur 3 996, avec un plafond à chaque étape.

## Le site V2 (ce que je construis)

1. Copie améliorée de la V1, même moteur : chat, panier, caisse, Club, kiosque vivant. La V1 reste intacte.
2. Décor en calques avec parallaxe et caméra par stations (bureau, tablette, mobile).
3. Mouette animée avec les planches : boucles, gestes, transitions douces, synchronisée avec le chat, repli image fixe.
4. Lumière selon l'heure du visiteur, météo, fêtes et déco du palier branchées sur le kiosque vivant.
5. Show pop-corn refait avec les nouveaux grains, la machine et le pochon.
6. Interface repensée sur tous les écrans.
7. Chargement par station, formats modernes, budget de poids, repli si l'appareil est faible.
8. Tests : parcours a à d et mobile, captures, vitesse, accessibilité.
9. Démo hébergée, documentation, registre des crédits, page de crédits d'auteur.

## Risques et limites

- Le squelette automatique de Meshy est fait pour des humanoïdes : la Mouette peut demander un squelette fait à la main dans Blender. L'essai de l'étape 2 tranche.
- Mélanger une Mouette rendue en 3D et un décor peint demande un réglage de lumière et de texture pour qu'ils se marient : je te montre l'essai avant de produire en série.
- Je ne peux pas tester sur de vrais téléphones : les mesures se font dans Chromium avec processeur et réseau bridés. Paiement réel et serveur de commandes : comme dans la V1.
- Deux références de style portent une signature d'artiste (voir `LEDGER.md`) : on les crédite ou on s'éloigne de leur signature.
