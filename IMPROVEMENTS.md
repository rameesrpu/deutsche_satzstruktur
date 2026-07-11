# Deutsche Satzstruktur — Revolutionary Improvement Roadmap

> **Audience**: This document is written for AI coding agents (Claude models) picking up
> work on this project with no prior context. Read the "Current State" section first,
> then pick an improvement. Each improvement lists motivation, affected files, an
> implementation sketch, effort, and dependencies. Improvements are independent unless
> a dependency is listed.

---

## Current State (read this first)

**What the app is**: A browser-based German grammar learning tool centered on sentence
structure. No framework, no build step — plain JS loaded via `<script>` tags in
[index.html](index.html). Three views share one SVG canvas:

1. **Feldermodell view** ([js/feldermodell.js](js/feldermodell.js), [js/renderer.js](js/renderer.js)) —
   words as colored/shaped tokens (color = gender, shape = case) placed in Vorfeld /
   Linke Klammer / Mittelfeld / Rechte Klammer / Nachfeld zones. Nebensätze flow vertically.
2. **Grid view** ([js/gridview.js](js/gridview.js)) — sentences parsed into noun-phrase
   "boxes" connected by arrows carrying verbs/prepositions. `parseSentenceFlow()` here is
   the shared clustering engine.
3. **Game mode** ([js/gamemode.js](js/gamemode.js), ~1830 lines) — mobile-oriented game:
   place noun phrases and conjugated verbs into a 3×3 grid (cells = pronoun/gender:
   masculine, du, feminine / neutral, ich, plural / ihr, wir, unused) choosing the right
   case controller (NOM/AKK/DAT/GEN). Has time-challenge, multi-category, story mode,
   and max-points settings. Spec: [GAME_MODE_SPEC.md](GAME_MODE_SPEC.md),
   architecture: [docs/gamemode_architecture.md](docs/gamemode_architecture.md).

**Backend** ([backend/app.py](backend/app.py), FastAPI + spaCy `de_core_news_sm`):
`/analyze` (POS/case/gender/clause detection), `/check-grammar` (proxies the public
LanguageTool API), `/word-info/{word}` (Wiktionary/dict.cc lookups). Deployed on Render
([backend/render.yaml](backend/render.yaml)); frontend hard-codes localhost vs. Render URL
detection in three places ([js/sentenceManager.js:315](js/sentenceManager.js#L315),
[js/app.js:523](js/app.js#L523), [js/ui.js:549](js/ui.js#L549)).

**Data**: [data/levels/](data/levels/) = plain sentence lists per level+category (A1, A2, B1).
[data/library/](data/library/) = the same sentences pre-analyzed (full word metadata), built
offline by [scripts/build_library_data.py](scripts/build_library_data.py) from manually
corrected exports in [data/saved/](data/saved/). At runtime the app prefers library data and
falls back to `/analyze` for unknown sentences.

**Persistence**: everything in `localStorage` (words, sentences, settings, scores).

**Testing**: backend has ad-hoc test scripts (`backend/test_*.py`, not pytest-structured);
frontend has **zero tests**.

**Known pain points a new agent should be aware of**:
- `gamemode.js` is a 1830-line god class; `app.js` (1187 lines) mixes controller,
  persistence, zoom/pan, and grammar-check UI.
- Backend URL logic duplicated 3×.
- Render free tier cold-starts (~50s) make `/analyze` fail for first-time custom sentences.
- No schema validation for the JSON data files; ids are raw timestamps.
- Global script-tag loading means implicit load-order coupling (see the `<script>` order
  at the bottom of [index.html](index.html) — it matters).

---

## Tier 1 — Revolutionary (product-defining)

### 1. Adaptive learning engine (error-driven spaced repetition)

**The single highest-leverage improvement.** The game already produces perfect telemetry:
every placement attempt is a labeled data point (word, expected cell, expected case,
chosen cell, chosen case, response time). Today that signal is thrown away — only a
score survives.

**What to build**:
- A `LearnerModel` module that records every attempt to `localStorage` (later: backend):
  `{ sentenceText, wordText, expected: {cell, case}, actual: {cell, case}, ms, ts }`.
- Aggregate into per-skill mastery scores. Skills are the natural axes of the game:
  gender recognition (m/f/n/pl), case selection (nom/akk/dat/gen), pronoun→cell mapping,
  verb conjugation per pronoun, and per-category (A1_dativ, B1_passiv, …).
- A sentence scheduler that replaces the current random/sequential queue: pick the next
  sentence to maximize exposure to the learner's weakest skills, with an SM-2-style
  spacing curve per skill (not per sentence — sentences are interchangeable carriers
  of skills).
- Tag each library sentence with the skills it exercises (extend the build script to
  derive tags automatically from the word metadata: contains dative object, contains
  separable verb, etc. — the data is already there in `data/library/*.json`).

**Files**: new `js/learnerModel.js`, new `js/scheduler.js`; hook into
`GameMode.validatePlacement()` and `startNewSentence()` in [js/gamemode.js](js/gamemode.js);
extend [scripts/build_library_data.py](scripts/build_library_data.py) for skill tags.

**Effort**: Large (3–5 sessions). **Dependencies**: none, but #8 (decompose gamemode.js)
makes it much easier. Do the attempt-logging part first — it's small, and data collection
should start as early as possible.

### 2. Weakness dashboard: the grid as a heatmap

The 3×3 grid is already a mental map of German pronouns/genders. Turn it into the
learner's progress report: a dashboard view where each cell is colored by error rate
(e.g. the learner discovers "I always misplace dative feminine"), plus per-case
controller accuracy, per-category mastery bars, streaks, and response-time trends.

This is the visible payoff of #1 and the emotional hook that makes people return.

**Files**: new `js/dashboard.js` + a fourth view state in [js/app.js](js/app.js)
(`currentView` already supports multiple views); reads from `LearnerModel`.

**Effort**: Medium (1–2 sessions). **Dependencies**: #1 (attempt logging).

### 3. LLM-powered infinite content (Claude API)

The library is hand-curated and finite (~25 categories × ~20 sentences). An LLM turns
it into an infinite, personalized stream:

- **Targeted sentence generation**: given the learner's weak skills from #1
  ("dative feminine nouns, separable verbs"), generate novel A2 sentences exercising
  exactly those, validated through the existing `/analyze` endpoint before use (spaCy
  acts as the correctness gate — reject sentences where the LLM's intended structure
  and spaCy's parse disagree).
- **Error explanations**: when a placement is wrong, a one-line contextual explanation
  ("*der Frau* is dative — *geben* takes a dative recipient") beats a red flash.
  Cache aggressively; most errors repeat.
- **Story mode generation**: story mode exists ([data/library/A1_story_neue_nachbarn.json](data/library/A1_story_neue_nachbarn.json));
  LLM can generate endless graded stories with controlled vocabulary.

**Architecture note**: put the LLM behind a new backend endpoint (`/generate-sentences`,
`/explain-error`) so the API key stays server-side. Use `claude-haiku-4-5-20251001` for
cost — these are short, structured tasks. Add strict JSON schema validation on responses
and always re-verify generated sentences via spaCy before inserting into the queue.

**Files**: [backend/app.py](backend/app.py) (new endpoints), new `backend/llm_content.py`,
frontend queue integration in [js/gamemode.js](js/gamemode.js).

**Effort**: Medium-Large (2–3 sessions). **Dependencies**: #1 for personalization
(but generic generation works standalone).

### 4. Word-order game mode ("Feldermodell mode")

The current game teaches **conjugation and case** but not the thing the app is named
after: **German word order**. A second game mode where the player drags/taps the
sentence's chunks into Feldermodell slots (Vorfeld → Linke Klammer → Mittelfeld →
Rechte Klammer → Nachfeld; vertical layout for Nebensätze) would teach V2 position,
verb-final subordinate clauses, and the Vorfeld-fronting flexibility that trips up
every German learner.

Almost everything needed already exists: `parseSentenceFlow()` for chunking,
`FeldermodellRenderer` for zone drawing, clause detection (`clause_type`/`clause_id`)
in both the backend and library data. The game shell (scoring, word bar, feedback
animations, sentence queue) can be shared with the existing mode.

**Killer variant**: show the sentence in canonical order, then ask the player to
*re-order* it with a fronted element ("Start this sentence with *Heute*…") — trains
the inversion reflex that no textbook drill achieves.

**Files**: new `js/feldGame.js`; extract shared game-shell utilities from
[js/gamemode.js](js/gamemode.js); mode selection UI in [index.html](index.html) /
[js/app.js](js/app.js).

**Effort**: Large (3–4 sessions). **Dependencies**: strongly benefits from #8 first.

### 5. Audio everywhere (TTS now, STT later)

Grammar drilled silently doesn't transfer to speech. The Web Speech API
(`speechSynthesis`, `de-DE` voices) is free, offline-capable, and zero-backend:

- Speak each sentence on completion in game mode (reinforces what was just built).
- Speaker button on every library sentence and every word token.
- **Listening mode**: play the sentence *before* showing it; the player builds what
  they heard. This converts the entire existing content library into listening
  comprehension exercises for free.
- Later: `SpeechRecognition` for a speaking mode (Chrome-only; treat as enhancement).

**Files**: new `js/speech.js` (thin wrapper: voice selection, rate control, queueing);
hooks in [js/gamemode.js](js/gamemode.js), [js/levelSelector.js](js/levelSelector.js), [js/ui.js](js/ui.js).

**Effort**: Small-Medium (1 session for TTS). **Dependencies**: none. **High
value-to-effort ratio — a good first pick.**

### 6. PWA + full offline operation

The app is static files + JSON + localStorage; the backend is only needed for *novel*
sentences. It should be an installable, offline-first PWA:

- `manifest.json` + service worker precaching the app shell and all of
  [data/library/](data/library/) (~small; it's text).
- Result: install to phone home screen, full game/library works in airplane mode —
  which is exactly where a mobile drill game gets used.
- Bonus: this mostly *solves the Render cold-start problem* for the common path,
  since library sentences never touch the backend.

**Files**: new `manifest.json`, `sw.js`, registration in [index.html](index.html);
cache-busting strategy for library data (a version stamp already exists in library JSON).

**Effort**: Small-Medium (1 session). **Dependencies**: none.

---

## Tier 2 — Foundational (multiplies the value of everything above)

### 7. Client-side sentence analysis (kill the backend dependency)

The Render free-tier cold start makes the "type any sentence" feature unreliable.
Options, in order of pragmatism:

1. **Expand the precomputed path** (cheap): batch-analyze large public corpora
   (Tatoeba has a German corpus; [backend/tatoeba_api.py](backend/tatoeba_api.py) already
   exists) offline into indexed static JSON — tens of thousands of sentences searchable
   client-side. Most users never leave curated content.
2. **Warm-up ping**: fire a `/health` request on page load so Render wakes before the
   user needs it. Trivial; do immediately.
3. **Full client-side NLP** (ambitious): run a compact German tagger in-browser.
   Realistic route: convert a distilled POS/morph model to ONNX and run via
   `onnxruntime-web` (WASM), with a rule layer for case/clause detection ported from
   `backend/app.py`'s logic. This makes the app 100% serverless and free to host forever.

**Effort**: option 2 trivial; option 1 Medium; option 3 Large/experimental.
**Dependencies**: none.

### 8. Decompose the god classes + ES modules

Prerequisite hygiene for #1/#3/#4. Current structure blocks parallel work:

- Convert `<script>` tags to ES modules (`type="module"`, explicit imports). No bundler
  needed — native ESM is fine for this size, keeps the zero-build-step property.
- Split [js/gamemode.js](js/gamemode.js) (~1830 lines) into: `gameShell.js` (queue,
  scoring, lifecycle, settings), `gridGame.js` (current 3×3 mechanic), `gameRenderer.js`
  (drawing), `controllers.js` (touch/gesture input). The per-frame `draw()` pipeline
  documented in [docs/gamemode_architecture.md](docs/gamemode_architecture.md) gives the natural seams.
- Split [js/app.js](js/app.js): extract `viewManager.js` (zoom/pan/view switching) and
  `backendClient.js` — **single home for the backend URL logic currently duplicated in
  3 files**.
- Add JSDoc `@typedef` for the core `Word` shape (it's implicitly defined in 6+ files).

**Effort**: Medium (2 sessions). **Dependencies**: none. Do before #1/#4 if possible.

### 9. Test harness + data schema validation

- Frontend: the pure logic is very testable — `parseSentenceFlow()`, noun-phrase
  clustering, `getWordPosition()`, placement validation. Node's built-in test runner
  (`node --test`) keeps the no-dependency ethos; requires #8 (modules) to import code.
- Backend: restructure `backend/test_*.py` into real pytest with fixtures; add golden
  tests for `/analyze` on ~30 representative sentences (each grammar category × 1).
- Data: JSON Schema for `data/levels/*` and `data/library/*`, validated in CI
  (GitHub Action) and in `build_library_data.py`. Catches hand-edit mistakes before
  they become silent game bugs.

**Effort**: Medium. **Dependencies**: #8 for frontend tests.

### 10. Sync + share (accounts-lite)

localStorage means progress dies with the browser. Minimum viable sync without real
account infrastructure:

- **Share via URL**: encode the current canvas state (words array) into a compressed
  URL fragment (`lz-string`) — makes the visualizer shareable with teachers/forums.
  Also listed in the README's future-enhancements; it's a genuine growth mechanic.
- **Progress export/import**: extend the existing sentence export
  ([js/app.js](js/app.js) already has export/import) to include learner-model data.
- Later: real sync via the backend + magic-link auth, enabling leaderboards and
  teacher dashboards (a teacher watching a class's grid heatmaps is a compelling
  classroom product).

**Effort**: Small (URL share + export) → Large (real accounts). **Dependencies**: #1
for progress data worth syncing.

---

## Tier 3 — Content & polish

### 11. Content expansion to B2/C1 + skill-tagged corpus
Extend levels/library with B2 (Konjunktiv II, erweiterte Partizipien, Nominalisierung)
and C1. Use #3's LLM pipeline plus human review via the existing correct-in-app →
export → `build_library_data.py` loop, which is a genuinely good human-in-the-loop
workflow already. Document that loop in the README (currently only discoverable by
reading the build script's docstring).

### 12. Onboarding & tutorial mode
The symbol system (color=gender, shape=case) is powerful but opaque for new users —
the legend modal is the only guide. Add a 60-second interactive tutorial: one guided
sentence in each view with coach marks. The game spec lists this as future work;
it is the #1 conversion blocker for any public launch.

### 13. Visual/UX modernization
- Export diagram as PNG/SVG (README wishlist; SVG canvas makes this ~easy via
  serialization + `canvas.toBlob`).
- Undo/redo (command stack in `WordManager` — all mutations already funnel through it).
- Keyboard shortcuts for the visualizer (power users / teachers on projectors).
- Dark mode (the CSS is one 2059-line file — consider CSS custom properties first).

### 14. Housekeeping (quick wins, do opportunistically)
- Remove stray root files: `output.md`, `check_localstorage.html`, `test_grouping.html`,
  `test_grammar.py` (move test HTML into a `dev/` folder if still useful).
- CORS: [backend/app.py:15](backend/app.py#L15) allows `*` — restrict to the real
  frontend origin in production.
- The spaCy auto-download at import time ([backend/app.py:22-28](backend/app.py#L22-L28))
  should move into the Docker build (it may already be in the Dockerfile — verify and
  remove the runtime fallback).
- Word ids are `Date.now()` timestamps — collision-prone when created in a loop;
  switch to a counter or `crypto.randomUUID()`.
- README is outdated: it describes only the visualizer, not grid view, game mode,
  library system, or backend. Rewrite after #8.

---

## Suggested execution order

For a sequence of independent agent sessions:

1. **#14 housekeeping + #7-option-2 warm-up ping** (half session, immediate wins)
2. **#5 TTS** (1 session, user-visible, zero risk)
3. **#8 modules + decomposition** (2 sessions, unlocks the rest)
4. **#1 learner model — logging first, then scheduler** (3 sessions)
5. **#6 PWA** (1 session)
6. **#2 dashboard** (1–2 sessions)
7. **#9 tests** (ongoing alongside)
8. **#3 LLM content** and **#4 word-order game** (the two big bets, in either order)

Each item should land as a separate commit/PR. When picking up an item, re-read the
"Current State" section and verify file paths still match — this document was written
2026-07-10 and the codebase will drift.
