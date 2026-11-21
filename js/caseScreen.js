/**
 * Case screen (body[data-screen="case"]): the Anamnese interview ("Gespräch", FSP part 1), and
 * renderExam, the Fachsprachenprüfung practice run (interview, Dokumentation, Arzt-Arzt-Gespräch).
 * Top: patient card. Middle: the Anamnesebogen, seven labelled boxes filling as she goes. Bottom
 * (sticky): per step the section and three questions; the right one is spoken, the patient's answer
 * appears as a bubble and is spoken; then three notes, the right one moves into its box.
 * Spoken prompts follow the "Aussprache" setting; the 🔊 buttons always speak. Without a German
 * voice everything still appears as text. Tapping a German sentence shows its English.
 * Logic in caseFlow.js; free of routing (the caller decides what onDone / onClose do).
 * The clock counts down from `minutes` minus `elapsedMs` and only while the screen is open; running
 * out turns it red, nothing is cut off.
 */

import { patientNoun, interviewSteps, formState, interviewScore, scoreLine, patientLine, EXAM_PARTS, RATINGS, examState, examSummary,
    examSections, loadDraft, saveDraft, clearDraft } from './caseFlow.js';
import { progressSegments } from './playScreen.js';
import { gameSounds } from './sound.js';

const CLOSE_ICON = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
    'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
const HINT_QUESTION = 'Diese Frage passt jetzt nicht.';
const HINT_NOTE = 'Das steht nicht in der Antwort.';
const NOTE_PROMPT = 'Was notieren Sie?';

const el = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
};

const clockText = ms => {
    const s = Math.max(0, Math.ceil(ms / 1000));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/**
 * A countdown that runs from creation until stop(). `elapsed()` = `elapsedMs` passed in plus the time
 * it ran; `draw()` writes the time left into `el` (red when it has run out).
 * @param {{minutes: number, elapsedMs?: number}} clock
 */
function countdown({ minutes, elapsedMs = 0 }) {
    let base = Number.isFinite(elapsedMs) && elapsedMs > 0 ? elapsedMs : 0;
    let since = Date.now();
    let running = true;
    const c = {
        el: el('span', 'case-clock'),
        elapsed: () => base + (running ? Date.now() - since : 0),
        stop() { if (running) { base = c.elapsed(); running = false; } c.draw(); },
        draw() {
            const left = minutes * 60000 - c.elapsed();
            c.el.textContent = clockText(left);
            c.el.classList.toggle('is-over', left <= 0);
        },
    };
    c.el.setAttribute('role', 'timer');
    c.el.setAttribute('aria-label', 'Restzeit');
    c.draw();
    return c;
}

/**
 * @param {HTMLElement} root
 * @param {{caseData: import('./types.js').Case, anamnese: Object, clock: ?{minutes: number, elapsedMs?: number},
 *   heading?: string, rng?: () => number}} opts  `heading`: a line above the patient card (the exam part)
 * @param {{onDone: (score: {questions: number, facts: number, total: number}, time: {elapsedMs: number}) => void,
 *   onClose: (time: {elapsedMs: number}) => void}} actions  `elapsedMs`: the clock's time so far (0 without a clock)
 * @returns {() => number} teardown: stops the clock, returns its elapsed ms
 */
export function renderInterview(root, { caseData, anamnese, clock = null, heading = '', rng = Math.random }, { onDone, onClose }) {
    const steps = interviewSteps(caseData, anamnese, rng);
    const results = [];
    let index = 0;
    let phase = steps.length ? 'ask' : 'end'; // 'ask' | 'note' | 'end'
    let tried = new Set(); // wrong options tapped in this phase (question ids or note texts)
    let firstTry = { question: true, fact: true };
    let hint = null;
    let newNote = null; // section id of the note just placed (highlight + scroll)
    let shake = null; // the wrong option just tapped
    const openEn = new Set(); // keys of sentences showing their English
    let finished = false;
    const stopSpeech = () => { try { gameSounds.cancelPrompt(); } catch (e) { /* no speech */ } };
    const finish = fn => (...args) => { if (!finished) { finished = true; stopSpeech(); const elapsedMs = teardown(); fn(...args, { elapsedMs }); } };
    const done = finish(onDone);
    const closeScreen = finish(onClose);
    const voice = () => gameSounds.hasGermanVoice();
    const say = (text, o) => { try { gameSounds.speak(text, o); } catch (e) { /* no speech: text only */ } };

    let timer = null;
    const clk = clock ? countdown(clock) : null;
    const clockEl = clk ? clk.el : null;
    function tick() {
        if (!clk) return;
        if (!inner.isConnected) { teardown(); return; } // the screen was replaced without close
        clk.draw();
    }
    function teardown() {
        if (timer) { clearInterval(timer); timer = null; }
        if (clk) clk.stop();
        return clk ? clk.elapsed() : 0;
    }

    const inner = el('div', 'case-inner');
    const feedback = el('div', 'play-feedback play-feedback-wrong');
    feedback.setAttribute('role', 'status');
    feedback.setAttribute('aria-live', 'polite');

    /** A German sentence that shows its English on tap. */
    function sentence(key, de, en, cls) {
        const wrap = el('div', `case-sentence ${cls || ''}`.trim());
        const b = el('button', 'case-de', de);
        b.type = 'button';
        b.setAttribute('aria-expanded', String(openEn.has(key)));
        b.addEventListener('click', e => {
            e.stopPropagation();
            if (openEn.has(key)) openEn.delete(key); else openEn.add(key);
            draw();
        });
        wrap.append(b);
        if (openEn.has(key) && en) wrap.append(el('div', 'case-en', en));
        return wrap;
    }

    function sayButton(text) {
        const b = el('button', 'case-say', '🔊');
        b.type = 'button';
        b.setAttribute('aria-label', 'Anhören');
        b.addEventListener('click', e => { e.stopPropagation(); say(text, { force: true }); });
        return b;
    }

    function bubble(key, who, de, en) {
        const row = el('div', `case-bubble case-bubble-${who}`);
        row.append(sentence(key, de, en));
        if (voice()) row.append(sayButton(de));
        return row;
    }

    function draw() {
        const bar = el('div', 'play-bar');
        const close = el('button', 'play-close');
        close.type = 'button';
        close.setAttribute('aria-label', 'Beenden');
        close.title = 'Beenden';
        close.innerHTML = CLOSE_ICON;
        close.addEventListener('click', () => closeScreen());
        const progress = el('div', 'play-progress');
        progress.setAttribute('role', 'progressbar');
        progress.setAttribute('aria-label', 'Fortschritt');
        for (const s of progressSegments(steps.length, Math.min(index, steps.length - 1), phase === 'end')) {
            progress.appendChild(el('span', `play-seg play-seg-${s}`));
        }
        bar.append(close, progress);
        if (clockEl) bar.append(clockEl);

        const patient = el('section', 'case-patient');
        patient.setAttribute('aria-label', patientNoun(caseData.patient.gender) === 'der Patient' ? 'Patient' : 'Patientin');
        patient.append(sentence('patient', patientLine(caseData.patient), caseData.patient.en, 'case-patient-line'));

        const form = el('section', 'case-form');
        form.setAttribute('aria-label', 'Anamnesebogen');
        form.append(el('h2', 'case-form-title', 'Anamnesebogen'));
        const boxes = el('div', 'case-boxes');
        let newBox = null;
        for (const box of formState(caseData, anamnese, index)) {
            const b = el('div', 'case-box');
            b.dataset.section = box.id;
            if (box.id === newNote) { b.classList.add('is-new'); newBox = b; }
            b.append(el('div', 'case-box-label', box.title));
            const list = el('div', 'case-box-notes');
            box.notes.forEach((n, i) => list.append(sentence(`note:${box.id}:${i}`, n, box.notesEn[i], 'case-note')));
            if (box.empty && phase === 'end') list.append(el('div', 'case-box-none', 'nicht erhoben'));
            b.append(list);
            boxes.append(b);
        }
        form.append(boxes);

        feedback.textContent = hint || '';
        feedback.hidden = !hint;

        const panel = el('section', 'case-step');
        if (phase === 'end') {
            panel.append(el('p', 'case-score', scoreLine(interviewScore(results))));
            const row = el('div', 'play-continue-row');
            const next = el('button', 'play-continue', 'Fertig');
            next.type = 'button';
            next.addEventListener('click', () => done(interviewScore(results)));
            row.append(next);
            panel.append(row);
        } else {
            const step = steps[index];
            panel.append(feedback);
            if (phase === 'ask') {
                panel.append(el('div', 'play-prompt', step.section.title));
                const opts = el('div', 'case-options');
                for (const o of step.options) {
                    const b = el('button', 'case-option', o.de);
                    b.type = 'button';
                    b.dataset.option = o.id;
                    if (tried.has(o.id)) { b.classList.add('is-wrong'); b.disabled = true; }
                    if (shake === o.id) b.classList.add('order-shake');
                    b.addEventListener('click', () => onQuestion(o.id));
                    opts.append(b);
                    if (tried.has(o.id)) opts.append(el('div', 'case-en case-option-en', o.en));
                }
                panel.append(opts);
            } else {
                const q = step.options.find(o => o.id === step.answerId);
                panel.append(bubble(`q:${index}`, 'doctor', q.de, q.en),
                    bubble(`a:${index}`, 'patient', step.answer.de, step.answer.en));
                panel.append(el('div', 'play-prompt', NOTE_PROMPT));
                const opts = el('div', 'case-options case-notes');
                for (const f of step.factOptions) {
                    const b = el('button', 'order-chip case-note-chip', f.de);
                    b.type = 'button';
                    if (tried.has(f.de)) { b.classList.add('is-wrong'); b.disabled = true; }
                    if (shake === f.de) b.classList.add('order-shake');
                    b.addEventListener('click', () => onNote(f));
                    opts.append(b);
                    if (tried.has(f.de)) opts.append(el('div', 'case-en case-option-en', f.en));
                }
                panel.append(opts);
            }
        }

        inner.replaceChildren(bar, ...(heading ? [el('p', 'exam-part', heading)] : []), patient, form, panel);
        if (root.firstChild !== inner) root.replaceChildren(inner);
        if (newBox && newBox.scrollIntoView) newBox.scrollIntoView({ block: 'nearest' });
        newNote = null;
        shake = null;
    }

    function onQuestion(id) {
        const step = steps[index];
        if (id !== step.answerId) {
            tried.add(id);
            shake = id;
            firstTry.question = false;
            hint = HINT_QUESTION;
            gameSounds.wrong();
            draw();
            return;
        }
        const q = step.options.find(o => o.id === id);
        phase = 'note';
        tried = new Set();
        hint = null;
        draw(); // the answer shows as text first: speech is extra
        say(q.de);
        say(step.answer.de, { queue: true });
    }

    function onNote(f) {
        if (!f.right) {
            tried.add(f.de);
            shake = f.de;
            firstTry.fact = false;
            hint = HINT_NOTE;
            gameSounds.wrong();
            draw();
            return;
        }
        gameSounds.correct();
        results.push(firstTry);
        newNote = steps[index].section.id;
        index++;
        firstTry = { question: true, fact: true };
        tried = new Set();
        hint = null;
        phase = index < steps.length ? 'ask' : 'end';
        if (phase === 'end') teardown(); // the clock stops with the last note
        draw();
    }

    draw();
    if (clk && phase !== 'end') { tick(); timer = setInterval(tick, 1000); }
    return teardown;
}

// --- Fachsprachenprüfung practice run ---

/** A German text that shows its English on tap (toggled in place, no redraw). */
function tapText(de, en, cls = '') {
    const wrap = el('div', `case-sentence ${cls}`.trim());
    const b = el('button', 'case-de', de);
    b.type = 'button';
    b.setAttribute('aria-expanded', 'false');
    const e = el('div', 'case-en', en || '');
    e.hidden = true;
    b.addEventListener('click', () => {
        e.hidden = !e.hidden;
        b.setAttribute('aria-expanded', String(!e.hidden));
    });
    wrap.append(b);
    if (en) wrap.append(e);
    return wrap;
}

/** The three self-rating buttons; `onPick(i)` with the RATINGS index. */
function ratingRow(selected, onPick) {
    const row = el('div', 'exam-ratings');
    row.setAttribute('role', 'group');
    row.setAttribute('aria-label', 'Selbsteinschätzung');
    RATINGS.forEach((r, i) => {
        const b = el('button', 'exam-rating', r);
        b.type = 'button';
        b.dataset.rating = String(i);
        b.setAttribute('aria-pressed', String(selected === i));
        if (selected === i) b.classList.add('is-selected');
        b.addEventListener('click', () => onPick(i));
        row.append(b);
    });
    return row;
}

const SAVE_DELAY_MS = 600;

/**
 * The Fachsprachenprüfung practice run on one case: three parts of EXAM_PARTS, each with its clock,
 * then the summary. Part 1 = renderInterview with the clock; part 2 = one textarea per Anamnesebogen
 * section that has a model, then `Vergleichen`: her text above the model per section, each rated;
 * part 3 = the presentation skeleton, `Ich bin fertig` → the model (spoken, `Anhören` with a German
 * voice) and one rating; end = examSummary and `Fertig`. The run is kept in `fspDraft/<caseId>`
 * (saved as she types and on leaving, so she can come back: same part, texts and time; the clock
 * counts only while a part is open) and deleted with `Fertig`.
 * @param {HTMLElement} root
 * @param {{caseData: import('./types.js').Case, anamnese: Object, storage: Storage, rng?: () => number}} opts
 * @param {{onClose: () => void}} actions
 * @returns {() => void} teardown (saves the draft and stops the clock)
 */
export function renderExam(root, { caseData, anamnese, storage, rng = Math.random }, { onClose }) {
    const id = caseData.id;
    const st = examState(loadDraft(storage, id), Date.now());
    const draft = {
        part: st.part, startedAt: st.startedAt, elapsedMs: st.elapsedMs, texts: st.texts,
        score: st.score, ratings: st.ratings, compared: st.compared, presented: st.presented, talkRating: st.talkRating,
    };
    const sections = examSections(caseData, anamnese);
    const voice = () => gameSounds.hasGermanVoice();
    const say = (text, o) => { try { gameSounds.speak(text, o); } catch (e) { /* no speech: text only */ } };
    let clk = null; // parts 2 and 3
    let timer = null;
    let interview = null; // teardown of part 1
    let saveTimer = null;
    let closed = false;
    let inner = null;

    function save() {
        if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
        if (closed) return;
        if (clk) draft.elapsedMs = clk.elapsed();
        saveDraft(storage, id, draft);
    }
    const saveSoon = () => { if (saveTimer) clearTimeout(saveTimer); saveTimer = setTimeout(save, SAVE_DELAY_MS); };
    function stopClock() {
        if (timer) { clearInterval(timer); timer = null; }
        if (clk) { clk.stop(); draft.elapsedMs = clk.elapsed(); }
    }
    function teardown() {
        if (closed) return;
        try { gameSounds.cancelPrompt(); } catch (e) { /* no speech */ }
        if (interview) { draft.elapsedMs = interview(); interview = null; }
        if (timer) { clearInterval(timer); timer = null; }
        save();
        if (clk) clk.stop();
        closed = true;
    }
    function leave() { teardown(); onClose(); }
    function finish() {
        try { gameSounds.cancelPrompt(); } catch (e) { /* no speech */ }
        if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
        stopClock();
        closed = true;
        clearDraft(storage, id);
        onClose();
    }
    function goTo(part) {
        stopClock();
        clk = null;
        draft.part = part;
        draft.elapsedMs = 0;
        save();
        root.scrollTop = 0;
        show();
    }

    function startClock(running) {
        clk = countdown({ minutes: EXAM_PARTS[draft.part].minutes, elapsedMs: draft.elapsedMs });
        if (!running) { clk.stop(); return; }
        timer = setInterval(() => {
            if (!inner || !inner.isConnected) { teardown(); return; } // the screen was replaced without close
            clk.draw();
        }, 1000);
    }

    /** Top bar (close, the three parts, clock), part heading and patient line. */
    function frame() {
        inner = el('div', 'case-inner exam-inner');
        const bar = el('div', 'play-bar');
        const close = el('button', 'play-close');
        close.type = 'button';
        close.setAttribute('aria-label', 'Beenden');
        close.title = 'Beenden';
        close.innerHTML = CLOSE_ICON;
        close.addEventListener('click', () => (draft.part >= EXAM_PARTS.length ? finish() : leave()));
        const progress = el('div', 'play-progress');
        progress.setAttribute('role', 'progressbar');
        progress.setAttribute('aria-label', 'Fortschritt');
        const atEnd = draft.part >= EXAM_PARTS.length;
        for (const s of progressSegments(EXAM_PARTS.length, Math.min(draft.part, EXAM_PARTS.length - 1), atEnd)) {
            progress.append(el('span', `play-seg play-seg-${s}`));
        }
        bar.append(close, progress);
        if (clk) bar.append(clk.el);
        inner.append(bar);
        if (!atEnd) inner.append(el('p', 'exam-part', partHeading(draft.part)));
        const patient = el('section', 'case-patient');
        patient.setAttribute('aria-label', patientNoun(caseData.patient.gender) === 'der Patient' ? 'Patient' : 'Patientin');
        patient.append(tapText(patientLine(caseData.patient), caseData.patient.en, 'case-patient-line'));
        inner.append(patient);
        root.replaceChildren(inner);
        return inner;
    }

    const partHeading = i => `Teil ${i + 1} von ${EXAM_PARTS.length}: ${EXAM_PARTS[i].title}`;

    function continueButton(label, enabled, onClick) {
        const row = el('div', 'play-continue-row');
        const b = el('button', 'play-continue', label);
        b.type = 'button';
        b.disabled = !enabled;
        b.addEventListener('click', onClick);
        row.append(b);
        return row;
    }

    function showInterview() {
        inner = null;
        interview = renderInterview(root, {
            caseData, anamnese, rng, heading: partHeading(0),
            clock: { minutes: EXAM_PARTS[0].minutes, elapsedMs: draft.elapsedMs },
        }, {
            onDone: score => { interview = null; draft.score = score; goTo(1); },
            onClose: ({ elapsedMs }) => { interview = null; draft.elapsedMs = elapsedMs; leave(); },
        });
    }

    function showDocumentation() {
        startClock(!draft.compared);
        const page = frame();
        const notes = draft.score ? formState(caseData, anamnese, caseData.interview.length) : [];
        const list = el('div', 'exam-sections');
        sections.forEach((sec, i) => {
            const box = el('section', 'exam-section');
            box.dataset.section = sec.id;
            box.append(el('h2', 'exam-label', sec.title));
            const mine = draft.texts[sec.id] || '';
            if (!draft.compared) {
                const own = notes.find(n => n.id === sec.id);
                if (own && own.notes.length) {
                    const ul = el('ul', 'exam-notes');
                    own.notes.forEach(n => ul.append(el('li', '', n)));
                    box.append(ul);
                }
                const input = el('textarea', 'exam-input');
                input.rows = 3;
                input.value = mine;
                input.setAttribute('aria-label', sec.title);
                input.spellcheck = false;
                const grow = () => { input.style.height = 'auto'; input.style.height = `${input.scrollHeight + 2}px`; };
                input.addEventListener('input', () => { draft.texts[sec.id] = input.value; grow(); saveSoon(); });
                input.addEventListener('blur', save);
                box.append(input);
                requestAnimationFrame(grow);
            } else {
                box.append(el('div', 'exam-tag', 'Ihr Text'));
                box.append(mine.trim() ? el('p', 'exam-mine', mine) : el('p', 'exam-mine is-empty', '–'));
                box.append(el('div', 'exam-tag', 'Mustertext'));
                box.append(tapText(sec.model, sec.en, 'exam-model'));
                box.append(ratingRow(draft.ratings[i] ?? null, r => {
                    draft.ratings[i] = r;
                    save();
                    for (const b of box.querySelectorAll('.exam-rating')) {
                        const on = b.dataset.rating === String(r);
                        b.classList.toggle('is-selected', on);
                        b.setAttribute('aria-pressed', String(on));
                    }
                    next.querySelector('button').disabled = !allRated();
                }));
            }
            list.append(box);
        });
        page.append(list);
        const allRated = () => sections.every((_, i) => draft.ratings[i] != null);
        const next = draft.compared
            ? continueButton('Weiter', allRated(), () => goTo(2))
            : continueButton('Vergleichen', true, () => {
                stopClock();
                draft.compared = true;
                draft.ratings = sections.map(() => null);
                save();
                root.scrollTop = 0;
                show();
            });
        page.append(next);
    }

    function showPresentation() {
        startClock(!draft.presented);
        const page = frame();
        const box = el('section', 'exam-section');
        box.append(el('h2', 'exam-label', 'Vorstellung'));
        box.append(tapText(caseData.vorstellung.skeleton, caseData.vorstellung.skeletonEn, 'exam-skeleton'));
        page.append(box);
        if (!draft.presented) {
            page.append(continueButton('Ich bin fertig', true, () => {
                stopClock();
                draft.presented = true;
                save();
                show();
                say(caseData.vorstellung.model);
            }));
            return;
        }
        const model = el('section', 'exam-section');
        const head = el('div', 'exam-model-head');
        head.append(el('h2', 'exam-label', 'Mustertext'));
        if (voice()) {
            const listen = el('button', 'write-btn exam-listen', '🔊 Anhören');
            listen.type = 'button';
            listen.addEventListener('click', () => say(caseData.vorstellung.model, { force: true }));
            head.append(listen);
        }
        model.append(head, tapText(caseData.vorstellung.model, caseData.vorstellung.modelEn, 'exam-model'));
        const next = continueButton('Weiter', draft.talkRating != null, () => goTo(3));
        model.append(ratingRow(draft.talkRating, r => {
            draft.talkRating = r;
            save();
            for (const b of model.querySelectorAll('.exam-rating')) {
                const on = b.dataset.rating === String(r);
                b.classList.toggle('is-selected', on);
                b.setAttribute('aria-pressed', String(on));
            }
            next.querySelector('button').disabled = false;
        }));
        page.append(model, next);
    }

    function showSummary() {
        const page = frame();
        const box = el('section', 'exam-section exam-summary');
        box.append(el('h2', 'exam-label', 'Fachsprachenprüfung'));
        for (const line of examSummary(draft.score, draft.ratings, draft.talkRating).lines) box.append(el('p', 'exam-line', line));
        page.append(box, continueButton('Fertig', true, finish));
    }

    function show() {
        if (draft.part === 0) showInterview();
        else if (draft.part === 1) showDocumentation();
        else if (draft.part === 2) showPresentation();
        else showSummary();
    }

    save(); // a new run is kept from the start
    root.scrollTop = 0;
    show();
    return teardown;
}
