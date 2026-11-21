// klinik: pure route state, toggling and the tile list of the Klinik screen

import { test, assert, assertEqual } from './assert.js';
import { readText } from './stubs.js';
import { KLINIK_ROUTE_VERSION, routeState, toggleStation, tileMode, routeNote, KLINIK_TILES, questionSortModel } from '../js/klinik.js';

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
            'Die Station', 'Anamnese', 'Arztbrief', 'Fachsprachenprüfung']);
        assertEqual(KLINIK_TILES.map(t => t.open), ['route', 'board', 'board', 'anamnese', 'arztbrief', 'soon']);
        assertEqual(KLINIK_TILES.map(t => t.level), [null, null, null, 'ab B1', 'ab B2', 'ab B2']);
    });

    test('routeNote: progress, or a notice when the route is missing', () => {
        assertEqual(routeNote(routeState(stations, ['a'])), '1 von 2 Schritten');
        assertEqual(routeNote(null), 'Gerade nicht verfügbar.');
    });

    test('tileMode: a board tile without a registered board is soon', () => {
        const tile = KLINIK_TILES[1];
        assertEqual(tileMode(tile, []), 'soon');
        assertEqual(tileMode(tile, ['fachbegriffe']), 'board');
        assertEqual(tileMode(KLINIK_TILES[0], []), 'route');
        assertEqual(tileMode(KLINIK_TILES.find(t => t.id === 'anamnese'), []), 'anamnese');
    });

    const anamnese = JSON.parse(readText('data/medical/anamnese.json'));
    let seed = 1;
    const rng = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

    test('questionSortModel: 10 chips with at least one zone each, the 7 sections as zones', () => {
        const m = questionSortModel(anamnese, rng);
        assertEqual(m.zones.map(z => z.id), anamnese.sections.map(s => s.id));
        assertEqual(m.zones.map(z => z.title), anamnese.sections.map(s => s.title));
        assertEqual(m.chips.length, 10);
        assertEqual(new Set(m.chips.map(c => c.id)).size, 10);
        for (const c of m.chips) {
            assert(c.zones.length >= 1);
            assert(c.zones.every(z => m.zones.some(x => x.id === z)));
            assert(c.text.endsWith('?') && c.en);
        }
    });

    test('questionSortModel: the own section first, then the also sections', () => {
        const data = { version: 1, sections: [
            { id: 'a', title: 'A', en: 'a', questions: [{ id: 'q1', de: 'Eins?', en: 'one', also: ['b'] }] },
            { id: 'b', title: 'B', en: 'b', questions: [{ id: 'q2', de: 'Zwei?', en: 'two' }] },
        ] };
        const m = questionSortModel(data, () => 0, 5);
        assertEqual(m.chips.length, 2);
        assertEqual(m.chips.find(c => c.id === 'q1').zones, ['a', 'b']);
        assertEqual(m.chips.find(c => c.id === 'q2').zones, ['b']);
        assertEqual(m.chips.find(c => c.id === 'q1').en, 'one');
    });
}
