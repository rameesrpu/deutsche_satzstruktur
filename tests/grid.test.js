import { test, assertEqual } from './assert.js';

import { GridViewModel } from '../js/gridview.js';

// Cell coordinates from GridViewModel.positions
const CELL = {
    du: [1, 2], ich: [2, 2], wir: [3, 2], ihr: [3, 1],
    m: [1, 1], f: [1, 3], n: [2, 1], pl: [2, 3], imperative: [3, 3],
};

const word = (fields) => ({ gender: 'none', case: 'nom', number: 'sg', ...fields });
const cellOf = (gv, w) => {
    const pos = gv.getWordPosition(w);
    return pos ? [pos.row, pos.col] : null;
};

export function runGridTests() {
    const gv = new GridViewModel(null);

    const cases = [
        // Subject pronouns
        ['subject ich', word({ type: 'subject', text: 'Ich', conjugation: { pronoun: 'ich' } }), CELL.ich],
        ['subject du', word({ type: 'subject', text: 'du', conjugation: { pronoun: 'du' } }), CELL.du],
        ['subject wir', word({ type: 'subject', text: 'Wir', conjugation: { pronoun: 'wir' } }), CELL.wir],
        ['subject ihr', word({ type: 'subject', text: 'ihr', conjugation: { pronoun: 'ihr' } }), CELL.ihr],
        ['subject sie_pl', word({ type: 'subject', text: 'sie', conjugation: { pronoun: 'sie_pl' } }), CELL.pl],
        // er/sie/es subjects use the noun's gender/number
        ['subject er → m', word({ type: 'subject', text: 'Er', gender: 'm', conjugation: { pronoun: 'er' } }), CELL.m],
        ['subject sie → f', word({ type: 'subject', text: 'Frau', gender: 'f', conjugation: { pronoun: 'sie' } }), CELL.f],
        ['subject es → n', word({ type: 'subject', text: 'Kind', gender: 'n', conjugation: { pronoun: 'es' } }), CELL.n],
        ['subject plural wins over gender', word({ type: 'subject', text: 'Kinder', gender: 'n', number: 'pl', conjugation: { pronoun: 'sie' } }), CELL.pl],
        ['subject no info → masculine fallback', word({ type: 'subject', text: 'Mmm' }), CELL.m],
        // Objects
        ['object pronoun mich', word({ type: 'object', text: 'mich', case: 'akk' }), CELL.ich],
        ['object pronoun dir with punctuation', word({ type: 'object', text: 'dir!,', case: 'dat' }), CELL.du],
        ['object pronoun uns', word({ type: 'object', text: 'uns', case: 'dat' }), CELL.wir],
        ['object m', word({ type: 'object', text: 'Tisch', gender: 'm', case: 'akk' }), CELL.m],
        ['object f', word({ type: 'object-dat', text: 'Frau', gender: 'f', case: 'dat' }), CELL.f],
        ['object n', word({ type: 'object-akk', text: 'Buch', gender: 'n', case: 'akk' }), CELL.n],
        ['object plural', word({ type: 'object', text: 'Äpfel', gender: 'm', number: 'pl', case: 'akk' }), CELL.pl],
        ['object no info → masculine fallback', word({ type: 'object', text: 'mehr' }), CELL.m],
        // Verbs
        ['verb ich', word({ type: 'verb', text: 'kaufe', conjugation: { pronoun: 'ich' } }), CELL.ich],
        ['verb er', word({ type: 'verb', text: 'kauft', conjugation: { pronoun: 'er' } }), CELL.m],
        ['verb sie sg', word({ type: 'verb', text: 'kauft', conjugation: { pronoun: 'sie' } }), CELL.f],
        ['verb imperative', word({ type: 'verb', text: 'Trink', conjugation: { pronoun: 'none' } }), CELL.imperative],
        // Others
        ['preposition → no cell', word({ type: 'preposition', text: 'mit' }), null],
        ['other → no cell', word({ type: 'other', text: 'sehr' }), null],
    ];

    for (const [name, w, expected] of cases) {
        test(`getWordPosition: ${name}`, () => assertEqual(cellOf(gv, w), expected));
    }

    test('parseSentenceFlow: clusters by case/gender, connectors between', () => {
        const words = [
            word({ type: 'subject', text: 'Die', gender: 'f' }),
            word({ type: 'subject', text: 'Frau', gender: 'f' }),
            word({ type: 'verb', text: 'gibt', conjugation: { pronoun: 'sie' } }),
            word({ type: 'object', text: 'dem', gender: 'm', case: 'dat' }),
            word({ type: 'object', text: 'Mann', gender: 'm', case: 'dat' }),
            word({ type: 'object', text: 'ein', gender: 'n', case: 'akk' }),
            word({ type: 'object', text: 'Buch.', gender: 'n', case: 'akk' }),
        ];
        const flow = gv.parseSentenceFlow(words);
        assertEqual(flow.boxes.map(b => b.words.map(w => w.text).join(' ')), ['Die Frau', 'dem Mann', 'ein Buch.']);
        assertEqual(flow.boxes.map(b => b.mainWord.text), ['Frau', 'Mann', 'Buch.']);
        assertEqual(flow.connections.map(c => c.map(w => w.text)), [['gibt'], []]);
        assertEqual(flow.leadingWords, []);
    });

    test('parseSentenceFlow: leading and trailing connectors', () => {
        const words = [
            word({ type: 'conjunction', text: 'Weil' }),
            word({ type: 'subject', text: 'ich', conjugation: { pronoun: 'ich' } }),
            word({ type: 'verb', text: 'lerne.', conjugation: { pronoun: 'ich' } }),
        ];
        const flow = gv.parseSentenceFlow(words);
        assertEqual(flow.leadingWords.map(w => w.text), ['Weil']);
        assertEqual(flow.connections.map(c => c.map(w => w.text)), [['lerne.']]);
    });
}
