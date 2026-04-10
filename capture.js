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
    // Phase 1: Intercept & save assets
    // ------------------------------------------------------------------
    log('📦', 'Phase 1: Asset capture');
    const { html, resourceMap } = await captureAssets(page, siteDir, targetUrl);

    // ------------------------------------------------------------------
    // Phase 2: Analyze page structure (DOM, computed styles, semantic tree)
    // ------------------------------------------------------------------
    const analysis = await analyzeDOM(page, siteDir);

    // ------------------------------------------------------------------
    // Phase 3: Take reference screenshots
    // TODO: Full-page + viewport + key sections
    // ------------------------------------------------------------------
    log('📸', 'Phase 3: Reference screenshots — TODO');

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
