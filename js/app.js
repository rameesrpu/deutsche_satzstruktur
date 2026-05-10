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

        // Zoom configuration
        this.zoomLevel = 1.0;
        this.minZoom = 0.5;
        this.maxZoom = 3.0;
        this.zoomStep = 0.25;

        // Pan configuration for touch scrolling
        this.panX = 0;
        this.panY = 0;

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
        this.setupResizeListener();
        this.setupZoomControls();
        this.loadSentences();
        this.redrawAll();
        this.uiController.updatePropertiesPanel();
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
                initialZoom = this.zoomLevel;
                isPanning = false;
            } else if (e.touches.length === 1) {
                // Single finger - prepare for panning
                lastTouchX = e.touches[0].clientX;
                lastTouchY = e.touches[0].clientY;
                isPanning = true;
            }
        }, { passive: false });

        canvasContainer.addEventListener('touchmove', (e) => {
            if (e.touches.length === 2) {
                // Two-finger pinch to zoom
                e.preventDefault();
                const currentDistance = getDistance(e.touches);
                const scale = currentDistance / initialDistance;

                // Calculate new zoom level
                const newZoom = initialZoom * scale;

                // Clamp to min/max zoom
                this.zoomLevel = Math.max(this.minZoom, Math.min(this.maxZoom, newZoom));

                // Reset pan when zooming back to 1.0
                if (Math.abs(this.zoomLevel - 1.0) < 0.05) {
                    this.panX = 0;
                    this.panY = 0;
                }

                this.redrawAll();
                isPanning = false;
            } else if (e.touches.length === 1 && isPanning) {
                // Single finger - pan the canvas
                e.preventDefault();
                const touch = e.touches[0];
                const deltaX = touch.clientX - lastTouchX;
                const deltaY = touch.clientY - lastTouchY;

                // Apply pan offset (scale by zoom level for natural feel)
                this.panX -= deltaX / this.zoomLevel;
                this.panY -= deltaY / this.zoomLevel;

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
                        <button class="sentence-item-edit" data-sentence-id="${sentence.id}" title="Edit sentence">✏</button>
                        <button class="sentence-item-delete" data-sentence-id="${sentence.id}" title="Delete sentence">✕</button>
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
        const isMobile = window.innerWidth < 768;
        const container = document.querySelector('.canvas-container');

        // Get actual container dimensions
        const containerWidth = container ? container.clientWidth : (isMobile ? 400 : 1200);
        const containerHeight = container ? container.clientHeight : (isMobile ? 300 : 800);

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
        // Clear SVG
        this.svg.innerHTML = '';

        // Calculate and set canvas size
        const canvasSize = this.calculateCanvasSize();

        // Check if we're on mobile (viewport width < 768px)
        const isMobile = window.innerWidth < 768;

        // Apply zoom to viewBox dimensions
        const zoomedWidth = canvasSize.width / this.zoomLevel;
        const zoomedHeight = canvasSize.height / this.zoomLevel;

        // Center the zoomed viewBox
        const zoomOffsetX = (canvasSize.width - zoomedWidth) / 2;
        const zoomOffsetY = (canvasSize.height - zoomedHeight) / 2;

        // Apply pan offset for touch scrolling
        const viewBoxX = canvasSize.viewBoxX + zoomOffsetX + this.panX;
        const viewBoxY = canvasSize.viewBoxY + zoomOffsetY + this.panY;

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
    const togglePropertiesBtn = document.getElementById('toggle-properties-panel');
    const propertiesPanel = document.getElementById('properties-panel');

    // Tab behavior for Sentence and Properties panels
    if (toggleSentenceBtn && sentencePanel && togglePropertiesBtn && propertiesPanel) {
        toggleSentenceBtn.addEventListener('click', () => {
            // Toggle sentence panel
            const isActive = sentencePanel.classList.contains('active');

            if (isActive) {
                // If clicking the active tab, close it
                sentencePanel.classList.remove('active');
                toggleSentenceBtn.classList.remove('active');
            } else {
                // Activate sentence panel, deactivate properties
                sentencePanel.classList.add('active');
                toggleSentenceBtn.classList.add('active');
                propertiesPanel.classList.remove('active');
                togglePropertiesBtn.classList.remove('active');
            }
        });

        togglePropertiesBtn.addEventListener('click', () => {
            // Toggle properties panel
            const isActive = propertiesPanel.classList.contains('active');

            if (isActive) {
                // If clicking the active tab, close it
                propertiesPanel.classList.remove('active');
                togglePropertiesBtn.classList.remove('active');
            } else {
                // Activate properties panel, deactivate sentence
                propertiesPanel.classList.add('active');
                togglePropertiesBtn.classList.add('active');
                sentencePanel.classList.remove('active');
                toggleSentenceBtn.classList.remove('active');
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
