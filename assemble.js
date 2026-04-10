#!/usr/bin/env node
/**
 * assemble.js — LLM assembly orchestrator.
 *
 * Usage:
 *   node assemble.js <site-dir> [--provider openai|anthropic]
 *
 * Takes a captured site bundle and orchestrates an LLM to reproduce it,
 * feeding structured analysis, assets, and screenshots as context.
 */

const path = require('path');

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const siteDir = process.argv[2];
const providerFlag = process.argv.indexOf('--provider');
const provider = providerFlag !== -1 ? process.argv[providerFlag + 1] : 'anthropic';

if (!siteDir) {
  console.error('Usage: node assemble.js <site-dir> [--provider openai|anthropic]');
  console.error('');
  console.error('  site-dir   Path to captured site bundle (e.g. sites/example_com)');
  console.error('  --provider LLM provider to use (default: anthropic)');
  process.exit(1);
}

const sitePath = path.resolve(siteDir);

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

console.log(`[assemble] Site bundle: ${sitePath}`);
console.log(`[assemble] Provider:    ${provider}`);
console.log('');
console.log('Not yet implemented — LLM assembly orchestration coming in a future task.');
process.exit(0);
