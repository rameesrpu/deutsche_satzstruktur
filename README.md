# Deutsche Satzstruktur Visualizer

A visual tool for understanding German sentence structure using colored symbols and the Feldermodell (Field Model).

## Project Structure

```
deutsch_graphic_project/
├── index.html              # Main HTML file
├── css/
│   └── styles.css         # All application styles
├── js/
│   ├── app.js            # Main application controller
│   ├── wordManager.js    # Word data model and operations
│   ├── renderer.js       # SVG rendering for words and connections
│   ├── feldermodell.js   # Feldermodell zone rendering
│   └── ui.js             # UI interactions and properties panel
└── README.md
```

## Architecture

The application follows a modular architecture with clear separation of concerns:

- **WordManager**: Manages word data, CRUD operations, and business logic
- **Renderer**: Handles SVG drawing of words and connections
- **FeldermodellRenderer**: Renders Hauptsatz and Nebensatz field zones
- **UIController**: Manages user interactions and properties panel
- **DeutschApp**: Main controller that coordinates all components

## Features

### Color-Coded Word Types
- **Blue**: Subjekt (Subject)
- **Red**: Verb
- **Green**: Objekt (Object)
- **Pink**: Modal Verbs / Second Verb Part
- **Grey**: Andere (Other words)

### Gender Representation
- **Square**: Masculine (♂)
- **Circle**: Feminine (♀)
- **Diamond**: Neuter (⚲)

### Number Representation
- **Regular border**: Singular
- **Double border**: Plural

### Case Indicators
Small letter badges show case:
- **N**: Nominativ
- **A**: Akkusativ
- **D**: Dativ
- **G**: Genitiv

### Sentence Flow Modes
- **→ Right (Horizontal)**: Hauptsatz - flows through Feldermodell zones
- **↓ Down (Vertical)**: Nebensatz - subordinate clause with verb-final position

### Feldermodell Integration

**Hauptsatz (Horizontal zones):**
1. **Vorfeld** (Pre-field)
2. **Linke Klammer** (Left Bracket - conjugated verb)
3. **Mittelfeld** (Middle Field - main content)
4. **Rechte Klammer** (Right Bracket - verb particles, infinitives)
5. **Nachfeld** (Post-field)

**Nebensatz (Vertical zones):**
1. **Konjunktion** - Subordinating conjunction
2. **Mittelfeld** - All arguments and adjuncts
3. **Verben (Ende)** - ALL verbs at the end (verb-final)

## How to Use

1. **Open**: Simply open `index.html` in a web browser
2. **Add Words**:
   - Click word type buttons to add tokens
   - New words auto-position based on previous word's flow
3. **Edit Properties**: Click any word to edit in the right panel
   - Text, gender, case, number, flow direction
4. **Arrange**: Drag tokens to position them
5. **Flow Direction**: Set each word's flow (→ for Hauptsatz, ↓ for Nebensatz)

## Example Sentences

### Mixed Sentence (Hauptsatz + Nebensatz)
**"ich lese das Buch weil ich Zeit habe"**

1. Add words flowing **right** (→): ich → lese → das Buch
2. Add "weil", change flow to **down** (↓)
3. Continue: ich → Zeit → habe (auto-flow down)
4. Notice: Hauptsatz flows horizontally, Nebensatz drops vertically with verb at end

### Complex Sentence with Modal Verb
**"Ich kann das Buch lesen"**

1. Add: Subjekt → "Ich" (flow right)
2. Add: Modal → "kann" (flow right) - position in Linke Klammer
3. Add: Objekt → "das Buch" (flow right) - position in Mittelfeld
4. Add: Verb → "lesen" (flow right) - position in Rechte Klammer

## Code Organization

### WordManager (js/wordManager.js)
- `addWord(type)` - Add new word with auto-positioning
- `updateWordProperty(wordId, property, value)` - Update word properties
- `deleteWord(wordId)` - Remove a word
- `getNebensatzGroups()` - Find subordinate clause groups
- `save()` / `load()` - LocalStorage persistence

### Renderer (js/renderer.js)
- `drawWord(word, onWordClick, onWordDragStart)` - Draw single word token
- `drawAllWords()` - Render all words
- `drawConnections()` - Draw connection lines between words
- `createShape(word)` - Create gender-specific shapes

### FeldermodellRenderer (js/feldermodell.js)
- `drawHauptsatzZones()` - Render horizontal field zones
- `drawNebensatzZones(groups)` - Render vertical subordinate clause zones
- `drawNebensatzLabel()` - Add "NEBENSATZ" labels

### UIController (js/ui.js)
- `handleWordClick(word)` - Word selection
- `handleDragStart/Drag/DragEnd()` - Drag and drop
- `updatePropertiesPanel()` - Render properties editor
- `attachPropertyListeners()` - Wire up property controls

### DeutschApp (js/app.js)
- `init()` - Initialize application
- `setupToolbarButtons()` - Wire toolbar events
- `redrawAll()` - Coordinate full canvas redraw
- `save()` / `load()` - Persistence operations

## Future Enhancements

- [ ] Export diagrams as PNG/SVG
- [ ] Sentence template library
- [ ] Separable verb prefix handling
- [ ] Multiple sentence support on one canvas
- [ ] Undo/Redo functionality
- [ ] Keyboard shortcuts
- [ ] Share diagrams via URL

## Browser Compatibility

Works in all modern browsers:
- Chrome/Edge (recommended)
- Firefox
- Safari

## License

MIT License - Free to use and modify
