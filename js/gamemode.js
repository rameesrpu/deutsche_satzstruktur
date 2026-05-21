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
        this.totalScore = 0; // Total score across all sentences
        this.currentSentenceScore = 0; // Score for current sentence only
        this.targetScore = 500; // Goal to reach
        this.currentWordIndex = 0;
        this.words = [];
        this.parsedSentence = null;
        this.placedBoxes = [];
        this.placedWords = new Map(); // Track which boxes/words have been placed
        this.autoPlacedWords = [];

        // Pre-calculated gridview state
        this.preCalculatedBoxes = [];
        this.preCalculatedConnections = [];
        this.preCalculatedLeadingWords = [];
        this.preCalculatedTrailingWords = [];
        this.revealedBoxIndices = new Set();
        this.feedbackAnimation = null;

        // Auto-placed words accumulation
        this.accumulatedAutoWords = []; // All auto-words shown so far (stays on left)
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
        this.totalScore = 0; // Reset total score when starting fresh
        this.startNewSentence();
    }

    /**
     * Start a new sentence within the game session
     */
    startNewSentence() {
        this.currentSentenceScore = 0;
        this.currentBoxIndex = 0;
        this.currentConnectionIndex = 0;
        this.placedBoxes = [];
        this.placedWords = new Map();
        this.placedVerbs = [];
        this.autoPlacedWords = [];
        this.autoPlacedConnections = [];
        this.gameSequence = [];
        this.feedbackAnimation = null;
        this.accumulatedAutoWords = [];
        this.currentWordDisplay = null;

        // Parse current sentence
        this.parseSentence();

        // Build game sequence (boxes + connections in order)
        this.buildGameSequence();

        // Pre-calculate gridview layout
        this.preCalculateGridView();

        // Show any leading auto-placed words at the start
        if (this.parsedSentence.leadingWords && this.parsedSentence.leadingWords.length > 0) {
            const autoLeadingWords = this.parsedSentence.leadingWords.filter(word => !this.isManualWord(word));
            if (autoLeadingWords.length > 0) {
                this.showAutoPlacedWords(autoLeadingWords);
            }
        }

        // Initialize current word display
        this.updateCurrentWordDisplay();
    }

    /**
     * Stop the game mode
     */
    stop() {
        if (!this.isActive) return;

        this.isActive = false;

        // Clear all state
        this.placedWords.clear();
        this.placedBoxes = [];
        this.placedVerbs = [];
        this.autoPlacedConnections = [];
        this.gameSequence = [];
        this.currentAutoPlacedText = null;
        this.feedbackAnimation = null;
        this.preCalculatedBoxes = [];
        this.preCalculatedConnections = [];
        this.preCalculatedLeadingWords = [];
        this.preCalculatedTrailingWords = [];
        this.revealedBoxIndices = new Set();
        this.accumulatedAutoWords = [];
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
    buildGameSequence() {
        const { boxes, connections, leadingWords, trailingWords } = this.parsedSentence;

        this.gameSequence = [];
        this.autoPlacedConnections = []; // Track auto-placed words per box

        // Create maps to track which words belong to which box
        const wordToBoxIndex = new Map(); // Maps word object to box index
        const boxProcessed = new Set(); // Track which boxes we've already added

        // Map all words in boxes to their box index
        boxes.forEach((box, boxIndex) => {
            box.words.forEach(word => {
                wordToBoxIndex.set(word, boxIndex);
            });
        });

        // Create a map of word to its role (leading/connection/trailing)
        const wordRoles = new Map();
        leadingWords.forEach(word => wordRoles.set(word, 'leading'));
        trailingWords.forEach(word => wordRoles.set(word, 'trailing'));
        connections.forEach((connWords, boxIndex) => {
            connWords.forEach(word => wordRoles.set(word, `connection-${boxIndex}`));
        });

        // Track auto-placed words for each position in sequence
        let currentAutoWords = [];

        // Iterate through words in original sentence order
        for (let i = 0; i < this.words.length; i++) {
            const word = this.words[i];

            // Check if this word is the first word of a box
            if (wordToBoxIndex.has(word)) {
                const boxIndex = wordToBoxIndex.get(word);
                const box = boxes[boxIndex];

                // Only add the box if it's the first word of the box and we haven't processed it yet
                if (box.words[0] === word && !boxProcessed.has(boxIndex)) {
                    // Before adding the box, flush any accumulated auto words
                    if (currentAutoWords.length > 0) {
                        // Find the appropriate connection array to store these in
                        // They should be associated with the previous box
                        const prevBoxIndex = boxProcessed.size > 0 ? boxProcessed.size - 1 : -1;
                        if (prevBoxIndex >= 0) {
                            if (!this.autoPlacedConnections[prevBoxIndex]) {
                                this.autoPlacedConnections[prevBoxIndex] = [];
                            }
                            this.autoPlacedConnections[prevBoxIndex].push(...currentAutoWords);
                        }
                        currentAutoWords = [];
                    }

                    // Add the box to sequence
                    this.gameSequence.push({
                        type: 'box',
                        item: box,
                        boxIndex: boxIndex
                    });
                    boxProcessed.add(boxIndex);

                    // Initialize auto-placed connections array for this box
                    if (!this.autoPlacedConnections[boxIndex]) {
                        this.autoPlacedConnections[boxIndex] = [];
                    }
                }
            }
            // Check if this word is a leading/connection/trailing word
            else if (wordRoles.has(word)) {
                const role = wordRoles.get(word);

                if (this.isManualWord(word)) {
                    // Manual word - add to sequence
                    const itemData = {
                        type: 'word',
                        item: word
                    };

                    if (role === 'leading') {
                        itemData.isLeading = true;
                    } else if (role === 'trailing') {
                        itemData.isTrailing = true;
                    } else if (role.startsWith('connection-')) {
                        itemData.isConnection = true;
                        const connBoxIndex = parseInt(role.split('-')[1]);
                        itemData.afterBoxIndex = connBoxIndex;
                    }

                    this.gameSequence.push(itemData);
                } else {
                    // Auto-placed word - accumulate it
                    currentAutoWords.push(word);
                }
            }
        }

        // Flush any remaining auto words (trailing auto words)
        if (currentAutoWords.length > 0 && boxes.length > 0) {
            const lastBoxIndex = boxes.length - 1;
            if (!this.autoPlacedConnections[lastBoxIndex]) {
                this.autoPlacedConnections[lastBoxIndex] = [];
            }
            this.autoPlacedConnections[lastBoxIndex].push(...currentAutoWords);
        }

        console.log('Game sequence built (preserving original order):', this.gameSequence);
        console.log('Auto-placed connections:', this.autoPlacedConnections);
    }

    /**
     * Check if word requires manual placement
     * Manual: subjects and objects (these have grid positions)
     * Auto: verbs, prepositions, conjunctions, infinitives, adjectives, adverbs, articles
     *
     * Note: Verbs are auto-placed because they appear on arrows, not in grid cells
     */
    isManualWord(word) {
        const type = word.type;

        // Manual placement types (only these require user interaction)
        if (type === 'subject') return true;
        if (type.includes('object')) return true;

        // Everything else is auto-placed
        // This includes: verbs, modals, prepositions, conjunctions, adjectives, adverbs, articles, etc.
        // Verbs are auto-placed because they appear on arrows between boxes, not in cells
        return false;
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

            this.gridViewModel.drawArrow(this.gridGroup, fromBox, toBox, connectionWords, this.wordManager);
        }

        // Draw incoming arrow if first box is revealed and there are leading words
        if (this.revealedBoxIndices.has(0) && this.preCalculatedLeadingWords.length > 0) {
            const firstBox = this.preCalculatedBoxes[0];
            this.gridViewModel.drawIncomingArrow(this.gridGroup, firstBox, this.preCalculatedLeadingWords, startX, this.wordManager);
        }

        // Draw outgoing arrow if last box is revealed
        const lastBoxIndex = this.preCalculatedBoxes.length - 1;
        if (this.revealedBoxIndices.has(lastBoxIndex)) {
            const lastBox = this.preCalculatedBoxes[lastBoxIndex];

            // Check for final connection
            if (this.preCalculatedConnections.length === this.preCalculatedBoxes.length) {
                const finalConnection = this.preCalculatedConnections[this.preCalculatedConnections.length - 1];
                if (finalConnection && finalConnection.length > 0) {
                    this.gridViewModel.drawOutgoingArrow(this.gridGroup, lastBox, finalConnection, startX, this.wordManager);
                }
            }

            // Check for trailing words
            if (this.preCalculatedTrailingWords.length > 0) {
                this.gridViewModel.drawOutgoingArrow(this.gridGroup, lastBox, this.preCalculatedTrailingWords, startX, this.wordManager);
            }
        }
    }


    /**
     * Draw UI overlay (score, accumulated auto-words on left, current word in center)
     */
    drawUIOverlay() {
        const overlayGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        overlayGroup.setAttribute('class', 'game-ui-overlay');
        this.gameGroup.appendChild(overlayGroup);

        // Score display (top-right) - show both total and current sentence score
        const scoreText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        scoreText.setAttribute('x', 1100);
        scoreText.setAttribute('y', 30);
        scoreText.setAttribute('text-anchor', 'end');
        scoreText.setAttribute('fill', '#2c3e50');
        scoreText.setAttribute('font-size', '24');
        scoreText.setAttribute('font-weight', 'bold');
        scoreText.textContent = `Total: ${this.totalScore}/${this.targetScore}`;
        overlayGroup.appendChild(scoreText);

        // Current sentence score
        const sentenceScoreText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        sentenceScoreText.setAttribute('x', 1100);
        sentenceScoreText.setAttribute('y', 55);
        sentenceScoreText.setAttribute('text-anchor', 'end');
        sentenceScoreText.setAttribute('fill', '#7f8c8d');
        sentenceScoreText.setAttribute('font-size', '18');
        sentenceScoreText.setAttribute('font-weight', 'normal');
        sentenceScoreText.textContent = `Sentence: +${this.currentSentenceScore}`;
        overlayGroup.appendChild(sentenceScoreText);

        // Top bar for words
        const topY = 10;
        const barHeight = 60;

        // Calculate current word box position first
        let currentWordBoxLeft = 625; // Default center if no current word
        let currentWordBoxWidth = 0;

        if (this.currentWordDisplay && this.currentBoxIndex < this.gameSequence.length) {
            const displayText = this.currentWordDisplay;
            currentWordBoxWidth = Math.max(displayText.length * 18 + 40, 200);
            currentWordBoxLeft = 625 - currentWordBoxWidth / 2;
        }

        // Draw accumulated auto-placed words to the left of current word
        if (this.accumulatedAutoWords.length > 0) {
            // Calculate total width of all auto words (using same font size as current word)
            const autoWordWidths = this.accumulatedAutoWords.map(word => word.length * 20 + 40);
            const totalAutoWidth = autoWordWidths.reduce((sum, w) => sum + w + 10, 0) - 10; // -10 to remove last gap

            // Start position: just to the left of current word box
            let currentX = currentWordBoxLeft - totalAutoWidth - 15; // 15px gap between auto words and current word

            this.accumulatedAutoWords.forEach((word, index) => {
                // Background for each auto word
                const wordWidth = autoWordWidths[index];
                const bgRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                bgRect.setAttribute('x', currentX);
                bgRect.setAttribute('y', topY);
                bgRect.setAttribute('width', wordWidth);
                bgRect.setAttribute('height', barHeight);
                bgRect.setAttribute('fill', 'rgba(149, 165, 166, 0.8)'); // Gray for auto-placed
                bgRect.setAttribute('stroke', '#95a5a6');
                bgRect.setAttribute('stroke-width', '2');
                bgRect.setAttribute('rx', '10');
                overlayGroup.appendChild(bgRect);

                // Auto word text (same font size as current word)
                const autoText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                autoText.setAttribute('x', currentX + wordWidth / 2);
                autoText.setAttribute('y', topY + barHeight / 2 + 10);
                autoText.setAttribute('text-anchor', 'middle');
                autoText.setAttribute('fill', '#fff');
                autoText.setAttribute('font-size', '32');
                autoText.setAttribute('font-weight', 'normal');
                autoText.textContent = word;
                overlayGroup.appendChild(autoText);

                currentX += wordWidth + 10; // Move right for next word
            });
        }

        // Draw current word (manual placement) in center
        if (this.currentWordDisplay && this.currentBoxIndex < this.gameSequence.length) {
            const displayText = this.currentWordDisplay;
            const wordWidth = currentWordBoxWidth;

            // Center the current word box
            const centerX = currentWordBoxLeft;
            const centerWordX = 625; // Center of the word area

            // Create background shape based on selected case
            let bgShape;
            const activeItem = this.gameSequence[this.currentBoxIndex];
            const itemToCheck = activeItem.type === 'box' ? activeItem.item.mainWord : activeItem.item;
            const isObject = itemToCheck.type.includes('object');

            // Only show shape variation if this is an object and a case is selected
            if (isObject && this.selectedCase) {
                if (this.selectedCase === 'nom') {
                    // Circle/ellipse for nominative
                    bgShape = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
                    bgShape.setAttribute('cx', centerWordX);
                    bgShape.setAttribute('cy', topY + barHeight / 2);
                    bgShape.setAttribute('rx', wordWidth / 2);
                    bgShape.setAttribute('ry', barHeight / 2);
                } else if (this.selectedCase === 'akk') {
                    // Square for accusative
                    const squareSize = Math.max(wordWidth, barHeight);
                    bgShape = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                    bgShape.setAttribute('x', centerWordX - squareSize / 2);
                    bgShape.setAttribute('y', topY + (barHeight - squareSize) / 2);
                    bgShape.setAttribute('width', squareSize);
                    bgShape.setAttribute('height', squareSize);
                    bgShape.setAttribute('rx', '8');
                } else if (this.selectedCase === 'dat') {
                    // Trapezoid for dative
                    bgShape = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
                    const slope = wordWidth * 0.15;
                    const left = centerX;
                    const right = centerX + wordWidth;
                    const top = topY;
                    const bottom = topY + barHeight;
                    const points = `${left + slope},${top} ${right - slope},${top} ${right},${bottom} ${left},${bottom}`;
                    bgShape.setAttribute('points', points);
                }
            } else {
                // Default rounded rectangle (for subjects or when no case selected)
                bgShape = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                bgShape.setAttribute('x', centerX);
                bgShape.setAttribute('y', topY);
                bgShape.setAttribute('width', wordWidth);
                bgShape.setAttribute('height', barHeight);
                bgShape.setAttribute('rx', '10');
            }

            bgShape.setAttribute('fill', 'rgba(44, 62, 80, 0.9)'); // Dark for current word
            bgShape.setAttribute('stroke', '#2c3e50');
            bgShape.setAttribute('stroke-width', '3');
            overlayGroup.appendChild(bgShape);

            // Current word text
            const wordText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            wordText.setAttribute('x', 625);
            wordText.setAttribute('y', topY + barHeight / 2 + 10);
            wordText.setAttribute('text-anchor', 'middle');
            wordText.setAttribute('fill', '#fff');
            wordText.setAttribute('font-size', '32');
            wordText.setAttribute('font-weight', 'bold');
            wordText.textContent = displayText;
            overlayGroup.appendChild(wordText);

            // Draw next word preview (to the right, in grey)
            // The next word can be either:
            // 1. An auto-placed word that will appear after placing current box
            // 2. The next manual word in the game sequence
            let nextWordText = null;

            const currentItem = this.gameSequence[this.currentBoxIndex];

            // If current item is a box, check for auto-placed words that come after it
            if (currentItem.type === 'box' && currentItem.boxIndex !== undefined) {
                const autoWords = this.autoPlacedConnections[currentItem.boxIndex];
                if (autoWords && autoWords.length > 0) {
                    // Next word is the first auto-placed word after this box
                    nextWordText = autoWords[0].text;
                }
            }

            // If no auto-placed word, show next manual word from game sequence
            if (!nextWordText && this.currentBoxIndex + 1 < this.gameSequence.length) {
                const nextItem = this.gameSequence[this.currentBoxIndex + 1];
                nextWordText = this.getItemText(nextItem);
            }

            if (nextWordText) {
                const nextWordWidth = Math.max(nextWordText.length * 15 + 30, 150);
                const nextWordX = currentWordBoxLeft + wordWidth + 15; // 15px gap

                // Background for next word (grey)
                const nextBgRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                nextBgRect.setAttribute('x', nextWordX);
                nextBgRect.setAttribute('y', topY);
                nextBgRect.setAttribute('width', nextWordWidth);
                nextBgRect.setAttribute('height', barHeight);
                nextBgRect.setAttribute('fill', 'rgba(149, 165, 166, 0.6)'); // Light grey
                nextBgRect.setAttribute('stroke', '#95a5a6');
                nextBgRect.setAttribute('stroke-width', '2');
                nextBgRect.setAttribute('rx', '10');
                overlayGroup.appendChild(nextBgRect);

                // Next word text
                const nextText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                nextText.setAttribute('x', nextWordX + nextWordWidth / 2);
                nextText.setAttribute('y', topY + barHeight / 2 + 8);
                nextText.setAttribute('text-anchor', 'middle');
                nextText.setAttribute('fill', '#fff');
                nextText.setAttribute('font-size', '20');
                nextText.setAttribute('font-weight', 'normal');
                nextText.textContent = nextWordText;
                overlayGroup.appendChild(nextText);
            }
        } else if (this.currentBoxIndex >= this.gameSequence.length) {
            // Game complete - show completion message
            const completeText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            completeText.setAttribute('x', 625);
            completeText.setAttribute('y', 48);
            completeText.setAttribute('text-anchor', 'middle');
            completeText.setAttribute('fill', '#27ae60');
            completeText.setAttribute('font-size', '36');
            completeText.setAttribute('font-weight', 'bold');
            completeText.textContent = '🎉 Complete!';
            overlayGroup.appendChild(completeText);
        }

        this.overlayGroup = overlayGroup;
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
            color: 'rgba(255, 255, 255, 0.7)'
        });

        // Left controllers (objects - nom/acc/dat)
        this.leftControllers = [];
        const leftControllerConfigs = [
            { caseType: 'nom', shape: 'circle', color: 'rgba(255, 255, 255, 0.7)', label: 'NOM' },
            { caseType: 'akk', shape: 'square', color: 'rgba(255, 255, 255, 0.7)', label: 'AKK' },
            { caseType: 'dat', shape: 'trapezoid', color: 'rgba(255, 255, 255, 0.7)', label: 'DAT' }
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

        // Update controller states based on current item
        if (this.currentBoxIndex < this.gameSequence.length) {
            const currentItem = this.gameSequence[this.currentBoxIndex];
            if (currentItem.type === 'box') {
                this.updateControllerStates(currentItem.item.mainWord);
            } else {
                this.updateControllerStates(currentItem.item);
            }
        }

        this.controllersGroup = controllersGroup;
    }

    /**
     * Create a case shape indicator (circle for nom, square for akk, trapezoid for dat)
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
        if (this.currentBoxIndex >= this.gameSequence.length) {
            console.log('Game complete!');
            return;
        }

        const currentItem = this.gameSequence[this.currentBoxIndex];
        const itemToValidate = currentItem.type === 'box' ? currentItem.item.mainWord : currentItem.item;

        // Determine case type
        let caseType;
        if (itemToValidate.type === 'subject') {
            // Subjects always use nominative
            caseType = 'nom';
        } else {
            // Objects use selected case (if none selected, invalid)
            if (!this.selectedCase) {
                console.log('Please select a case first (NOM/AKK/DAT)');
                return;
            }
            caseType = this.selectedCase;
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
        if (this.currentBoxIndex >= this.gameSequence.length) {
            console.log('Game complete!');
            return;
        }

        const currentItem = this.gameSequence[this.currentBoxIndex];
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
            this.currentSentenceScore += 10;
            this.totalScore += 10;
            console.log('✓ Correct placement!');

            // Show tick feedback
            this.showFeedback('✓', feedbackX, feedbackY, true);

            // Reveal the corresponding box in the gridview
            if (currentItem.type === 'box') {
                this.revealedBoxIndices.add(currentItem.boxIndex);

                // Clear previously accumulated auto-words (they're now visible on arrows in diagram)
                this.accumulatedAutoWords = [];

                // Auto-place any connection words after this box
                if (currentItem.boxIndex !== undefined && this.autoPlacedConnections[currentItem.boxIndex]) {
                    const autoWords = this.autoPlacedConnections[currentItem.boxIndex];
                    if (autoWords.length > 0) {
                        // Show auto-placed words on the left
                        this.showAutoPlacedWords(autoWords);
                    }
                }
            }

            // Move to next item
            this.currentBoxIndex++;

            // Update current word display
            this.updateCurrentWordDisplay();

            // Check if game is complete
            if (this.currentBoxIndex >= this.gameSequence.length) {
                setTimeout(() => {
                    this.showGameComplete();
                }, 600);
            }
        } else {
            console.log('✗ Incorrect placement!');

            // Show cross feedback (no score penalty, but don't advance)
            this.showFeedback('✗', feedbackX, feedbackY, false);
        }
    }

    /**
     * Show tick/cross feedback animation
     */
    showFeedback(symbol, x, y, isCorrect) {
        this.feedbackAnimation = {
            symbol: symbol,
            x: x,
            y: y,
            isCorrect: isCorrect,
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

        const { symbol, x, y, isCorrect, startTime } = this.feedbackAnimation;
        const elapsed = Date.now() - startTime;
        const duration = 600;
        const progress = Math.min(elapsed / duration, 1);

        // Animate: scale up and fade out
        const scale = 1 + progress * 0.5;
        const opacity = 1 - progress;

        const feedbackGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        feedbackGroup.setAttribute('class', 'feedback-animation');
        feedbackGroup.setAttribute('transform', `translate(${x}, ${y}) scale(${scale})`);
        feedbackGroup.setAttribute('opacity', opacity);

        // Draw symbol
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', 0);
        text.setAttribute('y', 0);
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('dominant-baseline', 'middle');
        text.setAttribute('font-size', '100');
        text.setAttribute('font-weight', 'bold');
        text.setAttribute('fill', isCorrect ? '#27ae60' : '#e74c3c');
        text.setAttribute('stroke', 'white');
        text.setAttribute('stroke-width', '4');
        text.setAttribute('paint-order', 'stroke');
        text.textContent = symbol;
        feedbackGroup.appendChild(text);

        this.gameGroup.appendChild(feedbackGroup);
    }

    /**
     * Show auto-placed words - they accumulate on the left until next box is placed
     */
    showAutoPlacedWords(words) {
        words.forEach(word => {
            console.log(`Auto-placing: ${word.text}`);

            // Add to accumulated auto words
            this.accumulatedAutoWords.push(word.text);
        });

        // Redraw to show the auto-placed words on the left
        if (window.app) {
            window.app.redrawAll();
        }
    }

    /**
     * Update the current word display (what the player needs to place)
     */
    updateCurrentWordDisplay() {
        if (this.currentBoxIndex >= this.gameSequence.length) {
            this.currentWordDisplay = null;
            return;
        }

        const currentItem = this.gameSequence[this.currentBoxIndex];
        this.currentWordDisplay = this.getItemText(currentItem);
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

        // Check if case matches (for objects)
        const caseMatch = !word.case || word.case === caseType;

        return positionMatch && caseMatch;
    }

    /**
     * Update controller enabled/disabled states
     */
    updateControllerStates(word) {
        const isObject = word.type.includes('object');

        // Hide right controller - subjects are placed by tapping grid directly
        if (this.rightController) {
            this.rightController.element.setAttribute('opacity', '0');
            this.rightController.element.style.pointerEvents = 'none';
        }

        // Left controllers (case selectors): only enabled for objects
        this.leftControllers.forEach(controller => {
            if (isObject) {
                controller.element.setAttribute('opacity', '1');
                controller.element.style.pointerEvents = 'all';
            } else {
                controller.element.setAttribute('opacity', '0.3');
                controller.element.style.pointerEvents = 'none';
            }
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
                    window.app.currentView = 'grid';
                    this.stop();

                    // Reset button to play icon
                    const gameModeBtn = document.getElementById('game-mode-btn');
                    if (gameModeBtn) {
                        gameModeBtn.textContent = '🎮';
                        gameModeBtn.title = 'Start Game Mode';
                    }

                    window.app.redrawAll();

                    alert(`🎉 Congratulations!\n\nYou reached ${this.totalScore} points and mastered German sentence structure!`);
                }
            }, 1000);
        } else {
            // Load next random sentence and continue
            setTimeout(() => {
                this.loadRandomSentenceAndContinue();
            }, 1500);
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

        const sentenceManager = window.app.sentenceManager;
        const allSentences = sentenceManager.getAllSentences();

        if (allSentences.length === 0) {
            console.error('No sentences available');
            return;
        }

        // Pick a random sentence (exclude current one if possible)
        let randomSentence;
        if (allSentences.length > 1) {
            const otherSentences = allSentences.filter(s => s.id !== sentenceManager.currentSentenceId);
            randomSentence = otherSentences[Math.floor(Math.random() * otherSentences.length)];
        } else {
            randomSentence = allSentences[0];
        }

        // Load the random sentence
        sentenceManager.loadSentence(randomSentence.id);

        // Start new sentence in game mode
        this.startNewSentence();

        // Redraw
        if (window.app) {
            window.app.redrawAll();
        }

        console.log('Loaded new sentence:', randomSentence.sentence);
    }
}
