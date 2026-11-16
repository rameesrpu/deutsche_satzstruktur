# Preposition Scene Implementation Plan (4b)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A board for the two-way prepositions: a hen in Frau Schäfer's garden that walks to a place (arrow, Akkusativ) or sits at a place (dot, Dativ), with four modes.

**Architecture:** A new board kind `scene` on the framework from plan 4a. Sentences are not stored: a pure function builds them from the mover, the preposition, the landmark and the question (wohin / wo), using the app's existing article table.

**Tech Stack:** Plain ES modules, SVG, CSS transitions, JSON data, tests with `gjs -m tests/run.js`.

**Spec:** [docs/superpowers/specs/2026-11-16-spatial-boards-design.md](../specs/2026-11-16-spatial-boards-design.md)

**Depends on:** plan 4a (`2026-11-16-boards-body-map.md`) built. Before Task 1 read `js/boards.js`, `js/boardScreen.js`, `js/hotspotBoard.js` and `articleFor()` in `js/gameRules.js` as built; where a name below differs from the code, the code wins and the report says so.

## Global Constraints

- All Global Constraints of plan 4a apply (pictures, colours, copy, phone first, versions, import map, commits).
- The rule shown on screen, exact copy: `Wohin? → Akkusativ` and `Wo? → Dativ`.
- Movement is always drawn as an arrow and rest as a dot, in every mode. No mode shows one without the other's absence being meaningful.
- Contractions are written the way Germans write them: `in dem → im`, `in das → ins`, `an dem → am`, `an das → ans`. No others.
- Dative plural: the noun takes `-n` unless it already ends in `-n` or `-s`.
- The picture shows a place, no people. The hen is a separate SVG element so it can move.

## Review Focus

1. **Contracted forms in the article mode**: the blank covers the whole contracted word ("Das Huhn geht ___ Hühnerhaus." → `ins` / `im`), never "in ___" with an answer that nobody writes. Test in Task 1.
2. **Two landmarks** (*zwischen*): both articles change together ("zwischen den Baum und die Bank" / "zwischen dem Baum und der Bank"); the choice is one answer, not two. Test in Task 1.
3. **Feminine and plural landmarks**, where Akkusativ equals Nominativ (*die Bank*, *die Blumen*): the two choices still differ (`die` / `der`, `die` / `den`). Test in Task 1.
4. **An item that only makes sense with movement** (*über den Zaun*): it never appears as a "Wo?" question. Test in Task 1.
5. **Tapping while the hen is still walking**: the animation finishes or is cut cleanly; an answer is never recorded twice. Checked in Task 3.

## File Structure

| File | Responsibility |
|---|---|
| `js/sceneBoard.js` (new) | `scene` kind: pure sentence and option builders + the four modes |
| `js/boardScreen.js`, `js/boards.js` | Optional `itemIds` hook of a kind; registry entry |
| `data/boards/wechselpraepositionen.json`, `data/boards/img/garten.svg`, `huhn.svg` (new) | Scene data and pictures |

---

### Task 1: Scene data and sentence logic

**Model:** sonnet

**Files:**
- Create: `js/sceneBoard.js` (pure part), `tests/sceneBoard.test.js`, `data/boards/wechselpraepositionen.json`
- Modify: `js/boards.js` (`BOARDS` entry; `boardSummary` uses the hook), `js/boardScreen.js` (hook), `tests/boards.test.js`, `tests/run.js`, `index.html` (import map)

**Interfaces:**
- Consumes: `parseNoun` from `js/hotspotBoard.js`; `articleFor(gender, case)` from `js/gameRules.js`; `registerKind`.
- Produces:
  - Framework hook: a kind may define `itemIds(set, modeId): string[]`. `boardScreen.js` and `boardSummary` use it when present and fall back to `set.items.map(i => i.id)`. Test: a fake kind with the hook changes the session's ids and the summary total.
  - `BOARDS` entry: id `wechsel`, title `Wo? Wohin?`, kind `scene`, file `data/boards/wechselpraepositionen.json`, modes `entdecken` / `Entdecken` (not scored), `verstehen` / `Verstehen`, `artikel` / `Artikel`, `satz` / `Satz`
  - Set shape: `{id: 'garten', title: 'Im Garten', image: 'img/garten.svg', unlock: {level: 'A1', category: 'g5k3', label: 'Beim Arzt 5.3'}, mover: {de: 'das Huhn, Hühner', image: 'img/huhn.svg', home: [x, y]}, landmarks: {<key>: {de: string}}, items: Item[]}`
  - `Item` = `{id: string, prep: string, landmark: string, landmark2: ?string, spot: [number, number], verbs: {wohin: string, wo: ?string}}` — `verbs.wo: null` means movement only
  - Landmarks: `tisch` der Tisch, Tische · `bank` die Bank, Bänke · `huehnerhaus` das Hühnerhaus, Hühnerhäuser · `zaun` der Zaun, Zäune · `baum` der Baum, Bäume · `kiste` die Kiste, Kisten · `blumen` die Blumen (pl.)
  - Items (id = `prep-landmark`; verbs wohin / wo): auf tisch (springt / sitzt) · unter tisch (läuft / sitzt) · neben tisch (läuft / steht) · auf bank (springt / sitzt) · unter bank (läuft / liegt) · hinter bank (läuft / steht) · in huehnerhaus (geht / schläft) · vor huehnerhaus (läuft / steht) · hinter huehnerhaus (läuft / steht) · auf huehnerhaus (fliegt / sitzt) · an zaun (läuft / steht) · über zaun (fliegt / –) · hinter zaun (läuft / steht) · vor zaun (läuft / steht) · auf baum (fliegt / sitzt) · unter baum (läuft / liegt) · hinter baum (läuft / steht) · vor baum (läuft / steht) · in kiste (springt / sitzt) · auf kiste (springt / sitzt) · neben kiste (läuft / steht) · hinter kiste (läuft / steht) · zwischen blumen (läuft / sitzt) · zwischen baum + bank, id `zwischen-baum-bank` (läuft / steht)
  - `PREPS = ['in', 'an', 'auf', 'unter', 'über', 'vor', 'hinter', 'neben', 'zwischen']`
  - `sceneItemIds(set): string[]` — `<item id>.wohin` for every item and `<item id>.wo` for items with a `wo` verb (this is the kind's `itemIds` for the scored modes)
  - `sceneSentence(set, itemId: string): {kind: 'wohin'|'wo', case: 'akk'|'dat', text: string, verb: string, prep: string, phrase: string, answer: string, other: string}` — `text` is the full sentence (`Das Huhn läuft unter den Tisch.`); `phrase` is the prepositional phrase as written (`unter den Tisch`, `ins Hühnerhaus`, `zwischen den Baum und die Bank`); `answer` is what fills the article blank (`den`, `ins`, `den … die`) and `other` is the same slot in the other case (`dem`, `im`, `dem … der`)
  - `articleBlank(set, itemId): {before: string, after: string, options: [string, string], answer: string}` — `before` + blank + `after` rebuild the sentence (`Das Huhn läuft unter ` / ` Tisch.`; contracted: `Das Huhn geht ` / ` Hühnerhaus.`; two landmarks: the blank is shown as two gaps, `after` holds the template `{1} Baum und {2} Bank.` and each option carries both articles); `options` = Akkusativ form first, Dativ form second
  - `prepOptions(itemId: string, rng = Math.random): string[]` — four of `PREPS` including the item's, shuffled
  - `ruleHint(kind): string` — `Wohin? → Akkusativ` / `Wo? → Dativ`

- [ ] **Step 1: Write the failing tests** (with a set object built in the test from the landmark and item lists above, spots `[50, 50]`):
  - `sceneSentence(set, 'unter-tisch.wohin').text` → `Das Huhn läuft unter den Tisch.`; `.wo` → `Das Huhn sitzt unter dem Tisch.`
  - `in-huehnerhaus.wohin` → `Das Huhn geht ins Hühnerhaus.`, `answer: 'ins'`, `other: 'im'`; `.wo` → `Das Huhn schläft im Hühnerhaus.`
  - `an-zaun.wohin` → `… läuft an den Zaun.`; `.wo` → `… steht am Zaun.`
  - `in-kiste.wohin` → `… springt in die Kiste.`; `.wo` → `… sitzt in der Kiste.`
  - `zwischen-blumen.wohin` → `… läuft zwischen die Blumen.`; `.wo` → `… sitzt zwischen den Blumen.`
  - `zwischen-baum-bank.wohin` → `… läuft zwischen den Baum und die Bank.`, `answer: 'den … die'`, `other: 'dem … der'`; `.wo` → `… steht zwischen dem Baum und der Bank.`
  - `sceneItemIds(set)` has 47 ids and does not contain `ueber-zaun.wo` (use the item ids as the data spells them; `über` in an id is written `ueber`).
  - `articleBlank` for `unter-tisch.wohin` → `{before: 'Das Huhn läuft unter ', after: ' Tisch.', options: ['den', 'dem'], answer: 'den'}`; for `in-huehnerhaus.wo` → `before: 'Das Huhn schläft '`, `options: ['ins', 'im']`, `answer: 'im'`; for `auf-bank.wo` → `options: ['die', 'der']`, `answer: 'der'`.
  - `prepOptions('unter-tisch.wohin', rng)` has four distinct members of `PREPS` including `unter`.
  - Data test over the real file: 7 landmarks, 24 items, every item's landmark keys exist, every `de` parses, spots are in 0–100, ids are unique.
- [ ] **Step 2: Run** `gjs -m tests/run.js`. Expected: FAIL.
- [ ] **Step 3: Implement** the hook, the registry entry, the data file (placeholder spots) and the pure functions.
- [ ] **Step 4: Run** `gjs -m tests/run.js`. Expected: exit 0.
- [ ] **Step 5: Commit** — `git add js data tests index.html && git commit -m "Add preposition scene data and sentence logic"`

---

### Task 2: Garden picture and positions (stops for the owner)

**Model:** opus

**Files:**
- Create: `data/boards/img/garten.svg`, `garten.txt`, `huhn.svg`, `huhn.txt`
- Modify: `data/boards/wechselpraepositionen.json` (real spots and `mover.home`; bump `version`), `tests/sceneBoard.test.js`

**Interfaces:**
- Produces: `garten.svg` with `viewBox="0 0 400 300"` (landscape 4:3) showing, clearly apart: a table, a bench, a hen house with a visible door, a fence along the back, a tree, a wooden box, a flower bed. `huhn.svg` (`viewBox="0 0 40 40"`), a simple hen facing right. A spot for every item, placed where the hen would be for that preposition: *auf* = on top, *unter* = below the top but inside the outline, *vor* = in front (lower on the picture), *hinter* = behind (partly above and beside, the renderer draws the hen half hidden), *neben* = to the right, *in* = inside, *an* = touching the side, *über* = above, *zwischen* = between.

- [ ] **Step 1: Draw** both pictures under plan 4a's picture constraints.
- [ ] **Step 2: Place** the 24 spots and `mover.home` (an empty patch of grass in the lower middle).
- [ ] **Step 3: Add a data test**: no two spots are closer than 5 percent; both picture files exist and are under 40 KB.
- [ ] **Step 4: Proof sheet**: an uncommitted HTML page showing the garden with the hen drawn at every spot and the phrase next to it (`unter dem Tisch`); screenshot at 1600×1200; every hen must read as its phrase at a glance. Fix until it does.
- [ ] **Step 5: Stop.** Show the owner the proof sheet. Apply changes.
- [ ] **Step 6: Run** `gjs -m tests/run.js`; commit — `git add data tests && git commit -m "Add garden scene picture and positions"`

---

### Task 3: Scene modes on screen

**Model:** sonnet

**Files:**
- Modify: `js/sceneBoard.js` (DOM part; `registerKind('scene', {renderSet, itemIds})`), `js/app.js` (import so it registers), `css/styles.css`

**Interfaces:**
- Consumes: the `ctx` contract (plan 4a Task 3); `nearestSpot` from `js/hotspotBoard.js`; the pure functions (Task 1).
- Produces: `renderSet(root, ctx)`:
  - Common: the garden scaled to the screen width; the hen as an absolutely positioned element. **Movement**: the hen moves from `home` to the spot in 900 ms and an arrow is drawn from `home` to the spot. **Rest**: the hen is at the spot with a dot under it and no arrow. For *hinter* the hen is drawn at 50% opacity behind the landmark. A line under the picture always shows `ruleHint(kind)` once the answer is known.
  - `entdecken`: all spots as faint dots. Tap one: movement plays with the `wohin` sentence shown and spoken; after `Weiter` the hen rests and the `wo` sentence is shown and spoken (items without `wo` skip this step). The article is set in bold in both sentences.
  - `verstehen`: the sentence is shown and spoken; spots are faint dots; she taps one. `nearestSpot` among the item spots decides; `null` → `Tipp auf einen Punkt.` and no answer. Then the scene plays the right movement or rest.
  - `artikel`: the scene plays first (movement or rest), then `articleBlank` is shown with its two options as buttons. After the answer the full sentence is shown and spoken with the hint.
  - `satz`: as `artikel`, but the preposition is a blank too: first the four `prepOptions` buttons, then the two article options. The item is right only if both are right. For contracted answers the article step shows the contracted forms and the sentence is rebuilt accordingly.
  - Buttons are disabled while the hen is moving; `ctx.onAnswer(ok)` is called exactly once per item.

- [ ] **Step 1: Implement** the renderer and CSS.
- [ ] **Step 2: Run** `gjs -m tests/run.js`. Expected: exit 0.
- [ ] **Step 3: Check on screen** at 400×850 and 1280×800 with an uncommitted harness: one movement and one rest item in each mode; a contracted item (`in-huehnerhaus`) in `artikel` and `satz`; the two-landmark item in `artikel`; a wrong answer shows the hint with the right case. Use `--virtual-time-budget` long enough for the animation.
- [ ] **Step 4: Commit** — `git add js css && git commit -m "Add preposition scene modes"`

---

### Task 4: Docs and ship

**Model:** sonnet

**Files:**
- Modify: `CLAUDE.md` (file list: `sceneBoard.js`; the `itemIds` hook in the "Adding a board" note), `docs/roadmap.md` (progress tracker), `index.html` (versions)

- [ ] **Step 1: Update** the docs.
- [ ] **Step 2:** `scripts/bump_version.sh`; `gjs -m tests/run.js`. Expected: exit 0.
- [ ] **Step 3: Commit** — `git commit -am "Document the preposition scene, bump versions"`
