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
