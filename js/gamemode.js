/**
 * Game Mode - Interactive German sentence placement game
 * Uses dual-controller mechanics (mobile FPS-style) for word placement
 */
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
        this.targetScore = 500; // Goal to reach
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

        // Attempt tracking (auto-place after 3 wrong attempts)
        this.currentWordAttempts = 0;

        // Waiting for user to continue to next sentence
        this.waitingForContinue = false;

        // Track sentences played this session to avoid repeats
        this.usedSentenceIds = new Set();

        // Keyboard event handler (bound for proper removal)
        this.keyboardHandler = null;

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
        return isMobile ? 160 : 50;
    }

    /**
     * Start the game mode
     */
    start() {
        if (this.isActive) return;

        this.isActive = true;
        this.isPaused = false;

        // Add keyboard event listener for case selection (PC only)
        this.keyboardHandler = (e) => {
            if (!this.isActive) return;

            const key = e.key.toLowerCase();

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
        const startX = 50;
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
        const startX = 50;
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
            { row: 3, col: 3, label: '', color: '#f5f5f5' }
        ];

        cellData.forEach(cell => {
            const x = startX + (cell.col - 1) * cellWidth;
            const y = startY + (cell.row - 1) * cellHeight;

            // Draw cell background
            const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            rect.setAttribute('x', x);
            rect.setAttribute('y', y);
            rect.setAttribute('width', cellWidth);
            rect.setAttribute('height', cellHeight);
            rect.setAttribute('fill', cell.color);
            rect.setAttribute('stroke', '#555');
            rect.setAttribute('stroke-width', this.gridViewModel.currentConfig.cellStrokeWidth);
            rect.setAttribute('opacity', 0.4);
            rect.setAttribute('pointer-events', 'none');
            gridGroup.appendChild(rect);

            // Add cell label
            if (cell.label) {
                const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                label.setAttribute('x', x + cellWidth / 2);
                label.setAttribute('y', y + cellHeight / 2);
                label.setAttribute('text-anchor', 'middle');
                label.setAttribute('dominant-baseline', 'middle');
                label.setAttribute('fill', '#fff');
                label.setAttribute('font-size', '18');
                label.setAttribute('font-weight', 'bold');
                label.setAttribute('opacity', '0.6');
                label.setAttribute('pointer-events', 'none');
                label.textContent = cell.label;
                gridGroup.appendChild(label);
            }

            // Add clickable overlay for cell interaction
            const clickArea = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            clickArea.setAttribute('x', x);
            clickArea.setAttribute('y', y);
            clickArea.setAttribute('width', cellWidth);
            clickArea.setAttribute('height', cellHeight);
            clickArea.setAttribute('fill', 'transparent');
            clickArea.setAttribute('cursor', 'pointer');
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

        const startX = 50;

        // Draw only revealed boxes using pre-calculated positions
        const revealedBoxes = this.preCalculatedBoxes.filter(item =>
            this.revealedBoxIndices.has(item.boxIndex)
        );

        revealedBoxes.forEach(item => {
            // Draw the box using gridview's method with pre-calculated position
            this.gridViewModel.drawPhraseBox(this.gridGroup, item.box, item.centerX, item.centerY);
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

        if (!caseType) {
            shape = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            shape.setAttribute('x', x);
            shape.setAttribute('y', topY);
            shape.setAttribute('width', width);
            shape.setAttribute('height', height);
            shape.setAttribute('rx', '8');
            shape.setAttribute('fill', 'rgba(100, 100, 100, 1.0)');
            shape.setAttribute('stroke', 'rgba(255, 255, 255, 0.55)');
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
            shape.setAttribute('fill', 'rgba(100, 100, 100, 1.0)');
            shape.setAttribute('stroke', '#FFD700');
            shape.setAttribute('stroke-width', '3');
        } else if (caseType === 'akk') {
            shape = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            shape.setAttribute('x', x);
            shape.setAttribute('y', topY);
            shape.setAttribute('width', width);
            shape.setAttribute('height', height);
            shape.setAttribute('rx', '5');
            shape.setAttribute('ry', '5');
            shape.setAttribute('fill', 'rgba(100, 100, 100, 1.0)');
            shape.setAttribute('stroke', '#FFD700');
            shape.setAttribute('stroke-width', '3');
        } else if (caseType === 'dat') {
            shape = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
            const slope = 15;
            const points = `${x + slope},${topY} ${x + width - slope},${topY} ${x + width},${topY + height} ${x},${topY + height}`;
            shape.setAttribute('points', points);
            shape.setAttribute('fill', 'rgba(100, 100, 100, 1.0)');
            shape.setAttribute('stroke', '#FFD700');
            shape.setAttribute('stroke-width', '3');
        } else if (caseType === 'gen') {
            shape = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
            const slant = 10;
            const points = `${x + slant},${topY} ${x + width + slant},${topY} ${x + width - slant},${topY + height} ${x - slant},${topY + height}`;
            shape.setAttribute('points', points);
            shape.setAttribute('fill', 'rgba(100, 100, 100, 1.0)');
            shape.setAttribute('stroke', '#FFD700');
            shape.setAttribute('stroke-width', '3');
        }

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

        // Position word bar just above the grid
        const barHeight = 60;
        const gridStartY = this.getGridStartY();
        const topY = Math.max(10, gridStartY - barHeight - 10); // 10px gap above grid, minimum Y=10

        // Score display (aligned with word bar on the right)
        const scoreText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        const gridStartX = 50;
        const cellWidth = this.gridViewModel.cellWidth;
        const gridEndX = gridStartX + (3 * cellWidth);
        scoreText.setAttribute('x', gridEndX - 10);
        scoreText.setAttribute('y', topY + barHeight / 2 - 8);
        scoreText.setAttribute('text-anchor', 'end');
        scoreText.setAttribute('fill', '#2c3e50');
        scoreText.setAttribute('font-size', '20');
        scoreText.setAttribute('font-weight', 'bold');
        scoreText.textContent = `${this.totalScore}/${this.targetScore}`;
        overlayGroup.appendChild(scoreText);

        // Current sentence score (below total score)
        const sentenceScoreText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        sentenceScoreText.setAttribute('x', gridEndX - 10);
        sentenceScoreText.setAttribute('y', topY + barHeight / 2 + 12);
        sentenceScoreText.setAttribute('text-anchor', 'end');
        sentenceScoreText.setAttribute('fill', '#7f8c8d');
        sentenceScoreText.setAttribute('font-size', '14');
        sentenceScoreText.setAttribute('font-weight', 'normal');
        sentenceScoreText.textContent = `+${this.currentSentenceScore}`;
        overlayGroup.appendChild(sentenceScoreText);

        // Calculate current word box position first (for positioning auto-words on left)
        let currentWordBoxLeft = 625; // Default center if no current word
        let currentWordBoxWidth = 0;

        if (this.currentWordDisplay && this.currentIndex < this.manualItems.length) {
            const activeItem = this.manualItems[this.currentIndex];

            if (activeItem.type === 'box') {
                const phraseText = activeItem.item.words.map(w => w.text).join(' ');
                currentWordBoxWidth = this.estimateTextWidth(phraseText, 32);
            } else {
                currentWordBoxWidth = this.estimateTextWidth(activeItem.item.text, 32);
            }
            currentWordBoxLeft = 625 - currentWordBoxWidth / 2;
        }

        // Get visible auto-placed words in original sentence order
        const visibleAutoWords = this.getVisibleAutoWords();

        // Draw accumulated auto-placed words to the left of current word (as dark grey boxes)
        if (visibleAutoWords.length > 0) {
            // Calculate total width of all auto words
            const autoWordWidths = visibleAutoWords.map(word => this.estimateTextWidth(word, 28));
            const totalAutoWidth = autoWordWidths.reduce((sum, w) => sum + w + 10, 0) - 10; // -10 to remove last gap

            // Start position: just to the left of current word box
            let currentX = currentWordBoxLeft - totalAutoWidth - 15; // 15px gap between auto words and current word

            visibleAutoWords.forEach((wordText, index) => {
                const wordWidth = autoWordWidths[index];
                const centerX = currentX + wordWidth / 2;
                const centerY = topY + barHeight / 2;

                // Draw dark grey rectangular box for each word
                const bgRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                bgRect.setAttribute('x', currentX);
                bgRect.setAttribute('y', topY);
                bgRect.setAttribute('width', wordWidth);
                bgRect.setAttribute('height', barHeight);
                bgRect.setAttribute('fill', 'rgba(100, 100, 100, 0.55)');
                bgRect.setAttribute('stroke', 'rgba(255,255,255,0.25)');
                bgRect.setAttribute('stroke-width', '1.5');
                bgRect.setAttribute('rx', '8');
                overlayGroup.appendChild(bgRect);

                const autoText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                autoText.setAttribute('x', centerX);
                autoText.setAttribute('y', centerY + 10);
                autoText.setAttribute('text-anchor', 'middle');
                autoText.setAttribute('fill', '#fff');
                autoText.setAttribute('font-size', '28');
                autoText.setAttribute('font-weight', 'normal');
                autoText.textContent = wordText;
                overlayGroup.appendChild(autoText);

                currentX += wordWidth + 10; // Move right for next word
            });
        }

        // Draw current word (manual placement) in center as dark grey box
        if (this.currentWordDisplay && this.currentIndex < this.manualItems.length) {
            const activeItem = this.manualItems[this.currentIndex];
            const centerX = 625;
            const centerY = topY + barHeight / 2;

            // Calculate word width for positioning (needed for next word preview)
            let wordWidth;
            let displayText;

            if (activeItem.type === 'box') {
                displayText = activeItem.item.words.map(w => w.text).join(' ');
                wordWidth = this.estimateTextWidth(displayText, 32);
            } else {
                displayText = activeItem.item.text;
                wordWidth = this.estimateTextWidth(displayText, 32);
            }

            // Draw center word shape — shape and fill depend on currently selected case
            const centerShape = this.createTopBarWordShape(this.selectedCase, centerX, topY, wordWidth, barHeight);
            overlayGroup.appendChild(centerShape);

            // Timer bar for time challenge mode
            if (this.timeChallengeMode && this.wordStartTime !== null) {
                this.drawTimerBar(overlayGroup, centerX, topY, barHeight, wordWidth);
            }

            // Text color: dark with outline when no case selected (transparent bg), white otherwise
            const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            text.setAttribute('x', centerX);
            text.setAttribute('y', centerY + 10);
            text.setAttribute('text-anchor', 'middle');
            if (this.selectedCase) {
                text.setAttribute('fill', '#fff');
                text.setAttribute('font-size', '32');
                text.setAttribute('font-weight', 'bold');
            } else {
                text.setAttribute('fill', '#2c3e50');
                text.setAttribute('stroke', 'white');
                text.setAttribute('stroke-width', '4');
                text.setAttribute('paint-order', 'stroke');
                text.setAttribute('font-size', '32');
                text.setAttribute('font-weight', 'bold');
            }
            text.textContent = displayText;
            overlayGroup.appendChild(text);

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
                nextWordWidth = this.estimateTextWidth(nextWordText, 28);

                const nextWordX = currentWordBoxLeft + wordWidth + 15; // 15px gap
                const centerX = nextWordX + nextWordWidth / 2;
                const centerY = topY + barHeight / 2;

                // Draw dark grey rectangular box for next word (darker than current)
                const boxWidth = nextWordWidth;
                const boxHeight = barHeight;
                const bgRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                bgRect.setAttribute('x', centerX - boxWidth / 2);
                bgRect.setAttribute('y', topY);
                bgRect.setAttribute('width', boxWidth);
                bgRect.setAttribute('height', boxHeight);
                bgRect.setAttribute('fill', 'rgba(100, 100, 100, 0.38)');
                bgRect.setAttribute('stroke', 'rgba(255,255,255,0.2)');
                bgRect.setAttribute('stroke-width', '1.5');
                bgRect.setAttribute('rx', '8');
                overlayGroup.appendChild(bgRect);

                // Text
                const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                text.setAttribute('x', centerX);
                text.setAttribute('y', centerY + 10);
                text.setAttribute('text-anchor', 'middle');
                text.setAttribute('fill', '#fff');
                text.setAttribute('font-size', '28');
                text.setAttribute('font-weight', 'normal');
                text.textContent = nextWordText;
                overlayGroup.appendChild(text);
            }
        } else if (this.currentIndex >= this.manualItems.length) {
            // Game complete - show completion message or "tap to continue"
            const completeText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            completeText.setAttribute('x', 625);
            completeText.setAttribute('y', topY + barHeight / 2 + 10);
            completeText.setAttribute('text-anchor', 'middle');
            completeText.setAttribute('font-weight', 'bold');

            completeText.setAttribute('fill', '#27ae60');
            completeText.setAttribute('font-size', '32');
            completeText.textContent = '🎉 Complete! Tap to continue';
            overlayGroup.appendChild(completeText);
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
            if (this.waitingForContinue) {
                this.loadRandomSentenceAndContinue();
            }
        };

        overlay.addEventListener('click', handleTap);
        overlay.addEventListener('touchend', handleTap);

        this.gameGroup.appendChild(overlay);
    }

    /**
     * Draw game controllers as SVG elements
     */
    drawControllers() {
        const controllersGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        controllersGroup.setAttribute('class', 'game-controllers-group');
        this.gameGroup.appendChild(controllersGroup);

        const isMobile = window.innerWidth <= 768;
        const controllerSize = isMobile ? 120 : 100;

        // Calculate controller Y position based on grid end (not canvas/viewBox height)
        // This ensures controllers are always below the grid regardless of zoom/pan
        const gridStartY = this.getGridStartY();
        const cellHeight = this.gridViewModel.cellHeight;
        const gridEndY = gridStartY + (3 * cellHeight); // 3 rows
        const controllerY = gridEndY + 30; // 30px padding below grid

        // Position controllers within the grid's horizontal bounds
        const gridStartX = 50;
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

        // Highlight selected controller
        const isSelected = this.selectedCase === config.caseType;
        shape.setAttribute('fill', isSelected ? 'rgba(255, 215, 0, 0.9)' : config.color); // Gold when selected
        shape.setAttribute('stroke', isSelected ? '#FFD700' : 'white');
        shape.setAttribute('stroke-width', isSelected ? '6' : '4');
        shape.setAttribute('filter', 'drop-shadow(0 4px 8px rgba(0,0,0,0.3))');
        controllerGroup.appendChild(shape);

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
        const startX = 50;
        const startY = this.getGridStartY();
        const cellX = startX + (col - 1) * this.gridViewModel.cellWidth;
        const cellY = startY + (row - 1) * this.gridViewModel.cellHeight;
        const feedbackX = cellX + this.gridViewModel.cellWidth / 2;
        const feedbackY = cellY + this.gridViewModel.cellHeight / 2;

        if (isCorrect) {
            let points = 10;
            let feedbackSymbol = '✓';
            let feedbackColor = '#27ae60';

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

            // Show feedback
            this.showFeedback(feedbackSymbol, feedbackX, feedbackY, true, feedbackColor);

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
            color: color || (isCorrect ? '#27ae60' : '#e74c3c'),
            startTime: Date.now()
        };

        // Redraw to show feedback
        if (window.app) {
            window.app.redrawAll();
        }

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
            return;
        }

        const currentItem = this.manualItems[this.currentIndex];
        this.currentWordDisplay = this.getItemText(currentItem);

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
        }

        // Update floating feedback animation in-place
        const feedbackEl = this.svg.querySelector('.feedback-animation');
        if (feedbackEl && this.feedbackAnimation) {
            const elapsed = Date.now() - this.feedbackAnimation.startTime;
            const progress = Math.min(elapsed / 600, 1);
            const { x, y, symbol } = this.feedbackAnimation;
            const isScorePopup = symbol.startsWith('+');
            const scale = 1 + progress * (isScorePopup ? 0.2 : 0.5);
            const floatY = isScorePopup ? -50 * progress : 0;
            feedbackEl.setAttribute('transform', `translate(${x}, ${y + floatY}) scale(${scale})`);
            feedbackEl.setAttribute('opacity', 1 - progress);
        }
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
        // t: 0 (fresh/green) → 1 (expired/red)
        if (t < 0.5) {
            const tt = t / 0.5;
            return `rgb(${Math.round(39 + (230-39)*tt)},${Math.round(174 + (126-174)*tt)},${Math.round(96 + (34-96)*tt)})`;
        }
        const tt = (t - 0.5) / 0.5;
        return `rgb(${Math.round(230 + (231-230)*tt)},${Math.round(126 + (76-126)*tt)},${Math.round(34 + (60-34)*tt)})`;
    }

    drawTimerBar(group, centerX, topY, barHeight, wordWidth) {
        const elapsed = this.wordStartTime ? Date.now() - this.wordStartTime : 0;
        const remaining = Math.max(0, 1 - elapsed / 10000);
        const t = 1 - remaining;

        const barX = centerX - wordWidth / 2;
        const barY = topY + barHeight + 2;
        const trackHeight = 4;

        const track = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        track.setAttribute('id', 'game-timer-bar-track');
        track.setAttribute('data-width', wordWidth);
        track.setAttribute('x', barX);
        track.setAttribute('y', barY);
        track.setAttribute('width', wordWidth);
        track.setAttribute('height', trackHeight);
        track.setAttribute('rx', '2');
        track.setAttribute('fill', 'rgba(0,0,0,0.15)');
        track.setAttribute('pointer-events', 'none');
        group.appendChild(track);

        const fill = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        fill.setAttribute('id', 'game-timer-bar-fill');
        fill.setAttribute('x', barX);
        fill.setAttribute('y', barY);
        fill.setAttribute('width', Math.max(0, wordWidth * remaining));
        fill.setAttribute('height', trackHeight);
        fill.setAttribute('rx', '2');
        fill.setAttribute('fill', this.getTimerColor(t));
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

                    alert(`🎉 Congratulations!\n\nYou reached ${finalScore} points and mastered German sentence structure!`);
                }
            }, 1000);
        } else {
            this.waitingForContinue = true;
            if (window.app) {
                window.app.redrawAll();
            }
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
