/* Cornsty - "Attrape-Pop": catch the popcorn in your pouch, dodge the burnt kernels. 30 seconds. One rewarded game per day (rules in cfg.club.game). */
(function (C) {
  'use strict';
  const U = C.util, D = C.draw, A = C.art, UI = C.ui, K = D.COL;
  const G = (C.game = {});
  const W = 480, H = 640, TIME = 30;

  G.open = () => {
    const m = UI.modal({ name: 'game', title: 'Attrape-Pop', cls: 'game-modal', html: `
<h2>Attrape-Pop</h2>
<div class="game-wrap"><canvas width="${W}" height="${H}" aria-label="Jeu Attrape-Pop : déplace le pochon pour attraper le pop-corn"></canvas>
  <div class="game-over" id="gover"><div class="big">GO ?</div><p>Glisse ton doigt (ou la souris, ou ← →) pour déplacer le pochon.<br>Attrape le pop-corn, les grains dorés valent 3, évite les grains cramés !</p><button class="btn red big" id="gstart">Jouer 30 s</button></div>
</div>
<div class="game-hud"><span id="gscore">Score 0</span><span id="gcombo"></span><span id="gtime">${TIME}s</span></div>
<p class="eyebrow">Record : ${C.store.state.club.game.best}${C.store.state.club.game.last === U.today() ? ' · points du jour déjà gagnés (tu peux rejouer pour le plaisir)' : ' · 15+ = 2 pts, 30+ = 5 pts, 45+ = 10 pts (une fois par jour)'}</p>`, onClose: () => stop() });
    const cv = U.$('canvas', m.el), ctx = cv.getContext('2d'), over = U.$('#gover', m.el);
    let off = null, running = false, keys = {};
    const st = { x: W / 2, tx: W / 2, items: [], t: 0, left: TIME, score: 0, combo: 0, best: 0, spawn: 0, shake: 0, parts: [], flash: 0 };
    // sprites
    const puffs = D.PUFFS.map((cs) => { const c = document.createElement('canvas'); c.width = c.height = 72; const x = c.getContext('2d'), k = 72 / 48; x.translate(36, 36); x.scale(k, k); x.fillStyle = K.ink; cs.forEach(([px, py, r]) => { x.beginPath(); x.arc(px, py, r + 2.6, 0, 6.29); x.fill(); }); x.fillStyle = '#FFF4D6'; cs.forEach(([px, py, r]) => { x.beginPath(); x.arc(px, py, r, 0, 6.29); x.fill(); }); const kk = cs[cs.length - 1]; x.fillStyle = '#F2A93B'; x.beginPath(); x.arc(kk[0] + 1, kk[1] + 5, 3.2, 0, 6.29); x.fill(); return c; });
    const letters = A.wordmark.letters.map((l) => new Path2D(l.d));
    const fl = C.data.byId(C.chat.ctx.last && C.data.byId(C.chat.ctx.last).kind === 'pouch' ? C.chat.ctx.last : 'cheddar');

    const pouch = (x, y) => {
      const w = 96, h = 132, cc = fl.colors;
      ctx.save(); ctx.translate(x - w / 2, y);
      ctx.fillStyle = cc.base; ctx.strokeStyle = K.ink; ctx.lineWidth = 4; ctx.beginPath(); ctx.roundRect(0, 0, w, h, 10); ctx.fill(); ctx.stroke();
      ctx.fillStyle = K.blue; ctx.fillRect(3, 8, w - 6, 8);
      ctx.save(); ctx.beginPath(); ctx.roundRect(3, 3, w - 6, h - 6, 8); ctx.clip();
      ctx.fillStyle = '#F3F3F6'; ctx.fillRect(0, 44, w, 52);
      ctx.restore();
      ctx.save(); ctx.translate(8, 20); const s = (w - 16) / 866; ctx.scale(s, s); ctx.fillStyle = K.cream; ctx.strokeStyle = cc.dark; ctx.lineWidth = 14; ctx.lineJoin = 'round'; letters.forEach((p) => { ctx.stroke(p); ctx.fill(p); }); ctx.restore();
      ctx.fillStyle = cc.badge; ctx.beginPath(); ctx.ellipse(w / 2, 108, 30, 14, 0, 0, 6.29); ctx.fill(); ctx.strokeStyle = K.ink; ctx.lineWidth = 3; ctx.stroke();
      ctx.restore();
    };
    const spawn = () => {
      const r = Math.random(), t = st.t, kind = r < 0.14 + Math.min(0.16, t * 0.005) ? 'burnt' : r > 0.9 ? 'gold' : 'pop';
      st.items.push({ k: kind, x: U.rand(30, W - 30), y: -30, v: 150 + t * 8 + U.rand(0, 70), r: kind === 'pop' ? 20 : 15, rot: U.rand(0, 6), w: U.rand(-4, 4), sp: U.rint(0, 5) });
    };
    const burst = (x, y, col, n = 8) => { for (let i = 0; i < n; i++) st.parts.push({ x, y, vx: U.rand(-160, 160), vy: -U.rand(60, 260), life: U.rand(0.3, 0.7), age: 0, c: col }); };
    const draw = () => {
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, W, H);
      const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#8FA3F0'); g.addColorStop(0.7, '#BFCBF8'); g.addColorStop(1, '#F3EEDF'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = K.cream; ctx.fillRect(0, H - 40, W, 40); ctx.strokeStyle = K.ink; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(0, H - 40); ctx.lineTo(W, H - 40); ctx.stroke();
      if (st.shake > 0) ctx.translate(U.rand(-st.shake, st.shake), U.rand(-st.shake, st.shake));
      for (const it of st.items) {
        ctx.save(); ctx.translate(it.x, it.y); ctx.rotate(it.rot);
        if (it.k === 'burnt') { ctx.fillStyle = '#3a2a22'; ctx.strokeStyle = K.ink; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(0, 0, 15, 12, 0, 0, 6.29); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#7a3a1c'; ctx.beginPath(); ctx.arc(-4, -3, 3, 0, 6.29); ctx.fill(); }
        else if (it.k === 'gold') { ctx.shadowColor = '#FFD65C'; ctx.shadowBlur = 16; ctx.fillStyle = '#FFC93C'; ctx.strokeStyle = K.ink; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(0, 0, 14, 11, 0, 0, 6.29); ctx.fill(); ctx.stroke(); ctx.shadowBlur = 0; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(-4, -4, 3, 0, 6.29); ctx.fill(); }
        else ctx.drawImage(puffs[it.sp], -24, -24, 48, 48);
        ctx.restore();
      }
      for (const p of st.parts) { ctx.globalAlpha = Math.max(0, 1 - p.age / p.life); ctx.fillStyle = p.c; ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, 6.29); ctx.fill(); ctx.globalAlpha = 1; }
      pouch(st.x, H - 132 - 30 + 6);
      if (st.flash > 0) { ctx.fillStyle = `rgba(222,63,57,${st.flash * 0.35})`; ctx.fillRect(0, 0, W, H); }
    };
    const step = (dt) => {
      if (!running) { draw(); return; }
      st.t += dt; st.left = Math.max(0, TIME - st.t); st.spawn -= dt;
      const rate = Math.max(0.26, 0.72 - st.t * 0.016);
      if (st.spawn <= 0) { spawn(); st.spawn = rate * U.rand(0.7, 1.2); }
      if (keys.ArrowLeft || keys.a || keys.q) st.tx -= 520 * dt; if (keys.ArrowRight || keys.d) st.tx += 520 * dt;
      st.tx = U.clamp(st.tx, 48, W - 48); st.x += (st.tx - st.x) * Math.min(1, dt * 18);
      const py = H - 132 - 30 + 6;
      for (let i = st.items.length - 1; i >= 0; i--) {
        const it = st.items[i]; it.y += it.v * dt; it.rot += it.w * dt;
        if (it.y > py + 4 && it.y < py + 40 && Math.abs(it.x - st.x) < 50) {
          if (it.k === 'burnt') { st.score = Math.max(0, st.score - 3); st.combo = 0; st.shake = 8; st.flash = 1; C.audio.thud(1); burst(it.x, it.y, '#3a2a22', 10); }
          else { st.combo++; const mult = 1 + Math.min(2, Math.floor(st.combo / 8)); st.score += (it.k === 'gold' ? 3 : 1) * mult; C.audio.pop(0.8 + Math.random() * 0.3); if (it.k === 'gold') C.audio.coin(); burst(it.x, it.y, it.k === 'gold' ? '#FFD65C' : K.cream, 6); }
          st.items.splice(i, 1);
        } else if (it.y > H - 30) { if (it.k === 'pop' || it.k === 'gold') st.combo = 0; st.items.splice(i, 1); }
      }
      for (let i = st.parts.length - 1; i >= 0; i--) { const p = st.parts[i]; p.age += dt; p.vy += 800 * dt; p.x += p.vx * dt; p.y += p.vy * dt; if (p.age > p.life) st.parts.splice(i, 1); }
      st.shake *= Math.pow(0.02, dt); st.flash = Math.max(0, st.flash - dt * 3);
      U.$('#gscore', m.el).textContent = 'Score ' + st.score; U.$('#gtime', m.el).textContent = Math.ceil(st.left) + 's';
      const mult = 1 + Math.min(2, Math.floor(st.combo / 8)); U.$('#gcombo', m.el).textContent = st.combo > 2 ? `combo ×${st.combo}${mult > 1 ? ' · ×' + mult : ''}` : '';
      if (st.left <= 0) end();
      draw();
    };
    const end = () => {
      running = false; const res = C.store.club.gameResult(st.score);
      over.hidden = false;
      over.innerHTML = `<div class="big">${st.score}</div><p><b>${st.score >= 45 ? 'Légendaire !' : st.score >= 30 ? 'Belle prise.' : st.score >= 15 ? 'Pas mal du tout.' : 'Le pop-corn t’a échappé.'}</b><br>${res.pts ? `+${res.pts} points Club !` : res.already ? 'Points du jour déjà gagnés.' : 'Il fallait 15 pour gagner des points.'}</p><button class="btn red big" id="gagain">Rejouer</button>`;
      if (res.pts) { C.audio.chime(); C.fx.confetti({ count: 70 }); }
      U.$('#gagain', over).addEventListener('click', start);
    };
    const start = () => { Object.assign(st, { items: [], parts: [], t: 0, left: TIME, score: 0, combo: 0, spawn: 0.3, shake: 0, flash: 0 }); over.hidden = true; running = true; C.audio.unlock(); C.audio.click(); };
    const stop = () => { running = false; off && off(); window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); };
    const kd = (e) => { keys[e.key] = true; if (/^Arrow/.test(e.key)) e.preventDefault(); }, ku = (e) => { keys[e.key] = false; };
    window.addEventListener('keydown', kd); window.addEventListener('keyup', ku);
    const move = (e) => { const r = cv.getBoundingClientRect(); st.tx = ((e.clientX - r.left) / r.width) * W; };
    cv.addEventListener('pointermove', move); cv.addEventListener('pointerdown', move);
    U.$('#gstart', m.el).addEventListener('click', start);
    off = U.ticker.add(step);
    return m;
  };
})((window.Cornsty = window.Cornsty || {}));
