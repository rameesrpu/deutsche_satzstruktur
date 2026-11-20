// boardSchedule.js / boardSession.js: the box schedule and the session queue of boards

import { test, assertEqual } from './assert.js';
import { afterAnswer, pickSession, sessionOptions, setProgress } from '../js/boardSchedule.js';
import { createSession, currentItem, isFirstAnswer, answer, sessionDone, sessionResults } from '../js/boardSession.js';

const NOW = new Date(2026, 10, 16, 20, 0).getTime();
const day = n => new Date(2026, 10, 16 + n).getTime();
const entry = (box, due) => ({ box, due, seen: 1, correct: 1, lastSeen: 0 });

export function runBoardScheduleTests() {
    test('afterAnswer: new + right → box 1, due in 3 days', () =>
        assertEqual(afterAnswer(null, true, NOW), { box: 1, due: day(3), seen: 1, correct: 1, lastSeen: NOW }));
    test('afterAnswer: new + wrong → box 0, due tomorrow', () =>
        assertEqual(afterAnswer(null, false, NOW), { box: 0, due: day(1), seen: 1, correct: 0, lastSeen: NOW }));
    test('afterAnswer: box 4 + right stays 4, due in 30 days', () => {
        const e = afterAnswer(entry(4, 0), true, NOW);
        assertEqual([e.box, e.due], [4, day(30)]);
    });
    test('afterAnswer: box 3 + wrong → box 0', () => {
        const e = afterAnswer(entry(3, 0), false, NOW);
        assertEqual([e.box, e.due], [0, day(1)]);
    });

    const ids = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    test('pickSession: due oldest first, then new, not-yet-due skipped', () => {
        const map = { a: entry(1, day(-3)), b: entry(1, day(1)), c: entry(1, day(-1)) };
        assertEqual(pickSession(ids, id => map[id], NOW), ['a', 'c', 'd', 'e', 'f', 'g', 'h']);
    });
    test('pickSession: 12 due → 10, no new', () => {
        const many = Array.from({ length: 12 }, (_, i) => 'x' + i);
        assertEqual(pickSession([...many, 'n'], id => (id === 'n' ? null : entry(1, day(-1))), NOW), many.slice(0, 10));
    });
    test('pickSession: due now counts as due', () =>
        assertEqual(pickSession(['a'], () => entry(1, NOW), NOW), ['a']));
    test('setProgress: learned and due; unknown ids ignored', () => {
        const map = { a: entry(0, day(-1)), b: entry(2, day(5)), c: entry(1, day(-2)), gone: entry(3, day(-9)) };
        assertEqual(setProgress(['a', 'b', 'c', 'd'], id => map[id], NOW), { total: 4, learned: 2, due: 2 });
    });

    test('session: wrong comes back once, results are first answers', () => {
        let s = createSession(['a', 'b']);
        s = answer(s, false);
        s = answer(s, true);
        assertEqual(s.queue, ['a', 'b', 'a']);
        assertEqual(currentItem(s), 'a');
        s = answer(s, true);
        assertEqual(sessionDone(s), true);
        assertEqual(currentItem(s), null);
        assertEqual(sessionResults(s), [{ id: 'a', ok: false }, { id: 'b', ok: true }]);
    });
    test('session: a second wrong answer does not append again', () => {
        let s = createSession(['a']);
        s = answer(s, false);
        s = answer(s, false);
        assertEqual(s.queue, ['a', 'a']);
        assertEqual(sessionDone(s), true);
    });
    test('session: answer returns a new object', () => {
        const s = createSession(['a']);
        answer(s, true);
        assertEqual(s, { queue: ['a'], pos: 0, first: {} });
    });
    test('session: left after one answer has one result', () => {
        const s = answer(createSession(['a', 'b']), true);
        assertEqual(sessionResults(s), [{ id: 'a', ok: true }]);
    });

    test('isFirstAnswer: a wrong item is recorded once, its retry is not', () => {
        const recorded = [];
        let s = createSession(['a', 'b']);
        const step = ok => { if (isFirstAnswer(s)) recorded.push([currentItem(s), ok]); s = answer(s, ok); };
        step(false); step(true); step(true); // a wrong, b right, a retried right
        assertEqual(recorded, [['a', false], ['b', true]]);
    });

    test('isFirstAnswer: leaving after one answer leaves exactly one recorded key', () => {
        const recorded = [];
        let s = createSession(['a', 'b', 'c']);
        if (isFirstAnswer(s)) recorded.push(currentItem(s));
        s = answer(s, true);
        assertEqual(recorded, ['a']);
        assertEqual(isFirstAnswer(createSession([])), false);
    });

    test('sessionOptions: review sessions bring no new items, a hand-picked mode uses the default', () => {
        const ids = ['a', 'b', 'c', 'd'];
        const get = id => (id === 'a' ? entry(1, day(-1)) : null);
        assertEqual(pickSession(ids, get, NOW, sessionOptions(true)), ['a']);
        assertEqual(pickSession(ids, get, NOW, sessionOptions(false)), ['a', 'b', 'c', 'd']);
    });
}
