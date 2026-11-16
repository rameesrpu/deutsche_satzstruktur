// fieldZones: unit tests + a snapshot of every A1 chapter sentence's zones (or "-"),
// to review by hand: tests/snapshots/field-zones.json

import { listDir, readText, writeText, tagged } from './stubs.js';
import { test, assert, assertEqual } from './assert.js';
import { fieldZones } from '../js/fieldZones.js';

const SNAPSHOT = 'tests/snapshots/field-zones.json';
const z = (text, tags) => fieldZones(tagged(text, tags));

export function runFieldZonesTests({ update = false } = {}) {
    test('fieldZones: subject first', () => assertEqual(z('Ich brauche einen Tisch.', 'S.ich V.ich O.m.akk O.m.akk'),
        { lead: [], vorfeld: [0], verb: [1], mittelfeld: [2, 3], ende: [] }));
    test('fieldZones: modal bracket, adverb first', () =>
        assertEqual(z('Heute muss Ayisha im Krankenhaus arbeiten.', 'X M.er S.er P O.n.dat V'),
            { lead: [], vorfeld: [0], verb: [1], mittelfeld: [2, 3, 4], ende: [5] }));
    test('fieldZones: separable particle', () => assertEqual(z('Ich rufe dich morgen an.', 'S.ich V.ich O.du.akk X P'),
        { lead: [], vorfeld: [0], verb: [1], mittelfeld: [2, 3], ende: [4] }));
    test('fieldZones: yes/no question has an empty Vorfeld', () =>
        assertEqual(z('Kommst du heute?', 'V.du S.du X').vorfeld, []));
    test('fieldZones: leading interjection and conjunction go to lead', () =>
        assertEqual(z('Ja, ich bin neu.', 'X S.ich V.ich X').lead, [0]));
    test('fieldZones: two finite verbs → null', () =>
        assertEqual(z('Ich koche und er isst.', 'S.ich V.ich K S.er V.er'), null));
    test('fieldZones: no verb → null', () => assertEqual(z('Guten Morgen!', 'X X'), null));
    test('fieldZones: empty → null', () => assertEqual(fieldZones([]), null));
    test('fieldZones: subordinate clause → null', () =>
        assertEqual(z('Ich bleibe, weil ich krank bin.', 'S.ich V.ich / C S.ich X V.ich'), null));
    test('fieldZones: adjacent non-finite verbs share the Ende', () =>
        assertEqual(z('Er will heute kommen lassen.', 'S.er M.er X V V').ende, [3, 4]));
    test('fieldZones: words after the closing verb part → null', () =>
        assertEqual(z('Ich will gehen heute.', 'S.ich M.ich V X'), null));

    runSnapshot(update);
}

const show = (words, idx) => idx.map(i => words[i].text).join(' ');

function buildSnapshot() {
    const out = {};
    let analysed = 0, total = 0;
    for (const file of listDir('data/library').filter(n => /^A1_g\d+k\d+\.json$/.test(n))) {
        const data = JSON.parse(readText(`data/library/${file}`));
        for (const s of data.sentences) {
            const r = fieldZones(s.words);
            total++;
            if (r) analysed++;
            out[s.text] = r ? `V: ${show(s.words, r.vorfeld)} | Verb: ${show(s.words, r.verb)} | M: ${show(s.words, r.mittelfeld)} | E: ${show(s.words, r.ende)}` : '-';
        }
    }
    return { out, analysed, total };
}

function runSnapshot(update) {
    const { out, analysed, total } = buildSnapshot();
    test('fieldZones: A1 chapters exist', () => assert(total > 200, `only ${total} sentences`));
    if (update) {
        writeText(SNAPSHOT, JSON.stringify(out, null, 1) + '\n');
        print(`Snapshot updated: field zones ${analysed}/${total} → ${SNAPSHOT}`);
        return;
    }
    let stored;
    try { stored = JSON.parse(readText(SNAPSHOT)); } catch (e) {
        test('field zones snapshot exists', () => { throw new Error(`${SNAPSHOT} missing — run with --update`); });
        return;
    }
    test('fieldZones: A1 snapshot unchanged', () => assertEqual(out, stored));
}
