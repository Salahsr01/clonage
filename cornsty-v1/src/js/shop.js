/* Cornsty - the shop: add-to-cart choreography, the register, the checkout drawer (cart -> delivery -> payment),
   the payment adapter, the "ring up" ceremony, the printed receipt (real Code 39 barcode) and order tracking. */
(function (C) {
  'use strict';
  const U = C.util, D = C.draw, UI = C.ui, K = D.COL, SE = C.sceneArt;
  const S = (C.shop = { step: 1, form: null, drawer: null });
  const $ = U.$;

  /* ================================================================ add to cart (with the show) */
  const mode = () => C.store.state.prefs.showMode || 'auto';
  const fastNow = () => mode() === 'auto' && !!C.store.state.prefs.seenShow;
  S.tossItem = async (p, opts, from) => {
    const sc = C.scene, g = sc.gull, props = document.getElementById('props'), b = SE.anchors.basket;
    const node = U.svg('g', { class: 'toss-prop' }); node.innerHTML = D.product(p.id, opts).replace(/^<svg /, '<svg x="-60" y="-100" width="120" height="120" overflow="visible" ');
    props.append(node);
    const a = from || { x: g.st.x + 90, y: g.st.y - 340 }, t = { x: b.x, y: b.y - 40 };
    g.act('present', 1, 700); C.audio.whoosh(0.35, true, 0.6);
    const run = new U.Run();
    await run.tween(720, (k) => { const x = U.lerp(a.x, t.x, k), y = U.lerp(a.y, t.y, k) - Math.sin(k * Math.PI) * 220; node.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${(k * 300).toFixed(0)}) scale(${U.lerp(1.1, 0.55, k).toFixed(2)})`); }, U.ease.inOutSine).catch(() => {});
    C.audio.plop(); sc.bump(3); node.remove();
  };

  S.add = async (id, qty = 1, opts = {}, o = {}) => {
    const p = C.data.byId(id); if (!p) return null;
    const cart = C.store.cart, m = mode(), instant = o.quiet || m === 'never' || U.reduced() || document.body.classList.contains('simple');
    C.audio.unlock();
    if (S.adding) await S.adding;
    const job = (async () => {
      let delivered = 0;
      try {
        if (!instant && p.kind === 'pouch') {
          await C.pop.show([{ id, qty }], { fast: fastNow() || !!o.fast, onDelivered: () => { delivered++; cart.add(id, 1, opts); } });
          C.store.prefs({ seenShow: true });
        } else if (!instant && p.id === 'trio') {
          for (let i = 0; i < qty; i++) { const list = (opts.picks || []).map((f) => ({ id: f, qty: 1 })); let c = 0; await C.pop.show(list, { fast: true, onDelivered: () => { c++; if (c === list.length) { cart.add(id, 1, opts); delivered++; } } }); }
          C.store.prefs({ seenShow: true });
        } else if (!instant && p.id === 'discovery') {
          for (let i = 0; i < qty; i++) { const list = p.contents.map((f) => ({ id: f, qty: 1 })); let c = 0; await C.pop.show(list, { fast: true, onDelivered: () => { c++; if (c === list.length) { cart.add(id, 1, opts); delivered++; } } }); }
        } else if (!instant) {
          const from = o.from; await S.tossItem(p, opts, from); cart.add(id, qty, opts); delivered = qty;
        }
      } finally {
        const missing = qty - delivered; if (missing > 0) cart.add(id, missing, opts);
        S.syncRegister();
      }
      C.bus.emit('shop:added', { id, qty, opts });
      return { id, qty };
    })();
    S.adding = job.finally(() => { S.adding = null; });
    return job;
  };

  S.syncRegister = () => { const d = document.getElementById('reg-display'); if (d) d.textContent = U.eurPlain(C.store.quote().total).replace(' €', '').replace(/^0,00$/, '0,00'); };
  C.bus.on('cart', S.syncRegister); C.bus.on('reset', S.syncRegister);

  /* ================================================================ suggestions (honest: only real offers from the catalogue) */
  const PAIR = { cheddar: 'caramel', caramel: 'cheddar', nature: 'cookies', cookies: 'nature', wings: 'nature', gaufre: 'caramel' };
  S.suggestions = (q) => {
    const out = [], inCart = new Set(q.lines.map((l) => l.id));
    const pouches = q.lines.filter((l) => l.p.kind === 'pouch').reduce((n, l) => n + l.qty, 0);
    if (q.freeShipGap > 0 && q.freeShipGap <= 4 && !inCart.has('stickers')) out.push({ id: 'stickers', why: `Complète pile : plus que ${U.eurPlain(q.freeShipGap)} pour la livraison offerte` });
    q.lines.filter((l) => l.p.kind === 'pouch').forEach((l) => { const partner = PAIR[l.id]; if (partner && !inCart.has(partner) && out.length < 2) out.push({ id: partner, why: 'Le duo qui fonctionne avec ' + l.name }); });
    if (pouches >= 3 && !inCart.has('trio') && pouches === 3) out.push({ id: 'trio', why: 'Passe en Box Soirée Ciné : −8 % (' + U.eurPlain(13.5) + ' au lieu de ' + U.eurPlain(14.7) + ')', convert: true });
    return out.slice(0, 2);
  };
  S.convertToTrio = () => {
    const items = C.store.cart.items().filter((i) => C.data.byId(i.id).kind === 'pouch'); const picks = [];
    items.forEach((i) => { for (let k = 0; k < i.qty && picks.length < 3; k++) picks.push(i.id); });
    if (picks.length < 3) return false;
    picks.forEach((id) => { const it = C.store.cart.items().find((i) => i.id === id); if (it) C.store.cart.setQty(it.key, it.qty - 1); });
    C.store.cart.add('trio', 1, { picks }); return true;
  };

  /* ================================================================ the checkout drawer */
  const money = U.eurPlain;
  const optText = (l) => { const o = l.opts || {}, t = []; if (o.size) t.push('Taille ' + o.size); if (o.name) t.push('« ' + o.name + ' »'); if (o.num !== undefined && o.num !== '' && o.num != null) t.push('n°' + o.num); if (o.picks && o.picks.length) t.push(o.picks.map((f) => C.data.byId(f).name).join(' · ')); return t.join(' · '); };
  const thumb = (l) => (l.p.kind === 'pouch' ? D.pouch(l.p, { flat: true }) : D.product(l.id, Object.assign({}, l.opts, { view: 'front' })));

  const defaultForm = () => Object.assign({ first: '', last: '', email: '', phone: '', addr: '', addr2: '', zip: '', city: '', country: 'France', note: '', news: false, card: '', exp: '', cvc: '', cname: '' }, C.store.state.prefs.customer || {});

  S.open = async (o = {}) => {
    if (S.drawer && !S.drawer.closed) return S.drawer;
    S.form = S.form || defaultForm();
    if (!S.form.first && C.store.state.prefs.name) S.form.first = C.store.state.prefs.name;
    S.step = o.step || 1;
    const m = UI.modal({ name: 'checkout', title: 'La caisse', cls: 'drawer', html: '<div class="dr"></div>', onClose: () => { C.scene.setRight(C.catalog.current && innerWidth > 820 ? 372 : 0); C.scene.setExtra(0); C.bus.emit('checkout:close'); S.drawer = null; } });
    S.drawer = m; m.el.classList.add('drawer');
    const desk = innerWidth > 900;
    if (desk) C.scene.setRight(Math.min(500, innerWidth * 0.42));
    C.bus.emit('checkout:open');
    render();
    return m;
  };
  S.close = () => S.drawer && S.drawer.close();
  C.bus.on('cart', () => { if (S.drawer && !S.drawer.closed && S.step < 4 && !S._busy) render(true); });

  const head = (title, step) => `<div class="dr-head"><h2>${title}</h2>${step ? `<ol class="steps" aria-label="Étapes"><li class="${step >= 1 ? 'on' : ''}${step === 1 ? ' cur' : ''}">Panier</li><li class="${step >= 2 ? 'on' : ''}${step === 2 ? ' cur' : ''}">Livraison</li><li class="${step >= 3 ? 'on' : ''}${step === 3 ? ' cur' : ''}">Paiement</li></ol>` : ''}</div>`;

  function totalsHtml(q, ship) {
    const rows = [['Sous-total', money(q.subtotal)]];
    if (q.pctAmount) rows.push([q.pctLabel || 'Remise', '−' + money(q.pctAmount).replace('-', ''), 'disc']);
    if (q.voucherAmount) rows.push([q.voucherRes.label, '−' + money(q.voucherAmount), 'disc']);
    if (q.freeItem === 'stickers') rows.push(['Pack de stickers offert', '0,00 €', 'disc']);
    if (ship !== false) rows.push(['Livraison' + (q.shipOpt.id === 'standard' ? '' : ' · ' + q.shipOpt.label.split(' · ')[0]), q.shipping === 0 ? '<b>offerte</b>' : money(q.shipping)]);
    return `<dl class="totals">${rows.map(([a, b, c]) => `<div class="${c || ''}"><dt>${a}</dt><dd>${b}</dd></div>`).join('')}<div class="grand"><dt>Total</dt><dd>${money(q.total)}</dd></div><div class="vat"><dt>dont TVA</dt><dd>${[q.vat.food ? money(q.vat.food) + ' (5,5 %)' : '', q.vat.merch ? money(q.vat.merch) + ' (20 %)' : ''].filter(Boolean).join(' · ') || '—'}</dd></div></dl>`;
  }
  function meterHtml(q) {
    if (q.shipOpt.id !== 'standard') return '';
    const pct = Math.min(1, q.afterDiscount / q.meterFrom);
    return `<div class="meter ${q.freeShipGap ? '' : 'done'}" role="progressbar" aria-valuenow="${Math.round(pct * 100)}" aria-valuemin="0" aria-valuemax="100"><div class="meter-t">${q.freeShipGap ? `Plus que <b>${money(q.freeShipGap)}</b> pour la livraison offerte` : '<b>Livraison offerte !</b> La Mouette t’offre le timbre.'}</div><div class="meter-bar"><i style="width:${pct * 100}%"></i></div></div>`;
  }
  function earnHtml(q) {
    const c = C.store.state.club, per = C.cfg.club.stampsPerCard, cur = c.stamps, gain = Math.min(q.stamps, per * 2);
    const slots = Array.from({ length: per }, (_, i) => `<span class="es ${i < cur ? 'have' : i < cur + gain ? 'new' : ''}">${i < cur ? D.stampOn() : i < cur + gain ? D.stampOn() : D.stampOff(i + 1)}</span>`).join('');
    return `<div class="earn"><div class="earn-t"><b>Cette commande te rapporte</b> +${q.pointsEarned} pt${q.pointsEarned > 1 ? 's' : ''} · +${q.stamps} tampon${q.stamps > 1 ? 's' : ''}</div><div class="earn-s">${slots}</div>${q.tier.discount ? `<div class="eyebrow">Palier ${q.tier.name} : −${q.tier.discount} % déjà appliqué</div>` : ''}</div>`;
  }

  function render(soft) {
    const m = S.drawer; if (!m || m.closed) return; const body = $('.dr', m.body);
    const st = soft ? { scroll: $('.dr-scroll', body) ? $('.dr-scroll', body).scrollTop : 0 } : null;
    if (S.step === 1) renderCart(body); else if (S.step === 2) renderShip(body); else if (S.step === 3) renderPay(body);
    if (st && $('.dr-scroll', body)) $('.dr-scroll', body).scrollTop = st.scroll;
  }

  /* ---------------- step 1 : cart */
  function renderCart(body) {
    const q = C.store.quote(), cs = C.store.state.cart;
    if (!q.count) {
      body.innerHTML = head('Ton panier') + `<div class="dr-empty"><div class="dr-gull">${D.icon({ cls: 'icon-gull big' })}</div><p><b>Ton panier est vide… comme mon ventre.</b></p><p>Reviens au comptoir, je m’occupe du reste.</p><button class="btn red big" data-a="back">Retour au comptoir</button></div>`;
      $('[data-a=back]', body).addEventListener('click', () => { S.close(); }); return;
    }
    const sug = S.suggestions(q);
    const club = C.store.state.club, vouchers = club.vouchers;
    body.innerHTML = head('Ton panier', 1) + `
<div class="dr-scroll">
  <ul class="lines">${q.lines.map((l) => `<li class="line" data-key="${U.esc(l.key)}"><div class="l-art">${thumb(l)}</div><div class="l-info"><b>${U.esc(l.name)}</b><span class="eyebrow">${U.esc(l.sub || '')}${optText(l) ? ' · ' + U.esc(optText(l)) : ''}</span><div class="l-qty"></div></div><div class="l-price"><span>${money(l.total)}</span><button class="l-x" aria-label="Retirer ${U.esc(l.name)}">${UI.ICON.close}</button></div></li>`).join('')}</ul>
  ${sug.length ? `<div class="upsell"><div class="eyebrow">Un conseil de mouette</div>${sug.map((s) => { const p = C.data.byId(s.id); return `<div class="up"><div class="up-art">${p.kind === 'pouch' ? D.pouch(p, { flat: true }) : D.product(p.id, {})}</div><div class="up-t"><b>${U.esc(p.name)}</b><span>${U.esc(s.why)}</span></div><button class="btn small ${s.convert ? 'blue' : 'red'}" data-up="${s.id}" ${s.convert ? 'data-convert="1"' : ''}>${s.convert ? 'Convertir' : '+ ' + money(p.price)}</button></div>`; }).join('')}</div>` : ''}
  ${meterHtml(q)}
  <div class="box"><label class="eyebrow" for="promo">Code promo</label><div class="promo"><input id="promo" type="text" placeholder="POPPOP" value="${U.esc(cs.promo)}" autocomplete="off" autocapitalize="characters"><button class="btn small" data-a="promo">Appliquer</button></div>${q.promo ? `<p class="promo-msg ${q.promo.invalid ? 'bad' : 'ok'}">${q.promo.invalid ? U.esc(q.promo.invalid) : '✓ ' + U.esc(q.promo.label)}</p>` : `<p class="promo-msg">Essaie <b>POPPOP</b> pour −10 % sur ta 1re commande.</p>`}</div>
  ${vouchers.length ? `<div class="box"><div class="eyebrow">Tes récompenses Club</div><div class="vouch">${vouchers.map((v) => { const vr = q.voucher && q.voucher.id === v.id ? q.voucherRes : null; return `<label class="vou ${cs.voucher === v.id ? 'on' : ''}"><input type="radio" name="vouch" value="${v.id}" ${cs.voucher === v.id ? 'checked' : ''}><span><b>${U.esc(v.label)}</b>${vr && vr.need ? `<small>${vr.need === 'pouch' ? 'Ajoute un pochon pour l’utiliser' : 'Dès 15 € d’achat'}</small>` : ''}</span></label>`; }).join('')}<label class="vou ${!cs.voucher ? 'on' : ''}"><input type="radio" name="vouch" value="" ${!cs.voucher ? 'checked' : ''}><span><b>Ne pas en utiliser</b></span></label></div></div>` : ''}
  <div class="box opts2"><label class="check"><input type="checkbox" data-o="gift" ${cs.gift ? 'checked' : ''}><span>C’est un cadeau (mot doux + papier de soie)</span></label>${cs.gift ? `<input class="gift-note" type="text" maxlength="90" placeholder="Ton petit mot (90 caractères)" value="${U.esc(cs.giftNote || '')}">` : ''}<label class="check"><input type="checkbox" data-o="subscribe" ${cs.subscribe ? 'checked' : ''}><span>Je le veux tous les mois : <b>−10 %</b> <small>(démo, sans engagement)</small></span></label></div>
  ${totalsHtml(q, true)}
  ${earnHtml(q)}
</div>
<div class="dr-foot"><div class="foot-total"><small>Total</small><b>${money(q.total)}</b></div><button class="btn red big" data-a="next">Continuer</button></div>`;
    $$('.line', body).forEach((li) => { const key = li.dataset.key, l = q.lines.find((x) => x.key === key); const qt = UI.qty(l.qty, (d) => C.store.cart.setQty(key, l.qty + d)); $('.l-qty', li).append(qt); $('.l-x', li).addEventListener('click', () => { C.audio.click(); C.store.cart.remove(key); }); });
    $$('[data-up]', body).forEach((b) => b.addEventListener('click', () => { C.audio.click(); if (b.dataset.convert) { S.convertToTrio(); } else C.shop.add(b.dataset.up, 1, {}, { quiet: true }); }));
    $('[data-a=promo]', body) && $('[data-a=promo]', body).addEventListener('click', () => { C.audio.click(); C.store.cart.set({ promo: $('#promo', body).value.trim().toUpperCase() }); const q2 = C.store.quote(); if (q2.promo && !q2.promo.invalid) { UI.toast('Code appliqué : ' + q2.promo.label, { kind: 'good' }); C.audio.coin(); } });
    $('#promo', body) && $('#promo', body).addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); $('[data-a=promo]', body).click(); } });
    $$('input[name=vouch]', body).forEach((r) => r.addEventListener('change', () => { C.audio.tick(); C.store.cart.set({ voucher: r.value }); }));
    $$('[data-o]', body).forEach((c) => c.addEventListener('change', () => { C.audio.tick(); C.store.cart.set({ [c.dataset.o]: c.checked }); }));
    const gn = $('.gift-note', body); gn && gn.addEventListener('input', () => { C.store.state.cart.giftNote = gn.value; C.store.save(); });
    $('[data-a=next]', body).addEventListener('click', () => { C.audio.click(); S.step = 2; render(); });
  }
  const $$ = U.$$;

  /* ---------------- step 2 : delivery */
  function renderShip(body) {
    const q = C.store.quote(), F = S.form, cs = C.store.state.cart;
    const opts = C.cfg.shipping.options.map((o) => { const free = (o.id === 'standard' && (q.afterDiscount >= q.meterFrom || q.tier.id === 'legende')) || (o.id === 'express' && q.tier.id === 'legende'); return `<label class="ship ${cs.ship === o.id ? 'on' : ''}"><input type="radio" name="ship" value="${o.id}" ${cs.ship === o.id ? 'checked' : ''}><span><b>${U.esc(o.label.split(' · ')[0])}</b><small>${U.esc(o.label.split(' · ')[1] || '')}</small></span><i>${o.price === 0 || free ? 'offert' : money(o.price)}</i></label>`; }).join('');
    const pick = cs.ship === 'pickup';
    body.innerHTML = head('Livraison', 2) + `
<form class="dr-scroll form" novalidate autocomplete="on">
  <div class="ships" role="radiogroup" aria-label="Mode de livraison">${opts}</div>
  <div class="grid2"><div class="f"><label for="f-first">Prénom</label><input id="f-first" name="first" autocomplete="given-name" value="${U.esc(F.first)}" required></div><div class="f"><label for="f-last">Nom</label><input id="f-last" name="last" autocomplete="family-name" value="${U.esc(F.last)}" required></div></div>
  <div class="f"><label for="f-email">Email <small>(pour ton reçu)</small></label><input id="f-email" name="email" type="email" inputmode="email" autocomplete="email" value="${U.esc(F.email)}" required></div>
  <div class="f"><label for="f-phone">Téléphone <small>(optionnel, pour le livreur)</small></label><input id="f-phone" name="phone" type="tel" autocomplete="tel" value="${U.esc(F.phone)}"></div>
  <div class="addr" ${pick ? 'hidden' : ''}>
    <div class="f"><label for="f-addr">Adresse</label><input id="f-addr" name="addr" autocomplete="address-line1" value="${U.esc(F.addr)}"></div>
    <div class="f"><label for="f-addr2">Complément <small>(optionnel)</small></label><input id="f-addr2" name="addr2" autocomplete="address-line2" value="${U.esc(F.addr2)}"></div>
    <div class="grid2"><div class="f"><label for="f-zip">Code postal</label><input id="f-zip" name="zip" inputmode="numeric" autocomplete="postal-code" maxlength="5" value="${U.esc(F.zip)}"></div><div class="f"><label for="f-city">Ville</label><input id="f-city" name="city" autocomplete="address-level2" value="${U.esc(F.city)}"></div></div>
    <p class="eyebrow">Livraison en France métropolitaine. Ailleurs : écris-nous, on trouve une solution.</p>
  </div>
  ${pick ? `<p class="pickup">📍 ${U.esc(C.cfg.brand.address)} — on t’écrit dès que c’est prêt (comptoir, sourire inclus).</p>` : ''}
  <label class="check"><input type="checkbox" name="news" ${F.news ? 'checked' : ''}><span>Je veux recevoir les drops et les bons plans par email <small>(optionnel)</small></span></label>
  <p class="err" role="alert" hidden></p>
  ${totalsHtml(q, true)}
</form>
<div class="dr-foot"><button class="btn ghost" data-a="prev">Retour</button><button class="btn red big" data-a="next">Continuer vers le paiement</button></div>`;
    const form = $('form', body);
    form.addEventListener('input', (e) => { const n = e.target.name; if (n && n !== 'ship') F[n] = e.target.type === 'checkbox' ? e.target.checked : e.target.value; });
    $$('input[name=ship]', body).forEach((r) => r.addEventListener('change', () => { C.audio.tick(); C.store.cart.set({ ship: r.value }); render(true); }));
    $('[data-a=prev]', body).addEventListener('click', () => { C.audio.click(); S.step = 1; render(); });
    const go = () => {
      const err = $('.err', body); const bad = validateShip(F, C.store.state.cart.ship === 'pickup');
      if (bad) { err.hidden = false; err.textContent = bad.msg; const f = $('[name=' + bad.field + ']', body); f && f.focus(); C.audio.squawk(0.3); return; }
      err.hidden = true; C.audio.click(); S.step = 3; render();
    };
    $('[data-a=next]', body).addEventListener('click', go); form.addEventListener('submit', (e) => { e.preventDefault(); go(); });
  }
  function validateShip(F, pickup) {
    if (!F.first.trim()) return { field: 'first', msg: 'Il me faut ton prénom pour écrire ton nom sur le colis.' };
    if (!F.last.trim()) return { field: 'last', msg: 'Et ton nom de famille ?' };
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(F.email.trim())) return { field: 'email', msg: 'Cet email a une drôle de tête : vérifie-le, pour que ton reçu arrive.' };
    if (!pickup) {
      if (F.addr.trim().length < 4) return { field: 'addr', msg: 'Où on t’envoie ça ? Il manque l’adresse.' };
      if (!/^\d{5}$/.test(F.zip.trim())) return { field: 'zip', msg: 'Le code postal a 5 chiffres.' };
      if (F.city.trim().length < 2) return { field: 'city', msg: 'Il manque la ville.' };
    }
    return null;
  }

  /* ---------------- step 3 : payment */
  const luhn = (s) => { let sum = 0, alt = false; for (let i = s.length - 1; i >= 0; i--) { let n = +s[i]; if (alt) { n *= 2; if (n > 9) n -= 9; } sum += n; alt = !alt; } return s.length >= 13 && sum % 10 === 0; };
  function renderPay(body) {
    const q = C.store.quote(), F = S.form, custom = typeof window.CORNSTY_PAY === 'function';
    body.innerHTML = head('Paiement', 3) + `
<div class="dr-scroll form">
  <div class="recap"><b>${U.esc(F.first)} ${U.esc(F.last)}</b><span>${q.shipOpt.id === 'pickup' ? 'Retrait au kiosque' : U.esc(F.addr + ', ' + F.zip + ' ' + F.city)}</span><button class="link" data-a="prev">Modifier</button></div>
  ${custom ? `<p class="demo ok">Paiement sécurisé par ton prestataire (branché via <code>window.CORNSTY_PAY</code>).</p>` : `<p class="demo"><b>Mode démo</b> — aucun paiement réel. Carte de test : <code>4242 4242 4242 4242</code>, date future, CVC au choix. <button class="link" data-a="fill">Remplir pour moi</button></p>`}
  <div class="cardui"><div class="f"><label for="f-card">Numéro de carte</label><input id="f-card" name="card" inputmode="numeric" autocomplete="cc-number" placeholder="1234 1234 1234 1234" value="${U.esc(F.card)}"></div>
  <div class="grid3"><div class="f"><label for="f-exp">Expiration</label><input id="f-exp" name="exp" inputmode="numeric" autocomplete="cc-exp" placeholder="MM/AA" maxlength="5" value="${U.esc(F.exp)}"></div><div class="f"><label for="f-cvc">CVC</label><input id="f-cvc" name="cvc" inputmode="numeric" autocomplete="cc-csc" placeholder="123" maxlength="4" value="${U.esc(F.cvc)}"></div><div class="f"><label for="f-cname">Nom sur la carte</label><input id="f-cname" name="cname" autocomplete="cc-name" value="${U.esc(F.cname || F.first + ' ' + F.last)}"></div></div></div>
  <p class="err" role="alert" hidden></p>
  ${totalsHtml(q, true)}
  <p class="eyebrow">En payant, tu acceptes les CGV (à publier — voir README) · Tes données restent sur ton appareil dans cette démo.</p>
</div>
<div class="dr-foot"><button class="btn ghost" data-a="prev2">Retour</button><button class="btn red big" data-a="pay"><span>Payer ${money(q.total)}</span></button></div>`;
    const inp = (n) => $('[name=' + n + ']', body);
    inp('card').addEventListener('input', (e) => { const v = e.target.value.replace(/\D/g, '').slice(0, 19); e.target.value = v.replace(/(.{4})/g, '$1 ').trim(); F.card = e.target.value; });
    inp('exp').addEventListener('input', (e) => { let v = e.target.value.replace(/\D/g, '').slice(0, 4); if (v.length > 2) v = v.slice(0, 2) + '/' + v.slice(2); e.target.value = v; F.exp = v; });
    inp('cvc').addEventListener('input', (e) => { e.target.value = e.target.value.replace(/\D/g, '').slice(0, 4); F.cvc = e.target.value; });
    inp('cname').addEventListener('input', (e) => { F.cname = e.target.value; });
    $('[data-a=prev]', body).addEventListener('click', () => { C.audio.click(); S.step = 2; render(); });
    $('[data-a=prev2]', body).addEventListener('click', () => { C.audio.click(); S.step = 2; render(); });
    const fill = $('[data-a=fill]', body); fill && fill.addEventListener('click', () => { C.audio.tick(); F.card = '4242 4242 4242 4242'; F.exp = '12/34'; F.cvc = '123'; F.cname = F.first + ' ' + F.last; inp('card').value = F.card; inp('exp').value = F.exp; inp('cvc').value = F.cvc; inp('cname').value = F.cname; });
    $('[data-a=pay]', body).addEventListener('click', () => S.pay(body));
  }

  /* ---------------- payment adapter (demo by default; plug your provider through window.CORNSTY_PAY) */
  S.processPayment = async (draft) => {
    if (typeof window.CORNSTY_PAY === 'function') return window.CORNSTY_PAY(draft);
    await new Promise((r) => setTimeout(r, 1300 / (U.speed || 1)));
    const num = (draft.card || '').replace(/\s/g, '');
    if (!luhn(num)) return { ok: false, error: 'Ce numéro de carte n’a pas l’air valide (test : 4242 4242 4242 4242).' };
    const [mm, yy] = (draft.exp || '').split('/').map(Number);
    const now = new Date(), y = 2000 + (yy || 0);
    if (!mm || mm < 1 || mm > 12 || y < now.getFullYear() || (y === now.getFullYear() && mm < now.getMonth() + 1)) return { ok: false, error: 'La date d’expiration est passée ou mal écrite (MM/AA).' };
    if (!/^\d{3,4}$/.test(draft.cvc || '')) return { ok: false, error: 'Le CVC a 3 ou 4 chiffres.' };
    if (num.endsWith('0002')) return { ok: false, error: 'Carte refusée (numéro de test « refus »).' };
    return { ok: true, ref: 'demo_' + U.uid(10), method: 'Carte ••••' + num.slice(-4), demo: true };
  };

  S.pay = async (body) => {
    if (S._busy) return; const F = S.form, q = C.store.quote(), err = $('.err', body), btn = $('[data-a=pay]', body);
    err.hidden = true;
    const custom = typeof window.CORNSTY_PAY === 'function';
    if (!custom) {
      if (!luhn(F.card.replace(/\s/g, ''))) { err.hidden = false; err.textContent = 'Ce numéro de carte n’a pas l’air valide (test : 4242 4242 4242 4242).'; $('[name=card]', body).focus(); C.audio.squawk(0.3); return; }
    }
    S._busy = true; btn.disabled = true; btn.classList.add('loading'); btn.firstElementChild.textContent = 'Paiement en cours…';
    C.store.prefs({ customer: { first: F.first, last: F.last, email: F.email, phone: F.phone, addr: F.addr, addr2: F.addr2, zip: F.zip, city: F.city, news: F.news }, name: C.store.state.prefs.name || F.first });
    const draft = { amount: q.total, currency: 'EUR', lines: q.lines.map((l) => ({ id: l.id, name: l.name, qty: l.qty, unit: l.unit, opts: l.opts })), customer: { first: F.first, last: F.last, email: F.email, phone: F.phone, address: { line1: F.addr, line2: F.addr2, zip: F.zip, city: F.city, country: 'FR' } }, shipping: q.shipOpt.id, card: F.card, exp: F.exp, cvc: F.cvc };
    let res; try { res = await S.processPayment(draft); } catch (e) { res = { ok: false, error: 'Le paiement a échoué (' + (e.message || 'erreur') + '). Réessaie.' }; }
    if (!res || !res.ok) { S._busy = false; btn.disabled = false; btn.classList.remove('loading'); btn.firstElementChild.textContent = 'Payer ' + money(q.total); err.hidden = false; err.textContent = (res && res.error) || 'Paiement refusé.'; C.audio.squawk(0.4); C.scene.gull.act('shake'); return; }
    const order = C.store.placeOrder({ customer: { first: F.first, last: F.last, email: F.email, phone: F.phone, address: q.shipOpt.id === 'pickup' ? null : { line1: F.addr, line2: F.addr2, zip: F.zip, city: F.city } }, payment: { method: res.method || 'Carte', ref: res.ref, demo: !!res.demo } });
    F.card = F.cvc = F.exp = '';
    // optional hook: send the order to your backend / Shopify / n8n (fire and forget, never blocks the ceremony)
    try { if (typeof window.CORNSTY_ORDER === 'function') Promise.resolve(window.CORNSTY_ORDER(JSON.parse(JSON.stringify(order)))).catch((e) => console.warn('CORNSTY_ORDER', e)); } catch (e) { console.warn('CORNSTY_ORDER', e); }
    await ceremony(order);
    S._busy = false;
  };

  /* ================================================================ ring-up ceremony */
  const keysPress = () => { const ks = U.$$('.rk'); const k = U.pick(ks); k.style.transform = 'translateY(4px)'; setTimeout(() => (k.style.transform = ''), 90); };
  async function printPaper(order) {
    const strip = document.getElementById('reg-paper-strip'), host = document.getElementById('reg-paper'); if (!strip) return;
    let lines = host.querySelector('.plines'); if (!lines) { lines = U.svg('g', { class: 'plines' }); host.append(lines); }
    lines.innerHTML = ''; const r = new U.Run(), rx = SE.anchors.register.x;
    C.audio.whoosh(0.9, true, 0.35);
    await r.tween(900, (k) => { const h = 88 * k; strip.setAttribute('y', 716 - h); strip.setAttribute('height', h); lines.innerHTML = Array.from({ length: Math.floor(h / 12) }, (_, i) => `<path d="M${rx - 42} ${716 - h + 10 + i * 12}h${20 + ((i * 37) % 52)}" stroke="#26232b" stroke-opacity=".45" stroke-width="3" stroke-linecap="round"/>`).join(''); }, U.ease.linear).catch(() => {});
  }
  async function ringUp(order) {
    const sc = C.scene, g = sc.gull, a = SE.anchors.register, r = new U.Run(), disp = document.getElementById('reg-display'), drawer = document.getElementById('reg-drawer');
    g.act('idle'); sc.goto('register', { dur: 900 }); UI.tab('register');
    await sc.gullTo('register', { dur: 900 }); g.face(1); g.st.idle = false;
    g.lens('€'); g.fx(true);
    const tgt = { x: a.x - 20, y: 706 };
    g.reach(tgt, 0); await r.wait(380);
    const total = order.totals.total;
    for (let i = 0; i < 6; i++) { g.reach({ x: tgt.x + U.rand(-50, 50), y: tgt.y + 16 }, 0); await r.wait(120); keysPress(); C.audio.ka(); g.S.hy.t = 4; disp && (disp.textContent = (Math.random() * total).toFixed(2).replace('.', ',')); await r.wait(140); g.S.hy.t = 0; }
    disp && (disp.textContent = U.eurPlain(total).replace(' €', '')); C.audio.ding();
    if (drawer) { drawer.style.transition = 'transform .2s'; drawer.style.transform = 'translateY(18px)'; C.audio.drawer(); }
    g.emote && g.emote('star', -20);
    await printPaper(order);
    const term = document.getElementById('terminal'); term && (term.style.filter = 'drop-shadow(0 0 8px #8DF0B3)'); C.audio.coin();
    await r.wait(500);
    if (drawer) drawer.style.transform = '';
    term && (term.style.filter = '');
    g.lens(''); g.fx(false); g.lowerWing();
  }
  async function ceremony(order) {
    const m = S.drawer, body = $('.dr', m.body), sc = C.scene, mobile = innerWidth <= 900;
    body.innerHTML = head('Ça sonne à la caisse…') + `<div class="dr-empty ring"><div class="dr-gull">${D.icon({ cls: 'icon-gull big bounce' })}</div><p><b>Merci ${U.esc(order.customer.first)} !</b></p><p>Je tape ça dans la caisse, pose ton pop-corn sur le comptoir…</p></div>`;
    if (mobile) { m.el.classList.add('peek'); C.scene.setExtra(0); }
    C.ui.hideBubble();
    try { await ringUp(order); } catch (e) { if (!U.isCancel(e)) console.error(e); }
    C.audio.chime([523, 659, 784, 1046, 1318], 0.09, 1);
    const paper = document.getElementById('reg-paper-strip'); if (paper) { paper.setAttribute('height', 0); paper.setAttribute('y', 716); const l = document.querySelector('#reg-paper .plines'); l && (l.innerHTML = ''); }
    m.el.classList.remove('peek');
    // stamps + rewards ceremony on the Club card (only if there is something to punch)
    C.fx.confetti({ x: innerWidth * (mobile ? 0.5 : 0.3), y: innerHeight * 0.62, count: 110 });
    S.step = 4; renderDone(order);
    if (C.club && C.club.stampCeremony) C.club.stampCeremony(order);
    C.bus.emit('order:placed', order);
  }

  /* ================================================================ confirmation + receipt + tracker */
  const CODE39 = { 0: 'nnnwwnwnn', 1: 'wnnwnnnnw', 2: 'nnwwnnnnw', 3: 'wnwwnnnnn', 4: 'nnnwwnnnw', 5: 'wnnwwnnnn', 6: 'nnwwwnnnn', 7: 'nnnwnnwnw', 8: 'wnnwnnwnn', 9: 'nnwwnnwnn', A: 'wnnnnwnnw', B: 'nnwnnwnnw', C: 'wnwnnwnnn', D: 'nnnnwwnnw', E: 'wnnnwwnnn', F: 'nnwnwwnnn', G: 'nnnnnwwnw', H: 'wnnnnwwnn', I: 'nnwnnwwnn', J: 'nnnnwwwnn', K: 'wnnnnnnww', L: 'nnwnnnnww', M: 'wnwnnnnwn', N: 'nnnnwnnww', O: 'wnnnwnnwn', P: 'nnwnwnnwn', Q: 'nnnnnnwww', R: 'wnnnnnwwn', S: 'nnwnnnwwn', T: 'nnnnwnwwn', U: 'wwnnnnnnw', V: 'nwwnnnnnw', W: 'wwwnnnnnn', X: 'nwnnwnnnw', Y: 'wwnnwnnnn', Z: 'nwwnwnnnn', '-': 'nwnnnnwnw', '.': 'wwnnnnwnn', ' ': 'nwwnnnwnn', '*': 'nwnnwnwnn' };
  S.barcode = (text, h = 46) => {
    const t = '*' + String(text).toUpperCase().replace(/[^0-9A-Z\-. ]/g, '') + '*'; let x = 0, bars = '';
    for (const ch of t) { const p = CODE39[ch]; if (!p) continue; for (let i = 0; i < 9; i++) { const w = p[i] === 'w' ? 3 : 1; if (i % 2 === 0) bars += `<rect x="${x}" y="0" width="${w}" height="${h}"/>`; x += w; } x += 1; }
    return `<svg class="barcode" viewBox="0 0 ${x} ${h}" preserveAspectRatio="none" aria-label="Code-barres ${U.esc(text)}" role="img"><g fill="#26232b">${bars}</g></svg>`;
  };
  S.receipt = (o) => {
    const T = o.totals, d = new Date(o.t);
    const lines = o.lines.map((l, i) => `<div class="rc-line"><span class="rc-n">${U.pad(i + 1)}</span><span class="rc-name"><b>${U.esc(l.name)}</b><small>${U.esc(l.sub || '')}${optText(l) ? ' · ' + U.esc(optText(l)) : ''}</small></span><span class="rc-q">${l.qty}</span><span class="rc-p">${money(l.total)}</span></div>`).join('');
    const vat = [T.vat.food ? `TVA 5,5 % ${money(T.vat.food)}` : '', T.vat.merch ? `TVA 20 % ${money(T.vat.merch)}` : ''].filter(Boolean).join(' · ');
    return `<article class="receipt" aria-label="Ticket de caisse ${U.esc(o.id)}">
  <div class="rc-top"><svg viewBox="-190 -6 380 420" class="rc-icon" aria-hidden="true"><use href="#s-icon" x="-190" y="-6" width="380" height="420"/></svg><svg viewBox="0 0 866 523" class="rc-word" aria-label="cornsty" role="img"><use href="#s-word" width="866" height="523" fill="#B5B2AC" style="--wm-q:#B5B2AC"/></svg></div>
  <div class="rc-meta"><span>${U.dateFr(o.t)}</span><span>${U.timeFr(o.t)}</span><span>${U.esc(o.id)}</span></div>
  <div class="rc-cols"><span>ARTICLES</span><span>QTÉ</span><span>PRIX</span></div>
  ${lines}
  <div class="rc-hr"></div>
  <div class="rc-row"><span>Sous-total</span><span>${money(T.subtotal)}</span></div>
  ${T.pctAmount ? `<div class="rc-row disc"><span>${U.esc(T.pctLabel || 'Remise')}</span><span>−${money(T.pctAmount)}</span></div>` : ''}
  ${T.voucherAmount ? `<div class="rc-row disc"><span>${U.esc(T.voucherLabel || 'Bon')}</span><span>−${money(T.voucherAmount)}</span></div>` : ''}
  <div class="rc-row"><span>Livraison</span><span>${T.shipping ? money(T.shipping) : 'offerte'}</span></div>
  <div class="rc-total"><span>TOTAL</span><span>${money(T.total)}</span></div>
  <div class="rc-row small"><span>${vat || 'TVA incluse'}</span><span>${U.esc(o.payment.method || '')}</span></div>
  ${S.barcode(o.id.replace('#', '') , 44)}
  <div class="rc-foot"><b>CORNSTY CLUB · FRANCE</b><span>${U.esc(C.cfg.brand.address)}</span><span>${U.esc(C.cfg.brand.phone)} | ${U.esc(C.cfg.brand.domain)}</span><span class="rc-tag">Big Flavor. Bigger Personality.</span></div>
</article>`;
  };
  S.trackerHtml = (o) => {
    const st = C.store.orderStatus(o);
    return `<ol class="track" aria-label="Suivi de commande (simulé)">${st.steps.map((s, i) => `<li class="${i < st.idx ? 'done' : i === st.idx ? 'cur' : ''}"><i></i><span>${U.esc(s)}</span></li>`).join('')}</ol>`;
  };
  function renderDone(order) {
    const m = S.drawer; if (!m || m.closed) return; const body = $('.dr', m.body), e = order.earned, tier = C.store.club.tier();
    body.innerHTML = head('C’est dans la boîte !') + `
<div class="dr-scroll done">
  <p class="done-l"><b>Merci ${U.esc(order.customer.first)}.</b> Commande <b>${U.esc(order.id)}</b> confirmée${order.payment.demo ? ' <span class="tag">démo</span>' : ''}. Livraison estimée <b>${U.esc(order.etaText)}</b>${order.ship.id === 'pickup' ? ' (retrait au kiosque)' : ''}.</p>
  ${S.trackerHtml(order)}
  <div class="gain"><div class="gain-i">${D.stampOn()}</div><div><b>+${e.points} points</b> · +${e.stamps} tampon${e.stamps > 1 ? 's' : ''}${e.welcome ? ` · +${e.welcome} de bienvenue` : ''}${e.cards ? ` · <b class="hot-t">${e.cards} carte${e.cards > 1 ? 's' : ''} pleine${e.cards > 1 ? 's' : ''} : pochon offert !</b>` : ''}<br><small>Palier ${U.esc(tier.name)}${C.store.club.next() ? ' · encore ' + C.store.club.progress().need + ' pts avant ' + U.esc(C.store.club.next().name) : ' · tu es au sommet'}</small></div></div>
  ${e.badges.length ? `<div class="newbadges">${e.badges.map((id) => { const b = C.store.club.badgeDefs.find((x) => x.id === id); return `<div class="nb">${D.badge(b)}<span><b>${U.esc(b.name)}</b><small>+${b.pts} pts</small></span></div>`; }).join('')}</div>` : ''}
  ${S.receipt(order)}
  <div class="done-cta"><button class="btn red big" data-a="again">Retour au comptoir</button><button class="btn blue" data-a="club">Voir mon Club</button><button class="btn ghost" data-a="print">Imprimer le ticket</button></div>
</div>`;
    $('[data-a=again]', body).addEventListener('click', () => { C.audio.click(); S.close(); C.bus.emit('ui:station', 'counter'); C.bus.emit('order:done', order); });
    $('[data-a=club]', body).addEventListener('click', () => { C.audio.click(); S.close(); C.bus.emit('ui:club'); });
    $('[data-a=print]', body).addEventListener('click', () => { document.body.classList.add('printing'); window.print(); setTimeout(() => document.body.classList.remove('printing'), 500); });
    const rc = $('.receipt', body); if (rc && rc.animate && !U.reduced()) rc.animate([{ clipPath: 'inset(0 0 100% 0)', transform: 'translateY(-14px)' }, { clipPath: 'inset(0 0 0 0)', transform: 'none' }], { duration: 1400, easing: 'cubic-bezier(.3,.8,.3,1)' });
    // live tracker (accelerated demo)
    clearInterval(S._trk); S._trk = setInterval(() => { const t = $('.track', body); if (!t || !document.body.contains(t)) { clearInterval(S._trk); return; } t.outerHTML = S.trackerHtml(order); }, 5000);
  }

  /* open the cart from anywhere (camera to the register, gull next to it) */
  S.openCart = async () => {
    C.bus.emit('ui:opencart');
  };

  /* reorder a past order */
  S.reorder = (order) => { order.lines.forEach((l) => C.store.cart.add(l.id, l.qty, l.opts || {})); UI.toast('Commande remise dans le panier', { kind: 'good' }); };
})((window.Cornsty = window.Cornsty || {}));
