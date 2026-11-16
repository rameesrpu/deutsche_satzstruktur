# Production ladder, rungs 4–5 (Schreiben, Sprechen): design

Status: written 2026-11-16 by Claude at the owner's request ("write all plans"). The owner has
**not** reviewed the calls marked *my call*. Read them before executing the plan.

Roadmap project 3 ([docs/roadmap.md](../../roadmap.md)). Builds on project 1
([production ladder design](2026-11-15-production-ladder-design.md)): same schedule, same
"Heute üben" session, two more exercises at the top.

## Intent

Rungs 2 and 3 still give her the words. A hospitation needs her to produce a sentence from
nothing: first on the keyboard, then out loud.

## Goals

- Rung 4: she hears a sentence and types it.
- Rung 5: she says a sentence and the phone checks it, with an honest way out when the
  recogniser mishears her.
- Both run inside the existing review session and schedule. The top of the ladder moves to 5.
- Both can be switched off in Einstellungen (typing on a bus is fine, speaking may not be).

## Non-goals

- Free translation (English → German typing). Several German sentences are correct for one
  English one and the data stores one, so it cannot be checked fairly.
- Pronunciation scoring. The check is "were the words understood", nothing finer.
- Grading capitalisation and umlaut spelling strictly (see below).
- Changes to rungs 1–3 or to the schedule's intervals.

## Anti-goals

- A recogniser that keeps failing her and no way past it. She can always say "it misheard me".
- Typing checks that punish a phone keyboard: `ae` for `ä`, `ss` for `ß`, a missing full stop.
- Sending audio anywhere without her knowing. The first use explains it (see Privacy).

## Rung 4: Schreiben (dictation)

```
 ✕   ▬▬▬▬▬▭▭▭▭▭
 Hör zu und schreib den Satz.
 [ 🔊 Nochmal ]   [ Langsam ]
 ┌────────────────────────────────┐
 │                                │
 └────────────────────────────────┘
 [ ä ] [ ö ] [ ü ] [ ß ]              [ Prüfen ]
 Ayisha ✓   muss ✓   _____   im ✓   Krankenhaus ~
```

- The sentence is spoken once when the screen opens. "Nochmal" repeats it, "Langsam" repeats
  it at 0.7 speed. The text is not shown.
- Buttons for ä, ö, ü, ß insert at the cursor (not every Android keyboard has them).
- "Prüfen" compares word by word:
  - **richtig**: same word. `ae/oe/ue/ss` count as `ä/ö/ü/ß`. Punctuation is ignored.
  - **Großschreibung** (shown, never a mistake): only the capital differs.
  - **Tippfehler** (shown, never a mistake): one letter off in a word of four or more letters.
  - **falsch / fehlt / zu viel**: a mistake.
- First try with mistakes: correct words stay, each wrong or missing word becomes a blank of
  its length, extra words are struck out. She fixes it and checks again.
- Second try with mistakes: the sentence is shown and spoken; the visit counts as failed.
- Passing on the first or second try moves the sentence up (*my call*: typing a whole sentence
  is hard enough that one retry should not send it back down).
- After the result, the English meaning is shown under the sentence if the chapter file has
  one (content pipeline, project 2). Without it, nothing is shown.
- Rung 4 needs a German voice. On a device without one, rung 4 is skipped.

## Rung 5: Sprechen

```
 ✕   ▬▬▬▬▬▬▬▭▭▭
 Sag den Satz auf Deutsch.
 „I have to work at the hospital today.“
              ( 🎤 )
 Gehört: „Heute muss ich im Krankenhaus arbeiten“
 Heute ✓  muss ✓  ich ✓  im ✓  Krankenhaus ✓  arbeiten ✓
 [ Anhören ]                       [ Weiter › ]
```

- **Cue.** With a translation: the English sentence. Without one (*my call*, so rung 5 does
  not wait for project 2): the German sentence is shown for four seconds or until she taps,
  then hidden: "Lies. Merk dir. Sprich."
- She taps the microphone and speaks. The browser's speech recognition (German) returns what
  it heard.
- Pass: at least 80% of the sentence's words were heard, in order. Numbers heard as digits
  ("9") match their word ("neun") for 0–12.
- Fail: she sees what was heard and which words were missed, and can try again, three times
  in all. "Anhören" plays the sentence. After the third fail the visit counts as failed.
- **"Die Erkennung hat sich geirrt"** appears after any failed try. It plays the sentence and
  asks "Hattest du es richtig?" with "Ja" / "Noch nicht". Her answer is the result.
- **No recognition** (browser without it, permission refused, offline, error): the same
  self-check from the start. She speaks, taps "Anhören", then answers "Ja" / "Noch nicht".
- Rung 5 is always possible, so every sentence can reach the top.

## Privacy

Chrome on Android sends the recording to Google to recognise it. Before the first recording
the screen says so in one sentence and offers "Ohne Erkennung üben" (self-check only). Her
choice is stored and can be changed in Einstellungen.

## Schedule

- `RUNG_TOP` becomes 5. Intervals as already defined: pass → 7 days to rung 4, 14 days to
  rung 5; at the top 14, then 30 days. A fail drops one rung, due the next day.
- Eligibility now depends on the device and settings as well as the sentence:
  rung 4 needs a German voice and "Schreiben üben" on; rung 5 needs "Sprechen üben" on.
- Sentences already resting at rung 3 move up at their next due visit. No migration.

## Settings (Einstellungen)

- "Schreiben üben" (default on): "Sätze hören und schreiben."
- "Sprechen üben" (default on): "Sätze laut sagen."
- "Spracherkennung" (default: asked on first use): "Die Aufnahme geht zur Erkennung an Google."
  Greyed when the browser has no recognition.

## My calls (correct any of them)

- Dictation, not translation, for rung 4.
- One retry on rung 4 without penalty; capitals and single-letter typos never count.
- 80% of words for a spoken pass; three tries.
- She may overrule the recogniser.
- Rung 5 works without translations by showing the German briefly.

## Open questions for the owner

1. Should wrong capitalisation of nouns count from some point on (B1)? It matters in written
   German, and the FSP documentation part is written.
2. Is sending her voice to Google's recognition acceptable to her?
