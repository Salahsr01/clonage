/**
 * lib/utils.js — Shared constants and helpers for the OUE capture pipeline
 */

const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Common MIME types for web asset interception */
const MIME_TYPES = {
  '.html': 'text/html',
  '.css':  'text/css',
  '.js':   'application/javascript',
  '.mjs':  'application/javascript',
  '.json': 'application/json',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif':  'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico':  'image/x-icon',
  '.woff': 'font/woff',
  '.woff2':'font/woff2',
  '.ttf':  'font/ttf',
  '.otf':  'font/otf',
  '.eot':  'application/vnd.ms-fontobject',
  '.mp4':  'video/mp4',
  '.webm': 'video/webm',
  '.mp3':  'audio/mpeg',
  '.wav':  'audio/wav',
  '.pdf':  'application/pdf',
};

/** Domains to block during capture (analytics, tracking, ads) */
const BLOCKED_DOMAINS = new Set([
  'www.google-analytics.com',
  'google-analytics.com',
  'www.googletagmanager.com',
  'googletagmanager.com',
  'analytics.google.com',
  'stats.g.doubleclick.net',
  'www.googleadservices.com',
  'googleads.g.doubleclick.net',
  'connect.facebook.net',
  'www.facebook.com',
  'pixel.facebook.com',
  'snap.licdn.com',
  'px.ads.linkedin.com',
  'bat.bing.com',
  'tr.snapchat.com',
  'static.hotjar.com',
  'script.hotjar.com',
  'cdn.segment.com',
  'api.segment.io',
  'cdn.amplitude.com',
  'api.amplitude.com',
  'cdn.mxpnl.com',
  'api-js.mixpanel.com',
  'sentry.io',
  'browser.sentry-cdn.com',
  'js.intercomcdn.com',
  'widget.intercom.io',
  'js.hs-scripts.com',
  'js.hs-analytics.net',
  'track.hubspot.com',
]);

/** Default viewport for capture (common desktop) */
const VIEWPORT = { width: 1440, height: 900 };

/** Full-HD viewport for reference screenshots */
const VIEWPORT_FULL = { width: 1920, height: 1080 };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Ensure a directory exists (recursive mkdir).
 * @param {string} dirPath
 */
function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

/**
 * Turn a URL into a filesystem-safe slug (hostname-based).
 * e.g. "https://www.example.com/page" → "example_com"
 * @param {string} url
 * @returns {string}
 */
function slugify(url) {
  try {
    const { hostname } = new URL(url);
    return hostname
      .replace(/^www\./, '')
      .replace(/[^a-z0-9]+/gi, '_')
      .replace(/_+$/, '')
      .toLowerCase();
  } catch {
    // Fallback: just clean the string
    return url.replace(/[^a-z0-9]+/gi, '_').toLowerCase();
  }
}

/**
 * Formatted log output.
 * @param {string} icon  — emoji or short prefix
 * @param {string} msg
 */
function log(icon, msg) {
  const ts = new Date().toISOString().slice(11, 19);
  console.log(`[${ts}] ${icon}  ${msg}`);
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  MIME_TYPES,
  BLOCKED_DOMAINS,
  VIEWPORT,
  VIEWPORT_FULL,
  ensureDir,
  slugify,
  log,
};
