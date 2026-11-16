import { makeLocalStorage } from './stubs.js';
import { test, assertEqual } from './assert.js';
import { ProgressStore, PROGRESS_KEY, sentenceKey, emptyMistakes, addMistake, countMistakes, isMastered }
    from '../js/progressStore.js';
import { startOfDay, addDays, dueKeys } from '../js/ladder.js';

const NOW = new Date(2026, 10, 15, 12).getTime();
const both = { 2: true, 3: true };
const played = (extra = {}) => ({
    plays: 2, perfect: 1, perfectStreak: 0, lastPlayed: 100, lastMistakes: 0,
    mistakes: { case: {}, cell: 0 }, ...extra,
});
const v1 = sentences => ({ version: 1, sentences, totals: { bestScore: 0, bestStreak: 0, sentencesPlayed: 0 } });

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
            version: 2,
            sentences: {
                a: { plays: 9, perfect: 0, perfectStreak: 0, lastPlayed: 400, lastMistakes: 1, mistakes: { case: {}, cell: 1 }, rung: 2, due: 1 },
                b: { plays: 5, perfect: 5, perfectStreak: 5, lastPlayed: 200, lastMistakes: 0, mistakes: { case: {}, cell: 0 }, rung: 2, due: 1 },
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

    test('ladder: load() migrates a version 1 store to rung 2 with finite due, version 2', () => {
        const storage = makeLocalStorage();
        storage.setItem(PROGRESS_KEY, JSON.stringify(v1({ a: played(), b: played({ lastPlayed: 50 }) })));
        const data = new ProgressStore(storage).load();
        assertEqual(data.version, 2);
        for (const k of ['a', 'b']) {
            assertEqual(data.sentences[k].rung, 2);
            assertEqual(Number.isFinite(data.sentences[k].due), true);
        }
    });

    test('ladder: an invalid stored rung (7, due NaN) is treated as missing and migrated', () => {
        const storage = makeLocalStorage();
        storage.setItem(PROGRESS_KEY, JSON.stringify({ version: 2, sentences: { a: played({ rung: 7, due: NaN }) } }));
        const e = new ProgressStore(storage).load().sentences.a;
        assertEqual(e.rung, 2);
        assertEqual(Number.isFinite(e.due), true);
        assertEqual([e.topPasses, e.lastReview], [0, 0]);
    });

    test('ladder: first play enters rung 2, due tomorrow', () => {
        const store = new ProgressStore(makeLocalStorage());
        const e = store.recordSentence('A1/k/Text', emptyMistakes(), NOW);
        assertEqual(e.rung, 2);
        assertEqual(e.due, addDays(startOfDay(NOW), 1));
    });

    test('ladder: a replay leaves rung, due and topPasses alone', () => {
        const storage = makeLocalStorage();
        storage.setItem(PROGRESS_KEY, JSON.stringify({ version: 2, sentences: { k: played({ rung: 3, due: 123, topPasses: 1 }) } }));
        const store = new ProgressStore(storage);
        const m = emptyMistakes();
        m.cell = 2;
        const e = store.recordSentence('k', m, NOW);
        assertEqual([e.rung, e.due, e.topPasses, e.plays], [3, 123, 1, 3]);
    });

    test('ladder: custom sentences and ineligible ones get rung 0', () => {
        const store = new ProgressStore(makeLocalStorage());
        assertEqual(store.recordSentence('custom//Mein Satz', emptyMistakes(), NOW).rung, 0);
        assertEqual(store.recordSentence('A1/k/X', emptyMistakes(), NOW, { 2: false, 3: false }).rung, 0);
    });

    test('ladder: recordReview passes up a rung, sets lastReview, keeps plays', () => {
        const store = new ProgressStore(makeLocalStorage());
        store.recordSentence('k', emptyMistakes(), NOW);
        const e = store.recordReview('k', true, both, NOW + 1000);
        assertEqual([e.rung, e.lastReview, e.lastPlayed, e.plays], [3, NOW + 1000, NOW + 1000, 1]);
        assertEqual(store.getSentence('k').rung, 3);
    });

    test('ladder: recordReview of an unknown key is a no-op returning null', () => {
        const store = new ProgressStore(makeLocalStorage());
        assertEqual(store.recordReview('missing', true, both, NOW), null);
        assertEqual(store.load().sentences, {});
    });

    test('ladder: retire sets rung 0 and removes it from dueKeys', () => {
        const store = new ProgressStore(makeLocalStorage());
        store.recordSentence('k', emptyMistakes(), NOW);
        const later = addDays(startOfDay(NOW), 2);
        assertEqual(dueKeys(store.load().sentences, later, 10), ['k']);
        store.retire('k');
        assertEqual(store.getSentence('k').rung, 0);
        assertEqual(dueKeys(store.load().sentences, later, 10), []);
    });

    test('ladder: merge of a version 1 file keeps the local rung', () => {
        const storage = makeLocalStorage();
        storage.setItem(PROGRESS_KEY, JSON.stringify({ version: 2, sentences: { a: played({ rung: 3, due: 9, lastPlayed: 100 }) } }));
        const store = new ProgressStore(storage);
        store.importData(v1({ a: played({ plays: 7, lastPlayed: 900 }) }), 'merge');
        assertEqual([store.getSentence('a').rung, store.getSentence('a').plays], [3, 2]);
    });

    test('ladder: merge of a version 2 entry without a valid rung keeps the local rung', () => {
        const storage = makeLocalStorage();
        storage.setItem(PROGRESS_KEY, JSON.stringify({ version: 2, sentences: { a: played({ rung: 3, due: 9, lastPlayed: 100 }) } }));
        const store = new ProgressStore(storage);
        store.importData({ version: 2, sentences: { a: played({ plays: 7, lastPlayed: 900 }) } }, 'merge');
        assertEqual(store.getSentence('a').rung, 3);
    });

    test('ladder: merge of a newer version 2 entry with a rung takes the incoming one', () => {
        const storage = makeLocalStorage();
        storage.setItem(PROGRESS_KEY, JSON.stringify({ version: 2, sentences: { a: played({ rung: 3, due: 9, lastPlayed: 100 }) } }));
        const store = new ProgressStore(storage);
        store.importData({ version: 2, sentences: { a: played({ plays: 7, lastPlayed: 900, rung: 2, due: 5 }) } }, 'merge');
        assertEqual([store.getSentence('a').rung, store.getSentence('a').plays], [2, 7]);
    });

    test('ladder: replace of a version 1 export puts every played entry on rung 2', () => {
        const store = new ProgressStore(makeLocalStorage());
        store.importData(v1({ a: played(), b: played() }), 'replace');
        assertEqual([store.getSentence('a').rung, store.getSentence('b').rung], [2, 2]);
    });

    test('ladder: export then replace-import round-trips the ladder fields', () => {
        const store = new ProgressStore(makeLocalStorage());
        store.recordSentence('k', emptyMistakes(), NOW);
        store.recordReview('k', true, both, NOW + 5);
        const copy = JSON.parse(JSON.stringify(store.exportData()));
        const other = new ProgressStore(makeLocalStorage());
        other.importData(copy, 'replace');
        const [a, b] = [store.getSentence('k'), other.getSentence('k')];
        assertEqual([b.rung, b.due, b.topPasses, b.lastReview], [a.rung, a.due, a.topPasses, a.lastReview]);
        assertEqual(b.rung, 3);
    });
}
