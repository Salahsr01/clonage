/**
 * test-cdp-snapshot.js
 *
 * Compares two DOM extraction approaches:
 *   1. CDP DOMSnapshot.captureSnapshot (protocol-level, no JS execution)
 *   2. page.evaluate() with getComputedStyle (the current analyze.js approach)
 *
 * Usage: node test-cdp-snapshot.js
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// ─── Configuration ───────────────────────────────────────────────────────────

const TARGET_URL = 'https://elevenlabs.io/';
const VIEWPORT = { width: 1440, height: 900 };
const OUTPUT_FILE = path.join(__dirname, 'test-cdp-output.json');

const COMPUTED_STYLES = [
  'display',
  'position',
  'flex-direction',
  'grid-template-columns',
  'gap',
  'font-family',
  'font-size',
  'font-weight',
  'line-height',
  'letter-spacing',
  'color',
  'background-color',
  'border-radius',
  'padding',
  'margin',
  'width',
  'height',
  'max-width',
  'overflow',
  'opacity',
  'visibility',
  'transform',
  'z-index',
  'border',
  'box-shadow',
  'text-align',
  'justify-content',
  'align-items',
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function hrMs(start) {
  const [s, ns] = process.hrtime(start);
  return (s * 1000 + ns / 1e6).toFixed(0);
}

// ─── CDP Snapshot Approach ───────────────────────────────────────────────────

async function captureCDPSnapshot(page) {
  console.log('\n=== CDP DOMSnapshot.captureSnapshot ===');
  const t0 = process.hrtime();

  const cdp = await page.context().newCDPSession(page);

  const snapshot = await cdp.send('DOMSnapshot.captureSnapshot', {
    computedStyles: COMPUTED_STYLES,
    includeDOMRects: true,
    includePaintOrder: true,
  });

  const elapsed = hrMs(t0);
  const json = JSON.stringify(snapshot, null, 2);
  const sizeBytes = Buffer.byteLength(json, 'utf8');

  // Write raw output
  fs.writeFileSync(OUTPUT_FILE, json, 'utf8');

  // Count nodes across all documents
  let totalNodes = 0;
  for (const doc of snapshot.documents) {
    totalNodes += doc.nodes.nodeType.length;
  }

  console.log(`  Time:       ${elapsed} ms`);
  console.log(`  Documents:  ${snapshot.documents.length}`);
  console.log(`  Total nodes: ${totalNodes}`);
  console.log(`  Output size: ${formatBytes(sizeBytes)}`);
  console.log(`  Strings:    ${snapshot.strings.length}`);
  console.log(`  Saved to:   ${OUTPUT_FILE}`);

  // ─── Preview: first 3 visible elements with computed styles ──────────
  console.log('\n  --- Preview: first 3 visible elements with styles ---');

  const doc = snapshot.documents[0];
  const strings = snapshot.strings;
  const nodes = doc.nodes;
  const layout = doc.layout;

  // layout.styles is a parallel array to layout.nodeIndex/layout.bounds.
  // Each entry is a flat array of string indices — one value per requested
  // computed style property, in the same order as COMPUTED_STYLES.

  // Map layoutIndex -> decoded styles
  function decodeStyles(layoutIdx) {
    const raw = layout.styles[layoutIdx];
    const styles = {};
    if (!raw) return styles;
    for (let i = 0; i < raw.length && i < COMPUTED_STYLES.length; i++) {
      const value = strings[raw[i]];
      if (value && value !== '' && value !== 'none' && value !== 'normal' && value !== 'auto') {
        styles[COMPUTED_STYLES[i]] = value;
      }
    }
    return styles;
  }

  // Iterate layout entries (only laid-out nodes appear here)
  let printed = 0;
  for (let li = 0; li < layout.nodeIndex.length; li++) {
    if (printed >= 3) break;

    const bounds = layout.bounds[li]; // [x, y, width, height]
    if (bounds[2] <= 0 || bounds[3] <= 0) continue;

    const nodeIdx = layout.nodeIndex[li];

    // Only look at ELEMENT_NODEs (nodeType 1)
    if (nodes.nodeType[nodeIdx] !== 1) continue;

    const tagNameIdx = nodes.nodeName[nodeIdx];
    const tagName = strings[tagNameIdx];

    // Skip document/html/head — focus on visible content
    if (['#document', 'HTML', 'HEAD', 'META', 'LINK', 'SCRIPT', 'STYLE', 'TITLE'].includes(tagName)) {
      continue;
    }

    const styles = decodeStyles(li);

    // Get node attributes for context
    const attrs = {};
    if (nodes.attributes && nodes.attributes[nodeIdx]) {
      const attrPairs = nodes.attributes[nodeIdx];
      for (let a = 0; a < attrPairs.length; a += 2) {
        const key = strings[attrPairs[a]];
        let val = strings[attrPairs[a + 1]];
        if (val && val.length > 80) val = val.slice(0, 77) + '...';
        attrs[key] = val;
      }
    }

    printed++;
    console.log(`\n  [${printed}] <${tagName}>`);
    if (attrs.class) console.log(`      class: "${attrs.class}"`);
    if (attrs.id) console.log(`      id:    "${attrs.id}"`);
    console.log(`      bounds: x=${bounds[0].toFixed(0)}, y=${bounds[1].toFixed(0)}, w=${bounds[2].toFixed(0)}, h=${bounds[3].toFixed(0)}`);
    const styleKeys = Object.keys(styles);
    if (styleKeys.length > 0) {
      console.log(`      computed styles (${styleKeys.length}):`);
      for (const k of styleKeys.slice(0, 10)) {
        console.log(`        ${k}: ${styles[k]}`);
      }
      if (styleKeys.length > 10) console.log(`        ... and ${styleKeys.length - 10} more`);
    } else {
      console.log('      (no non-trivial computed styles)');
    }
  }

  await cdp.detach();

  return { totalNodes, sizeBytes, elapsed: Number(elapsed), snapshot };
}

// ─── page.evaluate Approach (mirrors analyze.js) ────────────────────────────

async function captureEvaluateSnapshot(page) {
  console.log('\n=== page.evaluate() + getComputedStyle (analyze.js approach) ===');
  const t0 = process.hrtime();

  const result = await page.evaluate((styleProps) => {
    const nodes = [];

    function walk(el, depth) {
      if (depth > 12) return;
      if (!(el instanceof Element)) return;

      const rect = el.getBoundingClientRect();
      const cs = getComputedStyle(el);

      // Skip invisible
      if (cs.display === 'none') return;
      if (rect.width === 0 && rect.height === 0) return;

      const styles = {};
      for (const prop of styleProps) {
        const val = cs.getPropertyValue(prop);
        if (val && val !== '' && val !== 'none' && val !== 'normal' && val !== 'auto') {
          styles[prop] = val;
        }
      }

      const tag = el.tagName.toLowerCase();
      const id = el.id || undefined;
      const cls = (el.className?.baseVal || el.className || '').toString().trim() || undefined;

      // Direct text content
      let text = '';
      for (const n of el.childNodes) {
        if (n.nodeType === 3) text += n.textContent;
      }
      text = text.trim().replace(/\s+/g, ' ');
      if (text.length > 200) text = text.slice(0, 197) + '...';

      nodes.push({
        tag,
        id,
        class: cls,
        text: text || undefined,
        bounds: {
          x: Math.round(rect.x),
          y: Math.round(rect.y),
          w: Math.round(rect.width),
          h: Math.round(rect.height),
        },
        styles,
      });

      for (const child of el.children) {
        walk(child, depth + 1);
      }
    }

    walk(document.documentElement, 0);
    return nodes;
  }, COMPUTED_STYLES);

  const elapsed = hrMs(t0);
  const json = JSON.stringify(result, null, 2);
  const sizeBytes = Buffer.byteLength(json, 'utf8');

  console.log(`  Time:       ${elapsed} ms`);
  console.log(`  Total nodes: ${result.length}`);
  console.log(`  Output size: ${formatBytes(sizeBytes)}`);

  // Preview first 3
  console.log('\n  --- Preview: first 3 visible elements ---');
  let shown = 0;
  for (const node of result) {
    if (shown >= 3) break;
    if (['html', 'head', 'meta', 'link', 'script', 'style', 'title'].includes(node.tag)) continue;
    shown++;
    console.log(`\n  [${shown}] <${node.tag}>`);
    if (node.class) console.log(`      class: "${node.class.length > 80 ? node.class.slice(0, 77) + '...' : node.class}"`);
    if (node.id) console.log(`      id:    "${node.id}"`);
    console.log(`      bounds: x=${node.bounds.x}, y=${node.bounds.y}, w=${node.bounds.w}, h=${node.bounds.h}`);
    const styleKeys = Object.keys(node.styles);
    if (styleKeys.length > 0) {
      console.log(`      computed styles (${styleKeys.length}):`);
      for (const k of styleKeys.slice(0, 10)) {
        console.log(`        ${k}: ${node.styles[k]}`);
      }
      if (styleKeys.length > 10) console.log(`        ... and ${styleKeys.length - 10} more`);
    }
  }

  return { totalNodes: result.length, sizeBytes, elapsed: Number(elapsed) };
}

// ─── Comparison ──────────────────────────────────────────────────────────────

function printComparison(cdpResult, evalResult) {
  console.log('\n========================================');
  console.log('           COMPARISON SUMMARY');
  console.log('========================================');

  const table = [
    ['Metric', 'CDP Snapshot', 'page.evaluate()', 'Ratio'],
    [
      'Nodes',
      cdpResult.totalNodes.toLocaleString(),
      evalResult.totalNodes.toLocaleString(),
      (cdpResult.totalNodes / evalResult.totalNodes).toFixed(2) + 'x',
    ],
    [
      'Output size',
      formatBytes(cdpResult.sizeBytes),
      formatBytes(evalResult.sizeBytes),
      (cdpResult.sizeBytes / evalResult.sizeBytes).toFixed(2) + 'x',
    ],
    [
      'Time',
      `${cdpResult.elapsed} ms`,
      `${evalResult.elapsed} ms`,
      (cdpResult.elapsed / evalResult.elapsed).toFixed(2) + 'x',
    ],
  ];

  // Simple table formatting
  const colWidths = table[0].map((_, ci) =>
    Math.max(...table.map(row => String(row[ci]).length))
  );

  for (let ri = 0; ri < table.length; ri++) {
    const row = table[ri].map((cell, ci) => String(cell).padEnd(colWidths[ci])).join('  |  ');
    console.log(`  ${row}`);
    if (ri === 0) {
      console.log('  ' + colWidths.map(w => '-'.repeat(w)).join('--+--'));
    }
  }

  console.log('\n  Key differences:');
  console.log('    - CDP captures ALL DOM nodes (text nodes, comments, iframes, shadow DOM)');
  console.log('    - page.evaluate() only captures visible Element nodes (filtered)');
  console.log('    - CDP returns indexed string table (deduped) + parallel arrays');
  console.log('    - page.evaluate() returns ready-to-use JS objects');
  console.log('    - CDP includes paint order for layering reconstruction');
  console.log('    - CDP runs outside V8 main thread; page.evaluate() blocks main thread');
  console.log('    - CDP does not trigger style recalc; getComputedStyle may force reflow');
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`Launching Playwright Chromium (${VIEWPORT.width}x${VIEWPORT.height})...`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: VIEWPORT });
  const page = await context.newPage();

  console.log(`Navigating to ${TARGET_URL}...`);
  await page.goto(TARGET_URL, { waitUntil: 'networkidle', timeout: 60000 });
  console.log('Page loaded (network idle).');

  // Give dynamic content a moment to settle
  await page.waitForTimeout(2000);

  let cdpResult, evalResult;

  try {
    cdpResult = await captureCDPSnapshot(page);
  } catch (err) {
    console.error('CDP snapshot failed:', err.message);
    cdpResult = null;
  }

  try {
    evalResult = await captureEvaluateSnapshot(page);
  } catch (err) {
    console.error('page.evaluate snapshot failed:', err.message);
    evalResult = null;
  }

  if (cdpResult && evalResult) {
    printComparison(cdpResult, evalResult);
  }

  await browser.close();
  console.log('\nDone.');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
