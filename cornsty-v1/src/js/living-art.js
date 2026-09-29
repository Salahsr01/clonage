/* Cornsty - the living kiosk, part 2/4: the ART. Pure builders that return SVG / HTML strings (no DOM access, no state).
   Same visual language as the rest of the site: flat colours, thick ink outline, the brand palette, the quatrefoil. */
(function (C) {
  'use strict';
  const D = C.draw, K = D.COL, M = C.livingModel;
  const A = (C.livingArt = {});
  const f = (v) => +(+v).toFixed(1);
  const OUT = (w = 5) => `stroke="${K.ink}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"`;
  const SPARK = 'M0 -10Q1.8 -1.8 10 0Q1.8 1.8 0 10Q-1.8 1.8 -10 0Q-1.8 -1.8 0 -10Z';
  const HEART = 'M0 9C-16 -2 -13 -15 -5 -15C-1 -15 0 -12 0 -10C0 -12 1 -15 5 -15C13 -15 16 -2 0 9Z';
  const CLOUD = 'M0 60Q-6 24 32 24Q40-4 82 8Q116-20 150 12Q196 4 198 44Q214 62 190 72H16Q-4 72 0 60Z';
  const FONT = "font-family=\"'League Gothic',Impact,sans-serif\"";
  const MONO = "font-family=\"'IBM Plex Mono',ui-monospace,monospace\"";

  /* ================================================================== far layers */
  // The sky overlay: its own gradient (recoloured through the day), sun, moon (real phase), stars, clouds, birds, fireworks.
  // Coordinates are the sky layer's (viewBox -1600..4800); the part you can actually see (the strip left of the kiosk at the machine station) is x in [-880, -450], y in [330, 690].
  A.CLOUDS = [[-1000, 380, 1.2], [-650, 470, 0.8], [-260, 350, 1.05], [150, 440, 0.9], [560, 370, 1.3], [900, 470, 0.85], [1250, 390, 1.1], [-1300, 450, 1]];
  A.sky = () => {
    const r = M.rng(11);
    let stars = '';
    for (let i = 0; i < 74; i++) {
      const x = r() < 0.6 ? -880 + r() * 620 : -1300 + r() * 2900, y = 336 + Math.pow(r(), 1.4) * 340, s = 0.4 + r() * 1.05, tw = r() < 0.32;
      stars += `<path${tw ? ` class="lv-tw" style="animation-delay:${(-r() * 5).toFixed(1)}s"` : ''} transform="translate(${f(x)} ${f(y)}) scale(${s.toFixed(2)})" d="${SPARK}" fill="${r() < 0.14 ? '#FFC2DC' : '#FFF3C4'}"/>`;
    }
    const clouds = A.CLOUDS.map(([x, y, s], i) => `<g class="lv-cl cloud c${i % 3}" data-i="${i}" transform="translate(${x} ${y}) scale(${s})"><path d="${CLOUD}" stroke="${K.ink}" stroke-width="4" stroke-linejoin="round"/></g>`).join('');
    const birds = [[-700, 400], [-560, 372], [-620, 452], [640, 390], [780, 430]].map(([x, y], i) => `<path class="sky-bird b${i % 3}" d="M${x - 22} ${y}Q${x - 9} ${y - 15} ${x} ${y}Q${x + 9} ${y - 15} ${x + 22} ${y}" fill="none" stroke="${K.ink}" stroke-width="4" stroke-linecap="round"/>`).join('');
    return `<div class="layer lv-layer" id="L-skyfx" data-par="0.05"><svg class="lvsky-svg" viewBox="-1600 0 6400 1300" preserveAspectRatio="none" aria-hidden="true">
<defs>
  <linearGradient id="lv-skyg" x1="0" y1="0" x2="0" y2="1"><stop id="lv-s0" offset="0" stop-color="#8FA3F0"/><stop id="lv-s1" offset=".55" stop-color="#BFCBF8"/><stop id="lv-s2" offset="1" stop-color="#F3EEDF"/></linearGradient>
  <radialGradient id="lv-sunh" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#FFF1B8" stop-opacity=".85"/><stop offset=".45" stop-color="#FFD98A" stop-opacity=".28"/><stop offset="1" stop-color="#FFD98A" stop-opacity="0"/></radialGradient>
  <radialGradient id="lv-moonh" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#EDEBFF" stop-opacity=".5"/><stop offset=".5" stop-color="#B9C0FF" stop-opacity=".16"/><stop offset="1" stop-color="#B9C0FF" stop-opacity="0"/></radialGradient>
  <clipPath id="lv-moonclip"><path id="lv-moonlit-c" d="M0 0"/></clipPath>
</defs>
<rect x="-1600" y="0" width="6400" height="1300" fill="url(#lv-skyg)"/>
<g id="lv-stars" style="opacity:0">${stars}</g>
<g id="lv-sun" class="lv-mv" style="opacity:0"><circle r="330" fill="url(#lv-sunh)"/><g class="sun-spin"><use href="#s-quat" x="-78" y="-78" width="156" height="156" fill="#FFE07A" ${OUT(5)}/></g></g>
<g id="lv-moon" class="lv-mv" style="opacity:0"><circle r="170" fill="url(#lv-moonh)"/><circle r="60" fill="#4C5399"/><path id="lv-moonlit" d="M0 0" fill="${K.cream}"/><g clip-path="url(#lv-moonclip)" fill="#DDD3B2"><circle cx="-14" cy="-16" r="11"/><circle cx="18" cy="8" r="8"/><circle cx="-8" cy="26" r="6"/><circle cx="22" cy="-26" r="5"/></g><circle r="60" fill="none" ${OUT(5)}/></g>
<g id="lv-clouds" style="fill:#F8F2E0">${clouds}</g>
<g id="lv-birds">${birds}</g>
<g id="lv-fx"></g>
</svg></div>`;
  };
  // the lit part of the moon: k = illuminated fraction, waxing = lit on the right
  A.moonPath = (k, waxing, r = 60) => {
    const rx = r * Math.abs(1 - 2 * k), sweep = k < 0.5 ? 0 : 1;
    const d = `M0 ${-r}A${r} ${r} 0 0 1 0 ${r}A${f(rx)} ${r} 0 0 ${sweep} 0 ${-r}Z`;
    return waxing ? d : `M0 ${-r}A${r} ${r} 0 0 0 0 ${r}A${f(rx)} ${r} 0 0 ${1 - sweep} 0 ${-r}Z`;
  };
  // fireworks: a burst = rays + sparks, animated by CSS (scale up, fade)
  A.firework = (x, y, col, delay) => {
    const rays = Array.from({ length: 12 }, (_, i) => { const a = (i / 12) * 6.283; return `<path d="M${f(Math.cos(a) * 30)} ${f(Math.sin(a) * 30)}L${f(Math.cos(a) * 84)} ${f(Math.sin(a) * 84)}" stroke="${col}" stroke-width="7" stroke-linecap="round"/><circle cx="${f(Math.cos(a + 0.26) * 104)}" cy="${f(Math.sin(a + 0.26) * 104)}" r="5" fill="${K.cream}"/>`; }).join('');
    return `<g transform="translate(${x} ${y})"><g class="lv-burst" style="animation-delay:${delay}s">${rays}<circle r="8" fill="${K.cream}"/></g></g>`;
  };
  A.bats = () => [[-520, 430, 0], [-380, 380, 0.7], [700, 410, 0.3], [860, 460, 1.1]].map(([x, y, d]) => `<g transform="translate(${x} ${y})"><g class="lv-bat" style="animation-delay:${-d}s"><path d="M0 0Q-10 -14 -30 -10Q-24 -2 -18 2Q-10 -2 -6 4Q-2 -2 0 2Q2 -2 6 4Q10 -2 18 2Q24 -2 30 -10Q10 -14 0 0Z" fill="${K.ink}"/></g></g>`).join('');

  // the sea layer: a small sailboat crossing the horizon (y 690), a lantern at its mast at night
  A.boat = () => `<g id="lv-boat" class="lv-anim"><g class="lv-drift"><g transform="translate(-1300 690)">
  <path d="M-42 -6H46L34 12H-30Z" fill="${K.red}" ${OUT(4)}/><path d="M0 -8V-92" stroke="${K.ink}" stroke-width="4" stroke-linecap="round"/>
  <path d="M4 -88L4 -16L46 -16Z" fill="${K.cream}" ${OUT(4)}/><path d="M-4 -80L-4 -16L-36 -16Z" fill="${K.pale}" ${OUT(4)}/>
  <circle class="lv-boat-l" cx="0" cy="-96" r="5" fill="#FFE07A" style="opacity:0"/></g></g></g>`;
  // the dunes layer: two tiny beach walkers (silhouettes) crossing very slowly
  A.walkers = () => `<g id="lv-walkers" class="lv-anim"><g class="lv-drift2"><g transform="translate(-1500 905)">
  <g fill="${K.ink}"><circle cx="0" cy="-34" r="6"/><path d="M-6 -27H6L8 -8H3L2 0H-2L-3 -8H-8Z"/><circle cx="30" cy="-30" r="5"/><path d="M25 -24H35L37 -6H32L31 0H28L27 -6H23Z"/></g>
  <path d="M8 -20Q16 -22 24 -18" stroke="${K.ink}" stroke-width="3" fill="none" stroke-linecap="round"/></g></g></g>`;

  /* ================================================================== kiosk overlay (main layer): tint + glow */
  // The tint is drawn ONLY where the kiosk itself is painted (awning bar, awning + wall + posts, the deck), so its edges are the kiosk's own
  // edges: the sea, the dunes and the sky have their own tints and are never tinted twice. Rects do not overlap (translucent overlaps would show).
  A.tint = () => `<svg id="lv-tint" class="wsvg lv-tint" viewBox="0 0 3200 1300" aria-hidden="true"><rect x="418" y="94" width="2764" height="36"/><rect x="440" y="130" width="2720" height="990"/><rect x="-900" y="1120" width="5000" height="700"/></svg>`;
  // Lights that must stay bright above the night tint. Everything is a plain shape (no SVG filters: they are expensive on phones).
  A.bulbs = (cols = ['#FFE9A6']) => {
    let bulbs = '';
    for (let i = 0; i < 54; i++) { const x = 470 + i * 50, c = cols[i % cols.length]; bulbs += `<circle cx="${x}" cy="402" r="26" fill="${c}" opacity=".22"/><circle cx="${x}" cy="402" r="11" fill="${c}" opacity=".85"/><circle cx="${x}" cy="402" r="5" fill="#FFFBE6"/>`; }
    return bulbs;
  };
  A.glow = (o = {}) => {
    const bulbs = A.bulbs(o.bulbColors);
    return `<svg id="lv-glow" class="wsvg lv-glow" viewBox="0 0 3200 1300" aria-hidden="true">
<defs>
  <radialGradient id="lvg-warm" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#FFD98A" stop-opacity=".62"/><stop offset=".55" stop-color="#FFC15E" stop-opacity=".18"/><stop offset="1" stop-color="#FFC15E" stop-opacity="0"/></radialGradient>
  <radialGradient id="lvg-soft" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#FFF3C8" stop-opacity=".34"/><stop offset="1" stop-color="#FFF3C8" stop-opacity="0"/></radialGradient>
  <linearGradient id="lvg-wash" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFD98A" stop-opacity=".3"/><stop offset="1" stop-color="#FFD98A" stop-opacity="0"/></linearGradient>
</defs>
<g id="lvg-lights" style="opacity:0">
  <rect x="480" y="388" width="2240" height="330" fill="url(#lvg-wash)"/>
  <ellipse cx="790" cy="640" rx="230" ry="300" fill="url(#lvg-warm)"/>
  <circle cx="790" cy="452" r="120" fill="url(#lvg-warm)"/>
  <ellipse cx="2300" cy="580" rx="300" ry="220" fill="url(#lvg-soft)"/>
  <g id="lvg-bulbs">${bulbs}</g>
  <g id="lvg-lantern"></g>
  <g id="lvg-sign"></g>
  <g id="lvg-drop"></g>
  <g id="lvg-props"></g>
</g>
</svg>`;
  };

  /* ================================================================== physical decor on the wall (world-back) */
  A.clock = (x = 2030, y = 488) => {
    let ticks = '';
    for (let i = 0; i < 12; i++) { const a = (i / 12) * 6.283, r1 = i % 3 ? 25 : 22, r2 = 29; ticks += `<path d="M${f(Math.sin(a) * r1)} ${f(-Math.cos(a) * r1)}L${f(Math.sin(a) * r2)} ${f(-Math.cos(a) * r2)}" stroke="${K.ink}" stroke-width="${i % 3 ? 2.5 : 4}" stroke-linecap="round"/>`; }
    return `<g id="lv-clock" class="hot" role="button" tabindex="-1" aria-label="L’horloge du kiosque" transform="translate(${x} ${y})"><g class="lift">
  <circle r="40" fill="${K.red}" ${OUT(5)}/><circle r="32" fill="${K.paper}" stroke="${K.ink}" stroke-width="3"/>${ticks}
  <g id="lv-hh"><path d="M0 5V-16" stroke="${K.ink}" stroke-width="5" stroke-linecap="round"/></g>
  <g id="lv-mh"><path d="M0 6V-25" stroke="${K.ink}" stroke-width="3.5" stroke-linecap="round"/></g>
  <circle r="4.5" fill="${K.red}" stroke="${K.ink}" stroke-width="2.5"/>
</g></g>`;
  };
  // the sign hanging on the left post: "OUVERT" by day, a glowing neon at night; it says "CHEZ <name>" for Mouette / Légende members
  A.signBody = (x = 350, y = 500, w = 170) => `<g id="lv-sign" class="hot" role="button" tabindex="-1" aria-label="L’enseigne du kiosque" transform="translate(${x} ${y})"><g class="lift">
  <path d="M${w / 2 + 90} -34H${-w / 2 + 6}" stroke="${K.ink}" stroke-width="6" stroke-linecap="round"/><path d="M${-w / 2 + 26} -34V-2M${w / 2 - 26} -34V-2" stroke="${K.ink}" stroke-width="4"/>
  <rect x="${-w / 2}" y="-6" width="${w}" height="66" rx="14" fill="#1E2050" ${OUT(5)}/><rect x="${-w / 2 + 7}" y="1" width="${w - 14}" height="52" rx="9" fill="none" stroke="#5A62B8" stroke-width="2" stroke-dasharray="3 5"/>
  <text id="lv-sign-t" x="0" y="44" text-anchor="middle" ${FONT} font-size="46" letter-spacing="3" fill="#5A62B8">OUVERT</text>
</g></g>`;
  A.signGlow = (text, x = 350, y = 500, tone = '#FF7BAC') => `<g transform="translate(${x} ${y})">
  <text x="0" y="44" text-anchor="middle" ${FONT} font-size="46" letter-spacing="3" fill="none" stroke="${tone}" stroke-width="16" stroke-opacity=".16" stroke-linejoin="round">${text}</text>
  <text x="0" y="44" text-anchor="middle" ${FONT} font-size="46" letter-spacing="3" fill="none" stroke="${tone}" stroke-width="8" stroke-opacity=".32" stroke-linejoin="round">${text}</text>
  <text x="0" y="44" text-anchor="middle" ${FONT} font-size="46" letter-spacing="3" fill="#FFF2F7">${text}</text></g>`;
  // weekly drop board (chalk on a wooden frame), hung from the awning between the menu and the vestiaire
  A.dropBody = (x = 2584, y = 430) => `<g id="lv-drop" class="hot" role="button" tabindex="-1" aria-label="Le prochain drop" transform="translate(${x} ${y})"><g class="lift">
  <path d="M-52 -46L-42 6M52 -46L42 6" stroke="${K.ink}" stroke-width="4"/>
  <rect x="-66" y="0" width="132" height="152" rx="10" fill="#C89A5B" ${OUT(5)}/><rect x="-55" y="11" width="110" height="130" rx="5" fill="${K.ink}"/>
  <text x="0" y="52" text-anchor="middle" ${FONT} font-size="42" letter-spacing="2" fill="${K.cream}">DROP</text>
  <text id="lv-drop-n" x="0" y="76" text-anchor="middle" font-family="Inter,sans-serif" font-size="13" font-weight="600" fill="#CFD5F6">Drop d’automne</text>
  <path d="M-38 88H38" stroke="#CFD5F6" stroke-width="1.5" stroke-dasharray="2 4" opacity=".6"/>
  <text id="lv-drop-t" x="0" y="112" text-anchor="middle" ${MONO} font-size="15.5" font-weight="500" fill="${K.yellow}">--</text>
  <text id="lv-drop-s" x="0" y="131" text-anchor="middle" font-family="Inter,sans-serif" font-size="10" fill="#9EA6D8" letter-spacing="1">PROCHAIN DROP</text>
</g></g>`;
  A.dropGlow = (x = 2584, y = 430) => `<g transform="translate(${x} ${y})"><rect x="-60" y="4" width="120" height="144" rx="8" fill="none" stroke="${K.yellow}" stroke-width="10" stroke-opacity=".18"/><rect x="-60" y="4" width="120" height="144" rx="8" fill="none" stroke="${K.yellow}" stroke-width="3" stroke-opacity=".7" class="lv-drop-edge"/></g>`;

  /* ================================================================== deck life: the crab */
  A.crab = (x = 230, y = 1146) => `<g id="lv-crab" class="hot" role="button" tabindex="-1" aria-label="Un crabe" transform="translate(${x} ${y})"><g class="lv-walk"><g class="lift">
  <g fill="none" stroke="${K.ink}" stroke-width="4" stroke-linecap="round"><path d="M-18 6L-32 14M-14 10L-26 22M14 10L26 22M18 6L32 14"/></g>
  <path d="M-30 -8Q-40 -24 -28 -30Q-18 -22 -22 -8" fill="${K.red}" ${OUT(4)}/><path d="M30 -8Q40 -24 28 -30Q18 -22 22 -8" fill="${K.red}" ${OUT(4)}/>
  <ellipse cx="0" cy="2" rx="26" ry="16" fill="${K.red}" ${OUT(5)}/><path d="M-10 -12V-22M10 -12V-22" stroke="${K.ink}" stroke-width="4"/>
  <circle cx="-10" cy="-25" r="5" fill="#fff" ${OUT(3)}/><circle cx="10" cy="-25" r="5" fill="#fff" ${OUT(3)}/><circle cx="-10" cy="-25" r="2" fill="${K.ink}"/><circle cx="10" cy="-25" r="2" fill="${K.ink}"/>
</g></g></g>`;

  /* ================================================================== counter (front layer): loyalty decor + feast props */
  // one sticker per badge earned, stuck on the counter front (the brand badge art, slightly rotated)
  A.stickers = (defs, earned) => {
    const rot = [-7, 5, -4, 8, -9, 4, -5, 7, -3];
    // each sticker gets its own brand colours so they stay readable on the blue checkered counter
    const pal = [[K.red, K.cream], [K.yellow, K.ink], [K.teal, K.cream], [K.pink, K.ink], [K.orange, K.ink], ['#3E52CF', K.cream], [K.cream, K.red], [K.red, K.cream], [K.yellow, K.ink]];
    return defs.map((b, i) => {
      if (!earned[b.id]) return '';
      const x = 1730 + i * 92, y = 996, [bg, fg] = pal[i % pal.length];
      const art = D.badge(b).replace('<svg ', '<svg width="120" height="120" ').replace(`fill="${K.blue}"`, `fill="${bg}"`).replace(`fill="${K.cream}"`, `fill="${fg}"`);
      return `<g transform="translate(${x} ${y}) rotate(${rot[i % rot.length]} 40 40)"><g transform="scale(.68)"><ellipse cx="60" cy="112" rx="46" ry="7" fill="#1b1820" opacity=".25"/>${art}</g></g>`;
    }).join('');
  };
  A.trophy = (x = 1930, y = 880) => `<g id="lv-trophy" transform="translate(${x} ${y})">
  <path d="M-26 0L-32 -66H32L26 0Z" fill="${K.yellow}" ${OUT(5)}/><path d="M-20 -6L-24 -60M0 -6V-60M20 -6L24 -60" stroke="${K.orange}" stroke-width="5"/>
  <use href="#pf1" x="-30" y="-108" width="44" height="44"/><use href="#pf3" x="-6" y="-116" width="46" height="46"/><use href="#pf0" x="-18" y="-92" width="40" height="40"/>
  <path d="M-32 -66H32" stroke="${K.ink}" stroke-width="5"/><ellipse cx="0" cy="2" rx="34" ry="6" fill="#1b1820" opacity=".2"/></g>`;
  A.pumpkins = (x = 1990, y = 880) => {
    const one = (dx, s, face) => `<g transform="translate(${dx} 0) scale(${s})"><path d="M0 -62Q4 -74 12 -78" stroke="${K.ink}" stroke-width="6" fill="none" stroke-linecap="round"/>
    <ellipse cx="-26" cy="-32" rx="24" ry="32" fill="#F27B10" ${OUT(5)}/><ellipse cx="26" cy="-32" rx="24" ry="32" fill="#F27B10" ${OUT(5)}/><ellipse cx="0" cy="-32" rx="26" ry="35" fill="${K.orange}" ${OUT(5)}/>
    ${face ? `<path class="lv-face" d="M-16 -44L-6 -36L-20 -34ZM16 -44L6 -36L20 -34ZM-16 -18Q0 -6 16 -18L10 -24L4 -16L0 -24L-4 -16L-10 -24Z" fill="#FFF0A8" ${OUT(2.5)}/>` : ''}</g>`;
    return `<g transform="translate(${x} ${y})">${one(0, 0.95, true)}${one(74, 0.68, false)}</g>`;
  };
  A.pumpkinFace = (x = 1990, y = 880) => `<g transform="translate(${x} ${y}) scale(.95)"><path d="M-16 -44L-6 -36L-20 -34ZM16 -44L6 -36L20 -34ZM-16 -18Q0 -6 16 -18L10 -24L4 -16L0 -24L-4 -16L-10 -24Z" fill="#FFE07A"/><ellipse cx="0" cy="-30" rx="50" ry="46" fill="url(#lvg-warm)"/></g>`;
  A.gifts = (x = 1990, y = 880) => `<g transform="translate(${x} ${y})">
  <rect x="-2" y="-42" width="58" height="42" rx="4" fill="${K.blue}" ${OUT(5)}/><path d="M27 -42V0" stroke="${K.yellow}" stroke-width="10"/><path d="M-2 -21H56" stroke="${K.yellow}" stroke-width="10"/>
  <rect x="-56" y="-30" width="50" height="30" rx="4" fill="${K.red}" ${OUT(5)}/><path d="M-31 -30V0" stroke="${K.cream}" stroke-width="9"/>
  <rect x="-40" y="-64" width="40" height="34" rx="4" fill="${K.teal}" ${OUT(5)}/><path d="M-20 -64V-30" stroke="${K.pink}" stroke-width="8"/>
  <path d="M-20 -64Q-38 -84 -30 -72Q-24 -66 -20 -64Q-16 -66 -10 -72Q-2 -84 -20 -64Z" fill="${K.pink}" ${OUT(3.5)}/></g>`;
  A.hearts = (x = 1990, y = 880) => `<g transform="translate(${x} ${y})"><path d="M0 -6C-34 -32 -26 -66 -6 -66C4 -66 6 -58 6 -54C6 -58 8 -66 18 -66C38 -66 46 -32 6 -6Z" fill="${K.red}" ${OUT(5)} transform="translate(-4 0) scale(1.15)"/><path d="M40 -8C22 -22 26 -40 36 -40C42 -40 42 -35 42 -33C42 -35 43 -40 49 -40C60 -40 62 -22 42 -8Z" fill="${K.pink}" ${OUT(4)}/></g>`;

  /* ---- hanging / wall props (world-back) ---- */
  A.cobweb = (x = 484, y = 344) => `<g transform="translate(${x} ${y})" fill="none" stroke="#EDE8FF" stroke-width="3" stroke-linecap="round" opacity=".85"><path d="M0 0L150 0M0 0L138 62M0 0L96 108M0 0L44 138M0 0L0 150"/><path d="M40 0Q34 34 0 40M80 0Q70 60 0 82M120 0Q104 88 0 124M60 44Q36 60 44 86"/></g>`;
  A.spider = (x = 560, y = 384) => `<g transform="translate(${x} ${y})"><g class="lv-swing"><path d="M0 0V54" stroke="#EDE8FF" stroke-width="2.5"/><g transform="translate(0 66)"><circle r="11" fill="${K.ink}"/><circle cy="-11" r="6.5" fill="${K.ink}"/><g stroke="${K.ink}" stroke-width="3" stroke-linecap="round" fill="none"><path d="M-8 -2L-22 -12M-9 2L-24 4M-8 8L-22 20M8 -2L22 -12M9 2L24 4M8 8L22 20"/></g><circle cx="-2.5" cy="-13" r="1.6" fill="#FFE07A"/><circle cx="2.5" cy="-13" r="1.6" fill="#FFE07A"/></g></g></g>`;
  A.garland = (x0 = 480, x1 = 2720, y = 398) => {
    let tufts = '', berries = '';
    const n = Math.round((x1 - x0) / 34), sag = 34;
    for (let i = 0; i <= n; i++) { const t = i / n, x = x0 + (x1 - x0) * t, yy = y + sag * Math.sin(Math.PI * t) * 0.0 + Math.sin(i * 1.7) * 3; tufts += `<path d="M${f(x - 12)} ${f(yy - 2)}Q${f(x)} ${f(yy + 24)} ${f(x + 12)} ${f(yy - 2)}" fill="none" stroke="#1F8A73" stroke-width="9" stroke-linecap="round"/><path d="M${f(x - 10)} ${f(yy)}Q${f(x)} ${f(yy + 18)} ${f(x + 10)} ${f(yy)}" fill="none" stroke="${K.teal}" stroke-width="5" stroke-linecap="round"/>`; if (i % 4 === 2) berries += `<circle cx="${f(x)}" cy="${f(yy + 20)}" r="6" fill="${K.red}" ${OUT(2.5)}/>`; }
    return `<g>${tufts}${berries}</g>`;
  };
  A.wreath = (x = 1175, y = 482) => {
    let leaves = '';
    for (let i = 0; i < 18; i++) { const a = (i / 18) * 6.283; leaves += `<ellipse cx="${f(Math.cos(a) * 34)}" cy="${f(Math.sin(a) * 34)}" rx="14" ry="7" transform="rotate(${f((a * 180) / Math.PI + 90)} ${f(Math.cos(a) * 34)} ${f(Math.sin(a) * 34)})" fill="${i % 2 ? '#1F8A73' : K.teal}" ${OUT(3)}/>`; }
    return `<g transform="translate(${x} ${y})">${leaves}<circle cx="-20" cy="24" r="6" fill="${K.red}" ${OUT(2.5)}/><circle cx="-8" cy="30" r="6" fill="${K.red}" ${OUT(2.5)}/><path d="M0 34L-16 62L-4 56L0 70L4 56L16 62Z" fill="${K.red}" ${OUT(3.5)}/></g>`;
  };
  A.streamers = () => {
    const cols = [K.red, K.yellow, K.blue, K.pink, K.teal, K.orange, K.red, K.blue];
    return cols.map((c, i) => { const x = 620 + i * 300 + (i % 2) * 40, len = 90 + (i * 37) % 60; let d = `M${x} 388`; for (let k = 1; k <= 6; k++) d += `Q${x + (k % 2 ? 12 : -12)} ${388 + (len / 6) * (k - 0.5)} ${x} ${388 + (len / 6) * k}`; return `<path d="${d}" fill="none" stroke="${c}" stroke-width="7" stroke-linecap="round"/><path d="${d}" fill="none" stroke="${K.ink}" stroke-width="2" stroke-linecap="round" opacity=".5" transform="translate(2 1)"/>`; }).join('');
  };
  A.heartBunting = (x0, x1, y = 398, n = 8) => {
    let hs = '';
    for (let i = 1; i < n; i++) { const t = i / n, x = x0 + (x1 - x0) * t, yy = y + 30 * Math.sin(Math.PI * t); hs += `<g transform="translate(${f(x)} ${f(yy + 22)}) scale(1.2)"><path d="${HEART}" fill="${i % 2 ? K.red : K.pink}" ${OUT(3)}/></g>`; }
    return hs;
  };
  // the tricolour rosette for the 14th of July, a heart pin for Valentine's...
  A.cockade = (x = 1000, y = 470) => `<g transform="translate(${x} ${y})"><circle r="26" fill="${K.red}" ${OUT(4)}/><circle r="17" fill="${K.cream}" ${OUT(3)}/><circle r="8" fill="${K.blue}" ${OUT(3)}/></g>`;

  /* ================================================================== the seagull's accessories (coordinates of the head: hat crown top ~ y -480) */
  A.accessory = (name) => {
    switch (name) {
      // a floppy santa hat: dome + tail drooping backwards + pompom, white fur trim
      case 'santa': return `<g class="acc"><path d="M-30 -462C-36 -494 -12 -516 22 -514C50 -512 58 -490 50 -460Z" fill="${K.red}" ${OUT(5)}/><path d="M-14 -506C-50 -516 -90 -504 -100 -470C-90 -482 -66 -492 -42 -494Z" fill="${K.red}" ${OUT(5)}/><circle cx="-102" cy="-464" r="13" fill="#fff" ${OUT(5)}/><path d="M-40 -466Q6 -486 56 -464L52 -446Q6 -464 -38 -448Z" fill="#fff" ${OUT(5)}/></g>`;
      // a bent witch hat (kept short: the awning hides whatever rises above the hat by more than ~35 units)
      case 'witch': return `<g class="acc"><path d="M-72 -458Q6 -484 94 -456Q102 -442 86 -438Q6 -460 -64 -438Q-82 -442 -72 -458Z" fill="#2A2340" ${OUT(5)}/><path d="M-30 -462L-16 -504Q-14 -510 -6 -510H14Q22 -510 24 -502L40 -462Z" fill="#2A2340" ${OUT(5)}/><path d="M-14 -504Q-48 -512 -74 -486Q-46 -496 -8 -490Z" fill="#2A2340" ${OUT(5)}/><path d="M-30 -478L34 -478L38 -462L-32 -462Z" fill="#8A4FD6" ${OUT(4)}/><rect x="-4" y="-482" width="22" height="20" rx="3" fill="#FFD65C" ${OUT(3)}/></g>`;
      case 'party': return `<g class="acc"><path d="M-24 -464L8 -534L40 -464Z" fill="${K.yellow}" ${OUT(5)}/><path d="M-10 -494L26 -502M-16 -478L34 -488" stroke="${K.red}" stroke-width="7" stroke-linecap="round"/><circle cx="8" cy="-538" r="10" fill="${K.pink}" ${OUT(4)}/></g>`;
      // a heart pin on the front of the crown
      case 'heart': return `<g class="acc"><g transform="translate(8 -466) scale(1.35) rotate(-8)"><path d="${HEART}" fill="${K.red}" ${OUT(2.6)}/></g></g>`;
      // the tricolour rosette
      case 'cockade': return `<g class="acc"><g transform="translate(10 -468)"><circle r="16" fill="${K.red}" ${OUT(3.5)}/><circle r="10.5" fill="${K.cream}" ${OUT(3)}/><circle r="5" fill="${K.blue}" ${OUT(2.5)}/></g></g>`;
      default: return '';
    }
  };

  /* ================================================================== weather layers (screen space, HTML) */
  // seamless tiles: the tile is translated by exactly (-tileW, +tileH) per loop, so the slant of the streaks matches the motion.
  const uri = (svg) => 'url("data:image/svg+xml,' + encodeURIComponent(svg) + '")';
  A.rainTile = (w, h, n, len, wd, col, seed) => {
    const r = M.rng(seed); let s = '';
    for (let i = 0; i < n; i++) { const x = r() * w, y = r() * h, dx = (len * w) / h; for (const ox of [0, w, -w]) s += `<path d="M${(x + ox).toFixed(1)} ${y.toFixed(1)}l${(-dx).toFixed(1)} ${len}" stroke="${col}" stroke-width="${wd}" stroke-linecap="round"/>`; }
    return uri(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${s}</svg>`);
  };
  A.snowTile = (w, h, n, rmin, rmax, seed) => {
    const r = M.rng(seed); let s = '';
    for (let i = 0; i < n; i++) { const x = r() * w, y = r() * h, rr = rmin + r() * (rmax - rmin); for (const oy of [0, h, -h]) for (const ox of [0, w, -w]) if (ox === 0 || oy === 0 || rr > 0) s += `<circle cx="${(x + ox).toFixed(1)}" cy="${(y + oy).toFixed(1)}" r="${rr.toFixed(1)}" fill="#fff" fill-opacity="${(0.55 + r() * 0.4).toFixed(2)}"/>`; }
    return uri(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${s}</svg>`);
  };
  A.leafTile = (w, h, n, seed, cols) => {
    const r = M.rng(seed); let s = '';
    for (let i = 0; i < n; i++) { const x = r() * w, y = r() * h, a = r() * 360, c = cols[i % cols.length], sc = 0.42 + r() * 0.42; for (const oy of [0, h, -h]) for (const ox of [0, w, -w]) s += `<path transform="translate(${(x + ox).toFixed(1)} ${(y + oy).toFixed(1)}) rotate(${a.toFixed(0)}) scale(${sc.toFixed(2)})" d="M0 -9Q9 -2 0 10Q-9 -2 0 -9Z" fill="${c}" stroke="#26232b" stroke-width="1.6" stroke-linejoin="round"/>`; }
    return uri(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${s}</svg>`);
  };
  A.heartTile = (w, h, n, seed) => {
    const r = M.rng(seed); let s = '';
    for (let i = 0; i < n; i++) { const x = r() * w, y = r() * h, sc = 0.7 + r() * 0.9, c = i % 2 ? '#DE3F39' : '#F5A3C7'; for (const oy of [0, h, -h]) s += `<path transform="translate(${x.toFixed(1)} ${(y + oy).toFixed(1)}) scale(${sc.toFixed(2)})" d="${HEART}" fill="${c}" stroke="#26232b" stroke-width="2" stroke-linejoin="round"/>`; }
    return uri(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${s}</svg>`);
  };
  A.confettiTile = (w, h, n, seed) => {
    const r = M.rng(seed), cols = ['#DE3F39', '#FFD65C', '#788CE3', '#F5A3C7', '#2FB59B', '#FF8A1E']; let s = '';
    for (let i = 0; i < n; i++) { const x = r() * w, y = r() * h, a = r() * 360, c = cols[i % cols.length]; for (const oy of [0, h, -h]) s += `<rect transform="translate(${x.toFixed(1)} ${(y + oy).toFixed(1)}) rotate(${a.toFixed(0)})" x="-4" y="-2.5" width="8" height="5" rx="1" fill="${c}"/>`; }
    return uri(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${s}</svg>`);
  };
})((window.Cornsty = window.Cornsty || {}));
