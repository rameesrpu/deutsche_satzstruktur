/**
 * Rung 5 "Sprechen" screen (production ladder): she says the sentence and browser speech
 * recognition checks it (speechInput.js + speechMatch in textMatch.js), with an honest self-check
 * way out ("Die Erkennung hat sich geirrt", or no recognition at all). Pure helpers speakMode /
 * speakStep; renderSpeakScreen() owns its state until onDone or onClose.
 * Before the first recording a privacy card asks (choice stored via settings.js); no audio is
 * recorded before she chooses. Reuses the play screen's bar / prompt / "Weiter" classes.
 */

import { speechMatch } from './textMatch.js';
import { speechAvailable, listen } from './speechInput.js';
import { getRecognitionChoice, setRecognitionChoice } from './settings.js';
import { progressSegments } from './playScreen.js';
import { gameSounds } from './sound.js';

export const SPEECH_TRIES = 3;
/** How long the German sentence is shown as the cue when there is no translation. */
export const CUE_MS = 4000;

const CLOSE_ICON = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
    'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
const MIC_ICON = '<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
    'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>';

/** Errors that just mean "nothing usable was heard": try again, the try does not count. */
const QUIET_ERRORS = ['no-speech', 'no-result', 'aborted'];
/** Errors of a refused microphone: not asked again in this page session. */
const BLOCKED_ERRORS = ['not-allowed', 'service-not-allowed'];
const BLOCKED_NOTE = 'Kein Zugriff aufs Mikrofon. Prüf dich selbst.';

/** Set after a refused microphone; later Sprechen sentences start in the self-check (not stored). */
let micBlocked = false;

/** The line shown when recognition falls back to the self-check after `error`. */
export function fallbackNote(error) {
    return BLOCKED_ERRORS.includes(error) ? BLOCKED_NOTE : 'Die Erkennung geht gerade nicht. Prüf dich selbst.';
}

/**
 * @param {{available: boolean, choice: 'on'|'off'|null, blocked?: boolean}} env
 *   blocked: the microphone was refused earlier in this page session
 * @returns {'ask'|'recognise'|'self'}
 */
export function speakMode({ available, choice, blocked = false }) {
    if (!available || choice === 'off' || blocked) return 'self';
    return choice === 'on' ? 'recognise' : 'ask';
}

/**
 * One recognition attempt.
 * @param {{tries: number}} state tries counted before this attempt
 * @param {{pass: boolean}} match speechMatch result (ignored when there is an error)
 * @param {?string} error listen() error code
 * @returns {{tries: number, done: boolean, ok: boolean, fallback: boolean}}
 */
export function speakStep(state, match, error) {
    const tries = state.tries;
    if (error) {
        // quiet errors: listen again; anything else (permission refused, offline…): self-check
        return { tries, done: false, ok: false, fallback: !QUIET_ERRORS.includes(error) };
    }
    if (match.pass) return { tries: tries + 1, done: true, ok: true, fallback: false };
    const n = tries + 1;
    return { tries: n, done: n >= SPEECH_TRIES, ok: false, fallback: false };
}

const el = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
};
const button = (cls, text, onClick) => {
    const b = el('button', cls, text);
    b.type = 'button';
    b.addEventListener('click', onClick);
    return b;
};

/**
 * Per-word ✓/✗ marks of a speechMatch result (reuses the Schreiben mark styles).
 * final: missed words spelled out; else blanks of their length, so a retry is not read off.
 */
function marksRow(match, final) {
    const row = el('div', 'write-marks');
    row.setAttribute('aria-label', 'Ergebnis');
    row.lang = 'de';
    for (const w of match.words) {
        const chip = el('span', `write-mark write-mark-${w.heard ? 'ok' : 'bad'}`);
        const shown = w.heard || final ? w.text : '_'.repeat(w.text.length);
        chip.append(el('span', 'write-mark-word', shown), el('span', 'write-mark-sign', w.heard ? '✓' : '✗'));
        chip.title = w.heard ? 'gehört' : 'nicht gehört';
        row.appendChild(chip);
    }
    return row;
}

/**
 * @param {HTMLElement} root
 * @param {{text: string, translation?: ?string, total: number, index: number, storage?: Storage, win?: object}} opts
 *   win: where SpeechRecognition is looked up (a test harness injects a fake one)
 * @param {{onDone: (ok: boolean) => void, onClose: () => void}} actions
 * @returns {() => void}  teardown: aborts listening, clears the cue timer, cancels speech and marks the
 *   screen finished, without calling onDone/onClose
 */
export function renderSpeakScreen(root, { text, translation = null, total, index, storage = globalThis.localStorage, win = globalThis },
    { onDone, onClose }) {
    let mode = speakMode({ available: speechAvailable(win), choice: getRecognitionChoice(storage), blocked: micBlocked });
    // A refused microphone earlier in this session: say why there is no recognition
    const startNote = micBlocked && mode === 'self' && getRecognitionChoice(storage) === 'on' ? BLOCKED_NOTE : null;
    let step = { tries: 0, done: false, ok: false, fallback: false };
    let handle = null; // open listen() call
    let cueTimer = null;
    let finished = false; // onDone/onClose fire at most once; later results are ignored
    const stopAll = () => {
        if (cueTimer) { clearTimeout(cueTimer); cueTimer = null; }
        if (handle) { handle.abort(); handle = null; }
        gameSounds.cancelPrompt();
    };
    const finish = fn => (...args) => {
        if (finished) return;
        finished = true;
        stopAll();
        fn(...args);
    };
    const done = finish(onDone);
    const closeScreen = finish(onClose);
    const playSentence = () => gameSounds.speak(text, { force: true });

    const inner = el('div', 'order-inner speak-inner');

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

    const prompt = el('div', 'play-prompt', translation ? 'Sag den Satz auf Deutsch.' : 'Lies. Merk dir. Sprich.');
    const cue = el('div', 'speak-cue');
    const body = el('div', 'speak-body'); // privacy card, microphone, self-check
    // aria-live region stays in the DOM; its content changes on each attempt
    const result = el('div', 'speak-result');
    result.setAttribute('role', 'status');
    result.setAttribute('aria-live', 'polite');

    // ---- cue ----
    function hideGermanCue() {
        if (cueTimer) { clearTimeout(cueTimer); cueTimer = null; }
        const s = cue.querySelector('.speak-cue-german');
        if (s) s.replaceWith(el('p', 'speak-cue-hidden', '…'));
    }
    function showCue() {
        if (translation) {
            const t = el('p', 'speak-cue-translation', `„${translation}“`);
            t.lang = 'en';
            cue.replaceChildren(t);
            return;
        }
        const g = el('button', 'speak-cue-german', text);
        g.type = 'button';
        g.lang = 'de';
        g.title = 'Tippen zum Verstecken';
        g.addEventListener('click', hideGermanCue);
        cue.replaceChildren(g);
        cueTimer = setTimeout(hideGermanCue, CUE_MS);
    }

    // ---- privacy card (first use) ----
    function showPrivacy() {
        const card = el('div', 'speak-privacy');
        const title = el('h2', 'speak-privacy-title', 'Spracherkennung');
        const p = el('p', 'speak-privacy-text', 'Die Aufnahme geht zur Erkennung an Google.');
        const row = el('div', 'speak-actions');
        const yes = button('write-check', 'Einverstanden', () => {
            setRecognitionChoice(storage, 'on');
            mode = 'recognise';
            start();
        });
        const no = button('write-btn', 'Ohne Erkennung üben', () => {
            setRecognitionChoice(storage, 'off');
            mode = 'self';
            start();
        });
        row.append(yes, no);
        card.append(title, p, row);
        body.replaceChildren(card);
        yes.focus();
    }

    // ---- recognition ----
    const mic = el('button', 'speak-mic');
    mic.type = 'button';
    mic.setAttribute('aria-label', 'Mikrofon: tippen und sprechen');
    mic.innerHTML = MIC_ICON;
    mic.addEventListener('click', startListening);
    const micStatus = el('p', 'speak-mic-status');
    const micWrap = el('div', 'speak-mic-wrap');
    micWrap.append(mic, micStatus);

    function showMic() {
        body.replaceChildren(micWrap);
        micWrap.hidden = false;
    }

    function setListening(on) {
        mic.classList.toggle('speak-mic-on', on);
        mic.setAttribute('aria-pressed', on ? 'true' : 'false');
        micStatus.textContent = on ? 'Ich höre zu …' : '';
    }

    function startListening() {
        if (finished || handle || step.done || mode !== 'recognise') return;
        hideGermanCue();
        gameSounds.cancelPrompt(); // the model sentence must not be recognised as her answer
        showMic();
        result.replaceChildren();
        setListening(true);
        const h = listen({ win });
        handle = h;
        h.result.then(out => {
            if (finished || handle !== h) return; // closed, finished or superseded
            handle = null;
            setListening(false);
            onHeard(out);
        });
    }

    function onHeard({ heard, error }) {
        const match = error ? null : speechMatch(text, heard);
        step = speakStep(step, match || { pass: false }, error);
        if (step.fallback) {
            mode = 'self';
            if (BLOCKED_ERRORS.includes(error)) micBlocked = true;
            showSelf(fallbackNote(error));
            return;
        }
        if (error) {
            if (error !== 'aborted') {
                result.replaceChildren(el('p', 'speak-hint', 'Ich habe nichts gehört. Tipp auf das Mikrofon und sprich.'));
            }
            return;
        }
        const heardLine = el('p', 'speak-heard');
        const heardText = el('span', '', `„${match.best}“`);
        heardText.lang = 'de';
        heardLine.append('Gehört: ', heardText);
        const parts = [heardLine, marksRow(match, step.done)];
        const row = el('div', 'speak-actions');
        if (step.ok) {
            gameSounds.correct();
            row.append(button('write-btn', '🔊 Anhören', playSentence));
            parts.push(row, continueRow(true));
        } else if (!step.done) {
            gameSounds.wrong();
            micWrap.hidden = true; // "Nochmal" takes its place
            const again = button('write-check', 'Nochmal', startListening);
            row.append(again, button('write-btn', '🔊 Anhören', playSentence));
            parts.push(row, misheardLink());
            result.replaceChildren(...parts);
            drawProgress();
            again.focus();
            return;
        } else {
            gameSounds.wrong();
            const shown = el('p', 'write-sentence', text);
            shown.lang = 'de';
            parts.unshift(shown);
            row.append(button('write-btn', '🔊 Anhören', playSentence));
            parts.push(row, misheardLink(), continueRow(false));
        }
        body.replaceChildren();
        result.replaceChildren(...parts);
        drawProgress();
        result.querySelector('.play-continue')?.focus();
    }

    function misheardLink() {
        const link = button('speak-link', 'Die Erkennung hat sich geirrt', () => showSelfQuestion());
        const p = el('p', 'speak-link-row');
        p.appendChild(link);
        return p;
    }

    function continueRow(ok) {
        const row = el('div', 'play-continue-row');
        row.appendChild(button('play-continue', 'Weiter ›', () => done(ok)));
        return row;
    }

    // ---- self-check ----
    /** Self-check only: she speaks freely, then taps "Anhören" to compare. */
    function showSelf(note) {
        if (handle) { handle.abort(); handle = null; }
        const parts = [];
        if (note) parts.push(el('p', 'speak-hint', note));
        parts.push(el('p', 'speak-self-hint', 'Sprich den Satz laut. Dann tipp auf „Anhören“.'));
        const row = el('div', 'speak-actions');
        const hear = button('write-check', '🔊 Anhören', () => showSelfQuestion());
        row.appendChild(hear);
        parts.push(row);
        body.replaceChildren(...parts);
        result.replaceChildren();
        hear.focus();
    }

    /** Plays and shows the sentence and asks for her own verdict. */
    function showSelfQuestion() {
        if (finished) return;
        if (handle) { handle.abort(); handle = null; }
        hideGermanCue();
        playSentence();
        const shown = el('p', 'write-sentence', text);
        shown.lang = 'de';
        const again = el('div', 'speak-actions');
        again.appendChild(button('write-btn', '🔊 Anhören', playSentence));
        const q = el('p', 'speak-question', 'Hattest du es richtig?');
        const answers = el('div', 'speak-actions speak-answers');
        const yes = button('write-check', 'Ja', () => done(true));
        answers.append(yes, button('write-btn', 'Noch nicht', () => done(false)));
        body.replaceChildren();
        result.replaceChildren(shown, again, q, answers);
        yes.focus();
    }

    function start() {
        showCue();
        if (mode === 'recognise') {
            showMic();
            setListening(false);
            mic.focus();
        } else {
            showSelf(startNote);
        }
    }

    inner.append(bar, prompt, cue, body, result);
    root.replaceChildren(inner);
    drawProgress();
    if (mode === 'ask') showPrivacy();
    else start();
    return () => { finished = true; stopAll(); };
}
