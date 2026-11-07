/**
 * Field model only when it teaches (E3, docs/experience-plan.md): does the finished sentence
 * show something the Feldermodell explains? Pure (no DOM), unit-tested in
 * tests/felderLesson.test.js (with a per-chapter share snapshot in tests/snapshots/).
 *
 * Word data (js/types.js): finite verb = type 'verb'/'modal' with a conjugation pronoun;
 * non-finite verb (infinitive, participle, imperative) = type 'verb' with pronoun 'none';
 * separable particles are type 'preposition' (story tag P) at the end of their clause.
 */

const W_WORDS = new Set(['wer', 'wen', 'wem', 'wessen', 'was', 'wie', 'wo', 'woher', 'wohin',
    'wann', 'warum', 'wieso', 'weshalb', 'welche', 'welcher', 'welches', 'welchen', 'welchem',
    'wieviel', 'wie viel', 'womit', 'wofür', 'worüber', 'wozu']);

/** Word text without surrounding punctuation ("Hier," → "Hier"). */
const bare = text => String(text).replace(/^[„“"»«(]+|[.,!?;:…“”"»«)]+$/g, '');

const pronoun = w => (w.conjugation && w.conjugation.pronoun) || 'none';
const isFinite = w => (w.type === 'verb' || w.type === 'modal') && pronoun(w) !== 'none';
const isNonFinite = w => w.type === 'verb' && pronoun(w) === 'none';
/** The word closes its clause: punctuation after it, or the sentence ends. */
const endsClause = (words, i) => i === words.length - 1 || /[.,!?;:…]$/.test(words[i].text);
const sameClause = (a, b) => (a.clause_id ?? 0) === (b.clause_id ?? 0);

/**
 * Index of the first word after a leading interjection/vocative that ends in a comma
 * ("Ja,", "Hallo,", "Guten Tag,") and a leading coordinating conjunction ("Aber", "Und"):
 * neither belongs to the Vorfeld.
 */
function clauseStart(words) {
    let start = 0;
    const comma = words.findIndex(w => /,$/.test(w.text));
    if (comma >= 0 && comma < 3 &&
        words.slice(0, comma + 1).every(w => !isFinite(w) && w.type !== 'verb' && w.type !== 'conjunction')) {
        start = comma + 1;
    }
    while (start < words.length && words[start].type === 'coord-conjunction') start++;
    return start;
}

/** Two-part verb: the finite verb before a later infinitive/participle or a separable particle. */
function findBracket(words) {
    for (let i = 0; i < words.length; i++) {
        const w = words[i];
        const particle = w.type === 'preposition' && endsClause(words, i);
        if (!particle && !isNonFinite(w)) continue;
        // The nearest finite verb before it in the same clause (an imperative also opens a
        // bracket with its particle: "Kommen Sie mit!")
        for (let j = i - 1; j >= 0; j--) {
            const v = words[j];
            if (!sameClause(v, w)) break;
            if (isFinite(v) || (particle && v.type === 'verb')) return [j, i];
        }
    }
    return null;
}

/**
 * @param {import('./types.js').Word[]} words  the sentence's words in order
 * @returns {?{kind: 'subordinate'|'bracket'|'vorfeld', hint: string,
 *            parts: {text: string, em: boolean}[]}}  hint = plain text; parts = the same
 *            text with the words to set in italics
 */
export function felderLesson(words) {
    if (!Array.isArray(words) || words.length === 0) return null;
    const make = (kind, parts) => ({ kind, hint: parts.map(p => p.text).join(''), parts });

    if (words.some(w => w.clause_type === 'subordinate' || w.type === 'conjunction')) {
        return make('subordinate', [{ text: 'Nebensatz: das Verb steht am Ende.', em: false }]);
    }

    const bracket = findBracket(words);
    if (bracket) {
        return make('bracket', [
            { text: 'Satzklammer: ', em: false },
            { text: bare(words[bracket[0]].text), em: true },
            { text: ' … ', em: false },
            { text: bare(words[bracket[1]].text), em: true },
        ]);
    }

    const start = clauseStart(words);
    const verb = words.findIndex((w, i) => i >= start && isFinite(w));
    if (verb <= start) return null; // no finite verb, or verb first (yes/no question, imperative)
    const front = words.slice(start, verb);
    const wQuestion = W_WORDS.has(bare(front[0].text).toLowerCase());
    if (!wQuestion && front.every(w => w.type === 'subject' || w.type === 'coord-conjunction')) return null;
    return make('vorfeld', [
        { text: 'Verb an Position 2. Vorne steht ', em: false },
        { text: bare(front.map(w => w.text).join(' ')), em: true },
        { text: '.', em: false },
    ]);
}

/** Auto-shows of the same lesson kind per chapter (later ones: the "Satzbau" link only). */
export const LESSON_AUTO_MAX = 3;

/**
 * Should a solved sentence's lesson open the field model on its own? Each kind opens at most
 * `max` times per run (`runKey`: the chapter, else the game session); a new runKey starts over.
 * Pure: returns the next state instead of changing `state`.
 * @param {?{key: string, counts: Object<string, number>}} state
 * @param {string} runKey
 * @param {?{kind: string}} lesson
 * @param {number} [max]
 * @returns {{auto: boolean, state: {key: string, counts: Object<string, number>}}}
 */
export function lessonAutoShow(state, runKey, lesson, max = LESSON_AUTO_MAX) {
    const counts = state && state.key === runKey ? { ...state.counts } : {};
    if (!lesson) return { auto: false, state: { key: runKey, counts } };
    const seen = counts[lesson.kind] || 0;
    if (seen >= max) return { auto: false, state: { key: runKey, counts } };
    counts[lesson.kind] = seen + 1;
    return { auto: true, state: { key: runKey, counts } };
}
