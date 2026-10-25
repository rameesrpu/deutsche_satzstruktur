# Story Curriculum Plan

> **Audience**: AI coding agents (and the owner) picking up work in a fresh conversation.
> Do one item per conversation: read the item's *Context* and the files it lists first, verify with
> its *Done when*, then tick the checkbox, add a dated one-line note, and commit.
> The finished maintainability plan is archived in [archive/maintainability-plan.md](archive/maintainability-plan.md).

Context: the app is built for a doctor from Kerala who is starting German (A1) and moving to
Stuttgart. Curriculum and story rules: [data/stories/CURRICULUM.md](../data/stories/CURRICULUM.md);
cast, plot and mystery: [data/stories/STORY_BIBLE.md](../data/stories/STORY_BIBLE.md).
Content must stay halal (no alcohol, no pork, no dating alone or physical romance).

### [x] S1 A1 stories as game-mode chapters
> 2026-10-25 done. 5 stories / 17 chapters / 17 drills (377 hand-tagged sentences) in `data/stories/A1/`,
> built by `scripts/build_stories.py`. Chapters are grouped per story in the level selector and unlock in
> order (previous chapter fully played once). The narration card before each sentence and the
> chapter-end card live in `js/storyNarration.js`. Vienna stories removed.

### [ ] S2 Story reader with tap-to-translate words
**Why**: the learner wants to read a chapter as a story first and then play it. Reading in context
with meanings on demand is how she will learn the vocabulary; the game then drills the structure.

**Context**: chapters are lists of `beats` (`read` / `play`, optional `speaker`) in
`data/levels/A1_g<s>k<c>.json`, built from `data/stories/A1/*.json`. The narration card in
`js/storyNarration.js` already shows beats. Chapter unlock state: `LevelSelector.isUnlocked`.
There is no dictionary in the app (the backend is not used), so meanings must be written into the data.

**Steps**
1. **Glossary data.** Add a `glossary` to each story source file: an entry per word, e.g.
   `"Gepäckband": { "de": "das Gepäckband, -bänder", "en": "baggage carousel", "forms": ["Gepäckband"] }`.
   `de` = dictionary form (nouns with article and plural, verbs with infinitive / separable marker),
   `en` = short English meaning. `forms` lists the forms as they appear in the text (*sieht … aus* →
   `aussehen`). Cover all A1 vocabulary words that a complete beginner might not know, plus
   story-specific words (*Kehrwoche*, *Brezel*, *Approbation*). Skip names and very basic words
   (*ich, und, ist*).
2. **Build.** `build_stories.py` copies the glossary into each chapter's `data/levels` file and
   warns about glossary forms that never appear in the chapter (catches typos).
3. **Reader view.** A full-screen reading page for one chapter: all beats in order, speaker
   labels, `play` sentences subtly marked (these are the ones she will play). Words with a
   glossary entry are tappable (dotted underline). Tapping opens a small popover with `de`,
   `en` and a 🔊 button (`gameSounds.speak`). A tap elsewhere closes it. Buttons at the end:
   **Jetzt spielen ▶** (starts the chapter in game mode) and **Weiterlesen ▶** (next chapter, if
   unlocked).
4. **Entry points.** A 📖 button next to the category select when a story chapter is selected, and
   an **Erst lesen** button on the first narration card of a chapter. Only unlocked chapters can
   be read (no spoilers).
5. **Same popover in the narration card**, so words are tappable there too.
6. Mobile first: test at 400×850 and 1280×800 (headless Chrome, see CLAUDE.md). Popover must stay
   inside the screen. Use CSS tokens; game-mode CSS section.
7. Tests: glossary form matching (pure function: text → tokens with optional glossary entry),
   build warning for unused forms.

**Open questions (ask the owner first)**
- Meanings in English only, or also Malayalam? (English is the default; Malayalam would need the
  owner or his wife to review the translations.)
- Should the reader also read the whole chapter aloud? That overlaps with S3; keep S2 to per-word
  🔊 unless the owner says otherwise.

**Done when**: every A1 chapter can be read from the library and from its first card; glossary
words are tappable with meaning + pronunciation; "Jetzt spielen" starts the chapter; tests pass.

**Depends on**: S1.

### [ ] S3 (later) Narrated story mode
Read a chapter aloud with TTS and highlight each word as it is spoken (`SoundManager` already has
word-boundary support, see `probeBoundary`). Builds on the S2 reader view.
**Depends on**: S2.
