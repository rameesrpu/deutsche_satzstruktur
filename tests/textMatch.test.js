// textMatch: pure typed/spoken text comparison for rungs 4 and 5 of the review ladder

import { test, assertEqual } from './assert.js';
import { compareTyped, speechMatch, tokens, fold, SPEECH_PASS } from '../js/textMatch.js';

const st = (e, t) => compareTyped(e, t).words.map(w => w.status);

export function runTextMatchTests() {
    test('tokens/fold basics', () => {
        assertEqual(tokens('„Dr. Kühn“ kommt, E-Mail!'), ['Dr', 'Kühn', 'kommt', 'E-Mail']);
        assertEqual(tokens(null), []);
        assertEqual(['Größe', 'Ärzte', '9', '13'].map(fold), ['groesse', 'aerzte', 'neun', '13']);
        assertEqual(SPEECH_PASS, 0.8);
    });
    test('typed: exact', () => assertEqual(compareTyped('Ich bin Ärztin.', 'Ich bin Ärztin').pass, true));
    test('typed: ae for ä, ss for ß', () => assertEqual(st('Die Ärztin heißt Petra.', 'Die Aerztin heisst Petra'), ['ok', 'ok', 'ok', 'ok']));
    test('typed: lower-case ae is case', () => assertEqual(st('Die Ärztin', 'Die aerztin'), ['ok', 'case']));
    test('typed: capital only → case, still a pass', () => {
        const r = compareTyped('Ich brauche einen Tisch.', 'ich brauche einen tisch');
        assertEqual(r.words.map(w => w.status), ['case', 'ok', 'ok', 'case']); assertEqual(r.pass, true);
    });
    test('typed: two letters swapped is distance 2 → wrong', () =>
        assertEqual(st('Ich arbeite im Krankenhaus.', 'Ich arbeite im Krankenhuas'), ['ok', 'ok', 'ok', 'wrong']));
    test('typed: single substitution → typo', () =>
        assertEqual(st('Ich arbeite im Krankenhaus.', 'Ich arbeite im Krankenhous'), ['ok', 'ok', 'ok', 'typo']));
    test('typed: short word one letter off → wrong', () => assertEqual(st('Ich bin neu.', 'Ich bin nei'), ['ok', 'ok', 'wrong']));
    test('typed: wrong article is wrong, not a typo', () => assertEqual(st('Ich sehe den Mann.', 'Ich sehe dem Mann'), ['ok', 'ok', 'wrong', 'ok']));
    test('typed: missing word keeps alignment', () => assertEqual(st('Sie gibt sie ihr.', 'Sie gibt ihr'), ['ok', 'ok', 'missing', 'ok']));
    test('typed: extra word', () => {
        const r = compareTyped('Ich bin neu.', 'Ich bin sehr neu');
        assertEqual(r.extra, ['sehr']); assertEqual(r.pass, false);
    });
    test('typed: empty input', () => {
        const r = compareTyped('Ich bin neu.', '   ');
        assertEqual(r.words.map(w => w.status), ['missing', 'missing', 'missing']); assertEqual(r.pass, false);
    });
    test('typed: digit for a number word', () => assertEqual(compareTyped('Der Termin ist um neun Uhr.', 'Der Termin ist um 9 Uhr').pass, true));
    test('typed: abbreviation', () => assertEqual(compareTyped('Dr. Kühn kommt.', 'Dr Kuehn kommt').pass, true));
    test('speech: all heard', () => assertEqual(speechMatch('Heute muss ich arbeiten.', ['heute muss ich arbeiten']).pass, true));
    test('speech: 4 of 5 passes, 3 of 5 fails', () => {
        assertEqual(speechMatch('Ich gehe heute zum Arzt.', ['ich gehe heute zum']).pass, true);
        assertEqual(speechMatch('Ich gehe heute zum Arzt.', ['ich gehe zum']).pass, false);
    });
    test('speech: best alternative wins', () =>
        assertEqual(speechMatch('Ich bin Ärztin.', ['ich bin erst in', 'ich bin Ärztin']).best, 'ich bin Ärztin'));
    test('speech: order matters', () => assertEqual(speechMatch('Ich bin neu hier.', ['hier neu bin ich']).ratio, 0.25));
    test('speech: digits', () => assertEqual(speechMatch('Ich habe zwei Brüder.', ['ich habe 2 Brüder']).pass, true));
    test('speech: nothing heard', () => {
        const r = speechMatch('Ich bin neu.', []);
        assertEqual(r.ratio, 0); assertEqual(r.best, '');
    });
    test('speech: heard flags per expected word', () =>
        assertEqual(speechMatch('Ich gehe zum Arzt', ['ich gehe arzt']).words.map(w => w.heard), [true, true, false, true]));
}
