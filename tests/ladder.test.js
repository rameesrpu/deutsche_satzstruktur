// ladder.js: the pure review schedule (rungs, intervals, due list, migration of existing progress)

import { test, assert, assertEqual } from './assert.js';
import { startOfDay, addDays, enterLadder, exerciseRung, afterReview, dueKeys, migrate } from '../js/ladder.js';

const NOW = new Date(2026, 10, 15, 23, 50).getTime();
const DAY0 = new Date(2026, 10, 15).getTime();

export function runLadderTests() {
    const day = n => new Date(2026, 10, 15 + n).getTime();
    const both = { 2: true, 3: true };
    test('startOfDay: local midnight', () => assertEqual(startOfDay(NOW), DAY0));
    test('addDays across the DST change stays at midnight', () =>
        assertEqual(addDays(new Date(2026, 9, 24).getTime(), 2), new Date(2026, 9, 26).getTime()));
    test('enterLadder: new sentence → rung 2, due tomorrow', () =>
        assertEqual(enterLadder({ plays: 1 }, NOW, both), { rung: 2, due: day(1), topPasses: 0 }));
    test('enterLadder: 23:50 play is due at 00:10 next day', () =>
        assert(enterLadder(null, NOW, both).due <= new Date(2026, 10, 16, 0, 10).getTime()));
    test('enterLadder: already on the ladder → unchanged', () =>
        assertEqual(enterLadder({ rung: 3, due: 5, topPasses: 1 }, NOW, both), { rung: 3, due: 5, topPasses: 1 }));
    test('enterLadder: nothing eligible → rung 0', () =>
        assertEqual(enterLadder(null, NOW, { 2: false, 3: false }).rung, 0));
    test('exerciseRung: skips an ineligible rung', () => assertEqual(exerciseRung(2, { 2: false, 3: true }), 3));
    test('exerciseRung: falls back below the top', () => assertEqual(exerciseRung(3, { 2: true, 3: false }), 2));
    test('exerciseRung: none', () => assertEqual(exerciseRung(2, { 2: false, 3: false }), null));
    test('afterReview: pass rung 2 → rung 3 in 3 days', () =>
        assertEqual(afterReview({ rung: 2, due: 0, topPasses: 0 }, true, NOW, both), { rung: 3, due: day(3), topPasses: 0 }));
    test('afterReview: first pass at the top → 14 days', () =>
        assertEqual(afterReview({ rung: 3, due: 0, topPasses: 0 }, true, NOW, both), { rung: 3, due: day(14), topPasses: 1 }));
    test('afterReview: later passes at the top → 30 days', () =>
        assertEqual(afterReview({ rung: 3, due: 0, topPasses: 4 }, true, NOW, both).due, day(30)));
    test('afterReview: mistake on rung 3 → rung 2 tomorrow', () =>
        assertEqual(afterReview({ rung: 3, due: 0, topPasses: 2 }, false, NOW, both), { rung: 2, due: day(1), topPasses: 0 }));
    test('afterReview: mistake on rung 2 stays on 2', () =>
        assertEqual(afterReview({ rung: 2, due: 0, topPasses: 0 }, false, NOW, both).rung, 2));
    test('afterReview: rung 2 only sentence passes at its top', () =>
        assertEqual(afterReview({ rung: 2, due: 0, topPasses: 0 }, true, NOW, { 2: true, 3: false }),
            { rung: 2, due: day(14), topPasses: 1 }));
    test('dueKeys: oldest first, capped, minus reviews done today', () => {
        const s = { a: { rung: 2, due: day(0) }, b: { rung: 3, due: day(-3) }, c: { rung: 2, due: day(1) },
            d: { rung: 0, due: 0 }, e: { rung: 2, due: day(-1), lastReview: 0 }, f: { rung: 3, due: day(9), lastReview: NOW } };
        assertEqual(dueKeys(s, NOW, 10), ['b', 'e', 'a']);
        assertEqual(dueKeys(s, NOW, 3), ['b', 'e']);   // f was reviewed today
        assertEqual(dueKeys(s, NOW, 1), []);
    });
    test('migrate: mistakes first, spread at perDay, custom and unplayed stay out', () => {
        const s = { 'A1/x/one': { plays: 1, lastPlayed: 5, mistakes: { cell: 0, case: {} } },
            'A1/x/two': { plays: 2, lastPlayed: 9, mistakes: { cell: 1, case: {} } },
            'A1/x/three': { plays: 1, lastPlayed: 1, mistakes: { cell: 0, case: {} } },
            'custom//mine': { plays: 3, lastPlayed: 2, mistakes: { cell: 0, case: {} } },
            'A1/x/kept': { plays: 1, lastPlayed: 1, rung: 3, due: 77, topPasses: 1, mistakes: { cell: 0, case: {} } } };
        migrate(s, NOW, 2);
        assertEqual([s['A1/x/two'].due, s['A1/x/three'].due, s['A1/x/one'].due], [day(0), day(0), day(1)]);
        assertEqual(s['custom//mine'].rung, 0);
        assertEqual([s['A1/x/kept'].rung, s['A1/x/kept'].due], [3, 77]);
    });
    test('migrate: a never-played sentence stays off the ladder', () => {
        const s = { 'A1/x/new': { plays: 0, lastPlayed: 0, mistakes: { cell: 0, case: {} } } };
        migrate(s, NOW);
        assertEqual(s['A1/x/new'].rung, 0);
        assertEqual(dueKeys(s, day(5), 10), []);
    });
    test('migrate: without mistakes the one played longer ago goes first, then by key', () => {
        const clean = { cell: 0, case: {} };
        const s = { 'A1/x/a': { plays: 1, lastPlayed: 9, mistakes: clean }, 'A1/x/b': { plays: 1, lastPlayed: 3, mistakes: clean },
            'A1/x/c': { plays: 1, lastPlayed: 3, mistakes: clean } };
        migrate(s, NOW, 1);
        assertEqual([s['A1/x/b'].due, s['A1/x/c'].due, s['A1/x/a'].due], [day(0), day(1), day(2)]);
    });
}
