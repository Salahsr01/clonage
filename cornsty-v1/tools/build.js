#!/usr/bin/env node
/* Bundles the site into ONE self-contained file: dist/cornsty.html
   (all CSS + JS inlined, fonts embedded as base64, favicon generated from the brand icon).
   Usage: node tools/build.js            (no dependency) */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

const html = read('index.html');
const scripts = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map((m) => m[1]);
const styles = [...html.matchAll(/<link rel="stylesheet" href="([^"]+)">/g)].map((m) => m[1]);

// CSS: inline font files as data URIs
const css = styles.map((href) => {
  let c = read(href);
  c = c.replace(/url\(([^)]+\.woff2)\)/g, (m, u) => {
    const file = path.join(path.dirname(path.join(root, href)), u.replace(/['"]/g, ''));
    return `url(data:font/woff2;base64,${fs.readFileSync(file).toString('base64')})`;
  });
  return `/* ${href} */\n${c}`;
}).join('\n');

// JS: same order as index.html, each file wrapped so a syntax slip in one cannot hide the others' errors
const js = scripts.map((src) => `/* ${src} */\n${read(src)}`).join('\n;\n');

// favicon = the icon (quatrefoil + seagull head) built from the real vectors
global.window = {};
require(path.join(root, 'src/js/art-data.js'));
const icon = window.Cornsty.art.icon;
const ROLE = { ink: '#26232b', cream: '#F8F2E0', hat: '#788CE3', beak: '#FF8A1E', quat: '#DE3F39' };
const fav = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-190 -6 380 420">${icon.parts.map((p) => `<path d="${p.d}" fill="${ROLE[p.role] || '#26232b'}"/>`).join('')}</svg>`;
const favicon = 'data:image/svg+xml;base64,' + Buffer.from(fav).toString('base64');

const head = html.slice(html.indexOf('<head>') + 6, html.indexOf('</head>')).replace(/<link rel="stylesheet"[^>]*>\s*/g, '');
const body = html.slice(html.indexOf('<body>') + 6, html.indexOf('<!-- build:scripts -->'));
const out = `<!doctype html>
<html lang="fr">
<head>${head}<link rel="icon" href="${favicon}">
<style>${css}</style>
</head>
<body>${body}<script>${js}</script>
</body>
</html>
`;
fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
fs.writeFileSync(path.join(root, 'dist', 'cornsty.html'), out);
console.log('dist/cornsty.html', (out.length / 1024).toFixed(0) + ' KB', '| scripts:', scripts.length, '| styles:', styles.length);
