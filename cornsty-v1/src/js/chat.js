/* Cornsty - the conversation: French rule-based NLU (typo tolerant), a salesman with a personality (honest upsell: only real offers),
   quick replies, taste advice in two questions, cart / club / FAQ / jokes / small talk. Plug an LLM through window.CORNSTY_LLM (see README). */
(function (C) {
  'use strict';
  const U = C.util, UI = C.ui, D = C.draw;
  const CH = (C.chat = { ctx: { name: '', awaiting: null, last: null, lastRecommended: null, pending: null, upsellDeclined: 0, adds: 0, asked: {}, idlePings: 0, mood: 0 } });
  const X = CH.ctx;
  const g = () => C.scene.gull;
  const name = () => C.store.state.prefs.name || '';
  const fl = (id) => C.data.byId(id);
  const eur = U.eurPlain;
  const recent = new Set();
  const pick = (arr) => { const pool = arr.filter((x) => !recent.has(x)); const v = U.pick(pool.length ? pool : arr); recent.add(v); if (recent.size > 24) recent.delete(recent.values().next().value); return v; };
  const nm = () => (name() ? ' **' + name() + '**' : '');

  /* ------------------------------------------------------------------ text helpers */
  const norm = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’'`]/g, ' ').replace(/[^a-z0-9€ ]+/g, ' ').replace(/\s+/g, ' ').trim();
  const lev = (a, b) => { if (a === b) return 0; const m = a.length, n = b.length; if (Math.abs(m - n) > 2) return 3; const d = Array.from({ length: m + 1 }, (_, i) => [i]); for (let j = 1; j <= n; j++) d[0][j] = j; for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); return d[m][n]; };
  const has = (tokens, words, fuzzy = true) => tokens.some((t) => words.some((w) => t === w || (fuzzy && t.length >= 5 && w.length >= 5 && lev(t, w) <= (w.length >= 8 ? 2 : 1))));
  const NUM = { un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7, huit: 8, neuf: 9, dix: 10 };

  const FLAV = {
    cheddar: ['cheddar', 'chedar', 'cheder', 'fromage', 'cheesy', 'cheese', 'fromager', 'extra'],
    gaufre: ['gaufre', 'gaufres', 'gauffre', 'pomme', 'cannelle', 'waffle'],
    wings: ['wings', 'wing', 'corean', 'coreen', 'coreenne', 'gochujang', 'poulet', 'ailes'],
    nature: ['nature', 'classique', 'simple', 'basique'],
    caramel: ['caramel', 'caramels', 'carmel', 'beurre'],
    cookies: ['cookies', 'cookie', 'velvet', 'redvelvet', 'biscuit', 'biscuits'],
  };
  const TASTE = {
    sweet: ['sucre', 'sucree', 'sucres', 'dessert', 'gourmand', 'gourmande', 'gourmandise', 'douceur', 'doux'],
    salty: ['sale', 'salee', 'sales', 'sel', 'apero'],
    spicy: ['pique', 'piquant', 'piquante', 'epice', 'epicee', 'pimente', 'pimentee', 'fort', 'relevee'],
    cheese: ['fromage'], choco: ['chocolat', 'choco', 'cacao'], fruity: ['fruit', 'fruite', 'fruitee', 'fruits'],
  };
  const parseQty = (tokens, idx) => { for (let k = Math.max(0, idx - 3); k < idx; k++) { const t = tokens[k]; if (/^\d{1,2}$/.test(t)) return +t; if (NUM[t]) return NUM[t]; } return 1; };

  const analyze = (text) => {
    const n = norm(text), tokens = n.split(' ').filter(Boolean), out = { n, tokens, flavors: [], tastes: [] };
    for (const [id, words] of Object.entries(FLAV)) { const i = tokens.findIndex((t) => words.some((w) => t === w || (t.length >= 5 && w.length >= 5 && lev(t, w) <= 1))); if (i >= 0 && !(id === 'cheddar' && tokens[i] === 'extra' && !n.includes('cheesy'))) out.flavors.push({ id, qty: parseQty(tokens, i), at: i }); }
    if (/nature sale|sel de mer/.test(n) && !out.flavors.some((f) => f.id === 'nature')) out.flavors.push({ id: 'nature', qty: 1, at: 0 });
    if (/red velvet/.test(n) && !out.flavors.some((f) => f.id === 'cookies')) out.flavors.push({ id: 'cookies', qty: 1, at: 0 });
    for (const [t, words] of Object.entries(TASTE)) if (has(tokens, words)) out.tastes.push(t);
    out.qty = out.flavors[0] ? out.flavors[0].qty : 1;
    return out;
  };

  const YES = /^(oui|ouais|ouai|yes|yep|yeah|ok|okay|d accord|dac|carrement|volontiers|bien sur|allez|vas y|go|banco|top|parfait|pourquoi pas|si tu veux|je veux bien|avec plaisir|bien entendu|evidemment|grave|clair|exact)\b/;
  const NO = /^(non|nan|nope|pas|bof|non merci|plus tard|laisse|jamais|nada|sans)\b/;
  const RULES = [
    ['bye', /\b(au revoir|a plus|a bientot|a demain|ciao|bye|adieu|bonne (soiree|journee|nuit)|je m en vais|je pars)\b/],
    ['thanks', /\b(merci|thanks|thx|c est gentil|sympa|cool)\b/],
    ['who', /\b(qui es tu|t es qui|qui etes vous|ton nom|comment tu t appelles|tu t appelles|t appelles comment|c est quoi ton nom|mouette|goeland|oiseau)\b/],
    ['joke', /\b(blague|drole|rigole|rire|humour|devinette)\b/],
    ['fact', /\b(anecdote|savais|fun fact|le saviez|raconte|histoire|lecon|apprends)\b/],
    ['love', /\b(je t aime|adore|genial|trop bien|incroyable|magnifique|mignon|beau|top|bravo|bien joue|fantastique|excellent)\b/],
    ['insult', /\b(nul|bete|con|idiot|debile|stupide|naze|moche|ferme la|tais toi|degage)\b/],
    ['help', /\b(aide|aider|help|comment ca marche|comment faire|je comprends pas|explique|mode d emploi|tuto)\b/],
    ['price', /\b(prix|combien|coute|couter|tarif|cher|€|euros?)\b/],
    ['ship', /\b(livraison|livrer|delai|colis|expedition|expedier|recevoir|colissimo|frais de port|port|retrait|retirer)\b/],
    ['club', /\b(club|fidelite|fidele|points?|tampons?|carte|recompense|palier|niveau|serie|streak|parrain|parrainage|avantage|remise|reduction|code)\b/],
    ['grain', /\b(grain du jour|grain|chauffe|quotidien|bonus du jour|check ?in)\b/],
    ['game', /\b(jeu|jouer|attrape|arcade|partie|mini jeu)\b/],
    ['cartview', /\b(panier|mon panier|qu est ce que j ai|recap)\b/],
    ['checkout', /\b(caisse|payer|paiement|commander|valider|regler|checkout|encaisse|encaisser|c est bon|j ai fini|finir|terminer|c est tout)\b/],
    ['clear', /\b(vide|vider|supprime|supprimer|enleve|enlever|retire|retirer|annule|annuler|efface|recommence)\b/],
    ['merch', /\b(maillot|jersey|casquette|cap|peluche|porte cles|sticker|stickers|merch|vetement|t ?shirt|goodies|vestiaire|fringue)\b/],
    ['gift', /\b(cadeau|offrir|anniv|anniversaire|fete|coffret|box|surprise pour|pour offrir|noel)\b/],
    ['machine', /\b(machine|comment tu fais|fabrique|fabrication|montre moi|eclate|eclater|show|spectacle|regarde|demonstration)\b/],
    ['sound', /\b(son|sons|musique|bruit|mute|muet|silence|volume|audio)\b/],
    ['hours', /\b(horaire|horaires|ouvert|ouverture|adresse|ou etes|ou se trouve|boutique|magasin|paris|localisation)\b/],
    ['wholesale', /\b(revendeur|grossiste|professionnel|pro|b2b|wholesale|epicerie|cinema|cafe|restaurant)\b/],
    ['drop', /\b(drop|nouveaute|nouveautes|edition limitee|prochain|prochaine|sortie|bientot)\b/],
    ['reco', /\b(conseil|conseille|recommande|recommandation|choisir|choisis|hesite|indecis|sais pas|surprends|surprise|hasard|aleatoire|propose|suggere|decide pour moi|quoi prendre|que prendre|meilleur|prefere|favori|best seller|plus vendu)\b/],
    ['browse', /\b(regarde|juste regarder|je regarde|curieux|visite|balade)\b/],
    ['greet', /^(bonjour|bonsoir|salut|hello|hey|coucou|yo|wesh|hi|hola|ola)\b/],
    ['name', /\b(je m appelle|moi c est|appelle moi|mon prenom|mon nom est|je suis)\b/],
  ];

  /* ------------------------------------------------------------------ speaking helpers */
  const say = async (lines, o = {}) => { const gl = g(); if (o.act) gl.act(o.act, ...(o.args || [])); await UI.say(lines, o); };
  const chips = (list, o) => UI.chips(list, o);
  const C_MORE = { t: 'Autre chose', act: 'other' };
  const arm = () => { clearTimeout(CH._idle); CH._idle = setTimeout(idlePing, 42000); };
  // any interaction re-arms the timer; if she had dozed off, she wakes up with a squawk
  const idleReset = () => { if (X.asleep) { X.asleep = false; g().rest(); g().act('surprise'); } arm(); };
  const idlePing = async () => {
    if (C.pop.busy() || UI.modalStack.length || document.hidden) return arm();
    X.idlePings++;
    if (X.idlePings === 4 && !U.reduced()) { X.asleep = true; UI.hideBubble(); g().act('nap'); return; }
    if (X.idlePings > 3) return;
    if (X.idlePings === 1) { g().act('nod'); } else if (X.idlePings === 2) { g().act('wave'); await say(pick(['Tu dors ? Le pop-corn refroidit…', 'Psst. Le kiosque est ouvert, hein.', 'Je peux éclater un pochon à blanc si tu veux. Juste pour la déco.']), { hold: 0 }); chips(CH.mainChips()); } else { g().act('hop'); await say('Je vais me faire un grain moi-même. Ne dis rien.', {}); }
    arm();
  };

  CH.mainChips = () => {
    const c = C.store.state.club, list = [{ t: 'Du salé', act: 'taste:salty' }, { t: 'Du sucré', act: 'taste:sweet' }, { t: 'Surprends-moi', act: 'reco', cls: 'blue' }];
    if (C.store.club.checkinAvailable()) list.push({ t: '🍿 Mon grain du jour', act: 'grain' });
    if (C.store.cart.count()) list.push({ t: 'Passer à la caisse', act: 'checkout', cls: 'red' }); else list.push({ t: 'Le Club', act: 'club' });
    return list;
  };

  /* ------------------------------------------------------------------ flows */
  CH.start = async () => {
    idleReset();
    const gl = g(), st = C.store.state, os = st.orders, nmv = name();
    if (nmv || os.length) {
      const last = os[0], lf = last && last.lines[0];
      gl.act('wave');
      await say(pick([`Re-salut${nm()} ! 🍿 Content de te revoir.`, `Tiens, tiens : ${nmv ? '**' + nmv + '**' : 'mon client préféré'} !`, `Well, hello again${nm()} !`]), { hold: 200 });
      const opts = [];
      if (last) opts.push({ t: 'Refaire ma dernière commande', act: 'reorder', cls: 'red' });
      opts.push(...CH.mainChips().slice(0, 3));
      if (C.store.club.checkinAvailable()) await say('Au fait, ton **grain du jour** t’attend.', { hold: 100 });
      chips(opts);
    } else {
      gl.act('wave');
      await say(['Well, hello ! 👋 Moi c’est **la Mouette** : je tiens le kiosque, je mange le pop-corn tombé par terre, et je conseille les clients.', 'Et toi, c’est quoi ton prénom ?'], { gap: 500 });
      X.awaiting = 'name';
      chips([{ t: 'Je préfère rester mystérieux', act: 'noname' }]);
      UI.els.input.placeholder = 'Ton prénom…';
    }
  };

  const setName = async (raw) => {
    let n = raw.replace(/^(je m appelle|je m'appelle|moi c est|moi c'est|appelle moi|appelle-moi|c est|c'est|je suis|mon prenom est|mon prénom est)\s+/i, '').replace(/[^A-Za-zÀ-ÿ' \-]/g, '').trim();
    n = n.split(/\s+/).slice(0, 2).join(' ').slice(0, 20); if (!n) return false;
    n = n.replace(/\b\p{L}/gu, (c) => c.toUpperCase());
    C.store.prefs({ name: n }); X.awaiting = null; UI.els.input.placeholder = 'Écris à la Mouette…';
    g().act('tipHat');
    await say([`Ravi de te rencontrer, **${n}**.`, 'Ici on éclate du maïs 100 % français, on l’enrobe de saveurs qui ont du caractère, et on ne t’oblige jamais à rester poli.', 'Alors, qu’est-ce qui te ferait plaisir ?'], { gap: 450 });
    chips(CH.mainChips());
    if (C.club && C.club.pillBump) C.club.pillBump();
    return true;
  };

  /* ---- advice: two questions max */
  const REC = { salty: ['cheddar', 'nature', 'wings'], sweet: ['caramel', 'cookies', 'gaufre'], spicy: ['wings'], cheese: ['cheddar'], choco: ['cookies'], fruity: ['gaufre'] };
  const pickFor = (taste) => {
    const st = C.store.state, tried = st.club.tried, cart = new Set(C.store.cart.items().map((i) => i.id));
    const pool = (REC[taste] || C.data.flavors.map((f) => f.id)).slice();
    const fresh = pool.filter((id) => !tried[id] && !cart.has(id)); const notInCart = pool.filter((id) => !cart.has(id));
    return U.pick(fresh.length ? fresh : notInCart.length ? notInCart : pool);
  };
  CH.askTaste = async (taste) => {
    const gl = g();
    if (taste === 'salty') { gl.act('nod'); await say(pick(['Salé… Un homme (ou une mouette) de goût.', 'Salé, j’aime ça. Le sel, c’est la vie.']), { hold: 100 }); await say('Plutôt **fromage fondant**, **sel de mer tout simple**, ou un truc qui **pique** ?'); chips([{ t: 'Fromage', act: 'flavor:cheddar' }, { t: 'Nature, sel de mer', act: 'flavor:nature' }, { t: 'Ça pique !', act: 'flavor:wings' }]); }
    else if (taste === 'sweet') { gl.act('nod'); await say(pick(['Sucré : le côté obscur de la force.', 'Une âme gourmande. On va bien s’entendre.']), { hold: 100 }); await say('**Caramel** au beurre salé, **chocolat** velours, ou **fruité** ?'); chips([{ t: 'Caramel beurre salé', act: 'flavor:caramel' }, { t: 'Cookies Red Velvet', act: 'flavor:cookies' }, { t: 'Gaufre à la pomme', act: 'flavor:gaufre' }]); }
    else CH.recommend(taste);
  };
  CH.recommend = async (taste) => {
    const id = pickFor(taste); X.lastRecommended = id; const p = fl(id);
    g().act('think'); await UI.think(500);
    const tried = C.store.state.club.tried[id];
    await say([pick([`Je te sens **${p.name} ${p.sub}**.`, `Pour toi : **${p.name} ${p.sub}**. Fais-moi confiance.`, `Mon bec me dit **${p.name}**.`]), p.short + (tried ? ' (Tu connais déjà : c’est une valeur sûre.)' : ' Nouveau pour toi, en plus.')], { gap: 350 });
    CH.showProduct(id, { rec: true });
  };
  CH.showProduct = (id, o = {}) => {
    const p = fl(id); if (!p) return; X.last = id;
    if (p.kind === 'pouch') C.scene.paint(id);
    const from = o.from; C.catalog.spot(id, { from });
    g().act('present', 1, 1300);
    chips([{ t: 'Je le prends !', act: 'add:' + id + ':1', cls: 'red' }, { t: 'Un autre', act: 'other' }, { t: 'Plus d’infos', act: 'info:' + id }]);
  };

  /* ---- adding to the cart (with the show), then the honest upsell */
  CH.add = async (id, qty = 1, opts = {}, extra = {}) => {
    const p = fl(id); if (!p) return;
    idleReset(); X.awaiting = null;
    C.catalog.closeSpot(); chips([]);
    const first = !C.store.state.prefs.seenShow && p.kind === 'pouch';
    if (p.kind === 'pouch' || p.id === 'trio' || p.id === 'discovery') {
      await say(first ? pick(['Excellent choix. Regarde-moi faire : c’est la partie que je préfère.', 'Bien vu ! Une seconde, je m’occupe de la machine.']) : pick(['Ça part !', 'Hop, au four !', 'Un de plus, un !']), { hold: 0, instant: !first });
    } else { await say(pick(['Bon choix !', 'Excellent goût.', 'Je te mets ça de côté.']), { instant: true }); }
    C.audio.unlock();
    await C.shop.add(id, qty, opts, extra);
    X.adds++;
    if (C.scene.station === 'machine') C.scene.goto('counter');
    await CH.afterAdd(id, qty);
  };
  CH.afterAdd = async (id, qty) => {
    const q = C.store.quote(), p = fl(id), gl = g();
    gl.act('hop');
    const lines = [];
    lines.push(pick([`Et voilà : ${qty > 1 ? qty + ' × ' : ''}**${p.name}** dans ton panier.`, `**${p.name}** est au chaud dans ton panier.`, `C’est fait. **${p.name}**, croustillant garanti.`]));
    // one upsell at most, only real numbers
    let up = null; const pouches = q.lines.filter((l) => l.p.kind === 'pouch').reduce((n, l) => n + l.qty, 0), stamps = C.store.state.club.stamps;
    if (pouches === 3 && !q.lines.some((l) => l.id === 'trio') && X.upsellDeclined < 2) up = { type: 'trio', t: 'Tu as 3 pochons : en **Box Soirée Ciné** ça fait **13,50 €** au lieu de 14,70 €. Je te fais la conversion ?', chips: [{ t: 'Oui, convertis', act: 'convert', cls: 'red' }, { t: 'Non merci', act: 'declineup' }] };
    else if (q.freeShipGap > 0 && q.freeShipGap <= 6 && q.count) up = { type: 'ship', t: `Plus que **${eur(q.freeShipGap)}** pour la livraison offerte.`, chips: [{ t: '+ Pack de stickers (4 €)', act: 'add:stickers:1' }, { t: '+ un pochon', act: 'other' }, { t: 'Non merci', act: 'declineup' }] };
    else if (stamps + q.stamps >= C.cfg.club.stampsPerCard - 1 && q.stamps) up = { type: 'stamp', t: (stamps + q.stamps >= C.cfg.club.stampsPerCard) ? 'Avec ça, ta **carte est pleine** : un pochon offert dans ta prochaine commande !' : 'Ta carte sera à **9/10** : le prochain pochon est offert !' };
    else if (X.upsellDeclined < 2 && X.adds % 2 === 1 && PAIRS[id] && !q.lines.some((l) => l.id === PAIRS[id])) { const pr = fl(PAIRS[id]); up = { type: 'pair', t: `Petit conseil de mouette : **${pr.name}** avec ça. ${PAIR_LINE[id] || 'Les contrastes, ça marche.'}`, chips: [{ t: '+ ' + pr.name, act: 'add:' + pr.id + ':1', cls: 'blue' }, { t: 'Non merci', act: 'declineup' }] }; }
    await say(lines, { hold: up ? 250 : 0 });
    if (up) { await say(up.t); chips(up.chips || [{ t: 'Autre chose', act: 'other' }, { t: 'Passer à la caisse', act: 'checkout', cls: 'red' }]); }
    else chips([{ t: 'Autre chose', act: 'other' }, { t: 'Passer à la caisse', act: 'checkout', cls: 'red' }, { t: 'Le Club', act: 'club' }]);
  };
  const PAIRS = { cheddar: 'caramel', caramel: 'cheddar', nature: 'cookies', cookies: 'nature', wings: 'nature', gaufre: 'caramel' };
  const PAIR_LINE = { cheddar: 'Sucré-salé : le Caramel calme le Cheddar, et inversement.', caramel: 'Le Cheddar lui répond : c’est la dispute qui finit bien.', nature: 'Le Cookies fait le contrepoids sucré.', cookies: 'Un Nature entre deux : ça rince le palais.', wings: 'Le Nature éteint l’incendie.', gaufre: 'Le Caramel, c’est le duo goûter de fête foraine.' };

  /* ---- cart / checkout */
  CH.checkout = async () => {
    const q = C.store.quote(); C.catalog.closeSpot(); chips([]);
    if (!q.count) { g().act('shrug'); await say('Ton panier est vide… comme mon ventre. Dis-moi ce qui te tente !'); chips(CH.mainChips()); return; }
    await say(pick(['Direction la caisse !', 'La caisse, c’est moi. Suis-moi.']), { hold: 0, instant: true });
    CH.goStation('register'); C.shop.open();
  };
  CH.cartSummary = async () => {
    const q = C.store.quote();
    if (!q.count) { await say('Ton panier est vide. Le mien aussi, d’ailleurs.'); chips(CH.mainChips()); return; }
    await say(`Dans ton panier : ${q.lines.map((l) => l.qty + ' × **' + l.name + '**').join(', ')}. Total **${eur(q.total)}**${q.shipping === 0 ? ', livraison offerte' : ''}.`);
    chips([{ t: 'Passer à la caisse', act: 'checkout', cls: 'red' }, { t: 'Autre chose', act: 'other' }, { t: 'Tout vider', act: 'clear' }]);
  };

  /* ---- stations (tabs) */
  CH.goStation = async (name) => {
    const S = C.scene; UI.tab(name); C.catalog.closeSpot(); idleReset();
    if (name === 'register') { S.goto('register'); S.gullTo('register'); return; }
    S.goto(name); await S.gullTo(name === 'counter' ? 'counter' : name);
    if (name === 'machine' && !C.pop.busy()) {
      await say(['Ici, ça pétille.', 'Choisis une saveur et je te montre comment on éclate un pochon.']);
      chips(C.data.flavors.map((f) => ({ t: f.name, act: 'add:' + f.id + ':1' })));
    } else if (name === 'merch') {
      await say('Le vestiaire ! Maillot damier, casquette arlequin, peluche, stickers… Touche ce qui te plaît.'); g().act('present', 1);
      chips([{ t: 'Le maillot', act: 'merch:jersey' }, { t: 'La casquette', act: 'merch:cap' }, { t: 'La peluche', act: 'merch:plush' }, { t: 'Les stickers', act: 'merch:stickers' }]);
    } else if (name === 'counter') { chips(CH.mainChips()); }
  };
  CH.pickShelf = (id, from) => { idleReset(); C.audio.click(); if (C.scene.station !== 'counter') { C.scene.goto('counter'); UI.tab('counter'); C.scene.gullTo('counter'); } C.store.state.chat.seenFlavors[id] = true; CH.discuss(id, from); };
  CH.discuss = async (id, from) => {
    const p = fl(id); X.awaiting = null; X.last = id;
    if (p.kind === 'pouch') C.scene.paint(id);
    C.catalog.spot(id, { from }); g().act('present', 1, 1200);
    const tried = C.store.state.club.tried[id];
    await say(pick([`**${p.name} ${p.sub || ''}** ! ${p.tagline ? p.tagline + '.' : ''}`, `Ah, **${p.name}**. ${p.short}`]), { hold: 100 });
    chips([{ t: 'Je le prends !', act: 'add:' + id + ':1', cls: 'red' }, ...(p.kind === 'pouch' ? [{ t: 'Un autre', act: 'other' }] : []), { t: 'Plus d’infos', act: 'info:' + id }]);
  };
  CH.pickMerch = async (id, from) => {
    idleReset(); C.audio.click();
    if (C.scene.station !== 'merch') { UI.tab('merch'); C.scene.goto('merch'); await C.scene.gullTo('merch'); }
    CH.discuss(id, from);
  };

  /* ---- intents */
  const FUN = { joke: () => pick(C.data.jokes), fact: () => pick(C.data.facts) };
  const respond = async (a, text) => {
    const n = a.n, t = a.tokens, gl = g();
    // 1. explicit "add" (verb + flavour) or a flavour + quantity
    const buyVerb = /\b(je prends|j en veux|j en prends|ajoute|ajouter|mets|mettre|donne|donne moi|prends|commande|je veux|je voudrais|je vais prendre|il me faut|met moi|un pochon|des pochons)\b/.test(n);
    const qtyPhrase = a.flavors.length && t.length <= 4 && /^(\d{1,2}|un|une|deux|trois|quatre|cinq|six)$/.test(t[0]);
    if (a.flavors.length && (buyVerb || qtyPhrase || X.awaiting === 'flavor')) {
      for (const f of a.flavors.slice(0, 3)) await CH.add(f.id, f.qty || 1);
      return;
    }
    // 2. contextual yes / no
    if (YES.test(n) && X.pending) { const pnd = X.pending; X.pending = null; return CH.act(pnd.yes); }
    if (NO.test(n) && X.pending) { const pnd = X.pending; X.pending = null; return CH.act(pnd.no || 'declineup'); }
    if (YES.test(n) && X.last && !a.flavors.length) { return CH.add(X.last, 1); }
    // 3. flavours / tastes
    if (a.flavors.length) { const f = a.flavors[0]; return CH.discuss(f.id); }
    if (a.tastes.length) return CH.askTaste(a.tastes[0] === 'cheese' ? 'cheese' : a.tastes[0]);
    // 4. rule intents
    const hit = RULES.find(([, re]) => re.test(n));
    const id = hit && hit[0];
    switch (id) {
      case 'greet': gl.act('wave'); await say(pick([`Salut${nm()} !`, 'Well, hello !', 'Hey ! Content de te voir.']), {}); return chips(CH.mainChips());
      case 'bye': gl.act('tipHat'); await say(pick([`À bientôt${nm()} ! Reviens chercher ton grain demain.`, 'Passe une bonne journée. Et mange du pop-corn.']), {}); return chips([{ t: 'Finalement, un dernier…', act: 'other' }]);
      case 'thanks': gl.act('nod'); return say(pick(['Avec plaisir. C’est pour ça que je suis là.', 'De rien. Le pourboire, c’est du pop-corn.', 'Le plaisir est partagé.']));
      case 'who': gl.act('tipHat'); await say(['Je suis **la Mouette**, la mascotte (et l’unique employée) de Cornsty.', 'Je porte un chapeau, des lunettes et je m’y connais en maïs. C’est tout ce que j’ai à dire sur ma vie privée.']); return chips(CH.mainChips());
      case 'joke': gl.act('laugh'); await say(FUN.joke()); return chips([{ t: 'Une autre !', act: 'joke' }, { t: 'Retour au pop-corn', act: 'other' }]);
      case 'fact': gl.act('think'); await say(FUN.fact()); return chips([{ t: 'Encore !', act: 'fact' }, { t: 'Retour au pop-corn', act: 'other' }]);
      case 'love': gl.act('love'); return say(pick(['Arrête, je vais rougir sous mes plumes.', 'Merci ! Note à moi-même : garder ce client.', 'Je le savais. Enfin, j’espérais.']));
      case 'insult': gl.act('shake'); await say(pick(['Oh, c’est pas gentil… Je vais bouder derrière mon comptoir.', 'Aïe. Ça pique plus que le Wings Corean.', 'Moi aussi je t’aime bien, en fait.'])); return chips(CH.mainChips());
      case 'help': await say(['Facile : tu me dis ce que tu aimes (**salé**, **sucré**, **piquant**…), je te conseille, tu ajoutes, et je m’occupe de la machine.', 'Tu peux aussi toucher les pochons sur l’étagère, ou écrire « 2 cheddar ».']); return chips(CH.mainChips());
      case 'price': await say(`Nos pochons de 100 g sont à **${eur(4.9)}**. La Box Soirée (3 pochons) à **${eur(13.5)}**, le Pack Découverte (les 6) à **${eur(26)}**. Livraison offerte dès **${eur(C.cfg.shipping.freeFrom)}**.`); return chips([{ t: 'Le Pack Découverte', act: 'discuss:discovery' }, { t: 'La Box Soirée', act: 'discuss:trio' }, C_MORE]);
      case 'ship': await say(C.data.faq[0].a); return chips([{ t: 'Passer à la caisse', act: 'checkout', cls: 'red' }, C_MORE]);
      case 'club': gl.act('present'); await say(['Le **Club**, c’est simple : **1 pochon = 1 tampon**, et à 10 tampons **un pochon est offert**. Chaque euro dépensé rapporte aussi des points : ils font monter ton palier (Grain, Pop, Mouette, Légende) et débloquent des remises.', 'Et il y a le **grain du jour** : reviens chaque jour, ta série te rapporte des points en plus.']); return chips([{ t: 'Voir ma carte', act: 'club:open', cls: 'blue' }, ...(C.store.club.checkinAvailable() ? [{ t: '🍿 Mon grain du jour', act: 'grain' }] : []), C_MORE]);
      case 'grain': if (C.store.club.checkinAvailable()) { await say('Vas-y, chauffe-le !', { instant: true }); return C.club.grain(); } await say('Ton grain du jour est déjà éclaté. Reviens demain : ta série continue.'); return chips([{ t: 'Voir ma série', act: 'club:open' }, C_MORE]);
      case 'game': await say('Attrape-Pop : rattrape le pop-corn avec ton pochon, évite les grains cramés. Une partie par jour rapporte des points.'); return chips([{ t: 'Jouer !', act: 'game', cls: 'red' }, C_MORE]);
      case 'cartview': return CH.cartSummary();
      case 'checkout': return CH.checkout();
      case 'clear': if (C.store.cart.count()) { C.store.cart.clear(); await say('Panier vidé. On repart à zéro.'); } else await say('Il n’y avait rien à vider.'); return chips(CH.mainChips());
      case 'merch': { const m = /maillot|jersey/.test(n) ? 'jersey' : /casquette|cap/.test(n) ? 'cap' : /peluche|porte cles/.test(n) ? 'plush' : /sticker/.test(n) ? 'stickers' : null; if (m) return CH.pickMerch(m); return CH.goStation('merch'); }
      case 'gift': await say(['Un cadeau ? Excellente idée : les gens heureux mangent du pop-corn.', 'Le **Pack Découverte** (les 6 saveurs), la **Box Snack Energy** (coffret damier) ou la **Tin Caramel** collector : tous se glissent dans un papier de soie avec ton petit mot.']); return chips([{ t: 'Box Snack Energy', act: 'discuss:giftbox' }, { t: 'Pack Découverte', act: 'discuss:discovery' }, { t: 'Tin Caramel', act: 'discuss:tin' }, { t: 'Le maillot perso', act: 'merch:jersey' }]);
      case 'machine': await say('Tu veux voir la machine en action ? Choisis une saveur !'); return CH.goStation('machine');
      case 'sound': { const on = !C.audio.on; C.audio.enable(on); C.store.prefs({ sound: on }); UI.syncSound(); if (on) C.audio.chime(); return say(on ? 'Son activé. Tu m’entends caqueter, maintenant.' : 'Son coupé. Je continue à parler dans le vide, mais je ne fais plus de bruit.'); }
      case 'hours': await say(`Le kiosque physique est à **${C.cfg.brand.address}** (placeholder à remplacer). Ici, en ligne, je suis ouvert 24 h/24 : je ne dors jamais, je picore.`); return chips(CH.mainChips());
      case 'wholesale': await say(C.data.faq[5].a.replace('salut@cornsty.fr', C.cfg.brand.email)); return chips(CH.mainChips());
      case 'drop': { const d = nextDrop(); await say(`Prochain **${C.cfg.drop.name}** : ${d}. Les membres du Club Pop et au-delà y ont accès en avant-première.`); return chips([{ t: 'Le Club', act: 'club' }, C_MORE]); }
      case 'reco': case 'browse': gl.act('think'); if (id === 'browse') { await say('Regarde autant que tu veux : touche un pochon sur l’étagère, il vient à toi.'); return chips(CH.mainChips()); } await say(pick(['Je te fais confiance… et tu me fais confiance ?', 'Voyons voir ce que dit mon bec.'])); return CH.recommend(a.tastes[0]);
      case 'name': { const m = text.replace(/^.*?(je m'?appelle|moi c'?est|appelle[- ]moi|mon pr[ée]nom est|je suis)\s+/i, ''); return setName(m); }
    }
    // FAQ keywords
    for (const f of C.data.faq) if (has(t, f.k.map(norm))) { await say(f.a); return chips(CH.mainChips()); }
    // LLM hook (optional)
    if (typeof window.CORNSTY_LLM === 'function') {
      try { const q = C.store.quote(); const r = await window.CORNSTY_LLM({ text, name: name(), cart: q.lines.map((l) => ({ id: l.id, qty: l.qty })), history: C.store.state.chat.log.slice(-8), catalog: C.data.products.map((p) => ({ id: p.id, name: p.name, price: p.price })) }); if (r) { await say(String(r)); return chips(CH.mainChips()); } } catch (e) { console.warn('CORNSTY_LLM', e); }
    }
    // fallback
    gl.act('shrug');
    await say(pick(['Hmm, ça, je ne sais pas faire : je suis une mouette, pas un dictionnaire. Mais je sais éclater du maïs.', 'Pardon ? J’ai perdu le fil, j’étais en train de chiper un grain.', 'Je n’ai pas tout capté. Dis-moi un goût — **salé**, **sucré**, **piquant** — ou une saveur.']));
    chips([{ t: 'Du salé', act: 'taste:salty' }, { t: 'Du sucré', act: 'taste:sweet' }, { t: 'Le Club', act: 'club' }, { t: 'Aide', act: 'help' }]);
  };
  const nextDrop = () => { const d = new Date(), { day, hour } = C.cfg.drop; const add = (day - d.getDay() + 7) % 7 || (d.getHours() >= hour ? 7 : 0); const t = new Date(d.getFullYear(), d.getMonth(), d.getDate() + add, hour); return t.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }) + ' à ' + hour + ' h (date indicative)'; };

  /* ---- chip / programmatic actions ("verb:arg") */
  CH.act = async (act, label) => {
    if (!act) return; idleReset();
    const [v, a1, a2] = String(act).split(':');
    switch (v) {
      case 'taste': return CH.askTaste(a1);
      case 'flavor': return CH.discuss(a1);
      case 'add': return CH.add(a1, +a2 || 1);
      case 'info': return C.catalog.detail(a1);
      case 'discuss': return CH.discuss(a1);
      case 'merch': return CH.pickMerch(a1);
      case 'other': C.catalog.closeSpot(); await say(pick(['Qu’est-ce qui te tente d’autre ?', 'On continue ? Dis-moi ce qui te ferait plaisir.', 'Ok, autre chose alors !'])); return chips(CH.mainChips());
      case 'reco': return CH.recommend();
      case 'checkout': return CH.checkout();
      case 'club': if (a1 === 'open') return C.club.open(); await say('Voici ta carte.'); return C.club.open();
      case 'grain': return C.club.grain();
      case 'game': return C.game ? C.game.open() : null;
      case 'help': return respond(analyze('aide'), 'aide');
      case 'joke': return respond(analyze('blague'), 'blague');
      case 'fact': return respond(analyze('anecdote'), 'anecdote');
      case 'clear': return respond(analyze('vide le panier'), 'vide');
      case 'noname': X.awaiting = null; UI.els.input.placeholder = 'Écris à la Mouette…'; g().act('nod'); await say(['Mystérieux, j’aime. Je t’appellerai « le client de l’ombre ».', 'Alors, qu’est-ce qui te ferait plaisir ?']); return chips(CH.mainChips());
      case 'convert': { const ok = C.shop.convertToTrio(); g().act('hop'); await say(ok ? 'Fait ! Ta **Box Soirée Ciné** est prête : −1,20 € sur ta commande.' : 'Il me faut 3 pochons pour ça.'); return chips([{ t: 'Passer à la caisse', act: 'checkout', cls: 'red' }, C_MORE]); }
      case 'declineup': X.upsellDeclined++; await say(pick(['Aucun souci. Je ne insiste pas (beaucoup).', 'Compris. Je range mon flair commercial.'])); return chips([{ t: 'Passer à la caisse', act: 'checkout', cls: 'red' }, C_MORE, { t: 'Le Club', act: 'club' }]);
      case 'reorder': { const o = C.store.state.orders[0]; if (o) { C.shop.reorder(o); await say(`C’est reparti : ta commande du ${U.dateFr(o.t)} est dans le panier.`); return chips([{ t: 'Passer à la caisse', act: 'checkout', cls: 'red' }, C_MORE]); } return; }
    }
  };
  CH.handle = async (text) => {
    idleReset(); X.idlePings = 0; C.audio.unlock();
    UI.echo(text); C.store.state.chat.log.push({ who: 'u', t: text, at: Date.now() });
    if (X.awaiting === 'name') { chips([]); const a = analyze(text); if (a.flavors.length || a.tastes.length) { X.awaiting = null; } else { const ok = await setName(text); if (ok) return; } }
    chips([]); C.catalog.current && !/prends|ajoute|oui/.test(norm(text)) && 0;
    return respond(analyze(text), text);
  };
  const busy = () => { if (C.pop.busy()) { UI.toast('Une seconde, je finis ce pochon !', { icon: '🍿' }); return true; } return false; };
  C.bus.on('ui:say', (t) => { if (!busy()) CH.handle(t); });
  C.bus.on('ui:chip', (item) => { if (busy()) return; UI.echo(item.t); CH.act(item.act, item.t); });
  C.bus.on('shelf:pick', (id) => { if (!busy()) CH.pickShelf(id, shelfRect(id)); });
  C.bus.on('merch:pick', (id) => { if (!busy()) CH.pickMerch(id, null); });
  C.bus.on('spot:add', ({ id, qty, opts }) => { if (busy()) return; UI.echo('Ajouter ' + fl(id).name); CH.add(id, qty, opts); });
  C.bus.on('spot:close', () => { chips(CH.mainChips()); });
  function shelfRect(id) { const el = document.querySelector(`.shelf-pouch[data-id="${id}"] svg`); if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width }; }
})((window.Cornsty = window.Cornsty || {}));
