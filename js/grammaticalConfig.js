/**
 * GrammaticalConfig - Centralized configuration for gender, number, and pronoun properties
 *
 * This configuration defines:
 * - All pronouns with their colors, labels, and grammatical properties
 * - Gender-to-color mappings
 * - Color determination logic with clear priority rules
 */

/**
 * The one grammar palette ("Gedämpft", docs/redesign-plan.md). Every grammar color in JS comes
 * from here; css/styles.css mirrors `c` as --gram-* tokens.
 *   c    — main color (outlines, symbols, dots)
 *   ink  — text color on light surfaces (≥ 4.5:1)
 *   tint — soft fill (selected tile, chips)
 * The four noun groups get four far-apart hues; persons take the in-between hues.
 */
export const GRAMMAR_PALETTE = {
    masc: { c: '#3F6FB0', ink: '#2C5590', tint: '#E9EFF7' },  // blue
    fem:  { c: '#B9476A', ink: '#93334F', tint: '#F6E9EE' },  // rose
    neut: { c: '#4E8B5A', ink: '#336B40', tint: '#E8F2EA' },  // green
    pl:   { c: '#B98A2C', ink: '#755512', tint: '#F6EFDF' },  // ochre
    ich:  { c: '#7A5AA6', ink: '#5B3F88', tint: '#EFEAF6' },  // violet
    du:   { c: '#C2603A', ink: '#923F20', tint: '#F7EAE4' },  // terracotta
    ihr:  { c: '#2E8288', ink: '#1F5F64', tint: '#E4F1F2' },  // teal
    wir:  { c: '#556070', ink: '#434C5A', tint: '#ECEDF0' },  // slate
    imp:  { c: '#8B8F96', ink: '#5D626B', tint: '#F0F0F1' },  // grey (imperative)
    none: { c: '#8B8F96', ink: '#5D626B', tint: '#F0F0F1' }   // grey (no gender)
};

/**
 * The 3×3 grid (shared by grid view and game mode). Labels name the CATEGORY, never an
 * article: the article depends on the case (der/den/dem Markt).
 */
export const GRID_CELLS = [
    { row: 1, col: 1, key: 'masc', label: 'MASKULIN' },
    { row: 1, col: 2, key: 'du',   label: 'DU' },
    { row: 1, col: 3, key: 'fem',  label: 'FEMININ' },
    { row: 2, col: 1, key: 'neut', label: 'NEUTRUM' },
    { row: 2, col: 2, key: 'ich',  label: 'ICH' },
    { row: 2, col: 3, key: 'pl',   label: 'PLURAL' },
    { row: 3, col: 1, key: 'ihr',  label: 'IHR' },
    { row: 3, col: 2, key: 'wir',  label: 'WIR' },
    { row: 3, col: 3, key: 'imp',  label: 'IMPERATIV' }
].map(cell => ({ ...cell, ...GRAMMAR_PALETTE[cell.key], color: GRAMMAR_PALETTE[cell.key].c }));

export const GrammaticalConfig = {
    /**
     * Pronoun definitions with all properties
     * Each pronoun has: color, label (for UI), gender (if applicable), number, person
     */
    pronouns: {
        'none': {
            color: GRAMMAR_PALETTE.none.c,
            label: 'None',
            gender: null,
            number: null,
            person: null
        },
        'ich': {
            color: GRAMMAR_PALETTE.ich.c,
            label: 'ich',
            gender: null,
            number: 'sg',
            person: 1
        },
        'du': {
            color: GRAMMAR_PALETTE.du.c,
            label: 'du',
            gender: null,
            number: 'sg',
            person: 2
        },
        'er': {
            color: GRAMMAR_PALETTE.masc.c,
            label: 'er (♂)',
            gender: 'm',
            number: 'sg',
            person: 3
        },
        'sie': {
            color: GRAMMAR_PALETTE.fem.c,
            label: 'sie (♀)',
            gender: 'f',
            number: 'sg',
            person: 3
        },
        'es': {
            color: GRAMMAR_PALETTE.neut.c,
            label: 'es (⚲)',
            gender: 'n',
            number: 'sg',
            person: 3
        },
        'wir': {
            color: GRAMMAR_PALETTE.wir.c,
            label: 'wir',
            gender: null,
            number: 'pl',
            person: 1
        },
        'ihr': {
            color: GRAMMAR_PALETTE.ihr.c,
            label: 'ihr',
            gender: null,
            number: 'pl',
            person: 2
        },
        'sie_pl': {
            color: GRAMMAR_PALETTE.pl.c,
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
        'none': GRAMMAR_PALETTE.none.c,   // grey - no gender
        'm': GRAMMAR_PALETTE.masc.c,      // blue - masculine (matches 'er')
        'f': GRAMMAR_PALETTE.fem.c,       // rose - feminine (matches 'sie')
        'n': GRAMMAR_PALETTE.neut.c       // green - neuter (matches 'es')
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
