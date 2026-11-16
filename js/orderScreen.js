/**
 * Rung 2 "Ordnen" screen (production ladder): the learner taps a phrase chip, then a slot of the
 * field model (Vorfeld, Verb, Mittelfeld, Ende). Logic lives in orderExercise.js; this file only
 * draws and wires taps. renderOrderScreen() owns its state until onDone or onClose.
 * Reuses the play screen's top bar / feedback / "Weiter" classes so both screens look alike.
 */

import { createOrder, dropChip, isSolved, fieldChips } from './orderExercise.js';
import { progressSegments } from './playScreen.js';
import { gameSounds } from './sound.js';

const SLOT_LABELS = { vorfeld: 'Vorfeld', verb: 'Verb', mittelfeld: 'Mittelfeld', ende: 'Ende' };
const CLOSE_ICON = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
    'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';

const el = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
};

/**
 * @param {HTMLElement} root
 * @param {{model: import('./orderExercise.js').OrderModel, total: number, index: number}} opts
 * @param {{onDone: (mistakes: number) => void, onClose: () => void}} actions
 */
export function renderOrderScreen(root, { model, total, index }, { onDone, onClose }) {
    let state = createOrder(model);
    let selected = null;
    let hint = null; // { text, auto }
    const closedVorfeld = !model.chips.some(c => c.field === 'vorfeld');
    let finished = false; // onDone/onClose fire at most once, whichever comes first
    const finish = fn => (...args) => { if (!finished) { finished = true; fn(...args); } };
    const done = finish(onDone);
    const closeScreen = finish(onClose);
    // The feedback node stays in the DOM across draws (only its text changes), so the aria-live
    // region announces each new hint; draw() rebuilds everything around it.
    const inner = el('div', 'order-inner');
    const feedbackSlot = el('div', 'play-feedback-slot');
    const feedback = el('div', 'play-feedback play-feedback-wrong');
    feedbackSlot.appendChild(feedback);
    inner.appendChild(feedbackSlot);
    feedback.setAttribute('role', 'status');
    feedback.setAttribute('aria-live', 'polite');
    // model.chips are in sentence order, so joining them gives the spoken sentence
    const sentence = (model.lead ? model.lead + ' ' : '') + model.chips.map(c => c.text).join(' ') + model.end;

    function draw(shakeId = null) {
        const solved = isSolved(state);

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
        for (const s of progressSegments(total, index, solved)) progress.appendChild(el('span', `play-seg play-seg-${s}`));
        bar.append(close, progress);

        const prompt = el('div', 'play-prompt', 'Bau den Satz.');
        const lead = el('p', 'order-lead', model.lead);
        lead.lang = 'de';
        lead.hidden = !model.lead;

        const slots = el('div', 'order-slots');
        for (const f of model.fields) {
            const closed = f === 'vorfeld' && closedVorfeld;
            const slot = el('button', `order-slot order-slot-${f}${closed ? ' is-closed' : ''}`);
            slot.type = 'button';
            slot.dataset.field = f;
            slot.disabled = closed || solved;
            slot.setAttribute('aria-label', SLOT_LABELS[f] + (closed ? ' (nicht besetzt)' : ''));
            slot.append(el('span', 'order-slot-label', SLOT_LABELS[f]));
            const body = el('span', 'order-slot-body');
            for (const c of fieldChips(state, f)) body.appendChild(el('span', 'order-placed', c.text));
            slot.appendChild(body);
            slot.addEventListener('click', () => onSlot(f));
            slots.appendChild(slot);
        }
        if (model.end) slots.appendChild(el('span', 'order-end', model.end));

        feedback.textContent = hint ? hint.text : '';
        feedback.hidden = !hint;

        let bottom;
        if (solved) {
            bottom = el('div', 'play-continue-row');
            const next = el('button', 'play-continue', 'Weiter ›');
            next.type = 'button';
            next.addEventListener('click', () => done(state.mistakes));
            bottom.appendChild(next);
        } else {
            bottom = el('div', 'order-tray');
            bottom.setAttribute('role', 'group');
            bottom.setAttribute('aria-label', 'Satzteile');
            for (const id of state.tray) {
                const chip = el('button', 'order-chip', model.chips[id].text);
                chip.type = 'button';
                chip.dataset.chip = String(id);
                chip.setAttribute('aria-pressed', String(selected === id));
                if (id === shakeId) chip.classList.add('order-shake');
                chip.addEventListener('click', () => { selected = selected === id ? null : id; draw(); });
                bottom.appendChild(chip);
            }
        }

        for (const node of [...inner.children]) if (node !== feedbackSlot) node.remove();
        inner.prepend(bar, prompt, lead, slots);
        inner.append(bottom);
        if (root.firstChild !== inner) root.replaceChildren(inner);
    }

    function onSlot(field) {
        if (selected === null) return;
        const id = selected;
        const res = dropChip(state, id, field);
        state = res.state;
        selected = null;
        hint = res.hint ? { text: res.hint, auto: res.auto } : null;
        if (res.ok) gameSounds.correct();
        else if (res.hint) gameSounds.wrong();
        draw(res.ok || res.auto ? null : id);
        if (isSolved(state)) gameSounds.speak(sentence);
    }

    draw();
}
