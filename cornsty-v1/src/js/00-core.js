/* Cornsty - core helpers: DOM, easing, ticker, cancellable scripts, event bus.
   Everything lives under the single global `Cornsty` (classic scripts, works from file://). */
(function (C) {
  'use strict';
  const U = (C.util = {});
  const NS = 'http://www.w3.org/2000/svg';

  /* ---------------------------------------------------------------- DOM */
  U.$ = (s, r = document) => r.querySelector(s);
  U.$$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const setAttrs = (n, a) => {
    if (!a) return n;
    for (const k in a) {
      const v = a[k];
      if (v == null || v === false) continue;
      if (k === 'class') n.setAttribute('class', v);
      else if (k === 'style' && typeof v === 'object') Object.assign(n.style, v);
      else if (k === 'html') n.innerHTML = v;
      else if (k === 'text') n.textContent = v;
      else if (k === 'dataset') Object.assign(n.dataset, v);
      else if (k.slice(0, 2) === 'on' && typeof v === 'function') n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v === true ? '' : v);
    }
    return n;
  };
  const addKids = (n, kids) => {
    for (const k of kids.flat(9)) {
      if (k == null || k === false) continue;
      n.append(k.nodeType ? k : document.createTextNode(String(k)));
    }
    return n;
  };
  U.el = (tag, attrs, ...kids) => addKids(setAttrs(document.createElement(tag), attrs), kids);
  U.svg = (tag, attrs, ...kids) => addKids(setAttrs(document.createElementNS(NS, tag), attrs), kids);
  U.html = (s) => { const t = document.createElement('template'); t.innerHTML = s.trim(); return t.content.firstElementChild; };
  U.svgFrag = (s) => { const t = document.createElementNS(NS, 'g'); t.innerHTML = s; return t; };
  U.esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* ---------------------------------------------------------------- math */
  U.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  U.lerp = (a, b, t) => a + (b - a) * t;
  U.map = (v, a, b, c, d) => c + ((v - a) / (b - a)) * (d - c);
  U.rad = (d) => (d * Math.PI) / 180;
  U.rng = (seed) => { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  U.rand = (a = 1, b) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a));
  U.rint = (a, b) => Math.floor(U.rand(a, b + 1));
  U.pick = (arr, r = Math.random) => arr[Math.floor(r() * arr.length)];
  U.shuffle = (arr) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  U.uid = (n = 6) => Array.from({ length: n }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join('');
  U.round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

  const eurFmt = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });
  U.eur = (n) => eurFmt.format(n).replace(/ /g, ' ');
  U.eurPlain = (n) => (n < 0 ? '-' : '') + Math.abs(n).toFixed(2).replace('.', ',') + ' €';
  U.plural = (n, one, many) => (n > 1 ? many : one);
  U.pad = (n, l = 2) => String(n).padStart(l, '0');

  /* ---------------------------------------------------------------- easing */
  const back = (s) => (t) => { const c = s + 1; return 1 + c * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2); };
  U.ease = {
    linear: (t) => t,
    inQuad: (t) => t * t,
    outQuad: (t) => 1 - (1 - t) * (1 - t),
    inOut: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
    inOutSine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
    outCubic: (t) => 1 - Math.pow(1 - t, 3),
    inCubic: (t) => t * t * t,
    outQuart: (t) => 1 - Math.pow(1 - t, 4),
    outBack: back(1.70158),
    outBackSoft: back(1.0),
    inBack: (t) => 2.70158 * t * t * t - 1.70158 * t * t,
    outElastic: (t) => (t === 0 || t === 1 ? t : Math.pow(2, -10 * t) * Math.sin(((t * 10 - 0.75) * 2 * Math.PI) / 3) + 1),
    outBounce: (t) => { const n = 7.5625, d = 2.75; if (t < 1 / d) return n * t * t; if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75; if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375; return n * (t -= 2.625 / d) * t + 0.984375; },
    arc: (t) => 4 * t * (1 - t),
  };

  /* ---------------------------------------------------------------- ticker (one rAF loop for everything) */
  U.speed = 1; // global choreography speed (skip / fast mode)
  const tk = { subs: new Set(), last: 0, on: false };
  const loop = (now) => {
    const dt = Math.min(0.05, Math.max(0, (now - tk.last) / 1000));
    tk.last = now;
    for (const f of Array.from(tk.subs)) f(dt, now);
    if (tk.subs.size) requestAnimationFrame(loop); else tk.on = false;
  };
  U.ticker = {
    add(f) {
      tk.subs.add(f);
      if (!tk.on) { tk.on = true; tk.last = performance.now(); requestAnimationFrame(loop); }
      return () => tk.subs.delete(f);
    },
  };

  /* ---------------------------------------------------------------- cancellable scripts */
  const CANCEL = { cancelled: true };
  U.CANCEL = CANCEL;
  U.isCancel = (e) => e === CANCEL;
  class Run {
    constructor(parent) { this.dead = false; this.rejs = new Set(); this.timers = new Set(); if (parent) parent.child(this); this.kids = new Set(); }
    child(r) { (this.kids = this.kids || new Set()).add(r); }
    wait(ms, speed = true) {
      return new Promise((res, rej) => {
        if (this.dead) return rej(CANCEL);
        this.rejs.add(rej);
        const t = setTimeout(() => { this.rejs.delete(rej); this.timers.delete(t); res(); }, Math.max(0, speed ? ms / U.speed : ms));
        this.timers.add(t);
      });
    }
    tween(ms, fn, ease = U.ease.inOut, speed = true) {
      return new Promise((res, rej) => {
        if (this.dead) return rej(CANCEL);
        this.rejs.add(rej);
        let t = 0;
        const off = U.ticker.add((dt) => {
          if (this.dead) { off(); this.rejs.delete(rej); return; }
          t += dt * 1000 * (speed ? U.speed : 1);
          const k = ms <= 0 ? 1 : Math.min(1, t / ms);
          fn(ease(k), k);
          if (k >= 1) { off(); this.rejs.delete(rej); res(); }
        });
        this.off = off;
      });
    }
    cancel() {
      if (this.dead) return;
      this.dead = true;
      this.timers.forEach(clearTimeout); this.timers.clear();
      this.rejs.forEach((r) => r(CANCEL)); this.rejs.clear();
      if (this.kids) this.kids.forEach((k) => k.cancel());
    }
  }
  U.Run = Run;
  U.wait = (ms) => new Promise((r) => setTimeout(r, ms / U.speed));
  U.tween = (ms, fn, ease) => new Run().tween(ms, fn, ease);
  // run an async fn, swallow cancellation
  U.safe = async (fn) => { try { return await fn(); } catch (e) { if (!U.isCancel(e)) console.error(e); } };

  /* ---------------------------------------------------------------- event bus */
  const subs = {};
  C.bus = {
    on(evt, fn) { (subs[evt] = subs[evt] || new Set()).add(fn); return () => subs[evt].delete(fn); },
    off(evt, fn) { subs[evt] && subs[evt].delete(fn); },
    emit(evt, data) { subs[evt] && Array.from(subs[evt]).forEach((f) => { try { f(data); } catch (e) { console.error(e); } }); },
  };

  /* ---------------------------------------------------------------- misc */
  U.ls = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } },
  };
  U.reduced = () => (C.prefs && C.prefs.motion === 'reduced') || (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches && !(C.prefs && C.prefs.motion === 'full'));
  U.debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
  U.copy = async (text) => { try { await navigator.clipboard.writeText(text); return true; } catch (e) { const t = U.el('textarea', { style: { position: 'fixed', opacity: 0 } }); t.value = text; document.body.append(t); t.select(); let ok = false; try { ok = document.execCommand('copy'); } catch (e2) { /* ignore */ } t.remove(); return ok; } };
  U.today = () => { const d = new Date(); return d.getFullYear() + '-' + U.pad(d.getMonth() + 1) + '-' + U.pad(d.getDate()); };
  U.daysBetween = (a, b) => Math.round((Date.parse(b + 'T12:00:00') - Date.parse(a + 'T12:00:00')) / 864e5);
  U.dateFr = (t) => new Date(t).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  U.timeFr = (t) => new Date(t).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  U.isTouch = () => window.matchMedia && matchMedia('(pointer: coarse)').matches;
})((window.Cornsty = window.Cornsty || {}));
