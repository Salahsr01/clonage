#!/usr/bin/env node

/**
 * ═══════════════════════════════════════════════════════════════════
 *  OUE RECOMPOSE — Components + New Content → Working Site
 * ═══════════════════════════════════════════════════════════════════
 *
 *  Takes decomposed components + a content file and produces a new
 *  site with the same design, animations, and assets but different text.
 *
 *  USAGE:
 *    node recompose.js <components-dir> <content.json> [-o output-dir]
 *    node recompose.js ./sequel_co_components ./content_agency.json
 *
 *  The content.json maps section IDs to new slot values:
 *  {
 *    "meta": { "title": "...", "description": "..." },
 *    "global": {
 *      "brand": "Manifest",
 *      "email": "hello@manifest.studio",
 *      "navLinks": { "Founders": "Work", "Membership": "Services", ... }
 *    },
 *    "sections": {
 *      "pageHeader": { "slots": { "Build the future": "Start a project" } },
 *      "section1":   { "slots": { "legacy,": "vision,", "made.": "crafted." } },
 *      ...
 *    }
 *  }
 * ═══════════════════════════════════════════════════════════════════
 */

const fs = require('fs');
const path = require('path');

// ─── CLI ─────────────────────────────────────────────────────────

const COMP_DIR = process.argv[2];
const CONTENT_FILE = process.argv[3];
const OUT_DIR_FLAG = process.argv.indexOf('-o');
const OUT_DIR = OUT_DIR_FLAG >= 0 ? process.argv[OUT_DIR_FLAG + 1] : null;

if (!COMP_DIR || !CONTENT_FILE) {
  console.error('Usage: node recompose.js <components-dir> <content.json> [-o output-dir]');
  process.exit(1);
}

const compDir = path.resolve(COMP_DIR);
const contentPath = path.resolve(CONTENT_FILE);

if (!fs.existsSync(compDir)) { console.error(`Components dir not found: ${compDir}`); process.exit(1); }
if (!fs.existsSync(contentPath)) { console.error(`Content file not found: ${contentPath}`); process.exit(1); }

const manifest = JSON.parse(fs.readFileSync(path.join(compDir, '_manifest.json'), 'utf-8'));
const content = JSON.parse(fs.readFileSync(contentPath, 'utf-8'));
const clonePath = manifest.clonePath;

if (!fs.existsSync(clonePath)) {
  console.error(`Original clone not found: ${clonePath}`);
  process.exit(1);
}

const outDir = OUT_DIR
  ? path.resolve(OUT_DIR)
  : path.join(path.dirname(compDir), `_output/${content.meta?.siteName || 'recomposed'}`);

console.log('╔══════════════════════════════════════════════════════════╗');
console.log('║  OUE RECOMPOSE — Components + Content → Site            ║');
console.log('╠══════════════════════════════════════════════════════════╣');
console.log(`║  Components: ${compDir.substring(compDir.length - 42).padEnd(42)} ║`);
console.log(`║  Content   : ${contentPath.substring(contentPath.length - 42).padEnd(42)} ║`);
console.log(`║  Clone     : ${clonePath.substring(clonePath.length - 42).padEnd(42)} ║`);
console.log(`║  Output    : ${outDir.substring(outDir.length - 42).padEnd(42)} ║`);
console.log('╚══════════════════════════════════════════════════════════╝\n');

// ─── Step 1: Copy the clone as base ─────────────────────────────

console.log('  1. Copying clone as base...');
if (fs.existsSync(outDir)) {
  fs.rmSync(outDir, { recursive: true });
}
fs.cpSync(clonePath, outDir, { recursive: true });
console.log('     ✓ Clone copied');

// ─── Step 2: Read the original index.html ───────────────────────

console.log('  2. Reading index.html...');
const indexPath = path.join(outDir, 'index.html');
let html = fs.readFileSync(indexPath, 'utf-8');
const originalSize = html.length;

// ─── Step 3: Apply global replacements ──────────────────────────

console.log('  3. Applying global replacements...');
let globalCount = 0;

const global = content.global || {};

// Brand name in meta/structured data
if (global.brand) {
  const brandReplacements = [
    [/"name":"Sequel"/g, `"name":"${global.brand}"`],
    [/"alternateName":"Sequel Technologies"/g, `"alternateName":"${global.brand} Studio"`],
    [/content="Sequel"/g, `content="${global.brand}"`],
  ];
  brandReplacements.forEach(([re, rep]) => {
    html = html.replace(re, rep);
    globalCount++;
  });
}

// URL replacements
if (global.url) {
  html = html.replace(/https:\/\/www\.sequel\.co/g, global.url);
  globalCount++;
}

// Email
if (global.email) {
  html = html.replace(/members@sequel\.co/g, global.email);
  globalCount++;
}

// Social links
if (global.socials) {
  Object.entries(global.socials).forEach(([pattern, replacement]) => {
    html = html.replace(new RegExp(escapeRegex(pattern), 'g'), replacement);
    globalCount++;
  });
}

// Navigation link text — applied everywhere (header, mobile menu, footer)
if (global.navLinks) {
  Object.entries(global.navLinks).forEach(([oldText, newText]) => {
    // Match within <a> tags — text surrounded by whitespace
    const regex = new RegExp(`(>\\s*)${escapeRegex(oldText)}(\\s*<)`, 'g');
    html = html.replace(regex, `$1${newText}$2`);
    globalCount++;
  });
}

// Meta description
if (content.meta?.description) {
  // Replace all instances of the original description
  const origDesc = manifest.meta?.description;
  if (origDesc) {
    html = replaceFlexible(html, origDesc, content.meta.description);
    globalCount++;
  }
}

// Title
if (content.meta?.title) {
  html = html.replace(/<title>[^<]*<\/title>/, `<title>${content.meta.title}</title>`);
  html = html.replace(/content="Your legacy, made\."/g, `content="${content.meta.title}"`);
  globalCount++;
}

console.log(`     ✓ ${globalCount} global replacements`);

// ─── Step 4: Apply per-section slot replacements ────────────────

console.log('  4. Applying section-level slot replacements...');
let slotCount = 0;

const sections = content.sections || {};

Object.entries(sections).forEach(([sectionId, sectionContent]) => {
  const slots = sectionContent.slots || {};

  Object.entries(slots).forEach(([oldText, newText]) => {
    if (oldText === newText) return;

    // Strategy depends on the type of replacement:
    // 1. Simple text swap (most common) — find and replace in HTML
    // 2. Letter-by-letter animated text — need to rebuild the letter divs

    if (sectionContent.letterAnimation && sectionContent.letterAnimation[oldText]) {
      // This is a letter-by-letter animated word — rebuild the div structure
      const oldLetterBlock = buildLetterBlock(oldText);
      const newLetterBlock = buildLetterBlock(newText);
      if (html.includes(oldLetterBlock)) {
        html = html.replace(oldLetterBlock, newLetterBlock);
        slotCount++;
      } else {
        // Try flexible match
        const replaced = replaceFlexible(html, oldText, newText);
        if (replaced !== html) { html = replaced; slotCount++; }
      }
    } else {
      // Simple text replacement — but be smart about it
      const replaced = replaceFlexible(html, oldText, newText);
      if (replaced !== html) {
        html = replaced;
        slotCount++;
      }
    }
  });
});

console.log(`     ✓ ${slotCount} slot replacements`);

// ─── Step 4a2: Footer/hero tagline with italic span ──────────────

if (content.tagline) {
  console.log('  4a2. Replacing tagline...');
  const old = content.tagline.old;
  const nw = content.tagline.new;
  if (old && nw) {
    // Replace "Your <span italic>legacy,</span> made." pattern
    const oldParts = old.match(/^(.*?)\*(.+?)\*(.*)$/); // "Your *legacy,* made."
    const newParts = nw.match(/^(.*?)\*(.+?)\*(.*)$/);  // "Your *vision,* crafted."
    if (oldParts && newParts) {
      const oldHtml = `${oldParts[1]}<span class="italic" style="font-family: 'Bradford';">${oldParts[2]}</span>${oldParts[3]}`;
      const newHtml = `${newParts[1]}<span class="italic" style="font-family: 'Bradford';">${newParts[2]}</span>${newParts[3]}`;
      html = html.split(oldHtml).join(newHtml);
      console.log(`     ✓ "${old}" → "${nw}"`);
    }
    // Also replace plain text version in meta tags etc.
    const oldPlain = old.replace(/\*/g, '');
    const newPlain = nw.replace(/\*/g, '');
    html = html.split(oldPlain).join(newPlain);
  }
}

// ─── Step 4b: Apply data-target replacements for stat counters ──

if (content.dataTargets) {
  console.log('  4b. Updating stat data-targets...');
  let dtCount = 0;
  Object.entries(content.dataTargets).forEach(([oldVal, newVal]) => {
    const re = new RegExp(`data-target="${escapeRegex(oldVal)}"`, 'g');
    html = html.replace(re, `data-target="${newVal}"`);
    dtCount++;
  });
  console.log(`     ✓ ${dtCount} data-targets updated`);
}

// ─── Step 4c: Rebuild hero letter-by-letter animation blocks ────

if (content.letterBlocks) {
  console.log('  4c. Rebuilding letter animation blocks...');
  let lbCount = 0;
  content.letterBlocks.forEach(({ old: oldWord, new: newWord }) => {
    const oldBlock = buildLetterBlock(oldWord);
    const newBlock = buildLetterBlock(newWord);
    if (html.includes(oldBlock)) {
      html = html.replace(oldBlock, newBlock);
      lbCount++;
      console.log(`     ✓ "${oldWord}" → "${newWord}"`);
    } else {
      console.log(`     ⚠ Letter block "${oldWord}" not found in HTML`);
    }
  });
  console.log(`     ✓ ${lbCount} letter blocks rebuilt`);
}

// ─── Step 5: Replace the logo SVG if provided ───────────────────

if (content.logo) {
  console.log('  5. Replacing logo...');
  const logoSvgRegex = /<svg class="w-auto h-6 sm:h-8"[\s\S]*?<\/svg>/g;
  const logoReplacement = content.logo.html || buildTextLogo(global.brand || 'Brand');
  const count = (html.match(logoSvgRegex) || []).length;
  html = html.replace(logoSvgRegex, logoReplacement);
  console.log(`     ✓ Replaced ${count} logo instances`);
} else {
  console.log('  5. No logo replacement specified (keeping original SVG)');
}

// ─── Step 6: City name replacements (footer) ────────────────────

if (content.cities) {
  console.log('  6. Replacing city names...');
  content.cities.forEach(city => {
    if (city.old && city.new) {
      html = html.replace(new RegExp(`>${escapeRegex(city.old)}<`, 'g'), `>${city.new}<`);
    }
    if (city.oldCountry && city.newCountry) {
      // Replace first occurrence of oldCountry after the new city name
      const cityIdx = html.indexOf(`>${city.new}<`);
      if (cityIdx > 0) {
        const afterCity = html.indexOf(city.oldCountry, cityIdx);
        if (afterCity > 0 && afterCity < cityIdx + 500) {
          html = html.substring(0, afterCity) + city.newCountry + html.substring(afterCity + city.oldCountry.length);
        }
      }
    }
  });
  console.log(`     ✓ ${content.cities.length} cities updated`);
}

// ─── Step 7: Save ────────────────────────────────────────────────

console.log('  7. Saving...');
fs.writeFileSync(indexPath, html, 'utf-8');

const newSize = html.length;
const diff = newSize - originalSize;

console.log(`\n╔══════════════════════════════════════════════════════════╗`);
console.log(`║  RECOMPOSE COMPLETE                                     ║`);
console.log(`╠══════════════════════════════════════════════════════════╣`);
console.log(`║  Global replacements : ${globalCount.toString().padEnd(33)} ║`);
console.log(`║  Slot replacements   : ${slotCount.toString().padEnd(33)} ║`);
console.log(`║  Size change         : ${(diff > 0 ? '+' : '') + diff + ' bytes'.padEnd(28)} ║`);
console.log(`║  Output              : ${outDir.substring(outDir.length - 33).padEnd(33)} ║`);
console.log(`╚══════════════════════════════════════════════════════════╝`);
console.log(`\n  Serve: node serve-clone.js 8888 ${path.basename(outDir)}`);

// ─── Helpers ─────────────────────────────────────────────────────

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function replaceFlexible(html, oldText, newText) {
  // Try exact match first
  if (html.includes(oldText)) {
    return html.split(oldText).join(newText);
  }

  // Try with HTML entity variants (&amp; &#39; etc.)
  const entityVariants = [
    [/&/g, '&amp;'],
    [/'/g, '&#39;'],
    [/'/g, '&apos;'],
  ];
  for (const [char, entity] of entityVariants) {
    const variant = oldText.replace(char, entity);
    if (variant !== oldText && html.includes(variant)) {
      return html.split(variant).join(newText);
    }
  }

  // Try with flexible whitespace (minified HTML often has newlines/spaces)
  const words = oldText.split(/\s+/).filter(w => w.length > 0);
  if (words.length > 1) {
    const flexRegex = new RegExp(
      words.map(escapeRegex).join('[\\s\\n\\r]+'),
      'g'
    );
    const result = html.replace(flexRegex, newText);
    if (result !== html) return result;
  }

  return html;
}

function buildLetterBlock(text) {
  const chars = text.split('').map(ch =>
    `<div aria-hidden="true" style="position: relative; display: inline-block; filter: blur(0px); opacity: 1;">${ch}</div>`
  ).join('');
  return `<div aria-hidden="true" style="position: relative; display: inline-block;">${chars}</div>`;
}

function buildTextLogo(brandName) {
  return `<span style="font-family: VisueltPro, system-ui, sans-serif; font-size: 22px; font-weight: 500; letter-spacing: -0.5px; color: white; display: inline-flex; align-items: center; gap: 8px;">${brandName}<svg width="28" height="22" viewBox="0 0 28 22" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="0" y="0" width="2" height="22" fill="white"/><rect x="4" y="2" width="2.5" height="18" fill="white"/><rect x="9" y="1" width="3" height="20" fill="white"/><rect x="14" y="3" width="3.5" height="16" fill="white"/><rect x="20" y="0" width="4" height="22" fill="white"/><rect x="25" y="4" width="3" height="14" fill="white"/></svg></span>`;
}
