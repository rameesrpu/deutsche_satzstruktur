// Klinik cases (data/medical/faelle/<id>.json, listed in index.json): pure logic of the Anamnese
// interview ("Gespräch", caseScreen.js). Shapes: Case in js/types.js. Questions are ids of
// data/medical/anamnese.json; a case covers some or all of its seven sections.

export const CASES_DIR = 'data/medical/faelle';
export const CASES_INDEX_FILE = `${CASES_DIR}/index.json`;
export const CASES_INDEX_VERSION = 2; // mirrors index.json's `version`; part of the URL as ?v=

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

// --- Fachsprachenprüfung practice run (renderExam in caseScreen.js) ---
// Format verified in docs/medical-sources.md ("Fachsprachprüfung format", LÄK BW): three parts of
// about twenty minutes each.

export const EXAM_PARTS = [
    { id: 'gespraech', title: 'Arzt-Patienten-Gespräch', minutes: 20 },
    { id: 'dokumentation', title: 'Dokumentation', minutes: 20 },
    { id: 'vorstellung', title: 'Arzt-Arzt-Gespräch', minutes: 20 },
];

/** Self-rating after a model text (index = the stored value). */
export const RATINGS = ['Passt', 'Teilweise', 'Noch nicht'];

/** localStorage key of a run in progress. */
export const draftKey = caseId => `fspDraft/${caseId}`;

const isObj = v => !!v && typeof v === 'object' && !Array.isArray(v);
const isRating = v => Number.isInteger(v) && v >= 0 && v < RATINGS.length;

/**
 * Where a run stands. `draft` = the stored `fspDraft/<caseId>`: {part, startedAt, elapsedMs, texts}
 * plus what the run collected so far (score of part 1, `ratings` of part 2, `compared`, `presented`,
 * `talkRating` of part 3). `elapsedMs` is the time spent in the current part; it is saved on leaving,
 * so time away does not count. part 3 = the summary. A missing or broken draft starts over at part 0.
 * `remainingMs` can go below zero: running out only turns the clock red.
 * @param {?Object} draft
 * @param {number} now  start time of a new run
 */
export function examState(draft, now) {
    const ok = isObj(draft) && Number.isInteger(draft.part) && draft.part >= 0 && draft.part <= EXAM_PARTS.length;
    const d = ok ? draft : {};
    const part = ok ? d.part : 0;
    const elapsedMs = ok && Number.isFinite(d.elapsedMs) && d.elapsedMs > 0 ? d.elapsedMs : 0;
    const texts = {};
    if (isObj(d.texts)) for (const [k, v] of Object.entries(d.texts)) if (typeof v === 'string') texts[k] = v;
    const score = isObj(d.score) && ['questions', 'facts', 'total'].every(k => Number.isInteger(d.score[k])) ? d.score : null;
    return {
        part,
        startedAt: ok && Number.isFinite(d.startedAt) ? d.startedAt : now,
        elapsedMs,
        remainingMs: part < EXAM_PARTS.length ? EXAM_PARTS[part].minutes * 60000 - elapsedMs : 0,
        texts,
        score,
        ratings: Array.isArray(d.ratings) ? d.ratings.map(r => (isRating(r) ? r : null)) : [],
        compared: d.compared === true,
        presented: d.presented === true,
        talkRating: isRating(d.talkRating) ? d.talkRating : null,
    };
}

export function loadDraft(storage, caseId) {
    try {
        const v = JSON.parse(storage.getItem(draftKey(caseId)));
        return isObj(v) ? v : null;
    } catch (e) { return null; }
}

export function saveDraft(storage, caseId, draft) {
    try { storage.setItem(draftKey(caseId), JSON.stringify(draft)); } catch (e) { /* private mode */ }
}

export function clearDraft(storage, caseId) {
    try { storage.removeItem(draftKey(caseId)); } catch (e) { /* private mode */ }
}

/** Part 2: the Anamnesebogen sections that have a model text, in Anamnese order. */
export function examSections(caseData, anamnese) {
    return anamnese.sections
        .map(s => ({ s, d: caseData.dokumentation.find(x => x.section === s.id) }))
        .filter(x => x.d)
        .map(({ s, d }) => ({ id: s.id, title: s.title, model: d.model, en: d.en }));
}

/**
 * The end of the run: one line per part.
 * @param {?{questions: number, facts: number, total: number}} score  part 1 (first-try counts)
 * @param {(?number)[]} docRatings  part 2, a RATINGS index per section (null = not rated)
 * @param {?number} talkRating  part 3
 */
export function examSummary(score, docRatings, talkRating) {
    const counts = RATINGS.map((r, i) => `${docRatings.filter(x => x === i).length} × ${r}`).join(', ');
    return {
        lines: [
            `${EXAM_PARTS[0].title}: ${score ? scoreLine(score) : '–'}`,
            `${EXAM_PARTS[1].title}: ${counts}`,
            `${EXAM_PARTS[2].title}: ${isRating(talkRating) ? RATINGS[talkRating] : '–'}`,
        ],
    };
}
