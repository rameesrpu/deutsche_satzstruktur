// sceneBoard: sentence logic of the preposition scene (Wo? Wohin?) and its data file

import { test, assertEqual } from './assert.js';
import { readText } from './stubs.js';
import { parseNoun } from '../js/hotspotBoard.js';
import { PREPS, sceneItemIds, sceneSentence, articleBlank, prepOptions, ruleHint } from '../js/sceneBoard.js';

const file = JSON.parse(readText('data/boards/wechselpraepositionen.json'));
const set = file.sets[0];

const LANDMARKS = {
    tisch: 'der Tisch, Tische', bank: 'die Bank, Bänke', huehnerhaus: 'das Hühnerhaus, Hühnerhäuser',
    zaun: 'der Zaun, Zäune', baum: 'der Baum, Bäume', kiste: 'die Kiste, Kisten', blumen: 'die Blumen (pl.)',
};
// prep landmark wohin wo
const ROWS = `auf tisch springt sitzt|unter tisch läuft sitzt|neben tisch läuft steht|auf bank springt sitzt|unter bank läuft liegt|hinter bank läuft steht|in huehnerhaus geht schläft|vor huehnerhaus läuft steht|hinter huehnerhaus läuft steht|auf huehnerhaus fliegt sitzt|an zaun läuft steht|ueber zaun fliegt -|hinter zaun läuft steht|vor zaun läuft steht|auf baum fliegt sitzt|unter baum läuft liegt|hinter baum läuft steht|vor baum läuft steht|in kiste springt sitzt|auf kiste springt sitzt|neben kiste läuft steht|hinter kiste läuft steht|zwischen blumen läuft sitzt`;

function built() {
    const landmarks = {};
    for (const [k, de] of Object.entries(LANDMARKS)) landmarks[k] = { de };
    const items = ROWS.split('|').map(r => {
        const [prep, lm, wohin, wo] = r.split(' ');
        return { id: `${prep}-${lm}`, prep: prep === 'ueber' ? 'über' : prep, landmark: lm, landmark2: null,
            spot: [50, 50], verbs: { wohin, wo: wo === '-' ? null : wo } };
    });
    items.push({ id: 'zwischen-baum-bank', prep: 'zwischen', landmark: 'baum', landmark2: 'bank',
        spot: [50, 50], verbs: { wohin: 'läuft', wo: 'steht' } });
    return { id: 'garten', mover: { de: 'das Huhn, Hühner' }, landmarks, items };
}
const S = built();
const text = id => sceneSentence(S, id).text;

export function runSceneBoardTests() {
    test('sceneSentence: masculine, neuter contracted, feminine, plural, two landmarks', () => {
        assertEqual(text('unter-tisch.wohin'), 'Das Huhn läuft unter den Tisch.');
        assertEqual(text('unter-tisch.wo'), 'Das Huhn sitzt unter dem Tisch.');
        assertEqual(text('in-huehnerhaus.wohin'), 'Das Huhn geht ins Hühnerhaus.');
        assertEqual(text('in-huehnerhaus.wo'), 'Das Huhn schläft im Hühnerhaus.');
        assertEqual(text('an-zaun.wohin'), 'Das Huhn läuft an den Zaun.');
        assertEqual(text('an-zaun.wo'), 'Das Huhn steht am Zaun.');
        assertEqual(text('in-kiste.wohin'), 'Das Huhn springt in die Kiste.');
        assertEqual(text('in-kiste.wo'), 'Das Huhn sitzt in der Kiste.');
        assertEqual(text('zwischen-blumen.wohin'), 'Das Huhn läuft zwischen die Blumen.');
        assertEqual(text('zwischen-blumen.wo'), 'Das Huhn sitzt zwischen den Blumen.');
        assertEqual(text('zwischen-baum-bank.wohin'), 'Das Huhn läuft zwischen den Baum und die Bank.');
        assertEqual(text('zwischen-baum-bank.wo'), 'Das Huhn steht zwischen dem Baum und der Bank.');
    });

    test('sceneSentence: fields (kind, case, phrase, answer, other)', () => {
        assertEqual(sceneSentence(S, 'in-huehnerhaus.wohin'), {
            kind: 'wohin', case: 'akk', text: 'Das Huhn geht ins Hühnerhaus.', verb: 'geht', prep: 'in',
            phrase: 'ins Hühnerhaus', answer: 'ins', other: 'im',
        });
        const two = sceneSentence(S, 'zwischen-baum-bank.wohin');
        assertEqual([two.phrase, two.answer, two.other], ['zwischen den Baum und die Bank', 'den … die', 'dem … der']);
        const an = sceneSentence(S, 'an-zaun.wo');
        assertEqual([an.kind, an.case, an.answer, an.other], ['wo', 'dat', 'am', 'an den']);
    });

    test('sceneItemIds: 47 ids, a movement-only item has no Wo? id', () => {
        const ids = sceneItemIds(S);
        assertEqual(ids.length, 47);
        assertEqual(ids.includes('ueber-zaun.wohin'), true);
        assertEqual(ids.includes('ueber-zaun.wo'), false);
    });

    test('articleBlank: plain, contracted, feminine', () => {
        assertEqual(articleBlank(S, 'unter-tisch.wohin'),
            { before: 'Das Huhn läuft unter ', after: ' Tisch.', options: ['den', 'dem'], answer: 'den' });
        const h = articleBlank(S, 'in-huehnerhaus.wo');
        assertEqual([h.before, h.after, h.options, h.answer], ['Das Huhn schläft ', ' Hühnerhaus.', ['ins', 'im'], 'im']);
        const b = articleBlank(S, 'auf-bank.wo');
        assertEqual([b.options, b.answer], [['die', 'der'], 'der']);
    });

    test('articleBlank R1: an-zaun covers preposition and article in both kinds', () => {
        const akk = articleBlank(S, 'an-zaun.wohin');
        assertEqual([akk.before, akk.after, akk.options, akk.answer], ['Das Huhn läuft ', ' Zaun.', ['an den', 'am'], 'an den']);
        const dat = articleBlank(S, 'an-zaun.wo');
        assertEqual([dat.before, dat.options, dat.answer], ['Das Huhn steht ', ['an den', 'am'], 'am']);
    });

    test('articleBlank: plural landmark and two landmarks', () => {
        const pl = articleBlank(S, 'zwischen-blumen.wo');
        assertEqual([pl.before, pl.after, pl.options, pl.answer], ['Das Huhn sitzt zwischen ', ' Blumen.', ['die', 'den'], 'den']);
        const two = articleBlank(S, 'zwischen-baum-bank.wohin');
        assertEqual(two, { before: 'Das Huhn läuft zwischen ', after: '{1} Baum und {2} Bank.',
            options: ['den … die', 'dem … der'], answer: 'den … die' });
    });

    test('prepOptions: four distinct prepositions including the right one', () => {
        for (const rng of [() => 0, () => 0.5, () => 0.99, Math.random]) {
            const o = prepOptions('unter-tisch.wohin', rng);
            assertEqual(o.length, 4);
            assertEqual(new Set(o).size, 4);
            assertEqual(o.every(p => PREPS.includes(p)), true);
            assertEqual(o.includes('unter'), true);
        }
        assertEqual(prepOptions('ueber-zaun.wohin').includes('über'), true);
    });

    test('ruleHint', () => {
        assertEqual(ruleHint('wohin'), 'Wohin? → Akkusativ');
        assertEqual(ruleHint('wo'), 'Wo? → Dativ');
    });

    test('data/boards/wechselpraepositionen.json: 7 landmarks, 24 items, valid references', () => {
        assertEqual(file.id, 'wechsel');
        assertEqual(file.kind, 'scene');
        assertEqual(set.unlock, { level: 'A1', category: 'g5k3', label: '5.3 Ein Ausflug' });
        assertEqual(Object.keys(set.landmarks).length, 7);
        assertEqual(set.items.length, 24);
        assertEqual(new Set(set.items.map(i => i.id)).size, 24);
        for (const lm of Object.values(set.landmarks)) parseNoun(lm.de);
        for (const it of set.items) {
            assertEqual(!!set.landmarks[it.landmark], true);
            if (it.landmark2) assertEqual(!!set.landmarks[it.landmark2], true);
            assertEqual(it.spot.every(n => n >= 0 && n <= 100), true);
        }
        assertEqual(sceneItemIds(set).length, 47);
    });
}
