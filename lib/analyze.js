/**
 * lib/analyze.js — DOM analysis on the live, hydrated page.
 *
 * Exports `analyzeDOM(page, outDir)` which runs a single large
 * page.evaluate() while Playwright is still on the live site.
 * It detects page sections, extracts scoped CSS, semantic trees,
 * design tokens, and inline style blocks.
 *
 * All heavy lifting happens browser-side; Node.js just writes files.
 */

const fs = require('fs');
const path = require('path');
const { ensureDir, log } = require('./utils');

// ─── Constants ────────────────────────────────────────────────────────────

const MAX_DEPTH = 8;
const MAX_SVG_BYTES = 5120; // 5 KB

// ─── analyzeDOM ───────────────────────────────────────────────────────────

/**
 * Run full DOM analysis on the live page.
 *
 * @param {import('playwright').Page} page — open Playwright page on the live site
 * @param {string} outDir — site output directory (e.g. sites/example_com)
 * @returns {object} analysis results (also written to disk)
 */
async function analyzeDOM(page, outDir) {
  log('🔍', 'Phase 2: DOM analysis — running browser-side extraction...');

  // ═══════════════════════════════════════════════════════════════════════
  // ONE big page.evaluate — all analysis happens browser-side
  // ═══════════════════════════════════════════════════════════════════════

  const analysis = await page.evaluate(({ MAX_DEPTH, MAX_SVG_BYTES }) => {

    // ─── Helpers ────────────────────────────────────────────────────────

    /**
     * Build a CSS selector for an element within a section.
     */
    function buildSelector(el, sectionClass) {
      if (el.id) return `#${CSS.escape(el.id)}`;

      const tag = el.tagName.toLowerCase();

      // Get classes, filter out framework noise
      const rawClass = (el.className?.baseVal || el.className || '').toString();
      const classes = rawClass
        .split(/\s+/)
        .filter(c =>
          c.length > 1 &&
          c.length < 30 &&
          !c.startsWith('w-') &&
          !c.startsWith('tw-') &&
          !c.startsWith('css-') &&
          !c.startsWith('__') &&
          !/^[a-z]{1,3}\d{4,}/.test(c) // hash classes like a1b2c3d4
        )
        .slice(0, 2);

      if (classes.length) {
        return `.${sectionClass} ${tag}.${classes.map(c => CSS.escape(c)).join('.')}`;
      }

      // Fallback: positional selector
      const parent = el.parentElement;
      if (parent) {
        const idx = Array.from(parent.children).indexOf(el) + 1;
        return `.${sectionClass} > ${tag}:nth-child(${idx})`;
      }

      return tag;
    }

    /**
     * Detect the layout type of an element from computed styles.
     */
    function detectLayout(cs) {
      const display = cs.display;
      const position = cs.position;

      if (position === 'absolute' || position === 'fixed') {
        return { type: 'absolute' };
      }
      if (display.includes('grid')) {
        const result = { type: 'grid' };
        const cols = cs.gridTemplateColumns;
        const rows = cs.gridTemplateRows;
        if (cols && cols !== 'none') result.columns = cols;
        if (rows && rows !== 'none') result.rows = rows;
        const gap = cs.gap;
        if (gap && gap !== 'normal' && gap !== '0px') result.gap = gap;
        return result;
      }
      if (display.includes('flex')) {
        const dir = cs.flexDirection;
        const type = dir === 'column' || dir === 'column-reverse' ? 'flex-col' : 'flex-row';
        const result = { type };
        const gap = cs.gap;
        if (gap && gap !== 'normal' && gap !== '0px') result.gap = gap;
        const wrap = cs.flexWrap;
        if (wrap && wrap !== 'nowrap') result.wrap = wrap;
        const justify = cs.justifyContent;
        if (justify && justify !== 'normal' && justify !== 'flex-start') result.justify = justify;
        const align = cs.alignItems;
        if (align && align !== 'normal' && align !== 'stretch') result.align = align;
        return result;
      }
      return { type: 'flow' };
    }

    /**
     * Determine the semantic role of an element.
     */
    function detectRole(el) {
      const tag = el.tagName.toLowerCase();
      const role = el.getAttribute('role');

      // Explicit ARIA role
      if (role === 'banner') return 'header';
      if (role === 'navigation') return 'nav';
      if (role === 'main') return 'main';
      if (role === 'contentinfo') return 'footer';
      if (role === 'button') return 'button';
      if (role === 'img') return 'image';
      if (role === 'link') return 'link';

      // Tag-based roles
      if (tag === 'header' || tag === 'nav') return 'nav';
      if (tag === 'footer') return 'footer';
      if (/^h[1-6]$/.test(tag)) return 'heading';
      if (tag === 'p') return 'text';
      if (tag === 'a') return 'link';
      if (tag === 'button' || tag === 'input' && el.type === 'submit') return 'button';
      if (tag === 'img' || tag === 'picture') return 'image';
      if (tag === 'video') return 'video';
      if (tag === 'svg') return 'icon';
      if (tag === 'canvas') return 'canvas';
      if (tag === 'form') return 'form';
      if (tag === 'ul' || tag === 'ol') return 'list';
      if (tag === 'li') return 'list-item';
      if (tag === 'figure') return 'figure';
      if (tag === 'figcaption') return 'caption';
      if (tag === 'blockquote') return 'quote';
      if (tag === 'iframe') return 'embed';

      // Containers with recognisable classes/content
      const cls = (el.className?.baseVal || el.className || '').toString().toLowerCase();
      const id = (el.id || '').toLowerCase();
      const combined = cls + ' ' + id;

      if (combined.includes('hero')) return 'hero-group';
      if (combined.includes('cta')) return 'cta-group';
      if (combined.includes('card')) return 'card';
      if (combined.includes('testimonial')) return 'testimonial';
      if (combined.includes('pricing')) return 'pricing';
      if (combined.includes('feature')) return 'feature-group';
      if (combined.includes('logo')) return 'logo';

      // Check content to determine role
      const headings = el.querySelectorAll(':scope > h1, :scope > h2, :scope > h3');
      if (headings.length > 0) return 'heading-group';

      const links = el.querySelectorAll(':scope > a');
      if (links.length >= 2) return 'link-group';

      return 'container';
    }

    /**
     * Get a truncated text content (direct text nodes only).
     */
    function getDirectText(el) {
      let text = '';
      for (const node of el.childNodes) {
        if (node.nodeType === 3) { // TEXT_NODE
          text += node.textContent;
        }
      }
      text = text.trim().replace(/\s+/g, ' ');
      return text.length > 200 ? text.slice(0, 197) + '...' : text;
    }

    /**
     * Check if an element has meaningful visual presence.
     */
    function isVisible(el) {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) return false;
      const cs = getComputedStyle(el);
      if (cs.display === 'none') return false;
      if (cs.visibility === 'hidden' && cs.position === 'absolute') return false;
      if (cs.opacity === '0' && cs.position === 'absolute') return false;
      return true;
    }

    /**
     * Extract scoped CSS for an element relative to its parent.
     */
    function extractElementCSS(el, parentCs) {
      const cs = getComputedStyle(el);
      const styles = {};

      // Display (skip block/inline defaults)
      const display = cs.display;
      if (display !== 'block' && display !== 'inline' && display !== '') {
        styles.display = display;
      }

      // Position (skip static)
      const position = cs.position;
      if (position !== 'static' && position !== '') {
        styles.position = position;
        // Include offsets for positioned elements
        if (position !== 'relative' || cs.top !== 'auto' || cs.left !== 'auto') {
          ['top', 'right', 'bottom', 'left'].forEach(prop => {
            const val = cs[prop];
            if (val && val !== 'auto' && val !== '0px') styles[prop] = val;
          });
        }
      }

      // Width / Height (skip auto)
      if (cs.width && cs.width !== 'auto' && cs.width !== '0px' && !cs.width.endsWith('px')) {
        styles.width = cs.width;  // only percentage / vw / etc
      }
      if (cs.height && cs.height !== 'auto' && cs.height !== '0px' && !cs.height.endsWith('px')) {
        styles.height = cs.height;
      }

      // Max-width (common for containers)
      if (cs.maxWidth && cs.maxWidth !== 'none') {
        styles['max-width'] = cs.maxWidth;
      }

      // Flex / Grid properties (only if parent is flex/grid)
      if (display.includes('flex') || display.includes('grid')) {
        const gap = cs.gap;
        if (gap && gap !== 'normal' && gap !== '0px') styles.gap = gap;

        if (display.includes('flex')) {
          const dir = cs.flexDirection;
          if (dir && dir !== 'row') styles['flex-direction'] = dir;
          const wrap = cs.flexWrap;
          if (wrap && wrap !== 'nowrap') styles['flex-wrap'] = wrap;
          const justify = cs.justifyContent;
          if (justify && justify !== 'normal' && justify !== 'flex-start') styles['justify-content'] = justify;
          const align = cs.alignItems;
          if (align && align !== 'normal' && align !== 'stretch') styles['align-items'] = align;
        }

        if (display.includes('grid')) {
          const cols = cs.gridTemplateColumns;
          if (cols && cols !== 'none') styles['grid-template-columns'] = cols;
          const rows = cs.gridTemplateRows;
          if (rows && rows !== 'none') styles['grid-template-rows'] = rows;
        }
      }

      // Flex-child properties (if parent is flex)
      if (parentCs && (parentCs.display.includes('flex'))) {
        const grow = cs.flexGrow;
        if (grow && grow !== '0') styles['flex-grow'] = grow;
        const shrink = cs.flexShrink;
        if (shrink && shrink !== '1') styles['flex-shrink'] = shrink;
        const basis = cs.flexBasis;
        if (basis && basis !== 'auto' && basis !== '0px') styles['flex-basis'] = basis;
        const alignSelf = cs.alignSelf;
        if (alignSelf && alignSelf !== 'auto') styles['align-self'] = alignSelf;
      }

      // Grid-child properties (if parent is grid)
      if (parentCs && parentCs.display.includes('grid')) {
        const col = cs.gridColumn;
        if (col && col !== 'auto' && col !== 'auto / auto') styles['grid-column'] = col;
        const row = cs.gridRow;
        if (row && row !== 'auto' && row !== 'auto / auto') styles['grid-row'] = row;
      }

      // Padding (only if non-zero and different from parent)
      ['padding-top', 'padding-right', 'padding-bottom', 'padding-left'].forEach(prop => {
        const val = cs.getPropertyValue(prop);
        if (val && val !== '0px') {
          const parentVal = parentCs ? parentCs.getPropertyValue(prop) : null;
          if (!parentVal || val !== parentVal) styles[prop] = val;
        }
      });

      // Margin (only if non-zero and different from parent)
      ['margin-top', 'margin-right', 'margin-bottom', 'margin-left'].forEach(prop => {
        const val = cs.getPropertyValue(prop);
        if (val && val !== '0px') {
          const parentVal = parentCs ? parentCs.getPropertyValue(prop) : null;
          if (!parentVal || val !== parentVal) styles[prop] = val;
        }
      });

      // Font properties (only on elements with text content, and different from parent)
      const hasText = el.childNodes.length > 0 &&
        Array.from(el.childNodes).some(n => n.nodeType === 3 && n.textContent.trim());
      const isTextTag = /^(h[1-6]|p|span|a|li|label|td|th|dt|dd|figcaption|blockquote|cite|em|strong|small|mark|code|pre)$/.test(el.tagName.toLowerCase());

      if (hasText || isTextTag) {
        const fontProps = [
          'font-family', 'font-size', 'font-weight', 'font-style',
          'line-height', 'letter-spacing', 'text-transform', 'text-decoration',
          'text-align', 'white-space', 'word-break'
        ];
        fontProps.forEach(prop => {
          const val = cs.getPropertyValue(prop);
          if (!val) return;
          const parentVal = parentCs ? parentCs.getPropertyValue(prop) : null;
          if (parentVal && val === parentVal) return; // inherited, skip
          // Skip common defaults
          if (prop === 'font-style' && val === 'normal') return;
          if (prop === 'text-decoration' && (val === 'none' || val.startsWith('none'))) return;
          if (prop === 'text-transform' && val === 'none') return;
          if (prop === 'text-align' && val === 'start') return;
          if (prop === 'white-space' && val === 'normal') return;
          if (prop === 'word-break' && val === 'normal') return;
          if (prop === 'letter-spacing' && val === 'normal') return;
          styles[prop] = val;
        });
      }

      // Color (only if different from parent)
      const color = cs.color;
      if (color) {
        const parentColor = parentCs ? parentCs.color : null;
        if (!parentColor || color !== parentColor) styles.color = color;
      }

      // Background (only if not transparent / none)
      const bg = cs.backgroundColor;
      if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') {
        styles['background-color'] = bg;
      }
      const bgImage = cs.backgroundImage;
      if (bgImage && bgImage !== 'none') {
        styles['background-image'] = bgImage;
        // Include related properties
        const bgSize = cs.backgroundSize;
        if (bgSize && bgSize !== 'auto') styles['background-size'] = bgSize;
        const bgPos = cs.backgroundPosition;
        if (bgPos && bgPos !== '0% 0%') styles['background-position'] = bgPos;
        const bgRepeat = cs.backgroundRepeat;
        if (bgRepeat && bgRepeat !== 'repeat') styles['background-repeat'] = bgRepeat;
      }

      // Border radius
      const br = cs.borderRadius;
      if (br && br !== '0px') styles['border-radius'] = br;

      // Border (only if visible)
      const borderStyle = cs.borderStyle;
      if (borderStyle && borderStyle !== 'none' && borderStyle !== 'none none none none') {
        const borderWidth = cs.borderWidth;
        if (borderWidth && borderWidth !== '0px') {
          styles['border'] = `${borderWidth} ${cs.borderStyle} ${cs.borderColor}`;
        }
      }

      // Box shadow
      const shadow = cs.boxShadow;
      if (shadow && shadow !== 'none') styles['box-shadow'] = shadow;

      // Overflow
      const overflow = cs.overflow;
      if (overflow && overflow !== 'visible') styles.overflow = overflow;

      // Opacity
      const opacity = cs.opacity;
      if (opacity && opacity !== '1') styles.opacity = opacity;

      // Z-index
      const zIndex = cs.zIndex;
      if (zIndex && zIndex !== 'auto') styles['z-index'] = zIndex;

      // Transform
      const transform = cs.transform;
      if (transform && transform !== 'none') styles.transform = transform;

      // Transition
      const transition = cs.transition;
      if (transition && transition !== 'all 0s ease 0s' && transition !== 'none 0s ease 0s' && transition !== 'none') {
        styles.transition = transition;
      }

      // Object-fit (for images/videos)
      if (el.tagName.toLowerCase() === 'img' || el.tagName.toLowerCase() === 'video') {
        const fit = cs.objectFit;
        if (fit && fit !== 'fill') styles['object-fit'] = fit;
        const objPos = cs.objectPosition;
        if (objPos && objPos !== '50% 50%') styles['object-position'] = objPos;
      }

      return styles;
    }

    /**
     * Build the semantic tree for a section, recursively.
     */
    function buildSemanticTree(el, depth) {
      if (depth > MAX_DEPTH) return null;
      if (!isVisible(el)) return null;

      const tag = el.tagName.toLowerCase();

      // Skip script, style, noscript, template, oue-injected
      if (['script', 'style', 'noscript', 'template', 'link', 'meta', 'br', 'hr'].includes(tag)) return null;
      if (el.id === 'oue-force-visible') return null;

      const cs = getComputedStyle(el);
      const role = detectRole(el);
      const layout = detectLayout(cs);

      const node = { tag, role };

      // Layout (skip flow for leaf nodes)
      if (layout.type !== 'flow' || el.children.length > 0) {
        node.layout = layout;
      }

      // Text content (for leaf-ish elements)
      const directText = getDirectText(el);
      if (directText) {
        node.text = directText;
      }

      // Slot detection — text nodes, images, buttons, links are swappable
      const slotRoles = new Set(['heading', 'text', 'link', 'button', 'image', 'icon', 'video', 'caption', 'quote']);
      if (slotRoles.has(role)) {
        node.slot = true;
      }

      // Image source
      if (tag === 'img') {
        node.src = el.getAttribute('src') || '';
        node.alt = el.getAttribute('alt') || '';
      }

      // Link href
      if (tag === 'a') {
        node.href = el.getAttribute('href') || '';
      }

      // SVG content (small SVGs only)
      if (tag === 'svg') {
        try {
          const svgStr = new XMLSerializer().serializeToString(el);
          if (svgStr.length <= MAX_SVG_BYTES) {
            node.svgContent = svgStr;
          } else {
            node.svgTruncated = true;
            node.svgSize = svgStr.length;
          }
        } catch (e) {
          // skip
        }
      }

      // Data attributes
      const dataAttrs = {};
      for (const attr of el.attributes) {
        if (attr.name.startsWith('data-') && !attr.name.startsWith('data-v-') && !attr.name.startsWith('data-reactid')) {
          dataAttrs[attr.name] = attr.value;
        }
      }
      if (Object.keys(dataAttrs).length > 0) {
        node.data = dataAttrs;
      }

      // Recurse children
      const children = [];
      for (const child of el.children) {
        const childNode = buildSemanticTree(child, depth + 1);
        if (childNode) children.push(childNode);
      }
      if (children.length > 0) {
        node.children = children;
      }

      return node;
    }

    /**
     * Walk a section element and collect scoped CSS for all descendants.
     */
    function collectScopedCSS(sectionEl, sectionClass) {
      const rules = [];
      const seen = new Set();

      function walk(el, parentCs, depth) {
        if (depth > MAX_DEPTH) return;
        if (!isVisible(el)) return;

        const tag = el.tagName.toLowerCase();
        if (['script', 'style', 'noscript', 'template', 'link', 'meta'].includes(tag)) return;
        if (el.id === 'oue-force-visible') return;

        const styles = extractElementCSS(el, parentCs);

        if (Object.keys(styles).length > 0) {
          const selector = buildSelector(el, sectionClass);
          if (!seen.has(selector)) {
            seen.add(selector);
            const cssBlock = Object.entries(styles)
              .map(([prop, val]) => `  ${prop}: ${val};`)
              .join('\n');
            rules.push(`${selector} {\n${cssBlock}\n}`);
          }
        }

        const cs = getComputedStyle(el);
        for (const child of el.children) {
          walk(child, cs, depth + 1);
        }
      }

      // Start with the section itself
      const sectionStyles = extractElementCSS(sectionEl, sectionEl.parentElement ? getComputedStyle(sectionEl.parentElement) : null);
      if (Object.keys(sectionStyles).length > 0) {
        const sectionSelector = `.${sectionClass}`;
        const cssBlock = Object.entries(sectionStyles)
          .map(([prop, val]) => `  ${prop}: ${val};`)
          .join('\n');
        rules.push(`${sectionSelector} {\n${cssBlock}\n}`);
      }

      const sectionCs = getComputedStyle(sectionEl);
      for (const child of sectionEl.children) {
        walk(child, sectionCs, 1);
      }

      return rules.join('\n\n');
    }

    /**
     * Detect content slots in a section (swappable content).
     */
    function detectSlots(el, depth) {
      if (depth > MAX_DEPTH) return [];
      const slots = [];
      const tag = el.tagName.toLowerCase();

      // Text slots: headings, paragraphs, links, buttons
      if (/^h[1-6]$/.test(tag)) {
        slots.push({ type: 'heading', level: parseInt(tag[1]), text: el.textContent.trim().slice(0, 200) });
      }
      if (tag === 'p') {
        const text = el.textContent.trim();
        if (text.length > 0) {
          slots.push({ type: 'text', text: text.slice(0, 200) });
        }
      }
      if (tag === 'a') {
        slots.push({ type: 'link', text: el.textContent.trim().slice(0, 100), href: el.getAttribute('href') || '' });
      }
      if (tag === 'button') {
        slots.push({ type: 'button', text: el.textContent.trim().slice(0, 100) });
      }
      // Image slots
      if (tag === 'img') {
        slots.push({ type: 'image', src: el.getAttribute('src') || '', alt: el.getAttribute('alt') || '' });
      }
      if (tag === 'video') {
        const src = el.getAttribute('src') || el.querySelector('source')?.getAttribute('src') || '';
        slots.push({ type: 'video', src });
      }

      // Recurse
      for (const child of el.children) {
        slots.push(...detectSlots(child, depth + 1));
      }

      return slots;
    }

    // ─── Section Detection ──────────────────────────────────────────────

    /**
     * Detect logical page sections using multiple strategies.
     */
    function detectSections() {
      const found = new Map(); // element → { role, source }

      // Strategy 1: Semantic tags and ARIA roles
      const semanticSelectors = [
        { sel: 'header:not(header header)', role: 'header' },
        { sel: '[role="banner"]', role: 'header' },
        { sel: 'nav:first-of-type', role: 'nav' },
        { sel: '[role="navigation"]', role: 'nav' },
        { sel: 'main', role: 'main' },
        { sel: '[role="main"]', role: 'main' },
        { sel: 'footer:not(footer footer)', role: 'footer' },
        { sel: '[role="contentinfo"]', role: 'footer' },
      ];

      for (const { sel, role } of semanticSelectors) {
        const els = document.querySelectorAll(sel);
        for (const el of els) {
          if (!found.has(el) && isVisible(el)) {
            found.set(el, { role, source: 'semantic' });
          }
        }
      }

      // Strategy 2: Direct children of main or body with significant height
      const mainEl = document.querySelector('main') || document.body;
      let sectionIdx = 0;
      for (const child of mainEl.children) {
        if (found.has(child)) continue;
        const tag = child.tagName.toLowerCase();
        if (['script', 'style', 'noscript', 'template', 'link', 'meta'].includes(tag)) continue;
        if (!isVisible(child)) continue;

        const rect = child.getBoundingClientRect();
        if (rect.height < 100) continue;

        // Assign role based on content analysis
        let role = 'section';
        const cls = (child.className?.baseVal || child.className || '').toString().toLowerCase();
        const id = (child.id || '').toLowerCase();
        const combined = cls + ' ' + id;

        if (combined.includes('hero')) role = 'hero';
        else if (combined.includes('feature')) role = 'features';
        else if (combined.includes('about')) role = 'about';
        else if (combined.includes('service')) role = 'services';
        else if (combined.includes('portfolio') || combined.includes('work') || combined.includes('project')) role = 'portfolio';
        else if (combined.includes('testimonial') || combined.includes('review')) role = 'testimonials';
        else if (combined.includes('pricing') || combined.includes('plan')) role = 'pricing';
        else if (combined.includes('team')) role = 'team';
        else if (combined.includes('contact')) role = 'contact';
        else if (combined.includes('faq')) role = 'faq';
        else if (combined.includes('cta') || combined.includes('call-to-action')) role = 'cta';
        else if (combined.includes('blog') || combined.includes('news') || combined.includes('article')) role = 'blog';
        else if (combined.includes('gallery')) role = 'gallery';
        else if (combined.includes('partner') || combined.includes('client') || combined.includes('logo')) role = 'partners';
        else if (combined.includes('stats') || combined.includes('number') || combined.includes('counter')) role = 'stats';
        else {
          // Check first heading for clues
          const h = child.querySelector('h1, h2, h3');
          if (h) {
            const hText = h.textContent.toLowerCase();
            if (hText.includes('feature') || hText.includes('what we')) role = 'features';
            else if (hText.includes('about')) role = 'about';
            else if (hText.includes('service')) role = 'services';
            else if (hText.includes('work') || hText.includes('project') || hText.includes('portfolio')) role = 'portfolio';
            else if (hText.includes('testimonial') || hText.includes('review') || hText.includes('say')) role = 'testimonials';
            else if (hText.includes('pricing') || hText.includes('plan')) role = 'pricing';
            else if (hText.includes('team')) role = 'team';
            else if (hText.includes('contact') || hText.includes('touch')) role = 'contact';
            else if (hText.includes('faq') || hText.includes('question')) role = 'faq';
          }
        }

        // Make sections unique by appending index if needed
        if (role === 'section') {
          sectionIdx++;
          role = `section-${sectionIdx}`;
        }

        found.set(child, { role, source: 'height' });
      }

      // Strategy 3: Sections/divs with recognizable IDs
      const idPatterns = ['hero', 'about', 'features', 'services', 'portfolio',
        'testimonials', 'pricing', 'team', 'contact', 'faq', 'cta', 'blog',
        'gallery', 'partners', 'stats', 'work', 'projects'];

      for (const pattern of idPatterns) {
        const els = document.querySelectorAll(
          `section[id*="${pattern}"], div[id*="${pattern}"], [class*="${pattern}"]`
        );
        for (const el of els) {
          if (found.has(el)) continue;
          if (!isVisible(el)) continue;
          const rect = el.getBoundingClientRect();
          if (rect.height < 100) continue;
          // Only add top-level-ish elements (not deeply nested)
          let depth = 0;
          let p = el.parentElement;
          while (p && p !== document.body && p !== mainEl) {
            depth++;
            p = p.parentElement;
          }
          if (depth > 3) continue;

          found.set(el, { role: pattern, source: 'id-pattern' });
        }
      }

      // If we detected a header and the first section right after it has
      // a very large height or h1, call it the hero
      const headerEl = [...found.entries()].find(([_, v]) => v.role === 'header');
      if (headerEl) {
        const [hEl] = headerEl;
        const nextSibling = hEl.nextElementSibling;
        if (nextSibling && found.has(nextSibling)) {
          const info = found.get(nextSibling);
          if (info.role.startsWith('section')) {
            const hasH1 = nextSibling.querySelector('h1');
            const rect = nextSibling.getBoundingClientRect();
            if (hasH1 || rect.height > 500) {
              found.set(nextSibling, { ...info, role: 'hero' });
            }
          }
        }
      }

      return found;
    }

    // ─── Global Token Extraction ────────────────────────────────────────

    /**
     * Extract design tokens from the page.
     */
    function extractTokens() {
      const tokens = {
        customProperties: {},
        fontFaces: [],
        bodyStyles: {},
      };

      // 1. CSS custom properties from :root
      try {
        const rootCS = getComputedStyle(document.documentElement);
        // Get from stylesheets too (computedStyle doesn't reliably expose custom props)
        for (const sheet of document.styleSheets) {
          try {
            for (const rule of sheet.cssRules) {
              if (rule.selectorText === ':root' || rule.selectorText === 'html') {
                for (let i = 0; i < rule.style.length; i++) {
                  const prop = rule.style[i];
                  if (prop.startsWith('--')) {
                    tokens.customProperties[prop] = rule.style.getPropertyValue(prop).trim();
                  }
                }
              }
            }
          } catch (e) {
            // Cross-origin stylesheet, skip
          }
        }
      } catch (e) {}

      // 2. @font-face declarations
      try {
        for (const sheet of document.styleSheets) {
          try {
            for (const rule of sheet.cssRules) {
              if (rule instanceof CSSFontFaceRule) {
                const face = {};
                const style = rule.style;
                face.family = style.getPropertyValue('font-family').replace(/['"]/g, '').trim();
                face.src = style.getPropertyValue('src');
                const weight = style.getPropertyValue('font-weight');
                if (weight) face.weight = weight;
                const fStyle = style.getPropertyValue('font-style');
                if (fStyle && fStyle !== 'normal') face.style = fStyle;
                const display = style.getPropertyValue('font-display');
                if (display) face.display = display;
                tokens.fontFaces.push(face);
              }
            }
          } catch (e) {
            // Cross-origin
          }
        }
      } catch (e) {}

      // 3. Body styles
      try {
        const bodyCS = getComputedStyle(document.body);
        tokens.bodyStyles = {
          fontFamily: bodyCS.fontFamily,
          fontSize: bodyCS.fontSize,
          fontWeight: bodyCS.fontWeight,
          lineHeight: bodyCS.lineHeight,
          color: bodyCS.color,
          backgroundColor: bodyCS.backgroundColor,
          letterSpacing: bodyCS.letterSpacing,
        };
      } catch (e) {}

      return tokens;
    }

    // ─── Inline Style Extraction ────────────────────────────────────────

    /**
     * Extract inline <style> blocks that contain hover/animation/transition CSS.
     */
    function extractInlineStyles() {
      const blocks = [];

      document.querySelectorAll('style').forEach(styleEl => {
        if (styleEl.id === 'oue-force-visible') return;
        const text = styleEl.textContent || '';
        if (!text.trim()) return;

        // Check if it contains hover, animation, transition, or keyframe rules
        const hasInteractive = /:hover|:focus|:active|@keyframes|animation|transition|:before|:after|::before|::after|@media/i.test(text);
        if (hasInteractive) {
          blocks.push(text.trim());
        }
      });

      return blocks.join('\n\n/* --- */\n\n');
    }

    // ═══════════════════════════════════════════════════════════════════
    // Main analysis logic
    // ═══════════════════════════════════════════════════════════════════

    const sections = detectSections();
    const result = {
      sections: [],
      tokens: extractTokens(),
      inlineStyles: extractInlineStyles(),
    };

    // Deduplicate roles — if two sections have the same role, suffix with index
    const roleCounts = {};
    for (const [_, info] of sections) {
      roleCounts[info.role] = (roleCounts[info.role] || 0) + 1;
    }
    const roleSeq = {};

    for (const [el, info] of sections) {
      let role = info.role;
      if (roleCounts[role] > 1) {
        roleSeq[role] = (roleSeq[role] || 0) + 1;
        role = `${role}-${roleSeq[role]}`;
      }

      const sectionClass = `oue-${role}`;

      // Get bounding rect for blueprint
      const rect = el.getBoundingClientRect();

      const sectionData = {
        role,
        source: info.source,
        sectionClass,
        rect: {
          top: Math.round(rect.top + window.scrollY),
          left: Math.round(rect.left),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        },
        markup: el.outerHTML,
        css: collectScopedCSS(el, sectionClass),
        semanticTree: buildSemanticTree(el, 0),
        slots: detectSlots(el, 0),
      };

      result.sections.push(sectionData);
    }

    // Blueprint — lightweight summary without markup/css
    result.blueprint = {
      title: document.title || '',
      url: location.href,
      viewport: { width: window.innerWidth, height: window.innerHeight },
      pageHeight: document.body.scrollHeight,
      sectionCount: result.sections.length,
      sections: result.sections.map(s => ({
        role: s.role,
        sectionClass: s.sectionClass,
        rect: s.rect,
        slotCount: s.slots.length,
        source: s.source,
      })),
    };

    return result;

  }, { MAX_DEPTH, MAX_SVG_BYTES });

  // ═══════════════════════════════════════════════════════════════════════
  // Write output files — Node.js side
  // ═══════════════════════════════════════════════════════════════════════

  log('📁', `Writing analysis output to ${outDir}`);

  const componentsDir = path.join(outDir, 'components');
  ensureDir(componentsDir);

  let sectionCount = 0;

  for (const section of analysis.sections) {
    const sectionDir = path.join(componentsDir, section.role);
    ensureDir(sectionDir);

    // markup.html — real HTML from the live page
    if (section.markup) {
      fs.writeFileSync(
        path.join(sectionDir, 'markup.html'),
        section.markup,
        'utf-8'
      );
    }

    // styles.css — scoped CSS
    if (section.css) {
      fs.writeFileSync(
        path.join(sectionDir, 'styles.css'),
        `/* Scoped styles for ${section.role} */\n\n${section.css}`,
        'utf-8'
      );
    }

    // meta.json — semantic tree + slots
    const meta = {
      role: section.role,
      sectionClass: section.sectionClass,
      rect: section.rect,
      source: section.source,
      semanticTree: section.semanticTree,
      slots: section.slots,
    };
    fs.writeFileSync(
      path.join(sectionDir, 'meta.json'),
      JSON.stringify(meta, null, 2),
      'utf-8'
    );

    sectionCount++;
    log('  📦', `${section.role} — ${section.slots.length} slots, CSS ${(section.css || '').length} bytes`);
  }

  // tokens.json — global design tokens
  fs.writeFileSync(
    path.join(outDir, 'tokens.json'),
    JSON.stringify(analysis.tokens, null, 2),
    'utf-8'
  );
  log('🎨', `Design tokens: ${Object.keys(analysis.tokens.customProperties).length} custom properties, ${analysis.tokens.fontFaces.length} font faces`);

  // blueprint.json — full site structure summary
  fs.writeFileSync(
    path.join(outDir, 'blueprint.json'),
    JSON.stringify(analysis.blueprint, null, 2),
    'utf-8'
  );
  log('📐', `Blueprint: ${analysis.blueprint.sectionCount} sections, page height ${analysis.blueprint.pageHeight}px`);

  // inline-styles.css — hover/animation styles (if any)
  if (analysis.inlineStyles && analysis.inlineStyles.trim()) {
    fs.writeFileSync(
      path.join(outDir, 'inline-styles.css'),
      `/* Inline styles extracted from <style> blocks (hover/animation/transition) */\n\n${analysis.inlineStyles}`,
      'utf-8'
    );
    log('✨', `Inline styles: ${analysis.inlineStyles.length} bytes`);
  }

  log('✅', `Phase 2 complete: ${sectionCount} sections analyzed`);

  return analysis;
}

module.exports = { analyzeDOM };
