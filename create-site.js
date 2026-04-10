#!/usr/bin/env node

/**
 * ═══════════════════════════════════════════════════════════════════
 * OUE — MULTI-AGENT SITE CREATOR
 * ═══════════════════════════════════════════════════════════════════
 *
 * Architecture:
 *   Orchestrator spawns Claude Code subprocesses as specialized agents.
 *   Each agent has a role, sees relevant context, and outputs structured JSON.
 *
 * Agents:
 *   1. ANALYST  — Reads cloned sites, extracts design DNA (colors, fonts, spacing, components)
 *   2. DESIGNER — Takes the brief + DNA, proposes a site structure with sections
 *   3. BUILDER  — Generates actual HTML/CSS/JS for each section
 *   4. CRITIC   — Plays an exigent 10K+ client, reviews and demands changes
 *   5. REFINER  — Takes critic feedback, rewrites sections
 *
 * Usage:
 *   node create-site.js "site d'architecte minimaliste dark, style voku+jasonbergh"
 *   node create-site.js --brief brief.txt
 *
 * ═══════════════════════════════════════════════════════════════════
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// ─── Config ──────────────────────────────────────────────────────
const CLONES_DIR = __dirname;
const OUTPUT_DIR = path.join(__dirname, '_output');

const CLONES = {
  voku:       path.join(CLONES_DIR, 'voku_clone'),
  jasonbergh: path.join(CLONES_DIR, 'jasonbergh_clone'),
  on_energy:  path.join(CLONES_DIR, 'on_energy_clone'),
  site_clone: path.join(CLONES_DIR, 'site_clone'),
  jitter:     path.join(CLONES_DIR, 'jitter_video_clone'),
  cathydolle: path.join(CLONES_DIR, 'cathydolle_clone'),
  maxima:     path.join(CLONES_DIR, 'maximatherapy_com_clone'),
};

// ─── Agent runner ────────────────────────────────────────────────
function runAgent(name, systemPrompt, userPrompt, options = {}) {
  const { maxTokens = 16000, timeout = 120000 } = options;

  console.log(`\n  ⣾ Agent [${name}] en cours...`);
  const startTime = Date.now();

  try {
    // Write prompt to temp file
    const tmpPrompt = path.join(__dirname, `_tmp_${name}_prompt.txt`);
    fs.writeFileSync(tmpPrompt, userPrompt);

    // Build command — use prompt file to avoid shell escaping
    const args = ['-p', '--model', 'sonnet', '--dangerously-skip-permissions'];
    if (systemPrompt) {
      const tmpSys = path.join(__dirname, `_tmp_${name}_sys.txt`);
      fs.writeFileSync(tmpSys, systemPrompt);
      args.push('--system-prompt-file', tmpSys);
    }

    const result = execSync(
      `claude ${args.join(' ')} < "${tmpPrompt}"`,
      {
        timeout,
        maxBuffer: 1024 * 1024 * 10,
        encoding: 'utf-8',
        cwd: __dirname,
        shell: '/bin/zsh',
      }
    );

    // Cleanup
    try { fs.unlinkSync(tmpPrompt); } catch(e) {}
    try { fs.unlinkSync(path.join(__dirname, `_tmp_${name}_sys.txt`)); } catch(e) {}

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`  ✓ Agent [${name}] terminé (${elapsed}s)`);
    return result.trim();
  } catch (err) {
    console.error(`  ✗ Agent [${name}] erreur:`, err.message?.substring(0, 200));
    return null;
  }
}

// ─── Quick DNA extraction (no agent needed, just parse CSS) ──────
function extractQuickDNA(cloneName) {
  const clonePath = CLONES[cloneName];
  if (!clonePath || !fs.existsSync(clonePath)) return null;

  const indexPath = path.join(clonePath, 'index.html');
  if (!fs.existsSync(indexPath)) return null;

  const html = fs.readFileSync(indexPath, 'utf-8').substring(0, 50000);

  // Extract colors
  const colorRegex = /#[0-9a-fA-F]{6}/g;
  const colors = [...new Set(html.match(colorRegex) || [])].slice(0, 20);

  // Extract font families
  const fontRegex = /font-family:\s*['"]?([^'";,}]+)/g;
  const fonts = new Set();
  let m;
  while ((m = fontRegex.exec(html)) !== null) fonts.add(m[1].trim());

  // Extract CSS file references
  const cssFiles = [];
  const cssRegex = /href="([^"]*\.css[^"]*)"/g;
  while ((m = cssRegex.exec(html)) !== null) cssFiles.push(m[1]);

  // Read first CSS file for more details
  let cssSnippet = '';
  for (const cssFile of cssFiles.slice(0, 2)) {
    const cssPath = path.join(clonePath, cssFile.replace(/^\//, ''));
    if (fs.existsSync(cssPath)) {
      cssSnippet += fs.readFileSync(cssPath, 'utf-8').substring(0, 5000) + '\n';
    }
  }

  // Extract easing functions
  const easingRegex = /cubic-bezier\([^)]+\)/g;
  const easings = [...new Set(cssSnippet.match(easingRegex) || [])];

  // Extract border-radius values
  const radiusRegex = /border-radius:\s*([^;]+)/g;
  const radii = new Set();
  while ((m = radiusRegex.exec(cssSnippet)) !== null) radii.add(m[1].trim());

  return {
    name: cloneName,
    colors: colors,
    fonts: [...fonts].slice(0, 8),
    easings: easings.slice(0, 5),
    borderRadii: [...radii].slice(0, 5),
    cssFiles: cssFiles.slice(0, 5),
    htmlSize: html.length,
  };
}

// ─── Main Flow ───────────────────────────────────────────────────
async function main() {
  const brief = process.argv.slice(2).join(' ') ||
    "Site vitrine pour un cabinet d'architecture contemporaine parisien. Style cinématique dark, typographie éditoriale, galerie de projets immersive. Qualité Awwwards. Budget client: 15 000€.";

  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║        OUE — MULTI-AGENT SITE CREATOR           ║');
  console.log('╚══════════════════════════════════════════════════╝');
  console.log(`\n  Brief: "${brief}"\n`);

  // ═══ Phase 0: Extract DNA from relevant clones ═════════════════
  console.log('─── Phase 0: Extraction DNA des clones ───────────');
  const relevantClones = ['voku', 'jasonbergh', 'on_energy', 'site_clone'];
  const dna = {};
  for (const name of relevantClones) {
    dna[name] = extractQuickDNA(name);
    if (dna[name]) {
      console.log(`  ✓ ${name}: ${dna[name].colors.length} couleurs, ${dna[name].fonts.length} polices, ${dna[name].easings.length} easings`);
    }
  }

  // Compact DNA summary (not full JSON — too large for CLI)
  const dnaLines = Object.entries(dna).filter(([,v]) => v).map(([k, v]) =>
    `${k}: colors=[${v.colors.slice(0,6).join(',')}] fonts=[${v.fonts.join(',')}] easings=[${v.easings.slice(0,2).join(',')}]`
  ).join('\n');
  const dnaContext = dnaLines;

  // ═══ Phase 1: DESIGNER — Structure the site ════════════════════
  console.log('\n─── Phase 1: Agent DESIGNER ──────────────────────');

  const designerPrompt = `Tu es un directeur artistique web senior spécialisé dans les sites Awwwards.

BRIEF CLIENT: ${brief}

DNA DES SITES DE RÉFÉRENCE (extraits de vrais sites primés que tu dois utiliser comme inspiration):
${dnaContext}

Ta mission: Propose la structure EXACTE du site avec pour chaque section:
- Le type de composant (hero, gallery, manifesto, services, contact, etc.)
- La description visuelle précise (pas vague — "carousel horizontal de cards 3:4 avec hover zoom 1.08 et corner brackets dorés", pas "une galerie de projets")
- Les couleurs hex exactes à utiliser
- Les animations précises (easing, durée, trigger)
- La police Google Fonts à utiliser (pas de font custom, que du Google Fonts)
- Le contenu textuel réel (pas de lorem ipsum)

Format ta réponse en JSON strict:
{
  "siteName": "...",
  "tagline": "...",
  "palette": { "bg": "#...", "text": "#...", "accent": "#...", "accent2": "#...", "cream": "#..." },
  "fonts": { "display": "...", "body": "...", "mono": "..." },
  "sections": [
    {
      "id": "hero",
      "type": "...",
      "description": "...",
      "content": { ... },
      "animation": "...",
      "layout": "..."
    }
  ]
}

IMPORTANT: Sois HYPER précis. Chaque valeur doit être concrète. Pas de "une belle animation" — donne le cubic-bezier exact. Pas de "couleurs chaudes" — donne les hex.`;

  const designResult = runAgent('DESIGNER', '', designerPrompt, { timeout: 300000 });

  if (!designResult) {
    console.error('Designer failed. Aborting.');
    process.exit(1);
  }

  // Extract JSON from designer output
  let design;
  try {
    const jsonMatch = designResult.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      design = JSON.parse(jsonMatch[0]);
    } else {
      throw new Error('No JSON found');
    }
  } catch (e) {
    console.log('  ⚠ Designer output not valid JSON, using raw output');
    // Save raw output for debugging
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    fs.writeFileSync(path.join(OUTPUT_DIR, '_designer_raw.txt'), designResult);
    // Use a fallback design
    design = null;
  }

  if (design) {
    console.log(`  → Site: ${design.siteName}`);
    console.log(`  → Sections: ${design.sections?.length || 0}`);
    console.log(`  → Palette: ${JSON.stringify(design.palette)}`);
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    fs.writeFileSync(path.join(OUTPUT_DIR, '_design.json'), JSON.stringify(design, null, 2));
  }

  // ═══ Phase 2: BUILDER — Generate the HTML/CSS/JS ═══════════════
  console.log('\n─── Phase 2: Agent BUILDER ───────────────────────');

  const builderPrompt = `Tu es un développeur front-end senior qui code des sites Awwwards.

DESIGN SPEC:
${design ? JSON.stringify(design, null, 2) : designResult.substring(0, 8000)}

DNA DES SITES DE RÉFÉRENCE:
${dnaContext}

Ta mission: Génère UN SEUL fichier index.html complet (CSS inline dans <style>, JS inline dans <script>) qui implémente exactement le design spec.

RÈGLES STRICTES:
1. HTML/CSS/JS pur — ZÉRO framework, ZÉRO build
2. Utilise les Google Fonts spécifiées via <link>
3. Images depuis Unsplash (URLs directes avec ?w=1200&q=80 pour les héros, ?w=600&q=80 pour les cartes)
4. Thèmes: architecture contemporaine, bâtiments réels, intérieurs design
5. Custom cursor doré avec état hover (expand + texte "Voir")
6. Smooth scroll reveal via IntersectionObserver
7. Parallax sur au moins une section
8. Galerie horizontale drag+wheel
9. Preloader animé
10. Film grain overlay SVG
11. Animations avec les easings EXACTS du design spec
12. Responsive (mobile-first media queries)
13. Le contenu textuel doit être RÉEL et en français, pas du placeholder
14. MINIMUM 6 sections distinctes avec des backgrounds alternés (dark/light/dark)
15. Chaque section doit avoir un label monospace doré "─── NOM DE SECTION"

NE RÉPONDS QU'AVEC LE CODE HTML. Pas d'explication, pas de markdown, juste le code brut commençant par <!DOCTYPE html>.`;

  const buildResult = runAgent('BUILDER', '', builderPrompt, { timeout: 480000 });

  if (!buildResult) {
    console.error('Builder failed. Aborting.');
    process.exit(1);
  }

  // Extract HTML
  let html = buildResult;
  const htmlMatch = html.match(/<!DOCTYPE html>[\s\S]*/i);
  if (htmlMatch) html = htmlMatch[0];

  // Remove trailing markdown if any
  html = html.replace(/```[\s\S]*$/, '').trim();

  // Save
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const outputPath = path.join(OUTPUT_DIR, 'index.html');
  fs.writeFileSync(outputPath, html);
  console.log(`  → Fichier généré: ${outputPath} (${(html.length / 1024).toFixed(0)}KB)`);

  // ═══ Phase 3: CRITIC — Exigent client review ═══════════════════
  console.log('\n─── Phase 3: Agent CRITIQUE (Client 15K€) ────────');

  const criticPrompt = `Tu es un client TRÈS exigeant qui a payé 15 000€ pour un site web d'architecture.
Tu as l'habitude des sites Awwwards. Tu connais voku.studio, jasonbergh.com, on.energy.
Tu es direct, précis, et tu ne laisses rien passer.

Voici le code HTML du site qu'on t'a livré:
${html.substring(0, 15000)}

Voici le design spec original:
${design ? JSON.stringify(design, null, 2).substring(0, 3000) : 'Voir le brief original'}

REVUE CRITIQUE — réponds en JSON:
{
  "score": 0-10,
  "verdict": "...",
  "problemes_majeurs": ["..."],
  "problemes_mineurs": ["..."],
  "ce_qui_marche": ["..."],
  "demandes_revision": ["action concrète 1", "action concrète 2", ...]
}

Sois BRUTAL mais CONSTRUCTIF. Si le score est < 7, détaille exactement ce qui doit changer.
IMPORTANT: Juge sur le DESIGN et l'ORIGINALITÉ, pas sur la technique. Un site techniquement correct mais générique mérite un 4/10.`;

  const criticResult = runAgent('CRITIQUE', '', criticPrompt, { timeout: 300000 });

  let critique;
  if (criticResult) {
    try {
      const jsonMatch = criticResult.match(/\{[\s\S]*\}/);
      if (jsonMatch) critique = JSON.parse(jsonMatch[0]);
    } catch(e) {
      console.log('  ⚠ Critique output not valid JSON');
    }

    fs.writeFileSync(path.join(OUTPUT_DIR, '_critique.json'),
      critique ? JSON.stringify(critique, null, 2) : criticResult
    );

    if (critique) {
      console.log(`  → Score: ${critique.score}/10`);
      console.log(`  → Verdict: ${critique.verdict}`);
      if (critique.problemes_majeurs) {
        critique.problemes_majeurs.forEach(p => console.log(`  ✗ ${p}`));
      }
      if (critique.ce_qui_marche) {
        critique.ce_qui_marche.forEach(p => console.log(`  ✓ ${p}`));
      }
    }
  }

  // ═══ Phase 4: REFINER — Apply critic feedback ══════════════════
  if (critique && critique.score < 8 && critique.demandes_revision) {
    console.log('\n─── Phase 4: Agent REFINER ───────────────────────');
    console.log(`  Score ${critique.score}/10 — Révisions nécessaires`);

    const refinerPrompt = `Tu es un développeur front-end senior. Le client a reviewé le site et n'est PAS satisfait.

VOICI LE CODE ACTUEL:
${html.substring(0, 20000)}

VOICI LES DEMANDES DU CLIENT (qui a payé 15 000€):
${JSON.stringify(critique.demandes_revision, null, 2)}

PROBLÈMES MAJEURS IDENTIFIÉS:
${JSON.stringify(critique.problemes_majeurs, null, 2)}

CE QUI MARCHE (NE PAS TOUCHER):
${JSON.stringify(critique.ce_qui_marche, null, 2)}

Ta mission: Réécris le fichier HTML COMPLET en appliquant TOUTES les demandes de révision.
Garde ce qui marche, corrige ce qui ne va pas.

NE RÉPONDS QU'AVEC LE CODE HTML. Pas d'explication, juste <!DOCTYPE html>...`;

    const refineResult = runAgent('REFINER', '', refinerPrompt, { timeout: 480000 });

    if (refineResult) {
      let refined = refineResult;
      const rMatch = refined.match(/<!DOCTYPE html>[\s\S]*/i);
      if (rMatch) refined = rMatch[0];
      refined = refined.replace(/```[\s\S]*$/, '').trim();

      fs.writeFileSync(path.join(OUTPUT_DIR, 'index.html'), refined);
      fs.writeFileSync(path.join(OUTPUT_DIR, 'index_v1.html'), html); // backup v1
      console.log(`  → V2 générée: ${outputPath} (${(refined.length / 1024).toFixed(0)}KB)`);
      html = refined;
    }
  } else if (critique && critique.score >= 8) {
    console.log(`\n  ★ Score ${critique.score}/10 — Le client est satisfait !`);
  }

  // ═══ Final: Serve ══════════════════════════════════════════════
  console.log('\n═══════════════════════════════════════════════════');
  console.log(`  ✓ Site généré: ${OUTPUT_DIR}/index.html`);
  console.log(`  ✓ Design spec: ${OUTPUT_DIR}/_design.json`);
  console.log(`  ✓ Critique: ${OUTPUT_DIR}/_critique.json`);
  console.log('');
  console.log('  Pour voir le résultat:');
  console.log(`  npx serve ${OUTPUT_DIR} -l 5555`);
  console.log('═══════════════════════════════════════════════════');
}

main().catch(console.error);
