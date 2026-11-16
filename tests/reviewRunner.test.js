// reviewRunner.js: the daily review session over the ladder ("Heute üben"), plus the GameMode
// ladder hooks it drives (articleBlank, ladder) and the play screen's ladder progress bar.

import { makeLocalStorage, tagged } from './stubs.js';
import { test, assert, assertEqual } from './assert.js';
import { rungEligibility, buildQueue, ReviewRunner } from '../js/reviewRunner.js';
import { ProgressStore, progressStore, emptyMistakes, addMistake, sentenceKey } from '../js/progressStore.js';
import { dueKeys, startOfDay, addDays } from '../js/ladder.js';
import { GameMode } from '../js/gamemode.js';
import { progressState } from '../js/playScreen.js';
import { gameSounds } from '../js/sound.js';

const ayisha = () => tagged('Heute muss Ayisha im Krankenhaus arbeiten.', 'X M.er S.er P O.n.dat V');
const neu = () => tagged('Ich bin neu.', 'S.ich V.ich X');
const arzt = () => tagged('Der Arzt kommt.', 'S.m S.m V.er');                 // rung 3 only
const give = () => tagged('Ich gebe dem Patienten einen Tee.', 'S.ich V.ich O.m.dat O.m.dat O.m.akk O.m.akk');
const sentence = (text, words) => ({ id: text, text, level: 'A1', category: 'k', source: 'library', words });
const both = { 2: true, 3: true };

/** Stub app and game recording what the runner does; a real ProgressStore on a fresh storage. */
function setup(queueSpec) {
    const store = new ProgressStore(makeLocalStorage());
    const calls = [];
    const app = {
        showScreen: name => calls.push(['screen', name]),
        showReviewRecap: results => calls.push(['recap', results]),
        loadReviewSentence: s => calls.push(['load', s.text]),
        redrawAll: () => {},
    };
    const gameMode = {
        articleBlank: false, ladder: null, isActive: false,
        start() { this.isActive = true; calls.push(['start']); },
        startNewSentence() { calls.push(['next']); },
        stop() { this.isActive = false; this.articleBlank = false; this.ladder = null; calls.push(['stop']); },
    };
    const orders = [];
    const renderOrder = (root, opts, actions) => orders.push({ opts, actions });
    const queue = queueSpec.map(([text, words, rung]) => {
        const s = sentence(text, words);
        const key = sentenceKey(s);
        store.recordSentence(key, emptyMistakes(), Date.now() - 2 * 86400000, rungEligibility(words));
        if (rung === 3) store.recordReview(key, true, both, Date.now() - 86400000);
        store.getSentence(key).due = 0;
        return { key, sentence: s, rung, eligible: rungEligibility(words) };
    });
    store.save();
    const runner = new ReviewRunner({ app, gameMode, progressStore: store, renderOrder, orderRoot: () => null });
    return { store, calls, app, gameMode, orders, queue, runner };
}

export function runReviewRunnerTests() {
    test('review: rungEligibility = Ordnen model / article', () => {
        assertEqual(rungEligibility(ayisha()), { 2: true, 3: false });
        assertEqual(rungEligibility(neu()), { 2: false, 3: false });
        assertEqual(rungEligibility(give()), { 2: true, 3: true });
    });

    test('review: buildQueue retires missing and ineligible sentences, picks the shown rung', () => {
        const found = { a: sentence('a', ayisha()), c: sentence('c', neu()), d: sentence('d', arzt()) };
        const { queue, retired } = buildQueue(['a', 'b', 'c', 'd'], k => found[k] || null, () => 2);
        assertEqual(queue.map(q => q.key), ['a', 'd']);
        assertEqual(retired, ['b', 'c']);
        assertEqual(queue.map(q => q.rung), [2, 3]);
        assertEqual(queue[1].eligible, { 2: false, 3: true });
        assertEqual(queue[0].sentence.text, 'a');
    });

    test('review: buildQueue never reviews a custom sentence', () => {
        const s = sentence('Mein Satz.', give());
        const { queue, retired } = buildQueue(['custom//Mein Satz.'], () => s, () => 2);
        assertEqual([queue.length, retired], [0, ['custom//Mein Satz.']]);
    });

    test('review: a rung 3 item plays the game with articles blanked, then the recap', () => {
        const { calls, gameMode, queue, runner } = setup([['Der Arzt kommt.', arzt(), 3]]);
        runner.start(queue);
        assertEqual([gameMode.articleBlank, gameMode.ladder.total, gameMode.ladder.index], [true, 1, 0]);
        assert(calls.some(c => c[0] === 'start'), 'game started');
        assertEqual(calls.filter(c => c[0] === 'load').map(c => c[1]), ['Der Arzt kommt.']);
        gameMode.ladder.record(queue[0].sentence, 0);
        gameMode.ladder.next();
        const recaps = calls.filter(c => c[0] === 'recap');
        assertEqual(recaps.length, 1);
        assertEqual(recaps[0][1], [{ key: queue[0].key, text: 'Der Arzt kommt.', from: 3, to: 3, ok: true }]);
        assertEqual([gameMode.articleBlank, gameMode.ladder, gameMode.isActive], [false, null, false]);
    });

    test('review: two rung 3 items in a row keep the flags (no stop in between)', () => {
        const { calls, gameMode, queue, runner } = setup([['Der Arzt kommt.', arzt(), 3],
            ['Ich gebe dem Patienten einen Tee.', give(), 3]]);
        runner.start(queue);
        gameMode.ladder.record(queue[0].sentence, 0);
        gameMode.ladder.next();
        assertEqual([gameMode.articleBlank, gameMode.ladder.index, gameMode.ladder.total], [true, 1, 2]);
        assertEqual(calls.filter(c => c[0] === 'stop').length, 0);
        assertEqual(calls.filter(c => c[0] === 'next').length, 1);
    });

    test('review: a rung 2 item opens the Ordnen screen; onDone records and moves on', () => {
        const { store, calls, gameMode, orders, queue, runner } = setup([
            ['Heute muss Ayisha im Krankenhaus arbeiten.', ayisha(), 2], ['Der Arzt kommt.', arzt(), 3]]);
        runner.start(queue);
        assertEqual(calls[0], ['screen', 'order']);
        assertEqual([orders.length, orders[0].opts.total, orders[0].opts.index], [1, 2, 0]);
        assert(orders[0].opts.model && orders[0].opts.model.chips.length > 0, 'order model passed');
        assertEqual(gameMode.ladder, null);
        orders[0].actions.onDone(0);
        assertEqual(store.getSentence(queue[0].key).rung, 2); // rung 2 only: passes at its top
        assertEqual(store.getSentence(queue[0].key).topPasses, 1);
        assertEqual(calls.filter(c => c[0] === 'screen').map(c => c[1]), ['order', 'play']);
        assertEqual([gameMode.articleBlank, gameMode.ladder.index], [true, 1]);
        orders[0].actions.onDone(0); // a second call of an old screen is ignored
        assertEqual(gameMode.ladder.index, 1);
    });

    test('review: rung 3 then rung 2 — the game stops, the Ordnen screen opens', () => {
        const { calls, gameMode, orders, queue, runner } = setup([['Der Arzt kommt.', arzt(), 3],
            ['Heute muss Ayisha im Krankenhaus arbeiten.', ayisha(), 2]]);
        runner.start(queue);
        gameMode.ladder.record(queue[0].sentence, 0);
        gameMode.ladder.next();
        assertEqual(orders.length, 1);
        assertEqual([gameMode.isActive, gameMode.articleBlank, gameMode.ladder], [false, false, null]);
        orders[0].actions.onDone(1);
        const recap = calls.find(c => c[0] === 'recap')[1];
        assertEqual(recap.map(r => r.ok), [true, false]);
    });

    test('review: close() after the first of three keeps the other two due', () => {
        const { store, calls, gameMode, queue, runner } = setup([['Der Arzt kommt.', arzt(), 3],
            ['Ich gebe dem Patienten einen Tee.', give(), 3], ['Die Frau kommt.', tagged('Die Frau kommt.', 'S.f S.f V.sie'), 3]]);
        const before = queue.map(q => ({ ...store.getSentence(q.key) }));
        runner.start(queue);
        gameMode.ladder.record(queue[0].sentence, 0);
        gameMode.ladder.next();
        runner.close();
        assertEqual(store.getSentence(queue[0].key).topPasses, before[0].topPasses + 1);
        assert(store.getSentence(queue[0].key).due > Date.now(), 'first one is no longer due');
        for (const i of [1, 2]) assertEqual(store.getSentence(queue[i].key), before[i]);
        const due = dueKeys(store.load().sentences, Date.now(), 10);
        assert(due.includes(queue[1].key) && due.includes(queue[2].key), 'others still due');
        assertEqual([gameMode.articleBlank, gameMode.ladder, gameMode.isActive], [false, null, false]);
        assertEqual(calls.filter(c => c[0] === 'screen').pop(), ['screen', 'home']);
        assertEqual(calls.filter(c => c[0] === 'recap').length, 0);
        runner.close(); // twice is harmless
        assertEqual(calls.filter(c => c[0] === 'screen' && c[1] === 'home').length, 1);
    });

    test('review: closing the Ordnen screen goes through close()', () => {
        const { calls, orders, queue, runner } = setup([['Heute muss Ayisha im Krankenhaus arbeiten.', ayisha(), 2]]);
        runner.start(queue);
        orders[0].actions.onClose();
        assertEqual(calls.pop(), ['screen', 'home']);
        assertEqual(runner.active, false);
    });

    test('review: a mistake on rung 3 → rung 2, due tomorrow', () => {
        const { store, gameMode, queue, runner } = setup([['Ich gebe dem Patienten einen Tee.', give(), 3]]);
        runner.start(queue);
        gameMode.ladder.record(queue[0].sentence, 2);
        const e = store.getSentence(queue[0].key);
        assertEqual([e.rung, e.due], [2, addDays(startOfDay(Date.now()), 1)]);
    });

    test('progress: recordReview leaves an entry off the ladder alone', () => {
        const store = new ProgressStore(makeLocalStorage());
        store.recordSentence('custom//Mein Satz.', emptyMistakes());
        assertEqual(store.recordReview('custom//Mein Satz.', true, both), null);
        assertEqual(store.getSentence('custom//Mein Satz.').rung, 0);
        store.recordSentence('A1/k/x', emptyMistakes());
        store.retire('A1/k/x');
        assertEqual(store.recordReview('A1/k/x', false, both), null);
        assertEqual(store.getSentence('A1/k/x').rung, 0);
    });

    // --- GameMode ladder hooks (Task 5), on a GameMode without SVG ---
    const host = (current, extra = {}) => ({ sentenceManager: { getCurrentSentence: () => current }, ...extra });
    const withStore = fn => {
        const saved = progressStore.storage;
        progressStore.storage = makeLocalStorage();
        progressStore.data = null;
        try { fn(); } finally { progressStore.storage = saved; progressStore.data = null; }
    };

    test('game: displayItemText blanks the articles of a box and of a single item', () => {
        const gm = new GameMode(null, null, null, host(null));
        gm.words = give();
        const box = { type: 'box', item: { words: [gm.words[2], gm.words[3]] } };
        const single = { type: 'word', item: gm.words[4] };
        assertEqual([gm.displayItemText(box), gm.displayItemText(single)], ['dem Patienten', 'einen']);
        gm.articleBlank = true;
        assertEqual([gm.displayItemText(box), gm.displayItemText(single)], ['___ Patienten', '___']);
    });

    test('game: stop() clears articleBlank and ladder', () => {
        let stopped = 0;
        const gm = new GameMode(null, null, null, host(null, { onStop: () => stopped++ }));
        gm.isActive = true;
        gm.articleBlank = true;
        gm.ladder = { total: 1, index: 0, record() {}, next() {} };
        gm.stop();
        assertEqual([gm.articleBlank, gm.ladder, stopped], [false, null, 1]);
    });

    test('game: recordProgress hands a ladder sentence to ladder.record only', () => withStore(() => {
        const s = sentence('Der Arzt kommt.', arzt());
        const got = [];
        const gm = new GameMode(null, null, null, host(s));
        gm.ladder = { total: 1, index: 0, record: (x, m) => got.push([x.text, m]), next() {} };
        gm.sentenceMistakes = emptyMistakes();
        addMistake(gm.sentenceMistakes, { ok: false, cellOk: false, caseOk: false, expectedCase: 'nom' });
        gm.recordProgress();
        assertEqual(got, [['Der Arzt kommt.', 2]]);
        assertEqual(progressStore.getSentence(sentenceKey(s)), null);
    }));

    test('game: recordProgress without a ladder enters the ladder by eligibility', () => withStore(() => {
        const play = (s) => {
            const gm = new GameMode(null, null, null, host(s));
            gm.words = s.words;
            gm.recordProgress();
            return progressStore.getSentence(sentenceKey(s)).rung;
        };
        assertEqual(play(sentence('Ich bin neu.', neu())), 0);
        assertEqual(play(sentence('Der Arzt kommt.', arzt())), 2);
    }));

    test('game: with a ladder the next sentence comes from ladder.next(), no story chapter', () => {
        let nexts = 0;
        const gm = new GameMode(null, null, null, host(null));
        gm.ladder = { total: 2, index: 0, record() {}, next: () => nexts++ };
        gm.loadRandomSentenceAndContinue();
        assertEqual([nexts, gm.getStoryChapter()], [1, null]);
    });

    test('play screen: progressState follows the ladder', () => {
        const game = { ladder: { total: 3, index: 1 }, waitingForContinue: false };
        assertEqual(progressState(game), ['done', 'current', 'todo']);
        assertEqual(progressState({ ...game, waitingForContinue: true }), ['done', 'done', 'todo']);
    });

    test('game: no Hörübung prompt while articles are blanked', () => {
        const spoken = [];
        const saved = gameSounds.promptSentence;
        gameSounds.promptSentence = (words, blank) => spoken.push(blank);
        try {
            const gm = new GameMode(null, null, null, host(null));
            gm.words = give();
            gm.manualItems = [{ type: 'box', item: { words: [gm.words[2], gm.words[3]] } }];
            gm.currentIndex = 0;
            gm.articleBlank = true;
            gm.updateCurrentWordDisplay();
            gm.resumeCurrentWord(null);
            assertEqual(spoken, []);
            gm.articleBlank = false;
            gm.updateCurrentWordDisplay();
            assertEqual(spoken, [2]);
        } finally {
            gameSounds.promptSentence = saved;
        }
    });
}
