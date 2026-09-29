/* Cornsty - intro: the brand's icon builds itself (quatrefoil -> hat -> head -> sunglasses -> beak), like on page 14 of the brand book,
   then the wordmark rises and the visitor enters (with or without sound). */
(function (C) {
  'use strict';
  const U = C.util, D = C.draw, A = C.art;
  const IN = (C.intro = {});

  const pieces = () => {
    const P = A.icon.parts, by = (id) => P.find((p) => p.id === id);
    const grp = { quat: ['i7'], hat: ['i9', 'i10', 'i11', 'i12', 'i13', 'i14', 'i15', 'i16', 'i27'], head: ['i17', 'i18'], beak: ['i19', 'i20', 'i21'], brim: ['i22', 'i23'], glasses: ['i24', 'i25', 'i26'], lines: ['i28', 'i29'] };
    const of = (id) => Object.keys(grp).find((k) => grp[k].includes(id));
    return P.map((p) => `<path data-g="${of(p.id) || 'x'}" d="${p.d}" fill="${D.ROLEFILL[p.role] || '#26232b'}"/>`).join('');
  };

  IN.play = ({ returning = false } = {}) => new Promise((resolve) => {
    const el = U.el('div', { id: 'intro', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Bienvenue chez Cornsty' });
    el.innerHTML = `
<div class="in-bg"></div>
<div class="in-stage">
  <svg class="in-icon" viewBox="-190 -6 380 420" aria-hidden="true"><g class="in-g">${pieces()}</g></svg>
  <div class="in-bubble" hidden><span>Well, hello!<br>Let’s get to know<br>each other 🍿</span></div>
  <svg class="in-word" viewBox="0 0 866 523" role="img" aria-label="cornsty"><g class="in-wl">${A.wordmark.letters.map((p) => `<path d="${p.d}" fill="#26232b"/>`).join('')}<path d="${A.wordmark.mark.d}" fill="#DE3F39"/></g></svg>
  <p class="in-tag">Le pop-corn français qui a du caractère.</p>
  <div class="in-cta" hidden>
    <button class="btn red big" id="in-enter">Entrer dans le kiosque</button>
    <button class="btn ghost" id="in-sound">Entrer avec le son 🔊</button>
    <button class="link" id="in-simple">Version simple (sans animation)</button>
  </div>
</div>`;
    document.body.append(el);
    const $ = (s) => el.querySelector(s);
    const paths = (g) => Array.from(el.querySelectorAll(`[data-g="${g}"]`));
    const anim = (nodes, frames, opt) => nodes.forEach((n) => { n.style.transformBox = 'fill-box'; n.style.transformOrigin = '50% 50%'; n.animate && n.animate(frames, Object.assign({ fill: 'both' }, opt)); });
    const fast = returning || U.reduced();
    const T = fast ? 0.35 : 1;
    // initial states
    ['quat', 'hat', 'head', 'beak', 'brim', 'glasses', 'lines'].forEach((g) => paths(g).forEach((n) => (n.style.opacity = 0)));
    const wl = Array.from($('.in-wl').children); wl.forEach((n) => { n.style.opacity = 0; });
    const seq = async () => {
      const w = (ms) => new Promise((r) => setTimeout(r, ms * T));
      const ease = 'cubic-bezier(.2,.9,.25,1.25)';
      await w(250);
      anim(paths('quat'), [{ opacity: 0, transform: 'scale(.1) rotate(-40deg)' }, { opacity: 1, transform: 'scale(1.08) rotate(6deg)', offset: .7 }, { opacity: 1, transform: 'none' }], { duration: 700 * T, easing: ease }); C.audio.pop(1.2); await w(520);
      anim(paths('hat').concat(paths('brim')), [{ opacity: 0, transform: 'translateY(-160px) rotate(-14deg)' }, { opacity: 1, transform: 'translateY(8px) rotate(2deg)', offset: .7 }, { opacity: 1, transform: 'none' }], { duration: 640 * T, easing: 'cubic-bezier(.3,.7,.3,1)' }); C.audio.thud(0.6); await w(560);
      anim(paths('head'), [{ opacity: 0, transform: 'translateY(90px)' }, { opacity: 1, transform: 'none' }], { duration: 420 * T, easing: ease }); await w(340);
      anim(paths('glasses'), [{ opacity: 0, transform: 'translateX(-70px)' }, { opacity: 1, transform: 'none' }], { duration: 360 * T, easing: ease }); C.audio.whoosh(0.2, true, 0.4); await w(320);
      anim(paths('beak'), [{ opacity: 0, transform: 'scale(.2)' }, { opacity: 1, transform: 'scale(1.2)', offset: .6 }, { opacity: 1, transform: 'none' }], { duration: 360 * T, easing: ease }); C.audio.blip('o', 1.2); await w(280);
      anim(paths('lines'), [{ opacity: 0 }, { opacity: 1, offset: .3 }, { opacity: 0.0 }, { opacity: 1 }], { duration: 400 * T }); C.audio.squawk(0.5);
      const bub = $('.in-bubble'); bub.hidden = false; bub.animate && bub.animate([{ opacity: 0, transform: 'scale(.6) translateY(10px)' }, { opacity: 1, transform: 'none' }], { duration: 380 * T, easing: ease, fill: 'both' });
      await w(500);
      wl.forEach((n, i) => { n.style.opacity = 1; n.animate && n.animate([{ opacity: 0, transform: 'translateY(60px)' }, { opacity: 1, transform: 'none' }], { duration: 520 * T, delay: i * 55 * T, easing: ease, fill: 'both' }); });
      $('.in-word').classList.add('in'); await w(520 + wl.length * 55);
      $('.in-tag').classList.add('in'); const cta = $('.in-cta'); cta.hidden = false; cta.classList.add('in');
      $('#in-enter').focus({ preventScroll: true });
    };
    seq();
    const leave = async (sound, simple) => {
      if (simple) { C.store.prefs({ showMode: 'never' }); IN.simple = true; }
      C.audio.init(); if (sound) { C.audio.enable(true); C.store.prefs({ sound: true }); C.audio.pop(1); } else C.store.prefs({ sound: false });
      el.classList.add('out');
      const st = C.scene.stage; document.body.classList.remove('hud-hidden');
      setTimeout(() => { el.remove(); resolve(); }, U.reduced() ? 0 : 750);
    };
    $('#in-enter').addEventListener('click', () => leave(false));
    $('#in-sound').addEventListener('click', () => leave(true));
    $('#in-simple').addEventListener('click', () => leave(false, true));
    el.addEventListener('keydown', (e) => { if (e.key === 'Escape') leave(false); });
  });
})((window.Cornsty = window.Cornsty || {}));
