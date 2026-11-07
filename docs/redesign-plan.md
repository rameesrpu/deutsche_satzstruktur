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

### [ ] U2 Base look: tokens, fonts, buttons
Swap the neutral/brand tokens in `:root` of `css/styles.css` to the surfaces above, load Literata,
make primary buttons ink, drop the indigo header gradient; mirror in `GM_UI` (gameHud.js).
**Done when**: no indigo/teal/orange chrome left on the main screens (400×850 and 1280×800 screenshots).

### [ ] U3 Home screen + screen router
A small router in `app.js` (home / read / play / end / practice / workshop). Home = "Weiter mit
Kapitel …" card (Lesen / Spielen), today's goal, weak-spot count (from `progressStore`), chapter
list with done / current / locked (`LevelSelector.isUnlocked`). Bottom nav: Lernen, Üben, Wörter,
Werkstatt. The current editor (sentence input, Parse/Check, Properties, Feldermodell, import/export)
moves under Werkstatt unchanged.
**Done when**: the app opens on Home; every old feature is still reachable from Werkstatt.

### [ ] U4 Reader restyle
`storyReader.js` on the new look: Literata, header with back + progress + read-aloud, glossary
bottom bar instead of the popover, play-sentence dot, "Jetzt spielen" button.

### [ ] U5 Play screen
Full screen in game mode: no app header/editor chrome; top = close, segmented progress, score;
sentence with the current phrase framed; grid; case tray (NOM/AKK/DAT/GEN shapes) at the bottom;
feedback bar that names gender + case → form. Narration card becomes a solid bottom sheet.
The "no German voice" toast must not cover the narration card.

### [ ] U6 Chapter-end recap
After a chapter: sentences / % correct / new words, "Das war schwer" (missed sentences with the
`explainMistake` reason), new words as chips colored by gender, "Weiter: next chapter" and
"schwere Sätze nochmal".

### [ ] U7 Settings and daily goal
Keep only sound / speech / timer for the learner; move Max Points and Multiple Categories to
Werkstatt. Daily goal (sentences per day) shown on Home. Later: installable PWA.
