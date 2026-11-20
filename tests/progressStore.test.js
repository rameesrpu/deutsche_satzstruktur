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

    test('ladder: load() migrates a version 1 store to rung 2 with finite due, the current format', () => {
        const storage = makeLocalStorage();
        storage.setItem(PROGRESS_KEY, JSON.stringify(v1({ a: played(), b: played({ lastPlayed: 50 }) })));
        const data = new ProgressStore(storage).load();
        assertEqual(data.version, 3);
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

    test('ladder: merge of a newer version 1 entry takes its counters and keeps the local ladder fields', () => {
        const storage = makeLocalStorage();
        storage.setItem(PROGRESS_KEY, JSON.stringify({ version: 2, sentences: { a: played({ plays: 1, rung: 3, due: 9, topPasses: 1, lastReview: 50, lastPlayed: 100 }) } }));
        const store = new ProgressStore(storage);
        store.importData(v1({ a: played({ plays: 9, lastPlayed: 900 }) }), 'merge');
        const e = store.getSentence('a');
        assertEqual([e.plays, e.lastPlayed], [9, 900]);
        assertEqual([e.rung, e.due, e.topPasses, e.lastReview], [3, 9, 1, 50]);
    });
    test('ladder: merge of an older version 1 entry changes nothing', () => {
        const storage = makeLocalStorage();
        storage.setItem(PROGRESS_KEY, JSON.stringify({ version: 2, sentences: { a: played({ plays: 4, rung: 3, due: 9, lastPlayed: 500 }) } }));
        const store = new ProgressStore(storage);
        store.importData(v1({ a: played({ plays: 9, lastPlayed: 100 }) }), 'merge');
        assertEqual([store.getSentence('a').plays, store.getSentence('a').rung], [4, 3]);
    });
    test('ladder: merge of a newer version 1 entry keeps a locally retired sentence retired', () => {
        const storage = makeLocalStorage();
        storage.setItem(PROGRESS_KEY, JSON.stringify({ version: 2, sentences: { a: played({ plays: 1, rung: 0, lastPlayed: 100 }) } }));
        const store = new ProgressStore(storage);
        store.importData(v1({ a: played({ plays: 9, lastPlayed: 900 }) }), 'merge');
        assertEqual([store.getSentence('a').plays, store.getSentence('a').rung], [9, 0]);
    });
    test('ladder: migration spreads existing sentences at the daily goal', () => {
        const storage = makeLocalStorage();
        storage.setItem('dailyGoal', '5');
        const sentences = {};
        for (let i = 0; i < 12; i++) sentences[`A1/x/${i}`] = played({ lastPlayed: i + 1 });
        storage.setItem(PROGRESS_KEY, JSON.stringify(v1(sentences)));
        const store = new ProgressStore(storage);
        const days = new Set(Object.values(store.load().sentences).map(e => e.due));
        assertEqual(days.size, 3);
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

    test('progress: a format-2 object without boards loads with boards {} and the same sentences', () => {
        const ls = makeLocalStorage();
        ls.setItem(PROGRESS_KEY, JSON.stringify({ version: 2, sentences: { k: played({ rung: 3, due: 5 }) },
            totals: { bestScore: 1, bestStreak: 2, sentencesPlayed: 3 } }));
        const store = new ProgressStore(ls);
        assertEqual(store.load().boards, {});
        assertEqual(store.getSentence('k').rung, 3);
        assertEqual(store.load().version, 3);
    });

    test('progress: recordBoard moves the box, saves, getBoard reads it', () => {
        const ls = makeLocalStorage();
        const store = new ProgressStore(ls);
        const key = 'koerper/aussen/knie:zeigen';
        assertEqual(store.getBoard(key), null);
        const e = store.recordBoard(key, true, NOW);
        assertEqual([e.box, e.seen, e.correct, e.lastSeen], [1, 1, 1, NOW]);
        assertEqual(store.getBoard(key).box, 1);
        assertEqual(new ProgressStore(ls).getBoard(key).box, 1);
        assertEqual(store.recordBoard(key, false, NOW + 1).box, 0);
    });

    test('progress: invalid board entries are dropped on load', () => {
        const ls = makeLocalStorage();
        const good = { box: 2, due: 5, seen: 3, correct: 2, lastSeen: 4 };
        ls.setItem(PROGRESS_KEY, JSON.stringify({ version: 3, sentences: {}, boards: {
            good, bad: { ...good, box: 9 }, frac: { ...good, box: 1.5 }, neg: { ...good, seen: -1 },
            str: { ...good, due: 'x' }, nul: null, missing: { box: 1 },
        } }));
        assertEqual(Object.keys(new ProgressStore(ls).load().boards), ['good']);
    });

    test('progress: export then replace-import round-trips boards', () => {
        const a = new ProgressStore(makeLocalStorage());
        a.recordBoard('x:zeigen', true, NOW);
        const b = new ProgressStore(makeLocalStorage());
        b.recordBoard('other', true, NOW);
        b.importData(a.exportData(), 'replace');
        assertEqual(b.load().boards, a.load().boards);
    });

    test('progress: merge keeps the board entry with the later lastSeen', () => {
        const a = new ProgressStore(makeLocalStorage());
        a.recordBoard('x', true, 1000);
        a.recordBoard('y', true, 5000);
        const b = new ProgressStore(makeLocalStorage());
        b.recordBoard('x', false, 2000);
        b.recordBoard('y', false, 3000);
        b.recordBoard('z', true, 1);
        b.importData(a.exportData(), 'merge');
        assertEqual(b.getBoard('x').lastSeen, 2000);
        assertEqual(b.getBoard('y').lastSeen, 5000);
        assertEqual(b.getBoard('z').lastSeen, 1);
    });

    test('progress: a format-2 export keeps its earned rung when merged into a format-3 store', () => {
        const store = new ProgressStore(makeLocalStorage());
        store.recordSentence('A1/c/s', emptyMistakes(), 100);
        store.importData({ version: 2, totals: {}, sentences: { 'A1/c/s': played({
            lastPlayed: 500, rung: 5, due: 777, topPasses: 1, lastReview: 400 }) } }, 'merge');
        const e = store.getSentence('A1/c/s');
        assertEqual([e.lastPlayed, e.rung, e.due], [500, 5, 777]);
    });
}
