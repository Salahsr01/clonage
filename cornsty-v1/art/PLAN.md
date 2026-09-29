# Plan de production : Cornsty v2, style « gouache brillante »

Style validé le 2026-09-29 : formes lisses et satinées, lumière et pinceau de gouache, dominante bleue, halo doré des ampoules, étincelles jaunes, couleurs de la charte. Image maîtresse : celle du propriétaire (mélange des styles 3 et 4).

**Règles.** Chaque étape demande l'accord écrit du propriétaire avant de passer à la suivante et avant toute génération. Prix exact préchiffré avant chaque lancement, tout est noté dans `LEDGER.md`. Le site actuel (v1) ne change pas : la v2 se construit à côté, dans un autre dossier, et on ne bascule qu'après validation. Textes, logo et emballages exacts sont posés par-dessus en code, jamais générés.

## Étapes

| # | Étape | On produit | Outils | Crédits (estimation) | Le propriétaire valide |
|---|---|---|---|---:|---|
| 1 | Bible de style | 1 planche (palette, matières, lumière, étincelles, coups de pinceau, interdits) + la « recette » de consigne réutilisée partout | GPT Image 2.5, Nano Banana Pro | 3 à 6 | la planche |
| 2 | La Mouette, fiches | rotation 4 vues · 12 expressions · 16 poses · 10 costumes (5 fêtes, 4 paliers, maillot) | Nano Banana Pro (fidélité au personnage), GPT Image 2.5 (brouillons) | 60 à 120 | chaque groupe |
| 3 | La Mouette, animation | 3a test comparatif d'une boucle : vidéo (MiniMax H3 Max 12,5 · Grok Video 1.5 22,5 · Seedance 2.5 35 par clip de 5 s), planche de sprites (AutoSprite, à chiffrer), objet 3D (Tripo 9 puis rig). 3b production de 16 clips : repos, parle, dort, salue, montre à gauche et à droite, sert, lance, attrape, fête, coquine, surprise, amour, surf, marche | vidéo, AutoSprite ou 3D selon le test | test 60 max, production 200 à 800 | le test, puis chaque lot de clips |
| 4 | Le décor | plan du comptoir en 4K · prolongement à gauche et à droite (panorama) · 4 plans de station bureau et 4 plans mobiles portrait · calques pour la parallaxe (ciel, mer, dunes, kiosque, comptoir, feuillages) · 5 lumières (jour, doré, coucher, crépuscule, nuit) | Nano Banana Pro, GPT Image 2.5, prolongement d'image, agrandissement | 100 à 220 | le panorama, puis les lumières |
| 5 | Le décor vivant | météo (pluie, neige, brouillard, éclair) · 5 fêtes en calques · soleil quatrefeuille, 8 phases de lune, nuages, oiseaux · voilier, promeneurs, crabe, palmiers, parasol, bouée · panneau de drop, horloge, enseigne | GPT Image 2.5, Nano Banana Pro | 50 à 100 | chaque famille |
| 6 | Les produits | 6 pochons (emballages exacts) · 6 cartes produit · merch (maillot, casquette, peluche, box, stickers) · carte à tampons · 9 badges, 4 emblèmes de palier, trophée | Nano Banana Pro, Tripo (objets 3D si besoin) | 80 à 150 | chaque famille |
| 7 | Les effets | 10 formes de grains, étincelles, cœurs, confettis, éclats · machine (repos, chauffe, éclate) · pochon (rempli, scellé, lancé) · tampon | GPT Image 2.5 | 30 à 60 | les planches |
| 8 | L'interface | panneaux, boutons (états), bulles, pastilles, champs, tiroir panier, ticket, cadres produit, 24 icônes, curseur, écran d'intro, chargement | GPT Image 2.5, Nano Banana Pro + code | 40 à 80 | la maquette de chaque écran |
| 9 | Le son (option) | 30 effets, 4 ambiances, voix de la Mouette (ElevenLabs v4) | Higgsfield audio ou ElevenLabs | à chiffrer | les échantillons |
| 10 | Le site v2 | voir plus bas | code | 0 | démo à chaque grand jalon |
| 11 | Tests et mise en ligne | parcours complets, captures, performance, accessibilité, repli sur la v1 | Playwright | 0 | la recette finale |

Estimation totale : environ 900 à 1 500 crédits sur 3 996, avec un plafond fixé à chaque étape. Le choix du modèle vidéo est ce qui fait varier le plus.

## Le site v2 (ce que je construis)

1. Nouveau dossier à côté de la v1 (la v1 reste intacte), même moteur : chat, panier, caisse, Club, kiosque vivant.
2. Décor en calques avec parallaxe et caméra par stations (bureau, tablette, mobile portrait).
3. Lecteur d'animation de la Mouette : boucles, actions, transitions, synchronisation avec le chat, repli sur image fixe.
4. Fondu entre les lumières selon l'heure du visiteur, météo, fêtes et déco du palier branchées sur le kiosque vivant.
5. Show pop-corn refait avec les nouveaux grains, la machine et le pochon.
6. Interface repensée sur tous les écrans (chat, produit, panier, caisse, ticket, Club, badges, mini-jeu, menu).
7. Chargement par station, formats modernes (WebP, WebM), budget de poids, repli si l'appareil est faible, « version simple » rapide.
8. Tests : parcours a à d et mobile, captures, performance, accessibilité, pas de requête externe.
9. Démo hébergée légère, documentation, registre des crédits, page de crédits d'auteur.

## Risques et limites

- L'animation générée doit être testée avant de produire en série (étape 3). Si la qualité n'y est pas, repli sur la 3D (Blender + objet 3D), et c'est là que la connexion Blender servirait.
- Vidéo avec transparence : WebM sur Chrome et Firefox, WebP animé ou planche de sprites en repli pour Safari.
- La v2 est un site en plusieurs fichiers (plus un seul fichier) : il faut un hébergement statique. La démo hébergée sera une version allégée.
- Je ne peux pas tester sur de vrais téléphones ni fournir l'hébergement. Le paiement réel et le serveur de commandes restent comme dans la v1.
- Deux références de style portent une signature d'artiste (voir `LEDGER.md`) : on les crédite ou on s'éloigne de leur signature.
