#!/usr/bin/env node
/**
 * assemble.js — Reproduce mode: combine captured components into a working page.
 *
 * Usage:
 *   node assemble.js <site-dir>
 *
 * Reads all components from <site-dir>/components/, plus tokens.json and
 * inline-styles.css, and assembles them into a single working HTML page at
 * output/<siteName>_reproduced/index.html with symlinks so assets resolve.
 */

const fs   = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const siteDir = process.argv[2];

if (!siteDir) {
  console.error('Usage: node assemble.js <site-dir>');
  console.error('');
  console.error('  site-dir   Path to captured site bundle (e.g. sites/raviklaassens_com)');
  process.exit(1);
}

const sitePath = path.resolve(siteDir);

if (!fs.existsSync(sitePath)) {
  console.error(`[assemble] Site directory not found: ${sitePath}`);
  process.exit(1);
}

const siteName = path.basename(sitePath);

// ---------------------------------------------------------------------------
// 1. Read tokens.json
// ---------------------------------------------------------------------------

const tokensPath = path.join(sitePath, 'tokens.json');
if (!fs.existsSync(tokensPath)) {
  console.error(`[assemble] tokens.json not found in ${sitePath}`);
  process.exit(1);
}

const tokens = JSON.parse(fs.readFileSync(tokensPath, 'utf-8'));
console.log(`[assemble] Loaded tokens.json (${Object.keys(tokens.customProperties || {}).length} custom properties, ${(tokens.fontFaces || []).length} font-faces)`);

// ---------------------------------------------------------------------------
// 2. Discover and sort components
// ---------------------------------------------------------------------------

const componentsDir = path.join(sitePath, 'components');
if (!fs.existsSync(componentsDir)) {
  console.error(`[assemble] components/ directory not found in ${sitePath}`);
  process.exit(1);
}

const componentDirs = fs.readdirSync(componentsDir, { withFileTypes: true })
  .filter(d => d.isDirectory())
  .map(d => d.name);

/**
 * Load component metadata and files.
 */
function loadComponent(dirName) {
  const dir = path.join(componentsDir, dirName);
  const comp = { name: dirName, dir };

  // Read meta.json
  const metaPath = path.join(dir, 'meta.json');
  if (fs.existsSync(metaPath)) {
    try {
      comp.meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
    } catch { comp.meta = {}; }
  } else {
    comp.meta = {};
  }

  // Read markup.html
  const markupPath = path.join(dir, 'markup.html');
  comp.markup = fs.existsSync(markupPath)
    ? fs.readFileSync(markupPath, 'utf-8')
    : '';

  // Read styles.css
  const stylesPath = path.join(dir, 'styles.css');
  comp.styles = fs.existsSync(stylesPath)
    ? fs.readFileSync(stylesPath, 'utf-8')
    : '';

  return comp;
}

const components = componentDirs.map(loadComponent);

/**
 * Sort components: nav/header first, footer last, everything else by rect.top
 * or alphabetical name.
 */
function sortComponents(comps) {
  const isNav    = c => /nav|header/i.test(c.name);
  const isFooter = c => /footer/i.test(c.name);

  const navs    = comps.filter(isNav);
  const footers = comps.filter(isFooter);
  const rest    = comps.filter(c => !isNav(c) && !isFooter(c));

  // Sort navs by rect.top (or name)
  const byPosition = (a, b) => {
    const aTop = a.meta?.rect?.top;
    const bTop = b.meta?.rect?.top;
    if (aTop != null && bTop != null) return aTop - bTop;
    return a.name.localeCompare(b.name);
  };

  navs.sort(byPosition);
  rest.sort(byPosition);
  footers.sort(byPosition);

  return [...navs, ...rest, ...footers];
}

const sorted = sortComponents(components);
console.log(`[assemble] Found ${sorted.length} components: ${sorted.map(c => c.name).join(', ')}`);

// ---------------------------------------------------------------------------
// 3. Build @font-face CSS from tokens
// ---------------------------------------------------------------------------

function buildFontFaces(fontFaces) {
  if (!fontFaces || fontFaces.length === 0) return '';

  return fontFaces.map(ff => {
    const family = ff.family || 'sans-serif';
    const src    = ff.src || '';
    const weight = ff.weight || '400';
    const style  = ff.style || 'normal';
    const display = ff.display || 'swap';

    return [
      '@font-face {',
      `  font-family: '${family}';`,
      `  src: ${src};`,
      `  font-weight: ${weight};`,
      `  font-style: ${style};`,
      `  font-display: ${display};`,
      '}'
    ].join('\n');
  }).join('\n\n');
}

// ---------------------------------------------------------------------------
// 4. Build :root custom properties
// ---------------------------------------------------------------------------

function buildCustomProperties(props) {
  if (!props || Object.keys(props).length === 0) return '';

  return Object.entries(props)
    .map(([key, value]) => `  ${key}: ${value};`)
    .join('\n');
}

// ---------------------------------------------------------------------------
// 5. Build body styles
// ---------------------------------------------------------------------------

function buildBodyStyles(body) {
  if (!body) return '';
  const lines = [];
  if (body.fontFamily)     lines.push(`  font-family: ${body.fontFamily};`);
  if (body.fontSize)       lines.push(`  font-size: ${body.fontSize};`);
  if (body.fontWeight)     lines.push(`  font-weight: ${body.fontWeight};`);
  if (body.lineHeight)     lines.push(`  line-height: ${body.lineHeight};`);
  if (body.color)          lines.push(`  color: ${body.color};`);
  if (body.backgroundColor) lines.push(`  background-color: ${body.backgroundColor};`);
  if (body.letterSpacing)  lines.push(`  letter-spacing: ${body.letterSpacing};`);
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// 6. Read inline-styles.css (optional)
// ---------------------------------------------------------------------------

const inlineStylesPath = path.join(sitePath, 'inline-styles.css');
const inlineStyles = fs.existsSync(inlineStylesPath)
  ? fs.readFileSync(inlineStylesPath, 'utf-8')
  : '';

// ---------------------------------------------------------------------------
// 7. Assemble the HTML document
// ---------------------------------------------------------------------------

function buildHTML() {
  const fontFacesCSS      = buildFontFaces(tokens.fontFaces);
  const customPropsCSS    = buildCustomProperties(tokens.customProperties);
  const bodyCSS           = buildBodyStyles(tokens.bodyStyles);

  // Per-component CSS
  const componentCSS = sorted.map(c => {
    if (!c.styles.trim()) return '';
    return `/* === ${c.name} === */\n${c.styles}`;
  }).filter(Boolean).join('\n\n');

  // Per-component markup
  const componentHTML = sorted.map(c => {
    if (!c.markup.trim()) return '';
    return `  <!-- ${c.name} -->\n${c.markup}`;
  }).filter(Boolean).join('\n\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Reproduced — ${siteName}</title>
  <style>
/* === @font-face declarations === */
${fontFacesCSS}

/* === Base reset === */
*, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
body {
${bodyCSS}
}
a { color: inherit; text-decoration: none; }
img, video, canvas, svg { display: block; max-width: 100%; }

/* === CSS custom properties === */
:root {
${customPropsCSS}
}

/* === Per-component scoped CSS === */

${componentCSS}

/* === Inline styles (hover/animation) === */
${inlineStyles}
  </style>
</head>
<body>
${componentHTML}
</body>
</html>
`;
}

const html = buildHTML();

// ---------------------------------------------------------------------------
// 8. Write output
// ---------------------------------------------------------------------------

const outputDir = path.join(process.cwd(), 'output', `${siteName}_reproduced`);
fs.mkdirSync(outputDir, { recursive: true });

const indexPath = path.join(outputDir, 'index.html');
fs.writeFileSync(indexPath, html, 'utf-8');
console.log(`[assemble] Wrote ${indexPath} (${html.length} bytes)`);

// ---------------------------------------------------------------------------
// 9. Create symlinks for assets
// ---------------------------------------------------------------------------

/**
 * Create a symlink (relative path) from outputDir/<name> -> sitePath/<name>.
 * Skips if target doesn't exist. Replaces if symlink already present.
 */
function symlinkDir(name) {
  const target  = path.join(sitePath, name);
  const link    = path.join(outputDir, name);

  if (!fs.existsSync(target)) return false;

  // Compute relative path from outputDir to sitePath
  const relTarget = path.relative(outputDir, target);

  // Remove existing symlink or file
  try {
    const stat = fs.lstatSync(link);
    if (stat.isSymbolicLink() || stat.isFile()) {
      fs.unlinkSync(link);
    } else if (stat.isDirectory()) {
      // Don't remove real directories
      console.warn(`[assemble] Warning: ${link} is a real directory, skipping symlink`);
      return false;
    }
  } catch { /* doesn't exist — fine */ }

  fs.symlinkSync(relTarget, link);
  console.log(`[assemble] Symlinked ${name} → ${relTarget}`);
  return true;
}

// Always try assets/
symlinkDir('assets');

// Also try common framework directories
const extraDirs = ['_next', '__ext__', 'static', 'media', 'fonts', 'images'];
for (const dir of extraDirs) {
  symlinkDir(dir);
}

// ---------------------------------------------------------------------------
// 10. Summary
// ---------------------------------------------------------------------------

const fileCount = sorted.length;
const totalSize = html.length;
const markupTotal = sorted.reduce((sum, c) => sum + c.markup.length, 0);
const stylesTotal = sorted.reduce((sum, c) => sum + c.styles.length, 0);

console.log('');
console.log(`[assemble] ✓ Done`);
console.log(`  Components: ${fileCount}`);
console.log(`  Markup:     ${(markupTotal / 1024).toFixed(1)} KB`);
console.log(`  Styles:     ${(stylesTotal / 1024).toFixed(1)} KB`);
console.log(`  Inline CSS: ${(inlineStyles.length / 1024).toFixed(1)} KB`);
console.log(`  Total HTML: ${(totalSize / 1024).toFixed(1)} KB`);
console.log(`  Output:     ${indexPath}`);
