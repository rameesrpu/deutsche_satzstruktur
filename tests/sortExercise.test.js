// sortExercise: pure logic of the generic "drop chips on labelled zones" exercise

import { test, assert, assertEqual } from './assert.js';
import { createSort, dropOnZone, sortSolved, zoneChips } from '../js/sortExercise.js';

const model = () => ({
    title: 'Test',
    zones: [{ id: 'a', title: 'A' }, { id: 'b', title: 'B' }, { id: 'c', title: 'C' }],
    chips: [
        { id: 'x', text: 'X', zones: ['a'], en: 'ex' },
        { id: 'y', text: 'Y', zones: ['b', 'c'], en: null },
        { id: 'z', text: 'Z', zones: ['c'], en: null },
    ],
});
const fresh = () => createSort(model(), () => 0);

export function runSortExerciseTests() {
    test('sort: right drop places the chip', () => {
        const r = dropOnZone(fresh(), 'x', 'a');
        assert(r.ok && !r.auto);
        assertEqual(r.state.placed, { x: 'a' });
        assertEqual(r.state.mistakes, 0);
        assert(!r.state.tray.includes('x'));
    });
    test('sort: wrong drop counts and does not place', () => {
        const r = dropOnZone(fresh(), 'x', 'b');
        assert(!r.ok && !r.auto);
        assertEqual(r.state.placed, {});
        assertEqual(r.state.attempts, { x: 1 });
        assertEqual(r.state.mistakes, 1);
        assert(r.state.tray.includes('x'));
    });
    test('sort: a chip with two accepted zones is right in either', () => {
        assert(dropOnZone(fresh(), 'y', 'b').ok);
        assert(dropOnZone(fresh(), 'y', 'c').ok);
        assert(!dropOnZone(fresh(), 'y', 'a').ok);
    });
    test('sort: three wrong drops auto-place into the first accepted zone', () => {
        let s = fresh();
        let r;
        for (let i = 0; i < 3; i++) { r = dropOnZone(s, 'y', 'a'); s = r.state; }
        assert(!r.ok && r.auto);
        assertEqual(s.placed, { y: 'b' });
        assertEqual(s.mistakes, 3);
        assert(!s.tray.includes('y'));
    });
    test('sort: placed or unknown chip changes nothing', () => {
        const placed = dropOnZone(fresh(), 'x', 'a').state;
        const again = dropOnZone(placed, 'x', 'b');
        assert(!again.ok && !again.auto);
        assertEqual(again.state, placed);
        const unknown = dropOnZone(placed, 'nope', 'a');
        assert(!unknown.ok);
        assertEqual(unknown.state, placed);
        assertEqual(dropOnZone(fresh(), 'x', 'nozone').state, fresh());
    });
    test('sort: solved once every chip is placed; zoneChips in placing order', () => {
        let s = fresh();
        assert(!sortSolved(s));
        s = dropOnZone(s, 'z', 'c').state;
        s = dropOnZone(s, 'y', 'c').state;
        assert(!sortSolved(s));
        s = dropOnZone(s, 'x', 'a').state;
        assert(sortSolved(s));
        assertEqual(zoneChips(s, 'c').map(c => c.id), ['z', 'y']);
        assertEqual(zoneChips(s, 'a').map(c => c.id), ['x']);
        assertEqual(zoneChips(s, 'b'), []);
    });
    test('sort: the input state is not mutated', () => {
        const s = fresh();
        const before = JSON.stringify(s);
        dropOnZone(s, 'x', 'b');
        dropOnZone(s, 'x', 'a');
        assertEqual(JSON.stringify(s), before);
    });
    test('sort: createSort tray holds every chip once for extreme rng values', () => {
        for (const rng of [() => 0, () => 0.999]) {
            assertEqual([...createSort(model(), rng).tray].sort(), ['x', 'y', 'z']);
        }
    });
}
