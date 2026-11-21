/**
 * Case screen (body[data-screen="case"]): the Anamnese interview ("Gespräch", FSP part 1).
 * Top: patient card. Middle: the Anamnesebogen, seven labelled boxes filling as she goes. Bottom
 * (sticky): per step the section and three questions; the right one is spoken, the patient's answer
 * appears as a bubble and is spoken; then three notes, the right one moves into its box.
 * Spoken prompts follow the "Aussprache" setting; the 🔊 buttons always speak. Without a German
 * voice everything still appears as text. Tapping a German sentence shows its English.
 * Logic in caseFlow.js; free of routing (the caller decides what onDone / onClose do).
 */

import { interviewSteps, formState, interviewScore, scoreLine, patientLine } from './caseFlow.js';
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
 * @param {HTMLElement} root
 * @param {{caseData: import('./types.js').Case, anamnese: Object, clock: ?{minutes: number}, rng?: () => number}} opts
 * @param {{onDone: (score: {questions: number, facts: number, total: number}) => void, onClose: () => void}} actions
 * @returns {() => void} teardown (stops the clock)
 */
export function renderInterview(root, { caseData, anamnese, clock = null, rng = Math.random }, { onDone, onClose }) {
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
    const finish = fn => (...args) => { if (!finished) { finished = true; teardown(); fn(...args); } };
    const done = finish(onDone);
    const closeScreen = finish(onClose);
    const voice = () => gameSounds.hasGermanVoice();
    const say = (text, o) => { try { gameSounds.speak(text, o); } catch (e) { /* no speech: text only */ } };

    let timer = null;
    const startedAt = Date.now();
    const clockEl = clock ? el('span', 'case-clock') : null;
    function tick() {
        if (!clockEl) return;
        if (!inner.isConnected) { teardown(); return; } // the screen was replaced without close
        const left = clock.minutes * 60000 - (Date.now() - startedAt);
        clockEl.textContent = clockText(left);
        clockEl.classList.toggle('is-over', left <= 0);
    }
    function teardown() { if (timer) { clearInterval(timer); timer = null; } }

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
        patient.setAttribute('aria-label', 'Patientin');
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

        inner.replaceChildren(bar, patient, form, panel);
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
        draw();
    }

    draw();
    if (clockEl) { tick(); timer = setInterval(tick, 1000); }
    return teardown;
}
