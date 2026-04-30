/**
 * UIController - Handles all UI interactions
 */
class UIController {
    constructor(wordManager, onRedraw, gridConfig) {
        this.wordManager = wordManager;
        this.onRedraw = onRedraw;
        this.gridConfig = gridConfig || { horizontalSpacing: 80, verticalSpacing: 80, snapToGrid: true };
        this.draggedElement = null;
        this.offset = { x: 0, y: 0 };
        this.svg = null;
        this.isDragging = false;
        this.dragStartPos = { x: 0, y: 0 };
    }

    /**
     * Initialize UI
     */
    init(svgElement) {
        this.svg = svgElement;

        // Canvas click to deselect
        this.svg.addEventListener('click', () => {
            this.wordManager.deselectWord();
            this.updatePropertiesPanel();
            this.onRedraw();
        });
    }

    /**
     * Handle word click (selection)
     */
    handleWordClick(word) {
        this.wordManager.selectWord(word);
        this.updatePropertiesPanel();
        this.onRedraw();
    }

    /**
     * Handle drag start
     */
    handleDragStart(e, word) {
        if (e.button !== 0) return; // Only left mouse button

        this.draggedElement = e.currentTarget;
        this.isDragging = false; // Not dragging until mouse moves
        this.dragStartPos = { x: e.clientX, y: e.clientY };

        const rect = this.svg.getBoundingClientRect();
        this.offset.x = e.clientX - rect.left - word.x;
        this.offset.y = e.clientY - rect.top - word.y;

        document.addEventListener('mousemove', this.handleDrag);
        document.addEventListener('mouseup', this.handleDragEnd);

        e.preventDefault();
        e.stopPropagation();
    }

    /**
     * Snap a value to the nearest grid position
     */
    snapToGrid(value, gridSize) {
        return Math.round(value / gridSize) * gridSize;
    }

    /**
     * Handle drag
     */
    handleDrag = (e) => {
        if (!this.draggedElement) return;

        // Check if mouse has moved enough to be considered a drag
        const moveDistance = Math.sqrt(
            Math.pow(e.clientX - this.dragStartPos.x, 2) +
            Math.pow(e.clientY - this.dragStartPos.y, 2)
        );

        if (moveDistance > 3) {
            this.isDragging = true;
        }

        if (!this.isDragging) return; // Don't drag until mouse moves

        const wordId = parseInt(this.draggedElement.dataset.wordId);
        const word = this.wordManager.getWord(wordId);

        const rect = this.svg.getBoundingClientRect();
        let x = Math.max(0, e.clientX - rect.left - this.offset.x);
        let y = Math.max(0, e.clientY - rect.top - this.offset.y);

        // Apply grid snapping if enabled
        if (this.gridConfig.snapToGrid) {
            x = this.snapToGrid(x, this.gridConfig.horizontalSpacing);
            y = this.snapToGrid(y, this.gridConfig.verticalSpacing);
        }

        word.x = x;
        word.y = y;

        this.onRedraw();
    }

    /**
     * Handle drag end
     */
    handleDragEnd = () => {
        // Removed automatic flow direction update on drag
        this.draggedElement = null;
        this.isDragging = false;
        document.removeEventListener('mousemove', this.handleDrag);
        document.removeEventListener('mouseup', this.handleDragEnd);
    }

    /**
     * Apply vertical flow and alignment from conjunction onwards
     */
    applyVerticalFlowFromConjunction(wordId) {
        const words = this.wordManager.getAllWords();
        const conjunctionIndex = words.findIndex(w => w.id === wordId);

        if (conjunctionIndex === -1) return;

        const conjunction = words[conjunctionIndex];

        // Set conjunction to "down" flow direction
        conjunction.flowDirection = 'down';

        // Conjunction stays in horizontal position (keep its current x)
        // Use conjunction's x position for vertical alignment of following words
        const alignX = conjunction.x;

        // Set all following words to vertical flow and align them below conjunction
        for (let i = conjunctionIndex + 1; i < words.length; i++) {
            words[i].flowDirection = 'down';
            words[i].x = alignX; // Align vertically with conjunction

            // Position vertically below previous word
            // First word after conjunction - TWO blocks down to avoid Feldermodell overlap
            if (i === conjunctionIndex + 1) {
                words[i].y = conjunction.y + (2 * this.gridConfig.verticalSpacing);
            } else {
                // Following words - position one block below previous word
                words[i].y = words[i - 1].y + this.gridConfig.verticalSpacing;
            }
        }
    }

    /**
     * Update properties panel
     */
    updatePropertiesPanel() {
        const container = document.getElementById('properties-content');
        const selectedWord = this.wordManager.selectedWord;

        if (!selectedWord) {
            container.innerHTML = '<div class="no-selection">Click on a word to edit its properties</div>';
            return;
        }

        container.innerHTML = `
            <h3>Word Properties</h3>

            <div class="prop-section">
                <label class="prop-label">Text:</label>
                <input type="text" class="prop-input" value="${selectedWord.text}"
                       id="word-text-input">
            </div>

            <div class="prop-section">
                <label class="prop-label">Type:</label>
                <select id="word-type-select" class="prop-input">
                    <option value="subject" ${selectedWord.type === 'subject' ? 'selected' : ''}>Subject (Nominative)</option>
                    <option value="verb" ${selectedWord.type === 'verb' ? 'selected' : ''}>Verb</option>
                    <option value="object" ${selectedWord.type === 'object' ? 'selected' : ''}>Object (Generic)</option>
                    <option value="object-akk" ${selectedWord.type === 'object-akk' ? 'selected' : ''}>Object (Accusative)</option>
                    <option value="object-dat" ${selectedWord.type === 'object-dat' ? 'selected' : ''}>Object (Dative)</option>
                    <option value="object-gen" ${selectedWord.type === 'object-gen' ? 'selected' : ''}>Object (Genitive)</option>
                    <option value="adjective" ${selectedWord.type === 'adjective' ? 'selected' : ''}>Adjective</option>
                    <option value="modal" ${selectedWord.type === 'modal' ? 'selected' : ''}>Modal/Verb2</option>
                    <option value="conjunction" ${selectedWord.type === 'conjunction' ? 'selected' : ''}>Subordinating Conjunction (Nebensatz)</option>
                    <option value="coord-conjunction" ${selectedWord.type === 'coord-conjunction' ? 'selected' : ''}>Coordinating Conjunction (und, aber, etc.)</option>
                    <option value="preposition" ${selectedWord.type === 'preposition' ? 'selected' : ''}>Preposition</option>
                    <option value="other" ${selectedWord.type === 'other' ? 'selected' : ''}>Other</option>
                </select>
            </div>

            <div class="prop-section">
                <label class="prop-label">Gender:</label>
                <div class="prop-buttons">
                    <button class="prop-btn ${selectedWord.gender === 'none' ? 'active' : ''}"
                            data-property="gender" data-value="none">None</button>
                    <button class="prop-btn ${selectedWord.gender === 'm' ? 'active' : ''}"
                            data-property="gender" data-value="m">♂ Mask.</button>
                    <button class="prop-btn ${selectedWord.gender === 'f' ? 'active' : ''}"
                            data-property="gender" data-value="f">♀ Fem.</button>
                    <button class="prop-btn ${selectedWord.gender === 'n' ? 'active' : ''}"
                            data-property="gender" data-value="n">⚲ Neut.</button>
                </div>
            </div>

            <div class="prop-section">
                <label class="prop-label">Number:</label>
                <div class="prop-buttons">
                    <button class="prop-btn ${selectedWord.number === 'sg' ? 'active' : ''}"
                            data-property="number" data-value="sg">Singular</button>
                    <button class="prop-btn ${selectedWord.number === 'pl' ? 'active' : ''}"
                            data-property="number" data-value="pl">Plural</button>
                </div>
            </div>

            <div class="prop-section">
                <label class="prop-label">Case:</label>
                <div class="prop-buttons">
                    <button class="prop-btn ${selectedWord.case === 'nom' ? 'active' : ''}"
                            data-property="case" data-value="nom">Nom</button>
                    <button class="prop-btn ${selectedWord.case === 'akk' ? 'active' : ''}"
                            data-property="case" data-value="akk">Akk</button>
                    <button class="prop-btn ${selectedWord.case === 'dat' ? 'active' : ''}"
                            data-property="case" data-value="dat">Dat</button>
                    <button class="prop-btn ${selectedWord.case === 'gen' ? 'active' : ''}"
                            data-property="case" data-value="gen">Gen</button>
                </div>
            </div>

            <div class="prop-section">
                <label class="prop-label">Flow Direction:</label>
                <button class="prop-btn prop-btn-flow ${selectedWord.flowDirection === 'right' ? 'active' : ''}"
                        data-property="flowDirection" data-value="right">→ Right (Hauptsatz)</button>
                <button class="prop-btn prop-btn-flow ${selectedWord.flowDirection === 'down' ? 'active' : ''}"
                        data-property="flowDirection" data-value="down">↓ Down (Nebensatz)</button>
            </div>

            ${this.getPrepositionCaseUI(selectedWord)}

            ${this.getConjugationUI(selectedWord)}

            <button class="delete-btn" id="delete-word-btn">Delete Word</button>
        `;

        // Attach event listeners
        this.attachPropertyListeners();
    }

    /**
     * Generate preposition case UI (only shown for prepositions)
     */
    getPrepositionCaseUI(word) {
        if (word.type !== 'preposition') {
            return '';
        }

        // Auto-detect preposition case from the word text
        const prepCase = this.wordManager.getPrepositionCase(word.text);
        const caseLabels = {
            'akk': 'Accusative',
            'dat': 'Dative',
            'gen': 'Genitive',
            'wechsel': 'Wechsel (Two-way)'
        };

        return `
            <div class="prop-section">
                <label class="prop-label">Preposition Type:</label>
                <div class="prop-info" style="padding: 8px; background: #ecf0f1; border-radius: 4px; font-weight: bold;">
                    ${caseLabels[prepCase] || 'Unknown'}
                </div>
                <div style="font-size: 11px; color: #7f8c8d; margin-top: 4px;">
                    Auto-detected based on preposition text
                </div>
            </div>
        `;
    }

    /**
     * Generate conjugation UI for all word types
     */
    getConjugationUI(word) {
        if (!word.conjugation) {
            word.conjugation = {
                pronoun: 'none'
            };
        }

        const conj = word.conjugation;
        const pronounColors = this.wordManager.pronounColors;

        return `
            <div class="prop-section conj-section">
                <h4 class="conj-header">Conjugation / Pronoun Color</h4>

                <label class="prop-label">Pronoun:</label>
                <div class="conj-pronoun-grid">
                    <button class="conj-pronoun-btn ${conj.pronoun === 'none' ? 'active' : ''}"
                            data-conj-pronoun="none"
                            style="background: ${pronounColors['none']};">None</button>
                    <button class="conj-pronoun-btn ${conj.pronoun === 'ich' ? 'active' : ''}"
                            data-conj-pronoun="ich"
                            style="background: ${pronounColors['ich']};">ich</button>
                    <button class="conj-pronoun-btn ${conj.pronoun === 'du' ? 'active' : ''}"
                            data-conj-pronoun="du"
                            style="background: ${pronounColors['du']};">du</button>
                    <button class="conj-pronoun-btn ${conj.pronoun === 'er' ? 'active' : ''}"
                            data-conj-pronoun="er"
                            style="background: ${pronounColors['er']};">er (♂)</button>
                    <button class="conj-pronoun-btn ${conj.pronoun === 'sie_fem' ? 'active' : ''}"
                            data-conj-pronoun="sie_fem"
                            style="background: ${pronounColors['sie_fem']};">sie (♀)</button>
                    <button class="conj-pronoun-btn ${conj.pronoun === 'es' ? 'active' : ''}"
                            data-conj-pronoun="es"
                            style="background: ${pronounColors['es']};">es (⚲)</button>
                    <button class="conj-pronoun-btn ${conj.pronoun === 'wir' ? 'active' : ''}"
                            data-conj-pronoun="wir"
                            style="background: ${pronounColors['wir']};">wir</button>
                    <button class="conj-pronoun-btn ${conj.pronoun === 'ihr' ? 'active' : ''}"
                            data-conj-pronoun="ihr"
                            style="background: ${pronounColors['ihr']};">ihr</button>
                    <button class="conj-pronoun-btn ${conj.pronoun === 'sie' ? 'active' : ''}"
                            data-conj-pronoun="sie"
                            style="background: ${pronounColors['sie']};">sie/Sie (pl.)</button>
                </div>
            </div>
        `;
    }

    /**
     * Attach event listeners to property controls
     */
    attachPropertyListeners() {
        const selectedWord = this.wordManager.selectedWord;
        if (!selectedWord) return;

        // Text input
        const textInput = document.getElementById('word-text-input');
        if (textInput) {
            textInput.addEventListener('change', (e) => {
                this.wordManager.updateWordProperty(selectedWord.id, 'text', e.target.value);
                this.onRedraw();
            });
        }

        // Type dropdown
        const typeSelect = document.getElementById('word-type-select');
        if (typeSelect) {
            typeSelect.addEventListener('change', (e) => {
                const newType = e.target.value;
                this.wordManager.updateWordProperty(selectedWord.id, 'type', newType);

                // If changed to conjunction, set this word and all following to vertical flow
                if (newType === 'conjunction') {
                    this.applyVerticalFlowFromConjunction(selectedWord.id);
                }

                this.updatePropertiesPanel();
                this.onRedraw();
            });
        }

        // Property buttons
        const propButtons = document.querySelectorAll('[data-property]');
        propButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const property = btn.dataset.property;
                const value = btn.dataset.value;
                this.wordManager.updateWordProperty(selectedWord.id, property, value);

                // Mutual exclusion: if gender is set to non-none, set conjugation to none
                if (property === 'gender' && value !== 'none') {
                    if (selectedWord.conjugation) {
                        selectedWord.conjugation.pronoun = 'none';
                    }
                }

                this.updatePropertiesPanel();
                this.onRedraw();
            });
        });

        // Delete button
        const deleteBtn = document.getElementById('delete-word-btn');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', () => {
                this.wordManager.deleteWord(selectedWord.id);
                this.updatePropertiesPanel();
                this.onRedraw();
            });
        }

        // Conjugation controls (for all word types)
        this.attachConjugationListeners(selectedWord);
    }

    /**
     * Attach event listeners for conjugation controls
     */
    attachConjugationListeners(word) {
        // Pronoun buttons
        const pronounButtons = document.querySelectorAll('[data-conj-pronoun]');
        pronounButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const pronoun = btn.dataset.conjPronoun;
                this.wordManager.updateVerbPronoun(word.id, pronoun);

                // Mutual exclusion: if conjugation is set to non-none, set gender to none
                if (pronoun !== 'none') {
                    this.wordManager.updateWordProperty(word.id, 'gender', 'none');
                }

                this.updatePropertiesPanel();
                this.onRedraw();
            });
        });
    }
}
