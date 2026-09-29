/* Cornsty - product interfaces: spotlight card (next to the seagull), full product sheet, option builders (bundle picker, jersey customiser),
   and the "catalogue rapide" (plain accessible list, also the fallback for reduced motion / screen readers). */
(function (C) {
  'use strict';
  const U = C.util, D = C.draw, UI = C.ui, K = D.COL;
  const CAT = (C.catalog = {});
  const TASTE = { salty: 'Salé', sweet: 'Sucré', spicy: 'Piquant', cheesy: 'Fromage', choco: 'Chocolat', fruity: 'Fruité', indulgence: 'Gourmand' };

  const tasteBars = (p) => {
    if (!p.taste) return '';
    const rows = Object.entries(p.taste).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).slice(0, 4);
    return `<div class="taste" aria-label="Profil de goût">${rows.map(([k, v]) => `<span>${TASTE[k]}</span><i><b style="width:${v * 20}%"></b></i>`).join('')}</div>`;
  };
  const tint = (p) => (p.colors ? p.colors.base + '33' : '#DFE5FB');
  const artFor = (p, o = {}) => {
    if (p.kind === 'pouch') return D.pouch(p);
    if (p.id === 'jersey') return D.jersey({ name: o.name, num: o.num, view: 'both' });
    if (p.id === 'trio') return D.product('trio', { picks: (o.picks || []).length ? o.picks : null });
    return D.product(p.id, o);
  };
  CAT.unit = (p, opts) => { let u = p.price; if (p.personalize && (opts.name || (opts.num !== undefined && opts.num !== ''))) u += p.personalize.price; return u; };

  /* ------------------------------------------------------------------ option builder (returns a DOM node + accessors) */
  CAT.options = (p, onChange) => {
    const st = { qty: 1, opts: {} }, root = U.el('div', { class: 'opts' });
    const changed = () => { onChange && onChange(st); };
    if (p.id === 'trio') {
      st.opts.picks = [];
      const grid = U.el('div', { class: 'picks', role: 'group', 'aria-label': 'Choisis 3 pochons' });
      const draw = () => {
        grid.innerHTML = '';
        C.data.flavors.forEach((fl) => {
          const n = st.opts.picks.filter((x) => x === fl.id).length;
          const b = U.el('button', { type: 'button', class: 'pick' + (n ? ' on' : ''), 'aria-label': `${fl.name} ${fl.sub}, ${n} choisi${n > 1 ? 's' : ''}. Ajouter` });
          b.innerHTML = `<span class="pick-art">${D.pouch(fl, { flat: true })}</span><span class="pick-n">${n ? '×' + n : '+'}</span>`;
          b.addEventListener('click', () => { if (st.opts.picks.length >= 3) { if (n) { const i = st.opts.picks.lastIndexOf(fl.id); st.opts.picks.splice(i, 1); } else return; } else st.opts.picks.push(fl.id); C.audio.tick(); draw(); changed(); });
          b.addEventListener('contextmenu', (e) => { e.preventDefault(); const i = st.opts.picks.lastIndexOf(fl.id); if (i >= 0) { st.opts.picks.splice(i, 1); draw(); changed(); } });
          grid.append(b);
        });
        note.innerHTML = st.opts.picks.length + '/3 choisis' + (st.opts.picks.length === 3 ? ' · parfait !' : '<span class="hint"> · touche un pochon pour l’ajouter</span>');
        reset.hidden = !st.opts.picks.length;
      };
      const note = U.el('p', { class: 'eyebrow picks-note' });
      const reset = U.el('button', { type: 'button', class: 'link', hidden: true }, 'Recommencer');
      reset.addEventListener('click', () => { st.opts.picks = []; C.audio.tick(); draw(); changed(); });
      root.append(grid, U.el('div', { class: 'picks-foot' }, note, reset)); draw();
      st.valid = () => st.opts.picks.length === 3;
    } else if (p.id === 'jersey') {
      st.opts.size = 'M';
      const sizes = U.el('div', { class: 'seg', role: 'radiogroup', 'aria-label': 'Taille' });
      p.sizes.forEach((s) => { const b = U.el('button', { type: 'button', role: 'radio', 'aria-checked': s === 'M' ? 'true' : 'false', class: s === 'M' ? 'on' : '' }, s); b.addEventListener('click', () => { st.opts.size = s; U.$$('button', sizes).forEach((x) => { const on = x === b; x.classList.toggle('on', on); x.setAttribute('aria-checked', on); }); C.audio.tick(); changed(); }); sizes.append(b); });
      const perso = U.el('label', { class: 'check' }, U.el('input', { type: 'checkbox' }), U.el('span', {}, 'Personnaliser (+' + U.eurPlain(p.personalize.price) + ')'));
      const fields = U.el('div', { class: 'perso', hidden: true });
      const name = U.el('input', { type: 'text', maxlength: p.personalize.maxName, placeholder: 'Ton nom', 'aria-label': 'Nom dans le dos', autocomplete: 'off' });
      const num = U.el('input', { type: 'text', inputmode: 'numeric', maxlength: 2, placeholder: '01', 'aria-label': 'Numéro', autocomplete: 'off' });
      fields.append(name, num);
      perso.firstChild.addEventListener('change', (e) => { fields.hidden = !e.target.checked; if (!e.target.checked) { delete st.opts.name; delete st.opts.num; name.value = num.value = ''; } else { name.value = C.store.state.prefs.name || ''; st.opts.name = name.value; st.opts.num = ''; } C.audio.tick(); changed(); });
      name.addEventListener('input', () => { name.value = name.value.replace(/[^A-Za-zÀ-ÿ' \-]/g, '').slice(0, p.personalize.maxName); st.opts.name = name.value; changed(); });
      num.addEventListener('input', () => { num.value = num.value.replace(/\D/g, '').slice(0, 2); st.opts.num = num.value; changed(); });
      root.append(U.el('div', { class: 'opt-label eyebrow' }, 'Taille'), sizes, perso, fields);
      st.valid = () => true;
    } else st.valid = () => true;
    const q = UI.qty(1, (d) => { st.qty = U.clamp(st.qty + d, 1, 20); q.set(st.qty); changed(); });
    st.qtyEl = q;
    st.el = root;
    return st;
  };

  /* ------------------------------------------------------------------ the spotlight card */
  CAT.current = null;
  CAT.spot = (id, o = {}) => {
    const p = C.data.byId(id); if (!p) return;
    const el = UI.els.spot; CAT.current = id;
    if (p.kind === 'pouch') C.scene.paint(id);
    const st = CAT.options(p, refresh);
    el.classList.remove('out'); el.hidden = false; el.dataset.id = id;
    el.style.setProperty('--tint', tint(p));
    el.innerHTML = `<button class="spot-x" aria-label="Fermer la fiche">${UI.ICON.close}</button>
<div class="spot-art">${p.pattern ? `<div class="swatch-bg">${D.swatch(p, 340, 300, 0.4, 0).replace('class="swatch"', 'class="swatch-bg"')}</div>` : ''}<div class="art-slot"></div></div>
<div class="spot-main">
  <div class="eyebrow">${U.esc(p.sub || '')}${p.weight ? ' · ' + p.weight + ' g' : ''}</div>
  <h3>${U.esc(p.name)}</h3>
  <p>${U.esc(p.short || '')}</p>
  ${tasteBars(p)}
  <div class="tags">${(p.tags || []).slice(0, 4).map((t) => `<span class="tag">${U.esc(t)}</span>`).join('')}</div>
  <div class="opts-slot"></div>
  <div class="spot-row"><div class="price"></div><div class="qty-slot"></div></div>
  <button class="btn red big block add">Ajouter au panier</button>
  <button class="btn ghost small block more">Tout savoir sur ce produit</button>
</div>`;
    U.$('.qty-slot', el).append(st.qtyEl); U.$('.opts-slot', el).append(st.el);
    function refresh() {
      const unit = CAT.unit(p, st.opts), total = unit * st.qty;
      U.$('.price', el).innerHTML = U.eurPlain(total) + (p.was ? `<s>${U.eurPlain(p.was * st.qty)}</s>` : '');
      const btn = U.$('.add', el), ok = st.valid();
      btn.disabled = !ok; btn.textContent = ok ? 'Ajouter au panier · ' + U.eurPlain(total) : p.id === 'trio' ? 'Choisis 3 pochons' : 'Ajouter au panier';
      const slot = U.$('.art-slot', el);
      if (!refresh.done || p.id === 'jersey' || p.id === 'trio') { slot.innerHTML = artFor(p, Object.assign({}, st.opts)); refresh.done = true; }
    }
    refresh();
    U.$('.spot-x', el).addEventListener('click', () => { C.audio.click(); CAT.closeSpot(); C.bus.emit('spot:close'); });
    U.$('.add', el).addEventListener('click', () => { C.audio.click(); C.bus.emit('spot:add', { id, qty: st.qty, opts: Object.assign({}, st.opts) }); });
    U.$('.more', el).addEventListener('click', () => { C.audio.click(); CAT.detail(id); });
    // mobile: keep the seagull visible above the card; desktop: the camera makes room on the right
    requestAnimationFrame(() => { if (innerWidth <= 820) C.scene.setExtra(Math.max(0, Math.min(el.offsetHeight - 210, innerHeight * 0.3))); else C.scene.setRight(372); });
    if (o.from) CAT.fly(o.from, U.$('.art-slot', el));
    return st;
  };
  CAT.closeSpot = () => {
    const el = UI.els.spot; if (el.hidden) return; CAT.current = null;
    el.classList.add('out'); C.scene.setExtra(0); C.scene.setRight(0);
    setTimeout(() => { if (el.classList.contains('out')) { el.hidden = true; el.innerHTML = ''; } }, 300);
  };
  // FLIP: the shelf pouch flies to the card
  CAT.fly = (from, toEl) => {
    try {
      const to = toEl.getBoundingClientRect(); if (!from || !to.width || U.reduced()) return;
      const art = toEl.firstElementChild; if (!art || !art.animate) return;
      const b = art.getBoundingClientRect(), dx = from.x - (b.x + b.width / 2), dy = from.y - (b.y + b.height / 2), s = Math.max(0.15, from.w / b.width);
      art.animate([{ transform: `translate(${dx}px,${dy}px) scale(${s}) rotate(-8deg)`, opacity: 0.9 }, { transform: 'translate(0,0) scale(1.05) rotate(-2deg)', opacity: 1, offset: 0.75 }, { transform: 'none', opacity: 1 }], { duration: 620, easing: 'cubic-bezier(.2,.9,.25,1)' });
    } catch (e) { /* cosmetic */ }
  };

  /* ------------------------------------------------------------------ full product sheet (modal) */
  CAT.detail = (id) => {
    const p = C.data.byId(id); if (!p) return;
    const st = CAT.options(p, refresh);
    const nut = p.kind === 'pouch' || p.kind === 'tin' ? `<h3>Dans le pochon</h3><p><b>Ingrédients :</b> ${U.esc(p.ingredients || '—')}</p><p><b>Allergènes :</b> ${U.esc(p.allergens || '—')}</p><p class="eyebrow">Valeurs nutritionnelles : à compléter (placeholder — voir README)</p>` : '';
    const m = UI.modal({ name: 'product', title: p.name, wide: true, cls: 'product-modal', html: `
<div class="pm">
  <div class="pm-art" style="--tint:${tint(p)}">${p.pattern ? D.swatch(p, 400, 400, 0.5, 0).replace('class="swatch"', 'class="swatch-bg"') : ''}<div class="art-slot"></div></div>
  <div class="pm-main">
    <div class="eyebrow">${U.esc(p.sub || '')}${p.weight ? ' · ' + p.weight + ' g' : ''}</div>
    <h2>${U.esc(p.name)}</h2>
    <p>${U.esc(p.long || p.short || '')}</p>
    ${tasteBars(p)}
    <div class="tags">${(p.tags || []).map((t) => `<span class="tag">${U.esc(t)}</span>`).join('')}</div>
    <div class="opts-slot"></div>
    <div class="spot-row"><div class="price"></div><div class="qty-slot"></div></div>
    <button class="btn red big block add">Ajouter au panier</button>
    ${nut}
    <p class="eyebrow">Livraison offerte dès ${U.eurPlain(C.cfg.shipping.freeFrom)} · Colissimo 2 à 4 jours ouvrés</p>
  </div>
</div>` });
    const el = m.el;
    U.$('.qty-slot', el).append(st.qtyEl); U.$('.opts-slot', el).append(st.el);
    function refresh() {
      const unit = CAT.unit(p, st.opts), total = unit * st.qty, btn = U.$('.add', el), ok = st.valid();
      U.$('.price', el).innerHTML = U.eurPlain(total) + (p.was ? `<s>${U.eurPlain(p.was * st.qty)}</s>` : '');
      btn.disabled = !ok; btn.textContent = ok ? 'Ajouter au panier · ' + U.eurPlain(total) : 'Choisis 3 pochons';
      if (!refresh.done || p.id === 'jersey' || p.id === 'trio') { U.$('.art-slot', el).innerHTML = artFor(p, Object.assign({}, st.opts)); refresh.done = true; }
    }
    refresh();
    U.$('.add', el).addEventListener('click', () => { C.audio.click(); m.close(); C.bus.emit('spot:add', { id, qty: st.qty, opts: Object.assign({}, st.opts) }); });
    return m;
  };

  /* ------------------------------------------------------------------ catalogue rapide (accessible, no animation needed) */
  CAT.quick = () => {
    const groups = [['Pochons 100 g', (p) => p.kind === 'pouch'], ['Packs & coffrets', (p) => ['bundle', 'tin', 'gift'].includes(p.kind)], ['Vestiaire', (p) => p.kind === 'merch']];
    const html = groups.map(([t, fn]) => `<h3>${t}</h3><ul class="qc-list">${C.data.products.filter(fn).map((p) => `<li class="qc-item"><div class="qc-art">${p.kind === 'pouch' ? D.pouch(p, { flat: true }) : D.product(p.id, {})}</div><div class="qc-info"><b>${U.esc(p.name)}</b><span class="eyebrow">${U.esc(p.sub || '')}</span><span>${U.eurPlain(p.price)}</span></div><button class="btn small ${p.kind === 'pouch' ? 'red' : ''}" data-id="${p.id}">${p.kind === 'pouch' ? 'Ajouter' : 'Choisir'}</button></li>`).join('')}</ul>`).join('');
    const m = UI.modal({ name: 'quick', title: 'Catalogue rapide', wide: true, cls: 'quick-modal', html: `<h2>Catalogue rapide</h2><p>La version sans animation : tout le kiosque en une liste. Les tampons Club fonctionnent pareil.</p>${html}` });
    U.$$('.qc-item .btn', m.el).forEach((b) => b.addEventListener('click', () => {
      const p = C.data.byId(b.dataset.id);
      if (p.kind === 'pouch' || p.id === 'discovery' || p.id === 'tin' || p.id === 'giftbox' || p.id === 'plush' || p.id === 'stickers' || p.id === 'cap') { C.audio.click(); C.shop.add(p.id, 1, {}, { quiet: true }); b.textContent = 'Ajouté ✓'; setTimeout(() => (b.textContent = p.kind === 'pouch' ? 'Ajouter' : 'Choisir'), 1200); }
      else { m.close(); CAT.detail(p.id); }
    }));
    return m;
  };
})((window.Cornsty = window.Cornsty || {}));
