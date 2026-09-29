/* Cornsty - drawing kit (1/2): palette, brand patterns, quatrefoil, wordmark, icon, oval badges, popcorn.
   All artwork is generated as SVG markup strings. Brand pieces (mascot, icon, wordmark, quatrefoil) come from the REAL vectors
   of the brand book (art-data.js); the six flavour patterns were rebuilt from the brand-book tiles (measured: periods, angles, colours). */
(function (C) {
  'use strict';
  const D = (C.draw = {});
  const A = C.art;
  let n = 0;
  D.uid = (p = 'id') => p + '-' + (++n).toString(36);
  const f = (v) => +v.toFixed(2);

  D.COL = { ink: '#26232b', cream: '#F8F2E0', blue: '#788CE3', red: '#DE3F39', navy: '#2B3690', deep: '#3E52CF', pale: '#A9B7F2', orange: '#FF8A1E', yellow: '#FFD65C', pink: '#F5A3C7', teal: '#2FB59B', paper: '#FBF8EE' };
  const K = D.COL;

  /* -------------------------------------------------- generic helpers */
  D.parts = (parts, cls) => parts.map((p) => `<path class="r-${p.role}${cls ? ' ' + cls : ''}" d="${p.d}"/>`).join('');
  D.quatPath = () => A.quat.d;                                 // 301 x 301
  D.quat = (fill, size = 301, x = 0, y = 0) => `<path transform="translate(${x} ${y}) scale(${f(size / 301)})" d="${A.quat.d}" fill="${fill}"/>`;
  D.wordmark = (fill = K.cream, mark = K.ink, extra = '') => `<g>${A.wordmark.letters.map((p) => `<path d="${p.d}" fill="${fill}" ${extra}/>`).join('')}<path d="${A.wordmark.mark.d}" fill="${mark}"/></g>`; // 866 x 523
  D.WM = { w: A.wordmark.w, h: A.wordmark.h };

  /* -------------------------------------------------- the six brand patterns  (return markup filling [0,w]x[0,h]) */
  const poly = (pts) => 'M' + pts.map((p) => f(p[0]) + ' ' + f(p[1])).join('L') + 'Z';
  D.patterns = {
    // diamonds 116 x 201 (60deg), two colours alternate
    harlequin(c, w, h, s = 1) {
      const W = 116 * s, H = 201 * s; let d = '';
      for (let j = -1; j <= Math.ceil(h / H); j++) for (let i = -1; i <= Math.ceil(w / W); i++) { const cx = (i + 0.5) * W, cy = (j + 0.5) * H; d += poly([[cx, cy - H / 2], [cx + W / 2, cy], [cx, cy + H / 2], [cx - W / 2, cy]]); }
      return `<rect width="${w}" height="${h}" fill="${c.a}"/><path d="${d}" fill="${c.b}"/>`;
    },
    // vertical hourglasses on a staggered lattice (waffle)
    hex(c, w, h, s = 1) {
      const P = 243 * s, pts = [[0, -88], [60, -60], [32, 0], [60, 60], [0, 88], [-60, 60], [-32, 0], [-60, -60]]; let d = '';
      for (let j = -1; j <= Math.ceil(h / (P / 2)) + 1; j++) for (let i = -1; i <= Math.ceil(w / P) + 1; i++) { const cx = (i + (j & 1) * 0.5) * P + P * 0.42, cy = j * P / 2 + P * 0.2; d += poly(pts.map(([x, y]) => [cx + x * s, cy + y * s])); }
      return `<rect width="${w}" height="${h}" fill="${c.b}"/><path d="${d}" fill="${c.a}"/>`;
    },
    // orange right triangles on a red ground, diagonal continues across rows
    triangles(c, w, h, s = 1) {
      const cw = 110 * s, H = 181 * s; let d = '';
      for (let r = -1; r <= Math.ceil(h / H); r++) for (let k = -1; k <= Math.ceil(w / cw); k++) {
        if ((k & 1) !== (r & 1)) continue; const x0 = k * cw, y0 = r * H;
        d += (r & 1) ? poly([[x0, y0], [x0 + cw, y0], [x0 + cw, y0 + H]]) : poly([[x0, y0], [x0 + cw, y0 + H], [x0, y0 + H]]);
      }
      return `<rect width="${w}" height="${h}" fill="${c.a}"/><path d="${d}" fill="${c.b}"/>`;
    },
    // checkerboard, square 125 (base blue, dark navy squares)
    checker(c, w, h, s = 1) {
      const q = 125.5 * s; let d = '';
      for (let j = 0; j <= Math.ceil(h / q); j++) for (let i = 0; i <= Math.ceil(w / q); i++) if ((i + j) % 2 === 0) d += `M${f(i * q)} ${f(j * q)}h${f(q)}v${f(q)}h${f(-q)}Z`;
      return `<rect width="${w}" height="${h}" fill="${c.a}"/><path d="${d}" fill="${c.b}"/>`;
    },
    // chevrons: half wavelength 164, amplitude 107, band 76, repeat 163
    zigzag(c, w, h, s = 1) {
      const hw = 164 * s, amp = 107 * s, t = 76 * s, P = 163 * s; let d = '';
      for (let k = -2; k <= Math.ceil(h / P) + 1; k++) {
        const top = [], bot = [];
        for (let m = -1; m <= Math.ceil(w / hw) + 1; m++) { const y = k * P + (m & 1 ? amp : 0); top.push([m * hw, y]); bot.push([m * hw, y + t]); }
        d += poly(top.concat(bot.reverse()));
      }
      return `<rect width="${w}" height="${h}" fill="${c.a}"/><path d="${d}" fill="${c.b}"/>`;
    },
    // fish scales: lancet arches of width 112, alternating rows dark / light
    scallops(c, w, h, s = 1) {
      const sw = 112 * s, ah = sw * 0.866; let out = `<rect width="${w}" height="${h}" fill="${c.a}"/>`;
      for (let r = 0; r <= Math.ceil(h / ah) + 1; r++) {
        let d = ''; const ya = r * ah - ah, yb = ya + ah;
        for (let i = -1; i <= Math.ceil(w / sw) + 1; i++) { const cx = (i + (r & 1) * 0.5) * sw; d += `M${f(cx - sw / 2)} ${f(yb + ah)}L${f(cx - sw / 2)} ${f(yb)}A${f(sw)} ${f(sw)} 0 0 1 ${f(cx)} ${f(ya)}A${f(sw)} ${f(sw)} 0 0 1 ${f(cx + sw / 2)} ${f(yb)}L${f(cx + sw / 2)} ${f(yb + ah)}Z`; }
        out += `<path d="${d}" fill="${r & 1 ? c.a : c.b}"/>`;
      }
      return out;
    },
  };
  // palette for each flavour pattern: a = ground, b = shapes
  D.patFor = (fl) => {
    const c = fl.colors;
    switch (fl.pattern) {
      case 'harlequin': return { a: '#FF8300', b: '#FFDD5C' };
      case 'hex': return { a: '#BFD95E', b: '#87932A' };
      case 'triangles': return { a: '#E23D38', b: '#FF8300' };
      case 'checker': return { a: '#7888E8', b: '#3858A8' };
      case 'zigzag': return { a: '#F8C8D8', b: '#884868' };
      case 'scallops': return { a: '#E23D38', b: '#881818' };
      default: return { a: c.a, b: c.b };
    }
  };
  D.fillPattern = (fl, w, h, s = 0.5) => D.patterns[fl.pattern](D.patFor(fl), w, h, s);
  // a standalone swatch (used for the stall paint, chat, chips ...)
  D.swatch = (fl, w = 120, h = 120, s = 0.35, r = 14) => { const id = D.uid('sw'); return `<svg class="swatch" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true"><clipPath id="${id}"><rect width="${w}" height="${h}" rx="${r}"/></clipPath><g clip-path="url(#${id})">${D.fillPattern(fl, w, h, s)}</g></svg>`; };

  /* -------------------------------------------------- oval flavour badge (the sticker on the packs) */
  D.ovalBadge = ({ cx = 0, cy = 0, rx = 150, ry = 96, fill, ink, line1, line2, small = true, id = D.uid('ob'), fs1, fs2 }) => {
    const ir = (v, d) => v - d;
    const top = `M${cx - rx + 22} ${cy}A${ir(rx, 22)} ${ir(ry, 22)} 0 0 1 ${cx + rx - 22} ${cy}`;
    const bot = `M${cx - rx + 14} ${cy}A${ir(rx, 14)} ${ir(ry, 14)} 0 0 0 ${cx + rx - 14} ${cy}`;
    const two = !!line2;
    const s1 = fs1 || (two ? 46 : 52), s2 = fs2 || 30;
    const ty = two ? cy - 6 : cy + 14;
    return `<g class="oval-badge">
      <ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${fill}"/>
      <ellipse cx="${cx}" cy="${cy}" rx="${rx - 9}" ry="${ry - 9}" fill="none" stroke="${ink}" stroke-width="3.2"/>
      ${small ? `<defs><path id="${id}t" d="${top}"/><path id="${id}b" d="${bot}"/></defs>
      <text font-family="Inter,sans-serif" font-weight="500" font-size="17" letter-spacing="2.4" fill="${ink}" text-anchor="middle"><textPath href="#${id}t" startOffset="50%">100% FRENCH CORN</textPath></text>
      <text font-family="Inter,sans-serif" font-weight="500" font-size="17" letter-spacing="2.4" fill="${ink}" text-anchor="middle"><textPath href="#${id}b" startOffset="50%">GOURMET POPCORN</textPath></text>` : ''}
      <text x="${cx}" y="${ty}" text-anchor="middle" font-family="Inter,sans-serif" font-weight="500" font-size="${s1}" letter-spacing="-1" fill="${ink}">${line1}</text>
      ${two ? `<text x="${cx}" y="${cy + 30}" text-anchor="middle" font-family="Inter,sans-serif" font-weight="400" font-size="${s2}" letter-spacing="-.4" fill="${ink}">${line2}</text>` : ''}
    </g>`;
  };

  /* -------------------------------------------------- popcorn puffs: symbol defs + a seamless texture pattern */
  // 6 puff variants, radius ~20 around (0,0)
  const PUFFS = [
    [[-9, 2, 11], [6, -6, 12], [10, 7, 10], [-2, 10, 9], [-1, -1, 12]],
    [[-8, -3, 12], [8, -4, 11], [0, 8, 12], [-10, 8, 8], [11, 8, 8]],
    [[0, -8, 12], [-10, 4, 11], [10, 3, 11], [0, 5, 10]],
    [[-6, -6, 10], [7, -8, 9], [-9, 6, 10], [9, 5, 11], [0, 1, 11], [1, 12, 7]],
    [[-10, 0, 10], [4, -8, 11], [11, 4, 10], [-2, 9, 11], [1, 1, 9]],
    [[-4, -9, 10], [9, -3, 11], [-10, 4, 11], [3, 8, 11], [-3, 0, 9]],
  ];
  D.PUFFS = PUFFS;
  D.puffSymbols = (prefix = 'pf') => PUFFS.map((cs, i) => {
    const ring = cs.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r + 2.6}"/>`).join('');
    const fillc = cs.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}"/>`).join('');
    const k = cs[cs.length - 1];
    return `<symbol id="${prefix}${i}" viewBox="-24 -24 48 48" overflow="visible"><g fill="${K.ink}">${ring}</g><g fill="#FFF4D6">${fillc}</g><g fill="#F6D48A" opacity=".7"><circle cx="${k[0] - 2}" cy="${k[1] + 3}" r="${k[2] * 0.55}"/></g><circle cx="${k[0] + 1}" cy="${k[1] + 5}" r="3.2" fill="#F2A93B"/></symbol>`;
  }).join('');

  /* -------------------------------------------------- mascot pieces */
  // the front-facing icon (quatrefoil + head) - real vectors. viewBox is -185 0 371 400
  D.icon = (opts = {}) => `<svg class="${opts.cls || 'icon-gull'}" viewBox="-190 -6 380 420" aria-hidden="true"><use href="#s-icon" x="-190" y="-6" width="380" height="420"/></svg>`;
  // any pose sprite -> svg group centred on (0,0) at its bottom
  D.pose = (name) => `<g class="pose-${name}">${D.parts(A[name].parts)}</g>`;
})((window.Cornsty = window.Cornsty || {}));
