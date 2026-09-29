# Passeport de scène : CORNSTY_Depart_Final

Le kiosque de départ dans le désert, dans le style « gouache brillante » du brouillon validé, avec la Mouette modélisée, le vrai logo et les 6 vrais pochons. Rendu final en 2K.

`refs_read` : blender-scene, blender-scene-spec, blender-modeling, blender-lookdev, blender-lighting-camera, blender-animation, blender-audit-finalize, blender-volatile (lus pour la scène précédente, mêmes règles).

## SCENE
- intent : l'image finale de départ du site : le kiosque au minimum, dans le désert, avec la Mouette, le vrai logo et les vrais emballages
- deliverable : une image 2048 × 1152 (2K, demande du propriétaire), le script reproductible, la scène ajoutée dans le Blender du propriétaire, un `.blend` avec textures empaquetées
- units : mètres ; axes : droitier, Z vers le haut ; le kiosque regarde vers −Y
- render : Cycles, 2048 × 1152, 256 échantillons au plus (échantillonnage adaptatif, seuil 0,008), débruitage OpenImageDenoise avec passes albédo et normale ; rendu en 3 bandes qui se recouvrent de 64 px (`render_bands.py`), recollées avec un fondu linéaire (`stitch_bands.py`), sortie EXR flottant, puis finition en Python (`post_final.py`)
- dynamic : non. Image fixe demandée (« rendu final ») ; aucun mouvement dans cette scène

## HIERARCHY
- collections : `COL_ENV`, `COL_PRP`, `COL_HERO`, `COL_LGT`, `COL_CAM` ; préfixes `ENV_`, `PRP_`, `HERO_`, `LGT_`, `CAM_`, `TGT_`, `MAT_`, `FX_`
- la Mouette : `HERO_gull_root` porte le corps, les ailes, la tête (`HERO_gull_head`) qui porte le bec, les lunettes et le chapeau (`HERO_gull_hat`)
- objets protégés : toutes les autres scènes du fichier, jamais touchées ; aucun enregistrement du `.blend` ouvert

## ASSETS
| Objet | Route | Fidélité | Rôle |
|---|---|---|---|
| `HERO_gull_*` | BLOCK (formes organiques, fusion par voxels) | detailed | la Mouette d'après la référence du propriétaire, pièces séparées : corps + cou + tête fondus, deux ailes de trois plumes-feuilles chacune (six pièces), bec haut et bas, deux montures et deux verres arrondis, arcade, branches, chapeau bob (couronne, bord tombant, deux boucles rondes, languette, noeud) |
| `HERO_pouch_*` (6) | BLOCK (maille coussin) + texture réelle | detailed | les 6 vrais pochons dans la caisse, en deux rangées |
| `HERO_logo_wordmark`, `HERO_logo_mark` | BLOCK (tracés du brand book extrudés) | detailed | le vrai logo sur l'enseigne |
| `PRP_machine_*` | BLOCK | detailed | machine à pop-corn rouge écaillée (socle, vitre, roue, couvercle, bouilloire, manivelle) et son pop-corn |
| `PRP_awning*`, `PRP_post_*` | BLOCK | stylized | auvent à rayures avec retombée festonnée, pièce rouge cousue (points crème, applique quatrefeuille exacte du brand book), poteaux tordus cordés |
| `PRP_counter_*`, `PRP_crate*`, `PRP_basket`, `PRP_sign_*`, `PRP_bulb*` | BLOCK | stylized | comptoir bas (planches clouées), caisse, panier de pop-corn, enseigne, ampoule |
| `ENV_cactus_*`, `ENV_rock_*`, `ENV_pebble_*`, `ENV_drift_*`, `ENV_tumbleweed_*` | BLOCK | stylized | cactus à fleurs, rochers de grès en strates, cailloux, sable amassé au pied du comptoir, boule de paille |
| `ENV_terrain`, `ENV_palm_*`, `ENV_mirage_water` | BLOCK | blockout | sol craquelé, dunes, mirage (palmiers et mer) |

Aucune génération : zéro crédit Higgsfield.

## SHOT
- `CAM_main` : 32 mm, à (0,22 ; −3,75 ; 1,08), cible (0,22 ; 0 ; 0,95), profondeur de champ (f/6, mise au point à 3,9 m) : basse, presque horizontale, comme sur le brouillon
- sujet : la Mouette ; second point : l'enseigne ; arrière-plan : dunes et mirage

## LOOK
- matières satinées et arrondies, chanfreins partout, petit grain de pinceau sur les surfaces ; peau de la Mouette à diffusion sous la surface légère et reflet doux ; bois chaud à trois teintes ; toile bleue et crème ; rouge écaillé aux arêtes
- palette : outremer et violet (haut du ciel), rose et orange (crépuscule), or (horizon), crème et rouge de la marque ; ciel resserré vers le bas pour que le bleu domine au-dessus de l'horizon comme dans le brouillon validé
- transformation de vue `Standard`, finition en Python (voir `post_final.py`)

## LIGHTING
- sujet : la Mouette ; zone la plus sombre : sous l'auvent, à gauche ; mise en valeur : liseré doré à droite (soleil bas)
- ciel : dégradé serré de crépuscule (or, orange, rose, violet, bleu outremer), nuages roses, étoiles, lueur du soleil à droite
- `LGT_sun` (soleil très bas, droite et derrière) : liseré chaud ; `LGT_bulb` (point, l'ampoule visible) : chaleur dorée sur la Mouette et la machine ; `LGT_fill_front` : ouverture douce de face ; `LGT_fill_cool` (gauche) : garde le violet dans les ombres
- exposition verrouillée : `Standard`, 0

## ACCEPTANCE

Vérifié le 2026-09-29. Tout ce qui est écrit « vu » a été regardé pour de bon.

**Structure** (dans le Blender du propriétaire, 5.1.2, après dépôt de la scène)
- `CORNSTY_Depart_Final` : 405 objets, moteur Cycles, 2048 × 1152, caméra `CAM_main` (32 mm), monde `WORLD_Final`, 4 lumières.
- La Mouette : 27 pièces `HERO_gull_*` (corps, deux ailes de trois plumes, bec haut et bas, deux montures et deux verres, arcade, branches, chapeau, boucles).
- 6 pochons `HERO_pouch_*` avec les vraies textures (976 × 1596, fichiers présents), logo `HERO_logo_wordmark` et `HERO_logo_mark`.
- La scène `CORNSTY_Depart` du même fichier n'a pas été touchée (42 objets, ses 5 collections). Les noms déjà pris par elle portent le suffixe `.001` dans la scène finale (par exemple `COL_ENV.001`, `HERO_pouch_cheddar.001`). Rien n'a été enregistré ; une copie de sécurité du fichier a été écrite dans le dossier temporaire avant le dépôt.
- Fichier de test hors interface : `.blend` autonome (une scène, 405 objets, 6 textures empaquetées, aucune image manquante), rouvert et relu.
- Isolation testée : construire la scène finale dans un fichier qui contient déjà des collections, objets et matériaux de mêmes noms ne supprime ni ne remplace rien (les nouveaux prennent `.001`).

**Visuel** (vu)
- Image finale 2048 × 1152 examinée en entier puis en découpes à 100 % : visage de la Mouette (lunettes, bec, chapeau), pochons et logo, pièce d'auvent cousue avec son quatrefeuille, machine, panier, rocher, cactus, boule de paille : aucun défaut visible à cette échelle.
- Les deux recouvrements entre bandes (lignes 320 à 448 et 704 à 832) examinés à 200 % : aucune couture visible.
- Planche de rotation de la Mouette (face, trois-quarts, profil, dos) examinée.
- Capture de la fenêtre 3D du propriétaire (mode Solide, vue caméra) : la géométrie correspond à la scène testée hors interface.

**Lumière**
- Soleil très bas à droite en contre-jour (liseré doré sur les plumes et le ventre), ampoule dorée, deux lumières de remplissage (chaude de face, froide à gauche). Les plumes translucides de l'aile droite, éclairées par derrière, forment de fins liserés orange à côté du panier : voulu (halo doré du style), à atténuer si le propriétaire le préfère.

**Limites connues**
- La finition (lueur dorée, étoiles à quatre branches, grain de pinceau, dominante) est faite par un script Python après le rendu (`post_final.py`) : elle n'est pas dans le `.blend`. Un rendu lancé dans Blender sans ce script n'a ni étoiles ni lueur ni grain.
- Aucun rendu Cycles n'a été lancé dans le Blender du propriétaire (seul son affichage 3D a été vérifié). Les rendus viennent de Blender 5.0.1 en Python. Un rendu dans 5.1.2 devrait être identique, non vérifié.
- Les textures des pochons sont lues dans le dossier temporaire du propriétaire : à empaqueter s'il enregistre le fichier.
- C'est de la 3D lissée avec une finition peinte, pas de la peinture. La Mouette n'a ni jambes visibles ni queue, ses plumes sont de simples feuilles ; les bouts des branches de lunettes se voient par derrière comme deux petits points. Les cactus sont lisses (pas de côtes ni d'épines).
