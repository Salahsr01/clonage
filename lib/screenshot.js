/**
 * lib/screenshot.js — Reference screenshots for pixelmatch comparison.
 *
 * Takes full-page and per-section screenshots in PNG format so they
 * can be compared pixel-by-pixel with pixelmatch later.
 */

const path = require('path');
const { ensureDir, log, VIEWPORT } = require('./utils');

// Mobile viewport for responsive reference
const MOBILE_VIEWPORT = { width: 375, height: 812 };

/**
 * Capture reference screenshots (full-page + per-section clips).
 *
 * @param {import('playwright').Page} page — open Playwright page (still on live site)
 * @param {string} outDir — site output directory (e.g. sites/example_com)
 * @param {Array} components — analysis.sections array, each with .role and .rect
 */
async function captureScreenshots(page, outDir, components) {
  log('📸', 'Phase 3: Reference screenshots');

  // 1. Create output directories
  const refDir = path.join(outDir, 'reference');
  const sectionsDir = path.join(refDir, 'sections');
  ensureDir(refDir);
  ensureDir(sectionsDir);

  // 2. Scroll to top and wait for settle
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(1000);

  // 3. Full-page desktop screenshot (PNG for pixelmatch)
  const desktopPath = path.join(refDir, `full-${VIEWPORT.width}x${VIEWPORT.height}.png`);
  await page.screenshot({
    path: desktopPath,
    fullPage: true,
    type: 'png',
  });
  log('  📷', `Desktop full-page → reference/full-${VIEWPORT.width}x${VIEWPORT.height}.png`);

  // 4. Per-component clipped screenshots
  let captured = 0;
  let skipped = 0;

  for (const comp of components) {
    // Skip tiny sections
    if (!comp.rect || comp.rect.height < 10) {
      skipped++;
      continue;
    }

    try {
      // Clip coordinates: rect.top is already relative to page top (includes scrollY)
      const clipX = Math.max(0, comp.rect.left);
      const clipY = Math.max(0, comp.rect.top);
      const clipW = Math.min(comp.rect.width, VIEWPORT.width);
      const clipH = Math.min(comp.rect.height, 3000);

      // For clipped screenshots, we need fullPage: true so the clip
      // coordinates (which are page-absolute) are valid.
      const clipOptions = {
        type: 'png',
        fullPage: true,
        clip: { x: clipX, y: clipY, width: clipW, height: clipH },
      };

      // Save to components/{role}/screenshot.png
      const compScreenshot = path.join(outDir, 'components', comp.role, 'screenshot.png');
      ensureDir(path.dirname(compScreenshot));
      await page.screenshot({ ...clipOptions, path: compScreenshot });

      // Save to reference/sections/{role}.png
      const sectionScreenshot = path.join(sectionsDir, `${comp.role}.png`);
      await page.screenshot({ ...clipOptions, path: sectionScreenshot });

      captured++;
    } catch (err) {
      log('  ⚠️', `Failed to screenshot ${comp.role}: ${err.message}`);
      skipped++;
    }
  }

  // 5. Mobile screenshot
  await page.setViewportSize(MOBILE_VIEWPORT);
  await page.waitForTimeout(1000);

  const mobilePath = path.join(refDir, `full-${MOBILE_VIEWPORT.width}x${MOBILE_VIEWPORT.height}.png`);
  await page.screenshot({
    path: mobilePath,
    fullPage: true,
    type: 'png',
  });
  log('  📱', `Mobile full-page → reference/full-${MOBILE_VIEWPORT.width}x${MOBILE_VIEWPORT.height}.png`);

  // 6. Reset viewport back to desktop
  await page.setViewportSize(VIEWPORT);
  await page.waitForTimeout(500);

  // 7. Summary
  log('📸', `Screenshots done: ${captured} sections captured, ${skipped} skipped, 2 full-page (desktop + mobile)`);
}

module.exports = { captureScreenshots };
