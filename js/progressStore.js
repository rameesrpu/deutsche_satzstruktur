// Game progress that survives reloads: per-sentence play/mistake history plus
// lifetime bests, in localStorage key `gameProgress`. Sentences are keyed by
// level/category/text (sentence ids change on every load, see ids.js). Every
// storage access is wrapped: a missing or blocked localStorage just means
// progress isn't kept.

export const PROGRESS_KEY = 'gameProgress';
const FORMAT_VERSION = 1;

/**
 * Stable key for a sentence: `${level}/${category}/${text}`; user-created
 * sentences (no level) use level 'custom'.
 * @param {Sentence} sentence
 * @returns {string}
 */
export function sentenceKey(sentence) {
    return `${sentence.level || 'custom'}/${sentence.category || ''}/${sentence.text}`;
}

/** Empty per-sentence mistake tally: wrong case by expected case, wrong cell. */
export function emptyMistakes() {
    return { case: {}, cell: 0 };
}

/**
 * Add one wrong placement to a mistake tally (mutates `mistakes`).
 * @param {SentenceMistakes} mistakes
 * @param {PlacementResult} result  a result with ok === false
 */
export function addMistake(mistakes, result) {
    if (!result.cellOk) mistakes.cell++;
    if (!result.caseOk && result.expectedCase) {
        mistakes.case[result.expectedCase] = (mistakes.case[result.expectedCase] || 0) + 1;
    }
}

/** Number of mistakes in a tally. */
export function countMistakes(mistakes) {
    return mistakes.cell + Object.values(mistakes.case).reduce((a, b) => a + b, 0);
}

const emptyData = () => ({
    version: FORMAT_VERSION,
    sentences: {},
    totals: { bestScore: 0, bestStreak: 0, sentencesPlayed: 0 },
});

export class ProgressStore {
    /** @param {?Storage} [storage]  default: globalThis.localStorage, looked up on each access */
    constructor(storage = null) {
        this.storage = storage;
        this.data = null; // cache; read lazily
    }

    _storage() {
        return this.storage || globalThis.localStorage;
    }

    /** @returns {GameProgress} */
    load() {
        if (this.data) return this.data;
        let data = null;
        try {
            const raw = this._storage().getItem(PROGRESS_KEY);
            if (raw) data = JSON.parse(raw);
        } catch (e) {
            console.warn('Could not read game progress:', e);
        }
        this.data = normalize(data);
        return this.data;
    }

    save() {
        try {
            this._storage().setItem(PROGRESS_KEY, JSON.stringify(this.data));
        } catch (e) {
            console.warn('Could not save game progress:', e);
        }
    }

    /** @returns {?SentenceProgress} */
    getSentence(key) {
        return this.load().sentences[key] || null;
    }

    /**
     * Record one completed play of a sentence.
     * @param {string} key  from sentenceKey()
     * @param {SentenceMistakes} mistakes  this play's wrong placements
     * @param {number} [now]
     * @returns {SentenceProgress}
     */
    recordSentence(key, mistakes, now = Date.now()) {
        const data = this.load();
        const entry = data.sentences[key] || {
            plays: 0, perfect: 0, perfectStreak: 0, lastPlayed: 0, lastMistakes: 0,
            mistakes: emptyMistakes(),
        };
        const count = countMistakes(mistakes);
        entry.plays++;
        if (count === 0) {
            entry.perfect++;
            entry.perfectStreak++;
        } else {
            entry.perfectStreak = 0;
        }
        entry.lastPlayed = now;
        entry.lastMistakes = count;
        entry.mistakes.cell += mistakes.cell;
        for (const [c, n] of Object.entries(mistakes.case)) {
            entry.mistakes.case[c] = (entry.mistakes.case[c] || 0) + n;
        }
        data.sentences[key] = entry;
        data.totals.sentencesPlayed++;
        this.save();
        return entry;
    }

    /** Raise the lifetime bests if this session beat them. */
    recordSession({ score = 0, streak = 0 }) {
        const totals = this.load().totals;
        if (score <= totals.bestScore && streak <= totals.bestStreak) return;
        totals.bestScore = Math.max(totals.bestScore, score);
        totals.bestStreak = Math.max(totals.bestStreak, streak);
        this.save();
    }

    /** @returns {GameProgress} a copy for export */
    exportData() {
        return JSON.parse(JSON.stringify(this.load()));
    }

    /**
     * Apply imported progress. 'replace' discards current progress; 'merge' keeps,
     * per sentence, the entry played most recently, and the higher bests.
     * @param {*} imported  untrusted file content
     * @param {'merge'|'replace'} mode
     */
    importData(imported, mode = 'merge') {
        const incoming = normalize(imported);
        if (mode === 'replace') {
            this.data = incoming;
        } else {
            const data = this.load();
            for (const [key, entry] of Object.entries(incoming.sentences)) {
                const mine = data.sentences[key];
                if (!mine || entry.lastPlayed > mine.lastPlayed) data.sentences[key] = entry;
            }
            for (const k of Object.keys(data.totals)) {
                data.totals[k] = Math.max(data.totals[k], incoming.totals[k]);
            }
        }
        this.save();
    }
}

/** Coerce stored/imported data into a valid GameProgress (drops malformed entries). */
function normalize(data) {
    const out = emptyData();
    if (!data || typeof data !== 'object') return out;
    const num = v => (Number.isFinite(v) && v >= 0 ? v : 0);
    if (data.totals && typeof data.totals === 'object') {
        for (const k of Object.keys(out.totals)) out.totals[k] = num(data.totals[k]);
    }
    if (data.sentences && typeof data.sentences === 'object') {
        for (const [key, e] of Object.entries(data.sentences)) {
            if (!e || typeof e !== 'object') continue;
            const mistakes = emptyMistakes();
            if (e.mistakes && typeof e.mistakes === 'object') {
                mistakes.cell = num(e.mistakes.cell);
                for (const [c, n] of Object.entries(e.mistakes.case || {})) mistakes.case[c] = num(n);
            }
            out.sentences[key] = {
                plays: num(e.plays), perfect: num(e.perfect), perfectStreak: num(e.perfectStreak),
                lastPlayed: num(e.lastPlayed), lastMistakes: num(e.lastMistakes), mistakes,
            };
        }
    }
    return out;
}

/** App-wide instance backed by localStorage. */
export const progressStore = new ProgressStore();
