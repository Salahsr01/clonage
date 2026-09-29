/* Cornsty - the Club (loyalty): the punch card (10 quatrefoil stamps, as in the brand book), tiers & perks, daily "grain du jour" streak,
   rewards shop, badges, referral, order history, and the stamp ceremony played after every order. Rules live in cfg.club + store.club. */
(function (C) {
  'use strict';
  const U = C.util, D = C.draw, UI = C.ui, K = D.COL;
  const CL = (C.club = { tab: 'card' });
  const $ = U.$, $$ = U.$$;
  const per = () => C.cfg.club.stampsPerCard;
  const streakFilled = () => { const st = C.store.state.club.streak, len = C.cfg.club.streak.length; const alive = st.last === U.today() || (st.last && U.daysBetween(st.last, U.today()) === 1); return alive && st.count > 0 ? ((st.count - 1) % len) + 1 : 0; };

  /* ------------------------------------------------------------------ the card (front = checker + wordmark, back = stamps) */
  CL.cardHtml = (o = {}) => {
    const c = C.store.state.club, st = o.stamps == null ? c.stamps : o.stamps, name = (C.store.state.prefs.name || 'TOI').toUpperCase(), tier = C.store.club.tier();
    const slots = Array.from({ length: per() }, (_, i) => `<span class="slot ${i < st ? 'on' : ''} ${i === per() - 1 ? 'last' : ''}" data-i="${i}">${i < st ? D.stampOn() : i === per() - 1 ? D.gift() : D.stampOff(i + 1)}</span>`).join('');
    return `<div class="ccard ${o.flipped ? 'flipped' : ''}" tabindex="0" role="group" aria-label="Carte Cornsty Club : ${st} tampons sur ${per()}">
  <div class="cc-face cc-back"><div class="cc-top"><span class="cc-title">LOYALTY CARD</span><span class="cc-q">${D.stampOff('').replace('<text', '<text hidden')}</span><span class="cc-sub">1 POCHON OFFERT<br>TOUS LES ${per()} POCHONS</span></div><div class="cc-grid">${slots}</div><div class="cc-foot"><span>${U.esc(name)}</span><span>CORNSTY CLUB · ${U.esc(tier.name.toUpperCase())}</span></div></div>
  <div class="cc-face cc-front"><div class="cc-check"></div><svg viewBox="0 0 866 523" class="cc-word" aria-hidden="true"><use href="#s-word" width="866" height="523" fill="#F8F2E0" stroke="#26232b" stroke-width="10" paint-order="stroke" style="--wm-q:#26232b"/></svg><span class="cc-pill">Cornsty Club</span><span class="cc-name">${U.esc(name)}</span></div>
</div>`;
  };
  const bindCard = (root) => { const c = $('.ccard', root); if (!c) return; const flip = () => { C.audio.tick(); c.classList.toggle('flipped'); }; c.addEventListener('click', flip); c.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); flip(); } }); };

  /* ------------------------------------------------------------------ the Club modal */
  const tierBar = () => {
    const p = C.store.club.progress(), c = C.store.state.club, cur = p.cur;
    return `<div class="tier"><div class="tier-h"><span class="tier-n">${U.esc(cur.name)}</span><span class="eyebrow">${c.points} pts à dépenser · ${c.lifetime} pts gagnés</span></div>
    <div class="meter ${p.nxt ? '' : 'done'}"><div class="meter-bar"><i style="width:${p.pct * 100}%"></i></div><div class="meter-t">${p.nxt ? `Encore <b>${p.need} pts</b> pour devenir <b>${U.esc(p.nxt.name)}</b>` : '<b>Sommet atteint.</b> Tu es une Légende.'}</div></div>
    <ul class="perks">${cur.perks.map((x) => `<li>${U.esc(x)}</li>`).join('')}</ul>${p.nxt ? `<p class="eyebrow">Prochain palier — ${U.esc(p.nxt.name)} : ${p.nxt.perks.map(U.esc).join(' · ')}</p>` : ''}</div>`;
  };
  const tabs = [['card', 'Ma carte'], ['rewards', 'Récompenses'], ['badges', 'Badges'], ['history', 'Historique'], ['friends', 'Parrainage']];
  CL.open = (tab = 'card') => {
    if (CL.modal && !CL.modal.closed) { CL.tab = tab; CL.render(); return CL.modal; }
    CL.tab = tab;
    CL.modal = UI.modal({ name: 'club', title: 'Cornsty Club', wide: true, cls: 'club-modal', html: '<div class="club"></div>', onClose: () => { CL.modal = null; } });
    CL.render(); C.bus.emit('club:open'); return CL.modal;
  };
  CL.render = () => {
    const m = CL.modal; if (!m || m.closed) return; const root = $('.club', m.body), c = C.store.state.club;
    const avail = C.store.club.checkinAvailable();
    root.innerHTML = `
<div class="club-l">
  ${CL.cardHtml()}
  <div class="club-actions"><button class="btn red ${avail ? 'pulse' : ''}" data-a="grain">${avail ? '🍿 Mon grain du jour' : 'Grain du jour ✓'}</button><button class="btn blue" data-a="game">🎮 Attrape-Pop</button></div>
  ${tierBar()}
  <div class="vlist">${c.vouchers.length ? `<div class="eyebrow">Ton portefeuille</div>${c.vouchers.map((v) => `<div class="vchip">🎁 ${U.esc(v.label)}</div>`).join('')}<p class="eyebrow">Utilise-les au moment de payer.</p>` : '<p class="eyebrow">Aucune récompense en attente. Ça vient.</p>'}</div>
</div>
<div class="club-r">
  <nav class="ctabs" role="tablist" aria-label="Sections du Club">${tabs.map(([id, t]) => `<button role="tab" aria-selected="${id === CL.tab}" class="${id === CL.tab ? 'on' : ''}" data-tab="${id}">${t}</button>`).join('')}</nav>
  <div class="ctab" role="tabpanel">${CL['tab_' + CL.tab]()}</div>
</div>`;
    bindCard(root);
    $$('.ctabs button', root).forEach((b) => b.addEventListener('click', () => { C.audio.tick(); CL.tab = b.dataset.tab; CL.render(); }));
    $('[data-a=grain]', root).addEventListener('click', () => { C.audio.click(); CL.grain(); });
    $('[data-a=game]', root).addEventListener('click', () => { C.audio.click(); C.game && C.game.open(); });
    CL['bind_' + CL.tab] && CL['bind_' + CL.tab]($('.ctab', root));
  };
  C.bus.on('club', () => { if (CL.modal && !CL.modal.closed && !CL._holding) CL.render(); });

  CL.tab_card = () => {
    const c = C.store.state.club, q = C.cfg.club.streak;
    return `<h3>Comment ça marche</h3>
<ol class="how"><li><b>1 pochon = 1 tampon.</b> À ${per()} tampons, un pochon t’est offert (on te le glisse dans ta prochaine commande).</li><li><b>1 € dépensé = 1 point.</b> Les points font monter ton palier : Grain, Pop, Mouette, Légende.</li><li><b>Chaque palier</b> débloque une remise permanente sur tout le kiosque.</li><li><b>Reviens chaque jour</b> chercher ton grain : ta série rapporte des points en plus.</li></ol>
<h3>Ta série</h3>
<div class="streak">${q.map((pts, i) => `<div class="sd ${i < streakFilled() ? 'on' : ''}"><i>${D.stampOn()}</i><b>J${i + 1}</b><small>+${pts}</small></div>`).join('')}</div>
<p class="eyebrow">Série en cours : ${c.streak.count} jour${c.streak.count > 1 ? 's' : ''}${c.streak.last === U.today() ? ' · grain du jour récupéré' : ''} · le 7e jour = un pack de stickers offert.</p>`;
  };
  CL.tab_rewards = () => {
    const c = C.store.state.club;
    return `<h3>Échanger mes points</h3><p class="eyebrow">Tu as <b>${c.points} points</b> à dépenser.</p><div class="rew">${C.cfg.club.rewards.map((r) => `<div class="rw ${c.points >= r.cost ? 'can' : ''}"><div class="rw-i">${r.id === 'sticker' ? D.product('stickers', {}) : r.id === 'pouch' ? D.pouch(C.data.byId('cheddar'), { flat: true }) : '<div class="rw-n">−5 €</div>'}</div><div class="rw-t"><b>${U.esc(r.name)}</b><span>${U.esc(r.blurb)}</span></div><button class="btn small ${c.points >= r.cost ? 'red' : ''}" data-r="${r.id}" ${c.points >= r.cost ? '' : 'disabled'}>${r.cost} pts</button></div>`).join('')}</div>`;
  };
  CL.bind_rewards = (root) => $$('[data-r]', root).forEach((b) => b.addEventListener('click', () => { const v = C.store.club.redeem(b.dataset.r); if (v) { C.audio.chime([659, 784, 988], 0.08, 1); C.fx.confetti({ count: 40, y: innerHeight * 0.5 }); UI.toast('Échangé : ' + v.label + ' — dans ton portefeuille', { kind: 'good' }); } }));
  CL.tab_badges = () => {
    const c = C.store.state.club, defs = C.store.club.badgeDefs;
    return `<h3>Tes badges <small>${Object.keys(c.badges).length}/${defs.length}</small></h3><div class="badges">${defs.map((b) => { const on = !!c.badges[b.id]; return `<div class="bd ${on ? 'on' : ''}">${D.badge(b, on)}<b>${U.esc(b.name)}</b><small>${U.esc(b.desc)}${on ? '' : ' · +' + b.pts + ' pts'}</small></div>`; }).join('')}</div>
<h3>Les 6 saveurs <small>${C.data.flavors.filter((f) => c.tried[f.id]).length}/6 goûtées</small></h3><div class="tried">${C.data.flavors.map((f) => `<div class="tr ${c.tried[f.id] ? 'on' : ''}" title="${U.esc(f.name)}">${D.pouch(f, { flat: true })}</div>`).join('')}</div>`;
  };
  CL.tab_history = () => {
    const c = C.store.state.club, os = C.store.state.orders;
    return `<h3>Mes commandes</h3>${os.length ? `<ul class="orders">${os.map((o, i) => { const st = C.store.orderStatus(o); return `<li><div class="o-h"><b>${U.esc(o.id)}</b><span>${U.dateFr(o.t)} · ${U.eurPlain(o.totals.total)}</span></div><div class="o-l">${o.lines.map((l) => l.qty + '× ' + U.esc(l.name)).join(' · ')}</div><div class="o-s"><span class="tag">${U.esc(st.steps[st.idx])}</span><button class="btn small" data-re="${i}">Recommander</button><button class="btn small ghost" data-rc="${i}">Ticket</button></div></li>`; }).join('')}</ul>` : '<p>Pas encore de commande. La première te rapporte un badge et 10 points de bienvenue.</p>'}
<h3>Journal des points</h3>${c.log.length ? `<ul class="plog">${c.log.slice(0, 14).map((l) => `<li><span>${U.esc(l.text)}</span><b class="${l.pts < 0 ? 'neg' : ''}">${l.pts > 0 ? '+' : ''}${l.pts}</b></li>`).join('')}</ul>` : '<p class="eyebrow">Rien pour l’instant.</p>'}`;
  };
  CL.bind_history = (root) => {
    $$('[data-re]', root).forEach((b) => b.addEventListener('click', () => { C.audio.click(); C.shop.reorder(C.store.state.orders[+b.dataset.re]); }));
    $$('[data-rc]', root).forEach((b) => b.addEventListener('click', () => { C.audio.click(); const o = C.store.state.orders[+b.dataset.rc]; UI.modal({ name: 'receipt', title: 'Ticket', html: C.shop.receipt(o) + C.shop.trackerHtml(o) }); }));
  };
  CL.tab_friends = () => {
    const c = C.store.state.club, code = C.store.club.code();
    return `<h3>Parraine un pote</h3><p>Donne ton code à un ami : vous gagnez tous les deux <b>${C.cfg.club.referral.reward} points</b>.</p>
<div class="refcode"><output>${code}</output><button class="btn small" data-a="copy">Copier</button><button class="btn small blue" data-a="share">Partager</button></div>
<h3>J’ai un code parrain</h3>${c.ref.used ? `<p class="eyebrow">Code utilisé : ${U.esc(c.ref.used)} ✓</p>` : `<div class="promo"><input id="refin" placeholder="POP-XXXX" autocapitalize="characters" autocomplete="off"><button class="btn small" data-a="use">Utiliser</button></div><p class="promo-msg" id="refmsg"></p>`}
<p class="eyebrow">Démo : le suivi des parrainages réels nécessite un petit backend (voir README).</p>`;
  };
  CL.bind_friends = (root) => {
    $('[data-a=copy]', root).addEventListener('click', async () => { const ok = await U.copy(C.store.club.code()); UI.toast(ok ? 'Code copié' : 'Copie impossible', { kind: 'good' }); C.audio.coin(); });
    $('[data-a=share]', root).addEventListener('click', async () => { const t = `Viens goûter Cornsty : utilise mon code ${C.store.club.code()} pour ${C.cfg.club.referral.reward} points offerts. ${location.origin}${location.pathname}?ref=${C.store.club.code()}`; let done = false; if (navigator.share) { try { await navigator.share({ title: 'Cornsty', text: t }); done = true; } catch (e) { done = !!(e && e.name === 'AbortError'); /* cancelled by the visitor = nothing more to do; any other refusal falls back to copying */ } } if (!done) { const ok = await U.copy(t); UI.toast(ok ? 'Message copié' : 'Copie impossible : sélectionne le code et copie-le', { kind: ok ? 'good' : undefined }); } });
    const use = $('[data-a=use]', root); use && use.addEventListener('click', () => { const r = C.store.club.useReferral($('#refin', root).value); const msg = $('#refmsg', root); msg.textContent = r.msg; msg.className = 'promo-msg ' + (r.ok ? 'ok' : 'bad'); if (r.ok) { C.audio.chime(); C.fx.confetti({ count: 40 }); } else C.audio.squawk(0.3); });
  };

  /* ------------------------------------------------------------------ daily grain (streak) */
  CL.grain = () => {
    const c = C.store.state.club, avail = C.store.club.checkinAvailable(), seq = C.cfg.club.streak;
    const days = (n) => seq.map((pts, i) => `<div class="sd ${i < n ? 'on' : ''}"><i>${D.stampOn()}</i><b>J${i + 1}</b><small>+${pts}</small></div>`).join('');
    const m = UI.modal({ name: 'grain', title: 'Grain du jour', cls: 'grain-modal', html: `
<h2>Le grain du jour</h2>
<p class="g-l">${avail ? 'Chauffe-le, il éclate : chaque jour de suite rapporte un peu plus.' : 'Ton grain du jour est déjà éclaté. Reviens demain, la casserole refroidit.'}</p>
<div class="pan"><svg viewBox="0 0 320 200" role="img" aria-label="Une casserole avec un grain de maïs"><ellipse cx="160" cy="176" rx="130" ry="14" fill="#000" opacity=".12"/><path d="M60 110H260L246 168Q244 178 232 178H88Q76 178 74 168Z" fill="${K.ink}"/><ellipse cx="160" cy="110" rx="100" ry="20" fill="#3a3540" stroke="${K.ink}" stroke-width="5"/><path d="M262 118H316" stroke="${K.ink}" stroke-width="14" stroke-linecap="round"/><g id="gk" style="transform-box:fill-box;transform-origin:50% 100%"><ellipse cx="160" cy="98" rx="20" ry="15" fill="#E8A526" stroke="${K.ink}" stroke-width="5"/></g><g id="gpop" opacity="0"><use href="#pf3" x="120" y="30" width="80" height="80"/></g></svg></div>
<div class="streak g-s">${days(streakFilled())}</div>
<div class="g-res" aria-live="polite"></div>
<button class="btn red big block" id="gbtn">${avail ? 'Chauffer !' : 'À demain'}</button>` });
    const btn = $('#gbtn', m.el); if (!avail) { btn.disabled = true; return m; }
    btn.addEventListener('click', async () => {
      btn.disabled = true; btn.textContent = 'Ça chauffe…'; C.audio.click();
      const k = $('#gk', m.el), pop = $('#gpop', m.el), stop = C.audio.heat(1.4);
      const r = new U.Run();
      await r.tween(1300, (t) => { k.style.transform = `translate(${Math.sin(t * 90) * 2 * t}px,${-Math.abs(Math.sin(t * 40)) * 4 * t}px) scale(${1 + t * 0.1})`; }, U.ease.linear).catch(() => {});
      stop && stop(); C.audio.pop(1.2); k.style.opacity = 0; pop.setAttribute('opacity', 1);
      pop.animate && pop.animate([{ transform: 'translateY(30px) scale(.2)' }, { transform: 'translateY(-14px) scale(1.25)' }, { transform: 'translateY(0) scale(1)' }], { duration: 520, easing: 'cubic-bezier(.2,.9,.3,1.3)' });
      const res = C.store.club.checkin(); C.fx.confetti({ x: innerWidth / 2, y: innerHeight * 0.5, count: 50 });
      C.audio.chime([659, 784, 1046], 0.08, 1);
      $('.g-res', m.el).innerHTML = `<div class="g-pts">+${res.pts} pt${res.pts > 1 ? 's' : ''}</div><p>Jour <b>${res.count}</b> de suite${res.sticker ? ' · <b>pack de stickers offert</b> dans ton portefeuille !' : ''}</p>`;
      $('.g-s', m.el).innerHTML = days(res.day); btn.textContent = 'À demain !'; btn.disabled = false; btn.addEventListener('click', () => m.close(), { once: true });
      C.bus.emit('club:grain', res);
    }, { once: true });
    return m;
  };

  /* ------------------------------------------------------------------ stamp ceremony (after an order) */
  CL.stampCeremony = async (order) => {
    const e = order.earned, add = Math.min(e.stamps, per() * 2); if (!add && !e.cards && !e.badges.length) return;
    await U.wait(1200);
    const c = C.store.state.club, before = ((c.stamps - e.stamps) % per() + per()) % per();
    const m = UI.modal({ name: 'stamps', title: 'Tampons', cls: 'stamp-modal', html: `<h2>${e.cards ? 'Carte pleine !' : 'Tampon !'}</h2><p class="g-l" id="stl">${add ? 'La Mouette sort son tampon…' : 'Bravo.'}</p><div class="stamp-host">${CL.cardHtml({ stamps: before })}</div><div class="stamp-tool-wrap" aria-hidden="true"><svg id="stool" viewBox="0 0 120 200" width="110" height="180"><rect x="36" y="4" width="48" height="110" rx="18" fill="${K.cream}" stroke="${K.ink}" stroke-width="6"/><rect x="18" y="108" width="84" height="26" rx="10" fill="${K.red}" stroke="${K.ink}" stroke-width="6"/><use href="#s-quat" x="26" y="120" width="68" height="68" fill="${K.red}"/><use href="#s-icon" x="40" y="130" width="40" height="44"/></svg></div><button class="btn red big block" id="stok">Continuer</button>` });
    CL._holding = true; m.el.classList.add('overlay-top'); const card = $('.ccard', m.el); bindCard(m.el);
    const tool = $('#stool', m.el); tool.style.opacity = 0;
    const slot = (i) => $(`.slot[data-i="${i}"]`, card), r = new U.Run();
    let cur = before, done = false; $('#stok', m.el).addEventListener('click', () => { done = true; r.cancel(); finish(); });
    const finish = () => { CL._holding = false; if (!m.closed) m.close(); };
    try {
      for (let n = 0; n < add; n++) {
        const idx = cur % per(); const s = slot(idx); if (!s) break;
        const sr = s.getBoundingClientRect(), tr = tool.parentElement.getBoundingClientRect();
        tool.style.transition = 'none'; tool.style.opacity = 1; tool.style.transform = `translate(${sr.left + sr.width / 2 - tr.left - 55}px,${sr.top - tr.top - 220}px) rotate(-8deg)`; void tool.getBoundingClientRect();
        tool.style.transition = 'transform .28s cubic-bezier(.5,0,.9,.4)'; tool.style.transform = `translate(${sr.left + sr.width / 2 - tr.left - 55}px,${sr.top - tr.top - 120}px) rotate(0deg)`;
        await r.wait(300);
        C.audio.stamp(); C.scene.bump(6); s.classList.add('on', 'hit'); s.innerHTML = D.stampOn(); if (card.classList.contains('flipped')) card.classList.remove('flipped');
        tool.style.transition = 'transform .25s ease-out'; tool.style.transform = `translate(${sr.left + sr.width / 2 - tr.left - 55}px,${sr.top - tr.top - 230}px) rotate(-6deg)`;
        cur++; await r.wait(360);
        if (cur % per() === 0) { $('#stl', m.el).textContent = 'CARTE PLEINE ! Un pochon t’est offert.'; C.audio.chime([523, 659, 784, 1046, 1318, 1568], 0.08, 1.2); C.fx.confetti({ count: 160, x: innerWidth / 2, y: innerHeight * 0.45 }); C.fx.rain(1600); C.scene.gull.act('celebrate'); await r.wait(700); $$('.slot', card).forEach((x, i) => { x.classList.remove('on', 'hit'); x.innerHTML = i === per() - 1 ? D.gift() : D.stampOff(i + 1); }); }
      }
      tool.style.opacity = 0;
      if (add && cur % per() !== 0) $('#stl', m.el).textContent = `${cur % per()}/${per()} — encore ${per() - (cur % per())} pour ton pochon offert.`;
      // badges
      for (const id of e.badges) { const b = C.store.club.badgeDefs.find((x) => x.id === id); UI.toast(`Badge débloqué : ${U.esc(b.name)} (+${b.pts} pts)`, { kind: 'gain', icon: '★', dur: 3200 }); C.audio.coin(); await r.wait(500); }
      if (!e.badges.length && !add) finish();
    } catch (err) { if (!U.isCancel(err)) console.error(err); }
    CL._holding = false;
  };

  /* the daily grain nudge + first-visit welcome are triggered by chat/main; expose small helpers */
  CL.pillBump = () => C.fx.bump(document.getElementById('btn-club'));
  C.bus.on('club', (e) => { if (e && e.type === 'points' && e.n > 0) { CL.pillBump(); } });
  C.bus.on('club:tier', (e) => { UI.toast(`Nouveau palier : <b>${U.esc(e.tier.name)}</b> — ${e.tier.discount ? '−' + e.tier.discount + ' % sur tout' : 'bienvenue'}`, { kind: 'gain', icon: '★', dur: 4200 }); C.audio.chime([523, 784, 1046, 1568], 0.1, 1.1); C.fx.confetti({ count: 120 }); });
})((window.Cornsty = window.Cornsty || {}));
