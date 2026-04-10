#!/usr/bin/env node
/**
 * validate.js — Pixel-level comparison between reference screenshot and reproduced page.
 *
 * Usage:
 *   node validate.js <site-dir> <target>
 *
 *   site-dir   Path to captured site (e.g. sites/raviklaassens_com)
 *   target     URL (https://...) or local file path to the reproduced page
 *
 * Loads the reference PNG, screenshots the target at VIEWPORT size,
 * compares with pixelmatch, and outputs a JSON report + human-readable summary.
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const { PNG } = require('pngjs');
const pixelmatch = require('pixelmatch').default || require('pixelmatch');
const { VIEWPORT } = require('./lib/utils');

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const siteDir = process.argv[2];
const target = process.argv[3];

if (!siteDir || !target) {
  console.error('Usage: node validate.js <site-dir> <target>');
  console.error('');
  console.error('  site-dir   Path to captured site (e.g. sites/raviklaassens_com)');
  console.error('  target     URL or local file path to the reproduced page');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Zone definitions: 4 cols x 3 rows
// ---------------------------------------------------------------------------

const ROW_NAMES = ['top', 'mid', 'bot'];
const COL_NAMES = ['left', 'center-left', 'center-right', 'right'];

function buildZones(width, height) {
  const colW = Math.floor(width / 4);
  const rowH = Math.floor(height / 3);
  const zones = [];

  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 4; c++) {
      const x0 = c * colW;
      const y0 = r * rowH;
      const x1 = c === 3 ? width : (c + 1) * colW;
      const y1 = r === 2 ? height : (r + 1) * rowH;
      zones.push({
        region: `${ROW_NAMES[r]}-${COL_NAMES[c]}`,
        coords: [x0, y0, x1, y1],
        diffPixels: 0,
        totalPixels: (x1 - x0) * (y1 - y0),
      });
    }
  }
  return zones;
}

// ---------------------------------------------------------------------------
// Crop a full-page PNG to viewport dimensions
// ---------------------------------------------------------------------------

function cropToViewport(fullPng, width, height) {
  const cropped = new PNG({ width, height });
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const srcIdx = (y * fullPng.width + x) * 4;
      const dstIdx = (y * width + x) * 4;
      cropped.data[dstIdx] = fullPng.data[srcIdx];
      cropped.data[dstIdx + 1] = fullPng.data[srcIdx + 1];
      cropped.data[dstIdx + 2] = fullPng.data[srcIdx + 2];
      cropped.data[dstIdx + 3] = fullPng.data[srcIdx + 3];
    }
  }
  return cropped;
}

// ---------------------------------------------------------------------------
// Serve a local file over HTTP (for file targets)
// ---------------------------------------------------------------------------

function startLocalServer(filePath) {
  return new Promise((resolve, reject) => {
    const baseDir = path.dirname(filePath);
    const server = http.createServer((req, res) => {
      let reqPath = decodeURIComponent(req.url.split('?')[0]);
      if (reqPath === '/') reqPath = '/' + path.basename(filePath);
      const fsPath = path.join(baseDir, reqPath);

      if (!fs.existsSync(fsPath)) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }

      const ext = path.extname(fsPath).toLowerCase();
      const mimeMap = {
        '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript',
        '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.svg': 'image/svg+xml',
        '.webp': 'image/webp', '.avif': 'image/avif', '.ico': 'image/x-icon',
        '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf',
        '.otf': 'font/otf', '.mp4': 'video/mp4', '.webm': 'video/webm',
      };
      const contentType = mimeMap[ext] || 'application/octet-stream';

      res.writeHead(200, { 'Content-Type': contentType });
      fs.createReadStream(fsPath).pipe(res);
    });

    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      resolve({ server, url: `http://127.0.0.1:${port}/` });
    });

    server.on('error', reject);
  });
}

// ---------------------------------------------------------------------------
// Determine if target is a URL or file path
// ---------------------------------------------------------------------------

function isUrl(str) {
  return /^https?:\/\//i.test(str);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const { width, height } = VIEWPORT;
  const sitePath = path.resolve(siteDir);
  const refPath = path.join(sitePath, 'reference', `full-${width}x${height}.png`);

  // 1. Load reference PNG
  if (!fs.existsSync(refPath)) {
    console.error(`[validate] Reference not found: ${refPath}`);
    process.exit(1);
  }

  console.error(`[validate] Loading reference: ${refPath}`);
  const refFull = PNG.sync.read(fs.readFileSync(refPath));

  // Crop reference to viewport if it's taller (full-page screenshot)
  let ref;
  if (refFull.height > height || refFull.width > width) {
    console.error(`[validate] Reference is ${refFull.width}x${refFull.height}, cropping to ${width}x${height}`);
    ref = cropToViewport(refFull, width, height);
  } else {
    ref = refFull;
  }

  // 2. Take screenshot of target
  let targetUrl;
  let localServer = null;

  if (isUrl(target)) {
    targetUrl = target;
  } else {
    const absPath = path.resolve(target);
    if (!fs.existsSync(absPath)) {
      console.error(`[validate] Target file not found: ${absPath}`);
      process.exit(1);
    }
    console.error(`[validate] Starting local server for: ${absPath}`);
    const srv = await startLocalServer(absPath);
    localServer = srv.server;
    targetUrl = srv.url;
  }

  console.error(`[validate] Screenshotting: ${targetUrl}`);

  const { chromium } = require('playwright');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();

  try {
    await page.goto(targetUrl, { waitUntil: 'networkidle', timeout: 30000 });
  } catch (e) {
    console.error(`[validate] Warning: page load did not reach networkidle — ${e.message}`);
  }

  // Wait 3s for animations to settle
  await page.waitForTimeout(3000);

  const screenshotBuf = await page.screenshot({
    type: 'png',
    fullPage: false, // viewport only
  });

  await browser.close();
  if (localServer) localServer.close();

  // Parse the screenshot
  const targetPng = PNG.sync.read(screenshotBuf);

  // Ensure dimensions match
  if (targetPng.width !== width || targetPng.height !== height) {
    console.error(`[validate] ERROR: screenshot is ${targetPng.width}x${targetPng.height}, expected ${width}x${height}`);
    process.exit(1);
  }

  // 3. Compare with pixelmatch
  const diff = new PNG({ width, height });
  const diffPixelCount = pixelmatch(
    ref.data,
    targetPng.data,
    diff.data,
    width,
    height,
    { threshold: 0.1 }
  );

  const totalPixels = width * height;
  const score = ((1 - diffPixelCount / totalPixels) * 100);

  // 4. Zone analysis
  const zones = buildZones(width, height);

  // Walk diff image to count per-zone diff pixels
  // Diff image: red pixels (255,0,0) indicate differences
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const r = diff.data[idx];
      const g = diff.data[idx + 1];
      const b = diff.data[idx + 2];
      // pixelmatch paints diff pixels in diffColor (default [255,0,0]) and
      // anti-aliased in aaColor (default [255,255,0]).
      // Both represent differences, so count any non-matching pixel.
      // A pixel in the diff output that is NOT from the faded original is a diff pixel.
      // Simplest: check if it's the diffColor or aaColor.
      const isDiff = (r === 255 && g === 0 && b === 0) || (r === 255 && g === 255 && b === 0);
      if (isDiff) {
        for (const zone of zones) {
          const [x0, y0, x1, y1] = zone.coords;
          if (x >= x0 && x < x1 && y >= y0 && y < y1) {
            zone.diffPixels++;
            break;
          }
        }
      }
    }
  }

  // Calculate per-zone diff percentages and filter zones > 2%
  const zonesReport = zones
    .map(z => ({
      region: z.region,
      coords: z.coords,
      diffPercent: parseFloat(((z.diffPixels / z.totalPixels) * 100).toFixed(1)),
    }))
    .filter(z => z.diffPercent > 2)
    .sort((a, b) => b.diffPercent - a.diffPercent);

  // 5. Save diff heatmap
  const heatmapPath = path.join(sitePath, 'reference', 'diff-heatmap.png');
  fs.writeFileSync(heatmapPath, PNG.sync.write(diff));
  console.error(`[validate] Heatmap saved: ${heatmapPath}`);

  // 6. Output JSON to stdout
  const result = {
    score: parseFloat(score.toFixed(1)),
    totalPixels,
    diffPixels: diffPixelCount,
    zones: zonesReport,
    heatmapPath: path.relative(process.cwd(), heatmapPath),
  };

  console.log(JSON.stringify(result, null, 2));

  // 7. Human-readable summary on stderr
  console.error('');
  console.error('='.repeat(60));
  console.error(`  VALIDATION SCORE: ${result.score}% match`);
  console.error(`  Total pixels: ${totalPixels.toLocaleString()}`);
  console.error(`  Diff pixels:  ${diffPixelCount.toLocaleString()}`);
  console.error('='.repeat(60));

  if (zonesReport.length > 0) {
    console.error('');
    console.error('  Zones with >2% diff (worst first):');
    for (const z of zonesReport) {
      console.error(`    ${z.region.padEnd(20)} ${z.diffPercent}%`);
    }
  } else {
    console.error('  All zones within 2% tolerance.');
  }
  console.error('');

  // Exit with code 0 if score >= 80, 1 otherwise
  process.exit(result.score >= 80 ? 0 : 1);
}

main().catch(err => {
  console.error(`[validate] Fatal error: ${err.message}`);
  console.error(err.stack);
  process.exit(1);
});
