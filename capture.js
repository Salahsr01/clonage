#!/usr/bin/env node
/**
 * capture.js — Main entry point for the OUE capture pipeline.
 *
 * Usage:
 *   node capture.js <url> [output-name]
 *
 * Clones a website by intercepting all network assets, analyzing structure,
 * taking reference screenshots, and writing a structured output bundle.
 */

const path = require('path');
const { chromium } = require('playwright');
const { ensureDir, slugify, log, VIEWPORT } = require('./lib/utils');
const { captureAssets } = require('./lib/clone');
const { analyzeDOM } = require('./lib/analyze');
const { captureScreenshots } = require('./lib/screenshot');

// ---------------------------------------------------------------------------
// Proxy Stubbing — block framework hydration, keep animation libs
// ---------------------------------------------------------------------------

const BLOCK_PATTERNS = [
  /framework/i, /_app/i, /main-app/i, /webpack/i,
  /react-dom/i, /react\.production/i, /next\/dist/i,
  /hydrat/i, /nuxt/i, /vue\.runtime/i, /svelte/i,
  /chunk-\w+\.js$/i,  // generic framework chunks (heuristic)
];

const ALLOW_PATTERNS = [
  /gsap/i, /lenis/i, /scrolltrigger/i, /splittext/i, /customease/i,
  /three/i, /unicornstudio/i, /spline/i, /barba/i,
  /locomotive/i, /swiper/i, /framer-motion/i,
  /anime/i, /motion/i, /webgl/i, /webflow/i,
  /analytics/i, /gtag/i, /gtm/i, /posthog/i, // allow analytics (harmless)
  /polyfill/i, /intersection-observer/i,
];

function classifyScript(url) {
  for (const pat of ALLOW_PATTERNS) {
    if (pat.test(url)) return 'allow';
  }
  for (const pat of BLOCK_PATTERNS) {
    if (pat.test(url)) return 'block';
  }
  return 'allow'; // default: allow (non-framework scripts fail gracefully)
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const url = process.argv[2];
const outputName = process.argv[3];

if (!url) {
  console.error('Usage: node capture.js <url> [output-name]');
  process.exit(1);
}

// Normalise URL
const targetUrl = url.startsWith('http') ? url : `https://${url}`;
const siteName = outputName || slugify(targetUrl);
const siteDir = path.resolve(__dirname, 'sites', siteName);

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

(async () => {
  log('🚀', `Capturing ${targetUrl}`);
  log('📁', `Output → ${siteDir}`);

  // Prepare output directories
  ensureDir(siteDir);
  ensureDir(path.join(siteDir, 'assets'));
  ensureDir(path.join(siteDir, 'screenshots'));

  // Launch browser
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: VIEWPORT });
  const page = await context.newPage();

  try {
    // ------------------------------------------------------------------
    // Phase 0.5: Proxy Stubbing — block hydration, keep animations
    // ------------------------------------------------------------------
    const blockedScripts = [];
    const allowedScripts = [];

    await page.route('**/*.js', (route) => {
      const url = route.request().url();
      const verdict = classifyScript(url);
      if (verdict === 'block') {
        blockedScripts.push(url.split('/').pop().split('?')[0]);
        return route.abort();
      }
      allowedScripts.push(url.split('/').pop().split('?')[0]);
      return route.continue();
    });

    // ------------------------------------------------------------------
    // Phase 1: Intercept & save assets
    // ------------------------------------------------------------------
    log('📦', 'Phase 1: Asset capture');
    const { html, resourceMap } = await captureAssets(page, siteDir, targetUrl);

    log('🛡️', `Proxy Stub: ${blockedScripts.length} blocked, ${allowedScripts.length} allowed`);
    if (blockedScripts.length > 0) {
      log('  ', `Blocked: ${blockedScripts.slice(0, 5).join(', ')}${blockedScripts.length > 5 ? '...' : ''}`);
    }

    // ------------------------------------------------------------------
    // Phase 1.4: Capture running animations (Web Animations API + CDP)
    // ------------------------------------------------------------------
    let capturedAnimations = [];
    try {
      log('🎬', 'Phase 1.4: Capturing animations...');

      // Web Animations API — captures CSS + GSAP + WAAPI animations
      capturedAnimations = await page.evaluate(() => {
        function buildSelector(el) {
          if (!el || el === document.body || el === document.documentElement) return 'body';
          if (el.id) return `#${el.id}`;
          const classes = (el.className?.baseVal || el.className || '').toString().trim();
          const tag = el.tagName?.toLowerCase() || 'div';
          if (classes) return `${tag}.${classes.split(/\s+/).slice(0, 2).join('.')}`;
          return tag;
        }

        return document.getAnimations({ subtree: true }).map(anim => {
          try {
            const kf = anim.effect?.getKeyframes?.() || [];
            const timing = anim.effect?.getComputedTiming?.() || {};
            const target = anim.effect?.target;
            return {
              selector: target ? buildSelector(target) : null,
              type: anim.constructor.name, // CSSAnimation, CSSTransition, Animation
              animationName: anim.animationName || null,
              playState: anim.playState,
              keyframes: kf.map(k => {
                const obj = {};
                for (const [key, val] of Object.entries(k)) {
                  if (key !== 'offset' && key !== 'computedOffset' && key !== 'easing' && key !== 'composite') {
                    obj[key] = val;
                  }
                }
                obj.offset = k.offset;
                obj.easing = k.easing;
                return obj;
              }),
              duration: timing.duration,
              delay: timing.delay,
              iterations: timing.iterations,
              direction: timing.direction,
              fill: timing.fill,
              easing: timing.easing,
            };
          } catch (e) { return null; }
        }).filter(Boolean);
      });

      const fs2 = require('fs');
      if (capturedAnimations.length > 0) {
        fs2.writeFileSync(path.join(siteDir, 'animations.json'), JSON.stringify(capturedAnimations, null, 2));
        log('✓', `Captured ${capturedAnimations.length} animations via Web Animations API`);
      } else {
        log('  ', 'No running animations found');
      }
    } catch (err) {
      log('⚠️', `Animation capture failed (non-fatal): ${err.message}`);
    }

    // ------------------------------------------------------------------
    // Phase 1.5: Bake computed styles into HTML (makes it JS-independent)
    // ------------------------------------------------------------------
    log('🎨', 'Phase 1.5: Baking styles into HTML...');
    const bakedHtml = await page.evaluate(() => {
      // 0. Remove cookie consent banners, chat widgets, and GDPR popups
      const junkSelectors = [
        '[id*="CybotCookiebotDialog"]', '[id*="cookiebot"]', '[id*="onetrust"]',
        '[class*="cookie-banner"]', '[class*="cookie-consent"]', '[data-cookieconsent]',
        '#hs-eu-cookie-confirmation', '.cc-window', '[id*="gdpr"]',
        '[class*="intercom"]', '[id*="intercom"]', '#hubspot-messages-iframe-container',
        '[class*="drift-"]', '[id*="drift-"]', '[class*="chat-widget"]',
        '[id*="zsiqwidget"]', '[id*="tidio"]', '[id*="crisp"]',
      ];
      document.querySelectorAll(junkSelectors.join(',')).forEach(el => el.remove());

      // 1. Remove hidden elements (preloaders, overlays, transitions)
      document.querySelectorAll('[class*="loader"], [class*="preloader"], [class*="loading"], [class*="curtain"], [class*="transition"], [data-preloader]').forEach(el => {
        if (el.offsetWidth > window.innerWidth * 0.5 && el.offsetHeight > window.innerHeight * 0.5) {
          el.remove(); // Only remove full-screen overlays
        }
      });

      // 2. Remove hidden text (elements with display:none or visibility:hidden that JS toggles)
      document.querySelectorAll('[style*="display: none"], [style*="display:none"]').forEach(el => el.remove());

      // 3. For elements with animation initial states, bake the FINAL computed state
      document.querySelectorAll('*').forEach(el => {
        const cs = getComputedStyle(el);
        // Fix clip-path animation states
        if (cs.clipPath && cs.clipPath !== 'none' && cs.clipPath.includes('inset')) {
          el.style.clipPath = 'none';
        }
        // Fix opacity 0 (animation initial state)
        if (cs.opacity === '0') {
          el.style.opacity = '1';
        }
        // Fix visibility hidden
        if (cs.visibility === 'hidden') {
          el.style.visibility = 'visible';
        }
      });

      // 4. Replace _next/image optimizer URLs with direct image URLs
      document.querySelectorAll('img').forEach(img => {
        ['src', 'data-src'].forEach(attr => {
          const val = img.getAttribute(attr) || '';
          if (val.includes('_next/image')) {
            try {
              const urlParam = new URL(val, location.origin).searchParams.get('url');
              if (urlParam) img.setAttribute(attr, urlParam);
            } catch(e) {}
          }
        });
        const srcset = img.getAttribute('srcset') || '';
        if (srcset.includes('_next/image')) {
          const newSrcset = srcset.replace(/\/_next\/image\?url=([^&]+)[^\s,]*/g, (m, url) => {
            try { return decodeURIComponent(url); } catch(e) { return m; }
          });
          img.setAttribute('srcset', newSrcset);
        }
        // Also bake currentSrc as src (ensures the actual loaded image is saved)
        if (img.currentSrc && !img.currentSrc.includes('_next/image')) {
          img.setAttribute('src', img.currentSrc);
        }
        img.removeAttribute('srcset'); // Remove srcset to avoid confusion
        img.removeAttribute('loading'); // Remove lazy loading
      });

      // 4b. Remove hidden toggle text (e.g., "CLOSE" that only shows when menu is open)
      document.querySelectorAll('[style*="transform: none"]').forEach(el => {
        // Elements with inline transform:none that are menu close buttons
        const text = el.textContent.trim().toLowerCase();
        if (text === 'close' || text === 'fermer') el.remove();
      });
      // Also remove elements positioned off-screen (used for transitions)
      document.querySelectorAll('[class*="translate-y-full"], [class*="-translate-y-full"]').forEach(el => {
        const r = el.getBoundingClientRect();
        if (r.top > window.innerHeight * 2 || r.top < -window.innerHeight) el.remove();
      });

      // 5. Remove script tags and preloads (baked.html = static, no JS)
      //    Note: framework hydration was already blocked by proxy stubbing,
      //    so the DOM state is correct. We strip scripts here for a clean static file.
      document.querySelectorAll('script').forEach(s => s.remove());
      document.querySelectorAll('link[rel="preload"][as="script"], link[rel="modulepreload"]').forEach(l => l.remove());
      document.querySelectorAll('noscript').forEach(s => s.remove());

      return document.documentElement.outerHTML;
    });

    // Download any images that reference external CDNs
    const fs = require('fs');
    const { URL: NodeURL } = require('url');
    const imgUrls = bakedHtml.match(/src="(https?:\/\/[^"]+)"/g) || [];
    let downloadedImgs = 0;
    for (const match of imgUrls) {
      const imgUrl = match.slice(5, -1); // Extract URL from src="..."
      if (imgUrl.includes('cdn.sanity.io') || imgUrl.includes('.png') || imgUrl.includes('.jpg') || imgUrl.includes('.webp')) {
        try {
          const resp = await page.context().request.get(imgUrl);
          if (resp.ok()) {
            const body = await resp.body();
            const parsed = new NodeURL(imgUrl);
            const filename = parsed.pathname.split('/').pop().split('?')[0] || `img_${downloadedImgs}.png`;
            const imgDir = path.join(siteDir, 'assets', 'images');
            ensureDir(imgDir);
            fs.writeFileSync(path.join(imgDir, filename), body);
            downloadedImgs++;
          }
        } catch(e) { /* skip failed downloads */ }
      }
    }
    if (downloadedImgs > 0) log('🖼️', `Downloaded ${downloadedImgs} CDN images`);

    // Save baked HTML
    fs.writeFileSync(path.join(siteDir, 'baked.html'), '<!DOCTYPE html>\n' + bakedHtml);
    log('✓', `Baked HTML saved (${(bakedHtml.length / 1024).toFixed(0)}KB)`);

    // Save proxy stub metadata
    fs.writeFileSync(path.join(siteDir, 'proxy-stub.json'), JSON.stringify({
      blockedScripts,
      allowedScripts: allowedScripts.slice(0, 50), // cap for size
      blockedCount: blockedScripts.length,
      allowedCount: allowedScripts.length,
    }, null, 2));
    log('✓', `Proxy stub metadata saved`);

    // ------------------------------------------------------------------
    // Phase 2: Analyze page structure (DOM, computed styles, semantic tree)
    // ------------------------------------------------------------------
    const analysis = await analyzeDOM(page, siteDir);

    // ------------------------------------------------------------------
    // Phase 2.5: CDP DOMSnapshot (optional enrichment — richer data)
    // ------------------------------------------------------------------
    try {
      log('🔬', 'Phase 2.5: CDP DOMSnapshot capture...');
      const cdp = await page.context().newCDPSession(page);
      const cdpT0 = Date.now();
      const snapshot = await cdp.send('DOMSnapshot.captureSnapshot', {
        computedStyles: [
          'display', 'position', 'flex-direction', 'grid-template-columns', 'gap',
          'font-family', 'font-size', 'font-weight', 'line-height', 'letter-spacing',
          'color', 'background-color', 'border-radius', 'padding', 'margin',
          'width', 'height', 'max-width', 'overflow', 'opacity', 'visibility',
          'transform', 'z-index', 'border', 'box-shadow', 'text-align',
          'justify-content', 'align-items',
        ],
        includeDOMRects: true,
        includePaintOrder: true,
      });
      await cdp.detach();

      const cdpJson = JSON.stringify(snapshot);
      const fs2 = require('fs');
      fs2.writeFileSync(path.join(siteDir, 'cdp-snapshot.json'), cdpJson);
      const nodeCount = snapshot.documents[0]?.nodes?.nodeType?.length || 0;
      log('✓', `CDP snapshot: ${nodeCount} nodes, ${(cdpJson.length / 1024 / 1024).toFixed(1)}MB in ${Date.now() - cdpT0}ms`);
    } catch (err) {
      log('⚠️', `CDP snapshot failed (non-fatal): ${err.message}`);
    }

    // ------------------------------------------------------------------
    // Phase 3: Take reference screenshots
    // ------------------------------------------------------------------
    await captureScreenshots(page, siteDir, analysis.sections);

    // ------------------------------------------------------------------
    // Phase 4: Write structured output
    // TODO: manifest.json, analysis.json, assets index
    // ------------------------------------------------------------------
    log('💾', 'Phase 4: Write output — TODO');

    log('✅', `Capture skeleton complete for ${siteName}`);
  } catch (err) {
    log('❌', `Capture failed: ${err.message}`);
    console.error(err);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
