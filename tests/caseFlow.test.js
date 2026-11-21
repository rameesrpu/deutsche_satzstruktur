// caseFlow: the Anamnese data file (sections and standard questions), the case files and the
// pure interview logic and the FSP practice run (js/caseFlow.js)

import { test, assert, assertEqual } from './assert.js';
import { readText, listDir, makeLocalStorage } from './stubs.js';
import { ANAMNESE_VERSION } from '../js/klinik.js';
import { CASES_INDEX_VERSION, BRIEF_SECTIONS, briefSortModel, briefHint, letterSections, interviewSteps, formState, interviewScore, germanStrings,
    EXAM_PARTS, RATINGS, examState, examSummary, examSections, draftKey, loadDraft, saveDraft, clearDraft } from '../js/caseFlow.js';

const SECTIONS = [
    ['beschwerden', 'Aktuelle Beschwerden'], ['vorerkrankungen', 'Vorerkrankungen und Operationen'],
    ['medikamente', 'Medikamente'], ['allergien', 'Allergien'], ['vegetativ', 'Vegetative Anamnese'],
    ['familie', 'Familienanamnese'], ['sozial', 'Sozialanamnese'],
];

export function runCaseFlowTests() {
    const data = JSON.parse(readText('data/medical/anamnese.json'));

    test('anamnese.json: version mirrored by ANAMNESE_VERSION', () => {
        assertEqual(data.version, ANAMNESE_VERSION);
    });

    test('anamnese.json: seven sections in interview order', () => {
        assertEqual(data.sections.map(s => [s.id, s.title]), SECTIONS);
        for (const s of data.sections) assert(typeof s.en === 'string' && s.en.trim() !== '', `${s.id}: en`);
    });

    // 6–8 per section; Aktuelle Beschwerden up to 10 (Task 5: Belastung/Ruhe and the cause of a fall)
    test('anamnese.json: 6 to 8 questions per section (Aktuelle Beschwerden up to 10)', () => {
        for (const s of data.sections) {
            const max = s.id === 'beschwerden' ? 10 : 8;
            assert(s.questions.length >= 6 && s.questions.length <= max, `${s.id}: ${s.questions.length} questions`);
        }
    });

    test('anamnese.json: question ids unique, de ends with ?, en non-empty, also ids are other sections', () => {
        const ids = new Set();
        const sectionIds = data.sections.map(s => s.id);
        for (const s of data.sections) {
            for (const q of s.questions) {
                assert(!ids.has(q.id), `duplicate id ${q.id}`);
                ids.add(q.id);
                assert(typeof q.de === 'string' && q.de.trim().endsWith('?'), `${q.id}: de ends with ?`);
                assert(typeof q.en === 'string' && q.en.trim() !== '', `${q.id}: en`);
                for (const a of q.also || []) {
                    assert(sectionIds.includes(a) && a !== s.id, `${q.id}: also ${a}`);
                }
            }
        }
    });

    test('anamnese.json: the standard Sozialanamnese question about alcohol is there', () => {
        const sozial = data.sections.find(s => s.id === 'sozial');
        assert(sozial.questions.some(q => q.de === 'Trinken Sie Alkohol?'));
    });

    runCaseTests(data);
}

// A small case without Familienanamnese (review focus 2)
const SMALL_CASE = {
    id: 'test', title: 'Test', level: 'B1', version: 1,
    patient: { name: 'Frau Test', age: 30, job: 'Lehrerin', gender: 'f', en: 'Ms Test, 30, teacher' },
    interview: [
        { section: 'beschwerden', question: 'b-grund', wrong: ['s-rauchen', 'a-allergien'],
            answer: { de: 'Mir tut der Bauch weh.', en: 'My stomach hurts.' },
            fact: { de: 'Bauchschmerzen', en: 'abdominal pain' },
            distractors: [{ de: 'Kopfschmerzen', en: 'headache' }, { de: 'Rückenschmerzen', en: 'back pain' }] },
        { section: 'beschwerden', question: 'b-seit', wrong: ['f-eltern', 'm-pille'],
            answer: { de: 'Seit gestern.', en: 'Since yesterday.' },
            fact: { de: 'seit gestern', en: 'since yesterday' },
            distractors: [{ de: 'seit einer Woche', en: 'for a week' }, { de: 'seit Jahren', en: 'for years' }] },
        { section: 'allergien', question: 'a-allergien', wrong: ['b-wo', 'g-schlaf'],
            answer: { de: 'Nein, keine.', en: 'No, none.' },
            fact: { de: 'keine Allergien bekannt', en: 'no known allergies' },
            distractors: [{ de: 'Penicillinallergie', en: 'penicillin allergy' }, { de: 'Heuschnupfen', en: 'hay fever' }] },
    ],
    brief: [{ section: 'diagnosen', de: 'Verdacht auf X', en: 'Suspected X' }],
    dokumentation: [{ section: 'beschwerden', model: 'Seit gestern Bauchschmerzen.', en: 'Abdominal pain since yesterday.' }],
    vorstellung: { skeleton: 'Ich stelle Ihnen … vor.', skeletonEn: 'I am presenting …', model: 'Ich stelle Ihnen Frau Test vor.', modelEn: 'I am presenting Ms Test.' },
};

function runCaseTests(anamnese) {
    const rng0 = () => 0;

    test('interviewSteps: one step per interview entry, three options including answerId', () => {
        const steps = interviewSteps(SMALL_CASE, anamnese, rng0);
        assertEqual(steps.length, 3);
        assertEqual(steps.map(s => s.answerId), ['b-grund', 'b-seit', 'a-allergien']);
        assertEqual(steps[0].section, { id: 'beschwerden', title: 'Aktuelle Beschwerden' });
        for (const s of steps) {
            assertEqual(s.options.length, 3);
            assert(s.options.some(o => o.id === s.answerId), 'answer among options');
            assertEqual(new Set(s.options.map(o => o.id)).size, 3);
            for (const o of s.options) assert(o.de.endsWith('?') && o.en, `${o.id}: de/en`);
            assertEqual(s.factOptions.length, 3);
            assertEqual(s.factOptions.filter(f => f.right).length, 1);
        }
        assertEqual(steps[0].answer.de, 'Mir tut der Bauch weh.');
        assertEqual(steps[0].factOptions.find(f => f.right).de, 'Bauchschmerzen');
    });

    test('interviewSteps: the order of options follows the rng', () => {
        const a = interviewSteps(SMALL_CASE, anamnese, rng0)[0].options.map(o => o.id);
        const b = interviewSteps(SMALL_CASE, anamnese, () => 0.99)[0].options.map(o => o.id);
        assertEqual([...a].sort(), [...b].sort());
        assert(a.join() !== b.join(), 'different rng, different order');
    });

    test('interviewSteps / formState: a case without familie has no step for it, the box is empty', () => {
        const steps = interviewSteps(SMALL_CASE, anamnese, rng0);
        assert(!steps.some(s => s.section.id === 'familie'));
        const form = formState(SMALL_CASE, anamnese, 0);
        assertEqual(form.map(f => f.id), anamnese.sections.map(s => s.id));
        const fam = form.find(f => f.id === 'familie');
        assertEqual(fam.empty, true);
        assertEqual(fam.notes, []);
        assertEqual(form.find(f => f.id === 'beschwerden').empty, false);
        assertEqual(form.find(f => f.id === 'beschwerden').title, 'Aktuelle Beschwerden');
    });

    test('formState: after two done steps two notes in the right sections', () => {
        const form = formState(SMALL_CASE, anamnese, 2);
        assertEqual(form.find(f => f.id === 'beschwerden').notes, ['Bauchschmerzen', 'seit gestern']);
        assertEqual(form.find(f => f.id === 'allergien').notes, []);
        assertEqual(formState(SMALL_CASE, anamnese, 3).find(f => f.id === 'allergien').notes, ['keine Allergien bekannt']);
    });

    test('interviewScore counts first-try results', () => {
        assertEqual(interviewScore([]), { questions: 0, facts: 0, total: 0 });
        assertEqual(interviewScore([{ question: true, fact: false }, { question: true, fact: true }, { question: false, fact: true }]),
            { questions: 2, facts: 2, total: 3 });
    });

    test('germanStrings: every German string of a case with its English', () => {
        const pairs = germanStrings(SMALL_CASE);
        assert(pairs.some(p => p.de === 'Ich stelle Ihnen Frau Test vor.' && p.en === 'I am presenting Ms Test.'));
        assert(pairs.some(p => p.de === 'Seit gestern Bauchschmerzen.' && p.en));
        assert(pairs.some(p => p.de === 'Heuschnupfen' && p.en === 'hay fever'));
        assertEqual(germanStrings({ ...SMALL_CASE, brief: [{ section: 'befund', de: 'X', en: '' }] })
            .find(p => p.de === 'X').en, '');
    });

    // --- the case files ---
    const index = JSON.parse(readText('data/medical/faelle/index.json'));
    const questionSection = new Map();
    for (const s of anamnese.sections) for (const q of s.questions) questionSection.set(q.id, [s.id, ...(q.also || [])]);

    test('faelle/index.json: version mirrored by CASES_INDEX_VERSION; lists every case file once', () => {
        assertEqual(index.version, CASES_INDEX_VERSION);
        const files = listDir('data/medical/faelle').filter(f => f.endsWith('.json') && f !== 'index.json').map(f => f.replace(/\.json$/, ''));
        assertEqual(index.cases.map(c => c.id).sort(), files.sort());
        assert(index.cases.length >= 1);
    });

    for (const entry of index.cases) {
        const c = JSON.parse(readText(`data/medical/faelle/${entry.id}.json`));
        test(`faelle/${entry.id}: id, title, level and version match index.json`, () => {
            assertEqual([c.id, c.title, c.level, c.version], [entry.id, entry.title, entry.level, entry.version]);
            assert(typeof c.patient.name === 'string' && c.patient.age > 0 && c.patient.job && c.patient.en, 'patient');
            assert(['f', 'm'].includes(c.patient.gender), 'patient.gender is f or m');
        });
        test(`faelle/${entry.id}: question ids exist and each question belongs to its section`, () => {
            const sectionIds = anamnese.sections.map(s => s.id);
            for (const step of c.interview) {
                assert(sectionIds.includes(step.section), `section ${step.section}`);
                assert(questionSection.has(step.question), `question ${step.question}`);
                assert(questionSection.get(step.question).includes(step.section), `${step.question} belongs to ${step.section}`);
                assertEqual(step.wrong.length, 2);
                for (const w of step.wrong) {
                    assert(questionSection.has(w), `wrong ${w}`);
                    assert(w !== step.question, `wrong ${w} is the question`);
                    // a wrong question really is wrong: not one of the step's section (directly or via `also`)
                    assert(!questionSection.get(w).includes(step.section), `wrong ${w} belongs to ${step.section}`);
                }
                assertEqual(step.distractors.length, 2);
            }
        });
        test(`faelle/${entry.id}: brief sections are among the five, dokumentation sections are Anamnese sections`, () => {
            for (const b of c.brief) assert(BRIEF_SECTIONS.some(s => s.id === b.section), `brief section ${b.section}`);
            const sectionIds = anamnese.sections.map(s => s.id);
            for (const d of c.dokumentation) assert(sectionIds.includes(d.section), `dokumentation ${d.section}`);
            assert(c.vorstellung.skeleton && c.vorstellung.model, 'vorstellung');
        });
        test(`faelle/${entry.id}: every German string has an en`, () => {
            const pairs = germanStrings(c);
            assert(pairs.length > 20, `${pairs.length} strings`);
            for (const p of pairs) assert(typeof p.en === 'string' && p.en.trim() !== '', `no en for "${p.de}"`);
        });
    }

    test('briefSortModel: one chip per sentence (id = index), five zones, title', () => {
        const c = { ...SMALL_CASE, title: 'X', brief: [
            { section: 'diagnosen', de: 'A', en: 'a' }, { section: 'befund', de: 'B', en: 'b' }] };
        const m = briefSortModel(c);
        assertEqual(m.title, 'Arztbrief: X');
        assertEqual(m.zones.map(z => z.id), BRIEF_SECTIONS.map(z => z.id));
        assertEqual(m.chips, [{ id: '0', text: 'A', en: 'a', zones: ['diagnosen'] },
            { id: '1', text: 'B', en: 'b', zones: ['befund'] }]);
    });

    test('briefHint: fixed hint by the chip\'s right section', () => {
        const hints = { diagnosen: 'Eine Diagnose steht ganz oben.', anamnese: 'Das hat die Patientin erzählt: Anamnese.',
            befund: 'Das hat die Ärztin festgestellt: Befund.', therapie: 'Das wurde gemacht: Therapie und Verlauf.',
            empfehlung: 'Das soll danach passieren: Empfehlung.' };
        for (const [id, text] of Object.entries(hints)) assertEqual(briefHint({ zones: [id] }, 'befund'), text);
        assertEqual(briefHint({ zones: ['anamnese'] }, 'befund', 'f'), 'Das hat die Patientin erzählt: Anamnese.');
        assertEqual(briefHint({ zones: ['anamnese'] }, 'befund', 'm'), 'Das hat der Patient erzählt: Anamnese.');
    });

    test('letterSections: five headings, sentences in the file\'s order, empty sections left out', () => {
        const c = { ...SMALL_CASE, brief: [{ section: 'befund', de: 'B', en: 'b' }, { section: 'diagnosen', de: 'A', en: 'a' },
            { section: 'befund', de: 'C', en: 'c' }] };
        assertEqual(letterSections(c), [{ id: 'diagnosen', title: 'Diagnosen', sentences: ['A'] },
            { id: 'befund', title: 'Befund', sentences: ['B', 'C'] }]);
    });

    const bauch = JSON.parse(readText('data/medical/faelle/bauchschmerzen.json'));
    test('faelle/bauchschmerzen: all seven sections, 10–14 steps, 10–13 letter sentences, documentation per section', () => {
        assertEqual(new Set(bauch.interview.map(s => s.section)).size, 7);
        // 10–13 in the brief (the period sentence is Anamnese); up to 14 by controller ruling (period, bowel and urine questions)
        assert(bauch.interview.length >= 10 && bauch.interview.length <= 14, `${bauch.interview.length} steps`);
        for (const q of ['g-periode', 'g-stuhlgang', 'g-wasserlassen']) assert(bauch.interview.some(s => s.question === q), q);
        assert(bauch.brief.length >= 10 && bauch.brief.length <= 13, `${bauch.brief.length} sentences`);
        assertEqual(new Set(bauch.brief.map(b => b.section)).size, 5);
        assertEqual(bauch.dokumentation.map(d => d.section), anamnese.sections.map(s => s.id));
        assertEqual(bauch.level, 'B1');
        assertEqual(bauch.patient.age, 24);
    });

    for (const [id, level, age] of [['brustschmerzen', 'B2', 58], ['handgelenk', 'B1', 67]]) {
        const c = JSON.parse(readText(`data/medical/faelle/${id}.json`));
        test(`faelle/${id}: level ${level}, age ${age}, 10–14 steps, 10–13 letter sentences in all five sections`, () => {
            assertEqual([c.level, c.patient.age], [level, age]);
            assert(c.interview.length >= 10 && c.interview.length <= 14, `${c.interview.length} steps`);
            assert(c.brief.length >= 10 && c.brief.length <= 13, `${c.brief.length} sentences`);
            assertEqual(new Set(c.brief.map(b => b.section)).size, 5);
            // documentation: one model per section the interview covers, in Anamnese order
            const covered = anamnese.sections.map(s => s.id).filter(s => c.interview.some(e => e.section === s));
            assertEqual(c.dokumentation.map(d => d.section), covered);
        });
    }
    const brust = JSON.parse(readText('data/medical/faelle/brustschmerzen.json'));
    const hand = JSON.parse(readText('data/medical/faelle/handgelenk.json'));
    test('faelle/brustschmerzen: the red-flag questions (Ausstrahlung, Belastung/Ruhe, Begleitsymptome, Herzinfarkt in der Familie, Rauchen)', () => {
        for (const q of ['b-ausstrahlung', 'b-belastung', 'b-begleit', 'f-herz', 's-rauchen', 's-alkohol']) {
            assert(brust.interview.some(s => s.question === q), q);
        }
    });
    test('faelle/handgelenk: why she fell, blood thinners, osteoporosis; no Vegetative Anamnese', () => {
        for (const q of ['b-sturz', 'm-blutverduenner', 'v-osteoporose', 's-alkohol']) {
            assert(hand.interview.some(s => s.question === q), q);
        }
        assert(!hand.interview.some(s => s.section === 'vegetativ'));
        assert(formState(hand, anamnese, hand.interview.length).find(f => f.id === 'vegetativ').empty);
    });

    runExamTests(anamnese);
}

function runExamTests(anamnese) {
    const MIN = 60000;
    test('EXAM_PARTS: the three parts of the Fachsprachprüfung, 20 minutes each', () => {
        assertEqual(EXAM_PARTS, [
            { id: 'gespraech', title: 'Arzt-Patienten-Gespräch', minutes: 20 },
            { id: 'dokumentation', title: 'Dokumentation', minutes: 20 },
            { id: 'vorstellung', title: 'Arzt-Arzt-Gespräch', minutes: 20 },
        ]);
        assertEqual(RATINGS, ['Passt', 'Teilweise', 'Noch nicht']);
    });

    test('examState: no draft → part 0 with the full 20 minutes, no texts', () => {
        const s = examState(null, 1000);
        assertEqual([s.part, s.remainingMs, s.texts], [0, 20 * MIN, {}]);
        assertEqual(s.startedAt, 1000);
    });

    test('examState: a draft with 5 minutes elapsed → 15 minutes left and the saved texts', () => {
        const draft = { part: 1, startedAt: 500, elapsedMs: 5 * MIN, texts: { beschwerden: 'Seit gestern Bauchschmerzen.' } };
        const s = examState(draft, 10 * 3600000); // time away does not count
        assertEqual([s.part, s.remainingMs, s.startedAt], [1, 15 * MIN, 500]);
        assertEqual(s.texts, { beschwerden: 'Seit gestern Bauchschmerzen.' });
    });

    test('examState: running out goes below zero (the clock only turns red), bad drafts start over', () => {
        assertEqual(examState({ part: 2, startedAt: 1, elapsedMs: 25 * MIN, texts: {} }, 2).remainingMs, -5 * MIN);
        for (const bad of [{}, { part: 7 }, { part: 'x', elapsedMs: -3, texts: 'no' }, 'oops']) {
            const s = examState(bad, 9);
            assertEqual([s.part, s.remainingMs, s.texts], [0, 20 * MIN, {}]);
        }
        const s = examState({ part: 1, startedAt: 1, elapsedMs: 0, texts: { a: 'x', b: 3 }, ratings: [0, 'x', 2], score: { questions: 1, facts: 2, total: 3 } }, 2);
        assertEqual(s.texts, { a: 'x' });
        assertEqual(s.ratings, [0, null, 2]);
        assertEqual(s.score, { questions: 1, facts: 2, total: 3 });
        assertEqual(examState({ part: 3, startedAt: 1, elapsedMs: 0, texts: {} }, 2).part, 3); // the summary
    });

    test('draft: leave in part 2 and return → same part, texts and time left', () => {
        const storage = makeLocalStorage();
        assertEqual(draftKey('bauchschmerzen'), 'fspDraft/bauchschmerzen');
        assertEqual(loadDraft(storage, 'bauchschmerzen'), null);
        saveDraft(storage, 'bauchschmerzen', { part: 1, startedAt: 100, elapsedMs: 7 * MIN, texts: { sozial: 'Studentin.' } });
        const back = examState(loadDraft(storage, 'bauchschmerzen'), 99999999);
        assertEqual([back.part, back.remainingMs, back.texts], [1, 13 * MIN, { sozial: 'Studentin.' }]);
        clearDraft(storage, 'bauchschmerzen');
        assertEqual(loadDraft(storage, 'bauchschmerzen'), null);
        storage.setItem('fspDraft/x', '{broken');
        assertEqual(loadDraft(storage, 'x'), null);
        const throwing = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); }, removeItem() { throw new Error('blocked'); } };
        assertEqual(loadDraft(throwing, 'x'), null);
        saveDraft(throwing, 'x', {}); // no throw
        clearDraft(throwing, 'x');
    });

    test('examSummary: three lines, one per part', () => {
        const { lines } = examSummary({ questions: 11, facts: 12, total: 13 }, [0, 0, 1, 2, 0, null, 1], 1);
        assertEqual(lines, [
            'Arzt-Patienten-Gespräch: 11 von 13 Fragen, 12 von 13 Notizen beim ersten Versuch',
            'Dokumentation: 3 × Passt, 2 × Teilweise, 1 × Noch nicht',
            'Arzt-Arzt-Gespräch: Teilweise',
        ]);
        assertEqual(examSummary(null, [], null).lines.length, 3);
    });

    test('examSections: the Anamnese sections that have a model text, in Anamnese order', () => {
        const c = { dokumentation: [{ section: 'sozial', model: 'S', en: 's' }, { section: 'beschwerden', model: 'B', en: 'b' }] };
        assertEqual(examSections(c, anamnese), [
            { id: 'beschwerden', title: 'Aktuelle Beschwerden', model: 'B', en: 'b' },
            { id: 'sozial', title: 'Sozialanamnese', model: 'S', en: 's' },
        ]);
    });
}
