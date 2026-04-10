/**
 * lib/clone.js — Asset capture from a live website.
 *
 * Exports `captureAssets(page, outDir, url)` which:
 *   1. Listens to all HTTP responses (CSS, JS, fonts, images, videos)
 *   2. Navigates to the URL
 *   3. Smart-scrolls to trigger lazy loading
 *   4. Forces lazy-loaded resources and visibility
 *   5. Extracts resource URLs from the DOM
 *   6. Downloads any missing resources
 *   7. Saves the post-render HTML
 *   8. Returns { html, resourceMap }
 *
 * Adapted from the battle-tested clone.js (v4).
 */

const fs = require('fs');
const path = require('path');
const { URL } = require('url');
const { BLOCKED_DOMAINS, ensureDir, log } = require('./utils');

// ─── Config ────────────────────────────────────────────────────────────────

const SCROLL_STEP  = 500;
const SCROLL_DELAY = 150;
const NAV_TIMEOUT  = 30_000;

// ─── Binary detection ──────────────────────────────────────────────────────

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
  try {
    if (BIN_EXT.has(path.extname(new URL(url).pathname).toLowerCase())) return true;
  } catch {}
  if (ct) {
    const c = ct.toLowerCase();
    for (const p of BIN_CT) if (c.startsWith(p)) return true;
  }
  return false;
}

// ─── MIME → extension map ──────────────────────────────────────────────────

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

// ─── Asset extensions used for CDN auto-detection ──────────────────────────

const ASSET_EXT = new Set([
  '.js','.css','.woff','.woff2','.ttf','.otf',
  '.jpg','.jpeg','.png','.webp','.avif','.svg','.gif','.ico',
  '.mp4','.webm','.glb','.gltf','.json','.wasm','.mp3',
]);

// Known CDN domains (always allowed)
const KNOWN_CDNS = new Set([
  'fonts.googleapis.com', 'fonts.gstatic.com',
  'cdnjs.cloudflare.com', 'cdn.jsdelivr.net', 'unpkg.com',
  'ajax.googleapis.com',
  'i.vimeocdn.com', 'player.vimeo.com', 'vod-progressive.akamaized.net',
  'a.storyblok.com', 'img2.storyblok.com', 'img.storyblok.com',
  'images.unsplash.com', 'images.ctfassets.net',
  'cdn.sanity.io',
]);

// ─── captureAssets ─────────────────────────────────────────────────────────

/**
 * Capture all assets from a live page in a single Playwright pass.
 *
 * @param {import('playwright').Page} page — an open Playwright page (stays open after)
 * @param {string} outDir — site output directory (e.g. sites/example_com)
 * @param {string} url — the target URL to navigate to
 * @returns {{ html: string, resourceMap: Map<string, string> }}
 */
async function captureAssets(page, outDir, url) {
  const assetsDir = path.join(outDir, 'assets');
  ensureDir(assetsDir);

  // Parse target hostname for same-origin detection
  let mainHostname;
  try { mainHostname = new URL(url).hostname.replace(/^www\./, ''); }
  catch { throw new Error(`Invalid URL: ${url}`); }

  // ─── Per-capture state ────────────────────────────────────────────────
  const saved       = new Set();       // canonical URLs already saved
  const resourceMap = new Map();       // URL → local relative path
  const allowedDomains = new Set(KNOWN_CDNS);  // copy so we can add per-site CDNs
  let   stats       = { files: 0, bytes: 0, errors: 0 };

  // ─── Helper: is this URL on the same origin? ─────────────────────────
  function isSameOrigin(hostname) {
    return hostname === mainHostname
      || hostname === `www.${mainHostname}`
      || hostname.endsWith(`.${mainHostname}`);
  }

  // ─── shouldCapture ───────────────────────────────────────────────────
  function shouldCapture(urlStr) {
    let u;
    try { u = new URL(urlStr); } catch { return false; }
    if (!['http:', 'https:'].includes(u.protocol)) return false;
    if (BLOCKED_DOMAINS.has(u.hostname)) return false;
    if (isSameOrigin(u.hostname)) return true;
    return allowedDomains.has(u.hostname);
  }

  // ─── learnDomain — auto-detect CDN domains from traffic ──────────────
  function learnDomain(urlStr) {
    try {
      const u = new URL(urlStr);
      if (isSameOrigin(u.hostname)) return;
      if (BLOCKED_DOMAINS.has(u.hostname)) return;
      if (allowedDomains.has(u.hostname)) return;
      const ext = path.extname(u.pathname).toLowerCase();
      if (ASSET_EXT.has(ext) || /\/(assets|static|fonts|images|media|uploads|js|css)\//i.test(u.pathname)) {
        allowedDomains.add(u.hostname);
        log('🔍', `CDN auto-detected: ${u.hostname}`);
      }
    } catch {}
  }

  // ─── urlToLocalPath — map a URL to a local path under assets/ ────────
  function urlToLocalPath(urlStr, contentType) {
    let u;
    try { u = new URL(urlStr); } catch { return null; }

    const hostname = u.hostname;
    const isMain = isSameOrigin(hostname);
    // Same-origin → assets/  |  CDN → assets/ext/{domain}/
    const base = isMain ? assetsDir : path.join(assetsDir, 'ext', hostname);

    let fp = decodeURIComponent(u.pathname);

    // Trailing slash or empty → index.html
    if (fp.endsWith('/') || fp === '') fp = path.join(fp, 'index.html');
    else if (!path.extname(fp)) {
      // No extension — infer from Content-Type
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

  // ─── saveFile — write a captured asset to disk ───────────────────────
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
      const segs = path.relative(assetsDir, dir).split(path.sep);
      let cur = assetsDir;
      for (const seg of segs) {
        if (!seg || seg === '..') continue;
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

      // Relative path from outDir (not assetsDir) for the resourceMap
      const relPath = path.relative(outDir, target);
      resourceMap.set(urlStr, relPath);

      if (body.length > 10240) {
        const kb = (body.length / 1024).toFixed(0);
        const short = relPath.length > 75 ? '...' + relPath.slice(-72) : relPath;
        log('💾', `${kb.padStart(6)} KB  ${short}`);
      }
      return true;
    } catch (e) {
      stats.errors++;
      return false;
    }
  }

  // ─── downloadUrl — fetch a resource the network listener missed ──────
  async function downloadUrl(urlStr) {
    const canon = urlStr.split('?')[0];
    if (saved.has(canon)) return;
    if (!shouldCapture(urlStr)) return;

    try {
      const resp = await page.context().request.get(urlStr, { timeout: 15000 });
      if (resp.ok()) {
        const body = await resp.body();
        const ct = resp.headers()['content-type'] || '';
        saveFile(urlStr, body, ct);
      }
    } catch {}
  }

  // ─── smartScroll ─────────────────────────────────────────────────────
  async function smartScroll() {
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
          log('↕', `Page extended: ${totalH}px -> ${h}px`);
          totalH = h;
        }
      }

      // Back to top (some sites load on scroll up)
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
      await page.waitForTimeout(500);
    } catch {}
  }

  // ─── forceLazy ───────────────────────────────────────────────────────
  async function forceLazy() {
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

  // ─── forceVisibility ─────────────────────────────────────────────────
  async function forceVisibility() {
    try {
      await page.evaluate(() => {
        // Inject a global style override
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

        // Fix inline styles on layout-level elements only
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

  // ─── extractResourceUrls ─────────────────────────────────────────────
  async function extractResourceUrls() {
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

  // ═══════════════════════════════════════════════════════════════════════
  // Main capture flow
  // ═══════════════════════════════════════════════════════════════════════

  log('📦', 'Setting up network listener...');

  // 1. Set up response listener to capture all HTTP responses
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

      // Skip HTML responses (we save the final rendered HTML separately)
      if (ct.includes('text/html') && !isBinary(rUrl, ct)) return;
      // Skip RSC payloads
      if (rUrl.includes('_rsc=') || ct.includes('text/x-component')) return;

      saveFile(rUrl, body, ct);
    } catch {}
  });

  // 2. Navigate to URL
  log('🌐', `Navigating to ${url}`);
  await page.goto(url, { waitUntil: 'networkidle', timeout: NAV_TIMEOUT }).catch(async () => {
    // Fallback: some sites never reach networkidle (WebGL, streaming)
    log('⚠️', 'networkidle timeout — falling back to domcontentloaded');
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT });
  });
  await page.waitForTimeout(2000);

  // 3. Smart-scroll to trigger lazy loading
  log('📜', 'Scrolling page to trigger lazy content...');
  await smartScroll();

  // 4. Force lazy-loaded resources
  log('🔄', 'Forcing lazy-loaded resources...');
  await forceLazy();
  await page.waitForTimeout(2000);

  // Wait for any triggered network activity to settle
  await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});

  // 5. Force visibility of hidden/animated content
  log('👁', 'Forcing visibility of hidden content...');
  await forceVisibility();
  await page.waitForTimeout(500);

  // 6. Extract resource URLs from the DOM and download missing ones
  log('🔗', 'Extracting resource URLs from DOM...');
  const domUrls = await extractResourceUrls();
  const missing = domUrls.filter(u => {
    const canon = u.split('?')[0];
    return !saved.has(canon) && shouldCapture(u);
  });

  if (missing.length > 0) {
    log('📥', `${missing.length} missing resources, downloading...`);
    for (let i = 0; i < missing.length; i += 10) {
      const batch = missing.slice(i, i + 10);
      await Promise.allSettled(batch.map(u => downloadUrl(u)));
    }
  }

  // 7. Save the post-render HTML
  log('📄', 'Saving rendered HTML...');
  let html;
  try {
    html = await Promise.race([
      page.content(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('content timeout')), 15000)),
    ]);
  } catch (e) {
    log('⚠️', `page.content() failed: ${e.message}`);
    html = '';
  }

  if (html) {
    const htmlPath = path.join(outDir, 'original.html');
    fs.writeFileSync(htmlPath, html, 'utf-8');
    log('✅', `HTML saved (${(html.length / 1024).toFixed(0)} KB)`);
  }

  // Summary
  const totalKB = (stats.bytes / 1024).toFixed(0);
  log('📦', `Asset capture complete: ${stats.files} files, ${totalKB} KB total, ${stats.errors} errors`);

  return { html, resourceMap };
}

module.exports = { captureAssets };
