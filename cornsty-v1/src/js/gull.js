/* Cornsty - the seagull puppet.
   A rig built from the REAL brand-book vectors (pose 1 body/head, pose 3 wing): separate head / hat / glasses / jaw / wings / legs,
   driven by springs (organic follow-through) plus a small library of async "acts" (wave, present, point, hop, celebrate, cash, think...).
   Local space: origin = middle of the feet line, y up = negative. Height ~ 500 units. */
(function (C) {
  'use strict';
  const U = C.util, D = C.draw, A = C.art, K = D.COL;
  const P = A.gull.parts;
  const G = (C.gull = {});
  const f = (v) => +v.toFixed(2);

  /* rig constants (local coordinates) - tuned visually */
  const HEAD = [26, -410];          // neck top: the head rotates around it
  const HINGE = [50, -388];         // beak hinge
  const SHOULDER = [-6, -296];
  const HIP_A = [-38, -150], HIP_B = [-15, -156];
  const TUFT = [-14, -456];
  const HAT_PIV = [28, -395];
  const MOUTH = [[44, -388], [53, -389], [68, -387], [80, -381], [94, -377], [103, -378]];          // visible mouth line
  const CLIPL = [[0, -388]].concat(MOUTH, [[150, -378]]);                                          // extended for the clip halves
  const TIP_U = [100, -379.5];
  const WING_TIP = 190;             // length of the wing art (root -> feather tips)

  const fill = (id, role) => `fill="${D.ROLEFILL[role || P[id].role]}"`;
  const pp = (id, cls, extra = '') => `<path class="p-${id}${cls ? ' ' + cls : ''}" d="${P[id].d}" ${fill(id)} ${extra}/>`;
  const wingParts = () => A.wing.parts.map((p) => `<path d="${p.d}" fill="${D.ROLEFILL[p.role]}"/>`).join('');
  const mouthCurve = (dx = 0, dy = 0) => 'M' + MOUTH.map(([x, y]) => f(x + dx) + ' ' + f(y + dy)).join('L');

  function markup(id) {
    const upClip = `M${CLIPL.map(([x, y]) => f(x) + ' ' + f(y + 1.8)).join('L')}L150 -470L0 -470Z`;
    const lowClip = `M${CLIPL.map(([x, y]) => f(x) + ' ' + f(y - 1.8)).join('L')}L150 -300L0 -300Z`;
    return `
<defs>
  <clipPath id="${id}up"><path d="${upClip}"/></clipPath>
  <clipPath id="${id}low"><path d="${lowClip}"/></clipPath>
</defs>
<ellipse class="g-shadow" cx="6" cy="6" rx="150" ry="14" fill="#1b1820" opacity=".18"/>
<g class="g-bob">
  <g class="g-legs">
    <g class="g-legA">${pp('legA')}${pp('toeA1')}${pp('toeA2')}${pp('kneeA')}</g>
    <g class="g-legB">${pp('legB')}${pp('toeB1')}${pp('toeB2')}${pp('kneeB')}</g>
  </g>
  <g class="g-wingF" style="display:none"><g class="g-wingF-in">${wingParts()}</g></g>
  <g class="g-torso">
    ${pp('body')}
    <g class="g-fold">${pp('wingTop')}${pp('wingIn')}</g>
    ${pp('tail')}${pp('chest')}${pp('neckL')}
  </g>
  <g class="g-wingN" style="display:none"><g class="g-wingN-in">${wingParts()}</g><g class="g-hold"></g></g>
  <circle class="g-cap" cx="${SHOULDER[0]}" cy="${SHOULDER[1]}" r="0" fill="${K.cream}" />
  <g class="g-head">
    <path class="g-headtop" d="M-12 -404C-16 -440 2 -466 30 -466C58 -466 76 -440 70 -404Z" fill="${K.cream}" stroke="${K.ink}" stroke-width="5" stroke-linejoin="round" style="display:none"/>
    <g class="g-hat">
      ${pp('crown')}${pp('crownL')}${pp('band')}${pp('bandL')}${pp('seam1')}${pp('seam2')}
      <g class="g-tuft">${pp('tuft')}</g>
    </g>
    <rect class="g-necktop" x="-12" y="-436" width="82" height="38" fill="${K.cream}"/>
    <g class="g-hat2">${pp('brim')}${pp('brimL')}</g>
    <g class="g-face">
      <g class="g-eyes" style="display:none">
        <g class="g-eye g-eyeL"><ellipse cx="6" cy="-401" rx="8.5" ry="11" fill="${K.ink}"/><circle cx="9" cy="-405" r="3" fill="#fff"/></g>
        <g class="g-eye g-eyeR"><ellipse cx="60" cy="-398" rx="7.5" ry="10" fill="${K.ink}"/><circle cx="62.5" cy="-402" r="2.6" fill="#fff"/></g>
        <path class="g-brow" d="M-8 -420Q6 -428 20 -421M46 -419Q60 -426 74 -418" fill="none" stroke="${K.ink}" stroke-width="5" stroke-linecap="round"/>
      </g>
      <g class="g-glasses">${pp('glasses')}<text class="g-lens g-lensL" x="6" y="-393" text-anchor="middle" font-family="Inter,sans-serif" font-weight="700" font-size="24" fill="${K.cream}" style="display:none"></text><text class="g-lens g-lensR" x="58" y="-391" text-anchor="middle" font-family="Inter,sans-serif" font-weight="700" font-size="20" fill="${K.cream}" style="display:none"></text></g>
      ${pp('faceL')}${pp('faceR')}
    </g>
    <g class="g-beak">
      <path class="g-mouth" d="M0 0Z" fill="#3a1216" style="display:none"/>
      <g class="g-jaw"><path class="g-tongue" d="M62 -387Q76 -383 90 -385L88 -378Q76 -376 62 -381Z" fill="#E8695C" style="display:none"/><g clip-path="url(#${id}low)">${pp('beak')}${pp('beakL')}</g><path class="g-jawline" d="${mouthCurve()}" fill="none" stroke="${K.ink}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" opacity="0"/></g>
      <g class="g-upper"><g clip-path="url(#${id}up)">${pp('beak')}${pp('beakL')}</g>${pp('mouthF')}${pp('mouthL')}</g>
    </g>
    <g class="g-fx" style="display:none" stroke="${K.ink}" stroke-width="5" stroke-linecap="round"><path d="M60 -486L66 -506"/><path d="M78 -474L96 -488"/></g>
  </g>
</g>
<g class="g-emotes"></g>`;
  }

  /* ---------------------------------------------------------------- springs */
  class Spring {
    constructor(v, k = 160, z = 0.62) { this.x = v; this.v = 0; this.t = v; this.k = k; this.z = z; }
    step(dt) { const c = 2 * this.z * Math.sqrt(this.k); const n = Math.max(1, Math.ceil(dt / 0.008)), h = dt / n; for (let i = 0; i < n; i++) { this.v += ((this.t - this.x) * this.k - this.v * c) * h; this.x += this.v * h; } }
    snap(v) { this.x = this.t = v; this.v = 0; }
  }

  /* ---------------------------------------------------------------- the factory */
  G.create = (opts = {}) => {
    const id = D.uid('gl');
    const el = U.svg('g', { class: 'gull' });
    el.innerHTML = markup(id);
    const q = (s) => el.querySelector(s);
    const N = {
      root: el, bob: q('.g-bob'), legA: q('.g-legA'), legB: q('.g-legB'), wingF: q('.g-wingF'), wingFin: q('.g-wingF-in'), wingN: q('.g-wingN'), wingNin: q('.g-wingN-in'), hold: q('.g-hold'),
      fold: q('.g-fold'), cap: q('.g-cap'), head: q('.g-head'), headtop: q('.g-headtop'), hat: q('.g-hat'), hat2: q('.g-hat2'), tuft: q('.g-tuft'), face: q('.g-face'),
      eyes: q('.g-eyes'), eyeL: q('.g-eyeL'), eyeR: q('.g-eyeR'), brow: q('.g-brow'), glasses: q('.g-glasses'), lensL: q('.g-lensL'), lensR: q('.g-lensR'),
      beak: q('.g-beak'), jaw: q('.g-jaw'), jawline: q('.g-jawline'), mouth: q('.g-mouth'), tongue: q('.g-tongue'), fx: q('.g-fx'), shadow: q('.g-shadow'), emotes: q('.g-emotes'), upper: q('.g-upper'),
    };
    const S = {                                   // springs
      bobY: new Spring(0, 200, 0.55), sq: new Spring(1, 260, 0.45), lean: new Spring(0, 120, 0.6), hx: new Spring(0, 130, 0.65), hy: new Spring(0, 130, 0.65), hr: new Spring(0, 110, 0.55),
      jaw: new Spring(0, 900, 0.9), hatR: new Spring(0, 140, 0.4), hatL: new Spring(0, 170, 0.5), tuft: new Spring(0, 90, 0.28),
      wA: new Spring(115, 150, 0.5), wS: new Spring(1, 200, 0.6), wOn: new Spring(0, 400, 1), wfA: new Spring(-20, 130, 0.5), wfOn: new Spring(0, 400, 1),
      legA: new Spring(0, 200, 0.6), legB: new Spring(0, 200, 0.6), gl: new Spring(0, 200, 0.6), eyeOn: new Spring(0, 500, 1), flip: new Spring(1, 300, 0.7), look: new Spring(0, 80, 0.8), brow: new Spring(0, 200, 0.7),
      shSc: new Spring(0.0, 240, 0.8),
    };
    const st = { x: 0, y: 0, s: 1, t: Math.random() * 10, glasses: 'on', lens: '', fx: false, blink: 0, nextBlink: 2 + Math.random() * 3, mouthT: 0, talk: 0, run: null, idle: true, wingUse: false, look: 0, nextLook: 3 };
    const api = { el, nodes: N, S, st };

    /* ------------ render */
    const dtx = (n, s) => n.setAttribute('transform', s);
    api.render = (dt = 0.016) => {
      st.t += dt;
      for (const k in S) S[k].step(dt);
      const t = st.t, br = Math.sin(t * 2.3) * 0.011, hv = S.hx.v;
      st.blink -= dt; st.nextBlink -= dt;
      if (st.nextBlink <= 0) { st.blink = 0.13; st.nextBlink = 2.4 + Math.random() * 3.6; }
      if (st.idle && (st.nextLook -= dt) <= 0) { S.look.t = U.pick([-1, 0, 0, 1, -0.5, 0.6]); st.nextLook = 1.8 + Math.random() * 3.5; }
      const flip = S.flip.x;
      dtx(el, `translate(${f(st.x)} ${f(st.y)}) scale(${f(st.s * flip)} ${f(st.s)})`);
      const sq = S.sq.x + br;
      dtx(N.bob, `translate(0 ${f(S.bobY.x)}) rotate(${f(S.lean.x)}) scale(${f(1 / Math.sqrt(Math.max(0.3, sq)))} ${f(sq)})`);
      dtx(N.legA, `rotate(${f(S.legA.x)} ${HIP_A[0]} ${HIP_A[1]})`); dtx(N.legB, `rotate(${f(S.legB.x)} ${HIP_B[0]} ${HIP_B[1]})`);
      const sway = st.idle ? Math.sin(t * 0.9) * 1.1 : 0, bobH = st.idle ? Math.sin(t * 1.7) * 1.4 : 0;
      dtx(N.head, `translate(${f(S.hx.x)} ${f(S.hy.x + bobH)}) rotate(${f(S.hr.x + sway)} ${HEAD[0]} ${HEAD[1]})`);
      dtx(N.hat, `translate(0 ${f(-S.hatL.x)}) rotate(${f(S.hatR.x)} ${HAT_PIV[0]} ${HAT_PIV[1]})`);
      dtx(N.hat2, `translate(0 ${f(-S.hatL.x)}) rotate(${f(S.hatR.x)} ${HAT_PIV[0]} ${HAT_PIV[1]})`);
      N.headtop.style.display = S.hatL.x > 2 ? '' : 'none';
      dtx(N.tuft, `rotate(${f(S.tuft.x - hv * 0.25 + Math.sin(t * 2.7) * 2.2)} ${TUFT[0]} ${TUFT[1]})`);
      // face parallax ("looking")
      const lk = S.look.x;
      dtx(N.face, `translate(${f(lk * 5)} ${f(-Math.abs(lk) * 0.5)})`); dtx(N.beak, `translate(${f(lk * 6)} 0)`);
      // jaw
      const jw = U.clamp(S.jaw.x, -0.1, 1.2);
      dtx(N.jaw, `rotate(${f(jw * 24)} ${HINGE[0]} ${HINGE[1]})`);
      const open = jw > 0.06;
      N.mouth.style.display = open ? '' : 'none'; N.tongue.style.display = jw > 0.4 ? '' : 'none';
      if (open) {
        const a = U.rad(jw * 24), dx = TIP_U[0] - HINGE[0], dy = TIP_U[1] - HINGE[1], lx = HINGE[0] + dx * Math.cos(a) - dy * Math.sin(a), ly = HINGE[1] + dx * Math.sin(a) + dy * Math.cos(a);
        N.mouth.setAttribute('d', `M${HINGE[0] - 2} ${HINGE[1] - 4}L${f(TIP_U[0] - 3)} ${f(TIP_U[1] - 1)}L${f(lx - 2)} ${f(ly - 1)}L${HINGE[0] + 4} ${HINGE[1] + 6}Z`);
      }
      N.jawline.setAttribute('opacity', U.clamp(jw * 8, 0, 1));
      // glasses / eyes
      const g = S.gl.x, eyes = S.eyeOn.x;
      N.glasses.style.display = g > 0.98 ? 'none' : '';
      dtx(N.glasses, `translate(${f(g * 0)} ${f(-g * 58)}) rotate(${f(g * -8)} 30 -390)`);
      N.eyes.style.display = eyes > 0.1 ? '' : 'none';
      const bl = st.blink > 0 ? 0.12 : 1;
      dtx(N.eyeL, `translate(0 -401) scale(1 ${bl}) translate(0 401)`); dtx(N.eyeR, `translate(0 -398) scale(1 ${bl}) translate(0 398)`);
      dtx(N.brow, `translate(0 ${f(-S.brow.x * 7)}) rotate(${f(S.brow.x * -4)} 30 -420)`);
      // wings
      const wOn = S.wOn.x > 0.5;
      N.wingN.style.display = wOn ? '' : 'none'; N.fold.style.opacity = wOn ? 0 : 1; N.cap.setAttribute('r', wOn ? 30 : 0);
      dtx(N.wingN, `translate(${SHOULDER[0]} ${SHOULDER[1]}) rotate(${f(S.wA.x)}) scale(${f(S.wS.x)} ${f(S.wS.x * (1 + Math.sin(t * 9) * 0.0))})`);
      const fOn = S.wfOn.x > 0.5;
      N.wingF.style.display = fOn ? '' : 'none';
      dtx(N.wingF, `translate(${SHOULDER[0] - 44} ${SHOULDER[1] + 8}) scale(-1 1) rotate(${f(S.wfA.x)})`);
      N.fx.style.display = st.fx ? '' : 'none';
      st.lensSet !== st.lens && (st.lensSet = st.lens, N.lensL.textContent = st.lens, N.lensR.textContent = st.lens, N.lensL.style.display = N.lensR.style.display = st.lens ? '' : 'none');
    };

    /* ------------ helpers */
    api.set = (patch) => { for (const k in patch) { if (S[k]) S[k].snap(patch[k]); else st[k] = patch[k]; } api.render(0); };
    api.place = (x, y, s) => { if (x != null) st.x = x; if (y != null) st.y = y; if (s != null) st.s = s; };
    api.face = (dir, snap) => { S.flip.t = dir; if (snap) S.flip.snap(dir); };
    api.dir = () => (S.flip.t < 0 ? -1 : 1);
    // convert a local gull point to scene coordinates (uses current placement)
    api.toScene = (lx, ly) => ({ x: st.x + st.s * S.flip.x * lx, y: st.y + st.s * ly });
    api.wingTip = () => { const a = U.rad(S.wA.x), l = WING_TIP * S.wS.x; return { x: SHOULDER[0] + Math.cos(a) * l, y: SHOULDER[1] + Math.sin(a) * l }; };
    // point the near wing (plus an optional held prop of length `extra`) at a scene point
    api.reach = (pt, extra = 0) => {
      const s0 = api.toScene(SHOULDER[0], SHOULDER[1]), fl = S.flip.t < 0 ? -1 : 1;
      const lx = (pt.x - s0.x) / (st.s * fl), ly = (pt.y - s0.y) / st.s, ang = (Math.atan2(ly, lx) * 180) / Math.PI, L = Math.hypot(lx, ly);
      S.wOn.t = 1; S.wA.t = ang; S.wS.t = U.clamp(L / (WING_TIP + extra), 0.5, 1.55);
      return { ang, L, ok: L <= (WING_TIP + extra) * 1.55 };
    };
    api.shoulder = () => api.toScene(SHOULDER[0], SHOULDER[1]);
    api.headPoint = () => api.toScene(52, -440);
    api.beakPoint = () => api.toScene(100, -385);

    /* ------------ talking */
    api.mouth = (ch) => {
      const c = String(ch || '').toLowerCase();
      const vowel = 'aeiouyàâéèêëîïôöùûüœ'.indexOf(c) >= 0, cons = /[a-zç]/.test(c);
      if (vowel) { S.jaw.t = 0.55 + Math.random() * 0.5; st.mouthT = 0.09; S.hy.t = 2 + Math.random() * 2; }
      else if (cons) { S.jaw.t = 0.16 + Math.random() * 0.14; st.mouthT = 0.05; }
      else { S.jaw.t = 0; st.mouthT = 0; if (c === ' ') S.hy.t = -1.5; }
    };
    api.closeMouth = () => { S.jaw.t = 0; S.hy.t = 0; };
    let mouthClock = 0;
    let skip = false, acc = 0;
    U.ticker.add((dt) => {
      mouthClock = dt; if (st.mouthT > 0) { st.mouthT -= dt; if (st.mouthT <= 0) { S.jaw.t = 0; S.hy.t = 0; } }
      // at rest the puppet only breathes: render at ~30 fps to keep phones cool
      acc += dt; if (st.idle && st.mouthT <= 0 && !st.run && (skip = !skip)) return;
      api.render(acc); acc = 0;
    });

    /* ------------ acts (one gesture at a time; each returns a promise) */
    const stopGesture = () => { if (st.run) { st.run.cancel(); st.run = null; } };
    const gesture = (fn) => { stopGesture(); const r = (st.run = new U.Run()); const p = (async () => { try { await fn(r); } catch (e) { if (!U.isCancel(e)) console.error(e); } finally { if (st.run === r) st.run = null; } })(); return p; };
    const rest = () => { S.wOn.t = 0; S.wfOn.t = 0; S.wA.t = 115; S.wS.t = 1; S.wfA.t = -20; S.lean.t = 0; S.bobY.t = 0; S.sq.t = 1; S.hr.t = 0; S.hx.t = 0; S.hatL.t = 0; S.hatR.t = 0; S.brow.t = 0; };
    api.rest = () => { stopGesture(); rest(); st.idle = true; };
    api.raiseWing = (ang = -40, s = 1) => { S.wOn.snap(1); S.wOn.t = 1; S.wA.t = ang; S.wS.t = s; };
    api.lowerWing = () => { S.wOn.t = 0; };
    // draw the near wing above the head (chin-scratching, hat tipping) or below it (default)
    api.wingFront = (on) => { if (on) { N.head.after(N.wingN); } else { N.cap.before(N.wingN); } };
    // glasses state: 'on' | 'up' | 'off'
    api.glasses = (mode) => { st.glasses = mode; S.gl.t = mode === 'on' ? 0 : mode === 'up' ? 0.55 : 1; S.eyeOn.t = mode === 'on' ? 0 : 1; };
    api.lens = (sym) => { st.lens = sym || ''; };
    api.fx = (on) => { st.fx = !!on; };

    const hop = async (r, h = 46, dur = 340) => {
      S.sq.t = 0.8; await r.wait(70);
      S.sq.t = 1.12; S.bobY.t = -h; C.audio.boing(); await r.wait(dur * 0.45);
      S.bobY.t = 0; S.sq.t = 1.0; await r.wait(dur * 0.45);
      S.sq.t = 0.86; await r.wait(80); S.sq.t = 1; await r.wait(120);
    };
    const wobbleTuft = () => { S.tuft.v += 260; };

    api.acts = {
      idle: () => gesture(async () => { rest(); st.idle = true; }),
      wave: (n = 3) => gesture(async (r) => {
        st.idle = false; S.wOn.t = 1; S.wA.snap(70); S.wA.t = -118; S.wS.t = 1.05; S.hr.t = -5; S.brow.t = 0.5; C.audio.whoosh(0.25, true, 0.6);
        await r.wait(280);
        for (let i = 0; i < n; i++) { S.wA.t = -136; await r.wait(170); S.wA.t = -104; await r.wait(170); }
        S.hr.t = 0; S.wA.t = 70; await r.wait(220); rest(); st.idle = true;
      }),
      present: (dir = 1, hold = 900) => gesture(async (r) => {
        st.idle = false; S.wOn.t = 1; S.wA.t = -10; S.wS.t = 1.12; S.hr.t = 5 * dir; S.hx.t = 4; C.audio.whoosh(0.22, true, 0.6); S.lean.t = 3;
        await r.wait(hold); S.wA.t = 70; S.hr.t = 0; S.lean.t = 0; await r.wait(240); rest(); st.idle = true;
      }),
      point: (ang = -14, hold = 800) => gesture(async (r) => {
        st.idle = false; S.wOn.t = 1; S.wA.t = ang; S.wS.t = 1.05; S.hr.t = 6; await r.wait(hold); S.wA.t = 70; S.hr.t = 0; await r.wait(220); rest(); st.idle = true;
      }),
      hop: () => gesture(async (r) => { st.idle = false; await hop(r); st.idle = true; }),
      celebrate: (n = 2) => gesture(async (r) => {
        st.idle = false; S.wOn.t = 1; S.wfOn.t = 1; S.wA.t = -125; S.wfA.t = -140; S.wS.t = 1.2; st.fx = true; api.glasses('on'); C.audio.squawk(0.8); wobbleTuft();
        api.emote('star'); api.emote('star', 30); api.emote('heart', -30);
        for (let i = 0; i < n; i++) { await hop(r, 60, 380); S.wA.t = -105; S.wfA.t = -160; await r.wait(60); S.wA.t = -135; S.wfA.t = -125; }
        st.fx = false; S.wA.t = 70; await r.wait(240); rest(); st.idle = true;
      }),
      think: () => gesture(async (r) => {
        st.idle = false; api.wingFront(true); S.wOn.t = 1; S.wA.t = -40; S.wS.t = 0.7; S.hr.t = -7; S.hx.t = -3; S.brow.t = 0.8; api.lens('?'); api.emote('dots');
        await r.wait(1300); api.lens(''); S.wA.t = 70; await r.wait(200); api.wingFront(false); rest(); st.idle = true;
      }),
      shrug: () => gesture(async (r) => {
        st.idle = false; S.wOn.t = 1; S.wfOn.t = 1; S.wA.t = -35; S.wfA.t = -155; S.wS.t = 1; S.hr.t = 8; S.bobY.t = -6; api.lens('?'); await r.wait(900); api.lens(''); rest(); st.idle = true;
      }),
      nod: (n = 2) => gesture(async (r) => { st.idle = false; for (let i = 0; i < n; i++) { S.hy.t = 9; S.hr.t = 4; await r.wait(150); S.hy.t = -2; S.hr.t = -1; await r.wait(150); } S.hy.t = 0; S.hr.t = 0; st.idle = true; }),
      shake: (n = 2) => gesture(async (r) => { st.idle = false; for (let i = 0; i < n; i++) { S.hr.t = -9; await r.wait(130); S.hr.t = 9; await r.wait(130); } S.hr.t = 0; st.idle = true; }),
      tipHat: () => gesture(async (r) => {
        st.idle = false; api.wingFront(true); S.wOn.t = 1; S.wA.t = -52; S.wS.t = 0.8; await r.wait(220); S.hatL.t = 30; S.hatR.t = -14; S.hr.t = 6; await r.wait(700); S.hatL.t = 0; S.hatR.t = 0; S.hr.t = 0; await r.wait(180); S.wA.t = 70; await r.wait(200); api.wingFront(false); rest(); st.idle = true;
      }),
      cash: () => gesture(async (r) => {
        st.idle = false; api.lens('€'); api.fx(true); S.wOn.t = 1; S.wA.t = 78; S.wS.t = 1; C.audio.chaching(); S.hy.t = 5; wobbleTuft();
        await r.wait(160); S.wA.t = 96; await r.wait(140); S.wA.t = 70; await r.wait(700); api.lens(''); api.fx(false); S.hy.t = 0; rest(); st.idle = true;
      }),
      laugh: () => gesture(async (r) => {
        st.idle = false; C.audio.laugh(); api.fx(true);
        for (let i = 0; i < 8; i++) { S.jaw.t = 0.9; S.bobY.t = -6; S.hr.t = i % 2 ? 4 : -4; await r.wait(85); S.jaw.t = 0.15; S.bobY.t = 0; await r.wait(85); }
        api.fx(false); S.hr.t = 0; S.jaw.t = 0; st.idle = true;
      }),
      surprise: () => gesture(async (r) => {
        st.idle = false; api.glasses('up'); S.brow.t = 1; S.sq.t = 1.1; C.audio.squawk(0.7); api.emote('bang'); S.jaw.t = 0.8; await r.wait(700); S.jaw.t = 0; api.glasses('on'); S.brow.t = 0; S.sq.t = 1; st.idle = true;
      }),
      love: () => gesture(async (r) => { st.idle = false; api.lens('♥'); api.emote('heart'); api.emote('heart', 24); S.hr.t = -6; wobbleTuft(); await r.wait(1200); api.lens(''); S.hr.t = 0; st.idle = true; }),
      turn: (dir) => gesture(async (r) => { st.idle = false; S.sq.t = 0.9; S.flip.t = dir; await r.wait(320); S.sq.t = 1; st.idle = true; }),
      walk: (x, y, o = {}) => gesture(async (r) => {
        st.idle = false; const x0 = st.x, y0 = st.y, dist = Math.abs(x - x0), dur = o.dur || Math.max(400, dist * 2.4), dir = x >= x0 ? 1 : -1;
        if (o.face !== false) { S.flip.t = dir; await r.wait(140); }
        const steps = Math.max(2, Math.round(dur / 260));
        await r.tween(dur, (k) => {
          st.x = x0 + (x - x0) * k; st.y = y0 + (y - y0) * k;
          const ph = k * steps * Math.PI * 2; S.legA.snap(Math.sin(ph) * 26); S.legB.snap(-Math.sin(ph) * 26); S.bobY.snap(-Math.abs(Math.sin(ph)) * 9);
          S.lean.snap(4 * dir * 0);
        }, U.ease.inOutSine);
        S.legA.t = 0; S.legB.t = 0; S.bobY.t = 0; st.idle = true;
      }),
    };
    api.act = (name, ...a) => (api.acts[name] ? api.acts[name](...a) : Promise.resolve());

    /* ------------ emotes: small floating symbols above the head */
    api.emote = (type, dx = 0) => {
      const g = U.svg('g', { class: 'emote' });
      const cx = 56 + dx, cy = -520;
      const shapes = {
        heart: `<path d="M0 8C-22 -8 -14 -28 0 -16C14 -28 22 -8 0 8Z" fill="${K.red}" stroke="${K.ink}" stroke-width="4" stroke-linejoin="round"/>`,
        star: `<path d="M0 -18L5 -6L18 -6L8 3L12 16L0 8L-12 16L-8 3L-18 -6L-5 -6Z" fill="#FFD65C" stroke="${K.ink}" stroke-width="4" stroke-linejoin="round"/>`,
        bang: `<g fill="${K.red}" stroke="${K.ink}" stroke-width="4" stroke-linejoin="round"><rect x="-6" y="-26" width="12" height="28" rx="5"/><circle cx="0" cy="12" r="7"/></g>`,
        dots: `<g fill="${K.ink}"><circle cx="-16" cy="0" r="5"/><circle cx="0" cy="0" r="5"/><circle cx="16" cy="0" r="5"/></g>`,
        note: `<path d="M-6 10V-18L12 -22V4" fill="none" stroke="${K.ink}" stroke-width="5" stroke-linecap="round"/><ellipse cx="-11" cy="11" rx="8" ry="6" fill="${K.ink}"/><ellipse cx="7" cy="5" rx="8" ry="6" fill="${K.ink}"/>`,
      };
      g.innerHTML = shapes[type] || shapes.star;
      N.emotes.append(g);
      const run = new U.Run(), rx = U.rand(-24, 24);
      run.tween(1100, (k) => { g.setAttribute('transform', `translate(${f(cx + rx * k)} ${f(cy - 70 * k)}) scale(${f(0.5 + U.ease.outBack(Math.min(1, k * 2.4)) * 0.75)})`); g.setAttribute('opacity', k < 0.75 ? 1 : f(1 - (k - 0.75) * 4)); }, U.ease.outQuad).then(() => g.remove()).catch(() => g.remove());
    };

    /* ------------ holding things (a node attached to the wing tip) */
    api.hold = (node, ox = 170, oy = 0, rot = 0) => { N.hold.replaceChildren(); if (node) { node.setAttribute('transform', `translate(${ox} ${oy}) rotate(${rot})`); N.hold.append(node); } };
    api.rest(); api.set({ flip: opts.dir || 1 });
    api.render(0);
    return api;
  };

  /* a standalone svg with one gull (used for avatars, intro, tests) */
  G.standalone = (o = {}) => {
    const svg = U.svg('svg', { viewBox: o.viewBox || '-220 -560 400 580', class: o.cls || 'gull-standalone', 'aria-hidden': 'true' });
    const g = G.create(o); svg.append(g.el); g.svg = svg; return g;
  };
})((window.Cornsty = window.Cornsty || {}));
