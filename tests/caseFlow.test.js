// caseFlow: the Anamnese data file (sections and standard questions), the case files and the
// pure interview logic (js/caseFlow.js)

import { test, assert, assertEqual } from './assert.js';
import { readText, listDir } from './stubs.js';
import { ANAMNESE_VERSION } from '../js/klinik.js';
import { CASES_INDEX_VERSION, BRIEF_SECTIONS, interviewSteps, formState, interviewScore, germanStrings } from '../js/caseFlow.js';

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

    test('anamnese.json: 6 to 8 questions per section', () => {
        for (const s of data.sections) {
            assert(s.questions.length >= 6 && s.questions.length <= 8, `${s.id}: ${s.questions.length} questions`);
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
    patient: { name: 'Frau Test', age: 30, job: 'Lehrerin', en: 'Ms Test, 30, teacher' },
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

    const bauch = JSON.parse(readText('data/medical/faelle/bauchschmerzen.json'));
    test('faelle/bauchschmerzen: all seven sections, 10–14 steps, 10–12 letter sentences, documentation per section', () => {
        assertEqual(new Set(bauch.interview.map(s => s.section)).size, 7);
        // 10–12 in the brief; up to 14 by controller ruling (period, bowel and urine questions)
        assert(bauch.interview.length >= 10 && bauch.interview.length <= 14, `${bauch.interview.length} steps`);
        for (const q of ['g-periode', 'g-stuhlgang', 'g-wasserlassen']) assert(bauch.interview.some(s => s.question === q), q);
        assert(bauch.brief.length >= 10 && bauch.brief.length <= 12, `${bauch.brief.length} sentences`);
        assertEqual(new Set(bauch.brief.map(b => b.section)).size, 5);
        assertEqual(bauch.dokumentation.map(d => d.section), anamnese.sections.map(s => s.id));
        assertEqual(bauch.level, 'B1');
        assertEqual(bauch.patient.age, 24);
    });
}
