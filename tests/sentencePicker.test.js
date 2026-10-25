import { loadScripts } from './stubs.js';
import { test, assertEqual, assert } from './assert.js';

const { pickNextSentence } = loadScripts(['js/sentencePicker.js'], ['pickNextSentence']);

const lib = (id, level, category) => ({ id, text: `s${id}`, source: 'library', level, category });
const SENTENCES = [
    lib(1, 'A1', 'x'), lib(2, 'A1', 'x'), lib(3, 'A1', 'x'),
    lib(4, 'A1', 'y'), lib(5, 'A1', 'y'),
    lib(6, 'B1', 'z'),
    { id: 7, text: 'custom' },
];
const first = () => 0;   // random() stub: always pick the first candidate
const last = () => 0.999; // always pick the last candidate

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
}
