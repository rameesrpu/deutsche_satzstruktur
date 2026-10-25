import { nextId, reserveIdsAbove } from './ids.js';

/**
 * SentenceManager - Manages multiple sentences and their diagrams
 */
export class SentenceManager {
    constructor(wordManager) {
        this.wordManager = wordManager;
        this.sentences = [];
        this.currentSentenceId = null;
    }

    /**
     * Add a new sentence from text input
     * @param {string} text
     * @param {Object} meta - optional extra fields (e.g. source, level, category)
     * @returns {?Sentence}
     */
    addSentence(text, meta = {}) {
        if (!text || text.trim() === '') return null;

        const sentence = {
            id: nextId(),
            text: text.trim(),
            words: [],
            createdAt: new Date().toISOString(),
            ...meta
        };

        // Parse the sentence into words
        const wordTexts = text.trim().split(/\s+/);
        let x = 160;  // Aligned to 80px grid
        const y = 160;  // Aligned to 80px grid

        wordTexts.forEach((wordText, index) => {
            const word = {
                id: nextId(),
                type: 'other',  // Default type, user can change
                text: wordText,
                x: x,
                y: y,
                gender: 'none',
                case: 'nom',
                number: 'sg',
                flowDirection: 'right',
                conjugation: {
                    pronoun: 'none'
                }
            };

            sentence.words.push(word);
            x += 80;  // Space words horizontally
        });

        this.sentences.push(sentence);
        return sentence;
    }

    /**
     * Load a sentence into the canvas
     */
    loadSentence(sentenceId) {
        const sentence = this.sentences.find(s => s.id === sentenceId);
        if (!sentence) return false;

        this.currentSentenceId = sentenceId;

        // Clear current words and load sentence words (normalize legacy types on load)
        this.wordManager.clearAll();
        sentence.words.forEach(wordData => {
            this.wordManager.words.push(this.wordManager.normalizeLegacyType({ ...wordData }));
        });

        return true;
    }

    /**
     * Save current canvas state to the current sentence
     */
    saveCurrentSentence() {
        if (!this.currentSentenceId) return false;

        const sentence = this.sentences.find(s => s.id === this.currentSentenceId);
        if (!sentence) return false;

        // Update sentence words with current canvas state
        sentence.words = this.wordManager.words.map(word => ({ ...word }));
        return true;
    }

    /**
     * Edit an existing sentence
     */
    editSentence(sentenceId, newText) {
        const sentence = this.sentences.find(s => s.id === sentenceId);
        if (!sentence) return false;

        const oldWords = sentence.words;
        const newWordTexts = newText.trim().split(/\s+/);

        // Create a map of old words by text for quick lookup
        // Store array of matches in case same word appears multiple times
        const oldWordsByText = {};
        oldWords.forEach(word => {
            if (!oldWordsByText[word.text]) {
                oldWordsByText[word.text] = [];
            }
            oldWordsByText[word.text].push(word);
        });

        // Track which old words we've already used to avoid duplicates
        const usedOldWords = new Set();

        let x = 100;
        const y = 150;
        const newWords = [];

        newWordTexts.forEach((wordText, index) => {
            let word;

            // Check if this word existed in the old sentence
            if (oldWordsByText[wordText]) {
                // Find first unused match for this word text
                const matchingWords = oldWordsByText[wordText];
                let matchedWord = null;

                for (const oldWord of matchingWords) {
                    if (!usedOldWords.has(oldWord.id)) {
                        matchedWord = oldWord;
                        usedOldWords.add(oldWord.id);
                        break;
                    }
                }

                if (matchedWord) {
                    // Preserve existing configuration
                    word = { ...matchedWord };
                    word.x = x; // Update position
                    word.y = y;
                    word.id = nextId(); // Give it a new ID
                } else {
                    // All instances of this word were already used, create new
                    word = this.createNewWord(wordText, x, y, index);
                }
            } else {
                // New word - create with default configuration
                word = this.createNewWord(wordText, x, y, index);
            }

            newWords.push(word);
            x += 80;
        });

        // Update sentence
        sentence.text = newText.trim();
        sentence.words = newWords;

        return true;
    }

    /**
     * Helper to create a new unconfigured word
     */
    createNewWord(text, x, y, index) {
        return {
            id: nextId(),
            type: 'other',
            text: text,
            x: x,
            y: y,
            gender: 'none',
            case: 'nom',
            number: 'sg',
            flowDirection: 'right',
            conjugation: {
                pronoun: 'none'
            }
        };
    }

    /**
     * Delete a sentence
     */
    deleteSentence(sentenceId) {
        const index = this.sentences.findIndex(s => s.id === sentenceId);
        if (index === -1) return false;

        this.sentences.splice(index, 1);

        // If we deleted the current sentence, clear the canvas
        if (this.currentSentenceId === sentenceId) {
            this.currentSentenceId = null;
            this.wordManager.clearAll();
        }

        return true;
    }

    /**
     * Find a library sentence by level, category, and text (for cache lookup)
     * @returns {?Sentence}
     */
    findLibrarySentence(level, category, text) {
        return this.sentences.find(s =>
            s.source === 'library' &&
            s.level === level &&
            s.category === category &&
            s.text === text.trim()
        ) || null;
    }

    /**
     * Bulk-load pre-analyzed sentences from a library JSON into sentenceManager.
     * - Skips sentences with no words array (not yet analyzed).
     * - Adds sentences not yet in localStorage.
     * - Updates words on existing sentences only when the library version has changed
     *   (i.e. the developer pushed corrections), preserving user edits otherwise.
     * @param {string} level
     * @param {string} category
     * @param {LibraryFile} libraryData
     */
    bulkLoadLibraryCategory(level, category, libraryData) {
        const { version, sentences } = libraryData;
        const versionKey = `library_version_${level}_${category}`;
        const storedVersion = localStorage.getItem(versionKey);
        const versionChanged = version && version !== storedVersion;

        (sentences || []).forEach(entry => {
            const text = typeof entry === 'string' ? entry : entry.text;
            const libraryWords = entry.words;

            if (!libraryWords) return; // Not yet analyzed — skip, falls back to backend on click

            const existing = this.findLibrarySentence(level, category, text);

            if (existing) {
                if (versionChanged) {
                    existing.words = libraryWords.map(w => ({ ...w, id: nextId() }));
                }
            } else {
                this.sentences.push({
                    id: nextId(),
                    text: text.trim(),
                    words: libraryWords.map(w => ({ ...w, id: nextId() })),
                    createdAt: new Date().toISOString(),
                    source: 'library',
                    level,
                    category
                });
            }
        });

        if (version) {
            localStorage.setItem(versionKey, version);
        }
    }

    /**
     * Get all sentences
     * @returns {Sentence[]}
     */
    getAllSentences() {
        return this.sentences;
    }

    /**
     * Get current sentence
     * @returns {?Sentence}
     */
    getCurrentSentence() {
        if (!this.currentSentenceId) return null;
        return this.sentences.find(s => s.id === this.currentSentenceId);
    }

    /**
     * Save all sentences to localStorage
     */
    save() {
        // Save current canvas state before saving
        if (this.currentSentenceId) {
            this.saveCurrentSentence();
        }

        localStorage.setItem('deutschSentences', JSON.stringify(this.sentences));
        localStorage.setItem('deutschCurrentSentence', this.currentSentenceId);
    }

    /**
     * Load all sentences from localStorage
     */
    load() {
        const saved = localStorage.getItem('deutschSentences');
        if (saved) {
            this.sentences = JSON.parse(saved);
            if (this.repairDuplicateIds() > 0) {
                localStorage.setItem('deutschSentences', JSON.stringify(this.sentences));
            }
        }

        const currentId = localStorage.getItem('deutschCurrentSentence');
        if (currentId) {
            this.currentSentenceId = parseInt(currentId);
            this.loadSentence(this.currentSentenceId);
        }

        return this.sentences.length > 0;
    }

    /**
     * Give unique ids to sentences/words that share an id with an earlier one
     * (older versions bulk-loaded library categories with overlapping id ranges).
     * Keeps the first occurrence, so currentSentenceId still resolves the same way.
     * Idempotent. Returns the number of sentences changed.
     */
    repairDuplicateIds() {
        const maxId = this.sentences
            .flatMap(s => [s.id, ...(s.words || []).map(w => w.id)])
            .reduce((max, id) => (Number.isFinite(id) && id > max ? id : max), 0);
        reserveIdsAbove(maxId);

        const seenSentenceIds = new Set();
        const seenWordIds = new Set();
        let changed = 0;

        this.sentences.forEach(sentence => {
            let touched = false;
            if (seenSentenceIds.has(sentence.id)) {
                sentence.id = nextId();
                touched = true;
            }
            seenSentenceIds.add(sentence.id);

            (sentence.words || []).forEach(word => {
                if (seenWordIds.has(word.id)) {
                    word.id = nextId();
                    touched = true;
                }
                seenWordIds.add(word.id);
            });
            if (touched) changed++;
        });

        return changed;
    }

    /**
     * Create a new blank sentence
     */
    newBlankSentence() {
        this.currentSentenceId = null;
        this.wordManager.clearAll();
    }

    /**
     * Auto-configure current sentence using spaCy backend
     * @param {string} backendUrl - URL of the spaCy backend API (auto-detects local vs deployed)
     * @returns {Promise<{success: boolean, message: string, wordsAnalyzed?: number}>}
     */
    async autoConfigureCurrentSentence(backendUrl) {
        // Auto-detect backend URL: use localhost for local development, Render for deployed site
        if (!backendUrl) {
            const isLocal = window.location.hostname === 'localhost' ||
                          window.location.hostname === '127.0.0.1' ||
                          window.location.hostname === '';
            backendUrl = isLocal
                ? 'http://localhost:8000'
                : 'https://deutsche-satzstruktur.onrender.com';
        }
        const currentSentence = this.getCurrentSentence();

        if (!currentSentence) {
            return {
                success: false,
                message: 'No sentence is currently loaded. Please add or load a sentence first.'
            };
        }

        try {
            // Call the spaCy backend
            const response = await fetch(`${backendUrl}/analyze`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    text: currentSentence.text
                })
            });

            if (!response.ok) {
                throw new Error(`Backend returned ${response.status}: ${response.statusText}`);
            }

            const analyzedWords = await response.json();

            // Match analyzed words with sentence words (by position/index)
            if (analyzedWords.length !== currentSentence.words.length) {
                console.warn('Word count mismatch. Analyzed:', analyzedWords.length, 'Current:', currentSentence.words.length);
            }

            // Update each word's properties with the analyzed data
            const minLength = Math.min(analyzedWords.length, currentSentence.words.length);

            // Track subordinate clauses for automatic vertical alignment
            const subordinateClauses = new Map(); // clause_id → {startIndex, words}

            for (let i = 0; i < minLength; i++) {
                const analyzed = analyzedWords[i];
                const word = currentSentence.words[i];

                // Update word properties based on spaCy analysis
                word.type = analyzed.type;
                word.gender = analyzed.gender;
                word.case = analyzed.case;
                // Don't set number on verbs/modals - they use conjugation only for coloring
                if (analyzed.type !== 'verb' && analyzed.type !== 'modal') {
                    word.number = analyzed.number;
                }

                // Update conjugation pronoun for verbs, modals, subjects, and personal pronoun objects
                if ((analyzed.type === 'verb' || analyzed.type === 'modal' || analyzed.type === 'subject' || analyzed.type === 'object') &&
                    analyzed.conjugation_pronoun) {
                    if (!word.conjugation) {
                        word.conjugation = {};
                    }
                    word.conjugation.pronoun = analyzed.conjugation_pronoun;
                }

                // Store clause information
                word.clause_type = analyzed.clause_type;
                word.clause_id = analyzed.clause_id;

                // Automatically set flowDirection based on clause type
                if (analyzed.clause_type === 'subordinate') {
                    word.flowDirection = 'down';

                    // Track subordinate clause for vertical alignment
                    if (!subordinateClauses.has(analyzed.clause_id)) {
                        subordinateClauses.set(analyzed.clause_id, {
                            startIndex: i,
                            words: []
                        });
                    }
                    subordinateClauses.get(analyzed.clause_id).words.push({word, index: i});
                } else {
                    word.flowDirection = 'right';
                }

                // Also update in wordManager (current canvas state)
                const canvasWord = this.wordManager.getWord(word.id);
                if (canvasWord) {
                    canvasWord.type = analyzed.type;
                    canvasWord.gender = analyzed.gender;
                    canvasWord.case = analyzed.case;
                    canvasWord.number = analyzed.number;

                    // Update conjugation pronoun for verbs, modals, subjects, and personal pronoun objects
                    if ((analyzed.type === 'verb' || analyzed.type === 'modal' || analyzed.type === 'subject' || analyzed.type === 'object') &&
                        analyzed.conjugation_pronoun) {
                        if (!canvasWord.conjugation) {
                            canvasWord.conjugation = {};
                        }
                        canvasWord.conjugation.pronoun = analyzed.conjugation_pronoun;
                    }

                    // Update clause information
                    canvasWord.clause_type = analyzed.clause_type;
                    canvasWord.clause_id = analyzed.clause_id;
                    canvasWord.flowDirection = word.flowDirection;
                }
            }

            // Apply vertical alignment for subordinate clauses
            this.applyVerticalAlignmentForSubordinateClauses(subordinateClauses);

            // Save the changes
            this.save();

            return {
                success: true,
                message: `Successfully auto-configured ${minLength} word(s)`,
                wordsAnalyzed: minLength
            };

        } catch (error) {
            console.error('Auto-configure error:', error);

            // Provide helpful error messages
            let message = 'Failed to auto-configure: ';
            if (error.message.includes('Failed to fetch')) {
                message += 'Cannot connect to backend. Make sure the spaCy server is running at ' + backendUrl;
            } else {
                message += error.message;
            }

            return {
                success: false,
                message: message
            };
        }
    }

    /**
     * Apply vertical alignment for detected subordinate clauses
     * @param {Map} subordinateClauses - Map of clause_id to {startIndex, words}
     */
    applyVerticalAlignmentForSubordinateClauses(subordinateClauses) {
        if (subordinateClauses.size === 0) return;

        const gridConfig = {
            verticalSpacing: 80,
            horizontalSpacing: 80
        };

        // Process each subordinate clause
        for (const [, clauseData] of subordinateClauses) {
            const {words} = clauseData;

            if (words.length === 0) continue;

            // The first word (usually the conjunction) sets the X position for the entire clause
            const firstWordData = words[0];
            const baseX = firstWordData.word.x;

            // Position all words in the clause vertically
            words.forEach((wordData, idx) => {
                const {word} = wordData;

                // Set X to the conjunction's position (aligned vertically)
                word.x = baseX;

                // Set Y position with vertical spacing
                // First word after conjunction should be 2 blocks down to avoid overlap
                const verticalOffset = idx === 0 ? 0 : (idx + 1) * gridConfig.verticalSpacing;
                word.y = firstWordData.word.y + verticalOffset;

                // Also update in wordManager
                const canvasWord = this.wordManager.getWord(word.id);
                if (canvasWord) {
                    canvasWord.x = word.x;
                    canvasWord.y = word.y;
                }
            });
        }
    }

    /**
     * Export all sentences to a JSON file
     * @param {Object} [extra]  extra top-level fields, e.g. { progress } (see progressStore.js)
     * @returns {void}
     */
    exportSentences(extra = {}) {
        // Save current sentence before exporting
        if (this.currentSentenceId) {
            this.saveCurrentSentence();
        }

        // Create export data with metadata
        const exportData = {
            version: '1.0',
            exportDate: new Date().toISOString(),
            sentenceCount: this.sentences.length,
            sentences: this.sentences,
            ...extra
        };

        // Convert to JSON string
        const jsonString = JSON.stringify(exportData, null, 2);

        // Create blob and download link
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        // Create download link
        const a = document.createElement('a');
        a.href = url;
        a.download = `deutsch-sentences-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();

        // Cleanup
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        return true;
    }

    /**
     * Import sentences from a JSON file
     * @param {File} file - The JSON file to import
     * @param {string} mode - Import mode: 'replace' or 'merge' (default: 'merge')
     * @returns {Promise<{success: boolean, message: string, count?: number, progress?: ?GameProgress}>}
     */
    async importSentences(file, mode = 'merge') {
        try {
            // Read file content
            const text = await file.text();
            const importData = JSON.parse(text);

            // Validate import data structure
            if (!importData.sentences || !Array.isArray(importData.sentences)) {
                return {
                    success: false,
                    message: 'Invalid file format: missing sentences array'
                };
            }

            // Save current sentence before importing
            if (this.currentSentenceId) {
                this.saveCurrentSentence();
            }

            let importedCount = 0;

            if (mode === 'replace') {
                // Replace all existing sentences
                this.sentences = importData.sentences;
                this.repairDuplicateIds();
                importedCount = this.sentences.length;
                this.currentSentenceId = null;
                this.wordManager.clearAll();
            } else {
                // Merge mode: add new sentences
                importData.sentences.forEach(sentence => {
                    // Generate new IDs to avoid conflicts
                    const newSentence = {
                        ...sentence,
                        id: nextId(),
                        createdAt: sentence.createdAt || new Date().toISOString()
                    };

                    // Update word IDs to avoid conflicts
                    newSentence.words = sentence.words.map((word, idx) => ({
                        ...word,
                        id: nextId()
                    }));

                    this.sentences.push(newSentence);
                    importedCount++;
                });
            }

            // Save to localStorage
            this.save();

            return {
                success: true,
                message: `Successfully imported ${importedCount} sentence${importedCount !== 1 ? 's' : ''}`,
                count: importedCount,
                progress: importData.progress || null
            };

        } catch (error) {
            console.error('Import error:', error);
            return {
                success: false,
                message: `Failed to import: ${error.message}`
            };
        }
    }
}
