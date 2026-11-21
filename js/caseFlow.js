// Klinik cases (data/medical/faelle/<id>.json, listed in index.json): pure logic of the Anamnese
// interview ("Gespräch", caseScreen.js). Shapes: Case in js/types.js. Questions are ids of
// data/medical/anamnese.json; a case covers some or all of its seven sections.

export const CASES_DIR = 'data/medical/faelle';
export const CASES_INDEX_FILE = `${CASES_DIR}/index.json`;
export const CASES_INDEX_VERSION = 1; // mirrors index.json's `version`; part of the URL as ?v=

/** URL of a case file; `version` comes from its index.json entry (mirrors the file). */
export const caseUrl = entry => `${CASES_DIR}/${entry.id}.json?v=${entry.version}`;

/** The five parts of an Arztbrief (the case's `brief[].section`). */
export const BRIEF_SECTIONS = [
    { id: 'diagnosen', title: 'Diagnosen' },
    { id: 'anamnese', title: 'Anamnese' },
    { id: 'befund', title: 'Befund' },
    { id: 'therapie', title: 'Therapie und Verlauf' },
    { id: 'empfehlung', title: 'Empfehlung' },
];

/**
 * "Arztbrief sortieren": one chip per brief sentence (id = its index in the file), the five sections as zones.
 * @param {import('./types.js').Case} caseData
 * @returns {import('./sortExercise.js').SortModel}
 */
export function briefSortModel(caseData) {
    return {
        title: `Arztbrief: ${caseData.title}`,
        zones: BRIEF_SECTIONS.map(z => ({ id: z.id, title: z.title })),
        chips: caseData.brief.map((b, i) => ({ id: String(i), text: b.de, en: b.en, zones: [b.section] })),
    };
}

const BRIEF_HINTS = {
    diagnosen: 'Eine Diagnose steht ganz oben.',
    anamnese: 'Das hat die Patientin erzählt: Anamnese.',
    befund: 'Das hat die Ärztin festgestellt: Befund.',
    therapie: 'Das wurde gemacht: Therapie und Verlauf.',
    empfehlung: 'Das soll danach passieren: Empfehlung.',
};

/** Hint after a wrong drop: fixed text by the chip's right section (its first zone). */
export const briefHint = (chip, zoneId) => BRIEF_HINTS[chip.zones[0]] || '';

/** The finished letter: the sections that have sentences, each with its sentences in the file's order. */
export function letterSections(caseData) {
    return BRIEF_SECTIONS
        .map(z => ({ id: z.id, title: z.title, sentences: caseData.brief.filter(b => b.section === z.id).map(b => b.de) }))
        .filter(z => z.sentences.length > 0);
}

/** Patient card line: "Lena Hoffmann, 24 Jahre, Studentin". */
export const patientLine = p => `${p.name}, ${p.age} Jahre, ${p.job}`;

function shuffled(list, rng) {
    const a = [...list];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

/**
 * The interview as steps, in the case's order. Each step: the section, three question options (the
 * right one and the two `wrong` ones, order by rng), the answer, and three note options (the fact and
 * the two distractors). Sections the case does not cover produce no step; unknown ids are skipped.
 * @param {import('./types.js').Case} caseData
 * @param {{sections: {id: string, title: string, questions: {id: string, de: string, en: string}[]}[]}} anamnese
 * @param {() => number} [rng]
 */
export function interviewSteps(caseData, anamnese, rng = Math.random) {
    const questions = new Map();
    for (const s of anamnese.sections) for (const q of s.questions) questions.set(q.id, q);
    const steps = [];
    for (const entry of caseData.interview) {
        const section = anamnese.sections.find(s => s.id === entry.section);
        const ids = [entry.question, ...entry.wrong];
        if (!section || !ids.every(id => questions.has(id))) continue;
        steps.push({
            section: { id: section.id, title: section.title },
            options: shuffled(ids.map(id => ({ id, de: questions.get(id).de, en: questions.get(id).en })), rng),
            answerId: entry.question,
            answer: entry.answer,
            factOptions: shuffled([
                { de: entry.fact.de, en: entry.fact.en, right: true },
                ...entry.distractors.map(d => ({ de: d.de, en: d.en, right: false })),
            ], rng),
        });
    }
    return steps;
}

/**
 * The Anamnesebogen after `doneSteps` steps: all seven sections in order, each with the notes taken
 * so far (with their English in `notesEn`); `empty` = the case has no step in that section.
 */
export function formState(caseData, anamnese, doneSteps) {
    const known = new Set(anamnese.sections.map(s => s.id));
    const entries = caseData.interview.filter(e => known.has(e.section));
    return anamnese.sections.map(s => {
        const own = entries.map((e, i) => ({ e, i })).filter(x => x.e.section === s.id);
        const done = own.filter(x => x.i < doneSteps);
        return {
            id: s.id, title: s.title,
            notes: done.map(x => x.e.fact.de), notesEn: done.map(x => x.e.fact.en),
            empty: own.length === 0,
        };
    });
}

/** First-try counts: `question` = right question at the first tap, `fact` = right note at the first tap. */
export function interviewScore(results) {
    return {
        questions: results.filter(r => r.question).length,
        facts: results.filter(r => r.fact).length,
        total: results.length,
    };
}

/** End line of the interview. */
export const scoreLine = s => `${s.questions} von ${s.total} Fragen, ${s.facts} von ${s.total} Notizen beim ersten Versuch`;

/** Every German string of a case with its English (the data test checks each `en`). */
export function germanStrings(c) {
    const v = c.vorstellung || {};
    return [
        { de: patientLine(c.patient), en: c.patient.en },
        ...c.interview.flatMap(s => [s.answer, s.fact, ...s.distractors]),
        ...c.brief,
        ...c.dokumentation.map(d => ({ de: d.model, en: d.en })),
        { de: v.skeleton, en: v.skeletonEn },
        { de: v.model, en: v.modelEn },
    ].map(p => ({ de: p.de, en: p.en }));
}
