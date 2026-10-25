import { GrammaticalConfig } from './grammaticalConfig.js';
import { nextId } from './ids.js';

/**
 * WordManager - Manages word data and operations
 */
export class WordManager {
    constructor(gridConfig) {
        this.words = [];
        this.selectedWord = null;
        this.gridConfig = gridConfig || { horizontalSpacing: 80, verticalSpacing: 80 };
        this.wordConfig = {
            'subject': { label: 'ich' },
            'verb': { label: 'verb' },
            'object': { label: 'obj' },
            'adjective': { label: 'adj' },
            'modal': { label: 'modal' },
            'conjunction': { label: 'conj' },
            'coord-conjunction': { label: 'und' },
            'preposition': { label: 'prep' },
            'other': { label: 'wort' }
        };

        // Preposition classifications (including common contractions)
        this.prepositions = {
            akk: ['durch', 'für', 'gegen', 'ohne', 'um', 'bis', 'entlang', 'fürs', 'durchs', 'ums'],
            dat: ['aus', 'bei', 'mit', 'nach', 'seit', 'von', 'zu', 'gegenüber', 'außer', 'beim', 'vom', 'zum', 'zur'],
            wechsel: ['an', 'auf', 'hinter', 'in', 'neben', 'über', 'unter', 'vor', 'zwischen', 'im', 'am', 'ins', 'ans', 'aufs'],
            gen: ['während', 'wegen', 'trotz', 'statt', 'anstatt', 'aufgrund', 'innerhalb', 'außerhalb', 'oberhalb', 'unterhalb', 'diesseits', 'jenseits', 'unweit', 'mittels', 'dank', 'kraft', 'laut', 'angesichts', 'bezüglich', 'hinsichtlich']
        };

        // Use centralized grammatical configuration
        this.config = GrammaticalConfig;

    }

    /**
     * Add a new word to the canvas
     */
    addWord(type) {
        let x = 160;  // Aligned to 80px grid
        let y = 160;  // Aligned to 80px grid
        let flowDirection = 'right'; // default to hauptsatz (horizontal)

        if (this.words.length > 0) {
            const prevWord = this.words[this.words.length - 1];
            flowDirection = prevWord.flowDirection;

            if (prevWord.flowDirection === 'right') {
                // Horizontal flow (Hauptsatz) - use horizontal spacing
                x = prevWord.x + this.gridConfig.horizontalSpacing;
                y = prevWord.y;
            } else {
                // Vertical flow (Nebensatz) - use vertical spacing
                x = prevWord.x;
                y = prevWord.y + this.gridConfig.verticalSpacing;
            }
        }

        const word = {
            id: nextId(),
            type: type,
            text: this.wordConfig[type].label,
            x: x,
            y: y,
            gender: type === 'verb' || type === 'modal' || type === 'other' || type === 'conjunction' || type === 'coord-conjunction' || type === 'preposition' ? 'none' : 'm',
            case: 'nom',
            number: 'sg',
            flowDirection: flowDirection
        };

        // Add conjugation data for verbs, modals, subjects, and accusative/dative objects
        if (type === 'verb' || type === 'modal') {
            word.conjugation = {
                pronoun: 'none'  // Default none - user must explicitly set conjugation
            };
        } else if (type === 'subject') {
            word.conjugation = {
                pronoun: 'none'  // Default none for subjects (can be set to match verb)
            };
        } else if (type === 'object') {
            word.conjugation = {
                pronoun: 'none'  // Default none for objects (for personal pronouns like mich, mir, dich, dir)
            };
        } else {
            word.conjugation = {
                pronoun: 'none'  // Default none for other types
            };
        }

        this.words.push(word);
        return word;
    }

    /**
     * Delete a word by ID
     */
    deleteWord(wordId) {
        this.words = this.words.filter(w => w.id !== wordId);
        if (this.selectedWord && this.selectedWord.id === wordId) {
            this.selectedWord = null;
        }
    }

    /**
     * Update a word property
     */
    updateWordProperty(wordId, property, value) {
        const word = this.words.find(w => w.id === wordId);
        if (word) {
            word[property] = value;
        }
    }

    /**
     * Get word by ID
     */
    getWord(wordId) {
        return this.words.find(w => w.id === wordId);
    }

    /**
     * Select a word
     */
    selectWord(word) {
        this.selectedWord = word;
    }

    /**
     * Deselect current word
     */
    deselectWord() {
        this.selectedWord = null;
    }

    /**
     * Clear all words
     */
    clearAll() {
        this.words = [];
        this.selectedWord = null;
    }

    /**
     * Get all words
     */
    getAllWords() {
        return this.words;
    }

    /**
     * Get word configuration (colors, labels)
     */
    getWordConfig(type) {
        return this.wordConfig[type];
    }

    /**
     * Find Nebensatz groups (consecutive words flowing down)
     */
    getNebensatzGroups() {
        const groups = [];
        let currentGroup = null;

        this.words.forEach((word, index) => {
            if (word.flowDirection === 'down') {
                if (!currentGroup) {
                    currentGroup = {
                        startIndex: index,
                        words: [word]
                    };
                } else {
                    currentGroup.words.push(word);
                }
            } else {
                if (currentGroup) {
                    groups.push(currentGroup);
                    currentGroup = null;
                }
            }
        });

        if (currentGroup) {
            groups.push(currentGroup);
        }

        return groups;
    }

    /**
     * Save words to localStorage
     */
    save() {
        localStorage.setItem('deutschWords', JSON.stringify(this.words));
    }

    /**
     * Load words from localStorage
     */
    load() {
        const saved = localStorage.getItem('deutschWords');
        if (saved) {
            this.words = JSON.parse(saved).map(w => this.normalizeLegacyType(w));
            return true;
        }
        return false;
    }

    /**
     * Normalize legacy object-akk/dat/gen types to plain "object".
     * Case is already stored separately so no information is lost.
     */
    normalizeLegacyType(word) {
        if (word.type === 'object-akk' || word.type === 'object-dat' || word.type === 'object-gen') {
            word.type = 'object';
        }
        return word;
    }

    /**
     * Update verb conjugation pronoun
     */
    updateVerbPronoun(wordId, pronoun) {
        const word = this.getWord(wordId);
        if (!word || !word.conjugation) return;

        word.conjugation.pronoun = pronoun;
    }

    /**
     * Get pronoun color
     */
    getPronounColor(pronoun) {
        return this.config.getPronounColor(pronoun);
    }

    /**
     * Get color for a word based on its gender
     */
    getWordColor(word) {
        return this.config.getGenderColor(word.gender);
    }

    /**
     * Get color for a word using priority hierarchy
     * (conjugation > plural > gender > default)
     */
    getColorForWord(word) {
        return this.config.getColorForWord(word);
    }

    /**
     * Determine preposition case based on the preposition text
     */
    getPrepositionCase(prepText) {
        const text = prepText.toLowerCase().trim();

        if (this.prepositions.akk.includes(text)) {
            return 'akk';
        } else if (this.prepositions.dat.includes(text)) {
            return 'dat';
        } else if (this.prepositions.wechsel.includes(text)) {
            return 'wechsel';
        } else if (this.prepositions.gen.includes(text)) {
            return 'gen';
        }

        // Default to dative if unknown
        return 'dat';
    }
}
