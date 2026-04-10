#!/usr/bin/env node
/**
 * validate.js — Pixel-level comparison between original and reproduced sites.
 *
 * Usage:
 *   node validate.js <original-dir> <reproduced-dir>
 *
 * Uses pixelmatch to compare reference screenshots and produce a diff report.
 */

const path = require('path');

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const originalDir = process.argv[2];
const reproducedDir = process.argv[3];

if (!originalDir || !reproducedDir) {
  console.error('Usage: node validate.js <original-dir> <reproduced-dir>');
  console.error('');
  console.error('  original-dir    Path to captured site (e.g. sites/example_com)');
  console.error('  reproduced-dir  Path to LLM-reproduced site output');
  process.exit(1);
}

const origPath = path.resolve(originalDir);
const reproPath = path.resolve(reproducedDir);

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

console.log(`[validate] Original:   ${origPath}`);
console.log(`[validate] Reproduced: ${reproPath}`);
console.log('');
console.log('Not yet implemented — pixelmatch comparison coming in a future task.');
process.exit(0);
