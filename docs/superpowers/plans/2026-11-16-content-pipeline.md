# Content Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make writing a story chapter a repeatable job for an AI agent: translations in the data, a chapter checker, a review sheet for the owner, an authoring guide with a project skill, the A2 chapter list, and one pilot A2 chapter.

**Architecture:** Python scripts next to `scripts/build_stories.py` (which stays the only builder), a Markdown guide plus a Claude Code project skill, and content edits in `data/stories/`. No app behavior changes except that chapter files carry translations.

**Tech Stack:** Python 3 standard library only (`unittest`), existing gjs test runner, Markdown.

**Spec:** [docs/superpowers/specs/2026-11-16-content-pipeline-design.md](../specs/2026-11-16-content-pipeline-design.md)

**Depends on:** nothing. Can run before, after or beside the production ladder plan (it touches `scripts/`, `data/stories/`, `tests/`, not the game code).

## Global Constraints

- Read `CLAUDE.md`, `data/stories/CURRICULUM.md` and `data/stories/STORY_BIBLE.md` first.
- Do not touch `backend/`. Do not edit generated files by hand (`js/storyContent.js`, `data/levels/A?_g*`, `data/library/A?_g*`); run `python3 scripts/build_stories.py`.
- Python: standard library only, same style as `scripts/build_stories.py`. No new dependencies.
- Content is halal: no alcohol, no pork, no dating alone, no physical romance.
- Meanings and translations are English.
- After any content change: `python3 scripts/build_stories.py && python3 scripts/audit_library.py && gjs -m tests/run.js` must all exit 0 (use `gjs -m tests/run.js --update` when the library snapshot changes on purpose, and review the diff).
- Two tasks stop for the owner (Tasks 5 and 7). Do not go past those stops without the owner's answer.
- Commit after each task. End commit messages with `Co-Authored-By: Claude <noreply@anthropic.com>`.

## Review Focus

1. **A story file with no `en` anywhere** (all of A1 today) must still build and play: translations are optional in the builder. Test in Task 1.
2. **A play text that appears twice in one level with different translations**: the builder keeps per-chapter maps, so each chapter file has its own. Test in Task 1.
3. **Checker false alarms on names and numbers**: "Ayisha", "Stuttgart", "7" must not be listed as unglossed words. Test in Task 2.
4. **Sentence-initial capitals**: "Heute" at the start and "heute" inside count as the same known word; "Essen" (noun) and "essen" (verb) inside a sentence do not. Test in Task 2.
5. **A chapter that is fine except for content words** ("Bier") is reported with the beat text so the owner can judge (*alkoholfreies Bier* in a joke may be intended). Warning, not error. Test in Task 2.

## File Structure

| File | Responsibility |
|---|---|
| `scripts/build_stories.py` | Also copies `en` into chapter and drill files as `translations` |
| `scripts/check_story.py` (new) | Chapter rules the builder does not check; importable functions + CLI |
| `scripts/test_check_story.py` (new) | `unittest` for the checker |
| `scripts/story_review.py` (new) | Review sheet per chapter in `out/review/` |
| `data/stories/AUTHORING.md` (new) | Step-by-step guide for writing a chapter |
| `.claude/skills/write-chapter/SKILL.md` (new) | Project skill that follows the guide |
| `data/stories/CURRICULUM.md`, `STORY_BIBLE.md` | A2 chapter table, `en` in the format section |
| `data/stories/A1/*.json` | `en` backfill |
| `data/stories/A2/01_der_sprachkurs.json` (new) | Pilot chapter 1.1 |

---

### Task 1: Translations in the story format

**Model:** sonnet

**Files:**
- Modify: `scripts/build_stories.py` (`build_sentence_set` ~288, `write_set` ~309, `build` ~321), `js/types.js` (LibraryFile / level file typedef), `data/stories/CURRICULUM.md` (story source format section), `tests/story.test.js`

**Interfaces:**
- Produces:
  - Beat and drill item field `"en": string` (optional), on `play` items only. `en` on a `read` beat is a build error (`en is only for play beats`).
  - Each built `data/levels/<level>_g<s>k<c>.json` and its `_uebung` file gets `"translations": {"<play text>": "<en>"}` with only the sentences that have one; the key is omitted when empty. `data/library/` files are unchanged.
  - Python helper `collect_translations(items) -> dict` in `build_stories.py` (used by Task 3).

- [ ] **Step 1: Write the failing tests** in `tests/story.test.js`, following how it already reads built files:
  - Every A1 chapter file still loads and has no `translations` key (nothing is translated yet).
  - A unit-level check of the builder through `python3 -c` (the file already shells out to Python for the glossary check; do the same): `collect_translations([{"play": "A b.", "en": "X"}, {"read": "r"}, {"play": "C d."}])` returns `{"A b.": "X"}`.
- [ ] **Step 2: Run** `gjs -m tests/run.js`. Expected: FAIL (`collect_translations` not defined).
- [ ] **Step 3: Implement** in `build_stories.py`; document `en` in CURRICULUM.md's story source format (one line in the example, one bullet); add `translations` to the typedef in `js/types.js`.
- [ ] **Step 4: Run** `python3 scripts/build_stories.py && gjs -m tests/run.js`. Expected: exit 0 and `git status` shows no changed generated file (A1 has no `en` yet).
- [ ] **Step 5: Commit** — `git commit -am "Carry sentence translations from story files into chapter files"`

---

### Task 2: Chapter checker

**Model:** sonnet

**Files:**
- Create: `scripts/check_story.py`, `scripts/test_check_story.py`
- Modify: `tests/run.js` (run `python3 -m unittest scripts/test_check_story.py` the way the glossary test runs Python, and fail the suite on a non-zero exit), `tests/README.md`

**Interfaces:**
- Consumes: `tag_sentence`, `WORD_RE`, `glossary_matches`, `STORIES_DIR` from `scripts/build_stories.py` (import the module; do not copy code).
- Produces:
  - CLI: `python3 scripts/check_story.py [story.json ...]` (default: every `data/stories/*/*.json`). Prints `ERROR <file> <chapter id>: <message>` / `WARN …` lines, then `N errors, M warnings`. Exit 1 if any error.
  - `load_skills(curriculum_path) -> list[str]` — skill ids in table order, parsed from the `| A1.nom | … |` rows of CURRICULUM.md. A skill's position in this list is its rank.
  - `check_chapter(level, chapter, known_words, glossary, skills, wordlist=None) -> (errors: list[str], warnings: list[str])`
  - `chapter_words(chapter) -> set[str]` — word tokens of all beats and the drill; a capitalised token at the start of a sentence is added in lower case too
  - `BLOCKLIST: set[str]` — lower-case stems: `bier wein sekt schnaps whisky wodka cocktail betrunken schwein schinken speck salami kuss küssen küsst umarmen umarmt`
  - Limits as module constants: `PLAY_MIN = 12`, `PLAY_MAX = 15`, `DRILL_MIN = 8`, `DRILL_MAX = 10`, `MIN_PERSONS = 4`, `MAX_NEW_GLOSSARY = 12`
- Rules, exactly as the spec's table. Details the table leaves open:
  - Genders and persons are read from the tags: `S.<p>` / `O.<p>.<case>` give genders `m f n pl` and persons `ich du wir ihr Sie`; `V.<p>` / `M.<p>` give persons (`er`, `sie`, `es` count as one person "3sg"; `sie_pl` and `Sie` count separately).
  - Dative rule: `O.<p>.dat` in a chapter whose skill ranks before `A1.dativ_praep` is a warning (the curriculum allows a few exceptions).
  - Genitive rule: `O.<p>.gen` before `B1.genitiv` is an error.
  - Unglossed words: tokens of the chapter that are not in `known_words` (all earlier chapters of this level and all lower levels, in story order), match no glossary form (`glossary_matches`), are not digits, and are not capitalised mid-sentence words that never appear in lower case anywhere in the level (names and places).
  - Existing A1 chapters may produce warnings. They must produce **no errors**; if a rule as written makes a shipped A1 chapter an error, lower that rule to a warning for A1 and say so in the report.

- [ ] **Step 1: Write the failing tests** in `scripts/test_check_story.py` with small in-file chapter dicts:
  - 11 play beats → error containing `12–15 play beats`; 12 → none.
  - Drill of 7 → error; 8 → none.
  - Chapter with only `S.m` and `S.f` subjects → error naming the missing `n` and `pl`.
  - Persons `ich`, `du`, `er` only → error; adding `wir` → none.
  - `skill: "A1.unknown"` → error.
  - `O.m.gen` in an A1 chapter → error; in a chapter with skill `B1.genitiv` → none.
  - `C` tag in an `A1.modal` chapter → error; in `A2.nebensatz` → none.
  - `O.f.dat` in an `A1.akk` chapter → warning, not error.
  - Unglossed: beat `"Ayisha kauft heute einen Schrank."` with `known_words = {"kauft", "einen"}` and a glossary matching `Schrank` → warning lists `heute` only (not `Ayisha`, not `Schrank`).
  - `"Heute kommt Faris."` with `heute` known → `Heute` not listed. `"Das Essen ist gut."` with only `essen` known → `Essen` listed.
  - A beat containing `Bier` → warning that includes the beat text; no error.
  - A2 chapter with a play beat without `en` → error; the same in A1 → warning.
  - Last play beat shortest of the chapter → warning `boss`.
  - `load_skills` on the real CURRICULUM.md starts with `A1.nom` and contains `B1.genitiv` after `A2.nebensatz`.
  - Running `check_story.py` on the five real A1 files → exit 0.
- [ ] **Step 2: Run** `python3 -m unittest scripts/test_check_story.py`. Expected: FAIL (module not found).
- [ ] **Step 3: Implement** `scripts/check_story.py`.
- [ ] **Step 4: Run** `python3 -m unittest scripts/test_check_story.py`, `python3 scripts/check_story.py`, `gjs -m tests/run.js`. Expected: all exit 0. Put the A1 warning count per chapter in the task report.
- [ ] **Step 5: Commit** — `git add scripts tests && git commit -m "Add chapter checker for story files"`

---

### Task 3: Review sheet

**Model:** sonnet

**Files:**
- Create: `scripts/story_review.py`
- Modify: `.gitignore` (add `out/`), `scripts/test_check_story.py` (one test class for the sheet)

**Interfaces:**
- Consumes: `check_chapter`, `load_skills`, `chapter_words` (Task 2); `collect_translations` (Task 1).
- Produces:
  - CLI: `python3 scripts/story_review.py <story.json> [chapter id]` → writes `out/review/<level>_<chapter id>.md` per chapter and prints each path.
  - `review_sheet(level, story, chapter, errors, warnings) -> str` (Markdown), in this order: `# <level> <id> <title>`, a line `Skill: <skill> · Ort: <image place or –>`, `## Geschichte` with one line per beat (`**Speaker:**` prefix when present; play beats in bold followed by ` — <en>` in italics, read beats plain), `## Übung` (drill items the same way), `## Neue Wörter` (glossary entries first used in this chapter as `de — en`), `## Prüfung` (errors, then warnings, or `Keine Hinweise.`).

- [ ] **Step 1: Write the failing test**: `review_sheet` for a three-beat chapter (one read with speaker, one play with `en`, one play without) contains `**Ayisha:**`, `**Ich bin Ärztin.** — *I am a doctor.*`, the untranslated play sentence in bold with no dash, and `Keine Hinweise.` when both lists are empty.
- [ ] **Step 2: Run** `python3 -m unittest scripts/test_check_story.py`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the unit tests, then `python3 scripts/story_review.py data/stories/A1/01_ankunft.json 1.1` and read the file it prints. Expected: a sheet a non-programmer can read top to bottom.
- [ ] **Step 5: Commit** — `git add scripts .gitignore && git commit -m "Add chapter review sheet for the owner"`

---

### Task 4: Authoring guide and project skill

**Model:** opus (prose that later agents follow word for word)

**Files:**
- Create: `data/stories/AUTHORING.md`, `.claude/skills/write-chapter/SKILL.md`
- Modify: `CLAUDE.md` (one line under Data pointing at the guide and the skill), `data/stories/CURRICULUM.md` (link to the guide in the header)

**Interfaces:**
- Consumes: the three scripts.
- Produces: the guide's fixed step order, which the skill repeats in short form:
  1. **Read**: CURRICULUM.md (the chapter's skill, the play sentence rules, the tag table), STORY_BIBLE.md (characters, arcs, the level's story row and chapter row), and the previous chapter's story file in full.
  2. **Outline** (stop for the owner): 8–12 lines in English: what happens, which running jokes or clues appear, the hook at the end, the place picture. Wait for approval.
  3. **Beats**: write `read` and `play` beats. 12–15 play beats, about 30% new skill, short first, boss sentence last. Speakers as `speaker`, never "sagt X" in a play beat.
  4. **Tags**: one tag per word. Re-read the tag table for every sentence type used for the first time.
  5. **Drill**: 8–10 sentences on the chapter's skill with the same cast.
  6. **Glossary**: every word a learner at this point has not met; dictionary form, English meaning, forms as they appear.
  7. **Translations**: `en` for every play beat and drill item; natural English, not word for word.
  8. **Build and check**: `python3 scripts/build_stories.py`, `python3 scripts/check_story.py <file>`, `python3 scripts/audit_library.py`, `gjs -m tests/run.js --update` then review the snapshot diff. Fix every error; fix or justify every warning.
  9. **Self-review against the bible**: character rules (Ayisha never cooks on request, "Nur Deutsch!", Max and the Kehrwoche, Frau Schäfer notices everything), halal limits, medical correctness.
  10. **Review sheet** (stop for the owner): `python3 scripts/story_review.py <file> <id>`; give the owner the path and the justified warnings. Apply their changes, rebuild, recheck.
  11. **Ship**: `scripts/bump_version.sh` is not needed for content (chapter files carry a content hash); commit the story file and the generated files together.
- The skill's frontmatter: `name: write-chapter`, `description: Write or revise a story chapter for the German course (data/stories). Use when asked to write, continue or fix a chapter, drill or glossary.`

- [ ] **Step 1: Write** both files. The guide includes one fully worked example beat of each kind (read with speaker, play with tags and `en`, drill item, glossary entry for a noun, a verb and a separable verb), copied from real A1 content so the format is exact.
- [ ] **Step 2: Verify** every command in the guide by running it once on `data/stories/A1/05_beim_arzt.json`. Expected: each exits 0 and the guide's description of its output matches.
- [ ] **Step 3: Commit** — `git add data/stories/AUTHORING.md .claude/skills CLAUDE.md data/stories/CURRICULUM.md && git commit -m "Add chapter authoring guide and write-chapter skill"`

---

### Task 5: A2 chapter list (stops for the owner)

**Model:** opus (story design)

**Files:**
- Modify: `data/stories/STORY_BIBLE.md` (new section "A2 chapters" under "Stories by level"), `data/stories/CURRICULUM.md` (add the Chapter column to the A2 skill table)

**Interfaces:**
- Produces: one table row per A2 chapter: `id` (`1.1` … `5.x`), title (German), `skill` (exactly one A2 skill id; every A2 skill id is used at least once; `A2.imperativ` and `A2.komparativ` may share a story as the bible lists them), plot in one line, place (`an existing picture name` or `new: <name>`), and which arc beat it carries (mystery clue, romance step, medical scene) where the bible assigns one to A2. 3–4 chapters per story, 16–18 in total.

- [ ] **Step 1: Write the table** from the bible's A2 story rows, the mystery table and the romance table. Every A2 clue and romance step in those tables must land in a named chapter.
- [ ] **Step 2: Check** by hand: each of the 13 A2 skill ids appears; no chapter needs a skill taught later (a `weil` sentence before `A2.nebensatz`).
- [ ] **Step 3: Stop.** Show the owner the table and ask for approval or changes. Do not start Task 7 before the owner answers.
- [ ] **Step 4: Commit** after approval — `git commit -am "Add A2 chapter list to the story bible and curriculum"`

---

### Task 6: A1 translation backfill

**Model:** sonnet (one dispatch per story file; five files of the same shape)

**Files:**
- Modify: `data/stories/A1/01_ankunft.json`, `02_ein_neues_zuhause.json`, `03_papiere_papiere.json`, `04_biryani_gesucht.json`, `05_beim_arzt.json`; generated files via the build

**Interfaces:**
- Consumes: the `en` field (Task 1).
- Produces: `en` on every `play` beat and drill item of A1 (377 sentences). Natural English in the story's voice; formal *Sie* stays "you"; names unchanged; Swabian words kept and explained by the glossary, not the translation.

- [ ] **Step 1: Add `en`** to one story file. Do not change `play`, `tags`, `read`, `speaker` or the glossary.
- [ ] **Step 2: Verify** — `python3 scripts/build_stories.py && python3 scripts/check_story.py data/stories/A1/<file> && gjs -m tests/run.js`. Expected: exit 0; the checker prints no `en` warning for this file; `git diff --stat` shows only the story file and its `data/levels` files (library files unchanged, because words did not change).
- [ ] **Step 3: Commit** — `git commit -am "Add English translations to A1 story <n>"`
- [ ] **Step 4: Repeat** Steps 1–3 for each of the other four files.
- [ ] **Step 5: Tighten** — in `check_story.py` make a missing `en` an error at every level; update its test; run all checks; commit `"Require translations for every play sentence"`.

---

### Task 7: Pilot chapter A2 1.1 (stops for the owner twice)

**Model:** opus

**Files:**
- Create: `data/stories/A2/01_der_sprachkurs.json` (story 1 with chapter 1.1 only)
- Modify: generated files via the build; `js/levelContent.js` only if the A2 level needs a label change; `tests/snapshots/*` via `--update`

**Interfaces:**
- Consumes: everything above; the approved chapter row from Task 5.
- Produces: a playable A2 chapter and its drill: `data/levels/A2_g1k1.json`, `A2_g1k1_uebung.json`, their library twins, and the A2 entry in `js/storyContent.js`.

- [ ] **Step 1: Check the build for a second level.** Run the build with a two-beat throwaway `data/stories/A2/` file and confirm: files are named `A2_g1k1*`, the level selector shows an A2 story group, and the first A2 chapter's lock state. Read `LevelSelector.isUnlocked` and `chapterOrder()` in `js/levelContent.js`: if the first A2 chapter is unlocked from the start, make it unlock when the last A1 chapter is complete (spec, open question 2), with a unit test in `tests/story.test.js`. Delete the throwaway file.
- [ ] **Step 2: Follow `data/stories/AUTHORING.md`** from step 1 to step 10 for chapter 1.1. This includes its two owner stops (outline, review sheet).
- [ ] **Step 3: Play it** — serve the app, open the chapter in headless Chrome at 400×850 (command in CLAUDE.md), and confirm the first card and the first play sentence render. Report anything in the game that an A2 sentence shape breaks (two-part Perfekt verbs are the new shape here).
- [ ] **Step 4: Record what the pipeline got wrong.** Every correction the owner asked for goes into AUTHORING.md as a rule or example, so the next chapter does not repeat it.
- [ ] **Step 5: Commit** — `git add -A data js tests && git commit -m "Add A2 chapter 1.1 (pilot of the content pipeline)"`
- [ ] **Step 6: Update `docs/roadmap.md`**: project 2 status and links; commit.
