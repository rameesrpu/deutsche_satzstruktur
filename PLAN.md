# Maintainability & Game-Mode Plan

> **Audience**: AI coding agents (and the owner) picking up work in a fresh conversation.
> Each item is self-contained — read "How to use this plan", then the item you pick.
> Written 2026-10-25. Supersedes the priorities in [IMPROVEMENTS.md](IMPROVEMENTS.md),
> which stays as a long-term idea backlog (its line counts are outdated).

## How to use this plan

1. Pick the **first unchecked item whose dependencies are all checked**. Do one item per conversation.
2. Read the item's *Context* and the files it lists before changing anything.
3. Verify using the item's *Done when* criteria. Once P0.2 exists, run the tests before and after.
4. Tick the checkbox, add a one-line note under the item (date, what changed, anything surprising),
   and commit. If you discover new work, add it as a new item rather than expanding scope.

**Usage context that drives priorities**: the owner almost only uses **game mode** with the
**pre-parsed library sentences** (`data/library/*.json`). The spaCy backend (`backend/`) is rarely
used — do not spend effort there unless an item says so.

**Environment notes**
- There is **no `node`** on the dev machine. `gjs` is available. Tests (incl. a syntax check of every
  `js/*.js`): `gjs -m tests/run.js` — see [tests/README.md](tests/README.md).
- Visual checks: `python3 -m http.server` + `google-chrome --headless=new --screenshot=out.png --virtual-time-budget=8000 <url>`.
- No build step, no framework. Scripts load via `<script>` tags at the bottom of [index.html](index.html);
  **order matters** until R4 is done.

---

## Phase 0 — Safety net (do first)

### [x] P0.1 Library data audit script + fix known bad entries
**Why**: game mode trusts library word metadata completely. Wrong `type`/`gender`/`number`
silently puts words in the wrong grid cell or drops them.

**Context**: grid placement is decided by `getWordPosition()` in [js/gridview.js:386](js/gridview.js#L386).
Subjects and objects/adjectives with no gender/number (and not an object pronoun like mich/dir)
silently fall back to the MASCULINE cell.

**Steps**
1. Add `scripts/audit_library.py` that loads every `data/library/*.json` and reports, per file + sentence:
   - objects/adjectives with no grid cell (no `number: "pl"`, gender not m/f/n, not an object pronoun),
   - subjects that would default to masculine,
   - subjects/objects with missing case,
   - duplicate `id`s within a file,
   - sentences without `words`.
   Exit non-zero if anything is found (so it can be used as a check).
2. Fix the entries found on 2026-10-25 (5041 words / 782 sentences scanned):
   - No grid cell: `sich` ×3 (A2_reflexivverben ×2, B1_infinitivkonstruktionen), `mehr` ×3
     (A2_futur1, A2_imperativ, B1_infinitivkonstruktionen), `viel` (B1_temporalsaetze),
     `wenig` (B1_zweiteilige_konnektoren), `sie` in "er sieht sie sofort" and `mich!,` in
     "freut mich!," (A1_story_der_herbstmarkt).
   - Wrongly tagged subject → masculine fallback: `Äpfel.` in "Ich kaufe zwei Kilo Äpfel."
     (A1_zahlen_zeit — should be plural akk object), `Herbst.`, `Lena,`, `Mmm`, `viel`
     (A1_story_der_herbstmarkt), `viel,` (A2_nebensatz).
   - Decide per word: retag (e.g. `sich`/`mehr`/`viel` → `other`), or set gender/number/case correctly.
3. Bump the `version` field of every library file you edit — otherwise browsers with existing
   `localStorage` will not pick up the corrected words (see `bulkLoadLibraryCategory` in
   [js/sentenceManager.js:215](js/sentenceManager.js#L215)).
4. Check whether [scripts/build_library_data.py](scripts/build_library_data.py) regenerates library
   files from `data/saved/`; if so, fix the source too or the fixes will be overwritten.

**Done when**: `python3 scripts/audit_library.py` exits 0; touched files have bumped versions.

> 2026-10-25 done. Fixes live in `scripts/library_corrections.py` (applied by `build_library_data.py`
> on rebuild — verified a rebuild reproduces them). 10 files bumped to version `2026-10-25`.
> `sich` → akk object with the subject's gender; quantifiers/interjections → `other`. `mich!,` fixed
> in JS instead (pronoun check in `getWordPosition` now strips *all* trailing punctuation).
> Surprise: word ids repeat across sentences in every library file (F1's bug baked in); harmless since
> the loader reassigns ids, so the audit only checks duplicates *within* a sentence. Also found 1
> extra (`Äpfel.` in A1_hauptsatz). Follow-up: P0.1b.

### [ ] P0.1b Objects tagged with case `nom`
9 object words have `case: "nom"` (e.g. `zehn Minuten`, `zwei Kilo,` in the Herbstmarkt story,
`Wohnung 7c,` in neue_nachbarn), and "Wie viel kostet ein Kilo Tomaten?" tags the subject
`ein Kilo Tomaten` as an akk object. Decide per word (predicative nominative → `subject`/`other`,
measure phrase → `akk`), add to `scripts/library_corrections.py`, optionally add an audit rule.

### [x] P0.2 JS logic test harness
**Why**: there are zero frontend tests, so agents cannot verify changes. This is the most important
enabler for every refactor below.

**Context**: the logic worth testing is pure-ish: `parseSentenceFlow()` and `getWordPosition()` in
[js/gridview.js](js/gridview.js), `validatePlacement()` / `getTimePoints()` in
[js/gamemode.js](js/gamemode.js). Classes are globals defined by plain scripts; constructors may
touch the DOM/SVG.

**Steps**
1. Create `tests/run.js` runnable with `gjs -m tests/run.js` (or plain `gjs tests/run.js`).
   Load source files by reading them and evaluating (as the syntax-check trick does), providing
   minimal stubs for `document`, `window`, `localStorage`, SVG elements as needed. Keep stubs in
   `tests/stubs.js`.
   - Fallback if gjs stubbing becomes painful: `tests/index.html` that runs the same test file in
     headless Chrome and prints results to the page title/console. Pick one approach and document it.
2. Tiny assertion helper (no dependencies): `test(name, fn)`, `assertEqual`, summary + non-zero exit.
3. Tests:
   - `getWordPosition` for: ich/du/wir/ihr subjects, er/sie/es nouns by gender, plural, sie_pl,
     object pronouns mich/dir, objects by gender.
   - `validatePlacement`: verb ignores case, object requires matching case, wrong cell fails.
   - **Golden snapshot over the whole library**: for every library sentence, run `parseSentenceFlow`
     and record boxes (text + cell) and connections into `tests/snapshots/library.json`.
     Test compares against the snapshot; a `--update` flag rewrites it. This catches any
     behavior change from refactors.
4. Add a `tests/README.md` (5 lines: how to run, how to update snapshot).

**Done when**: one command runs all tests and the library snapshot, passing on current `main`.

> 2026-10-25 done. `gjs -m tests/run.js` (ES modules, gjs 1.88) — 828 tests incl. syntax check of every
> `js/*.js` and 782-sentence snapshot; verified a corrupted snapshot fails with exit 1. Surprise: P0.1's
> context was wrong — objects/adjectives with no gender/number **also fall back to masculine**, not
> `null` (gridview.js ~line 474); only non-subject/object/verb types get `null`. Also: the PLAN's gjs
> syntax-check one-liner relies on deprecated `Uint8Array.toString()`; the harness uses TextDecoder.

### [x] P0.3 Add `CLAUDE.md`
**Why**: fresh agents need a short, always-loaded orientation instead of rediscovering structure.

**Steps**: write a concise (~40 lines) `CLAUDE.md` at repo root covering: what the app is; that game
mode + library data is the main path; file map (one line per `js/*.js`); word/sentence data shape
(point to R3 typedefs once done); how to run tests (P0.2) and the audit (P0.1); gjs syntax check;
headless screenshot workflow; conventions (CSS tokens in `:root` of [css/styles.css](css/styles.css),
SVG defs id prefixes `tok-`/`gv-`/`gm-`, game-mode CSS lives in the `GAME MODE VISUAL JUICE`
section at the end of styles.css); "don't touch `backend/` unless asked"; link to this PLAN.md.

**Done when**: file exists, every command in it was run once and works.
**Depends on**: P0.1, P0.2 (so the commands exist). Update it whenever later items change structure.

> 2026-10-25 done. All commands run once (tests, audit, headless screenshot at 400×850). Data shape
> is inline until R3 adds typedefs — then replace that section with a link.

---

## Phase 1 — Bug fixes

### [x] F1 Duplicate sentence/word IDs when the library bulk-loads
**Why**: likely causes wrong sentences to load and breaks "already played" tracking, especially in
multi-category mode. Diagnosed from code reading; not yet reproduced in a browser.

**Context**: `bulkLoadLibraryForLevels()` ([js/app.js:750](js/app.js#L750)) fetches all categories in
parallel. Each callback runs `bulkLoadLibraryCategory()`, which starts
`let idCounter = Date.now()` ([js/sentenceManager.js:221](js/sentenceManager.js#L221)) and consumes
~20 sentence ids + ~150 word ids. Callbacks fire milliseconds apart → overlapping id ranges.
`loadSentence(id)` uses `find()` ([js/sentenceManager.js:60](js/sentenceManager.js#L60)), so the first
match wins; game mode's `usedSentenceIds` is keyed by id.

**Steps**
1. Confirm first: in headless Chrome (or a gjs test with stubbed fetch), bulk-load several
   categories and count duplicate ids. Record the result in the item note.
2. Replace per-call `Date.now()` counters with one id source shared by the whole app
   (e.g. a `nextId()` helper using a module-level counter seeded from `Date.now()`, or
   `crypto.randomUUID()` — check that nothing compares ids numerically or relies on them
   being timestamps first; `grep -n "Date.now()" js/*.js`).
3. One-time migration on load: if stored sentences contain duplicate ids, reassign ids to the
   later duplicates (and their words), then save. Must be idempotent.
4. Add a test (P0.2 harness) that bulk-loads two categories "simultaneously" and asserts unique ids.

**Done when**: test passes; existing `localStorage` with duplicates is repaired on load; game mode
still loads and plays sentences (screenshot check).
**Depends on**: P0.2 (recommended, not strictly required).

> 2026-10-25 done. Confirmed: bulk-loading all 31 categories back to back gave 782 sentences with only
> 330 unique ids. New `js/ids.js` (`nextId()`, `reserveIdsAbove()`) replaces every `Date.now()` id
> (incl. wordManager.addWord and import-merge, whose word ids also overlapped). `SentenceManager.load()`
> and replace-import run `repairDuplicateIds()` (keeps first occurrence). Verified in headless Chrome
> with a seeded duplicate-id localStorage: repaired, 782/5041 unique after full bulk load, game starts.

---

## Phase 2 — Refactor for maintainability

Guiding rules: incremental, behavior-preserving, verified by the P0.2 snapshot after every step.
**No framework, no bundler, no TypeScript migration.** Don't refactor for looks — every step should
make a concrete upcoming item (I1–I3) easier.

### [ ] R1 Extract sentence selection into `js/sentencePicker.js`
**Why**: three near-duplicate loaders at the end of [js/gamemode.js](js/gamemode.js)
(`loadRandomSentenceAndContinue`, `loadNextSentenceInOrder`, `loadRandomSentenceMultiCategory`,
~200 lines) mix selection logic with UI refresh. I1/I2 need a clean place to add weighting.

**Steps**
1. Create a pure function/class: `pickNextSentence({ mode, sentences, currentId, usedIds,
   level, category, selectedLevels, batchState }) → { sentenceId, usedIds, batchState }`.
   No DOM, no `window.app`. Modes: `random-in-category`, `story` (in order, wraps),
   `multi-category` (5 per category, then switch), `custom`.
2. Game mode keeps one small method that calls the picker, then does `loadSentence`,
   `startNewSentence`, `updateSentenceList`, `redrawAll`, scroll-into-view (currently repeated 3×).
3. Unit-test every mode, including "all seen → reset but avoid the just-played one".
4. Add the `<script>` tag before `gamemode.js` in [index.html](index.html).

**Done when**: tests pass, game mode behavior unchanged in manual/screenshot check, gamemode.js
shrinks by ~150+ lines.
**Depends on**: P0.2.

### [ ] R2 Extract game rules into `js/gameRules.js`
**Why**: placement validation, scoring, time points and attempt/auto-place rules are interleaved
with rendering in `placeWord()` ([js/gamemode.js:1461](js/gamemode.js#L1461)). I3 (explanations) and
I1 (recording results) need these as plain data.

**Steps**
1. Move `validatePlacement`, `getTimePoints`, and the scoring/attempt decisions out of `placeWord`
   into pure functions. Have validation return a **reason object**, not just a boolean, e.g.
   `{ ok: false, cellOk: true, caseOk: false, expectedCase: 'dat', expectedCell: {row, col} }`.
2. `placeWord` becomes: call rules → update state → trigger feedback/animation/sound.
3. Unit-test rules (correct, wrong cell, wrong case, verb ignores case, 3-attempt auto-place, time points).

**Done when**: tests pass, behavior unchanged, `placeWord` is mostly orchestration.
**Depends on**: P0.2.

### [ ] R3 JSDoc typedefs for core data
**Why**: gives agents the data shape without reading many files.

**Steps**: add `js/types.js` (comments only, or loaded harmlessly) with `@typedef` for `Word`
(`id, type, text, gender, case, number, conjugation{pronoun}, clause_type, clause_id, x, y,
flowDirection`), `Sentence` (`id, text, words, source, level, category, createdAt`),
`LibraryFile` (`level, category, version, sentences`), `ParsedSentence` (boxes/connections/
leadingWords/trailingWords), and the R2 placement-result object. Reference them from function JSDoc
in gridview/gamemode/sentenceManager. List allowed enum values (types, cases, genders).

**Done when**: typedefs exist, are linked from CLAUDE.md, and match real library data
(spot-check with the audit script).

### [ ] R4 Migrate to ES modules (incrementally)
**Why**: removes implicit global coupling and `<script>` load-order dependence; makes each file
state its dependencies. No build step needed.

**Steps**
1. Start with leaf files (grammaticalConfig, levelContent, sound, sentencePicker, gameRules):
   `export` them, `import` where used, switch tags to `type="module"`.
2. Replace `window.app.*` reach-through in gamemode.js with explicit references passed into the
   constructor (sentenceManager, levelSelector, a `redraw` callback).
3. Keep `window.app` only as a debug handle.
4. Note: modules don't load over `file://` — the app must be served (already the case with
   `python3 -m http.server`). Update the P0.2 harness to import modules.

**Done when**: no file depends on script order; tests + screenshot pass.
**Depends on**: R1, R2 (smaller surface first). Can be split into several sessions — tick when finished.

### [ ] R5 Repo & release hygiene
**Steps**
1. Remove or move to `tools/`: `output.md`, `check_localstorage.html`, `test_grouping.html`,
   `test_grammar.py`, `backend/spacy_test.py` (ask the owner before deleting).
2. Ask the owner whether `data/saved/deutsch-sentences-2026-06-12.json` (personal export) should be in git.
3. Cache busting: replace the 12 hand-edited `?v=20260711o` strings in [index.html](index.html) with
   one source (e.g. a tiny `scripts/bump_version.sh`, or a single version constant if R4 is done).

**Done when**: root contains only real project files; bumping the version is one command.

### [ ] R6 (optional) Split remaining `gamemode.js` rendering
Only if still painful after R1/R2. Candidates: `drawUIOverlay` (~300 lines) → `gameHud.js`;
confetti/floating text/feedback loops → `gameJuice.js`. `draw()` clears and rebuilds the whole SVG
on every key press (arrow keys / case keys call `redrawAll`) — only optimize if jank is observed on
mobile.
**Depends on**: R2.

---

## Phase 3 — Game-mode improvements

### [ ] I1 Persist game progress across sessions
**Why**: score, streak and `usedSentenceIds` are in-memory only; nothing records what the learner
gets wrong. Foundation for I2 and I4.

**Steps**
1. New `js/progressStore.js` wrapping `localStorage` key `gameProgress` (wrap all access in
   try/catch). Per sentence key (use **level/category/text**, not the numeric id — ids are unstable,
   see F1): `{ plays, perfect, lastPlayed, mistakes: { case: {dat: n, ...}, cell: n } }`.
   Also lifetime totals: best score, best streak.
2. Record results from the R2 placement-result objects at sentence completion.
3. Include progress in the existing export/import if there is one (check app.js save/load).
4. Tests for the store (stub localStorage).

**Done when**: progress survives reload; tests pass.
**Depends on**: R2, F1.

### [ ] I2 "Review weak spots" mode
**Steps**: add a picker mode in `sentencePicker.js` that weights sentences by recent mistakes and
time since last played (simple spaced repetition: e.g. weight = mistakes × age factor; perfect plays
decay weight). Add a toggle next to the existing game settings (story / multi-category / time
challenge). Test the weighting deterministically (inject a random fn).
**Depends on**: R1, I1.

### [ ] I3 Explain mistakes in feedback
**Why**: currently a wrong placement only shows ✗. Learning happens when the learner sees *why*.

**Steps**
1. Using the R2 reason object + word metadata, generate a short message, e.g.
   "*mit* → always Dativ", "*Kinder* is plural → plural cell", "*du* → du cell",
   "Akkusativ after *für*". Keep a small preposition→case table (likely already implied in
   [js/grammaticalConfig.js](js/grammaticalConfig.js) — check before adding).
2. Show it in the existing feedback area (see `showFeedback`/floating text in gamemode.js);
   keep it short enough for mobile width.
3. Unit-test message generation.

**Done when**: wrong placements show a correct, specific hint; screenshot check on mobile width.
**Depends on**: R2.

### [ ] I4 Mastery per category in the level selector
**Steps**: show a small progress indicator (e.g. "12/20 mastered") per category in
[js/levelSelector.js](js/levelSelector.js), using I1 data. Mastered = last N plays perfect (pick N=2).
**Depends on**: I1.

### [ ] I5 Handle missing German TTS voice
**Context**: [js/sound.js](js/sound.js) picks a voice whose lang starts with `de`; many browsers
(notably Chrome on Linux) have none, so speech and audio fill-in-the-blank silently do nothing.
**Steps**: after `voiceschanged`, if no German voice exists, show a one-time notice and
disable/grey out the audio-dependent options instead of failing silently.
**Depends on**: none.

---

## Explicitly deferred (low value for current usage)

Backend work: CORS config, baking the spaCy model into the Docker image, LanguageTool rate-limit
handling, larger spaCy models, duplicated backend-URL detection in
[js/app.js:613](js/app.js#L613) / [js/sentenceManager.js:315](js/sentenceManager.js#L315).
Revisit only if the owner starts using custom sentences again.
