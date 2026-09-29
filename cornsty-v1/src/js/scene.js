/* Cornsty - the world: layers, camera (pan between stations, parallax), shelf, basket, merch rack, counter re-painting.
   The camera only PANS between stations (plus optional zoom-out for the wide shot) so the vector layers stay razor sharp. */
(function (C) {
  'use strict';
  const U = C.util, D = C.draw, SE = C.sceneArt, K = D.COL;
  const f = (v) => +v.toFixed(2);

  const stations = {
    overview: { x: 1600, y: 720, z: 0.5, gull: 1450, face: 1, label: 'Vue d’ensemble' },
    machine: { x: 830, y: 740, z: 1, gull: SE.anchors.gull.machine, face: -1, label: 'La machine' },
    counter: { x: 1450, y: 740, z: 1, gull: SE.anchors.gull.counter, face: 1, label: 'Le comptoir' },
    register: { x: 2200, y: 740, z: 1, gull: SE.anchors.gull.register, face: 1, label: 'La caisse' },
    merch: { x: 2800, y: 740, z: 1, gull: SE.anchors.gull.merch, face: 1, label: 'Le vestiaire' },
  };

  const S = (C.scene = {
    W: SE.W, H: SE.H, u: 1, z: 1, cam: { x: 1450, y: 740 }, look: { x: 0, y: 0 }, insets: { top: 64, bottom: 150 }, extra: 0, right: 0, size: { w: 1200, h: 800 },
    stations, station: 'counter', layers: [], gull: null, ready: false, shake: 0,
  });

  /* ------------------------------------------------------------------ build */
  S.build = (mount) => {
    S.mount = mount;
    const fl = C.data.byId('nature');
    mount.innerHTML = `
<div class="stage" id="stage">
  <div class="layer" id="L-sky" data-par="0.05">${SE.sky()}</div>
  <div class="layer" id="L-sea" data-par="0.22">${SE.sea()}</div>
  <div class="layer" id="L-dunes" data-par="0.55">${SE.dunes()}</div>
  <div class="layer main" id="L-main" data-par="1">
    <svg id="world-back" class="wsvg" viewBox="0 0 ${SE.W} ${SE.H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Le kiosque Cornsty sur la plage">
      ${SE.floor()}
      ${SE.stallBack()}
      ${SE.deco()}
      ${SE.surfboard()}
      ${SE.rack()}
      ${SE.machine()}
      <g id="shelf-items"></g>
    </svg>
    <svg id="world" class="wsvg wsvg-gull" viewBox="0 0 ${SE.W} ${SE.H}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><g id="gull-layer"></g></svg>
    <svg id="world-front" class="wsvg wsvg-front" viewBox="0 0 ${SE.W} ${SE.H}" xmlns="http://www.w3.org/2000/svg">
      ${SE.counter(fl)}
      <g id="props"></g>
      ${SE.basket()}
      ${SE.register()}
      ${SE.awning()}
      <g id="fx-layer"></g>
    </svg>
    <canvas id="pop" aria-hidden="true"></canvas>
  </div>
  <div class="grain" aria-hidden="true"></div>
</div>`;
    S.stage = U.$('#stage'); S.main = U.$('#L-main'); S.world = U.$('#world-back'); S.canvas = U.$('#pop');
    S.layers = U.$$('.layer', mount).map((el) => ({ el, par: +el.dataset.par, svg: U.$('svg', el) }));
    S.fx = U.$('#fx-layer');
    D.mountDefs();
    S.renderShelf(); S.renderRack(); S.updateBasket();
    // the gull
    S.gull = C.gull.create({ dir: 1 });
    U.$('#gull-layer').append(S.gull.el);
    S.gull.place(SE.anchors.gull.counter, 1056, 1.3);
    S.ready = true;
    S.layout();
    C.bus.on('cart', () => S.updateBasket());
    C.bus.on('reset', () => S.updateBasket());
    window.addEventListener('resize', U.debounce(S.layout, 60));
    if (window.ResizeObserver) new ResizeObserver(U.debounce(S.layout, 30)).observe(mount);
    // pointer parallax
    window.addEventListener('pointermove', (e) => { if (e.pointerType === 'touch') return; S.look.tx = (e.clientX / innerWidth - 0.5) * 2; S.look.ty = (e.clientY / innerHeight - 0.5) * 2; }, { passive: true });
    U.ticker.add((dt) => S.tick(dt));
    return S;
  };

  /* ------------------------------------------------------------------ shelf / basket / rack */
  const nested = (svgStr, x, y, w, h) => svgStr.replace(/^<svg /, `<svg x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" `);
  S.renderShelf = () => {
    const slots = SE.anchors.shelf, w = SE.anchors.pouchW, h = w * 798 / 488;
    U.$('#shelf-items').innerHTML = C.data.flavors.map((fl, i) => {
      const s = slots[i];
      return `<g class="shelf-pouch hot" data-id="${fl.id}" tabindex="-1" role="button" aria-label="${U.esc(fl.name + ' ' + fl.sub)}"><g class="lift">${nested(D.pouch(fl, { flat: false }), s.x, s.y - h, w, h)}</g></g>`;
    }).join('');
    U.$$('.shelf-pouch').forEach((g) => {
      g.setAttribute('tabindex', '0');
      g.addEventListener('pointerenter', () => C.audio.hover());
      g.addEventListener('click', () => C.bus.emit('shelf:pick', g.dataset.id));
      g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); C.bus.emit('shelf:pick', g.dataset.id); } });
    });
  };
  S.updateBasket = () => {
    const q = C.store.cart.items(), host = U.$('#basket-items'); if (!host) return;
    const list = [];
    q.forEach((it) => { const p = C.data.byId(it.id); for (let i = 0; i < Math.min(it.qty, 4); i++) list.push(p); });
    const shown = list.slice(0, 6), r = U.rng(11);
    host.innerHTML = shown.map((p, i) => {
      const x = -58 + i * 23 + (r() - 0.5) * 8, rot = (r() - 0.5) * 14, w = 52, h = 85;
      const art = p.kind === 'pouch' ? D.pouch(p, { flat: true }) : `<svg viewBox="0 0 100 100"><rect x="10" y="20" width="80" height="70" rx="10" fill="${K.blue}" stroke="${K.ink}" stroke-width="6"/><use href="#s-quat" x="34" y="40" width="32" height="32" fill="${K.cream}"/></svg>`;
      return `<g transform="translate(${f(x)} ${f(-36 - h * 0.62 + (i % 2) * 6)}) rotate(${f(rot)})">${nested(art, -w / 2, 0, w, h)}</g>`;
    }).join('');
    const n = C.store.cart.count(); const num = U.$('#basket-num'); if (num) num.textContent = n;
    const badge = U.$('#basket-count'); if (badge) badge.style.display = n ? '' : 'none';
    if (S._lastCount !== undefined && n > S._lastCount) { const b = U.$('#basket'); b.classList.remove('bump'); void b.getBoundingClientRect(); b.classList.add('bump'); }
    S._lastCount = n;
  };
  S.renderRack = () => {
    const x = SE.anchors.rack.x, host = U.$('#rack-items');
    const item = (id, art, ax, ay, w, h, label, hang) => `<g class="rack-item hot" data-id="${id}" tabindex="-1" role="button" aria-label="${label}">${hang ? `<path d="M${ax + w / 2} 560V${ay + 8}" stroke="${K.ink}" stroke-width="4"/>` : ''}<g class="lift">${nested(art, ax, ay, w, h)}</g></g>`;
    host.innerHTML =
      item('jersey', D.jersey({ view: 'front' }), x - 200, 580, 200, 209, 'Maillot Cornsty', true) +
      item('cap', D.cap(), x + 12, 594, 150, 107, 'Casquette Signature Pattern', true) +
      item('plush', D.plush(), x + 40, 730, 150, 113, 'Peluche mouette bouée', false) +
      item('stickers', D.stickers(), x - 190, 850, 190, 143, 'Pack de stickers', false) +
      `<g class="rack-item hot" data-id="giftbox" tabindex="-1" role="button" aria-label="Box Snack Energy">${'<g class="lift">' + nested(D.giftbox(), x + 6, 890, 190, 145) + '</g>'}</g>`;
    U.$$('.rack-item').forEach((g) => { g.setAttribute('tabindex', '0'); g.addEventListener('pointerenter', () => C.audio.hover()); g.addEventListener('click', () => C.bus.emit('merch:pick', g.dataset.id)); g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); C.bus.emit('merch:pick', g.dataset.id); } }); });
  };

  /* the counter front takes the pattern of the flavour being discussed (cross-fade) */
  S.paint = (flavorId) => {
    const fl = C.data.byId(flavorId); if (!fl || !fl.pattern || S.painted === flavorId) return;
    S.painted = flavorId;
    const a = U.$('#counter-pat'), b = U.$('#counter-pat2');
    b.innerHTML = D.fillPattern(fl, 1720, 196, 0.34);
    b.style.transition = 'none'; b.setAttribute('opacity', 0);
    void b.getBoundingClientRect();
    b.style.transition = 'opacity .55s'; b.setAttribute('opacity', 1);
    clearTimeout(S._paintT);
    S._paintT = setTimeout(() => { a.innerHTML = b.innerHTML; b.style.transition = 'none'; b.setAttribute('opacity', 0); }, 620);
  };

  /* ------------------------------------------------------------------ camera */
  S.layout = () => {
    if (!S.stage) return;
    const r = S.stage.getBoundingClientRect(), cs = getComputedStyle(document.documentElement);
    const top = parseFloat(cs.getPropertyValue('--ui-top')) || 64, bottom = parseFloat(cs.getPropertyValue('--ui-bottom')) || 150;
    S.insets = { top, bottom }; S.size = { w: r.width, h: r.height };
    const stageH = Math.max(200, r.height - top - bottom);
    S.u = U.clamp(Math.max(stageH / 900, r.width / 2100), 0.5, 1.5);
    const u = S.u;
    S.layers.forEach((l) => {
      if (l.el.classList.contains('main')) { l.el.style.width = SE.W * u + 'px'; l.el.style.height = SE.H * u + 'px'; U.$$('.wsvg', l.el).forEach((v) => { v.style.width = SE.W * u + 'px'; v.style.height = SE.H * u + 'px'; }); }
      else if (l.svg) { l.el.style.width = '0'; l.svg.style.cssText = `position:absolute;left:${-1600 * u}px;top:0;width:${6400 * u}px;height:${SE.H * u}px`; }
    });
    // popcorn canvas covers the machine + the pouch-filling area
    const pr = S.popRect = { x: 560, y: 380, w: 640, h: 520 }, dpr = Math.min(2, window.devicePixelRatio || 1);
    Object.assign(S.canvas.style, { left: pr.x * u + 'px', top: pr.y * u + 'px', width: pr.w * u + 'px', height: pr.h * u + 'px' });
    S.canvas.width = Math.round(pr.w * u * dpr); S.canvas.height = Math.round(pr.h * u * dpr); S.dpr = dpr;
    S.apply(); C.bus.emit('layout', S);
  };
  const clampCam = () => {
    const c = S.cam, u = S.u * S.z, visW = (S.size.w - S.right) / u, visH = (S.size.h - S.insets.top - S.insets.bottom - S.extra) / u;
    const minX = visW / 2, maxX = SE.W - visW / 2; c.x = minX > maxX ? SE.W / 2 : U.clamp(c.x, minX, maxX);
    const minY = 320 + visH / 2, maxY = SE.H - 90 - visH / 2; c.y = minY > maxY ? (320 + SE.H - 90) / 2 : U.clamp(c.y, minY, maxY);
  };
  S.apply = () => {
    if (!S.ready) return;
    const u = S.u, z = S.z, w = S.size.w, h = S.size.h, cy = S.insets.top + (h - S.insets.top - S.insets.bottom - S.extra) / 2;
    const lx = S.look.x * 26, ly = S.look.y * 10, sh = S.shake;
    const camx = S.cam.x + lx / (u * z), camy = S.cam.y + ly / (u * z);
    S.layers.forEach((l) => {
      const par = l.par, X = (w - S.right) / 2 - camx * u * z * par + (sh ? (Math.random() - 0.5) * sh : 0), Y = cy - camy * u * z + (sh ? (Math.random() - 0.5) * sh : 0) * 0.6;
      l.el.style.transform = `translate3d(${f(X)}px,${f(Y)}px,0) scale(${f(z)})`;
    });
    S.origin = { x: (w - S.right) / 2 - camx * u * z, y: cy - camy * u * z };
  };
  S.tick = (dt) => {
    let moved = false;
    if (S.look.tx !== undefined) { const k = 1 - Math.pow(0.001, dt); S.look.x += (S.look.tx - S.look.x) * k * 0.6; S.look.y += (S.look.ty - S.look.y) * k * 0.6; moved = true; }
    if (S.shake > 0.05) { S.shake *= Math.pow(0.02, dt); moved = true; } else S.shake = 0;
    if (moved || S._dirty) { S.apply(); S._dirty = false; }
    S.gull && S.gull.render && 0;
  };
  S.w2s = (x, y) => ({ x: S.origin.x + x * S.u * S.z, y: S.origin.y + y * S.u * S.z });
  S.s2w = (x, y) => ({ x: (x - S.origin.x) / (S.u * S.z), y: (y - S.origin.y) / (S.u * S.z) });
  S.pxPerUnit = () => S.u * S.z;
  S.headScreen = () => { const p = S.gull.headPoint(); return S.w2s(p.x, p.y); };

  S.setCam = (x, y, z) => { if (x != null) S.cam.x = x; if (y != null) S.cam.y = y; if (z != null) S.z = z; clampCam(); S.apply(); };
  S.goto = (name, o = {}) => {
    const st = typeof name === 'string' ? stations[name] : name; if (!st) return Promise.resolve();
    if (typeof name === 'string') S.station = name;
    if (S.camRun) S.camRun.cancel();
    const run = (S.camRun = new U.Run());
    const from = { x: S.cam.x, y: S.cam.y, z: S.z }, to = { x: st.x, y: st.y == null ? S.cam.y : st.y, z: st.z == null ? 1 : st.z };
    // on narrow screens keep both the machine and the seagull in frame
    if (typeof name === 'string' && st.gull != null) { const visW = (S.size.w - S.right) / (S.u * to.z); if (visW < 1300 && to.z >= 1) to.x = (st.x + st.gull) / 2; }
    const dur = U.reduced() ? 0 : o.dur == null ? 1000 : o.dur;
    C.bus.emit('station', { name: typeof name === 'string' ? name : 'custom', st });
    S._panning = true;
    return run.tween(dur, (k) => { S.cam.x = U.lerp(from.x, to.x, k); S.cam.y = U.lerp(from.y, to.y, k); S.z = U.lerp(from.z, to.z, k); clampCam(); S.apply(); }, o.ease || U.ease.inOut)
      .catch((e) => { if (!U.isCancel(e)) throw e; })
      .then(() => { if (S.camRun === run) S._panning = false; });
  };
  // when the free area changes (product card / drawer on the right) keep the current station framed inside it
  S.reframe = () => {
    if (S._panning) return;                       // a pan is running: it already clamps against the live inset every frame
    const st = stations[S.station]; if (!st || (st.z || 1) !== S.z) return;
    let x = st.x;
    if (st.gull != null) { const visW = (S.size.w - S.right) / (S.u * S.z); if (visW < 1300 && S.z >= 1) x = (st.x + st.gull) / 2; }
    S.cam.x = x; clampCam();
  };
  /* extension point for OPTIONAL modules (the living kiosk): extra world-aligned layers, parallax included.
     Nothing in the core depends on them; removing the module removes its layers. */
  S.addLayer = (html, par, after) => {
    const el = U.html(html);
    if (after) after.after(el); else S.stage.insertBefore(el, U.$('.grain', S.stage));
    S.layers.push({ el, par, svg: U.$('svg', el) });
    S.layout();
    return el;
  };
  S.removeLayer = (el) => { S.layers = S.layers.filter((l) => l.el !== el); el.remove(); };
  // extra bottom inset (e.g. the product card on phones): the camera glides so the seagull stays visible above it
  S.setExtra = (px, dur = 380) => {
    if (S._extraRun) S._extraRun.cancel();
    const run = (S._extraRun = new U.Run()), from = S.extra;
    return run.tween(U.reduced() ? 0 : dur, (k) => { S.extra = U.lerp(from, px, k); S.apply(); }, U.ease.inOut, false).catch(() => {});
  };
  // the same idea on the right (checkout drawer on desktop)
  S.setRight = (px, dur = 420) => {
    if (S._rightRun) S._rightRun.cancel();
    const run = (S._rightRun = new U.Run()), from = S.right;
    return run.tween(U.reduced() ? 0 : dur, (k) => { S.right = U.lerp(from, px, k); S.reframe(); S.apply(); }, U.ease.inOut, false).catch(() => {});
  };
  S.nudge = (dx, dy = 0) => { S.cam.x += dx; S.cam.y += dy; clampCam(); S.apply(); };
  S.bump = (n = 10) => { S.shake = Math.max(S.shake, n); };

  /* ------------------------------------------------------------------ gull placement helpers */
  S.gullTo = async (stationName, o = {}) => {
    const st = stations[stationName]; if (!st) return;
    const g = S.gull;
    if (Math.abs(g.st.x - st.gull) < 8) { g.face(st.face); return; }
    await g.acts.walk(st.gull, g.st.y, { face: true, dur: o.dur });
    g.face(st.face);
  };
})((window.Cornsty = window.Cornsty || {}));
