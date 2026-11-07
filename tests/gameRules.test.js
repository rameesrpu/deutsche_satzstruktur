import { test, assertEqual } from './assert.js';

import { GridViewModel } from '../js/gridview.js';
import { validatePlacement, getTimePoints, evaluatePlacement, getAutoPlacement, MAX_WRONG_ATTEMPTS,
    explainMistake, explainPrepositionCase, articleFor, placementFeedback }
    from '../js/gameRules.js';

export function runGameRuleTests() {
    const grid = new GridViewModel(null);
    const cellOf = w => grid.getWordPosition(w);
    const validate = (w, row, col, caseType) => validatePlacement(w, row, col, caseType, cellOf(w));
    const ok = (w, row, col, caseType) => validate(w, row, col, caseType).ok;

    const dativObject = { type: 'object', text: 'Mann', gender: 'm', case: 'dat', number: 'sg' };
    const verb = { type: 'verb', text: 'kaufe', case: 'nom', number: 'sg', conjugation: { pronoun: 'ich' } };
    const subject = { type: 'subject', text: 'Ich', case: 'nom', number: 'sg', conjugation: { pronoun: 'ich' } };

    test('validatePlacement: object correct cell + case', () => assertEqual(ok(dativObject, 1, 1, 'dat'), true));
    test('validatePlacement: object wrong case fails', () => assertEqual(ok(dativObject, 1, 1, 'akk'), false));
    test('validatePlacement: object wrong cell fails', () => assertEqual(ok(dativObject, 1, 3, 'dat'), false));
    test('validatePlacement: verb ignores case', () => assertEqual(ok(verb, 2, 2, 'gen'), true));
    test('validatePlacement: verb wrong cell fails', () => assertEqual(ok(verb, 1, 2, 'nom'), false));
    test('validatePlacement: subject requires nom', () => {
        assertEqual(ok(subject, 2, 2, 'nom'), true);
        assertEqual(ok(subject, 2, 2, 'akk'), false);
    });
    test('validatePlacement: word without cell always fails', () =>
        assertEqual(ok({ type: 'preposition', text: 'mit', case: 'nom' }, 1, 1, 'nom'), false));

    test('validatePlacement: reason object for wrong case', () =>
        assertEqual(validate(dativObject, 1, 1, 'akk'),
            { ok: false, cellOk: true, caseOk: false, expectedCase: 'dat', expectedCell: { row: 1, col: 1, label: 'MASCULINE' } }));
    test('validatePlacement: reason object for wrong cell, right case', () =>
        assertEqual(validate(dativObject, 2, 3, 'dat'),
            { ok: false, cellOk: false, caseOk: true, expectedCase: 'dat', expectedCell: { row: 1, col: 1, label: 'MASCULINE' } }));
    test('validatePlacement: verb reason has no expected case', () =>
        assertEqual(validate(verb, 2, 2, 'gen').expectedCase, null));

    test('getTimePoints: thresholds', () => {
        const pts = ms => getTimePoints(ms).points;
        assertEqual([0, 999, 1000, 2500, 4000, 6000, 9999, 10000, 60000].map(pts),
            [30, 30, 25, 20, 15, 10, 5, 0, 0]);
    });

    const place = (row, col, caseType, extra = {}) => evaluatePlacement({
        word: dativObject, row, col, caseType, expectedCell: cellOf(dativObject), ...extra });

    test('evaluatePlacement: correct untimed → 10 points, attempts reset', () => {
        const r = place(1, 1, 'dat', { attempts: 2 });
        assertEqual([r.result.ok, r.points, r.timeColor, r.attempts, r.autoPlace], [true, 10, null, 0, false]);
    });
    test('evaluatePlacement: correct timed → time points + color', () => {
        const r = place(1, 1, 'dat', { elapsedMs: 1500 });
        assertEqual([r.points, r.timeColor], [25, '#52be80']);
    });
    test('evaluatePlacement: wrong → 0 points, attempts increment', () => {
        const r = place(1, 1, 'akk', { attempts: 0, elapsedMs: 500 });
        assertEqual([r.result.ok, r.points, r.attempts, r.autoPlace], [false, 0, 1, false]);
    });
    test(`evaluatePlacement: auto-place after ${MAX_WRONG_ATTEMPTS} wrong attempts`, () => {
        let attempts = 0;
        const flags = [];
        for (let i = 0; i < MAX_WRONG_ATTEMPTS; i++) {
            const r = place(2, 2, 'dat', { attempts });
            attempts = r.attempts;
            flags.push(r.autoPlace);
        }
        assertEqual(flags, [false, false, true]);
    });

    test('getAutoPlacement: expected cell + word case (nom default)', () => {
        assertEqual(getAutoPlacement(dativObject, cellOf(dativObject)), { row: 1, col: 1, caseType: 'dat' });
        assertEqual(getAutoPlacement({ type: 'verb' }, { row: 2, col: 2 }), { row: 2, col: 2, caseType: 'nom' });
        assertEqual(getAutoPlacement(dativObject, null), null);
    });
    test('getAutoPlacement result validates as correct', () => {
        const t = getAutoPlacement(dativObject, cellOf(dativObject));
        assertEqual(ok(dativObject, t.row, t.col, t.caseType), true);
    });

    // --- explainMistake (I3) ---
    const explain = (w, row, col, caseType, extra = {}) =>
        explainMistake({ word: w, result: validate(w, row, col, caseType), ...extra });
    const prep = text => ({ type: 'preposition', text, case: 'nom' });

    test('explainMistake: correct placement → no lines', () =>
        assertEqual(explain(dativObject, 1, 1, 'dat'), []));
    test('explainMistake: fixed-case preposition', () =>
        assertEqual(explain(dativObject, 1, 1, 'akk', { phrase: 'dem Mann', preposition: prep('mit') }),
            ['“mit” → always Dativ']));
    test('explainMistake: contraction names its full form', () =>
        assertEqual(explain(dativObject, 1, 1, 'akk', { preposition: prep('zum') }), ['“zum” = zu dem → Dativ']));
    test('explainMistake: two-way preposition', () => {
        const akk = { ...dativObject, case: 'akk', text: 'Park.' };
        assertEqual(explain(akk, 1, 1, 'dat', { preposition: prep('in') }), ['“in” + Akkusativ: wohin?']);
        assertEqual(explain(dativObject, 1, 1, 'akk', { preposition: prep('auf') }), ['“auf” + Dativ: wo? / wann?']);
    });
    test('explainMistake: separable particle / disagreeing preposition is not cited', () => {
        assertEqual(explain(dativObject, 1, 1, 'akk', { phrase: 'dem Mann.', preposition: prep('an,') }),
            ['“dem Mann” is Dativ here']);
        assertEqual(explainPrepositionCase(prep('mit'), 'nom'), null);
        assertEqual(explainPrepositionCase({ type: 'verb', text: 'mit' }, 'dat'), null);
    });
    test('explainMistake: subject case', () =>
        assertEqual(explain(subject, 2, 2, 'akk'), ['“Ich” is the subject → Nominativ']));
    test('explainMistake: cell by gender, plural, pronoun', () => {
        assertEqual(explain(dativObject, 1, 3, 'dat'), ['“Mann” is masculine (der) → MASCULINE']);
        const kinder = { type: 'object', text: 'Kinder,', gender: 'n', case: 'akk', number: 'pl' };
        assertEqual(explain(kinder, 2, 1, 'akk'), ['“Kinder” is plural → PLURAL']);
        const du = { type: 'subject', text: 'du', case: 'nom', number: 'sg', conjugation: { pronoun: 'du' } };
        assertEqual(explain(du, 2, 2, 'nom'), ['“du” → DU cell']);
        const mich = { type: 'object', text: 'mich!', gender: 'none', case: 'akk', number: 'sg' };
        assertEqual(explain(mich, 1, 1, 'akk'), ['“mich” is the ich form → ICH']);
    });
    test('explainMistake: verb cell by conjugation', () => {
        assertEqual(explain(verb, 1, 2, 'nom'), ['“kaufe” goes with ich → ICH']);
        const imp = { ...verb, text: 'Komm!', conjugation: { pronoun: 'none' } };
        assertEqual(explain(imp, 2, 2, 'nom'), ['“Komm” has no subject (imperative) → IMPERATIV']);
    });
    test('explainMistake: wrong cell and case → two lines', () =>
        assertEqual(explain(dativObject, 2, 3, 'akk', { preposition: prep('mit') }),
            ['“Mann” is masculine (der) → MASCULINE', '“mit” → always Dativ']));

    test('articleFor: full definite article table', () => {
        const table = ['m', 'f', 'n', 'pl'].map(g => ['nom', 'akk', 'dat', 'gen'].map(c => articleFor(g, c)).join(' '));
        assertEqual(table, ['der den dem des', 'die die der der', 'das das dem des', 'die die den der']);
    });
    test('articleFor: unknown gender or case → null', () => {
        assertEqual(articleFor('none', 'nom'), null);
        assertEqual(articleFor('m', null), null);
        assertEqual(articleFor(undefined, 'akk'), null);
    });

    const fb = p => placementFeedback({ ok: true, ...p });
    test('placementFeedback: noun subject names gender, case and article form', () =>
        assertEqual(fb({ word: { type: 'subject', text: 'Heimat.', gender: 'f', case: 'nom', number: 'sg',
            conjugation: { pronoun: 'sie' } }, phrase: 'die Heimat.', caseType: 'nom', cellLabel: 'FEMININ' }),
        { tone: 'ok', title: 'Richtig! Feminin + Nominativ', form: 'die',
            lines: ['Heimat ist feminin (die Heimat), hier Subjekt → Nominativ'] }));
    test('placementFeedback: preposition explains the case', () => {
        const r = fb({ word: dativObject, phrase: 'dem Mann', caseType: 'dat', cellLabel: 'MASKULIN',
            preposition: prep('mit') });
        assertEqual([r.title, r.form, r.lines], ['Richtig! Maskulin + Dativ', 'dem',
            ['Mann ist maskulin (der Mann), nach „mit“ → Dativ']]);
        const im = fb({ word: { type: 'object', text: 'Zimmer', gender: 'n', case: 'dat', number: 'sg' },
            caseType: 'dat', preposition: prep('im') });
        assertEqual(im.lines, ['Zimmer ist Neutrum, „im“ = in dem → Dativ']);
    });
    test('placementFeedback: a bare name gets the form but no "(der Max)"', () => {
        const r = fb({ word: { type: 'subject', text: 'Max', gender: 'm', case: 'nom', number: 'sg',
            conjugation: { pronoun: 'er' } }, phrase: 'Max', caseType: 'nom' });
        assertEqual([r.form, r.lines], ['der', ['Max ist maskulin, hier Subjekt → Nominativ']]);
    });
    test('placementFeedback: plural noun uses the plural article', () => {
        const r = fb({ word: { type: 'object', text: 'Kinder', gender: 'n', case: 'dat', number: 'pl' },
            caseType: 'dat', cellLabel: 'PLURAL' });
        assertEqual([r.title, r.form], ['Richtig! Plural + Dativ', 'den']);
    });
    test('placementFeedback: pronouns and verbs get no article', () => {
        const wir = fb({ word: { type: 'subject', text: 'Wir', case: 'nom', number: 'pl', gender: 'none',
            conjugation: { pronoun: 'wir' } }, caseType: 'nom', cellLabel: 'WIR' });
        assertEqual(wir, { tone: 'ok', title: 'Richtig! wir + Nominativ', form: null,
            lines: ['„Wir“ ist das Subjekt → Nominativ'] });
        const v = fb({ word: verb, caseType: 'nom', cellLabel: 'ICH' });
        assertEqual([v.title, v.form, v.lines], ['Richtig! Verb', null, ['„kaufe“ gehört zu ich → ICH']]);
        const es = fb({ word: { type: 'subject', text: 'Es', gender: 'n', case: 'nom', number: 'sg' },
            caseType: 'nom', cellLabel: 'NEUTRUM' });
        assertEqual([es.title, es.form], ['Richtig! Neutrum + Nominativ', null]);
    });
    test('placementFeedback: auto-placed and wrong', () => {
        const auto = fb({ word: dativObject, caseType: 'dat', auto: true });
        assertEqual([auto.tone, auto.title], ['solved', 'Lösung: Maskulin + Dativ']);
        const result = validatePlacement(dativObject, 1, 1, 'akk', cellOf(dativObject));
        const wrong = placementFeedback({ ok: false, word: dativObject, result, attempts: 1 });
        assertEqual(wrong, { tone: 'wrong', title: 'Nicht ganz · noch 2 Versuche', form: null,
            lines: ['“Mann” is Dativ here'] });
        assertEqual(placementFeedback({ ok: false, word: dativObject, result, attempts: MAX_WRONG_ATTEMPTS }).title,
            'Nicht ganz · hier ist die Lösung');
    });
}
