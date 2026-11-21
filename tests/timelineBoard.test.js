// timelineBoard: verb data of the time board (Die Zeit) and its pure sentence logic

import { test, assertEqual } from './assert.js';
import { readText } from './stubs.js';
import { AUX, timeSentence, timelineItemIds, clampFrame, clampSentence, auxHint, once, zoneAt, clampGeometry } from '../js/timelineBoard.js';
import { BOARDS } from '../js/boards.js';

const file = JSON.parse(readText('data/boards/zeit.json'));
const [set1, set2] = file.sets;
const verb = id => [...set1.items, ...set2.items].find(v => v.id === id);

export function runTimelineBoardTests() {
    test('timeSentence: past, now and future of a plain verb', () => {
        assertEqual(timeSentence(verb('kochen'), 'past'), 'Gestern hat Ayisha Biryani gekocht.');
        assertEqual(timeSentence(verb('kochen'), 'now'), 'Jetzt kocht Ayisha Biryani.');
        assertEqual(timeSentence(verb('kochen'), 'future'), 'Morgen kocht Ayisha Biryani.');
    });

    test('timeSentence: a separable verb puts the particle at the end; sein verbs use sein', () => {
        assertEqual(timeSentence(verb('anrufen'), 'now'), 'Jetzt rufe ich meine Mutter an.');
        assertEqual(timeSentence(verb('anrufen'), 'past'), 'Gestern habe ich meine Mutter angerufen.');
        assertEqual(timeSentence(verb('kommen'), 'past'), 'Gestern seid ihr spät gekommen.');
    });

    test('timeSentence: an empty rest leaves no double space', () => {
        const v = { ...verb('schlafen'), rest: '' };
        assertEqual(timeSentence(v, 'past'), 'Gestern habe ich geschlafen.');
        assertEqual(timeSentence(v, 'now'), 'Jetzt schlafe ich.');
    });

    test('AUX: forms of haben and sein', () => {
        assertEqual(AUX.haben, { ich: 'habe', du: 'hast', er: 'hat', wir: 'haben', ihr: 'habt' });
        assertEqual(AUX.sein, { ich: 'bin', du: 'bist', er: 'ist', wir: 'sind', ihr: 'seid' });
    });

    test('clampSentence and clampFrame', () => {
        const gehen = verb('gehen');
        assertEqual(clampSentence(gehen), 'Wir sind gestern in den Park gegangen.');
        const f = clampFrame(gehen);
        assertEqual(f.before, 'Wir');
        assertEqual(f.middle, 'gestern in den Park');
        assertEqual(f.auxOptions, ['haben', 'sind']);
        assertEqual(f.auxAnswer, 'sind');
        assertEqual(f.partAnswer, 'gegangen');
        assertEqual(f.partOptions.slice().sort(), ['gegangen', 'gegeht', 'ging'].sort());
        assertEqual(clampFrame(verb('anrufen')).auxOptions, ['habe', 'bin']);
        assertEqual(clampFrame({ ...verb('schlafen'), rest: '' }).middle, 'gestern');
    });

    test('clampFrame: the order of the options follows rng; three distinct options', () => {
        const opts = clampFrame(verb('bekommen')).partOptions;
        assertEqual(new Set(opts).size, 3);
        assertEqual(opts.filter(o => o === 'bekommen').length, 1);
        assertEqual(clampFrame(verb('gehen'), () => 0).partOptions.length, 3);
        const seen = new Set();
        for (let n = 0; n < 60; n++) seen.add(clampFrame(verb('gehen')).partOptions.join());
        assertEqual(seen.size > 1, true);
    });

    test('auxHint', () => {
        assertEqual(auxHint(verb('sein')), 'sein und bleiben: immer mit sein');
        assertEqual(auxHint(verb('bleiben')), 'sein und bleiben: immer mit sein');
        assertEqual(auxHint(verb('fahren')), 'Bewegung oder Veränderung → sein');
        assertEqual(auxHint(verb('kochen')), 'Alle anderen → haben');
    });

    test('once: only the first call runs', () => {
        let n = 0;
        const f = once(() => ++n);
        f(); f(); f();
        assertEqual(n, 1);
    });

    test('zoneAt: the zone under the point, null outside every zone', () => {
        const rects = { past: { left: 0, top: 0, right: 100, bottom: 100 }, now: { left: 110, top: 0, right: 210, bottom: 100 } };
        assertEqual(zoneAt(rects, 50, 50), 'past');
        assertEqual(zoneAt(rects, 150, 10), 'now');
        assertEqual(zoneAt(rects, 105, 50), null);
        assertEqual(zoneAt(rects, 50, 150), null);
    });

    test('clampGeometry: open bar has a break, closed one is joined; wrapped gaps route via the right margin', () => {
        const [a1, a2] = clampGeometry({ x: 20, y: 30 }, { x: 120, y: 30 }, 300, true);
        assertEqual([a1, a2], ['M20,30 L20,4 L60,4', 'M80,4 L120,4 L120,30']);
        const [c1, c2] = clampGeometry({ x: 20, y: 30 }, { x: 120, y: 30 }, 300, false);
        assertEqual([c1, c2], ['M20,30 L20,9 L70,9', 'M70,9 L120,9 L120,30']);
        const [, w2] = clampGeometry({ x: 20, y: 30 }, { x: 120, y: 80 }, 300, false);
        assertEqual(w2.includes('L294,9 L294,73 L120,73 L120,80'), true);
    });

    test('timelineItemIds: wann has three per verb, other modes one', () => {
        assertEqual(timelineItemIds(set1, 'wann').length, 36);
        assertEqual(timelineItemIds(set1, 'wann').slice(0, 3), ['machen.past', 'machen.now', 'machen.future']);
        assertEqual(timelineItemIds(set1, 'klammer').length, 12);
        assertEqual(timelineItemIds(set1, 'hilfsverb')[0], 'machen');
    });

    test('data/boards/zeit.json: registry entry, sets, verbs', () => {
        const def = BOARDS.find(b => b.id === 'zeit');
        assertEqual([def.title, def.kind, def.file, def.version], ['Die Zeit', 'timeline', 'data/boards/zeit.json', file.version]);
        assertEqual(def.modes.map(m => [m.id, m.label, m.scored]),
            [['wann', 'Wann?', true], ['klammer', 'Klammer', true], ['hilfsverb', 'haben oder sein?', true]]);
        assertEqual(file.sets.map(s => [s.id, s.items.length]), [['perfekt-1', 12], ['perfekt-2', 24]]);
        assertEqual(set1.unlock, { level: 'A1', category: 'g5k3', label: '5.3 Ein Ausflug' });
        assertEqual(set2.unlock, { level: 'A2', category: 'g1k1', label: 'A2 1.1 Der erste Kurstag' });
        const all = [...set1.items, ...set2.items];
        assertEqual(new Set(all.map(v => v.id)).size, all.length);
        for (const v of all) {
            assertEqual(['haben', 'sein'].includes(v.aux), true);
            assertEqual(v.wrong.length, 2);
            assertEqual(v.wrong.every(w => w !== v.partizip), true);
            assertEqual(['ich', 'du', 'er', 'wir', 'ihr'].includes(v.person), true);
            if (['Ayisha', 'Faris', 'Lea', 'Max'].includes(v.subject)) assertEqual(v.person, 'er');
            if (v.particle) assertEqual(v.inf.startsWith(v.particle), true);
            assertEqual(v.id, v.inf);
        }
    });
}
