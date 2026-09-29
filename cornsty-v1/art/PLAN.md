# Plan de production : Cornsty v2 en 3D, style « gouache brillante »

Style validé le 2026-09-29 : formes lisses et satinées, lumière et pinceau de gouache, dominante bleue, halo doré des ampoules, étincelles jaunes, couleurs de la charte. Image maîtresse : celle du propriétaire (mélange des styles 3 et 4).

**Décision du propriétaire (2026-09-29) : la 3D fait le site. Pas de vidéo.** Higgsfield génère les objets 3D, Blender (connecté) assemble la scène, le site les affiche en 3D temps réel dans le navigateur.

**Règles.** Chaque étape demande l'accord écrit du propriétaire avant de passer à la suivante et avant toute génération. Prix exact préchiffré avant chaque lancement, tout est noté dans `LEDGER.md`. Le site actuel (v1) ne change pas : la v2 se construit à côté et on ne bascule qu'après validation. Textes, logo et emballages exacts sont posés par-dessus (textures, code), jamais générés.

## Comment un objet est fabriqué

1. Image de concept de l'objet dans le style, fond neutre (GPT Image 2.5 ou Nano Banana Pro, 0,25 à 2 crédits).
2. Objet 3D texturé à partir de cette image (Tripo H3.1 9 crédits, Hunyuan3D v3 11, Meshy 7 texturé PBR 38).
3. Nettoyage dans Blender : échelle, centre, allègement, matières, squelette si besoin.
4. Export GLB léger, essai dans la scène.

## Étapes

| # | Étape | On produit | Outils | Crédits (estimation) | Le propriétaire valide |
|---|---|---|---|---:|---|
| 1 | Bible de style 3D | 1 planche de style (image) + règles de matières, de lumière et de rendu temps réel | GPT Image 2.5, Nano Banana Pro | 3 à 6 | la planche |
| 2 | La Mouette en 3D | fiche de rotation 4 vues, puis objet 3D (essai Tripo multivues 9 contre Meshy 7 à 38, on compare), nettoyage et squelette dans Blender, 16 animations (bibliothèque Meshy : repos, salut, marche, danse… et les miennes : parle, dort, montre, sert, lance) | Tripo, Meshy, Blender | 100 à 250 | la Mouette immobile, puis les animations |
| 3 | Costumes de la Mouette | 5 chapeaux de fêtes, 4 tenues de paliers, lunettes relevées, maillot | image → 3D | 60 à 120 | le lot |
| 4 | Le kiosque | auvent, mur, poteaux, ponton, comptoir (façades par saveur), machine à pop-corn, étagères, caisse, menu, guirlandes, fanions, enseigne, planche de surf (environ 40 objets) | image → 3D (Tripo) | 400 à 500 | par groupes |
| 5 | L'île et le ciel | sable, mer, palmiers, nuages, soleil, lune, voilier, crabe, parasol, bouée (environ 15 objets) | image → 3D | 120 à 180 | le lot |
| 6 | La scène dans Blender | assemblage, caméra en plongée douce par station, lumières (jour, doré, coucher, nuit), export | Blender (connecté) | 0 | les vues de chaque station |
| 7 | Les produits | 6 pochons (emballages exacts en texture), maillot, casquette, peluche, box, stickers, badges, emblèmes de paliers | image → 3D + textures | 100 à 150 | par famille |
| 8 | Les effets | grains de pop-corn 3D, étincelles, cœurs, confettis, fumée | Blender, code | 20 à 40 | l'essai |
| 9 | Interface et son | panneaux, boutons, bulles, icônes, intro ; effets sonores, ambiances, voix (ElevenLabs v4) | image + code | à chiffrer | la maquette de chaque écran |
| 10 | Le site v2 en 3D | voir plus bas | code | 0 | démo à chaque jalon |
| 11 | Tests et mise en ligne | parcours complets, performance, accessibilité, repli sur la v1 | Playwright | 0 | la recette |

Estimation totale : environ 900 à 1 500 crédits sur 3 996, avec un plafond à chaque étape. Le prix des rigs et animations Meshy reste à chiffrer.

## Le site v2 (ce que je construis)

1. Nouveau dossier à côté de la v1 (la v1 reste intacte), même moteur : chat, panier, caisse, Club, kiosque vivant.
2. Scène 3D temps réel (three.js) : caméra libre entre les stations, léger effet de plongée, la Mouette qui suit le curseur du regard.
3. Rendu « gouache brillante » en temps réel : matières satinées, lumière douce, contour lumineux, texture de pinceau, bloom, étincelles, étalonnage bleu.
4. Mouette animée en direct : squelette, animations mélangées, bouche qui bouge avec le texte (et la voix plus tard), clignements.
5. Show pop-corn en 3D : grains en instances avec physique, machine et pochon animés.
6. Lumière selon l'heure du visiteur, météo, fêtes et déco du palier branchées sur le kiosque vivant.
7. Interface repensée sur tous les écrans.
8. Chargement par étapes, compression des modèles et des textures, budget de poids, repli en image fixe si l'appareil est faible, « version simple » rapide.
9. Tests : parcours a à d et mobile, captures, performance, accessibilité.
10. Démo hébergée allégée, documentation, registre des crédits, page de crédits d'auteur.

## Risques et limites

- Les objets générés ont besoin de nettoyage (échelle, formes, textures) : c'est le travail de l'étape Blender de chaque groupe.
- Le squelette automatique de Meshy est fait pour des humanoïdes : la Mouette peut demander un squelette fait à la main dans Blender. Le test de l'étape 2 tranche.
- La 3D temps réel est plus lourde qu'un décor en images : budget de poids et repli image fixe prévus, mais les vieux téléphones seront limités.
- La v2 sera un site en plusieurs fichiers : il lui faut un hébergement statique. La démo hébergée sera allégée.
- Je ne peux pas tester sur de vrais téléphones. Paiement réel et serveur de commandes : comme dans la v1.
- Deux références de style portent une signature d'artiste (voir `LEDGER.md`) : on les crédite ou on s'éloigne de leur signature.
