/* Cornsty - screen effects: popcorn/quatrefoil confetti (full-screen canvas), flying badges, floating "+N" text. */
(function (C) {
  'use strict';
  const U = C.util, D = C.draw, K = D.COL;
  const FX = (C.fx = {});
  let cv, ctx, W = 0, H = 0, dpr = 1, items = [], off = null, quatPath = null, puffs = null;

  const ensure = () => {
    if (cv) return;
    cv = U.el('canvas', { id: 'fx-canvas', 'aria-hidden': 'true', style: { position: 'fixed', inset: '0', pointerEvents: 'none', zIndex: 90 } });
    document.body.append(cv); ctx = cv.getContext('2d'); size(); window.addEventListener('resize', size);
    quatPath = new Path2D(C.art.quat.d);
    puffs = D.PUFFS.map((cs) => { const c = document.createElement('canvas'); c.width = c.height = 72; const x = c.getContext('2d'), k = 72 / 48; x.translate(36, 36); x.scale(k, k); x.fillStyle = K.ink; cs.forEach(([px, py, r]) => { x.beginPath(); x.arc(px, py, r + 2.6, 0, 6.29); x.fill(); }); x.fillStyle = '#FFF4D6'; cs.forEach(([px, py, r]) => { x.beginPath(); x.arc(px, py, r, 0, 6.29); x.fill(); }); const kk = cs[cs.length - 1]; x.fillStyle = '#F2A93B'; x.beginPath(); x.arc(kk[0] + 1, kk[1] + 5, 3.2, 0, 6.29); x.fill(); return c; });
  };
  const size = () => { dpr = Math.min(2, window.devicePixelRatio || 1); W = innerWidth; H = innerHeight; cv.width = W * dpr; cv.height = H * dpr; };
  const step = (dt) => {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
    for (let i = items.length - 1; i >= 0; i--) {
      const p = items[i]; p.age += dt; if (p.age > p.life || p.y > H + 60) { items.splice(i, 1); continue; }
      p.vy += p.g * dt; p.vx *= 1 - p.drag * dt; p.vy *= 1 - p.drag * dt * 0.4; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.w * dt;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.globalAlpha = p.age > p.life - 0.5 ? Math.max(0, (p.life - p.age) / 0.5) : 1;
      const s = p.s;
      if (p.k === 'puff') ctx.drawImage(puffs[p.v], -s / 2, -s / 2, s, s);
      else if (p.k === 'quat') { ctx.scale(s / 301, s / 301); ctx.translate(-150, -150); ctx.fillStyle = p.c; ctx.fill(quatPath); ctx.lineWidth = 14; ctx.strokeStyle = K.ink; ctx.stroke(quatPath); }
      else if (p.k === 'rect') { ctx.fillStyle = p.c; ctx.fillRect(-s / 2, -s / 4, s, s / 2); }
      else if (p.k === 'star') { ctx.fillStyle = p.c; ctx.beginPath(); for (let j = 0; j < 10; j++) { const a = (j * Math.PI) / 5, r = j % 2 ? s * 0.22 : s * 0.5; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.closePath(); ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = K.ink; ctx.stroke(); }
      ctx.restore();
    }
    if (!items.length) { off && off(); off = null; ctx.clearRect(0, 0, W, H); }
  };
  /* burst of confetti from a point (screen px) */
  FX.confetti = (o = {}) => {
    if (U.reduced()) return;
    ensure();
    const x = o.x == null ? W / 2 : o.x, y = o.y == null ? H * 0.55 : o.y, n = o.count || 90, spread = o.spread || 1, power = o.power || 1;
    const cols = [K.red, K.blue, K.cream, K.yellow, K.pink, K.teal, '#3E52CF'];
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.15 * spread, v = (380 + Math.random() * 620) * power, r = Math.random();
      items.push({ k: r < 0.34 ? 'puff' : r < 0.5 ? 'quat' : r < 0.62 ? 'star' : 'rect', v: U.rint(0, 5), c: U.pick(cols), x: x + U.rand(-16, 16), y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 980, drag: 0.9, rot: U.rand(0, 6.28), w: U.rand(-9, 9), s: r < 0.34 ? U.rand(30, 48) : r < 0.5 ? U.rand(20, 32) : U.rand(10, 18), age: 0, life: U.rand(2.6, 4.2) });
    }
    if (!off) off = U.ticker.add(step);
  };
  FX.rain = (ms = 1800, per = 3) => { const t0 = performance.now(); const tick = () => { if (performance.now() - t0 > ms) return; FX.confetti({ x: Math.random() * innerWidth, y: -20, count: per, spread: 0.2, power: 0.25 }); setTimeout(tick, 60); }; tick(); };

  /* a small html token flies from one element/point to another and lands with a bump */
  FX.fly = (html, from, to, o = {}) => new Promise((res) => {
    const el = U.el('div', { class: 'flyer', style: { position: 'fixed', left: 0, top: 0, zIndex: 95, pointerEvents: 'none', width: (o.size || 46) + 'px', height: (o.size || 46) + 'px' } });
    el.innerHTML = html; document.body.append(el);
    const p = (t) => (t.getBoundingClientRect ? (() => { const r = t.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })() : t);
    const a = p(from), b = p(to), s = o.size || 46;
    if (!el.animate || U.reduced()) { el.remove(); return res(); }
    const mid = { x: (a.x + b.x) / 2, y: Math.min(a.y, b.y) - 90 };
    el.animate([{ transform: `translate(${a.x - s / 2}px,${a.y - s / 2}px) scale(.4)`, opacity: 0 }, { transform: `translate(${mid.x - s / 2}px,${mid.y - s / 2}px) scale(1.15) rotate(-12deg)`, opacity: 1, offset: 0.45 }, { transform: `translate(${b.x - s / 2}px,${b.y - s / 2}px) scale(.6) rotate(8deg)`, opacity: 1 }], { duration: o.dur || 900, easing: 'cubic-bezier(.3,.7,.3,1)' }).onfinish = () => { el.remove(); res(); };
  });
  FX.bump = (el) => { if (!el) return; el.classList.remove('bumped'); void el.offsetWidth; el.classList.add('bumped'); };
  FX.floatText = (text, x, y, color) => {
    const el = U.el('div', { class: 'floattext', style: { position: 'fixed', left: x + 'px', top: y + 'px', zIndex: 95, pointerEvents: 'none', font: "400 34px 'League Gothic',Impact,sans-serif", letterSpacing: '.03em', color: color || K.cream, WebkitTextStroke: '1.5px ' + K.ink, textShadow: '0 3px 0 ' + K.ink, transform: 'translate(-50%,-50%)' } }, text);
    document.body.append(el);
    if (!el.animate || U.reduced()) { setTimeout(() => el.remove(), 900); return; }
    el.animate([{ transform: 'translate(-50%,-30%) scale(.6)', opacity: 0 }, { transform: 'translate(-50%,-90%) scale(1.15)', opacity: 1, offset: 0.25 }, { transform: 'translate(-50%,-190%) scale(1)', opacity: 0 }], { duration: 1300, easing: 'ease-out' }).onfinish = () => el.remove();
  };
})((window.Cornsty = window.Cornsty || {}));
