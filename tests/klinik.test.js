// klinik: pure route state, toggling and the tile list of the Klinik screen

import { test, assertEqual } from './assert.js';
import { readText } from './stubs.js';
import { KLINIK_ROUTE_VERSION, routeState, toggleStation, tileMode, KLINIK_TILES } from '../js/klinik.js';

const stations = [
    { id: 'a', title: 'A', checked: '2026-11-21' },
    { id: 'b', title: 'B', optional: true, checked: '2026-10-02' },
    { id: 'c', title: 'C', checked: '2026-11-05' },
];

export function runKlinikTests() {
    test('KLINIK_ROUTE_VERSION mirrors the route file version', () => {
        assertEqual(JSON.parse(readText('data/medical/approbation.json')).version, KLINIK_ROUTE_VERSION);
    });

    test('routeState: counts required stations, marks the next one, ignores unknown ids', () => {
        const r = routeState(stations, ['a', 'zzz']);
        assertEqual(r.total, 2);
        assertEqual(r.doneCount, 1);
        assertEqual(r.stations.map(s => s.done), [true, false, false]);
        assertEqual(r.stations.map(s => s.next), [false, false, true]);
        assertEqual(r.stations[1].optional, true);
    });

    test('routeState: an optional station is never next; stand is the oldest date as TT.MM.JJJJ', () => {
        const r = routeState(stations, []);
        assertEqual(r.stations.map(s => s.next), [true, false, false]);
        assertEqual(r.stand, '02.10.2026');
        assertEqual(routeState(stations, ['a', 'c']).stations.some(s => s.next), false);
    });

    test('toggleStation adds and removes', () => {
        assertEqual(toggleStation([], 'a'), ['a']);
        assertEqual(toggleStation(['a', 'b'], 'a'), ['b']);
    });

    test('KLINIK_TILES: six tiles in order', () => {
        assertEqual(KLINIK_TILES.map(t => t.title), ['Der Weg zur Approbation', 'Fachsprache und Alltagssprache',
            'Die Station', 'Anamnese', 'Arztbrief', 'Fachsprachprüfung']);
        assertEqual(KLINIK_TILES.map(t => t.open), ['route', 'board', 'board', 'soon', 'soon', 'soon']);
        assertEqual(KLINIK_TILES.map(t => t.level), [null, null, null, 'ab B1', 'ab B2', 'ab B2']);
    });

    test('tileMode: a board tile without a registered board is soon', () => {
        const tile = KLINIK_TILES[1];
        assertEqual(tileMode(tile, []), 'soon');
        assertEqual(tileMode(tile, ['fachbegriffe']), 'board');
        assertEqual(tileMode(KLINIK_TILES[0], []), 'route');
    });
}
