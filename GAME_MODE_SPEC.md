# Game Mode Specification - Deutsche Satzstruktur

## Overview
A mobile game mode (landscape orientation) where players place German sentence words/phrases into a 3x3 grid by using dual-controller mechanics inspired by mobile FPS games like Call of Duty Mobile. The goal is to build muscle memory for German conjugation and grammatical case recognition.

---

## Grid Layout (3×3 Structure)

```
┌─────────────────┬─────────────────┬─────────────────┐
│   MASCULINE     │      DU         │   FEMININE      │
│   (Northwest)   │    (North)      │  (Northeast)    │
│   Row 1, Col 1  │  Row 1, Col 2   │  Row 1, Col 3   │
│   Blue #3498db  │ Orange #e67e22  │  Pink #e91e63   │
├─────────────────┼─────────────────┼─────────────────┤
│    NEUTRAL      │      ICH        │    PLURAL       │
│     (West)      │   (Center)      │    (East)       │
│   Row 2, Col 1  │  Row 2, Col 2   │  Row 2, Col 3   │
│ Violet #8e44ad  │ Green #27ae60   │   Red #c0392b   │
├─────────────────┼─────────────────┼─────────────────┤
│      IHR        │      WIR        │    [UNUSED]     │
│  (Southwest)    │    (South)      │  (Southeast)    │
│   Row 3, Col 1  │  Row 3, Col 2   │  Row 3, Col 3   │
│ Orange #f39c12  │  Gray #2c3e50   │ Light #f5f5f5   │
└─────────────────┴─────────────────┴─────────────────┘
```

**Grid cells are visible but empty** at the start of each sentence.

---

## Controllers

### Right Hand Controller - Subject & Verb Placement
**Visual**: Round, semi-transparent white object
**Position**: Bottom-right corner of screen
**Purpose**: Place subjects (nouns/pronouns) and conjugated verbs

**9-Directional Mapping**:
- **Center** (press & hold): **ich** (Row 2, Col 2)
- **North**: **du** (Row 1, Col 2)
- **Northeast**: **sie/feminine** (Row 1, Col 3)
- **East**: **sie/plural** (Row 2, Col 3)
- **Southeast**: unused (Row 3, Col 3) - arrow shown for aesthetics
- **South**: **wir** (Row 3, Col 2)
- **Southwest**: **ihr** (Row 3, Col 1)
- **West**: **es** (Row 2, Col 1)
- **Northwest**: **er/masculine** (Row 1, Col 1)

**Interaction**:
- Touch controller → center cell highlights by default
- Drag in direction → arrow appears instantly when threshold crossed
- Target cell highlights in real-time as drag direction changes
- Release → word/verb placed in highlighted cell

---

### Left Hand Controllers - Object Placement
**Visual**: Three controllers side by side, each with distinct shape
**Position**: Bottom-left corner of screen
**Purpose**: Place object pronouns/nouns in correct case

**Three Separate Controllers**:

1. **Nominative Controller** (Round/Circle shape)
2. **Accusative Controller** (Square shape)
3. **Dative Controller** (Trapezoid shape)

Each controller has the **same 9-directional mapping** as the right controller:
- **Center**: mich/mir/ich (depending on case)
- **North**: dich/dir/du
- **Northeast**: sie (feminine)
- **East**: sie (plural)
- **Southeast**: unused (arrow shown)
- **South**: uns/wir
- **Southwest**: euch/ihr
- **West**: es
- **Northwest**: ihn/ihm/er (masculine)

**Interaction**: Same as right controller (touch, drag, highlight, release to place)

**Visibility**: All three controllers are always visible and enabled when objects need to be placed. Player selects the appropriate case controller based on the word's grammatical case.

---

## Word Placement Rules

### Manual Placement (Requires User Action)
These words appear at the top of the screen and must be manually placed:

1. **Subject nouns/pronouns** (use right controller)
   - Examples: Ich, du, der Mann, die Frau, das Kind
   - Note: **Noun phrase clustering** - Articles, adjectives, and determiners are part of the noun phrase cluster and appear together in one box
     - "der Mann" → one box
     - "den großen Mann" → one box
     - "mein kleiner Bruder" → one box

2. **Conjugated verbs/modals** (use right controller, drag in same direction as subject)
   - Examples: sehe, siehst, kann, möchte, hat
   - Verb appears on the **arrow** (incoming/outgoing based on sentence position)
   - Direction must match the subject it conjugates with

3. **Object nouns/pronouns** (use left controller - select appropriate case)
   - Examples: den Mann (accusative), dem Kind (dative), mir, dich
   - Note: **Noun phrase clustering** applies to objects too
     - "den Mann" → one box (accusative)
     - "dem kleinen Kind" → one box (dative)
     - "die schöne Frau" → one box (accusative/nominative depending on context)
   - **Implementation**: Use the existing `parseSentenceFlow()` from gridview.js to identify noun phrase clusters

### Auto Placement (Automatic After Dependencies)
These words automatically place themselves:

1. **Infinitive verbs** (unconjugated)
   - Examples: sehen, kaufen, gehen
   - Auto-place immediately after the relevant box is placed

2. **Prepositions**
   - Examples: mit, nach, für
   - Auto-place in original sentence order (after the previous word is placed)

3. **Conjunctions**
   - Examples: weil, dass, und
   - Auto-place in original sentence order

**Animation**: All auto-placed words animate from top to their position so the user sees the movement.

---

## Noun Phrase Clustering

The game uses the same clustering mechanism as the gridview to identify which words belong together in a phrase.

**Implementation**: Reuse the existing `parseSentenceFlow()` function from [gridview.js](js/gridview.js):
- `collectNounPhrase()` - Collects articles, adjectives, determiners, and nouns together
- `canBeInNounPhrase()` - Determines if a word can be part of a noun phrase
- Returns `boxes` array where each box is a complete noun phrase cluster

**Examples of Clustered Phrases**:
- "der Mann" (article + noun)
- "den großen Mann" (article + adjective + noun)
- "mein kleiner Bruder" (possessive + adjective + noun)
- "die schöne alte Frau" (article + multiple adjectives + noun)
- "dem freundlichen deutschen Lehrer" (article + multiple adjectives + noun)

**In Game Mode**:
1. Parse sentence using `parseSentenceFlow()`
2. Each "box" appears as a **single unit** at the top of screen
3. Player places the entire phrase with one controller action
4. The complete phrase appears in one box in the grid

---

## Gameplay Flow

### Game Start
1. Landscape mode activated
2. Empty 3×3 grid displayed (colored cells visible)
3. Sentence loaded
4. First word appears at **top of screen**

### Word-by-Word Placement
**Order**: Original sentence order (left to right)

**For each word**:
1. Word appears at top
2. Appropriate controller(s) enabled (others greyed out/disabled)
   - For subjects/verbs: Right controller enabled, left controllers disabled
   - For objects: Left controllers enabled, right controller disabled
3. Player touches enabled controller
4. Center cell highlights by default
5. Player drags in direction (optional)
6. Arrow appears, target cell highlights in real-time
7. Player releases controller
8. Word animates from top to target position
9. Score updates if correct
10. Any dependent auto-placed words animate to their positions
11. Next word appears (or sentence complete)

### Example: "Ich sehe den Mann"

**Step 1**: "Ich" appears
- Right controller enabled, left controllers disabled (greyed out)
- Player presses center (hold)
- Center cell (ICH) highlights
- Player releases
- "Ich" box animates to center cell ✓

**Step 2**: "sehe" appears
- Right controller enabled (verb), left controllers disabled
- Player presses center (same as subject)
- Center cell highlights
- Player releases
- "sehe" animates to outgoing arrow from "Ich" box ✓

**Step 3**: "den Mann" appears (parsed as phrase)
- Left controllers enabled (all three visible), right controller disabled
- Player selects and touches accusative controller (square)
- Drags northwest (masculine direction)
- Northwest cell highlights
- Player releases
- "den Mann" box animates to masculine cell ✓

**Sentence complete** → Score updates → Next sentence loads

### Example 2: "Der große Mann sieht den kleinen Hund"

**Step 1**: "Der große Mann" appears (clustered phrase)
- Right controller enabled, left controllers disabled
- Player drags northwest (masculine)
- Northwest cell highlights
- Player releases
- "Der große Mann" box animates to masculine cell ✓

**Step 2**: "sieht" appears
- Right controller enabled
- Player drags northwest (same as subject)
- Northwest cell highlights
- Player releases
- "sieht" animates to outgoing arrow from masculine box ✓

**Step 3**: "den kleinen Hund" appears (clustered phrase)
- Left controllers enabled, right controller disabled
- Player selects accusative controller (square)
- Drags northwest (masculine)
- Northwest cell highlights
- Player releases
- "den kleinen Hund" box animates to masculine cell (below "Der große Mann") ✓

**Sentence complete** → Score updates → Next sentence loads

---

## Visual Feedback

### Cell Highlighting
- **Default**: Center cell highlights when controller is touched
- **During drag**: Target cell highlights in real-time based on drag direction
- **Color**: Use the cell's background color with increased opacity/glow effect

### Arrow Display
- **Single arrow** appears instantly when drag threshold is crossed
- Arrow points in the direction being dragged
- Arrow updates in real-time as drag direction changes
- 8 directional arrows (N, NE, E, SE, S, SW, W, NW) + center (no arrow)

### Placement Feedback

**Correct Placement**:
- Word/box animates from top to target position
- Subtle success effect (green flash/checkmark)
- Score increases

**Incorrect Placement**:
- Red highlight appears on placed word
- Word automatically moves to correct position with animation
- No score increase (or score penalty)

### Controller States
- **Enabled**: Full opacity, responsive to touch
- **Disabled**: Greyed out/reduced opacity, not responsive to touch (but still visible)

---

## Verb Placement Details

### Conjugated Verbs (Manual)
All conjugated verbs/modals require manual placement using the **right controller**.

**Placement Direction**: Drag in the **same direction as the subject** to show connection.

**Position on Arrow**:
- **Outgoing arrow**: If verb appears after subject in sentence
  - Example: "Ich sehe" → "sehe" on outgoing arrow from "Ich"
- **Incoming arrow**: If verb appears before subject (rare)
- **Between boxes**: If verb is between two boxes

**Examples**:

1. "Ich sehe den Mann"
   - "sehe" → right controller, center direction → outgoing arrow from ich box

2. "Du kannst den Mann sehen"
   - "kannst" → right controller, north direction → outgoing arrow from du box
   - "sehen" → auto-places at end

3. "Der Mann sieht mich"
   - "Der Mann" → right controller, northwest (masculine)
   - "sieht" → right controller, northwest → outgoing arrow from masculine box
   - "mich" → left controller (accusative), center

### Infinitive Verbs (Auto)
Unconjugated verbs at end of sentence auto-place immediately after their dependent box is placed.

---

## Scoring System

### Points
- **Correct box placement**: +10 points per box
- **Sentence completion**: +50 bonus points
- **Incorrect placement**: 0 points (word auto-corrects)

### Progression
- **Sentence queue**: Use dummy test sentences initially
- **Next sentence**: Auto-loads after current sentence is complete
- **Difficulty**: (Future) Progressive difficulty based on sentence complexity

---

## Technical Implementation Notes

### Drag Sensitivity
- **Threshold**: Moderate sensitivity for mobile touch
- Start with a threshold that makes it easy to select tiles on phone
- Adjust based on testing

### Real-time Updates
- Cell highlighting updates in real-time during drag
- Arrow direction updates in real-time during drag
- Only place word when controller is released

### Animation Timing
- Word appearance: 300ms fade-in
- Word movement: 500ms smooth animation from top to cell
- Auto-placed words: 400ms animation with slight delay (stagger if multiple)

### Grid View Consistency
**Note**: Current gridview implementation shows conjugated verbs on arrows. In game mode, this should be consistent - verbs are placed on arrows even when manually placed by the player.

**Future Enhancement**: Update gridview to also show conjugated verbs in boxes for visual consistency.

---

## Example Sentences for Testing

1. **Simple**: "Ich sehe dich" (I see you)
2. **With adjectives**: "Der große Mann sieht den kleinen Hund" (The big man sees the small dog)
3. **Modal**: "Du kannst mir helfen" (You can help me)
4. **Dative**: "Ich gebe dem kleinen Kind das neue Buch" (I give the small child the new book)
5. **Preposition**: "Er geht mit mir" (He goes with me)
6. **Complex phrase**: "Mein großer Bruder hilft dem freundlichen Lehrer" (My big brother helps the friendly teacher)
7. **Subordinate**: "Ich weiß, dass du mich siehst" (I know that you see me)

---

## Design Goals

### Primary Goal
Build **muscle memory** for:
- German verb conjugation (connecting subjects with correct verb forms)
- Grammatical case recognition (nom/acc/dat)
- Pronoun declension patterns

### Secondary Goals
- Make grammar learning engaging through game mechanics
- Provide immediate visual feedback
- Create intuitive connection between grammatical concepts and spatial/motor memory

---

## Future Enhancements (Not in Initial Implementation)

- Combo/streak system for consecutive correct placements
- Timed mode
- Difficulty levels (sentence complexity)
- Achievement system
- Multiplayer competition
- Sound effects and haptic feedback
- Tutorial mode
- Practice specific grammar patterns (only dative, only modals, etc.)

---

## Screen Layout Reference

```
┌──────────────────────────────────────────────────────────┐
│                    [Word to Place]                       │ ← Top
│                                                          │
│  ┌──────────┬──────────┬──────────┐                    │
│  │          │          │          │                    │
│  │          │          │          │                    │
│  ├──────────┼──────────┼──────────┤                    │
│  │          │          │          │   Grid View        │
│  │          │    ✓     │          │   (Center)         │
│  ├──────────┼──────────┼──────────┤                    │
│  │          │          │          │                    │
│  │          │          │          │                    │
│  └──────────┴──────────┴──────────┘                    │
│                                                          │
│  ●━●━●     Score: 150                        ⭕         │ ← Bottom
│  Left Hand                                   Right       │
│ Controllers                                Controller    │
│ (3 shapes)                                  (1 circle)   │
└──────────────────────────────────────────────────────────┘
       Landscape Mode (Phone Horizontal)
```

---

End of Specification
