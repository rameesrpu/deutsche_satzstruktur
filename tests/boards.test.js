// boards: registry, keys, locking, summaries, and the Üben card texts

import { test, testAsync, assertEqual } from './assert.js';
import { readText } from './stubs.js';
import { BOARDS, boardKey, boardDef, loadBoard, isSetLocked, setModes, boardSummary, reviewStart, KINDS, registerKind, itemIdsFor } from '../js/boards.js';
import { boardCard } from '../js/homeScreen.js';

const NOW = 1_000_000;
const board = {
    id: 'koerper', title: 'Der Körper', version: 1, kind: 'hotspot',
    sets: [
        { id: 'aussen', title: 'A', unlock: null, items: [{ id: 'kopf' }, { id: 'arm' }] },
        { id: 'organe', title: 'O', modes: ['entdecken', 'zeigen', 'benennen'],
            unlock: { level: 'A1', category: 'g5k3', label: 'x' }, items: [{ id: 'herz' }] },
    ],
};
const entry = (box, due) => ({ box, due, seen: 1, correct: 1, lastSeen: 0 });

export function runBoardsTests() {
    test('boardKey joins board, set, item and mode', () => {
        assertEqual(boardKey('koerper', 'aussen', 'kopf', 'zeigen'), 'koerper/aussen/kopf:zeigen');
    });

    test('registry: koerper modes, and the version mirrors the data file', () => {
        const def = boardDef('koerper');
        assertEqual(def.modes.map(m => [m.id, m.scored]),
            [['entdecken', false], ['zeigen', true], ['benennen', true], ['schmerz', true]]);
        const file = JSON.parse(readText(def.file));
        assertEqual(file.version, def.version);
        assertEqual(file.id, def.id);
        assertEqual(file.kind, def.kind);
        assertEqual(BOARDS.length, 2);
    });

    test('registry: every board mirrors its data file (id, kind, version)', () => {
        for (const def of BOARDS) {
            const file = JSON.parse(readText(def.file));
            assertEqual([file.id, file.kind, file.version], [def.id, def.kind, def.version]);
        }
        assertEqual(boardDef('wechsel').modes.map(m => [m.id, m.scored]),
            [['entdecken', false], ['verstehen', true], ['artikel', true], ['satz', true]]);
    });

    test('itemIdsFor: the kind hook decides the ids, else the item ids; summary and review follow', () => {
        registerKind('fake', { itemIds: (set, modeId) => (modeId === 'a' ? ['x.1', 'x.2'] : ['x.1']) });
        try {
            const fb = { id: 'f', kind: 'fake', sets: [{ id: 's', items: [{ id: 'x' }] }] };
            assertEqual(itemIdsFor(fb, fb.sets[0], 'a'), ['x.1', 'x.2']);
            assertEqual(itemIdsFor(fb, fb.sets[0], 'b'), ['x.1']);
            assertEqual(itemIdsFor(board, board.sets[0], 'zeigen'), ['kopf', 'arm']);
            assertEqual(KINDS.fake !== undefined, true);
        } finally { delete KINDS.fake; }
    });

    test('data/boards/koerper.json: four sets, real unlock labels, organe without schmerz', () => {
        const file = JSON.parse(readText('data/boards/koerper.json'));
        assertEqual(file.sets.map(s => s.id), ['aussen', 'gesicht', 'hinten', 'organe']);
        assertEqual(file.sets[0].unlock, { level: 'A1', category: 'g5k1', label: '5.1 Gute Besserung' });
        assertEqual(file.sets[3].unlock, { level: 'A1', category: 'g5k3', label: '5.3 Ein Ausflug' });
        assertEqual(setModes(file, file.sets[3]).map(m => m.id), ['entdecken', 'zeigen', 'benennen']);
        assertEqual(setModes(file, file.sets[0]).length, 4);
    });

    testAsync('loadBoard fetches data/boards/<id>.json?v=<version> once', async () => {
        const urls = [];
        const fetchJson = async url => { urls.push(url); return { id: 'koerper' }; };
        await loadBoard('koerper', fetchJson);
        await loadBoard('koerper', fetchJson);
        assertEqual(urls, ['data/boards/koerper.json?v=' + boardDef('koerper').version]);
    });

    test('isSetLocked: only sets with an unlock can be locked', () => {
        assertEqual(isSetLocked({ unlock: null }, () => false), false);
        assertEqual(isSetLocked({}, () => false), false);
        const set = { unlock: { level: 'A1', category: 'g5k1', label: 'x' } };
        assertEqual(isSetLocked(set, (l, c) => l === 'A1' && c === 'g5k1'), false);
        assertEqual(isSetLocked(set, () => false), true);
    });

    test('boardSummary: learned needs every scored mode at box 1, due counts due keys', () => {
        const store = {
            [boardKey('koerper', 'aussen', 'kopf', 'zeigen')]: entry(1, NOW - 1),
            [boardKey('koerper', 'aussen', 'kopf', 'benennen')]: entry(2, NOW + 5),
            [boardKey('koerper', 'aussen', 'kopf', 'schmerz')]: entry(1, NOW + 5),
            [boardKey('koerper', 'aussen', 'arm', 'zeigen')]: entry(1, NOW + 5),
        };
        const sum = boardSummary(board, k => store[k] || null, () => false, NOW);
        assertEqual(sum, { total: 2, learned: 1, due: 1, lockedLabel: null });
    });

    test('boardSummary: stored keys of removed items are ignored; locked sets are not counted', () => {
        const store = { [boardKey('koerper', 'aussen', 'weg', 'zeigen')]: entry(1, NOW - 1) };
        assertEqual(boardSummary(board, k => store[k] || null, () => false, NOW), { total: 2, learned: 0, due: 0, lockedLabel: null });
        assertEqual(boardSummary(board, () => null, () => true, NOW).total, 3);
    });

    test('boardSummary: lockedLabel is the first locked set label when no set is unlocked, else null', () => {
        const locked = board.sets.filter(s => s.unlock);
        assertEqual(locked.length > 0, true);
        const allLocked = { ...board, sets: locked };
        assertEqual(boardSummary(allLocked, () => null, () => false, NOW).lockedLabel, locked[0].unlock.label);
        assertEqual(boardSummary(board, () => null, () => false, NOW).lockedLabel, null);
        assertEqual(boardSummary(allLocked, () => null, () => true, NOW).lockedLabel, null);
    });

    test('boardCard: all locked shows "Nach ..." and no review button', () => {
        assertEqual(boardCard({ learned: 0, total: 0, due: 0, lockedLabel: '5.1 Gute Besserung' }),
            { line: 'Nach „5.1 Gute Besserung“', reviewLabel: null });
    });

    test('boardSummary: a set counts only its own scored modes (organe has no schmerz)', () => {
        const store = {
            [boardKey('koerper', 'organe', 'herz', 'zeigen')]: entry(1, NOW + 5),
            [boardKey('koerper', 'organe', 'herz', 'benennen')]: entry(1, NOW + 5),
        };
        const sum = boardSummary(board, k => store[k] || null, () => true, NOW);
        assertEqual(sum, { total: 3, learned: 1, due: 0, lockedLabel: null });
    });

    test('reviewStart: first unlocked set and scored mode with a due item', () => {
        const store = { [boardKey('koerper', 'aussen', 'arm', 'benennen')]: entry(1, NOW - 1) };
        assertEqual(reviewStart(board, k => store[k] || null, () => false, NOW), { setId: 'aussen', modeId: 'benennen' });
        assertEqual(reviewStart(board, () => null, () => false, NOW), null);
        const organ = { [boardKey('koerper', 'organe', 'herz', 'zeigen')]: entry(1, NOW - 1) };
        assertEqual(reviewStart(board, k => organ[k] || null, () => false, NOW), null);
        assertEqual(reviewStart(board, k => organ[k] || null, () => true, NOW), { setId: 'organe', modeId: 'zeigen' });
    });

    test('Üben card: learned line, "Wiederholen (n)" only when due', () => {
        assertEqual(boardCard({ learned: 4, total: 20, due: 3 }), { line: '4 von 20 gelernt', reviewLabel: 'Wiederholen (3)' });
        assertEqual(boardCard({ learned: 0, total: 0, due: 0 }), { line: '0 von 0 gelernt', reviewLabel: null });
    });

    test('boardSummary and reviewStart use the kind hook (ids per mode)', () => {
        registerKind('fake2', { itemIds: (set, modeId) => (modeId === 'a' ? ['x.1', 'x.2'] : ['x.1']) });
        try {
            const fb = { id: 'f', kind: 'fake2', version: 1,
                sets: [{ id: 's', unlock: null, items: [{ id: 'x' }] }] };
            BOARDS.splice(0, 0, { id: 'f', kind: 'fake2', modes: [
                { id: 'a', label: 'A', scored: true }, { id: 'b', label: 'B', scored: true }] });
            const store = {
                [boardKey('f', 's', 'x.1', 'a')]: entry(1, NOW + 5), [boardKey('f', 's', 'x.2', 'a')]: entry(1, NOW - 1),
                [boardKey('f', 's', 'x.1', 'b')]: entry(1, NOW + 5),
            };
            assertEqual(boardSummary(fb, k => store[k] || null, () => false, NOW), { total: 2, learned: 2, due: 1, lockedLabel: null });
            assertEqual(reviewStart(fb, k => store[k] || null, () => false, NOW), { setId: 's', modeId: 'a' });
        } finally { delete KINDS.fake2; BOARDS.splice(0, 1); }
    });
}
