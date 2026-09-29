// Unit checks for the living-kiosk model (pure functions, no browser needed).   node tools/test-living-model.js   (TZ=Europe/Paris shows real Paris clock hours)
require(require('path').join(__dirname, '..', 'src/js/living-model.js'));
const M = globalThis.Cornsty.livingModel;
const f = (h) => `${String(Math.floor(h)).padStart(2, '0')}:${String(Math.round((h % 1) * 60)).padStart(2, '0')}`;
let bad = 0; const ok = (c, m) => { if (!c) { bad++; console.log('FAIL', m); } else console.log('ok  ', m); };
for (const [label, d, exp] of [['21 juin', new Date(2026, 5, 21, 12), ['05:4', '21:5']], ['21 déc', new Date(2026, 11, 21, 12), ['08:4', '16:5']], ['20 mars', new Date(2026, 2, 20, 12), ['07:', '19:']]]) {
  const s = M.sunTimes(d); console.log(label, 'lever', f(s.sunrise), 'coucher', f(s.sunset), 'jour', s.dayLen.toFixed(2) + ' h', 'dst', M.isDst(d));
}
const jun = M.sunTimes(new Date(2026, 5, 21, 12)), dec = M.sunTimes(new Date(2026, 11, 21, 12));
ok(jun.dayLen > 15.9 && jun.dayLen < 16.3, 'jour du 21 juin ≈ 16 h 05 (' + jun.dayLen.toFixed(2) + ')');
ok(dec.dayLen > 8.0 && dec.dayLen < 8.5, 'jour du 21 décembre ≈ 8 h 15 (' + dec.dayLen.toFixed(2) + ')');
const full = M.moon(new Date(Date.UTC(2026, 8, 26, 12))), nw = M.moon(new Date(Date.UTC(2026, 8, 11, 4)));
ok(full.k > 0.97, 'pleine lune le 26/09/2026 (k=' + full.k.toFixed(2) + ')');
ok(nw.k < 0.05, 'nouvelle lune le 11/09/2026 (k=' + nw.k.toFixed(2) + ')');
console.log('lune aujourd’hui (29/09/2026):', M.moon(new Date(2026, 8, 29, 20)).k.toFixed(2), M.moon(new Date(2026, 8, 29, 20)).waxing ? 'croissante' : 'décroissante');
const ev = [{ id: 'valentin', from: [2, 7], to: [2, 14] }, { id: 'bastille', from: [7, 11], to: [7, 14] }, { id: 'halloween', from: [10, 22], to: [11, 1] }, { id: 'noel', from: [12, 8], to: [12, 26] }, { id: 'nouvelan', from: [12, 28], to: [1, 2] }];
const at = (y, m, d) => (M.eventAt(new Date(y, m - 1, d, 12), ev) || {}).id || null;
ok(at(2026, 10, 31) === 'halloween' && at(2026, 11, 1) === 'halloween' && at(2026, 11, 2) === null, 'Halloween 22/10 → 1/11');
ok(at(2026, 12, 31) === 'nouvelan' && at(2027, 1, 1) === 'nouvelan' && at(2027, 1, 3) === null && at(2026, 12, 27) === null, 'Nouvel An chevauche les années');
ok(at(2026, 12, 25) === 'noel' && at(2026, 2, 14) === 'valentin' && at(2026, 7, 14) === 'bastille' && at(2026, 5, 3) === null, 'Noël / Saint-Valentin / 14 juillet / jour normal');
ok(['spring', 'summer', 'autumn', 'winter'].join() === [new Date(2026, 3, 1), new Date(2026, 7, 1), new Date(2026, 9, 15), new Date(2026, 0, 15)].map(M.seasonAt).join(), 'saisons');
// light through a summer day
const d = new Date(2026, 5, 21, 12), s = M.sunTimes(d);
for (const h of [3, s.sunrise - 1, s.sunrise, s.sunrise + 1, 12, s.sunset - 1, s.sunset, s.sunset + 0.5, s.sunset + 1.2, 23.9]) { const L = M.lightAt(h, s); console.log(f(h), 'night', L.night.toFixed(2), 'tint', M.rgba(L.tint), 'sky', L.sky.join(' ')); }
ok(M.lightAt(3, s).night === 1 && M.lightAt(13, s).night === 0, 'nuit à 3 h, plein jour à 13 h');
// weather frequencies over a year
const cnt = {}; for (let i = 0; i < 365; i++) { const dd = new Date(2026, 0, 1 + i, 15); const w = M.pseudoWeather(dd, 15, M.seasonAt(dd)); cnt[w.type] = (cnt[w.type] || 0) + 1; }
console.log('météo d’ambiance à 15 h sur 365 jours:', JSON.stringify(cnt));
ok(cnt.clear > 100 && cnt.rain > 15 && cnt.rain < 120, 'répartition plausible');
const w1 = M.pseudoWeather(new Date(2026, 8, 29, 10), 10, 'autumn'), w2 = M.pseudoWeather(new Date(2026, 8, 29, 10), 10, 'autumn'); ok(JSON.stringify(w1) === JSON.stringify(w2), 'la météo d’ambiance est déterministe');
console.log('WMO 61 →', JSON.stringify(M.fromWmo(61)), '| 71 →', M.fromWmo(71).type, '| 95 →', M.fromWmo(95).type, '| 45 →', M.fromWmo(45).type);
// drop
const fri = new Date(2026, 8, 25, 19, 0), thu = new Date(2026, 8, 24, 12, 0);
const ds1 = M.dropState(fri, { day: 5, hour: 18, liveHours: 6 }), ds2 = M.dropState(thu, { day: 5, hour: 18, liveHours: 6 });
ok(ds1.live && !ds2.live && Math.round(ds2.msToNext / 3600e3) === 30, 'drop du vendredi 18 h : en cours à 19 h, dans 30 h le jeudi midi');
console.log('compte à rebours:', M.fmtCountdown(ds2.msToNext), '|', M.fmtCountdown(3 * 3600e3 + 12 * 60e3 + 9e3), '| reste live:', M.fmtCountdown(ds1.msLeft));
console.log(bad ? bad + ' échec(s)' : 'tout est bon');
process.exit(bad ? 1 : 0);
