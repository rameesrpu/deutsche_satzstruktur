// textMatch: pure typed/spoken text comparison for rungs 4 and 5 of the review ladder

import { test, assert, assertEqual } from './assert.js';
import { compareTyped, speechMatch, tokens, fold, SPEECH_PASS } from '../js/textMatch.js';

const st = (e, t) => compareTyped(e, t).words.map(w => w.status);

export function runTextMatchTests() {
    test('tokens/fold basics', () => {
        assertEqual(tokens('„Dr. Kühn“ kommt, E-Mail!'), ['Dr', 'Kühn', 'kommt', 'E-Mail']);
        assertEqual(tokens(null), []);
        assertEqual(['Größe', 'Ärzte', '9', '13', '20', '21'].map(fold), ['groesse', 'aerzte', 'neun', 'dreizehn', 'zwanzig', '21']);
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
    test('typed: digits 0, 5, 10, 12 and back', () => {
        assertEqual(compareTyped('Er kommt um zwölf Uhr.', 'Er kommt um 12 Uhr').pass, true);
        assertEqual(compareTyped('Ich habe fünf Katzen.', 'Ich habe 5 Katzen').pass, true);
        assertEqual(compareTyped('Es ist null Uhr zehn.', 'Es ist 0 Uhr 10').pass, true);
        assertEqual(compareTyped('Er kommt um 12 Uhr.', 'Er kommt um zwölf Uhr').pass, true);
        assertEqual(compareTyped('Ich habe 5 Katzen.', 'Ich habe fuenf Katzen').pass, true);
        assertEqual(st('Neun Uhr.', '9 Uhr'), ['ok', 'ok']);
    });
    test('speech: digits 5 and 12', () => {
        assertEqual(speechMatch('Ich habe fünf Katzen.', ['ich habe 5 Katzen']).ratio, 1);
        assertEqual(speechMatch('Es ist zwölf Uhr.', ['es ist 12 Uhr']).ratio, 1);
    });
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
    // F2: a wrong case ending is wrong, not a typo
    test('typed: wrong case endings of articles/determiners are wrong', () => {
        const pairs = [['Er hat einen Hund.', 'Er hat einem Hund'], ['Er hat keinen Hund.', 'Er hat keinem Hund'],
            ['Er hat meinen Hund.', 'Er hat meinem Hund'], ['Das ist das Auto einer Frau.', 'Das ist das Auto eines Frau'],
            ['Ich gebe ihnen das Buch.', 'Ich gebe ihren das Buch']];
        for (const [e, t] of pairs) {
            assertEqual(compareTyped(e, t).pass, false, t);
            assert(st(e, t).includes('wrong'), t);
        }
    });
    test('typed: ending-only difference of other words is wrong', () => {
        assertEqual(st('Ich esse guten Käse.', 'Ich esse gutem Käse'), ['ok', 'ok', 'wrong', 'ok']);
        assertEqual(st('Ich brauche einen Tisch.', 'Ich brauche einen Tische'), ['ok', 'ok', 'ok', 'wrong']);
    });
    test('typed: real typos stay typos', () => {
        assertEqual(st('Ich arbeite im Krankenhaus.', 'Ich arbeite im Krankenhous'), ['ok', 'ok', 'ok', 'typo']);
        assertEqual(st('Der Mann kommt.', 'Der Man kommt'), ['ok', 'typo', 'ok']);
    });
    // F3
    test('speech: heard words but none matched → best is the first alternative', () => {
        const r = speechMatch('Ich bin neu.', ['hallo welt', 'hallo']);
        assertEqual([r.best, r.ratio], ['hallo welt', 0]);
    });
    // F8: abbreviations, numbers 13–20, hyphenated names
    test('typed: Dr. ↔ Doktor, St. ↔ Sankt, Prof. ↔ Professor, Nr. ↔ Nummer', () => {
        assertEqual(compareTyped('Ruf Dr. Kühn an!', 'Ruf Doktor Kühn an').pass, true);
        assertEqual(compareTyped('Ruf Doktor Kühn an!', 'Ruf Dr. Kühn an').pass, true);
        assertEqual(compareTyped('Prof. Weber kommt.', 'Professor Weber kommt').pass, true);
        assertEqual(compareTyped('Zimmer Nr. 5.', 'Zimmer Nummer fünf').pass, true);
        assertEqual(compareTyped('Das ist St. Georg.', 'Das ist Sankt Georg').pass, true);
    });
    test('typed: digits 13–20 for number words and back', () => {
        assertEqual(compareTyped('Wir treffen uns um 18 Uhr.', 'Wir treffen uns um achtzehn Uhr').pass, true);
        assertEqual(compareTyped('Er ist zwanzig.', 'Er ist 20').pass, true);
        assertEqual(compareTyped('Sie ist dreizehn.', 'Sie ist 13').pass, true);
    });
    test('typed: hyphenated name typed with spaces', () => {
        assertEqual(compareTyped('Das ist das alte St.-Lukas-Krankenhaus.', 'Das ist das alte St. Lukas Krankenhaus').pass, true);
        assertEqual(compareTyped('Das ist das alte St.-Lukas-Krankenhaus.', 'Das ist das alte Sankt-Lukas-Krankenhaus').pass, true);
        assertEqual(compareTyped('Das ist das alte St.-Lukas-Krankenhaus.', 'Das ist das alte St.-Lukas-Krankenhaus').pass, true);
        assertEqual(compareTyped('Das ist das alte St.-Lukas-Krankenhaus.', 'Das ist das alte St. Lukas').pass, false);
    });
    test('speech: Doktor for Dr., achtzehn for 18', () => {
        assertEqual(speechMatch('Ruf Dr. Kühn an!', ['ruf doktor kühn an']).ratio, 1);
        assertEqual(speechMatch('Um 18 Uhr.', ['um achtzehn uhr']).ratio, 1);
    });
}
