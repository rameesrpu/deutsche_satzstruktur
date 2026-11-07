import { test, assertEqual } from './assert.js';
import { storyChapters, chapterStatuses, sentenceStats, startOfDay, countPlayedToday,
    countWeakSpots, articleGender, greeting } from '../js/homeScreen.js';
import { chapterOrder } from '../js/levelContent.js';

const entry = (over = {}) => ({
    plays: 1, perfect: 1, perfectStreak: 1, lastPlayed: 0, lastMistakes: 0,
    mistakes: { case: {}, cell: 0 }, ...over,
});

export function runHomeScreenTests() {
    test('home: storyChapters follows the unlock order', () => {
        const chapters = storyChapters();
        assertEqual(chapters.filter(c => c.level === 'A1').map(c => c.key), chapterOrder('A1'));
        assertEqual(chapters[0].storyNo, 1);
        assertEqual(chapters[0].drillKey, `${chapters[0].key}_uebung`);
    });

    test('home: chapterStatuses marks done, one current, and locked', () => {
        const chapters = ['a', 'b', 'c', 'd'].map(key => ({ key }));
        const done = new Set(['a']);
        const unlocked = new Set(['a', 'b']);
        const rows = chapterStatuses(chapters, {
            isComplete: c => done.has(c.key), isUnlocked: c => unlocked.has(c.key),
        });
        assertEqual(rows.map(r => r.status), ['done', 'current', 'locked', 'locked']);
        const imported = chapterStatuses(chapters, { isComplete: () => false, isUnlocked: () => true });
        assertEqual(imported.map(r => r.status), ['current', 'open', 'open', 'open']);
        const allDone = chapterStatuses(chapters, { isComplete: () => true, isUnlocked: () => true });
        assertEqual(allDone.map(r => r.status), ['done', 'done', 'done', 'done']);
    });

    test('home: sentenceStats counts played and last-play-correct sentences', () => {
        const progress = { a: entry(), b: entry({ lastMistakes: 2 }) };
        assertEqual(sentenceStats(['a', 'b', 'c'], t => progress[t] || null),
            { total: 3, played: 2, correct: 1 });
    });

    test('home: countPlayedToday counts sentences played since local midnight', () => {
        const now = new Date(2026, 10, 7, 15, 0).getTime();
        const progress = { sentences: {
            a: entry({ lastPlayed: now - 1000 }),
            b: entry({ lastPlayed: startOfDay(now) }),
            c: entry({ lastPlayed: startOfDay(now) - 1 }),
        } };
        assertEqual(countPlayedToday(progress, now), 2);
    });

    test('home: countWeakSpots counts sentences with a review weight', () => {
        const now = Date.now();
        const progress = { sentences: {
            perfect: entry({ lastPlayed: now }),
            missed: entry({ lastPlayed: now, lastMistakes: 1, perfectStreak: 0, mistakes: { case: { akk: 1 }, cell: 0 } }),
        } };
        assertEqual(countWeakSpots(progress, now), 1);
    });

    test('home: articleGender reads the article of a glossary headword', () => {
        assertEqual(articleGender('der Platz, Plätze'), 'masc');
        assertEqual(articleGender('die Stunde, -n'), 'fem');
        assertEqual(articleGender('das Haus, Häuser'), 'neut');
        assertEqual(articleGender('die Leute (pl.)'), 'pl');
        assertEqual(articleGender('später'), null);
        assertEqual(articleGender('dieser'), null);
    });

    test('home: greeting follows the hour', () => {
        assertEqual(greeting(new Date(2026, 0, 1, 8).getTime()), 'Guten Morgen');
        assertEqual(greeting(new Date(2026, 0, 1, 13).getTime()), 'Guten Tag');
        assertEqual(greeting(new Date(2026, 0, 1, 20).getTime()), 'Guten Abend');
    });
}
