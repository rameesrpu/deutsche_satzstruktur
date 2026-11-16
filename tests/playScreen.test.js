import { test, assertEqual } from './assert.js';
import { tagged } from './stubs.js';
import { progressSegments, sentenceParts, playSentenceTexts } from '../js/playScreen.js';

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

    const give = flags => {
        const words = tagged('Ich gebe dem Patienten einen Tee.', 'S.ich V.ich O.m.dat O.m.dat O.m.akk O.m.akk');
        return { words, manualItems: [{}], currentIndex: 0, waitingForContinue: false,
            getItemWordRange: () => [2, 3], articleBlank: false, ...flags };
    };
    test('playSentenceTexts: plain texts when articleBlank is off', () =>
        assertEqual(playSentenceTexts(give()), ['Ich', 'gebe', 'dem', 'Patienten', 'einen', 'Tee.']));
    test('playSentenceTexts: articleBlank blanks the phrase and later articles', () =>
        assertEqual(playSentenceTexts(give({ articleBlank: true })),
            ['Ich', 'gebe', '___', 'Patienten', '___', 'Tee.']));
    test('playSentenceTexts: placed articles before the phrase stay', () =>
        assertEqual(playSentenceTexts(give({ articleBlank: true, getItemWordRange: () => [4, 5] })),
            ['Ich', 'gebe', 'dem', 'Patienten', '___', 'Tee.']));
    test('playSentenceTexts: finished sentence is not blanked', () =>
        assertEqual(playSentenceTexts(give({ articleBlank: true, waitingForContinue: true })),
            ['Ich', 'gebe', 'dem', 'Patienten', 'einen', 'Tee.']));
}
