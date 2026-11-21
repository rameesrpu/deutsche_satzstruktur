/**
 * Sort screen (body[data-screen="sort"]): the learner taps a chip, then a labelled zone.
 * Logic lives in sortExercise.js; this file only draws and wires taps. Free of routing:
 * the caller decides what onDone / onClose do. Reuses the Ordnen screen's bar/feedback/chip classes.
 */

import { createSort, dropOnZone, sortSolved, zoneChips } from './sortExercise.js';
import { progressSegments } from './playScreen.js';
import { gameSounds } from './sound.js';

const CLOSE_ICON = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
    'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
const DEFAULT_HINT = 'Das gehört woanders hin.';

const el = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
};

/**
 * @param {HTMLElement} root
 * @param {{model: import('./sortExercise.js').SortModel, total: number, index: number,
 *          hint?: ?(chip: import('./sortExercise.js').SortChip, zoneId: string) => string}} opts
 * @param {{onDone: (mistakes: number) => void, onClose: () => void}} actions
 */
export function renderSortScreen(root, { model, total, index, hint: hintFor }, { onDone, onClose }) {
    root.scrollTop = 0; // a new sort opens at the top, not where the last screen ended
    let state = createSort(model);
    let selected = null;
    let hint = null;
    let info = null; // en text of a tapped placed chip
    let finished = false; // onDone/onClose fire at most once
    const finish = fn => (...args) => { if (!finished) { finished = true; fn(...args); } };
    const done = finish(onDone);
    const closeScreen = finish(onClose);
    // The feedback node stays in the DOM across draws so the aria-live region announces changes.
    const inner = el('div', 'order-inner sort-inner');
    const feedbackSlot = el('div', 'play-feedback-slot');
    const feedback = el('div', 'play-feedback play-feedback-wrong');
    feedbackSlot.appendChild(feedback);
    // The dock (hint + tray) sticks to the bottom of the screen so the tray stays reachable as the zones grow.
    const dock = el('div', 'sort-dock');
    dock.appendChild(feedbackSlot);
    inner.appendChild(dock);
    feedback.setAttribute('role', 'status');
    feedback.setAttribute('aria-live', 'polite');

    function draw(shakeId = null) {
        const solved = sortSolved(state);

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

        const prompt = el('div', 'play-prompt', model.title);

        const zones = el('div', 'sort-zones');
        for (const z of model.zones) {
            const zone = el('button', 'order-slot sort-zone');
            zone.type = 'button';
            zone.dataset.zone = z.id;
            zone.disabled = solved;
            zone.setAttribute('aria-label', z.title);
            zone.append(el('span', 'order-slot-label', z.title));
            const body = el('span', 'order-slot-body');
            for (const c of zoneChips(state, z.id)) {
                const placed = el('span', 'order-placed', c.text);
                placed.dataset.chip = c.id;
                if (c.en) {
                    placed.tabIndex = 0;
                    placed.setAttribute('role', 'button');
                    // with a tray chip selected, a tap on a placed chip drops onto its zone; else it shows the English
                    const show = e => {
                        e.stopPropagation();
                        if (selected !== null) { onZone(z.id); return; }
                        info = info === c.id ? null : c.id;
                        draw();
                    };
                    placed.addEventListener('click', show);
                    placed.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); show(e); } });
                }
                body.appendChild(placed);
            }
            zone.appendChild(body);
            zone.addEventListener('click', () => onZone(z.id));
            zones.appendChild(zone);
        }

        const infoChip = info && model.chips.find(c => c.id === info);
        const shown = hint ? hint : infoChip ? infoChip.en : '';
        feedback.textContent = shown;
        feedback.classList.toggle('play-feedback-wrong', !!hint);
        feedback.hidden = !shown;

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
            bottom.setAttribute('aria-label', 'Karten');
            for (const id of state.tray) {
                const chip = el('button', 'order-chip', model.chips.find(c => c.id === id).text);
                chip.type = 'button';
                chip.dataset.chip = id;
                chip.setAttribute('aria-pressed', String(selected === id));
                if (id === shakeId) chip.classList.add('order-shake');
                chip.addEventListener('click', () => { selected = selected === id ? null : id; draw(); });
                bottom.appendChild(chip);
            }
        }

        for (const node of [...inner.children]) if (node !== dock) node.remove();
        for (const node of [...dock.children]) if (node !== feedbackSlot) node.remove();
        inner.prepend(bar, prompt, zones);
        dock.append(bottom);
        if (root.firstChild !== inner) root.replaceChildren(inner);
    }

    function onZone(zoneId) {
        if (selected === null) return;
        const id = selected;
        const chip = model.chips.find(c => c.id === id);
        const res = dropOnZone(state, id, zoneId);
        state = res.state;
        selected = null;
        info = null;
        hint = res.ok ? null : (hintFor ? hintFor(chip, zoneId) : DEFAULT_HINT) || DEFAULT_HINT;
        if (res.ok) gameSounds.correct();
        else gameSounds.wrong();
        draw(res.ok || res.auto ? null : id);
    }

    draw();
}
