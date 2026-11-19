# Writing a story chapter

> **Audience**: AI agents writing or revising a chapter (asked e.g. "write chapter A2 1.2"), and the owner.
> Follow the steps in order, word for word. Format and grammar rules: [CURRICULUM.md](CURRICULUM.md).
> Characters, arcs and chapter list: [STORY_BIBLE.md](STORY_BIBLE.md). Project skill: `.claude/skills/write-chapter/`.

The owner reviews every chapter. Steps 2 and 10 are **stops**: show the owner the result and wait
for their answer before you go on. Never skip a stop.

## Before you start: where the chapter goes

- A chapter id is `<story>.<chapter>`: "A2 1.2" is level A2, story 1, chapter 2.
- The story file is `data/stories/<level>/<nn>_<slug>.json`: `nn` = story number with two digits,
  `slug` = the story title in lower case, words joined with `_`, `ä ö ü ß` as `ae oe ue ss`
  (`data/stories/A1/05_beim_arzt.json` is A1 story 5 "Beim Arzt").
- Story file exists: add the chapter to its `chapters` list, in id order. No file yet: create it:
  ```json
  { "level": "A2", "story": 1, "title": "Der Sprachkurs", "chapters": [], "glossary": {} }
  ```
- A chapter object has these keys, in this order:
  ```json
  { "id": "5.2", "title": "In der Praxis",
    "image": {"place": "praxis", "alt": "Das Wartezimmer in der Praxis."},
    "skill": "A1.dativ_praep", "drillTitle": "mit, bei, von, zu …",
    "beats": [ … ], "drill": [ … ] }
  ```
- The build turns chapter `<s>.<c>` of a level into `data/levels/<level>_g<s>k<c>.json` and
  `<level>_g<s>k<c>_uebung.json` (the drill), their twins in `data/library/`, and its entry in
  `js/storyContent.js`. Never edit those generated files by hand.

## 1. Read

Read these in full before you write anything:
1. `data/stories/CURRICULUM.md`: the chapter template, the skill ladder row of this chapter's skill
   (what is taught now, what is taught later and must not appear yet), "Rules for `play` sentences"
   and the tag table.
2. `data/stories/STORY_BIBLE.md`: the characters, the mystery table, the romance tables, the level's
   story row and this chapter's row (the level's chapter table, e.g. "A2 chapters", when it has one).
   The chapter row gives the title, the skill, the plot, the place and the arc beat it carries.
3. The previous chapter's story file in full (beats, drill and glossary). For the first chapter of
   a story it is the last chapter of the story before; for A2 1.1 it is A1 5.3 in
   `data/stories/A1/05_beim_arzt.json`. Note what the learner already knows and how the last
   chapter ended: the new one picks up its hook.
4. `data/stories/names.txt`: the names already in use.

## 2. Outline — STOP for the owner

Write 8–12 lines in English:
- what happens, in story order, and who is there;
- which running jokes or clues appear (the bible's character rules, the chapter row's arc beat);
- the hook at the end (cliffhanger, punchline or clue);
- the place picture: an existing place (`ls data/stories/<level>/img/`) or `new: <place-name>`.

Show the outline to the owner and wait for approval. Apply their changes. Do not write beats before
the owner has approved the outline.

## 3. Beats

Write the chapter's `beats` list, in story order:
- **12–15 `play` beats** (the checker errors outside this range) plus as many `read` beats as the
  story needs.
- About **30 % new skill**, 70 % recycled from earlier chapters.
- **Short sentences first**, longer ones later; the **last play beat is the boss sentence**, among
  the three longest of the chapter (the checker warns otherwise).
- **Grid coverage**: the play beats and drill together use `m`, `f`, `n` and `pl`, and at least four
  pronoun persons, with *du / wir / ihr / Sie*, not only *er/sie* (warning in A1, error from A2 on).
- Every `play` sentence follows "Rules for `play` sentences" in CURRICULUM.md: one sentence; at most
  one clause at A1, main + subordinate clause at most from A2; about 10 words at A1, 12 at A2, 16 at
  B1; a subject and a finite verb; no dashes, lists, addresses, prices, clock times or dates (except
  in the chapter that teaches them). Fragments (*Gern!*, *Warum nicht?*) are `read` beats.
- Only skills already taught: no subordinate clause (`C` tag) before `A2.nebensatz`, no genitive
  object before `B1.genitiv` (both errors), no dative object before `A1.dativ_praep` except the
  documented A1 exceptions (warning).
- Play texts are unique within the chapter; the checker warns when one repeats an earlier chapter.
- Dialogue: the speaker goes in `speaker`. **Never write "sagt X" or "fragt X" inside a play beat.**
- The last beat is the hook.

A `read` beat with a speaker (A1 5.1):
```json
{ "speaker": "Ayisha", "read": "Lea. Ich bin Ärztin." }
```
A `read` beat without a speaker (narration):
```json
{ "read": "Montag. Ayisha hat Fieber. Und Halsschmerzen. Und fast keine Stimme." }
```

## 4. Tags

Give every `play` sentence a `tags` string: **one tag per whitespace-separated word** (punctuation
stays on its word: `Studienzeit.` is one word). Re-read the tag table in CURRICULUM.md for every
sentence type you use for the first time in this chapter (first Perfekt, first two-clause sentence,
first dative object …).

A `play` beat with tags and `en` (A1 5.2; A1 has no `en` yet, the translation was written for this
guide):
```json
{ "speaker": "Dr. Kühn", "play": "Ich kenne es aus meiner Studienzeit.",
  "tags": "S.ich V.ich O.n.akk P O.f.dat O.f.dat", "en": "I know it from my student days." }
```
`Ich` subject (ich) · `kenne` finite verb agreeing with ich · `es` accusative object (neuter: *das
Gebäude*) · `aus` preposition · `meiner Studienzeit.` one noun phrase, both words `O.f.dat`.

Reminders (the full table is in CURRICULUM.md):
- Every word of a noun phrase (article, possessive, adjective, number) gets the noun's tag.
- *Das ist X*: *das* is the subject, the verb is `V.es`.
- Formal *Sie*: `S.Sie`, verb `V.sie_pl`.
- Infinitives, participles and imperatives are `V`: *Wir haben einen Ausflug gemacht.* →
  `S.wir V.wir O.m.akk O.m.akk V`.
- Separable particles are `P`: *Ruf Dr. Kühn an!* → `V O.f.akk O.f.akk P`.
- Two main clauses: the conjunction is `K`, then `/` (no word) starts the next clause:
  *Der Park ist groß, und die Leute sind nett.* → `S.m S.m V.er X K / S.pl S.pl V.sie_pl X`.

## 5. Drill

Write the chapter's `drill`: **8–10 sentences on the chapter's skill** (the checker errors outside
this range), with the same cast, tagged like play beats. Set `drillTitle` to the skill in a few
German words ("Imperativ", "mit, bei, von, zu …"). Use words from this chapter's beats or earlier
chapters: drill files carry no glossary, so a new word in a drill cannot be tapped (and the checker
or the build warns about it).

A drill item (A1 5.2; `en` written for this guide):
```json
{ "play": "Ich gebe dir den Schlüssel.", "tags": "S.ich V.ich O.du.dat O.m.akk O.m.akk", "en": "I'll give you the key." }
```

## 6. Glossary

Add an entry to the story file's `glossary` for **every word a learner at this point has not met**:
every new ordinary word, nouns included. A word counts as met when it appears in an earlier chapter
(story order, lower levels first). All story files of a level form one dictionary, so define a
word once, in the story where it first appears.
- Key: the dictionary form without article (`Apotheke`, `aufsetzen`).
- `de`: nouns with article and plural; verbs as infinitive, `|` after a separable prefix,
  irregular forms in brackets (`aus|sehen (sieht aus)`).
- `en`: the English meaning in this context.
- `forms`: the words exactly as they appear in the chapter beats (case-sensitive; a capitalised
  word at a sentence start also matches its lower-case form). A separable verb is written
  `"setzt … auf"` (with the character `…`): it matches when the particle ends the clause later.
  A form may belong to only one entry of the level (build error).
- New forms of a word you already glossed go into that entry's `forms` (*fahre* next to *fährt*).
- Entries of a lower level are not copied into this level's chapter files. When a lower-level word
  needs its meaning here, add an entry with the same key to this level's glossary.

Noun, verb and separable verb (A1 5.2):
```json
"Apotheke": {"de": "die Apotheke, -n", "en": "pharmacy", "forms": ["Apotheke"]},
"untersuchen": {"de": "untersuchen", "en": "to examine", "forms": ["untersucht"]},
"aufsetzen": {"de": "auf|setzen", "en": "to put on (glasses)", "forms": ["setzt … auf"]}
```

**Names** of people, places, brands and institutions get no glossary entry: add each new one, in its
exact spelling (also the genitive: `Ayishas`), on its own line to `data/stories/names.txt`.
Skip pronouns, articles and *sein* forms the learner has met.

## 7. Translations

Give every `play` beat and every drill item an `en`: natural English, as a person would say it, not
word for word (*Was fehlt Ihnen?* → "What seems to be the problem?", not "What is missing to you?").
`en` on a `read` beat is a build error. A missing `en` is a checker warning in A1 and an error from
A2 on. The build copies them into the chapter file as `"translations": {play text: en}`.

## 8. Build and check

Run these from the repo root, in this order:

1. `python3 scripts/build_stories.py`
   Prints one line per chapter (`  A2_g1k2: 14 play + 9 drill sentences`), then any
   `  warning: …` and `  ERROR: …` lines. Exit 1 on an error (bad tag, word/tag count mismatch,
   `en` on a read beat, a glossary form in two entries, a key defined twice). The warnings cover
   sentence length, dashes, "sagt/fragt", nothing to place, glossary forms that appear in no chapter
   and pictures.
2. `python3 scripts/check_story.py data/stories/<level>/<nn>_<slug>.json`
   Checks every chapter of that file, in the context of all story files. Prints
   `ERROR <file> <chapter id>: <message>` and `WARN <file> <chapter id>: <message>` lines, then
   `N errors, M warnings`. Exit 1 on an error. Rules: play beat and drill counts, genders and
   persons, skill order, unglossed words (`ungeglosst: …`), more than 12 new glossary words, missing
   `en`, content words (alcohol, pork, romance), the boss sentence, play texts repeated from earlier
   chapters; `not on the word list: …` once `data/wordlists/<level>.txt` exists.
   An `ungeglosst` word is a new ordinary word (glossary entry, step 6) or a name (`names.txt`).
3. `python3 scripts/audit_library.py`
   Prints `Scanned N files, N sentences, N words: 0 problem(s).` and exits 0 when clean; otherwise it
   lists words that game mode cannot place and exits 1 (usually a wrong tag).
4. `gjs -m tests/run.js --update`, then `git diff tests/snapshots/`
   Prints three `Snapshot updated: …` lines and `N/N tests passed`. Review the diff: only your
   chapter's sentences may change. Anything else is a bug; fix it, do not keep the snapshot.
5. `gjs -m tests/run.js`
   The full run (it counts more tests than the `--update` run). Must end
   with `N/N tests passed`.

Fix every error. Fix every warning, or write down why it stays (e.g. "20 new glossary words: the
chapter is set in a new place"; "`image` given but no file: picture still to draw"). The justified
warnings go to the owner in step 10. Run all five again after every fix.

## 9. Self-review against the bible

Read the chapter once more as the owner would and check:
- **Characters** (STORY_BIBLE.md): Ayisha never cooks on request (only when she decides to); Faris
  always says "Nur Deutsch!"; Max always avoids the Kehrwoche; Frau Schäfer notices everything.
  Ages, jobs, places and the timeline match the bible and earlier chapters.
- **Halal**: no alcohol, no pork, no dating alone, no physical romance. Faris and Ayisha meet in
  public, in a group or with family. A checker `content word` warning needs a reason or a rewrite.
- **Medical**: facts are correct and conservative (symptoms, advice, what a doctor does). Every
  medical or licensing fact (exams, authorities, procedures in Germany, e.g. Approbation,
  Fachsprachprüfung, Regierungspräsidium) comes from an official source: note the source and the
  date you checked it. When you cannot verify a fact, mark it "unverified" for the owner in step 10.
- **Story**: the chapter picks up the previous hook, carries its arc beat and ends on a hook.

## 10. Review sheet — STOP for the owner

Run `python3 scripts/story_review.py data/stories/<level>/<nn>_<slug>.json <chapter id>`.
It writes `out/review/<level>_<chapter id>.md` (git-ignored) and prints its path. The sheet has the
title, skill and place, the story (play beats in bold with their `en`), the drill, the new words
and the checker's findings (`Fehler:` / `Hinweis:`).

Give the owner:
- the sheet's path;
- every warning that stays, with its reason (step 8);
- the sources and dates of medical and licensing facts, and anything marked unverified (step 9).

Wait for the owner's answer. Apply their changes, then run step 8 again and write a new sheet. When
a correction is a rule for future chapters, add it under "Owner corrections" at the end of this guide.

## 11. Ship

Commit once the owner has approved the sheet. `scripts/bump_version.sh` is not needed for content:
the chapter files carry a content hash. Commit the story file and the generated files together:

```bash
git add data/stories/<level>/<nn>_<slug>.json data/stories/names.txt data/levels data/library js/storyContent.js tests/snapshots
git commit -m "Add <level> chapter <id> <title>"
```
Also add a new picture and its prompt (`data/stories/<level>/img/<place>.*`) and this guide if you
added an owner correction. Do not push.

## Revising an existing chapter

To fix a chapter, drill or glossary: do step 1, skip step 2 unless the plot changes, then do steps
3–11 for what changed. The review sheet stop (step 10) still applies.

## Owner corrections

Rules learned from the owner's reviews. Add new ones here.

- (none yet)
