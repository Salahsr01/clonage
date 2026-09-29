/* Cornsty - boot, menu/settings, wiring between modules */
(function (C) {
  'use strict';
  const U = C.util, UI = C.ui, $ = U.$, $$ = U.$$;

  /* ------------------------------------------------------------------ menu & settings */
  const openMenu = () => {
    const p = C.store.state.prefs;
    const m = UI.modal({ name: 'menu', title: 'Menu', html: `
<h2>Le kiosque</h2>
<div class="menu-list">
  <button class="btn" data-a="quick">📋 Catalogue rapide (sans animation)</button>
  <button class="btn" data-a="club">🍿 Ma carte Club</button>
  <button class="btn" data-a="faq">❓ Questions fréquentes</button>
  <button class="btn" data-a="orders">📦 Mes commandes</button>
  <button class="btn" data-a="about">🐦 À propos de Cornsty</button>
</div>
<h3>Réglages</h3>
<div class="setting"><span><b>Son</b><br><small>Bruitages du kiosque et voix de la Mouette</small></span><button class="switch" role="switch" aria-checked="${C.audio.on}" data-s="sound" aria-label="Son"></button></div>
<div class="setting"><span><b>Ambiance mer</b><br><small>Vagues très discrètes (avec le son)</small></span><button class="switch" role="switch" aria-checked="${p.sea !== false}" data-s="sea" aria-label="Ambiance mer"></button></div>
<div class="setting"><span><b>Show de fabrication</b><br><small>La Mouette éclate et emballe chaque pochon</small></span><select data-s="showMode" aria-label="Show de fabrication"><option value="auto" ${p.showMode !== 'always' && p.showMode !== 'never' ? 'selected' : ''}>1re fois complet, ensuite rapide</option><option value="always" ${p.showMode === 'always' ? 'selected' : ''}>Toujours complet</option><option value="never" ${p.showMode === 'never' ? 'selected' : ''}>Jamais (instantané)</option></select></div>
<div class="setting"><span><b>Réduire les animations</b><br><small>Caméra, parallaxe et confettis atténués</small></span><button class="switch" role="switch" aria-checked="${U.reduced()}" data-s="motion" aria-label="Réduire les animations"></button></div>
<div class="setting"><span><b>Remettre la démo à zéro</b><br><small>Efface panier, Club et commandes de cet appareil</small></span><button class="btn small" data-a="reset">Réinitialiser</button></div>
<p class="eyebrow">Démo de comparaison · aucun paiement réel · données stockées sur cet appareil uniquement</p>` });
    const el = m.el;
    $$('[data-a]', el).forEach((b) => b.addEventListener('click', () => {
      C.audio.click(); const a = b.dataset.a;
      if (a === 'reset') {
        // two-step confirmation inside the page (native confirm() is blocked in framed / embedded viewers)
        if (!b.classList.contains('armed')) { b.classList.add('armed'); b.textContent = 'Sûr ? Clique encore'; clearTimeout(b._t); b._t = setTimeout(() => { b.classList.remove('armed'); b.textContent = 'Réinitialiser'; }, 4000); return; }
        C.store.reset(); UI.toast('Démo remise à zéro'); m.close(); setTimeout(() => location.reload(), 350); return;
      }
      m.close();
      if (a === 'quick') C.catalog.quick(); else if (a === 'club') C.club.open(); else if (a === 'orders') C.club.open('history'); else if (a === 'faq') faq(); else if (a === 'about') about();
    }));
    $$('.switch', el).forEach((s) => s.addEventListener('click', () => {
      const on = s.getAttribute('aria-checked') !== 'true'; s.setAttribute('aria-checked', on); C.audio.tick();
      if (s.dataset.s === 'sound') { C.audio.enable(on); C.store.prefs({ sound: on }); UI.syncSound(); }
      else if (s.dataset.s === 'sea') { C.store.prefs({ sea: on }); C.audio.sea(on && C.audio.on); }
      else if (s.dataset.s === 'motion') { C.store.prefs({ motion: on ? 'reduced' : 'full' }); document.documentElement.classList.toggle('reduced', U.reduced()); }
    }));
    $('[data-s=showMode]', el).addEventListener('change', (e) => { C.store.prefs({ showMode: e.target.value }); UI.toast('Réglage enregistré'); });
  };
  const faq = () => {
    const rows = C.data.faq.map((f, i) => `<details ${i === 0 ? 'open' : ''}><summary>${U.esc(f.q)}</summary><p>${U.esc(f.a.replace('salut@cornsty.fr', C.cfg.brand.email))}</p></details>`).join('');
    UI.modal({ name: 'faq', title: 'Questions fréquentes', html: `<h2>Questions fréquentes</h2>${rows}<p class="eyebrow">Une autre question ? ${U.esc(C.cfg.brand.email)} — ou demande à la Mouette.</p>` });
  };
  const about = () => UI.modal({ name: 'about', title: 'À propos', html: `<h2>Cornsty</h2><p><b>${U.esc(C.cfg.brand.tagline)}</b></p><p>Cornsty existe pour rendre au pop-corn le droit d’avoir vraiment du goût : généreux, honnête, sans chichi. Du maïs 100 % français, éclaté à l’air, enrobé de saveurs qui ont du caractère — pour transformer une soirée devant un écran en petite fête.</p><p>Valeurs : <b>la générosité d’abord</b> (des pochons pleins), <b>zéro prétention</b>, <b>l’impact du goût</b>, <b>bonnes ondes &amp; chill</b>.</p><p class="eyebrow">Site de démonstration construit à partir du brand book (dessins vectoriels d’origine). Textes légaux, prix et valeurs nutritionnelles : à valider avant mise en ligne.</p>` });

  /* ------------------------------------------------------------------ wiring */
  const wire = () => {
    C.bus.on('ui:station', (n) => { if (n === 'register') { C.chat.goStation('register'); C.shop.open(); } else C.chat.goStation(n); });
    C.bus.on('ui:cart', () => { if (C.pop.busy()) { UI.toast('Une seconde, je finis ce pochon !'); return; } C.chat.goStation('register'); C.shop.open(); });
    C.bus.on('ui:club', () => C.club.open());
    C.bus.on('ui:menu', openMenu);
    C.bus.on('menu:click', () => C.chat.act('other'));
    // scene hot spots
    const world = C.scene.world;
    const mb = $('#menu-board'); mb && mb.addEventListener('click', () => C.catalog.quick());
    const sb = $('#surfboard'); sb && sb.addEventListener('click', () => surfGag());
    // returning from the checkout drawer
    C.bus.on('checkout:close', () => { UI.tab('counter'); if (!C.pop.busy()) { C.scene.goto('counter'); C.scene.gullTo('counter'); C.chat.mainAfterCheckout && C.chat.mainAfterCheckout(); UI.chips(C.chat.mainChips()); } });
    // club events -> gull reactions
    C.bus.on('club:badge', (b) => { UI.toast(`Badge : ${U.esc(b.name)}`, { kind: 'gain', icon: '★' }); });
    C.bus.on('club', (e) => { if (e && e.type === 'points' && e.n > 0 && e.why && !/Commande|Bienvenue|Badge/.test(e.why)) UI.toast(`+${e.n} point${e.n > 1 ? 's' : ''} — ${U.esc(e.why)}`, { kind: 'gain', icon: '✦' }); });
  };
  const surfGag = async () => {
    const g = C.scene.gull; if (C.pop.busy()) return;
    C.audio.boing(); g.act('surprise'); await UI.say(['Ma planche ! Elle est là depuis l’été dernier.', 'Non, je ne surfe pas pendant les heures de service. Enfin… pas souvent.'], { gap: 300 });
    g.act('laugh'); UI.chips(C.chat.mainChips());
  };

  /* ------------------------------------------------------------------ boot */
  C.boot = async () => {
    const app = document.getElementById('app'), p = C.store.state.prefs;
    if (U.reduced()) document.documentElement.classList.add('reduced');
    // paper grain (tiny procedural noise, no image file)
    try { const c = document.createElement('canvas'); c.width = c.height = 96; const x = c.getContext('2d'), id = x.createImageData(96, 96); for (let i = 0; i < id.data.length; i += 4) { const v = 90 + Math.random() * 150; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 255; } x.putImageData(id, 0, 0); document.documentElement.style.setProperty('--grain', `url(${c.toDataURL()})`); } catch (e) { /* cosmetic */ }
    C.scene.build(app); C.ui.mount(app); C.pop.init(); wire();
    document.body.classList.add('hud-hidden');
    // referral link ?ref=POP-XXXX
    try { const ref = new URLSearchParams(location.search).get('ref'); if (ref && !C.store.state.club.ref.used) { const r = C.store.club.useReferral(ref); if (r.ok) setTimeout(() => UI.toast('Code parrain appliqué : ' + r.msg, { kind: 'good' }), 2500); } } catch (e) { /* ignore */ }
    if (p.sound) { /* audio can only start after a gesture: the intro button unlocks it */ }
    C.shop.syncRegister(); C.scene.paint('nature');
    // hide the seagull behind the counter until the intro ends
    const g = C.scene.gull; g.S.bobY.snap(520); g.st.idle = false;
    C.scene.setCam(1450, 740, 0.62); // wide shot during the intro
    await C.intro.play({ returning: !!p.introSeen });
    C.store.prefs({ introSeen: true });
    // enter: camera pushes in, the gull pops up from behind the counter
    C.scene.goto('counter', { dur: 1300, ease: U.ease.inOut });
    await U.wait(700);
    g.S.bobY.k = 90; g.S.bobY.t = 0; g.S.sq.snap(0.85); g.S.sq.t = 1; C.audio.boing(); g.st.idle = true;
    await U.wait(450);
    C.chat.start();
    if (C.intro.simple) setTimeout(() => C.catalog.quick(), 900);
    window.__cornsty = C;
  };
  // boot now if the document is already parsed (script injected late by a host page), otherwise wait for it
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => C.boot()); else C.boot();
})(window.Cornsty);
