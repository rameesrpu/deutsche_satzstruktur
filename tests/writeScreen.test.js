// writeScreen: pure logic of rung 4 "Schreiben" (dictation)

import { test, assertEqual } from './assert.js';
import { compareTyped } from '../js/textMatch.js';
import { WRITE_TRIES, writeStep, retryText } from '../js/writeScreen.js';

export function runWriteScreenTests() {
    test('writeStep: pass on the first try is done and ok', () => {
        assertEqual(WRITE_TRIES, 2);
        assertEqual(writeStep({ tries: 0 }, { pass: true }), { tries: 1, done: true, ok: true, reveal: false });
    });
    test('writeStep: fail then pass is ok', () => {
        const a = writeStep({ tries: 0 }, { pass: false });
        assertEqual(a, { tries: 1, done: false, ok: false, reveal: false });
        assertEqual(writeStep(a, { pass: true }), { tries: 2, done: true, ok: true, reveal: false });
    });
    test('writeStep: two fails reveal the sentence', () => {
        const a = writeStep({ tries: 0 }, { pass: false });
        assertEqual(writeStep(a, { pass: false }), { tries: 2, done: true, ok: false, reveal: true });
    });
    test('retryText: typos stay, wrong words become blanks of the expected length', () => {
        assertEqual(retryText(compareTyped('Ich sehe den Mann.', 'Ich sehe dem Man')), 'Ich sehe ___ Man');
    });
    test('retryText: missing words become blanks, extras are dropped', () => {
        assertEqual(retryText(compareTyped('Ich sehe den Mann.', 'Ich den Mann bitte')), 'Ich ____ den Mann');
    });
    test('retryText: case differences keep what was typed', () => {
        assertEqual(retryText(compareTyped('Ich sehe den Mann.', 'ich sehe den Mann')), 'ich sehe den Mann');
    });
}
