# Ladder Rungs 4–5 (Schreiben, Sprechen) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add dictation (rung 4) and speaking (rung 5) to the review ladder, with settings to switch each off and a self-check path when speech recognition is missing or wrong.

**Architecture:** One pure module compares typed and heard text with the expected sentence. Two new DOM screens follow the pattern of the Ordnen screen. The schedule's top moves to rung 5 and eligibility takes a device/settings environment. The review runner opens the new screens.

**Tech Stack:** Plain ES modules, Web Speech API (`speechSynthesis` already used; `SpeechRecognition` / `webkitSpeechRecognition` new), tests with `gjs -m tests/run.js`.

**Spec:** [docs/superpowers/specs/2026-11-16-ladder-write-speak-design.md](../specs/2026-11-16-ladder-write-speak-design.md)

**Depends on:** the production ladder plan (`2026-11-15-production-ladder.md`) fully built and merged. Before Task 1, read `js/ladder.js`, `js/reviewRunner.js`, `js/orderScreen.js` and `js/settings.js` as built; where a name below differs from the code, the code wins and the task report says so. Translations (content pipeline plan) are optional: everything works without them.

## Global Constraints

- Read `CLAUDE.md` first. Do not touch `backend/`. No new dependencies, no build, no `node`.
- `gamemode.js` is not changed by this plan.
- UI copy is German, exactly as written in the spec and this plan.
- Capitalisation differences and single-letter typos are shown but never counted as mistakes.
- A spoken pass is at least 80% of the expected words heard in order (`SPEECH_PASS = 0.8`); three tries (`SPEECH_TRIES = 3`); two tries for typing (`WRITE_TRIES = 2`).
- No audio is recorded before she has seen the privacy sentence and chosen.
- Phone first: 400×850. CSS tokens only; new CSS in the `GAME MODE VISUAL JUICE` section.
- Every new module gets an import-map line; every new test file is registered in `tests/run.js`.
- On-screen checks use headless Chrome (command in `CLAUDE.md`) with an uncommitted harness. Speech recognition cannot be exercised headless: say so in the report and list what the owner must try on the phone.
- Commit after each task. End commit messages with `Co-Authored-By: Claude <noreply@anthropic.com>`.

## Review Focus

1. **A sentence with numbers or abbreviations** ("Der Termin ist um 9 Uhr.", "Dr. Kühn"): digits 0–12 match their words in both directions, and "Dr." is not split into a sentence end. Test in Task 2.
2. **Repeated words** ("Sie gibt sie ihr."): alignment is by position, not by set membership, so typing "Sie gibt ihr." marks one `sie` missing. Test in Task 2.
3. **Empty input and whitespace-only input**: "Prüfen" is disabled; `compareTyped` with `''` returns every word missing and does not throw. Test in Task 2.
4. **Recognition events out of order**: `onend` without a result, `onerror: 'no-speech'`, `'not-allowed'`, and a result arriving after the screen was closed. Each resolves once; the closed screen ignores it. Test in Task 5.
5. **Leaving the screen while audio plays or the microphone is open**: speech is cancelled and recognition aborted on close. Test in Tasks 4 and 5.

## File Structure

| File | Responsibility |
|---|---|
| `js/ladder.js` | `RUNG_TOP = 5`; rung loops no longer assume two rungs |
| `js/textMatch.js` (new) | Pure: normalise, compare typed text, match heard text |
| `js/speechInput.js` (new) | Thin wrapper around browser speech recognition |
| `js/writeScreen.js` (new) | Rung 4 screen (`body[data-screen="write"]`) |
| `js/speakScreen.js` (new) | Rung 5 screen (`body[data-screen="speak"]`) |
| `js/settings.js` | Three new settings and `ladderEnv()` |
| `js/reviewRunner.js` | Eligibility with environment; opens the two screens |

---

### Task 1: Schedule to rung 5

**Model:** sonnet

**Files:**
- Modify: `js/ladder.js`, `js/reviewRunner.js` (`rungEligibility`), `js/progressStore.js` (default `eligible`), `tests/ladder.test.js`, `tests/reviewRunner.test.js`, `tests/progressStore.test.js`

**Interfaces:**
- Produces:
  - `RUNG_TOP = 5`. `Eligible` = `{2: boolean, 3: boolean, 4: boolean, 5: boolean}`; a missing key means `false`.
  - `exerciseRung(rung, eligible): 2|3|4|5|null` and `afterReview` unchanged in meaning, now over rungs 2–5.
  - `LadderEnv` = `{voice: boolean, write: boolean, speak: boolean}`
  - `rungEligibility(words: Word[], env: LadderEnv): Eligible` — rungs 2 and 3 as before; `4: env.voice && env.write`; `5: env.speak`
  - Default `eligible` wherever one existed (`recordSentence`'s parameter): `{2: true, 3: true, 4: true, 5: true}`

- [ ] **Step 1: Write the failing tests**
  - `afterReview({rung: 3, due: 0, topPasses: 0}, true, NOW, all)` → `{rung: 4, due: day(7), topPasses: 0}`; from rung 4 → `{rung: 5, due: day(14), topPasses: 0}`; from rung 5 → rung 5, `day(14)`, `topPasses: 1`; again with `topPasses: 1` → `day(30)`.
  - Fail on rung 5 → rung 4, tomorrow. Fail on rung 4 with `{2: true, 3: false, 4: true, 5: true}` → rung 2.
  - `exerciseRung(4, {2: true, 3: true, 4: false, 5: true})` → 5; `exerciseRung(5, {2: true, 3: true})` → 3.
  - An entry resting at `{rung: 3, topPasses: 2}` with all rungs eligible: pass → rung 4, `topPasses: 0`.
  - `rungEligibility(words, {voice: false, write: true, speak: true})[4]` is `false`; with `speak: false` → `[5]` is `false`.
  - The existing rung 2–3 tests that used `{2: true, 3: true}` as "both" still pass unchanged (keys 4 and 5 missing = not eligible = rung 3 is their top).
- [ ] **Step 2: Run** `gjs -m tests/run.js`. Expected: FAIL on the new tests.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `gjs -m tests/run.js`. Expected: exit 0.
- [ ] **Step 5: Commit** — `git commit -am "Extend the ladder schedule to rungs 4 and 5"`

---

### Task 2: Text matching (`textMatch.js`)

**Model:** sonnet

**Files:**
- Create: `js/textMatch.js`, `tests/textMatch.test.js`
- Modify: `tests/run.js`, `index.html` (import map)

**Interfaces:**
- Produces (pure):
  - `SPEECH_PASS = 0.8`
  - `tokens(text: string): string[]` — words without punctuation; abbreviations keep their letters (`Dr.` → `Dr`); hyphenated words stay one token
  - `fold(word: string): string` — lower case, `ä→ae`, `ö→oe`, `ü→ue`, `ß→ss`, digits 0–12 → their German word (`null, eins, zwei, … zwölf`; `ein/eine` are not folded to `1`)
  - `compareTyped(expected: string, typed: string): {pass: boolean, words: {text: string, status: 'ok'|'case'|'typo'|'wrong'|'missing', typed: ?string}[], extra: string[]}` — one entry per expected token, aligned by a word-level edit-distance alignment (not by set membership). `ok`: same token, or equal after `fold` with the same first-letter case. `case`: equal after `fold`, capital differs. `typo`: Levenshtein distance 1 after `fold`, expected token length ≥ 4. `wrong`: aligned to a different word. `missing`: no typed word aligned. `pass` = no `wrong`, no `missing`, no `extra`
  - `speechMatch(expected: string, heard: string[]): {pass: boolean, ratio: number, best: string, words: {text: string, heard: boolean}[]}` — for each alternative, the longest common subsequence of folded tokens; `ratio` = matched / expected tokens for the best alternative; `pass` = `ratio >= SPEECH_PASS`; `heard: []` → `ratio: 0`, `best: ''`

- [ ] **Step 1: Write the failing tests**

```js
const st = (e, t) => compareTyped(e, t).words.map(w => w.status);
test('typed: exact', () => assertEqual(compareTyped('Ich bin Ärztin.', 'Ich bin Ärztin').pass, true));
test('typed: ae for ä, ss for ß', () => assertEqual(st('Die Ärztin heißt Petra.', 'Die Aerztin heisst Petra'), ['ok', 'ok', 'ok', 'ok']));
test('typed: capital only → case, still a pass', () => {
    const r = compareTyped('Ich brauche einen Tisch.', 'ich brauche einen tisch');
    assertEqual(r.words.map(w => w.status), ['case', 'ok', 'ok', 'case']); assertEqual(r.pass, true); });
test('typed: two letters swapped is distance 2 → wrong', () =>
    assertEqual(st('Ich arbeite im Krankenhaus.', 'Ich arbeite im Krankenhuas'), ['ok', 'ok', 'ok', 'wrong']));
test('typed: single substitution → typo', () =>
    assertEqual(st('Ich arbeite im Krankenhaus.', 'Ich arbeite im Krankenhous'), ['ok', 'ok', 'ok', 'typo']));
test('typed: short word one letter off → wrong', () => assertEqual(st('Ich bin neu.', 'Ich bin nei'), ['ok', 'ok', 'wrong']));
test('typed: wrong article is wrong, not a typo', () => assertEqual(st('Ich sehe den Mann.', 'Ich sehe dem Mann'), ['ok', 'ok', 'wrong', 'ok']));
test('typed: missing word keeps alignment', () => assertEqual(st('Sie gibt sie ihr.', 'Sie gibt ihr'), ['ok', 'ok', 'missing', 'ok']));
test('typed: extra word', () => { const r = compareTyped('Ich bin neu.', 'Ich bin sehr neu');
    assertEqual(r.extra, ['sehr']); assertEqual(r.pass, false); });
test('typed: empty input', () => { const r = compareTyped('Ich bin neu.', '   ');
    assertEqual(r.words.map(w => w.status), ['missing', 'missing', 'missing']); assertEqual(r.pass, false); });
test('typed: digit for a number word', () => assertEqual(compareTyped('Der Termin ist um neun Uhr.', 'Der Termin ist um 9 Uhr').pass, true));
test('typed: abbreviation', () => assertEqual(compareTyped('Dr. Kühn kommt.', 'Dr Kuehn kommt').pass, true));
test('speech: all heard', () => assertEqual(speechMatch('Heute muss ich arbeiten.', ['heute muss ich arbeiten']).pass, true));
test('speech: 4 of 5 passes, 3 of 5 fails', () => {
    assertEqual(speechMatch('Ich gehe heute zum Arzt.', ['ich gehe heute zum']).pass, true);
    assertEqual(speechMatch('Ich gehe heute zum Arzt.', ['ich gehe zum']).pass, false); });
test('speech: best alternative wins', () =>
    assertEqual(speechMatch('Ich bin Ärztin.', ['ich bin erst in', 'ich bin Ärztin']).best, 'ich bin Ärztin'));
test('speech: order matters', () => assertEqual(speechMatch('Ich bin neu hier.', ['hier neu bin ich']).ratio, 0.25));
test('speech: digits', () => assertEqual(speechMatch('Ich habe zwei Brüder.', ['ich habe 2 Brüder']).pass, true));
test('speech: nothing heard', () => assertEqual(speechMatch('Ich bin neu.', []).ratio, 0));
```

- [ ] **Step 2: Register and run** `gjs -m tests/run.js`. Expected: FAIL (module not found).
- [ ] **Step 3: Implement** `js/textMatch.js`; add the import-map line.
- [ ] **Step 4: Run** `gjs -m tests/run.js`. Expected: exit 0.
- [ ] **Step 5: Commit** — `git add js/textMatch.js tests index.html && git commit -m "Add typed and spoken text matching"`

---

### Task 3: Settings and environment

**Model:** sonnet

**Files:**
- Modify: `js/settings.js` (`SETTINGS_KEYS`, `settingsRows`, getters/setters in its existing style), `js/sound.js` (only if no public "German voice available" getter exists: add `hasGermanVoice(): boolean` and `speak(text, {queue, rate})` with `rate` default 1), `tests/settings.test.js`, `tests/sound.test.js`

**Interfaces:**
- Consumes: the existing settings-row structure and the German voice detection in `js/sound.js`.
- Produces:
  - localStorage keys `ladderWrite` (default on: anything but `'false'`), `ladderSpeak` (default on), `speechRecognition` (`'on' | 'off' | unset` = not asked yet)
  - `getLadderWrite(storage)`, `setLadderWrite(storage, on)`, `getLadderSpeak`, `setLadderSpeak`, `getRecognitionChoice(storage): 'on'|'off'|null`, `setRecognitionChoice(storage, choice)`
  - `ladderEnv({storage, hasVoice}): LadderEnv` — `{voice: hasVoice, write: getLadderWrite(storage), speak: getLadderSpeak(storage)}`
  - Rows in Einstellungen, after "Hörübung": `Schreiben üben` / `Sätze hören und schreiben.` (greyed without a German voice); `Sprechen üben` / `Sätze laut sagen.`; `Spracherkennung` / `Die Aufnahme geht zur Erkennung an Google.` (greyed when `speechAvailable` is false; on = `'on'`, off = `'off'`)
  - `gameSounds.speak(text, {rate})` passes `rate` to the utterance

- [ ] **Step 1: Write the failing tests**: fresh storage → write on, speak on, recognition `null`; stored `'false'` → off; `ladderEnv` with `hasVoice: false` → `voice: false`; `settingsRows` contains the three rows with the exact labels, the write row disabled without a voice, the recognition row disabled when recognition is unavailable; `speak('x', {rate: 0.7})` sets the utterance rate (follow how `tests/sound.test.js` stubs `speechSynthesis`).
- [ ] **Step 2: Run** `gjs -m tests/run.js`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `gjs -m tests/run.js`; screenshot the Einstellungen screen at 400×850 and confirm the three rows fit the existing layout.
- [ ] **Step 5: Commit** — `git commit -am "Add settings for typing, speaking and speech recognition"`

---

### Task 4: Schreiben screen (rung 4)

**Model:** sonnet

**Files:**
- Create: `js/writeScreen.js`, `tests/writeScreen.test.js`
- Modify: `index.html` (`<main class="screen" id="screen-write" aria-label="Schreiben" hidden></main>`; import map), `css/styles.css`, `js/app.js` (`showScreen('write')`, nav hidden as on `order`), `tests/run.js`

**Interfaces:**
- Consumes: `compareTyped` (Task 2); `gameSounds.speak(text, {rate})` and `gameSounds.cancelPrompt()` or the existing way to stop speech; `progressSegments` from `js/playScreen.js`.
- Produces:
  - `WRITE_TRIES = 2`
  - Pure `writeStep(state: {tries: number}, result: {pass: boolean}): {tries: number, done: boolean, ok: boolean, reveal: boolean}` — pass → `done, ok`; fail with `tries + 1 < WRITE_TRIES` → not done; fail on the last try → `done, ok: false, reveal: true`
  - Pure `retryText(result): string` — the text put back into the input after a failed first try: `ok`, `case` and `typo` words as typed, each `wrong`/`missing` word as underscores of the expected length, extras dropped
  - `renderWriteScreen(root, opts: {text: string, translation: ?string, total: number, index: number}, actions: {onDone(ok: boolean): void, onClose(): void}): void`
- Behaviour beyond the spec's sketch: the input is a `<textarea rows="2">` with `autocapitalize="sentences" autocomplete="off" autocorrect="off" spellcheck="false" lang="de"`; Enter triggers "Prüfen"; "Prüfen" is disabled while the input is blank; after `done` the tray is replaced by the sentence, its marks (✓ ok, `~` case/typo with the expected spelling, ✗ wrong), the translation if any, and `Weiter`, which calls `onDone(ok)`. `onClose` and `onDone` both stop speech.

- [ ] **Step 1: Write the failing tests** for `writeStep` (pass first try; fail then pass → `ok: true`; fail twice → `ok: false, reveal: true`) and `retryText` (`compareTyped('Ich sehe den Mann.', 'Ich sehe dem Man')` → `'Ich sehe ___ Man'`: "Man" is one deletion from "Mann", a 4-letter word, so it stays as a typo).
- [ ] **Step 2: Run** `gjs -m tests/run.js`. Expected: FAIL.
- [ ] **Step 3: Implement** the screen, CSS and `showScreen('write')`; add the import-map line.
- [ ] **Step 4: Run** `gjs -m tests/run.js`. Expected: exit 0.
- [ ] **Step 5: Check on screen** at 400×850 with a harness that calls `renderWriteScreen` and fills the textarea by script: first-try pass, fail-then-fix, and reveal after two fails each look right; the on-screen keyboard area (bottom 40%) does not hide the input or "Prüfen" (place them in the top half).
- [ ] **Step 6: Commit** — `git add -A js css tests index.html && git commit -m "Add Schreiben screen (rung 4)"`

---

### Task 5: Sprechen screen (rung 5)

**Model:** opus (browser API with awkward event order, privacy flow)

**Files:**
- Create: `js/speechInput.js`, `js/speakScreen.js`, `tests/speakScreen.test.js`
- Modify: `index.html` (`screen-speak`; import map), `css/styles.css`, `js/app.js` (`showScreen('speak')`), `tests/run.js`

**Interfaces:**
- Consumes: `speechMatch` (Task 2); `getRecognitionChoice` / `setRecognitionChoice` (Task 3); `gameSounds.speak`.
- Produces:
  - `js/speechInput.js`: `speechAvailable(win = globalThis): boolean` (a `SpeechRecognition` or `webkitSpeechRecognition` constructor exists); `listen({lang = 'de-DE', maxAlternatives = 5, win = globalThis}): {result: Promise<{heard: string[], error: ?string}>, abort(): void}` — resolves exactly once: with the alternatives of the final result, or `heard: []` and `error` = the recogniser's error code (`'no-speech'`, `'not-allowed'`, `'network'`, `'aborted'`) or `'no-result'` when it ends silently. `abort()` resolves with `error: 'aborted'`.
  - `SPEECH_TRIES = 3`, `CUE_MS = 4000`
  - Pure `speakMode({available: boolean, choice: 'on'|'off'|null}): 'ask'|'recognise'|'self'` — unavailable or `'off'` → `'self'`; `'on'` → `'recognise'`; `null` → `'ask'`
  - Pure `speakStep(state: {tries: number}, match: {pass: boolean}, error: ?string): {tries: number, done: boolean, ok: boolean, fallback: boolean}` — `error === 'not-allowed'` → `fallback: true` (switch to self-check, try not counted); `'no-speech'`, `'no-result'`, `'aborted'` → try not counted; pass → `done, ok`; fail → `tries + 1`, `done` and `ok: false` at `SPEECH_TRIES`
  - `renderSpeakScreen(root, opts: {text: string, translation: ?string, total: number, index: number, storage: Storage}, actions: {onDone(ok: boolean): void, onClose(): void}): void`
- Copy: prompt `Sag den Satz auf Deutsch.` (with translation) or `Lies. Merk dir. Sprich.` (German shown for `CUE_MS` or until tapped, then hidden); privacy card title `Spracherkennung`, text `Die Aufnahme geht zur Erkennung an Google.`, buttons `Einverstanden` / `Ohne Erkennung üben`; heard line `Gehört: „…“`; buttons `Anhören`, `Nochmal`, `Weiter`; link `Die Erkennung hat sich geirrt`; self-check question `Hattest du es richtig?` with `Ja` / `Noch nicht`; no-speech hint `Ich habe nichts gehört. Tipp auf das Mikrofon und sprich.`

- [ ] **Step 1: Write the failing tests**
  - `speakMode` for the three cases.
  - `speakStep`: pass → done ok; three fails → done not ok on the third; `'no-speech'` leaves `tries` unchanged; `'not-allowed'` → `fallback: true`.
  - `listen` with a fake recogniser class on a fake `win` (records `start`/`abort`, lets the test fire `onresult`, `onerror`, `onend`): result then end → resolves once with the alternatives; `onerror('no-speech')` then `onend` → `error: 'no-speech'`; `onend` alone → `'no-result'`; `abort()` → `'aborted'`; a late `onresult` after resolution changes nothing.
- [ ] **Step 2: Run** `gjs -m tests/run.js`. Expected: FAIL.
- [ ] **Step 3: Implement** both modules, the CSS and `showScreen('speak')`. Closing the screen aborts an open `listen` and stops speech; a result that arrives after close is ignored.
- [ ] **Step 4: Run** `gjs -m tests/run.js`. Expected: exit 0.
- [ ] **Step 5: Check on screen** at 400×850 with a harness and a fake recogniser injected through `win`: the privacy card on first use, a pass, a fail with the "geirrt" link leading to the self-check, and the self-check-only mode. Report that real recognition was not exercised and must be tried on the phone.
- [ ] **Step 6: Commit** — `git add -A js css tests index.html && git commit -m "Add Sprechen screen (rung 5)"`

---

### Task 6: Runner wiring and ship

**Model:** sonnet

**Files:**
- Modify: `js/reviewRunner.js`, `js/app.js` (pass the environment and translations), `js/gamemode.js` (only the `recordProgress` call that passes eligibility, to add the environment), `tests/reviewRunner.test.js`, `CLAUDE.md`, `docs/roadmap.md`, `index.html` (versions via `scripts/bump_version.sh`)

**Interfaces:**
- Consumes: everything above.
- Produces:
  - `buildQueue(keys, findSentence, getRung, env: LadderEnv)` — eligibility computed with `env`
  - `ReviewRunner` constructor option `env: () => LadderEnv` (read at session start) and `translationFor: (sentence) => ?string` (from the loaded chapter file's `translations`, else `null`)
  - Rung 4 → `showScreen('write')` + `renderWriteScreen`; rung 5 → `showScreen('speak')` + `renderSpeakScreen`; both call `progressStore.recordReview(key, ok, eligible)` from `onDone` and go on to the next item
  - The recap line is unchanged

- [ ] **Step 1: Write the failing tests** (runner with stubs, as in the existing runner tests): a rung 4 item opens the write screen (stub records the call) and `onDone(true)` records rung 5; a rung 5 item with `onDone(false)` records rung 4 due tomorrow; with `env.speak === false` a rung 5 entry is shown its highest eligible rung instead; `close()` during a write item leaves the entry unchanged.
- [ ] **Step 2: Run** `gjs -m tests/run.js`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `gjs -m tests/run.js`. Expected: exit 0.
- [ ] **Step 5: Check the flow** at 400×850: set two sentences to rung 4 and 5 due today in the console, start "Heute üben", complete both (speaking in self-check mode), reach the recap.
- [ ] **Step 6: Docs and ship** — add the new modules to `CLAUDE.md`'s file list, set project 3's status in `docs/roadmap.md`, run `scripts/bump_version.sh`, run `gjs -m tests/run.js`.
- [ ] **Step 7: Commit** — `git commit -am "Open Schreiben and Sprechen from the review session"`
- [ ] **Step 8: Hand the owner a phone checklist**: real German dictation audio at both speeds; the ä/ö/ü/ß buttons; the keyboard not covering "Prüfen"; microphone permission prompt; one sentence recognised; one misheard and overruled.
