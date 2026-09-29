/* Cornsty - state, persistence (localStorage), cart maths, order placement and the Club (loyalty) engine.
   Pure logic: no DOM here. The UI listens to C.bus events ('cart', 'club', 'orders', 'prefs', 'club:*'). */
(function (C) {
  'use strict';
  const U = C.util;
  const KEY = 'cornsty:v1';

  const defaults = () => ({
    v: 1,
    prefs: { sound: false, motion: 'auto', fast: false, introSeen: false, name: '', sea: true },
    cart: { items: [], promo: '', voucher: '', ship: 'standard', gift: false, giftNote: '', subscribe: false },
    club: {
      joined: false, points: 0, lifetime: 0, stamps: 0, cards: 0,
      vouchers: [],                     // {id, kind:'stamp'|'off5'|'pouch'|'item', label}
      streak: { count: 0, last: '' },
      badges: {}, tried: {}, ref: { code: '', used: '' }, log: [], game: { best: 0, last: '', plays: 0 },
    },
    orders: [],
    seq: 0,
    chat: { log: [], seenFlavors: {}, asked: {} },
  });

  const merge = (base, over) => {
    if (Array.isArray(base) || typeof base !== 'object' || base === null) return over === undefined ? base : over;
    const out = {};
    for (const k of Object.keys(base)) out[k] = merge(base[k], over && over[k]);
    if (over && typeof over === 'object') for (const k of Object.keys(over)) if (!(k in out)) out[k] = over[k];
    return out;
  };

  let state = merge(defaults(), U.ls.get(KEY, {}));
  let saveT = 0;
  const save = () => { clearTimeout(saveT); saveT = setTimeout(() => U.ls.set(KEY, state), 120); };
  const flush = () => { clearTimeout(saveT); U.ls.set(KEY, state); };
  window.addEventListener('pagehide', flush);
  window.addEventListener('beforeunload', flush);

  const S = (C.store = {
    get state() { return state; },
    save, flush,
    reset() { state = merge(defaults(), {}); flush(); C.bus.emit('reset'); ['cart', 'club', 'orders', 'prefs'].forEach((e) => C.bus.emit(e)); },
    prefs(patch) { if (patch) { Object.assign(state.prefs, patch); save(); C.bus.emit('prefs', state.prefs); } return state.prefs; },
  });
  Object.defineProperty(C, 'prefs', { get: () => state.prefs });

  /* ============================================================ cart */
  const keyOf = (id, o = {}) => [id, o.size || '', o.name || '', o.num == null ? '' : o.num, (o.picks || []).slice().sort().join('+')].join('|');
  const cart = (S.cart = {
    items: () => state.cart.items,
    count: () => state.cart.items.reduce((n, i) => n + i.qty, 0),
    add(id, qty = 1, opts = {}) {
      const p = C.data.byId(id);
      if (!p) return null;
      const key = keyOf(id, opts);
      let it = state.cart.items.find((i) => i.key === key);
      if (it) it.qty = Math.min(20, it.qty + qty);
      else { it = { key, id, qty: Math.min(20, qty), opts: Object.assign({}, opts) }; state.cart.items.push(it); }
      save(); C.bus.emit('cart', { type: 'add', item: it, id, qty });
      return it;
    },
    setQty(key, qty) {
      const it = state.cart.items.find((i) => i.key === key);
      if (!it) return;
      if (qty <= 0) state.cart.items = state.cart.items.filter((i) => i.key !== key); else it.qty = Math.min(20, qty);
      save(); C.bus.emit('cart', { type: 'qty', key, qty });
    },
    remove(key) { cart.setQty(key, 0); },
    clear() { state.cart.items = []; state.cart.promo = ''; state.cart.voucher = ''; save(); C.bus.emit('cart', { type: 'clear' }); },
    set(patch) { Object.assign(state.cart, patch); save(); C.bus.emit('cart', { type: 'set' }); },
  });

  const unitPrice = (it) => { const p = C.data.byId(it.id); let u = p.price; if (p.personalize && (it.opts.name || it.opts.num != null && it.opts.num !== '')) u += p.personalize.price; return u; };

  /* ============================================================ Club engine */
  const tiers = () => C.cfg.club.tiers;
  const club = (S.club = {
    tierIndex: (lifetime = state.club.lifetime) => { let idx = 0; tiers().forEach((t, i) => { if (lifetime >= t.at) idx = i; }); return idx; },
    tier: (lifetime) => tiers()[club.tierIndex(lifetime)],
    next: () => tiers()[club.tierIndex() + 1] || null,
    progress() {
      const i = club.tierIndex(), cur = tiers()[i], nxt = tiers()[i + 1];
      if (!nxt) return { pct: 1, need: 0, cur, nxt: null };
      return { pct: U.clamp((state.club.lifetime - cur.at) / (nxt.at - cur.at), 0, 1), need: nxt.at - state.club.lifetime, cur, nxt };
    },
    log(text, pts = 0) { state.club.log.unshift({ t: Date.now(), text, pts }); state.club.log.length = Math.min(state.club.log.length, 60); },
    addPoints(n, why) {
      if (!n) return;
      const before = club.tierIndex();
      state.club.points += n; if (n > 0) state.club.lifetime += n;
      club.log(why || 'Points', n);
      save(); C.bus.emit('club', { type: 'points', n, why });
      const after = club.tierIndex();
      if (after > before) C.bus.emit('club:tier', { tier: tiers()[after], from: tiers()[before] });
    },
    addStamps(n) {
      let earned = 0;
      state.club.stamps += n;
      const per = C.cfg.club.stampsPerCard;
      while (state.club.stamps >= per) { state.club.stamps -= per; state.club.cards += 1; state.club.vouchers.push({ id: 'st' + Date.now() + earned, kind: 'stamp', label: 'Pochon offert (carte pleine)' }); earned++; }
      save(); C.bus.emit('club', { type: 'stamps', n, cardsDone: earned });
      return earned;
    },
    awardBadge(id) {
      if (state.club.badges[id]) return false;
      const b = club.badgeDefs.find((x) => x.id === id);
      if (!b) return false;
      state.club.badges[id] = Date.now();
      club.addPoints(b.pts, 'Badge « ' + b.name + ' »');
      C.bus.emit('club:badge', b);
      return true;
    },
    badgeDefs: [
      { id: 'first', name: 'Premier pop', desc: 'Ta première commande', pts: 10, glyph: '★' },
      { id: 'loyal', name: 'Habitué', desc: '3 commandes', pts: 10, glyph: '♥' },
      { id: 'all6', name: 'Collectionneur', desc: 'Les 6 saveurs goûtées', pts: 20, glyph: '6' },
      { id: 'big', name: 'Gros appétit', desc: 'Une commande de 40 € ou plus', pts: 10, glyph: '€' },
      { id: 'owl', name: 'Noctambule', desc: 'Commander entre 22 h et 5 h', pts: 5, glyph: '☾' },
      { id: 'streak7', name: 'Sur la lancée', desc: '7 jours de suite au kiosque', pts: 15, glyph: '7' },
      { id: 'arcade', name: 'As du pop', desc: '40 points à Attrape-Pop', pts: 10, glyph: '!' },
      { id: 'merch', name: 'Fan-club', desc: 'Tu portes les couleurs', pts: 10, glyph: '◆' },
      { id: 'friend', name: 'Bonne pioche', desc: 'Un ami parrainé', pts: 10, glyph: '+' },
    ],
    checkinAvailable: () => state.club.streak.last !== U.today(),
    checkin() {
      const st = state.club.streak, today = U.today();
      if (st.last === today) return null;
      st.count = st.last && U.daysBetween(st.last, today) === 1 ? st.count + 1 : 1;
      st.last = today;
      const seq = C.cfg.club.streak, idx = (st.count - 1) % seq.length, pts = seq[idx];
      let sticker = false;
      if (idx === seq.length - 1) { state.club.vouchers.push({ id: 'sk' + Date.now(), kind: 'item', item: 'stickers', label: 'Pack de stickers offert' }); sticker = true; }
      club.addPoints(pts, 'Grain du jour · jour ' + st.count);
      if (st.count >= 7) club.awardBadge('streak7');
      state.club.joined = true;
      save(); C.bus.emit('club', { type: 'checkin' });
      return { count: st.count, pts, day: idx + 1, sticker };
    },
    redeem(id) {
      const r = C.cfg.club.rewards.find((x) => x.id === id);
      if (!r || state.club.points < r.cost) return false;
      state.club.points -= r.cost;
      const v = { id: 'rw' + Date.now(), kind: r.id === 'off5' ? 'off5' : r.id === 'pouch' ? 'pouch' : 'item', item: r.item, label: r.name };
      state.club.vouchers.push(v);
      club.log('Échange : ' + r.name, -r.cost);
      save(); C.bus.emit('club', { type: 'redeem', reward: r, voucher: v });
      return v;
    },
    code() {
      if (!state.club.ref.code) { state.club.ref.code = 'POP-' + U.uid(4); save(); }
      return state.club.ref.code;
    },
    useReferral(code) {
      code = String(code || '').trim().toUpperCase();
      if (!/^POP-[A-Z0-9]{4}$/.test(code)) return { ok: false, msg: 'Ce code parrain n’a pas la bonne tête (POP-XXXX).' };
      if (state.club.ref.used) return { ok: false, msg: 'Tu as déjà utilisé un code parrain.' };
      if (code === club.code()) return { ok: false, msg: 'Ton propre code ? Belle tentative.' };
      state.club.ref.used = code;
      club.addPoints(C.cfg.club.referral.reward, 'Code parrain ' + code);
      save();
      return { ok: true, msg: '+' + C.cfg.club.referral.reward + ' points de bienvenue !' };
    },
    gameResult(score) {
      const g = state.club.game, today = U.today();
      g.plays++; if (score > g.best) g.best = score;
      let pts = 0;
      if (g.last !== today) { for (const [min, p] of C.cfg.club.game.tiers) if (score >= min) { pts = p; break; } g.last = today; }
      if (pts) club.addPoints(pts, 'Attrape-Pop · ' + score);
      if (score >= 40) club.awardBadge('arcade');
      save(); C.bus.emit('club', { type: 'game', score });
      return { pts, already: !pts && g.last === today && g.plays > 1 };
    },
  });

  /* ============================================================ quote (all the price maths, one place) */
  const eligibleVoucher = (v, lines, sub) => {
    if (!v) return null;
    const pouches = lines.filter((l) => l.p.kind === 'pouch').sort((a, b) => a.unit - b.unit);
    if (v.kind === 'off5') return sub >= 15 ? { amount: 5, label: v.label } : { need: 15 - sub, label: v.label };
    if (v.kind === 'pouch' || v.kind === 'stamp') return pouches.length ? { amount: pouches[0].unit, label: v.label } : { need: 'pouch', label: v.label };
    if (v.kind === 'item') return { item: v.item, label: v.label };
    return null;
  };

  S.quote = (opts = {}) => {
    const c = state.cart;
    const lines = c.items.map((it) => {
      const p = C.data.byId(it.id), unit = unitPrice(it);
      return { key: it.key, id: it.id, p, name: p.name, sub: p.sub, qty: it.qty, unit, total: U.round2(unit * it.qty), opts: it.opts };
    });
    const subtotal = U.round2(lines.reduce((s, l) => s + l.total, 0));
    const count = lines.reduce((n, l) => n + l.qty, 0);
    const stamps = lines.reduce((n, l) => n + l.qty * (l.p.stamps || 0), 0);
    const tier = club.tier(), tierPct = tier.discount;
    // best of loyalty % and promo % (they do not stack)
    let promo = null;
    const code = (c.promo || '').toUpperCase(), pdef = C.cfg.promo[code];
    if (pdef) {
      if (pdef.firstOrderOnly && state.orders.length) promo = { code, invalid: 'Ce code est réservé à une première commande.' };
      else promo = Object.assign({ code }, pdef);
    } else if (code) promo = { code, invalid: 'Code inconnu.' };
    let pct = tierPct, pctLabel = tierPct ? 'Remise Club ' + tier.name + ' −' + tierPct + ' %' : '';
    if (promo && promo.type === 'pct' && !promo.invalid && promo.value > pct) { pct = promo.value; pctLabel = promo.label; }
    if (c.subscribe && 10 > pct) { pct = 10; pctLabel = 'Abonnement mensuel −10 %'; }
    const pctAmount = U.round2(subtotal * pct / 100);
    let after = U.round2(subtotal - pctAmount);
    // voucher
    const voucher = state.club.vouchers.find((v) => v.id === c.voucher) || null;
    const vres = eligibleVoucher(voucher, lines, after);
    let voucherAmount = 0, freeItem = null;
    if (vres && vres.amount) { voucherAmount = Math.min(vres.amount, after); after = U.round2(after - voucherAmount); }
    if (vres && vres.item) freeItem = vres.item;
    // shipping
    const opt = C.data.shipOption(c.ship);
    const freeFrom = tier.id === 'mouette' ? Math.min(15, C.cfg.shipping.freeFrom) : C.cfg.shipping.freeFrom;
    let shipping = opt.price, shipNote = '';
    const shipFree = opt.id === 'standard' && (after >= freeFrom || tier.id === 'legende' || (promo && promo.type === 'ship' && !promo.invalid));
    if (shipFree || count === 0) { shipping = 0; shipNote = count ? 'offerte' : ''; }
    if (tier.id === 'legende' && opt.id === 'express') { shipping = 0; shipNote = 'offerte (Légende)'; }
    const total = U.round2(after + shipping);
    // VAT included (spread the discount over the lines)
    const ratio = subtotal ? after / subtotal : 1;
    const vat = { food: 0, merch: 0 };
    lines.forEach((l) => { const t = l.total * ratio, r = C.cfg.vat[l.p.vat]; vat[l.p.vat] += t * r / (1 + r); });
    vat.food = U.round2(vat.food); vat.merch = U.round2(vat.merch);
    // shipping meter
    const meterFrom = freeFrom;
    return {
      lines, count, stamps, subtotal, tier, pct, pctLabel, pctAmount, promo, voucher, voucherRes: vres, voucherAmount, freeItem,
      afterDiscount: after, shipping, shipNote, shipOpt: opt, total, vat,
      pointsEarned: Math.floor(after * C.cfg.club.pointsPerEuro),
      freeShipGap: opt.id === 'standard' ? Math.max(0, U.round2(meterFrom - after)) : 0, meterFrom, discount: U.round2(pctAmount + voucherAmount),
    };
  };

  /* ============================================================ orders */
  const ETA_DAYS = (d) => new Date(Date.now() + d * 864e5).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  S.orderStatus = (o) => {
    const el = (Date.now() - o.t) / 1000, steps = ['Commande reçue', 'Éclatée à l’air', 'Emballée avec amour', 'Confiée au transporteur', 'Livrée'];
    const th = [0, 25, 70, 180, 3600 * 24 * (o.ship.eta[1] || 3)];
    let idx = 0; th.forEach((t, i) => { if (el >= t) idx = i; });
    return { steps, idx, done: idx === steps.length - 1 };
  };

  S.placeOrder = ({ customer, payment }) => {
    const q = S.quote();
    if (!q.count) return null;
    const c = state.cart, wasFirst = state.orders.length === 0;
    state.seq++;
    const d = new Date();
    const order = {
      id: '#CS' + U.pad(d.getMonth() + 1) + U.pad(d.getDate()) + '-' + U.pad(state.seq, 3),
      t: Date.now(),
      lines: q.lines.map((l) => ({ id: l.id, name: l.name, sub: l.sub, qty: l.qty, unit: l.unit, total: l.total, opts: l.opts })),
      totals: { subtotal: q.subtotal, discount: q.discount, pctLabel: q.pctLabel, pctAmount: q.pctAmount, voucherAmount: q.voucherAmount, voucherLabel: q.voucherRes && q.voucherRes.label, shipping: q.shipping, total: q.total, vat: q.vat, freeItem: q.freeItem },
      customer, ship: { id: q.shipOpt.id, label: q.shipOpt.label, eta: q.shipOpt.eta, price: q.shipping }, payment,
      gift: c.gift ? c.giftNote || true : false, subscribe: !!c.subscribe, tier: q.tier.name,
      earned: { points: q.pointsEarned, stamps: q.stamps, badges: [], cards: 0, welcome: 0 },
      etaText: ETA_DAYS(q.shipOpt.eta[1]),
    };
    // consume voucher / promo
    if (q.voucher && q.voucherRes && (q.voucherRes.amount || q.voucherRes.item)) state.club.vouchers = state.club.vouchers.filter((v) => v.id !== q.voucher.id);
    state.orders.unshift(order);
    // club effects
    if (!state.club.joined) { state.club.joined = true; if (C.cfg.club.welcome.points) { club.addPoints(C.cfg.club.welcome.points, 'Bienvenue au Club'); order.earned.welcome = C.cfg.club.welcome.points; } }
    if (q.pointsEarned) club.addPoints(q.pointsEarned, 'Commande ' + order.id);
    order.earned.cards = club.addStamps(q.stamps);
    q.lines.forEach((l) => { if (l.p.kind === 'pouch') state.club.tried[l.id] = true; (l.opts.picks || []).forEach((f) => { state.club.tried[f] = true; }); (l.p.contents || []).forEach((f) => { state.club.tried[f] = true; }); });
    const bd = []; const aw = (id) => { if (club.awardBadge(id)) bd.push(id); };
    aw('first');
    if (state.orders.length >= 3) aw('loyal');
    if (C.data.flavors.every((f) => state.club.tried[f.id])) aw('all6');
    if (q.total >= 40) aw('big');
    const hr = d.getHours(); if (hr >= 22 || hr < 5) aw('owl');
    if (q.lines.some((l) => l.p.kind === 'merch')) aw('merch');
    order.earned.badges = bd;
    c.items = []; c.promo = ''; c.voucher = ''; c.gift = false; c.giftNote = ''; c.subscribe = false;
    save();
    C.bus.emit('cart', { type: 'clear' }); C.bus.emit('orders', order); C.bus.emit('club', { type: 'order' });
    return order;
  };
  S.lastOrder = () => state.orders[0] || null;
  S.unlockedFree = () => state.club.vouchers;
})((window.Cornsty = window.Cornsty || {}));
