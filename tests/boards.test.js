// boards: registry, keys, locking, summaries, and the Üben card texts

import { test, testAsync, assertEqual } from './assert.js';
import { readText } from './stubs.js';
import { BOARDS, boardKey, boardDef, loadBoard, isSetLocked, setModes, boardSummary, reviewStart } from '../js/boards.js';
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
        assertEqual(BOARDS.length, 1);
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
        assertEqual(urls, ['data/boards/koerper.json?v=1']);
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
        assertEqual(sum, { total: 2, learned: 1, due: 1 });
    });

    test('boardSummary: stored keys of removed items are ignored; locked sets are not counted', () => {
        const store = { [boardKey('koerper', 'aussen', 'weg', 'zeigen')]: entry(1, NOW - 1) };
        assertEqual(boardSummary(board, k => store[k] || null, () => false, NOW), { total: 2, learned: 0, due: 0 });
        assertEqual(boardSummary(board, () => null, () => true, NOW).total, 3);
    });

    test('boardSummary: a set counts only its own scored modes (organe has no schmerz)', () => {
        const store = {
            [boardKey('koerper', 'organe', 'herz', 'zeigen')]: entry(1, NOW + 5),
            [boardKey('koerper', 'organe', 'herz', 'benennen')]: entry(1, NOW + 5),
        };
        const sum = boardSummary(board, k => store[k] || null, () => true, NOW);
        assertEqual(sum, { total: 3, learned: 1, due: 0 });
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
}
