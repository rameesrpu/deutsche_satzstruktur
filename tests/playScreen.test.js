import { test, assertEqual } from './assert.js';
import { progressSegments, sentenceParts } from '../js/playScreen.js';

export function runPlayScreenTests() {
    test('progressSegments: done / current / todo', () =>
        assertEqual(progressSegments(4, 1), ['done', 'current', 'todo', 'todo']));
    test('progressSegments: finished current sentence counts as done', () =>
        assertEqual(progressSegments(3, 2, true), ['done', 'done', 'done']));
    test('progressSegments: empty', () => assertEqual(progressSegments(0, 0), []));

    const texts = ['Am', 'Fenster', 'sitzt', 'eine', 'junge', 'Frau.'];
    test('sentenceParts: past, framed phrase, preview, hidden rest', () =>
        assertEqual(sentenceParts(texts, [2, 2], 5), {
            parts: [{ text: 'Am Fenster', kind: 'past' }, { text: 'sitzt', kind: 'current' },
                { text: 'eine junge Frau.', kind: 'next' }],
            more: false,
        }));
    test('sentenceParts: phrase at the start, one-word preview, more hidden', () =>
        assertEqual(sentenceParts(texts, [0, 1], 2), {
            parts: [{ text: 'Am Fenster', kind: 'current' }, { text: 'sitzt', kind: 'next' }],
            more: true,
        }));
    test('sentenceParts: last phrase has no preview', () =>
        assertEqual(sentenceParts(texts, [3, 5], 6).parts.map(p => p.kind), ['past', 'current']));
    test('sentenceParts: complete sentence', () =>
        assertEqual(sentenceParts(texts, null), {
            parts: [{ text: 'Am Fenster sitzt eine junge Frau.', kind: 'past' }], more: false }));
}
