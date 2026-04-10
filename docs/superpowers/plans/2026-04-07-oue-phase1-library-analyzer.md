# OUE Phase 1: Library + Analyzer — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the component library (SQLite DB + file storage) and the analyzer that decomposes cloned sites into reusable components indexed by type, style, and tags.

**Architecture:** Two modules — `library.js` handles all DB operations (CRUD, search, schema), `analyzer.js` parses cloned HTML into sections, extracts isolated CSS/JS/assets per component, screenshots them via Playwright, and classifies them via Claude API. Both are importable modules AND callable from CLI.

**Tech Stack:** Node.js, better-sqlite3, @anthropic-ai/sdk, Playwright (already installed), node:crypto for IDs.

**Phases overview:**
- **Phase 1 (this plan):** Library DB + Analyzer — the foundation
- **Phase 2:** Browser — visual curation interface
- **Phase 3:** Creator — site generation via Claude API
- **Phase 4:** Console update — wire everything into the `salah` menu

---

## File Structure

```
~/Desktop/OUE/_core/
├── library.js          # NEW — SQLite DB wrapper (CRUD, search, schema)
├── analyzer.js         # NEW — Decomposes cloned sites into components
├── config.js           # NEW — Config management (~/.oue/config.json)
├── console.js          # MODIFY — Add CLI argument routing for analyze/config
├── package.json        # MODIFY — Add better-sqlite3, @anthropic-ai/sdk

~/.oue/
├── config.json         # API key storage
├── library.db          # SQLite database
└── library/
    └── components/
        └── {id}/       # One dir per extracted component
            ├── component.html
            ├── component.css
            ├── component.js
            ├── screenshot.png
            └── meta.json
```

---

### Task 1: Install dependencies and create config module

**Files:**
- Modify: `~/Desktop/OUE/_core/package.json`
- Create: `~/Desktop/OUE/_core/config.js`

- [ ] **Step 1: Install new dependencies**

```bash
cd ~/Desktop/OUE/_core
npm install better-sqlite3 @anthropic-ai/sdk
```

Expected: `added 2 packages` (or similar), no errors.

- [ ] **Step 2: Create config.js**

```js
// ~/Desktop/OUE/_core/config.js
const fs = require('fs');
const path = require('path');
const os = require('os');

const OUE_DIR = path.join(os.homedir(), '.oue');
const CONFIG_PATH = path.join(OUE_DIR, 'config.json');
const LIBRARY_DIR = path.join(OUE_DIR, 'library', 'components');
const DB_PATH = path.join(OUE_DIR, 'library.db');

function ensureDirs() {
  fs.mkdirSync(LIBRARY_DIR, { recursive: true });
}

function load() {
  ensureDirs();
  if (!fs.existsSync(CONFIG_PATH)) return {};
  try { return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8')); } catch { return {}; }
}

function save(config) {
  ensureDirs();
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
}

function getApiKey() {
  const cfg = load();
  return cfg.anthropic_api_key || process.env.ANTHROPIC_API_KEY || null;
}

function setApiKey(key) {
  const cfg = load();
  cfg.anthropic_api_key = key;
  save(cfg);
}

module.exports = { OUE_DIR, CONFIG_PATH, LIBRARY_DIR, DB_PATH, ensureDirs, load, save, getApiKey, setApiKey };
```

- [ ] **Step 3: Verify config module works**

```bash
cd ~/Desktop/OUE/_core
node -e "const cfg = require('./config'); cfg.ensureDirs(); console.log('OUE_DIR:', cfg.OUE_DIR); console.log('exists:', require('fs').existsSync(cfg.OUE_DIR));"
```

Expected: prints `OUE_DIR: /Users/salah/.oue` and `exists: true`.

- [ ] **Step 4: Commit**

```bash
cd ~/Desktop/OUE/_core
git init 2>/dev/null; git add config.js package.json package-lock.json
git commit -m "feat: add config module and new dependencies (better-sqlite3, anthropic sdk)"
```

---

### Task 2: Create library module with SQLite schema

**Files:**
- Create: `~/Desktop/OUE/_core/library.js`

- [ ] **Step 1: Create library.js with schema init and CRUD**

```js
// ~/Desktop/OUE/_core/library.js
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const { DB_PATH, LIBRARY_DIR, ensureDirs } = require('./config');

let _db = null;

function getDb() {
  if (_db) return _db;
  ensureDirs();
  _db = new Database(DB_PATH);
  _db.pragma('journal_mode = WAL');
  _db.pragma('foreign_keys = ON');
  initSchema(_db);
  return _db;
}

function initSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS components (
      id TEXT PRIMARY KEY,
      source TEXT NOT NULL,
      source_url TEXT,
      type TEXT NOT NULL,
      subtype TEXT,
      description TEXT,
      tags TEXT DEFAULT '[]',
      colors TEXT DEFAULT '[]',
      fonts TEXT DEFAULT '[]',
      animations TEXT DEFAULT '[]',
      complexity TEXT DEFAULT 'medium',
      starred INTEGER DEFAULT 0,
      html_path TEXT,
      css_path TEXT,
      js_path TEXT,
      screenshot_path TEXT,
      extracted_at TEXT
    );

    CREATE TABLE IF NOT EXISTS sites (
      domain TEXT PRIMARY KEY,
      url TEXT,
      clone_path TEXT,
      analyzed INTEGER DEFAULT 0,
      analyzed_at TEXT,
      component_count INTEGER DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_comp_type ON components(type);
    CREATE INDEX IF NOT EXISTS idx_comp_starred ON components(starred);
    CREATE INDEX IF NOT EXISTS idx_comp_source ON components(source);
  `);
}

// ─── Components CRUD ────────────────────────────────────────────────────────

function addComponent(comp) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO components (id, source, source_url, type, subtype, description,
      tags, colors, fonts, animations, complexity, starred,
      html_path, css_path, js_path, screenshot_path, extracted_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    comp.id, comp.source, comp.sourceUrl || null, comp.type, comp.subtype || null,
    comp.description || null,
    JSON.stringify(comp.tags || []), JSON.stringify(comp.colors || []),
    JSON.stringify(comp.fonts || []), JSON.stringify(comp.animations || []),
    comp.complexity || 'medium', comp.starred ? 1 : 0,
    comp.htmlPath || null, comp.cssPath || null, comp.jsPath || null,
    comp.screenshotPath || null, comp.extractedAt || new Date().toISOString()
  );
}

function getComponent(id) {
  const row = getDb().prepare('SELECT * FROM components WHERE id = ?').get(id);
  return row ? parseRow(row) : null;
}

function searchComponents({ type, source, tags, starred, limit } = {}) {
  let sql = 'SELECT * FROM components WHERE 1=1';
  const params = [];
  if (type) { sql += ' AND type = ?'; params.push(type); }
  if (source) { sql += ' AND source = ?'; params.push(source); }
  if (starred) { sql += ' AND starred = 1'; }
  if (tags && tags.length) {
    for (const t of tags) { sql += ' AND tags LIKE ?'; params.push(`%"${t}"%`); }
  }
  sql += ' ORDER BY extracted_at DESC';
  if (limit) { sql += ' LIMIT ?'; params.push(limit); }
  return getDb().prepare(sql).all(...params).map(parseRow);
}

function toggleStar(id) {
  getDb().prepare('UPDATE components SET starred = CASE WHEN starred = 1 THEN 0 ELSE 1 END WHERE id = ?').run(id);
}

function deleteComponent(id) {
  const comp = getComponent(id);
  if (!comp) return;
  getDb().prepare('DELETE FROM components WHERE id = ?').run(id);
  // Remove files
  const dir = path.join(LIBRARY_DIR, id);
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
}

function countComponents() {
  return getDb().prepare('SELECT COUNT(*) as count FROM components').get().count;
}

function getTypes() {
  return getDb().prepare('SELECT DISTINCT type FROM components ORDER BY type').all().map(r => r.type);
}

function getSources() {
  return getDb().prepare('SELECT DISTINCT source FROM components ORDER BY source').all().map(r => r.source);
}

// ─── Sites CRUD ─────────────────────────────────────────────────────────────

function addSite(domain, url, clonePath) {
  getDb().prepare(`
    INSERT OR REPLACE INTO sites (domain, url, clone_path, analyzed, analyzed_at, component_count)
    VALUES (?, ?, ?, 0, NULL, 0)
  `).run(domain, url, clonePath);
}

function markSiteAnalyzed(domain, componentCount) {
  getDb().prepare(`
    UPDATE sites SET analyzed = 1, analyzed_at = ?, component_count = ? WHERE domain = ?
  `).run(new Date().toISOString(), componentCount, domain);
}

function getSite(domain) {
  return getDb().prepare('SELECT * FROM sites WHERE domain = ?').get(domain);
}

function getUnanalyzedSites() {
  return getDb().prepare('SELECT * FROM sites WHERE analyzed = 0').all();
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function parseRow(row) {
  return {
    ...row,
    tags: tryParse(row.tags),
    colors: tryParse(row.colors),
    fonts: tryParse(row.fonts),
    animations: tryParse(row.animations),
    starred: !!row.starred,
  };
}

function tryParse(s) {
  try { return JSON.parse(s); } catch { return []; }
}

function close() {
  if (_db) { _db.close(); _db = null; }
}

module.exports = {
  getDb, addComponent, getComponent, searchComponents, toggleStar,
  deleteComponent, countComponents, getTypes, getSources,
  addSite, markSiteAnalyzed, getSite, getUnanalyzedSites, close,
};
```

- [ ] **Step 2: Verify library module works**

```bash
cd ~/Desktop/OUE/_core
node -e "
const lib = require('./library');
lib.addComponent({
  id: 'test-001', source: 'test.com', type: 'hero',
  description: 'Test hero', tags: ['dark','minimal'],
});
const c = lib.getComponent('test-001');
console.log('Found:', c.id, c.type, c.tags);
const results = lib.searchComponents({ type: 'hero' });
console.log('Search:', results.length, 'results');
lib.deleteComponent('test-001');
console.log('Deleted, count:', lib.countComponents());
lib.close();
"
```

Expected: `Found: test-001 hero [ 'dark', 'minimal' ]`, `Search: 1 results`, `Deleted, count: 0`.

- [ ] **Step 3: Commit**

```bash
cd ~/Desktop/OUE/_core
git add library.js
git commit -m "feat: add library module with SQLite schema and CRUD"
```

---

### Task 3: Create analyzer module — HTML parsing and section extraction

**Files:**
- Create: `~/Desktop/OUE/_core/analyzer.js`

- [ ] **Step 1: Create analyzer.js with section detection and CSS extraction**

```js
// ~/Desktop/OUE/_core/analyzer.js
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { chromium } = require('playwright');
const { LIBRARY_DIR } = require('./config');
const lib = require('./library');

// ─── Section detection patterns ─────────────────────────────────────────────

const SECTION_TAGS = ['section', 'header', 'footer', 'nav', 'main', 'article'];
const SEMANTIC_CLASSES = [
  'hero', 'banner', 'header', 'nav', 'navbar', 'navigation',
  'features', 'feature', 'services', 'about', 'contact',
  'testimonials', 'reviews', 'pricing', 'faq',
  'gallery', 'portfolio', 'projects', 'work', 'cases',
  'team', 'partners', 'clients', 'logos',
  'cta', 'call-to-action', 'subscribe', 'newsletter',
  'footer', 'stats', 'numbers', 'counters',
  'process', 'steps', 'how-it-works', 'timeline',
  'blog', 'news', 'articles', 'posts',
  'video', 'media', 'embed',
];

function genId() {
  return crypto.randomBytes(6).toString('hex');
}

// ─── Main analyze function ──────────────────────────────────────────────────

async function analyzeSite(clonePath, { emit, apiKey } = {}) {
  emit = emit || (() => {});
  const domain = path.basename(clonePath);

  emit('status', `Analyse de ${domain}...`);

  // Find all HTML files
  const htmlFiles = [];
  function findHtml(dir) {
    if (!fs.existsSync(dir)) return;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory() && !e.name.startsWith('__ext__') && !e.name.startsWith('_')) {
        findHtml(full);
      } else if (e.name === 'index.html') {
        htmlFiles.push(full);
      }
    }
  }
  findHtml(clonePath);

  emit('status', `${htmlFiles.length} pages trouvees`);

  // Launch browser for screenshots
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });

  const components = [];

  for (let i = 0; i < htmlFiles.length; i++) {
    const htmlFile = htmlFiles[i];
    const relPath = path.relative(clonePath, htmlFile);
    emit('status', `Page ${i+1}/${htmlFiles.length}: ${relPath}`);

    try {
      const html = fs.readFileSync(htmlFile, 'utf-8');
      const sections = extractSections(html);

      emit('log', { message: `${sections.length} sections dans ${relPath}` });

      for (let j = 0; j < sections.length; j++) {
        const sec = sections[j];
        const id = genId();
        const compDir = path.join(LIBRARY_DIR, id);
        fs.mkdirSync(compDir, { recursive: true });

        // Save HTML
        const htmlOut = wrapComponent(sec.html, sec.css);
        fs.writeFileSync(path.join(compDir, 'component.html'), htmlOut, 'utf-8');

        // Save CSS
        fs.writeFileSync(path.join(compDir, 'component.css'), sec.css, 'utf-8');

        // Save JS (if any)
        fs.writeFileSync(path.join(compDir, 'component.js'), sec.js || '', 'utf-8');

        // Screenshot
        let screenshotPath = null;
        try {
          const page = await context.newPage();
          await page.setContent(htmlOut, { waitUntil: 'networkidle', timeout: 10000 }).catch(() => {});
          await page.waitForTimeout(500);
          screenshotPath = path.join(compDir, 'screenshot.png');
          await page.screenshot({ path: screenshotPath, fullPage: true });
          await page.close();
        } catch { screenshotPath = null; }

        // Classify with Claude API if key available
        let classification = { type: sec.guessedType, subtype: null, description: sec.guessedType + ' section', tags: [], complexity: 'medium' };
        if (apiKey) {
          try {
            classification = await classifyComponent(apiKey, sec.html, sec.guessedType);
          } catch (e) {
            emit('log', { message: `Classification echec: ${e.message.slice(0,40)}` });
          }
        }

        // Extract visual metadata
        const colors = extractColors(sec.css);
        const fonts = extractFonts(sec.css);
        const animations = extractAnimations(sec.css, sec.js);

        // Save meta.json
        const meta = {
          id, source: domain, sourceUrl: null,
          type: classification.type, subtype: classification.subtype,
          description: classification.description,
          tags: classification.tags, colors, fonts, animations,
          complexity: classification.complexity, starred: false,
          extractedAt: new Date().toISOString(),
        };
        fs.writeFileSync(path.join(compDir, 'meta.json'), JSON.stringify(meta, null, 2), 'utf-8');

        // Add to DB
        lib.addComponent({
          ...meta,
          htmlPath: path.join(compDir, 'component.html'),
          cssPath: path.join(compDir, 'component.css'),
          jsPath: path.join(compDir, 'component.js'),
          screenshotPath,
        });

        components.push(meta);
        emit('progress', { components: components.length, current: `${classification.type}: ${classification.description.slice(0,50)}` });
      }
    } catch (e) {
      emit('log', { message: `Erreur page ${relPath}: ${e.message.slice(0,50)}` });
    }
  }

  await context.close().catch(() => {});
  await browser.close().catch(() => {});

  // Mark site as analyzed
  lib.addSite(domain, null, clonePath);
  lib.markSiteAnalyzed(domain, components.length);

  emit('done', { domain, components: components.length });
  return components;
}

// ─── Extract sections from HTML ─────────────────────────────────────────────

function extractSections(html) {
  const sections = [];

  // Extract all CSS from the page
  const allCss = extractAllCss(html);

  // Find sections using regex (no DOM parser dependency needed)
  // Match top-level semantic elements
  const sectionPattern = /<(section|header|footer|nav|article)([^>]*)>([\s\S]*?)<\/\1>/gi;
  let match;
  while ((match = sectionPattern.exec(html)) !== null) {
    const tag = match[1];
    const attrs = match[2];
    const inner = match[3];
    const fullHtml = match[0];

    // Skip tiny sections (nav with just a logo, empty sections)
    if (fullHtml.length < 100) continue;
    // Skip script-only sections
    if (fullHtml.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<[^>]+>/g, '').trim().length < 20 && !fullHtml.includes('<video') && !fullHtml.includes('<img')) continue;

    const guessedType = guessType(tag, attrs, inner);
    const relevantCss = filterCssForHtml(allCss, fullHtml);
    const js = extractInlineJs(fullHtml);

    sections.push({
      html: fullHtml,
      css: relevantCss,
      js,
      guessedType,
    });
  }

  // If no semantic sections found, try top-level divs with semantic classes
  if (sections.length === 0) {
    for (const cls of SEMANTIC_CLASSES) {
      const divPattern = new RegExp(`<div[^>]*class="[^"]*\\b${cls}\\b[^"]*"[^>]*>[\\s\\S]*?<\\/div>`, 'gi');
      while ((match = divPattern.exec(html)) !== null) {
        if (match[0].length < 100) continue;
        const relevantCss = filterCssForHtml(allCss, match[0]);
        sections.push({
          html: match[0],
          css: relevantCss,
          js: extractInlineJs(match[0]),
          guessedType: cls,
        });
      }
    }
  }

  return sections;
}

// ─── Guess component type from HTML ─────────────────────────────────────────

function guessType(tag, attrs, inner) {
  const classAttr = (attrs.match(/class="([^"]*)"/i) || [])[1] || '';
  const classes = classAttr.toLowerCase();
  const text = inner.toLowerCase();

  if (tag === 'nav' || classes.includes('nav')) return 'nav';
  if (tag === 'header' && !classes.includes('hero')) return 'header';
  if (tag === 'footer') return 'footer';
  if (classes.includes('hero') || classes.includes('banner') || classes.includes('home-hero')) return 'hero';
  if (classes.includes('feature') || classes.includes('service')) return 'features';
  if (classes.includes('testimonial') || classes.includes('review')) return 'testimonials';
  if (classes.includes('pricing') || classes.includes('price')) return 'pricing';
  if (classes.includes('gallery') || classes.includes('portfolio') || classes.includes('project') || classes.includes('work') || classes.includes('case')) return 'gallery';
  if (classes.includes('team') || classes.includes('people')) return 'team';
  if (classes.includes('contact') || classes.includes('form')) return 'contact';
  if (classes.includes('faq')) return 'faq';
  if (classes.includes('cta') || classes.includes('call-to-action')) return 'cta';
  if (classes.includes('blog') || classes.includes('news') || classes.includes('article')) return 'blog';
  if (classes.includes('stats') || classes.includes('number') || classes.includes('counter')) return 'stats';
  if (classes.includes('video') || inner.includes('<video')) return 'video';
  if (inner.includes('<img') && (inner.match(/<img/g) || []).length > 3) return 'gallery';
  return 'section';
}

// ─── CSS extraction helpers ─────────────────────────────────────────────────

function extractAllCss(html) {
  const blocks = [];
  const stylePattern = /<style[^>]*>([\s\S]*?)<\/style>/gi;
  let m;
  while ((m = stylePattern.exec(html)) !== null) {
    blocks.push(m[1]);
  }
  return blocks.join('\n');
}

function filterCssForHtml(allCss, sectionHtml) {
  // Extract all class names from the section HTML
  const classNames = new Set();
  const classPattern = /class="([^"]*)"/gi;
  let m;
  while ((m = classPattern.exec(sectionHtml)) !== null) {
    m[1].split(/\s+/).forEach(c => { if (c) classNames.add(c); });
  }

  if (classNames.size === 0) return '';

  // Filter CSS rules that reference these classes
  const rules = [];
  // Split by } and reconstruct rules
  const parts = allCss.split('}');
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i].trim();
    if (!part) continue;
    const braceIdx = part.lastIndexOf('{');
    if (braceIdx === -1) continue;
    const selector = part.slice(0, braceIdx).trim();
    const body = part.slice(braceIdx + 1).trim();

    // Check if any class in this section is referenced
    let relevant = false;
    for (const cls of classNames) {
      if (selector.includes('.' + cls) || selector.includes('[class*="' + cls + '"]')) {
        relevant = true;
        break;
      }
    }
    // Also include @font-face, @keyframes, :root vars
    if (selector.startsWith('@font-face') || selector.startsWith('@keyframes') || selector.includes(':root')) {
      relevant = true;
    }
    if (relevant) {
      rules.push(selector + '{' + body + '}');
    }
  }

  return rules.join('\n');
}

function extractInlineJs(html) {
  const scripts = [];
  const scriptPattern = /<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = scriptPattern.exec(html)) !== null) {
    const content = m[1].trim();
    if (content && content.length > 10 && !content.includes('__NUXT__') && !content.includes('__NEXT_DATA__')) {
      scripts.push(content);
    }
  }
  return scripts.join('\n');
}

// ─── Visual metadata extraction ─────────────────────────────────────────────

function extractColors(css) {
  const colors = new Set();
  const hexPattern = /#[0-9a-fA-F]{3,8}\b/g;
  let m;
  while ((m = hexPattern.exec(css)) !== null) colors.add(m[0].toLowerCase());
  // Also rgb/rgba
  const rgbPattern = /rgba?\([^)]+\)/g;
  while ((m = rgbPattern.exec(css)) !== null) colors.add(m[0]);
  return [...colors].slice(0, 10); // top 10
}

function extractFonts(css) {
  const fonts = new Set();
  const fontPattern = /font-family\s*:\s*([^;{}]+)/gi;
  let m;
  while ((m = fontPattern.exec(css)) !== null) {
    const families = m[1].split(',').map(f => f.trim().replace(/["']/g, ''));
    families.forEach(f => { if (f && !['serif','sans-serif','monospace','inherit','initial'].includes(f.toLowerCase())) fonts.add(f); });
  }
  return [...fonts].slice(0, 5);
}

function extractAnimations(css, js) {
  const anims = new Set();
  if (css.includes('@keyframes')) anims.add('css-keyframes');
  if (css.includes('transition')) anims.add('css-transition');
  if (css.includes('transform')) anims.add('css-transform');
  if (css.includes('scroll-timeline') || css.includes('animation-timeline')) anims.add('scroll-driven');
  if (js && js.includes('gsap')) anims.add('gsap');
  if (js && js.includes('ScrollTrigger')) anims.add('scroll-trigger');
  if (js && js.includes('three') || js && js.includes('THREE')) anims.add('threejs');
  if (js && js.includes('lottie')) anims.add('lottie');
  if (css.includes('parallax') || (js && js.includes('parallax'))) anims.add('parallax');
  return [...anims];
}

// ─── Wrap component in standalone HTML ──────────────────────────────────────

function wrapComponent(html, css) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#000;color:#fff;font-family:system-ui,-apple-system,sans-serif}
${css}
</style>
</head>
<body>
${html}
</body>
</html>`;
}

// ─── Claude API classification ──────────────────────────────────────────────

async function classifyComponent(apiKey, html, guessedType) {
  const Anthropic = require('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey });

  // Truncate HTML to avoid huge tokens
  const truncatedHtml = html.length > 3000 ? html.slice(0, 3000) + '...' : html;

  const resp = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 500,
    messages: [{
      role: 'user',
      content: `Analyze this HTML component and classify it. Return ONLY valid JSON, no explanation.

HTML (may be truncated):
${truncatedHtml}

My initial guess for type: "${guessedType}"

Return JSON with these fields:
- type: one of [nav, header, hero, features, testimonials, pricing, gallery, team, contact, faq, cta, blog, stats, video, footer, section]
- subtype: more specific description (e.g. "video-background", "split-screen", "card-grid")
- description: one sentence describing the component in French
- tags: array of 3-7 descriptive tags from [dark, light, minimal, bold, animated, video, parallax, fullscreen, split, grid, cards, gradient, glassmorphism, 3d, interactive, responsive, typography-focused, image-heavy, cta-prominent]
- complexity: one of [simple, medium, advanced]`
    }],
  });

  const text = resp.content[0].text.trim();
  // Extract JSON from response (handle markdown code blocks)
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) return JSON.parse(jsonMatch[0]);
  return { type: guessedType, subtype: null, description: guessedType + ' section', tags: [], complexity: 'medium' };
}

module.exports = { analyzeSite };
```

- [ ] **Step 2: Verify analyzer loads without errors**

```bash
cd ~/Desktop/OUE/_core
node -e "const a = require('./analyzer'); console.log('Analyzer loaded, analyzeSite:', typeof a.analyzeSite);"
```

Expected: `Analyzer loaded, analyzeSite: function`

- [ ] **Step 3: Commit**

```bash
cd ~/Desktop/OUE/_core
git add analyzer.js
git commit -m "feat: add analyzer module with section detection, CSS extraction, Claude classification"
```

---

### Task 4: Test analyzer on a real cloned site

**Files:**
- No new files — integration test

- [ ] **Step 1: Run analyzer on on.energy (small site, good for testing)**

```bash
cd ~/Desktop/OUE/_core
node -e "
const { analyzeSite } = require('./analyzer');
(async () => {
  const results = await analyzeSite('/Users/salah/Desktop/on.energy', {
    emit(type, data) {
      if (type === 'status') console.log('STATUS:', data);
      if (type === 'progress') console.log('COMPONENT:', data.current);
      if (type === 'log') console.log('LOG:', data.message);
      if (type === 'done') console.log('DONE:', JSON.stringify(data));
    }
  });
  console.log('Total components:', results.length);
  const lib = require('./library');
  console.log('In DB:', lib.countComponents());
  console.log('Types:', lib.getTypes());
  lib.close();
})();
"
```

Expected: Several components extracted, printed to console. DB should have entries.

Note: This runs WITHOUT Claude API key — classification falls back to guessed types. That's fine for testing.

- [ ] **Step 2: Verify files were created**

```bash
ls ~/.oue/library/components/ | head -10
ls ~/.oue/library/components/$(ls ~/.oue/library/components/ | head -1)/
```

Expected: component directories with `component.html`, `component.css`, `meta.json`, `screenshot.png`.

- [ ] **Step 3: Commit**

No code changes — this was a test. Move on.

---

### Task 5: Wire analyzer and config into console.js CLI

**Files:**
- Modify: `~/Desktop/OUE/_core/console.js`

- [ ] **Step 1: Add CLI argument routing to console.js**

Add this block at the very end of `console.js`, replacing the bare `menu();` call:

```js
// ─── CLI argument routing ───────────────────────────────────────────────────

const args = process.argv.slice(2);

if (args[0] === 'clone' && args[1]) {
  // salah clone site.com
  const url = normalizeUrl(args[1]);
  if (!url) { console.log('URL invalide'); process.exit(1); }
  const folder = domainToFolder(url);
  const outDir = path.join(DESKTOP, folder);
  (async () => {
    const stats = await cloneSite({ url, outputDir: outDir, emit(t, d) {
      if (t === 'status') console.log(' ', d);
      if (t === 'page') console.log(`  Page ${d.number}: ${d.url}`);
      if (t === 'done') console.log(`  Done: ${d.pages} pages, ${d.files} files`);
    }});
    console.log(`\n  Clone: ~/Desktop/${folder}`);
    process.exit(0);
  })();
} else if (args[0] === 'analyze') {
  const { analyzeSite } = require('./analyzer');
  const target = args[1];
  (async () => {
    let clonePath;
    if (target === '--all') {
      // Analyze all cloned sites on Desktop
      const sites = getSavedSites();
      for (const s of sites) {
        console.log(`\n  Analyse de ${s.name}...`);
        await analyzeSite(s.path, { emit(t, d) {
          if (t === 'status') console.log('  ', d);
          if (t === 'progress') console.log(`    ${d.current}`);
          if (t === 'done') console.log(`  OK: ${d.components} composants`);
        }});
      }
    } else if (target) {
      // Find clone on Desktop
      clonePath = path.join(DESKTOP, target);
      if (!fs.existsSync(clonePath)) clonePath = path.join(DESKTOP, target.replace(/\./g, '_'));
      if (!fs.existsSync(clonePath)) { console.log(`  Clone non trouve: ${target}`); process.exit(1); }
      const results = await analyzeSite(clonePath, { emit(t, d) {
        if (t === 'status') console.log('  ', d);
        if (t === 'progress') console.log(`    ${d.current}`);
        if (t === 'done') console.log(`  OK: ${d.components} composants`);
      }});
    } else {
      console.log('  Usage: salah analyze site.com  ou  salah analyze --all');
    }
    process.exit(0);
  })();
} else if (args[0] === 'config') {
  const cfg = require('./config');
  if (args[1] === 'key') {
    if (args[2]) {
      cfg.setApiKey(args[2]);
      console.log('  Cle API sauvegardee.');
    } else {
      const key = cfg.getApiKey();
      console.log(key ? `  Cle: ${key.slice(0,10)}...` : '  Pas de cle. Usage: salah config key sk-ant-...');
    }
    process.exit(0);
  }
  console.log('  Usage: salah config key <your-anthropic-api-key>');
  process.exit(0);
} else if (args.length === 0) {
  // No args — show interactive menu
  menu();
} else {
  console.log(`  Commande inconnue: ${args[0]}`);
  console.log('  Commandes: clone, analyze, browse, create, config');
  process.exit(1);
}
```

- [ ] **Step 2: Remove the old bare `menu()` call at the bottom of console.js**

The last line of console.js is currently `menu();`. The new CLI routing block above replaces it. Delete the old `menu();` line.

- [ ] **Step 3: Test CLI routing**

```bash
# Test config command
cd ~/Desktop/OUE/_core && node console.js config key
# Expected: "Pas de cle. Usage: salah config key sk-ant-..."

# Test analyze without target
node console.js analyze
# Expected: "Usage: salah analyze site.com  ou  salah analyze --all"

# Test interactive menu still works
# (just verify it starts, then Ctrl+C)
node console.js
# Expected: Shows OUE menu
```

- [ ] **Step 4: Commit**

```bash
cd ~/Desktop/OUE/_core
git add console.js
git commit -m "feat: add CLI argument routing for analyze, config, clone commands"
```

---

### Task 6: Update zshrc alias to pass arguments

**Files:**
- Modify: `~/.zshrc`

- [ ] **Step 1: Verify current alias passes args**

```bash
grep 'alias salah' ~/.zshrc
```

Expected: `alias salah="node ~/Desktop/OUE/_core/console.js"`

This already passes args correctly because bash/zsh aliases append arguments. Verify:

```bash
source ~/.zshrc
salah config key
```

Expected: `Pas de cle. Usage: salah config key sk-ant-...`

- [ ] **Step 2: Test full pipeline**

```bash
# Set API key (if user has one)
# salah config key sk-ant-...

# Analyze a small clone
salah analyze on.energy
```

Expected: Components extracted and saved to `~/.oue/library/components/`.

- [ ] **Step 3: Verify library contents**

```bash
node -e "const lib=require('/Users/salah/Desktop/OUE/_core/library');console.log('Components:',lib.countComponents());console.log('Types:',lib.getTypes());console.log('Sources:',lib.getSources());lib.close();"
```

Expected: Shows component count, types, and sources.

No commit needed — this was a verification step.

---

## What's Next (Phase 2-4)

**Phase 2 — Browser** (`salah browse`): Local HTTP server serving an HTML grid of component screenshots with filtering by type/source/tags, star toggle, and live preview. Uses the existing `server.js` pattern.

**Phase 3 — Creator** (`salah create "prompt"`): Searches the library for relevant components, builds a context prompt with their HTML/CSS, calls Claude API to generate a full original site in HTML/CSS/JS, saves to Desktop.

**Phase 4 — Console update**: Add `browse` and `create` to the interactive menu. Auto-suggest `analyze` after cloning.
