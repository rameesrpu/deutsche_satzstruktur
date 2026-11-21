// hotspotBoard: noun parsing, nearest spot, naming options, pain sentence, and the body vocabulary data

import { test, assertEqual } from './assert.js';
import { readText } from './stubs.js';
import { parseNoun, nearestSpot, inArea, tapTargets, tapIsRight, nameOptions, painSentence, painUsesPlural, whereQuestion, tapPercent, labelModel, picClass } from '../js/hotspotBoard.js';
import { BOARDS } from '../js/boards.js';

// Every hotspot board file in the registry
const hotspotFiles = () => BOARDS.filter(b => b.kind === 'hotspot').map(b => JSON.parse(readText(b.file)));

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

    test('tapTargets: mirror sets add the other side of pair items; bein only when asked', () => {
        const file = JSON.parse(readText('data/boards/koerper.json'));
        const aussen = file.sets.find(s => s.id === 'aussen');
        const gesicht = file.sets.find(s => s.id === 'gesicht');
        assertEqual([aussen.mirror, file.sets.find(s => s.id === 'hinten').mirror, gesicht.mirror], [true, true, undefined]);
        assertEqual(aussen.items.find(i => i.id === 'bein').accepts, ['oberschenkel', 'knie', 'unterschenkel']);
        const knieTap = [100 - 39.7, 75];
        const targets = tapTargets(aussen, 'knie');
        assertEqual(targets.some(t => t.id === 'bein'), false);
        const hit = nearestSpot(targets, ...knieTap);
        assertEqual(hit, 'knie');
        assertEqual(tapIsRight(aussen, 'knie', hit), true);
        // asked bein: the bein spot is in the test, and a knee tap on either leg is right
        const forBein = tapTargets(aussen, 'bein');
        assertEqual(forBein.some(t => t.id === 'bein'), true);
        assertEqual(tapIsRight(aussen, 'bein', nearestSpot(forBein, ...knieTap)), true);
        assertEqual(tapIsRight(aussen, 'bein', nearestSpot(forBein, 39.7, 75)), true);
        assertEqual(tapIsRight(aussen, 'bein', 'fuss'), false);
        // one-sided items are not mirrored
        assertEqual(targets.filter(t => t.id === 'kopf').length, 1);
        assertEqual(targets.filter(t => t.id === 'knie').length, 2);
        // not mirrored set: unchanged
        assertEqual(tapTargets(gesicht, 'auge').length, gesicht.items.length);
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

    test('hotspot boards: spots of a set at least 6 percent apart (nearestSpot tells them apart)', () => {
        const close = [];
        for (const file of hotspotFiles()) {
            for (const set of file.sets) {
                set.items.forEach((a, i) => set.items.slice(i + 1).forEach(b => {
                    if (Math.hypot(a.spot[0] - b.spot[0], a.spot[1] - b.spot[1]) < 6) close.push(`${file.id}/${set.id}: ${a.id}/${b.id}`);
                }));
            }
        }
        assertEqual(close, []);
    });

    test('hotspot boards: every item parses, ids unique, spots in 0-100', () => {
        const files = hotspotFiles();
        assertEqual(files.map(f => f.id), ['koerper', 'station']);
        for (const file of files) {
            assertEqual(Number.isInteger(file.version) && file.version > 0, true);
            for (const set of file.sets) {
                const ids = set.items.map(i => i.id);
                assertEqual([set.id, new Set(ids).size], [set.id, ids.length]);
                for (const it of set.items) {
                    assertEqual([it.id, /^[a-z0-9-]+$/.test(it.id), it.en.length > 0], [it.id, true, true]);
                    assertEqual([it.id, it.spot.length === 2 && it.spot.every(n => typeof n === 'number' && n >= 0 && n <= 100)], [it.id, true]);
                    assertEqual([it.id, parseNoun(it.de).noun.length > 0], [it.id, true]);
                }
            }
        }
    });

    test('hotspot boards: every picture exists, no text, under 40 KB; 300x400, or 400x300 in a wide set', () => {
        for (const file of hotspotFiles()) {
            for (const set of file.sets) {
                const svg = readText('data/boards/' + set.image);
                const box = set.wide ? 'viewBox="0 0 400 300"' : 'viewBox="0 0 300 400"';
                assertEqual([set.image, new TextEncoder().encode(svg).length < 40 * 1024], [set.image, true]);
                assertEqual([set.image, svg.includes(box)], [set.image, true]);
                assertEqual([set.image, /<text\b/.test(svg)], [set.image, false]);
            }
        }
    });

    test('data/boards/station.json: rooms and team vocabulary', () => {
        const file = JSON.parse(readText('data/boards/station.json'));
        assertEqual([file.id, file.kind, file.version], ['station', 'hotspot', 3]);
        assertEqual(file.sets.map(s => [s.id, s.title, s.image, !!s.wide]),
            [['raeume', 'Die Räume', 'img/station.svg', true], ['team', 'Das Team', 'img/team.svg', false]]);
        const de = id => file.sets.flatMap(s => s.items).find(i => i.id === id);
        assertEqual(file.sets.map(s => s.items.length), [12, 8]);
        assertEqual(de('stationszimmer').de, 'das Stationszimmer, Stationszimmer');
        assertEqual(de('lager').de, 'das Lager, Lager');
        assertEqual(de('auszubildender').de, 'der Auszubildende, Auszubildenden');
        assertEqual(labelModel(de('auszubildender')).plural, 'Plural: die Auszubildenden');
        assertEqual(whereQuestion(de('flur')), 'Wo ist der Flur?');
        // no body parts here: no pair or mirror flags, no locks (the Klinik tile opens it)
        assertEqual(file.sets.some(s => s.mirror || s.unlock || s.items.some(i => i.pair || i.accepts)), false);
    });

    test('nearestSpot: a tap inside an area answers its item, the smallest nested area wins, else the nearest spot', () => {
        const items = [
            item('flur', 'der Flur', { spot: [60, 50], area: [0, 40, 100, 20] }),
            item('eingang', 'der Eingang', { spot: [5, 50], area: [0, 45, 10, 10] }),
            item('bad', 'das Bad', { spot: [45, 77], area: [40, 60, 10, 30] }),
            item('zimmer', 'das Zimmer', { spot: [76, 77] }),
        ];
        assertEqual(nearestSpot(items, 2, 41), 'flur');       // 58 from the corridor spot, inside its area
        assertEqual(nearestSpot(items, 4, 50), 'eingang');    // nested in the corridor: the smaller area
        assertEqual(nearestSpot(items, 49, 77), 'bad');
        assertEqual(nearestSpot(items, 51, 77), 'bad');       // outside every area: nearest spot within 9 %
        assertEqual(nearestSpot(items, 60, 92), null);        // outside every area and far from every spot
        assertEqual(nearestSpot(items, 70, 77), 'zimmer');    // no area: the old 9 % rule
        assertEqual([inArea([0, 40, 100, 20], 100, 60), inArea([0, 40, 100, 20], 100.1, 60)], [true, false]);
    });

    test('station rooms and team boxes: centre and corners resolve to their own item, in every tap mode', () => {
        const file = JSON.parse(readText('data/boards/station.json'));
        const wrong = [];
        for (const set of file.sets) {
            for (const it of set.items) {
                const [x, y, w, h] = it.area;
                assertEqual([it.id, inArea(it.area, ...it.spot), x >= 0 && y >= 0 && x + w <= 100 && y + h <= 100], [it.id, true, true]);
                const points = [[x + w / 2, y + h / 2], [x + 1, y + 1], [x + w - 1, y + 1], [x + 1, y + h - 1], [x + w - 1, y + h - 1]];
                for (const [px, py] of points) {
                    if (nearestSpot(set.items, px, py) !== it.id) wrong.push(`${it.id} entdecken ${px},${py}`);
                    if (nearestSpot(tapTargets(set, it.id), px, py) !== it.id) wrong.push(`${it.id} zeigen ${px},${py}`);
                }
            }
        }
        assertEqual(wrong, []);
        const raeume = file.sets[0].items;
        // the bathroom wall is at x 53.75 %: 52 is still the bathroom, 55 the patient room
        assertEqual([nearestSpot(raeume, 52, 77), nearestSpot(raeume, 55, 77), nearestSpot(raeume, 90, 95)], ['bad', 'patientenzimmer', 'patientenzimmer']);
        assertEqual([nearestSpot(raeume, 20, 50), nearestSpot(raeume, 95, 50), nearestSpot(raeume, 5, 50)], ['flur', 'flur', 'eingang']);
        assertEqual([nearestSpot(raeume, 40, 5), nearestSpot(raeume, 40, 40)], ['stationszimmer', 'stationszimmer']);
    });

    test('body map: no areas, so taps keep the nearest-spot rule', () => {
        const file = JSON.parse(readText('data/boards/koerper.json'));
        assertEqual(file.sets.some(s => s.items.some(i => i.area)), false);
        const aussen = file.sets.find(s => s.id === 'aussen');
        assertEqual(tapTargets(aussen, 'kopf').some(t => 'area' in t), false);
    });

    test('picClass: a wide set gets the landscape picture box', () => {
        assertEqual(picClass({}), 'hs-pic');
        assertEqual(picClass({ wide: true }), 'hs-pic hs-pic--wide');
    });

    test('tapPercent: percent of the picture box at any size', () => {
        assertEqual(tapPercent({ left: 10, top: 20, width: 200, height: 400 }, 110, 120), [50, 25]);
        assertEqual(tapPercent({ left: 0, top: 0, width: 300, height: 400 }, 150, 40), [50, 10]);
    });

    test('labelModel: article, plural line, none for plural-only', () => {
        assertEqual(labelModel(KNIE), { article: 'das', noun: 'Knie', gender: 'neut', plural: 'Plural: die Knie', en: 'knie', speech: 'das Knie' });
        const haare = labelModel(item('haare', 'die Haare (pl.)'));
        assertEqual([haare.gender, haare.plural, haare.speech], ['pl', null, 'die Haare']);
    });
}
