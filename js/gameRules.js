// Game-mode rules: placement validation, scoring, attempts/auto-place. Pure: no
// DOM, no window.app — the caller looks up the expected grid cell (via
// GridViewModel.getWordPosition) and applies the returned state.

export const BASE_POINTS = 10;          // points for a correct placement outside time challenge
export const MAX_WRONG_ATTEMPTS = 3;    // wrong placements before the word is auto-placed

/**
 * Check a placement of `word` at row/col with the selected case.
 * Verbs and modals have no case, so only the cell is checked; for other words
 * the case must match `word.case` (a word without case accepts any).
 *
 * @param {Word} word
 * @param {number} row
 * @param {number} col
 * @param {?Case} caseType  selected case
 * @param {?GridCell} expectedCell  from getWordPosition(word); null = no cell
 * @returns {PlacementResult}
 */
export function validatePlacement(word, row, col, caseType, expectedCell) {
    const cellOk = !!expectedCell && expectedCell.row === row && expectedCell.col === col;
    const caseChecked = word.type !== 'verb' && word.type !== 'modal' && !!word.case;
    const caseOk = !caseChecked || word.case === caseType;
    return {
        ok: cellOk && caseOk,
        cellOk,
        caseOk,
        expectedCase: caseChecked ? word.case : null,
        expectedCell: expectedCell || null,
    };
}

/** Time-challenge points (and feedback color) for answering after `elapsedMs`. */
export function getTimePoints(elapsedMs) {
    const s = elapsedMs / 1000;
    if (s < 1.0) return { points: 30, color: '#27ae60' };
    if (s < 2.0) return { points: 25, color: '#52be80' };
    if (s < 3.0) return { points: 20, color: '#a9d96c' };
    if (s < 5.0) return { points: 15, color: '#f1c40f' };
    if (s < 7.0) return { points: 10, color: '#e67e22' };
    if (s < 10.0) return { points: 5,  color: '#e74c3c' };
    return { points: 0, color: '#c0392b' };
}

/**
 * Decide the outcome of one placement attempt.
 *
 * @param {Object} p
 * @param {Object} p.word, p.row, p.col, p.caseType, p.expectedCell  see validatePlacement
 * @param {number} p.attempts   wrong attempts so far for this word
 * @param {?number} p.elapsedMs time since the word appeared in time challenge; null otherwise
 * @returns {PlacementOutcome}
 */
export function evaluatePlacement({ word, row, col, caseType, expectedCell, attempts = 0, elapsedMs = null }) {
    const result = validatePlacement(word, row, col, caseType, expectedCell);
    if (result.ok) {
        const timed = elapsedMs !== null ? getTimePoints(elapsedMs) : null;
        return {
            result,
            points: timed ? timed.points : BASE_POINTS,
            timeColor: timed ? timed.color : null,
            attempts: 0,
            autoPlace: false,
        };
    }
    const newAttempts = attempts + 1;
    return { result, points: 0, timeColor: null, attempts: newAttempts,
        autoPlace: newAttempts >= MAX_WRONG_ATTEMPTS };
}

/**
 * The correct placement used when auto-placing a word, or null if it has no cell.
 * @param {Word} word
 * @param {?GridCell} expectedCell
 * @returns {?{row: number, col: number, caseType: Case}}
 */
export function getAutoPlacement(word, expectedCell) {
    if (!expectedCell) return null;
    return { row: expectedCell.row, col: expectedCell.col, caseType: word.case || 'nom' };
}

/* ------------------------------------------------------------------
 * Mistake explanations (I3): short hints built from a PlacementResult
 * ------------------------------------------------------------------ */

const CASE_NAMES = { nom: 'Nominativ', akk: 'Akkusativ', dat: 'Dativ', gen: 'Genitiv' };

// Prepositions with one fixed case; contractions name their full form.
// Not grammaticalConfig.js — that file only holds gender/number/pronoun colors.
const FIXED_CASE_PREPOSITIONS = {
    aus: 'dat', bei: 'dat', mit: 'dat', nach: 'dat', seit: 'dat', von: 'dat', zu: 'dat',
    gegenüber: 'dat', ab: 'dat',
    durch: 'akk', für: 'akk', gegen: 'akk', ohne: 'akk', um: 'akk', bis: 'akk', pro: 'akk',
    trotz: 'gen', wegen: 'gen', während: 'gen', statt: 'gen', innerhalb: 'gen', außerhalb: 'gen',
};
// Wechselpräpositionen: Dativ = wo?/wann?, Akkusativ = wohin?
const TWO_WAY_PREPOSITIONS = new Set(['an', 'auf', 'hinter', 'in', 'neben', 'über', 'unter', 'vor', 'zwischen']);
const CONTRACTIONS = {
    am: ['an dem', 'dat'], im: ['in dem', 'dat'], beim: ['bei dem', 'dat'], vom: ['von dem', 'dat'],
    zum: ['zu dem', 'dat'], zur: ['zu der', 'dat'],
    ans: ['an das', 'akk'], ins: ['in das', 'akk'], aufs: ['auf das', 'akk'], fürs: ['für das', 'akk'],
    ums: ['um das', 'akk'],
};

const OBJECT_PRONOUN_BASE = { mich: 'ich', mir: 'ich', dich: 'du', dir: 'du', uns: 'wir', euch: 'ihr' };
const GENDER_INFO = { m: ['masculine', 'der'], f: ['feminine', 'die'], n: ['neuter', 'das'] };

const bare = text => (text || '').replace(/[.,!?;:–-]+$/, '').trim();

/**
 * The case rule of `preposition`, if it explains `expectedCase`, else null.
 * Only a preposition directly before the phrase and without trailing
 * punctuation counts: separable-verb particles ("rufe an,") are tagged
 * 'preposition' in the library too.
 * @param {?Word} preposition
 * @param {Case} expectedCase
 * @returns {?string}
 */
export function explainPrepositionCase(preposition, expectedCase) {
    if (!preposition || preposition.type !== 'preposition') return null;
    if (/[.,!?;:–-]$/.test(preposition.text.trim())) return null;
    const p = preposition.text.trim().toLowerCase();
    const name = CASE_NAMES[expectedCase];
    if (CONTRACTIONS[p]) {
        const [full, c] = CONTRACTIONS[p];
        return c === expectedCase ? `“${p}” = ${full} → ${name}` : null;
    }
    if (FIXED_CASE_PREPOSITIONS[p]) {
        return FIXED_CASE_PREPOSITIONS[p] === expectedCase ? `“${p}” → always ${name}` : null;
    }
    if (TWO_WAY_PREPOSITIONS.has(p)) {
        if (expectedCase === 'dat') return `“${p}” + Dativ: wo? / wann?`;
        if (expectedCase === 'akk') return `“${p}” + Akkusativ: wohin?`;
    }
    return null;
}

/**
 * Why a placement was wrong, as 0–2 short lines (cell first, then case).
 * @param {Object} p
 * @param {Word} p.word            the word that decides the cell (a box's mainWord)
 * @param {PlacementResult} p.result
 * @param {string} [p.phrase]      whole phrase text, used in case hints (default: word text)
 * @param {?Word} [p.preposition]  connector word directly before the phrase, if any
 * @returns {string[]}
 */
export function explainMistake({ word, result, phrase, preposition = null }) {
    const lines = [];
    const w = bare(word.text);
    const cell = result.expectedCell;

    if (!result.cellOk && cell) {
        const label = cell.label;
        const pronoun = word.conjugation && word.conjugation.pronoun;
        const objBase = OBJECT_PRONOUN_BASE[w.toLowerCase()];
        if (word.type === 'verb' || word.type === 'modal') {
            lines.push(pronoun === 'none' || !pronoun
                ? `“${w}” has no subject (imperative) → ${label}`
                : `“${w}” goes with ${pronoun === 'sie_pl' ? 'sie (plural)' : pronoun} → ${label}`);
        } else if (word.type === 'subject' && ['ich', 'du', 'wir', 'ihr'].includes(pronoun)) {
            lines.push(`“${w}” → ${label} cell`);
        } else if (word.type !== 'subject' && objBase && label === objBase.toUpperCase()) {
            lines.push(`“${w}” is the ${objBase} form → ${label}`);
        } else if (word.number === 'pl' || pronoun === 'sie_pl') {
            lines.push(`“${w}” is plural → ${label}`);
        } else if (GENDER_INFO[word.gender]) {
            const [g, article] = GENDER_INFO[word.gender];
            lines.push(`“${w}” is ${g} (${article}) → ${label}`);
        } else {
            lines.push(`“${w}” → ${label} cell`);
        }
    }

    if (!result.caseOk && result.expectedCase) {
        const name = CASE_NAMES[result.expectedCase];
        const p = bare(phrase || word.text);
        lines.push(explainPrepositionCase(preposition, result.expectedCase)
            || (word.type === 'subject' ? `“${p}” is the subject → ${name}` : `“${p}” is ${name} here`));
    }
    return lines;
}
