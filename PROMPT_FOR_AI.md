# Prompt pour IA — Projet OUE (Clonage → Reproduction → Création)

## Le repo
https://github.com/Salahsr01/clonage.git

## Mon objectif final

Je veux construire un **outil qui permet à une IA de CRÉER des sites web au niveau Awwwards** (sites primés, design exceptionnel). Ma stratégie : entraîner l'IA sur des **clones pixel-perfect de vrais sites award-winning**, puis lui faire comprendre les patterns de design pour qu'elle puisse en créer de nouveaux.

Le pipeline en 3 phases :
1. **Clone** — Capturer n'importe quel site web (HTML, CSS, fonts, images, animations) localement
2. **Reproduce** — L'IA lit les données capturées et **réécrit le site de zéro** (prouve qu'elle comprend la structure)
3. **Create** — L'IA mélange des éléments de plusieurs sites clonés pour créer un site original ("Frankenstein créatif")

## Où j'en suis

### Ce qui fonctionne ✅
- **`capture.js`** : Playwright capture un site live → assets, fonts, images, baked HTML (scripts supprimés, styles inlinés, preloaders enlevés, animations figées dans leur état final)
- **`assemble.js --direct`** : Prend le baked.html, réécrit les URLs CDN → local, supprime scripts/cookies/widgets → page statique fonctionnelle
- **`decompose.js`** : Extrait un blueprint structuré du DOM (arbre sémantique, slots, tailles en px, grid columns, SVG content, @font-face, custom properties, viewport %)
- **`validate.js`** : Comparaison pixelmatch avec analyse par zones 4×3

### Scores de reproduction LLM (IA écrit tout le code de zéro)
- **raviklaassens.com** : 97/100 — Portfolio créatif avec UnicornStudio WebGL, GSAP animations, custom ease, [data-btn] hover system, SplitText word reveals
- **elevenlabs.io** : ~60/100 — SaaS landing page Next.js + Tailwind. Le layout est correct mais pas assez fidèle aux vrais styles
- **sohub.digital** : 94/100 — Site Webflow avec scroll animations

### Le problème principal 🔴
Le pipeline doit être **100% générique** — un seul `node capture.js <url>` puis `node assemble.js <site> --direct` doit produire un clone fonctionnel pour N'IMPORTE QUEL site. Aujourd'hui :
- Les sites Next.js/Tailwind (comme ElevenLabs) ont leurs CSS inline dans des `<style>` tags, ça marche
- Les sites Webflow marchent bien
- Mais les **animations JS** (GSAP, Lenis, Barba transitions) ne fonctionnent pas car on strip tous les `<script>` pour éviter l'hydration React qui wipe le DOM SSR

### Architecture actuelle
```
capture.js          → Phase 1: Network intercept (assets, fonts, CSS, images)
                    → Phase 1.5: Baking (inline styles, fix animations, remove scripts)
                    → Phase 2: DOM analysis (sections, semantic tree, tokens)
                    → Phase 3: Reference screenshots

assemble.js         → Mode "reproduce": combine components + scoped CSS
                    → Mode "--direct": baked HTML + URL rewriting + cleanup

decompose.js        → Blueprint JSON extraction (standalone, enhanced)
validate.js         → pixelmatch comparison + zone analysis
lib/clone.js        → Network response interception + asset download
lib/analyze.js      → Single page.evaluate() for DOM analysis
lib/screenshot.js   → Reference screenshots (full page, sections, mobile)
lib/utils.js        → Constants, MIME types, viewport config
```

## Ce que je cherche

### 1. Meilleur pipeline de capture
Comment capturer un site web de manière plus fidèle ? Actuellement je :
- Intercepte les réponses réseau avec Playwright
- Bake le DOM après chargement JS (innerHTML avec computed styles)
- Strip les scripts pour éviter l'hydration

**Problèmes** : 
- Les animations GSAP/Lenis/ScrollTrigger sont perdues
- Les hover effects CSS fonctionnent mais les hover JS non
- Les carousels/sliders sont figés dans un état

### 2. Reproduction LLM plus fidèle
Le LLM (Claude/GPT) reçoit le blueprint JSON + tokens + component markup et doit réécrire le site. Comment améliorer la fidélité ?

**Ce qui marche** :
- Layout grid, fonts, couleurs, images : fidèle au pixel
- Animations d'entrée (GSAP + SplitText) : le LLM les reproduit bien quand le blueprint les décrit

**Ce qui manque** :
- Le CSS du site original n'est pas assez exploité — le LLM réécrit du CSS depuis zéro au lieu d'utiliser les classes capturées
- La reproduction est meilleure quand on donne les mesures exactes (px) plutôt que des descriptions

### 3. Outils/repos GitHub qui pourraient aider
Je cherche des outils open-source pour :
- **Website archiving/cloning** plus avancé que mon pipeline actuel (mieux que wget, httrack)
- **CSS extraction/inlining** — outils qui inlinent tous les styles computed dans le HTML
- **Static site generation from live pages** — convertir une SPA React/Next.js en HTML statique parfait
- **Visual regression testing** — alternatives ou compléments à pixelmatch
- **DOM serialization** — capturer le DOM rendu avec tous les computed styles
- **Animation capture** — enregistrer les animations CSS/JS et les rejouer sans le JS original
- **Screenshot-to-code** — des outils qui transforment un screenshot en code (pour comparer avec mon approche blueprint)
- **Headless browser rendering** — alternatives à Playwright pour capturer des pages

### 4. Approches techniques que je n'ai pas explorées
- **Single-file HTML with inlined everything** (comme MHTML mais propre)
- **CSS computed style extraction** par élément (comme getComputedStyle mais exporté proprement)
- **Service Worker approach** — intercepter au niveau SW plutôt que Playwright
- **Chrome DevTools Protocol** direct (CDP) au lieu de Playwright
- **Puppeteer vs Playwright** — avantages/inconvénients pour ce use case
- **Web Archive (WARC)** format — est-ce que ça résoudrait mes problèmes ?
- **Monolith** (outil Rust) — bundle une page en un seul fichier

## Stack technique
- Node.js + Playwright
- pixelmatch + pngjs (comparaison visuelle)
- GSAP/SplitText/Lenis (animations dans les reproductions)
- Pas de framework frontend — HTML/CSS/JS vanilla

## Ce que je veux de toi

1. **Analyse le repo** et dis-moi ce qui est bien fait et ce qui peut être amélioré
2. **Propose des outils GitHub** concrets (nom, URL, comment les intégrer)
3. **Propose des techniques** que je n'ai pas essayées
4. **Si tu connais des projets similaires**, dis-le-moi (clone-to-create pipeline)
5. **Sois ultra-précis** — pas de "tu pourrais essayer X", mais "installe X, utilise-le comme ça, ça résout tel problème"

## Contraintes
- Le pipeline doit fonctionner sur **n'importe quel site** — pas de code spécifique par site
- La reproduction LLM doit être **autonome** — pas besoin d'ouvrir un navigateur pendant la reproduction
- Les assets réels (fonts, images) sont toujours utilisés — jamais de polices Google génériques à la place des vraies
- L'objectif final est la **création**, pas juste le clonage
