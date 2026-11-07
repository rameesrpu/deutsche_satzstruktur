import { gameSounds, placementSpeech } from './sound.js';
import { pickNextSentence } from './sentencePicker.js';
import { evaluatePlacement, getAutoPlacement, explainMistake, placementFeedback, MAX_WRONG_ATTEMPTS } from './gameRules.js';
import { progressStore, sentenceKey, emptyMistakes, addMistake } from './progressStore.js';
import { GM_UI, drawHud, getTimerColor } from './gameHud.js';
import { GRID_CELLS } from './grammaticalConfig.js';
import { ensureJuiceDefs, spawnConfetti, spawnFloatingText, drawFeedbackAnimation, updateFeedbackElement,
    showFinalCelebration } from './gameJuice.js';
import { LEVEL_CONTENT, chapterOrder } from './levelContent.js';
import { updatePlayTimer } from './playScreen.js';
import { felderLesson } from './felderLesson.js';
import { beatsBefore, beatsAfterLast, nextPlayText, showStoryCard, hideStoryCard,
    isStoryCardOpen } from './storyNarration.js';

/** Play screen: ms after a solved sentence before a field-model lesson opens on its own (E3). */
export const FELDER_AUTO_DELAY = 1100;

/**
 * Game Mode - Interactive German sentence placement game
 * Uses dual-controller mechanics (mobile FPS-style) for word placement
 */

export class GameMode {
    /**
     * @param {Object} host  app services: { sentenceManager, levelSelector, redraw(),
     *   setView(view), updateSentenceList(), startChapter(level, category, opts),
     *   openReader(level, category), onStop() (optional: after stop()),
     *   showRecap(run) (optional: chapter-end recap on the play screen, chapterRecap.js) }
     */
    constructor(svg, wordManager, gridViewModel, host) {
        this.host = host;
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

        // Review mode: prefer sentences with past mistakes (progressStore)
        this.reviewMode = false;

        // Chapter recap (chapterRecap.js): finished sentences of the current story chapter
        // run ({level, category, results: ChapterRunSentence[]}), and "schwere Sätze
        // nochmal" ({level, category, ids}: play only these sentences, no narration)
        this.run = null;
        this.replay = null;

        // Play screen: the narration before the current story sentence, shown as the strip
        // above it (playScreen.js, storyStrip()); empty when the narration card showed it
        // (first sentence of a run), outside story chapters and in the Werkstatt
        this.storyLines = [];
        this.storySheetPause = null; // "mehr" sheet open: {elapsed} of the paused word timer

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

        // Attempt tracking (auto-place after MAX_WRONG_ATTEMPTS wrong attempts, see gameRules.js)
        this.currentWordAttempts = 0;

        // Wrong placements in the current sentence, recorded to progressStore on completion
        this.sentenceMistakes = emptyMistakes();
        this.sentenceMisses = new Map(); // manual item index → RunMiss (chapterRecap.js)
        this.bestSessionStreak = 0;

        // Play screen (playScreen.js): feedback bar of the last placement
        // ({tone, title, form, lines} from placementFeedback) and finished sentences this session
        this.feedback = null;
        this.sentencesCompleted = 0;

        // Waiting for user to continue to next sentence
        this.waitingForContinue = false;

        // Werkstatt: first tap shows felder view; second tap loads next sentence.
        // Play screen (E3): only a sentence with a felderLesson() opens the field model, on its
        // own after FELDER_AUTO_DELAY (felderTimer); other sentences go on with one tap
        this.pendingFelderReview = false;
        this.felderLesson = null; // {kind, hint, parts} of the solved sentence, or null
        this.felderTimer = null;

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
     * True on the full-screen play screen (body[data-screen="play"]): the HUD, case tray and
     * feedback are HTML there (playScreen.js) and the SVG shows only the grid.
     */
    isPlayScreen() {
        return document.body.dataset.screen === 'play';
    }

    /**
     * The play screen's viewBox: the grid plus the canvas margin left/right (placed
     * phrases with their verb can reach past the outer cells) and a small one top/bottom.
     */
    getBoardBounds() {
        const mx = this.getGridStartX();
        const my = 8;
        return {
            x: 0,
            y: this.getGridStartY() - my,
            width: 3 * this.gridViewModel.cellWidth + 2 * mx,
            height: 3 * this.gridViewModel.cellHeight + 2 * my,
        };
    }

    /** Select a case for the next placement, or clear it if it is already selected. */
    toggleCase(caseType) {
        if (this.selectedCase === caseType) {
            this.selectedCase = null;
        } else {
            this.selectedCase = caseType;
            if (typeof gameSounds !== 'undefined') gameSounds.select();
        }
        this.host.redraw();
    }

    /**
     * After a finished sentence (the tap on the grid or the play screen's continue button):
     * Werkstatt: first the Feldermodell review, then the next sentence. Play screen: the next
     * sentence (a lesson's review opens on its own, see showGameComplete).
     */
    continueAfterSentence() {
        if (!this.waitingForContinue) return;
        if (this.pendingFelderReview) this.openFelderReview();
        else this.loadRandomSentenceAndContinue();
    }

    /**
     * Show the solved sentence in the Feldermodell (game paused; "Weiter" / Enter goes on via
     * app.continuePlay). Also the play screen's "Satzbau" link and the lesson auto-switch.
     */
    openFelderReview() {
        this.cancelFelderTimer();
        if (!this.isActive || this.isPaused || !this.waitingForContinue) return;
        this.pendingFelderReview = false;
        this.pause();
        this.host.setView('felder');
        this.host.redraw();
    }

    cancelFelderTimer() {
        if (this.felderTimer !== null) clearTimeout(this.felderTimer);
        this.felderTimer = null;
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
            if (!this.isActive || isStoryCardOpen()) return;

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
                    this.host.redraw();
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
                this.host.redraw();
            } else if (key === 's') {
                // Toggle accusative
                this.selectedCase = this.selectedCase === 'akk' ? null : 'akk';
                this.host.redraw();
            } else if (key === 'd') {
                // Toggle dative
                this.selectedCase = this.selectedCase === 'dat' ? null : 'dat';
                this.host.redraw();
            } else if (key === 'f') {
                // Toggle genitive
                this.selectedCase = this.selectedCase === 'gen' ? null : 'gen';
                this.host.redraw();
            }
        };

        document.addEventListener('keydown', this.keyboardHandler);

        // Detect TTS word-boundary support (silent, inside this user gesture)
        // before the first fill-in-the-blank prompt needs it
        if (typeof gameSounds !== 'undefined') gameSounds.probeBoundary();

        this.startNewSentence();

        // Record the initial sentence as used
        this.usedSentenceIds.add(this.host.sentenceManager.currentSentenceId);

        this.showStoryIntro();
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
        this.sentenceMistakes = emptyMistakes();
        this.sentenceMisses = new Map();
        this.hideMistakeHint();
        this.feedback = null;
        this.waitingForContinue = false;
        this.pendingFelderReview = false;
        this.felderLesson = null;
        this.cancelFelderTimer();
        this.storyLines = []; // set again by showStoryIntro()

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
        this.hideMistakeHint();
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
        this.felderLesson = null;
        this.cancelFelderTimer();
        this.hideMistakeHint();
        hideStoryCard();
        // Drop any paused/in-flight fill-in-the-blank audio
        if (typeof gameSounds !== 'undefined') gameSounds.cancelPrompt();
        this.totalScore = 0; // Reset score so the next start() is fresh
        this.bestSessionStreak = 0;
        this.sentencesCompleted = 0;
        this.feedback = null;
        this.usedSentenceIds = new Set();
        this.stopTimerAnimation();
        this.wordStartTime = null;
        this.batchSentencesPlayed = 0;
        this.batchCurrentCategory = null;
        this.run = null;
        this.replay = null;

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
        if (this.host.onStop) this.host.onStop();
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
        ensureJuiceDefs(this.svg, this.gameGroup);

        // Draw empty grid
        this.drawEmptyGrid();

        // Draw revealed boxes/words (using pre-calculated gridview positions)
        this.drawPlacedItems();

        // Draw tick/cross feedback animation (if active)
        drawFeedbackAnimation(this.gameGroup, this.feedbackAnimation);

        // Werkstatt: case controllers and word bar in the SVG. The play screen has them
        // as HTML around the grid (playScreen.js, rendered by app.redrawAll).
        if (!this.isPlayScreen()) {
            this.drawControllers();
            this.overlayGroup = drawHud(this);
        }

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

        // Shared 3×3 layout + palette (grammaticalConfig.js). Imperative verbs (no subject)
        // go to IMPERATIV, matching the gridview.js positions.
        const cellData = GRID_CELLS;

        cellData.forEach(cell => {
            const x = startX + (cell.col - 1) * cellWidth;
            const y = startY + (cell.row - 1) * cellHeight;
            const isEmpty = !cell.label;

            // "Kontur" tile (docs/redesign-plan.md): near-transparent fill, faint outline
            // in the grammar color — the color carries the meaning, the tile stays quiet.
            const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            rect.setAttribute('x', x + 3);
            rect.setAttribute('y', y + 3);
            rect.setAttribute('width', cellWidth - 6);
            rect.setAttribute('height', cellHeight - 6);
            rect.setAttribute('rx', '14');
            rect.setAttribute('fill', isEmpty ? GM_UI.surface : cell.tint);
            rect.setAttribute('fill-opacity', isEmpty ? '0.7' : '0.6');
            rect.setAttribute('stroke', isEmpty ? GM_UI.border : cell.color);
            rect.setAttribute('stroke-width', '1.5');
            rect.setAttribute('stroke-opacity', isEmpty ? '1' : '0.4');
            rect.setAttribute('pointer-events', 'none');
            gridGroup.appendChild(rect);

            // Add cell label (in the cell's saturated color)
            if (cell.label) {
                const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                // "Versalien" label: small tracked capitals at the top of the tile,
                // so placed phrases in the middle don't collide with it.
                label.setAttribute('x', x + cellWidth / 2);
                // (SVG units: the board is scaled ~0.32 on a phone, so 30 ≈ 10 px there.)
                label.setAttribute('y', y + 46);
                label.setAttribute('text-anchor', 'middle');
                label.setAttribute('dominant-baseline', 'middle');
                label.setAttribute('fill', cell.ink);
                label.setAttribute('font-size', '30');
                label.setAttribute('font-weight', '600');
                label.setAttribute('font-family', "'Inter', sans-serif");
                label.setAttribute('letter-spacing', '4');
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
        // Literata for the German text comes from the .gm-placed CSS rule.
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
     * Draw full-screen overlay for "tap to continue"
     */
    drawContinueOverlay() {
        // Create a full-screen transparent overlay that captures all taps
        const overlay = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        // Generous extent: covers the canvas whatever the viewBox (the play screen crops it to the grid)
        overlay.setAttribute('x', -5000);
        overlay.setAttribute('y', -5000);
        overlay.setAttribute('width', 10000);
        overlay.setAttribute('height', 10000);
        overlay.setAttribute('fill', 'transparent');
        overlay.setAttribute('cursor', 'pointer');

        // Add tap handlers
        const handleTap = (e) => {
            e.preventDefault();
            e.stopPropagation();
            // Werkstatt: first tap Feldermodell review, second tap next sentence (play screen: next)
            this.continueAfterSentence();
        };

        overlay.addEventListener('click', handleTap);
        overlay.addEventListener('touchend', handleTap);

        this.gameGroup.appendChild(overlay);

        // No banner here: the completion card (headline + tap hint) lives in
        // the word-bar slot (drawHud in gameHud.js), leaving the completed grid fully
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
        // border; selected = warm tint + ink border (matches
        // the selection language used across the app, replacing the old gold)
        const isSelected = this.selectedCase === config.caseType;
        shape.setAttribute('fill', isSelected ? GM_UI.accentTint : GM_UI.white);
        shape.setAttribute('stroke', isSelected ? GM_UI.accent : GM_UI.muted);
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
            label.setAttribute('fill', isSelected ? GM_UI.accent : GM_UI.secondary);
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
            this.toggleCase(config.caseType);
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

        // Place the word at this cell (a new attempt replaces the previous hint)
        this.hideMistakeHint();
        this.placeWord(row, col, caseType);

        // Reset selected case after placement
        this.selectedCase = null;

        // Redraw to clear case selection highlight
        this.host.redraw();
    }

    /**
     * Place current item (a PhraseBox or a single Word) in selected cell.
     * Rules come from evaluatePlacement → PlacementOutcome (see js/types.js).
     * @param {number} row
     * @param {number} col
     * @param {?Case} caseType
     */
    placeWord(row, col, caseType) {
        if (this.currentIndex >= this.manualItems.length) {
            console.log('Game complete!');
            return;
        }

        const currentItem = this.manualItems[this.currentIndex];
        const itemToValidate = currentItem.type === 'box' ? currentItem.item.mainWord : currentItem.item;
        const autoPlaced = this.suppressStreak; // set by autoPlaceCurrentWord
        const before = this.words[this.getItemWordRange(currentItem)[0] - 1] || null;
        const cell = GRID_CELLS.find(c => c.row === row && c.col === col);

        console.log(`Placing ${currentItem.type}: ${this.getItemText(currentItem)} at row ${row}, col ${col}, case: ${caseType}`);

        const outcome = evaluatePlacement({
            word: itemToValidate, row, col, caseType,
            expectedCell: this.gridViewModel.getWordPosition(itemToValidate),
            attempts: this.currentWordAttempts,
            elapsedMs: this.timeChallengeMode && this.wordStartTime !== null
                ? Date.now() - this.wordStartTime : null,
        });
        this.currentWordAttempts = outcome.attempts;

        // Get the cell position for feedback display
        const startX = this.getGridStartX();
        const startY = this.getGridStartY();
        const cellX = startX + (col - 1) * this.gridViewModel.cellWidth;
        const cellY = startY + (row - 1) * this.gridViewModel.cellHeight;
        const feedbackX = cellX + this.gridViewModel.cellWidth / 2;
        const feedbackY = cellY + this.gridViewModel.cellHeight / 2;

        if (outcome.result.ok) {
            const points = outcome.points;
            // Timed placements float "+N" in the time color; otherwise ✓ in the success token
            const feedbackSymbol = outcome.timeColor ? `+${points}` : '✓';
            const feedbackColor = outcome.timeColor || GM_UI.success;

            this.currentSentenceScore += points;
            this.totalScore += points;
            this.feedback = placementFeedback({
                ok: true, word: itemToValidate, phrase: this.getItemText(currentItem), caseType,
                cellLabel: cell ? cell.label : null, preposition: before, auto: autoPlaced,
            });
            console.log('✓ Correct placement!', points, 'points');

            // --- Visual juice (display only, no effect on scoring/validation) ---
            this.displayStreak = this.suppressStreak ? 0 : this.displayStreak + 1;
            this.suppressStreak = false;
            this.bestSessionStreak = Math.max(this.bestSessionStreak, this.displayStreak);
            this.scoreAnim = { from: this.totalScore - points, to: this.totalScore, start: Date.now() };
            if (currentItem.type === 'box') {
                this.lastReveal = { boxIndex: currentItem.boxIndex, time: Date.now() };
            }

            // Show feedback
            this.showFeedback(feedbackSymbol, feedbackX, feedbackY, true, feedbackColor);

            // Confetti burst + floating points + score count-up (all self-cleaning)
            // Sound: the tile's own note (pitch encodes the grid position),
            // then German speech (placementSpeech in sound.js): by default
            // only the placed phrase, so every word is heard once while
            // placing and the whole sentence once at the end. With "Satz
            // aufbauen" on, the GROWING SENTENCE PREFIX instead (sentence
            // start through the placed phrase plus the auto-words it reveals).
            if (typeof gameSounds !== 'undefined') {
                gameSounds.correct(this.displayStreak, row, col);
                // Only when listening mode is off — in listening mode the
                // paused sentence audio resumes instead (see
                // updateCurrentWordDisplay), which speaks the placed word
                // with the sentence's own intonation
                if (!gameSounds.promptEnabled) {
                    const range = this.getItemWordRange(currentItem);
                    let endIdx = range[1];
                    while (endIdx + 1 < this.words.length && !this.isManualWord(this.words[endIdx + 1])) {
                        endIdx++;
                    }
                    const texts = this.words.map(w => w.text);
                    gameSounds.speak(placementSpeech({ texts, range, endIdx, buildUp: gameSounds.buildUpEnabled }));
                }
            }
            if (navigator.vibrate) navigator.vibrate(15); // subtle tactile confirm
            spawnConfetti(this.svg, feedbackX, feedbackY, 8, 90, () => this.isActive);
            if (!feedbackSymbol.startsWith('+')) {
                // Timer mode already floats "+N" as the feedback symbol itself
                spawnFloatingText(this.svg, `+${points}`, feedbackX, feedbackY - 50, feedbackColor, () => this.isActive);
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
            console.log('✗ Incorrect placement!', outcome.result);
            addMistake(this.sentenceMistakes, outcome.result);
            this.recordMiss(currentItem, itemToValidate, outcome.result, cell, caseType, before);

            // Visual only: reset streak display and shake the word pill
            this.displayStreak = 0;
            this.wrongShakeUntil = Date.now() + 350;
            if (typeof gameSounds !== 'undefined') gameSounds.wrong();
            if (navigator.vibrate) navigator.vibrate([30, 40, 30]); // distinct double-buzz

            // Show cross feedback (no score penalty, but don't advance)
            this.feedback = placementFeedback({
                ok: false, word: itemToValidate, phrase: this.getItemText(currentItem),
                preposition: before, result: outcome.result, attempts: outcome.attempts,
            });
            this.showFeedback('✗', feedbackX, feedbackY, false);
            // Werkstatt: toast; the play screen shows this.feedback in its feedback bar
            if (!this.isPlayScreen()) {
                this.showMistakeHint(explainMistake({
                    word: itemToValidate, result: outcome.result,
                    phrase: this.getItemText(currentItem), preposition: before,
                }));
            }

            // After MAX_WRONG_ATTEMPTS failed attempts, auto-place correctly
            if (outcome.autoPlace) {
                console.log('Auto-placing after 3 attempts...');
                setTimeout(() => {
                    this.autoPlaceCurrentWord();
                }, 800);
            }
        }
    }

    /**
     * Remember a wrong placement of the current phrase for the chapter recap: the first
     * wrong attempt (what was chosen) plus the right answer's German explanation.
     */
    recordMiss(item, word, result, cell, caseType, preposition) {
        let miss = this.sentenceMisses.get(this.currentIndex);
        if (!miss) {
            const exp = result.expectedCell;
            const expCell = exp ? GRID_CELLS.find(c => c.row === exp.row && c.col === exp.col) : null;
            const solution = placementFeedback({
                ok: true, auto: true, word, phrase: this.getItemText(item),
                caseType: result.expectedCase, cellLabel: expCell ? expCell.label : null, preposition,
            });
            const [start, end] = this.getItemWordRange(item);
            miss = {
                start, end, phrase: this.getItemText(item), key: expCell ? expCell.key : 'none',
                cellWrong: !result.cellOk, caseWrong: !result.caseOk,
                chosenCell: cell ? cell.label : null, chosenCase: caseType || null,
                expectedCell: expCell ? expCell.label : null, expectedCase: result.expectedCase,
                why: solution.lines[0] || '', attempts: 0,
            };
            this.sentenceMisses.set(this.currentIndex, miss);
        }
        miss.attempts++;
    }

    /** Add the finished sentence to the chapter run (story chapter or hard-sentence replay). */
    recordRun() {
        const sentence = this.host.sentenceManager.getCurrentSentence();
        if (!sentence) return;
        const chapter = this.replay || this.getStoryChapter();
        if (!chapter) return;
        if (!this.run || this.run.level !== chapter.level || this.run.category !== chapter.category) {
            this.run = { level: chapter.level, category: chapter.category, results: [] };
        }
        const record = {
            text: sentence.text,
            words: this.words.map(w => w.text),
            items: this.manualItems.length,
            misses: [...this.sentenceMisses.values()].sort((a, b) => a.start - b.start),
        };
        this.run.results = this.run.results.filter(r => r.text !== record.text).concat(record);
    }

    /**
     * Hand the finished run to the app's recap screen (play screen only).
     * @param {{level: string, category: string}} chapter  the chapter the run belongs to
     */
    finishRun(chapter) {
        const run = this.run || { level: chapter.level, category: chapter.category, results: [] };
        const replay = !!this.replay;
        this.run = null;
        this.host.showRecap({ ...run, replay });
    }

    /**
     * Show why a placement was wrong (lines from explainMistake) in a toast
     * above the grid. Stays until the next placement, sentence or ~6s.
     * @param {string[]} lines
     */
    showMistakeHint(lines) {
        this.hideMistakeHint();
        if (!lines.length) return;
        const el = document.createElement('div');
        el.id = 'gm-mistake-hint';
        el.setAttribute('role', 'status');
        lines.forEach(line => {
            const row = document.createElement('div');
            row.textContent = line;
            el.appendChild(row);
        });
        document.body.appendChild(el);
        this.mistakeHintTimer = setTimeout(() => this.hideMistakeHint(), 6000);
    }

    hideMistakeHint() {
        clearTimeout(this.mistakeHintTimer);
        const el = document.getElementById('gm-mistake-hint');
        if (el) el.remove();
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
            color: color || (isCorrect ? GM_UI.success : GM_UI.danger),
            startTime: Date.now()
        };

        // Redraw to show feedback
        this.host.redraw();

        // Animate the feedback smoothly between redraws (updates attributes
        // in place; ends automatically when feedbackAnimation clears)
        this.startFeedbackJuiceLoop();

        // Clear feedback after animation
        setTimeout(() => {
            this.feedbackAnimation = null;
            this.host.redraw();
        }, 600);
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
            updateFeedbackElement(this.svg, this.feedbackAnimation);
            this.feedbackLoopId = requestAnimationFrame(tick);
        };
        this.feedbackLoopId = requestAnimationFrame(tick);
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
            const el = this.svg.querySelector('#gm-score-text');
            const playEl = document.getElementById('play-score-value'); // play screen (playScreen.js)
            if (!this.scoreAnim || !this.isActive) {
                this.scoreLoopId = null;
                if (el && this.isActive) el.textContent = `${this.totalScore}/${this.targetScore}`;
                if (playEl && this.isActive) playEl.textContent = String(this.totalScore);
                return;
            }
            const shown = this.getDisplayedScore();
            if (el) el.textContent = `${shown}/${this.targetScore}`;
            if (playEl) playEl.textContent = String(shown);
            this.scoreLoopId = requestAnimationFrame(tick);
        };
        this.scoreLoopId = requestAnimationFrame(tick);
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
            fillEl.setAttribute('fill', getTimerColor(1 - remaining));

            // Gentle pulse when under 3s remain (visual only)
            const isLow = remaining < 0.3 && remaining > 0;
            const hasPulse = fillEl.getAttribute('class') === 'gm-timer-pulse';
            if (isLow && !hasPulse) {
                fillEl.setAttribute('class', 'gm-timer-pulse');
            } else if (!isLow && hasPulse) {
                fillEl.removeAttribute('class');
            }
        }

        if (this.wordStartTime && this.isPlayScreen()) {
            const remaining = Math.max(0, 1 - (Date.now() - this.wordStartTime) / 10000);
            updatePlayTimer(remaining, getTimerColor(1 - remaining));
        }

        // Update floating feedback animation in-place
        updateFeedbackElement(this.svg, this.feedbackAnimation);
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
     * Auto-place current word after MAX_WRONG_ATTEMPTS failed attempts
     */
    autoPlaceCurrentWord() {
        if (this.currentIndex >= this.manualItems.length) {
            return;
        }

        const currentItem = this.manualItems[this.currentIndex];
        const itemToValidate = currentItem.type === 'box' ? currentItem.item.mainWord : currentItem.item;

        const target = getAutoPlacement(itemToValidate, this.gridViewModel.getWordPosition(itemToValidate));
        if (!target) {
            console.error('Cannot auto-place: no expected position found');
            return;
        }

        // Place it correctly (this will trigger the success path)
        console.log(`Auto-placing at correct position: row ${target.row}, col ${target.col}, case: ${target.caseType}`);
        this.suppressStreak = true; // display only: auto-placed words don't count toward streak
        this.placeWord(target.row, target.col, target.caseType);
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
     * Persist the finished sentence's mistakes and the session's score/streak bests.
     */
    recordProgress() {
        const sentence = this.host.sentenceManager.getCurrentSentence();
        if (sentence) progressStore.recordSentence(sentenceKey(sentence), this.sentenceMistakes);
        progressStore.recordSession({ score: this.totalScore, streak: this.bestSessionStreak });
    }

    /**
     * Show game complete message
     */
    showGameComplete() {
        console.log('🎉 Sentence Complete! Sentence Score:', this.currentSentenceScore, 'Total Score:', this.totalScore);
        this.recordProgress();
        this.recordRun();
        this.sentencesCompleted++; // play screen progress bar (display only)

        // Check if player reached target score
        if (this.totalScore >= this.targetScore) {
            // Game fully complete!
            setTimeout(() => {
                // Exit game mode and show the completed gridview
                const finalScore = this.totalScore;
                this.host.setView('grid');
                this.stop();

                // Reset button to play icon
                const gameModeBtn = document.getElementById('game-mode-btn');
                if (gameModeBtn) {
                    gameModeBtn.textContent = '🎮';
                    gameModeBtn.title = 'Start Game Mode';
                }

                this.host.redraw();

                // Restyled celebration screen (replaces the old alert;
                // same flow: game already stopped, grid view shown behind)
                if (typeof gameSounds !== 'undefined') gameSounds.gameComplete();
                showFinalCelebration(finalScore);
            }, 1000);
        } else {
            this.waitingForContinue = true;
            if (this.isPlayScreen()) {
                // E3: the field model only when it teaches — then it opens on its own after
                // the sentence-complete moment (confetti + sentence audio)
                this.felderLesson = felderLesson(this.words);
                this.pendingFelderReview = false;
                if (this.felderLesson) {
                    this.felderTimer = setTimeout(() => {
                        this.felderTimer = null;
                        if (this.isPlayScreen() && !isStoryCardOpen()) this.openFelderReview();
                    }, FELDER_AUTO_DELAY);
                }
            } else {
                this.felderLesson = null;
                this.pendingFelderReview = true; // Werkstatt: always review
            }
            this.host.redraw();

            // Sentence-complete celebration: bigger confetti burst across the
            // grid, then the whole sentence read aloud once (the melody
            // resolved it; the speech consolidates it)
            if (typeof gameSounds !== 'undefined') {
                gameSounds.sentenceComplete();
                if (this.words && this.words.length > 0) {
                    const sentence = this.words.map(w => w.text).join(' ');
                    // Skip it only when the last placement already said the
                    // whole sentence ("Satz aufbauen" prefix, or the Hörübung
                    // audio playing out to the end). queue: waits for
                    // in-flight speech (the placed phrase) instead of cutting it off.
                    if (!gameSounds.sentenceAlreadySpoken(sentence)) {
                        setTimeout(() => gameSounds.speak(sentence, { queue: true }), 500);
                    }
                }
            }
            const cw = this.gridViewModel.cellWidth;
            const ch = this.gridViewModel.cellHeight;
            const gridCenterX = this.getGridStartX() + cw * 1.5;
            const gridCenterY = this.getGridStartY() + ch * 1.5;
            spawnConfetti(this.svg, gridCenterX, gridCenterY - ch * 0.8, 26, 240, () => this.isActive);
        }
    }

    /**
     * Load the next sentence (picked per the active mode) and continue the game
     */
    loadRandomSentenceAndContinue() {
        if (this.replay) {
            this.continueReplay();
            return;
        }
        const chapter = this.getStoryChapter();
        if (chapter) {
            this.continueStoryChapter(chapter);
            return;
        }

        const { sentenceManager, levelSelector } = this.host;
        let mode = 'random-in-category';
        const multi = this.multiCategoryMode && this.selectedLevels.length > 0;
        if (this.storyMode) mode = 'story';
        else if (this.reviewMode) mode = 'review';
        else if (multi) mode = 'multi-category';
        else if (levelSelector && levelSelector.currentLevel === 'custom') mode = 'custom';

        const picked = pickNextSentence({
            mode,
            sentences: sentenceManager.getAllSentences(),
            currentId: sentenceManager.currentSentenceId,
            usedIds: this.usedSentenceIds,
            level: levelSelector ? levelSelector.currentLevel : null,
            category: levelSelector ? levelSelector.currentCategory : null,
            // Review covers the selected levels only while multi-category is on
            selectedLevels: mode !== 'review' || multi ? this.selectedLevels : [],
            batchState: { played: this.batchSentencesPlayed, category: this.batchCurrentCategory },
            getProgress: s => progressStore.getSentence(sentenceKey(s)),
        });

        // Story mode without a category context fell back to random
        if (mode === 'story' && picked.mode !== 'story') this.storyMode = false;

        if (!picked.sentence) {
            console.error('No sentences available in current list');
            return;
        }

        this.usedSentenceIds = picked.usedIds;
        this.batchSentencesPlayed = picked.batchState.played;
        this.batchCurrentCategory = picked.batchState.category;

        sentenceManager.loadSentence(picked.sentence.id);
        this.startNewSentence();

        this.host.updateSentenceList();
        this.host.redraw();
        const activeItem = document.querySelector('.sentence-item.active');
        if (activeItem) activeItem.scrollIntoView({ block: 'nearest', behavior: 'smooth' });

        console.log(`Loaded next sentence (${picked.mode}):`, picked.sentence.text);
    }

    /** "Schwere Sätze nochmal": the next sentence of the replay list, or the recap after the last. */
    continueReplay() {
        const { sentenceManager } = this.host;
        const picked = pickNextSentence({
            mode: 'list', sentences: sentenceManager.getAllSentences(),
            currentId: sentenceManager.currentSentenceId, list: this.replay.ids,
        });
        if (!picked.sentence) {
            this.finishRun(this.replay);
            return;
        }
        sentenceManager.loadSentence(picked.sentence.id);
        this.startNewSentence();
        this.host.updateSentenceList();
        this.host.redraw();
    }

    // --- Story chapters (data/stories/, see storyNarration.js) ---

    /**
     * The story chapter being played, or null. Chapters play in order with
     * narration between sentences; review and multi-category mode keep their
     * own sentence choice.
     * @returns {?{level: string, category: string, cat: Object, data: Object}}
     */
    getStoryChapter() {
        if (this.reviewMode || this.multiCategoryMode || this.replay) return null;
        const { levelSelector } = this.host;
        if (!levelSelector) return null;
        const level = levelSelector.currentLevel;
        const category = levelSelector.currentCategory;
        const cat = LEVEL_CONTENT[level] && LEVEL_CONTENT[level].categories[category];
        if (!cat || !cat.story || cat.story.kind !== 'chapter') return null;
        const data = levelSelector.getLoadedData(level, category);
        if (!data || !data.beats) return null;
        const sentence = this.host.sentenceManager.getCurrentSentence();
        if (!sentence || sentence.level !== level || sentence.category !== category) return null;
        return { level, category, cat, data };
    }

    /**
     * Narration before the current sentence (if it is a story play beat). The card opens at
     * the start of a run (start(), app.startChapter) and before every sentence in the
     * Werkstatt; on the play screen later sentences show the strip above the sentence instead.
     * @param {{runStart?: boolean}} [opts]  false: next sentence of a running chapter
     */
    showStoryIntro({ runStart = true } = {}) {
        this.storyLines = [];
        const chapter = this.getStoryChapter();
        if (!chapter) return;
        const sentence = this.host.sentenceManager.getCurrentSentence();
        const segment = beatsBefore(chapter.data.beats, sentence.text);
        if (!segment) return;
        if (!runStart && this.isPlayScreen()) {
            this.storyLines = segment.lines;
            this.host.redraw();
            return;
        }
        const buttons = [{ label: 'Los geht\'s', icon: 'play', primary: true, onClick: () => this.closeStoryCard() }];
        // First card of the chapter: offer to read the whole chapter first
        if (chapter.data.sentences[0] === sentence.text) {
            buttons.unshift({ label: 'Erst lesen', icon: 'book',
                onClick: () => this.host.openReader(chapter.level, chapter.category) });
        }
        this.pauseForStoryCard();
        showStoryCard({
            heading: chapter.cat.label,
            lines: segment.lines,
            play: segment.play,
            buttons,
            onSpeak: texts => this.speakStoryLines(texts),
            glossary: chapter.data.glossary,
        });
    }

    /**
     * Silence listening-mode audio and the timer while a card is open.
     * @param {{resume?: boolean}} [opts]  resume: closeStoryCard() continues the word
     *   (timer from where it stopped, same attempts) instead of starting it over
     */
    pauseForStoryCard({ resume = false } = {}) {
        if (typeof gameSounds !== 'undefined') gameSounds.cancelPrompt();
        this.storySheetPause = resume
            ? { elapsed: this.wordStartTime ? Date.now() - this.wordStartTime : null } : null;
        this.stopTimerAnimation();
        this.wordStartTime = null;
    }

    closeStoryCard() {
        hideStoryCard();
        const pause = this.storySheetPause;
        this.storySheetPause = null;
        if (!this.isActive) return;
        if (pause) this.resumeCurrentWord(pause.elapsed);
        // Restarts the listening-mode prompt and the timer for the current word
        else this.updateCurrentWordDisplay();
        this.host.redraw();
    }

    /** After the "mehr" sheet: the word's timer goes on from `elapsed`, the Hörübung prompt replays. */
    resumeCurrentWord(elapsed) {
        if (this.waitingForContinue || this.currentIndex >= this.manualItems.length) return;
        if (typeof gameSounds !== 'undefined' && this.words && this.words.length > 0) {
            const blankIdx = this.getItemWordRange(this.manualItems[this.currentIndex])[0];
            gameSounds.promptSentence(this.words.map(w => w.text), blankIdx);
        }
        if (this.timeChallengeMode && elapsed !== null) {
            this.wordStartTime = Date.now() - elapsed;
            this.startTimerAnimation();
        }
    }

    /** "mehr" on the play-screen strip: all narration lines before the sentence, one "Zurück". */
    showStoryLinesSheet() {
        const chapter = this.getStoryChapter();
        if (!chapter || this.storyLines.length === 0 || isStoryCardOpen()) return;
        this.pauseForStoryCard({ resume: true });
        showStoryCard({
            heading: chapter.cat.label,
            lines: this.storyLines,
            buttons: [{ label: 'Zurück', primary: true, onClick: () => this.closeStoryCard() }],
            onSpeak: texts => this.speakStoryLines(texts),
            glossary: chapter.data.glossary,
        });
    }

    speakStoryLines(texts) {
        if (typeof gameSounds === 'undefined') return;
        texts.forEach((text, i) => gameSounds.speak(text, { queue: i > 0 }));
    }

    /** Next sentence of the chapter, or the chapter-end card after the last one. */
    continueStoryChapter(chapter) {
        const { sentenceManager } = this.host;
        const current = sentenceManager.getCurrentSentence();
        const nextText = nextPlayText(chapter.data.sentences, current.text);
        if (!nextText) {
            this.showChapterEnd(chapter);
            return;
        }
        const next = sentenceManager.findLibrarySentence(chapter.level, chapter.category, nextText);
        if (!next) {
            console.error('Story sentence not loaded:', nextText);
            return;
        }
        sentenceManager.loadSentence(next.id);
        this.startNewSentence();
        this.host.updateSentenceList();
        this.host.redraw();
        const activeItem = document.querySelector('.sentence-item.active');
        if (activeItem) activeItem.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        this.showStoryIntro({ runStart: false });
    }

    showChapterEnd(chapter) {
        const { level, category, cat, data } = chapter;
        const { levelSelector } = this.host;
        // Play screen: the story's closing lines (if any), then the recap screen
        if (this.isPlayScreen() && this.host.showRecap) {
            const closing = beatsAfterLast(data.beats);
            if (closing.length === 0) {
                this.finishRun(chapter);
                return;
            }
            this.pauseForStoryCard();
            showStoryCard({
                heading: cat.label,
                lines: closing,
                buttons: [{ label: 'Weiter', icon: 'next', primary: true, onClick: () => {
                    hideStoryCard();
                    this.finishRun(chapter);
                } }],
                onSpeak: texts => this.speakStoryLines(texts),
                glossary: data.glossary,
            });
            return;
        }
        const order = chapterOrder(level);
        const nextKey = order[order.indexOf(category) + 1] || null;
        const complete = levelSelector.isChapterComplete(level, category);
        const buttons = [];
        if (nextKey && levelSelector.isUnlocked(level, nextKey)) {
            buttons.push({ label: 'Nächstes Kapitel', icon: 'next', primary: true,
                onClick: () => this.host.startChapter(level, nextKey) });
        }
        buttons.push({ label: 'Übung', primary: buttons.length === 0 && complete,
            onClick: () => this.host.startChapter(level, `${category}_uebung`) });
        buttons.push({ label: 'Nochmal', primary: buttons.length === 1 && !complete,
            onClick: () => this.host.startChapter(level, category, { fromStart: true }) });
        this.pauseForStoryCard();
        showStoryCard({
            heading: cat.label,
            banner: complete ? 'Kapitel geschafft!'
                : 'Ende des Kapitels. Spiel alle Sätze, dann öffnet sich das nächste Kapitel.',
            lines: beatsAfterLast(data.beats),
            buttons,
            onSpeak: texts => this.speakStoryLines(texts),
            glossary: data.glossary,
        });
        levelSelector.refresh();
    }
}
