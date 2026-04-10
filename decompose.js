#!/usr/bin/env node

/**
 * ═══════════════════════════════════════════════════════════════════
 *  OUE DECOMPOSE — Clone → LLM-Ready Components
 * ═══════════════════════════════════════════════════════════════════
 *
 *  Takes a cloned site and decomposes it into structured, reusable
 *  components that an LLM can understand and recompose with new content.
 *
 *  What it produces for each component:
 *    1. Clean HTML template with {{SLOT}} placeholders
 *    2. Scoped CSS (extracted from stylesheets + inline)
 *    3. Animation config (GSAP/CSS keyframes)
 *    4. Asset manifest (SVGs, images, videos with local paths)
 *    5. Content map (what text/images are swappable)
 *
 *  USAGE:  node decompose.js ./sequel_co_clone
 *          node decompose.js ./sequel_co_clone -o ./sequel_components
 *
 *  OUTPUT: A directory with:
 *    _manifest.json     — Full site manifest (sections, assets, design tokens)
 *    _design-tokens.css — Extracted CSS variables, fonts, colors
 *    _animations.js     — GSAP/ScrollTrigger patterns
 *    components/
 *      header.html      — Clean, annotated HTML for the header
 *      hero.html        — etc.
 *      ...
 *    assets/
 *      svgs/            — All inline SVGs extracted as files
 *      fonts/           — Symlinks to clone fonts
 *      images/          — Symlinks to clone images
 * ═══════════════════════════════════════════════════════════════════
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const CLONE_DIR = process.argv[2];
const OUTPUT_DIR = process.argv[4] || null;

if (!CLONE_DIR) {
  console.error('Usage: node decompose.js <clone-dir> [-o output-dir]');
  process.exit(1);
}

const clonePath = path.resolve(CLONE_DIR);
if (!fs.existsSync(clonePath)) {
  console.error(`Clone not found: ${clonePath}`);
  process.exit(1);
}

const siteName = path.basename(clonePath).replace(/_clone$/, '');
const outDir = OUTPUT_DIR
  ? path.resolve(OUTPUT_DIR)
  : path.join(path.dirname(clonePath), `${siteName}_components`);

// ─── Browser-based decomposition ─────────────────────────────────

const DECOMPOSE_SCRIPT = `
() => {
  const result = {
    meta: {
      title: document.title,
      description: document.querySelector('meta[name="description"]')?.content || '',
      viewport: { width: window.innerWidth, height: window.innerHeight },
      pageHeight: document.body.scrollHeight,
    },
    designTokens: {},
    sections: [],
    assets: { svgs: [], fonts: [], images: [], videos: [] },
    animations: [],
  };

  // ═══ 1. DESIGN TOKENS ═══════════════════════════════════════════

  // CSS custom properties from :root
  const rootStyles = getComputedStyle(document.documentElement);
  const cssVars = {};
  for (const sheet of document.styleSheets) {
    try {
      for (const rule of sheet.cssRules) {
        if (rule.selectorText === ':root' || rule.selectorText === 'html') {
          const text = rule.cssText;
          const varRegex = /--([a-zA-Z_][a-zA-Z0-9_-]*):\s*([^;]+)/g;
          let m;
          while ((m = varRegex.exec(text))) {
            cssVars['--' + m[1]] = m[2].trim();
          }
        }
      }
    } catch(e) {} // CORS
  }

  // Font-face declarations
  const fontFaces = [];
  for (const sheet of document.styleSheets) {
    try {
      for (const rule of sheet.cssRules) {
        if (rule instanceof CSSFontFaceRule) {
          fontFaces.push({
            family: rule.style.fontFamily?.replace(/['"]/g, ''),
            weight: rule.style.fontWeight,
            style: rule.style.fontStyle,
            src: rule.style.src,
          });
        }
      }
    } catch(e) {}
  }

  // Background color
  const bodyBg = getComputedStyle(document.body).backgroundColor;
  const bodyColor = getComputedStyle(document.body).color;

  result.designTokens = {
    cssVariables: cssVars,
    fontFaces,
    bodyBackground: bodyBg,
    bodyColor: bodyColor,
    fontFamily: getComputedStyle(document.body).fontFamily,
  };

  // ═══ 2. SECTION DECOMPOSITION ══════════════════════════════════

  // Strategy: find major layout blocks by traversing top-level children
  // Sections are identified by: <section>, <header>, <footer>, <main>,
  // or divs with id/class containing section/hero/footer etc.

  function isSection(el) {
    if (['HEADER', 'FOOTER', 'SECTION', 'MAIN', 'NAV'].includes(el.tagName)) return true;
    const id = (el.id || '').toLowerCase();
    const cls = (el.className?.toString() || '').toLowerCase();
    const markers = ['section', 'hero', 'footer', 'header', 'nav', 'cta', 'stats', 'about', 'services', 'work', 'projects', 'testimonial', 'contact', 'manifesto', 'beliefs'];
    return markers.some(m => id.includes(m) || cls.includes(m));
  }

  function identifySection(el) {
    const id = (el.id || '').toLowerCase();
    const cls = (el.className?.toString() || '').toLowerCase();
    const tag = el.tagName.toLowerCase();

    // Try to guess the section type
    if (tag === 'header' || id.includes('header') || cls.includes('header')) return 'header';
    if (tag === 'footer' || id.includes('footer') || cls.includes('footer')) return 'footer';
    if (id.includes('hero') || cls.includes('hero') || cls.includes('section1')) return 'hero';
    if (id.includes('stat') || cls.includes('stat')) return 'stats';
    if (id.includes('founder') || cls.includes('founder') || id.includes('project') || cls.includes('project')) return 'projects';
    if (id.includes('cta') || cls.includes('cta')) return 'cta';
    if (id.includes('believ') || id.includes('manifesto') || cls.includes('believ') || cls.includes('manifesto')) return 'manifesto';
    return 'section';
  }

  // Find content slots — text that looks like it could be swapped
  function extractSlots(el) {
    const slots = [];

    // Headlines
    el.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach((h, i) => {
      const text = h.textContent.trim();
      if (text.length > 2 && text.length < 200) {
        slots.push({
          type: 'heading',
          tag: h.tagName,
          text: text,
          selector: buildSelector(h),
          style: {
            fontSize: getComputedStyle(h).fontSize,
            fontWeight: getComputedStyle(h).fontWeight,
            fontFamily: getComputedStyle(h).fontFamily,
            letterSpacing: getComputedStyle(h).letterSpacing,
            lineHeight: getComputedStyle(h).lineHeight,
          }
        });
      }
    });

    // Paragraphs / descriptions
    el.querySelectorAll('p, .description, [class*="desc"], [class*="subtitle"]').forEach(p => {
      const text = p.textContent.trim();
      if (text.length > 10 && text.length < 500) {
        slots.push({
          type: 'paragraph',
          tag: p.tagName,
          text: text,
          selector: buildSelector(p),
        });
      }
    });

    // Buttons / CTAs
    el.querySelectorAll('a[href], button').forEach(btn => {
      const text = btn.textContent.trim();
      if (text.length > 1 && text.length < 50) {
        slots.push({
          type: 'cta',
          tag: btn.tagName,
          text: text,
          href: btn.href || null,
          selector: buildSelector(btn),
        });
      }
    });

    // Stat numbers
    el.querySelectorAll('[data-target], [class*="stat"], [class*="number"], [class*="count"]').forEach(stat => {
      const text = stat.textContent.trim();
      slots.push({
        type: 'stat',
        text: text,
        dataTarget: stat.dataset.target || null,
        dataSuffix: stat.dataset.suffix || null,
        dataPrefix: stat.dataset.prefix || null,
        selector: buildSelector(stat),
      });
    });

    // Badge / label text
    el.querySelectorAll('[class*="badge"], [class*="label"], [class*="tag"]').forEach(badge => {
      const text = badge.textContent.trim();
      if (text.length > 0 && text.length < 50) {
        slots.push({
          type: 'badge',
          text: text,
          selector: buildSelector(badge),
        });
      }
    });

    return slots;
  }

  function buildSelector(el) {
    if (el.id) return '#' + el.id;
    const path = [];
    let cur = el;
    while (cur && cur !== document.body) {
      let seg = cur.tagName.toLowerCase();
      if (cur.id) { path.unshift('#' + cur.id); break; }
      if (cur.className) {
        const cls = cur.className.toString().split(/\\s+/)
          .filter(c => c && !c.startsWith('astro-') && !c.startsWith('data-') && c.length < 30)
          .slice(0, 2).join('.');
        if (cls) seg += '.' + cls;
      }
      path.unshift(seg);
      cur = cur.parentElement;
    }
    return path.join(' > ');
  }

  // Extract inline SVGs
  function extractSVGs(el) {
    const svgs = [];
    el.querySelectorAll('svg').forEach((svg, i) => {
      const markup = svg.outerHTML;
      // Skip tiny decorative SVGs
      if (markup.length < 50) return;

      const viewBox = svg.getAttribute('viewBox') || '';
      const w = svg.getAttribute('width') || '';
      const h = svg.getAttribute('height') || '';

      // Try to identify what this SVG is
      let purpose = 'icon';
      if (markup.length > 2000) purpose = 'logo';
      if (svg.closest('[class*="social"]') || svg.closest('[aria-label*="Instagram"]') || svg.closest('[aria-label*="LinkedIn"]')) purpose = 'social-icon';
      if (svg.closest('[class*="arrow"]') || markup.includes('stroke-linecap="round"') && markup.length < 300) purpose = 'arrow';
      if (svg.closest('[class*="clock"]') || markup.includes('clock-hand')) purpose = 'clock';
      if (markup.includes('cursor') || svg.closest('[class*="cursor"]')) purpose = 'cursor';

      const ariaLabel = svg.closest('[aria-label]')?.getAttribute('aria-label') || '';

      svgs.push({
        index: i,
        purpose,
        ariaLabel,
        viewBox,
        width: w,
        height: h,
        markupLength: markup.length,
        markup: markup,
        parentSelector: buildSelector(svg.parentElement),
      });
    });
    return svgs;
  }

  // Extract images
  function extractImages(el) {
    const images = [];
    el.querySelectorAll('img, picture source').forEach(img => {
      const src = img.src || img.srcset || img.getAttribute('data-src') || '';
      if (!src) return;
      images.push({
        src: src,
        alt: img.alt || '',
        width: img.naturalWidth || img.width || null,
        height: img.naturalHeight || img.height || null,
        parentSelector: buildSelector(img.parentElement),
      });
    });
    return images;
  }

  // Extract videos (including Mux)
  function extractVideos(el) {
    const videos = [];
    el.querySelectorAll('video, mux-video, [data-mux-id]').forEach(vid => {
      videos.push({
        tag: vid.tagName.toLowerCase(),
        src: vid.src || vid.getAttribute('src') || '',
        playbackId: vid.getAttribute('playback-id') || '',
        poster: vid.poster || vid.getAttribute('poster') || '',
        autoplay: vid.hasAttribute('autoplay'),
        muted: vid.hasAttribute('muted'),
        loop: vid.hasAttribute('loop'),
        metadataTitle: vid.getAttribute('metadata-video-title') || '',
        parentSelector: buildSelector(vid.parentElement),
      });
    });
    return videos;
  }

  // ═══ Walk the DOM tree to find sections ═════════════════════════

  // Start from body's direct children and the scrollSpacer's children
  const candidates = [];
  const scrollSpacer = document.getElementById('scrollSpacer');
  const searchRoot = scrollSpacer || document.body;

  // Get header and footer separately
  const header = document.querySelector('header, [id*="header"], [class*="pageHeader"]');
  const footer = document.querySelector('footer, [id*="footer"]');
  const mobileMenu = document.getElementById('mobile-menu-overlay');

  if (header) {
    candidates.push({ el: header, type: 'header' });
  }

  if (mobileMenu) {
    candidates.push({ el: mobileMenu, type: 'mobile-menu' });
  }

  // Find sections inside scrollSpacer or body
  for (const child of searchRoot.children) {
    if (child === header || child === footer || child === mobileMenu) continue;
    if (child.id === 'scrollSpacer') {
      // Recurse into scrollSpacer
      for (const sc of child.children) {
        if (sc.offsetHeight > 50) {
          candidates.push({ el: sc, type: identifySection(sc) });
        }
      }
    } else if (child.offsetHeight > 50 || isSection(child)) {
      candidates.push({ el: child, type: identifySection(child) });
    }
  }

  if (footer) {
    candidates.push({ el: footer, type: 'footer' });
  }

  // ═══ Process each section ═══════════════════════════════════════

  candidates.forEach((item, idx) => {
    const el = item.el;
    const rect = el.getBoundingClientRect();

    const section = {
      index: idx,
      type: item.type,
      id: el.id || null,
      classes: el.className?.toString().split(/\\s+/).filter(c => c && c.length < 40).slice(0, 10) || [],
      dimensions: {
        top: Math.round(rect.top + window.scrollY),
        height: Math.round(rect.height),
        width: Math.round(rect.width),
      },
      style: {
        background: getComputedStyle(el).background,
        position: getComputedStyle(el).position,
        zIndex: getComputedStyle(el).zIndex,
        overflow: getComputedStyle(el).overflow,
      },
      slots: extractSlots(el),
      svgs: extractSVGs(el),
      images: extractImages(el),
      videos: extractVideos(el),
      html: el.outerHTML,
      htmlLength: el.outerHTML.length,
    };

    result.sections.push(section);
  });

  // ═══ 3. GLOBAL ASSETS ═══════════════════════════════════════════

  // All font-face URLs
  result.assets.fonts = fontFaces.map(f => ({
    family: f.family,
    weight: f.weight,
    src: f.src,
  }));

  // All images on the page
  document.querySelectorAll('img').forEach(img => {
    if (img.src) result.assets.images.push(img.src);
  });

  // All video sources
  document.querySelectorAll('video, mux-video').forEach(vid => {
    const src = vid.src || vid.getAttribute('src') || '';
    const pid = vid.getAttribute('playback-id') || '';
    if (src || pid) result.assets.videos.push({ src, playbackId: pid });
  });

  // ═══ 4. ANIMATIONS ══════════════════════════════════════════════

  // Extract CSS keyframes
  for (const sheet of document.styleSheets) {
    try {
      for (const rule of sheet.cssRules) {
        if (rule instanceof CSSKeyframesRule) {
          result.animations.push({
            type: 'keyframes',
            name: rule.name,
            css: rule.cssText.substring(0, 500),
          });
        }
      }
    } catch(e) {}
  }

  // Check for GSAP/ScrollTrigger patterns
  if (window.gsap || window.__oue?.gsapCalls) {
    result.animations.push({
      type: 'gsap',
      detected: true,
      callCount: window.__oue?.gsapCalls?.length || 0,
      scrollTriggers: window.__oue?.scrollTriggers?.length || 0,
    });
  }

  return result;
}
`;

// ─── Output helpers ──────────────────────────────────────────────

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function writeJSON(filepath, data) {
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2), 'utf-8');
}

// ─── Truncate HTML for readability ──────────────────────────────

function cleanHTML(html, maxLen = 50000) {
  // Remove data-astro-cid attributes (noise)
  let clean = html.replace(/\s*data-astro-cid-[a-z0-9]+=""/g, '');
  // Remove oue-force-visible styles injected by the cloner
  clean = clean.replace(/<style id="oue-force-visible">[\s\S]*?<\/style>/g, '');
  // Collapse multiple spaces
  clean = clean.replace(/\s{2,}/g, ' ');
  // Truncate if too long
  if (clean.length > maxLen) {
    clean = clean.substring(0, maxLen) + '\n<!-- ... truncated -->';
  }
  return clean;
}

// ─── Main ────────────────────────────────────────────────────────

async function main() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║  OUE DECOMPOSE — Clone → LLM-Ready Components          ║');
  console.log('╠══════════════════════════════════════════════════════════╣');
  console.log(`║  Clone: ${clonePath.substring(clonePath.length - 45).padEnd(47)} ║`);
  console.log(`║  Out  : ${outDir.substring(outDir.length - 45).padEnd(47)} ║`);
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  // Check for index.html
  const indexPath = path.join(clonePath, 'index.html');
  if (!fs.existsSync(indexPath)) {
    console.error('No index.html found in clone directory');
    process.exit(1);
  }

  // Launch local HTTP server for the clone (so CSS/JS/fonts load properly)
  const http = require('http');
  const servePort = 19876;
  const mimeTypes = {
    '.html':'text/html','.css':'text/css','.js':'application/javascript','.json':'application/json',
    '.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.avif':'image/avif',
    '.svg':'image/svg+xml','.woff':'font/woff','.woff2':'font/woff2','.mp4':'video/mp4','.webm':'video/webm',
    '.mp3':'audio/mpeg','.wav':'audio/wav','.glb':'model/gltf-binary','.gif':'image/gif',
  };
  const server = http.createServer((req, res) => {
    let urlPath = decodeURIComponent(req.url.split('?')[0]);
    if (urlPath === '/') urlPath = '/index.html';
    const filePath = path.join(clonePath, urlPath);
    try {
      if (!fs.existsSync(filePath)) { res.writeHead(404); res.end('Not found'); return; }
      const stat = fs.statSync(filePath);
      if (stat.isDirectory()) {
        const idx = path.join(filePath, 'index.html');
        if (fs.existsSync(idx)) { res.writeHead(200, { 'Content-Type': 'text/html' }); fs.createReadStream(idx).pipe(res); return; }
        res.writeHead(404); res.end('Not found'); return;
      }
      const ext = path.extname(filePath).toLowerCase();
      const mime = mimeTypes[ext] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': mime, 'Access-Control-Allow-Origin': '*' });
      fs.createReadStream(filePath).pipe(res);
    } catch (e) { res.writeHead(500); res.end(e.message); }
  });
  await new Promise((resolve) => server.listen(servePort, resolve));
  console.log(`  ⣾ Serving clone on http://localhost:${servePort}...`);

  // Launch browser
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

  // Load via HTTP (CSS, JS, fonts all load properly now)
  console.log('  ⣾ Loading clone...');
  await page.goto(`http://localhost:${servePort}/`, { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {
    console.log('  ⚠ networkidle timeout, continuing...');
  });

  // Wait for initial load + fonts
  await page.waitForTimeout(3000);

  // Check if page rendered (JS hydration may have failed)
  const bodyCheck = await page.evaluate(() => ({
    bodyH: document.body.offsetHeight,
    mainExists: !!document.querySelector('main'),
    h1Exists: !!document.querySelector('h1'),
  }));

  if (bodyCheck.bodyH < 10 || (!bodyCheck.mainExists && !bodyCheck.h1Exists)) {
    console.log('  ⚠ Page empty after JS load — retrying with JS blocked (SSR fallback)...');
    // Block all JS and reload — use the SSR HTML only
    await page.route('**/*.js', route => route.abort());
    await page.route('**/*.js?*', route => route.abort());
    await page.goto(`http://localhost:${servePort}/`, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(2000);
    const retryCheck = await page.evaluate(() => ({
      bodyH: document.body.offsetHeight,
      mainExists: !!document.querySelector('main'),
      h1Text: document.querySelector('h1')?.textContent?.substring(0, 40),
    }));
    console.log(`  → SSR fallback: bodyH=${retryCheck.bodyH}, main=${retryCheck.mainExists}, h1="${retryCheck.h1Text || 'none'}"`);
  }

  // Phase 1: Bypass preloaders/transitions
  console.log('  ⣾ Bypassing preloaders...');
  await page.evaluate(() => {
    document.querySelectorAll('.preloader, [data-preloader], .transition, .loader, .loading-screen, .page-loader, [data-loading]').forEach(el => {
      el.style.cssText = 'display:none !important';
    });
  });
  await page.waitForTimeout(1000);

  // Phase 2: Scroll through ENTIRE page to trigger lazy content + ScrollTrigger
  console.log('  ⣾ Scrolling to trigger animations...');
  const pageHeight = await page.evaluate(() => document.body.scrollHeight);
  for (let y = 0; y < pageHeight; y += 300) {
    await page.evaluate((scrollY) => window.scrollTo(0, scrollY), y);
    await page.waitForTimeout(80);
  }
  // Scroll back slowly (some animations trigger on scroll-up)
  for (let y = pageHeight; y > 0; y -= 500) {
    await page.evaluate((scrollY) => window.scrollTo(0, scrollY), y);
    await page.waitForTimeout(50);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(1500);

  // Phase 3: FORCE everything visible — nuke all hidden states
  console.log('  ⣾ Forcing all elements visible...');
  await page.evaluate(() => {
    const all = document.querySelectorAll('*');
    all.forEach(el => {
      const cs = getComputedStyle(el);
      // Force opacity
      if (cs.opacity === '0' || el.style.opacity === '0') {
        el.style.setProperty('opacity', '1', 'important');
      }
      // Force visibility
      if (cs.visibility === 'hidden') {
        el.style.setProperty('visibility', 'visible', 'important');
      }
      // Force transforms that hide content (translateY > 50%, scale 0, etc.)
      const transform = cs.transform;
      if (transform && transform !== 'none') {
        const matrix = new DOMMatrix(transform);
        // If element is translated way off screen or scaled to 0
        if (Math.abs(matrix.m42) > el.offsetHeight * 0.5 || matrix.m11 === 0 || matrix.m22 === 0) {
          el.style.setProperty('transform', 'none', 'important');
        }
      }
      // Force clip-path that hides content
      if (cs.clipPath && cs.clipPath !== 'none' && cs.clipPath.includes('0%')) {
        el.style.setProperty('clip-path', 'none', 'important');
      }
    });
    // Also force body/html overflow visible
    document.documentElement.style.setProperty('overflow', 'visible', 'important');
    document.body.style.setProperty('overflow', 'visible', 'important');
    document.body.classList.remove('disable-scroll', 'is-loading', 'no-scroll');
  });
  await page.waitForTimeout(1000);

  // Run decomposition — write script to file, inject it, read result from window
  console.log('  ⣾ Decomposing...');
  const scriptFile = path.join(__dirname, '_tmp_decompose_inject.js');
  fs.writeFileSync(scriptFile, `
    window.__decompose_result = null;
    window.__decompose_error = null;
    try {
      window.__decompose_result = (${DECOMPOSE_SCRIPT})();
    } catch(e) {
      window.__decompose_error = e.message + ' at ' + e.stack?.split('\\n')[1];
    }
  `);

  await page.addScriptTag({ path: scriptFile });
  await page.waitForTimeout(2000);

  const error = await page.evaluate(() => window.__decompose_error);
  if (error) {
    console.error('  ✗ In-page script error:', error);
  }

  let result = await page.evaluate(() => window.__decompose_result);

  // Cleanup temp file
  try { fs.unlinkSync(scriptFile); } catch(e) {}

  if (!result) {
    console.error('  ✗ Decomposition returned null — trying simplified extraction');
    result = await page.evaluate(() => {
      const sections = [];
      const searchRoot = document.getElementById('scrollSpacer') || document.body;
      for (const child of searchRoot.children) {
        if (child.offsetHeight > 50) {
          sections.push({
            index: sections.length,
            type: child.tagName.toLowerCase(),
            id: child.id || null,
            classes: (child.className?.toString() || '').split(/\s+/).slice(0, 5),
            dimensions: { height: child.offsetHeight, width: child.offsetWidth },
            slots: [],
            svgs: [],
            images: [],
            videos: [],
            html: child.outerHTML,
            htmlLength: child.outerHTML.length,
            style: {},
          });
        }
      }
      // Add header + footer
      const header = document.querySelector('header');
      if (header) sections.unshift({ index: 0, type: 'header', id: 'header', classes: [], dimensions: { height: header.offsetHeight, width: header.offsetWidth }, slots: [], svgs: [], images: [], videos: [], html: header.outerHTML, htmlLength: header.outerHTML.length, style: {} });
      const footer = document.querySelector('footer, [id*="footer"]');
      if (footer) sections.push({ index: sections.length, type: 'footer', id: 'footer', classes: [], dimensions: { height: footer.offsetHeight, width: footer.offsetWidth }, slots: [], svgs: [], images: [], videos: [], html: footer.outerHTML, htmlLength: footer.outerHTML.length, style: {} });

      return {
        meta: { title: document.title, pageHeight: document.body.scrollHeight, viewport: { width: window.innerWidth, height: window.innerHeight } },
        designTokens: { bodyBackground: getComputedStyle(document.body).backgroundColor, bodyColor: getComputedStyle(document.body).color, fontFamily: getComputedStyle(document.body).fontFamily, cssVariables: {}, fontFaces: [] },
        sections,
        assets: { fonts: [], images: [], videos: [] },
        animations: [],
      };
    });
  }

  if (!result) {
    console.error('  ✗ All extraction methods failed');
    await browser.close();
    server.close();
    process.exit(1);
  }

  // ═══ BLUEPRINT — Capture exact visual data while browser is open ═══
  console.log('\n  ⣾ Capturing visual blueprint...');
  const blueprint = await captureBlueprint(page, result);
  console.log(`     ✓ ${blueprint.sections.length} sections measured, ${blueprint.palette.length} colors, ${blueprint.typography.length} text styles`);

  await browser.close();
  server.close();

  // ═══ Write output ═══════════════════════════════════════════════

  ensureDir(outDir);
  ensureDir(path.join(outDir, 'components'));
  ensureDir(path.join(outDir, 'assets', 'svgs'));

  // ── 1. Write section components ──
  console.log(`\n  Found ${result.sections.length} sections:\n`);

  const sectionSummaries = [];

  result.sections.forEach((section, i) => {
    const name = section.id || `${section.type}_${i}`;
    const safeName = name.replace(/[^a-zA-Z0-9_-]/g, '_');

    console.log(`  ${i.toString().padStart(2)}. [${section.type.padEnd(12)}] ${name.padEnd(30)} ${(section.htmlLength / 1024).toFixed(1).padStart(6)} KB  ${section.slots.length} slots  ${section.svgs.length} SVGs  ${section.videos.length} videos`);

    // Write clean HTML
    const htmlPath = path.join(outDir, 'components', `${safeName}.html`);
    fs.writeFileSync(htmlPath, cleanHTML(section.html));

    // Write SVGs as separate files
    section.svgs.forEach((svg, si) => {
      const svgName = `${safeName}_${svg.purpose}_${si}.svg`;
      fs.writeFileSync(path.join(outDir, 'assets', 'svgs', svgName), svg.markup);
    });

    // Build content map
    const contentMap = {
      type: section.type,
      id: section.id,
      dimensions: section.dimensions,
      style: section.style,
      slots: section.slots.map(s => ({
        type: s.type,
        text: s.text,
        selector: s.selector,
        ...(s.href ? { href: s.href } : {}),
        ...(s.dataTarget ? { dataTarget: s.dataTarget } : {}),
        ...(s.style ? { style: s.style } : {}),
      })),
      svgs: section.svgs.map(s => ({
        purpose: s.purpose,
        ariaLabel: s.ariaLabel,
        file: `assets/svgs/${safeName}_${s.purpose}_${s.index}.svg`,
        viewBox: s.viewBox,
      })),
      images: section.images,
      videos: section.videos,
      htmlFile: `components/${safeName}.html`,
      htmlLength: section.htmlLength,
    };

    writeJSON(path.join(outDir, 'components', `${safeName}.json`), contentMap);
    sectionSummaries.push(contentMap);
  });

  // ── 2. Write design tokens ──
  writeJSON(path.join(outDir, '_design-tokens.json'), result.designTokens);

  // ── 3. Write animations ──
  writeJSON(path.join(outDir, '_animations.json'), result.animations);

  // ── 4. Write master manifest ──
  const manifest = {
    site: siteName,
    meta: result.meta,
    designTokens: result.designTokens,
    sections: sectionSummaries,
    assets: {
      fonts: result.assets.fonts,
      images: [...new Set(result.assets.images)],
      videos: result.assets.videos,
      svgCount: result.sections.reduce((sum, s) => sum + s.svgs.length, 0),
    },
    animations: result.animations,
    clonePath: clonePath,
    generatedAt: new Date().toISOString(),
  };

  writeJSON(path.join(outDir, '_manifest.json'), manifest);

  // ── 5. Write blueprint ──
  writeJSON(path.join(outDir, '_blueprint.json'), blueprint);
  ensureDir(path.join(outDir, 'screenshots'));
  if (blueprint.screenshots) {
    for (const [name, data] of Object.entries(blueprint.screenshots)) {
      fs.writeFileSync(path.join(outDir, 'screenshots', name), Buffer.from(data, 'base64'));
    }
    delete blueprint.screenshots; // Don't keep base64 in JSON
    writeJSON(path.join(outDir, '_blueprint.json'), blueprint);
    console.log(`     ✓ ${Object.keys(blueprint.screenshots || {}).length || 'multiple'} screenshots saved`);
  }

  // ── 6. Deep-scan JS chunks for Spline, Videos, Animation system ──
  console.log('\n  ⣾ Deep-scanning JS chunks...');
  const deepScan = scanJSChunks(clonePath);
  manifest.spline = deepScan.spline;
  manifest.cloudinary = deepScan.cloudinary;
  manifest.animationSystem = deepScan.animationSystem;
  manifest.audio = deepScan.audio;
  manifest.blueprint = {
    palette: blueprint.palette,
    typography: blueprint.typography,
    components: blueprint.components,
    sections: blueprint.sections,
    cssVars: blueprint.cssVars || {},
    viewports: blueprint.viewports,
  };

  writeJSON(path.join(outDir, '_deep-scan.json'), deepScan);

  const deepCount = (deepScan.spline.scenes.length ? '✓' : '✗') + ' Spline, '
    + (deepScan.cloudinary.cloudName ? '✓' : '✗') + ' Cloudinary, '
    + (deepScan.animationSystem.libraries.length ? '✓' : '✗') + ' Animations';
  console.log(`     ${deepCount}`);

  // ── 7. Write LLM-readable summary ──
  const summary = generateSummary(manifest);
  fs.writeFileSync(path.join(outDir, '_summary.md'), summary);

  // ── 8. Symlink assets ──
  const fontsDir = path.join(clonePath, 'fonts');
  const imagesDir = path.join(clonePath, 'images');
  if (fs.existsSync(fontsDir)) {
    const link = path.join(outDir, 'assets', 'fonts');
    if (!fs.existsSync(link)) fs.symlinkSync(fontsDir, link);
  }
  if (fs.existsSync(imagesDir)) {
    const link = path.join(outDir, 'assets', 'images');
    if (!fs.existsSync(link)) fs.symlinkSync(imagesDir, link);
  }

  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║  DECOMPOSITION COMPLETE                                 ║');
  console.log('╠══════════════════════════════════════════════════════════╣');
  console.log(`║  Sections     : ${result.sections.length.toString().padEnd(39)} ║`);
  console.log(`║  Content slots: ${result.sections.reduce((s, c) => s + c.slots.length, 0).toString().padEnd(39)} ║`);
  console.log(`║  SVGs         : ${result.sections.reduce((s, c) => s + c.svgs.length, 0).toString().padEnd(39)} ║`);
  console.log(`║  Videos       : ${result.assets.videos.length.toString().padEnd(39)} ║`);
  console.log(`║  Animations   : ${result.animations.length.toString().padEnd(39)} ║`);
  console.log(`║  Spline 3D    : ${deepScan.spline.scenes.length.toString().padEnd(39)} ║`);
  console.log(`║  Cloudinary   : ${(deepScan.cloudinary.cloudName || 'none').padEnd(39)} ║`);
  console.log(`║  Blueprint    : ${(blueprint.palette.length + ' colors, ' + blueprint.typography.length + ' fonts, ' + (blueprint.components || []).length + ' trees').padEnd(39)} ║`);
  console.log(`║  Anim system  : ${deepScan.animationSystem.libraries.join(', ').padEnd(39)} ║`);
  console.log(`║  Output       : ${outDir.substring(outDir.length - 39).padEnd(39)} ║`);
  console.log('╚══════════════════════════════════════════════════════════╝\n');
  console.log(`  → LLM summary: ${path.join(outDir, '_summary.md')}`);
  console.log(`  → Deep scan:   ${path.join(outDir, '_deep-scan.json')}`);
  console.log(`  → Manifest:    ${path.join(outDir, '_manifest.json')}`);
}

// ─── Blueprint: capture exact visual data per section ───────────────

async function captureBlueprint(page, decomposeResult) {
  const screenshots = {};

  // Force scroll to top for clean screenshots
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(500);

  // 1. Full page screenshot at 1920px
  const fullBuf = await page.screenshot({ fullPage: true, type: 'jpeg', quality: 85 });
  screenshots['full_1920.jpg'] = fullBuf.toString('base64');

  // 2. Per-section screenshots
  for (let i = 0; i < decomposeResult.sections.length; i++) {
    const section = decomposeResult.sections[i];
    const name = section.id || `section_${i}`;
    try {
      const box = await page.evaluate((idx) => {
        const sections = document.querySelectorAll('header, footer, main > *, body > div > *, body > section, [id]');
        const el = sections[idx];
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { x: r.x, y: r.y + window.scrollY, width: r.width, height: Math.min(r.height, 3000) };
      }, i);
      if (box && box.height > 10) {
        const buf = await page.screenshot({ clip: { x: Math.max(0, box.x), y: box.y, width: Math.min(box.width, 1920), height: box.height }, type: 'jpeg', quality: 75 });
        screenshots[`section_${i}_${name}.jpg`] = buf.toString('base64');
      }
    } catch (e) {}
  }

  // 3. Mobile screenshot (375px)
  await page.setViewportSize({ width: 375, height: 812 });
  await page.waitForTimeout(500);
  const mobileBuf = await page.screenshot({ fullPage: true, type: 'jpeg', quality: 70 });
  screenshots['full_375.jpg'] = mobileBuf.toString('base64');

  // 4. Tablet screenshot (768px)
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.waitForTimeout(500);
  const tabletBuf = await page.screenshot({ fullPage: true, type: 'jpeg', quality: 70 });
  screenshots['full_768.jpg'] = tabletBuf.toString('base64');

  // Reset to desktop
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.waitForTimeout(500);

  // 5. Deep visual blueprint — crawl entire DOM tree
  const visualData = await page.evaluate(() => {
    const colors = new Set();
    const fonts = new Set();
    const fontDetails = [];
    const components = [];
    const cssVars = {};

    // Extract CSS custom properties from :root
    const rootCS = getComputedStyle(document.documentElement);
    const rootStyle = document.documentElement.style;
    for (const sheet of document.styleSheets) {
      try {
        for (const rule of sheet.cssRules) {
          if (rule.selectorText === ':root' || rule.selectorText === ':root, :host') {
            for (const prop of rule.style) {
              if (prop.startsWith('--')) {
                cssVars[prop] = rule.style.getPropertyValue(prop).trim();
              }
            }
          }
        }
      } catch(e) {}
    }

    // Walk the DOM tree and measure every visible element
    function getStyles(el) {
      const cs = getComputedStyle(el);
      const s = {};
      // Layout — display (always include for LLM clarity)
      s.display = cs.display;
      if (cs.position !== 'static') s.position = cs.position;
      // Flex details
      if (cs.display.includes('flex')) {
        if (cs.flexDirection !== 'row') s.flexDirection = cs.flexDirection;
        if (cs.flexWrap !== 'nowrap') s.flexWrap = cs.flexWrap;
        if (cs.alignItems !== 'normal') s.alignItems = cs.alignItems;
        if (cs.justifyContent !== 'normal') s.justifyContent = cs.justifyContent;
        if (cs.alignSelf !== 'auto') s.alignSelf = cs.alignSelf;
      }
      // Grid details (CRITICAL for reproduction)
      if (cs.display.includes('grid')) {
        s.gridTemplateColumns = cs.gridTemplateColumns;
        if (cs.gridTemplateRows !== 'none' && cs.gridTemplateRows !== 'auto') s.gridTemplateRows = cs.gridTemplateRows;
        if (cs.columnGap !== 'normal' && cs.columnGap !== '0px') s.columnGap = cs.columnGap;
        if (cs.rowGap !== 'normal' && cs.rowGap !== '0px') s.rowGap = cs.rowGap;
      }
      // Grid child placement (CRITICAL — tells LLM which column/row)
      if (el.parentElement && getComputedStyle(el.parentElement).display.includes('grid')) {
        const gridCol = cs.gridColumnStart + '/' + cs.gridColumnEnd;
        const gridRow = cs.gridRowStart + '/' + cs.gridRowEnd;
        if (gridCol !== 'auto/auto') s.gridColumn = gridCol;
        if (gridRow !== 'auto/auto') s.gridRow = gridRow;
        if (cs.justifySelf !== 'auto' && cs.justifySelf !== 'normal') s.justifySelf = cs.justifySelf;
        if (cs.alignSelf !== 'auto' && cs.alignSelf !== 'normal') s.alignSelf = cs.alignSelf;
      }
      // Gap (for both flex and grid)
      if (cs.gap !== 'normal' && cs.gap !== '0px') s.gap = cs.gap;
      // Box model (CRITICAL — exact padding/margin in px)
      const pad = `${cs.paddingTop} ${cs.paddingRight} ${cs.paddingBottom} ${cs.paddingLeft}`;
      if (pad !== '0px 0px 0px 0px') s.padding = pad;
      const mar = `${cs.marginTop} ${cs.marginRight} ${cs.marginBottom} ${cs.marginLeft}`;
      if (mar !== '0px 0px 0px 0px') s.margin = mar;
      // Width/height constraints
      if (cs.maxWidth !== 'none') s.maxWidth = cs.maxWidth;
      if (cs.minWidth !== '0px' && cs.minWidth !== 'auto') s.minWidth = cs.minWidth;
      if (cs.minHeight !== '0px' && cs.minHeight !== 'auto') s.minHeight = cs.minHeight;
      if (cs.width !== 'auto' && cs.display !== 'block') s.width = cs.width;
      if (cs.height !== 'auto') s.height = cs.height;
      // Visual
      if (cs.backgroundColor !== 'rgba(0, 0, 0, 0)') { s.background = cs.backgroundColor; colors.add(cs.backgroundColor); }
      if (cs.backgroundImage !== 'none') s.backgroundImage = cs.backgroundImage.substring(0, 200);
      if (cs.borderRadius !== '0px') s.borderRadius = cs.borderRadius;
      if (cs.borderStyle !== 'none') s.border = `${cs.borderWidth} ${cs.borderStyle} ${cs.borderColor}`;
      if (cs.boxShadow !== 'none') s.boxShadow = cs.boxShadow.substring(0, 120);
      if (cs.backdropFilter !== 'none') s.backdropFilter = cs.backdropFilter;
      if (cs.overflow !== 'visible') s.overflow = cs.overflow;
      if (cs.zIndex !== 'auto') s.zIndex = cs.zIndex;
      if (cs.opacity !== '1') s.opacity = cs.opacity;
      // Text (CRITICAL — resolved px values, not CSS var names)
      s.color = cs.color;
      colors.add(cs.color);
      s.fontSize = cs.fontSize;
      s.fontFamily = cs.fontFamily;
      s.fontWeight = cs.fontWeight;
      s.lineHeight = cs.lineHeight;
      if (cs.letterSpacing !== 'normal') s.letterSpacing = cs.letterSpacing;
      if (cs.textAlign !== 'start' && cs.textAlign !== 'left') s.textAlign = cs.textAlign;
      if (cs.textTransform !== 'none') s.textTransform = cs.textTransform;
      if (cs.whiteSpace !== 'normal') s.whiteSpace = cs.whiteSpace;
      // Transform & transition (for animation reproduction)
      if (cs.transform !== 'none') s.transform = cs.transform;
      if (cs.transition !== 'all 0s ease 0s' && cs.transition !== '') s.transition = cs.transition.substring(0, 150);
      return s;
    }

    function getTextStyle(el) {
      const cs = getComputedStyle(el);
      const family = cs.fontFamily.split(',')[0].trim().replace(/['"]/g, '');
      const key = `${family}|${cs.fontSize}|${cs.fontWeight}|${cs.lineHeight}|${cs.letterSpacing}|${cs.textTransform}`;
      if (!fonts.has(key)) {
        fonts.add(key);
        fontDetails.push({
          family,
          fullFamily: cs.fontFamily,
          size: cs.fontSize,
          weight: cs.fontWeight,
          lineHeight: cs.lineHeight,
          letterSpacing: cs.letterSpacing,
          textTransform: cs.textTransform !== 'none' ? cs.textTransform : undefined,
          textAlign: cs.textAlign !== 'start' ? cs.textAlign : undefined,
          color: cs.color,
          sample: (el.textContent || '').trim().substring(0, 80),
          renderedWidth: Math.round(el.getBoundingClientRect().width),
        });
      }
    }

    function measureTree(el, depth, maxDepth) {
      if (depth > maxDepth) return null;
      const rect = el.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) return null;
      const cs = getComputedStyle(el);
      if (cs.display === 'none') return null;

      // Get text content if leaf-ish node
      const directText = Array.from(el.childNodes).filter(n => n.nodeType === 3 && n.textContent.trim()).map(n => n.textContent.trim()).join(' ');
      if (directText) getTextStyle(el);

      // Build node data — include both px and viewport % for LLM reproduction
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const node = {
        tag: el.tagName.toLowerCase(),
        rect: { x: Math.round(rect.left), y: Math.round(rect.top + window.scrollY), w: Math.round(rect.width), h: Math.round(rect.height) },
        pct: {
          left: +(rect.left / vw * 100).toFixed(1),
          top: +((rect.top + window.scrollY) / vh * 100).toFixed(1),
          width: +(rect.width / vw * 100).toFixed(1),
          height: +(rect.height / vh * 100).toFixed(1),
        },
      };

      // Add class if meaningful
      const cls = (el.className?.toString() || '').split(/\s+/).filter(c => c.length > 1 && c.length < 40 && !c.startsWith('w-')).slice(0, 4).join(' ');
      if (cls) node.class = cls;
      if (el.id) node.id = el.id;

      // Add styles (only non-default values)
      const styles = getStyles(el);
      if (Object.keys(styles).length > 0) node.style = styles;

      // Add text — direct text nodes first, fallback to innerText for headings/paragraphs
      if (directText && directText.length < 200) {
        node.text = directText.substring(0, 120);
      } else if (/^(h[1-6]|p|span|a|button|label|li)$/i.test(el.tagName)) {
        const inner = (el.innerText || '').trim();
        if (inner && inner.length < 300 && inner.length > 0) {
          node.text = inner.substring(0, 120);
          getTextStyle(el);
        }
      }

      // Add image info
      if (el.tagName === 'IMG') {
        node.src = (el.getAttribute('src') || '').substring(0, 120);
        node.alt = el.alt;
      }
      if (el.tagName === 'VIDEO') {
        const source = el.querySelector('source');
        node.src = (source?.src || el.src || '').substring(0, 120);
      }
      if (el.tagName === 'svg' || el.tagName === 'SVG') {
        node.svg = true;
        node.viewBox = el.getAttribute('viewBox') || '';
        // Capture small SVG markup (icons, decorations < 4KB)
        try {
          const serializer = new XMLSerializer();
          const svgMarkup = serializer.serializeToString(el);
          if (svgMarkup.length < 4000) {
            node.svgContent = svgMarkup;
          } else {
            node.svgSize = svgMarkup.length;
          }
        } catch(e) {
          node.svgSize = -1;
        }
      }

      // Capture animation-related data attributes (CRITICAL for animation reproduction)
      const animAttrs = {};
      for (const attr of el.attributes) {
        if (attr.name.startsWith('data-') && (
          attr.name.includes('reveal') || attr.name.includes('split') ||
          attr.name.includes('parallax') || attr.name.includes('anim') ||
          attr.name.includes('scroll') || attr.name.includes('delay') ||
          attr.name.includes('enter') || attr.name.includes('mask') ||
          attr.name.includes('trigger') || attr.name.includes('speed') ||
          attr.name.includes('stagger') || attr.name.includes('duration') ||
          attr.name.includes('ease') || attr.name.includes('sound') ||
          attr.name.includes('preload') || attr.name.includes('theme') ||
          attr.name.includes('menu') || attr.name.includes('jump') ||
          attr.name.includes('btn') || attr.name.includes('text') ||
          attr.name.includes('us-project') || attr.name.includes('bunny') ||
          attr.name.includes('lenis')
        )) {
          animAttrs[attr.name] = attr.value;
        }
      }
      if (Object.keys(animAttrs).length > 0) node.dataAttrs = animAttrs;

      // Recurse into children (limit depth based on element importance)
      const children = [];
      const childEls = Array.from(el.children);
      // Skip very deep nesting for non-structural elements
      const isStructural = ['section', 'main', 'header', 'footer', 'nav', 'article', 'div'].includes(node.tag);
      const childMaxDepth = isStructural ? maxDepth : Math.min(maxDepth, depth + 3);

      for (const child of childEls) {
        const childNode = measureTree(child, depth + 1, childMaxDepth);
        if (childNode) children.push(childNode);
      }
      if (children.length > 0) node.children = children;

      return node;
    }

    // Find the main content root — universal selectors for any site framework
    const roots = [];
    // Header (try many selectors)
    const header = document.querySelector('header') ||
      document.querySelector('nav[class*="nav"]') ||
      document.querySelector('[data-header]') ||
      document.querySelector('[role="banner"]') ||
      document.querySelector('nav:first-of-type');
    if (header) roots.push({ label: 'header', el: header });

    // Main content (try many selectors, in priority order)
    const mainContent = document.querySelector('.page-wrapper') ||
      document.querySelector('.main-wrapper') ||
      document.querySelector('#smooth-content') ||
      document.querySelector('main') ||
      document.querySelector('#__next > div') ||
      document.querySelector('#root > div') ||
      document.querySelector('[role="main"]') ||
      document.querySelector('#app') ||
      document.body;
    roots.push({ label: 'main', el: mainContent });

    // Footer
    const footer = document.querySelector('footer') ||
      document.querySelector('[data-footer]') ||
      document.querySelector('[class*="footer"]:last-child');
    if (footer && footer !== mainContent) roots.push({ label: 'footer', el: footer });

    // FALLBACK: if no meaningful content found, try body with deeper depth
    if (roots.length <= 1 && mainContent === document.body) {
      // Walk body children and add each significant one as a root
      const bodyChildren = Array.from(document.body.children).filter(el => {
        const r = el.getBoundingClientRect();
        return r.width > 100 && r.height > 50 && getComputedStyle(el).display !== 'none';
      });
      if (bodyChildren.length > 0 && bodyChildren.length < 10) {
        roots.length = 0; // Clear and rebuild
        bodyChildren.forEach((el, i) => {
          const tag = el.tagName.toLowerCase();
          const label = tag === 'header' ? 'header' : tag === 'footer' ? 'footer' :
            tag === 'nav' ? 'header' : tag === 'main' ? 'main' : `section_${i}`;
          roots.push({ label, el });
        });
      }
    }

    for (const root of roots) {
      const tree = measureTree(root.el, 0, 8);
      if (tree) {
        tree.role = root.label;
        components.push(tree);
      }
    }

    // Sort fonts by size descending
    fontDetails.sort((a, b) => parseFloat(b.size) - parseFloat(a.size));

    // === ANIMATION SYSTEM ANALYSIS ===
    const animationData = {
      revealTypes: {},
      parallaxElements: 0,
      splitTextElements: 0,
      totalAnimatedElements: 0,
      delays: [],
      libraries: [],
    };

    // Scan all data-* attributes to build animation inventory
    document.querySelectorAll('[data-enter-reveal]').forEach(el => {
      const type = el.getAttribute('data-enter-reveal');
      animationData.revealTypes[type] = (animationData.revealTypes[type] || 0) + 1;
      animationData.totalAnimatedElements++;
      const delay = el.getAttribute('data-mask-reveal-delay') || el.getAttribute('data-split-reveal-delay');
      if (delay) animationData.delays.push(parseFloat(delay));
    });
    document.querySelectorAll('[data-parallax]').forEach(() => animationData.parallaxElements++);
    document.querySelectorAll('[data-split]').forEach(() => animationData.splitTextElements++);

    // Detect loaded animation libraries
    if (window.gsap) animationData.libraries.push('gsap');
    if (window.ScrollTrigger) animationData.libraries.push('ScrollTrigger');
    if (window.SplitText) animationData.libraries.push('SplitText');
    if (window.Lenis || document.querySelector('.lenis')) animationData.libraries.push('lenis');
    if (window.Flip) animationData.libraries.push('Flip');

    // Extract @keyframes from stylesheets
    const keyframes = [];
    for (const sheet of document.styleSheets) {
      try {
        for (const rule of sheet.cssRules) {
          if (rule instanceof CSSKeyframesRule) {
            const frames = [];
            for (const kf of rule.cssRules) {
              frames.push({ key: kf.keyText, style: kf.style.cssText.substring(0, 200) });
            }
            keyframes.push({ name: rule.name, frames });
          }
        }
      } catch(e) {}
    }
    animationData.keyframes = keyframes;

    // === INLINE STYLE BLOCKS (CRITICAL — hover effects, transitions, animations) ===
    const inlineStyles = [];
    document.querySelectorAll('style').forEach(styleEl => {
      const css = styleEl.textContent.trim();
      // Only capture page's own styles — skip force-visible styles injected by decompose
      if (css.length > 20 && css.length < 8000 &&
        !css.startsWith('*{visibility') && !css.startsWith('*{animation') &&
        (css.includes('hover') || css.includes('animation') || css.includes('transition') ||
         css.includes('keyframes') || css.includes('data-btn') || css.includes('data-') ||
         css.includes('clip-path') || css.includes('transform') || css.includes('data-underline') ||
         css.includes('scroll') || css.includes('reveal') || css.includes('menu') ||
         css.includes('hero') || css.includes('mask') || css.includes('split'))
      ) {
        inlineStyles.push(css);
      }
    });
    animationData.inlineStyles = inlineStyles;

    // Extract @font-face declarations (CRITICAL for reproduction)
    const fontFaces = [];
    for (const sheet of document.styleSheets) {
      try {
        for (const rule of sheet.cssRules) {
          if (rule instanceof CSSFontFaceRule) {
            fontFaces.push({
              family: rule.style.getPropertyValue('font-family').replace(/['"]/g, '').trim(),
              src: rule.style.getPropertyValue('src').substring(0, 300),
              weight: rule.style.getPropertyValue('font-weight') || '400',
              style: rule.style.getPropertyValue('font-style') || 'normal',
              display: rule.style.getPropertyValue('font-display') || 'auto',
            });
          }
        }
      } catch(e) {}
    }

    // Viewport & scaling context
    const bodyCs = getComputedStyle(document.body);
    const rootCs = getComputedStyle(document.documentElement);
    const viewportMeta = {
      width: window.innerWidth,
      height: window.innerHeight,
      bodyFontSize: bodyCs.fontSize,
      rootFontSize: rootCs.fontSize,
      bodyColor: bodyCs.color,
      bodyBackground: bodyCs.backgroundColor,
      bodyFontFamily: bodyCs.fontFamily,
    };

    return {
      cssVars,
      palette: [...colors].slice(0, 60),
      typography: fontDetails.slice(0, 40),
      fontFaces,
      animationData,
      viewportMeta,
      components,
    };
  });

  return {
    viewports: { desktop: '1920x1080', tablet: '768x1024', mobile: '375x812' },
    viewportMeta: visualData.viewportMeta,
    cssVars: visualData.cssVars,
    fontFaces: visualData.fontFaces,
    animationData: visualData.animationData,
    palette: visualData.palette,
    typography: visualData.typography,
    components: visualData.components,
    sections: visualData.components, // alias for backward compat
    spacing: [], // now embedded in components
    screenshots,
  };
}

// ─── Deep scan JS chunks for Spline, Cloudinary, Animation system ───

function scanJSChunks(clonePath) {
  const result = {
    spline: { scenes: [], runtime: null },
    cloudinary: { cloudName: null, videos: [], images: [] },
    animationSystem: { libraries: [], easing: {}, timing: {}, triggerMethod: null },
    audio: [],
  };

  // Find JS chunk directories — cover Next.js, Astro, and generic static dirs
  const chunkDirs = [];
  const candidateDirs = [
    path.join(clonePath, '_next', 'static', 'chunks'),
    path.join(clonePath, '_next', 'static'),
    path.join(clonePath, '_astro'),
    path.join(clonePath, 'static'),
    path.join(clonePath, 'assets'),
    path.join(clonePath, 'js'),
    path.join(clonePath, '_app'),
    path.join(clonePath, 'cdn'),
    path.join(clonePath, '__ext__'),
  ];
  for (const dir of candidateDirs) {
    if (fs.existsSync(dir)) chunkDirs.push(dir);
  }

  // Also scan index.html for embedded styled-components CSS
  const indexPath = path.join(clonePath, 'index.html');

  // Collect all JS files to scan (limit to < 2MB each)
  const jsFiles = [];
  for (const dir of chunkDirs) {
    collectJSFiles(dir, jsFiles);
  }

  console.log(`     Scanning ${jsFiles.length} JS files...`);

  for (const file of jsFiles) {
    let content;
    try {
      const stat = fs.statSync(file);
      if (stat.size > 2 * 1024 * 1024) continue; // Skip files > 2MB
      content = fs.readFileSync(file, 'utf-8');
    } catch (e) { continue; }

    // ── Spline 3D scenes ──
    const splineSceneMatches = content.match(/https:\/\/prod\.spline\.design\/[A-Za-z0-9_-]+\/scene\.splinecode/g);
    if (splineSceneMatches) {
      for (const url of splineSceneMatches) {
        if (!result.spline.scenes.includes(url)) {
          result.spline.scenes.push(url);
        }
      }
    }
    // Spline runtime version
    const splineRuntime = content.match(/@splinetool\/runtime@([\d.]+)/);
    if (splineRuntime) result.spline.runtime = splineRuntime[1];

    // ── Cloudinary ──
    const cloudNameMatch = content.match(/res\.cloudinary\.com\/([a-z0-9]+)/);
    if (cloudNameMatch && !result.cloudinary.cloudName) {
      result.cloudinary.cloudName = cloudNameMatch[1];
    }

    // ── Animation libraries ──
    if (content.includes('gsap') || content.includes('ScrollTrigger')) {
      if (!result.animationSystem.libraries.includes('gsap')) {
        result.animationSystem.libraries.push('gsap');
      }
    }
    if (content.includes('ScrollTrigger') && content.includes('registerPlugin')) {
      if (!result.animationSystem.libraries.includes('ScrollTrigger')) {
        result.animationSystem.libraries.push('ScrollTrigger');
      }
    }
    if (content.includes('SplitText')) {
      if (!result.animationSystem.libraries.includes('SplitText')) {
        result.animationSystem.libraries.push('SplitText');
      }
    }
    if (/new\s+Lenis|lenis/i.test(content) && content.includes('lerp')) {
      if (!result.animationSystem.libraries.includes('lenis')) {
        result.animationSystem.libraries.push('lenis');
      }
      const lerpMatch = content.match(/lerp:\s*([\d.]+)/);
      if (lerpMatch) result.animationSystem.timing.lenisLerp = parseFloat(lerpMatch[1]);
    }
    if (content.includes('LocomotiveScroll')) {
      if (!result.animationSystem.libraries.includes('locomotive-scroll')) {
        result.animationSystem.libraries.push('locomotive-scroll');
      }
    }
    if (content.includes('useInView') || content.includes('IntersectionObserver')) {
      result.animationSystem.triggerMethod = 'IntersectionObserver';
    }

    // ── Easing functions ──
    const easingMatch = content.match(/cubic-bezier\(\s*([\d.]+)\s*,\s*([\d.-]+)\s*,\s*([\d.]+)\s*,\s*([\d.-]+)\s*\)/g);
    if (easingMatch) {
      for (const easing of easingMatch) {
        if (!result.animationSystem.easing[easing]) {
          result.animationSystem.easing[easing] = 0;
        }
        result.animationSystem.easing[easing]++;
      }
    }

    // ── Animation timing constants ──
    const rootMarginMatch = content.match(/rootMargin:\s*["']([^"']+)["']/);
    if (rootMarginMatch) result.animationSystem.timing.rootMargin = rootMarginMatch[1];

    const scrollTriggerMatch = content.match(/scrollTriggerPoint:\s*["']([^"']+)["']/);
    if (scrollTriggerMatch) result.animationSystem.timing.scrollTriggerPoint = scrollTriggerMatch[1];
  }

  // ── Scan clone directory for Cloudinary video files ──
  const extDir = path.join(clonePath, '__ext__', 'res.cloudinary.com');
  if (fs.existsSync(extDir)) {
    const cloudDirs = fs.readdirSync(extDir);
    if (cloudDirs.length > 0 && !result.cloudinary.cloudName) {
      result.cloudinary.cloudName = cloudDirs[0];
    }
    const videoDir = path.join(extDir, result.cloudinary.cloudName || cloudDirs[0], 'video');
    if (fs.existsSync(videoDir)) {
      collectVideoFiles(videoDir, result.cloudinary.videos, videoDir);
    }
  }

  // ── Scan for audio files ──
  const audioDir = path.join(clonePath, 'audio');
  if (fs.existsSync(audioDir)) {
    collectAudioFiles(audioDir, result.audio, audioDir);
  }

  // ── Keep only top 5 most common easings ──
  const sortedEasings = Object.entries(result.animationSystem.easing)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  result.animationSystem.easing = Object.fromEntries(sortedEasings);

  // ── Scan index.html styled-components for animation CSS classes ──
  if (fs.existsSync(indexPath)) {
    try {
      const indexHTML = fs.readFileSync(indexPath, 'utf-8');
      const animClasses = [];

      // Find animation-related CSS classes in styled-components
      const animPatterns = [
        /\.([\w-]+)\{[^}]*(?:transform|opacity|transition)[^}]*translateY[^}]*\}/g,
        /\.([\w-]+)\{[^}]*animation[^}]*\}/g,
      ];
      for (const pattern of animPatterns) {
        let match;
        while ((match = pattern.exec(indexHTML)) !== null) {
          if (match[1] && !animClasses.includes(match[1])) {
            animClasses.push(match[1]);
          }
        }
      }
      if (animClasses.length > 0) {
        result.animationSystem.cssAnimationClasses = animClasses.slice(0, 30);
      }
    } catch(e) {}
  }

  return result;
}

function collectJSFiles(dir, files) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectJSFiles(full, files);
    } else if (entry.name.endsWith('.js')) {
      files.push(full);
    }
  }
}

function collectVideoFiles(dir, videos, baseDir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectVideoFiles(full, videos, baseDir);
    } else if (/\.(mp4|webm|mov)$/i.test(entry.name)) {
      const stat = fs.statSync(full);
      videos.push({
        path: path.relative(baseDir, full),
        size: stat.size,
        ext: path.extname(entry.name).substring(1),
      });
    }
  }
}

function collectAudioFiles(dir, audios, baseDir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectAudioFiles(full, audios, baseDir);
    } else if (/\.(mp3|wav|ogg|aac)$/i.test(entry.name)) {
      const stat = fs.statSync(full);
      audios.push({
        path: path.relative(baseDir, full),
        size: stat.size,
      });
    }
  }
}

// ─── Generate LLM-readable summary ──────────────────────────────

function generateSummary(manifest) {
  let md = `# ${manifest.site} — Component Decomposition\n`;
  md += `> Decomposed ${new Date().toISOString()} | ${manifest.sections.length} sections | ${manifest.meta.pageHeight}px tall\n\n`;

  // Design tokens
  md += `## Design Tokens\n`;
  md += `- **Background**: ${manifest.designTokens.bodyBackground}\n`;
  md += `- **Text color**: ${manifest.designTokens.bodyColor}\n`;
  md += `- **Font stack**: ${manifest.designTokens.fontFamily}\n`;
  if (Object.keys(manifest.designTokens.cssVariables).length > 0) {
    md += `- **CSS Variables**: ${Object.entries(manifest.designTokens.cssVariables).map(([k,v]) => `${k}: ${v}`).join(', ')}\n`;
  }
  md += `\n### Fonts\n`;
  manifest.designTokens.fontFaces.forEach(f => {
    md += `- **${f.family}** (${f.weight}, ${f.style})\n`;
  });

  // Sections
  md += `\n## Sections\n\n`;
  manifest.sections.forEach((s, i) => {
    md += `### ${i}. ${s.type.toUpperCase()}${s.id ? ` (#${s.id})` : ''}\n`;
    md += `- **Size**: ${s.dimensions.width}x${s.dimensions.height}px at y=${s.dimensions.top}\n`;
    md += `- **HTML**: \`${s.htmlFile}\` (${(s.htmlLength/1024).toFixed(1)} KB)\n`;

    if (s.slots.length > 0) {
      md += `- **Content slots** (swappable text):\n`;
      s.slots.forEach(slot => {
        const text = slot.text.substring(0, 80).replace(/\n/g, ' ');
        md += `  - \`${slot.type}\`: "${text}"${slot.text.length > 80 ? '...' : ''}\n`;
      });
    }

    if (s.svgs.length > 0) {
      md += `- **SVGs**: ${s.svgs.map(svg => `${svg.purpose}(${svg.file})`).join(', ')}\n`;
    }

    if (s.images.length > 0) {
      md += `- **Images**: ${s.images.map(img => img.src.split('/').pop().substring(0, 40)).join(', ')}\n`;
    }

    if (s.videos.length > 0) {
      md += `- **Videos**: ${s.videos.map(v => v.metadataTitle || v.playbackId || v.src.split('/').pop()).join(', ')}\n`;
    }

    md += `\n`;
  });

  // Assets
  md += `## Assets Summary\n`;
  md += `- **Fonts**: ${manifest.assets.fonts.length} font-face rules\n`;
  md += `- **Images**: ${manifest.assets.images.length} total\n`;
  md += `- **Videos**: ${manifest.assets.videos.length} in HTML\n`;
  md += `- **SVGs**: ${manifest.assets.svgCount} inline SVGs extracted\n`;

  // Deep scan results
  if (manifest.spline && manifest.spline.scenes.length > 0) {
    md += `\n## 3D Models (Spline)\n`;
    md += `- **Runtime**: @splinetool/runtime@${manifest.spline.runtime || 'unknown'}\n`;
    md += `- **Scenes**:\n`;
    manifest.spline.scenes.forEach(url => {
      md += `  - \`${url}\`\n`;
    });
    md += `- **Embed**: \`<script type="module" src="https://unpkg.com/@splinetool/viewer@${manifest.spline.runtime || '1.9.82'}/build/spline-viewer.js"></script>\`\n`;
    md += `- **Usage**: \`<spline-viewer url="SCENE_URL"></spline-viewer>\`\n`;
  }

  if (manifest.cloudinary && manifest.cloudinary.cloudName) {
    md += `\n## Videos (Cloudinary)\n`;
    md += `- **Cloud name**: \`${manifest.cloudinary.cloudName}\`\n`;
    md += `- **URL pattern**: \`https://res.cloudinary.com/${manifest.cloudinary.cloudName}/video/upload/q_90/v1/{publicId}\`\n`;
    md += `- **Local pattern**: \`/__ext__/res.cloudinary.com/${manifest.cloudinary.cloudName}/video/upload/.../{publicId}.mp4\`\n`;
    md += `- **Downloaded**: ${manifest.cloudinary.videos.length} video files\n`;
    if (manifest.cloudinary.videos.length > 0) {
      md += `- **Files**:\n`;
      manifest.cloudinary.videos.slice(0, 20).forEach(v => {
        md += `  - \`${v.path}\` (${(v.size / 1024).toFixed(0)}KB)\n`;
      });
      if (manifest.cloudinary.videos.length > 20) {
        md += `  - ... and ${manifest.cloudinary.videos.length - 20} more\n`;
      }
    }
  }

  if (manifest.audio && manifest.audio.length > 0) {
    md += `\n## Audio\n`;
    manifest.audio.forEach(a => {
      md += `- \`${a.path}\` (${(a.size / 1024).toFixed(0)}KB)\n`;
    });
  }

  if (manifest.animationSystem) {
    md += `\n## Animation System\n`;
    md += `- **Libraries**: ${manifest.animationSystem.libraries.join(', ') || 'none detected'}\n`;
    md += `- **Trigger**: ${manifest.animationSystem.triggerMethod || 'unknown'}\n`;
    if (Object.keys(manifest.animationSystem.easing).length > 0) {
      md += `- **Primary easings**:\n`;
      Object.entries(manifest.animationSystem.easing).forEach(([easing, count]) => {
        md += `  - \`${easing}\` (${count}x)\n`;
      });
    }
    if (manifest.animationSystem.timing.rootMargin) {
      md += `- **Root margin**: \`${manifest.animationSystem.timing.rootMargin}\`\n`;
    }
    if (manifest.animationSystem.timing.lenisLerp) {
      md += `- **Lenis lerp**: \`${manifest.animationSystem.timing.lenisLerp}\`\n`;
    }
    if (manifest.animationSystem.cssAnimationClasses) {
      md += `- **CSS animation classes**: ${manifest.animationSystem.cssAnimationClasses.length} found\n`;
    }
  }

  // Blueprint data
  if (manifest.blueprint) {
    md += `\n## Visual Blueprint\n`;
    md += `- **Screenshots**: \`screenshots/\` folder (desktop 1920px, tablet 768px, mobile 375px + per-section)\n`;
    md += `- **Full data**: \`_blueprint.json\` with exact measurements\n`;

    if (manifest.blueprint.palette && manifest.blueprint.palette.length > 0) {
      md += `\n### Color Palette (${manifest.blueprint.palette.length} unique colors)\n`;
      manifest.blueprint.palette.slice(0, 15).forEach(c => { md += `- \`${c}\`\n`; });
      if (manifest.blueprint.palette.length > 15) md += `- ... and ${manifest.blueprint.palette.length - 15} more\n`;
    }

    if (manifest.blueprint.typography && manifest.blueprint.typography.length > 0) {
      md += `\n### Typography Scale (${manifest.blueprint.typography.length} styles)\n`;
      md += `| Size | Weight | Family | Letter-spacing | Sample |\n`;
      md += `|------|--------|--------|---------------|--------|\n`;
      manifest.blueprint.typography.slice(0, 15).forEach(t => {
        md += `| ${t.size} | ${t.weight} | ${t.family} | ${t.letterSpacing} | "${(t.sample || '').substring(0, 30)}" |\n`;
      });
    }

    if (manifest.blueprint.components && manifest.blueprint.components.length > 0) {
      md += `\n### Layout Structure\n`;
      manifest.blueprint.components.forEach((s) => {
        const r = s.rect || {};
        const st = s.style || {};
        md += `- **${s.tag}${s.id ? '#' + s.id : ''}${s.role ? ' (' + s.role + ')' : ''}** — ${r.w || '?'}x${r.h || '?'}px`;
        if (st.background) md += ` | bg: \`${st.background}\``;
        if (st.display) md += ` | ${st.display}`;
        if (st.gridTemplateColumns) md += ` | grid: ${st.gridTemplateColumns.substring(0, 60)}`;
        if (st.padding) md += ` | pad: ${st.padding}`;
        md += ` | ${(s.children || []).length} children`;
        md += `\n`;
      });
    }

    if (manifest.blueprint.cssVars && Object.keys(manifest.blueprint.cssVars).length > 0) {
      md += `\n### CSS Custom Properties\n`;
      Object.entries(manifest.blueprint.cssVars).slice(0, 25).forEach(([k, v]) => {
        md += `- \`${k}\`: \`${v}\`\n`;
      });
      const total = Object.keys(manifest.blueprint.cssVars).length;
      if (total > 25) md += `- ... and ${total - 25} more\n`;
    }
  }

  md += `\n## How to Reproduce\n`;
  md += `1. **Look at screenshots** in \`screenshots/\` — this is what it should look like\n`;
  md += `2. Read \`_blueprint.json\` for EXACT measurements, colors, typography, spacing\n`;
  md += `3. Read \`_manifest.json\` for the full structure\n`;
  md += `4. Read \`_deep-scan.json\` for Spline, video URLs, and animation system\n`;
  md += `5. Each section has a \`components/NAME.html\` with the full HTML\n`;
  md += `6. Use the EXACT CSS values from the blueprint — do NOT invent values\n`;
  md += `7. Fonts: use the clone's font files (e.g., \`_next/static/media/\` or \`fonts/\`)\n`;
  md += `8. Videos: use local files or construct URLs from the deep-scan data\n`;
  md += `9. 3D: embed Spline scenes with \`<spline-viewer>\` web component\n`;
  md += `10. Animations: use IntersectionObserver + CSS transitions matching the detected easing\n`;

  return md;
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
