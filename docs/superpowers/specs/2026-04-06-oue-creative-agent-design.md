# OUE — Agent Créatif Web

**Date:** 2026-04-06
**Auteur:** Salah + Claude
**Statut:** Design validé

## Vision

Un agent créatif CLI qui génère des sites web de qualité Awwwards en s'appuyant sur une bibliothèque de composants extraits des meilleurs sites du monde. L'agent ne copie pas — il crée des variantes originales aussi belles que les références.

## Choix validés

| Décision | Choix |
|---|---|
| Interface | CLI (`salah clone/analyze/browse/create`) |
| Output | HTML/CSS/JS pur, zéro build, zéro framework |
| Bibliothèque | Analyse auto au clonage + curation manuelle visuelle |
| Utilisateur | Salah uniquement |
| Animations | Tout permis (GSAP, CSS, Three.js, etc.) |
| Stack | Node.js + Claude API + SQLite |
| Architecture | Pipeline modulaire (4 modules + DB) |

## Architecture

```
┌──────────┐    ┌──────────┐    ┌──────────────┐    ┌──────────┐
│  CLONER  │───▶│ ANALYZER │───▶│ BIBLIOTHÈQUE │───▶│ CREATOR  │
│  (fait)  │    │          │    │   (SQLite)   │    │          │
└──────────┘    └──────────┘    └──────────────┘    └──────────┘
                                       ▲
                                       │
                                ┌──────────┐
                                │ BROWSER  │
                                │(curation)│
                                └──────────┘
```

### Commandes CLI

```bash
salah                          # Menu interactif (existe)
salah clone site.com           # Clone un site (existe)
salah analyze site.com         # Décompose un clone en composants
salah analyze --all            # Analyse tous les clones non analysés
salah browse                   # Interface visuelle de curation
salah create "prompt"          # Génère un site via Claude API
salah create "prompt" --ref voku.studio  # Avec sites de référence
```

## Module 1 — Cloner (FAIT)

Existe dans `~/Desktop/OUE/_core/cloner.js`. Clone un site complet via Playwright avec interception réseau. Output: dossier sur le Bureau avec HTML/CSS/JS/images/vidéos.

Aucun changement nécessaire sauf: après le clone, proposer automatiquement `salah analyze`.

## Module 2 — Analyzer

### Rôle

Prend un dossier de site cloné, le décompose en composants réutilisables, et les indexe dans la bibliothèque.

### Processus d'analyse

1. **Parse le HTML** de chaque page du clone
2. **Détecte les sections** sémantiques (header, hero, features, testimonials, footer, etc.)
3. **Extrait pour chaque composant:**
   - HTML isolé (nettoyé, self-contained)
   - CSS associé (scoped, sans dépendances externes)
   - JS associé (animations, interactions)
   - Métadonnées: type, couleurs, polices, breakpoints
   - Screenshot (via Playwright headless)
4. **Envoie à Claude API** pour:
   - Classification du type de composant
   - Description textuelle ("Hero plein écran avec vidéo background et texte centré")
   - Tags (dark, minimal, animated, video, parallax, etc.)
   - Niveau de complexité (simple/moyen/avancé)
5. **Sauvegarde** dans la bibliothèque (DB + fichiers)

### Détection des sections

Heuristiques pour découper une page en composants:
- Balises `<section>`, `<header>`, `<footer>`, `<nav>`, `<main>`
- `<div>` avec des classes sémantiques (hero, features, about, contact, testimonials, pricing, etc.)
- Changement de background-color entre éléments frères
- Éléments directs de `<main>` ou `<body>`

### Structure de fichier d'un composant extrait

```
~/.oue/library/components/{id}/
├── component.html      # HTML isolé
├── component.css       # CSS scopé
├── component.js        # JS (animations, interactions)
├── screenshot.png      # Capture visuelle
├── assets/             # Images/vidéos locales
└── meta.json           # Métadonnées
```

### meta.json

```json
{
  "id": "abc123",
  "source": "on.energy",
  "sourceUrl": "https://www.on.energy/",
  "type": "hero",
  "subtype": "video-background",
  "description": "Hero plein écran avec vidéo MP4 en fond, titre large et CTA",
  "tags": ["dark", "video", "fullscreen", "minimal", "animated"],
  "colors": ["#000000", "#FFE500", "#FFFFFF"],
  "fonts": ["Inter", "Space Grotesk"],
  "animations": ["fade-in", "parallax", "video-autoplay"],
  "complexity": "advanced",
  "starred": false,
  "extractedAt": "2026-04-06T22:00:00Z"
}
```

## Module 3 — Bibliothèque (SQLite)

### Rôle

Stocke, indexe et permet la recherche de composants.

### Emplacement

```
~/.oue/
├── library.db              # SQLite
└── library/
    └── components/
        ├── {id1}/
        ├── {id2}/
        └── ...
```

### Schema SQLite

```sql
CREATE TABLE components (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,           -- "on.energy"
  source_url TEXT,
  type TEXT NOT NULL,             -- "hero", "nav", "features", "footer"...
  subtype TEXT,                   -- "video-background", "split-screen"...
  description TEXT,
  tags TEXT,                      -- JSON array
  colors TEXT,                    -- JSON array
  fonts TEXT,                     -- JSON array
  animations TEXT,                -- JSON array
  complexity TEXT,                -- "simple", "medium", "advanced"
  starred INTEGER DEFAULT 0,
  html_path TEXT,
  css_path TEXT,
  js_path TEXT,
  screenshot_path TEXT,
  extracted_at TEXT
);

CREATE TABLE sites (
  domain TEXT PRIMARY KEY,
  url TEXT,
  clone_path TEXT,
  analyzed INTEGER DEFAULT 0,
  analyzed_at TEXT,
  component_count INTEGER DEFAULT 0
);

-- Index pour recherche rapide
CREATE INDEX idx_type ON components(type);
CREATE INDEX idx_starred ON components(starred);
CREATE INDEX idx_source ON components(source);
```

### Recherche

```bash
# Par type
salah browse --type hero

# Par tag
salah browse --tag "dark,animated"

# Par source
salah browse --source on.energy

# Favoris seulement
salah browse --starred
```

## Module 4 — Creator

### Rôle

Génère un site complet HTML/CSS/JS à partir d'un prompt, en utilisant la bibliothèque comme inspiration.

### Processus de génération

1. **Parse le prompt** — comprend le type de site, l'industrie, le style voulu
2. **Cherche dans la bibliothèque** — trouve les composants les plus pertinents par type/tags/style
3. **Construit un brief** pour Claude API:
   - Le prompt utilisateur
   - 3-5 composants de référence (HTML + CSS + description)
   - Instructions de style (couleurs, polices, animations)
4. **Appelle Claude API** — génère le site complet en un seul appel
5. **Sauvegarde** le résultat sur le Bureau dans un dossier nommé
6. **Lance le serveur** pour preview

### Prompt système pour Claude API

L'agent reçoit:
- Le prompt utilisateur
- Les composants de référence extraits de la bibliothèque
- Des instructions pour créer des VARIANTES originales, pas des copies

### Output

```
~/Desktop/{nom-du-site}/
├── index.html
├── css/
│   └── style.css
├── js/
│   └── main.js
├── assets/
│   └── (images placeholder)
└── _preview.log
```

### Exemple d'utilisation

```bash
$ salah create "site vitrine pour cabinet d'architecte, style minimaliste dark, avec hero vidéo et galerie de projets"

  ⣾ Recherche de composants...
    → 3 heroes vidéo trouvés (on.energy, voku.studio, jobyaviation.com)
    → 2 galeries projets (jasonbergh.com, cathydolle.com)
    → 2 navbars minimalistes

  ⣾ Génération avec Claude...

  ✓ Site généré !
    ~/Desktop/cabinet-architecte/

  ? Lancer le serveur ? (O/n)
  🌐 http://localhost:3000
```

## Module 5 — Browser (Curation)

### Rôle

Interface visuelle locale (serveur HTTP + HTML) pour parcourir les composants extraits, les voir en rendu, et les marquer comme favoris.

### Fonctionnalités

- Liste les composants avec screenshot en grille
- Filtre par type, tag, source, favoris
- Preview live du composant (rendu HTML)
- Bouton étoile pour marquer les favoris
- Détails: HTML/CSS/JS source, métadonnées

### Stack

Serveur Node.js local (comme le serveur de clones existant), HTML/CSS/JS pur. Pas de framework.

## Structure fichiers du projet

```
~/Desktop/OUE/
├── Lancer.command
└── _core/
    ├── console.js          # Menu principal (existe)
    ├── cloner.js           # Module 1 (existe)
    ├── analyzer.js         # Module 2 (à construire)
    ├── library.js          # Module 3 — DB (à construire)
    ├── creator.js          # Module 4 (à construire)
    ├── browser.js          # Module 5 (à construire)
    ├── server.js           # Serveur local (existe)
    ├── package.json
    └── node_modules/

~/.oue/
├── library.db              # SQLite
└── library/
    └── components/         # Composants extraits
```

## Dépendances à ajouter

```json
{
  "dependencies": {
    "playwright": "^1.49.0",
    "better-sqlite3": "^11.0.0",
    "@anthropic-ai/sdk": "^0.39.0"
  }
}
```

- **better-sqlite3** : SQLite synchrone, rapide, zéro config
- **@anthropic-ai/sdk** : Claude API pour l'analyse et la génération

## Ordre de construction

1. **Bibliothèque** (library.js + SQLite) — la fondation
2. **Analyzer** (analyzer.js) — remplit la bibliothèque
3. **Browser** (browser.js) — visualise et cure
4. **Creator** (creator.js) — génère les sites
5. **Console** (console.js) — connecte tout dans le menu

Chaque module est testable indépendamment.

## Clé API Claude

L'utilisateur devra fournir sa clé API Anthropic. Stockée dans `~/.oue/config.json`:

```json
{
  "anthropic_api_key": "sk-ant-..."
}
```

À configurer au premier lancement via `salah config`.
