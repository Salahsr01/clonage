#!/usr/bin/env node

/**
 * ═══════════════════════════════════════════════════════════════════
 *  OUE SITE CLONER — Unified v4
 * ═══════════════════════════════════════════════════════════════════
 *
 *  Merges the best of clone-site.js (v2) and clone-fast.js (v3):
 *    - Parallel tab crawling (v3)
 *    - Auto CDN detection (v3)
 *    - Explicit resource extraction from DOM (v3)
 *    - HTML statification for offline viewing (v2)
 *    - URL rewriting with exact mapping (v2)
 *    - CSS/JS post-processing (v2)
 *    - Smart lazy-load forcing (both)
 *
 *  INSTALL:  npm install playwright && npx playwright install chromium
 *  USAGE:    node clone.js <url> [output-dir]
 *            HEADLESS=false node clone.js <url>
 *  SERVE:    node serve-clone.js 3000 ./output_dir
 * ═══════════════════════════════════════════════════════════════════
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

// ─── CLI ────────────────────────────────────────────────────────────────────

const TARGET_URL = process.argv[2];
if (!TARGET_URL) {
  console.error('Usage: node clone.js <url> [output-dir]');
  console.error('  Ex:  node clone.js https://www.example.com/');
  process.exit(1);
}

let mainHostname;
try { mainHostname = new URL(TARGET_URL).hostname.replace(/^www\./, ''); }
catch { console.error('URL invalide:', TARGET_URL); process.exit(1); }

const OUTPUT_DIR = path.resolve(
  process.argv[3] || `./${mainHostname.replace(/\./g, '_')}_clone`
);

// ─── Config ─────────────────────────────────────────────────────────────────

const CONCURRENCY     = 3;
const SCROLL_STEP     = 500;
const SCROLL_DELAY    = 150;
const PAGE_SETTLE     = 2500;
const NAV_TIMEOUT     = 60_000;
const HEADLESS        = process.env.HEADLESS !== 'false';
const VIEWPORT        = { width: 1920, height: 1080 };

// CDN domains auto-enriched at runtime via learnDomain()
const allowedDomains = new Set([
  'fonts.googleapis.com', 'fonts.gstatic.com',
  'cdnjs.cloudflare.com', 'cdn.jsdelivr.net', 'unpkg.com',
  'ajax.googleapis.com',
  // Video CDNs
  'i.vimeocdn.com', 'player.vimeo.com', 'vod-progressive.akamaized.net',
  // Image CDNs
  'a.storyblok.com', 'img2.storyblok.com', 'img.storyblok.com',
  'images.unsplash.com', 'images.ctfassets.net',
  'cdn.sanity.io',
]);

const blockedDomains = new Set([
  'www.google-analytics.com', 'www.googletagmanager.com',
  'analytics.google.com', 'region1.google-analytics.com',
  'stats.g.doubleclick.net', 'td.doubleclick.net',
  'googleads.g.doubleclick.net',
  'www.facebook.com', 'connect.facebook.net',
  'px.ads.linkedin.com', 'snap.licdn.com',
  'bat.bing.com', 'tr.snapchat.com',
  'sentry.io', 'js.sentry-cdn.com',
  'hotjar.com', 'static.hotjar.com',
  'clarity.ms', 'www.clarity.ms',
  'cdn.segment.com', 'analytics.ahrefs.com',
  'app.storyblok.com',
]);

// ─── Binary detection ───────────────────────────────────────────────────────

const BIN_EXT = new Set([
  '.png','.jpg','.jpeg','.gif','.webp','.avif','.ico','.bmp','.tiff',
  '.mp4','.webm','.ogg','.mov','.avi','.mp3','.wav','.flac','.aac',
  '.woff','.woff2','.ttf','.otf','.eot',
  '.glb','.gltf','.obj','.fbx','.stl','.bin','.hdr','.exr',
  '.ktx','.ktx2','.basis','.draco','.drc',
  '.pdf','.zip','.gz','.wasm','.dat',
]);
const BIN_CT = [
  'image/','video/','audio/','font/','model/',
  'application/octet-stream','application/wasm','application/zip',
  'application/gzip','application/pdf',
  'application/x-font','application/font',
];

function isBinary(url, ct) {
  try { if (BIN_EXT.has(path.extname(new URL(url).pathname).toLowerCase())) return true; } catch {}
  if (ct) { const c = ct.toLowerCase(); for (const p of BIN_CT) if (c.startsWith(p)) return true; }
  return false;
}

// ─── State ──────────────────────────────────────────────────────────────────

const saved       = new Set();
const visited     = new Set();
const pending     = [];
const urlToPath_  = new Map();   // URL → local relative path (for exact rewriting)
let   stats       = { files: 0, bytes: 0, errors: 0, pages: 0 };
const t0          = Date.now();

// ─── URL → local path ──────────────────────────────────────────────────────

function urlToLocalPath(urlStr, contentType) {
  let u;
  try { u = new URL(urlStr); } catch { return null; }

  const hostname = u.hostname;
  const isMain = hostname === mainHostname
    || hostname === `www.${mainHostname}`
    || hostname.endsWith(`.${mainHostname}`);
  const base = isMain ? OUTPUT_DIR : path.join(OUTPUT_DIR, '__ext__', hostname);

  let fp = decodeURIComponent(u.pathname);

  // Trailing slash or empty → index.html
  if (fp.endsWith('/') || fp === '') fp = path.join(fp, 'index.html');
  else if (!path.extname(fp)) {
    // No extension — infer from Content-Type or treat as directory
    if (contentType) {
      const ct = contentType.split(';')[0].trim().toLowerCase();
      const ext = MIME_TO_EXT[ct];
      if (ext && ext !== '.html') fp += ext;
      else fp = path.join(fp, 'index.html');
    } else {
      fp = path.join(fp, 'index.html');
    }
  }

  // Handle Storyblok-style transform URLs: filters_format(avif)_quality(70)
  const extCheck = path.extname(fp);
  if (!extCheck || extCheck === '.') {
    const fmtMatch = fp.match(/filters_format\((\w+)\)_quality\(\d+\)$/);
    if (fmtMatch) {
      const fmt = fmtMatch[1];
      fp += fmt === 'jpeg' ? '.jpg' : `.${fmt}`;
    }
  }

  // Sanitize
  fp = fp.replace(/[?#]/g, '_').replace(/:/g, '_');

  return path.join(base, fp);
}

const MIME_TO_EXT = {
  'image/avif': '.avif', 'image/webp': '.webp', 'image/jpeg': '.jpg',
  'image/png': '.png', 'image/gif': '.gif', 'image/svg+xml': '.svg',
  'image/x-icon': '.ico', 'image/vnd.microsoft.icon': '.ico',
  'video/mp4': '.mp4', 'video/webm': '.webm', 'video/ogg': '.ogg',
  'audio/mpeg': '.mp3', 'audio/wav': '.wav',
  'font/woff2': '.woff2', 'font/woff': '.woff', 'font/ttf': '.ttf', 'font/otf': '.otf',
  'application/font-woff2': '.woff2', 'application/font-woff': '.woff',
  'application/javascript': '.js', 'text/javascript': '.js',
  'text/css': '.css', 'text/html': '.html',
  'application/json': '.json', 'application/wasm': '.wasm',
  'application/pdf': '.pdf', 'model/gltf-binary': '.glb',
};

// ─── Domain filtering ───────────────────────────────────────────────────────

function shouldCapture(urlStr) {
  let u;
  try { u = new URL(urlStr); } catch { return false; }
  if (!['http:','https:'].includes(u.protocol)) return false;
  if (blockedDomains.has(u.hostname)) return false;
  if (u.hostname === mainHostname
    || u.hostname === `www.${mainHostname}`
    || u.hostname.endsWith(`.${mainHostname}`)) return true;
  return allowedDomains.has(u.hostname);
}

// Auto-detect CDN domains from network traffic
const ASSET_EXT = new Set([
  '.js','.css','.woff','.woff2','.ttf','.otf',
  '.jpg','.jpeg','.png','.webp','.avif','.svg','.gif','.ico',
  '.mp4','.webm','.glb','.gltf','.json','.wasm','.mp3',
]);

function learnDomain(urlStr) {
  try {
    const u = new URL(urlStr);
    if (u.hostname === mainHostname || blockedDomains.has(u.hostname) || allowedDomains.has(u.hostname)) return;
    const ext = path.extname(u.pathname).toLowerCase();
    if (ASSET_EXT.has(ext) || /\/(assets|static|fonts|images|media|uploads|js|css)\//i.test(u.pathname)) {
      allowedDomains.add(u.hostname);
      console.log(`  🔍 CDN auto-detected: ${u.hostname}`);
    }
  } catch {}
}

// ─── Save file with conflict resolution ─────────────────────────────────────

function saveFile(urlStr, body, ct) {
  if (!body || body.length === 0) return false;

  const canonUrl = urlStr.split('?')[0];
  if (saved.has(canonUrl)) return false;

  const fp = urlToLocalPath(urlStr, ct);
  if (!fp) return false;

  try {
    let target = fp;
    if (fs.existsSync(target) && fs.statSync(target).isDirectory()) {
      target = path.join(target, 'index.html');
    }

    // Resolve file-vs-directory conflicts in parent chain
    const dir = path.dirname(target);
    const segs = path.relative(OUTPUT_DIR, dir).split(path.sep);
    let cur = OUTPUT_DIR;
    for (const seg of segs) {
      if (!seg) continue;
      cur = path.join(cur, seg);
      if (fs.existsSync(cur) && fs.statSync(cur).isFile()) {
        const tmp = fs.readFileSync(cur);
        fs.unlinkSync(cur);
        fs.mkdirSync(cur, { recursive: true });
        fs.writeFileSync(path.join(cur, 'index.html'), tmp);
      }
    }

    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, body);

    saved.add(canonUrl);
    stats.files++;
    stats.bytes += body.length;

    // Store mapping for exact URL rewriting
    const relPath = '/' + path.relative(OUTPUT_DIR, target);
    urlToPath_.set(urlStr, relPath);

    if (body.length > 10240) {
      const rel = path.relative(OUTPUT_DIR, target);
      const kb = (body.length / 1024).toFixed(0);
      process.stdout.write(`  ${kb.padStart(6)} KB  ${rel.length > 75 ? '…' + rel.slice(-72) : rel}\n`);
    }
    return true;
  } catch (e) {
    stats.errors++;
    return false;
  }
}

// ─── URL rewriting ──────────────────────────────────────────────────────────

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function rewriteUrls(content) {
  let out = content;

  // Remove SRI integrity (hash won't match after rewriting)
  out = out.replace(/\s+integrity="[^"]*"/g, '');
  out = out.replace(/\s+crossorigin="[^"]*"/g, '');

  // Remove lazy-load placeholders (Apple-style: <source data-empty srcset="data:image/gif...">)
  out = out.replace(/<source[^>]*data-empty[^>]*>/gi, '');

  // Phase 1: Exact mapping replacements (longest first to avoid partial matches)
  const sorted = [...urlToPath_.entries()].sort((a, b) => b[0].length - a[0].length);
  for (const [originalUrl, localPath] of sorted) {
    if (out.includes(originalUrl)) {
      out = out.split(originalUrl).join(localPath);
    }
  }

  // Phase 2: Regex fallback for uncaptured URLs
  // Main domain → relative paths (https://, http://, and protocol-relative //)
  const esc = escapeRegex(mainHostname);
  out = out.replace(
    new RegExp(`(?:https?:)?//(www\\.)?${esc}(/[^"'\\s>);}]*)`, 'g'),
    (_, _w, p) => p || '/'
  );

  // External domains → __ext__
  for (const d of allowedDomains) {
    const de = escapeRegex(d);
    out = out.replace(
      new RegExp(`(?:https?:)?//${de}(/[^"'\\s>);}]*)`, 'g'),
      (_, p) => {
        let lp = `/__ext__/${d}${p || '/'}`;
        // Handle Storyblok transform URLs
        const fmtMatch = lp.match(/filters_format\((\w+)\)_quality\(\d+\)$/);
        if (fmtMatch) {
          const fmt = fmtMatch[1];
          lp += fmt === 'jpeg' ? '.jpg' : `.${fmt}`;
        }
        return lp;
      }
    );
  }

  return out;
}

// ─── HTML statification (from v2) ───────────────────────────────────────────
// Removes framework JS (Nuxt, Next, etc.) so the clone stays static HTML.
// Forces visibility of animated/revealed elements.

function statifyHtml(html) {
  let result = html;

  // 1) Remove all <script> except JSON-LD and application/json
  result = result.replace(
    /<script\b([^>]*)>([\s\S]*?)<\/script>/gi,
    (match, attrs) => {
      if (/type=["'](application\/ld\+json|application\/json)["']/i.test(attrs)) return match;
      return '';
    }
  );

  // 2) Remove modulepreload and script preload links
  result = result.replace(/<link\b[^>]*?\brel=["']modulepreload["'][^>]*\/?>/gi, '');
  result = result.replace(/<link\b[^>]*?\brel=["']preload["'][^>]*?\bas=["']script["'][^>]*\/?>/gi, '');

  // 3-6) Fix visibility/opacity/transforms/clip ONLY inside <style> blocks
  //      (not in the full HTML — that causes catastrophic regex performance on large DOMs)
  result = result.replace(
    /(<style\b[^>]*>)([\s\S]*?)(<\/style>)/gi,
    (match, open, css, close) => {
      let fixed = css;
      fixed = fixed.replace(/visibility\s*:\s*hidden/g, 'visibility:visible');
      // Opacity: fix 0→1, skip overlays
      fixed = fixed.replace(
        /([^{}]*)\{([^}]*opacity\s*:\s*0(?![.\d])[^}]*)\}/g,
        (m, sel, body) => {
          const isOverlay = body.includes('pointer-events:none') || body.includes('pointer-events: none')
            || (sel.includes('.bg') && body.includes('position:absolute'));
          if (isOverlay) return m;
          return `${sel}{${body.replace(/opacity\s*:\s*0(?![.\d])/g, 'opacity:1')}}`;
        }
      );
      // Transforms
      fixed = fixed.replace(/transform\s*:\s*scale\(\s*0\s*\)/g, 'transform:scale(1)');
      fixed = fixed.replace(/transform\s*:\s*translateY\(\s*[+-]?100%\s*\)/g, 'transform:translateY(0)');
      fixed = fixed.replace(/transform\s*:\s*translateX\(\s*[+-]?100%\s*\)/g, 'transform:translateX(0)');
      // Clip
      fixed = fixed.replace(
        /([^{}]*)\{([^}]*clip\s*:\s*rect\(0[^)]*\)[^}]*)\}/g,
        (m, sel, body) => {
          if (sel.includes('sr-only') || sel.includes('visually-hidden')
            || body.includes('width:1px') || body.includes('width: 1px')) return m;
          return `${sel}{${body.replace(/clip\s*:\s*rect\(0[^)]*\)/g, 'clip:auto')}}`;
        }
      );
      return open + fixed + close;
    }
  );

  // 7) Inject visibility fix CSS block
  const visibilityFix = `<style id="oue-clone-fix">
*{visibility:visible!important}
*{animation-play-state:paused!important;animation:none!important}
video,img,picture,source{opacity:1!important;visibility:visible!important}
main,section,article,header,footer,nav,div,p,h1,h2,h3,h4,h5,h6,span,a,ul,li,figure{
  visibility:visible!important;opacity:1!important;
}
#__nuxt,#__layout,#app,#__next,.page,.wrapper{
  opacity:1!important;visibility:visible!important;
}
.loader,.preloader,[class*="loader"],[class*="preload"],[class*="splash"],[class*="intro-screen"]{
  display:none!important;
}
[class*="reveal"],[class*="animate"],[class*="appear"],[class*="enter"],[class*="fade-reveal"],[class*="slide-up"]{
  height:auto!important;overflow:visible!important;opacity:1!important;
  transform:none!important;clip-path:none!important;filter:none!important;
}
[class*="reveal"]>*,[class*="animate"]>*,[class*="mask"]>*{
  opacity:1!important;visibility:visible!important;transform:none!important;
  clip-path:none!important;filter:none!important;
}
[data-anim-lazy-image],picture.static{opacity:1!important;visibility:visible!important}
</style>`;

  const bodyMatch = result.match(/<(div|nav|main|section|header)\b/i);
  if (bodyMatch) {
    const idx = result.indexOf(bodyMatch[0]);
    result = result.slice(0, idx) + visibilityFix + result.slice(idx);
  }

  return result;
}

// ─── Smart scroll (viewport-by-viewport with lazy-load triggers) ────────────

async function smartScroll(page) {
  try {
    const viewH = await page.evaluate(() => window.innerHeight);
    let totalH = await page.evaluate(() => document.body.scrollHeight);
    let pos = 0;

    while (pos < totalH) {
      pos = Math.min(pos + SCROLL_STEP, totalH);
      await page.evaluate(y => window.scrollTo({ top: y, behavior: 'smooth' }), pos);
      await page.waitForTimeout(SCROLL_DELAY);

      // Every 2 viewports, pause longer for ScrollTrigger/lazy-load
      if (pos % (viewH * 2) < SCROLL_STEP) {
        await page.waitForTimeout(400);
      }

      // Check if page grew (infinite scroll, lazy sections)
      const h = await page.evaluate(() => document.body.scrollHeight);
      if (h > totalH) {
        console.log(`  ↕ Page extended: ${totalH}px → ${h}px`);
        totalH = h;
      }
    }

    // Back to top (some sites load on scroll up)
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
    await page.waitForTimeout(500);
  } catch {}
}

// ─── Force lazy loading ─────────────────────────────────────────────────────

async function forceLazy(page) {
  try {
    await page.evaluate(() => {
      // Images
      document.querySelectorAll('img[data-src], img[loading="lazy"]').forEach(i => {
        if (i.dataset.src) i.src = i.dataset.src;
        i.loading = 'eager';
      });
      // Srcset
      document.querySelectorAll('[data-srcset]').forEach(e => {
        if (e.dataset.srcset) e.srcset = e.dataset.srcset;
      });
      // Videos
      document.querySelectorAll('video[data-src], video source[data-src]').forEach(e => {
        if (e.dataset.src) e.src = e.dataset.src;
      });
      // Iframes
      document.querySelectorAll('iframe[data-src]').forEach(e => {
        if (e.dataset.src) e.src = e.dataset.src;
      });
      // Background images
      document.querySelectorAll('[data-bg]').forEach(e => {
        if (e.dataset.bg) e.style.backgroundImage = `url(${e.dataset.bg})`;
      });
      // Nuxt/Vue lazy hydrate
      document.querySelectorAll('[data-v-inspector], .nuxt-lazy-hydrate').forEach(el => {
        el.dispatchEvent && el.dispatchEvent(new MouseEvent('mouseenter'));
      });

      window.dispatchEvent(new Event('resize'));
      window.dispatchEvent(new Event('scroll'));
    });
  } catch {}
}

// ─── Force DOM visibility (ensure page.content() captures revealed state) ───

async function forceVisibility(page) {
  try {
    await page.evaluate(() => {
      // Inject a global style override (fast, no DOM iteration)
      const style = document.createElement('style');
      style.id = 'oue-force-visible';
      style.textContent = `
        *{visibility:visible!important;animation:none!important;transition:none!important}
        [class*="intro"],[class*="hero"],[class*="reveal"],[class*="animate"],
        [class*="appear"],[class*="enter"],[class*="fade"],[class*="slide"]{
          opacity:1!important;transform:none!important;clip-path:none!important;filter:none!important;
        }
      `;
      document.head.appendChild(style);

      // Only fix inline styles on layout-level elements (NOT every DOM node —
      // Lottie/SVG can have 100K+ nodes and freeze the browser)
      const selectors = 'section,article,header,footer,nav,main,div,p,h1,h2,h3,h4,h5,h6,span,a,figure,img,video,picture';
      document.querySelectorAll(selectors).forEach(el => {
        const s = el.style;
        if (s.opacity === '0') s.opacity = '1';
        if (s.visibility === 'hidden') s.visibility = 'visible';
        if (s.display === 'none' && !el.closest('.loader, .preloader, [class*="loader"]')) {
          s.display = '';
        }
        const t = s.transform;
        if (t && (t.includes('scale(0') || (t.includes('translate') && /100%|200%|-100%|-200%/.test(t)))) {
          s.transform = 'none';
        }
      });
    });
  } catch {}
}

// ─── Extract all resource URLs from the live DOM ────────────────────────────

async function extractResourceUrls(page) {
  try {
    return await page.evaluate(() => {
      const urls = new Set();

      // srcset entries
      document.querySelectorAll('[srcset]').forEach(el => {
        el.srcset.split(',').forEach(entry => {
          const u = entry.trim().split(/\s+/)[0];
          if (u) urls.add(u);
        });
      });

      // src attributes
      document.querySelectorAll('[src]').forEach(el => {
        if (el.src) urls.add(el.src);
      });

      // Video sources + poster
      document.querySelectorAll('video source[src], video[src]').forEach(el => {
        if (el.src) urls.add(el.src);
      });
      document.querySelectorAll('[poster]').forEach(el => {
        if (el.poster) urls.add(el.poster);
      });

      // data-src (lazy)
      document.querySelectorAll('[data-src]').forEach(el => {
        if (el.dataset.src) urls.add(el.dataset.src);
      });

      // Background images in style attributes
      document.querySelectorAll('[style*="url("]').forEach(el => {
        const matches = el.style.cssText.matchAll(/url\(["']?([^"')]+)["']?\)/g);
        for (const m of matches) urls.add(m[1]);
      });

      // CSS @font-face and background urls from stylesheets
      try {
        for (const sheet of document.styleSheets) {
          try {
            for (const rule of sheet.cssRules) {
              const text = rule.cssText;
              const matches = text.matchAll(/url\(["']?([^"')]+)["']?\)/g);
              for (const m of matches) {
                try { urls.add(new URL(m[1], sheet.href || location.href).href); } catch {}
              }
            }
          } catch {}
        }
      } catch {}

      return [...urls].filter(u => u.startsWith('http'));
    });
  } catch { return []; }
}

// ─── Download a URL directly (for resources missed by network listener) ─────

async function downloadUrl(context, urlStr) {
  const canon = urlStr.split('?')[0];
  if (saved.has(canon)) return;
  if (!shouldCapture(urlStr)) return;

  try {
    const resp = await context.request.get(urlStr, { timeout: 15000 });
    if (resp.ok()) {
      const body = await resp.body();
      const ct = resp.headers()['content-type'] || '';
      saveFile(urlStr, body, ct);
    }
  } catch {}
}

// ─── Extract internal links ─────────────────────────────────────────────────

async function extractLinks(page) {
  try {
    return await page.evaluate((host) => {
      return [...new Set(
        Array.from(document.querySelectorAll('a[href]'))
          .map(a => {
            try {
              const u = new URL(a.href);
              u.hash = '';
              u.search = '';
              return u.href;
            } catch { return null; }
          })
          .filter(h => {
            if (!h) return false;
            const hostname = new URL(h).hostname;
            return hostname === host || hostname === `www.${host}`;
          })
      )];
    }, mainHostname);
  } catch { return []; }
}

// ─── Process a single page ──────────────────────────────────────────────────

async function processPage(context, url) {
  if (visited.has(url)) return [];
  visited.add(url);
  stats.pages++;

  const shortUrl = url.replace(new RegExp(`https?://(www\\.)?${escapeRegex(mainHostname)}`), '') || '/';
  const elapsed = ((Date.now() - t0) / 1000).toFixed(0);
  console.log(`\n⚡ [${elapsed}s] Page ${stats.pages}: ${shortUrl}`);

  const page = await context.newPage();
  page.setDefaultTimeout(NAV_TIMEOUT);

  let originalHtmlSaved = false;

  // ─── Network interception ──────────────────────────────────────────────
  page.on('response', async (resp) => {
    const rUrl = resp.url();
    if (resp.status() < 200 || resp.status() >= 300) return;
    if (saved.has(rUrl.split('?')[0])) return;

    learnDomain(rUrl);
    if (!shouldCapture(rUrl)) return;

    try {
      const ct = resp.headers()['content-type'] || '';
      const body = await resp.body();
      if (!body || body.length === 0) return;

      // Rewrite CSS urls inline during capture
      if (ct.includes('text/css') || rUrl.endsWith('.css')) {
        const rewritten = rewriteUrls(body.toString('utf-8'));
        saveFile(rUrl, Buffer.from(rewritten, 'utf-8'), ct);
      }
      // Skip RSC payloads
      else if (rUrl.includes('_rsc=') || ct.includes('text/x-component')) {
        return;
      }
      // HTML — save from network but we'll overwrite with statified version later
      else if (ct.includes('text/html') && !isBinary(rUrl, ct)) {
        saveFile(rUrl, body, ct);
        if (rUrl.split('?')[0] === url.split('?')[0]
          || rUrl.split('?')[0] === url.replace(/\/$/, '').split('?')[0]) {
          originalHtmlSaved = true;
        }
      }
      else {
        saveFile(rUrl, body, ct);
      }
    } catch {}
  });

  let links = [];
  try {
    // Navigate — use domcontentloaded (not load) because WebGL/3D sites
    // never finish loading due to continuous rendering. Assets are captured
    // via the network listener regardless.
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT });
    // Wait for additional network activity (fonts, images, scripts)
    await page.waitForLoadState('load', { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(2000);

    // Scroll to trigger lazy/ScrollTrigger content
    await smartScroll(page);

    // Force lazy + settle
    await forceLazy(page);
    await page.waitForTimeout(PAGE_SETTLE);

    // Wait for network
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});

    // ─── Explicit resource extraction ──────────────────────────────────
    const resourceUrls = await extractResourceUrls(page);
    const missing = resourceUrls.filter(u => {
      const canon = u.split('?')[0];
      return !saved.has(canon) && shouldCapture(u);
    });

    if (missing.length > 0) {
      console.log(`  📥 ${missing.length} missing resources, downloading...`);
      for (let i = 0; i < missing.length; i += 10) {
        const batch = missing.slice(i, i + 10);
        await Promise.allSettled(batch.map(u => downloadUrl(context, u)));
      }
    }

    // ─── Detect if site is JS-driven (WebGL/Canvas/SPA) ────────────────
    const isJsDriven = await page.evaluate(() => {
      // Check for WebGL canvas, Three.js, heavy JS-driven layouts
      const hasCanvas = document.querySelectorAll('canvas').length > 0;
      const hasWebGL = !!document.querySelector('canvas[data-engine], canvas.webgl, canvas#webgl');
      const hasThreeJs = typeof window.THREE !== 'undefined'
        || !!document.querySelector('script[src*="three"]')
        || !!document.querySelector('canvas');
      const hasGSAPLayout = typeof window.gsap !== 'undefined'
        && document.querySelectorAll('[style*="translate"]').length > 10;
      // If canvas takes most of the viewport, it's a WebGL site
      const canvasCoversPage = [...document.querySelectorAll('canvas')].some(c => {
        const r = c.getBoundingClientRect();
        return r.width > window.innerWidth * 0.5 && r.height > window.innerHeight * 0.5;
      });
      return hasCanvas && (hasWebGL || canvasCoversPage || hasThreeJs);
    }).catch(() => false);

    if (isJsDriven) {
      console.log(`  🎮 JS-driven site detected (WebGL/Canvas) — keeping scripts`);
    }

    // ─── Save HTML ───────────────────────────────────────────────────────
    const htmlPath = urlToLocalPath(url, 'text/html');
    if (htmlPath) {
      let finalHtml = null;

      if (isJsDriven) {
        // JS-driven sites: use the ORIGINAL network HTML (with scripts intact)
        // so the 3D/WebGL rendering still works. Only rewrite asset URLs.
        if (originalHtmlSaved && fs.existsSync(htmlPath)) {
          finalHtml = fs.readFileSync(htmlPath, 'utf-8');
          console.log(`  → Using original HTML with scripts (${(finalHtml.length / 1024).toFixed(0)} KB)`);
        } else {
          // Fallback: page.content() but WITHOUT statification
          try {
            finalHtml = await Promise.race([
              page.content(),
              new Promise((_, reject) => setTimeout(() => reject(new Error('content timeout')), 15000)),
            ]);
            if (finalHtml) console.log(`  → Using live DOM with scripts (${(finalHtml.length / 1024).toFixed(0)} KB)`);
          } catch (e) {
            console.log(`  ⚠ page.content() ${e.message.slice(0, 40)}`);
          }
        }
        // Only rewrite URLs, do NOT strip scripts
        if (finalHtml) {
          finalHtml = rewriteUrls(finalHtml);
        }
      } else {
        // Traditional sites: capture post-JS DOM and statify
        try {
          await forceVisibility(page);
          await page.waitForTimeout(500);
          const liveHtml = await Promise.race([
            page.content(),
            new Promise((_, reject) => setTimeout(() => reject(new Error('content timeout')), 15000)),
          ]);
          if (liveHtml && liveHtml.length > 500) {
            finalHtml = liveHtml;
            console.log(`  → Using live DOM (${(liveHtml.length / 1024).toFixed(0)} KB)`);
          }
        } catch (e) {
          console.log(`  ⚠ page.content() ${e.message.slice(0, 40)}, using network HTML`);
        }

        if (!finalHtml && originalHtmlSaved && fs.existsSync(htmlPath)) {
          finalHtml = fs.readFileSync(htmlPath, 'utf-8');
          console.log(`  → Using network-captured HTML (${(finalHtml.length / 1024).toFixed(0)} KB)`);
        }

        if (finalHtml) {
          finalHtml = statifyHtml(finalHtml);
          finalHtml = rewriteUrls(finalHtml);
        }
      }

      if (finalHtml) {
        fs.mkdirSync(path.dirname(htmlPath), { recursive: true });
        fs.writeFileSync(htmlPath, finalHtml, 'utf-8');
        if (!saved.has(url.split('?')[0])) {
          saved.add(url.split('?')[0]);
          stats.files++;
          stats.bytes += Buffer.byteLength(finalHtml);
        }
        urlToPath_.set(url, '/' + path.relative(OUTPUT_DIR, htmlPath));
        console.log(`  ✓ HTML saved: ${path.relative(OUTPUT_DIR, htmlPath)}`);
      } else if (!originalHtmlSaved) {
        console.log('  ⚠ No HTML captured');
      }
    }

    // Extract links for crawling
    links = await extractLinks(page);
  } catch (e) {
    console.log(`  ⚠ ${e.message.slice(0, 80)}`);
  }

  await page.close();
  return links;
}

// ─── Parallel crawler ───────────────────────────────────────────────────────

async function crawl(context) {
  while (pending.length > 0) {
    const batch = [];
    while (batch.length < CONCURRENCY && pending.length > 0) {
      const url = pending.shift();
      if (!visited.has(url)) batch.push(url);
    }
    if (batch.length === 0) break;

    const results = await Promise.allSettled(
      batch.map(url => processPage(context, url))
    );

    for (const r of results) {
      if (r.status === 'fulfilled' && r.value) {
        for (const link of r.value) {
          if (!visited.has(link) && !pending.includes(link)) pending.push(link);
        }
      }
    }
  }
}

// ─── Post-processing ────────────────────────────────────────────────────────

function postProcess() {
  console.log('\n🔧 Post-processing: rewriting URLs in CSS/JS...');
  const rewriteExts = new Set(['.css', '.js', '.json']);
  let count = 0;

  function walk(dir) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) { walk(full); continue; }
      const ext = path.extname(entry.name).toLowerCase();
      if (!rewriteExts.has(ext)) continue;

      try {
        const stat = fs.statSync(full);
        if (stat.size > 10 * 1024 * 1024) continue; // skip huge files

        let content = fs.readFileSync(full, 'utf-8');
        let changed = false;

        // Rewrite URLs
        const rewritten = rewriteUrls(content);
        if (rewritten !== content) { content = rewritten; changed = true; }

        // CSS: fix visibility/opacity
        if (ext === '.css') {
          let patched = content.replace(/visibility\s*:\s*hidden/g, 'visibility:visible');
          patched = patched.replace(
            /([^{}]*)\{([^}]*opacity\s*:\s*0(?![.\d])[^}]*)\}/g,
            (match, sel, body) => {
              const isOverlay = body.includes('pointer-events:none') || body.includes('pointer-events: none')
                || (sel.includes('.bg') && body.includes('position:absolute'));
              if (isOverlay) return match;
              return `${sel}{${body.replace(/opacity\s*:\s*0(?![.\d])/g, 'opacity:1')}}`;
            }
          );
          if (patched !== content) { content = patched; changed = true; }
        }

        if (changed) {
          fs.writeFileSync(full, content, 'utf-8');
          count++;
        }
      } catch {}
    }
  }

  walk(OUTPUT_DIR);
  console.log(`  ✓ ${count} files rewritten`);
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log(`
╔══════════════════════════════════════════════════════════╗
║  OUE SITE CLONER v4                                     ║
╠══════════════════════════════════════════════════════════╣
║  URL  : ${TARGET_URL.slice(0, 46).padEnd(46)} ║
║  Out  : ${OUTPUT_DIR.slice(-46).padEnd(46)} ║
║  Tabs : ${String(CONCURRENCY).padEnd(46)} ║
║  Mode : ${(HEADLESS ? 'headless' : 'visible').padEnd(46)} ║
╚══════════════════════════════════════════════════════════╝
`);

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const browser = await chromium.launch({
    headless: HEADLESS,
    args: [
      '--disable-web-security',
      '--disable-features=IsolateOrigins',
      '--disable-site-isolation-trials',
      '--autoplay-policy=no-user-gesture-required',
    ],
  });

  const context = await browser.newContext({
    viewport: VIEWPORT,
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    extraHTTPHeaders: {
      'Accept': '*/*',
      'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
    },
  });

  pending.push(TARGET_URL);
  await crawl(context);

  await context.close();
  await browser.close();

  // Post-process all assets
  postProcess();

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  const mb = (stats.bytes / (1024 * 1024)).toFixed(1);

  console.log(`
╔══════════════════════════════════════════════════════════╗
║  DONE in ${elapsed.padStart(6)}s                                      ║
╠══════════════════════════════════════════════════════════╣
║  Pages crawled : ${String(stats.pages).padStart(6)}                               ║
║  Files saved   : ${String(stats.files).padStart(6)}                               ║
║  Total size    : ${(mb + ' MB').padStart(10)}                           ║
║  Errors        : ${String(stats.errors).padStart(6)}                               ║
╠══════════════════════════════════════════════════════════╣
║  Serve: node serve-clone.js 3000 ${OUTPUT_DIR.split('/').pop().slice(0, 20).padEnd(20)}  ║
║  → http://localhost:3000/                                ║
╚══════════════════════════════════════════════════════════╝`);

  // ─── Auto deep-analyze if --analyze flag ──────────────────────────────
  if (process.argv.includes('--analyze')) {
    console.log('\n🔬 Running deep analysis on cloned site...');
    try {
      const { execSync } = require('child_process');
      execSync(`node "${path.join(__dirname, 'deep-analyze.js')}" "${TARGET_URL}"`, {
        stdio: 'inherit',
        cwd: __dirname,
        timeout: 300000,
      });
    } catch (e) {
      console.error('  ⚠ Deep analysis failed:', e.message?.slice(0, 80));
    }
  }
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
