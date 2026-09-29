# Passeport de scène : CORNSTY_Depart_Final

Le kiosque de départ dans le désert, dans le style « gouache brillante » du brouillon validé, avec la Mouette modélisée, le vrai logo et les 6 vrais pochons. Rendu final en 2K.

`refs_read` : blender-scene, blender-scene-spec, blender-modeling, blender-lookdev, blender-lighting-camera, blender-animation, blender-audit-finalize, blender-volatile (lus pour la scène précédente, mêmes règles).

## SCENE
- intent : l'image finale de départ du site : le kiosque au minimum, dans le désert, avec la Mouette, le vrai logo et les vrais emballages
- deliverable : une image 2048 × 1152 (2K, demande du propriétaire), le script reproductible, la scène ajoutée dans le Blender du propriétaire, un `.blend` avec textures empaquetées
- units : mètres ; axes : droitier, Z vers le haut ; le kiosque regarde vers −Y
- render : Cycles, 2048 × 1152, 320 échantillons au plus (échantillonnage adaptatif, seuil 0,008), débruitage OpenImageDenoise avec passes albédo et normale, sortie EXR flottant puis finition en Python
- dynamic : non. Image fixe demandée (« rendu final ») ; aucun mouvement dans cette scène

## HIERARCHY
- collections : `COL_ENV`, `COL_PRP`, `COL_HERO`, `COL_LGT`, `COL_CAM` ; préfixes `ENV_`, `PRP_`, `HERO_`, `LGT_`, `CAM_`, `TGT_`, `MAT_`, `FX_`
- la Mouette : `HERO_gull_root` porte le corps, les ailes, la tête (`HERO_gull_head`) qui porte le bec, les lunettes et le chapeau (`HERO_gull_hat`)
- objets protégés : toutes les autres scènes du fichier, jamais touchées ; aucun enregistrement du `.blend` ouvert

## ASSETS
| Objet | Route | Fidélité | Rôle |
|---|---|---|---|
| `HERO_gull_*` | BLOCK (formes organiques, fusion par voxels) | detailed | la Mouette, pièces séparées : corps + cou + tête, deux ailes, bec haut et bas, deux verres, branches, pont, chapeau (couronne, bord, trois boucles, noeud) |
| `HERO_pouch_*` (6) | BLOCK (maille coussin) + texture réelle | detailed | les 6 vrais pochons dans la caisse, en deux rangées |
| `HERO_logo_wordmark`, `HERO_logo_mark` | BLOCK (tracés du brand book extrudés) | detailed | le vrai logo sur l'enseigne |
| `PRP_machine_*` | BLOCK | detailed | machine à pop-corn rouge écaillée (socle, vitre, roue, couvercle, bouilloire, manivelle) et son pop-corn |
| `PRP_awning*`, `PRP_post_*` | BLOCK | stylized | auvent à rayures avec retombée festonnée et pièce cousue, poteaux tordus cordés |
| `PRP_counter_*`, `PRP_crate*`, `PRP_basket`, `PRP_sign_*`, `PRP_bulb*` | BLOCK | stylized | comptoir bas, caisse, panier de pop-corn, enseigne, ampoule |
| `ENV_cactus_*`, `ENV_rock_1`, `ENV_pebble_*`, `ENV_tumbleweed_*` | BLOCK | stylized | cactus à fleurs, rocher, cailloux, boule de paille |
| `ENV_terrain`, `ENV_palm_*`, `ENV_mirage_water` | BLOCK | blockout | sol craquelé, dunes, mirage (palmiers et mer) |

Aucune génération : zéro crédit Higgsfield.

## SHOT
- `CAM_main` : 32 mm, à (0,22 ; −3,75 ; 1,08), cible (0,22 ; 0 ; 0,95), profondeur de champ (f/6, mise au point à 3,9 m) : basse, presque horizontale, comme sur le brouillon
- sujet : la Mouette ; second point : l'enseigne ; arrière-plan : dunes et mirage

## LOOK
- matières satinées et arrondies, chanfreins partout, petit grain de pinceau sur les surfaces ; peau de la Mouette à diffusion sous la surface légère et reflet doux ; bois chaud à trois teintes ; toile bleue et crème ; rouge écaillé aux arêtes
- palette : outremer et violet (haut du ciel), rose et orange (crépuscule), or (horizon), crème et rouge de la marque
- transformation de vue `Standard`, finition en Python (voir `post_final.py`)

## LIGHTING
- sujet : la Mouette ; zone la plus sombre : sous l'auvent, à gauche ; mise en valeur : liseré doré à droite (soleil bas)
- ciel : dégradé serré de crépuscule (or, orange, rose, violet, outremer), nuages roses, étoiles, lueur du soleil à droite
- `LGT_sun` (soleil très bas, droite et derrière) : liseré chaud ; `LGT_bulb` (point, l'ampoule visible) : chaleur dorée sur la Mouette et la machine ; `LGT_fill_front` : ouverture douce de face ; `LGT_fill_cool` (gauche) : garde le violet dans les ombres
- exposition verrouillée : `Standard`, 0

## ACCEPTANCE
- structure, visuel, lumière : voir le rapport de livraison ; les limites connues y sont notées
