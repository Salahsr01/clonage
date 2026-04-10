#!/usr/bin/env node

/**
 * ═══════════════════════════════════════════════════════════════════
 *  OUE DNA EXTRACTOR — Analyse en profondeur d'un site cloné
 * ═══════════════════════════════════════════════════════════════════
 *
 *  Extracts the "design DNA" from a cloned site:
 *    - Color palette (from CSS + inline styles)
 *    - Typography stack (font families, sizes, weights, line-heights)
 *    - Animation curves (cubic-bezier, durations, easing names)
 *    - Spacing system (margins, paddings, gaps)
 *    - Border radius values
 *    - Component catalog (hero, gallery, footer, etc.)
 *    - Layout patterns (grid, flex, positioning)
 *    - Breakpoints
 *
 *  USAGE:  node extract-dna.js ./voku_clone
 *          node extract-dna.js ./voku_clone --json
 *          node extract-dna.js ./voku_clone -o dna-report.json
 *
 *  OUTPUT: JSON report + console summary
 * ═══════════════════════════════════════════════════════════════════
 */

const fs = require('fs');
const path = require('path');

// ─── CLI ────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const CLONE_DIR = args.find(a => !a.startsWith('-'));
const JSON_ONLY = args.includes('--json');
const OUTPUT_FILE = (() => {
  const idx = args.indexOf('-o');
  return idx >= 0 ? args[idx + 1] : null;
})();

if (!CLONE_DIR) {
  console.error('Usage: node extract-dna.js <clone-dir> [--json] [-o output.json]');
  process.exit(1);
}

const clonePath = path.resolve(CLONE_DIR);
if (!fs.existsSync(clonePath)) {
  console.error(`Directory not found: ${clonePath}`);
  process.exit(1);
}

// ─── File discovery ─────────────────────────────────────────────────────────

function findFiles(dir, extensions, maxDepth = 10) {
  const results = [];
  if (maxDepth <= 0) return results;

  try {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
      if (entry.name === '__ext__' || entry.name === '__external__') continue;

      if (entry.isDirectory()) {
        results.push(...findFiles(full, extensions, maxDepth - 1));
      } else if (extensions.some(ext => entry.name.endsWith(ext))) {
        results.push(full);
      }
    }
  } catch {}
  return results;
}

function readTextFile(filePath, maxSize = 2 * 1024 * 1024) {
  try {
    const stat = fs.statSync(filePath);
    if (stat.size > maxSize) return null;
    return fs.readFileSync(filePath, 'utf-8');
  } catch { return null; }
}

// ─── Extractors ─────────────────────────────────────────────────────────────

function extractColors(css, html) {
  const all = css + '\n' + html;
  const colors = new Map(); // color → count

  // Hex colors
  const hexRegex = /#([0-9a-fA-F]{3,8})\b/g;
  let m;
  while ((m = hexRegex.exec(all)) !== null) {
    const hex = normalizeHex(m[0]);
    if (hex) colors.set(hex, (colors.get(hex) || 0) + 1);
  }

  // rgb/rgba
  const rgbRegex = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([0-9.]+))?\s*\)/g;
  while ((m = rgbRegex.exec(all)) !== null) {
    const hex = rgbToHex(+m[1], +m[2], +m[3]);
    colors.set(hex, (colors.get(hex) || 0) + 1);
  }

  // hsl/hsla
  const hslRegex = /hsla?\(\s*([\d.]+)\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%/g;
  while ((m = hslRegex.exec(all)) !== null) {
    const hex = hslToHex(+m[1], +m[2], +m[3]);
    colors.set(hex, (colors.get(hex) || 0) + 1);
  }

  // Sort by frequency, filter boring ones
  const boring = new Set(['#000000', '#ffffff', '#fff', '#000', '#333333', '#666666', '#999999', '#cccccc']);
  const sorted = [...colors.entries()]
    .filter(([c]) => !boring.has(c.toLowerCase()))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 30);

  // Also return the full palette including boring for completeness
  const fullPalette = [...colors.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 50);

  return {
    primary: sorted.slice(0, 5).map(([c, n]) => ({ color: c, uses: n })),
    accent: sorted.slice(5, 15).map(([c, n]) => ({ color: c, uses: n })),
    full: fullPalette.map(([c, n]) => ({ color: c, uses: n })),
  };
}

function extractFonts(css, html) {
  const all = css + '\n' + html;
  const families = new Map();
  const sizes = new Map();
  const weights = new Map();
  const lineHeights = new Map();

  // Font families
  const familyRegex = /font-family\s*:\s*([^;}\n]+)/gi;
  let m;
  while ((m = familyRegex.exec(all)) !== null) {
    const raw = m[1].trim().replace(/['"]/g, '').split(',')[0].trim();
    if (raw && raw.length > 1 && !raw.startsWith('var(')) {
      families.set(raw, (families.get(raw) || 0) + 1);
    }
  }

  // Font sizes
  const sizeRegex = /font-size\s*:\s*([^;}\n]+)/gi;
  while ((m = sizeRegex.exec(all)) !== null) {
    const v = m[1].trim();
    sizes.set(v, (sizes.get(v) || 0) + 1);
  }

  // Font weights
  const weightRegex = /font-weight\s*:\s*([^;}\n]+)/gi;
  while ((m = weightRegex.exec(all)) !== null) {
    const v = m[1].trim();
    weights.set(v, (weights.get(v) || 0) + 1);
  }

  // Line heights
  const lhRegex = /line-height\s*:\s*([^;}\n]+)/gi;
  while ((m = lhRegex.exec(all)) !== null) {
    const v = m[1].trim();
    lineHeights.set(v, (lineHeights.get(v) || 0) + 1);
  }

  // Google Fonts from <link> tags
  const googleFonts = [];
  const gfRegex = /fonts\.googleapis\.com\/css2?\?family=([^"'&>\s]+)/g;
  while ((m = gfRegex.exec(html)) !== null) {
    const decoded = decodeURIComponent(m[1]).replace(/\+/g, ' ');
    googleFonts.push(...decoded.split('|').map(f => f.split(':')[0]));
  }

  return {
    families: mapToSorted(families, 10),
    sizes: mapToSorted(sizes, 15),
    weights: mapToSorted(weights, 10),
    lineHeights: mapToSorted(lineHeights, 10),
    googleFonts: [...new Set(googleFonts)],
  };
}

function extractAnimations(css, html) {
  const all = css + '\n' + html;
  const easings = new Map();
  const durations = new Map();
  const keyframes = [];

  // Cubic-bezier
  const bezierRegex = /cubic-bezier\(([^)]+)\)/g;
  let m;
  while ((m = bezierRegex.exec(all)) !== null) {
    const val = `cubic-bezier(${m[1]})`;
    easings.set(val, (easings.get(val) || 0) + 1);
  }

  // Named easings in transition/animation
  const namedEasingRegex = /(?:transition|animation)[^;]*?\b(ease-in-out|ease-in|ease-out|ease|linear)\b/gi;
  while ((m = namedEasingRegex.exec(all)) !== null) {
    easings.set(m[1].toLowerCase(), (easings.get(m[1].toLowerCase()) || 0) + 1);
  }

  // Durations
  const durationRegex = /(?:transition|animation)(?:-duration)?\s*:\s*[^;]*?(\d+(?:\.\d+)?m?s)\b/gi;
  while ((m = durationRegex.exec(all)) !== null) {
    durations.set(m[1], (durations.get(m[1]) || 0) + 1);
  }

  // Transition properties
  const transitionRegex = /transition\s*:\s*([^;}\n]+)/gi;
  const transitions = new Set();
  while ((m = transitionRegex.exec(all)) !== null) {
    transitions.add(m[1].trim());
  }

  // @keyframes names
  const kfRegex = /@keyframes\s+([\w-]+)/g;
  while ((m = kfRegex.exec(all)) !== null) {
    keyframes.push(m[1]);
  }

  return {
    easings: mapToSorted(easings, 10),
    durations: mapToSorted(durations, 10),
    transitions: [...transitions].slice(0, 15),
    keyframes: [...new Set(keyframes)],
  };
}

function extractSpacing(css) {
  const margins = new Map();
  const paddings = new Map();
  const gaps = new Map();

  let m;

  // Margins
  const marginRegex = /margin(?:-(?:top|right|bottom|left))?\s*:\s*([^;}\n]+)/gi;
  while ((m = marginRegex.exec(css)) !== null) {
    const v = m[1].trim();
    if (v !== '0' && v !== 'auto') margins.set(v, (margins.get(v) || 0) + 1);
  }

  // Paddings
  const paddingRegex = /padding(?:-(?:top|right|bottom|left))?\s*:\s*([^;}\n]+)/gi;
  while ((m = paddingRegex.exec(css)) !== null) {
    const v = m[1].trim();
    if (v !== '0') paddings.set(v, (paddings.get(v) || 0) + 1);
  }

  // Gap
  const gapRegex = /(?:gap|row-gap|column-gap)\s*:\s*([^;}\n]+)/gi;
  while ((m = gapRegex.exec(css)) !== null) {
    gaps.set(m[1].trim(), (gaps.get(m[1].trim()) || 0) + 1);
  }

  return {
    margins: mapToSorted(margins, 15),
    paddings: mapToSorted(paddings, 15),
    gaps: mapToSorted(gaps, 10),
  };
}

function extractBorderRadius(css) {
  const radii = new Map();
  const brRegex = /border-radius\s*:\s*([^;}\n]+)/gi;
  let m;
  while ((m = brRegex.exec(css)) !== null) {
    const v = m[1].trim();
    radii.set(v, (radii.get(v) || 0) + 1);
  }
  return mapToSorted(radii, 10);
}

function extractBreakpoints(css) {
  const bps = new Map();
  const bpRegex = /@media[^{]*\(\s*(?:min|max)-width\s*:\s*(\d+(?:\.\d+)?)(px|em|rem)/gi;
  let m;
  while ((m = bpRegex.exec(css)) !== null) {
    const val = m[1] + m[2];
    bps.set(val, (bps.get(val) || 0) + 1);
  }
  return mapToSorted(bps, 10);
}

function extractLayoutPatterns(css) {
  const displays = new Map();
  const positions = new Map();

  let m;
  const displayRegex = /display\s*:\s*(flex|grid|inline-flex|inline-grid|block|inline-block)\b/gi;
  while ((m = displayRegex.exec(css)) !== null) {
    displays.set(m[1].toLowerCase(), (displays.get(m[1].toLowerCase()) || 0) + 1);
  }

  const posRegex = /position\s*:\s*(fixed|sticky|absolute|relative)\b/gi;
  while ((m = posRegex.exec(css)) !== null) {
    positions.set(m[1].toLowerCase(), (positions.get(m[1].toLowerCase()) || 0) + 1);
  }

  // Grid patterns
  const gridCols = new Map();
  const gcRegex = /grid-template-columns\s*:\s*([^;}\n]+)/gi;
  while ((m = gcRegex.exec(css)) !== null) {
    gridCols.set(m[1].trim(), (gridCols.get(m[1].trim()) || 0) + 1);
  }

  return {
    display: mapToSorted(displays, 10),
    position: mapToSorted(positions, 10),
    gridTemplates: mapToSorted(gridCols, 10),
  };
}

function extractComponents(html) {
  const sections = [];

  // Find semantic sections
  const sectionRegex = /<(section|article|header|footer|nav|main|aside)\b([^>]*)>([\s\S]*?)(?:<\/\1>)/gi;
  let m;
  let idx = 0;
  while ((m = sectionRegex.exec(html)) !== null && idx < 30) {
    const tag = m[1].toLowerCase();
    const attrs = m[2];
    const content = m[3].substring(0, 3000); // first 3KB for analysis

    // Extract class and id
    const classMatch = attrs.match(/class="([^"]+)"/);
    const idMatch = attrs.match(/id="([^"]+)"/);
    const classes = classMatch ? classMatch[1] : '';
    const id = idMatch ? idMatch[1] : '';

    // Detect component type from classes, id, and content
    const type = detectComponentType(tag, classes, id, content);

    // Count child elements
    const h1Count = (content.match(/<h1\b/gi) || []).length;
    const h2Count = (content.match(/<h2\b/gi) || []).length;
    const imgCount = (content.match(/<img\b/gi) || []).length;
    const videoCount = (content.match(/<video\b/gi) || []).length;
    const linkCount = (content.match(/<a\b/gi) || []).length;
    const formCount = (content.match(/<form\b/gi) || []).length;

    sections.push({
      tag,
      type,
      id: id || null,
      classes: classes.split(/\s+/).filter(Boolean).slice(0, 5),
      children: {
        h1: h1Count, h2: h2Count, img: imgCount,
        video: videoCount, links: linkCount, forms: formCount,
      },
      estimatedHeight: estimateHeight(content),
    });
    idx++;
  }

  return sections;
}

function detectComponentType(tag, classes, id, content) {
  const combo = `${tag} ${classes} ${id} `.toLowerCase();
  const text = content.toLowerCase();

  if (tag === 'nav') return 'navigation';
  if (tag === 'footer') return 'footer';
  if (tag === 'header' || combo.includes('hero') || combo.includes('banner')
    || (text.includes('<h1') && text.includes('<video'))) return 'hero';
  if (combo.includes('gallery') || combo.includes('portfolio') || combo.includes('grid')
    || combo.includes('projets') || combo.includes('projects') || combo.includes('works')) return 'gallery';
  if (combo.includes('about') || combo.includes('story') || combo.includes('histoire')
    || combo.includes('manifesto') || combo.includes('philosophy')) return 'about';
  if (combo.includes('contact') || text.includes('<form')) return 'contact';
  if (combo.includes('service') || combo.includes('expertise') || combo.includes('approach')) return 'services';
  if (combo.includes('testimonial') || combo.includes('review') || combo.includes('quote')) return 'testimonials';
  if (combo.includes('team') || combo.includes('equipe')) return 'team';
  if (combo.includes('cta') || combo.includes('call-to-action')) return 'cta';
  if (combo.includes('carousel') || combo.includes('slider') || combo.includes('swiper')) return 'carousel';
  if (combo.includes('faq') || combo.includes('accordion')) return 'faq';
  if (combo.includes('marquee') || combo.includes('ticker')) return 'marquee';
  if (combo.includes('intro') || combo.includes('preloader') || combo.includes('loader')) return 'preloader';
  if (text.includes('©') || text.includes('copyright')) return 'footer';

  return 'section';
}

function estimateHeight(content) {
  const imgCount = (content.match(/<img\b/gi) || []).length;
  const textLength = content.replace(/<[^>]+>/g, '').trim().length;
  const videoCount = (content.match(/<video\b/gi) || []).length;
  // Rough estimate: base height + img contribution + text contribution
  return Math.round(200 + imgCount * 300 + textLength * 0.3 + videoCount * 400);
}

// ─── CSS Custom Properties (Design Tokens) ──────────────────────────────────

function extractCSSVariables(css) {
  const vars = new Map();
  const varRegex = /--([\w-]+)\s*:\s*([^;}\n]+)/g;
  let m;
  while ((m = varRegex.exec(css)) !== null) {
    const name = `--${m[1]}`;
    const value = m[2].trim();
    vars.set(name, value);
  }

  // Categorize
  const colors = {};
  const spacing = {};
  const fonts = {};
  const other = {};

  for (const [name, value] of vars) {
    if (/#|rgb|hsl|color|bg|background/i.test(name) || /#[0-9a-f]{3,8}/i.test(value) || /^rgb/i.test(value)) {
      colors[name] = value;
    } else if (/spacing|gap|margin|padding|size/i.test(name) || /^\d+(\.\d+)?(px|rem|em|vh|vw)$/.test(value)) {
      spacing[name] = value;
    } else if (/font|type|text/i.test(name)) {
      fonts[name] = value;
    } else {
      other[name] = value;
    }
  }

  return { colors, spacing, fonts, other, total: vars.size };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function normalizeHex(hex) {
  hex = hex.toLowerCase();
  if (/^#[0-9a-f]{3}$/.test(hex)) {
    return `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`;
  }
  if (/^#[0-9a-f]{6}$/.test(hex)) return hex;
  if (/^#[0-9a-f]{8}$/.test(hex)) return hex.slice(0, 7); // drop alpha
  return null;
}

function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(v => Math.min(255, Math.max(0, v)).toString(16).padStart(2, '0')).join('');
}

function hslToHex(h, s, l) {
  s /= 100; l /= 100;
  const k = n => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = n => Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1))));
  return rgbToHex(f(0), f(8), f(4));
}

function mapToSorted(map, limit) {
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([value, count]) => ({ value, count }));
}

// ─── Main ───────────────────────────────────────────────────────────────────

function main() {
  const siteName = path.basename(clonePath).replace(/_clone$/, '').replace(/_/g, '.');

  if (!JSON_ONLY) {
    console.log(`
╔══════════════════════════════════════════════════════════╗
║  OUE DNA EXTRACTOR                                       ║
╠══════════════════════════════════════════════════════════╣
║  Site : ${siteName.slice(0, 46).padEnd(46)} ║
║  Dir  : ${clonePath.slice(-46).padEnd(46)} ║
╚══════════════════════════════════════════════════════════╝
`);
  }

  // Gather all CSS and HTML
  const cssFiles = findFiles(clonePath, ['.css']);
  const htmlFiles = findFiles(clonePath, ['.html']);

  if (!JSON_ONLY) {
    console.log(`  Found ${cssFiles.length} CSS files, ${htmlFiles.length} HTML files`);
  }

  let allCss = '';
  for (const f of cssFiles) {
    const content = readTextFile(f);
    if (content) allCss += content + '\n';
  }

  let allHtml = '';
  // Read index.html first (most important), then others
  const indexFile = htmlFiles.find(f => f.endsWith('/index.html') && path.dirname(f) === clonePath);
  if (indexFile) {
    const content = readTextFile(indexFile);
    if (content) allHtml += content + '\n';
  }
  for (const f of htmlFiles.filter(f => f !== indexFile).slice(0, 20)) {
    const content = readTextFile(f);
    if (content) allHtml += content + '\n';
  }

  // Also extract inline CSS from HTML
  const inlineCssRegex = /<style\b[^>]*>([\s\S]*?)<\/style>/gi;
  let m;
  while ((m = inlineCssRegex.exec(allHtml)) !== null) {
    allCss += m[1] + '\n';
  }

  // Extract everything
  const dna = {
    site: siteName,
    extractedAt: new Date().toISOString(),
    stats: {
      cssFiles: cssFiles.length,
      htmlFiles: htmlFiles.length,
      totalCssSize: allCss.length,
      totalHtmlSize: allHtml.length,
    },
    cssVariables: extractCSSVariables(allCss),
    colors: extractColors(allCss, allHtml),
    typography: extractFonts(allCss, allHtml),
    animations: extractAnimations(allCss, allHtml),
    spacing: extractSpacing(allCss),
    borderRadius: extractBorderRadius(allCss),
    breakpoints: extractBreakpoints(allCss),
    layout: extractLayoutPatterns(allCss),
    components: extractComponents(allHtml),
  };

  // Output
  const jsonStr = JSON.stringify(dna, null, 2);

  if (OUTPUT_FILE) {
    fs.writeFileSync(path.resolve(OUTPUT_FILE), jsonStr, 'utf-8');
    if (!JSON_ONLY) console.log(`\n  ✓ Report saved to ${OUTPUT_FILE}`);
  }

  if (JSON_ONLY) {
    console.log(jsonStr);
    return;
  }

  // Pretty console report
  console.log('\n═══ DESIGN DNA REPORT ═══════════════════════════════\n');

  // Colors
  console.log('🎨 COLOR PALETTE');
  console.log('  Primary:');
  for (const c of dna.colors.primary) {
    console.log(`    ${c.color}  (${c.uses} uses)`);
  }
  console.log('  Accent:');
  for (const c of dna.colors.accent.slice(0, 5)) {
    console.log(`    ${c.color}  (${c.uses} uses)`);
  }

  // Typography
  console.log('\n📝 TYPOGRAPHY');
  console.log('  Families:');
  for (const f of dna.typography.families) {
    console.log(`    ${f.value}  (${f.count} uses)`);
  }
  if (dna.typography.googleFonts.length > 0) {
    console.log(`  Google Fonts: ${dna.typography.googleFonts.join(', ')}`);
  }
  console.log('  Sizes (top 5):');
  for (const s of dna.typography.sizes.slice(0, 5)) {
    console.log(`    ${s.value}  (${s.count} uses)`);
  }

  // Animations
  console.log('\n🎬 ANIMATIONS');
  console.log('  Easings:');
  for (const e of dna.animations.easings) {
    console.log(`    ${e.value}  (${e.count} uses)`);
  }
  console.log('  Durations:');
  for (const d of dna.animations.durations.slice(0, 5)) {
    console.log(`    ${d.value}  (${d.count} uses)`);
  }
  if (dna.animations.keyframes.length > 0) {
    console.log(`  Keyframes: ${dna.animations.keyframes.join(', ')}`);
  }

  // CSS Variables
  if (dna.cssVariables.total > 0) {
    console.log(`\n🔧 CSS VARIABLES (${dna.cssVariables.total} total)`);
    const colorVars = Object.entries(dna.cssVariables.colors).slice(0, 8);
    if (colorVars.length > 0) {
      console.log('  Colors:');
      for (const [k, v] of colorVars) console.log(`    ${k}: ${v}`);
    }
    const fontVars = Object.entries(dna.cssVariables.fonts).slice(0, 5);
    if (fontVars.length > 0) {
      console.log('  Fonts:');
      for (const [k, v] of fontVars) console.log(`    ${k}: ${v}`);
    }
  }

  // Components
  console.log('\n🧩 COMPONENT MAP');
  const typeCount = {};
  for (const c of dna.components) {
    typeCount[c.type] = (typeCount[c.type] || 0) + 1;
  }
  for (const [type, count] of Object.entries(typeCount).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${type.padEnd(15)} × ${count}`);
  }

  // Layout
  console.log('\n📐 LAYOUT');
  for (const d of dna.layout.display) {
    console.log(`    ${d.value.padEnd(15)} × ${d.count}`);
  }

  // Border radius
  if (dna.borderRadius.length > 0) {
    console.log('\n⭕ BORDER RADIUS');
    for (const r of dna.borderRadius.slice(0, 5)) {
      console.log(`    ${r.value}  (${r.count} uses)`);
    }
  }

  // Breakpoints
  if (dna.breakpoints.length > 0) {
    console.log('\n📱 BREAKPOINTS');
    for (const b of dna.breakpoints) {
      console.log(`    ${b.value}  (${b.count} uses)`);
    }
  }

  console.log('\n═════════════════════════════════════════════════════\n');

  // Auto-save JSON alongside clone
  const autoJsonPath = path.join(clonePath, '_dna.json');
  fs.writeFileSync(autoJsonPath, jsonStr, 'utf-8');
  console.log(`  ✓ DNA saved to ${autoJsonPath}`);
}

main();
