# Production Ladder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every played sentence comes back on a schedule, one rung harder each time: rung 2 "Ordnen" (drop phrases into the field model) and rung 3 "Artikel" (the game with articles blanked), started from a "Heute üben" tile.

**Architecture:** A pure schedule (`ladder.js`) stores `rung` and `due` per sentence in the progress store (format version 2). A review runner takes today's due sentences and opens one exercise per sentence: a new DOM screen for rung 2, the existing `GameMode` with an article switch for rung 3. Field zones and article detection are new pure modules.

**Tech Stack:** Plain ES modules, HTML/CSS, no build. Tests run with `gjs -m tests/run.js` (there is no `node`). Python 3 only for existing build checks.

**Spec:** [docs/superpowers/specs/2026-11-15-production-ladder-design.md](../specs/2026-11-15-production-ladder-design.md)

## Global Constraints

- Read `CLAUDE.md` first. Do not touch `backend/`. Do not edit `js/storyContent.js` (generated).
- No new dependencies, no build step, no `node`.
- `gamemode.js` gets flags and hooks only (`articleBlank`, `ladder`), no new game modes.
- Never mark a correct German sentence wrong: order inside the Mittelfeld is not tested.
- Daily cap = the daily goal setting (5, 10, 20, 30; default 10). The cap is hard.
- Rungs built: 2 and 3. Top of the ladder is rung 3. Rung 1 never appears in review.
- Intervals: pass → 1, 3, 7, 14 days by rung reached (2, 3, 4, 5); at the top 14, then 30 days; a mistake → one rung down (not below 2), due the next day.
- Review covers library sentences (story chapters, drills, grammar); never `custom/…` keys.
- Phone first: 400×850. CSS tokens from `:root` only; new CSS goes in the `GAME MODE VISUAL JUICE` section of `css/styles.css`.
- Every new `js/*.js` module needs its own import-map line in `index.html` (a test checks this).
- Every new test file exports `runXTests()` and is imported and called in `tests/run.js`, like the existing ones. Test style: `test('name', () => assertEqual(actual, expected))` from `tests/assert.js`.
- UI copy is German, exactly as written in this plan.
- Keep `js/types.js` in sync with new fields.
- Test sentences in this plan are written with the `tagged(text, tags)` helper from `tests/felderLesson.test.js`. If a tag string here does not produce the word shape the test needs (type, case, gender), adjust the tags or the helper, not the expected result.
- Commit after each task. End commit messages with `Co-Authored-By: Claude <noreply@anthropic.com>`.

## Review Focus

1. **A progress entry whose sentence no longer exists** (library text was edited): the runner retires it (`rung: 0`) and goes on; the tile count does not stay stuck above zero. Test in Task 7.
2. **Closing a review midway (✕)**: finished sentences stay recorded, the rest stay due, and `gameMode.articleBlank` / `gameMode.ladder` are cleared so the next chapter shows articles again. Test in Task 7.
3. **Day boundaries**: due dates are local midnights computed with `Date#setDate`, not `+ 86400000`, so a review at 23:50 is due again at 00:10 the next day and DST days do not shift it. Test in Task 1.
4. **Importing or merging old progress**: a version 1 export, or an imported entry without `rung`, is migrated; a merge never replaces an entry that has a rung with one that has none. Test in Task 2.
5. **Replaying a chapter** for a sentence already on the ladder leaves `rung`, `due` and `topPasses` alone, also when she makes mistakes in the replay. Test in Task 2.

## File Structure

| File | Responsibility |
|---|---|
| `js/ladder.js` (new) | Pure schedule: day math, entering the ladder, result of a review, due list, migration |
| `js/progressStore.js` | Format version 2, ladder fields, `recordReview`, `retire`, merge rule |
| `js/fieldZones.js` (new) | Pure: sentence words → Vorfeld / Verb / Mittelfeld / Ende index lists |
| `js/orderExercise.js` (new) | Pure: chips for rung 2, drop checking, attempts, auto-place |
| `js/articleBlank.js` (new) | Pure: article detection, blanked texts, rung 3 eligibility |
| `js/orderScreen.js` (new) | DOM for the Ordnen screen (`body[data-screen="order"]`) |
| `js/reviewRunner.js` (new) | Review session: pure queue building + the runner that opens exercises |
| `js/gamemode.js`, `js/playScreen.js` | `articleBlank` flag, `ladder` hook |
| `js/homeScreen.js`, `js/chapterRecap.js`, `js/app.js` | "Heute üben" tile, review recap, wiring |

---

### Task 1: Schedule (`ladder.js`)

**Files:**
- Create: `js/ladder.js`, `tests/ladder.test.js`
- Modify: `js/homeScreen.js` (replace its `startOfDay` with `export { startOfDay } from './ladder.js';`), `tests/run.js`, `index.html` (import map)

**Interfaces:**
- Produces (all pure; `Eligible` = `{2: boolean, 3: boolean}`; `LadderState` = `{rung: number, due: number, topPasses: number}`):
  - `RUNG_FIRST = 2`, `RUNG_TOP = 3`, `PASS_DAYS = {2: 1, 3: 3, 4: 7, 5: 14}`, `TOP_DAYS = [14, 30]`, `MIGRATION_PER_DAY = 10`
  - `startOfDay(now: number): number` — local midnight before `now`
  - `addDays(dayStart: number, n: number): number` — local midnight `n` days later, via `Date#setDate`
  - `enterLadder(entry: ?object, now: number, eligible: Eligible): LadderState` — an entry that already has a finite `rung` returns its own values unchanged; otherwise `{rung: 2, due: tomorrow, topPasses: 0}`, or `{rung: 0, due: 0, topPasses: 0}` when no rung is eligible
  - `exerciseRung(rung: number, eligible: Eligible): 2|3|null` — the smallest eligible rung ≥ `rung` (up to `RUNG_TOP`), else the largest eligible rung, else `null`
  - `afterReview(entry: LadderState, ok: boolean, now: number, eligible: Eligible): LadderState` — measured from the rung actually shown (`exerciseRung`). ok and a higher eligible rung exists: that rung, due `PASS_DAYS[rung]` days after today, `topPasses: 0`. ok at the top: same rung, due `TOP_DAYS[min(topPasses, 1)]` days, `topPasses + 1`. Not ok: the largest eligible rung below the one shown (else the one shown), due tomorrow, `topPasses: 0`
  - `dueKeys(sentences: Object<string, object>, now: number, cap: number): string[]` — keys with `rung >= 2` and `due <= now`, oldest `due` first (ties by key), cut to `max(0, cap - reviewedToday)` where `reviewedToday` counts entries with `lastReview >= startOfDay(now)`
  - `migrate(sentences: Object<string, object>, now: number, perDay = MIGRATION_PER_DAY): void` — mutates. Entries without a finite `rung`: keys starting `custom/` or with `plays === 0` get `rung: 0`; the rest are ordered (entries with any recorded mistake first, then oldest `lastPlayed`, then key) and get `rung: 2`, `due: addDays(startOfDay(now), floor(i / perDay))`, `topPasses: 0`, `lastReview: 0`. Entries that already have a rung are untouched

- [ ] **Step 1: Write the failing tests** in `tests/ladder.test.js` (`export function runLadderTests()`), with `const NOW = new Date(2026, 10, 15, 23, 50).getTime()` and `const DAY0 = new Date(2026, 10, 15).getTime()`:

```js
const day = n => new Date(2026, 10, 15 + n).getTime();
const both = { 2: true, 3: true };
test('startOfDay: local midnight', () => assertEqual(startOfDay(NOW), DAY0));
test('addDays across the DST change stays at midnight', () =>
    assertEqual(addDays(new Date(2026, 9, 24).getTime(), 2), new Date(2026, 9, 26).getTime()));
test('enterLadder: new sentence → rung 2, due tomorrow', () =>
    assertEqual(enterLadder({ plays: 1 }, NOW, both), { rung: 2, due: day(1), topPasses: 0 }));
test('enterLadder: 23:50 play is due at 00:10 next day', () =>
    assert(enterLadder(null, NOW, both).due <= new Date(2026, 10, 16, 0, 10).getTime()));
test('enterLadder: already on the ladder → unchanged', () =>
    assertEqual(enterLadder({ rung: 3, due: 5, topPasses: 1 }, NOW, both), { rung: 3, due: 5, topPasses: 1 }));
test('enterLadder: nothing eligible → rung 0', () =>
    assertEqual(enterLadder(null, NOW, { 2: false, 3: false }).rung, 0));
test('exerciseRung: skips an ineligible rung', () => assertEqual(exerciseRung(2, { 2: false, 3: true }), 3));
test('exerciseRung: falls back below the top', () => assertEqual(exerciseRung(3, { 2: true, 3: false }), 2));
test('exerciseRung: none', () => assertEqual(exerciseRung(2, { 2: false, 3: false }), null));
test('afterReview: pass rung 2 → rung 3 in 3 days', () =>
    assertEqual(afterReview({ rung: 2, due: 0, topPasses: 0 }, true, NOW, both), { rung: 3, due: day(3), topPasses: 0 }));
test('afterReview: first pass at the top → 14 days', () =>
    assertEqual(afterReview({ rung: 3, due: 0, topPasses: 0 }, true, NOW, both), { rung: 3, due: day(14), topPasses: 1 }));
test('afterReview: later passes at the top → 30 days', () =>
    assertEqual(afterReview({ rung: 3, due: 0, topPasses: 4 }, true, NOW, both).due, day(30)));
test('afterReview: mistake on rung 3 → rung 2 tomorrow', () =>
    assertEqual(afterReview({ rung: 3, due: 0, topPasses: 2 }, false, NOW, both), { rung: 2, due: day(1), topPasses: 0 }));
test('afterReview: mistake on rung 2 stays on 2', () =>
    assertEqual(afterReview({ rung: 2, due: 0, topPasses: 0 }, false, NOW, both).rung, 2));
test('afterReview: rung 2 only sentence passes at its top', () =>
    assertEqual(afterReview({ rung: 2, due: 0, topPasses: 0 }, true, NOW, { 2: true, 3: false }),
        { rung: 2, due: day(14), topPasses: 1 }));
test('dueKeys: oldest first, capped, minus reviews done today', () => {
    const s = { a: { rung: 2, due: day(0) }, b: { rung: 3, due: day(-3) }, c: { rung: 2, due: day(1) },
        d: { rung: 0, due: 0 }, e: { rung: 2, due: day(-1), lastReview: 0 }, f: { rung: 3, due: day(9), lastReview: NOW } };
    assertEqual(dueKeys(s, NOW, 10), ['b', 'e', 'a']);
    assertEqual(dueKeys(s, NOW, 3), ['b', 'e']);   // f was reviewed today
    assertEqual(dueKeys(s, NOW, 1), []);
});
test('migrate: mistakes first, spread at perDay, custom and unplayed stay out', () => {
    const s = { 'A1/x/one': { plays: 1, lastPlayed: 5, mistakes: { cell: 0, case: {} } },
        'A1/x/two': { plays: 2, lastPlayed: 9, mistakes: { cell: 1, case: {} } },
        'A1/x/three': { plays: 1, lastPlayed: 1, mistakes: { cell: 0, case: {} } },
        'custom//mine': { plays: 3, lastPlayed: 2, mistakes: { cell: 0, case: {} } },
        'A1/x/kept': { plays: 1, lastPlayed: 1, rung: 3, due: 77, topPasses: 1, mistakes: { cell: 0, case: {} } } };
    migrate(s, NOW, 2);
    assertEqual([s['A1/x/two'].due, s['A1/x/three'].due, s['A1/x/one'].due], [day(0), day(0), day(1)]);
    assertEqual(s['custom//mine'].rung, 0);
    assertEqual([s['A1/x/kept'].rung, s['A1/x/kept'].due], [3, 77]);
});
```

- [ ] **Step 2: Register and run** — add `runLadderTests` to `tests/run.js`; run `gjs -m tests/run.js`. Expected: FAIL (module `js/ladder.js` not found).
- [ ] **Step 3: Implement `js/ladder.js`** with the interface above; move `startOfDay` out of `homeScreen.js` and re-export it there; add the import-map line.
- [ ] **Step 4: Run** `gjs -m tests/run.js`. Expected: exit 0.
- [ ] **Step 5: Commit** — `git add js/ladder.js js/homeScreen.js tests/ladder.test.js tests/run.js index.html && git commit -m "Add review ladder schedule"`

---

### Task 2: Progress store, format version 2

**Files:**
- Modify: `js/progressStore.js`, `js/types.js` (`SentenceProgress`, `GameProgress`), `tests/progressStore.test.js`

**Interfaces:**
- Consumes: `enterLadder`, `afterReview`, `migrate`, `RUNG_TOP` from `js/ladder.js` (Task 1).
- Produces:
  - `SentenceProgress` gains `rung: number` (0 = not on the ladder, 2–5), `due: number`, `topPasses: number`, `lastReview: number`
  - `GameProgress.version` is `2`
  - `recordSentence(key, mistakes, now = Date.now(), eligible = {2: true, 3: true})` — as today, then applies `enterLadder` (which leaves an entry that already has a rung alone). `custom/` keys get `rung: 0`
  - `recordReview(key: string, ok: boolean, eligible: Eligible, now = Date.now()): SentenceProgress` — applies `afterReview`, sets `lastReview` and `lastPlayed` to `now`, saves. Does not change `plays`, `perfect`, `perfectStreak` or `mistakes`. Unknown key: no-op, returns `null`
  - `retire(key: string): void` — sets `rung: 0`, saves
  - `normalize(data, now)` keeps the four fields (`rung` must be 0 or 2–5, else treated as missing; `due`, `topPasses`, `lastReview` non-negative finite numbers, else 0), then runs `migrate` on entries without a rung. `load()` and `importData()` pass `Date.now()`
  - `importData` merge: keep the incoming entry only if it is newer **and** not (`mine.rung >= 2` while the incoming file was version 1 or the incoming entry had no rung before migration); in that case keep `mine`

- [ ] **Step 1: Write the failing tests** (add to `runProgressStoreTests`, fresh `makeLocalStorage()` per test):
  - `load()` of a stored version 1 object with two played sentences → both have `rung: 2`, a finite `due`, and `data.version === 2`.
  - Stored entry with `rung: 7, due: NaN` → after `load()` the entry has `rung: 2` and a finite `due` (treated as missing, migrated).
  - `recordSentence('A1/k/Text', emptyMistakes(), NOW)` on a new key → `rung === 2`, `due === addDays(startOfDay(NOW), 1)`.
  - Replay: entry at `{rung: 3, due: 123, topPasses: 1}`; `recordSentence` with a mistake tally of `{cell: 2, case: {}}` → `rung`, `due`, `topPasses` unchanged, `plays` incremented.
  - `recordSentence('custom//Mein Satz', …)` → `rung === 0`.
  - `recordSentence(key, m, NOW, {2: false, 3: false})` → `rung === 0`.
  - `recordReview(key, true, both, NOW)` from rung 2 → `rung === 3`, `lastReview === NOW`, `plays` unchanged.
  - `recordReview('missing', true, both, NOW)` → returns `null`, nothing stored.
  - `retire(key)` → `rung === 0`; `dueKeys` no longer returns it.
  - `importData(v1Export, 'merge')` where the local entry has `rung: 3` and the imported one is newer → local `rung` stays 3.
  - `importData(v1Export, 'replace')` → every played entry has `rung: 2`.
  - `exportData()` then `importData(copy, 'replace')` round-trips `rung`, `due`, `topPasses`, `lastReview`.
- [ ] **Step 2: Run** `gjs -m tests/run.js`. Expected: FAIL on the new tests.
- [ ] **Step 3: Implement** in `js/progressStore.js` (`FORMAT_VERSION = 2`); update the typedefs in `js/types.js`.
- [ ] **Step 4: Run** `gjs -m tests/run.js`. Expected: exit 0 (existing progress tests still pass).
- [ ] **Step 5: Commit** — `git commit -am "Store ladder rung and due date in game progress (format 2)"`

---

### Task 3: Field zones (`fieldZones.js`)

**Files:**
- Create: `js/fieldZones.js`, `tests/fieldZones.test.js`, `tests/snapshots/field-zones.json`
- Modify: `js/felderLesson.js` (export the helpers it already has: `bare`, `isFinite` as `isFiniteVerb`, `isNonFinite`, `endsClause`, `clauseStart`, `findBracket`), `tests/run.js`, `tests/README.md`, `index.html` (import map)

**Interfaces:**
- Consumes: the helpers above from `js/felderLesson.js`; word shape from `js/types.js`.
- Produces: `fieldZones(words: Word[]): ?{lead: number[], vorfeld: number[], verb: number[], mittelfeld: number[], ende: number[]}` — word indices in sentence order; every index appears in exactly one list. Returns `null` when the sentence has no finite verb, has a subordinate clause (`clause_type === 'subordinate'` or a word of type `conjunction`), has more than one finite verb, or has words after the closing verb part.
  - `lead`: everything before `clauseStart(words)` (interjection with comma, leading coordinating conjunction)
  - `verb`: the finite verb. `vorfeld`: words between `lead` and the verb (empty for verb-first sentences)
  - `ende`: the closing part from `findBracket` (non-finite verb, or separable particle = type `preposition` ending its clause), plus directly adjacent non-finite verbs
  - `mittelfeld`: the rest

- [ ] **Step 1: Write the failing tests** using the `tagged(text, tags)` helper (move it from `tests/felderLesson.test.js` to `tests/stubs.js` and import it in both):

```js
const z = (text, tags) => fieldZones(tagged(text, tags));
test('fieldZones: subject first', () => assertEqual(z('Ich brauche einen Tisch.', 'S.ich V.ich O.m.akk O.m.akk'),
    { lead: [], vorfeld: [0], verb: [1], mittelfeld: [2, 3], ende: [] }));
test('fieldZones: modal bracket, adverb first', () =>
    assertEqual(z('Heute muss Ayisha im Krankenhaus arbeiten.', 'X M.er S.er P O.n.dat V'),
        { lead: [], vorfeld: [0], verb: [1], mittelfeld: [2, 3, 4], ende: [5] }));
test('fieldZones: separable particle', () => assertEqual(z('Ich rufe dich morgen an.', 'S.ich V.ich O.du.akk X P'),
    { lead: [], vorfeld: [0], verb: [1], mittelfeld: [2, 3], ende: [4] }));
test('fieldZones: yes/no question has an empty Vorfeld', () =>
    assertEqual(z('Kommst du heute?', 'V.du S.du X').vorfeld, []));
test('fieldZones: leading interjection and conjunction go to lead', () =>
    assertEqual(z('Ja, ich bin neu.', 'X S.ich V.ich X').lead, [0]));
test('fieldZones: two finite verbs → null', () =>
    assertEqual(z('Ich koche und er isst.', 'S.ich V.ich K S.er V.er'), null));
test('fieldZones: no verb → null', () => assertEqual(z('Guten Morgen!', 'X X'), null));
test('fieldZones: empty → null', () => assertEqual(fieldZones([]), null));
```

  Plus a snapshot test like the one in `tests/felderLesson.test.js`: for every sentence of every `data/library/A1_g*k*.json` file, write `"<text>": "V: … | Verb: … | M: … | E: …"` or `"-"` to `tests/snapshots/field-zones.json`; compare unless `--update`.
- [ ] **Step 2: Run** `gjs -m tests/run.js`. Expected: FAIL (module not found).
- [ ] **Step 3: Implement** `js/fieldZones.js`; add the import-map line; note the snapshot in `tests/README.md`.
- [ ] **Step 4: Create the snapshot and read it** — `gjs -m tests/run.js --update`, then read `tests/snapshots/field-zones.json` in full. Every non-`-` line must be a correct field analysis; a wrong one is fixed in the rules or made `null`, never left. Report the share of `-` lines.
- [ ] **Step 5: Run** `gjs -m tests/run.js`. Expected: exit 0.
- [ ] **Step 6: Commit** — `git add -A js tests index.html && git commit -m "Add pure field zones for main clauses"`

---

### Task 4: Ordnen logic (`orderExercise.js`)

**Files:**
- Create: `js/orderExercise.js`, `tests/orderExercise.test.js`
- Modify: `tests/run.js`, `index.html` (import map)

**Interfaces:**
- Consumes: `fieldZones` (Task 3), `bare` from `js/felderLesson.js`, `MAX_WRONG_ATTEMPTS` from `js/gameRules.js`.
- Produces:
  - `Field` = `'vorfeld' | 'verb' | 'mittelfeld' | 'ende'`
  - `orderModel(words: Word[]): ?{lead: string, fields: Field[], chips: {id: number, text: string, field: Field, fixed: boolean}[], end: string}` — chips in sentence order with `id` = index in that order. `fields` lists the slots to draw (`'ende'` only if the sentence has one; `'vorfeld'` always, also when empty). The Vorfeld is one chip with `fixed: true`. The verb is one chip, the Ende is one chip. Mittelfeld chips: a preposition joins the noun phrase after it; consecutive `subject`/`object` words with the same case and gender are one chip; every other word is its own chip. Chip text has no sentence-final punctuation; `end` holds it (`.`, `?`, `!`); `lead` is the lead words joined. Returns `null` when `fieldZones` is `null` or fewer than 3 chips are movable (`fixed === false`)
  - `createOrder(model, rng = Math.random): OrderState` — `{model, placed: {[id]: true}, attempts: {[id]: number}, mistakes: number, tray: number[]}`; fixed chips start placed; `tray` = movable chip ids shuffled and never in sentence order
  - `dropChip(state: OrderState, id: number, field: Field): {state: OrderState, ok: boolean, auto: boolean, hint: ?string}` — returns a new state. Right field: chip placed. Wrong field: `attempts[id]++`, `mistakes++`, and a hint; at `MAX_WRONG_ATTEMPTS` wrong tries the chip is placed for her (`auto: true`). Dropping a placed or unknown chip: unchanged state, `ok: false`, `hint: null`
  - `isSolved(state): boolean`; `fieldChips(state, field): chip[]` — the placed chips of a field in sentence order (this is what makes Mittelfeld order untested)
  - Hints (exact copy): a verb chip in another slot, or another chip in the Verb slot → `'Das Verb steht an Position 2.'` (verb-first sentence: `'Das Verb steht am Anfang.'`); the Ende chip elsewhere → `'Der zweite Verbteil steht am Ende.'`; another chip in the Ende slot → `'Am Ende steht nur der zweite Verbteil.'`; anything dropped on the Vorfeld → `'Das Vorfeld ist schon besetzt.'`

- [ ] **Step 1: Write the failing tests** (with `tagged` from `tests/stubs.js`; `m = orderModel(tagged('Heute muss Ayisha im Krankenhaus arbeiten.', 'X M.er S.er P O.n.dat V'))`):
  - `m.chips.map(c => [c.text, c.field, c.fixed])` equals `[['Heute','vorfeld',true],['muss','verb',false],['Ayisha','mittelfeld',false],['im Krankenhaus','mittelfeld',false],['arbeiten','ende',false]]`; `m.end === '.'`; `m.fields` equals `['vorfeld','verb','mittelfeld','ende']`.
  - `orderModel(tagged('Ich bin neu.', 'S.ich V.ich X'))` → `null` (2 movable chips).
  - `orderModel(tagged('Ja, ich bin heute neu.', 'X S.ich V.ich X X')).lead === 'Ja,'`.
  - Yes/no question `'Kommst du heute mit?'` (`'V.du S.du X P'`): no fixed chip, `fields[0] === 'vorfeld'`, wrong verb drop hint is `'Das Verb steht am Anfang.'`.
  - `createOrder(m, () => 0).tray` and `createOrder(m, () => 0.999).tray` both differ from `[1, 2, 3, 4]` and contain exactly those ids.
  - `dropChip(s, 1, 'verb')` → `ok: true`; state `placed[1]`; the input state object is not mutated.
  - `dropChip(s, 4, 'mittelfeld')` → `ok: false`, hint `'Der zweite Verbteil steht am Ende.'`, `mistakes === 1`.
  - `dropChip(s, 2, 'ende')` → hint `'Am Ende steht nur der zweite Verbteil.'`; `dropChip(s, 2, 'vorfeld')` → `'Das Vorfeld ist schon besetzt.'`.
  - Three wrong drops of chip 1 → third result has `auto: true` and the chip is placed.
  - Drop chip 3 then chip 2 into `'mittelfeld'` → `fieldChips(state, 'mittelfeld').map(c => c.text)` equals `['Ayisha', 'im Krankenhaus']`.
  - Two chips with the same text (`'Sie gibt sie ihr heute.'`) are told apart by `id`.
  - `dropChip(s, 99, 'verb')` and dropping an already placed chip → unchanged state, `hint: null`.
  - All movable chips placed → `isSolved` true.
- [ ] **Step 2: Run** `gjs -m tests/run.js`. Expected: FAIL (module not found).
- [ ] **Step 3: Implement** `js/orderExercise.js`; add the import-map line.
- [ ] **Step 4: Run** `gjs -m tests/run.js`. Expected: exit 0.
- [ ] **Step 5: Commit** — `git add -A js tests index.html && git commit -m "Add Ordnen exercise logic (rung 2)"`

---

### Task 5: Article blank (rung 3)

**Files:**
- Create: `js/articleBlank.js`, `tests/articleBlank.test.js`
- Modify: `js/gamemode.js` (constructor fields near line 64; `stop()`; `recordProgress` ~1636; `loadRandomSentenceAndContinue` ~1727; `getStoryChapter` ~1808; the three `promptSentence` calls), `js/playScreen.js` (`progressState` ~268, `currentSentenceParts` ~285), `tests/playScreen.test.js`, `tests/run.js`, `index.html` (import map)

**Interfaces:**
- Consumes: `bare` from `js/felderLesson.js`.
- Produces:
  - `ARTICLES: Set<string>` — `der die das den dem des ein eine einen einem einer eines kein keine keinen keinem keiner keines`
  - `articleIndexes(words: Word[]): number[]` — indices `i` where `bare(words[i].text).toLowerCase()` is in `ARTICLES`, `words[i]` and `words[i + 1]` are both `subject`/`object` typed and share case and gender (so a lone pronoun "Die ist neu." is not blanked)
  - `blankArticles(words: Word[], fromIndex: number): string[]` — the word texts, with every article at an index ≥ `fromIndex` replaced by `'___'` (punctuation around the word kept)
  - `hasArticle(words: Word[]): boolean` — rung 3 eligibility
  - `GameMode.articleBlank: boolean` (default `false`, reset in `stop()`): the play screen shows not-yet-placed articles blanked; the Hörübung prompt (`promptSentence`) is skipped while it is on
  - `GameMode.ladder: ?{total: number, index: number, record(sentence: Sentence, mistakes: number): void, next(): void}` (default `null`, reset in `stop()`). While set: `recordProgress` calls `this.ladder.record(sentence, countMistakes(this.sentenceMistakes))` instead of `progressStore.recordSentence`; `loadRandomSentenceAndContinue` calls `this.ladder.next()` and returns; `getStoryChapter()` returns `null`; `progressState` in `playScreen.js` returns `progressSegments(ladder.total, ladder.index, done)`
  - `playSentenceTexts(game): string[]` exported from `playScreen.js` — `blankArticles(game.words, start of the current phrase)` when `game.articleBlank` and a phrase is waiting, plain texts otherwise (sentence complete: nothing blanked); `currentSentenceParts` uses it

- [ ] **Step 1: Write the failing tests** (`tagged` from `tests/stubs.js`; note that `tagged` must also set `case` and `gender` from `O.<g>.<case>` / `S.<p>` tags — extend it if it does not):
  - `articleIndexes(tagged('Ich gebe dem Patienten einen Tee.', 'S.ich V.ich O.m.dat O.m.dat O.m.akk O.m.akk'))` equals `[2, 4]`.
  - `blankArticles(sameWords, 0)` equals `['Ich','gebe','___','Patienten','___','Tee.']`; with `fromIndex` 4 → `['Ich','gebe','dem','Patienten','___','Tee.']`.
  - `'Die ist neu.'` (`'S.sie V.sie X'`) → `articleIndexes` is `[]`, `hasArticle` false.
  - `'Ich wohne im Zentrum.'` (`'S.ich V.ich P O.n.dat'`) → `hasArticle` false (contraction stays).
  - `'Das ist mein Bruder.'` (`'S.er V.er S.m S.m'`) → `articleIndexes` is `[]` (possessive; "Das" is alone).
  - Capitalised sentence start `'Der Arzt kommt.'` → index 0 blanked, text `'___'`.
  - `'„Die Ärztin kommt.“'`-style punctuation: `blankArticles` keeps the quote mark (`'„___'`).
  - `playSentenceTexts({articleBlank: false, …})` returns plain texts; with `articleBlank: true` and the current phrase starting at index 2 the result has `'___'` at 2 and 4; with `waitingForContinue: true` nothing is blanked.
- [ ] **Step 2: Run** `gjs -m tests/run.js`. Expected: FAIL (module not found).
- [ ] **Step 3: Implement** `js/articleBlank.js`, the two `GameMode` fields and their four hooks, and `playSentenceTexts`; add the import-map line.
- [ ] **Step 4: Run** `gjs -m tests/run.js`. Expected: exit 0, library snapshot unchanged.
- [ ] **Step 5: Check on screen** — serve with `python3 -m http.server 8000`; in the browser console on a chapter sentence set `app.gameMode.articleBlank = true; app.redrawAll()`; take the headless screenshot from `CLAUDE.md` or check by hand that no unplaced article is readable anywhere on the play screen (sentence line, framed phrase, SVG grid) and that a correct placement shows it. Fix any place that still shows it.
- [ ] **Step 6: Commit** — `git add -A js tests index.html && git commit -m "Add article blank switch and ladder hook to the game (rung 3)"`

---

### Task 6: Ordnen screen (`orderScreen.js`)

**Files:**
- Create: `js/orderScreen.js`
- Modify: `index.html` (`<main class="screen" id="screen-order" aria-label="Ordnen" hidden></main>` next to the other screens; import map), `css/styles.css` (game-mode section), `js/app.js` (`showScreen` accepts `'order'`; bottom nav hidden as on `play`)

**Interfaces:**
- Consumes: `createOrder`, `dropChip`, `isSolved`, `fieldChips` (Task 4); `progressSegments` from `js/playScreen.js`; `gameSounds` from `js/sound.js` (`speak`, the existing correct/wrong effects).
- Produces: `renderOrderScreen(root: HTMLElement, opts: {model, total: number, index: number}, actions: {onDone(mistakes: number): void, onClose(): void}): void` — draws the whole screen into `root` and owns its state until `onDone` or `onClose`.

Layout (phone first, 400×850):

```
 ✕   ▬▬▬▬▬▭▭▭▭▭
 Bau den Satz.
 Ja,
 ┌ Vorfeld ┐ ┌ Verb ┐ ┌ Mittelfeld ──────┐ ┌ Ende ┐
 │ Heute   │ │      │ │                  │ │      │ .
 └─────────┘ └──────┘ └──────────────────┘ └──────┘
 [feedback line]
 [ arbeiten ] [ Ayisha ] [ muss ] [ im Krankenhaus ]
                                        [ Weiter › ]
```

- Slots wrap onto a second row on narrow screens; slot labels are `Vorfeld`, `Verb`, `Mittelfeld`, `Ende`. An empty Vorfeld (verb-first sentence) is drawn closed (hatched, not a drop target).
- Tap a chip to select it (`aria-pressed`), then tap a slot. Dragging is optional; tap-tap must work.
- Right drop: chip moves into the slot, correct sound. Wrong drop: chip shakes, wrong sound, the hint shows in the feedback line. Auto-placed chip: placed with the hint still shown.
- Solved: the sentence is spoken once (`gameSounds.speak(full sentence)`), the tray is replaced by `Weiter`, which calls `onDone(state.mistakes)`. ✕ calls `onClose()`.
- Slot colours follow the field model colours already in `css/styles.css` / `feldermodell.js`; use tokens, add none unless one is missing.

- [ ] **Step 1: Implement** the screen, CSS and `showScreen('order')`; add the import-map line.
- [ ] **Step 2: Run** `gjs -m tests/run.js`. Expected: exit 0 (module import and import-map checks cover the new file).
- [ ] **Step 3: Check on screen** — add a temporary debug call in the console: `import('./js/orderScreen.js')` with a model from `orderModel(app.wordManager.getAllWords())` for a loaded chapter sentence with a two-part verb; take screenshots at 400×850 and 1280×800 (command in `CLAUDE.md`). Confirm: all chips fit without horizontal scroll, a wrong drop shows its hint, three wrong drops auto-place, solving shows `Weiter`. Attach the screenshots' paths to the task report.
- [ ] **Step 4: Commit** — `git add -A js css index.html && git commit -m "Add Ordnen screen"`

---

### Task 7: Review runner, "Heute üben", recap

**Files:**
- Create: `js/reviewRunner.js`, `tests/reviewRunner.test.js`
- Modify: `js/app.js` (replace `startReview` ~1355 with `startLadderReview`; Home and Üben render calls ~1255–1285; `handleGameStopped`; `recordProgress` caller side via Task 5 hook), `js/gamemode.js` (`recordProgress`: pass eligibility to `recordSentence`), `js/homeScreen.js` (tile and Üben button; delete `countWeakSpots` and its test), `js/chapterRecap.js` (review recap), `tests/homeScreen.test.js`, `tests/chapterRecap.test.js`, `tests/run.js`, `index.html` (import map)

**Interfaces:**
- Consumes: `dueKeys`, `exerciseRung` (Task 1); `progressStore.recordReview`, `retire`, `sentenceKey` (Task 2); `orderModel` (Task 4); `hasArticle`, `GameMode.articleBlank`, `GameMode.ladder` (Task 5); `renderOrderScreen` (Task 6).
- Produces:
  - `rungEligibility(words: Word[]): {2: boolean, 3: boolean}` — `{2: orderModel(words) !== null, 3: hasArticle(words)}` (pure)
  - `buildQueue(keys: string[], findSentence: (key: string) => ?Sentence, getRung: (key: string) => number): {queue: {key, sentence, rung: 2|3, eligible}[], retired: string[]}` (pure) — a key whose sentence is not found, or whose `exerciseRung` is `null`, goes to `retired`. `rung` = `exerciseRung(getRung(key), rungEligibility(sentence.words))`
  - `class ReviewRunner { constructor({app, gameMode, progressStore}); start(queue): void; close(): void }` — plays the queue in order. Rung 2: `app.showScreen('order')` + `renderOrderScreen`; `onDone(mistakes)` → `progressStore.recordReview(key, mistakes === 0, eligible)`. Rung 3: loads the sentence, sets `gameMode.articleBlank = true` and `gameMode.ladder = {total, index, record, next}`, shows the play screen and starts the game; `record` → `recordReview(key, mistakes === 0, eligible)`. After the last sentence, or `close()`: clears `gameMode.articleBlank` and `gameMode.ladder`, stops the game if active, and calls `app.showReviewRecap(results)` (after the last) or `app.showScreen('home')` (on close). `results`: `{key, text, from: number, to: number, ok: boolean}[]`
  - `reviewRecapModel(results): {total: number, up: number, down: number, title: string, line: string}` in `js/chapterRecap.js` — `title: 'Geschafft!'`; `line`: `` `${up} von ${total} eine Stufe weiter · morgen wieder` `` (pure), and `renderReviewRecap(root, model, {home})` with one button `Zur Übersicht`
  - `app.startLadderReview(): Promise<void>` — bulk-loads the library for the levels in progress (as `startReview` does today), builds the queue from `dueKeys(progress.sentences, Date.now(), this.dailyGoal)`, retires the `retired` keys, and starts the runner; with an empty queue it re-renders Home
  - `app.showReviewRecap(results)` — `showScreen('end')` + `renderReviewRecap`
  - Home tile and Üben button: `renderHome` / `renderPractice` take `dueToday: number` instead of `weakSpots`. Tile: number + label `Heute üben`; title `Sätze von früher, eine Stufe schwerer`. When 0: disabled, label `Heute fertig`. Üben button: `` `Heute üben (${dueToday})` ``, disabled at 0
  - `GameMode.recordProgress` (no ladder session): `progressStore.recordSentence(key, mistakes, Date.now(), rungEligibility(this.words))`

- [ ] **Step 1: Write the failing tests:**
  - `rungEligibility` for the `'Heute muss Ayisha im Krankenhaus arbeiten.'` words → `{2: true, 3: false}`; for `'Ich bin neu.'` → `{2: false, 3: false}`.
  - `buildQueue(['a','b','c','d'], find, getRung)` where `b` is not found and `c` has no eligible rung → `queue` keys `['a','d']`, `retired` `['b','c']`; an entry at rung 2 whose sentence is only rung 3 eligible gets `rung: 3`.
  - `ReviewRunner` with stub `app` (`showScreen`, `showReviewRecap` recording calls), stub `gameMode` (`articleBlank`, `ladder`, `isActive`, `stop`, `start`) and a real `ProgressStore` on `makeLocalStorage()`:
    - a rung 3 item: after `start`, `gameMode.articleBlank === true` and `gameMode.ladder.total === queue.length`; calling `gameMode.ladder.record(sentence, 0)` then `gameMode.ladder.next()` on the last item → `showReviewRecap` called once with `ok: true`, and `gameMode.articleBlank === false`, `gameMode.ladder === null`.
    - `close()` after the first of three items → the first entry's `rung` changed, the other two entries unchanged and still in `dueKeys`; `gameMode.articleBlank === false`, `gameMode.ladder === null`; `showScreen('home')` called; `showReviewRecap` not called.
    - a mistake (`record(sentence, 2)`) on a rung 3 item → entry `rung === 2`, due tomorrow.
  - `reviewRecapModel([{ok:true,from:2,to:3},{ok:false,from:3,to:2},{ok:true,from:3,to:3}])` → `{total: 3, up: 1, down: 1, …}` with `line === '1 von 3 eine Stufe weiter · morgen wieder'`.
  - Home: `renderHome` with `dueToday: 4` shows `4` and `Heute üben`; with `dueToday: 0` the tile is disabled and says `Heute fertig` (follow how `tests/homeScreen.test.js` inspects rendered output today). Remove the `countWeakSpots` tests.
- [ ] **Step 2: Run** `gjs -m tests/run.js`. Expected: FAIL on the new tests.
- [ ] **Step 3: Implement** the runner, the recap, the Home/Üben changes and the `app.js` wiring; delete `startReview` and `countWeakSpots`; add the import-map line. The Werkstatt review toggle (`setReviewMode`, `reviewWeight`, picker mode `'review'`) stays as it is.
- [ ] **Step 4: Run** `gjs -m tests/run.js`. Expected: exit 0.
- [ ] **Step 5: Check the whole flow on screen** at 400×850: in the console set a few played sentences due (`for (const e of Object.values(app... progressStore.load().sentences)) e.due = 0`, save, reload); Home shows `Heute üben` with the capped count; tap it; play one Ordnen and one Artikel sentence; ✕ midway returns Home with the count reduced by the finished ones; a full session ends on the recap; Home then shows `Heute fertig` once the cap is reached; start a story chapter afterwards and confirm articles are visible again.
- [ ] **Step 6: Commit** — `git add -A js tests index.html && git commit -m "Add daily review session over the ladder (Heute üben)"`

---

### Task 8: Docs and ship

**Files:**
- Modify: `CLAUDE.md` (file list: `ladder.js`, `fieldZones.js`, `orderExercise.js`, `articleBlank.js`, `orderScreen.js`, `reviewRunner.js`; `progressStore.js` and `homeScreen.js` lines; link the spec and plan next to the other plans), `tests/README.md` (field-zones snapshot), `index.html` (versions)

- [ ] **Step 1: Update** `CLAUDE.md` and `tests/README.md`, one line per new module in the existing style.
- [ ] **Step 2: Bump versions** — `scripts/bump_version.sh`. Expected output: `index.html: N version strings -> <timestamp>`.
- [ ] **Step 3: Run** `gjs -m tests/run.js` and `python3 scripts/audit_library.py`. Expected: both exit 0.
- [ ] **Step 4: Commit** — `git commit -am "Document the production ladder, bump versions"`
