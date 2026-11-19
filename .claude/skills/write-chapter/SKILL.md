---
name: write-chapter
description: Write or revise a story chapter for the German course (data/stories). Use when asked to write, continue or fix a chapter, drill or glossary.
---

# Write a story chapter

Read `data/stories/AUTHORING.md` in full first and follow it step by step. It has the exact
commands, file paths, the JSON format and worked examples. This is its short form.

The owner reviews every chapter: steps 2 and 10 are **stops**. Show the owner the result and wait
for their answer. Never skip a stop.

1. **Read**: `data/stories/CURRICULUM.md` (the chapter's skill, the `play` sentence rules, the tag
   table), `data/stories/STORY_BIBLE.md` (characters, arcs, the level's story row and the chapter's
   row), the previous chapter's story file in full, `data/stories/names.txt`.
2. **Outline — STOP**: 8–12 lines in English: what happens, running jokes or clues, the hook at the
   end, the place picture. Wait for the owner's approval.
3. **Beats**: `read` and `play` beats. 12–15 play beats, about 30 % new skill, short first, boss
   sentence last. Speakers as `speaker`, never "sagt X" in a play beat.
4. **Tags**: one tag per word. Re-read the tag table for every sentence type used for the first time.
5. **Drill**: 8–10 sentences on the chapter's skill with the same cast.
6. **Glossary**: every word a learner at this point has not met (nouns included); dictionary form,
   English meaning, forms as they appear. New names go in `data/stories/names.txt`.
7. **Translations**: `en` for every play beat and drill item; natural English, not word for word.
8. **Build and check**: `python3 scripts/build_stories.py`,
   `python3 scripts/check_story.py <story file>`, `python3 scripts/audit_library.py`,
   `gjs -m tests/run.js --update`, then review `git diff tests/snapshots/`, then
   `gjs -m tests/run.js`. Fix every error; fix or justify every warning.
9. **Self-review against the bible**: Ayisha never cooks on request, Faris says "Nur Deutsch!",
   Max avoids the Kehrwoche, Frau Schäfer notices everything; halal (no alcohol, no pork, no dating
   alone, no physical romance); medical and licensing facts correct, with an official source and
   the date checked, or marked unverified.
10. **Review sheet — STOP**: `python3 scripts/story_review.py <story file> <chapter id>`; give the
    owner the printed path and the justified warnings. Apply their changes, rebuild, recheck.
11. **Ship**: no `scripts/bump_version.sh` for content; commit the story file and the generated
    files together. Do not push.
