// Game-mode sentence selection. Pure: no DOM, no window.app — the caller loads
// the returned sentence and stores the returned usedIds/batchState.

export const MULTI_CATEGORY_BATCH_SIZE = 5;

const DAY_MS = 24 * 60 * 60 * 1000;
/** Age factor stops growing after this many days since the last play. */
export const REVIEW_MAX_AGE_DAYS = 30;

/**
 * Review priority of a sentence (0 = nothing to review). Simple spaced repetition:
 * mistakes (last play counts double) × age factor (1 + days since last played,
 * capped), halved for every perfect play in a row since the last mistake.
 * Never-played and never-missed sentences get 0.
 * @param {?SentenceProgress} entry
 * @param {number} now  ms timestamp
 * @returns {number}
 */
export function reviewWeight(entry, now) {
    if (!entry) return 0;
    const total = entry.mistakes.cell + Object.values(entry.mistakes.case).reduce((a, b) => a + b, 0);
    if (total === 0) return 0;
    const ageDays = Math.min(Math.max(now - entry.lastPlayed, 0) / DAY_MS, REVIEW_MAX_AGE_DAYS);
    return (total + 2 * entry.lastMistakes) * (1 + ageDays) / 2 ** entry.perfectStreak;
}

/**
 * Pick the next sentence to play.
 *
 * Modes:
 * - 'random-in-category': random unseen sentence from level/category (no category → all sentences)
 * - 'custom': random unseen user-created sentence (no `source`)
 * - 'story': next sentence in order within level/category, wrapping; without a
 *   category it falls back to 'random-in-category'
 * - 'multi-category': MULTI_CATEGORY_BATCH_SIZE sentences from one library category of
 *   `selectedLevels`, then a different random category; without matching library
 *   sentences it falls back to 'random-in-category'
 * - 'review': weighted random pick by reviewWeight() of `getProgress(sentence)`, from
 *   the library sentences of `selectedLevels` if non-empty, else the same list as
 *   'random-in-category'. Skips the current sentence and `usedIds` while other weighted
 *   sentences remain; with nothing to review it falls back to 'random-in-category'
 *
 * Random modes avoid sentences in `usedIds`; once all are seen, history resets
 * (whole list, or just the current category in multi-category) but the
 * just-played sentence is still avoided.
 *
 * @returns {{ sentence: ?Sentence, usedIds: Set, batchState: {played: number, category: ?{level, category}}, mode: string }}
 *   `mode` is the mode actually used (after fallbacks). Inputs are not mutated.
 */
export function pickNextSentence({
    mode,
    sentences,
    currentId = null,
    usedIds = new Set(),
    level = null,
    category = null,
    selectedLevels = [],
    batchState = { played: 0, category: null },
    random = Math.random,
    getProgress = () => null,
    now = Date.now(),
}) {
    const pickFrom = list => list[Math.floor(random() * list.length)];
    const inCategory = (lvl, cat) => s => s.source === 'library' && s.level === lvl && s.category === cat;
    const result = (sentence, ids, batch, usedMode) =>
        ({ sentence, usedIds: ids, batchState: batch, mode: usedMode });

    // Random unseen sentence from `available`; `resetIds` are forgotten when all are seen
    const pickUnseen = (available, ids, resetIds) => {
        ids.add(currentId);
        let unseen = available.filter(s => !ids.has(s.id));
        if (unseen.length === 0) {
            resetIds(ids);
            ids.add(currentId);
            unseen = available.filter(s => !ids.has(s.id));
        }
        return pickFrom(unseen.length > 0 ? unseen : available);
    };

    // List for the random modes: custom sentences, one category, or everything
    const randomPool = () => {
        if (mode === 'custom' || level === 'custom') return sentences.filter(s => !s.source);
        if (level && category) return sentences.filter(inCategory(level, category));
        return sentences;
    };

    if (mode === 'review') {
        const pool = selectedLevels.length > 0
            ? sentences.filter(s => s.source === 'library' && selectedLevels.includes(s.level))
            : randomPool();
        const weighted = pool
            .map(s => ({ s, w: reviewWeight(getProgress(s), now) }))
            .filter(c => c.w > 0);
        const fresh = weighted.filter(c => c.s.id !== currentId && !usedIds.has(c.s.id));
        const others = weighted.filter(c => c.s.id !== currentId);
        const candidates = fresh.length > 0 ? fresh : others.length > 0 ? others : weighted;
        if (candidates.length > 0) {
            let r = random() * candidates.reduce((sum, c) => sum + c.w, 0);
            const chosen = candidates.find(c => (r -= c.w) < 0) || candidates[candidates.length - 1];
            const ids = new Set(fresh.length > 0 ? usedIds : []);
            ids.add(currentId);
            return result(chosen.s, ids, batchState, mode);
        }
        mode = 'random-in-category';
    }

    if (mode === 'story') {
        if (!level || !category || level === 'custom') {
            return pickNextSentence({ mode: 'random-in-category', sentences, currentId, usedIds, level, category, selectedLevels, batchState, random });
        }
        const list = sentences.filter(inCategory(level, category));
        if (list.length === 0) return result(null, usedIds, batchState, mode);
        const idx = list.findIndex(s => s.id === currentId);
        return result(list[(idx + 1) % list.length], usedIds, batchState, mode);
    }

    if (mode === 'multi-category') {
        const multi = sentences.filter(s => s.source === 'library' && selectedLevels.includes(s.level));
        if (multi.length > 0) {
            let played = batchState.played + 1;
            let current = batchState.category;
            if (!current || played > MULTI_CATEGORY_BATCH_SIZE) {
                const categories = [];
                const seen = new Set();
                multi.forEach(s => {
                    const key = `${s.level}/${s.category}`;
                    if (!seen.has(key)) {
                        seen.add(key);
                        categories.push({ level: s.level, category: s.category });
                    }
                });
                const currentKey = current ? `${current.level}/${current.category}` : null;
                const others = categories.filter(c => `${c.level}/${c.category}` !== currentKey);
                current = pickFrom(others.length > 0 ? others : categories);
                played = 1;
            }
            const available = sentences.filter(inCategory(current.level, current.category));
            const ids = new Set(usedIds);
            const sentence = pickUnseen(available, ids, set => available.forEach(s => set.delete(s.id)));
            return result(sentence, ids, { played, category: current }, mode);
        }
        mode = 'random-in-category';
    }

    const available = randomPool();
    if (available.length === 0) return result(null, usedIds, batchState, mode);

    const ids = new Set(usedIds);
    return result(pickUnseen(available, ids, set => set.clear()), ids, batchState, mode);
}
