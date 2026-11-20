/**
 * Board screen (body[data-screen="board"]): the set list of a board, a set view with its modes,
 * and the practice session of a scored mode. What a picture looks like and what a tap means is
 * the board's `kind` (KINDS, registered by the kind's module); this file owns the chrome:
 * set list, mode buttons, session queue (boardSession.js), progress, "Weiter" and the closing line.
 * Reuses the play screen's top bar / progress / "Weiter" classes.
 */

import { pickSession, sessionOptions } from './boardSchedule.js';
import { createSession, currentItem, isFirstAnswer, answer, sessionDone, sessionResults } from './boardSession.js';
import { boardKey, isSetLocked, setModes, itemIdsFor, KINDS, registerKind } from './boards.js';
import { progressSegments } from './playScreen.js';
import { gameSounds } from './sound.js';

export { KINDS, registerKind };

const CLOSE_ICON = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
    'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';

const el = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
};
const btn = (cls, text, onClick) => {
    const b = el('button', cls, text);
    b.type = 'button';
    b.addEventListener('click', onClick);
    return b;
};

/**
 * @param {HTMLElement} root
 * @param {{board: Object, isChapterComplete: function(string, string): boolean,
 *   getBoard: function(string): ?Object, now: number, start?: {setId: string, modeId: string}}} state
 * @param {{record: function(string, boolean), close: function()}} actions
 * @returns {() => void}  teardown: stops speech and the kind's screen; no callbacks fire afterwards
 */
export function renderBoardScreen(root, state, { record, close }) {
    const { board, isChapterComplete, getBoard, now } = state;
    let finished = false;
    let kindTeardown = null;
    let view = { set: null, mode: null, session: null, answered: false };

    const stopKind = () => {
        if (typeof kindTeardown === 'function') kindTeardown();
        kindTeardown = null;
        gameSounds.cancelPrompt();
    };
    const guard = fn => (...args) => { if (!finished) fn(...args); };

    const topBar = (progress = null) => {
        const bar = el('div', 'play-bar');
        const x = btn('play-close', '', guard(close));
        x.setAttribute('aria-label', 'Beenden');
        x.title = 'Beenden';
        x.innerHTML = CLOSE_ICON;
        bar.append(x);
        if (progress) bar.append(progress);
        return bar;
    };

    const show = (...parts) => {
        stopKind();
        const inner = el('div', 'order-inner board-inner');
        inner.append(...parts);
        root.replaceChildren(inner);
        return inner;
    };

    function showList() {
        view = { set: null, mode: null, session: null, answered: false };
        const list = el('ul', 'board-sets');
        for (const set of board.sets) {
            const locked = isSetLocked(set, isChapterComplete);
            const li = el('li', `board-set${locked ? ' is-locked' : ''}`);
            const text = el('span', 'board-set-text');
            text.append(el('span', 'board-set-title', set.title));
            if (locked) {
                text.append(el('span', 'home-muted', `Nach „${set.unlock.label}“`));
                li.setAttribute('aria-disabled', 'true');
                li.append(text);
            } else {
                const b = btn('board-set-btn', '', () => showSet(set));
                b.append(text);
                li.append(b);
            }
            list.append(li);
        }
        show(topBar(), el('h1', 'screen-title board-title', board.title), list);
    }

    function showSet(set) {
        view = { set, mode: null, session: null, answered: false };
        const modes = el('div', 'board-modes');
        for (const mode of setModes(board, set)) {
            modes.append(btn('board-mode-btn', mode.label, () => startMode(set, mode)));
        }
        show(topBar(), btn('board-back', `‹ ${board.title}`, showList), el('h1', 'screen-title board-title', set.title), modes);
    }

    function startMode(set, mode, review = false) {
        if (!mode.scored) {
            view = { set, mode: mode.id, session: null, answered: false };
            drawSession();
            return;
        }
        const ids = itemIdsFor(board, set, mode.id);
        const get = id => getBoard(boardKey(board.id, set.id, id, mode.id));
        const picked = pickSession(ids, get, now, sessionOptions(review));
        view = { set, mode: mode.id, session: createSession(picked), answered: false, empty: picked.length === 0 };
        drawSession();
    }

    function drawSession() {
        const { set, mode, session } = view;
        const back = btn('board-back', `‹ ${set.title}`, () => showSet(set));
        const kind = KINDS[board.kind];
        if (!kind) { show(topBar(), back, el('p', 'home-muted board-note', 'Dieses Bild kommt bald.')); return; }
        if (session && view.empty) {
            const note = set.items.length === 0 ? 'Noch keine Wörter.' : 'Heute ist nichts fällig.';
            show(topBar(), back, el('p', 'home-muted board-note', note));
            return;
        }
        if (session && sessionDone(session)) { drawClosing(back); return; }

        const itemId = session ? currentItem(session) : null;
        const progress = session ? el('div', 'play-progress') : null;
        if (progress) {
            progress.setAttribute('role', 'progressbar');
            progress.setAttribute('aria-label', 'Fortschritt');
            progress.append(...progressSegments(session.queue.length, session.pos, view.answered)
                .map(s => el('span', `play-seg play-seg-${s}`)));
        }
        const stage = el('div', `board-stage board-stage--${mode}`);
        const slot = el('div', 'board-continue');
        const inner = show(topBar(progress), back, stage, slot);
        const ctx = {
            board, set, mode, itemId, items: set.items,
            onAnswer: guard(ok => {
                if (!session || view.answered || view.session !== session) return;
                view.answered = true;
                if (isFirstAnswer(session)) record(boardKey(board.id, set.id, itemId, mode), ok);
                const row = el('div', 'play-continue-row');
                row.append(btn('play-continue', 'Weiter ›', guard(() => {
                    view.session = answer(session, ok);
                    view.answered = false;
                    drawSession();
                })));
                slot.replaceChildren(row);
                progress.replaceChildren(...progressSegments(session.queue.length, session.pos, true)
                    .map(s => el('span', `play-seg play-seg-${s}`)));
            }),
            // speak: automatic speech (prompts, Entdecken taps) follows the learner's "Aussprache" setting;
            // say: a deliberate tap on a 🔊 button always speaks
            speak: text => gameSounds.speak(text),
            say: text => gameSounds.speak(text, { force: true }),
        };
        kindTeardown = kind.renderSet(stage, ctx);
        return inner;
    }

    function drawClosing(back) {
        const results = sessionResults(view.session);
        const right = results.filter(r => r.ok).length;
        const set = view.set;
        const row = el('div', 'play-continue-row');
        row.append(btn('play-continue', 'Fertig', guard(() => showSet(set))));
        show(topBar(), back, el('p', 'board-result', `${right} von ${results.length} richtig`), row);
    }

    if (state.start) {
        const set = board.sets.find(s => s.id === state.start.setId);
        const mode = set && setModes(board, set).find(m => m.id === state.start.modeId);
        if (set && mode && !isSetLocked(set, isChapterComplete)) startMode(set, mode, true);
        else showList();
    } else {
        showList();
    }
    return () => { finished = true; stopKind(); };
}
