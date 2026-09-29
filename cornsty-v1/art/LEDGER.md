# Registre des crédits Higgsfield

Règles :
- Aucune génération sans l'accord écrit du propriétaire, lot par lot.
- Avant chaque lancement : prix exact par préchiffrage (`get_cost`, aucun job lancé), annonce, puis « go ».
- Rien n'est lancé avec les générations illimitées sans demande explicite.
- Références envoyées à un générateur : les images du propriétaire (sa Mouette, son site) et, à sa demande expresse, ses images de style. Chaque consigne dit de ne copier aucun personnage, visage, tenue, objet, texte ni logo de l'image de style, et de n'en prendre que le rendu. Aucune consigne ne cite une franchise existante.
- Pas de changement d'abonnement, pas de recharge.
- Une génération à la fois : montrer au propriétaire ce qui va être généré avant chaque nouvelle génération, et le résultat avant la suivante (demande du 2026-09-29).
- Brouillons : le modèle le moins cher déjà utilisé, GPT Image 2.5 (Sunburst) qualité basse 1k, 0,25 crédit l'image (demande du 2026-09-29).

Solde de départ (2026-09-29, plan Ultra) : **4 000,1 crédits**.

| Date | Lot | Outil / modèle | Consigne et références | Crédits | Solde après | Remarques |
|---|---|---|---|---:|---:|---|
| 2026-09-29 | — | Préchiffrages (`get_cost`, aucun job) | — | 0 | 4 000,1 | Prix relevés ci-dessous. |
| 2026-09-29 | — | Génération du propriétaire (hors Claude) : GPT Image 2.5 Sunburst | image de référence de la Mouette | −1,5 | 3 998,6 | Deux générations Nano Banana Pro du propriétaire sont aussi à 0 crédit dans l'historique. |
| 2026-09-29 | — | Préchiffrages supplémentaires | — | 0 | 3 998,6 | Solde vérifié avant et après. |
| 2026-09-29 | Test de style | GPT Image 2.5 Sunburst, qualité basse, 1k, 16:9, 1 image | Comptoir Cornsty en feutre, lumière dorée, plongée douce. Références : la Mouette du propriétaire + une capture propre du kiosque actuel (sans interface, sans Mouette) | −0,25 | 3 998,35 | Accord du propriétaire : une seule image, le modèle le moins cher. Job `62e50c3e-cb11-4925-8472-3359d8900057`. Coût conforme au préchiffrage (0,25). |
| 2026-09-29 | Variantes de style | GPT Image 2.5 Sunburst, qualité basse, 1k, 16:9, 4 images (lot de 4 demandes indépendantes) | A nuit magique · B île-diorama · C le grand pop · D sauce Cornsty (motifs de la marque, la Mouette qui vole un pochon). Références : la Mouette du propriétaire + capture propre du kiosque actuel | −1,00 | 3 997,35 | Accord du propriétaire : « d'autres variantes dans cette qualité ». 4 × 0,25 comme préchiffré. Jobs `32884fa9-b630-45b3-ad4d-6a2f6cafb1ab` (A), `7aeab1cb-afeb-4feb-9f00-91c43408da7d` (B), `e54b35a9-722f-4fb2-b83b-6ad3f7a81f01` (C), `28a6d646-f518-49ae-919c-0b2f8ede829c` (D). |
| 2026-09-29 | Styles sur la même image | GPT Image 2.5 Sunburst, qualité basse, 1k, 16:9, 4 images | Même scène que le test de style (image de base = job `62e50c3e-…`), rendu changé : 2 designer-toy · 3 jeu 3D brillant · 4 gouache 2D · 5 aplats pop. Références de style : voir plus bas | −1,00 | 3 996,35 | Accord du propriétaire : « d'autres styles sur cette image ». 4 × 0,25 comme préchiffré. Jobs `f1742231-3fe2-4647-883b-21798d2ee96f` (2), `54a8ebb4-2e0d-40c6-bb36-37b0612940da` (3), `9cf46a3e-5651-4ac1-8e72-e6f0daf5922d` (4), `498d9621-9a28-440b-a15d-87d60f6f6891` (5). |
| 2026-09-29 | Style hybride | GPT Image 2.5 Sunburst, qualité basse, 1k, 16:9, 1 image | Mélange des styles 3 (jeu 3D brillant) et 4 (gouache 2D) sur la même scène. Références : l'image de base et les rendus des styles 3 et 4 (aucune image extérieure) | −0,25 | 3 996,10 | Accord du propriétaire : « une seule image qui les combine ». Job `2a644af7-566c-4974-b211-de45838adc80`. Coût conforme au tarif déjà préchiffré (0,25). |
| 2026-09-29 | — | Préchiffrages du palier haut (`get_cost`, aucun job) | — | 0 | 3 996,10 | GPT Image 2.5 haute 4k, très haute 4k et Nano Banana Pro 4k (prix ci-dessous). Solde vérifié après : 3 996,1. |
| 2026-09-29 | Étape 1 : planche de style | Nano Banana Pro, 2k (2752 × 1536), 16:9, 1 image | Planche sans texte : la Mouette, le comptoir en vignette, pochon, gobelet, bouton, cinq pastilles de couleur, quatre études de matière ; règles de rendu (formes lisses et satinées, lumière et pinceau de gouache, sans contour, lumière dorée chaude, plongée légère). Références : l'image maîtresse (job `2a644af7-…`) + la Mouette du propriétaire (média `b9ca1e66-…`), aucune image extérieure | −2,00 | 3 994,10 | Accord du propriétaire : « nano banana pro 2K … go » (à la place de GPT Image 2.5 haute 4k proposé à 4,25). Job `f1f48c44-f5d7-4546-8655-5abced4e5a5c`. Coût conforme au préchiffrage (2). Le relevé de crédits dit « Nano Banana Pro » ; le suivi du job affiche le nom interne `nano_banana_2`. Planche écartée ensuite par le propriétaire (« pas vraiment démonstratif »). |
| 2026-09-29 | Lieu de départ (désert), brouillon | GPT Image 2.5 Sunburst, qualité basse, 1k (1344 × 752), 16:9, 1 image | Le kiosque au minimum dans le désert : comptoir en planches, auvent rapiécé, une seule ampoule, vieille machine cabossée, panier, caisse, panneau vide, cactus, dunes, ciel de crépuscule, mirage de palmiers et de mer à l'horizon (le rêve). Référence : l'image maîtresse (job `2a644af7-…`) seule, aucune image extérieure | −0,25 | 3 993,85 | Accord du propriétaire : « essaye de générer une image du nouveau lieu … le modèle le moins cher … pour les brouillons ». Préchiffrage 0,25, débit réel 0,25. Job `19167360-5454-472b-ae69-a658680ddba6`. Validé par le propriétaire (« c'est vraiment pas mal »). |
| 2026-09-29 | Scène Blender : le vrai logo et les 6 vrais pochons | Aucune génération Higgsfield (Blender seul : modélisation, textures de la V1, rendus locaux) | Demande du propriétaire : « voir mon logo et les packets en vrai … fait sur blender ». Scène `CORNSTY_Depart` ajoutée au Blender ouvert, script et ressources dans `art/blender/`. | 0 | 3 993,85 | Solde vérifié avant : 3 993,85. |
| 2026-09-29 | Scène Blender finale : désert « gouache brillante », Mouette modélisée, vrai logo, 6 vrais pochons, rendu 2K | Aucune génération Higgsfield (Blender seul : modélisation, Cycles en local, finition en code) | Demande du propriétaire : « met le dans ce style et modélise le personnage … rendu final … 2K ». Scripts dans `art/blender/` (`cs_lib.py`, `gull.py`, `build_final.py`, `post_final.py`). Le brouillon du désert (job `19167360-…`) sert de référence de composition ; la Mouette est refaite d'après la référence du propriétaire (média `b9ca1e66-…`, vue seulement, aucun envoi à un générateur). | 0 | 3 993,85 | Solde vérifié avant et après : 3 993,85. Une éventuelle passe de style (Nano Banana Pro 2k, 2 crédits) ou un essai image → 3D de la Mouette (Tripo 9, Meshy 38) ne se lance qu'avec l'accord écrit du propriétaire. |
| 2026-09-29 | Mouette : vue propre pour la 3D | Nano Banana Pro, 2k (1792 × 2400), 3:4, 1 image | La Mouette entière, debout, de trois quarts, pose neutre, bec fermé, sans planche de surf ni décor, fond gris uni, même finition « jeu 3D brillant » que la nouvelle image du propriétaire. Références : cette image (envoyée par le propriétaire dans la conversation, média `1da9b508-1974-4225-bb64-52602570c874`) et sa Mouette d'origine (`b9ca1e66-…`). | −2,00 | 3 991,85 | Demande explicite du propriétaire : « créer le personnage grâce à Higgsfield Blender ». Préchiffrage 2, envoyé aussitôt. Job `05c6e96a-f8cb-4470-ae96-592ac0d05d58`. |
| 2026-09-29 | Mouette : image vers 3D | Tripo H3.1 image vers 3D, géométrie et texture détaillées, PBR, texture alignée sur l'image d'origine | Source : la vue propre ci-dessus (job `05c6e96a-…`). Pas de mise au carré, pas de rig à cette étape. | −18,00 | 3 973,85 | Préchiffrage 18 (comparaison : Hunyuan3D v3 15, Meshy 7 38). Job `964cdd16-6b43-4817-a451-45f59112bda2` : modèle de 1,99 million de triangles, textures 4096 × 4096 (couleur, rugosité-métal, normales), 0,98 m de haut, importé dans la scène `CORNSTY_Mouette_Higgsfield` du Blender du propriétaire (objet `HERO_gull_hf`). Débit réel vérifié : solde 3 973,85. Passe par l'outil Higgsfield général (l'outil typé de Blender ne permet pas de régler la qualité) ; l'import se fait dans Blender. |

## Prix relevés (préchiffrage, par image ou par objet)

| Modèle | Réglage | Crédits |
|---|---|---:|
| GPT Image 2.5 (Flare ou Sunburst) | basse, 1k | 0,25 |
| GPT Image 2.5 | moyenne, 2k | 1 |
| GPT Image 2.5 | haute, 2k | 2,75 |
| GPT Image 2.5 | haute, 4k | 4,25 |
| GPT Image 2.5 | très haute (xhigh), 4k | 7 |
| GPT Image 2.5 | max, 4k | 15 |
| Nano Banana Pro | 2k | 2 |
| Nano Banana Pro | 4k | 4 |
| Soul Cinema | 2k | 1 |
| Tripo H3.1 image → 3D | texturé, PBR | 9 |
| Hunyuan3D v3 image → 3D | par défaut | 11 |
| Meshy 7 image → 3D | texturé, PBR | 38 |
| Seedance 2.5 (vidéo, image de départ) | 5 s, 720p, sans audio | 35 |
| Grok Video 1.5 (vidéo, image de départ) | 5 s, 720p | 22,5 |
| MiniMax H3 Max (vidéo, image de départ) | 5 s, 768p | 12,5 |

Rigging et animations de la bibliothèque : à chiffrer. AutoSprite : le préchiffrage échoue (avec ou sans image), à refaire au moment du test.

## Étape 1 (planche de style) — réalisée le 2026-09-29, écartée par le propriétaire

Remplace l'ancien « lot 1 » (fiche de rotation et comptoir), repris plus tard dans les étapes 2 et 3 du plan (`PLAN.md`). Le propriétaire a choisi Nano Banana Pro en 2k (2 crédits) plutôt que GPT Image 2.5 haute 4k (4,25 crédits proposés). Une image, lancée après préchiffrage exact (2), débit réel 2 : voir le tableau du registre.

Historique Higgsfield : trois lignes à 0 crédit (Seedream 5.0 Lite à 05:12, deux Nano Banana Pro à 05:22, heure UTC) ne figurent pas dans ce registre. Ce sont des générations sans crédit qui ne viennent pas de Claude (à confirmer par le propriétaire).

Le propriétaire l'a écartée (« pas vraiment démonstratif ») et a demandé d'attaquer le plus gros : le lieu de départ (désert), dont le brouillon est dans le tableau. Aucune retouche de la planche n'est lancée.

## Références de style et crédits d'auteur

Images fournies par le propriétaire, utilisées seulement comme références de rendu pour des essais privés (rien n'est publié) :

| Style | Image de référence | Ce qu'on en retient | Crédit visible sur l'image |
|---|---|---|---|
| 2 designer-toy | rendu 3D d'un personnage en costume, caméra en plongée, éclairage studio | matières lisses, tissu fin, lumière douce de studio | signé « NoirChen » (@NOIR_META, IG @noirchen) |
| 3 jeu 3D brillant | personnage 3D lisse et brillant avec étincelles jaunes | formes gonflées, matière satinée, étincelles | aucun |
| 4 gouache 2D | illustration 2D d'une plongée dans une grotte, rayons de lumière | aplats et pinceau, dominante bleue, lumière | signé « UNO » (twitter.com/uno_yu_ji) |
| 5 aplats pop | illustration 2D à aplats francs, fond outremer | aplats, reflets crème, grain d'impression | aucun |

Si une piste inspirée d'un de ces artistes est gardée pour le site, on le crédite ou on s'éloigne de sa signature. Aucun personnage de ces images n'est repris.
