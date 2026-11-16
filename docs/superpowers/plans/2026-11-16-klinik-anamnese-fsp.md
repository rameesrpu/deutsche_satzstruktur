# Klinik: Anamnese, Arztbrief and FSP Practice Implementation Plan (5b)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Practice for the patient interview, the doctor's letter and the three parts of the Fachsprachprüfung, on invented cases, with the Anamnesebogen and the Arztbrief as fixed spatial layouts.

**Architecture:** One generic "drop chips on labelled zones" exercise (pure logic + screen) serves question sorting and letter sorting. Cases are JSON files in one format that drives the interview, the letter and the exam run. Long typed and spoken answers are compared with a model by the learner (self-rating).

**Tech Stack:** Plain ES modules, JSON data, tests with `gjs -m tests/run.js`.

**Spec:** [docs/superpowers/specs/2026-11-16-medical-track-design.md](../specs/2026-11-16-medical-track-design.md)

**Depends on:** plan 5a (`2026-11-16-klinik-maps-terms.md`) built (Klinik screen, tiles, `docs/medical-sources.md` with the verified FSP format). Useful but optional: `gameSounds.speak` with `rate`, `js/speechInput.js` and `js/textMatch.js` from the rungs 4–5 plan; where they are missing, the affected step says what to do. Before Task 1 read `js/klinik.js`, `js/orderExercise.js` and `js/orderScreen.js` as built. **Re-read the spec and `docs/medical-sources.md` first; if the verified FSP format differs from the spec, the verified format wins and Task 5 follows it.**

## Global Constraints

- Read `CLAUDE.md` first. Do not touch `backend/`. No new dependencies, no build, no `node`.
- Patients, cases and hospitals are invented. No real persons. No medical advice.
- Medical content must be correct and typical. Every case and every question list is reviewed by the owner's wife (a doctor) before it ships (Tasks 2, 3 and 5 stop for that).
- Content stays within the story's rules (halal; no alcohol history used as a joke, though "Trinken Sie Alkohol?" is a standard Sozialanamnese question and belongs in the list).
- German in cases: patient answers at B1 (short everyday sentences); doctor questions and letter sentences as a German doctor would write them. Every German sentence has an English `en`.
- No automatic grading of free text or free speech. Model answer beside her answer, then self-rating: `Passt` / `Teilweise` / `Noch nicht`.
- UI copy is German, exactly as written in this plan. Phone first: 400×850. CSS tokens only.
- Every new module gets an import-map line; every new test file is registered in `tests/run.js`.
- Commit after each task. End commit messages with `Co-Authored-By: Claude <noreply@anthropic.com>`.

## Review Focus

1. **A chip that fits two zones** (a question that could be Vorerkrankungen or Medikamente): the data may list more than one accepted zone, and the check accepts each. Test in Task 1.
2. **A case file with a missing section** (no Familienanamnese): the interview skips it, the form shows the box empty with `nicht erhoben`, nothing crashes. Test in Task 3.
3. **Leaving the exam run in part 2 and coming back**: the typed text is kept (localStorage draft per case) and the clock resumes from where it was. Test in Task 5.
4. **A very long typed documentation** on a phone: the side-by-side comparison stacks vertically and both texts scroll with the page, not inside tiny boxes. Checked in Task 5.
5. **No German voice or no microphone**: patient answers still show as text; part 3 still works with self-rating only. Checked in Tasks 3 and 5.

## File Structure

| File | Responsibility |
|---|---|
| `js/sortExercise.js` (new) | Pure: chips, zones, drop checking, attempts |
| `js/sortScreen.js` (new) | DOM for "drop chips on labelled zones" |
| `data/medical/anamnese.json` (new) | Sections and standard questions |
| `data/medical/faelle/*.json` (new) | Cases |
| `js/caseFlow.js` (new) | Pure: steps of an interview, form state, letter chips, exam state |
| `js/caseScreen.js` (new) | Interview, letter and exam screens |
| `js/klinik.js` | Tiles open the new parts |

---

### Task 1: Sort exercise

**Model:** sonnet

**Files:**
- Create: `js/sortExercise.js`, `js/sortScreen.js`, `tests/sortExercise.test.js`
- Modify: `index.html` (`<main class="screen" id="screen-sort" aria-label="Sortieren" hidden></main>`; import map), `css/styles.css`, `js/app.js` (`showScreen('sort')`), `tests/run.js`

**Interfaces:**
- Consumes: `MAX_WRONG_ATTEMPTS` from `js/gameRules.js`; the look of the Ordnen screen.
- Produces:
  - `SortModel` = `{title: string, zones: {id: string, title: string}[], chips: {id: string, text: string, zones: string[], en: ?string}[]}` — `chips[].zones` lists every accepted zone id
  - `createSort(model, rng = Math.random): SortState` — `{model, placed: {[chipId]: zoneId}, attempts: {[chipId]: number}, mistakes: number, tray: string[]}` (tray shuffled)
  - `dropOnZone(state, chipId, zoneId): {state: SortState, ok: boolean, auto: boolean}` — a new state; right zone → placed there; wrong → `attempts + 1`, `mistakes + 1`; at `MAX_WRONG_ATTEMPTS` the chip is placed in its first accepted zone (`auto: true`); unknown or placed chip → unchanged, `ok: false`
  - `sortSolved(state): boolean`; `zoneChips(state, zoneId): chip[]` (in placing order)
  - `renderSortScreen(root, opts: {model, total: number, index: number, hint: ?(chip, zoneId) => string}, actions: {onDone(mistakes: number): void, onClose(): void}): void` — zones as labelled boxes stacked vertically (each grows with its chips), tray of chips below; tap a chip then a zone; wrong drop shakes and shows `hint(chip, zoneId)` or `Das gehört woanders hin.`; solved → `Weiter`. Tapping a placed chip shows its `en`

- [ ] **Step 1: Write the failing tests**: right drop places; wrong drop counts and does not place; a chip with two accepted zones is right in either; three wrong drops auto-place into the first accepted zone; dropping a placed or unknown chip changes nothing; `sortSolved` after all chips; the input state is not mutated; `createSort` with `() => 0` and `() => 0.999` both contain every chip id once.
- [ ] **Step 2: Run** `gjs -m tests/run.js`. Expected: FAIL.
- [ ] **Step 3: Implement** both modules, CSS and `showScreen('sort')`.
- [ ] **Step 4: Run** `gjs -m tests/run.js`. Expected: exit 0.
- [ ] **Step 5: Check on screen** at 400×850 with a harness model of 5 zones and 10 chips: everything reachable by scrolling down only; a wrong and a right drop.
- [ ] **Step 6: Commit** — `git add -A js css tests index.html && git commit -m "Add sort-into-zones exercise"`

---

### Task 2: Anamnese sections and questions (stops for the owner)

**Model:** opus (medical German; must read naturally)

**Files:**
- Create: `data/medical/anamnese.json`, `tests/caseFlow.test.js` (data test only in this task)
- Modify: `js/klinik.js` (the `Anamnese` tile opens a menu: `Fragen sortieren`, and later `Gespräch`), `tests/klinik.test.js`, `tests/run.js`

**Interfaces:**
- Consumes: `renderSortScreen` (Task 1).
- Produces:
  - `{version: number, sections: {id: string, title: string, en: string, questions: {id: string, de: string, en: string, also: ?string[]}[]}[]}` — `also` = other section ids where the question is also acceptable
  - Sections, in interview order: `beschwerden` `Aktuelle Beschwerden` · `vorerkrankungen` `Vorerkrankungen und Operationen` · `medikamente` `Medikamente` · `allergien` `Allergien` · `vegetativ` `Vegetative Anamnese` · `familie` `Familienanamnese` · `sozial` `Sozialanamnese`
  - 6–8 questions per section in the formal *Sie* form. Style anchors (use these, add the rest): `beschwerden`: „Was führt Sie zu uns?“, „Seit wann haben Sie die Beschwerden?“, „Wo genau tut es weh?“, „Können Sie den Schmerz beschreiben?“, „Wie stark sind die Schmerzen auf einer Skala von eins bis zehn?“ · `vorerkrankungen`: „Haben Sie Vorerkrankungen?“, „Wurden Sie schon einmal operiert?“ · `medikamente`: „Nehmen Sie regelmäßig Medikamente ein?“ · `allergien`: „Haben Sie Allergien?“ · `vegetativ`: „Wie ist Ihr Appetit?“, „Haben Sie Fieber?“, „Schlafen Sie gut?“ · `familie`: „Gibt es Erkrankungen in Ihrer Familie?“ · `sozial`: „Was machen Sie beruflich?“, „Rauchen Sie?“, „Trinken Sie Alkohol?“
  - `questionSortModel(anamnese, rng, size = 10): SortModel` in `js/klinik.js` (pure) — `size` random questions as chips, the seven sections as zones, `also` merged into each chip's `zones`
  - `Fragen sortieren` runs `questionSortModel` on the sort screen and returns to the Anamnese menu

- [ ] **Step 1: Write the failing tests**: data test (7 sections in the order above, 6–8 questions each, ids unique across the file, every `de` ends with `?`, every `en` non-empty, every `also` id is a section id); `questionSortModel` gives 10 chips with at least one zone each and 7 zones.
- [ ] **Step 2: Run** `gjs -m tests/run.js`. Expected: FAIL.
- [ ] **Step 3: Write** the data file and implement the menu and the model function.
- [ ] **Step 4: Run** `gjs -m tests/run.js`. Expected: exit 0.
- [ ] **Step 5: Stop.** Give the owner the full question list by section as a readable sheet (German with English) for his wife to review: are these the questions a German doctor asks, and is each in the right section? Apply changes.
- [ ] **Step 6: Commit** — `git add -A js data tests && git commit -m "Add Anamnese sections, questions and question sorting"`

---

### Task 3: Cases and the interview (stops for the owner)

**Model:** opus

**Files:**
- Create: `js/caseFlow.js`, `js/caseScreen.js`, `data/medical/faelle/bauchschmerzen.json`, `data/medical/faelle/index.json`
- Modify: `tests/caseFlow.test.js`, `js/klinik.js` (Anamnese menu: `Gespräch` lists the cases), `index.html` (`screen-case`; import map), `css/styles.css`, `js/app.js`

**Interfaces:**
- Consumes: `data/medical/anamnese.json` (Task 2); `gameSounds.speak`.
- Produces:
  - `data/medical/faelle/index.json`: `{cases: {id: string, title: string, level: string}[]}`
  - Case = `{id, title, level, patient: {name: string, age: number, job: string, en: string}, interview: {section: string, question: string, wrong: [string, string], answer: {de: string, en: string}, fact: {de: string, en: string}, distractors: [{de: string, en: string}, {de: string, en: string}]}[], brief: {section: 'diagnosen'|'anamnese'|'befund'|'therapie'|'empfehlung', de: string, en: string}[], dokumentation: {section: string, model: string}[], vorstellung: {skeleton: string, model: string}}` — `question` and `wrong` are question ids from `anamnese.json` (`wrong` from other sections or unfitting at this point); `fact` is the note that belongs in the form (`seit drei Tagen Bauchschmerzen rechts unten`), `distractors` are two notes that do not follow from the answer
  - Pure `interviewSteps(caseData, anamnese): {section: {id, title}, options: {id: string, de: string}[] (three, order by rng argument), answerId: string, answer, factOptions: {de: string, right: boolean}[]}[]` — sections the case does not cover produce no step
  - Pure `formState(caseData, anamnese, doneSteps: number): {id: string, title: string, notes: string[], empty: boolean}[]` — all seven sections; a section without steps has `empty: true`
  - Pure `interviewScore(results: {question: boolean, fact: boolean}[]): {questions: number, facts: number, total: number}`
  - `renderInterview(root, opts: {caseData, anamnese, clock: ?{minutes: number}}, actions: {onDone(score), onClose()})` — top: patient card (name, age, job). Middle: the Anamnesebogen as seven labelled boxes (two columns on wide screens, one on a phone), filling as she goes; an uncovered section shows `nicht erhoben` at the end. Bottom: per step, the section name and three question buttons; a wrong question shakes and counts; the right one is spoken, then the patient's answer appears as a speech bubble and is spoken; then three note chips, she taps the one that follows from the answer and it moves into the section's box. Tapping any German sentence shows its English. End: `` `${questions} von ${total} Fragen, ${facts} von ${total} Notizen beim ersten Versuch` `` and `Fertig`
- First case `bauchschmerzen`: a 24-year-old student with pain in the right lower abdomen since the day before, nausea, slight fever, no prior illness (suspected appendicitis). Level `B1`. Covers all seven sections, 10–12 interview steps, a letter of 10–12 sentences across the five sections, a model documentation per section, and a presentation skeleton and model.

- [ ] **Step 1: Write the failing tests** (with a small case object in the test): `interviewSteps` gives one step per interview entry with three options including `answerId`; a case without `familie` yields no step for it and `formState` marks it `empty`; `formState` after two done steps holds two notes in the right sections; `interviewScore` counts first-try results; data test over every file in `data/medical/faelle/` listed in `index.json`: question ids exist in `anamnese.json`, each `question` belongs to its `section` (directly or via `also`), brief sections are among the five, every German string has an `en`.
- [ ] **Step 2: Run** `gjs -m tests/run.js`. Expected: FAIL.
- [ ] **Step 3: Write** the case file and implement `caseFlow.js` and `renderInterview`.
- [ ] **Step 4: Run** `gjs -m tests/run.js`. Expected: exit 0.
- [ ] **Step 5: Check on screen** at 400×850: the whole interview can be completed; the form stays readable as it fills; without a German voice the answers still appear.
- [ ] **Step 6: Stop.** Give the owner a readable sheet of the case (interview, notes, letter, documentation, presentation; German with English) for medical and language review by his wife. Apply changes.
- [ ] **Step 7: Commit** — `git add -A js css data tests index.html && git commit -m "Add case format, first case and the Anamnese interview"`

---

### Task 4: Arztbrief

**Model:** sonnet

**Files:**
- Modify: `js/caseFlow.js`, `js/klinik.js` (the `Arztbrief` tile lists the cases), `tests/caseFlow.test.js`, `css/styles.css`

**Interfaces:**
- Consumes: `renderSortScreen` (Task 1); the case's `brief`.
- Produces:
  - `BRIEF_SECTIONS = [{id: 'diagnosen', title: 'Diagnosen'}, {id: 'anamnese', title: 'Anamnese'}, {id: 'befund', title: 'Befund'}, {id: 'therapie', title: 'Therapie und Verlauf'}, {id: 'empfehlung', title: 'Empfehlung'}]`
  - Pure `briefSortModel(caseData): SortModel` — one chip per `brief` sentence (id = its index), zones = `BRIEF_SECTIONS`, title `` `Arztbrief: ${caseData.title}` ``
  - Pure `briefHint(chip, zoneId): string` — fixed hints by the chip's right section: `diagnosen` → `Eine Diagnose steht ganz oben.`; `anamnese` → `Das hat die Patientin erzählt: Anamnese.`; `befund` → `Das hat die Ärztin festgestellt: Befund.`; `therapie` → `Das wurde gemacht: Therapie und Verlauf.`; `empfehlung` → `Das soll danach passieren: Empfehlung.`
  - After the sort is solved: the finished letter as one page (the five headings with their sentences in the file's order) and `Fertig`

- [ ] **Step 1: Write the failing tests**: `briefSortModel` for the test case (chip count = sentences, five zones); `briefHint` for each section.
- [ ] **Step 2: Run** `gjs -m tests/run.js`. Expected: FAIL.
- [ ] **Step 3: Implement**; set the `Arztbrief` tile to open the case list.
- [ ] **Step 4: Run** `gjs -m tests/run.js`; check on screen at 400×850 that the letter page after solving reads as a letter.
- [ ] **Step 5: Commit** — `git commit -am "Add Arztbrief sorting for cases"`

---

### Task 5: FSP practice run (stops for the owner)

**Model:** opus

**Files:**
- Modify: `js/caseFlow.js`, `js/caseScreen.js`, `js/klinik.js` (the `Fachsprachprüfung` tile lists the cases), `tests/caseFlow.test.js`, `css/styles.css`
- Create: `data/medical/faelle/brustschmerzen.json`, `data/medical/faelle/handgelenk.json`; update `index.json`

**Interfaces:**
- Consumes: `renderInterview` with `clock` (Task 3); the verified exam format in `docs/medical-sources.md`.
- Produces:
  - `EXAM_PARTS = [{id: 'gespraech', title: 'Arzt-Patienten-Gespräch', minutes: 20}, {id: 'dokumentation', title: 'Dokumentation', minutes: 20}, {id: 'vorstellung', title: 'Arzt-Arzt-Gespräch', minutes: 20}]` — titles and minutes corrected to the verified format
  - localStorage key `` `fspDraft/${caseId}` `` = `{part: number, startedAt: number, elapsedMs: number, texts: {[section]: string}}`
  - Pure `examState(draft: ?object, now: number): {part: number, remainingMs: number, texts: object}` — no draft → part 0 with the full time; the clock counts only while a part is open (elapsed time is saved on leaving)
  - Pure `RATINGS = ['Passt', 'Teilweise', 'Noch nicht']`; `examSummary(score, docRatings: number[], talkRating: number): {lines: string[]}` — three lines, one per part
  - `renderExam(root, opts: {caseData, anamnese, storage}, actions: {onClose()})`: part 1 = the interview with the clock (the clock is shown, running out only turns it red: nothing is cut off); part 2 = one textarea per documentation section (the Anamnesebogen sections that have a model), saved to the draft as she types, then `Vergleichen`: her text above the model text per section, each with the three rating buttons; part 3 = the `vorstellung.skeleton` shown, `Ich bin fertig` → the model is shown and spoken (`Anhören`), then one rating; end = the summary and `Fertig` (the draft is deleted)
- Two more cases in the same format: `brustschmerzen` (a 58-year-old bus driver with chest pain on exertion for two weeks, smoker, father had a heart attack; suspected angina pectoris; level `B2`) and `handgelenk` (a 67-year-old retired teacher who slipped on ice and fell on her outstretched hand; painful, swollen wrist; suspected distal radius fracture; level `B1`).

- [ ] **Step 1: Write the failing tests**: `examState(null, now)` → part 0, 20 minutes; a draft with `elapsedMs` 5 minutes → 15 minutes remaining and the saved texts; `examSummary` produces three lines; the case data test (Task 3) passes for the two new files.
- [ ] **Step 2: Run** `gjs -m tests/run.js`. Expected: FAIL.
- [ ] **Step 3: Write** the two cases and implement the exam run.
- [ ] **Step 4: Run** `gjs -m tests/run.js`. Expected: exit 0.
- [ ] **Step 5: Check on screen** at 400×850: a full run on `bauchschmerzen`; leave in part 2 and return (text and clock kept); the comparison stacks vertically and scrolls with the page.
- [ ] **Step 6: Stop.** Give the owner the review sheets for the two new cases for his wife. Apply changes.
- [ ] **Step 7: Commit** — `git add -A js css data tests && git commit -m "Add FSP practice run and two more cases"`

---

### Task 6: Docs and ship

**Model:** sonnet

**Files:**
- Modify: `CLAUDE.md` (file list: `sortExercise.js`, `sortScreen.js`, `caseFlow.js`, `caseScreen.js`; Data: the case format and the review rule), `data/stories/AUTHORING.md` if it exists (a short section "Writing a case": format, review sheet, the doctor's review), `docs/roadmap.md` (progress tracker), `index.html` (versions)

- [ ] **Step 1: Update** the docs.
- [ ] **Step 2:** `scripts/bump_version.sh`; `gjs -m tests/run.js`. Expected: exit 0.
- [ ] **Step 3: Commit** — `git commit -am "Document Anamnese, Arztbrief and FSP practice, bump versions"`
