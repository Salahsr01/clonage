# art/blender : la scène 3D du kiosque (Blender)

Tout ce qui sert à fabriquer les images 3D de la V2 (aucun crédit Higgsfield n'y est dépensé).

| Fichier | Rôle |
|---|---|
| `cs_lib.py` | bibliothèque commune : matériaux (bois, sable craquelé, rayures, peinture écaillée, verre), formes organiques (tubes, révolutions, fusion par voxels), **le vrai logo** (tracés du brand book extrudés) et **les vrais pochons** |
| `gull.py` | la **Mouette** modélisée en pièces séparées : corps, cou et tête fondus, deux ailes à trois plumes, bec haut et bas, lunettes, chapeau bob rayé avec sa boucle |
| `build_final.py` | la scène finale « gouache brillante » : kiosque de départ dans le désert (auvent rayé et rapiécé, machine rouge écaillée, caisse des 6 pochons, enseigne au vrai logo, cactus, dunes, mirage, ciel de crépuscule) |
| `post_final.py` | la finition en Python (lueur dorée, étoiles jaunes à quatre branches, dominante chaude et ombres froides, grain de pinceau, vignette) |
| `render_bands.py`, `stitch_bands.py` | le rendu 2K final par 3 bandes qui se recouvrent (reprise possible si le calcul s'interrompt), puis le recollage en un seul EXR |
| `gull_turnaround.py` | la planche de rotation de la Mouette seule (face, trois-quarts, profil, dos) sous lumière de studio |
| `load_final.py` | **le plus simple** : à coller dans l'onglet Scripting de Blender, il télécharge les trois scripts ci-dessus depuis GitHub et ajoute la scène finale au fichier ouvert |
| `export_blend.py` | fabrique un `.blend` autonome (une seule scène, textures empaquetées) depuis un Python sans interface |
| `build_depart.py` | première scène rapide : logo et pochons sur un comptoir nu (`CORNSTY_Depart`) |
| `PASSPORT.md`, `PASSPORT_final.md` | passeports de scène (contrat de construction et preuves) |
| `tex/pouch-*.png`, `logo-*.svg` | ressources : emballages rendus depuis le dessin de la V1 (976 × 1596), tracés vectoriels du brand book |

## Reconstruire la scène finale

Dans Blender : coller `load_final.py` dans l'onglet Scripting et l'exécuter. Ou, à la main : exécuter dans le même espace de noms, dans cet ordre, `cs_lib.py`, `gull.py`, `build_final.py`.
La scène `CORNSTY_Depart_Final` est ajoutée au fichier ouvert ; rien n'est enregistré, les autres scènes ne sont pas touchées.
Les ressources sont lues dans le dossier `ASSET_DIR` s'il est défini, sinon téléchargées depuis GitHub.

Hors interface (module `bpy` de pip) : `python3 render_bands.py dossier`, puis `python3 stitch_bands.py dossier`, puis `python3 post_final.py dossier/final-2k.exr image.png` (environ 35 minutes sur 4 cœurs pour le 2K, 256 échantillons).

## Choix

- 2K suffit (demande du propriétaire) : 2048 × 1152, pas de 4K ni de 8K.
- Les textes, le logo et les emballages sont exacts : ils viennent du dessin de la V1, jamais d'une génération.
- La Mouette est faite à la main dans Blender (pièces séparées, animable), pas générée : rien à payer, rien à réparer.
