/* Cornsty - the living kiosk, part 1/4: the MODEL. Pure functions, no DOM, no timers, no network.
   It answers "what does the kiosk look like right now?": time of day, sun and moon, weather, season, feast, drop countdown.
   Everything is deterministic for a given date, so it is trivial to test (see tools/ and the README). */
(function (C) {
  'use strict';
  const M = (C.livingModel = {});
  const RAD = Math.PI / 180;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
  M.clamp = clamp; M.lerp = lerp; M.smooth = smooth;

  /* ------------------------------------------------------------------ colours */
  const hex = (h) => { h = h.replace('#', ''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; };
  const toHex = (c) => '#' + c.map((v) => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0')).join('');
  M.mixHex = (a, b, t) => { const x = hex(a), y = hex(b); return toHex([lerp(x[0], y[0], t), lerp(x[1], y[1], t), lerp(x[2], y[2], t)]); };
  M.rgba = (c) => `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${+c[3].toFixed(3)})`;

  /* ------------------------------------------------------------------ calendar helpers */
  M.dayOfYear = (d) => Math.round((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - Date.UTC(d.getFullYear(), 0, 0)) / 864e5);
  M.isDst = (d) => { const y = d.getFullYear(), a = new Date(y, 0, 1).getTimezoneOffset(), b = new Date(y, 6, 1).getTimezoneOffset(); return a !== b && d.getTimezoneOffset() === Math.min(a, b); };
  M.hourOf = (d) => d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600;
  M.dateKey = (d) => d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
  M.hash = (s) => { let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h; };
  M.rng = (seed) => { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };

  /* ------------------------------------------------------------------ sun
     Sunrise / sunset expressed in the VISITOR'S OWN clock (so their evening is the kiosk's evening), with the real day length
     of the latitude given (Paris by default): ~05:50 -> 21:55 in June, ~08:45 -> 17:00 in December. */
  M.sunTimes = (d, lat = 48.86) => {
    const N = M.dayOfYear(d), B = (2 * Math.PI * (N - 81)) / 364;
    const eot = 9.87 * Math.sin(2 * B) - 7.53 * Math.cos(B) - 1.5 * Math.sin(B);                 // equation of time, minutes
    const decl = 23.44 * Math.sin((2 * Math.PI * (N - 81)) / 365) * RAD, phi = lat * RAD;
    const c = (Math.sin(-0.833 * RAD) - Math.sin(phi) * Math.sin(decl)) / (Math.cos(phi) * Math.cos(decl));
    const h0 = Math.acos(clamp(c, -1, 1)) / RAD / 15;                                          // half day length, hours
    const noon = 12.85 - eot / 60 + (M.isDst(d) ? 1 : 0);
    return { sunrise: noon - h0, sunset: noon + h0, noon, dayLen: 2 * h0 };
  };

  /* ------------------------------------------------------------------ moon (real phase) */
  const SYN = 29.530588853;
  M.moon = (d) => {
    const jd = d.getTime() / 864e5 + 2440587.5, age = (((jd - 2451550.26) % SYN) + SYN) % SYN;
    return { age, k: (1 - Math.cos((2 * Math.PI * age) / SYN)) / 2, waxing: age < SYN / 2 };
  };
  // where the moon is on its arc: f in [0,1] while it is above the horizon, else -1
  M.moonArc = (hour, sun, moon) => {
    const transit = (sun.noon + (moon.age / SYN) * 24) % 24, dh = ((hour - transit + 36) % 24) - 12, half = 6.2;
    return Math.abs(dh) < half ? (dh + half) / (2 * half) : -1;
  };

  /* ------------------------------------------------------------------ time-of-day palettes
     sky = [top, middle, horizon]; tint = the colour laid over the kiosk (rgba); night 0..1; warm 0..1 (low sun glow) */
  const P = {
    night:   { sky: ['#0C1038', '#1E2470', '#3A3F9A'], tint: [12, 18, 98, 0.38], night: 1, warm: 0 },
    blue:    { sky: ['#161B55', '#3A3F9A', '#7A6FB8'], tint: [28, 34, 112, 0.31], night: 0.85, warm: 0.15 },
    dawn:    { sky: ['#4A5DC0', '#E39AB0', '#FFC9A3'], tint: [255, 150, 120, 0.16], night: 0.35, warm: 1 },
    morning: { sky: ['#7F97EE', '#D8CBF0', '#FFE8C4'], tint: [255, 196, 140, 0.08], night: 0.05, warm: 0.5 },
    day:     { sky: ['#8FA3F0', '#BFCBF8', '#F3EEDF'], tint: [255, 255, 255, 0], night: 0, warm: 0 },
    golden:  { sky: ['#7F97EE', '#F2C79A', '#FFE0A8'], tint: [255, 170, 70, 0.14], night: 0, warm: 0.7 },
    sunset:  { sky: ['#5C63C8', '#F08A9C', '#FFB36B'], tint: [255, 120, 70, 0.2], night: 0.2, warm: 1 },
    dusk:    { sky: ['#2E3591', '#A9528F', '#F0806A'], tint: [110, 50, 120, 0.28], night: 0.55, warm: 0.4 },
    late:    { sky: ['#161B60', '#2F3585', '#6A5AA8'], tint: [24, 30, 104, 0.35], night: 0.9, warm: 0 },
  };
  M.palettes = P;
  // named moments (used by the "preview" control): hour of the day relative to sunrise / sunset
  M.momentHour = (name, sun) => ({
    dawn: sun.sunrise - 0.1, morning: sun.sunrise + 1, day: sun.noon, golden: sun.sunset - 0.8, sunset: sun.sunset, dusk: sun.sunset + 0.5, night: (sun.sunset + 3) % 24,
  }[name]);

  const mixPal = (a, b, t) => ({
    sky: a.sky.map((c, i) => M.mixHex(c, b.sky[i], t)),
    tint: a.tint.map((v, i) => lerp(v, b.tint[i], t)),
    night: lerp(a.night, b.night, t), warm: lerp(a.warm, b.warm, t),
  });
  M.lightAt = (hour, sun) => {
    const sr = sun.sunrise, ss = sun.sunset;
    const K = [[sr - 1.4, P.night], [sr - 0.9, P.blue], [sr - 0.1, P.dawn], [sr + 0.8, P.morning], [sr + 2, P.day], [ss - 2.2, P.day], [ss - 0.8, P.golden], [ss, P.sunset], [ss + 0.45, P.dusk], [ss + 1, P.late], [ss + 1.6, P.night]];
    if (hour <= K[0][0] || hour >= K[K.length - 1][0]) return mixPal(P.night, P.night, 0);
    for (let i = 0; i < K.length - 1; i++) if (hour < K[i + 1][0]) return mixPal(K[i][1], K[i + 1][1], smooth((hour - K[i][0]) / (K[i + 1][0] - K[i][0])));
    return mixPal(P.day, P.day, 0);
  };

  /* ------------------------------------------------------------------ seasons & feasts */
  M.seasonAt = (d) => {
    const m = d.getMonth() + 1, day = d.getDate(), v = m * 100 + day;
    if (v >= 320 && v < 621) return 'spring';
    if (v >= 621 && v < 922) return 'summer';
    if (v >= 922 && v < 1221) return 'autumn';
    return 'winter';
  };
  // events: [{ id, from:[month,day], to:[month,day], ... }], a range may wrap the new year (from Dec to Jan)
  M.eventAt = (d, events) => {
    const y = d.getFullYear();
    for (const e of events || []) {
      const [m1, d1] = e.from, [m2, d2] = e.to;
      const a = new Date(y, m1 - 1, d1), b = new Date(y, m2 - 1, d2, 23, 59, 59);
      if (m2 < m1 ? (d >= a || d <= b) : (d >= a && d <= b)) return e;
    }
    return null;
  };

  /* ------------------------------------------------------------------ weather
     Two sources, both optional: an "ambience" weather that is just a seeded dice roll per day (no network, no lie about Paris),
     or a real one mapped from WMO codes (the engine fetches it only if the owner turned it on). */
  const DAY_WEIGHTS = {
    winter: { clear: 0.28, mixed: 0.3, rain: 0.2, snow: 0.07, fog: 0.1, storm: 0.05 },
    spring: { clear: 0.38, mixed: 0.32, rain: 0.22, fog: 0.04, storm: 0.04 },
    summer: { clear: 0.6, mixed: 0.22, rain: 0.08, storm: 0.1 },
    autumn: { clear: 0.26, mixed: 0.3, rain: 0.28, fog: 0.12, storm: 0.04 },
  };
  // -> { type: 'clear'|'clouds'|'rain'|'storm'|'snow'|'fog', cloud: 0..1, intensity: 0..1 }
  M.pseudoWeather = (d, hour, season) => {
    const r = M.rng(M.hash(M.dateKey(d) + 'w')), w = DAY_WEIGHTS[season] || DAY_WEIGHTS.spring;
    let roll = r(), kind = 'clear';
    for (const k of Object.keys(w)) { if (roll < w[k]) { kind = k; break; } roll -= w[k]; }
    const start = 5 + r() * 12, len = 2 + r() * 5, inWin = hour >= start && hour < start + len, inten = 0.45 + r() * 0.55;
    const phase = r() * 6.28, mixed = clamp(0.45 + 0.35 * Math.sin(hour * 0.5 + phase), 0.12, 0.88);
    switch (kind) {
      case 'rain': return inWin ? { type: 'rain', cloud: 0.85, intensity: inten } : { type: 'clouds', cloud: 0.7, intensity: 0 };
      case 'storm': { const s2 = 12 + r() * 8; return hour >= s2 && hour < s2 + 1 + r() * 2 ? { type: 'storm', cloud: 1, intensity: 1 } : { type: 'clouds', cloud: 0.8, intensity: 0 }; }
      case 'snow': return inWin ? { type: 'snow', cloud: 0.8, intensity: inten } : { type: 'clouds', cloud: 0.65, intensity: 0 };
      case 'fog': return hour < 9.5 + r() * 2 ? { type: 'fog', cloud: 0.6, intensity: 0.8 } : { type: 'clear', cloud: 0.25, intensity: 0 };
      case 'mixed': return mixed > 0.55 ? { type: 'clouds', cloud: mixed, intensity: 0 } : { type: 'clear', cloud: mixed, intensity: 0 };
      default: return { type: 'clear', cloud: 0.12, intensity: 0 };
    }
  };
  // WMO weather interpretation codes (Open-Meteo)
  M.fromWmo = (code, windKmh = 0) => {
    if (code === 0) return { type: 'clear', cloud: 0.05, intensity: 0 };
    if (code <= 2) return { type: 'clear', cloud: 0.3, intensity: 0 };
    if (code === 3) return { type: 'clouds', cloud: 0.85, intensity: 0 };
    if (code === 45 || code === 48) return { type: 'fog', cloud: 0.6, intensity: 0.8 };
    if ((code >= 51 && code <= 57) || (code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return { type: 'rain', cloud: 0.9, intensity: code >= 65 || code >= 81 ? 1 : 0.55 };
    if ((code >= 71 && code <= 77) || code === 85 || code === 86) return { type: 'snow', cloud: 0.85, intensity: 0.7 };
    if (code >= 95) return { type: 'storm', cloud: 1, intensity: 1 };
    return { type: 'clouds', cloud: 0.5, intensity: 0 };
  };
  // grey the light down when it is overcast (the sun disappears, colours flatten)
  M.applyWeather = (light, w) => {
    const c = clamp(w.cloud || 0, 0, 1), grey = c * (w.type === 'storm' ? 0.75 : 0.55);
    const dull = ['#6F7BA8', '#98A0C2', '#C9CCDB'], night = light.night;
    const sky = light.sky.map((col, i) => M.mixHex(col, M.mixHex(dull[i], '#1E2350', night * 0.85), grey));
    const tint = light.tint.slice();
    const wet = w.type === 'rain' || w.type === 'storm' || w.type === 'snow' ? 1 : 0;
    // extra cool grey veil on overcast days
    const veil = [60, 72, 112, (0.16 * c + 0.06 * wet) * (1 - night * 0.85)];
    const a = 1 - (1 - tint[3]) * (1 - veil[3]);
    const mix = a > 0 ? [0, 1, 2].map((i) => (tint[i] * tint[3] + veil[i] * veil[3]) / (tint[3] + veil[3] || 1)) : [255, 255, 255];
    return Object.assign({}, light, { sky, tint: [mix[0], mix[1], mix[2], a], sunVisible: 1 - smooth((c - 0.3) / 0.5), cloud: c });
  };

  /* ------------------------------------------------------------------ the drop countdown */
  // drop = { day: 0..6 (0 = Sunday), hour: 0..23, liveHours: n }  -> weekly; returns the live state and the next start
  M.dropState = (now, drop) => {
    const live = drop.liveHours || 6, d = new Date(now);
    const prev = new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() - drop.day + 7) % 7), drop.hour);
    if (prev > d) prev.setDate(prev.getDate() - 7);
    const isLive = d - prev < live * 3600e3, next = new Date(prev.getTime());
    next.setDate(next.getDate() + 7);
    return { live: isLive, start: prev, next, msToNext: next - d, msLeft: isLive ? live * 3600e3 - (d - prev) : 0 };
  };
  M.fmtCountdown = (ms) => {
    const s = Math.max(0, Math.floor(ms / 1000)), dd = Math.floor(s / 86400), hh = Math.floor((s % 86400) / 3600), mm = Math.floor((s % 3600) / 60), ss = s % 60, p = (n) => String(n).padStart(2, '0');
    return dd > 0 ? `${dd} j ${p(hh)} h ${p(mm)}` : `${p(hh)}:${p(mm)}:${p(ss)}`;
  };
})((typeof window !== 'undefined' ? (window.Cornsty = window.Cornsty || {}) : (globalThis.Cornsty = globalThis.Cornsty || {})));
