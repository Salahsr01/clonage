/* Cornsty - interface layer: header, speech bubble (typewriter + gull voice), quick replies, product spotlight, toasts, modals, keyboard. */
(function (C) {
  'use strict';
  const U = C.util, D = C.draw, K = D.COL;
  const UI = (C.ui = { els: {} });
  const $ = U.$;

  const ICON = {
    bag: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M5 8h14l-1 12H6L5 8Z" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/><path d="M9 8V6a3 3 0 0 1 6 0v2" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
    sound: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4Z" fill="currentColor"/><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    mute: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4Z" fill="currentColor"/><path d="M16 9l5 6M21 9l-5 6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
    menu: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>',
    send: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M4 12h14M12 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    close: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>',
    pop: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><use href="#pf1" x="-2" y="-2" width="28" height="28"/></svg>',
  };
  UI.ICON = ICON;

  /* ------------------------------------------------------------------ mount */
  UI.mount = (app) => {
    const hud = U.el('div', { id: 'hud' });
    hud.innerHTML = `
<header id="hdr">
  <button class="brand" id="btn-home" aria-label="Cornsty - retour au comptoir"><svg viewBox="0 0 866 523" aria-hidden="true"><use href="#s-word" width="866" height="523" fill="#F8F2E0" stroke="#26232b" stroke-width="16" paint-order="stroke" stroke-linejoin="round" style="--wm-q:#26232b"/></svg></button>
  <nav id="tabs" aria-label="Stations du kiosque">
    <button data-st="machine" class="tab" aria-label="La machine"><span><i class="art">La </i>machine</span></button>
    <button data-st="counter" class="tab on" aria-label="Le comptoir"><span><i class="art">Le </i>comptoir</span></button>
    <button data-st="register" class="tab" aria-label="La caisse"><span><i class="art">La </i>caisse</span></button>
    <button data-st="merch" class="tab" aria-label="Le vestiaire"><span><i class="art">Le </i>vestiaire</span></button>
  </nav>
  <div class="hdr-actions">
    <button class="pill" id="btn-club" aria-label="Ma carte Club"><span class="club-q">${D.stampOff('').replace('<text', '<text hidden')}</span><span class="pill-t"><b id="club-tier">Grain</b><small id="club-stamps">0/10</small></span></button>
    <button class="pill" id="btn-cart" aria-label="Panier"><span class="pill-i">${ICON.bag}</span><span class="pill-t"><b id="cart-count">0</b><small id="cart-total">0,00 €</small></span></button>
    <button class="round" id="btn-sound" aria-label="Activer le son" aria-pressed="false">${ICON.mute}</button>
    <button class="round" id="btn-menu" aria-label="Menu" aria-haspopup="dialog">${ICON.menu}</button>
  </div>
</header>
<div id="bubble" role="status" aria-live="polite" hidden><div class="b-text"></div><div class="b-dots" hidden><i></i><i></i><i></i></div></div>
<div id="echo" hidden></div>
<aside id="spot" class="spot" hidden aria-label="Fiche produit"></aside>
<section id="tray" aria-label="Discuter avec la Mouette">
  <div id="chips" role="group" aria-label="Réponses rapides"></div>
  <form id="say" autocomplete="off">
    <input id="say-input" type="text" enterkeyhint="send" aria-label="Écrire à la Mouette" placeholder="Écris à la Mouette…" maxlength="160">
    <button type="submit" class="go" aria-label="Envoyer">${ICON.send}</button>
  </form>
</section>
<div id="toasts" aria-live="polite"></div>
<button id="skip" hidden>Passer le show ⏭</button>
<div id="modal-host"></div>`;
    app.append(hud);
    Object.assign(UI.els, { hud, hdr: $('#hdr'), bubble: $('#bubble'), btext: $('.b-text', hud), bdots: $('.b-dots', hud), echo: $('#echo'), spot: $('#spot'), tray: $('#tray'), chips: $('#chips'), form: $('#say'), input: $('#say-input'), toasts: $('#toasts'), skip: $('#skip'), modals: $('#modal-host') });
    // measure the tray so the camera keeps the stall between header and tray
    const measure = () => {
      const h = Math.ceil(UI.els.tray.getBoundingClientRect().height + 8);
      document.documentElement.style.setProperty('--ui-bottom', h + 'px');
      C.scene.layout && C.scene.layout();
    };
    if (window.ResizeObserver) new ResizeObserver(measure).observe(UI.els.tray); measure();
    // wiring
    $('#btn-home').addEventListener('click', () => C.bus.emit('ui:station', 'counter'));
    U.$$('.tab').forEach((b) => b.addEventListener('click', () => { C.audio.click(); C.bus.emit('ui:station', b.dataset.st); }));
    $('#btn-cart').addEventListener('click', () => { C.audio.click(); C.bus.emit('ui:cart'); });
    $('#btn-club').addEventListener('click', () => { C.audio.click(); C.bus.emit('ui:club'); });
    $('#btn-menu').addEventListener('click', () => { C.audio.click(); C.bus.emit('ui:menu'); });
    $('#btn-sound').addEventListener('click', () => { C.audio.enable(!C.audio.on); C.store.prefs({ sound: C.audio.on }); C.audio.on && C.audio.click(); UI.syncSound(); });
    UI.els.form.addEventListener('submit', (e) => { e.preventDefault(); const v = UI.els.input.value.trim(); if (!v) return; UI.els.input.value = ''; C.audio.tick(); C.bus.emit('ui:say', v); });
    UI.els.bubble.addEventListener('click', () => UI.skipTyping());
    UI.els.skip.addEventListener('click', () => C.bus.emit('ui:skipshow'));
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { const top = UI.modalStack[UI.modalStack.length - 1]; if (top) { top.close(); } }
      else if ((e.key === '/' || e.key === 'Enter') && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName) && !UI.modalStack.length) { e.preventDefault(); UI.els.input.focus(); }
    });
    C.bus.on('audio', () => UI.syncSound()); C.bus.on('cart', UI.syncCart); C.bus.on('club', UI.syncClub); C.bus.on('reset', () => { UI.syncCart(); UI.syncClub(); });
    U.ticker.add(() => UI.followGull());
    UI.syncCart(); UI.syncClub(); UI.syncSound();
    return UI;
  };

  /* ------------------------------------------------------------------ header sync */
  UI.syncCart = () => {
    const q = C.store.quote();
    $('#cart-count').textContent = q.count; $('#cart-total').textContent = U.eurPlain(q.subtotal);
    const b = $('#btn-cart'); b.classList.toggle('has', q.count > 0);
    b.setAttribute('aria-label', 'Panier : ' + q.count + ' article' + (q.count > 1 ? 's' : '') + ', ' + U.eurPlain(q.subtotal));
    if (UI._cartN !== undefined && q.count > UI._cartN) { b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop'); }
    UI._cartN = q.count;
  };
  UI.syncClub = () => {
    const c = C.store.state.club, tier = C.store.club.tier();
    $('#club-tier').textContent = tier.name; $('#club-stamps').textContent = c.stamps + '/' + C.cfg.club.stampsPerCard;
    const q = $('#btn-club .club-q'); q.innerHTML = D.stampOn().replace('class="stamp on"', 'class="stamp on mini"');
  };
  UI.syncSound = () => { const b = $('#btn-sound'), on = C.audio.on; b.innerHTML = on ? ICON.sound : ICON.mute; b.setAttribute('aria-pressed', on); b.setAttribute('aria-label', on ? 'Couper le son' : 'Activer le son'); b.classList.toggle('on', on); };
  UI.tab = (name) => U.$$('.tab').forEach((b) => { const on = b.dataset.st === name; b.classList.toggle('on', on); b.setAttribute('aria-current', on ? 'true' : 'false'); });

  /* ------------------------------------------------------------------ quick replies */
  UI.chips = (list, o = {}) => {
    const host = UI.els.chips; host.innerHTML = ''; host.classList.toggle('hidden', !list || !list.length);
    (list || []).forEach((c, i) => {
      const item = typeof c === 'string' ? { t: c } : c;
      const b = U.el('button', { class: 'chip' + (item.cls ? ' ' + item.cls : ''), type: 'button', style: { animationDelay: i * 45 + 'ms' } }, item.icon ? U.html(`<span class="chip-i">${item.icon}</span>`) : null, item.t);
      b.addEventListener('click', () => { C.audio.click(); if (!o.keep) host.innerHTML = ''; C.bus.emit('ui:chip', item); item.fn && item.fn(); });
      host.append(b);
    });
  };
  UI.echo = (text) => {
    const e = UI.els.echo; e.textContent = text; e.hidden = false; e.classList.remove('out'); void e.offsetWidth; e.classList.add('in');
    clearTimeout(UI._echoT); UI._echoT = setTimeout(() => { e.classList.add('out'); setTimeout(() => (e.hidden = true), 400); }, 2600);
  };

  /* ------------------------------------------------------------------ speech bubble */
  UI.bubbleSide = 1;
  UI.followGull = () => {
    const b = UI.els.bubble; if (!b || b.hidden || !C.scene.ready) return;
    const p = C.scene.headScreen(), vw = innerWidth, vh = innerHeight, bw = b.offsetWidth, bh = b.offsetHeight, m = 12;
    const dir = C.scene.gull.dir();
    // bubble on the side the gull is NOT looking at unless there is no room; tail points to the beak
    let side = p.x > vw * 0.58 ? -1 : 1; if (vw < 640) side = 0;
    // never slide under the product card / the checkout drawer on the right
    let lim = vw - m; const sp = UI.els.spot;
    if (sp && !sp.hidden && !sp.classList.contains('out') && vw > 820) lim = Math.min(lim, sp.getBoundingClientRect().left - 10);
    if (C.scene.right) lim = Math.min(lim, vw - C.scene.right - 10);
    const gu = C.scene.u * 1.3, topLimit = (C.scene.insets ? C.scene.insets.top : 64) + 10, y = U.clamp(p.y - bh - 46 * C.scene.u * 1.6, topLimit, vh - bh - 190);
    // when the header pushes the bubble down onto the head, slide it sideways so the hat/face stay visible
    const gap = y + bh > p.y - 52 * gu ? 74 * gu : 26 * gu;
    if (side > 0 && p.x + gap + bw > lim) side = -1;
    let x;
    if (side === 0) x = p.x - bw / 2;
    else if (side > 0) x = p.x + gap; else x = p.x - bw - gap;
    x = U.clamp(x, m, Math.max(m, lim - bw));
    b.style.transform = `translate3d(${Math.round(x)}px,${Math.round(y)}px,0)`;
    b.style.setProperty('--tail', Math.round(U.clamp(p.x - x, 26, bw - 26)) + 'px');
    b.classList.toggle('below', p.y - bh - 46 < topLimit);
  };
  const tokens = (text) => { const out = []; const re = /\*\*(.+?)\*\*/g; let last = 0, m; while ((m = re.exec(text))) { if (m.index > last) out.push({ t: text.slice(last, m.index) }); out.push({ t: m[1], b: 1 }); last = m.index + m[0].length; } if (last < text.length) out.push({ t: text.slice(last) }); return out; };
  UI.plain = (text) => String(text).replace(/\*\*(.+?)\*\*/g, '$1');
  UI.skipTyping = () => { if (UI._typing) UI._typing.skip = true; };
  UI.hideBubble = () => { UI.els.bubble.classList.add('out'); setTimeout(() => { if (UI.els.bubble.classList.contains('out')) UI.els.bubble.hidden = true; }, 260); };

  /* say(text | [text...]) : dots -> typewriter with beak + voice. Resolves when finished. opts: {mood, hold} */
  UI.say = async (text, o = {}) => {
    if (Array.isArray(text)) { for (let i = 0; i < text.length; i++) { await UI.say(text[i], Object.assign({}, o, { hold: i < text.length - 1 ? o.gap || 650 : o.hold })); } return; }
    if (UI._sayRun) UI._sayRun.cancel();
    const run = (UI._sayRun = new U.Run()), b = UI.els.bubble, g = C.scene.gull;
    C.store.state.chat.log.push({ who: 'g', t: UI.plain(text), at: Date.now() }); if (C.store.state.chat.log.length > 80) C.store.state.chat.log.shift(); C.store.save();
    C.bus.emit('say', text);
    try {
      b.hidden = false; b.classList.remove('out'); b.classList.add('show');
      UI.els.btext.innerHTML = ''; UI.els.bdots.hidden = false; UI.els.btext.hidden = true;
      UI.followGull();
      const words = UI.plain(text).split(/\s+/).length;
      if (!o.instant) await run.wait(Math.min(700, 260 + words * 14));
      UI.els.bdots.hidden = true; UI.els.btext.hidden = false;
      const toks = tokens(text), st = (UI._typing = { skip: false });
      let html = '', n = 0;
      const rate = o.rate || 28;
      outer: for (const tk of toks) {
        const esc = U.esc(tk.t);
        if (tk.b) html += '<b>';
        for (const ch of tk.t) {
          html += U.esc(ch); UI.els.btext.innerHTML = html + (tk.b ? '</b>' : '');
          if (st.skip || o.instant) { continue; }
          n++; g.mouth(ch); if (n % 2 === 0 && /\S/.test(ch)) C.audio.blip(ch, o.mood || 0);
          await run.wait(rate * (/[.!?…]/.test(ch) ? 7 : /[,;:]/.test(ch) ? 3.5 : 1) * (0.75 + Math.random() * 0.5));
        }
        if (tk.b) html += '</b>';
        UI.els.btext.innerHTML = html;
      }
      UI.els.btext.innerHTML = toks.map((t) => (t.b ? '<b>' + U.esc(t.t) + '</b>' : U.esc(t.t))).join('');
      g.closeMouth(); UI._typing = null;
      UI.followGull();
      if (o.hold) await run.wait(o.hold);
    } catch (e) { if (!U.isCancel(e)) throw e; }
  };
  UI.think = async (ms = 600) => { const b = UI.els.bubble; b.hidden = false; b.classList.remove('out'); b.classList.add('show'); UI.els.btext.hidden = true; UI.els.bdots.hidden = false; UI.followGull(); await U.wait(ms); };

  /* ------------------------------------------------------------------ toasts */
  UI.toast = (msg, o = {}) => {
    const t = U.el('div', { class: 'toast' + (o.kind ? ' ' + o.kind : ''), role: 'status' });
    t.innerHTML = (o.icon ? `<span class="toast-i">${o.icon}</span>` : '') + `<span>${msg}</span>`;
    UI.els.toasts.append(t);
    requestAnimationFrame(() => t.classList.add('in'));
    setTimeout(() => { t.classList.remove('in'); t.classList.add('out'); setTimeout(() => t.remove(), 400); }, o.dur || 2800);
    return t;
  };

  /* ------------------------------------------------------------------ modals / sheets */
  UI.modalStack = [];
  UI.modal = (o = {}) => {
    const prevFocus = document.activeElement;
    const wrap = U.el('div', { class: 'modal ' + (o.cls || ''), role: 'dialog', 'aria-modal': 'true', 'aria-label': o.title || 'Fenêtre' });
    wrap.innerHTML = `<div class="modal-bg"></div><div class="modal-card ${o.wide ? 'wide' : ''}"><button class="modal-x" aria-label="Fermer">${ICON.close}</button><div class="modal-body"></div></div>`;
    const body = $('.modal-body', wrap);
    if (typeof o.html === 'string') body.innerHTML = o.html; else if (o.html) body.append(o.html);
    UI.els.modals.append(wrap);
    const api = { el: wrap, body, close() { if (api.closed) return; api.closed = true; wrap.classList.add('out'); UI.modalStack = UI.modalStack.filter((m) => m !== api); document.body.classList.toggle('has-modal', UI.modalStack.length > 0); setTimeout(() => wrap.remove(), 320); prevFocus && prevFocus.focus && prevFocus.focus({ preventScroll: true }); o.onClose && o.onClose(); C.bus.emit('modal:close', o.name); } };
    $('.modal-x', wrap).addEventListener('click', () => { C.audio.click(); api.close(); });
    $('.modal-bg', wrap).addEventListener('click', () => api.close());
    UI.modalStack.push(api); document.body.classList.add('has-modal');
    requestAnimationFrame(() => { wrap.classList.add('in'); const f = $('[autofocus],button:not(.modal-x),input', body) || $('.modal-x', wrap); f && f.focus({ preventScroll: true }); });
    // focus trap
    wrap.addEventListener('keydown', (e) => { if (e.key !== 'Tab') return; const f = U.$$('button:not([disabled]),input,select,textarea,a[href],[tabindex="0"]', wrap).filter((x) => x.offsetParent !== null); if (!f.length) return; const a = f[0], z = f[f.length - 1]; if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); } else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); } });
    C.bus.emit('modal:open', o.name);
    return api;
  };
  UI.closeAllModals = () => UI.modalStack.slice().forEach((m) => m.close());

  /* ------------------------------------------------------------------ small building blocks reused by other modules */
  UI.money = (n) => U.eurPlain(n);
  UI.qty = (val, on) => {
    const w = U.el('div', { class: 'qty', role: 'group', 'aria-label': 'Quantité' });
    const m = U.el('button', { type: 'button', 'aria-label': 'Moins' }, '−'), p = U.el('button', { type: 'button', 'aria-label': 'Plus' }, '+'), v = U.el('output', {}, String(val));
    m.addEventListener('click', () => { C.audio.tick(); on(-1); }); p.addEventListener('click', () => { C.audio.tick(); on(1); });
    w.append(m, v, p); w.set = (n) => (v.textContent = n); return w;
  };
})((window.Cornsty = window.Cornsty || {}));
