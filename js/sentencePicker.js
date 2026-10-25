// Game-mode sentence selection. Pure: no DOM, no window.app — the caller loads
// the returned sentence and stores the returned usedIds/batchState.

const MULTI_CATEGORY_BATCH_SIZE = 5;

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
 *
 * Random modes avoid sentences in `usedIds`; once all are seen, history resets
 * (whole list, or just the current category in multi-category) but the
 * just-played sentence is still avoided.
 *
 * @returns {{ sentence: Object|null, usedIds: Set, batchState: {played: number, category: ?{level, category}}, mode: string }}
 *   `mode` is the mode actually used (after fallbacks). Inputs are not mutated.
 */
function pickNextSentence({
    mode,
    sentences,
    currentId = null,
    usedIds = new Set(),
    level = null,
    category = null,
    selectedLevels = [],
    batchState = { played: 0, category: null },
    random = Math.random,
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

    let available;
    if (mode === 'custom' || level === 'custom') {
        available = sentences.filter(s => !s.source);
    } else if (level && category) {
        available = sentences.filter(inCategory(level, category));
    } else {
        available = sentences;
    }
    if (available.length === 0) return result(null, usedIds, batchState, mode);

    const ids = new Set(usedIds);
    return result(pickUnseen(available, ids, set => set.clear()), ids, batchState, mode);
}
