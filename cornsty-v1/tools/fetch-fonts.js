#!/usr/bin/env node
// Downloads the latin subsets of the brand fonts from Google Fonts into assets/fonts/*.woff2 (uses curl so it honours proxies).
// League Gothic = display / Inter = UI + body / IBM Plex Mono = labels + receipts / Yellowtail = jersey name script (only used in the customiser).
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const OUT = path.join(__dirname, '..', 'assets', 'fonts');
fs.mkdirSync(OUT, { recursive: true });
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const curl = (url, out) => execFileSync('curl', ['-sSf', '-m', '40', '-A', UA, ...(out ? ['-o', out] : []), url], { maxBuffer: 20 << 20 }).toString();
const FAMS = [
  { css: 'League+Gothic', file: 'league-gothic', weights: ['400'] },
  { css: 'Inter:wght@400..700', file: 'inter', weights: ['var'] },
  { css: 'IBM+Plex+Mono:wght@400;500', file: 'plex-mono', weights: ['400', '500'] },
  { css: 'Yellowtail', file: 'yellowtail', weights: ['400'] },
];
for (const f of FAMS) {
  const css = curl(`https://fonts.googleapis.com/css2?family=${f.css}&display=swap`);
  const blocks = css.split('/* ').slice(1).filter((b) => b.startsWith('latin '));
  blocks.forEach((b, i) => {
    const w = /font-weight:\s*([\d ]+);/.exec(b)?.[1].trim();
    const url = /url\((https:[^)]+)\)/.exec(b)?.[1];
    const name = `${f.file}${f.weights[0] === 'var' ? '' : '-' + w}.woff2`;
    curl(url, path.join(OUT, name));
    console.log(name, (fs.statSync(path.join(OUT, name)).size / 1024).toFixed(1) + ' KB', 'weight', w);
  });
}
