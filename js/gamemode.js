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

        // Controller state
        this.activeController = null;
        this.isDragging = false;
        this.dragStartPos = { x: 0, y: 0 };
        this.currentDirection = 'center';

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

        // Draw cell highlight (if any)
        this.drawCellHighlight();

        // Draw revealed boxes/words (using pre-calculated gridview positions)
        this.drawPlacedItems();

        // Draw tick/cross feedback animation (if active)
        this.drawFeedbackAnimation();

        // Draw controllers
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
        const startY = 50;

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
     * According to spec: word-by-word in original sentence order
     * But boxes are single units, and some words auto-place
     */
    buildGameSequence() {
        const { boxes, connections, leadingWords, trailingWords } = this.parsedSentence;

        this.gameSequence = [];
        this.autoPlacedConnections = []; // Track auto-placed words per box

        // Add leading words (if any) - these require manual placement
        if (leadingWords && leadingWords.length > 0) {
            leadingWords.forEach(word => {
                if (this.isManualWord(word)) {
                    this.gameSequence.push({
                        type: 'word',
                        item: word,
                        isLeading: true
                    });
                }
            });
        }

        // Interleave boxes and connections
        boxes.forEach((box, index) => {
            // Add the box (noun phrase)
            this.gameSequence.push({
                type: 'box',
                item: box,
                boxIndex: index
            });

            // Track connection words for this box
            const autoWords = [];
            if (connections[index] && connections[index].length > 0) {
                connections[index].forEach(word => {
                    // Check if word requires manual placement
                    if (this.isManualWord(word)) {
                        this.gameSequence.push({
                            type: 'word',
                            item: word,
                            isConnection: true,
                            afterBoxIndex: index
                        });
                    } else {
                        // Track auto-placed words
                        autoWords.push(word);
                    }
                });
            }
            this.autoPlacedConnections[index] = autoWords;
        });

        // Add trailing words (if any) - these require manual placement
        if (trailingWords && trailingWords.length > 0) {
            trailingWords.forEach(word => {
                if (this.isManualWord(word)) {
                    this.gameSequence.push({
                        type: 'word',
                        item: word,
                        isTrailing: true
                    });
                }
            });
        }

        console.log('Game sequence built:', this.gameSequence);
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
        const startX = 50;
        const startY = 50;

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
            // Calculate total width of all auto words
            const autoWordWidths = this.accumulatedAutoWords.map(word => word.length * 15 + 30);
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

                // Auto word text
                const autoText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                autoText.setAttribute('x', currentX + wordWidth / 2);
                autoText.setAttribute('y', topY + barHeight / 2 + 8);
                autoText.setAttribute('text-anchor', 'middle');
                autoText.setAttribute('fill', '#fff');
                autoText.setAttribute('font-size', '24');
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

            // Background box for current word
            const bgRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            bgRect.setAttribute('x', centerX);
            bgRect.setAttribute('y', topY);
            bgRect.setAttribute('width', wordWidth);
            bgRect.setAttribute('height', barHeight);
            bgRect.setAttribute('fill', 'rgba(44, 62, 80, 0.9)'); // Dark for current word
            bgRect.setAttribute('stroke', '#2c3e50');
            bgRect.setAttribute('stroke-width', '3');
            bgRect.setAttribute('rx', '10');
            overlayGroup.appendChild(bgRect);

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

        // Right controller (subject/verb)
        this.rightController = this.drawController(controllersGroup, {
            type: 'right',
            caseType: 'nom',
            shape: 'circle',
            x: 1100,
            y: 800,
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

        const spacing = controllerSize + 20;
        leftControllerConfigs.forEach((config, index) => {
            const controller = this.drawController(controllersGroup, {
                type: 'left',
                caseType: config.caseType,
                shape: config.shape,
                label: config.label,
                x: 100 + (index * spacing),
                y: 800,
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

        shape.setAttribute('fill', config.color);
        shape.setAttribute('stroke', 'white');
        shape.setAttribute('stroke-width', '4');
        shape.setAttribute('filter', 'drop-shadow(0 4px 8px rgba(0,0,0,0.3))');
        controllerGroup.appendChild(shape);

        // Add case label
        const labelText = config.label || config.caseType.toUpperCase();
        const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        label.setAttribute('x', center);
        label.setAttribute('y', center + 6);
        label.setAttribute('text-anchor', 'middle');
        label.setAttribute('fill', 'white');
        label.setAttribute('font-size', '18');
        label.setAttribute('font-weight', 'bold');
        label.textContent = labelText;
        controllerGroup.appendChild(label);

        // Arrow indicator (hidden by default)
        const arrow = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        arrow.setAttribute('class', 'controller-arrow');
        arrow.setAttribute('x', center);
        arrow.setAttribute('y', center + 8);
        arrow.setAttribute('text-anchor', 'middle');
        arrow.setAttribute('font-size', '40');
        arrow.setAttribute('opacity', '0');
        arrow.setAttribute('pointer-events', 'none');
        arrow.textContent = '→';
        controllerGroup.appendChild(arrow);

        // Touch event handlers
        this.setupControllerEvents(controllerGroup, config);

        group.appendChild(controllerGroup);

        return {
            element: controllerGroup,
            config: config,
            shape: shape,
            arrow: arrow
        };
    }

    /**
     * Setup touch/mouse events for controller (SVG elements)
     */
    setupControllerEvents(element, config) {
        const svg = this.svg;
        let isActive = false;

        const getSVGPoint = (clientX, clientY) => {
            const pt = svg.createSVGPoint();
            pt.x = clientX;
            pt.y = clientY;
            return pt.matrixTransform(svg.getScreenCTM().inverse());
        };

        const handleStart = (e) => {
            e.stopPropagation();

            const touch = e.touches ? e.touches[0] : e;
            const pt = getSVGPoint(touch.clientX, touch.clientY);

            isActive = true;
            this.activeController = element;
            this.activeControllerConfig = config;
            this.isDragging = false;
            this.dragStartPos = { x: pt.x, y: pt.y };
            this.currentDirection = 'center';

            // Highlight center cell by default
            this.highlightCell('center');

            // Redraw to show highlight
            if (window.app) {
                window.app.redrawAll();
            }
        };

        const handleMove = (e) => {
            if (!isActive) return;
            e.stopPropagation();

            const touch = e.touches ? e.touches[0] : e;
            const pt = getSVGPoint(touch.clientX, touch.clientY);

            const deltaX = pt.x - this.dragStartPos.x;
            const deltaY = pt.y - this.dragStartPos.y;
            const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

            // Check if drag threshold exceeded
            if (distance > 30) {
                this.isDragging = true;

                // Calculate angle in degrees (0 = right, 90 = up)
                const angle = Math.atan2(-deltaY, deltaX) * (180 / Math.PI);
                const normalizedAngle = (angle + 360) % 360;

                // Map angle to direction
                const direction = this.getDirectionFromAngle(normalizedAngle);

                if (direction !== this.currentDirection) {
                    this.currentDirection = direction;
                    this.highlightCell(direction);
                    this.updateControllerArrow(element, direction);

                    // Redraw to show updates
                    if (window.app) {
                        window.app.redrawAll();
                    }
                }
            } else {
                // Still in center
                if (this.currentDirection !== 'center') {
                    this.currentDirection = 'center';
                    this.highlightCell('center');
                    this.updateControllerArrow(element, 'center');

                    // Redraw to show updates
                    if (window.app) {
                        window.app.redrawAll();
                    }
                }
            }
        };

        const handleEnd = (e) => {
            if (!isActive) return;
            e.stopPropagation();

            // Place word in highlighted cell
            this.placeWord(this.currentDirection, config.caseType);

            // Reset
            isActive = false;
            this.activeController = null;
            this.activeControllerConfig = null;
            this.isDragging = false;
            this.currentDirection = 'center';
            this.clearHighlight();
            this.updateControllerArrow(element, null);

            // Redraw to show placed item
            if (window.app) {
                window.app.redrawAll();
            }
        };

        // SVG events
        element.addEventListener('touchstart', handleStart, { passive: false });
        element.addEventListener('mousedown', handleStart);

        // Use document for move/end to handle dragging outside element
        svg.addEventListener('touchmove', (e) => {
            if (isActive && this.activeController === element) {
                handleMove(e);
            }
        }, { passive: false });
        svg.addEventListener('mousemove', (e) => {
            if (isActive && this.activeController === element) {
                handleMove(e);
            }
        });

        svg.addEventListener('touchend', (e) => {
            if (isActive && this.activeController === element) {
                handleEnd(e);
            }
        }, { passive: false });
        svg.addEventListener('mouseup', (e) => {
            if (isActive && this.activeController === element) {
                handleEnd(e);
            }
        });
    }

    /**
     * Get direction from angle (in degrees)
     */
    getDirectionFromAngle(angle) {
        // 8 directions + center
        // East: 337.5-22.5, NE: 22.5-67.5, North: 67.5-112.5, etc.
        if (angle >= 337.5 || angle < 22.5) return 'east';
        if (angle >= 22.5 && angle < 67.5) return 'northeast';
        if (angle >= 67.5 && angle < 112.5) return 'north';
        if (angle >= 112.5 && angle < 157.5) return 'northwest';
        if (angle >= 157.5 && angle < 202.5) return 'west';
        if (angle >= 202.5 && angle < 247.5) return 'southwest';
        if (angle >= 247.5 && angle < 292.5) return 'south';
        if (angle >= 292.5 && angle < 337.5) return 'southeast';
        return 'center';
    }

    /**
     * Update controller arrow indicator
     */
    updateControllerArrow(element, direction) {
        const arrow = element.querySelector('.controller-arrow');
        if (!arrow) return;

        if (!direction || direction === 'center') {
            arrow.setAttribute('opacity', '0');
            return;
        }

        const directionData = this.directionMap[direction];
        if (!directionData || directionData.angle === null) {
            arrow.setAttribute('opacity', '0');
            return;
        }

        arrow.setAttribute('opacity', '1');
        const transform = `rotate(${-directionData.angle})`;
        arrow.setAttribute('transform', transform);
    }

    /**
     * Highlight target cell in grid
     */
    highlightCell(direction) {
        // Store the highlighted cell direction for drawing
        this.highlightedCell = direction;
    }

    /**
     * Clear cell highlight
     */
    clearHighlight() {
        this.highlightedCell = null;
    }

    /**
     * Draw cell highlight if one is active
     */
    drawCellHighlight() {
        if (!this.highlightedCell) return;

        const directionData = this.directionMap[this.highlightedCell];
        if (!directionData) return;

        const { row, col } = directionData;
        const cellWidth = this.gridViewModel.cellWidth;
        const cellHeight = this.gridViewModel.cellHeight;
        const startX = 50;
        const startY = 50;

        const x = startX + (col - 1) * cellWidth;
        const y = startY + (row - 1) * cellHeight;

        // Draw highlight in grid group
        const highlight = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        highlight.setAttribute('class', 'cell-highlight');
        highlight.setAttribute('x', x);
        highlight.setAttribute('y', y);
        highlight.setAttribute('width', cellWidth);
        highlight.setAttribute('height', cellHeight);
        highlight.setAttribute('fill', 'rgba(255, 255, 0, 0.3)');
        highlight.setAttribute('stroke', 'yellow');
        highlight.setAttribute('stroke-width', '4');
        highlight.setAttribute('pointer-events', 'none');

        // Insert at beginning of grid group so it's behind everything
        if (this.gridGroup && this.gridGroup.firstChild) {
            this.gridGroup.insertBefore(highlight, this.gridGroup.firstChild);
        } else if (this.gridGroup) {
            this.gridGroup.appendChild(highlight);
        }
    }

    /**
     * Place current item in selected cell
     */
    placeWord(direction, caseType) {
        if (this.currentBoxIndex >= this.gameSequence.length) {
            console.log('Game complete!');
            return;
        }

        const currentItem = this.gameSequence[this.currentBoxIndex];
        const itemToValidate = currentItem.type === 'box' ? currentItem.item.mainWord : currentItem.item;

        console.log(`Placing ${currentItem.type}: ${this.getItemText(currentItem)} in direction: ${direction}, case: ${caseType}`);

        // Validate placement
        const isCorrect = this.validatePlacement(itemToValidate, direction, caseType);

        // Get the cell position for feedback display
        const directionData = this.directionMap[direction];
        const startX = 50;
        const startY = 50;
        const cellX = startX + (directionData.col - 1) * this.gridViewModel.cellWidth;
        const cellY = startY + (directionData.row - 1) * this.gridViewModel.cellHeight;
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
    validatePlacement(word, direction, caseType) {
        // Get expected position based on word properties
        const expectedPosition = this.gridViewModel.getWordPosition(word);
        const directionData = this.directionMap[direction];

        if (!expectedPosition || !directionData) return false;

        // Check if row/col match
        const positionMatch = expectedPosition.row === directionData.row &&
                              expectedPosition.col === directionData.col;

        // Check if case matches (for objects)
        const caseMatch = !word.case || word.case === caseType;

        return positionMatch && caseMatch;
    }

    /**
     * Update controller enabled/disabled states
     */
    updateControllerStates(word) {
        const isSubject = word.type === 'subject';
        const isVerb = word.type === 'verb' || word.type === 'modal';
        const isObject = word.type.includes('object');

        // Right controller: enabled for subjects and verbs
        if (this.rightController) {
            if (isSubject || isVerb) {
                this.rightController.element.setAttribute('opacity', '1');
                this.rightController.element.style.pointerEvents = 'all';
            } else {
                this.rightController.element.setAttribute('opacity', '0.3');
                this.rightController.element.style.pointerEvents = 'none';
            }
        }

        // Left controllers: enabled for objects
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
