# Learning Experience Plan

> **Audience**: AI coding agents (and the owner) picking up work in a fresh conversation.
> Do one item per conversation: read the item and the files it lists, verify with *Done when*,
> tick the checkbox, add a dated one-line note, and commit.

Follows the UI redesign ([redesign-plan.md](redesign-plan.md), U1–U7 done and live).

## Why

The owner tested the new play screen on a phone (2026-11-07). It looks good, but a story
chapter still feels slow:

1. **Repeated audio.** After every correct placement the sentence is re-read from the start
   ("Ayisha" … "Ayisha ist" … "Ayisha ist Ärztin."). There are two sources:
   - with Hörübung off, `gamemode.js` (correct-placement branch, ~line 1187) speaks the growing
     prefix on purpose;
   - Hörübung (`promptEnabled`) is **on by default** (`sound.js`: `!== 'false'`). On voices without
     word-boundary events (many Android voices), `promptSentence()` falls back to speaking the
     prefix before the gap, which gives the same build-up.
2. **Field model after every sentence.** Every finished sentence sets `pendingFelderReview = true`,
   so it is always "Satzbau ansehen" → "Nächster Satz" (2 taps). Only about a third of the 240 A1 play
   sentences show something the field model teaches (31 with a two-part verb, ~50 with
   something other than the subject before the verb; no subordinate clauses before A2).
3. **"Los geht's" before every sentence.** `showStoryIntro()` opens the narration card before
   each play sentence, also for the 113 of 240 that have no narration in front of them (the
   card then only says "Jetzt du:").

**Target**: at most **one extra tap per sentence** (the "Weiter" after solving it), and every
word heard **once** while placing, plus the sentence once at the end.

## Design decisions (owner-approved, 2026-11-07)

- **Audio default** = speak only the placed phrase on each correct placement; read the whole
  sentence once when it is complete. The old build-up is a setting **"Satz aufbauen"**, off by
  default. **Hörübung also becomes off by default** (stays a setting; existing users who
  switched it on explicitly keep it).
- **Field model only when it teaches**: verb in 2nd position with something other than the
  subject in front, two-part verbs (*muss … arbeiten*, *rufe … an*), subordinate clauses. Then
  it **opens on its own** after the sentence with a one-line German hint, and one "Weiter" goes on.
  Other sentences: a quiet **"Satzbau"** text link next to "Weiter" (opens the field model on
  demand); no automatic review.
- **Story text on the play screen**: the narration before a sentence appears as up to **2 lines**
  above the sentence (Literata, speaker name, read-aloud icon). Longer narration: the **last 2
  lines + "mehr"**, and tapping opens the full text as the usual bottom sheet (no play button,
  just close). The full card stays only at the **start of a run** (chapter's first sentence or
  a resumed chapter: "Erst lesen" / "Los geht's") and for the **closing lines** (U6 flow).
- Scope: the **play screen** (`body[data-screen="play"]`). The Werkstatt game keeps its old
  flow (always field model, card before every sentence) unless noted.

## Items

### [x] E1 Audio: placed phrase once, sentence once
> 2026-11-07 done. Pure `placementSpeech()` (+ exported `promptStartIndex`/`clauseStart`) in sound.js:
> a correct placement speaks only the placed phrase; "Satz aufbauen" (`gameSpeechBuildUp`, off) brings
> back the growing prefix; Hörübung now opt-in (`=== 'true'`); completion reads the sentence once unless
> already spoken (`sentenceAlreadySpoken`: `lastSpoken` or the playing Hörübung utterance). New row on
> Einstellungen + Werkstatt checkbox via `setLearnerSetting`, greyed without voice or with Aussprache off.
> Checked: unit tests (phrase/prefix/clause start, defaults, stored 'true' kept), settings screen at
> 375×812 (defaults, toggle sync, greyed states). Not heard on a real German voice (headless, no voice).
Files: `js/sound.js`, `js/gamemode.js` (correct-placement branch, `updateCurrentWordDisplay`
prompt calls, sentence-complete branch), `js/settings.js`, `js/app.js` (`setLearnerSetting`,
`syncLearnerToggles`, Werkstatt checkboxes in `index.html`), `tests/sound.test.js`,
`tests/settings.test.js`.

- `SoundManager.buildUpEnabled` (localStorage `gameSpeechBuildUp`, default **off**:
  `=== 'true'`) + `setBuildUpEnabled()`. `promptEnabled` default changes to `=== 'true'`.
- Correct placement, Hörübung off: build-up off → `speak()` the placed phrase only (the framed
  part, `getItemWordRange(currentItem)`, trailing punctuation stripped); build-up on → today's
  prefix code, unchanged.
- Sentence complete: always read the whole sentence once (`queue: true`), except when the last
  placement already spoke it (build-up on, or Hörübung played to the end). Keep the `lastSpoken`
  dedupe.
- Hörübung fallback (no boundary events): no change in behavior, but now opt-in.
- Settings screen: new row "Satz aufbauen" ("Nach jedem Teil hörst du den Satz bis hierher."),
  greyed like Aussprache when there is no German voice or Aussprache is off. Same toggle in the
  Werkstatt panel, via `setLearnerSetting()`.
- Pure helper (testable): `placementSpeech({texts, range, endIdx, buildUp})` → the string to
  speak (phrase or prefix).

*Done when*: tests cover `placementSpeech` (phrase vs prefix, clause start on long sentences)
and the new defaults (fresh localStorage → build-up off, Hörübung off; stored `'true'` kept);
on the play screen (Chrome with a German voice, 375×812) one chapter sentence sounds like
"Ayisha" · "ist" · "Ärztin" · then "Ayisha ist Ärztin." once; the build-up setting brings back
the old sound; `gjs -m tests/run.js` passes.

### [ ] E2 Story line on the play screen
Files: `js/gamemode.js` (`showStoryIntro`, `continueStoryChapter`, `closeStoryCard`),
`js/playScreen.js` (new strip in `#play-sentence`), `js/storyNarration.js` (helper + sheet for
"mehr"), `css/styles.css` (play-screen section), `tests/playScreen.test.js` or
`tests/story.test.js`.

- Pure helper `storyStrip(lines, max = 2)` → `{lines: StoryBeat[], more: boolean}` (last `max`
  read beats before the sentence; `more` = earlier ones were cut).
- GameMode keeps `storyLines` for the current sentence (from `beatsBefore`). On the play screen
  `showStoryIntro()` opens the card **only** for the first sentence of the run (chapter's
  first sentence, or the first sentence after `startChapter` / resume). Otherwise no card, no
  pause; the strip shows the lines. The Werkstatt keeps the card every time.
- Strip above the prompt: speaker name (small caps, ink-soft) + text (Literata ~16 px, glossary
  words tappable → the reader's ink word bar), read-aloud icon (greyed without a German voice,
  reads the strip's lines), "mehr" when cut. Tap on "mehr" → `showStoryCard` with all lines
  and one "Zurück" button; timer paused while it is open (`pauseForStoryCard` / `closeStoryCard`).
- No narration before the sentence → no strip (the prompt sits where it is today).
- The strip must not push the case tray below the fold: check 375×667 as well; if needed the
  strip clamps to 2 lines with ellipsis (tap = full sheet).

*Done when*: helper tests (0 / 1 / 2 / 3+ lines, speaker beats); a chapter played from Home
shows the card once at the start, then only the strip; resuming mid-chapter shows the card
once; "mehr" sheet opens/closes and the timer resumes; closing narration + recap unchanged;
checked at 375×812, 375×667 and 1280×800; tests pass.

### [ ] E3 Field model only when it teaches
Files: `js/gameRules.js` (or a new small pure module, e.g. `js/felderLesson.js`), `js/gamemode.js`
(`continueAfterSentence`, sentence-complete branch: `pendingFelderReview`), `js/playScreen.js`
(continue button + "Satzbau" link + hint), `js/app.js` (felder review on the play screen,
`gm-felder-hint`), `css/styles.css`, tests.

- Pure `felderLesson(words)` → `null` or `{kind, hint}` from the library words (`type`,
  `clause_type`, word order), first match wins:
  - `subordinate` (any `clause_type === 'subordinate'` / `conjunction` word): "Nebensatz: das
    Verb steht am Ende."
  - `bracket` (finite verb/modal + a later verb, or a separable particle (`preposition` at the
    end of the main clause)): "Satzklammer: *muss* … *erledigen*" (the two words in italics).
  - `vorfeld` (a non-subject phrase before the finite verb, ignoring a leading interjection that
    ends in a comma like *Ja,* / *Hallo,*; includes W-questions): "Verb an Position 2. Vorne steht
    *Heute*."
  - plain subject–verb(–object) sentences, yes/no questions → `null` (yes/no questions can be a
    later kind if the owner wants).
- Play screen, sentence solved: `felderLesson` ≠ null → after the sentence-complete moment
  (~1 s, confetti + sentence audio) switch to the field model **automatically**, show the hint
  line in the feedback bar, one "Weiter" → next sentence. `null` → "Weiter" goes straight on;
  a quiet "Satzbau" text link next to it opens the field model (then "Weiter" as above).
- Tap count: solved → "Weiter" (1 tap) in both cases.
- Werkstatt game: unchanged (always review).
- Test that prints/asserts the share per A1 chapter (expect ~30–45 %); review the list of
  sentences flagged `null` vs a kind once by hand (a snapshot file under `tests/` is fine).

*Done when*: unit tests for each kind incl. *Ja, ich bin neu.* → null, *Hier wohne ich jetzt!* →
vorfeld, *Ich will ein Konto eröffnen.* → bracket, *Lea und Max schauen zu.* → bracket; on the
play screen a plain sentence goes on with one tap, a lesson sentence shows the field model with
its hint and goes on with one tap; "Satzbau" link works; checked at 375×812 and 1280×800; tests pass.

### [ ] E4 Phone pass over one chapter
Files: none new; fix-ups in the files above.

- Play chapter 1.1 and 3.2 (modals) start to recap on a phone-sized window (375×812) and once
  on the real phone: count taps per sentence (target: 1 after solving, 0 before), listen for any
  repeated audio, check the strip and the field-model hint read well.
- Ship: `scripts/bump_version.sh`, `gjs -m tests/run.js`, update CLAUDE.md file notes
  (playScreen strip, `felderLesson`, new sound setting).

*Done when*: the counts and findings are written as the dated note here; nothing over the
target left unexplained.

## Later (not planned)
- Throttle the field model when the same lesson kind repeats several sentences in a row.
- Yes/no questions (verb in 1st position) as their own field-model lesson.
- Installable PWA (from U7).
