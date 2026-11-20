// hotspotBoard: noun parsing, nearest spot, naming options, pain sentence, and the body vocabulary data

import { test, assertEqual } from './assert.js';
import { readText } from './stubs.js';
import { parseNoun, nearestSpot, nameOptions, painSentence, painUsesPlural, whereQuestion } from '../js/hotspotBoard.js';

const item = (id, de, extra = {}) => ({ id, de, en: id, spot: [50, 50], ...extra });
const KOPF = item('kopf', 'der Kopf, Köpfe');
const BRUST = item('brust', 'die Brust, Brüste');
const SCHULTER = item('schulter', 'die Schulter, Schultern', { pair: true });
const KNIE = item('knie', 'das Knie, Knie', { pair: true });
const AUGE = item('auge', 'das Auge, Augen', { pair: true });
const HAARE = item('haare', 'die Haare (pl.)');

// R2: the items a person has more than one of
const PAIR_IDS = {
    aussen: ['schulter', 'arm', 'ellbogen', 'handgelenk', 'hand', 'finger', 'daumen', 'huefte', 'bein',
        'oberschenkel', 'knie', 'unterschenkel', 'knoechel', 'fuss', 'zeh'],
    gesicht: ['augenbraue', 'auge', 'ohr', 'wange', 'lippe', 'zahn'],
    hinten: ['kniekehle', 'wade', 'ferse'],
    organe: ['lunge', 'niere'],
};

export function runHotspotBoardTests() {
    test('parseNoun: article, noun, plural, gender', () => {
        assertEqual(parseNoun('der Fuß, Füße'),
            { article: 'der', noun: 'Fuß', plural: 'Füße', pluralOnly: false, gender: 'masc' });
        assertEqual(parseNoun('die Schulter, Schultern').gender, 'fem');
        assertEqual(parseNoun('das Knie, Knie'),
            { article: 'das', noun: 'Knie', plural: 'Knie', pluralOnly: false, gender: 'neut' });
        assertEqual(parseNoun('die Haare (pl.)'),
            { article: 'die', noun: 'Haare', plural: null, pluralOnly: true, gender: 'pl' });
    });

    test('painSentence: singular, plural for pair items, plural-only always plural', () => {
        assertEqual(painSentence(KOPF, false), 'Mein Kopf tut weh.');
        assertEqual(painSentence(SCHULTER, false), 'Meine Schulter tut weh.');
        assertEqual(painSentence(KNIE, false), 'Mein Knie tut weh.');
        assertEqual(painSentence(AUGE, true), 'Meine Augen tun weh.');
        assertEqual(painSentence(HAARE, false), 'Meine Haare tun weh.');
        assertEqual(painSentence(HAARE, true), 'Meine Haare tun weh.');
    });

    test('painSentence: non-pair items stay singular even with usePlural', () => {
        assertEqual(painSentence(KOPF, true), 'Mein Kopf tut weh.');
        assertEqual(painSentence(BRUST, true), 'Meine Brust tut weh.');
    });

    test('painUsesPlural: every second pair item by its pair index', () => {
        const items = [KOPF, SCHULTER, BRUST, KNIE, AUGE, item('arm', 'der Arm, Arme', { pair: true })];
        assertEqual(items.map(i => painUsesPlural(items, i.id)), [false, false, false, true, false, true]);
        assertEqual(painUsesPlural(items, 'nope'), false);
    });

    test('whereQuestion: singular and plural-only', () => {
        assertEqual(whereQuestion(KNIE), 'Wo ist das Knie?');
        assertEqual(whereQuestion(HAARE), 'Wo sind die Haare?');
    });

    test('nearestSpot: nearest wins, far tap is null', () => {
        const items = [item('a', 'der A', { spot: [40, 50] }), item('b', 'der B', { spot: [44, 50] })];
        assertEqual(nearestSpot(items, 43, 50), 'b');
        assertEqual(nearestSpot(items, 41, 50), 'a');
        assertEqual(nearestSpot(items, 80, 80), null);
        assertEqual(nearestSpot(items, 40, 59.5), null);
    });

    test('nameOptions: four distinct ids including the asked one; smaller sets give fewer', () => {
        const items = ['a', 'b', 'c', 'd', 'e', 'f'].map(i => item(i, 'der ' + i));
        for (let n = 0; n < 20; n++) {
            const opts = nameOptions(items, 'c');
            assertEqual(opts.length, 4);
            assertEqual(new Set(opts).size, 4);
            assertEqual(opts.includes('c'), true);
        }
        assertEqual(nameOptions(items.slice(0, 3), 'a').slice().sort(), ['a', 'b', 'c']);
        assertEqual(nameOptions(items, 'c', () => 0).length, 4);
    });

    test('data/boards/koerper.json: vocabulary, ids, pair flags', () => {
        const file = JSON.parse(readText('data/boards/koerper.json'));
        assertEqual(Number.isInteger(file.version) && file.version > 0, true);
        assertEqual(file.sets.map(s => s.items.length), [19, 12, 6, 14]);
        for (const set of file.sets) {
            const ids = set.items.map(i => i.id);
            assertEqual(new Set(ids).size, ids.length);
            for (const it of set.items) {
                assertEqual(/^[a-z0-9-]+$/.test(it.id), true);
                assertEqual(it.en.length > 0, true);
                assertEqual(it.spot.length === 2 && it.spot.every(n => typeof n === 'number' && n >= 0 && n <= 100), true);
                assertEqual(parseNoun(it.de).noun.length > 0, true);
            }
            assertEqual(set.items.filter(i => i.pair).map(i => i.id), PAIR_IDS[set.id]);
            assertEqual(set.items.every(i => i.pair === undefined || i.pair === true), true);
        }
        assertEqual(file.sets[1].items.find(i => i.id === 'haare').de, 'die Haare (pl.)');
    });
}
