# Passeport de scène : CORNSTY_Depart

Le vrai logo et les 6 vrais pochons sur le comptoir du kiosque de départ (désert). Version rapide, à ajuster avec le propriétaire.

`refs_read` : blender-scene, blender-scene-spec, blender-modeling, blender-lookdev, blender-lighting-camera, blender-animation, blender-audit-finalize, blender-volatile.

## SCENE
- intent : voir en 3D le vrai logo Cornsty et les vrais emballages, dans le décor de départ validé (désert, kiosque au minimum)
- deliverable : nouvelle scène `CORNSTY_Depart` dans le Blender ouvert du propriétaire (la scène d'origine n'est pas touchée), 3 rendus de contrôle, script reproductible `build_depart.py`
- units : mètres ; axes : droitier, Z vers le haut ; le kiosque regarde vers −Y
- render : moteur du fichier du propriétaire (`BLENDER_EEVEE`), 1920 × 1080, 24 ips, images 1 à 120 ; contrôle hors interface en Cycles (bpy 5.0)
- dynamic : oui. Un lent travelling avant de `CAM_wide` (images 1 à 96), repos stable de 96 à 120. Aucune autre animation.

## HIERARCHY
- collections : `COL_ENV`, `COL_PRP`, `COL_HERO`, `COL_LGT`, `COL_CAM` ; préfixes `ENV_`, `PRP_`, `HERO_`, `LGT_`, `CAM_`, `TGT_`, `MAT_`
- parenté : `PRP_sign_root` porte la planche, la plaque, les clous et le logo
- objets existants protégés : `Cube`, `Light`, `Camera` de la scène `Scene`, jamais touchés
- enregistrement du `.blend` : aucun (le propriétaire ne l'a pas demandé)

## ASSETS
| # | Objet | Route | Fidélité | Dimensions (m) | Position | Rôle |
|---|---|---|---|---|---|---|
| A01 | `HERO_pouch_cheddar` `gaufre` `wings` `nature` `caramel` `cookies` | BLOCK (maille coussin, sceaux plissés) + texture réelle | detailed | 0,16 × 0,072 × 0,262 | rangée x de −0,63 à 0,40, y 0,065, z 0,8655, inclinés de 6,5° à 9,5° | les 6 pochons du catalogue, emballage exact rendu depuis la V1 |
| A02 | `HERO_logo_wordmark`, `HERO_logo_mark` | BLOCK (tracés vectoriels du brand book, extrudés et biseautés) | detailed | 0,66 × 0,40, profondeur 0,016 | sur `PRP_sign_plaque` | le vrai logo |
| A03 | `PRP_sign_root`, `_board`, `_plaque`, `_nail`, `_post` | BLOCK | stylized | planche 1,0 × 0,05 × 0,6 | x 1,78, y −0,12, z 1,33, tournée de −14° | enseigne |
| A04 | `PRP_counter_front`, `_top`, `PRP_rail` | BLOCK | stylized | 2,0 × 0,6 × 0,89 | centré | comptoir en planches et tringle d'appui |
| A05 | `PRP_post_L`, `PRP_post_R`, `PRP_awning`, `PRP_awning_patch` | BLOCK | stylized | poteaux h 2,3 ; auvent 2,44 × 0,86 | x ±1,05 | structure et toile rapiécée |
| A06 | `PRP_bulb`, `_socket`, `_cord` | BLOCK | stylized | r 0,04 | x −0,55, z 1,79 | ampoule (source pratique) |
| A07 | `ENV_ground`, `ENV_dune_1` à `_5` | BLOCK | blockout | sol 120 × 130 ; dunes jusqu'à 22 m | fond | sable et dunes |

Aucune génération : zéro crédit Higgsfield.

## SHOT
- `CAM_wide` : 38 mm, de (0,95 ; −4,7 ; 2,35) à (0,62 ; −3,95 ; 2,05), cible (0,6 ; 0 ; 1,0) : le kiosque entier, plongée légère
- `CAM_pouches` : 50 mm, (−0,1 ; −1,95 ; 1,42), cible (−0,1 ; 0,06 ; 1,0) : la rangée de pochons
- `CAM_logo` : 50 mm, (1,35 ; −2,0 ; 1,7), cible (1,78 ; −0,12 ; 1,32) : l'enseigne
- caméra active à l'ouverture : `CAM_wide`, image 120

## LOOK
- pochons : image texturée sRGB (rendu de `Cornsty.draw.pouch` de la V1, 976 × 1596), coins arrondis remplacés par la couleur de fond, film satiné (coat 0,14), petits plis en relief ; dos uni de la couleur de la saveur
- logo : encre `#26232B` et quatrefeuille `#DE3F39`, satinés, sur plaque crème `#F8F2E0`
- bois : bruit étiré selon le fil, deux à trois teintes ; sable : bruit + rides ; auvent : rayures bleu `#788CE3` et crème
- transformation de vue : `Standard` (les couleurs des emballages doivent rester fidèles), exposition 0

## LIGHTING
- sujet : les pochons ; second point : l'enseigne ; zone la plus sombre : le dessous du comptoir
- ambiance : crépuscule doré, ciel de Sky Texture à 6° d'élévation
- `LGT_sun` (soleil bas, gauche et derrière) : lumière rasante chaude, dessine les volumes ; `LGT_key` (grand rectangle, avant gauche, chaud) : lit les faces des pochons ; `LGT_fill` (grand rectangle, avant droit, froid) : garde le bleu du ciel dans les ombres ; `LGT_practical_bulb` (point, chaud) : justifie l'ampoule visible
- exposition verrouillée : `Standard`, 0

## MOTION
- 24 ips, images 1 à 120 ; `CAM_wide` avance de 0,8 m en 96 images (interpolation de Bézier) puis reste fixe ; repos stable pour les vignettes

## ACCEPTANCE
- structure : 42 objets attendus, noms uniques, aucun `.001`, scène d'origine intacte, une seule scène ajoutée
- mouvement : la position de `CAM_wide` change entre les images 1, 48 et 96 et reste identique entre 96 et 120
- visuel : les 6 emballages lisibles au plan `CAM_pouches` (nom de la saveur, logo, mascotte) ; logo lisible et plein (lettres remplies, sans creux) au plan `CAM_logo` ; aucune surface rose ou sans texture ; ni écrêtage ni noir bouché
- lumière : rendu vérifié à exposition fixe ; pas d'audit isolé (monde seul, clé seule) fait dans cette version rapide, à faire si le propriétaire garde ce décor
