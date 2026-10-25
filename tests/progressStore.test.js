import { makeLocalStorage } from './stubs.js';
import { test, assertEqual } from './assert.js';
import { ProgressStore, PROGRESS_KEY, sentenceKey, emptyMistakes, addMistake, countMistakes, isMastered }
    from '../js/progressStore.js';

const wrongCase = { ok: false, cellOk: true, caseOk: false, expectedCase: 'dat', expectedCell: null };
const wrongCell = { ok: false, cellOk: false, caseOk: true, expectedCase: 'akk', expectedCell: null };
const wrongBoth = { ok: false, cellOk: false, caseOk: false, expectedCase: 'akk', expectedCell: null };

export function runProgressStoreTests() {
    test('progress: sentenceKey uses level/category/text, custom without level', () => {
        assertEqual(sentenceKey({ id: 1, level: 'A1', category: 'Hauptsatz', text: 'Ich lerne.' }),
            'A1/Hauptsatz/Ich lerne.');
        assertEqual(sentenceKey({ id: 2, text: 'Mein Satz.' }), 'custom//Mein Satz.');
    });

    test('progress: isMastered needs the last 2 plays perfect', () => {
        const store = new ProgressStore(makeLocalStorage());
        const m = emptyMistakes();
        addMistake(m, wrongCase);
        assertEqual(isMastered(null), false);
        assertEqual(isMastered(store.recordSentence('k', emptyMistakes(), 1)), false);
        assertEqual(isMastered(store.recordSentence('k', emptyMistakes(), 2)), true);
        assertEqual(isMastered(store.recordSentence('k', m, 3)), false);
        store.recordSentence('k', emptyMistakes(), 4);
        assertEqual(isMastered(store.recordSentence('k', emptyMistakes(), 5)), true);
    });

    test('progress: addMistake counts cell and case by expected case', () => {
        const m = emptyMistakes();
        addMistake(m, wrongCase);
        addMistake(m, wrongCell);
        addMistake(m, wrongBoth);
        assertEqual(m, { case: { dat: 1, akk: 1 }, cell: 2 });
        assertEqual(countMistakes(m), 4);
    });

    test('progress: recordSentence accumulates plays, perfect streak and mistakes', () => {
        const store = new ProgressStore(makeLocalStorage());
        const m = emptyMistakes();
        addMistake(m, wrongCase);
        store.recordSentence('k', emptyMistakes(), 100);
        store.recordSentence('k', emptyMistakes(), 200);
        let e = store.getSentence('k');
        assertEqual([e.plays, e.perfect, e.perfectStreak], [2, 2, 2]);
        e = store.recordSentence('k', m, 300);
        assertEqual([e.plays, e.perfect, e.perfectStreak, e.lastPlayed, e.lastMistakes], [3, 2, 0, 300, 1]);
        store.recordSentence('k', m, 400);
        assertEqual(store.getSentence('k').mistakes, { case: { dat: 2 }, cell: 0 });
        assertEqual(store.load().totals.sentencesPlayed, 4);
        assertEqual(store.getSentence('other'), null);
    });

    test('progress: survives a reload (new store on the same storage)', () => {
        const storage = makeLocalStorage();
        const a = new ProgressStore(storage);
        a.recordSentence('k', emptyMistakes(), 100);
        a.recordSession({ score: 120, streak: 7 });
        const b = new ProgressStore(storage);
        assertEqual(b.getSentence('k').plays, 1);
        assertEqual(b.load().totals, { bestScore: 120, bestStreak: 7, sentencesPlayed: 1 });
    });

    test('progress: recordSession only raises bests', () => {
        const store = new ProgressStore(makeLocalStorage());
        store.recordSession({ score: 100, streak: 9 });
        store.recordSession({ score: 150, streak: 3 });
        assertEqual(store.load().totals.bestScore, 150);
        assertEqual(store.load().totals.bestStreak, 9);
    });

    test('progress: corrupt or throwing storage falls back to empty progress', () => {
        const storage = makeLocalStorage();
        storage.setItem(PROGRESS_KEY, '{not json');
        assertEqual(new ProgressStore(storage).load().sentences, {});
        const throwing = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
        const store = new ProgressStore(throwing);
        store.recordSentence('k', emptyMistakes(), 1); // must not throw
        assertEqual(store.getSentence('k').plays, 1, 'kept in memory');
    });

    test('progress: import merge keeps most recent entry and higher bests; replace discards', () => {
        const store = new ProgressStore(makeLocalStorage());
        store.recordSentence('a', emptyMistakes(), 500);
        store.recordSentence('b', emptyMistakes(), 100);
        store.recordSession({ score: 50, streak: 10 });
        const imported = {
            version: 1,
            sentences: {
                a: { plays: 9, perfect: 0, perfectStreak: 0, lastPlayed: 400, lastMistakes: 1, mistakes: { case: {}, cell: 1 } },
                b: { plays: 5, perfect: 5, perfectStreak: 5, lastPlayed: 200, lastMistakes: 0, mistakes: { case: {}, cell: 0 } },
                c: 'garbage',
            },
            totals: { bestScore: 80, bestStreak: 2, sentencesPlayed: 14 },
        };
        store.importData(imported, 'merge');
        assertEqual(store.getSentence('a').plays, 1, 'local a is newer');
        assertEqual(store.getSentence('b').plays, 5, 'imported b is newer');
        assertEqual(store.getSentence('c'), null, 'malformed entry dropped');
        assertEqual(store.load().totals, { bestScore: 80, bestStreak: 10, sentencesPlayed: 14 });
        store.importData(imported, 'replace');
        assertEqual(store.getSentence('a').plays, 9);
        assertEqual(store.load().totals.bestStreak, 2);
    });
}
