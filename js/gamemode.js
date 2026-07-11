/**
 * Game Mode - Interactive German sentence placement game
 * Uses dual-controller mechanics (mobile FPS-style) for word placement
 */

// Visual design tokens for SVG presentation attributes.
// Hard-coded hex values mirror the CSS custom properties in styles.css —
// var(--x) does NOT reliably resolve inside SVG presentation attributes.
const GM_UI = {
    indigo: '#4f46e5',      // brand
    indigoSoft: '#c7d2fe',  // indigo-200
    text: '#0f172a',        // primary text
    secondary: '#64748b',   // secondary text
    muted: '#94a3b8',       // muted text
    border: '#e2e8f0',      // borders
    surface: '#f8fafc',     // light bg
    surfaceAlt: '#f1f5f9',  // muted pill bg
    white: '#ffffff',
    success: '#10b981',
    danger: '#ef4444',
    amber: '#f59e0b'
};

// Confetti palette (design palette + grammar-semantic accents)
const GM_CONFETTI_COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#e91e63', '#3498db', '#8e44ad'];

class GameMode {
    constructor(svg, wordManager, gridViewModel) {
        this.svg = svg;
        this.wordManager = wordManager;
        this.gridViewModel = gridViewModel;

        // Game state
        this.isActive = false;
        this.isPaused = false; // True when temporarily switched to felder view
        this.totalScore = 0; // Total score across all sentences
        this.currentSentenceScore = 0; // Score for current sentence only
        this.targetScore = 2000; // Goal to reach
        this.currentWordIndex = 0;
        this.words = [];
        this.parsedSentence = null;
        this.placedBoxes = [];
        this.placedWords = new Map(); // Track which boxes/words have been placed
        this.autoPlacedWords = [];

        // Time challenge mode
        this.timeChallengeMode = false;
        this.wordStartTime = null;
        this.timeAnimationId = null;

        // Multiple categories mode
        this.multiCategoryMode = false;
        this.selectedLevels = ['A1', 'A2', 'B1'];
        this.batchSentencesPlayed = 0;
        this.batchCurrentCategory = null; // { level, category }

        // Story mode: advance sequentially through the current category
        this.storyMode = false;

        // Pre-calculated gridview state
        this.preCalculatedBoxes = [];
        this.preCalculatedConnections = [];
        this.preCalculatedLeadingWords = [];
        this.preCalculatedTrailingWords = [];
        this.revealedBoxIndices = new Set();
        this.feedbackAnimation = null;

        // Auto-placed words display
        this.accumulatedAutoWords = []; // DEPRECATED: Now calculated dynamically via getVisibleAutoWords()
        this.currentWordDisplay = null; // Current word being placed (center)

        // SVG groups for drawing
        this.gameGroup = null;
        this.gridGroup = null;
        this.controllersGroup = null;
        this.overlayGroup = null;

        // Auto-placed words display
        this.currentAutoPlacedText = null;

        // Controller state (tap-based)
        this.selectedCase = null; // 'nom', 'akk', or 'dat' - selected when user taps case button

        // Keyboard tile cursor: { row, col } selected via arrow keys, placed with W
        this.keyboardSelectedCell = null;

        // Attempt tracking (auto-place after 3 wrong attempts)
        this.currentWordAttempts = 0;

        // Waiting for user to continue to next sentence
        this.waitingForContinue = false;

        // First tap shows felder view; second tap loads next sentence
        this.pendingFelderReview = false;

        // Track sentences played this session to avoid repeats
        this.usedSentenceIds = new Set();

        // Keyboard event handler (bound for proper removal)
        this.keyboardHandler = null;

        // --- Visual-only "juice" state (display layer; never affects game logic) ---
        this.displayStreak = 0;        // consecutive correct placements (display only)
        this.suppressStreak = false;   // set before auto-place so streak isn't credited
        this.scoreAnim = null;         // { from, to, start } score count-up animation
        this.wrongShakeUntil = 0;      // timestamp until which the word pill shakes
        this.lastReveal = null;        // { boxIndex, time } for placed-box pop-in
        this.feedbackLoopId = null;    // rAF id for feedback animation loop
        this.scoreLoopId = null;       // rAF id for score count-up loop

        // Grid positions (from gridview)
        this.positions = {
            'ich': { row: 2, col: 2, label: 'ICH' },
            'du': { row: 1, col: 2, label: 'DU' },
            'wir': { row: 3, col: 2, label: 'WIR' },
            'ihr': { row: 3, col: 1, label: 'IHR' },
            'masculine': { row: 1, col: 1, label: 'MASCULINE' },
            'feminine': { row: 1, col: 3, label: 'FEMININE' },
            'neutral': { row: 2, col: 1, label: 'NEUTRAL' },
            'plural': { row: 2, col: 3, label: 'PLURAL' }
        };

        // Direction mapping (9-directional)
        this.directionMap = {
            'center': { row: 2, col: 2, label: 'ich', angle: null },
            'north': { row: 1, col: 2, label: 'du', angle: 90 },
            'northeast': { row: 1, col: 3, label: 'feminine', angle: 45 },
            'east': { row: 2, col: 3, label: 'plural', angle: 0 },
            'southeast': { row: 3, col: 3, label: 'unused', angle: 315 },
            'south': { row: 3, col: 2, label: 'wir', angle: 270 },
            'southwest': { row: 3, col: 1, label: 'ihr', angle: 225 },
            'west': { row: 2, col: 1, label: 'neutral', angle: 180 },
            'northwest': { row: 1, col: 1, label: 'masculine', angle: 135 }
        };
    }

    /**
     * Get grid starting Y position
     */
    getGridStartY() {
        const isMobile = window.innerWidth <= 768;
        // Leaves a dedicated band above the grid for the (compact) word bar
        // so pills never overlap the tiles
        return isMobile ? 160 : 64;
    }

    getGridStartX() {
        const isMobile = window.innerWidth <= 768;
        // Extra left margin on desktop so word pills / grid don't sit flush
        // against the canvas edge next to the sentence panel
        return isMobile ? 50 : 90;
    }

    /**
     * Start the game mode
     */
    start() {
        if (this.isActive) return;

        this.isActive = true;
        this.isPaused = false;

        // Add keyboard event listener for case selection and tile cursor (PC only)
        this.keyboardHandler = (e) => {
            if (!this.isActive) return;

            // Don't hijack keys while the user types in a form field
            const tag = e.target.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.target.isContentEditable) return;

            const key = e.key.toLowerCase();

            // Arrow keys move the tile cursor; "/" places the current word there
            // (right-hand friendly on a US layout, next to the arrow cluster).
            // Inactive while waiting to continue ("/" advances there — see app.js).
            if (!this.waitingForContinue) {
                const arrowDeltas = {
                    'arrowup': [-1, 0], 'arrowdown': [1, 0],
                    'arrowleft': [0, -1], 'arrowright': [0, 1]
                };
                if (arrowDeltas[key]) {
                    e.preventDefault(); // keep the page from scrolling
                    if (!this.keyboardSelectedCell) {
                        this.keyboardSelectedCell = { row: 2, col: 2 }; // start at center (ICH)
                    } else {
                        const [dr, dc] = arrowDeltas[key];
                        this.keyboardSelectedCell = {
                            row: Math.min(3, Math.max(1, this.keyboardSelectedCell.row + dr)),
                            col: Math.min(3, Math.max(1, this.keyboardSelectedCell.col + dc))
                        };
                    }
                    if (window.app) window.app.redrawAll();
                    return;
                }
                if (key === '/' && this.keyboardSelectedCell) {
                    e.preventDefault(); // also blocks Firefox quick-find
                    this.handleCellTap(this.keyboardSelectedCell.row, this.keyboardSelectedCell.col);
                    return;
                }
            }

            // A = Nominative, S = Accusative, D = Dative, F = Genitive
            if (key === 'a') {
                // Toggle nominative
                this.selectedCase = this.selectedCase === 'nom' ? null : 'nom';
                if (window.app) window.app.redrawAll();
            } else if (key === 's') {
                // Toggle accusative
                this.selectedCase = this.selectedCase === 'akk' ? null : 'akk';
                if (window.app) window.app.redrawAll();
            } else if (key === 'd') {
                // Toggle dative
                this.selectedCase = this.selectedCase === 'dat' ? null : 'dat';
                if (window.app) window.app.redrawAll();
            } else if (key === 'f') {
                // Toggle genitive
                this.selectedCase = this.selectedCase === 'gen' ? null : 'gen';
                if (window.app) window.app.redrawAll();
            }
        };

        document.addEventListener('keydown', this.keyboardHandler);

        // Detect TTS word-boundary support (silent, inside this user gesture)
        // before the first fill-in-the-blank prompt needs it
        if (typeof gameSounds !== 'undefined') gameSounds.probeBoundary();

        this.startNewSentence();

        // Record the initial sentence as used
        if (window.app && window.app.sentenceManager) {
            this.usedSentenceIds.add(window.app.sentenceManager.currentSentenceId);
        }
    }

    /**
     * Start a new sentence within the game session
     */
    startNewSentence() {
        this.stopTimerAnimation();
        this.wordStartTime = null;
        this.currentSentenceScore = 0;
        this.currentIndex = 0;
        this.manualItems = [];
        this.wordToManualItem = new Map();
        this.feedbackAnimation = null;
        this.currentWordDisplay = null;
        this.currentWordAttempts = 0;
        this.waitingForContinue = false;
        this.pendingFelderReview = false;

        // Reset visual-only state (streak intentionally persists across sentences)
        this.wrongShakeUntil = 0;
        this.lastReveal = null;
        this.suppressStreak = false;
        this.completeCardPopped = false; // pop animation plays once per sentence

        this.parseSentence();
        this.buildManualItems();
        this.preCalculateGridView();
        this.updateCurrentWordDisplay();

        // Nothing to place (e.g. imperative sentence) — go straight to tap-to-continue
        if (this.manualItems.length === 0) {
            this.waitingForContinue = true;
        }
    }

    /**
     * Pause the game (e.g. when switching to felder view for corrections).
     * Preserves all state including score.
     */
    pause() {
        if (!this.isActive || this.isPaused) return;
        this.isPaused = true;
        this.stopTimerAnimation();
        if (this.keyboardHandler) {
            document.removeEventListener('keydown', this.keyboardHandler);
        }
    }

    /**
     * Resume a paused game, restoring keyboard/timer state.
     */
    resume() {
        if (!this.isActive || !this.isPaused) return;
        this.isPaused = false;
        if (this.keyboardHandler) {
            document.addEventListener('keydown', this.keyboardHandler);
        }
        if (this.timeChallengeMode && this.wordStartTime !== null) {
            this.startTimerAnimation();
        }
    }

    /**
     * Stop the game mode and reset score for next session.
     */
    stop() {
        if (!this.isActive) return;

        this.isActive = false;
        this.isPaused = false;
        this.pendingFelderReview = false;
        // Drop any paused/in-flight fill-in-the-blank audio
        if (typeof gameSounds !== 'undefined') gameSounds.cancelPrompt();
        this.totalScore = 0; // Reset score so the next start() is fresh
        this.usedSentenceIds = new Set();
        this.stopTimerAnimation();
        this.wordStartTime = null;
        this.batchSentencesPlayed = 0;
        this.batchCurrentCategory = null;

        // Remove keyboard event listener
        if (this.keyboardHandler) {
            document.removeEventListener('keydown', this.keyboardHandler);
            this.keyboardHandler = null;
        }

        this.manualItems = [];
        this.wordToManualItem = new Map();
        this.feedbackAnimation = null;
        this.preCalculatedBoxes = [];
        this.preCalculatedConnections = [];
        this.preCalculatedLeadingWords = [];
        this.preCalculatedTrailingWords = [];
        this.revealedBoxIndices = new Set();
        this.currentWordDisplay = null;
        this.keyboardSelectedCell = null;

        // Reset visual-only state
        this.displayStreak = 0;
        this.suppressStreak = false;
        this.scoreAnim = null;
        this.wrongShakeUntil = 0;
        this.lastReveal = null;
    }

    /**
     * Draw the game view (called by app's redrawAll)
     */
    draw() {
        if (!this.isActive) return;

        // Clear SVG
        this.svg.innerHTML = '';

        // Create main game group
        this.gameGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        this.gameGroup.setAttribute('class', 'game-mode-group');
        this.svg.appendChild(this.gameGroup);

        // Shared visual defs (soft drop shadow) — recreated after each clear
        this.ensureJuiceDefs();

        // Draw empty grid
        this.drawEmptyGrid();

        // Draw revealed boxes/words (using pre-calculated gridview positions)
        this.drawPlacedItems();

        // Draw tick/cross feedback animation (if active)
        this.drawFeedbackAnimation();

        // Draw controllers (now positioned below grid)
        this.drawControllers();

        // Draw UI overlays (score, current word, etc.)
        this.drawUIOverlay();

        // Draw full-screen tap overlay when waiting for continue
        if (this.waitingForContinue) {
            this.drawContinueOverlay();
        }
    }

    /**
     * Parse current sentence into boxes and connections
     */
    parseSentence() {
        const words = this.wordManager.getAllWords();

        if (words.length === 0) {
            console.warn('No words to parse for game mode');
            return;
        }

        // Reuse gridview's parseSentenceFlow method
        this.parsedSentence = this.gridViewModel.parseSentenceFlow(words);
        this.words = words;

        console.log('Game Mode: Parsed sentence', this.parsedSentence);
    }

    /**
     * Pre-calculate the complete gridview layout (positions for all boxes)
     * This reuses gridview's positioning logic including vertical stacking
     */
    preCalculateGridView() {
        const { boxes, connections, leadingWords, trailingWords } = this.parsedSentence;
        const startX = this.getGridStartX();
        const startY = this.getGridStartY();

        // First pass: Count how many boxes go in each cell (same as gridview)
        const cellOccupancy = {};
        const boxCellAssignments = [];

        boxes.forEach((box, index) => {
            const position = this.gridViewModel.getWordPosition(box.mainWord);
            if (position) {
                const cellKey = `${position.row}-${position.col}`;
                if (!cellOccupancy[cellKey]) {
                    cellOccupancy[cellKey] = 0;
                }
                boxCellAssignments.push({ box, position, cellKey, indexInCell: cellOccupancy[cellKey], boxIndex: index });
                cellOccupancy[cellKey]++;
            }
        });

        // Second pass: Calculate exact positions with vertical stacking
        this.preCalculatedBoxes = [];
        boxCellAssignments.forEach(({ box, position, cellKey, indexInCell, boxIndex }) => {
            const cellX = startX + (position.col - 1) * this.gridViewModel.cellWidth;
            const cellY = startY + (position.row - 1) * this.gridViewModel.cellHeight;

            // Calculate dynamic spacing (same logic as gridview)
            const totalBoxesInCell = cellOccupancy[cellKey];
            const boxHeight = this.gridViewModel.currentConfig.boxHeight;
            const cellPadding = this.gridViewModel.currentConfig.cellPadding;
            const availableHeight = this.gridViewModel.cellHeight - cellPadding - (totalBoxesInCell * boxHeight);

            let boxSpacing = this.gridViewModel.currentConfig.spacing.two;
            if (totalBoxesInCell === 2) {
                boxSpacing = this.gridViewModel.currentConfig.spacing.two;
            } else if (totalBoxesInCell === 3) {
                boxSpacing = this.gridViewModel.currentConfig.spacing.three;
            } else if (totalBoxesInCell > 3) {
                const maxPossibleSpacing = availableHeight / (totalBoxesInCell - 1);
                boxSpacing = Math.max(this.gridViewModel.currentConfig.spacing.min, maxPossibleSpacing);
            }

            const centerX = cellX + this.gridViewModel.cellWidth / 2;
            const centerY = cellY + this.gridViewModel.cellHeight / 2 + (indexInCell * boxSpacing) - ((totalBoxesInCell - 1) * boxSpacing / 2);

            this.preCalculatedBoxes.push({
                box: box,
                centerX: centerX,
                centerY: centerY,
                boxIndex: boxIndex,
                position: position
            });
        });

        // Store connections and leading/trailing words for later use
        this.preCalculatedConnections = connections;
        this.preCalculatedLeadingWords = leadingWords;
        this.preCalculatedTrailingWords = trailingWords;

        // Track which items are revealed (starts empty)
        this.revealedBoxIndices = new Set();

        console.log('Pre-calculated gridview:', this.preCalculatedBoxes);
    }

    /**
     * Build game sequence from parsed sentence
     * IMPORTANT: Preserves original sentence word order
     * Boxes are single units, and some words auto-place
     */
    buildManualItems() {
        const { boxes } = this.parsedSentence;
        this.manualItems = [];
        this.wordToManualItem = new Map();

        const coveredWords = new Set();
        const coveredBoxIndices = new Set();

        for (const word of this.words) {
            if (coveredWords.has(word)) continue;

            // Is this the first word of an unprocessed box?
            const boxIndex = boxes.findIndex((box, i) =>
                !coveredBoxIndices.has(i) && box.words[0] === word
            );

            if (boxIndex >= 0) {
                const box = boxes[boxIndex];
                const item = { type: 'box', item: box, boxIndex };
                this.manualItems.push(item);
                box.words.forEach(w => { this.wordToManualItem.set(w, item); coveredWords.add(w); });
                coveredBoxIndices.add(boxIndex);
            } else if (this.isManualWord(word)) {
                const item = { type: 'word', item: word };
                this.manualItems.push(item);
                this.wordToManualItem.set(word, item);
                coveredWords.add(word);
            }
        }

        console.log('Manual items (sentence order):', this.manualItems);
    }

    /**
     * Check if word requires manual placement
     * Manual: subjects, objects, verbs, and modals (these have grid positions)
     * Auto: prepositions, conjunctions, infinitives, adjectives, adverbs, articles
     *
     * Note: Verbs and modals are now manual-place objects - their target tile is based on conjugation
     */
    isManualWord(word) {
        const type = word.type;

        // Manual placement types (only these require user interaction)
        if (type === 'subject') return true;
        if (type.includes('object')) return true;
        if (type === 'verb') return word.conjugation && word.conjugation.pronoun !== 'none';
        if (type === 'modal') return word.conjugation && word.conjugation.pronoun !== 'none';

        // Everything else is auto-placed
        // This includes: prepositions, conjunctions, adjectives, adverbs, articles, etc.
        return false;
    }

    /**
     * Filter words to only show those that should be visible:
     * - Auto-placed words are always visible
     * - Manual words are only visible if they've been placed (currentIndex passed them in manualItems)
     */
    filterVisibleWords(words) {
        return words.filter(word => {
            if (!this.isManualWord(word)) return true;
            const item = this.wordToManualItem.get(word);
            if (!item) return false;
            return this.manualItems.indexOf(item) < this.currentIndex;
        });
    }

    /**
     * Create arrowhead marker for arrows
     */
    createArrowMarker(group) {
        const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
        const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
        marker.setAttribute('id', 'arrowhead');
        marker.setAttribute('markerWidth', '7');
        marker.setAttribute('markerHeight', '7');
        marker.setAttribute('refX', '6.5');
        marker.setAttribute('refY', '3.5');
        marker.setAttribute('orient', 'auto');

        const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        polygon.setAttribute('points', '0 0, 7 3.5, 0 7');
        polygon.setAttribute('fill', '#2c3e50');

        marker.appendChild(polygon);
        defs.appendChild(marker);
        group.appendChild(defs);
    }

    /**
     * Draw empty grid (3x3) with cell labels
     */
    drawEmptyGrid() {
        const gridGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        gridGroup.setAttribute('class', 'game-grid-group');
        this.gameGroup.appendChild(gridGroup);

        // Create arrowhead marker
        this.createArrowMarker(gridGroup);

        const cellWidth = this.gridViewModel.cellWidth;
        const cellHeight = this.gridViewModel.cellHeight;

        // Adjust grid position for portrait mode to avoid overlap with word buttons
        const startX = this.getGridStartX();
        const startY = this.getGridStartY();

        const cellData = [
            // Row 1
            { row: 1, col: 1, label: 'MASCULINE', color: '#3498db' },
            { row: 1, col: 2, label: 'DU', color: '#e67e22' },
            { row: 1, col: 3, label: 'FEMININE', color: '#e91e63' },
            // Row 2
            { row: 2, col: 1, label: 'NEUTRAL', color: '#8e44ad' },
            { row: 2, col: 2, label: 'ICH', color: '#27ae60' },
            { row: 2, col: 3, label: 'PLURAL', color: '#c0392b' },
            // Row 3
            { row: 3, col: 1, label: 'IHR', color: '#f39c12' },
            { row: 3, col: 2, label: 'WIR', color: '#2c3e50' },
            // Imperative verbs (no subject) place here — matches the
            // IMPERATIV cell in gridview.js positions
            { row: 3, col: 3, label: 'IMPERATIV', color: '#7f8c8d' }
        ];

        cellData.forEach(cell => {
            const x = startX + (cell.col - 1) * cellWidth;
            const y = startY + (cell.row - 1) * cellHeight;
            const isEmpty = !cell.label;

            // Draw cell background: soft grammar-color tint with a saturated 2px border
            // (colors are grammar-semantic and must stay recognizable)
            const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            rect.setAttribute('x', x + 3);
            rect.setAttribute('y', y + 3);
            rect.setAttribute('width', cellWidth - 6);
            rect.setAttribute('height', cellHeight - 6);
            rect.setAttribute('rx', '12');
            rect.setAttribute('fill', isEmpty ? GM_UI.surface : cell.color);
            rect.setAttribute('fill-opacity', isEmpty ? '0.7' : '0.15');
            rect.setAttribute('stroke', isEmpty ? GM_UI.border : cell.color);
            rect.setAttribute('stroke-width', '2');
            rect.setAttribute('stroke-opacity', isEmpty ? '1' : '0.75');
            rect.setAttribute('pointer-events', 'none');
            gridGroup.appendChild(rect);

            // Add cell label (in the cell's saturated color)
            if (cell.label) {
                const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                label.setAttribute('x', x + cellWidth / 2);
                label.setAttribute('y', y + cellHeight / 2);
                label.setAttribute('text-anchor', 'middle');
                label.setAttribute('dominant-baseline', 'middle');
                label.setAttribute('fill', cell.color);
                label.setAttribute('font-size', '18');
                label.setAttribute('font-weight', 'bold');
                label.setAttribute('font-family', "'Inter', sans-serif");
                label.setAttribute('letter-spacing', '1');
                label.setAttribute('opacity', '0.65');
                label.setAttribute('pointer-events', 'none');
                label.textContent = cell.label;
                gridGroup.appendChild(label);
            }

            // Add clickable overlay for cell interaction
            // (hover/press highlight handled via CSS class .gm-cell-hit;
            //  geometry unchanged from original so tap targets stay identical)
            const clickArea = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            clickArea.setAttribute('x', x);
            clickArea.setAttribute('y', y);
            clickArea.setAttribute('width', cellWidth);
            clickArea.setAttribute('height', cellHeight);
            clickArea.setAttribute('fill', 'transparent');
            clickArea.setAttribute('cursor', 'pointer');
            const isKbdSelected = this.keyboardSelectedCell &&
                this.keyboardSelectedCell.row === cell.row &&
                this.keyboardSelectedCell.col === cell.col;
            clickArea.setAttribute('class', isKbdSelected ? 'gm-cell-hit gm-cell-kbd' : 'gm-cell-hit');
            clickArea.style.setProperty('--gm-cell-color', isEmpty ? GM_UI.muted : cell.color);
            clickArea.setAttribute('data-row', cell.row);
            clickArea.setAttribute('data-col', cell.col);

            // Add click/tap handler
            const handleCellClick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.handleCellTap(cell.row, cell.col);
            };

            clickArea.addEventListener('click', handleCellClick);
            clickArea.addEventListener('touchend', handleCellClick);

            gridGroup.appendChild(clickArea);
        });

        this.gridGroup = gridGroup;
    }

    /**
     * Draw revealed boxes and words (uses pre-calculated gridview positions)
     */
    drawPlacedItems() {
        if (!this.preCalculatedBoxes) return;

        const startX = this.getGridStartX();

        // Draw only revealed boxes using pre-calculated positions
        const revealedBoxes = this.preCalculatedBoxes.filter(item =>
            this.revealedBoxIndices.has(item.boxIndex)
        );

        // Wrap placed boxes in one shadowed group (single shared gm-shadow filter
        // application per redraw — cheap; redraws are event-driven, not per-frame).
        // Nunito 700 for the German text comes from the .gm-placed CSS rule.
        const placedGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        placedGroup.setAttribute('class', 'gm-placed');
        placedGroup.setAttribute('filter', 'url(#gm-shadow)');
        this.gridGroup.appendChild(placedGroup);

        revealedBoxes.forEach(item => {
            // Per-box wrapper so the just-placed box can get a scale "pop"
            const boxGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            if (this.lastReveal &&
                this.lastReveal.boxIndex === item.boxIndex &&
                Date.now() - this.lastReveal.time < 600) {
                boxGroup.setAttribute('class', 'gm-pop');
            }
            placedGroup.appendChild(boxGroup);
            // Draw the box using gridview's method with pre-calculated position
            this.gridViewModel.drawPhraseBox(boxGroup, item.box, item.centerX, item.centerY);
        });

        // Draw arrows between revealed boxes
        for (let i = 0; i < revealedBoxes.length - 1; i++) {
            const fromBox = revealedBoxes[i];
            const toBox = revealedBoxes[i + 1];
            const connectionWords = this.preCalculatedConnections[fromBox.boxIndex] || [];

            // Filter connection words: only show auto-placed words and manual words that have been placed
            const visibleConnectionWords = this.filterVisibleWords(connectionWords);

            this.gridViewModel.drawArrow(this.gridGroup, fromBox, toBox, visibleConnectionWords, this.wordManager);
        }

        // Draw incoming arrow if first box is revealed and there are leading words
        if (this.revealedBoxIndices.has(0) && this.preCalculatedLeadingWords.length > 0) {
            // Filter leading words: only show auto-placed words and manual words that have been placed
            const visibleLeadingWords = this.filterVisibleWords(this.preCalculatedLeadingWords);
            const firstBox = this.preCalculatedBoxes[0];
            this.gridViewModel.drawIncomingArrow(this.gridGroup, firstBox, visibleLeadingWords, startX, this.wordManager);
        }

        // Draw outgoing arrow if last box is revealed
        const lastBoxIndex = this.preCalculatedBoxes.length - 1;
        if (this.revealedBoxIndices.has(lastBoxIndex)) {
            const lastBox = this.preCalculatedBoxes[lastBoxIndex];

            // Check for final connection
            if (this.preCalculatedConnections.length === this.preCalculatedBoxes.length) {
                const finalConnection = this.preCalculatedConnections[this.preCalculatedConnections.length - 1];
                if (finalConnection && finalConnection.length > 0) {
                    // Filter final connection words: only show auto-placed words and manual words that have been placed
                    const visibleFinalConnection = this.filterVisibleWords(finalConnection);
                    if (visibleFinalConnection.length > 0) {
                        this.gridViewModel.drawOutgoingArrow(this.gridGroup, lastBox, visibleFinalConnection, startX, this.wordManager);
                    }
                }
            }

            // Check for trailing words
            if (this.preCalculatedTrailingWords.length > 0) {
                // Filter trailing words: only show auto-placed words and manual words that have been placed
                const visibleTrailingWords = this.filterVisibleWords(this.preCalculatedTrailingWords);
                if (visibleTrailingWords.length > 0) {
                    this.gridViewModel.drawOutgoingArrow(this.gridGroup, lastBox, visibleTrailingWords, startX, this.wordManager);
                }
            }
        }
    }


    /**
     * Create the shaped container for the center word in the top bar.
     * Default (no case): dashed outline, transparent fill.
     * Selected case mirrors the gridview case-box shapes.
     */
    createTopBarWordShape(caseType, centerX, topY, width, height) {
        const x = centerX - width / 2;
        let shape;

        // Restyled: prominent white pill with soft shadow. Geometry per case is
        // unchanged (shape still encodes the selected case); border switches from
        // subtle dashed indigo (no case) to saturated indigo (case selected).
        if (!caseType) {
            shape = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            shape.setAttribute('x', x);
            shape.setAttribute('y', topY);
            shape.setAttribute('width', width);
            shape.setAttribute('height', height);
            shape.setAttribute('rx', '14');
            shape.setAttribute('fill', 'url(#gm-pill-grad)');
            shape.setAttribute('stroke', GM_UI.indigoSoft);
            shape.setAttribute('stroke-width', '2');
            shape.setAttribute('stroke-dasharray', '8,5');
        } else if (caseType === 'nom') {
            shape = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            shape.setAttribute('x', x);
            shape.setAttribute('y', topY);
            shape.setAttribute('width', width);
            shape.setAttribute('height', height);
            shape.setAttribute('rx', '20');
            shape.setAttribute('ry', '20');
            shape.setAttribute('fill', 'url(#gm-pill-grad)');
            shape.setAttribute('stroke', GM_UI.indigo);
            shape.setAttribute('stroke-width', '3');
        } else if (caseType === 'akk') {
            shape = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            shape.setAttribute('x', x);
            shape.setAttribute('y', topY);
            shape.setAttribute('width', width);
            shape.setAttribute('height', height);
            shape.setAttribute('rx', '5');
            shape.setAttribute('ry', '5');
            shape.setAttribute('fill', 'url(#gm-pill-grad)');
            shape.setAttribute('stroke', GM_UI.indigo);
            shape.setAttribute('stroke-width', '3');
        } else if (caseType === 'dat') {
            shape = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
            const slope = 15;
            const points = `${x + slope},${topY} ${x + width - slope},${topY} ${x + width},${topY + height} ${x},${topY + height}`;
            shape.setAttribute('points', points);
            shape.setAttribute('fill', 'url(#gm-pill-grad)');
            shape.setAttribute('stroke', GM_UI.indigo);
            shape.setAttribute('stroke-width', '3');
        } else if (caseType === 'gen') {
            shape = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
            const slant = 10;
            const points = `${x + slant},${topY} ${x + width + slant},${topY} ${x + width - slant},${topY + height} ${x - slant},${topY + height}`;
            shape.setAttribute('points', points);
            shape.setAttribute('fill', 'url(#gm-pill-grad)');
            shape.setAttribute('stroke', GM_UI.indigo);
            shape.setAttribute('stroke-width', '3');
        }

        if (shape) shape.setAttribute('filter', 'url(#gm-shadow)');
        return shape;
    }

    /**
     * Estimate display width for a text string at the given font size (px).
     * Uses ~0.62 em per character as a generous average for bold/normal Latin text.
     */
    estimateTextWidth(text, fontSize, padding = 40) {
        return Math.max(text.length * (fontSize * 0.62) + padding, padding + 60);
    }

    /**
     * Draw UI overlay (score, accumulated auto-words on left, current word in center)
     */
    drawUIOverlay() {
        const overlayGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        overlayGroup.setAttribute('class', 'game-ui-overlay');
        this.gameGroup.appendChild(overlayGroup);

        // Position word bar just above the grid. Compact on desktop; much
        // larger on mobile, where the viewBox down-scaling shrinks everything
        const isMobile = window.innerWidth <= 768;
        const barHeight = isMobile ? 84 : 48;
        const gridStartY = this.getGridStartY();
        const topY = Math.max(6, gridStartY - barHeight - 10); // 10px gap above grid

        // Bar geometry: pills center on the grid's horizontal center
        // (desktop grid: x 50–800 → center 425; mobile grid: x 50–1100 → 575)
        const gridStartX = this.getGridStartX();
        const cellWidth = this.gridViewModel.cellWidth;
        const gridEndX = gridStartX + (3 * cellWidth);
        const barCenterX = gridStartX + (3 * cellWidth) / 2;

        // --- Score cluster (drawn FIRST so the word pills always render on
        // top of it — on long sentences the words win the overlap) ---
        // White pill right-aligned with the grid, in the word-bar band.
        // #gm-score-text is updated in place by the score rAF loop between
        // full redraws.
        const scoreLabel = `${this.getDisplayedScore()}/${this.targetScore}`;
        const scoreFont = isMobile ? 30 : 18;
        const scoreSubFont = isMobile ? 20 : 13;
        const scorePillW = Math.max(scoreLabel.length * scoreFont * 0.67 + 28, isMobile ? 150 : 100);
        const scorePillH = isMobile ? 76 : 48;
        const scorePillX = gridEndX - scorePillW;
        const scorePillY = topY + (barHeight - scorePillH) / 2;

        const scorePill = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        scorePill.setAttribute('x', scorePillX);
        scorePill.setAttribute('y', scorePillY);
        scorePill.setAttribute('width', scorePillW);
        scorePill.setAttribute('height', scorePillH);
        scorePill.setAttribute('rx', '14');
        scorePill.setAttribute('fill', GM_UI.white);
        scorePill.setAttribute('stroke', GM_UI.indigoSoft); // indigo-200 accent
        scorePill.setAttribute('stroke-width', '2');
        scorePill.setAttribute('filter', 'url(#gm-shadow)');
        scorePill.setAttribute('pointer-events', 'none');
        overlayGroup.appendChild(scorePill);

        const scoreText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        scoreText.setAttribute('id', 'gm-score-text');
        scoreText.setAttribute('x', gridEndX - 14);
        scoreText.setAttribute('y', scorePillY + (isMobile ? 33 : 21));
        scoreText.setAttribute('text-anchor', 'end');
        scoreText.setAttribute('fill', GM_UI.indigo); // brand accent for the headline stat
        scoreText.setAttribute('font-size', scoreFont);
        scoreText.setAttribute('font-weight', 'bold');
        scoreText.setAttribute('font-family', "'Inter', sans-serif");
        scoreText.setAttribute('pointer-events', 'none');
        scoreText.textContent = scoreLabel;
        overlayGroup.appendChild(scoreText);

        // Current sentence score (below total score)
        const sentenceScoreText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        sentenceScoreText.setAttribute('x', gridEndX - 14);
        sentenceScoreText.setAttribute('y', scorePillY + (isMobile ? 62 : 40));
        sentenceScoreText.setAttribute('text-anchor', 'end');
        sentenceScoreText.setAttribute('fill', GM_UI.secondary);
        sentenceScoreText.setAttribute('font-size', scoreSubFont);
        sentenceScoreText.setAttribute('font-weight', 'normal');
        sentenceScoreText.setAttribute('font-family', "'Inter', sans-serif");
        sentenceScoreText.setAttribute('pointer-events', 'none');
        sentenceScoreText.textContent = `+${this.currentSentenceScore}`;
        overlayGroup.appendChild(sentenceScoreText);

        // Streak indicator (display only, never feeds back into scoring):
        // small 🔥×N tucked inside the score pill, on the second line next
        // to the sentence score
        if (this.displayStreak >= 2) {
            const streakText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            streakText.setAttribute('x', scorePillX + 14);
            streakText.setAttribute('y', scorePillY + (isMobile ? 62 : 40));
            streakText.setAttribute('text-anchor', 'start');
            streakText.setAttribute('fill', '#c2410c'); // amber-700
            streakText.setAttribute('font-size', scoreSubFont);
            streakText.setAttribute('font-weight', 'bold');
            streakText.setAttribute('font-family', "'Inter', sans-serif");
            streakText.setAttribute('pointer-events', 'none');
            streakText.textContent = `🔥×${this.displayStreak}`;
            overlayGroup.appendChild(streakText);
        }

        // Left-aligned word flow in sentence order: [auto words] [current
        // word] [preview], starting at the grid's left edge. Uses the full
        // bar width and keeps pills from running off-canvas on long sentences.
        let currentWordBoxLeft = gridStartX;
        let currentWordBoxWidth = 0;

        if (this.currentWordDisplay && this.currentIndex < this.manualItems.length) {
            const activeItem = this.manualItems[this.currentIndex];

            if (activeItem.type === 'box') {
                const phraseText = activeItem.item.words.map(w => w.text).join(' ');
                currentWordBoxWidth = this.estimateTextWidth(phraseText, isMobile ? 42 : 28);
            } else {
                currentWordBoxWidth = this.estimateTextWidth(activeItem.item.text, isMobile ? 42 : 28);
            }
        }

        // Get visible auto-placed words in original sentence order
        const visibleAutoWords = this.getVisibleAutoWords();

        // Draw accumulated auto-placed words first (muted pills, left to right)
        if (visibleAutoWords.length > 0) {
            const autoWordWidths = visibleAutoWords.map(word => this.estimateTextWidth(word, isMobile ? 34 : 24));

            let currentX = gridStartX;

            visibleAutoWords.forEach((wordText, index) => {
                const wordWidth = autoWordWidths[index];
                const centerX = currentX + wordWidth / 2;
                const centerY = topY + barHeight / 2;

                // Muted gray pill for each auto-placed/past word
                const bgRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                bgRect.setAttribute('x', currentX);
                bgRect.setAttribute('y', topY);
                bgRect.setAttribute('width', wordWidth);
                bgRect.setAttribute('height', barHeight);
                bgRect.setAttribute('fill', GM_UI.surfaceAlt);
                bgRect.setAttribute('stroke', GM_UI.border);
                bgRect.setAttribute('stroke-width', '1.5');
                bgRect.setAttribute('rx', '14');
                overlayGroup.appendChild(bgRect);

                const autoText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                autoText.setAttribute('x', centerX);
                autoText.setAttribute('y', centerY + (isMobile ? 12 : 8));
                autoText.setAttribute('text-anchor', 'middle');
                autoText.setAttribute('fill', GM_UI.secondary);
                autoText.setAttribute('font-size', isMobile ? 34 : 24);
                autoText.setAttribute('font-weight', '600');
                autoText.setAttribute('font-family', "'Nunito', sans-serif");
                autoText.textContent = wordText;
                overlayGroup.appendChild(autoText);

                currentX += wordWidth + 10; // Move right for next word
            });

            // Current word starts after the auto words (15px total gap)
            currentWordBoxLeft = currentX + 5;
        }

        // Draw current word (manual placement) after the auto words
        if (this.currentWordDisplay && this.currentIndex < this.manualItems.length) {
            const activeItem = this.manualItems[this.currentIndex];
            const centerX = currentWordBoxLeft + currentWordBoxWidth / 2;
            const centerY = topY + barHeight / 2;

            // Reuse the width computed before the auto-words (same font size)
            // so the pill shape, its text, and the preview offset all agree —
            // a second measurement here with a different size shifts the pill
            // off its slot and overlaps the neighbors
            const wordWidth = currentWordBoxWidth;
            const displayText = activeItem.type === 'box'
                ? activeItem.item.words.map(w => w.text).join(' ')
                : activeItem.item.text;

            // Wrapper group so a wrong placement can trigger a brief CSS shake
            // (purely visual; coordinates unchanged)
            const centerWordGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            if (Date.now() < this.wrongShakeUntil) {
                centerWordGroup.setAttribute('class', 'gm-shake');
            }
            overlayGroup.appendChild(centerWordGroup);

            // Draw center word shape — shape depends on currently selected case
            const centerShape = this.createTopBarWordShape(this.selectedCase, centerX, topY, wordWidth, barHeight);
            centerWordGroup.appendChild(centerShape);

            // Timer bar for time challenge mode
            if (this.timeChallengeMode && this.wordStartTime !== null) {
                this.drawTimerBar(overlayGroup, centerX, topY, barHeight, wordWidth);
            }

            // German word in Nunito 700 on the white pill
            const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            text.setAttribute('x', centerX);
            text.setAttribute('y', centerY + (isMobile ? 15 : 9));
            text.setAttribute('text-anchor', 'middle');
            text.setAttribute('fill', GM_UI.text);
            text.setAttribute('font-size', isMobile ? 42 : 28);
            text.setAttribute('font-weight', '700');
            text.setAttribute('font-family', "'Nunito', sans-serif");
            text.textContent = displayText;
            centerWordGroup.appendChild(text);

            // Draw next word preview (to the right, in grey).
            // Look at the word immediately after the current item in sentence order.
            // If that word is the start of a box, show the full box phrase.
            const nextWordInSentence = this.words[this.getItemWordRange(activeItem)[1] + 1];
            let nextWordText = null;
            if (nextWordInSentence) {
                const nextManual = this.wordToManualItem.get(nextWordInSentence);
                nextWordText = (nextManual && nextManual.type === 'box')
                    ? nextManual.item.words.map(w => w.text).join(' ')
                    : nextWordInSentence.text;
            }

            if (nextWordText) {
                let nextWordWidth;
                nextWordWidth = this.estimateTextWidth(nextWordText, isMobile ? 34 : 24);

                const nextWordX = currentWordBoxLeft + wordWidth + 15; // 15px gap
                const centerX = nextWordX + nextWordWidth / 2;
                const centerY = topY + barHeight / 2;

                // Faded preview pill for the upcoming word
                const boxWidth = nextWordWidth;
                const boxHeight = barHeight;
                const bgRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                bgRect.setAttribute('x', centerX - boxWidth / 2);
                bgRect.setAttribute('y', topY);
                bgRect.setAttribute('width', boxWidth);
                bgRect.setAttribute('height', boxHeight);
                bgRect.setAttribute('fill', GM_UI.white);
                bgRect.setAttribute('fill-opacity', '0.55');
                bgRect.setAttribute('stroke', GM_UI.muted);
                bgRect.setAttribute('stroke-width', '1.5');
                bgRect.setAttribute('stroke-dasharray', '7,5');
                bgRect.setAttribute('rx', '14');
                bgRect.setAttribute('opacity', '0.75');
                overlayGroup.appendChild(bgRect);

                // Text
                const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                text.setAttribute('x', centerX);
                text.setAttribute('y', centerY + (isMobile ? 12 : 8));
                text.setAttribute('text-anchor', 'middle');
                text.setAttribute('fill', GM_UI.muted);
                text.setAttribute('font-size', isMobile ? 34 : 24);
                text.setAttribute('font-weight', '600');
                text.setAttribute('font-family', "'Nunito', sans-serif");
                text.setAttribute('opacity', '0.85');
                text.textContent = nextWordText;
                overlayGroup.appendChild(text);
            }
        } else if (this.currentIndex >= this.manualItems.length && this.waitingForContinue) {
            // Sentence complete — one elegant card in the word-bar slot:
            // headline + phase-aware tap hint. Nothing else is drawn over the
            // grid, so the player can admire the completed sentence layout.
            // Gated on waitingForContinue so the card appears only once the
            // tap actually works (showGameComplete fires ~600ms after the
            // last placement; during that gap the ✓/confetti feedback plays).
            const headline = '🎉  Complete!';
            const hint = this.pendingFelderReview
                ? 'Tap to review the structure'
                : 'Tap for the next sentence';
            const headFont = isMobile ? 40 : 26;
            const hintFont = isMobile ? 20 : 14;
            const cardW = Math.max(
                this.estimateTextWidth(headline, headFont),
                this.estimateTextWidth(hint, hintFont)
            ) + 56;
            const cardH = isMobile ? 100 : 56;
            // Anchor the card just above the grid so it never covers tiles
            const cardY = Math.max(4, gridStartY - cardH - 6);

            const cardGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            // Redraws rebuild this card from scratch, which would replay the
            // pop animation — only apply it the first time per sentence
            if (!this.completeCardPopped) {
                cardGroup.setAttribute('class', 'gm-pop');
                this.completeCardPopped = true;
            }
            cardGroup.setAttribute('pointer-events', 'none');
            overlayGroup.appendChild(cardGroup);

            const cardRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            cardRect.setAttribute('x', barCenterX - cardW / 2);
            cardRect.setAttribute('y', cardY);
            cardRect.setAttribute('width', cardW);
            cardRect.setAttribute('height', cardH);
            cardRect.setAttribute('fill', '#ecfdf5'); // mirrors CSS token --success-bg
            cardRect.setAttribute('fill-opacity', '0.97');
            cardRect.setAttribute('stroke', GM_UI.success);
            cardRect.setAttribute('stroke-width', '2');
            cardRect.setAttribute('rx', '16');
            cardRect.setAttribute('filter', 'url(#gm-shadow)');
            cardGroup.appendChild(cardRect);

            const completeText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            completeText.setAttribute('x', barCenterX);
            completeText.setAttribute('y', cardY + (isMobile ? 44 : 24));
            completeText.setAttribute('text-anchor', 'middle');
            completeText.setAttribute('fill', '#059669'); // mirrors CSS token --success-600
            completeText.setAttribute('font-size', headFont);
            completeText.setAttribute('font-weight', '700');
            completeText.setAttribute('font-family', "'Nunito', sans-serif");
            completeText.textContent = headline;
            cardGroup.appendChild(completeText);

            const hintText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            hintText.setAttribute('x', barCenterX);
            hintText.setAttribute('y', cardY + (isMobile ? 82 : 45));
            hintText.setAttribute('text-anchor', 'middle');
            hintText.setAttribute('fill', GM_UI.secondary);
            hintText.setAttribute('font-size', hintFont);
            hintText.setAttribute('font-weight', '500');
            hintText.setAttribute('font-family', "'Inter', sans-serif");
            hintText.setAttribute('class', 'gm-hint-pulse');
            hintText.textContent = hint;
            cardGroup.appendChild(hintText);
        }

        this.overlayGroup = overlayGroup;
    }

    /**
     * Draw full-screen overlay for "tap to continue"
     */
    drawContinueOverlay() {
        // Create a full-screen transparent overlay that captures all taps
        const overlay = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        overlay.setAttribute('x', 0);
        overlay.setAttribute('y', 0);
        overlay.setAttribute('width', '100%');
        overlay.setAttribute('height', '100%');
        overlay.setAttribute('fill', 'transparent');
        overlay.setAttribute('cursor', 'pointer');

        // Add tap handlers
        const handleTap = (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!this.waitingForContinue) return;
            if (this.pendingFelderReview) {
                // First tap: show felder view so user can see the sentence structure
                this.pendingFelderReview = false;
                this.pause();
                if (window.app) {
                    window.app.currentView = 'felder';
                    window.app.redrawAll();
                }
            } else {
                // Second tap (after felder review): load next sentence
                this.loadRandomSentenceAndContinue();
            }
        };

        overlay.addEventListener('click', handleTap);
        overlay.addEventListener('touchend', handleTap);

        this.gameGroup.appendChild(overlay);

        // No banner here: the completion card (headline + tap hint) lives in
        // the word-bar slot (drawUIOverlay), leaving the completed grid fully
        // visible before the tap-through to the Felder review.
    }

    /**
     * Draw game controllers as SVG elements
     */
    drawControllers() {
        const controllersGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        controllersGroup.setAttribute('class', 'game-controllers-group');
        this.gameGroup.appendChild(controllersGroup);

        const isMobile = window.innerWidth <= 768;
        const controllerSize = isMobile ? 120 : 88;

        // Calculate controller Y position based on grid end (not canvas/viewBox height)
        // This ensures controllers are always below the grid regardless of zoom/pan
        const gridStartY = this.getGridStartY();
        const cellHeight = this.gridViewModel.cellHeight;
        const gridEndY = gridStartY + (3 * cellHeight); // 3 rows
        const controllerY = gridEndY + (isMobile ? 30 : 14); // padding below grid

        // Position controllers within the grid's horizontal bounds
        const gridStartX = this.getGridStartX();
        const cellWidth = this.gridViewModel.cellWidth;
        const gridEndX = gridStartX + (3 * cellWidth); // 3 columns

        // Left controllers start near the left edge of the grid
        const leftStartX = gridStartX + 10; // 10px padding from grid edge

        // Right controller ends near the right edge of the grid
        const rightX = gridEndX - controllerSize - 10; // 10px padding from grid edge

        // Right controller (subject/verb)
        this.rightController = this.drawController(controllersGroup, {
            type: 'right',
            caseType: 'nom',
            shape: 'circle',
            x: rightX,
            y: controllerY,
            size: controllerSize,
            color: 'rgba(96, 125, 139, 0.9)' // Elegant blue-grey
        });

        // Left controllers (objects - nom/acc/dat/gen)
        this.leftControllers = [];
        const leftControllerConfigs = [
            { caseType: 'nom', shape: 'circle', color: 'rgba(96, 125, 139, 0.9)', label: 'NOM' },
            { caseType: 'akk', shape: 'square', color: 'rgba(96, 125, 139, 0.9)', label: 'AKK' },
            { caseType: 'dat', shape: 'trapezoid', color: 'rgba(96, 125, 139, 0.9)', label: 'DAT' },
            { caseType: 'gen', shape: 'diamond', color: 'rgba(96, 125, 139, 0.9)', label: 'GEN' }
        ];

        const spacing = isMobile ? controllerSize + 10 : controllerSize + 20;
        leftControllerConfigs.forEach((config, index) => {
            const controller = this.drawController(controllersGroup, {
                type: 'left',
                caseType: config.caseType,
                shape: config.shape,
                label: config.label,
                x: leftStartX + (index * spacing),
                y: controllerY,
                size: controllerSize,
                color: config.color
            });
            this.leftControllers.push(controller);
        });

        // Update controller states
        this.updateControllerStates();

        this.controllersGroup = controllersGroup;
    }

    /**
     * Create a case shape indicator (circle for nom, square for akk, trapezoid for dat, diamond for gen)
     */
    createCaseShape(caseType, x, y, size) {
        let shape;

        if (caseType === 'nom') {
            // Circle for nominative
            shape = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            shape.setAttribute('cx', x);
            shape.setAttribute('cy', y);
            shape.setAttribute('r', size / 2);
        } else if (caseType === 'akk') {
            // Square for accusative
            shape = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            shape.setAttribute('x', x - size / 2);
            shape.setAttribute('y', y - size / 2);
            shape.setAttribute('width', size);
            shape.setAttribute('height', size);
            shape.setAttribute('rx', 4);
        } else if (caseType === 'dat') {
            // Trapezoid for dative
            shape = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
            const slope = size * 0.15;
            const half = size / 2;
            const points = `${x - half + slope},${y - half} ${x + half - slope},${y - half} ${x + half},${y + half} ${x - half},${y + half}`;
            shape.setAttribute('points', points);
        } else if (caseType === 'gen') {
            // Diamond (rotated square) for genitive - smaller to match height of other shapes
            shape = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            const diamondSize = size * 0.707; // Adjust for 45° rotation
            shape.setAttribute('x', x - diamondSize / 2);
            shape.setAttribute('y', y - diamondSize / 2);
            shape.setAttribute('width', diamondSize);
            shape.setAttribute('height', diamondSize);
            shape.setAttribute('transform', `rotate(45 ${x} ${y})`);
        }

        return shape;
    }

    /**
     * Draw a single controller as SVG
     */
    drawController(group, config) {
        const controllerGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        controllerGroup.setAttribute('class', `game-controller game-controller-${config.type}`);
        controllerGroup.setAttribute('data-case-type', config.caseType);
        controllerGroup.setAttribute('transform', `translate(${config.x}, ${config.y})`);
        controllerGroup.style.cursor = 'pointer';

        let shape;
        const center = config.size / 2;

        if (config.shape === 'circle') {
            shape = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            shape.setAttribute('cx', center);
            shape.setAttribute('cy', center);
            shape.setAttribute('r', center - 10);
        } else if (config.shape === 'square') {
            shape = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            shape.setAttribute('x', 10);
            shape.setAttribute('y', 10);
            shape.setAttribute('width', config.size - 20);
            shape.setAttribute('height', config.size - 20);
            shape.setAttribute('rx', 8);
        } else if (config.shape === 'trapezoid') {
            shape = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
            const slope = 15;
            const points = `${slope + 10},10 ${config.size - slope - 10},10 ${config.size - 10},${config.size - 10} 10,${config.size - 10}`;
            shape.setAttribute('points', points);
        } else if (config.shape === 'diamond') {
            // Diamond (rotated square) for genitive - smaller to match height of other shapes
            shape = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            const diamondSize = (config.size - 20) * 0.707; // Adjust for 45° rotation
            const offset = (config.size - diamondSize) / 2;
            shape.setAttribute('x', offset);
            shape.setAttribute('y', offset);
            shape.setAttribute('width', diamondSize);
            shape.setAttribute('height', diamondSize);
            shape.setAttribute('transform', `rotate(45 ${center} ${center})`);
        }

        // Button styling in the app design language: white card with slate
        // border; selected = indigo tint + saturated indigo border (matches
        // the selection language used across the app, replacing the old gold)
        const isSelected = this.selectedCase === config.caseType;
        shape.setAttribute('fill', isSelected ? '#eef2ff' : GM_UI.white);   // brand-50 tint when active
        shape.setAttribute('stroke', isSelected ? GM_UI.indigo : GM_UI.muted);
        shape.setAttribute('stroke-width', isSelected ? '5' : '3');
        shape.setAttribute('stroke-linejoin', 'round');
        shape.setAttribute('filter', 'url(#gm-shadow)');
        controllerGroup.appendChild(shape);

        // Case label inside the shape (was passed in config but never drawn)
        if (config.label) {
            const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            label.setAttribute('x', center);
            label.setAttribute('y', center + 1);
            label.setAttribute('text-anchor', 'middle');
            label.setAttribute('dominant-baseline', 'middle');
            label.setAttribute('fill', isSelected ? GM_UI.indigo : GM_UI.secondary);
            label.setAttribute('font-size', Math.round(config.size * 0.2));
            label.setAttribute('font-weight', '700');
            label.setAttribute('font-family', "'Inter', sans-serif");
            label.setAttribute('letter-spacing', '1');
            label.setAttribute('pointer-events', 'none');
            label.textContent = config.label;
            controllerGroup.appendChild(label);
        }

        // Prevent text selection
        controllerGroup.style.userSelect = 'none';
        controllerGroup.style.webkitUserSelect = 'none';
        controllerGroup.style.msUserSelect = 'none';

        // Touch event handlers
        this.setupControllerEvents(controllerGroup, config);

        group.appendChild(controllerGroup);

        return {
            element: controllerGroup,
            config: config,
            shape: shape
        };
    }

    /**
     * Setup tap/click events for controller (case selector buttons)
     */
    setupControllerEvents(element, config) {
        const handleTap = (e) => {
            e.preventDefault();
            e.stopPropagation();

            // Toggle case selection
            if (this.selectedCase === config.caseType) {
                // Deselect if already selected
                this.selectedCase = null;
            } else {
                // Select this case
                this.selectedCase = config.caseType;
                if (typeof gameSounds !== 'undefined') gameSounds.select();
            }

            // Redraw to show selection state
            if (window.app) {
                window.app.redrawAll();
            }
        };

        // Add tap/click handlers
        element.addEventListener('click', handleTap);
        element.addEventListener('touchend', handleTap);
    }

    /**
     * Handle cell tap/click
     */
    handleCellTap(row, col) {
        // If waiting for user to continue to next sentence, load next sentence on any tap
        if (this.waitingForContinue) {
            this.loadRandomSentenceAndContinue();
            return;
        }

        if (this.currentIndex >= this.manualItems.length) {
            console.log('Game complete!');
            return;
        }

        const currentItem = this.manualItems[this.currentIndex];
        const itemToValidate = currentItem.type === 'box' ? currentItem.item.mainWord : currentItem.item;

        // Determine case type
        // Subjects and verbs don't need case selection, objects require explicit case selection
        let caseType;

        if (this.selectedCase) {
            // User explicitly selected a case - use it
            caseType = this.selectedCase;
        } else if (itemToValidate.type === 'subject' || itemToValidate.type === 'verb' || itemToValidate.type === 'modal') {
            // Subjects, verbs, and modals default to nominative (no case selection required)
            caseType = 'nom';
        } else {
            // All other words (objects, etc.) require explicit case selection
            console.log('Please select a case first (NOM/AKK/DAT/GEN)');
            return;
        }

        // Place the word at this cell
        this.placeWord(row, col, caseType);

        // Reset selected case after placement
        this.selectedCase = null;

        // Redraw to clear case selection highlight
        if (window.app) {
            window.app.redrawAll();
        }
    }

    /**
     * Place current item in selected cell
     */
    placeWord(row, col, caseType) {
        if (this.currentIndex >= this.manualItems.length) {
            console.log('Game complete!');
            return;
        }

        const currentItem = this.manualItems[this.currentIndex];
        const itemToValidate = currentItem.type === 'box' ? currentItem.item.mainWord : currentItem.item;

        console.log(`Placing ${currentItem.type}: ${this.getItemText(currentItem)} at row ${row}, col ${col}, case: ${caseType}`);

        // Validate placement
        const isCorrect = this.validatePlacement(itemToValidate, row, col, caseType);

        // Get the cell position for feedback display
        const startX = this.getGridStartX();
        const startY = this.getGridStartY();
        const cellX = startX + (col - 1) * this.gridViewModel.cellWidth;
        const cellY = startY + (row - 1) * this.gridViewModel.cellHeight;
        const feedbackX = cellX + this.gridViewModel.cellWidth / 2;
        const feedbackY = cellY + this.gridViewModel.cellHeight / 2;

        if (isCorrect) {
            let points = 10;
            let feedbackSymbol = '✓';
            let feedbackColor = GM_UI.success; // mirrors CSS success token

            if (this.timeChallengeMode && this.wordStartTime !== null) {
                const elapsed = Date.now() - this.wordStartTime;
                const timeResult = this.getTimePoints(elapsed);
                points = timeResult.points;
                feedbackColor = timeResult.color;
                feedbackSymbol = `+${points}`;
            }

            this.currentSentenceScore += points;
            this.totalScore += points;
            console.log('✓ Correct placement!', points, 'points');

            // Reset attempts counter
            this.currentWordAttempts = 0;

            // --- Visual juice (display only, no effect on scoring/validation) ---
            this.displayStreak = this.suppressStreak ? 0 : this.displayStreak + 1;
            this.suppressStreak = false;
            this.scoreAnim = { from: this.totalScore - points, to: this.totalScore, start: Date.now() };
            if (currentItem.type === 'box') {
                this.lastReveal = { boxIndex: currentItem.boxIndex, time: Date.now() };
            }

            // Show feedback
            this.showFeedback(feedbackSymbol, feedbackX, feedbackY, true, feedbackColor);

            // Confetti burst + floating points + score count-up (all self-cleaning)
            // Sound: the tile's own note (pitch encodes the grid position),
            // then the GROWING SENTENCE PREFIX spoken in German — everything
            // from the sentence start through the placed word plus the
            // auto-words it reveals. Speaking a real phrase (not an isolated
            // word) lets the TTS engine apply natural sentence intonation,
            // so each placement sounds like the sentence assembling itself.
            if (typeof gameSounds !== 'undefined') {
                gameSounds.correct(this.displayStreak, row, col);
                // Confirmation speech (growing prefix) only when listening
                // mode is off — in listening mode the paused sentence audio
                // resumes instead (see updateCurrentWordDisplay), which
                // speaks the placed word with the sentence's own intonation
                if (!gameSounds.promptEnabled) {
                    const range = this.getItemWordRange(currentItem);
                    let endIdx = range[1];
                    while (endIdx + 1 < this.words.length && !this.isManualWord(this.words[endIdx + 1])) {
                        endIdx++;
                    }
                    // On long sentences start from the current clause instead
                    // of re-speaking everything from the beginning. Mid-
                    // sentence prefixes get a trailing comma so the last word
                    // keeps continuation intonation instead of a final fall.
                    const texts = this.words.map(w => w.text);
                    const from = gameSounds.promptStartIndex(texts, range[0]);
                    const isSentenceEnd = endIdx >= this.words.length - 1;
                    gameSounds.speak(texts.slice(from, endIdx + 1).join(' ') + (isSentenceEnd ? '' : ','));
                }
            }
            if (navigator.vibrate) navigator.vibrate(15); // subtle tactile confirm
            this.spawnConfetti(feedbackX, feedbackY, 8, 90);
            if (!feedbackSymbol.startsWith('+')) {
                // Timer mode already floats "+N" as the feedback symbol itself
                this.spawnFloatingText(`+${points}`, feedbackX, feedbackY - 50, feedbackColor);
            }
            this.startScoreCountLoop();

            // Reveal the corresponding box in the gridview
            if (currentItem.type === 'box') {
                this.revealedBoxIndices.add(currentItem.boxIndex);
                // Note: Auto-words are now calculated dynamically via getVisibleAutoWords()
                // No need to manage accumulatedAutoWords manually
            }

            // Move to next item
            this.currentIndex++;

            // Update current word display
            this.updateCurrentWordDisplay();

            // Check if game is complete
            if (this.currentIndex >= this.manualItems.length) {
                setTimeout(() => {
                    this.showGameComplete();
                }, 600);
            }
        } else {
            console.log('✗ Incorrect placement!');

            // Increment attempts
            this.currentWordAttempts++;

            // Visual only: reset streak display and shake the word pill
            this.displayStreak = 0;
            this.wrongShakeUntil = Date.now() + 350;
            if (typeof gameSounds !== 'undefined') gameSounds.wrong();
            if (navigator.vibrate) navigator.vibrate([30, 40, 30]); // distinct double-buzz

            // Show cross feedback (no score penalty, but don't advance)
            this.showFeedback('✗', feedbackX, feedbackY, false);

            // After 3 failed attempts, auto-place correctly
            if (this.currentWordAttempts >= 3) {
                console.log('Auto-placing after 3 attempts...');
                setTimeout(() => {
                    this.autoPlaceCurrentWord();
                }, 800);
            }
        }
    }

    /**
     * Show tick/cross feedback animation
     */
    showFeedback(symbol, x, y, isCorrect, color) {
        this.feedbackAnimation = {
            symbol: symbol,
            x: x,
            y: y,
            isCorrect: isCorrect,
            // Colors mirror CSS tokens (--success / --danger)
            color: color || (isCorrect ? '#10b981' : '#ef4444'),
            startTime: Date.now()
        };

        // Redraw to show feedback
        if (window.app) {
            window.app.redrawAll();
        }

        // Animate the feedback smoothly between redraws (updates attributes
        // in place; ends automatically when feedbackAnimation clears)
        this.startFeedbackJuiceLoop();

        // Clear feedback after animation
        setTimeout(() => {
            this.feedbackAnimation = null;
            if (window.app) {
                window.app.redrawAll();
            }
        }, 600);
    }

    /**
     * Draw feedback animation (tick/cross)
     */
    drawFeedbackAnimation() {
        if (!this.feedbackAnimation) return;

        const { symbol, x, y, color, startTime } = this.feedbackAnimation;
        const elapsed = Date.now() - startTime;
        const duration = 600;
        const progress = Math.min(elapsed / duration, 1);

        const isScorePopup = symbol.startsWith('+');
        const scale = 1 + progress * (isScorePopup ? 0.2 : 0.5);
        const opacity = 1 - progress;
        const floatY = isScorePopup ? -50 * progress : 0;

        const feedbackGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        feedbackGroup.setAttribute('class', 'feedback-animation');
        feedbackGroup.setAttribute('transform', `translate(${x}, ${y + floatY}) scale(${scale})`);
        feedbackGroup.setAttribute('opacity', opacity);
        feedbackGroup.setAttribute('pointer-events', 'none');

        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', 0);
        text.setAttribute('y', 0);
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('dominant-baseline', 'middle');
        text.setAttribute('font-size', isScorePopup ? '64' : '100');
        text.setAttribute('font-weight', 'bold');
        text.setAttribute('fill', color);
        text.setAttribute('stroke', 'white');
        text.setAttribute('stroke-width', '4');
        text.setAttribute('paint-order', 'stroke');
        text.textContent = symbol;
        feedbackGroup.appendChild(text);

        this.gameGroup.appendChild(feedbackGroup);
    }

    /* ==================================================================
     * VISUAL JUICE HELPERS (display layer only — no game-logic effects)
     * ================================================================== */

    /**
     * Ensure the shared soft drop-shadow filter exists (id 'gm-shadow').
     * Called once per draw() after the SVG is cleared. Guarded against
     * duplicates; ids are 'gm-' prefixed so we never clash with other
     * agents' defs ('tok-'/'fm-'/'gv-').
     */
    ensureJuiceDefs() {
        if (this.svg.querySelector('#gm-shadow')) return;

        const svgNS = 'http://www.w3.org/2000/svg';
        const defs = document.createElementNS(svgNS, 'defs');
        defs.setAttribute('class', 'gm-defs');

        const filter = document.createElementNS(svgNS, 'filter');
        filter.setAttribute('id', 'gm-shadow');
        filter.setAttribute('x', '-30%');
        filter.setAttribute('y', '-30%');
        filter.setAttribute('width', '160%');
        filter.setAttribute('height', '160%');

        const shadow = document.createElementNS(svgNS, 'feDropShadow');
        shadow.setAttribute('dx', '0');
        shadow.setAttribute('dy', '2');
        shadow.setAttribute('stdDeviation', '3');
        shadow.setAttribute('flood-color', '#0f172a'); // mirrors CSS text token
        shadow.setAttribute('flood-opacity', '0.18');
        filter.appendChild(shadow);

        defs.appendChild(filter);

        // Gentle vertical gradient for the current-word pill (white → indigo-50)
        const grad = document.createElementNS(svgNS, 'linearGradient');
        grad.setAttribute('id', 'gm-pill-grad');
        grad.setAttribute('x1', '0');
        grad.setAttribute('y1', '0');
        grad.setAttribute('x2', '0');
        grad.setAttribute('y2', '1');
        const stop1 = document.createElementNS(svgNS, 'stop');
        stop1.setAttribute('offset', '0%');
        stop1.setAttribute('stop-color', '#ffffff');
        const stop2 = document.createElementNS(svgNS, 'stop');
        stop2.setAttribute('offset', '100%');
        stop2.setAttribute('stop-color', '#eef2ff'); // mirrors CSS token --brand-50
        grad.appendChild(stop1);
        grad.appendChild(stop2);
        defs.appendChild(grad);

        this.gameGroup.appendChild(defs);
    }

    /**
     * Burst of small confetti particles (design palette) from (x, y).
     * Self-animating via requestAnimationFrame, self-removing after ~700ms.
     * Survives full SVG redraws by re-attaching to the SVG root.
     */
    spawnConfetti(x, y, count = 8, spread = 90) {
        const svgNS = 'http://www.w3.org/2000/svg';
        const group = document.createElementNS(svgNS, 'g');
        group.setAttribute('class', 'gm-confetti');
        group.setAttribute('pointer-events', 'none');

        const particles = [];
        for (let i = 0; i < count; i++) {
            let el;
            if (i % 2 === 0) {
                el = document.createElementNS(svgNS, 'rect');
                el.setAttribute('x', '-3.5');
                el.setAttribute('y', '-3.5');
                el.setAttribute('width', '7');
                el.setAttribute('height', '7');
                el.setAttribute('rx', '1.5');
            } else {
                el = document.createElementNS(svgNS, 'circle');
                el.setAttribute('r', '3.5');
            }
            el.setAttribute('fill', GM_CONFETTI_COLORS[i % GM_CONFETTI_COLORS.length]);
            const angle = Math.random() * Math.PI * 2;
            const speed = spread * (0.4 + Math.random() * 0.6);
            particles.push({
                el: el,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - spread * 0.5, // upward bias
                rot: 120 + Math.random() * 360
            });
            group.appendChild(el);
        }

        this.svg.appendChild(group);

        const start = performance.now();
        const duration = 700;
        const tick = (now) => {
            const t = Math.min((now - start) / duration, 1);
            if (t >= 1 || !this.isActive) {
                if (group.parentNode) group.parentNode.removeChild(group);
                return;
            }
            // draw() clears the SVG on redraws — re-attach so bursts survive
            if (!group.parentNode) this.svg.appendChild(group);
            particles.forEach(p => {
                const px = x + p.vx * t;
                const py = y + p.vy * t + spread * 1.6 * t * t; // gravity
                p.el.setAttribute('transform', `translate(${px}, ${py}) rotate(${p.rot * t})`);
            });
            group.setAttribute('opacity', t > 0.55 ? String((1 - t) / 0.45) : '1');
            requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
    }

    /**
     * Floating "+N" indicator that drifts upward and fades where the
     * placement happened. Self-removing within ~700ms.
     */
    spawnFloatingText(str, x, y, color) {
        const svgNS = 'http://www.w3.org/2000/svg';
        const text = document.createElementNS(svgNS, 'text');
        text.setAttribute('class', 'gm-float-text');
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('font-size', '26');
        text.setAttribute('font-weight', '700');
        text.setAttribute('font-family', "'Inter', sans-serif");
        text.setAttribute('fill', color || GM_UI.success);
        text.setAttribute('stroke', 'white');
        text.setAttribute('stroke-width', '4');
        text.setAttribute('paint-order', 'stroke');
        text.setAttribute('pointer-events', 'none');
        text.setAttribute('x', x);
        text.setAttribute('y', y);
        text.textContent = str;
        this.svg.appendChild(text);

        const start = performance.now();
        const duration = 700;
        const tick = (now) => {
            const t = Math.min((now - start) / duration, 1);
            if (t >= 1 || !this.isActive) {
                if (text.parentNode) text.parentNode.removeChild(text);
                return;
            }
            if (!text.parentNode) this.svg.appendChild(text);
            const ease = 1 - Math.pow(1 - t, 3);
            text.setAttribute('y', y - 44 * ease);
            text.setAttribute('opacity', t < 0.5 ? '1' : String((1 - t) / 0.5));
            requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
    }

    /**
     * Smoothly animate the ✓/✗/+N feedback element between full redraws.
     * Runs only while feedbackAnimation exists (~600ms), then stops itself.
     */
    startFeedbackJuiceLoop() {
        if (this.feedbackLoopId) return;
        const tick = () => {
            if (!this.feedbackAnimation || !this.isActive) {
                this.feedbackLoopId = null;
                return;
            }
            this.updateFeedbackElement();
            this.feedbackLoopId = requestAnimationFrame(tick);
        };
        this.feedbackLoopId = requestAnimationFrame(tick);
    }

    /**
     * Update the floating feedback element's transform/opacity in place.
     */
    updateFeedbackElement() {
        const feedbackEl = this.svg.querySelector('.feedback-animation');
        if (!feedbackEl || !this.feedbackAnimation) return;
        const elapsed = Date.now() - this.feedbackAnimation.startTime;
        const progress = Math.min(elapsed / 600, 1);
        const { x, y, symbol } = this.feedbackAnimation;
        const isScorePopup = symbol.startsWith('+');
        const scale = 1 + progress * (isScorePopup ? 0.2 : 0.5);
        const floatY = isScorePopup ? -50 * progress : 0;
        feedbackEl.setAttribute('transform', `translate(${x}, ${y + floatY}) scale(${scale})`);
        feedbackEl.setAttribute('opacity', 1 - progress);
    }

    /**
     * Score value currently shown (count-up over ~400ms toward totalScore).
     * Display only — this.totalScore is the single source of truth.
     */
    getDisplayedScore() {
        if (!this.scoreAnim) return this.totalScore;
        const t = Math.min((Date.now() - this.scoreAnim.start) / 400, 1);
        if (t >= 1) {
            this.scoreAnim = null;
            return this.totalScore;
        }
        const eased = 1 - Math.pow(1 - t, 3);
        return Math.round(this.scoreAnim.from + (this.scoreAnim.to - this.scoreAnim.from) * eased);
    }

    /**
     * Update the score text in place while the count-up animation runs.
     */
    startScoreCountLoop() {
        if (this.scoreLoopId) return;
        const tick = () => {
            if (!this.scoreAnim || !this.isActive) {
                this.scoreLoopId = null;
                const el = this.svg.querySelector('#gm-score-text');
                if (el && this.isActive) el.textContent = `${this.totalScore}/${this.targetScore}`;
                return;
            }
            const el = this.svg.querySelector('#gm-score-text');
            if (el) el.textContent = `${this.getDisplayedScore()}/${this.targetScore}`;
            this.scoreLoopId = requestAnimationFrame(tick);
        };
        this.scoreLoopId = requestAnimationFrame(tick);
    }

    /**
     * Final game-complete screen: dark scrim + white rounded card + confetti.
     * Replaces the old alert(); pure DOM overlay, removed on dismiss.
     */
    showFinalCelebration(finalScore) {
        const existing = document.getElementById('gm-complete-overlay');
        if (existing) existing.remove();

        const overlay = document.createElement('div');
        overlay.id = 'gm-complete-overlay';

        // Falling confetti pieces (CSS-animated, removed with the overlay)
        for (let i = 0; i < 18; i++) {
            const piece = document.createElement('span');
            piece.className = 'gm-dom-confetti';
            piece.style.left = `${Math.random() * 100}%`;
            piece.style.background = GM_CONFETTI_COLORS[i % GM_CONFETTI_COLORS.length];
            piece.style.animationDelay = `${(Math.random() * 0.5).toFixed(2)}s`;
            overlay.appendChild(piece);
        }

        const card = document.createElement('div');
        card.className = 'gm-complete-card';

        const emoji = document.createElement('div');
        emoji.className = 'gm-complete-emoji';
        emoji.textContent = '🎉';
        card.appendChild(emoji);

        const title = document.createElement('h2');
        title.className = 'gm-complete-title';
        title.textContent = 'Geschafft!';
        card.appendChild(title);

        const score = document.createElement('div');
        score.className = 'gm-complete-score';
        score.textContent = String(finalScore);
        card.appendChild(score);

        const sub = document.createElement('p');
        sub.className = 'gm-complete-sub';
        sub.textContent = 'points — you mastered German sentence structure!';
        card.appendChild(sub);

        const btn = document.createElement('button');
        btn.className = 'gm-complete-btn';
        btn.textContent = 'Weiter';
        btn.addEventListener('click', () => overlay.remove());
        card.appendChild(btn);

        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) overlay.remove();
        });

        overlay.appendChild(card);
        document.body.appendChild(overlay);
    }

    /**
     * Get all auto-placed words that should be visible based on current progress
     * This maintains original sentence order
     */
    // Returns the [start, end] indices into this.words for a manual item.
    getItemWordRange(item) {
        if (item.type === 'box') {
            const ws = item.item.words;
            return [this.words.indexOf(ws[0]), this.words.indexOf(ws[ws.length - 1])];
        }
        const idx = this.words.indexOf(item.item);
        return [idx, idx];
    }

    // Auto-placed words that sit in the sentence between the previously placed item
    // and the current one — shown on the left side of the word bar.
    getVisibleAutoWords() {
        if (this.currentIndex > this.manualItems.length) return [];
        const curr = this.manualItems[this.currentIndex];
        if (!curr) return [];
        const currStart = this.getItemWordRange(curr)[0];
        const result = [];
        if (this.currentIndex === 0) {
            for (let i = 0; i < currStart; i++) {
                if (!this.isManualWord(this.words[i])) result.push(this.words[i].text);
            }
        } else {
            const prev = this.manualItems[this.currentIndex - 1];
            const prevEnd = this.getItemWordRange(prev)[1];
            for (let i = prevEnd + 1; i < currStart; i++) {
                if (!this.isManualWord(this.words[i])) result.push(this.words[i].text);
            }
        }
        return result;
    }

    /**
     * Update the current word display (what the player needs to place)
     */
    updateCurrentWordDisplay() {
        if (this.currentIndex >= this.manualItems.length) {
            this.currentWordDisplay = null;
            this.stopTimerAnimation();
            this.wordStartTime = null;
            // Listening mode: sentence done — let the audio play out its tail
            if (typeof gameSounds !== 'undefined' && this.words && this.words.length > 0) {
                gameSounds.promptSentence(this.words.map(w => w.text), null);
            }
            return;
        }

        const currentItem = this.manualItems[this.currentIndex];
        this.currentWordDisplay = this.getItemText(currentItem);

        // Listening mode (audio fill-in-the-blank): play the sentence up to
        // the blank, pausing right where the current word belongs
        if (typeof gameSounds !== 'undefined' && this.words && this.words.length > 0) {
            const blankIdx = this.getItemWordRange(currentItem)[0];
            gameSounds.promptSentence(this.words.map(w => w.text), blankIdx);
        }

        // Reset attempts for new word
        this.currentWordAttempts = 0;

        if (this.timeChallengeMode) {
            this.wordStartTime = Date.now();
            this.startTimerAnimation();
        }
    }

    startTimerAnimation() {
        if (this.timeAnimationId) return;
        const animate = () => {
            if (!this.isActive || !this.timeChallengeMode || !this.wordStartTime) {
                this.timeAnimationId = null;
                return;
            }
            this.updateTimerVisuals();
            this.timeAnimationId = requestAnimationFrame(animate);
        };
        this.timeAnimationId = requestAnimationFrame(animate);
    }

    stopTimerAnimation() {
        if (this.timeAnimationId) {
            cancelAnimationFrame(this.timeAnimationId);
            this.timeAnimationId = null;
        }
    }

    updateTimerVisuals() {
        // Update timer bar fill width and color in-place (no SVG rebuild)
        const trackEl = this.svg.querySelector('#game-timer-bar-track');
        const fillEl = this.svg.querySelector('#game-timer-bar-fill');
        if (trackEl && fillEl && this.wordStartTime) {
            const elapsed = Date.now() - this.wordStartTime;
            const remaining = Math.max(0, 1 - elapsed / 10000);
            const totalWidth = parseFloat(trackEl.getAttribute('data-width') || '0');
            fillEl.setAttribute('width', Math.max(0, totalWidth * remaining));
            fillEl.setAttribute('fill', this.getTimerColor(1 - remaining));

            // Gentle pulse when under 3s remain (visual only)
            const isLow = remaining < 0.3 && remaining > 0;
            const hasPulse = fillEl.getAttribute('class') === 'gm-timer-pulse';
            if (isLow && !hasPulse) {
                fillEl.setAttribute('class', 'gm-timer-pulse');
            } else if (!isLow && hasPulse) {
                fillEl.removeAttribute('class');
            }
        }

        // Update floating feedback animation in-place
        this.updateFeedbackElement();
    }

    getTimePoints(elapsedMs) {
        const s = elapsedMs / 1000;
        if (s < 1.0) return { points: 30, color: '#27ae60' };
        if (s < 2.0) return { points: 25, color: '#52be80' };
        if (s < 3.0) return { points: 20, color: '#a9d96c' };
        if (s < 5.0) return { points: 15, color: '#f1c40f' };
        if (s < 7.0) return { points: 10, color: '#e67e22' };
        if (s < 10.0) return { points: 5,  color: '#e74c3c' };
        return { points: 0, color: '#c0392b' };
    }

    getTimerColor(t) {
        // t: 0 (fresh) → 1 (expired)
        // Shifts indigo #4f46e5 → amber #f59e0b → red #ef4444
        // (hard-coded hex mirrors CSS design tokens)
        const lerp = (a, b, u) => Math.round(a + (b - a) * u);
        if (t < 0.55) {
            const u = t / 0.55;
            return `rgb(${lerp(79, 245, u)},${lerp(70, 158, u)},${lerp(229, 11, u)})`;
        }
        const u = (t - 0.55) / 0.45;
        return `rgb(${lerp(245, 239, u)},${lerp(158, 68, u)},${lerp(11, 68, u)})`;
    }

    drawTimerBar(group, centerX, topY, barHeight, wordWidth) {
        const elapsed = this.wordStartTime ? Date.now() - this.wordStartTime : 0;
        const remaining = Math.max(0, 1 - elapsed / 10000);
        const t = 1 - remaining;

        const barX = centerX - wordWidth / 2;
        const barY = topY + barHeight + 2;
        const trackHeight = 6;

        const track = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        track.setAttribute('id', 'game-timer-bar-track');
        track.setAttribute('data-width', wordWidth);
        track.setAttribute('x', barX);
        track.setAttribute('y', barY);
        track.setAttribute('width', wordWidth);
        track.setAttribute('height', trackHeight);
        track.setAttribute('rx', '3');
        track.setAttribute('fill', GM_UI.border);
        track.setAttribute('pointer-events', 'none');
        group.appendChild(track);

        const fill = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        fill.setAttribute('id', 'game-timer-bar-fill');
        fill.setAttribute('x', barX);
        fill.setAttribute('y', barY);
        fill.setAttribute('width', Math.max(0, wordWidth * remaining));
        fill.setAttribute('height', trackHeight);
        fill.setAttribute('rx', '3');
        fill.setAttribute('fill', this.getTimerColor(t));
        if (remaining < 0.3 && remaining > 0) {
            fill.setAttribute('class', 'gm-timer-pulse');
        }
        fill.setAttribute('pointer-events', 'none');
        group.appendChild(fill);
    }

    /**
     * Get display text for a game item
     */
    getItemText(item) {
        if (item.type === 'box') {
            return item.item.words.map(w => w.text).join(' ');
        } else {
            return item.item.text;
        }
    }

    /**
     * Validate word placement
     */
    validatePlacement(word, row, col, caseType) {
        // Get expected position based on word properties
        const expectedPosition = this.gridViewModel.getWordPosition(word);

        if (!expectedPosition) return false;

        // Check if row/col match
        const positionMatch = expectedPosition.row === row && expectedPosition.col === col;

        // Check if case matches
        // - Verbs and modals: no case, so only check position
        // - Subjects: always nominative case
        // - Objects: check the specific case (accusative, dative, genitive)
        let caseMatch = true;
        if (word.type === 'verb' || word.type === 'modal') {
            // Verbs and modals have no case - skip case check
            caseMatch = true;
        } else {
            // Subjects and objects: validate case
            caseMatch = !word.case || word.case === caseType;
        }

        return positionMatch && caseMatch;
    }

    /**
     * Auto-place current word after 3 failed attempts
     */
    autoPlaceCurrentWord() {
        if (this.currentIndex >= this.manualItems.length) {
            return;
        }

        const currentItem = this.manualItems[this.currentIndex];
        const itemToValidate = currentItem.type === 'box' ? currentItem.item.mainWord : currentItem.item;

        // Get the correct position
        const expectedPosition = this.gridViewModel.getWordPosition(itemToValidate);
        if (!expectedPosition) {
            console.error('Cannot auto-place: no expected position found');
            return;
        }

        // Get the correct case
        const correctCase = itemToValidate.case || 'nom';

        // Place it correctly (this will trigger the success path)
        console.log(`Auto-placing at correct position: row ${expectedPosition.row}, col ${expectedPosition.col}, case: ${correctCase}`);
        this.suppressStreak = true; // display only: auto-placed words don't count toward streak
        this.placeWord(expectedPosition.row, expectedPosition.col, correctCase);
    }

    /**
     * Update controller enabled/disabled states
     */
    updateControllerStates() {
        // Hide right controller - subjects are placed by tapping grid directly
        if (this.rightController) {
            this.rightController.element.setAttribute('opacity', '0');
            this.rightController.element.style.pointerEvents = 'none';
        }

        // Left controllers (case selectors): always enabled
        this.leftControllers.forEach(controller => {
            controller.element.setAttribute('opacity', '1');
            controller.element.style.pointerEvents = 'all';
        });
    }

    /**
     * Show game complete message
     */
    showGameComplete() {
        console.log('🎉 Sentence Complete! Sentence Score:', this.currentSentenceScore, 'Total Score:', this.totalScore);

        // Check if player reached target score
        if (this.totalScore >= this.targetScore) {
            // Game fully complete!
            setTimeout(() => {
                if (window.app) {
                    // Exit game mode and show the completed gridview
                    const finalScore = this.totalScore;
                    window.app.currentView = 'grid';
                    this.stop();

                    // Reset button to play icon
                    const gameModeBtn = document.getElementById('game-mode-btn');
                    if (gameModeBtn) {
                        gameModeBtn.textContent = '🎮';
                        gameModeBtn.title = 'Start Game Mode';
                    }

                    window.app.redrawAll();

                    // Restyled celebration screen (replaces the old alert;
                    // same flow: game already stopped, grid view shown behind)
                    if (typeof gameSounds !== 'undefined') gameSounds.gameComplete();
                    this.showFinalCelebration(finalScore);
                }
            }, 1000);
        } else {
            this.waitingForContinue = true;
            this.pendingFelderReview = true;
            if (window.app) {
                window.app.redrawAll();
            }

            // Sentence-complete celebration: bigger confetti burst across the
            // grid, then the whole sentence read aloud (the melody resolved
            // it; the speech consolidates it)
            if (typeof gameSounds !== 'undefined') {
                gameSounds.sentenceComplete();
                if (this.words && this.words.length > 0) {
                    const sentence = this.words.map(w => w.text).join(' ');
                    // The final placement's prefix speech already covers the
                    // full sentence — only read it out here if it wasn't just
                    // spoken (e.g. the last word was auto-placed). queue:
                    // waits for in-flight speech instead of cutting it off.
                    if (gameSounds.lastSpoken !== sentence) {
                        setTimeout(() => gameSounds.speak(sentence, { queue: true }), 500);
                    }
                }
            }
            const cw = this.gridViewModel.cellWidth;
            const ch = this.gridViewModel.cellHeight;
            const gridCenterX = this.getGridStartX() + cw * 1.5;
            const gridCenterY = this.getGridStartY() + ch * 1.5;
            this.spawnConfetti(gridCenterX, gridCenterY - ch * 0.8, 26, 240);
        }
    }

    /**
     * Load a random sentence and continue the game
     */
    loadRandomSentenceAndContinue() {
        if (!window.app || !window.app.sentenceManager) {
            console.error('Cannot load random sentence - app or sentenceManager not available');
            return;
        }

        if (this.storyMode) {
            this.loadNextSentenceInOrder();
            return;
        }

        if (this.multiCategoryMode && this.selectedLevels.length > 0) {
            const hasMultiSentences = window.app.sentenceManager.getAllSentences().some(s =>
                s.source === 'library' && this.selectedLevels.includes(s.level)
            );
            if (hasMultiSentences) {
                this.loadRandomSentenceMultiCategory();
                return;
            }
        }

        const sentenceManager = window.app.sentenceManager;
        const levelSelector = window.app.levelSelector;

        // Get sentences from the currently active list only
        let availableSentences;

        if (levelSelector && levelSelector.currentLevel) {
            if (levelSelector.currentLevel === 'custom') {
                // Custom sentences: filter to user-created sentences (no source)
                availableSentences = sentenceManager.getAllSentences().filter(s => !s.source);
            } else if (levelSelector.currentCategory) {
                // Library sentences: filter by current level and category
                availableSentences = sentenceManager.getAllSentences().filter(s =>
                    s.source === 'library' &&
                    s.level === levelSelector.currentLevel &&
                    s.category === levelSelector.currentCategory
                );
            } else {
                // Level selected but no category - use all sentences as fallback
                availableSentences = sentenceManager.getAllSentences();
            }
        } else {
            // No active list - use all sentences as fallback
            availableSentences = sentenceManager.getAllSentences();
        }

        if (availableSentences.length === 0) {
            console.error('No sentences available in current list');
            return;
        }

        // Mark current sentence as used before picking the next
        this.usedSentenceIds.add(sentenceManager.currentSentenceId);

        // Pick a random sentence not yet played this session
        let unseenSentences = availableSentences.filter(s => !this.usedSentenceIds.has(s.id));

        // If all sentences have been seen, reset and allow repeats (but still avoid the just-played one)
        if (unseenSentences.length === 0) {
            this.usedSentenceIds.clear();
            this.usedSentenceIds.add(sentenceManager.currentSentenceId);
            unseenSentences = availableSentences.filter(s => !this.usedSentenceIds.has(s.id));
        }

        const pool = unseenSentences.length > 0 ? unseenSentences : availableSentences;
        const randomSentence = pool[Math.floor(Math.random() * pool.length)];

        // Load the random sentence
        sentenceManager.loadSentence(randomSentence.id);

        // Start new sentence in game mode
        this.startNewSentence();

        // Update sentence panel selection and redraw
        if (window.app) {
            window.app.updateSentenceList();
            window.app.redrawAll();

            // Scroll active sentence into view in the panel
            const activeItem = document.querySelector('.sentence-item.active');
            if (activeItem) {
                activeItem.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            }
        }

        console.log('Loaded new sentence from active list:', randomSentence.text);
    }

    /**
     * Story mode: advance to the next sentence in order within the current category.
     * Wraps back to the first sentence after the last one.
     */
    loadNextSentenceInOrder() {
        const sentenceManager = window.app.sentenceManager;
        const levelSelector = window.app.levelSelector;

        if (!levelSelector || !levelSelector.currentLevel || !levelSelector.currentCategory) {
            // No category context — fall back to random within whatever is loaded
            this.storyMode = false;
            this.loadRandomSentenceAndContinue();
            return;
        }

        const { currentLevel, currentCategory } = levelSelector;
        const categorySentences = sentenceManager.getAllSentences().filter(s =>
            s.source === 'library' &&
            s.level === currentLevel &&
            s.category === currentCategory
        );

        if (categorySentences.length === 0) return;

        const currentIdx = categorySentences.findIndex(s => s.id === sentenceManager.currentSentenceId);
        const nextIdx = (currentIdx + 1) % categorySentences.length;
        const nextSentence = categorySentences[nextIdx];

        sentenceManager.loadSentence(nextSentence.id);
        this.startNewSentence();

        if (window.app) {
            window.app.updateSentenceList();
            window.app.redrawAll();
            const activeItem = document.querySelector('.sentence-item.active');
            if (activeItem) activeItem.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }

        console.log(`Story mode: ${currentLevel}/${currentCategory} [${nextIdx + 1}/${categorySentences.length}]`);
    }

    /**
     * Load a random sentence in multi-category mode.
     * Plays 5 sentences from one category, then switches to a random new category.
     */
    loadRandomSentenceMultiCategory() {
        const sentenceManager = window.app.sentenceManager;

        this.batchSentencesPlayed++;

        const needNewCategory = !this.batchCurrentCategory || this.batchSentencesPlayed > 5;

        if (needNewCategory) {
            const allSentences = sentenceManager.getAllSentences().filter(s =>
                s.source === 'library' && this.selectedLevels.includes(s.level)
            );

            // Collect unique {level, category} pairs
            const seen = new Set();
            const categories = [];
            allSentences.forEach(s => {
                const key = `${s.level}/${s.category}`;
                if (!seen.has(key)) {
                    seen.add(key);
                    categories.push({ level: s.level, category: s.category });
                }
            });

            if (categories.length === 0) return;

            const currentKey = this.batchCurrentCategory
                ? `${this.batchCurrentCategory.level}/${this.batchCurrentCategory.category}`
                : null;
            const others = categories.filter(c => `${c.level}/${c.category}` !== currentKey);
            const pool = others.length > 0 ? others : categories;

            this.batchCurrentCategory = pool[Math.floor(Math.random() * pool.length)];
            this.batchSentencesPlayed = 1;
        }

        const { level, category } = this.batchCurrentCategory;
        const availableSentences = sentenceManager.getAllSentences().filter(s =>
            s.source === 'library' && s.level === level && s.category === category
        );

        if (availableSentences.length === 0) {
            // Category emptied, reset and retry with normal path
            this.batchCurrentCategory = null;
            this.batchSentencesPlayed = 0;
            this.loadRandomSentenceAndContinue();
            return;
        }

        this.usedSentenceIds.add(sentenceManager.currentSentenceId);

        let unseen = availableSentences.filter(s => !this.usedSentenceIds.has(s.id));
        if (unseen.length === 0) {
            // All sentences in this category used — clear just this category's history
            availableSentences.forEach(s => this.usedSentenceIds.delete(s.id));
            this.usedSentenceIds.add(sentenceManager.currentSentenceId);
            unseen = availableSentences.filter(s => !this.usedSentenceIds.has(s.id));
        }

        const randomSentence = (unseen.length > 0 ? unseen : availableSentences)[
            Math.floor(Math.random() * (unseen.length > 0 ? unseen.length : availableSentences.length))
        ];

        sentenceManager.loadSentence(randomSentence.id);
        this.startNewSentence();

        if (window.app) {
            window.app.updateSentenceList();
            window.app.redrawAll();
            const activeItem = document.querySelector('.sentence-item.active');
            if (activeItem) activeItem.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }

        console.log(`Multi-category: ${level}/${category} (${this.batchSentencesPlayed}/5)`);
    }
}
