// orderExercise: pure logic of rung 2 "Ordnen" (drop shuffled chips into field slots)

import { tagged } from './stubs.js';
import { test, assert, assertEqual } from './assert.js';
import { orderModel, createOrder, dropChip, isSolved, fieldChips } from '../js/orderExercise.js';

const model = () => orderModel(tagged('Heute muss Ayisha im Krankenhaus arbeiten.', 'X M.er S.er P O.n.dat V'));
const fresh = () => createOrder(model(), () => 0);

export function runOrderExerciseTests() {
    test('orderModel: chips, fields and end', () => {
        const m = model();
        assertEqual(m.chips.map(c => [c.text, c.field, c.fixed]), [
            ['Heute', 'vorfeld', true], ['muss', 'verb', false], ['Ayisha', 'mittelfeld', false],
            ['im Krankenhaus', 'mittelfeld', false], ['arbeiten', 'ende', false]]);
        assertEqual(m.chips.map(c => c.id), [0, 1, 2, 3, 4]);
        assertEqual(m.end, '.');
        assertEqual(m.fields, ['vorfeld', 'verb', 'mittelfeld', 'ende']);
    });
    test('orderModel: fewer than 3 movable chips → null', () =>
        assertEqual(orderModel(tagged('Ich bin neu.', 'S.ich V.ich X')), null));
    test('orderModel: not a main clause → null', () =>
        assertEqual(orderModel(tagged('Ich koche und er isst heute gut.', 'S.ich V.ich K S.er V.er X X')), null));
    test('orderModel: lead words are joined', () =>
        assertEqual(orderModel(tagged('Ja, ich bin heute neu.', 'X S.ich V.ich X X')).lead, 'Ja,'));
    test('orderModel: same case and gender make one chip', () => {
        const m = orderModel(tagged('Ich brauche heute einen großen Tisch!', 'S.ich V.ich X O.m.akk O.m.akk O.m.akk'));
        assertEqual(m.chips.map(c => c.text), ['Ich', 'brauche', 'heute', 'einen großen Tisch']);
        assertEqual(m.end, '!');
    });
    test('orderModel: yes/no question has no fixed chip', () => {
        const m = orderModel(tagged('Kommst du heute mit?', 'V.du S.du X P'));
        assert(m.chips.every(c => !c.fixed), 'no fixed chip');
        assertEqual(m.fields[0], 'vorfeld');
        assertEqual(m.end, '?');
        const r = dropChip(createOrder(m, () => 0), 1, 'verb');
        assertEqual(r.hint, 'Das Verb steht am Anfang.');
    });
    test('createOrder: tray is shuffled, never in sentence order', () => {
        for (const r of [0, 0.999]) {
            const s = createOrder(model(), () => r);
            assert(JSON.stringify(s.tray) !== '[1,2,3,4]', `rng ${r}: ${s.tray}`);
            assertEqual([...s.tray].sort(), [1, 2, 3, 4]);
        }
        const s = fresh();
        assertEqual(s.placed, { 0: true });
    });
    test('dropChip: right field places the chip, input state untouched', () => {
        const s = fresh();
        const r = dropChip(s, 1, 'verb');
        assertEqual([r.ok, r.auto, r.hint], [true, false, null]);
        assert(r.state.placed[1], 'placed');
        assert(!s.placed[1], 'input not mutated');
        assertEqual(s.tray.includes(1), true);
    });
    test('dropChip: wrong field counts a mistake and hints', () => {
        const r = dropChip(fresh(), 4, 'mittelfeld');
        assertEqual([r.ok, r.hint, r.state.mistakes, r.state.attempts[4]],
            [false, 'Der zweite Verbteil steht am Ende.', 1, 1]);
        assertEqual(dropChip(fresh(), 2, 'ende').hint, 'Am Ende steht nur der zweite Verbteil.');
        assertEqual(dropChip(fresh(), 2, 'vorfeld').hint, 'Das Vorfeld ist schon besetzt.');
        assertEqual(dropChip(fresh(), 1, 'mittelfeld').hint, 'Das Verb steht an Position 2.');
        assertEqual(dropChip(fresh(), 2, 'verb').hint, 'Das Verb steht an Position 2.');
    });
    test('dropChip: third wrong drop places the chip for her', () => {
        let s = fresh(), r;
        for (let i = 0; i < 3; i++) { r = dropChip(s, 1, 'mittelfeld'); s = r.state; }
        assertEqual([r.ok, r.auto, s.placed[1], s.mistakes], [false, true, true, 3]);
    });
    test('fieldChips: Mittelfeld order is untested, shown in sentence order', () => {
        let s = fresh();
        s = dropChip(s, 3, 'mittelfeld').state;
        s = dropChip(s, 2, 'mittelfeld').state;
        assertEqual(fieldChips(s, 'mittelfeld').map(c => c.text), ['Ayisha', 'im Krankenhaus']);
        assertEqual(fieldChips(s, 'vorfeld').map(c => c.text), ['Heute']);
    });
    test('dropChip: equal texts are told apart by id', () => {
        const m = orderModel(tagged('Sie gibt sie sie heute.', 'S.sie V.sie O.f.akk O.f.dat X'));
        assertEqual(m.chips.map(c => c.text), ['Sie', 'gibt', 'sie', 'sie', 'heute']);
        let s = createOrder(m, () => 0);
        s = dropChip(s, 3, 'mittelfeld').state;
        assertEqual([!!s.placed[2], !!s.placed[3]], [false, true]);
    });
    test('dropChip: unknown or placed chip leaves the state unchanged', () => {
        const s = fresh();
        for (const id of [99, 0]) {
            const r = dropChip(s, id, 'verb');
            assertEqual([r.ok, r.auto, r.hint], [false, false, null]);
            assertEqual(r.state, s);
        }
    });
    test('isSolved: all movable chips placed', () => {
        let s = fresh();
        assert(!isSolved(s), 'not yet');
        s = dropChip(s, 1, 'verb').state;
        s = dropChip(s, 2, 'mittelfeld').state;
        s = dropChip(s, 3, 'mittelfeld').state;
        assert(!isSolved(s), 'one left');
        s = dropChip(s, 4, 'ende').state;
        assert(isSolved(s), 'solved');
    });
}
