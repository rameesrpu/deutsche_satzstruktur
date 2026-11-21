// pairsBoard: choice options, matching round, pair test, and the term-pair data

import { test, assertEqual } from './assert.js';
import { readText } from './stubs.js';
import { choiceOptions, pairRound, isPair } from '../js/pairsBoard.js';
import { BOARDS } from '../js/boards.js';
import { KLINIK_TILES, tileMode } from '../js/klinik.js';
import { parseNoun } from '../js/hotspotBoard.js';

const it = (id, setId, extra = {}) => ({ id, fach: `die F${id}`, alltag: `die A${id}`, en: id, setId, ...extra });
const BIG = ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map(i => it(i, 's1'));

export function runPairsBoardTests() {
    test('choiceOptions: four distinct ids with the asked one', () => {
        const o = choiceOptions(BIG, 'c', 'alltag');
        assertEqual(o.length, 4);
        assertEqual(new Set(o).size, 4);
        assertEqual(o.includes('c'), true);
    });

    test('choiceOptions: the twin is always included', () => {
        const items = BIG.map(i => (i.id === 'a' ? { ...i, twin: 'g' } : i));
        for (let n = 0; n < 30; n++) assertEqual(choiceOptions(items, 'a', 'fach').includes('g'), true);
    });

    test('choiceOptions: a three-item set fills from other sets', () => {
        const items = [it('a', 's1'), it('b', 's1'), it('c', 's1'), it('x', 's2'), it('y', 's2')];
        const o = choiceOptions(items, 'a', 'alltag');
        assertEqual(new Set(o).size, 4);
        assertEqual(o.includes('a') && o.includes('b') && o.includes('c'), true);
    });

    test('choiceOptions: shuffled by rng', () => {
        const seen = new Set();
        for (let n = 0; n < 20; n++) seen.add(choiceOptions(BIG, 'a', 'fach').join());
        assertEqual(seen.size > 1, true);
    });

    test('pairRound: twelve tiles for six items, each item once per side', () => {
        const { tiles } = pairRound(BIG);
        assertEqual(tiles.length, 12);
        assertEqual(new Set(tiles.map(t => t.key)).size, 12);
        for (const id of new Set(tiles.map(t => t.itemId))) {
            assertEqual(tiles.filter(t => t.itemId === id).map(t => t.side).sort(), ['alltag', 'fach']);
        }
        assertEqual(pairRound(BIG.slice(0, 3)).tiles.length, 6);
    });

    test('isPair: only the two sides of one item', () => {
        const t = (itemId, side) => ({ key: `${itemId}:${side}`, itemId, side, text: '' });
        assertEqual(isPair(t('a', 'fach'), t('a', 'alltag')), true);
        assertEqual(isPair(t('a', 'fach'), t('a', 'fach')), false);
        assertEqual(isPair(t('a', 'fach'), t('b', 'alltag')), false);
    });

    test('data/boards/fachbegriffe.json: 8 sets, 45+ items, unique ids, headwords parse, twins mutual', () => {
        const file = JSON.parse(readText('data/boards/fachbegriffe.json'));
        assertEqual(file.sets.map(s => s.id), ['herz', 'atmung', 'verdauung', 'niere', 'bewegung', 'kopf', 'haut', 'allgemein']);
        const items = file.sets.flatMap(s => s.items);
        assertEqual(items.length >= 45, true);
        assertEqual(new Set(items.map(i => i.id)).size, items.length);
        for (const i of items) {
            parseNoun(i.fach);
            parseNoun(i.alltag);
            assertEqual(typeof i.en === 'string' && i.en.length > 0, true);
            if (i.twin) {
                const t = items.find(x => x.id === i.twin);
                assertEqual(t !== undefined && t.twin === i.id, true);
            }
        }
    });

    test('Klinik tile Fachsprache und Alltagssprache is active once the board is registered', () => {
        const tile = KLINIK_TILES.find(t => t.id === 'fachbegriffe');
        assertEqual(tileMode(tile, BOARDS.map(b => b.id)), 'board');
    });
}
