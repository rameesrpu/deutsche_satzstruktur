# Boards Framework and Body Map Implementation Plan (4a)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add "boards" (picture-based practice areas on the Üben screen, with their own schedule) and the first board: the body map with four sets and four modes.

**Architecture:** Pure modules for the box schedule and the session queue; board progress stored in the progress store; a registry and a board screen that hand a set to a renderer chosen by the board's `kind`. The body map is the `hotspot` kind: an SVG picture plus named points from a JSON file.

**Tech Stack:** Plain ES modules, SVG, JSON data, tests with `gjs -m tests/run.js`.

**Spec:** [docs/superpowers/specs/2026-11-16-spatial-boards-design.md](../specs/2026-11-16-spatial-boards-design.md)

**Depends on:** the production ladder plan built (it provides `js/ladder.js` day math, progress store format 2 and the `order` screen pattern). Before Task 1 read `js/ladder.js`, `js/progressStore.js`, `js/homeScreen.js` (`renderPractice`) and `js/orderScreen.js` as built; where a name below differs from the code, the code wins and the report says so.

## Global Constraints

- Read `CLAUDE.md` first. Do not touch `backend/`. No new dependencies, no build, no `node`.
- `gamemode.js` is not changed by this plan.
- Boxes: `BOX_DAYS = [1, 3, 7, 14, 30]`; session size 10; at most 5 new items per session; only an item's first answer in a session is recorded.
- Gender colours come only from `GRAMMAR_PALETTE` in `js/grammaticalConfig.js`. Pictures must not use those colours as large areas.
- Pictures: SVG, at most 40 KB each, no text inside, no faces or features on the figure (neutral mannequin outline), flat warm style as in `data/stories/STORY_BIBLE.md` → Illustrations.
- UI copy is German, exactly as written in this plan. Meanings are English.
- Vocabulary is used exactly as listed in Task 4 (article, plural, meaning).
- Phone first: 400×850. CSS tokens only; new CSS in the `GAME MODE VISUAL JUICE` section.
- Board data files carry `version`; bump it when a file changes. Fetch them with the version in the URL, the way chapter files are fetched (commit ed49071).
- Every new module gets an import-map line; every new test file is registered in `tests/run.js`.
- Commit after each task. End commit messages with `Co-Authored-By: Claude <noreply@anthropic.com>`.

## Review Focus

1. **Progress saved before boards existed** (format 2 file, or an export without `boards`): loads with an empty `boards` map and all sentence progress intact. Test in Task 2.
2. **A board item removed or renamed in the data**: its stored entry is ignored by counts and sessions, never crashes, never appears as due. Test in Task 3.
3. **A tap between two close points** (Finger and Daumen, Lippe and Mund): the nearest point wins, and a tap far from every point is "no answer", not a wrong answer. Test in Task 4.
4. **Plural-only and umlaut plurals** in the pain sentence: "Meine Haare tun weh." is never built from a singular-only path; "die Brust" gives "Meine Brust tut weh." Test in Task 4.
5. **Leaving a session halfway**: answered items stay recorded, the rest are untouched, and reopening the set starts a fresh session. Test in Task 1.

## File Structure

| File | Responsibility |
|---|---|
| `js/boardSchedule.js` (new) | Pure: boxes, due items, session choice, set progress |
| `js/boardSession.js` (new) | Pure: queue of one session, retry of wrong items |
| `js/progressStore.js` | `boards` map, `recordBoard`, format version + 1 |
| `js/boards.js` (new) | Registry, data loading, unlock state, keys |
| `js/boardScreen.js` (new) | Board screen: set list, set view, mode buttons, session chrome |
| `js/hotspotBoard.js` (new) | `hotspot` kind: pure helpers + the four modes |
| `data/boards/koerper.json`, `data/boards/img/*.svg` (new) | Body map data and pictures |
| `js/homeScreen.js`, `js/app.js` | "Bilder" section on Üben, screen wiring |

---

### Task 1: Box schedule and session queue

**Model:** sonnet

**Files:**
- Create: `js/boardSchedule.js`, `js/boardSession.js`, `tests/boardSchedule.test.js`
- Modify: `tests/run.js`, `index.html` (import map)

**Interfaces:**
- Consumes: `startOfDay`, `addDays` from `js/ladder.js`.
- Produces (pure):
  - `BoardEntry` = `{box: number, due: number, seen: number, correct: number, lastSeen: number}`
  - `BOX_DAYS = [1, 3, 7, 14, 30]`, `SESSION_SIZE = 10`, `NEW_PER_SESSION = 5`
  - `afterAnswer(entry: ?BoardEntry, ok: boolean, now: number): BoardEntry` — ok: `box = min(box + 1, 4)`; not ok: `box = 0`; `due = addDays(startOfDay(now), BOX_DAYS[box])`; `seen + 1`; `correct + 1` when ok; `lastSeen = now`. A `null` entry starts from box 0
  - `pickSession(ids: string[], get: (id) => ?BoardEntry, now: number, opts = {size: SESSION_SIZE, newMax: NEW_PER_SESSION}): string[]` — entries with `due <= now` (oldest due first, ties in `ids` order), then ids without an entry in `ids` order up to `newMax`, cut to `size`
  - `setProgress(ids, get, now): {total: number, learned: number, due: number}` — `learned` = entries with `box >= 1`
  - `createSession(ids: string[]): Session` — `{queue: string[], pos: number, first: {[id]: boolean}}`
  - `currentItem(session): ?string`; `answer(session, ok: boolean): Session` (new object) — records `first[id] = ok` only the first time the item is answered; a wrong item is appended to the queue once; `pos + 1`
  - `sessionDone(session): boolean`; `sessionResults(session): {id: string, ok: boolean}[]` (first answers, in order of first answer)

- [ ] **Step 1: Write the failing tests** (`NOW = new Date(2026, 10, 16, 20, 0).getTime()`, `day(n)` = local midnight n days after 2026-11-16):
  - `afterAnswer(null, true, NOW)` → `{box: 1, due: day(3), seen: 1, correct: 1, lastSeen: NOW}`.
  - `afterAnswer(null, false, NOW)` → `box: 0`, `due: day(1)`, `correct: 0`.
  - Box 4 + ok stays 4 with `due: day(30)`; box 3 + wrong → box 0, `day(1)`.
  - `pickSession(['a','b','c','d','e','f','g','h'], get, NOW)` where `c` is due yesterday, `a` due three days ago, `b` due tomorrow and the rest are new → `['a','c','d','e','f','g','h']` (two due, five new; `b` not due).
  - With 12 due items → 10 returned, no new ones.
  - `setProgress` counts `learned` and `due` as defined; an entry for an id not in `ids` is ignored.
  - Session: `createSession(['a','b'])`, answer wrong then right → queue is `['a','b','a']`; answer the retry right → done; `sessionResults` is `[{id:'a',ok:false},{id:'b',ok:true}]`. A second wrong answer on the retry does not append again.
  - A session left after one answer: `sessionResults` has one entry.
- [ ] **Step 2: Register and run** `gjs -m tests/run.js`. Expected: FAIL (modules not found).
- [ ] **Step 3: Implement** both modules; add import-map lines.
- [ ] **Step 4: Run** `gjs -m tests/run.js`. Expected: exit 0.
- [ ] **Step 5: Commit** — `git add js tests index.html && git commit -m "Add board box schedule and session queue"`

---

### Task 2: Board progress in the store

**Model:** sonnet

**Files:**
- Modify: `js/progressStore.js`, `js/types.js`, `js/homeScreen.js` (`countPlayedToday`), `tests/progressStore.test.js`, `tests/homeScreen.test.js`

**Interfaces:**
- Consumes: `afterAnswer` (Task 1).
- Produces:
  - `GameProgress.boards: Object<string, BoardEntry>`; `FORMAT_VERSION` raised by one. Loading an older format keeps everything and adds `boards: {}`
  - `progressStore.getBoard(key: string): ?BoardEntry`
  - `progressStore.recordBoard(key: string, ok: boolean, now = Date.now()): BoardEntry` — applies `afterAnswer`, saves
  - `normalize` keeps valid board entries (`box` integer 0–4, the other fields non-negative finite numbers) and drops the rest
  - `importData` merge: per board key keep the entry with the later `lastSeen`; replace: take the incoming map
  - `countPlayedToday(progress, now)` also counts board entries with `lastSeen >= startOfDay(now)`

- [ ] **Step 1: Write the failing tests**: a stored format-2 object without `boards` loads with `boards` `{}` and the same sentences; `recordBoard('koerper/aussen/knie:zeigen', true, NOW)` then `getBoard` → box 1; an entry with `box: 9` is dropped on load; export → import replace round-trips `boards`; merge keeps the later `lastSeen`; `countPlayedToday` = sentences played today + board items seen today.
- [ ] **Step 2: Run** `gjs -m tests/run.js`. Expected: FAIL.
- [ ] **Step 3: Implement**; update the typedefs.
- [ ] **Step 4: Run** `gjs -m tests/run.js`. Expected: exit 0.
- [ ] **Step 5: Commit** — `git commit -am "Store board item progress"`

---

### Task 3: Registry, Üben section, board screen shell

**Model:** sonnet

**Files:**
- Create: `js/boards.js`, `js/boardScreen.js`, `tests/boards.test.js`, `data/boards/koerper.json` (shell: board fields and the four sets with empty `items`; Task 4 fills them)
- Modify: `js/homeScreen.js` (`renderPractice`), `js/app.js` (`renderPracticeScreen`, `showScreen('board')`, `openBoard`), `index.html` (`<main class="screen" id="screen-board" aria-label="Bilder" hidden></main>`; import map), `css/styles.css`, `tests/homeScreen.test.js`, `tests/run.js`

**Interfaces:**
- Consumes: `pickSession`, `setProgress`, `createSession`, `answer`, `currentItem`, `sessionDone` (Task 1); `getBoard`, `recordBoard` (Task 2); `LevelSelector.isChapterComplete(level, key)`.
- Produces:
  - Board file shape: `{id: string, title: string, version: number, kind: string, sets: {id, title, unlock: ?{level: string, category: string, label: string}, image: ?string, items: object[]}[]}`
  - `BOARDS: {id: string, title: string, kind: string, file: string, modes: {id: string, label: string, scored: boolean}[]}[]` — one entry now: `koerper`, title `Der Körper`, kind `hotspot`, modes `entdecken` / `Entdecken` (not scored), `zeigen` / `Zeigen`, `benennen` / `Benennen`, `schmerz` / `Wo tut es weh?`
  - `boardKey(boardId, setId, itemId, modeId): string` → `` `${boardId}/${setId}/${itemId}:${modeId}` ``
  - `loadBoard(id: string, fetchJson: (url) => Promise<object>): Promise<object>` — cached per id
  - `isSetLocked(set, isChapterComplete: (level, category) => boolean): boolean`
  - `boardSummary(board, getBoard, isChapterComplete, now): {total: number, learned: number, due: number}` — over unlocked sets and scored modes; an item counts as learned when every scored mode's entry has `box >= 1`; `due` counts due keys; stored keys for items not in the data are ignored
  - `KINDS: Object<string, {renderSet(root, ctx): void}>` in `boardScreen.js` (empty until Task 6 registers `hotspot`); `registerKind(kind, impl)`
  - `ctx` handed to a kind renderer: `{board, set, mode: string, itemId: ?string, items: object[], onAnswer(ok: boolean): void, speak(text: string): void}` — in a scored mode `itemId` is the session's current item and the renderer calls `onAnswer` once per item; in `entdecken` `itemId` is `null`
  - `renderBoardScreen(root, state: {board, isChapterComplete, getBoard, now}, actions: {record(key, ok), close()})` — the set list (locked sets greyed, with `Nach „<unlock.label>“`), then a set view: title, mode buttons, and for scored modes a session (`pickSession` over the set's item ids for that mode, progress segments, `Weiter` after each answer, a closing line `<right> von <n> richtig` and `Fertig`)
  - `renderPractice` takes `boards: {id, title, total, learned, due}[]` and `actions.openBoard(id)`. Section heading `Bilder`; card text `` `${learned} von ${total} gelernt` ``; button `Öffnen`; when `due > 0` a second button `` `Wiederholen (${due})` `` (opens the board on its first set with due items)

- [ ] **Step 1: Write the failing tests**: `boardKey`; `isSetLocked` with and without `unlock`; `boardSummary` with a stored key whose item is gone (ignored) and with a locked set (not counted); `renderPractice` shows the `Bilder` section, the learned line and the `Wiederholen (3)` button only when due (follow how `tests/homeScreen.test.js` inspects output).
- [ ] **Step 2: Run** `gjs -m tests/run.js`. Expected: FAIL.
- [ ] **Step 3: Implement.** The set view for a kind that is not registered shows `Dieses Bild kommt bald.`
- [ ] **Step 4: Run** `gjs -m tests/run.js`. Expected: exit 0.
- [ ] **Step 5: Check on screen** at 400×850: Üben shows the `Bilder` card; opening it shows four sets, locked ones greyed.
- [ ] **Step 6: Commit** — `git add -A js css data tests index.html && git commit -m "Add board registry, Üben section and board screen"`

---

### Task 4: Hotspot logic and body vocabulary

**Model:** sonnet

**Files:**
- Create: `js/hotspotBoard.js` (pure part only in this task), `tests/hotspotBoard.test.js`
- Modify: `data/boards/koerper.json`, `tests/run.js`, `index.html` (import map)

**Interfaces:**
- Consumes: `articleGender` from `js/homeScreen.js` (parses the article of a glossary headword) if it fits; otherwise `parseNoun` below replaces its use here.
- Produces (pure):
  - Item shape: `{id: string, de: string, en: string, spot: [number, number]}` — `de` is a headword like `"das Knie, Knie"` or `"die Haare (pl.)"`; `spot` is x, y in percent of the picture (Task 5 sets real values; use `[50, 50]` placeholders now)
  - `parseNoun(de: string): {article: 'der'|'die'|'das', noun: string, plural: ?string, pluralOnly: boolean, gender: 'masc'|'fem'|'neut'|'pl'}`
  - `nearestSpot(items, x: number, y: number, maxDist = 9): ?string` — the id of the nearest spot within `maxDist` percent (Euclidean, x and y both in percent), else `null`
  - `nameOptions(items, id: string, rng = Math.random): string[]` — four item ids including `id`, the other three from the same set, shuffled; fewer when the set is smaller
  - `painSentence(item, usePlural: boolean): string` — `Mein Kopf tut weh.` / `Meine Schulter tut weh.` / `Mein Knie tut weh.` / plural `Meine Augen tun weh.`; plural-only items always use the plural form
  - `whereQuestion(item): string` — `Wo ist das Knie?`, plural-only: `Wo sind die Haare?`
- Vocabulary (exact):
  - Set `aussen`, title `Der Körper`, image `img/koerper-vorne.svg`, unlock `{level: 'A1', category: 'g5k1', label: 'Beim Arzt 5.1'}`: der Kopf, Köpfe (head) · der Hals, Hälse (neck, throat) · die Schulter, Schultern (shoulder) · der Arm, Arme (arm) · der Ellbogen, Ellbogen (elbow) · das Handgelenk, Handgelenke (wrist) · die Hand, Hände (hand) · der Finger, Finger (finger) · der Daumen, Daumen (thumb) · die Brust, Brüste (chest) · der Bauch, Bäuche (belly, abdomen) · die Hüfte, Hüften (hip) · das Bein, Beine (leg) · der Oberschenkel, Oberschenkel (thigh) · das Knie, Knie (knee) · der Unterschenkel, Unterschenkel (lower leg) · der Knöchel, Knöchel (ankle) · der Fuß, Füße (foot) · der Zeh, Zehen (toe)
  - Set `gesicht`, title `Das Gesicht`, image `img/gesicht.svg`, same unlock: die Stirn, Stirnen (forehead) · die Augenbraue, Augenbrauen (eyebrow) · das Auge, Augen (eye) · das Ohr, Ohren (ear) · die Nase, Nasen (nose) · die Wange, Wangen (cheek) · der Mund, Münder (mouth) · die Lippe, Lippen (lip) · der Zahn, Zähne (tooth) · die Zunge, Zungen (tongue) · das Kinn, Kinne (chin) · die Haare (pl.) (hair)
  - Set `hinten`, title `Von hinten`, image `img/koerper-hinten.svg`, same unlock: der Nacken, Nacken (nape of the neck) · der Rücken, Rücken (back) · das Gesäß, Gesäße (buttocks) · die Kniekehle, Kniekehlen (back of the knee) · die Wade, Waden (calf) · die Ferse, Fersen (heel)
  - Set `organe`, title `Die Organe`, image `img/organe.svg`, unlock `{level: 'A1', category: 'g5k3', label: 'Beim Arzt 5.3'}`: das Gehirn, Gehirne (brain) · die Schilddrüse, Schilddrüsen (thyroid) · die Luftröhre, Luftröhren (windpipe) · die Speiseröhre, Speiseröhren (oesophagus) · die Lunge, Lungen (lung) · das Herz, Herzen (heart) · die Leber, Lebern (liver) · die Gallenblase, Gallenblasen (gallbladder) · der Magen, Mägen (stomach) · die Milz, Milzen (spleen) · die Bauchspeicheldrüse, Bauchspeicheldrüsen (pancreas) · die Niere, Nieren (kidney) · der Darm, Därme (intestine) · die Blase, Blasen (bladder)

- [ ] **Step 1: Write the failing tests**
  - `parseNoun('der Fuß, Füße')` → article `der`, noun `Fuß`, plural `Füße`, gender `masc`, `pluralOnly: false`; `parseNoun('die Haare (pl.)')` → `pluralOnly: true`, gender `pl`, noun `Haare`.
  - `painSentence` for Kopf, Schulter, Knie (singular) and Augen (plural) gives the four sentences above; for `die Haare (pl.)` with `usePlural: false` → `Meine Haare tun weh.`
  - `whereQuestion` for Knie and Haare.
  - `nearestSpot` with two spots at `[40, 50]` and `[44, 50]`: a tap at `[43, 50]` → the second; a tap at `[80, 80]` → `null`.
  - `nameOptions` returns four distinct ids including the asked one; with a set of three items returns three.
  - Data test over `data/boards/koerper.json`: 4 sets with 19, 12, 6 and 14 items; every `de` parses; ids are unique within a set and match `^[a-z0-9-]+$`; every `en` is non-empty; every spot is two numbers in 0–100; `version` is a positive integer.
- [ ] **Step 2: Run** `gjs -m tests/run.js`. Expected: FAIL.
- [ ] **Step 3: Implement** the pure functions and fill the data file with the vocabulary above.
- [ ] **Step 4: Run** `gjs -m tests/run.js`. Expected: exit 0.
- [ ] **Step 5: Commit** — `git add js data tests index.html && git commit -m "Add hotspot board logic and body vocabulary"`

---

### Task 5: Pictures and point positions (stops for the owner)

**Model:** opus (drawing SVG by hand and placing points needs care)

**Files:**
- Create: `data/boards/img/koerper-vorne.svg`, `koerper-hinten.svg`, `gesicht.svg`, `organe.svg`, and a `.txt` next to each describing the picture (as chapter pictures do)
- Modify: `data/boards/koerper.json` (real `spot` values; bump `version`), `tests/hotspotBoard.test.js`

**Interfaces:**
- Produces: four pictures with `viewBox="0 0 300 400"` (portrait 3:4), and for every item a `spot` on the body part it names.

- [ ] **Step 1: Draw** the four pictures under the Global Constraints (neutral mannequin, flat, no text, ≤ 40 KB). The front and back figures stand with arms slightly away from the body and feet apart, so wrist, hip, thigh and ankle are separate places. The face is a front view large enough to tell eyebrow, eye, cheek and lip apart. The organ picture is a torso outline with the head, each organ a distinct simple shape.
- [ ] **Step 2: Place the points.** For paired parts use the figure's left side as seen by the viewer (one point per item).
- [ ] **Step 3: Add a data test**: no two spots of a set are closer than 6 percent (so `nearestSpot` can tell them apart); each picture file named in the data exists and is under 40 KB.
- [ ] **Step 4: Render a proof sheet**: an uncommitted HTML page that shows each picture with its points numbered and a legend; screenshot it with headless Chrome at 1200×1600 and check every point sits on its part. Fix and repeat until it does.
- [ ] **Step 5: Stop.** Show the owner the proof-sheet screenshots and ask whether the figure and the pictures are acceptable. Apply changes.
- [ ] **Step 6: Run** `gjs -m tests/run.js`; commit — `git add data tests && git commit -m "Add body map pictures and point positions"`

---

### Task 6: Hotspot modes on screen

**Model:** sonnet

**Files:**
- Modify: `js/hotspotBoard.js` (DOM part; `registerKind('hotspot', …)`), `js/app.js` (import the module so it registers), `css/styles.css`

**Interfaces:**
- Consumes: the `ctx` contract and `registerKind` (Task 3); the pure helpers (Task 4); `GRAMMAR_PALETTE`.
- Produces: `renderSet(root, ctx)` for the four modes:
  - `entdecken`: all points as dots. Tapping one opens a label: article + noun in the gender colour, plural, English, a 🔊 button; the word is spoken on open. Tapping elsewhere closes it.
  - `zeigen`: prompt = `whereQuestion(item)`, spoken. Points are hidden; she taps the picture. `nearestSpot` decides: the item → right; another item → wrong; `null` → hint `Tipp näher an die Stelle.` and no answer. After a wrong answer the right point pulses and its label shows.
  - `benennen`: the item's point pulses; four buttons from `nameOptions`, each article + noun in neutral colour (the colour would give the gender away). Right or wrong, the label then shows in its gender colour.
  - `schmerz`: prompt = `painSentence(item, usePlural)` shown and spoken, where `usePlural` is true for every second item that has a plural (decided from the item's index in the set so it is stable); she taps the place as in `zeigen`.
  - Every scored answer calls `ctx.onAnswer(ok)` once and shows `Weiter`.
- The picture scales to the screen width (max height 55% of the viewport); points are positioned in percent over it so they stay on their parts at any size.

- [ ] **Step 1: Implement** the renderer and CSS.
- [ ] **Step 2: Run** `gjs -m tests/run.js`. Expected: exit 0.
- [ ] **Step 3: Check on screen** at 400×850 and 1280×800 with an uncommitted harness that opens each mode on the `aussen` set (chapter completion forced true): points sit on their parts at both sizes; a right and a wrong answer in each scored mode; the session ends with `<right> von <n> richtig`; after it, Üben shows a higher learned count.
- [ ] **Step 4: Commit** — `git add js css && git commit -m "Add body map modes: Entdecken, Zeigen, Benennen, Wo tut es weh?"`

---

### Task 7: Docs and ship

**Model:** sonnet

**Files:**
- Modify: `CLAUDE.md` (file list: the four new modules; Data: board files and pictures), `js/types.js` (board file and `BoardEntry` typedefs if not added yet), `docs/roadmap.md` (progress tracker), `index.html` (versions)

- [ ] **Step 1: Update** the docs; add a short "Adding a board" note to `CLAUDE.md` → Data (data file, picture, `BOARDS` entry, kind renderer).
- [ ] **Step 2:** `scripts/bump_version.sh`; `gjs -m tests/run.js`; `python3 scripts/audit_library.py`. Expected: all exit 0.
- [ ] **Step 3: Commit** — `git commit -am "Document boards and the body map, bump versions"`
