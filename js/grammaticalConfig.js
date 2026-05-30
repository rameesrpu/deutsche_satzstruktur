/**
 * GrammaticalConfig - Centralized configuration for gender, number, and pronoun properties
 *
 * This configuration defines:
 * - All pronouns with their colors, labels, and grammatical properties
 * - Gender-to-color mappings
 * - Color determination logic with clear priority rules
 */
const GrammaticalConfig = {
    /**
     * Pronoun definitions with all properties
     * Each pronoun has: color, label (for UI), gender (if applicable), number, person
     */
    pronouns: {
        'none': {
            color: '#95a5a6',
            label: 'None',
            gender: null,
            number: null,
            person: null
        },
        'ich': {
            color: '#27ae60',
            label: 'ich',
            gender: null,
            number: 'sg',
            person: 1
        },
        'du': {
            color: '#e67e22',
            label: 'du',
            gender: null,
            number: 'sg',
            person: 2
        },
        'er': {
            color: '#3498db',
            label: 'er (♂)',
            gender: 'm',
            number: 'sg',
            person: 3
        },
        'sie': {
            color: '#e91e63',
            label: 'sie (♀)',
            gender: 'f',
            number: 'sg',
            person: 3
        },
        'es': {
            color: '#8e44ad',
            label: 'es (⚲)',
            gender: 'n',
            number: 'sg',
            person: 3
        },
        'wir': {
            color: '#2c3e50',
            label: 'wir',
            gender: null,
            number: 'pl',
            person: 1
        },
        'ihr': {
            color: '#f39c12',
            label: 'ihr',
            gender: null,
            number: 'pl',
            person: 2
        },
        'sie_pl': {
            color: '#c0392b',
            label: 'sie/Sie (pl.)',
            gender: null,
            number: 'pl',
            person: 3
        }
    },

    /**
     * Gender-to-color mapping (used when no specific conjugation is set)
     * These colors match the corresponding 3rd person singular pronouns
     */
    genders: {
        'none': '#95a5a6',   // Grey - No gender
        'm': '#3498db',      // Blue - Masculine (matches 'er')
        'f': '#e91e63',      // Pink - Feminine (matches 'sie')
        'n': '#8e44ad'       // Dark Violet - Neuter (matches 'es')
    },

    /**
     * Get color for a word based on priority hierarchy:
     * - Verbs/modals/personal pronouns/object pronouns: Use conjugation pronoun color
     * - Subjects/objects/adjectives: Use plural (if pl) or gender color
     * - Other: Default grey
     *
     * IMPORTANT: Conjugation and gender are mutually exclusive by word type:
     * - Conjugation for: verb, modal, subject (when it's a personal pronoun), object (when personal pronouns like mich, mir, dich, dir)
     * - Gender for: subject, object, adjective (but NOT verb/modal, and NOT when conjugation is set)
     *
     * @param {Object} word - Word object with type, conjugation, number, and gender properties
     * @returns {string} Hex color code
     */
    getColorForWord(word) {
        // Priority 1: Conjugation for verbs, modals, subjects, and accusative/dative objects (personal pronouns)
        if ((word.type === 'verb' || word.type === 'modal' || word.type === 'subject' ||
             word.type === 'object') &&
            word.conjugation?.pronoun && word.conjugation.pronoun !== 'none') {
            const pronounConfig = this.pronouns[word.conjugation.pronoun];
            return pronounConfig ? pronounConfig.color : this.genders['none'];
        }

        // Priority 2: Plural (for subjects/objects/adjectives without specific conjugation)
        // Note: Verbs and modals should NEVER use plural color - they use conjugation color only
        if (word.number === 'pl' && word.type !== 'verb' && word.type !== 'modal') {
            return this.pronouns['sie_pl'].color;
        }

        // Priority 3: Gender (for subjects/objects/adjectives)
        if (word.gender && word.gender !== 'none') {
            return this.genders[word.gender];
        }

        // Priority 4: Default
        return this.genders['none'];
    },

    /**
     * Get stroke width for a word (used for selection highlighting)
     * Plural words get thicker strokes when selected
     *
     * @param {Object} word - Word object
     * @param {boolean} isSelected - Whether the word is selected
     * @returns {number} Stroke width in pixels
     */
    getStrokeWidth(word, isSelected) {
        if (!isSelected) {
            return 2; // Default stroke
        }

        // Plural words get thicker selection highlight
        return word.number === 'pl' ? 5 : 3;
    },

    /**
     * Get all pronoun keys in display order
     * @returns {Array<string>} Array of pronoun keys
     */
    getPronounKeys() {
        return ['none', 'ich', 'du', 'er', 'sie', 'es', 'wir', 'ihr', 'sie_pl'];
    },

    /**
     * Get pronoun configuration
     * @param {string} pronounKey - Pronoun key
     * @returns {Object} Pronoun configuration object
     */
    getPronoun(pronounKey) {
        return this.pronouns[pronounKey] || this.pronouns['none'];
    },

    /**
     * Get gender color
     * @param {string} genderKey - Gender key (m, f, n, none)
     * @returns {string} Hex color code
     */
    getGenderColor(genderKey) {
        return this.genders[genderKey] || this.genders['none'];
    },

    /**
     * Get pronoun color (for backward compatibility)
     * @param {string} pronounKey - Pronoun key
     * @returns {string} Hex color code
     */
    getPronounColor(pronounKey) {
        const pronoun = this.getPronoun(pronounKey);
        return pronoun.color;
    }
};
