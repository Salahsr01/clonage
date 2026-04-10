# OUE Pipeline Redesign — Unified Capture + Smart Assembly

**Date:** 2026-04-10
**Status:** Approved
**Author:** Claude + Salah

## Problem

The current pipeline (clone.js + decompose.js + recompose.js) has fundamental limitations:

1. **decompose.js re-serves the clone locally** — JS hydration fails for React/Next.js sites because CDN assets are missing. Result: empty blueprints on complex sites (ElevenLabs: 0 components captured).
2. **The blueprint is insufficient** — flat pixel positions without layout context. The LLM guesses CSS and gets it wrong (~60-82% fidelity).
3. **No visual feedback** — the LLM writes code blind. No way to know if `top: 29%` lands in the right spot.
4. **LLM reproduction from scratch plateaus at ~82%** — the LLM can't perfectly recreate complex CSS, animations, gradients. It always approximates.

## Solution: Approach C — Hybrid Smart Assembly

### Architecture

```
capture.js (ONE pass on live site)
    → assets/ + components/ + tokens.json + blueprint.json + reference/

assemble.js (LLM assembles real components)
    → output/index.html

validate.js (pixelmatch feedback loop)
    → score + heatmap → LLM corrects → repeat
```

### Key Design Decisions

1. **Merge clone + decompose into `capture.js`** — capture everything while Playwright is on the live site. No re-serving, no re-rendering.

2. **Components are self-contained** — each section gets its own `markup.html` (real HTML), `styles.css` (scoped CSS from computed styles), `meta.json` (semantic tree), `screenshot.png` (visual reference).

3. **The LLM is an assembler, not a creator** — it combines real components and writes only glue code (shared tokens, coherence adjustments). This gets us to 96%+ because the CSS/HTML is real.

4. **pixelmatch validation loop** — automated screenshot comparison gives the LLM objective feedback without vision tokens.

## capture.js — Unified Capture Script

### Input
```bash
node capture.js https://elevenlabs.io/
```

### Process (single Playwright session on live site)
1. Navigate to URL, wait for hydration (`networkidle` + 3s settle)
2. Smart scroll (trigger lazy-load, detect infinite scroll)
3. Force visibility (reveal hidden/animated content)
4. **Capture phase (NEW — replaces decompose.js):**
   a. Detect sections (header, hero, features, footer) via tag/class heuristics
   b. For each section:
      - Clip screenshot
      - Extract scoped HTML (`el.outerHTML` cleaned)
      - Compute scoped CSS (walk children, collect non-default computed styles)
      - Extract SVGs via XMLSerializer (< 4KB inline)
      - Extract content slots (headings, paragraphs, buttons, images)
      - Build semantic tree (layout type, children roles, positioning context)
      - Capture data-* animation attributes
   c. Extract global design tokens (CSS vars, @font-face, palette, typography scale)
   d. Full-page screenshots at 1440x900 and 375x812 (reference for pixelmatch)
5. **Download phase (from clone.js):**
   - Download all network-captured resources (fonts, images, CSS, JS)
   - Rewrite URLs to local paths
   - Save to assets/ directory

### Output Structure
```
sites/{domain}/
├── assets/                     # Raw files (fonts, images, videos, ext CDN)
├── components/                 # Self-contained sections
│   ├── header/
│   │   ├── markup.html         # Cleaned HTML of this section only
│   │   ├── styles.css          # Scoped CSS (computed → clean CSS)
│   │   ├── screenshot.png      # Visual reference
│   │   └── meta.json           # Semantic tree + slots + animations
│   ├── hero/
│   ├── features/
│   └── footer/
├── tokens.json                 # Global design tokens
├── blueprint.json              # Full site structure + metadata
├── reference/                  # Screenshots for pixelmatch
│   ├── full-1440x900.png
│   └── full-375x812.png
└── original.html               # Full post-render HTML (backup)
```

### Scoped CSS Generation

For each element in a section, compute:
```javascript
const cs = getComputedStyle(el);
// Only include non-default, non-inherited values
// Skip: display:block (default), color inherited from parent, etc.
// Include: font-size, font-weight, padding, margin, background, border-radius, etc.
```

Output clean CSS with meaningful selectors:
```css
/* components/hero/styles.css */
.hero { position: relative; min-height: 100vh; }
.hero h1 { font-family: Waldenburg, serif; font-size: 48px; font-weight: 300; }
.hero .cta-primary { background: #000; color: #fff; border-radius: 9999px; padding: 0 20px; height: 48px; }
```

### Semantic Tree (meta.json)

Each node includes:
- `tag` — HTML tag
- `role` — semantic role (heading, description, cta, image, icon, nav-link)
- `layout` — { type: "grid|flex-row|flex-col|flow|absolute", columns?, gap?, etc. }
- `text` — content (if slot)
- `slot` — boolean (can be swapped)
- `svgContent` — inline SVG markup (if icon/logo)
- `src` — image source (if image)
- `animations` — entrance/scroll/hover animations
- `children` — nested nodes

## validate.js — Pixelmatch Feedback Loop

### Input
```bash
node validate.js sites/elevenlabs_io/ output/index.html
```

### Process
1. Open `output/index.html` in Playwright (1440x900)
2. Take screenshot
3. Compare with `sites/elevenlabs_io/reference/full-1440x900.png`
4. Calculate pixel diff score via pixelmatch
5. Divide image into 4x3 grid zones
6. Calculate per-zone diff percentage
7. Output JSON with score + zone hints

### Output
```json
{
  "score": 87.3,
  "iteration": 1,
  "zones": [
    { "region": "top-right", "coords": [1080, 0, 1440, 225], "diffPercent": 12.1 },
    { "region": "center", "coords": [360, 450, 1080, 675], "diffPercent": 8.4 }
  ],
  "heatmapPath": "output/diff-heatmap.png"
}
```

The LLM receives this and knows exactly where to focus corrections.

## assemble.js — LLM Assembly Orchestrator

### Modes

**Mode: reproduce**
```bash
node assemble.js sites/elevenlabs_io/ --mode reproduce
```
- Reads components in order
- Generates a single HTML file that includes all sections
- Injects font-faces from tokens.json
- Adds animation JS (Lenis, GSAP if detected)
- The LLM writes minimal glue code

**Mode: frankenstein**
```bash
node assemble.js --mode frankenstein \
  --hero sites/raviklaassens/components/hero \
  --features sites/elevenlabs_io/components/features \
  --footer sites/sohub_digital/components/footer
```
- Combines components from different sites
- LLM harmonizes design tokens (colors, fonts, spacing)
- Writes coherence CSS

**Mode: create**
- LLM generates from scratch but uses captured components as inspiration
- References real patterns from the component library

## Dependencies

- `playwright` — browser automation (already installed)
- `pixelmatch` — pixel comparison (add to package.json)
- `pngjs` — PNG encoding for pixelmatch (add to package.json)

No other dependencies needed. Everything runs locally.

## Migration Plan

1. Build `capture.js` — test on 3 sites (raviklaassens, sohub, elevenlabs)
2. Build `validate.js` — integrate pixelmatch
3. Build `assemble.js` — mode reproduce first, then frankenstein
4. Archive old files (`clone.js`, `decompose.js`, `recompose.js`) → `_archive/`
5. Update memory files with new pipeline

## Success Criteria

- `capture.js` produces valid components for all 3 test sites
- Each component's `markup.html` + `styles.css` renders correctly in isolation
- `validate.js` correctly identifies visual differences
- `assemble.js --mode reproduce` achieves 95%+ pixelmatch score on all 3 sites
- Full pipeline runs in < 3 minutes per site
