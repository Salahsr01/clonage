# OUE Capture Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the fragile clone.js + decompose.js two-pass pipeline with a unified `capture.js` that captures assets + semantic blueprint in a single Playwright session on the live site, plus `validate.js` for pixelmatch feedback and `assemble.js` for LLM-driven assembly.

**Architecture:** `capture.js` navigates the live site with Playwright, scrolls to trigger lazy-load, captures all network assets, then — while still on the live page — extracts a per-section blueprint (scoped HTML, scoped CSS, semantic tree, SVGs, screenshots). `validate.js` compares assembled output against reference screenshots. `assemble.js` orchestrates the LLM to combine real components.

**Tech Stack:** Node.js, Playwright, pixelmatch, pngjs

---

## File Structure

```
oue/
├── capture.js              # NEW — unified clone + decompose (single Playwright pass)
├── lib/
│   ├── clone.js            # Extracted: asset downloading, URL rewriting, file saving
│   ├── analyze.js          # Extracted: DOM walking, section detection, CSS scoping
│   ├── screenshot.js       # Extracted: reference screenshots + section clips
│   └── utils.js            # Shared: MIME types, path helpers, console formatting
├── validate.js             # NEW — pixelmatch comparison loop
├── assemble.js             # NEW — LLM assembly orchestrator
├── serve.js                # Simplified serve-clone.js
├── package.json            # Add pixelmatch, pngjs
└── docs/superpowers/specs/2026-04-10-capture-pipeline-redesign.md
```

**Why split into lib/:** `capture.js` orchestrates the flow. The heavy logic (asset download, DOM analysis, screenshotting) lives in focused lib files. Each file has one job, stays under ~400 lines, and is testable in isolation.

---

### Task 1: Install dependencies and scaffold file structure

**Files:**
- Modify: `package.json`
- Create: `lib/utils.js`
- Create: `capture.js` (skeleton)
- Create: `validate.js` (skeleton)
- Create: `assemble.js` (skeleton)

- [ ] **Step 1: Install pixelmatch and pngjs**

```bash
cd /Volumes/T7/oue
npm install pixelmatch pngjs
```

Expected: Both packages added to `package.json` dependencies.

- [ ] **Step 2: Create lib/utils.js with shared constants**

```javascript
// lib/utils.js — Shared utilities for the OUE pipeline

const path = require('path');
const fs = require('fs');

const MIME_TYPES = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.avif': 'image/avif',
  '.svg': 'image/svg+xml', '.woff': 'font/woff', '.woff2': 'font/woff2',
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav', '.glb': 'model/gltf-binary', '.gif': 'image/gif',
};

const BLOCKED_DOMAINS = new Set([
  'www.google-analytics.com', 'www.googletagmanager.com', 'connect.facebook.net',
  'snap.licdn.com', 'sc-static.net', 'js.sentry-cdn.com', 'static.hotjar.com',
  'clarity.ms', 'cdn.segment.com', 'analytics.ahrefs.com',
]);

const VIEWPORT = { width: 1440, height: 900 };
const VIEWPORT_FULL = { width: 1920, height: 1080 };

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function slugify(url) {
  const u = new URL(url);
  return u.hostname.replace(/\./g, '_').replace(/^www_/, '');
}

function log(icon, msg) {
  process.stdout.write(`  ${icon} ${msg}\n`);
}

module.exports = { MIME_TYPES, BLOCKED_DOMAINS, VIEWPORT, VIEWPORT_FULL, ensureDir, slugify, log };
```

- [ ] **Step 3: Create capture.js skeleton**

```javascript
#!/usr/bin/env node
// capture.js — Unified clone + decompose in one Playwright pass

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const { slugify, ensureDir, log, VIEWPORT } = require('./lib/utils');

const url = process.argv[2];
if (!url) { console.error('Usage: node capture.js <url>'); process.exit(1); }

const siteName = process.argv[3] || slugify(url);
const outDir = path.resolve('sites', siteName);

async function main() {
  console.log(`\n  OUE CAPTURE — ${url}\n  Output: ${outDir}\n`);
  ensureDir(outDir);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: VIEWPORT });
  const page = await context.newPage();

  // Phase 1: Navigate + capture assets (lib/clone.js)
  log('⣾', 'Phase 1: Navigating and capturing assets...');
  // TODO: Task 2

  // Phase 2: Analyze DOM + extract components (lib/analyze.js)
  log('⣾', 'Phase 2: Analyzing DOM and extracting components...');
  // TODO: Task 3

  // Phase 3: Screenshots (lib/screenshot.js)
  log('⣾', 'Phase 3: Taking reference screenshots...');
  // TODO: Task 4

  // Phase 4: Write output
  log('⣾', 'Phase 4: Writing output...');
  // TODO: Task 5

  await browser.close();
  console.log(`\n  ✓ Capture complete: ${outDir}\n`);
}

main().catch(e => { console.error(e); process.exit(1); });
```

- [ ] **Step 4: Create validate.js skeleton**

```javascript
#!/usr/bin/env node
// validate.js — Pixelmatch comparison for LLM feedback

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');
const pixelmatch = require('pixelmatch');
const { VIEWPORT } = require('./lib/utils');

const siteDir = process.argv[2];
const targetHtml = process.argv[3];
if (!siteDir || !targetHtml) {
  console.error('Usage: node validate.js <site-dir> <output-html>');
  process.exit(1);
}

async function main() {
  // TODO: Task 6
  console.log('validate.js — not yet implemented');
}

main().catch(e => { console.error(e); process.exit(1); });
```

- [ ] **Step 5: Create assemble.js skeleton**

```javascript
#!/usr/bin/env node
// assemble.js — LLM assembly orchestrator

const fs = require('fs');
const path = require('path');

const siteDir = process.argv[2];
const mode = process.argv[3] || 'reproduce';
if (!siteDir) {
  console.error('Usage: node assemble.js <site-dir> [reproduce|frankenstein]');
  process.exit(1);
}

async function main() {
  // TODO: Task 7
  console.log('assemble.js — not yet implemented');
}

main().catch(e => { console.error(e); process.exit(1); });
```

- [ ] **Step 6: Verify all files parse correctly**

```bash
cd /Volumes/T7/oue
node -c capture.js && node -c validate.js && node -c assemble.js && node -c lib/utils.js && echo "All OK"
```

Expected: `All OK`

- [ ] **Step 7: Commit scaffold**

```bash
git add capture.js validate.js assemble.js lib/utils.js package.json package-lock.json docs/
git commit -m "scaffold: capture pipeline with capture.js, validate.js, assemble.js

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: lib/clone.js — Asset capture from live site

**Files:**
- Create: `lib/clone.js`
- Modify: `capture.js` (wire Phase 1)

This extracts the asset-downloading logic from the current `clone.js` into a reusable module. Key functions: network listener, smart scroll, force lazy-load, force visibility, resource download, URL rewriting.

- [ ] **Step 1: Create lib/clone.js**

Extract from current `clone.js` (lines 101-878). The module exports a single function `captureAssets(page, outDir, url)` that:
1. Sets up a network response listener to capture all resources
2. Navigates to the URL
3. Smart scrolls the page
4. Forces lazy-loaded resources
5. Forces visibility of hidden elements
6. Extracts resource URLs from the DOM
7. Downloads all captured resources to `outDir/assets/`
8. Saves the post-render HTML to `outDir/original.html`
9. Returns `{ html, resourceMap }` where resourceMap maps URL → local path

```javascript
// lib/clone.js — Asset capture from live site
const fs = require('fs');
const path = require('path');
const { URL } = require('url');
const { ensureDir, log, BLOCKED_DOMAINS, MIME_TYPES } = require('./utils');

// ─── Reuse from clone.js: isBinary, urlToLocalPath, shouldCapture, learnDomain ───
// Copy these functions exactly from clone.js lines 101-206
// They are pure functions with no side effects

// ─── saveResource: save a network response to disk ───
function saveResource(outDir, urlStr, body, contentType) {
  // Adapted from clone.js saveFile() — saves to outDir/assets/
  const localPath = urlToLocalPath(urlStr, contentType);
  const fullPath = path.join(outDir, 'assets', localPath);
  ensureDir(path.dirname(fullPath));
  fs.writeFileSync(fullPath, body);
  return localPath;
}

// ─── Main export ───
async function captureAssets(page, outDir, url) {
  const resourceMap = new Map(); // URL → local relative path
  const allowedDomains = new Set();
  
  // Learn the site's domain
  const origin = new URL(url);
  allowedDomains.add(origin.hostname);
  
  // Network listener — capture all responses
  page.on('response', async (response) => {
    const respUrl = response.url();
    if (!shouldCapture(respUrl)) return;
    learnDomain(respUrl, allowedDomains);
    try {
      const ct = response.headers()['content-type'] || '';
      const body = await response.body();
      const localPath = saveResource(outDir, respUrl, body, ct);
      resourceMap.set(respUrl, localPath);
    } catch (e) { /* skip failed responses */ }
  });
  
  // Navigate
  log('→', `Navigating to ${url}`);
  await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {
    log('⚠', 'networkidle timeout, continuing...');
  });
  await page.waitForTimeout(3000);
  
  // Smart scroll (from clone.js smartScroll)
  log('→', 'Scrolling page...');
  await smartScroll(page);
  
  // Force lazy + visibility (from clone.js)
  log('→', 'Forcing lazy-load and visibility...');
  await forceLazy(page);
  await forceVisibility(page);
  await page.waitForTimeout(2000);
  
  // Extract resource URLs from DOM (from clone.js extractResourceUrls)
  log('→', 'Extracting resource URLs...');
  const domUrls = await extractResourceUrls(page);
  
  // Download any missing resources
  let downloaded = 0;
  for (const resUrl of domUrls) {
    if (!resourceMap.has(resUrl) && shouldCapture(resUrl)) {
      try {
        const resp = await page.context().request.get(resUrl);
        const body = await resp.body();
        const ct = resp.headers()['content-type'] || '';
        const localPath = saveResource(outDir, resUrl, body, ct);
        resourceMap.set(resUrl, localPath);
        downloaded++;
      } catch (e) { /* skip */ }
    }
  }
  if (downloaded > 0) log('→', `Downloaded ${downloaded} additional resources`);
  
  // Save post-render HTML
  const html = await page.evaluate(() => document.documentElement.outerHTML);
  fs.writeFileSync(path.join(outDir, 'original.html'), '<!DOCTYPE html>\n<html>' + html + '</html>');
  
  log('✓', `Assets captured: ${resourceMap.size} resources`);
  return { html, resourceMap };
}

module.exports = { captureAssets };

// ─── Internal functions (copied from clone.js) ───
// smartScroll, forceLazy, forceVisibility, extractResourceUrls
// isBinary, urlToLocalPath, shouldCapture, learnDomain
// Copy these directly from clone.js — they work well as-is
```

Note to implementer: Copy the actual function bodies from `clone.js` lines 101-565. They are well-tested and work correctly. Adapt `saveFile` to use `outDir/assets/` instead of the root clone directory. The key change is that `saveResource` uses `outDir/assets/` as the base path and returns a relative path.

- [ ] **Step 2: Wire Phase 1 in capture.js**

Replace the Phase 1 TODO in `capture.js`:

```javascript
const { captureAssets } = require('./lib/clone');

// Phase 1
const { html, resourceMap } = await captureAssets(page, outDir, url);
```

- [ ] **Step 3: Test on a simple site**

```bash
node capture.js https://www.raviklaassens.com/
ls sites/raviklaassens_com/assets/ | head -10
ls sites/raviklaassens_com/original.html
```

Expected: `assets/` directory with fonts, images, CSS. `original.html` exists with full rendered content.

- [ ] **Step 4: Commit**

```bash
git add lib/clone.js capture.js
git commit -m "feat(capture): Phase 1 — asset capture from live site

Extracts clone.js logic into lib/clone.js module.
capture.js Phase 1 navigates, scrolls, downloads all assets.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: lib/analyze.js — DOM analysis + section extraction

**Files:**
- Create: `lib/analyze.js`
- Modify: `capture.js` (wire Phase 2)

This is the core innovation. While Playwright is still on the live site (fully hydrated), extract per-section components with scoped HTML, scoped CSS, semantic tree, and SVGs.

- [ ] **Step 1: Create lib/analyze.js**

```javascript
// lib/analyze.js — DOM analysis on the live page (runs in Playwright)
const fs = require('fs');
const path = require('path');
const { ensureDir, log } = require('./utils');

async function analyzeDOM(page, outDir) {
  log('→', 'Detecting sections...');
  
  const result = await page.evaluate(() => {
    // ─── SECTION DETECTION ───
    function detectSections() {
      const sections = [];
      const seen = new Set();
      
      // Strategy 1: semantic tags
      document.querySelectorAll('header, nav:first-of-type, main, footer, [role="banner"], [role="main"], [role="contentinfo"]').forEach(el => {
        if (!seen.has(el) && el.offsetHeight > 50) {
          seen.add(el);
          const tag = el.tagName.toLowerCase();
          const role = tag === 'header' || tag === 'nav' || el.getAttribute('role') === 'banner' ? 'header' :
                       tag === 'footer' || el.getAttribute('role') === 'contentinfo' ? 'footer' : 'main';
          sections.push({ el, role, tag });
        }
      });
      
      // Strategy 2: if no semantic tags, use direct children of main/body with significant height
      if (sections.length < 2) {
        const root = document.querySelector('main') || document.querySelector('#__next > div') || 
                     document.querySelector('#root > div') || document.body;
        Array.from(root.children).forEach((el, i) => {
          if (seen.has(el) || el.offsetHeight < 100 || el.offsetWidth < 200) return;
          if (getComputedStyle(el).display === 'none') return;
          seen.add(el);
          const tag = el.tagName.toLowerCase();
          const role = i === 0 ? 'header' : i === root.children.length - 1 ? 'footer' : `section_${i}`;
          sections.push({ el, role, tag });
        });
      }
      
      // Strategy 3: sections/divs with IDs or semantic classes
      if (sections.length < 2) {
        document.querySelectorAll('section[id], div[id*="hero"], div[id*="section"], div[class*="hero"], div[class*="section"]').forEach(el => {
          if (!seen.has(el) && el.offsetHeight > 100) {
            seen.add(el);
            sections.push({ el, role: el.id || el.className.split(' ')[0], tag: el.tagName.toLowerCase() });
          }
        });
      }
      
      return sections;
    }
    
    // ─── SCOPED CSS EXTRACTION ───
    function extractScopedCSS(el, className) {
      const rules = [];
      const processed = new Set();
      
      function processElement(target, selector) {
        const cs = getComputedStyle(target);
        const parentCs = target.parentElement ? getComputedStyle(target.parentElement) : null;
        const props = {};
        
        // Layout
        if (cs.display !== 'block' && cs.display !== 'inline') props['display'] = cs.display;
        if (cs.position !== 'static') props['position'] = cs.position;
        if (cs.display.includes('flex')) {
          if (cs.flexDirection !== 'row') props['flex-direction'] = cs.flexDirection;
          if (cs.flexWrap !== 'nowrap') props['flex-wrap'] = cs.flexWrap;
          if (cs.alignItems !== 'normal' && cs.alignItems !== 'stretch') props['align-items'] = cs.alignItems;
          if (cs.justifyContent !== 'normal') props['justify-content'] = cs.justifyContent;
        }
        if (cs.display.includes('grid')) {
          props['grid-template-columns'] = cs.gridTemplateColumns;
          if (cs.gridTemplateRows !== 'none' && cs.gridTemplateRows !== 'auto') props['grid-template-rows'] = cs.gridTemplateRows;
        }
        if (cs.gap !== 'normal' && cs.gap !== '0px') props['gap'] = cs.gap;
        
        // Grid child
        if (target.parentElement && getComputedStyle(target.parentElement).display.includes('grid')) {
          const gc = cs.gridColumnStart + ' / ' + cs.gridColumnEnd;
          if (gc !== 'auto / auto') props['grid-column'] = gc;
        }
        
        // Box model (only if different from parent or non-zero)
        if (cs.padding !== '0px' && cs.padding !== parentCs?.padding) props['padding'] = cs.padding;
        if (cs.margin !== '0px') props['margin'] = cs.margin;
        if (cs.maxWidth !== 'none') props['max-width'] = cs.maxWidth;
        if (cs.minHeight !== '0px' && cs.minHeight !== 'auto') props['min-height'] = cs.minHeight;
        if (cs.width !== 'auto' && cs.display !== 'block') props['width'] = cs.width;
        if (cs.height !== 'auto' && cs.height !== '0px') props['height'] = cs.height;
        
        // Typography (only if has text content)
        const hasText = Array.from(target.childNodes).some(n => n.nodeType === 3 && n.textContent.trim());
        if (hasText || ['H1','H2','H3','H4','H5','H6','P','SPAN','A','BUTTON','LI'].includes(target.tagName)) {
          if (cs.fontFamily !== parentCs?.fontFamily) props['font-family'] = cs.fontFamily;
          if (cs.fontSize !== parentCs?.fontSize) props['font-size'] = cs.fontSize;
          if (cs.fontWeight !== parentCs?.fontWeight) props['font-weight'] = cs.fontWeight;
          if (cs.lineHeight !== parentCs?.lineHeight) props['line-height'] = cs.lineHeight;
          if (cs.letterSpacing !== 'normal' && cs.letterSpacing !== parentCs?.letterSpacing) props['letter-spacing'] = cs.letterSpacing;
          if (cs.textAlign !== 'start' && cs.textAlign !== parentCs?.textAlign) props['text-align'] = cs.textAlign;
          if (cs.textTransform !== 'none') props['text-transform'] = cs.textTransform;
        }
        if (cs.color !== parentCs?.color) props['color'] = cs.color;
        
        // Visual
        if (cs.backgroundColor !== 'rgba(0, 0, 0, 0)') props['background-color'] = cs.backgroundColor;
        if (cs.backgroundImage !== 'none') props['background-image'] = cs.backgroundImage;
        if (cs.borderRadius !== '0px') props['border-radius'] = cs.borderRadius;
        if (cs.borderWidth !== '0px') props['border'] = `${cs.borderWidth} ${cs.borderStyle} ${cs.borderColor}`;
        if (cs.boxShadow !== 'none') props['box-shadow'] = cs.boxShadow;
        if (cs.overflow !== 'visible' && cs.overflow !== 'auto') props['overflow'] = cs.overflow;
        if (cs.opacity !== '1') props['opacity'] = cs.opacity;
        if (cs.zIndex !== 'auto') props['z-index'] = cs.zIndex;
        
        // Transform & transition
        if (cs.transform !== 'none') props['transform'] = cs.transform;
        if (cs.transition !== 'all 0s ease 0s' && cs.transition !== '' && cs.transitionDuration !== '0s') {
          props['transition'] = cs.transition;
        }
        
        if (Object.keys(props).length > 0) {
          rules.push({ selector, props });
        }
        
        // Recurse children (max depth 8)
        if (selector.split(' ').length < 8) {
          Array.from(target.children).forEach((child, i) => {
            if (child.offsetWidth < 2 || child.offsetHeight < 2) return;
            if (getComputedStyle(child).display === 'none') return;
            
            let childSel;
            const tag = child.tagName.toLowerCase();
            const cls = (child.className?.baseVal || child.className || '').toString()
              .split(/\s+/).filter(c => c.length > 1 && c.length < 30 && !c.startsWith('w-') && !c.startsWith('tw-')).slice(0, 2).join('.');
            
            if (child.id) childSel = `#${child.id}`;
            else if (cls) childSel = `${selector} ${tag}.${cls}`;
            else childSel = `${selector} > ${tag}:nth-child(${i + 1})`;
            
            if (!processed.has(childSel)) {
              processed.add(childSel);
              processElement(child, childSel);
            }
          });
        }
      }
      
      processElement(el, `.${className}`);
      return rules;
    }
    
    // ─── SEMANTIC TREE ───
    function buildSemanticTree(el, depth) {
      if (depth > 7) return null;
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || el.offsetWidth < 2) return null;
      
      const tag = el.tagName.toLowerCase();
      const node = { tag };
      
      // Layout context
      if (cs.display.includes('flex')) {
        node.layout = { type: cs.flexDirection === 'column' ? 'flex-col' : 'flex-row' };
        if (cs.gap !== 'normal' && cs.gap !== '0px') node.layout.gap = cs.gap;
        if (cs.alignItems !== 'normal') node.layout.alignItems = cs.alignItems;
        if (cs.justifyContent !== 'normal') node.layout.justifyContent = cs.justifyContent;
      } else if (cs.display.includes('grid')) {
        node.layout = { type: 'grid', columns: cs.gridTemplateColumns };
        if (cs.gap !== 'normal' && cs.gap !== '0px') node.layout.gap = cs.gap;
      } else if (cs.position === 'absolute' || cs.position === 'fixed') {
        node.layout = { type: cs.position };
      }
      
      // Role
      if (/^h[1-6]$/.test(tag)) node.role = 'heading';
      else if (tag === 'p') node.role = 'text';
      else if (tag === 'a') node.role = 'link';
      else if (tag === 'button') node.role = 'button';
      else if (tag === 'img') { node.role = 'image'; node.src = el.src?.substring(0, 200); node.alt = el.alt; }
      else if (tag === 'video') node.role = 'video';
      else if (tag === 'nav') node.role = 'navigation';
      
      // Text content
      const directText = Array.from(el.childNodes).filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join(' ').trim();
      const innerText = el.innerText?.trim();
      if (directText && directText.length < 200) { node.text = directText; node.slot = true; }
      else if (innerText && innerText.length < 200 && el.children.length === 0) { node.text = innerText; node.slot = true; }
      
      // SVG content
      if (tag === 'svg') {
        node.role = 'icon';
        try {
          const markup = new XMLSerializer().serializeToString(el);
          if (markup.length < 5000) node.svgContent = markup;
          else node.svgSize = markup.length;
        } catch(e) {}
        node.viewBox = el.getAttribute('viewBox') || '';
        return node; // Don't recurse into SVG children
      }
      
      // Data attributes (animation)
      const dataAttrs = {};
      for (const attr of el.attributes) {
        if (attr.name.startsWith('data-') && attr.name.length < 40) {
          dataAttrs[attr.name] = attr.value;
        }
      }
      if (Object.keys(dataAttrs).length > 0) node.data = dataAttrs;
      
      // Recurse children
      const children = [];
      Array.from(el.children).forEach(child => {
        const childNode = buildSemanticTree(child, depth + 1);
        if (childNode) children.push(childNode);
      });
      if (children.length > 0) node.children = children;
      
      return node;
    }
    
    // ─── DESIGN TOKENS ───
    function extractTokens() {
      const tokens = { cssVars: {}, fontFaces: [], palette: new Set(), typography: [] };
      
      // CSS variables from :root
      for (const sheet of document.styleSheets) {
        try {
          for (const rule of sheet.cssRules) {
            if (rule.selectorText === ':root' || rule.selectorText === ':root, :host') {
              for (const prop of rule.style) {
                if (prop.startsWith('--')) tokens.cssVars[prop] = rule.style.getPropertyValue(prop).trim();
              }
            }
            if (rule instanceof CSSFontFaceRule) {
              tokens.fontFaces.push({
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
      
      // Body styles
      const bodyCs = getComputedStyle(document.body);
      tokens.body = {
        fontFamily: bodyCs.fontFamily,
        fontSize: bodyCs.fontSize,
        color: bodyCs.color,
        background: bodyCs.backgroundColor,
      };
      
      tokens.palette = [...tokens.palette];
      return tokens;
    }
    
    // ─── EXTRACT INLINE STYLES ───
    function extractInlineStyles() {
      const styles = [];
      document.querySelectorAll('style').forEach(el => {
        const css = el.textContent.trim();
        if (css.length > 20 && css.length < 10000 && !css.startsWith('*{visibility')) {
          if (css.includes('hover') || css.includes('animation') || css.includes('keyframes') ||
              css.includes('transition') || css.includes('data-') || css.includes('transform')) {
            styles.push(css);
          }
        }
      });
      return styles;
    }
    
    // ─── MAIN EXECUTION ───
    const sections = detectSections();
    const tokens = extractTokens();
    const inlineStyles = extractInlineStyles();
    
    const components = sections.map(({ el, role, tag }, i) => {
      const rect = el.getBoundingClientRect();
      const className = `oue-${role.replace(/[^a-z0-9]/g, '-')}`;
      
      // Scoped CSS
      const cssRules = extractScopedCSS(el, className);
      
      // Scoped HTML
      const markup = el.outerHTML;
      
      // Semantic tree
      const tree = buildSemanticTree(el, 0);
      
      return {
        index: i,
        role,
        tag,
        className,
        rect: { x: Math.round(rect.x), y: Math.round(rect.y + window.scrollY), w: Math.round(rect.width), h: Math.round(rect.height) },
        cssRules,
        markup: markup.length < 200000 ? markup : null, // Skip huge sections
        markupSize: markup.length,
        tree,
      };
    });
    
    return { components, tokens, inlineStyles, viewport: { w: window.innerWidth, h: window.innerHeight } };
  });
  
  log('✓', `Detected ${result.components.length} sections`);
  
  // Write components
  ensureDir(path.join(outDir, 'components'));
  
  for (const comp of result.components) {
    const compDir = path.join(outDir, 'components', comp.role);
    ensureDir(compDir);
    
    // markup.html
    if (comp.markup) {
      fs.writeFileSync(path.join(compDir, 'markup.html'), comp.markup);
    }
    
    // styles.css (from cssRules)
    const css = comp.cssRules.map(r => {
      const props = Object.entries(r.props).map(([k, v]) => `  ${k}: ${v};`).join('\n');
      return `${r.selector} {\n${props}\n}`;
    }).join('\n\n');
    fs.writeFileSync(path.join(compDir, 'styles.css'), css);
    
    // meta.json
    fs.writeFileSync(path.join(compDir, 'meta.json'), JSON.stringify({
      role: comp.role,
      rect: comp.rect,
      tree: comp.tree,
    }, null, 2));
    
    log('→', `  ${comp.role}: ${comp.cssRules.length} CSS rules, ${(comp.markupSize / 1024).toFixed(1)}KB HTML`);
  }
  
  // Write tokens.json
  fs.writeFileSync(path.join(outDir, 'tokens.json'), JSON.stringify(result.tokens, null, 2));
  
  // Write inline styles
  if (result.inlineStyles.length > 0) {
    fs.writeFileSync(path.join(outDir, 'inline-styles.css'), result.inlineStyles.join('\n\n/* ═══ */\n\n'));
  }
  
  // Write blueprint.json (full structure)
  fs.writeFileSync(path.join(outDir, 'blueprint.json'), JSON.stringify({
    url,
    viewport: result.viewport,
    tokens: result.tokens,
    components: result.components.map(c => ({
      role: c.role,
      rect: c.rect,
      cssRuleCount: c.cssRules.length,
      markupSize: c.markupSize,
      treeDepth: JSON.stringify(c.tree).length,
    })),
    inlineStyleCount: result.inlineStyles.length,
  }, null, 2));
  
  return result;
}

module.exports = { analyzeDOM };
```

- [ ] **Step 2: Wire Phase 2 in capture.js**

```javascript
const { analyzeDOM } = require('./lib/analyze');

// Phase 2 (after captureAssets, page is still on the live site)
const analysis = await analyzeDOM(page, outDir);
```

- [ ] **Step 3: Test on raviklaassens**

```bash
node capture.js https://www.raviklaassens.com/
ls sites/raviklaassens_com/components/
cat sites/raviklaassens_com/components/header/meta.json | head -20
head -30 sites/raviklaassens_com/components/header/styles.css
```

Expected: Components directory with header/, main/ (or hero/), footer/. Each has markup.html, styles.css, meta.json.

- [ ] **Step 4: Test on elevenlabs**

```bash
node capture.js https://elevenlabs.io/
ls sites/elevenlabs_io/components/
```

Expected: Components detected (header, main sections, footer) — because we're on the live site, JS hydration works perfectly.

- [ ] **Step 5: Commit**

```bash
git add lib/analyze.js capture.js
git commit -m "feat(capture): Phase 2 — DOM analysis with scoped CSS and semantic tree

Extracts per-section components with scoped CSS, semantic tree, SVGs.
Runs on live site — no re-rendering needed.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: lib/screenshot.js — Reference screenshots

**Files:**
- Create: `lib/screenshot.js`
- Modify: `capture.js` (wire Phase 3)

- [ ] **Step 1: Create lib/screenshot.js**

```javascript
// lib/screenshot.js — Reference screenshots for pixelmatch validation
const fs = require('fs');
const path = require('path');
const { ensureDir, log, VIEWPORT } = require('./utils');

async function captureScreenshots(page, outDir, components) {
  const refDir = path.join(outDir, 'reference');
  ensureDir(refDir);
  ensureDir(path.join(refDir, 'sections'));
  
  // Scroll to top
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(1000);
  
  // Full page screenshot at viewport size
  const fullBuf = await page.screenshot({ type: 'png' });
  fs.writeFileSync(path.join(refDir, `full-${VIEWPORT.width}x${VIEWPORT.height}.png`), fullBuf);
  log('→', `Full screenshot: ${VIEWPORT.width}x${VIEWPORT.height}`);
  
  // Per-section screenshots
  for (const comp of components) {
    if (!comp.rect || comp.rect.h < 10) continue;
    try {
      const clip = {
        x: Math.max(0, comp.rect.x),
        y: comp.rect.y,
        width: Math.min(comp.rect.w, VIEWPORT.width),
        height: Math.min(comp.rect.h, 3000),
      };
      const buf = await page.screenshot({ clip, type: 'png' });
      const compDir = path.join(outDir, 'components', comp.role);
      ensureDir(compDir);
      fs.writeFileSync(path.join(compDir, 'screenshot.png'), buf);
      fs.writeFileSync(path.join(refDir, 'sections', `${comp.role}.png`), buf);
    } catch (e) {
      log('⚠', `Screenshot failed for ${comp.role}: ${e.message}`);
    }
  }
  
  // Mobile screenshot
  await page.setViewportSize({ width: 375, height: 812 });
  await page.waitForTimeout(1000);
  const mobileBuf = await page.screenshot({ type: 'png' });
  fs.writeFileSync(path.join(refDir, 'full-375x812.png'), mobileBuf);
  
  // Reset viewport
  await page.setViewportSize(VIEWPORT);
  await page.waitForTimeout(500);
  
  log('✓', `Screenshots saved: full + ${components.length} sections + mobile`);
}

module.exports = { captureScreenshots };
```

- [ ] **Step 2: Wire Phase 3 in capture.js**

```javascript
const { captureScreenshots } = require('./lib/screenshot');

// Phase 3
await captureScreenshots(page, outDir, analysis.components);
```

- [ ] **Step 3: Test**

```bash
node capture.js https://www.raviklaassens.com/
ls sites/raviklaassens_com/reference/
# Expected: full-1440x900.png, full-375x812.png, sections/header.png, etc.
```

- [ ] **Step 4: Commit**

```bash
git add lib/screenshot.js capture.js
git commit -m "feat(capture): Phase 3 — reference screenshots for pixelmatch

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: validate.js — Pixelmatch feedback loop

**Files:**
- Modify: `validate.js` (full implementation)

- [ ] **Step 1: Implement validate.js**

```javascript
#!/usr/bin/env node
// validate.js — Pixelmatch comparison for LLM feedback

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');
const pixelmatch = require('pixelmatch');
const { VIEWPORT } = require('./lib/utils');

const siteDir = process.argv[2];
const targetHtml = process.argv[3];
if (!siteDir || !targetHtml) {
  console.error('Usage: node validate.js <site-dir> <target-html-or-url>');
  process.exit(1);
}

async function main() {
  // Load reference screenshot
  const refPath = path.join(siteDir, 'reference', `full-${VIEWPORT.width}x${VIEWPORT.height}.png`);
  if (!fs.existsSync(refPath)) {
    console.error(`Reference screenshot not found: ${refPath}`);
    process.exit(1);
  }
  const refPng = PNG.sync.read(fs.readFileSync(refPath));
  
  // Take screenshot of target
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: VIEWPORT });
  
  const target = targetHtml.startsWith('http') ? targetHtml : `file://${path.resolve(targetHtml)}`;
  await page.goto(target, { waitUntil: 'networkidle', timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(3000);
  
  const targetBuf = await page.screenshot({ type: 'png' });
  await browser.close();
  
  const targetPng = PNG.sync.read(targetBuf);
  
  // Ensure same dimensions
  if (refPng.width !== targetPng.width || refPng.height !== targetPng.height) {
    console.error(`Dimension mismatch: ref ${refPng.width}x${refPng.height} vs target ${targetPng.width}x${targetPng.height}`);
    process.exit(1);
  }
  
  const { width, height } = refPng;
  const diff = new PNG({ width, height });
  
  const numDiffPixels = pixelmatch(refPng.data, targetPng.data, diff.data, width, height, {
    threshold: 0.1,
  });
  
  const totalPixels = width * height;
  const score = ((1 - numDiffPixels / totalPixels) * 100).toFixed(1);
  
  // Zone analysis (4x3 grid)
  const cols = 4, rows = 3;
  const zoneW = Math.floor(width / cols);
  const zoneH = Math.floor(height / rows);
  const zones = [];
  
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      let zoneDiff = 0;
      const x0 = col * zoneW, y0 = row * zoneH;
      const x1 = x0 + zoneW, y1 = y0 + zoneH;
      
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const idx = (y * width + x) * 4;
          if (diff.data[idx] > 0) zoneDiff++;
        }
      }
      
      const zoneTotal = zoneW * zoneH;
      const pct = (zoneDiff / zoneTotal * 100).toFixed(1);
      if (parseFloat(pct) > 2) {
        const region = `${['top','mid','bot'][row]}-${['left','center-left','center-right','right'][col]}`;
        zones.push({ region, coords: [x0, y0, x1, y1], diffPercent: parseFloat(pct) });
      }
    }
  }
  
  zones.sort((a, b) => b.diffPercent - a.diffPercent);
  
  // Save diff image
  const diffPath = path.join(path.dirname(targetHtml.startsWith('http') ? '.' : targetHtml), 'diff-heatmap.png');
  fs.writeFileSync(diffPath, PNG.sync.write(diff));
  
  // Save target screenshot
  const targetScreenPath = path.join(path.dirname(targetHtml.startsWith('http') ? '.' : targetHtml), 'screenshot-target.png');
  fs.writeFileSync(targetScreenPath, targetBuf);
  
  const result = {
    score: parseFloat(score),
    totalPixels,
    diffPixels: numDiffPixels,
    zones: zones.slice(0, 6),
    heatmapPath: diffPath,
  };
  
  console.log(JSON.stringify(result, null, 2));
  
  // Human-readable summary
  console.log(`\n  Score: ${score}% match`);
  if (zones.length > 0) {
    console.log('  Problem zones:');
    zones.slice(0, 4).forEach(z => console.log(`    ${z.region}: ${z.diffPercent}% different`));
  }
}

main().catch(e => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Test with raviklaassens (compare original reference with itself)**

```bash
# Self-comparison should give ~100%
node validate.js sites/raviklaassens_com/ https://www.raviklaassens.com/
```

Expected: Score close to 95-100% (minor differences from dynamic content like clock).

- [ ] **Step 3: Commit**

```bash
git add validate.js
git commit -m "feat(validate): pixelmatch comparison with zone analysis

Compares target page against reference screenshot.
Outputs JSON with score + problem zones for LLM feedback.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: assemble.js — Mode reproduce

**Files:**
- Modify: `assemble.js` (full implementation for reproduce mode)

- [ ] **Step 1: Implement assemble.js reproduce mode**

```javascript
#!/usr/bin/env node
// assemble.js — Assemble real components into a page

const fs = require('fs');
const path = require('path');
const { ensureDir } = require('./lib/utils');

const siteDir = process.argv[2];
const mode = process.argv[3] || 'reproduce';
if (!siteDir) {
  console.error('Usage: node assemble.js <site-dir> [reproduce|frankenstein]');
  process.exit(1);
}

function reproduce(siteDir) {
  const outDir = path.join('output', path.basename(siteDir) + '_reproduced');
  ensureDir(outDir);
  
  // Read tokens
  const tokens = JSON.parse(fs.readFileSync(path.join(siteDir, 'tokens.json'), 'utf-8'));
  
  // Read all components in order
  const componentsDir = path.join(siteDir, 'components');
  const componentNames = fs.readdirSync(componentsDir).filter(f => 
    fs.statSync(path.join(componentsDir, f)).isDirectory()
  );
  
  // Sort: header first, footer last, rest by directory order
  componentNames.sort((a, b) => {
    if (a === 'header') return -1;
    if (b === 'header') return 1;
    if (a === 'footer') return 1;
    if (b === 'footer') return -1;
    return 0;
  });
  
  // Build HTML
  let allCSS = '';
  let allMarkup = '';
  
  for (const name of componentNames) {
    const dir = path.join(componentsDir, name);
    const cssPath = path.join(dir, 'styles.css');
    const htmlPath = path.join(dir, 'markup.html');
    
    if (fs.existsSync(cssPath)) allCSS += `/* === ${name} === */\n` + fs.readFileSync(cssPath, 'utf-8') + '\n\n';
    if (fs.existsSync(htmlPath)) allMarkup += `<!-- ${name} -->\n` + fs.readFileSync(htmlPath, 'utf-8') + '\n\n';
  }
  
  // Font faces
  const fontFaces = tokens.fontFaces?.map(ff => 
    `@font-face { font-family: '${ff.family}'; src: ${ff.src}; font-weight: ${ff.weight}; font-style: ${ff.style}; font-display: ${ff.display}; }`
  ).join('\n') || '';
  
  // Inline styles (hover/animation)
  const inlineStylesPath = path.join(siteDir, 'inline-styles.css');
  const inlineStyles = fs.existsSync(inlineStylesPath) ? fs.readFileSync(inlineStylesPath, 'utf-8') : '';
  
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Reproduced — ${path.basename(siteDir)}</title>
<style>
/* Font faces */
${fontFaces}

/* Reset */
*, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
html { scroll-behavior: smooth; }
body {
  font-family: ${tokens.body?.fontFamily || 'sans-serif'};
  font-size: ${tokens.body?.fontSize || '16px'};
  color: ${tokens.body?.color || '#000'};
  background: ${tokens.body?.background || '#fff'};
  -webkit-font-smoothing: antialiased;
}
a { color: inherit; text-decoration: none; }

/* Component styles */
${allCSS}

/* Inline styles (hover/animation) */
${inlineStyles}
</style>
</head>
<body>
${allMarkup}
</body>
</html>`;
  
  // Symlink assets
  const assetsSource = path.join(siteDir, 'assets');
  const assetsLink = path.join(outDir, 'assets');
  if (fs.existsSync(assetsSource) && !fs.existsSync(assetsLink)) {
    fs.symlinkSync(path.resolve(assetsSource), assetsLink);
  }
  
  fs.writeFileSync(path.join(outDir, 'index.html'), html);
  console.log(`  ✓ Assembled: ${outDir}/index.html (${(html.length / 1024).toFixed(1)}KB)`);
  console.log(`  Components: ${componentNames.join(', ')}`);
  
  return outDir;
}

async function main() {
  if (mode === 'reproduce') {
    reproduce(siteDir);
  } else if (mode === 'frankenstein') {
    console.log('Frankenstein mode — not yet implemented');
    // TODO: Task for later phase
  } else {
    console.error(`Unknown mode: ${mode}`);
    process.exit(1);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Test full pipeline on raviklaassens**

```bash
node capture.js https://www.raviklaassens.com/
node assemble.js sites/raviklaassens_com/
node validate.js sites/raviklaassens_com/ output/raviklaassens_com_reproduced/index.html
```

Expected: Score should be high (the assembled page uses real HTML/CSS from the site).

- [ ] **Step 3: Commit**

```bash
git add assemble.js
git commit -m "feat(assemble): reproduce mode — combine real components into page

Reads scoped components, assembles HTML with font-faces and inline styles.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: End-to-end test on 3 sites

**Files:**
- No new files — validation run

- [ ] **Step 1: Test raviklaassens.com**

```bash
node capture.js https://www.raviklaassens.com/
node assemble.js sites/raviklaassens_com/
node validate.js sites/raviklaassens_com/ output/raviklaassens_com_reproduced/index.html
```

Record score.

- [ ] **Step 2: Test sohub.digital**

```bash
node capture.js https://sohub.digital/
node assemble.js sites/sohub_digital/
node validate.js sites/sohub_digital/ output/sohub_digital_reproduced/index.html
```

Record score.

- [ ] **Step 3: Test elevenlabs.io**

```bash
node capture.js https://elevenlabs.io/
node assemble.js sites/elevenlabs_io/
node validate.js sites/elevenlabs_io/ output/elevenlabs_io_reproduced/index.html
```

Record score.

- [ ] **Step 4: Fix any issues found during testing**

If any site fails, debug and fix. Common issues:
- Section detection misses a section → add selector to `detectSections()`
- CSS scoping includes too many/few rules → adjust default filtering
- Screenshots don't match dimensions → check viewport reset

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "test: end-to-end validation on 3 sites

Scores: raviklaassens X%, sohub X%, elevenlabs X%

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: Update package.json scripts and archive old files

**Files:**
- Modify: `package.json`
- Create: `_archive/` (move old files)

- [ ] **Step 1: Update package.json scripts**

```json
{
  "scripts": {
    "capture": "node capture.js",
    "assemble": "node assemble.js",
    "validate": "node validate.js",
    "serve": "node serve.js",
    "pipeline": "node capture.js $URL && node assemble.js sites/$SITE && node validate.js sites/$SITE output/${SITE}_reproduced/index.html"
  }
}
```

- [ ] **Step 2: Archive old files**

```bash
mkdir -p _archive
mv clone.js decompose.js recompose.js deep-analyze.js extract-dna.js create-site.js _archive/
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore: archive old pipeline files, update scripts

Old files moved to _archive/. New pipeline: capture → assemble → validate.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```
