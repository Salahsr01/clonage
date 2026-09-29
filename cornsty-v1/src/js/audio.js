/* Cornsty - procedural sound (WebAudio). No audio files: every sound is synthesised, so the site stays tiny.
   Sound is OFF until the visitor opts in (autoplay rules + politeness). */
(function (C) {
  'use strict';
  const U = C.util;
  let ctx = null, master = null, noise = null, brown = null, on = false, seaNode = null;

  const A = (C.audio = {
    get on() { return on; },
    get ctx() { return ctx; },
    init() {
      if (ctx) return ctx;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      try { ctx = new AC(); } catch (e) { return null; }
      master = ctx.createGain(); master.gain.value = on ? 0.9 : 0;
      const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
      master.connect(comp); comp.connect(ctx.destination);
      const len = ctx.sampleRate * 2;
      noise = ctx.createBuffer(1, len, ctx.sampleRate); const nd = noise.getChannelData(0);
      for (let i = 0; i < len; i++) nd[i] = Math.random() * 2 - 1;
      brown = ctx.createBuffer(1, len, ctx.sampleRate); const bd = brown.getChannelData(0); let last = 0;
      for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; bd[i] = last * 3.5; }
      return ctx;
    },
    enable(v) {
      on = !!v;
      if (v) { A.init(); if (ctx && ctx.state === 'suspended') ctx.resume(); }
      if (master) master.gain.setTargetAtTime(on ? 0.9 : 0, ctx.currentTime, 0.03);
      if (on) A.sea(C.prefs.sea !== false); else A.sea(false);
      C.bus.emit('audio', on);
    },
    unlock() { if (ctx && ctx.state === 'suspended') ctx.resume(); },
  });

  const ok = () => on && ctx && ctx.state !== 'closed';
  const now = () => ctx.currentTime;
  const env = (g, t, peak, a, d) => { g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); };
  const nsrc = (buf, t, dur, off) => { const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; s.start(t, off === undefined ? Math.random() * 1.5 : off); s.stop(t + dur + 0.05); return s; };
  const osc = (type, f, t, dur) => { const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t); o.start(t); o.stop(t + dur + 0.05); return o; };
  const chain = (...n) => { for (let i = 0; i < n.length - 1; i++) n[i].connect(n[i + 1]); return n[n.length - 1]; };
  const biq = (type, f, q) => { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; if (q) b.Q.value = q; return b; };
  const gain = (v = 1) => { const g = ctx.createGain(); g.gain.value = v; return g; };

  Object.assign(A, {
    /* a kernel goes pop */
    pop(v = 1) {
      if (!ok()) return; const t = now();
      const g = gain(0), bp = biq('bandpass', 1100 + Math.random() * 2400, 0.9);
      chain(nsrc(noise, t, 0.09), bp, g, master); env(g, t, 0.34 * v, 0.002, 0.045 + Math.random() * 0.03);
      const o = osc('sine', 240 + Math.random() * 80, t, 0.1), g2 = gain(0);
      o.frequency.exponentialRampToValueAtTime(95, t + 0.07); chain(o, g2, master); env(g2, t, 0.22 * v, 0.002, 0.06);
    },
    kernelTick(v = 1) {
      if (!ok()) return; const t = now(); const g = gain(0);
      chain(nsrc(noise, t, 0.03), biq('highpass', 3500 + Math.random() * 2500), g, master); env(g, t, 0.07 * v, 0.001, 0.014);
    },
    /* register: mechanical clack + bell */
    ka() {
      if (!ok()) return; const t = now(); const g = gain(0);
      chain(nsrc(noise, t, 0.05), biq('highpass', 1800), g, master); env(g, t, 0.3, 0.001, 0.03);
      const o = osc('square', 150, t, 0.06), g2 = gain(0); chain(o, biq('lowpass', 500), g2, master); env(g2, t, 0.18, 0.002, 0.05);
    },
    ding() {
      if (!ok()) return; const t = now() + 0.02;
      [[2093, 0.2, 1.3], [3136, 0.1, 0.9], [4186, 0.05, 0.6], [1046, 0.08, 1.5]].forEach(([f, p, d]) => { const o = osc('sine', f, t, d), g = gain(0); chain(o, g, master); env(g, t, p, 0.002, d); });
    },
    chaching() { A.ka(); setTimeout(A.ding, 70 / U.speed); },
    drawer() {
      if (!ok()) return; const t = now(); A.whoosh(0.16, true, 0.5);
      const o = osc('sine', 130, t + 0.05, 0.2), g = gain(0); o.frequency.exponentialRampToValueAtTime(55, t + 0.2); chain(o, g, master); env(g, t + 0.05, 0.4, 0.004, 0.14);
    },
    stamp() {
      if (!ok()) return; const t = now();
      const o = osc('sine', 150, t, 0.2), g = gain(0); o.frequency.exponentialRampToValueAtTime(42, t + 0.14); chain(o, g, master); env(g, t, 0.7, 0.003, 0.16);
      const g2 = gain(0); chain(nsrc(noise, t, 0.08), biq('lowpass', 1100), g2, master); env(g2, t, 0.35, 0.001, 0.05);
    },
    seal() {
      if (!ok()) return; const t = now();
      const o = osc('sawtooth', 104, t, 0.32), g = gain(0); o.frequency.linearRampToValueAtTime(88, t + 0.3); chain(o, biq('lowpass', 700), g, master); env(g, t, 0.16, 0.02, 0.28);
      const g2 = gain(0); chain(nsrc(noise, t, 0.4), biq('highpass', 3200), g2, master); env(g2, t + 0.28, 0.1, 0.004, 0.16);
    },
    whoosh(dur = 0.3, up = true, v = 1) {
      if (!ok()) return; const t = now(); const g = gain(0), bp = biq('bandpass', up ? 300 : 3000, 1.1);
      bp.frequency.exponentialRampToValueAtTime(up ? 3000 : 300, t + dur); chain(nsrc(noise, t, dur), bp, g, master);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.16 * v, t + dur * 0.4); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    },
    tick() { if (!ok()) return; const t = now(), o = osc('sine', 1180, t, 0.03), g = gain(0); chain(o, g, master); env(g, t, 0.05, 0.001, 0.02); },
    hover() { if (!ok()) return; const t = now(), o = osc('triangle', 760 + Math.random() * 60, t, 0.05), g = gain(0); chain(o, g, master); env(g, t, 0.035, 0.002, 0.03); },
    click() { if (!ok()) return; const t = now(), o = osc('triangle', 420, t, 0.08), g = gain(0); o.frequency.exponentialRampToValueAtTime(760, t + 0.05); chain(o, g, master); env(g, t, 0.09, 0.002, 0.06); },
    coin() { if (!ok()) return; const t = now(); [[988, 0], [1319, 0.07]].forEach(([f, d]) => { const o = osc('square', f, t + d, 0.2), g = gain(0); chain(o, biq('lowpass', 3500), g, master); env(g, t + d, 0.08, 0.002, d ? 0.22 : 0.06); }); },
    chime(notes = [523, 659, 784, 1046], step = 0.085, v = 1) {
      if (!ok()) return; const t = now(); notes.forEach((f, i) => { const o = osc('triangle', f, t + i * step, 0.5), g = gain(0); chain(o, g, master); env(g, t + i * step, 0.14 * v, 0.004, 0.4); });
    },
    boing() { if (!ok()) return; const t = now(), o = osc('sine', 260, t, 0.3), g = gain(0); o.frequency.exponentialRampToValueAtTime(110, t + 0.08); o.frequency.exponentialRampToValueAtTime(330, t + 0.26); chain(o, g, master); env(g, t, 0.2, 0.004, 0.26); },
    thud(v = 1) { if (!ok()) return; const t = now(), o = osc('sine', 110, t, 0.14), g = gain(0); o.frequency.exponentialRampToValueAtTime(48, t + 0.1); chain(o, g, master); env(g, t, 0.4 * v, 0.003, 0.1); },
    plop() { if (!ok()) return; const t = now(), o = osc('sine', 520, t, 0.14), g = gain(0); o.frequency.exponentialRampToValueAtTime(190, t + 0.1); chain(o, g, master); env(g, t, 0.3, 0.003, 0.1); },
    pourLoop(dur = 0.7, v = 1) { // a rain of small ticks
      if (!ok()) return; const n = Math.max(6, Math.floor(dur * 45));
      for (let i = 0; i < n; i++) setTimeout(() => A.kernelTick(v * (0.5 + Math.random() * 0.6)), (i * dur * 1000 / n + Math.random() * 12) / U.speed);
    },
    /* the seagull's "voice": a tiny babble per letter + squawks */
    blip(ch, mood = 0) {
      if (!ok()) return; const t = now(), c = String(ch || 'a').toLowerCase(), code = c.charCodeAt(0) || 97;
      const vowel = 'aeiouyàâéèêëîïôöùûüœ'.indexOf(c) >= 0, base = vowel ? 610 : 400, f = base * (1 + ((code % 7) - 3) * 0.055) * (1 + mood * 0.12);
      const o = osc('triangle', f * 0.86, t, 0.09), g = gain(0), bp = biq('bandpass', f * 1.7, 1.1);
      o.frequency.exponentialRampToValueAtTime(f * 1.14, t + 0.05); chain(o, bp, g, master); env(g, t, 0.16, 0.005, 0.07);
    },
    squawk(v = 1) {
      if (!ok()) return; const t = now(), o = osc('sawtooth', 880, t, 0.22), g = gain(0), lfo = osc('sine', 38, t, 0.22), lg = gain(70);
      o.frequency.exponentialRampToValueAtTime(430, t + 0.2); lfo.connect(lg); lg.connect(o.frequency);
      chain(o, biq('bandpass', 1500, 0.8), g, master); env(g, t, 0.15 * v, 0.008, 0.2);
    },
    laugh() { for (let i = 0; i < 4; i++) setTimeout(() => A.blip('a', 1.2 + i * 0.1), i * 95 / U.speed); },
    /* continuous: kettle heating, returns a stop() */
    heat(dur = 2.4) {
      if (!ok()) return () => {}; const t = now(); const g = gain(0), lp = biq('lowpass', 260, 0.7);
      lp.frequency.exponentialRampToValueAtTime(1500, t + dur); chain(nsrc(brown, t, dur + 0.6), lp, g, master);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.5, t + dur * 0.8); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.4);
      const o = osc('sawtooth', 46, t, dur + 0.5), g2 = gain(0); o.frequency.exponentialRampToValueAtTime(74, t + dur); chain(o, biq('lowpass', 220), g2, master);
      g2.gain.setValueAtTime(0.0001, t); g2.gain.exponentialRampToValueAtTime(0.09, t + dur * 0.8); g2.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.4);
      return () => { try { g.gain.cancelScheduledValues(now()); g.gain.setTargetAtTime(0.0001, now(), 0.05); g2.gain.setTargetAtTime(0.0001, now(), 0.05); } catch (e) { /* ignore */ } };
    },
    /* ambience: the sea, very quiet */
    sea(v) {
      if (!ctx) return;
      if (!v) { if (seaNode) { const s = seaNode; seaNode = null; s.g.gain.setTargetAtTime(0.0001, now(), 0.3); setTimeout(() => { try { s.src.stop(); s.lfo.stop(); } catch (e) { /* ignore */ } }, 1500); } return; }
      if (seaNode || !on) return;
      const t = now(), src = ctx.createBufferSource(); src.buffer = brown; src.loop = true; src.start(t);
      const g = gain(0.0001), lp = biq('lowpass', 520, 0.5), lfo = osc('sine', 0.11, t, 1e6), lg = gain(0.035);
      chain(src, lp, g, master); g.gain.setTargetAtTime(0.07, t, 1.2); lfo.connect(lg); lg.connect(g.gain);
      seaNode = { src, g, lfo };
    },
  });
})((window.Cornsty = window.Cornsty || {}));
