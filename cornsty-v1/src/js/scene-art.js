/* Cornsty - the kiosk on the beach: every layer of the world as SVG markup (world = 3200 x 1300 units, floor y = 1120, counter top y = 880). */
(function (C) {
  'use strict';
  const D = C.draw, K = D.COL, U = C.util;
  const f = (v) => +v.toFixed(1);
  const OUT = `stroke="${K.ink}" stroke-width="5" stroke-linejoin="round" stroke-linecap="round"`;
  const W = 3200, H = 1300, FLOOR = 1120, TOP = 880;
  const SE = (C.sceneArt = { W, H, FLOOR, TOP });

  // anchors used by the choreography (world units)
  SE.anchors = {
    machine: { x: 790, glass: { x: 650, y: 492, w: 280, h: 366 }, kettle: { x: 790, y: 560 }, door: { x: 890, y: 816 }, lever: { x: 968, y: 640 }, lamp: { x: 790, y: 452 }, funnel: { x: 978, y: 506 }, pouch: { x: 1000, y: 878, w: 130 } },
    gull: { machine: 1175, counter: 1450, register: 2030, merch: 2690, min: 700, max: 2900 },
    shelf: [ // 6 pouch slots on the two shelves
      { x: 1010, y: 690 }, { x: 1120, y: 690 }, { x: 1230, y: 690 }, { x: 1570, y: 690 }, { x: 1680, y: 690 }, { x: 1790, y: 690 },
    ],
    pouchW: 100,
    basket: { x: 1745, y: 866, w: 170 },
    register: { x: 2265, y: 730, keys: { x: 2262, y: 830 }, printer: { x: 2262, y: 716 } },
    terminal: { x: 2450, y: 850 },
    stamp: { x: 2080, y: 860 },
    rack: { x: 2925 },
    counterTop: TOP, floor: FLOOR,
  };

  /* ---------------------------------------------------------------- far layers (viewBox x from -1600 to 4800) */
  SE.sky = () => `<svg class="sky-svg" viewBox="-1600 0 6400 1300" preserveAspectRatio="none" aria-hidden="true">
<defs><linearGradient id="skyg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8FA3F0"/><stop offset=".55" stop-color="#BFCBF8"/><stop offset="1" stop-color="#F3EEDF"/></linearGradient>
<radialGradient id="sung" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#FFF6D8" stop-opacity=".9"/><stop offset="1" stop-color="#FFF6D8" stop-opacity="0"/></radialGradient></defs>
<rect x="-1600" width="6400" height="1300" fill="url(#skyg)"/>
<g transform="translate(2280 300)"><circle r="300" fill="url(#sung)"/><g class="sun-spin"><use href="#s-quat" x="-100" y="-100" width="200" height="200" fill="#FFF3C4" stroke="${K.ink}" stroke-width="4"/></g></g>
<g class="clouds">${[[-200, 210, 1.1], [700, 130, .8], [1500, 250, 1.3], [2900, 170, .9], [3700, 260, 1.15], [-1000, 300, 1]].map(([x, y, s], i) => cloud(x, y, s, i)).join('')}</g>
<g class="birds">${[[900, 420], [1250, 380], [1120, 470]].map(([x, y], i) => `<path class="sky-bird b${i}" d="M${x - 24} ${y}Q${x - 10} ${y - 16} ${x} ${y}Q${x + 10} ${y - 16} ${x + 24} ${y}" fill="none" stroke="${K.ink}" stroke-width="4" stroke-linecap="round"/>`).join('')}</g>
</svg>`;
  function cloud(x, y, s, i) {
    return `<g class="cloud c${i % 3}" transform="translate(${x} ${y}) scale(${s})"><path d="M0 60Q-6 24 32 24Q40-4 82 8Q116-20 150 12Q196 4 198 44Q214 62 190 72H16Q-4 72 0 60Z" fill="${K.cream}" stroke="${K.ink}" stroke-width="4" stroke-linejoin="round" opacity=".96"/></g>`;
  }
  SE.sea = () => {
    const sc = D.patterns.scallops({ a: '#6A7EE0', b: '#788CE3' }, 6400, 300, 0.5);
    return `<svg class="sea-svg" viewBox="-1600 0 6400 1300" preserveAspectRatio="none" aria-hidden="true">
<defs><clipPath id="seac"><rect x="-1600" y="700" width="6400" height="240"/></clipPath></defs>
<rect x="-1600" y="690" width="6400" height="260" fill="#788CE3"/>
<g clip-path="url(#seac)" transform="translate(-1600 700)">${sc}</g>
<path class="wave w1" d="M-1600 700Q-1200 680 -800 700T0 700T800 700T1600 700T2400 700T3200 700T4000 700T4800 700" fill="none" stroke="${K.cream}" stroke-width="6" stroke-linecap="round" opacity=".8"/>
<rect x="-1600" y="688" width="6400" height="6" fill="${K.ink}" opacity=".25"/>
</svg>`;
  };
  SE.dunes = () => `<svg class="dunes-svg" viewBox="-1600 0 6400 1300" preserveAspectRatio="none" aria-hidden="true">
<path d="M-1600 930Q-1200 850 -700 900T300 890T1300 910T2300 880T3300 905T4800 870V1300H-1600Z" fill="#F0E6C6" stroke="${K.ink}" stroke-width="5" stroke-linejoin="round"/>
<path d="M-1600 1010Q-900 960 -100 1000T1500 1010T3000 990T4800 1000V1300H-1600Z" fill="${K.cream}" stroke="${K.ink}" stroke-width="5" stroke-linejoin="round"/>
${[[-300, 930], [420, 950], [2900, 940], [3600, 925], [-1100, 920]].map(([x, y], i) => grassTuft(x, y, 1 + (i % 2) * 0.3)).join('')}
</svg>`;
  function grassTuft(x, y, s) {
    return `<g transform="translate(${x} ${y}) scale(${s})" fill="none" stroke="${K.ink}" stroke-width="5" stroke-linecap="round"><path d="M0 0Q-6-40-26-64M0 0Q2-46 10-78M0 0Q14-36 40-52" stroke="#6F8F1E" stroke-width="8"/><path d="M0 0Q-6-40-26-64M0 0Q2-46 10-78M0 0Q14-36 40-52" stroke="#A6CB3B" stroke-width="4"/></g>`;
  }

  SE.floor = () => {
    let seams = '';
    for (let y = 1150; y < 1500; y += 46) { seams += `<path d="M-900 ${y}H4100" stroke="${K.ink}" stroke-opacity=".22" stroke-width="3"/>`; for (let x = -900 + ((y * 7) % 260); x < 4100; x += 260) seams += `<path d="M${x} ${y}V${y + 46}" stroke="${K.ink}" stroke-opacity=".18" stroke-width="3"/>`; }
    return `<g id="floor"><rect x="-900" y="1120" width="5000" height="420" fill="#EBDAAE"/>${seams}<path d="M-900 1120H4100" ${OUT} fill="none"/><rect x="-900" y="1122" width="5000" height="26" fill="#000" opacity=".12"/></g>`;
  };

  /* ---------------------------------------------------------------- the stall (back layer: wall, machine, shelves, posters, awning back) */
  SE.stallBack = () => {
    const wall = [];
    for (let x = 480; x < 2720; x += 80) wall.push(`<path d="M${x} 360V1120" stroke="#6A7EE0" stroke-width="3"/>`);
    return `
<g id="wall">
  <rect x="480" y="340" width="2240" height="790" fill="#788CE3"/>
  ${wall.join('')}
  <rect x="480" y="340" width="2240" height="60" fill="#5F72D0" opacity=".35"/>
  <rect x="2694" y="340" width="26" height="780" fill="#5F72D0" opacity=".35"/>
  <path d="M2720 340V1120" stroke="${K.ink}" stroke-width="6" stroke-linecap="round"/>
</g>
${SE.menuBoard()}
${SE.poster()}
<g id="rear-shelves">
  ${shelf(1000, 1340, 690)}${shelf(1560, 1900, 690)}
</g>`;
  };
  function shelf(x0, x1, y) {
    return `<g><path d="M${x0 - 14} ${y}H${x1 + 14}V${y + 22}H${x0 - 14}Z" fill="${K.cream}" ${OUT}/><path d="M${x0 + 20} ${y + 22}L${x0 + 5} ${y + 70}M${x1 - 20} ${y + 22}L${x1 - 5} ${y + 70}" ${OUT} fill="none"/></g>`;
  }
  SE.menuBoard = () => {
    const x = 2110, y = 456, w = 380, h = 236;
    const rows = C.data.flavors.map((fl, i) => `<g transform="translate(0 ${i * 30})"><text x="26" y="0" font-family="'League Gothic',Impact,sans-serif" font-size="27" letter-spacing="1.5" fill="${K.cream}">${U.esc(fl.name.toUpperCase())}</text><text x="${w - 62}" y="0" text-anchor="end" font-family="'IBM Plex Mono',monospace" font-size="14" fill="${K.cream}" opacity=".7">${U.esc(fl.sub)}</text><text x="${w - 26}" y="0" text-anchor="end" font-family="'IBM Plex Mono',monospace" font-weight="500" font-size="16" fill="#FFD65C">${U.eurPlain(fl.price).replace(' €', '')}</text></g>`).join('');
    return `<g id="menu-board" class="hot" role="button" tabindex="-1" aria-label="Le menu">
  <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="14" fill="${K.ink}" ${OUT}/><rect x="${x + 10}" y="${y + 10}" width="${w - 20}" height="${h - 20}" rx="8" fill="none" stroke="${K.cream}" stroke-opacity=".35" stroke-width="2" stroke-dasharray="4 6"/>
  <text x="${x + w / 2}" y="${y + 44}" text-anchor="middle" font-family="'League Gothic',Impact,sans-serif" font-size="44" letter-spacing="3" fill="${K.cream}">LE MENU</text>
  <g transform="translate(${x} ${y + 84})">${rows}</g>
</g>`;
  };
  SE.poster = () => {
    const x = 1950, y = 552;
    return `<g id="poster-l" transform="translate(${x} ${y}) rotate(3)"><rect width="150" height="200" rx="6" fill="${K.cream}" ${OUT}/><rect x="10" y="10" width="130" height="180" fill="#788CE3"/>
<text x="75" y="52" text-anchor="middle" font-family="'League Gothic',Impact,sans-serif" font-size="34" fill="${K.cream}" letter-spacing="1">STOLEN BY</text><text x="75" y="86" text-anchor="middle" font-family="'League Gothic',Impact,sans-serif" font-size="34" fill="${K.cream}" letter-spacing="1">A SEAGULL</text>
<text x="75" y="112" text-anchor="middle" font-family="Inter,sans-serif" font-size="12" fill="${K.cream}" opacity=".9">Worth it!</text>
<g transform="translate(75 186) scale(.13)">${D.filled(C.art.gullLong.parts)}</g></g>`;
  };

  /* ---------------------------------------------------------------- the popcorn machine (back layer, left) */
  SE.machine = () => {
    const a = SE.anchors.machine, g = a.glass;
    return `<g id="machine">
  <ellipse cx="790" cy="1122" rx="210" ry="12" fill="#1b1820" opacity=".2"/>
  <rect x="632" y="860" width="316" height="262" rx="10" fill="${K.red}" ${OUT}/>
  <g id="m-body">
    <rect x="636" y="${g.y - 12}" width="308" height="${g.h + 34}" rx="26" fill="#E3EEFF" fill-opacity=".62" ${OUT}/>
    <rect x="${g.x}" y="${g.y}" width="${g.w}" height="${g.h}" rx="14" fill="#F4F8FF" fill-opacity=".5"/>
    <path d="M${g.x + 24} ${g.y + 8}L${g.x + 120} ${g.y + 8}L${g.x + 34} ${g.y + 250}L${g.x + 12} ${g.y + 250}Z" fill="#fff" opacity=".45"/>
    <path d="M${g.x + 140} ${g.y + 8}L${g.x + 168} ${g.y + 8}L${g.x + 80} ${g.y + 250}L${g.x + 66} ${g.y + 250}Z" fill="#fff" opacity=".3"/>
    <rect x="628" y="${g.y - 16}" width="20" height="${g.h + 40}" rx="6" fill="${K.red}" ${OUT}/><rect x="932" y="${g.y - 16}" width="20" height="${g.h + 40}" rx="6" fill="${K.red}" ${OUT}/>
  </g>
  <g id="m-kettle"><path d="M790 462V520" ${OUT} fill="none"/>
    <path d="M730 545Q730 585 790 590Q850 585 850 545Z" fill="${K.ink}" ${OUT}/><ellipse cx="790" cy="545" rx="60" ry="16" fill="#3a3540" ${OUT}/><ellipse id="m-glow" cx="790" cy="546" rx="48" ry="10" fill="#FFB428" opacity=".85"/>
    <path d="M722 552Q702 552 702 572" fill="none" ${OUT}/></g>
  <g id="m-roof">
    <path d="M606 480V444Q606 396 660 392H920Q974 396 974 444V480Z" fill="${K.red}" ${OUT}/>
    <path d="M606 480H974" ${OUT} fill="none"/>
    ${Array.from({ length: 9 }, (_, i) => `<path d="M${606 + i * 41} 480a20.5 20.5 0 0 0 41 0" fill="${i % 2 ? K.cream : K.red}" ${OUT}/>`).join('')}
    ${D.useQuat(756, 404, 68, K.cream)}
    <path d="M790 392V326" ${OUT} fill="none"/><path d="M790 330L858 346L790 366Z" fill="${K.cream}" ${OUT}/>
    <circle id="m-lamp" cx="${a.lamp.x}" cy="${a.lamp.y - 6}" r="0" fill="#FFB428"/>
  </g>
  <g id="m-funnel"><path d="M946 484H1010L992 528H964Z" fill="${K.red}" ${OUT}/><ellipse cx="978" cy="484" rx="32" ry="8" fill="${K.cream}" ${OUT}/><path d="M948 500H930" ${OUT} fill="none"/></g>
  <g id="m-door" style="transform-box:fill-box;transform-origin:0 50%"><rect x="850" y="774" width="80" height="84" rx="8" fill="#DCE8FF" fill-opacity=".8" ${OUT}/><path d="M858 782H922" stroke="#fff" stroke-width="5" opacity=".6"/><circle cx="861" cy="816" r="5" fill="${K.ink}"/></g>
  <g id="m-lever" transform="translate(${a.lever.x} ${a.lever.y})"><g id="m-lever-arm"><rect x="-6" y="-70" width="12" height="76" rx="6" fill="${K.cream}" ${OUT}/><circle cx="0" cy="-76" r="15" fill="${K.red}" ${OUT}/></g><circle r="14" fill="${K.blue}" ${OUT}/></g>
  <g id="m-panel"><rect x="666" y="880" width="240" height="70" rx="8" fill="${K.cream}" ${OUT}/><text x="786" y="925" text-anchor="middle" font-family="'League Gothic',Impact,sans-serif" font-size="46" letter-spacing="4" fill="${K.red}">POP!</text></g>
</g>`;
  };

  /* ---------------------------------------------------------------- counter, register, basket, stamp (front layer) */
  SE.counter = (flavor) => {
    const fl = flavor || C.data.byId('nature');
    return `<g id="counter">
  <defs><clipPath id="cfront"><rect x="900" y="926" width="1720" height="196"/></clipPath></defs>
  <rect x="900" y="926" width="1720" height="196" fill="#788CE3"/>
  <g clip-path="url(#cfront)"><g id="counter-pat" transform="translate(900 926)">${D.fillPattern(fl, 1720, 196, 0.34)}</g><g id="counter-pat2" transform="translate(900 926)" opacity="0"></g></g>
  <rect x="900" y="926" width="1720" height="196" fill="none" ${OUT}/>
  <rect x="900" y="926" width="1720" height="18" fill="#000" opacity=".16"/>
  ${[900, 2620].map((x) => `<rect x="${x - 10}" y="926" width="20" height="196" fill="${K.cream}" ${OUT}/>`).join('')}
  ${D.useWord(1310, 942, 280, K.cream, K.ink, 8, K.ink)}
  <path d="M866 ${TOP}H2654a18 18 0 0 1 18 18V926H848V${TOP + 18}a18 18 0 0 1 18-18Z" fill="${K.cream}" ${OUT}/>
  <path d="M870 ${TOP + 10}H2650" stroke="#fff" stroke-width="5" opacity=".7" stroke-linecap="round"/>
</g>`;
  };
  SE.registerBack = () => ''; // reserved
  SE.register = () => {
    const r = SE.anchors.register, x = r.x;
    const keys = [];
    const cols = [K.red, K.cream, K.blue, K.cream, K.red, K.blue, K.cream, K.red];
    for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) keys.push(`<rect class="rk" data-k="${i}-${j}" x="${x - 96 + i * 50}" y="${812 + j * 20}" width="42" height="15" rx="5" fill="${cols[(i * 3 + j) % cols.length]}" ${OUT.replace('stroke-width="5"', 'stroke-width="3"')}/>`);
    return `<g id="register">
  <g id="reg-paper"><rect id="reg-paper-strip" x="${x - 52}" y="716" width="104" height="0" fill="#fff" ${OUT.replace('stroke-width="5"', 'stroke-width="3"')} /></g>
  <rect x="${x - 126}" y="716" width="252" height="164" rx="14" fill="${K.blue}" ${OUT}/>
  <rect x="${x - 126}" y="716" width="252" height="40" rx="14" fill="${K.cream}" ${OUT}/>
  <rect x="${x - 60}" y="722" width="120" height="30" rx="6" fill="${K.ink}"/><text id="reg-display" x="${x + 54}" y="745" text-anchor="end" font-family="'IBM Plex Mono',monospace" font-weight="500" font-size="20" fill="#8DF0B3">0,00</text>
  ${keys.join('')}
  <path d="M${x + 96} 776h22" stroke="${K.cream}" stroke-width="6" stroke-linecap="round"/>
  <g id="reg-drawer"><rect x="${x - 110}" y="866" width="220" height="22" rx="6" fill="${K.cream}" ${OUT}/></g>
  <g id="terminal" transform="translate(${SE.anchors.terminal.x} ${SE.anchors.terminal.y}) rotate(-10)"><rect x="-26" y="-64" width="52" height="84" rx="8" fill="${K.ink}" ${OUT}/><rect x="-18" y="-56" width="36" height="24" rx="3" fill="#8DF0B3" opacity=".85"/><g fill="${K.cream}"><circle cx="-10" cy="-20" r="3"/><circle cx="0" cy="-20" r="3"/><circle cx="10" cy="-20" r="3"/><circle cx="-10" cy="-8" r="3"/><circle cx="0" cy="-8" r="3"/><circle cx="10" cy="-8" r="3"/></g></g>
</g>
<g id="stamp-set" transform="translate(${SE.anchors.stamp.x} ${SE.anchors.stamp.y})">
  <rect x="-44" y="-16" width="88" height="20" rx="6" fill="${K.blue}" ${OUT}/><rect x="-36" y="-22" width="72" height="8" rx="4" fill="#3E52CF"/>
  <g id="stamp-tool"><rect x="-14" y="-88" width="28" height="60" rx="10" fill="${K.cream}" ${OUT}/><rect x="-24" y="-30" width="48" height="16" rx="6" fill="${K.red}" ${OUT}/><use href="#s-quat" x="-14" y="-24" width="28" height="28" fill="${K.red}"/></g>
</g>`;
  };
  SE.basket = () => {
    const b = SE.anchors.basket;
    return `<g id="basket" transform="translate(${b.x} ${b.y})">
  <g id="basket-items"></g>
  <path d="M-84 -42H84L70 12H-70Z" fill="#E7CE93" ${OUT}/>
  ${[-56, -28, 0, 28, 56].map((x) => `<path d="M${x} -40V10" stroke="${K.ink}" stroke-opacity=".35" stroke-width="3"/>`).join('')}${[-22, -4].map((y) => `<path d="M-80 ${y}H80" stroke="${K.ink}" stroke-opacity=".35" stroke-width="3"/>`).join('')}
  <path d="M-84 -42H84" ${OUT} fill="none"/>
  <path d="M-84 -42Q0 -120 84 -42" ${OUT} fill="none" stroke-dasharray="0"/>
  <g id="basket-count" transform="translate(74 -92)"><circle r="22" fill="${K.red}" ${OUT}/><text id="basket-num" y="8" text-anchor="middle" font-family="'League Gothic',Impact,sans-serif" font-size="26" fill="${K.cream}">0</text></g>
</g>`;
  };

  /* ---------------------------------------------------------------- awning, bunting, lights (front-most) */
  SE.awning = () => {
    const x0 = 440, x1 = 3160, y0 = 130, y1 = 344, n = Math.round((x1 - x0) / 80);
    let stripes = '', scallops = '';
    for (let i = 0; i < n; i++) {
      const x = x0 + i * 80, c = i % 2 ? K.cream : K.red;
      stripes += `<rect x="${x}" y="${y0}" width="80.5" height="${y1 - y0}" fill="${c}"/>`;
      scallops += `<path d="M${x} ${y1}a40 40 0 0 0 80 0Z" fill="${c}" ${OUT}/>`;
    }
    return `<g id="awning">
  <rect x="${x0 - 22}" y="${y0 - 36}" width="${x1 - x0 + 44}" height="42" rx="10" fill="#B92C2A" ${OUT}/>
  <g id="awning-body">${stripes}</g>
  <rect x="${x0}" y="${y0}" width="${x1 - x0}" height="${y1 - y0}" fill="none" ${OUT}/>
  ${scallops}
</g>
<g id="posts">
  <rect x="440" y="340" width="40" height="790" fill="${K.cream}" ${OUT}/><rect x="3120" y="340" width="40" height="790" fill="${K.cream}" ${OUT}/>
</g>`;
  };
  // bunting + string lights hang BEHIND the seagull (so flags never cover his face)
  SE.deco = () => {
    let bunting = '', pts = '';
    const swag = (bx0, bx1, by, sag, nF, off) => {
      const curve = (t) => ({ x: bx0 + (bx1 - bx0) * t, y: by + sag * Math.sin(Math.PI * t) });
      for (let i = 0; i <= 40; i++) { const p = curve(i / 40); pts += (i ? 'L' : 'M') + f(p.x) + ' ' + f(p.y); }
      const cols = [K.red, K.cream, '#3E52CF', K.pink, K.cream, K.red];
      for (let i = 1; i < nF; i++) {
        const p = curve(i / nF); bunting += `<g transform="translate(${f(p.x)} ${f(p.y)})"><g class="flag" style="animation-delay:${((i + off) % 7) * -0.4}s"><path d="M-17 0H17L0 46Z" fill="${cols[(i + off) % cols.length]}" ${OUT.replace('stroke-width="5"', 'stroke-width="3.5"')}/></g></g>`;
      }
    };
    swag(1000, 1340, 396, 30, 9, 0); swag(1560, 1900, 396, 30, 9, 3); swag(2120, 2700, 396, 26, 13, 5);
    let bulbs = '';
    for (let i = 0; i < 54; i++) { const x = 470 + i * 50; bulbs += `<circle class="bulb" style="animation-delay:${(i % 6) * -0.5}s" cx="${x}" cy="402" r="7" fill="#FFE9A6"/>`; }
    return `<g id="deco"><path d="${pts}" fill="none" ${OUT}/>${bunting}<g id="bulbs" opacity=".95"><path d="M470 402H3120" stroke="${K.ink}" stroke-width="3" opacity=".5"/>${bulbs}</g></g>`;
  };

  /* ---------------------------------------------------------------- side props (surfboard, merch rack) */
  SE.surfboard = () => `<g id="surfboard" class="hot" role="button" tabindex="-1" aria-label="Une planche de surf" transform="translate(340 1090) rotate(-10)">
  <path d="M0 0C-26-110 -18-330 0-420C18-330 26-110 0 0Z" fill="${K.cream}" ${OUT}/><path d="M-3 -20V-400" stroke="${K.red}" stroke-width="8" stroke-linecap="round"/>
  <use href="#s-quat" x="-22" y="-260" width="44" height="44" fill="${K.blue}"/></g>`;
  SE.rack = () => {
    const x = SE.anchors.rack.x;
    return `<g id="rack">
  <path d="M${x - 200} 1120V520M${x + 200} 1120V520" ${OUT} fill="none" stroke-width="9"/>
  <path d="M${x - 220} 560H${x + 220}" ${OUT} fill="none" stroke-width="10"/>
  <text x="${x}" y="470" text-anchor="middle" font-family="'League Gothic',Impact,sans-serif" font-size="60" letter-spacing="4" fill="${K.ink}" stroke="${K.cream}" stroke-width="8" paint-order="stroke">LE VESTIAIRE</text>
  <g id="rack-items"></g>
  <ellipse cx="${x}" cy="1124" rx="230" ry="12" fill="#1b1820" opacity=".18"/>
</g>`;
  };
})((window.Cornsty = window.Cornsty || {}));
