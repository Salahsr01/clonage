#!/usr/bin/env node

/**
 * Serveur local intelligent pour le clone de site.
 *
 * Gère automatiquement :
 * - Normalisation des chemins (: → _) pour correspondre au filesystem
 * - Résolution index.html dans les dossiers
 * - Détection MIME par magic bytes (pas par extension)
 * - Cache headers pour performance
 *
 * Usage : node serve-clone.js [port]
 *   Ex:  node serve-clone.js 3000
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = parseInt(process.argv[2]) || 3000;
const SITE_DIR = path.resolve(process.argv[3] || path.join(__dirname, 'site_clone'));

// ─── Magic bytes → MIME type ────────────────────────────────────────────────

const MAGIC_SIGNATURES = [
  { bytes: [0xFF, 0xD8, 0xFF],                         mime: 'image/jpeg',    ext: '.jpg' },
  { bytes: [0x89, 0x50, 0x4E, 0x47],                   mime: 'image/png',     ext: '.png' },
  { bytes: [0x47, 0x49, 0x46, 0x38],                   mime: 'image/gif',     ext: '.gif' },
  { bytes: [0x52, 0x49, 0x46, 0x46],                   mime: 'image/webp',    ext: '.webp',  extra: { offset: 8, bytes: [0x57, 0x45, 0x42, 0x50] } },
  { bytes: [0x00, 0x00, 0x00],                          mime: 'image/avif',    ext: '.avif',  validator: (buf) => buf.length > 11 && buf.toString('ascii', 4, 8) === 'ftyp' },
  { bytes: [0x00, 0x00, 0x01, 0x00],                   mime: 'image/x-icon',  ext: '.ico' },
  { bytes: [0x1A, 0x45, 0xDF, 0xA3],                   mime: 'video/webm',    ext: '.webm' },
  { bytes: [0x00, 0x00, 0x00],                          mime: 'video/mp4',     ext: '.mp4',   validator: (buf) => buf.length > 11 && buf.toString('ascii', 4, 8) === 'ftyp' && buf.toString('ascii', 8, 12) !== 'avif' },
  { bytes: [0x25, 0x50, 0x44, 0x46],                   mime: 'application/pdf', ext: '.pdf' },
  { bytes: [0x77, 0x4F, 0x46, 0x46],                   mime: 'font/woff',     ext: '.woff' },
  { bytes: [0x77, 0x4F, 0x46, 0x32],                   mime: 'font/woff2',    ext: '.woff2' },
  { bytes: [0x00, 0x01, 0x00, 0x00],                   mime: 'font/ttf',      ext: '.ttf' },
  { bytes: [0x4F, 0x54, 0x54, 0x4F],                   mime: 'font/otf',      ext: '.otf' },
  { bytes: [0x67, 0x6C, 0x54, 0x46],                   mime: 'model/gltf-binary', ext: '.glb' },
  { bytes: [0x00, 0x61, 0x73, 0x6D],                   mime: 'application/wasm', ext: '.wasm' },
  { bytes: [0x1F, 0x8B],                               mime: 'application/gzip', ext: '.gz' },
  { bytes: [0x50, 0x4B, 0x03, 0x04],                   mime: 'application/zip',  ext: '.zip' },
];

// ─── Extension → MIME (fallback) ────────────────────────────────────────────

const EXT_MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.mjs':  'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.xml':  'application/xml; charset=utf-8',
  '.svg':  'image/svg+xml; charset=utf-8',
  '.txt':  'text/plain; charset=utf-8',
  '.ico':  'image/x-icon',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png':  'image/png',
  '.gif':  'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.mp4':  'video/mp4',
  '.webm': 'video/webm',
  '.ogg':  'video/ogg',
  '.mp3':  'audio/mpeg',
  '.wav':  'audio/wav',
  '.woff': 'font/woff',
  '.woff2':'font/woff2',
  '.ttf':  'font/ttf',
  '.otf':  'font/otf',
  '.eot':  'application/vnd.ms-fontobject',
  '.gltf': 'model/gltf+json',
  '.glb':  'model/gltf-binary',
  '.wasm': 'application/wasm',
};

/**
 * Détecte le MIME type réel d'un fichier via ses magic bytes
 */
function detectMimeFromContent(filePath) {
  try {
    const fd = fs.openSync(filePath, 'r');
    const buf = Buffer.alloc(32);
    fs.readSync(fd, buf, 0, 32, 0);
    fs.closeSync(fd);

    for (const sig of MAGIC_SIGNATURES) {
      let match = true;

      // Vérifier les bytes principaux
      for (let i = 0; i < sig.bytes.length; i++) {
        if (buf[i] !== sig.bytes[i]) { match = false; break; }
      }

      if (!match) continue;

      // Vérifier les bytes supplémentaires si nécessaire
      if (sig.extra) {
        for (let i = 0; i < sig.extra.bytes.length; i++) {
          if (buf[sig.extra.offset + i] !== sig.extra.bytes[i]) { match = false; break; }
        }
      }

      // Validateur custom
      if (sig.validator && !sig.validator(buf)) continue;

      if (match) return sig.mime;
    }
  } catch { /* ignore */ }

  return null;
}

/**
 * Détermine le MIME type à utiliser pour un fichier
 */
function getMimeType(filePath) {
  // D'abord essayer la détection par contenu (prioritaire pour les images mal nommées)
  const detected = detectMimeFromContent(filePath);
  if (detected) return detected;

  // Fallback : extension
  const ext = path.extname(filePath).toLowerCase();
  return EXT_MIME[ext] || 'application/octet-stream';
}

/**
 * Normalise un chemin URL pour correspondre au filesystem :
 * - Remplace : par _
 * - Tente path/index.html si path est un dossier
 */
function resolveFilePath(urlPath) {
  // Décoder les %xx
  let decoded = decodeURIComponent(urlPath);

  // Supprimer les query params et fragments
  decoded = decoded.split('?')[0].split('#')[0];

  // Normaliser : → _ (comme le fait le script de clonage)
  const normalized = decoded.replace(/:/g, '_');

  // Construire le chemin absolu
  let fullPath = path.join(SITE_DIR, normalized);

  // Sécurité : empêcher la traversée de répertoire
  if (!fullPath.startsWith(SITE_DIR)) return null;

  // 1. Chemin exact → fichier
  if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
    return fullPath;
  }

  // 2. C'est un dossier → chercher index.html dedans
  if (fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory()) {
    const indexPath = path.join(fullPath, 'index.html');
    if (fs.existsSync(indexPath)) return indexPath;
  }

  // 3. Essayer avec .html ajouté
  if (fs.existsSync(fullPath + '.html')) return fullPath + '.html';

  // 4. Chercher un fichier avec extension ajoutée (ex: "l" → "l.woff2")
  //    Utile quand le cloner a sauvé avec extension mais l'URL n'en a pas (Typekit, CDNs)
  if (!path.extname(fullPath)) {
    try {
      const dir = path.dirname(fullPath);
      const base = path.basename(fullPath);
      if (fs.existsSync(dir) && fs.statSync(dir).isDirectory()) {
        const match = fs.readdirSync(dir).find(f => {
          const nameWithoutExt = f.substring(0, f.lastIndexOf('.'));
          return nameWithoutExt === base;
        });
        if (match) return path.join(dir, match);
      }
    } catch {}
  }

  // 5. Essayer sans la normalisation des : (au cas où)
  const altPath = path.join(SITE_DIR, decoded);
  if (fs.existsSync(altPath) && fs.statSync(altPath).isFile()) return altPath;
  if (fs.existsSync(altPath) && fs.statSync(altPath).isDirectory()) {
    const indexPath = path.join(altPath, 'index.html');
    if (fs.existsSync(indexPath)) return indexPath;
  }

  return null;
}

// ─── Serveur HTTP ───────────────────────────────────────────────────────────

const server = http.createServer((req, res) => {
  const urlPath = req.url || '/';

  // ─── Next.js /_next/image proxy (image optimizer) ───────────────────
  // Rewrites /_next/image?url=<external>&w=<width>&q=<quality> to serve
  // the original image from __ext__/ or proxy it from the remote CDN
  if (urlPath.startsWith('/_next/image')) {
    try {
      const params = new URL('http://x' + urlPath).searchParams;
      const imgUrl = params.get('url');
      if (imgUrl) {
        const parsed = new URL(imgUrl);
        // Try local __ext__ path first
        const extPath = path.join(SITE_DIR, '__ext__', parsed.hostname, decodeURIComponent(parsed.pathname));
        if (fs.existsSync(extPath) && fs.statSync(extPath).isFile()) {
          const content = fs.readFileSync(extPath);
          const mime = getMimeType(extPath);
          res.writeHead(200, { 'Content-Type': mime, 'Content-Length': content.length, 'Access-Control-Allow-Origin': '*' });
          res.end(content);
          return;
        }
        // Try direct CDN path in __ext__ with sanity image service format
        const sanityMatch = imgUrl.match(/cdn\.sanity\.io\/images\/([^/]+)\/([^/]+)\/([^?]+)/);
        if (sanityMatch) {
          const searchPath = path.join(SITE_DIR, '__ext__', 'cdn.sanity.io', 'images', sanityMatch[1], sanityMatch[2], sanityMatch[3].split('?')[0]);
          if (fs.existsSync(searchPath) && fs.statSync(searchPath).isFile()) {
            const content = fs.readFileSync(searchPath);
            const mime = getMimeType(searchPath);
            res.writeHead(200, { 'Content-Type': mime, 'Content-Length': content.length, 'Access-Control-Allow-Origin': '*' });
            res.end(content);
            return;
          }
        }
        // Fallback: proxy from remote (online mode) — buffer fully before responding
        const https = require('https');
        const http2 = require('http');
        function proxyFetch(targetUrl, depth) {
          if (depth > 5) { res.writeHead(502); res.end(); return; }
          const p = new URL(targetUrl);
          const proto = p.protocol === 'https:' ? https : http2;
          proto.get(targetUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (proxyRes) => {
            if (proxyRes.statusCode >= 300 && proxyRes.statusCode < 400 && proxyRes.headers.location) {
              proxyFetch(proxyRes.headers.location, depth + 1);
              return;
            }
            const chunks = [];
            proxyRes.on('data', c => chunks.push(c));
            proxyRes.on('end', () => {
              const body = Buffer.concat(chunks);
              const ct = proxyRes.headers['content-type'] || 'image/webp';
              res.writeHead(200, { 'Content-Type': ct, 'Content-Length': body.length, 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'public, max-age=86400' });
              res.end(body);
              // Also save to disk for future offline use
              try {
                const savePath = path.join(SITE_DIR, '__ext__', parsed.hostname, decodeURIComponent(parsed.pathname));
                if (!fs.existsSync(savePath)) {
                  fs.mkdirSync(path.dirname(savePath), { recursive: true });
                  fs.writeFileSync(savePath, body);
                }
              } catch {}
            });
          }).on('error', () => { res.writeHead(502); res.end('Proxy error'); });
        }
        proxyFetch(imgUrl, 0);
        return;
      }
    } catch {}
  }

  // Résoudre le chemin fichier
  const filePath = resolveFilePath(urlPath);

  if (!filePath) {
    res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`<h1>404</h1><p>Not found: ${urlPath}</p>`);
    return;
  }

  // Lire et servir le fichier
  try {
    const mime = getMimeType(filePath);
    const stat = fs.statSync(filePath);
    const fileSize = stat.size;

    // ─── Range requests (required for video playback) ─────────────────
    const range = req.headers.range;
    if (range && (mime.startsWith('video/') || mime.startsWith('audio/'))) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : Math.min(start + 1024 * 1024, fileSize - 1);
      const chunkSize = end - start + 1;

      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': mime,
        'Access-Control-Allow-Origin': '*',
      });
      const stream = fs.createReadStream(filePath, { start, end });
      stream.pipe(res);
      return;
    }

    // ─── Normal request ───────────────────────────────────────────────
    const content = fs.readFileSync(filePath);

    res.writeHead(200, {
      'Content-Type': mime,
      'Content-Length': content.length,
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'public, max-age=3600',
      'Access-Control-Allow-Origin': '*',
      'Cross-Origin-Embedder-Policy': 'credentialless',
      'Cross-Origin-Opener-Policy': 'same-origin',
    });
    res.end(content);
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end(`Erreur serveur: ${err.message}`);
  }
});

server.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════════════════════╗
║  Serveur clone local                                            ║
╠══════════════════════════════════════════════════════════════════╣
║                                                                  ║
║  URL :  http://localhost:${String(PORT).padEnd(5)}                              ║
║  Dir :  ${SITE_DIR.slice(0, 50).padEnd(50)} ║
║                                                                  ║
║  Pages principales :                                             ║
║    http://localhost:${PORT}/                                      ║
║    http://localhost:${PORT}/projects/                             ║
║    http://localhost:${PORT}/about/                                ║
║    http://localhost:${PORT}/collection/                           ║
║                                                                  ║
║  Ctrl+C pour arrêter                                             ║
╚══════════════════════════════════════════════════════════════════╝
`);
});
