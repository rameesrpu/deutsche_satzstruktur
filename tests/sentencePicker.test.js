import { test, assertEqual, assert } from './assert.js';

import { pickNextSentence, reviewWeight, REVIEW_MAX_AGE_DAYS } from '../js/sentencePicker.js';

const lib = (id, level, category) => ({ id, text: `s${id}`, source: 'library', level, category });
const SENTENCES = [
    lib(1, 'A1', 'x'), lib(2, 'A1', 'x'), lib(3, 'A1', 'x'),
    lib(4, 'A1', 'y'), lib(5, 'A1', 'y'),
    lib(6, 'B1', 'z'),
    { id: 7, text: 'custom' },
];
const first = () => 0;   // random() stub: always pick the first candidate
const last = () => 0.999; // always pick the last candidate

const DAY = 24 * 60 * 60 * 1000;
const NOW = 100 * DAY;
const entry = ({ cell = 0, dat = 0, last = 0, streak = 0, ago = 0 }) => ({
    plays: 1, perfect: 0, perfectStreak: streak, lastPlayed: NOW - ago * DAY, lastMistakes: last,
    mistakes: { case: dat ? { dat } : {}, cell },
});

export function runSentencePickerTests() {
    test('picker random-in-category: only current category, skips current and used', () => {
        const used = new Set([2]);
        const r = pickNextSentence({ mode: 'random-in-category', sentences: SENTENCES, currentId: 1,
            usedIds: used, level: 'A1', category: 'x', random: first });
        assertEqual(r.sentence.id, 3);
        assertEqual([...r.usedIds].sort(), [1, 2]);
        assertEqual([...used], [2], 'input set not mutated');
    });

    test('picker random-in-category: all seen → reset but avoid the just-played one', () => {
        const r = pickNextSentence({ mode: 'random-in-category', sentences: SENTENCES, currentId: 3,
            usedIds: new Set([1, 2]), level: 'A1', category: 'x', random: first });
        assertEqual(r.sentence.id, 1);
        assertEqual([...r.usedIds], [3]);
    });

    test('picker random-in-category: single-sentence list repeats it', () => {
        const r = pickNextSentence({ mode: 'random-in-category', sentences: SENTENCES, currentId: 6,
            level: 'B1', category: 'z', random: first });
        assertEqual(r.sentence.id, 6);
    });

    test('picker random-in-category: no category → all sentences', () => {
        const r = pickNextSentence({ mode: 'random-in-category', sentences: SENTENCES, currentId: 1,
            level: 'A1', random: last });
        assertEqual(r.sentence.id, 7);
    });

    test('picker random-in-category: empty list → null', () => {
        const r = pickNextSentence({ mode: 'random-in-category', sentences: SENTENCES, level: 'C1', category: 'q' });
        assertEqual(r.sentence, null);
    });

    test('picker custom: only sentences without source', () => {
        const r = pickNextSentence({ mode: 'custom', sentences: SENTENCES, level: 'custom', random: first });
        assertEqual(r.sentence.id, 7);
    });

    test('picker story: next in order, wraps, ignores used ids', () => {
        const pick = currentId => pickNextSentence({ mode: 'story', sentences: SENTENCES, currentId,
            usedIds: new Set([2]), level: 'A1', category: 'x' }).sentence.id;
        assertEqual(pick(1), 2);
        assertEqual(pick(3), 1, 'wraps');
        assertEqual(pick(99), 1, 'current not in category → first');
    });

    test('picker story: no category falls back to random', () => {
        const r = pickNextSentence({ mode: 'story', sentences: SENTENCES, currentId: 1, level: 'A1', random: first });
        assertEqual(r.mode, 'random-in-category');
        assertEqual(r.sentence.id, 2);
    });

    test('picker multi-category: 5 per category, then a different category', () => {
        let batchState = { played: 0, category: null };
        let usedIds = new Set();
        let currentId = null;
        const categories = [];
        for (let i = 0; i < 6; i++) {
            const r = pickNextSentence({ mode: 'multi-category', sentences: SENTENCES, currentId, usedIds,
                selectedLevels: ['A1'], batchState, random: first });
            assertEqual(r.mode, 'multi-category');
            assertEqual(r.sentence.source, 'library');
            assertEqual(r.sentence.level, 'A1');
            categories.push(r.sentence.category);
            ({ batchState, usedIds } = r);
            currentId = r.sentence.id;
        }
        assertEqual(categories, ['x', 'x', 'x', 'x', 'x', 'y']);
        assertEqual(batchState.played, 1);
    });

    test('picker multi-category: category exhausted → resets only that category', () => {
        const r = pickNextSentence({ mode: 'multi-category', sentences: SENTENCES, currentId: 3,
            usedIds: new Set([1, 2, 4]), selectedLevels: ['A1'],
            batchState: { played: 2, category: { level: 'A1', category: 'x' } }, random: first });
        assertEqual(r.sentence.id, 1);
        assert(r.usedIds.has(4), 'other category history kept');
        assertEqual(r.batchState.played, 3);
    });

    test('picker multi-category: no library sentences in levels → random fallback', () => {
        const r = pickNextSentence({ mode: 'multi-category', sentences: SENTENCES, currentId: 1,
            selectedLevels: ['C1'], level: 'A1', category: 'y', random: first });
        assertEqual(r.mode, 'random-in-category');
        assertEqual(r.sentence.id, 4);
        assertEqual(r.batchState.played, 0);
    });

    test('reviewWeight: mistakes × age, halved per perfect play, 0 without mistakes', () => {
        assertEqual(reviewWeight(null, NOW), 0, 'never played');
        assertEqual(reviewWeight(entry({}), NOW), 0, 'never missed');
        assertEqual(reviewWeight(entry({ cell: 1, dat: 2 }), NOW), 3, 'old mistakes, just played');
        assertEqual(reviewWeight(entry({ cell: 1, dat: 2, last: 1 }), NOW), 5, 'last play counts double');
        assertEqual(reviewWeight(entry({ cell: 1, ago: 2 }), NOW), 3, '2 days old → ×3');
        assertEqual(reviewWeight(entry({ cell: 1, ago: 365 }), NOW), 1 + REVIEW_MAX_AGE_DAYS, 'age capped');
        assertEqual(reviewWeight(entry({ cell: 4, streak: 2 }), NOW), 1, 'two perfect plays → ÷4');
    });

    // s1: weight 1, s2: weight 3, s3: never missed; key by text like progressStore
    const PROGRESS = { s1: entry({ cell: 1 }), s2: entry({ cell: 3 }), s3: entry({}), s4: entry({ cell: 2 }) };
    const review = opts => pickNextSentence({ mode: 'review', sentences: SENTENCES, level: 'A1', category: 'x',
        getProgress: s => PROGRESS[s.text] || null, now: NOW, ...opts });

    test('picker review: weighted pick within the category, skips unweighted', () => {
        // candidates s1 (w1), s2 (w3), total 4: r < 1 → s1, r ≥ 1 → s2
        assertEqual(review({ random: () => 0.2 }).sentence.id, 1);
        assertEqual(review({ random: () => 0.3 }).sentence.id, 2);
        assertEqual(review({ random: last }).sentence.id, 2);
        assertEqual(review({ random: first }).mode, 'review');
    });

    test('picker review: avoids current and used, resets history when only those remain', () => {
        const a = review({ currentId: 2, random: last });
        assertEqual(a.sentence.id, 1);
        assertEqual([...a.usedIds], [2]);
        const b = review({ currentId: 1, usedIds: new Set([2]), random: first });
        assertEqual(b.sentence.id, 2, 'all weighted seen → repeat rather than fall back');
        assertEqual([...b.usedIds], [1], 'history reset');
    });

    test('picker review: selectedLevels widens the pool across categories', () => {
        const r = review({ selectedLevels: ['A1'], currentId: 2, usedIds: new Set([1]), random: first });
        assertEqual(r.sentence.id, 4);
    });

    test('picker review: nothing to review → random fallback', () => {
        const r = review({ getProgress: () => null, currentId: 1, random: first });
        assertEqual(r.mode, 'random-in-category');
        assertEqual(r.sentence.id, 2);
    });
}
