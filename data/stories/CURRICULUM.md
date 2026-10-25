# Curriculum — Deutsche Satzstruktur

> **Audience**: the owner and AI agents writing or reviewing story content.
> Characters, plot and mystery clues live in [STORY_BIBLE.md](STORY_BIBLE.md).
> Decided 2026-10-25.

## Learner and goal

A doctor from Kerala (MBBS), complete beginner in German, preparing to move to Germany (Stuttgart).
Path: A1 → A2 → B1 (Goethe-Zertifikat) → later B2/C1 and the **Fachsprachprüfung (FSP)**.
Engagement comes first: she has to *want* to play the next chapter.

## Principles

1. **Goethe order.** Grammar follows the Goethe-Zertifikat A1/A2/B1 targets, so gaps are visible.
   Within that order, **cases come first**, so the learner gets used to the grid early.
2. **The story is the backbone.** Level → story → chapter → beats. Grammar categories become **drills**
   attached to a chapter, using the same characters.
3. **Unlocking in order.** A chapter unlocks once every play sentence of the previous chapter has
   been played at least once (`LevelSelector.isUnlocked`). Mastery is shown, but doesn't gate, so a
   beginner is never stuck. Drills unlock with their chapter.
4. **Mostly the level word list.** Use words from the level's Goethe word list (or earlier levels).
   Story-specific words are allowed when glossed: names, places, *Biryani*, *Kehrwoche*.
5. **Halal content only.** No alcohol, no pork, no dating alone or physical romance. The romance is
   respectful and heads towards a proposal involving both families. Festivals are shown through
   food, family and community.

## Units

```
Level (season)
└── Story (4–5 chapters, a small block of the syllabus)
    └── Chapter (one new skill, ~10 min)
        ├── beats: play / read, in story order
        └── drill (8–10 sentences, same skill)
```

### Chapter template
- **12–15 `play` beats** plus as many `read` beats as the story needs.
- **About 30% new skill, 70% recycled** from earlier chapters.
- **Grid coverage:** every chapter uses masculine, feminine, neuter and plural, and at least four
  pronoun persons. Make sure *du / wir / ihr / Sie* appear, not only *er/sie*.
- **Difficulty curve:** short sentences first, longer ones later; the last play beat is the
  "boss" sentence of the chapter.
- **Ending:** every chapter ends with a hook (cliffhanger, punchline, or a clue).

### Story source files
One file per story: `data/stories/<level>/<nn>_<slug>.json`. Edit these, then run
`python3 scripts/build_stories.py`. It writes `data/levels/` and `data/library/` files per chapter and
drill (`A1_g1k1.json`, `A1_g1k1_uebung.json`, …) plus `js/storyContent.js`, and fails on tag errors.
Then run `python3 scripts/audit_library.py` and the tests.

```json
{ "level": "A1", "story": 1, "title": "Ankunft", "chapters": [
  { "id": "1.1", "title": "Hallo, Stuttgart!", "skill": "A1.nom", "drillTitle": "Nominativ & sein",
    "beats": [
      { "read": "Oktober. Ein Flugzeug fliegt über Stuttgart." },
      { "play": "Sie heißt Ayisha.", "tags": "S.f V.sie S.f" },
      { "speaker": "Der Mann", "play": "Sind Sie neu hier?", "tags": "V.sie_pl S.Sie X X" },
      { "speaker": "Ayisha", "read": "Sorry … do you speak English?" }
    ],
    "drill": [ { "play": "Ich bin Ärztin.", "tags": "S.ich V.ich S.f" } ] } ] }
```
- `play`: placed in game mode, scored, and tracked for mastery. Text must be unique within its chapter.
- `read`: narration or dialogue, shown on the card between rounds, never scored.
- `speaker`: shown as a label on the card. **Never write "sagt X" inside a play sentence.**

### Glossary (tap-to-translate)
Each story file ends with a `glossary`; all story files of a level form one dictionary, so a word
is defined once, in the story where it first appears. Meanings are in English.

```json
"glossary": {
  "Gepäckband": {"de": "das Gepäckband, -bänder", "en": "baggage carousel", "forms": ["Gepäckband"]},
  "aussehen": {"de": "aus|sehen (sieht aus)", "en": "to look (like)", "forms": ["sieht … aus"]}
}
```
- `de`: dictionary form: nouns with article and plural, verbs as infinitive with `|` for the separable
  prefix and irregular forms in brackets. The 🔊 button reads it without plural, brackets and `|`.
- `forms`: the words as they appear in chapter beats (case-sensitive; a capitalised word at the start of
  a sentence also matches its lowercase form). `"geht … auf"` = separable verb: it matches when the particle
  comes later in the same sentence and ends the clause.
- Cover the words a complete beginner might not know, plus story words (*Kehrwoche*, *Approbation*).
  Skip names, pronouns, articles and *sein* forms.
- The build copies the entries a chapter uses into its `data/levels` file, warns about forms that appear
  in no chapter (typos, drill-only words), and fails if a form belongs to two entries.

### Tags (one per word of a `play` sentence)
| Tag | Meaning |
|---|---|
| `S.<p>` | subject (also predicate nouns: *Ich bin* **Ärztin**), p = `m f n pl ich du wir ihr Sie` |
| `O.<p>.<case>` | object or noun after a preposition; case = `nom akk dat gen` |
| `V.<p>` / `M.<p>` | finite verb / modal, agreeing with p = `ich du er sie es wir ihr sie_pl` |
| `V` | non-finite verb: infinitive, participle, imperative (placed automatically) |
| `P` / `X` / `K` / `C` | preposition or separable particle / other / *und, aber, oder, denn* / *weil, dass …* |
| `/` | (no word) starts the next clause |

- Every word of a noun phrase (article, adjective, number) gets the noun's tag, so they form one box.
- *Das ist X*: *das* is the subject, so the verb is `V.es`, whatever X is.
- Formal *Sie* goes to the plural cell (`S.Sie`, verb `V.sie_pl`).
- Cases in play sentences: only those already taught. Datives before 5.2 only after *aus/in* +
  place name, *am/im* in time phrases (3.1), and *mir/dir*.

### Rules for `play` sentences
- Exactly one sentence (one clause at A1; at most two clauses, i.e. main + subordinate, from A2).
- At A1, at most about 10 words; at A2 about 12; at B1 about 16.
- Must contain a subject and a finite verb. No fragments (*Gern!*, *Warum nicht?*), so these become `read`.
- No lists, addresses, prices, clock times or dates *inside* play sentences, except in the chapter
  that teaches them, and then in simple form (*Der Termin ist um neun Uhr.*).
- No dash-joined clauses (*X – Y*). Split them into two beats.
- Prefer sentences where gender and case matter: nouns with articles, possessives, pronouns.

## Skill ladder (Goethe order)

Skill ids are `<level>.<name>`. Chapter numbers refer to the stories in STORY_BIBLE.md.

### A1 — Ankommen
| Skill id | Content | Chapter |
|---|---|---|
| A1.nom | *sein*, personal pronouns, nominative, names | 1.1 |
| A1.praesens | regular verbs in the present tense (*wohnen, kommen, heißen*) | 1.2 |
| A1.artikel | der/die/das, ein/eine, plural | 1.3 |
| A1.fragen | W-questions and yes/no questions (verb position) | 1.4 |
| A1.haben | *haben*, irregular verbs (*essen, sprechen, nehmen*) | 1.5 |
| A1.akk | accusative with articles (*den, einen*) | 2.1 |
| A1.negation | *nicht / kein* | 2.2 |
| A1.possessiv | *mein, dein, sein, ihr, unser, Ihr* (nominative + accusative) | 2.3 |
| A1.zeit | numbers, clock times, *am / um / im / von … bis* | 3.1 |
| A1.modal | *können, müssen, wollen, dürfen* (verb bracket) | 3.2 |
| A1.akk_pronomen | *mich, dich, ihn, sie, es, uns, euch* | 3.3 |
| A1.moechten | *möchten*, polite requests | 4.1 |
| A1.trennbar | separable verbs (verb bracket) | 4.2 |
| A1.konnektoren | *und, aber, oder, denn* (two main clauses) | 4.3 |
| A1.imperativ | imperative (*Sie*, *du*) | 5.1 |
| A1.dativ_praep | dative after *mit, bei, von, zu, aus, nach*; *mir/dir* | 5.2 |
| A1.perfekt | first Perfekt (*habe gemacht, bin gefahren*), *war/hatte* | 5.3 |

### A2 — Einleben
| Skill id | Content |
|---|---|
| A2.perfekt | Perfekt, full (regular, irregular, separable, *sein*/*haben*) |
| A2.dativ | dative objects and pronouns; verbs with dative (*helfen, gefallen, gehören*) |
| A2.dat_akk | dative + accusative in one sentence (*Ich gebe dem Patienten das Rezept.*) |
| A2.wechselpraep | two-way prepositions: *wo?* → dative, *wohin?* → accusative |
| A2.reflexiv | reflexive verbs (*sich freuen, sich anmelden*), *sich* in Akk vs Dat |
| A2.nebensatz | *weil, dass, wenn, ob* (verb at the end) |
| A2.praeteritum | *war, hatte*, modal verbs in the Präteritum |
| A2.komparativ | comparative and superlative |
| A2.adjektiv | adjective endings after articles (basic) |
| A2.konj2_hoeflich | *würde, könnte, hätte gern* (polite requests) |
| A2.futur | *werden* + infinitive; future with a time phrase |
| A2.imperativ | imperative, all forms |
| A2.indirekte_frage | indirect questions (*Wissen Sie, wo …?*) |

### B1 — Im Krankenhaus
| Skill id | Content |
|---|---|
| B1.praeteritum | Präteritum of all common verbs (narration) |
| B1.plusquamperfekt | Plusquamperfekt |
| B1.passiv | passive, present and past (*Der Patient wird untersucht.*) |
| B1.relativsatz | relative clauses (gender comes from the noun, case from the clause) |
| B1.infinitiv | *zu* + infinitive, *um … zu*, *damit* |
| B1.temporal | *als, wenn, während, bevor, nachdem, seit, bis* |
| B1.konzessiv | *obwohl, trotzdem* |
| B1.kausal | *deshalb, deswegen, darum*, *da* |
| B1.genitiv | genitive and genitive prepositions (*wegen, trotz, während*) |
| B1.adjektiv | adjective declension, all cases |
| B1.konj2 | Konjunktiv II (wishes, unreal conditions, advice) |
| B1.zweiteilig | *sowohl … als auch, weder … noch, entweder … oder, nicht nur … sondern auch* |
| B1.pronominaladverb | *darauf, worüber, dafür …* |
| B1.n_deklination | n-declension (*den Patienten, dem Kollegen*) |
| B1.indirekte_rede | reported speech (basic Konjunktiv I) |

### Later — B2/C1 and FSP (not yet planned in detail)
Anamnese, Patientenvorstellung, Arztbrief, Aufklärungsgespräch, Fachbegriff ↔ Alltagssprache.

## Existing grammar categories
The current `data/levels/` grammar files (A1_hauptsatz, A2_dativ, B1_relativsatz, …) map onto the
skill ids above. They stay playable until drills with the new cast replace them. The Vienna stories
(*Neue Nachbarn*, *Der Herbstmarkt*) will be removed once the first new chapters exist.

## Open questions
- Whether A1 Perfekt (5.3) is enough of a preview, or should move fully to A2.
- Per-sentence `skill` tags, so "Review weak spots" can target a skill across chapters.
- Narrated story mode (word-by-word highlighting) using the same beats.
- Malayalam meanings in the glossary (needs a reviewer who speaks Malayalam).
