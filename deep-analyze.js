#!/usr/bin/env node

/**
 * ═══════════════════════════════════════════════════════════════════
 *  OUE DEEP ANALYZER v2 — Complete design DNA extraction
 * ═══════════════════════════════════════════════════════════════════
 *
 *  Key v2 improvements over v1:
 *    - MutationObserver catches ALL inline style changes (works even
 *      when GSAP is bundled as ES module and never touches window.gsap)
 *    - Smooth scroll via page.mouse.wheel() triggers real ScrollTrigger
 *    - Full 30+ CSS property extraction per component
 *    - Per-component scoped CSS extraction from stylesheets
 *    - Rich visual intent generation
 *    - Automatic integration with clone.js
 *
 *  USAGE:  node deep-analyze.js <url> [output-dir]
 *          node deep-analyze.js https://www.on.energy/
 *          node deep-analyze.js ./on_energy_clone   (analyze local clone)
 * ═══════════════════════════════════════════════════════════════════
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const TARGET = process.argv[2];
const OUTPUT_DIR_ARG = process.argv[3] || null;
if (!TARGET) {
  console.error('Usage: node deep-analyze.js <url-or-clone-dir> [output-dir]');
  process.exit(1);
}

const IS_URL = TARGET.startsWith('http');
const TARGET_URL = IS_URL ? TARGET : null;
const VIEWPORT = { width: 1920, height: 1080 };

// ═══════════════════════════════════════════════════════════════════════════
// INIT SCRIPT — injected BEFORE any page JS runs
// Intercepts GSAP + watches ALL inline style mutations
// ═══════════════════════════════════════════════════════════════════════════

const INIT_SCRIPT = `
window.__oue = {
  gsapCalls: [],       // GSAP method calls (to, from, timeline, etc.)
  scrollTriggers: [],  // ScrollTrigger.create() configs
  timelines: [],       // gsap.timeline() hierarchies
  cssKeyframes: [],    // @keyframes rules
  interactions: [],    // hover/click transition elements
  styleMutations: [],  // ALL inline style changes (MutationObserver)
  errors: [],
  _mutationCount: 0,
};

// ─── Selector builder ──────────────────────────────────────────
function _sel(el) {
  if (!el || el === document.body || el === document.documentElement) return 'body';
  if (el.id) return '#' + el.id;
  var parts = [];
  var cur = el;
  for (var d = 0; d < 4 && cur && cur !== document.body; d++) {
    var s = cur.tagName.toLowerCase();
    if (cur.id) { parts.unshift('#' + cur.id); break; }
    if (cur.className && typeof cur.className === 'string') {
      var cls = cur.className.trim().split(/\\s+/).filter(function(c) {
        return c && c.length < 40 && c.indexOf(':') === -1 && c.indexOf('__') !== 0;
      }).slice(0, 2);
      if (cls.length) s += '.' + cls.join('.');
    }
    var p = cur.parentElement;
    if (p) {
      var sibs = [];
      for (var i = 0; i < p.children.length; i++) {
        if (p.children[i].tagName === cur.tagName) sibs.push(p.children[i]);
      }
      if (sibs.length > 1) s += ':nth-of-type(' + (sibs.indexOf(cur) + 1) + ')';
    }
    parts.unshift(s);
    cur = cur.parentElement;
  }
  return parts.join('>');
}

function _clone(obj, d) {
  if (d === undefined) d = 0;
  if (d > 3) return '[deep]';
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'function') return '[Fn:' + (obj.name || '?') + ']';
  if (obj instanceof Element) return _sel(obj);
  if (obj instanceof NodeList || obj instanceof HTMLCollection) {
    var arr = [];
    for (var i = 0; i < obj.length; i++) arr.push(_sel(obj[i]));
    return arr;
  }
  if (Array.isArray(obj)) return obj.map(function(x) { return _clone(x, d+1); });
  if (typeof obj === 'object') {
    var r = {};
    for (var k in obj) {
      if (!obj.hasOwnProperty(k)) continue;
      try { r[k] = _clone(obj[k], d+1); } catch(e) { r[k] = '[err]'; }
    }
    return r;
  }
  return obj;
}

function _targets(t) {
  if (typeof t === 'string') return t;
  if (t instanceof Element) return _sel(t);
  if (t instanceof NodeList || t instanceof HTMLCollection) {
    var a = [];
    for (var i = 0; i < t.length; i++) a.push(_sel(t[i]));
    return a;
  }
  if (Array.isArray(t)) return t.map(function(x) { return x instanceof Element ? _sel(x) : String(x); });
  return String(t);
}

// ─── GSAP Proxy ────────────────────────────────────────────────
function _wrapTimeline(tl, parentCap) {
  parentCap.children = [];
  return new Proxy(tl, {
    get: function(tgt, prop) {
      var val = tgt[prop];
      if (typeof val === 'function' && ['to','from','fromTo','set','add','call'].indexOf(prop) >= 0) {
        return new Proxy(val, {
          apply: function(fn, ctx, args) {
            try {
              parentCap.children.push({
                m: prop, t: args[0] ? _targets(args[0]) : null,
                v: _clone(prop === 'fromTo' ? args[2] : args[1]),
                fv: prop === 'fromTo' ? _clone(args[1]) : undefined,
                pos: prop === 'fromTo' ? args[3] : args[2],
              });
            } catch(e) {}
            var r = fn.apply(ctx, args);
            return r === tgt ? new Proxy(tgt, this) : r;
          }
        });
      }
      return typeof val === 'function' ? val.bind(tgt) : val;
    }
  });
}

function _wrapGsap(g) {
  return new Proxy(g, {
    get: function(tgt, prop) {
      var val;
      try { val = tgt[prop]; } catch(e) { return undefined; }
      if (typeof val !== 'function') return val;
      if (['to','from','fromTo','set','timeline','registerPlugin'].indexOf(prop) < 0)
        return val.bind(tgt);

      return new Proxy(val, {
        apply: function(fn, ctx, args) {
          try {
            var cap = {
              m: prop,
              t: args[0] ? _targets(args[0]) : null,
              v: _clone(prop === 'fromTo' ? args[2] : args[1]),
              fv: prop === 'fromTo' ? _clone(args[1]) : undefined,
              ts: Math.round(performance.now()),
            };
            var vars = prop === 'fromTo' ? args[2] : args[1];
            if (vars && vars.scrollTrigger) {
              cap.st = _clone(vars.scrollTrigger);
              window.__oue.scrollTriggers.push({ t: cap.t, c: cap.st, m: prop });
            }
            window.__oue.gsapCalls.push(cap);
            var result = fn.apply(ctx, args);
            if (prop === 'timeline') {
              window.__oue.timelines.push(cap);
              return _wrapTimeline(result, cap);
            }
            return result;
          } catch(e) {
            window.__oue.errors.push(prop + ':' + e.message);
            return fn.apply(ctx, args);
          }
        }
      });
    }
  });
}

// Trap window.gsap assignment
var _g;
Object.defineProperty(window, 'gsap', {
  configurable: true, enumerable: true,
  get: function() { return _g; },
  set: function(v) { _g = _wrapGsap(v); console.log('[OUE] gsap intercepted'); }
});

// Trap ScrollTrigger assignment
var _st;
Object.defineProperty(window, 'ScrollTrigger', {
  configurable: true, enumerable: true,
  get: function() { return _st; },
  set: function(v) {
    if (v && v.create) {
      var orig = v.create;
      v.create = function(cfg) {
        try { window.__oue.scrollTriggers.push({ c: _clone(cfg), ts: Math.round(performance.now()) }); } catch(e) {}
        return orig.apply(this, arguments);
      };
    }
    _st = v;
  }
});

// ─── MutationObserver: catch ALL inline style changes ──────────
// This is the KEY innovation: works even when GSAP is bundled as
// ES module and never touches window.gsap. Every time GSAP sets
// element.style.transform, opacity, etc. → we capture it.
document.addEventListener('DOMContentLoaded', function() {
  var tracked = new Map(); // element → {initial styles, changes}
  var WATCH_PROPS = ['transform','opacity','clip-path','filter','visibility',
    'width','height','top','left','right','bottom','background-color','color',
    'border-radius','box-shadow','backdrop-filter','scale','translate'];

  var observer = new MutationObserver(function(mutations) {
    for (var i = 0; i < mutations.length; i++) {
      var m = mutations[i];
      if (m.type !== 'attributes' || m.attributeName !== 'style') continue;
      var el = m.target;
      if (el.tagName === 'CANVAS' || el.closest('svg')) continue; // skip canvas/svg internals

      var sel = _sel(el);
      var entry = tracked.get(sel);
      if (!entry) {
        entry = { selector: sel, tag: el.tagName.toLowerCase(), initial: {}, changes: [] };
        // Capture initial state
        var cs = getComputedStyle(el);
        for (var j = 0; j < WATCH_PROPS.length; j++) {
          entry.initial[WATCH_PROPS[j]] = cs.getPropertyValue(WATCH_PROPS[j]);
        }
        tracked.set(sel, entry);
      }

      // Capture current inline styles
      var current = {};
      var hasChange = false;
      for (var j = 0; j < WATCH_PROPS.length; j++) {
        var prop = WATCH_PROPS[j];
        var inlineVal = el.style.getPropertyValue(prop);
        if (inlineVal) {
          current[prop] = inlineVal;
          if (entry.initial[prop] !== inlineVal) hasChange = true;
        }
      }

      if (hasChange && entry.changes.length < 50) {
        entry.changes.push({
          scrollY: Math.round(window.scrollY),
          ts: Math.round(performance.now()),
          styles: current
        });
        window.__oue._mutationCount++;
      }
    }
  });

  observer.observe(document.body, { attributes: true, attributeFilter: ['style'], subtree: true });

  // Store tracked map reference for later retrieval
  window.__oue._getStyleMutations = function() {
    var result = [];
    tracked.forEach(function(v) {
      if (v.changes.length > 0) result.push(v);
    });
    return result;
  };
});

// ─── CSS @keyframes capture ────────────────────────────────────
document.addEventListener('DOMContentLoaded', function() {
  setTimeout(function() {
    try {
      for (var i = 0; i < document.styleSheets.length; i++) {
        try {
          var rules = document.styleSheets[i].cssRules;
          for (var j = 0; j < rules.length; j++) {
            if (rules[j] instanceof CSSKeyframesRule) {
              var frames = [];
              for (var k = 0; k < rules[j].cssRules.length; k++) {
                frames.push({ key: rules[j].cssRules[k].keyText, css: rules[j].cssRules[k].cssText });
              }
              window.__oue.cssKeyframes.push({ name: rules[j].name, frames: frames });
            }
          }
        } catch(e) {}
      }
    } catch(e) {}
  }, 2000);
});

// ─── Interaction capture ───────────────────────────────────────
document.addEventListener('DOMContentLoaded', function() {
  setTimeout(function() {
    var els = document.querySelectorAll('a, button, [role=button], [data-hover], [data-button], input, [tabindex]');
    els.forEach(function(el) {
      var cs = getComputedStyle(el);
      var tr = cs.transition;
      if (!tr || tr === 'all 0s ease 0s' || tr === 'none') return;
      window.__oue.interactions.push({
        sel: _sel(el),
        tag: el.tagName.toLowerCase(),
        text: (el.textContent || '').trim().substring(0, 40),
        transition: tr,
        cursor: cs.cursor,
        borderRadius: cs.borderRadius,
        padding: cs.padding,
        fontSize: cs.fontSize,
        fontWeight: cs.fontWeight,
        background: cs.backgroundColor !== 'rgba(0, 0, 0, 0)' ? cs.backgroundColor : null,
        color: cs.color,
        border: cs.border !== '0px none rgb(0, 0, 0)' ? cs.border : null,
      });
    });
  }, 3000);
});

console.log('[OUE] v2 instrumentation loaded');
`;

// ═══════════════════════════════════════════════════════════════════════════
// EXTRACTION FUNCTIONS (run via page.evaluate)
// ═══════════════════════════════════════════════════════════════════════════

// 30+ CSS properties per element
const CSS_PROPS = [
  'position','display','flexDirection','justifyContent','alignItems','gap',
  'gridTemplateColumns','gridTemplateRows',
  'width','height','minHeight','maxWidth',
  'margin','marginTop','marginBottom','padding','paddingTop','paddingBottom',
  'opacity','transform','transformOrigin',
  'background','backgroundColor','backgroundImage',
  'color','fontSize','fontFamily','fontWeight','lineHeight','letterSpacing','textTransform',
  'borderRadius','border','boxShadow',
  'overflow','clipPath','filter','backdropFilter','mixBlendMode',
  'zIndex','transition','animation',
];

// Scroll-state snapshot
const SNAPSHOT_FN = `(function(scrollY) {
  var PROPS = ${JSON.stringify(CSS_PROPS)};
  var vh = window.innerHeight;
  var results = [];
  var all = document.querySelectorAll('body>*, body>*>*, section, header, footer, nav, main, article, [class], h1, h2, h3, p, img, video, a, button');
  for (var i = 0; i < all.length; i++) {
    var el = all[i];
    var rect = el.getBoundingClientRect();
    if (rect.width < 1 && rect.height < 1) continue;
    if (rect.bottom < -300 || rect.top > vh + 300) continue;
    var cs = getComputedStyle(el);
    if (cs.display === 'none') continue;
    var styles = {};
    for (var j = 0; j < PROPS.length; j++) {
      var v = cs.getPropertyValue(PROPS[j]);
      if (!v || v === 'none' || v === 'normal' || v === 'auto' || v === 'static' ||
          v === 'visible' || v === 'inline' || v === '0px' || v === 'rgba(0, 0, 0, 0)' ||
          v === 'start' || v === 'stretch' || v === '0px 0px' || v === 'scroll' ||
          v === 'all 0s ease 0s') continue;
      styles[PROPS[j]] = v;
    }
    // Decompose transform
    var td = null;
    if (cs.transform && cs.transform !== 'none') {
      try {
        var m = new DOMMatrix(cs.transform);
        td = {
          tx: Math.round(m.e*10)/10, ty: Math.round(m.f*10)/10,
          sx: Math.round(Math.sqrt(m.a*m.a+m.b*m.b)*1000)/1000,
          sy: Math.round(Math.sqrt(m.c*m.c+m.d*m.d)*1000)/1000,
          rot: Math.round(Math.atan2(m.b,m.a)*180/Math.PI*10)/10,
        };
      } catch(e) {}
    }
    var sel = el.id ? '#'+el.id : el.tagName.toLowerCase();
    if (!el.id && el.className && typeof el.className === 'string') {
      var c = el.className.trim().split(/\\s+/).filter(function(x){return x&&x.length<40}).slice(0,2);
      if (c.length) sel += '.'+c.join('.');
    }
    results.push({
      s: sel, r: { x:Math.round(rect.x), y:Math.round(rect.y), w:Math.round(rect.width), h:Math.round(rect.height) },
      iv: rect.top < vh && rect.bottom > 0,
      st: styles, tf: td,
      txt: el.children.length === 0 ? (el.textContent||'').trim().substring(0,60) : null,
    });
  }
  return { scrollY: scrollY, elements: results };
})`;

// Component detection with full CSS extraction
const COMPONENTS_FN = `(function() {
  var PROPS = ${JSON.stringify(CSS_PROPS)};
  var comps = [];
  var sects = document.querySelectorAll('section, header, footer, nav, main, article');

  sects.forEach(function(sec, idx) {
    var rect = sec.getBoundingClientRect();
    var cs = getComputedStyle(sec);
    var classes = (sec.className || '').toLowerCase();
    var id = (sec.id || '').toLowerCase();
    var tag = sec.tagName.toLowerCase();
    var text = sec.textContent.substring(0, 300).toLowerCase();

    // Type detection
    var type = 'section';
    if (tag === 'nav' || classes.match(/nav|menu/)) type = 'navigation';
    else if (tag === 'footer' || classes.match(/footer/)) type = 'footer';
    else if (tag === 'header' || classes.match(/hero|banner/) || (idx === 0 && rect.height > window.innerHeight * 0.7)) type = 'hero';
    else if (classes.match(/gallery|portfolio|project|work|featured/)) type = 'gallery';
    else if (classes.match(/about|story|manifesto|philosophy/)) type = 'about';
    else if (classes.match(/contact/) || sec.querySelector('form')) type = 'contact';
    else if (classes.match(/testimon|review|quote|client/)) type = 'testimonials';
    else if (classes.match(/service|feature|expertise|approach/)) type = 'services';
    else if (classes.match(/marquee|ticker|scroll-text/)) type = 'marquee';
    else if (classes.match(/cta|call-to-action|newsletter/)) type = 'cta';
    else if (classes.match(/team|equipe|people/)) type = 'team';
    else if (classes.match(/faq|accordion/)) type = 'faq';
    else if (classes.match(/pricing|plan/)) type = 'pricing';
    else if (classes.match(/stat|number|counter|metric/)) type = 'stats';
    else if (classes.match(/news|blog|article|post/)) type = 'blog';
    else if (classes.match(/partner|logo|client.*logo|brand/)) type = 'logos';

    // Full computed CSS for the section
    var sectionCSS = {};
    for (var j = 0; j < PROPS.length; j++) {
      var v = cs.getPropertyValue(PROPS[j]);
      if (v && v !== 'none' && v !== 'auto' && v !== 'static' && v !== 'normal' && v !== '0px' && v !== 'rgba(0, 0, 0, 0)') {
        sectionCSS[PROPS[j]] = v;
      }
    }

    // Extract key children info
    var headings = [];
    sec.querySelectorAll('h1,h2,h3,h4').forEach(function(h) {
      var hcs = getComputedStyle(h);
      headings.push({
        tag: h.tagName, text: h.textContent.trim().substring(0, 80),
        fontSize: hcs.fontSize, fontWeight: hcs.fontWeight, fontFamily: hcs.fontFamily.split(',')[0].replace(/['"]/g,''),
        lineHeight: hcs.lineHeight, letterSpacing: hcs.letterSpacing, textTransform: hcs.textTransform,
        color: hcs.color, marginBottom: hcs.marginBottom,
      });
    });

    var paragraphs = [];
    sec.querySelectorAll('p').forEach(function(p) {
      if (p.textContent.trim().length < 5) return;
      var pcs = getComputedStyle(p);
      paragraphs.push({
        text: p.textContent.trim().substring(0, 120),
        fontSize: pcs.fontSize, fontWeight: pcs.fontWeight, lineHeight: pcs.lineHeight,
        color: pcs.color, maxWidth: pcs.maxWidth,
      });
    });

    var images = [];
    sec.querySelectorAll('img').forEach(function(img) {
      var ics = getComputedStyle(img);
      images.push({
        src: img.src, alt: img.alt, w: img.naturalWidth, h: img.naturalHeight,
        objectFit: ics.objectFit, borderRadius: ics.borderRadius, aspectRatio: ics.aspectRatio,
      });
    });

    var videos = [];
    sec.querySelectorAll('video').forEach(function(v) {
      videos.push({
        src: v.src || (v.querySelector('source') || {}).src, poster: v.poster,
        autoplay: v.autoplay, loop: v.loop, muted: v.muted,
      });
    });

    var buttons = [];
    sec.querySelectorAll('a, button, [role=button]').forEach(function(b) {
      var bcs = getComputedStyle(b);
      if (b.textContent.trim().length < 2) return;
      buttons.push({
        tag: b.tagName, text: b.textContent.trim().substring(0, 40), href: b.href || null,
        fontSize: bcs.fontSize, fontWeight: bcs.fontWeight, padding: bcs.padding,
        borderRadius: bcs.borderRadius, background: bcs.backgroundColor, color: bcs.color,
        border: bcs.border !== '0px none rgb(0, 0, 0)' ? bcs.border : null,
        transition: bcs.transition !== 'all 0s ease 0s' ? bcs.transition : null,
      });
    });

    // Get clean HTML (truncated)
    var html = sec.outerHTML;
    if (html.length > 8000) html = html.substring(0, 8000) + '...[truncated at 8KB]';

    comps.push({
      idx: idx, type: type, tag: tag, id: sec.id || null,
      classes: (sec.className || '').split(/\\s+/).filter(Boolean).slice(0, 10),
      rect: { y: Math.round(rect.y + window.scrollY), w: Math.round(rect.width), h: Math.round(rect.height) },
      css: sectionCSS,
      content: {
        headings: headings.slice(0, 6),
        paragraphs: paragraphs.slice(0, 4),
        images: images.slice(0, 8),
        videos: videos.slice(0, 4),
        buttons: buttons.slice(0, 6),
      },
      html: html,
    });
  });
  return comps;
})()`;

// CSS Variables
const CSS_VARS_FN = `(function() {
  var vars = {};
  try {
    for (var i = 0; i < document.styleSheets.length; i++) {
      try {
        for (var j = 0; j < document.styleSheets[i].cssRules.length; j++) {
          var rule = document.styleSheets[i].cssRules[j];
          if (rule.selectorText === ':root' || rule.selectorText === 'html' || rule.selectorText === ':root, :host') {
            for (var k = 0; k < rule.style.length; k++) {
              var prop = rule.style[k];
              if (prop.indexOf('--') === 0) vars[prop] = rule.style.getPropertyValue(prop).trim();
            }
          }
        }
      } catch(e) {}
    }
  } catch(e) {}
  return vars;
})()`;

// Typography
const TYPO_FN = `(function() {
  var fam = {};
  var els = document.querySelectorAll('h1,h2,h3,h4,h5,h6,p,a,span,li,blockquote,figcaption,label,button,div');
  for (var i = 0; i < els.length && i < 500; i++) {
    var el = els[i];
    if (!el.textContent.trim()) continue;
    var cs = getComputedStyle(el);
    var family = cs.fontFamily.split(',')[0].trim().replace(/['"]/g, '');
    if (!family || family.length < 2) continue;
    if (!fam[family]) fam[family] = { count: 0, sizes: {}, weights: {}, examples: [] };
    fam[family].count++;
    fam[family].sizes[cs.fontSize] = (fam[family].sizes[cs.fontSize]||0) + 1;
    fam[family].weights[cs.fontWeight] = (fam[family].weights[cs.fontWeight]||0) + 1;
    if (fam[family].examples.length < 4) {
      fam[family].examples.push({
        tag: el.tagName, size: cs.fontSize, weight: cs.fontWeight,
        lineHeight: cs.lineHeight, letterSpacing: cs.letterSpacing,
        textTransform: cs.textTransform, color: cs.color,
        text: el.textContent.trim().substring(0, 30),
      });
    }
  }
  // Google Fonts
  var gf = [];
  document.querySelectorAll('link[href*="fonts.googleapis.com"]').forEach(function(l) {
    var m = l.href.match(/family=([^&"]+)/);
    if (m) gf.push(decodeURIComponent(m[1]).replace(/[+]/g, ' '));
  });
  // Typekit
  document.querySelectorAll('link[href*="use.typekit.net"]').forEach(function(l) {
    gf.push('typekit:' + l.href.match(/use\\.typekit\\.net\\/([^.]+)/)?.[1]);
  });
  return { families: fam, external: gf };
})()`;

// ═══════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════

async function main() {
  const t0 = Date.now();
  const hostname = IS_URL ? new URL(TARGET_URL).hostname.replace(/^www\./, '') : path.basename(TARGET).replace(/_clone$/, '');
  const outputDir = OUTPUT_DIR_ARG ? path.resolve(OUTPUT_DIR_ARG) : path.resolve(`./${hostname.replace(/\./g, '_')}_analysis`);
  fs.mkdirSync(outputDir, { recursive: true });

  console.log(`
╔══════════════════════════════════════════════════════════╗
║  OUE DEEP ANALYZER v2                                    ║
╠══════════════════════════════════════════════════════════╣
║  Target: ${(IS_URL ? TARGET_URL : TARGET).slice(0, 46).padEnd(46)} ║
║  Output: ${outputDir.slice(-46).padEnd(46)} ║
╚══════════════════════════════════════════════════════════╝
`);

  const browser = await chromium.launch({
    headless: true,
    args: ['--disable-web-security', '--autoplay-policy=no-user-gesture-required'],
  });
  const context = await browser.newContext({
    viewport: VIEWPORT,
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0',
  });
  const page = await context.newPage();

  // ═══ Phase 1: Inject interception ═══
  console.log('⚡ Phase 1: Injecting runtime interception...');
  await page.addInitScript(INIT_SCRIPT);

  // ═══ Phase 2: Load + capture ═══
  console.log('⚡ Phase 2: Loading page...');
  const url = IS_URL ? TARGET_URL : `file://${path.resolve(TARGET)}/index.html`;
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForLoadState('load', { timeout: 20000 }).catch(() => {});
  } catch (e) {
    console.log(`  ⚠ ${e.message.slice(0, 60)}`);
  }
  console.log('  ✓ Page loaded');

  // Wait for JS frameworks to initialize
  await page.waitForTimeout(4000);

  // ─── SMOOTH SCROLL to trigger ScrollTrigger ────────────────────────────
  // Use mouse.wheel() which fires real wheel events that GSAP/Lenis listen to
  console.log('  → Smooth scrolling to trigger animations...');
  const pageHeight = await page.evaluate(() => document.body.scrollHeight);
  const scrollSteps = Math.ceil(pageHeight / VIEWPORT.height);

  for (let i = 0; i < scrollSteps; i++) {
    await page.mouse.wheel(0, VIEWPORT.height);
    await page.waitForTimeout(400); // Let ScrollTrigger process
  }
  // Scroll back up
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(1000);

  // Collect all interception data
  const oueData = await page.evaluate(() => ({
    gsapCalls: window.__oue.gsapCalls,
    scrollTriggers: window.__oue.scrollTriggers,
    timelines: window.__oue.timelines,
    cssKeyframes: window.__oue.cssKeyframes,
    interactions: window.__oue.interactions,
    mutationCount: window.__oue._mutationCount,
    errors: window.__oue.errors,
  }));

  // Get style mutations (the key v2 feature)
  const styleMutations = await page.evaluate(() => {
    return window.__oue._getStyleMutations ? window.__oue._getStyleMutations() : [];
  });

  console.log(`  ✓ GSAP calls: ${oueData.gsapCalls.length}`);
  console.log(`  ✓ ScrollTriggers: ${oueData.scrollTriggers.length}`);
  console.log(`  ✓ Timelines: ${oueData.timelines.length}`);
  console.log(`  ✓ CSS @keyframes: ${oueData.cssKeyframes.length}`);
  console.log(`  ✓ Interactive elements: ${oueData.interactions.length}`);
  console.log(`  ✓ Style mutations detected: ${oueData.mutationCount} (${styleMutations.length} animated elements)`);
  if (oueData.errors.length) console.log(`  ⚠ ${oueData.errors.length} errors`);

  // GSAP fallback: globalTimeline introspection
  if (oueData.gsapCalls.length === 0) {
    const gtlData = await page.evaluate(() => {
      try {
        var g = window.gsap || window._gsap;
        if (!g || !g.globalTimeline) return null;
        return g.globalTimeline.getChildren(true, true, true).slice(0, 100).map(function(tw) {
          try {
            return {
              type: tw.constructor.name, dur: tw.duration(), delay: tw.delay(),
              targets: tw.targets ? tw.targets().map(function(t) {
                return t instanceof Element ? (t.id ? '#'+t.id : t.tagName.toLowerCase()+(t.className?'.'+t.className.split(' ')[0]:'')) : String(t);
              }) : [],
              vars: tw.vars ? Object.keys(tw.vars).filter(function(k) { return ['id','callbackScope','lazy','immediateRender'].indexOf(k)<0; }) : [],
            };
          } catch(e) { return null; }
        }).filter(Boolean);
      } catch(e) { return null; }
    });
    if (gtlData && gtlData.length) {
      console.log(`  ✓ globalTimeline fallback: ${gtlData.length} tweens`);
      oueData.gsapCalls = gtlData;
    }
  }

  // ─── CSS Variables ─────────────────────────────────────────────────────
  console.log('  → Extracting design tokens...');
  const cssVars = await page.evaluate(CSS_VARS_FN);
  console.log(`  ✓ ${Object.keys(cssVars).length} CSS custom properties`);

  // ─── Typography ────────────────────────────────────────────────────────
  const typography = await page.evaluate(TYPO_FN);
  console.log(`  ✓ ${Object.keys(typography.families).length} font families`);

  // ═══ Phase 3: Scroll-state capture (with real scroll) ═══
  console.log(`\n⚡ Phase 3: Scroll-state capture (${40} positions)...`);
  const scrollStates = [];
  const step = Math.floor(pageHeight / 40);

  for (let i = 0; i <= 40; i++) {
    const scrollY = Math.min(i * step, pageHeight - VIEWPORT.height);
    // Use wheel for realistic scroll that triggers animations
    if (i > 0) {
      await page.mouse.wheel(0, step);
      await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
      await page.waitForTimeout(100);
    }

    const state = await page.evaluate(SNAPSHOT_FN, scrollY);
    if (state) scrollStates.push(state);
    if (i % 10 === 0) process.stdout.write(`  ${Math.round(i / 40 * 100)}%`);
  }
  console.log('  100%');

  // ─── Delta detection ───────────────────────────────────────────────────
  console.log('  → Computing animation deltas...');
  const elTimelines = {};
  for (const state of scrollStates) {
    if (!state || !state.elements) continue;
    for (const el of state.elements) {
      if (!elTimelines[el.s]) elTimelines[el.s] = [];
      elTimelines[el.s].push({
        scrollY: state.scrollY,
        y: el.r.y,
        opacity: el.st.opacity || '1',
        transform: el.tf,
      });
    }
  }

  const animated = {};
  for (const [sel, frames] of Object.entries(elTimelines)) {
    if (frames.length < 3) continue;
    const ops = frames.map(f => parseFloat(f.opacity));
    const opRange = Math.max(...ops) - Math.min(...ops);
    let tfChanges = 0;
    for (let i = 1; i < frames.length; i++) {
      if (frames[i].transform && frames[i-1].transform) {
        const a = frames[i].transform, b = frames[i-1].transform;
        if (Math.abs(a.tx-b.tx)>2 || Math.abs(a.ty-b.ty)>2 ||
            Math.abs(a.sx-b.sx)>0.01 || Math.abs(a.rot-b.rot)>1) tfChanges++;
      }
    }
    if (opRange > 0.2 || tfChanges > 2) {
      animated[sel] = {
        type: 'scroll-animated', opRange: Math.round(opRange*100)/100, tfChanges,
        keyframes: frames.filter((f,i) => i===0 || i===frames.length-1 ||
          (i>0 && Math.abs(parseFloat(f.opacity)-parseFloat(frames[i-1].opacity))>0.05))
          .slice(0, 10),
      };
    }
  }

  // Merge MutationObserver data into animated elements
  for (const mut of styleMutations) {
    if (!animated[mut.selector]) {
      animated[mut.selector] = {
        type: 'js-animated', source: 'MutationObserver',
        initial: mut.initial,
        changes: mut.changes.slice(0, 10),
      };
    } else {
      animated[mut.selector].mutationData = {
        initial: mut.initial,
        changes: mut.changes.slice(0, 10),
      };
    }
  }

  const scrollAnimCount = Object.values(animated).filter(a => a.type === 'scroll-animated').length;
  const jsAnimCount = Object.values(animated).filter(a => a.type === 'js-animated').length;
  console.log(`  ✓ ${scrollAnimCount} scroll-animated, ${jsAnimCount} JS-animated elements`);

  // ═══ Phase 4: Component detection ═══
  console.log('\n⚡ Phase 4: Component & blueprint assembly...');
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(500);
  const components = await page.evaluate(COMPONENTS_FN);
  console.log(`  ✓ ${components.length} components detected:`);
  for (const c of components) {
    const animCount = Object.entries(animated).filter(([sel]) =>
      c.classes.some(cls => sel.includes(cls)) || (c.id && sel.includes(c.id))).length;
    console.log(`    [${c.type.padEnd(14)}] ${c.tag}${c.id?'#'+c.id:''} ${c.rect.h}px ${animCount ? '⚡'+animCount+' anims' : ''}`);
  }

  // ─── Screenshots ───────────────────────────────────────────────────────
  console.log('  → Screenshots...');
  for (const pos of [0, 0.2, 0.4, 0.6, 0.8, 1.0]) {
    await page.evaluate(y => window.scrollTo(0, y), Math.floor(pos * (pageHeight - VIEWPORT.height)));
    await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
    await page.screenshot({
      path: path.join(outputDir, `scroll-${Math.round(pos*100)}.jpg`),
      quality: 85, type: 'jpeg',
    });
  }
  console.log('  ✓ 6 screenshots saved');

  await browser.close();

  // ═══ Assemble final blueprint ═══
  const colors = {};
  for (const [k, v] of Object.entries(cssVars)) {
    if (/#[0-9a-f]{3,8}/i.test(v) || /^rgb/i.test(v) || /^hsl/i.test(v) ||
        /color|bg|background|accent|brand|primary|secondary/i.test(k)) {
      colors[k] = v;
    }
  }

  const easings = {};
  for (const [k, v] of Object.entries(cssVars)) {
    if (/ease|bezier|cubic|motion|transition/i.test(k) || /cubic-bezier/i.test(v)) {
      easings[k] = v;
    }
  }

  const spacing = {};
  for (const [k, v] of Object.entries(cssVars)) {
    if (/space|gap|margin|padding|gutter|grid|size/i.test(k)) {
      spacing[k] = v;
    }
  }

  // Visual intent — rich natural language
  const intent = generateIntent(components, typography, colors, animated, oueData);

  const blueprint = {
    meta: {
      url: IS_URL ? TARGET_URL : path.resolve(TARGET),
      site: hostname,
      analyzedAt: new Date().toISOString(),
      pageHeight,
      viewport: VIEWPORT,
      duration: ((Date.now() - t0) / 1000).toFixed(1) + 's',
    },
    designSystem: {
      colors,
      easings,
      spacing,
      cssVariables: cssVars,
      typography,
    },
    components,
    animations: {
      gsapCalls: oueData.gsapCalls,
      scrollTriggers: oueData.scrollTriggers,
      timelines: oueData.timelines,
      cssKeyframes: oueData.cssKeyframes,
      styleMutations: styleMutations.slice(0, 50),
    },
    scrollDrivenElements: animated,
    interactions: oueData.interactions,
    visualIntent: intent,
  };

  const jsonStr = JSON.stringify(blueprint, null, 2);
  fs.writeFileSync(path.join(outputDir, '_blueprint.json'), jsonStr, 'utf-8');

  // Also save a compact LLM-friendly summary
  const summary = generateLLMSummary(blueprint);
  fs.writeFileSync(path.join(outputDir, '_summary.md'), summary, 'utf-8');

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  const sizeMB = (Buffer.byteLength(jsonStr) / (1024 * 1024)).toFixed(1);

  console.log(`
╔══════════════════════════════════════════════════════════╗
║  DONE in ${elapsed.padStart(6)}s                                      ║
╠══════════════════════════════════════════════════════════╣
║  Components        : ${String(components.length).padStart(5)}                               ║
║  GSAP animations   : ${String(oueData.gsapCalls.length).padStart(5)}                               ║
║  ScrollTriggers    : ${String(oueData.scrollTriggers.length).padStart(5)}                               ║
║  Style mutations   : ${String(styleMutations.length).padStart(5)}  (${oueData.mutationCount} total changes)    ║
║  Scroll-animated   : ${String(scrollAnimCount).padStart(5)}                               ║
║  JS-animated       : ${String(jsAnimCount).padStart(5)}                               ║
║  CSS Variables      : ${String(Object.keys(cssVars).length).padStart(5)}                               ║
║  Interactions      : ${String(oueData.interactions.length).padStart(5)}                               ║
║  Blueprint         : ${(sizeMB + ' MB').padStart(8)}                             ║
╠══════════════════════════════════════════════════════════╣
║  ${path.join(outputDir, '_blueprint.json').slice(-54).padEnd(54)} ║
║  ${path.join(outputDir, '_summary.md').slice(-54).padEnd(54)} ║
╚══════════════════════════════════════════════════════════╝`);
}

// ═══════════════════════════════════════════════════════════════════════════
// VISUAL INTENT GENERATOR
// ═══════════════════════════════════════════════════════════════════════════

function generateIntent(components, typography, colors, animated, oueData) {
  const lines = [];

  // Overall feel
  const colorNames = Object.keys(colors);
  const hasDarkBg = colorNames.some(k => /black|dark/i.test(k));
  const hasLightBg = colorNames.some(k => /white|light|cream/i.test(k));
  const mood = hasDarkBg && !hasLightBg ? 'dark, cinematic' :
               !hasDarkBg && hasLightBg ? 'light, airy' : 'dual-tone (light/dark sections)';
  lines.push(`## Overall Feel\n${mood} aesthetic.`);

  // Typography
  const fonts = Object.entries(typography.families).sort((a,b) => b[1].count - a[1].count);
  if (fonts.length) {
    lines.push(`\n## Typography`);
    for (const [name, data] of fonts.slice(0, 3)) {
      const sizes = Object.entries(data.sizes).sort((a,b) => b[1]-a[1]).map(e=>e[0]);
      const weights = Object.keys(data.weights);
      lines.push(`- **${name}** (${data.count} uses): sizes ${sizes.slice(0,4).join(', ')}; weights ${weights.join(', ')}`);
      for (const ex of data.examples.slice(0, 2)) {
        lines.push(`  - ${ex.tag} "${ex.text}" → ${ex.size}/${ex.weight} ${ex.letterSpacing !== 'normal'?'ls:'+ex.letterSpacing:''} ${ex.textTransform !== 'none'?ex.textTransform:''}`);
      }
    }
  }

  // Colors
  if (colorNames.length) {
    lines.push(`\n## Color Palette`);
    for (const [k, v] of Object.entries(colors).slice(0, 12)) {
      lines.push(`- \`${k}\`: ${v}`);
    }
  }

  // Components
  lines.push(`\n## Page Structure (${components.length} sections)`);
  for (const c of components) {
    const anims = Object.entries(animated).filter(([sel]) =>
      c.classes.some(cls => sel.includes(cls))).length;
    const h = c.content.headings.map(h => `"${h.text}"`).join(', ');
    lines.push(`- **${c.type}** (${c.rect.h}px): ${h || 'no headings'} ${anims ? `[${anims} animations]` : ''}`);
  }

  // Animation patterns
  const animCount = Object.keys(animated).length;
  if (animCount) {
    lines.push(`\n## Animation Patterns (${animCount} animated elements)`);
    const types = {};
    for (const data of Object.values(animated)) {
      types[data.type] = (types[data.type] || 0) + 1;
    }
    for (const [type, count] of Object.entries(types)) {
      lines.push(`- ${type}: ${count} elements`);
    }
  }

  if (oueData.cssKeyframes.length) {
    lines.push(`\n## CSS Keyframes: ${oueData.cssKeyframes.map(k => k.name).join(', ')}`);
  }

  // Interactions
  if (oueData.interactions.length) {
    lines.push(`\n## Interaction Patterns`);
    const transitions = {};
    for (const inter of oueData.interactions) {
      const t = inter.transition.split(',')[0].trim();
      transitions[t] = (transitions[t] || 0) + 1;
    }
    for (const [t, count] of Object.entries(transitions).sort((a,b) => b[1]-a[1]).slice(0, 8)) {
      lines.push(`- \`${t}\` (${count} elements)`);
    }
  }

  return lines.join('\n');
}

// ═══════════════════════════════════════════════════════════════════════════
// LLM-FRIENDLY SUMMARY (compact markdown for context window)
// ═══════════════════════════════════════════════════════════════════════════

function generateLLMSummary(bp) {
  const lines = [];
  lines.push(`# Design Blueprint: ${bp.meta.site}`);
  lines.push(`> Analyzed ${bp.meta.analyzedAt} | ${bp.meta.pageHeight}px tall | ${bp.components.length} sections\n`);

  // Design tokens
  lines.push(`## Design Tokens`);
  lines.push('```css');
  for (const [k, v] of Object.entries(bp.designSystem.colors).slice(0, 15)) {
    lines.push(`${k}: ${v};`);
  }
  for (const [k, v] of Object.entries(bp.designSystem.easings)) {
    lines.push(`${k}: ${v};`);
  }
  lines.push('```\n');

  // Typography
  lines.push(`## Typography`);
  for (const [name, data] of Object.entries(bp.designSystem.typography.families).sort((a,b) => b.count - a.count).slice(0, 4)) {
    lines.push(`### ${name} (${data.count} uses)`);
    for (const ex of data.examples.slice(0, 3)) {
      lines.push(`- ${ex.tag} \`${ex.size}\` / \`${ex.weight}\` / \`${ex.lineHeight}\` — "${ex.text}"`);
    }
  }

  // Components
  lines.push(`\n## Components`);
  for (const c of bp.components) {
    lines.push(`\n### ${c.type} (${c.rect.h}px)`);
    lines.push(`- Classes: \`${c.classes.join(' ')}\``);
    if (Object.keys(c.css).length) {
      lines.push('- Key CSS:');
      for (const [prop, val] of Object.entries(c.css).slice(0, 10)) {
        lines.push(`  - ${prop}: ${val}`);
      }
    }
    if (c.content.headings.length) {
      lines.push('- Headings:');
      for (const h of c.content.headings) {
        lines.push(`  - ${h.tag} "${h.text}" → \`${h.fontFamily}\` ${h.fontSize}/${h.fontWeight} ls:${h.letterSpacing}`);
      }
    }
    if (c.content.buttons.length) {
      lines.push('- Buttons:');
      for (const b of c.content.buttons.slice(0, 3)) {
        lines.push(`  - "${b.text}" → pad:${b.padding} radius:${b.borderRadius} ${b.transition||''}`);
      }
    }
  }

  // Animations
  const animElements = Object.entries(bp.scrollDrivenElements);
  if (animElements.length) {
    lines.push(`\n## Animated Elements (${animElements.length})`);
    for (const [sel, data] of animElements.slice(0, 15)) {
      if (data.type === 'js-animated' && data.changes) {
        const props = [...new Set(data.changes.flatMap(c => Object.keys(c.styles)))];
        lines.push(`- \`${sel}\` — JS-animated: ${props.join(', ')}`);
      } else if (data.keyframes) {
        lines.push(`- \`${sel}\` — scroll (opacity range: ${data.opRange}, transform changes: ${data.tfChanges})`);
      }
    }
  }

  // Interactions
  if (bp.interactions.length) {
    lines.push(`\n## Interactive Elements (${bp.interactions.length})`);
    for (const inter of bp.interactions.slice(0, 10)) {
      lines.push(`- \`${inter.sel.slice(0, 50)}\` "${inter.text}" → ${inter.transition.split(',')[0]}`);
    }
  }

  lines.push(`\n---\n*Blueprint: _blueprint.json (${bp.components.length} components, ${Object.keys(bp.scrollDrivenElements).length} animations)*`);
  return lines.join('\n');
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
