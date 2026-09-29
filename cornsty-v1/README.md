# Cornsty — le kiosque interactif (v1)

Un site e-commerce **qui se joue au lieu de se scroller** : tu arrives sur un kiosque de plage, **la Mouette** (la mascotte du brand book) tient le comptoir, discute avec toi, te conseille, **éclate ton pop-corn sous tes yeux**, l'emballe, te **fait la caisse** et **tamponne ta carte fidélité**.

Tout est dessiné avec **les vrais tracés vectoriels du brand book** (mouette, icône, logo, quatrefeuille — extraits du PDF, pas redessinés), les 3 couleurs de la marque, les 3 polices (League Gothic / Inter / IBM Plex Mono) et les 6 motifs de saveur reconstruits à partir des tuiles du book.

> Démo de démonstration : **aucun paiement réel, aucune commande réelle**. Voir « Brancher pour de vrai » plus bas.

![Intro](docs/01-intro.png)

## Ouvrir le site

| Comment | Commande |
|---|---|
| Fichier unique (le plus simple) | ouvrir **`dist/cornsty.html`** dans Chrome / Edge / Safari / Firefox (double-clic, ça marche hors-ligne) |
| Version « source » | `cd cornsty-v1 && python3 -m http.server 8080` puis http://localhost:8080 (ou ouvrir `index.html` directement) |
| Reconstruire le fichier unique | `node tools/build.js` (aucune dépendance) |

Aucun serveur, aucune dépendance npm, aucun CDN : le site fait ~0,8 Mo (polices et dessins inclus) et n'appelle jamais l'extérieur.

## Ce que le visiteur vit

1. **Intro** : l'icône Cornsty se construit comme dans le book (quatrefeuille → chapeau → lunettes → bec → *« Well, hello! Let's get to know each other 🍿 »*). Choix : entrer avec ou sans le son, ou « version simple ».
2. **Le comptoir** : la Mouette se présente, demande ton prénom, puis **discute** (texte libre en français, tolérant aux fautes de frappe, + réponses rapides). Elle conseille en deux questions (salé/sucré → fromage/nature/piquant… ), présente le produit à côté d'elle, et **le comptoir se repeint aux motifs de la saveur** dont vous parlez.
3. **La machine** : dès que tu prends un pochon, caméra sur la machine — la Mouette verse les grains, tire le levier, le maïs chauffe et **éclate en physique réelle** dans la cabine vitrée (tas qui se forme, rebonds), ouvre la porte, **remplit le pochon à la pelle**, saupoudre l'assaisonnement, **scelle** le pochon et le **lance dans le panier**. Première fois : show complet (~15 s, bouton *Passer* toujours là) ; ensuite version rapide (réglable).
4. **Le vendeur** : conseil honnête (uniquement de vrais chiffres du catalogue) : Box Soirée −8 % dès 3 pochons, seuil de livraison offerte, carte à 9/10, duo de saveurs.
5. **La caisse** : panier, code promo, récompenses Club, livraison, paiement, puis **la Mouette encaisse** (touches, tiroir-caisse, ticket qui s'imprime), **ticket de caisse à la Cornsty** avec vrai **code-barres Code 39**, suivi de commande.
6. **Le Club (fidélité)** : la carte du brand book en version vivante — **10 tampons** quatrefeuille avec la tête de mouette (10ᵉ = pochon offert), **points** et 4 **paliers** (Grain → Pop → Mouette → Légende, remises −5/−10/−15 %), **série quotidienne** (le *grain du jour* : chauffe-le, il éclate), **récompenses** à échanger, **9 badges** (stickers), **parrainage**, historique + « Recommander ». Tout est appliqué automatiquement au panier.
7. **Le vestiaire** : maillot damier **personnalisable** (nom en script + numéro, aperçu face/dos en direct), casquette, peluche mouette-bouée, stickers, coffret cadeau.
8. **Et aussi** : mini-jeu **Attrape-Pop** (points Club, 1 fois/jour), la planche de surf sur laquelle on peut cliquer, caméra à parallaxe, sons **100 % synthétisés** (pop, cliquetis de caisse, tampon, voix de la Mouette lettre par lettre — désactivés tant que le visiteur ne les active pas).

## Accessibilité & robustesse

- Le kiosque a un équivalent **sans animation** : *Menu → Catalogue rapide* (liste complète, ajout au panier, mêmes tampons). Lien « Version simple » dès l'intro.
- `prefers-reduced-motion` respecté (caméra instantanée, pas de show, pas de confettis) + réglage manuel.
- Clavier : les pochons et le vestiaire sont focusables (Tab/Entrée), `/` ou Entrée pour écrire à la Mouette, `Échap` ferme les fenêtres, focus piégé dans les modales, zones `aria-live`.
- Mobile portrait pensé à part (tiroir plein écran, fiche produit compacte, caméra qui garde la machine *et* la Mouette dans le cadre).
- Tout l'état (panier, Club, commandes, préférences) est dans `localStorage`.

## Structure

```
cornsty-v1/
├─ index.html              version « source » (scripts classiques, marche en file://)
├─ dist/cornsty.html       le site en UN fichier (généré)
├─ src/js/
│  ├─ art-data.js          dessins vectoriels du brand book (GÉNÉRÉ par tools/extract-brand.py)
│  ├─ data.js              ★ catalogue, prix, livraison, règles du Club, codes promo, textes
│  ├─ store.js             état + localStorage + calcul du panier + moteur de fidélité
│  ├─ draw-*.js            pochons, maillot, casquette, stickers… + 6 motifs de saveur
│  ├─ gull.js              la Mouette (rig : tête, mâchoire, chapeau, lunettes, ailes, jambes)
│  ├─ scene*.js            le kiosque, la plage, la caméra à stations
│  ├─ pop.js               physique du pop-corn + chorégraphie du show
│  ├─ chat.js              la conversation (NLU français + vendeur)
│  ├─ shop.js              panier → livraison → paiement → encaissement → ticket
│  ├─ club.js  game.js     fidélité, carte à tampons, grain du jour, Attrape-Pop
│  └─ audio.js fx.js ui.js catalog.js intro.js main.js
├─ src/css/                base, scène, interface, panneaux
├─ assets/fonts/           League Gothic, Inter, IBM Plex Mono, Yellowtail (script du maillot)
└─ tools/                  build.js · extract-brand.py · fetch-fonts.js
```

## Personnaliser (5 minutes)

Tout ce qui est « métier » est dans **`src/js/data.js`** :

- **Prix / saveurs / packs / merch** : `flavors`, `products` (prix 4,90 € = celui du ticket du brand book).
- **Livraison** : `cfg.shipping` (franco 25 €, Colissimo/Express/retrait).
- **Fidélité** : `cfg.club` — tampons par carte, points par euro, paliers & remises, récompenses, points de la série, règles du jeu.
- **Codes promo** : `cfg.promo` (`POPPOP` = −10 % 1ʳᵉ commande, `MOUETTE` = livraison offerte).
- **Nom de la mascotte, adresse, e-mail** : `cfg.brand` (« la Mouette » est un nom provisoire).
- **Les dessins** : `assets` sont dans `src/js/art-data.js` (généré). Si tu as les SVG d'origine, relance `python3 tools/extract-brand.py ton-brandbook.pdf` ou remplace les `parts` correspondantes ; les couleurs se changent dans `draw-products.js` (`ROLEFILL`).

Puis `node tools/build.js` pour régénérer `dist/cornsty.html`.

## Brancher pour de vrai

Le site expose trois **crochets** (aucun n'est obligatoire) :

```js
// 1) PAIEMENT — remplace le formulaire de démo. Doit renvoyer { ok:true, ref, method } ou { ok:false, error }.
window.CORNSTY_PAY = async ({ amount, currency, lines, customer, shipping }) => {
  // exemple Stripe : créer une session côté serveur, rediriger, ou confirmer un PaymentIntent (Stripe Elements)
  const r = await fetch('/api/checkout', { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({ lines, customer, shipping }) });
  return r.ok ? { ok:true, ...(await r.json()) } : { ok:false, error:'Paiement refusé' };
};

// 2) COMMANDE — appelé (sans bloquer) après un paiement réussi : envoie-la à ton back-office / Shopify / n8n / Airtable…
window.CORNSTY_ORDER = (order) => fetch('/api/orders', { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify(order) });

// 3) CONVERSATION — un vrai LLM prend le relais quand les règles ne comprennent pas.
window.CORNSTY_LLM = async ({ text, name, cart, history, catalog }) => 'La réponse de la Mouette';
```

⚠️ **Ne jamais** traiter ni stocker un numéro de carte : en production utilise les champs hébergés de ton prestataire (Stripe Elements, etc.) — le formulaire de carte fourni est uniquement une démo (carte test `4242 4242 4242 4242`).
Les **points, tampons, parrainages et abonnement** sont calculés dans le navigateur : pour qu'ils soient *réels* (multi-appareils, anti-triche), il faut les recalculer/stocker côté serveur — c'est le rôle du crochet `CORNSTY_ORDER`.

## À valider avant la mise en ligne

Ces éléments sont des **placeholders** (issus du brand book ou de ma rédaction), à faire valider :

- **Nutrition / allergènes / ingrédients** : les « 4 g lipides · 12 g protéines » viennent du visuel du book ; ingrédients et allergènes sont rédigés à titre d'exemple.
- **TVA** (5,5 % alimentaire / 20 % merch), **prix**, **délais et frais de livraison**, **politique de retour**, **CGV / mentions légales / RGPD** (aucune page légale n'est fournie).
- **Consentement e-mail** : la case « recevoir les drops » est décochée par défaut (RGPD) mais aucun e-mail n'est envoyé par ce site.
- **Adresse et téléphone** du ticket : ceux du mock-up du book (24 rue des Martyrs).
- Sur les étiquettes j'ai écrit **« GOURMET POPCORN »** (le book dit « GOURMENT ») ; le texte « 1 pochon offert tous les 10 pochons » remplace le « WITH & PURCHASE » du visuel de carte.
- Le **suivi de commande** et le **parrainage** sont simulés.

## Notes techniques

- Les tracés viennent du PDF (`tools/extract-brand.py`, PyMuPDF) : chaque trait du dessin est une forme séparée, ce qui permet de **rigger** la Mouette (mâchoire, chapeau, lunettes, ailes) sans jamais la redessiner.
- Les motifs des 6 saveurs ont été **mesurés** sur les tuiles du book (périodes, angles, couleurs) puis reconstruits en géométrie.
- La caméra ne fait que **glisser** entre les stations (le rendu vectoriel reste net) ; le pop-corn est un canvas 2D avec sprites, tas par hauteur-de-colonnes.
- Testé avec Chromium (Playwright) : parcours complet, mobile 390×844, persistance, aucune erreur console. Safari/Firefox : non testés dans cet environnement.
