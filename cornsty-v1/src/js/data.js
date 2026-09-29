/* Cornsty - catalogue, configuration, copy.  EVERYTHING you would want to edit as the shop owner is in this file
   (prices, flavours, delivery rules, loyalty rules, promo codes, texts).  Values marked TODO must be validated before going live. */
(function (C) {
  'use strict';

  /* ------------------------------------------------------------------ configuration */
  C.cfg = {
    brand: {
      name: 'Cornsty',
      mascot: 'la Mouette',                       // TODO: give the character a name if you want one
      tagline: 'Big Flavor. Bigger Personality.',
      domain: 'cornsty.fr',
      address: '24 Rue des Martyrs, 75009 Paris', // from the brand-book receipt mock-up - placeholder
      phone: '+33 1 23 45 67 89',                 // placeholder
      email: 'salut@cornsty.fr',                  // placeholder
      instagram: '@cornsty',
    },
    shipping: {                                    // TODO: validate with your carrier contract
      freeFrom: 25,
      options: [
        { id: 'standard', label: 'Colissimo · 2 à 4 jours ouvrés', price: 4.9, eta: [2, 4] },
        { id: 'express', label: 'Express · 24 à 48 h', price: 7.9, eta: [1, 2] },
        { id: 'pickup', label: 'Retrait au kiosque (Paris 9e)', price: 0, eta: [0, 1] },
      ],
    },
    vat: { food: 0.055, merch: 0.2 },              // TODO: validate French VAT rates with your accountant
    club: {
      stampsPerCard: 10,                           // 10th stamp = a free pouch
      pointsPerEuro: 1,
      tiers: [
        { id: 'grain', name: 'Grain', at: 0, discount: 0, perks: ['Carte à tampons', 'Grain du jour (série quotidienne)', 'Sticker de bienvenue'] },
        { id: 'pop', name: 'Pop', at: 60, discount: 5, perks: ['−5 % sur toutes tes commandes', 'Accès anticipé aux drops'] },
        { id: 'mouette', name: 'Mouette', at: 180, discount: 10, perks: ['−10 % sur toutes tes commandes', 'Livraison offerte dès 15 €', 'Cadeau surprise à chaque palier'] },
        { id: 'legende', name: 'Légende', at: 400, discount: 15, perks: ['−15 % sur toutes tes commandes', 'Livraison toujours offerte', 'Un pochon offert pour ton anniversaire'] },
      ],
      rewards: [
        { id: 'sticker', name: 'Pack de stickers', cost: 40, kind: 'item', item: 'stickers', blurb: 'Ajouté gratuitement à ta prochaine commande.' },
        { id: 'off5', name: '−5 € sur ta commande', cost: 100, kind: 'voucher', value: 5, blurb: 'Utilisable dès 15 € d’achat.' },
        { id: 'pouch', name: 'Un pochon offert', cost: 150, kind: 'voucher', value: 'pouch', blurb: 'Le pochon de ton choix, on ne dira rien.' },
      ],
      streak: [1, 1, 2, 2, 3, 3, 5],               // points for day 1..7 of the daily "grain du jour"
      referral: { reward: 50 },                    // points for you and your friend (needs a backend to be real)
      welcome: { points: 10 },
      game: { dailyCap: 1, tiers: [[45, 10], [30, 5], [15, 2]] }, // [score >= n, points] - once a day
    },
    promo: {                                        // demo codes
      POPPOP: { type: 'pct', value: 10, label: 'Bienvenue · −10 %', firstOrderOnly: true },
      MOUETTE: { type: 'ship', label: 'Livraison offerte' },
    },
    payment: { provider: 'demo' },                 // 'demo' | 'custom' (see README: window.CORNSTY_PAY)
    drop: { name: 'Drop d’automne', day: 5, hour: 18 }, // next Friday 18:00 - purely cosmetic countdown (day: 0=Sun..6=Sat)
  };

  /* ------------------------------------------------------------------ flavours (from the brand-book packs) */
  const F = (o) => Object.assign({ kind: 'pouch', vat: 'food', price: 4.9, weight: 100, stamps: 1 }, o);
  const flavors = [
    F({
      id: 'cheddar', name: 'Cheddar', sub: 'Extra Cheesy', pattern: 'harlequin',
      colors: { base: '#FF8A00', a: '#FF9E1F', b: '#FFD65C', dark: '#C96A00', badge: '#788CE3', badgeInk: '#F8F2E0' },
      dust: '#FFB428', taste: { salty: 4, cheesy: 5, sweet: 0, spicy: 0, choco: 0, fruity: 0, indulgence: 4 },
      short: 'Le cheddar affiné qui colle aux doigts (et à la mémoire).',
      long: 'Maïs 100 % français éclaté à l’air, enrobé d’un cheddar affiné bien franc. Généreux, salé, addictif : tu regretteras seulement de ne pas en avoir pris deux.',
      ingredients: 'Maïs français, cheddar affiné, huile de tournesol, sel.', allergens: 'Lait.', tags: ['salé', 'fromage', 'classique'],
      tagline: 'La soirée ciné en un pochon',
    }),
    F({
      id: 'gaufre', name: 'Gaufre', sub: 'à la pomme', pattern: 'hex',
      colors: { base: '#A9CB3C', a: '#8FB02A', b: '#C6DE5E', dark: '#5F7B10', badge: '#DE3F39', badgeInk: '#F8F2E0' },
      dust: '#E8C36A', taste: { salty: 0, cheesy: 0, sweet: 4, spicy: 0, choco: 0, fruity: 4, indulgence: 4 },
      short: 'Pomme cuite, gaufre chaude, cannelle. Le goûter de fête foraine.',
      long: 'Du pop-corn croustillant, de la pomme cuite au four, un parfum de gaufre chaude et une pointe de cannelle. C’est le goûter de la fête foraine, en version croquante.',
      ingredients: 'Maïs français, sucre, pomme (poudre), farine de blé, beurre, cannelle.', allergens: 'Gluten (blé), lait.', tags: ['sucré', 'fruité', 'gourmand'],
      tagline: 'Le réconfort qui croque',
    }),
    F({
      id: 'wings', name: 'Wings Corean', sub: 'Coréen', pattern: 'triangles',
      colors: { base: '#DE3F39', a: '#F0574A', b: '#B92C2A', dark: '#8E1E1C', badge: '#2FB59B', badgeInk: '#F8F2E0' },
      dust: '#E5432D', taste: { salty: 3, cheesy: 0, sweet: 3, spicy: 4, choco: 0, fruity: 0, indulgence: 3 },
      short: 'Sticky, sucré-piquant, façon wings coréennes.',
      long: 'Une sauce coréenne sucrée-piquante, collante juste comme il faut, façon wings. Ça pique juste ce qu’il faut pour que tu reprennes une poignée. Puis une autre.',
      ingredients: 'Maïs français, sucre, piment gochujang, ail, sésame, sel.', allergens: 'Sésame, soja.', tags: ['piquant', 'salé', 'sucré'],
      tagline: 'Sticky, piquant, dangereux',
    }),
    F({
      id: 'nature', name: 'Nature Salé', sub: 'Popcorn', pattern: 'checker',
      colors: { base: '#3E52CF', a: '#788CE3', b: '#3E52CF', dark: '#2B3690', badge: '#F5A3C7', badgeInk: '#26232b' },
      dust: '#FFFFFF', taste: { salty: 3, cheesy: 0, sweet: 0, spicy: 0, choco: 0, fruity: 0, indulgence: 1 },
      short: 'Sel de mer, croquant net, zéro chichi.',
      long: 'Légèrement assaisonné au sel de mer pour un croquant net, propre, parfaitement équilibré. Le classique qui n’a rien à prouver.',
      ingredients: 'Maïs français, huile de tournesol, sel de mer.', allergens: 'Aucun allergène majeur.', tags: ['salé', 'léger', 'classique'],
      tagline: 'Le classique qui n’a rien à prouver',
    }),
    F({
      id: 'caramel', name: 'Caramel', sub: 'Beurre Salé', pattern: 'zigzag',
      colors: { base: '#8E3A5E', a: '#F2A7C8', b: '#8E3A5E', dark: '#5E1F3B', badge: '#788CE3', badgeInk: '#F8F2E0' },
      dust: '#F0A63C', taste: { salty: 2, cheesy: 0, sweet: 5, spicy: 0, choco: 0, fruity: 0, indulgence: 5 },
      short: 'Caramel au beurre, fleur de sel, croquant irrésistible.',
      long: 'Un caramel au beurre, une touche de fleur de sel et ce croquant qui fait des dégâts. Le côté sucré de la force, en version pop-corn.',
      ingredients: 'Maïs français, sucre, beurre, crème, fleur de sel.', allergens: 'Lait.', tags: ['sucré', 'gourmand', 'caramel'],
      tagline: 'Le sucré-salé qui fait des dégâts',
    }),
    F({
      id: 'cookies', name: 'Cookies', sub: 'Red Velvet', pattern: 'scallops',
      colors: { base: '#A3201F', a: '#C7342F', b: '#8A1717', dark: '#5F0F0F', badge: '#788CE3', badgeInk: '#F8F2E0' },
      dust: '#D24A4A', taste: { salty: 0, cheesy: 0, sweet: 4, spicy: 0, choco: 4, fruity: 0, indulgence: 5 },
      short: 'Cacao, vanille crémeuse, robe rouge velours.',
      long: 'Un mélange riche de cacao, de vanille crémeuse et de gourmandise, dans une robe rouge velours. Le dessert qui se mange devant un film (et sans partager).',
      ingredients: 'Maïs français, sucre, cacao, beurre, vanille, colorant naturel (betterave).', allergens: 'Lait, gluten (traces).', tags: ['sucré', 'chocolat', 'gourmand'],
      tagline: 'Le dessert de la soirée film',
    }),
  ];

  /* ------------------------------------------------------------------ other products */
  const products = flavors.slice();
  products.push(
    { id: 'trio', kind: 'bundle', vat: 'food', name: 'Box Soirée Ciné', sub: '3 pochons au choix', price: 13.5, was: 14.7, stamps: 3, picks: 3,
      short: 'Trois pochons, trois humeurs, une seule soirée.', long: 'Choisis 3 pochons parmi les 6 saveurs (tu peux prendre 3 fois la même, on ne juge pas).', tags: ['pack', 'soirée'], tagline: '3 pochons, −8 %' },
    { id: 'discovery', kind: 'bundle', vat: 'food', name: 'Pack Découverte', sub: 'Les 6 saveurs', price: 26, was: 29.4, stamps: 6, picks: 0, contents: flavors.map((f) => f.id),
      short: 'Toute la bande, d’un coup. Sticker offert.', long: 'Les 6 saveurs, 6 pochons de 100 g, un sticker Cornsty offert. Le meilleur moyen de savoir qui est ton préféré.', tags: ['pack', 'découverte', 'cadeau'], tagline: 'Les 6 saveurs · −11 %' },
    { id: 'tin', kind: 'tin', vat: 'food', name: 'La Tin Caramel', sub: 'Boîte collector · 250 g', price: 14.9, weight: 250, stamps: 2,
      short: 'La boîte en métal qu’on garde (et qu’on remplit).', long: 'Une boîte en métal collector zigzag rose, avec le couvercle à la mouette, remplie de pop-corn caramel beurre salé. Tu la finiras. Tu la garderas.', tags: ['cadeau', 'sucré', 'collector'],
      ingredients: 'Maïs français, sucre, beurre, crème, fleur de sel.', allergens: 'Lait.', tagline: 'Collector · 250 g' },
    { id: 'giftbox', kind: 'gift', vat: 'food', name: 'Box Snack Energy', sub: 'Coffret cadeau', price: 19.9, stamps: 3,
      short: '3 pochons, des stickers et un mot doux dans le coffret damier.', long: 'Le coffret damier « Shhhh! » : 3 pochons (Cheddar, Caramel, Nature Salé), un pack de stickers et une carte avec ton message. Le cadeau qui dit « je pense à toi et à ton ventre ».', tags: ['cadeau', 'pack'],
      contents: ['cheddar', 'caramel', 'nature'], allergens: 'Lait.', tagline: 'Le cadeau qui fait plaisir' },
    { id: 'jersey', kind: 'merch', vat: 'merch', name: 'Maillot Cornsty', sub: 'Édition oversize · bleu damier', price: 45, stamps: 0, sizes: ['XS', 'S', 'M', 'L', 'XL'], personalize: { price: 6, maxName: 10 },
      short: 'Le maillot damier, avec ton nom dans le dos.', long: 'Maillot oversize bleu damier, col crème, écusson mouette sur la manche. Personnalisable : ton nom en lettres script et ton numéro, comme sur le terrain.', tags: ['merch', 'cadeau', 'vêtement'], tagline: 'Ton nom dans le dos' },
    { id: 'cap', kind: 'merch', vat: 'merch', name: 'Casquette Signature Pattern', sub: 'Arlequin orange · taille unique', price: 28, stamps: 0, sku: 'CS-CAP-2401',
      short: 'Arlequin orange, écusson mouette, pas de chichis.', long: 'La casquette arlequin orange avec l’écusson Cornsty brodé. Taille unique, réglable, 150 g de bonne humeur.', tags: ['merch', 'vêtement'], tagline: 'Arlequin orange' },
    { id: 'plush', kind: 'merch', vat: 'merch', name: 'Peluche Mouette Bouée', sub: 'Porte-clés · cordon rouge', price: 12, stamps: 0,
      short: 'La mouette en bouée, en peluche, à accrocher partout.', long: 'La mouette en bouée, brodée et douce, avec son cordon rouge : à accrocher au sac, aux clés, à la ceinture.', tags: ['merch', 'cadeau', 'petit prix'], tagline: 'À accrocher partout' },
    { id: 'stickers', kind: 'merch', vat: 'merch', name: 'Pack de stickers', sub: '6 stickers vinyle', price: 4, stamps: 0,
      short: 'POP IT HARDER, SAME SNACK ENERGY, SHHHH!… pour ton laptop.', long: '6 stickers vinyle résistants : la mouette surfeuse, la mouette bouée, « Pop it harder! », « Same snack energy », « Shhhh! » et le logo.', tags: ['merch', 'petit prix'], tagline: '6 stickers vinyle' }
  );

  C.data = {
    flavors,
    products,
    byId: (id) => products.find((p) => p.id === id),
    pouches: flavors,
    faq: [
      { q: 'Livraison', k: ['livraison', 'livrer', 'delai', 'délai', 'colis', 'expedition', 'expédition', 'recevoir', 'colissimo'], a: 'Colissimo en 2 à 4 jours ouvrés (4,90 €), offerte dès 25 €. Express en 24-48 h pour 7,90 €. Tu peux aussi passer chercher ta commande au kiosque à Paris 9e.' },
      { q: 'Retours', k: ['retour', 'retourner', 'rembours', 'echange', 'échange', 'taille'], a: 'Maillot et casquette : 14 jours pour changer d’avis (non portés). Le pop-corn ne se reprend pas, mais s’il y a le moindre souci, écris-nous : on rembourse ou on renvoie, sans discuter.' },
      { q: 'Allergènes', k: ['allergene', 'allergène', 'allergie', 'gluten', 'lactose', 'lait', 'arachide', 'noix', 'vegan', 'végétarien', 'vegetarien'], a: 'Toutes les fiches indiquent les allergènes. Le Cheddar, le Caramel et le Cookies contiennent du lait, la Gaufre du gluten. Le Nature Salé n’a aucun allergène majeur. Dans le doute, demande-moi la saveur qui t’intéresse.' },
      { q: 'Conservation', k: ['conserv', 'dlc', 'dluo', 'peremption', 'péremption', 'fraicheur', 'fraîcheur', 'garde'], a: 'À l’abri de l’humidité et de la lumière, pochon bien refermé. Le pop-corn est meilleur dans les semaines qui suivent l’ouverture… en pratique, il ne dure pas 24 h.' },
      { q: 'Paiement', k: ['paiement', 'payer', 'carte bancaire', 'cb', 'securise', 'sécurisé', 'apple pay', 'paypal'], a: 'Paiement par carte bancaire via un prestataire sécurisé. Ici, c’est un mode démo : aucun paiement réel n’est effectué.' },
      { q: 'Revendeurs', k: ['revendeur', 'grossiste', 'pro', 'b2b', 'boutique', 'epicerie', 'épicerie', 'wholesale'], a: 'Tu tiens une épicerie, un café, un cinéma ? On fait aussi du wholesale. Écris à ' + 'salut@cornsty.fr' + ' et on te répond vite.' },
    ],
    jokes: [
      'Pourquoi le grain de maïs n’a jamais menti ? Parce qu’il finit toujours par éclater la vérité.',
      'Je suis une mouette, pas un pigeon : moi je ne vole que du pop-corn. Et encore, seulement le mien.',
      'Un grain de maïs entre chez le médecin : « Docteur, j’ai chaud, je sens que je vais éclater. » « Détends-toi, c’est juste l’émotion. »',
      'Quel est le sport préféré du pop-corn ? Le saut en hauteur. Certains grains montent à près d’un mètre.',
      'Le pop-corn, c’est comme moi : plus on chauffe, plus on prend de la place.',
    ],
    facts: [
      'Un grain de pop-corn éclate quand l’eau enfermée dedans dépasse les 180 °C : la vapeur fait exploser l’enveloppe. Pop !',
      'Le pop-corn est une céréale complète. Oui, techniquement, tu manges des céréales devant ton film.',
      'Certains grains sautent presque un mètre de haut : une centaine de fois leur taille. Moi, je ne saute pas si haut, j’ai un chapeau à protéger.',
      'Chez Cornsty, on éclate le maïs à l’air : pas de gras inutile, juste du croquant.',
    ],
  };

  C.data.shipOption = (id) => C.cfg.shipping.options.find((o) => o.id === id) || C.cfg.shipping.options[0];
})((window.Cornsty = window.Cornsty || {}));
