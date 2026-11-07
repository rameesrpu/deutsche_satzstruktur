# UI Redesign Plan

> **Audience**: AI coding agents (and the owner) picking up work in a fresh conversation.
> Do one item per conversation: read the item and the files it lists, verify with *Done when*,
> tick the checkbox, add a dated one-line note, and commit.

**Mockup** (agreed with the owner, 2026-11-07): https://claude.ai/artifact/TBi79B4jH7QuLj69Cb9tWA —
phone screens Home → Lesen → Spielen → Kapitel geschafft, plus a colors & type sheet.

## Why

The app still opens as a sentence *editor* (empty canvas, Parse/Check, Properties, developer
settings), while the person using it is a beginner learning through the A1 story. The redesign
turns the main path into one flow per chapter — **Lesen → Spielen → Rückblick** — and moves the
editor to a "Werkstatt" tab.

## Design decisions (owner-approved)

- **Calm chrome, colored grammar.** Warm paper surfaces and dark ink buttons; the grammar
  colors are the only strong colors. No indigo header gradient, no multicolored buttons.
- **Grammar palette "Gedämpft"** (single source: `GRAMMAR_PALETTE` in `js/grammaticalConfig.js`;
  CSS mirror `--gram-*` in `css/styles.css`). Each category has `c` (main), `ink` (text on light
  surfaces, ≥ 4.5:1) and `tint` (selected/soft fill).
  The four noun groups get four far-apart hues; persons take the in-between hues:

  | Category | Hue | c | ink | tint |
  |---|---|---|---|---|
  | Maskulin | blue | `#3F6FB0` | `#2C5590` | `#E9EFF7` |
  | Feminin | rose | `#B9476A` | `#93334F` | `#F6E9EE` |
  | Neutrum | green | `#4E8B5A` | `#336B40` | `#E8F2EA` |
  | Plural | ochre | `#B98A2C` | `#755512` | `#F6EFDF` |
  | ich | violet | `#7A5AA6` | `#5B3F88` | `#EFEAF6` |
  | du | terracotta | `#C2603A` | `#923F20` | `#F7EAE4` |
  | ihr | teal | `#2E8288` | `#1F5F64` | `#E4F1F2` |
  | wir | slate | `#556070` | `#434C5A` | `#ECEDF0` |
  | Imperativ / none | grey | `#8B8F96` | `#5D626B` | `#F0F0F1` |

  Neutrum is green and ich violet (swapped from the old palette) so neuter never looks like masculine.
- **Grid tiles: "Kontur" + "Versalien".** Transparent tiles with a faint outline in the tile's
  color (~33 % alpha); selected = tint fill + 2.5 px solid outline. Label = the *category* in
  small tracked capitals (11 px, 600, letter-spacing 0.14em, ink color): MASKULIN, FEMININ,
  NEUTRUM, PLURAL, IMPERATIV, ICH, DU, WIR, IHR. **Never an article** on a tile — the article
  depends on the case (*der/den/dem Markt*); the feedback teaches it as the result
  ("Feminin + Nominativ → *die* Heimat").
- **Type.** Literata (serif) for story text and the sentence being played; Inter for UI.
- **Surfaces.** Papier `#F6F3EC`, Lesen `#FBF9F4`, Fläche `#FFFFFF`, Linie `#E6E1D6`,
  Tinte `#1E1F24`, Leise `#6E6B66`.
- **Reader.** Tap a dotted-underlined word → meaning in a bottom bar (not a popover).
  Play sentences: a small green dot after the sentence (option: none).
- Icons are inline stroke SVGs, not emoji. Touch targets ≥ 44 px.

## Items

### [x] U1 One grammar palette
> 2026-11-07 done. `GRAMMAR_PALETTE` + `GRID_CELLS` in grammaticalConfig.js; gamemode, gridview,
> gameJuice, styles.css tokens and the index.html legend read from it. Game-mode grid tiles use
> Kontur + Versalien with German labels.

### [x] U2 Base look: tokens, fonts, buttons
> 2026-11-07 done. `:root` has the surfaces (`--paper`, `--paper-read`, `--line`, `--ink`, `--ink-soft`);
> `--brand-*` is now an ink/warm-neutral scale, semantic colors muted, violet/teal tokens removed.
> Button tokens `--btn-primary-*` (ink) / `--btn-secondary-*` (white + line). Header is white with ink
> text; `--header-bg` is solid ink (story card heading, reader). Literata replaces Nunito
> (`--font-sentence` and SVG word text). `GM_UI` uses `accent`/`accentSoft`/`accentTint` (ink) instead
> of `indigo*`; feldermodell/renderer/gridview SVG mirrors updated. Checked at 400×850 and 1280×800
> (editor + game mode).

### [x] U3 Home screen + screen router
> 2026-11-07 done. `showScreen()` in app.js sets `body[data-screen]` (home / practice / words /
> workshop / play; the reader is an overlay that returns to its screen; 'end' is left for U6).
> Screens are built by `js/homeScreen.js` (pure helpers unit-tested in tests/homeScreen.test.js).
> Home: "Weiter mit Kapitel" card (Lesen / Spielen), today's sentences vs `DAILY_GOAL` (10, U7 makes it
> a setting), weak spots (`reviewWeight` > 0 → "Schwächen üben" = review game over all levels), the
> current story's chapters (done / current / locked). Üben: weak spots, drills of unlocked chapters,
> grammar categories. Wörter: glossary of unlocked chapters, article in its gender ink. Werkstatt =
> the old editor unchanged. Play = game canvas without header/editor panels; ✕ (or target score) goes
> back Home. Leaving play/workshop stops a running game. Checked at 375×812 and 1280×800.

### [x] U4 Reader restyle
> 2026-11-07 done. Reader on `--paper-read` in Literata; header = back, "Story · Kapitel n" + reading
> (scroll) progress, read-aloud (greyed when no German voice / speech off); glossary words open an ink
> bottom bar (`renderGlossedText(…, onWord)`; the narration card keeps the popover); green dot after play
> sentences (`--read-play-dot`); sticky "Jetzt spielen". Pure helpers tested in tests/storyReader.test.js.
> Checked at 375×812 and 1280×800 from Home, Werkstatt 📖 and in-game "Erst lesen".

### [x] U5 Play screen
> 2026-11-07 done. On `body[data-screen="play"]` the game chrome is HTML (`js/playScreen.js`) around
> the SVG grid (viewBox = grid via `GameMode.getBoardBounds()`; SVG HUD/controllers only in the
> Werkstatt): top bar ✕ (→ Home) · segmented progress (chapter sentences, else a 10-sentence session
> window) · score + streak; sentence in Literata 26 px with the current phrase framed, earlier words
> muted, same reveal as the old word bar; feedback bar above the case tray (`placementFeedback()` in
> gameRules.js: "Richtig! Feminin + Nominativ → die", noun line in German; wrong = `explainMistake`
> lines, still English; auto-placed = "Lösung:"); `articleFor(gender|'pl', case)`; tray = NOM/AKK/DAT/GEN
> shape buttons 72 px (A/S/D/F still work), "Satzbau ansehen" / "Nächster Satz" after a sentence.
> Narration card = solid paper bottom sheet without scrim, stroke icons, read-aloud greyed without a
> German voice; the TTS notice sits at the top. Tests: tests/playScreen.test.js + gameRules tests.
> Checked at 375×812 and 1280×800 (card, placing, wrong, solved sentence, Feldermodell review,
> chapter end, timer, TTS notice, Werkstatt game unchanged).

### [ ] U6 Chapter-end recap
After a chapter: sentences / % correct / new words, "Das war schwer" (missed sentences with the
`explainMistake` reason), new words as chips colored by gender, "Weiter: next chapter" and
"schwere Sätze nochmal".

### [ ] U7 Settings and daily goal
Keep only sound / speech / timer for the learner; move Max Points and Multiple Categories to
Werkstatt. Daily goal (sentences per day) shown on Home. Later: installable PWA.
