// felderLesson (E3): unit tests per kind + a snapshot of every A1 story chapter sentence
// (kind or "-") with the share per chapter, to review by hand: tests/snapshots/felder-lessons.json

import { listDir, readText, writeText } from './stubs.js';
import { test, assert, assertEqual } from './assert.js';
import { felderLesson } from '../js/felderLesson.js';

const SNAPSHOT = 'tests/snapshots/felder-lessons.json';

/**
 * Words from story tags (data/stories/CURRICULUM.md), like scripts/build_stories.py:
 * S.<p> subject, O.<p>.<case> object, V.<p>/M.<p> finite verb/modal, V non-finite verb,
 * P preposition/particle, X other, K coord. conjunction, C subordinating conjunction, "/" next clause.
 */
function tagged(text, tags) {
    const tokens = text.split(' ');
    const simple = { P: 'preposition', X: 'other', K: 'coord-conjunction', C: 'conjunction' };
    let clause = 0;
    const words = [];
    for (const tag of tags.split(' ')) {
        if (tag === '/') { clause++; continue; }
        const [kind, p] = tag.split('.');
        const type = simple[kind] || { S: 'subject', O: 'object', V: 'verb', M: 'modal' }[kind];
        const finite = (kind === 'V' || kind === 'M') && p;
        words.push({ type, text: tokens[words.length], clause_type: 'main', clause_id: clause,
            conjugation: { pronoun: finite || kind === 'S' ? p : 'none' } });
    }
    if (words.length !== tokens.length) throw new Error(`tags don't match: ${text}`);
    return words;
}

const lesson = (text, tags) => felderLesson(tagged(text, tags));
const kind = (text, tags) => { const l = lesson(text, tags); return l ? l.kind : null; };

export function runFelderLessonTests({ update = false } = {}) {
    // null: plain S–V–O, yes/no questions, imperatives, leading interjection
    test('felderLesson: "Ja, ich bin neu." → null (interjection skipped)', () =>
        assertEqual(lesson('Ja, ich bin neu.', 'X S.ich V.ich X'), null));
    test('felderLesson: plain subject–verb–object → null', () =>
        assertEqual(lesson('Ich brauche einen Tisch.', 'S.ich V.ich O.m.akk O.m.akk'), null));
    test('felderLesson: multi-word subject (with und) → null', () =>
        assertEqual(lesson('Lea und Max sind nett.', 'S.pl K S.pl V.sie_pl X'), null));
    test('felderLesson: yes/no question → null', () =>
        assertEqual(lesson('Bist du schon da?', 'V.du S.du X X'), null));
    test('felderLesson: imperative without particle → null', () =>
        assertEqual(lesson('Trink viel Tee!', 'V X O.m.akk'), null));
    test('felderLesson: leading "Aber" is not the Vorfeld → null', () =>
        assertEqual(lesson('Aber das Fenster ist groß.', 'K S.n S.n V.es X'), null));
    test('felderLesson: two main clauses with und → null', () =>
        assertEqual(kind('Der Park ist groß, und die Leute sind nett.',
            'S.m S.m V.er X K S.pl S.pl V.sie_pl X'), null));
    test('felderLesson: empty / missing words → null', () => {
        assertEqual(felderLesson([]), null);
        assertEqual(felderLesson(undefined), null);
    });

    // vorfeld
    test('felderLesson: "Hier wohne ich jetzt!" → vorfeld', () =>
        assertEqual(lesson('Hier wohne ich jetzt!', 'X V.ich S.ich X'), {
            kind: 'vorfeld', hint: 'Verb an Position 2. Vorne steht Hier.',
            parts: [{ text: 'Verb an Position 2. Vorne steht ', em: false }, { text: 'Hier', em: true },
                { text: '.', em: false }],
        }));
    test('felderLesson: object in front → vorfeld with the whole phrase', () =>
        assertEqual(lesson('Das Gebäude kenne ich!', 'O.n.akk O.n.akk V.ich S.ich').hint,
            'Verb an Position 2. Vorne steht Das Gebäude.'));
    test('felderLesson: interjection, then an object in front → vorfeld', () =>
        assertEqual(lesson('Nein, das dürfen Sie leider nicht.', 'X O.n.akk M.sie_pl S.Sie X X').hint,
            'Verb an Position 2. Vorne steht das.'));
    test('felderLesson: W-question → vorfeld (also with a W-subject)', () => {
        assertEqual(lesson('Woher kommst du genau?', 'X V.du S.du X').hint,
            'Verb an Position 2. Vorne steht Woher.');
        assertEqual(kind('Wer ist der Mann?', 'S.m V.er S.m S.m'), 'vorfeld');
    });

    // bracket
    test('felderLesson: "Ich will ein Konto eröffnen." → bracket', () =>
        assertEqual(lesson('Ich will ein Konto eröffnen.', 'S.ich M.ich O.n.akk O.n.akk V'), {
            kind: 'bracket', hint: 'Satzklammer: will … eröffnen',
            parts: [{ text: 'Satzklammer: ', em: false }, { text: 'will', em: true },
                { text: ' … ', em: false }, { text: 'eröffnen', em: true }],
        }));
    test('felderLesson: "Lea und Max schauen zu." → bracket (separable particle)', () =>
        assertEqual(lesson('Lea und Max schauen zu.', 'S.pl K S.pl V.sie_pl P').hint,
            'Satzklammer: schauen … zu'));
    test('felderLesson: bracket wins over vorfeld', () =>
        assertEqual(lesson('Heute muss Ayisha viel erledigen.', 'X M.sie S.f X V').hint,
            'Satzklammer: muss … erledigen'));
    test('felderLesson: Perfekt and yes/no question with a bracket', () => {
        assertEqual(lesson('Wir haben einen Ausflug gemacht.', 'S.wir V.wir O.m.akk O.m.akk V').hint,
            'Satzklammer: haben … gemacht');
        assertEqual(lesson('Kommst du am Sonntag mit?', 'V.du S.du P O.m.dat P').hint,
            'Satzklammer: Kommst … mit');
    });
    test('felderLesson: particle in the second main clause, nearest finite verb', () =>
        assertEqual(lesson('Spielst du Cricket, oder schaust du nur zu?',
            'V.du S.du O.n.akk K V.du S.du X P').hint, 'Satzklammer: schaust … zu'));
    test('felderLesson: preposition before its noun is no particle', () =>
        assertEqual(lesson('Ich komme aus Indien.', 'S.ich V.ich P O.n.dat'), null));
    test('felderLesson: separable imperative → bracket', () =>
        assertEqual(lesson('Ruf Dr. Kühn an!', 'V O.m.akk O.m.akk P').hint, 'Satzklammer: Ruf … an'));

    // subordinate
    test('felderLesson: subordinating conjunction → subordinate', () =>
        assertEqual(lesson('Ich bleibe zu Hause, weil ich krank bin.',
            'S.ich V.ich P O.n.dat / C S.ich X V.ich'),
        { kind: 'subordinate', hint: 'Nebensatz: das Verb steht am Ende.',
            parts: [{ text: 'Nebensatz: das Verb steht am Ende.', em: false }] }));
    test('felderLesson: clause_type subordinate → subordinate', () => {
        const words = tagged('Er sagt, dass er müde ist.', 'S.er V.er X S.er X V.er');
        words.slice(2).forEach(w => { w.clause_type = 'subordinate'; });
        assertEqual(felderLesson(words).kind, 'subordinate');
    });

    runChapterShare(update);
}

/** Every A1 story chapter (data/library twins): kind per sentence + share per chapter. */
function buildShare() {
    const chapters = {};
    let flagged = 0, total = 0;
    for (const file of listDir('data/library').filter(n => /^A1_g\d+k\d+\.json$/.test(n))) {
        const data = JSON.parse(readText(`data/library/${file}`));
        const sentences = data.sentences.map(s => {
            const l = felderLesson(s.words);
            return `${l ? l.kind : '-'} | ${s.text}${l ? ` | ${l.hint}` : ''}`;
        });
        const n = sentences.filter(s => !s.startsWith('-')).length;
        flagged += n;
        total += sentences.length;
        chapters[file] = { share: `${n}/${sentences.length} = ${Math.round(100 * n / sentences.length)} %`, sentences };
    }
    return { total: `${flagged}/${total} = ${Math.round(100 * flagged / total)} %`, flagged, count: total, chapters };
}

function runChapterShare(update) {
    const current = buildShare();
    test('felderLesson: A1 chapters exist', () => assert(current.count > 200, `only ${current.count} sentences`));
    // The plan expected ~30–45 % before counting; the real share is ~27 % (two chapters, 2.1 and
    // 2.2, are all plain S–V–O). Guard against a rule that flags almost nothing or almost everything.
    test('felderLesson: share of A1 chapter sentences with a lesson is 20–50 %', () => {
        const share = current.flagged / current.count;
        assert(share >= 0.2 && share <= 0.5, `share ${current.total}`);
    });
    if (update) {
        writeText(SNAPSHOT, JSON.stringify(current, null, 1) + '\n');
        print(`Snapshot updated: felder lessons ${current.total} → ${SNAPSHOT}`);
        return;
    }
    let stored;
    try {
        stored = JSON.parse(readText(SNAPSHOT));
    } catch (e) {
        test('felder lesson snapshot exists', () => { throw new Error(`${SNAPSHOT} missing — run with --update`); });
        return;
    }
    test('felderLesson: A1 total share unchanged', () => assertEqual(current.total, stored.total));
    const keys = new Set([...Object.keys(stored.chapters), ...Object.keys(current.chapters)]);
    for (const key of keys) {
        test(`felder lessons: ${key}`, () => assertEqual(current.chapters[key], stored.chapters[key]));
    }
}
