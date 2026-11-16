/**
 * Field zones of a main clause (Feldermodell): which word indices stand in the Vorfeld, the
 * finite verb, the Mittelfeld and the Ende (second verb part). Pure (no DOM); built on the
 * helpers of felderLesson.js, unit-tested in tests/fieldZones.test.js (with a snapshot of all
 * A1 chapter sentences in tests/snapshots/field-zones.json).
 */

import { isFiniteVerb, isNonFinite, clauseStart, findBracket } from './felderLesson.js';

/**
 * @param {import('./types.js').Word[]} words  the sentence's words in order
 * @returns {?{lead: number[], vorfeld: number[], verb: number[], mittelfeld: number[], ende: number[]}}
 *   word indices in sentence order, each index in exactly one list; null when the sentence is
 *   not a plain main clause (no or several finite verbs, subordinate clause, words after the
 *   closing verb part)
 */
export function fieldZones(words) {
    if (!Array.isArray(words) || words.length === 0) return null;
    if (words.some(w => w.clause_type === 'subordinate' || w.type === 'conjunction')) return null;
    const finite = words.map((w, i) => (isFiniteVerb(w) ? i : -1)).filter(i => i >= 0);
    if (finite.length !== 1) return null;
    const verb = finite[0];
    const start = clauseStart(words);
    if (verb < start) return null;

    // Ende: the closing part of the bracket plus directly adjacent non-finite verbs
    let endeFrom = words.length;
    const bracket = findBracket(words);
    if (bracket) {
        if (bracket[0] !== verb) return null;
        endeFrom = bracket[1];
        while (endeFrom - 1 > verb && isNonFinite(words[endeFrom - 1])) endeFrom--;
        for (let k = bracket[1] + 1; k < words.length; k++) {
            if (!isNonFinite(words[k])) return null; // words after the closing verb part
        }
    }
    // A non-finite verb outside the Ende (e.g. in another clause) is not a field analysis we trust
    if (words.some((w, i) => i < endeFrom && isNonFinite(w))) return null;

    const range = (a, b) => Array.from({ length: Math.max(0, b - a) }, (_, k) => a + k);
    return {
        lead: range(0, start),
        vorfeld: range(start, verb),
        verb: [verb],
        mittelfeld: range(verb + 1, endeFrom),
        ende: range(endeFrom, words.length),
    };
}
