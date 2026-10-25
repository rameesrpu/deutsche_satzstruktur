// Game rules are currently methods on GameMode (to be extracted in R2).
// We call them on a minimal `this` so the DOM-heavy constructor never runs.

import { loadScripts } from './stubs.js';
import { test, assertEqual } from './assert.js';

const { GridViewModel, GameMode } = loadScripts(
    ['js/gridview.js', 'js/gamemode.js'], ['GridViewModel', 'GameMode']);

export function runGameRuleTests() {
    const ctx = { gridViewModel: new GridViewModel(null) };
    const validate = (w, row, col, caseType) =>
        GameMode.prototype.validatePlacement.call(ctx, w, row, col, caseType);

    const dativObject = { type: 'object', text: 'Mann', gender: 'm', case: 'dat', number: 'sg' };
    const verb = { type: 'verb', text: 'kaufe', case: 'nom', number: 'sg', conjugation: { pronoun: 'ich' } };
    const subject = { type: 'subject', text: 'Ich', case: 'nom', number: 'sg', conjugation: { pronoun: 'ich' } };

    test('validatePlacement: object correct cell + case', () => assertEqual(validate(dativObject, 1, 1, 'dat'), true));
    test('validatePlacement: object wrong case fails', () => assertEqual(validate(dativObject, 1, 1, 'akk'), false));
    test('validatePlacement: object wrong cell fails', () => assertEqual(validate(dativObject, 1, 3, 'dat'), false));
    test('validatePlacement: verb ignores case', () => assertEqual(validate(verb, 2, 2, 'gen'), true));
    test('validatePlacement: verb wrong cell fails', () => assertEqual(validate(verb, 1, 2, 'nom'), false));
    test('validatePlacement: subject requires nom', () => {
        assertEqual(validate(subject, 2, 2, 'nom'), true);
        assertEqual(validate(subject, 2, 2, 'akk'), false);
    });
    test('validatePlacement: word without cell always fails', () =>
        assertEqual(validate({ type: 'preposition', text: 'mit', case: 'nom' }, 1, 1, 'nom'), false));

    test('getTimePoints: thresholds', () => {
        const pts = ms => GameMode.prototype.getTimePoints.call({}, ms).points;
        assertEqual([0, 999, 1000, 2500, 4000, 6000, 9999, 10000, 60000].map(pts),
            [30, 30, 25, 20, 15, 10, 5, 0, 0]);
    });
}
