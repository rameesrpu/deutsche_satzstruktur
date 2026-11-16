# Roadmap

> **Audience**: the owner and AI coding agents starting from a fresh conversation.
> This is the map of what comes next and why. It is not a task list: each project below gets
> its own design (`docs/superpowers/specs/`) and plan (`docs/superpowers/plans/`) when it is
> started. Update the status table when a project starts or ships.

Written 2026-11-15 from a brainstorm with the owner.

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
- Work goes one project at a time: brainstorm → design doc → plan → build with subagents.

## What limits the app today

1. **Recognition only.** The game hands her a phrase and she places it. She never builds,
   types or says a sentence. A hospitation and the FSP are almost entirely production.
2. **The spatial idea covers one slice of German.** Cases and word order are visual; vocabulary,
   tenses, prepositions, listening and medical language are not.
3. **Content is made by hand.** A1 is 5 stories, 17 chapters, 377 hand-tagged sentences. The
   FSP path needs roughly ten times more.

## Projects

| # | Project | Status | Design / plan |
|---|---|---|---|
| 1 | Production ladder, rungs 2–3 | planned, not built | [spec](superpowers/specs/2026-11-15-production-ladder-design.md), [plan](superpowers/plans/2026-11-15-production-ladder.md) |
| 2 | Content pipeline | not designed | |
| 3 | Production ladder, rungs 4–5 | not designed | |
| 4 | Spatial boards | not designed | |
| 5 | Medical track | not designed | |

The order after project 1 is a recommendation, not a decision. Project 2 comes next because
she will otherwise run out of A1 chapters, and projects 3–5 all need more sentences.

### 1. Production ladder, rungs 2–3

Every sentence she has played comes back on a schedule, one rung harder each time.

| Rung | Name | What she does |
|---|---|---|
| 1 | Platzieren | Today's game: phrase given, pick cell and case |
| 2 | Ordnen | Phrases shuffled; drop them into the field model slots |
| 3 | Artikel | Article blanked; placing the phrase in the grid produces it |
| 4 | Schreiben | Hear the sentence, type it (project 3) |
| 5 | Sprechen | See the situation, say the sentence (project 3) |

Home gets a "Heute üben" tile, capped at her daily goal. The schedule and the review runner
built here are what later exercises and boards plug into. Details: the spec and plan above.

### 2. Content pipeline

**Why:** hand-tagging does not scale to A2, B1 and medical German.

**Idea:** draft story chapters and tag their words with AI help, check them by machine, and
have the owner review before they ship.

- Input: the curriculum step, the story bible, the level word list.
- Output: a story file in the existing format (`data/stories/<level>/*.json`), built by
  `scripts/build_stories.py`.
- Machine checks: `scripts/audit_library.py`, the field-zone and library snapshots, glossary
  coverage, vocabulary against the level list.
- Add **sentence translations** (English) to the data. Rung 4 and the medical track need them.
- Content rules stay in force: Goethe A1–B1 order, story as spine, halal content
  (`data/stories/CURRICULUM.md`, `STORY_BIBLE.md`).

**Open questions:** how much review the owner wants per chapter; whether the pipeline runs as
a script with an API key or as a Claude Code workflow; whether meanings also get Malayalam.

**Done when:** a new A2 chapter goes from outline to playable with a review of the text, not
hand-tagging of every word.

### 3. Production ladder, rungs 4–5

- **Rung 4, Schreiben:** dictation first (hear, type), with the grid visible as a hint.
  Translation prompts (English → German) once project 2 has added translations. Needs
  forgiving checking: umlauts, capitals, small typos.
- **Rung 5, Sprechen:** she sees the story situation and says the sentence. Speech recognition
  in Android Chrome. Needs a fallback when recognition is missing or wrong (self-rating).

**Open questions:** how strict typing should be; whether speaking is scored or self-rated.

### 4. Spatial boards

New visual boards for the parts of German the grid does not cover. Each board is an exercise
the review runner can open.

- **Preposition scene:** for Wechselpräpositionen she drags an object *into* a place
  (Akkusativ) or leaves it *in* the place (Dativ).
- **Timeline:** Perfekt, Präteritum and Futur sit on a line; the verb bracket is a clamp that
  opens and closes around the middle of the sentence.
- **Body map:** anatomy, symptoms and examination words placed on a body. She already knows
  the medicine; only the German is new.
- **Places as memory:** words live in the place where she met them (the flat, the
  Ausländerbehörde, the ward). Chapter pictures already show places, not people. Not yet
  assigned a design; could be part of the Wörter screen.

**Open questions:** which board first (the body map is closest to her goal, the timeline is
needed by A2 grammar); whether boards are SVG like the grid or plain HTML.

### 5. Medical track

German for the hospital and the path to working as a doctor.

- **Anamnese:** the patient interview as a fixed sequence she fills in and then speaks.
- **Arztbrief:** the doctor's letter as a spatial template with its fixed sections.
- **The system as maps:** the Approbation path (recognition, Berufserlaubnis, FSP,
  Kenntnisprüfung) as a route map; the ward and its roles as a floor plan.
- **FSP preparation:** the three parts (patient interview, documentation, handover to a
  colleague) as practice modes.

**Depends on:** projects 2 (content) and 3 (typing, speaking). Medical facts and the
recognition process must be checked against official sources when this is designed; rules
differ by Bundesland (hers: Baden-Württemberg).

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
