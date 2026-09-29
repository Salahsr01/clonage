/* Cornsty - the living kiosk, part 3/4: the ENGINE.  An OPTIONAL layer over the finished kiosk:
     day and night (sunrise/sunset of the visitor's own clock), moon phase, weather, the feasts of the year, a drop board with a real
     countdown, and a decor that grows with the visitor's loyalty tier.

   Rules this module keeps, so it can never disturb the rest of the site (now or when the site grows):
     - ADDITIVE ONLY: it adds its own layers / groups (all marked lv-*) and removes them on unmount(); it never edits the core art.
     - ONE-WAY: the core never depends on it. The few core hooks (boot, menu, greeting) are guarded `C.living && ...`.
     - CHEAP: no per-frame work; colours change only when they visibly change; particles are compositor-only CSS transforms;
       a governor drops to "calm" (static look) if the frame rate suffers; nothing moves under prefers-reduced-motion.
     - SAFE: every entry point is wrapped; any error unmounts the module instead of breaking the shop.
     - OFF SWITCHES: cfg.living.enabled = false, window.CORNSTY_LIVING = false, or the visitor's menu (Complet / Calme / Désactivé). */
(function (C) {
  'use strict';
  const U = C.util, M = C.livingModel, A = C.livingArt;
  const $ = U.$, clamp = M.clamp, lerp = M.lerp, smooth = M.smooth;
  const cfg = () => (C.cfg && C.cfg.living) || {};

  // level: 2 = full, 1 = lite (no weather particles, no fireworks: the heavy, full-screen animated layers), 0 = calm (the same look, standing still)
  const L = (C.living = { version: 1, mounted: false, mode: 'auto', level: 2, calm: false, lite: false, failed: false, over: {}, state: null, gv: { bad: 0 } });
  const last = {};                                         // last values written to the DOM (skip identical writes)
  let els = {}, nodes = [], timers = {}, offTicker = null, offBus = [], thunderT = null, fwT = null;
  const helloed = {};

  const fail = (where, e) => { if (L.failed) return; L.failed = true; try { console.warn('[living] disabled after an error in ' + where, e); L.unmount(); } catch (e2) { /* ignore */ } };
  const guard = (name, fn) => (...a) => { try { return fn(...a); } catch (e) { fail(name, e); } };

  /* ------------------------------------------------------------------ what is the kiosk like right now? */
  const PRESET = { clear: { type: 'clear', cloud: 0.1, intensity: 0 }, clouds: { type: 'clouds', cloud: 0.85, intensity: 0 }, rain: { type: 'rain', cloud: 0.9, intensity: 0.8 }, storm: { type: 'storm', cloud: 1, intensity: 1 }, snow: { type: 'snow', cloud: 0.85, intensity: 0.8 }, fog: { type: 'fog', cloud: 0.6, intensity: 0.85 } };
  const events = () => cfg().events || [];
  // the sky you can see is the strip left of the kiosk at the machine station (sky x about -880..-450 on desktops): both arcs live inside it
  const SKY_X0 = -880, SKY_X1 = -480;
  function compute() {
    const c = cfg(), o = L.over, d = new Date(), sun = M.sunTimes(d, c.lat);
    let hour = M.hourOf(d);
    if (o.time && o.time !== 'real') hour = /^\d{1,2}:\d{2}$/.test(o.time) ? +o.time.split(':')[0] + +o.time.split(':')[1] / 60 : (M.momentHour(o.time, sun) ?? hour);
    const season = M.seasonAt(d);
    const ev = o.event === 'none' ? null : o.event && o.event !== 'auto' ? events().find((e) => e.id === o.event) || null : M.eventAt(d, events());
    let weather;
    if (o.weather && o.weather !== 'auto') weather = PRESET[o.weather] || PRESET.clear;
    else if ((c.weather || {}).mode === 'real' && L.realWeather) weather = L.realWeather;
    else if ((c.weather || {}).mode === 'clear' || (c.weather || {}).mode === 'off') weather = PRESET.clear;
    else weather = M.pseudoWeather(d, hour, season);
    if (ev && ev.particles === 'snow' && weather.type === 'clear' && o.weather == null && (c.weather || {}).mode !== 'real') weather = Object.assign({}, weather, { cloud: Math.max(weather.cloud, 0.5) });
    const light = M.applyWeather(M.lightAt(hour, sun), weather), moon = M.moon(d), arc = M.moonArc(hour, sun, moon);
    const f = (hour - sun.sunrise) / (sun.sunset - sun.sunrise), fc = clamp(f, 0, 1), sn = Math.sin(Math.PI * fc);
    const sunSeen = light.sunVisible === undefined ? 1 : light.sunVisible;
    const night = light.night, overcastLights = weather.type === 'storm' ? 0.45 : weather.type === 'rain' ? 0.22 : 0;
    return {
      d, hour, sun, season, ev, weather, light, moon, moonArc: arc, night,
      sunPos: { x: lerp(SKY_X0, SKY_X1, fc), y: 690 - 330 * sn + (1 - sn) * 20, s: 1 + (1 - sn) * 0.5, op: f > -0.04 && f < 1.04 ? smooth((f + 0.04) / 0.06) * smooth((1.04 - f) / 0.06) * sunSeen : 0 },
      moonPos: arc >= 0 ? { x: lerp(SKY_X0, SKY_X1, arc), y: 690 - 300 * Math.sin(Math.PI * arc), op: smooth((night - 0.25) / 0.35) * smooth(arc / 0.06) * smooth((1 - arc) / 0.06) } : { x: 0, y: 900, op: 0 },
      stars: smooth((night - 0.5) / 0.4) * (1 - weather.cloud * 0.85),
      lights: clamp(smooth((night - 0.12) / 0.35) + overcastLights, 0, 1),
      phase: night > 0.9 ? 'night' : hour < sun.noon ? (night > 0.3 ? 'dawn' : 'morning') : light.warm > 0.5 ? 'sunset' : night > 0.3 ? 'dusk' : 'day',
    };
  }

  /* ------------------------------------------------------------------ building the layers (once) */
  const own = (n) => { nodes.push(n); return n; };
  function build() {
    const S = C.scene, D = C.draw, K = D.COL;
    els.sky = own(S.addLayer(A.sky(), 0.05, $('#L-sky')));
    const q = (s, r = els.sky) => $(s, r);
    Object.assign(els, {
      s: [q('#lv-s0'), q('#lv-s1'), q('#lv-s2')], sun: q('#lv-sun'), moon: q('#lv-moon'), moonLit: q('#lv-moonlit'), moonClip: q('#lv-moonlit-c'), stars: q('#lv-stars'), clouds: q('#lv-clouds'),
      cl: U.$$('.lv-cl', els.sky), birds: q('#lv-birds'), fx: q('#lv-fx'),
    });
    // sea + dunes: a tint of their own (same colour as the kiosk), plus a boat / two walkers
    const sea = $('.sea-svg'), dunes = $('.dunes-svg');
    sea.insertAdjacentHTML('beforeend', A.boat());
    els.boat = own(sea.lastElementChild);
    els.seaTint = own(U.svg('rect', { class: 'lv-seatint', x: -1600, y: 688, width: 6400, height: 262, fill: 'rgba(0,0,0,0)' })); sea.append(els.seaTint);
    dunes.insertAdjacentHTML('beforeend', A.walkers());
    els.walkers = own(dunes.lastElementChild);
    els.duneTints = U.$$('path', dunes).filter((p) => !p.closest('g')).map((p) => { const c = p.cloneNode(false); c.setAttribute('class', 'lv-dunetint'); c.setAttribute('fill', 'rgba(0,0,0,0)'); c.setAttribute('stroke', 'none'); dunes.append(c); return own(c); });
    els.boatLamp = $('.lv-boat-l', els.boat);
    // the kiosk: tint (composited on its own so recolouring never repaints the scene) + glow above it
    S.main.insertAdjacentHTML('beforeend', A.tint()); els.tint = own(S.main.lastElementChild); els.surf = $('#surfboard', S.world); els.stageBg = S.stage.style.background;
    S.main.insertAdjacentHTML('beforeend', A.glow()); els.glow = own(S.main.lastElementChild);
    Object.assign(els, { lights: $('#lvg-lights', els.glow), bulbs: $('#lvg-bulbs', els.glow), signGlow: $('#lvg-sign', els.glow), dropGlowG: $('#lvg-drop', els.glow), propsGlow: $('#lvg-props', els.glow) });
    // physical decor: wall (clock, sign, drop board, crab) before the bunting, feast props, counter-top decor
    const back = S.world;
    back.querySelector('#deco').insertAdjacentHTML('beforebegin', `<g id="lv-evwall"></g><g id="lv-wall">${A.clock()}<g id="lv-signwrap"></g>${A.dropBody()}${A.crab()}</g>`);
    els.evwall = own(back.querySelector('#lv-evwall')); els.wall = own(back.querySelector('#lv-wall')); els.signwrap = $('#lv-signwrap', els.wall);
    const frontSvg = $('#world-front'); frontSvg.querySelector('#counter').insertAdjacentHTML('afterend', '<g id="lv-front"><g id="lv-stickers"></g><g id="lv-trophy-w"></g><g id="lv-evfront"></g></g>');
    els.front = own(frontSvg.querySelector('#lv-front')); els.stickers = $('#lv-stickers', els.front); els.trophy = $('#lv-trophy-w', els.front); els.evfront = $('#lv-evfront', els.front);
    els.hh = $('#lv-hh', els.wall); els.mh = $('#lv-mh', els.wall); els.dropT = $('#lv-drop-t', els.wall); els.dropN = $('#lv-drop-n', els.wall); els.dropS = $('#lv-drop-s', els.wall);
    // stage: vignette + weather (screen space, under the UI)
    const grain = $('.grain', S.stage);
    els.vig = own(U.el('div', { class: 'lv-vig', 'aria-hidden': 'true' })); S.stage.insertBefore(els.vig, grain);
    els.wx = own(U.el('div', { class: 'lv-wx', 'aria-hidden': 'true', 'data-wx': 'clear' }));
    els.wx.innerHTML = '<div class="lv-fog"></div><div class="lv-leaves lv-p"></div><div class="lv-snow lv-snow-b lv-r"></div><div class="lv-rain lv-rain-b"></div><div class="lv-snow lv-snow-a"></div><div class="lv-rain lv-rain-a"></div><div class="lv-hearts lv-p lv-up"></div><div class="lv-confetti lv-p"></div><div class="lv-flash"></div>';
    S.stage.insertBefore(els.wx, grain);
    const small = innerWidth < 700;
    const tex = (sel, img, tw, th, dur) => { const n = $(sel, els.wx); n.style.backgroundImage = img; n.style.setProperty('--tw', tw + 'px'); n.style.setProperty('--th', th + 'px'); n.style.animationDuration = dur + 's'; n.hidden = true; return n; };
    els.rainA = tex('.lv-rain-a', A.rainTile(70, 300, small ? 4 : 5, 26, 2.2, 'rgba(228,236,255,.8)', 3), 70, 300, 0.5);
    els.rainB = tex('.lv-rain-b', A.rainTile(44, 190, 4, 16, 1.6, 'rgba(210,222,250,.55)', 9), 44, 190, 0.8);
    els.snowA = tex('.lv-snow-a', A.snowTile(320, 320, 22, 2.2, 4.4, 5), 320, 320, 11);
    els.snowB = tex('.lv-snow-b', A.snowTile(220, 220, 20, 1.2, 2.4, 8), 220, 220, 15);
    els.leaves = tex('.lv-leaves', A.leafTile(420, 420, 3, 4, ['#FF8A1E', '#DE3F39', '#FFD65C', '#B8672A']), 420, 420, 30);
    els.hearts = tex('.lv-hearts', A.heartTile(400, 600, 6, 6), 400, 600, 22);
    els.confetti = tex('.lv-confetti', A.confettiTile(380, 380, 15, 2), 380, 380, 14);
    els.fog = $('.lv-fog', els.wx); els.fog.style.setProperty('--lvfog', fogTile()); els.fog.hidden = true; els.flash = $('.lv-flash', els.wx);
    S.stage.classList.add('lv-on');
    S.layout();
  }
  const fogTile = () => { const r = M.rng(21); let s = ''; for (let i = 0; i < 7; i++) { const x = r() * 900, y = 120 + r() * 520, rx = 180 + r() * 220, ry = 60 + r() * 60; for (const ox of [0, 900, -900]) s += `<ellipse cx="${(x + ox).toFixed(0)}" cy="${y.toFixed(0)}" rx="${rx.toFixed(0)}" ry="${ry.toFixed(0)}" fill="url(#g)"/>`; } return 'url("data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="900" height="700" viewBox="0 0 900 700"><defs><radialGradient id="g"><stop offset="0" stop-color="#EEF1FF" stop-opacity=".62"/><stop offset="1" stop-color="#EEF1FF" stop-opacity="0"/></radialGradient></defs>${s}</svg>`) + '")'; };

  /* ------------------------------------------------------------------ writing the state into the DOM */
  const set = (key, val, fn) => { if (last[key] === val) return false; last[key] = val; fn(val); return true; };
  const mv = (el, x, y, s, op) => { el.style.transform = `translate(${x.toFixed(0)}px,${y.toFixed(0)}px) scale(${s.toFixed(2)})`; el.style.opacity = op.toFixed(3); };
  function render(st) {
    const l = st.light, grey = (l.cloud || 0) * 0.55;
    // sky
    set('sky', l.sky.join(), () => { l.sky.forEach((c, i) => els.s[i].setAttribute('stop-color', c)); C.scene.stage.style.background = l.sky[0]; });        // above the sky layer (wide shot) the stage shows the sky's own top colour
    set('sun', [st.sunPos.x | 0, st.sunPos.y | 0, st.sunPos.s.toFixed(2), st.sunPos.op.toFixed(2), l.warm.toFixed(2)].join(), () => { mv(els.sun, st.sunPos.x, st.sunPos.y, st.sunPos.s, st.sunPos.op); els.sun.querySelector('use').setAttribute('fill', M.mixHex('#FFE07A', '#FF9A55', clamp(l.warm, 0, 1) * 0.8)); });
    set('moon', [st.moonPos.x | 0, st.moonPos.y | 0, st.moonPos.op.toFixed(2)].join(), () => mv(els.moon, st.moonPos.x, st.moonPos.y, 1, st.moonPos.op));
    set('phase', st.moon.k.toFixed(2) + st.moon.waxing, () => { const d = A.moonPath(st.moon.k, st.moon.waxing); els.moonLit.setAttribute('d', d); els.moonClip.setAttribute('d', d); });
    set('stars', st.stars.toFixed(2), (v) => { els.stars.style.opacity = v; });
    set('fx', smooth((st.night - 0.3) / 0.3).toFixed(2), (v) => { els.fx.style.opacity = v; });
    let cloudFill = M.mixHex('#F8F2E0', '#B6BBD2', grey); cloudFill = M.mixHex(cloudFill, l.sky[1], 0.22 * l.warm); cloudFill = M.mixHex(cloudFill, '#5A63B0', st.night * 0.85);
    set('cloudfill', cloudFill, (v) => { els.clouds.style.fill = v; });
    set('clouds', (st.weather.cloud || 0).toFixed(2), () => els.cl.forEach((c, i) => { c.style.opacity = clamp(2.2 + (st.weather.cloud || 0) * 6 - i, 0, 1).toFixed(2); }));
    set('birds', st.night < 0.3 && st.weather.type !== 'rain' && st.weather.type !== 'storm' ? 1 : 0, (v) => { els.birds.style.opacity = v; });
    // tint over the kiosk, the sea and the dunes
    const rgba = M.rgba(l.tint);
    set('tint', rgba, () => { els.tint.style.fill = rgba; if (els.surf) els.surf.style.filter = `brightness(${(1 - l.tint[3] * 0.9).toFixed(2)})`; els.seaTint.style.fill = M.rgba([l.tint[0], l.tint[1], l.tint[2], Math.min(0.6, l.tint[3] * 1.12)]); els.duneTints.forEach((t) => { t.style.fill = rgba; }); });
    // lights
    set('lights', st.lights.toFixed(2), (v) => { els.lights.style.opacity = v; els.boatLamp.style.opacity = v > 0.4 ? 1 : 0; });
    set('vig', (st.night * 0.9).toFixed(2), (v) => { els.vig.style.opacity = v; });
    // clock
    clockTick(st);
    // feasts, weather layers
    applyEvent(st.ev, st);
    weatherLayers(st);
    L.state = st;
  }
  function clockTick(st) {
    const h = Math.floor(st.hour) % 24, m = Math.floor((st.hour % 1) * 60);
    set('clock', h + ':' + m, () => { els.hh.setAttribute('transform', `rotate(${((h % 12) + m / 60) * 30})`); els.mh.setAttribute('transform', `rotate(${m * 6})`); });
  }

  /* ---- weather ---- */
  const showL = (el, on, op) => {
    clearTimeout(el._t);
    if (on) { el.hidden = false; requestAnimationFrame(() => { el.style.opacity = op; }); }
    else if (!el.hidden) { el.style.opacity = 0; el._t = setTimeout(() => { el.hidden = true; }, 2600); }
  };
  function weatherLayers(st) {
    const w = st.weather, ev = st.ev, quiet = L.lite || U.reduced();          // lite (and calm, which implies it): no particles
    const season = (cfg().seasons || {})[st.season] || {};
    const rain = w.type === 'rain' || w.type === 'storm' ? clamp(0.4 + 0.6 * w.intensity, 0, 1) : 0;
    const snowW = w.type === 'snow' ? clamp(0.45 + 0.55 * w.intensity, 0, 1) : 0;
    const part = ev ? ev.particles : season.particles;
    const snowE = part === 'snow' && !rain && !snowW ? 0.5 : 0;
    const key = [rain.toFixed(1), snowW.toFixed(1), snowE, w.type === 'fog', part, quiet, st.night > 0.5].join();
    if (last.wx === key) return; last.wx = key;
    els.wx.dataset.wx = w.type;
    const small = innerWidth < 700;
    showL(els.rainA, !quiet && rain > 0, rain);
    showL(els.rainB, !quiet && rain > 0 && !small, rain * 0.85);
    showL(els.snowA, !quiet && (snowW > 0 || snowE > 0), Math.max(snowW, snowE));
    showL(els.snowB, !quiet && !small && (snowW > 0 || snowE > 0), Math.max(snowW, snowE) * 0.8);
    showL(els.fog, w.type === 'fog', 0.85);
    showL(els.leaves, !quiet && part === 'leaves' && !rain && w.type !== 'fog', 0.9);
    showL(els.hearts, !quiet && part === 'hearts', 0.95);
    showL(els.confetti, !quiet && part === 'confetti', 0.9);
    // thunder
    clearTimeout(thunderT); thunderT = null;
    if (!quiet && w.type === 'storm') scheduleThunder();
    ambience(st);
  }
  function scheduleThunder() {
    clearTimeout(thunderT);
    thunderT = setTimeout(guard('thunder', () => {
      if (!L.mounted || document.hidden) return scheduleThunder();
      els.flash.animate([{ opacity: 0 }, { opacity: 0.65 }, { opacity: 0.1 }, { opacity: 0.5 }, { opacity: 0 }], { duration: 560, easing: 'linear' });
      if (C.audio && C.audio.thunder && cfg().sound !== false) C.audio.thunder(0.35 + Math.random() * 1.1);
      scheduleThunder();
    }), 7000 + Math.random() * 15000);
  }
  function ambience(st) {
    if (!C.audio || !C.audio.ambience || cfg().sound === false) return;
    const w = st.weather, rain = w.type === 'rain' || w.type === 'storm' ? 0.45 + 0.55 * w.intensity : 0;
    const crickets = st.night > 0.75 && !rain && w.type !== 'snow' && st.season !== 'winter' ? 1 : 0;
    C.audio.ambience(L.calm || U.reduced() ? {} : { rain, wind: w.type === 'storm' ? 1 : w.type === 'clouds' ? 0.3 : 0.12, night: crickets });
  }

  /* ---- feasts ---- */
  const SLOT_A = 1905;
  function applyEvent(ev, st) {
    const key = ev ? ev.id : '';
    if (last.event === key) return; last.event = key;
    const S = C.scene;
    // bunting
    U.$$('#deco .flag').forEach((g) => { g.style.display = ''; const p = g.querySelector('path'); if (p.dataset.lvo) p.setAttribute('fill', p.dataset.lvo); });
    if (ev && ev.bunting) U.$$('#deco .flag').forEach((g, i) => { const p = g.querySelector('path'); if (!p.dataset.lvo) p.dataset.lvo = p.getAttribute('fill'); p.setAttribute('fill', ev.bunting[i % ev.bunting.length]); if (ev.id === 'valentin') g.style.display = 'none'; });
    // string lights
    els.bulbs.innerHTML = A.bulbs(ev && ev.lights ? ev.lights : undefined);
    const props = (ev && ev.props) || [];
    els.evfront.innerHTML = (props.includes('pumpkins') ? A.pumpkins(SLOT_A, 880) : '') + (props.includes('gifts') ? A.gifts(SLOT_A + 40, 880) : '') + (props.includes('hearts') ? A.hearts(SLOT_A + 20, 880) : '');
    els.evwall.innerHTML = (props.includes('garland') ? A.garland() : '') + (props.includes('wreath') ? A.wreath(1175, 484) : '') + (props.includes('cobweb') ? A.cobweb(484, 392) : '') + (props.includes('spider') ? A.spider(590, 392) : '')
      + (props.includes('streamers') ? A.streamers() : '') + (props.includes('heartBunting') ? A.heartBunting(1000, 1340, 396, 8) + A.heartBunting(1560, 1900, 396, 8) + A.heartBunting(2120, 2700, 396, 12) : '');
    els.propsGlow.innerHTML = props.includes('pumpkins') ? A.pumpkinFace(SLOT_A, 880) : '';
    // sky: fireworks and bats (only visible after dusk, see fxOpacity)
    let fx = '';
    if (ev && ev.fireworks && !L.lite) { const cols = ['#FFD65C', '#F5A3C7', '#8FE3D0', '#FF8A6B', '#B7C4FF']; [[-760, 440], [-620, 520], [-520, 410], [-420, 500], [60, 430], [300, 500]].forEach(([x, y], i) => { fx += A.firework(x, y, cols[i % cols.length], (i * 1.3).toFixed(1)); }); }
    if (ev && ev.bats) fx += A.bats();
    els.fx.innerHTML = fx;
    // the seagull's hat
    try { const g = S.gull; g && g.accessory && g.accessory(ev && ev.hat ? A.accessory(ev.hat) : ''); } catch (e) { /* ignore */ }
    clearTimeout(fwT); if (ev && ev.fireworks && !L.lite) scheduleFireworkSound();
  }
  function scheduleFireworkSound() {
    clearTimeout(fwT);
    fwT = setTimeout(guard('firework', () => { if (L.mounted && !document.hidden && L.state && L.state.night > 0.6 && C.audio && C.audio.firework && cfg().sound !== false && !L.calm) C.audio.firework(); scheduleFireworkSound(); }), 6000 + Math.random() * 9000);
  }

  /* ---- loyalty decor: sign, stickers, trophy ---- */
  function loyalty() {
    if (!L.mounted) return;
    const cl = C.store.club, tier = cl.tier(), name = (C.store.state.prefs.name || '').trim(), badges = C.store.state.club.badges || {};
    const chez = (tier.id === 'mouette' || tier.id === 'legende') && name;
    const text = chez ? ('CHEZ ' + name.toUpperCase()).slice(0, 14) : 'OUVERT';
    const tone = tier.id === 'legende' ? '#FFD65C' : tier.id === 'mouette' ? '#5CE6CB' : '#FF7BAC';
    const w = clamp(60 + text.length * 21, 170, 262), cx = 424 - w / 2, cy = 500;
    set('sign', [text, tone, w].join('|'), () => {
      els.signwrap.innerHTML = A.signBody(cx, cy, w);
      $('#lv-sign-t', els.signwrap).textContent = text; els.signGlow.innerHTML = A.signGlow(text, cx, cy, tone);
      $('#lv-sign-t', els.signwrap).setAttribute('fill', tier.id === 'legende' ? '#8A7431' : '#5A62B8');
    });
    set('stickers', Object.keys(badges).sort().join(), () => { els.stickers.innerHTML = A.stickers(cl.badgeDefs, badges); });
    set('trophy', tier.id === 'legende', (v) => { els.trophy.innerHTML = v ? A.trophy(2580, 880) : ''; });
  }

  /* ---- drop board ---- */
  function dropTick() {
    if (!els.dropT) return;
    const d = C.cfg.drop; if (!d) return;
    const ds = M.dropState(Date.now(), d);
    const txt = ds.live ? 'EN COURS' : M.fmtCountdown(ds.msToNext);
    set('dropt', txt, (v) => { els.dropT.textContent = v; });
    set('dropn', d.name + '|' + ds.live, () => { els.dropN.textContent = d.name; els.dropS.textContent = ds.live ? `ENCORE ${M.fmtCountdown(ds.msLeft)}` : 'PROCHAIN DROP'; els.dropT.setAttribute('fill', ds.live ? '#8DF0B3' : '#FFD65C'); });
    if (ds.live) els.dropS.textContent = `ENCORE ${M.fmtCountdown(ds.msLeft)}`;
    set('dropglow', ds.live, (v) => { els.dropGlowG.innerHTML = v ? A.dropGlow() : ''; });
  }

  /* ------------------------------------------------------------------ small interactions (never while the show runs) */
  const busy = () => C.pop.busy() || document.body.classList.contains('has-modal');
  const pickOf = (a) => a[Math.floor(Math.random() * a.length)];
  const talk = async (lines, act) => {
    const UI = C.ui, g = C.scene.gull; if (busy()) return;
    if (act) g.act(act);
    await UI.say(lines, { gap: 350 }); UI.chips(C.chat.mainChips());
  };
  const GAGS = {
    'lv-clock': () => {
      const st = L.state || compute(), h = Math.floor(st.hour) % 24, m = Math.floor((st.hour % 1) * 60), hh = String(h).padStart(2, '0'), mm = String(m).padStart(2, '0');
      const quip = { morning: 'Parfait pour un premier pochon.', dawn: 'Les lève-tôt ont droit au meilleur pop-corn.', day: 'Il n’y a pas d’heure pour le pop-corn. Vraiment pas.', sunset: 'Les guirlandes vont s’allumer, tu vas voir.', dusk: 'C’est l’heure où le kiosque brille.', night: 'Il est tard, mais le kiosque ne ferme jamais. Moi, si, un peu.' }[st.phase];
      return talk([`Il est **${hh} h ${mm}** au kiosque.`, quip], 'point');
    },
    'lv-sign': () => talk(pickOf([['Ouvert. Toujours. Même quand je dors debout.'], ['Cette enseigne s’allume toute seule au coucher du soleil. Je n’y suis pour rien.'], ['« Ouvert », ça veut dire que je suis là. En vrai, je suis surtout là pour le pop-corn.']]), 'nod'),
    'lv-drop': () => { if (busy()) return; C.chat.act('drop'); },
    'lv-crab': () => { const g = C.scene.gull; if (busy()) return; C.audio.boing && C.audio.boing(); return talk(pickOf([['Aïe ! Il m’a pincé la patte.', 'C’est Gérard. Il vit là depuis avant le kiosque.'], ['Ne le nourris pas au caramel, il devient impossible.'], ['Il marche de côté. C’est une méthode de vente comme une autre.']]), 'surprise'); },
  };
  function bindClicks() {
    const h = guard('click', (e) => { if (e.type === 'keydown' && e.key !== 'Enter' && e.key !== ' ') return; const t = e.target.closest && e.target.closest('#lv-clock,#lv-sign,#lv-drop,#lv-crab'); if (!t) return; e.preventDefault(); const f = GAGS[t.id]; if (f) f(); });
    els.wall.addEventListener('click', h); els.wall.addEventListener('keydown', h);
  }

  /* ------------------------------------------------------------------ lifecycle */
  function start() {
    const tick = guard('tick', () => { if (document.hidden) return; const st = compute(); render(st); dropTick(); });
    tick(); loyalty();
    timers.tick = setInterval(tick, 15000);
    timers.sec = setInterval(guard('sec', () => { if (!document.hidden) dropTick(); }), 1000);
    // governor: if the frame rate suffers, the ambience gets out of the way (static "calm" look) and stays there for the session
    let n = 0, sum = 0, prev = 0, t0 = 0;
    // a device that says it is weak starts lite
    if ((navigator.hardwareConcurrency || 4) <= 2 || (navigator.deviceMemory && navigator.deviceMemory <= 2)) setLevel(Math.min(L.level, 1), 'device');
    offTicker = U.ticker.add(guard('governor', (dt, now) => {
      if (!L.mounted) return;
      if (prev && now - prev < 200 && !document.hidden) { n++; sum += now - prev; }
      prev = now; if (!t0) t0 = now;
      const duck = C.pop.busy() || document.body.classList.contains('has-modal');
      set('duck', duck, (v) => C.scene.stage.classList.toggle('lv-duck', v));
      if (now - t0 > 2500) { const avg = n ? sum / n : 0; t0 = now; n = 0; sum = 0; L.gv.avg = avg; if (!L.gv.off && avg > 34 && L.level > 0 && performance.now() > 9000) { if (++L.gv.bad >= 2) { L.gv.bad = 0; setLevel(L.level - 1, 'perf'); } } else L.gv.bad = 0; }
    }));
    offBus.push(C.bus.on('club', guard('club', loyalty)), C.bus.on('club:tier', guard('tier', loyalty)), C.bus.on('reset', guard('reset', loyalty)), C.bus.on('audio', guard('audio', () => L.state && ambience(L.state))));
    document.addEventListener('visibilitychange', L._vis = guard('vis', () => { if (!document.hidden) { last.wx = ''; tick(); } }));
    bindClicks();
  }
  function setLevel(n, why) {
    L.level = n; L.calm = n === 0; L.lite = n <= 1; L.calmWhy = why || '';
    const st = C.scene && C.scene.stage;
    if (st) { st.classList.toggle('lv-calm', L.calm); st.classList.toggle('lv-lite', L.lite); }
    last.wx = ''; last.event = undefined;
    if (L.mounted && L.state) { weatherLayers(L.state); applyEvent(L.state.ev, L.state); ambience(L.state); }
  }
  const setCalm = (v, why) => setLevel(v ? 0 : 2, why);
  L.mount = () => {
    try {
      if (L.mounted || L.failed || !C.scene || !C.scene.ready) return;
      if (window.CORNSTY_LIVING === false || cfg().enabled === false) { L.mode = 'off'; return; }
      L.mode = (C.store.state.prefs.living) || 'auto';
      if (L.mode === 'off') return;
      build(); L.mounted = true; L.level = 2; start(); if (L.mode === 'calm') setLevel(0, 'setting'); fetchWeather();
    } catch (e) { fail('mount', e); }
  };
  L.unmount = () => {
    try {
      clearInterval(timers.tick); clearInterval(timers.sec); clearInterval(timers.weather); clearTimeout(thunderT); clearTimeout(fwT); timers = {};
      offTicker && offTicker(); offTicker = null; offBus.forEach((f) => f && f()); offBus = [];
      if (L._vis) document.removeEventListener('visibilitychange', L._vis);
      const S = C.scene;
      try { U.$$('#deco .flag').forEach((g) => { g.style.display = ''; const p = g.querySelector('path'); if (p && p.dataset.lvo) { p.setAttribute('fill', p.dataset.lvo); delete p.dataset.lvo; } }); } catch (e) { /* ignore */ }
      try { S.gull && S.gull.accessory && S.gull.accessory(''); } catch (e) { /* ignore */ }
      if (els.sky) S.removeLayer(els.sky);
      nodes.forEach((n) => { try { n.remove(); } catch (e) { /* ignore */ } });
      C.audio && C.audio.ambience && C.audio.ambience({});
      if (S.stage) { S.stage.style.background = ''; S.stage.classList.remove('lv-on', 'lv-calm', 'lv-lite', 'lv-duck', 'lv-smooth'); }
      try { const sb = $('#surfboard', S.world); if (sb) sb.style.filter = ''; } catch (e) { /* ignore */ }
      S.layout && S.layout();
    } catch (e) { /* the shop must never be affected */ }
    els = {}; nodes = []; L.mounted = false; L.state = null; L.over = {}; L.level = 2; L.calm = false; L.lite = false; L.calmWhy = ''; Object.keys(last).forEach((k) => delete last[k]);
  };

  /* ------------------------------------------------------------------ public controls */
  // preview: L.set({ time: 'night' | 'dawn' | 'morning' | 'day' | 'golden' | 'sunset' | 'dusk' | 'HH:MM' | 'real', weather: 'clear'|'clouds'|'rain'|'storm'|'snow'|'fog'|'auto', event: 'noel'|'halloween'|...|'none'|'auto' })
  L.set = guard('set', (o) => {
    if (!L.mounted) return;
    Object.assign(L.over, o);
    const st = C.scene.stage; if (!U.reduced()) st.classList.add('lv-smooth'); clearTimeout(L._sm); L._sm = setTimeout(() => st.classList.remove('lv-smooth'), 3400);
    Object.keys(last).forEach((k) => { if (k !== 'sign' && k !== 'stickers' && k !== 'trophy') delete last[k]; });
    render(compute());
  });
  L.setMode = (m) => {
    L.mode = m; C.store.prefs({ living: m });
    if (m === 'off') { L.unmount(); return; }
    if (!L.mounted) { L.failed = false; L.mount(); }
    setLevel(m === 'calm' ? 0 : 2, 'setting');
  };
  L.hello = () => { const st = L.state; if (!st || !st.ev || !st.ev.hello || helloed[st.ev.id] || L.over.event) return null; helloed[st.ev.id] = 1; return st.ev.hello; };
  L.debug = () => ({ mounted: L.mounted, mode: L.mode, level: L.level, calm: L.calm, calmWhy: L.calmWhy, fps: L.gv.avg && +(1000 / L.gv.avg).toFixed(1), over: L.over, phase: L.state && L.state.phase, event: L.state && L.state.ev && L.state.ev.id, weather: L.state && L.state.weather.type, nodes: nodes.length });

  /* optional real weather (only when cfg.living.weather.mode === 'real' or window.CORNSTY_WEATHER is defined) */
  async function fetchWeather() {
    const c = cfg(), wc = c.weather || {};
    const run = guard('weather', async () => {
      if (!L.mounted) return;
      if (typeof window.CORNSTY_WEATHER === 'function') { const w = await window.CORNSTY_WEATHER(); if (w && w.type) L.realWeather = Object.assign({ cloud: 0.5, intensity: 0.6 }, w); }
      else if (wc.mode === 'real' && c.place) {
        const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 6000);
        const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${c.place.lat}&longitude=${c.place.lon}&current=weather_code,wind_speed_10m&timezone=auto`, { signal: ctl.signal }); clearTimeout(t);
        const j = await r.json(); if (j && j.current) L.realWeather = M.fromWmo(j.current.weather_code, j.current.wind_speed_10m);
      }
      last.wx = ''; if (L.mounted) render(compute());
    });
    if (typeof window.CORNSTY_WEATHER !== 'function' && wc.mode !== 'real') return;
    try { await run(); } catch (e) { /* offline: the ambience weather stays */ }
    timers.weather = setInterval(() => { run().catch(() => {}); }, (wc.refreshMin || 30) * 60000);
  }

  /* ------------------------------------------------------------------ settings UI (rendered by the core menu through two guarded calls) */
  const opt = (v, t, cur) => `<option value="${v}"${cur === v ? ' selected' : ''}>${t}</option>`;
  L.menuHtml = () => {
    const c = cfg(); if (c.enabled === false || window.CORNSTY_LIVING === false) return '';
    const o = L.over, mode = L.mounted ? (L.calm ? 'calm' : 'auto') : L.mode === 'off' ? 'off' : 'auto';
    return `<div class="setting"><span><b>Kiosque vivant</b><br><small>Jour et nuit, météo d’ambiance, fêtes de l’année${L.calmWhy === 'perf' ? ' (allégé automatiquement : ton appareil peinait)' : ''}</small></span>
<select data-lv="mode" aria-label="Kiosque vivant">${opt('auto', 'Complet', mode)}${opt('calm', 'Calme', mode)}${opt('off', 'Désactivé', mode)}</select></div>
<details class="lv-prev"${L.mounted ? '' : ' hidden'}><summary>Aperçu de l’ambiance <small>(pour tester)</small></summary>
<div class="setting"><span><b>Heure</b></span><select data-lv="time" aria-label="Heure du kiosque">${opt('real', 'Réelle', o.time || 'real')}${opt('dawn', 'Aube', o.time)}${opt('morning', 'Matin', o.time)}${opt('day', 'Plein jour', o.time)}${opt('golden', 'Fin d’après-midi', o.time)}${opt('sunset', 'Coucher de soleil', o.time)}${opt('dusk', 'Crépuscule', o.time)}${opt('night', 'Nuit', o.time)}</select></div>
<div class="setting"><span><b>Météo</b></span><select data-lv="weather" aria-label="Météo du kiosque">${opt('auto', 'Ambiance du jour', o.weather || 'auto')}${opt('clear', 'Soleil', o.weather)}${opt('clouds', 'Nuageux', o.weather)}${opt('rain', 'Pluie', o.weather)}${opt('storm', 'Orage', o.weather)}${opt('snow', 'Neige', o.weather)}${opt('fog', 'Brouillard', o.weather)}</select></div>
<div class="setting"><span><b>Fête</b></span><select data-lv="event" aria-label="Fête du kiosque">${opt('auto', 'Selon la date', o.event || 'auto')}${opt('none', 'Aucune', o.event)}${(c.events || []).map((e) => opt(e.id, e.label, o.event)).join('')}</select></div></details>`;
  };
  L.bindMenu = (root) => {
    U.$$('[data-lv]', root).forEach((s) => s.addEventListener('change', guard('menu', (e) => {
      const k = s.dataset.lv, v = s.value;
      if (k === 'mode') { L.setMode(v); const d = $('.lv-prev', root); if (d) d.hidden = v === 'off'; C.ui.toast(v === 'off' ? 'Kiosque vivant désactivé' : 'Réglage enregistré'); }
      else L.set({ [k]: v === 'auto' || v === 'real' ? null : v });
    })));
  };
})((window.Cornsty = window.Cornsty || {}));
