// speakScreen: pure logic of rung 5 "Sprechen"

import { test, assertEqual } from './assert.js';
import { SPEECH_TRIES, CUE_MS, speakMode, speakStep } from '../js/speakScreen.js';

const PASS = { pass: true };
const FAIL = { pass: false };

export function runSpeakScreenTests() {
    test('speakScreen: constants', () => {
        assertEqual(SPEECH_TRIES, 3);
        assertEqual(CUE_MS, 4000);
    });
    test('speakMode: unavailable or off → self, on → recognise, unasked → ask', () => {
        assertEqual(speakMode({ available: false, choice: null }), 'self');
        assertEqual(speakMode({ available: false, choice: 'on' }), 'self');
        assertEqual(speakMode({ available: true, choice: 'off' }), 'self');
        assertEqual(speakMode({ available: true, choice: 'on' }), 'recognise');
        assertEqual(speakMode({ available: true, choice: null }), 'ask');
    });
    test('speakStep: pass on the first try is done and ok', () => {
        assertEqual(speakStep({ tries: 0 }, PASS, null), { tries: 1, done: true, ok: true, fallback: false });
    });
    test('speakStep: three fails are done and not ok on the third', () => {
        const a = speakStep({ tries: 0 }, FAIL, null);
        assertEqual(a, { tries: 1, done: false, ok: false, fallback: false });
        const b = speakStep(a, FAIL, null);
        assertEqual(b, { tries: 2, done: false, ok: false, fallback: false });
        assertEqual(speakStep(b, FAIL, null), { tries: 3, done: true, ok: false, fallback: false });
    });
    test('speakStep: fail then pass is ok', () => {
        assertEqual(speakStep({ tries: 2 }, PASS, null), { tries: 3, done: true, ok: true, fallback: false });
    });
    test('speakStep: no-speech, no-result and aborted do not count a try', () => {
        for (const err of ['no-speech', 'no-result', 'aborted']) {
            assertEqual(speakStep({ tries: 1 }, FAIL, err), { tries: 1, done: false, ok: false, fallback: false }, err);
        }
    });
    test('speakStep: not-allowed and other errors fall back to the self-check', () => {
        for (const err of ['not-allowed', 'network', 'start-failed']) {
            assertEqual(speakStep({ tries: 1 }, FAIL, err), { tries: 1, done: false, ok: false, fallback: true }, err);
        }
    });
}
