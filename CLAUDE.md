# Deutsche Satzstruktur

Browser app for learning German sentence structure: words are drawn as colored symbols in a
3×3 pronoun/gender grid (grid view), in the Feldermodell, and in a **game mode** where the learner
places each phrase in the right cell with the right case. Plain HTML/CSS/JS — no build, no framework.

**Main path**: game mode + pre-parsed library sentences (`data/library/*.json`), led by the
**story chapters** (A1 "Ein Zuhause in Stuttgart": `data/stories/`, see its CURRICULUM.md and STORY_BIBLE.md). The spaCy backend
(`backend/`) is rarely used — **don't touch `backend/` unless asked.** What comes next and why: [docs/roadmap.md](docs/roadmap.md) (each
project's design and plan: `docs/superpowers/specs/`, `docs/superpowers/plans/`). Work items: [docs/story-plan.md](docs/story-plan.md), the UI redesign
[docs/redesign-plan.md](docs/redesign-plan.md) (design decisions + mockup link; grammar colors come only from
`GRAMMAR_PALETTE` in grammaticalConfig.js) and the learning experience plan [docs/experience-plan.md](docs/experience-plan.md) (finished maintainability plan: [docs/archive/](docs/archive/)). The review ladder ("Heute üben", rungs 2–5): spec
[docs/superpowers/specs/2026-11-15-production-ladder-design.md](docs/superpowers/specs/2026-11-15-production-ladder-design.md), plan
[docs/superpowers/plans/2026-11-15-production-ladder.md](docs/superpowers/plans/2026-11-15-production-ladder.md); rungs 4 Schreiben and 5 Sprechen: spec
[docs/superpowers/specs/2026-11-16-ladder-write-speak-design.md](docs/superpowers/specs/2026-11-16-ladder-write-speak-design.md), plan
[docs/superpowers/plans/2026-11-16-ladder-write-speak.md](docs/superpowers/plans/2026-11-16-ladder-write-speak.md); picture boards ("Bilder" on Üben): spec
[docs/superpowers/specs/2026-11-16-spatial-boards-design.md](docs/superpowers/specs/2026-11-16-spatial-boards-design.md), plan 4a (framework + body map)
[docs/superpowers/plans/2026-11-16-boards-body-map.md](docs/superpowers/plans/2026-11-16-boards-body-map.md), plan 4b (preposition scene)
[docs/superpowers/plans/2026-11-16-boards-preposition-scene.md](docs/superpowers/plans/2026-11-16-boards-preposition-scene.md), plan 4c (timeline)
[docs/superpowers/plans/2026-11-16-boards-timeline.md](docs/superpowers/plans/2026-11-16-boards-timeline.md); Klinik (medical track, 5a maps and terms): spec
[docs/superpowers/specs/2026-11-16-medical-track-design.md](docs/superpowers/specs/2026-11-16-medical-track-design.md), plan
[docs/superpowers/plans/2026-11-16-klinik-maps-terms.md](docs/superpowers/plans/2026-11-16-klinik-maps-terms.md); 5b Anamnese, Arztbrief, FSP practice: plan
[docs/superpowers/plans/2026-11-16-klinik-anamnese-fsp.md](docs/superpowers/plans/2026-11-16-klinik-anamnese-fsp.md).

## Files (`js/`, ES modules — entry `app.js`; each file imports what it uses)
- `types.js` — JSDoc typedefs only (Word, Sentence, LibraryFile, ParsedSentence, PlacementResult…; not loaded)
- `ids.js` — `nextId()`: the one source of sentence/word ids (never use `Date.now()` as an id)
- `sound.js` — SoundManager: Web Audio effects + German text-to-speech (`speak(text, {queue, rate, force})`; `hasGermanVoice()`; `detectGermanVoice`: speech options greyed out when no German voice);
  pure `placementSpeech()`: a correct placement speaks only its phrase ("Satz aufbauen", `gameSpeechBuildUp`, off: the growing prefix)
- `grammaticalConfig.js` — gender/number/pronoun properties and colors
- `levelContent.js` — `LEVEL_CONTENT`: levels → categories → sentence-list files (`data/levels/`; pre-parsed twins in `data/library/`);
  story chapters/drills are merged in first from `storyContent.js` (generated — don't edit) with `story` metadata; `chapterOrder()`
- `levelSelector.js` — level/category picker UI (story optgroups, chapters locked until the previous one is played) and sentence list
- `storyNarration.js` — story chapters in game mode: pure beat helpers + the narration card (`showStoryCard`)
- `glossary.js` — tap-to-translate: `glossTokens()` (pure; mirrors `glossary_matches` in build_stories.py) and the word popover
- `ladder.js` — pure review schedule of the production ladder (also `rungEligibility(words, env)`: which rungs a sentence can be tested on; env `{voice, write, speak}` gates rungs 4/5): `enterLadder`, `afterReview(entry, ok, now, eligible)`, `exerciseRung`,
  `dueKeys(sentences, now, cap)`, `migrate` (existing sentences join at the daily goal per day; progressStore passes it), day helpers; rungs 2–5 (5 = top, `RUNG_TOP`), `PASS_DAYS`, `TOP_DAYS`
- `fieldZones.js` — pure `fieldZones(words)` → `{lead, vorfeld, verb, mittelfeld, ende}` word indices or null (not a plain main clause); built on the `felderLesson.js` clause helpers; snapshot `tests/snapshots/field-zones.json`
- `orderExercise.js` — pure rung-2 "Ordnen" logic: `orderModel(words)` (phrase chips per field, null if not eligible), `createOrder`, `dropChip`, `isSolved`, `fieldChips`; Mittelfeld order is never tested
- `articleBlank.js` — pure rung-3 logic: `articleIndexes`, `blankArticles(words, from)` (articles → "___" until their phrase is placed), `hasArticle`
- `orderScreen.js` — Ordnen screen (`body[data-screen="order"]`, rung 2): `renderOrderScreen` taps chip → field slot; reuses play-screen bar/feedback classes
- `textMatch.js` — pure answer matching for rungs 4–5: `tokens`, `fold` (case/umlaut folding), `compareTyped(expected, typed)` (per-word marks), `speechMatch(expected, heard)` (alternatives, `SPEECH_PASS`)
- `speechInput.js` — Web Speech recognition wrapper: `speechAvailable(win)`, `listen({lang, maxAlternatives, win})` → promise of alternatives
- `writeScreen.js` — Schreiben screen (`body[data-screen="write"]`, rung 4, dictation): `renderWriteScreen(root, {text, translation, total, index}, {onDone(ok), onClose})`; pure `writeStep`, `retryText`, `WRITE_TRIES`
- `speakScreen.js` — Sprechen screen (`body[data-screen="speak"]`, rung 5): `renderSpeakScreen(root, {text, translation, total, index, storage, win}, {onDone(ok), onClose})`, recognised or self-check mode; pure `speakMode`, `speakStep`
- `reviewRunner.js` — `ReviewRunner`: the "Heute üben" session (queue → rung 2 on the order screen, rung 3 in GameMode with `articleBlank`/`ladder`, rung 4 on the write screen, rung 5 on the speak screen (`translationFor` dep), `progressStore.recordReview`, review recap); pure `buildQueue(keys, find, getRung, isCategoryLoaded, env)`, `keyCategory`
- `homeScreen.js` — learner screens Home (Lernen) / Üben / Wörter: pure helpers (chapter status, today's count,
  `reviewTile`/`practiceReviewButton`: the "Heute üben" tile with the due count, replacing weak spots) + `renderHome/renderPractice/renderWords`; the screen router (`showScreen`) is in app.js
- `settings.js` — learner settings screen (Einstellungen: Ton, Aussprache, Satz aufbauen, Hörübung, Schreiben üben, Sprechen üben, Spracherkennung, Zeitdruck, Tagesziel) + daily goal / time challenge persistence; pure `parseDailyGoal`, `goalProgress`, `settingsRows`, `ladderEnv({storage, hasVoice})` → `{voice, write, speak}`
- `storyReader.js` — full-screen chapter reader (📖 next to the category select, "Erst lesen" on a chapter's first card)
- `wordManager.js` — word data model of the current sentence
- `sentenceManager.js` — all sentences, localStorage persistence, library bulk-load
- `feldermodell.js` — Feldermodell (field model) renderer
- `gridview.js` — GridViewModel: `parseSentenceFlow()` (phrase boxes) and `getWordPosition()` (grid cell)
- `sentencePicker.js` — `pickNextSentence()`: pure next-sentence selection (random / story / multi-category / custom / review weak spots; the ladder review uses ladder.js instead)
- `gameRules.js` — pure placement rules: `evaluatePlacement()` (validation reason object, points, attempts/auto-place),
  `explainMistake()` (short why-wrong hints; preposition→case table), `articleFor()` (gender + case → der/den/dem/des…),
  `placementFeedback()` (play screen feedback bar text), `predicateVerb()` (predicate noun tagged `S`: "nach „ist“ → Nominativ")
- `progressStore.js` — `progressStore`: persisted game progress (localStorage `gameProgress`, per sentence keyed level/category/text; lifetime bests; `isMastered`); format version 2 adds ladder `rung`/`due` per sentence (`recordSentence(key, mistakes, now, eligible)` enters the ladder, `recordReview`, `retire`, migration on load); format 3 adds `boards` (board item entries by `boardKey`; `recordBoard(key, ok, now)`; older files load with `boards: {}`); included in sentence export/import (import treats only `version < 2` as an old file: rungs exist since 2)
- `gamemode.js` — GameMode: placement game state, grid/controllers drawing, input, sentence flow (largest file); review-ladder hooks: `articleBlank` flag (rung 3, `displayItemText`) and `ladder` ({total, index, record, next}) replacing the normal progress/ending
- `gameHud.js` — `drawHud(game)`: word bar (score pill, streak, current/auto/next words, timer bar), complete card; `GM_UI` colors
- `chapterRecap.js` — chapter-end recap screen (`body[data-screen="end"]`): pure helpers (stats, hard sentences,
  word chips) + `renderRecap`; `reviewRecapModel`/`renderReviewRecap` for the "Heute üben" end screen; GameMode records the run (`run`, `recordMiss`), app.js `showRecap`
- `felderLesson.js` — also the shared word helpers `normalizeLegacyType`, `isNounPhraseWord`, `phraseContinuation` (noun phrase: article, up to 2 adjectives, noun); pure `felderLesson(words)` → `{kind, hint, parts}` or null: the field model opens on its own after a
  solved play-screen sentence only when it teaches (two-part verb, non-subject before the verb, subordinate clause);
  exports its clause helpers (`bare`, `isFiniteVerb`, `clauseStart`, `findBracket`…) for fieldZones.js; `lessonAutoShow()`: each kind at most `LESSON_AUTO_MAX` (3) times per chapter, then the "Satzbau" link
- `gameJuice.js` — display-only effects: SVG defs, confetti, floating text, ✓/✗ feedback, final celebration overlay
- `playScreen.js` — full-screen play screen chrome (HTML around the SVG grid on `body[data-screen="play"]`): top bar
  (close, segmented progress, score), story strip (`#play-story`: up to 2 narration lines + "mehr"), sentence with the framed
  phrase, feedback bar (`placementFeedback` in gameRules.js), case tray; solved: "Weiter" + quiet "Satzbau" link; pure `progressSegments()` / `sentenceParts()` / `playSentenceTexts(game)` (blanked articles in rung 3). The Werkstatt game keeps the SVG HUD (gameHud.js)
- `boardSchedule.js` — pure five-box schedule of picture practice: `BOX_DAYS`, `SESSION_SIZE` 10, `NEW_PER_SESSION` 5, `afterAnswer`, `pickSession`, `setProgress`
- `boardSession.js` — pure queue of one board session: only an item's first answer counts, a wrong item comes back once at the end (`createSession`, `answer`, `sessionDone`, `sessionResults`)
- `boards.js` — `BOARDS` registry (id, title, kind, file, `version` mirrored from the data file, modes), `boardKey`, `loadBoard` (`?v=` URL), `isSetLocked`, `setModes`, `boardSummary` ("n von N gelernt", due count), `reviewStart` ("Wiederholen (n)"); pure `KINDS` / `registerKind` and `itemIdsFor(board, set, modeId)` (the kind's `itemIds(set, modeId)` hook when it has one, else the item ids; summary, review and session use it)
- `boardScreen.js` — board screen (`body[data-screen="board"]`): set list (locked sets "Nach „5.1 Gute Besserung“"), set view with mode buttons, practice session chrome; re-exports `KINDS` / `registerKind`; `renderBoardScreen` returns a teardown
- `hotspotBoard.js` — board kind `hotspot` (body map; also the ward `station`: rooms floor plan + team diagram, modes from its BOARDS entry): pure noun parsing, nearest-spot hit test (a tap far from every spot is "no answer"), naming options, `painSentence(item, usePlural)` (`pair` items drive the plural pain sentence via `painUsesPlural`), `tapTargets`/`tapIsRight` (mirror sets accept the other side of `pair` items; `accepts` lets bein take its parts); modes Entdecken, Zeigen, Benennen, Wo tut es weh?
- `sceneBoard.js` — board kind `scene` (Wo? Wohin?, preposition scene): pure `sceneSentence`/`articleBlank`/`sentenceSegments` builders (the blank covers a contracted word: `ins`/`im`, `an den`/`am`; two landmarks change together), `itemIds` hook (movement-only items have no Wo? id); the hen walks (arrow = Wohin?) or rests (dot = Wo?), "hinter" by occlusion; modes Entdecken, Verstehen, Artikel, Satz
- `timelineBoard.js` — board kind `timeline` (Die Zeit): pure `timeSentence`/`clampFrame`/`clampSentence`/`auxHint`, `itemIds` hook (Wann? ids `<verb>.past|now|future`), no picture file (line and clamp in HTML/CSS); modes Wann?, Klammer, haben oder sein?
- `klinik.js` — Klinik screen (`body[data-screen="klinik"]`, from the Üben card "Klinik"): `KLINIK_ROUTE_FILE`, `KLINIK_ROUTE_VERSION` (must equal `data/medical/approbation.json` `version`; a test checks it), `KLINIK_STORAGE_KEY` (`klinikRoute`, ticked station ids), `KLINIK_TILES` (a tile whose board is not in `BOARDS` or is `soon` shows "Kommt bald"); pure `tileMode`, `routeState(stations, doneIds)`, `toggleStation`, `loadDone`/`saveDone`; `renderKlinik` (tiles), `renderRoute` (vertical route, station cards German + English line, official source link; the Stand line shows the oldest `checked` date; an unreachable route file leaves the route tile "Gerade nicht verfügbar." (`routeNote`)); boards opened from Klinik close back to Klinik; 5b: the Anamnese/Arztbrief/FSP tiles open menus (`renderAnamneseMenu`: Fragen sortieren, Gespräch; `renderCaseList`, `renderLetter`; tile `open` = `anamnese`/`arztbrief`/`fsp`), `ANAMNESE_FILE`/`ANAMNESE_VERSION` (must equal `data/medical/anamnese.json` `version`; a test checks it), pure `questionSortModel(anamnese, rng, size)` (10 random questions as chips, the sections as zones)
- `sortExercise.js` — pure "sort chips into labelled zones" (Klinik: Anamnese questions, Arztbrief sentences): `createSort`, `dropOnZone` (a chip may fit several zones; after `MAX_WRONG_ATTEMPTS` wrong drops it is auto-placed in its first zone), `sortSolved`, `zoneChips`
- `sortScreen.js` — sort screen (`body[data-screen="sort"]`): tap a chip, then a zone; `renderSortScreen(root, {model, total, index, hint}, {onDone, onClose})`; the tray is a sticky bottom dock (own scroll) so it stays reachable; reuses the Ordnen bar/feedback classes
- `caseFlow.js` — pure logic of Klinik cases (`data/medical/faelle/`): `CASES_INDEX_VERSION`, `caseUrl(entry)` (`?v=`), `interviewSteps(case, anamnese, rng)`, `formState`, `interviewScore`, `briefSortModel`/`briefHint(chip, zone, gender)`/`letterSections`, `patientNoun(gender)`, and the FSP run: `EXAM_PARTS` (3 parts, 20 min each), `examState`/`examSummary`/`examSections`, `RATINGS` (Passt/Teilweise/Noch nicht), draft storage `fspDraft/<caseId>` (`loadDraft`/`saveDraft`/`clearDraft`)
- `caseScreen.js` — case screen (`body[data-screen="case"]`): `renderInterview` (Gespräch: patient card, Anamnesebogen filling as she picks question and note; optional resumable `clock`, returns a teardown) and `renderExam` (FSP run: Gespräch, Dokumentation with model text and self-rating, Arzt-Arzt-Gespräch; saves the draft on leaving; leaving in part 1 restarts the interview (the clock is kept), parts 2–3 resume); 🔊 buttons (`Anhören`) always speak, automatic speech follows "Aussprache"; no free-text or speech grading
- `pairsBoard.js` — board kind `pairs` (Fachsprache ↔ Alltagssprache): pure `choiceOptions(items, id, side, rng)`, `pairRound(items, rng)`, `isPair`, `displayOf`/`speechOf` (article + noun, no "(pl.)"); modes Paare (match tiles), Für den Patienten (fach → alltag), Für die Kollegin (alltag → fach)
- `renderer.js` — SVG drawing of words/connections in edit view
- `ui.js` — UIController: editor panels and interactions
- `app.js` — DeutschApp: wires everything together, screen router (`showScreen`: body[data-screen], bottom nav; `klinik` = Klinik, `openKlinik`, reached from the Üben card "Klinik";
  the editor is the Werkstatt screen; `order` = Ordnen, `write` = Schreiben, `speak` = Sprechen, `board` = Bilder (reached from Üben, nav hidden, teardown on leave), `sort` = shared sort screen (`sortQuestions` in `openKlinik`, `openBrief`), `case` = case screens (`openCase` Gespräch, `openExam` FSP; `caseTeardown` on leave); `startLadderReview`, `showReviewRecap`), backend calls, import/export. Passes GameMode a
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
  Optional chapter pictures show places, not people: `data/stories/<level>/img/<place>.svg|webp`, chosen
  by the chapter's `"image": {"place", "alt"}` and shared across chapters and higher levels (see CURRICULUM.md).
- Writing or revising a chapter: follow [data/stories/AUTHORING.md](data/stories/AUTHORING.md) step by step
  (project skill `write-chapter` in `.claude/skills/`; two owner stops: outline, review sheet).
- Boards (picture practice): `data/boards/<id>.json` (`version`, `kind`, `sets` with optional `modes`/`unlock`, items with
  `pair: true` for parts a person has several of, `accepts` ids that also answer an item; `area: [x, y, w, h]` percent rect = the item's whole drawn place answers a tap, smallest nested area wins, e.g. ward rooms; a set's `mirror: true` = symmetric picture, tap modes accept the mirrored spot; `wide: true` = landscape 400×300 hotspot picture, else 300×400) and pictures `data/boards/img/<name>.svg` (no text, ≤ 40 KB, `.txt` = the drawing brief).
  Adding a board: data file + picture(s), a `BOARDS` entry in `js/boards.js` (version must equal the file's — a test checks it; bump both on edit),
  and a kind renderer registered with `registerKind` if the `kind` is new (`hotspotBoard.js` is the model; a kind may define `itemIds(set, modeId)` when its practice ids are not the item ids, as `sceneBoard.js` does).
  Scene sets (`kind: "scene"`): `mover` (`de`, `image`, `home`), `landmarks` (`de`, optional `front` rect for "hinter" occlusion),
  items with `prep`, `landmark`, `landmark2`, `spot` and `verbs` (`wo: null` = movement only, e.g. über den Zaun).
  Timeline sets (`kind: "timeline"`): `items` are verbs with `inf`, `aux`, `partizip`, `wrong`, `person`, `subject`, `finite`, optional `particle`, `rest`.
- Klinik (medical track): `data/medical/approbation.json` = `{version, region, stations}`, a station is
  `{id, title, what (de), en, terms:[{de,en}], documents, duration, cost, authority, optional, source (official https URL), checked (YYYY-MM-DD)}`.
  **Route data needs an official source URL and a `checked` date per station**, no statement about licensing/exams/authorities without them; bump `version` and `KLINIK_ROUTE_VERSION` in `js/klinik.js` together (a test checks they are equal).
  Sources, quotes and doubts: [docs/medical-sources.md](docs/medical-sources.md); owner review sheets in `docs/review/5a-*.md`. Medical content is "not yet checked by a doctor".
  5b data: `data/medical/anamnese.json` = `{version, sections: [{id, title, en, questions: [{id, de, en, also?}]}]}` (seven sections in interview order; `also` = other sections the question fits; bump `version` and `ANAMNESE_VERSION` in `js/klinik.js` together).
  Cases: `data/medical/faelle/<id>.json` + `index.json` (`{version, cases: [{id, title, level, version}]}`; files are fetched with `?v=<version>`, the index with `CASES_INDEX_VERSION`; any change to a case raises its `version`, its index entry AND the index `version` together with `CASES_INDEX_VERSION` — a cached index would otherwise keep the old `?v=`). A case: `patient` (`name, age, job, gender 'f'|'m', en`), `interview` steps (question id, `wrong` question ids, `answer`/`fact`/`distractors` each `{de, en}`), `brief` (Arztbrief sentences by section), `dokumentation` (model text + `en` per Anamnese section), `vorstellung` (skeleton and model, each with an English twin); every German string has an English `en`; shape in js/types.js, checks in tests/caseFlow.test.js. Writing one: data/stories/AUTHORING.md, "Writing a case".
  **Every case and every question list is reviewed by a doctor before it ships;** review sheets in `docs/review/5b-*.md` (German with English, headed "Medical content — not yet checked by a doctor"). Practice-run draft: localStorage `fspDraft/<caseId>`.
  Board kind `pairs` (`data/boards/fachbegriffe.json`): items `{id, fach, alltag, en, twin?}` (`fach`/`alltag` with article, `(pl.)` marks plural-only; `twin` = id of the opposite pair, e.g. Hyper-/Hypotonie, preferred as a wrong option); a term pair needs a dictionary source (DocCheck Flexikon; articles also Duden/DWDS), unconfirmable pairs are dropped, not guessed.
- Grammar library files are generated by `scripts/build_library_data.py` from the export in `data/saved/`
  (keep it in git — it's the build source); manual word fixes go in `scripts/library_corrections.py`
  (applied on rebuild).

## Commands
- Tests (syntax check of all `js/*.js`, unit tests, library snapshot; needs `python3` for the build-script checks): `gjs -m tests/run.js`
  — after an intended behavior/data change: `gjs -m tests/run.js --update` and review the diff (incl. the snapshots `felder-lessons.json`, `field-zones.json`). See [tests/README.md](tests/README.md).
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
