# Content pipeline: design

Status: written 2026-11-16 by Claude at the owner's request ("write all plans"). The owner has
**not** reviewed the calls marked *my call*. Read them before executing the plan.

Roadmap project 2 ([docs/roadmap.md](../../roadmap.md)).

## Intent

A1 took 377 hand-tagged sentences. A2, B1 and the medical track need several times more, and
the learner will run out of chapters. The pipeline makes writing a chapter a repeatable job an
AI agent can do in one conversation, with machine checks for everything a machine can check
and the owner reading only the story.

## Goals

- A new chapter goes from outline to playable without hand-tagging every word.
- Every rule in `data/stories/CURRICULUM.md` that can be checked by a script is checked.
- The owner reviews a readable sheet (story text, speakers, meanings), not JSON.
- Every play sentence carries an English translation (later exercises need it).
- The A2 chapter list exists, and one A2 chapter is written through the pipeline as proof.

## Non-goals

- Writing all of A2. This project builds the pipeline and one pilot chapter.
- A script that calls the Claude API on its own. *My call:* the pipeline runs inside a Claude
  Code session (no API key, no cost per run, the owner sees every draft).
- Malayalam meanings. English only, as today.
- Automatic part-of-speech tagging with spaCy. The backend stays untouched; the agent writes
  tags and the checks catch mistakes.
- New chapter pictures. A chapter may reuse an existing place picture or have none.

## Anti-goals

- Chapters that pass the checks but are dull, off-tone or break the content rules. The owner
  reads every chapter before it ships (*my call*; the alternative was spot checks).
- Grammar taught in the wrong order. The checker knows which cases and clause types each skill
  step allows.
- Silent drift from the story bible (plot, running jokes, the mystery clues).

## Parts

### 1. Sentence translations

Play beats and drill items get an optional `"en"`:

```json
{ "play": "Sie heißt Ayisha.", "tags": "S.f V.sie S.f", "en": "Her name is Ayisha." }
```

`scripts/build_stories.py` copies them into the chapter's `data/levels` file as
`"translations": { "<text>": "<en>" }`. Nothing in the app shows them yet; rungs 4–5 and the
medical track will. `en` is required from A2 on and a warning at A1 until the backfill is done.

### 2. Chapter checker: `scripts/check_story.py`

Runs on one story file (or all). Errors fail (exit 1), warnings print. It checks what
`build_stories.py` does not:

| Check | Level |
|---|---|
| 12–15 play beats per chapter; drill has 8–10 items | error |
| Every chapter uses m, f, n and plural, and at least four pronoun persons | error |
| `skill` is a skill id from the CURRICULUM.md tables | error |
| Cases allowed so far: no `gen` before `B1.genitiv`; no `dat` object tags before `A1.dativ_praep` except in the documented exceptions (warning, not error) | error / warning |
| Subordinate clauses (`C` tag) only from `A2.nebensatz` on | error |
| Words not seen in any earlier chapter of the level order and not in the glossary ("ungeglosst") | warning, listed |
| More than 12 new glossary words in one chapter | warning |
| Missing `en` (see above) | error from A2, warning at A1 |
| Content words on the blocklist (alcohol, pork, physical romance: *Bier, Wein, Sekt, Schnaps, Schwein, Schinken, Speck, Kuss, küssen, …*) in any beat | warning, with the beat |
| Last play beat is not among the three longest of the chapter ("boss sentence") | warning |
| A play text appears in an earlier chapter | warning |

The optional file `data/wordlists/<level>.txt` (one word per line; the owner can paste the
Goethe list) adds a warning for words that are on no list up to this level and not glossed.
Without the file that check is skipped.

### 3. Review sheet: `scripts/story_review.py`

Writes one Markdown file per chapter to `out/review/<level>_<id>.md` (`out/` is git-ignored):
title, skill, the beats in order with speakers, play sentences in bold with their translation,
the drill, the new glossary words, and the checker's warnings. This is what the owner reads.

### 4. Authoring guide and project skill

- `data/stories/AUTHORING.md`: the steps for an agent, from "read the bible and the previous
  story" to "commit". It fixes the order: outline for the owner → beats → tags → glossary →
  translations → build → check → review sheet → owner approval → commit.
- `.claude/skills/write-chapter/SKILL.md`: a project skill so a new conversation can be told
  "write chapter A2 1.2" and follows the guide. It stops twice for the owner: after the outline
  and after the review sheet.

### 5. A2 chapter list

The story bible gives A2 five stories with their main skills, but no chapters. Add the chapter
table (story → chapter → one skill id → one-line plot → place picture) to `STORY_BIBLE.md` and
the chapter column to the A2 table in `CURRICULUM.md`. *My call:* continue the A2 story as
planned and put medical scenes inside it (Frau Schäfer's illness, the Hospitation), instead of
a separate early medical track. The owner approves the table before the pilot is written.

### 6. A1 translation backfill and the pilot

- Add `en` to all 377 A1 play and drill sentences.
- Write A2 chapter 1.1 through the whole pipeline. It ships only after the owner has read its
  review sheet.

## Open questions for the owner

1. Is "read every chapter" right, or do you want spot checks once the first few are good?
2. Should A2 unlock only after all of A1 is played, like chapters within a level?
   (The plan assumes yes and checks what the code does today.)
3. Do you want to supply the Goethe word lists as text files?
