/**
 * Main Application
 * Coordinates all components and handles application flow
 */
class DeutschApp {
    constructor() {
        this.svg = document.getElementById('canvas');

        // Grid configuration for snapping
        this.gridConfig = {
            horizontalSpacing: 80,
            verticalSpacing: 80,
            snapToGrid: true
        };

        this.wordManager = new WordManager(this.gridConfig);
        this.sentenceManager = new SentenceManager(this.wordManager);
        this.feldermodellRenderer = new FeldermodellRenderer(this.svg);
        this.renderer = new Renderer(this.svg, this.wordManager);
        this.uiController = new UIController(this.wordManager, () => this.redrawAll(), this.gridConfig);
    }

    /**
     * Initialize the application
     */
    init() {
        this.uiController.init(this.svg);
        this.setupToolbarButtons();
        this.setupSentencePanel();
        this.loadSentences();
        this.redrawAll();
        this.uiController.updatePropertiesPanel();
    }

    /**
     * Setup toolbar button event listeners
     */
    setupToolbarButtons() {
        // Add word buttons
        const addButtons = document.querySelectorAll('[data-word-type]');
        addButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const wordType = btn.dataset.wordType;
                this.addWord(wordType);
            });
        });

        // Clear button
        const clearBtn = document.getElementById('clear-btn');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                this.clearCanvas();
            });
        }

        // Spacing controls
        const horizontalSpacingInput = document.getElementById('horizontal-spacing');
        const verticalSpacingInput = document.getElementById('vertical-spacing');

        if (horizontalSpacingInput) {
            horizontalSpacingInput.addEventListener('change', (e) => {
                this.gridConfig.horizontalSpacing = parseInt(e.target.value);
            });
        }

        if (verticalSpacingInput) {
            verticalSpacingInput.addEventListener('change', (e) => {
                this.gridConfig.verticalSpacing = parseInt(e.target.value);
            });
        }
    }

    /**
     * Setup sentence panel event listeners
     */
    setupSentencePanel() {
        const addSentenceBtn = document.getElementById('add-sentence-btn');
        const sentenceInput = document.getElementById('sentence-input');

        if (addSentenceBtn && sentenceInput) {
            addSentenceBtn.addEventListener('click', () => {
                const text = sentenceInput.value.trim();
                if (text) {
                    this.addSentence(text);
                    sentenceInput.value = '';
                }
            });

            // Also allow Enter key to add sentence
            sentenceInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && e.ctrlKey) {
                    const text = sentenceInput.value.trim();
                    if (text) {
                        this.addSentence(text);
                        sentenceInput.value = '';
                    }
                }
            });
        }

        // Regenerate button
        const regenerateBtn = document.getElementById('regenerate-btn');
        if (regenerateBtn) {
            regenerateBtn.addEventListener('click', async () => {
                if (this.sentenceManager.currentSentenceId) {
                    try {
                        await this.sentenceManager.autoConfigureCurrentSentence();
                        this.redrawAll();
                        this.saveSentences();
                    } catch (error) {
                        console.error('Regenerate error:', error);
                        alert('Failed to regenerate. Make sure the backend server is running.');
                    }
                } else {
                    alert('No sentence selected. Please add or select a sentence first.');
                }
            });
        }
    }

    /**
     * Add a new sentence
     */
    async addSentence(text) {
        // Save current sentence before switching
        if (this.sentenceManager.currentSentenceId) {
            this.sentenceManager.saveCurrentSentence();
        }

        const sentence = this.sentenceManager.addSentence(text);
        if (sentence) {
            this.sentenceManager.loadSentence(sentence.id);
            this.updateSentenceList();
            this.redrawAll();
            this.saveSentences();

            // Auto-configure the sentence silently
            try {
                await this.sentenceManager.autoConfigureCurrentSentence();
                this.redrawAll();
            } catch (error) {
                console.error('Auto-configure error:', error);
                // Silently fail - don't show error to user
            }
        }
    }

    /**
     * Load a sentence from the list
     */
    loadSentenceFromList(sentenceId) {
        // Save current sentence before switching
        if (this.sentenceManager.currentSentenceId) {
            this.sentenceManager.saveCurrentSentence();
            this.saveSentences();
        }

        this.sentenceManager.loadSentence(sentenceId);
        this.updateSentenceList();
        this.redrawAll();
        this.uiController.updatePropertiesPanel();
    }

    /**
     * Edit a sentence
     */
    editSentenceFromList(sentenceId, event) {
        event.stopPropagation();

        const sentence = this.sentenceManager.sentences.find(s => s.id === sentenceId);
        if (!sentence) return;

        const newText = prompt('Edit sentence:', sentence.text);
        if (newText && newText.trim() !== '') {
            // Save current sentence if it's active
            if (this.sentenceManager.currentSentenceId === sentenceId) {
                this.sentenceManager.saveCurrentSentence();
            }

            // Edit the sentence
            this.sentenceManager.editSentence(sentenceId, newText);

            // Reload if it's the current sentence
            if (this.sentenceManager.currentSentenceId === sentenceId) {
                this.sentenceManager.loadSentence(sentenceId);
                this.redrawAll();
            }

            this.updateSentenceList();
            this.saveSentences();
        }
    }

    /**
     * Delete a sentence
     */
    deleteSentenceFromList(sentenceId, event) {
        event.stopPropagation();
        if (confirm('Delete this sentence?')) {
            this.sentenceManager.deleteSentence(sentenceId);
            this.updateSentenceList();
            this.redrawAll();
            this.saveSentences();
        }
    }

    /**
     * Update the sentence list UI
     */
    updateSentenceList() {
        const listContent = document.getElementById('sentence-list-content');
        if (!listContent) return;

        const sentences = this.sentenceManager.getAllSentences();

        if (sentences.length === 0) {
            listContent.innerHTML = '<div class="no-sentences">No sentences yet. Type one above and click "Add Sentence".</div>';
            return;
        }

        // Reverse to show most recent first
        listContent.innerHTML = sentences.slice().reverse().map(sentence => {
            const isActive = sentence.id === this.sentenceManager.currentSentenceId;
            return `
                <div class="sentence-item ${isActive ? 'active' : ''}" data-sentence-id="${sentence.id}">
                    <div class="sentence-item-text">${sentence.text}</div>
                    <div class="sentence-item-actions">
                        <button class="sentence-item-edit" data-sentence-id="${sentence.id}">Edit</button>
                        <button class="sentence-item-delete" data-sentence-id="${sentence.id}">Delete</button>
                    </div>
                </div>
            `;
        }).join('');

        // Attach event listeners to sentence items
        const sentenceItems = listContent.querySelectorAll('.sentence-item');
        sentenceItems.forEach(item => {
            const sentenceId = parseInt(item.dataset.sentenceId);
            item.addEventListener('click', (e) => {
                if (!e.target.classList.contains('sentence-item-delete') &&
                    !e.target.classList.contains('sentence-item-edit')) {
                    this.loadSentenceFromList(sentenceId);
                }
            });
        });

        // Attach event listeners to edit buttons
        const editButtons = listContent.querySelectorAll('.sentence-item-edit');
        editButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const sentenceId = parseInt(btn.dataset.sentenceId);
                this.editSentenceFromList(sentenceId, e);
            });
        });

        // Attach event listeners to delete buttons
        const deleteButtons = listContent.querySelectorAll('.sentence-item-delete');
        deleteButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const sentenceId = parseInt(btn.dataset.sentenceId);
                this.deleteSentenceFromList(sentenceId, e);
            });
        });
    }

    /**
     * Save sentences to localStorage
     */
    saveSentences() {
        this.sentenceManager.save();
    }

    /**
     * Load sentences from localStorage
     */
    loadSentences() {
        this.sentenceManager.load();
        this.updateSentenceList();
    }

    /**
     * Add a new word
     */
    addWord(type) {
        this.wordManager.addWord(type);
        this.redrawAll();
    }

    /**
     * Clear the canvas
     */
    clearCanvas() {
        if (confirm('Are you sure you want to clear all words from the current canvas?')) {
            // If we have a current sentence, save it before clearing
            if (this.sentenceManager.currentSentenceId) {
                this.sentenceManager.saveCurrentSentence();
                this.saveSentences();
            }

            this.wordManager.clearAll();
            this.sentenceManager.newBlankSentence();
            this.updateSentenceList();
            this.uiController.updatePropertiesPanel();
            this.redrawAll();
        }
    }

    /**
     * Calculate the required canvas size based on word positions
     */
    calculateCanvasSize() {
        const words = this.wordManager.getAllWords();
        if (words.length === 0) {
            return { width: 1200, height: 800 }; // Default size
        }

        let maxX = 0;
        let maxY = 0;

        words.forEach(word => {
            // Add word width (50) and some padding (100)
            maxX = Math.max(maxX, word.x + 150);
            // Add word height (50) and some padding (100)
            maxY = Math.max(maxY, word.y + 150);
        });

        // Ensure minimum size
        return {
            width: Math.max(1200, maxX),
            height: Math.max(800, maxY)
        };
    }

    /**
     * Redraw all elements on the canvas
     */
    redrawAll() {
        // Clear SVG
        this.svg.innerHTML = '';

        // Calculate and set canvas size for scrolling
        const canvasSize = this.calculateCanvasSize();
        this.svg.setAttribute('width', canvasSize.width);
        this.svg.setAttribute('height', canvasSize.height);

        // Draw Feldermodell zones (both Hauptsatz and Nebensatz)
        this.feldermodellRenderer.draw(this.wordManager);

        // Draw connections
        this.renderer.drawConnections();

        // Draw words
        this.renderer.drawAllWords(
            (word) => this.uiController.handleWordClick(word),
            (e, word) => this.uiController.handleDragStart(e, word)
        );

        // Auto-save current sentence after redrawing
        if (this.sentenceManager && this.sentenceManager.currentSentenceId) {
            this.sentenceManager.saveCurrentSentence();
            // Debounce the localStorage save to avoid too frequent writes
            clearTimeout(this.saveTimeout);
            this.saveTimeout = setTimeout(() => {
                this.saveSentences();
            }, 500);
        }
    }

    /**
     * Save current state (legacy - now auto-saves)
     */
    save() {
        this.saveSentences();
        alert('Saved successfully!');
    }

    /**
     * Load saved state (legacy - now auto-loads)
     */
    load() {
        this.loadSentences();
        this.redrawAll();
        alert('Loaded successfully!');
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.app = new DeutschApp();
    window.app.init();
});
