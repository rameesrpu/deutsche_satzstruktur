# Spatial boards: design

Status: written 2026-11-16 by Claude at the owner's request ("write all plans"). The owner has
**not** reviewed the calls marked *my call*. Read them before executing the plans.

Roadmap project 4 ([docs/roadmap.md](../../roadmap.md)). Three plans come out of this design:

| Plan | Contents |
|---|---|
| [4a boards and body map](../plans/2026-11-16-boards-body-map.md) | The shared board framework and the first board: the body |
| [4b preposition scene](../plans/2026-11-16-boards-preposition-scene.md) | Wechselpräpositionen in Frau Schäfer's garden |
| [4c timeline](../plans/2026-11-16-boards-timeline.md) | Past, now, future and the Perfekt bracket |

4b and 4c need 4a's framework. 4b and 4c do not depend on each other.

## Intent

The grid makes case and gender visible. Three other parts of German are spatial by nature and
get no picture today: where things are on a body, where things are and move in a room, and
when something happens. Each gets a board: a picture she acts on, not a list she reads.

## Goals

- A board is a small, self-contained practice area on the Üben screen.
- Every board teaches by position: tapping a place, moving a thing, dropping a card on a zone.
- Board items come back on a schedule, like sentences do.
- Boards unlock with the story chapter that makes them useful.
- A new board is a data file, a picture and one module. The framework does the rest.

## Non-goals

- Mixing board items into the "Heute üben" sentence session. *My call:* each board has its own
  "Wiederholen" button; one session type at a time keeps both simple. Revisit when she uses both.
- "Places as memory" (words reviewed in the room where she met them). The hotspot board built
  in 4a is the tool for it; choosing rooms and words is a later content job.
- Futur and Präteritum on the timeline (4c covers Perfekt; the others are data added later).
- Hand-drawn or licensed anatomy art. The pictures are simple flat SVGs made in the project.

## Anti-goals

- A wrong article, plural or participle in the data. The plans list the vocabulary; reviewers
  check every item.
- Pictures that use the grammar colours as decoration (they would look like gender or case).
- A body figure that is uncomfortable for her. *My call:* a neutral, featureless mannequin
  outline, like the figure on a medical form. The owner checks the picture before it ships.

## The framework (plan 4a)

- **Data:** `data/boards/<id>.json` = `{id, title, version, kind, sets: [...]}`. A set has an
  id, a title, an optional unlock chapter and its items.
- **Schedule:** five boxes. A right first answer moves an item up a box and brings it back
  after 3, 7, 14 or 30 days (box 1–4); a wrong first answer sends it to box 0, due the next
  day. Stored in the progress store next to the sentences.
- **Session:** up to 10 items: those due first, then up to 5 new ones. An item answered wrong
  comes back once at the end of the session.
- **Üben screen:** a "Bilder" section with one card per board: title, "12 von 22 gelernt",
  "Wiederholen (4)" when items are due.
- **Board screen:** the set list (locked sets greyed with the chapter that unlocks them), then
  one set with its mode buttons.

## Body map (plan 4a)

A hotspot board: a picture with named points.

| Set | Picture | Items | Unlocks after |
|---|---|---|---|
| Der Körper | front view | 19 | A1 chapter 5.1 (Beim Arzt) |
| Das Gesicht | face | 12 | A1 chapter 5.1 |
| Von hinten | back view | 6 | A1 chapter 5.1 |
| Die Organe | torso with organs | 14 | all of A1 |

Modes:
- **Entdecken:** every point is shown. Tap one: the word with its article in its gender
  colour, the plural, the meaning, and it is spoken.
- **Zeigen:** "Wo ist das Knie?" is shown and spoken. She taps the place.
- **Benennen:** one point pulses. She picks the word from four.
- **Wo tut es weh?** A patient says "Mein Knie tut weh." or "Meine Augen tun weh." She taps
  the place. (*mein/meine* and *tut/tun* follow gender and number: a small grammar lesson.)

## Preposition scene (plan 4b)

Frau Schäfer's garden, with a hen. Landmarks cover every gender and the plural: der Tisch,
die Bank, das Hühnerhaus, der Zaun, der Baum, die Kiste, die Blumen.

The one idea to make visible: **movement to a place is Akkusativ (an arrow); being at a place
is Dativ (a dot).**

Modes:
- **Entdecken:** tap a place. The hen walks there along an arrow: "Wohin? Das Huhn läuft
  unter **den** Tisch." Then it sits, the arrow becomes a dot: "Wo? Das Huhn sitzt unter
  **dem** Tisch."
- **Wohin? / Wo?** A sentence is shown and spoken. She taps the place it describes.
- **Artikel:** the hen moves (arrow) or sits (dot). The sentence has a blank:
  "Das Huhn läuft unter ___ Tisch." She picks *den* or *dem*.
- **Satz:** two blanks, the preposition (four choices) and the article.

Unlocks after all of A1. (A2 teaches the rule; the board is its picture.)

## Timeline (plan 4c)

A line with three zones: Vergangenheit, Jetzt, Zukunft.

Modes:
- **Wann?** A sentence card. She drops it on its zone. "Gestern habe ich gekocht." →
  Vergangenheit. "Morgen koche ich." → Zukunft, although the verb is in the present tense.
- **Klammer:** build the Perfekt. "Ich [ ? ] gestern Biryani [ ? ]." The two verb parts are
  the arms of a clamp around the middle of the sentence. She picks the helper verb
  (*habe* / *bin*) and the participle (one right, two wrong forms). The clamp closes.
- **haben oder sein?** Verb cards go into one of two bins. The *sein* bin shows an arrow from
  A to B: movement or change.

Sets: Perfekt 1 (12 verbs, unlocks after A1 chapter 5.3, the last A1 chapter) and Perfekt 2
(24 verbs, unlocks after the first A2 chapter, so it stays locked until that chapter exists).

## My calls (correct any of them)

- Boards live on Üben, with their own review button.
- The body figure is a neutral mannequin outline.
- The scene is the garden with the hen (she likes chickens; Frau Schäfer keeps them).
- Unlock points as listed.
- Pictures are drawn as SVG by the implementing agent; the owner approves each one.

## Open questions for the owner

1. Is the mannequin figure acceptable, and should the organs set come this early?
2. Should board reviews count toward the daily goal ring? (The plans say yes.)
