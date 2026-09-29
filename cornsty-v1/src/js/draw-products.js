/* Cornsty - drawing kit (2/2): global <defs>, flavour pouches, jersey, cap, plush, stickers, tin, gift box, badges. */
(function (C) {
  'use strict';
  const D = C.draw, A = C.art, K = D.COL, U = C.util;
  const f = (v) => +v.toFixed(2);

  /* ------------------------------------------------------------ baked colours for symbols */
  D.ROLEFILL = { ink: K.ink, cream: K.cream, hat: K.blue, beak: K.orange, quat: K.red, word: K.cream, wordq: K.ink, board: '#3b3b46', ring: K.blue, dark: '#1b1820' };
  D.filled = (parts, over = {}) => parts.map((p) => `<path d="${p.d}" fill="${over[p.role] || D.ROLEFILL[p.role] || K.ink}"/>`).join('');
  const sym = (id, asset, over) => {
    const w = asset.w, h = asset.h, ox = asset.origin ? 0 : 0;
    return `<symbol id="${id}" viewBox="${f(-w / 2)} ${f(-h)} ${f(w)} ${f(h)}" overflow="visible">${D.filled(asset.parts, over)}</symbol>`;
  };
  /* shared symbols live in one hidden svg mounted at boot (D.mountDefs). Everything below <use>s them. */
  D.defs = () => {
    const wm = A.wordmark;
    return [
      `<symbol id="s-quat" viewBox="0 0 301 301"><path d="${A.quat.d}"/></symbol>`,
      `<symbol id="s-word" viewBox="0 0 ${f(wm.w)} ${f(wm.h)}">${wm.letters.map((p) => `<path d="${p.d}"/>`).join('')}<path class="wm-q" d="${wm.mark.d}" style="fill:var(--wm-q,#26232b)"/></symbol>`,
      sym('s-gullMid', A.gullMid), sym('s-gullLong', A.gullLong), sym('s-gullSide', A.gullSide),
      sym('s-ring', A.poseRing, { ring: K.blue }), sym('s-surf', A.poseSurf), sym('s-board', A.poseBoard),
      `<symbol id="s-icon" viewBox="-190 -6 380 420" overflow="visible">${D.filled(A.icon.parts)}</symbol>`,
      D.puffSymbols('pf'),
      `<pattern id="popTex" patternUnits="userSpaceOnUse" width="120" height="96" viewBox="0 0 120 96">${popTexBody()}</pattern>`,
      `<pattern id="checkBlue" patternUnits="userSpaceOnUse" width="60" height="60"><rect width="60" height="60" fill="#8A9BEF"/><rect width="30" height="30" fill="#6A7EE0"/><rect x="30" y="30" width="30" height="30" fill="#6A7EE0"/></pattern>`,
    ].join('');
  };
  function popTexBody() {
    // ~7 puffs per tile, wrapped so it tiles seamlessly
    const pts = [[18, 20, 0], [60, 14, 1], [100, 24, 2], [36, 54, 3], [82, 58, 4], [12, 82, 5], [60, 88, 2], [108, 84, 1]];
    let out = `<rect width="120" height="96" fill="#F3C25B"/>`;
    const wraps = [[0, 0], [-120, 0], [120, 0], [0, -96], [0, 96]];
    pts.sort((a, b) => a[1] - b[1]);
    for (const [x, y, v] of pts) for (const [dx, dy] of wraps) {
      const X = x + dx, Y = y + dy; if (X < -30 || X > 150 || Y < -30 || Y > 126) continue;
      out += `<use href="#pf${v}" x="${X - 21}" y="${Y - 21}" width="42" height="42" transform="rotate(${(v * 57) % 360} ${X} ${Y})"/>`;
    }
    return out;
  }
  D.mountDefs = () => {
    if (document.getElementById('cs-defs')) return;
    const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('id', 'cs-defs'); s.setAttribute('width', '0'); s.setAttribute('height', '0'); s.setAttribute('aria-hidden', 'true');
    s.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
    s.innerHTML = '<defs>' + D.defs() + '</defs>';
    document.body.prepend(s);
  };

  /* ------------------------------------------------------------ helpers */
  D.useGull = (which, x, y, s, extra = '') => { const a = A[which]; return `<use href="#s-${which}" x="${f(x - (a.w * s) / 2)}" y="${f(y - a.h * s)}" width="${f(a.w * s)}" height="${f(a.h * s)}" ${extra}/>`; };
  D.useWord = (x, y, w, fill, stroke, sw = 0, q = K.ink) => { const h = (w * A.wordmark.h) / A.wordmark.w; return `<use href="#s-word" x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" fill="${fill}" ${stroke ? `stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round" paint-order="stroke"` : ''} style="--wm-q:${q}"/>`; };
  D.useQuat = (x, y, s, fill) => `<use href="#s-quat" x="${f(x)}" y="${f(y)}" width="${f(s)}" height="${f(s)}" fill="${fill}"/>`;

  /* ------------------------------------------------------------ the flavour pouch (brand-book pack, 488 x 798) */
  const PACK = {
    cheddar: 'POPCORN COATED IN RICH, SHARP CHEDDAR FOR AN EXTRA CHEESY CRUNCH IN EVERY BITE',
    gaufre: 'CRISP POPCORN WITH BAKED APPLE, WARM WAFFLE & A CINNAMON FINISH',
    wings: 'STICKY, SWEET & SPICY KOREAN-STYLE WINGS SAUCE ON EVERY CRUNCHY KERNEL',
    nature: 'LIGHTLY SEASONED WITH SEA SALT FOR A CLEAN, CRISPY, PERFECTLY CRUNCHY BITE',
    caramel: 'BUTTERY CARAMEL, A TOUCH OF SEA SALT & AN IRRESISTIBLY CRUNCHY BITE',
    cookies: 'A RICH BLEND OF COCOA, CREAMY VANILLA & AN IRRESISTIBLY CRUNCHY BITE',
  };
  const wrap = (txt, n) => { const w = txt.split(' '), lines = []; let l = ''; for (const x of w) { if ((l + ' ' + x).trim().length > n) { lines.push(l.trim()); l = x; } else l += ' ' + x; } if (l.trim()) lines.push(l.trim()); return lines; };

  /* level: 0..1 popcorn in the window; flat: no sheen. Returns a full <svg> string. */
  D.pouch = (fl, o = {}) => {
    const id = D.uid('po'), c = fl.colors, W = 488, H = 798, level = o.level == null ? 1 : o.level;
    const win = 'M0 338Q244 232 488 338V545Q244 645 0 545Z';
    const zone = 'M0 72H488V338Q244 232 0 338Z';
    const lines = wrap(PACK[fl.id] || '', 26);
    const winTop = 232 + 30, winH = 420;                                  // popcorn level travel
    const off = f((1 - level) * winH);
    const badgeInk = fl.colors.badgeInk;
    const sheen = o.flat ? '' : `<rect width="${W}" height="${H}" fill="url(#${id}sh)" pointer-events="none"/>`;
    return `<svg class="pouch-svg" data-flavor="${fl.id}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Pochon ${U.esc(fl.name)} ${U.esc(fl.sub)}">
<defs>
 <clipPath id="${id}c"><rect width="${W}" height="${H}" rx="24"/></clipPath>
 <clipPath id="${id}z"><path d="${zone}"/></clipPath>
 <clipPath id="${id}w"><path d="${win}"/></clipPath>
 <linearGradient id="${id}sh" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".22"/><stop offset=".35" stop-color="#fff" stop-opacity="0"/><stop offset=".8" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".18"/></linearGradient>
 <linearGradient id="${id}wg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F2F2F5"/><stop offset="1" stop-color="#DADAE2"/></linearGradient>
</defs>
<g clip-path="url(#${id}c)">
 <rect width="${W}" height="${H}" fill="${c.base}"/>
 <rect y="26" width="${W}" height="26" fill="${K.blue}"/>
 <text x="-6" y="45" font-family="Inter,sans-serif" font-weight="500" font-size="14" letter-spacing=".2" fill="${K.cream}">Gourmet popcorn • 100% French corn • Gourmet popcorn • 100% French corn • Gourmet popcorn</text>
 <path d="M14 70H474" stroke="${K.cream}" stroke-opacity=".9" stroke-width="2" stroke-dasharray="3 4"/>
 <g clip-path="url(#${id}z)">${D.fillPattern(fl, W, 340, o.pscale || 0.4)}</g>
 <path d="${win}" fill="url(#${id}wg)"/>
 <g clip-path="url(#${id}w)"><g class="pc-level" transform="translate(0 ${off})"><rect x="0" y="${winTop}" width="${W}" height="${winH + 200}" fill="url(#popTex)" transform="translate(0 0)"/></g>
   <path d="M0 338Q244 232 488 338" fill="none" stroke="#000" stroke-opacity=".12" stroke-width="8"/></g>
 ${D.useGull('gullMid', 76, 776, 0.5)}
 ${D.useWord(20, 74, 448, K.cream, c.dark, 9, K.ink)}
 ${D.ovalBadge({ cx: 132, cy: 128, rx: 62, ry: 32, fill: c.badge, ink: badgeInk, line1: '', small: false })}
 <text x="132" y="136" text-anchor="middle" font-family="Inter,sans-serif" font-weight="500" font-size="20" letter-spacing="-.4" fill="${badgeInk}">${U.esc(fl.name.split(' ')[0])}</text>
 ${D.ovalBadge({ cx: 262, cy: 612, rx: 104, ry: 56, fill: c.badge, ink: badgeInk, line1: U.esc(fl.name.split(' ')[0].toUpperCase()), line2: U.esc(fl.sub), small: false, fs1: 34, fs2: 19 })}
 <g fill="${K.cream}" font-family="Inter,sans-serif" font-weight="600" font-size="9.5" letter-spacing=".3">${lines.map((l, i) => `<text x="150" y="${688 + i * 13}">${l}</text>`).join('')}</g>
 ${D.useQuat(348, 686, 54, K.cream)}<text x="375" y="712" text-anchor="middle" font-family="Inter,sans-serif" font-weight="700" font-size="16" fill="${K.ink}">4G</text><text x="375" y="723" text-anchor="middle" font-family="Inter,sans-serif" font-weight="500" font-size="8.5" fill="${K.ink}">fat</text>
 ${D.useQuat(414, 686, 54, K.cream)}<text x="441" y="712" text-anchor="middle" font-family="Inter,sans-serif" font-weight="700" font-size="15" fill="${K.ink}">12G</text><text x="441" y="723" text-anchor="middle" font-family="Inter,sans-serif" font-weight="500" font-size="8.5" fill="${K.ink}">protein</text>
 <rect y="752" width="${W}" height="30" fill="${K.blue}"/>
 <text x="${W / 2}" y="773" text-anchor="middle" font-family="Inter,sans-serif" font-weight="600" font-size="15" fill="${K.cream}">${fl.weight} g</text>
 ${sheen}
</g></svg>`;
  };

  /* ------------------------------------------------------------ jersey */
  D.jersey = ({ name = '', num = '', view = 'front', size } = {}) => {
    const id = D.uid('jy'), body = 'M170 26L84 58Q40 78 14 172L68 204Q84 184 104 168L96 440Q220 452 344 440L336 168Q356 184 372 204L426 172Q400 78 356 58L270 26L220 96Z';
    const collar = `<path d="M170 26Q220 4 270 26L262 44Q220 28 178 44Z" fill="#EAE0C4" stroke="${K.ink}" stroke-width="5" stroke-linejoin="round"/>
      <path d="M164 24L222 100L196 118L138 62Z" fill="${K.cream}" stroke="${K.ink}" stroke-width="5" stroke-linejoin="round"/>
      <path d="M276 24L218 100L244 118L302 62Z" fill="${K.cream}" stroke="${K.ink}" stroke-width="5" stroke-linejoin="round"/>`;
    const cuffs = `<path d="M14 172L68 204L58 226L4 194Z" fill="${K.cream}" stroke="${K.ink}" stroke-width="5" stroke-linejoin="round"/><path d="M426 172L372 204L382 226L436 194Z" fill="${K.cream}" stroke="${K.ink}" stroke-width="5" stroke-linejoin="round"/>`;
    const nm = String(name || '').slice(0, 10), nu = num === '' || num == null ? '' : String(num).slice(0, 2);
    const front = `<g>${collar.replace(/^/, '')}</g>${cuffs}
      ${D.useWord(122, 176, 196, K.cream, K.ink, 0, K.ink)}
      <g transform="translate(360 100) rotate(18)"><use href="#s-quat" x="-22" y="-22" width="44" height="44" fill="${K.red}"/><use href="#s-icon" x="-15" y="-16" width="30" height="33"/></g>
      <ellipse cx="68" cy="122" rx="24" ry="13" transform="rotate(-24 68 122)" fill="${K.pink}" stroke="${K.ink}" stroke-width="3"/><text x="68" y="126" transform="rotate(-24 68 122)" text-anchor="middle" font-family="Inter,sans-serif" font-weight="600" font-size="8.5" fill="${K.ink}">MUNCH CLUB</text>`;
    const back = `<g>${collar}</g>${cuffs}
      <text x="220" y="146" text-anchor="middle" font-family="Yellowtail,cursive" font-size="${nm.length > 7 ? 46 : 58}" fill="${K.cream}" stroke="${K.ink}" stroke-width="0">${U.esc(nm || 'Ton nom')}</text>
      <text x="220" y="342" text-anchor="middle" font-family="'League Gothic',Impact,sans-serif" font-size="${nu.length > 1 ? 232 : 260}" fill="${K.cream}" letter-spacing="2">${U.esc(nu || '01')}</text>
      ${[0, 1, 2].map((i) => D.useQuat(190 + i * 22, 370, 18, K.cream)).join('')}`;
    const one = (v) => `<svg class="jersey-svg" viewBox="0 0 440 460" role="img" aria-label="Maillot Cornsty ${v === 'back' ? 'dos' : 'face'}">
      <defs><clipPath id="${id}${v}"><path d="${body}"/></clipPath></defs>
      <path d="${body}" fill="url(#checkBlue)"/>
      <g clip-path="url(#${id}${v})"><path d="${body}" fill="url(#checkBlue)"/>
        <path d="M96 440Q220 452 344 440L344 452L96 452Z" fill="${K.cream}"/></g>
      <path d="${body}" fill="none" stroke="${K.ink}" stroke-width="5" stroke-linejoin="round"/>
      ${v === 'back' ? back : front}</svg>`;
    if (view === 'both') return `<div class="jersey-both">${one('front')}${one('back')}</div>`;
    return one(view);
  };

  /* ------------------------------------------------------------ cap */
  D.cap = () => {
    const id = D.uid('cp'), fl = C.data.byId('cheddar'), crown = 'M44 206C40 96 120 34 210 34C300 34 380 96 376 206Z';
    return `<svg class="cap-svg" viewBox="0 0 420 300" role="img" aria-label="Casquette Signature Pattern">
<defs><clipPath id="${id}"><path d="${crown}"/></clipPath></defs>
<path d="M60 236C150 272 270 272 360 236L410 248C330 306 90 306 10 248Z" fill="#E86F00" stroke="${K.ink}" stroke-width="5" stroke-linejoin="round"/>
<g clip-path="url(#${id})"><g transform="translate(20 20)">${D.patterns.harlequin({ a: '#FF8300', b: '#FFDD5C' }, 380, 220, 0.5)}</g></g>
<path d="${crown}" fill="none" stroke="${K.ink}" stroke-width="5" stroke-linejoin="round"/>
<path d="M44 206C130 240 290 240 376 206L372 232C290 262 130 262 48 232Z" fill="#FF9A2E" stroke="${K.ink}" stroke-width="5" stroke-linejoin="round"/>
<path d="M210 34C186 96 184 156 190 214M210 34C234 96 236 156 230 214" fill="none" stroke="${K.ink}" stroke-opacity=".45" stroke-width="3" stroke-dasharray="6 5"/>
<circle cx="210" cy="32" r="12" fill="#FF9A2E" stroke="${K.ink}" stroke-width="5"/>
<use href="#s-quat" x="176" y="104" width="68" height="68" fill="${K.red}"/><use href="#s-icon" x="188" y="112" width="44" height="49"/>
</svg>`;
  };

  /* ------------------------------------------------------------ plush keyring (swim-ring gull) */
  D.plush = () => {
    const a = A.poseRing, s = 0.5, cx = 210, by = 262;
    const g = a.parts.map((p) => `<path d="${p.d}" fill="${D.ROLEFILL[p.role] || K.ink}" stroke="${K.cream}" stroke-width="26" stroke-linejoin="round" paint-order="stroke"/>`).join('');
    const g2 = a.parts.map((p) => `<path d="${p.d}" fill="${D.ROLEFILL[p.role] || K.ink}"/>`).join('');
    return `<svg class="plush-svg" viewBox="0 0 420 320" role="img" aria-label="Peluche porte-clés mouette bouée">
<path d="M262 40C330 -26 384 18 354 68C334 100 300 78 292 58" fill="none" stroke="${K.red}" stroke-width="10" stroke-linecap="round"/>
<path d="M262 40C224 78 250 110 276 118" fill="none" stroke="${K.red}" stroke-width="10" stroke-linecap="round"/>
<circle cx="280" cy="112" r="9" fill="${K.red}" stroke="${K.ink}" stroke-width="3"/>
<g transform="translate(${cx} ${by}) scale(${s})">${g}${g2}</g></svg>`;
  };

  /* ------------------------------------------------------------ stickers */
  const stk = (inner, w = 0, extra = '') => `<g stroke="#fff" stroke-width="${w || 12}" stroke-linejoin="round" paint-order="stroke" ${extra}>${inner}</g>`;
  D.stickers = () => {
    const lg = (lines, x, y, sz, fill, rot = 0, ls = 1) => `<text transform="translate(${x} ${y}) rotate(${rot})" text-anchor="middle" font-family="'League Gothic',Impact,sans-serif" font-size="${sz}" letter-spacing="${ls}" fill="${fill}">${lines.map((l, i) => `<tspan x="0" dy="${i ? sz * 0.92 : 0}">${l}</tspan>`).join('')}</text>`;
    const gull = (sym, x, y, s, rot = 0) => `<g transform="translate(${x} ${y}) rotate(${rot}) scale(${s})">${D.filled(A[sym].parts)}</g>`;
    const cx = (c) => 80 + 160 * c, cy = (r) => 60 + 120 * r;
    const oval = (x, y, fill, ink, txt, rot) => `<g transform="translate(${x} ${y}) rotate(${rot})"><ellipse rx="58" ry="24" fill="${fill}"/><text y="5" text-anchor="middle" font-family="Inter,sans-serif" font-weight="600" font-size="13" letter-spacing="1" fill="${ink}" stroke="none">${txt}</text></g>`;
    return `<svg class="stickers-svg" viewBox="0 0 480 360" role="img" aria-label="Pack de stickers Cornsty">
<rect x="4" y="4" width="472" height="352" rx="22" fill="#F1EFEA" stroke="${K.ink}" stroke-opacity=".12" stroke-width="2"/>
${stk(D.useWord(cx(0) - 66, cy(0) - 40, 132, K.red, null, 0, K.red), 9)}
${stk(lg(['POP IT', 'HARDER!'], cx(1), cy(0) - 6, 50, K.blue, -5), 9)}
${stk(gull('poseBoard', cx(2), cy(0) + 52, 0.24, -3), 8)}
${stk(lg(['SAME', 'SNACK', 'ENERGY'], cx(0), cy(1) - 22, 46, K.red, -4), 9)}
${stk(gull('poseSurf', cx(1), cy(1) + 54, 0.24, 3), 8)}
${stk(lg(['SHHHH!'], cx(2), cy(1) + 12, 58, K.blue, 5), 9)}
${stk(oval(cx(0), cy(2), K.pink, K.red, 'POP MODE ON', -8), 9)}
${stk(gull('poseRing', cx(1), cy(2) + 52, 0.23, -3), 8)}
${stk(oval(cx(2), cy(2), K.teal, K.cream, 'BEST SERVED', 8), 9)}
</svg>`;
  };

  /* ------------------------------------------------------------ collector tin (caramel, zigzag) */
  D.tin = () => {
    const id = D.uid('tn'), fl = C.data.byId('caramel'), body = 'M70 150V330A110 28 0 0 0 290 330V150Z';
    return `<svg class="tin-svg" viewBox="0 0 360 380" role="img" aria-label="La Tin Caramel">
<defs><clipPath id="${id}"><path d="${body}"/></clipPath></defs>
<ellipse cx="180" cy="356" rx="118" ry="14" fill="#000" opacity=".12"/>
<path d="${body}" fill="#F8C8D8"/>
<g clip-path="url(#${id})">${D.patterns.zigzag(D.patFor(fl), 360, 380, 0.34).replace(/<rect[^>]*\/>/, '<rect width="360" height="380" fill="#F8C8D8"/>')}
  <path d="M70 150H290V330H70Z" fill="none"/></g>
<path d="${body}" fill="none" stroke="${K.ink}" stroke-width="5" stroke-linejoin="round"/>
<ellipse cx="180" cy="150" rx="110" ry="26" fill="#F8C8D8" stroke="${K.ink}" stroke-width="5"/>
<ellipse cx="180" cy="150" rx="96" ry="18" fill="#F3C25B" stroke="${K.ink}" stroke-width="3"/>
<g clip-path="url(#${id}t)"></g>
<clipPath id="${id}t"><path d="M84 152C80 96 120 40 180 36C240 40 280 96 276 152Z"/></clipPath>
<g clip-path="url(#${id}t)"><rect x="70" y="30" width="220" height="130" fill="url(#popTex)"/></g>
<path d="M84 152C80 96 120 40 180 36C240 40 280 96 276 152" fill="none" stroke="${K.ink}" stroke-width="4" stroke-linecap="round"/>
${D.useWord(86, 178, 188, K.cream, '#5E1F3B', 6, K.ink)}
${D.ovalBadge({ cx: 180, cy: 296, rx: 66, ry: 34, fill: K.blue, ink: K.cream, line1: 'CARAMEL', line2: 'Beurre Salé', small: false, fs1: 19, fs2: 11 })}
</svg>`;
  };

  /* ------------------------------------------------------------ gift box */
  D.giftbox = () => `<svg class="giftbox-svg" viewBox="0 0 420 320" role="img" aria-label="Box Snack Energy">
<ellipse cx="210" cy="298" rx="180" ry="12" fill="#000" opacity=".12"/>
<rect x="34" y="112" width="352" height="180" rx="10" fill="url(#checkBlue)" stroke="${K.ink}" stroke-width="5"/>
<rect x="22" y="58" width="376" height="66" rx="10" fill="url(#checkBlue)" stroke="${K.ink}" stroke-width="5"/>
<rect x="22" y="112" width="376" height="14" fill="${K.pink}" stroke="${K.ink}" stroke-width="5"/>
${D.useWord(58, 134, 200, K.cream, null, 0, K.ink)}
<g transform="rotate(-12 336 240)"><ellipse cx="336" cy="240" rx="52" ry="22" fill="${K.pink}" stroke="${K.ink}" stroke-width="4"/><text x="336" y="246" text-anchor="middle" font-family="'League Gothic',Impact,sans-serif" font-size="26" letter-spacing="1" fill="${K.red}">SHHHH!</text></g>
<use href="#s-quat" x="56" y="226" width="52" height="52" fill="${K.red}"/><use href="#s-icon" x="66" y="233" width="32" height="36"/>
</svg>`;

  /* ------------------------------------------------------------ pouches / trio / discovery visuals */
  D.stack = (ids, o = {}) => {
    const list = ids.map((id) => C.data.byId(id));
    const w = 130, n = list.length, step = n > 1 ? Math.min(w * 0.8, (330 - w) / (n - 1)) : 0, tw = w + step * (n - 1);
    const items = list.map((fl, i) => `<g transform="translate(${f(i * step)} ${f(Math.abs(i - (n - 1) / 2) * 6)}) rotate(${f((i - (n - 1) / 2) * 5)} ${w / 2} 240)"><svg x="0" y="0" width="${w}" height="${f(w * 798 / 488)}" viewBox="0 0 488 798">${D.pouch(fl, { flat: true }).replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '')}</svg></g>`).join('');
    return `<svg class="stack-svg" viewBox="-6 -6 ${f(tw + 12)} ${f(w * 798 / 488 + 24)}" role="img" aria-label="${o.label || 'Pack de pochons'}">${items}</svg>`;
  };

  /* ------------------------------------------------------------ product image (any product id) */
  D.product = (id, o = {}) => {
    const p = C.data.byId(id);
    if (!p) return '';
    if (p.kind === 'pouch') return D.pouch(p, o);
    switch (id) {
      case 'trio': return D.stack(o.picks && o.picks.length ? o.picks : ['cheddar', 'caramel', 'nature'], { label: 'Box Soirée Ciné' });
      case 'discovery': return D.stack(p.contents, { label: 'Pack Découverte' });
      case 'tin': return D.tin();
      case 'giftbox': return D.giftbox();
      case 'jersey': return D.jersey({ name: o.name, num: o.num, view: o.view || 'front' });
      case 'cap': return D.cap();
      case 'plush': return D.plush();
      case 'stickers': return D.stickers();
      default: return '';
    }
  };

  /* ------------------------------------------------------------ badges (loyalty stickers) */
  D.badge = (b, on = true) => `<svg class="badge-svg${on ? '' : ' off'}" viewBox="0 0 120 120" role="img" aria-label="${U.esc(b.name)}">
<g ${on ? '' : 'opacity=".28"'}><use href="#s-quat" x="6" y="6" width="108" height="108" fill="${on ? K.blue : '#9a98a8'}" stroke="#fff" stroke-width="8" paint-order="stroke"/>
<text x="60" y="${b.glyph.length > 1 ? 74 : 78}" text-anchor="middle" font-family="'League Gothic',Impact,sans-serif" font-size="${b.glyph.length > 1 ? 40 : 54}" fill="${K.cream}">${U.esc(b.glyph)}</text></g></svg>`;
  // a stamp (red quatrefoil with the gull) for the loyalty card, and an empty slot
  D.stampOn = () => `<svg viewBox="0 0 301 301" class="stamp on"><use href="#s-quat" width="301" height="301" fill="${K.red}"/><g transform="translate(150 20) scale(.62)"><use href="#s-icon" x="-190" y="-6" width="380" height="420" style="clip-path:inset(0 0 8% 0)"/></g></svg>`;
  D.stampOff = (n) => `<svg viewBox="0 0 301 301" class="stamp off"><use href="#s-quat" x="6" y="6" width="289" height="289" fill="none" stroke="${K.blue}" stroke-width="7"/><text x="150" y="176" text-anchor="middle" font-family="'League Gothic',Impact,sans-serif" font-size="92" fill="${K.blue}" fill-opacity=".35">${n}</text></svg>`;
  D.gift = () => `<svg viewBox="0 0 301 301" class="stamp gift"><use href="#s-quat" width="301" height="301" fill="${K.blue}"/><text x="150" y="196" text-anchor="middle" font-family="'League Gothic',Impact,sans-serif" font-size="150" fill="${K.cream}">+1</text></svg>`;

  /* small popcorn puff as inline svg (for icons, bullets) */
  D.puffIcon = (i = 0, s = 28) => `<svg width="${s}" height="${s}" viewBox="-26 -26 52 52" aria-hidden="true"><use href="#pf${i}" x="-24" y="-24" width="48" height="48"/></svg>`;
})((window.Cornsty = window.Cornsty || {}));
