# Deutsche Satzstruktur

Browser app for learning German sentence structure: words are drawn as colored symbols in a
3×3 pronoun/gender grid (grid view), in the Feldermodell, and in a **game mode** where the learner
places each phrase in the right cell with the right case. Plain HTML/CSS/JS — no build, no framework.

**Main path**: game mode + pre-parsed library sentences (`data/library/*.json`), led by the
**story chapters** (A1 "Ein Zuhause in Stuttgart": `data/stories/`, see its CURRICULUM.md and STORY_BIBLE.md). The spaCy backend
(`backend/`) is rarely used — **don't touch `backend/` unless asked.** Work items: [docs/story-plan.md](docs/story-plan.md), the UI redesign
[docs/redesign-plan.md](docs/redesign-plan.md) (design decisions + mockup link; grammar colors come only from
`GRAMMAR_PALETTE` in grammaticalConfig.js) and the learning experience plan [docs/experience-plan.md](docs/experience-plan.md) (finished maintainability plan: [docs/archive/](docs/archive/)).

## Files (`js/`, ES modules — entry `app.js`; each file imports what it uses)
- `types.js` — JSDoc typedefs only (Word, Sentence, LibraryFile, ParsedSentence, PlacementResult…; not loaded)
- `ids.js` — `nextId()`: the one source of sentence/word ids (never use `Date.now()` as an id)
- `sound.js` — SoundManager: Web Audio effects + German text-to-speech (`detectGermanVoice`: speech options greyed out when no German voice);
  pure `placementSpeech()`: a correct placement speaks only its phrase ("Satz aufbauen", `gameSpeechBuildUp`, off: the growing prefix)
- `grammaticalConfig.js` — gender/number/pronoun properties and colors
- `levelContent.js` — `LEVEL_CONTENT`: levels → categories → sentence-list files (`data/levels/`; pre-parsed twins in `data/library/`);
  story chapters/drills are merged in first from `storyContent.js` (generated — don't edit) with `story` metadata; `chapterOrder()`
- `levelSelector.js` — level/category picker UI (story optgroups, chapters locked until the previous one is played) and sentence list
- `storyNarration.js` — story chapters in game mode: pure beat helpers + the narration card (`showStoryCard`)
- `glossary.js` — tap-to-translate: `glossTokens()` (pure; mirrors `glossary_matches` in build_stories.py) and the word popover
- `homeScreen.js` — learner screens Home (Lernen) / Üben / Wörter: pure helpers (chapter status, today's count,
  weak spots) + `renderHome/renderPractice/renderWords`; the screen router (`showScreen`) is in app.js
- `settings.js` — learner settings screen (Einstellungen: Ton, Aussprache, Satz aufbauen, Hörübung, Zeitdruck, Tagesziel) + daily goal / time challenge persistence; pure `parseDailyGoal`, `goalProgress`, `settingsRows`
- `storyReader.js` — full-screen chapter reader (📖 next to the category select, "Erst lesen" on a chapter's first card)
- `wordManager.js` — word data model of the current sentence
- `sentenceManager.js` — all sentences, localStorage persistence, library bulk-load
- `feldermodell.js` — Feldermodell (field model) renderer
- `gridview.js` — GridViewModel: `parseSentenceFlow()` (phrase boxes) and `getWordPosition()` (grid cell)
- `sentencePicker.js` — `pickNextSentence()`: pure next-sentence selection (random / story / multi-category / custom / review weak spots)
- `gameRules.js` — pure placement rules: `evaluatePlacement()` (validation reason object, points, attempts/auto-place),
  `explainMistake()` (short why-wrong hints; preposition→case table), `articleFor()` (gender + case → der/den/dem/des…),
  `placementFeedback()` (play screen feedback bar text), `predicateVerb()` (predicate noun tagged `S`: "nach „ist“ → Nominativ")
- `progressStore.js` — `progressStore`: persisted game progress (localStorage `gameProgress`, per sentence keyed level/category/text; lifetime bests; `isMastered`); included in sentence export/import
- `gamemode.js` — GameMode: placement game state, grid/controllers drawing, input, sentence flow (largest file)
- `gameHud.js` — `drawHud(game)`: word bar (score pill, streak, current/auto/next words, timer bar), complete card; `GM_UI` colors
- `chapterRecap.js` — chapter-end recap screen (`body[data-screen="end"]`): pure helpers (stats, hard sentences,
  word chips) + `renderRecap`; GameMode records the run (`run`, `recordMiss`), app.js `showRecap`
- `felderLesson.js` — pure `felderLesson(words)` → `{kind, hint, parts}` or null: the field model opens on its own after a
  solved play-screen sentence only when it teaches (two-part verb, non-subject before the verb, subordinate clause);
  `lessonAutoShow()`: each kind at most `LESSON_AUTO_MAX` (3) times per chapter, then the "Satzbau" link
- `gameJuice.js` — display-only effects: SVG defs, confetti, floating text, ✓/✗ feedback, final celebration overlay
- `playScreen.js` — full-screen play screen chrome (HTML around the SVG grid on `body[data-screen="play"]`): top bar
  (close, segmented progress, score), story strip (`#play-story`: up to 2 narration lines + "mehr"), sentence with the framed
  phrase, feedback bar (`placementFeedback` in gameRules.js), case tray; solved: "Weiter" + quiet "Satzbau" link; pure `progressSegments()` / `sentenceParts()`. The Werkstatt game keeps the SVG HUD (gameHud.js)
- `renderer.js` — SVG drawing of words/connections in edit view
- `ui.js` — UIController: editor panels and interactions
- `app.js` — DeutschApp: wires everything together, screen router (`showScreen`: body[data-screen], bottom nav;
  the editor is the Werkstatt screen), backend calls, import/export. Passes GameMode a
  `host` ({sentenceManager, levelSelector, redraw, setView, updateSentenceList}); `window.app` is a debug handle only

## Data
- Shapes and allowed enum values (Word, Sentence, LibraryFile, ParsedSentence, placement results):
  [js/types.js](js/types.js). Keep it in sync when adding a field or value.
- Library file: `{ level, category, version, sentences: [{ text, words }] }`. **Bump `version` when
  editing a file**, or browsers with existing localStorage keep the old words.
- Story chapters: edit `data/stories/<level>/*.json` (hand-tagged words, format in CURRICULUM.md), then
  `python3 scripts/build_stories.py` → `data/levels/A1_g<s>k<c>[_uebung].json`, their `data/library/`
  twins (version = content hash, no manual bump) and `js/storyContent.js`. Word meanings (English) go in
  the story file's `glossary`; each chapter file gets the entries it uses.
- Grammar library files are generated by `scripts/build_library_data.py` from the export in `data/saved/`
  (keep it in git — it's the build source); manual word fixes go in `scripts/library_corrections.py`
  (applied on rebuild).

## Commands
- Tests (syntax check of all `js/*.js`, unit tests, library snapshot; needs `python3` for the build-script checks): `gjs -m tests/run.js`
  — after an intended behavior/data change: `gjs -m tests/run.js --update` and review the diff. See [tests/README.md](tests/README.md).
- Library data audit: `python3 scripts/audit_library.py` (exit 0 = clean)
- There is **no `node`**; use `gjs`.
- Visual check: `python3 -m http.server 8000` then
  `google-chrome --headless=new --screenshot=out.png --window-size=400,850 --virtual-time-budget=8000 http://localhost:8000/`

## Conventions
- CSS colors/spacing are tokens in `:root` of `css/styles.css`; SVG attributes can't use `var()`, so
  JS mirrors them as hex constants (e.g. `GM_UI` in gamemode.js).
- SVG `<defs>` ids are prefixed per owner: `tok-`, `gv-` (grid view), `gm-` (game mode).
- Game-mode CSS lives in the `GAME MODE VISUAL JUICE` section at the end of styles.css.
- Cache busting: the import map in index.html adds `?v=...` to every module (plus the entry script
  and styles.css link); bump all of them with `scripts/bump_version.sh [version]` when shipping JS/CSS
  changes. A new module needs its own import-map line (tests check this). Modules need http, not `file://`.
- `tools/` holds old dev/debug helpers (localStorage inspector, grouping test page, backend checks).
