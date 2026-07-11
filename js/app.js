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

        // Zoom and pan configuration - separate state for each view
        this.minZoom = 0.5;
        this.maxZoom = 3.0;
        this.zoomStep = 0.25;

        // Separate pan and zoom state for each view
        this.viewState = {
            felder: {
                zoomLevel: 1.0,
                panX: 0,
                panY: 0
            },
            grid: {
                zoomLevel: 1.0,
                panX: 0,
                panY: 0
            },
            game: {
                zoomLevel: 1.0,
                panX: 0,
                panY: 0
            }
        };

        this.wordManager = new WordManager(this.gridConfig);
        this.sentenceManager = new SentenceManager(this.wordManager);
        this.feldermodellRenderer = new FeldermodellRenderer(this.svg);
        this.gridViewModel = new GridViewModel(this.svg);
        this.gameMode = new GameMode(this.svg, this.wordManager, this.gridViewModel);
        this.renderer = new Renderer(this.svg, this.wordManager);
        this.uiController = new UIController(this.wordManager, () => this.redrawAll(), this.gridConfig);
        this.levelSelector = new LevelSelector(LEVEL_CONTENT, {
            onSelect:           (sel) => this.handleLibrarySelect(sel),
            getCachedSentence:  (level, category, text) => this.sentenceManager.findLibrarySentence(level, category, text),
            getUserSentences:   () => this.sentenceManager.sentences.filter(s => !s.source),
            onEdit:             (id, e) => this.editSentenceFromList(id, e),
            onDelete:           (id, e) => this.deleteSentenceFromList(id, e),
            getCurrentSentenceId: () => this.sentenceManager.currentSentenceId,
            onLibraryLoad:      (level, category, data) => this.handleLibraryLoad(level, category, data)
        });

        // View state: 'felder', 'grid', or 'game'
        this.currentView = 'felder';
    }

    /**
     * Initialize the application
     */
    init() {
        this.uiController.init(this.svg);
        this.setupToolbarButtons();
        this.setupSentencePanel();
        this.setupViewToggle();
        this.setupGameMode();
        this.setupResizeListener();
        this.setupZoomControls();
        this.setupSidebarTabs();
        this.setupKeyboardShortcuts();
        this.loadSentences();
        this.levelSelector.init();
        this.redrawAll();
        this.uiController.updatePropertiesPanel();
    }

    /**
     * Get current view's zoom and pan state
     */
    getCurrentViewState() {
        return this.viewState[this.currentView];
    }

    /**
     * Desktop right-sidebar tabs (Properties | Settings).
     * On mobile the sidebar dissolves (display: contents) and the existing
     * toggle tabs drive the panels, so these classes have no effect there.
     */
    setupSidebarTabs() {
        document.querySelectorAll('.sidebar-tab').forEach(tab => {
            tab.addEventListener('click', () => this.showSidebarTab(tab.dataset.panel));
        });
    }

    showSidebarTab(panelId) {
        document.querySelectorAll('.sidebar-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.panel === panelId);
        });
        ['properties-panel', 'settings-panel'].forEach(id => {
            const panel = document.getElementById(id);
            if (panel) panel.classList.toggle('sidebar-active', id === panelId);
        });
    }

    /**
     * Keyboard shortcuts. Enter advances the game's continue states:
     * - game view, sentence complete → go to the Felder review
     * - Felder review → next sentence (same as the "Next sentence" button)
     * Ignored while typing in inputs or when a button has focus (the button
     * already handles Enter natively — avoids double-advancing).
     */
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            if (e.key !== 'Enter' || e.isComposing) return;
            const tag = e.target.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' ||
                tag === 'BUTTON' || e.target.isContentEditable) return;
            if (!this.gameMode || !this.gameMode.waitingForContinue) return;

            if (this.currentView === 'game' && this.gameMode.isActive && !this.gameMode.isPaused) {
                e.preventDefault();
                if (this.gameMode.pendingFelderReview) {
                    // Mirror of the game-view tap: show the Felder review
                    this.gameMode.pendingFelderReview = false;
                    this.gameMode.pause();
                    this.currentView = 'felder';
                    this.redrawAll();
                } else {
                    this.gameMode.loadRandomSentenceAndContinue();
                }
            } else if (this.currentView === 'felder' && this.gameMode.isPaused) {
                // Mirror of the "Next sentence" button
                e.preventDefault();
                this.gameMode.resume();
                this.currentView = 'game';
                this.gameMode.loadRandomSentenceAndContinue();
            }
        });
    }

    /**
     * Setup view toggle button
     */
    setupViewToggle() {
        const viewToggleBtn = document.getElementById('view-toggle-btn');

        if (viewToggleBtn) {
            viewToggleBtn.addEventListener('click', () => {
                if (this.currentView === 'game') {
                    // Pause game and switch to felder for corrections (score preserved)
                    this.gameMode.pause();
                    this.currentView = 'felder';
                } else if (this.gameMode.isPaused) {
                    // Return to the paused game
                    this.gameMode.resume();
                    this.currentView = 'game';
                } else {
                    // Normal toggle between felder and grid
                    this.currentView = this.currentView === 'felder' ? 'grid' : 'felder';
                }
                this.redrawAll();
            });
        }
    }

    /**
     * Setup game mode button
     */
    setupGameMode() {
        const gameModeBtn = document.getElementById('game-mode-btn');

        if (gameModeBtn) {
            gameModeBtn.addEventListener('click', () => {
                if (this.gameMode.isActive) {
                    // Exit game mode — stop() resets score for next fresh session
                    this.currentView = 'grid';
                    this.gameMode.stop();
                    gameModeBtn.textContent = '🎮';
                    gameModeBtn.title = 'Start Game Mode';
                    this.redrawAll();
                } else {
                    // Check if there's a current sentence with words
                    if (!this.sentenceManager.currentSentenceId) {
                        alert('Please add or select a sentence first before starting the game!');
                        return;
                    }

                    const words = this.wordManager.getAllWords();
                    if (words.length === 0) {
                        alert('The current sentence has no words. Please add a sentence with words first!');
                        return;
                    }

                    // Switch to game view and start fresh
                    this.currentView = 'game';
                    this.gameMode.start();
                    gameModeBtn.textContent = '✕';
                    gameModeBtn.title = 'Exit Game Mode';
                    this.redrawAll();
                }
            });
        }

        const timeChallengeToggle = document.getElementById('time-challenge-toggle');
        if (timeChallengeToggle) {
            timeChallengeToggle.addEventListener('change', () => {
                this.gameMode.timeChallengeMode = timeChallengeToggle.checked;
                if (this.gameMode.isActive) {
                    if (timeChallengeToggle.checked) {
                        this.gameMode.wordStartTime = Date.now();
                        this.gameMode.startTimerAnimation();
                    } else {
                        this.gameMode.stopTimerAnimation();
                        this.gameMode.wordStartTime = null;
                        this.redrawAll();
                    }
                }
            });
        }

        const soundToggle = document.getElementById('sound-toggle');
        if (soundToggle && typeof gameSounds !== 'undefined') {
            soundToggle.checked = gameSounds.enabled;
            soundToggle.addEventListener('change', () => {
                gameSounds.setEnabled(soundToggle.checked);
                if (soundToggle.checked) gameSounds.select(); // audible confirmation
            });
        }

        const speechToggle = document.getElementById('speech-toggle');
        if (speechToggle && typeof gameSounds !== 'undefined') {
            speechToggle.checked = gameSounds.speechEnabled;
            speechToggle.addEventListener('change', () => {
                gameSounds.setSpeechEnabled(speechToggle.checked);
                if (speechToggle.checked) gameSounds.speak('Los geht\'s!'); // audible confirmation
            });
        }

        const listenToggle = document.getElementById('listen-toggle');
        if (listenToggle && typeof gameSounds !== 'undefined') {
            listenToggle.checked = gameSounds.promptEnabled;
            listenToggle.addEventListener('change', () => {
                gameSounds.setPromptEnabled(listenToggle.checked);
            });
        }

        const multiCategoryToggle = document.getElementById('multi-category-toggle');
        const multiCategoryLevels = document.getElementById('multi-category-levels');
        const multiCategoryA1 = document.getElementById('multi-category-a1');
        const multiCategoryA2 = document.getElementById('multi-category-a2');
        const multiCategoryB1 = document.getElementById('multi-category-b1');
        const storyModeToggle = document.getElementById('story-mode-toggle');

        if (multiCategoryToggle) {
            const updateSelectedLevels = () => {
                const levels = [];
                if (multiCategoryA1 && multiCategoryA1.checked) levels.push('A1');
                if (multiCategoryA2 && multiCategoryA2.checked) levels.push('A2');
                if (multiCategoryB1 && multiCategoryB1.checked) levels.push('B1');
                this.gameMode.selectedLevels = levels;
                this.bulkLoadLibraryForLevels(levels);
            };

            multiCategoryToggle.addEventListener('change', () => {
                this.gameMode.multiCategoryMode = multiCategoryToggle.checked;
                if (multiCategoryLevels) {
                    multiCategoryLevels.style.display = multiCategoryToggle.checked ? 'block' : 'none';
                }
                if (multiCategoryToggle.checked) {
                    if (multiCategoryA1) multiCategoryA1.checked = true;
                    if (multiCategoryA2) multiCategoryA2.checked = true;
                    if (multiCategoryB1) multiCategoryB1.checked = true;
                    this.gameMode.selectedLevels = ['A1', 'A2', 'B1'];
                    this.gameMode.batchSentencesPlayed = 0;
                    this.gameMode.batchCurrentCategory = null;
                    // Mutually exclusive with story mode
                    if (storyModeToggle) storyModeToggle.checked = false;
                    this.gameMode.storyMode = false;
                    this.bulkLoadLibraryForLevels(['A1', 'A2', 'B1']);
                }
            });

            if (multiCategoryA1) multiCategoryA1.addEventListener('change', updateSelectedLevels);
            if (multiCategoryA2) multiCategoryA2.addEventListener('change', updateSelectedLevels);
            if (multiCategoryB1) multiCategoryB1.addEventListener('change', updateSelectedLevels);
        }

        if (storyModeToggle) {
            storyModeToggle.addEventListener('change', () => {
                this.gameMode.storyMode = storyModeToggle.checked;
                // Mutually exclusive with multi-category mode
                if (storyModeToggle.checked && multiCategoryToggle && multiCategoryToggle.checked) {
                    multiCategoryToggle.checked = false;
                    this.gameMode.multiCategoryMode = false;
                    if (multiCategoryLevels) multiCategoryLevels.style.display = 'none';
                }
            });
        }

        const maxPointsInput = document.getElementById('max-points-input');
        if (maxPointsInput) {
            maxPointsInput.addEventListener('change', () => {
                const val = parseInt(maxPointsInput.value, 10);
                if (!isNaN(val) && val >= 50) {
                    this.gameMode.targetScore = val;
                } else {
                    maxPointsInput.value = this.gameMode.targetScore;
                }
            });
        }
    }

    /**
     * Setup zoom controls (pinch-to-zoom)
     */
    setupZoomControls() {
        // Setup pinch-to-zoom gesture support
        this.setupPinchZoom();
    }

    /**
     * Setup pinch-to-zoom gesture support and touch panning for touch devices
     */
    setupPinchZoom() {
        const canvasContainer = document.querySelector('.canvas-container');
        if (!canvasContainer) return;

        let initialDistance = 0;
        let initialZoom = 1.0;
        let lastTouchX = 0;
        let lastTouchY = 0;
        let isPanning = false;

        const getDistance = (touches) => {
            const dx = touches[0].clientX - touches[1].clientX;
            const dy = touches[0].clientY - touches[1].clientY;
            return Math.sqrt(dx * dx + dy * dy);
        };

        canvasContainer.addEventListener('touchstart', (e) => {
            if (e.touches.length === 2) {
                // Two-finger pinch to zoom
                e.preventDefault();
                initialDistance = getDistance(e.touches);
                initialZoom = this.getCurrentViewState().zoomLevel;
                isPanning = false;
            } else if (e.touches.length === 1) {
                // Single finger - prepare for panning
                lastTouchX = e.touches[0].clientX;
                lastTouchY = e.touches[0].clientY;
                isPanning = true;
            }
        }, { passive: false });

        canvasContainer.addEventListener('touchmove', (e) => {
            const currentState = this.getCurrentViewState();

            if (e.touches.length === 2) {
                // Two-finger pinch to zoom
                e.preventDefault();
                const currentDistance = getDistance(e.touches);
                const scale = currentDistance / initialDistance;

                // Calculate new zoom level
                const newZoom = initialZoom * scale;

                // Clamp to min/max zoom
                currentState.zoomLevel = Math.max(this.minZoom, Math.min(this.maxZoom, newZoom));

                // Reset pan when zooming back to 1.0
                if (Math.abs(currentState.zoomLevel - 1.0) < 0.05) {
                    currentState.panX = 0;
                    currentState.panY = 0;
                }

                this.redrawAll();
                isPanning = false;
            } else if (e.touches.length === 1 && isPanning) {
                // Single finger - pan the canvas
                e.preventDefault();
                const touch = e.touches[0];
                const deltaX = touch.clientX - lastTouchX;
                const deltaY = touch.clientY - lastTouchY;

                // Apply pan offset with responsive scaling
                // Multiply by factor for more responsive feel (adjust based on view)
                const panSpeed = this.currentView === 'grid' ? 2.5 : 1.0;
                currentState.panX -= (deltaX / currentState.zoomLevel) * panSpeed;
                currentState.panY -= (deltaY / currentState.zoomLevel) * panSpeed;

                lastTouchX = touch.clientX;
                lastTouchY = touch.clientY;

                this.redrawAll();
            }
        }, { passive: false });

        canvasContainer.addEventListener('touchend', (e) => {
            if (e.touches.length < 2) {
                initialDistance = 0;
            }
            if (e.touches.length === 0) {
                isPanning = false;
            }
        });
    }

    /**
     * Setup window resize listener for responsive canvas
     */
    setupResizeListener() {
        let resizeTimeout;
        window.addEventListener('resize', () => {
            // Debounce resize events
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                this.redrawAll();
            }, 250);
        });
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
                if (e.key === 'Enter') {
                    e.preventDefault();
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

        // Check Grammar button
        const checkGrammarBtn = document.getElementById('check-grammar-btn');
        if (checkGrammarBtn) {
            checkGrammarBtn.addEventListener('click', async () => {
                const text = sentenceInput.value.trim();
                if (text) {
                    await this.checkGrammar(text);
                } else if (this.sentenceManager.currentSentenceId) {
                    const currentSentence = this.sentenceManager.sentences.find(
                        s => s.id === this.sentenceManager.currentSentenceId
                    );
                    if (currentSentence) {
                        await this.checkGrammar(currentSentence.text);
                    }
                } else {
                    alert('Please type a sentence or select one from the list.');
                }
            });
        }

        // Export Sentences button
        const exportBtn = document.getElementById('export-sentences-btn');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => {
                this.exportSentences();
            });
        }

        // Import Sentences button
        const importBtn = document.getElementById('import-sentences-btn');
        const fileInput = document.getElementById('import-file-input');
        if (importBtn && fileInput) {
            importBtn.addEventListener('click', () => {
                fileInput.click();
            });

            fileInput.addEventListener('change', async (e) => {
                const file = e.target.files[0];
                if (file) {
                    await this.importSentences(file);
                    // Reset file input
                    fileInput.value = '';
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

            // Auto-check grammar after adding sentence
            try {
                await this.checkGrammar(text);
            } catch (error) {
                console.error('Auto grammar check error:', error);
                // Silently fail - don't show error to user
            }
        }
    }

    /**
     * Check grammar using the backend API
     */
    async checkGrammar(text) {
        const resultsContainer = document.getElementById('grammar-results');
        const resultsContent = document.getElementById('grammar-results-content');

        if (!resultsContainer || !resultsContent) return;

        // Show loading state
        resultsContainer.style.display = 'block';
        resultsContent.innerHTML = '<div class="grammar-loading">Checking grammar...</div>';

        try {
            // Auto-detect backend URL
            const backendUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
                ? 'http://localhost:8000'
                : 'https://deutsche-satzstruktur.onrender.com';

            const response = await fetch(`${backendUrl}/check-grammar`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ text })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

            // Display results
            if (data.error_count === 0) {
                resultsContent.innerHTML = `
                    <div class="grammar-success">
                        <span style="color: green; font-weight: bold;">✓</span> No grammar errors found!
                    </div>
                `;
            } else {
                const errorsHtml = data.errors.map((error, index) => {
                    const suggestionsHtml = error.suggestions.length > 0
                        ? `<div class="grammar-suggestions">
                             Suggestions: ${error.suggestions.map(s => `<span class="suggestion">${s}</span>`).join(', ')}
                           </div>`
                        : '';

                    return `
                        <div class="grammar-error">
                            <div class="grammar-error-header">
                                <span class="grammar-error-number">${index + 1}.</span>
                                <span class="grammar-error-message">${error.message}</span>
                            </div>
                            <div class="grammar-error-context">"${error.context}"</div>
                            ${suggestionsHtml}
                            <div class="grammar-error-meta">
                                Category: ${error.category} | Rule: ${error.rule_id}
                            </div>
                        </div>
                    `;
                }).join('');

                resultsContent.innerHTML = `
                    <div class="grammar-summary">
                        Found ${data.error_count} potential issue${data.error_count > 1 ? 's' : ''}:
                    </div>
                    ${errorsHtml}
                `;
            }
        } catch (error) {
            console.error('Grammar check error:', error);
            resultsContent.innerHTML = `
                <div class="grammar-error-message">
                    Failed to check grammar. Make sure the backend server is running.
                    <br><small>Error: ${error.message}</small>
                </div>
            `;
        }
    }

    /**
     * Export all sentences to a JSON file
     */
    exportSentences() {
        if (this.sentenceManager.sentences.length === 0) {
            alert('No sentences to export. Add some sentences first.');
            return;
        }

        try {
            this.sentenceManager.exportSentences();
            alert(`Successfully exported ${this.sentenceManager.sentences.length} sentence${this.sentenceManager.sentences.length !== 1 ? 's' : ''}!`);
        } catch (error) {
            console.error('Export error:', error);
            alert('Failed to export sentences. Check the console for details.');
        }
    }

    /**
     * Import sentences from a JSON file
     */
    async importSentences(file) {
        // Ask user if they want to replace or merge
        const mode = confirm(
            'Click OK to MERGE with existing sentences, or Cancel to REPLACE all existing sentences.\n\n' +
            'MERGE: Add imported sentences to your current list\n' +
            'REPLACE: Delete all current sentences and import new ones'
        ) ? 'merge' : 'replace';

        if (mode === 'replace' && this.sentenceManager.sentences.length > 0) {
            const confirmReplace = confirm(
                `Are you sure you want to DELETE all ${this.sentenceManager.sentences.length} existing sentence${this.sentenceManager.sentences.length !== 1 ? 's' : ''}?\n\n` +
                'This action cannot be undone!'
            );
            if (!confirmReplace) {
                return;
            }
        }

        const result = await this.sentenceManager.importSentences(file, mode);

        if (result.success) {
            this.updateSentenceList();
            this.redrawAll();
            alert(result.message);
        } else {
            alert(`Import failed: ${result.message}`);
        }
    }

    /**
     * Dispatch a selection from the library panel
     */
    handleLibrarySelect(selection) {
        if (selection.type === 'custom') {
            this.loadSentenceFromList(selection.sentenceId);
        } else {
            this.loadLibrarySentence(selection.level, selection.category, selection.text);
        }
    }

    /**
     * Called when a library JSON is fetched for a category.
     * Bulk-loads pre-analyzed sentences into sentenceManager, then persists and refreshes the UI.
     */
    handleLibraryLoad(level, category, data) {
        this.sentenceManager.bulkLoadLibraryCategory(level, category, data);
        this.saveSentences();
        this.levelSelector.refresh();
    }

    async bulkLoadLibraryForLevels(levels) {
        const fetches = [];
        for (const level of levels) {
            const levelData = LEVEL_CONTENT[level];
            if (!levelData) continue;
            for (const [cat, catData] of Object.entries(levelData.categories)) {
                const libraryFile = catData.file.replace('data/levels/', 'data/library/');
                fetches.push(
                    fetch(libraryFile)
                        .then(r => r.ok ? r.json() : null)
                        .then(data => { if (data) this.sentenceManager.bulkLoadLibraryCategory(level, cat, data); })
                        .catch(() => {})
                );
            }
        }
        await Promise.all(fetches);
        this.saveSentences();
    }

    /**
     * Load a library sentence: use cached version if available, otherwise parse fresh
     */
    async loadLibrarySentence(level, category, text) {
        if (this.sentenceManager.currentSentenceId) {
            this.sentenceManager.saveCurrentSentence();
            this.saveSentences();
        }

        const cached = this.sentenceManager.findLibrarySentence(level, category, text);
        if (cached) {
            this.sentenceManager.loadSentence(cached.id);
            this.updateSentenceList();
            this.redrawAll();
            return;
        }

        const sentence = this.sentenceManager.addSentence(text, { source: 'library', level, category });
        this.sentenceManager.loadSentence(sentence.id);
        this.updateSentenceList();
        this.redrawAll();
        this.saveSentences();

        try {
            await this.sentenceManager.autoConfigureCurrentSentence();
            this.redrawAll();
            this.saveSentences();
            this.levelSelector.refresh();
        } catch (error) {
            console.error('Library sentence auto-configure error:', error);
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
        if (this.levelSelector) this.levelSelector.refresh();
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
        const isMobile = window.innerWidth < 768;
        const container = document.querySelector('.canvas-container');

        // Get actual container dimensions
        const containerWidth = container ? container.clientWidth : (isMobile ? 400 : 1200);
        const containerHeight = container ? container.clientHeight : (isMobile ? 500 : 800);

        // Grid view and Game view have fixed dimensions
        if (this.currentView === 'grid' || this.currentView === 'game') {
            return {
                width: Math.max(containerWidth, 850),
                height: Math.max(containerHeight, 640),
                viewBoxX: 0,
                viewBoxY: 0
            };
        }

        if (words.length === 0) {
            // Empty canvas - use actual container size
            return {
                width: containerWidth,
                height: containerHeight,
                viewBoxX: 0,
                viewBoxY: 0
            };
        }

        // Find the bounding box of all words
        let minX = Infinity, minY = Infinity;
        let maxX = -Infinity, maxY = -Infinity;

        words.forEach(word => {
            // Word dimensions are approximately 50x50
            minX = Math.min(minX, word.x - 25);
            minY = Math.min(minY, word.y - 25);
            maxX = Math.max(maxX, word.x + 75);
            maxY = Math.max(maxY, word.y + 75);
        });

        // Add padding around content
        const padding = isMobile ? 50 : 100;
        const contentWidth = maxX - minX + (padding * 2);
        const contentHeight = maxY - minY + (padding * 2);

        // Calculate viewBox origin (top-left corner with padding)
        const viewBoxX = Math.max(0, minX - padding);
        const viewBoxY = Math.max(0, minY - padding);

        if (isMobile) {
            // Mobile: use container size, but ensure content fits
            return {
                width: Math.max(containerWidth, contentWidth),
                height: Math.max(containerHeight, contentHeight),
                viewBoxX: viewBoxX,
                viewBoxY: viewBoxY
            };
        } else {
            // Desktop: use container size or content size, whichever is larger
            return {
                width: Math.max(containerWidth, contentWidth, 1200),
                height: Math.max(containerHeight, contentHeight, 800),
                viewBoxX: 0,
                viewBoxY: 0
            };
        }
    }

    /**
     * Redraw all elements on the canvas
     */
    redrawAll() {
        // Sidebar tab follows word selection: switch back to Settings when
        // the selection is cleared (deselect click, delete, clear). Only the
        // transition is handled so manual tab clicks aren't overridden.
        const selectedNow = this.wordManager.selectedWord;
        if (this.lastSelectedWord && !selectedNow) {
            this.showSidebarTab('settings-panel');
        }
        this.lastSelectedWord = selectedNow;

        // Clear SVG
        this.svg.innerHTML = '';

        // Calculate and set canvas size
        const canvasSize = this.calculateCanvasSize();

        // Check if we're on mobile (viewport width < 768px)
        const isMobile = window.innerWidth < 768;

        // Get current view's zoom and pan state
        const currentState = this.getCurrentViewState();

        // Both Grid and Felder views now support zoom and pan
        if (this.currentView === 'grid' || this.currentView === 'game') {
            // Grid/Game view: Fixed content size with zoom and pan
            // Mobile height fits the taller grid: 160 + 3*460 + 30 + 120
            // controllers = 1690, plus margin
            // Mobile width trimmed to the actual content extent (grid ends at
            // x=1100 + margin) so the scene scales up larger on small screens
            const gridWidth = isMobile ? 1170 : 1250;
            const gridHeight = isMobile ? 1720 : 950;

            // Apply zoom to viewBox dimensions
            const zoomedWidth = gridWidth / currentState.zoomLevel;
            const zoomedHeight = gridHeight / currentState.zoomLevel;

            // Center the zoomed viewBox
            const zoomOffsetX = (gridWidth - zoomedWidth) / 2;
            const zoomOffsetY = (gridHeight - zoomedHeight) / 2;

            // Apply pan offset for touch scrolling
            const viewBoxX = zoomOffsetX + currentState.panX;
            const viewBoxY = zoomOffsetY + currentState.panY;

            this.svg.setAttribute('viewBox', `${viewBoxX} ${viewBoxY} ${zoomedWidth} ${zoomedHeight}`);
            this.svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
            if (isMobile) {
                // Mobile: remove width/height for responsive scaling
                // (canvas container scrolls; taller mobile layout expects it)
                this.svg.removeAttribute('width');
                this.svg.removeAttribute('height');
            } else {
                // Desktop: pin the SVG to the container size so the whole
                // grid/game scales to FIT (preserveAspectRatio meet) instead
                // of deriving its height from the viewBox aspect ratio and
                // overflowing the container (which hid the controllers)
                this.svg.setAttribute('width', canvasSize.width);
                this.svg.setAttribute('height', canvasSize.height);
            }
        } else {
            // Felder view uses zoom and pan
            // Apply zoom to viewBox dimensions
            const zoomedWidth = canvasSize.width / currentState.zoomLevel;
            const zoomedHeight = canvasSize.height / currentState.zoomLevel;

            // Center the zoomed viewBox
            const zoomOffsetX = (canvasSize.width - zoomedWidth) / 2;
            const zoomOffsetY = (canvasSize.height - zoomedHeight) / 2;

            // Apply pan offset for touch scrolling
            const viewBoxX = canvasSize.viewBoxX + zoomOffsetX + currentState.panX;
            const viewBoxY = canvasSize.viewBoxY + zoomOffsetY + currentState.panY;

            if (isMobile) {
                // On mobile: Use viewBox for responsive scaling with zoom
                this.svg.setAttribute('viewBox', `${viewBoxX} ${viewBoxY} ${zoomedWidth} ${zoomedHeight}`);
                this.svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
                // Remove fixed width/height to allow responsive sizing
                this.svg.removeAttribute('width');
                this.svg.removeAttribute('height');
            } else {
                // On desktop: Use viewBox with zoom (allows zoom without scrolling issues)
                this.svg.setAttribute('viewBox', `${viewBoxX} ${viewBoxY} ${zoomedWidth} ${zoomedHeight}`);
                this.svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
                this.svg.setAttribute('width', canvasSize.width);
                this.svg.setAttribute('height', canvasSize.height);
            }
        }

        // Remove the felder-review hint pill when not in the review state
        const felderHintEl = document.getElementById('gm-felder-hint');
        const inFelderReview = this.currentView === 'felder' &&
            this.gameMode && this.gameMode.isPaused && this.gameMode.waitingForContinue;
        if (felderHintEl && !inFelderReview) felderHintEl.remove();

        // Draw view based on current view state
        if (this.currentView === 'felder') {
            // Draw Feldermodell zones (both Hauptsatz and Nebensatz)
            this.feldermodellRenderer.draw(this.wordManager);

            // Draw connections
            this.renderer.drawConnections();

            // Draw words (clicking a word focuses the Properties tab on desktop)
            this.renderer.drawAllWords(
                (word) => {
                    this.uiController.handleWordClick(word);
                    this.showSidebarTab('properties-panel');
                },
                (e, word) => this.uiController.handleDragStart(e, word)
            );

            // If game paused for felder review, show a "Next sentence" button
            // at the bottom. No full-screen overlay: the canvas stays fully
            // interactive so words can be selected and corrected before
            // continuing. (Button removed by the next redraw when the review
            // state ends.)
            if (this.gameMode && this.gameMode.isPaused && this.gameMode.waitingForContinue) {
                if (!document.getElementById('gm-felder-hint')) {
                    const hint = document.createElement('button');
                    hint.type = 'button';
                    hint.id = 'gm-felder-hint';
                    hint.className = 'gm-felder-hint';
                    hint.textContent = 'Next sentence →';
                    hint.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        this.gameMode.resume();
                        this.currentView = 'game';
                        this.gameMode.loadRandomSentenceAndContinue();
                    });
                    const container = document.querySelector('.canvas-container');
                    if (container) container.appendChild(hint);
                }
            }
        } else if (this.currentView === 'grid') {
            // Draw Grid view
            this.gridViewModel.draw(this.wordManager);
        } else if (this.currentView === 'game') {
            // Draw Game view
            this.gameMode.draw();
        }

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

    // Setup mobile toggle functionality
    setupMobileToggles();
});

/**
 * Setup mobile panel toggle functionality
 */
function setupMobileToggles() {
    // Get all tab elements
    const toggleSentenceBtn = document.getElementById('toggle-sentence-panel');
    const sentencePanel = document.getElementById('sentence-panel');
    const toggleSettingsBtn = document.getElementById('toggle-settings-panel');
    const settingsPanel = document.getElementById('settings-panel');
    const togglePropertiesBtn = document.getElementById('toggle-properties-panel');
    const propertiesPanel = document.getElementById('properties-panel');

    // Tab behavior for Sentence, Settings, and Properties panels
    if (toggleSentenceBtn && sentencePanel && toggleSettingsBtn && settingsPanel && togglePropertiesBtn && propertiesPanel) {
        toggleSentenceBtn.addEventListener('click', () => {
            // Toggle sentence panel
            const isActive = sentencePanel.classList.contains('active');
            const mainContent = document.querySelector('.main-content');

            if (isActive) {
                // If clicking the active tab, close it
                sentencePanel.classList.remove('active');
                toggleSentenceBtn.classList.remove('active');
                // Remove panel-open class since no panel is active
                mainContent?.classList.remove('panel-open');
            } else {
                // Activate sentence panel, deactivate others
                sentencePanel.classList.add('active');
                toggleSentenceBtn.classList.add('active');
                settingsPanel.classList.remove('active');
                toggleSettingsBtn.classList.remove('active');
                propertiesPanel.classList.remove('active');
                togglePropertiesBtn.classList.remove('active');
                // Add panel-open class
                mainContent?.classList.add('panel-open');
            }

            // Recalculate canvas size after panel state changes
            if (window.app) {
                window.app.redrawAll();
            }
        });

        toggleSettingsBtn.addEventListener('click', () => {
            // Toggle settings panel
            const isActive = settingsPanel.classList.contains('active');
            const mainContent = document.querySelector('.main-content');

            if (isActive) {
                // If clicking the active tab, close it
                settingsPanel.classList.remove('active');
                toggleSettingsBtn.classList.remove('active');
                // Remove panel-open class since no panel is active
                mainContent?.classList.remove('panel-open');
            } else {
                // Activate settings panel, deactivate others
                settingsPanel.classList.add('active');
                toggleSettingsBtn.classList.add('active');
                sentencePanel.classList.remove('active');
                toggleSentenceBtn.classList.remove('active');
                propertiesPanel.classList.remove('active');
                togglePropertiesBtn.classList.remove('active');
                // Add panel-open class
                mainContent?.classList.add('panel-open');
            }

            // Recalculate canvas size after panel state changes
            if (window.app) {
                window.app.redrawAll();
            }
        });

        togglePropertiesBtn.addEventListener('click', () => {
            // Toggle properties panel
            const isActive = propertiesPanel.classList.contains('active');
            const mainContent = document.querySelector('.main-content');

            if (isActive) {
                // If clicking the active tab, close it
                propertiesPanel.classList.remove('active');
                togglePropertiesBtn.classList.remove('active');
                // Remove panel-open class since no panel is active
                mainContent?.classList.remove('panel-open');
            } else {
                // Check if a word is selected before opening
                if (!window.app?.wordManager?.selectedWord) {
                    // No word selected - don't open the panel
                    return;
                }

                // Activate properties panel, deactivate others
                propertiesPanel.classList.add('active');
                togglePropertiesBtn.classList.add('active');
                sentencePanel.classList.remove('active');
                toggleSentenceBtn.classList.remove('active');
                settingsPanel.classList.remove('active');
                toggleSettingsBtn.classList.remove('active');
                // Add panel-open class
                mainContent?.classList.add('panel-open');
            }

            // Recalculate canvas size after panel state changes
            if (window.app) {
                window.app.redrawAll();
            }
        });
    }

    // Toggle Legend Modal
    const toggleLegendBtn = document.getElementById('toggle-legend');
    const legendModal = document.getElementById('legend-modal');
    const legendModalClose = document.getElementById('legend-modal-close');

    if (toggleLegendBtn && legendModal) {
        // Open legend modal
        toggleLegendBtn.addEventListener('click', () => {
            legendModal.style.display = 'flex';
        });

        // Close modal when clicking the X button
        if (legendModalClose) {
            legendModalClose.addEventListener('click', () => {
                legendModal.style.display = 'none';
            });
        }

        // Close modal when clicking outside (on overlay)
        legendModal.addEventListener('click', (e) => {
            if (e.target === legendModal) {
                legendModal.style.display = 'none';
            }
        });
    }
}
