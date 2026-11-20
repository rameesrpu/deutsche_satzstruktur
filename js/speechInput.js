// Speech recognition for the "Sprechen" rung of the review ladder (browser Web Speech API).
// Availability is pure and unit-tested; listen() comes with the Sprechen screen.

/**
 * @param {object} [win]
 * @returns {boolean} true when the browser offers (webkit)SpeechRecognition
 */
export function speechAvailable(win = globalThis) {
    return typeof win.SpeechRecognition === 'function' || typeof win.webkitSpeechRecognition === 'function';
}
