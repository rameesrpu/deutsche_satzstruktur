# Production ladder: design

Status: draft for owner approval (2026-11-15). Nothing is built yet.

## Intent

The learner (a doctor from Kerala, complete beginner, Android phone) only *recognises* German
today: the game hands her a phrase and she picks its grid cell and case. A hospitation and the
Fachsprachprüfung need *production*. The ladder moves each sentence she has played from
recognising to producing, on the same visual boards, a little more each time it comes back.

This is the first of five projects for making the app the best possible tool for one learner
(later: content pipeline, new spatial boards, medical track). The app stays a plain website.

## Goals

- Every played sentence comes back on a schedule, each time one rung harder.
- First build: rungs 2 (Ordnen) and 3 (Artikel) plus the schedule and the daily review session.
- A review session is about ten minutes and is started with one tap from Home.
- Her existing progress is kept and enters the ladder without a flood of reviews.
- Later rungs (typing, speaking) and later boards plug in without changing the schedule.

## Non-goals

- Rungs 4 (Schreiben) and 5 (Sprechen). Designed for, not built.
- New sentences or translations. The ladder uses the existing tagged sentences.
- Subordinate clauses on rung 2 (no A1 story sentence has one).
- Accounts, sync, installable app, backend changes.
- Changing how story chapters play. A chapter's first play stays today's game.

## Anti-goals

- A review pile that grows until she avoids it. The daily cap is hard.
- Marking a correct German sentence as wrong. Where several orders are correct, the exercise
  must either fix the choice or accept all of them.
- Making the existing game less stable. `gamemode.js` gets one small switch, no new modes.

## The rungs

| Rung | Name | What she does | Built now |
|---|---|---|---|
| 1 | Platzieren | Today's game: phrase given, pick cell and case | exists |
| 2 | Ordnen | Phrases shuffled; drop them into the field model slots | yes |
| 3 | Artikel | Article blanked; placing the phrase in the grid produces it | yes |
| 4 | Schreiben | Hear the sentence, type it | later |
| 5 | Sprechen | See the situation, say the sentence | later |

### Rung 2: Ordnen

A new screen. The field model is the board: Vorfeld, Verb, Mittelfeld, Ende (Ende only when the
sentence has a second verb part or a separable particle).

```
  Vorfeld      Verb       Mittelfeld              Ende
┌──────────┐ ┌──────┐ ┌────────────────────┐ ┌──────────┐
│  Heute   │ │  ?   │ │         ?          │ │    ?     │
└──────────┘ └──────┘ └────────────────────┘ └──────────┘

   [ arbeiten ]  [ Ayisha ]  [ muss ]  [ im Krankenhaus ]
```

- Chips are the sentence's phrases (same grouping as the game's phrase boxes), shuffled.
- The Vorfeld chip is placed for her. Verb-first sentences (yes/no questions, imperatives)
  show an empty, closed Vorfeld. Leading words outside the Vorfeld ("Ja,", "Und") are shown
  fixed in front.
- She taps a chip, then a slot (or drags). The Mittelfeld takes several chips in order.
- Checked per chip on drop, like the game: right slot stays, wrong slot bounces back with a
  one-line hint ("Das Verb steht an Position 2.", "Der zweite Verbteil steht am Ende.").
- Order inside the Mittelfeld is not tested in this build. She decides only that a chip
  belongs in the Mittelfeld; the slot then shows its chips in the stored order. German allows
  several Mittelfeld orders and the data stores one, so testing it would reject correct
  answers.
- Three wrong tries on a chip place it for her, as in the game.
- When solved: the sentence is read once, "Weiter".
- A sentence with fewer than three movable chips skips rung 2 (nothing to order).

### Rung 3: Artikel

Today's game with one switch. In the sentence and in the framed phrase the article is shown as
a blank (`___ Patienten`). She places the phrase in the grid as usual; a correct placement
fills in the article and speaks the phrase. Seeing "dem" no longer gives the case away, so she
has to work it out from the sentence, and the gender from the noun.

- Articles are recognised by text (der, die, das, den, dem, des, ein, eine, einen, einem,
  einer, eines, kein-forms), not by tag: the data tags "ein" in "ein Tisch" as subject.
- Contracted forms (im, am, zum, zur, ins, vom, beim) and possessives stay visible.
- Phrases without an article play as on rung 1.
- A sentence with no blankable article skips rung 3.

## The schedule

Pure module (no DOM), unit-tested.

- Each sentence in the progress store gets `rung` (1–5) and `due` (ms timestamp).
- After a chapter play (rung 1) the sentence gets `rung: 2`, due the next day.
- In a review, a visit with no mistake moves the sentence up one rung; the next visit is due
  after 1, 3, 7, 14 days (by rung reached). A visit with a mistake moves it down one rung
  (not below 2) and is due the next day.
- Top of the ladder for now is rung 3. A sentence that passes rung 3 stays there and comes back
  after 14, then 30 days, until rungs 4 and 5 exist.
- A rung the sentence must skip (see above) counts as passed without a visit.
- Due sentences are ordered oldest due first.

### Existing progress

Format version goes from 1 to 2. On load, every sentence already played gets `rung: 2` and a
due date spread over the next days at the daily cap (oldest played first), so day one is a
normal session. Sentences with recorded mistakes go first. Export/import carries the new
fields; importing a version 1 file runs the same migration.

## The review session

- Home tile "Schwächen üben" becomes "Heute üben (n)", n = due today, capped. Same on Üben.
- Cap = the daily goal setting (5, 10, 20, 30; default 10). Sentences over the cap wait for
  tomorrow.
- The runner takes the due list and opens the exercise for each sentence's rung: rung 2 the
  Ordnen screen, rung 3 the game with the article switch (rung 1 never appears in review).
- Top bar as on the play screen: close, segmented progress, score.
- End: the existing recap screen, with "morgen wieder" and how many moved up.
- Nothing due: the tile is greyed and says "Heute fertig".
- The old mistake-weighted review (`reviewWeight`, mode `'review'`) stays for the Werkstatt
  toggle; Home and Üben use the schedule.

## Approaches considered

1. **Rungs as modes inside `gamemode.js`.** Least code for rung 3, but the file is already
   1,985 lines and rung 2, typing and speaking are not grid games.
2. **Review runner + one small module per rung + pure schedule.** Chosen by the owner
   (2026-11-15): the working game stays stable, each rung is testable alone, and later boards
   plug into the same runner.
3. **One unified exercise engine, current game rewritten as one exercise.** Cleanest end
   state, but rewrites what works before the ladder is proven.

## Decided by the owner

- Tool for one learner now; keep a multi-learner product possible (engine separate from content).
- Stays a website, not an installable app. She uses Android.
- Rungs arrive through review over days, not as a harder chapter replay.
- Approach 2.

## My calls (correct any of them)

- First build is rungs 2 and 3 only.
- Vorfeld is given on rung 2.
- Intervals 1, 3, 7, 14 (then 30) days; a mistake drops one rung, due next day.
- Cap = daily goal setting.
- Existing sentences enter at rung 2, spread over days.
- Rung 3 blanks whole article words; contractions and possessives stay.
- Review uses every played sentence (story chapters, drills, grammar library), not user-made ones.

## Left to the builder

- A pure `fieldZones(words)` (sentence → Vorfeld / Verb / Mittelfeld / Ende word ranges). Today
  the zones are worked out inside the SVG drawing from pixel positions (`feldermodell.js`);
  `felderLesson.js` already has the pure pieces (clause start, finite verb, bracket).
- Module and file names, import-map lines, CSS in the game-mode section, tokens only.
- Drag versus tap-tap on the Ordnen screen (tap-tap must work; phone first, 400×850).
- How the article switch reaches `gamemode.js` and `playScreen.js` (`sentenceParts`).
- Tests: schedule (up, down, skip, cap, migration), `fieldZones` over all 377 story sentences
  (snapshot), article detection, Ordnen checking. `gjs -m tests/run.js` passes.
- Update `js/types.js` (SentenceProgress, GameProgress version 2) and CLAUDE.md's file list.
