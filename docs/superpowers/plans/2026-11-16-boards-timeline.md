# Timeline Board Implementation Plan (4c)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A board for time: sentence cards dropped on Vergangenheit / Jetzt / Zukunft, the Perfekt built as a clamp around the sentence, and verbs sorted into *haben* or *sein*.

**Architecture:** A new board kind `timeline` on the framework from plan 4a. A verb list in JSON holds the forms; pure functions build every sentence and every set of choices. No picture file: the line and the clamp are drawn with HTML and CSS.

**Tech Stack:** Plain ES modules, CSS, JSON data, tests with `gjs -m tests/run.js`.

**Spec:** [docs/superpowers/specs/2026-11-16-spatial-boards-design.md](../specs/2026-11-16-spatial-boards-design.md)

**Depends on:** plan 4a (`2026-11-16-boards-body-map.md`) built, including the `itemIds` hook. If plan 4b is not built yet, add the hook first: it is the first bullet of plan 4b Task 1 ("Framework hook") with its test. Before Task 1 read `js/boards.js` and `js/boardScreen.js` as built.

## Global Constraints

- All Global Constraints of plan 4a apply (colours, copy, phone first, versions, import map, commits).
- Verb forms are used exactly as listed in Task 1. Wrong participles are offered only as wrong choices and are never shown as correct anywhere.
- The time words are fixed: `Gestern` (past), `Jetzt` (now), `Morgen` (future). With a time word in front, the verb stays in second place (`Gestern habe ich …`).
- Zone labels: `Vergangenheit`, `Jetzt`, `Zukunft`.
- Hints, exact copy: `Bewegung oder Veränderung → sein`; `sein und bleiben: immer mit sein`; `Alle anderen → haben`; for a future card with a present-tense verb: `Morgen + Präsens = Zukunft`.

## Review Focus

1. **Separable verbs**: the present-tense card splits the verb (`Jetzt rufe ich meine Mutter an.`) and the Perfekt joins it (`… angerufen`). Test in Task 1.
2. **Subjects that are names**: `Ayisha`, `Faris`, `Lea`, `Max` take the third-person helper (`hat` / `ist`) and stay capitalised after the time word. Test in Task 1.
3. **Verbs whose participle equals the infinitive** (*bekommen*, *vergessen*): the wrong choices must not include the right form twice, and `haben oder sein?` still works. Test in Task 1.
4. **An empty rest** (no object): no double space, no space before the full stop. Test in Task 1.
5. **Dropping a card outside every zone, or twice quickly**: no answer for the first, exactly one answer for the second. Checked in Task 2.

## File Structure

| File | Responsibility |
|---|---|
| `js/timelineBoard.js` (new) | `timeline` kind: pure builders + the three modes |
| `js/boards.js` | Registry entry |
| `data/boards/zeit.json` (new) | Verb list in two sets |

---

### Task 1: Verb data and sentence logic

**Model:** sonnet

**Files:**
- Create: `js/timelineBoard.js` (pure part), `tests/timelineBoard.test.js`, `data/boards/zeit.json`
- Modify: `js/boards.js` (`BOARDS` entry), `tests/run.js`, `index.html` (import map)

**Interfaces:**
- Produces:
  - `BOARDS` entry: id `zeit`, title `Die Zeit`, kind `timeline`, file `data/boards/zeit.json`, modes `wann` / `Wann?`, `klammer` / `Klammer`, `hilfsverb` / `haben oder sein?` (all scored)
  - Sets: `perfekt-1`, title `Perfekt 1`, unlock `{level: 'A1', category: 'g5k3', label: 'Beim Arzt 5.3'}`; `perfekt-2`, title `Perfekt 2`, unlock `{level: 'A2', category: 'g1k1', label: 'Der Sprachkurs 1.1'}` (stays locked until that chapter exists)
  - `Verb` item = `{id, inf, en, aux: 'haben'|'sein', partizip, wrong: [string, string], person: 'ich'|'du'|'er'|'wir'|'ihr', subject, finite, particle: ?string, rest: string}`
  - `AUX = {haben: {ich: 'habe', du: 'hast', er: 'hat', wir: 'haben', ihr: 'habt'}, sein: {ich: 'bin', du: 'bist', er: 'ist', wir: 'sind', ihr: 'seid'}}`
  - `timeSentence(verb, zone: 'past'|'now'|'future'): string` — past: `Gestern <aux form> <subject> <rest> <partizip>.`; now: `Jetzt <finite> <subject> <rest> <particle>.`; future: `Morgen <finite> <subject> <rest> <particle>.`; empty parts leave no extra space
  - `timelineItemIds(set, modeId): string[]` — `wann`: `<id>.past`, `<id>.now`, `<id>.future` for every verb; other modes: the verb ids
  - `clampFrame(verb): {before: string, middle: string, auxOptions: [string, string], auxAnswer: string, partOptions: string[], partAnswer: string}` — `before` = subject with a capital first letter; `middle` = `gestern <rest>` trimmed; `auxOptions` = the *haben* form then the *sein* form for the person; `partOptions` = the participle and the two wrong forms, order decided by an `rng` argument (default `Math.random`)
  - `clampSentence(verb): string` — `<Subject> <aux form> gestern <rest> <partizip>.`
  - `auxHint(verb): string` — `sein` / `bleiben` → `sein und bleiben: immer mit sein`; other *sein* verbs → `Bewegung oder Veränderung → sein`; *haben* verbs → `Alle anderen → haben`
- Verbs, set `perfekt-1` (inf · aux · participle · wrong forms · subject (person) · finite · rest):
  - machen · haben · gemacht · gemachen, machte · ich (ich) · mache · die Hausaufgaben
  - kochen · haben · gekocht · gekochen, kochte · Ayisha (er) · kocht · Biryani
  - kaufen · haben · gekauft · gekaufen, kaufte · wir (wir) · kaufen · Brot
  - lernen · haben · gelernt · gelernen, lernte · ich (ich) · lerne · Deutsch
  - arbeiten · haben · gearbeitet · gearbeiten, arbeitete · Faris (er) · arbeitet · lange
  - spielen · haben · gespielt · gespielen, spielte · wir (wir) · spielen · Cricket
  - essen · haben · gegessen · geessen, aß · du (du) · isst · eine Brezel
  - trinken · haben · getrunken · getrinkt, trank · Lea (er) · trinkt · Tee
  - sehen · haben · gesehen · geseht, sah · ich (ich) · sehe · die Hühner
  - gehen · sein · gegangen · gegeht, ging · wir (wir) · gehen · in den Park
  - fahren · sein · gefahren · gefahrt, fuhr · Max (er) · fährt · nach Hause
  - kommen · sein · gekommen · gekommt, kam · ihr (ihr) · kommt · spät
- Verbs, set `perfekt-2` (same columns; separable verbs give finite + particle):
  - schlafen · haben · geschlafen · geschlaft, schlief · ich (ich) · schlafe · lange
  - lesen · haben · gelesen · gelest, las · Ayisha (er) · liest · ein Buch
  - schreiben · haben · geschrieben · geschreibt, schrieb · du (du) · schreibst · eine E-Mail
  - sprechen · haben · gesprochen · gesprecht, sprach · wir (wir) · sprechen · Deutsch
  - nehmen · haben · genommen · genehmt, nahm · ich (ich) · nehme · die S-Bahn
  - finden · haben · gefunden · gefindet, fand · Ayisha (er) · findet · ein Foto
  - helfen · haben · geholfen · gehelft, half · Faris (er) · hilft · Ayisha
  - anrufen · haben · angerufen · angeruft, geanruft · ich (ich) · rufe + an · meine Mutter
  - einkaufen · haben · eingekauft · eingekaufen, geeinkauft · wir (wir) · kaufen + ein · im Kerala Store
  - aufstehen · sein · aufgestanden · aufgesteht, geaufstanden · Max (er) · steht + auf · um drei Uhr
  - ankommen · sein · angekommen · angekommt, geankommen · ich (ich) · komme + an · in Stuttgart
  - fliegen · sein · geflogen · gefliegt, flog · Ayisha (er) · fliegt · nach Deutschland
  - laufen · sein · gelaufen · gelauft, lief · du (du) · läufst · zum Bus
  - bleiben · sein · geblieben · gebleibt, blieb · wir (wir) · bleiben · zu Hause
  - sein · sein · gewesen · geseint, war · ich (ich) · bin · müde
  - werden · sein · geworden · gewerdet, wurde · Lea (er) · wird · krank
  - besuchen · haben · besucht · gebesucht, besuchte · wir (wir) · besuchen · Frau Schäfer
  - verstehen · haben · verstanden · geverstanden, verstehte · ich (ich) · verstehe · alles
  - bekommen · haben · bekommen · gebekommen, bekam · Ayisha (er) · bekommt · einen Brief
  - vergessen · haben · vergessen · gevergessen, vergaß · Max (er) · vergisst · die Kehrwoche
  - studieren · haben · studiert · gestudiert, studierte · du (du) · studierst · in Stuttgart
  - telefonieren · haben · telefoniert · getelefoniert, telefonierte · ich (ich) · telefoniere · mit Umma
  - aufwachen · sein · aufgewacht · aufgewachen, geaufwacht · ich (ich) · wache + auf · früh
  - einschlafen · sein · eingeschlafen · eingeschlaft, geeinschlafen · Lea (er) · schläft + ein · schnell

- [ ] **Step 1: Write the failing tests** (verbs taken from the real data file by id):
  - `timeSentence(kochen, 'past')` → `Gestern hat Ayisha Biryani gekocht.`; `'now'` → `Jetzt kocht Ayisha Biryani.`; `'future'` → `Morgen kocht Ayisha Biryani.`
  - `timeSentence(anrufen, 'now')` → `Jetzt rufe ich meine Mutter an.`; `'past'` → `Gestern habe ich meine Mutter angerufen.`
  - `timeSentence(kommen, 'past')` → `Gestern seid ihr spät gekommen.`
  - A verb object with `rest: ''` → `Gestern habe ich geschlafen.` (no double space).
  - `clampSentence(gehen)` → `Wir sind gestern in den Park gegangen.`; `clampFrame(gehen)` → `before: 'Wir'`, `middle: 'gestern in den Park'`, `auxOptions: ['haben', 'sind']`, `auxAnswer: 'sind'`, `partAnswer: 'gegangen'`, and `partOptions` holds `gegangen`, `gegeht`, `ging` in some order.
  - `clampFrame(bekommen).partOptions` has three distinct entries and contains `bekommen` once.
  - `auxHint` for `sein`, `bleiben`, `fahren`, `kochen` gives the four expected strings.
  - `timelineItemIds(set1, 'wann').length === 36`; `timelineItemIds(set1, 'klammer').length === 12`.
  - Data test: sets of 12 and 24 verbs; ids unique; `aux` is `haben` or `sein`; `wrong` has two entries, neither equal to `partizip`; `person` is one of the five; names (`Ayisha`, `Faris`, `Lea`, `Max`) have person `er`; every verb with a `particle` has an `inf` that starts with it.
- [ ] **Step 2: Run** `gjs -m tests/run.js`. Expected: FAIL.
- [ ] **Step 3: Implement** the registry entry, the data file and the pure functions.
- [ ] **Step 4: Run** `gjs -m tests/run.js`. Expected: exit 0.
- [ ] **Step 5: Read every generated sentence once**: print `timeSentence` for all 36 verbs × 3 zones and `clampSentence` for all 36 to a scratch file and read them. Each must be a correct German sentence. Put any you had to fix in the report.
- [ ] **Step 6: Commit** — `git add js data tests index.html && git commit -m "Add timeline board data and sentence logic"`

---

### Task 2: Timeline modes on screen

**Model:** sonnet

**Files:**
- Modify: `js/timelineBoard.js` (DOM part; `registerKind('timeline', {renderSet, itemIds: timelineItemIds})`), `js/app.js` (import so it registers), `css/styles.css`

**Interfaces:**
- Consumes: the `ctx` contract (plan 4a Task 3); the pure functions (Task 1).
- Produces: `renderSet(root, ctx)`:
  - `wann`: a horizontal line with three zones (`Vergangenheit`, `Jetzt`, `Zukunft`), `Jetzt` marked with a dot on the line. The sentence card is shown and spoken. She taps a zone (or drags the card onto it). Right: the card settles into the zone. Wrong: it bounces back and the right zone pulses. For a future card the hint `Morgen + Präsens = Zukunft` shows after the answer.
  - `klammer`: the frame `<before> [ ? ] <middle> [ ? ].` with the two gaps drawn as the arms of a clamp joined by a bar above the sentence, open at first. Step 1: the two helper-verb buttons. Step 2: the three participle buttons. A right choice fills its gap. When both are filled the clamp closes (the bar tightens) and `clampSentence` is spoken. A wrong choice marks the item wrong, shows the right form in the gap, and for the helper verb shows `auxHint`. The item is right only if both choices were right the first time.
  - `hilfsverb`: a card with the infinitive and its meaning; two bins: `haben` and `sein` (the `sein` bin carries a small arrow from a dot to a dot). She taps a bin. After the answer `auxHint` shows and the Perfekt sentence (`clampSentence`) is shown and spoken.
  - `ctx.onAnswer(ok)` is called exactly once per item; a tap outside every zone or bin does nothing.

- [ ] **Step 1: Implement** the renderer and CSS (tokens only; the clamp uses the verb colour already used by the field model's verb slots).
- [ ] **Step 2: Run** `gjs -m tests/run.js`. Expected: exit 0.
- [ ] **Step 3: Check on screen** at 400×850 and 1280×800 with an uncommitted harness: each mode with one right and one wrong answer; a separable verb in `klammer`; the longest sentence (`einkaufen`) fits the width without horizontal scroll (it may wrap to two lines; the clamp must still join the two gaps).
- [ ] **Step 4: Commit** — `git add js css && git commit -m "Add timeline modes: Wann?, Klammer, haben oder sein?"`

---

### Task 3: Docs and ship

**Model:** sonnet

**Files:**
- Modify: `CLAUDE.md` (file list: `timelineBoard.js`), `docs/roadmap.md` (progress tracker), `index.html` (versions)

- [ ] **Step 1: Update** the docs.
- [ ] **Step 2:** `scripts/bump_version.sh`; `gjs -m tests/run.js`. Expected: exit 0.
- [ ] **Step 3: Commit** — `git commit -am "Document the timeline board, bump versions"`
