# Roadmap

> **Audience**: the owner and AI coding agents starting from a fresh conversation.
> This is the map of what comes next and why, plus the progress tracker. Each project has a
> design in `docs/superpowers/specs/` and one or more plans in `docs/superpowers/plans/`.
> **When you finish a task, tick it in the tracker below and commit.**

Written 2026-11-15 from a brainstorm with the owner; plans for all projects added 2026-11-16.

## Direction

**The one fixed idea:** use visual and spatial ability to speed up learning German. Everything
else may change.

**Who it is for:** one learner, the owner's wife. A doctor from Kerala, complete beginner in
German, moving to Stuttgart. She needs everyday German, then a hospitation or job, the German
medical system, and later the Fachsprachprüfung (FSP: B2 general, C1 medical). She uses an
Android phone. There is no date yet.

**Decisions (owner, 2026-11-15):**

- Build the best possible tool for her first. A product for many learners (for example foreign
  doctors heading to Germany) is parked, but must stay possible: keep the engine separate from
  the content, and treat her story as one content pack.
- It stays a plain website. No installable app, no offline mode, no accounts, no backend.
- Work goes one project at a time: design doc → plan → build with subagents.

## What limits the app today

1. **Recognition only.** The game hands her a phrase and she places it. She never builds,
   types or says a sentence. A hospitation and the FSP are almost entirely production.
2. **The spatial idea covers one slice of German.** Cases and word order are visual; vocabulary,
   tenses, prepositions, listening and medical language are not.
3. **Content is made by hand.** A1 is 5 stories, 17 chapters, 377 hand-tagged sentences. The
   FSP path needs roughly ten times more.

## Progress tracker

Status words: **not started**, **in progress**, **done**. "Owner stop" = the task waits for
the owner's answer or review.

### Overview

| # | Project | Plan | Status | Needs first |
|---|---|---|---|---|
| 1 | Production ladder, rungs 2–3 | [plan](superpowers/plans/2026-11-15-production-ladder.md) · [design](superpowers/specs/2026-11-15-production-ladder-design.md) | done (2026-11-17; on branch `production-ladder`, not merged) | – |
| 2 | Content pipeline | [plan](superpowers/plans/2026-11-16-content-pipeline.md) · [design](superpowers/specs/2026-11-16-content-pipeline-design.md) | in progress (1 of 7; branch `content-pipeline`) | – |
| 3 | Ladder rungs 4–5 (Schreiben, Sprechen) | [plan](superpowers/plans/2026-11-16-ladder-write-speak.md) · [design](superpowers/specs/2026-11-16-ladder-write-speak-design.md) | not started | 1 |
| 4a | Boards framework and body map | [plan](superpowers/plans/2026-11-16-boards-body-map.md) · [design](superpowers/specs/2026-11-16-spatial-boards-design.md) | not started | 1 |
| 4b | Preposition scene | [plan](superpowers/plans/2026-11-16-boards-preposition-scene.md) | not started | 4a |
| 4c | Timeline | [plan](superpowers/plans/2026-11-16-boards-timeline.md) | not started | 4a |
| 5a | Klinik: maps and terms | [plan](superpowers/plans/2026-11-16-klinik-maps-terms.md) · [design](superpowers/specs/2026-11-16-medical-track-design.md) | not started | 4a |
| 5b | Klinik: Anamnese, Arztbrief, FSP | [plan](superpowers/plans/2026-11-16-klinik-anamnese-fsp.md) | not started | 5a (better after 2 and 3) |

Recommended order: 1 → 2 → 3 → 4a → 4b → 4c → 5a → 5b. Project 2 touches only scripts and
story data, so it can also run beside project 1. The order is a recommendation, not an owner
decision.

### 1. Production ladder, rungs 2–3

Branch `production-ladder` (not merged, not pushed).

- [x] Task 1: Schedule (`ladder.js`) — commit `287b795`
- [x] Task 2: Progress store, format version 2 — commit `80f681b`
- [x] Task 3: Field zones (`fieldZones.js`) — commits `804eac2`, `c9a4158`
- [x] Task 4: Ordnen logic (`orderExercise.js`) — commit `0a0ece9`
- [x] Task 5: Article blank (rung 3) — commit `8add6e0`
- [x] Task 6: Ordnen screen — commits `c85bce4`, `d63a145`
- [x] Task 7: Review runner, "Heute üben", recap — commits `a2a051a`, `f5aade2`
- [x] Task 8: Docs and ship — commit `8d4e399`
- [x] Whole-branch review (Opus) and its fix wave — commit `f023e86`
- [ ] Merge to `main` — the owner's step, after the phone check below

What the reviews changed against the plan (rulings, each can be undone):
- The recap line reads "n von m richtig · morgen wieder", not "n von m eine Stufe weiter": at
  the top rung a perfect session would have read "0 von 10 eine Stufe weiter".
- Ordnen refuses (skips rung 2 for) sentences with a tail after an inner comma ("Was machst
  du, Max?"). A preposition phrase is one chip ("um sieben Uhr", "in einem Büro").
- Articles are found by phrase, also before adjectives ("ein großes Haus"). Of the 957
  library sentences, 450 can be played on rung 2 and 409 on rung 3.
- A sentence whose library file fails to load is skipped for the day, not taken off the ladder.
- The hint after a wrong placement still names the gender ("Tisch" is masculine (der)) on rung 3.
- The Home tile shows the number and "Heute üben" on two lines; the Üben button reads
  "Heute üben (n)".

Parked (small, known):
- The Ordnen top bar has no score (the design lists one; Ordnen awards no points).
- A review session fetches library files only for the levels of the first batch of due
  sentences; a due sentence from another level waits a day.
- After a failed library load the Home tile can show a higher number than the session plays.
- Keyboard focus is lost when the Ordnen screen redraws (tap-only on the phone).

### 2. Content pipeline

- [x] Task 1: Translations in the story format — commit `e0dad3e`
- [ ] Task 2: Chapter checker (`scripts/check_story.py`)
- [ ] Task 3: Review sheet (`scripts/story_review.py`)
- [ ] Task 4: Authoring guide and `write-chapter` skill
- [ ] Task 5: A2 chapter list — **owner stop** (approve the table)
- [ ] Task 6: A1 translation backfill (five story files)
- [ ] Task 7: Pilot chapter A2 1.1 — **owner stop** twice (outline, review sheet)

### 3. Ladder rungs 4–5

- [ ] Task 1: Schedule to rung 5
- [ ] Task 2: Text matching (`textMatch.js`)
- [ ] Task 3: Settings and environment
- [ ] Task 4: Schreiben screen (rung 4)
- [ ] Task 5: Sprechen screen (rung 5)
- [ ] Task 6: Runner wiring and ship — ends with a phone checklist for the owner

### 4a. Boards framework and body map

- [ ] Task 1: Box schedule and session queue
- [ ] Task 2: Board progress in the store
- [ ] Task 3: Registry, Üben section, board screen shell
- [ ] Task 4: Hotspot logic and body vocabulary
- [ ] Task 5: Pictures and point positions — **owner stop** (approve the figure)
- [ ] Task 6: Hotspot modes on screen
- [ ] Task 7: Docs and ship

### 4b. Preposition scene

- [ ] Task 1: Scene data and sentence logic
- [ ] Task 2: Garden picture and positions — **owner stop**
- [ ] Task 3: Scene modes on screen
- [ ] Task 4: Docs and ship

### 4c. Timeline

- [ ] Task 1: Verb data and sentence logic
- [ ] Task 2: Timeline modes on screen
- [ ] Task 3: Docs and ship

### 5a. Klinik: maps and terms

- [ ] Task 1: Research the path — **owner stop** (needs web access; check official sources)
- [ ] Task 2: Klinik screen and route
- [ ] Task 3: Term pairs board
- [ ] Task 4: The ward — **owner stop**
- [ ] Task 5: Docs and ship

### 5b. Klinik: Anamnese, Arztbrief, FSP

- [ ] Task 1: Sort exercise
- [ ] Task 2: Anamnese sections and questions — **owner stop** (doctor's review)
- [ ] Task 3: Cases and the interview — **owner stop** (doctor's review)
- [ ] Task 4: Arztbrief
- [ ] Task 5: FSP practice run — **owner stop** (doctor's review)
- [ ] Task 6: Docs and ship

## Needs owner review

Items the agent decided alone because the owner asked not to be stopped. Each says what to
look at. Remove an item when it is checked.

### Project 1 — production ladder (branch `production-ladder`)

- **Phone checklist (not done by anyone yet).** Everything on screen was checked only in
  headless desktop Chrome at 400×850, never on a phone, never with real touch or sound.
  On her Android phone, after serving the branch:
  1. Home shows the "Heute üben" tile with a number no higher than the daily goal.
  2. Tap it. An Ordnen sentence: tap a chip, tap a slot; a wrong slot shakes and shows a
     German hint; three wrong tries place the chip; "Weiter" appears when solved and the
     sentence is spoken once.
  3. An Artikel sentence: the article reads "___" until the phrase is placed, and is not
     spoken before that (also with Hörübung switched on in Einstellungen).
  4. ✕ in the middle returns to Home and the number is lower by the finished sentences.
  5. A full session ends on "Geschafft!"; Home then says "Heute fertig".
  6. Start a story chapter afterwards: articles are visible, progress counts as before.
  7. Nothing scrolls sideways on the Ordnen screen with a long sentence.
- **Existing progress.** The first load converts her stored progress to the new format and
  spreads the already played sentences over the coming days. Export her progress
  (Werkstatt) before she opens the new version, as a backup.
- **Wording.** The recap line and the other calls listed under "What the reviews changed
  against the plan" in the tracker.

## How to run a plan from a new conversation

1. Say which plan: "Execute `docs/superpowers/plans/<file>.md` with subagent-driven
   development." The agent reads the plan and its design.
2. Work on a branch, not on `main`.
3. Each task names a model (**Model:** sonnet / opus). Reviews after each task: Sonnet.
   Whole-branch review at the end: Opus.
4. Every plan after the first was written before the code it builds on existed. Each says
   "the code wins": the agent reads the modules named under **Depends on** first and adapts
   names. Expect small corrections.
5. Tick the tasks here as they finish.

## Read before executing: calls the owner has not confirmed

Projects 2–5 were designed without the usual back-and-forth, at the owner's request. Each
design lists "My calls" and "Open questions". The ones that change the most:

| Project | Call made for you | Where to change it |
|---|---|---|
| 2 | The pipeline runs inside a Claude Code session, not as a script with an API key | content pipeline design, Non-goals |
| 2 | You read every chapter before it ships | content pipeline design, Anti-goals |
| 2 | A2 continues the story with medical scenes inside it (no separate early medical track) | content pipeline design, part 5 |
| 3 | Typing is dictation, not translation; one retry is free; capitals never count | write/speak design, Rung 4 |
| 3 | Speaking uses Chrome's recognition, which sends audio to Google; she can practise without it | write/speak design, Privacy |
| 4 | Boards have their own review button and are not mixed into "Heute üben" | boards design, Non-goals |
| 4 | The body figure is a neutral mannequin outline; pictures are drawn as SVG by the agent | boards design, Anti-goals |
| 5 | Klinik is open from the start with levels marked; Baden-Württemberg only | medical design, My calls |
| 5 | Long written and spoken answers are self-rated against a model answer | medical design, Non-goals |

## The projects in short

### 1. Production ladder, rungs 2–3

Every sentence she has played comes back on a schedule, one rung harder each time.

| Rung | Name | What she does |
|---|---|---|
| 1 | Platzieren | Today's game: phrase given, pick cell and case |
| 2 | Ordnen | Phrases shuffled; drop them into the field model slots |
| 3 | Artikel | Article blanked; placing the phrase in the grid produces it |
| 4 | Schreiben | Hear the sentence, type it (project 3) |
| 5 | Sprechen | Say the sentence; the phone checks it (project 3) |

Home gets a "Heute üben" tile, capped at her daily goal.

### 2. Content pipeline

Translations in the story data, a chapter checker, a review sheet for the owner, an authoring
guide with a project skill, the A2 chapter list, and one pilot A2 chapter. After it, "write
chapter A2 1.2" is one conversation.

### 3. Ladder rungs 4–5

Dictation with forgiving checks, and speaking with recognition plus a self-check when the
recogniser is missing or wrong. Both can be switched off in Einstellungen.

### 4. Spatial boards

Picture-based practice on the Üben screen with its own five-box schedule.
- **Body map:** four pictures (front, back, face, organs), four modes including "Wo tut es weh?".
- **Preposition scene:** a hen in Frau Schäfer's garden. An arrow means movement (Akkusativ),
  a dot means rest (Dativ).
- **Timeline:** sentence cards on past / now / future, the Perfekt as a clamp, verbs sorted
  into *haben* or *sein*.
- Not planned yet: "places as memory" (words reviewed in the room where she met them). The
  hotspot board from 4a is the tool for it.

### 5. Medical track ("Klinik")

- **5a:** the path to the Approbation in Baden-Württemberg as a route she ticks off (facts
  researched from official sources, with dates), about fifty medical ↔ everyday term pairs,
  and the ward as rooms and roles.
- **5b:** the Anamnese as a form that fills during an interview with an invented patient, the
  Arztbrief as a page with fixed sections, and a three-part FSP practice run on three cases.
- This design is the least certain: it is furthest away and holds facts that must be verified.
  Re-read it when its turn comes.

## Parked or dropped

- **Product for many learners:** accounts, sync, a backend, more explanation languages, an
  authoring tool. Parked until the method is proven on one learner.
- **Installable app and offline mode:** dropped. No big advantage for one learner, and it
  complicates updates. Speech features work in Android Chrome without it.
- **Progress backup:** went with the installable app. Progress still lives only in the
  phone's localStorage (export/import exists). Worth revisiting if she ever loses progress.

## Older plans

- [story-plan.md](story-plan.md): S3 (narrated story mode) is still open.
- [experience-plan.md](experience-plan.md), [redesign-plan.md](redesign-plan.md): done.
