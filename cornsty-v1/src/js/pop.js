/* Cornsty - THE SHOW: the seagull makes your popcorn and packs it.
   Canvas 2D particle physics (kernels, popping puffs bouncing in the glass cabinet with a real heap, scoop -> pouch stream, seasoning dust, steam)
   + the choreography (pour, lever, heat, pop, door, scoops, season, seal, toss into the basket). Fully skippable / speed-scaled. */
(function (C) {
  'use strict';
  const U = C.util, D = C.draw, SE = C.sceneArt, K = D.COL, A = SE.anchors;
  const P = (C.pop = { running: false, parts: [], settled: [], heat: 0 });
  const BOX = { x0: 662, x1: 918, top: 506, floor: 852 };
  const COLS = 32, CW = (BOX.x1 - BOX.x0) / COLS, GRAV = 1750, R = 16;
  const pile = new Float32Array(COLS);
  let ctx, cv, u = 1, dpr = 1, sprites = [], ready = false, popRect = { x: 560, y: 380, w: 640, h: 520 };

  /* ------------------------------------------------------------ sprites (drawn once from the same puff definitions as the SVG symbols) */
  function makeSprites() {
    sprites = D.PUFFS.map((cs) => {
      const c = document.createElement('canvas'), S = 96; c.width = c.height = S; const x = c.getContext('2d'), k = S / 48;
      x.translate(S / 2, S / 2); x.scale(k, k);
      x.fillStyle = K.ink; cs.forEach(([px, py, r]) => { x.beginPath(); x.arc(px, py, r + 2.6, 0, 6.29); x.fill(); });
      x.fillStyle = '#FFF4D6'; cs.forEach(([px, py, r]) => { x.beginPath(); x.arc(px, py, r, 0, 6.29); x.fill(); });
      const kk = cs[cs.length - 1]; x.fillStyle = 'rgba(246,212,138,.75)'; x.beginPath(); x.arc(kk[0] - 2, kk[1] + 3, kk[2] * 0.55, 0, 6.29); x.fill();
      x.fillStyle = '#F2A93B'; x.beginPath(); x.arc(kk[0] + 1, kk[1] + 5, 3.2, 0, 6.29); x.fill();
      return c;
    });
  }
  P.init = () => {
    cv = C.scene.canvas; ctx = cv.getContext('2d'); makeSprites();
    const onLayout = () => { u = C.scene.u; dpr = C.scene.dpr || 1; popRect = C.scene.popRect; P._dirty = true; };
    C.bus.on('layout', onLayout); onLayout();
    U.ticker.add((dt) => P.tick(dt));
    ready = true;
    P.resetPile(0.62);
    return P;
  };

  /* ------------------------------------------------------------ heap of popcorn resting in the cabinet */
  const H = (x) => { const f = (x - BOX.x0) / CW - 0.5, i = Math.floor(f), t = f - i, a = pile[U.clamp(i, 0, COLS - 1)], b = pile[U.clamp(i + 1, 0, COLS - 1)]; return a + (b - a) * t; };
  const relax = () => { for (let k = 0; k < 3; k++) for (let i = 0; i < COLS - 1; i++) { const d = pile[i] - pile[i + 1], slope = 6; if (d > slope) { const m = (d - slope) / 2; pile[i] -= m; pile[i + 1] += m; } else if (-d > slope) { const m = (-d - slope) / 2; pile[i] += m; pile[i + 1] -= m; } } };
  function deposit(x, v, rot) {
    P._dirty = true;
    const h = H(x), y = BOX.floor - h - 11;
    P.settled.push({ x, y, v, rot, s: 0.95 + Math.random() * 0.25 });
    const c = Math.floor((x - BOX.x0) / CW);
    for (let d = -2; d <= 2; d++) { const i = c + d; if (i >= 0 && i < COLS) pile[i] = Math.max(pile[i], h + 6.2 * (1 - Math.abs(d) * 0.28)); }
    relax();
    if (P.settled.length > 260) P.settled.shift();
  }
  P.resetPile = (level = 0.6) => {
    P._dirty = true;
    pile.fill(0); P.settled.length = 0;
    const n = Math.round(150 * level);
    for (let i = 0; i < n; i++) deposit(BOX.x0 + R + Math.random() * (BOX.x1 - BOX.x0 - 2 * R), Math.floor(Math.random() * 6), Math.random() * 6.28);
    P.settled.sort((a, b) => a.y - b.y).reverse();
  };
  P.pileLevel = () => P.settled.length / 150;
  P.take = (n) => { // scoop away the top of the heap
    P._dirty = true;
    const top = P.settled.map((s, i) => [s.y, i]).sort((a, b) => a[0] - b[0]).slice(0, n).map((z) => z[1]).sort((a, b) => b - a);
    top.forEach((i) => { const s = P.settled[i], c = Math.floor((s.x - BOX.x0) / CW); for (let d = -2; d <= 2; d++) { const k = c + d; if (k >= 0 && k < COLS) pile[k] = Math.max(0, pile[k] - 5); } P.settled.splice(i, 1); });
  };

  /* ------------------------------------------------------------ particles */
  const add = (p) => { P.parts.push(p); return p; };
  P.popOne = (x = A.machine.kettle.x, y = A.machine.kettle.y - 14) => add({ t: 'pop', x: x + U.rand(-30, 30), y, vx: U.rand(-250, 250), vy: -U.rand(230, 520), rot: U.rand(0, 6.28), w: U.rand(-9, 9), v: U.rint(0, 5), age: 0, life: 9, s: 0.4 });
  P.kernel = (x, y, vx = 0, vy = 0) => add({ t: 'kernel', x, y, vx, vy, age: 0, life: 3, rot: U.rand(0, 6) });
  P.scoopDrop = (x, y, vx, vy, onLand) => add({ t: 'drop', x, y, vx, vy, rot: U.rand(0, 6.28), w: U.rand(-6, 6), v: U.rint(0, 5), age: 0, life: 4, onLand, s: 0.85 });
  P.dust = (x, y, color, n = 24, spread = 40) => { for (let i = 0; i < n; i++) add({ t: 'dust', x: x + U.rand(-spread, spread), y: y + U.rand(-6, 6), vx: U.rand(-30, 30), vy: U.rand(60, 240), r: U.rand(2.4, 5.2), color, age: 0, life: U.rand(0.5, 1.1) }); };
  P.steam = (x, y, n = 6, big = 1) => { for (let i = 0; i < n; i++) add({ t: 'steam', x: x + U.rand(-16, 16), y, vx: U.rand(-16, 16), vy: -U.rand(50, 110), r: U.rand(8, 16) * big, age: -i * 0.06, life: U.rand(0.9, 1.5) }); };

  P.tick = (dt) => {
    if (!ready) return;
    const g = GRAV;
    for (let i = P.parts.length - 1; i >= 0; i--) {
      const p = P.parts[i]; p.age += dt; if (p.age < 0) continue;
      if (p.age > p.life) { P.parts.splice(i, 1); continue; }
      if (p.t === 'pop') {
        p.s = Math.min(1, p.s + dt * 9); p.vy += g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.w * dt;
        if (p.x < BOX.x0 + R) { p.x = BOX.x0 + R; p.vx = Math.abs(p.vx) * 0.55; }
        if (p.x > BOX.x1 - R) { p.x = BOX.x1 - R; p.vx = -Math.abs(p.vx) * 0.55; }
        if (p.y < BOX.top + R) { p.y = BOX.top + R; p.vy = Math.abs(p.vy) * 0.4; }
        const fy = BOX.floor - H(p.x) - R * 0.62;
        if (p.y > fy && p.vy > 0) {
          if (Math.abs(p.vy) > 190) { p.y = fy; p.vy = -p.vy * 0.36; p.vx *= 0.8; p.w *= 0.7; }
          else { deposit(p.x, p.v, p.rot); P.parts.splice(i, 1); }
        }
      } else if (p.t === 'kernel') { p.vy += g * dt * 0.8; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += 8 * dt; }
      else if (p.t === 'drop') { p.vy += g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.w * dt; if (p.y > A.machine.pouch.y - 40 || p.age > p.life) { p.onLand && p.onLand(p); P.parts.splice(i, 1); } }
      else if (p.t === 'dust') { p.vy += 180 * dt; p.x += p.vx * dt; p.y += p.vy * dt; }
      else if (p.t === 'steam') { p.x += p.vx * dt; p.y += p.vy * dt; p.r += dt * 14; }
    }
    // heat: kettle glow, lamp, gentle vibration (only touched while the machine is on, to keep the idle scene cheap)
    if (P.heat > 0 || P._lastHeat > 0) {
      const glow = document.getElementById('m-glow'), lamp = document.getElementById('m-lamp'), mach = document.getElementById('machine'), ket = document.getElementById('m-kettle');
      if (glow) { glow.setAttribute('opacity', (0.5 + 0.5 * P.heat * (0.85 + Math.random() * 0.15)).toFixed(2)); lamp.setAttribute('r', (P.heat * 15).toFixed(1)); }
      if (mach && P.heat > 0.05) { const v = P.heat * 1.4; mach.setAttribute('transform', `translate(${((Math.random() - 0.5) * v).toFixed(2)} ${((Math.random() - 0.5) * v * 0.6).toFixed(2)})`); ket.setAttribute('transform', `translate(${((Math.random() - 0.5) * v * 2).toFixed(2)} 0)`); }
      else if (mach) { mach.removeAttribute('transform'); ket.removeAttribute('transform'); }
    }
    P._lastHeat = P.heat;
    if (P.parts.length || P._dirty) { P.draw(); P._dirty = P.parts.length > 0; }
  };
  P.draw = () => {
    if (!ctx) return;
    const s = u * dpr;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.setTransform(s, 0, 0, s, -popRect.x * s, -popRect.y * s);
    const spr = (v, x, y, rot, k) => { const S = 46 * k; ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.drawImage(sprites[v], -S / 2, -S / 2, S, S); ctx.restore(); };
    for (const p of P.settled) spr(p.v, p.x, p.y, p.rot, p.s);
    for (const p of P.parts) {
      if (p.age < 0) continue;
      if (p.t === 'pop' || p.t === 'drop') spr(p.v, p.x, p.y, p.rot, p.s || 1);
      else if (p.t === 'kernel') { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillStyle = '#E8A526'; ctx.strokeStyle = K.ink; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.ellipse(0, 0, 4.4, 3.2, 0, 0, 6.29); ctx.fill(); ctx.stroke(); ctx.restore(); }
      else if (p.t === 'dust') { ctx.globalAlpha = Math.max(0, 1 - p.age / p.life); ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.29); ctx.fill(); ctx.globalAlpha = 1; }
      else if (p.t === 'steam') { ctx.globalAlpha = Math.max(0, 0.55 * (1 - p.age / p.life)); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.29); ctx.fill(); ctx.globalAlpha = 1; }
    }
  };

  /* ------------------------------------------------------------ props (SVG in the scene) */
  const NS = 'http://www.w3.org/2000/svg';
  const scoopNode = () => {
    const g = U.svg('g', { class: 'scoop' });
    g.innerHTML = `<path d="M-30 0H52" stroke="${K.ink}" stroke-width="15" stroke-linecap="round"/><path d="M-30 0H52" stroke="${K.red}" stroke-width="7" stroke-linecap="round"/>
      <path d="M46 -26Q92 -26 96 0Q92 26 46 26Z" fill="#C9CEDA" stroke="${K.ink}" stroke-width="5" stroke-linejoin="round"/>
      <g class="scoop-corn" opacity="0"><use href="#pf1" x="52" y="-38" width="30" height="30"/><use href="#pf3" x="70" y="-34" width="30" height="30"/><use href="#pf0" x="60" y="-44" width="30" height="30"/></g>`;
    return g;
  };
  const cupNode = () => { const g = U.svg('g', { class: 'cup' }); g.innerHTML = `<path d="M0 -20H46L40 24H6Z" fill="${K.cream}" stroke="${K.ink}" stroke-width="5" stroke-linejoin="round"/><path d="M6 -6H40" stroke="${K.red}" stroke-width="6"/><ellipse cx="23" cy="-20" rx="23" ry="6" fill="#E8A526" stroke="${K.ink}" stroke-width="4"/>`; return g; };
  const shakerNode = (color) => { const g = U.svg('g', { class: 'shaker' }); g.innerHTML = `<rect x="0" y="-22" width="40" height="46" rx="10" fill="${K.cream}" stroke="${K.ink}" stroke-width="5"/><rect x="-2" y="-34" width="44" height="16" rx="6" fill="${color}" stroke="${K.ink}" stroke-width="5"/><circle cx="12" cy="-26" r="2" fill="${K.ink}"/><circle cx="24" cy="-26" r="2" fill="${K.ink}"/><circle cx="18" cy="-31" r="2" fill="${K.ink}"/>`; return g; };
  const pouchProp = (fl, level) => {
    const g = U.svg('g', { class: 'pouch-prop' }), w = A.machine.pouch.w, h = w * 798 / 488;
    g.innerHTML = D.pouch(fl, { level, flat: false }).replace(/^<svg /, `<svg x="${-w / 2}" y="${-h}" width="${w}" height="${h}" overflow="visible" `);
    g._h = h; g._w = w; return g;
  };
  const setPouch = (g, x, y, s = 1, rot = 0, sx = 1) => g.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${rot.toFixed(1)}) scale(${(s * sx).toFixed(3)} ${s.toFixed(3)})`);
  const setLevel = (g, level) => { const n = g.querySelector('.pc-level'); if (n) n.setAttribute('transform', `translate(0 ${((1 - level) * 420).toFixed(1)})`); };
  const seal = (g) => { // crimped heat-seal band across the top of the pouch
    const s = g.querySelector('svg'); if (!s) return; const band = document.createElementNS(NS, 'g');
    band.innerHTML = `<rect x="0" y="0" width="488" height="30" fill="#000" opacity=".14"/>` + Array.from({ length: 30 }, (_, i) => `<path d="M${8 + i * 16} 4V26" stroke="#fff" stroke-opacity=".6" stroke-width="3"/>`).join('');
    band.setAttribute('transform', 'translate(0 2)'); s.append(band);
  };

  /* ------------------------------------------------------------ the show */
  const wait = (r, ms) => r.wait(ms);
  P.skip = () => { U.speed = 4.5; };
  P.busy = () => P.running;

  /* items: [{id, qty}] flavours to make; onDelivered(id) called each time a pouch lands in the basket (cart add) */
  P.show = (items, o = {}) => {
    const job = P.queue = (P.queue || Promise.resolve()).then(() => run(items, o)).catch((e) => { if (!U.isCancel(e)) console.error(e); });
    return job;
  };

  async function run(items, o) {
    const S = C.scene, g = S.gull, ui = C.ui, run = new U.Run();
    P.running = true; P.run = run;
    const fast = !!o.fast; const baseSpeed = fast ? 2.4 : 1; U.speed = baseSpeed;
    ui.els.skip.hidden = false; const offSkip = C.bus.on('ui:skipshow', () => P.skip());
    const props = document.getElementById('props');
    let pouch = null, aborted = false;
    const total = items.reduce((n, it) => n + it.qty, 0); let done = 0;
    try {
      // --- 0. go to the machine
      C.bus.emit('show:start', { items });
      g.act('idle'); S.goto('machine', { dur: 850 / U.speed }); ui.tab('machine');
      g.face(-1); await S.gullTo('machine', { dur: 900 });
      g.st.idle = false;
      const kettle = A.machine.kettle, funnel = A.machine.funnel, door = A.machine.door, lever = A.machine.lever, pz = A.machine.pouch;
      const cup = cupNode(), scoop = scoopNode();
      let first = true;
      for (const it of items) {
        const fl = C.data.byId(it.id); if (!fl) continue;
        for (let n = 0; n < it.qty; n++) {
          done++;
          if (first || P.pileLevel() < 0.3) {
            // --- 1. pour the kernels into the funnel
            g.hold(cup, 150, -6, -40); g.reach({ x: funnel.x + 6, y: funnel.y - 40 }, 30); await wait(run, 480);
            g.st.hold = true; C.audio.whoosh(0.3, true, 0.5);
            g.S.wA.t += 24; await wait(run, 220);                                      // tilt the cup
            for (let i = 0; i < 12; i++) { P.kernel(funnel.x + U.rand(-10, 10), funnel.y - 20, U.rand(-30, 10), U.rand(0, 60)); C.audio.kernelTick(0.6); await wait(run, 40); }
            await wait(run, 220); g.hold(null);
            // --- 2. pull the lever, heat up
            g.face(-1); g.reach({ x: lever.x, y: lever.y - 76 }, 0); await wait(run, 380);
            const arm = document.getElementById('m-lever-arm');
            await run.tween(300, (k) => { arm.setAttribute('transform', `rotate(${(k * -34).toFixed(1)})`); g.S.wA.t = g.S.wA.t; }, U.ease.outQuad);
            C.audio.thud(0.8); S.bump(6);
            const stopHeat = C.audio.heat(2.2 / U.speed);
            const pops = 34 + Math.round(P.settled.length < 100 ? 30 : 8); const T = 2300;
            const times = Array.from({ length: pops }, () => { const r = Math.random(); return T * (3 * r * r - 2 * r * r * r); }).sort((a, b) => a - b);
            g.reach({ x: lever.x - 30, y: lever.y - 30 }, 0);
            const t0 = performance.now(); let idx = 0, lastPop = 0;
            // ramp heat while popping
            await run.tween(T + 300, (k, kk) => {
              P.heat = Math.min(1, kk * 2.4) * (kk > 0.94 ? (1 - kk) / 0.06 : 1);
              const now = kk * (T + 300);
              while (idx < pops && times[idx] <= now) { P.popOne(); idx++; if (performance.now() - lastPop > 22) { C.audio.pop(0.5 + Math.random() * 0.6); lastPop = performance.now(); } }
              if (Math.random() < 0.1) P.steam(kettle.x, kettle.y - 30, 1);
            }, U.ease.linear);
            P.heat = 0; stopHeat && stopHeat();
            await run.tween(240, (k) => arm.setAttribute('transform', `rotate(${-34 * (1 - k)})`), U.ease.outQuad);
            g.lowerWing();
            await wait(run, 450);
          }
          first = false;
          // --- 3. the empty pouch appears on the counter
          pouch = pouchProp(fl, 0); props.append(pouch); setPouch(pouch, pz.x, pz.y - 140, 1, -6);
          C.audio.plop(); await run.tween(300, (k) => setPouch(pouch, pz.x, U.lerp(pz.y - 140, pz.y, k), 1, U.lerp(-6, 0, k), 1 + Math.sin(k * Math.PI) * -0.06), U.ease.outBack);
          // --- 4. open the door, scoop x3 into the pouch
          g.reach({ x: door.x + 6, y: door.y - 4 }, 0); await wait(run, 340);
          const dr = document.getElementById('m-door'); dr.style.transition = 'transform .3s'; dr.style.transform = 'scaleX(.18)'; C.audio.click();
          await wait(run, 260);
          for (let s = 0; s < 3; s++) {
            g.hold(scoop, 128, 0, 0); scoop.querySelector('.scoop-corn').setAttribute('opacity', 0);
            g.reach({ x: door.x - 10, y: door.y + 6 }, 78); await wait(run, 300);
            scoop.querySelector('.scoop-corn').setAttribute('opacity', 1); P.take(14); C.audio.whoosh(0.2, false, 0.5);
            g.reach({ x: pz.x + 20, y: pz.y - 230 }, 78); await wait(run, 420);
            g.S.wA.t += 42; await wait(run, 140);                                   // tip the scoop
            C.audio.pourLoop(0.5, 0.8); scoop.querySelector('.scoop-corn').setAttribute('opacity', 0);
            const mouth = { x: pz.x + 4, y: pz.y - 214 };
            for (let i = 0; i < 12; i++) { P.scoopDrop(mouth.x + U.rand(-26, 26), mouth.y + U.rand(-10, 4), U.rand(-40, 40), U.rand(30, 130), null); await wait(run, 34); }
            const from = s / 3, to = (s + 1) / 3; await run.tween(340, (k) => setLevel(pouch, U.lerp(from, to, k)), U.ease.outQuad);
            await wait(run, 120);
          }
          dr.style.transform = ''; g.hold(null);
          // --- 5. seasoning
          const dust = fl.dust || '#FFB428';
          g.hold(shakerNode(fl.colors ? fl.colors.base : dust), 150, 0, 90); g.reach({ x: pz.x + 30, y: pz.y - 250 }, 30); await wait(run, 340);
          for (let i = 0; i < 4; i++) { g.S.wA.t += i % 2 ? -14 : 14; P.dust(pz.x + 10, pz.y - 226, dust, 9, 26); C.audio.kernelTick(0.8); await wait(run, 110); }
          await wait(run, 160); g.hold(null);
          // --- 6. seal
          g.reach({ x: pz.x + 4, y: pz.y - 206 }, 0); await wait(run, 300);
          C.audio.seal(); seal(pouch); P.steam(pz.x, pz.y - 214, 7, 0.9);
          await run.tween(280, (k) => setPouch(pouch, pz.x, pz.y, 1, 0, 1 - Math.sin(k * Math.PI) * 0.06), U.ease.linear);
          await wait(run, 260);
          // --- 7. toss into the basket
          const b = A.basket, tx = b.x, ty = b.y - 30, sx = pz.x, sy = pz.y;
          g.reach({ x: pz.x + 60, y: pz.y - 120 }, 0); g.S.wA.t = -8; S.goto('counter', { dur: 1000 }); ui.tab('counter'); C.audio.whoosh(0.4, true, 0.7);
          await run.tween(880 / 1, (k) => {
            const x = U.lerp(sx, tx, k), y = U.lerp(sy, ty, k) - Math.sin(k * Math.PI) * 300;
            setPouch(pouch, x, y, U.lerp(1, 0.55, k), k * 380 * (fl.id.length % 2 ? 1 : -1) * 0.5, 1);
          }, U.ease.inOutSine);
          C.audio.plop(); S.bump(4);
          o.onDelivered && o.onDelivered(it, n);
          setPouch(pouch, tx, ty, 0.55, 12); await wait(run, 60); pouch.remove(); pouch = null;
          g.lowerWing(); g.face(1);
          if (n < it.qty - 1 || items.indexOf(it) < items.length - 1) { await S.gullTo('machine', { dur: 700 }); g.face(-1); await S.goto('machine', { dur: 700 }); }
        }
      }
      // --- 8. back to the counter
      await S.gullTo('counter', { dur: 800 }); g.face(1); g.st.idle = true;
      await S.goto('counter', { dur: 700 });
    } catch (e) { aborted = true; if (!U.isCancel(e)) console.error(e); }
    finally {
      P.heat = 0; U.speed = 1; ui.els.skip.hidden = true; offSkip(); P.running = false; P.run = null;
      if (pouch) pouch.remove();
      try { g.hold(null); g.lowerWing(); g.st.idle = true; } catch (e) { /* ignore */ }
    }
    return !aborted;
  }
})((window.Cornsty = window.Cornsty || {}));
