# GameMode Architecture

## Components

Three classes collaborate:
- **`GameMode`** (`gamemode.js`) — game logic, word bar, placement validation
- **`GridViewModel`** (`gridview.js`) — grid rendering, sentence parsing, arrow/box drawing
- **`WordManager`** — holds sentence words with their linguistic metadata

---

## Sentence startup flow

```
startNewSentence()
  ├── parseSentence()          → this.parsedSentence  (via gridViewModel.parseSentenceFlow)
  ├── buildManualItems()       → this.manualItems, this.wordToManualItem
  └── preCalculateGridView()   → this.preCalculatedBoxes, this.preCalculatedConnections, …
```

### `parseSentence()` / `parseSentenceFlow()`
Runs once per sentence. Produces `parsedSentence`:
```
{
  boxes:        [ { words, mainWord, case }, … ]   // noun phrases as single units
  connections:  [ [word, …], … ]                   // words between/after boxes
  leadingWords: [ word, … ]                        // words before first box
  trailingWords:[ word, … ]                        // words after last box (legacy)
}
```
Connection array is one longer than boxes when there are sentence-final words (e.g. infinitive "surfen").

### `buildManualItems()`
Walks `this.words` (sentence order) and produces:

- **`this.manualItems`** — ordered list of things the user must place:
  ```
  [ { type:'box',  item: box,  boxIndex: n },
    { type:'word', item: word },  … ]
  ```
  Only noun-phrase boxes and conjugated verbs/modals are manual. Everything else (prepositions, adjectives, adverbs, articles, infinitives) is auto-placed.

- **`this.wordToManualItem`** — `Map<wordObject → manualItem>`. Used by `filterVisibleWords` and the right preview.

### `preCalculateGridView()`
Mirrors gridview's layout logic to compute pixel `(centerX, centerY)` for every box **before** any placement happens. Stored in `this.preCalculatedBoxes[i]`. This means the grid position is fixed at game start and never recalculated mid-game.

---

## Per-frame draw flow

```
draw()
  ├── drawEmptyGrid()          // 3×3 colored cells + click handlers
  ├── drawPlacedItems()        // revealed boxes + arrows between them
  ├── drawFeedbackAnimation()  // ✓ / ✗ flash
  ├── drawControllers()        // NOM/AKK/DAT/GEN buttons
  └── drawUIOverlay()          // word bar (left | center | right) + score
```

---

## Word bar (drawUIOverlay)

Three zones derived entirely from `this.words` and `this.currentIndex`:

| Zone | Source |
|------|--------|
| **Left** (auto-words already passed) | `getVisibleAutoWords()` — non-manual words in `this.words` between `manualItems[currentIndex-1]` and `manualItems[currentIndex]` |
| **Center** (current word to place) | `manualItems[currentIndex]` |
| **Right** (next word preview) | `this.words[ getItemWordRange(currentItem)[1] + 1 ]`, expanded to full box phrase if that word belongs to a box |

`getItemWordRange(item)` returns `[startIdx, endIdx]` into `this.words` for a manual item.

---

## Placement flow

```
tap cell → handleCellTap(row, col)
  └── placeWord(row, col, caseType)
        ├── validatePlacement()    // checks getWordPosition() row/col + case
        ├── if correct:
        │     revealedBoxIndices.add(boxIndex)   // show on grid
        │     currentIndex++
        │     updateCurrentWordDisplay()
        │     if complete → showGameComplete()
        └── if wrong 3×:
              autoPlaceCurrentWord()             // forced correct placement
```

### `validatePlacement(word, row, col, caseType)`
- Gets expected cell from `gridViewModel.getWordPosition(word)` — depends on word's pronoun / gender / number
- Verbs/modals: position check only, no case check
- Subjects/objects: position + case must match

### Grid reveal (`drawPlacedItems`)
Only draws boxes whose `boxIndex` is in `this.revealedBoxIndices`. Connection words on arrows are filtered through `filterVisibleWords()` — a word is visible iff `wordToManualItem` places its item before `currentIndex` in `manualItems`.

---

## Grid cell layout

```
Row 1: MASCULINE (m)  | DU          | FEMININE (f)
Row 2: NEUTRAL (n)    | ICH         | PLURAL (pl)
Row 3: IHR            | WIR         | (empty)
```

Subjects use pronoun → cell. Objects use gender/number → cell. Verbs use their conjugation pronoun → same cell as the subject they agree with.

---

## Scoring

- +10 per correct placement
- No penalty for wrong attempts
- Auto-place after 3 failed attempts (0 points for that item)
- Sentence ends when `currentIndex >= manualItems.length`
- Game ends when `totalScore >= targetScore` (2000)
