/**
 * Rung 4 "Schreiben" screen (production ladder): she hears a sentence and types it.
 * Matching lives in textMatch.js; this file holds the two pure helpers (writeStep, retryText),
 * draws the screen and wires input. renderWriteScreen() owns its state until onDone or onClose.
 * Reuses the play screen's top bar / feedback / "Weiter" classes so the screens look alike.
 */

import { compareTyped } from './textMatch.js';
import { progressSegments } from './playScreen.js';
import { gameSounds } from './sound.js';

export const WRITE_TRIES = 2;

const CLOSE_ICON = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
    'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
const MARKS = { ok: '✓', case: '~', typo: '~', wrong: '✗', missing: '✗' };

/**
 * One check of the typed text.
 * @param {{tries: number}} state tries made before this check
 * @param {{pass: boolean}} result
 * @returns {{tries: number, done: boolean, ok: boolean, reveal: boolean}}
 */
export function writeStep(state, result) {
    const tries = state.tries + 1;
    if (result.pass) return { tries, done: true, ok: true, reveal: false };
    if (tries < WRITE_TRIES) return { tries, done: false, ok: false, reveal: false };
    return { tries, done: true, ok: false, reveal: true };
}

/**
 * Text put back into the input after a failed try: ok/case/typo words as typed, wrong/missing words as
 * underscores of the expected length, extra words dropped.
 * @param {ReturnType<typeof compareTyped>} result
 */
export function retryText(result) {
    return result.words
        .map(w => (w.status === 'wrong' || w.status === 'missing') ? '_'.repeat(w.text.length) : w.typed)
        .join(' ');
}

const el = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
};

/** Row of per-word marks. final: expected spelling for typos and wrong words; else blanks for wrong ones. */
function marksRow(result, final) {
    const row = el('div', 'write-marks');
    row.setAttribute('aria-label', 'Ergebnis');
    row.lang = 'de';
    for (const w of result.words) {
        const bad = w.status === 'wrong' || w.status === 'missing';
        const shown = final ? w.text : bad ? '_'.repeat(w.text.length) : w.typed;
        const chip = el('span', `write-mark write-mark-${bad ? 'bad' : w.status}`);
        chip.append(el('span', 'write-mark-word', shown), el('span', 'write-mark-sign', MARKS[w.status]));
        chip.title = { ok: 'richtig', case: 'Großschreibung', typo: 'Tippfehler', wrong: 'falsch', missing: 'fehlt' }[w.status];
        row.appendChild(chip);
    }
    for (const x of result.extra) {
        const chip = el('span', 'write-mark write-mark-extra');
        chip.append(el('s', 'write-mark-word', x), el('span', 'write-mark-sign', '✗'));
        chip.title = 'zu viel';
        row.appendChild(chip);
    }
    return row;
}

/**
 * @param {HTMLElement} root
 * @param {{text: string, translation?: ?string, total: number, index: number}} opts
 * @param {{onDone: (ok: boolean) => void, onClose: () => void}} actions
 * @returns {() => void}  teardown: stops speech and marks the screen finished without calling onDone/onClose
 */
export function renderWriteScreen(root, { text, translation = null, total, index }, { onDone, onClose }) {
    let step = { tries: 0, done: false, ok: false, reveal: false };
    let last = null; // result of the last check
    let finished = false; // onDone/onClose fire at most once, whichever comes first
    const finish = fn => (...args) => {
        if (finished) return;
        finished = true;
        gameSounds.cancelPrompt();
        fn(...args);
    };
    const done = finish(onDone);
    const closeScreen = finish(onClose);
    const speak = rate => gameSounds.speak(text, { rate, force: true });

    const inner = el('div', 'order-inner write-inner');

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
    bar.append(close, progress);
    const drawProgress = () => {
        progress.replaceChildren(...progressSegments(total, index, step.done).map(s => el('span', `play-seg play-seg-${s}`)));
    };

    const prompt = el('div', 'play-prompt', 'Hör zu und schreib den Satz.');

    const listen = el('div', 'write-listen');
    const again = el('button', 'write-btn', '🔊 Nochmal');
    again.type = 'button';
    again.addEventListener('click', () => speak());
    const slow = el('button', 'write-btn', 'Langsam');
    slow.type = 'button';
    slow.addEventListener('click', () => speak(0.7));
    listen.append(again, slow);

    const input = el('textarea', 'write-input');
    input.rows = 2;
    input.setAttribute('autocapitalize', 'sentences');
    input.setAttribute('autocomplete', 'off');
    input.setAttribute('autocorrect', 'off');
    input.setAttribute('spellcheck', 'false');
    input.setAttribute('lang', 'de');
    input.setAttribute('aria-label', 'Satz');

    const tools = el('div', 'write-tools');
    const keys = el('div', 'write-keys');
    for (const ch of ['ä', 'ö', 'ü', 'ß']) {
        const k = el('button', 'write-key', ch);
        k.type = 'button';
        k.setAttribute('aria-label', ch);
        // keep focus in the textarea so the phone keyboard stays open
        k.addEventListener('pointerdown', e => e.preventDefault());
        k.addEventListener('mousedown', e => e.preventDefault());
        k.addEventListener('click', () => {
            const a = input.selectionStart ?? input.value.length;
            const b = input.selectionEnd ?? a;
            input.setRangeText(ch, a, b, 'end');
            input.focus();
            input.dispatchEvent(new Event('input'));
        });
        keys.appendChild(k);
    }
    const check = el('button', 'write-check', 'Prüfen');
    check.type = 'button';
    check.disabled = true;
    tools.append(keys, check);

    // aria-live region stays in the DOM; its content changes on each check
    const result = el('div', 'write-result');
    result.setAttribute('role', 'status');
    result.setAttribute('aria-live', 'polite');

    input.addEventListener('input', () => { check.disabled = input.value.trim() === ''; });
    input.addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); onCheck(); }
    });
    check.addEventListener('click', onCheck);

    function onCheck() {
        if (step.done || input.value.trim() === '') return;
        const res = compareTyped(text, input.value);
        step = writeStep(step, res);
        last = res;
        if (!step.done) {
            gameSounds.wrong();
            input.value = retryText(res);
            input.dispatchEvent(new Event('input'));
            result.replaceChildren(marksRow(res, false));
            input.focus();
            input.setSelectionRange(input.value.length, input.value.length);
        } else {
            if (step.ok) gameSounds.correct(); else gameSounds.wrong();
            showFinal();
            if (step.reveal) speak();
        }
        drawProgress();
    }

    function showFinal() {
        input.blur();
        const shown = el('p', 'write-sentence', text);
        shown.lang = 'de';
        const parts = [shown, marksRow(last, true)];
        if (translation) parts.push(el('p', 'write-translation', translation));
        const row = el('div', 'play-continue-row');
        const next = el('button', 'play-continue', 'Weiter ›');
        next.type = 'button';
        next.addEventListener('click', () => done(step.ok));
        row.appendChild(next);
        parts.push(row);
        result.replaceChildren(...parts);
        for (const n of [input, tools]) n.hidden = true; // the listen buttons stay to hear it again
        next.focus();
    }

    inner.append(bar, prompt, listen, input, tools, result);
    root.replaceChildren(inner);
    drawProgress();
    speak();
    input.focus();
    return () => { finished = true; gameSounds.cancelPrompt(); };
}
